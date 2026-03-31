/**
 * Embedding-service for AI-søk.
 * Genererer embeddings for FtdDocumentChunk via OpenAI text-embedding-3-small.
 * Portert fra Fil til database-kopi: src/backends/embedding.py + src/services/embedding_service.py
 */
import { PrismaClient, Prisma } from "@sitedoc/db";

// ---- Typer ----

export interface EmbeddingInnstillinger {
  provider: "openai";
  apiKey: string;
  model: string; // "text-embedding-3-small"
  batchSize: number;
}

export interface EmbeddingStatus {
  totalt: number;
  ferdig: number;
  ventende: number;
  prosesserer: boolean;
}

// ---- Tilstand ----

let _prosesserer = false;
let _stoppSignal = false;

// ---- OpenAI embedding ----

async function genererEmbeddings(
  tekster: string[],
  innstillinger: EmbeddingInnstillinger,
): Promise<number[][]> {
  // Dynamisk import for å unngå avhengighet hvis ikke brukt
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: innstillinger.apiKey });

  // OpenAI maks 8191 tokens per tekst — trunker til ~12000 tegn
  const MAX_CHARS = 12000;
  const trunkert = tekster.map((t) =>
    t.length > MAX_CHARS ? t.slice(0, MAX_CHARS) : t,
  );

  const response = await client.embeddings.create({
    input: trunkert,
    model: innstillinger.model,
  });

  return response.data.map((d) => d.embedding);
}

// ---- Recovery (fra embedding_service.py recover_stuck_processing) ----

export async function recoveryStuckProcessing(
  prisma: PrismaClient,
  projectId: string,
): Promise<number> {
  const result = await prisma.$executeRaw`
    UPDATE ftd_document_chunks
    SET embedding_state = 'pending'
    WHERE embedding_state = 'processing'
      AND document_id IN (
        SELECT id FROM ftd_documents WHERE project_id = ${projectId}
      )
  `;
  return result;
}

// ---- Hovedprosess ----

export async function startEmbeddingGenerering(
  prisma: PrismaClient,
  projectId: string,
  innstillinger: EmbeddingInnstillinger,
  onFremdrift?: (ferdig: number, totalt: number) => void,
): Promise<{ generert: number; feilet: number }> {
  if (_prosesserer) {
    throw new Error("Embedding-generering kjører allerede");
  }

  _prosesserer = true;
  _stoppSignal = false;
  let generert = 0;
  let feilet = 0;

  try {
    // Recovery: sett stuck 'processing' tilbake til 'pending'
    const recovered = await recoveryStuckProcessing(prisma, projectId);
    if (recovered > 0) {
      console.log(
        `[EMBEDDING] Recovery: ${recovered} rader satt tilbake til 'pending'`,
      );
    }

    // Tell totalt antall pending
    const totalt = await prisma.ftdDocumentChunk.count({
      where: {
        document: { projectId },
        embeddingState: "pending",
      },
    });

    if (totalt === 0) {
      console.log("[EMBEDDING] Ingen ventende chunks å prosessere");
      return { generert: 0, feilet: 0 };
    }

    console.log(`[EMBEDDING] Starter generering av ${totalt} chunks`);

    while (!_stoppSignal) {
      // Hent neste batch
      const chunks = await prisma.ftdDocumentChunk.findMany({
        where: {
          document: { projectId },
          embeddingState: "pending",
        },
        select: { id: true, chunkText: true },
        take: innstillinger.batchSize,
      });

      if (chunks.length === 0) break;

      // Marker som 'processing'
      const ider = chunks.map((c) => c.id);
      await prisma.ftdDocumentChunk.updateMany({
        where: { id: { in: ider } },
        data: { embeddingState: "processing" },
      });

      try {
        const tekster = chunks.map((c) => c.chunkText);
        const embeddings = await genererEmbeddings(tekster, innstillinger);

        // Lagre embeddings via rå SQL (Prisma støtter ikke vector-typen)
        for (let i = 0; i < chunks.length; i++) {
          const emb = embeddings[i]!;
          const chunk = chunks[i]!;
          const vecStr = `[${emb.join(",")}]`;
          await prisma.$executeRaw`
            UPDATE ftd_document_chunks
            SET embedding_vector = ${vecStr}::vector,
                embedding_state = 'done'
            WHERE id = ${chunk.id}
          `;
        }

        generert += chunks.length;
      } catch (err) {
        console.error("[EMBEDDING] Batch feilet:", err);
        // Sett tilbake til pending
        await prisma.ftdDocumentChunk.updateMany({
          where: { id: { in: ider } },
          data: { embeddingState: "pending" },
        });
        feilet += chunks.length;

        // Vent litt før retry
        await new Promise((r) => setTimeout(r, 2000));
      }

      onFremdrift?.(generert, totalt);
      console.log(`[EMBEDDING] Fremdrift: ${generert}/${totalt}`);
    }
  } finally {
    _prosesserer = false;
    _stoppSignal = false;
  }

  console.log(
    `[EMBEDDING] Ferdig: ${generert} generert, ${feilet} feilet`,
  );
  return { generert, feilet };
}

export function stoppEmbeddingGenerering(): void {
  _stoppSignal = true;
}

export function erEmbeddingAktiv(): boolean {
  return _prosesserer;
}

export async function hentEmbeddingStatus(
  prisma: PrismaClient,
  projectId: string,
): Promise<EmbeddingStatus> {
  const [totalt, ferdig, ventende] = await Promise.all([
    prisma.ftdDocumentChunk.count({
      where: { document: { projectId } },
    }),
    prisma.ftdDocumentChunk.count({
      where: { document: { projectId }, embeddingState: "done" },
    }),
    prisma.ftdDocumentChunk.count({
      where: { document: { projectId }, embeddingState: "pending" },
    }),
  ]);

  return {
    totalt,
    ferdig,
    ventende,
    prosesserer: _prosesserer,
  };
}
