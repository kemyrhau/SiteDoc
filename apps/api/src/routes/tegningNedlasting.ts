import type { FastifyInstance, FastifyReply } from "fastify";
import { stat } from "node:fs/promises";
import archiver from "archiver";
import { prisma } from "@sitedoc/db";
import { byggTegningNedlastingsnavn, unikNedlastingsnavn } from "@sitedoc/shared";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";
import { diskSti } from "../services/eksport/felles";
import { sjekkRateLimit, hentKlientIp } from "../utils/rateLimiter";

/**
 * Nedlasting av tegninger som ZIP — valgte tegninger (avkryssing) eller en hel
 * serie (orkestrator-ordre 2026-10-10). Enkeltfil-nedlasting går IKKE hit: web
 * laster ned originalfila direkte via signert `/uploads/`-URL + `download`-attributt
 * (SignertLenke). Denne ruten finnes fordi flere filer må pakkes server-side og
 * strømmes — aldri lastes inn i nettleseren (orkestrators anbefaling).
 *
 * 🔴 Tilgang: cookie-sesjon (samme mønster som `POST /upload`) → `userId`, deretter
 * `verifiserProsjektmedlem` — SAMME sjekk som å åpne tegningen (`tegning.hentMedId`).
 * Prosjektet UTLEDES fra de forespurte tegningene (ikke klient-oppgitt): spenner
 * id-ene flere prosjekter, eller finnes en id ikke, avvises HELE forespørselen (403).
 * Så en fremmed id kan ikke smugles inn i zip-lista.
 *
 * Strømming: `archiver` pipes rett til `reply.raw` etter `reply.hijack()`. Filnavn
 * og zip-navn er DATA (tegningsnummer/serienavn) og går ikke gjennom `t()`.
 */

/** En tegningsrad slik ruten trenger den for navngiving + disk-oppslag. */
export interface ZipTegningRad {
  id: string;
  name: string;
  drawingNumber: string | null;
  revision: string;
  fileUrl: string;
  originalFileUrl: string | null;
  projectId: string;
}

/**
 * Utled det ENE prosjektet et sett forespurte tegninger hører til — eller avvis.
 * Ren funksjon (ingen DB) så avvisnings-regelen kan enhets-testes.
 *
 * Kaster `ZipAvvist` når: en forespurt id ikke ble funnet (antall-avvik), lista er
 * tom, eller radene spenner mer enn ett prosjekt. Alt = «fremmed id» → avvis helt.
 */
export class ZipAvvist extends Error {}

export function utledProsjektForZip(rader: ZipTegningRad[], antallBedt: number): string {
  if (antallBedt === 0 || rader.length === 0) {
    throw new ZipAvvist("Ingen tegninger forespurt");
  }
  if (rader.length !== antallBedt) {
    throw new ZipAvvist("Minst én forespurt tegning finnes ikke");
  }
  const prosjekter = new Set(rader.map((r) => r.projectId));
  if (prosjekter.size !== 1) {
    throw new ZipAvvist("Tegningene hører til flere prosjekter");
  }
  return rader[0]!.projectId;
}

/** `?ider=a,b,c` → unik liste med ikke-tomme id-er (rekkefølge bevart). */
function lesIder(raa: string | undefined): string[] {
  if (!raa) return [];
  const sett = new Set<string>();
  for (const del of raa.split(",")) {
    const id = del.trim();
    if (id) sett.add(id);
  }
  return [...sett];
}

/** Content-Disposition med ASCII-fallback + UTF-8 (æøå i serienavn). */
function settZipHeader(reply: FastifyReply, zipNavn: string): void {
  const rent = zipNavn.replace(/[\s/\\:*?"<>|]/g, "_").trim() || "tegninger";
  const ascii = rent.replace(/[^\x20-\x7e]/g, "_");
  reply.raw.setHeader("Content-Type", "application/zip");
  reply.raw.setHeader(
    "Content-Disposition",
    `attachment; filename="${ascii}.zip"; filename*=UTF-8''${encodeURIComponent(rent)}.zip`,
  );
  reply.raw.setHeader("Cache-Control", "no-store");
}

export async function tegningNedlastingRoute(server: FastifyInstance) {
  server.get("/tegning/last-ned-zip", async (req, reply) => {
    // ── Autentisering (samme mønster som /upload) ──
    const cookieHeader = req.headers.cookie ?? "";
    const sessionTokenMatch = cookieHeader.match(
      /(?:__Secure-)?authjs\.session-token=([^;]+)/,
    );
    const sessionToken =
      sessionTokenMatch?.[1] ??
      req.headers.authorization?.replace("Bearer ", "") ??
      null;
    if (!sessionToken) {
      return reply.status(401).send({ error: "Autentisering kreves" });
    }
    const session = await prisma.session.findUnique({
      where: { sessionToken },
      select: { userId: true, expires: true },
    });
    if (!session || session.expires <= new Date()) {
      return reply.status(401).send({ error: "Autentisering kreves" });
    }
    const userId = session.userId;

    const ip = hentKlientIp(req);
    if (!sjekkRateLimit("tegning-zip", ip, 30, 60 * 1000)) {
      return reply.status(429).send({ error: "For mange nedlastinger. Prøv igjen senere." });
    }

    // ── Hva skal pakkes: serie ELLER valgte id-er (nøyaktig én kilde) ──
    const q = (req.query ?? {}) as { serieId?: string; ider?: string };
    const serieId = typeof q.serieId === "string" ? q.serieId.trim() : "";
    const ider = lesIder(q.ider);
    if ((serieId && ider.length > 0) || (!serieId && ider.length === 0)) {
      return reply
        .status(400)
        .send({ error: "Oppgi enten serieId eller ider (nøyaktig én)" });
    }

    const velg = {
      id: true,
      name: true,
      drawingNumber: true,
      revision: true,
      fileUrl: true,
      originalFileUrl: true,
      projectId: true,
    } as const;

    let rader: ZipTegningRad[];
    let zipNavn: string;

    try {
      if (serieId) {
        const serie = await prisma.tegningsserie.findUnique({
          where: { id: serieId },
          select: { id: true, name: true, projectId: true },
        });
        if (!serie) return reply.status(404).send({ error: "Serien finnes ikke" });
        await verifiserProsjektmedlem(userId, serie.projectId);
        // Hovedtegninger i serien (layout-rader har egen forelder, hører ikke med).
        rader = await prisma.drawing.findMany({
          where: { serieId: serie.id, projectId: serie.projectId, parentDrawingId: null },
          select: velg,
        });
        if (rader.length === 0) {
          return reply.status(404).send({ error: "Serien har ingen tegninger" });
        }
        zipNavn = serie.name;
      } else {
        rader = await prisma.drawing.findMany({ where: { id: { in: ider } }, select: velg });
        // Avvis HELE forespørselen hvis en id er fremmed/ukjent eller spenner prosjekter.
        const projectId = utledProsjektForZip(rader, ider.length);
        await verifiserProsjektmedlem(userId, projectId);
        zipNavn = "tegninger";
      }
    } catch (err) {
      if (err instanceof ZipAvvist) {
        return reply.status(403).send({ error: "Forespørselen ble avvist" });
      }
      // verifiserProsjektmedlem kaster TRPCError (FORBIDDEN) → 403.
      return reply.status(403).send({ error: "Ingen tilgang" });
    }

    // ── Bygg zip-oppføringer: originalfila (fallback fileUrl), unikt filnavn ──
    const brukteNavn = new Set<string>();
    const oppforinger: { disk: string; navn: string }[] = [];
    for (const rad of rader) {
      const kildeUrl = rad.originalFileUrl ?? rad.fileUrl;
      if (!kildeUrl) continue;
      const disk = diskSti(kildeUrl.split("?")[0] ?? kildeUrl);
      try {
        await stat(disk);
      } catch {
        continue; // registrert i DB men mangler på disk — hopp over, fell ikke
      }
      const ønsket = byggTegningNedlastingsnavn({
        tegningsnummer: rad.drawingNumber,
        navn: rad.name,
        revisjon: rad.revision,
        fileUrl: kildeUrl,
      });
      oppforinger.push({ disk, navn: unikNedlastingsnavn(ønsket, brukteNavn) });
    }

    if (oppforinger.length === 0) {
      return reply.status(404).send({ error: "Ingen av tegningsfilene finnes på lagringen" });
    }

    // ── Strøm zip-en ──
    settZipHeader(reply, zipNavn);
    reply.hijack();
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", () => reply.raw.destroy());
    archive.pipe(reply.raw);
    for (const o of oppforinger) archive.file(o.disk, { name: o.navn });
    await archive.finalize();
  });
}
