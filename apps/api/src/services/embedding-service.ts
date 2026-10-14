/**
 * Embedding-service for AI-søk.
 * Støtter NorBERT (lokal via Python, 768 dim) og OpenAI (sky, 1536 dim).
 * NorBERT kjøres via Python-subprosess med torch+transformers (~/norbert-env).
 * Portert fra Fil til database-kopi: src/backends/embedding.py + src/services/embedding_service.py
 */
import { PrismaClient } from "@sitedoc/db";
import { appendFileSync } from "fs";
import { join } from "path";

const LOG_FILE = join(process.cwd(), "embedding.log");

function logg(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  try { appendFileSync(LOG_FILE, line + "\n"); } catch (_e) { /* */ }
  process.stdout.write(line + "\n");
}

// ---- Typer ----

export interface EmbeddingInnstillinger {
  provider: "local" | "openai";
  model: string; // "norbert2" | "text-embedding-3-small"
  apiKey?: string; // Kun for OpenAI
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

// ---- NorBERT via HTTP-server (persistent Python-prosess på port 3302) ----

const NORBERT_URL = process.env.NORBERT_URL ?? "http://127.0.0.1:3302";

async function kallNorBERT(tekster: string[]): Promise<number[][]> {
  const response = await fetch(`${NORBERT_URL}/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tekster),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`NorBERT-server feilet (${response.status}): ${body.slice(0, 200)}`);
  }

  return (await response.json()) as number[][];
}

// ---- Multilingual E5 via HTTP-server (port 3302, /embed/model) ----

async function kallMultilingualE5(
  tekster: string[],
  type: "passage" | "query" = "passage",
): Promise<number[][]> {
  const model = type === "query" ? "multilingual-e5-query" : "multilingual-e5-base";
  const response = await fetch(`${NORBERT_URL}/embed/model`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, texts: tekster }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`E5-embedding feilet (${response.status}): ${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as { embeddings: number[][] };
  return data.embeddings;
}

// ---- Blokk-embedding (bruker multilingual E5 for alle språk) ----

export async function embeddNyeBlokker(
  prisma: PrismaClient,
  documentId: string,
): Promise<number> {
  const blokker = await prisma.ftdDocumentBlock.findMany({
    where: {
      documentId,
      embeddingState: "pending",
      blockType: { in: ["heading", "text", "caption"] },
    },
    select: { id: true, content: true },
  });

  if (blokker.length === 0) return 0;

  const BATCH = 16;
  let generert = 0;

  for (let i = 0; i < blokker.length; i += BATCH) {
    const batch = blokker.slice(i, i + BATCH);
    const tekster = batch.map((b) => b.content);

    try {
      const embeddings = await kallMultilingualE5(tekster, "passage");

      for (let j = 0; j < batch.length; j++) {
        const vektor = embeddings[j];
        if (!vektor) continue;
        const vektorStr = `[${vektor.join(",")}]`;
        await prisma.$executeRawUnsafe(
          `UPDATE ftd_document_blocks SET embedding_vector = $1::vector, embedding_state = 'done', embedding_model = 'multilingual-e5-base' WHERE id = $2`,
          vektorStr,
          batch[j]!.id,
        );
        generert++;
      }
    } catch (err) {
      logg(`Blokk-embedding batch ${i} feilet: ${err}`);
      // Marker som feilet
      for (const b of batch) {
        await prisma.ftdDocumentBlock.update({
          where: { id: b.id },
          data: { embeddingState: "failed" },
        }).catch(() => {});
      }
    }
  }

  logg(`Blokk-embedding: ${generert}/${blokker.length} for dokument ${documentId}`);
  return generert;
}

// ---- OpenAI embedding ----

async function genererOpenAIEmbeddings(
  tekster: string[],
  apiKey: string,
  model: string,
): Promise<number[][]> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey });

  const MAX_CHARS = 12000;
  const trunkert = tekster.map((t) =>
    t.length > MAX_CHARS ? t.slice(0, MAX_CHARS) : t,
  );

  const response = await client.embeddings.create({
    input: trunkert,
    model,
  });

  return response.data.map((d) => d.embedding);
}

// ---- Felles embedding-funksjon ----

async function genererEmbeddings(
  tekster: string[],
  innstillinger: EmbeddingInnstillinger,
): Promise<number[][]> {
  if (innstillinger.provider === "local") {
    return kallNorBERT(tekster);
  } else {
    if (!innstillinger.apiKey) {
      throw new Error("OpenAI API-nøkkel mangler");
    }
    return genererOpenAIEmbeddings(
      tekster,
      innstillinger.apiKey,
      innstillinger.model,
    );
  }
}

// ---- Per-dokument embedding (automatisk etter prosessering + ved reprosessering) ----

/**
 * Resolver prosjektets embedding-innstillinger fra ai_sok_innstillinger.
 * Defaulter til lokal NorBERT (768 dim) — samme som den manuelle løkka.
 */
export async function hentEmbeddingInnstillinger(
  prisma: PrismaClient,
  projectId: string,
): Promise<EmbeddingInnstillinger> {
  const rows = await prisma.$queryRaw<
    Array<{ provider: string | null; apiKey: string | null; model: string | null }>
  >`
    SELECT embedding_provider AS "provider",
           embedding_api_key AS "apiKey",
           embedding_model AS "model"
    FROM ai_sok_innstillinger
    WHERE project_id = ${projectId}
    LIMIT 1
  `;
  const rad = rows[0];
  const provider = (rad?.provider ?? "local") as "local" | "openai";
  return {
    provider,
    model: rad?.model ?? "norbert2",
    apiKey: rad?.apiKey ?? undefined,
    batchSize: provider === "local" ? 8 : 64,
  };
}

/**
 * Embed `pending`/`failed` chunks for ETT dokument via samme HTTP-vei som den manuelle
 * løkka (`genererEmbeddings` → `kallNorBERT`/OpenAI). Erstatter den gamle Python-subprosessen
 * i ftd-prosessering.ts, som i Docker-containerne aldri fant fila og stille hoppet over —
 * chunkene ble stående `pending` for alltid (prod 2026-10-14).
 *
 * Feiler embedding-serveren, settes de berørte chunkene til `embeddingState='failed'` (synlig
 * i fillista), IKKE stille tilbake til `pending`. Returnerer antall done/failed.
 */
export async function embeddDokumentChunks(
  prisma: PrismaClient,
  documentId: string,
): Promise<{ done: number; failed: number }> {
  const dok = await prisma.ftdDocument.findUnique({
    where: { id: documentId },
    select: { projectId: true },
  });
  if (!dok) return { done: 0, failed: 0 };

  const innstillinger = await hentEmbeddingInnstillinger(prisma, dok.projectId);

  const chunks = await prisma.ftdDocumentChunk.findMany({
    where: { documentId, embeddingState: { in: ["pending", "failed"] } },
    select: { id: true, chunkText: true },
  });
  if (chunks.length === 0) return { done: 0, failed: 0 };

  const BATCH =
    innstillinger.provider === "local"
      ? Math.min(innstillinger.batchSize, 16)
      : innstillinger.batchSize;

  let done = 0;
  let failed = 0;

  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const ider = batch.map((c) => c.id);
    await prisma.ftdDocumentChunk.updateMany({
      where: { id: { in: ider } },
      data: { embeddingState: "processing" },
    });

    try {
      const embeddings = await genererEmbeddings(
        batch.map((c) => c.chunkText),
        innstillinger,
      );
      for (let j = 0; j < batch.length; j++) {
        const emb = embeddings[j];
        if (!emb) {
          await prisma.ftdDocumentChunk
            .update({ where: { id: batch[j]!.id }, data: { embeddingState: "failed" } })
            .catch(() => {});
          failed++;
          continue;
        }
        const vecStr = `[${emb.join(",")}]`;
        await prisma.$executeRaw`
          UPDATE ftd_document_chunks
          SET embedding_vector = ${vecStr}::vector,
              embedding_state = 'done'
          WHERE id = ${batch[j]!.id}
        `;
        done++;
      }
    } catch (err) {
      logg(`[EMBEDDING] Per-dok batch feilet (${documentId}): ${(err as Error)?.message ?? err}`);
      // Synlig feilstatus — ikke stille 'pending'
      await prisma.ftdDocumentChunk.updateMany({
        where: { id: { in: ider } },
        data: { embeddingState: "failed" },
      });
      failed += batch.length;
    }
  }

  logg(`[EMBEDDING] Dokument ${documentId}: ${done} done, ${failed} failed`);
  return { done, failed };
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
      logg(
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
      logg("[EMBEDDING] Ingen ventende chunks å prosessere");
      return { generert: 0, feilet: 0 };
    }

    logg(
      `[EMBEDDING] Starter generering av ${totalt} chunks med ${innstillinger.provider}/${innstillinger.model}`,
    );

    while (!_stoppSignal) {
      const batchSize =
        innstillinger.provider === "local"
          ? Math.min(innstillinger.batchSize, 16)
          : innstillinger.batchSize;

      const chunks = await prisma.ftdDocumentChunk.findMany({
        where: {
          document: { projectId },
          embeddingState: "pending",
        },
        select: { id: true, chunkText: true },
        take: batchSize,
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
        logg(`[EMBEDDING] Batch feilet: ${(err as Error)?.message ?? err}`);
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
      logg(`[EMBEDDING] Fremdrift: ${generert}/${totalt}`);
    }
  } finally {
    _prosesserer = false;
    _stoppSignal = false;
  }

  logg(
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
