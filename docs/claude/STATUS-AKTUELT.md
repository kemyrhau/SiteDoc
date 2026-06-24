---
name: STATUS-AKTUELT
description: Løpende statusrapport for pågående arbeid, pauset arbeid og planlagte faser. Oppdateres ved hver vesentlig fremdrift.
sist_verifisert_mot_kode: 2026-06-08
---

## Pågående arbeid (PR-historikk)

> ✅ **DEPLOYET TIL PROD 2026-06-21 (prod-merge `32b88bd7`)** — arkivert til [historikk-2026-06.md § Slice 1–4 + reisetid R1–R4 + byggeplass-GPS L1](historikk-2026-06.md). Server (API+web): auto-utkast (Slice 3), midnatt-splitt (4a), glemt-dag-prompt (4b-1), `sluttTidKilde` + arbeidstids-varsel (4b-2), reisetid-matrise R1–R4, byggeplass-GPS L1, UX-1 + Slice 1/2-refinements + T.12. **4 migrasjoner anvendt på prod + verifisert** (`reisetid_matrise`, `organization_setting_arbeidstid_varsel`, `sheet_timer_beskrivelse`, `daily_sheet_slutt_tid_kilde`). NorBERT bind-fix-kode merget (embed/oversettelse-rebuild = egen oppgave, IKKE kjørt).

> ✅ **DEPLOYET TIL PROD 2026-06-23 (prod-merge `13dc110e`)** — arkivert til [historikk-2026-06.md § Timer-bunke (UF-0…UF-4, fiks A, …)](historikk-2026-06.md). **Server live (API+web):** Funn #2 kvittering-vedlegg (+ migrering `sheet_tillegg_vedlegg` anvendt), T.11 maskinbevis, UF-4 recall (`gjenaapneDagsseddel` → 405), tre-veis-farge web, T.12 web-parity. **Mobil-UX** (UF-0…UF-4, fiks A sync-gift-isolasjon, tidshjul-modal + keyboard-«Ferdig» + grønn-boks-wording, U1–U3, build-footer, lønnsart-hint) **distribueres via TestFlight prod-bygg #30** (`404e1707`, submission `8b3f8ec1` **Submitted/Success 2026-06-23 20:17** etter Apple-avtale-signering + resubmit — bygg #30 i App Store Connect, venter på Apple TestFlight-prosessering) — **A.Markussen-validering starter når bygget er tilgjengelig i TestFlight.** Verifisert: migrering+tabell (`to_regclass`), `gjenaapneDagsseddel` 405, innlogget prod-dashboard data-intakt (ikke anonym).
>
> Eldre arkiv: [historikk-2026-06.md](historikk-2026-06.md) (SPOR 3 prod 06-10, OAuth, auto-select lønnsart, hentMineMedlemskap) · [historikk-2026-05.md](historikk-2026-05.md) (mai-deploys).

### Geofence-discoverability (web) — PÅ DEVELOP 2026-06-24

Geofence-editoren gjort oppdagbar på `byggeplasser/page.tsx`: egen synlig **«Geofence»**-verktøylinje-knapp (MapPin) → egen modal (skilt ut fra «Endre navn», som nå er ren navne-endring). Ikon/label-fiks: «Endre navn» Copy→Pencil, «Rediger»→**«Tegninger»** (LayoutGrid). Opprett markerer ny byggeplass i lista (ikke auto-kast inn i tegnings-editor). Geofence-seksjon flyttet verbatim (settGeofence/beregnGeofence/geokod uendret). i18n: ingen nye nøkler (gjenbruk `lokasjoner.geofence.tittel` + `nav.tegninger`), hjelp-tips oppdatert (15 språk). **Test-verifisering krever manuell rebuild** (auto-deploy rebuilder ikke web). Prod-deploy avventer eksplisitt forespørsel — kreves før 999/A.Markussen-geofence kan settes lett i prod-UI.

### Mobil EAS-bunt — byggeplass-UX F1–F6 + F-A + F-B + F-G — I EAS PROD-BYGG #32 (2026-06-24)

**#32 superseder #31** (`cc119d42`) — la til F-G (glemt-dag 0-fiks) på develop (`c6babc44`). #32 bygges fra `main` etter merge develop→main. **Når brukere via TestFlight når `eas submit` #32 er kjørt** (Kenneths ASC-steg). Device-test av hele bunten via TestFlight-intern. Samlet innhold:

- **Mobil global byggeplass-UX (F1–F6)** — `ByggeplassKontekst` eneste kilde, header-chip (hjem/sjekklister), GPS auto-set + override, timer-default fra global, favoritter. Detaljer: [BACKLOG.md § Mobil global byggeplass-UX](BACKLOG.md). Commits `a46d58e9`/`b2ee5fb4`/`0eb2c9ef`/`d7419e6b`/`7c3ae7e3`.
- **F-A glemt-dag-transparens** (device-test-funn 2026-06-24) — `sluttTidKilde="system"`-utkast viser konkret banner: «Estimert slutt: HH:MM (gjettet) · X.X t på N rader — sjekk og rett» (`timer/[id].tsx`). Ikke-blokkerende.
- **F-B auto-rundings-fiks** (device-test-funn 2026-06-24, bug) — auto-genererte timer-rader rundes nå til firmaets tidsrunding-grid (15 min = 0.25 t) på **arbeidstimer** før normaltid/overtid-splitt (`StartSluttDagKort.genererForslag` + ny `rundTimerTilNarmeste`). Reise urørt; `null` → behold 2-desimal. Rettet rå-varighet (6.10/8.24 t).
- **F-G glemt-dag 0-fiks** (device-test-funn 2026-06-24, bug — `c6babc44`) — (c) `fordelArbeidstidFradrag`: pause→lengste, reise→start m/ overflyt, kappet til kapasitet → kort start-segment klampes aldri til 0; dag-total invariant. (d) rød «Mangler standard-lønnsart»-banner ([id].tsx) i stedet for stille 0. `splittVedMidnatt`/UF-2/F-A/F-B urørt. Rot-fiks (org-config) i [BACKLOG § Org uten standard-lønnsart](BACKLOG.md).

Ingen schema/server. Device-test (via TestFlight #32, begge må stå før submit): (a) org uten lønnsart → banner (ikke stille 0) · (b) org m/ lønnsart + start 21:33 → ~2.45t-rad på dag-1, pause på lengste segment · + chip/GPS/favoritt + glemt-dag-transparens + 15-min-runding. **Handling før GPS-test:** prod-prosjektet mangler byggeplasser — opprett + sett geofence på sitedoc.no → Byggeplasser (What-to-Test pkt 1+3).

> Web-sporet (geofence-editor A+B + rename C) **DEPLOYET TIL PROD 2026-06-24** (`a558db2e`) → arkivert til [historikk-2026-06.md § Geofence-editor + rename](historikk-2026-06.md).

### B2+B6 sedel-nivå byggeplass — IMPLEMENTERT PÅ DEVELOP 2026-06-23 (mobil)

Sedel-nivå byggeplass på timer-dagsseddel (kode-review-vedtak 2026-06-23, [timer-gps-prosjekt-utredning.md § 2026-06-23](timer-gps-prosjekt-utredning.md)). Tre deler:

- **Del 1** — `arbeidsdag.byggeplassId` kopieres inn i auto-utkastet: `FinnEllerOpprettArgs.byggeplassId` + insert (`dagsseddelOpprett.ts`); threades via `genererForslag`/`opprettDagsseddelForSegment` (`StartSluttDagKort.tsx`); `ny.tsx` sender eksplisitt `null`. Kun NYE drafts — UF-1-append + eksisterende sedler urørt (idempotens).
- **Del 2** — `ByggeplassVelgerModal` (ny, speiler `ProsjektVelger`), filtrert på `sedel.projectId`; skriver `byggeplassId` + `syncStatus="pending"`. Blå sedel-topp-oversikt (aktivt prosjekt + byggeplass, pil-til-høyre) på `[id].tsx`. Fjernet redundant byggeplass-visning i primærprosjektets gruppe-header.
- **Del 3** — myk, ikke-blokkerende mismatch-advisory når GPS-byggeplassen tilhører et annet prosjekt enn det valgte (G1: arbeider-valg autoritativt).

i18n: 3 nye nøkler × 15 språk. **Server/schema uendret** — sedel-nivå-sync var allerede klar (server propagerer `byggeplassId` til rader). Typecheck: null nye feil (gjenstående = pre-eksisterende baseline, BACKLOG «Mobil ~12 feil»).

**Distribusjon:** i **EAS prod-bygg #31** (`cc119d42`, 2026-06-24) → A.Markussen via TestFlight når `eas submit` er kjørt. **Reload:** Expo JS/TS (Fast Refresh).

**Parkert (Beslutning 6-oppfølger):** per-rad byggeplass / «splitt dagen mellom byggeplasser» (krever server `syncBatch` rad-input + mobil rad-tabeller).

### Samlet aktivitet — 2026-05-30 (2 prod-deploys: subdomain↔category-validering + HMS-prefiks amber-hint + useToppbarFiltre)

To sammenhengende oppryddinger natt og dag 2026-05-30. Natt: server-validering + amber-hint som naturlig oppfølger av 2026-05-29-bi-funnene fra HMS/mal-arbeidet. Dag: ny toppbar-filter-arkitektur som løser at 27 sider viste ByggeplassVelger uten å bruke den — identifisert under filterbruk-kartleggingen 2026-05-29.

| # | Prod-merge | Innhold |
|---|---|---|
| 1 | `765e060e` (impl `8d517732`) | Subdomain↔category-validering i `mal.opprett` + `mal.oppdaterMal`. Mapping: `avvik+ruh → oppgave`, `sja → sjekkliste`. Effektiv tilstand etter oppdatering valideres. HMS-prefiks amber-hint i `MalListe.tsx` (opprett + rediger): når prefiks matcher SJA/RUH/AVVIK case-insensitivt OG HMS-haken er av. i18n auto-oversatt til 14 språk (2441 → 2442 nøkler) |
| 2 | `08a03b78` (impl `1ba86093` + `2e6c3cff`) | `useToppbarFiltre`-hook + `ByggeplassVelger` disabled-state. Del 1: ny kontekst (`toppbar-filtre-kontekst.tsx`) + hook (`useToppbarFiltre.ts`) + `ByggeplassVelger` med `disabled`-prop (opacity-40 + cursor-not-allowed) + Toppbar leser kontekst + layout wrapper. Del 2: 26 sider (16 detalj + 10 oppsett) deklarerer `useToppbarFiltre({ byggeplass: false })`. CLAUDE.md-regel «Toppbar-filtre-standard» lagt til (commit `c070f078`) |

**BACKLOG-lukninger:**
- HMS-prefix-UX-felle (amber-hint) ✅
- Subdomain↔category-sammenheng-validering ✅
- useToppbarFiltre-hook (identifisert som strategi B 2026-05-29) ✅

**Konflikt-håndtering under sesjonen:** Første instruks fra Kenneth (subdomain-validering) hadde RUH = sjekkliste, som motsa 2026-05-29-koden. Flagget eksplisitt med konsekvens-beskrivelse (server-validatoren ville avvise begge prod-RUH-maler, motstride `hms.ts`/`firma-HMS`-koden fra `354fc4ea`). Kenneth bekreftet alternativ A: hold på 2026-05-29-beslutningen.

**Verifisering på prod:**
- HTTP 200 på `sitedoc.no` etter begge deploys.
- PM2 restart (siste): `sitedoc-api` (pid 489318), `sitedoc-web` (pid 489338).
- Visuell verifisering som innlogget bruker mot prod gjenstår — særlig: (a) amber-hint vises ved prefiks «SJA»/«RUH»/«AVVIK» uten HMS-hake, (b) ByggeplassVelger er grå på `/oppsett/brukere` og 25 andre sider, normal på `/hms`/`tegninger`/`oppgaver`-listing/etc.

**Deploy-hendelse (useToppbarFiltre Del 1):** Første test-deploy uten `git pull` feilet med manglende `pages-manifest.json`. Re-deploy med `git pull && rm -rf .next && pnpm build --force` gikk gjennom. Påminnelse: server-cron auto-puller etter push, men kan henge etter ved rask kommando-sekvens.

**Diagnose-lærdom:**
- Når en instruks motsier nylig deployet kode, må flagging skje med konkret konsekvens-beskrivelse, ikke kun spørsmål. Kort, konkret konsekvens-beskrivelse > abstrakt prinsipiell advarsel.
- Når et UI-element vises uten å være funksjonelt på en gitt side, er det bedre å gjøre tilstanden eksplisitt (disabled-prop med visuell deaktivering) enn å skjule elementet helt. Skjult element gir inkonsekvent toppbar-layout som hopper ved navigasjon; disabled element holder layout stabil og kommuniserer at funksjonen finnes men ikke er relevant her.

> Arkivert til [historikk-2026-05.md](historikk-2026-05.md):
> [§ useToppbarFiltre-hook + ByggeplassVelger disabled-state](historikk-2026-05.md), [§ Subdomain↔category-validering + HMS-prefiks amber-hint](historikk-2026-05.md).

### Samlet aktivitet — 2026-05-29 (4 prod-deploys: TaskChangeLog audit-trail + HMS-checkbox-fiks + RUH→oppgave + ProsjektVelger-UX)

Tett deploy-dag med fire sammenhengende oppryddinger i HMS/mal-domenet og toppbar. Morgenen startet med å lukke audit-hullet fra gårsdagens dokumentflyt-undersøkelse (TaskChangeLog). Ettermiddagen fant en UX-felle der HMS-haken var skjult i rediger-modal for ikke-HMS-maler på prosjekter uten HMS-modul — minimal-fiks + server-guard for domain-skift deployet sammen. Sent ettermiddag ble konseptuell asymmetri eksponert: RUH var sjekkliste, avvik var oppgave, SJA sjekkliste — RUH passer bedre som oppgave (én innmelder, statusovergang, tildeling). Kvelden lukket en fjerde UX-bug avdekket under bred filterbruk-kartlegging: `/oppsett/*`-sidene viste «Mine prosjekter» i toppbar selv om datalaget brukte sticky-prosjektet.

| # | Prod-merge | Innhold |
|---|---|---|
| 1 | `fff9daf4` | TaskChangeLog — ny modell + migrasjon `20260529000000_task_change_log`, diff-logging i `oppgave.oppdaterData` + `forbedreOversettelse`, UI-gate fjernet i `MalListe.tsx:968` |
| 2 | `354fc4ea` (impl `c040990a`) | HMS-checkbox alltid synlig i mal-rediger-modal (fjernet `hmsModulAktiv`-render-gate på linje 800). Server-guard i `mal.oppdaterMal` utvidet til å blokkere domain-skift når dokumenter eksisterer (samme mønster som eksisterende category-vern) |
| 3 | `354fc4ea` (impl `38d005a0`) | RUH bytter fra sjekkliste til oppgave-shape. `hms.ts` henter RUH fra `task.findMany`, `hms/page.tsx` ruter RUH-opprett til `oppgave.opprett`, `firma/hms` drillNed sender RUH til `/oppgaver`, `RuhTabell` bytter til `byggeplassNavnAvvik`. Seed-data + migrasjon `20260529100000_ruh_category_oppgave` backfiller 2 eksisterende RUH-maler (`category='sjekkliste'` → `'oppgave'`). Verifisert: 0 RUH-dokumenter eksisterer i prod, ingen dokument-migrasjon nødvendig |
| 4 | `6359e2da` (impl `fa76de83`) | ProsjektVelger viser sticky-prosjektnavn på `/dashbord/oppsett/*`-sider. `knappTekst`-uttrykket (linje 45-54) prioriterer `valgtProsjekt?.name` over scope-tekst. Asymmetri mellom presentasjon (URL-basert scope) og data-state (sticky `prosjektId`) lukket |

**BACKLOG-lukninger etter dagens deploys:**
- TaskChangeLog ✅
- MalbyggerV2 fire-fane redesign 🔵 UTSATT (skissert som åpen entry; fokus på dagens HMS/oppgave-rydding i stedet)

**Nye BACKLOG-entries opprettet under sesjonen:**
- HMS-prefix-UX-felle — amber-hint når mal har prefix matching HMS-mønster (SJA|RUH|AVVIK) men HMS-hake er av
- Subdomain↔category-sammenheng-validering — server-side sjekk som forhindrer feilkombinasjon der dokumenter blir usynlige

**Identifisert under filterbruk-kartleggingen (ikke implementert):**
- 14 oppsett-sider mangler `prosjektId` i URL — sticky-state-felle, ikke delbare URLer.
- 16/30 detalj-sider og 11/14 oppsett-sider viser ByggeplassVelger uten å bruke `useByggeplass()`. Foreslått strategi B (per-side declaration via `useToppbarFiltre`-hook) for visuell deaktivering.
- Parallell rute-tre `/dashbord/prosjekter/[id]/...` (6 sider) — potensiell dødkode etter rute-omstilling.

**Verifisering på prod:**
- Migrasjoner applied (`20260529000000_task_change_log` + `20260529100000_ruh_category_oppgave`).
- Backfill bekreftet: 2 RUH-maler i prod har nå `category='oppgave'`.
- HTTP 200 på `sitedoc.no`.
- PM2 restart (siste): `sitedoc-api` (pid 422426), `sitedoc-web` (pid 422446).
- Visuell verifisering som innlogget bruker mot prod gjenstår — særlig: (a) HMS-haken kan krysses av i rediger-modal for ikke-HMS-mal, (b) RUH-opprett fra HMS-fanen havner i `/oppgaver/...`, (c) TaskChangeLog-toggle på oppgave-maler, (d) ProsjektVelger viser prosjektnavn på `/oppsett/brukere`.

**Diagnose-lærdom:**
- Et felt som «ikke er låst» kan likevel være utilgjengelig hvis hele render-greinen er gated. Sjekk render-betingelser, ikke bare `disabled`-state, når UX-feller skal diagnostiseres.
- Konseptuell asymmetri (RUH=sjekkliste mens avvik=oppgave) blir ofte eksponert i tilstøtende undersøkelser, ikke i bug-rapporter. Rydd asymmetri i samme sesjon som man rører den.
- Når UI viser en label som ikke matcher datalagets state, sjekk om datakilden brukes som gate på presentasjonsuttrykket. `valgtProsjekt` var ferdig hentet — `knappTekst` skjønte bare ikke å spørre etter den.

> Arkivert til [historikk-2026-05.md](historikk-2026-05.md):
> [§ ProsjektVelger viser aktivt prosjektnavn](historikk-2026-05.md), [§ RUH bytter fra sjekkliste til oppgave-shape](historikk-2026-05.md), [§ HMS-checkbox + domain-guard](historikk-2026-05.md), [§ TaskChangeLog](historikk-2026-05.md).

### Dagens samlede aktivitet — 2026-05-28 (6 prod-deploys: firma-HMS-dashbord komplett + 3 tekniske lukkinger + tilgangs-asymmetri-fiks)

Tett deploy-dag etter compact 2026-05-28 morgen. Hele firma-HMS-dashbord-bunken (Trinn 1-4) komplett i prod. Tre tekniske lukkinger på toppen: pause-default, impersonering audit-log, HMS-tabell-redesign. Sent på dagen avdekket prod-impersonering av firma-admin Florian en rotårsak-asymmetri i `hentBrukerTillatelser` — to-stegs fiks lukket den.

| # | Prod-merge | Innhold |
|---|---|---|
| 1 | `526db462` | Firma-HMS-dashbord Trinn 1-3 (server-rolle-fundament + server-data + klient-side) + 4 UX-iterasjoner + HMS-byggeplass-filter + Oppgave-mobil rettighetsoppfølger |
| 2 | `eacdb40e` | Firma-HMS-dashbord Trinn 4 (`hms_ansvarlig`-tildeling i `firma/ansatte` + `FirmaHurtigModal` for avvik-behandling fra firma-dashbord) |
| 3 | `75a09ccf` | `standardPauseFra` — firma-konfigurerbar pause-default som respekterer norsk lunsj-konvensjon |
| 4 | `30467d74` | Impersonering audit-log — ny `ImpersonationAudit`-tabell (Variant B, isolert) erstatter `console.log`-mønster |
| 5 | `12e19c0a` | HMS-tabell redesign — tre HMS-tabeller (Avvik/SJA/RUH) konvertert fra plain HTML til `@sitedoc/ui Table` med sortering, filter, kolonne-resize, status-snarvei |
| 6 | `c85d8e8d` | Firma-admin tilgangs-asymmetri-fiks (`4e622d7e` + `c22a345d`) — `hentBrukerTillatelser` arver nå fulle PERMISSIONS for firma-admin uavhengig av ProjectMember-rad. Speiler `verifiserAdmin`-mønsteret. Florian ser nå «Produksjon» + 8+ UI-callsites virker. |

**BACKLOG-lukninger etter dagens deploys:**
- Firma-nivå HMS-dashboard ✅ alle 4 trinn ferdig
- HMS-byggeplass-filter innad i prosjektet ✅ (punkt 3 HMS-teknisk gjeld)
- Oppgave-mobil rettighetsoppfølger ✅
- Pause-vindu default ✅
- Vis som bruker (impersonering) — audit-log ✅ (kun lese-prosedyre + UI gjenstår, venter på tilgangs-oversikt-UX-sesjon)
- HMS-tabell redesign ✅ (punkt 2 HMS-teknisk gjeld)

**Diagnoseprosess-lærdom (deploy #6):** Første firma-admin-fiks (`4e622d7e`) var basert på antagelsen at firma-admin manglet ProjectMember-rad. Da Florian-verifisering avdekket at fiksen ikke virket, kjørte vi re-diagnose av `verifiserAdmin`-mønsteret (linje 226-232) som viste at firma-admin-sjekken må plasseres **etter** prosjekt-admin-sjekken, ikke i fallback-blokken. Korrigerende fiks (`c22a345d`) speilet det eksakte mønsteret. Lærdom: Når en tilgangsfunksjon skal "speile" en annen, sjekk **plasseringen** av hver gren — ikke bare at logikken finnes.

**Nye BACKLOG-entries opprettet under sesjonen:**
- «Firma-nivå tilgangskontrolloversikt» (planlagt UX-sesjon: firma-innstillinger + tilgangsoversikt)

**DB-undersøkelse — k-avv-mal sletting (kveld):** Florian rapporterte at én av to k-avv-maler ble slettet. Undersøkelse av prod-DB viste at `report_templates` mangler `deleted_at` (sletting = hard-delete, ikke gjenopprettbart) og at `activity_log`-tabellen er **tom for alle hendelser siste 24t** — vi har null spor av hvem som slettet hva. `ImpersonationAudit` derimot fungerer som forventet og logget alle 4 av dagens impersonerings-sesjoner (Kenneth → Florian, alle avsluttet manuelt). Lærdom: `activity_log`-skjema finnes (15 kolonner inkl. `payload jsonb`, retention-felter) men ingen kode skriver til den. Plan-skisse for hybrid Prisma middleware + eksplisitt tRPC-skriving (5 dagers estimat) drøftet — ikke prioritert/scope-bestemt ennå. Bør legges som BACKLOG-entry ved neste planleggings-sesjon.

**Deploy-hendelse:** Auto-deploy-cron-race vs manuell test-deploy slo inn 3 ganger samme dag — push til develop trigget cron parallelt med vår manuelle deploy → `ENOENT _ssgManifest.js` / `ENOENT pages-manifest.json`. `&&`-kjeden stoppet konsekvent før pm2 restart, så pm2 kjørte aldri gammel kode mot ny build. Underliggende: `deploy-test-cron.sh` mangler skript-mutex (PID-fil eller flock). Allerede notert i BACKLOG § Sikkerhets-audit sekundære oppfølgere — bør prioriteres pga gjentakelse.

> Arkivert til [historikk-2026-05.md](historikk-2026-05.md):
> [§ Firma-HMS-dashbord Trinn 1-4](historikk-2026-05.md),
> [§ HMS-byggeplass-filter](historikk-2026-05.md),
> [§ Oppgave-mobil rettighetsoppfølger](historikk-2026-05.md),
> [§ standardPauseFra](historikk-2026-05.md),
> [§ Impersonering audit-log](historikk-2026-05.md),
> [§ HMS-tabell redesign](historikk-2026-05.md).

### Dagens samlede aktivitet — 2026-05-28 (4 prod-deploys: topp-3-kandidater + BACKLOG-audit + statusoppdateringer)

Plukket og lukket alle tre kandidater fra BACKLOG-audit, etterfulgt av full status-audit av 26 åpne 🔴-entries som avdekket 3 drift-entries (allerede deployet) og 2 delvis-statuser som er praktisk talt ferdige.

| # | Prod-merge | Innhold |
|---|---|---|
| 1 | `6fd294d1` | T7-5h — bevar manuelt-justert `rad.timer` ved pause-endring (smart init + opt-in recompute, ↻-knapp i amber) |
| 2 | `ba1a5056` | i18n `maskinAvArbeid` kildetekst-forenkling (14 språk) + 2 BACKLOG-drift-fjernelser (attestering edit-bugs ✅ LØST via T7-2e, maskinAvArbeid-entry strammet) |
| 3 | `1d432aed` | `admin.hentImpersoneringStatus.utloperVed`-fix + 2 BACKLOG-statusoppdateringer (firma-admin-navigasjon ✅ FERDIG, impersonering 🟡 audit-log gjenstår) |
| — | drift-rydding | BACKLOG-audit-commit `6ea50af3` (3 drift-entries: P-KRITISK-2/-3 + 3D Fase 2 mobil IFC; 2 nyanseringer) |

**BACKLOG-statusendringer etter audit:**
- 26 → 22 åpne 🔴-entries
- 0 → 4 presise 🟡-entries med konkret gjenstående arbeid
- Verifikasjonsmetode: `git log --all --grep` + kode-sjekk + branch-contains for hver entry

**Deploy-hendelse:** Test-deploy etter `ba1a5056` ble truffet av Turbo-cache-bug (`Could not find a production build` + `clientModules`-feil). Løst manuelt via `rm -rf apps/web/.next && pnpm build --force` på serveren. Kjent issue; `deploy-test-cron.sh` (server-side, ikke i repo) trenger fortsatt `--force`-fiks.

> Arkivert til [historikk-2026-05.md](historikk-2026-05.md):
> [§ utloperVed-fix](historikk-2026-05.md),
> [§ i18n maskinAvArbeid + 2 BACKLOG-rydding](historikk-2026-05.md),
> [§ T7-5h](historikk-2026-05.md).

### Dagens samlede aktivitet — 2026-05-27 (11 prod-deploys: sikkerhets-audit komplett + UX + bugfix + docs-konsistens)

Uvanlig tett deploy-dag. Ingen funksjonell regresjon observert. Hele sikkerhets-audit-bunken (14 funn) lukket. Etterfulgt av lagContextStamme-refaktor, B5 UX-forbedring, returnert→pending-reset bugfix, i18n pause-drift på 4 språk, og 3 docs-konsistens-oppdateringer.

| # | Prod-merge | Tidspunkt | Innhold |
|---|---|---|---|
| 1 | `b3194f1d` | morgen | Innsender-tilgang i `verifiserDokumentTilgang` |
| 2 | `8c256f64` | midt på dagen | Filter-rensing F1 (cancelled i HMS LUKKET) + Tiltak 1 («Alle åpne»-snarvei) |
| 3 | `9ca0257e` | ettermiddag | Sikkerhets-audit-bunke (K1 dev-login + M2 raw-SQL + M3 sesjon-maxAge 24t + M4 logger-redact + H3 OAuth-linking + error-håndtering) |
| 4 | `54885eb2` | 16:43 | M1 global tRPC-rate-limit + trustProxy: true + cf-connecting-ip |
| 5 | `b97494cd` | 18:00 | Fastify-logger leser cf-connecting-ip + H2 streng invitasjon-match |
| 6 | `29bdded8` + `43460d80` | 19:00–19:15 | H1 mobil token-rotasjon + web-context-fix |
| 7 | `77e6553d` | 19:45 | lagContextStamme-refaktor (eliminerer kilden til H1 web-bygg-feil) |
| 8 | `f7a836f8` | 20:00 | B5 maskin-av-arbeid-validering i SeddelKort |
| 9 | `baa462e1` | 20:30 | Returnert→pending-reset ved re-send + fr.json pause-drift |
| 10 | `d8b60854` | 21:30 | i18n pause-drift de/sv/et + docs-konsistens (arkitektur lagContextStamme + infrastruktur cf-connecting-ip + timer.md re-send) |
| 11 | (HMS-bunke) | tidligere/samme dag | HMS åpen-synlighet + HMS-prosjektvisning + HMS-modul-seeding |

**Sikkerhets-audit oppsummering (utført 2026-05-27, 14 funn — alle lukket):**
- ✅ Adressert: K1, M2, M3, M4, H3, M1 (rate-limit), H2 (invitasjon-match), H1 (mobil-token-rotasjon), error-håndtering på `/logg-inn`
- Microsoft OAuth bekreftet aktivert i prod (var antatt kun planlagt) → H3 ble aktiv risiko

**Konsekvenser nå aktive i prod:**
- Alle web-sesjoner invalidert ved M3-deploy — brukere må logge inn på nytt
- `OAuthAccountNotLinked` blokkerer cross-provider Google↔Microsoft-linking
- Alle tRPC-mutations rate-limited: standard 100/min per userId, `inviterBruker` 10/min, `prosjekt.opprett` 20/min
- `dev-login` fail-secure: krever eksplisitt `NODE_ENV=development` eller `ENABLE_DEV_LOGIN=true`
- Mobil session-token roteres ved aktiv bruk hvis > 7 dager gammel (worst-case eksponering 30d → 7d)

**H1 deploy-hendelse:** Første prod-deploy av H1 (`29bdded8`) lot DB-migrasjonen kjøre OK, men `@sitedoc/web#build` feilet pga at web-routen lager egen Context-instans uten de nye feltene. PM2 restartet web på gammel kode i ~25 min mens DB var på nytt schema (lav risiko pga schema-defaults). Fix `4e353118` → re-merge `43460d80` → re-bygg + restart løste det. Lærdom notert i [BACKLOG § Refaktor: web-tRPC-route lager egen Context](BACKLOG.md).

**Docs-oppdatering (`91578127`):** api.md rate-limit-tabell utvidet med M1-rader. CLAUDE.md deploy-sekvens delt i prod (uten `.next`-rensing, anbefalt) vs test (krever `--force` pga Turbo-cache-bug).

> Arkivert til [historikk-2026-05.md](historikk-2026-05.md):
> [§ Returnert→pending-reset + fr.json](historikk-2026-05.md),
> [§ lagContextStamme + B5](historikk-2026-05.md), [§ H1](historikk-2026-05.md),
> [§ Fastify-logger + H2](historikk-2026-05.md), [§ M1](historikk-2026-05.md),
> [§ Sikkerhets-audit-bunke](historikk-2026-05.md), [§ Filter-rensing](historikk-2026-05.md),
> [§ Innsender-tilgang](historikk-2026-05.md), [§ HMS åpen-synlighet](historikk-2026-05.md),
> [§ HMS-prosjektvisning](historikk-2026-05.md), [§ HMS-modul-seeding](historikk-2026-05.md).

### Pågående: TestFlight build #24 enhet-verifisering (build #23 superseded)

Build #24 (`7d3952d2-3939-49fc-ae63-93fd1a10cfe5`, iOS buildNumber 27) bygd og submittert til TestFlight via submission `c57f9b1a-1b03-4a49-9b46-906a89a0a7ab` 2026-05-30. Apple-prosessering pågår (5-10 min). Erstatter build #23 som var inkompatibel med server etter sikkerhets-audit-deploy 2026-05-27.

**Hvorfor build #23 sluttet å virke (diagnose 2026-05-30):**

Build #23 ble bygd 2026-05-25 fra `91bc235f` eller tidligere. H1 mobil-token-rotasjon-fix på klient-siden (`apps/mobile/src/lib/trpc.ts` fetch-handler som leser `x-session-token`-respons-header) ble committet 2026-05-27 i `0c62231d` — to dager etter build #23 ble bygd. Da server begynte å rotere mobil-sessionTokens for sesjoner med `lastRotatedAt > 7d` etter prod-deploy 2026-05-27, sendte server ny token via X-Session-Token-header. Build #23 ignorerte headeren → påfølgende requests gikk med død token → 401 → «henter ikke data fra server».

Migrasjonen `20260527200000_session_rotation_tracking` backfilte `last_rotated_at = expires - 30 days` for alle eksisterende sesjoner, slik at en hvilken som helst mobil-sesjon opprettet før 2026-05-20 (typisk) trigget rotasjon ved første mutation etter deploy.

**Build #24 leverer (alt fra #23 + 2 nye mobil-commits):**
- `0c62231d` H1 mobil token-rotasjon-håndtering (fix for rotårsak — leser `x-session-token` i fetch-handler og lagrer til SecureStore)
- `32dd43ac` oppgave-detalj `rettighetInput` (speil av sjekkliste-fix fra 2026-05-08)
- Alt build #23-innhold: boks-basert `DokumentHandlingsmeny`, ProsjektKontekst auto-reset ved firma-bytte, hele mai-bunken (T7-3a/b1/b2/d, T4-d/e, T.5, T7-4a/e, firma-velger)

**Fokusområder for enhet-testing:**
- Verifiser at innlogging holder over 7-dagers-grensen (eller trigge rotasjon manuelt ved å backdatere `Session.lastRotatedAt` i test-DB)
- Verifiser fire kjente avvik fra spec dokumentert i [historikk-2026-05.md § Dokumentflyt send-modal redesign](historikk-2026-05.md): statusvalg-popup-mapping, auto-mottaker-landing, `erFirmaAdmin`-rolle-sjekk, approved/closed-tilstand
- Bekreft firma-bytte clearer byggeplass + prosjektId korrekt
- Generell regresjonssjekk på timer-flyt etter ny mobil-bunke
- Oppgave-rettighet: bekreft at oppgave-detalj nå viser handlingsknapper korrekt for ulike roller

**Lærdom:** Server-side sikkerhets-audit-fix kan introdusere protokoll-endring som krever koordinert mobil-bygg. Ved fremtidige X-Session-Token-lignende mekanismer: vurder en kort overgangsperiode der server logger «klient-mangler-rotasjon» uten å rotere, slik at vi kan oppdage mismatch FØR tokens roteres bort under føttene på utdaterte klienter.

### Gjenstående PRs (åpne)

1. **T7-5h** — destruktiv recompute ved pause/fra-til-endring kan overskrive manuelt justert timer uten varsel. Edge case, ikke blokkerende.
2. **EAS Android-bygg + Play Store** — etter TestFlight #24 enhet-verifikasjon.
3. **P-KRITISK-1/-2/-3** — sentralbiblioteket ikke seedet i prod, `FtdChangeEvent`/`FtdTnotaChangeLink` mangler i prod, `BibliotekMal` mangler 4 fase-0-felt. Se [oppryddings-plan-2026-04-28.md](oppryddings-plan-2026-04-28.md).
4. **HMS-prosjektvisning teknisk gjeld (6 punkter, lav prio)** — TS2589-workaround, plain HTML-tabell, byggeplass-filter, klient-side statistikk, useVerktoylinje droppet, `hms-avvik`-slug misvisende. Se [BACKLOG.md § 1](BACKLOG.md).

### PR T.5 tidsrunding — DEPLOYET TIL PROD 2026-05-16 (merge `c2b2ede1` develop / `ba6ba243` prod, impl `2560f0d5`)

### PR T.5 tidsrunding — DEPLOYET TIL PROD 2026-05-16 (merge `c2b2ede1` develop / `ba6ba243` prod, impl `2560f0d5`)

Standalone PR etter T.4-bunken. Firma-admin konfigurerer avrunding (15/30/60 min eller ingen) for fra/til-tid på timer- og maskin-rader. Avrunding skjer **visuelt ved input** — pickeren snapper til nærmeste intervall, det brukeren ser er det som lagres. Ingen server-side runding bak ryggen.

**Test-QA 2026-05-16:** Dropdown vises under Pause-feltet med default «15 min» og beskrivelse «Avrund fra/til-tid på timer- og maskin-rader til nærmeste intervall.» Godkjent for prod.

**Prod-deploy 2026-05-16:** `sitedoc.no` + `api.sitedoc.no` HTTP/2 200 etter `pm2 restart sitedoc-web sitedoc-api`. PR-en er **server- og web-deployet**. Mobil aktiveres når neste EAS-bygg når TestFlight/Play Store — feltet er allerede i mobil-koden (T.4-d migrasjon legger til kolonnen ved app-oppstart).

**Server (`apps/api/src/routes/organisasjon.ts`):**
- `oppdaterSetting` Zod-input: `tidsrundingMinutter: z.union([z.literal(15), z.literal(30), z.literal(60), z.null()]).optional()` — tre-verdi-validering hindrer rare verdier som 7 eller 23.
- `hentArbeidstidDefaults` (T4-d): utvidet `select`-clause med `tidsrundingMinutter: true` slik at mobil-cachen får feltet.
- `hentSetting` (firma-admin web): returneres automatisk (ingen `select`).
- Schema-feltet `OrganizationSetting.tidsrundingMinutter Int? @default(15)` fantes allerede fra tidligere migrasjon.

**Web (`apps/web`):**
- Ny `apps/web/src/lib/tidsrunding.ts` — `rundTilNarmeste(hhmm, minutter)`-helper. Clamp til 23:59 ved overflow. null = identity.
- `StandardArbeidstidSeksjon` på `firma/innstillinger`: ny dropdown under pause-feltet med 4 valg (Ingen / 15 min / 30 min / 60 min). State holdes som `"none" | "15" | "30" | "60"`-streng, konverteres til `15 | 30 | 60 | null` ved lagre.
- `RedigerTimerRad` + `RedigerMaskinRad` (T7-2b2 edit-modus ved attestering): ny `tidsrundingMinutter`-prop. `step={tidsrundingMinutter * 60}` på `<input type="time">` + onBlur-fallback-runding (sikrer at nettlesere som ignorerer step likevel produserer avrundede verdier). `AttesteringDetalj_Edit` henter `tidsrundingMinutter` fra `trpc.organisasjon.hentSetting` og passerer som prop til radene.

**Mobil-cache (`apps/mobile/src/db`):**
- `organizationSettingLocal.tidsrundingMinutter` lagt til (nullable integer, ingen default — server-respons styrer).
- Idempotent `PRAGMA table_info`-sjekk + `ALTER TABLE organization_setting_local ADD COLUMN tidsrunding_minutter INTEGER` i `migreringer.ts`. Eksisterende klienter på T4-d-schema migreres automatisk ved app-oppstart.
- `organizationSettingKatalog.refreshOrganizationSettingKatalog` skriver feltet fra server-respons (`setting.tidsrundingMinutter ?? null`).

**Mobil-UI (`apps/mobile`):**
- Ny `src/utils/tidsrunding.ts` — speil av web-helperen. `rundTilNarmeste(hhmm, minutter)`. Trivial nok at duplisering er bedre enn `packages/shared`-konfig-overhead. Kommentar peker til speilet for konsistens.
- `FraTilTidFelt` fikk ny `tidsrundingMinutter: number | null`-prop. Ved `onChange` fra DateTimePicker: rund verdien FØR `onFraEndret`/`onTilEndret` kalles. Native `minuteInterval` på DateTimePicker brukes som hint for 15 og 30 (de eneste verdiene iOS/Android støtter — 60 ignoreres, så vi runder uansett i JS).
- `TimerSeksjon` + `MaskinSeksjon` henter `tidsrundingMinutter` via `hentOrganizationSettingLokalt(organizationId)` i `useMemo` og passerer som prop til `FraTilTidFelt` i sine rad-modaler.

**i18n:** 6 nye nøkler under `firma.innstillinger.standardArbeidstid.tidsrunding*` i nb + en. Auto-oversatt til 13 språk via `generate.ts` (2277 → 2283 totalt).

**Designvalg:**
- **«Nærmeste»-runding, ikke opp/ned:** 07:07 → 07:00 (15 min runding). 07:08 → 07:15. Matcher locked design.
- **Schema-default 15:** Eksisterende firma uten eksplisitt valg får 15 min runding ved første kjøring. Firma-admin kan slå av via dropdown.
- **Hvorfor onBlur-fallback på web:** `<input type="time">` `step`-attributtet håndheves inkonsistent i ulike nettlesere (Safari < 17 ignorerer 900-sekunders intervaller). onBlur-runding garanterer at lagret verdi alltid er konsistent.
- **Hvorfor `minuteInterval` ikke alltid brukes på mobil:** iOS/Android DateTimePicker støtter kun et fast sett av verdier (1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30). 60 ignoreres. Vi gir hint for 15/30 (smidigere UX) men runder uansett i JS for å garantere konsistens.

**Verifisert:** `apps/api` typecheck 0 = 0 feil. `apps/web` typecheck 1 = 1 baseline (vitest). `apps/mobile` typecheck 12 = 12 baseline. 0 nye feil i alle apper.

**Reload-metode:** TypeScript + Drizzle-skjema (ALTER ADD COLUMN). Krever full app-reload på mobil (close + open eller `r` i Metro) slik at `migreringer.ts` legger til kolonnen. Web krever cache-cleaning ved deploy (`rm -rf apps/web/.next` + build). Server reload kreves (Zod + select endret).

**Forventede begrensninger:**
- Standalone-prosjekter (uten firma) får ikke tidsrunding — `organizationSettingLocal` har kun rader for brukerens firma-medlemskap.
- ArbeidstidSeksjon (sedel-nivå start/slutt på dagsseddel) er ikke avrundet — kun rad-modalene. Diskutabelt om det burde avrundes også; locked design gjelder kun rad-fra/til.
- Web's edit-modus krever firma-admin (`hentSetting` er admin-only). Vanlig arbeider redigerer ikke i web — bruker mobil-modalene som henter via `hentOrganizationSettingLokalt`.

Klar for review — ikke merge før Kenneth verifiserer at dropdown lagres og at picker snapper på enhet/nettleser.

### T.4-bunken (a/b/c/d/e) — KOMPLETT PÅ DEVELOP + DEPLOYET TIL TEST 2026-05-16

Alle fem sub-PR-er av T.4 (fra/til per rad) er merget til develop og kjører på `test.sitedoc.no` (HTTP/2 200, migrasjoner aktive i `sitedoc_test`). Web (T4-c) er gått test → prod-prosess via separat deploy 2026-05-16. Mobil (T4-d/e) er på develop og venter på Kenneths visuelle verifikasjon på enhet før prod-merge + EAS-bygg.

| Sub-PR | Merge-commit | Impl-commit | Status | Innhold |
|---|---|---|---|---|
| **T4-a** | `5acd2a5d` | `cfe51fc5` | ✅ develop + test | Schema + migrasjon. `OrganizationSetting.standardStartTid/SluttTid/PauseMin` + nullable `ArbeidstidsKalender.standardStartTid/SluttTid/pauseMin`. Additiv. |
| **T4-b** | `9bcfb5b1` | `088a1e37` | ✅ develop + test | `hentEffektivArbeidstid(orgId, dato)`-helper i `apps/api/src/services/timer/arbeidstid.ts`. Hard sommertid-par-validering i kalender opprett/oppdater. |
| **T4-c** | `c02df657` | `39c43aa8` | ✅ deployet til test | Server-Zod-utvidelse + web-UI (StandardArbeidstidSeksjon + kalender-modal). 15 nye i18n-nøkler → 13 språk. |
| **T4-d** | `7bee1633` | `2f7bf42d` | ✅ develop + test | Mobil Drizzle: fraTid/tilTid + arbeidstidskalender_local + organization_setting_local. kalenderKatalog.ts + organizationSettingKatalog.ts. TimerSyncProvider 2-stegs Promise.all. timerSync push/pull. Server: ny `hentArbeidstidDefaults` + fraTid/tilTid i `hentEndringerSiden`. |
| **T4-e** | `e992aca3` | `cea8f99e` | ✅ develop + test | Mobil UI: ny `FraTilTidFelt`-komponent (DateTimePicker mode=time). Montert i TimerRadModal + MaskinRadModal. Forhåndsutfylling: kalender-default eller forrige rads tilTid. Validering. Rad-visning utvidet med HH:MM–HH:MM. SummeringsBanner faller tilbake til kalender-dagsnorm. 0 nye i18n-nøkler. |

**Neste:**
1. Kenneth verifiserer T4-c web-UI på `test.sitedoc.no/dashbord/firma/innstillinger` + `/kalender`.
2. Kenneth verifiserer T4-d/e mobil-UI på testbygg — forhåndsutfylling i begge modaler, validering, fra/til-visning på rad, SummeringsBanner-fallback.
3. Etter verifikasjon: prod-merge av hele bunken samtidig (DB-migrasjon, web-deploy, EAS mobil-bygg → TestFlight/Play Store).

### PR T4-e mobil UI fra/til per rad + forhåndsutfylling — MERGET TIL DEVELOP + DEPLOYET TIL TEST 2026-05-16 (merge `e992aca3`, impl `cea8f99e`)

Femte og siste sub-PR av T.4-bunken. Bringer fra/til-tid per rad til mobil-UI med kalender-basert forhåndsutfylling. Ingen schema-, sync- eller server-endring (alt fundament fra T4-d).

**Ny komponent (`apps/mobile/src/components/timer-detalj/FraTilTidFelt.tsx`, ~115 linjer):**
- Gjenbrukbar tidsfelt-velger med to side-ved-side DateTimePicker (`mode="time"`, `is24Hour`). iOS bruker `display="spinner"`, Android `default`.
- Kontrollert via `fraTid`/`tilTid` (HH:MM | null) + setters. Picker-toggle-state internt.
- Helpers: `hhmmTilDate`/`dateTilHhmm` for konvertering. Eksportert `fraErForTil(fra, til)`-validator brukes av forelder før lagre.

**`TimerSeksjon.tsx` — utvidet:**
- Ny prop `dato: string` (ISO YYYY-MM-DD).
- `leggTil`/`oppdater` tar nå `fraTid: string | null` + `tilTid: string | null` og skriver dem til Drizzle.
- `TimerRadModal` tar nye props `dato` + `eksisterendeRader` for å beregne forhåndsutfyllings-defaults.
- `useMemo` for `defaultTider`:
  - Rediger-modus: bruk radens egne verdier.
  - Ny rad uten eksisterende rader: `effektiv.startTid` / `effektiv.sluttTid` fra `hentEffektivArbeidstidLokal(organizationId, new Date(dato + "T00:00:00"))`.
  - Ny rad med eksisterende rader: forrige rads `tilTid` som ny `fraTid` (siste rad i `eksisterendeRader` med satt tilTid), `tilTid = effektiv.sluttTid`.
- Validering i `lagre()`: `fraErForTil(fraTid, tilTid)` — viser `timer.feil.sluttForStart` hvis brudd.
- Rad-visning: `HH:MM–HH:MM`-tekst i `flex-row flex-wrap`-bolken når begge satt.

**`MaskinSeksjon.tsx` — samme mønster:**
- `dato`-prop + utvidet `leggTil`/`oppdater`/`MaskinRadModal`.
- `defaultTider`-`useMemo` med identisk logikk.
- Rad-visning utvidet med fra–til-tekst.

**`[id].tsx` — to endringer:**
- `arbeidstidTimer`-beregningen faller nå tilbake til `hentEffektivArbeidstidLokal(sedel.organizationId, new Date(sedel.dato + "T00:00:00")).dagsnorm` hvis brukeren ikke har satt egen `sedel.startAt`/`endAt`. SummeringsBanner viser alltid relevant sammenligning — tidligere viste den `?` uten brukers egen registrering.
- `ProsjektGruppe` får ny `dato`-prop som videreformidles til `TimerSeksjon` + `MaskinSeksjon`.

**i18n:** 0 nye nøkler. Gjenbruker `timer.felt.startTid` ("Fra kl.") og `timer.felt.sluttTid` ("Til kl.") som tidligere ble brukt på sedel-nivå i `ArbeidstidSeksjon` — semantisk identiske. Feilmelding gjenbruker `timer.feil.sluttForStart` ("Slutt-tid må være etter start-tid."). Sparer 4 nøkler × 14 språk = 56 i18n-vedlikeholdspunkter.

**Designvalg:**
- **Forrige rads tilTid → ny rads fraTid:** Mest sannsynlig flow er at brukeren registrerer normaltid 07:00–11:00, så pause-/lunsjblokk på samme rad → ny rad 11:30–15:00. Vi tar siste rad med satt tilTid (ikke nødvendigvis siste rad totalt) for å håndtere edge case der noen rader er uten tider.
- **DateTimePicker spinner på iOS:** Matcher eksisterende `ArbeidstidSeksjon` for konsistens. Android-default tar standard time-picker-modal.
- **Validering på server allerede dekket:** Server-Zod aksepterer fraTid/tilTid som `string | null`. Klient-validering er kun en UX-hindring — server validerer at de er gyldige HH:MM (men ikke at fra < til, siden det er fornuftig for sjeldne edge case som natt-skift).

**Verifisert:** `apps/mobile` typecheck 12 = 12 baseline (0 nye feil). Mine 4 nye komponenter har null TS-feil.

**Reload-metode:** TypeScript-only (ingen schema-endring). Full app-reload (close + open eller `r` i Metro). Ingen native rebuild.

**Forventede begrensninger:**
- Ingen UI for å vise/redigere kalender på mobil — kun web (T4-c). Kalender-cache leses via `hentEffektivArbeidstidLokal` men brukeren ser ikke kalender-rader.
- Tilleggs-rader (sheet_tillegg) har ikke fraTid/tilTid (designvalg fra T.4).
- Ingen automatisk synking av rad-tid → sedel-tid. Sedel.startAt/endAt forblir brukerens manuelle valg i ArbeidstidSeksjon.

Klar for review — ikke merge før Kenneth verifiserer på enhet at forhåndsutfylling + validering fungerer i begge modaler.

### PR T4-d mobil Drizzle + kalender-cache + sync fra/til — MERGET TIL DEVELOP + DEPLOYET TIL TEST 2026-05-16 (merge `7bee1633`, impl `2f7bf42d`)

Fjerde sub-PR av T.4-bunken. Bringer T.4-grunnmuren ut på mobil-enheten: per-rad fra/til-tid offline + lokal kalender-cache + lokal `OrganizationSetting`-cache + utvidet sync-protokoll. Ingen UI-endringer — det er T4-e som monterer DateTimePicker og forhåndsutfylling.

**Schema (`apps/mobile/src/db/schema.ts`):**
- `sheetTimerLocal` + `sheetMachineLocal`: nye nullable felter `fraTid: text("fra_tid")` + `tilTid: text("til_tid")`.
- Ny tabell `arbeidstidskalenderLocal` — speil av serverens `ArbeidstidsKalender` (T9a). Lagrer id, organizationId, aar, dato (ISO YYYY-MM-DD), type, navn, timerOverstyr, standardStartTid, standardSluttTid, pauseMin, aktiv, sistOppdatert.
- Ny tabell `organizationSettingLocal` med `organizationId` som primary key — én rad per firma. Felter: standardStartTid (default "07:00"), standardSluttTid (default "15:00"), standardPauseMin (default 30), tillattRedigerVedAttestering (default false), sistOppdatert.

**Migrasjoner (`apps/mobile/src/db/migreringer.ts`):**
- Idempotent `PRAGMA table_info`-sjekk + `ALTER TABLE ADD COLUMN fra_tid/til_tid TEXT` på begge rad-tabeller. Ingen backfill — UI (T4-e) setter verdier ved brukerinngang.
- `CREATE TABLE IF NOT EXISTS arbeidstidskalender_local` + 3 indekser (org_aar, org_type_aar, org_dato).
- `CREATE TABLE IF NOT EXISTS organization_setting_local` med `organization_id PRIMARY KEY` + alle DEFAULT-verdier matchet til schema.

**Ny service `kalenderKatalog.ts` (~210 linjer):**
- `refreshKalenderKatalog(klient, organizationId)` — kaller `trpc.firma.kalender.hentForMobil({ organizationId, fraAar: currentYear - 1, tilAar: currentYear + 1 })`. Full overskriving for firmaet (typisk < 50 rader per år). Soft-deleted rader skrives også; filter i hentLokalt-helpers.
- `hentKalenderForAarLokalt(orgId, aar)` — leser aktive rader for et år (for fremtidig mobil-UI-vy).
- `hentEffektivArbeidstidLokal(orgId, dato): { startTid, sluttTid, pauseMin, dagsnorm }` — lokal speil av servers `apps/api/src/services/timer/arbeidstid.ts`. Leser fra `organization_setting_local` + `arbeidstidskalender_local`. Logikk: firma-default → overstyring fra aktiv sommertid_start hvis dato faller mellom sommertid_start ≤ dato + sommertid_slutt ≥ dato samme år. Halvdag håndteres ikke her (per-rad-overstyring via `timerOverstyr`, registreres i UI). Hardkodet fallback "07:00"/"15:00"/30 hvis cache er tom (første kjøring offline).

**Ny service `organizationSettingKatalog.ts` (~80 linjer):**
- `refreshOrganizationSettingKatalog(klient, organizationId)` — kaller ny `trpc.organisasjon.hentArbeidstidDefaults` (se Server-tillegg). Upsert via delete+insert (singleton-rad per org).
- `hentOrganizationSettingLokalt(orgId)` — synkron lese-helper for UI.

**Server-tillegg (`apps/api/src/routes/organisasjon.ts`):**
- Ny `hentArbeidstidDefaults`-prosedyre med `verifiserOrganisasjonTilgang` (medlemskap, ikke firma-admin) — `hentSetting` krever firma-admin og kan ikke brukes av vanlige ansatte for mobil-cachen. Returnerer kun standardStartTid, standardSluttTid, standardPauseMin, tillattRedigerVedAttestering — sensitive felter (timezone, tilgang-policies) er ekskludert via `select`-clause. Eksisterende `hentSetting` urørt.

**Server-tillegg (`apps/api/src/routes/timer/dagsseddel.ts`):**
- `hentEndringerSiden`-respons utvidet: timer- og maskin-rader returnerer nå også `fraTid` + `tilTid`. Tidligere uteglemt i respons-mapping (selv om Prisma-skjemaet hadde feltene fra T.1 2026-05-11). syncBatch-input aksepterte allerede feltene.

**`TimerSyncProvider.tsx` — 2-stegs Promise.all:**
- Steg 1: base-pulls i parallell (`refreshKatalog` + `refreshMaskinKatalog` + `refreshProsjektKatalog`).
- Steg 2: utleder brukerens unike firma-IDer fra `prosjekt_local`-cachen via ny `hentUnikeFirmaIderLokalt`-helper, og kjører `refreshKalenderKatalog` + `refreshOrganizationSettingKatalog` for hver i parallell. Brukere er typisk medlem av ett firma, men løsningen støtter flere uten kode-endring.

**`timerSync.ts` push/pull:**
- Push: send `fraTid`/`tilTid` per timer + maskin-rad i `syncBatch.mutate`. Tilleggs-rader har ikke fraTid/tilTid (designvalg fra T.4).
- Pull: skriv `fraTid`/`tilTid` fra server-respons til lokal SQLite for timer + maskin-rader. Default `null` hvis ikke satt.

**Verifisert:** `apps/api` typecheck 0 = 0 feil. `apps/mobile` typecheck 12 = 12 baseline (0 nye feil). Mine endringer skjøvet linjenumrene på to pre-eksisterende baseline-feil i `timerSync.ts` (303→308, 329→334) — disse er T7-3b1-baseline relatert til server-respons-felter som er `string | null` mot lokal `.notNull()`.

**Reload-metode:** TypeScript + Drizzle-skjema-endring. Krever full app-reload (close + open eller `r` i Metro) slik at `migreringer.ts` kjører ved oppstart og ALTER-statementene legger til kolonnene. Ingen native rebuild. Server-reload kreves ved deploy (Zod-respons og ny prosedyre).

**Forventede begrensninger (kommer i T4-e):**
- Ingen UI for fra/til-tid per rad — alle nye rader fra mobil sender `null` for fraTid/tilTid inntil T4-e monterer DateTimePicker.
- `hentEffektivArbeidstidLokal` er klar til bruk i T4-e for forhåndsutfylling. UI som bruker den, kommer i samme sub-PR.
- Geo-forslag (T7-3c-stilen) for fra-tid eller pause er ikke implementert.

Klar for review — ikke merge før Kenneth verifiserer på enhet at migrasjonen kjører, kalender-cachen populerer, og syncBatch sender/mottar fraTid/tilTid uten regresjon.

### PR T4-c web-UI innstillinger + kalender-modal — DEPLOYET TIL TEST 2026-05-16 (merge `c02df657`, impl `39c43aa8`)

Tredje sub-PR av T.4-bunken. Web-UI for de nye T4-a-feltene + server-Zod-utvidelse for å SETTE feltene. Etter denne kan firma-admin konfigurere standard arbeidsdag og legge inn periode-overstyringer for sommertid/halvdag direkte i webportalen. Mobil (T4-d/e) gjenstår.

**Server-Zod-utvidelse:**
- `apps/api/src/routes/organisasjon.ts` (`oppdaterSetting`): + `standardStartTid` (HH:MM-regex), `standardSluttTid` (HH:MM-regex), `standardPauseMin` (0–480) — alle optional.
- `apps/api/src/routes/firma/kalender.ts` (`opprett` + `oppdater`): + samme tre felter, nullable+optional. Ny `validerTidsfelter`-helper: avviser felter for andre typer enn `sommertid_start/slutt/halvdag` (BAD_REQUEST), og krever `standardStartTid < standardSluttTid` hvis begge er satt. På `oppdater` valideres mot resulterende state — dvs. type-bytte FRA halvdag TIL helligdag fanges selv om brukeren ikke eksplisitt sender `standardStartTid: null`.

**Innstillinger-side (`apps/web/src/app/dashbord/firma/innstillinger/page.tsx`):**

Ny `StandardArbeidstidSeksjon`-komponent (~120 linjer) plassert etter `RedigerVedAttesteringSeksjon`. Tre input-felter:
- `<input type="time">` for `standardStartTid`
- `<input type="time">` for `standardSluttTid`
- `<input type="number" min={0} max={480}>` for `standardPauseMin`

Klient-side validering: start < slutt + pauseMin innenfor 0-480. Lagre-knapp aktiveres når state er gyldig OG endret. Kaller eksisterende `oppdaterSetting`-mutation.

**Kalender-modal (`apps/web/src/app/dashbord/firma/kalender/page.tsx`):**

- `KalenderRad`-type utvidet med `standardStartTid: string | null`, `standardSluttTid: string | null`, `pauseMin: number | null`.
- `RadModal`: 3 nye `useState` for tids-felter. Ny `visTidsfelter`-flagg som er sant for `sommertid_start | sommertid_slutt | halvdag`. Når flagget er sant, vises en grå info-boks med tre inputs (start, slutt, pause-min). Når brukeren bytter type til ikke-tidsrelevant verdi, sendes `null` for alle tre — server forkaster verdiene. Klient-side validering speiler server (start < slutt + pauseMin 0-480) for å vise feilmelding før mutation kjøres.
- Måneds-liste: ny klokke-badge ved siden av timer-badge når enten `standardStartTid` eller `standardSluttTid` er satt. Format: `🕐 07:00–15:30` med grå border + tooltip via `title`-attributt.

**i18n:** 15 nye nøkler i nb/en — 7 under `firma.innstillinger.standardArbeidstid.*` + 8 under `firma.kalender.felt.*` / `feil.*` / `tidsperiodeOverstyrt`. Auto-oversatt til 13 språk via `generate.ts` (2262 → 2277 totalt).

**Designvalg:**
- **Klokke-badge for både start og slutt:** Viser `07:00–15:30` selv om bare én av dem er overstyrt — den andre faller tilbake til firma-default ved utleting (T4-b helper), men UI-en viser eksplisitt at perioden har overstyring. Forhindrer at brukeren misforstår dataen.
- **Hard validering på server, speilet på klient:** Server avviser tidsfelter på `helligdag/fellesferie/klemdager/firma_fri` (BAD_REQUEST). Klient sender `null` for dem, så vanlig flyt trigger ikke feilen. Hvis bruker bytter type, nullstilles ikke state-feltene i komponenten — slik at bytte tilbake gjenoppretter verdiene. Verdiene sendes kun hvis `visTidsfelter === true`.
- **`pauseMin` validering:** Server krever `min(0).max(480)` på Zod, klient speiler. 0 er gyldig for halvdag uten pause; 480 = 8 timer pause øvre grense.

**Verifisert:** `@sitedoc/api` typecheck 0 nye feil. `@sitedoc/web` typecheck 1 = 1 baseline (pre-eksisterende vitest-typedef). i18n-generate fullført uten feil. Etter deploy: `test.sitedoc.no/dashbord/firma/innstillinger` HTTP/2 200 OK.

**Reload-metode:** TypeScript + i18n-endring. Full reload + cache-cleaning ved deploy (`rm -rf apps/web/.next` + build + pm2 restart). Server-reload kreves (Zod-skjema endret). Utført 2026-05-16 ~00:45.

**Sideeffekt under deploy (infrastruktur-fiks 2026-05-16):** SSH-deploy ble blokkert pga. TLS handshake failure mot ssh.sitedoc.no. Rotårsak: sitedoc.no var konfigurert i Cloudflare-zonen (Tunnel public hostnames, MX/SPF/DMARC, autoconfig, CalDAV/CardDAV) men NS hos Domeneshop pekte fortsatt mot hyp.net — zonen var i «Pending Nameserver Update». Cloudflare strammet inn på orphan-DNS som peker mot deres edge uten aktiv zone. Fikset ved å bytte NS hos Domeneshop til `riya.ns.cloudflare.com` + `simon.ns.cloudflare.com` (samme par som sitedoc.online/sitedoc.site). Propagering tok ~30 min. Permanent fiks — sitedoc.no er nå DNS-hostet hos Cloudflare på linje med de to andre domenene.

**Gjenstår i T.4-bunken:**
- **T4-d:** Mobil Drizzle — fraTid/tilTid på sheet_timer_local + sheet_machine_local + arbeidstidskalender_local-tabell + organizationSettingLocal-tabell + kalender-katalog-service + timerSync push/pull.
- **T4-e:** Mobil UI — TimerRadModal + MaskinRadModal med DateTimePicker + forhåndsutfylling via `hentEffektivArbeidstid`-resultat (kalender-cache).

Klar for visuell verifisering på `test.sitedoc.no` — Kenneth tester StandardArbeidstidSeksjon + kalender-modal tidsfelter.

### PR T4-b hentEffektivArbeidstid + sommertid-validering — MERGET TIL DEVELOP 2026-05-16 (merge `9bcfb5b1`, impl `088a1e37`)

Andre sub-PR av T.4-bunken. Server-API for å beregne effektiv arbeidstid per dato + hard validering av sommertid-par. Ingen API-input-utvidelse for de nye T4-a-feltene ennå — det kommer i T4-c (web-UI) sammen med UI-feltene.

**Ny helper (`apps/api/src/services/timer/arbeidstid.ts`, ~115 linjer):**

`hentEffektivArbeidstid(organizationId, dato): Promise<{ startTid, sluttTid, pauseMin, dagsnorm }>`

Logikk (T.4):
1. Hent firma-default fra `OrganizationSetting` (standardStartTid/SluttTid/PauseMin).
2. Hvis dato faller innenfor aktiv sommertid-periode (siste aktive `sommertid_start` ≤ dato + aktiv `sommertid_slutt` ≥ dato, samme år), overstyr feltene fra `sommertid_start`-raden der de er satt.
3. Beregn `dagsnorm = (sluttTid - startTid) - pauseMin` i timer.

Halvdag håndteres ikke i hjelperen — det er per-rad-overstyring via `timerOverstyr` ved selve registreringen.

Eksportert via `apps/api/src/services/timer/index.ts` — eneste tillatte importpath (per service-lag-konvensjonen).

**Validering i kalender-router (`apps/api/src/routes/firma/kalender.ts`):**

Ny `krevSommertidParKomplett(organizationId, aar, ignorerId?)`-helper kalles fra `opprett` (når `input.type === "sommertid_start"`) og `oppdater` (når resulterende type er `sommertid_start`). Kaster `PRECONDITION_FAILED` hvis det ikke finnes en aktiv `sommertid_slutt`-rad i samme år.

Feilmelding: `«Sommertid krever en sluttdato samme år. Opprett sommertid_slutt-rad først.»`

UX-konsekvens: firma-admin må opprette `sommertid_slutt`-rad FØR `sommertid_start`. Forhindrer at firma ender opp med åpent sommertids-regime som varer ut året (uten validering ville mobil/web fortsatt vist sommer-tider gjennom hele vinteren). Sommertid-status-mellomtilstanden (`bare_slutt`) tolereres for å gi en levelig opprettelses-rekkefølge.

`ignorerId` passes inn fra oppdater for å håndtere edge case hvor brukeren bytter type FRA `sommertid_slutt` TIL `sommertid_start` på samme rad — raden ekskluderes da fra slutt-søket.

**Verifisert:** `@sitedoc/api` typecheck 0 nye feil. `@sitedoc/web` typecheck 1 = 1 baseline (pre-eksisterende vitest-typedef).

**Reload-metode:** Server reload kreves ved deploy (krever `pm2 restart`). Ingen klient-endring.

**Gjenstår i T.4-bunken:** T4-d (mobil Drizzle + kalender-cache) + T4-e (mobil UI). T4-c er deployet til test 2026-05-16 — se entry øverst.

### PR T4-a arbeidstid defaults — schema + migrasjon — MERGET TIL DEVELOP 2026-05-16 (merge `5acd2a5d`, impl `cfe51fc5`)

Første sub-PR av T.4-bunken (fra/til per rad — implementasjons-bunke). Legger grunnmuren: firma-default for normal arbeidsdag på `OrganizationSetting` og periode-overstyringer på `ArbeidstidsKalender`. Ingen API, ingen UI — kommer i T4-b/c/d/e.

**Schema-delta (`packages/db/prisma/schema.prisma`):**

| Modell | Felt | Type | Default | Map |
|---|---|---|---|---|
| `OrganizationSetting` | `standardStartTid` | `String` | `"07:00"` | `standard_start_tid` |
| `OrganizationSetting` | `standardSluttTid` | `String` | `"15:00"` | `standard_slutt_tid` |
| `OrganizationSetting` | `standardPauseMin` | `Int` | `30` | `standard_pause_min` |
| `ArbeidstidsKalender` | `standardStartTid` | `String?` | — | `standard_start_tid` |
| `ArbeidstidsKalender` | `standardSluttTid` | `String?` | — | `standard_slutt_tid` |
| `ArbeidstidsKalender` | `pauseMin` | `Int?` | — | `pause_min` |

**Migrasjon (`20260516000000_t4_arbeidstid_defaults/migration.sql`):**
- 3 × `ALTER TABLE organization_settings ADD COLUMN ... NOT NULL DEFAULT ...` — eksisterende rader får defaultverdi automatisk.
- 3 × `ALTER TABLE arbeidstids_kalender ADD COLUMN ... NULL` — nullable, ingen backfill, kun satt for sommertid_start/slutt/halvdag.
- Fullt additiv, ingen breaking change.

**Logikk (implementeres i T4-b):**
1. Slå opp kalender-rad for dato → bruk overstyringene hvis satt.
2. Slå opp aktiv `sommertid_start`-rad (siste før dato uten påfølgende `sommertid_slutt`) → bruk overstyringene.
3. Ellers: bruk `OrganizationSetting`-defaults.

**Validering (kommer i T4-b API-lag):** `standardStartTid`/`standardSluttTid`/`pauseMin` på `ArbeidstidsKalender` er kun gyldig for `sommertid_start | sommertid_slutt | halvdag`. Avvises for `helligdag/fellesferie/klemdager/firma_fri`.

**Verifisert:** `@sitedoc/db` typecheck 0 feil. `@sitedoc/api` typecheck 0 feil. `@sitedoc/web` typecheck 1 = 1 baseline (pre-eksisterende vitest-typedef).

**Reload-metode:** N/A — kun schema + migrasjon. Migrasjonen kjøres mot test ved deploy. Etter merge til develop kjører `deploy-test-cron.sh` migrasjonen automatisk.

**Gjenstår i T.4-bunken:**
- **T4-b:** Server-API (oppdaterSetting + kalender opprett/oppdater Zod-utvidelse) + `hentEffektivArbeidstid(orgId, dato)`-helper.
- **T4-c:** Web-UI — innstillinger-side («Standard arbeidstid»-seksjon) + kalender-modal (betinget visning for sommertid_start/slutt/halvdag).
- **T4-d:** Mobil Drizzle — fraTid/tilTid på sheet_timer_local/sheet_machine_local + ny arbeidstidskalender_local-tabell + kalender-katalog-service + timerSync push/pull.
- **T4-e:** Mobil UI — TimerRadModal + MaskinRadModal med DateTimePicker + forhåndsutfylling fra kalender-cache.

Klar for review — ikke merge før Kenneth verifiserer migrasjonen på test.

### PR topbar firma-kontekst + favoritter — DEPLOYET TIL PROD 2026-05-15 (prod merge `0bd27466`)

Inkluderer søkefelt og stjernemerking i ByggeplassVelger (fix-commit `d51c3690`). Topbar tilpasser seg pathname. På `/dashbord/firma/*`-ruter vises ny «Firma ▾»-velger istedenfor `ProsjektVelger` + `ByggeplassVelger`. Lar firma-admin og sitedoc-admin navigere direkte mellom firma- og prosjekt-kontekst. Favoritt-prosjekter persistert i localStorage med stjernemerking i alle tre velgere (`ProsjektVelger`, `FirmaKontekstVelger`, `ByggeplassVelger`). Søkefelt i alle velgere vises ved >7 elementer.

**Ny hook (`apps/web/src/hooks/useFavoritter.ts`, ~65 linjer):**
- `useFavoritter(userId)` — `{ favoritter: string[], erFavoritt, toggleFavoritt }`
- localStorage-nøkkel `sitedoc_favoritter_${userId}`. Per bruker, ikke per firma.
- Stille fallback til tom liste ved parse-feil eller manglende userId.

**Ny komponent (`apps/web/src/components/layout/FirmaKontekstVelger.tsx`, ~185 linjer):**
- «Firma ▾»-knapp med `Building2`-ikon, åpner dropdown.
- Søkefelt vises kun ved >7 prosjekter (matcher repo-mønster fra `feedback_sjekkliste_valgmuligheter`).
- To seksjoner: «Favoritter» (kun hvis det finnes favoritter) og «Alle prosjekter».
- Per rad: stjerneknapp (gold-fyllt ved favoritt) + navn + prosjektnummer. Klikk på rad → `router.push(/dashbord/{id})` og Toppbar bytter tilbake til vanlig oppsett automatisk via `usePathname`.
- `ProsjektRad`-subkomponent har separat stjerne-button slik at toggle-favoritt ikke trigger row-onClick.

**ProsjektVelger.tsx — utvidet (~50 nye linjer):**
- Importerer `useFavoritter` og `useSession`.
- Prosjektlisten deles i favoritter + andre — seksjons-label vises kun hvis favoritter finnes.
- Ny `ProsjektRad`-subkomponent (samme mønster som `FirmaKontekstVelger`) med stjerneknapp og row-button.
- Scope-rader («Alle prosjekter» / «Mine prosjekter») bevart for sitedoc-admin og firma-admin.

**Toppbar.tsx — usePathname-betinget rendering (~10 endrede linjer):**
- `erFirmaKontekst = pathname?.startsWith("/dashbord/firma") ?? false`.
- I firma-kontekst: `<FirmaKontekstVelger />` erstatter `ProsjektVelger` + `ByggeplassVelger`.
- Sitedoc-admin sin `FirmaVelger` beholdes til venstre i begge moduser (firma-bytte uavhengig av kontekst).
- Company-admin sin firma-fast-link beholdes som nå.

**i18n:** 7 nye nøkler under `topbar.*` i nb/en (`firma`, `sokProsjekt`, `ingenProsjekter`, `favoritter`, `alleProsjekter`, `fjernFavoritt`, `leggTilFavoritt`). Auto-oversatt til 13 språk via `generate.ts` (2258 totalt).

**Berører kun firma-admin og sitedoc-admin** — vanlig prosjektmedlem ser aldri firma-kontekst-rutene (firma-layout returnerer «ingen tilgang» uten `valgtFirma`). Stjernemerking i `ProsjektVelger` er tilgjengelig for alle.

**Verifisert:** `@sitedoc/web` typecheck 1 = 1 baseline (pre-eksisterende vitest-typedef). 0 nye feil.

**Reload-metode:** TypeScript-only + i18n. Full reload + cache-cleaning. Etter merge: `deploy-test-cron.sh` deployer automatisk til test.

**Kjente begrensninger:**
- Favoritt-toggle synkes ikke på tvers av enheter (localStorage er per-device). Skal vurderes flyttet til server-side `UserPreference`-tabell senere hvis kunder ber om sync.
- `topbar.firma`-labelen er fast «Firma» — sitedoc-admin med valgt firma ser samtidig `FirmaVelger` med firmanavn, så ingen kollisjon.

### PR T9 firmakalender (a/b/c) — DEPLOYET TIL PROD 2026-05-15 (prod merge `ca71cf48`)

Hele T9-bunken (schema + tRPC + web-admin-UI) er deployet til prod. Migrasjon `20260515114710_t9_arbeidstidskalender` kjørt 15:03:30. `/dashbord/firma/kalender` returnerer HTTP 200 i prod. Inkluderer:

- **T9a** (impl `92ee4975`): `ArbeidstidsKalender`-modell i `packages/db` med Variant B-felter, idempotent migrasjon, `beregnNorskeHelligdager(aar)` i `packages/db/src/seed/helligdager.ts` (Gauss-påskealgoritme uten ekstern avhengighet).
- **T9b** (impl `27123f13`): tRPC-router `apps/api/src/routes/firma/kalender.ts` med 6 prosedyrer (hentForAar, importerNorskStandard, opprett, oppdater, slett, hentForMobil). Zod-enum-validering, firma-admin-auth for skriving, soft-delete via `aktiv=false`, sommertid-par-status som myk varsling.
- **T9c** (impl `0997e81b`): Web-admin-UI på `/dashbord/firma/kalender` med år-velger, måneds-gruppert visning, type-badges, opprett/rediger-modal, sommertid-banner. 30 nye i18n-nøkler (`firma.kalender.*`) auto-oversatt til 13 språk.

Gjenstår: **T9d** mobil-cache `arbeidstidskalender_local` når T.4/T.5 trenger den. SummeringsBanner.tsx (T7-3a) trenger oppdatering etter T9d for å lese dagsnorm fra kalender-cache.

### PR T9c firmakalender — web-admin-UI — MERGET TIL DEVELOP OG PROD 2026-05-15 (develop merge `d8bc42f8`, prod merge `ca71cf48`, impl `0997e81b`)

Tredje sub-PR av T9-bunken. Web-admin-UI for å administrere firmakalender, med år-velger, måneds-gruppert visning, type-badges, opprett/rediger-modal og sommertid-banner.

**Sidebar-element (`apps/web/src/app/dashbord/firma/layout.tsx`):**
- Ny «Kalender»-lenke under «Timer-rapport» med `Calendar`-ikon. Ingen `kreverFirmaModul`-gating — kalenderen er tverrgående firma-funksjon, gated via at hele firma-layouten kun er tilgjengelig for firma-admin og sitedoc-admin.

**Side (`apps/web/src/app/dashbord/firma/kalender/page.tsx`, ~440 linjer):**

| Seksjon | Innhold |
|---|---|
| Topp-rad | Tittel + beskrivelse, år-velger (←/→-knapper + årsnummer), «Importer norsk standard {{aar}}»-knapp |
| Sommertid-banner | Vises kun når `sommertidStatus === "bare_start"` eller `"bare_slutt"`. Gul advarsel med `AlertTriangle`-ikon og forklarende tekst. |
| Måneds-liste | 12 kort, ett per måned. Hver viser måned-navn (norsk lokalisering via `Intl.DateTimeFormat`) + «+ Legg til»-knapp + rader. Tomme måneder viser «Ingen oppføringer.» |
| Rad | Ukedag + dato, type-badge (fargekodet per type), navn, halvdag-timer hvis aktuelt, rediger-pencil-ikon |

**Modal (`RadModal`):** Felles komponent for opprett og rediger. Felter: dato (locked i rediger-modus), type-Select (7 verdier), navn, timerOverstyr (vises kun for `halvdag`-type), aktiv-checkbox (kun i rediger-modus). Bunn-action-bar: «Deaktiver» (kun i rediger), «Avbryt», «Lagre».

**Type-badge-fargekoding:**
- `helligdag` → rød
- `fellesferie` → blå
- `klemdager` → indigo
- `sommertid_start/slutt` → amber
- `halvdag` → oransje
- `firma_fri` → grå

**Cache-invalidering:** Alle mutations (opprett/oppdater/slett/importer) kaller `utils.firma.kalender.hentForAar.invalidate()`. Importerings-suksess viser kort `alert` med antall opprettet/oppdatert/hoppet over.

**i18n:** 30 nye nøkler under `firma.kalender.*` i nb/en. Auto-oversatt til 13 språk via `generate.ts` (2251 totalt). Nøkler dekker tittel/beskrivelse, alle 7 type-navn (rendres via `t(\`firma.kalender.type.${rad.type}\`)`), modal-felter, sommertid-advarsel, feilmeldinger.

**Verifisert:** `@sitedoc/web` typecheck 1 = 1 baseline (pre-eksisterende vitest-typedef). 0 nye feil i kalender-koden.

**Reload-metode:** Server reload kreves ikke. TypeScript-only + i18n-endring. Test ved å åpne `/dashbord/firma/kalender` som firma-admin.

**Forventede begrensninger:**
- `confirm()` brukes for deaktiver-bekreftelse — pre-eksisterende mønster i denne mappen (jf. `firma/avdelinger/page.tsx`). Konvertering til Modal kan gjøres i felles oppfølger.
- Ingen «Slett permanent»-knapp — kun deaktivering. Audit-spor bevares; idempotent import respekterer admin-deaktivering.
- Mobil-cache (T9d) er separat sub-PR. SummeringsBanner (T7-3a) leser fortsatt fra `OrganizationSetting.dagsnorm` — oppdateres til å lese fra kalender-cache når T9d landes.

Klar for review og test. Etter merge: Kenneth verifiserer i nettleser at år-velger, import-knapp, opprett/rediger og badges fungerer på `test.sitedoc.no/dashbord/firma/kalender`.

### PR T9b firmakalender — tRPC-router + auth + importerNorskStandard — MERGET TIL DEVELOP 2026-05-15 (merge `0fdd625e`, impl `27123f13`)

Andre sub-PR av T9-bunken. Bygger server-API-laget over T9a-grunnmuren. Plassert på firma-nivå (`apps/api/src/routes/firma/`) per T.9-spec som sier kalenderen angår mer enn timer-modulen. Ny `firmaRouter`-aggregator gir framtidig rom for andre firma-rette routere uten flere top-level-nøkler.

**Router (`apps/api/src/routes/firma/kalender.ts`, ~340 linjer):**

| Prosedyre | Type | Auth | Innhold |
|---|---|---|---|
| `hentForAar({ organizationId, aar })` | query | `verifiserOrganisasjonTilgang` (medlemskap) | Aktive rader for år, sortert. Returnerer `{ rader, sommertidStatus }` der `sommertidStatus ∈ komplett \| bare_start \| bare_slutt \| ingen`. |
| `importerNorskStandard({ organizationId, aar })` | mutation | `autoriserAdminForFirma` | Kaller `beregnNorskeHelligdager(aar)` fra T9a-seed. Idempotent: oppdaterer navn på eksisterende aktive, hopper over admin-deaktiverte. Returnerer `{ opprettet, oppdatert, hoppetOver }`. |
| `opprett({ organizationId, dato, type, navn, timerOverstyr? })` | mutation | `autoriserAdminForFirma` | Zod-enum-validering av `type`. Validerer at `timerOverstyr` kun settes for `halvdag`-type. `aar` utledes fra `dato.getUTCFullYear()`. Returnerer `{ rad, sommertidStatus }`. |
| `oppdater({ id, organizationId, type?, navn?, timerOverstyr?, aktiv? })` | mutation | `autoriserAdminForFirma` | Henter raden først for eierskaps-verifikasjon. Dato kan ikke endres (opprett ny + slett gammel hvis du må). |
| `slett({ id, organizationId })` | mutation | `autoriserAdminForFirma` | Soft-delete via `aktiv=false` — ikke faktisk slett. Audit-spor + idempotent import respekterer admin-deaktivering. |
| `hentForMobil({ organizationId, fraAar, tilAar })` | query | `verifiserOrganisasjonTilgang` (medlemskap) | Periode-spørring for T9d mobil-cache. Validerer `fraAar ≤ tilAar`. |

**Zod-enum for type:** `helligdag | fellesferie | klemdager | sommertid_start | sommertid_slutt | halvdag | firma_fri`. Definert lokalt i router-fila — utvides uten DB-migrasjon.

**Sommertid-par-validering (myk):** Server kaster ikke feil ved opprettelse av enkelt-poster. `sommertidStatusForAar`-helperen returnerer paret-status sammen med rader/opprettelse-respons så UI (T9c) kan varsle. Hard validering legges på forbruks-siden (auto-fordeling) når begge poster trengs.

**timerOverstyr-validering:** Kun gyldig for `halvdag`-type. Må være `> 0` og `< 24`. Andre typer må sende `null`/`undefined` — ellers `BAD_REQUEST`.

**Router-aggregator (`apps/api/src/routes/firma/index.ts`):** Eksporterer `firmaRouter` med `kalender` som under-nøkkel. Registrert i `appRouter` som `firma: firmaRouter` — klient kaller `trpc.firma.kalender.hentForAar.useQuery(...)`.

**Verifisert:** `@sitedoc/api` typecheck 0 feil. `@sitedoc/web` typecheck 1 = 1 baseline (pre-eksisterende vitest-typedef). Mobil: ingen impact ennå (T9d henter `hentForMobil` senere).

**Reload-metode:** N/A — server-only. Migrasjonen fra T9a kjøres mot test ved deploy. Etter merge til develop kjører `deploy-test-cron.sh` migrasjonen automatisk.

**Gjenstår i T9-bunken:**
- **T9c:** Web-admin-UI på firma-nivå (`apps/web/src/app/dashbord/firma/kalender/`).
- **T9d (senere):** Mobil-cache `arbeidstidskalender_local` + sync-strategi via `trpc.firma.kalender.hentForMobil`.

Klar for review — ikke merge før Kenneth verifiserer på test.

### PR T9a firmakalender — schema + migrasjon + helligdager-seed — MERGET TIL DEVELOP 2026-05-15 (merge `30340e6f`, impl `92ee4975`)

Første sub-PR av T9-bunken (Firmakalender). Legger til grunnmuren — DB-tabell + idempotent seed-funksjon for norske helligdager. Ingen API-router og ingen UI ennå (kommer i T9b/T9c).

**Schema (`packages/db/prisma/schema.prisma`):**
- Ny modell `ArbeidstidsKalender` (linje 1942+). Variant B (dynamisk) per T.9-spec. Felter: `id, organizationId, aar, dato, type, navn, timerOverstyr, aktiv, createdAt, updatedAt`.
- `type` som `String` (validert via Zod-enum i API-laget — ikke Prisma-enum) slik at type-listen kan utvides uten migrasjon. Verdier: `helligdag | fellesferie | klemdager | sommertid_start | sommertid_slutt | halvdag | firma_fri`.
- `timerOverstyr Decimal(4,2)?` — matcher `OrganizationSetting.dagsnorm`-presisjon. Nullable, settes kun for `halvdag`-type.
- `aar Int` — duplikat av `year(dato)` for raskt år-filtrering og idempotent import.
- Unique `(organizationId, dato)` — én rad per dato per firma. Halvdag overstyrer helligdag på samme dato.
- Indekser: `(organizationId, aar)` for år-vy + `(organizationId, type, aar)` for type-spesifikke oppslag (f.eks. «finn sommertid-perioden i 2026»).
- Cascade-relasjon til `Organization`. Plassert i kjernen (`packages/db`), ikke `db-timer` — kalenderen angår flere moduler.

**Migrasjon (`20260515114710_t9_arbeidstidskalender/migration.sql`):**
- `CREATE TABLE arbeidstids_kalender` med tre indekser og FK med `ON DELETE CASCADE`.
- Idempotens ivaretas av server-laget ved import (`upsert` på `(organizationId, dato)`-nøkkelen).

**Seed (`packages/db/src/seed/helligdager.ts`, 95 linjer):**
- `beregnNorskeHelligdager(aar: number): Helligdag[]` returnerer 12 datoer per år.
- Bevegelige helligdager beregnes via Meeus/Jones/Butcher Gauss-påskealgoritmen (~15 linjer). Skjærtorsdag/Langfredag/2. påskedag/Kristi himmelfartsdag/1. og 2. pinsedag avledes som offset fra 1. påskedag.
- Faste: 1. nyttårsdag, Offentlig høytidsdag (1. mai), Grunnlovsdag (17. mai), 1. og 2. juledag.
- Returneres sortert etter dato, Date i UTC ved midnatt. Ingen ekstern dato-bibliotek-avhengighet (verifiserte at `date-fns-tz` ikke er nødvendig siden vi lagrer `date` uten tid).

**Eksport (`packages/db/src/index.ts`):** `beregnNorskeHelligdager` + `Helligdag`-type re-eksporteres fra `@sitedoc/db` for bruk i API-laget (T9b).

**Endring i spec (`docs/claude/fase-0-beslutninger.md § T.9`):** Import-mekanismen oppdatert fra `date-fns-tz` til innebygd Gauss-algoritme. Begrunnelse skrevet inn som «Endring fra opprinnelig spec (2026-05-15)».

**Verifisert:** `@sitedoc/db` typecheck 0 feil. `@sitedoc/api` typecheck 0 feil. `@sitedoc/web` typecheck 1 = 1 baseline (pre-eksisterende vitest-typedef-feil). Mobil bruker ikke `@sitedoc/db` — null impact.

**Reload-metode:** N/A — kun schema + ren TS-kode. Migrasjonen kjøres mot test ved deploy.

**Gjenstår i T9-bunken:**
- **T9b:** tRPC-router (`apps/api/src/routes/firma/kalender.ts`) med `hentForAar`, `importerNorskStandard`, `opprett`, `oppdater`, `slett`, `hentForMobil` + firma-admin-auth + Zod-enum-validering av `type`.
- **T9c:** Web-admin-UI (plassering avklares — antakelig `apps/web/src/app/dashbord/firma/kalender/`).
- **T9d (senere):** Mobil-cache `arbeidstidskalender_local` når T.4/T.5 trenger den.

Klar for review — ikke merge før Kenneth verifiserer migrasjonen på test.

### PR T7-3d per-rad-attestering for leder på mobil — DEPLOYET TIL PROD 2026-05-14 (merge `ae6e5a2d` på main, impl `ffebd082`)

Fjerde sub-PR av T7-3-bunken. Bringer attestering-flyten (T7-2b) til mobil. Prosjektleder og firma-admin kan nå attestere/returnere innsendte sedler fra mobil-appen — speil av webs `AttesteringDetalj`-felleskomponent, forenklet for mobil-flate.

**Nye filer (`apps/mobile`):**
- `src/components/timer-attestering/AttesteringStatusBadge.tsx` (~40 linjer) — `pending`/`attestert`/`returnert`-badge.
- `src/components/timer-attestering/RadCheckbox.tsx` (~80 linjer) — rad med checkbox + badge + info. Demper og deaktiverer ikke-tilgjengelige rader.
- `src/components/timer-attestering/ReturnerModal.tsx` (~115 linjer) — modal med multiline-TextInput for kommentar (obligatorisk). Speil av webs `ReturnerDialog`. Kaller `returnerRader`.
- `src/components/timer-attestering/AttesteringDetaljMobil.tsx` (~360 linjer) — kjernekomponent. Tre rad-seksjoner med per-rad-checkboxer, container-status-banner, bunn-action-bar (Attester/Returner). Pre-utvalg av pending-rader ved sideåpning. Cache-invalidering ved suksess.
- `app/timer/attestering/index.tsx` (~150 linjer) — liste-side. Henter `hentTilAttesteringFirma` via `prosjekt.hentMine` → første `primaryOrganizationId` som proxy. Kort-format. Gating-bannere ved ingen tilgang.
- `app/timer/attestering/[id].tsx` (~50 linjer) — tynn wrapper som monterer `AttesteringDetaljMobil`.

**Endret:**
- `app/(tabs)/mer.tsx` — ny menylenke «Attester timer» gated på `kanAttestereFirma`. Lenken er skjult for arbeidere uten leder-tilgang.

**Server/skjema:** Null endring. Bruker eksisterende `hentTilAttesteringFirma`, `hentForAttestering`, `kanAttestereFirma`, `attesterRader`, `returnerRader` fra T7-2b1-deploy.

**i18n:** Null nye nøkler. Alle gjenbrukt fra T7-2b (`timer.attestering.*`, `timer.detalj.*`, `handling.*`).

**Forenklinger ifht. web (bevisst scope-redusering):**
- Ingen edit-modus (T7-2b2) — firma-admin redigerer på web.
- Ingen ECO-flytting per rad — utelates på mobil.
- Ingen rediger-header-modal. Lederen attesterer, redigerer ikke.
- Kun firma-kontekst (ingen `prosjektKontekst`-prop) — mobil-tabs er firma-orienterte.

**Auth/datastrøm:** Online-only. Krever nett for mutations (samme som web — snapshot via A.7). Ingen lokal queue.

**Verifisert:** `apps/api` typecheck 0 = 0 feil. `apps/mobile` typecheck 12 = 12 baseline (0 nye feil). Pre-eksisterende `mer.tsx`-feil flyttet fra linje 81 til linje 101 pga. linjeforskyvning.

**Reload-metode:** TypeScript-only. Full app-reload eller `r` i Metro. Ingen native rebuild.

### T7-3-bunken (a/b1/b2/d) — DEPLOYET TIL PROD + venter på EAS-bygg

Alle fire sub-PR-er av T7-3 (mobil timer-redesign) er på `main`. Server-route-endringer er aktive i prod (`223afc17` for a/b1/b2 2026-05-14, `ae6e5a2d` for d). Mobil-endringene er sovende på enhet til neste EAS Build → TestFlight / Play Store.

| Sub-PR | Merge-commit | Impl-commit | Status | Innhold |
|---|---|---|---|---|
| **T7-3a** | `22a97402` | `fc087b65` | ✅ prod | Arbeidstid-seksjon + summerings-banner i mobil-detalj. Speil av T7-1a. |
| **T7-3b1** | `cd64c51a` | `65bf48cb` | ✅ prod | Per-rad `projectId` (skjema + lokal migrasjon + sync push/pull + prosjekt-katalog-cache). Ingen UI. |
| **T7-3b2** | `3e34ec71` | `1717fd79` | ✅ prod | UI for per-rad prosjektvelger + ProsjektGruppe-visning i [id].tsx + geo-forslag i ny.tsx. |
| **T7-3d** | `ae6e5a2d` | `ffebd082` | ✅ prod | Per-rad-attestering for leder på mobil. Speil av webs AttesteringDetalj (forenklet). |

Gjenstår av T7-3-bunken:
- **T7-3c (planlagt eller forkastet):** Geo-forslag-utvidelser. Mye av denne ble levert i T7-3b2 — egen sub-PR kan dekke historikk/justeringer eller forkastes.

### PR T7-3b2 prosjekt-velger per rad + geo-forslag — DEPLOYET TIL PROD 2026-05-14 (server-route, prod-commit `223afc17`) + venter på mobil-bygg (merge `3e34ec71`, impl `1717fd79`)

Tredje sub-PR av T7-3-bunken. Aktiverer den brukervendte siden av per-rad-prosjekt: brukeren kan velge prosjekt per rad i timer/tillegg/maskin-modaler, dagsseddelen grupperer rader per prosjekt, og GPS-posisjon foreslår nærmeste prosjekt ved opprettelse. Ingen DB-, sync- eller server-endringer (alt fundament fra T7-3b1).

**Filer (`apps/mobile`):**
- **Ny** `src/components/timer-detalj/ProsjektVelger.tsx` (~130 linjer) — gjenbrukbar `ProsjektVelgerModal` + `ProsjektFelt`-trigger-knapp. Leser fra `prosjektLocal` via `hentProsjekterLokalt(organizationId)`. Søk når > 7 prosjekter. `ekskluderIder`-prop for «+ Legg til prosjekt»-knapp som filtrerer bort prosjekter som allerede har rader.
- `src/components/timer-detalj/TimerSeksjon.tsx` — `TimerSeksjonProps` utvidet med `organizationId`. `leggTil`/`oppdater` tar nå `projectId` per rad. `TimerRadModal` får ProsjektFelt + ProsjektVelgerModal. Default = sedel-prosjekt. Underprosjekt-velger (ECO) filtreres på rad-prosjekt — bytte av prosjekt nullstiller ECO siden Underprosjekt er prosjekt-spesifikk.
- `src/components/timer-detalj/TilleggSeksjon.tsx` — samme mønster: `organizationId` + `projectId` props, rad-modal med ProsjektFelt.
- `src/components/timer-detalj/MaskinSeksjon.tsx` — samme.
- `app/timer/[id].tsx` — beregner `aktiveProsjektIder` (union av sedel.projectId + alle rad.projectId + bruker-tilføyde). Rendre én `ProsjektGruppe` per id med tre seksjoner og rader filtrert til prosjektet. Header med prosjekt-navn vises kun ved multi-prosjekt. «+ Legg til prosjekt»-knapp åpner ProsjektVelgerModal med `ekskluderIder=aktiveProsjektIder`.
- `app/timer/ny.tsx` — `useEffect` ved sideåpning: `Location.requestForegroundPermissionsAsync` → `getCurrentPositionAsync` → Haversine mot `hentProsjekterLokalt(orgId)` med 500m radius. Foreslår nærmeste prosjekt som default hvis bruker ikke har valgt manuelt. Stille fallback ved permission-avslag eller ingen treff. Visuell `MapPin`-indikator + «Foreslått basert på posisjon»-tekst når geo-forslag er aktiv.
- `src/utils/dato.ts` + `src/types/timer-detalj.ts` — ingen endring fra T7-3b1 (Prosjekt-type allerede eksportert).

**Skjema/server:** Null endring. Alt fundament ble lagt i T7-3b1.

**i18n:** 1 ny nøkkel (`handling.sok` = «Søk» / «Search») — pre-eksisterende bug der eksisterende velgere brukte t-key som ikke fantes (fallback til strengen «handling.sok» i UI). Lagt til i nb + en, auto-oversatt til 13 språk. `timer.leggTilProsjekt`, `timer.geoForslag`, `timer.felt.prosjekt`, `timer.velgProsjekt`, `timer.ingenTilgjengelige` finnes allerede.

**`app.json`/permissions:** `expo-location` v19.0.8 allerede installert + config-plugin med norsk permission-tekst på plass siden tidligere fase (GPS-tagging av bilder). Null endring.

**Verifisert:** `apps/api` typecheck 0 = 0 feil. `apps/mobile` typecheck 12 = 12 baseline (0 nye feil). ECO-bytte ved prosjekt-bytte testes via observasjon — `valgtEcoId` nullstilles i `TimerRadModal` når ProsjektVelger setter ny `valgtProjectId`.

**Reload-metode:** TypeScript- + i18n-endring. Full app-reload (close + open eller `r` i Metro). Ingen native rebuild (expo-location er allerede konfigurert).

**Forventede begrensninger:**
- Per-rad-attestering på mobil — kommer i T7-3d eller forkastes hvis attestering forblir web-only.
- `dagsseddelLocal.projectId` beholdes som default. NOT NULL → drop kommer i T7-4+.
- Geo-forslag krever permission ved første gang — brukeren får OS-dialog. Avslag = fall tilbake til manuell velger.

Klar for review — ikke merge før Kenneth verifiserer på test.

### PR T7-3b1 prosjekt per rad — skjema + sync + katalog — DEPLOYET TIL PROD 2026-05-14 (server-route, prod-commit `223afc17`) + venter på mobil-bygg (merge `cd64c51a`, impl `65bf48cb`)

Andre sub-PR av T7-3-bunken. Forberedelse for T7-3b2 (UI per-rad-velger). Etter denne har mobil per-rad `projectId`-felt i lokal SQLite + sync-protokollen sender/mottar per-rad projectId mot server. Server-shimmen fra T.1 (sedel-nivå `projectId` for pre-T7-3b1-klienter) beholdes for bakoverkompatibilitet — server støtter både gammelt og nytt format. INGEN UI-endringer i denne PR-en; lokal projectId backfilles fra `dagsseddelLocal.projectId` og rad-velger kommer i T7-3b2.

**Lokal SQLite-migrasjon (idempotent ALTER, mønster fra `migreringer.ts:254-272`):**
- ALTER ADD COLUMN `project_id TEXT` på `sheet_timer_local` / `sheet_tillegg_local` / `sheet_machine_local`.
- Backfill fra parent `dagsseddel_local.project_id` (UPDATE WHERE NULL).
- Indeks på `project_id` per tabell.
- Ny `prosjekt_local`-tabell (id, organization_id, name, project_number, lat, lng, aktiv, sist_oppdatert) + indeks på (organization_id, aktiv).

**Klient (`apps/mobile`):**
- `src/db/schema.ts` — `projectId` (nullable) på alle tre rad-tabeller + ny `prosjektLocal`-tabell.
- `src/db/migreringer.ts` — idempotent ALTER + backfill + indekser + CREATE TABLE for prosjekt_local.
- `src/services/prosjektKatalog.ts` (ny, ~95 linjer) — `refreshProsjektKatalog` (henter `trpc.prosjekt.hentMine`, hopper over standalone uten `primaryOrganizationId`, lagrer til prosjekt_local), `hentProsjekterLokalt(orgId)`, `finnProsjektLokalt(id)`.
- `src/providers/TimerSyncProvider.tsx` — `refreshProsjektKatalog` lagt til i `Promise.all` ved login + nett-gjenkomst (samme mønster som maskinKatalog).
- `src/services/timerSync.ts` — sender `projectId` per rad i `syncBatch` (fallback til sedel-nivå). Skriver per-rad projectId ved pull (fallback til sedel-nivå for legacy-respons).

**Server (`apps/api/src/routes/timer/dagsseddel.ts`):**
- `syncBatch`-input utvidet med `projectId: z.string().uuid().optional()` per rad (timer/tillegg/maskiner). Rad-nivå overstyrer sedel-nivå hvis satt; ellers fall tilbake til `lokal.projectId` (kompat-shim).
- `hentEndringerSiden`-respons utvidet med `projectId` per rad (timer/tillegg/maskiner) så klient kan lagre per-rad-attribusjon.
- Ny auth-sjekk: `verifiserProsjektmedlem` kalles for hver unike per-rad-`projectId` som avviker fra sedel-nivå. Hindrer at bruker fører timer på prosjekt de ikke er medlem av via per-rad-attributt.

**Skjema-status server:** `db-timer.SheetTimer/Tillegg/Machine.projectId` finnes fra T.1 (PR 1B 2026-05-11). Null Prisma-migrasjon i denne PR-en.

**Verifisert:** `apps/mobile` typecheck 12 = 12 baseline (0 nye feil). `apps/api` typecheck 0 = 0 feil.

**Reload-metode:** Telefon-app — TypeScript + Drizzle-skjema-endring, krever full app-reload (eller close + open) slik at `migreringer.ts` kjører ved oppstart og ALTER-statementene legger til kolonnene. Ingen native rebuild.

**Forventede begrensninger (kommer i T7-3b2/c/d):**
- Ingen UI for per-rad-prosjektvelger ennå — alle nye rader får automatisk `sedel.projectId` via fallback. Etter UI er på plass (T7-3b2) kan brukeren velge avvikende prosjekt per rad.
- `dagsseddelLocal.projectId` beholdes som «default-prosjekt for nye rader» og fallback-verdi for legacy data. NOT NULL → drop kommer i T7-4+ etter alle telefoner kjører ny app.
- Geo-forslag (lat/lng-feltene i prosjekt_local) kommer i T7-3c.

Klar for review — ikke merge før Kenneth verifiserer på test.

### PR T7-3a arbeidstid-seksjon + summerings-banner på mobil — DEPLOYET TIL PROD 2026-05-14 (server-route, prod-commit `223afc17`) + venter på mobil-bygg (merge `22a97402`, impl `fc087b65`)

Første sub-PR av T7-3-bunken (mobil timer-redesign). Speil av T7-1a på mobil. Bringer mobil opp på samme nivå som web for arbeidstid-registrering og løpende summering. Ingen DB-migrasjon, ingen sync-endring, ingen server-endring.

**Klient (`apps/mobile`):**
- Ny `src/components/timer-detalj/ArbeidstidSeksjon.tsx` (~270 linjer) — visning av start/slutt/pause + edit-modal med `DateTimePicker` (time-mode, 24h) for startAt/endAt og number-input for pauseMin. Lagrer direkte til `dagsseddelLocal` via drizzle og markerer `syncStatus: "pending"` slik at `TimerSyncProvider` propagerer endringen til server ved neste sync.
- Ny `src/components/timer-detalj/SummeringsBanner.tsx` (~45 linjer) — viser registrerte timer vs utledet arbeidstid med fargekoding (grønn `totaltimer >= arbeidstidTimer`, gul ellers, grå hvis arbeidstid mangler). Bruker eksisterende i18n-nøkkel `timer.summering`.
- `src/utils/dato.ts` — ny `isoTidspunktTilHHMM(iso)`-helper (kopi av webs implementasjon).
- `app/timer/[id].tsx` — monterer ArbeidstidSeksjon over TimerSeksjon, beregner `arbeidstidTimer = (endAt - startAt) - pauseMin/60` og `totaltimer = sum(timerRader.timer)` via `useMemo`, monterer SummeringsBanner over Send-knappen (kun når `erRedigerbar`).

**Server/skjema:** Ingen endring. `dagsseddel.upsert`/`syncBatch` aksepterte allerede `startAt/endAt/pauseMin` fra T7-1a-deploy. `dagsseddelLocal`-skjemaet har feltene fra Runde 2.

**i18n:** Gjenbruker eksisterende nøkler fra T7-1a (`timer.arbeidstidIDag`, `timer.arbeidstidIDagBeskrivelse`, `timer.summering`, `timer.felt.startTid`/`sluttTid`/`pauseMin`, `handling.rediger`/`lagre`/`avbryt`). 2 nye feilmelding-nøkler i nb/en (`timer.feil.ugyldigPause`, `timer.feil.sluttForStart`) — auto-oversatt til 13 språk via `generate.ts`.

**Verifisert:** `apps/mobile` typecheck 12 = 12 baseline (0 nye feil). Mine filer har null typescript-feil. Pre-eksisterende mobil-typecheck-baselinje uberørt.

**Forventede begrensninger (kommer i T7-3b/c/d):**
- Sedel er fortsatt prosjekt-bundet (`sedel.projectId`). Multi-prosjekt på rad-nivå kommer i T7-3b.
- Ingen geo-forslag ved opprettelse — kommer i T7-3c.
- Per-rad-attestering på mobil — kommer i T7-3d (eller forkastes hvis attestering forblir web-only).

Klar for review — ikke merge før Kenneth verifiserer på test.

### Server-side fix: `deploy-test-cron.sh` cache-bug DEPLOYET PÅ TEST-SERVER 2026-05-14

Auto-deploy-skriptet `~/programmering/deploy-test-cron.sh` (cron hvert 2. min på test-serveren) hadde en stale `.next`-cache-bug som trigget «Cannot read properties of undefined (reading 'clientModules')»-feilen tre ganger denne uken (T7-2b1, T7-2b3, attestering-hint). Hver gang krevde manuell `rm -rf apps/web/.next + pnpm build + pm2 restart` på test for å løse.

**Fiks:** Lagt til `STEG="clean_next" && rm -rf apps/web/.next` som eget steg i deploy-pipelinen mellom `prisma_migrate` og `build`. Trade-off: hver auto-deploy gjør nå full rebuild fra scratch (~30-60s lengre) i stedet for inkrementell, men eliminerer cache-divergens-bug. Backup-fil: `~/programmering/deploy-test-cron.sh.bak` på serveren.

Skriptet er **ikke i repoet** — det ligger kun på test-serveren. Endringen er server-side og påvirker ikke prod (`./deploy.sh` gjør allerede full rebuild).

### attestering-hint — kontekstuell hint om redigering DEPLOYET TIL PROD 2026-05-14 (prod-commit `d194332c`)

Diskret blå info-stripe i AttesteringDetalj.tsx. Synlig kun for firma-admin når
tillattRedigerVedAttestering = false. Lenker til /dashbord/firma/innstillinger.
Progressive Disclosure-mønsteret — kan gjenbrukes andre steder.

### PR T7-2b3 settings-toggle for «Tillat redigering ved attestering» DEPLOYET TIL PROD 2026-05-14 (prod-commit `af4a7deb`)

Siste sub-PR av T7-2b-bunken. Aktiverer firma-admin til å skru `OrganizationSetting.tillattRedigerVedAttestering` på/av via UI. Med flagget på vises Rediger-knappen fra T7-2b2 i attestering-detalj-siden. Default forblir false (mest restriktivt) — kunder må eksplisitt slå på.

**Klient (`apps/web/src/app/dashbord/firma/innstillinger/page.tsx`):**
- Ny `RedigerVedAttesteringSeksjon`-komponent (~70 linjer) etter `KompetansePolicySeksjon`. Følger eksakt samme mønster som `TilgangPolicySeksjon`: henter `OrganizationSetting` via `hentSetting`-query, viser tittel + beskrivelse + checkbox-toggle + warning-tekst, kaller `oppdaterSetting({ tillattRedigerVedAttestering: boolean })` ved endring.
- Montert i hovedsiden mellom kompetansematrise-seksjon og hjelp-modal.

**Server/schema:** Ingen endringer. Server-input ble klargjort i T7-2b2 (`oppdaterSetting` tar allerede `tillattRedigerVedAttestering: boolean.optional()`).

**i18n:** 5 nye nøkler i nb/en under `firma.innstillinger.redigerVedAttestering.*` (tittel, beskrivelse, toggle-label, warning, feil). Auto-oversatt til 13 språk.

**Verifisert:** `apps/web` typecheck 0 nye feil. Ingen `apps/api`-endring.

**Etter denne PR-en er hele T7-2b-bunken (per-rad-attestering + edit-modus + settings-UI) komplett.** Gjenstår T7-3 (mobil timer-redesign) og audit-log-payload-utvidelse (separat oppfølger).

Klar for review — ikke merge før Kenneth verifiserer.

### PR T7-2b2 edit-modus ved attestering DEPLOYET TIL PROD 2026-05-14 (prod-commit `755c542a`)

Andre sub-PR av T7-2b-bunken. Firma-admin kan redigere alle pending-rader på en sedel direkte uten å returnere til arbeider. Gates på ny `OrganizationSetting.tillattRedigerVedAttestering` (default false — settings-UI for å skru på kommer i T7-2b3).

**Schema:**
- `OrganizationSetting.tillattRedigerVedAttestering Boolean @default(false)` — migration `20260514120000_t7_2b2_tillatt_rediger`.
- `SheetTimer/SheetTillegg/SheetMachine.parentRadId String?` + indeks — migration `20260514120000_t7_2b2_parent_rad_id` (db-timer). Svak selvreferanse (A.20). Ingen FK.
- `attestertStatus`-domene utvidet: ny verdi `"erstattet"` for originaler som overskrives ved rediger. Beholdes som audit-spor.

**Server (`apps/api/src/routes/timer/dagsseddel.ts`):**
- Ny `redigerSedelRader({ sheetId, nyeRader: { timer[], tillegg[], maskin[] } })`. Hver rad har `originalId: uuid | null` (null = helt ny). Auth: kun firma-admin (`autoriserAdminForFirma`). Gate: `tillattRedigerVedAttestering === true` → PRECONDITION_FAILED ellers. Cross-org-validering på alle `projectId`. Transaksjon: marker alle eksisterende pending-rader som `"erstattet"` + opprett nye rader med `parentRadId = originalId` og `status = "pending"`. Activity-log per rediger.
- `hentForAttestering`: respons utvidet med `redigerTillatt: boolean` (utledet fra org-setting).
- `oppdaterSetting` (`apps/api/src/routes/organisasjon.ts`): Zod-input utvidet med `tillattRedigerVedAttestering: boolean.optional()`.

**Web:**
- Ny `apps/web/src/components/timer/AttesteringDetalj_Edit.tsx` (~400 linjer). Eier edit-state: tre `useState<RedigerXxxRadData[]>` med startverdier fra pending-rader. Komprimert original-seksjon øverst (lukke-bar `<details>`). Tre seksjoner under: timer/tillegg/maskin med inline-rader + «+ Legg til»-knapper. Lagre kaller `redigerSedelRader`-mutation. Avbryt forkaster endringer.
- Tre nye sub-komponenter: `RedigerTimerRad.tsx`, `RedigerTilleggRad.tsx`, `RedigerMaskinRad.tsx` (inline-form per rad-type med slett-knapp).
- Felles types-fil: `rediger-types.ts`.
- `AttesteringDetalj.tsx`: ny `redigerModus`-state + Rediger-knapp i action-bar (vises bare hvis `sheet.redigerTillatt === true`). Når redigerModus = true, vises Edit-komponent istedenfor standard attestering-rader. `TimerRad`-/`MaskinRad`-typer utvidet med `byggeplassId`/`fraTid`/`tilTid` slik at typene matcher Edit-komponentens forventninger.

**i18n:** 22 nye nøkler i nb/en (`timer.rediger.*` for knapper, modus-banner, placeholders, validerings-feilmeldinger). Auto-oversatt til 13 språk via `generate.ts`.

**Verifisert:** `apps/api` typecheck 0 nye feil. `apps/web` typecheck 0 nye feil (kun pre-eksisterende vitest).

**Designvalg/lock per locked design:**
- Edit-modus per sedel — ikke per rad.
- Original-rader komprimert som referanse (read-only) over edit-listen.
- Eksisterende rader redigerbare inline; «+»-knapp legger til ny rad pre-fylt med default unntatt mengde-felter.
- Splitting (1 → N) er implisitt: slett original-raden i edit-listen og legg til to nye — opprinnelig parentRadId-peker bevares for de nye radene som beholder original-id, ellers settes til null.
- Settings-UI for `tillattRedigerVedAttestering` = T7-2b3 (ikke i denne PR-en — flagget er default false i prod, Rediger-knappen er dermed dormant).

**Forventede begrensninger (kommer senere):**
- T7-2b3: settings-UI på `firma/innstillinger/page.tsx`-siden + audit-log-payload utvidet med før/etter-snapshots per rad.
- Mobil: får ikke edit-modus i T7-3 (kun firma-admin web-flow).
- ECO-listen i RedigerTimerRad henter på `rad.projectId` — bytter projectId → ECO-listen re-fetches automatisk.

Klar for review — ikke merge før Kenneth verifiserer.

### PR T7-2b1 per-rad-attestering + felleskomponent AttesteringDetalj DEPLOYET TIL PROD 2026-05-14 (prod-commit `3234c057`)

Første av T7-2b-bunken. Bytter attestering fra per-sedel til per-rad og refaktorerer detalj-siden til projectId-løs felleskomponent. Forutsetning for T7-2b2 (rad-splitting) + T7-2b3 (`tillattRedigerVedAttestering`-flagg + audit-log).

**Schema (`packages/db-timer/prisma/schema.prisma`):** Kun kommentar-oppdatering. `SheetTimer`/`SheetTillegg`/`SheetMachine.attestertStatus`-verdiene normalisert i kommentar fra `"godkjent"` → `"attestert"` (norsk-konvensjon, følger «attestering ≠ godkjenning»-regelen). Selve feltet har vært i schema siden PR 1B (2026-05-11) med default `"pending"` og indeks på alle tre tabeller. **Ingen migrasjon kreves** — null historiske rader er skrevet med `"godkjent"`.

**Server (`apps/api/src/routes/timer/dagsseddel.ts`):**
- Nye mutations: `attesterRader({ radIder })` og `returnerRader({ radIder, kommentar })`. Input: `{ timerIder, tilleggIder, maskinIder }` arrays. Auth: én `krevProsjektLeder`-sjekk per unike `projectId` (ikke per rad — perf). Validerer at alle rader har `attestertStatus === "pending"`. Snapshot per rad i transaksjon (Fase 0 A.7). Etter mutasjon: sedler markeres `"accepted"` kun hvis alle rader nå er `"attestert"`; én returnert rad → sedel-status → `"returned"`.
- `hentForAttestering`: utvidet auth med firma-admin-fallback (`autoriserAdminForFirma`) hvis `krevProsjektLeder` feiler — slik at firma-detalj-side kan bruke samme query.
- `hentTilAttesteringFirma`: utvidet `include` med `maskiner: true` så klient kan vise fremdrift på tvers av alle tre rad-tabeller.
- `attester`/`returner`: beholdt som `@deprecated` thin wrappers (henter alle pending-rader på sedelen, gjør samme operasjon). Fjernes ~1 uke etter klient-migrering per CLAUDE.md API-regel.

**Web:**
- Ny felleskomponent `apps/web/src/components/timer/AttesteringDetalj.tsx` (~620 linjer). Props: `sheetId`, `prosjektKontekst?: string` (undefined = firma-kontekst), `tilbakeUrl`. Per-rad-checkboxer + rad-status-badges (`pending`/`attestert`/`returnert`) i hver av tre rad-tabeller. Pre-utvalg: alle pending-rader leder har tilgang til. Container-status-banner viser fremdrift («3 av 8 attestert»). Rader fra andre prosjekter vises disabled i prosjekt-kontekst.
- `apps/web/src/app/dashbord/[prosjektId]/timer/attestering/[id]/page.tsx`: tidligere 591 linjer, nå tynn wrapper (~50 linjer) som monterer felleskomponenten med `prosjektKontekst={params.prosjektId}`.
- `apps/web/src/app/dashbord/firma/timer/attestering/[id]/page.tsx`: ny side (~60 linjer). Bruker `useFirma()` + `kanAttestereFirma`-query, monterer felleskomponenten projectId-løs.
- `firma/timer/attestering/page.tsx`: «Åpne»-lenken peker nå til `/dashbord/firma/timer/attestering/${rad.id}` istedenfor prosjekt-bundet ruten (firma-admin uten prosjekt-medlemskap kan nå åpne detalj).

**i18n:** 12 nye nøkler i nb/en (rad-status × 3, rad-valg-knapper/etiketter × 6, container-banner × 3). Auto-oversatt til 13 språk via `generate.ts`.

**Verifisert:** `apps/api` typecheck 0 nye feil. `apps/web` typecheck 0 nye feil (kun pre-eksisterende vitest-typedef-feil).

**Forventede begrensninger (kommer i T7-2b2/b3):**
- Ingen rad-splitting — én rad kan ikke deles i flere ved attestering.
- Ingen direkte-redigering av timer/fra-til/ECO/lønnsart for firma-admin ved attestering — krever `OrganizationSetting.tillattRedigerVedAttestering` (T7-2b3).
- Returnert rad-status nullstilles ikke ved gjenutsending (`sendTilAttestering`) — separat oppfølger.
- Mobil får per-rad-attestering først i T7-3.

Klar for review — ikke merge før Kenneth verifiserer.

### PR ansattrolle-UI — stilling + firmaRoller synlig+redigerbar i firma/ansatte DEPLOYET TIL PROD 2026-05-13 (prod-commit `3fa34c57`)

Oppfølger til O-5-bunken. Lukker konsistens-hullet hvor `endreRolle`-UI-en skrev til legacy `User.role` uten å speile til `OrganizationMember.firmaRoller` (25/26 OrganizationMember-rader i test hadde fortsatt `firmaRoller = []`). Synliggjør og redigerbar-gjør `ansattRolle` (stilling) + `firmaRoller` i firma/ansatte-siden.

**Backfill (`packages/db/scripts/backfill-firma-admin-roller.ts`):** Setter `firmaRoller = ["firma_admin"]` for alle OrganizationMember-rader der `User.role === "company_admin"`. Idempotent. Kjøres mot test etter deploy.

**Server (`apps/api/src/routes/organisasjon.ts`):**
- Slettet `endreRolle` (skrev kun til legacy `User.role`).
- Ny `settFirmaAdmin({ userId, organizationId, erAdmin: boolean })` — skriver til `OrganizationMember.firmaRoller`, idempotent, med selv-degraderingsbeskyttelse + sitedoc_admin-beskyttelse.
- `oppdaterBruker`: fjernet `rolle`-feltet, lagt til `ansattRolle: enum("ansatt","bas","prosjektleder","daglig_leder")`. Skriver ansattRolle til OrganizationMember sammen med eksisterende ansattnummer. Respons utvidet med `ansattRolle` + `firmaRoller`.
- `inviterBruker`: byttet `rolle: enum` til `erFirmaAdmin: boolean` + ny `ansattRolle: enum`. `User.role` settes alltid til `"user"` for nye brukere (sitedoc_admin opprettes ikke via UI). `OrganizationMember` opprettes med riktig `ansattRolle` + `firmaRoller`.
- `hentTilgjengelige`: leser nå firma-admin-medlemskap via `OrganizationMember.firmaRoller.includes("firma_admin")` (ikke `User.role === "company_admin"`). Støtter implisitt flere firmaer per bruker.

**Web (`apps/web/src/app/dashbord/firma/ansatte/page.tsx`):**
- To nye tabell-kolonner: «Stilling» (ansattRolle som tekst) + «Tilgang» (Systemadmin/Firmaadmin/Bruker-badges basert på `User.role === "sitedoc_admin"` eller `firmaRoller.includes("firma_admin")`).
- Legacy `endreRolle`-dropdown fjernet — alle endringer går nå via rediger-modalen.
- `RedigerModal`: ny `ansattRolle`-dropdown (4 verdier) + `erFirmaAdmin`-checkbox. Lagre-knappen kaller `oppdaterBruker` først, deretter `settFirmaAdmin` hvis admin-status endres.
- `InviterModal`: samme to nye felter, sendes til `inviterBruker`.

**i18n:** 17 nye nøkler i `nb.json` + `en.json`, 3 utdaterte fjernet (`inviter.rolle*`). Auto-oversatt til 13 språk via `generate.ts`.

**Verifisert:** `apps/api` typecheck 0 nye feil. `apps/web` typecheck 0 nye feil (kun pre-eksisterende vitest-typedef-feil). Ingen schema-endring.

Klar for review — ikke merge før Kenneth verifiserer.

### PR O-5c schema-drop User.organizationId/ansattnummer/avdelingId + OrganizationRole — prod `fe1d703d` (2026-05-13)

Sluttsteg i O-5-bunken. Fjernet `User.organizationId`/`User.ansattnummer`/`User.avdelingId` + tre Prisma-relasjoner fra `packages/db/prisma/schema.prisma`. Composite uniques erstattet av globalt `email @unique`. `OrganizationRole`-tabellen droppet (0 rader). Migration `20260513210000_o5c_drop_user_org_fields`. 5 routes-callsites omarbeidet (admin/avdeling/bruker/medlem) for å beholde klient-API uberørt. Apps typecheck 0 nye feil. OrganizationMember er nå eneste sannhetskilde for firma-medlemskap, ansattnummer og avdelingsskap.

### PR O-5b-fix rydd 11 resterende User.organizationId/ansattnummer-treff — prod `fe1d703d` (2026-05-13)

Oppfølger til O-5b. Full-codebase-grep avdekket 11 ekstra lesinger/skrivinger av `User.organizationId`/`User.ansattnummer` som O-5b ikke fanget (mønster `where: { organizationId }` i User-spørringer). Refaktorert med `hentBrukersOrg`/`OrganizationMember.findMany`/`OrganizationMember.upsert` i `tilgangskontroll.ts`, `kompetanse.ts`, `medlem.ts`, `maskin/*`, `organisasjon.ts`. Sluttverifikasjon: 0 gjenstående direkte felt-lesinger eller -skrivinger i `apps/api/src/`. +99/-65 linjer, apps typecheck 0 nye feil.

Eldre PR-er: se [docs/claude/historikk-2026-05.md](docs/claude/historikk-2026-05.md)


---

# SiteDoc — aktuell status

Detaljert løpende statusrapport. CLAUDE.md har kort sammendrag øverst med
peker hit. Beslutningsgrunnlag og arkitektur ligger i
[fase-0-beslutninger.md](fase-0-beslutninger.md) og
[arkitektur-syntese.md](arkitektur-syntese.md).

## Kundeønsker — A.Markussen (mottatt 2026-05-06)

12 forbedringsønsker fra kunde. Status per 2026-05-11 etter sjekk mot kode og commits. Legenda: 🟢 fikset · 🟡 delvis · 🔴 ikke startet · ❓ trenger verifikasjon · ⏸️ parkert.

### #1 — Sjekkliste for service koblet til timetall og status 🟡

**Side:** Maskin-detaljer (f.eks. 7634 Heatwork MY35). **Prioritet:** Høy.

Kunden ønsker sjekkliste der timetall kobles til servicestatus, og «neste service» oppdateres automatisk.

**Status:** DB-feltet `nesteServiceTimer` finnes allerede i `packages/db-maskin/prisma/schema.prisma:188`. Mangler: UI-felt på maskin-detaljside, serviceintervall-konfigurasjon, visuell terskel-indikator, sjekkliste med avkrysningsbokser, automatisk oppdatering av neste service basert på driftstimer.

### Firmakalender — T9a/b/c deployet til prod ✅, T9d gjenstår 🟡

T9a/b/c deployet til prod 2026-05-15 (prod merge `ca71cf48`).
Migrasjon `20260515114710_t9_arbeidstidskalender` kjørt 15:03:30.
`/dashbord/firma/kalender` returnerer HTTP 200 i prod.

Gjenstår: **T9d** mobil-cache `arbeidstidskalender_local` (avhenger av
T.4/T.5-implementasjon). SummeringsBanner.tsx (T7-3a) trenger oppdatering
etter T9d for å lese dagsnorm fra kalender-cache i stedet for
`OrganizationSetting.dagsnorm`.

### Topbar firma-kontekst + favoritter — deployet til prod ✅

Deployet til prod 2026-05-15 (prod merge `0bd27466`). Topbar tilpasser seg
pathname: i firma-kontekst (`/dashbord/firma/*`) vises ny «Firma ▾»-velger
istedenfor `ProsjektVelger` + `ByggeplassVelger`. Favoritt-prosjekter og
favoritt-byggeplasser persistert i localStorage med stjernemerking i alle
tre velgere (`ProsjektVelger`, `FirmaKontekstVelger`, `ByggeplassVelger`).
Søkefelt vises ved >7 elementer. 11 nye i18n-nøkler totalt
(`topbar.*` + `byggeplassVelger.*`) auto-oversatt til 13 språk.

**Tidligere § #2 «Validering av overtid basert på arbeidstid»** er konsolidert inn i T.9 — sommer/vinter-modell er nå Variant B (dynamiske perioder i `ArbeidstidsKalender`, ikke scalar-felter). 8t (sommer) / 7t (vinter) ordinær arbeidstid-validering bygges som del av T.9-implementasjon.

### #3 — Tidspunkt (fra/til) per linje i timeføringen 🟢 LUKKET 2026-05-16

**Side:** Timeføring.

Levert via T.4-bunken (prod-commit `5d36c8b9`) + T.5 tidsrunding (prod-commit `ba6ba243`).
Server-Zod + DB-schema + web-UI + mobil-cache + mobil-UI deployet til prod 2026-05-16.
Mobil-UI aktiveres på enhet ved neste EAS-bygg (server-respons + lokal SQLite-migrasjon
er klare). T.5 leverer i tillegg konfigurerbar tidsrunding (15/30/60/null) — utover
originalt kundeønske. fra<til-validering implementert via `fraErForTil`-helper på mobil
+ onBlur-runding på web.

**T.4-implementasjons-bunke (planlagt 5 sub-PR-er):**

| Sub-PR | Status | Innhold |
|---|---|---|
| **T4-a** | ✅ Merget til develop 2026-05-16 (merge `5acd2a5d`, impl `cfe51fc5`) | Schema + migrasjon. `OrganizationSetting.standardStartTid/SluttTid/PauseMin` (defaults 07:00/15:00/30) + `ArbeidstidsKalender.standardStartTid?/SluttTid?/pauseMin?` (overstyring for sommertid_start/slutt/halvdag). Additiv migrasjon, ingen breaking. |
| **T4-b** | ✅ Merget til develop 2026-05-16 (merge `9bcfb5b1`, impl `088a1e37`) | `hentEffektivArbeidstid(orgId, dato)`-helper i `apps/api/src/services/timer/arbeidstid.ts` (sommertid-overstyring → firma-default). Hard sommertid-par-validering i kalender opprett/oppdater (`sommertid_start` krever `sommertid_slutt` samme år). |
| **T4-c** | ✅ Deployet til test 2026-05-16 (merge `c02df657`, impl `39c43aa8`) | Server-Zod-utvidelse for de tre T4-a-feltene i `oppdaterSetting` + kalender `opprett`/`oppdater` (+ `validerTidsfelter`-helper). Innstillinger-side: ny `StandardArbeidstidSeksjon`. Kalender-modal: betinget visning av tidsfelter for sommertid_start/slutt/halvdag + klokke-badge i månedsliste. 15 nye i18n-nøkler → 13 språk (2277 totalt). Venter på visuell verifisering før prod-merge. |
| **T4-d** | ✅ Merget til develop + deployet til test 2026-05-16 (merge `7bee1633`, impl `2f7bf42d`) | Mobil Drizzle: `fraTid`/`tilTid` på `sheet_timer_local` + `sheet_machine_local`. Nye lokale tabeller `arbeidstidskalender_local` + `organization_setting_local`. Nye services `kalenderKatalog.ts` (med `hentEffektivArbeidstidLokal`-helper, speil av server) + `organizationSettingKatalog.ts`. TimerSyncProvider utvidet til 2-stegs Promise.all (base-pulls → firma-spesifikke pulls per org-id fra prosjekt-cachen). `timerSync` push/pull utvidet med fraTid/tilTid per timer/maskin-rad. Server: ny medlems-tilgjengelig `organisasjon.hentArbeidstidDefaults` + fraTid/tilTid lagt til i `hentEndringerSiden`-respons-mapping. Typecheck 12 = 12 baseline. Venter på enhet-verifikasjon + prod-merge. |
| **T4-e** | ✅ Merget til develop + deployet til test 2026-05-16 (merge `e992aca3`, impl `cea8f99e`) | Mobil UI. Ny `FraTilTidFelt`-fellekomponent (DateTimePicker mode=time, 2 felter side ved side). Montert i TimerRadModal + MaskinRadModal. Forhåndsutfylling: ny rad uten forrige rader → `hentEffektivArbeidstidLokal(orgId, dato)` (kalender + firma-default). Ny rad med forrige rader → forrige rads tilTid som fraTid. Rediger eksisterende → radens egne verdier. Validering: fraTid < tilTid hvis begge satt (`fraErForTil`-helper). Lagring til Drizzle med syncStatus=pending. SummeringsBanner: arbeidstidTimer faller tilbake til kalender-dagsnorm hvis sedel.startAt/endAt mangler — UI viser alltid relevant sammenligning. Rad-visning utvidet med `HH:MM–HH:MM`-tekst. 0 nye i18n-nøkler — gjenbruker `timer.felt.startTid/sluttTid` + `timer.feil.sluttForStart`. Typecheck 12 = 12 baseline. Venter på enhet-verifikasjon + prod-merge. |
| **T.5 tidsrunding** | ✅ Deployet til prod 2026-05-16 (merge `c2b2ede1` develop / `ba6ba243` prod, impl `2560f0d5`) | Server: `oppdaterSetting` Zod-input + `hentArbeidstidDefaults` select utvidet med `tidsrundingMinutter`. Validering: `z.union([15, 30, 60, null])`. Web: ny dropdown i `StandardArbeidstidSeksjon` (Ingen/15/30/60). RedigerTimerRad + RedigerMaskinRad: `step={tidsrundingMinutter * 60}` + onBlur-fallback-runding via `apps/web/src/lib/tidsrunding.ts`. AttesteringDetalj_Edit henter `tidsrundingMinutter` fra `hentSetting` og passerer som prop. Mobil-cache: `organization_setting_local.tidsrunding_minutter` (idempotent ALTER) + service skriver feltet. Mobil-UI: ny `apps/mobile/src/utils/tidsrunding.ts` (speil av web). FraTilTidFelt fikk ny `tidsrundingMinutter`-prop + runder onChange-verdi før callback. `minuteInterval` på DateTimePicker for 15/30 hint til pickeren. TimerSeksjon + MaskinSeksjon henter via `hentOrganizationSettingLokalt`. 6 nye i18n-nøkler → 13 språk (2277 → 2283 totalt). Test-QA godkjent. Prod-deploy 2026-05-16: HTTP/2 200 på sitedoc.no + api.sitedoc.no. Mobil-app-bygg via EAS gjenstår — feltet aktiveres på enhet når TestFlight/Play Store-versjonen oppdateres. |

**T.4-bunken komplett på develop + test 2026-05-16:** Alle fem sub-PR-er (a/b/c/d/e) er merget og kjører på `test.sitedoc.no` + `api-test.sitedoc.no` (HTTP/2 200, migrasjoner kjørt i `sitedoc_test`). Neste: (1) Kenneth verifiserer T4-c web-UI + T4-d/e mobil-UI på testbygg (forhåndsutfylling, validering, fra/til-visning på rad). (2) Etter verifikasjon → prod-deploy av hele bunken samtidig (server-migrasjon, web-deploy, mobil-bygg via EAS → TestFlight/Play Store).

**Auto-fordeling normaltid/overtid — besluttet å ikke implementere (2026-05-16).** Var tidligere notert som planlagt avhengighet av T.9-kalender. Kunden registrerer lønnsart manuelt per rad slik som i dag — `Lonnsart`-katalogen (firma-eid) dekker behovet med separate rader for «Ordinær 100», «Overtid 50%», «Overtid 100%» osv. Krever ingen ytterligere arkitektur eller regelmotor.

### #4 — Redigering og splitting av timer ved attestering 🟡 DELVIS LEVERT

**Side:** Attestering.

**Levert 2026-05-14** via T7-2b-bunken:
- ECO-flytt på attestering (Steg 4a, prod-commit `f98fa7a5` 2026-05-03) — leder kan endre kostnadsbærer per rad.
- Per-rad-attestering med felleskomponent AttesteringDetalj (T7-2b1, prod-commit `3234c057`).
- **Edit-modus: firma-admin kan redigere timeantall + ECO + fra/til på alle pending-rader** via `redigerSedelRader`-mutation (T7-2b2, prod-commit `755c542a`). Gated på `OrganizationSetting.tillattRedigerVedAttestering`-toggle (T7-2b3, prod-commit `af4a7deb`) — default false, firma-admin skrur på via `/dashbord/firma/innstillinger`.
- T.5 tidsrunding (prod-commit `ba6ba243` 2026-05-16) avrunder fra/til-input i edit-modus til konfigurert intervall (15/30/60 min).

**Gjenstår:** Rad-splitting (én rad → flere med ulike prosjekt/ECO/lønnsart/fra-til) krever `splittRad`-mutation. Audit-log med før/etter-snapshots per rad (T7-2b2 logger antall + actor; per-rad-snapshots utsatt til egen oppfølger).

### #5 — Registrering av HMS-gruppe på brukere ⏸️ PARKERT

**Side:** Oppsett – Brukere.

**Opprinnelig ønske:** Felt for HMS-gruppe på bruker/kontakt-kortet, knyttet til eksisterende gruppe-struktur, filtrerbart i brukerlisten.

**Status (oppdatert 2026-05-11 etter Sonnet-sesjon):** Parkert til prosjektoppsettet er mer modent og avhengighetene er synlige. Tidligere klassifisert som «lav kompleksitet» — feilvurdert.

**Begrunnelse:**
- To separate konsepter eksisterer i dag: `ProjectGroup` (RBAC/tilgang) og `Faggruppe` (dokumentflyt-deltaker). HMS-gruppe må plasseres i en av disse eller bli et tredje konsept — ikke avgjort.
- Standard HMS-gruppen (`hms-ledere`, `category="field"`) har ingen UI for administrasjon i dag — kan ikke redigeres via noen side.
- Brukergruppe-arkitekturen er uavklart: Kenneth vurderer firma-basert gruppering (ansatte/ledere per firma) som fremtidig modell, men ikke låst.

**Beslutning:** Ikke estimer eller planlegg denne nå. Tas opp igjen når prosjektoppsett-design og brukergruppe-arkitektur er låst.

---

### #6 — Maskinmodul ikke synlig i prosjekt 998 Instinniforbotn ✅ Lukket 2026-05-12

**Side:** Maskin (prosjekt 998 Instinniforbotn).

✅ **Lukket 2026-05-12 — ikke en bug.** `ProjectModule maskin/aktiv` finnes på prod for prosjekt 998 (`5e8dd794-ab81-47b7-a146-d7384fac3a8a`), og `OrganizationModule maskin/aktiv` finnes for A.Markussen (`4488fe17-...`). Auto-sync fra Steg 1c (`87fb7292`) har gjort jobben sin.

A.Markussen-ansatte (Malin, Silje, Florian — alle `company_admin` med `organization_id = 4488fe17-...` og `can_login=true`) ser Maskin-lenken korrekt i bunnen av HovedSidebar. Kenneth ser den ikke fordi hans bruker har `organization_id = NULL` (superadmin uten firma-tilknytning) — `organisasjon.hentMin` returnerer da `null` og `aktiveFirmamoduler = []`, slik at maskin-bunnelementet filtreres bort i `HovedSidebar.tsx:331`.

**Løsning:** Bytt til brukervisning (impersonering eller logg inn som A.Markussen-ansatt) for å se det kunden ser. Diagnose-verifikasjon utført 2026-05-12 mot prod-DB.

### #7 — Rettighetsmatrise med rolle-styring (Prosjektleder + Bas) 🔴

**Side:** Oppsett – Brukere/Roller.

Ingen treff på `Prosjektleder`/`Bas` som DB-roller. Eksisterende roller: `User.role = sitedoc_admin | company_admin | user` og `ProjectMember.role = admin | member`. Krever ny rolle-modell + matrise-UI som viser tilganger per rolle.

### #8 — Fagområde og oppgaver i sjekklistemaler-listevisning 🟢 LUKKET 2026-05-12

**Side:** Innstillinger – Produksjon – Sjekklistemaler.

Levert via commit `3eb7398f` (impl) + merge `542461e2` (prod) 2026-05-12. Fagområde-kolonne (Bygg/HMS/Kvalitet via `mal.domain`) + Antall punkter-kolonne (`mal._count.objects`) lagt til i `apps/web/src/app/dashbord/oppsett/produksjon/_components/MalListe.tsx`. 4 nye i18n-nøkler i 15 språk. Tabellen har nå 5 kolonner: Navn, Fagområde, Antall punkter, Prefiks, Versjon.

### #9 — Justeringer på SJA (signatur/lesetilgang/deltaker) 🔴

**Side:** Innstillinger – Produksjon – Sjekklistemaler – SJA.

Ingen treff på `SJA`/`sja` i kode — SJA er sannsynligvis en konkret sjekklistemal-instans, ikke egen funksjonalitet. Krever utvidet sjekkliste-mekanikk: re-signaturforespørsel, auto-lesetilgang for alle prosjektmedlemmer, selv-påmelding som deltaker.

### #10 — «Flere personer»-feltet på SJA — definere hvem som er valgbare 🔴

**Side:** Innstillinger – Produksjon – Sjekklistemaler – SJA.

Avklare om feltet henter alle firma-ansatte. Krever felt-konfigurasjon for å begrense/definere valgbare personer per SJA-mal.

### #11 — Pushvarsel/SMS til ansattliste 🔴

**Side:** Generelt.

Ingen treff på `pushvarsel`/`sms` i kode. Krever ny varslingstjeneste (SMS-leverandør integrasjon), målgruppe-velger (alle ansatte eller utvalgte grupper), kostnadsavklaring med SiteDoc/leverandør.

### #12 — Oppretting av ny sjekkliste fungerer ikke 🟢 SANNSYNLIGVIS FIKSET

**Side:** Sjekklister (prosjekt 998 Instinniforbotn).

**Status:** Commit `4e29c88a` («fix: sjekkliste opprett-modal stille død») deployet til prod 2026-05-09. Lukket bug der klikk på mal i opprett-modal gjorde ingenting når innlogget bruker ikke var medlem av noen faggruppe (typisk sitedoc_admin/company_admin uten faggruppe-tilknytning) — `handleOpprettFraMal` returnerte stille. Nå: fallback-kjede henter `bestillerFaggruppeId` fra dokumentflytens `oppretter`-medlem, synlig feilmelding i Modal hvis ingen kandidat finnes. Re-test ønskelig fra kunde for å bekrefte at både «Opprett ny sjekkliste» og «+ Ny sjekkliste» nå fungerer i prosjekt 998.

## Kjente bugs

**~~Lokasjon-modal forhåndsvelger ikke når kun ett alternativ finnes (observert 2026-05-02)~~ — LØST.** Verifisert 2026-05-05 at auto-select er implementert i `apps/web/src/components/LokasjonVelger.tsx:66-81` (to useEffect-hooks: én for bygning, én for tegning, begge sjekker `length === 1` og setter valgt verdi). Sannsynligvis lagt til etter den opprinnelige observasjonen. TegningsModal (skjermbilder, ikke samme flyt) auto-velger kun ved `standardTegningId` — bevisst design.


## Pauset, planlagt og fremtidige faser

→ Se [docs/claude/BACKLOG.md](BACKLOG.md) for konsolidert backlog
(teknisk gjeld, halvferdige features, Fase 0.5-7, kundeønsker ikke startet).
