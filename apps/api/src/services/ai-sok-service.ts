/**
 * AI-søk service: hybrid vektor + leksikalsk søk med 6 re-ranking signaler.
 * Portert fra Fil til database-kopi: src/services/ai_search.py
 *
 * Flyt:
 * 1. Encode query → embedding via OpenAI
 * 2. pgvector: cosine similarity top 300 kandidater
 * 3. tsvector: norsk fulltekstsøk
 * 4. Union av vektor + leksikalsk (hybrid)
 * 5. Per-chunk: beregn 6 re-ranking signaler + cosine sim
 * 6. Normalisér + kombiner: recall×sim + precision×rerank + latency×lat
 * 7. Grupper per dokument, maks 10 chunks per dok
 */
import { PrismaClient, Prisma } from "@sitedoc/db";
import { execFile } from "child_process";
import { join } from "path";

// ---- Norske stoppord ----

const STOPPORD = new Set([
  "og", "i", "er", "det", "som", "en", "et", "til", "for", "av",
  "på", "med", "den", "de", "har", "at", "fra", "om", "ikke", "var",
  "kan", "skal", "vil", "ble", "bli", "seg", "ved", "så", "sin",
  "da", "han", "hun", "vi", "meg", "deg", "ham", "dem", "dette",
  "disse", "andre", "alle", "noen", "eller", "men", "når", "hvor",
  "hva", "hvem", "hvilke", "hver", "etter", "over", "under", "mot",
  "mellom", "inn", "ut", "opp", "ned", "her", "der", "nå", "før",
]);

// ---- Typer ----

export interface SokVekter {
  recall: number;     // Vekt på semantisk likhet (cosine sim)
  precision: number;  // Vekt på eksakt matching (re-rank)
  latency: number;    // Vekt på dokumentstørrelse
  phraseWeight: number;
  termWeight: number;
  qualityWeight: number;
  headingWeight: number;
  bm25Weight: number;
  pageposWeight: number;
}

export const DEFAULT_VEKTER: SokVekter = {
  recall: 0.5,
  precision: 0.5,
  latency: 0.5,
  phraseWeight: 0.08,
  termWeight: 0.03,
  qualityWeight: 0.03,
  headingWeight: 0.08,
  bm25Weight: 0.06,
  pageposWeight: 0.01,
};

export interface HybridSokTreff {
  id: string;
  documentId: string;
  chunkText: string;
  pageNumber: number | null;
  sectionTitle: string | null;
  nsCode: string | null;
  filename: string;
  fileUrl: string | null;
  docType: string | null;
  folderId: string | null;
  score: number;
  // Debug-info
  cosineSim?: number;
  reRankScore?: number;
}

interface RåChunk {
  id: string;
  documentId: string;
  chunkText: string;
  pageNumber: number | null;
  sectionTitle: string | null;
  pageHeading: string | null;
  nsCode: string | null;
  filename: string;
  fileUrl: string | null;
  docType: string | null;
  folderId: string | null;
  cosineSim: number;
  kilde: "vektor" | "leksikalsk" | "begge";
}

// ---- Hjelpefunksjoner (fra ai_search.py) ----

function normaliserListe(verdier: number[]): number[] {
  if (verdier.length === 0) return [];
  const min = Math.min(...verdier);
  const max = Math.max(...verdier);
  if (max - min <= 1e-9) return verdier.map(() => 1.0);
  return verdier.map((v) => (v - min) / (max - min));
}

function beregReRank(
  chunk: RåChunk,
  termer: string[],
  fraser: string[],
  tallTokens: string[],
  vekter: SokVekter,
): number {
  const tekstLower = chunk.chunkText.toLowerCase();
  const headingLower = (chunk.pageHeading ?? "").toLowerCase();

  // Frase-treff
  const fraseHits = fraser.filter((f) => tekstLower.includes(f)).length;

  // Term-treff
  const termHits = termer.filter((t) => tekstLower.includes(t)).length;

  // Heading-treff
  let headingHits = 0;
  if (headingLower) {
    headingHits += fraser.filter((f) => headingLower.includes(f)).length;
    headingHits += termer.filter((t) => headingLower.includes(t)).length;
  }

  // Sideposisjon
  const side = chunk.pageNumber ?? 0;
  let pagepos = 0;
  if (side > 0 && side <= 3) pagepos = 1.0;
  else if (side > 0 && side <= 10) pagepos = 0.5;

  // Tall-bonus (NS-standardnumre)
  const tallISøk = new Set(tallTokens);
  let tallBonus = 0;
  if (tallISøk.size > 0) {
    const tallIChunk = new Set(
      tekstLower.match(/\b\d{3,6}\b/g) ?? [],
    );
    // Bonus for treff
    for (const t of tallISøk) {
      if (tallIChunk.has(t)) tallBonus += 0.4;
    }
    // Straff for feil nummer
    for (const t of tallIChunk) {
      if (!tallISøk.has(t)) tallBonus -= 0.6;
    }
  }

  return (
    vekter.phraseWeight * fraseHits +
    vekter.termWeight * termHits +
    vekter.qualityWeight * 0 + // quality_score ikke lagret ennå
    vekter.headingWeight * headingHits +
    vekter.bm25Weight * 0 + // keywords_topk ikke lagret ennå
    vekter.pageposWeight * pagepos +
    tallBonus
  );
}

// ---- Embedding-kall ----

const NORBERT_PYTHON =
  process.env.NORBERT_PYTHON ?? join(process.env.HOME ?? "", "norbert-env", "bin", "python3");
const NORBERT_SCRIPT = join(__dirname, "norbert-embed.py");

async function encodeQueryLokal(query: string): Promise<number[]> {
  const embeddings = await new Promise<number[][]>((resolve, reject) => {
    const proc = execFile(
      NORBERT_PYTHON,
      [NORBERT_SCRIPT],
      { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024, timeout: 60_000 },
      (err, stdout) => {
        if (err) return reject(err);
        try { resolve(JSON.parse(stdout)); } catch (e) { reject(e); }
      },
    );
    proc.stdin?.write(JSON.stringify([query]));
    proc.stdin?.end();
  });
  return embeddings[0]!;
}

async function encodeQueryOpenAI(
  query: string,
  apiKey: string,
  model: string,
): Promise<number[]> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey });
  const response = await client.embeddings.create({
    input: query,
    model,
  });
  return response.data[0]!.embedding;
}

async function encodeQuery(
  query: string,
  provider: "local" | "openai",
  apiKey?: string,
  model?: string,
): Promise<number[]> {
  if (provider === "local") {
    return encodeQueryLokal(query);
  }
  if (!apiKey) throw new Error("OpenAI API-nøkkel mangler");
  return encodeQueryOpenAI(query, apiKey, model ?? "text-embedding-3-small");
}

// ---- Hybrid søk ----

export async function hybridSok(
  prisma: PrismaClient,
  projectId: string,
  query: string,
  mappeIder: string[] | null,
  options: {
    provider?: "local" | "openai";
    apiKey?: string;
    model?: string;
    vekter?: Partial<SokVekter>;
    topK?: number;
    kandidatK?: number;
  },
): Promise<HybridSokTreff[]> {
  const provider = options.provider ?? "local";
  const vekter = { ...DEFAULT_VEKTER, ...options.vekter };
  const topK = options.topK ?? 20;
  const kandidatK = options.kandidatK ?? 300;

  // Tokeniser query
  const queryLower = query.toLowerCase();
  const alleTokens = queryLower.split(/\s+/).filter(Boolean);
  const termer = alleTokens.filter((t) => !STOPPORD.has(t) && t.length > 1);
  const tallTokens = alleTokens.filter((t) => /^\d{3,6}$/.test(t));
  const fraser = (query.match(/"([^"]+)"/g) ?? []).map((p) =>
    p.replace(/"/g, "").toLowerCase(),
  );

  // Mappefilter
  const mappeKlausul =
    mappeIder === null
      ? Prisma.empty
      : Prisma.sql`AND (d.folder_id IS NULL OR d.folder_id IN (${Prisma.join(mappeIder)}))`;

  // 1. Encode query → embedding
  let queryEmbedding: number[];
  try {
    queryEmbedding = await encodeQuery(
      query,
      provider,
      options.apiKey,
      options.model,
    );
  } catch (err) {
    console.error("[AI-SØK] Embedding-feil, faller tilbake til leksikalsk:", err);
    // Fallback: kun leksikalsk søk
    return leksikalskSok(prisma, projectId, query, mappeIder, topK);
  }

  const vecStr = `[${queryEmbedding.join(",")}]`;

  // 2. Vektor-søk via pgvector (top 300)
  const vektorTreff = await prisma.$queryRaw<RåChunk[]>`
    SELECT
      c.id,
      c.document_id AS "documentId",
      c.chunk_text AS "chunkText",
      c.page_number AS "pageNumber",
      c.section_title AS "sectionTitle",
      c.page_heading AS "pageHeading",
      c.ns_code AS "nsCode",
      d.filename,
      d.file_url AS "fileUrl",
      d.doc_type AS "docType",
      d.folder_id AS "folderId",
      1 - (c.embedding_vector <=> ${vecStr}::vector) AS "cosineSim"
    FROM ftd_document_chunks c
    JOIN ftd_documents d ON d.id = c.document_id
    WHERE d.project_id = ${projectId}
      AND d.is_active = true
      AND c.embedding_vector IS NOT NULL
      ${mappeKlausul}
    ORDER BY c.embedding_vector <=> ${vecStr}::vector
    LIMIT ${kandidatK}
  `;

  // 3. Leksikalsk søk via tsvector
  const leksikalskeTreff = await prisma.$queryRaw<RåChunk[]>`
    SELECT
      c.id,
      c.document_id AS "documentId",
      c.chunk_text AS "chunkText",
      c.page_number AS "pageNumber",
      c.section_title AS "sectionTitle",
      c.page_heading AS "pageHeading",
      c.ns_code AS "nsCode",
      d.filename,
      d.file_url AS "fileUrl",
      d.doc_type AS "docType",
      d.folder_id AS "folderId",
      0.0 AS "cosineSim"
    FROM ftd_document_chunks c
    JOIN ftd_documents d ON d.id = c.document_id
    WHERE d.project_id = ${projectId}
      AND d.is_active = true
      AND c.search_vector @@ plainto_tsquery('norwegian', ${query})
      ${mappeKlausul}
    LIMIT ${kandidatK}
  `;

  // 4. Hybrid union (dedupliser på chunk-id)
  const chunkMap = new Map<string, RåChunk>();
  for (const c of vektorTreff) {
    c.kilde = "vektor";
    chunkMap.set(c.id, c);
  }
  for (const c of leksikalskeTreff) {
    if (chunkMap.has(c.id)) {
      chunkMap.get(c.id)!.kilde = "begge";
    } else {
      c.kilde = "leksikalsk";
      c.cosineSim = 0;
      chunkMap.set(c.id, c);
    }
  }

  const alleChunks = [...chunkMap.values()];
  if (alleChunks.length === 0) return [];

  // Filtrer lav cosine similarity (terskel 0.15, fra ai_search.py)
  const filtrert = alleChunks.filter(
    (c) => c.cosineSim >= 0.15 || c.kilde === "leksikalsk" || c.kilde === "begge",
  );

  if (filtrert.length === 0) return [];

  // 5. Beregn re-ranking signaler per chunk
  const simVerdier = filtrert.map((c) => Number(c.cosineSim));
  const reRankVerdier = filtrert.map((c) =>
    beregReRank(c, termer, fraser, tallTokens, vekter),
  );

  // Latency: færre chunks per dokument = høyere score
  const chunksPerDok = new Map<string, number>();
  for (const c of filtrert) {
    chunksPerDok.set(c.documentId, (chunksPerDok.get(c.documentId) ?? 0) + 1);
  }
  const latencyVerdier = filtrert.map((c) => {
    const cnt = chunksPerDok.get(c.documentId) ?? 1;
    return 1.0 / (1.0 + Math.log10(1 + cnt));
  });

  // 6. Normalisér
  const simNorm = normaliserListe(simVerdier);
  const reRankNorm = normaliserListe(reRankVerdier);
  const latencyNorm = normaliserListe(latencyVerdier);

  // 7. Final score
  const scoredChunks = filtrert.map((chunk, i) => ({
    chunk,
    score:
      vekter.recall * (simNorm[i] ?? 0) +
      vekter.precision * (reRankNorm[i] ?? 0) +
      vekter.latency * (latencyNorm[i] ?? 0),
    cosineSim: simVerdier[i] ?? 0,
    reRankScore: reRankVerdier[i] ?? 0,
  }));

  // 8. Grupper per dokument, maks 10 chunks per dok
  const perDok = new Map<string, typeof scoredChunks>();
  for (const s of scoredChunks) {
    const arr = perDok.get(s.chunk.documentId) ?? [];
    arr.push(s);
    perDok.set(s.chunk.documentId, arr);
  }

  const resultater: HybridSokTreff[] = [];
  for (const [_dokId, chunks] of perDok) {
    chunks.sort((a, b) => b.score - a.score);
    for (const s of chunks.slice(0, 10)) {
      resultater.push({
        id: s.chunk.id,
        documentId: s.chunk.documentId,
        chunkText: s.chunk.chunkText,
        pageNumber: s.chunk.pageNumber,
        sectionTitle: s.chunk.sectionTitle,
        nsCode: s.chunk.nsCode,
        filename: s.chunk.filename,
        fileUrl: s.chunk.fileUrl,
        docType: s.chunk.docType,
        folderId: s.chunk.folderId,
        score: s.score,
        cosineSim: s.cosineSim,
        reRankScore: s.reRankScore,
      });
    }
  }

  // Sorter globalt etter score
  resultater.sort((a, b) => b.score - a.score);
  return resultater.slice(0, topK);
}

// ---- Fallback: rent leksikalsk søk (ingen embedding) ----

async function leksikalskSok(
  prisma: PrismaClient,
  projectId: string,
  query: string,
  mappeIder: string[] | null,
  limit: number,
): Promise<HybridSokTreff[]> {
  const mappeKlausul =
    mappeIder === null
      ? Prisma.empty
      : Prisma.sql`AND (d.folder_id IS NULL OR d.folder_id IN (${Prisma.join(mappeIder)}))`;

  let treff = await prisma.$queryRaw<HybridSokTreff[]>`
    SELECT DISTINCT ON (c.document_id)
      c.id,
      c.document_id AS "documentId",
      c.chunk_text AS "chunkText",
      c.page_number AS "pageNumber",
      c.section_title AS "sectionTitle",
      c.ns_code AS "nsCode",
      d.filename,
      d.file_url AS "fileUrl",
      d.doc_type AS "docType",
      d.folder_id AS "folderId",
      ts_rank(c.search_vector, plainto_tsquery('norwegian', ${query}))::float AS score
    FROM ftd_document_chunks c
    JOIN ftd_documents d ON d.id = c.document_id
    WHERE d.project_id = ${projectId}
      AND d.is_active = true
      AND c.search_vector @@ plainto_tsquery('norwegian', ${query})
      ${mappeKlausul}
    ORDER BY c.document_id, score DESC
  `;

  treff.sort((a, b) => b.score - a.score);
  return treff.slice(0, limit);
}
