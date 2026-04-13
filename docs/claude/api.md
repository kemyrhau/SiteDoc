# API — tRPC-routere og prosedyrer

Alle routere i `apps/api/src/routes/`:

| Router | Prosedyrer |
|--------|-----------|
| `prosjekt` | hentMine, hentAlle (filtrert på medlemskap), hentMedId, opprett (auto-admin, auto-tilknytt firma), opprettTestprosjekt (m/standardgrupper+moduler), oppdater |
| `entreprise` | hentForProsjekt, hentMedId, opprett, oppdater, slett |
| `sjekkliste` | hentForProsjekt (m/statusfilter + buildingId-filter), hentMedId (m/changeLog), opprett, oppdater (metadata + entrepriser, kun draft), oppdaterData (m/automatisk endringslogg), endreStatus, slett (kun draft, blokkeres ved tilknyttede oppgaver) |
| `oppgave` | hentForProsjekt (m/statusfilter), hentForTegning (markører per tegning), hentMedId (m/template.objects+kommentarer), hentForSjekkliste, hentKommentarer, leggTilKommentar, opprett (m/tegningsposisjon, templateId påkrevd), oppdater (m/entrepriser, kun draft), oppdaterData, endreStatus, slett (kun draft) |
| `mal` | hentForProsjekt, hentMedId, opprett, oppdaterMal, slettMal, leggTilObjekt, oppdaterObjekt, oppdaterRekkefølge, sjekkObjektBruk, slettObjekt |
| `bygning` | hentForProsjekt (m/valgfri type-filter), hentMedId, opprett (m/type), oppdater, publiser, slett |
| `tegning` | hentForProsjekt (m/filtre), hentForBygning, hentMedId, opprett (m/asynkron DWG-konvertering + layout-splitting, IFC-metadatautvinning), oppdater, lastOppRevisjon, hentRevisjoner, tilknyttBygning, settGeoReferanse, fjernGeoReferanse, hentKonverteringsStatus, provKonverteringIgjen (m/layout-splitting), slett |
| `punktsky` | hentForProsjekt (m/buildingId-filter), hentMedId, opprett (m/asynkron konvertering via CloudCompare+PotreeConverter), hentKonverteringsStatus, slett |
| `dokumentflyt` | hentForProsjekt, opprett, oppdater, slett, leggTilMedlem, fjernMedlem |
| `arbeidsforlop` | _(bakoverkompatibilitet for mobil)_ hentForProsjekt, hentForEnterprise, opprett, oppdater, slett, leggTilStegMedlem, fjernStegMedlem |
| `mappe` | hentForProsjekt (m/tilgangsoppføringer + kontrakt-info), hentDokumenter, opprett, oppdater, slett, hentTilgang, settTilgang, settKontrakt (koble/fjern kontrakt fra mappe), lastOppDokument (m/auto prosessering) |
| `medlem` | hentForProsjekt, hentMineEntrepriser, leggTil (m/invitasjon), fjern, oppdater (navn/e-post/telefon/rolle), oppdaterRolle, sokBrukere |
| `gruppe` | hentMineTillatelser, hentMinTilgang, hentForProsjekt, opprettStandardgrupper, opprett, oppdater, slett, leggTilMedlem (m/invitasjon), fjernMedlem, oppdaterEntrepriser, oppdaterDomener |
| `invitasjon` | hentForProsjekt, validerToken, aksepter, sendPaNytt, trekkTilbake |
| `vaer` | hentVaerdata (Open-Meteo proxy: latitude, longitude, dato → temperatur, værkode, vind) |
| `modul` | hentForProsjekt, aktiver (oppretter maler+objekter automatisk), deaktiver (soft-deactivate) |
| `organisasjon` | hentMin, hentForProsjekt (firma via OrganizationProject), hentMedId, hentProsjekter, hentBrukere, oppdater (m/organizationId for sitedoc_admin), leggTilProsjekt, fjernProsjekt |
| `mobilAuth` | byttToken (public, OAuth→sesjon), verifiser (m/tokenrotasjon), loggUt (sletter sesjon) |
| `bilde` | hentForProsjekt (alle bilder via sjekklister + oppgaver, m/tilgangsfilter, inkl. parent+tegningsdata), opprettForSjekkliste |
| `admin` | erAdmin, hentAlleProsjekter (m/sjekkliste-/oppgavetellere), hentAlleOrganisasjoner, opprettOrganisasjon, oppdaterOrganisasjon, settBrukerOrganisasjon, tilknyttProsjekt, fjernProsjektTilknytning, opprettProsjekt, hentProsjektStatistikk, slettProsjekt, slettUtlopteProsjekter, hentAlleBrukere |
| `mengde` | hentDokumenter (m/mappetilgangsfilter, docType != null, inkl. harPeriode+periodId), hentPerioder, hentSpecPoster (m/periodId→FtdNotaPost ELLER dokumentId→FtdSpecPost, sammenligningPoster), hentAvviksanalyse, lagreNotat, importerTilPeriode (mutation→nota-import service), registrerDokument (m/kontraktId, notaType, notaNr), oppdaterDokument (inline type/nota/kontrakt), reprosesser, fjernFraOkonomi (nullstiller type, beholder i mapper), slettPeriode, hentNotaRapport (deduplisert per notaNr, header-verdier), hentDokumentasjonForPost (side→postnr fra FtdDocumentPage, scopet til kontraktens mapper) |
| `ftdSok` | sokDokumenter (tsvector m/norsk stemming + ILIKE fallback, mappetilgangsfilter), hentDokumentChunks, nsKoder, nsChunks |
| `bruker` | hentSpraak (brukerens valgte språk), oppdaterSpraak (lagre språkvalg i DB) |
| `kontrakt` | hentForProsjekt (m/building, _count), opprett (navn, type 8405/8406/8407, byggherre, entreprenor, buildingId), oppdater (alle felter inkl. bygning), slett (fjerner kobling fra entrepriser og dokumenter, m/bekreftelsesmodal) |

**Dokumentflyt:**
- **Mapper** → opplasting → FtdDocument → auto scanning/chunking → søkbart (dokumentsøk-modul)
- **Økonomi** → manuell import (velg fra mapper) → sett docType + nota-type/nr + velg kontrakt → spec-poster
- **Fjern fra økonomi** → nullstiller docType/nota-info, dokumentet beholdes i mapper

**Kontrakt-modell (FtdKontrakt):**
- Overliggende gruppering for økonomi: Byggherre → Entreprenør per kontrakt
- Felter: navn, kontraktType (NS 8405/8406/8407), byggherre, entreprenor, buildingId (valgfri bygningsvelger), hmsSamordningsgruppe
- Entrepriser kan kobles til kontrakt (valgfri kontraktId på Enterprise)
- Dokumenter kobles til kontrakt via kontraktId på FtdDocument
- Kontrakt-dropdown i økonomi-toppen som primærfilter
- Redigeringsmodal med alle felter (navn, type, byggherre, entreprenør, bygning) + sletteknapp med bekreftelse

**FTD-prosessering** (Fastify `POST /prosesser/:documentId`):
- tRPC kjører i Next.js, prosessering i API-serveren (ren Node)
- **OCR-fallback:** Skannede PDFer (pdf-parse gir <50 ord) → pdftoppm (300 DPI, batches à 20 sider) + tesseract CLI (norsk) → OCR-tekst erstatter sideData → chunking/tsvector/POST-regex fungerer automatisk
- PDF (anbudsgrunnlag): `ekstraherBudsjettPosterFraPdf()` — pdfjs-dist `getTextContent()` med x/y-posisjoner, grupperer linjer etter y, sammensetter med mellomrom. Hierarkisk postnr-parsing, sub-postnr fra prislinjer (.1 Tid time...), postnr-tail merging (0 BUSKER → 00.03.03.10), seksjonsoverskrifter lagres som poster, full beskrivelsetekst samles mellom poster
- PDF (A-nota/Sluttnota): `ekstraherNotaPosterFraPdf()` — pdfjs-dist posisjonsbasert, parser 11 siste desimaltall per linje, portet fra Python a_nota.py. Mengde-validering via sum/pris-sjekk, importNotat-felt for avvik
- PDF-hjelpefunksjon: `ekstraherPdfMedPosisjoner()` — bruker pdfjs-dist `getTextContent()` med x/y-posisjoner for presis linjerekonstruksjon. Målrettet postnr-tail merge (x<90 kolonnebevisst). Postnr-regex: maks 2 siffer per segment (`\d{1,2}`)
- Excel: exceljs (xlsx) + SheetJS fallback (xls) → chunks (richText/formel-håndtering) + spec-poster. `cellDesimalRaw()` håndterer richText-celler fra Proadm Excel. Excel A-nota: dato→postnr via numFmt-deteksjon, kolonne-deteksjon med enhetspris som skillelinje mellom mengde/verdi-seksjoner
- GAB/GA1: `prosesserGab()` — ISY Beskrivelse binærfil-parser (.gab/.ga1), ekstraherer postnr/NS-kode/beskrivelse/enhet/enhetspris fra binærformat (enhetspris: IEEE 754 double LE ved offset +31 fra NS-kode-slutt), tekst-segmenter mellom poster, RTF-opprenskning
- XML: fast-xml-parser → NS3459 poster
- **PDF-splitting:** `apps/api/src/services/pdf-splitting.ts` — splitter målebrev per NS-kode (pdf-lib). NS-kode-ekstraksjon fra OCR-tekst (linje 1-10) + POST-regex fallback. Arv fra forrige side. Append-modus: nye sider legges til eksisterende post-PDF. Kilde-sporbarhet via `splitSources` JSON på FtdDocument [{filnavn, dokumentId, kildeSider, startSide}]. Auto-splitting ved opplasting til mappe med kontraktId
- Service: `apps/api/src/services/ftd-prosessering.ts`

**Modulavhengighet:** Økonomi (`okonomi`) krever Dokumentsøk (`dokumentsok`). Auto-aktiveres. Deaktivering blokkeres.

**Dokumentsøk:** Tilgjengelig for alle prosjekter (ingen modulkrav). Tilgangskontroll via `hentTilgjengeligeMappeIder()`. Dedup per dokument (DISTINCT ON document_id). NS 3420-standarddokumentasjon søkbar via `nsStandardSok` (ILIKE i NS 3420-chunks). Gul prikk (●) i økonomi-tabell der split-dokumentasjon finnes (sjekker undermapper "Post {kode}").

## Økonomi — A-nota importlogikk

### Datamodell

- **FtdSpecPost** = master-post per postnr per kontrakt (fra budsjett/anbudsgrunnlag). Felter: postnr, beskrivelse, enhet, mengdeAnbud, enhetspris, sumAnbud, nsKode, etc.
- **FtdNotaPeriod** = én importert A-nota/Sluttnota. Felter: periodeNr, periodeSlutt, type, erSluttnota (boolean), gapFlagg, kildeFilnavn, totaler.
- **FtdNotaPost** = per-post per-periode verdier, koblet til FtdSpecPost. Felter: mengdeDenne/Total/Forrige, verdiDenne/Total/Forrige, prosentFerdig, enhetspris.

Sluttnota: `erSluttnota = true`, `notaNr = null`. Korrigert sluttnota: to dokumenter kan ha flagget, siste importdato vinner.

### Fase 1 — komplett (2026-04-13)

**Duplikat-beskyttelse:**
- Unique constraint `(documentId, postnr)` (partial index, WHERE NOT NULL)
- `lagreSpecPoster()` — in-memory deduplisering + `createMany({ skipDuplicates: true })`
- Concurrency guard — `prosesserDokument()` avviser parallelle kjøringer via `updateMany`
- Atomisk sletting i `prosesserDokument`, ikke i kalleren
- PDF header-reset — gjentatte header-linjer hoppes over preventivt

**Økonomi-visning (Oversikt-tabell):**
- Kolonnerekkefølge Proadm-format: Postnr | Beskrivelse | Mengder (Anbudet, Enh, Tot.forrige, Denne, Totalt) | Enhetspris | Verdi (Anbudet, Tot.forrige, Denne, Totalt, %)
- Gruppe-header med fargestrek (blå=Mengder, grønn=Verdi)
- Globalt søkefelt (postnr + beskrivelse)
- Per-kolonne filter (▽): tekst=søk, tall=>/</ min-maks, enhet=verdiliste
- Sortering per kolonne (klikk header)
- +-knapp for vis/skjul kolonnegrupper
- Seksjonsoverskrifter: kursiv/grå, "—" i verdi-kolonner, ekskludert fra totalrad
- "Tot. tom. forrige" hentes fra forrige notas verdiTotal per postnr via server-join
- Sluttnota finner høyeste A-nota som forrige (via notaType-sjekk)

**Parser-fikser:**
- Excel: enhetspris-deteksjon bruker første forekomst (merged cells-fix)
- Alle Excel-dokumenter reprosessert og verifisert mot kontrolltall

**Importlogikk (FtdNotaPeriod / FtdNotaPost):**
- FtdNotaPeriod migrert: kontraktId, documentId (obligatoriske), erSluttnota, gapFlagg, unique [kontraktId, periodeNr]
- FtdSpecPost: ikkeIBudsjett boolean for poster som kun finnes i nota
- `importerNotaTilPeriode()` — hovedfunksjon med batch createMany, scenario-bestemmelse, akkumuleringskontroll
- `bestemScenario()` — scenario 1/2/3 + retroaktiv med påfølgendeNr-varsling
- `kontrollerAkkumulering()` — ±2 øre toleranse for mengde/verdi, ±2 kr for enhetspris
- `mengde.importerTilPeriode` mutation — kobler service til frontend
- Alle notas importert og verifisert: A-nota 25–29 + Sluttnota, 0 avvik, alle matcher kontrolltabell
- Service: `apps/api/src/services/nota-import.ts`

**Datakilde-valg (harPeriode):**
- `hentDokumenter` returnerer `harPeriode` og `periodId` per dokument
- `hentSpecPoster` med `periodId` → ny gren som leser verdier direkte fra FtdNotaPost (ingen beregning)
- `hentSpecPoster` med `dokumentId` → gammel gren via FtdSpecPost med forrige-nota lookup
- Frontend sender `periodId` for importerte notas, `dokumentId` for eldre
- Nota-dropdown viser "✓" etter nummeret for notas med FtdNotaPeriod

**Sekvensielt import-dialog (3 faser):**
- Fase 1: Filvalg — drag-drop eller fra-mappe, flere filer, klikk "Importer N filer"
- Fase 2: Per-fil konfigurasjon — auto-deteksjon (gjettDokType, gjettNotaNr, gjettDato), kontrakt arvet, korrigerbar
- Fase 3: Oppsummering — status per fil (importert/hoppet/duplikat/feil), avvikstall
- Duplikat-sjekk: advarsel med valg "Hopp over" (standard) eller "Reimporter"
- Gap-advarsel inline: viser manglende notas, blokkerer ikke import
- Hjelpefunksjoner med 20 enhetstester (`__tests__/import-hjelpere.test.ts`)

### Importscenarioer (implementert)

**Scenario 1 — Første A-nota:** Alle verdier importeres som-er. Ingen akkumuleringskontroll.

**Scenario 2 — Påfølgende A-nota:** Match via postnr mot forrige FtdNotaPost. Akkumuleringsberegning per post. Toleranse ±2 øre mengde/verdi, ±2 kr enhetspris. Avviksrapport.

**Scenario 3 — Gap i rekkefølge:** Returnerer `kreverGapGodkjenning` med manglendeNr[]. Etter godkjenning: importeres som scenario 1 med gapFlagg.

**Retroaktiv import:** Returnerer `påfølgendeNr[]` — frontend viser informasjonsmelding. Ingen automatisk revalidering i fase 1.

**Innestående / oppsummering (ferdig):**
- Oppsummeringslinje under tabellen i Proadm-format: utført, innestående, netto, mva, sum inkl. mva
- Verdier leses direkte fra FtdDocument-felter via eksisterende relasjon — ingen duplisering, ingen ekstra API-kall
- NULL vises som "—", negativ innestaaendeDenne vises med minus
- Vises kun når utfortTotalt != null
- A-nota 18 og 24 importert — alle 8 perioder komplett (18, 24, 25, 26, 27, 28, 29, Sluttnota)

### Fase 2 — gjenstår

1. **Retroaktiv revalidering** — automatisk revalidering fremover når nota importeres midt i kjeden
2. **Mva** — parser + skjemaendring
3. **Drag-and-drop kolonneorder** — med localStorage-persistering

## Auth-nivåer

`publicProcedure` (åpen) og `protectedProcedure` (krever autentisert userId i context). Context bygges i `context.ts` som verifiserer Auth.js-sesjonstokens. De fleste routere bruker `protectedProcedure` med tilleggs-sjekker fra `tilgangskontroll.ts`.

**Autorisasjonssjekker per router:**
Alle routere som opererer på prosjektdata har `verifiserProsjektmedlem`-sjekk. For prosedyrer som ikke tar `projectId` direkte (f.eks. `mal.hentMedId` med template-ID), slås prosjekt-ID opp fra entiteten først. Spesifikke sjekker:
- `sjekkliste`, `oppgave`: `verifiserDokumentTilgang` (entreprise + domain)
- `invitasjon.sendPaNytt/trekkTilbake`: `verifiserAdmin`
- `prosjekt.oppdater`: `verifiserAdmin`
- `endreStatus`: bruker `ctx.userId` som `senderId` (ikke bruker-input)
- `medlem.sokBrukere`: krever `projectId` + prosjektmedlemskap

## Filopplasting

`/upload`-endepunkt (REST, ikke tRPC) i `apps/api/src/routes/upload.ts`:
- Krever autentisert sesjon (sjekker cookie/Authorization-header)
- Tillatte filtyper: `.pdf`, `.dwg`, `.dxf`, `.ifc`, `.png`, `.jpg`, `.jpeg`
- Maks 100 MB per fil
- UUID-baserte filnavn (forhindrer path traversal)
- Rate limiting: 30 forespørsler/minutt per IP
- Filer serveres med `X-Content-Type-Options: nosniff`

## Rate limiting

Minnebasert rate limiter i `apps/api/src/utils/rateLimiter.ts`. Automatisk opprydding hvert 5. minutt.

| Endepunkt | Grense | Per |
|-----------|--------|-----|
| `/upload` | 30/min | IP |
| `mobilAuth.byttToken` | 10/min | IP |
| `invitasjon.validerToken` | 20/min | IP |
| `invitasjon.aksepter` | 10/min | IP |

## Gratis-grenser

- Maks 10 sjekklister per prosjekt (sjekkes i `sjekkliste.opprett`)
- Maks 10 oppgaver per prosjekt (sjekkes i `oppgave.opprett`)
- `sitedoc_admin` har bypass

## Prøveperiode og testsider

- Prøveperiode styres av `trialExpiresAt`-feltet (default: `createdAt + 30 dager`). Prosjekter med `organizationProjects` har ingen prøveperiode.
- Etter utløp: prosjektet deaktiveres (`status: "deactivated"`)
- 60 dager etter utløp: prosjektet slettes permanent
- `admin.forlengProsjekt` — forlenger prøveperiode med N dager (reaktiverer deaktiverte)
- `admin.slettUtlopteProsjekter` — deaktiverer utløpte, sletter 60+ dager etter utløp uten firma
- Prøveperiode-banner i prosjektoversikt (gul/rød varsling ≤14 dager, rød ved deaktivert)
- Admin prosjektliste har forleng-knapp (kalenderikon, +30 dager per klikk)

**Testside-opprettelse (`prosjekt.opprettTestprosjekt`):**
- Én-klikks opprettelse fra `/dashbord/kom-i-gang`
- Prosjektnavn: `"Testside " + brukerens navn`
- Auto-oppsett: standardgrupper + alle moduler (Godkjenning, HMS-avvik, Befaringsrapport) med maler og objekter
- Bruker blir automatisk admin
- Auto-tilknyttes brukerens firma hvis det finnes

**Admin-oversikt:** `/dashbord/admin/testsider` — viser kun prøveprosjekter (uten firma), splittet i aktive/deaktiverte

## DWG-konvertering

**Fil:** `apps/api/src/services/dwgKonvertering.ts`

Pipeline: DWG → DXF → SVG med automatisk koordinatdeteksjon og georeferanse.

**Konvertere:**
- **ODA File Converter** (primær): Industri-standard, krever xvfb for headless Linux, `--auto-servernum`
- **libredwg dwg2dxf** (fallback): Åpen kildekode, `--as r2000` for komplekse filer

**DXF → SVG:**
- Bruker `dxf-parser` for parsing + custom SVG-generering
- Paper space-entiteter filtreres bort (`inPaperSpace`)
- Paper space-blokker (`*Paper_Space*`) og dimensjonsblokker (`*D*`) hoppes over
- Iterativ block-utfoldelse (INSERT) med grenser: maks 500k entiteter, 10k per blokk, 5 nesting-nivåer
- Extents fra DXF header ($EXTMIN/$EXTMAX), fallback til persentil-basert beregning
- Entiteter utenfor extents (50% margin) filtreres bort
- Støttede entitetstyper: LINE, LWPOLYLINE, POLYLINE, CIRCLE, ARC, ELLIPSE, SPLINE, SOLID, 3DFACE, TEXT, MTEXT, DIMENSION, POINT, INSERT
- B-spline evaluering via De Boors algoritme
- TrueColor (DXF color > 255) støttes

**Layout-splitting:**
- DWG-filer med multiple layout-tabs (faner) splittes til separate Drawing-records
- Layout-info parses fra rå DXF-tekst (LAYOUT-objekter, BLOCK_RECORD, VIEWPORT)
- Alle layouts deler samme model space SVG (viewport-klipping krever UCS-data)
- Brukeren tilordner etasje til hvert layout manuelt

**Koordinatdeteksjon:**
- UTM-33 detekteres automatisk fra filnavn eller extents-heuristikk
- Auto-georeferanse genereres for UTM-koordinater

## IFC-metadatautvinning

**Fil:** `apps/api/src/services/ifcMetadata.ts`

Parser IFC-filer (STEP-format) med regex og trekker ut metadata ved opplasting.
Kjører asynkront (som DWG-konvertering) og lagrer i `Drawing.ifcMetadata` (Json).

**Uttrukne felter:**
- `prosjektnavn`, `prosjektbeskrivelse`, `fase` — fra IFCPROJECT
- `organisasjon`, `forfatter` — fra IFCORGANIZATION og FILE_NAME
- `programvare`, `tidsstempel` — fra FILE_NAME
- `gpsBreddegrad`, `gpsLengdegrad`, `gpsHøyde` — fra IFCSITE (DMS→desimalgrader)
- `bygningNavn` — fra IFCBUILDING
- `etasjer` (navn + høyde) — fra IFCBUILDINGSTOREY, sortert etter høyde
- `fagdisiplin` — gjettes fra filnavn (ARK, RIB, RIV, RIE, etc.)

**IFC-strengdekoding:** `\X\HH` (ISO 8859-1), `\X2\HHHH\X0\` (Unicode), `\S\c` (Latin supplement)

**Auto-utfylling:** `discipline` og `originator` settes automatisk fra metadata hvis ikke angitt manuelt.

## Punktsky-konvertering

**Filer:**
- `apps/api/src/services/punktskyKonvertering.ts` — Konverteringspipeline
- `apps/api/src/services/lasHeader.ts` — LAS header-parser

**Pipeline:** Opplastet fil → [CloudCompare CLI] → LAS → [PotreeConverter] → Potree octree (metadata.json + hierarchy.bin + octree.bin)

**CloudCompare** (GPL v2, headless via `xvfb-run`):
- Konverterer E57, PLY → LAS for PotreeConverter
- CLI: `xvfb-run CloudCompare -SILENT -O input.e57 -C_EXPORT_FMT LAS -SAVE_CLOUDS`

**PotreeConverter** (v2.0 eller v1.7):
- Genererer octree LOD-struktur for Potree web-viewer
- Output-attributter: RGB, INTENSITY, CLASSIFICATION, RETURN_NUMBER, NUMBER_OF_RETURNS
- Output lagres i `uploads/potree/{uuid}/`

**LAS header-parser:**
- Leser binært LAS-filhode: versjon, punktformat, antall, bounding box
- Sampler 100K punkter for klassifiseringsstatistikk
- Detekterer: `hasClassification` (koder utover 0/1), `hasRgb` (punkt-format med RGB)
- ASPRS-klassifiseringskoder: Bakke (2), Vegetasjon (3-5), Bygning (6), Vann (9), Vei (11), Bro (17) etc.

**Fallback for uklassifiserte filer:** Viewer tilbyr fargemodus: RGB (hvis tilgjengelig), intensitet, eller høyde (Z).
