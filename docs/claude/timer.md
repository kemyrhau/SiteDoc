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
| `OrganizationSetting.tillattSelvAttestering` | ✅ Tilføyd 2026-05-01 (Infrastruktur-commit, default true) | Selv-attestering-policy |
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
| **Runde 1C** — Leder-attestering | 🟢 Implementert 2026-05-01 (`feature/timer-1c`) | 4 nye endepunkter i dagsseddel.ts: hentTilAttestering/kanAttestere/returner/attester (omdøpt fra hentTilGodkjenning/kanGodkjenne 2026-05-02). Snapshot-pattern (Fase 0 A.7) ved attester — pris kopieres til SheetTimer.attestertSnapshot/SheetTillegg.attestertSnapshot JSON. Web-side `/timer/attestering` for ledere. Sidebar-element gates på `harTimerModul && kanAttestere`. Detaljside utvidet med returned/accepted-banner. ~17 nye i18n-nøkler. **Forenklet godkjenningsflyt mot ansatt utsatt** (timer.md:565+) — krever leder-genererer-seddel-på-vegne-av-ansatt-flyt, tas i egen runde |
| **Runde 2** — Mobil + offline-sync (MVP) | 🟢 KOMPLETT på develop 2026-05-02 (`feature/timer-2` merget via `1cce62f3`) | C1 Drizzle-skjema (6 lokale SQLite-tabeller — dagsseddel_local + 2 rad-tabeller + 3 katalog-cache). C2 server-side `timer.dagsseddel.syncBatch` (per-seddel `$transaction`, uavhengig resultat per seddel: ok/conflict/feilet, maks 100 sedler per kall) + `hentEndringerSiden` (delta-pull siden timestamp). C3 sync-motor (`apps/mobile/src/services/timerSync.ts`) + `TimerSyncProvider` (NetInfo-trigger + 30s aktiv-app-interval + manuell pull-to-refresh). C4 katalog-cache (`timerKatalog.ts`, full overskriving av lonnsart/aktivitet/tillegg-tabeller ved login). C5 UI-liste (`/timer/index.tsx`) + `TimerSyncStatusBar` + `TimerStatusMerkelapp` + Mer-tab Timer-rad med pending/conflict-badge. C6 opprett-skjema (`/timer/ny.tsx`) med DateTimePicker + prosjekt-velger + aktivitet-velger + clientUuid generering, og detaljside (`/timer/[id].tsx`) med status-banners (returned/accepted/conflict/pending) + 4 inline modaler (TimerRadModal/TilleggRadModal/LonnsartVelgerModal/TilleggVelgerModal) + send-til-attestering + slett. C7 ~50 nye i18n-nøkler — total 155 timer-nøkler per språk. **C8 Underprosjekt-velger** — ny `eksternKostObjekt.list({projectId?})`-router (kjernen-DB), ny `external_cost_object_local`-tabell + idempotent migrering, `refreshKatalog` henter ECO-er via Promise.all med catch-fallback, UnderprosjektVelgerModal i TimerRadModal (filtrer på prosjekt + søk når > 7), ECO-etikett under lønnsart i TimerRadVis, fjern-X-knapp ved siden av valgt ECO. C5 visuelt verifisert 2026-05-02 på iOS Simulator + fysisk mobil. **Test-deploy + prod-deploy av C6–C8 utsatt til neste sesjon.** **Scope-utelatelser per Runde 2 MVP** (utsatt til 2.5/3): utlegg + maskin på dagsseddel, leder-attestering på mobil, aktivitet-på-rad-nivå (designes sammen med maskintimer-Runde 2.5), `sheet_machines`/`sheet_materials`/`sheet_expenses` + ~~`arbeidstidskalender`~~ (kalender flyttet til kjernen-DB i [T.9 2026-05-15](fase-0-beslutninger.md)) |
| **Runde 2.5 / C9** — Aktivitet per rad + sheet_machines | 🟢 Implementert 2026-05-02 (`feature/timer-2.5`) | `SheetTimer.aktivitetId` NOT NULL (backfill fra parent), `DailySheet.aktivitetId` nullable default, `SheetMachine`-tabell, `ExternalCostObject.proAdmType String?` (kjernen, fri tekst), `timer.dagsseddel.maskin.*` mutations, `timer.dagsseddel.hentDagstotal`, web maskin-seksjon med soft-skjul, mobil aktivitet-per-rad-velger. Maskin-cache mobil utsatt til 2.6. Se [dagsseddel-design.md](dagsseddel-design.md) for vedtatte beslutninger og [fase-0-beslutninger.md C.18](fase-0-beslutninger.md). |
| **Runde 2.6** — Mobil maskin-cache | 🟢 Implementert 2026-05-02 (`feature/timer-2.6`) | `equipment_local` Drizzle-tabell + `maskinKatalog.ts` (refresh ved login + nett-gjenkomst, parallelt med Timer-katalog) + MaskinSeksjon/MaskinRadModal/EquipmentVelgerModal/EnhetVelgerModal i mobil [id].tsx + soft-skjul (skjules når Equipment-cache er tom). Utgåtte ekskludert fra velger via filter (status≠'utgaatt'). Søk-felt i velger når > 7 elementer. ~7 nye i18n-nøkler nb+en. Sync-motor allerede på plass i C9 — sheet_machine_local sendes/mottas. |
| **Runde 2.7** — Mine timer + dagstotal-banner + ukesoppsummering | 🟢 Implementert 2026-05-02 (`feature/timer-2.7`) | DagstotalBanner-komponent på mobil (lokal Drizzle-spørring, brukes i ny.tsx + [id].tsx) — viser sum timer på tvers av prosjekter for valgt dato. UkeTotalBanner mobil i `/timer/index.tsx`. Web uke-navigator utvidet med totalsum «Uke X — totalt Y.YYt». Ny `/dashbord/timer/mine` (web): periode-velger (5 valg inkl. egendefinert), 4 oppsummerings-kort, per aktivitet/status-aggregeringer, detaljliste. Sidebar-element «Mine timer» i firma-layout (gates på timer-modul). Ny `/timer/mine` (mobil): periode-toggle (3 valg), 2 pills, aktivitet-aggregering, detaljliste. Mer-tab Timer-rad fikk søsken-link «Mine timer». Bruker eksisterende `timer.dagsseddel.list` med klient-side aggregering. ~22 nye i18n-nøkler nb+en. Ingen DB-migrasjon, ingen server-endring. |
| **Runde 3** — Eksport-adaptere | ❌ Ikke startet | Proadm/Tripletex/Visma/Poweroffice-adaptere |
| **T.1–T.6 arkitektur-redesign** | 🟢 Deployet prod 2026-05-12 | 5 PR-er (`862c70c3`/`bba971ba`/`6431873c`/`8478d4a7`/`0700b8ed`). DailySheet.projectId droppet, projectId på rad-nivå (NOT NULL), fra/til per rad (T.4), per-rad attestering-felter (T.3), `OrganizationSetting.tidsrundingMinutter` (T.5). Detaljer i [fase-0-beslutninger.md § T](fase-0-beslutninger.md) + [STATUS-AKTUELT.md § Implementasjonsstatus](STATUS-AKTUELT.md). |
| **PR 2C full (mobil Drizzle-omskriving)** | 🟡 Delvis (kjernen levert, rest utsatt) | **✅ Levert (T7-3b1/T4):** per-rad `projectId` + `fraTid`/`tilTid` på `sheet_timer_local`/`sheet_machine_local`; `timerSync.ts` sender projectId per rad; screens (`[id].tsx`/`ny.tsx`/`mine.tsx`) bruker rad-nivå-modellen. **🔴 Genuint åpent:** `dagsseddel_local.project_id` fortsatt `.notNull()` på sedel-nivå (`schema:84`, SQLite TABLE-recreate kreves for nullable) + `byggeplass_id` + attestert-felter på rad-tabellene + NOT NULL-constraint + full backfill fra parent. PR 2C min (`0700b8ed`) leverer kun defensiv null-guard. Resten utsatt til nytt krav (f.eks. mobil-flerprosjekt-dagsseddel) trigger den. |
| **Web-timer T.1-korrekthet (interim)** | 🟢 Implementert 2026-07-05 (develop) | Web-UI behandlet dagsseddel som prosjekt-eid (foreldet mot T.1). Tre fiks: **①** `dagsseddel.list` bruker eksplisitt `where` med rad-prosjekt-filter `timer: { some: { projectId } }` (spread av ugyldig `projectId` på `DailySheetWhereInput` var runtime-brutt → prosjekt-kontekst-lista var alltid tom); **②** `list` beriker hver sedel med `prosjektIder` (distinct på tvers av timer-/maskin-/tillegg-rader) → `mine/page.tsx` viser faktiske prosjekter i stedet for «—»; **③** web-opprett (`dashbord/timer/ny/page.tsx`) er nå **dato-only** — `opprett`-input droppet `projectId`, auth via org-tilgang (`krevBrukersOrg`+`krevTimerAktivert`) i stedet for `verifiserProsjektmedlem`, prosjekt-velger + geo-forslag fjernet. Prosjekt legges per rad på detalj-siden (allerede T.1-korrekt). **PSI-drevet auto-forslag av prosjekt (④) forblir Fase 4 Mannskap/PSI.** Se [BACKLOG § Web-timer-UI T.1-korrekthet](BACKLOG.md). |
| **Dagsseddel a2 — arbeidstid-vindu forhåndsutfylt + degradert** | 🟢 Implementert 2026-07-06 (develop) | Fjerner dobbel-timeførings-artefakten (arbeider førte total arbeidstid PÅ sedel-nivå + rader på nytt). **Server:** `dagsseddel.opprett` prefyller `startAt`/`endAt`/`pauseMin` fra firma-kalenderen (`hentEffektivArbeidstid`) når klienten ikke sender et vindu — i stedet for tomt. Ny helper `osloVeggurTilInstant` anker veggur-tid til Europe/Oslo (DST-bevisst; serveren kjører UTC i Docker). **UI degradert** (web `timer/[id]/page.tsx` + mobil `ArbeidstidSeksjon.tsx`): «Arbeidstid i dag» fra primær/påkrevd → sekundær/forhåndsutfylt/overstyrbar (ny streng `timer.arbeidstidPrefyltHint` — «timene føres på radene»); rediger-modalen beholdt for glemt-dag/korreksjon. Radene + topp-sum er primær-flaten. **Bevart:** `pauseMin` som sedel-felt (maskin ≤ arbeid-buffer, `validerMaskinUnderArbeid`), auto-gen-stien (`StartSluttDagKort.tsx`) urørt, arbeidstids-varselet (varighetsbasert → TZ-invariant). Ingen migrering. i18n: nb+en (13 øvrige via redesignets neste `generate.ts`, regel 3). **a1 (utled total fra rader) + web-norm-paritet = fremtidig.** |
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

**Selv-attestering vs send-til-leder:** To knapper — kunden velger via `OrganizationSetting.tillattSelvAttestering` om begge tillates, eller kun «Send til leder».

### Pause-bevisst tid-synk på timer-rader (mobil) — implementert 2026-07-08 (develop `f385ba99`)

Utility: `@sitedoc/shared/utils/pauseBeregning.ts` (delt mobil + web; mobil-kopien slettet i M2 2026-07-10). Brukes av `TimerRadModal` (`TimerSeksjon.tsx`).

**Auto-synk «antall timer» ↔ «fra/til» (sist-rørte felt vinner):**
- Endrer fra/til → `antall = effektiveTimerFraSpenn(...)` (spennvidde − pauseoverlapp).
- Skriver antall → `til = tilFraAntall(fra, antall, ...)` (pausevinduet skjøvet inn når arbeidet krysser lunsj).
- **Konsistens-validering** ved lagring: når begge tider er satt MÅ antall stemme med (spenn − pause), ellers blokkeres lagring (`timer.feil.timerAvvik`). Fjerner tidligere «stille avvik»-bug.

**Pausevindu — skiftrelativt (erstatter fast klokkeslett):** `pauseVinduFra(skiftStart, standardPauseEtterTimer)`. Feltet **`OrganizationSetting.standardPauseEtterTimer`** (Float, default 4,0 t) erstattet `standardPauseFra` (to-stegs migrering, gammelt felt beholdt — migrering `20260708120000_...`). 07:00-start → pausevindu 11:00–11:30 (ingen regresjon); nattskift 21:00-start → 01:00–01:30. Varighet fra `standardPauseMin` (30). En rad som spenner over vinduet får overlappen trukket fra (10:00–12:00 → 1,50 t), vist som «−30 min lunsjpause trukket fra».

**Skille mot `pauseMin`:** dette er en **rad-nivå** fradragsvisning i modalen. `pauseMin` forblir **sedel-nivå** (maskin ≤ arbeid-buffer, `validerMaskinUnderArbeid`) — de to lever side om side.

**5,5t-terskel (AML §10-9) — når pausen i det hele tatt gjelder:** `PAUSE_TERSKEL_TIMER = 5.5` i `pauseBeregning.ts`. `pauseMinForDag(dagsTotalBruttoTimer, standardPauseMin)` returnerer `standardPauseMin` KUN når dagens totale brutto arbeidstid > 5,5 t, ellers 0. Gaten er **dagstotal-basert, ikke per rad** (en dag splittet i flere rader skal verken miste eller få pause av rad-splitten). Ligger i `fordelArbeidstidFradrag` (`apps/mobile/src/utils/dagsforslag.ts`, LAG 0b-splitt) der dagstotalen finnes. To ortogonale regler: **hvor** pausen faller (4,0t-vinduet) vs. **om** den gjelder (5,5t-terskelen).

**Web-speiling:** attestering (`RedigerRadModal.tsx`) og firma-innstillinger (`firma/innstillinger/page.tsx`) bruker samme skiftrelative modell.

### F5 — matpause-bærer per timer-rad (mobil) — ⚠️ WIP branch `fix/timer-mobil-f2f3f5` (cowork-gate pending, ikke deployet)

Additivt felt **`SheetTimer.pauseMin` / `sheet_timer_local.pauseMin`** (Int NOT NULL DEFAULT 0): minutter lunsjpause DENNE raden trekker. Kun ÉN rad per sedel bærer pausen (`pauseMin > 0`); kun-én-per-dag håndheves som **flytt**, ikke radio. Bæreren settes ved generering = **lunsj-kryssende carve-rad** (Valg A, gate-endorsert 2026-07-14; respekterer «ikke rør carve» — carve legger pausen på ett vindu, den raden får `pauseMin`). Rad-timer holdes konsistent: `rad.timer = effektiveTimerFraSpenn(fra, til, pauseFra, rad.pauseMin)` (deployert modell, gjenbrukt).

- **UI** (`TimerSeksjon.tsx` `TimerRadVis`): kompakt checkbox «Matpause trukket (30 min)» nederst på rad-kortet, kun synlig når regelen trigger (dagsbrutto > 5,5t) OG raden krysser lunsjvinduet. Bæreren avhuket; andre kvalifiserte rader viser tom checkbox.
- **Flytt-interaksjon** (`services/matpause.ts`, orkestrert i `timer/[id].tsx`): huk PÅ annen rad → sett bærer der (forrige nulles stille); huk AV bæreren → flytt til neste kvalifiserte rad (lengste-først) + toast; ingen kvalifisert → **ekte bekreftelsesmodal** «Ingen pause trekkes for dagen» (AML-varsel, ikke `confirm`/`Alert`).
- **Kryss-modul-invariant (bevarer maskin-kapasitetsregelen):** ved HVER endring settes `dagsseddel_local.pauseMin = Σ(sheet_timer_local.pauseMin)` i samme lokale tx. Maskin-regelen (`validerMaskinUnderArbeid` / `maskinKapasitet.ts`) bruker fortsatt **sedel-nivå** pauseMin uendret — **`sheet_machines` får INGEN pauseMin** (maskin går gjennom operatørens pause; paritet ville vært semantisk feil). Modul-avhengighet verifisert 2026-07-14 mot [dagsseddel-design.md](dagsseddel-design.md) + [maskin.md](maskin.md).
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
- **PK6 `synkroniserHodePause(tx, sheetId)`:** etter HVER radskriving settes `DailySheet.pauseMin = Σ aktive rad.pauseMin` (ekskl. `erstattet`) i samme tx (+ bumper `updatedAt`). Kalt fra alle radskrivere + sletting + `syncBatch` + `opprettForsteTimerRadForslag`. `syncBatch`/`redigerSedelRader` IGNORERER payloadens hode-pause. Maskin-bucket-buffer (`validerMaskinUnderArbeid`) bruker nå Σ rad (synk: `max(Σ, payload-hode)` så eldre app aldri avvises strengere).
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

⚠️ **Venter Kontrollør-gate.** Spec: [timer-pause-en-kilde-spec.md § 8](timer-pause-en-kilde-spec.md). Når manuelle rader (eller dagens sum) passerer firmaets dagsnorm, viser rad-dialogen **én linje med én knapp**. Ingenting skrives automatisk.

- **Regelen er én ren funksjon:** `foreslaOvertidSplitt` ([overtidForslag.ts](../../packages/shared/src/utils/overtidForslag.ts)). Radene tas kronologisk på `fraTid`; normaltid fylles før overtid. Reise er aldri overtid og teller ikke mot normen (V1). Nivå og lønnsart kommer fra `klassifiserArbeidstid` + `velgOvertidLonnsart` (strukturert `overtidsnivaa`). Uten dagsnorm eller uten overtid-lønnsart → ingen linje. Rader som alt står på overtid teller mot summen, men får ikke forslag.
- **Raden som krysser normen deles** ved `tilFraAntall`, så hver del er konsistent med pausevinduet og serverens PK4-sjekk (`vurderRadTimer`). Matpausen følger delen pausevinduet ligger i. Eksempel (regelen, ikke specens tall): 07:00–16:00 med 30 min pause og norm 7,5 t deles **kl. 15:00** → Timelønn 07:00–15:00 (7,5 t) + Overtid 50 % 15:00–16:00 (1 t). Linja: «1 t over dagsnorm — del i Timelønn 07:00–15:00 + Overtid 50 % 15:00–16:00?» · knapp «Del raden» (`timer.overtidForslag.splitt`/`delKnapp`).
- **Rad helt etter normen** (`normal: null`): «X t over dagsnorm — før som Overtid N %?» · knapp «Før som overtid» (`timer.overtidForslag.helRad`/`helKnapp`). Knappen bytter kun lønnsarten.
- **Web** (`TimerRadDialog` i [page.tsx](../../apps/web/src/app/dashbord/timer/%5Bid%5D/page.tsx), `overtidForslag` + `brukOvertidForslag`): forslaget regnes av de andre radene + dialogens egne verdier. Splitten er **to kall** på eksisterende stier — `oppdaterTimerRad` (normal-delen, egen mutasjon `oppdaterDel` som ikke lukker dialogen; ny rad: `tilfoyTimerRad`) og så `tilfoyTimerRad` for overtid-delen. Normen sendes inn som `normTimer`.
  - **Kjent begrensning:** feiler kall 2, viser dialogen feilen og raden står igjen forkortet til normal-delen. Brukeren legger da til overtid-delen manuelt. Ingen transaksjon (`splittRadEier` brukes ikke).
- **Mobil** (`TimerRadModal` i [TimerSeksjon.tsx](../../apps/mobile/src/components/timer-detalj/TimerSeksjon.tsx), `overtidForslag` + `lagre(forslag)`): normen kommer som `dagsnormTimer` fra `app/timer/[id].tsx` via `ProsjektGruppe` → `EcoBucket` → `TimerSeksjon`. Splitten = `onLagre` med normal-delen + `onLeggTilOvertidDel` (lokal `leggTil`) for overtid-delen; lønnsartkatalogen fra `hentLonnsarterLokalt`. Forskjell fra web: en tilknyttet maskin følger normal-delen.
- **Omfang:** kun dagskortets rad-dialog (web + mobil). Bekreft dag, prosjektkortet (`DagSeksjon`) og `NyTimerRadFlyt` er urørt; `SummeringsBanner` og vanlig radlagring uendret. Vakt `dagskort-isolert-vakt.test.ts` står.
- **Tester:** `overtidForslag.test.ts` (over/lik/under norm, ingen overtid-lønnsart, ingen norm, reise, flere rader kronologisk, rad helt etter normen, rad alt på overtid, pause i overtid-delen).

**Web-paritet bolk (a) — implementert 2026-07-09 (branch `feature/timer-web-paritet-a`, D2/D3/D7/D1):** Pause-utilen er løftet fra mobil-only til **`@sitedoc/shared/utils/pauseBeregning.ts`** (delt av mobil + web, jf. `maskinKapasitet.ts`). Arbeiderens web-`TimerRadDialog` (`timer/[id]/page.tsx`) har nå **Prosjekt-velger** (låst ved redigering — server `oppdaterTimerRad` flytter ikke rad mellom prosjekter, egen oppfølger) + **Fra/til** med samme fra/til↔antall-synk. Pausevindu-parametre hentes fra `hentArbeidstidDefaults` (medlems-tilgjengelig; `hentSetting` krever firma-admin). **D7:** web `ny/page.tsx` krever nå Prosjekt\* og bærer valget via `?nyttProsjekt=` til detalj-siden (forhåndsåpner gruppa) — `DailySheet` forblir projectId-løst (T.1), sedel-prosjekt er UI/session-konsept. **D1:** `dagsseddel.opprett` returnerer eksisterende sedel (`eksisterte:true`) ved duplikat-dato i stedet for P2002 → web åpner eksisterende med notis (mobil-atferd). Server `oppdaterTimerRad` tar nå `fraTid`/`tilTid`. Se [BACKLOG § Timer web-vs-mobil paritet](BACKLOG.md).

**Web-paritet bolk (b) — implementert 2026-07-09 (branch `feature/timer-web-paritet-b`, D4/D5/D6):** **D4** — kvittering-opplasting i web `TilleggRadDialog` (`FormData` → `/api/upload` → `tilfoyTilleggVedlegg`; thumbnails + fjern; kun på lagret rad, som mobil). **D5** — `hentMedId` eksponerer `manglerMaskinforerbevis` (via `harGyldigMaskinforerbevis`); amber info-banner til arbeideren i detalj-siden når sedelen har maskin-rader (T.11-paritet — web viste det før kun i attestering). **D6** — arbeider-`EcoGruppe` maskin ≤ arbeid-indikator bruker nå delt `overstigerMaskinTak` med pause-buffer (`pauseMin` fra sedel) — identisk med attestering + server; det gamle `+ 0.001`-uten-buffer er fjernet.

**Web-paritet bolk (c) — implementert 2026-07-09 (branch `feature/timer-web-paritet-c`, D8):** «Mine timer» (`dashbord/timer/mine/page.tsx`) fikk **«Ny dagsseddel»-knapp** i headeren → `/dashbord/timer/ny` (prosjekt velges der, D7 — ikke på oversikten) + **kladd-påminnelse** (amber) for usendte drafts med innhold fra tidligere dager (mobil `DagsseddelListe` UF-3). Kladd-sjekken bruker en egen periode-UAVHENGIG `list({status:"draft"})` slik at en glemt kladd utenfor valgt periode fortsatt fanges; lenker til eldste. Flagg-uavhengig side-innhold (FM5 lever i nav-komponentene). Ingen ny i18n (`timer.nyDagsseddel`/`timer.kladdPaaminnelse` fantes). Dermed er D1–D8 alle levert/på-branch; D9 (sesong-dagsnorm) + GPS-geoforslag gjenstår som egne rader.

**Web-paritet bolk (e)/(f)/(g) + vedtatte domeneregler — 2026-07-09 (develop).** Bolk (e) `f101890e` (pause-bevisst maskin-rad), (f) `f59a498c` (gjenåpne + attestert-vakt) + `1deaff6b` (slett-modal), (g) `79e786a3`/`c81c4eae` (gyldighet). Vedtatte regler (Kenneth 2026-07-09):

- **B1 — maskin-rad trekker lunsjpause** som timer-rad. Begrunnelse: maskin selges som **maskin + fører**; en maskin uten fører er ikke fakturerbar → maskintimene følger førerens pause-justerte arbeidstid.
- **B2 — spenn-validering (hard sperre):** når fra OG til er satt, MÅ `antall == effektiveTimerFraSpenn(fra, til, pauseFra, standardPauseMin)`. **Kun klient-sperre** — web (`MaskinRadDialog`/`TimerRadDialog` i `dashbord/timer/[id]/page.tsx`, `handleSubmit`) og mobil (`MaskinSeksjon`/`TimerSeksjon` `lagre()`; maskin lagt i M5 2026-07-10). **Serveren håndhever IKKE B2** — `effektiveTimerFraSpenn`/`timerAvvik`/`pauseOverlappMin` har **0 treff** i `apps/api/src`; serveren håndhever kun fra<til (`refineFraForTil`/`finnTidsromKonflikt`) og timer-overlapp. En klient som omgår sperren kan skrive avvikende antall. Se [BACKLOG § B2 er ikke håndhevet på serveren](BACKLOG.md). **Kun nye/redigerte rader** — 11 seed-rader i `sheet_machines` avviker (per 2026-07-09; retro-avvises ikke, se BACKLOG).
- **B3 — antall forhåndsutfylles** fra prefill-spennet. Web timer+maskin ✅; **mobil maskin ✅ (M5 2026-07-10** — `MaskinSeksjon`s `timer`-init kaller `effektiveTimerFraSpenn`); **mobil timer ✅ (M6 2026-07-10** — `TimerSeksjon`s `timer`-init lazy-kaller `effektiveTimerFraSpenn` når `prefillGyldig`; `tilTid` prefylles kun ved gyldig prefill, som web). Er beregnet fra ≥ til, forhåndsutfylles verken til eller antall (ingen ugyldig rad). **Prefill-scope (M6):** mobil timer-`defaultTider.fra` løftet fra bøtte-scopet siste-rad til **seneste `tilTid` over hele sedelen** (`alleTimerRader`), beregnet som **maks** via `hhmmTilMin` (ikke array-rekkefølge) — speiler webs `onTilfoyTimer`-reduce.
- **B4 — betydningsendring: `SheetMachine.fraTid/tilTid` = maskinens DRIFTSVINDU**, ikke førerens arbeidsvindu. En maskin som gikk 5 t registreres som **07:00–12:00**, ikke som 5 t i et 8-timers vindu. Vedtatt fordi feltene historisk har vært frikoblet, og fordi maskintimer skal kunne **eksporteres til SmartDok uten gjetting**. Web maskin-prefill (bucketens arbeidsspenn) er kanonisk; **mobil løftet i M5 2026-07-10** — `MaskinSeksjon`s `defaultTider` leser bucketens timer-rader (`bucketTimer[0].fraTid` / `bucketTimer[..].tilTid` for `(defaultProjectId, defaultEcoId)`), faller til kalenderens effektive start/slutt.
- **B1/B2/B3 mobil maskin (M5, 2026-07-10):** `MaskinSeksjon.tsx` speiler nå `MaskinRadDialog` — pause-bevisst auto-synk antall ↔ fra/til (`handterFraEndret`/`handterTilEndret`/`handterTimerEndret` via delt `effektiveTimerFraSpenn`/`tilFraAntall`), B1 med `standardPauseMin` (firma-default, «maskin følger føreren»), B2-sperre i `lagre()`. `standardPauseMin`/`pauseEtterTimer` fra `hentOrganizationSettingLokalt`, skiftstart fra `hentEffektivArbeidstidLokal`. Ingen ny i18n, ingen SQLite-migrering. **Synk-vakt:** `syncBatch` validerer nå maskin-`fra<til` (`tilErEtterFra` på `lokal.maskiner`) FØR `createMany` → `"avvist"` (SYNC-1); før M5 omgikk synkveien vakten (SYNC-2 dekket kun timer-rader). Se [mobil.md § Timer](mobil.md).
- **Overlapp (server-sperre, alle skriveveier fra SYNC-2 2026-07-10):** en arbeider kan ikke registrere **overlappende timer-rader** på samme sedel, på tvers av prosjekt og underprosjekt (én arbeider kan ikke være to steder). Regelen ligger delt i `@sitedoc/shared/utils/tidsromValidering.ts` (`tilErEtterFra`, `finnOverlappendeTidsrom`, `finnTidsromKonflikt`). Web-mutasjonene `tilfoyTimerRad`/`oppdaterTimerRad` kaller den via `sjekkTimerOverlapp`/`refineFraForTil`; mobilens synkvei `syncBatch` via `finnTidsromKonflikt` (batch-intern — hele dagen sendes i én `createMany`, ingen rad finnes i basen ennå). **Berøring i endepunkt** (12:00 slutt = 12:00 start) er tillatt (strengt overlapp). Avvisning på synkveien rutes via `"avvist"` (SYNC-1). **Mobil klient-speiling (M3, 2026-07-10):** `TimerSeksjon`s lagre-handler kaller `finnOverlappendeTidsrom` mot **alle timer-rader på sedelen på tvers av (projectId, ECO)-bøtter** (`alleTimerRader`-prop fra sedelens fulle rad-liste, ikke det bøtte-scopede `rader`), ekskl. raden som redigeres, pluss `tilErEtterFra`. Blokkerer lagring lokalt (`timer.feil.overlapp`/`timer.feil.sluttForStart`) før synk — samme kryss-bøtte-regel som serveren. Prefill er fortsatt bøtte-scopet (eget scope, ikke overlapp). Pre-eksisterende overlapp låser ikke arbeideren ute (sjekk kun i lagre-handleren, egen rad ekskludert). Maskin-rader overlapp-sjekkes ikke mot timer-rader; maskin-vs-maskin ikke ennå (BACKLOG-utredning).

- **fra/til på synkveien (SYNC-2, 2026-07-10):** `syncBatch` **persisterer nå** `fraTid`/`tilTid` på timer- og maskin-rader (input-skjema + begge `createMany`). Før SYNC-2 strippet Zod-input feltene og `createMany` utelot dem, mens `syncBatch` samtidig gjør `deleteMany` + `createMany` per sedel → en mobilsynk **slettet** tider som var ført på web på samme sedel (T4-d koblet kun lese-/online-siden). Kolonnene fantes hele tiden; ingen migrering. Se [BACKLOG § Timer web-vs-mobil paritet](BACKLOG.md).

- **Synk-resultat per sedel (SYNC-1, 2026-07-10):** `syncBatch` returnerer `resultat: "ok" | "conflict" | "avvist" | "feilet"` per sedel. `avvist` = **permanent** avvisning klienten ikke kan rette via retry (P2002-duplikat, katalog-mismatch aktivitet/lønnsart/tillegg, `validerMaskinUnderArbeid`, FORBIDDEN — og fra SYNC-2 overlapp/`fra<til`); `feilet` = **transient** (nettverk, ukjent DB-kode) som beholdes pending og retries. Mobil (`timerSync.ts` `anvendSvar`) setter `avvist` til terminal lokal `syncStatus="avvist"` → raden forlater pending (30s-retryen stopper) og vises med rødt banner i `timer/[id].tsx` + rødt `TimerSyncStatusBar`-varsel. Arbeideren retter (redigering setter status tilbake til `pending`) eller sletter. Pull overskriver ikke en `avvist`-rad. Bakoverkompat: eldre klient (#37) faller til else på ukjent `avvist` → beholder pending (uendret oppførsel).
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
- **Mobil:** `EquipmentVelgerModal` (`MaskinSeksjon.tsx`) utvidet med kategori-chip-rad + samme sortering + «brukt»-markør (søkefeltet fantes fra Runde 2.6).

**Sist brukte maskiner øverst (ORDRE 29, 2026-11-06, `feat/byggeplass-kontekst-2` — 🟡 ikke merget).** Brukerens 5 sist brukte maskiner i firmaet (`SIST_BRUKTE_MASKINER_ANTALL`) løftes øverst og merkes `timer.maskin.sistBrukt` («sist brukt»). Sorteringen er delt: `sorterMaskiner` i `packages/shared/src/utils/maskinSortering.ts` (sist brukt → brukt-på-seddelen → internNummer → navn), brukt av både web og mobil.
- **Web:** `timer.dagsseddel.sistBrukteMaskiner({ organizationId })` (`apps/api/src/routes/timer/dagsseddel.ts`) — kun egne sedler (`sheet.userId = ctx.userId`) i firmaet, ikke-ansatt → `[]`. Sendes som `sistBrukt` til `MaskinVelger` fra `MaskinRadDialog`/`TimerRadDialog` (`timer/[id]/page.tsx`). **Attestering får ikke sist brukte** (`RedigerRadModal`/`RedigerMaskinRad` sender ingen `sistBrukt`).
- **Mobil:** `sistBrukteMaskiner(db, userId, organizationId)` (`apps/mobile/src/services/nyTimerRad.ts`) leser lokal SQLite (`sheet_machine_local` ⋈ `dagsseddel_local`), virker offline; brukt i `EquipmentVelgerModal`.

### Maskin ≤ arbeidstimer — invariant + proaktiv UI (T7-4b + 2026-07-05)

**Regel (T7-4b, låst 2026-05-16 + pause-modell 2026-05-18):** per `(projectId, externalCostObjectId)`-bucket må `sum(maskin.timer) ≤ sum(arbeid.timer) + pauseMin/60` (epsilon `0.001`; `pauseMin` er sedel-nivå, tillegges hver bucket — maskin kan gå mens operatør pauser). Server håndhever i `validerMaskinUnderArbeid` (`apps/api/src/routes/timer/dagsseddel.ts`), kaster ved lagre.

**Delt sannhetskilde (2026-07-05):** regelen bor nå i **`packages/shared/src/utils/maskinKapasitet.ts`** (`beregnMaskinBrudd` / `overstigerMaskinTak` / `maskinBucketKapasitet`, `EPSILON_MASKIN_TIMER`, `maskinBucketNokkel`). **Server delegerer hit** (kun Decimal→number-konvertering igjen); **klienten kaller samme funksjon** → ingen divergens mulig.

**Proaktiv UI (b+disable, 2026-07-05):** maskin-modalen (web `MaskinRadDialog` + mobil `MaskinRadModal`) viser inline kapasitet-linje «Arbeid i gruppen: X t · maskin så langt: Y t · ledig: Z t», som blir rød og **disabler Lagre** når inntastet verdi vil overskride taket — feilen surfaces før lagre, ikke etter. Kapasiteten beregnes reaktivt for gjeldende (projectId, ecoId), også når bruker bytter prosjekt/ECO i modalen (web: fra hele sedelen i minne; mobil: SQLite-spørring på current bucket). Eksisterende ikke-blokkerende advarsler (attestering per-rad + mobil `EcoBucket`-sumindikator) er rutet gjennom samme helper; mobil-sumindikatoren inkluderer nå pause (var utelatt tidligere).

### Reise skilt fra arbeid — «+ Reise», sumvisning, maskinlinje (ordre 2026-11-14 (6)) — 🟡 `feat/timer-reise-skille` (ikke merget)

Kenneth-hjemmel. Tre delte regler i `packages/shared/src/utils/reiseSkille.ts` (vakt: `reiseSkille.test.ts`):

- **`løsReiseKnappLonnsart(reiseLonnsartId, lonnsarter)`** — ÉN resolver for hvilken lønnsart «+ Reise» fører på: `valgt` (eksplisitt `OrganizationSetting.reiseLonnsartId`, aktiv), `automatisk` (intet valg, nøyaktig én aktiv ordinær art matcher `REISE_LONNSART_REGEX`), `ingen` (0 kandidater, eller eksplisitt valg som er deaktivert/slettet — speiler serverens `erReiseLonnsart`, som ikke navne-matcher når et valg er satt) og `flere` (≥ 2 kandidater uten valg).
- **`arbeidOgReise` / `arbeidUtenReise`** — arbeid og reise hver for seg; erstattede rader (`attestertStatus = "erstattet"`) telles aldri.
- **`sendDagenTekst(status, arbeid, reise)`** — «Send dagen (7,5 t · reise 2 t)» / «Send dagen (7,5 t)»; returnert sedel gir «Send på nytt».

**«+ Reise»:** knappen fører låst på resolverens lønnsart med `erReise = true`, `reiseKilde = "manuell"` (server: `tilfoyTimerRad` tar `reiseKilde: "manuell"` og avviser med `BAD_REQUEST` når lønnsarten ikke er reise — en under-terskel-rad fra ordre (9) sender derfor ingen `reiseKilde`). Ved `ingen`/`flere` skjules knappen; firmaadmin ser `timer.prosjektkort.reiseSkjultIngen`/`reiseSkjultFlere` + «Velg reise-lønnsart» som lenke til `/dashbord/firma/innstillinger#reise-regelsett`, andre ser ingenting.
- Web: prosjektkort-visningen (`apps/web/src/app/dashbord/timer/[id]/page.tsx`, knappen ved «+ Timer» i kortet, `TimerRadDialog` i reise-modus med lønnsarten låst). Klassisk dagskort-visning (firmaets default `timerRegistreringsmodus`) har ingen «+ Reise» — der føres reise som før via «Legg til timer-rad». Klassisk dagskorts dekningsbanner («X t av Y t registrert») teller arbeid uten reise og viser reise separat som «… · Reise N t» (`timer.summeringReise`; POST 2026-11-14 (7) punkt 6, Kenneth løftet dagskort-isolasjonen kun for banneret) — web `timer/[id]/page.tsx:1055`/`:1082`, mobil `app/timer/[id].tsx:559`/`:984-985` + `SummeringsBanner.tsx:17`/`:66`. Erstattede rader telles ikke. Dagskortet har fortsatt ingen «+ Reise». Vakt: `prosjektkort-visning.test.tsx` (banner-describe) + mobil `summeringsbanner-reise-vakt.test.ts`.
- Mobil: dag-seksjonen (`prosjektkort/DagSeksjon.tsx`, reise hører til dagen — ORDRE 36b) via `hentReiseKnappLokalt` (`services/timerKatalog.ts`); modalen (`TimerRadModal`, `reise.laast`) viser lønnsarten som tekst. Admin-signalet er et vellykket `organisasjon.hentSetting`-kall (mobil har ingen rolle lokalt) — offline vises ingen hint. Lenken åpner web (`hentWebUrl()` + `apnLenke`, eksisterende mønster). Offline-rad får `erReise` + `reiseKilde = "manuell"` ved innsetting (`settInnTimerRad`), samme etter synk.

**Reise-innstillingen (`apps/web/src/app/dashbord/firma/innstillinger/page.tsx`, `ReiseSeksjon`):** nedtrekket grupperer «Foreslått» (resolver-kandidater) og «Andre lønnsarter»; tomt valg viser «Automatisk → X» når én kandidat finnes. Statuslinja (`data-testid="reise-status"`) sier valgt / automatisk / ingen / flere / bånd (`firma.innstillinger.reise.status*`), gul ved ingen/flere.

**«Dette må være på plass» (POST 2026-11-14 (8) punkt 2, `ReiseForutsetninger` i `firma/innstillinger/page.tsx`, `data-testid="reise-forutsetninger"`):** vises øverst i Reise-seksjonen når Timer er aktiv, fra `organisasjon.hentReiseForutsetninger`. Tre linjer med grønn/gul/rød prikk: (1) oppmøtesteder — rød ved 0, lenke til `/dashbord/firma/oppmotesteder`; (2) byggeplasser i aktive prosjekter som mangler punkt og/eller radius, hver som lenke til `/dashbord/oppsett/byggeplasser?prosjekt=<id>` (siden velger prosjektet fra `?prosjekt=`); (3) par uten avstand med «Beregn» (samme `beregnMatrise`) og rød liste over par uten kjørbar rute. Erstatter de to gamle boksene (byggeplasser uten punkt / uoppnåelige par) med samme innhold i mer detalj. Lønnsart-telleren (`reiseLonnsartMatchAntall`) teller kun aktive ordinære arter, samme kandidatregel som resolveren.

**«+ Reise» i Bekreft dag (POST 2026-11-14 (8) punkt 1):** i manuell modus (Nytt prosjektkort) har `bekreft-dag.tsx` samme knapp, resolver (`hentReiseKnappLokalt`), låste lønnsart og admin-hint som `DagSeksjon`. Reisen ligger i rettingen (`DagsforslagRetting.manuellReise`) og legges som erReise-rad på første åpne dato (`leggTilManuellReise` i `utils/dagsforslag.ts`) med `reiseKilde`/`tidKilde = "manuell"`; arbeidsradene røres ikke. Endre = fjern + legg til på nytt. Et utkast med kun reise er ikke tomt (`erTomtUtkast`). Mobil `hentReiseLonnsartId` faller tilbake til resolveren (punkt 5). Terskel og bånd: se neste avsnitt. Vakt: `manuellReise.test.ts`, `timerKatalog-reiseResolver.test.ts`.

**Terskel og avstandsbånd på «+ Reise» (POST 2026-11-14 (9), Kenneth-vedtak «Arbeidstid, erReise false») — 🟡 `fix/reise-terskel-manuell` (ikke merget):** ÉN delt regel `klassifiserManuellReise` (`packages/shared/src/utils/reiseManuell.ts`), kalt fra mobilens `useManuellReise` (`apps/mobile/src/components/timer-detalj/useManuellReise.ts`) i `TimerRadModal` — samme modal for `DagSeksjon` og Bekreft dag manuell modus, så de ikke kan divergere. Gjelder kun NY rad fra «+ Reise» (`reise.laast && !eksisterendeRad`); uten cachet regelsett oppfører modalen seg som før.
- **Terskel i begge enheter:** «minutter» måler de innførte reisetimene mot `reiseTerskelMin`; «km» måler matrise-avstanden oppmøtested × kortets byggeplass (`hentMatriseRadLokalt`) mot `reiseTerskelM`. Nøyaktig på terskelen = over (som `klassifiserReise`).
- **Oppmøtested (km):** ett → automatisk; flere → nedtrekk «Fra oppmøtested» med siste valg forhåndsvalgt (`velgOppmotested`; lagret pr. firma på enheten, `apps/mobile/src/lib/reiseOppmotestedLagring.ts`); ingen gyldig siste valg → ingenting valgt, vi gjetter ikke. Ukjent avstand → regel (c): under terskel, grå linje «Avstand ukjent — regnes som under terskel».
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
- **Én delt løsning (A):** `løsManuellReise` (`packages/shared/src/utils/reiseManuell.ts`) velger oppmøtested (`velgOppmotested`), slår opp avstand og klassifiserer (`klassifiserManuellReise` + `tilManuellReiseSpor`). Mobilens `useManuellReise` og webens `useManuellReiseWeb` (`apps/web/src/hooks/useManuellReiseWeb.ts`) kaller begge denne — kun datakilden skiller (lokal cache vs. tRPC: `hentArbeidstidDefaults`, `oppmotested.hentForFirma`, `hentMatriseForFirma`, `timer.lonnsart.list`). Forklaringslinjen er delt: `manuellReiseForklaringTekst` (mobilens `forklaringTekst` er et alias).
- **Web «+ Reise»** (`TimerRadDialog` i `apps/web/src/app/dashbord/timer/[id]/page.tsx`): ny rad fra «+ Reise» viser klassifisert lønnsart (låst) + grå forklaringslinje; km med flere oppmøtesteder gir nedtrekk «Fra oppmøtested» (siste valg pr. firma i `localStorage`, samme nøkkel som mobil-web). Under terskel → standard ordinær art uten `reiseKilde` (server gir `erReise=false`); over → båndets/resolverens art med `reiseKilde: "manuell"`. Terskel ikke i bruk (begge typer reisetid) → som før.
- **Kjent grense (web):** `tilfoyTimerRad` tar ikke `reiseAvstandM`, `reiseOppmotestedId` eller `reiseRegel`, så web lagrer lønnsart og `erReise` riktig, men ikke sporet mobil lagrer. Å utvide ruta er en server-/lønnsendring som krever eget vedtak.
- **Kjøretid i timer (B):** `formaterKjoretid(t, min)` (`packages/shared/src/utils/kjoretid.ts`, nøkler `timer.kjoretid.*`) gir «1 t 35 min» over 60 min og «45 min» under; brukt i `AvstanderFane.tsx`. Redigeringsfeltet er fortsatt minutter.
- **Mangler standard lønnsart (C):** `manuellReiseManglerArt` (shared) → tekst `timer.reiseTerskel.manglerArt` «Firmaet mangler standard lønnsart — be firmaadmin sette den» på mobil (`TimerSeksjon.tsx`) og web; lagring sperret. Firmaadmin på web (`hentSetting` lykkes) får i tillegg lenke `timer.reiseTerskel.settStandardArt` til `/dashbord/firma/timer/lonnsarter`. Firmainnstillinger → Reise viser en varsellinje (`firma.innstillinger.reise.manglerStandardArt` + lenke) når Timer er aktiv, en terskelside er «arbeidstid» og ingen aktiv art har `erStandardvalg`. Ingen toast/banner.
- **Tester:** `reiseManuell.test.ts` § «felles fasit for mobil og web» + `kjoretid.test.ts` (shared); `reise-terskel-dialog.test.tsx` (web-payload = delt fasit under/på/over terskel og ukjent avstand), `avstander-kjoretid.test.tsx`, `reise-mangler-standardart.test.tsx` (web); `manuellReise.test.ts` § Ordre (11) C (mobil). Negativkontroll pr. del: hook av → 6 røde; veiledning fjernet → 2 røde; rå minutter → 3 røde; varsellinje av → 1 rød.

**GPS-forslag under Byggeplass i Bekreft dag (POST 2026-11-14 (8) tillegg 4):** i manuell modus vises en gul linje «GPS foreslår: <byggeplass>» (eller «… (<prosjekt>)» når prosjektet er et annet) rett under Byggeplass-feltet — kun når kortets dato er i dag og GPS-byggeplassen (`ByggeplassKontekst.gpsByggeplassId`, samme kilde som Hjem-chipen) avviker fra kortet. Kun informasjon; ingen ny posisjonsforespørsel. Ren logikk i `utils/gpsForslagLinje.ts` (vakt `gpsForslagLinje.test.ts`); dagskortet er urørt (`dagskort-isolert-vakt.test.ts`).

**Arbeid og reise hver for seg:** «Arbeidstimer (N t)» er uten reise; «Reise N t» vises separat (`timer.gruppe.reise`) — web dagskort-gruppe, `AttesteringDetalj_Edit`, `attestering-buckets`, `SeddelKort`; mobil `ProsjektGruppe`. Maskinlinja er «Maskin X t» (`timer.gruppe.maskin`) uten «av Y t arbeid» og alltid nøytral — ingen grønn/rød og ingen varseltekst på linja, heller ikke ved brudd (RETUR 1; web `EcoGruppe` i `timer/[id]/page.tsx`, `attestering-buckets`, `SeddelKort`, `AttesteringDetalj_Edit`; mobil `ProsjektGruppe`). Brudd stoppes av sperren i rad-modalene (web `MaskinRadDialog`/`RedigerRadModal`, mobil `MaskinRadModal`), og `SeddelKort` flagger sedelen via `sedelHarMaskinOver`. Mobil `SummeringsBanner` bruker bannerets felles tekstfarge. Mobil `ProsjektkortDagsoversikt` har fortsatt sin egen ravgule bruddliste (`maskinOverTak`, «Maskin X t · Maskintimer overstiger arbeidstimer»), som er en separat varselliste og ikke maskinlinja. Vakt: `apps/web/src/__tests__/timer-maskinlinje-noytral-vakt.test.ts` (alle fem flater; mutanter rød tekst i `SeddelKort` og «maskinOverstiger» i mobil `ProsjektGruppe` → røde). Nøklene `timer.gruppe.maskinAvArbeid` og `timer.summering.heravMaskin` er fjernet (ingen kallere).

**Maskin-kontrollen beholdes, målt mot arbeid uten reise** (og uten erstattede rader): web `page.tsx` (gruppe + `maskinKapasitet` i begge modaler), `RedigerRadModal`; mobil `MaskinSeksjon.tsx` (kapasitet), `TimerSeksjon.tsx` (`TimerRadModal`-kapasitet), `kortRadFlytt.ts` (`girNyttBrudd`, `KortDag.reiseLonnsartId` — vakt i `kortHele.test.ts`), `ProsjektkortDagsoversikt.tsx` (maskin-flytt) og `bekreftDagTillegg.ts` (`vaktGrunnlag`). Serverens `validerMaskinUnderArbeid` bruker samme `arbeidUtenReise` (`dagsseddel.ts:1263`; POST 2026-11-14 (7) punkt 5): maskin 7 / arbeid 7 / reise 2 godtas, maskin 8 avvises — server og klient regner likt. Test i `firma-katalog-server.test.ts`.

**Overgang i `syncBatch` (RETUR 1 V3, 🟢 `dagsseddel.ts:1230` + `:7004`):** synk beholder foreløpig den **gamle, slakke** regelen — reise teller som arbeid (`validerMaskinUnderArbeid(…, { reiseTellerSomArbeid: SYNK_MASKIN_REISE_TELLER_SOM_ARBEID })`). *Hvorfor:* en eldre mobil-app regner reise som arbeid; en sedel den har lagret lokalt med maskin 8 / arbeid 7 / reise 2 ville ellers bli `avvist` i sin helhet ved synk etter API-deployen. `syncBatch` kjenner ikke klientversjonen, så overgangen gjelder **all** synk; interaktive stier (web, `maskin.tilfoy`, `redigerSedelRader`, splitt) bruker den strenge regelen. *Hva fjerner den:* når OTA-versjonen med «maskin mot arbeid uten reise» er i bruk, settes konstanten til `false` og opsjonen fjernes. Test: `timer-lag2-sync.test.ts` (synk godtar 8/7/2, avviser 10/7/2) + `firma-katalog-server.test.ts` (samme dag via `maskin.tilfoy` avvises).

**Send dagen:** web og mobil (`prosjektkortMobil.ts` `sendKnappTekst` → `sendDagenTekst`; `ProsjektkortDagsoversikt`, `ProsjektkortSamleside`) viser arbeid uten reise, reise separat.

### Prosjektkort L1 — visningsmodus for web-sedelen — 🟡 `feat/prosjektkort-l1` (2026-11-05, ikke merget)

Spec: `relay/prosjektkort/spec-prosjektkort.md` (vedtak 1–10, Kenneth «ok for 1-10»).

- **Modell A — kun visning.** Prosjektkort er en visningsmodus over samme `DailySheet`: samme rader, samme mutasjoner, samme innsending, attestering og lønnsgrunnlag. Ingen ny lagring og ingen endring i eksisterende tRPC-kontrakter.
- **Firmavalg:** `OrganizationSetting.timerRegistreringsmodus` (`dagskort` default \| `prosjektkort`). Settes under Firma → Innstillinger → «Timeføring» (`apps/web/src/app/dashbord/firma/innstillinger/page.tsx`); slår inn ved neste lasting. Ukjent/manglende verdi leses som dagskort (`lesTimerModus`, `packages/shared/src/utils/prosjektkort.ts`).
- **Dagskort uendret:** i dagskort-modus er markupen byte-identisk med develop (målt med render av begge versjoner, samme data). Prosjektkort-flaten er gated med `prosjektkortModus` i `apps/web/src/app/dashbord/timer/[id]/page.tsx`.
- **Samleside (`ProsjektkortSamleside`, `page.tsx:1275`):** «Prosjektkort (N)», ett kort pr. prosjekt med «nr — navn», byggeplass og kolonnene Arbeid / Maskin / Varer / Reise («—» når tom). Kortet åpnes på plass og viser dagskortets `ProsjektGruppe` med `iKort` (ECO-bøtter, timer, maskin), VARE-linjer og lenkene «+ Timer · + Maskin · + Tillegg/Utlegg». Under: «+ Nytt prosjektkort», «Dagens ramme · fra–til · pause N min (bæres av …)» med «Endre» (`RedigerHeaderDialog`), og bunnlinja «Sum i dag X t av Y t · maskin · reise» med Slett og «Send dagen (X t)». Er sedelen returnert, sier knappen «Send på nytt» (samme nøkkel som dagskortet, `timer.detalj.sendPaaNytt`). Reise vises i bunnlinja kun når > 0. Innstillingens hjelpetekst (`firma.innstillinger.timeforing.hjelp`) sa i L1 at appen fortsatt viste dagskort; den setningen er fjernet i L2.
- **Tall (`packages/shared/src/utils/prosjektkort.ts`, delt med mobil fra L2):** erstattede rader (`attestertStatus = "erstattet"`) telles aldri. Arbeid = timer uten `erReise`, Reise = timer med `erReise`, Maskin = maskinrader. Varer: én enhet gir summert mengde, ulike enheter gir antall linjer. Sum i dag (`sumIDag`) = Σ kortenes arbeid + reise. «Send dagen» viser arbeid uten reise og reise separat (`sendDagenTekst`, se § Reise skilt fra arbeid). **Sumlinja «Sum i dag X t av Y t» og trafikklys-prikken på web teller ikke reise** (Kenneth 2026-11-14, låst — reise er ikke overtid, samme regel som `foreslaOvertidSplitt`): `sumlinjeMotNorm(timer, norm)` gir registrert = arbeid uten reise og uten erstattede rader + sonen; web-samlesiden (`page.tsx`, `ProsjektkortSamleside`) kaller den, reisen vises fortsatt som « · reise X t». Mobilens samleside er `ProsjektkortDagsoversikt` (`app/timer/[id]/prosjektkort.tsx`): der er «Sum i dag» arbeid uten reise (`ProsjektkortDagsoversikt.tsx`, `arbeidTimer`-filteret og `sum.arbeid` i sum-kortet), uten norm og uten trafikklys — normen står på egen linje (`timer.dagsoversikt.normRamme`), reisen som « · reise X t». Eksempel: 7,5 t arbeid + 2 t reise, norm 7,5 → «7,5 t av 7,5 t · reise 2 t», grønn. Vakt: `prosjektkort.test.ts` (`sumlinjeMotNorm`). Byggeplass: rad uten egen arver sedelens; én gir navnet, flere gir «N byggeplasser», ingen gir tomt. Trafikklys-prikken (kun web) bruker samme avrundingsregel som dagskortets topp-sum, på tallet uten reise.
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

### Prosjektkort-rute — egen skjerm for samlesiden (ORDRE 35, I2) — 🟡 `feat/prosjektkort-isolert` (2026-11-07, ikke merget)

Kenneth-vedtak I2: prosjektkortets samleside på mobil er flyttet ut av dagskortet til egen rute, så endringer i prosjektkortet ikke kan treffe dagskortet.

- **Rute:** `apps/mobile/app/timer/[id]/prosjektkort.tsx`. `app/timer/[id].tsx` sender videre med `<Redirect>` når `kortModus` er sann (etter `if (!sedel)`), og bærer med `aapnetEksisterende`. Prosjektkort-skjermen sender tilbake til `/timer/[id]` når firmaet ikke (lenger) er i prosjektkort-modus. Det brukeren ser er uendret: samme bannere, samleside, Gjenåpne/Slett, «+ Nytt prosjektkort», «Endre» ramme og byggeplass-velger.
- **To kopier av glue:** koden mellom skjerm og lagring/konflikt/forsoning (henting av sedel, `forsonDagskort`, overlapp-/dagskort-sammenligning, `bekreftConflict`, gjenåpne, slett med lokale `db.delete`, arbeidstid-cache, `useReLesVedSynk`) finnes i **to filer**: `apps/mobile/app/timer/[id].tsx` (dagskortet) og `apps/mobile/src/components/timer-detalj/prosjektkort/useProsjektkortSedel.ts` (prosjektkortet). **En fiks i den ene skal vurderes i den andre.** Vakten `src/components/timer-detalj/prosjektkort/prosjektkort-glue-vakt.test.ts` teller 20 service-kall i begge (kommentarer ignorert) og feiler når én kopi dropper eller bytter et kall; negativkontroll for droppet, byttet og utkommentert kall.
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
- **«Flytt raden»** (`KortValgModal`, modus `flytt`; skriving i `prosjektkort/kortRadFlytt.ts`, utenfor `radLagring.ts` med vilje): timer-rad beholder alle felt unntatt prosjekt/byggeplass/underprosjekt; alle koblede maskiner følger (`foelgKobletMaskin`, GO 5; timer urørt). Maskin alene sjekkes mot kapasitet (`beregnMaskinBrudd`) før flytt og kobles løs. Vare: `pending` flyttes lokalt og sendes med nye verdier; `synced` flyttes FØRST på server (`vareforbruk.oppdater` med `projectId`, GO 6), feil vises i modalen og ingenting lokalt endres; `avvist` beholder syncStatus. Varer har ingen arv: både flytt og «+ Vareforbruk» (`kortLaas`) bruker kortets **effektive** byggeplass (`vareByggeplassForKort`, `apps/mobile/src/lib/prosjektkortMobil.ts`, RETUR 4), mens timer/maskin lagrer null når kortet står på sedelens byggeplass.
- **Server (`apps/api/src/routes/vareforbruk.ts` `oppdater`):** valgfri `projectId`. Prosjektbytte krever medlemskap i målprosjektet, at målet tilhører firmaet og samme varelager-eier (`FORBIDDEN` ellers), og tilgang-policy. Har linjen `dagsseddelId`, må sedelen ha en timer-rad på målprosjektet, ellers `BAD_REQUEST` (RETUR 4) — en synket vare kan derfor ikke flyttes til et prosjekt der timer-raden bare finnes lokalt før den er synket. Byggeplass/underprosjekt valideres mot målprosjektet og nullstilles ved bytte når input ikke sier noe. `hentMineForDato` returnerer `externalCostObjectId`. Test: `vareforbruk-flytt.test.ts`.
- **Maskin-byggeplass** (`apps/api/src/routes/timer/byggeplass-rad.ts` `maskinByggeplassVedSync`): `syncBatch` tar valgfri `byggeplassId` pr. maskin. Null eller utelatt (eldre klient) = arv av sedelens byggeplass, som timer-radene (RETUR 4); en byggeplass fra et annet prosjekt blir null. Pull returnerer feltet. Test: `byggeplass-rad.test.ts`, `timer-lag2-sync.test.ts`.
- **Bekreft dag, prosjektbytte med flere kort** (`flyttBeskrivelseVedProsjektbytte`, `apps/mobile/src/utils/bekreftDag.ts`, RETUR 4): teksten flyttes både fra `projectId`-nøkkelen og fra kortet som arver dagens byggeplass, aldri over tekst målprosjektet alt har. Test: `bekreftDagBeskrivelse.test.ts` § RETUR 4 (P6).
- **SQLite (mobil):** `sheet_machine_local.byggeplass_id` og `vareforbruk_local.external_cost_object_id`, additive via `ALTER` (`KORTVALG_LOCAL_KOLONNER`, `migreringer.ts`). Ingen backfill: gamle rader arver sedelen ved visning. Test: `migreringer.kortvalgLocal.test.ts` (feiler når kolonnen mangler).
- **Dag-seksjonen** (`prosjektkort/DagSeksjon.tsx`, GO 4; 🟡 `feat/timer-tillegg-utlegg-kort` reverserer for tillegg/utlegg — de føres på kortskjermen, se § Tillegg og utlegg på prosjektkortet — API, «Mobil — føring på kortskjermen»): reise, tillegg og utlegg hører til dagen og ligger under kortene, over sum og «Send dagen». Prosjekt-forslaget er prosjektet med flest arbeidstimer. Reise velger prosjekt; byggeplass/underprosjekt i modalen bare når prosjektet har flere (K3). `TilleggSeksjon` og `UtleggSeksjon` gjenbrukes (utlegg får prosjekt-chips ved flere prosjekter). Kortskjermen viser dem ikke lenger — de er flyttet, ikke fjernet.
- **Bekreft dag — beskrivelse pr. kort** (`apps/mobile/src/utils/beskrivelseKort.ts`): `kortMedArbeid` gir ett felt pr. (prosjekt, effektiv byggeplass) med arbeid; underprosjekt finnes ikke i Bekreft dag. Nøkkelen i `beskrivelsePerKort` er `projectId` når prosjektet har ett kort (identisk med 36a), ellers kortnøkkelen. `manglerBeskrivelse` sperrer pr. nøkkel (`BekreftDagHandling.nokler`); `anvendDagsforslag` skriver tekst fra radens eget kort (`beskrivelseForRad`). Feltet viser byggeplassnavnet når flere kort deler prosjekt; bytte av dagens byggeplass tar med teksten. Tester: `bekreftDagBeskrivelse.test.ts` § ORDRE 36b.
- **Dagskortet urørt:** vakt `dagskort-isolert-vakt.test.ts` § «ORDRE 36b — kortvalg og dag-seksjonen rører ikke dagskortet» (optional props, `REISE_VILKAAR`, `UTLEGG_CHIPS`, kontekst-default `false`, negativkontroll). Flytt-vakter: `dagsoversikt-kilde-vakt.test.ts`.

#### Kenneths telefontest 2026-11-12 — del 1–4 (🟡 `fix/timer-mobil-kenneth-1211`, ⚠️ venter Kontrollør-gate)

- **V21 i kortvisningen:** `ProsjektkortDagsoversikt` sender `dagsnormTimer={normTimer}` og `onLeggTilOvertidDel` til `TimerRadModal` som `TimerSeksjon` gjør. Overtid-delen lagres som ny rad på samme kort (`leggTilTimerRad`, byggeplass via `lagretByggeplassForKort`). `kort/[projectId].tsx` henter normen fra svar-cachen (`hentDagsnormLokalt`) i stedet for `null`. Kenneths dag (07–15 normal, 15–17 OT 50 %, 17–18 normal, norm 7,5) gir forslaget OT 50 % for 17–18.
- **Prosjektnavn på mobil — én kilde:** `prosjektVisningsnavn` (`apps/mobile/src/utils/prosjektNavn.ts`) returnerer bare navnet. Prosjektnummeret («SD-nummer») vises ikke på noen mobilflate (kort, overskrifter, prosjektvelgere, attestering); `prosjektNummer`-propen på `ProsjektFelt` er fjernet. Nummeret er fortsatt søkbart i `timer-detalj/ProsjektVelger.tsx` og `TimerSeksjon.tsx`. Ukjent prosjekt (ikke i lokal cache) vises som «Ukjent prosjekt» (`timer.detalj.ukjentProsjekt`), aldri som ID — også i GPS-mismatch-meldingene. Web er uendret.
- **Overtidsrader med fra–til:** overtidslinja i dagsoversikten rendres som arbeidslinja: «15:00–17:00 · 2,0 t · Overtid 50 %» (`timer.dagsoversikt.overtid` = «Overtid {{prosent}} %»).
- **Test:** `prosjektkort/kenneth-1211-vakt.test.ts` (rene tester + kildevakter; negativkontroll per del).

#### Dagsoversikt i radform (🟡 `feat/timer-dagsoversikt-radform`, Kenneth 2026-11-12, ⚠️ venter Kontrollør-gate, migrering ikke kjørt)

Godkjent plan «Dagsoversikt i radform»: beslutning 1 = B (varer kobles til rad), 2 og 3 som anbefalt. Maskin/vare i Bekreft dag: se «TILLEGG 2026-11-12» under.

- **Én boks pr. timerrad** i `ProsjektkortDagsoversikt`, i tidsrekkefølge (fra-tid stigende, rader uten fra-tid sist), gruppert pr. (prosjekt, underprosjekt) — se TILLEGG under. Regelen bor i `apps/mobile/src/utils/dagsoversiktRader.ts` (`raderForDag`, `grupperPaaUnderprosjekt`). Rader slås aldri sammen, heller ikke like rader på samme prosjekt. Overtid er en vanlig rad. Oppsummeringen pr. prosjekt er fjernet.
- **Boksen** (`radBoks`): `Clock` + «07:00–15:00» (`timer.dagsoversikt.utenTid` når fra–til mangler), prosjekt + timer, lønnsart (overtid: `timer.dagsoversikt.overtid`) · byggeplass, beskrivelse eller amber «Mangler beskrivelse», radens maskin og varer, «+ Vare». Trykk på boksen åpner `TimerRadModal` når `redigerbar`; V21 (`dagsnormTimer`, `onLeggTilOvertidDel` → `leggTilTimerRad`) er uendret.
- **Kort uten rader** får egen boks med «+ Legg til arbeid», «+ Legg til maskin» og «+ Vare» som før (knappeteksten kun når `redigerbar`).
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
- **Beskrivelse pr. rad i Bekreft dag (beslutning 2):** kortets tekst fyller alle radene; ved 2+ arbeidsrader på kortet får hver rad eget felt (`BekreftDagBeskrivelse`, plassholder `timer.bekreftDag.beskrivelse.radPlassholder`) som overstyrer. Nøkkel `rad:${dato}|${projectId}|${fraTid}|${n}` (`radBeskrivelseNokkel`, `utils/beskrivelseKort.ts`), lagret i `retting.beskrivelsePerRad`; endres fra-tid, faller raden tilbake til kortets tekst — aldri en annen rads tekst. Sperre pr. rad: `manglerBeskrivelse` (`utils/bekreftDag.ts`) gir kortnøkkelen når alt er tomt, ellers nøklene til radene som mangler; skjermen ruller til raden og fokuserer feltet, feilteksten er `timer.bekreftDag.beskrivelse.radMangler`.
- **TILLEGG 2026-11-12 (Kenneth, før gate) — raden eier prosjekt, byggeplass og underprosjekt:**
  - *Bekreft dag* (PRESISERING 2026-11-12 + GO 2026-11-13; `BekreftDagRadTillegg.tsx`, `tilleggRader`/`tilleggUtenRad`/`maskinerOverRaden`/`radTilleggNokkel` i `utils/bekreftDagTillegg.ts`, `skrivTillegg` i `dagsforslagAnvend.ts`): dagslista «Maskin og varer» og tids-matchingen er fjernet. Hver arbeidsrad er en vanlig rad med egne maskiner (timer) og varer (mengde, enhet): linjene og «+ Maskin»/«+ Varer» vises under radens felt, også når kortet har én rad. Ingen automatisk kobling. Skjermen holder `tilleggPerRad[nøkkel]`; nøkkelen er `tillegg:${dato}|${radIndeks}` (ORDRE Tillegg/Utlegg 3a, 2026-11-13; før: `dato|lønnsartId|radIndeks`), der `radIndeks` (`DagsforslagRad.radIndeks`, `utils/dagsforslag.ts`) er carve-vinduets opprettelsesrekkefølge — stabil identitet, ikke posisjon etter tidssortering, så en tidsretting som bytter rekkefølgen beholder linjene på samme rad. Verken prosjekt eller lønnsart er med i nøkkelen: prosjektbytte og lønnsartbytte på raden tar linjene med (før 3a ble linjene foreldreløse med `tilleggUtenRad`-stopp ved lønnsartbytte). En rad som forsvinner (radIndeks borte) gjør fortsatt linjene foreldreløse i stedet for å la dem gli over på en annen rad. `anvendDagsforslag` skriver hver rads linjer med `sheetTimerId` = radens id og radens prosjekt, effektive byggeplass og underprosjekt (`kortValgFor`). Vakter før noe skrives (`bekreftDag`): linjer uten rad → `tilleggUtenRad` (skjermen viser `timer.bekreftDag.tillegg.utenRadTittel`/`utenRadMelding` og linjene i en egen boks — aldri stille kastet); maskin over radens timer → `maskinBrudd` (tekst `timer.bekreftDag.tillegg.overRad`); deretter bøtte-regelen pr. dato (`vaktGrunnlag(…, dato)`). Kortets eksisterende rader får aldri linjer fra Bekreft dag. Blokkert (sendt) dato har ingen rad å legge linjer på.
  - *Prosjektkort* (`ProsjektkortDagsoversikt`): «Flytt raden» på en timer-rad går via `flyttKort` med `radInnhold` (`kortRadFlytt.ts`) — koblede maskiner og varer (lokale og synkede, server først etter push) følger, timer og mengde uendret; ukoblede linjer blir. Koblet maskin/vare har ingen egen Flytt, men linjen `timer.dagsoversikt.folgerRaden` (`RadHandlinger.folgerRaden`, vare-modalen); ukoblede («Uten rad») flyttes som før.
  - *Sortering* (`grupperPaaUnderprosjekt`): hele rader (med maskin/varer) under radens (prosjekt, underprosjekt), grupper i rekkefølgen til sin første rad, overskrift «prosjekt · underprosjekt» når dagen har mer enn én gruppe. «Uten rad» vises pr. gruppe under linjens eget underprosjekt. Ingen sammenslåing.
- **ORDRE Tillegg og Utlegg i Bekreft dag (GO 2026-11-13, 🟡 `feat/timer-bekreftdag-tillegg-utlegg`, ikke merget):**
  - *Seksjon* `BekreftDagLonnUtlegg.tsx` under arbeidsradene: «Tillegg» og «Utlegg», hver med `HjelpIkon` og «+». Modalene er prosjektkortets (`TilleggRadModal`, `UtleggRadModal` med `onOpprett`, eksportert fra `TilleggSeksjon.tsx`/`UtleggSeksjon.tsx`). Linjene holdes i minnet (`lonnUtlegg` i `bekreft-dag.tsx`) og er knyttet til sedel + kort (prosjekt + byggeplass), ikke til en arbeidsrad. Standard = kortet med flest arbeidstimer (`kortMedFlestTimer`, `utils/beskrivelseKort.ts`; likt → første) — T12, se § Tillegg og utlegg på prosjektkortet. Skjules når alle datoer er sendt.
  - *Skriving:* ved [Bekreft og lagre] skriver `anvendDagsforslag` (`utils/dagsforslagAnvend.ts`) linjene på `forsteLagredeSheetId` (første åpne dato sin sedel) via `skrivLonnstillegg`/`skrivUtlegg` (`services/tilleggUtleggSkriv.ts`, samme skrivevei som prosjektkortet). Kvitteringen køes med `leggIKo` først etter skrevet Bekreft (`resultat.lonnUtleggSkrevet`). Tillegg-vedlegg legges til etterpå i prosjektkortet (B1).
  - *Vakt:* `tilleggUtleggUtenDag` i `bekreftDag` — linjer finnes, men alle datoer er sendt → Alert `timer.bekreftDag.tilleggUtlegg.utenDagTittel`/`utenDagTekst`, ingenting skrives. Rekkefølge: `manglerBeskrivelse` → `tilleggUtleggUtenDag` → `tilleggUtenRad` → `maskinBrudd` → bøtte → anvend; enhver stopp skriver null linjer. Sendes alle datoene mellom forslag og Bekreft (race), skriver `anvendDagsforslag` verken timer eller linjer (`lonnUtleggSkrevet` false), og `bekreftDag` gir samme stopp etter anvend (RETUR Kontrollør M3) — skjermen navigerer ikke bort, så linjer og kvitteringer beholdes.
  - *Rydding:* forlates skjermen uten lagring, slettes ulagrede kvitteringsfiler (`slettLokaltBilde`); fjerning av en utlegg-linje sletter fila med en gang.
  - *3b — sedel uten prosjekt:* en server-sedel uten prosjekt (lokalt `project_id = ""`) får maskin/vare med radens prosjekt (`sedelKontekstForRad`, `utils/bekreftDagTillegg.ts`). Før: linjene ble stille droppet.
  - *Prosjektkortet* er uendret bortsett fra `HjelpIkon` ved overskriftene i `DagSeksjon`. Vakt: `dagskort-isolert-vakt.test.ts` (ProsjektGruppe uten `HjelpIkon`/`onOpprett=`).
  - *Tester:* `bekreftDagTillegg.test.ts` § ORDRE Tillegg/Utlegg (skrives på første åpne sedel + kø, alle sendt → `tilleggUtleggUtenDag`, hver stopp skriver null, `prosjektMedFlestTimer`, samme rader som prosjektkortets `skrivUtlegg` — alle med negativkontroll); `bekreftDagTillegg.test.ts` § RETUR M3 (sendt-race); `glemtDag.test.ts` kildevakter for Alert, kø etter skriving, rydding og skjuling, samt RETUR M9 (fjern-linje sletter fila) og M11 (`onOpprett` returnerer før skriving).
- **Dagskortet urørt.**
- **Test:** `dagsoversiktRader.test.ts`, `beskrivelsePerRad.test.ts`, `kobledeMaskiner.test.ts`, `radLagring.test.ts` § maskinkobling (8+3 t, over raden avvist, ingen stille endring/sletting, ukoblet 3 t forblir 3 t — hver med negativkontroll), `kortRadFlytt.test.ts` (alle maskiner følger), `kortHele.test.ts` § TILLEGG (flytt av rad tar med maskin + varer, nabo-rad/ukoblet urørt, negativkontroll uten varer), `retur-radform-vakt.test.ts` (lagre-sperre + R10 Del opp, med mutanter), `nyTimerRad.test.ts` (ingen tom sedel ved maskin over raden), api `vareforbruk-gyldig-rad.test.ts` (R17: annen sedel/annet prosjekt → null), `migreringer.radformLocal.test.ts`, `vareforbrukSync.test.ts`, `bekreftDagTillegg.test.ts` § PRESISERING TILLEGG (flere rader → ingenting uten rad, linje på rad 2 får rad 2s id, over radens timer stopper selv med plass i bøtta, forsvunnet rad → `tilleggUtenRad`, fra-tid-retting beholder linjene, bytte av rekkefølge beholder linjen på samme rad — hver med negativkontroll; bytte-testen er rød med nøkkel etter posisjon), `dagsoversiktRader.test.ts` § gruppering (ECO A under A, ukoblet B under B), kildevakter `prosjektkort/radform-vakt.test.ts` (M10: feiler når `leggTilTimerRad` i `onLeggTilOvertidDel` byttes med `void` — kjørt), `dagsoversikt-kilde-vakt.test.ts` (kun `Clock`), `kenneth-1211-vakt.test.ts` del 4.

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
- **RETUR 36c-3 (🟡 `fix/36c-retur-3`, ikke merget) — «Ingen byggeplass» fra Bekreft dag (Kontrollør 1b):** i manuell modus sender `bekreft-dag.tsx` `utenByggeplassValgt: manuell && retting.byggeplassId === null` (eksplisitt valg, ikke bare tomt felt) via `bekreftDag` til `anvendDagsforslag`. Finnes sedelen alt og har byggeplass A i kortets prosjekt (`trengerByggeplassLoft` mot `sedelKontekstLokalt`, A-s prosjekt fra `byggeplass_local`), kalles `loftByggeplassArv` før radene skrives: arvende timer- og maskinrader får A, hodet blir NULL + `pending`, og den nye raden blir NULL (ekte «uten»). Reise røres ikke. GPS-veien (uten flagg), ny sedel og annet prosjekt enn A er uendret. Kjent grense: løftet har egen transaksjon. `anvendDagsforslag` har ingen ytre transaksjon, så løft og rad-insert er to steg. Feiler insert etter løftet, er effektiv byggeplass for de gamle radene uendret (`rad ?? sedel` = A). Byggeplass som mangler i den lokale katalogen gir ingen løft, som i prosjektkort-stien. Tester: `manuellDag.test.ts` § RETUR 36c-3 (løft, reise urørt, GPS-vei, ny sedel, annet prosjekt, skjermflagg) og kildevakter K10 (fra PRESISERING TILLEGG: `byggeplassId={r.byggeplassId}` — radens byggeplass) og K12/P12 («+ Legg til» bare når `redigerbar`).
- **Endre kort / Slett kort (36c-kort, 🟡 `feat/36c-kort`, ikke merget; Kenneth OK 2026-11-09: a ja, b ja foreløpig, c ja):** nederst på kortskjermen `app/timer/[id]/kort/[projectId].tsx`, bare når sedelen er utkast eller returnert (`erRedigerbar`) og kortet har innhold. «Endre kort» (nøytral) åpner `KortValgModal` modus `flytt` med `heleKortet` og flytter hele kortet (`flyttKort`); «Slett kort» (rød) bekrefter i `BekreftSlettModal` og sletter kortets rader (`slettKort`). Skriving i `prosjektkort/kortRadFlytt.ts`, rekkefølge: bruddsjekk (`girNyttBrudd`, maskin mot arbeid pr. prosjekt+underprosjekt — bare NYE brudd stopper) → server-varer (`vareforbruk.slett` for synkede varer) → én lokal transaksjon. Flytt har egen rekkefølge fra 36c-kort-3 (se under). Kortet = alle timer-/maskinrader og varer med samme kortnøkkel (arvende rader inkludert), koblet maskin følger raden. Slett gir tombstones med `serverVersjon` for synkede rader. Flytt: prosjektbytte nullstiller underprosjekt; finnes målkortet fra før slås kortene sammen på datanivå (merknad `timer.kort.sammenslaa`, ingen ny visning); flytt til «Uten byggeplass» løfter arven (`loftByggeplassArv`) før hovedtransaksjonen. Reise, tillegg og utlegg røres ikke. a) synkede varer krever nett — offline er knappen sperret med forklaring (`timer.kort.offlineSlett`/`offlineFlytt`); c) slettes siste kort, står sedelen igjen som tomt utkast. Serverfeil → ingen lokal skriving. Dagskortet `app/timer/[id].tsx` er urørt (vakt i `kortHele.test.ts`). Ingen migrering, ingen nye API-ruter. Grense: ved delvis serverfeil med flere varer beholder alt endrede varer sin lokale kopi til neste server-lesing. Tester: `kortHele.test.ts` (21, ekte sql.js); mutanter 14/14 røde (tombstone, nøkkel kun prosjekt, reise med, koblet maskin hoppet over ved slett/flytt, redigerbar-sperre, brudd fjernet/før=etter, lokal før server, «uten» uten løft, sammenslåing, offline-sperre, serverfeil). Under testing ble en feil i bruddsjekken funnet og rettet: «før» brukte målnøkkelen.
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
| `hentTilAttestering` (`:3534`) | `krevProsjektLeder` + where `organizationId ∈ attesteringsFirmaer`; ansattnummer hentes fra sedelens firma |
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

**ÉN sannhet — `losTimerKolonner(rader, mottaker, valgteKolonner?)` i `@sitedoc/shared`** (`timerDetaljRader.ts`, ved siden av `TIMER_KOL_KEYS`/`TIMER_KOL_I18N`/`INTERNE_TIMER_KOLONNER`). Alle tre flater løser kolonnesettet gjennom samme funksjon: skjerm (`TimerRapportDetaljer`) og Excel (`timer-rapport-eksport.ts`) kaller den direkte; PDF (`packages/pdf`, importerer bevisst ikke shared) filtrerer/omordner sine `KolDef`-er på den samme nøkkellista via api-et. Resultat: fjerner du en kolonne i velgeren forsvinner den fra skjerm **og** PDF **og** Excel per konstruksjon (regresjonstest i `timerDetaljRader.test.ts`). **B1 (Kenneth 2026-09-01):** er `config.kolonner` satt vises de valgte kolonnene **ordrett — ingen drop-tom**; en kolonne brukeren eksplisitt valgte står selv om den er tom den dagen. Mangler feltet → dagens dynamiske sett (tomme droppes).

**🔴 Lukket flateparitet-funn:** «Excel viser alt, skjerm/PDF dropper tomme» var et **eksisterende** brudd på [flateparitet-vedtaket](retningslinjer/ui-standarder.md#-flateparitet--mal-ui-og-pdf-viser-det-samme-kenneth-vedtak-2026-09-01) — oppdaget, ikke oppstått, i denne runden. Med `config.kolonner` satt konvergerer alle tre. Legacy-stien (uten feltet) er bevisst urørt (B1 «uendret atferd»), så den divergensen består kun for maler som aldri har rørt velgeren.

**Ekstern vinner over valget (designlås 1, uendret):** `INTERNE_TIMER_KOLONNER = [ansattnr, status]` filtreres bort strukturelt i `losTimerKolonner` uansett brukervalg; i velgeren er de interne kolonnene ikke engang listet for en ekstern mal (ID er aldri valgbar/ i PDF). Personvern, ikke preferanse — kan ikke overstyres.

**Velger:** delt presentasjonskomponent `apps/web/src/components/ui/KolonneVelger.tsx` (web-only: dnd-kit + `@sitedoc/ui` er delt med mobil). Sorterbar-modus (drag-rekkefølge via `@dnd-kit/sortable`) slås på for timer; sjekklister/oppgaver bruker samme komponent **uten** sortering (migrert fra to inline-kopier i egen commit). **Innebygde maler** får eksplisitte kolonnesett i kode (Full/Lønn = alle; **Fakturagrunnlag = eget sett UTEN ansatt** — personen skal ofte ikke vises på faktura til byggherre, Kenneth 2026-09-01); velgeren redigerer kun egendefinerte maler, «rediger innebygd» → «lagre som». **Dato er alltid-på (låst); ansatt default-på men fjernbar.** Nye i18n-nøkler `firma.timer.rapport.tilpasset.kolonner`/`.kolonnerSok`/`.kolonnerHjelp` (13-språk-generert).

### Fase 6-oppfølger — Kenneths gate (2026-09-01, `feat/timerrapport-flate`)

Fire funn fra gaten på `feat/kolonnevelger` (ikke feil, men ting gaten avdekket):

- **Velgeren nåbar fra detalj-tabellen.** Kolonnevelgeren lå kun inne i mal-editoren («Eksporter → tilpasset»); Kenneth fant den ikke. Nå ligger den ALTSÅ i detalj-filterraden (samme rad som radtyper + Intern/Ekstern + gruppering), der brukeren SER tabellen. Begge innganger er samme delte `TimerKolonnePanel` (i `rapport/page.tsx`) som redigerer **samme `valgteKolonner`** (malens `config.kolonner`) — ingen ny tilstand, ingen andre-kilde. Uten aktiv mal lever endringene i sidens tilstand til man evt. «Lagrer som mal» (valg (a) — å kreve en mal for å skjule en kolonne er for høy terskel).
- **Kolonnebredder følger innholdstypen.** Ny delt kilde `TIMER_KOL_BREDDE` i `@sitedoc/shared` (`timerDetaljRader.ts`) med `min`/`vekt`/`excel` pr. kolonne — arvet av alle tre flater (flateparitet): skjerm-gridet bruker `minmax(min, vekt·fr)` (faste kolonner vekt 0), Excel leser `excel`-tegnbredden, PDF får en `<colgroup>` med prosentbredder (vekt sendt fra api-et som data, siden `packages/pdf` ikke importerer shared) + `table-layout: fixed`. Beskrivelse/Betegnelse/Aktivitet er fritekst og deler ledig plass; datoer/koder/tall holdes smale. `truncate` er sikkerhetsnett, ikke normaltilstand.
- **Maskinlinja foldes inn på timeraden** når enheten er `"time"` — se [maskin.md § faktureringsenheten](maskin.md).
- **«Lagre som»-knappene forklarer seg** når de er avslått (navn tomt / ingen radtype), og «Eksporter uten å lagre» → **«Last ned PDF»/«Last ned Excel»** (mikrotekst-standard: si hva som skjer, ikke hva vi IKKE gjør). Nye nøkler `firma.timer.rapport.tilpasset.lastNedPdf`/`.lastNedExcel`/`.lagreKreverNavn`/`.lagreKreverRad`.

**Fence:** utskriftens header urørt; `losTimerKolonner` + `byggDetaljRader` forblir ÉN kilde (bredde- og sammenslåings-reglene bor i shared → arves av alle tre); ingen backfill av `sheetTimerId`; legacy-maler uten `config.kolonner` uendret.

### 🔴 Prosjektfilter på rad-nivå — bug-fiks (2026-08-27, `fix/rapport-prosjektfilter-radniva`)

**Feilen:** både `firmaPeriodeRapport` og `detaljEksport` valgte sedler med `where: { timer: { some: { projectId: { in: prosjektIder } } } }` (SEDLER som har ≥1 rad på prosjektet) og trakk deretter **alle** rader på de sedlene via `include` **uten** rad-filter. En dagsseddel med 6 t på Fjordgata + 3 t på Sentrumsparken dro med seg Sentrumsparken-radene når man filtrerte på Fjordgata → summen lekket på tvers av prosjekter, både på skjerm OG i eksport (et fakturagrunnlag dokumenterte arbeid på feil prosjekt, ut av huset). Eldre enn printmotoren; fase 4-grupperingen gjorde den synlig (andre prosjekt fikk egen gruppe + subtotal).

**Fiksen:** rad-nivå-filter i `include`-en på **alle fire** relasjonene (`SheetTimer`/`SheetTillegg`/`SheetMachine`/`SheetUtlegg` bærer alle `projectId` + indeks) i BEGGE spørringene. 🔴 **Kun når `input.prosjektId` er satt** (`radProsjektFilter = input.prosjektId ? { projectId } : {}`) — uten filter er `prosjektIder` hele firmaet, og kryss-prosjekt-rader kan bevisst peke på prosjekt UTENFOR firmaet (`detaljEksport` samler dem for navneoppslag); et ubetinget `in: prosjektIder` ville stille droppe dem. **Sedel-valget (`where`) er URØRT** — en sedel med én Fjordgata-rad teller fortsatt som én Fjordgata-sedel (`antallSedler`), men timesummen teller kun Fjordgata-radene. `statusFordeling` er per-sedel (uendret) — konsistent med `antallSedler` (= sedler som berører prosjektet), IKKE per rad; ikke misvisende lest slik, derfor bevisst ikke endret. Maskin-klassifiseringen (nøstet/uten-timerad/ikke-eksporterbar) degraderer grasiøst under filteret: hver gjenværende maskin-rad havner fortsatt i en bøtte, ingen lekker eller forsvinner.

### Detaljeksport (lønn/fakturering) — `detaljEksport` (2026-08-24)

`rapport.ts:detaljEksport` er en EGEN prosedyre ved siden av `firmaPeriodeRapport` (ikke ombygging — skjermrapport aggregerer med groupBy for rask visning, eksporten drar rå rader; én payload til begge ville gitt treg skjerm eller amputert eksport). Samme filtre (periode/prosjekt/ansatt), kalt **kun ved eksport-klikk** (`utils…fetch` i `rapport/page.tsx`). Inkluderer alle fire rad-typer med erstattet-filter (`timer`/`tillegg`/`maskiner` med `attestertStatus != "erstattet"`; `utlegg` har ingen status), lønnsart/aktivitet-navn per timerad (via `@relation`), kryss-prosjekt-navn og maskin-navn (`ctx.prismaMaskin`). Utlegg via `select` (beløp + kategorinavn + kommentar), **aldri vedlegg**.

`.xlsx`-arkstruktur (**4 ark fra fase 2**, var 6): aggregat-arkene **Sammendrag** · **Etter prosjekt** · **Etter dag** beholdes uendret (fjernes ikke på en slutning om at ingen bruker dem — stille bruddform), og de tre detalj-arkene er slått sammen til ÉTT **Detaljer**-ark med Type-kolonne (se Fase 2 over). Arknavn + alle kolonneoverskrifter går gjennom `t()` (i18n gjelder også ikke-JSX; `t` injiseres i `eksporterXlsx` fra `page.tsx`) — «Etter …», ikke «Per …» (grupperings-husstil, CLAUDE.md § Språk). Maskin nøstet under sin timerad via `sheetTimerId`; **maskintimer i egen kolonne** (aldri i Timer-kolonnen — attesteringsflaten summerer maskintimer separat), så arbeidstimer-kontrollsummen forblir ren. Detaljer-arket har **fire SUBTOTAL(109)-kontrollsummer** (Timer/Maskintimer/Antall/Beløp — levende formler som respekterer Excel-filtrering, så en Type-filtrert visning oppdaterer summen) — regnet fra RADENE, ikke serveraggregatet: avvik mot Sammendrag = kodeveiene har drevet fra hverandre, synlig i fila før lønnskjøringen. **Status-kolonnen** er nå ÉN kolonne som bærer `attestertStatus` per rad (timer/maskin/tillegg — lønn spør om RADEN er attestert; en sedel kan stå «sent» mens enkeltrader er returnert) eller sedel-status for utlegg (`SheetUtlegg` har ingen rad-status). **Verdiene oversettes** (rå DB-koder som `pending`/`sent` er ikke norsk) — se defektretting under Fase 3. CSV forblir sammendrag (ett flatt bord). Detalj-kolonnene er en **datadrevet liste** i `timer-rapport-eksport.ts` (Excel) / `byggDetaljRader` (kilde) — proadm-«underprosjekt» legges senere til som ÉN kolonne + ETT filter, uten ombygging. Siste kolonne på hver rad er en tynn **ID** (Excel-only koblingsnøkkel for den framtidige dimensjonen — aldri i PDF).

**`skalEksporteres`-filter (2026-08-25, fabel-vedtak):** en lønnsart/tilleggstype merket `skalEksporteres=false` (kunde-satt avkryssing «Skal eksporteres til lønn/regnskap») utelates fra ALLE eksporter — feltet ble tidligere aldri lest (kunden fjernet haken, raden eksporterte likevel → feil lønnsgrunnlag). Én regel, ingen formål-matrise (overstyring kommer senere som synlig Tilpasset-unntak). To steder, samme regel: (1) **detalj-arkene** — `detaljEksport` filtrerer på DB-nivå via relasjons-`where` (`timer.where.lonnsart.skalEksporteres=true`, `tillegg.where.tillegg.skalEksporteres=true`); (2) **aggregat-arkene** — `firmaPeriodeRapport` tar en valgfri `kunEksporterbare`-flagg som eksport-veien (`rapport/page.tsx håndterEksport`) setter til `true`, og som hopper over ikke-eksporterbare lønnsarter i **time-summene** (ikke i sedel-metadata som statusFordeling/antallSedler — en sedel med kun ikke-eksporterbare timer er fortsatt en reell sedel). **Skjermen kaller uten flagget → viser alle timer** (attestering/oversikt trenger å se alt; ordren gjelder eksporter). **Maskin på ekskludert timerad:** maskin er ikke lønnsart-filtrert (fakturerbart), så den forsvinner ikke — men den havner IKKE under «Maskin uten timerad» (den bøtta betyr «maskin brukt uten registrert arbeid», et anomali-signal). Den får sin egen linje **«Maskin på ikke-eksporterbar timerad»** i Detaljer-arket (fase 2), og maskintimene teller fortsatt i maskintimer-summen. `detaljEksport` returnerer derfor tre maskin-bøtter: nøstet · uten timerad · på ikke-eksporterbar timerad. (Den nye linja går gjennom `t()` fra start — `timer.eksport.maskinIkkeEksporterbar`, 14 språk; de øvrige eksport-merkene/kolonneoverskriftene ryddes i kolonne-overskrift-batchen.)

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
| ⚠️ **Unntak: dagssedler som spenner over flere prosjekter** | `dagsseddel.hentTilAttestering` (`apps/api/src/routes/timer/dagsseddel.ts:2250-2294`) velger sedler med `timer: { some: { projectId } }`, men **`include: { timer: … }` har intet `projectId`-filter** — kun `attestertStatus != "erstattet"`. Fører en ansatt timer på to prosjekter samme dag, ser prosjektadmin i det ene prosjektet **hele sedelen**, inkludert linjene ført på det andre. 🟢 **Kenneth-vedtak 2026-09-10: dette er akseptert som det er — sedelen er dagens arbeid, og den som attesterer må se helheten for å vurdere den. Men det skal opplyses, ikke oppdages.** 🔴 **Skriv/attestering er korrekt gjerdet:** `attesterRader`/`returnerRader`/`attester`/`gjenaapneAttestering` (`:2885`, `:3069`, `:3994`, `:3170`) krever `krevProsjektLeder` på **hvert** berørt prosjekt |
| **Godkjenning** | Leder godkjenner dagssedler → `godkjentAv` + `godkjentVed`. Utlegg godkjennes samtidig — leder ser kvitteringsbilder i godkjenningsvisningen |

## API-ruter (planlagt)

| Rute | Metode | Beskrivelse |
|------|--------|-------------|
| `timer.registrer` | Mutation | Opprett/upsert dagsseddel (idempotent via clientUuid) |
| `timer.oppdater` | Mutation | Endre dagsseddel (kun egne, kun ikke-godkjente) |
| `timer.slett` | Mutation | Slett dagsseddel (kun egne, kun ikke-godkjente) |
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

