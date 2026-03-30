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
- PDF (anbudsgrunnlag): `ekstraherBudsjettPosterFraPdf()` — pdfjs-dist `getTextContent()` med x/y-posisjoner, grupperer linjer etter y, sammensetter med mellomrom. Hierarkisk postnr-parsing, sub-postnr fra prislinjer (.1 Tid time...), postnr-tail merging (0 BUSKER → 00.03.03.10), seksjonsoverskrifter lagres som poster, full beskrivelsetekst samles mellom poster
- PDF (A-nota/Sluttnota): `ekstraherNotaPosterFraPdf()` — pdfjs-dist posisjonsbasert, parser 11 siste desimaltall per linje, portet fra Python a_nota.py. Mengde-validering via sum/pris-sjekk, importNotat-felt for avvik
- PDF-hjelpefunksjon: `ekstraherPdfMedPosisjoner()` — bruker pdfjs-dist `getTextContent()` med x/y-posisjoner for presis linjerekonstruksjon. Målrettet postnr-tail merge (x<90 kolonnebevisst). Postnr-regex: maks 2 siffer per segment (`\d{1,2}`)
- Excel: exceljs (xlsx) + SheetJS fallback (xls) → chunks (richText/formel-håndtering) + spec-poster. `cellDesimalRaw()` håndterer richText-celler fra Proadm Excel. Excel A-nota: dato→postnr via numFmt-deteksjon, kolonne-deteksjon med enhetspris som skillelinje mellom mengde/verdi-seksjoner
- GAB/GA1: `prosesserGab()` — ISY Beskrivelse binærfil-parser (.gab/.ga1), ekstraherer postnr/NS-kode/beskrivelse/enhet/enhetspris fra binærformat (enhetspris: IEEE 754 double LE ved offset +31 fra NS-kode-slutt), tekst-segmenter mellom poster, RTF-opprenskning
- XML: fast-xml-parser → NS3459 poster
- Service: `apps/api/src/services/ftd-prosessering.ts`

**Modulavhengighet:** Økonomi (`okonomi`) krever Dokumentsøk (`dokumentsok`). Auto-aktiveres. Deaktivering blokkeres.

**Neste steg (økonomi):** A-nota nummer = periodenummer. Kontrakt + periode-velger → vis og sammenlign perioder i Oversikt. Anbudsgrunnlag = anbud (fane), A-nota 4/5/6/7 = perioder under samme kontrakt. Sluttnota støttes som nota-type.

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

- 30 dager aktiv prøveperiode fra `createdAt` for prosjekter uten `organizationProjects`
- Etter 30 dager: prosjektet deaktiveres (`status: "deactivated"`)
- Etter 90 dager (30 aktiv + 60 grace): prosjektet slettes permanent
- `admin.slettUtlopteProsjekter` — deaktiverer >30 dager, sletter >90 dager uten firma
- Prøveperiode-banner i prosjektoversikt (gul/rød varsling ≤14 dager, rød ved deaktivert)

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
