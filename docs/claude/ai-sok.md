# AI-søk — Plan for intelligent dokumentsøk

## Referanseimplementasjon: Fil til database-kopi

All funksjonalitet i denne planen er allerede implementert og testet i Python-prosjektet
`/Users/kennethmyrhaug/Documents/Programmering/Fil til database-kopi/`. Denne planen porterer
den fungerende arkitekturen til SiteDoc (Node.js/TypeScript/PostgreSQL).

**Nøkkelfiler å lese før implementering:**

| Fil (Fil til database-kopi) | Funksjon | Portes til |
|-----|----------|------------|
| `src/services/ai_search.py` | Hybrid søk: vektor + 6 re-ranking signaler | `apps/api/src/services/ai-sok-service.ts` |
| `src/backends/embedding.py` | Embedding abstraksjon: lokal (SentenceTransformer/NorBERT) + Azure OpenAI | `apps/api/src/services/embedding-service.ts` |
| `src/backends/vector_search.py` | Vektor-søk: FAISS (lokal) + Azure AI Search | pgvector i PostgreSQL |
| `src/services/embedding_service.py` | Bakgrunns-embedding: worker-prosesser, status-logging, recovery | `apps/api/src/services/embedding-service.ts` |
| `src/services/settings_service.py` | Settings dataclass: modell, vekter, provider, API-nøkler | `aiSokInnstillinger` DB-tabell |
| `src/ui/windows/ai_settings_window.py` | Settings UI: modellvalg, vekter-sliders, provider-config | `/dashbord/oppsett/ai-sok` |
| `src/ui/windows/ai_search_window.py` | Søke-UI: modus-velger, score-visning, chunk-detaljer | Søk-siden i SiteDoc web |

## Nåværende tilstand (SiteDoc)

- tsvector (norsk stemming) + ILIKE-fallback
- Chunking: 1500 tegn, 100 overlap — likt for alle filtyper
- `embeddingState`-kolonne finnes på FtdDocumentChunk (pending/done), ingen kode
- `embedding_vector`-kolonne mangler (må legges til)
- Excel-chunks er dårlige (repeterende celler)

## Mål

Portering av "fil til database"-arkitekturen til SiteDoc web:
1. **Embedding-generering** — bakgrunnsprosess som vektoriserer chunks
2. **Hybrid søk** — vektor (cosine similarity) + leksikalsk (tsvector) + re-ranking med 6 signaler
3. **LLM-integrasjon** — Claude/OpenAI for ekte AI-søk (RAG)
4. **Settings UI** — velg modell, LLM-provider, API-nøkkel, søkeparametere, re-ranking vekter
5. **Testing UI** — diagnostikk, chunk-visning, søketest

## Arkitektur

```
┌─────────────────────────────────────────────────────────┐
│ Bruker: Søk "grøftesnitt type 2"                        │
├─────────────────────────────────────────────────────────┤
│ 1. Encode query → embedding-vektor (384/768/1536 dim)   │
│ 2. Vektor-søk: cosine similarity top 300 kandidater     │
│ 3. Leksikalsk: tsvector + term-matching                 │
│ 4. Hybrid join: union av vektor + leksikalsk            │
│ 5. Re-ranking: 6 signaler (se under)                    │
│ 6. Normalisering: sim_norm + re_rank_norm + latency     │
│ 7. Final score: recall×sim + precision×rerank + lat     │
│ 8. Valgfri: RAG — send top-5 chunks til LLM → svar     │
│ 9. Vis resultater gruppert per dokument (maks 10/dok)   │
└─────────────────────────────────────────────────────────┘
```

### Re-ranking signaler (fra ai_search.py)

6 signaler beregnes per chunk og kombineres med konfigurerbare vekter:

| Signal | Vekt (default) | Beskrivelse | Ref: ai_search.py |
|--------|---------------|-------------|---------------------|
| `phrase_weight` | 0.08 | Eksakt frase-treff i chunk-tekst | Linje 567 |
| `term_weight` | 0.03 | Individuelle ord-treff (filtrert for stoppord) | Linje 568 |
| `quality_weight` | 0.03 | Chunk quality_score (metadata fra prosessering) | Linje 569 |
| `heading_weight` | 0.08 | Treff i page_heading (seksjonsoverskrift) | Linje 570 |
| `bm25_weight` | 0.06 | BM25-stil scoring via keywords_topk | Linje 571 |
| `pagepos_weight` | 0.01 | Sideposisjon (side 1-3: 1.0, 4-10: 0.5, >10: 0.0) | Linje 572 |

**Num-bonus** (linje 528-539): Ekstra bonus for treff på standardnumre (NS 8405 etc), straff for feil standardnummer.

### Sluttscoring (fra ai_search.py linje 597-604)

```
final = recall × sim_norm + precision × re_rank_norm + latency × latency_norm
```

- `recall` (0.0-1.0): Vekt på semantisk likhet (cosine similarity)
- `precision` (0.0-1.0): Vekt på eksakt term/frase-matching
- `latency` (0.0-1.0): Vekt på dokumentstørrelse (færre chunks = raskere = høyere score)

Alle tre komponentene normaliseres til [0,1] via min-max normalisering.

### Embedding-abstraksjon (fra embedding.py)

```
EmbeddingBackend (abstrakt)
├── LocalEmbedding — SentenceTransformer / NorBERT (lokal)
│   - all-MiniLM-L6-v2 (384 dim)
│   - ltgoslo/norbert2 (768 dim)
└── AzureOpenAIEmbedding — text-embedding-3-small (1536 dim)
    - Truncation: 8191 tokens (~12k tegn norsk)
    - Batch: 2048 tekster per request
```

### Vektor-søk abstraksjon (fra vector_search.py)

```
VectorSearchBackend (abstrakt)
├── FAISSBackend — In-memory FAISS-indeks
│   - Bygges fra DB-embeddings
│   - search(query, top_k=300) → chunk_ids med score ≥ 0.15
└── AzureAISearchBackend — Azure AI Search (HNSW)
    - 1536-dim vektorfelt
    - Batch upload: 1000 dokumenter per batch
    - Auto-oppretter indeks ved oppstart
```

**For SiteDoc:** pgvector erstatter FAISS/Azure AI Search (enklere, ingen ekstra prosess).

## Steg-for-steg implementering

### Fase 1: Embedding-infrastruktur

**Database:**
- Legg til `embedding_vector bytea` på `ftd_document_chunks`
- Legg til indeks for embedding_state

**Embedding-modell:**
- Start med `text-embedding-3-small` via OpenAI (1536 dim) — raskest å starte med
- Ref: `AzureOpenAIEmbedding` i `embedding.py` linje 100-185
- Alternativ lokal: `all-MiniLM-L6-v2` via `@xenova/transformers` (384 dim)
- Ref: `LocalEmbedding` i `embedding.py` linje 51-97

**Bakgrunnsprosess:**
- Ny service: `apps/api/src/services/embedding-service.ts`
- Ref: `embedding_service.py` — worker-mønster med status-logging og recovery
- Hent chunks med `embeddingState = 'pending'`, batch à 64
- Generer embedding → lagre som bytea → sett state = 'done'
- Recovery: sett 'processing' tilbake til 'pending' ved oppstart (ref: `recover_stuck_processing()` linje 224-244)
- Nytt Fastify-endepunkt: `POST /embeddings/generate` (trigger)
- Fremdriftslogging til database eller fil

### Fase 2: Hybrid søk med re-ranking

**pgvector:**
- `pgvector` PostgreSQL-utvidelse (enklere enn FAISS for server-deployment)
- `CREATE INDEX ON ftd_document_chunks USING ivfflat (embedding_vector vector_cosine_ops)`

**Hybrid søk-endepunkt:**
- Oppdater `ftdSok.sokDokumenter` — ref: `ai_search.search()` linje 148-636
- Flyten:
  1. Encode query → vektor
  2. pgvector: `ORDER BY embedding_vector <=> query_vector LIMIT 300` (erstatter FAISS)
  3. tsvector: eksisterende søk (erstatter SQLite ILIKE)
  4. Hybrid union: chunks som matcher enten vektor ELLER tekst
  5. Per-chunk: beregn cosine sim + 6 re-ranking signaler
  6. Normaliser + kombiner: `recall×sim + precision×rerank + latency×lat`
  7. Grupper per dokument, maks 10 chunks per dok
  8. Returner sortert etter final score

**Stoppord-filtrering:**
- Ref: `_load_stopwords()` linje 75-96 — norske stoppord (JSON-fil)
- Filtrerer søkeord før term/heading-matching (embedding bruker hele queryen)

**Tall-bonus:**
- Ref: linje 528-539 — bonus for treff på standardnumre, straff for feil nummer
- Viktig for NS 8405/8406/8407-søk

### Fase 3: Settings + LLM-integrasjon (RAG)

**Settings-modell:**
- Ref: `Settings` dataclass i `settings_service.py` linje 17-67
- Ny tabell `ai_sok_innstillinger` eller JSON i prosjekt:

```typescript
interface AiSokInnstillinger {
  // Embedding
  embeddingProvider: "openai" | "azure" | "local";
  embeddingModel: string; // "text-embedding-3-small" | "all-MiniLM-L6-v2" | "ltgoslo/norbert2"
  embeddingApiKey?: string;

  // LLM (RAG)
  llmProvider: "none" | "claude" | "openai";
  llmModel: string; // "claude-sonnet-4-5"
  llmApiKey?: string;

  // Søkevekter
  recall: number;    // 0.0-1.0 — vekt på semantisk likhet
  precision: number; // 0.0-1.0 — vekt på eksakt matching
  latency: number;   // 0.0-1.0 — vekt på dokumentstørrelse

  // Re-ranking vekter
  phraseWeight: number;  // default 0.08
  termWeight: number;    // default 0.03
  qualityWeight: number; // default 0.03
  headingWeight: number; // default 0.08
  bm25Weight: number;    // default 0.06
  pageposWeight: number; // default 0.01
}
```

**RAG-flyt:**
- Ref: LLM-settings i `settings_service.py` linje 62-64
1. Hybrid søk → top 5 chunks
2. Bygg kontekst-streng
3. Kall LLM med system-prompt + kontekst + bruker-spørsmål
4. Vis AI-svar over søkeresultatene

**Ny router:** `aiSok` med:
- `sok` — hybrid vektor+leksikalsk med re-ranking
- `spor` — RAG (søk + LLM-svar)
- `hentInnstillinger` / `oppdaterInnstillinger`
- `genererEmbeddings` — trigger bakgrunnsprosess
- `embeddingStatus` — fremdrift

### Fase 4: Settings UI

**Ny side:** `/dashbord/oppsett/ai-sok`
- Ref: `AISettingsWindow` i `ai_settings_window.py`

- **Embedding-seksjon:** modellvalg, provider, API-nøkkel, generer/re-generer
- **LLM-seksjon:** provider, modell, API-nøkkel, test-knapp
- **Søk-seksjon:** recall/precision/latency sliders
- **Re-ranking vekter:** 6 sliders (phrase, term, quality, heading, bm25, pagepos)
- **Status:** antall chunks, embedded, pending, indeks-størrelse

### Fase 5: Testing UI

**Ny side:** `/dashbord/oppsett/ai-sok/test`
- Ref: `testing_window.py` og `ai_search_window.py`

- Søkefelt med modus-velger (direkte/AI/RAG)
- Resultat med score-breakdown (sim, re_rank, latency — alle 3 komponenter)
- Per-chunk detaljer: 6 signal-verdier synlige
- Chunk-browser: bla gjennom chunks, se embedding-state
- DB-diagnostikk: rader per tabell, embedding-dekning
- SQL-logg: vise genererert SQL og parametere (ref: ai_search_sql.log)

### Fase 6: Bedre chunking

**Filtype-spesifikk chunking:**
- Ref: `src/services/chunking/` i Fil til database-kopi
- Ref: `src/pipeline/profiles/` — profilbasert prosessering

| Filtype | Strategi | Spesialfelt |
|---------|----------|-------------|
| PDF (kontrakt/NS 8405-7) | Seksjonsbasert (punkt-hierarki bevares) | heading_number, section_level |
| PDF (endring/varsel) | Dokumentbasert (hele brevet som kontekst) | dato, referanse, part |
| PDF (NS 3420) | Seksjonsbasert (omfang, materialer, utførelse) | ns_code, ns_section_type |
| PDF (generell) | Sliding window 180 ord, 40 overlap | section_title, page |
| Excel (generell) | Rad-basert med header-kontekst | — |
| GAB | Post-basert (postnr + NS-kode + beskrivelse) | ns_code |

## Prioriterte dokumenttyper for AI-søk

A-nota, dokumentasjon og poster håndteres allerede godt i økonomi-modulen (spec-poster, splitting, NS-kode-kobling). AI-søk skal fokusere på dokumenter som krever forståelse:

| Prioritet | Dokumenttype | Hvorfor |
|-----------|-------------|---------|
| **Høy** | Kontraktsgrunnlag (NS 8405/8406/8407) | Juridisk bindende, lange tekster, krever kontekstforståelse |
| **Høy** | Endringer og varsler | Tidskritiske, må finnes raskt, ofte refererer til kontrakt |
| **Høy** | T-nota (tillegg/fradrag) | Krever kobling til kontrakt og endringsoversikt |
| **Høy** | NS 3420 standardtekster | Allerede importert, trenger semantisk søk for kode-oppslag |
| **Medium** | Møtereferat | Beslutninger og avtaler som må gjenfinnes |
| **Medium** | Mengdebeskrivelser | Allerede i økonomi, men beskrivelsestekst trenger AI |
| **Lav** | A-nota/målebrev | Allerede godt håndtert i økonomi (splitting, poster, header) |

## Teknologivalg

| Komponent | SiteDoc | Fil til database-kopi (referanse) |
|-----------|---------|-----------------------------------|
| Embedding (sky) | OpenAI `text-embedding-3-small` | `AzureOpenAIEmbedding` (1536 dim) |
| Embedding (lokal) | `@xenova/transformers` (ONNX i Node) | `LocalEmbedding` (SentenceTransformer/NorBERT) |
| Vektor-søk | `pgvector` (PostgreSQL-utvidelse) | FAISS (lokal) / Azure AI Search (sky) |
| Re-ranking | 6 signaler (portet fra Python) | `ai_search.py` (6 signaler + normalisering) |
| LLM | Anthropic Claude API | Claude/OpenAI via settings |
| Vektor-dimensjon | 1536 (OpenAI) / 384 (MiniLM) / 768 (NorBERT) | Samme |

## Avhengigheter

- `pgvector` — PostgreSQL-utvidelse (apt install postgresql-17-pgvector)
- `@anthropic-ai/sdk` — Claude API-klient
- `@xenova/transformers` — lokal embedding (valgfri)
- `openai` — OpenAI embedding/LLM (valgfri)

## Rekkefølge

1. **pgvector + embedding_vector kolonne** — infrastruktur
2. **Embedding-service med OpenAI** — raskest å starte med
3. **Hybrid søk med 6 re-ranking signaler** — porter fra ai_search.py
4. **Settings UI** — modellvalg, API-nøkkel, vekter
5. **RAG med Claude** — AI-svar basert på kontekst
6. **Testing UI** — diagnostikk, score-breakdown
7. **Bedre chunking** — filtype-spesifikk
