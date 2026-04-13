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
| `mengde` | hentDokumenter (m/mappetilgangsfilter, docType != null), hentPerioder, hentSpecPoster (m/sortering, sammenligningPoster), hentAvviksanalyse, lagreNotat, registrerDokument (m/kontraktId, notaType, notaNr, auto-detect docType fra filnavn), oppdaterDokument (inline type/nota/kontrakt), reprosesser, fjernFraOkonomi (nullstiller type, beholder i mapper), slettPeriode, hentNotaRapport (deduplisert per notaNr, header-verdier), hentDokumentasjonForPost (side→postnr fra FtdDocumentPage, scopet til kontraktens mapper) |
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

### Duplikat-beskyttelse

- **Unique constraint** `(documentId, postnr)` (partial index, WHERE NOT NULL) på FtdSpecPost
- **`lagreSpecPoster()`** — in-memory deduplisering + `createMany({ skipDuplicates: true })`
- **Concurrency guard** — `prosesserDokument()` bruker `updateMany({ where: { processingState: { not: "processing" } } })` for å avvise parallelle kjøringer
- **Atomisk sletting** — eksisterende poster slettes i `prosesserDokument`, ikke i kalleren

### Importscenarioer

**Scenario 1 — Første A-nota (ingen tidligere data):** Alle verdier importeres som-er. Aksepter selv om tidligere notas mangler.

**Scenario 2 — Påfølgende A-nota:** Match via postnr. Akkumuleringsberegning per post: `forventet verdiTotal = forrige.verdiTotal + ny.verdiDenne`. Toleranse ±2 øre = stille aksept. Avvik utenfor toleranse → rapport med tre valg: A) Bruk kildeverdi, B) Bruk beregnet, C) Avbryt. Beregnet enhetspris (`verdiDenne / antallDenne`) sammenlignes mot forrige — avvik er varselsignal.

**Scenario 3 — Gap i rekkefølge:** Varsle bruker, ikke blokker. Importer som scenario 1. Lagre gap-flagg.

**Scenario 4 — Retroaktiv import (fase 2):** Overskriv + revalidering av alle påfølgende notas. Samlet avviksrapport.

### Import-dialog (sekvensielt modal)

**Fase 1:** Bruker velger filer fra mapper eller laster opp. Klikker "Importer N filer".

**Fase 2:** Viser én fil om gangen med auto-detekterte verdier (type, nr, kontrakt, dato fra filnavn). Statusliste viser alle filer med ✓/✗/— status. Inline sjekker per fil:
- **Gap-advarsel** — når nota N importeres og N-1 mangler for kontrakten
- **Duplikat-sjekk** — notaNr + kontraktId finnes allerede i DB → bekreftelse på reimport
- **Dato-deteksjon** — `A-nota 26_31.05.25.pdf` → periodeSlutt = 2025-05-31

**Fase 3:** Oppsummering med akkumuleringsresultat per fil (ingen avvik / N poster med avvik).

### Kolonnevisning (Oversikt-tabell)

Rekkefølge: Postnr | Beskrivelse | **Mengder:** Anbudet, Enh, Tot.tom.forrige per., Utført denne per., Utført totalt | Enhetspris | **Verdi:** Anbudet, Tot.tom.forrige per., Utført denne per., Mva denne per., Utført totalt, Utført %

- Dynamisk kolonnevalg: bruker kan vise/skjule kolonner via +-knapp i header
- Filterrad under header for filtrering per kolonne
- Drag-and-drop rekkefølge (valgfritt, fase 2)
- Seksjonsoverskrifter (poster uten enhet som har barn med sum ≈ egen verdi) ekskluderes fra totalrad
- Poster uten enhet men uten barn beholdes og markeres visuelt

### Prioritert rekkefølge

1. **Økonomi-visning** — fiks kolonne-logikk, seksjonsoverskrifter, totalrad, dynamiske kolonner
2. **Ny importlogikk** — FtdNotaPeriod/FtdNotaPost med akkumulering og avviksrapport
3. **Import-dialog** — sekvensielt modal med auto-deteksjon, gap-advarsel, duplikat-sjekk

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
