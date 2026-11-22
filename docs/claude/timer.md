---
status: aktiv
sist_verifisert_mot_kode: 2026-11-06
sist_endret: 2026-08-11
gjelder_versjon: Fase 3
avhenger_av:
  - arkitektur.md
  - terminologi.md
  - fase-0-beslutninger.md
  - smartdok-undersokelse.md
  - dokumentflyt.md
påvirkes_av_beslutninger:
  - A.1
  - A.7
  - A.8
  - A.20
  - A.22
  - A.23
  - A.28
  - C.10
  - C.14
---

# Timeregistrering — Fase 3

> 🔴 **GPS, reise og flere prosjekter pr. dag: les
> [timer-gps-helhetsplan.md](timer-gps-helhetsplan.md) FØR noe bestilles.**
> Fem lag med bindende rekkefølge, 20 målte hull og ni beslutninger som venter på Kenneth.
> KS-et av fabel 2026-10-01. **Kun LAG 0 kan trygt bestilles i dag.**
> 🟢 **Revidert kveld 2026-10-01: dagsmodellen V1–V14 vedtatt (§ 4b) — reisetid er ALDRI overtid (V1),
> `reisetidTellerOvertid` utgår (V2), tur/retur (V7), mellometappe = arbeidstid (V9). Fabel eier planen, orkestrator gater.**
> 🟢 **Lag 0 levert 2026-10-02** (`89acee95` km-tak i `rad-tak.ts` · `a13f4343` `beregnDagsforslag`/`anvendDagsforslag`). Lag 0c `c78bc14f` (shared typesjekkes, regel 10 fire ledd). **Lag 0 komplett.** Lag 1-spesifikasjon venter K2 + V6.


## Implementasjonsstatus per 2026-05-01

Verifisert mot kodebase 2026-05-01. Hver påstand i resten av dette dokumentet refererer til **planlagt** datamodell/UI hvis ikke annet er merket eksplisitt.

### Forutsetninger fra Fase 0 og 0.5 (klar i prod)

| Avhengighet | Status | Kilde |
|---|---|---|
| `Activity`-tabell (audit-skjelett) | ✅ Implementert i prod | Fase 0 § E.1 (commit `13a746a7`) |
| `OrganizationSetting` (timezone, tilgangs-defaults, kompetanse-policy) | ✅ Implementert i prod | Fase 0 § E.2 (commit `4a155c28`) |
| `ExternalCostObject` (Underprosjekt-tabell) | ✅ Implementert i prod | Fase 0 § E.11 (commit `9c9dd682`) |
| `User.ansattnummer` | ✅ Implementert i prod | Fase 0 § E.13 (commit `37d49872`) |
| `Avdeling`-tabell + `User.avdelingId` | ✅ Implementert i prod | Fase 0.5 § 1 (commit `a90daabd`) |
| `Kompetansetype` + `AnsattKompetanse` | ✅ Implementert i prod | Fase 0.5 § 2 (commit `a5ba99ce`) |
| `harOrgRolle()` i tilgangskontroll.ts | ✅ Implementert i prod | Fase 0 § E.14 |
| `verifiserKompetanseSkriveTilgang()` | ✅ Implementert i prod | Kompetanse-UI Runde 2 (`653028b4`) |
| `verifiserFirmaAdmin()` | ⚠️ Ikke sentralisert — duplisert lokalt i `avdeling.ts`, `kompetansetype.ts`, `kompetanse.ts`, `organisasjon.ts`. Ryddes ved første timer-rute som trenger den (flyttes til `tilgangskontroll.ts`) |
| `KOMPETANSE_KATEGORIER` + relaterte typer i shared | ✅ Implementert i prod | Fase 0.5 § 2 |

### Timer-spesifikt — Fase 3 Infrastruktur-commit STARTET 2026-05-01

| Komponent | Status | Beskrevet i seksjon |
|---|---|---|
| `packages/db-timer/`-pakke | ✅ Opprettet 2026-05-01 (Infrastruktur-commit) — postgres-schema `timer`, egen Prisma-klient | «Database — `packages/db-timer`» |
| `apps/timer/` (vurdert, vedtatt: bygges som modul i `apps/web`, ikke egen app) | ❌ Ikke aktuelt | «Hvorfor ikke separat app?» (linje ~858) |
| `lonnsarter`-tabell | ✅ Schema + migrasjon-SQL klar (Infrastruktur-commit) | «`lonnsarter` (lønnsart-katalog per Organization)» |
| `tillegg`-tabell | ✅ Schema + migrasjon-SQL klar (Infrastruktur-commit) | «Tillegg (datadrevet katalog, tre-nivå)» |
| `tilleggs_regler`-tabell | ❌ Ikke opprettet — hardkodet i Runde 1, vurderes i Runde 2 | «Tilleggsregler (automatisering)» |
| `aktiviteter`-tabell | ✅ Schema + migrasjon-SQL klar (Infrastruktur-commit) | «Aktivitet-katalog (datadrevet, tre-nivå)» |
| `daily_sheets`-tabell | ✅ Schema + migrasjon-SQL klar (Infrastruktur-commit) | «Hovedtabell: `daily_sheets` (dagsseddel)» |
| `sheet_timer`-tabell | ✅ Schema + migrasjon-SQL klar (Infrastruktur-commit) | «`sheet_timer` (timer-rader per dagsseddel)» |
| `sheet_tillegg`-tabell | ✅ Schema + migrasjon-SQL klar (Infrastruktur-commit) | «`sheet_tillegg` (tillegg-rader per dagsseddel)» |
| `expense_categories`-tabell | ✅ Schema + migrasjon-SQL klar (Infrastruktur-commit) | «`expense_categories`» |
| `sheet_machines`-tabell | ❌ Ikke opprettet — Runde 2/3 | «`sheet_machines`» |
| ~~`sheet_materials`-tabell~~ | 🟦 **FORELDET 2026-05-02** — erstattet av C.16 Vareforbruk (egen modul, ikke timer-tabell). Se [fase-0-beslutninger.md C.16](fase-0-beslutninger.md). Skissen i § `sheet_materials`-spec (linje ~755) bevares som referanse, men skal ikke implementeres |
| `sheet_expenses`-tabell | ❌ Ikke opprettet — Runde 2/3 | «`sheet_expenses`» |
| `arbeidstidskalender`-tabell | 🟡 **T.9 BESLUTTET 2026-05-15** — implementasjon neste fase. Variant B (dynamisk), plassert i `packages/db` (kjernen), ikke `db-timer`. Se [fase-0-beslutninger.md § T.9](fase-0-beslutninger.md). | «`arbeidstidskalender`» |
| `OrganizationSetting.overtidsmatTerskel` | ✅ Tilføyd 2026-05-01 (Infrastruktur-commit, default 9.0) | Kreves av tilleggsregler-spec |
| `OrganizationSetting.dagsnorm` | ✅ Tilføyd 2026-05-01 (Infrastruktur-commit, default 7.5) | Kreves av auto-fordeling |
| `OrganizationSetting.tillattSelvAttestering` | 🟡 Tilføyd 2026-05-01 (default true, ubrukt). w7 (`feat/web-timer-w7`, ikke merget): «Attestant kan attestere egne timer», `schema.prisma:417` `@default(false)`; migrering `20261118120000_selvattestering_nei` setter standard og alle rader til `false` — **ikke kjørt** mot test/prod. Manglende rad = Nei | B15: attestant attesterer ikke egne timer (`web-timeforing-plan.md` § 8.5) |
| `OrganizationSetting.timerLockEtterDager` | ✅ Tilføyd 2026-05-01 (Infrastruktur-commit, Int? null = ingen alders-grense; status styrer låsing per Variant A) | Status-basert låsing |
| `OrganizationSetting.tidsrundingMinutter` | ✅ Tilføyd 2026-05-12 (T.5, PR 1A commit `862c70c3`, Int? @default(15)) — støttede verdier: 15, 30, 60, null (ingen avrunding) | T.5: Tidsrunding ved timer-registrering |
| `OrganizationSetting.timerRegistreringsmodus` | 🟡 Tilføyd 2026-11-05 (Prosjektkort L1, `feat/prosjektkort-l1`, `schema.prisma:488`, String @default("dagskort")) — `dagskort` \| `prosjektkort`; kun admin skriver (`organisasjon.oppdaterSetting`), alle medlemmer leser via `hentArbeidstidDefaults`. Migrering `20261105120000_timer_registreringsmodus` — **ikke kjørt** mot test/prod | Prosjektkort L1: visningsmodus for web-sedelen |
| `Organization.harTimerModul` | ✅ Tilføyd 2026-05-01 (Infrastruktur-commit, default false) — midlertidig modul-flagg, samme mønster som `harMaskinModul` |
| `apps/api/src/services/timer/moduleGate.ts` | ✅ Opprettet 2026-05-01 — `erTimerAktivert` + `krevTimerAktivert` |
| `modulProcedure('timer')` i tRPC | ❌ Ikke implementert | Forutsetter fullstendig modul-gateway (per A.4) |
| `apps/api/src/services/seed/index.ts` | ✅ Implementert 2026-05-01 (Runde 1A) — 5 funksjoner med faktisk innhold + idempotent skip-logikk |
| `seedLonnsartNivaa1` (16 lønnsarter) + `seedLonnsartNivaa2` (25 lønnsarter) | ✅ Implementert 2026-05-01 (Runde 1A) per timer.md tabell |
| `seedAktiviteter` (3) + `seedTillegg` (3) | ✅ Implementert 2026-05-01 (Runde 1A) |
| `seedExpenseCategories` (5: Drivstoff, Parkering, Diett, Verktøy, Annet) | ✅ Implementert 2026-05-01 (Runde 1A) |
| `timer.*` tRPC-router (onboarding/lonnsart/aktivitet/tillegg) | ✅ Implementert 2026-05-01 (Runde 1A) |
| Web-sider `/dashbord/firma/timer/*` (onboarding + 3 CRUD-tabeller) | ✅ Implementert 2026-05-01 (Runde 1A) |
| Sidebar-element «Timer» i firma-layout (gates på `harTimerModul`) | ✅ Implementert 2026-05-01 (Runde 1A) |
| `seedArbeidstidskalender(organizationId, year)` | ❌ Ikke implementert — Runde 2/3 | Samme |
| Eksport-adaptere (Proadm, Tripletex, Visma, Poweroffice) | ❌ Ikke implementert | «Eksport til lønnssystem» |
| Mobil offline-sync-mekanikk for dagsseddel | ✅ Implementert (Runde 2) — `apps/mobile/src/services/timerSync.ts` (32 KB: push/pull mot `timer.dagsseddel.syncBatch`, 4-tilstands `syncStatus` pending/synced/conflict/avvist, conflict + gift-isolering) + `dagsseddel_local`-schema (`apps/mobile/src/db/schema.ts:83`). Server: `syncBatch` (`apps/api/src/routes/timer/dagsseddel.ts:3655`). Betinget skriving mot samtidig attestering (2b TOCTOU-fiks 2026-07-16). | «Offline-first arkitektur» |
| Forenklet godkjenningsflyt mot ansatt | ❌ Ikke implementert — Runde 1C | «Forenklet godkjenningsflyt (mot ansatt)» |

### Eksisterende prototype (skal slettes)

`apps/web/src/app/dashbord/[prosjektId]/timer/page.tsx` er en **demo-prototype** for kundepresentasjon (914 linjer hardkodet demodata, hardkodede konstanter `DAGSNORM = 7.5` og `OVERTIDSMAT_TERSKEL = 9`). Per CLAUDE.md skal denne fila **slettes** når Timer-modulen bygges ordentlig — ikke videreutvikles.

### Spec-status

| Tema | Spec-status |
|---|---|
| Lønnsart-katalog (Nivå 1: 16 + Nivå 2: 25 + Nivå 3) | ✅ Fullt spec'd |
| Onboarding-scenarier (A: nytt firma, B: migrering) | ✅ Fullt spec'd |
| Auto-fordeling normaltid/overtid | ✅ Fullt spec'd |
| Aktivitet-katalog | ✅ Fullt spec'd |
| Tilleggsregler (overtidsmat, nattskift, helgetillegg) | ✅ Fullt spec'd |
| Arbeidstidskalender | ✅ Fullt spec'd — **Variant C (manuell + import-knapp) vedtatt 2026-04-29 erstattet av Variant B (dynamisk) i [T.9 2026-05-15](fase-0-beslutninger.md). Implementasjon neste fase.** |
| Dagsseddel-flyt (mobil) | ✅ Fullt spec'd |
| Database-skjema for db-timer | ✅ Fullt spec'd |
| Manuell Underprosjekt-opprettelse (vedtatt vei) | ✅ Fullt spec'd |
| Forenklet godkjenningsflyt mot ansatt | ✅ Fullt spec'd |
| Eksport-adapter-interface | ✅ Fullt spec'd |
| **Drømmescenario: Proadm → auto-opprett SiteDoc Godkjenning** | 🟡 **BACKLOG** — 4 åpne spørsmål, krever A.Markussen-input + stabil Proadm-integrasjon (per linje 442) |

### Reelle blokker for Fase 3-start

Kun ett: **Drømmescenario for Proadm → SiteDoc Godkjenning auto-avledning** (timer.md:440-467) — markert som BACKLOG, **ikke nødvendig for Fase 3 MVP**. Manuell knapp-strategi (linje 491+) er ferdig spec'd og kan implementeres direkte.

**Konklusjon:** Spec-en er substansielt komplett. Fase 3 kan startes etter Maskin-modulen er ferdig, med kun implementasjons-arbeid som gjenstår — ingen designvalg utestående.

### Fase 3-fremdrift (per 2026-05-01)

| Runde | Status | Innhold |
|---|---|---|
| **Infrastruktur** | 🟢 Igangsatt 2026-05-01 | db-timer-pakke (7 tabeller), kjernen-migrasjon (Organization.harTimerModul + 4 OrganizationSetting-felt), moduleGate, seed-skjelett, workspace-deps |
| **Runde 1A** — Katalog-admin | ✅ Deployet til prod 2026-05-01 | tRPC-router timer.* (onboarding/lonnsart/aktivitet/tillegg), 5 seed-funksjoner med faktisk innhold (16 Nivå 1 + 25 Nivå 2 + 3 aktiviteter + 3 tillegg + 5 utleggskategorier), web-sider `/dashbord/firma/timer/*`, sidebar-element |
| **Runde 1B** — Dagsseddel-flyt | ✅ Deployet til prod 2026-05-01 | Slettet prototype (914 linjer demodata). `timer.dagsseddel.*` tRPC-router med 12 endepunkter (list/hentMedId/opprett/oppdater + 6 rad-mutations + send/slett) — idempotent via clientUuid, status-livssyklus enforcing (draft/returned redigerbar, sent/accepted låst), `timerLockEtterDager` kun på draft. Web-sider: liste/ny/detaljside under `/dashbord/[prosjektId]/timer/*`. Sidebar Timer-element gates på `harTimerModul`. ~50 nye i18n-nøkler |
| **Runde 1C** — Leder-attestering | 🟢 Implementert 2026-05-01 (`feature/timer-1c`) | 4 nye endepunkter i dagsseddel.ts: hentTilAttestering/kanAttestere/returner/attester (omdøpt fra hentTilGodkjenning/kanGodkjenne 2026-05-02; `hentTilAttestering`, `kanAttestere` og prosjektets side er fjernet i w10b, plan web-timeføring § 4.10 — prosjektlederen attesterer på `/dashbord/attestering`). Snapshot-pattern (Fase 0 A.7) ved attester — pris kopieres til SheetTimer.attestertSnapshot/SheetTillegg.attestertSnapshot JSON. Web-side `/timer/attestering` for ledere. Sidebar-element gates på `harTimerModul && kanAttestere`. Detaljside utvidet med returned/accepted-banner. ~17 nye i18n-nøkler. **Forenklet godkjenningsflyt mot ansatt utsatt** (timer.md:565+) — krever leder-genererer-seddel-på-vegne-av-ansatt-flyt, tas i egen runde |
| **Runde 2** — Mobil + offline-sync (MVP) | 🟢 KOMPLETT på develop 2026-05-02 (`feature/timer-2` merget via `1cce62f3`) | C1 Drizzle-skjema (6 lokale SQLite-tabeller — dagsseddel_local + 2 rad-tabeller + 3 katalog-cache). C2 server-side `timer.dagsseddel.syncBatch` (per-seddel `$transaction`, uavhengig resultat per seddel: ok/conflict/feilet, maks 100 sedler per kall) + `hentEndringerSiden` (delta-pull siden timestamp). C3 sync-motor (`apps/mobile/src/services/timerSync.ts`) + `TimerSyncProvider` (NetInfo-trigger + 30s aktiv-app-interval + manuell pull-to-refresh). C4 katalog-cache (`timerKatalog.ts`, full overskriving av lonnsart/aktivitet/tillegg-tabeller ved login). C5 UI-liste (`/timer/index.tsx`) + `TimerSyncStatusBar` + `TimerStatusMerkelapp` + Mer-tab Timer-rad med pending/conflict-badge. C6 opprett-skjema (`/timer/ny.tsx`) med DateTimePicker + prosjekt-velger + aktivitet-velger + clientUuid generering, og detaljside (`/timer/[id].tsx`) med status-banners (returned/accepted/conflict/pending) + 4 inline modaler (TimerRadModal/TilleggRadModal/LonnsartVelgerModal/TilleggVelgerModal) + send-til-attestering + slett. C7 ~50 nye i18n-nøkler — total 155 timer-nøkler per språk. **C8 Underprosjekt-velger** — ny `eksternKostObjekt.list({projectId?})`-router (kjernen-DB), ny `external_cost_object_local`-tabell + idempotent migrering, `refreshKatalog` henter ECO-er via Promise.all med catch-fallback, UnderprosjektVelgerModal i TimerRadModal (filtrer på prosjekt + søk når > 7), ECO-etikett under lønnsart i TimerRadVis, fjern-X-knapp ved siden av valgt ECO. C5 visuelt verifisert 2026-05-02 på iOS Simulator + fysisk mobil. **Test-deploy + prod-deploy av C6–C8 utsatt til neste sesjon.** **Scope-utelatelser per Runde 2 MVP** (utsatt til 2.5/3): utlegg + maskin på dagsseddel, leder-attestering på mobil, aktivitet-på-rad-nivå (designes sammen med maskintimer-Runde 2.5), `sheet_machines`/`sheet_materials`/`sheet_expenses` + ~~`arbeidstidskalender`~~ (kalender flyttet til kjernen-DB i [T.9 2026-05-15](fase-0-beslutninger.md)) |
| **Runde 2.5 / C9** — Aktivitet per rad + sheet_machines | 🟢 Implementert 2026-05-02 (`feature/timer-2.5`) | `SheetTimer.aktivitetId` NOT NULL (backfill fra parent), `DailySheet.aktivitetId` nullable default, `SheetMachine`-tabell, `ExternalCostObject.proAdmType String?` (kjernen, fri tekst), `timer.dagsseddel.maskin.*` mutations, `timer.dagsseddel.hentDagstotal`, web maskin-seksjon med soft-skjul, mobil aktivitet-per-rad-velger. Maskin-cache mobil utsatt til 2.6. Se [dagsseddel-design.md](dagsseddel-design.md) for vedtatte beslutninger og [fase-0-beslutninger.md C.18](fase-0-beslutninger.md). |
| **Runde 2.6** — Mobil maskin-cache | 🟢 Implementert 2026-05-02 (`feature/timer-2.6`) | `equipment_local` Drizzle-tabell + `maskinKatalog.ts` (refresh ved login + nett-gjenkomst, parallelt med Timer-katalog) + MaskinSeksjon/MaskinRadModal/EquipmentVelgerModal/EnhetVelgerModal i mobil [id].tsx + soft-skjul (skjules når Equipment-cache er tom). Utgåtte ekskludert fra velger via filter (status≠'utgaatt'). Søk-felt i velger når > 7 elementer. ~7 nye i18n-nøkler nb+en. Sync-motor allerede på plass i C9 — sheet_machine_local sendes/mottas. |
| **Runde 2.7** — Mine timer + dagstotal-banner + ukesoppsummering | 🟢 Implementert 2026-05-02 (`feature/timer-2.7`) | DagstotalBanner-komponent på mobil (lokal Drizzle-spørring, brukes i ny.tsx + [id].tsx) — viser sum timer på tvers av prosjekter for valgt dato. UkeTotalBanner mobil i `/timer/index.tsx`. Web uke-navigator utvidet med totalsum «Uke X — totalt Y.YYt». Ny `/dashbord/timer/mine` (web): periode-velger (5 valg inkl. egendefinert), 4 oppsummerings-kort, per aktivitet/status-aggregeringer, detaljliste. Sidebar-element «Mine timer» i firma-layout (gates på timer-modul). Ny `/timer/mine` (mobil): periode-toggle (3 valg), 2 pills, aktivitet-aggregering, detaljliste. Mer-tab Timer-rad fikk søsken-link «Mine timer». Bruker eksisterende `timer.dagsseddel.list` med klient-side aggregering. ~22 nye i18n-nøkler nb+en. Ingen DB-migrasjon, ingen server-endring. |
| **Runde 3** — Eksport-adaptere | ❌ Ikke startet | Proadm/Tripletex/Visma/Poweroffice-adaptere |
| **T.1–T.6 arkitektur-redesign** | 🟢 Deployet prod 2026-05-12 | 5 PR-er (`862c70c3`/`bba971ba`/`6431873c`/`8478d4a7`/`0700b8ed`). DailySheet.projectId droppet, projectId på rad-nivå (NOT NULL), fra/til per rad (T.4), per-rad attestering-felter (T.3), `OrganizationSetting.tidsrundingMinutter` (T.5). Detaljer i [fase-0-beslutninger.md § T](fase-0-beslutninger.md) + [STATUS-AKTUELT.md § Implementasjonsstatus](STATUS-AKTUELT.md). |
| **PR 2C full (mobil Drizzle-omskriving)** | 🟡 Delvis (kjernen levert, rest utsatt) | **✅ Levert (T7-3b1/T4):** per-rad `projectId` + `fraTid`/`tilTid` på `sheet_timer_local`/`sheet_machine_local`; `timerSync.ts` sender projectId per rad; screens (`[id].tsx`/`ny.tsx`/`mine.tsx`) bruker rad-nivå-modellen. **🔴 Genuint åpent:** `dagsseddel_local.project_id` fortsatt `.notNull()` på sedel-nivå (`schema:84`, SQLite TABLE-recreate kreves for nullable) + `byggeplass_id` + attestert-felter på rad-tabellene + NOT NULL-constraint + full backfill fra parent. PR 2C min (`0700b8ed`) leverer kun defensiv null-guard. Resten utsatt til nytt krav (f.eks. mobil-flerprosjekt-dagsseddel) trigger den. |
| **Web-timer T.1-korrekthet (interim)** | 🟢 Implementert 2026-07-05 (develop) | Web-UI behandlet dagsseddel som prosjekt-eid (foreldet mot T.1). Tre fiks: **①** `dagsseddel.list` bruker eksplisitt `where` med rad-prosjekt-filter `timer: { some: { projectId } }` (spread av ugyldig `projectId` på `DailySheetWhereInput` var runtime-brutt → prosjekt-kontekst-lista var alltid tom); **②** `list` beriker hver sedel med `prosjektIder` (distinct på tvers av timer-/maskin-/tillegg-rader) → `mine/page.tsx` viser faktiske prosjekter i stedet for «—»; **③** web-opprett (`dashbord/timer/ny/page.tsx`) er nå **dato-only** — `opprett`-input droppet `projectId`, auth via org-tilgang (`krevBrukersOrg`+`krevTimerAktivert`) i stedet for `verifiserProsjektmedlem`, prosjekt-velger + geo-forslag fjernet. Prosjekt legges per rad på detalj-siden (allerede T.1-korrekt). **PSI-drevet auto-forslag av prosjekt (④) forblir Fase 4 Mannskap/PSI.** Se [BACKLOG § Web-timer-UI T.1-korrekthet](BACKLOG.md). |
| **Dagsseddel a2 — arbeidstid-vindu forhåndsutfylt + degradert** | 🟢 Implementert 2026-07-06 (develop) | Fjerner dobbel-timeførings-artefakten (arbeider førte total arbeidstid PÅ sedel-nivå + rader på nytt). **Server:** `dagsseddel.opprett` prefyller `startAt`/`endAt`/`pauseMin` fra firma-kalenderen (`hentEffektivArbeidstid`) når klienten ikke sender et vindu — i stedet for tomt. Ny helper `osloVeggurTilInstant` anker veggur-tid til Europe/Oslo (DST-bevisst; serveren kjører UTC i Docker). **UI degradert** (web `timer/[id]/page.tsx` + mobil `ArbeidstidSeksjon.tsx`): «Arbeidstid i dag» fra primær/påkrevd → sekundær/forhåndsutfylt/overstyrbar (ny streng `timer.arbeidstidPrefyltHint` — «timene føres på radene»); rediger-modalen beholdt for glemt-dag/korreksjon. Radene + topp-sum er primær-flaten. **Bevart:** `pauseMin` som sedel-felt (maskin ≤ arbeid-buffer for eldre rader uten jobb — w9), auto-gen-stien (`StartSluttDagKort.tsx`) urørt, arbeidstids-varselet (varighetsbasert → TZ-invariant). Ingen migrering. i18n: nb+en (13 øvrige via redesignets neste `generate.ts`, regel 3). **a1 (utled total fra rader) + web-norm-paritet = fremtidig.** |
| **fra/til obligatorisk på timer-rader — REVERSERER a2-valgfritt** | 🟢 Implementert 2026-07-13 (`fix/timer-fra-til-obligatorisk`, commit `a0d510a5` + GPS-carve `62cee2dc`) | **Fabel-vedtak:** a2 gjorde per-rad fra/til valgfritt («(Valgfritt)»); tid-løse timer-rader er ufullstendige lønnsdata OG usynlige for overlapp-vakten (`finnOverlappendeTidsrom` hopper over rader uten begge tider) → reversert. Håndheving på INTERAKTIVE mutasjoner (`tilfoyTimerRad`/`oppdaterTimerRad`/`validerSplittFelles` timer-gren) + klient (fra/til påkrevd, Lagre disabled). **`syncBatch` BEVISST urørt (LEGACY-VERN):** eksisterende prod-rader + GPS-auto-rader round-tripper uten å låses. **GPS-carve:** auto-utkastet tildeler nå FAKTISKE fra/til via delt `carveArbeidstider` (@sitedoc/shared, vitest). **REISE-UNNTAK:** reise beholder null-tider (matrise-/estimat-mengde uten målt klokke-vindu — dokumentert unntak, ikke falske lønnsdata). |

---

## Formål

Timeregistrering for ansatte på byggeprosjekter. Offline-first — feltarbeidere registrerer timer uten nettdekning, synkroniserer når dekning er tilbake. Registrering fra mobil, administrasjon fra web.

## Appstruktur

| Komponent | Plassering | Beskrivelse |
|-----------|------------|-------------|
| **Web** | Modul i `apps/web` | Next.js — administrasjon, rapporter, eksport. Tilgjengelig via prosjektets sidebar når Timer-firmamodulen er aktivert |
| **Mobil** | Modul i `apps/mobile` | React Native, offline-first via SQLite — daglig registrering |
| **API** | Modul i `apps/api` | tRPC-ruter for timer, gates med `modulProcedure('timer')` |
| **Database** | `packages/db-timer` | Eget Prisma-skjema, aldri inn i `packages/db` |

Timer er **ikke en egen app** med eget domene/port — den er integrert i eksisterende SiteDoc-struktur som en firmamodul (samme mønster som Maskin). Deler PostgreSQL-instans med SiteDoc, men helt separate tabeller. Delt auth via eksisterende `sessions`-tabell.

**Begrunnelse:** Kunden bekrefter at arbeidere bruker SiteDoc-app på mobil — ikke en separat timer-app. Per fase-0-beslutninger kjører Maskin-modulen samme mønster (integrert), Timer skal følge samme arkitektur. `packages/db-timer` eksisterer ikke ennå (verifisert 2026-05-01 — opprettes ved Fase 3-start, se «Implementasjonsstatus per 2026-05-01»-tabellen øverst).

## Dagsseddel-modell

> **🟡 Modul-avhengighets-regel:** Endringer i `daily_sheets`, `sheet_timer`,
> `sheet_tillegg` eller `sheet_machines` krever lesing av
> [dagsseddel-design.md § Modul-avhengigheter](dagsseddel-design.md). Timer
> eier dagsseddelen; Vareforbruk og Maskin integreres inn.

Én **dagsseddel** per arbeidsdag samler alt: arbeidstimer, lønnsarter, reisetid, tillegg, maskinbruk og materialforbruk.

### Prinsipp

Systemet skiller alltid mellom:
- **Arbeidstid** — grunnlag for overtidsberegning (normaltid + overtid)
- **Betalte tillegg** — reisetid, kost, natt, helg — teller IKKE som arbeidstid
- **Maskinbruk** — timer per maskin med valgfri mengde
- **Materialforbruk** — mengde med enhet

Disse er separate kolonner i eksport til lønnssystem.

### Lønnsart-katalog (datadrevet, tre-nivå)

Lønnsart-katalogen er per Organization og bygges som tre nivåer.

#### Nivå 1 — Norsk lovpålagt grunnpakke (16 lønnsarter)

Auto-importeres ved firma-opprettelse via seed-mekanisme (event-hook `onOrganizationCreated`, etablert i Fase 0). Ingen bransje-bias. Pålagt av norsk lov (arbeidsmiljølov, ferielov, folketrygdlov, a-melding-krav).

> **Variant B (2026-06-05) — default-lønnsart på ny rad:** `Lonnsart.erStandardvalg Boolean @default(false)`. Seed setter `true` på «Timelønn»; firma-admin kan flytte default til en annen `type="ordinaer"`-lønnsart via stjerne-knapp på `/dashbord/firma/timer/lonnsarter` (`timer.lonnsart.settStandard`, maks én per org). Mobil `TimerRadModal` forhåndsvelger lønnsart i prioritert rekkefølge: forrige rad på sedelen (Variant A) → firma-default (`erStandardvalg`) → tom. Auto-fordeling normaltid/overtid (under) er fortsatt ikke implementert — Variant B forhåndsvelger kun lønnsart, ikke timefordeling.

| Kategori | Lønnsart | Lovgrunnlag |
|---|---|---|
| Grunnlønn | Fastlønn (månedslønn) | Arbeidsmiljølov |
| Grunnlønn | Timelønn | Arbeidsmiljølov |
| Overtid | Overtid 50% | AML § 10-6 |
| Overtid | Overtid 100% | AML § 10-6 + tariff |
| Fravær | Sykemelding 1–16 dager (fastlønn) | Folketrygdloven § 8 |
| Fravær | Sykemelding 1–16 dager (timelønn) | Folketrygdloven § 8 |
| Fravær | Sykemelding fra dag 17 | Folketrygdloven § 8 |
| Fravær | Egenmelding inntil 3 dager | Folketrygdloven § 8-23 |
| Fravær | Barns sykdom | Folketrygdloven § 9-5 |
| Fravær | Ferie m/lønn | Ferieloven |
| Fravær | Ferie u/lønn | Ferieloven |
| Fravær | Permittering m/lønn | Permitteringsloven |
| Fravær | Permittering u/lønn | Permitteringsloven |
| Fravær | Bevegelig helligdag | A-melding-krav |
| Feriepenger | Feriepenger 12% | Ferieloven minimum |
| Feriepenger | Feriepenger ved avslutning (inneværende år) | Ferieloven |

#### Nivå 2 — Bransje-relevant tilleggspakke for anlegg/bygg (25 lønnsarter)

Valgfri import ved onboarding. Pakke-orientert UX: vises som «Bransje: Anlegg/bygg (25 lønnsarter)» med «Vis detaljer»-knapp som ekspanderer listen. Standard: importer hele pakken eller hopp over — ikke 25 enkeltsjekkbokser.

| Kategori | Lønnsart | Brukstilfelle |
|---|---|---|
| Permisjon | Velferdspermisjon | Bedriftsavtale eller tariff |
| Reisegodtgjørelse | Reise 7,5–15 km | Pendling kort |
| Reisegodtgjørelse | Reise 15–30 km | Pendling mellom |
| Reisegodtgjørelse | Reise 30–45 km | Pendling lang |
| Reisegodtgjørelse | Reise 45–60 km | Pendling svært lang |
| Reisegodtgjørelse | Kilometergodtgjørelse (egen bil) | Tjenestereiser |
| Reisegodtgjørelse | Reise/transport til prosjekter | Daglig pendling |
| Diett | Diett med overnatting hotell | Reise med opphold |
| Diett | Diett enkel overnatting | Hybel uten kjøkken |
| Diett | Diett med kokemulighet | Hybel med kjøkken |
| Diett | Diett uten overnatting | Dagstur |
| Diett | Nattillegg trekkfritt | Ulegitimert |
| Diett | Losji | Trekkpliktig overnatting |
| Skifttillegg | 2. skift tillegg | Toskift |
| Skifttillegg | Nattskifttillegg (00–06) | Nattarbeid |
| Skifttillegg | Helligdagsskifttillegg | Skift på helligdag |
| Spesielle | Smusstilleg | Skitne arbeidsforhold |
| Spesielle | Matpenger overtid (ved 2+ timer) | Standard ved overtid |
| Lærling | Lærlingelønn (30–75% av fagarbeider) | Lærlinger |
| Lærling | Overtid lærling 50% | Lærlinger med overtid |
| Lærling | Overtid lærling 100% | Lærlinger med overtid |
| Andre | Praksistimer | Praktikanter |
| Andre | Innleid arbeidskraft | UE-timer |
| Andre | Fakturerbar tid | Skille fra intern |
| Andre | Timer prosjektleder | PL med egen sats |

> **Reisetid vs. reise-godtgjørelse (Fase 3 § B, avvik A):** To distinkte konsepter — ikke slå sammen. **Reise-godtgjørelse** («Reise 7,5–15 km» … «45–60 km», «Kilometergodtgjørelse») er **avstands-/godtgjørelse-satser — regnskap eier satsene** og km-utmålingen. **Reisetid** er **timeført arbeidstid** på lønnsarten «Reise/transport til prosjekter» (`ordinaer`) *(⚠️ ordinær lønnsart-TYPE, men **aldri i overtidsgrunnlaget** — vedtak V1, [helhetsplan § 4b](timer-gps-helhetsplan.md), 2026-10-01)*, klassifisert mot firmaets terskel (kontor→byggeplass). Fase 3 `reiseLonnsartId` peker som standard på reisetid-arten, IKKE en km-godtgjørelse-art. Seed-artene beholdes uendret; kun denne tekst-distinksjonen er reframet (ingen rad-rename).

#### Nivå 3 — Egendefinerte

Opprettes av kunden via admin-UI ved behov. SiteDoc leverer ingen mal — kun verktøyet. Eksempler på lønnsarter som typisk hører her: kloakk-tillegg, brøyte-beredskap, firma-spesifikke skifttillegg-satser (30/40/50% utenfor standard 2-skift/natt), tariff-spesifikke satser, bransje-detaljer (bergspreng, dykker, etc.).

### Onboarding — to scenarier

Ved firma-opprettelse vises modus-velger:

**A) «Nytt firma — ingen eksisterende katalog»**
Auto-importerer Nivå 1 (16 lønnsarter). Tilbyr Nivå 2 (25 lønnsarter) som valg. Standard for nye SiteDoc-kunder.

**B) «Migrerer fra annet system»**
Tom katalog. Import-verktøy aktivert (CSV-upload eller adapter mot kjent system). Forhindrer dobbel-katalog-problem hvis kunde flytter eksisterende lønnsarter inn — ellers ville Nivå 1 + importert katalog gi duplikater.

#### Seed manglende firmamodul-katalog — 🟢 admin-verktøy (2026-08-10)

**Problem:** kun `hms-avvik` seeder automatisk ved modul-aktivering; den generiske `organisasjon.settFirmamodul` seeder ingenting. Migrasjons-firma (scenario B) som fikk lønnsart via import har derfor **0 utleggskategorier** — U3-velgerens UTLEGG-gruppe står tom. Konkret: A.Markussen (prod) har Timer aktiv + 44 importerte lønnsarter + 127 maskiner, men 0 utleggskategorier (`seedTimerForOrganization` aldri kjørt for dem).

**Løsning:** `admin.seedManglendeFirmakatalog` (`apps/api/src/routes/admin.ts`, `verifiserSiteDocAdmin`-gated, input `{organizationId}`) → `seedManglendeKatalog(orgId)` (`services/seed/index.ts`). Cross-org driftsverktøy, idempotent, rører aldri eksisterende data. Kjøres målrettet i stedet for `aktiverNivaa1` (som ville injisert 16 seed-lønnsarter — `seedLonnsartNivaa1` guarder på `seedNivaa=1`, ser ikke de importerte). Rapport per datatype: `{ expenseCategories: { opprettet, hoppet } }`.

**🔴 SCOPE (denne runden): kun `expenseCategories`** — den ene timer-datatypen med robust idempotens-guard (`seedExpenseCategories` hopper på `count(org) > 0`). Enhets-testet (`seedManglende.test.ts`: 0→5/hoppet=false, eksisterende→hoppet=true) + `seedExpenseCategories` allerede kjørt mot sitedoc_test under U3-E2E.

**Navngitte oppfølgere:**
- **Robuste seedNivaa-guarder — men premisset er tre tilstander, ikke to** (føring Kenneth 2026-08-10): lønnsart/aktivitet/tillegg guarder på `seedNivaa`, ikke «finnes rader» → ikke trygge mot import-katalog. Å bytte til «finnes rader» løser bare duplikat-halvdelen. Den fulle oppstartsrutinen må skille: (1) **aldri onboardet** → seed · (2) **onboardet** → hopp · (3) **bevisst egen katalog** (kunden bruker sine egne lønnsarter) → hopp **og ikke rapportér som ufullstendig**. `aktiverTomKatalog` (`onboarding.ts:111`) er dagens mekanisme for tilstand 3, men A.Markussen har ikke brukt den (de har `seed_nivaa=2`-rader) → tilstanden finnes i data uten at et felt uttrykker den. **Prod-tall A.Markussen (`4488fe17`, 2026-08-10):** 44 lønnsarter = 25 `seed_nivaa=2` + 19 `null` + **0 `seed_nivaa=1`**. Den tomme `seed_nivaa=1` er ØNSKET (Kenneth: «vi importerer de lønnsartene de bruker, ikke lønnsarter utledet fra diverse lover») — ikke en mangel å fylle. **Konsekvens:** `onboarding.status` rapporterer sannsynligvis Timer som ufullstendig for A.Markussen i dag selv om katalogen er korrekt; en oppstartsrutine som stoler på den statusen vil «fikse» en kunde som ikke er ødelagt. Kobling til `settFirmamodul` er den fulle rutinen — egen sak, start med dette premisset.
- **Prosjektmodul-variant:** samme klasse på prosjektnivå — 998 Instinniforbotn (prod) har HMS-avvik + SJA men mangler RUH-malen (`modul.aktiver` er alt idempotent for maler, `findFirst` på prefix → ville lagt til RUH alene). Ikke bygget; den generiske stien bør senere dekke begge nivåer (RUH haster ikke, Kenneth).

### Auto-fordeling normaltid/overtid

Når kunden bruker Nivå 1 «Timelønn» + «Overtid 50%/100%»: systemet foreslår fordeling basert på totaltimer og konfigurerbar dagsnorm (default 7,5t fra `OrganizationSetting`). Bruker kan overstyre.

Eksempel: 10t totalt → Timelønn 7,5t + Overtid 50% 2,5t. Bruker justerer til 8t + 2t hvis ønskelig.

Hvis kunden ikke har importert Nivå 1: ingen auto-fordeling, bruker velger lønnsart manuelt.

> **Status (2026-06-09):** Server-motoren er fortsatt ikke bygget. Eneste fordelings-logikk er klient-MVP i mobil `beregnDagsforslag` (`apps/mobile/src/utils/dagsforslag.ts`, ren, skilt fra skrivingen i lag 0b). **Reise-kobling:** reise-andelen føres på egen lønnsart-rad og holdes utenfor normaltid/overtid-grunnlaget.
>
> 🟢 **L1-B (branch `feat/timer-reiseetapper`, 2026-10-02 — venter merge) endrer modellen (hjemmel V1–V16):**
> - **Reise = etapper** (`beregnReiseEtapper`): ut (kontor→destinasjon) + retur (destinasjon→kontor). **Arbeidsvinduet er eneste trekkmekanisme:** `arbeidsstart = startGPS + ut`, `arbeidsslutt = sluttGPS − retur`, `arbeidstimer = arbeidsslutt − arbeidsstart − pause`. Den gamle `total − reisetid`-subtraksjonen er FJERNET (dobbelttrekk med etapper i begge ender).
> - **`reisetidTellerOvertid` leses IKKE lenger** (V1: reisetid er aldri overtid). Kolonnen deprecates; normen er alltid `dagsnorm0`.
> - **Prosjektvalg via A5** (`velgDestinasjon`, `@sitedoc/shared`): destinasjon → `aktivtProsjektId` → `prosjektUkjent`. `velgNaermesteProsjekt` + `prosjekter[0]`-fallback + `resolverPrimaerByggeplass` + `estimerReisetidMin` SLETTET.
> - **Norm = én server-utledning (B6 v3, H22):** `OrganizationSetting.normKilde` (`fast`=lovnorm/7,5-kolonnen · `kalender`=sesongutledet) + `pauseReferanse` (`ankomst`/`fastStart`). `hentEffektivArbeidstid`-servicen er eneste utledning; server-varsel + web-sedel kaller den pr. dato. Mobilen REGNER ikke normen — den cacher serverens svar pr. dato (`arbeidstid_svar_local`, lokal migrering) og leser via `hentDagsnormLokalt` (`server`/`cachet≤30d`/`null`, aldri 7,5). Ukjent norm → ingen overtid-splitt + markør (varsel + banner). Migrering `20261002130000_timer_normkilde_pausereferanse` (Prisma, backfill sommertid→kalender) — **ikke kjørt**.

> 🟢 **LAG 2-A (branch `feat/timer-l2a-sporbarhet`, 2026-10-03 — venter merge/gate; hjemmel V1/V2/K5):
> radmodellen + mottak med sporbarhet på serveren.**
> - **Radmodell (db-timer, migrering `20261003120000_timer_lag2_sporbarhet` — IKKE kjørt):** `SheetTimer`
>   får `erReise Boolean @default(false)`, `reiseRetning`, `reiseOppmotestedId` (svak FK → `oppmotesteder`),
>   `reiseKjoretidMin`, `reiseAvstandM`, `reiseKilde` (`matrise`/`manuell`/null), `reiseRegel Json?`,
>   `tidKilde` (V8), `reiseAvvik Boolean?` (tre tilstander). `DailySheet` får `normStatus` + `normSnapshot Json?`
>   (`db-timer/schema.prisma`). Backfill av `erReise` speiler dagens leser (M3: konfigurert reise-art ∪
>   grensepunkt-arter, ellers navne-match kun for firmaer uten konfigurert art) — delt regel `erReiseLonnsart`
>   (`@sitedoc/shared` `reise.ts`). DB-CHECK: `er_reise=false ⇒ reisefelt NULL`. 🔴 **`er_reise=true ⇒ retning`
>   er IKKE DB-CHECK** (backfill + overgangsrader har utledet flagg uten retning) — håndheves i mottaket (C2).
> - **🔴 Eksplisitt flagg vinner (M3):** etter lag 2 leser ingen reise fra lønnsart/regex — `erReise` er sannheten.
>   Alle 9 skrivestier i `apps/api/src/routes/timer/dagsseddel.ts` som setter `lonnsartId` utleder/skriver `erReise`
>   (`byggTimerRadData` + syncBatch + oppdater/forson/splitt/rediger); splitt arver hele sporet.
> - **Mottak med sporbarhet (K5, `reise-sporbarhet.ts`):** syncBatch deklarerer + lagrer alle felt (C1, M6-fiks);
>   C2 validerer invariantene når klienten sendte `erReise` eksplisitt; C3 KONTROLLERER matrise-rader mot
>   `ReisetidMatrise`-cellen og setter `reiseAvvik` (dobbel terskel `REISEAVVIK_MIN_PROSENT/AVSTAND_M/KJORETID_MIN`)
>   — serveren klassifiserer ALDRI om, setter ingen lønnsart.
> - **V1/V2 på serveren:** `beregnOvertidsgrunnlag` (`@sitedoc/shared` `overtidsgrunnlag.ts`) ekskluderer
>   reise-rader HELT (`OvertidRad.erReise`); `totaltimer` deles i `arbeidstimer`/`reisetimer` i firma-attesteringen.
>   `reisetidTellerOvertid`-avkrysningen er fjernet fra firma-innstillinger (web); api beholder kolonne +
>   select/skriv men ignorerer verdien (to-stegs, droppes senere); i18n-nøkkelen `reise.tellerOvertid` slettet.

> 🟢 **LAG 2-B (branch `feat/timer-l2b-mobil-spor`, 2026-10-03 — venter merge/gate; hjemmel V8/K5/V2):
> mobilen SKRIVER sporet + V8-vinduet.** Forutsetter L2-A merget (feltene i `syncBatch` FØR telefonen sender,
> M6). **Reload: OTA.**
> - **B1 — raden bærer etappen:** `beregnDagsforslag` (`dagsforslag.ts`) reduserer ikke lenger etappen til
>   `{ kjoretidMin, lonnsartId }`; `reiseForRetning` returnerer hele sporet (retning, oppmøtested, byggeplass,
>   avstand, `reiseRegel`-snapshot via delt `grensepunktTraff`), og `anvendDagsforslag` (`dagsforslagAnvend.ts`)
>   skriver `erReise`/`reiseRetning`/`reiseOppmotestedId`/`byggeplassId` (M1 — nå faktisk skrevet)/
>   `reiseKjoretidMin`/`reiseAvstandM`/`reiseKilde:"matrise"`/`reiseRegel` (JSON)/`tidKilde` på `sheet_timer_local`.
> - **B2 V8 — klokkevindu på reise-rader:** REISE-UNNTAKET (null-tider) er REVERSERT. `ut`: `fraTid=segment-start`,
>   `tilTid=start+kjøretid`; `retur`: `fraTid=slutt−kjøretid`, `tilTid=segment-slutt`; `tidKilde="utledet"`
>   (vinduet SER målt ut, er UTLEDET). Vinduene berører arbeidsvinduet i endepunktene uten å overlappe
>   (`tidsromOverlapper` streng). **B3:** Dag A (ut/ordinær/OT50/retur) passerer serverens delte
>   `finnTidsromKonflikt` (`@sitedoc/shared` — uendret siden SYNC-2 `a711ad7b`, i prod → gammel server avviser
>   ikke synken; de nye feltene stripper Zod stille på gammel server).
> - **B4 (valg A, TILLEGG 2):** manuelt lagt til/endret rad får `tidKilde="manuell"` (endret tid på en
>   `utledet` rad → `manuell` kun når fra/til FAKTISK endres). `erReise` settes EKSPLISITT fra lønnsarten via
>   delt `erReiseLonnsartLokalt` → `erReiseLonnsart` (`@sitedoc/shared`, samme regel som serverens
>   `utledErReise`); en manuell reise-rad får `erReise=true`+`reiseKilde="manuell"`, `reiseRetning=null`,
>   avstand/kjøretid/regel `null`. Redigeres en matrise-rad: matrise-sporet bevares; byttes lønnsarten til en
>   ikke-reise-art renses reise-sporet (C2: `false ⇒ spor null`). 🔴 **C2 slakket (server):** retning (+ matrise-
>   tallene) kreves KUN for `reiseKilde="matrise"` — *retningen er informasjon, ikke lønn; lønnsarten avgjør*
>   (fabel-vedtak, spec § 3 B4/§ 4 C2 `d9587bbe`). Alternativ C (ikke sende `erReise`, la server utlede) er
>   forbudt — raden ville løyet om kilden.
> - **B5:** `normStatus` + `normSnapshot` (fra svar-cachen, `arbeidstidSvarKatalog.hentetAt` eksponert) skrives på
>   `dagsseddel_local` ved auto-generering og synkes opp (`timerSync` push). Pull oppdaterer sedelen in-place →
>   normsporet overlever (til forskjell fra rader, som delete+reinsertes).
> - **B6:** visningen (`TimerSeksjon`) leser `erReise` via delt `erReiseRadVisning` — fallback til lønnsart-match
>   KUN for rader uten flagg (eldre lokale + server-pull før `hentEndringerSiden` returnerer `erReise`).
> - **C5 (mobil):** `reisetidTellerOvertid` ut av `DagsforslagRegel` + `organizationSettingLocal`-Drizzle-feltet
>   + `organizationSettingKatalog`/`StartSluttDagKort`. SQLite-KOLONNEN står (to-stegs, ikke DROP).
> - **Lokal migrering (`migreringer.ts`):** idempotente `ALTER` for spor-kolonnene på `sheet_timer_local` +
>   norm-kolonnene på `dagsseddel_local` (ingen backfill — eldre rader står null, ærlig).
> - **Pull bærer sporet (TILLEGG 1 — lukket i branch):** `hentEndringerSiden` (server) returnerer nå
>   `erReise`/`reiseRetning`/`reiseOppmotestedId`/`reiseKjoretidMin`/`reiseAvstandM`/`reiseKilde`/`reiseRegel`/
>   `tidKilde`/`reiseAvvik` på timeradene + `normStatus`/`normSnapshot` på sedelen. Mobilens pull snapshotter
>   lokalt spor FØR rad-erstatningen og skriver server-verdien når feltet FINNES i svaret, ellers BEVARER det
>   lokale (mangler ≠ null → gammel server/prod nuller ikke sporet). Uten dette ville rad-replace (delete+
>   reinsert) slettet K5-sporet telefonen skrev, og neste push erstattet serverraden uten spor. Testet
>   ende-til-ende i sql.js (`timerSync-lag2-spor.test.ts`: ny-server-ekko · gammel-server-bevaring · full
>   push→pull→endre→push). 🔴 **Server-endringen rører KUN `hentEndringerSiden`** (ikke attestering → ingen
>   L2-C-kollisjon). Migreringen `20261003120000_timer_lag2_sporbarhet` MÅ være kjørt før serveren deployes
>   (query leser de nye kolonnene).

> 🟢 **LAG 2-C (branch `feat/timer-l2c-attestering-eksport`, 2026-10-03 — venter merge/gate; hjemmel K5/V8):
> attestanten og regnskapet ser reise-sporet.**
> - **D1 Attestering (web):** reise-rader får merke «Reise ut/retur» + rute-linje «Kontor → Byggeplass · km ·
>   min · kilde» + tidskilde-merke (`utledet` → «tid utledet fra matrise») i `SeddelKort` og `TimerRaderLeder`
>   (delt komponent `ReiseRadMerke.tsx`). Gammel backfill-rad uten etappe (reiseKilde=null, ingen km/min) viser
>   ærlig «reise (kilde ukjent)» — aldri tomme «— km». `reiseAvvik === true` gir varsel; `null` viser ingenting.
>   `normStatus ∈ {cachet, ukjent}` gir sedel-banner («Norm fra siste kjente svar» / «Norm ukjent — overtid ikke
>   fordelt»); `null` (gammel sedel) gir ingenting. «(inkl. reise)» erstattet av arbeid/reise-splitt fra
>   `arbeidstimer`/`reisetimer` (V1). `rad.beskrivelse` vises nå på attestant-raden (M7-fiks). **Arbeidstid-varselets
>   TRIGGER er bevisst uendret (total tilstedeværelse = «lang dag») — kun presentasjonen deles opp.**
> - **D2 Eksport:** nye detalj-kolonner `reise`/`retning`/`fraSted`/`tilSted`/`avstandKm`/`kjoretidMin`/`reiseKilde`/
>   `tidKilde`/`normStatus` + `lonnsartType`/`satsEnhet` i `TIMER_KOL_KEYS` (`@sitedoc/shared timerDetaljRader.ts`);
>   api `rapport.ts` resolver fra/til-sted fra `reiseOppmotestedId`+`byggeplassId` mot retningen (kjerne-klienten,
>   svak FK). Kolonnene vises dynamisk KUN når de bærer data → en ren arbeidsliste er uendret. Proveniens
>   (reiseKilde/tidKilde/normStatus) strippes for ekstern mottaker (byggherre). Arknavn/overskrifter via `t()`.
> - **D3:** `attestertSnapshot.prisMotKunde`-påstanden i eksport-docen rettet (M9 — leses kun i attestering).

#### Overtid-klassifisering — strukturert felt + isolert regel (③, 2026-07-05)

**`Lonnsart.overtidsnivaa Int?`** (db-timer, nullable): `null` = ikke overtid, `50`/`100` = tier. Erstatter fritekst-navne-match. Firma-admin setter feltet i web lønnsart-UI («Overtidsnivå»-select, kun for `type="ordinaer"`).

**⭐ Regelen er isolert i `@sitedoc/shared` [lonnsregel.ts](../../packages/shared/src/utils/lonnsregel.ts)** — ALL «hvilken tid er overtid, hvilket nivå»-logikk bor der, ikke i `StartSluttDagKort`:
- `klassifiserArbeidstid({ arbeidstimer, dagsnorm })` → segment-liste `[{overtidsnivaa: null, timer}, {overtidsnivaa: 50, timer}]`. Nivå 0-regel: alt over norm → 50 %. Bytt KUN denne kroppen for Nivå 1-2 (se [BACKLOG § Lønnsregel-konfig](BACKLOG.md)) — retur-kontrakten holder call-sites uendret.
- `velgOvertidLonnsart(lonnsarter, nivaa)` → laveste-`rekkefolge` aktiv `type="ordinaer"` med matchende `overtidsnivaa`. **Aldri fritekst-navn.** Null ved ingen treff → banner, aldri feil-match.

**Payroll-prinsipp:** lærling-varianter beholdes `overtidsnivaa=null` (backfill) → aldri auto-valgt for normal arbeider. Backfill setter kun eksakte seed-navn (`Overtid 50%`→50, `Overtid 100%`→100, seedNivaa=1); kunde-importerte (f.eks. A.Markussens 170/172/175/177) settes manuelt i admin-UI.

**③b — «garantert» standard-lønnsart:** migreringen `20260705120000_lonnsart_overtidsnivaa` (Steg 2) backfiller `erStandardvalg` for orgs med ≥1 ordinær men ingen standard (foretrekk `Timelønn` seedNivaa=1, ellers laveste-`rekkefolge` aktiv `type="ordinaer"`). ⚠️ **Fallbacken garanterer at feltet er *satt*, ikke at det er *riktig*** — den velger posisjon (laveste `rekkefolge`), ikke betydning. `type="ordinaer"` er en restkategori (km, reise, skifttillegg, smusstillegg, matpenger), så fallbacken kan velge f.eks. kilometergodtgjørelse som auto-lønnsart for arbeidstimer — det skjedde for A.Markussen i prod 2026-07-09. Egentlig fiks: semantisk felt på `Lonnsart` (som `overtidsnivaa`), se [BACKLOG § standard-lønnsart plasseres deterministisk feil](BACKLOG.md). Auto-gen gjetter aldri — normaltid-raden får firmaets `erStandardvalg`-lønnsart. Fallback-bannere i mobil `[id].tsx`: rød «Mangler standard-lønnsart» (null ordinære), amber «Overtid ikke ført» (dag nådde norm men ingen overtid-lønnsart) — aldri stille drop. **Bannerprioritet:** rød «ikke ansatt» (`timer.ikkeAnsatt`, når `useFirma().erAnsattIFirma(sedel.organizationId) === false`) skjuler (d)- og amber-banneret — lønnsart-konfig er ikke problemet da; ukjent status (`null`) viser bannerne som før.

### Aktivitet-katalog (datadrevet, tre-nivå)

Aktivitet er en separat dimensjon for kostnadsføring (per ProAdm) — ikke det samme som lønnsart, ikke det samme som ECO. Brukes for å skille hovedarbeid fra garantiarbeid, ekstraarbeid, regulering osv. innenfor samme prosjekt.

**Nivå 1:** Ingen — aktivitet er ikke lovpålagt

**Nivå 2 (anlegg/bygg-pakke, valgfri):**
- Anleggsarbeid
- Maskintimer
- Garanti/reklamasjon

**Nivå 3 (kundens egne):**
Eksempler: Ekstra arbeid, Regulering lønn, kunde-spesifikke aktivitetskategorier.

### Tillegg (datadrevet katalog, tre-nivå)

Tillegg-katalogen er per Organization, samme tre-nivå-prinsipp som lønnsart. Skiller seg fra lønnsart ved at tillegg ikke regnes som arbeidstid — de er separate poster på dagsseddelen.

**Nivå 1:** Ingen — tillegg er ikke lovpålagt

**Nivå 2 (anlegg/bygg-pakke, valgfri):**
- Overtidsmat (avhuking, fast sats)
- Smusstilleg (avhuking)
- Beredskap-vakt (avhuking)

**Nivå 3 (kundens egne):**
Eksempler: Skifttillegg 30/40/50% (firma-spesifikk sats), Brøyte-beredskap, Kloakk-tillegg, tariff-spesifikke vakt-tillegg.

### Felt-typer på tillegg

| Type | Beskrivelse | Eksempel |
|---|---|---|
| `avhuking` | Fast sats, antall=1 ved avhuking | Overtidsmat, Smusstilleg |
| `antall` | Bruker oppgir antall | Henger-tillegg (antall ganger) |

Reisetid ligger ikke som tillegg — det er en lønnsart i Nivå 2 («Reise/transport til prosjekter»). Betales som arbeidstid (egen sats), men inngår ikke i normaltid/overtid-fordeling.

### Tilleggsregler (automatisering)

Admin setter opp regler per Organization. Reglene genererer **forslag** — brukeren kan alltid overstyre. Reglene refererer til konkrete lønnsart- eller tillegg-IDer i kundens katalog (datadrevet, ikke hardkodet).

| Regel | Utløser | Effekt | Konfigurasjon |
|-------|---------|--------|---------------|
| **Overtidsmat-forslag** | Arbeidstimer > terskel (default 9t) | Foreslår avhuking av angitt tillegg | `OrganizationSetting.overtidsmatTerskel` + `regel.tilleggId` |
| **Nattskift-forslag** | Klokkeslett mellom kl 21–06 (krever `startAt`/`endAt`) | Foreslår angitt skift-lønnsart | `regel.lonnsartId` |
| **Helgetillegg-forslag** | Dato er lørdag/søndag | Foreslår avhuking av angitt tillegg | `regel.tilleggId` |
| **Reisetid** | — | Aldri automatisk, alltid manuelt | Egen lønnsart-rad på dagsseddel |

Hvis kunden ikke har konfigurert regelen (eller ikke har importert tilhørende lønnsart/tillegg): regelen er inaktiv. Ingen feilmelding.

### Dagsseddel-flyt (mobil)

> **Modell-merknad (T.1/T.7, deployet prod 2026-05-12):** Dagsseddelen er **én per (bruker, dag)** og eies av arbeider/firma, ikke prosjekt. **Prosjekt ligger per rad** (`SheetTimer.projectId`), ikke som sedel-header. UI grupperes prosjekt → ECO (T.7): hver prosjektgruppe har egne timer-/maskin-rader. Skissen under er oppdatert til denne modellen (var pre-T.1 frem til 2026-06-21).

Konvolutt (sedel-nivå) + rader (per prosjekt/ECO):

```
SEDEL-NIVÅ (konvolutt):
  Dato            → normaldag fra OrganizationSetting
  Arbeidstid      → Fra/Til + Pause (StartSluttDagKort / ArbeidstidSeksjon).
                    Klokkeslett obligatorisk hvis nattskift-tillegg krysses
                    (juridisk krav).
  Beskrivelse     → valgfri dag-kommentar (DailySheet.beskrivelse)

PER PROSJEKTGRUPPE (T.7) — «+ Legg til prosjekt» åpner ny gruppe:
  Prosjekt        → ProsjektVelger (per gruppe = ett hovedprosjekt)
  Underprosjekt   → valgfri ECO-velger per rad (endring/varsel/regningsarbeid)
  Timer-rad(er)   → (lønnsart, aktivitet, timer, fra/til, ECO, fritekst).
                    «Legg til timer-rad» legger til flere rader i gruppen.
  Maskin-rad(er)  → nestet under gruppen — fra maskinregister, timer + valgfri
                    mengde/enhet. Soft-skjules når Equipment-cache er tom.

Tillegg          → automatiske forslag fra regler + manuelle
Utlegg           → kategori + beløp + valgfritt kvitteringsbilde
[Lagre utkast]   [Send til leder]
```

**Selv-attestering:** Den gamle planen (arbeideren velger «Selv-attester» eller «Send til leder») ble ikke bygd. `tillattSelvAttestering` betyr fra w7 om en attestant kan attestere sine **egne** timer — se «Web-timeføring w7» under.

### Pause-bevisst tid-synk på timer-rader (mobil) — implementert 2026-07-08 (develop `f385ba99`)

Utility: `@sitedoc/shared/utils/pauseBeregning.ts` (delt mobil + web; mobil-kopien slettet i M2 2026-07-10). Brukes av `TimerRadModal` (`TimerSeksjon.tsx`).

**Auto-synk «antall timer» ↔ «fra/til» (sist-rørte felt vinner):**
- Endrer fra/til → `antall = effektiveTimerFraSpenn(...)` (spennvidde − pauseoverlapp).
- Skriver antall → `til = tilFraAntall(fra, antall, ...)` (pausevinduet skjøvet inn når arbeidet krysser lunsj).
- **Konsistens-validering** ved lagring: når begge tider er satt MÅ antall stemme med (spenn − pause), ellers blokkeres lagring (`timer.feil.timerAvvik`). Fjerner tidligere «stille avvik»-bug.

**Pausevindu — skiftrelativt (erstatter fast klokkeslett):** `pauseVinduFra(skiftStart, standardPauseEtterTimer)`. Feltet **`OrganizationSetting.standardPauseEtterTimer`** (Float, default 4,0 t) erstattet `standardPauseFra` (to-stegs migrering, gammelt felt beholdt — migrering `20260708120000_...`). 07:00-start → pausevindu 11:00–11:30 (ingen regresjon); nattskift 21:00-start → 01:00–01:30. Varighet fra `standardPauseMin` (30). En rad som spenner over vinduet får overlappen trukket fra (10:00–12:00 → 1,50 t), vist som «−30 min lunsjpause trukket fra».

**Skille mot `pauseMin`:** dette er en **rad-nivå** fradragsvisning i modalen. `pauseMin` forblir **sedel-nivå** (maskin ≤ arbeid-buffer for eldre rader uten jobb, w9) — de to lever side om side.

**5,5t-terskel (AML §10-9) — når pausen i det hele tatt gjelder:** `PAUSE_TERSKEL_TIMER = 5.5` i `pauseBeregning.ts`. `pauseMinForDag(dagsTotalBruttoTimer, standardPauseMin)` returnerer `standardPauseMin` KUN når dagens totale brutto arbeidstid > 5,5 t, ellers 0. Gaten er **dagstotal-basert, ikke per rad** (en dag splittet i flere rader skal verken miste eller få pause av rad-splitten). Ligger i `fordelArbeidstidFradrag` (`apps/mobile/src/utils/dagsforslag.ts`, LAG 0b-splitt) der dagstotalen finnes. To ortogonale regler: **hvor** pausen faller (4,0t-vinduet) vs. **om** den gjelder (5,5t-terskelen).

**Web-speiling:** attestering (`RedigerRadModal.tsx`) og firma-innstillinger (`firma/innstillinger/page.tsx`) bruker samme skiftrelative modell.

### F5 — matpause-bærer per timer-rad (mobil) — ⚠️ WIP branch `fix/timer-mobil-f2f3f5` (cowork-gate pending, ikke deployet)

Additivt felt **`SheetTimer.pauseMin` / `sheet_timer_local.pauseMin`** (Int NOT NULL DEFAULT 0): minutter lunsjpause DENNE raden trekker. Kun ÉN rad per sedel bærer pausen (`pauseMin > 0`); kun-én-per-dag håndheves som **flytt**, ikke radio. Bæreren settes ved generering = **lunsj-kryssende carve-rad** (Valg A, gate-endorsert 2026-07-14; respekterer «ikke rør carve» — carve legger pausen på ett vindu, den raden får `pauseMin`). Rad-timer holdes konsistent: `rad.timer = effektiveTimerFraSpenn(fra, til, pauseFra, rad.pauseMin)` (deployert modell, gjenbrukt).

- **UI** (`TimerSeksjon.tsx` `TimerRadVis`): kompakt checkbox «Matpause trukket (30 min)» nederst på rad-kortet, kun synlig når regelen trigger (dagsbrutto > 5,5t) OG raden krysser lunsjvinduet. Bæreren avhuket; andre kvalifiserte rader viser tom checkbox.
- **Flytt-interaksjon** (`services/matpause.ts`, orkestrert i `timer/[id].tsx`): huk PÅ annen rad → sett bærer der (forrige nulles stille); huk AV bæreren → flytt til neste kvalifiserte rad (lengste-først) + toast; ingen kvalifisert → **ekte bekreftelsesmodal** «Ingen pause trekkes for dagen» (AML-varsel, ikke `confirm`/`Alert`).
- **Kryss-modul-invariant (bevarer maskin-kapasitetsregelen):** ved HVER endring settes `dagsseddel_local.pauseMin = Σ(sheet_timer_local.pauseMin)` i samme lokale tx. Maskin-regelen (`maskinKapasitet.ts`) bruker **sedel-nivå** pauseMin bare for eldre rader uten jobb (w9) — **`sheet_machines` får INGEN pauseMin** (maskin går gjennom operatørens pause; paritet ville vært semantisk feil). Modul-avhengighet verifisert 2026-07-14 mot [dagsseddel-design.md](dagsseddel-design.md) + [maskin.md](maskin.md).
- **Sync:** `pauseMin` per timer-rad i `syncBatch` begge veier (samme utvidelse som F3 byggeplassId). Server-kolonne `sheet_timer.pause_min` — migrering `20260714120000_sheet_timer_pause_min` **FORBEREDT, ikke kjørt** (Kenneths go; backfill-disiplin gates av cowork).

### V20 — én kilde for pause (leveranse S, server+shared) — `feat/v20-s-pause-server` 2026-10-06

🟢 **Kenneth-vedtak 2026-10-06: V20 = B.** Radens `SheetTimer.pauseMin` er KILDEN for matpausen;
avkrysningen viser tilstanden (også for manuell føring). Hodet `DailySheet.pauseMin` er nå en
**utledet** verdi (Σ aktive rad.pauseMin), ikke lenger et klient-skrevet felt. Spec:
[timer-pause-en-kilde-spec.md](timer-pause-en-kilde-spec.md) (GATET rev. 2). **Dette opphever,
for SERVER-laget, de to påstandene over/under om at `pauseMin` er sedel-nivå (P1/P3-rotet) og at
`effektiveTimerFraSpenn` har 0 treff i `apps/api` (B2 ikke håndhevet).** M (mobil) gjenstår; **W (web) implementert** (`feat/v20-w-pause-web`, se under).

- **PK5 `pauseVinduForDag(rader, {startTid, pauseEtterTimer, pauseReferanse})`** (`@sitedoc/shared/utils/pauseBeregning.ts`): ÉN pausevindu-kilde. `fastStart` → firmaets starttid + `pauseEtterTimer`; `ankomst` → tidligste rad-`fraTid` + `pauseEtterTimer` (Kenneths «4 timer» = `pauseEtterTimer`). Server henter parametrene fra `hentEffektivArbeidstid`.
- **PK4 server-vakt (`vurderRadTimer`, `dagsseddel.ts`) — to modi:** *interaktiv* (`tilfoyTimerRad`/`oppdaterTimerRad`/`redigerSedelRader`/`forsonDagskort`): oppgir en NY klient `pauseMin` og `timer` ikke stemmer med `effektiveTimerFraSpenn(fra,til,vindu,pauseMin)` (tol. 0,01) → **avvis** (`timer.feil.timerAvvik`). En GAMMEL klient (pause ikke oppgitt) normaliseres som i synk (ingen avvises for en app de ikke har oppdatert). *synk* (`syncBatch`): **ALDRI avvis** — (1) oppgitt pause konsistent → behold; (2) skjult fradrag (timer stemmer med `standardPauseMin` OG vinduet krysser raden) → sett bæreren hvis ingen annen bærer, ellers skriv uendret + tell; (3) stemmer med ingen → skriv uendret + `console.warn('[timer_avvik_sync]')`. Kun timebaserte lønnsarter (`satsEnhet ∈ {per_time, null}`). Rører ALDRI `timer`.
- **PK6 `synkroniserHodePause(tx, sheetId)`:** etter HVER radskriving settes `DailySheet.pauseMin = Σ aktive rad.pauseMin` (ekskl. `erstattet`) i samme tx (+ bumper `updatedAt`). Kalt fra alle radskrivere + sletting + `syncBatch` + `opprettForsteTimerRadForslag`. `syncBatch`/`redigerSedelRader` IGNORERER payloadens hode-pause. Maskinvakten (w9) bruker pausen bare for eldre rader uten jobb, og leser den fra sedelen i transaksjonen (`lesMaskinJobbTilstand`).
- **PK9 `opprettForsteTimerRadForslag`:** auto-første-rad henter pausen fra NORMEN (`hentEffektivArbeidstid.pauseMin`) og skriver den PÅ raden som bærer når regelen trigger (dagsbrutto > 5,5 t OG raden krysser vinduet) — ikke lenger skjult i timetallet.
- **PK8 backfill** `20261006220000_v20_pause_backfill` (additiv, idempotent): attribuerer bæreren på eksisterende sedler der hodet bærer pause men ingen rad gjør det (web-rader + mobile manuelle rader med skjult fradrag). Bærer settes BARE der timetallet beviser fradraget (overlapp>0 + match); uavklarte røres ikke (telt). Endrer ALDRI `rad.timer`. Kjørt lokalt 2× (idempotent). 🔴 Kjøres av Kenneth mot `sitedoc_test` så `sitedoc`; tellings-SQL leveres separat.
- **PK8 backfill S2** `20261007120000_v20_s2_pause_backfill` (additiv, idempotent): oppfølger der HODET ER 0. S tok bare kandidater med `hode > 0` og brukte hodet som pausebeløp — Kenneths 05.10-sedel (hode 0, rad 07–16 8,50 t, avkrysning tom) ble stående. S2: kandidat = sedel med Σ `rad.pauseMin` = 0 **uansett hode**, pausebeløp = firmaets `standardPauseMin` (ikke hodet); samme bevis (overlapp>0 + `|timer − (spenn−overlapp)/60| ≤ 0,01`), tidligste `fraTid` ved flere. Setter bæreren og deretter **hodet = Σ rad** (PK6) i samme migrering. Endrer ALDRI `rad.timer`; uavklarte røres ikke (telt). Bundet av `apps/api/src/routes/v20-s2-backfill.integration.test.ts` (kjører migreringens DO-blokk fra disk, rød→grønn + 2× idempotens). 🔴 Kjøres av Kenneth mot `sitedoc_test` så `sitedoc`; tellings-SQL `relay/v20-telling.sql § C`.
- **PK7-utledning (shared):** `utledArbeidstidFraRader(rader)` → `{startTid, sluttTid, sumPauseMin, nettoTimer}` for «Arbeidstid i dag» som visning (konsumeres av M/W).
- **PK2-regel (shared):** `avgjorRadPauseMin({alleRader, radId, fraTid, tilTid, pauseFra, standardPauseMin})` er LØFTET fra mobilens `matpause.ts` til `@sitedoc/shared/utils/pauseBeregning.ts` (web + mobil deler ÉN regel; `matpause.ts` re-eksporterer, ingen atferdsendring). Returnerer `standardPauseMin` når regelen trigger (dagsbrutto > 5,5 t), raden krysser vinduet, og ingen annen rad alt bærer — ellers 0.

**V20 leveranse W (web) — `feat/v20-w-pause-web` 2026-10-07.** Arbeiderens web-dagsseddel (`dashbord/timer/[id]/page.tsx`):
- **PK3 avkrysning i `TimerRadDialog`:** «Matpause trukket ({{min}} min)» (delt nøkkel `timer.matpause.trukket`/`trukketUmerket` med mobil). Vises når dagsregelen trigger (dagsbrutto inkl. denne raden > 5,5 t) OG raden er lengre enn pausen (ORDRE 13.11: klokkevinduet er ikke lenger et krav) — samme synlighetsregel som mobilens `visPauseRad`. Ny rad får bæreren automatisk via delt `avgjorRadPauseMin` (PK2). Dialogen sender `pauseMin` på raden i `tilfoyTimerRad`/`oppdaterTimerRad`. Kun-én-pr.-dag: avkrysningen er deaktivert når en annen rad alt bærer (`timer.matpause.annenRadBaerer`) — web redigerer én rad av gangen, så bæreren flyttes ved å fjerne krysset der først.
- **PK1 formel med radens pause:** `effektiveTimerFraSpenn`/`tilFraAntall` i rad-dialogen bruker `radPauseMin` (avkrysningens 0/`standardPauseMin`), aldri `sheet.pauseMin` eller firma-default. **Dette opphever § Pause-kilde-notatet under for TIMER-radene på web** (maskin-dialogen bruker fortsatt `standardPauseMin` — maskin følger førerens økt). Grep-vakt: `apps/web/src/__tests__/timer-pause-en-kilde-vakt.test.ts` (test 12).
- **PK5 pausevindu:** rad-dialogen bruker delt `pauseVinduForDag` med `pauseReferanse` fra `hentEffektivArbeidstid` (samme kilde som serveren) — `ankomst`-firmaer regner vinduet fra tidligste rad-fraTid, ikke lenger alltid fastStart. Må matche serveren ellers avviser den interaktive PK4-vakten.
- **PK7 «Arbeidstid i dag» = visning:** detalj-hodet utledes av radene (`utledArbeidstidFraRader`): finnes rader med tid → første fraTid – siste tilTid · Σ pause, tekst «Utledet av radene under» (`timer.arbeidstidUtledet`); ellers rammen (`startAt/endAt`). Pause-feltet er fjernet fra «Rediger»-hode-dialogen (start/slutt beholdt); den sender ikke lenger `pauseMin` (hodet utledes, PK6). «Brukes for å beregne overtid» fjernet fra `timer.arbeidstidIDagBeskrivelse` (usann). Grep-vakt test 5.
- **Rad-lista** viser kryss/tom avkrysning pr. rad (les-visning), også for rader ført på mobil.
- **TILLEGG 2 — skrivebeskyttet avkrysning i attesteringsvisningen:** leder/attestant så ikke at pausen var trukket (Kenneth 06.10). Ny `MatpauseRadMerke` (`apps/web/src/components/attestering/`) rendrer «Matpause trukket ({{min}} min)» read-only på bæreren (`rad.pauseMin > 0`) i både `EcoBucketAttest` (attesteringsdetalj) og `SeddelKort` (listekort) — samme mønster som `ReiseRadMerke`. Rendrer kun bæreren (ikke tom avkrysning): attestantflaten mangler dagens pausevindu-kontekst, så en tom boks ville vært gjetning (stille-tomhet). `pauseMin` ligger alt i payloaden (`hentForAttestering`/`hentTilAttesteringFirma` uten `select`). Render-vakt: `apps/web/src/components/attestering/__tests__/matpause-rad-merke.test.tsx`.

**V20 leveranse M (mobil) — `feat/v20-m-pause-mobil` 2026-10-07.** OTA; PK2 (auto-bærer) kom alt via `fix/matpause-avkrysning`:
- **PK1:** rad-modalen (`TimerSeksjon.tsx` `TimerRadModal`) regner timetallet med radens egen pause (`radPauseMinFor`/`radPauseMin`) i alle `effektiveTimerFraSpenn`/`tilFraAntall`-kall — aldri den lokale firma-default `pauseMin`. Grep-vakt `apps/mobile/src/components/timer-detalj/timer-pause-en-kilde-vakt.test.ts` (tåler etterstilt komma i flerlinje-kall).
- **PK5:** `matpauseKontekst` (`matpause.ts`) bruker delt `pauseVinduForDag` med `pauseReferanse` fra `hentDagsnormLokalt` (svar-cachen). «Ankomst» regner vinduet fra dagens tidligste rad-`fraTid`, ikke lenger alltid fastStart (P6). `rader` sendes inn fra display, modal og de tre mutasjonsfunksjonene. Mangler cachet norm → fastStart-fallback (uendret). `pauseVinduFra` fjernet fra `TimerSeksjon`. Test 6 i `matpause.test.ts` (seedet ankomst-norm → 08:00+4t=12:00, ikke 11:00).
- **PK7:** `ArbeidstidSeksjon` viser «Arbeidstid i dag» utledet av radene (`utledArbeidstidFraRader`) med tekst «Utledet av radene under» når rader med tid finnes; ellers rammen (`startAt/endAt/pauseMin`). Pause-feltet fjernet fra Rediger-modalen — hodet `pauseMin` skrives ikke lokalt utover Σ-speilet (`skrivPauseTilstand`); hodet kommer fra serveren ved pull.
- **Låst visning (Kenneth 2026-10-07):** på sendt/attestert/låst sedel vises bæreren skrivebeskyttet i rad-lista (`TimerRadVis`, ikke-interaktiv `CheckSquare`), og i mobil attesteringsvisning (`AttesteringDetaljMobil`, bæreren som `undertekst`).

### V21 — overtidsforslag ved manuell føring — `feat/v21-overtidsforslag` 2026-11-12

> 🟡 `fix/kort-a-overtid-dagskort` (ORDRE 27b, 2026-11-16, ikke merget) **Overtid måles mot dagens registrerte tid, også ved manuell føring (Kenneth 2026-11-16, ORDRE 27/27b, spec `prosjektkort-kortid-spec.md` § 6 L1–L4, L7):** *«koden må måle på lik linje med gps … har det vært registrert 7,5 timer en dag → da er ordinær tid oppbrukt → men den ansatte skal kunne overstyre og skrive ordinære timer dersom dette er spesielt avtalt med sjefen.»* Et manuelt kort («+»/«+ Nytt prosjektkort») og GPS-dagen i Bekreft dag regner sin tid mot resten av normen. 🟡 `fix/kort-a2-norm-shared` (ORDRE (29) a2, 2026-11-16, ikke merget): regelen bor i `klassifiserArbeidstid` (`packages/shared/src/utils/lonnsregel.ts`, valgfritt inndata `bruktAvNorm`; utelatt = som før, så alle andre kallere er uendret), og grunnlaget summeres med `bruktAvNorm(rader)` i samme fil. `lesEksisterendeSedel` (`apps/mobile/src/services/dagsforslagInput.ts`) leser grunnlaget for begge flatene (L4): alt arbeid som alt står på datoens sedel — alle kort, også overtidsrader; reise (`erReiseRadVisning`) og fravær (B8) teller aldri, og `erstattet`-rader når aldri mobilen. Summen står i `eksisterendeSedelPerDato[dato].bruktAvNorm`, og `beregnSegment` (`apps/mobile/src/utils/dagsforslag.ts`) deler med `klassifiserArbeidstid`: normaltid opp til resten, deretter Overtid 50 %. Rest 0 → alt overtid; ukjent norm → ingen splitt og `normStatus 'ukjent'` som før — to ulike grener. Eksisterende rader røres ikke ved lagring (L5). Mobilens egen kopi (`overtidMotDognet.ts`) er slettet. RETUR (29) A1: rader som ligger *inne i* kortets arbeidsvindu er alt med i kortets arbeidstimer (play-radene viker for dem, 1b), så `beregnSegment` trekker den overlappende delen fra (`bruktAvNormUtenforVindu`, `dagsforslag.ts`; radens andel står i `eksisterendeRader[].normTimer`) — ellers ble de telt to ganger mot normen. Eks. norm 7,5, pause 30: manuell 07–09 + GPS 07–18 → 7,5 normal (07–15, viker for 07–09) + 3 t overtid 15–18, ikke 5 t overtid fra 12:30. Gjelder manuelt kort likt. At normallinja viker helt ved overlapp er eldre atferd og uendret. Arbeideren overstyrer til ordinær ved å trykke det blå nivået (V5a, se Bekreft dag). Tester: `lonnsregel.test.ts` (shared, T1), `manuellDag.test.ts` («ORDRE (27b)» + «a2 T2 GPS» + «RETUR (29) A1»: hel og delvis overlapp med GPS-vinduet, manuelt kort oppå rad, uten overlapp uendret; GPS-økt 17–18 på Kenneths dag → overtid, rader uendret etter lagring; delvis norm; reise; fravær; samme `bruktAvNorm` for GPS og manuell; Kenneths dag 17–18/18–19 → overtid 4,0, normal 7,5, sum 11,5; delvis norm 1,5 + 1; reise; ingen registrert tid; ukjent norm; negativkontroll).

⚠️ **Venter Kontrollør-gate.** Spec: [timer-pause-en-kilde-spec.md § 8](timer-pause-en-kilde-spec.md). Når manuelle rader (eller dagens sum) passerer firmaets dagsnorm, viser rad-dialogen **én linje med én knapp**. Ingenting skrives automatisk.

- **Regelen er én ren funksjon:** `foreslaOvertidSplitt` ([overtidForslag.ts](../../packages/shared/src/utils/overtidForslag.ts)). Radene tas kronologisk på `fraTid`; normaltid fylles før overtid. Reise er aldri overtid og teller ikke mot normen (V1). Nivå og lønnsart kommer fra `klassifiserArbeidstid` + `velgOvertidLonnsart` (strukturert `overtidsnivaa`). Uten dagsnorm eller uten overtid-lønnsart → ingen linje. Rader som alt står på overtid får ikke forslag og fyller ikke normen — forslaget gjelder bare `sum − norm − alt ført som overtid` (🟡 `fix/kort-a2-norm-shared`, ORDRE (29) a2, spec B3/F-L1, ikke merget; før ga 05–07 overtid + 07–16 normal, norm 7,5, forslag om 3 t overtid i stedet for 1 t). Vakt: `overtidForslag.test.ts` («B3/F-L1»).
- **Raden som krysser normen deles** ved `tilFraAntall`, så hver del er konsistent med pausevinduet og serverens PK4-sjekk (`vurderRadTimer`). Matpausen følger delen pausevinduet ligger i. Eksempel (regelen, ikke specens tall): 07:00–16:00 med 30 min pause og norm 7,5 t deles **kl. 15:00** → Timelønn 07:00–15:00 (7,5 t) + Overtid 50 % 15:00–16:00 (1 t). Linja: «1 t over dagsnorm — del i Timelønn 07:00–15:00 + Overtid 50 % 15:00–16:00?» · knapp «Del raden» (`timer.overtidForslag.splitt`/`delKnapp`).
- **Rad helt etter normen** (`normal: null`): «X t over dagsnorm — før som Overtid N %?» · knapp «Før som overtid» (`timer.overtidForslag.helRad`/`helKnapp`). Knappen bytter kun lønnsarten.
- **Web** (`TimerRadDialog` i [page.tsx](../../apps/web/src/app/dashbord/timer/%5Bid%5D/page.tsx), `overtidForslag` + `brukOvertidForslag`): forslaget regnes av de andre radene + dialogens egne verdier. Splitten er **to kall** på eksisterende stier — `oppdaterTimerRad` (normal-delen, egen mutasjon `oppdaterDel` som ikke lukker dialogen; ny rad: `tilfoyTimerRad`) og så `tilfoyTimerRad` for overtid-delen. Normen sendes inn som `normTimer`. ⚠️ O5 B (🟡 `feat/web-timer-o5`): i prosjektkort-modus er knappen borte og delingen skjer ved lagring — se § «+ Maskin» og overtid i timer-raden (O5). Dagskort-modus som her.
  - **Kjent begrensning:** feiler kall 2, viser dialogen feilen og raden står igjen forkortet til normal-delen. Brukeren legger da til overtid-delen manuelt. Ingen transaksjon (`splittRadEier` brukes ikke).
- **Mobil** (`TimerRadModal` i [TimerSeksjon.tsx](../../apps/mobile/src/components/timer-detalj/TimerSeksjon.tsx), `overtidForslag` + `lagre(forslag)`): normen kommer som `dagsnormTimer` fra `app/timer/[id].tsx` via `ProsjektGruppe` → `EcoBucket` → `TimerSeksjon`. Splitten = `onLagre` med normal-delen + `onLeggTilOvertidDel` (lokal `leggTil`) for overtid-delen; lønnsartkatalogen fra `hentLonnsarterLokalt`. Forskjell fra web: en tilknyttet maskin følger normal-delen.
- **Omfang:** kun dagskortets rad-dialog (web + mobil). Bekreft dag, prosjektkortet (`DagSeksjon`) og `NyTimerRadFlyt` er urørt; `SummeringsBanner` og vanlig radlagring uendret. Vakt `dagskort-isolert-vakt.test.ts` står.
- **Tester:** `overtidForslag.test.ts` (over/lik/under norm, ingen overtid-lønnsart, ingen norm, reise, flere rader kronologisk, rad helt etter normen, rad alt på overtid, pause i overtid-delen).

**Web-paritet bolk (a) — implementert 2026-07-09 (branch `feature/timer-web-paritet-a`, D2/D3/D7/D1):** Pause-utilen er løftet fra mobil-only til **`@sitedoc/shared/utils/pauseBeregning.ts`** (delt av mobil + web, jf. `maskinKapasitet.ts`). Arbeiderens web-`TimerRadDialog` (`timer/[id]/page.tsx`) har nå **Prosjekt-velger** (låst ved redigering — server `oppdaterTimerRad` flytter ikke rad mellom prosjekter, egen oppfølger) + **Fra/til** med samme fra/til↔antall-synk. Pausevindu-parametre hentes fra `hentArbeidstidDefaults` (medlems-tilgjengelig; `hentSetting` krever firma-admin). **D7:** web `ny/page.tsx` krever nå Prosjekt\* og bærer valget via `?nyttProsjekt=` til detalj-siden (forhåndsåpner gruppa) — `DailySheet` forblir projectId-løst (T.1), sedel-prosjekt er UI/session-konsept. **D1:** `dagsseddel.opprett` returnerer eksisterende sedel (`eksisterte:true`) ved duplikat-dato i stedet for P2002 → web åpner eksisterende med notis (mobil-atferd). Server `oppdaterTimerRad` tar nå `fraTid`/`tilTid`. Se [BACKLOG § Timer web-vs-mobil paritet](BACKLOG.md).

**Web-paritet bolk (b) — implementert 2026-07-09 (branch `feature/timer-web-paritet-b`, D4/D5/D6):** **D4** — kvittering-opplasting i web `TilleggRadDialog` (`FormData` → `/api/upload` → `tilfoyTilleggVedlegg`; thumbnails + fjern; kun på lagret rad, som mobil). **D5** — `hentMedId` eksponerer `manglerMaskinforerbevis` (via `harGyldigMaskinforerbevis`); amber info-banner til arbeideren i detalj-siden når sedelen har maskin-rader (T.11-paritet — web viste det før kun i attestering). **D6** — arbeider-`EcoGruppe` maskin ≤ arbeid-indikator bruker nå delt `overstigerMaskinTak` med pause-buffer (`pauseMin` fra sedel) — identisk med attestering + server; det gamle `+ 0.001`-uten-buffer er fjernet.

**Web-paritet bolk (c) — implementert 2026-07-09 (branch `feature/timer-web-paritet-c`, D8):** «Mine timer» (`dashbord/timer/mine/page.tsx`) fikk **«Ny dagsseddel»-knapp** i headeren → `/dashbord/timer/ny` (prosjekt velges der, D7 — ikke på oversikten) + **kladd-påminnelse** (amber) for usendte drafts med innhold fra tidligere dager (mobil `DagsseddelListe` UF-3). Kladd-sjekken bruker en egen periode-UAVHENGIG `list({status:"draft"})` slik at en glemt kladd utenfor valgt periode fortsatt fanges; lenker til eldste. Flagg-uavhengig side-innhold (FM5 lever i nav-komponentene). Ingen ny i18n (`timer.nyDagsseddel`/`timer.kladdPaaminnelse` fantes). Dermed er D1–D8 alle levert/på-branch; D9 (sesong-dagsnorm) + GPS-geoforslag gjenstår som egne rader.

**Web-paritet bolk (e)/(f)/(g) + vedtatte domeneregler — 2026-07-09 (develop).** Bolk (e) `f101890e` (pause-bevisst maskin-rad), (f) `f59a498c` (gjenåpne + attestert-vakt) + `1deaff6b` (slett-modal), (g) `79e786a3`/`c81c4eae` (gyldighet). Vedtatte regler (Kenneth 2026-07-09):

- **B1 — maskin-rad trekker lunsjpause** som timer-rad. Begrunnelse: maskin selges som **maskin + fører**; en maskin uten fører er ikke fakturerbar → maskintimene følger førerens pause-justerte arbeidstid.
- **B2 — spenn-validering (hard sperre):** ⚠️ På web utgått for maskin (§ 8.22, 🟡 `feat/web-timer-forenkle`: `MaskinRadDialog` har ikke fra–til). Sto slik: når fra OG til er satt, MÅ `antall == effektiveTimerFraSpenn(fra, til, pauseFra, standardPauseMin)`. **Kun klient-sperre** — web (`MaskinRadDialog`/`TimerRadDialog` i `dashbord/timer/[id]/page.tsx`, `handleSubmit`) og mobil (`MaskinSeksjon`/`TimerSeksjon` `lagre()`; maskin lagt i M5 2026-07-10). **Serveren håndhever IKKE B2** — `effektiveTimerFraSpenn`/`timerAvvik`/`pauseOverlappMin` har **0 treff** i `apps/api/src`; serveren håndhever kun fra<til (`refineFraForTil`/`finnTidsromKonflikt`) og timer-overlapp. En klient som omgår sperren kan skrive avvikende antall. Se [BACKLOG § B2 er ikke håndhevet på serveren](BACKLOG.md). **Kun nye/redigerte rader** — 11 seed-rader i `sheet_machines` avviker (per 2026-07-09; retro-avvises ikke, se BACKLOG).
- **B3 — antall forhåndsutfylles** fra prefill-spennet. Web timer+maskin ✅; **mobil maskin ✅ (M5 2026-07-10** — `MaskinSeksjon`s `timer`-init kaller `effektiveTimerFraSpenn`); **mobil timer ✅ (M6 2026-07-10** — `TimerSeksjon`s `timer`-init lazy-kaller `effektiveTimerFraSpenn` når `prefillGyldig`; `tilTid` prefylles kun ved gyldig prefill, som web). Er beregnet fra ≥ til, forhåndsutfylles verken til eller antall (ingen ugyldig rad). **Prefill-scope (M6):** mobil timer-`defaultTider.fra` løftet fra bøtte-scopet siste-rad til **seneste `tilTid` over hele sedelen** (`alleTimerRader`), beregnet som **maks** via `hhmmTilMin` (ikke array-rekkefølge) — speiler webs `onTilfoyTimer`-reduce.
- **B4 — betydningsendring: `SheetMachine.fraTid/tilTid` = maskinens DRIFTSVINDU**, ikke førerens arbeidsvindu. En maskin som gikk 5 t registreres som **07:00–12:00**, ikke som 5 t i et 8-timers vindu. Vedtatt fordi feltene historisk har vært frikoblet, og fordi maskintimer skal kunne **eksporteres til SmartDok uten gjetting**. Web maskin-prefill (bucketens arbeidsspenn) er kanonisk; **mobil løftet i M5 2026-07-10** — `MaskinSeksjon`s `defaultTider` leser bucketens timer-rader (`bucketTimer[0].fraTid` / `bucketTimer[..].tilTid` for `(defaultProjectId, defaultEcoId)`), faller til kalenderens effektive start/slutt.
- **B1/B2/B3 mobil maskin (M5, 2026-07-10):** `MaskinSeksjon.tsx` speiler nå `MaskinRadDialog` — pause-bevisst auto-synk antall ↔ fra/til (`handterFraEndret`/`handterTilEndret`/`handterTimerEndret` via delt `effektiveTimerFraSpenn`/`tilFraAntall`), B1 med `standardPauseMin` (firma-default, «maskin følger føreren»), B2-sperre i `lagre()`. `standardPauseMin`/`pauseEtterTimer` fra `hentOrganizationSettingLokalt`, skiftstart fra `hentEffektivArbeidstidLokal`. Ingen ny i18n, ingen SQLite-migrering. **Synk-vakt:** `syncBatch` validerer nå maskin-`fra<til` (`tilErEtterFra` på `lokal.maskiner`) FØR `createMany` → `"avvist"` (SYNC-1); før M5 omgikk synkveien vakten (SYNC-2 dekket kun timer-rader). Se [mobil.md § Timer](mobil.md).
- **Overlapp (server-sperre, alle skriveveier fra SYNC-2 2026-07-10):** en arbeider kan ikke registrere **overlappende timer-rader** på samme sedel, på tvers av prosjekt og underprosjekt (én arbeider kan ikke være to steder). Regelen ligger delt i `@sitedoc/shared/utils/tidsromValidering.ts` (`tilErEtterFra`, `finnOverlappendeTidsrom`, `finnTidsromKonflikt`). Web-mutasjonene `tilfoyTimerRad`/`oppdaterTimerRad` kaller den via `sjekkTimerOverlapp`/`refineFraForTil`; mobilens synkvei `syncBatch` via `finnTidsromKonflikt` (batch-intern — hele dagen sendes i én `createMany`, ingen rad finnes i basen ennå). **Berøring i endepunkt** (12:00 slutt = 12:00 start) er tillatt (strengt overlapp). Avvisning på synkveien rutes via `"avvist"` (SYNC-1). **Mobil klient-speiling (M3, 2026-07-10):** `TimerSeksjon`s lagre-handler kaller `finnOverlappendeTidsrom` mot **alle timer-rader på sedelen på tvers av (projectId, ECO)-bøtter** (`alleTimerRader`-prop fra sedelens fulle rad-liste, ikke det bøtte-scopede `rader`), ekskl. raden som redigeres, pluss `tilErEtterFra`. Blokkerer lagring lokalt (`timer.feil.overlapp`/`timer.feil.sluttForStart`) før synk — samme kryss-bøtte-regel som serveren. Prefill er fortsatt bøtte-scopet (eget scope, ikke overlapp). Pre-eksisterende overlapp låser ikke arbeideren ute (sjekk kun i lagre-handleren, egen rad ekskludert). Maskin-rader overlapp-sjekkes ikke mot timer-rader; maskin-vs-maskin ikke ennå (BACKLOG-utredning).

- **fra/til på synkveien (SYNC-2, 2026-07-10):** `syncBatch` **persisterer nå** `fraTid`/`tilTid` på timer- og maskin-rader (input-skjema + begge `createMany`). Før SYNC-2 strippet Zod-input feltene og `createMany` utelot dem, mens `syncBatch` samtidig gjør `deleteMany` + `createMany` per sedel → en mobilsynk **slettet** tider som var ført på web på samme sedel (T4-d koblet kun lese-/online-siden). Kolonnene fantes hele tiden; ingen migrering. Se [BACKLOG § Timer web-vs-mobil paritet](BACKLOG.md).

- **Synk-resultat per sedel (SYNC-1, 2026-07-10):** `syncBatch` returnerer `resultat: "ok" | "conflict" | "avvist" | "feilet"` per sedel. `avvist` = **permanent** avvisning klienten ikke kan rette via retry (P2002-duplikat, katalog-mismatch aktivitet/lønnsart/tillegg, maskin over jobbens arbeid (w9 `krevIngenNyeMaskinBrudd`), FORBIDDEN — og fra SYNC-2 overlapp/`fra<til`); `feilet` = **transient** (nettverk, ukjent DB-kode) som beholdes pending og retries. Mobil (`timerSync.ts` `anvendSvar`) setter `avvist` til terminal lokal `syncStatus="avvist"` → raden forlater pending (30s-retryen stopper) og vises med rødt banner i `timer/[id].tsx` + rødt `TimerSyncStatusBar`-varsel. Arbeideren retter (redigering setter status tilbake til `pending`) eller sletter. Pull overskriver ikke en `avvist`-rad. Bakoverkompat: eldre klient (#37) faller til else på ukjent `avvist` → beholder pending (uendret oppførsel).
- **Dato-kollisjon = forson-signal, ikke brukerhandling (2026-08-26):** ved `@@unique([userId, dato])`-kollisjon (server har alt en sedel for datoen under en ANNEN `clientUuid`, f.eks. ført på web) returnerer `syncBatch` `resultat="conflict"` + `serverData` med server-sedelens identitet. Dette er et **maskinsignal** til `timerSync.ts` M1-grenen om å forsone (`forsonSedelIdentitet` re-nøkler → `pending` → additiv re-push, uten datatap) — **ikke** en handling arbeideren skal utføre. Serveren sender derfor **ingen `feilmelding`** her (`dagsseddel.ts` ~5138); brukerkopien eies av klienten via i18n `timer.sync.slattSammen` («Slått sammen med dagsseddelen som alt fantes … timene dine er beholdt»). Den gamle server-strengen «dine timer slås sammen med den» beskrev en fremtidig manuell handling som ikke lenger finnes (BACKLOG 1547). **Merk:** merge-grenen setter `pending`, hvis banner viser `timer.sync.venterEn` — feilmeldingen surfacer ikke i dagens `[id].tsx` (kun `avvist`/`conflict` rendrer `feilmelding`); kopien er korrekt-i-kilde for der den evt. vises. **Teller (2026-08-26):** merge-grenen øker nå `resultat.push.merged++` (egen teller), ikke `conflict++` — en automatisk sammenslåing er ikke en konflikt. **Verifisert at det aldri var en brukervendt falsk alarm:** statusbarens «N konflikter» (`TimerSyncStatusBar`) mates av DB-tellingen `tellConflict` (`syncStatus="conflict"`), og merge setter `pending` → den telles aldri som konflikt der. Run-telleren `resultat.push` leses i dag kun for `.feil` (`TimerSyncProvider:144`); `merged`-utskillelsen er korrekthet + vern mot fremtidig konsument som surfacer run-tallet. **Åpen design-vurdering:** merge-sedelen bærer nå `slattSammen`-kopien men vises som generisk «venter på sync» — et rolig «slått sammen»-signal i pending-banneret er mulig, men krever å skille merge-pending fra vanlig/`feilet`-pending (fabel-vurdering, ikke bygget).
- **Gjenåpning:** arbeideren kan gjenåpne **egen** sedel med status `sent` (`gjenaapneDagsseddel`). Har lederen **attestert minst én rad**, blokkeres gjenåpning — lederen må **returnere** sedelen i stedet (retur-flyten setter `attestertStatus="returnert"` + `status="returned"`). Server-vakt. **Bekreftelse (M7, 2026-07-10):** både web (`<Modal>`) og mobil (`Alert.alert`, `apps/mobile/app/timer/[id].tsx` `gjenaapne()`→`utforGjenaapne()`) krever en bekreftelse før mutasjonen kjøres (`timer.gjenaapne.bekreftTittel/bekreftTekst/bekreftKnapp`).
- **Gjenåpning — distinkte feilkoder (M4, 2026-07-10):** `gjenaapneDagsseddel` gir nå distinkte tRPC-koder i stedet for at tre avvisninger delte `PRECONDITION_FAILED`. Fem koder er mulige: `CONFLICT` (status `accepted` — allerede godkjent), `PRECONDITION_FAILED` (attestert rad finnes — attestert-vakten over), `BAD_REQUEST` (annen ikke-`sent`-status), samt `FORBIDDEN` (`"Du eier ikke denne dagsseddelen"`) og `NOT_FOUND` — begge fra eierskaps-helperen `hentEgenDagsseddel` som mutasjonen kaller først. **Meldingene på de tre gjenåpne-avvisningene er uendret** (`"...allerede godkjent av leder..."`, `"...attestert minst én rad..."`, `` `Kan ikke gjenåpne dagsseddel med status «...»` ``) — web-onError (`apps/web/.../timer/[id]/page.tsx`, `e.message.includes("godkjent")`) er derfor uberørt. `hentEgenDagsseddel`s `NOT_FOUND` fikk i M4 meldingen `"Dagsseddelen finnes ikke"` (var tom); ingen av helperens 14 kallesteder mapper på tom melding. Bakgrunn: mobil-onError mappet feilen på delstrengen `"godkjent"`; alt annet (attestert-vakt, eierskaps-feil) falt til «Krever nett». Mobil (`apps/mobile/app/timer/[id].tsx`) mapper nå på `e.data?.code`: `CONFLICT`→`feilGodkjent`, `PRECONDITION_FAILED`→`laastAttestert`, **enhver annen kode → serverens `message`** (dekker `BAD_REQUEST`/`FORBIDDEN`/`NOT_FOUND` + alt fremtidig), og **kun fravær av `code` → `feilNett`** (ekte nettverksfeil). Se [mobil.md § Timer](mobil.md).
- **Gjenåpne attestering (leder, F4-2, 2026-07-11):** når `attesterRader` har attestert alle rader, flippes sedelen til `accepted` og web-attesterings-/retur-handlingene forsvinner (gated på status `sent`) → leder hadde ingen vei til å angre. Ny **leder-mutasjon `gjenaapneAttestering`** (`apps/api/.../dagsseddel.ts`, input `{ sheetId }`): precondition `status === "accepted"` (ellers `PRECONDITION_FAILED`), leder-auth via unike `projectId` fra radene + `krevProsjektLeder` (samme oppslag som `returnerRader`), transaksjon setter alle rader `attestertStatus="pending"` (nullstiller `attestertAvUserId`/`attestertVed`) og sedel `status="sent"` (tilbake i leder-køen, ikke til arbeider). Ren invers av `attesterRader`; **adskilt fra rad-retur** (`returnerRader`, delvis flyt under attestering). Web: «Gjenåpne attestering»-knapp i `accepted`-grenen i `AttesteringDetalj.tsx` med ekte `<Modal>`-bekreftelse (ikke `confirm()`). Ingen migrering; ny mutasjon (bakoverkompat). i18n `timer.attestering.gjenaapne.*` (nb+en + 13 auto).
- **Pause-kilde:** rad-modalenes fradrag bruker **`standardPauseMin`** fra firma-innstillingen (`hentArbeidstidDefaults`), IKKE `sheet.pauseMin`. `sheet.pauseMin` (brukers dags-justerte pause) leses **ikke** av noen rad-beregning — kun av bucket-taket. Inkonsistens flagget i [BACKLOG](BACKLOG.md).

**Kjent begrensning + gjenstår:** midnatt-wrap på enkeltrad-nattskift ([BACKLOG § `pauseVinduFra` midnatt-wrap](BACKLOG.md)); **Piece 2 (1b)** — fyll fra/til på auto-utkastet (`genererForslag`) — ikke startet.

### UX-visning — dagsseddel (mobil, T.7-gruppert)

```
┌─────────────────────────────────────────────┐
│  Dagsseddel — 16. apr 2026                  │
│  Arbeidstid: 07:00–17:00   Pause: 30 min    │
├─────────────────────────────────────────────┤
│  ▾ E6 Kvænangsfjellet            10,0 t      │
│    Tømrer · Anleggsarbeid   07:00–11:00 4,0 │
│      «Støpte fundament, B-akse»             │
│    Tømrer · Anleggsarbeid   11:30–17:00 6,0 │
│    [+ Legg til timer-rad]                   │
│    herav på maskin: Gravemaskin EQ-042 5,0  │
│                                             │
│  [+ Legg til prosjekt]                      │
├─────────────────────────────────────────────┤
│  Tillegg:                                   │
│  ☑ Overtidsmat (auto: timer > 9t)           │
│  ☐ Skifttillegg 30% ▾                       │
│  ▸ Utlegg      (kvittering)                 │
│                                             │
│  Beskrivelse: [____________________]        │
│  [Lagre utkast]  [Send til leder]           │
└─────────────────────────────────────────────┘
```

**Lønnsart-fordeling (T.9 droppet — ingen fordelingsmotor):** I **manuell** rad-registrering velger arbeider lønnsart selv per rad (Variant B: forhåndsvalg/forslag av lønnsart, ingen auto-split av totaltimer på normaltid/OT50/OT100). Den eneste auto-splittingen Timelønn/Overtid mot dagsnorm skjer i **auto-utkast-genereringen** (Slice 3, `genererForslag` ved «Slutt dag») — se [§ Auto-generering av dagsseddel](#auto-generering-av-dagsseddel-slice-34--deployet-prod-2026-06-21-server). Auto-rader er alltid `draft` og redigeres/godkjennes av arbeider før innsending.

**Smarte valg som minimerer inntasting:**

1. **Tilleggsregler** — automatiske forslag fra konfigurasjon, brukeren bekrefter eller overstyrer
2. **Maskiner** — nedtrekk fra maskinregisteret. Sist brukte øverst; soft-skjul når Equipment-cache tom
3. **Enhet** — auto-foreslått fra maskintype (kantsteinsetter → m, lastebil → m3). Kan overstyres
4. **Auto-utkast ved «Slutt dag»** (Slice 3) — draft genereres med arbeidstid (total − reise, splittet Timelønn/Overtid) + reise-rad fra R4-matrise. Arbeider korrigerer + sender. Ingen skjult automatikk — alt synlig som `draft`, aldri auto-innsending
5. **Materialer** — fritekst + mengde + enhet-dropdown (m3/m2/tonn/kg/m)

### Fritekstsøk på velgere (implementert)

Alle velger-modaler i timer-UI bruker fritekstsøk i stedet for lange nedtrekk — speiler CLAUDE.md § «Adaptive nedtrekksmenyer». Søkefeltet vises når listen passerer 7 elementer (terskel `> 7`):

| Velger | Felt det søkes på | Komponent |
|---|---|---|
| Lønnsart | navn | `LonnsartVelgerModal` |
| Aktivitet | navn | aktivitet-velger |
| Underprosjekt (ECO) | proAdmId + kortNavn | `UnderprosjektVelgerModal` (`TimerSeksjon.tsx`) |
| Utstyr/maskin | merke, modell, internNavn, **internNummer**, registreringsnummer | `EquipmentVelgerModal` (`MaskinSeksjon.tsx`) |

Utstyr-velgeren oppfyller kravet om søk på **både maskinnummer og -navn** (ingen lange nedtrekk). Samme mønster gjelder web-velgerne.

**Maskin-velger søk/filter/sortering (2026-07-05, develop).** Utover fritekstsøk har maskin-/utstyrsvelgeren nå **kategori-filter** (Alle/Kjøretøy/Anleggsmaskin/Småutstyr med antall + ikon, enkel-select — speiler `/dashbord/maskin`) og **konsekvent sortering: brukt-på-seddelen først → internNummer (numerisk) → navn**.
- **Web:** ny delt komponent `MaskinVelger` (`apps/web/src/components/timer/MaskinVelger.tsx`, `SearchInput` + chips). Brukt i alle fire callsites: `MaskinRadDialog` (primær, `timer/[id]/page.tsx`), `KompaktMaskinRad` (`attestering/RedigerRadModal.tsx`), `RedigerMaskinRad` (+ `SplittRadModal` via denne). Modalene slutter å caste bort `kategori`.
- **Lista i full høyde (plan § 8.22 L1, 🟡 `feat/web-timer-maskinliste-hoyde`, ikke merget):** `MaskinVelger` har prop `iVindu`. Med den står lista i flyten uten `absolute`/`max-h-64`, så vinduet (`<dialog>` i `Modal`, ruller selv) vokser til skjermhøyden og ruller inni. På i prosjektkort-modus på dagssiden (`MaskinRadDialog` med `kortModus`, maskindelen «Jobbens maskiner» i `TimerRadDialog`) og i attesteringen for begge firmavalg (`RedigerMaskinRad` → `SplittRadModal`/`AttesteringDetalj_Edit`, `KompaktMaskinRad` i `RedigerRadModal`). Dagskort-modusens maskindel i `TimerRadDialog` er uendret (svevende liste, `max-h-64`). Naboene i raden strekkes ikke med lista: prosjekt-nedtrekket i `RedigerMaskinRad` har `self-start`, og radgriden i `KompaktMaskinRad` er `items-start` (før `items-center`; feltene står nå øverst også når lista er lukket). Skjermbilder: `skisser-web-timeforing/l1-*.png`. Test: `apps/web/src/__tests__/web-timer-maskinliste-hoyde.test.tsx`.
- **Attesteringens maskinrader uten fra–til (plan § 8.22 punkt 1, 🟡 `feat/web-timer-maskin-uten-fratil`, ikke merget):** `RedigerMaskinRad` (rad 2 = Timer + Mengde + Enhet, 4+4+4; propen `tidsrundingMinutter` er fjernet) og `KompaktMaskinRad` i `RedigerRadModal` (grid `[1fr_80px_auto]`) har ingen fra/til-felt; «Splitt maskin-rad» viser ikke fra–til i referansen. Data: lagret `fraTid`/`tilTid` følger raden uendret gjennom `byggRedigerNyeRader`, `redigerSedelRader` og `splittRad` (første del arver originalens); en ny del i «Splitt» får `fraTid`/`tilTid` null (før: forrige dels `tilTid` som forhåndsutfylling). Timer regnes aldri av maskinens fra–til i disse vinduene. Skjermbilder: `skisser-web-timeforing/maskin-uten-fratil-*.png`. Test: `apps/web/src/__tests__/web-timer-maskin-uten-fratil.test.tsx`.
- **Mobil:** `EquipmentVelgerModal` (`MaskinSeksjon.tsx`) utvidet med kategori-chip-rad + samme sortering + «brukt»-markør (søkefeltet fantes fra Runde 2.6).

**Sist brukte maskiner øverst (ORDRE 29, 2026-11-06, `feat/byggeplass-kontekst-2` — 🟡 ikke merget).** Brukerens 5 sist brukte maskiner i firmaet (`SIST_BRUKTE_MASKINER_ANTALL`) løftes øverst og merkes `timer.maskin.sistBrukt` («sist brukt»). Sorteringen er delt: `sorterMaskiner` i `packages/shared/src/utils/maskinSortering.ts` (sist brukt → brukt-på-seddelen → internNummer → navn), brukt av både web og mobil.
- **Web:** `timer.dagsseddel.sistBrukteMaskiner({ organizationId })` (`apps/api/src/routes/timer/dagsseddel.ts`) — kun egne sedler (`sheet.userId = ctx.userId`) i firmaet, ikke-ansatt → `[]`. Sendes som `sistBrukt` til `MaskinVelger` fra `MaskinRadDialog`/`TimerRadDialog` (`timer/[id]/page.tsx`). **Attestering får ikke sist brukte** (`RedigerRadModal`/`RedigerMaskinRad` sender ingen `sistBrukt`).
- **Mobil:** `sistBrukteMaskiner(db, userId, organizationId)` (`apps/mobile/src/services/nyTimerRad.ts`) leser lokal SQLite (`sheet_machine_local` ⋈ `dagsseddel_local`), virker offline; brukt i `EquipmentVelgerModal`.

### Maskin ≤ arbeidstimer — pr. jobb (w9, B21 A / B22 A / B23 B, Kenneth 2026-11-19)

**Regel (w9, erstatter T7-4b-bøtta for jobber):** pr. jobb (`kortId`) må summen av maskiner som krever fører være ≤ jobbens arbeid (ordinær + overtid; reise, erstattede rader og pausen teller ikke). «Krever fører» = `maskinKreverTimerad(utleieEnhet)` (`maskinKobling.ts`): alt unntatt `doegn`; uten enhet krever fører. Eldre rader uten `kortId` beholder bøtteregelen pr. (prosjekt, underprosjekt) med sedelens pause, uten døgn-maskiner. Regelen bor i `packages/shared/src/utils/maskinKapasitet.ts` (`beregnJobbMaskinBrudd`, `nyeEllerOkteBrudd`, `maskinHoyst`, `maskinHoystPerRad`, `overMaskinHoyst`, `doegnOverArbeid`; fasit `maskinKapasitet.test.ts`).

**Serveren (B22 A — alle veier, også synken):** `krevIngenNyeMaskinBrudd` (`apps/api/src/routes/timer/dagsseddel.ts`) leser sedelens tilstand i transaksjonen før skrivingen (`lesMaskinJobbTilstand`), skriver (inkl. `sikreKortId`), leser igjen og avviser bare brudd skrivingen **lager eller øker**. Avvisningen kaster i transaksjonen, så ingenting skrives; feilen bærer `data.feilNokkel = "timer.maskin.overArbeidAvvist"` + `feilParam {jobb, maskin, arbeid}` (`nokkelFeil`, `apps/api/src/trpc/feilformat.ts`), og web viser `t(feilNokkel, feilParam)` (`serverfeilTekst`, `apps/web/src/lib/klientfeil.ts`). Veiene: `tilfoyTimerRad`, `oppdaterTimerRad`, `fjernTimerRad`, `forsonDagskort`, `oppdater` (pause — teller bare for eldre rader), `splittRad`, `splittRadEier`, `redigerSedelRader`, `flyttTimerRadEco` (enkeltrad og `helJobb`), `delJobb`, `maskin.tilfoy`, `maskin.oppdater` og `syncBatch` (gir `avvist`). Overgangen i synken (reise som arbeid) er fjernet. Test: `apps/api/src/routes/maskin-over-arbeid.integration.test.ts` (én pr. vei + negativkontroller; vakten av → 12 røde).

**«Flytt hele jobben» (`flyttHeleJobben`):** kort-id-en beholdes, så jobbens summer er uendret. Et nytt brudd kan bare oppstå når `sikreKortId` gir en eldre rad uten kort-id jobbens id fordi den nå har samme nøkkel (regel 3). Vakten i transaksjonen avviser det (`maskin-over-arbeid.integration.test.ts`, RETUR 1 V1).

**Gamle brudd (B23 B):** en jobb skrivingen ikke rører, er lik før og etter — et gammelt brudd stopper ikke føring i andre jobber, og å senke det går gjennom. Ventende jobber med brudd får merket «Over arbeid» på jobbraden i attesteringen, hover «Maskin 7,5 t, arbeid 4,5 t» (`maskinOverArbeidMerker`, `apps/web/src/components/attestering/attestering-tabell.ts`; nøkler `timer.attestering.merkeMaskinOverArbeid`/`forklaringMaskinOverArbeid`), og kan attesteres. Attesterte rader røres ikke og får ikke merket. Eldre rader får merket på samlekortet.

**Døgn-maskiner (B21 A):** sperres aldri. En døgn-maskin med flere timer enn jobbens arbeid gir samme merke, pr. maskin (S2, `doegnOverArbeid`).

**PC — «høyst X t»:** ved maskinens timer-felt står «høyst X t» (`timer.maskin.hoyst`) = jobbens arbeid minus de andre førermaskinene på jobben (`maskinHoystPerRad`); over grensen blir den rød og Lagre er sperret (`timer.maskin.overHoystSperret`). Gjelder `RegistreringPanel.tsx` (rettingen lagres ikke), `RedigerRadModal.tsx`, og dagssidens `MaskinRadDialog` og `TimerRadDialog` (`apps/web/src/app/dashbord/timer/[id]/page.tsx`). I `TimerRadDialog` er jobben den første arbeidsraden på sedelen med samme prosjekt, underprosjekt og byggeplass (regel 3 forenklet; serveren er autoritativ). Infolinja «Arbeid i gruppen …» er fjernet fra web. Vakt: `apps/web/src/__tests__/web-timer-w9-hoyst.test.ts`.

**Telefonen (w9m, Kenneth 2026-11-19):** samme regel som serveren, regnet lokalt i `apps/mobile/src/services/maskinJobbLokalt.ts`. 🟡 `feat/web-timer-w9m` (ikke merget).
- **Skrivevakt (WM108):** `skrivMedMaskinVakt(db, sheetId, reiseLonnsartId, skriv)` skriver i en SQLite-transaksjon, utleder kort-id (`sikreLokalKortId`), sammenligner før/etter med `nyeEllerOkteBrudd` og ruller tilbake ved nytt eller økt brudd. Brukt av radlagringen (`prosjektkort/radLagring.ts` `oppdaterTimerRad`, `TimerSeksjon.tsx` oppdater), maskinflytt i dagsoversikten og «Flytt kort» (`flyttKort` vakter hele flyttet; radene skrives med `skrivTimerRadUtenVakt`). Avvist skriving viser `timer.maskin.overArbeidAvvist` med serverens parametre (`bruddTekst`).
- **Bekreft dag:** maskinene får kort-id-en til forslagsraden de står på; `vaktGrunnlag` gir `{foer, etter, enhet}` (eldre rader med `erReise` null og reise-lønnsart er reise, `hentReiseLonnsartId` — RETUR 1 M1) og `maskinBruddForTillegg` regner jobbregelen (`apps/mobile/src/utils/bekreftDagTillegg.ts`).
- **«Høyst X t»:** timer-dialogens maskinlinjer viser `timer.maskin.hoyst` og rød ramme over grensen (`TimerSeksjon.tsx`, `maskinHoyst`). Kun visning — skrivevakten stopper.
- **D1 (Kenneth 2026-11-19, B21 A):** «Kun maskiner som heatwork eller utleie maskiner/materiell kan ha timer/døgn leie uten at arbeidstimer tilsvarende eller flere er registrert». Rad-regelen «maskin ≤ radens timer» (`maskinerOverRad`, `apps/mobile/src/services/kobledeMaskiner.ts`) gjelder derfor bare maskiner med fører (`maskinKreverTimerad`); døgn-maskiner slipper. Vakt: `kobledeMaskiner.test.ts`.
- **Synkfeil på brukerens språk (plan § 5):** `syncBatch` sender `feilNokkel` + `feilParam` ved siden av `feilmelding` når avvisningen er en `NokkelFeil`. Telefonen lagrer dem i den eksisterende kolonnen `dagsseddel_local.feilmelding` som `nokkel:{…}` (ingen lokal migrering) og viser dem med `feilmeldingTekst` (`apps/mobile/src/utils/synkFeil.ts`). Ren tekst vises som før.
- **Fjernet:** bøtte-kapasiteten (`maskinBucketKapasitet`, `overstigerMaskinTak`, `beregnMaskinBrudd`, infolinja «Arbeid i gruppen …») og nøklene `timer.maskin.kapasitet`, `timer.maskinSeksjon.kapasitet`, `timer.maskin.overstigerArbeid`. Vakt: `apps/mobile/src/utils/w9m-opprydding-vakt.test.ts`.

### Reise skilt fra arbeid — «+ Reise», sumvisning, maskinlinje (ordre 2026-11-14 (6)) — 🟡 `feat/timer-reise-skille` (ikke merget)

Kenneth-hjemmel. Tre delte regler i `packages/shared/src/utils/reiseSkille.ts` (vakt: `reiseSkille.test.ts`):

- **`løsReiseKnappLonnsart(reiseLonnsartId, lonnsarter)`** — ÉN resolver for hvilken lønnsart «+ Reise» fører på: `valgt` (eksplisitt `OrganizationSetting.reiseLonnsartId`, aktiv), `automatisk` (intet valg, nøyaktig én aktiv ordinær art matcher `REISE_LONNSART_REGEX`), `ingen` (0 kandidater, eller eksplisitt valg som er deaktivert/slettet — speiler serverens `erReiseLonnsart`, som ikke navne-matcher når et valg er satt) og `flere` (≥ 2 kandidater uten valg).
- **`arbeidOgReise` / `arbeidUtenReise`** — arbeid og reise hver for seg; erstattede rader (`attestertStatus = "erstattet"`) telles aldri.
- **`sendDagenTekst(status, arbeid, reise)`** — «Send dagen (7,5 t · reise 2 t)» / «Send dagen (7,5 t)»; returnert sedel gir «Send på nytt».

**«+ Reise»:** knappen fører låst på resolverens lønnsart med `erReise = true`, `reiseKilde = "manuell"` (server: `tilfoyTimerRad` tar `reiseKilde: "manuell"` og avviser med `BAD_REQUEST` når lønnsarten ikke er reise — en under-terskel-rad fra ordre (9) sender derfor ingen `reiseKilde`). Ved `ingen`/`flere` skjules knappen; firmaadmin ser `timer.prosjektkort.reiseSkjultIngen`/`reiseSkjultFlere` + «Velg reise-lønnsart» som lenke til `/dashbord/firma/innstillinger#reise-regelsett`, andre ser ingenting.
- Web: prosjektkort-visningen (`apps/web/src/app/dashbord/timer/[id]/page.tsx`, knappen ved «+ Timer» i kortet; ny rad føres i reise-kortet `ReiseKort` (`./ReiseKort.tsx`, fra POST (13) L2 — se § Reise-kort og overføring)). Klassisk dagskort-visning (firmaets default `timerRegistreringsmodus`) har ingen «+ Reise» — der føres reise som før via «Legg til timer-rad». Klassisk dagskorts dekningsbanner («X t av Y t registrert») teller arbeid uten reise og viser reise separat som «… · Reise N t» (`timer.summeringReise`; POST 2026-11-14 (7) punkt 6, Kenneth løftet dagskort-isolasjonen kun for banneret) — web `timer/[id]/page.tsx:1055`/`:1082`, mobil `app/timer/[id].tsx:559`/`:984-985` + `SummeringsBanner.tsx:17`/`:66`. Erstattede rader telles ikke. Dagskortet har fortsatt ingen «+ Reise». Vakt: `prosjektkort-visning.test.tsx` (banner-describe) + mobil `summeringsbanner-reise-vakt.test.ts`.
- Mobil: dag-seksjonen (`prosjektkort/DagSeksjon.tsx`, reise hører til dagen — ORDRE 36b) via `hentReiseKnappLokalt` (`services/timerKatalog.ts`); ny rad føres i reise-kortet (`ReiseKort`, fra POST (13) L2 — se § Reise-kort og overføring). Admin-signalet er et vellykket `organisasjon.hentSetting`-kall (mobil har ingen rolle lokalt) — offline vises ingen hint. Lenken åpner web (`hentWebUrl()` + `apnLenke`, eksisterende mønster). Offline-rad får `erReise` + `reiseKilde = "manuell"` ved innsetting (`settInnTimerRad`), samme etter synk.

**Reise-innstillingen (`apps/web/src/app/dashbord/firma/innstillinger/page.tsx`, `ReiseSeksjon`):** nedtrekket grupperer «Foreslått» (resolver-kandidater) og «Andre lønnsarter»; tomt valg viser «Automatisk → X» når én kandidat finnes. Statuslinja (`data-testid="reise-status"`) sier valgt / automatisk / ingen / flere / bånd (`firma.innstillinger.reise.status*`), gul ved ingen/flere.

**«Dette må være på plass» (POST 2026-11-14 (8) punkt 2, `ReiseForutsetninger` i `firma/innstillinger/page.tsx`, `data-testid="reise-forutsetninger"`):** vises øverst i Reise-seksjonen når Timer er aktiv, fra `organisasjon.hentReiseForutsetninger`. Tre linjer med grønn/gul/rød prikk: (1) oppmøtesteder — rød ved 0, lenke til `/dashbord/firma/oppmotesteder`; (2) byggeplasser i aktive prosjekter som mangler punkt og/eller radius, hver som lenke til `/dashbord/oppsett/byggeplasser?prosjekt=<id>` (siden velger prosjektet fra `?prosjekt=`); (3) par uten avstand med «Beregn» (samme `beregnMatrise`) og rød liste over par uten kjørbar rute. Erstatter de to gamle boksene (byggeplasser uten punkt / uoppnåelige par) med samme innhold i mer detalj. Lønnsart-telleren (`reiseLonnsartMatchAntall`) teller kun aktive ordinære arter, samme kandidatregel som resolveren.

**«+ Reise» i Bekreft dag (POST 2026-11-14 (8) punkt 1):** i manuell modus (Nytt prosjektkort) har `bekreft-dag.tsx` samme knapp, resolver (`hentReiseKnappLokalt`), låste lønnsart og admin-hint som `DagSeksjon`. Reisen ligger i rettingen (`DagsforslagRetting.manuellReise`) og legges som erReise-rad på første åpne dato (`leggTilManuellReise` i `utils/dagsforslag.ts`) med `reiseKilde`/`tidKilde = "manuell"`; arbeidsradene røres ikke. Endre = fjern + legg til på nytt. Et utkast med kun reise er ikke tomt (`erTomtUtkast`). Mobil `hentReiseLonnsartId` faller tilbake til resolveren (punkt 5). Terskel og bånd: se neste avsnitt. Vakt: `manuellReise.test.ts`, `timerKatalog-reiseResolver.test.ts`.

**Terskel og avstandsbånd på «+ Reise» (POST 2026-11-14 (9), Kenneth-vedtak «Arbeidstid, erReise false») — 🟡 `fix/reise-terskel-manuell` (ikke merget):** ÉN delt regel `klassifiserManuellReise` (`packages/shared/src/utils/reiseManuell.ts`), kalt fra mobilens `useManuellReise` (`apps/mobile/src/components/timer-detalj/useManuellReise.ts`) i `TimerRadModal` — samme modal for `DagSeksjon` og Bekreft dag manuell modus, så de ikke kan divergere. Gjelder kun NY rad fra «+ Reise». *(Fra POST (13) L2 føres ny reise-rad i `ReiseKort`, ikke `TimerRadModal` — se § Reise-kort og overføring.)*
- **Terskel i begge enheter:** «minutter» måler de innførte reisetimene mot `reiseTerskelMin`; «km» måler matrise-avstanden oppmøtested × kortets byggeplass (`hentMatriseRadLokalt`) mot `reiseTerskelM`. Nøyaktig på terskelen = over (som `klassifiserReise`).
- **Oppmøtested (km):** *(mobil erstattet i POST (13) L2: perioderesolveren `løsOppmote` velger, «siste valg» og `reiseOppmotestedLagring.ts` er fjernet — se § Reise-kort og overføring.)* Historisk: ett → automatisk; flere → nedtrekk «Fra oppmøtested» med siste valg forhåndsvalgt. Ukjent avstand → regel (c): under terskel, grå linje «Avstand ukjent — regnes som under terskel».
- **Under terskel:** egen rad på firmaets standard ordinære lønnsart med `erReise = false`, uten `reiseKilde`, avstand og oppmøtested (C2/DB-CHECK); `reiseRegel`-snapshot lagres. Slås aldri sammen med andre rader, teller i arbeid og overtid, vises ikke som reise i «Send dagen». Mangler standardart → lagring blokkert med `timer.reiseTerskel.manglerArt`.
- **Over terskel:** `erReise = true`, `reiseKilde = "manuell"`; lønnsart fra båndet (`løsReiseLonnsartId`) når avstanden er kjent, ellers resolverens art. Avstand + oppmøtested lagres.
- **Grå forklaringslinje** under lønnsarten (`forklaringTekst` i `apps/mobile/src/components/timer-detalj/useManuellReise.ts`, nøkler `timer.reiseTerskel.*`): under/over velges etter terskelutfallet (`forklaring.type`), og kategorien settes inn separat — «Under terskel (30 min) — føres som arbeidstid», «Under terskel (30 min) — føres som reise» når under-type er reisetid, «Over terskel (30 km) — <båndets art>» o.l. Fasit: `forklaringTekst.test.ts`.
- **Lagring:** `ManuellReiseSpor` (`tilManuellReiseSpor`) føres gjennom `NyRad.reiseSpor` (`services/nyTimerRad.ts`, via `radLagring.leggTilTimerRad`) og `DagsforslagManuellReise.reiseSpor` (`leggTilManuellReise`); uten spor = som før.
- **Server uendret:** vakten i `tilfoyTimerRad` (`apps/api/src/routes/timer/dagsseddel.ts:2390-2395`) avviser kun `reiseKilde` på ikke-reise-art; under-terskel-raden sender ingen `reiseKilde`. `validerReiseInvarianter` (`reise-sporbarhet.ts:239-252`) tillater regel-snapshot på ikke-reise-rad. Vakt: `apps/api/src/routes/timer/reise-terskel-manuell.test.ts` (negativkontroll: vakten slått av → 1 rød).
- **Kjente grenser:** minutt-modus med flere oppmøtesteder gir ingen avstand → ingen bånd (resolverens art); under-terskel-raden får 0 pause og er fritatt beskrivelseskrav som reise-rader; web «+ Reise» har terskel fra ordre (11), se avsnittet under. Dagskortet er urørt (`dagskort-isolert-vakt.test.ts`). Tester: `reiseManuell.test.ts` (shared), `manuellReise.test.ts` (mobil).

**Avstander settes når byggeplassen får plassering + redigerbar avstandsliste (POST 2026-11-14 (10)) — 🟡 `fix/reise-avstandsliste` (ikke merget):**
- **Recompute ved plassering (punkt A):** `byggeplass.opprett` geokoder adressen (`geokodEttTreff`) og kaller `recomputeRadForByggeplass` når den gir ett punkt; `byggeplass.oppdater` med ny adresse og `geofenceKilde="geokodet"` gjør det samme; `settGeofence`/`oppdaterByggeplassGeofence` (tegning, kart, adresse) hadde det fra før (R3). Web `oppsett/byggeplasser/page.tsx` åpner plasseringsdialogen rett etter opprettelse når den nye byggeplassen mangler punkt og Timer er aktiv (`lokasjoner.geofence.etterOpprett`). Vakt: `byggeplass-opprett-geokod.test.ts`.
- **Manuell overstyring:** `ReisetidMatrise.kilde` = `"osrm"` | `"manuell"` | `"manuell_endret"` (`apps/api/src/services/reisetidMatrise.ts`, `MANUELL_FILTER`). `recomputeMatrise` hopper over manuelle par i upsert og i stale-slettingen (`NOT: MANUELL_FILTER`) — en rettet verdi overskrives aldri. Flyttes punktet (`koordinatEndret`), settes manuelle par i raden til `manuell_endret` (`plasseringEndret`) — verdien står, men merkes. Vakt: `reisetidMatrise-manuell.test.ts`, `reisetidMatrise-h21.test.ts`.
- **Fanen «Avstander» (punkt B):** Firma → Oppmøtesteder (`firma/oppmotesteder/page.tsx`, `?fane=avstander`; komponent `AvstanderFane.tsx`). Én rad pr. byggeplass med punkt i aktive prosjekter × aktivt oppmøtested: byggeplass, prosjekt, oppmøtested, avstand, kjøretid, kilde. «Måles i» (`reiseTerskelEnhet`) avgjør hvilken verdi som er hovedverdi og redigerbar (km → avstand, minutter → kjøretid); den andre vises grå. «Ikke beregnet» har «Beregn» (`beregnMatrise({byggeplassId})`); «Ingen rute» = `kjoretidMin < 0`. Byggeplass uten punkt vises kun med sine manuelle par («Manuell — byggeplassen mangler plassering»).
- **Ruter (`apps/api/src/routes/oppmotested.ts`, firma-admin):** `hentAvstander`, `oppdaterAvstand` (Zod-grenser `MANUELL_AVSTAND_GRENSER`; km-modus uten kjent kjøretid krever kjøretid også, ellers BAD_REQUEST), `tilbakestillAvstand` (sletter den manuelle raden og recomputer byggeplass-raden; andre manuelle par står). Firma-grensen sjekkes på både byggeplass (`hentByggeplassForFirma`, via `project.primaryOrganizationId`) og oppmøtested — annet firma → NOT_FOUND uten skriving. Vakt: `oppmotested-avstand.test.ts`.
- «Dette må være på plass» i Reise-seksjonen lenker til fanen (`firma.avstander.seAvstander`).

**Samlet oppfølger: terskel på web-«+ Reise», kjøretid i timer, veiledning ved manglende standard lønnsart (POST 2026-11-14 (11)) — 🟡 `fix/reise-oppfolger-11` (ikke merget):**
- **Én delt løsning (A):** *(erstattet i POST (13) L2: `løsManuellReise` og `velgOppmotested` er fjernet; begge plattformer kaller `løsOppmote` + `løsReiseKort`/`løsOverforingKort` — se § Reise-kort og overføring.)* Historisk: `løsManuellReise` (`packages/shared/src/utils/reiseManuell.ts`) velger oppmøtested (`velgOppmotested`), slår opp avstand og klassifiserer (`klassifiserManuellReise` + `tilManuellReiseSpor`). Mobilens `useManuellReise` og webens `useManuellReiseWeb` (`apps/web/src/hooks/useManuellReiseWeb.ts`) kaller begge denne — kun datakilden skiller (lokal cache vs. tRPC: `hentArbeidstidDefaults`, `oppmotested.hentForFirma`, `hentMatriseForFirma`, `timer.lonnsart.list`). Forklaringslinjen er delt: `manuellReiseForklaringTekst` (mobilens `forklaringTekst` er et alias).
- **Web «+ Reise»** *(erstattet i POST (13) L2 av web-`ReiseKort`; nedtrekket og `localStorage` er fjernet — se § Reise-kort og overføring.)* Historisk: (`TimerRadDialog` i `apps/web/src/app/dashbord/timer/[id]/page.tsx`): ny rad fra «+ Reise» viser klassifisert lønnsart (låst) + grå forklaringslinje; km med flere oppmøtesteder gir nedtrekk «Fra oppmøtested» (siste valg pr. firma i `localStorage`, samme nøkkel som mobil-web). Under terskel → standard ordinær art uten `reiseKilde` (server gir `erReise=false`); over → båndets/resolverens art med `reiseKilde: "manuell"`. Terskel ikke i bruk (begge typer reisetid) → som før.
- **Lagre sperret til regelsettet er lastet (RETUR (11) nr. 2, vilkår 1, lønn):** *(L2: gjelder nå seks oppslag og web-`ReiseKort` — se § Reise-kort og overføring.)* `useManuellReiseWeb` returnerer `regelStatus` (`klar`/`laster`/`feilet`) over alle fire oppslag klassifiseringen bygger på (defaults, oppmøtesteder, matrise, lønnsarter). I reise-modus er Lagre (og overtidsforslaget) sperret til status er `klar`, med `KnappMedForklaring`-tekst `sperret.reiseRegelLaster` / `sperret.reiseRegelFeilet`; `lagreRad` har samme vakt. «Som før» gjelder dermed kun når regelsettet er lastet og begge terskelsider er `reisetid` — aldri som stille tilbakefall ved feil.
- **Kjent grense (web):** `tilfoyTimerRad` tar ikke `reiseAvstandM`, `reiseOppmotestedId` eller `reiseRegel`, så web lagrer lønnsart og `erReise` riktig, men ikke sporet mobil lagrer. Å utvide ruta er en server-/lønnsendring som krever eget vedtak.
- **Kjøretid i timer (B):** `formaterKjoretid(t, min)` (`packages/shared/src/utils/kjoretid.ts`, nøkler `timer.kjoretid.*`) gir «1 t 35 min» over 60 min og «45 min» under; brukt i `AvstanderFane.tsx` (cellen er `whitespace-nowrap`). Redigeringsfeltet er fortsatt minutter.
- **Mangler standard lønnsart (C):** `manuellReiseManglerArt` (shared) → tekst `timer.reiseTerskel.manglerArt` «Firmaet mangler standard lønnsart — be firmaadmin sette den» på mobil (`TimerSeksjon.tsx`) og for arbeider på web; lagring sperret. Firmaadmin på web (`hentSetting` lykkes) får i stedet `timer.reiseTerskel.manglerStandardArt` «Firmaet mangler standard lønnsart» (uten «be firmaadmin») + lenke `timer.reiseTerskel.settStandardArt` til `/dashbord/firma/timer/lonnsarter`. Firmainnstillinger → Reise viser en varsellinje (`firma.innstillinger.reise.manglerStandardArt` + lenke) når Timer er aktiv, en terskelside er «arbeidstid» og ingen aktiv art har `erStandardvalg`. Ingen toast/banner.
- **Tester:** *(L2: § «felles fasit» og `velgOppmotested`-testene er fjernet med funksjonene; `reise-terskel-dialog.test.tsx` tester nå web-`ReiseKort`.)* `reiseManuell.test.ts` § «felles fasit for mobil og web» + `kjoretid.test.ts` (shared); `reise-terskel-dialog.test.tsx` (web-payload = delt fasit under/på/over terskel og ukjent avstand), `avstander-kjoretid.test.tsx`, `reise-mangler-standardart.test.tsx` (web); `manuellReise.test.ts` § Ordre (11) C (mobil). Negativkontroll pr. del: hook av → 6 røde; veiledning fjernet → 2 røde; rå minutter → 3 røde; varsellinje av → 1 rød. Vilkår 1: `reise-terskel-dialog.test.tsx` § «Lagre sperret til regelsettet er lastet» (ikke lastet + feilet → sperret, forklaring, ingen mutate).

**GPS-forslag under Byggeplass i Bekreft dag (POST 2026-11-14 (8) tillegg 4):** i manuell modus vises en gul linje «GPS foreslår: <byggeplass>» (eller «… (<prosjekt>)» når prosjektet er et annet) rett under Byggeplass-feltet — kun når kortets dato er i dag og GPS-byggeplassen (`ByggeplassKontekst.gpsByggeplassId`, samme kilde som Hjem-chipen) avviker fra kortet. Kun informasjon; ingen ny posisjonsforespørsel. Ren logikk i `utils/gpsForslagLinje.ts` (vakt `gpsForslagLinje.test.ts`); dagskortet er urørt (`dagskort-isolert-vakt.test.ts`).

**Arbeid og reise hver for seg:** «Arbeidstimer (N t)» er uten reise; «Reise N t» vises separat (`timer.gruppe.reise`) — web dagskort-gruppe, `AttesteringDetalj_Edit`, `attestering-buckets`, `SeddelKort`; mobil `ProsjektGruppe`. Maskinlinja er «Maskin X t» (`timer.gruppe.maskin`) uten «av Y t arbeid» og alltid nøytral — ingen grønn/rød og ingen varseltekst på linja, heller ikke ved brudd (RETUR 1; web `EcoGruppe` i `timer/[id]/page.tsx`, `attestering-buckets`, `SeddelKort`, `AttesteringDetalj_Edit`; mobil `ProsjektGruppe`). Brudd stoppes av sperren i rad-modalene (web `MaskinRadDialog`/`RedigerRadModal`, mobil `MaskinRadModal`), og `SeddelKort` flagger sedelen via `sedelHarMaskinOver`. Mobil `SummeringsBanner` bruker bannerets felles tekstfarge. Mobil `ProsjektkortDagsoversikt` har fortsatt sin egen ravgule bruddliste (`maskinOverTak`, «Maskin X t · Maskintimer overstiger arbeidstimer»), som er en separat varselliste og ikke maskinlinja. Vakt: `apps/web/src/__tests__/timer-maskinlinje-noytral-vakt.test.ts` (alle fem flater; mutanter rød tekst i `SeddelKort` og «maskinOverstiger» i mobil `ProsjektGruppe` → røde). Nøklene `timer.gruppe.maskinAvArbeid` og `timer.summering.heravMaskin` er fjernet (ingen kallere).

**Maskin-kontrollen beholdes, målt mot arbeid uten reise** (og uten erstattede rader): web `page.tsx` (gruppe + `maskinKapasitet` i begge modaler), `RedigerRadModal`; mobil `MaskinSeksjon.tsx` (kapasitet), `TimerSeksjon.tsx` (`TimerRadModal`-kapasitet), `kortRadFlytt.ts` (`girNyttBrudd`, `KortDag.reiseLonnsartId` — vakt i `kortHele.test.ts`), `ProsjektkortDagsoversikt.tsx` (maskin-flytt) og `bekreftDagTillegg.ts` (`vaktGrunnlag`). Serveren (w9, `beregnJobbMaskinBrudd`) regner også arbeid uten reise (POST 2026-11-14 (7) punkt 5): maskin 7 / arbeid 7 / reise 2 godtas, maskin 8 avvises. Test i `firma-katalog-server.test.ts`.

**Send dagen:** web og mobil (`prosjektkortMobil.ts` `sendKnappTekst` → `sendDagenTekst`; `ProsjektkortDagsoversikt`, `ProsjektkortSamleside`) viser arbeid uten reise, reise separat.

**Sumlinja på web-samlesiden (Kenneth 2026-11-21, `web-timeforing-plan.md` § 8.21 og § 8.22; 🟡 `feat/web-timer-sumlinje`):** bunnlinja viser arbeid mot normen («Arbeid 8,0 t av 7,5 t») og sum i dag = arbeid + reise (`sumlinjeDag`, `packages/shared/src/utils/prosjektkort.ts`). Maskintimer vises, men legges ikke til. Trafikklyset regnes fortsatt uten reise — reise er ikke overtid (`sumlinjeMotNorm`). Detaljer og eksempler: § Prosjektkort L1, punktet «Tall». Gruppelinjene («Arbeid og reise hver for seg») og «Send dagen» over er uendret: arbeid uten reise, reise separat.

### Prosjektkort L1 — visningsmodus for web-sedelen — 🟡 `feat/prosjektkort-l1` (2026-11-05, ikke merget)

Spec: `relay/prosjektkort/spec-prosjektkort.md` (vedtak 1–10, Kenneth «ok for 1-10»).

- **Modell A — kun visning.** Prosjektkort er en visningsmodus over samme `DailySheet`: samme rader, samme mutasjoner, samme innsending, attestering og lønnsgrunnlag. Ingen ny lagring og ingen endring i eksisterende tRPC-kontrakter.
- **Firmavalg:** `OrganizationSetting.timerRegistreringsmodus` (`dagskort` default \| `prosjektkort`). Settes under Firma → Innstillinger → «Timeføring» (`apps/web/src/app/dashbord/firma/innstillinger/page.tsx`); slår inn ved neste lasting. Ukjent/manglende verdi leses som dagskort (`lesTimerModus`, `packages/shared/src/utils/prosjektkort.ts`).
- **Dagskort uendret:** i dagskort-modus er markupen byte-identisk med develop (målt med render av begge versjoner, samme data). Prosjektkort-flaten er gated med `prosjektkortModus` i `apps/web/src/app/dashbord/timer/[id]/page.tsx`.
- **Samleside (`ProsjektkortSamleside`, `page.tsx:1275`):** «Prosjektkort (N)», ett kort pr. prosjekt med «nr — navn», byggeplass og kolonnene Arbeid / Maskin / Varer / Reise («—» når tom). Kortet åpnes på plass og viser dagskortets `ProsjektGruppe` med `iKort` (ECO-bøtter, timer, maskin), VARE-linjer og lenkene «+ Timer · + Maskin · + Tillegg/Utlegg». Under: «+ Nytt prosjektkort», «Dagens ramme · fra–til · pause N min (bæres av …)» med «Endre» (`RedigerHeaderDialog`), og bunnlinja «Arbeid X t av Y t · maskin · reise · sum i dag T t» (`sumlinjeDag`, 🟡 `feat/web-timer-sumlinje`) med Slett og «Send dagen (X t)». Er sedelen returnert, sier knappen «Send på nytt» (samme nøkkel som dagskortet, `timer.detalj.sendPaaNytt`). Maskin og reise vises i bunnlinja kun når > 0; «sum i dag» står alltid. Innstillingens hjelpetekst (`firma.innstillinger.timeforing.hjelp`) sa i L1 at appen fortsatt viste dagskort; den setningen er fjernet i L2.
- **Tall (`packages/shared/src/utils/prosjektkort.ts`, delt med mobil fra L2):** erstattede rader (`attestertStatus = "erstattet"`) telles aldri. Arbeid = timer uten `erReise`, Reise = timer med `erReise`, Maskin = maskinrader. Varer: én enhet gir summert mengde, ulike enheter gir antall linjer. Sum i dag (`sumIDag`) = Σ kortenes arbeid + reise. «Send dagen» viser arbeid uten reise og reise separat (`sendDagenTekst`, se § Reise skilt fra arbeid). **Bunnlinja på web legger reisetid til totalen** (Kenneth 2026-11-21, plan § 8.21 og § 8.22 — snur 2026-11-14; reisetid er lønnet arbeid, men behandles ulikt arbeidstid etter arbeidsmiljøloven; 🟡 `feat/web-timer-sumlinje`): `sumlinjeDag(timer, maskin, norm)` gir arbeid, maskin, reise, totalt = arbeid + reise og sonen; maskintimer vises, men legges ikke til; erstattede rader teller ikke. Web-samlesiden (`page.tsx`, `timer.prosjektkort.sumArbeid` / `sumMaskin` / `sumReise` / `sumTotalt` = «sum i dag») kaller den. Eksempel: arbeid 7,5 t, maskin 5 t, reise 3 t, norm 7,5 → «Arbeid 7,5 t av 7,5 t · maskin 5 t · reise 3 t · sum i dag 10,5 t», grønn; arbeid 8,0 t + reise 3 t → «Arbeid 8,0 t av 7,5 t · reise 3 t · sum i dag 11 t», gul. **Trafikklys-prikken teller fortsatt ikke reise** (reise er ikke overtid, samme regel som `foreslaOvertidSplitt`): sonen kommer fra `sumlinjeMotNorm(timer, norm)` (arbeid uten reise og uten erstattede rader mot normen). Normen står fortsatt etter arbeidet («Arbeid 8,0 t av 7,5 t», plan § 8.22: bunnlinja viser både arbeidstid mot normen og summen med reise). Mobilens samleside er `ProsjektkortDagsoversikt` (`app/timer/[id]/prosjektkort.tsx`): der er «Sum i dag» arbeid uten reise (`ProsjektkortDagsoversikt.tsx`, `arbeidTimer`-filteret og `sum.arbeid` i sum-kortet), uten norm og uten trafikklys — normen står på egen linje (`timer.dagsoversikt.normRamme`), reisen som « · reise X t». Mobilens `ProsjektkortSamleside.tsx` bruker fortsatt `timer.prosjektkort.sumIDag` («Sum i dag X t av Y t») — urørt. Vakt: `prosjektkort.test.ts` (`sumlinjeDag`, `sumlinjeMotNorm`). Byggeplass: rad uten egen arver sedelens; én gir navnet, flere gir «N byggeplasser», ingen gir tomt. Trafikklys-prikken (kun web) bruker samme avrundingsregel som dagskortets topp-sum, på tallet uten reise.
- **Varer:** ny `vareforbruk.hentMineForDato` (kun lesing, egne linjer for firma + dato, `apps/api/src/routes/vareforbruk.ts:153`). Ingen «+ Vareforbruk» i L1.
- **Raddialog:** i prosjektkort-modus er prosjektet låst til kortets (`laastProsjekt`), og overlapp-meldingen navngir det andre kortet (`timer.feil.overlappKort`).
- **Ikke i L1:** mobil, pivot, attestering, lønnseksport, GPS, syncBatch.

### Prosjektkort L2 — mobil — 🟡 `feat/prosjektkort-l2` (2026-11-06, ikke merget)

Spec: `relay/prosjektkort/spec-prosjektkort.md` § 4.2/§ 4.3/§ 7/§ 9. Samme modell A som web: samme `DailySheet`, samme rader og innsending; ingen nye tRPC-kontrakter, ingen ny Prisma-migrering.

- **Modus offline:** `organization_setting_local.timer_registreringsmodus` (lokal SQLite-kolonne, idempotent `ALTER` i `apps/mobile/src/db/migreringer.ts`) fylles fra `hentArbeidstidDefaults` ved synk (`organizationSettingKatalog.ts`). `lesTimerModusLokalt` gir siste cachede verdi; mangler den, gjelder `dagskort`.
- **Samleside (`timer/[id]`, `ProsjektkortSamleside.tsx`) — erstattet av `ProsjektkortDagsoversikt` i `8afb3007` (ORDRE 36b), se under:** i L2 erstattet den i kortmodus blå sedel-boks, «Arbeidstid i dag», prosjekt-gruppene, «+ Legg til prosjekt» og Send med: topptekst «N prosjektkort · X t i dag», ett kort pr. prosjekt (navn, byggeplass, chips Arbeid/Maskin/Varer/Reise/Utlegg, chevron), «+ Nytt prosjektkort» (`ProsjektVelgerModal` → kortskjermen), stiplet «Dagens ramme» (fra–til, pause, bærer-kort, «Endre» = `RedigerArbeidstidModal`, og dagens byggeplass = arv-kilden), blå sumlinje og «Send dagen (X t)» / «Send på nytt» på returnert sedel. Bannere, `DagstotalBanner`, `DagskortSammenligning`, `ForslagValgSeksjon`, Gjenåpne og Slett var uendret. Komponenten `ProsjektkortSamleside` rendres ikke lenger; fra fila brukes bare `KortHode` (`app/timer/[id]/kort/[projectId].tsx:75`).
- **Kortskjerm (`app/timer/[id]/kort/[projectId].tsx`):** «dato · Prosjektkort · status», kortets hode (`KortHode`, samme som samlesiden), dagskortets `ProsjektGruppe` filtrert på prosjektet (ECO-bøtter, timer med maskin som underpost, tillegg, utlegg) og vareforbruk (`vareforbruk.hentMineForDato`; fra L3 sammenslått med lokale linjer og «+ Vareforbruk», se L3). Tomt kort: «Kortet lagres når første rad er lagt til.» — det finnes ikke på samlesiden før en rad er lagret.
- **Prosjektlås:** `ProsjektkortKontekst` (`prosjektkortKontekst.ts`) låser prosjektet i `TimerRadModal` — prosjektfeltet vises som grå tekst uten chevron (`ProsjektFelt`/`VelgerFelt` `laast`, fra 16c; i L2 var bare velgeren låst, feltet kunne fortsatt åpnes); byggeplass kan fortsatt velges, og arv-teksten heter «fra dagen» (`kortModusVisning`, `apps/mobile/src/lib/prosjektkortMobil.ts`). Når raden arver byggeplass (`byggeplassId = null`), viser rad-dialogen og første valg i byggeplass-velgeren dagskortets faktiske byggeplass, «Blokk A (fra dagskortet)» / «(fra dagen)», eller «Ingen byggeplass» når sedelen ikke har en på radens prosjekt (`arvetByggeplassVisning`, samme fil; ORDRE 18). Dagskort-skjermen har ingen provider og er uendret.
- **Tall:** samme delte funksjoner som web; lokale rader mappes i `prosjektkortMobil.ts` (`projectId` null → sedelens, reise via `erReiseRadVisning`, maskin uten egen byggeplass).
- **Tom samleside:** «Ingen prosjektkort ennå. Velg «Nytt prosjektkort» for å registrere timer.» (`timer.prosjektkort.ingenKort`, fra 16c — samme på web-samlesiden; dagskortet beholder `timer.detalj.ingenProsjektGrupper`).
- **Ikke i L2:** pivot, attestering, lønnseksport, GPS, syncBatch, «+ Vareforbruk».

### Prosjektkort L3 — vareforbruk fra kortet — 🟡 `feat/prosjektkort-l3` (2026-11-06, ikke merget)

Kenneth-vedtak «A» (2026-11-06): «+ Vareforbruk» på det åpne prosjektkortet, web og mobil. Ingen Prisma-migrering; kun additive, valgfrie tRPC-felt. Dagskortet og vareforbruk-siden under prosjektet er uendret i atferd.

- **API (`apps/api/src/routes/vareforbruk.ts`):** ny `vareforbruk.katalogForFirma({ organizationId })` — firmamedlem (`verifiserOrganisasjonTilgang`), FORBIDDEN når Varelager er av for firmaet; svarer med aktive varer (kun id, navn, enhet, varenummer — ingen priser) og `prosjektIderMedVarelager` (brukerens aktive prosjekter i firmaet der Varelager er aktivt). `vareforbruk.opprett` tar valgfri `id` (klient-uuid): samme id sendt på nytt returnerer den eksisterende raden (idempotent offline-sending).
- **Delte regler (`packages/shared/src/utils/prosjektkort.ts`):** `visVareforbrukKnapp` (Varelager aktiv for prosjektet og kortet ikke låst), `kortDagsseddelId` (sedelens id kun når kortet har en timerrad for prosjektet; `projectId` null arver sedelens), `kortVareforbrukInput` (prosjektet låst til kortets) og `slaaSammenVarelinjer` (server + lokale linjer, dedup på id — ingen dobbelttelling).
- **Web:** «+ Vareforbruk» på det åpne kortet (`apps/web/src/app/dashbord/timer/[id]/page.tsx`) åpner `KortVareforbrukModal` (`apps/web/src/components/timer/`): prosjektet låst, valgfri byggeplass, `dagsseddelId` fra sedelen. Vare-velgeren er trukket ut som felles `VareVelger` (`apps/web/src/components/varelager/VareVelger.tsx`), også brukt av vareforbruk-siden under prosjektet. Linjene vises «varenavn · mengde · enhet».
- **Mobil:** katalog-cache `vare_local` pr. firma (`apps/mobile/src/services/vareKatalog.ts`, full overskriving; nett-/tokenfeil kaster før delete og bevarer cachen; FORBIDDEN/NOT_FOUND = ingen vareføring). Prosjektene med Varelager lagres i SecureStore (`sitedoc_varelager_prosjekter`). Kortskjermen `app/timer/[id]/kort/[projectId].tsx` får «+ Vareforbruk» (`KortVareforbrukModal` i `src/components/timer-detalj/`) som skriver til `vareforbruk_local` — virker offline. `syncVareforbruk` (`src/services/vareforbrukSync.ts`) sender i `TimerSyncProvider` etter timer-synken: linjen venter mens sedelen er pending/conflict; synced sedel → sendt med `dagsseddelId` når kortet har timerrad for prosjektet, ellers uten kobling; mangler sedelen eller er den avvist → sendt uten kobling. BAD_REQUEST/FORBIDDEN/NOT_FOUND/CONFLICT/PRECONDITION_FAILED (Varelager slått av) → `avvist` med feilmelding; andre feil lar linjen stå pending. Ved `dato_kollisjon` nøkler `forsonSedelIdentitet` (`timerSync.ts`) også om `vareforbruk_local.sheet_id`. Lokale linjer slås sammen med `hentMineForDato` på kortskjermen og samlesiden; ventende linjer merkes «Venter». Avviste linjer vises med feilmelding, men telles ikke i Varer-summen (`telteKortVarer`, `apps/mobile/src/lib/prosjektkortMobil.ts`).
- **Låste linjer:** kortet endrer eller sletter ikke varelinjer — retting skjer i Varelager.
- **Kjent følge-funn (ikke rettet):** vareforbruk-siden under prosjektet bruker `vare.list`, som er firma-admin-only — arbeidere får feil der. Kortet bruker `katalogForFirma` og er ikke berørt.
- **Ikke i L3:** pivot, attestering, lønnseksport, GPS, syncBatch. Logout tømmer ikke `vareforbruk_local` (`user_id` er lesevakt, som andre lokale tabeller).

### 🔴 Prosjektkort og dagskort — definisjon (Kenneth 2026-11-16, styrende)

Denne seksjonen er fasit for hva et prosjektkort og et dagskort er. Tekst lenger ned som sier noe annet, er merket ⚠️ og peker hit.

> Kenneth 2026-11-16: *«vi skal bygge opp et dagskort … ved å summere opp de prosjektkortene som bygges innenfor et døgn. Dersom vi er en time innom 10 forskjellige prosjekter, da består dagskortet av 10 prosjektkort.»* · *«Prosjektkort → det er et kort som registreres på et prosjekt → det kan føres flere prosjektkort på samme prosjekt dersom arbeidets art må deles opp → overtid er ikke å anse som nytt arbeid.»* · *«underprosjekt er en del av kortet. men dersom underprosjekt benyttes, så er det ikke sikkert at byggeplass benyttes.»* · *«timeføringer må kunne være dynamiske, men vi skal foreslå mest mulig, og bruker skal kunne endre. om vi treffer 80% rett på timeføring, da har vi lykkes.»* · *«Det er oversiktlig registrering som er viktig. Den ansatte må kunne lese at radene er riktig ført.»*

- **Dagskortet:** én ansatt har ett dagskort pr. døgn (én dato, 00–24). Dagskortet er summen av den ansattes prosjektkort det døgnet — 1 til 30 prosjektkort. Ti prosjekter på én dag = ett dagskort med ti prosjektkort.
- **Prosjektkortet** registreres på ett prosjekt. Underprosjekt er en del av kortet. Byggeplass er en del av kortet når den brukes; et kort med underprosjekt trenger ikke ha byggeplass.
- **Flere prosjektkort på samme prosjekt** føres når arbeidets art må deles opp, også med samme byggeplass og underprosjekt. Eksempel: grøftegraving (kontraktsarbeid) og legging av skifer (regningsarbeid) = to kort. Brukeren sørger selv for oppdelingen.
- **Splitt av automatisk opprettede føringer:** brukeren må kunne dele en foreslått føring (GPS/auto) i flere prosjektkort for å fange endrings- og regningsarbeid.
- **Overtid er ikke nytt arbeid:** overtid er egen rad (egen lønnsart) og vises som egen linje i kortet, men deler aldri kortet. Overtid måles mot dagens registrerte tid, også ved manuell føring (se V21-blokka).
- **Dagskortet holder orden på døgnets registreringer** (Kenneth 2026-11-16): når et nytt prosjektkort bygges (GPS eller manuelt), foreslås lønnsarten ut fra det som alt er registrert i døgnet — normaltid til normen er brukt opp, deretter overtid. Den ansatte kan overstyre (f.eks. ordinær tid avtalt med sjefen). Reise teller ikke mot normen (V1). **Fravær teller heller ikke** (Kenneth 2026-11-16): arbeid etter fravær — f.eks. timer ført i ferien — er vanlig arbeidstid, ikke overtid. Fravær og arbeid samme dag sperres ikke (3 t arbeid og så syk resten av dagen er gyldig); vurderingen er den ansattes og lønnsansvarliges. Det gjelder også fravær på en linje i kortet som bygges: kort 08–17 med fravær 08–15:30 gir 15:30–17 normaltid — fraværstiden jobbes inn, privat ærend gir aldri overtid (Kenneth 2026-11-16, spec B9): står normallinja på fravær, regner `beregnSegment` (`apps/mobile/src/utils/dagsforslag.ts`) arbeidet etter fraværet på nytt mot den samme normresten (`klassifiserArbeidstid` med `bruktAvNorm`) — linja `arbeid` er normaltid, overtid først når arbeidet passerer normen (🟡 `fix/kort-a3-lonnsart-linje`, ikke merget). Fravær trekkes fra i `bruktAvNorm` (`packages/shared/src/utils/lonnsregel.ts`, `erFravaer` satt av `lesEksisterendeSedel` i `apps/mobile/src/services/dagsforslagInput.ts` fra lønnsartens `type = 'fravaer'` — 🟡 flyttet i `fix/kort-a2-norm-shared`); ingen sperre og ingen varsel (ORDRE (28), spec B8; 🟡 `fix/kort-a3-lonnsart-linje`, ikke merget).
- **Hver linje viser lønnsarten timen tilhører** (Kenneth 2026-11-16): tid, timer og lønnsart på hver linje i prosjektkortet, f.eks. «07:00–15:00 · 7,5 t · Timelønn» og «15:00–17:00 · 2,0 t · Overtid 50 %».
- **Ett kort:** én beskrivelse og ett sett maskin/varer pr. kort, og aldri to datoer (ORDRE 24, se § «Én beskrivelse pr. prosjektkort»).
  - **Maskin og varer i dagskortet (Kenneth 2026-11-16):** *«jeg syns varens og maskinens måte å bli registrert i kortet fungerte godt. men de skal være knyttet til prosjektet - underprosjekt/byggeplass».* Registreringen er som i radform (`radBoks`, før `dd1d2926`): `kortLinje` i `ProsjektkortDagsoversikt.tsx` har «+ Vare» ved hver linje (ny vare får linjas id, `setVareRadId(rad.id)`) og viser linjas maskin og varer under linja; «Uten rad» står i kortet de hører til; kort uten arbeidsrad har «+ Maskin»/«+ Vare» som før. Tilhørigheten er prosjektkortet (prosjekt + underprosjekt/byggeplass), ikke linja: kort-id på `sheet_machines` og `vareforbruk` (spec `prosjektkort-kortid-spec.md` § 2, ordre b). I dag har `Vareforbruk` bare `projectId` + `byggeplassId` + `sheetTimerId`, ikke underprosjekt (`packages/db-varelager/prisma/schema.prisma:77–88`). Kort-id kommer i b.
- **Forslag, ikke fasit:** systemet foreslår mest mulig; brukeren kan endre alt. 80 % riktig forslag = lykkes.
- **Lesbarhet:** den ansatte skal kunne lese av kortet at radene er riktig ført (prosjekt, underprosjekt/byggeplass, tid, lønnsart inkl. overtid).
- **Rader slås aldri sammen** (Kenneth 2026-11-12): brukerens oppdeling av dagen kan ha fakturagrunn.

**Dagskortet i kode** (🟡 `fix/kort-a-overtid-dagskort` (ORDRE 27b, 2026-11-16, ikke merget)): `ProsjektkortDagsoversikt.tsx` viser ett prosjektkort (`prosjektkort`) pr. `kortNokkel` (`apps/mobile/src/lib/prosjektkortMobil.ts`, ingen egen kopi), gruppert av `grupperPaaKort` (`apps/mobile/src/utils/dagsoversiktRader.ts`). Radene står som linjer i tidsrekkefølge (`kortLinje`: «07:00–15:00 · 7,5 t · Timelønn»); overtid er en linje og deler aldri kortet. Én beskrivelsesblokk pr. kort; maskin og varer under linja de ble ført fra (se «Maskin og varer i dagskortet»). Trykk på en linje åpner `TimerRadModal` for raden; på kortskjermen (`enkeltProsjekt`) åpner prosjektnavnet kortets første linje, ellers kortet. Kortet viser bare én sedel (`useProsjektkortSedel.ts`: `sheetTimerLocal.dagsseddelId = sheetId`, sedel unik pr. bruker og dato), så to datoer havner aldri i samme kort. Tester: `dagsoversiktRader.test.ts` («(27b)»).

🟡 **Avvik mellom definisjonen og koden (målt 2026-11-16, ikke bygget; avvik 2 og 4 er bygget i ORDRE 27b, numrene beholdes):**
- **Avvik 1** — Bekreft dag: kortet er prosjekt + byggeplass; underprosjekt er ikke med og lagres ikke på kortet (`apps/mobile/src/utils/beskrivelseKort.ts:7`).
- **Avvik 3** — Kortet har ingen egen identitet: det utledes av `kortNokkel` = prosjekt|byggeplass|underprosjekt (`apps/mobile/src/lib/prosjektkortMobil.ts`). To kort på samme prosjekt med samme byggeplass og underprosjekt (grøft/skifer) kan derfor ikke skilles. **Kenneth 2026-11-16: «ja, legg til kort-id».** Hver rad (timer, maskin, varer, tillegg/utlegg som hører til kortet) skal bære kortets id, så to kort på samme prosjekt, byggeplass og underprosjekt holdes adskilt. Skjemaendring (additiv migrering, Kenneth kjører); spec før kode.
- **Avvik 5** — Splitt av foreslått føring til eget prosjektkort: ikke målt om «Del opp» (`SplittRadModal`) kan gi et nytt kort.

### Attesteringens grunnlag (ordre d2a) — 🟡 `feat/kortid-d2a-grunnlag` (2026-11-16, ikke merget)

Serveren leverer alt attesteringen trenger for å vise kortene; skjermen er uendret til d2b. Leserne (`hentTilAttesteringFirma` — fra w10b også prosjektlederens liste, med hans omfang — og `hentForAttestering` i `apps/api/src/routes/timer/dagsseddel.ts`; prosjektlista `hentTilAttestering` er fjernet i w10b) gir i tillegg:
- `varer[]` pr. sedel, med `sheetTimerId` og `kortId`;
- navn på byggeplass og underprosjekt pr. rad, for alle sedelens prosjekter;
- `utleieEnhet` og `manglerTimerad` (R24) pr. maskinrad;
- `rettedeFelter` (felt, verdien før, hvem, når) pr. rad;
- `ukeAvvikRadIder`;
- utleggene i detaljen;
- maskinene i prosjektlista.

Radene står i rekkefølge på fra-tid. Grupperingen i kort (`grupperPaaKort`), regelen for maskin uten timerad og prosjektnummeret (E4) ligger i `packages/shared`. Oppslagene for maskin, byggeplass og underprosjekt er flyttet fra `rapport.ts` til `apps/api/src/services/timer/kortLeser.ts`, og `detaljEksport` gir samme svar (vakt i `kortid-d2a.integration.test.ts`). Kode og tester: [prosjektkort-kortid-spec.md § 12.9](prosjektkort-kortid-spec.md).

Skriveveiene (commit 2):
- `redigerSedelRader` retter radene på stedet: samme id, kort-id og kobling maskin og vare → timerad. Bare endrede og slettede rader får historikkpost.
- `rettRadFelt` retter ett felt på én ventende rad med de samme kontrollene.
- `gjenaapneRader` gjør attesterte rader ventende igjen; en ferdig attestert sedel går tilbake til sendt.
- `splittRad`/`splittRadEier`: første del beholder timeradens id, og delte maskinrader arver koblingen.
- R24: en maskin som krever timerad kan ikke stå igjen uten kobling etter en retting.
- `vareforbruk.oppdater` logger antallet før, og sperrer en vare på attestert timerad.

Web-timeføring w5 (🟡 `feat/web-timer-w5`, ikke merget, `apps/api/src/routes/timer/dagsseddel.ts`):
- **B10:** retting ved attestering (`redigerSedelRader`, `rettRadFelt`, `delJobb`) krever attesteringsrett på prosjektene som røres (`krevRettingVedAttestering` → `krevAttesteringsrett`), ikke lenger firma-admin. Firma- og prosjektgrensen sjekkes som før, og «rediger ved attestering» må være på.
- `flyttTimerRadEco` tar `helJobb`: alle rader på kortet (timer, maskin, tillegg, utlegg, varer) får underprosjektet; kortets id beholdes.
- `delJobb` deler en jobb ved et klokkeslett (`jobb-deling.ts`). Del A beholder kortet, del B får ny kort-id og valgt underprosjekt. `forhandsvis: true` skriver ingenting. Bare innsendte sedler der alle jobbens linjer venter. ⚠️ § 8.22 (🟡 `feat/web-timer-forenkle`): maskin og varer blir i A og kobles om til en rad i A (`velgTimeradForMaskin`); `maskinKrysserKl` er fjernet. Avvises fortsatt når maskintimene på en delt rad er flere enn del A. Vakt: `w5-retting-ved-attestering.integration.test.ts`.

Web-timeføring w7 — B15 egne timer (🟡 `feat/web-timer-w7`, ikke merget, `apps/api/src/routes/timer/dagsseddel.ts`):
- `krevIkkeEgenSedel`/`krevIkkeEgenSedelPaaId` avviser (FORBIDDEN, `EGNE_TIMER_FEILTEKST`) når attestanten eier sedelen og firmaet har «Attestant kan attestere egne timer» = Nei (standard; manglende innstillingsrad = Nei). Gjelder elleve prosedyrer: `redigerSedelRader`, `flyttTimerRadEco`, `delJobb`, `attesterRader`, `returnerRader`, `gjenaapneRader`, `gjenaapneAttestering`, `rettRadFelt`, `splittRad`, `attester`, `returner`. Et utvalg med én egen sedel avvises helt. Eierens egne veier (`gjenaapneDagsseddel`, `splittRadEier`, `syncBatch`) og lesing sperres ikke.
- `hentTilAttesteringFirma` og `hentForAttestering` setter `egneTimer` pr. sedel (`egneSperredeSedler`). Web: linjen er utenfor konteksten (`linjeIKontekst`), uten avkrysning og knapper; merket «Egne timer» står i handlingscellen der knappene ellers står (`egenMerke`, `AttesteringTabell.tsx`), ikke i Avvik-kolonnen (for smal ved 1 440). Mobil: knappene skjules og merket vises (krever OTA).
- Firma → Innstillinger, under «Rediger ved attestering»: Ja/Nei-bryter (`organisasjon.oppdaterSetting.tillattSelvAttestering`). Advarselen om attestant uten annen attestant (§ 4.3) er ikke med.
- Vakter: `w7-egne-timer.integration.test.ts` (alle elleve med Nei/annen attestant/Ja), `selvattestering-migrering.test.ts`, `attestering-tabell.test.tsx` § w7.

### Sperren ved føring på PC (ordre d2c-1) — 🟢 merget `274e7fb2` 2026-11-16, ikke deployet

R24 gjelder nå også når arbeideren fører på PC (`apps/api/src/routes/timer/dagsseddel.ts`):
- `maskin.tilfoy` og `maskin.oppdater` tar `sheetTimerId`. De avviser en maskin som krever timerad (alt unntatt `doegn`, H15 = A) når den mangler gyldig kobling. En oppgitt kobling må være gyldig også for døgn-maskin. Koblet maskin følger timeradens kort-id.
- `fjernTimerRad` tar `slettMaskiner`. Står det maskiner som krever raden på den, avvises slettingen uten flagget, og maskinene navngis. Med flagget slettes de sammen med raden. Døgn-maskiner og varer blir stående uten kobling.
- `oppdaterTimerRad` avviser reise og 0 timer på en rad som bærer en slik maskin.
- Web (`timer/[id]/page.tsx`): maskin ført i timerad-vinduet får radens id. Maskinvinduet har nedtrekket «Timerad», forvalgt når kortet har én arbeidsrad. Sletting av en timerad med maskin krever bekreftelse som navngir maskinene.
- **Automatisk kobling (w9-tillegget, 🟡 `feat/web-timer-w9`, ikke merget):** mangler en maskin som krever fører en gyldig kobling, kobler serveren den selv til en timerad i samme jobb (`kortId`) med arbeid — i `maskin.tilfoy`, `maskin.oppdater` og attestantens `redigerSedelRader`/`rettRadFelt` («Rediger arbeid»). Raden velges med `velgTimeradForMaskin` (`packages/shared/src/utils/maskinKobling.ts`): størst overlapp i fra–til, ellers flest timer, så tidligste fra-tid. Koblingen skjer i transaksjonen etter skrivingen og `sikreKortId` (`koblMaskinerTilJobb`, `apps/api/src/services/timer/maskinJobbVakt.ts`). Sperren fyrer bare når jobben ikke har arbeid: `feilNokkel` `timer.maskin.utenArbeidAvvist`, uten «timerad»/«prosjektkort». En oppgitt kobling som er ugyldig, avvises som før; en uendret ukoblet eldre rad røres ikke. Tester: `kortid-d2a.integration.test.ts` (T70) og `kortid-d2c1.integration.test.ts`.

Telefonen fører lokalt og synker med `syncBatch`, som er uendret (vakt i `kortid-d2c1.integration.test.ts`). Telefonens sperre kommer i d2c-2. Kode og tester: [prosjektkort-kortid-spec.md § 12.10](prosjektkort-kortid-spec.md).

### Sperren ved føring på telefonen (ordre d2c-2) — 🟡 `feat/kortid-d2c2-mobil`, ikke merget

R24 gjelder nå også når arbeideren fører på telefonen, uten nett:
- Maskinlista lagrer maskinens utleieenhet lokalt (`equipment_local.utleie_enhet`). Ukjent enhet krever timerad.
- Maskinvinduet har feltet «Timerad» i begge moduser, forvalgt når det er én arbeidsrad. Uten valgt timerad lagres ikke en maskin som krever det. Døgn-maskin kan stå uten.
- Prosjektkort-modus: sletting av en timerad med maskin krever bekreftelse som navngir maskinene, og de slettes sammen med raden. «Flytt» av maskin går til en timerad i målkortet. Splitt arver koblingen.
- En timerad som bærer en slik maskin, kan ikke bli reise.

Kode og tester: [prosjektkort-kortid-spec.md § 12.12](prosjektkort-kortid-spec.md).

### Attesteringstabellen (ordre d2b-1) — 🟢 merget 2026-11-16, ikke deployet

Sedler-fanen på `/dashbord/firma/timer/attestering` er en tabell (`AttesteringTabell.tsx`, modell `attestering-tabell.ts` i `apps/web/src/components/attestering/`):
- Én dag er én dagsseddel. Under den står prosjektsedlene, hver med en oversiktsrad (✓ / ↩ / ↺ for hele kortet), og linjene. Reise står som eget kort først.
- Dagsumraden nederst har «Attester dagen» (`attester`), i attestert-fanen «Gjenåpne dagen» (`gjenaapneAttestering`, samme vindu som før), og lenke til sedelen. Ingen retting der (§ 12.8.5).
- Linja har ✓ / ↩ / ↺ (`attesterRader` / `returnerRader` / `gjenaapneRader`), ✂ (`SplittRadModal`) og penn (`RedigerRadModal`) som synlige knapper i den faste høyrekolonnen.
- Retting i cella (`rettRadFelt`) når firmaet tillater retting ved attestering og linja venter: Enter eller Tab lagrer, Esc angrer. Avvisning står i cella. Rettede felt viser «var …».
- Sperrer (B10 fraværstak, V19 uavklart forslag) står i Avvik og stopper ✓. «Attester utvalget» tar de avkryssede linjene, eller alle synlige ventende, og sier hvor mange som ble stående.
- Én verktøylinje: uke, visning, «Velg parameter», «Bare oversiktsrader», «Ukeoversikt» (ansattpivoten, lukket som standard), filterbrikker og teller. Filter, sortering og «Bare oversiktsrader» gjelder besøket; kolonnevalg, rekkefølge og bredde lagres under `timer-attestering`.
- Erstatter `SeddelKort`, ekspanderknappene og «Attester gruppe». Hover-dagskortet over ansattnavnet er fjernet (Kenneth 2026-11-16: ja, tabellen viser linjene og dagsummen direkte). Matpause vises i Pause-kolonnen. Pivotvisningene er uendret.
- Rapportens Detaljer bruker samme `TimerRadTabell` og kolonneliste (`TIMER_TABELL_KOL`), uten sortering og filter.

Kode og tester: [prosjektkort-kortid-spec.md § 12.11](prosjektkort-kortid-spec.md).

> ⚠️ **Endret i w10a** (🟡 `feat/web-timer-w10a`, ikke merget; plan § 4.5, § 8.9, [web-timeforing-plan.md § 9.5](web-timeforing-plan.md)): linjene har ingen knapper og ingen avkrysning, og cellene er bare lesing. ✓ ↩ ↺ og avkrysningen står på jobbraden og dagsraden (et kryss på dagsraden velger alle jobbene). «Attester utvalget» tar hele jobber, også linjer filteret skjuler (`byggJobbUtvalg`, `attestering-tabell.ts`), og knappen teller jobber. Retting skjer i registreringen (`RegistreringPanel.tsx`): fra, til og pause som felt (`TidFelter`) på timebaserte lønnsarter (`satsEnhet` null/`per_time`, `erTimebasertLonnsart`; `per_km`/`per_dag`/`per_natt` beholder tallfeltet for antallet), urørte felt viser lagret `timer` og timene regnes ut først når et felt endres, og ett `rettRadFelt` sender `fraTid`, `tilTid`, `timer` og `pauseMin`; avvisning setter feltet tilbake (også tallfeltet) og står ved linjen. ✂ og «Rediger jobben» står i kortet. Lønnsartvalget følger linjetypen: en reiselinje (`erReise`) tilbyr bare reisearter, en arbeidslinje ingen (`tillatteLonnsarter`, regelen er `erReiseLonnsart`). Del 3 viser radenes «Hva gjorde du?», aldri aktiviteten; «Ikke utfylt» når teksten mangler, og dagens «Kommentar» under. Kolonneoppsettet lagres under `timer-attestering-v2` (gamle oppsett nullstilles én gang).

### Attesteringen på samme tabell overalt (ordre d2b-2) — 🟡 `feat/kortid-d2b2-attestering` (2026-11-17, ikke merget)

- «Sedler», «Etter prosjekt» og «Etter ansatt» på `/dashbord/firma/timer/attestering` er samme tabell med ulik gruppering (`gruppering`-prop i `AttesteringTabell.tsx`, `grupperModell` i `attestering-tabell.ts`). Pivotene og nedtrekkene er borte; filtrering skjer i kolonnehodet.
- «Ukeoversikt» (`Ukeoversikt.tsx`) står over tabellen: timer pr. dag fra tabellens linjer, norm og avviksbadge pr. ansatt, klikk på dag filtrerer tabellen, hover på tallet viser dagskortet med prosjektet i hodet.
- 🟡 w10b (`feat/web-timer-w10b`, ikke merget): siden heter nå `/dashbord/attestering` (den gamle firma-adressen sender dit) og er ÉN attestering for firma-admin og prosjektleder. Serveren avgjør omfanget (`attesteringsOmfang` i `dagsseddel.ts`, likt `attesteringsFirmaer` pr. prosjekt): firma-admin ser hele firmaet som før; prosjektlederen ser sedlene med rader på sine prosjekter, attesterer bare dem, og navn på andre prosjekter, underprosjekter og byggeplasser skjules (R13). Menyen viser «Attestering» i FIRMA-sonen for begge. Prosjekt › Attestering er fjernet (§ 4.10, B29 B): `/dashbord/[prosjektId]/timer/attestering` (+ `/[id]`) og `…/godkjenning` sender til `/dashbord/attestering` (+ `/[id]`) uten prosjektfilter; serverens `hentTilAttestering`, `kanAttestere`, `erProsjektLeder`/`krevProsjektLeder` og `dagsnormerFor` er slettet, og isolasjonstestene (§ 4.10 del D) går mot firmalista med prosjektleder-omfang. Plan: [web-timeforing-plan.md § 4.6, § 4.10](web-timeforing-plan.md).
- Prosjektlederens attestering (fra w10b `/dashbord/attestering` med `prosjektKontekst` = hans prosjekter; den gamle `/dashbord/[prosjektId]/timer/attestering` sender dit) og detaljsiden (`AttesteringDetalj.tsx`) bruker samme tabell. Linjer på andre prosjekter står nedtonet og kan ikke velges; uten tilgang heter de «Annet prosjekt» (serveren sender ikke navnet).
- Detaljer og grenser: [prosjektkort-kortid-spec.md § 12.12](prosjektkort-kortid-spec.md).
- 🟡 Oppfølger d2b-3 (`feat/kortid-d2b3`, ikke merget): ukeavviket heter «Avvik denne uka», detaljsiden har dagsnorm fra firmaets innstillinger, kvitteringen på et utlegg åpnes fra linja (miniatyr/binders, signert, bare for den som kan attestere raden), og navn på andre prosjekter, underprosjekter og byggeplasser sendes ikke uten tilgang — [prosjektkort-kortid-spec.md § 12.13](prosjektkort-kortid-spec.md).

### Kort-id på telefonen og fraværskortet (ordre c) — 🟡 `feat/kortid-c-mobil` (2026-11-16, ikke merget)

Avvik 3 over er løst på mobil: dagskortet, kortskjermen og Bekreft dag grupperer på kort-id (`KortValg.kortId`, `kortNokkel` i `apps/mobile/src/lib/prosjektkortMobil.ts`), så to kort på samme prosjekt, byggeplass og underprosjekt holdes adskilt. Bekreft dag har «Del til eget kort» (`tildelKortIder`, `apps/mobile/src/utils/kortIdForslag.ts`); «Flytt raden» har «Flytt til nytt kort»; «+ Nytt prosjektkort» gir alltid nytt kort. «Endre kort» til et prosjekt som alt har kort sjekker tidskollisjon med samme regel som lagring av en rad (`finnKortKollisjon` i `prosjektkort/kortRadFlytt.ts`); uten overlapp står kortene hver for seg med egen beskrivelse (Kenneth 2026-11-16, E1). «Sum i dag» og «Send dagen (N t)» tar med fraværstimer (`dagSumTimer`, E2). Maskin og vare som flyttes alene («Flytt raden»), og synkede varer etter server-flytt, får målkortets id (`flyttMaskinRad`/`flyttVareLokalt`, gate (70) A1). Fravær føres i eget fraværskort uten prosjekt («+ Fravær», `apps/mobile/src/utils/fravaerKort.ts`, `prosjektkort/fravaerKortLagring.ts`) med B10-taket; «Fravær til» (a3) er fjernet (F12 = A). Dagskort-modus viser fravær uten prosjekt i en lese-gruppe (F6, `apps/mobile/src/utils/dagskortFravaer.ts`). Full kode-liste, tester og avvik: [prosjektkort-kortid-spec.md § 8.2](prosjektkort-kortid-spec.md).

### Reisen i jobbens kort (w12, B32 B, B34 B) — 🟡 `feat/web-timer-w12`, ikke merget

Reiseraden bærer kort-id og står i jobbens kort på prosjektet. Spec: `web-timeforing-plan.md` § 4.11; `prosjektkort-kortid-spec.md` § 2.2–2.4.

- **Regelen:** `velgReiseKort` (`packages/shared/src/utils/reiseKort.ts`) velger blant jobbene på samme sedel og prosjekt — samme underprosjekt, så samme byggeplass (reisens egen mot jobbens effektive; reise uten byggeplass hopper over steget), så første jobb for utreise og siste for retur i kortenes rekkefølge (`jobbRekkefolge`). Uten retning: før første arbeid → første, ellers siste. Ingen jobb på prosjektet → eget kort av reisens nøkkel (`utledKortId`). Regelen endrer bare kort-id, aldri prosjekt, underprosjekt eller byggeplass.
- **Serveren:** `sikreKortId` (`apps/api/src/services/timer/kortId.ts`) regner plassen på nytt ved hver skriving av sedelen; attestert eller erstattet reise med kort-id flyttes ikke. Plassen skrives med rå SQL, så radversjonen (`updated_at`) står. `fjernTimerRad` kaller `sikreKortId` (å slette en jobb flytter reisen). Synken og forsoningen bruker ikke reisens kort-id fra klienten og K1-sjekker den ikke. `flyttTimerRadEco` flytter reisen alene; `helJobb` på en reiserad avvises (`reiseErIkkeJobb`). Vareoppslaget med oppgitt kort-id leser bare arbeidsrader. Valideringen sjekker K1 og K2 for reise (`validerKortInvariant`, `erReise`).
- **Grupperingen:** `grupperPaaKort` (`packages/shared/src/utils/kortGruppering.ts`) legger reise med kort-id sist i kortet (ut, uten retning, retur; hver på fra-tid). Hode, rekkefølge (`jobbRekkefolge`) og alder leses fra arbeidsradene; et kort med bare reise får hodet fra reisen. Reise uten kort-id står i reiseblokken som før.
- **Attesteringen på web** (`apps/web/src/components/attestering/`): reisen er en linje i jobben med Type «Reise», så ✓ ↩ ↺ på jobbraden tar den med (`attestering-tabell.ts`, `lagLinje`). Jobbraden viser arbeidstimene (`sumLinjer` gir `{ timer, maskintimer, reise }`; jobbraden viser `timer − reise`) og «reise X t» i grått ved siden av (`timer.attestering.tabell.reiseTimer`); dagsraden viser hele summen. «N jobber» teller ikke et kort med bare reise. Har jobben et underprosjekt og reisen ikke, står «Uten» på reiselinja (C6). Registreringen (`RegistreringPanel.tsx`): del 1–7 leser bare arbeidsradene; del 8 «Reise» viser hver reise med merket (`ReiseRadMerke`), fra/til, lønnsart (bare reise-lønnsarter) og ✂, og «Føres på» — underprosjektvalg som flytter reisen alene (`flyttTimerRadEco` uten `helJobb`), bare mens reisen venter; ellers tekst. Skjermbilder: `skisser-web-timeforing/w12-attestering-reise-i-jobben.png`, `w12-kort-del8-reise.png`.
- **Migrering:** `20261120120000_w12_reise_kortid` (bare data, Kenneth kjører); `CHECK (kort_id IS NOT NULL)` i neste utgivelse ([arkitektur.md](arkitektur.md)).
- **Tester:** `reiseKort.test.ts` og `kortId.test.ts` (shared); `apps/api/src/routes/kortid-skriveveier.integration.test.ts` («w12», én pr. skrivevei, eldre app, isolasjon, attestert reise, radversjon; negativkontroll: uten `sikreKortId` i sletteveien eller uten attestert-vakten → rødt); `reise-kortid-migrering.integration.test.ts` (utfylling og paritet); `kortGruppering.test.ts` (w12: sist i kortet, rekkefølge og alder fra arbeidsrader, reise alene, reise uten kort-id i blokken); `attestering-tabell-modell.test.ts` og `attestering-tabell.test.tsx` («w12»: H.7 like merker, ✓ tar reisen, sum, «Uten», del 8, «Føres på» uten `helJobb`, attestert gir tekst, H.9 lønnsart). Negativkontroller: reise i del 1–7, `helJobb` på «Føres på», sum uten reise, uten «Uten», alder fra alle linjer, reise i blokken → rødt.

### Reisens kort på serveren (w15c, B43 B, B44, B48 A, § 8.20) — ✅ merget til develop (`a690363d`)

Spec: `web-timeforing-plan.md` § 4.15 del E (regelen), del F punkt 2, rad w15c i del G og del H; LØSNING GODKJENT i `relay/inbox-web-timer-w5.md` (2026-11-21). Erstatter regel-avsnittet i § «Reisen i jobbens kort» over. Ingen ny kolonne; mobilen er urørt.

- **Regelen** (`velgReiseKort`, `packages/shared/src/utils/reiseKort.ts`): kandidatene er jobbene på samme sedel og prosjekt. **Byggeplassen er et krav** — reisens *effektive* byggeplass (egen, ellers sedelens når den hører til reisens prosjekt; samme lesning som nøkkelen) mot jobbens effektive; «uten byggeplass» er en egen verdi. **Et valgt underprosjekt er et krav**; reise uten underprosjekt tar jobbene «Uten» foran, ellers alle på byggeplassen (B48 A). Retningen velger som før. Ingen kandidat → `null` (eget kort).
- **Til annet kontor** — ⚠️ Utgått i «Reisens kort uten særregler» (§ 8.22, 🟡 `feat/web-timer-forenkle`). Sto slik: (`reiseKilde = "overforing"`, del E punkt 6): velger blant alle jobber på prosjektet uansett byggeplass. Ikke-retur som starter kl. ≥ dagens første arbeid på prosjektet → eget kort; før arbeid → jobben man kjører til; retur → siste jobb. Kontorreisen kjennes på kilden, ikke på manglende byggeplass.
- **Eget kort** (`egetReiseKort`): ⚠️ overføringsvarianten (`OVERFORING_KORT_BYGGEPLASS`) er fjernet (§ 8.22). `utledKortId` av reisens nøkkel, men `utledReiseKortId` når den id-en alt er kortet til en jobb på sedelen (jobb som har byttet underprosjekt og beholdt id-en, F25). `utledReiseKortId` (`packages/shared/src/utils/kortId.ts`) hasher med prefiks `reisekort|`, så den aldri blir lik en jobbs.
- **Serveren:** `sikreKortId` (`apps/api/src/services/timer/kortId.ts`) sender effektiv byggeplass til regelen og bruker `egetReiseKort`. ⚠️ § 8.22: regelen kjøres bare for reise uten kort-id; ingen reise med kort-id flyttes av `sikreKortId` (se under).
- **Linja «havner i»** i reisevinduet (`reiseHavnerI`, `apps/web/src/hooks/useManuellReiseWeb.ts`) får effektiv byggeplass, så den sier det serveren gjør. ⚠️ § 8.22: `reiseKilde` er tatt ut; ved retting får den lagret rad (`lagret`).
- **Attesteringen:** et kort med reise og utlegg/tillegg, men uten arbeid eller maskin, regnes som reisekort (`attestering-tabell.ts`, F31).
- **Migrering:** `20261121120000_w15c_reise_kort` (bare data, én setning, Kenneth kjører etter w12). Samme regel i SQL; rører bare `kort_id` på reiser som ikke er attestert/erstattet og står i feil kort. Telling før (`relay/sql/w15c-telling.sql`, spørring 5 = eksakt antall som flyttes, med tilfelle (b) for seg) og gate etter (`relay/sql/w15c-gate.sql`, tre spørringer = 0).
- **Reise uten prosjekt** (`project_id IS NULL`) røres ikke: den er ugyldig (plan FA16) og sperret av `sheet_timer_uten_prosjekt_chk`. `velgReiseKort` gir `null` (aldri fraværskortet), `sikreKortId` hopper over raden, og SQL-en har `project_id IS NOT NULL` — så md5 av NULL kan ikke tømme kort-id-en. Paritet testet med sperren løftet i en transaksjon som rulles tilbake (`reise-kortid-migrering.integration.test.ts`). `relay/sql/w15c-telling.sql` spørring 6 teller dem (alle / med kort-id; forventet 0).
- **Kjent tilfelle, ikke løst (§ 10-stil):** tillegg eller utlegg ført i et reisekort beholder kort-id-en sin (regel 2 i `prosjektkort-kortid-spec.md` § 2.3) når reisen senere flytter inn i en jobb — de blir stående i det gamle kortet (`apps/api/src/services/timer/kortId.ts`, reise-løkka endrer bare reiserader). Ingen data går tapt; kortet attesteres for seg.
- **Kjent avvik til w15f:** pennen på en reiselinje kalte `reiseHavnerI` uten `reiseKilde`. ✅ Rettet i w15f (under).
- **Tester:** `reiseKort.test.ts` (40, shared: byggeplass som krav, underprosjekt, kontor, bilde 8, `egetReiseKort`), `reise-havner-i.test.ts` (8), `reisevindu.test.tsx` (10; uten `reiseKilde` i `RK` → rød), `attestering-tabell-modell.test.ts` (F31), `kortid-skriveveier.integration.test.ts` § «w15c» (H 2, 6, 7, 9, 18, 19), `reise-kortid-migrering.integration.test.ts` § «w15c» (riktig kort pr. rad, stille tomhet, paritet w12 + w15c mot regelen, to kjøringer, urørte felt).

### Reisens kort uten særregler (§ 8.22 punkt 1–3, svar «1A, 2A») — 🟡 levert på `feat/web-timer-forenkle`, venter gate

Spec: `web-timeforing-plan.md` § 8.22 og raden i § 9; LØSNING og ORDRE 2026-11-21 i `relay/inbox-web-timer-w5.md`. Ingen migrering, ingen kolonne, mobilen er urørt (mobilens `reiseKilde «overforing»` tas imot som før).

- **Kortet følger reisens egne felt.** `sikreKortId` (`apps/api/src/services/timer/kortId.ts`) velger kort bare for reise uten kort-id (`velgReiseKort`, ellers `egetReiseKort`). En ny jobb, et tillegg, en vare, en slettet jobb eller en ny synk flytter ikke en reise som har kort.
- **Retting:** `oppdaterTimerRad`, `rettRadFelt`, `redigerSedelRader`, `forsonDagskort`, `flyttTimerRadEco`, `splittRad` og synken bruker `kortIdForSkriving` med lagret rad bare når raden var reise også før (`LagretKortRad.erReise`). Uendret prosjekt, byggeplass og underprosjekt → samme kort; endret → regelen velger på nytt. Splittet reise får regelens kort, aldri en tilfeldig id.
- **Samme skriving:** reise og arbeid i samme `syncBatch` havner i samme kort i begge rekkefølger (regelen kjøres etter at arbeidsradene er skrevet). Klientens kort-id brukes ikke for reise i synken.
- **Ingen kontorvariant:** `ReiseKortReise.overforing`, kontor-grenen i `velgReiseKort` og `OVERFORING_KORT_BYGGEPLASS` er fjernet (`packages/shared/src/utils/reiseKort.ts`). Migrerings-paritetstesten har en frossen kopi av w15c-regelen (`reise-kortid-migrering.integration.test.ts`).
- **Reisevinduet på PC** (`ReiseKort.tsx`, `useManuellReiseWeb.ts`): bare Tur og Retur. «Til annet kontor», «Før/Etter arbeid», overføringsforslaget første/siste dag i en periode (`løsOverforingKort`) og kontor↔kontor-kjøretiden (`hentKontorAvstanderForFirma`) er tatt ut. Ved oppmøtestedet står nedtrekket «Fra et annet kontor fra i dag» (`timer.reiseKort.annetKontorFraIDag`, ved ≥ 2 aktive kontorer): reisen regnes fra kontoret (matrisen kontor→byggeplass), `oppmotePeriode.overforing` kalles med `start` og sedeldatoen før raden, og raden lagres som vanlig reise. «Midlertidig: X fra dd.mm · Avslutt» og sperren for admin-satt midlertidig står.
- **Byggeplassperiodens første og siste dag** (gate 123 vilkår 1, § 8.22 punkt 2): kjøringen før første sted og etter siste sted er reise. `oppmoteForReise` (`useManuellReiseWeb.ts`) gir Tur på periodens `fraDato` og Retur på `tilDato` hjemstedet — `løsOppmote` uten byggeplassperioden, samme hjemsted som `finnOverforinger` — og reisen regnes med matrisen hjemsted→byggeplass. Raden lagres som vanlig reise (`reiseKilde "manuell"`), uten egen kortregel og uten `oppmotePeriode`-kall. Mellomdagene, Retur første dag og Tur siste dag er sperret (`byggeplassPeriode`). Testene står i `reisevindu.test.tsx`.
- **Linja «havner i»** og pennen (`page.tsx`, `ReiseRettVindu.tsx`) sender lagret rad (`lagret`) til `reiseHavnerI`: uendret sted → kortet raden står i.
- **Dagssiden:** reiselinja har ingen egen kontortekst, og kort med bare kontorreise får «+ Timer».
- **Maskin uten fra–til:** `MaskinRadDialog` har ikke Start kl./Slutt kl., pausefradrag, spenn↔antall-synk eller `timerAvvik`-sperren. Lagringen sender ikke `fraTid`/`tilTid`, så lagrede verdier står. Antall: «høyst» fra jobben, ellers tomt.
- **«Del opp»** (`delJobb`): maskin og varer koblet til en rad som går til B, blir i A og kobles til en rad i A (`velgTimeradForMaskin` over A-radene). `maskinKrysserKl` er fjernet; forhåndsvisningen er `{ timerA, timerB, maskinPaaA }`.
- **i18n:** ny `timer.reiseKort.annetKontorFraIDag`; fjernet `tilAnnetKontor`, `fraAnnetKontor`, `naar`, `forArbeid`, `etterArbeid` (bare web brukte dem). `annetKontor` og `overforing` står (mobil).
- **Tester:** `reiseKort.test.ts` (shared), `kortid-skriveveier.integration.test.ts` § «§ 8.22» (ny jobb/tillegg/vare/slettet jobb flytter ikke, retting med samme og nytt sted, `syncBatch` begge rekkefølger, senere synk), `w5-retting-ved-attestering.integration.test.ts` («Del opp» med maskin og vare), `reise-havner-i.test.ts`, `reisevindu.test.tsx`, `reise-terskel-dialog.test.tsx`, `reise-visning.test.tsx`, `jobb-vinduer.test.tsx` (maskin uten jobb uten fra–til), `attestering-tabell.test.tsx`.

### «Korrigert av» og pennen i attesteringskortet (w15g, § 8.20, F63–F83) — ✅ merget til develop (`4e2680ce`)

Spec: `web-timeforing-plan.md` § 4.15 del F (F63–F83), rad w15g i del G, del H pkt. 28, 29, 31–33, 37, 39, 40; LØSNING GODKJENT w15g i `relay/inbox-web-timer-w5.md` (2026-11-21, svar 1–4: feltene er F63, `TidFelter`/`TallFelt` i en `Modal`, F67 for seg, merket viser det attestanten satte). Skisse: `skisser-web-timeforing/w15g-losning.png`. Skjermbilder (1 440 px, lokal dev): `w15g-kortet.png` (kortet som tekst med ✎), `w15g-vinduet.png` («Rett timelinja» med linja om hva arbeideren ser), `w15g-dagen.png` (merket på linja hos arbeideren), `w15g-mine-timer.png` (merket på dagen i Mine timer). Ingen e-post, ingen migrering; `epost.ts`, `server.ts`, mobilen og dagskortet er urørt.

- **Kilden** (`apps/api/src/services/timer/kortLeser.ts`, `hentKorrigeringer` og `hentKorrigertAvPrDag`): regnes hver gang lista leses, lagres ikke. Hendelsene er historikkpostene (`sheetRadHistorikk`, verdiene før hver retting) som ikke er eierens egne og ikke gjenåpninger, pluss aktivitetsloggen for underprosjekt (`timer.eco-flyttet`/`tillegg.eco-flyttet` på raden, `jobb.eco-flyttet` på dagsseddelen — F78, ingen historikkpost). Feltene er `RETTBARE_FELT` pluss prosjekt, byggeplass og underprosjekt (`KORRIGERBARE_FELT`, F77). **Før** er verdien før første korrigering som endret feltet (F76). **Etter** er det attestanten satte (svar 4 B): loggposten med samme aktør og dagsseddel innen 60 s etter historikkposten — `nyeSnapshot` fra `rett_rad_felt`/`rediger_sedel_rader`, og `etterPrRad` (verdiene pr. rad-id for delene og radene som ble flyttet, skrevet av `splittRad` og `delJobb`, `apps/api/src/routes/timer/dagsseddel.ts`) fra ✂ (`splitt_rad`) og «Del opp» (`del_jobb`). Arbeiderens senere verdi står derfor aldri som attestantens. Grensen: uten loggverdi (eldre ✂- og «Del opp»-poster fra før w15g-returen, som mangler `etterPrRad`) brukes neste hendelses «før», ellers radens verdi nå. Felt der før = etter (fram og tilbake) vises ikke. Tall sammenlignes med to desimaler (kolonnene er `Decimal(6,2)`). Navn og tidspunkt er fra siste korrigering som endret et vist felt. Navnet er `User.name`; e-postadressen brukes aldri.
- **Leserne** (`apps/api/src/routes/timer/dagsseddel.ts`): `hentMedId` får `korrigeringer` (`{timer, tillegg, maskin}` pr. rad-id) og `list` får `korrigertAv` pr. dag (`{navn, flere}` eller null; `flere` = mer enn én attestant). Begge bare når `sheet.userId === ctx.userId`; andre (også firma-admin som kan lese dagen) får tomt. `list` gjør tre spørringer uansett antall dager.
- **Kjent grense:** bare for ✂- og «Del opp»-poster skrevet før `729182ad` (uten `etterPrRad`): endrer arbeideren linja etter en slik post, kan arbeiderens nye verdi vises som «etter». Poster skrevet etter `729182ad` bærer `etterPrRad` og har ikke grensen.
- **Merket** (`apps/web/src/components/timer/KorrigertMerke.tsx`): «Korrigert av Kari Leder 21.11. kl. 14:32» og feltene under («Slutt kl. <s>15:35</s> → 15:50»; id-felt med navn, tomt underprosjekt «Uten underprosjekt»). Uten navn «Korrigert ved attestering». Dagen (`apps/web/src/app/dashbord/timer/[id]/page.tsx`) legger `KorrigeringProvider` rundt `ProsjektkortSamleside`, og `KorrigertMerke` står på timelinja, reiselinja, maskinlinja og tilleggslinja — bare i prosjektkort-modus; dagskortet har ingen kontekst og ingen merke. Mine timer (`mine/page.tsx`) har `KorrigertAvDag` ved statusen.
- **Attesteringskortet** (`apps/web/src/components/attestering/RegistreringPanel.tsx`): ingen åpne felt (snur w10a A1). Timelinja, maskinlinja og tilleggslinja er tekst med ✂ og ✎, på vilkårene feltene hadde (`kanRette && ventende`, timelinja også `harHandling`). ✎ åpner `LinjeRettVindu.tsx`: fra, til og pause (timebasert lønnsart) eller timer, og lønnsart; maskintimer med «høyst» (over → «Lagre» sperret); antall. `TidFelter` og `TallFelt` har ny `onEndre`-modus (meldes, lagres ikke ved blur/Enter); uten `onEndre` som før. «Lagre» sender én `rettRadFelt` med feltene som er endret (`linjeRettKall`), «Avbryt» ingenting; avvisning står i vinduet, som blir stående. Linja i vinduet og i «Rediger arbeid» (`RedigerRadModal.tsx`, navnet fra `hentForAttestering.ansatt`) sier hva arbeideren ser. «✎ Rediger jobben», «Del opp», ✂, underprosjekt-knappene og «Rett reisen» er uendret.
- **Tester:** `apps/api/src/routes/w15g-korrigert-av.integration.test.ts` (14, ekte Postgres: pkt. 28 pr. vei i F60, 33 med to linjer, 37, 39, 40, svar 4 «15:35 → 15:50», vakt for andre brukere i begge leserne, tre spørringer i `list` for 1 og 6 dager; 14 røde mot develop `1ce5334e`). `apps/web/src/__tests__/web-timer-w15g.test.tsx` (7: pkt. 29 og 33; pkt. 33 rød på påstand mot `1ce5334e`). `attestering-tabell.test.tsx` § w10a skrevet om til vinduet (13) og ny § w15g pkt. 32 (6). `dagskort-vakt.test.tsx` grønn, ingen `.snap` endret. w5- og w15f-testene grønne (pkt. 31).

### Prosjektet på en reise (w15f, § 8.20, F46–F56) — ✅ merget til develop (`bda2aae4`)

Spec: `web-timeforing-plan.md` § 4.15 del E (reiselinja, fem felt), del F (F46–F56), rad w15f i del G, del H pkt. 20–27; LØSNING GODKJENT i `relay/inbox-web-timer-w5.md` (2026-11-21, beslutning a: avvis ved koblet vare/maskin; b: ingen medlemskapssjekk i `rettRadFelt`). Skisse: `skisser-web-timeforing/w15f-losning.png`. Mobilen, `RedigerRadModal`, firmavalget og dagskortet er urørt.

- **Pennen, serveren** (`oppdaterTimerRad`, `apps/api/src/routes/timer/dagsseddel.ts`): valgfri `projectId`. Ulikt radens: raden må være reise **etter** skrivingen og ikke «uten prosjekt», ellers BAD_REQUEST «Prosjektet kan bare byttes på en reise. Arbeid føres på en ny jobb.» Attestert/erstattet → PRECONDITION_FAILED. Sjekkene mot det nye prosjektet: `verifiserProsjekterTilhørerFirma` (sedelens firma), `verifiserProsjektmedlem` (arbeideren, F53), `krevByggeplassIProsjekt` og `krevEcoerIProsjekt` på effektiv byggeplass og underprosjekt — gamle verdier som ikke hører til det nye prosjektet avvises, ingen stille tømming. Kort-id-en legges av `sikreKortId` som før; retning, oppmøtested, kjøretid og kilde skrives ikke (F56).
- **Koblet maskin eller vare** (`krevIngenKoblingVedProsjektbytte`): en reise med maskin (`sheetMachine.sheetTimerId`) eller vare (`vareforbruk.sheetTimerId`) koblet til seg kan ikke bytte prosjekt; meldingen navngir dem («Reisen har maskinen «…» koblet til seg …»). Gjelder pennen og `rettRadFelt`.
- **Attestanten, serveren** (`rettRadFelt`): rett, B15, «pending», sendt sedel og firmavalget er uendret (F49). F51: nytt prosjekt uten `externalCostObjectId` → underprosjektet settes til `null`; med underprosjekt → `krevEcoerIProsjekt` mot det nye. Arbeiderens medlemskap sjekkes ikke (attestantens rett er grensen).
- **Funn, ikke rettet (F68):** `utforRedigerSedelRader` holder ikke timeradenes underprosjekt mot prosjektet. Lukket for `rettRadFelt` over; resten tas med F68.
- **Dagssiden** (`TimerRadDialog` i `apps/web/src/app/dashbord/timer/[id]/page.tsx`): prosjektfeltet er åpent når raden er reise og lønnsarten fortsatt er reise; låst for arbeid som før. Bytte tømmer underprosjektet og foreslår byggeplass (`velgStandardByggeplass`); bytter arbeideren lønnsarten bort fra reise, går prosjekt og sted tilbake. Prosjekt, byggeplass og underprosjekt sendes sammen bare når prosjektet er byttet.
- **Linja «havner i» (F55)** (`reiseHavnerI`, `apps/web/src/hooks/useManuellReiseWeb.ts`): får maskin-, tillegg- og utleggsradene (`andreRader`) og sedelens eier og dato, regner reisens `egetReiseKort` som serveren og sier «Står i kortet på …» (`havnerKort`) når et kort uten arbeid har den id-en; under terskel også `kortPaaSedelFraRader`. Pennen sender nå `reiseKilde` (w15c-avviket). `ReiseKort.tsx` sender de samme radene.
- **Attesteringen** (`apps/web/src/components/attestering/RegistreringPanel.tsx`, del 8): reiselinja er tekst «fra–til · lønnsart · prosjekt · byggeplass · underprosjekt» med ✂ og ✎. De åpne feltene (fra, til, lønnsart) og «Føres på» er tatt ut; lønnsarten på reisen rettes i «Rett reisen» (RETUR w15f under). ✎ står bare på en reise som venter, der attestanten kan attestere (ikke egen sedel).
- **«Rett reisen»** (`ReiseRettVindu.tsx`): start, slutt, lønnsart, prosjekt, byggeplass, underprosjekt og linja «havner i». Lønnsarten (RETUR w15f, gate 117, B48 A): bare reisearter (`tillatteLonnsarter` med `erReise: true` og firmaets reisekontekst fra `RegistreringPanel`), lagret med `rettRadFelt`, låst når firmavalget er av — «Rediger jobben» (`RedigerRadModal.tsx:158–159`) tar bare rader med samme underprosjekt og når ikke en reise uten underprosjekt i en jobb med underprosjekt. Start og slutt rundes bare når de er rørt, så et rent underprosjektbytte aldri sendes som ny tid. Prosjektlista: `prosjekt.hentForTimer` filtrert på `prosjektKontekst` (fra attesteringssiden via `AttesteringTabell`; `undefined` = alle). «Lagre» (`reiseRettKall`): firmavalget av → bare underprosjektet åpent, `flyttTimerRadEco`; bare underprosjektet endret → `flyttTimerRadEco` (uten `helJobb`); ellers ett `rettRadFelt` med de endrede feltene, også `lonnsartId` (prosjektbytte sender byggeplass og underprosjekt med). «Avbryt» sender ingenting. Etter lagring lukkes vinduet og tabellen hentes på nytt; ingen toast.
- **Tester:** `apps/api/src/routes/w15f-reise-prosjektbytte.integration.test.ts` (22, ekte Postgres: pkt. 20–23 + koblet vare/maskin; 15 røde mot develop `790848b8`, også F51), `reise-havner-i.test.ts` (12, 4 nye for F55), `attestering-tabell.test.tsx` § w15f (14, 4 fra RETUR — lønnsart i vinduet, låst ved firmavalget av, urørt tid rundes ikke, rørt tid rundes; 4 røde mot `b7df1911`; «Føres på»-testene erstattet, H.9 sjekker at del 8 ikke har lønnsart-select), `apps/web/src/app/dashbord/timer/[id]/w15f-penn.test.tsx` (5). Negativkontroll: prosjektfeltet låst, prosjektlista ufiltrert, ✎ på attestert → 3 røde. `dagskort-vakt.test.tsx` grønn.

### «Slett dagsseddel» sletter alt — bare utkast (S1) — ✅ merget `d35af35c`

Vedtak: `web-timeforing-plan.md` § 8.22 (Kenneth 2026-11-21, «det gir ikke mening å beholde 20% av registreringer»; K4 → A skjerpet: «returnert dag bør kun redigeres»).

- **Vakt:** `dagsseddel.slett` (`apps/api/src/routes/timer/dagsseddel.ts`, `krevSlettbar`) sletter bare `status = "draft"`. Returnert dag avvises alltid («En returnert dag kan ikke slettes. Rett den og send den på nytt.»), sendt og godkjent som før («Bare utkast kan slettes …»). Forsvar: attesterte timer-, tillegg- og maskinrader eller varer med `attestert_snapshot` gir «Leder har attestert rader … Be leder gjenåpne dem …». Erstatter Kenneth-vedtak 2026-10-09 (2) (returnert, ikke attestert kunne slettes).
- **Alt i én transaksjon** (`slettSedelMedAlt`): raden låses (`FOR UPDATE`) og vakten kjøres på nytt, så slettes vedlegg på tillegg og kvitteringer på utlegg (svak FK, ingen kaskade), varer med `dagsseddel_id` = sedelen (rå SQL mot `"varelager"."vareforbruk"`) og til slutt sedelen (kaskade: timer med reise, GPS-forslag, maskin, tillegg, utlegg). Timer og varelager er to Prisma-klienter mot samme `DATABASE_URL`, så Postgres ruller tilbake alt ved feil i ett steg. Dette er det ene stedet varer skrives i samme transaksjon som timer (ellers «egen database», jf. A7 under). Flyttes varelager til egen database, feiler vare-steget og hele slettingen ruller tilbake — dagen står.
- **Står med vilje:** varer uten sedel (prosjektets Vareforbruk-side, `dagsseddel_id IS NULL`); radhistorikken (`sheet_rad_historikk`, sporet etter rettinger, ingen FK); filene på disk — ingen sletting av vedlegg rører disken (`fjernTilleggVedlegg`, `fjernUtleggVedlegg` sletter bare raden; målt S1).
- **`dagsseddel.slettOversikt`** (query): antall timer, reise, maskin, varer, tillegg og utlegg, `kanSlettes` og `grunn` (meldingen `slett` ville gitt). Web: `SlettDagModal` (`apps/web/src/components/timer/SlettDagModal.tsx`) på dagssiden og i Mine timer lister linjene med antall > 0 og har én knapp, «Slett dagen». Knappen som åpner vinduet vises bare på utkast.
- **Telefonen** kaller samme prosedyre (dagskort og prosjektkort). Mobil-UI er ikke endret: telefonen tilbyr fortsatt sletting av returnert dag online og får serverens avslag.
- **Tester:** `apps/api/src/routes/timer/slett-dagsseddel-alt.integration.test.ts` (9, ekte Postgres: ingen rad med sedelens id i noen tabell i begge skjema, ny dag samme dato uten gamle varer, returnert dag med og uten attestert rad står, vare uten sedel står, feil i vare-steget og i siste steg lar dagen stå; 7 røde mot develops `slett`), `dagsseddel-slett-returnert.test.ts` (4), `apps/web/src/__tests__/web-timer-slett-dag.test.tsx` (4).

### Kortet pr. jobb på PC (w3a, A7) — 🟡 `feat/web-timer-w3a`, ikke merget

Tilleggene er hektet på jobben arbeideren fører timer på. Spec: `web-timeforing-plan.md` § 4.13 (A1, A6–A12) og § 8.13; beslutninger S1–S8 i `relay/inbox-web-timer-w5.md` (SVAR w3a, 2026-11-20).

- **Stedet følger timeraden (A7):** `oppdaterTimerRad` (`apps/api/src/routes/timer/dagsseddel.ts`) som bytter underprosjekt eller byggeplass, flytter koblede maskiner (`sheetTimerId` = raden, samme prosjekt) i samme transaksjon før `sikreKortId`, og koblede varer (egen database) rett etter med rå SQL. Varesynken kjøres ved hvert lagre av en rad med prosjekt, ikke bare ved bytte, og skriver bare varer der stedet er annerledes (`IS DISTINCT FROM`); et nytt lagre retter derfor en vare som ble stående. Feiler varekallet, er timerad og maskin likevel lagret: feilen logges med rad-id og sedel-id (`ctx.req.log.error`), svaret har `vareIkkeFlyttet: true`, og vinduet står åpent med «Timeraden er lagret, men varen på raden ble ikke flyttet …» (`timer.feil.vareIkkeFlyttet`) (gate 107). Attestert og erstattet maskin og attestert vare (snapshot satt) står (S5 A).
- **Maskin ført fra jobben (S4 C):** `maskin.tilfoy` med kort-id lagres med timeradens byggeplass og underprosjekt (`jobbStedForMaskin`: oppgitt timerad, ellers jobbens første arbeidsrad i prosjektet). Uten kort-id — dagskort-modus — lagres vinduets sted som før. `maskin.oppdater` tar ikke kort-id og er uendret.
- **Test, server:** `apps/api/src/routes/timer-a7-sted-folger.integration.test.ts` (1)–(7); (7) lar varekallet feile, sjekker `vareIkkeFlyttet` og loggen, og lagrer på nytt med samme verdi, så varen flyttes. Negativkontroll: med `stedEndret`-vakten tilbake er (7) rød.
- **Ikke rettet (funn 6):** attestantens `flyttTimerRadEco` uten `helJobb` og `rettRadFelt` flytter ikke koblet maskin og vare. Egen sak.
- **Varen på dagssiden:** `vareforbruk.hentMineForDato` (`apps/api/src/routes/vareforbruk.ts`) sender også `kortId` og `createdAt`, så web kan legge varen i jobbens kort. Bare lesing.
- **Ett kort pr. jobb på dagssiden (prosjektkort-modus):** `apps/web/src/app/dashbord/timer/[id]/page.tsx` grupperer med den delte `grupperPaaKort` (kort-id). `ProsjektkortSamleside` tegner ett `JobbKortRamme` pr. jobb: hodet har prosjekt, byggeplass · underprosjekt (`proAdmId kortNavn`) og merket «→ Godkjenning byggherre», og summerer bare jobben (Arbeid/Maskin/Varer/Reise). Linjene i rekkefølge: timelinjer med koblet maskin og vare innrykket under, egne maskiner, varer, tillegg, utlegg, reise. Hver linje har blyant og søppelkasse; varelinja (`RaderVare`) retter mengden i `KortVareforbrukModal` med `rad` (`vareforbruk.oppdater`) og sletter etter bekreftelse (`vareforbruk.slett`), attestert vare er låst. Lenkerad pr. jobb: «+ Timer», «+ Maskin», «+ Vare», «+ Reise», «+ Tillegg/Utlegg». Bøtteboksen, «Arbeidstimer (N t)» og «Maskin X t» finnes ikke i kortmodus (`ProsjektGruppe`/`EcoGruppe` brukes bare av dagskortet). Rader uten kort-id står i samlekortet «Ført uten jobb» sist, uten lenkerad. Prosjekt lagt til uten jobb får et tomt kort med «+ Timer». Ett kort åpent om gangen (S8 A); eneste kort åpnes av seg selv.
- **Vinduene arver jobben (S1–S7):** en jobb sendes som `JobbKontekst` (kort-id, prosjekt, byggeplass, underprosjekt, første arbeidsrad, spennet) til vinduet fra lenkeraden og fra blyanten på jobbens linjer. `TimerRadDialog` for en ny rad fra jobben viser da verken prosjekt, byggeplass eller underprosjekt, og ny rad sendes med jobbens kort-id og sted (byggeplassen via `useRadByggeplass` med jobbens verdi, så auto-forslaget ikke slår inn). `MaskinRadDialog` skjuler Timerad, byggeplass og underprosjekt; ny maskin får jobbens første arbeidsrad (`sheetTimerId`), kort-id og sted, og Fra–til foreslås fra jobbens spenn (S3 A). `KortVareforbrukModal` (`jobb`) skjuler prosjekt, timerad og byggeplass og sender jobbens første arbeidsrad, kort-id og sted (S2 A). Tillegg og utlegg via «+ Tillegg/Utlegg» → `LeggTilVelger` bærer jobben videre; `useRadSted` med `jobb` skjuler `RadStedFelt` og sender jobbens sted og kort-id på ny rad. `ReiseKort` har to valgfrie props, `forvalgtByggeplassId` og `forvalgtEcoId` (S6 A): feltene står, med jobbens verdier forvalgt. «Rediger timer-rad» fra blyanten på en timer- eller reiselinje står med feltene (`jobb && !rad` skjuler, gate 107): prosjektet låst som før, byggeplass og underprosjekt kan endres, så A7 nås fra kortet. Redigering sender ikke stedet når det er uendret. Dagskort-modus åpner vinduene uten jobb og er uendret.
- **Synken** (`syncBatch`) og `sikreKortId` er urørt. Ingen migrering (telling 2026-11-20: 0 koblede maskiner på annet sted enn timeraden i test, 0 maskinrader i prod).
- **Tester, web:** `dagskort-vakt.test.tsx` (snapshot av dagskort-markupen for #7-dagen, skrevet før web-endringen) og `prosjektkort-visning.test.tsx` § w3a (to kort for #7, maskin og vare under timelinja i TILL-001-kortet, ingen bøtte-tekster, lenkerekkefølgen, blyant/søppelkasse på vare og lås på attestert). `jobb-vinduer.test.tsx`: timer, maskin, vare og tillegg fra jobb 2 har ingen stedsfelt og sender jobbens kort-id og sted; reise har jobbens byggeplass og underprosjekt forvalgt; blyanten på en timer- og en reiselinje åpner «Rediger timer-rad» med feltene (prosjekt låst, underprosjekt åpent); dagskort-modus har feltene. Negativkontroll: uten `jobb` til vinduene er 5 av 6 røde, uten forvalget er reise-testen rød, med `!jobb` i stedet for `!(jobb && !rad)` er de to blyant-testene røde. Testdagen: `testdata-dag7.ts`.
- **Skjermbilder (1440 px, lokal seed, ved siden av `v12-jobbkort.png`):** `skisser-web-timeforing/w3a-dag7-jobb2.png` (#7: to jobbkort og samlekortet, jobb 2 åpen med maskin og vare under timelinja), `w3a-dag7-maskin-fra-jobben.png` (maskinvinduet fra jobb 2: utstyr, antall og Fra–til 15–16, uten Timerad/Byggeplass/Underprosjekt), `w3a-dag7-vare-lagret.png` (2 m3 ført med «+ Vare» står i jobb 2), `w3a-lastebil.png` (jobben 08–10 med lastebil 2 t, 5 m3 pukk og parkering). Løsningsskissen: `w3a-losning.png`.
- **Tester, server:** `apps/api/src/routes/timer-a7-sted-folger.integration.test.ts` — (1) underprosjekt og (2) byggeplass følger for maskin og vare, (3) ukoblet og annet prosjekt står, (4) attestert står, (5) tilfoy med kort-id får timeradens sted, (6) uten kort-id får vinduets. Negativkontroll: uten rettingen er (1), (2), (3) og (5) røde.

### Åpent kort etter «+ Registrer timer» (w15a, B41 A) — ✅ merget til develop (`d5ae514e`)

Spec: `web-timeforing-plan.md` § 4.15 del G og § 8.18; LØSNING GODKJENT i `relay/inbox-web-timer-w5.md` (2026-11-20). Bare `apps/web`, prosjektkort-modus.

- **Kortet er åpent:** dagssiden starter med `?nyttProsjekt` (prosjekt-id) som åpen nøkkel, men kortene har jobbens kort-id etter w3a. `loesAapentKort` (`apps/web/src/lib/registrerTimer.ts`) lar en prosjekt-id som ikke er et kort på dagen, åpne prosjektets eneste jobbkort; to jobber på prosjektet → ingen gjetning. Gjelder både «+ Registrer timer» på ny dag (steget «ferdig») og «Ny dagsseddel» (`timer/ny/page.tsx` sender `?nyttProsjekt`). Vinduet åpnes ikke på første jobb; jobb nr. 2 (`eksisterte=1`) åpner «Legg til timer-rad» som før.
- **Adressen ryddes:** når flyten er kjørt (alle steg unntatt «gjenåpne», og når gjenåpne-vinduet lukkes), gjør dagssiden `router.replace(adresseEtterRegistrering(...), { scroll: false })` — `registrer`, `nyttProsjekt` og `eksisterte` fjernes, `retur` står. Omlasting kjører ikke flyten og åpner ikke vinduet igjen.
- **Tester:** `apps/web/src/app/dashbord/timer/[id]/registrer-flyt.test.tsx` (3, alle røde før endringen) og `lib/__tests__/registrerTimer.test.ts` § `loesAapentKort`/`adresseEtterRegistrering`. `dagskort-vakt.test.tsx` + snapshot urørt.
- **Skjermbilder (1 440 px, lokal seed):** `skisser-web-timeforing/w15a-kort-aapent.png` (Timer → «+ Registrer timer» på ny dag 23.11.: jobbens kort åpent, ingen vindu, adressen bare `?retur`), `w15a-omlasting.png` (etter omlasting: samme, ingen vindu).

### «Ikke ferdig»: jobb uten «Hva gjorde du?» (plan § 8.22 L2) — 🟡 `feat/web-timer-l2-ikke-ferdig`, venter gate

Gjelder prosjektkort-modus (Kenneth 2026-11-21 «Ja, alle fire»). Dagskort-modus er urørt.
- **Regelen** (`packages/shared/src/utils/prosjektkort.ts`): `jobbManglerBeskrivelse(rader)` er sann når jobben har arbeidsrader og ingen av dem har tekst etter trim. Ett kort = én beskrivelse, som mobilens `manglerBeskrivelse` (ORDRE 24), så overtidsraden uten tekst gjør ikke jobben uferdig. Reise, erstattede rader og fravær uten prosjekt teller ikke. `jobberSomManglerBeskrivelse(rader)` gir jobbene i radenes rekkefølge, nøkkel kort-id, `rad:<id>` for rader uten kort-id. Test: `prosjektkort-beskrivelse.test.ts`.
- **Kortet** (`dashbord/timer/[id]/page.tsx`, `JobbKortRamme`): merket «Mangler beskrivelse» (`timer.dagsoversikt.manglerBeskrivelse`, gjenbrukt fra mobil) står i hodet også når kortet er lukket, bare på redigerbar dag. Samlekortet «Ført uten jobb» får merket når en av radene mangler.
- **«Send dagen»** (`ProsjektkortSamleside`): når en jobb mangler, sender knappen ikke. Den åpner første jobb som mangler og viser «Skriv «Hva gjorde du?» på jobbene merket «Mangler beskrivelse» før du sender dagen.» (`timer.prosjektkort.sendSperretBeskrivelse`), også som forklaring på knappen.
- **Timerad-vinduet** (`TimerRadDialog`): «Hva gjorde du?» har rød stjerne og er påkrevd på arbeid i prosjektkort-modus. Lagre er sperret med «Skriv hva du gjorde først» (`sperret.beskrivelse`). Feltet er valgfritt på reise, i dagskort-modus og når en annen arbeidsrad i samme jobb alt har tekst. Den raden vurderes med `radGirJobbBeskrivelse`, samme filter som sperren: en erstattet rad eller en rad uten prosjekt teller ikke.
- **Serveren** (`routes/timer/dagsseddel.ts` `send`): avviser med `BAD_REQUEST` når sedelens firma har `timerRegistreringsmodus = "prosjektkort"` og en jobb mangler beskrivelse. Mobil sender dagen via `syncBatch` (status `sent` settes lokalt i `useProsjektkortSedel.ts:653` og `app/timer/[id].tsx:784`) og har sin egen sperre i «Bekreft dag»; den berøres ikke.
- **En jobb arbeideren går fra** står lagret som utkast med merket. Ingenting slettes; dagen sendes når jobben er fylt ut eller slettet med søppelkassen.
- **Hjelpetekst:** Mine timer ?-fanen, avsnitt `timer.mine.hjelp.ferdig`.
- Tester: `apps/web/src/__tests__/web-timer-l2-ikke-ferdig.test.tsx`, `apps/api/src/routes/timer/send-mangler-beskrivelse.integration.test.ts`. Skjermbilder: `skisser-web-timeforing/l2-*.png`.

### Jobbskjemaet: Bilde 2-jobben (plan § 8.22 L3a) — 🟡 `feat/web-timer-l3-jobbskjema`, venter gate

Gjelder prosjektkort-modus på redigerbar dag (Kenneth 2026-11-21 «Jeg godtar alle anbefalingene», skisser `skisser-web-timeforing/l3-a/b/c.png`, kilde `l3-jobbskjema.html`). Dagskort-modus, sendt/attestert dag, mobil og attesteringen er urørt.
- **Skjemaet** (`apps/web/src/app/dashbord/timer/[id]/JobbSkjema.tsx`, vist av `ProsjektkortSamleside` i `page.tsx`): radene Underprosjekt (L3b, se under), 1 Fra–Til + pause, 2 lønnsart (overtidslinja under med egen lønnsart), 3 «Hva gjorde du?», 4 Maskiner, 5 Varer, 6 Reise, 7 Tillegg/utlegg. Rad 4–7 viser dagens linjer med blyant og vinduer og lenken for en ny linje; «+ Timer» står under skjemaet. Ingen Lagre-knapp.
- **Når skjemaet vises** (`apps/web/src/lib/jobbSkjema.ts` `jobbSkjemaLinjer`): jobben har én arbeidslinje, eller to der linje 2 er en overtidsart som starter der linje 1 slutter. Tre linjer, hull, linje uten fra–til og attestert/erstattet linje gir dagens visning.
- **Lagring ved blur:** Fra, Til, pause og lønnsart lagres når feltet forlates (`dagsseddel.lagreJobbTid`); «Hva gjorde du?» lagres med `oppdaterTimerRad` på alle jobbens linjer. Status «Lagrer …» / «✓ Lagret»; feiler lagringen, står «Ikke lagret — prøv igjen» med serverens melding og «Prøv igjen». Mens noe er ulagret er «Send dagen» sperret (`timer.jobbSkjema.ulagretSperre`) og `beforeunload` spør før siden forlates.
- **Overtid:** én regel for visning og lagring, `regnJobbTid` (`packages/shared/src/utils/jobbTid.ts`): jobbens timer = spenn − pause; normaltid fylles kronologisk over dagen med `foreslaOvertidSplitt` (reise teller ikke), overtidsarten velges strukturert (`velgOvertidLonnsart`). Uten norm eller overtidsart: én linje. Valgt overtidsart på linje 1 gir ingen ny overtidslinje. Hele jobben over normen gir én linje med overtidsarten — også på en eksisterende jobb når tiden endres og linje 1 står på en normalart (gate 129 V1, samme regel i skjemaet og `lagreJobbTid`; nedtrekket viser det som lagres). Et bytte av lønnsart på uendret tid beholdes.
- **«+ Registrer timer» lander i skjemaet** (`aapneNyJobb`, `nyJobbForslag`): ny dag → jobbens kort er åpent med firmaets tider i gule felt og merket «Fra firmaets arbeidstid»; neste jobb → Fra = slutten på dagens seneste rad, Til = firmaets slutt bare når den er senere (ellers tom), merket «Fra forrige jobb». Pausen er dagens pause på en ny dag og 0 på neste jobb. Finnes jobben fra før (registreringsflyten fant dagen), åpnes skjemaet på den; laget serveren ingen rad, åpnes et utkast. Det gule forsvinner når arbeideren endrer et felt. Ingen rad lages før Til er fylt: da lagres raden med `tilfoyTimerRad` (ny `kortId`) og deles av `lagreJobbTid`. Etter første lagring tegnes kortet på nytt fra serveren og viser «✓ Lagret» (`startLagret`). Går arbeideren fra utkastet uten Til, forsvinner det.
- **Serveren** (`routes/timer/dagsseddel.ts` `lagreJobbTid`): input sedel, kort-id, Fra, Til, pause og jobbens linjer (`radId` + lønnsart, 1–2). Avviser: annen brukers sedel (`FORBIDDEN`), ikke redigerbar eller attestert linje (`PRECONDITION_FAILED`), dagskort-firma, ugyldig tid, linjer som ikke er jobbens arbeidslinjer («Jobben har endret seg — last siden på nytt.»), lønnsart fra annet firma, reise- eller normtak-art, og overlapp (`BAD_REQUEST`). Regner selv med `regnJobbTid` og stoler ikke på klientens linjer. Én transaksjon: linje 1 oppdateres; linje 2 oppdateres eller lages (kopierer prosjekt, byggeplass, aktivitet, beskrivelse, underprosjekt og kjøretøy, samme kort-id) eller slettes når jobben blir én linje — maskinene flyttes da til linje 1, og maskinbrudd ruller tilbake (`krevIngenNyeMaskinBrudd`). En byttet lønnsart på linje 2 beholdes. Varer på en slettet linje 2 flyttes til linje 1 etter transaksjonen (`vareIkkeFlyttet` ved feil). Ingen migrering.
- **Avvik = ulagret** (gate 129 V2): stemmer ikke regnet linjedeling med de lagrede linjene (antall, fra/til eller timer) — feilet lagring, en annen jobb endret senere, eldre data — står kortet som «Ikke lagret — prøv igjen» og «Send dagen» er sperret; «Prøv igjen» kaller `lagreJobbTid` på raden som finnes.
- **Begrensning:** en ny jobb lagres med to kall (`tilfoyTimerRad`, så `lagreJobbTid`). Feiler det andre, husker skjemaet rad-id-en, og «Prøv igjen» tar bare det andre kallet; etter omlasting fanges raden av avviksregelen over.
- **Underprosjekt i hodet (L3b, 🟡 `feat/web-timer-l3b-underprosjekt`, venter gate):** raden Underprosjekt står bare når `eksternKostObjekt.list` gir minst ett åpent underprosjekt i jobbens prosjekt, eller når jobben alt står på et (et lukket vises valgt og låst, med navn — listen hentes med `inkluderLukket`). ≤ 6 åpne gir knapper «Uten · 12 · Grøft felt B …», flere gir søkefelt + nedtrekk. «Uten» er forvalgt. Et valg på en lagret jobb kaller `dagsseddel.flyttJobbEco` og flytter HELE jobben: timer (ikke reise), maskiner, tillegg og utlegg i én transaksjon, varer etterpå, kort-id beholdes (`flyttHeleJobben`, samme kjerne som attestantens «flytt hele jobben»). Serveren: egen sedel eller firmaadmin (`hentEgenDagsseddel`), redigerbar, prosjektkort-firma (dagskort → `BAD_REQUEST`), `validerEcoForFlytt` (finnes, samme firma, samme prosjekt, aktivt og åpent for timer); alle jobbens linjer må vente på attestering. På en ny jobb (utkast) huskes valget og sendes med `tilfoyTimerRad` når Til er fylt. Feiler flyttingen, står «Ikke lagret — prøv igjen», og «Prøv igjen» sender samme valg. Serveren kortslutter ikke et valg som er likt jobbens første rad: feilet vare-steget etter transaksjonen, retter «Prøv igjen» varen (retur 130; test «gjentatt valg etter delvis flytting retter varen» i `flytt-jobb-eco.integration.test.ts`). Blyanten «Sted og aktivitet» øverst i skjemaet åpner «Rediger timer-rad» for linje 1 som før (byggeplass, aktivitet m.m. for den linja). Ikke i L3b: byggeplass for hele jobben i hodet (skissens «Ingen byggeplass · Endre» — ny semantikk, meldt), lukket underprosjekt via `tilfoyTimerRad`/`oppdaterTimerRad` (egen ordre). Skjermbilder (lokal DB, 25.11.2026): `skisser-web-timeforing/l3b-skjerm-foer.png` (Uten valgt), `l3b-skjerm-etter.png` (12 · Grøft felt B valgt, «✓ Lagret», hodet viser underprosjektet).
- **Timer i feltet og tidsfeltene (O2, 🟡 `feat/web-timer-o2`, plan § 8.22 «Kenneths test av L3a» punkt 1–2, Bilde 2-pila `relay/bilder/l3a-test/12-timer-direkte.png`):** «= X t» i Fra–til-raden er et felt (`timer.jobbSkjema.timer`, `data-testid="skjema-timer"`). Skrevne timer (komma eller punktum) gir Til = Fra + timer + pause med den delte `tilFraAntall` (pausepunkt = Fra; `tilFraTimer` i `apps/web/src/lib/jobbSkjema.ts`); tom eller ugyldig Fra regner ingenting. Endres Til eller pause, regnes timer på nytt (Til står). Lagring ved blur med `lagreJobbTid` som før; serveren regner lønnsart og overtid. Fra og Til er klokkefelt som i timevinduet (RETUR O2): `type="time"` med `step` = `klokkeSteg` × 60 — firmaets tidsrunding, maks 30, ellers 15 min, samme regel som timevinduets `timeStep` — så klokkevelgeren går i firmaets steg. Når feltet forlates, rundes verdien med firmaets tidsrunding (`rundTilNarmeste`, som timevinduet; uten runding står minuttene som valgt). Det som skrives tall for tall, tolkes av nettleseren, ikke av koden (målt 2026-11-21, Playwright, `nb-NO`, steg 15 min): Chromium gir «1600» → 16:00 i tomt og utfylt felt, «16» alene → 16:00 bare når feltet hadde en verdi (tomt felt blir stående «16:--», tom verdi); WebKit-bygget gir 16:00 bare for «16.00»/«16:00», mens «1600» blir 00:00. Safari.app er ikke målt. Ingen feilmelding eller rød kant mens arbeideren skriver (`skriver`); valideringen vises først ved blur. `page.tsx` sender `tidsrundingMinutter` i `skjemaFelles`. Dagskort-modus, mobil, attestering og reisevinduet er urørt. Tester: `jobb-skjema-o2.test.tsx` (15), `lib/jobbSkjema.test.ts` § lesTimer/tilFraTimer/klokkefeltets steg.
- **Hjelpetekst:** Mine timer ?-fanen, avsnitt `timer.mine.hjelp.skjema`.
- **Skjermbilder** (lokal DB, 25.11.2026): `skisser-web-timeforing/l3a-skjerm-a.png` (ny dag, gule felt), `-b.png` (Til 15:30 → 7,5 t timelønn + 0,5 t overtid 50 %, lagret), `-c.png` (neste jobb: Fra 15:30, Til tom).
- Tester: `packages/shared/src/utils/jobbTid.test.ts`, `apps/web/src/lib/jobbSkjema.test.ts`, `apps/web/src/app/dashbord/timer/[id]/jobb-skjema.test.tsx`, `jobb-skjema-gate129.test.tsx`, `apps/api/src/routes/timer/lagre-jobb-tid.integration.test.ts`; `dagskort-vakt.test.tsx` + snapshot urørt.

### Reisevinduet: når, hvor og klokkeslett (w15b, B42 A, B43 B) — ✅ merget til develop (`cee0c03e`)

Spec: `web-timeforing-plan.md` § 4.15 del B, rad w15b i del G og del H, bildet `skisser-web-timeforing/v15-reisevindu.png`; LØSNING GODKJENT i `relay/inbox-web-timer-w5.md` (2026-11-21). Bare web-`ReiseKort` (prosjektkort-modus) og den delte `løsReiseKort`; mobilen, attesteringen, serveren og kortregelen (`reiseKort.ts`) er urørt.

- **Tre valg:** ⚠️ Utgått i «Reisens kort uten særregler» (§ 8.22, 🟡 `feat/web-timer-forenkle`). Sto slik: «Til byggeplass», «Fra byggeplass» og «Til annet kontor» (`timer.reiseKort.tilAnnetKontor`, bare ved ≥ 2 aktive kontorer). Kontorvalget forvelger første andre kontor; med 3 eller flere står kontorene i et nedtrekk (`aria-label` «Hvor kjørte du til?»). Overføringsknappene i perioden står som før.
- **«Når kjørte du?»** — ⚠️ Utgått i «Reisens kort uten særregler» (§ 8.22, 🟡 `feat/web-timer-forenkle`). Sto slik: (`timer.reiseKort.naar`): «Før arbeid» / «Etter arbeid», bare for «Til annet kontor». Forvalg: «Etter arbeid» når overføringen avslutter perioden, ellers «Før arbeid». Før arbeid = (dagstart − kjøretid) → dagstart; etter arbeid = dagslutt → (dagslutt + kjøretid). Sporets retning (`ut`/`retur`) er den samme som før.
- **«Start kl.» / «Slutt kl.»** (`reise-start`, `reise-slutt`) er fylt ut fra regelen og kan rettes. Rettes starten, følger slutten med kjøretiden; rettes slutten, er timer = slutt − start. Lønnsart og terskel klassifiseres fortsatt på firmaets kjøretid, og `reiseKjoretidMin` er firmaets tall (`løsReiseKort`, `packages/shared/src/utils/reiseManuell.ts`). Under feltene: «Forslag: N min kjøring (firmaets tabell)» (`timer.reiseKort.forslag`). Bytte av valg, prosjekt eller byggeplass forkaster rettede tider.
- **«Hvor kjørte du til?»** (`hvorTil`, «Hvor kjørte du fra?» ved retur): prosjekt (alle prosjektene i velgeren, `id=reise-prosjekt`) og byggeplass. Bytte av prosjekt foreslår prosjektets byggeplass (`velgStandardByggeplass`) og tømmer underprosjektet; underprosjektet fylles ellers ut fra jobben som før.
- **«Står i jobben på …» / «Får eget kort på …»** (`timer.reiseKort.havnerJobb` / `havnerEget`): `reiseHavnerI` (`apps/web/src/hooks/useManuellReiseWeb.ts`) bruker dagens regel — `velgReiseKort` for reise, kortet med samme `kortIdNokkel` under terskel, ellers eget kort. ⚠️ Reisekilden og kontorvarianten er tatt ut (§ 8.22). Sto slik: fra w15c fikk linja reisekilden, og «Til annet kontor» → «Etter arbeid» sa «Får eget kort på …» som serveren (§ «Reisens kort på serveren»).
- **Under terskel fra en jobb (O1, 🟡 `fix/web-timer-o1-reise-terskel`, plan § 8.22 «Kenneths test av L3a» feil a+b):** under terskelen er turen arbeid, og arbeid uten kort-id legges av serveren i ELDSTE kort med samme nøkkel (`sikreKortId` regel 3) — med to jobber på samme sted havnet turen i jobb 1, som endret tid (07:00–15:00 → 07:00–17:04). Nå får `ReiseKort.tsx` jobbens kort-id (`jobbKortId`, fra `page.tsx` `aktivModal.jobb`, bare prosjektkort-modus) og sender den som `kortId` (regel 1) når turen er arbeid og nøkkelen (prosjekt, effektiv byggeplass, underprosjekt) er lik jobbens — regelen er den delte `arbeidsreiseKortId` (`packages/shared/src/utils/reiseKort.ts`), som også `reiseHavnerI` bruker for linja «havner i». Annen nøkkel, over terskel eller vindu åpnet utenfor en jobb → ingen kort-id, som før. Forklaringslinja sier da «Under terskel (30 min) — føres som arbeidstid (Timelønn) på denne jobben» (`timer.reiseKort.underTerskelPaaJobb`, terskelen fra `manuellReiseTerskelTekst`); ellers den delte linja som før. Ingen serverendring, ingen migrering. Dagskort-modus, mobil og attestering er urørt. ⚠️ **Mobil (funn, ikke rettet):** «+ Reise» åpnes fra dagsseksjonen (`apps/mobile/src/components/timer-detalj/prosjektkort/DagSeksjon.tsx:140`) og lagres uten kort-id (`:187-205`), så en tur under terskel havner der også i eldste jobb med samme nøkkel. **Arbeideren bestemmer (O1 TILLEGG, Kenneth 2026-11-21, plan § 8.22):** `ReiseKort.tsx` har «Føres som» med Reisetid/Arbeidstid (`timer.reiseKort.foresSom`, `aria-pressed`). Terskelen forvelger (`regelKategori`); valget (`kategoriValg`) går gjennom `løsReiseKort` til `klassifiserManuellReise`, som gir art, reisespor og forklaring etter valget. Reisetid under terskel lagres som reise (reiseart, `reiseKilde` «manuell», kjøretid; står under «6 · Reise» og kan rettes); arbeidstid over terskel går som arbeid på jobben (kort-id når nøkkelen er lik) med linja «Over terskel (…) — føres som arbeidstid (…) på denne jobben» (`timer.reiseKort.overTerskelPaaJobb`). Forklaringen viser fortsatt terskelfaktaene. Snapshotet (`ReiseRegelSnapshot`) får `regelKategori` bare når valget avviker fra regelen. «Antall timer» (`#reise-antall`) regner Slutt kl. fra Start kl. med `tilFraAntall` (⚠️ O6: gjelder nå bare «Fra byggeplass»; «Til byggeplass» holder Slutt fast — se § «Reise og beskrivelse ved hover (O6)»); rettet Slutt kl. regner antallet; rettet Start kl. med skrevet antall flytter slutten (⚠️ O7: bare «Fra byggeplass»; på «Til byggeplass» står Slutt fast — se § «Reise uten maskinseksjon (O7)»). Klassifiseringen står på firmaets kjøretid, ikke på antallet. Mobil sender ikke `kategoriValg` og er uendret. ⚠️ **Mobil (funn, ikke rettet):** mobilens reisekort (`apps/mobile/src/components/timer-detalj/ReiseKort.tsx`) har ingen tidsfelt, intet antall og intet valg — terskelen bestemmer alene. Underprosjekt «—» i reisevinduet er jobbens forvalg (jobben har ikke underprosjekt); velgeren vises bare når prosjektet har åpne underprosjekter. Tester: `reise-terskel-dialog.test.tsx` § O1 (4) + § O1 TILLEGG (9), `reise-havner-i.test.ts` § O1 (3), `reiseKort.test.ts` § `arbeidsreiseKortId` (3), `reiseManuell.test.ts` § `kategoriValg` (3), `apps/api/src/routes/timer/o1-reise-under-terskel.integration.test.ts` (4).
- **Overlapp er en sperre:** reisens tidsrom mot dagens rader (`finnOverlappendeTidsrom`) sperrer Lagre med «Tidsrommet … overlapper … på prosjektkortet {kort}» (`timer.feil.overlappKort`; uten kjent kort `timer.feil.overlapp`); slutt før start sperrer med `timer.feil.sluttForStart`.
- **Trykk (målt i `reisevindu.test.tsx`):** ⚠️ Utgått i «Reisens kort uten særregler» (§ 8.22, 🟡 `feat/web-timer-forenkle`). Sto slik: 2 kontorer: «+ Reise» → «Til annet kontor» → (ev. «Etter arbeid») → Lagre — kontoret er valgt i samme trykk som før («Til Kontor Narvik»). 3 kontorer: ett trykk til i nedtrekket for et annet kontor enn det forvalgte.
- **Tester:** `reiseManuell.test.ts` § «w15b — start og slutt kan rettes» (8), `apps/web/src/app/dashbord/timer/[id]/reisevindu.test.tsx` (9), `apps/web/src/hooks/reise-havner-i.test.ts` (6). Negativkontroll mot develop `45a388c5`: 6 av 8 (shared) og 14 av 15 (web) røde; de grønne er bevaringstestene. `dagskort-vakt.test.tsx` + snapshot urørt.
- **Skjermbilder (1 440 px, lokal seed):** `skisser-web-timeforing/w15b-etter-arbeid.png` («+ Reise» → «Til annet kontor» → «Etter arbeid»: Kontor Narvik, 12:00–15:50, 230 min), `w15b-byttet-prosjekt.png` («Til byggeplass», prosjektet byttet til Agent-testprosjekt: Byggeplass 1, 06:25–07:00, «Får eget kort på Agent-testprosjekt.»).

### Dagssiden viser reisen (w15d, B45 A, B48 A, F25) — ✅ merget til develop (`94fe0b77`)

Spec: `web-timeforing-plan.md` § 4.15 del C pkt. 1–4, rad w15d i del G og del H; LØSNING GODKJENT i `relay/inbox-web-timer-w5.md` (2026-11-21). Bare `apps/web/src/app/dashbord/timer/[id]/page.tsx` i prosjektkort-modus; dagskort-modus, mobilen, attesteringen, serveren og kortregelen (`reiseKort.ts`) er urørt.

- **Reiselinja** (`ReiseLinje` i `page.tsx`, `li[data-reiselinje]`): merket «Reise» (`timer.prosjektkort.reiseMerke`), stedet — «Til {sted}» ved tur, «Fra {sted}» ved retur (`reiseTil`/`reiseFra`; stedet er radens byggeplass, ellers prosjektet) (⚠️ § 8.22: ingen egen tekst for `reiseKilde = "overforing"`; sto slik: «Overføring til/fra annet kontor») — og klokka og timene. Under: tekst · lønnsart. Ingen aktivitet og ingen matpause. Blyant, del og slett som arbeidslinja, med samme maskin-sperre ved sletting.
- **Underprosjekt på reiselinja (B48 A):** vises bare når det avviker fra jobbens; reise uten underprosjekt i en jobb med underprosjekt viser «Uten underprosjekt» (`utenUnderprosjekt`). På samlekortet sammenlignes ingenting.
- **Hodet (`JobbKortRamme`):** sted og klokke (`byggeplass · fra–til`) regnes av arbeidsradene; reiseradene teller ikke i byggeplassen (ikke «2 byggeplasser» for en retur fra et annet sted). Kort med bare reise: merket «Reise» foran sted og klokke, regnet av reisen.
- **Lenkeraden:** kort uten timerad har «+ Timer», «+ Reise», «+ Tillegg/Utlegg» (B45 A); med en timerad alle fem (§ 8.19). ⚠️ § 8.22: også kort der alle reiser er overføring til annet kontor, har «+ Timer» (sto slik: ikke «+ Timer», F25).
- **Teksten under lønnsarten** i «Rediger timer-rad» når lønnsarten er reise (`erReiseLonnsart`, prosjektkort-modus): `reiseHavnerI` gir «Dette er reise. Den står i jobben på {sted}.» (`timer.rediger.reiseHavnerJobb`) eller «Dette er reise. Den får eget kort.» (`reiseHavnerEget`). Pennens felt er som før; bytte av prosjekt er ikke med (w15d c).
- **Tester:** `apps/web/src/app/dashbord/timer/[id]/reise-visning.test.tsx` (12). Negativkontroll mot develop: se leveransen i `relay/inbox-orkestrator.md`. `dagskort-vakt.test.tsx` + snapshot urørt.
- **Skjermbilder (1 440 px, lokal engangs-DB):** `skisser-web-timeforing/w15d-dagen.png` (kortet med bare reise åpent: «Reise · Byggeplass 1 · 06:25–07:00», tre lenker; jobben på Skole med «sommerfeldtsgt 65 · 07:00–12:00»), `w15d-pennen-reise.png` (blyanten på overføringen i Skole-jobben: «Dette er reise. Den står i jobben på sommerfeldtsgt 65.»).

### Maskin er utstyr og antall timer (w3b, A3–A5, A13) — 🟡 `feat/web-timer-w3b`, ikke merget

Spec: `web-timeforing-plan.md` § 4.13 (A3–A5, A13) og § 9 w3b; beslutninger S1–S6 (alle A) i `relay/inbox-web-timer-w5.md` (SVAR w3b, 2026-11-20). Gjelder bare prosjektkort-modus på web; dagskort-modus og `apps/mobile` er urørt.

- **Maskinvinduet fra en jobb** (`MaskinRadDialog` i `apps/web/src/app/dashbord/timer/[id]/page.tsx`): bare Utstyr og Antall timer. Fra kl./Til kl., pausefradrag, Mengde og Enhet vises ikke, og lagringen sender dem ikke (`maskin.tilfoy`/`maskin.oppdater` lar dem stå — lagrede verdier er urørt). Antall forhåndsutfylles: maskin med fører får høyst-tallet (`maskinHoystPerRad`, jobbens arbeid minus andre førermaskiner), døgn-maskin får jobbens arbeid (`jobbArbeidSum`). Rørt felt overstyrer forslaget. Fra–til-avviket sjekkes ikke når vinduet er åpnet fra en jobb. ⚠️ § 8.22 (🟡 `feat/web-timer-forenkle`): fra–til er tatt ut av hele vinduet, også uten jobb og i firmavalget dagskort-modus; Mengde og Enhet står uten jobb. Sto slik: døgn-maskin uten jobb og dagskort-modus har vinduet som før.
- **Maskindelen i «Legg til timer-rad» og «Rediger timer-rad»** (`TimerRadDialog`, prop `kortModus`): ⚠️ O3 (§ 8.22 punkt 3, 🟡 `feat/web-timer-o3-o4`): «Legg til» starter tom og foreslår radens egne timer — se § «Legg til timer-rad»: maskin og underprosjekt (O3, O4) under; det som står her, gjelder nå bare «Rediger». Sto slik: lik i begge. Viser jobbens maskiner (samme kort-id; uten kort-id: maskiner koblet til raden) med låst navn, Antall timer og ×, pluss én ny linje (Utstyr + Antall, forhåndsutfylt). Attestert maskin er låst. «høyst X t» og sperret Lagre regnes over jobbens maskiner, ny linje og radens arbeid live (`maskinHoystPerRad`). Reiserad har ikke maskindel.
- **Lagrerekkefølge:** reduksjoner og fjerninger (`maskin.oppdater`/`maskin.fjern`) før raden, deretter raden, deretter økninger og ny maskin (`maskin.tilfoy` med kort-id, uten fra/til/mengde/enhet). Hvert mellomsteg holder serverens w9-regel (`krevIngenNyeMaskinBrudd`). Kjent grense: feiler radlagringen, står reduksjonene som allerede er lagret.
- **B37 A — Varelager av:** når `vareforbruk.katalogForFirma` svarer FORBIDDEN og brukeren er firmaadministrator for sedelens firma (eller `sitedoc_admin`), viser jobbkortet «Varelager er ikke på for firmaet. Slå på Varelager →» med lenke til `/dashbord/firma/moduler`. Arbeider ser ingenting. Firmaadmin-regelen: `organisasjon.hentTilgjengelige` inneholder sedelens `organizationId`.
- **Tester:** `jobb-vinduer.test.tsx` § w3b — maskinvinduet uten Fra/Til/Mengde/Enhet, forslag = høyst, døgn uten høyst, blyant-retting uten de fire feltene; maskindelen: rediger viser jobbens maskin, reduksjon før raden, × → `maskin.fjern`, over høyst sperrer Lagre, økning etter raden, ny maskin fra «+ Timer» med kort-id, dagskort uendret; B37: admin og sitedoc_admin ser lenken, arbeider og admin i annet firma ikke, Varelager på → «+ Vare». `dagskort-vakt.test.tsx` grønn uendret. Negativkontroll: med w3b-endringene tatt bort blir w3b-testene røde.
- **Skjermbilder (1440 px, lokal seed):** `skisser-web-timeforing/w3b-maskin-fra-jobben.png`, `w3b-rediger-timerrad-maskindel.png`, `w3b-legg-til-timerrad-maskindel.png`, `w3b-varelager-av-admin.png`, `w3b-losning.png`.
- **Funn F1 (ikke rettet, eldre):** en eldre maskinrad uten kort-id på samme prosjekt trekkes inn i jobben av `sikreKortId` ved neste skriving. Klientens høyst kjenner ikke raden, så serveren kan avvise et tall klienten viste som lovlig (END-002). Egen sak.

### «Legg til timer-rad»: maskin og underprosjekt (O3, O4) — 🟡 `feat/web-timer-o3-o4`, ikke merget

Hjemmel: `web-timeforing-plan.md` § 8.22, «Kenneths test av L3a», punkt 3 og 7 (2026-11-21). Gjelder `TimerRadDialog` (`apps/web/src/app/dashbord/timer/[id]/page.tsx`) i prosjektkort-modus, ny rad (`!rad`). «Rediger timer-rad» (punkt 6: «ikke endre noe enda her»), «+ Maskin» (`MaskinRadDialog`), dagskort-modus og `apps/mobile` er urørt.

- **O3 — maskindelen starter tom:** `jobbMaskiner` er tom når vinduet legger til en rad, så jobbens maskiner vises ikke; en maskin som føres der, hører bare til den nye raden. Jobbens maskiner teller fortsatt i «høyst» (de står i `andreMaskinerLive`).
- **O3 — forslaget er radens timer** (`nyMaskinForslag`): døgn-maskin får radens timer; maskin med fører får radens timer, aldri over «høyst» (`maskinHoystPerRad`), så forslaget aldri sperrer Lagre. Før: døgn-maskin fikk jobbens arbeid (`jobbArbeidSum`) og førermaskin «høyst» for hele jobben (Kenneth: 1,5 t ble 2,5 t og 7,5 t). Feltet er åpent; rørt felt overstyrer. Maskin har aldri fra–til.
- **«+ Maskin»** hadde samme forslag (jobbens arbeid / høyst) — ⚠️ endret i O5 A, se § «+ Maskin» og overtid i timer-raden (O5) under.
- **O4 — underprosjekt:** fra en jobb vises nedtrekket Underprosjekt når prosjektet har åpne underprosjekter (`eksternKostObjekt.list` gir bare `status: "aktiv"` og `timerregistreringApen`), med «—» forvalgt, ikke jobbens. Uten åpne underprosjekter vises det ikke.
- **O4 — eget kort:** er radens kort-nøkkel (`kortIdNokkel`: prosjekt|byggeplass|underprosjekt) en annen enn jobbens, sender vinduet en ny kort-id (`nyKortId`, regel 1) på raden, overtid-delen og maskinen (`nyRadEgenJobb`/`lagreKortId`). Lik nøkkel: jobbens kort-id som før. Uten ny id ville regel 3 i `sikreKortId` lagt raden i eldste jobb med samme nøkkel — registreringer slås aldri sammen. Følge: «—» på en jobb med underprosjekt gir egen jobb uten underprosjekt.
- **Tester:** `jobb-vinduer.test.tsx` § O3 (tom maskindel; forslag = radens 2,5 t for fører og døgn, ikke jobbens 3,5 t; vakt: «Rediger» viser jobbens maskin og foreslår døgn med jobbens arbeid) og § O4 («—» forvalgt; skjult uten åpne underprosjekter; annet underprosjekt → ny kort-id; samme → `k2`). Integrasjon `apps/api/src/routes/timer/o4-legg-til-underprosjekt.integration.test.ts` (4): ny id med annet underprosjekt står som egen jobb, også når en eldre jobb har samme underprosjekt; kontroll uten id → regel 3 legger den i eldste jobb; «—»; samme underprosjekt → jobbens kort. Negativkontroll: 8 web-tester feiler mot develop.

### «+ Maskin» og overtid i timer-raden (O5) — ✅ merget `25b40350`

Hjemmel: `web-timeforing-plan.md` § 8.22, «Kenneths test på `d4bec43e`», punkt 1 og 2 (2026-11-21). Gjelder web i prosjektkort-modus. Dagskort-modus, `apps/mobile`, attestering, jobbskjemaet (O2) og maskindelen i «Rediger timer-rad» er urørt.

- **A — forslaget i «+ Maskin»** (`MaskinRadDialog`, `jobbForslag`): jobbens arbeid minus ALLE maskintimer som alt er ført på jobben, fører- og døgn-maskin, aldri under 0 (delt `maskinForslagFraJobb` i [maskinKapasitet.ts](../../packages/shared/src/utils/maskinKapasitet.ts); jobben = kort-nøkkelen `maskinJobbNokkel`, samme som «høyst»). Kenneth: jobb 6 t, Volvo 3 t → Heatwork som maskin nr. 2 foreslås med 3 t (før: 6). 0 eller mindre gir tomt felt. Feltet er åpent; «høyst» (`maskinHoystPerRad`, trekker bare fra førermaskiner) står uendret som tak for førermaskin, og forslaget er aldri over det. «Legg til timer-rad» (O3: radens timer) og «Rediger timer-rad» er urørt.
- **B — overtid deles automatisk ved lagring** (`TimerRadDialog`, `autoOvertid` + `handleSubmit`, prop `kortModus`): går dagen over dagsnormen, lagres «Legg til timer-rad» og tidsdelen av «Rediger timer-rad» som to linjer — delen innenfor normen med valgt art, delen over med firmaets overtidsart — uten knapp. Samme regel og samme to kall som V21-knappen (`foreslaOvertidSplitt` → `brukOvertidForslag`, under § V21); `regnJobbTid` (jobbskjemaet, `lagreJobbTid`) bygger på samme `foreslaOvertidSplitt` og gir like deler (integrasjonstesten sjekker det). Ingen ny regel, ingen serverendring. Overtiden står som egen linje i jobbens kort (samme kort-id; O4: ny kort-id følger begge delene). Hel rad over normen: lagres med overtidsart (som «Før som overtid»). Arbeideren har valgt en overtidsart selv: ingen deling (rader på overtid fyller ikke normen).
  - **«Rediger» deler bare når tiden er endret** (Fra, Til eller om pausen trekkes), som `lagreJobbTid` (gate 129 V1): bytter arbeideren lønnsart på overtidsdelen etterpå, på uendret tid, beholdes byttet (L3a).
  - **Den gule «Del raden?»-boksen er borte i prosjektkort-modus.** I stedet står en grå opplysning over lagring: «1,5 t over dagsnorm — lagres som Timelønn 13:30–15:00 og Overtid 50 % 15:00–15:30.» (`timer.overtidForslag.delesVedLagring` / `helRadVedLagring`). Dagskort-modus har boksen med knappen som før.
  - **Reise i normen:** som jobbskjemaet — reise teller ikke mot normen og blir aldri overtid (`foreslaOvertidSplitt`, V1). Målt, ikke endret.
  - **Kjent grense (V21, uendret):** delingen er to kall. Feiler kall 2, står raden forkortet og vinduet viser feilen.
  - **Varen ble ikke flyttet (gate 134 V1):** svarer `oppdaterTimerRad` i delingen med `vareIkkeFlyttet` (byggeplass eller underprosjekt byttet i samme lagring, varekallet feilet), fullfører `brukOvertidForslag` kall 2 og maskinene og står åpent med `timer.feil.vareIkkeFlyttet` — som `lagreRadKort` (gate 107). Gjelder også V21-knappen i dagskort-modus (samme funksjon).
- **Tester B:** `jobb-vinduer.test.tsx` § O5 B («Legg til» 13:30–15:30 på en dag med 6 t → 1,5 t Timelønn + 0,5 t overtid i kort k2, opplysning uten knapp; innenfor normen én rad; «Rediger» 13:30–14:30 → 15:30 deler; bevisst artsbytte på uendret tid står; vakt: dagskort-modus har knappen og lagrer én rad; gate 134 V1: `vareIkkeFlyttet` ved deling → kall 2 gjort, vinduet åpent med feilen — rød mot `84012c0c`). `apps/api/src/routes/timer/o5-overtid-deles.integration.test.ts` (3/3 mot kastbar sandkasse: delene er lik `regnJobbTid`, serveren godtar begge kallene for «Legg til» og «Rediger», artsbyttet står). Negativkontroll: med develops `page.tsx` feiler O5 A ×3 og O5 B ×2; artsbytte-vakten feiler når tid-sjekken tas bort.
- **Tester A:** `maskinKapasitet.test.ts` § O5 (ingen maskin, 1 maskin, 2 maskiner inkl. døgn, aldri under 0, avrunding); `jobb-vinduer.test.tsx` § O5 A (Kenneths eksempel, førermaskin = høyst, to maskiner ført + maskin uten jobb teller ikke, aldri under 0).

### Reise og beskrivelse ved hover (O6) — ✅ merget `87272320`

Hjemmel: `web-timeforing-plan.md` § 8.22, «Kenneths test på `73aec65d`», punkt 1 og 2 (2026-11-22). Bare web. Mobil, serveren og dagskort-modus er urørt.

- **1 — «Antall timer» følger retningen** (`reiseTiderFraAntall` i [ReiseKort.tsx](../../apps/web/src/app/dashbord/timer/%5Bid%5D/ReiseKort.tsx)): «Til byggeplass»: Slutt (ankomsten = jobbstart) står fast, og Start = Slutt − antall (ny delt `fraFraTilOgAntall` i [pauseBeregning.ts](../../packages/shared/src/utils/pauseBeregning.ts), `tilFraAntall` baklengs med pause 0). «Fra byggeplass»: Start står fast, Slutt = Start + antall (`tilFraAntall`, som før). Kenneths eksempel: jobb 07:00, kjøretid 4 min, antall 1 → 06:00–07:00 (før: 06:56–07:56 med overlapp-sperre). Døgnkanten følger samme regel som før: Slutt klemmes til 23:59, Start nå til 00:00 (`minTilHhmm`); ingen kryssing av midnatt. Klokkesteget (`tidsrundingMinutter`) brukes ikke på antall-feltet, verken før eller nå. Rettet Start kl. og rettet Slutt kl. virker som før.
- **«Rediger reise»** (`TimerRadDialog.endreTimer` i [page.tsx](../../apps/web/src/app/dashbord/timer/%5Bid%5D/page.tsx)): samme regel for en lagret reise med `reiseRetning` «ut»: Til står fast, Fra = Til − antall. Retur og arbeid som før (`tilFraAntall` med radens pause).
- **2 — beskrivelsen ved hover** ([BeskrivelseHover.tsx](../../apps/web/src/components/timer/BeskrivelseHover.tsx), Tooltip v2 fra `@sitedoc/ui`): beskrivelsene («Hva gjorde du?») fra kortets timerader uten reise, etter klokkeslett, hver tekst én gang, tomme utelatt (`jobbensBeskrivelser`, flyttet hit fra `RegistreringPanel.tsx`, som re-eksporterer). Ingen beskrivelse → ingen hover. Vises bare når kortet/raden er lukket; åpent har tekstene i linjene / del 3. Ingen ny henting, ingen nye strenger.
  - **Dagssiden:** hodet på lukket prosjektkort (`JobbKortRamme`, page.tsx).
  - **Attesteringen:** jobbraden, og dagsraden når dagen har én jobb (`aapne` → `hover` i [AttesteringTabell.tsx](../../apps/web/src/components/attestering/AttesteringTabell.tsx)); dagsraden med flere jobber har ingen. Ny valgfri `hover` på sumraden i [TimerRadTabell.tsx](../../apps/web/src/components/timer/TimerRadTabell.tsx) pakker raden i en ytre målt div (som luft-raden).
  - **Tooltip `deaktivert`** (ny valgfri prop, [tooltip.tsx](../../packages/ui/src/tooltip.tsx)): ingen boks og ingen `aria-describedby`, men treet står, så triggeren ikke monteres på nytt (fokus beholdes) når kortet åpnes og lukkes.
  - **Berøring:** ingen hover. Trykk åpner kortet/raden som før; da slås hoveren av, så boksen vises ikke. Ingenting ekstra bygd.
- **Tester:** `reisevindu.test.tsx` § O6 (4: eksempelet 06:00–07:00 og lagring, nytt antall fra samme slutt, «Fra byggeplass» som før, midnatt), `reise-visning.test.tsx` § O6 «Rediger reise» (2) og § O6 punkt 2 (4: hover med beskrivelse og synlig etter hover, uten beskrivelse, åpent kort, rekkefølge uten tomme og reise), `attestering-tabell.test.tsx` § O6 (5: dagsrad med én jobb, uten, åpen, flere jobber, reise utelatt), `tooltip-v2.test.tsx` § O6 (1), `pauseBeregning.test.ts` § O6 (4). Negativkontroll mot develop `83589730`: 10 av de nye web-testene røde; de grønne er «som før»-tilfellene.

### Reise uten maskinseksjon; «Til byggeplass» holder Slutt (O7) — 🟡 `feat/web-timer-o7` (ikke merget)

Hjemmel: `web-timeforing-plan.md` § 8.22, «Kenneths test på `73aec65d`», punkt 3 og 4 (Kenneth 2026-11-22 «ja»). Bare web. Mobil, serveren og dagskort-modus er urørt. Ikke L4: for en vanlig timer-rad er maskinseksjonen uendret.

- **1 — maskinseksjonen skjules på reise** (`maskinPaaRad` i `TimerRadDialog`, [page.tsx](../../apps/web/src/app/dashbord/timer/%5Bid%5D/page.tsx)): `maskinPaaRad = visKortMaskin && !erReiseValgt` — samme test som linja «Dette er reise …» (`erReiseLonnsart`). Seksjonen (jobbens maskiner og «Velg utstyr») vises ikke når lønnsarten er reise, heller ikke når den byttes til reise mens vinduet er åpent. `lagreJobbMaskinerFoer`/`lagreJobbMaskinerEtter` gjør da ingenting, så en reise-rad oppretter, endrer eller sletter ingen maskin — heller ikke en linje som var rettet, fjernet eller valgt før byttet. «Høyst»-sperren på Lagre (`kortOverHoyst`) gjelder ikke reise. Linjene står i vinduet, så de vises som før om lønnsarten byttes tilbake. En lagret reise (`erReise`) hadde ingen seksjon fra før (`visKortMaskin`); «+ Reise» åpner reisekortet, som aldri har hatt maskin.
- **2 — «Til byggeplass»: Slutt står fast når Start rettes** ([ReiseKort.tsx](../../apps/web/src/app/dashbord/timer/%5Bid%5D/ReiseKort.tsx), Start-feltets `onChange`): retning «tur» → Slutt låses til det som står (`rettetSlutt ?? resultat.tilTid`), og antall nullstilles, så feltet viser `resultat.timer` = Slutt − Start, altså det som lagres. Ingen klemming trengs: Start skrives direkte, og Start etter Slutt gir «Slutt før start» som før. «Fra byggeplass» som før: Slutt = Start + skrevet antall, ellers Start + kjøretid.
- **«Rediger reise»** (`TimerRadDialog.endreFra`): holdt Til fast og regnet antall av spennet allerede før O7, for alle retninger — uendret; nå med tester.
- **Tester:** `jobb-vinduer.test.tsx` § O7 (7: vakt vanlig rad, reisekortet, «Legg til» med reise, lagret reise, bytte skjuler/viser, lagring urørt etter rettet og fjernet linje, valgt utstyr før bytte), `reisevindu.test.tsx` § O7 (5: Slutt fast, etter skrevet antall, midnatt, «Fra byggeplass» med kjøretid og med antall) + w15b-testen «rettet start» rettet til ny atferd, `reise-visning.test.tsx` § O6/O7 «Rediger reise» (2: ut og retur). Negativkontroll mot develop `fc40799b`: 8 røde (de nye O7-tilfellene og w15b); grønne er vaktene, «som før»-tilfellene og «Rediger reise».

### Prosjektkort-rute — egen skjerm for samlesiden (ORDRE 35, I2) — 🟡 `feat/prosjektkort-isolert` (2026-11-07, ikke merget)

Kenneth-vedtak I2: prosjektkortets samleside på mobil er flyttet ut av dagskortet til egen rute, så endringer i prosjektkortet ikke kan treffe dagskortet.

- **Rute:** `apps/mobile/app/timer/[id]/prosjektkort.tsx`. `app/timer/[id].tsx` sender videre med `<Redirect>` når `kortModus` er sann (etter `if (!sedel)`), og bærer med `aapnetEksisterende`. Prosjektkort-skjermen sender tilbake til `/timer/[id]` når firmaet ikke (lenger) er i prosjektkort-modus. Det brukeren ser er uendret: samme bannere, samleside, Gjenåpne/Slett, «+ Nytt prosjektkort», «Endre» ramme og byggeplass-velger.
- **To kopier av glue:** koden mellom skjerm og lagring/konflikt/forsoning (henting av sedel, `forsonDagskort`, overlapp-/dagskort-sammenligning, `bekreftConflict`, gjenåpne, slett med lokale `db.delete`, arbeidstid-cache, `useReLesVedSynk`) finnes i **to filer**: `apps/mobile/app/timer/[id].tsx` (dagskortet) og `apps/mobile/src/components/timer-detalj/prosjektkort/useProsjektkortSedel.ts` (prosjektkortet). **En fiks i den ene skal vurderes i den andre.** Vakten `src/components/timer-detalj/prosjektkort/prosjektkort-glue-vakt.test.ts` teller 20 service-kall i begge (kommentarer ignorert) og feiler når én kopi dropper eller bytter et kall; negativkontroll for droppet, byttet og utkommentert kall.
- **Delt gjenåpne i prosjektkort-modus (ORDRE 2026-11-15 (23), 🟡 `fix/dagskort-gjenaapne`, ikke merget):** kortskjermen `app/timer/[id]/kort/[projectId].tsx` var en blindvei for sendt sedel — bare statusmerke, redigering sperret av `erRedigerbar`, ett prosjekt (`enkeltProsjekt`) og ingen gjenåpne-knapp, så kallet nådde aldri serveren. Nå har samlesiden og kortskjermen én gjenåpne-vei: `prosjektkort/useGjenaapneDagsseddel.ts` (bekreftelse i `Alert`, `gjenaapneDagsseddel`, lokal sedel → draft/synced, `oppdaterTellere`), `prosjektkort/GjenaapneKnapp.tsx` (bare status `sent`; konflikt gir sperret knapp med `timer.gjenaapne.sperretKonflikt`) og den rene feilmapperen `prosjektkort/gjenaapne.ts` (`gjenaapneFeilmelding`: CONFLICT → `feilGodkjent`, PRECONDITION_FAILED → `laastAttestert`, annen kode → serverens melding, f.eks. UNAUTHORIZED ved utløpt innlogging, ingen kode → `feilNett`). `useProsjektkortSedel` bruker hooken; glue-vakten leser derfor `useProsjektkortSedel.ts` + `useGjenaapneDagsseddel.ts` som prosjektkort-kopien. Kortskjermen viser feilteksten under knappen og lenken «Se hele dagen (N prosjekter)» (`timer.kort.seHeleDagen`, `router.dismissTo` til samlesiden) når `kortProsjektIder(...)` gir mer enn ett prosjekt — samme telling som samlesiden. Dagskortet `[id].tsx` er urørt og har sin egen gjenåpne. Tester: `prosjektkort/gjenaapne.test.ts` (feilmapper, `visSeHeleDagen`, vakter for kortskjermen, én gjenåpne-vei og dagskort-isolasjon; negativkontroll: byttet `onGjenaapne` og `push` i stedet for `dismissTo` gir rødt).
- **Dagskort-vakt:** `dagskort-isolert-vakt.test.ts` krever at `[id].tsx` ikke importerer prosjektkort-komponentene, har nøyaktig én `<Redirect` i `if (kortModus)`, og fryser JSX-taggsekvensen (SHA-256) — endret dagskort-markup gir rødt.
- `ProsjektkortSamleside.tsx` ble flyttet til `src/components/timer-detalj/prosjektkort/` (samlesiden ble senere erstattet av `ProsjektkortDagsoversikt` i `8afb3007`, ORDRE 36b; fila bærer i dag bare `KortHode` i bruk, `app/timer/[id]/kort/[projectId].tsx:75`). `kortIder` og `kortProsjektIder` står igjen i `[id].tsx` fordi `ProsjektVelgerModal`-linja (`ekskluderIder={kortModus ? kortIder : aktiveProsjektIder}`) ikke er rørt.

### Dagsoversikt i prosjektkort-modus (ORDRE 36b) — 🟡 `feat/dagsoversikt-36b` (2026-11-07, ikke merget)

Spec: `dagsoversikt-beskrivelse-spec.md` § 2.1–2.4. Samlesiden (`app/timer/[id]/prosjektkort.tsx`) og kortskjermen (`app/timer/[id]/kort/[projectId].tsx`) bruker samme komponent, `src/components/timer-detalj/prosjektkort/ProsjektkortDagsoversikt.tsx`. Kortskjermen sender `enkeltProsjekt`, som skjuler navneraden, sum-kortet, Send og «+ Nytt prosjektkort», og viser «+ Timer». Lenken «+ Nytt prosjektkort» er blå (`text-sitedoc-primary`) og `text-base` (funn 4, 🟡 `fix/timer-telefontest-1311`, ikke merget; var grå `text-sm`). Kortskjermen er `KortHode` (fra `ProsjektkortSamleside.tsx`) med oversikt-linjene under. `TilleggSeksjon` og `UtleggSeksjon` rendres direkte og uendret under linjene.

- **Linjene per prosjekt** (⚠️ erstattet av radform 2026-11-12, se under — `linjerForProsjekt` brukes fortsatt for synlighetsreglene `visMaskin`/`visVarer`): Arbeid (segmenter, med overtid som underlinje), Reise, Maskin og Varer, Utlegg og Beskrivelse/«Mangler». Regelen bor i `src/utils/dagsoversikt.ts` (`linjerForProsjekt`, `statusOrd`, `dagsoversiktSum`).
  - Maskin vises når firmaet har utstyr i cache ELLER maskin er ført.
  - Varer vises når prosjektet har varelager ELLER varer er ført.
  - «Mangler» betyr arbeid > 0 uten beskrivelse på noen arbeidsrad (K3).
  - Sum-kortet har «Sum i dag», ramme og byggeplass, et statusord med ● og Send.
- **Farger og stil:** kun grått og amber. Skriften er lik for alle linjer, og det brukes ingen ikoner (unntak radform: `Clock` foran radens tid, eneste tillatte ikon-import). Slett går alltid via bekreftelse (`RadHandlinger.tsx`). Kildevakt: `dagsoversikt-kilde-vakt.test.ts`.
- **Redigering:** én skrivesti via `prosjektkort/radLagring.ts` (lagring C, `db` sprøytes inn):
  - `leggTilTimerRad`, `oppdaterTimerRad`, `fjernTimerRad`
  - `oppdaterMaskinRad`, `fjernMaskinRad`

  Modalene `TimerRadModal`, `MaskinRadModal`, `SplittRadModal`, `ProsjektByggeplassVelgerModal` og `KortVareforbrukModal` er delt med dagskortet.
  - `handlinger?` («Del opp»/«Slett») og `fokusBeskrivelse` er av som default, så dagskortet ser modalene som før.
  - Vakt: `dagskort-isolert-vakt.test.ts` § ORDRE 36b.
  - Hurtigvelg (`hurtigVelgTimerRad`) er erstattet av «Flytt raden» (RETUR 3, under).
- **To kopier av skrivesemantikk:** timer- og maskinradenes skriving finnes både i dagskortets `TimerSeksjon.tsx`/`MaskinSeksjon.tsx` (urørt) og i `radLagring.ts`. **En fiks i den ene skal vurderes i den andre.** Vakten `radLagring-glue-vakt.test.ts` gjør to sjekker:
  - Den sammenligner nøkkelsettet i alle `.set`/`.values`.
  - Den teller 21 tokens i begge kopiene.

  Vakten feiler ved ett endret token, og har negativkontroll.
- **Matpause på kortskjermen:** avhukingen har flyttet fra rad-kortet til rad-modalen (`RadHandlinger`, `matpause`). Regelen er den samme: dag > 5,5t, raden krysser lunsjvinduet, og sedelen er redigerbar.
  - Flytten går via `handterPauseToggle` (sett, flytt eller `BekreftFjernMatpauseModal`) og lukker modalen.
  - Oversikten tar `onPauseToggle`. Bare kortskjermen sender den, og dagskortet ser ingenting.
- **Ingen funksjon fjernet:** «+ Ny vare» er erstattet av Varer-linjen, og ECO-bøttenes maskin-tak vises per prosjekt.

#### RETUR 3 — kortet = prosjekt + byggeplass + underprosjekt (🟡 `feat/dagsoversikt-36b`, ikke merget)

Kenneth GO 2026-11-07 (§ 7: ingen backfill, valg kun når relevant (K3), SQLite OK). Ingen Prisma-migrering; kun additive, valgfrie tRPC-felt.

- **Kortnøkkel** (`apps/mobile/src/lib/prosjektkortMobil.ts`): `kortNokkel` = `projectId|byggeplassId|ecoId` («ingen» for null). Byggeplass er den EFFEKTIVE: radens egen, ellers sedelens — men bare når sedelens byggeplass hører til samme prosjekt (`effektivByggeplass`). `kortNokler`/`raderPaaKort`/`radHorerTilKort` grupperer timer, maskin og varer; `lagretByggeplassForKort` gir `null` (= arv) når kortets byggeplass er sedelens. Kortskjermen leser kortet fra ruteparametrene (`fraRuteParam`/`tilRuteParam`).
- **Kortlås:** `ProsjektkortKontekst` bærer hele kortet (`useKortLaas`); `TimerRadModal` låser prosjekt, byggeplass og underprosjekt til kortets. Utenfor kort (dagskortet) er konteksten `false` og ingenting endres.
- **«+ Nytt kort»** (`KortValgModal`, modus `ny`): prosjekt med 0–1 byggeplass og uten underprosjekt åpner kortet direkte (`kortValgTrengs`, K3). Ellers: underprosjekt-chips («Uten» forhåndsvalgt) og byggeplass-rader. «Uten byggeplass» tilbys alltid (RETUR 36c-2 P1, 🟡 `fix/36c-retur-2`): på en sedel med byggeplass A i samme prosjekt løftes arven ut før lagring/flytt (`trengerByggeplassLoft` + `loftByggeplassArv`, `kortRadFlytt.ts`).
- **«Flytt raden»** (`KortValgModal`, modus `flytt`; skriving i `prosjektkort/kortRadFlytt.ts`, utenfor `radLagring.ts` med vilje): timer-rad beholder alle felt unntatt prosjekt/byggeplass/underprosjekt; alle koblede maskiner følger (`foelgKobletMaskin`, GO 5; timer urørt). Maskin alene sjekkes mot kapasitet (`beregnMaskinBrudd`) før flytt og kobles løs. Vare: `pending` flyttes lokalt og sendes med nye verdier; `synced` flyttes FØRST på server (`vareforbruk.oppdater` med `projectId`, GO 6), feil vises i modalen og ingenting lokalt endres; `avvist` beholder syncStatus. Varer har ingen arv: både flytt og «+ Vareforbruk» (`kortLaas`) bruker kortets **effektive** byggeplass (`vareByggeplassForKort`, `apps/mobile/src/lib/prosjektkortMobil.ts`, RETUR 4), mens timer/maskin lagrer null når kortet står på sedelens byggeplass. **Kollisjonssjekk (ORDRE (35)):** en timer-rad flyttes ikke til et kort der tidene overlapper — samme sjekk og melding som «Endre kort» (`finnKortKollisjon` i `flyttKort`). Maskin og vare alene har ingen overlapp-regel og sjekkes bare som før.
- **Server (`apps/api/src/routes/vareforbruk.ts` `oppdater`):** valgfri `projectId`. Prosjektbytte krever medlemskap i målprosjektet, at målet tilhører firmaet og samme varelager-eier (`FORBIDDEN` ellers), og tilgang-policy. Har linjen `dagsseddelId`, må sedelen ha en timer-rad på målprosjektet, ellers `BAD_REQUEST` (RETUR 4) — en synket vare kan derfor ikke flyttes til et prosjekt der timer-raden bare finnes lokalt før den er synket. Byggeplass/underprosjekt valideres mot målprosjektet og nullstilles ved bytte når input ikke sier noe. `hentMineForDato` returnerer `externalCostObjectId`. Test: `vareforbruk-flytt.test.ts`.
- **Maskin-byggeplass** (`apps/api/src/routes/timer/byggeplass-rad.ts` `maskinByggeplassVedSync`): `syncBatch` tar valgfri `byggeplassId` pr. maskin. Null eller utelatt (eldre klient) = arv av sedelens byggeplass, som timer-radene (RETUR 4); en byggeplass fra et annet prosjekt blir null. Pull returnerer feltet. Test: `byggeplass-rad.test.ts`, `timer-lag2-sync.test.ts`.
- **Bekreft dag, prosjektbytte med flere kort** (`flyttBeskrivelseVedProsjektbytte`, `apps/mobile/src/utils/bekreftDag.ts`, RETUR 4): teksten flyttes både fra `projectId`-nøkkelen og fra kortet som arver dagens byggeplass, aldri over tekst målprosjektet alt har. Test: `bekreftDagBeskrivelse.test.ts` § RETUR 4 (P6).
- **SQLite (mobil):** `sheet_machine_local.byggeplass_id` og `vareforbruk_local.external_cost_object_id`, additive via `ALTER` (`KORTVALG_LOCAL_KOLONNER`, `migreringer.ts`). Ingen backfill: gamle rader arver sedelen ved visning. Test: `migreringer.kortvalgLocal.test.ts` (feiler når kolonnen mangler).
- **Dag-seksjonen** (`prosjektkort/DagSeksjon.tsx`, GO 4; 🟡 `feat/timer-tillegg-utlegg-kort` reverserer for tillegg/utlegg — de føres på kortskjermen, se § Tillegg og utlegg på prosjektkortet — API, «Mobil — føring på kortskjermen»): reise, tillegg og utlegg hører til dagen og ligger under kortene, over sum og «Send dagen». Prosjekt-forslaget er prosjektet med flest arbeidstimer. Reise velger prosjekt; byggeplass/underprosjekt i modalen bare når prosjektet har flere (K3). `TilleggSeksjon` og `UtleggSeksjon` gjenbrukes (utlegg får prosjekt-chips ved flere prosjekter). Kortskjermen viser dem ikke lenger — de er flyttet, ikke fjernet.
- ⚠️ **Regel (Kenneth 2026-11-16): underprosjekt er en del av prosjektkortet og lagres på kortet når det er registrert.** Punktet under beskriver koden slik den er i dag: Bekreft dag har ikke underprosjekt. Det er en feil som skal rettes (🟡 avvik 1 i «Prosjektkort og dagskort — definisjon»).
- **Bekreft dag — beskrivelse pr. kort** (`apps/mobile/src/utils/beskrivelseKort.ts`): `kortMedArbeid` gir ett felt pr. (prosjekt, effektiv byggeplass) med arbeid; underprosjekt finnes ikke i Bekreft dag. Nøkkelen i `beskrivelsePerKort` er `projectId` når prosjektet har ett kort (identisk med 36a), ellers kortnøkkelen. `manglerBeskrivelse` sperrer pr. nøkkel (`BekreftDagHandling.nokler`); `anvendDagsforslag` skriver tekst fra radens eget kort (`beskrivelseForRad`). Feltet viser byggeplassnavnet når flere kort deler prosjekt; bytte av dagens byggeplass tar med teksten. Tester: `bekreftDagBeskrivelse.test.ts` § ORDRE 36b.
- **Dagskortet urørt:** vakt `dagskort-isolert-vakt.test.ts` § «ORDRE 36b — kortvalg og dag-seksjonen rører ikke dagskortet» (optional props, `REISE_VILKAAR`, `UTLEGG_CHIPS`, kontekst-default `false`, negativkontroll). Flytt-vakter: `dagsoversikt-kilde-vakt.test.ts`.

#### Kenneths telefontest 2026-11-12 — del 1–4 (🟡 `fix/timer-mobil-kenneth-1211`, ⚠️ venter Kontrollør-gate)

- **V21 i kortvisningen:** `ProsjektkortDagsoversikt` sender `dagsnormTimer={normTimer}` og `onLeggTilOvertidDel` til `TimerRadModal` som `TimerSeksjon` gjør. Overtid-delen lagres som ny rad på samme kort (`leggTilTimerRad`, byggeplass via `lagretByggeplassForKort`). `kort/[projectId].tsx` henter normen fra svar-cachen (`hentDagsnormLokalt`) i stedet for `null`. Kenneths dag (07–15 normal, 15–17 OT 50 %, 17–18 normal, norm 7,5) gir forslaget OT 50 % for 17–18.
- **Prosjektnavn på mobil — én kilde:** `prosjektVisningsnavn` (`apps/mobile/src/utils/prosjektNavn.ts`) returnerer bare navnet. Prosjektnummeret («SD-nummer») vises ikke på noen mobilflate (kort, overskrifter, prosjektvelgere, attestering); `prosjektNummer`-propen på `ProsjektFelt` er fjernet. Nummeret er fortsatt søkbart i `timer-detalj/ProsjektVelger.tsx` og `TimerSeksjon.tsx`. Ukjent prosjekt (ikke i lokal cache) vises som «Ukjent prosjekt» (`timer.detalj.ukjentProsjekt`), aldri som ID — også i GPS-mismatch-meldingene. Web er uendret.
- **Overtidsrader med fra–til:** overtidslinja i dagsoversikten rendres som arbeidslinja: «15:00–17:00 · 2,0 t · Overtid 50 %» (`timer.dagsoversikt.overtid` = «Overtid {{prosent}} %»).
- **Test:** `prosjektkort/kenneth-1211-vakt.test.ts` (rene tester + kildevakter; negativkontroll per del).

#### Dagsoversikt i radform (🟡 `feat/timer-dagsoversikt-radform`, Kenneth 2026-11-12, ⚠️ venter Kontrollør-gate, migrering ikke kjørt)

Godkjent plan «Dagsoversikt i radform»: beslutning 1 = B (varer kobles til rad), 2 og 3 som anbefalt. Maskin/vare i Bekreft dag: se «TILLEGG 2026-11-12» under.

- ⚠️ **Regel (Kenneth 2026-11-16): én ansatt har ett dagskort pr. døgn. Dagskortet inneholder 1–30 prosjektkort. Inne i hvert prosjektkort står radene som linjer — overtid er en linje i prosjektkortet, ikke et eget prosjektkort.** Bygget i ORDRE 27b (🟡 `fix/kort-a-overtid-dagskort` (ORDRE 27b, 2026-11-16, ikke merget)): punktene under beskriver kortet med linjer; se «Prosjektkort og dagskort — definisjon».
- **Én linje pr. timerrad** i sitt prosjektkort i `ProsjektkortDagsoversikt`, i tidsrekkefølge (fra-tid stigende, rader uten fra-tid sist); kortene står i rekkefølgen til sin første linje. Regelen bor i `apps/mobile/src/utils/dagsoversiktRader.ts` (`raderForDag`, `grupperPaaKort`; `grupperPaaUnderprosjekt` har siden ORDRE 27b bare testkallere). Rader slås aldri sammen, heller ikke like rader på samme prosjekt. Overtid er en vanlig rad. Oppsummeringen pr. prosjekt er fjernet.
- **Kortet** (`prosjektkort`): hode med prosjektnavn, sum timer og `kortHode` (byggeplass/underprosjekt); linjene (`kortLinje`: `Clock` + «07:00–15:00» (`timer.dagsoversikt.utenTid` når fra–til mangler) · timer · lønnsart, overtid: `timer.dagsoversikt.overtid`); amber «Mangler beskrivelse» når en arbeidslinje mangler tekst (åpner den linja med fokus); kortets beskrivelser (like tekster én gang); under hver linje dens maskin og varer og «+ Vare» koblet til linja (`setVareRadId(rad.id)`), deretter kortets «Uten rad». Prosjektnavnet åpner kortet, eller kortets første linje på kortskjermen (`enkeltProsjekt`). Trykk på en linje åpner `TimerRadModal` når `redigerbar`; V21 (`dagsnormTimer`, `onLeggTilOvertidDel` → `leggTilTimerRad`) er uendret.
- **Kort uten rader** får eget kort med «+ Legg til arbeid», «+ Legg til maskin» og «+ Vare» som før (knappeteksten kun når `redigerbar`).
- **«Uten rad»** (`timer.dagsoversikt.utenRad`): maskin/varer uten kobling, med kobling til ukjent rad eller til rad på annet prosjekt. Aldri skjult, aldri plassert etter skjønn. Gamle varer og alt ført på web havner her (web kobler ikke).
- **Bunnlinje:** Sum i dag · Overtid · Maskin · Reise, `maskinOverTak`-varsel pr. prosjekt, normramme, byggeplass, statusord. Tillegg og Utlegg står i egne seksjoner.
- **Lagre-sperre (Kenneth 2026-11-12, RETUR radform):** rad-modalen (`TimerRadModal` i `TimerSeksjon.tsx`, delt dagskort/prosjektkort) lagrer ikke en arbeidsrad uten beskrivelse — `lagre()` stopper på `radManglerBeskrivelse` (`utils/dagsoversiktRader.ts`) før skriving, med rød ramme, fokus og feltmelding `timer.feil.beskrivelsePaakrevd`. Reise (reise-inngang eller reise-lønnsart) er unntatt. Skriveveiene (`radLagring`, Bekreft dag) har ingen egen sperre; gamle rader uten tekst fanges av Send-sperren under.
- **Send-sperre (beslutning 3):** `forsteRadUtenBeskrivelse` (reise krever ingen tekst). Send åpner da raden med fokus i beskrivelse i stedet for å sende; amber linje over Send (`timer.dagsoversikt.sendSperret`) gjør det samme.
- **Vare kobles til rad:** nullable `sheet_timer_id` på `varelager.vareforbruk` (Prisma `sheetTimerId` + indeks, migrering `20261112000001_vareforbruk_sheet_timer_id`, additiv, ingen backfill), `vareforbruk_local.sheet_timer_id` på mobil, `vareforbrukSync` sender/leser feltet begge veier. Server (`gyldigVareRad` i `apps/api/src/routes/vareforbruk.ts`) lagrer null når raden ikke finnes på samme sedel og prosjekt. «+ Vare» fra en rad sender `sheetTimerId={vareRadId}` til `KortVareforbrukModal`; Bekreft dag kobler varer til arbeidsraden via `ctx.radFor` i `dagsforslagAnvend.ts`. Maskin fra Bekreft dag: se «Maskinkobling» under.
- **Maskinkobling (NY BESLUTNING Kenneth 2026-11-12, erstatter «én maskin pr. timerad»):** en timerad har 0..n maskiner via eksisterende `sheet_machine.sheet_timer_id` (ingen unik-indeks, ingen migrering). Hver maskin har egne timer: standard = radens, kan settes lavere, aldri høyere. Felles skrivevei `apps/mobile/src/services/kobledeMaskiner.ts` (`maskinerOverRad`, `maskinerOverRadEtterLagring`, `skrivKobledeMaskiner`).
  - *Før:* `radLagring.oppdaterTimerRad` og dagskortets `oppdater` tok `maskin?: NyMaskin | null` og rørte bare FØRSTE koblede maskin (`.all()[0]`): et objekt satte maskinens timer = radens timer (+ radens fra/til og bøtte), `null` slettet den. `TimerSeksjon`s `eksisterendeMaskinRad` viste bare første maskin, uten timer-felt.
  - *Nå:* `oppdaterTimerRad(..., maskiner?: MaskinEndringer)` returnerer `{ ok: false, grunn: "maskinOverRad" }` uten å skrive noe når en maskin ville havnet over radens timer. Bare linjene som sendes, endres (linje uten id = ny, `fjernede` = slett + tombstone, kun hvis koblet til raden); ikke-nevnte koblede maskiner står urørt; `undefined` rører ingen maskiner. Fra/til følger raden bare når maskintimer = radens; ellers beholdes egne tider når timene er uendret, ellers null. Ny maskin skrives med radens prosjekt, byggeplass og ECO.
  - Rad-modalen (`TimerRadModal`, delt dagskort/prosjektkort) har maskinliste med timer pr. maskin og avviser lagring med `timer.maskinSeksjon.overRad` — appen retter aldri selv. `settInnTimerRad`/`lagreNyTimerRad` sjekker før raden (og sedelen) opprettes.
  - Del opp (`SplittRadModal`): koblede maskiner blir på del 1 (beholder id); får del 1 færre timer enn en koblet maskin, avvises delingen med samme melding. Flytt (`foelgKobletMaskin`): ALLE koblede maskiner følger radens bøtte; timer røres aldri.
  - Bekreft dag: se TILLEGG under (`radForMaskin` er fjernet — maskiner har ikke fra–til). Gamle ukoblede maskiner beholder sine timer.
  - Ingen sammenslåing av rader.
- **Én beskrivelse pr. prosjektkort (Kenneth 2026-11-16, ORDRE 24; erstatter «beskrivelse pr. rad» fra 2026-11-12):** Kenneth: «hvert prosjektkort skal ha sin egen beskrivelse. dersom det er behov for flere beskrivelser skal heller flere prosjektkort opprettes». Bekreft dag har ett felt pr. kort (`BekreftDagBeskrivelse.tsx`, én `TextInput`) uansett hvor mange arbeidsrader kortet har; kortets tekst skrives på alle kortets arbeidsrader, normal og overtid (`beskrivelseForRad`, `utils/beskrivelseKort.ts`). `manglerBeskrivelse` (`utils/bekreftDag.ts`) gir kortnøkler. Radfeltene, `retting.beskrivelsePerRad`, `radBeskrivelseNokkel` og i18n `beskrivelse.radPlassholder`/`radMangler` er fjernet. Et gammelt utkast med `beskrivelsePerRad` lastes uten feil; radteksten ignoreres og teller ikke som innhold (`erTomtUtkast`, `utils/prosjektkortUtkast.ts`). Overtid lagres fortsatt som egen rad (egen lønnsart) og vises som egen linje i dagskort og web, men deler ikke opp kortet.
- **Et prosjektkort inneholder aldri to datoer (Kenneth 2026-11-16, RETUR (24)):** en nattevakt 21–06 er to prosjektkort, delt ved midnatt (21–24 og 00–06), hvert med egen beskrivelse og eget sett maskin/varer. Kortet er (dato, prosjekt[, byggeplass]) (`kortMedArbeid`, `radKortId`, `utils/beskrivelseKort.ts`): kortet på forslagets startdato (`forslagStartDato`: start-segmentets dato) har nøkkelen `projectId` (eller `kortNokkel` når prosjektet har flere byggeplass-steder), alle senere datoer `${dato}|${nøkkel}` — også når startdatoens kort mangler fordi datoen har 0 t eller er blokkert (RETUR 2 (24)). Et utkast fra før RETUR (24) havner derfor bare på startdatoens kort, og kortet 00–06 starter tomt; teksten fra 21–24 kopieres ikke. `manglerBeskrivelse` (`utils/bekreftDag.ts`) sperrer pr. kort. Når prosjektet har kort på flere datoer, viser etiketten datoen («dd.mm.», `kortEtikett`/`kortDato` i `bekreft-dag.tsx`). «+ Maskin» fyller inn kortets arbeidstimer (`kortArbeidstimer`, `utils/tilleggPaaKort.ts`), og arbeideren reduserer; maskin på et kort kan ikke overstige kortets arbeidstimer (21–24 → maks 3 t; 00–06 → 5,5 t, pausen trukket). Ingen automatisk flytting mellom kortene: `fordelTilleggPaaKort` fordeler bare innen ett kort. Tillegg/utlegg følger datokortet (underpunktet under). Samsvarer med midnatt-splitten i lagringen (én dagsseddel pr. kalenderdag, § Midnatt-splitt). Web viser én dagsseddel om gangen (`trpc.timer.dagsseddel.hentMedId`, `apps/web/src/app/dashbord/timer/[id]/page.tsx`), så web-kortene har én dato. Tester: `bekreftDagTillegg.test.ts` § RETUR (24) (inkl. «RETUR 2 (a)/(b)») og § RETUR (24) V1.
  - **Tillegg og utlegg følger datokortet (Kenneth 2026-11-16, ORDRE 25):** på en nattevakt velger hver tillegg-/utleggslinje i Bekreft dag datokortet («Prosjekt · 16.11.» eller «Prosjekt · 17.11.»), og linja lagres på det kortets dagsseddel. Kortvalget er `arbeidKort` (`kortMedArbeid`) med samme `kortEtikett` som beskrivelse/maskin (`kort={arbeidKort}` i `bekreft-dag.tsx`); linja bærer kortets `dato` (`NyttLonnstillegg.dato`/`NyttUtlegg.dato`, `services/tilleggUtleggSkriv.ts`; settes av `nyttKort` og kortvalget i `BekreftDagLonnUtlegg.tsx`). Ved lagring setter `knyttLonnUtleggTilKort` (`utils/lonnUtleggKort.ts`) kortets byggeplass og dato, og `anvendDagsforslag` skriver linja på den datoens sedel (`sedelPerDato`, `utils/dagsforslagAnvend.ts`). Blokkert (sendt) dato har ikke kort og kan ikke velges. Ny linje får prosjektets kort med flest timer, og på nattevakt startdatoens kort (`kortMedFlestTimer`) — samme sedel som før. `kortForLinje`: linje uten dato (utkast fra før ORDRE 25) → startdatoens kort (`BeskrivelseKort.paaStartDato`); datoen har ikke kortet lenger (sedelen sendt, rammen endret) → stedets første åpne datokort, og kortvalget viser det. Linje uten kort (prosjekt uten arbeid, ingen `dato`) → første åpne datos sedel (`forsteLagredeSheetId`), som før — aldri stille kastet. **Dato sendt mens skjermen står (ORDRE 26):** forslaget i Bekreft dag er en useMemo uten sync-avhengighet, så en dato kan bli sendt (timerSync-pull, f.eks. sendt fra web eller en annen enhet) etter at kortene ble tegnet. `bekreftDag` (`utils/bekreftDag.ts`) leser da sedel-status ferskt (`datoerSendtUnderveis` → `finnSendteDatoer`, `services/dagsseddelOpprett.ts`) for forslagets åpne datoer og datoen til hver tillegg-/utleggslinje, rett etter `finnSedelIAnnetFirma`. Er en av dem sendt, stopper Bekreft med `datoSendtUnderveis` FØR første skriving — ingen timer, beskrivelse, maskin/varer, tillegg eller utlegg skrives, og dagen står åpen. Skjermen viser `timer.bekreftDag.sendtUnderveis.tittel`/`tekst` med datoen og regner forslaget ut på nytt (`sendtNonce` i `beregnet`-deps, `bekreft-dag.tsx`); den sendte datoen vises da som sendt, og linjer på den får stedets første åpne datokort, synlig i kortvalget. Nytt trykk er en ren retry. En linje MED dato flyttes aldri til en annen dato: `anvendDagsforslag` kaster `DatokortUtenSedelFeil` hvis datoen ikke er åpen (sjekk før første skriving) eller ikke fikk sedel — bare mulig om vakten er forbigått. Endret oppførsel i racet: før 26 ga en dato sendt underveis `delvisSendt`/`blokkertSendt` (timene på den datoen ble ikke lagret) eller `tilleggUtleggUtenDag`; nå kommer stoppen først, og de samme utfallene kommer etter ny utregning. Dagsvakt: ett kort, ingen dato i etiketten og intet kortvalg — uendret. Web: én sedel = én dato, ingen endring. Tester: `bekreftDagTillegg.test.ts` § ORDRE 25 og § ORDRE 26 (inkl. «reserven `forsteLagredeSheetId`»), `bekreftDagUtkast.test.ts` T7, `lonnUtleggKort.test.ts`, kildevakt T12 i `tillegg-utlegg-kort-vakt.test.ts`.
- **TILLEGG 2026-11-12 (Kenneth, før gate) — raden eier prosjekt, byggeplass og underprosjekt:**
  - *Bekreft dag — ett sett maskin/varer pr. prosjektkort* (ORDRE 24, Kenneth 2026-11-16: «jeg trenger kun en av disse per prosjektkort»; PRESISERING 2026-11-12 + GO 2026-11-13 for nøkkel og vakter): «+ Maskin»/«+ Varer» og kortets linjer vises én gang pr. kort, under kortets beskrivelse (`BekreftDagRadTillegg.tsx` som `tillegg`-prop på `BekreftDagBeskrivelse`, rendret av `bekreft-dag.tsx`), også når overtid deler kortet i flere arbeidsrader. Dagslista «Maskin og varer» og tids-matchingen er fjernet; ingen automatisk kobling. Skjermen holder `tilleggPerRad[nøkkel]` og legger kortets sett under kortets første arbeidsrads nøkkel (`tilleggPaaKort`/`settTilleggPaaKort`, `utils/tilleggPaaKort.ts`). UI-vakten er maskin ≤ kortets sum arbeidstimer (`kortArbeidstimer`, tekst `timer.bekreftDag.tillegg.overKort`).
  - *Nøkkel og lagring:* nøkkelen er `tillegg:${dato}|${radIndeks}` (`radTilleggNokkel`, `utils/bekreftDagTillegg.ts`; ORDRE Tillegg/Utlegg 3a, 2026-11-13; før: `dato|lønnsartId|radIndeks`), der `radIndeks` (`DagsforslagRad.radIndeks`, `utils/dagsforslag.ts`) er carve-vinduets opprettelsesrekkefølge — stabil identitet, ikke posisjon etter tidssortering. Verken prosjekt eller lønnsart er med i nøkkelen, så prosjekt- og lønnsartbytte tar linjene med. Forsvinner raden (radIndeks borte), blir linjene foreldreløse i stedet for å gli over på en annen rad. Ved lagring fordeler `fordelTilleggPaaKort` (kalt i `bekreftDag` før vaktene) kortets sett på kortets arbeidsrader — linjer samles uansett hvilken av kortets nøkler de står under (gammelt utkast): varer → kortets første arbeidsrad; maskin → første rad opp til radens timer, resten på neste rad (siste rad tar resten; ekstra deler får `lokalId#n`). «Første rad» er første i tid; et kort har én dato, så ingenting fordeles over midnatt. Kapasiteten regnes pr. (maskin, rad): samme maskin to ganger på kortet (4 t + 3 t på kort 4 + 3,5) gir 4 t på rad 1 og 3 t på rad 2, ikke 7 t på rad 1 (V1, RETUR (24)). `anvendDagsforslag` skriver hver rads linjer med `sheetTimerId` = radens id og radens prosjekt, effektive byggeplass og underprosjekt (`kortValgFor`, `skrivTillegg` i `dagsforslagAnvend.ts`). Vakter før noe skrives (`bekreftDag`): linjer uten rad → `tilleggUtenRad` (skjermen viser `timer.bekreftDag.tillegg.utenRadTittel`/`utenRadMelding` og linjene i en egen boks — aldri stille kastet); maskin over radens timer etter fordeling, summert pr. maskin på raden (`maskinerOverRaden`) → `maskinBrudd`, som i praksis betyr maskin over kortets sum; deretter bøtte-regelen pr. dato (`vaktGrunnlag(…, dato)`). Serveren har ingen pr.-rad-regel — regelen er pr. jobb (`krevIngenNyeMaskinBrudd` via `beregnJobbMaskinBrudd`, w9, § Maskin ≤ arbeidstimer). Kortets eksisterende rader får aldri linjer fra Bekreft dag. Blokkert (sendt) dato har ingen rad å legge linjer på.
  - *Prosjektkort* (`ProsjektkortDagsoversikt`): «Flytt raden» på en timer-rad går via `flyttKort` med `radInnhold` (`kortRadFlytt.ts`) — koblede maskiner og varer (lokale og synkede, server først etter push) følger, timer og mengde uendret; ukoblede linjer blir. Koblet maskin/vare har ingen egen Flytt, men linjen `timer.dagsoversikt.folgerRaden` (`RadHandlinger.folgerRaden`, vare-modalen); ukoblede («Uten rad») flyttes som før.
  - *Sortering* (`grupperPaaUnderprosjekt`): hele rader (med maskin/varer) under radens (prosjekt, underprosjekt), grupper i rekkefølgen til sin første rad, overskrift «prosjekt · underprosjekt» når dagen har mer enn én gruppe. «Uten rad» vises pr. gruppe under linjens eget underprosjekt. Ingen sammenslåing.
- **ORDRE Tillegg og Utlegg i Bekreft dag (GO 2026-11-13, 🟡 `feat/timer-bekreftdag-tillegg-utlegg`, ikke merget):**
  - *Seksjon* `BekreftDagLonnUtlegg.tsx` under arbeidsradene: «Tillegg» og «Utlegg», hver med `HjelpIkon` og «+». Modalene er prosjektkortets (`TilleggRadModal`, `UtleggRadModal` med `onOpprett`, eksportert fra `TilleggSeksjon.tsx`/`UtleggSeksjon.tsx`). Linjene holdes i minnet (`lonnUtlegg` i `bekreft-dag.tsx`) og er knyttet til sedel + kort (prosjekt + byggeplass), ikke til en arbeidsrad. Standard = kortet med flest arbeidstimer (`kortMedFlestTimer`, `utils/beskrivelseKort.ts`; likt → første) — T12, se § Tillegg og utlegg på prosjektkortet. Skjules når alle datoer er sendt.
  - *Skriving:* ved [Bekreft og lagre] skriver `anvendDagsforslag` (`utils/dagsforslagAnvend.ts`) hver linje på sedelen for linjas datokort (`sedelPerDato`; ORDRE 25), ellers `forsteLagredeSheetId` (første åpne dato sin sedel), via `skrivLonnstillegg`/`skrivUtlegg` (`services/tilleggUtleggSkriv.ts`, samme skrivevei som prosjektkortet). Kvitteringen køes med `leggIKo` først etter skrevet Bekreft (`resultat.lonnUtleggSkrevet`). Tillegg-vedlegg legges til etterpå i prosjektkortet (B1).
  - *Vakt:* `tilleggUtleggUtenDag` i `bekreftDag` — linjer finnes, men alle datoer er sendt → Alert `timer.bekreftDag.tilleggUtlegg.utenDagTittel`/`utenDagTekst`, ingenting skrives. Rekkefølge: `manglerBeskrivelse` → `tilleggUtleggUtenDag` → `tilleggUtenRad` → `maskinBrudd` → bøtte → `sedelIAnnetFirma` → `datoSendtUnderveis` (ORDRE 26) → anvend; enhver stopp skriver null linjer. Sendes en dato mellom forslag og Bekreft (race), stopper `datoSendtUnderveis` før skriving, og skjermen regner ut på nytt; er alle datoene da sendt, gir neste trykk `tilleggUtleggUtenDag`. Stoppen etter anvend (`lonnUtleggSkrevet` false → `tilleggUtleggUtenDag`, RETUR Kontrollør M3) står som sikkerhetsnett — skjermen navigerer ikke bort, så linjer og kvitteringer beholdes.
  - *Rydding:* forlates skjermen uten lagring, slettes ulagrede kvitteringsfiler (`slettLokaltBilde`); fjerning av en utlegg-linje sletter fila med en gang.
  - *3b — sedel uten prosjekt:* en server-sedel uten prosjekt (lokalt `project_id = ""`) får maskin/vare med radens prosjekt (`sedelKontekstForRad`, `utils/bekreftDagTillegg.ts`). Før: linjene ble stille droppet.
  - *Prosjektkortet* er uendret bortsett fra `HjelpIkon` ved overskriftene i `DagSeksjon`. Vakt: `dagskort-isolert-vakt.test.ts` (ProsjektGruppe uten `HjelpIkon`/`onOpprett=`).
  - *Tester:* `bekreftDagTillegg.test.ts` § ORDRE Tillegg/Utlegg (skrives på første åpne sedel + kø, alle sendt → `tilleggUtleggUtenDag`, hver stopp skriver null, `prosjektMedFlestTimer`, samme rader som prosjektkortets `skrivUtlegg` — alle med negativkontroll); `bekreftDagTillegg.test.ts` § RETUR M3 + ORDRE 26 (sendt-race); `glemtDag.test.ts` kildevakter for Alert, kø etter skriving, rydding og skjuling, samt RETUR M9 (fjern-linje sletter fila) og M11 (`onOpprett` returnerer før skriving).
- **Dagskortet urørt.**
- **Test:** `dagsoversiktRader.test.ts`, `prosjektkortEttKort.test.ts` (ORDRE 24; erstatter `beskrivelsePerRad.test.ts`), `kobledeMaskiner.test.ts`, `radLagring.test.ts` § maskinkobling (8+3 t, over raden avvist, ingen stille endring/sletting, ukoblet 3 t forblir 3 t — hver med negativkontroll), `kortRadFlytt.test.ts` (alle maskiner følger), `kortHele.test.ts` § TILLEGG (flytt av rad tar med maskin + varer, nabo-rad/ukoblet urørt, negativkontroll uten varer), `retur-radform-vakt.test.ts` (lagre-sperre + R10 Del opp, med mutanter), `nyTimerRad.test.ts` (ingen tom sedel ved maskin over raden), api `vareforbruk-gyldig-rad.test.ts` (R17: annen sedel/annet prosjekt → null), `migreringer.radformLocal.test.ts`, `vareforbrukSync.test.ts`, `bekreftDagTillegg.test.ts` § PRESISERING TILLEGG (flere rader → ingenting uten rad, ORDRE 24: linje på rad 2 havner på kortets første rad, 7 t fordeles 4 + 3, over kortets sum stopper, forsvunnet rad → `tilleggUtenRad`, fra-tid-retting beholder linjene, bytte av rekkefølge beholder linjen på samme rad — hver med negativkontroll; bytte-testen er rød med nøkkel etter posisjon), `dagsoversiktRader.test.ts` § gruppering (ECO A under A, ukoblet B under B), kildevakter `prosjektkort/radform-vakt.test.ts` (M10: feiler når `leggTilTimerRad` i `onLeggTilOvertidDel` byttes med `void` — kjørt), `dagsoversikt-kilde-vakt.test.ts` (kun `Clock`), `kenneth-1211-vakt.test.ts` del 4.

### «+» og «+ Nytt prosjektkort» → Bekreft dag uten GPS (ORDRE 36c) — 🟡 `feat/pluss-manuell-36c` (2026-11-08, ikke merget)

Kenneth: «Den åpner samme skjerm som «Start dag», bare uten GPS.» Prosjektkortet er primærenheten: P1 og P4 oppretter aldri en ny dagsseddel når datoen alt har en.

- **Inngangene:** «+» på timer-lista (`DagsseddelListe.onPluss`) i prosjektkort-modus sjekker ansatt-status (`utils/ansattSjekk.ts`, delt med `NyTimerRadFlyt`) og åpner `/timer/bekreft-dag?opprinnelse=manuell&dato=<i dag>`. Dagskort-modus beholder timer-raden (`NyTimerRadFlyt`). «+ Nytt prosjektkort» på samlesiden (`app/timer/[id]/prosjektkort.tsx`) sender sedelens dato med `laastDato=1`; prosjektvelgeren og `KortValgModal` modus `ny` brukes ikke lenger derfra (komponenten og `kortValgTrengs` står, ubrukt fra P4); prosjekt, byggeplass og underprosjekt velges i Bekreft dag.
- **Manuell modus** (`app/timer/bekreft-dag.tsx`, `opprinnelse=manuell`): ingen arbeidsdag og ingen GPS. Tittel «Nytt prosjektkort» (`timer.bekreftDag.manuell.tittel`). Datofeltet (`DatoVelgerFelt`) har dagens dato forhåndsvalgt og kan byttes; det skjules ved `laastDato`. Lese-fasen er `forberedManuellDag` (`utils/manuellDag.ts`): tidsrom = seneste `tilTid` på datoens sedel (ellers firmaets starttid) til firmaets sluttid (er den passert: +1 t, kappet ved 23:59); pause = firmaets standard bare når sedelen ikke bærer matpause fra før. Bekreft skriver via samme `bekreftDag` med `arbeidsdagId: null`, så ingen arbeidsdag markeres avsluttet. Fra P4 går skjermen tilbake (`router.back()`) etter lagring. Ikke ansatt / tomt forslag gir bare [Ikke nå]; manuell modus har ingen [Avslutt dag]. **Norm (funn 3, telefontest 13.11, 🟡 `fix/timer-telefontest-1311`, ikke merget):** manuell modus har ingen `forberedSluttDag` foran seg og leste før bare svar-cachen; uten svar for datoen ble `normStatus` «cachet» og Alerten «Norm fra siste kjente svar» kom selv med nett. Skjermen henter nå svaret for valgt dato (`hentOgCacheArbeidstidSvar` i en effekt på `manuell`/`orgId`/`manuellDato`, `bekreft-dag.tsx`) og regner forslaget på nytt når det er lagret (`normNonce` i `beregnet`-deps, samme mønster som dagskortet). Offline: henting feiler, cachen står, varselet vises som før. Trykkes Bekreft før svaret er kommet, gjelder fortsatt cachen. Vakter i `telefontest1311.test.ts`.
- **Åpen arbeidsdag (S3):** «+» bruker manuell modus også når dagen står åpen. Målt: etter manuelt kort 07–15 gir «Slutt dag» kl. 16 ingen arbeidsrad — GPS-vinduet 07–16 viker helt for den manuelle raden (eksisterende 1b-regel, `vekForOverlapp`). Ingen dobbeltføring; 15–16 foreslås heller ikke.
- **Underprosjekt (rettelse S2, Kenneth 2026-11-08):** manuell modus viser «Underprosjekt» som chips under byggeplass når prosjektet har aktive underprosjekter (K3-regelen, til firmavalget i 36d-2). Valget er valgfritt: tomt ved åpning, forhåndsvelges aldri (heller ikke med ett underprosjekt), nytt trykk på valgt chip tømmer, ingen sperre. Prosjektbytte tømmer valget. Valgt underprosjekt sendes som `ecoId` til `bekreftDag` → `anvendDagsforslag` og lagres på arbeidsrader, maskin og varer (`externalCostObjectId`); tomt = null. Kortet blir da prosjekt + byggeplass + underprosjekt, samme regel som 36b. GPS-veien («Slutt dag») sender ingen `ecoId` og er uendret. «Hva gjorde du i dag?» er fortsatt ett felt pr. prosjekt/byggeplass (`beskrivelseKort.ts` regner uten underprosjekt).
- **Reise i dag-seksjonen:** ny reiserad får pause 0 og ingen sluttid (`utils/nyRadTider.ts`, brukt av `TimerSeksjon` via `erReiseRad`).
- **RETUR 36c (Kenneths telefontest, 🟡 `fix/36c-retur`, ikke merget):**
  1. *Byggeplass i skrivestien:* `anvendDagsforslag` skriver kortets byggeplass eksplisitt på arbeidsrader og maskin (`sedelByggeplass`, `eksplisittByggeplassId`) **bare** når sedelen fantes fra før og bærer en annen byggeplass enn dagen (`d.byggeplassId`). Ny sedel eller lik byggeplass → arv (null) som før. Reiserader beholder sin egen. Rettet både manuell modus og GPS-veien («Slutt dag» nr. 2 med B på sedel med A) — begge målt røde uten regelen. Varer var allerede riktige (`KortVareforbrukModal` sender `entydigByggeplass`). Funn, ikke rettet: «Uten byggeplass» på en sedel som har A kan ikke uttrykkes (null = arv).
  2. *Forslag-chips legger til:* trykk legger chipteksten til etter « · » (`utils/forslagVeksling.ts`); nytt trykk fjerner bare det segmentet. Skrevet tekst overskrives aldri.
  3. *Tastatur:* fokus på «Hva gjorde du i dag?» ruller feltet over tastaturet (`rullTilBeskrivelse` venter på `keyboardDidShow`). «Ferdig» lukker tastaturet: iOS i `InputAccessoryView` over tastaturet, Android som knapp under feltet mens tastaturet er oppe. Drag og trykk på tom flate lukker også. Gjenbruker `handling.ferdig`.
  4. *Reisemelding:* «reise mangler»-årsaken vises ikke i manuell modus.
- **RETUR 36c-2 (🟡 `fix/36c-retur-2`, ikke merget):**
  1. *P1 (a2), «Uten byggeplass» uten migrering:* velges «Uten» på en sedel med byggeplass A i samme prosjekt, kaller `ProsjektkortDagsoversikt` `loftByggeplassArv` før raden lagres eller flyttes. I én transaksjon får arvende timer- og maskinrader (byggeplass NULL, samme prosjekt, ikke reise) A skrevet eksplisitt. Sedelens byggeplass settes til NULL og `pending`. Etterpå betyr NULL ekte «uten» for server, web og gamle klienter (`rad ?? sedel`). Varer har aldri arv på server og røres ikke. Kjente grenser (ikke rettet): velges senere byggeplass B på sedelen via «Endre byggeplass», arver «uten»-rader i B-s prosjekt B igjen (dagens atferd). Bekreft dag fikk løftesti i RETUR 36c-3 (under). Tester: `kortRadFlytt.test.ts` § P1 (løft, reise/annet prosjekt/egen byggeplass urørt, no-op, sannhetstabell, kildevakt); 4 mutanter røde.
  2. *Pkt 3:* tom Arbeid/Maskin-seksjon i en redigerbar sedel viser «+ Legg til arbeid»/«+ Legg til maskin» (`timer.prosjektkort.leggTilArbeid`/`leggTilMaskin`) i stedet for «–».
  3. *D4, tastatur i Bekreft dag:* beskrivelsesfeltet vokser til maks 140 pt og ruller internt. Skjermen ruller til selve feltet (`y + feltY - 16`) og ruller igjen når innholdet vokser. 120 pt luft under innholdet mens tastaturet er oppe, `keyboardDismissMode="none"`, «Ferdig» er en blå knapp i full bredde (44 pt) på iOS og Android. Kildevakter i `manuellDag.test.ts`.
- **RETUR 36c-3 (🟡 `fix/36c-retur-3`, ikke merget) — «Ingen byggeplass» fra Bekreft dag (Kontrollør 1b):** i manuell modus sender `bekreft-dag.tsx` `utenByggeplassValgt: manuell && retting.byggeplassId === null` (eksplisitt valg, ikke bare tomt felt) via `bekreftDag` til `anvendDagsforslag`. Finnes sedelen alt og har byggeplass A i kortets prosjekt (`trengerByggeplassLoft` mot `sedelKontekstLokalt`, A-s prosjekt fra `byggeplass_local`), kalles `loftByggeplassArv` før radene skrives: arvende timer- og maskinrader får A, hodet blir NULL + `pending`, og den nye raden blir NULL (ekte «uten»). Reise røres ikke. GPS-veien (uten flagg), ny sedel og annet prosjekt enn A er uendret. Kjent grense: løftet har egen transaksjon. `anvendDagsforslag` har ingen ytre transaksjon, så løft og rad-insert er to steg. Feiler insert etter løftet, er effektiv byggeplass for de gamle radene uendret (`rad ?? sedel` = A). Byggeplass som mangler i den lokale katalogen gir ingen løft, som i prosjektkort-stien. Tester: `manuellDag.test.ts` § RETUR 36c-3 (løft, reise urørt, GPS-vei, ny sedel, annet prosjekt, skjermflagg) og kildevakter K10 (fra PRESISERING TILLEGG, ORDRE 24: `byggeplassId={forste.byggeplassId}` — første arbeidsrads byggeplass) og K12/P12 («+ Legg til» bare når `redigerbar`).
- **Endre kort / Slett kort (36c-kort, 🟡 `feat/36c-kort`, ikke merget; Kenneth OK 2026-11-09: a ja, b ja foreløpig, c ja):** nederst på kortskjermen `app/timer/[id]/kort/[projectId].tsx`, bare når sedelen er utkast eller returnert (`erRedigerbar`) og kortet har innhold. «Endre kort» (nøytral) åpner `KortValgModal` modus `flytt` med `heleKortet` og flytter hele kortet (`flyttKort`); «Slett kort» (rød) bekrefter i `BekreftSlettModal` og sletter kortets rader (`slettKort`). Skriving i `prosjektkort/kortRadFlytt.ts`, rekkefølge: bruddsjekk (`girNyttBrudd`, maskin mot arbeid pr. prosjekt+underprosjekt — bare NYE brudd stopper) → server-varer (`vareforbruk.slett` for synkede varer) → én lokal transaksjon. Flytt har egen rekkefølge fra 36c-kort-3 (se under). Kortet = alle timer-/maskinrader og varer med samme kortnøkkel (arvende rader inkludert), koblet maskin følger raden. Slett gir tombstones med `serverVersjon` for synkede rader. Flytt: prosjektbytte nullstiller underprosjekt; finnes målkortet fra før, beholder kortet sin kort-id og står som eget kort ved siden av (ordre c, E1 2026-11-16: tidskollisjon gir samme sperre som lagring av en rad, `finnKortKollisjon`; merknaden `timer.kort.sammenslaa` er fjernet); flytt til «Uten byggeplass» løfter arven (`loftByggeplassArv`) før hovedtransaksjonen. Reise, tillegg og utlegg røres ikke. a) synkede varer krever nett — offline er knappen sperret med forklaring (`timer.kort.offlineSlett`/`offlineFlytt`); c) slettes siste kort, står sedelen igjen som tomt utkast. Serverfeil → ingen lokal skriving. Dagskortet `app/timer/[id].tsx` er urørt (vakt i `kortHele.test.ts`). Ingen migrering, ingen nye API-ruter. Grense: ved delvis serverfeil med flere varer beholder alt endrede varer sin lokale kopi til neste server-lesing. Tester: `kortHele.test.ts` (21, ekte sql.js); mutanter 14/14 røde (tombstone, nøkkel kun prosjekt, reise med, koblet maskin hoppet over ved slett/flytt, redigerbar-sperre, brudd fjernet/før=etter, lokal før server, «uten» uten løft, sammenslåing, offline-sperre, serverfeil). Under testing ble en feil i bruddsjekken funnet og rettet: «før» brukte målnøkkelen.
  - **RETUR 36c-kort-2 (🟡 `fix/36c-kort-2`, ikke merget; Kontrollør 5b):** faller nettet midt i vare-løkka, er vare 1 slettet på server mens den lokale kopien står igjen; neste forsøk fikk `NOT_FOUND` og kortet satt fast. Nå regnes `NOT_FOUND` fra `slettVare` som lyktes i `slettKort` (`erIkkeFunnet`, tRPC `data.code`); alle andre feil stopper fortsatt før lokal skriving. **Ikke i `flyttKort`** (RETUR 36c-kort-2b, Kontrollør): `vareforbruk.oppdater` gir også NOT_FOUND når målunderprosjektet er slettet (`validerEco`), så NOT_FOUND ved flytt stopper som `serverFeil` før lokal skriving. Feilteksten pr. utfall kommer fra `kortUtfallTekst` (ren funksjon) — «offline» gir `timer.kort.offlineSlett`/`offlineFlytt`, aldri et stille trykk; `visUtfall` på kortskjermen har ingen egne unntak. Tester: `kortHele.test.ts` (27); mutanter røde: NOT_FOUND fatal i slett, flytt svelger NOT_FOUND igjen (2b), flytt svelger all feil, annen feil = lyktes, all feil = lyktes, offline uten tekst, feil offline-tekst pr. handling, skjermen hopper over offline / tømmer teksten / bytter handling).
  - **36c-kort-3 (🟡 `fix/36c-kort-3`, ikke merget; PLAN alternativ 1 godkjent):** «Endre kort» til et nytt prosjekt med synkede varer ga BAD_REQUEST, fordi `vareforbruk.oppdater` krever at server-sedelen har en timer-rad på målprosjektet (RETUR 4-sjekken). `flyttKort` flytter derfor nå i denne rekkefølgen: bruddsjekk → én lokal transaksjon (timer, maskin, lokale varer; sedelen settes `pending` når kortet har synkede varer) → push av den ene sedelen (`pushSedel` fra `TimerSyncProvider`, venter på pågående sync og tar samme lås) → `vareforbruk.oppdater` pr. synket vare → lokal vareflytt først etter server-OK. Uten synkede varer pushes ingenting; sedelen synkes som før. Feiler pushen eller avviser serveren en vare, blir utfallet `delvis`: timene er flyttet, varene som ikke ble flyttet står igjen på fra-kortet, og brukeren blir stående der med `timer.kort.delvisFlyttet` (serverens grunn legges bak). Nytt «Endre kort» på fra-kortet flytter resten. `pushEnSedel` i `services/timerSync.ts` er en parameterisering av samme kropp som `syncTimer` (`kjorTimerSync` med `kunSedelId`): bare den sedelen pushes, og ingen pull. `syncTimer` sender `null` og oppfører seg som før. Endret atferd: serverfeil på en vare ved flytt gir nå `delvis` med timene flyttet (før: `serverFeil` uten lokal skriving). Grense: ved `delvis` midt i vare-løkka er de første varene flyttet både lokalt og på server. Tester: `kortHele.test.ts` (30) + `timerSync.test.ts` (3 nye, 29 i alt); mutanter 7/7 røde (varer før push, lokal vare før server-OK, push-feil = ok, `delvis` uten tekst i kode og i én språkfil, `syncTimer` filtrerer på sedel, `syncTimer` hopper over pull).
- Tester: `manuellDag.test.ts` (ekte SQLite: inn i eksisterende sedel, negativkontroll annen dato, sendt sedel blokkert, S3-måling med negativkontroll, underprosjekt lagret/tomt/skjult/aldri forhåndsvalgt, RETUR 36c byggeplass A+B/A+A/ny sedel/GPS-vei/reise, kildevakter), `forslagVeksling.test.ts`, `nyRadTider.test.ts`, vakt `dagskort-isolert-vakt.test.ts` § ORDRE 36c.

### Utkast for prosjektkort — 🟡 `feat/timer-prosjektkort-utkast` (2026-11-13, ikke merget)

Plan: `relay/inbox-orkestrator.md` «PLAN — Utkast for prosjektkort», Kenneth-beslutninger 2026-11-13 (alle «som anbefalt»).

- **Modell:** et ikke bekreftet prosjektkort lagres lokalt i `prosjektkort_utkast_local` (se [mobil.md](mobil.md)). Utkastet lagrer **kun brukerens rettinger** (`UtkastData` i `apps/mobile/src/utils/prosjektkortUtkast.ts`: `retting`, `tilleggPerRad`, `lonnUtlegg`, `valgtByggeplassId`, `rettetSluttIso`, `sluttGodkjent`, `ecoId`). Forslaget beregnes på nytt ved gjenåpning og rettingene legges oppå.
- **Nøkkel og isolasjon:** `dato:YYYY-MM-DD` (manuelt kort) eller `dag:<arbeidsdagId>` (GPS). Unik pr. (bruker, firma, nøkkel). Alle lesefunksjoner (`finnUtkast`, `listUtkast`, `utkastDatoer`) krever `userId` + `orgId`. Utlogging sletter ikke utkast (som andre lokale timer-tabeller).
- **Tom delta = ingen rad:** `erTomtUtkast` — `lagreUtkast` sletter raden i stedet for å skrive når ingenting er rettet.
- **Datobytte:** `lagreUtkast(..., fraNokkel)` flytter raden i én transaksjon; et eksisterende utkast på måldatoen overskrives aldri (`"opptatt"`).
- **Forkast:** `forkastUtkast` sletter rad + kvitteringsbilder (`slettLokaltBilde`). `slettUtkastRad` sletter kun raden (brukes når køen eier filene).
- **GPS-utkast på avsluttet dag:** `ryddAvsluttedeGpsUtkast` — dag ikke `paagaar` og ingen tillegg/utlegg/maskin/varer → raden slettes; med slike linjer → flyttes til `dato:<dato>` uten GPS-tider (Kenneth-beslutning 3). Finnes et manuelt utkast på datoen, blir GPS-raden stående.
- **Ikke med:** synk mellom enheter, utløp, opprydding av foreldreløse kvitteringsfiler.
- **Bekreft dag (C2, `app/timer/bekreft-dag.tsx`):** nøkkel fra `dag:<arbeidsdagId>` eller `dato:<dato>`. Ved åpning leses utkastet (`finnUtkast`), rettingene legges på det nyberegnede forslaget, og skjermen viser «Fortsetter der du slapp (kl.)» øverst. Hver endring skriver etter 2 s (`endret()`); i tillegg skrives straks ved tilbake/sveip (`beforeRemove`), når appen går i bakgrunnen (`AppState` ≠ `active`), ved lukking og ved [Fortsett senere]. Selve gjenopprettingen merker ikke utkastet som endret. ecoId (underprosjekt) er med i utkastet og nullstilles bare når prosjektet faktisk byttes etter gjenoppretting.
- **Knapper:** sekundærknappen heter «Fortsett senere» (med hint «Lagres på telefonen. Lederen ser ingenting før du bekrefter.») når utkastet har innhold, ellers «Ikke nå». Rød [Forkast] nederst bekrefter i Alert og sletter rad + kvitteringer. «Lagret automatisk» i handlingsfeltet; `HjelpIkon` i toppen (`timer.bekreftDag.utkastHjelp*`).
- **Bekreft:** ventende skriving avbrytes og utkastet skrives én gang før `bekreftDag`. `bekreftDag(..., { utkastNokkel })` sletter utkastraden (`slettUtkastRad`) rett etter `anvend` når minst én sedel ble skrevet — ikke i samme transaksjon. Alle stopp (`manglerBeskrivelse`, `tilleggUtleggUtenDag`, sendt-race, `blokkertSendt`, `tilleggUtenRad`, maskinbrudd) lar utkastet stå urørt. Kvitteringsfilene eies da av køen og slettes ikke.
- **Avslutt uten timer:** har utkastet innhold, spør en modal først (`timer.utkast.avsluttUtenTimer*`, Kenneth-beslutning 2). `avsluttDagUtenSedel(..., utkast)` sletter utkastraden i samme transaksjon og returnerer utkastets kvitteringsstier, som skjermen sletter etterpå.
- **Datobytte i manuelt kort:** finnes et utkast på måldatoen, spør Alert `timer.utkast.finnesPaaDato` om å åpne det (skriver nåværende utkast først, `router.replace` til datoen). Ellers flyttes raden (`lagreUtkast` med `fraNokkel`).
- **Kvitteringer ved forlatelse:** ulagrede kvitteringer slettes som før, unntatt de utkastet eier (`finnUtkast(...).kvitteringer`).
- **Fjernet utlegg (RETUR avvik 10):** i Bekreft dag sletter fjerning av et utlegg ikke kvitteringsfila straks. `BekreftDagLonnUtlegg` kaller `onFjernKvittering(sti)`, skjermen legger stien i `fjernetKvitteringer`, og `skrivUtkastNaa` sletter den først etter at en utkastversjon uten utlegget er skrevet (`slettbareEtterSkriving`; ved `"opptatt"` slettes ingenting). Ved forlatelse slettes resten bare når siste utkast ikke eier dem; feiler den siste flushen, slettes ingen fjernede filer (forrige rad kan fortsatt eie dem). Uten callback sletter komponenten straks som før (dagskortet bruker den ikke).
- **Timer-lista (C3, `src/components/DagsseddelListe.tsx` + `src/utils/utkastListe.ts`):** ved fokus og etter synk kjører `lesUtkastForListe` — først `ryddAvsluttedeGpsUtkast` (filene den frigjør slettes), så `listUtkast` for valgt firma og hvilke arbeidsdager som pågår. `flettUtkastIListe` gir én rad pr. dato: har datoen en sedel, får sedelen merket «Ikke bekreftet» ved siden av statusen (trykk åpner sedelen som før); ellers en egen rad med 0 t og merket. Trykk på den åpner Bekreft dag manuelt på datoen, eller — når datoen har et GPS-utkast for en pågående arbeidsdag — GPS-skjermen via samme funksjon som «Slutt dag»: `forberedSluttDag` (`src/services/sluttDag.ts`) fanger slutt-GPS og henter fersk norm for start- og sluttdato før navigasjonen (RETUR avvik 12). Kalles fra både `StartSluttDagKort.utforSluttDag` og `DagsseddelListe.aapneUtkast` — ingen kopi. Dobbelttrykk sperres med ref. Utkast teller ikke i `usendteKladder` (leser bare sedler). Tester: `utkastListe.test.ts` (fletting, rydding, isolasjon, kildevakter L1–L4).
- **Ikke gjenopprettet:** `sluttGodkjent` — anslått slutt må godkjennes på nytt ved gjenåpning. Kjent kant: fjernes et utlegg og appen drepes innen 2 s, står utlegget med kvittering igjen i utkastet (fila er ikke slettet, så utkastet er helt).
- Tester: `migreringer.utkastLocal.test.ts` (T1), `prosjektkortUtkast.test.ts` (T2–T5, T8, T10, T12, GPS-rydding), `bekreftDagUtkast.test.ts` (T6 Bekreft sletter, T7 utkast urørt ved hvert stopp, T9 Avslutt uten timer, T11 gjenoppretting, V1–V6 kildevakter: `beforeRemove`, `AppState`, «Fortsett senere» skriver før `router.back`, utkast-eide kvitteringer spares, timer avbrytes før Bekreft, gjenoppretting kaller ikke `endret()`). `utkastRetur.test.ts` (V10 utsatt kvitteringssletting, V12 felles `forberedSluttDag`, 9 tester). Vaktene i `glemtDag.test.ts` (kvitteringsrydding, M9 nå med callback-grenen) og `manuellDag.test.ts` (ecoId-nullstilling) er oppdatert til den nye formen.

### Telefontest A/B — forsoning og kvittering — 🟡 `fix/timer-forsoning-ab` (2026-11-13, ikke merget)

Ordre fra orkestrator 2026-11-13 (Kenneth «Ja, alle fire»). Rotårsakene står i `relay/inbox-orkestrator.md` (SJEKKPUNKT 1 og 2, telefontest A).

- **Funn 1 — tillegg, utlegg og maskin etter forsoning:** tre veier i `syncBatch` svarer `conflict/overlapp`, og bare én av dem skriver noe. Tidlig V19-A-overlapp og A-1a (dagen ført på PC først) skriver ingenting fra pushen, heller ikke tillegg og utlegg. Avvik-veien (V19.9) skriver hode, uomstridte rader, tillegg og utlegg. Konfliktsvarets `serverData` har derfor fått `skrevet?: boolean` (`false` i de to første, `true` i avvik-veien, `dagsseddel.ts`). Mobil: konfliktgrenen i `timerSync.ts` lar `sistSynkronisert` stå når `skrevet === false`. `anvendForsonetLokalt` (`forsoningSpeil.ts`) sjekker før relinken om sedelen har tillegg-, utlegg- eller maskinlinjer, eller tombstones for dem, endret etter `sistSynkronisert` (`harUsendteLinjer`). Er det slik, settes sedelen til `pending`, og `bekreftConflict` beholder `pending`. Neste push sender linjene med kortet de har nå. Timer-radene har serverens versjon fra forsoningen og er uomstridte. Svarer en eldre API uten feltet, oppfører appen seg som før. **Avveining (Kenneth kjenner den):** tillegg og utlegg er ikke versjonert, så telefonens sett erstatter serverens på neste push. Tester: `timerSync.test.ts` (Telefontest A funn 1: tidlig overlapp og A-1a gir `pending`, og neste push bærer utlegg og tillegg på nytt kort; tombstone teller; negativkontroll for avvik-veien, sedel uten linjer og eldre API), `overlapp-pc-mobil.test.ts` og `v19-9-versjonssjekk.test.ts` (`skrevet` pr. vei; (b) push etter forsoning gir `ok` og skriver utlegget).
- **Funn 2 — kvitteringen står til serveren har bekreftet den:** rotårsaken var at køen merket kvitteringen `fullfort` og slettet lokalfila uten å vente på registreringen. Registreringen feilet stille med 404 når tillegg- eller utlegg-raden ikke var synket ennå. `registrerBildeIDatabase` (`services/bildeRegistrering.ts`) returnerer nå et utfall (`ok`, eller `nett`/`ikke_funnet`/`hard`/`ingen_token`). 404, 401, 408, 429 og 5xx er forbigående, øvrige 4xx er harde. Sjekkliste og oppgave ignorerer utfallet som før. Køens kvitteringsgren (`OpplastingsKoProvider.tsx`) lagrer server-URL-en på køraden og registrerer. Feiler registreringen, settes køraden tilbake til `venter`, og lokalfila og vedleggsraden røres ikke. **Unntak (gate 2026-11-13):** gir registreringen 404 og utlegg- eller tillegg-raden (eller sedelen dens) ikke lenger finnes lokalt, er raden slettet — typisk på web, og pull har fjernet den. Da er 404 permanent, og køraden og lokalfila ryddes som når lokalfila mangler (`kvitteringsForelderFinnes`, `OpplastingsKoProvider.tsx`). Finnes raden, prøves registreringen igjen som før. Neste forsøk registrerer bare, uten ny opplasting. Bare ved bekreftelse settes køraden `fullfort`. Vedleggsraden får da `serverUrl`, `registrert` og `lokalSti = null`, og fila slettes. Synken vekker køen når den har pushet rader (`lib/koTrigger.ts`, `varsleKoen`). Lokal kolonne `registrert` (INTEGER, nullable, ingen backfill) på `sheet_tillegg_vedlegg_local` og `sheet_utlegg_vedlegg_local` legges til via `VEDLEGG_REGISTRERT_KOLONNER` (`migreringer.ts`). Pull setter `registrert` for vedlegg serveren har. **Redning:** `reddUregistrerteKvitteringer` (`timerSync.ts`) kjøres etter pull i full sync. Den registrerer på nytt vedlegg som har `serverUrl` men ikke `registrert`, på sedler i `draft` eller `returned`, via den idempotente serverruta. Feil svelges. Visning: `vedleggKilde` (`lib/vedleggKilde.ts`) lar server-URL vinne over lokal sti i `UtleggSeksjon` og `TilleggSeksjon`. Ingen Prisma-endring. Kvitteringer som er tapt både lokalt og på serveren (4. og 5. november), kan ikke gjenskapes. **Restrisiko:** et eldre vedlegg med `registrert` null som ble slettet på web før appen ble oppdatert, kan komme tilbake én gang. Pull sletter ikke lokale vedlegg, og serveren gjør upsert, så redningen kan registrere det på nytt. Tester: `OpplastingsKoProvider.test.ts` (404 gir `venter` og fila står; `varsleKoen` gir ny registrering uten ny opplasting; hard 400 gir `feilet`; 404 når raden eller sedelen mangler lokalt rydder køraden og fila, med negativkontroll for en rad som finnes men ikke er pushet; for både utlegg og tillegg), `timerSync.test.ts` (Telefontest A funn 2: pull, redning, feil som svelges, negativkontroll for registrert, uten URL og sendt sedel), `migreringer.vedleggRegistrert.test.ts` og `vedleggKilde.test.ts`.
- **Funn 3 — kortoverskriften:** `utledKortByggeplass(rader, sedelByggeplassId, arv?)` (`packages/shared/src/utils/prosjektkort.ts`) tar valgfritt `arv: { projectId, byggeplassProsjekt }`. Med `arv` teller sedelens byggeplass for rader uten egen bare når den hører til kortets prosjekt. Ukjent byggeplass teller ikke. Det er samme regel som `radByggeplassLinje` (`apps/web/src/lib/timerByggeplass.ts`). Web-overskriften (`dashbord/timer/[id]/page.tsx`) og mobilens `KortHode` (via `byggeplassProsjekt` fra `byggeplass_local`, `kort/[projectId].tsx`) sender `arv`. Uten `arv` er oppførselen som før (`KortHode`-propen er valgfri). Tester: `prosjektkort.test.ts` (rød: arvet rad på kort B gir `ingen`; negativkontroll: samme prosjekt gir `en`), vakt i `dagsoversikt-kilde-vakt.test.ts`.
- **Funn 4 — «hele dagen»-markering:** `helhetsvalgNokler(slots)` og `aktivtHelhetsvalg(nokler, valg, standard)` (`packages/shared/src/utils/forsonValg.ts`) gir én regel for begge flater. Knappen er aktiv når alle valgbare slots har samme side, ellers er ingen aktiv. Web (`ForslagValgSeksjon.tsx`) viser aktiv knapp som `primary` med hake og `aria-pressed`. Mobil (`DagskortSammenligning.tsx`) viser fylt blå knapp med hake og `accessibilityState.selected`. **Funksjonsendring (hjemmel Kenneth 2026-11-13):** webens «Bruk mobilen» setter nå også `slettet_pc`-slots (tidligere bare slots med begge sider), likt mobilens «Velg appen». Dagskortet (`app/timer/[id].tsx`) er urørt. Tester: `forsonValg.test.ts` (rød: slettet_pc med i nøklene; negativkontroll), `helhetsvalg-markering-vakt.test.ts`.
- **Funn 5 — maskinlinjer følger raden som vant forsoningen:** `parForRelink` og `planleggLinjeRelink` (`packages/shared/src/utils/forsonRelink.ts`) parer forslag mot sedelrad med samme `parForslagMotSedel` som skjermen. Bare V19-A-overlapp-slots med ulike id-er gir relink; id-parede V19.9-grunner har samme id. `sheetTimerId` relinkes alltid. Prosjekt, byggeplass og underprosjekt overskrives bare når linjens verdi var lik forslagets, og raden som vant har en annen verdi. En linje som eksplisitt sto på noe annet, beholder sitt. Server: `forsonDagskort` leser parene før slettingen (`lesRelinkPar`) og oppdaterer `sheet_machine` i samme transaksjon (`utforLinjeRelink`, `dagsseddel.ts`). Attesterte maskinlinjer røres ikke. Svaret er fortsatt en array av rader, og hver rad har fått `relinketFra: string[]` (forslag-id-ene som ble slått inn i raden). Mobil: `anvendForsonetLokalt` (`forsoningSpeil.ts`) speiler relinken på `sheet_machine_local` ut fra `relinketFra`. Svarer en eldre API uten feltet, relinkes ingenting lokalt, og neste pull retter det. **Begrensning:** forsones konflikten på web, får telefonen ingen lokal relink før neste pull. Varer relinkes bare lokalt: serveren har ingen vare å relinke ved forsoningen, fordi mobilen sender en varelinje først når sedelen er `synced` (`vareforbrukSync.ts:53`). Serveren godtar dessuten bare en kobling til en rad som står på sedelen (`gyldigVareRad`, `vareforbruk.ts:72-84`). `anvendForsonetLokalt` relinker derfor ventende (`pending`) rader i `vareforbruk_local` med samme likhetsregel. En sendt vare eies av serveren og røres ikke. Tester: `forsonRelink.test.ts`, `forson-dagskort.test.ts` (🔴 funn 5, med negativkontroll for linje på annen rad, attestert linje og svar uten forslag) og `timerSync.test.ts` (Telefontest B funn 5, med negativkontroll for eldre API, vare på annen rad og sendt vare).
- **Punkt 6 — konflikt-teksten sier hva som allerede er lagret (Kenneth 2026-11-13, ordlyd godkjent):** innledningen på mobil (`timer.sammenlign.innledning`) og web (`timer.forslagValg.innledning`) sier nå at det bare én side endret, allerede er lagret, og at bare uenige tidsrom vises. Kolonnen heter «Står på dagskortet nå», og knappene heter «Behold dagskortet i alle tidsrom» / «Velg appen …» (mobil) / «Bruk mobilen …» (web). Web har fått `timer.forslagValg.bekreftHjelp` under Bekreft-knappen (`ForslagValgSeksjon.tsx`). Den vises ikke i lesevisning. Test: `forslag-valg-seksjon.test.tsx`, med negativkontroll for lesevisning.
- **Punkt 7 — «Endre mengde» og «Slett varen» i vare-arket (Kenneth 2026-11-13):** vare-arket i `ProsjektkortDagsoversikt.tsx` har fått to knapper for alle redigerbare varer, også de som er koblet til en rad. Knappene bruker de samme kallene som kortskjermen (`vareforbruk.oppdater` og `vareforbruk.slett`), og ventende `vareforbruk_local` endres eller slettes bare lokalt (`endreVareMengde`/`slettVarelinje` i `kortRadFlytt.ts`). En vare som finnes på serveren går først til serveren. Uten nett vises `timer.dagsoversikt.offlineVare`, og NOT_FOUND ved sletting regnes som allerede slettet. Sletting bekreftes i `BekreftSlettModal`. En låst vare får ingen knapper (`kanEndreVare`), altså en som er attestert, avvist eller ligger på en dag som ikke kan redigeres. For å vite om en vare er attestert sender `vareforbruk.hentMineForDato` nå `attestert: boolean`. Feltet utledes av `attestertSnapshot !== null`, og selve snapshotet sendes ikke. Feltet er bare lagt til, uten migrering. Begrensning: offline er `attestert` ukjent, så knappene vises, men serverkallet gir enten offline-teksten eller serverens FORBIDDEN. Tester: `kortRadFlytt.test.ts` (Punkt 7, med negativkontroll for låst vare, offline og serverfeil) og `vareforbruk-mine-for-dato.test.ts`.

### Plan A — konflikt løst på web, telefonen beholder usendte linjer — 🟡 `fix/timer-konflikt-web-usendte` (2026-11-13, ikke merget)

Hjemmel: Kenneth «Ja, plan A» 2026-11-13. Kun mobil; ingen server- eller Prisma-endring.

- **Problemet:** ved overlapp avviser serveren hele pushen (`skrevet: false`, `dagsseddel.ts`), så tillegg, utlegg og maskiner fra telefonen finnes bare lokalt. Løses konflikten på web (`forsonDagskort`), slipper neste pull konflikten (`overlappLostPaaPc`, `timerSync.ts`) og erstattet før alle lokale linjer med serverens. Usendte linjer forsvant stille, og ventende varer pekte på en telefonrad som ikke fantes («Uten rad»).
- **Lokal kolonne `paa_server`** (INTEGER, nullable, ingen backfill) på `sheet_machine_local`, `sheet_tillegg_local` og `sheet_utlegg_local`, lagt til via `PAA_SERVER_KOLONNER` (`migreringer.ts`). Sann når pull legger inn raden, og når en push som bar raden får svar `ok` (`anvendSvar`, bare linjer med `sistEndretLokalt ≤ byggetVed` — en linje skrevet mens pushen var i luften merkes ikke). Nye lokale linjer er null.
- **Pull med `overlappLostPaaPc`:** `taLokaltOyeblikksbilde` (`lib/konfliktWebUsendte.ts`) leser sedelens timerrader og linjer før slettingen. Etter at serverens rader er lagt inn, legger `leggTilbakeUsendteLinjer` tilbake linjer med `paa_server` ≠ sann som ikke finnes i serversvaret og ikke har levende tombstone. `paa_server` sann og mangler på serveren = slettet på web, legges ikke tilbake. Noe lagt tilbake → sedelen `pending`, og linjene sendes med neste push.
- **Ny kobling:** maskiner og ventende (`pending`) varer som peker på en telefonrad som ikke lenger står på sedelen, kobles til den ene serverraden med samme prosjekt og overlappende fra–til (`entydigKandidat`, via delt `planleggLinjeRelink` — samme likhetsregel som funn 5). Ingen eller flere kandidater → `sheetTimerId = null` («Uten rad»), som brukeren retter med Flytt eller Slett. Sendte varer røres ikke. Andre konfliktårsaker og overlapp som ikke er løst ennå, er uendret. Dagskortets visning (`[id].tsx`) er urørt.
- **Restrisiko:** linjer synket før appoppdateringen har `paa_server` null. Slettes en slik linje på web mens konflikten står åpen, kommer den tilbake én gang ved neste pull.
- Tester: `timerSync.konfliktWeb.test.ts` (🔴 usendt tillegg/utlegg/maskin står og sedelen er `pending`; 🔴 relink med én kandidat, «Uten rad» ved to og ingen; 🔴 push `ok` merker, linje skrevet under push merkes ikke; negativkontroller: `paa_server` sann slettet på web, levende tombstone, sendt vare, konfliktårsak `laast`, overlapp ikke løst) og `migreringer.paaServer.test.ts` (kolonne, ingen backfill, idempotent).

### Synlig konflikt i Timer-lista — 🟡 `fix/timer-til-ramme-konflikt` (2026-11-13, ikke merget)

Hjemmel: Kenneth, ordre «Bekreft dag Til/ramme + synlig konflikt» punkt 3. Kun mobil.

- **Problemet:** banneret sa «1 konflikt», men lista viste ingen konflikt-sedel. Visnings-dedupen (`dedupPerDato`) kollapset sedler med samme dato og skjulte en tom sedel, også når den hadde `syncStatus="conflict"`.
- **Dedup:** `dedupPerDato` (`apps/mobile/src/utils/dagsseddelListeVisning.ts`) skjuler aldri en konflikt-sedel. Den vises med den røde «Konflikt»-merkelappen (`TimerStatusMerkelapp`). Dedupen gjelder bare de andre sedlene samme dato. En tom plassholder ved siden av en konflikt skjules. Divergens-regelen (≥2 med innhold vises begge) er uendret.
- **Banneret:** trykk på konflikt-banneret (`TimerSyncStatusBar.tsx`) åpner konflikt-sedelen (`/timer/[id]`). Er det flere, åpnes den eldste (`velgEldsteKonflikt`, tidligste dato). Synk startes fortsatt ved hvert trykk (`haandterStatusbarTrykk`). Andre banner-tilstander åpner ingenting.
- **Tekst:** `timer.sync.konflikter_one`/`_other` med `count` («1 konflikt — sjekk sedelen» / «N konflikter — sjekk sedlene»).
- **Punkt 2 (ramme følger faktisk start/slutt) er ikke kodet:** sedel uten timerrader får alt rammen nullstilt i `finnEllerOpprettDagsseddel` (`dagsseddelOpprett.ts`, «36e pkt. 3»). Feltcaset 07:00–22:51 gikk derfor gjennom utvid-veien (`utvidArbeidstidsvindu`, `dagsforslagAnvend.ts`) med rader på sedelen — meldt orkestrator.
- **Punkt 1 (Til = faktisk slutt) er ikke kodet:** venter på Kenneths valg (bryter invarianten `timer = effektiveTimerFraSpenn(fra, til, …)`).
- Tester: `dagsseddelListeVisning.test.ts` (🔴 tom konflikt ved sedel med innhold vises; 🔴 konflikt ved tom plassholder; 🔴 eldste konflikt velges; 🔴 banner åpner og synker; vakter: plassholder skjules uten konflikt, divergens, ingen navigering utenfor konflikt). Mutanter: konflikt-filter fjernet → 2 røde; åpning fjernet → 1 rød; nyeste i stedet for eldste → 1 rød.

### Firmafilter på mobil + firmahull på server — 🟡 `fix/timer-firmafilter` (2026-11-15, ikke merget)

Hjemmel: POST + RETUR 2026-11-15 (14). Kenneth: en bruker er ansatt i ett firma og skal ikke kunne åpne dagssedler i andre firmaer. `@@unique([userId, dato])` står; ingen skjemaendring, ingen ny tekst.

- **Timer-lista, ukesummen og statusbaren** leser fra `src/services/timerListeLokal.ts` (`lesDagssedlerLokalt`, `lesUkeTotalLokalt`, `finnEldsteKonfliktSedelId`). Alle filtrerer på `organizationId = valgtFirmaId`. Uten valgt firma vises ingenting. I et firma der brukeren ikke er ansatt, er lista tom, så en sedel fra et annet firma kan ikke åpnes derfra.
- **Konflikt- og avvist-tellere:** `tellConflict`/`tellAvvist(userId, orgId?)` (`timerSync.ts`) tar firma. Statusbaren og Mer-fanen bruker `useFirmaSyncTellere` (`src/hooks/useFirmaSyncTellere.ts`), fordi `TimerSyncProvider` ligger utenfor `FirmaProvider`. `tellPending` er bevisst firma-bred, fordi pushen sender alle firmaer.
- **Push gruppert pr. firma:** `delPendingIBatcher` deler ventende sedler pr. `organizationId`, deretter i biter på maks. Hver `syncBatch` får sitt eget firma.
- **Ansatt-sperre på alle innganger:** `sjekkAnsattForNyRegistrering` (`src/utils/ansattSjekk.ts`, tekst `timer.ikkeAnsatt`) i «+» i prosjektkort-modus (`DagsseddelListe.onPluss`), «+» i dagskort-modus og Start/Slutt-kortets nye rad (`NyTimerRadFlyt`), og Start dag (`useArbeidsdag.startDag`, før GPS). Bekreft dag stopper via `erAnsatt` i `anvendDagsforslag`. GPS-utkastet skrives bare i Bekreft dag.
- **Vakt i `finnEllerOpprettDagsseddel`** (`dagsseddelOpprett.ts`): oppslaget er på userId+dato. Finnes en sedel samme dato i et annet firma, kastes `SedelIAnnetFirmaFeil`, og ingen rad legges på den. En eldre sedel uten firma (`""`) slipper gjennom som før. Brukerstiene sjekker først (`finnSedelIAnnetFirma`): `lagreNyTimerRad` gir `grunn: "sedelIAnnetFirma"` og `bekreftDag` gir handling `sedelIAnnetFirma` før noe skrives (anvend er ikke én transaksjon over datoene). `NyTimerRadFlyt` og `bekreft-dag.tsx` viser `Alert` (`timer.sedelIAnnetFirma.*`) og fanger `SedelIAnnetFirmaFeil` som sikkerhetsnett (gate 34).
- **Server — aktiv ansettelse:** `opprett` og `syncBatch` krever aktiv ansettelse i firmaet via `resolverOrgForEgenTimeføring`. Rad-skriving (`tilfoyTimerRad` m.fl.) krever det via `hentEgenDagsseddel` (eier-stien, `krevAnsatt` er standard `true`). Begge fantes; nå er de testet på rutenivå. Admin-innsyn i andres sedler og attestering er uendret.
- **Server — firmahull:** `maskin.tilfoy` kaller `verifiserProsjekterTilhørerFirma`. Underprosjekt (ECO) valideres mot sedelens firma og radens prosjekt (`krevEcoerIProsjekt`) i `maskin.tilfoy`, `maskin.oppdater`, `tilfoyTimerRad` og `oppdaterTimerRad` (BAD_REQUEST; `oppdaterTimerRad` mot radens prosjekt, gate 34). I `syncBatch` vaskes fremmed ECO på timer- og maskinrader til null (`[timer_eco_grense]`-logg); sedelen avvises ikke.
- **Varsel når timer skjules for sitedoc_admin (TILLEGG (14), Kenneth: «for å se timer må du impersere en ansatt»):** er brukeren `sitedoc_admin` og ikke ansatt i valgt firma, viser den tomme lista en tekst i stedet for «Ingen dagssedler»: timer vises bare for ansatte, og en ansatts timer ses ved impersonering. Regelen ligger i `skalVarsleSkjulteTimer` (`packages/shared/src/utils/timerSkjultVarsel.ts`). Mobil (`DagsseddelListe`, rolle fra `bruker.hentMin`) viser veien på web med `timer.skjultForAdmin`; det finnes ingen knapp. Web «Mine timer» (`dashbord/timer/mine`, ansatt-status fra `kanFoereTimer`) viser `timer.mine.skjultForAdmin` med lenke til `/dashbord/admin/firmaer/{id}?fane=brukere`. Firmasiden åpner brukerfanen når `?fane=brukere` er satt. Ukjent rolle eller ansatt-status gir ingen varsel.
- **Ikke med (meldt):** `HjemTimerChip.lesDagensDagskort` filtrerer ikke på firma. `tilfoyTimerRad` og timerrad-oppdatering validerer ikke ECO mot firma/prosjekt.
- Tester: `timerListeLokal.test.ts` (liste, ukesum, statusbar, tellere pr. firma), `timerSync-firma-gruppering.test.ts` (iii), `ansattSjekk.test.ts` (ii-a: sjekken + koblingstest for alle innganger, negativkontroll), `dagsseddelOpprett.test.ts` (ii-c: vakten), `timer-firmahull.test.ts` (iv, v, ii-b: opprett/syncBatch/tilfoyTimerRad avviser ikke-ansatt; v gate 34: ECO fra annet firma/prosjekt i tilfoyTimerRad/oppdaterTimerRad), `nyTimerRad.test.ts` + `bekreftDag.test.ts` (gate 34: sedel i annet firma → ingenting skrives, kildevakt for UI-Alert). Mutanter: vakt fjernet, gate i opprett/syncBatch/eier-sti fjernet → røde.

### Bekreft dag — dobbel pause og avrunding av Fra/Til — 🟡 `fix/timer-bekreft-pause-avrunding` (2026-11-13, ikke merget)

Hjemmel: Kenneth 13.11 «rett dobbelpause, benytt fra til -> rund av til nærmeste 15 minutter -> la den ansatte korrigere», og ORDRE 13.11 «pausen trekkes etter 4 ARBEIDStimer». Mobil, web, server og delt kode; ingen Prisma-endring, ingen migrering, ingen ny API.

- **Dobbel pause:** `beregnDagsforslag` (`apps/mobile/src/utils/dagsforslag.ts`) avgjør pausen for hele dagen med samme regel som manuell føring: `dagPauseMinForNyttArbeid` (`packages/shared/src/utils/pauseBeregning.ts`), som `avgjorRadPauseMin` nå delegerer til. Dagsbrutto = radene som alt står på sedelen + økta > 5,5 t, og ingen eksisterende rad bærer pause → standardpausen; ellers 0. `lesEksisterendeSedel` (`dagsforslagInput.ts`) leser derfor `pauseMin` på radene. `fordelPause` har ikke lenger egen terskel-gate — den lå bare på økta. Midnatt-delt økt: radene på alle økt-datoene teller, pausen fordeles én gang.
- **Pausen trekkes etter 4 ARBEIDStimer (ORDRE 13.11, funksjonsendring i alle lag; Kenneth 13.11: «Morgen 07:00–10:00 og kveld 16:00–19:00 gir 0 pause og 3,0 t. -> dette kan ikke være rett -> dette er totalt 6 timer arbeid -> her er det krav om 0,5 timer pause» · «Ja, etter 4 arbeidstimer»):** ett regelsett i `packages/shared/src/utils/pauseBeregning.ts`, brukt av Bekreft dag (`dagsforslag.ts`), mobil `matpause.ts`/`TimerSeksjon.tsx`, web `timer/[id]/page.tsx`, server `dagsseddel.ts` og `overtidForslag.ts`. (1) Dagen får pause når arbeidet > 5,5 t (`dagPauseMinForNyttArbeid`). (2) Bæreren er raden (sortert på fra) der summert arbeid passerer firmaets `standardPauseEtterTimer`; `pauseFra` = det punktet (`pauseFraForRad`), klemt inn i raden så bæreren alltid har hele pausen (timer = spenn − pause). Et gap mellom rader er ingen pause. (3) Én pause pr. dag. (4) En lagret rad endres aldri — faller grensen i en lagret rad uten pause, får raden som lagres nå pausen (`avgjorRadPause`). Klokkevinduet (`pauseVinduForDag`) avgjør ikke lenger om en rad bærer; `krysserVindu` er fjernet fra synligheten. Grensen kommer fra svar-cachens `pauseEtterTimer` (server `hentEffektivArbeidstid`), ellers firmainnstillingen, og `DEFAULT_PAUSE_ETTER_TIMER` = 4 bare når begge mangler. **`fastStart`** (tolkning, meldt orkestrator): firmaets faste klokkeslett (starttid + grense, `fastPauseFraFor`) brukes når det faller inne i raden; ellers arbeidstimene. **Bekreft dag** regner grensen (4 arbeidstimer) på det RETTEDE arbeidsvinduet (uten reise-etapper); dagsbrutto mot 5,5-grensen tar med reisen igjen (ORDRE 14.11, under). **Server** (`vurderRadTimer`) godtar både den gamle vindu-formelen og den nye (pausen inne i raden), så lagrede, sendte og attesterte sedler får verken nye avvik eller kast; `fordelPauseVedSplitt` foretrekker delraden der timer = spenn − pause; auto-rad uten oppgitt pause bærer pausen når spennet rommer den. Manuell 08–12 gir nå 0 pause og 4,0 t (ORDRE 36e pkt. 4 endret). Ikke endret: maskin-dialogene (web `MaskinRadDialog`, mobil `MaskinSeksjon.tsx`) bruker fortsatt klokkevinduet — meldt som oppfølger.
- **Spennkrav for bæreren (VILKÅR 1, gate 14.11):** en rad bærer pausen bare når spennet er lengre enn `standardPauseMin` — i den delte regelen (`dagPauseMinForNyttArbeid`, brukt av `avgjorRadPause`) og når Bekreft dag velger bærer (`baererKanBaere` i `dagsforslag.ts`). Er raden for kort, får den pause 0 og fullt spenn (lagret 07:00–12:15 p0 + ny 13:00–13:20 → p0, 0,33 t; før: p30, 0 t og `kast`). Samme krav som serverens `stemmerNy` og mobilens `radKanBaerePause`. Dagen står da over 5,5 t uten bærer — hører til produktvalget under, ikke løst her.
- **Reise teller mot 5,5-grensen, pausen bæres av arbeid (ORDRE 14.11; Kenneth 14.11: «I utgangspunktet var den gamle koden rett»):** dagsbrutto = arbeid + ført reisetid. `dagPauseMinForNyttArbeid` (`packages/shared/src/utils/pauseBeregning.ts`) tar ny valgfri `nyReiseTimer` (teller bare mot terskelen; spennkravet gjelder arbeidet alene), og lagrede `erReise`-rader på sedelen teller i `bruttoAndre` som før. Bekreft dag (`beregnDagsforslag`, `apps/mobile/src/utils/dagsforslag.ts`) sender reisetid-etappene (`kjoretidMin` på ut/retur) som `nyReiseTimer`; arbeidstid-etapper ligger alt i arbeidsraden og telles ikke to ganger. `lesEksisterendeSedel` (`dagsforslagInput.ts`) leser `erReise`. Plasseringen er uendret 4 ARBEIDStimer: `pauseFraForRad` og Bekreft dags `passererGrensen` hopper over reise-rader (før talte en lagret reise-rad som arbeid der). Web `timer/[id]/page.tsx` og mobil `matpause.ts` sender `erReise` på radene. Serverens `vurderRadTimer` har ingen dagsterskel og er uendret. Eksempel: 06–07 reise + 07–12 arbeid + 12–13 retur → arbeidsraden bærer 30 min, 4,5 t. 1 t reise + 4,5 t arbeid = 5,5 t → ingen pause. Reise-rader uten fra/til telles ikke (som arbeidsrader uten tider). Tester: `dagsforslag.pause-reise.test.ts`, `pauseBeregning.test.ts` og `v20-pause-en-kilde.test.ts` § ORDRE 2026-11-14.
- **Forutsetning for pauseregelen (TILLEGG til ORDRE 13.11):** Kenneth 13.11: «en forutsetning i disse regler -> alle timer må føres inkl. lovpålagte pauser». Fra–Til føres med pausen innenfor spennet, og systemet trekker den fra. Gap mellom øktene er ikke ført tid og teller aldri som pause. Har dagen mer enn 5,5 t netto arbeid, skal pausen ligge inne i en ført rad (bæreren der summert arbeid passerer grensen). En dag over 5,5 t uten bærer er ugyldig. Lagring stoppes ikke; innsending gir et spørsmål (punktet under). Målingen 13.11 før spørsmålet: mobil `fjernMatpause` (`apps/mobile/app/timer/[id].tsx:734`, bekreft-modal) + `sendTilAttestering` (`[id].tsx:741`, sjekker bare at det finnes rader); web `toggleMatpause` (`apps/web/src/app/dashbord/timer/[id]/page.tsx:2731`) + `send.mutate` (`page.tsx:953`); server `vurderRadTimer` godtar p0 når timer = spenn (`apps/api/src/routes/timer/dagsseddel.ts:637`), og `send` (`dagsseddel.ts:3552`) har ingen dags-pausekontroll.
- **Spørsmål ved innsending av dag over 5,5 t uten pause — 🟡 `feat/timer-innsending-pausespørsmål` (2026-11-14, ikke merget).** Kenneth 14.11: «Skal en dag over 5,5 t uten pause stoppes ved innsending?» → «still spørsmål, aksepter ved bekreftelse», og «Firma velger b» (gjelder uansett `pauseReferanse`). Vilkår (`dagManglerPause`, `packages/shared/src/utils/pauseBeregning.ts`): dagsbrutto (`dagsBruttoTimer`, arbeid + reise, samme sum som `dagPauseMinForNyttArbeid`) > 5,5 t **og** ingen arbeidsrad (`erReise !== true`) har pause > 0. Da viser innsending en bekreftelsesmodal («Over 5,5 t uten pause», `timer.pauseSporsmaal.*`): «Send uten pause» sender som normalt, Avbryt sender ikke og endrer ingenting. Flyten er delt (`forsokInnsending` + `svarPaaPauseSporsmaal`). Innsendingsveier: mobil dagskort `sendTilAttestering` (`apps/mobile/app/timer/[id].tsx`), mobil prosjektkort `sendTilAttestering` (`useProsjektkortSedel.ts`, modal i `app/timer/[id]/prosjektkort.tsx`), web begge Send-knappene (`sendMedPauseSporsmaal`, `apps/web/src/app/dashbord/timer/[id]/page.tsx`). Modal: `BekreftSendUtenPauseModal.tsx` (mobil), `Modal` fra `@sitedoc/ui` (web). Lagring stoppes aldri; serveren (`send`) avviser ikke slike sedler; ingen ny status, ingen nye felt, intet skjema. Tester: `pauseBeregning.test.ts` § «dagManglerPause» og § «forsokInnsending».
- **Avrunding:** arbeidsstart og arbeidsslutt rundes hver for seg til `tidsrundingMinutter` (`rundTidspunktTilNarmeste`, `apps/mobile/src/utils/tidsrunding.ts`); `arbeidstimer` = rundet spenn − pause, så `rad.timer = effektiveTimerFraSpenn(fra, til, pauseFra, pauseMin)` holder. Den gamle avrundingen av varigheten (`rundTimerTilNarmeste`) er fjernet. Til kan havne frem i tid (22:53 → 23:00); den ansatte retter Fra/Til i Bekreft dag (`FraTilTidFelt`, timene regnes på nytt). En kant som berører en reise-etappe rundes ikke (reise-vinduet må møte arbeidet i endepunktet). Reisetid rundes ikke.
- Tester: `pauseBeregning.test.ts` § ORDRE 2026-11-13 (fasitene på `avgjorRadPause`/`pauseFraForRad`, `fastStart`); `v20-pause-en-kilde.test.ts` § ORDRE 2026-11-13 (fasit-radene gir verken kast eller avvik; gammel rad med delvis vindu-overlapp godtas fortsatt); `matpause.test.ts`; `dagsforslag.pause-avrunding.test.ts` (🔴 Kenneths fasit: morgenkort med pause + kveld 16:39–22:49 → 16:45–22:45 = 6,00 t, pause 0; morgen 3 t uten pause + kveld 6:10 → pause 30 i kvelden, 5,50 t; 🔴 morgen 07–10 + kveld 16–19 → kveld pause 30 fra 17:00, 2,5 t (dag 5,5 t); 07:00–13:10 → pause kl. 11:00; 3 t + 2 t → 0; firmagrense 2 t → pausen i morgenraden; svar-cachens grense vinner; lagret morgen 5 t p0 + kveld 2 t → pausen på kvelden; bare én pause pr. dag; serverens `vurderRadTimer` godtar radene (verken avvik eller kast); enkelt økt 6:10 → pause 30 + rundet spenn; midnatt → én pause; Fra/Til rundes hver for seg; invarianten på alle rader).

## Firma-isolasjon (sikkerhetslag) — ✅ IMPLEMENTERT Fase 1b

Timer er en **firmamodul**: data eies av firma + arbeider, med `projectId` som etikett på radene. Isolasjonen er på **organisasjon (firma)**, ikke prosjekt-medlemskap (jf. to-produkt-modellen i [terminologi.md § 0](terminologi.md) og OPPSUMMERING-timer-arkitektur § D/G1).

To skiller som ikke må blandes:
- **Sikkerhetslag (firma-grense, ufravikelig, server-side):** hvilke prosjekter en arbeiders timer-rad *kan* peke på.
- **Forretningslag (G1 firma-nivå-tilgang, policy):** hvilke prosjekter velgeren *tilbyr*. Harmonisering av medlemskaps-gaten (`verifiserProsjektmedlem` i `opprett`/`syncBatch`) → firma-nivå er **ikke** del av Fase 1b (BACKLOG).

### Firma-grense på rad-projectId

`SheetTimer.projectId` er en svak FK til `Project` i kjerne-DB. Felles helper i `tilgangskontroll.ts`:

**`verifiserProsjekterTilhørerFirma(projectIds, organizationId)`** — kaster `FORBIDDEN` hvis et projectId verken er **eid av** (`Project.primaryOrganizationId == orgId`) **eller koblet til** (`ProjectOrganization`) firmaet. Unionen dekker både underentreprenør (deltar via ProjectOrganization på annet firmas prosjekt) **og** eide prosjekter — inkludert **legacy eide** som mangler ProjectOrganization-rad (opprettet før auto-koblingen, jf. `admin.ts`-bugfix; verifisert mot test-DB 2026-06-08: én slik rad fantes, dekkes nå av eier-grenen).

Anvendt på alle fire rad-skrive-stiene i `dagsseddel.ts`:

| Sti | Før Fase 1b | Etter |
|-----|-------------|-------|
| `tilfoyTimerRad` | ingen prosjekt-firma-sjekk (hull) | helper på `input.projectId` |
| `syncBatch` (rad-nivå) | kun medlemskap på rad-IDer ≠ sedel-nivå; luke for re-sync av egen eksisterende sedel | helper på alle resolverte rad-projectIds (medlemskaps-løkka beholdt) |
| `redigerSedelRader` | inline ProjectOrganization-sjekk | refaktorert til helper (+ eier-gren) |
| `splittRad` | inline ProjectOrganization-sjekk | refaktorert til helper (+ eier-gren) |

### Firma-grense på attestering (H1) og tillegg/utlegg (H3) — 🟡 på `fix/firmagrense-attestering`, venter gate

Kenneth 2026-11-08: prosjektdokumentasjon og kontaktinfo deles mellom firmaene på et prosjekt; firmaets interne timer- og lønnsdata (timer, lønnsart, prissnapshot) deles ikke. Et firma B som deltar på firma A sitt prosjekt attesterer derfor sine egne sedler — A ser dem ikke.

**`krevAttesteringsrett(userId, rader)`** (`dagsseddel.ts:205`, firmaene beregnes i `attesteringsFirmaer` `:175`): for hver rad `{ organizationId (sedelens), projectId }` kreves én av
- `sitedoc_admin`;
- `firma_admin` i **sedelens** firma (ikke deaktivert) — trenger ikke være prosjektmedlem;
- aktiv ansatt i sedelens firma som også er aktivt prosjektmedlem med `role = "admin"` eller `kanAttestere`.

Ellers `FORBIDDEN` («Timer attesteres av firmaet den ansatte jobber for»). Et utvalg med én fremmed rad avvises i sin helhet.

| Endepunkt | Vakt |
|---|---|
| ~~`hentTilAttestering`~~ (fjernet i w10b, § 4.10 DK7) | Firmagrensen bæres av `hentTilAttesteringFirma` (where `organizationId` = firmaet, omfang fra `attesteringsOmfang`); ansattnummer hentes fra sedelens firma. Test: `firmagrense-attestering.test.ts` |
| `hentTilAttesteringFirma` (`:3605`) | where `organizationId = input.organizationId` (B sine sedler på A-prosjekt vises hos B, ikke hos A) |
| `hentForAttestering` (`:3878`) | `krevAttesteringsrett` |
| `flyttTimerRadEco` (`:4050`), `attesterRader` (`:4162`), `returnerRader` (`:4354`), `gjenaapneAttestering` (`:4461`), `attester` (`:5423`), `returner` (`:5586`) | `krevAttesteringsrett` (rad-nivå via `krevAttesteringsrettForRader`, som slår opp sedlenes firma) |

`kanAttestere` (UI-gaten) er uendret. **H3:** `tilfoyTilleggRad` (`:2964`) og `tilfoyUtleggRad` (`:3196`) kaller `verifiserProsjekterTilhørerFirma([input.projectId], sheet.organizationId)` som `tilfoyTimerRad` — medlemskap kreves ikke, som der. **Ansattnummer** i `rapport.ts:hentFirmaAnsatteMedTimer` hentes kun fra eget firma (`organizationId: orgId`); navn og e-post på fremmede ansatte vises fortsatt (kontaktinfo, H2 utgått). Test: `routes/timer/firmagrense-attestering.test.ts` (11 røde mot `47a0875e` + 6 mutant-tester fra RETUR 1, 4 negativkontroller/vakt grønne begge veier — 21 i alt).

### Firma-grense på firmaPeriodeRapport

`rapport.ts` (`firmaPeriodeRapport`) filtrerer nå dagssedler på **`dailySheet.organizationId == orgId`** i tillegg til prosjekt-tilhørighet. SHA/arbeidsgiver-modellen: hvert firma rapporterer **egne** timer, aldri prosjekteiers. Lukker cross-firma-lekkasje der en cross-org-invitert arbeiders sedel (annet org) med rad mot firmaets prosjekt tidligere dukket opp i rapporten — nå bevisst ekskludert.

> **Kjent asymmetri (BACKLOG, ikke 1b):** `rapport.ts` henter «firmaets prosjekter» via `primaryOrganizationId` (kun eide), mens rad-grensen tillater deltatte (ProjectOrganization). En underentreprenørs egne timer på et deltatt-men-ikke-eid prosjekt vises derfor ikke i firmaets periode-rapport. Under-rapportering, ikke lekkasje — eget oppfølgings-punkt.

### PDF-eksport (fase 1) — `pdfEksport` (2026-08-26)

«PDF (.pdf)» som tredje valg i eksport-menyen — dokumentet som sendes til en byggherre (Excel er arbeidsfila). **Ny mal på eksisterende motor:** `rapport.ts:pdfEksport` bygger dokument-HTML (`byggTimerRapportHtml` i `@sitedoc/pdf/timer-rapport.ts`) og POSTer til den **interne pdf-render-containeren** (`PDF_URL`, `POST /pdf`, Playwright `page.pdf`) via `services/pdf-render-klient.ts` — samme motor som arkiv.rendr. **Ingen ny PDF-kapabilitet.** 🔴 Klient-generert HTML sendes ALDRI dit (SSRF — Chromium ville hentet eksterne URL-er); serveren eier innholdet.

**Data-gjenbruk:** `pdfEksport` kaller `firmaPeriodeRapport` (aggregat, `kunEksporterbare:true`) + `detaljEksport` (detalj) via `createCaller` — ingen fjerde data-vei som kan drive fra hverandre (createCaller brukes ellers kun i tester her; valgt fremfor å rive opp to lønns-kritiske prosedyrer i en blokk-flytting — samme no-drift-mål). **Server-i18n finnes ikke:** klienten sender oversatte overskrifter/filnavn inn (`tekster` + footer-strenger, `firma.timer.rapport.pdf.*` × 14 språk) — samme mønster som arkiv (`generertTekst`). typecheck binder `byggPdfTekster` (klient) til `teksterSchema` (server) → manglende nøkkel fanges.

**Dokumentet (fase 2-form):** firmatopp (firmanavn · periode · aktive filtre prosjekt/ansatt) → Sammendrag → **Detaljer** (ett kronologisk avsnitt med Type-kolonne, se fase 2 under). Footer hver side: generert-stempel + Chromium-injiserte sidetall. **ID-kolonnene er BEVISST utelatt** (koblingsnøkler for DB, ikke lesestoff — de blir i Excel). Totaler = samme kilde som Excel → stemmer per konstruksjon. **Ikke i fase 2** (fabels notat, fase 3): lagrede utskriftsmaler, firma/personlig-nivå, gruppering/kolonnevalg — modalen fra fase 2 ER redigereren, den får bare lagringsknapper. De to aggregat-pivotene («Etter prosjekt»/«Etter dag») utelates i PDF: et dokument svarer på HVA som skjedde, ikke HVORDAN man vil skjære dataene (Kenneth-vedtak).

### Fase 2 — Type-kolonne + radvalg (2026-08-27) — `feat/eksport-fase2-radvalg`

**Type-kolonne, ett kronologisk «Detaljer»-ark.** De tre detaljarkene (Timerader/Tillegg/Utlegg) er slått sammen til ÉTT kronologisk ark (dato asc) med en **Type**-kolonne (Timer · Maskin · Tillegg · Utlegg) — Kenneth: «tillegg og utlegg må kunne bli rad i timerader sammen med timeoversikt». Maskin beholder nøstingen under sin timerad (`sheetTimerId`). Fabels innvending mot sammenslåing (ulik radform) faller bort: tomme type-fremmede celler er uproblematiske når Type-kolonnen sier hva raden er. Kolonneunion: `Dato · Ansatt · Ansattnr · Prosjekt · Type · Betegnelse · Aktivitet · Fra · Til · Timer · Maskintimer · Antall · Beløp · Mengde · Enhet · Beskrivelse · Status · Id` (Betegnelse = lønnsart/maskinnavn/tilleggsnavn/kategori; **Fra/Til** = per-rad klokkeslett HH:MM, kun timer-rader — lagt til 2026-08-27, se defektretting under Fase 3). **Fire** SUBTOTAL-kontrollsummer nå (Timer/Maskintimer/Antall/Beløp) — ikke én generisk «antall»-kolonne (kan ikke summere timer og kroner sammen; ordren gjør summene *viktigere*). Timer-summen stemmer mot Sammendrag når Timer-rader er med.

**Radvalg — én sannhet, to renderere.** Radsettet + rekkefølgen bygges av `@sitedoc/shared` `byggDetaljRader(detalj, valgteRadTyper)` (`packages/shared/src/utils/timerDetaljRader.ts`, enhetstestet) — SAMME kilde for Excel (`timer-rapport-eksport.ts`) og PDF (api mapper radene til `packages/pdf/timer-rapport.ts`, som bevisst IKKE importerer shared — mottar rader som data). Så formatene kan aldri drive fra hverandre. Radvalget hukes av i **Tilpasset-modalen** (menypunkt «Tilpasset …», mockup 2b — kun Rader + Format-toggle Excel/PDF; ingen lagring, valget gjelder kun denne eksporten). Direkte CSV/Excel/PDF-knapper = alle fire typer (full). `pdfEksport` tar `radTyper` som input.

**Radvalget legger seg OPPÅ `skalEksporteres`.** `detaljEksport` filtrerer allerede bort `skalEksporteres=false` server-side; radvalget trekker bare fra (skjuler hele radtyper) — kan aldri huke PÅ en type oppsettet slo av. Den grå «utelatt i oppsett»-gjeninkluderingen er en egen, senere sak (ikke fase 3 — se designnotatet, fabels semantikk-vedtak). Maskin-håndtering i radvalget: «timer» valgt → nøstet maskin under sin timerad; «timer» avvalgt + «maskin» valgt → nøstet maskin blir egen normal rad (timeraden skjult av VALGET, ikke en anomali); løse maskiner (uten timerad / ikke-eksporterbar) vises kun når «maskin» er valgt, med sine merker.

**PDF dropper tomme kolonner** (Kenneth-refinement): 16 kolonner på A4 er uleselig — velger man bare Timer er Beløp/Antall/Maskintimer/Mengde/Enhet tomme hele veien, så de droppes. Excel beholder alle (bredde er gratis der). Identitets-/Type-kolonner droppes aldri; Id er aldri i PDF.

### Fase 3 — Lagrede utskriftsmaler (2026-08-27) — `feat/eksport-fase3-lagrede-maler`

**Ny tabell `EksportOppsett`** (`packages/db-timer`, postgres-schema `timer`, migrering `20260827120000_eksport_oppsett` — REN ADDITIV, én tabell, ingen DROP). Lagrer en **VISNING** (`config` Json = `{ radTyper, format }`, `configVersion=1`), IKKE dokumentstruktur — derfor egen liten tabell, ikke `ReportTemplate`/`OrganizationTemplate` (fabel-vedtak: ikke et tredje mal-begrep; designnotat rev 3). Svake String-FK-er uten `@relation` (A.20 cross-modul-mønster). **To nivåer via nullable `eierId`:** `null` = firmamal (alle i firmaet leser, kun firma-admin skriver), satt = personlig (kun eieren). **`basertPaId`** binder «Lagre som min» til firmamalen den ble kopiert fra; «SetNull ved sletting» håndheves i **slett-prosedyren** (nuller `basertPaId` på pekende kopier i samme transaksjon), IKKE av en Prisma-FK. Ingen sync — kopien er bevisst frossen.

**Router `timer.eksportOppsett`** (`apps/api/src/routes/timer/eksportOppsett.ts`): `list` (firmaets + kallerens egne personlige — aldri andres), `lagre` (nivaa firma/personlig; `basertPaId` verifiseres å peke på en firmamal i samme firma), `oppdater`, `slett`. Firmamal-skriving gates av `autoriserAdminForFirma` (leser `OrganizationMember.firmaRoller`, IKKE `User.role`); personlige rader er i tillegg eier-isolert (én firma-admin kan ikke røre en annens personlige mal). Hele rapport-flaten er firma-admin-gatet fra før.

**UI:** Tilpasset-modalen fra fase 2 ER redigereren — den fikk **navnefelt** + «Lagre» (oppdater åpen mal) + «Lagre som min» + «Lagre som firma» (sistnevnte kun for `kanAdministrereFirma`) + «Slett» (in-modal bekreftelse, ikke `confirm()`). «Eksporter uten å lagre» beholder fase-2-oppførselen. Eksport-menyen fikk en **maler-velger**: «Mine maler» · «Firmaets maler» · Innebygd **«Full eksport»** (åpner redigereren forhåndsutfylt — startpunkt for «Lagre som») · «＋ Ny utskriftsmal». Klikk på en mal-rad eksporterer direkte med malens config; «Rediger» åpner den. Direkte CSV/Excel/PDF-knapper er uendret — normaltilfellet (bruker som aldri lager en mal) er uberørt.

**«Løft personlig → firma» er KOPIERING** på klienten (åpne malen → «Lagre som firma»), ikke en egen server-vei — bevisst kontrast til `ReportTemplate`-promoteringen. **Innebygde maler er KODE, ikke DB-rader.**

🟡 **Fase 3 leverte KUN én innebygd (`Full eksport`).** De to andre formålene fabel designet — `Lønnsgrunnlag`/`Fakturagrunnlag` — skilles primært på **gruppering** (per ansatt / per prosjekt) + fakturatopptekst, en dimensjon config-formen (radTyper + format) ikke kan uttrykke. De venter på **grupperings-fase 4** (Kenneth-vedtak 2026-08-27). Se [printmotor-faser § Fase 4](delplaner/printmotor-faser-2026-08-25.md). Begrunnelsen: et filter kalt «Fakturagrunnlag» uten grupperingen lover et dokument (ut av huset, til byggherre) som innholdet ikke holder.

**Defektretting fra fase-2-output (2026-08-27, samme runde):**
1. **Status-verdiene oversettes.** Status-kolonnen viste rå DB-koder (`pending`/`sent`/…) uoversatt i BÅDE Excel og PDF — samme klasse som arknavnene som slapp unna `t()`. Løst med ÉN delt mapping (`STATUS_I18N` i `timer-rapport-eksport.ts`): Excel oversetter direkte via `statusEtikett(t, verdi)`; PDF får en ferdig-oversatt verdi→etikett-map via `byggStatusEtiketter(t)` injisert i `tekster.statusEtiketter` (api har ingen `t()`). To vokabular i samme kolonne: rad-status (`pending`/`attestert`/`returnert` → `timer.attestering.radStatus.*`) og sedel-status for utlegg (`draft`/`sent`/`returned`/`accepted` → `timer.statusType.*`). Ukjent/ny verdi → rå streng (skjuler aldri en verdi vi ikke kjenner). Ingen nye i18n-nøkler — gjenbruker eksisterende.
2. **Klokkeslett (Fra/Til).** `SheetTimer.fraTid`/`tilTid` ("HH:MM") tas nå med — Kenneth savnet dem i BÅDE intern- og byggherrerapport. Ført inn i `byggDetaljRader` (én kilde → begge formater), nye `Fra`/`Til`-kolonner (kun timer-rader har verdi; PDF dropper dem når tomme, Excel beholder). Nye nøkler `*.kolFra`/`*.kolTil` i begge namespace × 15 språk.

### Fase 4 — byggherredokumentet (2026-08-27) — `feat/eksport-fase4-byggherredokument`

Fase 4 gjør `EksportOppsett`-config-formen til **configVersion 2** — fire nye akser i `config` (JSONB, **ingen migrering**; v1-rader leses som `{mottaker:"intern", gruppering:"ingen", orientering:"auto", topptekst:null}` → ingen atferdsendring). Router `eksportOppsett` og `pdfEksport` stamper `configVersion:2` på skriv. Grunnlag: [designnotat-eksport-fase4-byggherre](../redesign/designnotat-eksport-fase4-byggherre-fabel-2026-08-27.md) + fem designlås i ordren.

- **`mottaker: "intern" | "ekstern"` — REGEL, ikke avhuking (designlås 1).** `ekstern` (ut av huset) fjerner **status STRUKTURELT** i begge flater OG i Sammendrag (Kladd/Sendt/Attestert er aggregert intern arbeidsflyt-status), og **ID** i Excel — kolonnene bygges ikke, kan ikke hukes på. Ingen overstyring. Redigereren viser noten «Ekstern — interne kolonner (status, ID) utelatt» på mottaker-kontrollen. Kontrollsummene (timesummer) berøres ikke. **Fase 6-oppdatering:** kolonnevelgeren håndhever nå regelen konkret — de interne kolonnene er ikke listet for en ekstern mal (`losTimerKolonner` filtrerer dem uansett strukturelt).
- **`gruppering: "ingen" | "ansatt" | "prosjekt"` (designlås 2).** Ren presentasjon: ny delt `grupperDetaljRader(rader, gruppering)` i `@sitedoc/shared` (enhetstestet) **pakker** `byggDetaljRader`-outputen — rører den ALDRI. Sortering + subtotal pr. gruppe + grand total. SAMME funksjon i Excel og PDF. Excel: gruppe-overskriftsrad + subtotal-rad (SUBTOTAL(109), som ignorerer nøstede SUBTOTAL-celler → ingen dobbelttelling) i **samme ark**, ikke ark-splitting. Nøstet maskin følger sin timerad (samme ansatt/prosjekt → samme bøtte, adjacent).
- **`orientering: "auto" | "staaende" | "liggende"`, default auto (designlås 3).** `auto` → liggende når beskrivelse-kolonnen faktisk er med i PDF (`flateRader.some(beskrivelse)`), ellers stående; eksplisitt valg låser. Avledes server-side i `pdfEksport`, sendes som `landscape` til pdf-render-containeren. **Skriftstørrelse er rendererens ansvar — aldri brukervalg.** 🔴 **Krever pdf-render-container rebygget** — `docker/pdf-render/server.mjs` fikk én valgfri `landscape`-param (default false → arkiv-PDF uendret). Containeren er **delt med prod** (`docker-compose.yml`; test bruker samme via `PDF_URL`), og bygges IKKE av vanlige `--no-deps` api/web-deploys → **eget, eksplisitt deploy-steg Kenneth gater**. Liggende virker ikke før den er kjørt.
- **`topptekst: { linjer: string[] } | null` (designlås 4).** Lagres på malen med flettefelt `{firma}`/`{periode}`/`{prosjekt}`, flettes **server-side** i `pdfEksport` fra rapportfilteret (én sannhet; appen spør aldri om noe den vet). Erstatter standard firmatopp i PDF når satt. Redigeres som flerlinjet tekst (én linje pr. rad).

**Innebygde maler etter fase 4** (KODE, ikke DB — `byggInnebygde(t)` i `page.tsx`): Full eksport (intern·ingen·xlsx) · **Lønnsgrunnlag** (intern·ansatt·xlsx) · **Fakturagrunnlag** (ekstern·prosjekt·liggende·pdf, topptekst `{firma}`/«Fakturagrunnlag»/`{periode}`/`{prosjekt}`). Alle tre er ett-klikk-eksport + «Rediger» i eksport-menyen — normaltilfellet uendret (0 nye interaksjoner). `Lønnsgrunnlag` aktiveres nå (grupperings-dimensjonen var det den ventet på i fase 3).

**Modalen (redigereren)** fikk segmentvalg for mottaker · gruppering · format (xlsx/pdf) og — kun når format=pdf — orientering (med auto-resultat-hint) + topptekst-felt. `format` (xlsx|pdf, filtype, v1) er URØRT; `orientering` er et EGET felt (navnekollisjon i designnotatet, ikke omdøping).

**Oppfølger (2026-08-27, `fix/eksport-ekstern-ansattnr-maskinmerke`)** — to lekkasjer Kenneth fanget i gate-PDF-en, begge samme klasse som status (intern info ut av huset):
1. **Ansattnr ut av eksterne dokumenter.** Ansattnr er pseudonymiseringsnøkkelen (peker inn i registeret) — `mottaker=ekstern` utelater den STRUKTURELT i Excel Detaljer + Sammendrag og PDF Detaljer + Sammendrag, som status/ID. 🔴 **Ansattnavn BLIR** (dokumentasjon av hvem som utførte arbeidet — poenget med et fakturagrunnlag).
2. **Maskin-anomali-merkene undertrykkes.** `utenTimerad`/`ikkeEksporterbar` er interne datakvalitets-signaler; ved ekstern vises kun maskinnavnet (merkelappen bort, RADEN blir). Nøstingsmerket «↳» beholdes. Både PDF (`betegnelseCelle`) og Excel (`betegnelse`). Intern uendret.

Regresjonstest `packages/pdf/src/timer-rapport.test.ts` låser intern-vs-ekstern (ansattnr/status/maskin-merke). **Sist brukte mal:** eksport-menyen merker sist eksporterte mal med «Sist brukt» (delt `useSistBrukteMal`-hook, localStorage per bruker, nøkkel `timereksport:${orgId}`) — MERKING, ikke omorganisering; ukjent id ignoreres stille. **Demo-seed:** `packages/db/scripts/seed-timer-demo.ts` fikk fra/til-klokkeslett på et par timerader (Ola/Per mandag) så eksport-gaten kan bekrefte Fra/Til-kolonnene (koden var riktig; Demo Bygg-dataene manglet tider). **Åpent (fabel eier, ikke bygd):** Sammendrag er per ansatt selv når malen grupperer på prosjekt.

### Fase 5 — detaljvisning på skjerm + modellskifte (2026-08-27, `feat/timer-rapport-detaljvisning`)

**Retningen (Kenneth 2026-08-27):** malen styrer **SKJERMEN**, eksporten skriver ut det som vises. Fase 1–4 ble bygget dokument-først (malen formet dokumentet ved eksport, skjermen forble tynn — aggregat per ansatt med ekspander). Det var feil retning: brukeren lagde et dokument han ikke hadde sett. Prosjektfilter-lekkasjen over viste hvorfor — sto radene på skjermen med prosjektkolonnen synlig, ville feilen vært åpenbar der den kan fanges.

**Detaljer-tabell** under Sammendraget på `/dashbord/firma/timer/rapport` (`apps/web/src/components/timer/TimerRapportDetaljer.tsx`) — **tredje konsument** av de delte `byggDetaljRader`/`grupperDetaljRader` (Excel og PDF er de to andre): `detaljEksport` (samme filtre som sammendraget) → `byggDetaljRader(detalj, radTyper)` → `grupperDetaljRader(rader, gruppering)` → `flatDetaljRader(grupper)` (ny delt helper: flater grupper til én indeksert liste `{kind: header|rad|subtotal|grandtotal}` for virtualiseringen). Kolonnerekkefølge + mottaker-regel (ekstern skjuler Ansattnr + Status, demper maskin-anomalimerker, beholder ↳) speiler PDF/Excel via de delte celle-hjelperne (`typeEtikett`/`betegnelse`/`kolTekst`, eksportert fra `timer-rapport-eksport.ts` — ikke en skjerm-kopi). Kolonnesettet løses av den delte `losTimerKolonner` (se Fase 6): malens `config.kolonner` ordrett, ellers dynamisk (tomme droppes som i PDF via `kolonnerMedInnhold`).

**Virtualisering (`@tanstack/react-virtual`, ny web-dep):** Kenneth-vedtak — **ingen terskel**. Et stort firma (100 ansatte) i inneværende måned er ~7 400 detaljrader (default-lasten, ikke ytterkanten); et egendefinert år-spenn titusener. Hele radsettet er i modellen, kun synlige rader rendres. **Synlig radtelling** over tabellen, aldri stille avkorting. `detaljEksport` hentes eagerly som query (var før kun ved eksport-klikk).

**Modellskiftet:** `radTyper` · `mottaker` · `gruppering` er nå **visningskontroller inline over tabellen** (gjenbruker `Segment`/checkbox), bundet til samme page-state eksporten leser. Å velge en mal (innebygd/lagret) **anvender** dens akser på skjermen (`settModalFraConfig`) i stedet for å ett-klikk-eksportere — malen er en visningskontroll, du ser dokumentet før du sender det. De direkte CSV/Excel/PDF-knappene eksporterer nå **skjermens gjeldende akser** (`skjermConfig`), ikke en full-default → ingen overraskelse mellom flate og fil. `format`/`orientering`/`topptekst` er fortsatt kun utskrift.

**Småsak samme runde:** malnavn i menyen bærer nå filtypen (`Full eksport (.xlsx)` · `Lønnsgrunnlag (.xlsx)` · `Fakturagrunnlag (.pdf)`, `medFiltype(navn, config.format)`) — gjelder innebygde og lagrede. **Gate:** filtrer på ett prosjekt → radene på skjermen = radene i PDF-en (antall · prosjekt · sum).

### Fase 6 — kolonnevelger + flateparitet (2026-09-01, `feat/kolonnevelger`)

**configVersion → 3.** `config.kolonner: string[]` (JSONB, **ingen migrering** — v1/v2-rader mangler feltet og leses som dagens dynamiske standardsett). **Rekkefølgen I arrayet ER kolonnerekkefølgen.** Kolonnevalget bor i malen fordi malen styrer skjermen og eksporten skriver ut det som vises. Zod-enum av de 17 kanoniske nøklene i `eksportOppsett.ts` + `pdfEksport`-input (`rapport.ts`).

**ÉN sannhet — `losTimerKolonner(rader, mottaker, valgteKolonner?)` i `@sitedoc/shared`** (`timerDetaljRader.ts`, ved siden av `TIMER_KOL_KEYS`/`TIMER_KOL_I18N`/`INTERNE_TIMER_KOLONNER`). Alle tre flater løser kolonnesettet gjennom samme funksjon: skjerm (`TimerRapportDetaljer`) og Excel (`timer-rapport-eksport.ts`) kaller den direkte; PDF (`packages/pdf`, importerer bevisst ikke shared) filtrerer/omordner sine `KolDef`-er på den samme nøkkellista via api-et. Resultat: fjerner du en kolonne i velgeren forsvinner den fra skjerm **og** PDF **og** Excel per konstruksjon (regresjonstest i `timerDetaljRader.test.ts`). **B1 (Kenneth 2026-09-01):** er `config.kolonner` satt vises de valgte kolonnene **ordrett — ingen drop-tom**; en kolonne brukeren eksplisitt valgte står selv om den er tom den dagen. Mangler feltet → dagens dynamiske sett (tomme droppes). **Unntak for PDF (Kenneth 2026-11-16, ORDRE (36)):** i PDF-en skjules en valgt kolonne som er tom for **alle** radene i utvalget; skjerm og Excel viser den fortsatt ordrett etter B1. Kodet i TILLEGG (36): `packages/pdf/src/timer-rapport.ts` `detaljerTabell` (`harVerdi`), test «tomme valgte kolonner skjules (TILLEGG 36)».

**🔴 Lukket flateparitet-funn:** «Excel viser alt, skjerm/PDF dropper tomme» var et **eksisterende** brudd på [flateparitet-vedtaket](retningslinjer/ui-standarder.md#-flateparitet--mal-ui-og-pdf-viser-det-samme-kenneth-vedtak-2026-09-01) — oppdaget, ikke oppstått, i denne runden. Med `config.kolonner` satt konvergerer alle tre. Legacy-stien (uten feltet) er bevisst urørt (B1 «uendret atferd»), så den divergensen består kun for maler som aldri har rørt velgeren.

**Ekstern vinner over valget (designlås 1, uendret):** `INTERNE_TIMER_KOLONNER = [ansattnr, status]` filtreres bort strukturelt i `losTimerKolonner` uansett brukervalg; i velgeren er de interne kolonnene ikke engang listet for en ekstern mal (ID er aldri valgbar/ i PDF). Personvern, ikke preferanse — kan ikke overstyres.

**Velger:** delt presentasjonskomponent `apps/web/src/components/ui/KolonneVelger.tsx` (web-only: dnd-kit + `@sitedoc/ui` er delt med mobil). Sorterbar-modus (drag-rekkefølge via `@dnd-kit/sortable`) slås på for timer; sjekklister/oppgaver bruker samme komponent **uten** sortering (migrert fra to inline-kopier i egen commit). **Innebygde maler** får eksplisitte kolonnesett i kode (Full/Lønn = alle; **Fakturagrunnlag = eget sett UTEN ansatt** — personen skal ofte ikke vises på faktura til byggherre, Kenneth 2026-09-01); velgeren redigerer kun egendefinerte maler, «rediger innebygd» → «lagre som». **Dato er alltid-på (låst); ansatt default-på men fjernbar.** Nye i18n-nøkler `firma.timer.rapport.tilpasset.kolonner`/`.kolonnerSok`/`.kolonnerHjelp` (13-språk-generert).

### Fase 6-oppfølger — Kenneths gate (2026-09-01, `feat/timerrapport-flate`)

Fire funn fra gaten på `feat/kolonnevelger` (ikke feil, men ting gaten avdekket):

- **Velgeren nåbar fra detalj-tabellen.** Kolonnevelgeren lå kun inne i mal-editoren («Eksporter → tilpasset»); Kenneth fant den ikke. Nå ligger den ALTSÅ i detalj-filterraden (samme rad som radtyper + Intern/Ekstern + gruppering), der brukeren SER tabellen. Begge innganger er samme delte `TimerKolonnePanel` (i `rapport/page.tsx`) som redigerer **samme `valgteKolonner`** (malens `config.kolonner`) — ingen ny tilstand, ingen andre-kilde. Uten aktiv mal lever endringene i sidens tilstand til man evt. «Lagrer som mal» (valg (a) — å kreve en mal for å skjule en kolonne er for høy terskel).
- **Kolonnebredder følger innholdstypen.** Ny delt kilde `TIMER_KOL_BREDDE` i `@sitedoc/shared` (`timerDetaljRader.ts`) med `min`/`vekt`/`excel` pr. kolonne — arvet av alle tre flater (flateparitet): skjerm-gridet bruker `minmax(min, vekt·fr)` (faste kolonner vekt 0), Excel leser `excel`-tegnbredden, PDF får `TIMER_KOL_BREDDE` ordrett fra api-et som data (`rapport.ts`, siden `packages/pdf` ikke importerer shared). **ORDRE (36), 2026-11-16:** PDF-tabellen bruker auto-layout. Korte kolonner (`vekt 0`: dato, klokkeslett, tall, type, enhet, status, ansattnr) har klassen `kort` (`white-space: nowrap`) og `<col style="width:1px">`, så de krymper til innholdet og aldri brytes. Tekstkolonner med innhold deler bredden i prosent etter `vekt` og brytes på ord (`overflow-wrap: anywhere` deler et ord bare når det ikke får plass). En valgt kolonne som er tom på alle rader vises ikke i PDF-en (TILLEGG (36), Kenneth 2026-11-16 — unntak fra flateparitet, se [ui-standarder.md](retningslinjer/ui-standarder.md)); skjerm og Excel viser den fortsatt (B1). Overskriften over en tallkolonne er høyrejustert som cellene (`<th class="num …">`; SVAR (72) A1, Kenneth 2026-11-16: godta). Er alle valgte tomme, vises valget som før, og en tom tekstkolonne får da ingen bredde (`timer-rapport.ts` `detaljerTabell`). Før fikk alle kolonner prosent av `min·(1+vekt)` med `table-layout: fixed`, og Dato fikk ca. 19 px på liggende A4. Beskrivelse/Betegnelse/Aktivitet er fritekst og deler ledig plass; datoer/koder/tall holdes smale. `truncate` er sikkerhetsnett, ikke normaltilstand.
- **Maskinlinja foldes inn på timeraden** når enheten er `"time"` — se [maskin.md § faktureringsenheten](maskin.md).
- **«Lagre som»-knappene forklarer seg** når de er avslått (navn tomt / ingen radtype), og «Eksporter uten å lagre» → **«Last ned PDF»/«Last ned Excel»** (mikrotekst-standard: si hva som skjer, ikke hva vi IKKE gjør). Nye nøkler `firma.timer.rapport.tilpasset.lastNedPdf`/`.lastNedExcel`/`.lagreKreverNavn`/`.lagreKreverRad`.

**Fence:** utskriftens header urørt; `losTimerKolonner` + `byggDetaljRader` forblir ÉN kilde (bredde- og sammenslåings-reglene bor i shared → arves av alle tre); ingen backfill av `sheetTimerId`; legacy-maler uten `config.kolonner` uendret.

### 🔴 Prosjektfilter på rad-nivå — bug-fiks (2026-08-27, `fix/rapport-prosjektfilter-radniva`)

**Feilen:** både `firmaPeriodeRapport` og `detaljEksport` valgte sedler med `where: { timer: { some: { projectId: { in: prosjektIder } } } }` (SEDLER som har ≥1 rad på prosjektet) og trakk deretter **alle** rader på de sedlene via `include` **uten** rad-filter. En dagsseddel med 6 t på Fjordgata + 3 t på Sentrumsparken dro med seg Sentrumsparken-radene når man filtrerte på Fjordgata → summen lekket på tvers av prosjekter, både på skjerm OG i eksport (et fakturagrunnlag dokumenterte arbeid på feil prosjekt, ut av huset). Eldre enn printmotoren; fase 4-grupperingen gjorde den synlig (andre prosjekt fikk egen gruppe + subtotal).

**Fiksen:** rad-nivå-filter i `include`-en på **alle fire** relasjonene (`SheetTimer`/`SheetTillegg`/`SheetMachine`/`SheetUtlegg` bærer alle `projectId` + indeks) i BEGGE spørringene. 🔴 **Kun når `input.prosjektId` er satt** (`radProsjektFilter = input.prosjektId ? { projectId } : {}`) — uten filter er `prosjektIder` hele firmaet, og kryss-prosjekt-rader kan bevisst peke på prosjekt UTENFOR firmaet (`detaljEksport` samler dem for navneoppslag); et ubetinget `in: prosjektIder` ville stille droppe dem. **Sedel-valget (`where`) er URØRT** — en sedel med én Fjordgata-rad teller fortsatt som én Fjordgata-sedel (`antallSedler`), men timesummen teller kun Fjordgata-radene. `statusFordeling` er per-sedel (uendret) — konsistent med `antallSedler` (= sedler som berører prosjektet), IKKE per rad; ikke misvisende lest slik, derfor bevisst ikke endret. Maskin-klassifiseringen (nøstet/uten-timerad/ikke-eksporterbar) degraderer grasiøst under filteret: hver gjenværende maskin-rad havner fortsatt i en bøtte, ingen lekker eller forsvinner.

### Detaljeksport (lønn/fakturering) — `detaljEksport` (2026-08-24)

`rapport.ts:detaljEksport` er en EGEN prosedyre ved siden av `firmaPeriodeRapport` (ikke ombygging — skjermrapport aggregerer med groupBy for rask visning, eksporten drar rå rader; én payload til begge ville gitt treg skjerm eller amputert eksport). Samme filtre (periode/prosjekt/ansatt), kalt **kun ved eksport-klikk** (`utils…fetch` i `rapport/page.tsx`). Inkluderer alle fire rad-typer med erstattet-filter (`timer`/`tillegg`/`maskiner` med `attestertStatus != "erstattet"`; `utlegg` har ingen status), lønnsart/aktivitet-navn per timerad (via `@relation`), kryss-prosjekt-navn og maskin-navn (`ctx.prismaMaskin`). Utlegg via `select` (beløp + kategorinavn + kommentar), **aldri vedlegg**.

**Aggregatet bruker samme erstattet-filter (ordre (32), 2026-11-16, branch `fix/rapport-erstattet-kladd`, 🟡 ikke merget):** `firmaPeriodeRapport` (timer/tillegg/maskiner), sedel-utvalget `sedelUtvalgRapport` og prosjektlista `hentFirmaProsjekterMedTimer` ekskluderer `attestertStatus = "erstattet"` (`IKKE_ERSTATTET` i `rapport.ts`), så skjerm, aggregat-ark og detalj summerer likt. Ingen kodesti skriver verdien i dag (rediger/splitt flytter originalen til `SheetRadHistorikk`), så filteret er et vern. `statusFordeling` mapper sedelstatus via `statusNokkel`: `draft` og `returned` → kladd, `sent` → sendt, ellers attestert (før: sammenlignet med `"kladd"`, som aldri forekommer, så kladd-sedler ble talt som attestert). Tester: `apps/api/src/routes/rapport-erstattet-kladd.integration.test.ts`.

`.xlsx`-arkstruktur (**4 ark fra fase 2**, var 6): aggregat-arkene **Sammendrag** · **Etter prosjekt** · **Etter dag** beholdes uendret (fjernes ikke på en slutning om at ingen bruker dem — stille bruddform), og de tre detalj-arkene er slått sammen til ÉTT **Detaljer**-ark med Type-kolonne (se Fase 2 over). Arknavn + alle kolonneoverskrifter går gjennom `t()` (i18n gjelder også ikke-JSX; `t` injiseres i `eksporterXlsx` fra `page.tsx`) — «Etter …», ikke «Per …» (grupperings-husstil, CLAUDE.md § Språk). Maskin nøstet under sin timerad via `sheetTimerId`; **maskintimer i egen kolonne** (aldri i Timer-kolonnen — attesteringsflaten summerer maskintimer separat), så arbeidstimer-kontrollsummen forblir ren. Detaljer-arket har **fire SUBTOTAL(109)-kontrollsummer** (Timer/Maskintimer/Antall/Beløp — levende formler som respekterer Excel-filtrering, så en Type-filtrert visning oppdaterer summen) — regnet fra RADENE, ikke serveraggregatet: avvik mot Sammendrag = kodeveiene har drevet fra hverandre, synlig i fila før lønnskjøringen. **Status-kolonnen** er nå ÉN kolonne som bærer `attestertStatus` per rad (timer/maskin/tillegg — lønn spør om RADEN er attestert; en sedel kan stå «sent» mens enkeltrader er returnert) eller sedel-status for utlegg (`SheetUtlegg` har ingen rad-status). **Verdiene oversettes** (rå DB-koder som `pending`/`sent` er ikke norsk) — se defektretting under Fase 3. CSV forblir sammendrag (ett flatt bord). Detalj-kolonnene er en **datadrevet liste** i `timer-rapport-eksport.ts` (Excel) / `byggDetaljRader` (kilde) — proadm-«underprosjekt» legges senere til som ÉN kolonne + ETT filter, uten ombygging. Siste kolonne på hver rad er en tynn **ID** (Excel-only koblingsnøkkel for den framtidige dimensjonen — aldri i PDF).

**`skalEksporteres`-filter (2026-08-25, fabel-vedtak):** en lønnsart/tilleggstype merket `skalEksporteres=false` (kunde-satt avkryssing «Skal eksporteres til lønn/regnskap») utelates fra ALLE eksporter — feltet ble tidligere aldri lest (kunden fjernet haken, raden eksporterte likevel → feil lønnsgrunnlag). Én regel, ingen formål-matrise (overstyring kommer senere som synlig Tilpasset-unntak). To steder, samme regel: (1) **detalj-arkene** — `detaljEksport` filtrerer på DB-nivå via relasjons-`where` (`timer.where.lonnsart.skalEksporteres=true`, `tillegg.where.tillegg.skalEksporteres=true`); (2) **aggregat-arkene** — `firmaPeriodeRapport` tar en valgfri `kunEksporterbare`-flagg som eksport-veien (`rapport/page.tsx håndterEksport`) setter til `true`, og som hopper over ikke-eksporterbare lønnsarter i **time-summene**. Sedeltellingen (`statusFordeling`/`antallSedler`) følger eksporttabellen fra ordre (37), se under. **Skjermen kaller uten flagget → viser alle timer** (attestering/oversikt trenger å se alt; ordren gjelder eksporter). **Maskin på ekskludert timerad:** maskin er ikke lønnsart-filtrert (fakturerbart), så den forsvinner ikke — men den havner IKKE under «Maskin uten timerad» (den bøtta betyr «maskin brukt uten registrert arbeid», et anomali-signal). Den får sin egen linje **«Maskin på ikke-eksporterbar timerad»** i Detaljer-arket (fase 2), og maskintimene teller fortsatt i maskintimer-summen. `detaljEksport` returnerer derfor tre maskin-bøtter: nøstet · uten timerad · på ikke-eksporterbar timerad. (Den nye linja går gjennom `t()` fra start — `timer.eksport.maskinIkkeEksporterbar`, 14 språk; de øvrige eksport-merkene/kolonneoverskriftene ryddes i kolonne-overskrift-batchen.)

✅ **Eksporten tar bare attesterte rader — Kenneth-vedtak 2026-11-16 (ordre (31), branch `feat/eksport-kun-attesterte`, 🟡 ikke merget).** Excel, CSV og PDF fra rapportsiden — lønn og fakturering, også byggherredokumentet (`pdfEksport` med `mottaker: "ekstern"`, samme datavei) — tar som standard bare attesterte rader. Utvalg pr. radtype (`apps/api/src/routes/timer/rapport.ts`, konstantene `RAD_ATTESTERT`/`SEDEL_ATTESTERT`): **timer, maskin og tillegg** = radens `attestertStatus = "attestert"`; **utlegg** har ingen egen status og følger sedelen: `DailySheet.status = "accepted"` (attestert sedel). Timeraden filtreres i kode (`eksporterbar` i `detaljEksport`), så en attestert maskin på en uattestert timerad står på linja «Maskin på ikke-eksporterbar timerad» — aldri i «uten timerad», aldri tapt. **Aggregat-arkene** (Sammendrag, Etter prosjekt, Etter dag, CSV) bruker samme utvalg: `firmaPeriodeRapport` med `kunEksporterbare` hopper over uattesterte timerader i time-summene; sedeltellingen følger eksporttabellen fra ordre (37), se neste avsnitt. **«Ta med uattesterte»** (`taMedUattesterte`, av som standard) står i eksportmenyen over CSV/Excel/PDF og i mal-redigereren (`rapport/page.tsx`), og lagres i utskriftsmalen (`eksportOppsett.ts` config v4, JSONB — ingen migrering; eldre maler leses som av). På = atferden før vedtaket. **Skjermen er uendret:** `firmaPeriodeRapport` uten eksportflagg og skjermens `detaljEksport`-kall (`taMedUattesterte: true`) viser alle rader. Tester: `apps/api/src/routes/eksport-kun-attesterte.integration.test.ts`. Bakgrunn: en dag over B10-taket kan ikke attesteres, men sto i eksporten som `pending` (Kort-id-b, ordre b3).

🟡 **Sammendraget teller dagssedler med rader i eksporttabellen — ordre (37) 2026-11-16 (branch `fix/rapport-sammendrag-sedler`, ikke merget; Kenneth: «ja, dagssedler med rader i tabellen», spec § 12.8.5).** På eksportveien (`firmaPeriodeRapport` med `kunEksporterbare`, brukt av PDF, Excel og CSV) teller «Sedler» og kladd/sendt/attestert bare sedler med minst én rad i eksporttabellen: `harRadIEksporttabellen` i `apps/api/src/routes/timer/rapport.ts` speiler utvalget i `detaljEksport` — en eksporterbar timerad, en maskinrad, et eksporterbart tillegg (rad-status som over) eller et utlegg (sedelen attestert). Med «Ta med uattesterte» teller alle sedler som har rader. **Skjermen** (uten flagget) teller alle sedler som før. `sistRegistrert` og ansattlinja i sammendraget er uendret, og radvalget i eksportmenyen (`radTyper`) påvirker ikke tellingen. Test: `apps/api/src/routes/rapport-sammendrag-sedler.integration.test.ts` (4 sedler → eksport 2, skjerm 4, «Ta med uattesterte» 4; tillegg alene teller).

🟡 **PDF-eksporten gir alltid et synlig utfall — ordre (34) 2026-11-16 (branch `fix/rapport-pdf-eksport`, ikke merget).** `pdfEksport` (`apps/api/src/routes/timer/rapport.ts`) svarer `{ tomtUtvalg: true }` uten å kalle pdf-render når radsettet etter utvalg og radvalg er tomt (typisk: ingen attesterte rader i perioden), ellers `{ tomtUtvalg: false, pdf, filnavn }`. Siden (`rapport/page.tsx`) viser da én av tre linjer over filterraden: grønn «Lastet ned: <filnavn>», gul melding om tomt utvalg (med råd om å attestere eller krysse av «Ta med uattesterte» når den er av), eller rød «PDF-en kunne ikke lages (…). Prøv igjen, eller eksporter som Excel.» Nedlastingen (`apps/web/src/lib/pdf-eksport-nedlasting.ts`) trekker blob-URL-en tilbake etter 30 s, ikke i samme tikk som klikket. CSV og Excel er uendret (feilbanner, ingen bekreftelse). **Merk:** en mal-rad i eksportmenyen (f.eks. «Fakturagrunnlag (.pdf)») eksporterer ikke — den legger malen på skjermen (modellskiftet over); filen kommer fra CSV/Excel/PDF-knappene. Tester: `apps/api/src/routes/pdf-eksport-utfall.integration.test.ts`, `apps/web/src/lib/__tests__/pdf-eksport-nedlasting.test.ts`.

## Byggeplass-geofence (GPS-deteksjon) — ✅ 1c-server + mobil L1 IMPLEMENTERT (🟡 enhet-test gjenstår)

Gir `Byggeplass` GPS-senter + radius så mobil kan identifisere **hvilken byggeplass** arbeider står på (utvider Fase 1 som kun identifiserte prosjekt/oppmøtested). Løser byggeplass-koordinat-gapet [`fase-0 T.8:990`](fase-0-beslutninger.md) — som også Fase 3 (kontor→byggeplass-reise) trenger.

> 🟢 **V17-A LEVERT (branch `feat/v17a-stedsmodell`, 2026-10-04 — venter gate/merge; hjemmel V17/K10,
> spec `v17-geofence-spec.md` v2.2):** stedsmodellen generalisert fra ren SIRKEL til **Sirkel | Polygon**.
> **Null atferdsendring for brukeren** (ingen sone-data finnes før V17-B/C; sirkler gjenkjennes nøyaktig som før).
> - `packages/shared/src/utils/sted.ts`: `Geofence = Sirkel | Polygon` (diskriminert union). Nye rene
>   geometrifunksjoner i ÉT lokalt plan (ingen pakke, ingen Node-import): `erInnenfor` (A1, sirkel = avstand ≤
>   radius, polygon = ray-casting, kant = innenfor), `polygonArealM2` (A2 shoelace), `sentroidePunkter` (B2),
>   `erEnkeltPolygon` (selvkryssing O(n²)), `korridorFraLinje` (B5 — bufrer kartlinje til korridor, avviser
>   skarp sving med navngitt feil). `gjenkjennSted` generalisert med **B4-prioritet** (sone før sirkel · sone
>   minst areal · sirkel nærmest sentrum); `Treff` bærer nå `form` + `omradeId`. `tilGeofencer` (A4) er ÉN
>   kilde som erstatter de tre `radiusM != null`-filtrene; `geofenceForm` (A5); `GEOFENCE_GRENSER` (A6).
> - **`Sirkel.form` er PÅKREVD** (`form: "sirkel"`, spec § 3) — kompilatoren vokter at ingen formløs kandidat
>   når `gjenkjennSted`. `sted.test.ts`-hjelperne `oppm`/`bygg` setter `form` eksplisitt. `GEOFENCE_GRENSER`
>   er eneste grense-kilde (det tidligere `RADIUS_GRENSER`-aliaset er fjernet). *(RETUR 1, kontrollør-gate 2026-10-04.)*
> - **API binder nå grensene:** `byggeplass.ts` + `oppmotested.ts` importerer `GEOFENCE_GRENSER` (tall uendret).
> - **Mobil:** `byggeplassKatalog.identifiserByggeplass`, `timer/ny.tsx` (nå `useGeoProsjektForslag`, ORDRE 17), `StartSluttDagKort.tsx` bygger
>   kandidater via `tilGeofencer` (byggeplass); `useArbeidsdag`/`StartSluttDagKort` oppmøtested forblir sirkel
>   (`tilGeofencer` med `soner: []`). Alle `radiusM != null`-byggeplassfiltre borte (grep-vakt). **Reload: OTA.**
> - **Ikke i V17-A:** db/api-feltene (`omrader.geo_polygon`), karttegning, mobil sone-cache = V17-B/C/D.

### Datamodell (kjerne `packages/db`)
`Byggeplass.latitude Float?`, `longitude Float?`, `radiusM Int?` — alle nullable, additivt (migrasjon `20260609100000_byggeplass_geofence_fase1c`, enkelt-steg). Ingen 4. flagg-kolonne: override beskyttes av «auto fyller kun når tom»-regelen under.

### Geofence-avledning
`beregnByggeplassGeofence(geoReference, bufferM=100)` (`packages/shared/src/utils/georeferanse.ts`): senter = tegningens midtpunkt (50,50 %) → GPS via `tegningTilGps`; radius = største avstand fra senter til de fire hjørnene (tegningsutstrekning) + 100 m buffer. Gjenbruker den eksisterende transformen, som kapsler UTM/NTM-projeksjonen via referansepunktene — ingen ny projeksjons-matte. Service `apps/api/src/services/byggeplassGeofence.ts` velger **nyeste georefererte tegning** (`createdAt desc`) på byggeplassen.

### Triggere (API)
- **Auto (fyller kun når tom):** `tegning.settGeoReferanse` kaller geofence-service med `kunHvisTom=true` når tegningen har `byggeplassId` → fyller geofence første gang en koblet tegning georefereres, **klobrer aldri** en satt/manuell verdi. Best-effort (feiler aldri georeferering-kallet).
- **Eksplisitt:** `bygning.beregnGeofence({byggeplassId})` — overskriver alltid fra nyeste georef-tegning. `BAD_REQUEST` hvis ingen georef-tegning / degenerert georeferanse.
- **Manuell override:** `bygning.settGeofence({byggeplassId, latitude, longitude, radiusM})` — null-verdier nullstiller.

### Web
Lokasjoner-siden (`oppsett/lokasjoner`), «endre navn»-modal: geofence-felt (lat/lng/radius) + «Beregn fra tegning» + «Lagre geofence». i18n `lokasjoner.geofence.*`.

### 1c-mobil — ✅ L1 implementert (2026-06-20, develop)
Mobil L1 (2026-06-20): GPS-identifikasjon av byggeplass ved «Start dag» — passiv dokumentasjon på `arbeidsdag_local.byggeplassId` (+ navn), org-scopet, speil av oppmøtested. `identifiserByggeplass` (`byggeplassKatalog.ts`, Haversine ≤ radiusM) kalt fra `StartSluttDagKort.tsx`. Server `bygning.hentForFirma` utvidet additivt med name + geofence; `byggeplass_local` cacher lat/lng/radiusM (idempotent ALTER, ingen Prisma-migrering). **Ingen atferdsendring i registrering** — aldri auto-rad (`T.8:983`), kun etikett/dokumentasjon. Gjenstår: funksjonell GPS-test på enhet (innenfor-radius-deteksjon, krever EAS test-bygg).

## Eksport til lønnssystem

Støtter flere systemer via adapter-mønster (samme prinsipp som `BilagsKilde` i økonomi-modulen):

| System | Status | Beskrivelse |
|--------|--------|-------------|
| **Tripletex** | Primær | Eksisterende integrasjon via OrganizationIntegration |
| **Visma** | Planlagt | Visma.net Payroll API |
| **Unit4** | Planlagt | Unit4 Business World |
| **SAP** | Planlagt | SAP SuccessFactors / HCM |
| **CSV/Excel** | Fallback | Alltid tilgjengelig, universell eksport |

### Adapter-interface

```typescript
interface LonnssystemAdapter {
  eksporter(dagssedler: Dagsseddel[]): Promise<EksportResultat>;
  eksporterUtlegg(utlegg: Utlegg[]): Promise<EksportResultat>;
  valider(): Promise<boolean>; // sjekk API-tilkobling
}
```

Konkret implementasjon per leverandør. Konfigureres via `OrganizationIntegration` (eksisterende tabell i `packages/db`). Per Kenneth-vedtak 2026-04-29 splittes `type`-feltet i to dimensjoner:

- `kategori String` — `"kilde"` | `"destinasjon"` | `"begge"`
- `leverandor String` — `"proadm"` | `"tripletex"` | `"poweroffice"` | `"visma"` | `"unit4"` | `"sap"` | `"hr"` | `"gps"` | `"smartdoc"`

Lønnssystem-eksport-adaptere bruker `kategori = "destinasjon"` med leverandør-spesifikk implementasjon. Eksisterende rader i prod migreres ved å kopiere `type` → `leverandor` og utlede `kategori` per leverandør (proadm/smartdoc = kilde, tripletex/poweroffice/visma/etc. = destinasjon, hr = begge, gps = kilde).

### Timer-eksport — kolonner

> ⚠️ **Utkast — blokkert på PowerOffice-spec (funn 2026-07-09).** Kolonnelista under er en foreslått spec, ikke bekreftet mot mottakersystemet, og **ikke implementert**. Dagens `apps/web/src/lib/timer-rapport-eksport.ts` er en **lederrapport** (kolonner `Ansatt`/`Ansattnr`/`Dato`/`Timer`, ingen `kode`-join), ikke et lønnsuttrekk. Grunnlaget finnes (`SheetTimer.lonnsartId` → `lonnsarter.kode`, `users.ansattnummer`, prissnapshot per rad) — det er *formatet* som mangler. Åpen post «Poweroffice-eksportformat — må bekreftes»: [smartdok-undersokelse-2026-04-25.md](smartdok-undersokelse-2026-04-25.md).

Mål-eksporten (utkast) joiner `sheet_timer`/`sheet_tillegg` med katalog-tabellene for å hente lønnsart-kode, navn og pris. Aldri slått sammen til faste kolonner — hver lønnsart-rad blir egen post i eksportfilen.

| Kolonne | Kilde |
|---------|-------|
| Dato | `daily_sheets.dato` |
| Ansatt | `userId` → `users.name` |
| Ansattnummer | `users.ansattnummer` (krevet for lønnseksport) |
| Prosjekt | `projectId` → `projects.name` |
| Aktivitet | `aktivitetId` → `aktiviteter.kode` |
| Avdeling | `avdelingId` → `avdelinger.kode` (valgfri) |
| Lønnsart-rader (med ECO per linje) | `sheet_timer` joinet med `lonnsarter` (`kode`, `navn`, `timer`, `attestertSnapshot.prisMotKunde`) + `externalCostObjectId` → `external_cost_objects.proAdmId` (valgfri per linje) |
| Tillegg-rader | `sheet_tillegg` joinet med `tillegg` (`kode`, `navn`, `antall`, `attestertSnapshot.prisMotKunde`) |

**Pris-snapshot (❌ IKKE i eksporten i dag — D3-retting LAG 2-C):** Tabellen over er *utkast*. Dagens eksport (`timer/rapport.ts` → `detaljEksport`, Excel `timer-rapport-eksport.ts`, PDF `packages/pdf/timer-rapport.ts`) bærer **ikke** `attestertSnapshot.prisMotKunde` — den leser lønnsart-**navn** (nå også `type`/`satsEnhet`, LAG 2-C D2), timer, fra/til, beskrivelse og reise-sporet, ingen pris. `attestertSnapshot` (Json med lønnsart/aktivitet/sats/overtidsgrunnlag) leses **kun** i `hentForAttestering` (`dagsseddel.ts:3239`) for attesterings-visningen, aldri i en eksportvei. Den planlagte lønnsuttrekk-eksporten (når adaptere bygges) *skal* fryse pris pr. rad (Fase 0 A.7) — men gjør det ikke i dag (M9, målt 2026-10-03).

**Eksport-kode-krav (planlagt, ikke bygget):** `lonnsarter.kode`/`tillegg.kode`/`aktiviteter.kode` er nullable. ⚠️ Doc-en beskriver *ønsket* atferd: eksport-modulen skal kaste tydelig feilmelding hvis kode mangler. **Eksport-modulen finnes ikke ennå** (adaptere «❌ Ikke startet»), og valideringen finnes ikke i noen kodevei i dag. Når den bygges bør sjekken skje ved **attestering**, ikke først ved lønnskjøring — se [BACKLOG § validering av `kode`](BACKLOG.md). Merk: `GRA`/`RYD`-aktivitetene er nå akseptert uten kode (SiteDoc-spesifikke) — aktivitet-kode-kravet må revideres når modulen bygges.

**Eksport-kode ved migrering:** Eksisterende koder fra kundens nåværende system (f.eks. SmartDok) kopieres direkte ved migrering — ingen renumerering. Hvis A.Markussen har lønnsart `127 Fakturerbar tid` og enhetstillegg `157 Kloakk tillegg`, beholdes nøyaktig samme koder i SiteDocs `lonnsarter.kode`/`tillegg.kode`. **Kodene kopieres 1:1 fordi de tilhører *kunden*, ikke kildesystemet** — bekreftet for A.Markussen (Florian, 2026-07-09: numrene er firmaets egne, båret av SmartDok i dag og matchet av PowerOffice). Dette er **ikke** en generell garanti om at ethvert lønns-/økonomisystem matcher uten rekonfigurasjon — hver ny kunde krever egen kartlegging. Migrerings-skript leser kundens eksisterende eksport-fil og kopierer kode-feltet 1:1.

**Prinsipp (låst): lønnsart-koder er per firma og settes ved onboarding eller import — aldri i seeden** (`@@unique([organizationId, kode])`; A.Markussens katalog er IKKE startpakke for nye kunder). Eksportformatet er `nr | lønnsart | timer`, og mottakersystemet (PowerOffice) matcher på `nr`, ikke på navnet.

> **📌 Mønster (funn 2026-07-09):** fire steder over — `③b`-fallback (§ Overtid-klassifisering), `Timer-eksport — kolonner`, `Eksport-kode-krav` og `Eksport-kode ved migrering` — beskrev ubygget eller uverifisert atferd i presens uten utkast-markør. Ved neste gjennomgang av fila: skill **spesifikasjon** fra **intensjon**.

**Filtrering per eksport-spor** (per [smartdok-undersokelse.md § 9](smartdok-undersokelse.md)):
- **Lønn:** Kun arbeidskraft (lønnsart + tillegg). Filtrer ut maskiner/materialer
- **ProAdm:** Inkluder alt — lønnsart + tillegg + maskiner + materialer
- **Regnskap:** Utenfor SiteDocs ansvar — håndteres av ProAdm

### Utlegg-eksport — separat fra timer

Aldri blandet i lønnsrader. Tripletex: utlegg som reiseregning/bilag, ikke som lønn.

| Kolonne | Kilde |
|---------|-------|
| Dato | `daily_sheets.dato` |
| Ansatt | `userId` → `users.name` |
| Kategori | `sheet_expenses.kategori` |
| Beløp | `sheet_expenses.belop` |
| Notat | `sheet_expenses.notat` |
| Kvittering | `sheet_expenses.bildeUrl` (lenke) |

## Utleggsregistrering

Del av dagsseddelen, ført etter **ordningsmodellen** (tre ordninger — se
[`sheet_utlegg`-blokken](#sheet_utlegg-utlegg-fakturert-rader-per-dagsseddel--🟢-u1-datamodell-migrering-20260808120000_utlegg_ordningsmodell)).
Feltarbeideren velger **kategori** («diesel»), aldri ordning — ordningen utledes
(`overstyring ?? firma-default` via delt `utledOrdning` i `@sitedoc/shared`) og
bestemmer feltene. Data-lag i `SheetUtlegg` (utlegg/fakturert) eller `SheetTillegg`
(lønnstillegg). Kvittering: server-lokal privat disk (`/uploads/privat/`, signatur-KUN),
**ikke** S3/Tripletex. Eksport er ikke bygget (U2 utsatt) — refusjonssporet går til
**regnskap** (PowerOffice/Visma), adskilt fra Proadm/lønn.

### 🟢 Modelljustering (2026-08-11, gate 1) — migrering `20260811130000_utlegg_ordning_justering`

Fabel/Kenneth landet domenet etter U4. Endringer i `@sitedoc/shared` + db-timer + web + mobil:

- **`sats` → `lonnstillegg`** (enum, CHECK, delt utledning, UI, i18n). «sats» var et
  **homonym**: lønnstillegg med fast sats (skifttillegg 30 %, `SheetTillegg`) vs. utlegg
  beregnet ETTER statens satser (kjøregodtgjørelse, `SheetUtlegg`). Det siste er IKKE en
  egen ordning — det er en `utlegg`-kategori merket `satsbasert`.
- **`fakturert` ikke lenger valgbar:** enum-verdien beholdes i skjema + CHECK for
  historikk-sikkerhet (0 rader), men `settOrdning`/`settOverstyring` avviser den
  (`SETTBAR_ORDNING_ENUM = {utlegg, lonnstillegg}`). Velger (web U3 + mobil U4) tilbyr
  den ikke. Gjeninnføres senere som `fakturavarsel` (opt-in, default av) når varselet er
  bygget — backlogget.
- **To nye markeringer på `ExpenseCategory`** (metadata — ENDRER IKKE bærer/ordning/eksport):
  `satsbasert` (styrer UI-satsfelt, senere; følger eksport) + `muligSkattepliktig`
  (firma-admin-flagg; SiteDoc registrerer grunnlag, aldri avgjørelse — skatteberegning ut
  av scope). Firma-admin toggler dem på `firma/timer/utleggskategorier` (`settMarkeringer`).
- **U5 upsert-test** (`expenseCategory.test.ts`): beviser at `settOverstyring` er ekte
  upsert (samme id via `update`, aldri delete+create) + at `fakturert` avvises på skriv.
- **Migrering** (gates av Kenneth): `UPDATE ordning='lonnstillegg' WHERE ordning='sats'`
  (expense_categories + prosjekt_ordning_overstyring; sheet_utlegg kan aldri ha `sats`) +
  drop/recreate 3 CHECK med `('lonnstillegg','utlegg','fakturert')` + 2 nye kolonner.

**🟡 Gate 2 (ikke bygget):** `refusjonsKontonummer` på kjerne-`OrganizationSetting`
(`packages/db`, der `reiseLonnsartId` bor) + firma-innstilling-UI. Følger refusjonseksporten.

### 🟢 U3 — web-registrering (2026-08-08)

**Flate:** `apps/web/src/app/dashbord/timer/[id]/page.tsx`.

- **`LeggTilVelger` (8a):** ÉN inngang «Legg til på dagsseddelen», to grupper —
  **Tillegg** (lønnstillegg-katalogen `Tillegg`, sats → `SheetTillegg`, uendret
  flyt) og **Utlegg** (`ExpenseCategory` → `SheetUtlegg`). Flat markør (↑/↓/Enter,
  klikk), ordnings-pille som undertekst. Sats-`ExpenseCategory` vises deaktivert
  (se oppfølger under).
- **`UtleggRadDialog` (8b):** én radform per utledet ordning — `utlegg` = beløp
  (påkrevd) + kvittering (påkrevd, legges på lagret rad); `fakturert` = ren
  avhuking, ingen beløp, valgfri kvittering. Kategori + ordning låst (utledet),
  kilde-linje («firma-standard» / «overstyrt for prosjektet»).
- **API:** `timer.expenseCategory.list` (returnerer utledet ordning + kilde per
  prosjekt) · `timer.dagsseddel.tilfoy/oppdater/fjernUtleggRad`
  (`ordningVedFoering` stemplet ved insert; app-speil av CHECK: beløp påkrevd
  utenom fakturert; `sats` avvises — `baeresAvSheetUtlegg`) · `*UtleggVedlegg`
  (speiler tillegg-vedlegg 1:1). `hentMedId` returnerer nå `utlegg[]` m/ vedlegg.

**⚠️ Oppførsel før U5:** alle `ExpenseCategory` står på `ordning='utlegg'`
(U1-default) til firma-admin gjennomgår katalogen i U5. På ekte data viser flaten
derfor **kun utlegg-formen** (beløp + kvittering). `fakturert`-formen og
`sats`-grenen (via Tillegg-gruppa) er bygget og verifiseres via manuelt satt
ordning / prosjekt-overstyring i test-DB — ikke synlig på ekte data før U5.
**E2E-test av U3 forutsetter at U1-migreringen er kjørt på test** (Kenneths gate).

### 🟢 U5 — firma-admin overstyring-UI (2026-08-11)

Gjør U3 ferdig: firma-admin setter `ordning` per kategori og overstyrer per
prosjekt (før dette sto alt på `utlegg`-default).

- **API** (`timer.expenseCategory`, `verifiserFirmaAdmin`-gated): `settOrdning`
  (firma-default), `settOverstyring`/`fjernOverstyring` (upsert/delete på
  `ProsjektOrdningOverstyring`, verifiserer at kategori + prosjekt eies av firmaet),
  `listOverstyringer` (driver panelet). `sats` er lovlig å sette (krav) — men
  registreringsflaten deaktiverer den (U3-gap: ingen lønnsart-bro).
- **Flate:** `firma/timer/utleggskategorier` (ny fane) — ordning-velger per
  kategori, prosjekt-overstyrings-panel, **navnekollisjon-varsel** mot lønnstillegg
  (banner + per-rad-merke), **immutabilitets-mikrotekst** (ordning-endring gjelder
  føringer fra og med nå; allerede førte — også de til attestering — beholder sitt
  `ordningVedFoering`-stempel). Prosjektadmin ser effektiv ordning + kilde read-only
  i `oppsett/prosjektoppsett` («satt av firmaets administrator», «Endres av firmaets
  administrator» — ikke død knapp).
- **U5-fiks:** deaktivert sats-rad i `LeggTilVelger` viser nå «lønnstillegg», ikke
  «beløp + kvittering». Ingen migrering (U1-modellen komplett).

### 🟢 U4 — mobil (kamera-primær) (2026-08-11)

Registrering av utlegg/fakturert på mobil, offline-først (mockup 8c). Ingen
migrering (U1-modellen komplett; mobil-lokal SQLite via `CREATE TABLE IF NOT
EXISTS` i `migreringer.ts`). Speiler tillegg-mønsteret tett.

- **Ordningen er UTLEDET, aldri valgt** — også på mobil. `UtleggSeksjon.tsx`
  (`app/timer/[id].tsx`, egen seksjon parallelt med `TilleggSeksjon`, per prosjekt).
  Velgeren viser kategorier med utledet ordning som pille + kilde-linje; `sats`
  ekskluderes (bæres av `SheetTillegg`). Formen tilpasses: `utlegg` → beløp +
  **påkrevd kvittering** (kamera-primær, beløp før bilde, **Lagre gated på bildet**,
  trykkmål ≥44 px); `fakturert` → «dekket av firma», intet beløp.
- **🔴 Offline-stempling (kjernen):** klienten stempler `ordningVedFoering` +
  `foertVed` ved FØRING via delt `utledOrdning` (`utledOrdningLokalt` i
  `timerKatalog.ts`, mot offline-cachet katalog). Serveren re-utleder **ALDRI** ved
  sync — motsatt av web-stien (`tilfoyUtleggRad` som utleder live). En offline-rad
  bærer ordningen som gjaldt da arbeideren førte den, ikke en admin-endring som kom
  etter. Bevisst divergens (samme prinsipp som U1-immutabiliteten, flyttet til klient
  fordi føringen skjer der). Sikkerhetsnett ved sync: enum + CHECK-speil +
  kategori-i-org + `sats`-avvisning — men aldri re-utledning.
- **`createdAt` = klientens `foertVed`** (ikke synk-tid). `syncBatch` skriver
  `createdAt: new Date(foertVed)` (overstyrer `@default(now())`) → stempelet er
  reviderbart i tid. **Tillegg-raden bruker fortsatt server-tid (synk-tid)** — det
  er et eksisterende hull vi ikke kopierte (navngitt oppfølger under).
- **Offline-cache:** `expenseCategory.katalogForMobil` (rått grunnlag: kategorier +
  overstyringer, én org, mildt tilgangsmønster) → `expense_category_local` +
  `prosjekt_ordning_overstyring_local`, hentet som 5. pull i `refreshKatalog`
  (kaster før destruktiv sletting, aldri `.catch(() => [])`).
- **Sync:** `syncBatch.utlegg[]` (push, bærer stempel + `foertVed`) +
  `slettedeIder.utlegg` (tombstones) + `hentEndringerSiden.utlegg` (pull, m/ vedlegg).
  Kvittering speiler tillegg: `sheet_utlegg_vedlegg_local` + `opplastings_ko.sheet_utlegg_id`
  + `/upload?privat=1` + `tilfoyUtleggVedlegg` (fantes fra U3).
- **Reload:** ny build kreves (mobil-JS + native ikke endret → OTA/Expo-reload holder).

### Navngitte oppfølgere (U3-avgrensning)

- **U4: tillegg-rad `createdAt` = synk-tid (eksisterende hull):** `syncBatch` skriver
  ikke et klient-`foertVed` for `SheetTillegg` → `createdAt` faller til `@default(now())`
  = synk-dagen, ikke føringsdagen. U4 rettet dette for utlegg; tillegg (og maskin/timer)
  bør få samme reviderbare stempel i en egen runde.
- **U4: utlegg-vedlegg sync-orden (delt med tillegg):** køen registrerer et vedlegg
  via `tilfoyUtleggVedlegg` (findUnique på `SheetUtlegg`) uavhengig av `syncBatch`.
  Rekker køen å registrere før raden er synket, gir det NOT_FOUND (best-effort `.catch`,
  fil lastet opp men server-metadata tapt). **Identisk med tillegg-vedlegg i dag** — en
  robust fiks (køen venter på rad-sync, eller pull re-assosierer) er egen runde for
  begge bærere.
- **U4: prosjekt fast til seksjonens prosjekt i utlegg-modalen** (ingen prosjekt-velger,
  til forskjell fra `TilleggRadModal`). Bevisst: ordningen er prosjekt-avledet, så et
  prosjektbytte i modalen ville endret ordningen. Utlegg føres per prosjekt-seksjon.

- **bro `ExpenseCategory`→lønnsart:** en utleggskategori med ordning `sats` har
  ingen lønnsart-kobling i U1-modellen → `SheetUtlegg` avviser `sats` (den bæres
  av `SheetTillegg`). I U3 dekkes `sats` av lønnstillegg-katalogen (Tillegg-gruppa).
  Skal firma-admin (U5) kunne sette en utleggskategori til `sats` og eksportere
  til en bestemt lønnsart, trengs en eksplisitt kobling — egen runde.
- **U-admin: utlegg i attesterings-redigering:** U3 er **kun arbeider-sti**.
  Firma-admin kan rette *timer* ved attestering (`redigerSedelRader`), men **ikke
  utlegg** — kjent asymmetri (jf. HMS-asymmetrien), egen oppfølger.
- **U5-krav — navnekollisjon på tvers av to kataloger:** to kataloger (`Tillegg`
  sats · `ExpenseCategory` utlegg/fakturert) betyr at **samme navn kan finnes
  begge steder** → feltarbeideren ser da to oppføringer med samme navn i én
  velger (mot mockupens «én oppføring per kategori»). Teknisk entydig (ulike
  id-er), forvirrende i felt. **Ikke løst i U3.** U5 må: vise firma-admin en
  advarsel når et navn finnes i begge kataloger og veilede til å velge ett sted.

### Godkjenning

- Leder ser kvitteringsbilde i godkjenningsvisningen (attestering)
- Attesteres samtidig med dagsseddelen — ikke egen godkjenningsflyt. **Attestering
  ≠ godkjenning** (CLAUDE.md, låst 2026-04-26).

## Byggeplass per rad (web) — ordre (10)

**Status:** implementert på `feat/web-timer-byggeplass` (2026-11-05), ikke merget. Hjemmel Kenneth 05.11.

Timer- og maskinrader i web-dagsseddelen (`apps/web/src/app/dashbord/timer/[id]/page.tsx`, `TimerRadDialog` + `MaskinRadDialog`) har et adaptivt byggeplassfelt rett etter prosjekt-/maskinvelgeren (`apps/web/src/components/timer/RadByggeplassFelt.tsx`):

- **0 byggeplasser** på radens prosjekt → feltet er skjult.
- **1 byggeplass** → settes automatisk og vises som tekst.
- **≥ 2** → nedtrekk med «Ingen byggeplass» + kandidatene.

**Forhåndsvalg (ny rad):** toppbarens byggeplass (`useByggeplass().aktivByggeplass`) hvis den hører til radens prosjekt, ellers tomt; valget kan tømmes. **Prosjektbytte** i dialogen nullstiller en byggeplass som ikke hører til det nye prosjektet. Regelen er ren logikk i `apps/web/src/lib/timerByggeplass.ts` (`velgStandardByggeplass`, `byggeplasserForProsjekt`). Kandidatene hentes med `bygning.hentForFirma` (tilgjengelig for arbeidere).

**Radlinja (V22, web-paritet med mobil):** timeraden har en sekundærlinje i liten skrift under radtypen: «Prosjekt · Byggeplass» (`RaderTimer` i `page.tsx`, tekst fra `radByggeplassLinje` i `apps/web/src/lib/timerByggeplass.ts`). Byggeplass = radens egen, ellers dagskortets — arvet vises nedtonet med «(fra dagskortet)» (i prosjektkort-modus «(fra dagen)»), og arves bare når den hører til radens prosjekt; ellers «Ingen byggeplass». Byggeplassnavnet står ikke lenger i tittellinja (erstatter ordre (10)s «Prosjekttimer · Lab 16»). Klikk på linja åpner rad-dialogen med byggeplassfeltet. Maskinradene (`RaderMaskinKompakt`) beholder « · navn» i tittelen. i18n gjenbruker mobilens `timer.byggeplass.fraDagskort`/`fraDagen`/`ingenValgt`. Tester: `timerByggeplass.test.ts` (V22-blokk) + `radlinje-visning.test.tsx` (inkl. vakt mot navn i tittelen).

**Ett-klikk på mobil (målt 2026-11-12):** web velger automatisk når prosjektet har nøyaktig én byggeplass (`velgStandardByggeplass`). Mobilens `byggeplassForNyRad` (`apps/mobile/src/services/nyTimerRad.ts`) har ikke den regelen — innlogget → GPS → arv fra dagskortet. Meldt orkestrator, ikke bygget.

**Server:** `tilfoyTimerRad`, `oppdaterTimerRad`, `maskin.tilfoy` og `maskin.oppdater` validerer `byggeplassId` mot **radens** `projectId` via `krevByggeplassIProsjekt` (`apps/api/src/routes/timer/byggeplass-rad.ts`) → `BAD_REQUEST` ellers. `null`/utelatt er gyldig (A.30). Oppdatering: utelatt = urørt, `null` = tøm.

**Øvrige skriveveier (ordre (12), 2026-11-05):** `forsonDagskort`, `redigerSedelRader`, `splittRad`/`splittRadEier` (via `validerSplittFelles`) og `opprett` (sedel med `projectId` og byggeplass) avviser byggeplass fra et annet prosjekt med samme `BAD_REQUEST`, før noe skrives — `krevByggeplasserIProsjekt` slår opp alle radene i én spørring. **`syncBatch` avviser ikke** (en avvist sedel ville blokkert mobilens offline-kø): `lagByggeplassVasker` lagrer byggeplass utenfor radens prosjekt som `null` (prosjektet beholdes), også på sedelhodet og i forslags-veiene, og serveren logger `[timer_byggeplass_grense]`. En rad med fremmed byggeplass arver ikke sedelhodets byggeplass. Sedelhode uten kjent prosjekt har ingen grense å måle mot og står urørt; `oppdater` på sedelhodet har heller ingen prosjektgrense (hodet har ikke prosjekt). `redigerSedelRader` er full erstatning, og `forsonDagskort` nuller byggeplass på oppdaterte rader når feltet er utelatt — «utelatt = urørt» gjelder de interaktive rad-mutasjonene.

**Bakoverkompatibilitet:** redigering sender `byggeplassId` bare når brukeren har endret feltet, så en verdi mobilen har satt overskrives ikke. Mobil-synk (`syncBatch`) og attestering (`redigerSedelRader`) er urørt. Ingen skjemaendring, ingen GPS i web. Erstatter BACKLOG ⑤ på rad-nivå; toppbar-velgeren i prosjekt-timerlista er fortsatt av.

**Klient:** `byggeplassErEndret` + `byggeplassPayload` (`apps/web/src/lib/timerByggeplass.ts`) avgjør om `byggeplassId` sendes ved redigering — uendret felt utelates (ikke `null`).

**Tester:** `apps/api/src/routes/timer/byggeplass-rad.test.ts` (16: avvisning i alle skriveveier, utelatt = urørt på server, hjelpere), `apps/api/src/routes/timer/timer-lag2-sync.test.ts` (syncBatch-vasking: batchen fullfører, byggeplass `null`, logg), `apps/web/src/lib/__tests__/timerByggeplass.test.ts` (9, utelatt = urørt på klient).

## Tillegg og utlegg på prosjektkortet — API

**Status:** 🟡 `feat/timer-tillegg-utlegg-kort` (2026-11-13), ikke merget, venter Kontrollør-gate. Spec: [tillegg-utlegg-prosjektkort-spec.md](tillegg-utlegg-prosjektkort-spec.md) (B1–B8 vedtatt av Kenneth).

`sheet_tillegg` og `sheet_utlegg` bærer `byggeplassId` og `externalCostObjectId` (underprosjekt). NULL betyr arv: byggeplass fra sedelen (A.30), underprosjekt ingen.

- **Interaktive skriveveier** (`tilfoyTilleggRad`, `oppdaterTilleggRad`, `tilfoyUtleggRad`, `oppdaterUtleggRad`, `redigerSedelRader`, `splittRad`/`splittRadEier` i `apps/api/src/routes/timer/dagsseddel.ts`) avviser byggeplass utenfor radens prosjekt (`krevByggeplasserIProsjekt`) og underprosjekt utenfor radens prosjekt eller firma (`krevEcoerIProsjekt` i `apps/api/src/routes/timer/byggeplass-rad.ts`) med BAD_REQUEST. Et utelatt felt i `oppdater*` lar verdien stå.
- **`syncBatch`** avviser aldri: et fremmed felt vaskes til `null` (`kortFeltVedSync` + `lagEcoVasker`), et utelatt felt blir `null`. En gammel klient som ikke kjenner feltene, gir dermed arv. `hentEndringerSiden` returnerer feltene.
- **Splitt:** delene arver originalens felt når de står på samme prosjekt og ikke oppgir egne (`arvTilleggKort`); bytter delen prosjekt, nulles feltene.
- **`redigerSedelRader`** skriver `?? null` for tillegg — webklienten må sende feltene, ellers nulles de ved redigering.
- **B7 flytt:** `flyttTimerRadEco` tar `radType: "timer" | "tillegg"` (standard `"timer"`). Tillegg logges som `tillegg.eco-flyttet` på `sheet_tillegg`. Samme ECO-krav som timer (aktiv, åpen for timeregistrering, samme prosjekt).
- **B8 eksport:** `rapport.detaljEksport` (`apps/api/src/routes/timer/rapport.ts`) gir `byggeplass` (radens, ellers sedelens) og `underprosjekt` («proAdmId · kortNavn», firma-scopet oppslag) på timerader, maskinrader, tillegg og utlegg. Kolonnene: se «Web og eksport (C6)» under.

Tester: `apps/api/src/routes/timer/tillegg-utlegg-kort-api.test.ts` (T2–T4 + B7), `tillegg-utlegg-kort-migrering.test.ts` (T1).

**Mobil — føring på kortskjermen (C4):** «Tillegg» og «Utlegg» står på kortskjermen `app/timer/[id]/kort/[projectId].tsx` under kortets rader, med `HjelpIkon`. Radene er `raderPaaKort(…, valg)` — samme kortnøkkel som timer (`kortNokkelFor`), så en arvende rad (NULL) hører til kortet med sedelens byggeplass og uten underprosjekt. Ny rad får `kortFelt` (`lagretByggeplassForKort` + kortets ECO) og står låst grått i modalen (`KortLaasFelt`, via `ProsjektkortKontekst` med `KortLaas`); retting går via «Endre kort». `DagSeksjon` har bare reise. Tillegg og utlegg lager kort (`kortNokler` i `useProsjektkortSedel`), samlesidens kortrad viser «Tillegg n · Utlegg n» (`ProsjektkortDagsoversikt` `kortHode`). Endre/Slett kort tar dem med (`kortInnhold`, B4; Slett tombstoner). Dagskortet er urørt (B1/B3, vakt `dagskort-isolert-vakt.test.ts`; `UTLEGG_CHIPS` står, men `prosjektValg` har ingen avsender lenger). Tester: `prosjektkort/kortTilleggUtlegg.test.ts`, vakt `timer-detalj/tillegg-utlegg-kort-vakt.test.ts` (T7).

**Mobil — Bekreft dag pr. kort (C5, B6):** hver tillegg-/utleggslinje i `BekreftDagLonnUtlegg` bærer kortets `projectId` + effektive `byggeplassId`. Ny linje får prosjektets kort med flest timer (`kortMedFlestTimer(forslag, projectId)`). Med flere kort (`kortMedArbeid`) vises kortvalg («Kort», `timer.bekreftDag.lonnUtlegg.kortValg`) pr. linje med samme etikett som beskrivelsesfeltene; ett kort → ingen valg. Ved lagring knyttes linjene til et kort som finnes (`knyttLonnUtleggTilKort`, `utils/lonnUtleggKort.ts`): eksakt treff beholdes, borte kort eller gammelt utkast uten felt → prosjektets kort med flest timer, prosjekt uten arbeid → null (arv). `anvendDagsforslag` lagrer byggeplassen som timeradene (`lagretByggeplassForKort`: lik sedelens → null) og setter dagens underprosjekt (`ctx.ecoId`) bare på linjer på dagens prosjekt. Begrensning som på kortskjermen: kort uten byggeplass på en sedel med byggeplass arver sedelens. Tester: `utils/lonnUtleggKort.test.ts`, `bekreftDagTillegg.test.ts` § T12, vakt T12 i `tillegg-utlegg-kort-vakt.test.ts`.

**Web og eksport (C6, B7/B8):**
- **Kolonner:** `byggeplass` og `underprosjekt` står i `TIMER_KOL_KEYS` rett etter `prosjekt` (`packages/shared/src/utils/timerDetaljRader.ts`), speilet i `KOLONNE_KEYS` (`apps/api/src/routes/timer/eksportOppsett.ts`) og `pdfEksport.kolonner` (`rapport.ts`). Skjerm (`TimerRapportDetaljer`), Excel (`EXCEL_KOL`) og PDF (`packages/pdf/src/timer-rapport.ts`) viser dem på alle radtyper; dynamisk sett dropper dem når de er tomme. Gjelder også ekstern mottaker.
- **Sedel (`/dashbord/timer/[id]`):** tillegg/utlegg med underprosjekt står i underprosjektets bøtte (`EcoGruppe`); NULL-rader står i prosjektseksjonen som før. Rad-dialogene har byggeplass og underprosjekt (`useRadSted`/`RadStedFelt`); ny rad får byggeplass-standard som en timerad, redigering sender bare felt som er endret.
- **Attestering (B7):** tillegg står fortsatt i prosjektseksjonen (`TilleggRaderLeder` i `attestering-buckets.tsx`), med underprosjekt-velger pr. rad når attestanten kan flytte (`flyttTimerRadEco` med `radType: "tillegg"`).
- **Redigering sender feltene uendret:** `RedigerRadModal` og `AttesteringDetalj_Edit` bærer tilleggets `byggeplassId`/`externalCostObjectId` til `redigerSedelRader` (ellers `?? null`). Vakt: `apps/web/src/__tests__/tillegg-sted-bevart-vakt.test.ts`. Test: `timerDetaljRader.test.ts` (kolonner).
- **«Lagre endringer» i «Rediger arbeid» beholder byggeplassen (F68):** `byggRedigerNyeRader` (`RedigerRadModal.tsx`) sender hver ventende timerad og maskinrads `byggeplassId` uendret — også radene utenfor jobben; delte rader arver originalens. Før sendte vinduet `null`, som tømte byggeplassen og ga raden ny kort-id. Tester: `attestering/__tests__/rediger-rad-lagre.test.ts`, `apps/api/src/routes/rediger-arbeid-byggeplass.integration.test.ts`.

## Hjelpetekster (?-ikonet) — alle timer-sider

Per regelen i [CLAUDE.md](../../CLAUDE.md#hjelpetekster-per-side) skal hver side i SiteDoc ha hjelpetekst tilgjengelig via ?-ikonet øverst til høyre. For timer-modulen gjelder dette ALLE sider — bygges samtidig med siden, oppdateres når siden endres.

**Konsepter som MÅ forklares i ?-hjelp på relevante sider:**

| Side | Hjelpetekst skal dekke |
|------|------------------------|
| `/timer/min-tid` (dagsseddel) | Hva er en dagsseddel, lønnsart-valg, hvordan koble til Underprosjekt, signering, byggeplass per rad (forhåndsvalgt fra toppbaren, kan tømmes) |
| `/timer/oppsett/underprosjekter` | Hva er Underprosjekt, forskjell mellom Proadm-importert vs. SiteDoc-avledet, åpen/lukket-status |
| `/timer/oppsett/lonnsarter` | Hva er en lønnsart, kobling til Poweroffice-kode, fravær-flag |
| `/timer/oppsett/tillegg` | Skifttillegg, beredskap, automatiske vs. manuelle tillegg |
| `/timer/oppsett/godtgjorelser` | Diett, overtidsmat, kvitteringskrav |
| `/timer/oppsett/eksport-config` | Proadm vs. SiteDoc Godkjenning som kilde, Poweroffice-oppsett |
| `/timer/godkjenning` | Forenklet godkjenningsflyt (kun utførelse, ikke økonomi), signeringsregler |
| `/timer/eksport` | Hva er eksportert, hvordan markere som eksportert, Poweroffice-format |
| `/timer/rapporter/*` | Hva hver rapport viser, hvilke filtere, hvordan eksportere |
| Godkjenning-dokument (eksisterende) | Når «Opprett underprosjekt»-knappen vises, betingelser (modul-aktivering), juridisk grunnlag for at knappen ikke krever økonomisk avklaring |

**Spesielt viktig å forklare i hjelpetekst:**
- **Underprosjekt vs. kontraktsbegreper** — at ansatte ser «Underprosjekt», kontraktsadmin ser tilleggsarbeid/endring/varsel
- **Utførelse er frikoblet økonomi** — entreprenør kan/må føre timer selv om økonomi er uavklart (NS 8405/06/07)
- **Kilde-systemer** — Proadm vs. SiteDoc Godkjenning, hvordan velge, hvordan skille i listen
- **Forenklet godkjenning** — skiller seg fra eksisterende «Godkjenning»-dokumenttype ved at den IKKE inneholder økonomi

Bruk eksempler med norske navn (Ola, Trude, Per) — ikke abstrakte beskrivelser. Når sider bygges, oppdater også «Sidestatus ?-ikon»-tabellen i [CLAUDE.md](../../CLAUDE.md#hjelpetekster-per-side).

## Underprosjekt og forenklet godkjenning (planlagt)

### Begrepsbruk

- **I timer-modulens UI / mot ansatte:** «Underprosjekt»
- **I kontraktssammenheng / dokumentflyt:** Tilleggsarbeid, varsel, endring, varsel om endring, regningsarbeid
- Aldri bland disse to. Ansatte ser kun «Underprosjekt» — kontraktsbegreper er for kontraktsadministrasjon.

### Underprosjekt-modell (planlagt, `packages/db-timer/`)

```
Underprosjekt {
  id, navn, hovedprosjektId, status (åpen/lukket)

  // Kilde — Underprosjekt opprettes ALLTID fra et eksisterende godkjenningsdokument:
  kilde: "proadm" | "sitedoc_godkjenning"

  // Hvis Proadm (importert):
  proadmId, proadmNummer, proadmType
    (tilleggsarbeid/varsel/endring/regningsarbeid)

  // Hvis SiteDoc:
  godkjenningId  // → ReportInstance med malens type "Godkjenning"
}
```

### Avledning — Underprosjekt opprettes ikke selvstendig

Underprosjekt er **alltid en avledning** av et formelt godkjenningsdokument. Det opprettes ikke direkte i timer-modulen.

**To kilder — ulike flyter:**

#### A) Proadm-import (automatisk)

Når Proadm-integrasjonen er aktivert for prosjektet, importeres Underprosjekter automatisk fra Proadm. Proadm er kilden — vi henter, viser, kobler timer mot det. Endringer i godkjenningsstatus skjer i Proadm. Vi viser Proadm-status i Underprosjekt-listen, men endrer den ikke.

**Krav:**
- Timer-firmamodulen aktivert
- Proadm-integrasjon konfigurert på firma/prosjekt
- Ingen knapp på SiteDoc Godkjenning er relevant — Underprosjekt-listen befylles fra Proadm-sync

**Sync-strategi:** Proadm-import kjører på fast intervall (eller manuell trigger). Nye endringer/varsel/regningsarbeider blir Underprosjekter med `kilde = "proadm"`. Ved slettet i Proadm: marker som lukket, ikke slett (bevar timer-historikk).

#### B) SiteDoc Godkjenning-flyt (manuell knapp)

Når SiteDoc-dokumentflyt brukes for endringshåndtering: leder klikker «Opprett underprosjekt for timeregistrering» på Godkjenning-dokumentet. Den formelle Godkjenningen beholder økonomi-diskusjonen — Underprosjektet er kun utførelses-speilbildet ansatte ser.

**Krav:** Se «Avledning fra SiteDoc Godkjenning — manuell knapp» under.

#### Konfigurasjon per firma + per prosjekt

**Proadm er en valgfri integrasjon — ikke et krav.** Mange potensielle kunder bruker ikke Proadm. Timer-modulen må fungere uavhengig av om Proadm er konfigurert eller ikke.

**Konfigurasjonsmatrise:**

| Kundens oppsett | Underprosjekt-kilde | Konsekvens |
|---|---|---|
| Verken Proadm eller Godkjenning-modul | **Ingen** — Underprosjekt-feltet skjules i timeregistreringen | Timer føres direkte mot hovedprosjekt |
| Godkjenning-modul aktivert (uten Proadm) | **SiteDoc Godkjenning** — manuell knapp på Godkjenning-dokument | Standard for kunder uten ERP |
| Proadm aktivert | **Proadm** — automatisk import | A.Markussen-case |
| Proadm + drømmescenario | **Proadm** + auto-opprett SiteDoc Godkjenning som kommunikasjonsverktøy | Se neste seksjon |

**Eksklusivt valg når begge muligheter finnes:** Hvis et firma både har Proadm og Godkjenning-modulen aktivert, må de velge ÉN som kilde for Underprosjekt. Aldri begge som parallelle kilder — ville gitt konkurrerende sannheter og uklart eierskap.

Ved bytte av kilde: eksisterende Underprosjekter beholdes med opprinnelig kilde markert. Kun nye følger ny konfigurasjon.

#### Drømmescenario — Proadm → auto-opprett SiteDoc Godkjenning

> **🟡 BACKLOG — Ikke implementeres i Fase 3** (vedtatt 2026-04-29). Mange åpne spørsmål (mapping ProAdm-felt → Godkjenning-mal-felter, status-sync-konflikter, read-only-policy, versjonering). Krever stabil ProAdm-integrasjon før det gir mening. Re-vurderes når Fase 3 er deployet og kunde etterspør funksjonalitet.

Kombinasjons-mulighet som bør utforskes: Proadm-import oppretter automatisk en SiteDoc Godkjenning-dokumentinstans, som så blir kilde for Underprosjekt via knappen.

**Rollefordeling i dette scenarioet:**
- **Proadm** = entreprenørens interne kontrakts-/økonomisystem (kontraktsstatus, beløp, regningsarbeid-vurdering)
- **SiteDoc Godkjenning** = **kommunikasjonsverktøy mellom entreprenør og byggherre** — det er hele formålet med å auto-opprette den

**Statusflyt — manuell sync (første versjon):**
- Proadm → SiteDoc: auto-opprettelse ved import (envei)
- Når byggherre godkjenner i SiteDoc: noen oppdaterer status manuelt i Proadm
- Auto-sync SiteDoc → Proadm utsettes til senere — avklares når behov og teknisk grunnlag er klart

**Fordeler:**
- Byggherre kommuniserer i SiteDoc-flate (slipper Proadm-tilgang)
- Entreprenør beholder Proadm som sin økonomi-master
- Underprosjekt for timer kan avledes via SiteDoc Godkjenning-knappen
- Ett konsistent UI (SiteDoc) for både utførelse, kommunikasjon og dokumentasjon

**Åpne spørsmål:**
- Mapping mellom Proadm-felt (proadmType, beløp, beskrivelse) → Godkjenning-malens felter
- Hva skjer hvis SiteDoc Godkjenning endres manuelt etter auto-opprettelse — overskrives ved neste Proadm-sync, eller markeres som «konflikt»?
- Er SiteDoc Godkjenning read-only på økonomi-felter når Proadm er kilde (kun kommunikasjon/status redigeres i SiteDoc)?
- Når Proadm-endring importeres på nytt: oppdater eksisterende SiteDoc Godkjenning eller opprett ny versjon?

Foreløpig status: **idé, ikke besluttet.** Bør utredes før timer-modulen bygges ferdig.

### Forenklet godkjenningsflyt (mot ansatt)

Egen forelder-objekt-type «Timeregistrering» i [malbyggeren](../../MALBYGGER.md) som lar timeregistrering kobles til underprosjekt og sendes til ansatt for bekreftelse.

**Skal IKKE inneholde:**
- Priser, satser, kostnader
- Fakturering, beløp, kontraktssum
- Diskusjon om økonomiske forhold

**Skal KUN inneholde:**
- Hva ble gjort (aktivitet, kommentar)
- Antall timer, dato
- Hvilken lønnsart
- Eventuell signatur for bekreftelse av utførelse
- Vedlegg/bilder fra utførelsen

**Hvorfor:** Økonomi (priser, kontrakt, fakturering) håndteres i Proadm eller annet ERP. Ansatte skal kun forholde seg til utførelse — hva er gjort, hvor mange timer, har leder godkjent. Skiller dette tydelig fra den eksisterende «Godkjenning»-dokumenttypen som kan inkludere økonomi.

**Flyt:** Leder oppretter timeregistrering basert på mal → sendes til ansatt → ansatt bekrefter (signerer) → tilbake til leder for endelig godkjenning → eksporteres til lønnssystem (Poweroffice).

**Kobling til Underprosjekt:** Timeregistreringen knyttes til et Underprosjekt som allerede eksisterer (avledet fra Proadm eller fra SiteDoc Godkjenning-dokument — se «Underprosjekt-modell» over). Selve timeregistreringen oppretter ikke nytt Underprosjekt — den bruker et eksisterende.

### Avledning fra SiteDoc Godkjenning — manuell knapp

På et Godkjenning-dokument (uavhengig av status) finnes knappen **«Opprett underprosjekt for timeregistrering»**. Leder klikker når utførelsen skal starte.

**Synlighetsbetingelser for knappen** — vises kun når begge er sanne:
1. **Timeregistrerings-modulen er aktivert** (firmamodul, se [CLAUDE.md](../../CLAUDE.md#modulsystem--to-nivåer))
2. **Godkjenning-modulen er aktivert på prosjektet** (prosjektmodul)

Hvis én av disse er av, skjules knappen — ingen poeng å tilby Underprosjekt-opprettelse hvis ansatte ikke kan føre timer mot det, eller hvis Godkjenning ikke er en aktiv dokumenttype på prosjektet.

**Aldri automatisk basert på godkjent-status.** Begrunnelse: i norsk entrepriserett (NS 8405/8406/8407) er entreprenøren kontraktspliktig til å utføre arbeid selv ved økonomisk uenighet. Hvis vi blokkerte Underprosjekt-opprettelse til Godkjenningen var økonomisk avklart, ville vi hindre lovpålagt utførelse. Utførelse-spor (timer) må alltid kunne starte uavhengig av økonomi-spor (pris/fakturering).

Underprosjektets `kilde` settes til `sitedoc_godkjenning` og `godkjenningId` peker til kilde-dokumentet. Endringer i Godkjenningens økonomiske status påvirker ikke Underprosjektets åpen/lukket-status.

## Flerstegs attesteringsflyt — 🟡 VEDTATT PRINSIPP, IKKE BYGGET (Kenneth 2026-08-20)

**Vedtak:** attesteringsflyten skal leve **i firmamodulen (timer)**. Den skal **ikke**
bygges på eller blandes inn i dagens dokumentflyt-modul.

**Ønsket modell** (Kenneths skisse): et firma konfigurerer sine egne attesteringssteg
som en leddrekke — `arbeider ↔ prosjektleder ↔ kontorleder`, deretter eksport til
lønnssystem. Toveis-pilene er retur nedover i kjeden. **Lønn er ikke et ledd** — se
avklaringen under åpne spørsmål.

**Dagens tilstand (målt 2026-08-20):** timer har **ett** attesteringssteg. `attestertStatus`
er flat med fire verdier (`pending` | `attestert` | `returnert` | `erstattet`,
`db-timer/prisma/schema.prisma:249`). Det finnes ingen stegmodell, ingen kjede og ingen
firma-innstilling for rekkefølge. Prosjektleder (eller `ProjectMember.kanAttestere`)
attesterer, og raden er ferdig.

**Hvorfor ikke gjenbruke dokumentflyt:**

1. **Begrepsgrensen er låst.** Attestering = arbeider får lønn for registrert tid.
   Godkjenning = entreprenør får byggherre til å godta kostnad. Grensen er ufravikelig
   (CLAUDE.md, låst 2026-04-26); å kjøre timer gjennom dokumentflyt-motoren ville viske
   den ut i både kode og UI.
2. **Isolasjonsaksene er ulike.** Timer er firmamodul isolert på `organizationId`;
   dokumentflyt er prosjektmodul isolert på `projectId`. Kjeden krysser nivåene —
   prosjektleder er prosjekt-nivå, kontorleder og lønn er firma-nivå. Dokumentflyt-motoren
   kan ikke spenne begge slik den står.

**Til orientering:** dokumentflyt har allerede en ordnet leddrekke (`DokumentflytMedlem.steg: Int`,
`rolle`, `ansvarsmerke`, binding mot faggruppe/gruppe/person/åpent). Den er **referanse for
modellering**, ikke noe timer skal koble seg på.

**Åpne spørsmål før bygging:**

- ✅ **AVKLART (Kenneth 2026-08-20): lønn er IKKE et attesteringssteg.** «Lønn» er et
  **eksternt lønnssystem** (Proadm). Kjeden har derfor **tre ledd** — `arbeider ↔
  prosjektleder ↔ kontorleder` — og eksport til lønn er utgangen, ikke et ledd.
  Firmaet (A.Markussen) sørger selv for at lønnsartene er korrekte **før** eksport;
  derfor må firmaet kunne redigere sine egne lønnsarter. Konsistent med lønnsart-grensen
  i CLAUDE.md: SiteDoc leverer default lønnsart-numre (redigerbare per firma), mens
  mapping til konto og faktiske satser tilhører regnskap.
  → Verifisert i kode 2026-08-20: `timer/lonnsart.ts` har `opprett`/`oppdater`/`deaktiver`
  (deaktivering, ikke sletting) og web-flaten `/dashbord/firma/timer/lonnsarter` **er i prod**.
- Hvor mange ledd trenger et firma faktisk? Skissen har tre; er to nok for mindre firma,
  og skal antallet være fritt konfigurerbart?
- Hvordan bindes et ledd — rolle, person, eller kapabilitet (`kanAttestere`)?
- Hva skjer med `gjenaapneAttestering` når det er flere ledd — reverseres ett steg eller hele kjeden?

**Relatert restriksjon (målt 2026-08-20):** en attestert rad kan i dag ikke åpnes alene.
`returnerRader` krever `pending`; `gjenaapneAttestering` krever at sedelen er `accepted`.
En delvis attestert `sent`-sedel har derfor ingen vei tilbake for enkeltraden. Egen sak.

## Planlagte arkitektur-utvidelser (2026-06-08)

> **🟢 Beslutningssett rutet fra [OPPSUMMERING-timer-arkitektur.md](OPPSUMMERING-timer-arkitektur.md).** Schema-skisse i [arkitektur.md](arkitektur.md). Faseinndelt via SPOR 3 — ikke kodet ennå. Alt additivt (nullable/defaultet) → enkelt-stegs migrasjoner; **T.2 (`projectId NOT NULL`) gjenåpnes IKKE**.

### Reise og oppmøtested (§ B)

#### Oppmøtested med perioder (POST 2026-11-15 (12), L1)

> **🟡 L1 levert på `feat/oppmote-perioder` (venter Kontrollør-gate, ikke merget).** Migrasjon `20261115120000_oppmote_perioder` kjøres av Kenneth.
>
> - **Modell:** `OppmotePeriode` pr. ansatt (firmamedlem) — *fast* kontor (ingen sluttdato), *midlertidig* kontor (fra–til) eller *byggeplass* (prosjekt, fra–til). Skjema i [arkitektur.md](arkitektur.md).
> - **Resolver (`løsOppmote`, `packages/shared/src/utils/oppmote.ts`):** på dagsseddelens dato, bindende rekkefølge: byggeplass-periode på dagens prosjekt → GPS-start på kontor → midlertidig → fast → `ikkeValgt`. Etterregistrering i en gammel periode gir det gamle stedet. `ikkeValgt` = ukjent avstand; resolveren sperrer ikke selv, men reise-kortet sperrer Lagre (`oppmoteIkkeValgt`, vedtak 2026-11-15 — se § Reise-kort og overføring). Kobles til auto-reise i L2.
> - **API (`apps/api/src/routes/oppmotePeriode.ts`):** `hentMine` (egne perioder + `trengerValg`), `settMittFaste` (ansatt setter første faste sted; FORBIDDEN når et fast finnes — kun firmaadmin endrer), firmaadmin `hentForFirma`/`opprett`/`oppdater`/`slett`. Nytt fast sted lukker det gjeldende dagen før; sletting av et åpent fast sted gjenåpner det forrige (angre); et lukket fast sted er historikk og kan ikke slettes (BAD_REQUEST `firma.ansatte.oppmote.feil.lukketFast` — ellers datohull der etterregistrering gir `ikkeValgt`). Kappløp om fast sted i `opprett` (P2002) → CONFLICT. Overlapp avvises med `finnPeriodeKonflikt` (samme regel i klienten). Byggeplass-prosjektet må ha `primaryOrganizationId` = firmaet. Tester: `oppmotePeriode.test.ts`.
> - **«Hvor møter du vanligvis?»:** vises ved timeregistrering når firmaet har ≥ 2 aktive oppmøtesteder og den ansatte ikke har fast sted (`trengerOppmoteValg`). Ett trykk lagrer; lukk = fortsett uten. Mobil: `OppmoteSporsmaal.tsx` i «Start dag» og manuell «Bekreft dag», aldri offline. Web: `OppmoteSporsmaalModal.tsx` på «Ny dagsseddel» (`dashbord/timer/ny`).
> - **Mobil-cache:** `oppmote_periode_local` (`oppmotePeriodeKatalog.ts`), full overskriving pr. (bruker, firma) ved login og nett-gjenkomst (`TimerSyncProvider`); feilet pull beholder cachen. Tester: `oppmotePeriodeKatalog.test.ts`.
> - **Firmaadmin:** Firma → Ansatte → rediger → «Oppmøtested» (`_components/OppmotePerioder.tsx`): oppsummeringslinje (fast + midlertidige/byggeplass som ikke er utløpt), liste med «Satt av», «+ Periode» (Fast/Midlertidig/Byggeplass → sted/prosjekt → fra/til; prosjektnedtrekket viser kun prosjekter med `primaryOrganizationId` = firmaet, samme regel som serveren — UE-prosjekter er ikke med) og sletting via modal (ingen slettknapp på lukkede faste rader). Ingenting i prosjektkortet.
> - **Gjenstår (L2):** resolveren driver auto-reise, kontor→kontor-avstand (`OppmotestedAvstand`, OSRM + manuell), tur/retur som separate forslag, sperre ved manglende kjøretid/dagstid, «siste valg på enheten» fjernes.

#### Reise-kort og overføring (POST 2026-11-15 (13), L2)

> **🟡 Under arbeid på `feat/reise-kort-l2` (ikke merget).**
>
> - **Årsak «reise-lønnsart mangler» (B):** når en reise-etappe er klassifisert som reisetid, men verken avstandsbånd eller `reiseLonnsartId` gir en art, setter `beregnDagsforslag` `reiseAarsak = "mangler_reise_lonnsart"` (`apps/mobile/src/utils/dagsforslag.ts`, `reiseForRetning`) i stedet for å droppe reisen stille. Bekreft dag viser «Ingen reise ført: reise-lønnsart er ikke satt opp». Mobil kjenner ikke firmaadmin-rollen, så lenken til reise-regelsettet ligger på web. Test: `dagsforslag.test.ts`.
>
> - **Reise-kort-regelen (`løsReiseKort`):** ren funksjon i `packages/shared/src/utils/reiseManuell.ts`. Retning **Til byggeplass** = (dagstart − kjøretid) → dagstart; **Fra byggeplass** = dagslutt → (dagslutt + kjøretid); timer = kjøretid/60; klassifisert mot terskel og avstandsbånd via `klassifiserManuellReise`. Oppmøtested kommer fra perioderesolveren (`løsOppmote`), kjøretid/avstand fra matrisen. Sperrer Lagre (`sperre`): `byggeplassPeriode` (møter på byggeplass), `oppmoteIkkeValgt` (resolveren gir `ikkeValgt`: «Oppmøtested er ikke valgt — koble til nett for å velge», Kenneth-vedtak 2026-11-15, gate (32) vilkår 1), `manglerKjoretid`, `manglerDagstid` (før arbeidstid først), `utenforDognet`, `manglerRegel`, `manglerArt`. Sporet (`ManuellReiseSpor`) bærer nå `reiseRetning` (`ut`/`retur`). `finnDagsramme` gir dagstart/-slutt fra dagens ikke-reise-rader. Test: `reiseManuell.test.ts`.
> - **Perioderesolveren styrer GPS-reisen i Bekreft dag (beslutning 1):** `dagsforslagInput.ts` kaller `løsOppmote` med dagens perioder (`hentOppmotePerioderLokalt`) og GPS-kontoret, og `brukOppmoteResolver` (`dagsforslag.ts`) justerer start/slutt før etappene beregnes: byggeplass-periode → start og slutt på byggeplassen (ingen reise); ukjent GPS-start + midlertidig/fast kontor → start på det kontoret (ut-etappe); GPS-kontor og GPS byggeplass/utenfor beholdes. Retur oppfinnes ikke — den krever fortsatt GPS-slutt på kontor. Test: `dagsforslag.test.ts` § brukOppmoteResolver.
> - **Overføring som forslagsrad (beslutning 5 + 6, TILLEGG):** `finnOverforinger(dato, perioder)` (`packages/shared/src/utils/oppmote.ts`) gir ut-overføring første dag og retur-overføring siste dag i en midlertidig periode eller byggeplass-periode, fra hjemstedet (stedet `løsOppmote` gir uten perioden; ingen overføring når det er `ikkeValgt` eller samme kontor). `byggOverforingOppslag` (`packages/shared/src/utils/oppmote.ts`, re-eksportert fra `apps/mobile/src/utils/dagsforslag.ts` — delt med web) slår opp kjøretid i `OppmotestedAvstand` (kontor↔kontor, lokal tabell `oppmotested_avstand_local`) eller matrisen (kontor→byggeplass, med kontekst-byggeplassen; uten den er byggeplassen ikke valgt → `mangler_matrise`). `leggTilOverforinger` legger en egen rad i Bekreft dag: ut slutter ved dagens start, retur starter ved dagens slutt, lengde = kjøretid. Klassifisert via `klassifiserManuellReise`: over terskel = reise-art med `reiseKilde="overforing"`, `reiseOppmotestedId` = kontoret det kjøres fra og `reiseRegel.overforing` (destinasjon + `periodeId`); under terskel = ordinær rad (beholder `reiseRegel.overforing`). Hoppes over ved midnattskryssing, overlapp med eksisterende rad eller dag uten rader. Aldri automatisk rad: Bekreft dag viser «Overføring Narvik → Tromsø …» med Fjern/Angre (`retting.perDato[dato].fjernOverforing`). Redigeres raden senere, blir den `manuell` og sporet forsvinner (`radLagring.ts`). Server (C2, `reise-sporbarhet.ts`) kontrollerer at kontorene tilhører firmaet og at kjøretiden stemmer med `OppmotestedAvstand`/matrisen. Test: `dagsforslag.test.ts` § overføring (inkl. koblingen gjennom `beregnDagsforslag`: forslagsraden og årsaken `mangler_reise_lonnsart` når frem), `dagsforslagInput.test.ts` (byggeplass-periode på dagens prosjekt → ingen reise, selv med GPS-start på kontor), `oppmote.test.ts`, `reise-sporbarhet.test.ts`.
> - **Reise-kortet på mobil (§ 7 C, beslutning 2, 3, 7):** «+ Reise» åpner `ReiseKort` (`apps/mobile/src/components/timer-detalj/ReiseKort.tsx`) i stedet for `TimerRadModal` med `reise.laast`, i prosjektkortets dag-seksjon (`prosjektkort/DagSeksjon.tsx`) og i Bekreft dag manuell modus (`app/timer/bekreft-dag.tsx`). Kortet viser Til byggeplass / Fra byggeplass, oppmøtestedet som tekst (`timer.reiseKort.fraOppmotested`, bare når firmaet har flere), byggeplass-valg når prosjektet har flere, én resultatlinje («07:10–07:50 · 40 min kjøring» + grå forklaringslinje) og underprosjekt. Aktivitet settes fra sedelen/forslaget; maskin og beskrivelse finnes ikke. Hooken `useManuellReise` løser oppmøtestedet med `løsOppmote` på sedelens dato (perioder fra `hentOppmotePerioderLokalt`) og regner med `løsReiseKort` / `løsOverforingKort`. Lagre er sperret via `KnappMedForklaring` når resultatet har en sperre (`timer.reiseKort.sperre.*`, `manglerArt` → `timer.reiseTerskel.manglerArt`) eller aktivitet mangler; sperreårsaken står også som rød tekst i kortet (gate (32) vilkår 1, kildetekst-vakt i `manuellReise.test.ts`). I prosjektkortet tilbyr kortet også overføringen første/siste dag i perioden (`hentOverforingOppslagLokalt`, `apps/mobile/src/services/overforingOppslag.ts`, forhåndsvalgt; retninger sedelen alt har en overføringsrad for skjules); Bekreft dag har den som forslagsrad og viser den ikke i kortet. Sporet lagres med retning og kjøretid (`settInnTimerRad`, `leggTilManuellReise`). Eksisterende reise-rader redigeres fortsatt i `TimerRadModal` (`reise={{ lonnsartId }}`, valgfri art). «Siste valg på enheten» er fjernet (`reiseOppmotestedLagring.ts` slettet). Test: `manuellReise.test.ts`, `forklaringTekst.test.ts`, vakt `dagskort-isolert-vakt.test.ts` (`ReiseKort` aldri i dagskortet).
> - **Reise-kortet på web (§ 7 C, commit 8):** ⚠️ § 8.22 (🟡 `feat/web-timer-forenkle`): overføringsforslaget, `løsOverforingKort`, `byggOverforingOppslag` og `hentKontorAvstanderForFirma` er tatt ut av web-kortet (§ «Reisens kort uten særregler»). Sto slik: «+ Reise» i prosjektkortet (`apps/web/src/app/dashbord/timer/[id]/page.tsx`) åpner `ReiseKort` (`apps/web/src/app/dashbord/timer/[id]/ReiseKort.tsx`) i stedet for `TimerRadDialog` med låst reise-art — samme kort som mobil: Til byggeplass / Fra byggeplass, overføringen første/siste dag i perioden (forhåndsvalgt; retninger sedelen alt har en `reiseKilde="overforing"`-rad for skjules), «Fra {navn}» bare ved flere oppmøtesteder, byggeplass, resultatlinje, underprosjekt. `useManuellReiseWeb` (`apps/web/src/hooks/useManuellReiseWeb.ts`) henter seks oppslag (defaults, oppmøtesteder, matrise, `hentKontorAvstanderForFirma`, `oppmotePeriode.hentMine`, lønnsarter) og kaller de delte `løsOppmote`, `byggOverforingOppslag`, `løsReiseKort`/`løsOverforingKort`; `localStorage`-valget er fjernet (beslutning 7). Lagre sperres (`KnappMedForklaring`) til `regelStatus` er `klar`, ved sperre eller manglende aktivitet; sperreårsaken (`timer.reiseKort.sperre.*`) vises i tillegg som rød tekst i kortet, siden tooltipen ikke når berøringsskjerm. Mangler art: firmaadmin får lenke til `/dashbord/firma/innstillinger#reise-regelsett`. Raden sendes med `pauseMin: 0` og sedelens aktivitet. Eksisterende reise-rader redigeres fortsatt i `TimerRadDialog`. **Server:** `tilfoyTimerRad` (`apps/api/src/routes/timer/dagsseddel.ts`) tar valgfrie sporfelt (`reiseKilde` `manuell`/`overforing`, retning, oppmøtested, kjøretid, avstand, `reiseRegel`); sporet lagres kun med kilde på en reise-art og valideres med samme `byggReiseFelterForSynk` som synken (oppmøtestedet må høre til sedelens firma, C2/C3) — brudd → BAD_REQUEST, ingen rad; uten kilde nulles sporet. Kjent begrensning: `hentMine` gir innlogget brukers perioder, så en leder som fører på en annens sedel får sine egne perioder. Test: `reise-terskel-dialog.test.tsx` (web; rød sperretekst i kortet, firmaadmin får `manglerStandardArt` i tooltipen), `reise-kort-web-spor.test.ts` (api; negativkontroll: svekket firmasjekk → 1 rød; prosjekt i annet firma → FORBIDDEN, ingen rad).
> - **Kontor↔kontor-avstand (beslutning 4):** `recomputeKontorAvstand` (`apps/api/src/services/reisetidMatrise.ts`) beregner alle kontorpar via OSRM (par normalisert `fra < til`) og kjøres av `recomputeMatrise({organizationId})`. Manuell overstyring: `oppmotested.oppdaterKontorAvstand` / `tilbakestillKontorAvstand`; lesing `hentKontorAvstanderForFirma`. Web: seksjonen «Mellom oppmøtesteder» i Avstander-fanen (`AvstanderFane.tsx`, `KontorAvstander`) når firmaet har ≥ 2 oppmøtesteder. Test: `reisetidMatrise-kontor.test.ts`, `avstander-kjoretid.test.tsx`.
> - **(POST 2026-11-15 (16) punkt 3–4, ✅ merget `0ec0cc0c`)**
>   - **«Rett avstand» kontor↔kontor viser både km og kjøretid**, forhåndsutfylt fra raden (`kontorAvstandStartverdier`). Begge sendes til `oppdaterKontorAvstand` med kilde `manuell` (`tolkKontorAvstand`, `apps/web/src/lib/kontorAvstandSkjema.ts`). Begge må være > 0, og komma godtas som desimaltegn. Dialogen for byggeplass er uendret. Test: `kontorAvstandSkjema.test.ts`.
>   - **Manglende kontor-par beregnes automatisk** av `fyllManglendeKontorAvstander(organizationId)` (`reisetidMatrise.ts`). Funksjonen awaites i lesestiene `oppmotested.hentAvstander` (fanen Avstander) og `oppmotested.hentKontorAvstanderForFirma` (web-reisekortet og mobil-cachen). Firmaer som hadde kontorer før L2, fylles altså første gang noen i firmaet leser. Den kaller `recomputeKontorAvstand({kunManglende: true})`, som hopper over alle par som har en rad uansett kilde (manuell, osrm, -1). Upserten har tom `update` i denne modusen: fyllingen oppretter bare, oppdaterer aldri. En manuell verdi som lagres mens OSRM regner (opptil 8 s), står derfor urørt (RETUR (16) vilkår 1; test «race» i `reisetidMatrise-kontor.test.ts`). Den gamle `recomputeKontorAvstand` uten `kunManglende` har samme vindu fra før. Det er meldt som funn og ikke endret.
>   - **Kostnad:** to små spørringer pr. lesing (kontorer + eksisterende par). OSRM kalles bare når et par mangler, og da med ett `/table`-kall for hele firmaet. Etter et OSRM-forsøk venter firmaet `KONTOR_FYLL_PAUSE_MS` (10 min, i minnet pr. API-prosess) før neste forsøk, så OSRM nede ikke gjør hver lesing treg. Feil kastes aldri videre.
>   - **OSRM-feil:** ingen rad skrives, som før. Fanen viser «Ikke beregnet» for paret (`!c`-grenen i `KontorAvstander`). Test: `reisetidMatrise-kontor.test.ts` § fyllManglendeKontorAvstander.

#### Reisekjede og retting i Bekreft dag (ordre 2026-11-15 (17), Kenneth-vedtak 2026-11-15)

> **✅ Merget `22948f5c` (2026-11-15, Kontrollør GODKJENT GATE (41) @ `0539df71`). Ikke deployet.**
>
> - **Kjeden:** overføring → reise til byggeplass → arbeid → reise fra byggeplass → overføring tilbake. `sekvenserReisekjede` (`packages/shared/src/utils/reiseKjede.ts`) legger kortene etter hverandre uten overlapp. Uten retting står arbeidsstart/-slutt fast; reisene legges bakover og returen framover. Reisekort har fast lengde (kjøretid) til de rettes. Arbeid er elastisk. Kalles fra `sekvenserDag` i `apps/mobile/src/utils/dagsforslag.ts` (`beregnDagsforslag`). Test: `reiseKjede.test.ts`, `dagsforslag.test.ts`.
> - **Ankring:** rettet kort er fast punkt. Beregnede naboer flytter seg, rettede naboer står. Retting lagres i `retting.perDato[dato].reiseTid[kjedeNokkel]` (reisekort) og `arbeidFra` (ankomst). Lagrede rader på dager med Avslutt røres ikke.
> - **Retting i kortet:** hver linje (`KjedeLinje`, `apps/mobile/app/timer/bekreft-dag.tsx`) lyder «Reise X → Y 06:30–07:00 · 30 min» eller «Overføring X → Y …», og tidene rettes med ett trykk i et kompakt tidsfelt (`FraTilTidFelt kompakt`, standard `false` — dagskortet sender den aldri, vakt i `dagskort-isolert-vakt.test.ts`). Rettet kort merkes «Rettet» med Angre.
> - **Ankomst:** linja «Ankomst» viser beregnet tid og, når den finnes, målt tid fra dagens bekreftede besøk (`maaltAnkomst`, `apps/mobile/src/utils/maaltArbeidstid.ts`, kilde `arbeidsdag_besok_local`). Arbeideren velger med ett trykk; standard er beregnet. Kilden vises («Ankommet» for `gps_forslag`). PSI er ikke kilde (egen ordre ⏳). **Målt avreise finnes ikke:** `avreiseAt` er neste stopps ankomst. Test: `maaltArbeidstid.test.ts`.
> - **Konflikt i kjeden:** `DagsforslagDag.kjedeKonflikt` (`overlapp` | `overMidnatt`) vises som begrunnelse i kortet, og «Bekreft og lagre» sperres via `bekreftSperre` = `"kjedeKonflikt"` (knappen er ikke deaktivert; den forklarer, jf. vakten «knappen er ikke stum»).
> - **Overlapp mellom lagrede rader:** `finnOverlappVarsel` (`packages/shared/src/utils/tidsromValidering.ts`) gir første overlapp. Mobil viser amber varsel under «Dagen» i prosjektkortets `DagSeksjon.tsx`; web viser det i prosjektkort-modus på `apps/web/src/app/dashbord/timer/[id]/page.tsx` (dagskortet er urørt). Rader som før ble droppet stille, vises med varsel. Test: `tidsromValidering.test.ts`.
> - **Periode-cache:** `useOppmotePeriodeVersjon` / `bumpOppmotePeriodeVersjon` (`apps/mobile/src/services/oppmotePeriodeKatalog.ts`) varsler Bekreft dag og reise-kortet når perioder skrives eller en overføring registreres, så kjeden regnes på nytt uten egen omlasting.
> - **Ordlyd:** knappene i reise-kortet heter «Til byggeplass» / «Fra byggeplass» (`timer.reiseKort.tur` / `.retur`), samkjørt med Bekreft dag (`timer.bekreftDag.reiseUt` / `.reiseRetur`).
> - **Ikke med:** bakgrunns-geofence (kjeden kan ta kilden senere), P2-funnene, UTC-dato utenfor skjema.

#### Midlertidig oppmøtested via overføring (POST 2026-11-15 (13) del B)

> **🟡 Levert på `feat/oppmote-overforing` (venter Kontrollør-gate, ikke merget).** Migrasjon `20261115130000_oppmote_overforing` kjøres av Kenneth.
>
> - ⚠️ **Web etter § 8.22 (🟡 `feat/web-timer-forenkle`):** valget heter «Fra et annet kontor fra i dag» ved oppmøtestedet; reisen er en vanlig reise (§ «Reisens kort uten særregler»). Mobilen er uendret.
> - **Hva:** den ansatte setter selv et midlertidig kontor ved å føre reisen dit. «Overføring til annet kontor» i reise-kortet (web + mobil) vises når firmaet har ≥ 2 aktive kontorer og dagen ikke er en byggeplass-periode eller `ikkeValgt` (`kontorOverforingOppsett`, `packages/shared/src/utils/oppmote.ts`). Knappene «Til {navn}» lister de andre kontorene; valg av eget faste kontor er hjemreisen (`kontorOverforingRetning` → retur). Reisen regnes med `løsOverforingKort` og kontor↔kontor-avstanden.
> - **Én regel, tre steder (`planleggOverforing`):** server, mobil (optimistisk) og web (forhåndssjekk) kaller samme rene funksjon. Rører KUN egen åpen periode med `kilde='overforing'`; fast sted og admin-perioder står. Tur til nytt kontor lukker åpen overføring dagen før (slettes om den da blir tom) og åpner ny; tur til samme kontor = ingen endring; tur hjem til fast kontor lukker overføringen dagen før; «slutt» lukker på datoen (slettes om datoen er før start). Åpen admin-satt midlertidig periode → `konflikt` (serveren vinner; kortet sperrer Lagre med `timer.reiseKort.sperre.adminMidlertidig`).
> - **Kl. 12-regelen (`periodeDatoFraOverforing`):** Tur før 12:00 → perioden starter samme dag, ellers dagen etter; Retur før 12:00 → slutter dagen før, ellers samme dag. Klienten regner datoen; serveren bruker den som gitt.
> - **Ingen automatisk sletting:** åpne overføringer står til den ansatte fører hjemreisen eller trykker «Avslutt». Kortlinjen «Midlertidig: {kontor} fra dd.mm · Avslutt» (`timer.reiseKort.midlertidigLinje`) avslutter uten modal (lukker dagen før, eller sletter perioden om den startet samme dag).
> - **Server (`oppmotePeriode.overforing`, `apps/api/src/routes/oppmotePeriode.ts`):** `hentEgetMedlem` (kun eget medlemskap), oppmøtestedet må være aktivt og i eget firma (ellers NOT_FOUND), idempotent på klientens `id` (samme id to ganger → ingen ny rad), plan-konflikt og overlapp mot andre perioder (`finnPeriodeKonflikt`) → CONFLICT uten skriving. Returnerer `{utfall, periode}`. Admin-`opprett` som overlapper en åpen overføring → CONFLICT. Test: `oppmotePeriode.test.ts` (i)–(vii-b), alle drept av mutant.
> - **Mobil:** `registrerOverforing` (`apps/mobile/src/services/oppmoteOverforing.ts`) skriver planen optimistisk i `oppmote_periode_local` og legger kallet i `oppmote_overforing_ko` (kø-id = periodens id). `sendOverforingKo` kjøres av `TimerSyncProvider` etter `syncTimer` + `syncVareforbruk`; suksess og permanent avvisning (CONFLICT/NOT_FOUND/FORBIDDEN/BAD_REQUEST) fjerner kallet, nettfeil lar køen stå og stopper resten; deretter overskriver refresh lokal cache (serveren vinner). Test: `oppmoteOverforing.test.ts`, `migreringer.oppmoteOverforing.test.ts`.
> - **Web:** `ReiseKort.tsx` kaller `overforing` før raden lagres og setter periode-id-en i sporet (`medOverforingPeriodeId`); feil → ingen rad. Firmaadmin ser «via overføring» på perioden (`OppmotePerioder.tsx`), og åpne perioder vises som «fra DATO».
> - **Retur-forslag:** `finnOverforinger` foreslår aldri «ut» for en `kilde='overforing'`-periode (Tur-raden opprettet den); retur foreslås når `tilDato` er satt, og duplikat stoppes av eksisterende overføringsrad.

> **✅ Fase 1 implementert (2026-06-08, develop/test):** `Oppmotested`-entitet (kjerne) + `oppmotestedRouter` (firma-admin CRUD + member-lesbar `hentForFirma`) + web firmainnstillinger-side (`/dashbord/firma/oppmotesteder`, manuell lat/lng + adresse-geokoding + Leaflet-kartvelger lagt til i R2) + mobil `oppmotested_local`-cache + GPS-identifikasjon i «Start dag» (Haversine mot geofence-radius, lagrer identifisert oppmøtested på `arbeidsdag_local` som dokumentasjon, aldri auto-rad). Migrasjon `20260608120000_oppmotested_fase1` (additiv).

> **✅ Fase 3 implementert (2026-06-09, develop/test — venter dual-review):** Reise-regelsett som firmainnstilling på `OrganizationSetting` (migrasjon `20260609160000_reise_regelsett_fase3`, additiv): `reiseTerskelMin` (30), `reiseUnderTerskelType` ('arbeidstid'), `reiseOverTerskelType` ('reisetid'), `reisetidTellerOvertid` (false), `reiseLonnsartId` (svak FK → `timer.Lonnsart`, A.20). Delt klassifisering `klassifiserReise` + `estimerReisetidMin` + eksportert `avstandMeter` i `@sitedoc/shared`. Setting-API: `oppdaterSetting` (org-validerer `reiseLonnsartId`) + `hentArbeidstidDefaults` (member-lesbar, mobil-cache). Web: «Reise»-seksjon i `/dashbord/firma/innstillinger`. Mobil: setting-cache utvidet + reise-forslag i «Slutt dag» (`StartSluttDagKort.genererForslag`) — KUN når oppmøtested ble identifisert (kontor→byggeplass), GPS-distanse start→slutt, **estimert** reisetid (MVP, GPS-faktisk-tid senere), klassifisert mot terskel; 'reisetid' → egen reise-lønnsart-rad. **`reisetidTellerOvertid` styrer om reise spiser av dagsnorm-terskelen** (jf. auto-fordeling-koordinering under). Alt forslag i draft — arbeider justerer, aldri auto-rad. **Byggeplass-GPS på mobil = senere (1c-mobil); reise-distanse bruker start/slutt-GPS + `Project.lat/lng`-MVP.**

> **🟢 Avstandsbånd → reise-lønnsart (2026-09-11, `feat/reise-avstandsband`, Kenneth-gate — server+web+shared):** Terskelen (over) svarer *arbeidstid vs reisetid*; båndene svarer **hvilken** reise-lønnsart. Målt på test 07.09: fem arter matcher `/reise|transport/i` («Reise 7,5–15 km» … «45–60 km» + «Reise/transport til prosjekter») → `find()` uten `orderBy` plukket vilkårlig = feil lønn. Løst med **grensepunkter** (ikke intervaller, Kenneth-vedtak): tabell `OrganizationReiseGrense (organizationId, grenseM, lonnsartId?)`, `UNIQUE(orgId, grenseM)` → overlapp strukturelt umulig (ingen btree_gist). Hull = `lonnsartId null`. Migrering `20260911120000_reise_avstandsgrenser` (additiv, **Kenneth kjører**). Delt `løsReiseLonnsartId(avstandM, grensepunkter, fallback)` i `@sitedoc/shared` (høyeste `grenseM ≤ avstandM`; hull/under laveste/`avstandM null|<0`/ingen bånd → fallback). API: `settReiseGrensepunkter` (replace-all, art-validering, dup-avvisning) + `hentSetting` returnerer grensene. Web: bånd-editor i `firma/innstillinger` + varsel-demping når bånd finnes. **Presedens: bånd slår `reiseLonnsartId` når avstand finnes.** Firma uten bånd uendret på alle flater (regresjonstest i `reise.test.ts`).

> **🟢 Avstandsbånd VIRKER PÅ MOBIL (2026-09-11, `feat/mobil-avstandsband`, OTA — mobil+api):** Serveren var ferdig forrige runde, men mobilen kalte den ikke → 20 km-reise havnet på generell reise-art, ikke båndet (traff lønnsgrunnlaget). Lukket: (1) `hentArbeidstidDefaults` utvidet med `reiseGrenser` (`{grenseM, lonnsartId}`, `grenseM asc`) — member-lesbart subset, IKKE firma-admin-`hentSetting`; tilgangsflaten uendret (grense = avstand + lønnsart-id, arbeideren ser allerede begge). (2) Ny `reiseGrensepunktKatalog.ts` (`refreshReiseGrensepunktKatalog` + `hentReiseGrensepunkterLokalt`) speiler `organizationSettingKatalog`-mønsteret, registrert i `TimerSyncProvider` steg 2; fyller `reise_grensepunkt_local` (komposit-PK, delete+insert). (3) `hentReiseLonnsartId(orgId, avstandM?)` — valgfritt 2. arg; oppgitt → `løsReiseLonnsartId(avstandM, grensepunkter, fallback)`, utelatt → uendret (prioritet `reiseLonnsartId`→navne-match). `StartSluttDagKort.tsx:523` sender `avstandM` (matrise/GPS). `TimerSeksjon.tsx:189` (render/merking) kaller UTEN arg — `sheet_timer_local` bærer ingen avstand (målt), så merkingen er uendret. Server-halvdelen dekket av api-test (`reise-avstandsband-defaults.test.ts`, api +3); resolver-logikken av `shared` `reise.test.ts`. 🔴 **Mobil katalog→resolver-seamen har ingen test-harness i repoet** (arkitekturen skyver testbar logikk til `shared`) — meldt til Kenneth. **Reload: OTA.**

> **🟢 Reise ↔ lønnsart henger sammen i UI (2026-09-11, `fix/reise-lonnsart-sammenheng`, ren web+i18n — ingen logikk):** Kenneth så reise-regelsettet uten å se hvilken lønnsart timene faktisk havner på. Tre koblinger, alle i `firma/innstillinger` + `firma/timer/lonnsarter`: **(1)** forklaringslinjer under «Under/Over terskel» — «Som arbeidstid» = vanlige timer på ordinær lønnsart, ingen egen linje; «Som reisetid» = egen linje på reise-lønnsarten. Reise-lønnsart-hjelpen sier nå at feltet kun gjelder «Som reisetid». **(2)** lønnsart-tabellen merker arter reise bruker: solid blå **«Reise»** = wiret (`reiseLonnsartId` ∪ bånd-arter), dempet **«Navnetreff»** KUN når navne-match (`REISE_LONNSART_REGEX`) er aktiv fallback (ingen eksplisitt art + ingen bånd) — merket lyver aldri om aktiv bruk. **(3)** toveis-lenker: reise-lønnsart-feltet → lønnsarter; «Reise»-merket → `firma/innstillinger#reise-regelsett` (nytt id-anker). **Kenneth-gate A: forklar, ikke gi «arbeidstid» en egen art** — ingen ny konfigurasjon, ingen logikk rørt. **Reload: web-deploy.**

> **🟡 R4 implementert (2026-06-11, develop — venter dual-review): oppslag + mobil-cache.** Reise-forslaget i «Slutt dag» (`StartSluttDagKort.genererForslag`) bruker nå **faktisk matrise-kjøretid** i stedet for ×50km/t-estimatet. Flyt: GPS-identifisert kontor (`arbeidsdag_local.oppmotestedId`) → prosjektets **primær-byggeplass** → matrise-oppslag → reisetid. **Primær-byggeplass-regel** (`resolverPrimaerByggeplass`, deterministisk): kandidater = prosjektets byggeplasser med matrise-rad for kontoret (rad-eksistens = koordinat-signal); sortering published først → lavest `number` (null sist) → `id`. **R4-kontrakt:** `kjoretidMin ≥ 0` → faktisk reisetid; `< 0` (uoppnåelig) → ingen forslag (ingen fallback); ingen rad/byggeplass/oppmotestedId → graceful `estimerReisetidMin`-fallback (uendret sti). **Modell (låst):** matrise-kjøretid = autoritativ reisetid, end-uavhengig (start-etappen kontor→byggeplass); `arbeidstimer = total − reisetid` håndterer arbeids-stopp som arbeidstid — formelen uendret, kun verdien som plugges inn på `:371` endret. **Server:** member-lesbare `oppmotested.hentMatriseForFirma` + `bygning.hentForFirma` (firma-scopet). **Mobil-cache:** `reisetid_matrise_local` + `byggeplass_local` (id/projectId/number/status, ingen koord) via `reisetidMatriseKatalog`/`byggeplassKatalog`, refresh i `TimerSyncProvider`. **Reload: EAS/TestFlight** (mobil-endring). Fase 1c-mobil (eksplisitt byggeplass-GPS) forblir egen fase — R4 forward-kompatibel (foretrekker eksplisitt `byggeplassId` over primær-regel når den finnes).

> **🟡 R3 implementert (2026-06-11, develop — venter dual-review): recompute-motor + triggere.** `recomputeMatrise({ organizationId, oppmotestedId?, byggeplassId? })` (`apps/api/src/services/reisetidMatrise.ts`): kolonne (kontor × alle firma-byggeplasser) / rad (alle firma-kontorer × byggeplass) / full backfill. Henter koord, kaller `hentKjoretidMatrise` (R1), upsert mot `@@unique`. **Firma-isolasjon (HARD):** kontorer på `organizationId`, byggeplasser på `project.primaryOrganizationId` — aldri kryssorg-rad. Koordinat-fallback: byggeplass egen → `Project.latitude/longitude` → hopp over. OSRM-batching: destinasjoner i chunks à `90 − antallKontorer`. **Triggere:** `oppmotested.opprett`→kolonne, `oppdater` (kun ved lat/lng-endring)→kolonne, `slett`→FK-Cascade rydder; byggeplass-koord på **begge** skrivesteder (`oppdaterByggeplassGeofence` success-sti + inline `byggeplass.settGeofence`)→rad. **Non-blocking:** triggere er fire-and-forget (`recomputeMatriseIBakgrunn`/`recomputeRadForByggeplass`, selvstendig catch) — lagring venter aldri på OSRM; on-demand «beregn matrise»-knapp (`oppmotested.beregnMatrise`, admin-only) `await`-er. **Stale-rydding:** byggeplass uten koord → slett rader; OSRM-feil → behold (logg). Uoppnåelig par → `kjoretidMin = -1`. Knapp i Reise-seksjonen (`firma/innstillinger`).
>
> **R4-kontrakt (oppslag, ikke implementert ennå):** `kjoretidMin < 0` (uoppnåelig) → **ingen** reise-forslag (ikke fall tilbake til luftlinje-estimat). **Fravær av rad** (aldri beregnet) → live-fallback til `estimerReisetidMin`. `kjoretidMin ≥ 0` → bruk som faktisk reisetid.

> **🟡 R2 implementert (2026-06-11, develop — venter dual-review): kontor-geokoding + kart.** Oppmøtested-registrering kan nå geokode adresse → koordinat via knapp (`oppmotested.geokod`, firma-admin, kaller `geokodAdresse` fra rute-service; null-treff → melding). `OppmotestedModal` (`/dashbord/firma/oppmotesteder`) har «Geokod adresse»-knapp + Leaflet-kartvelger (`KartVelger` utvidet med valgfri `radiusM`-prop → geofence-sirkel) med to-veis felt↔kart; klikk/dra + manuell lat/lng beholdt som override. Lagret verdi = feltene (ingen auto-geokoding i opprett/oppdater). i18n nb+en + 13 auto-språk, hjelpetekst utvidet. **Ingen matrise-rader skrives ennå** (R3 recompute, R4 oppslag).

> **🟡 R1 grunnmur (2026-06-11, develop — venter dual-review): reisetid-matrise.** Erstatter på sikt ×50km/t-estimatet med faktisk forhåndsberegnet kjøretid per [kontor × byggeplass]. R1 legger kun grunnmuren: tabell `ReisetidMatrise` i kjernen (`packages/db`, søsken til `Oppmotested` — geo-infra, ikke modul-tabell) `{ organizationId (denormalisert fra Oppmotested), oppmotestedId (FK Cascade), byggeplassId (FK Cascade), kjoretidMin, kilde, beregnetAt }`, `@@unique([oppmotestedId, byggeplassId])`. Migrasjon `20260611120000_reisetid_matrise` (additiv). `apps/api/src/services/rute-service.ts`: keyless `geokodAdresse` (Nominatim) + `hentKjoretidMatrise` (OSRM `/table`, fler-kontor×fler-byggeplass i ett kall) bak et provider-grensesnitt — public OSM-default, selvhosting via `OSRM_BASE_URL`/`NOMINATIM_BASE_URL` (process.env, rører ingen .env). Alle feil → null (matrise = forslag-cache, aldri kritisk sti). `kilde` v1 skriver kun `"osrm"`; estimat-fallback beregnes live ved oppslag (R4), lagres aldri. **Ingen kallere i R1** — R2 (kontor-geokoding), R3 (recompute-motor + triggere), R4 (oppslag erstatter `estimerReisetidMin` + mobil-cache) kobler på. Forankret BACKLOG `§G:565` (Kenneth 2026-06-09).

- **Oppmøtested = egen geo-entitet** (kjerne, søsken til `Avdeling`): `{ organizationId, navn, adresse?, lat, lng, radiusM, avdelingId?, aktiv }`. A.Markussen: 3 kontorer (Narvik, Harstad, Tromsø). Geofence identifiserer kontor + logger inn/ut som *dokumentasjon* + *foreslår* starttid — aldri auto-rad (`fase-0 T.8:983`).
- **Kompensert reise = kontor→byggeplass + byggeplass→byggeplass.** Hjem→arbeidssted er IKKE kompensert. Reisetid = **lønnsart-rad (ordinær lønn), utenfor overtid** (jf. § Lønnsart-katalog + `:282`). Ingen avstands-/godtgjørelse-sats (regnskap eier satser).
  - 🔴 **Vedtak 2026-10-01 ([helhetsplan § 4b](timer-gps-helhetsplan.md)):** byggeplass→byggeplass i ordinær tid er **arbeidstid**, ikke reisetid (V9) · kategorien reisetid er **aldri** overtid (V1), flagget `reisetidTellerOvertid` utgår (V2) · tur OG retur (V7) · ingen reise når dagen ikke starter på kontor (V11), ingen fallback-estimat (V13).
- **Reise-regelsett = firmainnstilling** (konfigurerbart, ikke regelmotor): `OrganizationSetting` + `reiseTerskelMin` (default 30) / `reiseUnderTerskelType` / `reiseOverTerskelType` / `reisetidTellerOvertid`. `<terskel` → arbeidstid, `>terskel` → reisetid. Terskel + lovlighet er per firmas tariff/avtale, ikke universell lov.
  - **⚠️ Terskel-enhet: TID eller AVSTAND (2026-09-08, `feat/reise-terskel-km`, venter Kenneth-gate på migrering `20260908120000_reise_terskel_km`):** `reiseTerskelEnhet` (`"minutter"` default | `"km"`) + `reiseTerskelM` (meter, aktiv ved km). A.Markussen måler km-grense; andre måler tid. **Default `"minutter"` er bevisst — bevarer klassifisering for alle eksisterende firmaer.** `klassifiserReise` tar nå `ReiseMaaling {reisetidMin, avstandM}` + regelsett med enhet (aldri «et tall uten enhet»). Avstand fra samme OSRM-kall (`annotations=duration,distance`) → `ReisetidMatrise.avstandM` (meter, `-1` = uoppnåelig symmetrisk med `kjoretidMin`). km + manglende/uoppnåelig avstand → konservativ under-type. Bytte til km auto-recomputer matrisen (fire-and-forget); firmainnstillingene varsler «avstand mangler for N par» (`hentSetting.reiseMatriseParUtenAvstand`) når rader ikke er reberegnet. **Automatisk avstandsBÅND-lønnsart er bevisst UTELATT** (Kenneth-vedtak 07.09: firma velger lønnsart eksplisitt).
- **MVP på `Project.latitude/longitude`** (finnes, nullable); byggeplass-GPS er senere arbeid (`T.8:990`).
- ⚠️ **Auto-fordeling normaltid/overtid er IKKE implementert** (§ Auto-fordeling er spec, ikke kode — `:172`). Reise-klassifisering må koordineres med den når den bygges; anta ikke at motoren finnes.

### Ikke-prosjekt-tid (Alt C — § C)

> **✅ Fase 2 implementert (2026-06-09, develop/test — venter dual-review):** `Project.type "kunde"|"internt"` (migrasjon `20260609140000_project_type_fase2`, additiv default "kunde") + `SheetTimer.vehicleId String?` (migrasjon `20260609140100_sheet_timer_vehicle_id_fase2`). Seed av **2 interne prosjekter** per firma («Internt arbeid» + «Verksted/maskinvedlikehold») via `seedInterneProsjekter` (`apps/api/src/services/seed/index.ts`), kalt fra begge timer-onboarding-modus. **Vilkår 3 (Kenneth):** interne prosjekter får ALDRI ProjectModule-rader — `syncProjektModulerPaaAktiver` (`firmamodul.ts`) ekskluderer `type="internt"`; seeden oppretter heller ingen ProjectMember/ProjectOrganization (firma-grense passerer via `primaryOrganizationId`). Tilgang: `type="internt"`-unntak i `verifiserProsjektmedlem` (`tilgangskontroll.ts`, smalt: kun `type="internt"` + OrganizationMember på prosjektets org). Timer-velger: ny `prosjekt.hentForTimer` (union medlemskap + interne for egen org) — kundevendte `hentMine`/`hentAlle` filtrerer interne ut. `vehicleId` settes via maskinvelger i timer-rad-modalen (kun interne prosjekter); **§2.D org-validering** mot `Equipment.organizationId` i `verifiserKjoretoyTilhørerFirma` (`dagsseddel.ts`) på alle skrive-stier (tilfoy/oppdater/syncBatch).

- Internt arbeid + maskinvedlikehold = **interne `Project`-rader** (`Project.type "kunde"|"internt"`, default "kunde"). `projectId` forblir NOT NULL → **T.2 urørt**. 1–2 generiske interne prosjekter per firma, ikke ett per aktivitet. Interne filtreres ut av kundevendte lister, vises i timer-velger. Tilgang: `type="internt"`-unntak i `verifiserProsjektmedlem` (firma-ansatte uten ProjectMember-rad).
- **Dynamisk intern-liste = eksisterende `Aktivitet`** (firma-scoped). Ingen ny katalog-tabell.
- **`SheetTimer.vehicleId String?`** (nytt, svak FK → db-maskin.Equipment) = kostnadsbærer for maskinvedlikehold. **Vedlikehold ≠ drift:** `SheetTimer.vehicleId` (mekaniker-timer *mot* maskin) er distinkt fra `SheetMachine.vehicleId` (drift/maskinfører). Se [maskin.md § Kobling til andre moduler](maskin.md).
- Maskinkost-fordeling = regnskap/ProAdm, ikke SiteDoc (datamodell holdes åpen; ProAdm utgående eksport finnes ikke i dag).

### Firma-isolasjon + tilgang (§ D / G1)

- **Sikkerhetslag (ufravikelig):** timer-data isoleres på `organizationId` (`DailySheet` org-eid per T.1), ikke `projectId`. Et firma ser kun egne timer — aldri prosjekteiers/annet firmas, selv på delte prosjekter. Forankring: SHA/arbeidsgiver-rapportering.
- ⚠️ **KJENT ISSUE (ikke fikset):** `rapport.ts:80-92` filtrerer sedler kun på `projectId ∈ firmaets prosjekter`, **uten** `organizationId`-filter → cross-firma-lekkasje på delte prosjekter. `tilfoyTimerRad` mangler firma-grense-sjekk på rad-`projectId`. Fikses i SPOR 3 Fase 1b (se [BACKLOG.md](BACKLOG.md)).
- **Forretningslag (G1):** firma-nivå tilgang — aktiv firma-ansatt kan føre mot et hvilket som helst av firmaets prosjekter (hard ProjectMember-gate faller for eget firma; `timerTilgangDefault='alle-ansatte'`). Kostnadskontroll ligger i attesteringen, ikke velgeren. GPS = friksjonsfjerner (smart, prioriterende velger), ikke hard port.

## Auto-generering av dagsseddel (Slice 3/4 — deployet prod 2026-06-21, server)

> 🟢 **Live atferd (server prod-deployet `32b88bd7`; mobil-UI når arbeidere først ved EAS prod-bygg).** Konsolidert fra redesign-funn-doken + BACKLOG. Implementasjon: `apps/mobile/src/components/StartSluttDagKort.tsx` («Slutt dag» → `/timer/bekreft-dag` + `gjenopprettGlemtDag`), `apps/mobile/src/services/dagsforslagInput.ts` (`samleDagsforslagInput` = lese-fase, flyttet ut i L3-A), `apps/mobile/app/timer/bekreft-dag.tsx` + `utils/bekreftDag.ts` (bekreft-skjermen), den rene `beregnDagsforslag` i `utils/dagsforslag.ts`, skrivingen i `utils/dagsforslagAnvend.ts` (`anvendDagsforslag`), `utils/dagsegment.ts`, attestering-UI (`AttesteringDetalj.tsx` web + `AttesteringDetaljMobil.tsx`).

> 🟢 **LAG 0b — utregning skilt fra skriving (2026-10-02, `fix/mobil-splitt-dagsforslag`, OTA).** `genererForslag` SKREV som sideeffekt (`opprettDagsseddelForSegment` → `finnEllerOpprettDagsseddel` + `db.insert`), og «Slutt dag» markerte arbeidsdagen `avsluttet` FØR utfallet var kjent. Splittet i tre: **`beregnDagsforslag`** (`utils/dagsforslag.ts`) — 🟢 REN, all utregning, null DB, fullt testbar uten RN/DB (`dagsforslag.test.ts`, 6 karakteriseringscase) · **`anvendDagsforslag`** (`utils/dagsforslagAnvend.ts`) — eksisterende persistering, kjører kun når noe skrives · **`samleDagsforslagInput`** (komponenten) — lese-fasen, flyttes ut ved bekreftelsesskjermen (LAG 3). 🔴 **NULL atferdsendring i utregningen** (reise-unntak, `reisetidTellerOvertid`, luftlinje/50, `prosjekter[0]`-fallback, nærmeste uten grense bevart 1:1). Plan: `timer-gps-helhetsplan.md` LAG 0.

> 🟢 **H7 — «avsluttet» settes kun når skrivingen lyktes (commit 2).** Rekkefølge-logikken er trukket ut av `useCallback` til ren, injiserbar `avgjorSluttDagHandling`/`skalMarkereAvsluttet` (`utils/dagsforslag.ts`, testbar uten RN). Fire utfall, tre regler: **suksess/playVek/forKort** → dagen lukkes (som før) · **`blokkertSendt`** → dagen står ÅPEN (økta kunne ikke appendes på en sendt sedel; lederen returnerer → draft → appendbar) · **`kildeManglet`** (`startSheetId == null`, db/prosjekt/aktivitet manglet) → dagen står ÅPEN + NY melding (`timer.kildeManglet.*`, 15 språk) — i dag ble dagen stumt markert avsluttet uten sedel. H7-testene er rød-først mot dagens rekkefølge (`dagsforslag.test.ts`). Manuell-fallbacken for `kildeManglet` via `StartSluttDagKort` `onNyRad` er **fjernet i L3-A (A5)** — bekreft-skjermen viser rødt «Velg prosjekt» i stedet (propen står i signaturen, ubrukt).
>
> 🟢 **Ikke ansatt / mangler lønnsart (ordre 2026-11-04 (8)).** Rekkefølgen i `avgjorSluttDagHandling` er nå: **`ikkeAnsatt`** → `prosjektUkjent`/`kildeManglet` (null sedel) → `blokkertSendt` → `playVek` → **`manglerLonnsart`** (`ingenRader && manglerLonnsart`) → `forKort` → `suksess`. `ikkeAnsatt`: `anvendDagsforslag` får `ctx.erAnsatt` (fra `FirmaKontekst`, ellers `hentLagretAnsattStatus`) og returnerer ved `false` FØR noen sedel skrives — dagen står ÅPEN, Alert `timer.ikkeAnsatt`, ingen navigasjon. `null` (ukjent, f.eks. eldre API) = dagens atferd; serverens `verifiserAnsattIFirma` er fortsatt porten. Kilden er `organisasjon.hentMineMedlemskap` → `erAnsatt` per firma (aktiv `OrganizationMember`, ingen admin-bypass), persistert lokalt (`sitedoc_ansatt_firmaer`) for offline. `manglerLonnsart`: forslagsmotoren teller arbeidsrader droppet uten lønnsart (`raderDroppetUtenLonnsart`; drop-atferden uendret) — 0 rader av den grunn gir «Mangler lønnsart» i stedet for «for kort»; dagen lukkes og sedelen åpnes med (d)-banneret. Tester: `dagsforslag.test.ts`, `dagsforslagAnvend.lag2.test.ts`, `FirmaKontekst.test.ts`, `organisasjon-ansatt.test.ts`.

> 🟢 **L3-A — «Bekreft dag» (`feat/timer-bekreft-dag`, ORDRE 30, ⚠️ venter Kontrollør-gate, OTA).** G1 (Kenneth 2026-11-06): GPS gir FORSLAG, aldri lønnsgrunnlag før arbeideren bekrefter. «Slutt dag» (`StartSluttDagKort.utforSluttDag`) fanger slutt-GPS, henter fersk norm og åpner `/timer/bekreft-dag` (`app/timer/bekreft-dag.tsx`) — ingenting skrives, Alert «Slutt dag?» er fjernet (skjermen *er* bekreftelsen). Skjermen kjører lese-fasen `forberedBekreftDag` (`utils/bekreftDag.ts` → `samleDagsforslagInput` + `beregnDagsforslag`) på nytt ved hver retting: prosjekt (rødt «Velg prosjekt» ved `prosjektUkjent`/`kildeManglet`, A5) · byggeplass (bytte = ny lese-fase, A2) · aktivitet · pr. dato fra/til (= arbeidsvinduet; reisen forankres i endepunktene, reisereglene urørt — A1) · pause ±15 min · fjern/angre arbeid (reiseradene står, K12 a). Rettingene går inn i den rene motoren som `input.retting` (`DagsforslagRetting`, `rettSegmentVindu`/`fjernArbeid` i `utils/dagsforslag.ts`); uten retting er utdata identisk. **[Bekreft og lagre]** = `bekreftDag` → `anvendDagsforslag` + samme `avgjorSluttDagHandling`-utfall som før. **[Ikke nå]** = dagen står `paagaar`. Tomt forslag (ingen katalog/rader) → [Avslutt dag] = `avsluttDagUtenSedel` (K14 a). **A4 vedtatt Kenneth 2026-11-07 («behold») — H7 beholdt og isolert:** alle datoer sendt → lesemodus «Dagen er alt sendt — ingenting opprettes» + lenke til sedelen + [Lukk]; dagen står ÅPEN, ingen rader (`erAlleDatoerSendt`, `blokkertSendt`). Tester: `bekreftDag.test.ts` (ekte SQLite: 0 skrivinger før Bekreft, retting slår gjennom, sendt-grenen, tomt forslag, kildevakt), `dagsforslag.retting.test.ts`.

> ⚠️ **L3-A runde 2 (`feat/bekreft-dag-runde2`, ORDRE 34, venter Kontrollør-gate).** (1) Maskin i «Maskin og varer» (`BekreftDagTilleggSeksjon`) registreres kun med timer — mengde/enhet er fjernet her (`nyTilleggMaskin` gir `null`); prosjektkortets `MaskinSeksjon` beholder dem. (2) Varevelgeren (`KortVareforbrukModal`) får `forblirApen`: etter lagring tømmes feltet for neste vare i stedet for å lukke (`vareModalEtterLagre`), med «Ført i dag»-liste (`fortIDagLinjer` + `hentLokaleVarelinjerForDag`) og knappen «Ferdig». Standard `forblirApen = false` = dagens atferd (prosjektkortet). (3) `anvendDagsforslag` kaller `synkHodePauseLokalt` etter rad-innsetting — hode-pausen følger Σ rad-pause også når en eksisterende sedel får nye rader. (4) Overtid: trykk på overtidsmerket åpner «Overtid fra» (−/+ i tidsrunding-steg, `stegOvertidFra`) og «Nivå» (aktive lønnsarter med overtidsnivå); motoren splitter ved `retting.datoer[].overtidFra` (`segmenterVedOvertidFra`) og godtar kun overtids-lønnsart (`godtattOvertidLonnsart`). Dagskortet (`app/timer/[id].tsx`) er urørt — vakt `dagskort-isolert-vakt.test.ts` m/ negativkontroll. Tester: `dagsforslag.retting.test.ts`, `dagsforslagAnvend.lag2.test.ts`, `vareforbrukSync.test.ts`, `bekreftDagTillegg.test.ts`.

> ⚠️ **ORDRE 35 (`feat/prosjektkort-isolert`, venter Kontrollør-gate).** (1) **«Legg til overtid»** (`timer.bekreftDag.overtidLeggTil`) vises i `bekreft-dag.tsx` når datoen har 0 overtid og firmaet har aktive overtids-lønnsarter; trykk setter `overtidFra` = dagens fra-tid og åpner overtidsredigeringen. Retting fra `leggTilOvertidRetting`: nivået følger standardvalget (OT50); har firmaet ikke OT50, settes første nivå-valg (`overtidLonnsartId`), så arbeidsradene ikke droppes som «mangler lønnsart». Editoren («Overtid fra» og nivå-chips) vises når `overtidFra` er rettet, også uten overtidsrad (`overtidEditorFra`). (2) `stegOvertidFra` (`utils/dagsforslag.ts`): «+» tillates helt til `til`; overtid fra = til gir 0 t overtid, merket forsvinner og «Legg til overtid» kommer tilbake. Starten flytter aldri bakover (− fra en verdi under normal-grensen ble tidligere løftet). (3) `hentLokaleVarelinjerForDag` (`services/vareforbrukSync.ts`) skjuler avviste linjer (`syncStatus ≠ "avvist"`) i «Ført i dag». Tester: `dagsforslag.retting.test.ts` (C1/C2/del B, kun-OT100), `vareforbrukSync.test.ts` (C3); vakter for at `aapnetEksisterende` følger redirecten og gir notisen på prosjektkort-skjermen.

> 🟡 `fix/kort-a-overtid-dagskort` (ORDRE 27b, 2026-11-16, ikke merget) **V5a — overtid av/på med samme knapp** (spec `prosjektkort-kortid-spec.md` § 6 V5a). Nivå-chipene under overtidsredigeringen i `bekreft-dag.tsx` går via `vekslOvertidNivaa` (`utils/dagsforslag.ts`): trykk på valgt (blått) nivå setter `overtidAv` i rettingen → `beregnSegment` gir all tid som normaltid (standard-lønnsart), «Overtid fra» skjules, og forrige «Overtid fra» huskes i rettingen. Trykk på et hvitt nivå mens overtiden er av velger nivået og legger overtiden tilbake fra forrige «Overtid fra», ellers fra arbeidsstart. «+ Legg til overtid» vises ikke mens overtiden er slått av med nivå-knappen. Tester: `manuellDag.test.ts` («ORDRE (27b) V5a», kort 19–20 → én gang blå → 1 t Timelønn → igjen → Overtid 50 %; negativkontroll), kildevakt i `dagsoversiktRader.test.ts`.

> 🟡 `fix/kort-a3-lonnsart-linje` (ORDRE (28), 2026-11-16, ikke merget) **Lønnsart pr. linje før lagring** (spec `prosjektkort-kortid-spec.md` § 6.1 V1–V8, ordre a3). Kenneth: *«jeg syns det er feil å opprette et prosjektkort først, for så å redigere kortet til å endre lønnsart».* Bekreft dag (GPS og manuelt kort fra «+»/«+ Nytt prosjektkort») viser hver arbeidslinje under fra/til: «07:00–15:00 · 7,5 t · Timelønn ▾» (`ArbeidLinjer` i `app/timer/bekreft-dag.tsx`, `timer.bekreftDag.linje`). Trykk åpner valget: chips gruppert Ordinær · Overtid · Fravær når firmaet har ≤ 6 aktuelle arter (`MAKS_LINJE_CHIPS`), ellers `LonnsartVelgerModal` med `kandidatIder` (gruppert liste). Aktuelle arter (`lonnsarterForLinje`, `apps/mobile/src/utils/linjeLonnsart.ts`): firmaets aktive `ordinaer` (med og uten overtidsnivå) og `fravaer` (V4-⚠️); reise-arter (`erReiseLonnsartLokalt`), feriepenger og diett tilbys ikke. Linjen (`DagsforslagRad.linje`: `normal`/`overtid`) er nøkkelen valget huskes på i `DagsforslagRettingDato.lonnsartPerLinje`; `beregnSegment` (`utils/dagsforslag.ts`) lar et godtatt valg (`godtattLinjeLonnsart`: aktiv, i firmaets katalog, ordinær/fravær) vinne over forhåndsvalget. `velgLinjeLonnsart`: overtidsart på overtidslinja går til `overtidLonnsartId` (samme valg som nivå-chipsene, V5 — et nivå-trykk fjerner også et linjevalg på overtidslinja); samme art som naboen gir én linje (`overtidAv`, «Overtid fra» huskes — V6); ellers huskes valget (ordinær art etter normen = overstyring). Overtid-merket og editoren følger overtidslinja også når den står på en ordinær art («Etter normen fra …», `timer.bekreftDag.etterNormen`). Forsvinner en linje når tidene endres, ryddes valget (`ryddLonnsartPerLinje`, effekt i `bekreft-dag.tsx`); utkastet lagrer `retting` som før, så valget følger med. Mangler firmaet arten for en linje, droppes den ikke stille: `DagsforslagDag.linjerUtenLonnsart` viser den amber «Velg lønnsart», og `bekreftSperre` gir `manglerLonnsart` til arbeideren har valgt (`raderDroppetUtenLonnsart` står for Slutt dag-meldingen). Fravær føres foreløpig på kortets prosjekt; fravær uten prosjekt (B6) krever skjemaendring og er ikke bygget. Prosjektkortets rad-vindu (`TimerRadModal`, kun `useProsjektkortModus()`): ny rad forhåndsvelger overtidsarten når datoens arbeid (ikke reise, ikke fravær) alt har brukt normen (`forhaandsvalgNyRad`, V8); dagskort-modus som før. Velgeren viser bare innlogget firmas aktive arter når `organizationId` sendes (F-L2, `filtrerVelgerLonnsarter`) — rad-vinduet og «Del opp» sender det, også i dagskortet. Tester: `linjeLonnsart.test.ts` (T17–T20, B8), `manuellDag.test.ts` («ORDRE (28)»: Kenneths flyt «+» → 08–15 → Egenmelding lagret; T17; T19; B8 7,5 t fravær + 2 t → normaltid; 3 t arbeid + 4,5 t sykdom; negativkontroll), `prosjektkortUtkast.test.ts`, vakter i `dagskort-isolert-vakt.test.ts`.

> 🟡 `fix/kort-a3-lonnsart-linje` (RETUR (28), 2026-11-16, ikke merget) **Fravær på linje frigjør normen i samme kort (spec B9) + reise-art avvist på linje.** Står normallinja på en fravær-art, går fraværet til `DagsforslagRettingDato.fravaerTil` (satt til linjas slutt når fraværet velges, `velgLinjeLonnsart`; annen art på normallinja fjerner punktet). `beregnSegment` (`apps/mobile/src/utils/dagsforslag.ts`) regner så arbeidet etter fraværet på nytt mot den samme normresten med `klassifiserArbeidstid` (`bruktAvNorm`, a2): linja `arbeid` (ny `ArbeidLinje`) er normaltid til normen er brukt, deretter `overtid`. Valgene står på linjene sine (V7); bare tidene på linjene etter flytter, og en linje som forsvinner tar valget med seg (`ryddLonnsartPerLinje`). Mens fraværet deler kortet leses ikke «Overtid fra» (overtiden følger normen), «Overtid fra»-stepperen og «Legg til overtid» skjules, og nivå-knappen «av» (V5a) gir alt arbeid etter fraværet som normaltid. Bekreft dag viser «Fravær til» med −/+ (`timer.bekreftDag.fravaerTil`, `DagsforslagDag.fravaerTil`); naboregelen (V6) gjelder ikke da. Eks. (norm 7,5 t, uten pause): 08–17 med fravær 08–15:30 → 7,5 t fravær + 1,5 t normaltid; 08–19 med fravær 08–10 → 2 t fravær + 7,5 t normaltid + 1,5 t overtid. A1: `godtattLinjeLonnsart` avviser reise-arter (`BeregnDagsforslagInput.reiseLonnsartIder`, resolvert i `samleDagsforslagInput` med `erReiseLonnsart` — konfigurert reise-art, grensepunktartene, navne-match). Rad-vinduets forhåndsvalg (V8) slår opp fravær uten aktiv-filter (`hentFravaerLonnsartIderLokalt`, `services/timerKatalog.ts`). RETUR 2 (28): «Fravær til» klemmes til kortet — tidligst ett tidsrunding-steg (ellers 15 min) etter arbeidsstart — så fraværet aldri blir 0 t, delingen og «Fravær til» står, og en husket «Overtid fra» ikke leses mens fraværet står (`beregnSegment`). Fravær godtas ikke på `arbeid`-linja (faller til standardarten, og velgeren viser ikke fravær der — `arterFor` i `ArbeidLinjer`): da måtte arbeidet etter den regnes om igjen som et nytt fraværsvindu, og a3 har bare ett (fravær midt i kortet er ikke et reelt tilfelle, Kenneth). Mer fravær føres ved å flytte «Fravær til». Fravær på overtidslinja godtas (siste linje, ingenting etter den regnes om). RETUR 3 (28): den nedre grensen er det første steget som gir mer enn 0 t fravær — forbi pausen når den ligger ved arbeidsstart (fastStart-firma, kort 12:30–17, pause 12:30–13 → 13:15). Hele kortet blir fravær bare når intet punkt før kortets slutt gir fravær. Stepperen tar punktene fra beregningen (`DagsforslagDag.fravaerSteg` `{ ned, opp }`): hvert steg endrer fraværstimene, «−» er sperret på grensen, og en pause som slutter på punktet hoppes over (ellers ville «+» bli stående før pausen, siden fraværsraden slutter ved pausestart). RETUR 4 (28): kortets slutt regnes fra arbeidsstart + varighet (klemt til 23:59), ikke fra klokka — et nattskift fra GPS deles ved midnatt (`dagsegment.ts`), og 00:00 = 0 min ga hele kortet som fravær og en sperret stepper. Et punkt før arbeidsstart på et kort som krysser midnatt tolkes som etter midnatt bare når det da ligger i kortet (på dag 1 bare linjas slutt «00:00»); ellers gjelder den vanlige klemmen til arbeidsstart + ett steg (RETUR 5 (28) A5). Stepperens punkter ligger på hele steg fra klokka — kvarter uten tidsrunding, 23:59 → 23:45 — mens den nedre grensen er arbeidsstart + ett steg (RETUR 5 (28) B1). Manuell «til» 00:00 legges på samme dato og gir et tomt kort, så den veien finnes ikke. Tester: `manuellDag.test.ts` («RETUR (28)» A1 og B9, «RETUR 2 (28)» (a)–(d) med og uten pause, «A3» fastStart 12:30/12:45/13:00 med og uten «Overtid fra», pause på punktet, pause midt i fraværet), `dagsforslag.retting.test.ts` («RETUR 4 (28) A4» nattskift 20–02, «RETUR 5 (28)» A5 18–02 m/ arbeidsstart 20:00 og B1 07:53–17), kildevakter i `dagsforslag.retting.test.ts`, `dagsoversiktRader.test.ts` og `dagskort-isolert-vakt.test.ts`. ⚠️ **Avgrenset 2026-11-16 (spec B10):** gjelder bare ubetalt fravær; betalt fravær (egenmelding, sykdom, barns sykdom) + arbeid kan til sammen ikke overstige dagsnormen. 🟡 Ikke bygget — a3 behandler i dag alt fravær som ubetalt.

> ⚠️ **L4-A — byggeplass-besøk gjennom dagen (`feat/timer-l4a-besok`, venter Kontrollør-gate, OTA).** Spec `timer-gps-lag3-4-spec.md` § 2.1–2.5. Ny lokal tabell `arbeidsdag_besok_local` (se `mobil.md`), logikk i `apps/mobile/src/services/arbeidsdagBesok.ts`. (1) **Besøk 1:** `startDag` (`useArbeidsdag.ts`) kaller `opprettArbeidsdagMedBesok`, som skriver arbeidsdag-raden og besøk 1 (`kilde='start_dag'`) sammen (L4-A2, atferdstest). (2) **Slutt dag:** `avsluttBesok` kalles i `utils/bekreftDag.ts` i samme steg som `status='avsluttet'` (både `bekreftDag` og `avsluttDagUtenSedel`) — siste besøk får avreise; treffer slutt-GPS en *annen* byggeplass, skrives ett `slutt_dag`-besøk. Avbrutt skjerm / åpen dag (H7) skriver ingen avreise. (3) **S1-banner** (`StartSluttDagKort.tsx`): ved montering av kortet mens dagen pågår OG ved AppState→active (L4-A2, `fix/timer-l4a2-s1-montering`), felles flyt `kjorS1`; maks én måling pr. 10 min gjennom ÉN vakt pr. app-prosess (`s1Prosessvakt`, modulnivå — remount nullstiller verken 10-min-grensen eller dempingen); kun når GPS-tillatelse alt er gitt (`maalStille`: `getForegroundPermissionsAsync`, spør aldri); treff på annen byggeplass enn siste besøk → «Ser ut som du er på X» + [Ankommet] (`gps_forslag`) / [Nei] (skriver ingenting, demper X i 30 min). (4) **S2** «Bytt byggeplass» ved siden av [Slutt dag] åpner `AnkommetHvorModal` (GPS-treff øverst, søk, «Utenfor kjent byggeplass») → `manuell` via `velgS2Besok` (samme byggeplass som siste besøk → ingen ny rad). Besøkstabellen har ingen posisjonskolonner (vakt-test). Kortet viser «Nå: X (siden HH:MM)» ~~fra besøk 2~~ — funn 9 (🟡 `fix/timer-telefontest-1311`, ikke merget): fra første besøk, via `naaStedLinje` (`utils/paagaarSted.ts`); besøk uten byggeplass gir «Utenfor kjent byggeplass», ingen besøk-rad gir samme tekst uten tid, og linjen utelates når besøk 1 har samme navn som oppmøtestedet («Startet på X»), eller når besøk 1 er uten byggeplass og oppmøtestedet har navn (B-9: start på verksted/kontor → bare «Startet på X»). (5) **Rydding:** `ryddGamleArbeidsdager` sletter avsluttet/forkastet arbeidsdag + besøk eldre enn 14 d, én gang pr. app-prosess. PSI er aldri kilde (vakt-test). Ingen `watchPositionAsync`/bakgrunnsposisjon. Besøkene brukes ennå ikke i dagsforslaget (L4-B).

**Auto-utkast (BESLUTNING 1 = Alternativ B, fase-0 T.8).** Ved «Slutt dag» + [Bekreft og lagre] (L3-A) auto-skriver appen en **`draft`**-dagsseddel fra GPS-dagflyten — arbeidstid-rad(er) (timer = total − reise, splittet Timelønn opp til dagsnorm + «Overtid 50%» via navne-match) + reise-rad. Arbeider ser alt, kan redigere/slette enhver auto-rad, og **godkjenner ved innsending** (`draft → sent`). Invariant: **aldri auto-*innsending*** — ingen lønn uten menneskelig godkjenning. UX-signaler: auto-fyll-banner (lokal `auto_generert`-markør), reise-rad merket 🚗 «Reisetid» (deteksjon via delt `hentReiseLonnsartId` — samme kilde som genereringen, mot drift). **Idempotens:** finnes allerede en draft for `(userId, dato)` → naviger til den (server `@@unique([userId, dato])`), ikke lag ny.

**Midnatt-splitt (Slice 4a).** Et skift som krysser 00:00 deles i **én dagsseddel per kalenderdag** (ren `splittVedMidnatt`); timene summerer til reell total (19:00→07:00 = 5t + 7t = 12t). **Pause (firma-standard) + reise føres KUN på start-dagen.** Per-dag Timelønn/Overtid-fordeling (overtid/tariff-behandling = regnskaps-scope). Lokal markør `delt_ved_midnatt` + «delt ved midnatt»-badge på review-skjerm. Idempotens er per dag (eksisterende dag beholdes, øvrige opprettes).

**Glemt-dag-gjenoppretting (Slice 4b-1).** Ved «Start dag»/app-åpning, hvis en arbeidsdag fra en **tidligere dato** fortsatt er åpen → prompt «Jobber du fortsatt, eller glemte du å avslutte?». «Jobber fortsatt» → behold åpen (→ midnatt-splitt ved avslutning). «Glemte» → estimer slutt (firma `standardSluttTid` på start-dagen; nattskift der `standardSluttTid ≤ start` → `start + dagsnorm`), generer draft til korrigering, merket `sluttTidKilde="system"`. Adresserer BUG-1 (glemt «Slutt dag» → urealistisk lang økt).

> ⚠️ **DEL 5 — glemt dag (`fix/timer-glemt-dag`, Kenneth 2026-11-12: a/c/d ja, b nei; venter Kontrollør-gate, OTA).**
> - **d — estimatet stopper ved midnatt:** `estimerGlemtSlutt` (`apps/mobile/src/utils/dagsegment.ts`, kalt fra `StartSluttDagKort.gjenopprettGlemtDag`) gir standard sluttid, ellers start + dagsnorm, men aldri senere enn midnatt etter start (start 21:07 → slutt 24:00). `kappGlemtDagSlutt` kapper også ved `nesteLokaleMidnatt`. Appen fører aldri tid på neste dato av seg selv.
> - **c — brukeren godkjenner sluttiden:** når slutt-kilden er `system`, forslaget er kappet eller sluttiden er rettet, viser `bekreft-dag.tsx` et sluttpanel med anslått slutt (24:00 eller «dd.mm. hh:mm» på en annen dato), stegknapper −60/−15/+15/+60 (`stegSluttIso`, `utils/bekreftDag.ts`) og «Tidene stemmer». Lagring er sperret til brukeren har godkjent eller rettet. En rettet slutt regnes på nytt med kilde `bruker`. Dagskortet er urørt (vakt `dagskort-isolert-vakt.test.ts`).
> - **d-tillegg — retting over midnatt:** delen etter midnatt blir et eget prosjektkort på neste dato, med egen sedel (finn-eller-opprett pr. dato) og egen rad som settes inn. Den slås aldri sammen med en eksisterende rad. Før lagring står «Det blir N prosjektkort, ett pr. dato» (`timer.bekreftDag.kortPrDato`).
> - **a — ingen stille sperre:** `bekreftSperre` gir én grunn: ikke klar, ikke innlogget, dagen er lukket, prosjekt mangler eller sluttiden er ikke godkjent. Hver grunn vises som Alert. Knappen er bare deaktivert mens den lagrer. Sendte datoer vises før lagring (`sendteDatoer`, `timer.bekreftDag.datoSendt`), og en sendt dato vises som en gul linje i stedet for datokortet. Blir en del lagret og en del sperret av sendt sedel, gir `avgjorSluttDagHandling` svaret `delvisSendt`: økten lukkes og meldingen sier hva som ble lagret og hva som ikke ble det (`timer.delvisSendt`). Økten står bare åpen når ingenting ble skrevet (`blokkertSendt`).
> - **b — nei:** «Jeg jobber fortsatt» tilbys alltid. Det finnes ingen lengdegrense.
> - **Tester:** `apps/mobile/src/utils/glemtDag.test.ts` med ekte SQLite (sql.js). Kenneths tilfelle er med: start 9.11 kl. 21:07 med 9.11 sendt, og retting til 10.11 kl. 02:00.

**`sluttTidKilde` (Slice 4b-2) — 3-verdi.** Kilde for slutt-tiden: **`bruker`** (arbeider satte/bekreftet — normal «Slutt dag»/manuell/redigering; nullstilles til denne ved eksplisitt tid-redigering) · **`midnatt`** (automatisk dag-grense fra midnatt-splitt — ikke-siste segment; normalt, ingen badge) · **`system`** (system-gjettet: glemt-dag-gjenoppretting/maks-varighet → **kontroll-badge i attestering**, «ikke arbeider-bekreftet»). Synces server↔mobil; speiler `MannskapsInnsjekk.autoUtlogget`-presedens.

**Arbeidstids-varsel (Slice 4b-2).** `OrganizationSetting.arbeidstidVarselTimer` (default 13, firma hever til 16 ved tariff via samme felt). Ved attestering: **varsel-badge** når total av **alle timer-rader inkl. reise** på en dagsseddel > terskel. Per kalenderdag/dagsseddel (ekte AML-«døgn» = utenfor MVP). **Varsel, ikke blokkering** — innsending/utførelse låses aldri. Forankret AML § 10-6 (13/16t) + § 10-8 (11t døgnhvile); SiteDoc flagger, firmaets HMS eier ansvaret.

## Database — `packages/db-timer`

> **🟢 T.1–T.6 (vedtatt 2026-05-11, deployet prod 2026-05-12):** `projectId` er flyttet fra `DailySheet`-nivå til rad-nivå (`SheetTimer`/`SheetMachine`/`SheetTillegg`). Dagsseddelen eies av arbeider/firma, ikke prosjekt. Se [fase-0-beslutninger.md § T](fase-0-beslutninger.md) for vedtak. Levert i 5 PR-er (`862c70c3`/`bba971ba`/`6431873c`/`8478d4a7`/`0700b8ed`).

### Hovedtabell: `daily_sheets` (dagsseddel)

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | Server-generert ID |
| `clientUuid` | `uuid` UNIQUE | Klient-generert UUID for idempotent upsert |
| `organizationId` | `uuid` FK → `organizations` | Firma-eier (timer-data er firma-eid) |
| `userId` | `uuid` FK → `users` | Hvem timer gjelder for |
| `registrertAvUserId` | `uuid` FK → `users` | Hvem la inn registreringen (kan være ulik userId) |
| ~~`projectId`~~ | ~~`uuid` FK → `projects`~~ | **DROPPET T.1 (2026-05-12).** Prosjekttilhørighet ligger nå på rad-nivå (`SheetTimer.projectId`/`SheetMachine.projectId`/`SheetTillegg.projectId`). |
| `aktivitetId` | `uuid?` FK → `aktiviteter` | Default-aktivitet for nye timer-rader (C9 2026-05-02 — nullable). Selve kanon-eierskapet ligger på `SheetTimer.aktivitetId` per rad. Kopieres til første rad ved opprettelse. |
| `avdelingId` | `uuid?` FK → `avdelinger` | Avdeling (firma-intern, valgfri) |
| `byggeplassId` | `uuid?` FK → `byggeplasser` | Byggeplass på sedel-nivå (default-forslag). Faktisk byggeplass per rad ligger på `SheetTimer.byggeplassId` / `SheetMachine.byggeplassId` (T.2). |
| `dato` | `date` | Arbeidsdag |
| `startAt` | `timestamptz?` | Klokkeslett start (forenklet forslag til arbeider; faktisk tid per rad ligger på `SheetTimer.fraTid`/`tilTid` per T.4) |
| `endAt` | `timestamptz?` | Klokkeslett slutt (forenklet forslag) |
| `sluttTidKilde` | `text` default `bruker` | **Slice 4b-2 (2026-06-21).** Kilde for slutt-tiden: `bruker` (arbeider satte/bekreftet — normal «Slutt dag»/manuell/redigering), `midnatt` (automatisk dag-grense fra midnatt-splitt Slice 4a — ikke-siste segment), `system` (system-gjettet: glemt-dag-gjenoppretting/maks-varighet → **kontroll-badge i attestering**). Nullstilles til `bruker` ved eksplisitt tid-redigering. Speiler `MannskapsInnsjekk.autoUtlogget`-presedens. |
| `pauseMin` | `int` default 0 | Pause i minutter |
| `status` | `text` default `draft` | `draft` \| `sent` \| `returned` \| `accepted`. **Per T.3 Alternativ A** skal sedelen være container uten egen attesterings-status (attestering per rad). Foreløpig beholdt for bakoverkompatibilitet — full migrering til per-rad-attestering i senere PR. **Re-send etter retur (2026-05-27):** Når `send`-mutationen kalles på en sedel med `status="returned"`, nullstilles alle rader med `attestertStatus="returnert"` til `"pending"` i samme transaksjon (audit-felter `attestertAvUserId`/`attestertVed` nullstilles også). Uten dette ville leder ikke kunne attestere returnerte rader etter at arbeider gjør rettelser. Se [historikk-2026-05.md § Returnert→pending-reset](historikk-2026-05.md). |
| `beskrivelse` | `text?` | Fritekst fra ansatt |
| `lederKommentar` | `text?` | Toveis-kommunikasjon: leder kan svare ansatt |
| `syncStatus` | `text` | `pending` \| `synced` \| `conflict` \| `avvist` (SYNC-1: mobil-lokal terminal ved permanent server-avvisning) |
| `syncedAt` | `timestamptz?` | Siste vellykket synkronisering |
| `attestertAvUserId` | `uuid?` FK → `users` | Leder som attesterte (per T.3 flyttes til rad i senere PR) |
| `attestertVed` | `timestamptz?` | Tidspunkt for attestering (per T.3 flyttes til rad i senere PR) |
| `createdAt` | `timestamptz` | |
| `updatedAt` | `timestamptz` | |

**Indekser:**
- `(userId, dato)` UNIQUE — **endret T.1 2026-05-12** (fra `(userId, projectId, dato)` — projectId droppet)
- `(organizationId)`
- `(clientUuid)` UNIQUE
- ~~`(projectId, dato)`~~ — **DROPPET T.1 2026-05-12** (projectId-kolonnen fjernet)
- `(organizationId, dato)` — firma-rapport / lønnsrapport
- `(organizationId, status)` — admin: «hva ligger til attestering»
- `(attestertAvUserId, attestertVed)` — «hva har leder X attestert»
- `(byggeplassId, dato)` — byggeplass-rapport (Fase 0.5+)
- `(avdelingId, dato)` — eksport-filtrering per avdeling
- `(userId, syncStatus)` — mobil pending-sync

**Note om ECO-flytting (vedtatt 2026-04-29):** `externalCostObjectId` flyttet fra `daily_sheets`-nivå til `sheet_timer`-nivå (linje-nivå). Begrunnelse: multi-ECO er svært vanlig hos A.Markussen — ansatte jobber regelmessig på flere underprosjekter samme dag. Med ECO på linje kan én dagsseddel inneholde rader med ulike ECO-koblinger.

**Note om T.1 (vedtatt 2026-05-11, deployet 2026-05-12):** `projectId` flyttet fra `daily_sheets` til rad-nivå. Begrunnelse: arbeider kan jobbe på flere prosjekter samme dag, og dagsseddelen eies av arbeider (ikke prosjekt). Unique-constraint endret til `(userId, dato)` — én dagsseddel per arbeider per dag, uavhengig av prosjekter. Prosjekt-filtrering i spørringer går nå via `timer: { some: { projectId } }`-relasjon eller direkte mot `sheet_timer.project_id`.

**Arbeidstids-varsel (Slice 4b-2, 2026-06-21):** `OrganizationSetting.arbeidstidVarselTimer` (`int` default 13; firma hever til 16 ved tariff via samme felt) er terskelen for arbeidstids-varsel. Ved attestering vises en **varsel-badge** når total av alle timer-rader (**inkl. reise** — kompensert reise er arbeidstid) på en dagsseddel overstiger terskelen. Per kalenderdag/dagsseddel (ekte AML-«døgn» = rullende 24t er utenfor MVP). **Varsel, ikke blokkering** — innsending/utførelse låses aldri. Forankret AML § 10-6 (13/16t) + § 10-8 (11t døgnhvile); SiteDoc flagger, firmaets HMS eier ansvaret.

### `sheet_timer` (timer-rader per dagsseddel)

Erstatter de tidligere faste kolonnene `normaltid/overtid50/overtid100`. Datadrevet — bruker velger lønnsart fra katalogen.

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | |
| `sheetId` | `uuid` FK → `daily_sheets` | |
| `lonnsartId` | `uuid` FK → `lonnsarter` | Datadrevet katalog |
| `aktivitetId` | `uuid` FK → `aktiviteter` | Per-rad aktivitet (C9 2026-05-02). NOT NULL. Default fra sedlens `aktivitetId` ved opprettelse, kan overstyres per rad. Restrict-FK. |
| `projectId` | `uuid` (svak FK → `projects`) | **NY T.2 (2026-05-12) — NOT NULL.** Per-rad prosjekttilhørighet. Svak FK uten Prisma `@relation` (A.20 cross-package-mønster). |
| `byggeplassId` | `uuid?` (svak FK → `byggeplasser`) | **NY T.2 (2026-05-12).** Per-rad byggeplass. Nullable (A.30 — byggeplass-NULL er gyldig). |
| `fraTid` | `text?` | **NY T.4 (2026-05-12).** HH:MM-format. Per-rad starttid. Server validerer `fraTid < tilTid`. |
| `tilTid` | `text?` | **NY T.4 (2026-05-12).** HH:MM-format. Per-rad sluttid. |
| `externalCostObjectId` | `uuid?` FK → `external_cost_objects` | Tilleggsarbeid (ECO) per linje — gjør multi-ECO mulig innenfor én dagsseddel |
| `timer` | `decimal` | Timer på denne lønnsarten |
| `attestertSnapshot` | `jsonb?` | Pris-snapshot ved attestering (Fase 0 A.7) — inkluderer aktivitet-snapshot post-C9 |
| `attestertStatus` | `text?` default `pending` | **NY T.3 (2026-05-12).** Per-rad attestering. `pending` \| `godkjent` \| `returnert`. Per Alternativ A: leder attesterer kun rader for sitt prosjekt — dagsseddel-status (`status` på `daily_sheets`) avledes fra rad-status i senere PR. |
| `attestertAvUserId` | `uuid?` (svak FK → `users`) | **NY T.3 (2026-05-12).** Leder som attesterte denne raden. |
| `attestertVed` | `timestamptz?` | **NY T.3 (2026-05-12).** Tidspunkt for rad-attestering. |

**Indekser:**
- `(sheetId)` — KRITISK FK-JOIN ved hver dagsseddel-fetch (Postgres lager ikke auto-index på FK)
- `(lonnsartId)` — lønnsart-aggregering ved eksport/rapport
- `(aktivitetId)` — aktivitet-aggregering ved ProAdm-eksport
- `(externalCostObjectId)` — ECO-aggregering ved eksport
- `(projectId)` — **NY T.2** — prosjekt-rapport via rad-join
- `(byggeplassId)` — **NY T.2** — byggeplass-aggregering
- `(attestertStatus)` — **NY T.3** — leder-vy «hva venter attestering»

> **🟢 Erstattede rader FLYTTES til historikk (T7-2b-oppfølger 2026-07-13, migrering `20260713120000_sheet_rad_historikk`).** Ved firma-admin rediger/splitt (`dagsseddel.ts` `rediger`/`splittRad`) settes originalraden IKKE lenger til `attestertStatus="erstattet"` i hovedtabellen. Den FLYTTES i stedet til den felles write-only audit-tabellen **`sheet_rad_historikk`** (INSERT JSON-snapshot + DELETE fra hovedtabell i samme tx — MOVE, aldri hard-delete), med `originalRadId` + bevart `parentRadId`. Hovedtabellene (`sheet_timer`/`sheet_tillegg`/`sheet_machines`) holder derfor kun **live** rader, så ingen leser trenger `erstattet`-filter («lagre rett»-prinsippet — filteret i aktiv-helper/`hentEndringerSiden` er nå rulleringsvern, no-op etter migrering). `attestertStatus`-kolonnen beholdes (pending/attestert/returnert brukes fortsatt).
>
> ⚠️ **Snapshot-form-divergens (ikke-blokkerende, kjent):** engangs-backfillen i migreringen bruker `to_jsonb(t.*)` → **snake_case** DB-kolonner; runtime-innflyttinger bruker `JSON.stringify(rad)` → **camelCase** Prisma-felt. Uskadelig i dag (write-only, aldri lest for beregning), men en fremtidig audit-leser må tåle begge nøkkelformene.

### `sheet_tillegg` (tillegg-rader per dagsseddel)

Erstatter de tidligere faste boolean-kolonnene `overtidsmat/nattillegg/helgetillegg`. Datadrevet.

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | |
| `sheetId` | `uuid` FK → `daily_sheets` | |
| `tilleggId` | `uuid` FK → `tillegg` | Datadrevet katalog |
| `projectId` | `uuid` (svak FK → `projects`) | **NY T.2 (2026-05-12) — NOT NULL.** Per-rad prosjekttilhørighet. |
| `byggeplassId` | `text?` (svak FK → `byggeplasser`) | 🟡 `feat/timer-tillegg-utlegg-kort` (migrering `20261113120000_tillegg_utlegg_byggeplass_eco`, ikke kjørt). NULL = arver sedelens byggeplass (A.30). Ingen backfill (B2). |
| `externalCostObjectId` | `text?` (svak FK → `external_cost_objects`) | 🟡 samme migrering. Underprosjekt; NULL = hovedgruppa. |
| `antall` | `decimal` | Antall (1 for avhuking) |
| `kommentar` | `text?` | Tvungen for noen tillegg (`Tillegg.tvungenKommentar=true`) |
| `attestertSnapshot` | `jsonb?` | Pris-snapshot ved attestering |
| `attestertStatus` | `text?` default `pending` | **NY T.3 (2026-05-12).** `pending` \| `godkjent` \| `returnert`. |
| `attestertAvUserId` | `uuid?` (svak FK → `users`) | **NY T.3 (2026-05-12).** Leder som attesterte. |
| `attestertVed` | `timestamptz?` | **NY T.3 (2026-05-12).** Tidspunkt for rad-attestering. |

**Indekser:**
- `(sheetId)` — KRITISK FK-JOIN
- `(tilleggId)` — tillegg-aggregering
- `(projectId)` — **NY T.2**
- `(attestertStatus)` — **NY T.3**
- `(byggeplassId)`, `(externalCostObjectId)` — 🟡 `20261113120000_tillegg_utlegg_byggeplass_eco`

### `sheet_tillegg_vedlegg` (kvittering-vedlegg på tillegg-rad) — NY Funn #2 (2026-06-21)

Arbeider legger ved kvittering (bilde/scan) på et tillegg/utlegg. **Flere vedlegg per rad.** Lagring: server-lokal disk via REST `/upload` (`fileUrl = /uploads/...`), **ikke S3** — se [BACKLOG § S3-drift](BACKLOG.md). `sheetTilleggId` er **svak String-FK uten Prisma `@relation`** (A.20 cross-modul-mønster).

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | Klient-generert (= lokal `vedleggId`) for id-konsistens mot mobil-cachen → ingen duplikater ved pull |
| `sheetTilleggId` | `uuid` (svak FK → `sheet_tillegg`) | Hvilken tillegg-rad vedlegget hører til. Ingen `@relation`. |
| `fileUrl` | `text` | `/uploads/...` (servert statisk av API). Rå nøkler returneres aldri til klient. |
| `fileName` / `mimeType` / `fileSize` | `text` / `text` / `int` | Fil-metadata |
| `gpsLat` / `gpsLng` | `float?` | GPS ved capture (valgfri) |
| `createdAt` | `timestamptz` | |

**Indeks:** `(sheetTilleggId)`.

**Flyt (offline-først):** mobil tar bilde → `bilde.komprimer` (300–400 KB) → lagres lokalt (`sheet_tillegg_vedlegg_local`) → legges i felles opplastings-kø (`OpplastingsKoProvider`, additiv `sheetTillegg`-gren) → ved nett: `/upload` + `timer.dagsseddel.tilfoyTilleggVedlegg`. «Venter på opplasting» vises til `serverUrl` er satt. Pull (`hentEndringerSiden`) henter vedlegg-metadata per rad (svak FK → separat fetch, ikke Prisma-`include`); lokale ikke-opplastede vedlegg røres aldri. Web (`/dashbord/timer/[id]`) viser miniatyr + forstørr/nedlast for leder.

### `lonnsarter` (lønnsart-katalog per Organization)

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | |
| `organizationId` | `uuid` FK → `organizations` | Eier |
| `type` | `text` | `ordinaer` \| `fravaer` \| `feriepenger` \| `diett` |
| `kode` | `text?` | Eksport-kode (Poweroffice/Visma/etc.). NULL hvis ikke valgt eksport-system ennå. Eksport-modulen krever ikke-NULL ved eksport-tid med tydelig feilmelding. |
| `navn` | `text` | |
| `prisMotKunde` | `decimal?` | Null = bruker prosjektkontrakt |
| `internkostnad` | `decimal?` | |
| `sats` | `decimal?` | Generell sats — brukes når lønnsart er en flat utbetaling (diett, kilometergodtgjørelse, nattillegg). Null for vanlige time-lønnsarter |
| `satsEnhet` | `text?` | Enhet for `sats` — `per_dag`, `per_natt`, `per_km`, `per_time`. Null hvis `sats` er null |
| `skalEksporteres` | `boolean` default true | |
| `tvungenKommentar` | `boolean` default false | |
| `rekkefolge` | `int` | Sortering i UI |
| `aktiv` | `boolean` default true | Soft-delete |
| `seedNivaa` | `int?` | 1, 2 eller null (3 = egendefinert). Brukes for å skille auto-seeded fra kunde-opprettet. |

**Indekser:**
- `(organizationId, kode)` UNIQUE WHERE `kode IS NOT NULL` (delvis unik — to lønnsarter uten kode er lovlig)
- `(organizationId, aktiv)` — hent kun aktive katalog-rader

### `aktiviteter` (aktivitet-katalog per Organization)

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | |
| `organizationId` | `uuid` FK | |
| `kode` | `text?` | Eksport-kode (samme nullable-prinsipp som lønnsart) |
| `navn` | `text` | |
| `internkostnad` | `decimal?` | |
| `prisMotKunde` | `decimal?` | |
| `aktiv` | `boolean` default true | |
| `seedNivaa` | `int?` | 1, 2 eller null (3 = egendefinert). Skill auto-seeded fra kunde-opprettet. |

**Indekser:**
- `(organizationId, kode)` UNIQUE WHERE `kode IS NOT NULL` (delvis unik, samme prinsipp som lønnsart)
- `(organizationId, aktiv)`

### `tillegg` (tillegg-katalog per Organization)

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | |
| `organizationId` | `uuid` FK | |
| `kode` | `text?` | Eksport-kode (nullable) |
| `navn` | `text` | |
| `type` | `text` | `avhuking` \| `antall` |
| `prisMotKunde` | `decimal?` | |
| `internkostnad` | `decimal?` | |
| `skalEksporteres` | `boolean` default true | |
| `tvungenKommentar` | `boolean` default false | |
| `rekkefolge` | `int` | |
| `aktiv` | `boolean` default true | |
| `seedNivaa` | `int?` | 1, 2 eller null (3 = egendefinert) |

**Indekser:**
- `(organizationId, kode)` UNIQUE WHERE `kode IS NOT NULL`
- `(organizationId, aktiv)`

### `sheet_machines` (maskinbruk per dagsseddel)

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | |
| `sheetId` | `uuid` FK → `daily_sheets` | |
| `vehicleId` | `uuid` (svak FK → `equipment` i db-maskin) | A.20 cross-package-mønster |
| `projectId` | `uuid` (svak FK → `projects`) | **NY T.2 (2026-05-12) — NOT NULL.** Per-rad prosjekttilhørighet. |
| `byggeplassId` | `uuid?` (svak FK → `byggeplasser`) | **NY T.2 (2026-05-12).** Per-rad byggeplass. |
| `fraTid` | `text?` | **NY T.4 (2026-05-12).** HH:MM-format. |
| `tilTid` | `text?` | **NY T.4 (2026-05-12).** HH:MM-format. |
| `timer` | `decimal` | Timer brukt |
| `mengde` | `decimal?` | Valgfri mengde |
| `enhet` | `text?` | m3, m2, tonn, kg, m |
| `attestertSnapshot` | `jsonb?` | Pris-snapshot ved attestering — null inntil Equipment-prising er spec'd |
| `attestertStatus` | `text?` default `pending` | **NY T.3 (2026-05-12).** `pending` \| `godkjent` \| `returnert`. |
| `attestertAvUserId` | `uuid?` (svak FK → `users`) | **NY T.3 (2026-05-12).** |
| `attestertVed` | `timestamptz?` | **NY T.3 (2026-05-12).** |

**Indekser:**
- `(sheetId)` — FK-JOIN
- `(vehicleId)` — maskinrapport på tvers av ansatte/prosjekter
- `(projectId)` — **NY T.2**
- `(byggeplassId)` — **NY T.2**
- `(attestertStatus)` — **NY T.3**

**T.11 maskinførerbevis-flagg (soft, 2026-06-22):** Ved siden av Equipment-cache-soft-skjulet flagges maskinarbeid registrert av arbeider **uten gyldig maskinførerbevis** (kompetanse-kategori `TRUCK-/MASKINFØRERBEVIS`, ikke utløpt). Rent avledet server-side — ingen kolonne på `sheet_machines`. Arbeider ser eget soft-varsel i `MaskinSeksjon` (mobil); leder ser per-sedel-varsel i attestering (`hentForAttestering` + `hentTilAttesteringFirma` returnerer avledet `manglerMaskinforerbevis`). Aldri blokkerende — synlighet/lagring uendret. Mobil-flagg synkes via `kompetanse.minMaskinstatus` → SecureStore (`sitedoc_maskinforerbevis`), ikke SQLite. Full beslutning: [fase-0 § T.11](fase-0-beslutninger.md).

### ~~`sheet_materials`~~ (FORELDET — se C.16 Vareforbruk)

> **🟦 FORELDET 2026-05-02:** Skissen nedenfor er erstattet av
> `Vare` + `Vareforbruk`-modellen (Vareforbruk-modul, vedtatt 2026-04-30 som
> [C.16 i fase-0-beslutninger.md](fase-0-beslutninger.md)).
> `Vareforbruk.dagsseddelId?` gir samme dagsseddel-kobling som denne skissen,
> men med varekatalog-FK i stedet for fritekst, og som egen modul i stedet
> for timer-tabell. Skissen bevares som historisk referanse — implementer ikke.

### `sheet_materials` (materialforbruk per dagsseddel) — historisk skisse

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | |
| `sheetId` | `uuid` FK → `daily_sheets` | |
| `navn` | `text` | Materialnavn (fritekst) |
| `mengde` | `decimal` | Antall |
| `enhet` | `text` | m3, m2, tonn, kg, m |

**Indeks:** `(sheetId)` — FK-JOIN

### `sheet_utlegg` (utlegg-/fakturert-rader per dagsseddel) — 🟢 U1 datamodell (migrering `20260808120000_utlegg_ordningsmodell`)

> **Erstatter den gamle planlagte `sheet_expenses`-spec-en.** `sheet_expenses` ble aldri bygget; U1 (2026-08-08) etablerer i stedet `SheetUtlegg` som egen bærer atskilt fra `SheetTillegg`, slik at eksporten skiller på MODELL (ikke på et flagg som kan glemmes). Ordre + spec: [docs/redesign/utlegg/utlegg-ordningsmodell-spec-fabel-2026-08-08.md](../redesign/utlegg/utlegg-ordningsmodell-spec-fabel-2026-08-08.md) + [utlegg-avklaringer-fabel-2026-08-08.md](../redesign/utlegg/utlegg-avklaringer-fabel-2026-08-08.md). Modell: `packages/db-timer/prisma/schema.prisma`.

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | |
| `sheetId` | `uuid` FK → `daily_sheets` (CASCADE) | |
| `projectId` | `text` | Svak FK → `projects` (kjernen, A.20-mønster) |
| `byggeplassId` | `text?` | 🟡 `feat/timer-tillegg-utlegg-kort` (migrering `20261113120000_tillegg_utlegg_byggeplass_eco`, ikke kjørt). Svak FK → `byggeplasser`; NULL = arver sedelens byggeplass (A.30). Ingen backfill (B2). |
| `externalCostObjectId` | `text?` | 🟡 samme migrering. Svak FK → `external_cost_objects` (underprosjekt); NULL = hovedgruppa. |
| `expenseCategoryId` | `uuid` FK → `expense_categories` (RESTRICT) | |
| `belop` | `decimal(10,2)?` | NULL **kun** når `ordningVedFoering='fakturert'` (CHECK). Refusjon krone for krone for `utlegg` |
| `mvaSats` | `decimal(5,2)?` | mva-sats snapshot per rad (regnskapsspørsmål — settes fra kategori i U2) |
| `kommentar` | `text?` | Fritekst |
| `ordningVedFoering` | `text` | Utledet ordning stemplet ved insert. **Immutabel integritetsbærer** |
| `createdAt` / `updatedAt` | `timestamptz` | |

**CHECK-constraints (DB-håndhevet, ikke bare app):**
- `ordning_ved_foering IN ('lonnstillegg','utlegg','fakturert')` (omdøpt fra `sats` — migrering `20260811130000`)
- `(ordning_ved_foering='fakturert' AND belop IS NULL) OR (ordning_ved_foering<>'fakturert' AND belop IS NOT NULL)` — fakturert når **aldri** penger; utlegg krever alltid beløp.

**Indekser:** `(sheetId)`, `(projectId)`, `(expenseCategoryId)`, 🟡 `(byggeplassId)`, `(externalCostObjectId)` (`20261113120000`).

**`ordningVedFoering`** er integritetsbærer, ikke bare revisjonsspor: insert stempler utledet ordning (`overstyring ?? firma-default`, via delt funksjon i `@sitedoc/shared/utleggOrdning.ts`) i samme transaksjon, og CHECK-en håndhever beløps-regelen mot DET stempelet — aldri mot et kategori-oppslag som kan drifte. Feltet er **immutabelt** etter insert; ordningsbytte = korreksjon (ny rad + gammel krediteres), aldri mutasjon.

### `sheet_utlegg_vedlegg` (kvittering-/bilde-vedlegg på en utlegg-rad) — 🟢 U1

Speiler `sheet_tillegg_vedlegg` 1:1 (mønster 1: rad per fil, svak `sheetUtleggId` String-FK uten `@relation`). Felt: `id`, `sheetUtleggId`, `fileUrl`, `fileName`, `mimeType`, `fileSize`, `gpsLat?`, `gpsLng?`, `createdAt`. Lagring server-lokal disk via `/upload` (`fileUrl`), **ikke S3**. Indeks `(sheetUtleggId)`.

### `prosjekt_ordning_overstyring` (firma-admin overstyrer ordning per prosjekt+kategori) — 🟢 U1

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | |
| `prosjektId` | `text` | Svak FK → `projects` (kjernen) |
| `expenseCategoryId` | `uuid` FK → `expense_categories` (CASCADE) | |
| `ordning` | `text` | CHECK `IN ('lonnstillegg','utlegg','fakturert')` (omdøpt fra `sats`, migrering `20260811130000`) |
| `createdAt` / `updatedAt` | `timestamptz` | |

**UNIQUE** `(prosjektId, expenseCategoryId)` — én overstyring per prosjekt+kategori. Oppslag alltid `overstyring ?? ExpenseCategory.ordning`. Endring gjelder kun **fremover** — allerede førte rader beholder sitt `ordningVedFoering`-stempel.

**Gjenstår (senere faser):** U2 eksport-guard (`case "fakturert": return []`, utlegg→refusjon aldri lønnsart), U3 web-registrering, U4 mobil (kamera-primær), U5 firma-admin overstyring-UI, U6 migrering av feilførte `SheetTillegg`-rader (egen gate).

> **🔴 Eksport-invariant (etablert U1, ubrukt til Proadm-motor bygges):** all klassifisering av tillegg/utlegg mot eksport MÅ gå via `eksportRute()` i `@sitedoc/shared` og lese radens `ordningVedFoering` — aldri kategori-oppslag, aldri egen if-kjede. `fakturert` skal aldri nå lønnsart eller refusjon. U2 (koblingen mot eksportmotoren) er bevisst utsatt til motoren finnes; kontrakten (`eksportRute` + 10 tester) står allerede i delt kode.

### `expense_categories` (utleggskategorier per Organization)

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | |
| `organizationId` | `uuid` FK → `organizations` | |
| `navn` | `text` | Kategorinavn |
| `ordning` | `text` default `'utlegg'` | 🟢 U1: firma-default for ordning. CHECK `IN ('lonnstillegg','utlegg','fakturert')` (omdøpt fra `sats`, migrering `20260811130000`). Valgbar = `{utlegg, lonnstillegg}`; `fakturert` beholdt for historikk men ikke valgbar. Kan overstyres per prosjekt via `prosjekt_ordning_overstyring` |
| `satsbasert` | `boolean` default false | 🟢 Modelljustering (`20260811130000`): kategorien beregnes ETTER en sats (statens satser). Metadata — endrer ikke bærer/ordning/eksport |
| `muligSkattepliktig` | `boolean` default false | 🟢 Modelljustering: firma-admin-flagg, følger eksport per linje. SiteDoc registrerer grunnlag, aldri avgjørelse |
| `aktiv` | `boolean` default true | Kan deaktiveres uten å slette |

**Standardkategorier** seedes via samme event-hook (`onOrganizationCreated`) som lønnsart-Nivå 1: Drivstoff, Parkering, Diett, Verktøy, Annet. Seedede kategorier får `ordning='utlegg'` (kolonne-default) — U1 endrer ikke seed-logikken.

**Indeks:** `(organizationId)` — hent firma-katalog

### `arbeidstidskalender` (helligdager + firma-spesifikke fri-dager per Organization)

> **🟡 T.9 BESLUTTET 2026-05-15 — implementasjon neste fase.** Original Variant C-spec (vedtatt 2026-04-29) er **erstattet** av Variant B (dynamisk modell) per [fase-0-beslutninger.md § T.9](fase-0-beslutninger.md). DB-plassering: `packages/db` (kjernen), ikke `db-timer`. Sommer/vinter håndteres som dynamiske perioder i samme tabell via `sommertid_start`/`sommertid_slutt`-poster, ikke scalar-felter på `OrganizationSetting`. Halvdager via `timerOverstyr`-felt. Mobil får lokal cache `arbeidstidskalender_local` (samme mønster som `prosjektKatalog`). Spec-en under er bevart som referanse — felt-listen utvides med `aar`, `timerOverstyr` og nye type-verdier i T.9.

Vedtatt 2026-04-29 (Variant C): manuelt oppsett per kunde + import-knapp for norsk standard.

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | |
| `organizationId` | `uuid` FK → `organizations` | Eier (firma-spesifikk kalender) |
| `dato` | `date` | Konkret dato |
| `type` | `text` | `helligdag` \| `bevegelig_helligdag` \| `fellesferie` \| `kortdag` \| `firma_fri` |
| `navn` | `text` | F.eks. «1. mai», «Skjærtorsdag», «Fellesferie uke 28-30», «Sommer-kortdag» |
| `aktiv` | `boolean` default true | Kan deaktiveres uten å slette |

**Indeks:** `(organizationId, dato)` UNIQUE — én rad per dato per firma.

**Norske helligdager via import-knapp:** «Importer norsk standard YYYY»-knapp i admin-UI. Bruker `date-fns-tz` (vedtatt B.6) for å beregne bevegelige helligdager (Skjærtorsdag, Langfredag, 1. og 2. påskedag, Kristi himmelfart, Pinse-helg). Faste helligdager (1. nyttårsdag, 1. mai, 17. mai, 1. og 2. juledag) seedes direkte. Importen er idempotent — kjøres på nytt skriver den ikke over eksisterende rader.

**Firma-spesifikke kalender-poster** (fellesferie, kortdager, lokal fri-dag) registreres manuelt av admin. Påvirker auto-fordeling av timer (kortdag = redusert dagsnorm, fri-dag = ingen forventet timer).

**Seed-mekanisme:** Per C.10 — `seedArbeidstidskalender(organizationId, year)` registreres i Fase 3 sammen med `seedLonnsartNivaa1` og `seedExpenseCategories`. Event-hook-infrastrukturen etableres tomt i Fase 0.

### Avdeling — i kjernen, ikke db-timer

`Avdeling` lever i `packages/db` (kjernen) og bygges i Fase 0.5 sammen med Byggeplass-strategi. Brukes på tvers av Maskin (ansvarlig per avdeling), Mannskap og Timer. Ikke en del av db-timer-skjema.

### AnsattKompetanse + Kompetansetype — i kjernen, ikke db-timer

`AnsattKompetanse` og `Kompetansetype` lever i `packages/db` (kjernen) og bygges i Fase 0.5 (per A.28 + C.14, vedtatt 2026-04-29). To-tabell-struktur verifisert mot SmartDok. CSV/Excel-import av kompetanse fra dag 1 — venter ikke på HR-API.

**Bruk fra Timer-modulen:**
- **Fase 3 (kjerne):** Ingen direkte bruk. Kompetanse-validering ved timer-føring er IKKE Fase 3-arbeid.
- **Fase 6 (DO-kobling):** Validering ved timer-føring på maskin — sjekk at User har gyldig `AnsattKompetanse` med `Kompetansetype.kobletTilEquipmentModell` matchende `Equipment.modell`. Dokumenteres i DO-kobling-modul-spec senere.
- **Eksport-utvidelse (post-Fase 3):** Lønnssystem-eksport kan inkludere kompetanse-kontekst (f.eks. lærling-status fra fagbrev-rad) hvis kunde etterspør.

`AnsattKompetanse` er IKKE en del av db-timer-skjema — refereres via `userId` FK når Fase 6 DO-kobling bygges.

### Fjernet: `enterprise_settings`

Erstattet av `OrganizationSetting` (Fase 0). Felter `dagsnorm`, `overtidsmatTerskel`, `timezone`, `timer_lock_after_days`, `tillattSelvAttestering` flyttes dit. Sats-felter (`overtidsmatSats` osv.) flyttes til `Tillegg.prisMotKunde`/`internkostnad` i datadrevet katalog.

## Sync-strategi — offline-first

### Arkitektur-oversikt

```
┌─────────────────────────────────────────────────────────────────────┐
│ MOBILENHET                                │ SERVER                  │
│                                           │                         │
│  Bruker registrerer timer                 │                         │
│  (start/stopp, prosjekt, beskrivelse)     │                         │
│       ↓                                   │                         │
│  SQLite lokalt                            │                         │
│  (timeEntries, syncStatus, uuid)          │                         │
│       ↓                                   │                         │
│  Nettverksstatus?                         │                         │
│   │                                       │                         │
│   ├─ Offline → Lagres lokalt              │                         │
│   │            syncStatus = "pending"     │                         │
│   │            ... (venter)               │                         │
│   │            Tilkobling gjenopptatt     │                         │
│   │            Sender pending-poster ────────→ apps/api (tRPC)     │
│   │                                       │   Auth + organizationId │
│   └─ Online ─→ Sync-motor ──────────────────→       ↓              │
│                Batch pending → API        │   packages/db-timer     │
│                                           │   PostgreSQL, eget skjema│
│                                           │         ↓               │
│                                           │   Konfliktløsning       │
│                                           │   Server-wins +         │
│                                           │   client uuid —         │
│                                           │   idempotent upsert     │
└─────────────────────────────────────────────────────────────────────┘

db-timer nøkkelfelter:
  id (uuid), userId, registrertAvUserId, organizationId, projectId,
  externalCostObjectId, aktivitetId, avdelingId, byggeplassId, dato,
  startAt, endAt, pauseMin, status, beskrivelse, syncedAt, clientUuid
  syncStatus: "pending" | "synced" | "conflict" — slettes aldri, kun markeres
```

### Mobil → Server

1. **Lokal lagring:** SQLite via Drizzle (samme mønster som resten av mobil-appen)
2. **Registrering:** Bruker oppretter dagsseddel lokalt med `clientUuid` og `syncStatus: "pending"`
3. **Batch-sync:** Når nettdekning er tilbake, sender alle `pending`-poster til API
4. **Idempotent upsert:** API bruker `clientUuid` for å unngå duplikater — `ON CONFLICT (clientUuid) DO UPDATE`
5. **Bekreftelse:** Server returnerer synkroniserte poster med `syncStatus: "synced"` og `syncedAt`

### Equipment-cache lokalt på mobil

Feltarbeider må kunne registrere maskinbruk på dagsseddel offline. Mobilen vedlikeholder en lokal `equipment_local`-tabell i SQLite (Drizzle, samme mønster som dagsseddel) som speiler firmaets aktive equipment-register.

**Sync-mønster:**
1. Ved login: full nedlasting av aktive equipment (typisk 100–500 rader, ~50 KB)
2. Ved nettilkobling: delta-sync basert på `equipment.updatedAt`
3. Ved offline registrering av `sheet_machines`: peker mot `equipment_local.id`

**Identisk mønster som dagsseddel** — ingen REST-cache eller TanStack-cache. Lokal DB er sannhetskilde mens enheten er offline.

### Konfliktløsning

**Server-wins:** Hvis en dagsseddel er godkjent av leder og klienten sender en oppdatering, vinner server-versjonen. Klient merkes med `syncStatus: "conflict"` og brukeren informeres.

| Scenario | Løsning |
|----------|---------|
| Ny dagsseddel fra klient | Upsert via `clientUuid` |
| Klient redigerer usynkronisert seddel | Oppdater lokalt, sync ved neste batch |
| Klient redigerer godkjent seddel | `conflict` — godkjente sedler kan ikke endres |
| Server har nyere versjon | `conflict` — bruker informeres |
| Ny seddel for dato som allerede har en seddel (annen `clientUuid`) | `conflict`-**merge** — se Synk-identitet under |

### Synk-identitet + kollisjonsforsoning (F4-1, develop 2026-07-11)

**Invariant: `clientUuid` er den ene synk-identiteten.** Mobil-lokal `id` == `clientUuid` (`apps/mobile/src/db/schema.ts:84`); push nøkler på `clientUuid`, pull nøkler på samme identitet. Server setter derfor `DailySheet.id = clientUuid` ved create (`apps/api/src/routes/timer/dagsseddel.ts`, `opprett` + `syncBatch`-create). Eksisterende sedler med `id != clientUuid` beholdes urørt (kun nye får invarianten). Bakgrunn: server-generert `id` brøt antagelsen → pull-duplikat + «pull-så-redigert»-P2002.

**Dato-kollisjon → `conflict`-merge, ikke `avvist`.** `@@unique([userId, dato])` (én sedel per arbeider per dato) betyr at en offline-opprettet mobil-sedel kan kollidere med en server-sedel for samme dato registrert på web/annen enhet (ulik `clientUuid`). Tidligere ble dette `avvist` (terminal) → arbeiderens offline-rader nådde aldri web. Nå:
- **Server (S2):** P2002 på `userId_dato` → `syncBatch` slår opp eksisterende sedel og returnerer `resultat: "conflict"` med `serverData.clientUuid` (nytt valgfritt felt — #37-klient ignorerer det, bakoverkompat).
- **Mobil (M1):** kollisjon-conflict (server-clientUuid ≠ lokal) → re-nøkle lokal sedel til server-identiteten (`forsonSedelIdentitet` i `timerSync.ts`), behold arbeiderens rader, sett `pending` → additiv re-push mot server-sedelen. Ingen datatap.
- **Mobil (M2):** pull matcher `clientUuid` → server-id-fallback → `(userId, dato)`-forsoning, så en pullet server-sedel aldri lager duplikat mot en lokal offline-sedel.
- **Hva forsoningen flytter (F1, 2026-11-13, 🟡 `fix/timer-forson-utlegg`, ikke merget):** `forsonSedelIdentitet` re-nøkler i én transaksjon alle lokale kolonner som bærer sedel-id: `sheet_timer_local`, `sheet_tillegg_local`, `sheet_machine_local`, `sheet_utlegg_local`, `slettede_rader_local` (`dagsseddel_id`), `vareforbruk_local.sheet_id` og `arbeidsdag_local.generert_dagsseddel_id`. Vedleggene (`sheet_tillegg_vedlegg_local`, `sheet_utlegg_vedlegg_local`) og `opplastings_ko` peker på rad-id, som ikke endres, og følger raden. Før F1 manglet utlegg og arbeidsdag-pekeren: utlegg ble stående på en id uten hode og ble aldri pushet. **Redning:** `reddForeldreloseUtlegg` (kalles i `kjorTimerSync` før push) flytter slike foreldreløse utlegg bare når koblingen er entydig: arbeidsdagen peker fortsatt på gammel id, har én dato, og det finnes nøyaktig én lokal sedel for (bruker, dato). En synket mål-sedel settes `pending`. Rekkevidde: GPS-dager før arbeidsdagen ryddes (14 døgn), utlegg på dagens start-sedel. Manuelle dager har ingen kobling gammel → ny id; der står utlegget urørt. Vakter: `timerSync.forsoning.test.ts` (flytting, push-payload, strukturvakt som feiler når en ny lokal sedel-id-kolonne ikke forsones, negativkontroller).

**Server bevarer web-rader ved synk (S3).** `syncBatch` sletter ikke lenger hele sedelens rader før gjenoppretting — den sletter kun rad-`id`-ene som er i payloaden (`deleteMany({ sheetId, id: { in: payloadIder } })` + `createMany`). Server-rader som ikke er i payloaden (typisk web-førte rader mobil aldri pullet) bevares → arbeiderens rader pushes additivt inn uten å stryke web-radene.

> **⚠️ Akseptert begrensning (S3, ingen migrering):** Fordi server ikke kan skille «arbeider slettet raden» fra «web la til rad mobil aldri så» ut fra payloaden alene, propagerer **mobil rad-sletting ikke lenger automatisk** til server. «Aldri mist data» prioriteres over sletting-propagering. En origin-basert løsning krever ny kolonne (migrering) → utsatt.

**Sedel-nivå projectId er nullbar (F4-4, 2026-07-11).** Rad-nivå `projectId` er kanon (T.1); sedel-nivå er kun en fallback-shim. `syncBatch`-input krevde før `projectId: z.string().uuid()` (påkrevd) → en tom/plassholder-sedel (mobil-lokal `""` fra pull-plassholderen `serverSedel.projectId ?? ""`) ga Zod 400 på **hele batchen** (poison) og sedelen ble gift-isolert til `avvist`. Nå: sedel-nivå `z.union([uuid, ""]).nullable().optional().transform(v => v || null)` (tåler `""` fra #37 + `null` fra #38, datatap-fri), en `radProsjekt`-resolver med `avvist`-guard for rader uten prosjekt (DB-feltet er NOT NULL), og mobil push sender `sedel.projectId || null` + rad-fallback `|| undefined`. **En tom sedel (0 rader) synker rent** som bart sedelhode. Gift-isoleringen (`timerSync.ts:406`) redder gode sedler ved en 400 uansett.

### Synk-intervall

- **Aktiv app:** Sync hvert 30. sekund når nettdekning finnes
- **Bakgrunn:** Expo BackgroundFetch (minimum 15 min intervall på iOS)
- **Manuell:** Pull-to-refresh trigger

## Auth

Delt auth via eksisterende `next-auth` sessions-tabell i `packages/db`. Timer-API validerer session-token mot samme tabell. Ingen egen innlogging — brukeren er allerede logget inn i SiteDoc.

**Viktig:** `packages/db-timer` har INGEN `users`-tabell — refererer kun via `userId` FK til `packages/db`.

## Tilgangsstyring

| Prinsipp | Implementasjon |
|----------|---------------|
| **Firma-isolering** | `organizationId` på alle dagssedler. Timer-data er firma-eid (per memory: feedback_timer_eierskap) |
| **Prosjektisolering** | `projectId` filtrerer alltid — ⚠️ **med ett målt unntak, se raden under** |
| **Ledervisning** | Firmaansvarlig ser ansattes dagssedler i sin faggruppe |
| **Admin** | Prosjektadmin ser alle dagssedler i prosjektet |
| **Avsluttet medlemskap (L2a)** | Prosjektmedlemskap med `periodeSlutt` satt = kan ikke føre timer på prosjektet; egne sedler leses fortsatt (`syncBatch` → `verifiserProsjektmedlem`; `erProsjektLeder` krever også aktivt medlem) |
| ⚠️ **Unntak: dagssedler som spenner over flere prosjekter** (historisk måling; `hentTilAttestering` er fjernet i w10b) | `dagsseddel.hentTilAttestering` (`apps/api/src/routes/timer/dagsseddel.ts:2250-2294`) velger sedler med `timer: { some: { projectId } }`, men **`include: { timer: … }` har intet `projectId`-filter** — kun `attestertStatus != "erstattet"`. Fører en ansatt timer på to prosjekter samme dag, ser prosjektadmin i det ene prosjektet **hele sedelen**, inkludert linjene ført på det andre. 🟢 **Kenneth-vedtak 2026-09-10: dette er akseptert som det er — sedelen er dagens arbeid, og den som attesterer må se helheten for å vurdere den. Men det skal opplyses, ikke oppdages.** 🔴 **Skriv/attestering er korrekt gjerdet:** `attesterRader`/`returnerRader`/`attester`/`gjenaapneAttestering` (`:2885`, `:3069`, `:3994`, `:3170`) krever `krevProsjektLeder` på **hvert** berørt prosjekt |
| **Godkjenning** | Leder godkjenner dagssedler → `godkjentAv` + `godkjentVed`. Utlegg godkjennes samtidig — leder ser kvitteringsbilder i godkjenningsvisningen |

## API-ruter (planlagt)

| Rute | Metode | Beskrivelse |
|------|--------|-------------|
| `timer.registrer` | Mutation | Opprett/upsert dagsseddel (idempotent via clientUuid) |
| `timer.oppdater` | Mutation | Endre dagsseddel (kun egne, kun ikke-godkjente) |
| `timer.slett` | Mutation | Slett dagsseddel (kun egne, kun utkast — S1, se «Slett dagsseddel sletter alt») |
| `timer.hentMine` | Query | Mine dagssedler, filtrert på prosjekt/periode |
| `timer.hentForProsjekt` | Query | Alle dagssedler i prosjekt (admin/leder) |
| `timer.godkjenn` | Mutation | Godkjenn dagsseddel (leder) |
| `timer.avvis` | Mutation | Avvis med kommentar (leder) |
| `timer.syncBatch` | Mutation | Batch-upsert fra mobil (array av clientUuid-dagssedler med maskiner/materialer) |
| `timer.hentInnstillinger` | Query | Organization-innstillinger (dagsnorm, satser) |
| `timer.oppdaterInnstillinger` | Mutation | Endre Organization-innstillinger (admin) |

## Prototype — kundevisning (pågår)

Interaktiv UI-prototype for kundedialog. Ingen backend, ingen migrering — kun hardkodet demodata og lokal state. Formål: vise kunden at funksjonaliteten er gjennomtenkt, og få tilbakemelding.

### Plan: modul i prosjektet (vedtatt 2026-04-27)

Timer bygges som **en modul inne i prosjektet** (ikke separat app). Grunnen:

- **Mobil:** Feltarbeideren åpner prosjektet sitt og finner timer der — samme mønster som sjekklister, oppgaver, tegninger
- **Web:** Timer-ikon i prosjektets sidebar, åpner timer-visning i prosjektkontekst
- **Konsistent:** Samme navigasjon på web og mobil
- **Samme deploy-syklus** som SiteDoc-kjernen, ingen ekstra subdomene/port

Tidligere skisser med `apps/timer` som egen Next.js-app er **forkastet** etter kundedialog (2026-04-27). Maskin-modulen følger samme integrerte mønster.

### Prototype-rute

`/dashbord/[prosjektId]/timer` — tilgjengelig via sidebar-ikon i prosjektet.

### Prototype-innhold (bygget)

**Tre faner:**

1. **Oversikt** — tabell med alle dagssedler
   - Hurtigfiltre alltid synlig: ansatt-søk, prosjekt-dropdown, dato fra-til, status-filter
   - Sortering ved klikk på kolonneoverskrift (pil opp/ned)
   - Filter-ikon på kolonner: dato-spenn, fritekst, checkbox-lister, tallintervall
   - Aktive filter som chips med × og "Fjern alle"
   - Tilleggsarbeid-kolonne med badges (E-042, E-038)
   - Sumrad nederst
   - Klikk markerer rad (blå), dobbeltklikk åpner redigering
   - Rediger-knapp (blyant) og slett-knapp (søppelbøtte) per rad

2. **Dagsseddel** — skjema med alle felter
   - Prosjektvalg, tilleggsarbeid-dropdown med endringsbeskrivelse
   - Arbeidstimer med auto-fordeling (normaltid/OT50/OT100)
   - Reisetid, tillegg med auto-forslag (overtidsmat >9t, helg)
   - Sammenleggbare seksjoner: maskiner, materialer, utlegg
   - Kopiér forrige dag-knapp
   - Redigeringsmodus: gult banner med dato og ansattnavn

3. **Rapporter** — 7 rapporttyper som klikkbare kort
   - Prosjektrapport, månedsrapport per ansatt/prosjekt, tilleggsarbeid, maskin, utlegg, eksport
   - Dato-, prosjekt- og ansatt-filter + generer/eksporter PDF
   - Rapporter-fanen bruker full bredde (statistikkpanel skjules)

**Statistikkpanel (høyre kolonne, skjult på mobil):**
- Ukeoversikt med prosjekter nedover, dager bortover
- Underrader for tilleggsarbeid per prosjekt
- Månedstotaler (normaltid, OT, reisetid)
- Årstotaler + utlegg

**Layout:**
- To-kolonner på PC: innhold (venstre) + statistikk (høyre, responsiv bredde)
- Statistikkpanel: `w-[340px] lg → w-[420px] xl → w-[500px] 2xl`
- Mobil: kun venstre kolonne

### Demodata

- Prosjekter: 998 Innstifjordbotn, E6 Kvænangsfjellet
- Ansatte: Florian Aschwanden - A. Markussen AS, Kenneth Myrhaug
- Tilleggsarbeid: E-042, E-038, E-035, G-012, E-051
- 5 dagssedler med variert data (ulike statuser, tillegg, utlegg)

### Hva prototypen IKKE gjør

- Ingen nye Prisma-modeller eller migreringer
- Ingen API-kall — alt er lokal state / hardkodet
- Ingen offline-sync
- Ingen auth-sjekk utover eksisterende prosjekttilgang
- Rapporter genereres ikke — kun filter-UI og placeholder

## Proadm-integrasjon

### Status (april 2026)

Proadm har **ikke** et offentlig REST API. Eneste eksisterende synk-integrasjon for timer/tillegg er mot SmartDok. Proadm har bekreftet interesse for å utvikle et generelt API, og SiteDoc forfølger rollen som **designpartner/pilotkunde** for dette.

Inntil REST API er på plass, utforskes tre kortsiktige spor (i prioritert rekkefølge):

1. **Gjenbruk SmartDok-formatet** — SiteDoc emitterer samme datastruktur som SmartDok sender til Proadm. Krever ingen ny utvikling på Proadm-siden. Avhenger av at Proadm deler formatspesifikasjonen.
2. **Fil-basert overføring** — daglig SFTP/CSV-drop i avtalt skjema.
3. **Direkte SQL** — kun hvis ingen av de over fungerer; mer skjørt og kundespesifikt.

### Premiss for integrasjon

- **Lønnsart-grense — regnskap eier kobling og satser** (flyttet fra CLAUDE.md 2026-10-28): SiteDoc leverer default lønnsart-numre (redigerbare per firma); lønnsart-til-konto-mapping og faktiske satser tilhører regnskap, ikke SiteDoc.
- **All godkjenning skjer i SiteDoc.** Proadm mottar kun ferdig godkjente timer, tillegg og utlegg. Ingen godkjenningsflyt eller statusoppdateringer tilbake fra Proadm — kun valideringsfeil.
- Overføringen er i praksis **envei sendende**, og **enveis hentende** for masterdata (prosjekter, ansatte, lønnsarter, endringer).

### Dataflyt (mål-arkitektur)

- **Henting:** 1x per døgn fra Proadm (batch — masterdata)
- **Sending:** 1x per døgn til Proadm (batch — godkjente timer/tillegg/utlegg)
- **Mellom-løsning:** SmartDok brukes i dag av kunden — SiteDoc erstatter denne rollen

### Foreslåtte REST-endepunkter (designpartner-utkast)

| Retning | Endepunkt | Innhold |
|---------|-----------|---------|
| Hent | `GET /ansatte` | Aktive ansatte |
| Hent | `GET /prosjekter` | Aktive prosjekter |
| Hent | `GET /kontrakter` | Kontrakter per prosjekt |
| Hent | `GET /lonnsarter` | Lønnsarter og satser |
| Hent | `GET /endringsordrer` | Endringer/godkjenninger med status |
| Send | `POST /timer` | Godkjente dagssedler |
| Send | `POST /tillegg` | Tilleggsarbeid-timer med endringsreferanse |
| Send | `POST /utlegg` | Godkjente utlegg med kvitteringsreferanse |

### Hva SiteDoc henter fra Proadm

- **Endringsmeldinger:** nummer, navn, beskrivende tekst, status
- **Godkjenninger:** nummer, navn, beskrivende tekst, status

### "Send til timeregistrering" — egen funksjon

Separat handling på en endring/godkjenning i SiteDoc. Påvirker IKKE godkjenningsforløpet i Proadm. Flagget gjør endringen tilgjengelig som valgbar referanse ved timeregistrering.

### Hva arbeider ser

- Prosjektnummer og prosjektnavn
- Endringsnummer og endringsnavn
- Beskrivende tekst som medfølger arbeidet
- Egne timer ført mot dette
- **ALDRI:** kronebeløp, kontraktsum, budsjett eller økonomidata

### Hva SiteDoc sender tilbake til Proadm

To separate strømmer:
1. **Ordinære prosjekttimer** — alle timer uten tilleggskobling
2. **Tilleggsarbeid-timer** — timer knyttet til spesifikk endring/godkjenning, med endringsnummer som referanse

### Tilgangsstyring økonomi

| Rolle | Ser |
|-------|-----|
| **Arbeider** | Kun arbeidsbeskrivelse og egne timer |
| **Leder** | Timer + kostnad (timer × timesats) |
| **Økonomi/admin** | Full kobling mot Proadm-data |

### Validering

SiteDoc validerer og godkjenner timer — ikke Proadm. Leder godkjenner i SiteDoc → data sendes i neste batch til Proadm. Proadm-siden gjør kun teknisk validering (feltformat, refererte ID-er) og rapporterer eventuelle avviste poster tilbake for korreksjon i SiteDoc.

## Rapportmodul

> **Vedtatt 2026-04-29:** Hybrid dynamisk rapport-arkitektur. Én rapport-generator i `packages/pdf/src/timer/` med komponerbare blokker, ikke 20 separate rapport-filer. Standard-presets via seed gir effekten av «faste rapport-typer» som kunden kan starte fra og justere fritt.

### Prinsipp — kunden velger fritt

Kunden skal ikke begrenses av forhåndsdefinerte kombinasjoner. Rapporten bygges dynamisk basert på filtre:
- Velg ansatt(e) — én eller flere
- Velg prosjekt(er) — ett eller flere
- Velg fra/til-dato (eller hurtig-knapper: denne uken, forrige måned, etc.)
- Tilleggsfiltre: lønnsarter, ECO/Underprosjekt, avdelinger, maskiner
- Per-kolonne `Vis [X]`-checkboxer (lønnsart-kode, timer, ECO, kommentarer, attestasjons-status, timepris, maskin, utlegg)
- Sideskift per prosjekt/ansatt (print-innstilling)

### Datamodell — `RapportInput`

```typescript
interface RapportInput {
  organizationId: string;
  fra: Date;
  til: Date;
  ansatte: { type: "alle" | "valgte"; userIds?: string[] };
  prosjekter: { type: "alle" | "valgte"; projectIds?: string[] };
  lonnsartIds?: string[];
  externalCostObjectIds?: string[];
  avdelingIds?: string[];
  byggeplassIds?: string[];
  inkludertInnhold: {
    timer: boolean;        // alltid true
    tillegg: boolean;
    maskiner: boolean;
    materialer: boolean;
    utlegg: boolean;
  };
  visning?: {
    detaljnivaa?: "auto" | "detaljert" | "aggregert";
    grupperingPrimer?: "ansatt" | "prosjekt" | "dato";
    sideskift?: { perProsjekt: boolean; perAnsatt: boolean };
    visKolonner?: {
      lonnsartKode: boolean;
      timer: boolean;
      eco: boolean;
      kommentarer: boolean;
      attestasjonsStatus: boolean;
      timepris: boolean;        // tilgangskontrolleres — kun ledere
      maskin: boolean;
      utlegg: boolean;
    };
  };
}
```

### Arkitektur — `packages/pdf/src/timer/`

```
packages/pdf/src/timer/
├── index.ts                   ← genererTimerRapport(input, data) → HTML-string
├── typer.ts                   ← RapportInput, AggregertData
├── aggregator.ts              ← rå-data → aggregert struktur
├── layout-velger.ts           ← velgLayout() basert på input + data-volum
└── blokker/
    ├── metadata-panel.ts      ← periode, filtre, generert-info
    ├── sammendrag.ts          ← sumrad-tabell
    ├── dagsseddel-detalj.ts   ← detaljert dagsseddel-blokk
    ├── ansatt-dato-matrise.ts ← ansatt × dato-tabell
    ├── prosjekt-fordeling.ts  ← prosjekt-totaler
    ├── lonnsart-fordeling.ts  ← lønnsart-totaler
    ├── eco-fordeling.ts       ← ECO/Underprosjekt-totaler
    ├── maskin-tabell.ts       ← maskinbruk-rader
    ├── materialer-tabell.ts   ← materialer-rader
    └── utlegg-tabell.ts       ← utlegg-rader m/kvitteringsbilder
```

Total: ~5-13 filer i stedet for 20. Hver blokk er gjenbrukbar.

### Layout-velger (auto-modus)

Layout-modus bestemmes av data-volum + input:

| Data-volum | Modus | Inkluderer |
|---|---|---|
| ≤5 dagssedler | `detaljert` | Alle dagsseddel-blokker (full detalj) |
| 6-50 dagssedler | `mellom` | Ansatt × dato-matrise + lønnsart-fordeling |
| >50 dagssedler | `aggregert` | Strikt sumrad-tabeller, ingen dagsseddel-detaljer |

Bruker kan overstyre via `input.visning.detaljnivaa`.

### Standard-presets (seed via C.10)

Ved firma-opprettelse seedes 4 standard-presets som lagrede konfigurasjoner. Kunden kan bruke dem direkte eller som utgangspunkt for egne varianter:

| Preset | Konfigurasjon |
|---|---|
| **Dagsseddel** | 1 ansatt × 1 prosjekt × 1 dag, alle kolonner, detaljert modus |
| **Ukerapport prosjekt** | Alle ansatte × 1 prosjekt × denne uken, mellom modus |
| **Månedsrapport ansatt** | 1 ansatt × alle prosjekter × denne måneden, mellom modus |
| **Lønnsrapport firma** | Alle ansatte × alle prosjekter × forrige måned, aggregert modus |

### Lagrede konfigurasjoner

Brukeren kan lagre sine egne filterkombinasjoner med navn («Min ukerapport», «Lønn april 2026»). Ny tabell:

```prisma
model TimerRapportKonfig {
  id              String   @id @default(uuid())
  organizationId  String
  userId          String   // eier
  navn            String
  konfig          Json     // hele RapportInput
  delt            Boolean  @default(false)  // synlig for andre i firma
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([organizationId, userId])
  @@index([organizationId, delt])  // delte konfigurasjoner i firma
}
```

### UI-side

**Lokasjon:** `apps/web/src/app/dashbord/firma/timer/rapport/page.tsx` (firma-kontekst). Utledbart: `find apps/web/src/app -path "*timer*rapport*" -name page.tsx`.

**Mønster:** Én dedikert rapport-side (ikke modal). Filter-panel + forhåndsvisning som faktisk HTML-rendering. Brukeren ser hva som genereres FØR de bestiller PDF.

**Async-jobb + historikk + e-post:** Utsettes til Fase 3.5. For Fase 3 antas datavolum moderat — synkron generering er tilstrekkelig.

### Lønnssystem-eksport — separat fra rapport-modul

Eksport til lønnssystem (Poweroffice/Tripletex/etc.) går via egen `timer.eksport`-tRPC-rute med fast format styrt av target-system. Ikke del av rapport-generatoren.

## Ikke avklart

- Godkjenningsflyt detaljer — batch-godkjenning (uke), enkelt-godkjenning (dag), eller begge? Krever kunde-input fra A.Markussen.

> **Lukket 2026-04-29:**
> - **GPS-validering** → Variant A: ingen GPS-validering i Fase 3. Mannskap-modulen (Fase 4) håndterer geofence-innsjekk separat. Per memory `feedback_tilstedevarelse_arbeidstid` er Timer frikoblet fra geofence.
> - **Akkord** → Variant A: ikke støttet i Fase 3. A.Markussen bruker ikke akkord (per smartdok-undersokelse). Lønnsart-modellen kan utvides senere som type-utvidelse hvis ønsket.
> - **Arbeidstidskalender** → Variant C: manuelt + import-knapp. Detaljer i § Database-modeller > `arbeidstidskalender` ovenfor.
> - **PDF-rapporter** → Hybrid dynamisk arkitektur (per § Rapportmodul ovenfor). 20 forhåndsdefinerte rapport-typer er forkastet til fordel for én generator + 4 standard-presets + lagrede konfigurasjoner.
> - **Drømmescenario ProAdm → SiteDoc Godkjenning** → Backlog. Ikke implementeres i Fase 3.

## 🟡 Systemisk funn 2026-10-01 — TOCTOU-vindu i rad-mutasjonene

**Funnet av kontrolløren under gaten av `forsonDagskort`.** `erRedigerbar`-sjekken leses
**utenfor** transaksjonen i `tilfoyTimerRad`, `oppdater*` og `slett*`
(`apps/api/src/routes/timer/dagsseddel.ts`). **Blir dagsseddelen attestert i vinduet mellom
sjekk og skriving, lander endringen på et låst kort.**

🟢 **`forsonDagskort` er lukket** (`9c7c1ad1`): status-betinget `updateMany` åpner den
interaktive transaksjonen, UPDATE tar radlås til commit, `count === 0` → `PRECONDITION_FAILED`
og full tilbakerulling. **Mønsteret er det samme som `SedelAttestertConflict`-vernet.**

🔴 **De tre eldre er IKKE lukket. Ikke bestilt — ført her så det ikke bare lever i en
gitignorert innboks.**

| Forhold | Vurdering |
|---|---|
| Utfall | **Mindre enn `forsonDagskort`** — de skriver én rad, ikke hele dagen |
| Vei inn | Smal: `returned → accepted` krever samtidig `sendInn` + leder-attestering (`:2310`) |
| Vernet | **Ligger ferdig i samme fil** — mønsteret er etablert, så en fiks er mekanisk |

⚠️ **Dette er ikke «akseptert risiko» — det er et uløst funn.** Kenneth har ikke tatt stilling
til det, og en føring som sier at risikoen er godtatt ville vært et vedtak ingen har fattet.

