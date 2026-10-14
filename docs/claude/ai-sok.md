# AI-søk — Intelligent dokumentsøk

## Status: Implementert ✓

AI-søk er operativt med NorBERT embedding, hybrid søk og re-ranking.

## Arkitektur

```
Bruker: Søk "grøftesnitt type 2"
    ↓
1. Rens query (fjern "kan du finne", stoppord)
2. NorBERT HTTP-server (port 3302) → 768-dim embedding
3. pgvector: cosine similarity top 300 kandidater
4. tsvector: norsk fulltekstsøk (parallelt)
5. Hybrid union av vektor + leksikalsk
6. Re-ranking: 6 signaler + filnavn-boost + NS-nedvekting
7. Dedup: maks 1 chunk per dokument
8. Dokumentfilter: ekskluder/inkluder NS-standarder
9. Resultat med søkeord-highlighting
```

## Komponenter

| Komponent | Fil | Beskrivelse |
|-----------|-----|-------------|
| AI-søk service | `apps/api/src/services/ai-sok-service.ts` | Hybrid søk, re-ranking, scoring |
| Embedding service | `apps/api/src/services/embedding-service.ts` | Batch-embedding via NorBERT HTTP |
| NorBERT server | `apps/api/src/services/norbert-server.py` | Persistent Python HTTP-server (port 3302) |
| NorBERT batch | `apps/api/src/services/norbert-embed.py` | Stdin/stdout script for batch-embedding |
| AI-søk router | `apps/api/src/routes/aiSok.ts` | tRPC-endepunkter |
| Søk-side | `apps/web/.../[prosjektId]/sok/page.tsx` | UI med modusveksler og filter |
| Fulltekst | `apps/web/src/components/ftd-sok/fulltekst.tsx` | Sammenhengende tekst med highlighting |
| Treffliste | `apps/web/src/components/ftd-sok/treff-liste.tsx` | Treff med dobbelt-klikk åpne original |
| Settings UI | `apps/web/.../oppsett/ai-sok/page.tsx` | Embedding-status, modell, vekter |

## NorBERT embedding

- **Modell:** `ltgoslo/norbert2` (768 dim, optimalisert for norsk)
- **Kjøring:** Python venv (`~/norbert-env`) med torch + transformers
- **Server:** Persistent HTTP-server via PM2 (`norbert-embed`, port 3302)
- **Automatisk:** Nye filer embeddes automatisk etter prosessering (`embeddNyeChunks` i `ftd-prosessering.ts`, fire-and-forget via NorBERT Python-subprosess `norbert-embed.py`). Finnes ikke `~/norbert-env` i api-prosessen, hoppes embedding over og chunks blir stående `pending` til den manuelle løkka startes (AI-søk-innstillinger → `aiSok.genererEmbeddings`). Fulltekst-søk (tsvector) virker uansett uten embedding.
- **Recovery:** Stuck `processing`-chunks settes tilbake til `pending` ved API-oppstart

## Filtyper og reprosessering

Tekstuttrekk skjer i `apps/api/src/services/ftd-prosessering.ts` (`prosesserDokument`). Støttede filtyper (`STOTTEDE_FILTYPER`): `.pdf`, `.xlsx`/`.xls`, `.xml`, `.csv`, `.gab`/`.ga1`, `.docx`.

- **DOCX** (`prosesserDocx` / `ekstraherDocxChunks`, 2026-10-14): `mammoth.convertToHtml` → overskrifter `<h1>`–`<h6>` blir `sectionTitle`/`sectionLevel`, avsnitt/lister/tabellceller blir chunk-tekst. Samme `ftd_document_chunks`-format som PDF (`profile: "docx"`, `pageNumber: null`). `search_vector`-triggeren fyller fulltekst-indeksen automatisk, så DOCX blir søkbart umiddelbart. Gammelt binært `.doc` håndteres ikke. **Zip-bomb-vern (RETUR 1 R2):** `sjekkDocxTrygg` leser ZIP-katalogen (central directory) FØR `mammoth` og avviser på utpakket total > 50 MB eller kompresjonsforhold > 100:1 (mammoth pakker ut in-process i web → en dekompresjonsbombe ville gitt OOM for alle). Avvist fil → `failed` med synlig melding i fillista.
- **Ikke-støttet format** (gammelt `.doc`, `.rtf` m.m.): settes `processingState: "unsupported"` med synlig status i fillista (`mapper/page.tsx`) — ikke stille `completed` med 0 chunks. Melding: «lagre som .docx eller PDF».
- **Reprosessering:** `mappe.reprosesserDokument` (pr. dokument) og `mappe.reprosesserMappe` (pr. mappe — dokumenter med 0 chunks eller `failed`; hopper over `pending`/`processing`/`unsupported`). Idempotent — `prosesserDokument` sletter chunks/poster før ny kjøring. Økonomi-visningen bruker `mengde.reprosesser` pr. dokument.

## Re-ranking signaler

6 signaler beregnes per chunk med konfigurerbare vekter:

| Signal | Default | Beskrivelse |
|--------|---------|-------------|
| `phraseWeight` | 0.10 | Eksakt frase-treff i chunk-tekst |
| `termWeight` | 0.05 | Andel av søkeord funnet (normalisert 0-1) |
| `headingWeight` | 0.08 | Treff i page_heading (seksjonsoverskrift) |
| `pageposWeight` | 0.01 | Sideposisjon (side 1-3: 1.0, 4-10: 0.5) |
| `filnavnBoost` | 0.15/treff | Søkeord funnet i filnavn (maks 0.45) |
| `nsStandardStraff` | -0.15 | Nedvekting for NS-referansedokumenter |

**Tall-bonus:** +0.3 per matchende standardnummer, -0.05 per fremmed tall (maks -0.3).

**Sluttscoring:** `recall × sim_norm + precision × rerank_norm + latency × latency_norm`
- Default: recall=0.6, precision=0.4, latency=0.2

**Dev-score (`?debug` i søk-URL):** viser score pr. metode pr. treff for presisjonsanalyse. **Gaten ligger SERVER-side (RETUR 1 R1):** `aiSok.sok` fjerner `score`/`cosineSim`/`reRankScore` og `ftdSok.sokDokumenter` fjerner `rank` fra responsen med mindre brukeren er `sitedoc_admin` (`erSiteDocAdmin`) eller `NODE_ENV=development` — scorene sendes ikke og skjules ikke bare i klienten. `metode` (semantisk/tekst/begge) sendes alltid (bruker-innhold).

## Dokumentfilter

Dropdown i søk-UI med tre nivåer:
- **Prosjektdokumenter** (default) — NS-standarder ekskludert
- **Alle dokumenter** — inkluderer alt
- **Enkeltdokument** — NS 3420-A, NS 3420-F, NS 8405 etc.

Fanger automatisk opp filer med `3420`, `8405`, `8406`, `8407`, `ns-`, `NS ` i filnavnet.

## OCR-kvalitet

- **CamelCase-splitting:** "StorgataNord" → "Storgata Nord" (ved chunking)
- **OCR-søppel-filter:** Innholdsfortegnelser med repeterende bokstaver (`ssevsseev...`) filtreres ut
- **Naturlig-språk rensing:** "kan du finne", "søk etter" etc. fjernes fra query

## Database

- `embedding_vector vector(768)` på `ftd_document_chunks` med HNSW-indeks
- `ai_sok_innstillinger` tabell per prosjekt (provider, modell, API-nøkler, vekter)
- `embeddingState` kolonne: pending → processing → done

## Serveroppsett

```bash
# NorBERT Python-env
~/norbert-env/bin/python3  # torch + transformers

# PM2-prosesser
pm2 start ~/norbert-env/bin/python3 --name norbert-embed -- apps/api/src/services/norbert-server.py

# Verifiser
curl -s -X POST http://127.0.0.1:3302/embed -H 'Content-Type: application/json' -d '["test"]'
```

## Referanseimplementasjon

Portert fra Python-prosjektet `/Users/kennethmyrhaug/Documents/Programmering/Fil til database-kopi/`:

| Fil (Python) | Portert til |
|-----|------------|
| `src/services/ai_search.py` | `ai-sok-service.ts` |
| `src/backends/embedding.py` | `embedding-service.ts` + `norbert-server.py` |
| `src/backends/vector_search.py` | pgvector i PostgreSQL |
| `src/services/settings_service.py` | `ai_sok_innstillinger` DB-tabell |

## Gjenstående

- **RAG med Claude** — AI-svar basert på kontekst (fase 5)
- **Bedre chunking** — filtype-spesifikk (kontrakt vs varsel vs NS 3420)
- **Excel-chunks** — rad-basert med header-kontekst (dårlig i dag)
- **GAB encoding** — ÿ¦-tegn i GAB-filer (UTF-16 BOM)
