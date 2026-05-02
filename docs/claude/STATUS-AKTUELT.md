---
name: STATUS-AKTUELT
description: Løpende statusrapport for pågående arbeid, pauset arbeid og planlagte faser. Oppdateres ved hver vesentlig fremdrift.
sist_verifisert_mot_kode: 2026-05-02
---

# SiteDoc — aktuell status

Detaljert løpende statusrapport. CLAUDE.md har kort sammendrag øverst med
peker hit. Beslutningsgrunnlag og arkitektur ligger i
[fase-0-beslutninger.md](fase-0-beslutninger.md) og
[arkitektur-syntese.md](arkitektur-syntese.md).

## Pågående arbeid

**Status 2026-05-02:** **Fase 0 § E KOMPLETT i prod**. **Fase 0.5 KOMPLETT i prod**. **Timer-modul Fase 3 — Runde 1A + 1B + 1C DEPLOYET TIL PROD**. **Runde 2 (mobil + offline-sync) C1–C8 KOMPLETT på develop** (merge `1cce62f3` 2026-05-02 sent kveld). C5 visuelt verifisert på iOS Simulator + fysisk mobil etter første test-deploy. **Runde 2 + 2.5 / C9 deployet til prod 2026-05-02** (`de33aefc`). **Maskin terminologi-rename «pensjonert» → «utgaatt» DEPLOYET TIL PROD 2026-05-02** (`03d8c63a` — migrasjon `20260502120000_rename_pensjonert_til_utgaatt` applied på sitedoc + sitedoc_test). **Runde 2.6 mobil maskin-cache DEPLOYET TIL PROD 2026-05-02** (`03d8c63a`). **Runde 2.7 «Mine timer» + DagstotalBanner + UkeTotalBanner + web ukesoppsummering DEPLOYET TIL PROD 2026-05-02** (`05b3bddb`) — ny `/dashbord/timer/mine` (web, 5-perioder + 4 oppsummerings-kort + per aktivitet/status), ny `/timer/mine` (mobil, 3-perioder + 2 pills + aktivitet-aggregering), DagstotalBanner i mobil ny+detalj, web uke-totalsum, sidebar/Mer-tab-link. Ingen DB-migrasjon, ingen server-endring (gjenbruker `timer.dagsseddel.list`). Mobil får funksjonalitet ved neste EAS Build. Se [dagsseddel-design.md](dagsseddel-design.md) + [fase-0-beslutninger.md C.18](fase-0-beslutninger.md).

**Rolle-arkitektur-avklaring DEPLOYET TIL PROD 2026-05-02** (`6f6d3d68`) — `ProjectMember.kanAttestere Boolean` lagt til som kapabilitets-felt. Erstatter mye-omtalt `project_manager`-rolle som kun var i bruk i `dagsseddel.ts` (2 referanser, ingen rader i DB). Backfill: alle `role="admin"` får `kanAttestere=true` ved migrering — verifisert på test-DB (Per Prosjektadmin har `kanAttestere=true`, Ola Tømrer har `false`). CLAUDE.md rolletabell renset for `worker`/`field_user`/`project_manager` (fantasi-verdier som aldri eksisterte i kode/DB). Migrasjon `20260502160000_add_kan_attestere` applied på sitedoc + sitedoc_test. UI: sub-pill «✓ Attestering» under rolle-cellen i prosjekt-medlem-admin (`/dashbord/oppsett/brukere`) + ny `medlem.settKanAttestere`-mutation. Esc-fiks for redigeringsmodus inkludert. Lærdom: `prisma generate` MÅ kjøres FØR `migrate deploy` på server — `pnpm install --frozen-lockfile` regenererer ikke klient-typene.

**Timer-attestering rename DEPLOYET TIL PROD 2026-05-02** (`8aa792b2`) — terminologi-rens for å gjennomføre CLAUDE.md regelen «Attestering ≠ Godkjenning» (vedtatt 2026-04-26). Full sweep:
- **URL:** `/dashbord/[prosjektId]/timer/godkjenning` → `/timer/attestering`. Redirect-stub i gammel rute peker til ny via `redirect()` fra `next/navigation`. Lenker fra utsiden fungerer.
- **tRPC:** `kanGodkjenne` → `kanAttestere`, `hentTilGodkjenning` → `hentTilAttestering`. Gamle prosedyrer beholdes som `@deprecated` alias i 1 uke (fjernes etter 2026-05-09) per CLAUDE.md API-bakoverkompatibilitet-regel.
- **Sidebar/hooks/navigasjon-kontekst:** `id: "timer-godkjenning"` → `"timer-attestering"`, `nav.timerGodkjenning` → `nav.timerAttestering`, useAktivSeksjon-spesialfall, navigasjon-kontekst-type.
- **Mobil:** `sendTilGodkjenning()` → `sendTilAttestering()` + i18n-nøkkel `timer.sendTilGodkjenning` → `timer.sendTilAttestering`.
- **i18n:** 16 nøkler renamet i nb.json + en.json (`timer.godkjenning.*` → `timer.attestering.*`). Norske VERDIER oppdatert: «Godkjenning» → «Attestering», «Godkjenn timer» → «Attester timer», «Send til godkjenning» → «Send til attestering» m.fl. Engelske verdier beholdt («Approval»/«Approve» dekker begge konsepter på engelsk). Ny `status.tilAttestering` lagt til i alle 14 språk (samme verdi som `status.tilGodkjenning` for ikke-nb språk siden distinksjonen er norsk-spesifikk).
- **Verifisert:** `pnpm build --filter @sitedoc/web` grønt; `tsc --noEmit` grønt for api+web (kun pre-eksisterende vitest-typing). Mobile-tsc har bare pre-eksisterende feil ikke relatert til rename.

Status `status.tilGodkjenning` er bevisst beholdt — brukes for sjekkliste/oppgave-flyt og kontrollplan-status (intern aksept ≠ Godkjenning-dokumenttype). **Innlogget bruker-verifisering på test gjenstår** per CLAUDE.md regelen — curl HTTP 200 bekrefter kun server-svar, ikke at sidebar-element/URL-redirect/«Send til attestering»-knapp faktisk virker.

**Fase 0.5-fremdrift (revidert scope etter kode-verifisering 2026-05-01):**
- § 1 Avdeling-tabell + User.avdelingId ✅ (`a90daabd`) — `Avdeling`-modell i `packages/db`, `User.avdelingId String?` med SetNull, migrasjon `20260501000015_add_avdeling`
- § 2 Kompetansetype + AnsattKompetanse + RBAC ✅ — Kompetansetype + AnsattKompetanse-tabeller (per A.28), OrganizationSetting utvidet med `kompetanseRegistreringTilgang` (firma_admin | bruker_egen | alle, default firma_admin), 7-kategori-seed i `packages/shared/src/types/index.ts` (`KOMPETANSE_KATEGORIER` + `KOMPETANSE_REGISTRERING_TILGANG` + `KOMPETANSE_IMPORT_KILDER`), migrasjon `20260501000016_add_kompetanse`. `kompetanse.*` tRPC-rute + UI bygges senere (Fase 0.5 § 6 eller separat). Varsling-integrasjon (90/30/7 dager) bygges separat når varsling-modul er klar.
- § 3 ProjectGroupByggeplass m2m + drop building_ids ✅ — `ProjectGroupByggeplass`-tabell (m2m groupId × byggeplassId, Cascade på begge), drop `ProjectGroup.byggeplassIder` (verifisert dødt felt — kun skrevet i `gruppe.ts:495-503`, aldri lest), refaktor `gruppe.oppdaterByggeplasser`-mutation til `prisma.$transaction([deleteMany, createMany])` mot koblingstabell, semantikk: tom array = alle byggeplasser. Migrasjon `20260501000017_add_project_group_byggeplass`. Prinsipp C-verifisering ferdig (C1 vedtatt).
- § 4 Drop `ProjectGroup.byggeplassIder` ✅ — slått sammen med § 3 (samme migrasjon)
- § 5 Slette-policy for byggeplass ✅ — API: ny `byggeplass.hentSletteSammendrag` (returnerer telleresult per modell, splittet bevares/slettes per cascade-policy fra schema), oppdatert `byggeplass.slett` med `navnBekreftelse`-input (case-insensitive match per Kenneth) + `verifiserAdmin` (strammet fra `verifiserProsjektmedlem`) + TRPCError FORBIDDEN ved mismatch. UI: ny `SletteLokasjonDialog` i `apps/web/src/app/dashbord/oppsett/lokasjoner/page.tsx` (erstatter `confirm()`-prompt) — viser bevares/slettes-seksjoner, tekstinput med navn-bekreftelse, slett-knapp disabled til match. i18n: 17 nye nøkler (nb + en). Cascade-valg utsatt til senere — kun SetNull-default i første versjon. Ingen schema-endringer

**Fase 0.5 KOMPLETT** — deployet til prod 2026-05-01 (merge develop `9fed74a5` → main `f0a515cd`). 3 nye migrasjoner applied (`20260501000015_add_avdeling`, `20260501000016_add_kompetanse`, `20260501000017_add_project_group_byggeplass`).

**Etter-Fase-0.5-arbeid (på develop):**
- Avdeling-UI implementert: ny tRPC-router `avdeling.*` (hentAlle/opprett/oppdater/slett, alle gated med verifiserFirmaAdmin) i `apps/api/src/routes/avdeling.ts`. Slett blokkeres med CONFLICT hvis brukere er tilknyttet. Ny side `/dashbord/firma/avdelinger` med tabell (navn/kode/aktiv-toggle/antall brukere) + opprett/rediger-modaler. Menyelement i firma-layout. 16 nye i18n-nøkler (`firma.avdelinger.*`). Deployet til prod 2026-05-01 (`2799a4d1`).
- Kompetanse-UI Runde 1: ny tRPC-router `kompetansetype.*` (full CRUD, gated firma-admin) + `kompetanse.hentMatrise` + `kompetanse.hentForBruker` (read-only). Ny `organisasjon.hentSetting` + `organisasjon.oppdaterSetting` (upsert, dekker alle 5 OrganizationSetting-felter). Ny `kompetanseStatus()`-utils i shared (gyldig/varsel/utløpt med 90-dagers terskel). Ny side `/dashbord/firma/kompetanse` med to faner: Matrise (read-only, fargemarkering, filter på kategori/avdeling/ansatt-søk) + Kompetansetyper (full CRUD med modal-dialoger). Settings-toggle for `kompetanseRegistreringTilgang` (firma_admin/bruker_egen/alle) i innstillinger-siden. Menyelement «Kompetanse» (Award-ikon) i firma-layout. ~37 nye i18n-nøkler (`firma.kompetanse.*`). Deployet til prod 2026-05-01 (`0965ddf2`).
- Kompetanse-UI Runde 2.5 (develop): CSV/Excel-import. Ny dependency `csv-parse@6.2.1` i `apps/api`. To nye tRPC-mutations (`importerForhandsvisning` + `importerBekreft`) med SHA-256 filHash-validering for å garantere konsistens mellom forhåndsvisning og bekreft. Atomisk-policy ved ukjente ansattnumre (avviser hele importen). Auto-opprett av kompetansetyper (default på). Kolonne-aliaser + DD.MM.YYYY norsk dato + ISO-dato + Excel-dato-serial. ImportFraFilDialog i UI med 4-stegs flyt (opplastning → forhåndsvisning → bekreft → resultat). Hjelpefunksjoner i `apps/api/src/utils/kompetanseImport.ts` (parseCsvFil + parseXlsxFil + beregnFilHash). 30 nye i18n-nøkler (`firma.kompetanse.import.*`). Klar for test-deploy.
- Kompetanse-UI Runde 2: AnsattKompetanse-CRUD via celle-klikk i matrisen. Ny `verifiserKompetanseSkriveTilgang(ctxUserId, malUserId)` i `tilgangskontroll.ts` (Alt A — sitedoc_admin og company_admin bypasser policy; ikke-admin følger `kompetanseRegistreringTilgang`-policy med fallback til `firma_admin` hvis OrganizationSetting mangler). 3 nye mutations i `kompetanse.ts` (opprett/oppdater/slett). UI utvidet: celle-klikk åpner ny `AnsattKompetanseDialog` (read-only header med bruker+type, redigerbare felter for utstedt/utløp/utsteder/sertifikat-nr/notat, klient-validering for utløp<utstedt). Slett via sub-modal (per CLAUDE.md slett-bekreftelse-regel — ikke confirm()). Klikk-tilstand styrt av lokal `kanSkriveKompetanse()` som speiler server-RBAC (UI-bekvemmelighet, server er sannhetskilden). 18 nye i18n-nøkler (`firma.kompetanse.dialog.*`). Klar for test-deploy. **Runde 2.5 utsatt:** CSV/Excel-import (krever `csv-parse`-install).

**Verifiserings-funn 2026-05-01 (mot kode):**
- ❌ `ByggeplassMedlemskap` UTSATT TIL FASE 4 (Mannskap-modul) — eneste forbrukere er innsjekk/utsjekk/geofence/§15-liste, alle Fase 4
- ❌ `EquipmentAnsvarlig.avdelingId` strøket — tabellen finnes ikke i db-maskin (Equipment har direkte `ansvarligUserId`)
- ✅ Prinsipp B (ingen tvungen byggeplass) bekreftet matcher kode 1:1 (kun Kontrollplan krever byggeplass — modul-policy, ikke prosjekt-blokker)
- ✅ Prinsipp C (koblingstabell vs jsonb) bekreftet trygg — `building_ids` skrives i `gruppe.ts:495-503` men leses ALDRI noe sted

**Fase 0 § E (deployet til prod 2026-05-01):** Alle 13 § E-steg implementert (E.9 hoppet per § E). § E-fremdrift: E.1 Activity (`13a746a7`), E.2 OrganizationSetting (`4a155c28`), E.3 ProjectOrganization-rename (`1bff8672`), E.4 primaryOrganizationId (`137eed6f`), E.5 ProjectModule (`d9bfafc4`), E.6 OrganizationPartner (`22a772b6`), E.7 OrganizationTemplate (`7709ea32`), E.8 BibliotekMal + C.17 (`29311756`), E.10 ProjectMember.periodeSlutt (`5b8beef6`), E.11 ExternalCostObject (`9c9dd682`), E.12 Godkjenning (`0622fc35`), E.13 User-utvidelse + B.7 (`37d49872`), E.14 OrganizationRole. Timer/Maskin-revurdering utsatt til etter Fase 0.5-deploy.

**Anker for Fase 0-koding:**
- [fase-0-beslutninger.md](fase-0-beslutninger.md) — **PRIMÆR ANKER** (23 vedtatte + 0 åpne BLOKKERE + 12 anbefalte utvidelser + 13-stegs migrerings-rekkefølge + B.7-utvidelse for multi-identifikator-auth)
- [arkitektur.md](arkitektur.md), [terminologi.md](terminologi.md), [dokumentflyt.md](dokumentflyt.md) — verifiserte fundament-filer (drift mot kode rettet 2026-04-27)
- [smartdok-undersokelse.md](smartdok-undersokelse.md) — empirisk grunnlag fra A.Markussen (UI-research 2026-04-26)
- [arkitektur-syntese.md](arkitektur-syntese.md) — helhetlig produktarkitektur (loan-pattern, modul-arkitektur)
- [timer.md](timer.md) — krever refaktor (enterpriseId → organizationId, Underprosjekt-modell erstattet av ExternalCostObject). **Verifiseres i Timer-revurdering**
- [maskin.md](maskin.md) — krever justering for fase-0-beslutninger (særlig EquipmentAnsvarlig). **Verifiseres i Maskin-revurdering**

**Sentrale arkitektur-funn (oppdatert 2026-04-27 etter komplett verifisering):**
- `ProjectModule` eksisterer (linje 752 i schema, brukt 30+ steder) — utvides med `organizationId` + `status` (3-nivå per A.17), ikke ny tabell
- `Activity` (sentral audit-tabell) finnes ikke — bygges i Fase 0 som første steg
- `OrganizationProject` har eksisterende felter (`id`/`organizationId`/`projectId`/`createdAt` + relasjoner) — renames til `ProjectOrganization` og utvides med `rolle`-felt (NOT blank m:n)
- `date-fns-tz` er ikke installert — krevet for tidssone-håndtering (lukkes implisitt av B.6)
- Cache-invalidation-mønster er ad-hoc (30 kall, ingen sentral policy) — definres i Fase 0, fylles i Fase 3
- Underprosjekt = `ExternalCostObject` (UI-term «Underprosjekt», Prisma-modell `ExternalCostObject` per A.1)
- **Lønnsart-katalog er datadrevet, tre-nivå** (16 lovpålagte + 25 bransje-relevante + kundens egne) — detaljer i [timer.md](timer.md)
- **Avdeling-tabell** bygges i Fase 0.5 (sammen med Byggeplass), ikke Fase 0 (per C.11)
- **Seed-mekanisme** (event-hook `onOrganizationCreated`) etableres tomt i Fase 0; innhold registreres i Fase 3
- **B.7 — Org-bytte-mekanikk:** Modell A (én User per person×firma) vedtatt. `User` får composite `@@unique([email, organizationId])` + `@@unique([phone, organizationId])` (forberedende for fremtidig multi-identifikator-auth). `ProjectMember.userId` cascade endres `Cascade → SetNull`
- **B.6 — Timestamptz-håndtering:** Selektiv migrasjon (medium scope) — 11 felter får `@db.Timestamptz` (timer/audit/godkjenning/PsiSignatur/frist-felter/Invitation), resten av schema beholder `timestamp(3)`

**Maskin-modul (`feature/maskin-db`):** under bygging. **Midlertidig modul-gating implementert 2026-04-30** via `Organization.harMaskinModul`-flagg (default `false`). HovedSidebar skjuler maskin-ikonet for firma uten flagget; eksisterende firma-isolering i maskin-rutene (`verifiserOrganisasjonTilgang`) hindrer cross-tenant-lekkasje. Aktivering per firma: `UPDATE organizations SET har_maskin_modul = true WHERE id = '<id>';`. Erstattes av full `OrganizationModule` + `modulProcedure('maskin')`-gating i Fase 0 per A.4 — den midlertidige kolonnen droppes da.

**Maskin Blokk A + B implementert (2026-05-01) på `develop`:**
- **Blokk A (schema-reconciliation, `de3fb1d0`):** EquipmentAnsvarlig-tabell (m:n for tilleggsansvarlige per A.6 hybrid) + 15 nye Equipment-felt (5 felles: internNavn, eierskap, eksportKode, harSporingsenhet, aarsmodell + 10 materialiserte Vegvesen-kolonner). Migrasjon `20260501131546_blokk_a_schema_reconciliation` deployet til test 2026-05-01.
- **Blokk B (Vegvesen-integrasjon):** Service-lag i `apps/api/src/services/maskin/` (vegvesen-api, vegvesen, vegvesen-worker, moduleGate, equipment) per cross-modul-konvensjon (arkitektur-syntese § 6.1.1). 3 nye tRPC-endepunkter: `hentFraVegvesenForhandsvisning` (synkron mutation, 409 ved duplikat), `opprettMedVegvesen` (Variant A — klient sender bekreftet vegvesenData, server validerer kjennemerke-match), `oppdaterFraVegvesen` (admin-only, kø-basert). VegvesenKo-worker: 60s polling-løkke + 5min watchdog + 15min pause ved 429 + 5 retries. Klient-UI: Vegvesen-flyt aktivert i `nytt/page.tsx` med forhåndsvisning-panel + «fortsett uten Vegvesen-data»-fallback + eierskap-velger (eid/leid/leasing/lant) + årsmodell-felt + kallenavn. Felles `normaliserRegnummer()` i `packages/shared/src/utils/regnummer.ts` brukes i klient-input, Zod-validering og server-sammenligning. ~36 nye i18n-nøkler.
- **Blokk C1 (read-only detaljside + filter-bar + statusendring):** Filter-bar i listevisning med chip-buttons (kategori med count, status, ansvarlig-dropdown, fritekstsøk, vis-pensjonerte-toggle). Klikk på rad navigerer til ny detaljside `/dashbord/maskin/[id]`. Detaljside har 8 seksjoner read-only (generelt, anskaffelse, ansvarlig, kjøretøy-info, EU-kontroll med trafikklys-banner, anleggsmaskin-info, småutstyr-info, notater) + statusendring-modal med pensjonertGrunn-velger og advarsel + Vegvesen-oppdater-knapp (admin-only, polling 10s mot vegvesenKo.hentStatus). Nye API-endepunkter: `equipment.list` med sok-filter, `equipment.antallPerKategori`, `equipment.hentMuligeAnsvarlige`, `bruker.hentMin`. ~50 nye i18n-nøkler.
- **Blokk C2 (modal-redigering + ansvarlig-CRUD):** Detaljside utvidet med rediger-knapper på 5 seksjoner (Generelt, Anskaffelse, Kjøretøy-info, Anleggsmaskin-info, Småutstyr-info) som åpner én generisk `RedigerModal`-komponent. Ansvarlig-seksjonen erstattet med full CRUD: hovedansvarlig kan endres (UserPicker), tilleggsansvarlige listes med periode-start + (×)-fjern-knapp, (+)-knapp åpner LeggTilAnsvarlig-modal. Server-side: ny `verifiserMaskinAnsvarligSkriveTilgang(ctxUserId, equipmentId)` i tilgangskontroll.ts — sitedoc_admin/company_admin/primær-ansvarlig kan endre ansvarlig-felter (per A.6 hybrid). Ny `ansvarlig`-router (`maskin.ansvarlig.list/tilfoy/fjern`) med soft-delete (periodeSlutt = now), cross-org-blokkering, conflict-sjekk. `equipment.oppdater` utvidet med 30+ redigerbare felt (alle Generelt/Anskaffelse/manuelle Kjøretøy-info/Anleggsmaskin-info/Småutstyr-info). Vegvesen-felter overskrives av oppdaterFraVegvesen-flyten — ikke manuelt. ~18 nye i18n-nøkler. **Lukker forutsetning for SmartDok-import.**
- **Type-fix (`77d7bd67`, 2026-05-01):** Build feilet på test for C2 — `Input`-komponenten i RedigerModal returnerer `string | null` via onChange, men `RedigerInputs.type`-feltet er `string | undefined` (påkrevd-felt i `equipment.oppdater`-schema, kan ikke settes null). Lokal `tsc --noEmit` fanget ikke dette fordi local config er mindre strikt enn Next.js-build. Fix: erstattet `<Input v={inn.type}>` med inline `<input>` for type-feltet i Generelt-modalen. **Lærdom for fremtidige bugs:** Next.js-build kjører strengere tsc enn lokal — verifiser alltid med `pnpm build --filter @sitedoc/web` lokalt før test-deploy hvis nye felter med komplekse Optional-typer introduseres.

**Timer-modul Fase 3 STARTET 2026-05-01 (Infrastruktur-commit, på `feature/maskin-db`):**
- **packages/db-timer/-pakke opprettet:** 7 Runde-1-tabeller i postgres-schema `timer` (`lonnsarter`, `aktiviteter`, `tillegg`, `expense_categories`, `daily_sheets`, `sheet_timer`, `sheet_tillegg`). Egen Prisma-klient (`.prisma/timer-client`), cross-package-FK som svake String-felt (samme mønster som db-maskin). Init-migrasjon `20260501200000_init`.
- **Kjernen-utvidelse:** `Organization.harTimerModul Boolean default false` (midlertidig modul-flagg, samme mønster som `harMaskinModul`). `OrganizationSetting` utvidet med 4 felt: `dagsnorm Decimal default 7.5`, `overtidsmatTerskel Decimal default 9.0`, `tillattSelvAttestering Boolean default true`, `timerLockEtterDager Int? null` (Variant A — null = ingen alders-grense, status styrer låsing). Migrasjon `20260501200000_add_timer_modul_og_settings`.
- **Service-lag:** `apps/api/src/services/timer/moduleGate.ts` (`erTimerAktivert` + `krevTimerAktivert` + `TimerModulIkkeAktivertError`). `apps/api/src/services/seed/index.ts` (5 stub-funksjoner for Runde 1A: `seedLonnsartNivaa1/2`, `seedAktiviteter`, `seedTillegg`, `seedExpenseCategories` + samlet `seedTimerForOrganization`).
- **Workspace-deps:** `@sitedoc/db-timer` lagt til i `apps/api/package.json` + `apps/web/package.json`. Krever `pnpm install` før `prisma generate`.
- **Migrasjons-SQL skrevet manuelt** (ikke kjørt mot lokal-DB ennå). Kenneth kjører `pnpm install` + `pnpm --filter @sitedoc/db-timer exec prisma generate` + `pnpm --filter @sitedoc/db-timer exec prisma migrate deploy` + tilsvarende for `@sitedoc/db` mot test før prod.
- **Ikke i denne commit-en:** prototype-sletting (Runde 1B), modulProcedure i tRPC-base, dagsseddel-flyt, leder-attestering, mobil/offline, eksport-adaptere.

**Timer-modul Fase 3 — Runde 1A IMPLEMENTERT 2026-05-01 (`feature/timer-1a`):**
- **tRPC-router `timer.*`:** ny mappe `apps/api/src/routes/timer/` med `onboarding.ts` (status/aktiverNivaa1/aktiverNivaa2/aktiverTomKatalog), `lonnsart.ts` (list/opprett/oppdater/deaktiver), `aktivitet.ts` (analog), `tillegg.ts` (analog), `index.ts`. Registrert i `appRouter`. `prismaTimer` lagt i tRPC-context. RBAC: `verifiserFirmaAdmin` for skrive-mutations, alle ansatte i firma kan lese.
- **Seed-funksjoner med faktisk innhold:** `seedLonnsartNivaa1` (16: Fastlønn, Timelønn, Overtid 50%/100%, sykemelding/permittering/feriepenger osv. per AML/Folketrygdloven/Ferieloven). `seedLonnsartNivaa2` (25: Velferdspermisjon, Reise 7,5–15/15–30/30–45/45–60 km, Diett-pakke, Skifttillegg, Lærling-pakke, Innleid arbeidskraft, Fakturerbar tid m.fl.). `seedAktiviteter` (3: Anleggsarbeid, Maskintimer, Garanti/reklamasjon). `seedTillegg` (3: Overtidsmat, Smusstilleg, Beredskap-vakt). `seedExpenseCategories` (5: Drivstoff, Parkering, Diett, Verktøy, Annet). Alle idempotente — re-kjøring overskriver ikke.
- **Web-sider:** `/dashbord/firma/timer/{onboarding,lonnsarter,aktiviteter,tillegg}/page.tsx` + felles `layout.tsx` (sub-nav) + `page.tsx` (redirect). Onboarding-side har 3 scenarioer (Aktiver Nivå 1, Nivå 1+2, tom katalog). CRUD-tabeller med opprett/rediger-modal og deaktiver/reaktiver-toggle (soft-delete via Restrict-FK på SheetTimer/SheetTillegg/DailySheet). Sidebar-element «Timer» (Clock-ikon) i firma-layout, gates på `harTimerModul`.
- **i18n:** ~85 nye nøkler under `firma.timer.*` (nb+en) + 3 generiske (`ja`, `nei`, `handling.handlinger`).
- **Verifisert:** Lokal `pnpm build --filter @sitedoc/web` grønt — alle 5 timer-ruter kompilert. tRPC-typer eksponert via `appRouter`. Klar for test-deploy.

**Timer-modul Fase 3 — Runde 1B (dagsseddel-flyt) IMPLEMENTERT 2026-05-01 (`feature/timer-1b`):**
- **Slettet prototype:** `apps/web/src/app/dashbord/[prosjektId]/timer/page.tsx` (914 linjer hardkodet demodata) — erstattet av reell implementasjon.
- **tRPC-router `timer.dagsseddel.*`:** ny fil `apps/api/src/routes/timer/dagsseddel.ts` med 12 endepunkter: `list` (filter på projectId/userId/periode/status, kun egne sedler hvis ikke admin), `hentMedId` (full join inkl. timer-rader/tillegg-rader/aktivitet/prosjekt), `opprett` (idempotent via `clientUuid`), `oppdater` (header-felt), `tilfoy/oppdater/fjernTimerRad`, `tilfoy/oppdater/fjernTilleggRad`, `send` (draft → sent, krever ≥1 timer-rad), `slett` (kun draft).
- **Status-livssyklus enforcing:** `draft`/`returned` redigerbar, `sent`/`accepted` låst. `OrganizationSetting.timerLockEtterDager` sjekkes kun for `draft` (null = ingen alders-grense). Cross-org-blokkering via `verifiserProsjektmedlem` på opprett, eierskaps-sjekk via `hentEgenDagsseddel` på alle muteringer.
- **Web-sider under `/dashbord/[prosjektId]/timer/`:** `page.tsx` (liste-side med ISO-uke-velger, status-filter, status-badge), `ny/page.tsx` (opprett-skjema med dato/aktivitet/klokkeslett/pause/beskrivelse, default-aktivitet «Anleggsarbeid» hvis seedet, stabil clientUuid for idempotens), `[id]/page.tsx` (detaljside med 4 seksjoner: header-redigering, timer-rader-CRUD, tillegg-rader-CRUD, send/slett-handlinger). `status-badge.tsx` som delt komponent (Next.js page.tsx kan ikke ha named exports).
- **HovedSidebar Timer-gating:** Timer-element gates på `harTimerModul` (samme mønster som maskin). `kreverFirmaModul: "maskin" | "timer"` utvidet i `SidebarElement`-interface.
- **i18n:** ~50 nye nøkler under `timer.*` (nb+en) — felter, status-typer, kolonneoverskrifter, dialog-titler, feilmeldinger.
- **Verifisert:** `pnpm build --filter @sitedoc/web` grønt — 3 nye `/[prosjektId]/timer/*`-ruter + 5 fra Runde 1A. Type-fix: TS2589 «Type instantiation excessively deep» rettet ved å eksplisitt typee `onError: (e: { message: string })` på alle useMutation-callbacks i detaljsiden (per CLAUDE.md-regel — pre-eksisterende lærdom).
- **Deployet til prod 2026-05-01** (`c1122c2e`). Ingen nye DB-migrasjoner — kun kode.

**Timer-modul Fase 3 — Runde 1C (leder-attestering) IMPLEMENTERT 2026-05-01 (`feature/timer-1c`):**
- **tRPC-router-utvidelse:** 4 nye endepunkter i `dagsseddel.ts`: `hentTilGodkjenning({projectId})` (alle innsendte for prosjektet, beriket med ansatt-info), `kanGodkjenne({projectId})` (boolean — sidebar-gating), `returner({id, kommentar})` (sent → returned, krever ikke-tom kommentar), `attester({id})` (sent → accepted med pris-snapshot per rad og DailySheet.attestertAvUserId/attestertVed). Lokal helper `erProsjektLeder` + `krevProsjektLeder` — sjekker `ProjectMember.role ∈ {admin, project_manager}` eller `sitedoc_admin`/`company_admin` med matchende org.
- **Snapshot-pattern (Fase 0 A.7):** Ved attester kopieres katalog-data inn i `SheetTimer.attestertSnapshot` + `SheetTillegg.attestertSnapshot` JSON-felt: `{lonnsartId/tilleggId, kode, navn, type, prisMotKunde, internkostnad, sats, satsEnhet, attestertVed}`. Decimal-felt serialiseres som strings (toString()) for å bevare presisjon. Atomisk via `prismaTimer.$transaction([...])` — alle rader + status-overgang i én commit.
- **Web-side `/dashbord/[prosjektId]/timer/godkjenning/page.tsx`:** Leder-vy med tabell over innsendte sedler (dato/ansatt/aktivitet/totaltimer/rader-count). Tre actions per rad: åpne (chevron til detaljside), returner (RotateCcw-ikon, åpner kommentar-modal), attester (Check-ikon, direkte mutation). Returner-modal har påkrevd kommentar (min 1 tegn). `kanGodkjenne`-sjekk gir tydelig «ingen tilgang»-melding for ikke-ledere.
- **Detaljside-utvidelse (`[id]/page.tsx`):** To nye banner-seksjoner: returned-banner med leder-kommentar (amber, viser hva som må rettes), accepted-banner med attestert-tidspunkt (grønn). `lederKommentar`-feltet (allerede i schema) brukes som tilbakemeldingskanalen. Ansatt kan redigere returned-sedler og sende på nytt (samme send-mutation, status går returned → sent).
- **Sidebar-utvidelse:** Nytt seksjons-element «timer-godkjenning» (CheckCircle2-ikon) i `Seksjon`-typen + seksjonMap. HovedSidebar gates på `harTimerModul && kanGodkjenne` — usynlig for ikke-ledere. URL-mønster `/dashbord/[prosjektId]/timer/godkjenning` håndteres av useAktivSeksjon (spesialfall etter prosjektId-deler).
- **i18n:** ~17 nye nøkler under `timer.godkjenning.*` + `timer.detalj.{returnertTittel,returnertHjelp,attestertTittel}` + `nav.timerGodkjenning` (nb+en).
- **Verifisert:** `pnpm build --filter @sitedoc/web` grønt — ny ruten `/dashbord/[prosjektId]/timer/godkjenning` + alle eksisterende kompilert. tsc grønt for api+web (kun pre-eksisterende vitest-typing). Klar for test-deploy.

**Timer-modul Fase 3 — Runde 2 (mobil + offline-sync) C1–C5 IMPLEMENTERT 2026-05-01 (`feature/timer-2`, IKKE merget til develop):**
- **Godkjent scope:** kun timer-rader + tillegg-rader (ikke utlegg/maskin), kun ansatts egne sedler på mobil (leder-attestering kun på web), server-wins ved konflikt med tydelig banner.
- **C1 (`8a3c8a9a`) — Drizzle-skjema:** 6 nye SQLite-tabeller i `apps/mobile/src/db/schema.ts`: `dagsseddel_local` (id = clientUuid, sync-atom for hele sedlen), `sheet_timer_local`, `sheet_tillegg_local` (skrive-tabeller med syncStatus pending/synced/conflict) + `lonnsart_local`, `aktivitet_local`, `tillegg_local` (read-only katalog-cache). Idempotente CREATE TABLE IF NOT EXISTS i `migreringer.ts`. Decimal-felt fra Postgres serialiseres som tekst for presisjon, timestamps Unix ms.
- **C2 (`4c89e498`) — Server-side sync-endepunkter:** To nye i `apps/api/src/routes/timer/dagsseddel.ts`: `hentEndringerSiden` (query — pull alle sedler endret etter ISO timestamp, full pull begrenset til siste 90 dager, returnerer sedler med rader serialisert), `syncBatch` (mutation — Array<{clientUuid, ...rader}>, maks 100, per-seddel `prismaTimer.$transaction`, uavhengig resultat per seddel: `ok`/`conflict`/`feilet`, ingen rollback på tvers, klient kan ikke sette status=accepted, rader erstattes via deleteMany+createMany).
- **C3 (`e8f15f1e`) — Sync-motor:** Ny `apps/mobile/src/services/timerSync.ts` med `syncTimer(klient, userId)` som orkestrerer push (pending → server) + pull (siden → server), batches av 100 sedler. Ny `apps/mobile/src/providers/TimerSyncProvider.tsx` etter SpraakProvider — eksponerer `pendingAntall/conflictAntall/sistSynkronisert/syncerNa/sisteFeil` + `triggerSync()`. Auto-trigger ved login + nett-gjenkomst, 30s interval mens app er aktiv + online. Server-wins: conflict overskriver lokal med serverData.
- **C4 (`27598e7a`) — Katalog-cache:** Ny `apps/mobile/src/services/timerKatalog.ts` med `refreshKatalog(klient)` (full nedlasting fra `timer.{lonnsart,aktivitet,tillegg}.list`, atomisk overskriving per type) + synkrone lese-funksjoner (`hentLonnsarterLokalt`/`hentAktiviteterLokalt`/`hentTilleggLokalt`/`finnLonnsartLokalt`/etc.) for offline-trygge UI-velgere. Provider trigger katalog-refresh sammen med syncTimer ved login.
- **C5 (`d2a81fa7`) — UI-liste:** Ny `apps/mobile/app/timer/_layout.tsx` + `index.tsx` (liste over mine dagssedler les fra dagsseddel_local, sortert dato desc, pull-to-refresh, refocus-rerender, FAB → /timer/ny). Ny `TimerStatusMerkelapp.tsx` (status-badge utkast/sendt/returnert/attestert + sync-status-badge) + `TimerSyncStatusBar.tsx` (tynn statusbar: offline/syncerNa/pending/conflict/synced med farger + manuell trigger). Mer-tab utvidet med Timer-rad + badge for pending/conflict.
- **Pre-eksisterende kjent issue:** Mobil tsc har 9 pre-eksisterende feil (oppgave/sjekkliste/PSI/3D/hjem-tab) som ikke er knyttet til timer-2 — Metro bundler kjører uavhengig av tsc. Trpc-import-feil i rapportobjekter ble fikset på develop (`f062c5f2`) før timer-2 — fix vil komme inn naturlig ved senere develop-merge.
- **C5 visuelt verifisert 2026-05-02** på iOS Simulator + fysisk mobil etter test-deploy (`0342b883`). Liste-side viste eksisterende sedler synket fra prod-DB, sync-statusbar fungerer, Mer-tab Timer-rad navigerer korrekt.
- **C6 (`90c73991`) — Opprett-skjema + detaljside:** `apps/mobile/app/timer/ny.tsx` (DateTimePicker + prosjekt-velger via `trpc.prosjekt.hentMine` + aktivitet-velger fra lokal cache med default `Anleggsarbeid` + valgfri beskrivelse → `randomUUID()` clientUuid + insert til `dagsseddel_local` med `syncStatus=pending`). `apps/mobile/app/timer/[id].tsx` (header med dato/aktivitet/status-badge, status-banners for returned/accepted/conflict/pending, timer-rader-seksjon med +/rediger/slett, tillegg-rader-seksjon analog, send-til-attestering-knapp som krever ≥1 timer-rad, slett-knapp med `Alert.alert`-bekreftelse — kun draft). 4 modaler (TimerRadModal, TilleggRadModal, LonnsartVelgerModal, TilleggVelgerModal) inline i [id].tsx leser fra lokal cache med søk når > 7 elementer. Alle endringer markerer `syncStatus=pending` + `sistEndretLokalt` + trigger sync via `TimerSyncProvider`.
- **C7 — i18n + docs:** ~50 nye nøkler under `timer.*` i nb.json + en.json (sync.*, status.utkast/sendt/returnert/attestert, felt.*, tilfoy.*, rediger.*, ingenLonnsarter/Tillegg/TimerRader/TilleggRader, feil.*, bekreftSlett*, sendTilGodkjenning, slettDagsseddel m.fl.). Total: 155 timer-nøkler per språk. CLAUDE.md + STATUS.md + timer.md oppdatert med Runde 2-fremdrift.
- **C8 (`af91dff3`) — Underprosjekt-velger:** Ny `eksternKostObjekt`-router (server) med `list({ projectId? })` for aktive ECO-er filtert på `status="aktiv" + timerregistreringApen=true`. Ny `external_cost_object_local`-tabell + idempotent migrering. `timerKatalog.refreshKatalog` henter ECO-er via Promise.all med catch-fallback (ikke-kritisk hvis router mangler). UnderprosjektVelgerModal i TimerRadModal (filtrerer på prosjekt + søk når > 7). TimerRadVis viser ECO-etikett (proAdmId + kortNavn) under lønnsart. Fjern-X-knapp ved siden av valgt underprosjekt. ~3 nye i18n-nøkler.
- **Merge til develop:** `1cce62f3` 2026-05-02 sent kveld. Inkluderer også OppgaveModal-fix (`ff313e54` — `trpc.arbeidsforlop` → `dokumentflyt`).
- **Test-deploy + prod-deploy utsatt til neste sesjon.** Server-side krever fersk deploy for at C6–C8 skal fungere fra mobil (syncBatch + hentEndringerSiden + dev-login + eksternKostObjekt-router).

**DB-naming-opprydning — ferdig (parkert):**
- Faggruppe-rename gjennomført på test (2026-04-15/16) og prod (2026-04-16) via tre migreringer (`navnegjennomgang`, `enterprise_rename_dokumentflyt_part`, `faggruppe_rename`). Verifisert i [db-naming-audit-2026-04-25.md](db-naming-audit-2026-04-25.md)
- U.1 (`project_groups.building_ids` jsonb) utsatt til Fase 0.5 — drop koordineres med m2m-koblingstabell
- U.2 (FK-constraint-navn fortsatt på engelsk) parkert som lavt-prioritert kosmetikk — tas naturlig ved neste større migrering
- Lokal-DB er bevisst ikke vedlikeholdt; re-seedes fra test ved behov per § «Primærmiljø»

Status og detaljer: [db-opprydning.md](db-opprydning.md).

## Pauset arbeid

**Timer/Maskin-revurdering** er utsatt til etter Fase 0-fundament er ferdig. timer.md og maskin.md har drift mot fase-0-beslutninger og må justeres før Fase 3 (Timer-modul) og Fase 1-fullføring (Maskin-modul-gateway) — men Fase 0-fundamentet bygges nå uavhengig av denne revurderingen.

## Planlagte oppgaver

**Onboarding-veileder (prioritert — forutsetning for A.Markussen):** Ny bruker vet ikke rekkefølge eller URL for oppsett etter prosjektopprettelse. Observert 2026-05-02: 4 404-feil ved forsøk på å finne faggruppe-oppsett via intuitive URL-er. Konkret rotårsak: to nesten-identiske faggruppe-sider eksisterer (`/dashbord/[prosjektId]/faggrupper` er **read-only**, mens `/dashbord/prosjekter/[id]/faggrupper` har **full CRUD**) — ingen visuell forskjell, ingen lenke fra read-only-siden til full versjon. Mangler:
- Lenke fra faggruppe-tom-state (`[prosjektId]/faggrupper`) til riktig opprett-side (`prosjekter/[id]/faggrupper`)
- Steg-for-steg veileder etter prosjektopprettelse (faggrupper → maler → medlemmer)
- Tom-state på prosjekt-dashbord som veileder ny bruker
- Konsolidering av de to faggruppe-sidene (langtids-mål) — én side med riktig UI, ingen URL-duplikat

Blokkerer selvstendig A.Markussen-onboarding. Ankret i [onboarding-veileder.md](onboarding-veileder.md).

**Testbrukere (planlagt — etter Timer er ferdig):** Opprett strukturerte testbrukere i test-DB for systematisk verifisering av tilgangsnivåer:
- **Ola Tømrer** — produksjon-rolle (`ProjectMember.role = "worker"` eller `"field_user"`)
- **Per Prosjektadmin** — `ProjectMember.role = "project_manager"`
- **Kari Firmaadmin** — `User.role = "company_admin"` med `organizationId` satt
- **Tore SiteDocAdmin** — `User.role = "sitedoc_admin"`

Formål: systematisk verifisering av at riktige funksjoner er tilgjengelig per rolle, og at utilgjengelige funksjoner er skjult/blokkert. Eksempel: Timer-attestering skal kun være synlig for Per/Kari/Tore (ikke Ola); Firma-administrasjon skal kun være tilgjengelig for Kari/Tore; Superadmin-flater kun for Tore. Dekker også verifisering av RBAC-helpers (`harProsjektTilgang`, `verifiserOrganisasjonTilgang`, `verifiserSiteDocAdmin`) og sidebar-gating.

## Kjente bugs

**Lokasjon-modal forhåndsvelger ikke når kun ett alternativ finnes (observert 2026-05-02):** Når en sjekkliste har lokasjon-felt og prosjektet har bare 1 byggeplass + 1 tegning, må brukeren likevel klikke gjennom dropdownene manuelt. Bør auto-velge når dropdown har én eneste option per nivå. Lav prioritet, men irriterende ved hver lagring/sending. Foreslått fiks: i lokasjon-modal-komponenten, sett valgt verdi automatisk hvis `options.length === 1` per dropdown.

## Planlagte faser

Detaljert plan: [arkitektur-syntese.md §5](arkitektur-syntese.md). Beslutningsgrunnlag: [fase-0-beslutninger.md](fase-0-beslutninger.md).

**Fase 0 — Firma-fundament + tilgangsinfrastruktur:**
- Datamodell (13 migrasjons-steg per § E i fase-0-beslutninger): `Activity`, `OrganizationSetting`, `OrganizationPartner`, `OrganizationTemplate`, `ProjectOrganization` (rename av OrganizationProject + `rolle`), `Project.primaryOrganizationId String?` (nullable), `ProjectModule`-utvidelse (`organizationId` + `status` per A.4/A.17), `Psi.organizationId` + `projectId` nullable + `kontekstType`, `BibliotekMal`-utvidelse (kategori/domene/kobletTilModul/verifisert), `ProjectMember.periodeSlutt` + `userId` cascade SetNull (per B.7), `ExternalCostObject`, `Godkjenning` + `DocumentTransfer.kostnadSnapshot/godkjenningId`, `User`-utvidelse (canLogin, HMS-kort, ansattnummer, nasjonalitet, arbeidstillatelse + composite unique på email + phone per B.7)
- Selektiv Timestamptz på 11 felter per B.6 (timer/audit/godkjenning/PsiSignatur/frist-felter/Invitation)
- Infrastruktur: `prosjektProcedure`, `modulProcedure(slug)` i tRPC
- Refaktor: 9 funksjoner i `tilgangskontroll.ts` for ProjectMember-periode

**Fase 0.5 — Byggeplass + Avdeling-fundament:**
- Tre åpne arkitektur-prinsipper besluttes (NULL-betydning, default-byggeplass, FK vs jsonb) per [byggeplass-strategi.md](byggeplass-strategi.md)
- `ByggeplassMedlemskap` (loan-pattern: User → Byggeplass over tid)
- Drop `building_ids` jsonb fra `project_groups`
- `Avdeling`-tabell i `packages/db` (kjernen) — firma-intern organisatorisk inndeling, separat dimensjon fra byggeplass
- `User.avdelingId` valgfri (ny kolonne)
- Avklaring av seed-mekanismer som registreres her vs i Fase 3

**Fase 1 — Maskin med modul-gateway** (allerede under bygging på `feature/maskin-db` — gates før prod):
- Refaktor maskin-rutene til `modulProcedure('maskin')`
- `EquipmentChecklist` + `EquipmentChecklistTemplate` i `db-maskin`
- Manuell trigger fra maskinregister

**Fase 2 — Mal-promotering:**
- `OrganizationTemplate` + `ReportTemplate.organizationTemplateId`
- UI for «Send til firmabibliotek»

**Fase 3 — Timer-modul** (inkl. Kompetanseregister):
- Lønnsarter, arbeidstidskalender, dagsseddel med byggeplassId fra dag 1
- Underprosjekt (Proadm-import eller SiteDoc Godkjenning)

**Fase 4 — Mannskap/PSI-modul.**

**Fase 5 — Varelager-modul.**

**Fase 6 — Avansert:** DO-kobling, AI-ukeplan.

**Fase 7 — Prosjekthotell-utvidelser (parallelt spor):** Møtemal, Månedsrapport, HMS-statistikk firma-nivå, Street View, auto-trigger maskin-sjekkliste fra service-varsel.

**TODO etter Maskin (Fase 1) + Timer (Fase 3):** [Aktivitetsfeed på dashboard](aktivitetsfeed.md) — bruker eksisterende Activity-tabell, polling via tRPC, konfigurerbar periode (default 10 dager) + hendelsestyper + GDPR-retensjon i OrganizationSetting. Ekstern partner-feed-scope krever egen designrunde.

**Commits på `feature/maskin-db`** venter på merge til develop:
- `a4d7771` — Proadm-detaljer i timer.md
- `89e102c` — Proadm-regel i CLAUDE.md
- DB-opprydning-relaterte audit/doc-commits (2026-04-25)
- Arkitektur-dokumentasjon (2026-04-25/26)
