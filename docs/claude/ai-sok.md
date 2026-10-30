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
- **Manuell kjøring og stopp er prosjekt-scopet** (ORDRE 7 A3, 2026-10-30): `aiSok.genererEmbeddings` starter `startEmbeddingGenerering` for ett prosjekt (én kjøring om gangen i prosessen, `_prosesserer`). `aiSok.stoppEmbeddings` kaller `stoppEmbeddingGenerering(projectId)`, som bare setter stoppsignalet når den pågående kjøringen gjelder samme prosjekt (`_aktivtProsjekt`), og returnerer `{ stoppet }` sant/usant. Før stoppet admin i ett prosjekt kjøringen uansett prosjekt. Stoppen virker etter pågående batch. Den automatiske embeddingen pr. dokument (`embeddDokumentChunks`) har aldri lest stoppsignalet. Regresjonsvakt: `embedding-stopp-prosjekt.test.ts`.
- **Felles NorBERT-kø** (`EMBEDDING_SAMTIDIG`, default 2, env-overstyrbar, `embedding-service.ts`, `fix/norbert-ko` 2026-10-16): batch-embedding fyres fire-and-forget pr. dokument UTENFOR `kjørMedGrense(…,2)`, så antall samtidige HTTP-kall mot NorBERT var ubundet — 32 dok / ~190 chunks overbelastet NorBERT på test tross retry (31 røde). Fiks: en prosess-global tellende semafor (`Semafor`-klassen) rundt selve batch-HTTP-kallene (`kallNorBERT` /embed + `kallMultilingualE5` /embed/model passage), så maks `EMBEDDING_SAMTIDIG` batch-kall er i flukt samtidig uansett hvor mange dokumenter som kjører. Kø-ventetid teller IKKE mot 30 s-timeouten (slotten tas FØR `fetchMedTimeout`), og backoff mellom forsøk skjer utenfor slotten. **Query-embedding (`encodeQueryLokal`/`blokkSok`) går BEVISST utenom køen** — egen kort sti, så søk aldri står i kø bak en stor jobb. Regresjonsvakt: `embedding-ko.test.ts` (N samtidige jobber → aldri > grensen i flukt). ⚠️ **Semaforen er PROSESS-global, ikke host-global.** Embedding kan kjøre i BÅDE api-prosessen (oppstarts-løkka/recovery) og web-prosessen (reprosessering starter in-process i Next-serveren) — to separate Node-prosesser, hver med sin egen `Semafor`-instans. Samlet samtidighet mot NorBERT er derfor inntil **2 × `EMBEDDING_SAMTIDIG`** når begge prosessene embedder samtidig. Default 2 gir da opptil 4 samtidige batch-kall. Tåler ikke NorBERT 4, settes `EMBEDDING_SAMTIDIG=1` i api- OG web-containerens env (kalibreres mot last på test). `lesEmbeddingSamtidig` (`fix/norbert-ko-rester` 2026-10-16): en ikke-numerisk / `< 1` env-verdi gir ellers `NaN`/deadlock (semafor `aktive < NaN` alltid usann → evig kø) — den faller nå til default 2 med en advarsel i loggen i stedet.
- **Recovery:** Stuck `processing`-chunks settes tilbake til `pending` ved API-oppstart
- **Query-embedding i søket** (`encodeQueryLokal` i `ai-sok-service.ts`, `fix/sok-embedding-timeout` 2026-10-15): INTERAKTIVT kall (bruker venter), så det gjenbruker `fetchMedTimeout` med kort timeout (`QUERY_EMBEDDING_TIMEOUT_MS` = 8 s) og INGEN retry — til forskjell fra batch-embeddingens 30 s + backoff. Svarer ikke NorBERT innen fristen, avbrytes kallet og `hybridSok` faller til rent tekstsøk (tsvector) og returnerer `{ treff, aiSøkUtilgjengelig: true }`. Klienten (`sok/page.tsx`) viser da den synlige merknaden `sok.fallbackVarsel` («AI-søk ikke tilgjengelig — viser tekstsøk») i stedet for en hengende spinner eller stille «AI»-treff. Rotårsak: rå `fetch` uten tidsavbrudd hang søket for alltid når NorBERT ikke svarte (funn under `fix/reprosessering-robust`). Regresjonsvakt: `sok-embedding-timeout.test.ts`.

## Filtyper og reprosessering

Tekstuttrekk skjer i `apps/api/src/services/ftd-prosessering.ts` (`prosesserDokument`). Støttede filtyper (`STOTTEDE_FILTYPER`): `.pdf`, `.xlsx`/`.xls`, `.xml`, `.csv`, `.gab`/`.ga1`, `.docx`.

- **PDF — side-attribusjon** (`ekstraherPdfSider`, 2026-10-14): tekst hentes PR. SIDE via `pdfjs-dist` (`getDocument` + `page.getTextContent` pr. side), så sann `pageNumber` fanges direkte (ingen gjetting av sidegrenser i teksten). Erstatter tidligere `resultat.text.split("\f")`, som aldri traff fordi sidene ikke skilles med form-feed → *alle* PDF-er havnet på «side 1» (prod-feil 2026-10-14). **Parser byttet FRA `pdf-parse@1.1.1` (bundler pdf.js v1.10.100, 2018) TIL `pdfjs-dist` 4.x** (test-feil 2026-10-14, `fix/reekstraksjon-xref`): gamle pdf.js holder muterbar PROSESS-GLOBAL tilstand — ett parse i en fersk prosess er stabilt, men flere PDF-er i samme langlevde api/web-prosess (sekvensielt ELLER samtidig, som bulk-reekstraksjonen) ødelegger hverandres tilstand og gir intermitterende «bad XRef entry» + stille sidetap. `pdfjs-dist` er re-entrant-trygt pr. `getDocument` (samme motor som `ekstraherPdfMedPosisjoner`). Regresjonsvakt: `ftd-reekstraksjon-xref.test.ts` + `pdf-parse-import.test.ts`. Tekstuttrekket pr. side beholder samme Y-baserte linjeskift som før. OCR-fallbacken (`ocrPdf`, skannede PDF-er uten tekstlag) og `harTilstrekkeligTekst`-terskelen er uendret. Eksisterende dokumenter får riktig side først ved **reprosessering** (se under).
- **DOCX** (`prosesserDocx` / `ekstraherDocxChunks`, 2026-10-14): `mammoth.convertToHtml` → overskrifter `<h1>`–`<h6>` blir `sectionTitle`/`sectionLevel`, avsnitt/lister/tabellceller blir chunk-tekst. Samme `ftd_document_chunks`-format som PDF (`profile: "docx"`, `pageNumber: null`). `search_vector`-triggeren fyller fulltekst-indeksen automatisk, så DOCX blir søkbart umiddelbart. Gammelt binært `.doc` håndteres ikke. **Zip-bomb-vern (RETUR 2):** DOCX gis ALDRI rått til mammoth (jszip pakker ut hele arkivet FØR noen sjekk → OOM), og de deklarerte størrelsene i ZIP-katalogen kan forfalskes. I stedet pakker `pakkUtDocxTrygg` ut hver entry SELV med et hardt byte-budsjett (`inflateRawSync` + `maxOutputLength` avbryter og kaster idet 50 MB-budsjettet nås — allokeringen er bundet til budsjettet uansett hva katalogen lyver om), og bygger en ren STORED-ZIP (ærlige størrelser + CRC) av de verifiserte entriene som mates til mammoth. Bombe/ugyldig ZIP → kast → `processingState=failed` med synlig melding i fillista.
- **Ikke-støttet format** (gammelt `.doc`, `.rtf` m.m.): settes `processingState: "unsupported"` med synlig status i fillista (`mapper/page.tsx`) — ikke stille `completed` med 0 chunks. Melding: «lagre som .docx eller PDF».
- **Reprosessering:** `mappe.reprosesserDokument` (pr. dokument), `mappe.reprosesserMappe` (pr. mappe) og `mappe.reprosesserProsjekt` (pr. prosjekt, ny 2026-10-14). Standard: full re-ekstraksjon kun der søkbart innhold mangler (0 chunks eller `failed`), ellers kun re-embedding; `pending`/`processing`/`unsupported` hoppes over. Idempotent — `prosesserDokument` sletter chunks/poster før ny kjøring. Økonomi-visningen bruker `mengde.reprosesser` pr. dokument.
- **Tvungen reekstraksjon** (`tvingReekstraksjon: true` på alle tre mutasjonene, 2026-10-14): tvinger full ny kjøring (tekstuttrekk + chunking + embedding) fra lagret fil selv for `completed` dokumenter med chunks — veien til å rette eksisterende PDF-er som står på feil sidetall («side 1» overalt) UTEN ny opplasting. **Atomisk:** `prosesserDokument(..., { bevarVedFeil: true })` beholder de gamle chunkene til ny ekstraksjon har lykkes (mulig fordi `ftd_document_chunks` ikke har unik `(document_id, chunk_index)`); feiler reekstraksjonen (eller gir den 0 nye chunks) beholdes de gamle og dokumentet står igjen `completed` med synlig `processingError` — ingen stille tomhet. For et helt prosjekt kjører en prosjektadmin det fra UI-et: knappen **«Prosesser alle dokumenter på nytt»** på Mapper-siden (`apps/web/.../mapper/page.tsx`, gated på `useKanManageField`, bekreftelse i `Modal`) kaller `mappe.reprosesserProsjekt({ projectId, tvingReekstraksjon: true })` i api-prosessen (riktig uploads-volum + `NORBERT_URL`). Teksten sier «dokumenter», ikke «PDF-er», fordi tvungen reekstraksjon kjører full ny kjøring på ALLE aktive dokumenter (også DOCX). Bulk-kjøringen prosesserer maks `REEKSTRAKSJON_SAMTIDIG` (2) dokumenter om gangen (`mappe.ts`); status pr. dokument synes i fillista mens køen tømmes. **Samlet fremdrift** (2026-10-15): `mappe.reprosesseringStatus` (prosjekt-nivå query, ingen migrering) driver teksten «Prosesserer N av M …» mens noe kjører og «Ferdig: X ok, Y feilet» etterpå, og holder knappen deaktivert mens `pågår > 0` — utledet fra DB-radene, så den overlever sideoppdatering. **Strandet-vern** (`reprosessering.ts`, RETUR 2026-10-15): et dokument som henger i `pending`/`processing` uten fremdrift i > `STRANDET_MS` (15 min — prosess-crash) regnes IKKE som «pågår» (ellers evig deaktivert knapp), vises rødt «Avbrutt – prosesser på nytt» (`erStrandet`), og plukkes opp igjen av reprosesseringen (`utenAktivtKjørendeWhere` inkluderer strandede, ekskluderer ferske kjørende). **Livstegn** (RETUR 2, 2026-10-16): «15 min uten fremdrift = crash» holder bare fordi en LEVENDE jobb sender livstegn. `lagLivstegn` (`reprosessering.ts`) bumper `ftd_documents.updated_at = now()` throttlet (maks hvert `LIVSTEGN_THROTTLE_MS` = 30 s), kalt pr. PDF-side (`ekstraherPdfSider`), pr. OCR-batch (`ocrPdf`) og ved chunking-fasen (`prosesserPdf`). Uten dette ble en lovlig lang OCR (en stor skannet PDF OCR-er 25–50 min) feilklassifisert som strandet etter 15 min → knappen låste seg opp og et nytt klikk kunne starte et ANDRE ekstraksjonsløp på samme dokument (duplikate chunks — `ftd_document_chunks` har ingen unik `(document_id, chunk_index)`). Livstegnet er gjerdet på `processing_state='processing'`, så et sent livstegn gjenoppliver aldri et `completed`/`failed` dokument. **Embedding-fasen** kjører FØRST etter at state er satt `completed`, så den er utenfor strandet-vinduet per konstruksjon og trenger ikke livstegn. **Forsvar i dybden:** `tvingReekstraksjonAv`/`reparerDokumentSett` (`mappe.ts`) legger `utenAktivtKjørendeWhere`-vakten også på selve reset-mutasjonen (ikke bare på findMany), så et dokument med ferskt livstegn aldri nullstilles — serverside-sjekk, ikke bare UI. `prosesserDokument`-vakten (`processingState != "processing"`) er siste port. ⚠️ **TZ-merknad:** `reprosesseringStatus` (`mappe.ts`) sammenligner naken `updated_at` (`timestamp without time zone`, lagret/lest som UTC av Prisma) mot `now()` i rå SQL — korrekt kun i en UTC Postgres-sesjon (Docker-default). Den Prisma-baserte veien (`erStrandet`/`utenAktivtKjørendeWhere`) er TZ-trygg. Integrasjonstestene tvinger derfor `updated_at` via `now() AT TIME ZONE 'UTC'`.
- **GAB** (`prosesserGab` → `gab-chunker.ts`: `rensGabPostLegacy` / `rensGabSegment` / `byggGabChunker`, F2 relay 2026-10-29, branch `fix/sok-visning`): fila er binær med null-skilte segmenter (posttekst, GUID-er, RTF-blokker, rekker av RTF-kontrollord uten mellomrom). Før ble søke-chunkene bygd av **rå** segmenter mens bare post-beskrivelsene ble renset — målt 1288 av 2228 chunker med RTF/GUID i «Storgata nord.gab», og linjer på 5000 tegn uten mellomrom som sprengte høyre rute. Nå renses chunkene (`rensGabSegment`): GUID (`$<uuid>`), hele RTF-blokker (`{\rtf…}`) og segmenter uten to bokstaver forkastes; `\par` → linjeskift, `\tab` → tab, `\'xx` → tegn, øvrige kontrollord strippes. Post-beskrivelsene (`FtdPost.beskrivelse`) går fortsatt gjennom den **gamle kjeden uendret** (`rensGabPostLegacy`, flyttet ordrett fra `prosesserGab`; den stripper også `\n`/`\t` fra `\par`/`\tab`) — byte for byte som før, låst av test i `gab-chunker.test.ts` («låsetest R1», Kontrollør-gate 2 29.10). Chunker samles opp til `MAKS_CHUNK` (1500) tegn, lagret maks 5000. Kjent begrensning: RTF-blokker konverteres ikke, de hoppes over (rentekst-varianten ligger som regel i eget segment — ikke målt for hele fila). **Rens 2 (relay 2026-10-30, Kenneth-hjemmel 30.10 «Ja, 1 og 2», branch `fix/sok-ramme-gab-rens`)** — målt i «Storgata nord.gab» etter F2 (1037 chunker): «03Q» 1134 ganger (330 linjer alene, ellers linjeslutt, også rett etter siffer som «Tilstandsklasse 203Q»), «From CodeItem» 256 hele linjer, mal-plassholdere `[[DATO]]`/`[[TOTAL_SUM]]`, ensom «[», opptil 11 linjeskift på rad og forsiden («DEL III - Mengdebeskrivelse / Storgata nord / Tromsø kommune») limt inn i siste post. `rensGabSegment` fjerner nå hele linjer som bare er «03Q», «From CodeItem», «[», «]» eller `[[PLASSHOLDER]]`, stripper «03Q» ved linjeslutt (tallet i «203Q» står; «03Q» midt i linje som «03Qq»/«Kode 03QA» røres ikke — 29 målte), fjerner plassholdere inne i linjer (kun STORE bokstaver/siffer/`_` — «[[» i binærsøppel røres ikke), stripper etterslep pr. linje og kollapser ≥3 linjeskift til 2. `byggGabChunker` legger et mal-/forsidesegment (`erMalSegment`: rått segment med plassholder) som egen chunk, aldri inn i posten før — antakelse: forsidelinjene ligger i samme null-skilte segment som plassholderen (Storgata-fila finnes bare på test, segmentgrensene er ikke målt lokalt). `rensGabPostLegacy` er urørt (låsetest R1 utvidet). **Eksisterende GAB-dokumenter får rene chunker først ved reprosessering** (tvungen reekstraksjon, over) — datajobben venter på Kenneth; oppskrift i relay-leveransen 30.10. Test: `gab-chunker.test.ts` («Rens 2»).

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

Filteret sendes til **både** `aiSok.sok` og `ftdSok.sokDokumenter` (`dokumentIder`/`ekskluderMappeIder`, `sok/page.tsx`), og embedding-fallbacken `leksikalskSok` respekterer det (`ai-sok-service.ts`). Før SØK-1 gjaldt det bare AI-søket (spec S-M8/S-M9). ⚠️ Branch `fix/sok1-visning`, venter gate/merge.

## Visning av treff (SØK-1, spec `dokumentsok-visning-spec.md` S1a/S2/S4/S5)

SØK-1 merget til develop `948fe1fa`. Reparasjonene F3/F2/F1b (relay 2026-10-29) merget til develop `46b390c8` (Kontrollør GODKJENT `006778e4`). F1a-varselet merget til develop `24ddc0b1` (Kontrollør GODKJENT `9a88aed9`). Hel-avsnitt-markeringen (relay 2026-10-29 kveld) merget til develop `ea2b4090` (Kontrollør GODKJENT `6a7a9ca6`). Blokk-rammen (relay 2026-10-30) ligger på ⚠️ branch `fix/sok-ramme-gab-rens`, venter Kontrollør-gate og merge. Tester: `apps/api/src/services/{ai-sok-rangering,gab-chunker}.test.ts`, `apps/api/src/routes/ftdSok-filter.test.ts`, `apps/api/src/routes/ftdSok-tilgang.test.ts`, `apps/web/src/components/ftd-sok/__tests__/{utsnitt.test.ts,fulltekst-scroll.test.tsx,ingen-ordtreff.test.ts}`, `apps/web/src/hooks/__tests__/useHoydeTilBunn.test.ts`.

- **Utsnitt til venstre** — én funksjon for begge moduser: `byggUtsnitt` (`apps/web/src/components/ftd-sok/utsnitt.ts`). Rent semantisk treff → vindu rundt `semantiskSetning` med lilla stiplet stil; ellers server-`ts_headline` (AI-treff med ordtreff får den nå også, via `leggPaaHeadline` i `ai-sok-service.ts`, én spørring for topK); ellers vindu på ~32 ord rundt første søkeord; ellers starten + «…». «…» der utsnittet er kuttet. `sectionTitle` fjernes fra starten av utsnittet (står som etikett). Etikett «side N» **eller** «avsnitt N» (`posisjonsEtikett`), aldri begge.
- **Høyre rute** (`fulltekst.tsx`) — hver chunk har anker `data-chunk=<chunkIndex>`; valgt treff rulles dit (`finnScrollMål` + `rullTilChunk`, luft `RULLE_MARG` = 96 px), også DOCX uten sidetall. Ordtreff i valgt chunk markeres `MARK_VALGT_KLASSE` (amber + ramme), øvrige `MARK_KLASSE` (gul). Sidehode `ftdSok.sideHode`. **F3 (relay 2026-10-29):** `rullTilChunk` ruller KUN nærmeste `[data-rullebeholder]` (høyre rute i `sok/page.tsx`) med `scrollTo`, aldri `scrollIntoView` — den rullet alle forfedre inkl. `main`, så søkefelt og treffliste forsvant (målt i test.sitedoc.no 29.10: siden var 174 892 px høy). Sidehøyden måles av `useHoydeTilBunn` (`apps/web/src/hooks/useHoydeTilBunn.ts`: avstand fra sidens topp til `main` sin bunn, `ResizeObserver` + `resize`) fordi prosjekt-layouten gir siden auto-høyde så `h-full` aldri virket. Begge ruter har `min-w-0 break-words` (gab-chunker med tusentegns ord sprengte bredden før F2).
- **Mikro-chunker ut (F1b, `hybridSok` i `ai-sok-service.ts`, relay 2026-10-29):** en rent semantisk kandidat (`kilde === "vektor"`) med under `MIN_CHUNK_TEGN` (20) tegn forkastes før rangering — «— | |» fikk sim 0,906 på «dagmulkt» og toppet lista. Kandidater med ordtreff (`leksikalsk`/`begge`) beholdes uansett lengde. Terskelen `SIM_TERSKEL` (0,30) er urørt (F1c venter på Kenneth). Test: «F1b» i `ai-sok-rangering.test.ts`.
- **Varsel «ingen ordtreff» (F1a, relay 2026-10-29, Kenneth-hjemmel 29.10, `fix/sok-ingen-ordtreff-varsel`):** når ALLE viste treff er rent semantiske (`metode === "semantisk"` på hvert treff), viser `sok/page.tsx` en grå merknad under søkefeltet: `sok.ingenOrdtreff` («Ingen dokumenter inneholder ordet «{{ord}}». Viser {{antall}} avsnitt med lignende innhold.»). Beslutningsregelen er ren: `ingenOrdtreff(treff)` (`apps/web/src/components/ftd-sok/ingen-ordtreff.ts`) — sann bare for ikke-tom liste der hvert treff er semantisk; tom liste, leksikalsk fallback (treff uten `metode`), lasting, `brukFallback` og `aiUtilgjengelig` gir aldri varsel (fallback-varselet dekker de to siste). Rotårsak: søk på «dagmulkt» ga en liste av vektornaboer uten at brukeren fikk vite at ordet ikke finnes i noe dokument. Ingen rangeringsendring (visning B bygges ikke). Test: `ingen-ordtreff.test.ts`. Søkesiden har ingen ?-ikon-hjelpetekst (ikke innført her).
- **Hel-avsnitt-markering (relay 2026-10-29 kveld, Kenneth-hjemmel 29.10, `fix/sok-markering-valgt-treff`):** valgt chunk i høyre rute får `VALGT_AVSNITT_KLASSE` (`fulltekst.tsx`): svak blå bakgrunn (`bg-sitedoc-secondary/10`) + 3 px strek i venstre kant (inset-skygge i `sitedoc-secondary` #3b82f6, ui-standarder.md § Fargepalett) — ikke gul (ordtreff), ikke lilla (S5). Gjelder ordtreff og semantiske treff, også uten S5-setning; bare ett avsnitt om gangen (følger `valgtChunkIndex`). **Blokk-ramme (relay 2026-10-30, Kenneth-hjemmel 30.10 «Ja, 1 og 2», `fix/sok-ramme-gab-rens`):** `velgAvsnittsklasse(tekst)` gir `VALGT_AVSNITT_BLOKK_KLASSE` (`block`, 3 px venstre `border-sitedoc-secondary`, bakgrunn, `rounded-r-md`, padding, `my-1`) når chunk-teksten slutter med linjeskift — hele avsnitt; gab-chunker ender alltid med `\n` — og det avsluttende linjeskiftet tas ut av teksten så rammen ikke får en tom linje nederst. Målt (`relay/sok-visning/blokk-ramme-for-etter.png`, Storgata nord chunk 1036): 26 klientrektangler → 1 (Kontrollør M1). Inline-fallback `VALGT_AVSNITT_KLASSE` (`box-decoration-clone`, strek/bakgrunn pr. linjefragment) brukes bare når chunken er kuttet midt i en setning (PDF-chunker etter overlapp-kapping): `display:block` ville gitt linjeskift ved chunk-grensen. Rotårsak (målt på test `e8aac60a`, Røstbakken «dagmulkt», `.gab` avsnitt 1037 + Prisskjema-2.pdf side 1): alle ni treff kom fra serveren med `semantiskSetning: null` (`hybridSok` → `finnBesteSetning` gir null når ingen setning inneholder søkeordet/stammen — rent vektortreff), og klienten viser da verken etikett eller lilla setning. Hypotesen «normaliserte mellomrom bryter `indexOf`» er avkreftet: `delISetninger` deler bare på linjeskift og trimmer, så setningen er alltid eksakt delstreng (låsetest i `ai-sok-rangering.test.ts`). Ingen rangeringsendring. Test: «Hel-avsnitt-markering» i `fulltekst-scroll.test.tsx`.
- **Semantiske treff** — `finnBesteSetning` (`ai-sok-service.ts`): setning med flest ordstart-treff på søketermer (frase ×2, term ×1, stamme ×0,5), likt → tidligste, ingen overlapp → `null` (utsnitt fra start, ingen setningsmarkering — avsnittet markeres likevel, se over). Setningsdeling hopper over forkortelser («pr.», «ca.», «jf.» …). Ingen ny modell. «Begge»/«tekst» får alltid gult, aldri semantisk stil.
- **Rangering** — leksikalsk kandidatuttak i `hybridSok` har `ORDER BY ts_rank(...) DESC, c.id` før `LIMIT kandidatK`. ILIKE-fallbacken i `ftdSok.sokDokumenter` rangerer på antall ikke-overlappende forekomster av søkestrengen i chunken (`(length(lower(tekst)) − length(replace(lower(tekst), q, ''))) / length(q)`), likhet → filnavn, chunkIndex, id. `bm25Weight`/`qualityWeight` fjernet (ubrukt). Filnavn-bonusen uendret (Q3: vent på måling).

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
