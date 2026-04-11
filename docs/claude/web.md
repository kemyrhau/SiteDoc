# Web — Next.js frontend

## UI-arkitektur

Tre-kolonne layout (skjules på mobil < 768px, hamburger-meny i Toppbar):

```
+----------------------------------------------------------+
| TOPPBAR: [SiteDoc] [Prosjektvelger v]     [Bruker v]    |
+------+------------------+--------------------------------+
| IKON | SEKUNDÆRT PANEL  | HOVEDINNHOLD                   |
| 60px | 280px            | Verktøylinje: [Opprett] [...]  |
|      | - Filtre         |                                |
| Dash | - Statusgrupper  | Tabell / Detaljvisning         |
| Sjekk| - Søk            |                                |
| Oppg |                  |                                |
| Maler|                  |                                |
| Tegn |                  |                                |
| Entr |                  |                                |
| Mapp |                  |                                |
| Opps |                  |                                |
+------+------------------+--------------------------------+
```

## Ruter

```
/                                             -> Landingsside (hero, CTA). Innloggede → /dashbord
/logg-inn                                     -> OAuth (klient-side signIn())
/aksepter-invitasjon?token=...                -> Aksepter invitasjon (Server Component)
/personvern                                   -> Personvernerklæring (GDPR)
/utskrift/sjekkliste/[sjekklisteId]           -> PDF-forhåndsvisning sjekkliste (A4, ?print=true auto-print)
/utskrift/oppgave/[oppgaveId]                 -> PDF-forhåndsvisning oppgave (A4, ?print=true auto-print)
/dashbord                                     -> Prosjektliste (→ kom-i-gang hvis ingen prosjekter)
/dashbord/kom-i-gang                          -> Velkomstside for nye brukere
/dashbord/nytt-prosjekt                       -> Opprett prosjekt
/dashbord/[prosjektId]                        -> Prosjektoversikt (m/prøveperiode-banner)
/dashbord/[prosjektId]/sjekklister            -> Sjekkliste-tabell
/dashbord/[prosjektId]/sjekklister/[id]       -> Sjekkliste-detalj (utfylling + print)
/dashbord/[prosjektId]/oppgaver               -> Oppgave-tabell
/dashbord/[prosjektId]/oppgaver/[id]          -> Oppgave-detalj
/dashbord/[prosjektId]/maler                  -> Mal-liste
/dashbord/[prosjektId]/maler/[id]             -> Malbygger
/dashbord/[prosjektId]/entrepriser            -> Entreprise-liste
/dashbord/[prosjektId]/mapper                 -> Mapper (read-only, ?mappe=id, filopplasting m/fremdriftsindikator via XMLHttpRequest progress)
/dashbord/[prosjektId]/tegninger              -> Interaktiv tegningsvisning
/dashbord/[prosjektId]/3d-visning            -> Samlet 3D-visning (IFC + punktsky + overflater + kutt/fyll)
/dashbord/[prosjektId]/tegning-3d            -> Split-view tegning + 3D-modell med koordinatsynk og georeferanse
/dashbord/[prosjektId]/punktskyer            -> Redirect → /3d-visning
/dashbord/[prosjektId]/modeller              -> Redirect → /3d-visning
/dashbord/[prosjektId]/bilder                 -> Bildegalleri (liste + tegningsvisning)
/dashbord/[prosjektId]/okonomi               -> Økonomi: 4 faner (Oversikt, Avviksanalyse, Rapport, Dokumenter). Kontrakt påkrevd (auto-velg hvis kun én). Oversikt: spec-poster med piltast-nav, sammenligning, overskridelsesmarkering, NS-kode arv, gul prikk (●) ved postnr der split-dokumentasjon finnes. Dobbeltklikk rad → detaljmodal med dokumentasjon-seksjon ("Åpne dokumentasjon (X sider)" + kildeliste "A-nota 4: s.1-3"), NS-kode panel med NS 3420-oppslag. Rapport-fane: Innestående-tabell. Dokumenter-fane: Nr-kolonne, inline type-editor
/dashbord/[prosjektId]/sok                   -> Dokumentsøk: AI-søk (NorBERT hybrid vektor+leksikalsk+re-ranking) med fallback til tekstsøk. Modusveksler, NS-dokumentfilter (dropdown med enkeltdokumenter), dedup per dokument, søkeord-highlighting, dobbelt-klikk åpner original. Tilgangskontrollert via hentTilgjengeligeMappeIder
/dashbord/[prosjektId]/mapper                -> Mapper: dokumentliste med embedding-statusindikator + oversettelsestatus (grønn prikk/spinner på BookOpen-ikon). Les-knapp åpner Reader View
/dashbord/[prosjektId]/dokumenter/[id]/les   -> Dokumentleser (Reader View): PDF-sider med bilder rendres som hele sidebilder (pdftoppm 150 DPI + sharp JPEG 80%), rene tekstsider viser headings/tekst. Språkvelger, fallback til nb, nedlastingsknapp. Sammenlign-panel for oversettelsesmotorbytte. ?embed=true for mobil WebView
/dashbord/[prosjektId]/dokumentleser         -> Dokumentleser med mappenavigering: venstre panel (mappetreet + dokumentliste med flagg), høyre panel (inline Reader View)
/dashbord/oppsett/ai-sok                     -> AI-søk innstillinger: embedding-status, generer/stopp, NorBERT/OpenAI modellvalg, LLM-konfig, recall/precision/latency sliders
/dashbord/oppsett                             -> Innstillinger
/dashbord/oppsett/brukere                     -> Kontakttabell med grupper (default kollapsert). Sticky header: «+ Ny gruppe» + «Inviter ny» (inline form med fornavn/etternavn/e-post/telefon/firma). Modul-badges direkte klikkbare for toggle (sjekklister/oppgaver/tegninger/3D). Firma-dropdown i redigeringsvisning (endrer organizationId på brukernivå, inkl. «+ Nytt firma»). Firmaansvarlig via rolle-dropdown. Skjold: blått=Admin, gult=Firmaansvarlig. Legg til person i gruppe via custom dropdown (ikke native select). HjelpKnapp øverst til høyre
/dashbord/oppsett/brukere/tillatelser         -> Tillatelsesmatrise (read-only)
/dashbord/oppsett/lokasjoner                  -> Lokasjonsliste med georeferanse
/dashbord/oppsett/produksjon                   -> Produksjon-oversikt (tidligere field/)
/dashbord/oppsett/produksjon/dokumentflyt      -> Dokumentflyt (roller med tilpassbare labels, maler per flyt, medlemmer). Sidebar viser Dokumentflyt (ikke Kontakter) under Produksjon
/dashbord/oppsett/produksjon/entrepriser       -> Entrepriser med dokumentflyt. Hovedansvarlig markeres med blå prikk (erHovedansvarlig). hovedansvarligPersonId for person innenfor gruppe. Dropdown i dokumentflyt viser kun personer og brukergrupper (ikke entrepriser/systemgrupper). Feilmelding ved sletting med tilknyttede dokumenter
/dashbord/oppsett/produksjon/oppgavemaler      -> Oppgavemaler
/dashbord/oppsett/produksjon/sjekklistemaler   -> Sjekklistemaler
/dashbord/oppsett/produksjon/moduler           -> Forhåndsdefinerte mal-pakker
/dashbord/oppsett/produksjon/psi              -> PSI-oppsett: Multi-byggeplass støtte (én PSI per byggeplass), deaktiver/reaktiver (soft delete), kopier mal til annen byggeplass, QR-kode per byggeplass, gjestebeskjed-editor, auto-opprett standardmal med 8 seksjoner. Vises under Produksjon når modul er aktiv
/dashbord/oppsett/produksjon/psi/[psiId]/mal  -> Malbygger i PSI-modus: filtrert palett (kun PSI-typer), bredere config-panel (480px), bildeopplasting, større textarea, "INNHOLD"-labels, forhåndsvisningspanel (560px) med seksjonsnavigering, tilbake-knapp til PSI-oppsett, språkvelger (Psi.languages) + auto-oversett-knapp
/dashbord/[prosjektId]/psi                   -> PSI-dashboard: Byggeplassfaner, signaturtabell med HMS-kort-kolonne, statistikk (fullført/pågår/utdatert)
/psi/[prosjektId]                            -> Offentlig PSI-side for gjester (QR): Byggeplassvalg, HMS-kort felt + "Har ikke HMS-kort"-avkrysning, gjestebeskjed-visning, Forrige/Neste-navigering mellom seksjoner → quiz → signatur. Språkvelger filtrert til PSI-ens languages. Innhold rendres via oversatt()/oversattOptions() med fallback til norsk
/dashbord/oppsett/produksjon/mapper            -> Mappeoppsett: tre-visning, kontekstmeny (ny undermappe, rediger tilgang, gi nytt navn, koble til kontrakt, slett). Mapper koblet til kontrakt viser blått ikon + kontraktnavn
/dashbord/oppsett/prosjektoppsett             -> Prosjektoppsett
/dashbord/oppsett/firma                       -> Firmainnstillinger
/dashbord/admin                               -> SiteDoc-admin (kun sitedoc_admin)
/dashbord/admin/firmaer                       -> Firmaer
/dashbord/admin/prosjekter                    -> Alle prosjekter (m/prøveperiode-kolonner)
/dashbord/admin/testsider                     -> Testsider (prøveprosjekter uten firma, aktive/deaktiverte)
/dashbord/admin/tillatelser                   -> Global tillatelsesmatrise
/dashbord/firma                               -> Firma-admin
/dashbord/firma/prosjekter                    -> Firmaets prosjekter
/dashbord/firma/brukere                       -> Firmaets brukere
/dashbord/firma/fakturering                   -> Fakturering (placeholder)
```

## Kontekster og hooks

- `ProsjektKontekst` — Valgt prosjekt fra URL `[prosjektId]`, alle prosjekter, loading
- `ByggeplassKontekst` — Aktiv byggeplass + `standardTegning` (persistent, localStorage) + `aktivTegning` (visning). Posisjonsvelger: `startPosisjonsvelger(feltId)` → `fullførPosisjonsvelger(resultat)` → `hentOgTømPosisjonsResultat(feltId)`
- `BilderKontekst` — Visningsmodus (liste/tegning), plasseringsmodus (rapportlokasjon/GPS), datofilter, områdevalg
- `TreDViewerKontekst` — Persistent IFC 3D-viewer som lever i prosjekt-layouten. Holder modellStatuser, valgtObjekt, skjulteObjekter, aktiveFiltre, viewerRef (ViewerAPI). `ViewerCanvas`-komponenten rendres i 3d-visning/page.tsx men Three.js-scenen overlever navigasjon mellom ruter fordi all state og OBC-initialisering styres av konteksten. Typer, konstanter og hjelpefunksjoner er ekstrahert til separate filer under `3d-visning/`.
- `NavigasjonKontekst` — Aktiv seksjon + verktøylinje-handlinger
- `useAktivSeksjon()` — Utleder seksjon fra pathname
- `useVerktoylinje(handlinger)` — Registrerer handlinger per side med auto-cleanup
- `useAutoVaer(...)` — Auto-henter værdata fra Open-Meteo

## Flerspråklig støtte (i18n)

**Teknologi:** `i18next` + `react-i18next`, initialisert i `apps/web/src/lib/i18n.ts`

**Språk:** 14 støttet (nb, en, sv, lt, pl, uk, ro, et, fi, cs, de, ru, lv, fr). Norsk (nb) er kilde, engelsk (en) har manuell oversettelse. Andre språk genereres via `packages/shared/src/i18n/generate.ts` med Google Translate.

**Oversettelserfiler:** `packages/shared/src/i18n/nb.json` og `en.json` (~600 nøkler)

**Arkitektur:**
- `SpraakVelger` i Toppbar — dropdown med flagg + språknavn
- `SpraakSynkroniserer` i Providers — synkroniserer localStorage ↔ DB
- `bruker.hentSpraak` / `bruker.oppdaterSpraak` — tRPC-endepunkter
- `User.language` felt i Prisma (default "nb")
- Lazy-loading: kun nb og en er statisk importert, andre lastes on-demand
- `StatusBadge` i `packages/ui` bruker `useTranslation()` direkte

**Konvensjoner:**
- Nøkkelstruktur: `seksjon.nøkkel` (f.eks. `nav.dashbord`, `status.utkast`, `handling.lagre`)
- Statiske data utenfor komponenter bruker `labelKey` i stedet for `label`, kaller `t()` ved rendering
- Interpolering: `t("dashbord.proveperiode", { dager: X })`
- Nye strenger: legg til i **både** `nb.json` og `en.json`

**Oversatte sider:** Alle hovedsider, navigasjon, statuspaneler, modaler, malbygger, innstillinger, prosjektoppsett

## Oversettelsessystem (3 lag)

### Lag 1: UI-strenger (i18n)
Standard `i18next` + `react-i18next`. Alle UI-tekster i JSON-filer. Automatisk basert på `User.language`.

### Lag 2: Mal-innhold → arbeider (on-demand)
Firmainnhold (feltlabels, hjelpetekst, valgalternativer) oversettes on-demand når arbeider trykker 🌐-knappen.
- **Trigger:** 🌐-knapp i FeltWrapper, kun synlig når `User.language !== Project.sourceLanguage`
- **API:** `mal.oversettFelter` — batch-oversetter med TranslationCache
- **Visning:** Oversettelse under originaltekst (blå, italic). Erstatter ikke — viser begge
- **Motor:** Prosjektets konfigurasjon (OPUS-MT standard, Google/DeepL valgfritt)
- **Cache:** TranslationCache (SHA-256) — oversetter kun én gang per tekst per språkpar
- **Hook:** `useOversettelse` i `apps/web/src/hooks/useOversettelse.ts` (web) og `apps/mobile/src/hooks/useOversettelse.ts` (mobil) — kobler FeltWrapper til API. Web bruker `i18n.language`, mobil bruker `useAuth().bruker.language`

### Lag 3: Fritekst → firma (automatisk)
Arbeiderens fritekst auto-oversettes til prosjektspråket ved lagring.
- **Trigger:** Automatisk i `oppdaterData` (sjekkliste + oppgave) når `User.language !== Project.sourceLanguage`
- **Lagring:** `verdi` = oversettelse (prosjektspråk), `original` = { spraak, verdi, kommentar }
- **Visning:** Prosjektspråk som hovedtekst, original i grå boks under
- **Felttyper:** `text_field` verdier + `kommentar` på alle felttyper
- **Forbedring:** `forbedreOversettelse` mutation — manuell redigering ELLER re-oversett med bedre motor (DeepL)
- **Beskyttelse:** Admin-redigering overskrives ikke ved neste lagring (original-sjekk)

### Språkinnstillinger
- **Prosjekt.sourceLanguage:** Kildespråk (firma definerer). Velges i Prosjektoppsett
- **Folder.languages:** Målspråk per mappe (for dokumentoversettelse). Arv via `languageMode` (inherit/custom)
- **Folder.languageMode:** "inherit" arver fra forelder, "custom" har egne innstillinger
- **User.language:** Brukerens UI-språk (14 valg)
- **FtdDocument.detectedLanguage:** Auto-detektert språk fra innhold
- **FtdDocument.languageConfirmed:** Bruker har bekreftet språkavvik

### Språkdeteksjon
- `apps/api/src/services/spraak-deteksjon.ts` — ordfrekvens-basert, ~60 ord per språk, 14 språk
- Returnerer ISO 639-1 kode. Terskel: 3% treffrate
- Ved avvik mot prosjektspråk: varsel i dokumentlisten med 3 valg (bekreft+oversett, bekreft uten oversettelse, bruk forventet)

### Språkarv i mapper
- `apps/api/src/services/folder-spraak.ts` — `resolverSpråk()` med syklusdeteksjon (visited-set)
- Går opp foreldrekjeden til nærmeste `languageMode = "custom"` ancestor
- Rot med inherit → kun prosjektets kildespråk
- Batch: `resolverAlleSpråk()` for hele prosjektet

## Layout-komponenter

- `Toppbar` — Klikkbar logo (→ `/`), prosjektvelger, brukermeny, `SpraakVelger`, hamburgermeny (mobil). Admin: ShieldCheck-ikon, Firma: Building2-ikon
- `HovedSidebar` — 60px ikonbar (`hidden md:flex`), deaktiverte ikoner uten prosjekt
- `SekundaertPanel` — 280px panel (`hidden md:flex`)
- `Verktoylinje` — Kontekstuell handlingsbar

## Paneler

- `DashbordPanel` — Prosjektliste med søk
- `SjekklisterPanel` — Statusgruppe-filtrering, standard-tegning badge
- `OppgaverPanel` — Status- og prioritetsgrupper
- `MalerPanel` — Malliste med søk
- `EntrepriserPanel` — Entrepriseliste med søk
- `TegningerPanel` — Byggeplass+tegningstrevisning med etasje-gruppering, stjerne-standard
- `BilderPanel` — Visningsmodus-toggle (liste/tegning) + tegningsvelger med byggeplass/etasje-tre
- `MapperPanel` — Klikkbar mappestruktur med søk

## Malbygger

Drag-and-drop i `apps/web/src/components/malbygger/`: `MalBygger`, `FeltPalett`, `DropSone`, `DraggbartFelt`, `FeltKonfigurasjon`, `BetingelseBjelke`, `TreprikkMeny`.

- **Faste felt** (metadata): Emne, Bestiller-entreprise, Lokasjon — vises øverst i «Faste felt»-seksjonen med øye-toggle (`showSubject`, `showEnterprise`, `showLocation` på `ReportTemplate`)
- **Lokasjon settes IKKE i opprettelsesmodal** — settes automatisk fra tegning ved klikk, eller kobles etterpå via tegningsvisning. Byggeplass/tegning-dropdown er fjernet fra opprettelseskjema (web + mobil)
- Rekursiv `RekursivtFelt`-rendering med nesting
- Repeater: grønn ramme, uten BetingelseBjelke
- Slett-validering: blokkeres ved bruk (JSONB `?|` operator)
- Rekkefølge: topptekst-sone først, deretter datafelter
- Entreprise-dropdown i opprettelse viser kun brukerens entrepriser (`hentMineEntrepriser`)

## Opprettelsesflyt — ett-klikk

Oppgaver og sjekklister opprettes med ett klikk — velg mal, alt annet utledes automatisk:
- **Bestiller-entreprise**: Første fra `hentMineEntrepriser`
- **Utfører-entreprise**: Utledes fra dokumentflyt som matcher malen og bestiller-entreprisen
- **Tittel**: Settes til malnavn (nummer vises separat i Nr-kolonne)
- **Prioritet**: Default "medium"
- **Lokasjon**: Settes fra tegning (ved klikk) eller kobles etterpå — ALDRI i opprettelsesmodal
- **Emne/beskrivelse**: Redigeres etterpå i detaljvisningen

Etter opprettelse navigeres brukeren direkte til detaljsiden for å begynne registrering. Ingen skjemamodal med felter — kun mal-picker.

## Lokasjon i detalj

`LokasjonVelger`-komponent (`apps/web/src/components/LokasjonVelger.tsx`): klikkbar lokasjon-rad i oppgave/sjekkliste-detalj.
- Viser byggeplass + tegning (eller "Ikke satt")
- Klikk → modal med byggeplass/tegning-velger + tegningsvisning
- For oppgaver: klikk på tegning for å plassere punkt (positionX/Y)
- API: `oppgave.oppdater` og `sjekkliste.oppdater` aksepterer `drawingId`, `positionX`, `positionY`, `buildingId`

## Tabellvisning — konfigurerbar kolonnevelger

Oppgave- og sjekkliste-lister bruker konfigurerbar tabellvisning med:

**Velg parameter** — modal med søkefelt og tre grupper:
- **Kolonner**: Prefix, Løpenummer, Tittel, Status, Flyt, Emne, Ansvarlig, Opprettet av, Entrepriser, Mal, Datoer
- **Posisjon**: Byggeplass, Etasje, Tegning (separate kolonner)
- **Verdier**: Dynamiske felt fra malenes `ReportObject`-er (`list_single`, `traffic_light`, `integer`, `decimal`, `text_field`, `person`, `signature`, `calculation`, etc.)
- **Spesialformatering**: Trafikklys 🟢🟡🔴, dato nb-NO format, signatur ✓/—, person/firma-navn (ikke ID)

**Flyt-kolonnen**: `FlytIndikator`-komponent per rad. Filtrering/sortering via `hentFlytLedd()`.

**Ansvarlig** = hvem som har dokumentet nå: `recipientUser` → `recipientGroup` → fallback `responderEnterprise`. Oppdateres ved videresending.

**Resizable kolonner**: Dra-håndtak i header. Header-styling: `bg-gray-100`, `border-b-2`, `text-[11px] font-semibold tracking-wider`. `table-layout: fixed`.

**Filtrering**: Dropdown per kolonne (filter-ikon i header). Verdier bygges dynamisk fra data. Filter-tags vises over tabellen med × og nullstill.

**Sortering**: Klikk header for å sortere opp/ned.

**Lagring**: `useTabelloppsett` hook — aktive kolonner og bredder lagres i database per bruker (`User.tabelloppsett` JSON). Debounced saving (800ms). Migrering fra localStorage automatisk.

## Standardemner (EMNE_KATEGORIER)

Forhåndsdefinerte emnekategorier i `@sitedoc/shared`: HMS (14), Kvalitet (15), Befaring (6), Godkjenning (6). I malbyggeren velges kategori via dropdown → fyller `subjects`-arrayen automatisk. Emner vises som tags med × for fjerning. Øye-toggle skjuler emne-feltet.

## E-postvarsling

Ved sending og videresending av oppgaver/sjekklister sendes e-post til mottaker (person eller alle i gruppe) via Resend. Inneholder dokumentinfo, avsendernavn, kommentar og direktelenke. Fire-and-forget — blokkerer ikke statusendring.

## Dokumentheader og handlingsknapper

### Header-layout (sticky)
Detaljsider (sjekkliste/oppgave) har sticky header med tre rader:
- **Rad 1:** Prefix+nummer (bold grå) · Tittel (truncate) · LagreIndikator · Dato (skjult på mobil) · StatusBadge
- **Rad 2:** FlytIndikator (kompakt på mobil, full på desktop)
- **Rad 3:** Handlingsknapper (DokumentHandlingsmeny) · Skriv ut-ikon

Layout: `<main>` har `px-6 pb-6` (IKKE pt) slik at `sticky top-0` fester seg helt øverst. Listesidene har `pt-6` på rot-div.

### FlytIndikator
Kompakt flytvisning. Viser alle ledd med ● på aktiv boks. Aktiv boks-format: `● Elektro · HE-Leder` (entreprise først, deretter person/gruppe med · separator).
- **Web:** `apps/web/src/components/FlytIndikator.tsx` — desktop (full) + mobil (`kompakt` prop, aktiv + naboer, tap for full)
- **Mobil (React Native):** `apps/mobile/src/components/FlytIndikator.tsx` — native View, kompakt, blå bar
- Brukes i listevisning (tabellkolonne), web detaljside-header, og mobil detaljside-header
- `hentFlytLedd()` eksportert for filtrering/sortering i tabeller
- Data: `dokumentflyt.medlemmer` med `steg`, `rolle`, `enterprise`, `projectMember`, `group`

### DokumentHandlingsmeny — Posisjon-basert logikk
Handlingsknapper basert på brukerens **posisjon i flyten** (`apps/web/src/components/DokumentHandlingsmeny.tsx`).

**Knapper per status:**

| Status | Første/midtre boks | Siste boks (godkjenner) |
|--------|-------------------|------------------------|
| draft | `[Send ▾]` + `[Slett]` | — |
| sent | `[Trekk tilbake]` | — |
| received/in_progress | `[Send ▾]` (entrepriser + send tilbake) | `[Send ▾]` (svar avsender + videresend) |
| responded | — | `[Godkjenn]` + `[Avvis]` + `[Send ▾]` |
| approved | `[Lukk]` + `[Videresend ▾]` | — |
| cancelled | `[Gjenåpne]` + `[Slett]` | — |

**Send-dropdown innhold:**
- Primærmottaker (entreprisenavn fra `byggVideresendValg()`)
- Separator + "Send tilbake" (kun midtre boks, `in_progress`)
- Separator + andre entrepriser (videresend)

**Admin-seksjon:** Registrator/admin ser "Admin"-header i dropdown med:
- Alle flytbokser (kan sende til hvilken som helst)
- Manuelle statusendringer (Godkjenn, Lukk, Trekk tilbake, Gjenåpne)

**Bekreftelse-modus:** Klikk på handling → kommentarfelt + Bekreft/Avbryt. Responsiv: stacker vertikalt på mobil.

**Nøkkelbegreper:**
- `null`-rolle = lesevisning (ingen knapper)
- "Trekk tilbake" = `sent → cancelled` (ikke "Avbryt" som er UI-avbryt)
- **API:** `gruppe.hentMinFlytInfo` returnerer `userId`, `projectMemberId`, `entrepriseIder`, `gruppeIder`, `erAdmin`
- **API-validering:** `verifiserFlytRolle()` sjekker rolle før statusendring (403 ved mismatch)
- **Videresend med flytbytte:** Oppdaterer `dokumentflytId` + `utforerEnterpriseId` automatisk
- `cancelled → draft` er gyldig overgang (gjenåpning)

### Rettighetsbasert UI (leser/redigerer/admin)

`utledDokumentRettighet()` i `@sitedoc/shared/utils/flytRolle.ts` bestemmer hva brukeren kan gjøre:

| Steg | Sjekk | Resultat |
|------|-------|----------|
| 1 | Admin / registrator | `"admin"` (alltid full tilgang) |
| 2 | Terminal status (closed/approved/cancelled) | `"leser"` |
| 3 | Kladd + edit-tillatelse | `"redigerer"` / `"leser"` |
| 4 | Har ikke ballen | `"leser"` |
| 5 | `DokumentflytMedlem.kanRedigere = false` | `"leser"` |
| 6 | Gruppetillatelse (`checklist_edit`/`task_edit`) | `"redigerer"` / `"leser"` |

**Fallback:** Brukere uten gruppemedlemskap (`tillatelser.size === 0`) får redigering hvis de har ballen — forhindrer blokkering av eksisterende flyter.

**harBallen:** `recipientUserId === userId` eller `recipientGroupId in gruppeIder`. I kladd: `bestillerUserId === userId`.

**Hooks:** `useOppgaveSkjema(id, rettighetInput?)` og `useSjekklisteSkjema(id, rettighetInput?)`. Valgfri `rettighetInput` — uten den faller hooken tilbake til gammel status-basert logikk (bakoverkompatibilitet for mobil).

**kanRedigere-toggle:** I dokumentflyt-oppsettet (kontaktsiden) vises en toggle per flytmedlem: "Redigerer" (default, grå) / "Leser" (amber). Settes via `dokumentflyt.settKanRedigere` mutation. Gjelder per flytledd — en gruppe kan være redigerer i én flyt og leser i en annen.

### Responsiv tilpasning (mobil)
- Tittel: `text-base` + truncate 60vw (desktop: `text-lg`)
- Dato: skjult på mobil (`hidden sm:inline`)
- Redaktør-indikator: viser kun antall på mobil, fullt navn på desktop
- FlytIndikator: kompakt modus (aktiv + naboer), desktop: full
- Knapper på egen rad (ikke inline med FlytIndikator)
- Bekreftelse: vertikal stack, kommentarfelt full bredde
- Beskrivelse: `line-clamp-2` på mobil

### TODO: Mobilapp
Mobilappen bruker `hentStatusHandlinger()` direkte — skal migreres til posisjon-basert logikk med `utledMinRolle()`.

## Bildevedlegg

- Lightbox i web: klikk thumbnail → fullskjerm med navigering (piler) og slett-knapp
- Sletting fra vedlegg: fjerner fra `data`-JSON OG fra `images`-tabellen via `bilde.slettMedUrl`
- Bilder med GPS men uten tegningskobling: plasseres via georeferanse-fallback i Rapportlokasjon-modus

## Print-til-PDF

### Arkitektur
Dedikerte utskriftssider: `/utskrift/sjekkliste/[sjekklisteId]` og `/utskrift/oppgave/[oppgaveId]`. Åpnes via `window.open(url + "?print=true", "_blank")` fra detaljsider.

**Auto-print (`?print=true`):** Viser spinner ("Forbereder utskrift…") på skjerm, A4-innhold `hidden print:block`. Triggerer `window.print()` etter 500ms. Lukker fanen automatisk via `afterprint`-event.

**Manuell forhåndsvisning (uten `?print=true`):** Verktøylinje med "Skriv ut / Lagre PDF"-knapp + "Åpne sjekkliste/oppgave"-lenke.

### Table-layout for gjentakende header/footer
Utskriftsidene bruker `<table>` med `<thead>` (header gjentas på hver side) og `<tfoot>` (sidenummer via CSS counter). `@page { margin: 0; size: A4; }` fjerner nettleserens URL/dato.

**CSS-klasser:**
- `.print-tabell` — wrapper for table-layout
- `.print-footer` — footer med CSS counter: `content: "Side " counter(page)`
- `.print-no-break` — `break-inside: avoid` for felt
- `.print-skjul` — `display: none !important` i print
- `.print-sideskift` — `page-break-after: always` (batch-utskrift)
- `.a4-ark` — 794px bredde, 15mm padding, visuell sidekant via `::after`
- `print-color-adjust: exact` — bevarer farger i print

**Layout-reset i print:** `html, body, #__next, .min-h-screen { min-height: 0 !important }`. Sidebar, toolbar og header skjules.

### Header (styrt av utskriftsinnstillinger)
Logo, prosjektnummer · prosjektnavn, lokasjon · tegning, dato med klokkeslett, dokumenttittel, fra→til, vær. Alle felt kan skjules via prosjektoppsett (`Project.utskriftsinnstillinger` JSON).

**Utskriftsinnstillinger** (`/dashbord/oppsett/prosjektoppsett`): 7 avkrysninger — logo, eksternProsjektnummer, prosjektnavn, fraTil, lokasjon, tegningsnummer, vaer. Lagres på Project-modellen. Default: alle synlige.

### Tegningsutsnitt og bilder
**TegningPosisjonPrint** (eksportert fra `RapportObjektVisning.tsx`): oversikt med rød markør + zoomet detalj (4x zoom). Bruker `useTegningSomBilde()` hook (PDF→canvas→PNG via pdfjs-dist v4).

**Oppgave-tegningsvisning:** Viser 2 bilder side om side — oversikt (med markør) + utsnitt (3x zoom sentrert på posisjon).

**Bildegrid** (`.bilde-grid`): 2 kolonner, `object-fit: contain`, `max-height: 260px`. Bilder beskjæres ikke. Grid brytes fritt over sider. Individuelle `.bilde-celle` har `break-inside: avoid`.

### Feltvisning
**FeltRad:** Tomme felt (`tom=true`) returnerer `null` — kun utfylte felt vises i utskrift.

**Layout-prinsipp:** Feltlabel+verdi i `print-no-break` (ubrytbar). Vedlegg (`FeltVedlegg`) utenfor `print-no-break` — bildegrid kan brytes naturlig over sider.

### Batch-utskrift
`/dashbord/[prosjektId]/sjekklister/skriv-ut?ider=id1,id2,...` — flere sjekklister på én utskrift med `print-sideskift` mellom. Maks 10 parallelle queries. Bruker `PrintHeader`-komponent (ikke inline header).

### Tekniske detaljer
- **ProsjektId-oppslag:** Sjekkliste bruker `template.projectId`, oppgave bruker `bestillerEnterprise.projectId`
- **Fil-URL-mønster:** `logoSrc`/`vedleggSrc` konverterer `/uploads/x` → `/api/uploads/x` (Next.js rewrite). Opplasting via `POST /api/upload`
- **Sjekkliste vs oppgave:** Sjekkliste har vær-felt i header. Oppgave har prioritet-felt og oversikt+utsnitt-tegning

**Data-attributter:** `data-panel="sekundaert"`, `data-toolbar`.

## Tegningsvisning

Interaktiv visning med musesentrert zoom (0.25x–50x / 25%–5000%):

**SVG-rendering (DWG-konverterte tegninger):**
- Inline SVG via `dangerouslySetInnerHTML` (ikke `<img>` — kreves for zoom-uavhengig strektykkelse)
- Injisert CSS: `stroke-width: calc(1.5 / var(--svg-zoom, 1)) !important` — tynne linjer uansett zoom
- `--svg-zoom` CSS-variabel settes på container via `style={{ "--svg-zoom": zoom }}`
- SVG hentes, width/height fjernes, erstattes med `width="100%" height="auto"`
- Originale `<style>`-blokker fjernes, egen zoom-aware style injiseres
- SVG-elementer har `data-layer` (lagnavn) og `data-type` (entitetstype) attributter fra DWG-konverteringen

**Zoom og panorering:**
- Multiplikativ scroll-zoom: `faktor = deltaY > 0 ? 0.8 : 1.25`, `zoom * faktor`
- Musesentrert: beregner innholdspunkt under musen, justerer scrollLeft/scrollTop etter zoom
- Zoom-nivåer for knapper: [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5, 10, 20, 50]
- Klikk på prosenttall tilbakestiller til 100%
- Dra-for-å-panorere: venstre museknapp + dra (>5px) panorerer tegningen
- Pan/klikk-skilling: musedown-posisjon lagres, onClick ignoreres hvis bevegelse >5px
- useEffect med `[tegningId, isLoading]` dependencies — registrerer wheel/pointer-handlers når container mountes etter data-lasting

**Klikkemodus (toggle i verktøylinjen, kun SVG-tegninger):**
- **Oppgave** (standard): klikk plasserer blå markør → opprett-modal (oppgave/sjekkliste)
- **Inspeksjon**: klikk på SVG-element viser DWG-egenskaper (lag, type, tekstinnhold) i popup. Elementer med `data-layer` får bredere stroke (5px) og blå hover-highlight. For TEXT/MTEXT-elementer hentes tekstinnholdet fra DOM via `target.textContent`
- Eksisterende markører: røde MapPin fra `oppgave.hentForTegning`
- PDF: Pressable overlay (ikke injisert JS) for koordinatregistrering

**PDF→PNG auto-konvertering:**
- PDF-tegninger konverteres automatisk til PNG ved opplasting (pdftoppm, 200 DPI)
- Konvertering skjer asynkront med `conversionStatus: "converting" → "done"/"failed"`
- Georeferering gjøres alltid på PNG — sikrer at web og mobil bruker identisk koordinatsystem
- `UPLOADS_DIR` env-variabel peker til `apps/api/uploads/` (påkrevd for Next.js server-side)
- Server-krav: `poppler-utils` (pdftoppm) installert

**GPS-koordinater (georefererte tegninger):**
- Tegninger med `geoReference` viser live GPS-koordinater i headeren ved musebevegelse
- Bruker `tegningTilGps()` fra `@sitedoc/shared` med tegningens transformasjon
- Fungerer for ALLE georefererte tegninger (ikke bare "Utomhus"-gruppert)
- Grønn MapPin-ikon + monospace koordinater (lat, lng med 6 desimaler)

**IFC-metadata:**
- Klikkbar "IFC"-badge i header viser uttrukket metadata (prosjekt, org, GPS, etasjer, programvare)
- Data fra `Drawing.ifcMetadata` (Json-felt, uttrukket ved opplasting)

### Kartvisning og bildeeksport (implementert)

Tredje visningsmodus i Bilder-seksjonen: kart med markører for bilder med GPS.

**Kartvisning:** `BildeKart.tsx` — Leaflet-kart med 📷-markører. Klikk åpner popup med thumbnail. Dynamic import (SSR-safe).

**Velgemodus:**
- Klikk markør = toggle valgt (grønn ✓)
- Shift+dra = rektangelvalg for flere bilder
- Sidepanel (280px) viser valgte bilder sortert etter dato med metadata
- Eksporter-knapp åpner utskriftsvennlig HTML (2 bilder per rad, kompakt metadata, A4)

### Planlagt: Kartfilter og utvidet eksport

**Dynamisk filtersystem for kartvisning:**
- **Byggeplass** — dropdown, filtrer bilder etter hvilken byggeplass de tilhører (via sjekkliste/oppgave → building_id)
- **Rapportmal** — dropdown, filtrer etter mal (template_id på sjekklisten/oppgaven)
- **Datoperiode** — fra/til datovalg (datoFra/datoTil finnes allerede i BilderKontekst)
- Filtrene bør ligge i en kompakt verktøylinje over kartet, eller i BilderPanel
- Filtrene er dynamiske — byggeplasslisten hentes fra prosjektet, mallisten fra tilgjengelige maler

**Utvidet eksport — forsideinformasjon:**
- Prosjektnavn, prosjektnummer, adresse
- Byggeplass bildene tilhører
- Dato-range for utvalget
- Antall bilder
- Valgfri: kartutsnitt med markerte posisjoner (Leaflet canvas export)

**Datakrav:** `NormalisertBilde` trenger utvidelse med `byggeplassId`, `byggeplassName`, `templateId`, `templateName` for filtrering. Disse kan utledes fra `parentId` (sjekkliste/oppgave) → building_id/template_id. Kan kreve utvidelse av `bilde.hentForProsjekt`-queryen.

**Berører:** `BildeKart.tsx`, `page.tsx` (KartVisningMedValg), `BilderPanel.tsx`, `apps/api/src/routes/bilde.ts`

## Malliste-UI

Delt `MalListe`-komponent: +Tilføy (dropdown), Rediger, Slett, Søk. Enkeltklikk velger, dobbeltklikk åpner.

## 3D-visning (samlet side)

Samlet 3D-visningsside `/dashbord/[prosjektId]/3d-visning` med tre faner.

**Filstruktur (etter fase 1-refaktorering):**
- `typer.ts` — Alle interfaces (ValgtObjekt, ModellStatus, ViewerAPI, etc.)
- `konstanter.ts` — INTERNE_FELT, ifcFilCache, KLASSE_FARGER, QUANTITY_ENHETER
- `hjelpefunksjoner.ts` — hentNavn, hentVerdi, formaterVerdi, finnIfcTypeKode, parseLandXMLFil
- `komponenter/EgenskapsPopup.tsx` — Flytende egenskapspanel for valgt objekt
- `komponenter/FilterChipBar.tsx` — Chip-bar for aktive filtre/skjulte objekter
- `page.tsx` — Tynt skall med fane-bar, sidebar og delegering til kontekst
- `kontekst/tred-viewer-kontekst.tsx` — Provider (state) + ViewerCanvas (Three.js/OBC)

### Fane 1: 3D-modell (IFC + punktsky)
Sammenslått IFC-viewer som laster ALLE prosjektets IFC-modeller i én @thatopen-scene. Avmerkingsbokser styrer synlighet per modell. `TreDViewerKontekst` holder all viewer-state i prosjekt-layouten slik at Three.js-scenen overlever navigasjon.

**Layout:** Sidepanel (280px, IFC-modeller med checkboxes + punktskyer) + 3D-viewer + flytende egenskapspanel.

**IFC-funksjonalitet:** Klient-side WASM-parsing, objektvelging med highlight, klippeplan (snitt). Norske IFC-kategorinavn i egenskapspanelet. Prioriterte attributter vises øverst. Scrollbart panel med større visningsområde.

**3D-visning som modul:** 3D-visning er en modul (`3d-visning`, kategori `funksjon`) i `PROSJEKT_MODULER`. Deaktivert som standard — aktiveres per prosjekt via Innstillinger > Feltarbeid > Moduler. Sidebar-ikonet for 3D skjules når modulen er deaktivert.

**@thatopen initialisering (kritisk rekkefølge):**
1. `components.init()` — initialiserer Components-systemet
2. `SimpleScene.setup({ backgroundColor, ambientLight, directionalLight })` — MÅ kalles for lys (constructor alene legger ikke til lys)
3. `fragmentsManager.init("/fragments-worker.mjs")` — starter worker for tile-basert rendering
4. `ifcLoader.settings.autoSetWasm = false` — forhindrer at unpkg overskriver lokal WASM-bane
5. `ifcLoader.settings.wasm = { path: "/", absolute: true }` — peker til lokale WASM-filer i `public/`
6. Etter lasting: `model.useCamera(threeCamera)` — påkrevd for LOD/tile-lasting
7. Render-løkke: `fragmentsManager.core.update()` via `requestAnimationFrame` — oppdaterer tiles
8. `scene.add(model.object)` — legger modellens Object3D til scenen manuelt

**Modell-lasting (ytelsesoptimalisert):**
- Alle IFC-filer lastes ned parallelt (`Promise.all`) — nettverks-I/O
- WASM-parsing skjer sekvensielt (web-ifc er enkelttrådet)
- Lasting uten `addAllAttributes()`/`addAllRelations()` — gir rask parsing uten feil
- Rå IFC-data (Uint8Array) lagres per modell for on-demand egenskapsoppslag
- `clipper.create(world)` kalles eksplisitt på `dblclick` — Clipper har ingen auto-lytter

**Objektklikk og egenskaper (on-demand via web-ifc):**
- `hitModel.getItem(localId)` → `item.getCategory()` for rask IFC-type
- Dedikert `WEBIFC.IfcAPI()`-instans åpner IFC-data on-demand ved klikk
- `propsApi.properties.getItemProperties()` → element-attributter
- `propsApi.properties.getPropertySets()` → PropertySets med verdier (HasProperties/HasQuantities)
- `propsApi.properties.getTypeProperties()` → type-egenskaper
- Web-ifc instans og åpne modeller caches mellom klikk for rask respons
- IFC-typekode konverteres til lesbart navn via WEBIFC-konstanter (IFCWALL → "Wall")
- Interne felt (OwnerHistory, ObjectPlacement, Representation) filtreres bort

**Raycasting og objektvelging:**
- Raycast itererer kun synlige modeller via `model.raycast()` — skjulte modeller blokkerer ikke klikk
- **VIKTIG:** `model.raycast()` og `fragmentsManager.raycast()` forventer rå `clientX`/`clientY` pikselkoordinater (IKKE NDC -1 til 1). Internt konverterer de via `dom`-elementet. Å sende NDC gir treff på helt feil objekter
- Three.js `Raycaster` krasjer på fragment-geometri (BufferAttribute.getX på zero-length) — IKKE bruk
- Skjulte modeller MÅ fjernes fra scene (`scene.remove`), ikke bare `.visible = false` — fragments raycast ignorerer visible-flagg
- `synligeModeller` Set sporer hvilke modeller som er synlige

**Skjulte IFC-typer:** `IfcSpace` (rom-volumer) og `IfcOpeningElement` (hull i vegger) skjules automatisk via `model.setVisible(ids, false)` etter lasting. web-ifc `GetLineIDsWithType()` finner element-IDer. `IfcBuildingElementPart` (isolasjon, platekledning etc.) beholdes synlig — noen kan "lekke ut" visuelt (f.eks. isolasjonslag over tak).

**Kontekstdrevet filtersystem:**
Brukeren kan skjule enkeltobjekter eller filtrere på tvers av alle modeller basert på IFC-kategori, lag (layer) eller system. Tre typer state:

1. `skjulteObjekter` — array av `{modelId, localId, kategori, navn}`, sporer individuelt skjulte objekter. EyeOff-knappen i EgenskapsPopup legger til her.
2. `aktiveFiltre` — array av `{type: 'kategori'|'lag'|'system', verdi: string}`, representerer batch-filtre. FilterChipBar viser alle aktive filtre/skjulte objekter som chips med X-knapp.
3. `FilterChipBar` — kompakt bar mellom verktøylinjen og 3D-canvas, vises KUN ved aktive filtre/skjulte objekter. Nullstill-knapp gjenoppretter alt.

ViewerRef-metoder for filtrering:
- `visObjekt(modelId, localId)` — gjenopprett enkeltobjekt
- `skjulAlleAvKategori(ifcTypeKode)` / `visAlleAvKategori(ifcTypeKode)` — batch-vis/skjul alle av en IFC-type via `GetLineIDsWithType`
- `skjulAlleAvLag(lagNavn)` / `visAlleAvLag(lagNavn)` — batch-vis/skjul via `IFCPRESENTATIONLAYERASSIGNMENT`
- `skjulAlleAvSystem(systemNavn)` / `visAlleAvSystem(systemNavn)` — batch-vis/skjul via `IFCRELASSIGNSTOGROUP`

Filterknapper (EyeOff-ikoner) i EgenskapsPopup ved kategori-header, Layer og System attributter. `finnIfcTypeKode()` konverterer lesbart kategorinavn tilbake til WEBIFC-konstant (caches ved init).

**Egenskapsoppslag (on-demand via web-ifc):**
- Klikkkoordinater (Øst/Nord/Høyde) fra `hitResult.point`
- Type via `IfcRelDefinesByType` → `RelatingType.Name`
- Layer via `IfcPresentationLayerAssignment` → traverserer `IfcProductDefinitionShape.Representations`
- System via `IfcRelAssignsToGroup` → `RelatingGroup.Name` (IfcSystem/IfcDistributionSystem)
- Foreldre-element via `IfcRelAggregates` for underdeler (BuildingElementPart etc.) — henter foreldrens PropertySets, TypeProperties og BaseQuantities
- Quantity-enheter: LengthValue→mm, AreaValue→m², VolumeValue→m³, WeightValue→kg

**Solo-modus:** Layers-ikon per modell i sidepanelet. Klikk → skjuler alle andre modeller. Klikk igjen → viser alle.

**3D-markør:** Rød sfære (radius 0.15, `depthTest: false`, `renderOrder: 999`) plasseres på `hitResult.point` (det faktiske treffpunktet fra raycast). Fjernes ved klikk utenfor objekt.

**Objekt-highlight:** Blå semi-transparent overlay (`#3b82f6`, opacity 0.6) via `hitModel.highlight([localId], material)`. Resettes ved nytt klikk.

**Render-løkke:** `requestAnimationFrame` → `fragmentsManager.core.update()` (oppdaterer LOD-tiles basert på kamera). Idle-deteksjon pauser render-loop når kamera ikke beveger seg. Visibilitetspause stopper rendering når fanen ikke er synlig — reduserer strømforbruk.

**Z-fighting fiks:** Camera `near`/`far` settes dynamisk basert på modellstørrelse for å unngå z-fighting artefakter.

**Filer i `public/`:** `web-ifc.wasm`, `web-ifc-mt.wasm`, `fragments-worker.mjs`

**Avhengigheter:** `@thatopen/components`, `@thatopen/fragments`, `web-ifc`, `three`, `potree-core`

### Fane 2: Overflatemodeller
Vis triangulerte overflater (TIN) fra LandXML-filer i 3D.

**LandXML-parser** (`src/lib/landxml-parser.ts`): Parser `<Surface>` → `<Pnts>` + `<Faces>` med `fast-xml-parser`. Returnerer `TINData` (vertices + triangles + bbox).

**Punktsky-triangulering** (`src/lib/punktsky-triangulering.ts`): Subsample + Delaunay-triangulering med `delaunator`.

**Avhengigheter:** `fast-xml-parser`, `delaunator`

### Fane 3: Kutt/fyll-analyse
Sammenlign to overflatemodeller med rød/blå visualisering og volumberegning.

**Kutt/fyll-algoritme** (`src/lib/kutt-fyll.ts`):
1. Finn overlappende bounding box
2. Regulært rutenett (konfigurerbar oppløsning: 0.5m–5m)
3. Barycentric interpolasjon for Z-verdier
4. ΔZ > 0 → fyll (rød), ΔZ < 0 → kutt (blå)
5. Volum = Σ(|ΔZ| × celleAreal)

**Layout:** Sidepanel (280px, overflatevalg + oppløsning + resultat) + 3D-viewer med rød/blå differansemesh.

### Navigasjon
Erstatter separate `/punktskyer` og `/modeller`-ruter. Gamle URLer redirectes via `next.config.js`. Sidebar viser én "3D"-knapp i stedet for to.

### Persistent 3D-viewer (Fase 1 — implementert)

`ViewerCanvas` lever i prosjekt-layouten (`/dashbord/[prosjektId]/layout.tsx`), ikke i page.tsx. Three.js-scene, WebGL-kontekst og lastede IFC-modeller overlever navigasjon mellom ruter.

- **Layout:** ViewerCanvas rendres permanent i layout med `absolute inset-0`. Vis/skjul med CSS basert på `usePathname().endsWith("/3d-visning")`
- **Children:** Page-innhold (sidepanel, verktøylinje, filter-bar) rendres over vieweren med `pointer-events-none` på wrapper, `pointer-events-auto` på interaktive elementer
- **Bakgrunnslasting:** IFC-modeller begynner lasting så snart prosjektet åpnes, uavhengig av aktiv rute. Når bruker navigerer til 3D-visning er modellene ofte allerede lastet
- **Verktøylinje og filter-bar:** Flyttet fra ViewerCanvas til page.tsx (`Fane3DModell`-komponenten)

## Dokumenttidslinje

Visuell tidslinje i sjekkliste- og oppgave-detaljsider. Delt komponent `DokumentTidslinje.tsx`:
- Vertikal linje med prikker per hendelse (blå for siste, grå for eldre)
- Viser avsender → mottaker (person/gruppe) per overføring
- Status-badges, kommentarer, tidspunkt
- Data fra `DocumentTransfer` (kronologisk, `asc`)
- API inkluderer `recipientUser` og `recipientGroup` i transfer-queries

## Feltvis merge (samtidighetsbeskyttelse)

`oppdaterData`-mutasjonene (sjekkliste + oppgave) bruker **feltvis merge** i transaksjon:
1. Henter fersk `data` fra DB inne i transaksjonen
2. Merger innsendte felt: `{ ...eksisterende, ...input.data }`
3. Lagrer merget resultat

Forhindrer at samtidige brukere overskriver hverandres endringer på ulike felt.

## Sanntids presence (WebSocket)

WebSocket-tilkobling til Fastify API (`/ws?token=...`) for å vise hvem som redigerer samme dokument.

**Arkitektur:**
- `apps/api/src/services/presence.ts` — in-memory store (transient)
- `apps/api/src/routes/ws.ts` — WebSocket-endepunkt med auth + meldingshåndtering
- `apps/web/src/kontekst/presence-kontekst.tsx` — React context med WS-tilkobling
- `apps/web/src/hooks/usePresence.ts` — hook for dokumentspesifikk presence

**Meldingsprotokoll:**
- Klient→Server: `join` (åpner dokument), `leave` (lukker), `heartbeat` (30s)
- Server→Klient: `presence` (liste over aktive brukere per dokument)

**UI:** Amber pille med pulserende blyantikon + navn i dokumentheader (sjekkliste/oppgave).

**URL-logikk:** `test.sitedoc.no` → `wss://api-test.sitedoc.no/ws`, `sitedoc.no` → `wss://api.sitedoc.no/ws`

**Auto-reconnect:** Eksponentiell backoff (1s→2s→4s→...→30s maks). Ventende joins sendes på nytt ved reconnect.

## Sjekkliste-endringslogg

`enableChangeLog` på mal → server-side diff i `oppdaterData` → `ChecklistChangeLog`-poster. `EndringsloggSeksjon` i detaljsiden.

## Oppgavedialog

Kommentarseksjon med `TaskComment`. `DialogSeksjon` med innlinjet tekstfelt, Enter sender.

## Automatisk værhenting

`useAutoVaer` → `trpc.vaer.hentVaerdata` (Open-Meteo, gratis). Kl. 12:00, kilde: "automatisk"/"manuell".

## Prosjektlokasjon og kartvelger

`KartVelger.tsx`: Leaflet + OpenStreetMap, `dynamic(ssr: false)`. Prosjektoppsett: firmalogo, generell info, kartvelger.

## LokasjonObjekt og TegningPosisjonObjekt

Begge i `SKJULT_I_UTFYLLING` — kun lesemodus/print.
- `location`: Leaflet-kart + adresse
- `drawing_position`: Navigasjonsbasert velger via `ByggeplassKontekst`

## Bildegalleri

Samlet oversikt over alle bilder i prosjektet. To visningsmodus:

**Listevisning (standard):** Alle bilder sortert etter dato (nyeste først), gruppert dato → rapport. GPS-varsel (AlertTriangle) på bilder utenfor alle georefererte tegninger. Datofilter med hurtigvalg.

**Tegningsvisning:** Velg tegning fra sidepanelet, bilder vises som prikker på tegningen. Verktøylinje med:
- Plasseringsmodus: "Rapportlokasjon" (solid blå prikker fra drawingId+positionX/Y) eller "GPS" (stiplet prikker via gpsTilTegning())
- Datoperiode-filter med hurtigvalg
- Områdevalg: dra rektangel for å filtrere bilder i et område
- Zoom (0.25x–3x)

`BildeLightbox`: Fullskjerm overlay med pil-navigering, metadata, rapport-lenke. Escape lukker.

## Byggeplassvelger (toppbar)

`ByggeplassVelger` i `apps/web/src/components/layout/ByggeplassVelger.tsx`.
Dropdown i toppbar etter prosjektvelger. Auto-velger første byggeplass.
Lagrer valg per prosjekt i localStorage via `ByggeplassKontekst`.

Byggeplassvalg påvirker:
- 3D-viewer (filtrerer IFC-modeller)
- Tegning+3D split-view (filtrerer tegninger)
- Sidebar: 3D og Tegning+3D skjules hvis byggeplass ikke har IFC
- API-filtrering: oppgaver, sjekklister og bilder filtrerer på `aktivByggeplass.id`

## Tegning+3D split-view

Rute: `/dashbord/[prosjektId]/tegning-3d`

Split-screen med plantegning (venstre) og 3D-modell (høyre).
Draggbar skillelinje.

**PDF-rendering (pdf.js canvas):**
- Canvas-basert rendering via pdf.js (erstattet iframe)
- Zoom mot musepeker — punktet under pekeren forblir fast
- Auto-fit PDF til container ved oppstart
- Full scroll-zoom og panorering

**Live kamera-tracking (blå prikk):**
- Blå prikk på tegningen viser kameraposisjon
- **Inkrementell delta-tracking:** Startposisjon fra klikk (presis), bevegelse via `treDDeltaTilTegning` (lineærdel av similarity-transform, ingen absolutt offset)
- Absolutt `treDTilTegning` har kjent offset — brukes IKKE for posisjon
- `flyTil`-animasjon pauses i 600ms for å unngå at animasjonsframes tolkes som brukerbevegelse
- Hint "Klikk på tegningen for å plassere kamera" vises uten markør

**IFC GPS-kalibrering** (`gpsOverride` JSON-felt på Drawing):
- **4-stegs klikk-kalibrering:** Klikk 2 matchende punkt-par (tegning → 3D) → beregner similarity-transform (a, b, tx, tz) som mapper tegning-% til 3D xz-koordinater. Håndterer posisjon, rotasjon, skalering og speiling automatisk
- **Finjustering:** Klikk 1 punkt-par → korrigerer bare tx/tz (offset) uten å endre rotasjon/skala
- **Grov kalibrering:** Hent GPS fra georeferert tegnings sentrum (ett klikk)
- **Manuell input:** WGS84, UTM eller Norgeskart-format
- **Tilbakestill:** Fjern override, tilbake til IFC-metadata GPS
- API: `tegning.settGpsOverride` / `tegning.fjernGpsOverride`

**Kamerakontroller (førsteperson):**
- Venstreklikk-drag: roter rundt ståsted (target 2 enheter foran kamera, settes ved pointerdown)
- Høyreklikk-drag: truck/pan (sidelengs bevegelse, standard orbit-kontroll)
- Scroll: `ctrl.forward()` langs blikkretning (hastighet 2.5, symmetrisk). Bruker IKKE dolly (som begrenses av target)
- Hjelpefunksjoner: `blikkretning()` (kopi, ikke muter), `oppdaterTarget()` (2 enheter foran)

**Kamerahøyde-kalibrering:**
- Klikk på gulv i 3D for å kalibrere kamerahøyde
- Lagres i localStorage per byggeplass

**Etasjeklipp:**
- OBC `Clipper.createFromNormalAndCoplanarPoint()` klipper modellen horisontalt
- Viser kun valgt etasje i 3D-vieweren

**Koordinatbro** (`@sitedoc/shared/utils/koordinatBro.ts`):
- `gpsTil3D(gps, ifcOrigin, system, hoyde)` — GPS → Three.js
- `tredjeTilGps(punkt3d, ifcOrigin, system)` — Three.js → GPS
- `wgs84TilUtm/wgs84TilNtm` — WGS84 → UTM/NTM projeksjon
- `tegningTil3D` / `treDTilTegning` — direkte similarity-transform (forward=presis, invers=har offset)
- `treDDeltaTilTegning` — lineærdel for inkrementell tracking (presis)

**Georeferanse:**
- Georeferanse-redigering skjer KUN i Lokasjoner-siden (`/dashbord/oppsett/lokasjoner`)
- Tegning-3d viser kun status: "Georeferert" (grønt) eller "Georeferér i Lokasjoner"
- Støtter 3+ punkter: affin transformasjon med `ekstraPunkter`-array, viser kalibreringsfeil i meter

**Tilgangskontroll:**
- Georeferanse og kalibrering kun tilgjengelig for felt-admin (`manage_field`/`drawing_manage`)

## Brukergrupper (oppsett)

Brukergrupper under Oppsett → Brukere. Opprettet via «+ Ny gruppe».
Modulikoner med tooltip (sjekklister, oppgaver, tegninger, 3D).

**Rettigheter per gruppe:**
- Moduler: sjekklister, oppgaver, tegninger, 3D (default alle på)
- Byggeplassfilter: velg spesifikke byggeplasser (null = alle)
- Gruppeadmin: `isAdmin` på `ProjectGroupMember` — badge + toggle i brukergrupper-UI (`settGruppeAdmin` mutation)
- Slett: kun feltarbeid-admin

**Dokumentflyt:**
- Opprett/send og Mottaker: bruker eller gruppe (ikke entreprise)
- Dokumentflyt kobles til entreprise via `forvalgtEntrepriseId` på bestiller-medlemmet
- Entrepriser fjernet fra sidebar — kun i Oppsett

**Entreprise fargevelger:**
- 20 forhåndsdefinerte farger i opprettelsesveiviseren

## Mer-meny

⋮-knapp: Prosjektinnstillinger (admin), Skriv ut, Eksporter (TODO).
