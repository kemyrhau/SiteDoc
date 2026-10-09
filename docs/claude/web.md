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
/dashbord/[prosjektId]/maler                  -> Mal-liste (lese-og-bruk). Opprettelse skjer IKKE her — mal-CRUD ligger i Oppsett › Produksjon (setter kategori/prefiks). «Hent fra arkiv»-knapp åpner `HentFraArkivModal` (firma-/SiteDoc-arkiv-faner, gatet av `arkivTilgang`). `feat/hent-fra-arkiv` 2026-09-12
/dashbord/[prosjektId]/maler/[id]             -> Mal-lesevisning (IKKE malbygger). Redusert fra byggeren 2026-09-12 — bygging skjer i Oppsett › Produksjon. Begge inngangene overlever som lesevisning
/dashbord/[prosjektId]/faggrupper             -> Faggruppe-liste (tabell m/opprett/rediger/slett-modaler, faggruppeNummer, org.nr, dokumenttellere). Erstatter den gamle «entrepriser»-ruten — «entreprise» er forbudt i ny kode
/dashbord/[prosjektId]/mapper                 -> Mapper (read-only, ?mappe=id, filopplasting m/fremdriftsindikator via XMLHttpRequest progress)
/dashbord/[prosjektId]/tegninger              -> Interaktiv tegningsvisning. DWG/DXF → SVG (libredwg, DWG-2): måling rett fra tegningens enheter ($INSUNITS, «fra tegningens enheter»), layouts klippet pr. viewport. Header har revisjonsliste (`RevisjonsListe`, D6b): klikk en tidligere revisjon → forrige fil skrivebeskyttet i modal, inkl. arkiverte DWG-layouts
/dashbord/[prosjektId]/3d-visning            -> Samlet 3D-visning (IFC + punktsky + overflater + kutt/fyll)
/dashbord/[prosjektId]/tegning-3d            -> Split-view tegning + 3D-modell med koordinatsynk og georeferanse
/dashbord/[prosjektId]/punktskyer            -> Redirect → /3d-visning
/dashbord/[prosjektId]/modeller              -> Redirect → /3d-visning
/dashbord/[prosjektId]/kontrollplan            -> Kontrollplan: matrisevisning (områder × maler gruppert etter milepæl) + listevisning (toggle). UkeVelger-kalender, flervalg-opprettelse, inline milepæl/område, fristflytting
/dashbord/[prosjektId]/bilder                 -> Bildegalleri (liste + tegningsvisning)
/dashbord/[prosjektId]/okonomi               -> Økonomi: 4 faner (Oversikt, Avviksanalyse, Rapport, Dokumenter). Kontrakt påkrevd (auto-velg hvis kun én). Oversikt: spec-poster med piltast-nav, sammenligning, overskridelsesmarkering, NS-kode arv, gul prikk (●) ved postnr der split-dokumentasjon finnes. Dobbeltklikk rad → detaljmodal med dokumentasjon-seksjon ("Åpne dokumentasjon (X sider)" + kildeliste "A-nota 4: s.1-3"), NS-kode panel med NS 3420-oppslag. Rapport-fane: Innestående-tabell. Dokumenter-fane: Nr-kolonne, inline type-editor
/dashbord/[prosjektId]/hms                   -> HMS-modul: 4 faner (Avvik, SJA, RUH, Statistikk). Dokumenttabeller per subdomain (avvik/sja/ruh) m/åpen/lukket-status, byggeplassfilter, KPI-kort + måned-søyler + faggruppe-bars. «Meld HMS»-dropdown velger HMS-mal (category="hms") og oppretter direkte (opprett=send). Bruker hms.hentDokumenter
/dashbord/[prosjektId]/timer                 -> Timeliste (firma timer-modul): ukevisning m/forrige/neste-navigering, statusfilter (draft/sent/returned/accepted), dagsseddel-rader m/aktivitet og totaltimer. Undersider: /[id] (dagsseddel-detalj), /ny (ny dagsseddel), /attestering (+ /[id]), /godkjenning
/dashbord/timer/mine, /dashbord/timer/[id], /dashbord/timer/ny -> Arbeiderens egne dagssedler. /[id] = dagsseddel-detalj (page.tsx): rad-dialog m/matpause-avkrysning (V20-W, PK3 — «Matpause trukket», radens pauseMin driver timetallet, PK1), «Arbeidstid i dag» utledet av radene (PK7, ikke hodet), pause-felt fjernet fra Rediger-hode-dialogen. Rad-lista viser kryss/tom avkrysning pr. rad. Attesteringsvisningen (`/attestering`, `SeddelKort` + attesteringsdetalj) viser matpause-avkrysningen skrivebeskyttet på bæreren via `MatpauseRadMerke` (V20-W TILLEGG 2). Se timer.md § V20 leveranse W
/dashbord/[prosjektId]/vareforbruk           -> Vareforbruk (firma varelager-modul): registrerings-liste m/dato, vare, antall, byggeplass, eksternt kostobjekt. Opprett/rediger/slett via modal. Bruker vareforbruk-routeren
/dashbord/[prosjektId]/sok                   -> Dokumentsøk: AI-søk (NorBERT hybrid vektor+leksikalsk+re-ranking) med fallback til tekstsøk. Modusveksler, NS-dokumentfilter (dropdown med enkeltdokumenter), dedup per dokument, søkeord-highlighting, dobbelt-klikk åpner original. Tilgangskontrollert via hentTilgjengeligeMappeIder
/dashbord/[prosjektId]/mapper                -> Mapper: dokumentliste med embedding-statusindikator + oversettelsestatus (grønn prikk/spinner på BookOpen-ikon). Les-knapp åpner Reader View
/dashbord/[prosjektId]/dokumenter/[id]/les   -> Dokumentleser (Reader View): PDF-sider med bilder rendres som hele sidebilder (pdftoppm 150 DPI + sharp JPEG 80%), rene tekstsider viser headings/tekst. Språkvelger, fallback til nb, nedlastingsknapp. Sammenlign-panel for oversettelsesmotorbytte. ?embed=true for mobil WebView
/dashbord/[prosjektId]/dokumentleser         -> Dokumentleser med mappenavigering: venstre panel (mappetreet + dokumentliste med flagg), høyre panel (inline Reader View)
/dashbord/innstillinger                       -> Innstillinger-hub (navigasjonsredesign, branch redesign/navigasjon): FIRMA/PROSJEKT-seksjoner m/kort + underlenke-chips, søk + segmentert filter [Alt|Firma|Prosjekt], seksjonsfarge-headere (blå/amber), gating (kanAdministrereFirma / prosjektId / firmamoduler / manage_field m/admin-registrator-bypass som speiler HovedSidebar). Direkte nåbar via URL; synlig nav gates av nyNavigasjon-flagget (hook useNyNavigasjon: localStorage + ?nyNav=1, eneste flaggkilde). Hjelpetekst. Spec: docs/redesign/redesign-handoff.md + redesign-paritetssjekkliste.md
/dashbord/prosjekter, /dashbord/prosjekter/[id]/* -> Legacy-rutetre (K9-opprydding): server-redirects til kanonisk /dashbord/[prosjektId]/* (Toppmeny.tsx slettet — var død kode). Redirects beholdes til redesign er utrullet
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
/dashbord/oppsett/produksjon/hmsmaler          -> HMS-maler (egen topp-nivå-type, category="hms"; subdomain avvik/sja/ruh + hmsSynlighet). D3-vedtak 2026-07-24
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
/dashbord/firma                               -> Firma-admin (oversikt + integrasjonsstatus)
/dashbord/firma/prosjekter                    -> Firmaets prosjekter
/dashbord/firma/brukere                       -> Firmaets brukere (rolleskifte user↔company_admin)
/dashbord/firma/fakturering                   -> Fakturering (placeholder)
/dashbord/firma/innstillinger                 -> Innstillinger (redigerbar firmainformasjon + ?-hjelp)
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

**Språk:** støttes per `STOETTEDE_SPRAAK` i `packages/shared/src/i18n/index.ts` (kanon-liste med flagg). Norsk (nb) er kilde, engelsk (en) har manuell oversettelse. Andre språk genereres via `packages/shared/src/i18n/generate.ts` med Google Translate.

**Oversettelserfiler:** `packages/shared/src/i18n/nb.json` og `en.json`

**Arkitektur:**
- `SpraakVelger` i Toppbar — dropdown med flagg + språknavn
- `SpraakSynkroniserer` i Providers — synkroniserer localStorage ↔ DB
- `bruker.hentSpraak` / `bruker.oppdaterSpraak` — tRPC-endepunkter
- `User.language` felt i Prisma (default "nb")
- Lazy-loading: kun nb og en er statisk importert, andre lastes on-demand
- `StatusBadge` i `packages/ui` bruker `useTranslation()` direkte. Tar valgfri `lestAvMottakerVed`-prop — viser «Lest» med dato-tooltip når status er `sent` og mottaker har åpnet dokumentet

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

## Opprettelsesflyt — ett-klikk (P4b, 2026-07-29)

Oppgaver og sjekklister opprettes med **maks 2 klikk før utfylling** (ideal 1). «Opprett»-knappen (`useVerktoylinje`) → dokumentet opprettes som utkast → detaljsiden i **utfyllingsmodus**. Alt utledes fra kontekst; overstyring skjer INNE i utfyllingen, aldri som forhåndssteg. Auto-utledet ved opprett:
- **Bestiller-/utfører-faggruppe**: fra valgt dokumentflyt (flyt-kandidat)
- **Tittel**: malnavn (løpenummer vises separat, `sjekkliste.ts` `number`-kolonne → `prefix-NNN`)
- **Byggeplass/tegning**: aktiv header-kontekst (`useByggeplass` — sjekkliste tar `byggeplassId`+`drawingId`, oppgave kun `drawingId`)
- **Prioritet**: default «medium»

**Auto-hopp (`åpneMalVelger` i `sjekklister/page.tsx` + `oppgaver/page.tsx`):**
- Nøyaktig 1 opprettbar mal → opprett direkte (1 klikk).
- Flere maler → sist-brukt-signal (`useSistBrukteMal`, hooks/) avgjør. Entydig treff → opprett direkte (1 klikk); ellers ETT mellomvalg (mal-velger, 2 klikk). Aldri gjett blindt.
- ⚠️ **`useSistBrukteMal` er KLIENT-LOKAL INTERIM** (localStorage, nøkkel per bruker+flyt) — flyttes server-side hvis/når malbytte-saken bygger server-støtte.
- ⚠️ Toppknappens onClick bruker en **ref** (`åpneMalVelgerRef.current()`), ikke funksjonen direkte: `useVerktoylinje` re-registrerer kun ved deps-endring, så en direkte referanse frøs en stale `åpneMalVelger` (tom data) → auto-hopp utløstes aldri (gjaldt òg P2s 1-mal-auto-hopp). Fikset 2026-07-30.

**Flyt-gruppert mal-velger:** ved flere registrator-flyter grupperes velgeren per dokumentflyt (flyt = overskrift v/≥2, maler under) — klikk entydig, ingen steg-2. Klient-side invertering av `mal.opprettbareFlytIder`.

**pkt 0 — tilgjengelighets-filter (server, delt kilde):** `mal.hentForProsjekt` (`api/routes/mal.ts`) returnerer additivt `opprettbar` + `opprettbareFlytIder`, utledet via `hentBrukersOpprettFlytMedlemskap` (`tilgangskontroll.ts` — SAMME fn opprett-valideringen avviser på). Velgeren + auto-hopp tilbyr KUN opprettbare maler; utilgjengelige skjules bak «vis utilgjengelige (N)» m/grunn. HMS-maler alltid opprettbare. **Ikke hard-filter** — mal-admin trenger alle. Mobil `MalVelger` arver samme kall. Bakgrunn: mal-velgeren tilbød maler som ble avvist ved innsending (Kenneth-mobiltest).

**Malhenting fra arkiv (én modal, `feat/hent-fra-arkiv` 2026-09-12):** all henting av maler til et prosjekt går nå via `HentFraArkivModal` (`components/bibliotek/`) med to faner — Firmaarkiv og SiteDoc-arkiv — gatet av `arkivTilgang` (prosjektadmin: kun firmaarkiv; firmaadmin: begge; vanlig medlem: ingen; standalone-prosjekt m/`organizationId=null`: ingen SiteDoc-fane). Erstatter både «Importer fra firma»-dropdown-valget (foldet inn i modalen) og det gamle **`BibliotekPanel.tsx` som er SLETTET** — det bar to-nivå-hoppet arkiv→prosjekt, mot Kenneths vedtak «lån kun fra nivået rett over». 🔴 **Tilsiktet funksjonsbortfall:** prosjektadmin mister direkteimport fra NS 3420-biblioteket (vedtatt, ikke regresjon). Steg 3 versjonspublisering er egen runde.

**Kontekst-chip-linje i utfyllingsmodus:** `DokumentKontekstChipLinje` (`components/kontekst-chip/`, delt m/ P4c timer, bygd på hevede trakt-primitiver fra `KontekstChip`) viser prosjekt · byggeplass · faggruppe · mal øverst på detaljsiden. Byggeplass/faggruppe = velgere (overstyring via eksisterende `oppdater`-mutasjon; faggruppe kun i utkast). Redigerbar tittel (blyant → input, Enter/blur lagrer). **Mal-chip = display-only** — malbytte etter opprettelse krever ny server-mutasjon (`templateId`-bytte + sjekkpunkt-migrering), backlogget som egen sak.

Ingen skjemamodal med felter — kun (evt.) mal-velger. Emne/beskrivelse/lokasjon redigeres i detaljvisningen.

**Oppgave fra felt — flere oppgaver pr. felt (C, 2026-10-07):** Et felt kan ha FLERE oppgaver — hver vises som en egen blå chip, og `+Oppgave` blir stående ved siden av (erstattes ikke), så ett felt kan utløse flere oppgaver. Datamodellen tillot dette alt (`Task.checklistFieldId` ikke unik, ingen server-sjekk); kun klienten begrenset til én. `FeltWrapper` tar nå `oppgaver: {id, nummer?}[]` (ikke `oppgaveNummer`/`oppgaveId`), og speiler repeater-radenes chip-mønster (`RepeaterObjekt.tsx`). Repeater-radene er uendret (per-rad `radOppgaver`).

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
- **API-validering:** `verifiserRetningsrett()` sjekker posisjon/retning før statusendring (403 ved mismatch). Erstattet rolle-matrisen `verifiserFlytRolle` i fase 3.4
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

### Bildeannotering (web, 2026-09-29)

Web-flaten kan annotere bilder — verktøy pil/sirkel/firkant/frihånd/tekst + **Flytt** (velg og dra eksisterende objekt). Inngang: «Annoter»-knappen i lightboxen (`FeltDokumentasjon.tsx`). Tegnemotoren er den DELTE HTML-en i `@sitedoc/shared` (`ANNOTERINGS_HTML`), lastet i en `<iframe srcDoc>` — samme motor som mobil bruker via WebView (se [shared-pakker.md § Bildeannotering](shared-pakker.md) + [mobil.md](mobil.md)).

🔴 **Tre-artefakt-modellen (Kenneth-vedtak 2026-09-29) — originalen røres aldri:**
- `Vedlegg.url` = utflatet JPEG (q0.92, hvit bakgrunn) — det som vises i lista/PDF/hos mottaker.
- `Vedlegg.originalUrl` = bevart originalfoto, satt ÉN gang ved første annotering, deretter uendret (bevis).
- `Vedlegg.annotering` = Fabric-laget som DATA (`AnnoteringsLag`) — objektene, canvas-dims og Fabric-versjonen. Lar annoteringen gjenåpnes og REDIGERES (pilen flyttes, ikke tegnes på nytt).

Lagres via `oppdaterVedlegg` (in-place patch i `useSjekklisteSkjema`/`useOppgaveSkjema`/`RepeaterObjekt` — **aldri** fjern+legg-til, som ville slettet originalfila). Utflatet JPEG lastes opp som en NY fil (`/api/upload?privat=1`); `url` peker på den, `originalUrl` på originalen. Rene hjelpere + tester: `annotering-lag.ts` (+ `__tests__/annotering-lag.test.ts`, `feltdokumentasjon-annotering.test.tsx`). Koordinat-normalisering (lag laget på én skjermstørrelse åpnet på en annen) i `@sitedoc/shared` `reskalerLagObjekt` (tvilling inlinet i HTML-en).

⚠️ **Bakover:** bilder annotert PÅ MOBIL (eller før denne runden) har `url` men intet lag → vises som flatt bilde, ikke redigerbart, ingen «kan redigeres»-indikator. Mobilens egen lag-runde kommer separat (offline-kø-risiko holdt utenfor denne gaten).

## Signert filservering — selvfornyelse (S1 Fase 1b)

`/uploads/`-filer serveres bak en HMAC-signaturgate (default-deny, se [sikkerhet.md](sikkerhet.md)); hver `fileUrl` fra en tRPC-query er ALT signert ved emisjon (`?exp=&sig=`) med en begrenset levetid (`STANDARD_LEVETID_MS`). Klienten legger ALDRI signeringslogikk til — og kaller ALDRI en `fil.signer({ sti })`-prosedyre (den måtte autorisert stien selv → kryssfirma-orakel). To komponenter håndterer selvfornyelse når en signatur utløper, ved å invalidere tRPC-queriene DEBOUNCET (`lagInvalideringsDebounce`, delt i `@sitedoc/shared`) så serveren re-emitterer ferske signaturer gjennom en ALT autorisert vei:

- **`SignertBilde`** (`<img>`-klassen) — fanger 401 via `onError` og invaliderer (maks ETT forsøk; 404 skiller seg fra 401 via `erUtloptSignatur`).
- **`SignertLenke`** (lenke-klassen) — nedlasting / ny fane / PDF-visning med `#page=N`. 🔴 **Kontrakt:** komponenten MÅ hete `apps/web/src/components/SignertLenke.tsx` — snubletråden `levetid-snubletraad.test.ts` (`lenkerSelvfornyer()`) detekterer eksistensen av denne stien. En `<a href>`/`window.open` kan IKKE fange et 401 (nettleseren navigerer og får feilen; ingen `onError`), så sjekken skjer FØR åpning: gyldig signatur → åpne direkte; utløpt/rå → invalidér, VENT på fersk `fileUrl`, åpne DEN (fragmentet `#page=N` bevares). Ny fane åpner et placeholder-vindu synkront i klikk-gesten (unngår popup-blokk). 🔴 **IKKE `fetch→blob→a.download`** (blob mister PDF-sidefragmentet; punktsky/E57 er titalls MB i minnet). To flater: `<SignertLenke url fragment nyFane download>`-komponenten (anker), og `useSignertLenkeApner(kildeUrls)`-hooken for imperative `window.open`-steder (rad-dobbeltklikk) — samme kjerne. De ni kallstedene (dokumentleser, mapper ×2, økonomi ×2, timer-vedlegg ×2, spec-post-tabell, FTD-søk) går alle gjennom den.

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
**TegningPosisjonPrint** (eksportert fra `RapportObjektVisning.tsx`): oversikt med rød markør + canvas-generert detalj-utsnitt.
- `useTegningSomBilde()`: laster tegning, skalerer til maks 2400px, konverterer til data-URL via canvas (PDF→pdfjs-dist→canvas)
- `useDetaljCanvas()`: tar data-URL, klipper 12.5%-utsnitt rundt posisjon, tegner prikk, returnerer data-URL
- 3s fallback-timer: viser oversiktsbilde hvis canvas feiler
- Bildedimensjoner (`Drawing.imageWidth/imageHeight`) brukes for korrekt aspect ratio

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

## Tegninger — serieopplasting (T1, 2026-10-06)

Opplasting skjer i byggeplass-kontekst (`oppsett/byggeplasser/page.tsx`, `RedigerLokasjon`). Fil-feltet har `multiple`:
- **Én fil** → dagens detalj-modal (bevart uendret).
- **Flere filer** → serieflyt (R1/R2): felles-felt-modal (fag · opphav · etasje, settes én gang) → parallell opplasting (`lastOppSerie`, maks 4 samtidig, `apps/web/src/lib/tegningSerieOpplasting.ts`) → etterfyllings-tabell `TegningSerieTabell`. Hver fil opprettes straks som tegning (navn=filnavn, status utkast, felles-feltene); detaljer fylles i tabellen og lagres pr. rad (`tegning.oppdater`, **kun endrede felt** via `byggTegningRadEndring`). Feil på én fil stopper ikke de andre — raden står med årsak + «Prøv igjen».
- **R3-forhåndsutfylling:** `tegning.opprett` returnerer `metadataForslag` (tegningsnummer/-type fra filnavn + PDF-Title + tittelfelt-tekst, `packages/shared/src/utils/tegningMetadata.ts`) — **skrives ikke** på raden, vises merket «foreslått» i tabellen til brukeren lagrer. Entydig treff eller tomt.
- **R6 fag-gruppering:** venstre tegningsliste grupperes fag → tegningsnummer som standard, med veksel til etasje-gruppering. «Uten fag» sist.
- **R8 ny revisjon:** `LastOppRevisjonKnapp` (tegningsrad i serietabell + rediger-dialogen) → `tegning.lastOppRevisjon`, som nå **starter konvertering** for den nye fila (delt helper `startTegningKonvertering` i `apps/api/src/routes/tegning.ts`, samme vei som `opprett`) — ny revisjon viser aldri gammel PNG. Revisjonskode foreslås som neste bokstav (`nesteRevisjon`), redigerbar.
- **R7:** målestokk forblir valgfri; ingen ny «mangler målestokk»-flate.
- Ingen schema-endring i T1. T2 (Tegningsserie-gruppering) bygget 2026-10-08 — se T2-seksjonen nedenfor + `tegning-serieopplasting-spec.md`.

### T1b — rediger etter opplasting, vis og tilbake, kollaps (2026-10-07)

- **«Rediger flere» (R4):** `TegningSerieTabell` gjenåpnes fra tegningslista (knapp i gruppe-veksle-baren) med **alle** tegningene på byggeplassen, og pr. rad via et blyant-ikon (filtrert til den ene). Samme komponent, samme `tegning.oppdater` — ingen ny dialog. Rader bygges fra alt opprettede `Drawing` (`radFraTegning`, tempId = drawingId, ingen fil/forslag).
- **Vis og tilbake:** «Vis»-knapp pr. rad (`onVis`) åpner tegningen i sidens egen forhåndsvisning. Tabell-overlayet **skjules med `hidden` (avmonteres ikke)**, så ulagrede radendringer bevares og tabellen lastes ikke på nytt; en floating «Tilbake til tabellen» henter overlayet tilbake. Valgt mekanisme fordi den gjenbruker den eksisterende viewer-en (SVG/PNG/pan/zoom) uten duplisering.
- **Kollaps (localStorage):** fag-/etasje-gruppene kan kollapses enkeltvis via gruppe-headeren; valget huskes pr. byggeplass (`sitedoc_tegning_kollaps_<byggeplassId>`, try/catch). Nøkkel skilt på grupperingsmodus (`fag|etasje::navn`). Standard: alt åpent.

### T1c — fag + rådgiver i tabellen, ekte ARK-filnavn (2026-10-07)

- **Fag- + Rådgiver-kolonne** i `TegningSerieTabell` (gjelder både serieopplasting og «Rediger flere»): «Fag» er nedtrekk fra `DRAWING_DISCIPLINES` plassert før tegningsnummer; «Rådgiver» (`originator`) er fritekst. Begge lagres via `tegning.oppdater` og sendes bare når endret (`byggTegningRadEndring` — `discipline` som enum sendes aldri tomt, `originator` kan tømmes). Var før bare i felles-skjemaet ved opplasting; nå redigerbare pr. rad. (Kenneth: «jeg kan ikke redigere fag dersom det er feil».)
- **Tegningsnummer-mønster** utvidet for ekte 6-segments ARK-filnavn (`B3-06-A-20-31-02`): `packages/shared/src/utils/tegningMetadata.ts`, 3–7 bindestrek-separerte 1–4-tegns segmenter, krav om både bokstav og siffer (stenger datoer/rene bokstavsløp). Alle gamle forslag uendret.

### T2 — Tegningsserie: merk-og-flytt-gruppering (2026-10-08)

Lett gruppering oppå T1 (Kenneth-gatet 2026-10-06: «merk tegninger → flytt dem inn i en serie … gi serier nye navn/metadata etterpå»). `oppsett/byggeplasser/page.tsx`, venstre tegningsliste.

- **Modell:** egen `Tegningsserie` (`packages/db`) + `Drawing.serieId` (FK `onDelete: SetNull`). Tom `serieId` = «ikke i serie» (gyldig). Serien bærer **ikke** revisjon/målestokk/status — de er alltid pr. tegning. API: `tegningsserie.opprett/oppdater/slett/flyttTegninger/hentForByggeplass/brukPaAlle` (`apps/api/src/routes/tegningsserie.ts`, tilgang via `verifiserProsjektmedlem`).
- **Gruppering:** i fag-modus deles hver fag-gruppe i serie-bøtter (fag → serie → nummer) + løse tegninger (uten serie). Seriegruppen kan kollapses (samme `localStorage`-mekanisme som T1b, nøkkel `serie::<id>`). Etasje-modus er flat som før.
- **Merk-og-flytt:** «Merk»-knapp i gruppe-veksle-baren slår på avkryssing pr. rad. Handlingslinje (sticky i panelet) viser antall valgt + «Ny serie fra valgte» (navneforslag = felles fag + rådgiver blant de valgte) · «Flytt til serie» (velger blant eksisterende) · «Ta ut av serie» (`serieId = null`). «Flytt» rører **kun** `serieId` — aldri tegningens eget fag/opphav.
- **R10 standardverdier:** serie-dialogen (opprett/rediger) har navn + fag + rådgiver + beskrivelse. «Bruk på alle i serien» er en egen knapp som viser antallet som berøres («N tegninger får seriens fag og rådgiver») før den skriver — ingen automatikk. i18n `tegninger.serieGruppe.*`.
- **Mobil:** ingen serie-UI; `serieId` følger bare med i `hentForProsjekt`-responsen (ignoreres av de lokale interface-castene).

## Tegningsvisning

Interaktiv visning med musesentrert zoom (0.25x–50x / 25%–5000%):

**SVG-rendering (DWG-konverterte tegninger):**
- Inline SVG via `dangerouslySetInnerHTML` (ikke `<img>` — kreves for zoom-uavhengig strektykkelse)
- Injisert CSS: `stroke-width: calc(1.5 / var(--svg-zoom, 1)) !important` — tynne linjer uansett zoom
- `--svg-zoom` CSS-variabel settes på container via `style={{ "--svg-zoom": zoom }}`
- SVG hentes, width/height fjernes, erstattes med `width="100%" height="auto"`
- Originale `<style>`-blokker fjernes, egen zoom-aware style injiseres
- SVG-elementer har `data-layer` (lagnavn) og `data-type` (entitetstype) attributter fra DWG-konverteringen
- **Rotasjon (DWG-2/RETUR 2, vedtak A):** auto-rotasjonen er allerede BAKT inn i SVG-en ved konvertering (bygget aksejevnt, tekst motrotert vannrett). Vieweren viser «Rotert N° automatisk» i verktøylinja + en Roter-knapp (90°-trinn / «Auto» = tilbake til auto). En brukeroverstyring (`rotasjon_overstyrt`) legges på som CSS `transform: rotate(delta)` på `maleInnerRef`-wrapperen — SVG og markører roterer sammen, så prosent-koordinatene holder. Lagres via `tegning.settRotasjon`.
- **Startutsnitt (DWG-2/RETUR 2 §3):** ved åpning zoomer vieweren til `tegning.startutsnitt` ({x,y,w,h}-brøk av viewBox der innholdet er tett) — løser «DWG åpnes veldig lite». Zoom = 0.98/max(w,h), scroll sentrerer klyngen (via `ønsketScrollRef` + `useLayoutEffect[zoom]`). Alt annet er fortsatt med og synlig når man zoomer ut. Kjøres én gang pr. tegning (`startutsnittRef`-vakt), overstyrer ikke brukerens egen zoom.

**Zoom og panorering:**
- **Gest-skille (`lib/tegningZoomGest.ts`, `klassifiserWheel`) — RETUR 2 A, 2026-10-07:** hvert `wheel`-event klassifiseres som `knip` / `hjul` / `styreflate-scroll`. Kenneth spurte «er det mulig å oppdage om zoomhjul eller touchpad benyttes?» → ja, heuristikk på `ctrlKey`/`deltaMode`/`deltaX`/`deltaY`. Ren funksjon, testet isolert (`tegningZoomGest.test.ts`).
  - **Knip** (`ctrlKey=true` — styreflate-knip OG ctrl+hjul på Mac): **kontinuerlig** zoom, faktor `exp(-akkumulertDeltaY · k)`, samlet pr. animasjonsramme (rAF), forankret i pekeren. `preventDefault` (`passive:false`) blokkerer nettleserens egen side-zoom på tegningsfeltet. **🔴 RETUR 3 B (2026-10-07) — baseline-forankring:** knipet forankres fra GEST-STARTEN (zoom + scroll + peker, `knipBaseRef`), ikke fra forrige rammes `el.scrollLeft`. `knipTotalRef` = netto deltaY siden start (`faktor = exp(-total·k)`); baselinen nullstilles etter 160 ms stillhet (wheel-knip har ikke eget slutt-event). Hvorfor: per-ramme-forankring leste scroll på nytt hver ramme — i fit→overflyt-overgangen er den fortsatt klippet, så forankringen regnet fra feil origo og hoppet akkumulerte. Ett fast origo for hele knipet → ingen akkumulert drift; punktet lander rett når innholdet blir stort nok.
  - **Styreflate-scroll** (tofinger, uten ctrlKey): ingen `preventDefault` → `overflow-auto`-containeren panorerer selv (x + y).
  - **Hjul** — 🔴 **RETUR 3 A (2026-10-07), regresjonsfiks «ved tvil → zoom»:** pikselmodus panorerer KUN ved entydig signatur (horisontal komponent, `deltaX ≠ 0`); alt annet (også smått/desimalt rent vertikalt `deltaY`) er hjul → diskrete trinn `0,8 / 1,25`. Forrige heuristikk krevde et helt, rent vertikalt hakk ≥ 40 px; mus med jevn/akselerert scrolling gir desimale/små `deltaY`, ble tolket som styreflate-scroll og **panorerte i stedet for å zoome**. En regresjon i musehjul-zoom er verre enn at styreflatens vertikale tofinger-scroll zoomer. `HJUL_PIKSEL_TERSKEL` er fjernet.
  - **Safari:** `gesturestart/change/end` håndteres (Safari gir knip som gesture-event, ikke ctrl+wheel); `e.scale`-forholdet anvendes pr. event. No-op i Chrome/Firefox.
- Felles forankring: `anvendZoomFaktor` (gjenbruker `ønsketZoomScroll`) gir ny zoom + ønsket scroll for ett faktor-steg.
- Zoom-nivåer for knapper: [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5, 10, 20, 50]
- Klikk på prosenttall tilbakestiller til 100%
- Dra-for-å-panorere: venstre museknapp + dra (>5px) panorerer tegningen
- Pan/klikk-skilling: musedown-posisjon lagres, onClick ignoreres hvis bevegelse >5px
- useEffect med `[tegningId, isLoading]` dependencies — registrerer wheel/pointer/gesture-handlers når container mountes etter data-lasting
- Scroll-matematikken ligger i `lib/zoom-scroll.ts` (`ønsketZoomScroll`); ønsket scroll settes i en `useLayoutEffect([zoom])` **etter** at innholdet har fått ny bredde, ellers klipper nettleseren verdien til gammelt maksimum

**Definit containerhøyde (`lib/tegningVisningshoyde.ts`, `settVisningshøyde`) — rotårsak-fiks 2026-10-07:**
- Scroll-containeren får en eksplisitt høyde = fra sin egen topp til bunnen av vinduet (`window.innerHeight − getBoundingClientRect().top`), satt i en `useLayoutEffect` + `ResizeObserver` på forelderen (fanger banner/panel-omflyt) + `resize`-lytter. `flex: none` overstyrer `flex-1`.
- **Hvorfor:** den delte dashbord-`<main>` er `display:block`, så `flex-1` nedover kjeden er inert og ingen definit høyde når frem. Uten dette (a) scroller hele siden i stedet for tegningen — verktøylinja forsvinner oppover — og (b) får ikke containeren vertikal overflyt, så musehjul-zoomens `scrollTop`-korreksjon blir en no-op og zoomen låser seg til toppkanten (vertikal bom målt til −63 px). `<main>` kan ikke gjøres til flex uten å klippe de 11 prosjektsidene som er avhengige av at den scroller — derfor måles høyden scoped her.
- Verifisert i nettleser (test.sitedoc.no, to ekte tegninger): piksel under peker holdt seg innen ±0,9 px og hele-siden-scrollen forsvant (main-scrollbar 110→0). Formelen i `ønsketZoomScroll` er urørt.
- **`scrollbar-gutter: stable` (RETUR 1, 2026-10-07):** `settVisningshøyde` setter også dette. Rotårsak for «første zoomtrinn hopper litt opp» på en tegning som får plass i feltet: det vertikale rullefeltet reserverte bredde FØRST ved fit→overflyt-overgangen, så innholdsbredden krympet ~15 px midt i zoomen. Bildet er bredde-styrt (`w-full`, sideforhold-låst) → vertikal skala ble `nesteZoom/forrigeZoom × (nyBredde/gammelBredde)` i stedet for `nesteZoom/forrigeZoom` → punktet drev. Målt: 29 → 3 px (naturlige) med gutter på. Overlay-rullefelt (Mac-standard) reserverer ingenting → no-op der. **Ikke** en feil: kant-klipping når ønsket scroll > maks (et punkt helt nede kan ikke holdes fast ved innzoom) — iboende, likt med/uten fiks.

**Måleverktøy og målestokk (bilde-tegninger PNG/JPG/SVG) — RETUR 2 B/C/D, 2026-10-07:**
- Låsen er delt: `kanMale(scale, mmPrPiksel, scaleKilde)` (`packages/shared/src/utils/maaling.ts`). 🟢 **Kenneth-vedtak 2026-10-07:** `scaleKilde="tittelfelt"` er nå GYLDIG for måling direkte (før: avslått som «forslag»). Rotårsaken til «måling virker ikke»: PDF→PNG setter automatisk `scale` + `scaleKilde="tittelfelt"` + `mmPrPiksel` (`api/tegning.ts:269`), og gamle `kanMale` avviste `tittelfelt` → Kenneths 1:50-ARK-tegninger var sperret. Rene SVG/DWG uten PDF-steg mangler ofte `mmPrPiksel` → fortsatt sperret.
- **Håndskrevet målestokk blir «manuell» (reparasjon 2026-10-09):** detaljtabellen (`TegningSerieTabell`) / «Rediger flere» sendte bare `scale` — kilden ble `null` og `kanMale()` avslo måling selv om 1:50 sto i feltet. `tegning.oppdater` utleder nå `scaleKilde="manuell"` når `scale` settes uten eksplisitt kilde (ren funksjon `utledScaleKildeVedLagring` i `maaling.ts`; in-viewer-panelet/kalibrering sender kilde eksplisitt → beholdes).
- **Eldre PDF-tegninger uten målegrunnlag (reparasjon 2026-10-09):** tegninger konvertert før måling-i-tegning (2026-09-24) har `mmPrPiksel = null` og `rekonverterPdf` tar dem aldri (de er `done`). Der `mmPrPiksel == null` viser målestokk-panelet «Tegningen mangler målegrunnlag. Oppdater den på web.» + en **«Hent målegrunnlag»**-knapp (admin, samme gate som rekonverter). Knappen kaller `tegning.backfillMaalegrunnlag` som leser papirbredden på nytt fra original-PDF-en (`pdfinfo`) og utleder `mmPrPiksel` mot lagret `imageWidth` — **ingen ny rendering, `fileUrl`/`scale` røres ikke**. Begrenset til PDF-kilde (DWG/DXF sin `mmPrPiksel = null` er legitim → kalibrering). Mobil viser samme tekst (uten knapp — «Oppdater den på web»).
- **Kilde vises ved resultatet:** «2,87 m (Målestokk 1:50, fra tittelfeltet)» / «(bekreftet)» / «(kalibrert)» / «georeferanse». Måling via `malMm` (papir) eller GPS-avstand (georeferert, 3+ punkter har fortrinn).
- **Kalibrering er korreksjonen, ikke et forsteg:** «Stemmer ikke? Kalibrer» ved måleresultatet (kun papir-veien). Kalibreringsflyten har et eget banner over tegningen med synlige steg (1. klikk første punkt · 2. klikk andre punkt · 3. skriv lengden i mm), trådkors-markør (`cursor-crosshair`) og tegnede punkter (`MaalingOverlay`). Lagrer `scaleKilde="kalibrert"`.
- **Berører IKKE 3D-kalibrering:** 3D GPS/similarity-kalibrering bor i `tegning-3d/page.tsx` (`gpsOverride`), importerer verken `kanMale`, `maaling` eller zoom-gest — helt adskilt kodebase og begrep.
- **Tre måleverktøy (RETUR 3 C, 2026-10-07) — som Adobe:** verktøylinja har tre ikoner, ett aktivt om gangen (`maleVerktoy: "linjal" | "polylinje" | "areal"`). Esc avbryter, klikk på aktivt verktøy slår det av.
  - **Linjal** (`Ruler`): to punkter → én avstand, så stopp (`maleFerdig`); neste klikk starter ny måling.
  - **Polylinje** (`Waypoints`): summert lengde, per-segment-etiketter. 🔴 **RETUR 6:** auto-lukker ALDRI (lukket før på klikk nær et punkt → figuren ble ferdig utilsiktet). Avsluttes bare eksplisitt: Enter eller dobbeltklikk (web), «Fullfør» (mobil).
  - **Areal** (`VectorSquare`): lukket, skravert polygon. Viser m² (sentroide-etikett + stripe) og omkrets. Lukkes ved klikk på FØRSTE punkt (≤ `PUNKT_TREFF_PX` = 12 px) — et klikk nær et annet punkt setter et nytt hjørne (RETUR 6 § 1). m² via ny delte `malArealMm2` (shoelace på pikselkoordinater → `(mmPrPiksel · målestokk-nevner)²`; sideforhold ivaretatt som `pikselAvstand`); omkrets via lukket ring. Areal krever papir-målestokk (`mmPrPiksel` + tolkbar `scale`); uten → «—» (omkrets vises likevel).
  - Kilden («1:50 (fra tittelfeltet)» osv.) vises ved alle tre. `MaalingOverlay` fikk `fyll`-prop (polygon ved areal, polyline ellers). Regnestykke testet isolert (`packages/shared/src/utils/maaling.test.ts`).
  - **Dra satte punkter (TILLEGG RETUR 1, 2026-10-08):** punkt-prikkene i `MaalingOverlay` er dragbare med musa (`onPunktNed` → `startPunktDrag`); vindu-`pointermove`/`pointerup` oppdaterer punktet live, `punktDragRef` hindrer at tegningen panorerer under draget, og `nettoppDrattRef` undertrykker klikket etter slipp (ingen nytt punkt). Rører ikke «ferdig»-tilstanden — et lukket areal kan justeres. Mobil har samme funksjon med lupe (se `mobil.md`).
- **Flere målinger · aktiv · slett (RETUR 2, 2026-10-08):** måletilstanden er nå `MaleTilstand = {malinger[], aktivId}` fra den delte, rene modulen `packages/shared/src/utils/malinger.ts` (reducers + hit-test, **ingen kopi** — mobil bruker samme). En ferdig måling blir liggende; trykk på verktøyknappen starter en NY (`startMaling`, forrige beholdes). Den aktive vises i stripa med dragbare punkter; inaktive tegnes dempet (slate) og klikkes for å velges (`finnMalingTreff` + `onVelg` på linja/flaten). «Slett» fjerner den aktive (`slettAktiv`); «Slett alle» (`slettAlle`) bekreftes i modal (`maaling.slettAlleTittel/Bekreft`, ikke `confirm()`). Kalibrering har egen punktsamling (`kalibrerPunkter`), uavhengig av målingene. **🔴 Et bom-trykk sletter ALDRI en ferdig figur** (ingen reset-på-neste-klikk — punktlegging skjer kun i en påbegynt aktiv måling). Målinger lagres IKKE. Tester: `malinger.test.ts`.
- **RETUR 3 (2026-10-08) — eksplisitte verktøy er en MOBIL-fiks; web uendret (målt):** RETUR 3 erstatter mobilens tvetydige én-finger-gest (nytt punkt / dra / velg / langt trykk gjettet ut fra posisjon og varighet) med eksplisitte verktøy + lupe + sett-ved-slipp. Web har ikke denne tvetydigheten: musa er presis, hover finnes, og dagens modell skiller allerede plassering (aktivt måleverktøy setter punkt), valg (klikk på en inaktiv måling) og dra (punkt-prikk i den aktive). Lupe/sett-ved-slipp gir ingen mening med mus. Derfor er web **ikke endret** i RETUR 3 (minst mulig endring, ingen regresjon) — den delte `malinger.ts` holder datamodell-pariteten. En eksplisitt «Flytt»/«＋ Opprett»-merking på web er mulig senere, men vurdert unødvendig nå.
- **RETUR 6 § 2 (2026-10-08) — rediger figur etter etablering:** delte, testede `malinger.ts`-funksjoner
  (`settInnPunktPaaKant`, `fjernPunkt`, `finnNaermesteKant`, `nyKantPunktIndeks`) brukes av begge flater.
  **Web-valget (meldt):** **shift-klikk** på en kant av den aktive figuren setter inn et nytt hjørne der
  (velges straks, kan dras); **klikk** på et hjørne velger det (gul ring via `MaalingOverlay`-prop
  `valgtIdx`); **Delete/Backspace** fjerner det valgte hjørnet (`fjernPunkt` beholder min 3 areal / 2
  linje). Areal regner med sluttkanten (`lukket`). Mobil bruker samme funksjoner med trykk-på-kant +
  langt-trykk-fjern (se `mobil.md`). § 1 (polylinje auto-lukker aldri; areal kun første punkt) gjelder
  web via den delte `punktTilMaling` — ingen egen web-kode.
- **90°-lås + snapping (ordre + GJENOPPTA, 2026-10-08):** verktøylinja fikk tre toggler — **90°**
  (`TriangleRight`), **Referanse** (`Spline`, kun når 90° på), **Snap** (`Magnet`, PÅ som standard). Alt via
  delt `beregnSnap` (`maaling.ts`): klikk/dra/hover kjører `beregnSnapForKandidat` (leser `snapParamRef`).
  **Forhåndsvisning** på `onMouseMove`: svak markør der klikket lander + stiplet ortho-akse + H/V-hjelpelinjer
  + «90°»-etikett (`visVinkelrett`). **Referanselinje:** «Referanse»-knapp → klikk på et segment i en måling
  → neste linje låses parallelt/vinkelrett på den (gul strek). Snap-til-egne-punkter (12 px) på klikk + dra.
- **TILLEGG (2026-10-08) — polylinje-paritet:** dobbeltklikk-avslutt FJERNET (var web-spesifikk). Polylinje
  avsluttes nå KUN eksplisitt: **«Fullfør»**-knapp (grønn, i stripa) eller **Enter**. En ferdig polylinje får
  **«Fortsett»** (`gjenoppta` i shared → `ferdig=false`) for å legge til flere punkter. Areal lukkes
  fortsatt ved klikk på første punkt / «Lukk flate». (Klikk-nær-punkt lukker ikke lenger — delt § 1.)
- **RETUR 1 (2026-10-09) — snap fester seg ikke til usynlige objekter:** `beregnSnap` tar nå et
  valgfritt `utsnitt` (synlig del av bildet i prosent). Web beregner det fra `containerRef` (viewport)
  mot `maleInnerRef` (zoomet bilde) i `beregnUtsnitt()` og sender det inn; snap-mål og 90°-hjelpelinjer
  utenfor utsnittet ignoreres (margin pr. akse = treffradius→prosent, krymper riktig ved innzoom). I
  tillegg nullstilles `maleTilstand` ved tegningsbytte (målinger er flyktig klient-state, ikke persistert
  pr. tegning) så de ikke henger igjen som snap-kandidater på neste tegning. Treffradiusen var allerede
  i skjerm-px (`rect.width` fra `getBoundingClientRect`) — ingen endring der. Tester: `maaling.test.ts`.

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

### 3D-viewer isolering (viktig arkitekturbeslutning)

`TreDViewerProvider` og `ViewerCanvas` rendres **kun på 3D-sider** (`/3d-visning` og `/tegning-3d`), IKKE i prosjekt-layouten for alle sider.

**Bakgrunn:** Tidligere levde `TreDViewerProvider` i prosjekt-layouten (`/dashbord/[prosjektId]/layout.tsx`) for å gjøre 3D-scenen persistent mellom ruter. Dette forårsaket:
1. **129 MB IFC-lasting** på alle prosjektsider (økonomi, sjekklister, etc.)
2. **React #310 krasjt** — IFC fragment-worker feil ("Model not found") propagerte som ugyldige React children på andre sider
3. **680+ console errors** fra 3D-debug og IFC-feil på ikke-3D-sider

**Nåværende arkitektur:**
- `layout.tsx` sjekker `er3DVisning` (pathname slutter med `/3d-visning` eller `/tegning-3d`)
- `TreDViewerProvider` + `ViewerCanvas` wraps kun innholdet når `er3DVisning === true`
- Andre sider (økonomi, sjekklister, etc.) får ren layout uten 3D-overhead
- **Konsekvens:** 3D-scenen re-initialiseres ved navigasjon til/fra 3D-sider (IFC-modeller caches i `ifcFilCache` for rask re-lasting)

**ALDRI** flytt `TreDViewerProvider` tilbake til å wrappe alle sider — det krasjer økonomi og andre sider.

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

**Live kamera-tracking (blå prikk med retningsindikator):**
- Blå prikk med trekant-pil viser kameraposisjon og blikkretning på tegningen
- **Retningsberegning:** 3D `cam.getWorldDirection()` → `treDDeltaTilTegning(dir.x, dir.z)` → `atan2` → CSS `rotate()`. Oppdateres i RAF-loopen, også ved ren rotasjon
- **Inkrementell delta-tracking:** Startposisjon fra klikk (presis), bevegelse via `treDDeltaTilTegning` (lineærdel av similarity-transform)
- **Markør-posisjonering:** Prosent-basert (`left: X%, top: Y%`) inne i transform-div med eksplisitt `width/height = naturalWidth/Height`. `scale(1/zoom)` holder markørstørrelse konstant
- `flyTil` returnerer `Promise<void>` som resolves ved camera-controls `rest` event (kamera har stoppet). Fallback: 3s timeout
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
- `tegningTil3D` / `treDTilTegning` — direkte similarity-transform (matematisk korrekt begge veier)
- `treDDeltaTilTegning` — lineærdel for inkrementell tracking og retningsberegning

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
