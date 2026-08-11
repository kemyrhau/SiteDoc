/**
 * Eksport-worker — bygger dataeksport-arkiver asynkront (fase 1, 2026-08-11).
 *
 * Mønster: setTimeout-poll-løkke (kanon per arkitektur-syntese § 6.2), speiler
 * vegvesen-worker. Én jobb om gangen (zip er IO/CPU-tung og deler prosess med
 * api-requestene i single-prosess-api — parallell pakking ville sultet requestene).
 *
 * Livssyklus: bestilt → bygger → klar (signert URL kan hentes) / feilet.
 * klar-arkiver ryddes til «utløpt» + fil slettet etter LEVETID_DAGER (fabels
 * «levetid f.eks. 7 dager, så ryddes det»).
 *
 * Arkivet skrives til uploads/privat/eksport/ så den eksisterende signatur-gaten
 * i server.ts (/uploads/privat/*) beskytter det uten ny tilgangslogikk.
 */
import { createWriteStream } from "fs";
import { mkdir, stat as fsStat, unlink } from "fs/promises";
import { join } from "path";
import archiver from "archiver";
import type { PrismaClient } from "@sitedoc/db";
import { byggEksportArkiv } from "./arkiv";

const POLL_INTERVALL_MS = 10_000; // 10 sek — brukertrigget, vil ha rask respons
const WATCHDOG_INTERVALL_MS = 5 * 60_000; // 5 min
const STUCK_TERSKEL_MS = 30 * 60_000; // 30 min — pakking kan ta tid
const LEVETID_DAGER = 7;

const UPLOADS_DIR = process.env.UPLOADS_DIR || join(process.cwd(), "uploads");
const EKSPORT_DIR = join(UPLOADS_DIR, "privat", "eksport");

/** URL-sti (ikke disk) — lagres på jobben og signeres ved nedlasting. */
function arkivUrlSti(jobbId: string): string {
  return `/uploads/privat/eksport/${jobbId}.zip`;
}
/** Disk-sti utledet fra URL-sti (samme reversering som resten av kodebasen). */
function diskSti(urlSti: string): string {
  return join(UPLOADS_DIR, urlSti.replace(/^\/uploads\//, ""));
}

export function startEksportWorker(prisma: PrismaClient): void {
  console.log("Eksport-worker startet");

  // Recovery: stuck "bygger" → "bestilt" (arkivet ble aldri fullført).
  prisma.eksportJobb
    .updateMany({ where: { status: "bygger" }, data: { status: "bestilt" } })
    .then((r) => {
      if (r.count > 0) console.log(`Eksport recovery: ${r.count} stuck jobber satt til bestilt`);
    })
    .catch(() => {});

  async function poll() {
    try {
      await prosesserNeste(prisma);
    } catch (err) {
      console.error("[Eksport-worker] poll-feil:", err);
    }
    setTimeout(poll, POLL_INTERVALL_MS);
  }

  async function watchdog() {
    try {
      // Stuck bygger-jobber tilbake til bestilt.
      const stuck = await prisma.eksportJobb.updateMany({
        where: { status: "bygger", startetVed: { lt: new Date(Date.now() - STUCK_TERSKEL_MS) } },
        data: { status: "bestilt" },
      });
      if (stuck.count > 0) console.log(`[Eksport-watchdog] ${stuck.count} stuck jobber restartet`);

      // Utløpsrydding: slett arkivfil + marker utløpt.
      const utlopte = await prisma.eksportJobb.findMany({
        where: { status: "klar", utloperVed: { lt: new Date() } },
        select: { id: true, resultatSti: true },
      });
      for (const j of utlopte) {
        if (j.resultatSti) await unlink(diskSti(j.resultatSti)).catch(() => {});
        await prisma.eksportJobb.update({
          where: { id: j.id },
          data: { status: "utløpt", resultatSti: null },
        });
      }
      if (utlopte.length > 0) console.log(`[Eksport-watchdog] ${utlopte.length} arkiver utløpt + slettet`);
    } catch (err) {
      console.error("[Eksport-watchdog] feil:", err);
    }
    setTimeout(watchdog, WATCHDOG_INTERVALL_MS);
  }

  setTimeout(poll, 5_000);
  setTimeout(watchdog, 60_000);
}

async function prosesserNeste(prisma: PrismaClient): Promise<void> {
  // Plukk eldste bestilte jobb og marker bygger atomisk (unngå dobbelt-plukk).
  const jobb = await prisma.eksportJobb.findFirst({
    where: { status: "bestilt" },
    orderBy: { createdAt: "asc" },
  });
  if (!jobb) return;

  const oppdatert = await prisma.eksportJobb.updateMany({
    where: { id: jobb.id, status: "bestilt" },
    data: { status: "bygger", startetVed: new Date() },
  });
  if (oppdatert.count === 0) return; // en annen iterasjon tok den

  try {
    // Fase 1: kun prosjekt_eksport bygges. firma_eksport/dokument kommer senere.
    if (jobb.type !== "prosjekt_eksport") {
      throw new Error(`Jobbtype «${jobb.type}» er ikke støttet ennå (fase 1 = prosjekt_eksport)`);
    }

    await mkdir(EKSPORT_DIR, { recursive: true });
    const urlSti = arkivUrlSti(jobb.id);
    const filsti = diskSti(urlSti);

    const output = createWriteStream(filsti);
    const archive = archiver("zip", { zlib: { level: 9 } });
    const skriveferdig = new Promise<void>((resolve, reject) => {
      output.on("close", () => resolve());
      output.on("error", reject);
      archive.on("error", reject);
      archive.on("warning", (err) => {
        if ((err as { code?: string }).code === "ENOENT") return;
        reject(err);
      });
    });

    archive.pipe(output);
    const statistikk = await byggEksportArkiv(prisma, jobb, archive);
    await archive.finalize();
    await skriveferdig;

    const { size } = await fsStat(filsti);

    await prisma.eksportJobb.update({
      where: { id: jobb.id },
      data: {
        status: "klar",
        resultatSti: urlSti,
        resultatStorrelse: size,
        antallTotalt: statistikk.antallDokumenter + statistikk.antallFiler,
        antallFerdig: statistikk.antallDokumenter + statistikk.antallFiler,
        utloperVed: new Date(Date.now() + LEVETID_DAGER * 24 * 60 * 60 * 1000),
        fullfortVed: new Date(),
        feilmelding: null,
      },
    });
    console.log(`[Eksport-worker] jobb ${jobb.id} klar (${size} bytes)`);
  } catch (err) {
    const feilmelding = err instanceof Error ? err.message : "Ukjent feil";
    console.error(`[Eksport-worker] jobb ${jobb.id} feilet:`, feilmelding);
    // Rydd et evt. halvskrevet arkiv.
    await unlink(diskSti(arkivUrlSti(jobb.id))).catch(() => {});
    await prisma.eksportJobb.update({
      where: { id: jobb.id },
      data: { status: "feilet", feilmelding: feilmelding.slice(0, 500) },
    });
  }
}
