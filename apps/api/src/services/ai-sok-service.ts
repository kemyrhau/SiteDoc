/**
 * AI-søk service: hybrid vektor + leksikalsk søk med 6 re-ranking signaler.
 * Portert fra Fil til database-kopi: src/services/ai_search.py
 */
import { PrismaClient, Prisma } from "@sitedoc/db";

// ---- Norske stoppord + søke-fraser ----

const STOPPORD = new Set([
  "og", "i", "er", "det", "som", "en", "et", "til", "for", "av",
  "på", "med", "den", "de", "har", "at", "fra", "om", "ikke", "var",
  "kan", "skal", "vil", "ble", "bli", "seg", "ved", "så", "sin",
  "da", "han", "hun", "vi", "meg", "deg", "ham", "dem", "dette",
  "disse", "andre", "alle", "noen", "eller", "men", "når", "hvor",
  "hva", "hvem", "hvilke", "hver", "etter", "over", "under", "mot",
  "mellom", "inn", "ut", "opp", "ned", "her", "der", "nå", "før",
]);

// Naturlig-språk fraser som fjernes fra query
const SØKE_PREFIKS = [
  "kan du finne", "finn", "søk etter", "vis meg", "hva er",
  "hvor er", "gi meg", "let etter", "hjelp meg finne",
];

function rensQuery(query: string): string {
  let q = query.toLowerCase().trim();
  for (const p of SØKE_PREFIKS) {
    if (q.startsWith(p)) {
      q = q.slice(p.length).trim();
    }
  }
  return q || query;
}

// ---- Typer ----

export interface SokVekter {
  recall: number;
  precision: number;
  latency: number;
  phraseWeight: number;
  termWeight: number;
  qualityWeight: number;
  headingWeight: number;
  bm25Weight: number;
  pageposWeight: number;
}

export const DEFAULT_VEKTER: SokVekter = {
  recall: 0.6,
  precision: 0.4,
  latency: 0.2,
  phraseWeight: 0.10,
  termWeight: 0.05,
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

// ---- Hjelpefunksjoner ----

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
  const filnavnLower = (chunk.filename ?? "").toLowerCase();

  // Frase-treff
  const fraseHits = fraser.filter((f) => tekstLower.includes(f)).length;

  // Term-treff (normalisert: andel av søketermer som finnes)
  const termHits = termer.length > 0
    ? termer.filter((t) => tekstLower.includes(t)).length / termer.length
    : 0;

  // Heading-treff
  let headingHits = 0;
  if (headingLower) {
    headingHits += fraser.filter((f) => headingLower.includes(f)).length;
    headingHits += termer.filter((t) => headingLower.includes(t)).length;
  }

  // Filnavn-boost: søkeord som finnes i filnavnet gir sterk bonus
  let filnavnBoost = 0;
  const filnavnTermHits = termer.filter((t) => filnavnLower.includes(t)).length;
  if (filnavnTermHits > 0) {
    filnavnBoost = 0.15 * Math.min(filnavnTermHits, 3); // maks 0.45
  }

  // Sideposisjon
  const side = chunk.pageNumber ?? 0;
  let pagepos = 0;
  if (side > 0 && side <= 3) pagepos = 1.0;
  else if (side > 0 && side <= 10) pagepos = 0.5;

  // Tall-bonus (mildere enn før)
  const tallISøk = new Set(tallTokens);
  let tallBonus = 0;
  if (tallISøk.size > 0) {
    const tallIChunk = new Set(tekstLower.match(/\b\d{3,6}\b/g) ?? []);
    for (const t of tallISøk) {
      if (tallIChunk.has(t)) tallBonus += 0.3;
    }
    let straffCount = 0;
    for (const t of tallIChunk) {
      if (!tallISøk.has(t)) straffCount++;
    }
    tallBonus -= Math.min(straffCount * 0.05, 0.3);
  }

  // NS 3420 nedvekting
  let ns3420Straff = 0;
  if (filnavnLower.includes("3420") || filnavnLower.includes("ns-3420")) {
    ns3420Straff = -0.15;
  }

  return (
    vekter.phraseWeight * fraseHits +
    vekter.termWeight * termHits +
    vekter.headingWeight * headingHits +
    vekter.pageposWeight * pagepos +
    filnavnBoost +
    tallBonus +
    ns3420Straff
  );
}

// ---- Embedding-kall ----

const NORBERT_URL = process.env.NORBERT_URL ?? "http://127.0.0.1:3302";

async function encodeQueryLokal(query: string): Promise<number[]> {
  const response = await fetch(`${NORBERT_URL}/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([query]),
  });

  if (!response.ok) {
    throw new Error(`NorBERT-server feilet (${response.status})`);
  }

  const embeddings = (await response.json()) as number[][];
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
    dokumentIder?: string[];
    ekskluderMappeIder?: string[];
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

  // Rens naturlig-språk fra query
  const rensetQuery = rensQuery(query);

  // Tokeniser
  const queryLower = rensetQuery.toLowerCase();
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

  // Dokumentfilter (kun søk i bestemte dokumenter)
  const dokKlausul = options.dokumentIder?.length
    ? Prisma.sql`AND d.id IN (${Prisma.join(options.dokumentIder)})`
    : Prisma.empty;

  // Ekskluder mapper (f.eks. NS 3420)
  const ekskluderKlausul = options.ekskluderMappeIder?.length
    ? Prisma.sql`AND (d.folder_id IS NULL OR d.folder_id NOT IN (${Prisma.join(options.ekskluderMappeIder)}))`
    : Prisma.empty;

  // 1. Encode query → embedding
  let queryEmbedding: number[];
  try {
    queryEmbedding = await encodeQuery(rensetQuery, provider, options.apiKey, options.model);
  } catch (err) {
    // Fallback: kun leksikalsk søk
    return leksikalskSok(prisma, projectId, rensetQuery, mappeIder, topK);
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
      ${dokKlausul}
      ${ekskluderKlausul}
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
      AND c.search_vector @@ plainto_tsquery('norwegian', ${rensetQuery})
      ${mappeKlausul}
      ${dokKlausul}
      ${ekskluderKlausul}
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

  // Filtrer lav cosine similarity (økt terskel fra 0.15 til 0.30)
  const SIM_TERSKEL = 0.30;
  const filtrert = alleChunks.filter(
    (c) => Number(c.cosineSim) >= SIM_TERSKEL || c.kilde === "leksikalsk" || c.kilde === "begge",
  );

  if (filtrert.length === 0) return [];

  // 5. Beregn re-ranking signaler per chunk
  const simVerdier = filtrert.map((c) => Number(c.cosineSim));
  const reRankVerdier = filtrert.map((c) =>
    beregReRank(c, termer, fraser, tallTokens, vekter),
  );

  // Latency
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

  // 8. Dedup per dokument — maks 1 best-scored chunk per dokument
  const bestPerDok = new Map<string, (typeof scoredChunks)[0]>();
  for (const s of scoredChunks) {
    const existing = bestPerDok.get(s.chunk.documentId);
    if (!existing || s.score > existing.score) {
      bestPerDok.set(s.chunk.documentId, s);
    }
  }

  const resultater: HybridSokTreff[] = [];
  for (const [_dokId, s] of bestPerDok) {
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
