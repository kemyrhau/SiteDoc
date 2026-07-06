---
name: redesign-handoff
description: Designreferanse + spec for navigasjons-/innstillingsredesignet (web + mobil). Versjonert sammen med paritetssjekkliste og designfiler. Reiser med redesign/navigasjon-mergen.
status: aktiv
sist_verifisert_mot_kode: 2026-07-05
---

# Handoff: SiteDoc navigasjons- og innstillingsredesign (web + mobil)

> **Følgefiler i `docs/redesign/`:** `Innstillinger Redesign.dc.html` (designprototyper 1a–2c),
> `screenshots/01–06-design.png` (ett bilde per skjerm), `K-BESLUTNINGER.md` (K1–K11 vedtak).
> Arbeids-/paritetsstatus: [`docs/claude/redesign-paritetssjekkliste.md`](../claude/redesign-paritetssjekkliste.md).

## Redesign-strategi (branch, flagg, miljø)

Vedtatt arbeids- og doc-routing for redesignet:

- **`develop` bak flagg:** redesign-arbeidet merges **inkrementelt til `develop` bak
  `nyNavigasjon`-flagget** (`apps/web/src/hooks/useNyNavigasjon.ts` — eneste flaggkilde).
  **Flagg av = eksakt dagens UI**; nye ruter er additive og flagg-uavhengig nåbare, men synlig
  navigasjon (sidebar/toppbar) endres kun når flagget er på. Reversering = skru av flagget.
- **`main` holdes ren:** ingenting redesign-spesifikt til prod/`main` før redesignet er
  verifisert komplett og kunde-godkjent. Test-miljøet (via `develop`) brukes til iterasjon.
- **Eget stack senere:** for kundesammenligning mot prod-data reises en dedikert redesign-stack
  (`-p redesign`, DB `sitedoc_redesign`, eget subdomene) når vi når det steget — se
  § Implementeringsplan pkt 3. Ikke bygget ennå.
- **Doc-routing:** disiplin-/prosess-docer (worktree-regler o.l.) går til `develop` umiddelbart;
  **redesign-docene (denne fila, paritetssjekkliste, designreferanser) reiser med
  redesign-mergen** — indeks-rad (CLAUDE.md) + DOC-MAP-rad legges på `redesign/navigasjon` slik
  at rad og fil lander sammen (ingen kryss-branch-indeks-skew).

## Oversikt

Redesign av innlogget UI i SiteDoc (web + mobil) med tre mål:

1. **Innstillinger samlet og intuitivt** — dagens oppsett er spredt over 5 toppnoder (14 oppsett-sider, 10 firma-sider, tre uavhengige toppbar-velgere). Alt samles i én innstillinger-hub strukturert etter den vedtatte tre-nivå-arkitekturen (Firma → Prosjekt), jf. `docs/claude/navigasjon-arkitektur-analyse-2026-05-03.md` og `terminologi.md § 0`.
2. **Søk som primær navigasjon** — globalt søk (Ctrl+K) som finner innstillinger, sider og handlinger med brødsmulesti.
3. **Oversettelse med færre klikk** — språkstyring samles i ett panel på mappen; språkavvik bekreftes med ett klikk i dokumentlisten; leseren bytter språk i ett trykk.

## Om designfilene

Filene i denne pakken er **designreferanser laget i HTML** — prototyper som viser tiltenkt utseende og oppførsel, IKKE produksjonskode. Oppgaven er å **gjenskape designene i SiteDoc-kodebasen** med eksisterende mønstre: Next.js 14 App Router + Tailwind (web), React Native + NativeWind (mobil), tRPC, i18n via react-i18next. Ingen HTML herfra skal shippes direkte.

- `Innstillinger Redesign.dc.html` — åpnes i nettleser. Inneholder alle seks skjermene, nyeste runde øverst. Merket 1a, 1b, 1c (runde 1) og 2a, 2b, 2c (runde 2).

## Fidelity

**Hi-fi på layout, hierarki og flyt** — gjenskap struktur, gruppering, tekster og interaksjoner som vist. **Lo-fi på detaljstyling**: bruk kodebasens eksisterende Tailwind-klasser, lucide-ikoner og `@sitedoc/ui`-komponenter i stedet for designets bokstav-fliser og hex-verdier der dere har etablerte ekvivalenter. Fargekodingen (blå = firma, gul/amber = prosjekt) er intensjonell og skal beholdes.

## ⚠️ Viktigste risiko: funksjonsparitet (= akseptkriteriet)

Kenneths hovedbekymring: **alle funksjoner i dagens UI skal ivaretas.** Paritetssjekklisten er selve akseptkriteriet for redesignet, og feature-flagget gir direkte gammel-vs-ny-sammenligning per funksjon. Regler:

1. **Ingen side slettes** — alt får ny plassering/inngang, gamle URL-er beholdes som redirect i minst 1 uke (samme policy som tRPC-rename-regelen i CLAUDE.md).
2. **Lag paritetssjekkliste FØR koding — start fra anker-dokumentene, ikke kartlegg på nytt**: `navigasjon-arkitektur-analyse-2026-05-03.md` (🟢 ANKER, tiltak-tabell A–E = komplett ruteinventar), `ux-arkitektur-agenda.md`, `admin-navigasjon-analyse-2026-05-03.md` og `domene-arbeidsflyt.md` (🟢 STYRENDE). Hver eksisterende funksjon får en rad: gammel URL → ny inngang (hub-kort / søketreff / mobil-tab) → verifisert gammel-vs-ny via flagget.
3. **Toppbar-funksjoner som må overleve**: FirmaVelger (sitedoc_admin), firma-fastlenke (company_admin), ProsjektVelger, ByggeplassVelger m/ `useToppbarFiltre`-disabling, SpråkVelger, brukermeny, admin-inngang, hamburger (mobil). Rollebasert rekkefølge per Kenneths spec 2026-05-04 beholdes.
4. **Sidebar-funksjoner som må overleve**: modul-gating (`kreverModul`, `kreverGruppemodul`, `kreverFirmaModul`, `kreverIfc`, `kreverTimerLeder`, `tillatelse`), modul-fargeaksent (`MODUL_EIERSKAP`/`MODUL_FARGER`), deaktiverte ikoner uten valgt prosjekt.
5. **Hjelpetekst-konvensjonen** (?-ikon per side) videreføres på alle nye/flyttede sider.
6. **Standarder som er lette å miste i redesign — egne sjekkliste-punkter**: Toppbar-filtre-standard (`useToppbarFiltre`), Filter-standard (`MultiComboks` + `SearchInput`), hjelpetekster, og i18n (ingen hardkodede strenger + 15-språks `generate.ts`).
7. **i18n**: alle nye strenger via `t()` i både `nb.json` og `en.json` + kjør `generate.ts` (KUN på redesign-branchen, se § Parallellarbeid).

## Skjermer

### 1a — Innstillinger-hub (web)

- **Rute**: ny side `/dashbord/innstillinger` (erstatter inngangene til `/dashbord/oppsett/*` og `/dashbord/firma/*` som primær inngang; gamle ruter består).
- **Layout**: maks-bredde ~980px sentrert. H1 «Innstillinger» + undertekst. Søkefelt (flex 1) + segmentert filter [Alt | Firma | Prosjekt] på samme rad.
- **To seksjoner** med seksjonsheader i uppercase + kontekstforklaring:
  - **FIRMA** (blå aksent `#1e40af`, flis-bakgrunn `#e7edfb`) — «gjelder hele {firmanavn}»: Firmaprofil (Firmainfo, Fakturering), Ansatte og roller (Ansatte, Avdelinger — se K10-noten under), Kompetanse (Matrise, Import), Timer (Lønnsarter, Aktiviteter, Tillegg), Maskin (Register, Vedlikehold), HMS (Dashbord, Varsling).
  - **PROSJEKT** (amber aksent `#92610a`, flis `#fbf3e2`) — «gjelder kun {prosjektnavn}»: Prosjektoppsett (Generelt, Byggeplasser, Lokasjoner), Moduler (av/på), Medlemmer (Medlemmer, Faggrupper), Maler (Sjekklistemaler, Oppgavemaler), Dokumentflyt (Dokumentflyt, Flytregler), Søk og AI (AI-søk).
- **Kort**: hvit bakgrunn, `border #dde2ea`, radius 9px, hover → border i seksjonsfargen. Ikon-flis 34×34 (bruk lucide-ikon i stedet for bokstav-flis), tittel 14.5px/600, beskrivelse 12.5px grå, under-lenker som chips.
- **Grid**: 3 kolonner, gap 14px.
- **Synlighet**: Firma-seksjonen kun for `company_admin`/`sitedoc_admin` (gjenbruk `verifiserOrganisasjonTilgang`-logikken); Prosjekt-seksjonen gated på `harProsjektTilgang` + modul-flagg. Kort for moduler som er av, skjules.
- **Søket** filtrerer kort + under-lenker live (klientside er nok i v1).

### 1b — Globalt søk (Ctrl+K) + sidebar delt i Prosjekt/Firma (web)

- **Søkemodal**: åpnes med Ctrl/Cmd+K og fra «Søk overalt»-felt i toppbaren. 620px bred, sentrert, overlay `rgba(15,23,42,0.42)`.
  - Resultatgrupper i rekkefølge: **INNSTILLINGER** (blå flis), **SIDER** (amber flis), **HANDLINGER** (grønn flis, f.eks. «Opprett ny lønnsart»).
  - Hvert treff: tittel 13.5px/600 + brødsmulesti 11.5px grå («Firma › Timer › Lønnsarter»). Valgt rad har bakgrunn `#eef3fd`.
  - Footer: «↑↓ naviger · ↵ åpne · esc lukk».
  - **Datagrunnlag**: statisk registry (rute → tittel → sti → tillatelseskrav) som filtreres på brukerens tilganger. Handlinger kan vente til v2.
- **Sidebar** (erstatter dagens 60px ikonbar): 224px, mørk navy `#16233f`, to soner med uppercase-etiketter:
  - **PROSJEKT — {prosjektnavn}**: Dashbord, Sjekklister, Oppgaver, HMS, Tegninger, Bilder, Kontrollplan, Timer, **Kontakter** … (behold ALLE dagens elementer + gating, se paritetsliste).
  - **FIRMA**: Brukere, Kompetanse, Maskin, Timer-katalog (kun for admin-roller).
  - Nederst, alltid synlig: **Innstillinger** (→ 1a-huben).
  - Aktivt element: bakgrunn `rgba(255,255,255,0.10)`, tekst `#dbe4ff`; inaktive `#b6c2da`.
- Toppbaren viser kombinert kontekst-chip «{Firma} / {Prosjekt} ▾» i stedet for tre løse velgere — velgeren åpner firma+prosjekt-hierarkisk liste (løser P1 i `admin-navigasjon-analyse`: prosjektlisten filtreres på valgt firma).

### 1c — Mobil innstillinger (React Native)

- Hub-skjerm under «Mer»/Innstillinger-tab: blå header med tittel, prosjekt-chip og søkefelt; deretter PROSJEKT-gruppe (amber fliser) og FIRMA-gruppe (blå fliser) som kort-lister med 44px+ radhøyde, ikon-flis 32×32, tittel 15px/600, undertekst 12px, chevron.
- Rader: Prosjekt → Moduler, Medlemmer, Maler, Dokumentflyt, Lokasjoner. Firma → Firmaprofil, Brukere, Timer, Maskin (gated på rolle/modul som web).

### 2a — Mobil v2: ny tab-struktur

- **Tabs**: Hjem · Tegninger · Dokumenter · Timer · Mer (erstatter dagens hjem/boks/lokasjoner/mer i `app/(tabs)/_layout.tsx`). Lokasjoner flyttes inn under relevant kontekst (tegninger/PSI) — behold gammel skjerm nåbar til paritet er verifisert.
- **Tegninger-tab**: segmentert toggle [2D | 3D | 2D+3D] i header (gjenbruker eksisterende ruter `3d-visning.tsx`, `tegning-3d.tsx`). Byggeplass-grupper (uppercase-etikett) med rader: thumbnail 52×38, navn + ★ for standardtegning, revisjon + punkt-antall. Eget innslagskort «IFC-modell — åpne punktsky/IFC» når `kreverIfc` er oppfylt.
- **Dokumenter-tab** (dagens `boks.tsx` oppgradert): brødsmulesti i header, MAPPER-gruppe med språkinfo per mappe («arver språk» / «egne språk: PL LT UK»), DOKUMENTER-gruppe med statusprikk (grønn = oversatt + språkkoder, amber = oversetter…, amber rad m/ inline-knapper ved språkavvik: primær «Bekreft og oversett», sekundær «Behold»). «Les»-knapp per rad → 2c.

### 2b — Oversettelsespanel på mappe (web)

- **Rute**: `/dashbord/[prosjektId]/mapper` utvides med høyrepanel (300px) + statuskolonner i dokumenttabellen.
- **Tre-kolonne layout**: mappetre (210px) | dokumenttabell | «Oversettelse»-panel (300px, åpnes fra knapp «🌐 Oversettelse: NB → PL LT» i sidens header).
- **Panelinnhold**:
  - KILDESPRÅK: readonly «Norsk (bokmål) — fra prosjektet» (lenke til prosjektoppsett for endring).
  - MÅLSPRÅK: radio «Arv fra prosjektet (Polsk, Litauisk)» (default) / «Egne språk for denne mappen» → språkchips (14 språk) aktiveres kun ved custom. Mapper `Folder.languageMode` (inherit/custom) + `Folder.languages` direkte — ingen ny datamodell.
  - Infoboks: «Gjelder N dokumenter i denne mappen og undermapper som arver. Allerede oversatte dokumenter røres ikke.»
  - Primærknapp: «Oversett N gjenstående nå» → batch-kall.
- **Dokumenttabell**: kolonner DOKUMENT | SPRÅK | OVERSETTELSE (chips: `PL ✓` grønn, `PL …` amber, `ikke oversatt` grå, `venter` amber) | handling (Les / Oversett / Bekreft). Språkavvik-rad: amber bakgrunn `#fdf9ef`, varseltekst under filnavn, «Bekreft»-handling → kaller eksisterende `bekreftSpraakMut` (behold begge valg fra dagens 3-valgs-varsel, men som ett klikk + «Behold»).
- **Automatikk**: ved opplasting i mappe med målspråk → språkdeteksjon + auto-oversettelse uten videre klikk (utvid dagens upload-pipeline; respekter try/catch-regelen — opplasting skal aldri feile pga. oversettelsesserver).

### 2c — Dokumentleser mobil: språkbytte i ett trykk

- WebView mot eksisterende Reader (`/dokumenter/[id]/les?embed=true`) eller native header.
- **Språkpille-rad** under header (sticky): `NB · kilde` | `PL` (aktiv = fylt blå) | `LT` | `+ Oversett` (åpner språkvalg og starter oversettelse direkte). Pilletrykk bytter visningsspråk umiddelbart (cache-hit) eller viser fremdrift.
- Statusbanner over innholdet: «Oversatt til polsk · OPUS-MT · vis original» (grønn tone). «Sammenlign»-lenke → dagens sammenlign-panel for motorbytte.

## Interaksjoner og tilstand

- Ctrl/Cmd+K global listener (web) — må ikke kollidere med eksisterende snarveier.
- Hub-søk: lokal filtrering, debounce unødvendig. Global søkemodal: registry-oppslag klientside i v1; AI-søk-integrasjon (`ai-sok`) kan kobles på senere.
- Oversettelsespanel: optimistisk chip-oppdatering, spinner-tilstand «PL …» mens jobb kjører (samme mønster som dagens BookOpen-spinner).
- Alle destruktive valg via modal (aldri `confirm()` — kodebase-regel).
- Mobil: touch-mål min 44px, offline-first gjelder (oversettelsesstatus kan være stale offline — vis «sist synkronisert»).

## Designtokens

- Farger: primær `#1e40af`, sekundær `#3b82f6`, aksent/amber `#f59e0b` (prosjekt-aksent i tekst: `#92610a`, flate: `#fbf3e2`), suksess `#10b981` (tekst `#0b7a4b`, flate `#e6f7ef`), feil `#ef4444`. Nøytraler: bakgrunn `#f6f7f9`, kort `#fff`, border `#dde2ea`, tekst `#111827`/`#5b6472`/`#8a93a3`. Sidebar navy `#16233f` (NY — legg til i tailwind.config som `sitedoc-sidebar`).
- Typografi: designet bruker IBM Plex Sans som illustrasjon — bruk kodebasens eksisterende fontoppsett. Skala: 24/21 (H1), 18 (sidetittel), 15/14.5 (radtittel), 13–13.5 (brødtekst), 11–12 (meta/etiketter, uppercase m/ letter-spacing 0.07–0.09em).
- Radius: 6–9px kort/felter, 12px mobilkort, 999px piller. Ikoner: lucide (web) / lucide-react-native.

## Implementeringsplan (vedtatt med Kenneth)

1. **Branch**: `redesign/navigasjon` fra `develop`. Ingen schema-endringer. Merge fra develop inn minst ukentlig.
2. **Feature-flag**: `nyNavigasjon` per bruker — gammel og ny UI side om side i samme kode; reversering = skru av flagget. Merge inkrementelt til develop bak flagget.
3. **Redesign-stack på server-ny**: tredje Docker-stack (`-p redesign`, DB `sitedoc_redesign`, subdomene). Prod-datakopi dit for sammenligning (dump av test-DB først; ekskluder sessions; Resend av/sandbox; avklar S3-tilgang for vedlegg). Migrerings-gate: sjekk `$DATABASE_URL` før alt.
   **Vaktposter fra DOCKER-NOTES (Opus, denne økta):**
   - **Delt build-kontekst**: prod/test/redesign bygger fra samme `~/stack/sitedoc` — **re-rsync redesign-branchen før hver redesign-build**, ellers bygges feil branch inn. Aldri `--remove-orphans`. rsync ekskluderer `docker/` og env-filer.
   - **OAuth**: `redesign.sitedoc.no` trenger egen callback-URI i web-Entra-appen (`d7735b7a`) OG Google — samme AADSTS50011-felle som på test.
   - **DNS/ruting**: nytt hostname rutes via **Cloudflare-dashboard**, ikke cloudflared-CLI.
4. **Mobil**: app-variant «SiteDoc Test» (egen bundle-ID, eget ikon) mot test/redesign — bygg ÉN gang per plattform (sjekk EAS-kvote + dager til reset først), deretter all iterasjon via EAS Update (OTA) på egen kanal. Miljøvelger i test-appen i stedet for tredje variant.
5. **Parallellarbeid**: utvid `parallell-arbeid-lock.md` med frossen sone: `Toppbar.tsx`, `HovedSidebar.tsx`, `SekundaertPanel.tsx`, `apps/web/src/app/dashbord/oppsett/**`, `apps/web/src/app/dashbord/firma/**`, `apps/mobile/app/(tabs)/**`, i18n-filene (generate.ts kjøres kun på redesign-branchen).
   **⚠️ Kjent kollisjon — PSI Fase A**: en annen økt bygger `/dashbord/[prosjektId]/mannskap` + nav-entry samtidig. Avtale: **PSI-økta legger til siden + en enkel nav-registrering; redesignet eier nav-strukturen** og re-homer entryen (PROSJEKT-sonen i ny sidebar + rad i paritetslisten). Koordiner via `parallell-arbeid-lock.md` — to økter skal aldri redigere `HovedSidebar.tsx`/rutestrukturen blindt samtidig.
6. **Rekkefølge** (foreslått): (i) paritetssjekkliste, (ii) 1a hub bak flagg, (iii) 1b sidebar + kontekst-chip, (iv) 1b søkemodal, (v) 2b oversettelsespanel, (vi) 2a mobil-tabs, (vii) 2c leser, (viii) sammenligningsrunde mot prod-kopi med kunde.

## Avklarte K-beslutninger (Kenneth, 2026-07-05)

- **K6 — Kontakter/Dokumentflyt: SPLITT, ikke bare rename.** Renamen er allerede gjort i kode (`/oppsett/produksjon/kontakter` er redirect til `…/dokumentflyt`), men siden rommer to konsepter:
  1. **Personkatalog** (faggrupper + medlemmer med navn/e-post/telefon) — dette er en **arbeidsflate for feltbruk** («hvem ringer jeg i Elektro?»), bekreftet av Kenneth som tiltenkt kontaktoversikt per prosjekt.
  2. **Flyt-konfigurasjon** (flytledd, roller, redigerer/leser) — dette er en **innstilling**.
  Løsning: «Dokumentflyt» forblir under Prosjekt-innstillinger (hub-kort). NY lesevisning **«Kontakter»** (prosjektkontakter: faggrupper + folk m/ tlf/e-post, klikk-for-å-ringe på mobil) legges i PROSJEKT-sonen i sidebar, i søket, og nås fra mobilens Mer-tab. Egen rad i paritetslisten. Data finnes allerede (samme query som dokumentflyt-siden) — kun ny visning.
- **K10 — Ansatte vs Brukere:** UI-term = **«Ansatte»** (følger koden, `firma/ansatte`). MEN: siden er i dag både kontoadministrasjon (rolle, invitasjon) og ansattdata (ansattnummer). Den planlagte HR-Import-modulen kan gi ansatte uten brukerkonto — **ikke hardkod «ansatt = bruker» i navigasjon eller komponentnavn**; hub-kortet heter «Ansatte og roller» og skal tåle at de to konseptene skilles senere.

## Kodebase-regler som gjelder (fra CLAUDE.md)

Norsk bokmål i kode/kommentarer/commits; i18n-krav på alle UI-strenger; TypeScript strict uten `any`; Zod på alle endepunkter; dual-review før push til develop; ALDRI deploy til prod uten eksplisitt forespørsel; hjelpetekst (?-ikon) på alle sider; «entreprise» er forbudt — bruk «faggruppe».

## Filer i pakken

- `README.md` — dette dokumentet
- `K-BESLUTNINGER.md` — Kenneths svar på K1–K11 fra paritetssjekklisten (2026-07-05)
- `Innstillinger Redesign.dc.html` — alle seks skjermdesign (åpnes i nettleser; runde 2 øverst)
- `screenshots/` — ett bilde per skjerm:
  - `01-design.png` = 1a Innstillinger-hub (web)
  - `02-design.png` = 1b Globalt søk + sidebar (web)
  - `03-design.png` = 1c Mobil innstillinger
  - `04-design.png` = 2a Mobil v2: Dokumenter- og Tegninger-faner
  - `05-design.png` = 2b Oversettelsespanel på mappe (web)
  - `06-design.png` = 2c Dokumentleser mobil

## Pilot + test/deploy-strategi (fabel/Kenneth-vedtak 2026-07-06)

**Flagg-utrulling (pilot):**
- `nyNavigasjon`-toggelen (brukermeny) er nå gated til `sitedoc_admin`. **Ved pilotstart** utvides den til `company_admin` (etter at polish + steg iv/v er godkjent).
- **På sikt:** vurder ny UI som default med en «bytt tilbake»-vei.

**Mobil-teststrategi (steg vi + vii):**
- Steg vi (2a mobil-tabs) + vii (2c leser) **kodes ferdig FØR EAS-bygg**.
- **Simulator-verifisering per steg:** `xcrun simctl`-skjermbilder + dev-login agent-flyt (se [dev-login-agent.md](../claude/dev-login-agent.md)).
- **ETT batch-bygg per plattform** til slutt, deretter **OTA på egen kanal**.
- **Miljøvelger i test-appen** (ikke en tredje app-variant).
- **Microsoft-innlogging i simulator: utestet** — Kenneth tester.
