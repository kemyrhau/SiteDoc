# STATUS — docs/claude/-filer

> **Vedlikeholdsregel:** STATUS.md oppdateres av Opus i samme commit som endrer fil-status. Aldri separat commit.
>
> **Status oppdateres ved:** (1) ny verifikasjon/screening fullført, (2) drift rettet, (3) fil opprettet/slettet/arkivert.
>
> **Konsolidering ≠ verifikasjon:** Når en fil får tilført en ny seksjon med besluttede regler/policy (markert med `K{n}.x YYYY-MM-DD`), endrer det IKKE filens verifikasjons-status. Eksisterende innhold er ikke re-verifisert mot kode. Status forblir som var.
>
> **Kommentar-kolonne-tagger:**
> - `Sannhetskilde:` — innholds-aktiv (peker-mål for andre filer)
> - `Arbeidsanker:` — bruks-aktiv (pågående arbeid, endres ofte)
> - Hvis ingen av delene: kort fri beskrivelse (eller tom)

**Sist oppdatert:** 2026-05-02
**Antall filer dekket:** 36 (komplett oversikt)

> **Fase 0.5 KOMPLETT (deployet til prod 2026-05-01):** § 1 Avdeling (`a90daabd`), § 2 Kompetanse (`a5ba99ce`), § 3 ProjectGroupByggeplass + drop building_ids (`3836b322`), § 5 Slette-policy (`f13dc6c0`). Merge: develop `9fed74a5` → main `f0a515cd`. Etter-Fase-0.5: Avdeling-UI (`2799a4d1` prod). Kompetanse-UI Runde 1 (`0965ddf2` prod) — kompetansetyper-CRUD + matrise read-only + settings-toggle. Kompetanse-UI Runde 2 (`653028b4` prod) — AnsattKompetanse-CRUD via celle-klikk + RBAC. Kompetanse-UI Runde 2.5 (`30ec98a9` prod) — CSV/Excel-import med 4-stegs flyt + filHash-validering + atomisk transaksjon + 30 i18n-nøkler. csv-parse@6.2.1 installert i apps/api.
>
> **Timer-modulen Fase 3 STARTET 2026-05-01 (Infrastruktur-commit):** ny `packages/db-timer/`-pakke med 7 Runde-1-tabeller i postgres-schema `timer` (lonnsarter, aktiviteter, tillegg, expense_categories, daily_sheets, sheet_timer, sheet_tillegg) — egen Prisma-klient (`.prisma/timer-client`), cross-package-FK som svake String-felt (samme mønster som db-maskin). Init-migrasjon `20260501200000_init`. Kjernen-migrasjon `20260501200000_add_timer_modul_og_settings`: `Organization.harTimerModul` (midlertidig modul-flagg) + `OrganizationSetting`-utvidelse (dagsnorm 7.5, overtidsmatTerskel 9.0, tillattSelvAttestering true, timerLockEtterDager Int? null). `apps/api/src/services/timer/moduleGate.ts` (erTimerAktivert + krevTimerAktivert) + `apps/api/src/services/seed/index.ts` (5 stub-funksjoner for Runde 1A). `db-timer` workspace-dependency lagt til i apps/api og apps/web. Migrasjon-SQL skrevet manuelt — Kenneth kjører `pnpm install` + `prisma migrate deploy` mot lokal/test før applye.
>
> **Timer-modulen Fase 3 — Runde 1A (katalog-admin) DEPLOYET TIL PROD 2026-05-01:** ny `timer.*` tRPC-router (onboarding/lonnsart/aktivitet/tillegg) + `prismaTimer` i context. 5 seed-funksjoner med faktisk innhold (16+25 lønnsarter, 3 aktiviteter, 3 tillegg, 5 utleggskategorier). Web-sider under `/dashbord/firma/timer/`. Sidebar-element gates på `harTimerModul`. ~85 nye i18n-nøkler. Prod-deploy hadde issue: `db-timer/.env` manglet på prod-server, men `migrate | tail` svelget P1012-feilen → schema manglet i 5 minutter, fikset via separat .env-opprettelse + re-migrate. Pipe-fellen lagt til i CLAUDE.md.
>
> **Timer-modulen Fase 3 — Runde 1B (dagsseddel-flyt) DEPLOYET TIL PROD 2026-05-01** (`c1122c2e`): Slettet prototype `apps/web/src/app/dashbord/[prosjektId]/timer/page.tsx` (914 linjer hardkodet demodata). Ny `timer.dagsseddel.*` tRPC-router med 12 endepunkter (list/hentMedId/opprett/oppdater + tilfoy/oppdater/fjern × timer-rader/tillegg-rader + send/slett). Idempotens via `clientUuid`, status-livssyklus enforcing (draft/returned redigerbar, sent/accepted låst), `timerLockEtterDager` sjekkes kun for draft. Web-sider: liste-side (ISO-uke-velger + status-filter + status-badge), ny-side (opprett-skjema med default-aktivitet og stabil clientUuid), detalj-side (4 seksjoner: header/timer-rader/tillegg-rader/send-handlinger med modal-dialoger). Sidebar Timer-element gates på `harTimerModul`. ~50 nye i18n-nøkler. Ingen nye DB-migrasjoner — kun kode.
>
> **Timer-modulen Fase 3 — Runde 1C (leder-godkjenning) IMPLEMENTERT 2026-05-01 på `feature/timer-1c`:** 4 nye endepunkter i `dagsseddel.ts`: `hentTilGodkjenning` (innsendte sedler m/ansatt-info), `kanGodkjenne` (boolean for sidebar), `returner({id, kommentar})` (sent → returned, krever kommentar), `attester({id})` (sent → accepted med pris-snapshot per rad i `SheetTimer.attestertSnapshot`/`SheetTillegg.attestertSnapshot` JSON-felt + `DailySheet.attestertAvUserId/attestertVed`). Atomisk via `$transaction`. Lokal helper `erProsjektLeder` (admin/project_manager + sitedoc/company-admin). Web-side `/dashbord/[prosjektId]/timer/godkjenning` med tabell + attester/returner-actions + kommentar-modal. Detaljside utvidet med returned-banner (leder-kommentar) + accepted-banner (attestert-tidspunkt). Sidebar-element «timer-godkjenning» (CheckCircle2-ikon) gates på `harTimerModul && kanGodkjenne`. Ny seksjon `timer-godkjenning` i `Seksjon`-typen. ~17 nye i18n-nøkler. `pnpm build` grønt. Klar for test-deploy.

## Sammendrag

| Status | Antall |
|---|---:|
| ✅ Verifisert mot kode | 5 |
| ⚠️ Drift identifisert | 4 |
| 🔄 Under arbeid | 4 |
| ❌ Ikke screenet | 20 |
| 📦 Arkivert | 3 |
| **Totalt** | **36** |

---

## ✅ Verifisert mot kode

| Fil | Sist verifisert | Kommentar |
|---|---|---|
| arkitektur.md | 2026-04-27 | **Sannhetskilde:** Fundament |
| arkitektur-syntese.md | 2026-05-01 | **Sannhetskilde:** Anker for Fase 0-koding (sammen med fase-0-beslutninger.md). Bunke 3A.1-funn fullt lukket: P1.1, P1.2, P1.3, P1.4, P1.5, P1.6, P1.7. K3.1 ny § 1.5 tabs-UI. § 3.8 datadrevne kataloger + 3.9 snapshot-pattern + 3.10 eksport-kode-policy + 6.2 asynkron arbeid + 7.4 adapter-mønster tilføyd 2026-04-29/30 (3A komplett). § 5 Fase 0.5: A.30 byggeplassId-NULL = A1 vedtatt. P1.6 verifisert 2026-04-30: alle 11 § 11-lenker gyldige, ingen drift. **2026-05-01 (Blokk A docs):** § 6.1.1 Cross-modul-tilgang via service-lag — kanon for alle firmamoduler (forbidden direkte DB-import, soft-skjul-policy ved deaktivert modul, lese-only fra service, skriving via modul-egne ruter). Vedtatt før Maskin Fase 1-fortsettelse |
| dokumentflyt.md | 2026-04-27 | **Sannhetskilde:** Fundament. **2026-04-29:** § 2.3 HMS-tabell utvidet med firma-HMS-ansvarlig-lese-tilgang (per A.27) |
| fase-0-beslutninger.md | 2026-05-01 | **Sannhetskilde:** Anker for Fase 0/0.5-koding. Fase 0.5 § 2 implementert 2026-05-01: Kompetansetype + AnsattKompetanse-tabeller (per A.28) + OrganizationSetting.kompetanseRegistreringTilgang (RBAC: firma_admin | bruker_egen | alle, default firma_admin) + 7-kategori-seed i shared. K1 2026-04-28: C.13 + 2 § J-rader (QA-runde-2, tidl. § G). § E steg 8: B-2-note 2026-04-28. **2026-04-29:** A.25 OrganizationRole + A.26 Smart modulProcedure + A.27 Firma-HMS-lese-tilgang (Alt A) + A.28 Kompetansematrise (Kompetansetype + AnsattKompetanse, SmartDok-verifisert) tilføyd. § E utvidet med steg 14 (OrganizationRole). C.14 Fase 0.5-rad for kompetanse. A.29 Offline sync-konflikt-strategi (conflict-modal + 60s grace-periode) tilføyd, A.23 utvidet med peker til A.29. **2026-04-30:** A.30 byggeplassId-NULL-semantikk vedtatt (A1: NULL = «gjelder hele prosjektet», allerede implementert i kode). C.16 Vareforbruk-modul (forbruksregistrering per prosjekt, ikke lagerstyring — SmartDok-verifisert) — Fase 3-implementasjon. A.25 Tildelings-policy klargjort (company_admin tildeler OrganizationRole via verifiserFirmaAdmin) + A.27 peker + § E steg 14 utvidet med endepunkts-spec. B.7 Fase 0 minimum-implementasjon (velg første aktive User-rad, org-velger-UI utsettes). § F Fase 0.7 Data-rens registrert (prod-forberedelse — opprett A.Markussen, slett standalone-brukere før § E steg 13b). Eksisterende § F/G/H renames til § I/J/K. **2026-05-01: § E KOMPLETT på `feature/fase-0-fundament`.** Alle 13 § E-steg implementert (E.9 hoppet over per § E — PSI-utvidelse forkastet 2026-04-28). E.1 Activity (`13a746a7`), E.2 OrganizationSetting (`4a155c28`), E.3 ProjectOrganization-rename (`1bff8672`), E.4 primaryOrganizationId (`137eed6f`), E.5 ProjectModule (`d9bfafc4`), E.6 OrganizationPartner (`22a772b6`), E.7 OrganizationTemplate (`7709ea32`), E.8 BibliotekMal + C.17 (`29311756`), E.10 ProjectMember.periodeSlutt + 3 loan-tabeller (`5b8beef6`), E.11 ExternalCostObject + C.6/C.7 (`9c9dd682`), E.12 Godkjenning + DocumentTransfer (`0622fc35`), E.13 User-utvidelse + B.7 composite unique + NextAuth-override (`37d49872`), E.14 OrganizationRole — egen tabell per A.25 (Variant B, ikke User.role-enum) + harOrgRolle() i tilgangskontroll.ts + 2 endepunkter organisasjon.tildelOrgRolle/fjernOrgRolle gated med verifiserFirmaAdmin (idempotent upsert, validering at målbruker tilhører samme firma). A.27 dokumentflyt-utvidelse (firma-HMS-ansvarlig automatisk lese-tilgang) bygges inn senere når dokumentflyt-route faktisk gates på dette. Branch klar for merge til develop. **2026-05-01 (Blokk A docs):** A.6 reformulert til hybrid-modell (single primær via `Equipment.ansvarligUserId` + optional m:n via `EquipmentAnsvarlig` for tilleggsansvarlige, ingen `rolle`-kolonne). C.9 forblir innarbeidet. Migrering: tom tabell, ingen drop. Tilgangsregel: firma-admin OG primær-ansvarlig kan tilføye/fjerne tilleggsansvarlige. Timer/Maskin-revurdering utsatt til etter Fase 0-deploy |
| terminologi.md | 2026-04-27 | **Sannhetskilde:** Fundament |

## ⚠️ Drift identifisert (Bunke 3A.1, 2026-04-28)

| Fil | Sist verifisert | Drift-omfang |
|---|---|---|
| forretningslogikk.md | 2026-04-28 | Byggeplan-rekkefølge motsigelse mot arkitektur-syntese, Godkjenning-status, lestAv-mekanikk for gruppe-mottaker |
| mobil.md | 2026-04-28 | 5 faggruppe-forekomster + 3 ulike Provider-tre-rekkefølger |
| okonomi.md | 2026-04-28 | 4 faggruppe-forekomster + FtdNotaComment mangler i tabell + ECO/Godkjenning-kobling mangler |
| web.md | 2026-04-28 | 21 faggruppe-forekomster + feil ruter (`/entrepriser` → `/faggrupper`, `/produksjon/entrepriser` → `/kontakter`) + feil API-navn (`hentMineEntrepriser` → `hentMineFaggrupper`) |

## 🔄 Under arbeid

| Fil | Sist verifisert | Kommentar |
|---|---|---|
| onboarding-veileder.md | ikke aktuelt | Idé-stadium, planlagt ~1 måned frem (post-Fase 0). Etablert 2026-04-28 |
| mannskap.md | 2026-04-28 | **Vy-beskrivelse i PSI-konteksten** etter 1D-presisering (N2.1-revidert). Datamodell forkastet (Mannskapsmedlem dupliserer User per memory). §15-felt-mapping bevart i tekstform. Endelig datamodell designes Fase 4 (PSI-utvidelse) |
| oppryddings-plan-2026-04-28.md | 2026-04-30 | **Arbeidsanker:** Aktiv anker for oppryddings-arbeidet etter Bunke 3A.1. P-KRITISK-seksjon (3 prod-blokkere) tilføyd 2026-04-28. Dokument-samhandlings-lukking Nivå 1-4 etablert 2026-04-28. Mini-Nivå 1D 2026-04-28: anker korrigert. Bunke N2.1-revidert (strammet) 2026-04-28: 2A+2B+2C kvittert. Bunke N2.2 registrert som etter-funn + A.Markussen-research-infeksjons-prinsipp. **2026-04-29:** P1.7 + P4.3 + P4.4 lukket. Screening-funn 2026-04-29 registrert: C.15 (manglende indekser) + SCREENING-29-1 (sikkerhet — medlem.oppdater organizationId) + SCREENING-29-2 (type-cast oppgave-detaljside). **C.15 lukket:** 42 indekser implementert over tre commits (Klasse 1 ce7af97, Klasse 2+3+composite 5174842, Klasse 4 1467000). **SCREENING-29-1 lukket:** sikkerhetsfiks i 37137e4 (medlem.oppdater + brukere/page.tsx). P1.1 + P1.2 + P1.5 lukket (fd63600). P5.6 utvidet og lukket strategisk — sammenslått med concurrent editing per A.29. SCREENING-29-2 delvis lukket via felles harBallen i shared, SCREENING-29-3 ny rad (e23e67d). 3A-A 4 prinsipper lukket. **2026-04-30:** P1.3 + P1.4 + P1.6 lukket. § 6.2 + A.30 vedtatt (5b90ab6 + 681aec8). 3A komplett — alle 8 prinsipper enten implementert, slått inn i andre § eller dropp. **SCREENING-29-3 lukket:** 9 TS2589-forekomster i 7 filer fikset via smal lokal interface-strategi — tsc --noEmit passerer. N2.2.3 + N2.2.4 omformulert: ikke blokkerende for Fase 0-koding (avventer ekstern API-tilgang/dialog). **Maskin-modul-gating:** midlertidig `Organization.harMaskinModul`-flagg + sidebar-skjul implementert (erstatter behov for modulProcedure før Fase 0). Bonus: 8. TS2589 i dashbord/page.tsx fikset (samme strategi) |
| timer-funn-fra-screening-2026-04-27.md | 2026-04-28 | **Arbeidsanker:** Midlertidig, slettes etter Timer/Maskin-revurdering |

## ❌ Ikke screenet

| Fil | Sist verifisert | Kommentar |
|---|---|---|
| adaptiv-sok-plan.md | — | Skal drøftes (per CLAUDE.md) |
| aktivitetsfeed.md | 2026-05-01 | **Planlagt fase** (etter Maskin Fase 1 + Timer Fase 3). Verifisering 2026-05-01: Activity-tabell finnes i prod (Fase 0 § E.1, `13a746a7`), ingen produsent-kode skrevet ennå. Spec dekker datamodell, polling-strategi, GDPR-retensjon, OrganizationSetting-utvidelser (`feedHendelsetyper` + `feedPeriodeDager` (default 10) + `activityRetentionAar` (default 5)). Ekstern partner-feed = egen designrunde |
| ai-integrasjon.md | — | — |
| ai-sok.md | — | — |
| api.md | — | — |
| bibliotek.md | — | Peker til kontrollplan.md (konsolidert) |
| byggeplass-strategi.md | — | Planlagt fase (per CLAUDE.md). K2.3 2026-04-28: slette-policy. **2026-05-01 (Fase 0.5 §§ 1-3 + § 5 implementert):** § 1 Avdeling + § 2 Kompetanse + § 3 ProjectGroupByggeplass m2m (Prinsipp C C1 vedtatt — building_ids droppet, verifisert dødt felt) + § 5 Slette-policy (API hentSletteSammendrag/slett med navn-bekreftelse + verifiserAdmin + UI SletteLokasjonDialog + i18n). Cascade-valg utsatt til senere — kun SetNull-default i første versjon. Verifisering 2026-05-01 fant feilantakelse: «EquipmentAnsvarlig.avdelingId» i strategi-fil — tabellen finnes ikke i db-maskin. ByggeplassMedlemskap utsatt til Fase 4 (Mannskap). **Fase 0.5 KOMPLETT** — branch klar for merge til develop |
| db-naming-audit-2026-04-25.md | — | Datert audit 2026-04-25 |
| db-opprydning.md | — | **Arbeidsanker:** Markert AKTIV (per CLAUDE.md). K3.2 2026-04-28: åpne audit-spørsmål mot prod. U.2 D-6 2026-04-28 (utvidet verifikasjon) |
| infrastruktur.md | — | — |
| kontrollplan.md | — | — |
| maskin.md | 2026-05-01 | Blokk A+B docs + parser-verifikasjon mot ZH44186 (ekte Vegvesen-kall bekreftet alle felt korrekt parset: VOLVO V70, VIN, kjoretoygruppe, karosseritype, farge, drivstoff, seter, effektKw, euroKlasse, totalvekt, nyttelast, euKontrollFrist, co2, forbruk). Vegvesen wrapper-struktur dokumentert (kjoretoydataListe[0]). **Blokk A docs (`d621b243`):** to nye seksjoner — § Ansvarlig per utstyr (hybrid-modell A.6) + § Cross-modul-integrasjon (Domain Service-lag, forbidden direkte `prismaMaskin`-import). **Blokk A schema (`de3fb1d0`):** EquipmentAnsvarlig + 15 nye Equipment-felt + 4 nye indekser. **Blokk B (`bdc79422`):** service-lag (vegvesen-api/vegvesen/vegvesen-worker/moduleGate) + 3 tRPC-endepunkter (forhandsvisning synkron, opprettMedVegvesen Variant A, oppdaterFraVegvesen admin-only kø) + 60s polling-worker + UI-flyt + 36 i18n-nøkler. normaliserRegnummer() i shared brukes i 3 lag. **Parser-fix (`021f01ae`):** wrapper-struktur (`kjoretoydataListe[0]`) + korrigerte stier (`tekniskeData.generelt.tekniskKode` for M1, `tekniskeData.karosseriOgLasteplan.karosseritype` for karosseritype). Datamapping-tabell oppdatert med faktisk struktur. Test-deployet og verifisert. **Prod-deploy (`11a41047` merge, 2026-05-01):** init + Blokk A applied i prod-DB, web/api re-startet med VEGVESEN_API_KEY i ecosystem env. **Blokk C1 (read-only detaljside + filter-bar + statusendring):** ny `[id]/page.tsx` med 8 seksjoner + statusendring-modal med pensjonertGrunn + Vegvesen-oppdater-knapp (admin, polling 10s) + EU-kontroll trafikklys-banner. Listevisning utvidet med filter-bar (kategori-chips med count, status, ansvarlig, søk, vis-pensjonerte) + klikk-til-detalj + Reg.nr/Ansvarlig-kolonner. Nye API-endepunkter: equipment.list+sok, antallPerKategori, hentMuligeAnsvarlige, bruker.hentMin. ~50 nye i18n-nøkler. **Blokk C2 (modal-redigering + ansvarlig-CRUD):** rediger-modaler for 5 seksjoner (Generelt, Anskaffelse, Kjøretøy-info, Anleggsmaskin-info, Småutstyr-info) via generisk RedigerModal. Ansvarlig-seksjon med full CRUD (hovedansvarlig + tilleggsansvarlige med periode-start + soft-delete via periodeSlutt). Ny ansvarlig-router (list/tilfoy/fjern) + verifiserMaskinAnsvarligSkriveTilgang i tilgangskontroll.ts (per A.6 hybrid). equipment.oppdater utvidet med 30+ felt. ~18 i18n-nøkler. Lukker forutsetning for SmartDok-import. **Type-fix (`77d7bd67`):** RedigerModal type-felt — Input-komponenten returnerer string|null men `type`-feltet er string|undefined (påkrevd, ikke nullable). Erstattet med inline input. Lærdom: Next.js-build strengere enn lokal tsc — bygg lokalt før deploy ved Optional-type-kompleksitet. **SmartDok-import planlagt (Blokk C+):** Excel-eksport analysert 2026-05-01 (126 maskiner; korrigerte tall etter direktelesing av tabell (1).xlsx — 36 ekte regnr, 5 type-godkjenning filtreres, 39 UREG, 46 tomme, 13 har ansvarlig 2, 15 unike ansvarlige, 0XXX-prefiks (10) er placeholder, 1 testrad filtreres, status tom for alle, maskinkode = internnummer der fylt). Forutsetning: Blokk C (detaljside med full redigering) MÅ være i prod før import tilbys A.Markussen |
| migrering-reporttemplate.md | — | Ikke implementert (per CLAUDE.md). K2.1+K2.2 2026-04-28: mal-versjonering + delt mal-bruk-regel |
| planlegger.md | — | Planlagt fase (per CLAUDE.md) |
| shared-pakker.md | — | — |
| smartdok-undersokelse-2026-04-25.md | — | Arkivert v1 (per CLAUDE.md) |
| smartdok-undersokelse.md | — | **Sannhetskilde:** SmartDok UI-research 2026-04-26 (per CLAUDE.md) |
| timer-input-katalog.md | — | — |
| timer.md | 2026-05-01 | Beslutninger 2026-04-29: P1, P2 #3/#6/#7/#8/#13/#14. YAML-header tilføyd. Screening 2026-04-29 utført: 23 indekser tilføyd (Funn F.12), AnsattKompetanse-referanse tilføyd (F.7), YAML utvidet med A.28+C.14 (F.9). Verifikasjon 2026-05-01 mot kodebase: ny «Implementasjonsstatus per 2026-05-01»-seksjon øverst med komplett tabell (Forutsetninger fra Fase 0/0.5 ✅ \| Timer-spesifikk DB+UI ❌ skal opprettes Fase 3 \| Spec-status per tema ✅/🟡). Korrigert tidligere upresis blokker-merknad: eneste reelle blokker er **Proadm drømmescenario auto-avledning** (BACKLOG, ikke nødvendig for MVP) — godkjenningsflyt mot ansatt er fullt spec'd. **2026-05-01 (Infrastruktur-commit):** packages/db-timer/-pakken opprettet med 7 Runde-1-tabeller. Kjernen-migrasjon: `Organization.harTimerModul` + `OrganizationSetting` utvidet med dagsnorm/overtidsmatTerskel/tillattSelvAttestering/timerLockEtterDager. moduleGate-helper + seed-skjelett etablert. **2026-05-01 Runde 1A+1B+1C deployet til prod.** **2026-05-02 Runde 2 (mobil + offline-sync) C1–C8 KOMPLETT på develop** (merge `1cce62f3` 2026-05-02 sent kveld): C1 Drizzle-skjema (6 nye SQLite-tabeller). C2 server-side syncBatch + hentEndringerSiden. C3 sync-motor + TimerSyncProvider. C4 katalog-cache. C5 UI-liste (visuelt verifisert på iOS Simulator + fysisk mobil etter første test-deploy `0342b883`). C6 opprett-skjema + detaljside med 4 inline modaler. C7 ~50 nye i18n-nøkler (155 timer-nøkler totalt per språk). C8 Underprosjekt-velger (ny `eksternKostObjekt`-router + `external_cost_object_local`-tabell + UnderprosjektVelgerModal). **Test-deploy + prod-deploy av C6–C8 utsatt til neste sesjon** — server-side har C2 + dev-login (Fastify) + ECO-router som krever fersk deploy. Scope-utelatelser per Runde 2 MVP (utsatt til 2.5/3): utlegg + maskin på dagsseddel, leder-godkjenning på mobil, aktivitet-på-rad-nivå (sammen med maskintimer-design) |
| varsling.md | — | — |

## 📦 Arkivert

| Fil | Arkivert | Kommentar |
|---|---|---|
| arkitektur-oppsummering-2026-04-25.md | 2026-04-28 | Datert arkitektur-snapshot 2026-04-25 → [docs/arkiv/](../arkiv/arkitektur-oppsummering-2026-04-25.md). Innhold dekt av arkitektur-syntese.md før arkivering |
| arkitektur-qa-runde-2-2026-04-25.md | 2026-04-28 | Opus QA-runde 2 (2026-04-25) → [docs/arkiv/](../arkiv/arkitektur-qa-runde-2-2026-04-25.md). Beslutninger konsolidert til fase-0-beslutninger.md C.13 + § J-rader (K1, tidl. § G) før arkivering |
| audit-data-2026-04-25.md | 2026-04-28 | Read-only audit av dev-DB (2026-04-25) → [docs/arkiv/](../arkiv/audit-data-2026-04-25.md). Åpne audit-spørsmål konsolidert til db-opprydning.md (K3.2) før arkivering |

---

## Forklaring av status-koder

- **✅ Verifisert mot kode** — Innhold sammenlignet mot Prisma-schema/API-routere/UI på datert kjøring. Drift rettet eller ikke funnet. **+ Kode-kvalitet vurdert. + Eventuelle svakheter dokumentert i screening-rapport eller oppryddings-plan.** Behandles som pålitelig.
- **⚠️ Drift identifisert** — Innhold sammenlignet mot kode på datert kjøring. **Avvik funnet og dokumentert** (typisk i screening-rapport eller oppryddings-plan), men **ennå ikke rettet**. Behandles som upålitelig på drift-punktene; resten kan brukes med varsomhet.
- **🔄 Under arbeid** — **Aktiv arbeidsfil** (oppryddings-plan, midlertidig screening-funn, idé-stadium-modul) hvor innholdet endres aktivt og status-spørsmålet ikke er meningsfylt før arbeidet er ferdig. Skal slettes eller flyttes til ✅/⚠️/📦 når arbeidet er ferdig.
- **❌ Ikke screenet** — **Aldri verifisert mot kode i en planlagt screening-runde.** Innhold kan stemme — eller ikke. Behandles som upålitelig inntil det motsatte er bevist. **Filer berørt av K1/K2/K3-konsolidering 2026-04-28 forblir ❌** — konsolideringen tilførte beslutninger i ny seksjon, men eksisterende innhold er ikke re-verifisert mot kode.
- **📦 Arkivert** — Filen er flyttet til `docs/arkiv/` etter at innholdet er overført til aktive sannhetskilder. Hjemløse beslutninger fanget før arkivering. Beholdes for historikk, ikke aktiv referanse.
