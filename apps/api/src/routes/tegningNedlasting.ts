import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
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
 *
 * 🔴 Path traversal: disksti-oppslaget går gjennom herdet `diskSti` (kaster utenfor
 * uploads-roten). En avvist sti gir 400 FØR strømmen starter — aldri en zip der fila
 * stille mangler (Kontrollør-RETUR 2026-10-10).
 *
 * Grenser: maks 200 tegninger, maks 2 GB samlet (413). HEAD-preflight gir samme
 * svar uten å strømme, så web kan vise en melding før nedlastingen starter.
 */

export const MAKS_TEGNINGER = 200;
export const MAKS_SUM_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

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

export type GrenseResultat =
  | { ok: true }
  | { ok: false; grunn: "antall" | "storrelse" };

/** Ren grense-vurdering (antall + samlet størrelse). Testbar uten IO. */
export function vurderZipGrenser(antallTegninger: number, sumBytes: number): GrenseResultat {
  if (antallTegninger > MAKS_TEGNINGER) return { ok: false, grunn: "antall" };
  if (sumBytes > MAKS_SUM_BYTES) return { ok: false, grunn: "storrelse" };
  return { ok: true };
}

export interface ZipOppforing {
  disk: string;
  navn: string;
}

/**
 * Bygg zip-oppføringene: originalfila (fallback `fileUrl`), unikt filnavn, samlet
 * størrelse. `diskSti` KASTER på path traversal — det bobler ut (ruten → 400).
 * En fil som bare mangler på disk (`statFn` avviser) hoppes over, feller ikke.
 * `statFn` injiseres så funksjonen kan enhets-testes uten ekte filer.
 */
export async function byggOppforinger(
  rader: ZipTegningRad[],
  statFn: (disk: string) => Promise<{ size: number }>,
): Promise<{ oppforinger: ZipOppforing[]; sumBytes: number }> {
  const brukteNavn = new Set<string>();
  const oppforinger: ZipOppforing[] = [];
  let sumBytes = 0;
  for (const rad of rader) {
    const kildeUrl = rad.originalFileUrl ?? rad.fileUrl;
    if (!kildeUrl) continue;
    const disk = diskSti(kildeUrl); // kaster ved traversal → 400 i ruten
    let storrelse: number;
    try {
      storrelse = (await statFn(disk)).size;
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
    sumBytes += storrelse;
  }
  return { oppforinger, sumBytes };
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

/** Hva som skal strømmes — eller en feilstatus (4xx) å svare med FØR strøm. */
type Forberedt =
  | { feil: number; grunn?: "antall" | "storrelse"; melding: string }
  | { ok: true; oppforinger: ZipOppforing[]; zipNavn: string };

async function forberedZip(req: FastifyRequest): Promise<Forberedt> {
  // ── Autentisering (samme mønster som /upload) ──
  const cookieHeader = req.headers.cookie ?? "";
  const sessionTokenMatch = cookieHeader.match(/(?:__Secure-)?authjs\.session-token=([^;]+)/);
  const sessionToken =
    sessionTokenMatch?.[1] ?? req.headers.authorization?.replace("Bearer ", "") ?? null;
  if (!sessionToken) return { feil: 401, melding: "Autentisering kreves" };
  const session = await prisma.session.findUnique({
    where: { sessionToken },
    select: { userId: true, expires: true },
  });
  if (!session || session.expires <= new Date()) {
    return { feil: 401, melding: "Autentisering kreves" };
  }
  const userId = session.userId;

  // ── Hva skal pakkes: serie ELLER valgte id-er (nøyaktig én kilde) ──
  const q = (req.query ?? {}) as { serieId?: string; ider?: string };
  const serieId = typeof q.serieId === "string" ? q.serieId.trim() : "";
  const ider = lesIder(q.ider);
  if ((serieId && ider.length > 0) || (!serieId && ider.length === 0)) {
    return { feil: 400, melding: "Oppgi enten serieId eller ider (nøyaktig én)" };
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
      if (!serie) return { feil: 404, melding: "Serien finnes ikke" };
      await verifiserProsjektmedlem(userId, serie.projectId);
      // Hovedtegninger i serien (layout-rader har egen forelder, hører ikke med).
      rader = await prisma.drawing.findMany({
        where: { serieId: serie.id, projectId: serie.projectId, parentDrawingId: null },
        select: velg,
      });
      if (rader.length === 0) return { feil: 404, melding: "Serien har ingen tegninger" };
      zipNavn = serie.name;
    } else {
      rader = await prisma.drawing.findMany({ where: { id: { in: ider } }, select: velg });
      const projectId = utledProsjektForZip(rader, ider.length);
      await verifiserProsjektmedlem(userId, projectId);
      zipNavn = "tegninger";
    }
  } catch (err) {
    if (err instanceof ZipAvvist) return { feil: 403, melding: "Forespørselen ble avvist" };
    return { feil: 403, melding: "Ingen tilgang" }; // verifiserProsjektmedlem → FORBIDDEN
  }

  // ── Antallsgrense FØR vi statter alle filene (billig vakt) ──
  if (rader.length > MAKS_TEGNINGER) {
    return { feil: 413, grunn: "antall", melding: `Maks ${MAKS_TEGNINGER} tegninger per nedlasting` };
  }

  // ── Bygg oppføringer (diskSti herdet → 400 ved traversal) + summer størrelse ──
  let bygget: { oppforinger: ZipOppforing[]; sumBytes: number };
  try {
    bygget = await byggOppforinger(rader, (disk) => stat(disk));
  } catch {
    return { feil: 400, melding: "Ugyldig fil-sti i forespørselen" };
  }
  if (bygget.oppforinger.length === 0) {
    return { feil: 404, melding: "Ingen av tegningsfilene finnes på lagringen" };
  }

  const grense = vurderZipGrenser(bygget.oppforinger.length, bygget.sumBytes);
  if (!grense.ok) {
    return { feil: 413, grunn: grense.grunn, melding: "Samlet størrelse over grensen (maks 2 GB)" };
  }

  return { ok: true, oppforinger: bygget.oppforinger, zipNavn };
}

export async function tegningNedlastingRoute(server: FastifyInstance) {
  // GET strømmer zip-en; HEAD kjører samme vakter uten kropp (web-preflight for melding).
  server.route({
    method: ["GET", "HEAD"],
    url: "/tegning/last-ned-zip",
    handler: async (req, reply) => {
      const ip = hentKlientIp(req);
      if (!sjekkRateLimit("tegning-zip", ip, 30, 60 * 1000)) {
        return reply.status(429).send({ error: "For mange nedlastinger. Prøv igjen senere." });
      }

      const resultat = await forberedZip(req);

      if ("feil" in resultat) {
        if (resultat.grunn) reply.header("x-zip-grense", resultat.grunn);
        return reply.status(resultat.feil).send({ error: resultat.melding });
      }

      // HEAD: vaktene passerte — svar 200 uten kropp (ingen strøm).
      if (req.method === "HEAD") return reply.status(200).send();

      // ── Strøm zip-en ──
      settZipHeader(reply, resultat.zipNavn);
      reply.hijack();
      const archive = archiver("zip", { zlib: { level: 9 } });
      archive.on("error", () => reply.raw.destroy());
      archive.pipe(reply.raw);
      for (const o of resultat.oppforinger) archive.file(o.disk, { name: o.navn });
      await archive.finalize();
    },
  });
}
