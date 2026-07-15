---
name: historikk-2026-07
description: Arkiv av deployete PR-er/saker fra juli 2026. Flyttet hit fra STATUS-AKTUELT ved DEPLOYET TIL PROD.
sist_verifisert_mot_kode: 2026-07-04
---

# Historikk juli 2026

Arkiv av arbeid deployet til prod i juli 2026. Flyttet hit fra [STATUS-AKTUELT.md](STATUS-AKTUELT.md) per arkiveringsplikten (deployet arbeid ligger aldri igjen i STATUS-AKTUELT).

## Prod-deploy 2026-07-15 (prod-merge `43299d03` + EAS #40) — timer F2/F3/F5 (byggeplass per rad + matpause-bærer) + finnbarhets-revisjon

Develop→main-merge `43299d03` (25 commits foran prod). **Server (api+web) LIVE; `db-timer`-migrering `20260714120000_sheet_timer_pause_min` applied på prod-DB `sitedoc` (prod-gate `/sitedoc` bekreftet, ingen ABORT); alle 9 containere Up etter deploy.** Mobil-delene når enheter via **EAS #40** (build `15a47804`, commit `43299d03` = main-innhold, TestFlight 15.07). Backup før deploy: `sitedoc-preF5-20260715-0016.dump`. Sekvensielt bygg (api → web separat) — unngikk OOM-kaskaden fra 11.07.

**Timer-mobil F2/F3/F5 (feltfunn del-6)** — fabel design-OK, fasit [timer-mobil-f2f3f5-spec.md](timer-mobil-f2f3f5-spec.md):
- **F2** — `ByggeplassVelger` tri-tilstand (henter/offline/bekreftet-tomt) + auto-refresh ved tom cache+online + `projectId`-reset-catch. Rotårsak til «Markussen har ingen byggeplasser» var sync-timing (`byggeplass_local` ikke populert), ikke manglende data.
- **F3** — per-rad `byggeplassId`: `sheetTimerLocal`-kolonne + idempotent ALTER + sync begge veier + syncBatch input/createMany (`t.byggeplassId ?? lokal.byggeplassId ?? null`, sedel-fallback) + `hentEndringerSiden`. UI: kombinert prosjekt+byggeplass-`pageSheet` + rad-sekundærlinje «Prosjekt · Byggeplass» + hybrid-hurtigsti. Server-verifisert p6 (rad_bp ≠ sedel_bp).
- **F5** — matpause-bærer per timer-rad. `pauseMin` INT NOT NULL DEFAULT 0 lokal + server `sheet_timer.pause_min`. Bærer = lunsj-kryssende carve-rad (Valg A); flytt-ikke-radio (`services/matpause.ts`) med toast + ekte bekreftelsesmodal ved fjern. **Kryss-modul-invariant:** `dagsseddel.pauseMin = Σ(rad.pauseMin)` ved hver endring → maskin-kapasitetsregelen (sedel-nivå pauseMin) urørt, `sheet_machines` INGEN pauseMin. **Edge #1:** dynamisk minutt-etikett (`pauseOverlappMin`) i stedet for hardkodet 30; uhaket rad = «Matpause trukket» uten parentes. Server-verifisert (pause_min=30, Σ=30).
- i18n `timer.matpause.*` generert til 13 språk (`8cada21c`).

**Finnbarhets-revisjon + byggeplasser-discoverability (redesign — flagg-gated unntatt labels).** Søkemotor `sok-match.ts` (skrivefeil-tolerant bounded Damerau-Levenshtein + `KJERNE_SYNONYMER`-lag), begrepsfikser, byggeplasser hub-kort. **Én bevisst ikke-flagget endring:** `nav.sok` «Søk»→«Dokumentsøk» + `nav.kontrollplan`→«Kontrollplan» rendres i gammel `HovedSidebar` (`sidebar-elementer.tsx:131,145`) → live for ALLE prod-brukere. Bevisst (unngår label-mismatch på tvers av flagg-tilstand, jf. Lokasjoner/Byggeplasser). `firmaNav.innstillinger`→«Firmaprofil» er INERT i prod (gammel firma-nav hardkoder labelen).

**#40-lærdom:** første `eas submit` feilet på «build number 40 already used» — EAS autoIncrement teller mot EAS' egne byggrecords, ikke App Store Connect. Bygget var intakt; ingen byggkvote brent på oppfølgingen.

## Prod-deploy 2026-07-13 (prod-merge `f888fecc` + EAS #38) — timer-stabilisering: fiks B + S-A tombstone + del-6-fiksrunde + footer

Develop→main-merge `f888fecc` (43 commits foran prod, main-tre == develop-tre). **Server (api+web) LIVE + innlogget-verifisert (test+prod på nett); 2 `db-timer`-migreringer kjørt på prod-DB `sitedoc` (prod-gate bekreftet); alle 9 containere Up.** Mobil-delene når enheter via **EAS #38** (`47c22b1a`, commit `cd3efcb5` = main-innhold, submitted TestFlight 13.07). #37-bakoverkompat bevart (server-endringer forbedrer/er inerte for #37). Backup før deploy: `sitedoc-preprod-20260713-1951.dump`. Full design + verifisering: BACKLOG (§ fiks B, § S-A, § F-e-carve) + `docs/claude/skjermbilder-del6-live/`.

- **Fiks B — `hentEndringerSiden` «erstattet»-lekkasje** (`5c9d2070` + self-heal `87af7e5b`): manglet `attestertStatus ≠ "erstattet"`-filteret alle andre lesere har → mobil trakk ×N write-only audit-rader (DB-bevist 9/6 vs sann 3/2). Fiks: ny `sheet_rad_historikk`-tabell + rediger-mutasjonene FLYTTER erstattet-rad dit (MOVE, aldri slett) + `hentEndringerSiden`-filter + self-heal-migrering (bump `updated_at` så eksisterende stale enheter re-puller). **2 migreringer** (MOVE + bump, begge kjørt på prod). **M-1+M-2 PASS** (fresh pull 3/2 + stale-enhet delta-sync self-heal uten reinstall).
- **S-A — mobil rad-sletting propagerer ikke (S3)** (`6bed19c3`): den opprinnelige del-6-eskaleringen. Diagnostisert via DB-grunnsannhet + M-3 (rad kom tilbake fordi S3 payload-id-begrenset `deleteMany` ikke propagerte). Fiks: lokal `slettede_rader_local`-tombstone + `slettedeIder` i syncBatch → server `deleteMany` (bak eierskaps+status-vakt) + pull-race-guard + rydding ved server-bekreftet sync (3 fabel-gatede krav). **M-3-reprise PASS** (rad borte lokalt OG server-propagert, server-SQL-bekreftet). #37-bakoverkompat (`slettedeIder` optional).
- **Del-6-fiksrunde F-b/F-e/F-f/F-g** (`108b86ae` + F-e-carve re-fiks `cbf7e465`): F-b faktiske økt-tider + `sluttTidKilde="bruker"`-skjerming; F-e pause KUN over 5,5t-terskel (AML §10-9, dagstotal, gate i `fordelArbeidstidFradrag` — **første impl hadde AVVIK: rad-verdi ugatet, gate-glipp fanget av simulator + re-fikset**); F-f `redigerSedelRader` fra/til-vakt (delt `finnTidsromKonflikt`, ikke `validerSplittFelles` som er sum-invariant); F-g differensiert «for kort»-melding. **Live-fangst alle PASS** (simulator + web). **Åpen oppfølger:** F-e-interaktiv (dag-recompute i edit-flatene — design-gate hos fabel FØR koding). **Kjent pilot-begrensning:** manuell rad-redigering på <5,5t-dag trekker fortsatt pause (interaktiv-sti, pre-eksisterende).
- **Footer** (`2bbf9169`): `v{semver} (build N) · {git-hash} · {byggdato}` via `expo-application` + `EAS_BUILD_GIT_COMMIT_HASH` — entydig bygg-identifikasjon (var «dev» uten hash før).
- **Redesign** (steg vii + K13 + restanse m.m.): på prod men **flagg-inert** (`nyNavigasjon` av-default) — når ingen brukere før flagg-påslag.

**Gate-lærdommer denne runden (memory):** [[gate-utfallssti-ikke-mekanisme]] (F-e-carve — gate utfallet, ikke bare mekanisme-plassering), [[observator-tolkning-ikke-mekanisme]] (M-3 — observatørs tolkning kan lene feil), [[db-grunnsannhet-for-mekanisme]] (S-A — DB-breakdown før mekanisme-påstand).

## Prod-deploy 2026-07-11 (prod-merge `d1b96cd5`) — F4-serien (identitetsforsoning + attestering-deadlock + synk-robusthet)

Develop→main-merge `d1b96cd5`. F4-serien lukker Fase C-funnene rundt web↔mobil timer-synk + leder-attestering. **Server/web-delene er LIVE i prod.** De **mobil-only** radene (F4-1c, F4-3) ligger i main via `d1b96cd5`, men når enheter først via **EAS #38**. Bakoverkompat mot #37 bevart i alle (server-wins-fallback / gjenbrukte i18n / ingen migrering). Sannhetskilde: [timer.md § Synk-identitet](timer.md).

- **F4-1 (identitetsforsoning) — server+mobil:** rotårsak til «mobil-registreringer vises ikke på web» = identitetskollisjon `@@unique([userId, dato])` vs `clientUuid` (server-`id` ≠ `clientUuid` → dato-kollisjon ga `avvist` terminal + pull-duplikat + «pull-så-redigert»-P2002). Fiks (`apps/api/src/routes/timer/dagsseddel.ts` + `apps/mobile/src/services/timerSync.ts`): **invariant `id = clientUuid` ved create**; **S2** P2002→`conflict` m/ server-`clientUuid` (ikke `avvist`); **S3** `deleteMany` kun payload-rad-id-er → bevarer web-førte rader (akseptert: mobil rad-sletting propagerer ikke); **M1** kollisjon-conflict = merge/re-nøkle + additiv push (ingen datatap); **M2** pull-guard mot duplikat via `(userId, dato)`-forsoning. Bakoverkompat #37: `serverData.clientUuid` valgfritt → gammel klient faller til server-wins. Mobil-delen når via EAS #38.
- **F4-1b (arbeider-mutasjoner NOT_FOUND på pre-invariant sedler) — server:** mobil sender lokal id (= `clientUuid`), men `hentEgenDagsseddel` (`dagsseddel.ts:120`) slo opp `findUnique({ id })` på server-PK → «Dagsseddelen finnes ikke» på pre-invariant-sedler (`id ≠ clientUuid`). Fiks: slår opp `id` FØRST, faller tilbake til `clientUuid` (begge `@unique`, ingen migrering). Latent oppfølger i BACKLOG: `oppdater`/`tilfoy*` skriver på rå input-id (web-only i dag).
- **F4-1c (visnings-dedupe av duplikat sedel-hode) — mobil-only, når via #38:** cruft-enhet viste to sedel-hoder for samme dato (tom «Arbeidstimer (0.00t)»-plassholder + populert). Pre-F4-1-relikvi (gammel pull matchet kun på server-`id`). F4-1 (M2) stopper nye; visnings-dedupe i `DagsseddelListe.tsx` (`dedupPerDato` + `lesDagssedlerLokalt`) kollapser hoder med samme dato, skjuler kun **tom** plassholder, ekte divergens (≥2 med innhold) vises med `AlertTriangle`-markering (aldri stille datatap). Rent display — ingen DB-skriving, ingen pull-endring.
- **F4-1d (web-førte rader usynlige for mobil — touch-parent) — server:** rad-mutasjoner skrev barn-rad uten å røre forelderen → Prisma bumper `DailySheet.updatedAt` KUN når sedel-raden selv skrives, så `hentEndringerSiden` (delta-vindu `updatedAt > sistSynk`) ekskluderte sedelen etter at hodet var synket → web-førte rader nådde aldri mobil (hode vist, 0 rader). Fiks: delt `touchSedel(prismaTimer, sheetId)`-hjelper som bumper `updatedAt` i **samme `$transaction`** som rad-writet. Full kandidatmengde enumerert — touch på 14 stier (`tilfoy/oppdater/fjern` × `timer/tillegg/maskin`, `tilfoy/fjernTilleggVedlegg`, `flyttTimerRadEco`, `splittRad`); `redigerSedelRader` gjort ubetinget sedel-touch. Allerede dekket: `opprett/oppdater/send/gjenaapne*/returnerRader/attester/returner` + `syncBatch` (upsert — ikke dobbelt-touched). Ekskludert: `attesterRader` (per-rad `attestertStatus` synk-es ikke til mobil). Ingen migrering (eksisterende `@updatedAt`).
- **F4-2 (accepted-deadlock) — server+web:** leder hadde ingen web-vei til å angre en fullført attestering (`attesterRader` flipper sedel→`accepted` når alle rader attestert → attesterings-/retur-knapper gated på `status==="sent"` forsvinner). Fiks (retning B, gjenåpne til `sent`): ny leder-mutasjon **`gjenaapneAttestering`** (input `{sheetId}`, precondition `accepted`→`PRECONDITION_FAILED`, leder-auth + `krevProsjektLeder`, tx: rader→`pending` + sedel→`sent`, nullstiller attestert-felter) + web «Gjenåpne attestering»-knapp i `accepted`-grenen (`AttesteringDetalj.tsx`) m/ ekte `<Modal>`. i18n `timer.attestering.gjenaapne.*` (nb+en+13 auto). Ny mutasjon (bakoverkompat), ingen migrering.
- **F4-2b (gjenåpne-knapp i lederens SeddelKort) — web-only:** lederens firma-attesterings-Attestert-fane rendrer `SeddelKort` read-only → F4-2-knappen i `AttesteringDetalj` nås aldri der. Fiks: gjenåpne-handling **på selve kortet** (`SeddelKort.tsx`), vist kun ved `readOnly`, ekte `<Modal>`, kaller `gjenaapneAttestering` + invaliderer `hentTilAttesteringFirma`+`hentTilAttestering`. Gjenbruker F4-2s i18n. Ingen api/DB.
- **F4-3 (rå `{{dato}}` i mobil attestert-tittel) — mobil-only, når via #38:** `timer/[id].tsx` kalte `timer.detalj.attestertTittel` («Attestert {{dato}}») uten `{dato}`-arg → rå placeholder (datoen vises alt separat rett under). Fiks: mobil bruker nå den rene nøkkelen `timer.status.attestert` («Attestert»). Delt nøkkel uendret for web. Ingen i18n-tillegg (gjenbruk).
- **F4-4 (projectId-poison i mobil-synk) — server+mobil:** `syncBatch`-input krevde sedel-nivå `projectId: z.string().uuid()`, men mobil sendte `""` for tom/plassholder-sedel → Zod 400 på HELE batchen → gift-isolering avviste sedelen. Fiks: sedel-nivå projectId er fallback-shim (T.1: rad-nivå kanon) → `z.union([uuid, ""]).nullable().optional().transform(v => v || null)` (datatap-fri bakoverkompat #37 + #38); `verifiserProsjektmedlem` betinget på non-null; ny `radProsjekt`-resolver + synlig `avvist`-guard for rad uten prosjekt; mobil push sender `sedel.projectId || null`. Gift-isolering (SYNC-1) redder gode sedler ved 400. Ingen migrering. Mobil-delen når via EAS #38.

## Prod-deploy 2026-07-10 (prod-merge `373a109f`) — bolk (h) offline-synk + M4/M5 + katalog-importer

Develop→main-merge `373a109f`. Innhold: **bolk (h)** SYNC-1/SYNC-2 + M2–M7 (mobil offline-synk-blokkere + web/server-paritet) + **M4/M5 server-endringer i `apps/api/.../dagsseddel.ts`** (distinkte gjenåpne-koder `CONFLICT`/`BAD_REQUEST` + `NOT_FOUND`-melding; `syncBatch` maskin-`fra<til`-vakt) + **generisk katalog-importer** (`admin.importerTimerKatalog`).

- Ekte Docker-bygg (442 s), migrerings-gate OK (0 ventende migreringer mot prod-DB `/sitedoc`), cutover uten nedetid, browser-verifisert som innlogget bruker.
- **Server-siden (M4/M5/SYNC i `apps/api`) er dermed LIVE i prod.** Gammel klient (#37) mot ny server er trygg (leser uendret `e.message`).
- **Mobil-siden når brukere først via EAS #38** — **blokkert** av de to 🔴 Fase-4-funnene (rader-forsvinner-etter-attestering + accepted-deadlock). Se [BACKLOG § Timer web-vs-mobil paritet → Fase 4 simulator-funn](BACKLOG.md).
- Etter deploy: `admin.importerTimerKatalog` kjørt mot prod-org (A.Markussen) — 26 opprettet / 12 oppdatert / 0 deaktivert, km-stjerne→`120`. Lukker BACKLOG-blokkeren «nivå-1 lønnsart-seed».

## Prod-deploy 2026-07-09 (prod-merge `224c13f6`) — timer-paritet + pause-regler + overlapp/gjenåpne-vakt + nyNav sticky-flag

Merge develop→main (`224c13f6`, 2026-07-09): «timer-paritet + pause-regler + overlapp-vakt + gjenåpne-vakt + salsaklubb-isolasjon + tilkoblingsbudsjett». Alle hashene under er verifisert med `git merge-base --is-ancestor <hash> origin/main`. Åpne **mobil**-oppfølgere er IKKE arkivert bort — de står i [STATUS-AKTUELT § PSI Fase A + Maskin + ③](STATUS-AKTUELT.md) + [BACKLOG § Timer web-vs-mobil paritet](BACKLOG.md).

### Timer pause-modell (skiftrelativt pausevindu) — `f385ba99`
Pausevindu regnes relativt til skiftstart (`standardPauseEtterTimer`, default 4.0 t) i stedet for fast klokkeslett; additiv migrering `ADD COLUMN standard_pause_etter_timer` (to-stegs). Verifisert: DB (6 rader = 4.0) + simulator + web 8/8 (D1–D8). Berører api `organisasjon.ts`, mobil `TimerSeksjon`/`pauseBeregning.ts`, web `innstillinger`/`RedigerRadModal`, i18n. Sannhetskilde: [timer.md § Pause-bevisst tid-synk](timer.md). **Mobil-UI via neste EAS-batch** (BACKLOG).

### Web dagsseddel auto-fyll Fra/Til (paritet mobil) — `cd58853a`
Option A, kalender-effektiv via ny `organisasjon.hentEffektivArbeidstid`-query, sommertid-aware. Se [BACKLOG § Web dagsseddel auto-fyll](BACKLOG.md).

### Generalprøve web-runde F1/F3/F4/F5 — `6f1b5670` (F1 `5ace3e3f`, F3/F4/F5 `17ba8bb0`)
Bak `nyNavigasjon`-flagg (inert i prod). Skjermbilder `docs/redesign/screenshots/F1-F5-web-2026-07-08/`. Fabel-godkjent.

### Timer web-vs-mobil paritet + gyldighet (bolk a–g) — `224c13f6`
Web arbeider-flate speiler nå mobil (app = fasit) + hard server-gyldighet. Bolkene: a `b3230944` (D7/D1/D2/D3), b `0985d46e` (D4/D5/D6), c `7797a9b5` (D8), d `bf78889c` (R1–R4 fra/til-regler), e `f101890e` (pause-bevisst maskin-rad B1–B4 + spenn↔antall-synk) + `10622ee3` (`tilFraAntall`-grensefiks + vitest), f `f59a498c` («Gjenåpne dagsseddel» web + attestert-vakt på server) + `1deaff6b` (`confirm()`→Modal), g `79e786a3` (`fra<til`-superRefine + overlapp-vakt (web-mutasjoner; `syncBatch` udekket — se [BACKLOG SYNC-2](BACKLOG.md))) + `c81c4eae` (hele-sedel-prefill + 0==0-lukking). Test-verifisert web 8/8. **Mobil bolk (e)/(f)/(g) via neste EAS-batch** ([BACKLOG § Timer web-vs-mobil paritet](BACKLOG.md)).

### nyNav sticky-flag stale-lokal-fiks — `c77f2cb1`
`lokalTillatt`-guard i `resolverNyNavigasjon` + rolle-avledet opprydning i web/mobil-hookene (ikke-admin låses ikke inne av gammel `lokal="1"`). Merk: STATUS-AKTUELT-tråden anga `3b975773` på branch `feature/nynav-sticky-flag-fix`; det som faktisk landet på main er `c77f2cb1` (verifisert `merge-base --is-ancestor`). Mobil-del via neste EAS-batch. Detalj: [BACKLOG § nyNav sticky-flag](BACKLOG.md).

## Prod-deploy 2026-07-07 (prod-merge `0be103fa`) — a2 (live) + PSI/maskin/③ web-live + redesign (K9/K6-P31, flagg-inert) + sok-fiks

Merge develop→main (`0be103fa`, 2026-07-07 09:56). **Migrasjonsfri** — 0 migration-filer i selve diffen; PSI-/③-migreringene ble anvendt i den **tidligere** prod-mergen `80974276` (2026-07-05, 3 `migration.sql`). Web-image-rebuilden i denne deployen gjorde den `80974276`-merget web-koden (PSI/maskin/③) faktisk **live nå** — jf. kjent «auto-deploy rebuilder ikke web»-sak: web-flatene ble ikke live før denne manuelle rebuilden. **Verifisert innlogget prod:** data laster, redesign **av-default** (flagg-mekanismen live-bekreftet), `/dev-login` ikke montert (404 i prod), K9-redirects aktive.

### a2 — Dagsseddel dobbel-timeføring LØST (`f53de3e9`) — DEPLOYET TIL PROD (live)
Arbeidstid-vindu forhåndsutfylt fra firma-kalender (`hentEffektivArbeidstid`, Oslo-anker) + degradert til valgfritt/sekundært på begge detalj-sider; radene + topp-sum er primær-flaten. Fjerner den brukervendte dobbel-føringen (vinduet er ikke lenger et påkrevd steg). Bevart: `pauseMin` som maskin-buffer, auto-gen-stien, arbeidstids-varsel; rører ikke overtid/lønn. **Mobil (`ArbeidstidSeksjon`) via neste EAS-bygg.** **Åpen koord:** 13-språks `timer.arbeidstidPrefyltHint` faller tilbake til `en` til redesignets neste `generate.ts` dekker nøkkelen. a1 (utled total fra rader) + web-norm-paritet = fremtidig. Se [timer.md § Dagsseddel a2](timer.md).

### PSI Mannskap Fase A (§15-innsjekk/utsjekk) — web i prod, mobil venter EAS
Merget i prod-merge `80974276` (2026-07-05, migrasjon `20260705120000_add_psi_tilstedevarelse` anvendt på prod); web-flaten live via `0be103fa`-rebuilden. Første inkrement av Fase 4 Mannskap (vy i PSI-modulen). **Manuell presence, ingen GPS** — oppfyller byggherreforskriften §15 (listen, ikke automatikk) med null GDPR-bakgrunnslokasjon-risiko.

- **Datamodell:** ny `PsiTilstedevarelse` (`packages/db`, rent additiv CREATE TABLE — verifisert mot Prismas kanoniske output). Ingen User-endring (§15-felt finnes fra Fase 0). Event-tidsserie, ingen FK til timer (to-lags-grense: presence ≠ lønnstid).
- **API:** `apps/api/src/routes/mannskap.ts` — `sjekkInn` (idempotent), `sjekkUt`, `minStatus`, `hentPaaPlassen`, `hentForProsjekt`. Modul-gated på `psi`. ⭐ **Feltnivå-isolasjon (lovkrav):** `innsjekkTid`/`utsjekkTid` strippes for kaller som ikke deler arbeidsgiver-org med arbeideren (byggherre ser §15-aggregat, aldri klokkeslett). 12t auto-utsjekk som lazy-close.
- **Web (live):** `/dashbord/[prosjektId]/mannskap` §15-vy (firma-filter, søk, HMS-mangel-varsel, §15-eksport-klar) + nav-oppføring gated på psi.
- **Mobil (venter EAS):** `MannskapInnsjekkKort` på hjem (online-only, ingen offline-kø i Fase A). Distribueres via neste EAS-batch.
- i18n: 24 nøkler × 15 språk. Sannhetskilde: [mannskap.md § Fase A](mannskap.md). Senere faser (B QR / C geofence+juridisk sign-off / D §15-PDF+GDPR / E timer-hook) parkert.

### Maskin-dagsseddel Del 1+2 — web i prod, mobil venter EAS
Merget i `80974276` (ren UI + delt util, ingen migrering); web live via `0be103fa`. Lukker de to BACKLOG-UX-postene fra `0801af38`.

- **Del 1 — maskin-velger søk/filter/sortering.** Ny delt web-komponent `MaskinVelger.tsx` (`SearchInput` + kategori-chips + sortering brukt-på-seddelen → internNummer (numerisk) → navn), brukt i alle fire web-callsites. Mobil `EquipmentVelgerModal`: samme kategori-chips + sortering + «brukt»-markør.
- **Del 2 — maskin ≤ arbeidstimer proaktiv (b+disable).** Inline kapasitet-linje, rød + Lagre disabled ved overskridelse. Web `MaskinRadDialog` + mobil `MaskinRadModal`.
- **Delt sannhetskilde:** ny `packages/shared/src/utils/maskinKapasitet.ts` — serverens `validerMaskinUnderArbeid` delegerer hit; klient-disable (web+mobil) kaller samme funksjon. i18n: 3 nye nøkler nb+en + 13 auto. **Mobil-delen rir neste EAS-bygg.** Detaljer: [timer.md](timer.md) + [maskin.md](maskin.md).

### Timer auto-lønnsart ③ (overtid strukturert + garantert standard) — web/server i prod, mobil venter EAS
Merget i `80974276` (migrering `20260705120000_lonnsart_overtidsnivaa` anvendt på prod, to-stegs); web/server live via `0be103fa`. Lukker ③a (feil-match) + ③b (manglende standard).

- **③a — strukturert overtid.** Nytt `Lonnsart.overtidsnivaa Int?` erstatter fritekst-navne-regex; overtid velges via `velgOvertidLonnsart` (type + `overtidsnivaa`-match, aldri navn). Lærling-varianter `overtidsnivaa=null` → aldri auto-valgt for normal arbeider. Web admin-UI: «Overtidsnivå»-select + Zod 50/100/null.
- **③b — garantert standard.** Backfill setter `erStandardvalg` for orgs med ≥1 ordinær men ingen standard. Auto-gen gjetter aldri; F-G rød banner beholdt for null-ordinære.
- **⭐ Forward-compat:** overtid-klassifisering isolert i delt `packages/shared/src/utils/lonnsregel.ts`. i18n: 6 nye nøkler nb+en + 13 auto. **A.Markussens overtid-lønnsarter (170/172/175/177) settes manuelt i admin-UI før auto-gen stoles på. Mobil-del rir neste EAS-batch.** Detaljer: [timer.md § Overtid-klassifisering](timer.md).

### Redesign steg ii–vi + K9 + K6/P31 Kontakter — kode i prod bak `nyNavigasjon`-flagg (av-default, inert)
Redesign-koden (steg ii hub + funn-1b-fix, iii sidebar + kontekst-chip, s1/v4/v5 polish, vi 2a mobil-tabs) er nå i prod-koden men **inert bak `nyNavigasjon`-flagg (av-default)** — **IKKE live pilot**. Det som ER live flagg-av: **K9 URL-kanonisering + redirects** (legacy `/dashbord/prosjekter/[id]/*` → kanoniske ruter). **K6/P31 Kontakter** er flagg-**PÅ**-nav — ny Kontakter-side finnes i prod-koden, men ikke synlig i nav med flagg av. Steg vii (2c-leser med språkpiller) er fortsatt **aktiv på develop** (ikke i denne prod-runden) — se [STATUS-AKTUELT.md](STATUS-AKTUELT.md). Full paritet + T/G-status: [redesign-paritetssjekkliste.md](redesign-paritetssjekkliste.md).

## Prod-deploy 2026-07-04 (kveld, prod-merge `0801af38`) — PR 1-4: org-isolasjon + Leaflet + sak #5 + maskin-gating

Bunt-deploy av fire develop-fikser (api+web) fra `main` (`0801af38`, merge av develop). `-p docker up -d --build --no-deps sitedoc-api sitedoc-web`. **Ingen migrering** (ren kode). Backup før deploy (`~/sitedoc-prod-2026-07-04.dump`, ~95 tabeller). Lockout-query ikke nødvendig (ingen av de fire rører `signIn`-gaten). Markør-sjekk i bygg-konteksten bekreftet alle fire (9/2/5/3). Innlogget prod-verifisering: Leaflet-kart laster fullt, firma-ansatt ser eget firma uten admin-meny/maskin-innganger, admin uendret, maskin-føring happy-path OK.

### PR 1 — org-isolasjon `SheetMachine.vehicleId` (§2.D) (`90469dc7`)
Pre-eksisterende cross-firma-lekkasje-klasse (åpen siden 2026-06-09): `SheetMachine.vehicleId` (maskindrift) ble skrevet uten å verifisere at maskinen tilhører firmaet. `Equipment` er svak FK (`db-maskin`, ingen `@relation`) → org-isolasjon MÅ håndheves i app-lag. Fiks: `verifiserKjoretoyTilhørerFirma` lagt på alle fem input-baserte SheetMachine-skrive-stier (`maskin.tilfoy`, `maskin.oppdater`, `redigerSedelRader`, `splittRad`, `syncBatch`). Completeness-søk bekreftet nøyaktig fem input-stier (øvrige 8 `update`/`updateMany` skriver kun status/attestert-felter). Rent additivt, ingen migrering.

### PR 2 — Leaflet geofence-kart (`6178034f`)
Geofence-modalens kart lastet kun hjørne-fliser. Rotårsak i delt `KartVelger` (`apps/web/src/components/KartVelger.tsx`): `Modal` (`packages/ui/modal.tsx`, native `<dialog>`) monterer barna alltid men `display:none` når lukket → `L.map()` init med 0×0-container, `setTimeout(invalidateSize,100)` fyrer mens dialogen er skjult. Ikke ren regresjon fra `b1c81629` (den eksponerte pre-eksisterende KartVelger-bug). Fiks: `ResizeObserver` på kart-container → `invalidateSize()` når container går 0→høyde ved modal-open; `disconnect()` i cleanup; fallback-`setTimeout` beholdt. Fikser alle modal-hostede kart-bruk.

### PR 3 — sak #5 firma-ansatt-innsyn (`6dbc884a`)
Firma-ansatte (role="user") fikk ikke `valgtFirma` populert (så verken eget firma, prosjekter eller timer/maskin-flater). Dobbel-kilde-design (naivt kilde-bytte ville krasjet modul-gating + lekket firma-admin-skallet): `hentMineMedlemskap` (`organisasjon.ts`) beriket med `aktiveFirmamoduler` via delt `berikMedFirmamoduler`; `firma-kontekst` beholder `hentTilgjengelige` som admin-sett + `hentMineMedlemskap` populerer `valgtFirma` (auto-select `tilgjengelige.length===1` → ellers `mineMedlemskap.length===1`); nytt `kanAdministrereFirma = erSitedocAdmin || (valgtFirma ∈ tilgjengelige)`; re-gate firma-admin-flater (`firma/layout.tsx` choke-point for alle 22 `/dashbord/firma/*` + opprett-UI i `nytt-prosjekt`/`kom-i-gang`) på kapabilitet, ikke `valgtFirma`-eksistens. Prosjekt-lister (`prosjekt.hentAlle`) allerede medlemskaps-scoped server-side. Bevarer admin-regel bit-for-bit.

### PR 4 — maskin opprett/import-gating (`179b86f9`)
Kosmetisk oppfølger til sak #5: maskin «Nytt»/«Import»-innganger (`maskin/page.tsx`) + `maskin/nytt`/`maskin/import` page-guards gated på `kanAdministrereFirma` (server beskyttet allerede via `verifiserFirmaAdmin`/`autoriserAdminForFirma` — hindrer bare at ansatte når skjemaer som feiler). Maskin-lista/-visning åpen for ansatte (de logger maskinbruk). Ny i18n-nøkkel `firma.maskin.ingenTilgangOpprett` (nb+en, auto-oversatt 13 språk).

## Prod-deploy 2026-07-04 (prod-merge `bb5aec05`) — split-identitet + erKunde + geofence-oppdagbarhet

Bunt-deploy av tre lav-risiko-endringer (api+web) fra `main` (`bb5aec05`, merge av develop `42d41aa8`). Build 97,8 s (ekte rebuild), `-p docker up -d --build --no-deps sitedoc-api sitedoc-web`. **Ingen migrering** (ren kode). Backup tatt før deploy (`~/backups/sitedoc-prod-2026-07-04-1929.dump`, 95 tabeller). Lockout-query = 0 rader (ingen bruker låst ute av gate-innstrammingen).

### Split-identitet MS-login (web↔mobil) — Fix A + gate-innstramming (`42d41aa8`)

**Funn (DB-bevis mot prod 2026-07-04):** KMY (`@onmicrosoft`) fikk **to `users`-rader** for én Microsoft-konto → web tom prosjektliste mens mobil viste 999. Rad A `f2d473b9…` (blandet case, har ProjectMember 999 + OrganizationMember A.Markussen; mobil-sesjon 30d) vs. rad B `3a3c6272…` (lowercase, tom; web-sesjon 24t). **Rot:** to samvirkende feil — (1) mobil (Graph `/me.id`) og web (Auth.js id-token `sub`) bruker ulik `provider_account_id` → web `getUserByAccount` matcher aldri mobilens konto; (2) `getUserByEmail`-overstyringen (`auth.ts:13`) var **case-sensitiv** mens lagret e-post avvek i case → e-post-kobling feilet → Auth.js opprettet duplikat B.

**Implementert:**
- **Fix A** (`auth.ts:15`): `getUserByEmail` → `{ equals: email, mode: "insensitive" }`. Fullfører herdingen som `signIn`-gaten + mobil alt hadde.
- **Gate-innstramming** (`auth.ts` signIn (a) + speilet i `mobilAuth.ts byttToken`): eksisterende canLogin-bruker slippes kun inn med `sitedoc_admin` / `OrganizationMember` / `ProjectMember` / ventende invitasjon / allerede koblet konto. Bruker fjernet fra alle firma/prosjekt avvises ved neste innlogging (ønsket). `company_admin` dekkes av OrganizationMember.

**Sak #3 (prod-datafiks KMY-duplikat) — UTFØRT** (konsolidering kjørt manuelt 2026-07-04): begge MS-kontoene (`068af417` mobil + `o05acphT` web) flyttet til A (`f2d473b9`, e-post endret til `kenneth@sitedoc.no`), B (`3a3c6272`) arkivert `can_login=false`. A eier 999; web-sesjon på A (18:16) bekreftet virker. Diagnostikk-SQL: `scripts/diag-kmy-web-bug.sql`.

**Fortsatt åpent (BACKLOG):** sak #4 (e-post-normalisering ved skriving + backfill), sak #5 (firma-velger `hentTilgjengelige` → `hentMineMedlemskap`).

### «Opprett firma» (admin) erKunde-fiks (API+web) (`6de25024`)

`admin.opprettOrganisasjon` satte ikke `erKunde`, falt til default `false`, og `hentAlleOrganisasjoner` filtrerer `erKunde: true` → opprettet firma ble usynlig (firmaet *ble* laget). **Fiks:** create setter `erKunde: true` (`admin.ts:156`). I tillegg `onError`+feilvisning på opprett-mutasjonen + `title`-tooltip på Brønnøysund-knapp (`brreg.hint`, 15 språk). Åpen oppfølger: prod-orphan-opprydding (read-SQL klar, Kenneths prod-DB-hånd) — se [BACKLOG § «Opprett firma»](BACKLOG.md).

### Geofence-discoverability (web) (`b1c81629`)

Geofence-editoren gjort oppdagbar på `byggeplasser/page.tsx`: egen synlig **«Geofence»**-verktøylinje-knapp (MapPin) → egen modal (skilt ut fra «Endre navn», som nå er ren navne-endring). Ikon/label-fiks: «Endre navn» Copy→Pencil, «Rediger»→**«Tegninger»** (LayoutGrid). Opprett markerer ny byggeplass i lista. Geofence-seksjon flyttet verbatim (settGeofence/beregnGeofence/geokod uendret). i18n: ingen nye nøkler (gjenbruk `lokasjoner.geofence.tittel` + `nav.tegninger`), hjelp-tips oppdatert (15 språk).
