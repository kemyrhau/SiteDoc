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
- **Automatisk:** Nye chunks embeddes automatisk etter prosessering (`embeddDokumentChunks` i `embedding-service.ts`, fire-and-forget via HTTP mot `NORBERT_URL`; den gamle Python-subprosessen ble fjernet i D, 2026-10-14). **Robust mot forbigående feil** (2026-10-15, `fix/reprosessering-robust`): `fetchMedTimeout` (AbortController, 30 s) + `medRetry` (3 forsøk, eksponentiell backoff) forsøker på nytt ved forbigående feil (timeout/5xx/429/nettverk) — permanente (4xx) forsøkes ikke. Lykkes ikke embeddingen, settes chunkene til synlig `embedding_state='failed'` (rød prikk i fillista), ALDRI stille `pending`. Rotårsak for retten: bulk-reekstraksjon (2 dok samtidig) overbelastet NorBERT forbigående, og uten nytt forsøk ble dokumentene stående røde til manuelt ↻ (prod 2026-10-15). Fulltekst-søk (tsvector) virker uansett uten embedding.
- **Recovery:** Stuck `processing`-chunks settes tilbake til `pending` ved API-oppstart

## Filtyper og reprosessering

Tekstuttrekk skjer i `apps/api/src/services/ftd-prosessering.ts` (`prosesserDokument`). Støttede filtyper (`STOTTEDE_FILTYPER`): `.pdf`, `.xlsx`/`.xls`, `.xml`, `.csv`, `.gab`/`.ga1`, `.docx`.

- **PDF — side-attribusjon** (`ekstraherPdfSider`, 2026-10-14): tekst hentes PR. SIDE via `pdfjs-dist` (`getDocument` + `page.getTextContent` pr. side), så sann `pageNumber` fanges direkte (ingen gjetting av sidegrenser i teksten). Erstatter tidligere `resultat.text.split("\f")`, som aldri traff fordi sidene ikke skilles med form-feed → *alle* PDF-er havnet på «side 1» (prod-feil 2026-10-14). **Parser byttet FRA `pdf-parse@1.1.1` (bundler pdf.js v1.10.100, 2018) TIL `pdfjs-dist` 4.x** (test-feil 2026-10-14, `fix/reekstraksjon-xref`): gamle pdf.js holder muterbar PROSESS-GLOBAL tilstand — ett parse i en fersk prosess er stabilt, men flere PDF-er i samme langlevde api/web-prosess (sekvensielt ELLER samtidig, som bulk-reekstraksjonen) ødelegger hverandres tilstand og gir intermitterende «bad XRef entry» + stille sidetap. `pdfjs-dist` er re-entrant-trygt pr. `getDocument` (samme motor som `ekstraherPdfMedPosisjoner`). Regresjonsvakt: `ftd-reekstraksjon-xref.test.ts` + `pdf-parse-import.test.ts`. Tekstuttrekket pr. side beholder samme Y-baserte linjeskift som før. OCR-fallbacken (`ocrPdf`, skannede PDF-er uten tekstlag) og `harTilstrekkeligTekst`-terskelen er uendret. Eksisterende dokumenter får riktig side først ved **reprosessering** (se under).
- **DOCX** (`prosesserDocx` / `ekstraherDocxChunks`, 2026-10-14): `mammoth.convertToHtml` → overskrifter `<h1>`–`<h6>` blir `sectionTitle`/`sectionLevel`, avsnitt/lister/tabellceller blir chunk-tekst. Samme `ftd_document_chunks`-format som PDF (`profile: "docx"`, `pageNumber: null`). `search_vector`-triggeren fyller fulltekst-indeksen automatisk, så DOCX blir søkbart umiddelbart. Gammelt binært `.doc` håndteres ikke. **Zip-bomb-vern (RETUR 2):** DOCX gis ALDRI rått til mammoth (jszip pakker ut hele arkivet FØR noen sjekk → OOM), og de deklarerte størrelsene i ZIP-katalogen kan forfalskes. I stedet pakker `pakkUtDocxTrygg` ut hver entry SELV med et hardt byte-budsjett (`inflateRawSync` + `maxOutputLength` avbryter og kaster idet 50 MB-budsjettet nås — allokeringen er bundet til budsjettet uansett hva katalogen lyver om), og bygger en ren STORED-ZIP (ærlige størrelser + CRC) av de verifiserte entriene som mates til mammoth. Bombe/ugyldig ZIP → kast → `processingState=failed` med synlig melding i fillista.
- **Ikke-støttet format** (gammelt `.doc`, `.rtf` m.m.): settes `processingState: "unsupported"` med synlig status i fillista (`mapper/page.tsx`) — ikke stille `completed` med 0 chunks. Melding: «lagre som .docx eller PDF».
- **Reprosessering:** `mappe.reprosesserDokument` (pr. dokument), `mappe.reprosesserMappe` (pr. mappe) og `mappe.reprosesserProsjekt` (pr. prosjekt, ny 2026-10-14). Standard: full re-ekstraksjon kun der søkbart innhold mangler (0 chunks eller `failed`), ellers kun re-embedding; `pending`/`processing`/`unsupported` hoppes over. Idempotent — `prosesserDokument` sletter chunks/poster før ny kjøring. Økonomi-visningen bruker `mengde.reprosesser` pr. dokument.
- **Tvungen reekstraksjon** (`tvingReekstraksjon: true` på alle tre mutasjonene, 2026-10-14): tvinger full ny kjøring (tekstuttrekk + chunking + embedding) fra lagret fil selv for `completed` dokumenter med chunks — veien til å rette eksisterende PDF-er som står på feil sidetall («side 1» overalt) UTEN ny opplasting. **Atomisk:** `prosesserDokument(..., { bevarVedFeil: true })` beholder de gamle chunkene til ny ekstraksjon har lykkes (mulig fordi `ftd_document_chunks` ikke har unik `(document_id, chunk_index)`); feiler reekstraksjonen (eller gir den 0 nye chunks) beholdes de gamle og dokumentet står igjen `completed` med synlig `processingError` — ingen stille tomhet. For et helt prosjekt kjører en prosjektadmin det fra UI-et: knappen **«Prosesser alle dokumenter på nytt»** på Mapper-siden (`apps/web/.../mapper/page.tsx`, gated på `useKanManageField`, bekreftelse i `Modal`) kaller `mappe.reprosesserProsjekt({ projectId, tvingReekstraksjon: true })` i api-prosessen (riktig uploads-volum + `NORBERT_URL`). Teksten sier «dokumenter», ikke «PDF-er», fordi tvungen reekstraksjon kjører full ny kjøring på ALLE aktive dokumenter (også DOCX). Bulk-kjøringen prosesserer maks `REEKSTRAKSJON_SAMTIDIG` (2) dokumenter om gangen (`mappe.ts`); status pr. dokument synes i fillista mens køen tømmes. **Samlet fremdrift** (2026-10-15): `mappe.reprosesseringStatus` (prosjekt-nivå query, ingen migrering) driver teksten «Prosesserer N av M …» mens noe kjører og «Ferdig: X ok, Y feilet» etterpå, og holder knappen deaktivert mens `pågår > 0` — utledet fra DB-radene, så den overlever sideoppdatering. **Strandet-vern** (`reprosessering.ts`, RETUR 2026-10-15): et dokument som henger i `pending`/`processing` uten fremdrift i > `STRANDET_MS` (15 min — prosess-crash) regnes IKKE som «pågår» (ellers evig deaktivert knapp), vises rødt «Avbrutt – prosesser på nytt» (`erStrandet`), og plukkes opp igjen av reprosesseringen (`utenAktivtKjørendeWhere` inkluderer strandede, ekskluderer ferske kjørende). **Livstegn** (RETUR 2, 2026-10-16): «15 min uten fremdrift = crash» holder bare fordi en LEVENDE jobb sender livstegn. `lagLivstegn` (`reprosessering.ts`) bumper `ftd_documents.updated_at = now()` throttlet (maks hvert `LIVSTEGN_THROTTLE_MS` = 30 s), kalt pr. PDF-side (`ekstraherPdfSider`), pr. OCR-batch (`ocrPdf`) og ved chunking-fasen (`prosesserPdf`). Uten dette ble en lovlig lang OCR (en stor skannet PDF OCR-er 25–50 min) feilklassifisert som strandet etter 15 min → knappen låste seg opp og et nytt klikk kunne starte et ANDRE ekstraksjonsløp på samme dokument (duplikate chunks — `ftd_document_chunks` har ingen unik `(document_id, chunk_index)`). Livstegnet er gjerdet på `processing_state='processing'`, så et sent livstegn gjenoppliver aldri et `completed`/`failed` dokument. **Embedding-fasen** kjører FØRST etter at state er satt `completed`, så den er utenfor strandet-vinduet per konstruksjon og trenger ikke livstegn. **Forsvar i dybden:** `tvingReekstraksjonAv`/`reparerDokumentSett` (`mappe.ts`) legger `utenAktivtKjørendeWhere`-vakten også på selve reset-mutasjonen (ikke bare på findMany), så et dokument med ferskt livstegn aldri nullstilles — serverside-sjekk, ikke bare UI. `prosesserDokument`-vakten (`processingState != "processing"`) er siste port. ⚠️ **TZ-merknad:** `reprosesseringStatus` (`mappe.ts`) sammenligner naken `updated_at` (`timestamp without time zone`, lagret/lest som UTC av Prisma) mot `now()` i rå SQL — korrekt kun i en UTC Postgres-sesjon (Docker-default). Den Prisma-baserte veien (`erStrandet`/`utenAktivtKjørendeWhere`) er TZ-trygg. Integrasjonstestene tvinger derfor `updated_at` via `now() AT TIME ZONE 'UTC'`.

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
