# AI-søk — Plan for intelligent dokumentsøk

## Nåværende tilstand

- tsvector (norsk stemming) + ILIKE-fallback
- Chunking: 1500 tegn, 100 overlap — likt for alle filtyper
- `embeddingState`-kolonne finnes på FtdDocumentChunk (pending/done), ingen kode
- `embedding_vector`-kolonne mangler (må legges til)
- Excel-chunks er dårlige (repeterende celler)

## Mål

Portering av "fil til database"-arkitekturen til SiteDoc web:
1. **Embedding-generering** — bakgrunnsprosess som vektoriserer chunks
2. **Hybrid søk** — vektor (cosine similarity) + leksikalsk (tsvector) + re-ranking
3. **LLM-integrasjon** — Claude/OpenAI for ekte AI-søk (RAG)
4. **Settings UI** — velg modell, LLM-provider, API-nøkkel, søkeparametere
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
│ 5. Re-ranking: frase, BM25, sidebonus, heading-match    │
│ 6. Valgfri: RAG — send top-5 chunks til LLM → svar     │
│ 7. Vis resultater gruppert per dokument                 │
└─────────────────────────────────────────────────────────┘
```

## Steg-for-steg implementering

### Fase 1: Embedding-infrastruktur

**Database:**
- Legg til `embedding_vector bytea` på `ftd_document_chunks`
- Legg til indeks for embedding_state

**Embedding-modell:**
- Start med `all-MiniLM-L6-v2` (384 dim, rask, god kvalitet)
- Alternativ: `text-embedding-3-small` via OpenAI/Azure (1536 dim)
- Node.js: bruk `@xenova/transformers` (ONNX i Node) eller kall eksternt API

**Bakgrunnsprosess:**
- Ny service: `apps/api/src/services/embedding-service.ts`
- Hent chunks med `embeddingState = 'pending'`, batch à 64
- Generer embedding → lagre som bytea → sett state = 'done'
- Nytt Fastify-endepunkt: `POST /embeddings/generate` (trigger)
- Fremdriftslogging

### Fase 2: Vektor-søk

**In-memory indeks:**
- FAISS via `faiss-node` npm-pakke, eller
- `pgvector` PostgreSQL-utvidelse (enklere, ingen ekstra prosess)
- pgvector: `CREATE INDEX ON ftd_document_chunks USING ivfflat (embedding_vector vector_cosine_ops)`

**Hybrid søk-endepunkt:**
- Oppdater `ftdSok.sokDokumenter`:
  1. Encode query → vektor
  2. pgvector: `ORDER BY embedding_vector <=> query_vector LIMIT 300`
  3. tsvector: eksisterende søk
  4. Union + re-rank

### Fase 3: LLM-integrasjon (RAG)

**Settings-modell (ny tabell eller JSON):**
```
{
  embeddingProvider: "local" | "openai" | "azure",
  embeddingModel: "all-MiniLM-L6-v2",
  llmProvider: "none" | "claude" | "openai",
  llmModel: "claude-sonnet-4-5",
  llmApiKey: "sk-...",
  searchWeights: { phrase: 0.3, term: 0.3, quality: 0.2, bm25: 0.2 }
}
```

**RAG-flyt:**
1. Hybrid søk → top 5 chunks
2. Bygg kontekst-streng
3. Kall LLM med system-prompt + kontekst + bruker-spørsmål
4. Vis AI-svar over søkeresultatene

**Ny router:** `aiSok` med:
- `sok` — hybrid vektor+leksikalsk
- `spor` — RAG (søk + LLM-svar)
- `hentInnstillinger` / `oppdaterInnstillinger`
- `genererEmbeddings` — trigger bakgrunnsprosess
- `embeddingStatus` — fremdrift

### Fase 4: Settings UI

**Ny side:** `/dashbord/oppsett/ai-sok`

- **Embedding-seksjon:** modellvalg, provider, generer/re-generer
- **LLM-seksjon:** provider, modell, API-nøkkel, test-knapp
- **Søk-seksjon:** vekter (sliders), recall/precision
- **Status:** antall chunks, embedded, pending, indeks-størrelse

### Fase 5: Testing UI

**Ny side:** `/dashbord/oppsett/ai-sok/test`

- Søkefelt med modus-velger (direkte/AI/RAG)
- Resultat med score, chunk-tekst, metadata
- Chunk-browser: bla gjennom chunks, se embedding-state
- DB-diagnostikk: rader per tabell, embedding-dekning

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

## Filtyper → bedre chunking

| Filtype | Strategi | Spesialfelt |
|---------|----------|-------------|
| PDF (kontrakt/NS 8405-7) | Seksjonsbasert (punkt-hierarki bevares) | heading_number, section_level |
| PDF (endring/varsel) | Dokumentbasert (hele brevet som kontekst) | dato, referanse, part |
| PDF (NS 3420) | Seksjonsbasert (omfang, materialer, utførelse) | ns_code, ns_section_type |
| PDF (generell) | Sliding window 180 ord, 40 overlap | section_title, page |
| Excel (generell) | Rad-basert med header-kontekst | — |
| GAB | Post-basert (postnr + NS-kode + beskrivelse) | ns_code |

## Teknologivalg

| Komponent | Anbefaling | Alternativ |
|-----------|-----------|------------|
| Embedding (lokal) | `@xenova/transformers` (ONNX i Node) | Eksternt API |
| Embedding (sky) | OpenAI `text-embedding-3-small` | Azure OpenAI |
| Vektor-DB | `pgvector` (PostgreSQL-utvidelse) | FAISS via faiss-node |
| LLM | Anthropic Claude API | OpenAI API |
| Vektor-dimensjon | 384 (MiniLM) / 1536 (OpenAI) | 768 (NorBERT) |

## Avhengigheter

- `pgvector` — PostgreSQL-utvidelse (apt install postgresql-17-pgvector)
- `@anthropic-ai/sdk` — Claude API-klient
- `@xenova/transformers` — lokal embedding (valgfri)
- `openai` — OpenAI embedding/LLM (valgfri)

## Rekkefølge

1. **pgvector + embedding_vector kolonne** — infrastruktur
2. **Embedding-service med OpenAI** — raskest å starte med
3. **Hybrid søk** — vektor + tsvector
4. **Settings UI** — modellvalg, API-nøkkel
5. **RAG med Claude** — AI-svar basert på kontekst
6. **Testing UI** — diagnostikk
7. **Bedre chunking** — filtype-spesifikk
