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

  // Start etter 5 sekunder
  setTimeout(poll, 5000);
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

  console.log(`Oversetter dokument ${jobb.documentId} til ${jobb.targetLang}...`);

  try {
    // Sett status til processing
    await prisma.ftdTranslationJob.update({
      where: { id: jobb.id },
      data: { status: "processing" },
    });

    await oversettBlokker(prisma, jobb.id, jobb.documentId, jobb.targetLang);

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
): Promise<void> {
  // Hent norske blokker
  const norskBlokker = await prisma.ftdDocumentBlock.findMany({
    where: { documentId, language: "nb" },
    orderBy: { sortOrder: "asc" },
  });

  if (norskBlokker.length === 0) {
    throw new Error("Ingen norske blokker funnet");
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
      sourceLang: "nb",
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

    const oversatt = await kallOversettelsesServer(tekster, "nb", targetLang);
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
      sourceLang: "nb",
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
function hashTekst(tekst: string): string {
  return createHash("sha256").update(tekst).digest("hex");
}
