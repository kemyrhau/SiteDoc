---
name: STATUS-AKTUELT
description: Løpende statusrapport for pågående arbeid, pauset arbeid og planlagte faser. Oppdateres ved hver vesentlig fremdrift.
sist_verifisert_mot_kode: 2026-07-07
---

## Pågående arbeid (PR-historikk)

> 🎨 **REDESIGN (branch `redesign/navigasjon`, bak `nyNavigasjon`-flagg — av-default, inert i prod):** Steg **ii–vi** (ii hub + funn-1b-fix, iii sidebar + kontekst-chip, s1/v4/v5 polish, vi 2a mobil-tabs + K6/P31 Kontakter) + **K9 URL-kanonisering** er **DEPLOYET til prod 2026-07-07 (`0be103fa`, flagg-inert)** → arkivert til [historikk-2026-07.md § Redesign steg ii–vi](historikk-2026-07.md). K9-redirects live flagg-av; K6/P31 Kontakter = flagg-**PÅ**-nav (ikke synlig flagg-av). Alle steg fabel-designgodkjent. Flagg-test på test via `?nyNav=1`. **Dev-login (agent-testing):** `/dev-login` m/ whitelist + `DEV_LOGIN_SECRET`, gated til test (404 i prod) — se [dev-login-agent.md](dev-login-agent.md). **Steg vii (2c dokumentleser med språkpiller) ✅ LUKKET** (fabel-designgodkjent 2026-07-07, 8/8 fangster mot `06-design.png`, merget develop `8c774368`; sticky språkpille-rad + grønt banner + `+ Oversett` (ny `mappe.oversettDokument`, isActive-guard) + bunn-ark-sammenlign; backend `hentDokumentBlokker` utvidet; token-fiks sitedoc-blue; fangster `docs/redesign/screenshots/2c-simulator-2026-07-07/`). **Restanse-runde ✅ KOMPLETT LUKKET (2026-07-07):** P-a statusprikk ✅ + punkt 4 kildeflagg (variant A «🇳🇴 NB · kilde») ✅ (simulator) + FM5/K2 «Mine timer»→brukermeny+søk («Min side») ✅ + T9 mobil-web-hamburger ✅ (Opus web-verifisert; A1-avvik «Mine timer» i PROSJEKT-sonen fikset via delt `prosjektSoneElementer` `a6f8ab3f`). Merget develop `24083342`→`fa87b2f2`. Ny kommando `/test-redesign-nav` (web-verifisering for Opus web). **🎯 Alt av redesign-nav (steg ii–vii + restanse) er nå bygget + designgodkjent.** Gjenstår i handoff: steg viii (sammenligningsrunde mot prod-kopi m/ kunde) + pilot-plan (flagg → company_admin). Full paritet + T/G: [redesign-paritetssjekkliste.md](redesign-paritetssjekkliste.md). Oppfølgere i BACKLOG (§ Redesign-mobil + § Redesign steg vii/2c): s3 utlogging-redirect, stale toggle, enhets-lagret flagg (pilot-beslutning), agentprosjekt-innholdsseed, degradert Tegninger, sitedoc-primary web-tokens i mobil, kildespråk≠prosjektspråk-gap, toast stille feil, mappe-cache «Ikke funnet». **MS-login mobil lokal dev:** placeholder client-ID + AADSTS50011 test-callback (BACKLOG). **🆕 Plan 2 (bruker-lagret `nyNavigasjon`-flagg) + steg viii-infra MERGET til develop 2026-07-07 (`0d3f21ac`, --no-ff).** `User.nyNavigasjon Boolean?` (additiv migrering `20260707120000_user_ny_navigasjon`) er autoritativ konto-kilde; presedens **aktiv `?nyNav`-URL (flyktig) > konto > persistert lokal > env-default > av** i delt `resolverNyNavigasjon` (@sitedoc/shared, 13/13 test). tRPC `bruker.settNyNavigasjon` + `organisasjon.settNyNavForFirma`/`settNyNavForBruker`; web+mobil hooks (lokal cache per userId → delt-enhet-sikker); admin-knapp `firma/ansatte`. Steg viii-infra: `docker-compose.redesign.yml` + `NEXT_PUBLIC_NY_NAV_DEFAULT` build-arg + [steg-viii-kunderunde.md](../redesign/steg-viii-kunderunde.md). **BACKLOG «stale toggle» + «enhets-lagret flagg» → LØST.** Gjenstår: runtime-bevis på test (web a–d + simulator brukerbytte/offline) → fabel-sluttgodkjenning lukker Plan 2. Migrering venter `migrate deploy` på `sitedoc_test`.

> ✅ **DEPLOYET TIL PROD 2026-06-21 (prod-merge `32b88bd7`)** — arkivert til [historikk-2026-06.md § Slice 1–4 + reisetid R1–R4 + byggeplass-GPS L1](historikk-2026-06.md). Server (API+web): auto-utkast (Slice 3), midnatt-splitt (4a), glemt-dag-prompt (4b-1), `sluttTidKilde` + arbeidstids-varsel (4b-2), reisetid-matrise R1–R4, byggeplass-GPS L1, UX-1 + Slice 1/2-refinements + T.12. **4 migrasjoner anvendt på prod + verifisert** (`reisetid_matrise`, `organization_setting_arbeidstid_varsel`, `sheet_timer_beskrivelse`, `daily_sheet_slutt_tid_kilde`). NorBERT bind-fix-kode merget (embed/oversettelse-rebuild = egen oppgave, IKKE kjørt).

> ✅ **DEPLOYET TIL PROD 2026-06-23 (prod-merge `13dc110e`)** — arkivert til [historikk-2026-06.md § Timer-bunke (UF-0…UF-4, fiks A, …)](historikk-2026-06.md). **Server live (API+web):** Funn #2 kvittering-vedlegg (+ migrering `sheet_tillegg_vedlegg` anvendt), T.11 maskinbevis, UF-4 recall (`gjenaapneDagsseddel` → 405), tre-veis-farge web, T.12 web-parity. **Mobil-UX** (UF-0…UF-4, fiks A sync-gift-isolasjon, tidshjul-modal + keyboard-«Ferdig» + grønn-boks-wording, U1–U3, build-footer, lønnsart-hint) **distribueres via TestFlight prod-bygg #30** (`404e1707`, submission `8b3f8ec1` **Submitted/Success 2026-06-23 20:17** etter Apple-avtale-signering + resubmit — bygg #30 i App Store Connect, venter på Apple TestFlight-prosessering) — **A.Markussen-validering starter når bygget er tilgjengelig i TestFlight.** Verifisert: migrering+tabell (`to_regclass`), `gjenaapneDagsseddel` 405, innlogget prod-dashboard data-intakt (ikke anonym).
>
> Eldre arkiv: [historikk-2026-06.md](historikk-2026-06.md) (SPOR 3 prod 06-10, OAuth, auto-select lønnsart, hentMineMedlemskap) · [historikk-2026-05.md](historikk-2026-05.md) (mai-deploys).

> ✅ **DEPLOYET TIL PROD 2026-07-04 (prod-merge `bb5aec05`)** — arkivert til [historikk-2026-07.md § Prod-deploy 2026-07-04](historikk-2026-07.md). Bunt api+web: **split-identitet** MS-login (Fix A case-insensitiv `getUserByEmail` + gate-innstramming web+mobil, `42d41aa8`), **erKunde-fiks** «Opprett firma» (`6de25024`), **geofence-oppdagbarhet** (`b1c81629`). Ingen migrering (ren kode). Backup + lockout-query=0 før deploy. Sak #3 (KMY-duplikat B→A) utført. Åpent i BACKLOG: sak #4 (e-post-normalisering) + sak #5 (firma-velger).

> ✅ **DEPLOYET TIL PROD 2026-07-04 (kveld, prod-merge `0801af38`)** — arkivert til [historikk-2026-07.md § Prod-deploy 2026-07-04 (kveld) PR 1-4](historikk-2026-07.md). Bunt api+web (PR 1-4): **org-isolasjon** `SheetMachine.vehicleId` §2.D (`90469dc7`), **Leaflet** geofence-kart invalidateSize (`6178034f`), **sak #5** firma-ansatt-innsyn dobbel-kilde (`6dbc884a`), **maskin opprett/import-gating** (`179b86f9`). Ingen migrering (ren kode). Backup før deploy; lockout-query ikke nødvendig (rører ikke signIn-gaten). Markør-sjekk 9/2/5/3 + innlogget prod-verifisering (Leaflet fullt kart, ansatt ser firma uten admin-meny/maskin-innganger, admin uendret, maskin-føring OK). Lukker sak #5. Nye BACKLOG-poster: maskin-velger søk/filter + maskin≤arbeidstimer proaktiv.

> ✅ **DEPLOYET TIL PROD 2026-07-07 (prod-merge `0be103fa`)** — arkivert til [historikk-2026-07.md § Prod-deploy 2026-07-07](historikk-2026-07.md). **Migrasjonsfri** merge develop→main. **a2** (dagsseddel dobbel-timeføring, `f53de3e9`) live. **PSI Fase A + Maskin-dagsseddel + ③ lønnsart** — web-flatene nå live (koden merget i `80974276` 2026-07-05 m/ 3 migrasjoner; web-image-rebuild gjorde dem faktisk live nå); **mobil-delene venter fortsatt EAS**. **Redesign steg ii–vi + K6/P31** i prod bak `nyNavigasjon`-flagg (av-default, **inert — ikke live pilot**); **K9 URL-kanonisering + redirects live**. Verifisert innlogget prod: data laster, redesign av-default, `/dev-login` 404. + sok.placeholder-fiks (`7d8ddf27`).

> **🧵 Åpne tråder for neste økt (kontinuitet, oppdatert 2026-07-07):**
> 1. **PSI Fase A + Maskin + ③:** web + DB-migreringer nå i prod (via `80974276`/`0be103fa`). **Gjenstår kun mobil-delene** (`MannskapInnsjekkKort` inn/ut + dagsseddel-registrering + maskin/③-mobil) via neste **EAS-batch**. **Dagsseddel-prod krever `aktiverNivaa1` på prod-firmaet** (lønnsart-katalog seedet) ellers mangler lønnsarter — jf. onboarding-wizard-BACKLOG-saken.
> 2. **Redesign develop→main:** ✅ utført — steg ii–vi merget til prod bak `nyNavigasjon`-flagg (av-default, inert), funn 1b fikset i steg ii. **Aktiv nå:** steg vii (2c-leser) på develop (`8c774368`), venter fabel-designgodkjenning + web-verifisering.
> 3. **Skjermbilder:** steg ii–vi fabel-designgodkjent (07-06/07). Gjenstår kun steg vii-godkjenning.

### Mobil Microsoft-auth (code+PKCE) — BYGGET I EAS-SKY #37 2026-07-01 (venter Azure + Florian-test)

Mobil-MS var aldri funksjonell (`EXPO_PUBLIC_MICROSOFT_CLIENT_ID="disabled"` på alle EAS-profiler + implicit-flow). Nå: ekte dedikert Entra public-client-id på alle fire eas.json-profiler, flyt byttet til **authorization code + PKCE** med app-side `exchangeCodeAsync` (`services/auth.ts`), redirect `sitedoc://auth`, knapp-gating på `erMicrosoftKonfigurert` (`config/auth.ts`+`logg-inn.tsx`). Backend `mobilAuth.byttToken` + orphan-guard **urørt** — sikkerhetsgaten bevart. Typecheck rent (12 baseline-feil uendret, ingen i auth-filene). **Bygget i EAS-sky-bunt #37** (bygg-ID `496b6a63`, commit `bc744f82`, 2026-07-01, status `finished`) → TestFlight. **Gjenstår (Kenneths hånd):** Azure-sjekkliste (redirect `sitedoc://auth`, public client flows, Graph-scopes) + Florians test i TestFlight-bygget. Full design + Azure-steg: [BACKLOG § Mobil Microsoft-auth](BACKLOG.md).

### Mobil EAS-bunt — #37 BYGGET PÅ SKY 2026-07-01 (mobil-MS + F-G) → TestFlight

**#31** (`cc119d42`) var forrige bunt (bygget + submittet 2026-06-24, ASC bygg (31) «Testing»): byggeplass-UX F1–F6 + F-A + F-B + B2+B6 — **manglet F-G**.

**#37** (bygg-ID `496b6a63`, commit `bc744f82`, bygget på **sky** 2026-07-01 da juli-kvoten resatt, status `finished` m/ .ipa) er den gjeldende bunten → **TestFlight**. Legger til **F-G** (glemt-dag 0-fiks, `c6babc44`) **+ mobil Microsoft-auth** (code+PKCE, `f8594d1c`). Erstatter den tidligere «#32 kvote-blokkert»-planen (juni-kvoten var oppbrukt; lokalt bygg viste seg blindvei — se [eas-build-veileder.md](eas-build-veileder.md)). **Device-verify (a/b) + F-G/MS-distribusjon skjer via #37.** Samlet innhold i bunten:

- **Mobil global byggeplass-UX (F1–F6)** — `ByggeplassKontekst` eneste kilde, header-chip (hjem/sjekklister), GPS auto-set + override, timer-default fra global, favoritter. Detaljer: [BACKLOG.md § Mobil global byggeplass-UX](BACKLOG.md). Commits `a46d58e9`/`b2ee5fb4`/`0eb2c9ef`/`d7419e6b`/`7c3ae7e3`.
- **F-A glemt-dag-transparens** (device-test-funn 2026-06-24) — `sluttTidKilde="system"`-utkast viser konkret banner: «Estimert slutt: HH:MM (gjettet) · X.X t på N rader — sjekk og rett» (`timer/[id].tsx`). Ikke-blokkerende.
- **F-B auto-rundings-fiks** (device-test-funn 2026-06-24, bug) — auto-genererte timer-rader rundes nå til firmaets tidsrunding-grid (15 min = 0.25 t) på **arbeidstimer** før normaltid/overtid-splitt (`StartSluttDagKort.genererForslag` + ny `rundTimerTilNarmeste`). Reise urørt; `null` → behold 2-desimal. Rettet rå-varighet (6.10/8.24 t).
- **F-G glemt-dag 0-fiks** (device-test-funn 2026-06-24, bug — `c6babc44`) — (c) `fordelArbeidstidFradrag`: pause→lengste, reise→start m/ overflyt, kappet til kapasitet → kort start-segment klampes aldri til 0; dag-total invariant. (d) rød «Mangler standard-lønnsart»-banner ([id].tsx) i stedet for stille 0. `splittVedMidnatt`/UF-2/F-A/F-B urørt. Rot-fiks (org-config) i [BACKLOG § Org uten standard-lønnsart](BACKLOG.md).

Ingen schema/server. Device-test (via TestFlight #37, begge må stå før submit): (a) org uten lønnsart → banner (ikke stille 0) · (b) org m/ lønnsart + start 21:33 → ~2.45t-rad på dag-1, pause på lengste segment · + chip/GPS/favoritt + glemt-dag-transparens + 15-min-runding. **Handling før GPS-test:** prod-prosjektet mangler byggeplasser — opprett + sett geofence på sitedoc.no → Byggeplasser (What-to-Test pkt 1+3).

> Web-sporet (geofence-editor A+B + rename C) **DEPLOYET TIL PROD 2026-06-24** (`a558db2e`) → arkivert til [historikk-2026-06.md § Geofence-editor + rename](historikk-2026-06.md).

### B2+B6 sedel-nivå byggeplass — IMPLEMENTERT PÅ DEVELOP 2026-06-23 (mobil)

Sedel-nivå byggeplass på timer-dagsseddel (kode-review-vedtak 2026-06-23, [timer-gps-prosjekt-utredning.md § 2026-06-23](timer-gps-prosjekt-utredning.md)). Tre deler:

- **Del 1** — `arbeidsdag.byggeplassId` kopieres inn i auto-utkastet: `FinnEllerOpprettArgs.byggeplassId` + insert (`dagsseddelOpprett.ts`); threades via `genererForslag`/`opprettDagsseddelForSegment` (`StartSluttDagKort.tsx`); `ny.tsx` sender eksplisitt `null`. Kun NYE drafts — UF-1-append + eksisterende sedler urørt (idempotens).
- **Del 2** — `ByggeplassVelgerModal` (ny, speiler `ProsjektVelger`), filtrert på `sedel.projectId`; skriver `byggeplassId` + `syncStatus="pending"`. Blå sedel-topp-oversikt (aktivt prosjekt + byggeplass, pil-til-høyre) på `[id].tsx`. Fjernet redundant byggeplass-visning i primærprosjektets gruppe-header.
- **Del 3** — myk, ikke-blokkerende mismatch-advisory når GPS-byggeplassen tilhører et annet prosjekt enn det valgte (G1: arbeider-valg autoritativt).

i18n: 3 nye nøkler × 15 språk. **Server/schema uendret** — sedel-nivå-sync var allerede klar (server propagerer `byggeplassId` til rader). Typecheck: null nye feil (gjenstående = pre-eksisterende baseline, BACKLOG «Mobil ~12 feil»).

**Distribusjon:** i **EAS prod-bygg #31** (`cc119d42`, 2026-06-24) → A.Markussen via TestFlight når `eas submit` er kjørt. **Reload:** Expo JS/TS (Fast Refresh).

**Parkert (Beslutning 6-oppfølger):** per-rad byggeplass / «splitt dagen mellom byggeplasser» (krever server `syncBatch` rad-input + mobil rad-tabeller).

### Gjenstående (åpent, ikke sporet annet sted)

- **EAS Android-bygg + Play Store** — Android-distribusjon står igjen (iOS går via TestFlight/EAS). Ikke sporet i BACKLOG/oppryddings-plan → beholdes her.

_Øvrige tidligere «Gjenstående PRs»-punkter er sporet i sannhetskildene og kollapset hit (2026-07-06):_ T7-5h ([BACKLOG](BACKLOG.md), deployet 2026-05-28) · P-KRITISK-1/-2/-3 ([oppryddings-plan-2026-04-28.md § P-KRITISK](oppryddings-plan-2026-04-28.md); -2/-3 deployet, -1 🔴 åpen) · HMS-prosjektvisning teknisk gjeld ([BACKLOG § HMS-prosjektvisning teknisk gjeld](BACKLOG.md)).

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
