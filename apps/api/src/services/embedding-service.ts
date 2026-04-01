/**
 * Embedding-service for AI-søk.
 * Støtter NorBERT (lokal via Python, 768 dim) og OpenAI (sky, 1536 dim).
 * NorBERT kjøres via Python-subprosess med torch+transformers (~/norbert-env).
 * Portert fra Fil til database-kopi: src/backends/embedding.py + src/services/embedding_service.py
 */
import { PrismaClient } from "@sitedoc/db";
import { execFile } from "child_process";
import { promisify } from "util";
import { join } from "path";

const execFileAsync = promisify(execFile);

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

// ---- NorBERT via Python-subprosess ----

const PYTHON_PATH =
  process.env.NORBERT_PYTHON ?? join(process.env.HOME ?? "", "norbert-env", "bin", "python3");
const SCRIPT_PATH = join(process.cwd(), "src", "services", "norbert-embed.py");

async function genererNorBERTEmbeddings(
  tekster: string[],
): Promise<number[][]> {
  const input = JSON.stringify(tekster);
  const { stdout, stderr } = await execFileAsync(
    PYTHON_PATH,
    [SCRIPT_PATH],
    {
      encoding: "utf-8",
      maxBuffer: 50 * 1024 * 1024, // 50 MB
      timeout: 120_000, // 2 min per batch
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    },
  );

  if (stderr) {
    // Filtrer HuggingFace-advarsler (ikke feil)
    const feil = stderr
      .split("\n")
      .filter((l) => !l.includes("Warning:") && !l.includes("Loading weights") && !l.includes("LOAD REPORT") && !l.includes("UNEXPECTED") && !l.includes("Notes:") && !l.includes("---") && !l.includes("Key") && l.trim())
      .join("\n");
    if (feil) console.warn("[NORBERT]", feil);
  }

  // Skriv input til stdin via en ny prosess
  return JSON.parse(stdout) as number[][];
}

// Wrapper som sender stdin
async function kallNorBERT(tekster: string[]): Promise<number[][]> {
  return new Promise((resolve, reject) => {
    const proc = execFile(
      PYTHON_PATH,
      [SCRIPT_PATH],
      {
        encoding: "utf-8",
        maxBuffer: 50 * 1024 * 1024,
        timeout: 120_000,
      },
      (err, stdout, _stderr) => {
        if (err) return reject(err);
        try {
          resolve(JSON.parse(stdout) as number[][]);
        } catch (e) {
          reject(new Error(`Kunne ikke parse NorBERT-output: ${stdout.slice(0, 200)}`));
        }
      },
    );
    proc.stdin?.write(JSON.stringify(tekster));
    proc.stdin?.end();
  });
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

    console.log(
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
