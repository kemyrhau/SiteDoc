# API — tRPC-routere og prosedyrer

Alle routere i `apps/api/src/routes/`:

| Router | Prosedyrer |
|--------|-----------|
| `prosjekt` | hentMine, hentAlle (filtrert på medlemskap), hentMedId, opprett (auto-admin, auto-tilknytt firma), opprettTestprosjekt (m/standardgrupper+moduler), oppdater |
| `faggruppe` | hentForProsjekt, hentMedId, opprett, oppdater, kopier, settAnsvarlig, slett. _Note: montert også som `entreprise`-alias (bakoverkompat for mobil) — samme `faggruppeRouter`. «entreprise» er forbudt i ny kode._ |
| `sjekkliste` | hentForProsjekt (m/statusfilter + buildingId-filter), hentMedId (m/changeLog), opprett, oppdater (metadata + entrepriser, kun draft), oppdaterData (m/automatisk endringslogg), endreStatus, slett (kun draft, blokkeres ved tilknyttede oppgaver) |
| `oppgave` | hentForProsjekt (m/statusfilter), hentForTegning (markører per tegning), hentMedId (m/template.objects+kommentarer), hentForSjekkliste, hentKommentarer, leggTilKommentar, opprett (m/tegningsposisjon, templateId påkrevd), oppdater (m/entrepriser, kun draft), oppdaterData, endreStatus, slett (kun draft) |
| `mal` | hentForProsjekt, hentMedId, opprett, oppdaterMal, slettMal, leggTilObjekt, oppdaterObjekt, oppdaterRekkefølge, sjekkObjektBruk, slettObjekt |
| `byggeplass` | hentForFirma (R4: member-lesbar firma-byggeplass-liste for reisetid-matrise-cache, firma-scopet via `project.primaryOrganizationId`), hentForProsjekt (m/valgfri type-filter), hentMedId, opprett (m/type), oppdater, beregnGeofence, settGeofence, publiser, hentSletteSammendrag, slett. _Note: montert også som `bygning`-alias (bakoverkompat) — samme `byggeplassRouter`._ |
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
| `ftdSok` | sokDokumenter (tsvector m/norsk stemming + ILIKE fallback, mappetilgangsfilter), hentDokumentChunks, nsKoder, nsChunks, nsStandardSok (søk i NS 3420-standarddokumenter), nsKoderMedDok (batch-sjekk hvilke NS-koder har split-dokumentasjon) |
| `bruker` | hentSpraak (brukerens valgte språk), oppdaterSpraak (lagre språkvalg i DB) |
| `kontrakt` | hentForProsjekt (m/building, _count), opprett (navn, type 8405/8406/8407, byggherre, entreprenor, buildingId), oppdater (alle felter inkl. bygning), slett (fjerner kobling fra entrepriser og dokumenter, m/bekreftelsesmodal) |
| `hms` | hentDokumenter (avvik/sja/ruh på tvers av maler, m/statusfilter + byggeplassId-filter + synlighetsfilter), hentFirmaOversikt (firma-bred HMS-aggregering på tvers av prosjekter, krever `harFirmaHmsTilgang`), firmaBehandleAvvik (firma-HMS statusendring/kommentar på Task) |
| `bibliotek` | hentStandarder (BibliotekStandard m/maler), hentProsjektValg (aktiverte bibliotekmaler per prosjekt), importerMal (kopier bibliotekmal til prosjekt), fjernValg. _Sjekklistebibliotek/kontrollplan-maler — se kontrollplan.md_ |
| `omrade` | hentForProsjekt (m/valgfri type-filter, inkl. byggeplass+tegning), hentForByggeplass, hentForTegning, opprett, oppdater, slett |
| `kontrollplan` | hentForByggeplass, opprettEllerHent, opprettPunkter, oppdaterPunkt, slettPunkt, opprettMilepel, oppdaterMilepel, slettMilepel, oppdaterStatus, skyvOmrade, kopierPunkter, skyvKaskade, hentKaskadeBerort, hentHistorikk, hentSluttrapportData, hentStatusForProsjekt |
| `maskin` | Nestet (`maskin/index.ts`): `equipment` (list, antallPerKategori, hentMuligeAnsvarlige, hentMedId, opprett, oppdater, settStatus, hentFraVegvesenForhandsvisning, opprettMedVegvesen, oppdaterFraVegvesen), `vegvesenKo` (hentStatus), `ansvarlig` (list, tilfoy, fjern), `import` (importerForhandsvisning, importerBekreft). _Firmamodul, `db-maskin` — se maskin.md_ |
| `avdeling` | hentAlle, opprett, oppdater, slett (firmaadmin-scope, krever organizationId) |
| `oppmotested` | hentAlle, hentForFirma, hentMatriseForFirma (R4: member-lesbar reisetid-matrise for mobil-cache), geokod (R2: adresse→koordinat via Nominatim, firma-admin), beregnMatrise (R3: on-demand full firma-backfill av reisetid-matrise, firma-admin), opprett, oppdater, slett (firma-isolert oppmøtested-katalog + reisetid-matrise) |
| `kompetansetype` | hentAlle, opprett, oppdater, slett (firmaets kompetansetype-katalog) |
| `kompetanse` | hentMatrise (AnsattKompetanse-matrise), hentForBruker, opprett, oppdater, slett, importerForhandsvisning, importerBekreft (CSV/Excel-import) |
| `timer` | Nestet (`timer/index.ts`): `onboarding` (status, aktiverNivaa1/Nivaa2/TomKatalog), `lonnsart` (list, opprett, oppdater, settStandard, deaktiver), `aktivitet` (list, opprett, oppdater, deaktiver), `tillegg` (list, opprett, oppdater, deaktiver), `dagsseddel` (list, hentMedId, opprett, oppdater, tilfoy/oppdater/fjernTimerRad, tilfoy/oppdater/fjernTilleggRad, send, slett, hentTilAttestering, hentTilGodkjenning, kanAttestere, kanGodkjenne, hentTilAttesteringFirma, kanAttestereFirma, hentForAttestering, flyttTimerRadEco, attesterRader, returnerRader, redigerSedelRader, splittRad, attester, returner, hentEndringerSiden, syncBatch, maskin-undergruppe tilfoy/oppdater/fjern, hentDagstotal), `rapport` (firmaPeriodeRapport, hentFirmaProsjekterMedTimer, hentFirmaAnsatteMedTimer). _Firmamodul, `db-timer` — se timer.md_ |
| `eksternKostObjekt` | list (ExternalCostObject = «Underprosjekt» i UI; firma-isolert via `krevBrukersOrg`, ikke prosjekt-isolert — lese-only for timer-velgere) |
| `vareKategori` | list, opprett, oppdater, slett (vareforbruk-modulens kategorikatalog) |
| `vare` | list, hentMedId, opprett, oppdater, deaktiver (vareforbruk-modulens varekatalog) |
| `vareforbruk` | list, hentMedId, opprett, oppdater, slett (vareforbruk-registrering, m/byggeplass + eksternt kostobjekt). _Firmamodul, `db-varelager` — se steg-4b-plan.md_ |
| `vareImport` | importerForhandsvisning, importerBekreft (vare-/kategori-import) |
| `firmaIntegrasjon` | list, lagre, slett (firma-integrasjonskonfigurasjon; API-nøkler returneres ALDRI — kun `harNøkkel`. Rotfil `routes/firma-integrasjon.ts`) |
| `firma` | Nestet (`firma/index.ts`): `kalender` (hentForAar, importerNorskStandard, opprett, oppdater, slett, hentForMobil — firma-arbeidskalender/helligdager) |
| `psi` | hentForProsjekt, hentMedObjekter, opprett, bumpVersjon, byttMal, deaktiver, reaktiver, oppdaterGjesteBeskjed, oppdaterSpraak, oversettInnhold, hentSignaturer, hentMinStatus, startGjennomforing, oppdaterProgresjon, guestStart (public), guestOppdaterProgresjon (public), hentForProsjektPublic (public), kopier. _Prosjektspesifikk sikkerhetsinstruks — multi-byggeplass, quiz, signatur, gjeste-QR_ |
| `aiSok` | sok (hybrid vektor+leksikalsk+re-ranking), blokkSok, genererEmbeddings, stoppEmbeddings, embeddingStatus, hentReferanseDokumenter, hentInnstillinger, oppdaterInnstillinger. _Se ai-sok.md_ |

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

**Drag-and-drop kolonneorder (ferdig):**
- Native HTML drag events på kolonne-headers med GripVertical-ikon
- localStorage-persistering med nøkkel `ftd-kolonne-orden-{userId}`
- SSR-safe med try-catch, nye kolonner legges til på slutten
- Synlige kolonner persisteres sammen med rekkefølge

**Mva (ferdig — header-nivå):**
- Parseren leser mva fra PDF/Excel header-seksjon og lagrer på FtdDocument
- Vises i NotaOppsummering (+ Mva: / = Sum inkl. mva:)
- Per-post mva finnes ikke i Proadm-kildedata — FtdNotaPost.mvaDenne/sumDenne er tomme

### Fase 2 — komplett (2026-04-13)

Alle planlagte fase 2-oppgaver er ferdigstilt eller bevisst utsatt.

### Fase 3 — ved behov

1. **Retroaktiv revalidering** — automatisk revalidering fremover når nota importeres midt i kjeden. Løsning beskrevet: oppdater mengdeForrige/verdiForrige på påfølgende FtdNotaPost-rader, kjør kontrollerAkkumulering() på nytt. Implementeres når reelt behov oppstår.
2. **Mva per post** — krever parser-utvidelse og skjemaendring. Proadm-kildedata har kun mva i header, ikke per rad. Egen oppgave.
3. **Avviksanalyse-fane** — rapport over enhetsprisendringer og akkumuleringsavvik på tvers av perioder.

## Auth-nivåer

`publicProcedure` (åpen) og `protectedProcedure` (krever autentisert userId i context). Context bygges i `context.ts` som verifiserer Auth.js-sesjonstokens. De fleste routere bruker `protectedProcedure` med tilleggs-sjekker fra `tilgangskontroll.ts`.

**Autorisasjonssjekker per router:**
Alle routere som opererer på prosjektdata har `verifiserProsjektmedlem`-sjekk. For prosedyrer som ikke tar `projectId` direkte (f.eks. `mal.hentMedId` med template-ID), slås prosjekt-ID opp fra entiteten først. Spesifikke sjekker:
- `sjekkliste`, `oppgave`: `verifiserDokumentTilgang` (entreprise + domain)
- `invitasjon.sendPaNytt/trekkTilbake`: `verifiserAdmin`
- `prosjekt.oppdater`: `verifiserAdmin`
- `endreStatus`: bruker `ctx.userId` som `senderId` (ikke bruker-input)
- `medlem.sokBrukere`: krever `projectId` + prosjektmedlemskap
- `mengde.oppdaterDokument`: `verifiserProsjektmedlem` + kontraktisolering (kontraktId må tilhøre samme prosjekt)
- `admin.*integrasjon*`: `verifiserSiteDocAdmin` (kun superadmin, aldri company_admin). API-nøkler returneres aldri — kun `harNøkkel: boolean`
- `company_admin`-fallback i `verifiserProsjektmedlem`/`verifiserAdmin`: sjekker `OrganizationProject`-kobling, hindrer kryssorg-tilgang
- `gruppe.hentMineTillatelser` → `hentBrukerTillatelser`: speiler `verifiserAdmin`-mønsteret (fix `c22a345d` 2026-05-28). Returnerer alle `PERMISSIONS` for `sitedoc_admin`, prosjekt-admin, og `firma_admin` på koblet `ProjectOrganization` — **uavhengig av om ProjectMember-rad finnes**. Tidligere asymmetri: firma-admin med `ProjectMember.role = "member"` i eget prosjekt fikk kun gruppe-permissions, mens `verifiserAdmin` ga full tilgang. Treffer 8+ UI-callsites som leser `tillatelser?.includes("manage_field")` (oppsett-sidebar, maler, tegninger, `OpprettOppgaveModal`)
- `eksternKostObjekt.list`: bruker `krevBrukersOrg(ctx.userId)` og filtrerer på `organizationId` — **firma-isolert, ikke prosjekt-isolert**. Designvalg: ECO er firma-bredt synlig på tvers av firmaets prosjekter (Proadm-import lager dem firma-globalt). Bruker som sender `projectId` for et prosjekt de ikke er medlem av (men er i samme firma) får fortsatt resultatet. Bevisst — ikke en manglende sjekk

## Firma-HMS-tilgang (Trinn 1–3 av firma-HMS-dashboard, 2026-05-29)

Tre tRPC-prosedyrer + én helper etablerer rolle-modellen `firmaRoller += "hms_ansvarlig"` på `OrganizationMember`. Ingen schema-endring — utvidelse av eksisterende array-felt.

**Helper (`apps/api/src/trpc/tilgangskontroll.ts`):**
- `harFirmaHmsTilgang(userId, organizationId): Promise<boolean>` — returnerer `true` for `sitedoc_admin`, `firma-admin` på orgId, eller bruker med `"hms_ansvarlig"` i `firmaRoller`. Eksportert; brukes av server-prosedyrer + klient-gating.

**tRPC-prosedyrer (`apps/api/src/routes/organisasjon.ts`):**
- `settFirmaHmsAnsvarlig({ userId, organizationId, harTilgang })` — speil av `settFirmaAdmin`. Skriver til `OrganizationMember.firmaRoller` via spread/filter. Krever firma-admin via `verifiserFirmaAdmin`. Sitedoc-admin-vern bevart.
- `harHmsTilgang({ organizationId }): boolean` — klient-side gating-query. Tynn wrapper rundt `harFirmaHmsTilgang`. Brukes i `firma/layout.tsx` for å skjule HMS-sidebar-lenke + i `firma/hms/page.tsx` for å vise «ingen tilgang»-tilstand.

**Ny prosedyre (`apps/api/src/routes/hms.ts`):**
- `hms.hentFirmaOversikt({ organizationId, prosjektIds?, byggeplassIds?, status?, subdomain? })` — aggregerer HMS-dokumenter på tvers av alle prosjekter i firmaet. Auth: `harFirmaHmsTilgang` → 403 FORBIDDEN ellers. **Bypass av `byggHmsSynlighetsFilter` og `byggTilgangsFilter`** — firma-rollen er auth-grunnlaget; firma-HMS ser alt inkl. private dokumenter. Returnerer `{ prosjekter, dokumenter: { avvik, sja, ruh }, statistikk: { apneAvvikPerProsjekt, sjaFrekvensPerMaaned, ruhRatePerMaaned, saksbehandlingstidMedianDager } }`. Asymmetri Task vs Checklist for byggeplass-filter (Task via `drawing.byggeplassId`, Checklist direkte).

**Synlighetsfilter-utvidelse (`byggHmsSynlighetsFilter`):**
Eksisterende filter (admin → null; HMS-gruppe-medlem → null; ellers privat-policy) utvidet med firma-HMS-bypass mellom HMS-gruppe-sjekk og fallback. Hvis prosjektet har `primaryOrganizationId` og brukeren har `harFirmaHmsTilgang` på den org-en, returneres `null` (full synlighet). Påvirker også prosjekt-nivå-HMS-siden.

**Byggeplass-filter på `hms.hentDokumenter` (HMS-byggeplass-filter, 2026-05-29):**
`hentDokumenter` utvidet med `byggeplassId: z.string().uuid().optional()`. Asymmetri-mønster:
- Task (HMS-avvik): `OR: [{ drawing: { byggeplassId } }, { drawingId: null }]` — Task har kun `drawingId`, ikke direkte byggeplass-felt.
- Checklist (SJA, RUH): `OR: [{ byggeplassId }, { byggeplassId: null }]` — Checklist har feltet direkte.
- Prosjekt-brede dokumenter (`null`) inkluderes alltid — de er relevante for arbeid på alle byggeplasser.
- Eksisterende Task-`OR` (bestillerFaggruppe vs null) konvertert til `AND: [...]`-struktur for å kombinere med byggeplass-`OR` uten Prisma-OR-konflikt.

**Audit-spor:** `hentFirmaOversikt` logger til `console.log` for hver oppslag. Activity-tabell-integrasjon krever schema-beslutning om null-projectId-policy og er ikke prioritert ennå.

## Impersonering audit (`ImpersonationAudit`-tabell, 2026-05-28)

`admin.startImpersonering` og `admin.stoppImpersonering` skriver til den isolerte `ImpersonationAudit`-tabellen (Variant B) — ikke `Activity`-tabellen. Designet holder `Activity` rent og gir spesifikke audit-felter uten å kreve null-projectId-policy.

**Skjema (`packages/db/prisma/schema.prisma`):**
- `adminUserId`, `targetUserId` — FK til `User` med `onDelete: RESTRICT` (audit kan ikke forsvinne ved User-sletting)
- `targetOrganizationId` — for fremtidig firma-filter
- `sessionId` — ren string uten FK (overlever `Session.delete()`)
- `startetVed`, `utloperVed` — tidssone-aware
- `avsluttetVed`, `avsluttetGrunn` — null mens aktiv; grunn er `"manuell"` ved eksplisitt stopp (utløps-markering utledes ved spørring)

**Skrive-prosedyrer:**
- `startImpersonering` — `INSERT` etter `Session.update`, defensiv `.catch` så audit-feil ikke blokkerer impersoneringen
- `stoppImpersonering` — `updateMany` med `WHERE adminUserId, sessionId, avsluttetVed: null` (idempotent — gjør ingenting hvis ingen aktiv rad)

**Lese-prosedyre + UI:** Ikke implementert — venter på tilgangs-oversikt-UX-sesjon. Tabellen er tilgjengelig via direkte SQL for `sitedoc_admin` i mellomtiden.

## Mobil session-token rotasjon (H1)

Mobil `Session.sessionToken` roteres ved aktiv bruk hvis token er eldre enn 7 dager. Implementert som tRPC-middleware (`mobilTokenRotasjon` i `apps/api/src/trpc/trpc.ts`) på `protectedProcedure` etter rate-limit-middleware. Reduserer worst-case eksponering ved token-lekkasje fra 30 dager til 7 dager. Deployet til prod 2026-05-27 (`29bdded8` + web-fix `43460d80`).

**Trigger-vilkår (alle må være sanne):**
- `type === "mutation"` — queries roterer aldri (for hyppig, ville generert mye DB-skriving)
- `ctx.tokenKilde === "bearer"` — kun mobil-sessions; web-cookie eies av Auth.js
- `ctx.sessionToken` er satt
- `session.lastRotatedAt < now - 7 dager`

**Hvordan klient mottar ny token:** Server setter `X-Session-Token`-respons-header via `responseMeta` på `fetchRequestHandler` (`apps/api/src/server.ts`). Mobil-klientens `httpBatchLink` i `apps/mobile/src/lib/trpc.ts` har custom `fetch` som leser headeren og kaller `lagreSessionToken(nyttToken)` (SecureStore på native, localStorage på web). Neste request bruker automatisk den nye tokenet via `headers()`-callback.

**Session-tabell-felter (fra migrasjon `20260527200000_session_rotation_tracking`):**
- `createdAt` — settes ved Session.create, røres aldri etter. Audit-spor for opprinnelig sesjon-alder.
- `lastRotatedAt` — oppdateres ved hver rotasjon. Middleware-terskelen sammenligner mot denne.

Backfill-strategi: eksisterende sessions fikk `created_at = last_rotated_at = expires - INTERVAL '30 days'` — worst-case-antagelse om at de er ~30 dager gamle.

**Race-vern:** Rotasjonen kjører `UPDATE sessions ... WHERE id = session.id AND session_token = oldToken`. Parallelle mutations som begge prøver å rotere får én vinner; tapere ser `count === 0` og ignorerer stille uten å velte handler-responsen.

**Web-flyten urørt:** `apps/web/src/app/api/trpc/[...trpc]/route.ts` setter `tokenKilde: "cookie"` slik at middleware hopper over. Auth.js eier web-cookie-rotasjon.

**Oppstart-rotasjon (`mobilAuth.verifiser`):** Kalles ved app-oppstart. Roterer alltid (uavhengig av 7-dagers terskel), forlenger `expires` med 30 dager, oppdaterer `lastRotatedAt`. Returnerer `nyttToken` i respons-body (egen mekanisme — verifiser-flyten er eldre enn middleware).

## Filopplasting

`/upload`-endepunkt (REST, ikke tRPC) i `apps/api/src/routes/upload.ts`:
- Krever autentisert sesjon (sjekker cookie/Authorization-header)
- Tillatte filtyper: `.pdf`, `.dwg`, `.dxf`, `.ifc`, `.png`, `.jpg`, `.jpeg`
- Maks 100 MB per fil
- UUID-baserte filnavn (forhindrer path traversal)
- Rate limiting: 30 forespørsler/minutt per IP
- Filer serveres med `X-Content-Type-Options: nosniff`

## Rate limiting

Minnebasert rate limiter i `apps/api/src/utils/rateLimiter.ts`. Automatisk opprydding hvert 5. minutt. Bruker `hentKlientIp(req)` som prioriterer `cf-connecting-ip`-header (Cloudflare Tunnel sender klient-IP der, ikke i X-Forwarded-For).

| Endepunkt | Grense | Per | Aktivert |
|-----------|--------|-----|----------|
| **Alle protectedProcedure-mutations** (default) | 100/min | userId | M1 (2026-05-27) |
| `organisasjon.inviterBruker` (`inviteProcedure`) | 10/min | userId | M1 (2026-05-27) |
| `prosjekt.opprett` + `opprettTestprosjekt` + `admin.opprettProsjekt` (`opprettProsjektProcedure`) | 20/min | userId | M1 (2026-05-27) |
| `/upload` | 30/min | cf-connecting-ip (Cloudflare) | Original |
| `mobilAuth.byttToken` | 10/min | cf-connecting-ip (Cloudflare) | Original |
| `invitasjon.validerToken` | 20/min | cf-connecting-ip (Cloudflare) | Original |
| `invitasjon.aksepter` | 10/min | cf-connecting-ip (Cloudflare) | Original |

**Merknader:**
- **Queries rate-limites ikke.** Middleware i `protectedProcedure` sjekker `type !== "mutation"` og skipper queries — read-only er trygt og typisk høyfrekvent.
- Throttle-hendelser logges via `ctx.req.log.info({ bucket, userId, path, retryAfterSeconds }, "rate-limit hit")` for telemetri.
- `inviteProcedure` og `opprettProsjektProcedure` arver også standard 100/min — strengeste limit vinner i praksis.
- Begrensning: per-userId only, ikke per-IP. Misbruk fra delt-IP-network (NAT, kontor) er ikke aggregert.

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

## Løste bugs

### React #310 — "Rendered more hooks than during the previous render"

**Status:** LØST 2026-04-14

**Symptom:** SpecPostTabell.tsx krasjet på re-render ved spesifikke datamønstre i økonomi-siden — typisk når kontrakt ble valgt.

**Løsning:**
- `useMemo` flyttet før early return (`SpecPostTabell.tsx` linje 503–515)
- Decimal→Number sanitisering (`SpecPostTabell.tsx` linje 196–219)
- `DebugErrorBoundary` lagt til i okonomi/page.tsx layout

**Commits:** `a70f03f`, `aa97c3e`, `dfc2da7`

**Referanser:** React-feilkode #310 = "Rules of Hooks"-brudd (hooks i betingelser/løkker eller etter early return).

## Firma påkrevd ved prosjekt-opprettelse (ufravikelig låst 2026-05-20)

Alle prosjekt-opprettelse-mutasjoner MÅ kreve `organizationId` for å hindre orphan-prosjekter (`primaryOrganizationId = null`). Steg 1 (fella — `organizationId: z.string().uuid()` **uten** `.optional()`) står inline i [CLAUDE.md § Viktige regler](../../CLAUDE.md). Fullt mønster:

1. Zod-input: `organizationId: z.string().uuid()` — **uten** `.optional()`
2. Project.create: `primaryOrganizationId: input.organizationId` (eller `valgtOrgId` etter tilgangs-sjekk)
3. Tilgangs-sjekk: `sitedoc_admin` → enhver org, vanlig bruker → kun egen org via `OrganizationMember`
4. Klient-side: UI-knapp `disabled` uten valgt firma + amber-banner som gjenbruker `t("nyttProsjekt.ingenFirma")` der det er relevant

Referanse-impl (fil + søkestreng, ikke linjenr — jf. dokumentasjons-standard.md § 7):
- `apps/api/src/routes/prosjekt.ts` — søk `opprett: opprettProsjektProcedure` og `opprettTestprosjekt: opprettProsjektProcedure` (begge setter `primaryOrganizationId: valgtOrgId` på `Project.create`).
- `apps/api/src/routes/admin.ts` — søk `opprettProsjekt: opprettProsjektProcedure` (setter `primaryOrganizationId: input.organizationId`).

Standalone-prosjekter beholdes (schema nullable for bakover-kompat); kun opprettelse-flyten er strammet — speil mønsteret ved ny opprettelse-mutasjon. Bakgrunn: 5 prod-orphans 2026-05-20.

## TS/tRPC-fallgruver

Flyttet fra CLAUDE.md § Kodestil 2026-07-10. Kjerneregelen står som peker der.

- **tRPC-include TS2589-fallgruve:** `user: { include: { organization } }` eller `user: true` triggrer «Type instantiation excessively deep» i tRPC-klient. Bruk alltid eksplisitt `user: { select: { id, name, ... } }`. Lærdom fra O-5c 2026-05-13. (Den opprinnelige `MapperPanel.tsx:154`-referansen lot seg **ikke** re-verifiseres 2026-07-10 — `user: {`-include-mønsteret finnes ikke i fila (søkt: hele fila) — så eksakt kildested er fjernet. Mønsteret er uansett generelt.)
- **Prisma-felt-cleanup-verifikasjon:** grep alene er ikke pålitelig — filtrerer ut `where: { felt: ... }` med `-v "felt:"`. Kjør alltid `npx tsc --noEmit` etter schema-endring og bruk typecheck som sannhetskilde for gjenstående bruks-steder. Lærdom fra O-5b → O-5b-fix → O-5c (grep ga to oversette runder).
