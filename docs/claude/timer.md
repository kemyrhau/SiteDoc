---
status: aktiv
sist_verifisert_mot_kode: 2026-06-08
sist_endret: 2026-06-08
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

> **Reisetid vs. reise-godtgjørelse (Fase 3 § B, avvik A):** To distinkte konsepter — ikke slå sammen. **Reise-godtgjørelse** («Reise 7,5–15 km» … «45–60 km», «Kilometergodtgjørelse») er **avstands-/godtgjørelse-satser — regnskap eier satsene** og km-utmålingen. **Reisetid** er **timeført arbeidstid** på lønnsarten «Reise/transport til prosjekter» (`ordinaer`), klassifisert mot firmaets terskel (kontor→byggeplass). Fase 3 `reiseLonnsartId` peker som standard på reisetid-arten, IKKE en km-godtgjørelse-art. Seed-artene beholdes uendret; kun denne tekst-distinksjonen er reframet (ingen rad-rename).

#### Nivå 3 — Egendefinerte

Opprettes av kunden via admin-UI ved behov. SiteDoc leverer ingen mal — kun verktøyet. Eksempler på lønnsarter som typisk hører her: kloakk-tillegg, brøyte-beredskap, firma-spesifikke skifttillegg-satser (30/40/50% utenfor standard 2-skift/natt), tariff-spesifikke satser, bransje-detaljer (bergspreng, dykker, etc.).

### Onboarding — to scenarier

Ved firma-opprettelse vises modus-velger:

**A) «Nytt firma — ingen eksisterende katalog»**
Auto-importerer Nivå 1 (16 lønnsarter). Tilbyr Nivå 2 (25 lønnsarter) som valg. Standard for nye SiteDoc-kunder.

**B) «Migrerer fra annet system»**
Tom katalog. Import-verktøy aktivert (CSV-upload eller adapter mot kjent system). Forhindrer dobbel-katalog-problem hvis kunde flytter eksisterende lønnsarter inn — ellers ville Nivå 1 + importert katalog gi duplikater.

### Auto-fordeling normaltid/overtid

Når kunden bruker Nivå 1 «Timelønn» + «Overtid 50%/100%»: systemet foreslår fordeling basert på totaltimer og konfigurerbar dagsnorm (default 7,5t fra `OrganizationSetting`). Bruker kan overstyre.

Eksempel: 10t totalt → Timelønn 7,5t + Overtid 50% 2,5t. Bruker justerer til 8t + 2t hvis ønskelig.

Hvis kunden ikke har importert Nivå 1: ingen auto-fordeling, bruker velger lønnsart manuelt.

> **Status (2026-06-09):** Server-motoren er fortsatt ikke bygget. Eneste fordelings-logikk er klient-MVP i mobil `StartSluttDagKort.genererForslag`. **Reise-kobling (Fase 3 § B):** reise-andelen føres på egen lønnsart-rad og holdes utenfor normaltid/overtid-grunnlaget (`arbeidstimer = total − reisetid`, ingen dobbelttelling av brutto). `reisetidTellerOvertid` styrer terskelen: `false` (default) → dagsnorm gjelder kun arbeidstimene (reise utenfor overtid); `true` → reise spiser av dagsnorm (`dagsnorm − reisetid`), så mer arbeidstid havner i overtid. Når server-motoren bygges arver den samme kontrakt.

#### Overtid-klassifisering — strukturert felt + isolert regel (③, 2026-07-05)

**`Lonnsart.overtidsnivaa Int?`** (db-timer, nullable): `null` = ikke overtid, `50`/`100` = tier. Erstatter fritekst-navne-match. Firma-admin setter feltet i web lønnsart-UI («Overtidsnivå»-select, kun for `type="ordinaer"`).

**⭐ Regelen er isolert i `@sitedoc/shared` [lonnsregel.ts](../../packages/shared/src/utils/lonnsregel.ts)** — ALL «hvilken tid er overtid, hvilket nivå»-logikk bor der, ikke i `StartSluttDagKort`:
- `klassifiserArbeidstid({ arbeidstimer, dagsnorm })` → segment-liste `[{overtidsnivaa: null, timer}, {overtidsnivaa: 50, timer}]`. Nivå 0-regel: alt over norm → 50 %. Bytt KUN denne kroppen for Nivå 1-2 (se [BACKLOG § Lønnsregel-konfig](BACKLOG.md)) — retur-kontrakten holder call-sites uendret.
- `velgOvertidLonnsart(lonnsarter, nivaa)` → laveste-`rekkefolge` aktiv `type="ordinaer"` med matchende `overtidsnivaa`. **Aldri fritekst-navn.** Null ved ingen treff → banner, aldri feil-match.

**Payroll-prinsipp:** lærling-varianter beholdes `overtidsnivaa=null` (backfill) → aldri auto-valgt for normal arbeider. Backfill setter kun eksakte seed-navn (`Overtid 50%`→50, `Overtid 100%`→100, seedNivaa=1); kunde-importerte (f.eks. A.Markussens 170/172/175/177) settes manuelt i admin-UI.

**③b — «garantert» standard-lønnsart:** migreringen `20260705120000_lonnsart_overtidsnivaa` (Steg 2) backfiller `erStandardvalg` for orgs med ≥1 ordinær men ingen standard (foretrekk `Timelønn` seedNivaa=1, ellers laveste-`rekkefolge` aktiv `type="ordinaer"`). ⚠️ **Fallbacken garanterer at feltet er *satt*, ikke at det er *riktig*** — den velger posisjon (laveste `rekkefolge`), ikke betydning. `type="ordinaer"` er en restkategori (km, reise, skifttillegg, smusstillegg, matpenger), så fallbacken kan velge f.eks. kilometergodtgjørelse som auto-lønnsart for arbeidstimer — det skjedde for A.Markussen i prod 2026-07-09. Egentlig fiks: semantisk felt på `Lonnsart` (som `overtidsnivaa`), se [BACKLOG § standard-lønnsart plasseres deterministisk feil](BACKLOG.md). Auto-gen gjetter aldri — normaltid-raden får firmaets `erStandardvalg`-lønnsart. Fallback-bannere i mobil `[id].tsx`: rød «Mangler standard-lønnsart» (null ordinære), amber «Overtid ikke ført» (dag nådde norm men ingen overtid-lønnsart) — aldri stille drop.

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

**5,5t-terskel (AML §10-9) — når pausen i det hele tatt gjelder:** `PAUSE_TERSKEL_TIMER = 5.5` i `pauseBeregning.ts`. `pauseMinForDag(dagsTotalBruttoTimer, standardPauseMin)` returnerer `standardPauseMin` KUN når dagens totale brutto arbeidstid > 5,5 t, ellers 0. Gaten er **dagstotal-basert, ikke per rad** (en dag splittet i flere rader skal verken miste eller få pause av rad-splitten). Ligger i `fordelArbeidstidFradrag` (`StartSluttDagKort.tsx`) der dagstotalen finnes. To ortogonale regler: **hvor** pausen faller (4,0t-vinduet) vs. **om** den gjelder (5,5t-terskelen).

**Web-speiling:** attestering (`RedigerRadModal.tsx`) og firma-innstillinger (`firma/innstillinger/page.tsx`) bruker samme skiftrelative modell.

### F5 — matpause-bærer per timer-rad (mobil) — ⚠️ WIP branch `fix/timer-mobil-f2f3f5` (cowork-gate pending, ikke deployet)

Additivt felt **`SheetTimer.pauseMin` / `sheet_timer_local.pauseMin`** (Int NOT NULL DEFAULT 0): minutter lunsjpause DENNE raden trekker. Kun ÉN rad per sedel bærer pausen (`pauseMin > 0`); kun-én-per-dag håndheves som **flytt**, ikke radio. Bæreren settes ved generering = **lunsj-kryssende carve-rad** (Valg A, gate-endorsert 2026-07-14; respekterer «ikke rør carve» — carve legger pausen på ett vindu, den raden får `pauseMin`). Rad-timer holdes konsistent: `rad.timer = effektiveTimerFraSpenn(fra, til, pauseFra, rad.pauseMin)` (deployert modell, gjenbrukt).

- **UI** (`TimerSeksjon.tsx` `TimerRadVis`): kompakt checkbox «Matpause trukket (30 min)» nederst på rad-kortet, kun synlig når regelen trigger (dagsbrutto > 5,5t) OG raden krysser lunsjvinduet. Bæreren avhuket; andre kvalifiserte rader viser tom checkbox.
- **Flytt-interaksjon** (`services/matpause.ts`, orkestrert i `timer/[id].tsx`): huk PÅ annen rad → sett bærer der (forrige nulles stille); huk AV bæreren → flytt til neste kvalifiserte rad (lengste-først) + toast; ingen kvalifisert → **ekte bekreftelsesmodal** «Ingen pause trekkes for dagen» (AML-varsel, ikke `confirm`/`Alert`).
- **Kryss-modul-invariant (bevarer maskin-kapasitetsregelen):** ved HVER endring settes `dagsseddel_local.pauseMin = Σ(sheet_timer_local.pauseMin)` i samme lokale tx. Maskin-regelen (`validerMaskinUnderArbeid` / `maskinKapasitet.ts`) bruker fortsatt **sedel-nivå** pauseMin uendret — **`sheet_machines` får INGEN pauseMin** (maskin går gjennom operatørens pause; paritet ville vært semantisk feil). Modul-avhengighet verifisert 2026-07-14 mot [dagsseddel-design.md](dagsseddel-design.md) + [maskin.md](maskin.md).
- **Sync:** `pauseMin` per timer-rad i `syncBatch` begge veier (samme utvidelse som F3 byggeplassId). Server-kolonne `sheet_timer.pause_min` — migrering `20260714120000_sheet_timer_pause_min` **FORBEREDT, ikke kjørt** (Kenneths go; backfill-disiplin gates av cowork).

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

### Maskin ≤ arbeidstimer — invariant + proaktiv UI (T7-4b + 2026-07-05)

**Regel (T7-4b, låst 2026-05-16 + pause-modell 2026-05-18):** per `(projectId, externalCostObjectId)`-bucket må `sum(maskin.timer) ≤ sum(arbeid.timer) + pauseMin/60` (epsilon `0.001`; `pauseMin` er sedel-nivå, tillegges hver bucket — maskin kan gå mens operatør pauser). Server håndhever i `validerMaskinUnderArbeid` (`apps/api/src/routes/timer/dagsseddel.ts`), kaster ved lagre.

**Delt sannhetskilde (2026-07-05):** regelen bor nå i **`packages/shared/src/utils/maskinKapasitet.ts`** (`beregnMaskinBrudd` / `overstigerMaskinTak` / `maskinBucketKapasitet`, `EPSILON_MASKIN_TIMER`, `maskinBucketNokkel`). **Server delegerer hit** (kun Decimal→number-konvertering igjen); **klienten kaller samme funksjon** → ingen divergens mulig.

**Proaktiv UI (b+disable, 2026-07-05):** maskin-modalen (web `MaskinRadDialog` + mobil `MaskinRadModal`) viser inline kapasitet-linje «Arbeid i gruppen: X t · maskin så langt: Y t · ledig: Z t», som blir rød og **disabler Lagre** når inntastet verdi vil overskride taket — feilen surfaces før lagre, ikke etter. Kapasiteten beregnes reaktivt for gjeldende (projectId, ecoId), også når bruker bytter prosjekt/ECO i modalen (web: fra hele sedelen i minne; mobil: SQLite-spørring på current bucket). Eksisterende ikke-blokkerende advarsler (attestering per-rad + mobil `EcoBucket`-sumindikator) er rutet gjennom samme helper; mobil-sumindikatoren inkluderer nå pause (var utelatt tidligere).

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

### Firma-grense på firmaPeriodeRapport

`rapport.ts` (`firmaPeriodeRapport`) filtrerer nå dagssedler på **`dailySheet.organizationId == orgId`** i tillegg til prosjekt-tilhørighet. SHA/arbeidsgiver-modellen: hvert firma rapporterer **egne** timer, aldri prosjekteiers. Lukker cross-firma-lekkasje der en cross-org-invitert arbeiders sedel (annet org) med rad mot firmaets prosjekt tidligere dukket opp i rapporten — nå bevisst ekskludert.

> **Kjent asymmetri (BACKLOG, ikke 1b):** `rapport.ts` henter «firmaets prosjekter» via `primaryOrganizationId` (kun eide), mens rad-grensen tillater deltatte (ProjectOrganization). En underentreprenørs egne timer på et deltatt-men-ikke-eid prosjekt vises derfor ikke i firmaets periode-rapport. Under-rapportering, ikke lekkasje — eget oppfølgings-punkt.

## Byggeplass-geofence (GPS-deteksjon) — ✅ 1c-server + mobil L1 IMPLEMENTERT (🟡 enhet-test gjenstår)

Gir `Byggeplass` GPS-senter + radius så mobil kan identifisere **hvilken byggeplass** arbeider står på (utvider Fase 1 som kun identifiserte prosjekt/oppmøtested). Løser byggeplass-koordinat-gapet [`fase-0 T.8:990`](fase-0-beslutninger.md) — som også Fase 3 (kontor→byggeplass-reise) trenger.

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

**Pris-snapshot:** Eksport bruker `attestertSnapshot.prisMotKunde` fra hver rad — ikke gjeldende pris i katalogen. Sikrer at attesterte timer beholder sin opprinnelige pris selv om katalog-prisen endres senere (Fase 0 A.7).

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

Del av dagsseddelen. Ansatt tar bilde av kvittering direkte i mobilappen.

### Feltstruktur

- `kategori`: string — Drivstoff, Parkering, Diett, Verktøy, Annet (konfigurerbar per Organization)
- `belop`: decimal (NOK)
- `kvitteringsBilde`: string (URL til lagret bilde)
- `notat`: string? (valgfritt)
- `dagsseddelId`: FK → `daily_sheets`

### Teknisk

- Bilde tas med React Native ImagePicker
- Komprimeres til maks 800px, JPEG 80% før opplasting
- Lagres lokalt som base64 i SQLite → synkes som multipart/form-data til S3
- Eksporteres separat fra timer — som reiseregning/bilag i Tripletex

### Godkjenning

- Leder ser kvitteringsbilde i godkjenningsvisningen
- Godkjennes samtidig med dagsseddelen — ikke egen godkjenningsflyt

## Hjelpetekster (?-ikonet) — alle timer-sider

Per regelen i [CLAUDE.md](../../CLAUDE.md#hjelpetekster-per-side) skal hver side i SiteDoc ha hjelpetekst tilgjengelig via ?-ikonet øverst til høyre. For timer-modulen gjelder dette ALLE sider — bygges samtidig med siden, oppdateres når siden endres.

**Konsepter som MÅ forklares i ?-hjelp på relevante sider:**

| Side | Hjelpetekst skal dekke |
|------|------------------------|
| `/timer/min-tid` (dagsseddel) | Hva er en dagsseddel, lønnsart-valg, hvordan koble til Underprosjekt, signering |
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

## Planlagte arkitektur-utvidelser (2026-06-08)

> **🟢 Beslutningssett rutet fra [OPPSUMMERING-timer-arkitektur.md](OPPSUMMERING-timer-arkitektur.md).** Schema-skisse i [arkitektur.md](arkitektur.md). Faseinndelt via SPOR 3 — ikke kodet ennå. Alt additivt (nullable/defaultet) → enkelt-stegs migrasjoner; **T.2 (`projectId NOT NULL`) gjenåpnes IKKE**.

### Reise og oppmøtested (§ B)

> **✅ Fase 1 implementert (2026-06-08, develop/test):** `Oppmotested`-entitet (kjerne) + `oppmotestedRouter` (firma-admin CRUD + member-lesbar `hentForFirma`) + web firmainnstillinger-side (`/dashbord/firma/oppmotesteder`, manuell lat/lng + adresse-geokoding + Leaflet-kartvelger lagt til i R2) + mobil `oppmotested_local`-cache + GPS-identifikasjon i «Start dag» (Haversine mot geofence-radius, lagrer identifisert oppmøtested på `arbeidsdag_local` som dokumentasjon, aldri auto-rad). Migrasjon `20260608120000_oppmotested_fase1` (additiv).

> **✅ Fase 3 implementert (2026-06-09, develop/test — venter dual-review):** Reise-regelsett som firmainnstilling på `OrganizationSetting` (migrasjon `20260609160000_reise_regelsett_fase3`, additiv): `reiseTerskelMin` (30), `reiseUnderTerskelType` ('arbeidstid'), `reiseOverTerskelType` ('reisetid'), `reisetidTellerOvertid` (false), `reiseLonnsartId` (svak FK → `timer.Lonnsart`, A.20). Delt klassifisering `klassifiserReise` + `estimerReisetidMin` + eksportert `avstandMeter` i `@sitedoc/shared`. Setting-API: `oppdaterSetting` (org-validerer `reiseLonnsartId`) + `hentArbeidstidDefaults` (member-lesbar, mobil-cache). Web: «Reise»-seksjon i `/dashbord/firma/innstillinger`. Mobil: setting-cache utvidet + reise-forslag i «Slutt dag» (`StartSluttDagKort.genererForslag`) — KUN når oppmøtested ble identifisert (kontor→byggeplass), GPS-distanse start→slutt, **estimert** reisetid (MVP, GPS-faktisk-tid senere), klassifisert mot terskel; 'reisetid' → egen reise-lønnsart-rad. **`reisetidTellerOvertid` styrer om reise spiser av dagsnorm-terskelen** (jf. auto-fordeling-koordinering under). Alt forslag i draft — arbeider justerer, aldri auto-rad. **Byggeplass-GPS på mobil = senere (1c-mobil); reise-distanse bruker start/slutt-GPS + `Project.lat/lng`-MVP.**

> **🟡 R4 implementert (2026-06-11, develop — venter dual-review): oppslag + mobil-cache.** Reise-forslaget i «Slutt dag» (`StartSluttDagKort.genererForslag`) bruker nå **faktisk matrise-kjøretid** i stedet for ×50km/t-estimatet. Flyt: GPS-identifisert kontor (`arbeidsdag_local.oppmotestedId`) → prosjektets **primær-byggeplass** → matrise-oppslag → reisetid. **Primær-byggeplass-regel** (`resolverPrimaerByggeplass`, deterministisk): kandidater = prosjektets byggeplasser med matrise-rad for kontoret (rad-eksistens = koordinat-signal); sortering published først → lavest `number` (null sist) → `id`. **R4-kontrakt:** `kjoretidMin ≥ 0` → faktisk reisetid; `< 0` (uoppnåelig) → ingen forslag (ingen fallback); ingen rad/byggeplass/oppmotestedId → graceful `estimerReisetidMin`-fallback (uendret sti). **Modell (låst):** matrise-kjøretid = autoritativ reisetid, end-uavhengig (start-etappen kontor→byggeplass); `arbeidstimer = total − reisetid` håndterer arbeids-stopp som arbeidstid — formelen uendret, kun verdien som plugges inn på `:371` endret. **Server:** member-lesbare `oppmotested.hentMatriseForFirma` + `bygning.hentForFirma` (firma-scopet). **Mobil-cache:** `reisetid_matrise_local` + `byggeplass_local` (id/projectId/number/status, ingen koord) via `reisetidMatriseKatalog`/`byggeplassKatalog`, refresh i `TimerSyncProvider`. **Reload: EAS/TestFlight** (mobil-endring). Fase 1c-mobil (eksplisitt byggeplass-GPS) forblir egen fase — R4 forward-kompatibel (foretrekker eksplisitt `byggeplassId` over primær-regel når den finnes).

> **🟡 R3 implementert (2026-06-11, develop — venter dual-review): recompute-motor + triggere.** `recomputeMatrise({ organizationId, oppmotestedId?, byggeplassId? })` (`apps/api/src/services/reisetidMatrise.ts`): kolonne (kontor × alle firma-byggeplasser) / rad (alle firma-kontorer × byggeplass) / full backfill. Henter koord, kaller `hentKjoretidMatrise` (R1), upsert mot `@@unique`. **Firma-isolasjon (HARD):** kontorer på `organizationId`, byggeplasser på `project.primaryOrganizationId` — aldri kryssorg-rad. Koordinat-fallback: byggeplass egen → `Project.latitude/longitude` → hopp over. OSRM-batching: destinasjoner i chunks à `90 − antallKontorer`. **Triggere:** `oppmotested.opprett`→kolonne, `oppdater` (kun ved lat/lng-endring)→kolonne, `slett`→FK-Cascade rydder; byggeplass-koord på **begge** skrivesteder (`oppdaterByggeplassGeofence` success-sti + inline `byggeplass.settGeofence`)→rad. **Non-blocking:** triggere er fire-and-forget (`recomputeMatriseIBakgrunn`/`recomputeRadForByggeplass`, selvstendig catch) — lagring venter aldri på OSRM; on-demand «beregn matrise»-knapp (`oppmotested.beregnMatrise`, admin-only) `await`-er. **Stale-rydding:** byggeplass uten koord → slett rader; OSRM-feil → behold (logg). Uoppnåelig par → `kjoretidMin = -1`. Knapp i Reise-seksjonen (`firma/innstillinger`).
>
> **R4-kontrakt (oppslag, ikke implementert ennå):** `kjoretidMin < 0` (uoppnåelig) → **ingen** reise-forslag (ikke fall tilbake til luftlinje-estimat). **Fravær av rad** (aldri beregnet) → live-fallback til `estimerReisetidMin`. `kjoretidMin ≥ 0` → bruk som faktisk reisetid.

> **🟡 R2 implementert (2026-06-11, develop — venter dual-review): kontor-geokoding + kart.** Oppmøtested-registrering kan nå geokode adresse → koordinat via knapp (`oppmotested.geokod`, firma-admin, kaller `geokodAdresse` fra rute-service; null-treff → melding). `OppmotestedModal` (`/dashbord/firma/oppmotesteder`) har «Geokod adresse»-knapp + Leaflet-kartvelger (`KartVelger` utvidet med valgfri `radiusM`-prop → geofence-sirkel) med to-veis felt↔kart; klikk/dra + manuell lat/lng beholdt som override. Lagret verdi = feltene (ingen auto-geokoding i opprett/oppdater). i18n nb+en + 13 auto-språk, hjelpetekst utvidet. **Ingen matrise-rader skrives ennå** (R3 recompute, R4 oppslag).

> **🟡 R1 grunnmur (2026-06-11, develop — venter dual-review): reisetid-matrise.** Erstatter på sikt ×50km/t-estimatet med faktisk forhåndsberegnet kjøretid per [kontor × byggeplass]. R1 legger kun grunnmuren: tabell `ReisetidMatrise` i kjernen (`packages/db`, søsken til `Oppmotested` — geo-infra, ikke modul-tabell) `{ organizationId (denormalisert fra Oppmotested), oppmotestedId (FK Cascade), byggeplassId (FK Cascade), kjoretidMin, kilde, beregnetAt }`, `@@unique([oppmotestedId, byggeplassId])`. Migrasjon `20260611120000_reisetid_matrise` (additiv). `apps/api/src/services/rute-service.ts`: keyless `geokodAdresse` (Nominatim) + `hentKjoretidMatrise` (OSRM `/table`, fler-kontor×fler-byggeplass i ett kall) bak et provider-grensesnitt — public OSM-default, selvhosting via `OSRM_BASE_URL`/`NOMINATIM_BASE_URL` (process.env, rører ingen .env). Alle feil → null (matrise = forslag-cache, aldri kritisk sti). `kilde` v1 skriver kun `"osrm"`; estimat-fallback beregnes live ved oppslag (R4), lagres aldri. **Ingen kallere i R1** — R2 (kontor-geokoding), R3 (recompute-motor + triggere), R4 (oppslag erstatter `estimerReisetidMin` + mobil-cache) kobler på. Forankret BACKLOG `§G:565` (Kenneth 2026-06-09).

- **Oppmøtested = egen geo-entitet** (kjerne, søsken til `Avdeling`): `{ organizationId, navn, adresse?, lat, lng, radiusM, avdelingId?, aktiv }`. A.Markussen: 3 kontorer (Narvik, Harstad, Tromsø). Geofence identifiserer kontor + logger inn/ut som *dokumentasjon* + *foreslår* starttid — aldri auto-rad (`fase-0 T.8:983`).
- **Kompensert reise = kontor→byggeplass + byggeplass→byggeplass.** Hjem→arbeidssted er IKKE kompensert. Reisetid = **lønnsart-rad (ordinær lønn), utenfor overtid** (jf. § Lønnsart-katalog + `:282`). Ingen avstands-/godtgjørelse-sats (regnskap eier satser).
- **Reise-regelsett = firmainnstilling** (konfigurerbart, ikke regelmotor): `OrganizationSetting` + `reiseTerskelMin` (default 30) / `reiseUnderTerskelType` / `reiseOverTerskelType` / `reisetidTellerOvertid`. `<terskel` → arbeidstid, `>terskel` → reisetid. Terskel + lovlighet er per firmas tariff/avtale, ikke universell lov.
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

> 🟢 **Live atferd (server prod-deployet `32b88bd7`; mobil-UI når arbeidere først ved EAS prod-bygg).** Konsolidert fra redesign-funn-doken + BACKLOG. Implementasjon: `apps/mobile/src/components/StartSluttDagKort.tsx` (`genererForslag`/`opprettDagsseddelForSegment`/`gjenopprettGlemtDag`), `utils/dagsegment.ts`, attestering-UI (`AttesteringDetalj.tsx` web + `AttesteringDetaljMobil.tsx`).

**Auto-utkast (BESLUTNING 1 = Alternativ B, fase-0 T.8).** Ved «Slutt dag» auto-skriver appen en **`draft`**-dagsseddel fra GPS-dagflyten — arbeidstid-rad(er) (timer = total − reise, splittet Timelønn opp til dagsnorm + «Overtid 50%» via navne-match) + reise-rad. Arbeider ser alt, kan redigere/slette enhver auto-rad, og **godkjenner ved innsending** (`draft → sent`). Invariant: **aldri auto-*innsending*** — ingen lønn uten menneskelig godkjenning. UX-signaler: auto-fyll-banner (lokal `auto_generert`-markør), reise-rad merket 🚗 «Reisetid» (deteksjon via delt `hentReiseLonnsartId` — samme kilde som genereringen, mot drift). **Idempotens:** finnes allerede en draft for `(userId, dato)` → naviger til den (server `@@unique([userId, dato])`), ikke lag ny.

**Midnatt-splitt (Slice 4a).** Et skift som krysser 00:00 deles i **én dagsseddel per kalenderdag** (ren `splittVedMidnatt`); timene summerer til reell total (19:00→07:00 = 5t + 7t = 12t). **Pause (firma-standard) + reise føres KUN på start-dagen.** Per-dag Timelønn/Overtid-fordeling (overtid/tariff-behandling = regnskaps-scope). Lokal markør `delt_ved_midnatt` + «delt ved midnatt»-badge på review-skjerm. Idempotens er per dag (eksisterende dag beholdes, øvrige opprettes).

**Glemt-dag-gjenoppretting (Slice 4b-1).** Ved «Start dag»/app-åpning, hvis en arbeidsdag fra en **tidligere dato** fortsatt er åpen → prompt «Jobber du fortsatt, eller glemte du å avslutte?». «Jobber fortsatt» → behold åpen (→ midnatt-splitt ved avslutning). «Glemte» → estimer slutt (firma `standardSluttTid` på start-dagen; nattskift der `standardSluttTid ≤ start` → `start + dagsnorm`), generer draft til korrigering, merket `sluttTidKilde="system"`. Adresserer BUG-1 (glemt «Slutt dag» → urealistisk lang økt).

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

### `sheet_expenses` (utlegg per dagsseddel)

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | |
| `sheetId` | `uuid` FK → `daily_sheets` | |
| `kategori` | `text` | Konfigurerbar per Organization (se `expense_categories`) |
| `belop` | `decimal` | Beløp i NOK |
| `notat` | `text?` | Fritekst (f.eks. «Shell Tromsø») |
| `bildeUrl` | `text?` | Kvitteringsbilde — S3-URL etter opplasting |
| `bildeSyncStatus` | `text` default `pending` | `pending` \| `synced` — bilde synkes separat |

**Indekser:**
- `(sheetId)` — FK-JOIN
- `(bildeSyncStatus)` — mobil bilde-pending-sync

**Kvitteringsbilde:**
- Tas med mobilkamera direkte i appen (Expo ImagePicker / Camera)
- Komprimeres før opplasting: maks 800px bredde, JPEG 80%
- Lagres lokalt som filsti i SQLite → synkes til S3 ved tilkobling
- Valgfritt men anbefalt — leder ser bildet i godkjenningsvisningen

### `expense_categories` (utleggskategorier per Organization)

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | |
| `organizationId` | `uuid` FK → `organizations` | |
| `navn` | `text` | Kategorinavn |
| `aktiv` | `boolean` default true | Kan deaktiveres uten å slette |

**Standardkategorier** seedes via samme event-hook (`onOrganizationCreated`) som lønnsart-Nivå 1: Drivstoff, Parkering, Diett, Verktøy, Annet.

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
| **Prosjektisolering** | `projectId` filtrerer alltid. Ingen data lekker mellom prosjekter |
| **Ledervisning** | Firmaansvarlig ser ansattes dagssedler i sin faggruppe |
| **Admin** | Prosjektadmin ser alle dagssedler i prosjektet |
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
