/**
 * AI-søk service: hybrid vektor + leksikalsk søk med 6 re-ranking signaler.
 * Portert fra Fil til database-kopi: src/services/ai_search.py
 */
import { PrismaClient, Prisma } from "@sitedoc/db";
import { fetchMedTimeout } from "./embedding-service";

/**
 * Query-embedding er INTERAKTIVT (bruker venter på søkeresultat), så timeouten er
 * kort og det gjøres ingen retry — til forskjell fra batch-embedding under prosessering
 * (`embedding-service.ts`, 30 s + backoff). Henger NorBERT, avbrytes kallet og `hybridSok`
 * faller til rent tekstsøk med synlig merknad i stedet for å henge søket.
 */
const QUERY_EMBEDDING_TIMEOUT_MS = 8_000;

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
  headingWeight: number;
  pageposWeight: number;
}

export const DEFAULT_VEKTER: SokVekter = {
  recall: 0.6,
  precision: 0.4,
  latency: 0.2,
  phraseWeight: 0.10,
  termWeight: 0.05,
  headingWeight: 0.08,
  pageposWeight: 0.01,
};

// Sentinel-markører rundt treff fra ts_headline. Svært usannsynlige i dokumenttekst;
// klienten splitter på disse og rendrer <mark>. Se apps/web/src/components/ftd-sok/utsnitt.ts.
export const HL_START = "❰HL❱"; // ❰HL❱
export const HL_STOP = "❰/HL❱"; // ❰/HL❱
export const HEADLINE_OPTS = `StartSel=${HL_START}, StopSel=${HL_STOP}, MaxWords=32, MinWords=12, ShortWord=2, HighlightAll=FALSE`;

/** Søkemetode som ga treffet — vises som badge i trefflista. */
export type SokMetode = "semantisk" | "tekst" | "begge";

function kildeTilMetode(kilde: "vektor" | "leksikalsk" | "begge"): SokMetode {
  if (kilde === "vektor") return "semantisk";
  if (kilde === "leksikalsk") return "tekst";
  return "begge";
}

export interface HybridSokTreff {
  id: string;
  documentId: string;
  chunkText: string;
  chunkIndex: number | null;
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
  metode: SokMetode;
  /** ts_headline-utdrag (sentinler) for treff med ordtreff ("tekst"/"begge"). Null for "semantisk". */
  utdrag: string | null;
  /**
   * S5: setningen i chunken som best forklarer et rent semantisk treff (term-overlapp, se
   * `finnBesteSetning`). Null når metoden ikke er "semantisk", eller ingen setning har overlapp.
   */
  semantiskSetning: string | null;
}

/**
 * Resultat av hybridsøk. `aiSøkUtilgjengelig` er true når query-embeddingen feilet
 * (timeout/nett/NorBERT nede) og `treff` derfor er rent tekstsøk — klienten viser da en
 * synlig merknad i stedet for å presentere det som fullverdig AI-søk (stille tomhet).
 */
export interface HybridSokResultat {
  treff: HybridSokTreff[];
  aiSøkUtilgjengelig: boolean;
}

interface RåChunk {
  id: string;
  documentId: string;
  chunkText: string;
  chunkIndex: number | null;
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

  // NS-standard nedvekting (referansedokumenter er generiske)
  let nsStandardStraff = 0;
  if (/3420|8405|8406|8407|ns-/.test(filnavnLower)) {
    nsStandardStraff = -0.15;
  }

  return (
    vekter.phraseWeight * fraseHits +
    vekter.termWeight * termHits +
    vekter.headingWeight * headingHits +
    vekter.pageposWeight * pagepos +
    filnavnBoost +
    tallBonus +
    nsStandardStraff
  );
}

// ---- Embedding-kall ----

const NORBERT_URL = process.env.NORBERT_URL ?? "http://127.0.0.1:3302";

async function encodeQueryLokal(
  query: string,
  timeoutMs = QUERY_EMBEDDING_TIMEOUT_MS,
): Promise<number[]> {
  // Gjenbruk av batch-embeddingens `fetchMedTimeout`: AbortController-avbrudd + ett forsøk.
  // Kaster EmbeddingFeil ved timeout/nettverksfeil, som fanges i `hybridSok` → tekstsøk-fallback.
  const response = await fetchMedTimeout(
    `${NORBERT_URL}/embed`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([query]),
    },
    timeoutMs,
  );

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
  timeoutMs?: number,
): Promise<number[]> {
  if (provider === "local") {
    return encodeQueryLokal(query, timeoutMs);
  }
  if (!apiKey) throw new Error("OpenAI API-nøkkel mangler");
  return encodeQueryOpenAI(query, apiKey, model ?? "text-embedding-3-small");
}

// ---- S5: beste setning for semantiske treff ----

/** Ord-start-treff (æøå-sikkert; `\b` i JS kjenner ikke æøå). */
function harOrdStart(tekst: string, fragment: string): boolean {
  const esc = fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${esc}`, "u").test(tekst);
}

// Forkortelser som ender på punktum uten å avslutte setningen (husstil «pr.», jf. CLAUDE.md § Språk).
const FORKORTELSER = new Set([
  "pr", "ca", "kr", "nr", "jf", "iht", "evt", "inkl", "ekskl", "osv", "dvs", "mv", "stk",
  "bl.a", "f.eks", "m.m", "m.v", "o.l", "ref", "pkt", "kap", "tlf", "mill", "mrd",
]);

/** Del tekst i setninger: grense = linjeskift, eller [.!?] + mellomrom — men ikke etter en forkortelse. */
function delISetninger(tekst: string): string[] {
  const ut: string[] = [];
  for (const linje of tekst.split(/\n+/)) {
    let start = 0;
    for (const m of linje.matchAll(/[.!?]\s+/g)) {
      const slutt = m.index! + 1;
      const sisteOrd = linje.slice(start, slutt - 1).split(/\s+/).pop()?.toLowerCase() ?? "";
      if (m[0][0] === "." && FORKORTELSER.has(sisteOrd)) continue;
      ut.push(linje.slice(start, slutt));
      start = m.index! + m[0].length;
    }
    ut.push(linje.slice(start));
  }
  return ut.map((x) => x.trim()).filter((x) => x.length > 0);
}

/**
 * Finn setningen i en chunk som best forklarer hvorfor et rent semantisk treff kom opp, uten ny
 * modell: score = 2 × fraser i setningen + 1 × termer som ord-start + 0,5 × termer (≥ 5 tegn) der
 * en stamme (termen minus 2 siste tegn, min. 4) står som ord-start. Høyest vinner, likt → tidligste.
 * Ingen setning med score > 0 → null (klienten viser da utsnitt fra start uten markering — ikke en
 * tilfeldig setning). Returnert setning er en eksakt delstreng av `chunkText`.
 */
export function finnBesteSetning(
  chunkText: string,
  termer: string[],
  fraser: string[],
): string | null {
  const setninger = delISetninger(chunkText);
  let beste: string | null = null;
  let besteScore = 0;
  for (const setning of setninger) {
    const lower = setning.toLowerCase();
    let score = 0;
    for (const f of fraser) if (lower.includes(f)) score += 2;
    for (const t of termer) {
      if (harOrdStart(lower, t)) score += 1;
      else if (t.length >= 5 && harOrdStart(lower, t.slice(0, Math.max(4, t.length - 2)))) score += 0.5;
    }
    if (score > besteScore) {
      besteScore = score;
      beste = setning;
    }
  }
  return beste;
}

/**
 * Legg ts_headline-utdrag på treff med ordtreff (én spørring for hele resultatsettet, ikke for
 * 300 kandidater). Samme headline-oppsett som Tekstsøk → samme utsnittslogikk i begge moduser (S2).
 */
async function leggPaaHeadline(
  prisma: PrismaClient,
  treff: HybridSokTreff[],
  query: string,
): Promise<void> {
  const ider = treff.filter((t) => t.metode !== "semantisk").map((t) => t.id);
  if (ider.length === 0) return;
  const rader = await prisma.$queryRaw<Array<{ id: string; utdrag: string | null }>>`
    SELECT c.id,
           ts_headline('norwegian', c.chunk_text, plainto_tsquery('norwegian', ${query}), ${HEADLINE_OPTS}) AS utdrag
    FROM ftd_document_chunks c
    WHERE c.id IN (${Prisma.join(ider)})
  `;
  const perId = new Map(rader.map((r) => [r.id, r.utdrag]));
  for (const t of treff) {
    if (t.metode !== "semantisk") t.utdrag = perId.get(t.id) ?? null;
  }
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
    /** Overstyr query-embedding-timeout (ms). Brukes av tester; default 8 s. */
    embeddingTimeoutMs?: number;
  },
): Promise<HybridSokResultat> {
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
    queryEmbedding = await encodeQuery(
      rensetQuery,
      provider,
      options.apiKey,
      options.model,
      options.embeddingTimeoutMs,
    );
  } catch (_err) {
    // Embedding utilgjengelig (timeout/nett/NorBERT nede) → fall til rent tekstsøk,
    // og flagg det så klienten viser synlig merknad i stedet for stille tomhet.
    const treff = await leksikalskSok(prisma, projectId, rensetQuery, mappeIder, topK, {
      dokumentIder: options.dokumentIder,
      ekskluderMappeIder: options.ekskluderMappeIder,
    });
    return { treff, aiSøkUtilgjengelig: true };
  }

  const vecStr = `[${queryEmbedding.join(",")}]`;

  // 2. Vektor-søk via pgvector (top 300)
  const vektorTreff = await prisma.$queryRaw<RåChunk[]>`
    SELECT
      c.id,
      c.document_id AS "documentId",
      c.chunk_text AS "chunkText",
      c.chunk_index AS "chunkIndex",
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
      c.chunk_index AS "chunkIndex",
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
    ORDER BY ts_rank(c.search_vector, plainto_tsquery('norwegian', ${rensetQuery})) DESC, c.id
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
  if (alleChunks.length === 0) return { treff: [], aiSøkUtilgjengelig: false };

  // Filtrer lav cosine similarity (økt terskel fra 0.15 til 0.30)
  const SIM_TERSKEL = 0.30;
  const filtrert = alleChunks.filter(
    (c) => Number(c.cosineSim) >= SIM_TERSKEL || c.kilde === "leksikalsk" || c.kilde === "begge",
  );

  if (filtrert.length === 0) return { treff: [], aiSøkUtilgjengelig: false };

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
    const metode = kildeTilMetode(s.chunk.kilde);
    resultater.push({
      id: s.chunk.id,
      documentId: s.chunk.documentId,
      chunkText: s.chunk.chunkText,
      chunkIndex: s.chunk.chunkIndex,
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
      metode,
      utdrag: null,
      semantiskSetning:
        metode === "semantisk" ? finnBesteSetning(s.chunk.chunkText, termer, fraser) : null,
    });
  }

  // Sorter globalt etter score
  resultater.sort((a, b) => b.score - a.score);
  const treff = resultater.slice(0, topK);
  await leggPaaHeadline(prisma, treff, rensetQuery);
  return { treff, aiSøkUtilgjengelig: false };
}

// ---- Fallback: rent leksikalsk søk (ingen embedding) ----

async function leksikalskSok(
  prisma: PrismaClient,
  projectId: string,
  query: string,
  mappeIder: string[] | null,
  limit: number,
  filter: { dokumentIder?: string[]; ekskluderMappeIder?: string[] } = {},
): Promise<HybridSokTreff[]> {
  const mappeKlausul =
    mappeIder === null
      ? Prisma.empty
      : Prisma.sql`AND (d.folder_id IS NULL OR d.folder_id IN (${Prisma.join(mappeIder)}))`;
  // S4: fallbacken respekterer samme dokumentfilter som hybridsøket (S-M9).
  const dokKlausul = filter.dokumentIder?.length
    ? Prisma.sql`AND d.id IN (${Prisma.join(filter.dokumentIder)})`
    : Prisma.empty;
  const ekskluderKlausul = filter.ekskluderMappeIder?.length
    ? Prisma.sql`AND (d.folder_id IS NULL OR d.folder_id NOT IN (${Prisma.join(filter.ekskluderMappeIder)}))`
    : Prisma.empty;

  const treff = await prisma.$queryRaw<Omit<HybridSokTreff, "metode" | "utdrag" | "semantiskSetning">[]>`
    SELECT DISTINCT ON (c.document_id)
      c.id,
      c.document_id AS "documentId",
      c.chunk_text AS "chunkText",
      c.chunk_index AS "chunkIndex",
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
      ${dokKlausul}
      ${ekskluderKlausul}
    ORDER BY c.document_id, score DESC
  `;

  treff.sort((a, b) => b.score - a.score);
  const resultat: HybridSokTreff[] = treff.slice(0, limit).map((t) => ({
    ...t,
    metode: "tekst" as const,
    utdrag: null,
    semantiskSetning: null,
  }));
  await leggPaaHeadline(prisma, resultat, query);
  return resultat;
}

// ---- Flerspråklig blokk-søk ----

export interface BlokkSokTreff {
  id: string;
  documentId: string;
  content: string;
  blockType: string;
  pageNumber: number;
  language: string;
  filename: string;
  fileUrl: string | null;
  folderId: string | null;
  score: number;
}

/**
 * Søk i FtdDocumentBlock med multilingual E5 embedding.
 * Brukes for flerspråklig søk — finner blokker på brukerens språk.
 * Faller tilbake til norsk hvis ingen treff på valgt språk.
 */
export async function blokkSok(
  prisma: PrismaClient,
  projectId: string,
  query: string,
  language: string,
  mappeIder: string[] | null,
  topK: number = 20,
): Promise<BlokkSokTreff[]> {
  // Encode query med multilingual E5
  const NORBERT_URL = process.env.NORBERT_URL ?? "http://127.0.0.1:3302";
  const response = await fetch(`${NORBERT_URL}/embed/model`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "multilingual-e5-query", texts: [query] }),
  });

  if (!response.ok) {
    throw new Error(`E5 query embedding feilet: ${response.status}`);
  }

  const data = (await response.json()) as { embeddings: number[][] };
  const queryVec = data.embeddings[0];
  if (!queryVec) throw new Error("Ingen embedding returnert");

  const vecStr = `[${queryVec.join(",")}]`;

  const mappeKlausul =
    mappeIder === null
      ? Prisma.empty
      : Prisma.sql`AND d.folder_id IN (${Prisma.join(mappeIder)})`;

  // Søk i blokker på brukerens språk
  const treff = await prisma.$queryRaw<BlokkSokTreff[]>`
    SELECT
      b.id,
      b.document_id AS "documentId",
      b.content,
      b.block_type AS "blockType",
      b.page_number AS "pageNumber",
      b.language,
      d.filename,
      d.file_url AS "fileUrl",
      d.folder_id AS "folderId",
      (1 - (b.embedding_vector <=> ${vecStr}::vector)) AS score
    FROM ftd_document_blocks b
    JOIN ftd_documents d ON d.id = b.document_id
    WHERE d.project_id = ${projectId}
      AND d.is_active = true
      AND b.embedding_vector IS NOT NULL
      AND b.language = ${language}
      AND b.block_type IN ('heading', 'text', 'caption')
      ${mappeKlausul}
    ORDER BY b.embedding_vector <=> ${vecStr}::vector
    LIMIT ${topK}
  `;

  // Fallback til norsk hvis < 3 treff
  if (treff.length < 3 && language !== "nb") {
    const nbTreff = await prisma.$queryRaw<BlokkSokTreff[]>`
      SELECT
        b.id,
        b.document_id AS "documentId",
        b.content,
        b.block_type AS "blockType",
        b.page_number AS "pageNumber",
        b.language,
        d.filename,
        d.file_url AS "fileUrl",
        d.folder_id AS "folderId",
        (1 - (b.embedding_vector <=> ${vecStr}::vector)) AS score
      FROM ftd_document_blocks b
      JOIN ftd_documents d ON d.id = b.document_id
      WHERE d.project_id = ${projectId}
        AND d.is_active = true
        AND b.embedding_vector IS NOT NULL
        AND b.language = 'nb'
        AND b.block_type IN ('heading', 'text', 'caption')
        ${mappeKlausul}
      ORDER BY b.embedding_vector <=> ${vecStr}::vector
      LIMIT ${topK}
    `;
    // Kombiner: brukerens språk først, deretter norsk
    const eksisterende = new Set(treff.map((t) => t.id));
    for (const t of nbTreff) {
      if (!eksisterende.has(t.id)) treff.push(t);
    }
    treff.sort((a, b) => b.score - a.score);
  }

  return treff.slice(0, topK);
}
