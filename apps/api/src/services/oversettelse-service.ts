/**
 * Oversettelsestjeneste — prosesserer FtdTranslationJob-køen.
 *
 * Poller for pending-jobber og oversetter norske blokker til målspråk
 * via oversettelse-server.py (OPUS-MT, port 3303).
 */
import { randomUUID, createHash } from "node:crypto";
import type { PrismaClient } from "@sitedoc/db";
import { embeddNyeBlokker } from "./embedding-service";

const OVERSETTELSE_URL = process.env.OVERSETTELSE_URL ?? "http://localhost:3303";
const BATCH_STØRRELSE = 30;
const POLL_INTERVALL = 10_000; // 10 sekunder

export type OversettelsesMotor = "opus-mt" | "google" | "deepl";

/**
 * Start bakgrunnsløkke som prosesserer oversettelsesoppdrag.
 */
export function startOversettelsesløkke(prisma: PrismaClient): void {
  console.log("Oversettelsesløkke startet");

  // Recovery: sett stuck "processing"-jobber tilbake til "pending"
  prisma.ftdTranslationJob.updateMany({
    where: { status: "processing" },
    data: { status: "pending", blocksDone: 0 },
  }).then((r) => {
    if (r.count > 0) console.log(`Oversettelse recovery: ${r.count} stuck jobber satt til pending`);
  }).catch(() => {});

  async function poll() {
    try {
      await prosesserNesteJobb(prisma);
    } catch (err) {
      console.error("Oversettelsesløkke feil:", err);
    }
    setTimeout(poll, POLL_INTERVALL);
  }

  // Watchdog: sjekk for stuck jobber hvert 5. minutt
  async function watchdog() {
    try {
      // Jobber som har vært "processing" i over 10 minutter er stuck
      const tiMinSiden = new Date(Date.now() - 10 * 60 * 1000);
      const stuck = await prisma.ftdTranslationJob.updateMany({
        where: {
          status: "processing",
          updatedAt: { lt: tiMinSiden },
        },
        data: { status: "pending", blocksDone: 0 },
      });
      if (stuck.count > 0) {
        console.log(`Watchdog: ${stuck.count} stuck oversettelsesoppdrag restartet`);
      }
    } catch (err) {
      console.error("Watchdog feil:", err);
    }
    setTimeout(watchdog, 5 * 60 * 1000);
  }

  // Start etter 5 sekunder (poll) og 60 sekunder (watchdog)
  setTimeout(poll, 5000);
  setTimeout(watchdog, 60_000);
}

/**
 * Finn og prosesser neste ventende jobb.
 */
async function prosesserNesteJobb(prisma: PrismaClient): Promise<void> {
  // Hent eldste pending-jobb
  const jobb = await prisma.ftdTranslationJob.findFirst({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
  });

  if (!jobb) return;

  // Hent prosjekt-ID og kildespråk fra dokumentet
  const dok = await prisma.ftdDocument.findUnique({
    where: { id: jobb.documentId },
    select: { projectId: true, sourceLanguage: true },
  });
  if (!dok) return;

  // Sjekk om oversettelsesmodulen er aktiv
  const modul = await prisma.projectModule.findUnique({
    where: { projectId_moduleSlug: { projectId: dok.projectId, moduleSlug: "oversettelse" } },
  });
  if (!modul?.active) {
    console.log(`Oversettelse hoppet over for ${jobb.documentId} — modulen er ikke aktiv`);
    await prisma.ftdTranslationJob.update({
      where: { id: jobb.id },
      data: { status: "failed", error: "Oversettelsesmodulen er ikke aktivert" },
    });
    return;
  }

  const config = (modul.config ?? {}) as { motor?: string; apiKey?: string };
  const motor = (config.motor ?? "opus-mt") as OversettelsesMotor;

  console.log(`Oversetter dokument ${jobb.documentId} til ${jobb.targetLang} (${motor})...`);

  try {
    // Sett status til processing
    await prisma.ftdTranslationJob.update({
      where: { id: jobb.id },
      data: { status: "processing" },
    });

    await oversettBlokker(prisma, jobb.id, jobb.documentId, jobb.targetLang, motor, config.apiKey, dok.sourceLanguage ?? "nb");

    await prisma.ftdTranslationJob.update({
      where: { id: jobb.id },
      data: { status: "done" },
    });

    console.log(`Oversettelse ferdig: ${jobb.documentId} → ${jobb.targetLang}`);

    // Generer embeddings for de oversatte blokkene (fire-and-forget)
    embeddNyeBlokker(prisma, jobb.documentId).catch((err) => {
      console.error(`Blokk-embedding feilet etter oversettelse:`, err);
    });
  } catch (err) {
    const melding = err instanceof Error ? err.message : "Ukjent feil";
    console.error(`Oversettelse feilet for ${jobb.documentId}→${jobb.targetLang}:`, melding);

    await prisma.ftdTranslationJob.update({
      where: { id: jobb.id },
      data: { status: "failed", error: melding },
    }).catch(() => {});
  }
}

/**
 * Oversett alle norske blokker i et dokument til målspråk.
 */
async function oversettBlokker(
  prisma: PrismaClient,
  jobbId: string,
  documentId: string,
  targetLang: string,
  motor: OversettelsesMotor = "opus-mt",
  apiKey?: string,
  sourceLanguage: string = "nb",
): Promise<void> {
  // Hent kildeblokker (på dokumentets kildespråk)
  const norskBlokker = await prisma.ftdDocumentBlock.findMany({
    where: { documentId, language: sourceLanguage },
    orderBy: { sortOrder: "asc" },
  });

  if (norskBlokker.length === 0) {
    throw new Error(`Ingen kildeblokker funnet (${sourceLanguage})`);
  }

  // Slett eksisterende oversettelser for dette språket
  await prisma.ftdDocumentBlock.deleteMany({
    where: { documentId, language: targetLang },
  });

  // Del blokker i to grupper: oversettbare (tekst) og kopierbare (bilder)
  const tekstBlokker = norskBlokker.filter((b) =>
    ["heading", "text", "caption"].includes(b.blockType) && b.content.trim(),
  );

  // Slå opp i translation cache
  const hashes = tekstBlokker.map((b) => hashTekst(b.content));
  const cachetreff = await prisma.translationCache.findMany({
    where: {
      contentHash: { in: hashes },
      sourceLang: sourceLanguage,
      targetLang,
    },
  });
  const cachemap = new Map(cachetreff.map((c) => [c.contentHash, c.targetText]));

  // Finn blokker som trenger oversettelse (ikke i cache)
  const uoversatte: Array<{ idx: number; tekst: string }> = [];
  for (let i = 0; i < tekstBlokker.length; i++) {
    if (!cachemap.has(hashes[i]!)) {
      uoversatte.push({ idx: i, tekst: tekstBlokker[i]!.content });
    }
  }

  const cacheHits = tekstBlokker.length - uoversatte.length;
  if (cacheHits > 0) {
    console.log(`Translation cache: ${cacheHits}/${tekstBlokker.length} treff for ${targetLang}`);
  }

  // Batch-oversett kun ukjente tekster
  const nyeOversettelser = new Map<number, string>();
  for (let i = 0; i < uoversatte.length; i += BATCH_STØRRELSE) {
    const batch = uoversatte.slice(i, i + BATCH_STØRRELSE);
    const tekster = batch.map((b) => b.tekst);

    const oversatt = await oversettMedMotor(tekster, sourceLanguage, targetLang, motor, apiKey);
    batch.forEach((b, j) => {
      nyeOversettelser.set(b.idx, oversatt[j]!);
    });

    // Oppdater fremdrift
    await prisma.ftdTranslationJob.update({
      where: { id: jobbId },
      data: {
        blocksDone: Math.min(cacheHits + i + BATCH_STØRRELSE, tekstBlokker.length),
        blocksTotal: tekstBlokker.length,
      },
    });
  }

  // Lagre nye oversettelser i cache
  if (nyeOversettelser.size > 0) {
    const cacheData = [...nyeOversettelser.entries()].map(([idx, oversatt]) => ({
      id: randomUUID(),
      contentHash: hashes[idx]!,
      sourceLang: sourceLanguage,
      targetLang,
      sourceText: tekstBlokker[idx]!.content,
      targetText: oversatt,
    }));
    await prisma.translationCache.createMany({
      data: cacheData,
      skipDuplicates: true,
    });
  }

  // Bygg komplett oversatt tekst-array
  const oversattTekster: string[] = tekstBlokker.map((_, i) => {
    const cached = cachemap.get(hashes[i]!);
    if (cached) return cached;
    return nyeOversettelser.get(i) ?? tekstBlokker[i]!.content;
  });

  // Bygg oversatte blokker
  const nyeBlokker = norskBlokker.map((blokk, _idx) => {
    if (blokk.blockType === "image") {
      // Bilder deles mellom språk — kopier med samme imageUrl
      return {
        id: randomUUID(),
        documentId,
        sortOrder: blokk.sortOrder,
        pageNumber: blokk.pageNumber,
        blockType: blokk.blockType,
        language: targetLang,
        content: "",
        sourceBlockId: blokk.id,
        headingLevel: null,
        imageUrl: blokk.imageUrl,
        embeddingState: "skipped" as const,
        embeddingModel: null,
      };
    }

    if (blokk.blockType === "table") {
      // Tabeller kopieres som-de-er (tall/data)
      return {
        id: randomUUID(),
        documentId,
        sortOrder: blokk.sortOrder,
        pageNumber: blokk.pageNumber,
        blockType: blokk.blockType,
        language: targetLang,
        content: blokk.content,
        sourceBlockId: blokk.id,
        headingLevel: null,
        imageUrl: null,
        embeddingState: "pending" as const,
        embeddingModel: null,
      };
    }

    // Tekst/heading/caption — bruk oversatt tekst
    const tekstIdx = tekstBlokker.indexOf(blokk);
    const oversattInnhold = tekstIdx >= 0 ? oversattTekster[tekstIdx] ?? blokk.content : blokk.content;

    return {
      id: randomUUID(),
      documentId,
      sortOrder: blokk.sortOrder,
      pageNumber: blokk.pageNumber,
      blockType: blokk.blockType,
      language: targetLang,
      content: oversattInnhold,
      sourceBlockId: blokk.id,
      headingLevel: blokk.headingLevel,
      imageUrl: null,
      embeddingState: "pending" as const,
      embeddingModel: null,
    };
  });

  // Lagre alle oversatte blokker
  await prisma.ftdDocumentBlock.createMany({ data: nyeBlokker });
}

/**
 * Velg oversettelsesmotor og oversett.
 */
export async function oversettMedMotor(
  tekster: string[],
  kilde: string,
  maal: string,
  motor: OversettelsesMotor,
  apiKey?: string,
): Promise<string[]> {
  switch (motor) {
    case "google":
      return kallGoogleTranslate(tekster, kilde, maal, apiKey!);
    case "deepl":
      return kallDeepL(tekster, kilde, maal, apiKey!);
    case "opus-mt":
    default:
      return kallOversettelsesServer(tekster, kilde, maal);
  }
}

/**
 * Google Translate via google-translate-api-x (ingen API-nøkkel).
 */
async function kallGoogleTranslate(
  tekster: string[],
  kilde: string,
  maal: string,
  _apiKey?: string,
): Promise<string[]> {
  const { default: translate } = await import("google-translate-api-x");
  const resultater: string[] = [];
  // Batch à 20 for å unngå rate-limiting
  for (let i = 0; i < tekster.length; i += 20) {
    const batch = tekster.slice(i, i + 20);
    try {
      const oversatt = await translate(batch, {
        from: kilde === "nb" ? "no" : kilde,
        to: maal,
      });
      const res = Array.isArray(oversatt) ? oversatt : [oversatt];
      resultater.push(...res.map((r) => r.text));
    } catch (err) {
      // Fallback: returner original
      console.error("Google Translate batch feilet:", err);
      resultater.push(...batch);
    }
    // Rate-limiting pause
    if (i + 20 < tekster.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return resultater;
}

/**
 * DeepL API.
 */
async function kallDeepL(
  tekster: string[],
  kilde: string,
  maal: string,
  apiKey: string,
): Promise<string[]> {
  const deepLKilde = kilde === "nb" ? "NB" : kilde.toUpperCase();
  const deepLMaal = maal === "en" ? "EN-GB" : maal.toUpperCase();

  const response = await fetch("https://api-free.deepl.com/v2/translate", {
    method: "POST",
    headers: {
      "Authorization": `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: tekster,
      source_lang: deepLKilde,
      target_lang: deepLMaal,
    }),
  });
  if (!response.ok) {
    const feil = await response.text().catch(() => "");
    throw new Error(`DeepL feil (${response.status}): ${feil.slice(0, 200)}`);
  }
  const data = (await response.json()) as {
    translations: Array<{ text: string }>;
  };
  return data.translations.map((t) => t.text);
}

/**
 * Kall oversettelsesserveren (OPUS-MT).
 */
async function kallOversettelsesServer(
  tekster: string[],
  kilde: string,
  maal: string,
): Promise<string[]> {
  const response = await fetch(`${OVERSETTELSE_URL}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts: tekster, source: kilde, target: maal }),
  });

  if (!response.ok) {
    const feil = await response.text().catch(() => "Ukjent feil");
    throw new Error(`Oversettelsesserver feil (${response.status}): ${feil}`);
  }

  const data = await response.json() as { translations: string[] };
  return data.translations;
}

/**
 * SHA-256 hash av tekst for translation cache.
 */
export function hashTekst(tekst: string): string {
  return createHash("sha256").update(tekst).digest("hex");
}

/**
 * Sammenlign oversettelse fra alle tilgjengelige motorer.
 * Returnerer resultat per motor (OPUS-MT alltid, Google/DeepL kun med API-nøkkel).
 */
export async function sammenlignMotorer(
  tekst: string,
  targetLang: string,
  apiKey?: string,
  sourceLang: string = "nb",
): Promise<Array<{ motor: string; navn: string; resultat: string | null; feil: string | null }>> {
  const resultater: Array<{ motor: string; navn: string; resultat: string | null; feil: string | null }> = [];

  // OPUS-MT (alltid tilgjengelig)
  try {
    const [oversatt] = await kallOversettelsesServer([tekst], sourceLang, targetLang);
    resultater.push({ motor: "opus-mt", navn: "OPUS-MT (gratis)", resultat: oversatt ?? null, feil: null });
  } catch (err) {
    resultater.push({ motor: "opus-mt", navn: "OPUS-MT (gratis)", resultat: null, feil: err instanceof Error ? err.message : "Feil" });
  }

  // Google Translate (alltid tilgjengelig, ingen API-nøkkel)
  try {
    const [oversatt] = await kallGoogleTranslate([tekst], sourceLang, targetLang);
    resultater.push({ motor: "google", navn: "Google Translate", resultat: oversatt ?? null, feil: null });
  } catch (err) {
    resultater.push({ motor: "google", navn: "Google Translate", resultat: null, feil: err instanceof Error ? err.message : "Feil" });
  }

  // DeepL (kun med API-nøkkel)
  if (apiKey) {
    try {
      const [oversatt] = await kallDeepL([tekst], sourceLang, targetLang, apiKey);
      resultater.push({ motor: "deepl", navn: "DeepL", resultat: oversatt ?? null, feil: null });
    } catch (err) {
      resultater.push({ motor: "deepl", navn: "DeepL", resultat: null, feil: err instanceof Error ? err.message : "Feil" });
    }
  }

  return resultater;
}
