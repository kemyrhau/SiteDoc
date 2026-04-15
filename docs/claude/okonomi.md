# Økonomi-modul (FTD)

Modul for økonomistyring i byggeprosjekter. Håndterer kontrakter, mengdebeskrivelser (anbudsgrunnlag), A-notaer, T-notaer, avviksanalyse og dokumentsøk.

## Terminologi

| Term | Forklaring |
|------|-----------|
| **FTD** | "Fil til database" — samlebetegnelse for økonomi-modulen |
| **Anbudsgrunnlag** | Priset mengdebeskrivelse = kontraktsgrunnlag (ALDRI kall det "anbud") |
| **Mengdebeskrivelse** | Upriset dokument før prising |
| **A-nota** | Avdragsnota — periodisk faktureringsgrunnlag med mengder og verdier |
| **T-nota** | Tilleggsnota — endringsarbeider utover kontrakt |
| **Sluttnota** | Siste nota i prosjektet |
| **Spec-post** | Budsjettpost fra anbudsgrunnlag (postnr + beskrivelse + enhetspris + mengde) |
| **NS-kode** | Kode fra NS 3420-standarden (f.eks. "21.341") |
| **GAB** | Binært filformat for mengdebeskrivelser |
| **Kontrakt** | Container for dokumenter, type 8405/8406/8407 |
| **Periode** | En A-nota eller T-nota import (periodeNr) |

## Filstruktur

```
apps/web/src/
├── app/dashbord/[prosjektId]/okonomi/
│   └── page.tsx                          # Hovedside (~1400 linjer)
├── components/mengde/
│   ├── spec-post-tabell.tsx              # Budsjettpost-tabell: sortering, søk, drag-and-drop kolonner, vis/skjul
│   ├── avviksanalyse.tsx                 # Avviksanalyse: budsjett vs kontrakt
│   ├── import-dialog.tsx                 # Import-dialog: filopplasting, type-gjetting, bekreftelse
│   ├── import-sammenligning.tsx          # Side-ved-side dokumentsammenligning
│   ├── notat-editor.tsx                  # Eksternt notat per post
│   ├── ns-kode-panel.tsx                 # NS 3420-kodepanel (søk i standarddokumenter)
│   ├── merknad-eksport.tsx               # Eksporter merknader til HTML/print
│   ├── periode-velger.tsx                # Dropdown for A-nota/T-nota perioder
│   ├── entreprise-velger.tsx             # Dropdown for entrepriser
│   └── __tests__/import-hjelpere.test.ts # Tester for gjettDokType, gjettNotaNr, gjettDato

apps/api/src/
├── routes/
│   ├── mengde.ts                         # Hoveddokument-router (9 prosedyrer)
│   ├── ftdSok.ts                         # Dokumentsøk + NS-kode-router (6 prosedyrer)
│   ├── nota-import-router.ts             # Nota-import (2 prosedyrer)
│   └── kontrakt.ts                       # Kontrakt-CRUD (4 prosedyrer)
├── services/
│   ├── ftd-prosessering.ts               # Hovedprosessor: PDF, Excel, GAB, XML, CSV + budsjettoppdatering (~2800 linjer)
│   ├── nota-import.ts                    # Scenariodeteksjon + akkumuleringsvalidering (~500 linjer)
│   ├── pdf-splitting.ts                  # Splitt målebrev-PDF per NS-kode (~180 linjer)
│   ├── blokk-prosessering.ts             # Flerspråklige blokker + bildeutrekking
│   ├── embedding-service.ts              # E5-vektorisering (768-dim, flerspråklig)
│   └── spraak-deteksjon.ts               # Automatisk språkdeteksjon

packages/shared/src/types/ftd.ts          # AvviksRad, AvviksOppsummering, AvviksanalyseResultat
packages/db/prisma/schema.prisma          # 11 FTD-modeller (se "Database" under)
```

## Database-modeller

### FtdKontrakt
Container for økonomi-dokumenter per entreprise.
- `navn`, `kontraktType` (8405/8406/8407), `byggherre`, `entreprenor`
- Relasjon til `byggeplass`, `entrepriser`, `dokumenter`, `mapper`, `notaPerioder`

### FtdDocument
Hoveddokument (PDF, Excel, GAB, XML, CSV).
- `docType`: anbudsgrunnlag | mengdebeskrivelse | a_nota | t_nota | varsel | varsel_om_endring | endringsmelding | regningsarbeid | annet
- `notaType`: A-Nota | T-Nota | Sluttnota
- `processingState`: pending | processing | completed | error
- Header-verdier fra A-nota: `utfortPr`, `utfortTotalt`, `utfortForrige`, `utfortDenne`, `innestaaende`, `nettoDenne`, `mva`, `sumInkMva`
- Språk: `sourceLanguage`, `detectedLanguage`, `languageConfirmed`
- Soft delete via `isActive`-flagg

### FtdSpecPost
Budsjettpost fra anbudsgrunnlag.
- `postnr`, `beskrivelse`, `enhet`, `mengdeAnbud`, `enhetspris`, `sumAnbud`
- Fremdrift: `mengdeDenne`, `mengdeTotal`, `verdiDenne`, `verdiTotal`, `prosentFerdig`
- Annotasjon: `nsKode`, `nsTittel`, `fullNsTekst`, `eksternNotat`, `importNotat`
- Unik: (documentId, postnr)

### FtdNotaPeriod
Import av A-nota eller T-nota per periode.
- `periodeNr`, `type`, `erSluttnota`
- Dato: `periodeStart`, `periodeSlutt`
- Totaler: `totalMengdeDenne`, `totalVerdiDenne`, `totalMvaDenne`, `totalSumDenne`
- `gapFlagg` for manglende mellomperioder
- Unik: (kontraktId, periodeNr)

### FtdNotaPost
Enkelpost i en nota-periode.
- Denne periode: `mengdeDenne`, `verdiDenne`, `mvaDenne`, `sumDenne`
- Akkumulert: `mengdeTotal`, `verdiTotal`, `prosentFerdig`
- Forrige: `mengdeForrige`, `verdiForrige`
- Budsjett: `mengdeAnbud`, `enhetspris`, `sumAnbud`

### FtdDocumentChunk
Tekstblokker for fulltekstsøk.
- `chunkText` med tsvector-indeks + ILIKE-fallback
- NS-kode: `nsCode`, `headingNumber`
- Embedding: `embeddingState`, `embeddingVector` (768-dim)

### FtdDocumentBlock
Strukturerte blokker for flerspråklig dokumentvisning.
- Typer: heading, text, image, caption, table
- `language`, `sourceBlockId` (lenke til originaltekst)
- Embedding: `embeddingState`, `embeddingVector`, `embeddingModel`
- ⚠️ Ingen Prisma-relasjon til FtdDocument (unngår rekursjon, bruker rå SQL)

### FtdDocumentPage
Side-til-postnr-mapping for dokumentasjonsoppslag.
- `pageNumber`, `postnr`
- Unik: (documentId, pageNumber)

### FtdChangeEvent
Endringshendelser: varsel, varsel_om_endring, endringsmelding, regningsarbeid.
- `eventType`, `eventNumber`, `description`, `sentToBhAt`

### FtdTnotaChangeLink
Kobling mellom T-nota-dokument og endringshendelse.

### TranslationCache
Oversettelsesminne (SHA-256 hash → cachet oversettelse).

### FtdTranslationJob
Asynkron oversettelsesoppgave per dokument+språk.

## API-prosedyrer

### mengde.ts (hoveddokument)
| Prosedyre | Type | Beskrivelse |
|-----------|------|-------------|
| `hentDokumenter` | query | Hent FTD-dokumenter med filtrering (kontraktId, docType, isActive) |
| `hentPerioder` | query | Hent nota-perioder for kontrakt |
| `hentSpecPoster` | query | Hent budsjett-poster med sammenligning mot forrige nota |
| `hentAvviksanalyse` | query | Beregn avvikanalyse (budsjett vs kontrakt, første periode) |
| `lagreNotat` | mutation | Lagre eksternt notat på spec-post |
| `slettPeriode` | mutation | Slett nota-periode |
| `registrerDokument` | mutation | Opprett/reaktiver FTD-dokument, trigger prosessering |
| `reprosesser` | mutation | Reprosesser dokument (nullstill status, kjør på nytt) |
| `oppdaterDokument` | mutation | Oppdater docType, notaType, notaNr, kontraktNavn |
| `fjernFraOkonomi` | mutation | Fjern økonomi-kobling (behold i mapper, nullstill docType/nota) |
| `hentNotaRapport` | query | Nota-rapport (deduplisert per notaNr, med header-verdier) |
| `hentDokumentasjonForPost` | query | Finn PDF-sider tagget med postnr |
| `hentSplitDokumentasjon` | query | Finn splittet PDF for NS-kode |

### ftdSok.ts (dokumentsøk)
| Prosedyre | Type | Beskrivelse |
|-----------|------|-------------|
| `sokDokumenter` | query | Fulltekstsøk i chunks (tsvector + ILIKE-fallback) |
| `hentDokumentChunks` | query | Alle chunks for ett dokument (reader view) |
| `nsKoder` | query | Unike NS-koder i prosjekt (med prefiks-filter) |
| `nsChunks` | query | Chunks for spesifikk NS-kode (kryssdokument) |
| `nsStandardSok` | query | Søk i NS 3420-standarddokumenter |
| `nsKoderMedDok` | query | Batch-sjekk hvilke NS-koder har split-dokumentasjon |

### nota-import-router.ts
| Prosedyre | Type | Beskrivelse |
|-----------|------|-------------|
| `importerTilPeriode` | mutation | Importer nota → FtdNotaPeriod + poster, scenariodeteksjon |
| `hentNotaPoster` | query | Nota-poster med lenket spec-post-info |

### kontrakt.ts
| Prosedyre | Type | Beskrivelse |
|-----------|------|-------------|
| `hentForProsjekt` | query | Liste kontrakter med bygning/dokumentteller |
| `opprett` | mutation | Opprett kontrakt (type, byggherre, entreprenør, bygning) |
| `oppdater` | mutation | Oppdater kontraktfelter |
| `slett` | mutation | Slett kontrakt (kaskade, fjern fra entrepriser/dokumenter) |

## Prosesseringsflyt

### Dokumentimport
1. Bruker laster opp fil (PDF, Excel, GAB, XML, CSV)
2. `import-dialog.tsx` auto-gjetter type (`gjettDokType`) og nota-nummer (`gjettNotaNr`)
3. `registrerDokument` oppretter FtdDocument, trigger asynkron prosessering
4. `ftd-prosessering.ts` dispatcher til riktig handler basert på filtype:
   - **PDF**: pdfjs-dist → tekstekstraksjon → chunks + sider. OCR-fallback (pdftoppm + tesseract)
   - **Excel**: xlsx → rad-parsing → spec-poster + chunks. Kolonne-deteksjon for A-nota
   - **GAB**: Binær parsing → spec-poster med enhetspris (IEEE 754)
   - **XML**: NS 3459-format → spec-poster
   - **CSV**: Standard CSV-parsing
5. Resultat: FtdDocument (completed) + FtdDocumentChunks + FtdSpecPosts
6. **Budsjettoppdatering**: Ved A-nota/T-nota oppdateres anbudsgrunnlagets spec-poster
   automatisk med nota-verdier (`oppdaterBudsjettFraNota`) hvis de mangler mengde/enhetspris/sum
   eller har >50% avvik (indikerer feilparsing i PDF)

### Nota-import (A-nota / T-nota)
1. Bruker velger importert dokument + kontrakt + periodeNr
2. `nota-import.ts` bestemmer scenario:
   - **Scenario 1**: Første nota → direkte import
   - **Scenario 2**: Sekvensiell (forrige periode finnes) → akkumuleringsvalidering
   - **Scenario 3**: Gap (manglende mellomperioder) → krever bruker-godkjenning
3. Matcher nota-poster til budsjett via postnr
4. Akkumuleringsvalidering: `mengdeTotal = mengdeForrige + mengdeDenne` (toleranse ±0.02 kr)
5. Lagrer FtdNotaPeriod + FtdNotaPosts med sammenligningsdata

### Avviksanalyse
1. Sammenligner anbudsgrunnlag (budsjett) vs første nota-periode
2. Status per post: Match | Changed | New | Removed
3. Viser totaler + per-post delta

### PDF-splitting per NS-kode
1. Målebrev-PDF analyseres side for side
2. `finnPostIdentifikator()` finner postnr per side
3. `grupperSiderPerPost()` grupperer sider
4. Oppretter undermapper "Post {NS-kode}" med splittet PDF
5. Metadata lagres for sporbarhet

## UI-hovedside (okonomi/page.tsx)

### Layout
- **Venstre**: Kontraktvelger + dokumentliste med prosesseringsstatus
- **Midten**: Fanebladene Oversikt / Avvik / Rapport / Dokumenter
- **Høyre**: NS-kode-panel (søk i NS 3420)

### Faner
1. **Oversikt**: SpecPostTabell med nota-sammenligning, søk, sortering, gruppeheaders
2. **Avvik**: Avviksanalyse med statuskort og detaljtabell
3. **Rapport**: Nota-rapport med header-oppsummering (NotaOppsummering)
4. **Dokumenter**: Dokumentliste med import/eksport-handlinger

### Kontrollrad
- Kontraktvelger, type-velger (A-Nota/T-Nota), periodenummer
- NotaOppsummering: 2×3 grid med utført, innestående, MVA etc.
- Nota-forside knapp (📄): åpner PDF i iframe eller strukturert oppsummering for Excel
- Nota-forside modal er **flyttbar** — dra i header-baren (DraggableModal)
- localStorage-persistering per prosjekt (`ftd-kontrakt-{prosjektId}`, `ftd-type-{prosjektId}`, `ftd-nr-{prosjektId}`)

### SpecPostTabell-funksjoner
- **Treveis sortering**: klikk header → asc → desc → ingen
- **Vis/skjul kolonner**: +-knapp i header med gruppert dropdown (Mengder/Verdi), checkbox per kolonne
- **Drag-and-drop kolonneorder**: dnd-kit, GripVertical-ikon, faste kolonner (Postnr/Beskrivelse) ikke draggbare
- **Kolonne-persistering**: `ftd-kolonne-orden` og `ftd-kolonne-synlig` i localStorage
- **Mva denne per.**: kolonne skjult som default (data mangler per post foreløpig)
- **Nota-prioritet for verdier**: mengde/enhetspris/sum hentes fra nota når den finnes, faller tilbake til budsjett

### Import-dialog
- 9 dokumenttyper: anbudsgrunnlag, mengdebeskrivelse, a_nota, t_nota, varsel, varsel_om_endring, endringsmelding, regningsarbeid, annet
- Auto-gjetting av type fra filnavn (inkl. mappevalg)
- **Batch-import**: flere filer samtidig, nota-nummer auto-detekteres per fil fra filnavn
- Bekreftelsesdialog med advarsler (type-mismatch, manglende kontrakt/nr)
- Prosesseringsindikator (blå spinner ved prossessering, rød ved feil)

## Viktige mønstre

- **Desimaltall**: Prisma `Decimal` → `Number()` i API-responses
- **Soft delete**: `isActive`-flagg på FtdDocument
- **Concurrency guard**: `processingState` oppdateres atomisk med `updateMany`-sjekk
- **Chunk-deduplisering**: In-memory Map + `skipDuplicates: true`
- **NS-kode-deteksjon**: Regex `\b\d{2}\.\d{3}(?:\.\d+)*\b` + eksplisitt `nsCode`-felt
- **Søk-fallback**: tsvector fulltekst → ILIKE substring
- **Prosjektisolering**: Alle queries filtrerer på `projectId`. `oppdaterDokument` verifiserer at kontraktId tilhører samme prosjekt som dokumentet (defense-in-depth)
- **Flerspråklig embedding**: E5-vektorer (768-dim) for alle språk
- **Oversettelsescache**: SHA-256 hash → unngår re-oversettelse
- **Budsjettoppdatering fra nota**: Ved prosessering av A-nota/T-nota oppdateres anbudsgrunnlagets poster automatisk med nota-verdier hvis de mangler eller avviker >50% (`oppdaterBudsjettFraNota` i ftd-prosessering.ts)
- **Polling-strategi**: `hentDokumenter` poller 3s kun under prosessering, ellers `staleTime: 10s` + `refetchOnWindowFocus`. Spec-poster har `staleTime: 30s`
- **tRPC i Next.js**: API-kall kjører direkte i Next.js-prosessen via `appRouter` i route handler (`/api/trpc/[...trpc]`), IKKE som proxy til separat API-server
