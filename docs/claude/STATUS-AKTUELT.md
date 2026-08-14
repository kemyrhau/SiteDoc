---
name: STATUS-AKTUELT
description: Løpende statusrapport for pågående arbeid, pauset arbeid og planlagte faser. Oppdateres ved hver vesentlig fremdrift.
sist_verifisert_mot_kode: 2026-08-09
---

## Statustavle — aktive økter

> Kontrollflate for Kenneth ([SAMARBEIDSREGLER § Opus-livssyklus](SAMARBEIDSREGLER.md#opus-livssyklus--fire-faser-vedtatt-2026-07-16)). Rad skrives **før** økta åpnes; fjernes når branchen er merget + slettet. **Tom tavle = ingen aktive økter.** Ingen to rader deler arbeidstre eller fil.

| Økt | Arbeidstre | Branch | Eier filer | Åpnet | Status |
|---|---|---|---|---|---|
| **Modul-onboarding (seed-policy)** | `SiteDoc-mobil-device` | `feat/seed-dispatch-settfirmamodul` (steg 3+4) | `apps/api/src/services/seed/index.ts` · `apps/api/src/routes/organisasjon.ts` · `apps/api/src/routes/timer/onboarding.ts` | 2026-08-11 | 🟢 **Steg 1 (`921a221e`) + steg 2 (`2fde8565`) MERGET develop + test-verifisert**; backfill kjørt prod (1 rad: A.Markussen-lonnsart). **Steg 3+4 (generisk seed-dispatch) diff-klar** (ORDRE blokk 24/25): ny `seedFirmamodulKatalog(slug, org)` kalles fra `settFirmamodul` ETTER kjerne-tx commit (kryss-DB → kan ikke være i tx-en). Per-datatype `try/catch` → `feil[]` (én feilende datatype blokkerer ikke resten); logges tydelig med org+datatype, aldri svelget. `aktiverNivaa1` = tynn inngang (base via dispatch + Nivå 2 kun ved `inkluderNivaa2`); `seedTimerForOrganization` retiret. `aktiverTomKatalog` uendret (kun interne prosjekter, ingen katalog). **maskin + varelager: ingen hook** — begge dokumentert i dispatch-koden (maskin=enums; varelager=firma-definert uten universell default, steg-4b Beslutning 8). 4 nye unit-tester (feil-isolasjon + no-op-moduler). Api-only, ingen migrering, ingen prod. **Steg 5** (onboarding.status 3-verdi + `mangler`-rapportering) egen gate. **Navngitt oppfølger:** `aktiverTomKatalog` bør selv skrive `egen_katalog`-policy-rader; datatype `varekategori` reservert for evt. framtidig varelager-hook. |
| **Firmarolle-konsolidering** | `SiteDoc-mobil-device` | `fase2-firmarolle-enkilde` | `apps/web/src/kontekst/firma-kontekst.tsx` + 7 lesebaner | 2026-08-10 | 🟢 **Fase 1 MERGET develop (`97f55fd5`).** **Fase 2 (én lesekilde) fabel-designgodkjent** (`FABEL-GODKJENNING-fase2-firmarolle.md`) — 8 kode-lesninger → `kanAdministrereFirma`, `erCompanyAdmin` fjernet, `BrukereFane` leser `firmaRoller` direkte. DoD browser-verifisert: Mathias (user + firma_admin) firma-lenke synlig i BEGGE nav. Kode-divergens lukket; data-divergens består (vakten = tripwire). **Venter Kenneths merge.** **Fase 3** (skrivebaner + `admin.ts:455` + avvikling `company_admin` fra `users.role`): **venter stabilitet i prod + migreringsgate hos Kenneth — ikke åpnet.** **Navngitt oppfølger (egen sak):** multi-firma firma-admin — `valgtFirma` settes ikke ved >1 medlemskap (`firma-kontekst.tsx:83-87`) ⇒ all firma-gating dør; krever firma-velger m/lagret valg + `hentBrukersOrg`-primærorg. |
| **Lagringsstatistikk** | `SiteDoc-utlegg` | `feat/lagringsstatistikk` | `packages/shared/.../lagring.ts` (+test) · `apps/api/src/routes/lagring.ts` + `trpc/router.ts` · web `admin/lagring/page.tsx` (+layout-nav) + `firma/fakturering/page.tsx` · i18n · `docs/{api.md}` | 2026-08-11 | 🟢 **Kodet, diff-klar (fra develop).** `lagring.oversikt` (sitedoc-admin: per firma×prosjekt×modell + standalone + foreldreløse) + `lagring.firmaOversikt` (firma-admin, per prosjekt). Aggregering on-demand, cache 1t, ren `aggregerLagring` i shared. **Akse = `primaryOrganizationId` (eierskap)**, divergerer bevisst fra admin.ts/grense. **Foreldreløse bilder (24 % prod) = egen post, aldri fakturerbar; fakturerbart ≠ faktisk diskbruk.** **Dekningsgrad-restpost:** filer uten målt størrelse (`file_size NULL`) per modell, vist når >0 (fakturering krever 100 % dekning). 🔴 **`drawings.file_size` IKKE strammet** — skrivestien lager DWG-layouts uten fileSize (`tegning.ts:187,539`); NOT NULL ville gitt 500. Ingen migrering. shared 455 + api/web tsc + api-lint grønt, i18n-paritet 3457/3457. **Ingen prod.** |
| **Deaktiver-mønster** | `SiteDoc-utlegg` | `feat/deaktiver-monster` | `apps/web/src/components/deaktiver/*` (3 nye) · `expenseCategory.ts` (deaktiver/aktiver) · 4 timer-flater · i18n · `retningslinjer/deaktiver-monster.md` | 2026-08-12 | 🟢 **Kodet, diff-klar (fra develop).** Delte `DeaktiverKnapp`/`VisInaktiveToggle`/`InaktivBadge`; `Power`-ikon overalt, `title=`→`Tooltip` (konsekvenstekst «skjules for nye reg., eksisterende beholder den»), «Vis inaktive (N)», hjelpetekst. Ny `expenseCategory.deaktiver`/`aktiver` (integritet verifisert: `ordningVedFoering` NOT NULL, ingen mellomtilstand). 4 timer-flater hevet. api/web tsc + lint grønt, i18n-paritet 3454/3454. Ingen migrering. **Ingen prod.** |
| **E2E-opprydding** | `SiteDoc-utlegg` | `feat/e2e-opprydding` | `apps/api/src/routes/admin.ts` (`sweepE2EFirmaer`) · `tests/e2e/global-setup.ts` · `apps/api/scripts/roykt-grense.ts` · `tests/e2e/README.md` · `api.md` | 2026-08-12 | 🟢 **Kodet, diff-klar (fra develop).** `admin.sweepE2EFirmaer` (sitedoc_admin + **env-guard `sitedoc_test`**, sletter `E2E%` eldre enn 24t uten prosjekter) kalt av `global-setup` ved oppstart. `roykt-grense` fikset (E2E-prefiks + slett org). **Funn:** playwright-suiten oppretter ingen org; org-søppelet var fra seed-live-bevis (ad-hoc). **🟡 Meldt til cowork:** «Testfirma AS (agent-test)» er et permanent fikstur uten E2E-prefiks — omdøpe (berører seed) eller la stå? Venter cowork-svar. api tsc + lint grønt. Ingen migrering. **Ingen prod.** |
| **Utlegg-ordningsmodell** | `SiteDoc-utlegg` | `feat/utlegg-ordningsmodell` | `packages/shared/src/utils/utleggOrdning.ts` · `apps/api/src/routes/timer/expenseCategory.ts` · `apps/web/.../timer/[id]/page.tsx` · `docs/claude/timer.md` | 2026-08-08 | 🟢 **U1 prod (`e37621e1`). U3 web MERGET develop + E2E GATET** (DB CHECK + API-guarder + 6 browser-bevis mot mockup). U2 utsatt. Neste: U4 mobil (bygg 45) |
| **Utlegg U5 — overstyring-UI** | `SiteDoc-utlegg` | `feat/utlegg-u5-overstyring` | `apps/api/.../timer/expenseCategory.ts` · `apps/web/.../firma/timer/utleggskategorier/page.tsx` · `oppsett/prosjektoppsett/page.tsx` · `timer/[id]/page.tsx` (sats-hint) · i18n | 2026-08-11 | 🟢 **Kodet, diff-klar (fra develop).** Firma-admin `settOrdning` + overstyring-CRUD; ny `firma/timer/utleggskategorier`-fane (ordning per kategori + prosjekt-overstyring + navnekollisjon-varsel + immutabilitets-mikrotekst); prosjektadmin read-only i prosjektoppsett; sats-hint-fiks. Ingen migrering. Build 2/2. **Browser-verifisering venter deploy til test.** Gjør U3 ferdig. **Ingen prod** |
| **Dataeksport (server-side dokumentgenerering)** | `SiteDoc-mobil-device` | `feat/eksport-fase2-filer-csv` (fase 2) | `apps/api/src/services/eksport/{arkiv,filer,csv,felles,eksport-worker}.ts` · `routes/eksport.ts` | 2026-08-11 | 🟢 **Fase 1 (infrastruktur) diff-klar** (blokk 28) — `EksportJobb`-tabell + migrering `20260811160000` + poll-worker + stream-zip + `verifiserKanEksportere`. **Fase 2 (filer + manifest-innhold + CSV) diff-klar** (blokk 28/29): `samleProsjektFiler` henter alle filer for prosjektet (bilder via Checklist/Task→ReportTemplate, tegninger + originaler + revisjoner, FtdDocument, utleggs-/tilleggsvedlegg fra timer-db) → strømmes fra disk til zip m/ dedup; manglende disk-fil markeres i manifest (feller ikke). `byggTimerCsv`/`byggUtleggCsv` = rådata-CSV (`;`, UTF-8 BOM, norsk komma). Manifest binder hver fil til domeneobjektet + `avgrensninger[]`. PointCloud + PDF-dokumenter bevisst utelatt (fase 3). Nedlastings-URL bumpet 10→60 min (Range-requests re-valideres per chunk). **Activity-logging** på `bestill` + `hentNedlastingsUrl` (sistnevnte nå mutation — revisjonspliktig utstedelse) m/ ip/userAgent (plumbet gjennom delt context-stamme, TS-tvunget på api+web+test-harness). 10 unit-tester. Live-smoke: kjerne-DB-veien OK (lokal sandbox mangler timer-tabeller → full end-to-end = Kenneths test-verifisering). **Migrering (fase 1) gates av Kenneth.** **Fase 3** (PDF-renderer, egen container) venter fabels mal-mockup + at fase 1+2 er levert/verifisert. **Ingen prod.** |
| **Utlegg modelljustering** | `SiteDoc-utlegg` | `feat/utlegg-ordning-justering` | `packages/shared/.../utleggOrdning.ts` (+test) · db-timer schema + migrering `20260811130000` · `apps/api/.../expenseCategory.ts` (+`.test.ts`) + `dagsseddel.ts` · web `utleggskategorier/page.tsx` + `timer/[id]/page.tsx` · mobil `UtleggSeksjon.tsx` + `timerSync.ts` + `schema.ts` · i18n · `docs/claude/timer.md` | 2026-08-11 | 🟢 **Kodet, diff-klar (fra develop).** Gate 1: **`sats`→`lonnstillegg`** (homonym-fiks, enum+3 CHECK+delt utledning+UI+i18n) · **`fakturert` ut av valgbare** (enum beholdt for historikk, `SETTBAR_ORDNING_ENUM={utlegg,lonnstillegg}`) · nye `satsbasert`+`muligSkattepliktig` på ExpenseCategory (firma-admin-toggle) · **U5 upsert-test** (samme id, aldri delete+create; fakturert avvist). Migrering: data-rename + 3 CHECK-recreate + 2 kolonner. shared 441 + api/web/mobil tsc + api-lint + 3 upsert-tester grønt, i18n-paritet 3446/3446. **🔴 Migrering gates av Kenneth. U4→prod blokkert til dette er inne.** Gate 2 (`refusjonsKontonummer` på kjerne-`OrganizationSetting`) etter. **Ingen prod** |
| **Utlegg U4 — mobil** | `SiteDoc-utlegg` | `feat/utlegg-u4-mobil` | `apps/api/.../timer/expenseCategory.ts` (`katalogForMobil`) + `dagsseddel.ts` (`syncBatch`/`hentEndringerSiden` utlegg) · `apps/mobile/src/components/timer-detalj/UtleggSeksjon.tsx` (ny) · mobil db/schema+migreringer · `timerKatalog.ts` · `timerSync.ts` · `OpplastingsKoProvider.tsx` · `bildeRegistrering.ts` · `app/timer/[id].tsx` · i18n · `docs/claude/timer.md` | 2026-08-11 | 🟢 **Kodet, diff-klar (fra develop).** Utlegg på mobil (mockup 8c), offline-først, speiler tillegg 1:1. **Ordning utledet aldri valgt; klient stempler `ordningVedFoering`+`foertVed` ved FØRING, server re-utleder ALDRI ved sync** (motsatt av web-stien — bevisst). `createdAt`=klient-`foertVed` (reviderbart; tillegg-hullet ikke kopiert → oppfølger). Kamera-primær, beløp før bilde, Lagre gated på kvittering, ≥44 px. Offline-cache via `katalogForMobil` (5. pull, kaster før sletting). api+mobil tsc + lint grønt, i18n-paritet OK. **Reload: ny build (mobil-JS).** **Simulator-verifisering + koordinering med mobil-device-sporet før merge. Ingen prod** |
| **S1 Fase 1b — bilde-signering** | `SiteDoc-mobil-device` | `feat/s1-fase1b-bilde-signering` (steg 1) | `apps/api/src/utils/vedleggSignering.ts` (+test) · `routes/{bilde,hms,sjekkliste,oppgave}.ts` | 2026-08-12 | 🟢 **Steg 1 (signeringsinfra) diff-klar** — prod-tall inne (union 39 filer, 1 foreldreløs, 10 kun-images, 28 i begge). Ny delt rekursiv `signerVedleggIData`/`signerBilder`/`signerDataRad(er)` signerer bilde-URL ved EMISJON (aldri persistert → `slettMedUrl`s eksakt-match består). Påført display-emisjonene: `bilde.hentForProsjekt` (galleri) + `sjekkliste/oppgave.hentForProsjekt`+`hentMedId` (data+images) + `hms.hentForProsjekt`/`hentFirmaOversikt` + `oppdaterData`. `slettMedUrl` normaliserer query bort (`normaliserFilSti`). 6 unit-tester (rekursjon repeater+attachments, ingen mutasjon). **Nyanse rapportert:** post-migrering finnes ingen åpne URL-er → usignert emisjon = brutt visning (401), ikke lekkasje; status-transisjons-returer (ikke gjengivelses-veier, klient refetcher) venter cowork-avklaring. Incidental: pre-eksisterende ubrukt `erAdmin`→`_erAdmin`. **Steg 2 (opplasting→privat) diff-klar** (branch `feat/s1-fase1b-opplasting-privat`, på steg 1): web felt-vedlegg (`FeltDokumentasjon`+`TegningsModal`) → `?privat=1` (umiddelbar); mobil-kø utvidet til bilder (sjekkliste/oppgave, nytt EAS-bygg); `bilde.opprett*` myk validering (advarsel ved åpen sti, aksepterer begge — server kan ikke skille klientversjon). To-stegs: hard validering (steg 4) etter EAS-adopsjon, TODO i kode. **Steg 3** (migrering, gated — disk-script beskrives+gates før bygging) → **4** (hard validering). **Ingen prod.** |
| **Mal-integritet** | `SiteDoc-utlegg` | `feat/mal-integritet` | `packages/db/prisma/schema.prisma` + migrering `20260810120000` · `apps/api/.../mal.ts` + `bibliotek.ts` · `apps/web/.../MalListe.tsx` · i18n | 2026-08-11 | 🟢 **Kodet, diff-klar (fra develop).** SLETT-VERN: `slettMal`/`slettObjekt` teller dokumenter (aktive+papirkurv) → nekt m/ lesbar melding; `Task.template` SetNull→**Restrict** (DB-backstop). UNIKHET: funksjonelle unik-indekser `(projectId, lower(btrim(navn/prefiks)))`, prefiks partiell eks-PSI; app-validering `opprett`/`oppdaterMal` + auto-ledig i `kopier`/`importerMal`. Build 2/2. **🔴 Migrering FEILER ved dubletter — rydd DB først** (skann: `~/mal-dubletter-skann.sql`; prod REN, test ryddes av Kenneth). Oppfølgere under. **Ingen prod — Kenneth kjører** |
| **Seed manglende firmakatalog** | `SiteDoc-utlegg` | `feat/seed-manglende-katalog` (`966ed8db`) | `apps/api/src/services/seed/index.ts` · `apps/api/src/routes/admin.ts` · `seedManglende.test.ts` · `docs/claude/timer.md` | 2026-08-10 | 🟢 **MERGET develop. Live-bevis grønt på test (begge varianter).** `admin.seedManglendeFirmakatalog` (sitedoc_admin) — idempotent, **kun `expenseCategories`**. Import-org: `egendefinert=3` uendret før/etter seed (importerte lønnsarter urørt). Enhets-testet + live 0→5/re-kjør=hoppet. Ingen migrering. **⏳ Venter prod:** etter develop→prod-deploy, seed A.Markussen (`4488fe17-…`) → `{opprettet:5, hoppet:false}`, lønnsart står på 44. Oppfølgere: **tre-tilstands-guarder** (aldri onboardet→seed / onboardet→hopp / bevisst egen katalog→hopp+ikke ufullstendig — føring Kenneth 2026-08-10, A.Markussen `seed_nivaa=1`=0 er ØNSKET; `onboarding.status` overrapporterer ufullstendig; se timer.md § Onboarding) + settFirmamodul-wiring; prosjektmodul-variant (998/RUH) |
| **Firmarolle Fase 2** | `SiteDoc-mobil-device` | `fase1-firmarolle-vakt` → Fase 2 | `firma-kontekst.tsx` · `Toppbar.tsx` · `BrukereFane.tsx` · `kompetanse` | 2026-08-10 | 🔵 **Fase 1 (vakt) i prod.** Fase 2 = én lesekilde (`kanAdministrereFirma`), 8 kode-lesninger. Fabel-godkjent ordre v2. Fase 3 (migrering) IKKE hastet |
| **Mal-integritet** | `SiteDoc-utlegg` | *(ny branch)* | `mal.ts` · `schema.prisma` | 2026-08-10 | 🔴 **Slett-vern først:** `slettMal` teller ikke dokumenter; `Task.templateId` nullable ⇒ `SetNull` ⇒ foreldreløse oppgaver (0 i prod nå). Så: unikt prefiks+navn per prosjekt (Kenneth-vedtak) |
> **Kjent test-residue (`sitedoc_test`, 2026-08-10) — BEVISST, ikke søppel:** seks navngitte «E2E …»-orger fra seed-live-beviset står igjen (ingen org-slett-prosedyre finnes). Tre er «E2E Tom» (variant 1): `30d46d3d`, `16af5ab1`, `d96d4934`. Tre er «E2E Import» (variant 2, **har importerte lønnsarter uten `seedNivaa`** — nyttig fikstur for framtidig seed-testing): `8c66cd2e`, `2bef5939`, `9301e0e6`. cowork: la dem stå.

**Tavla er tom for aktive kode-økter** (2026-07-24) — hele flyt-sporet + A-3b er merget til develop. `SiteDoc-a3b`-treet kan ryddes (branch merget). Fabel-design + backlog-saker (Tooltip v2, `ListeKontroll`, mobil-wiring, flyt-handlingstekster) er ikke aktive økter.

| **Registrator-fiks** | *(økt kan exit)* | `fix/registrator-rettigheter` | `flytRolle.ts` · `statusHandlinger.ts` · `tilgangskontroll.ts` · `DokumentHandlingsmeny` | 2026-07-21 | **✅ MERGET develop (`cb3ce3d1`).** Fase A+B — registrator ikke lenger superbruker. ⚠️ Åpen rest: `rejected→sent` → handlingsmeny-arbeidet ([registrator-rolleforveksling.md](delplaner/registrator-rolleforveksling.md)) |
| **K1+K2 kontekst** | *(lukket)* | `fix/k1k2-kontekst` (`f28aecfd`) | — | 2026-07-21 | **✅ MERGET (`31c831a8`) + på test.** Lukket |
| **K3 + P1 kontekstvelger** | *(deployet prod)* | `feat/k3-kontekstvelger` (`c34b3859`) | — | 2026-07-23 | **✅ DEPLOYET TIL PROD (develop→main 2026-07-23).** Hele K3-sporet live: trakt + to-linjers topplinje + sidehode + ⇄ + timer-hjem + maskin-kontekst + polish. Arkivert → [historikk-2026-07.md](historikk-2026-07.md). P1 subsumert |

> ✅ **Avgjort (fabel 2026-07-21, alternativ c): A-3b HOLDES til registrator-fiksen har landet.**
>
> **Premisset:** perspektivmatrisens REGISTRATOR-kolonne (`utledPerspektiv` — registrator dominerer ballinnehav) bygger på **dagens** semantikk, der registrator er superbruker. Etter [registrator-fiksen](delplaner/registrator-fiks-ordre.md) er registrator en *deltaker med leserett*.
>
> **Hvorfor (c) og ikke (a)/(b):** (a) ville revidert matrisen mot en semantikk som ikke finnes i kode ennå — brudd på fakta-først. (b) ville deployet en etikett-modell vi **vet** skal endres, til alle pilotbrukere — to deploys og forvirring for null gevinst.
>
> **To føringer:**
> 1. Når registrator-fiksen er landet og verifisert, leverer utførende Opus **oppdatert perspektivmatrise som nå-rapport** (REGISTRATOR-kolonnen mot ny semantikk). **Fabel gater den FØR 1c-wiring starter.** Perspektivet består — «oppretter-som-venter» er et reelt syn — det er **etikettene** som måles på nytt.
> 2. **Del 1a+1b merges ikke til develop** i mellomtiden. Ingen perspektiv-etiketter ut til brukere før matrisen er gatet.
>
> ⚠️ **Presisering:** Del 1a+1b **er pushet** til `feat/a3b-perspektiv` (`535f8d8a`) — det er riktig og trygt, en feature-branch når ingen brukere. Det som holdes tilbake er **mergen til develop**. Arbeidet skal ikke un-pushes.

### 🟢 Flytmatrise-fundament — B-sporet (rettighetsmatrise som config)

Fundamentet under A-3b: statusmaskin (A-laget) + config-substrat (B) før perspektiv-visningen bygges oppå. Kilde: [rettighetsmatrise-config-design.md](delplaner/rettighetsmatrise-config-design.md) + [flytmodell-overgangsmatrise.md § FUNDAMENT-GAP](delplaner/flytmodell-overgangsmatrise.md).

| Kloss | Status | Merge |
|---|---|---|
| **A-laget** — statusmaskin (`rejected→sent` + `closed→draft` inert + i18n) | ✅ MERGET develop | `7571e968` |
| **B Kloss 1** — config-plumbing (`FlytRettighetOverride`/`Logg` + `ROLLE_HANDLINGER_DEFAULTS` + `celleTillatt` override-only-snitt + loader). **Bit-identisk.** | ✅ MERGET develop | `33c32f1f` |
| **B Kloss 2** — adminNiva (**kun sitedoc+prosjekt**, firma-admin droppet — Kenneth-vedtak) + PROSJ.ADMIN-kolonne + matrise-UI (`dashbord/firma/flyt-rettigheter`, sitedoc-gatet) + logg-skriving | ✅ MERGET develop (PR #3) | `a3e2cc66` |
| **B Kloss 2b** — firma-innstilling `autoProsjektAdmin` (medlemskap, ikke flyt-nivå — Kenneth-vedtak) + migrering `20260724120000`. Løser firma-admin ⊇ prosjektadmin via auto-medlemskap ved nye prosjekter | ✅ MERGET develop | `cca3f471` |
| **B Kloss 2c** — matrisen til Admin-flaten (§ 1c) + cellespec-kontrast (§ 2) + i18n × 14 | ✅ MERGET develop | `4d563c89` |
| **B Kloss 2d** — global konfig: dropp `orgId` fra `FlytRettighetOverride`/`Logg` + loader/tRPC/2c-UI (Kenneth-vedtak: én global konfig, ikke per-firma) + migrering `20260724130000` (TRUNCATE + drop orgId) | ✅ MERGET develop | `42b77e0c` |
| **B Kloss 3** — endringslogg-fane + les/rediger-fane (levert som ren visning i Kloss 2 — i praksis dekket) | 🟢 dekket av Kloss 2 | — |
| **A-3b perspektiv-visning** (oppå ferdig fundament) | 🟡 PAUSET — fundament nå komplett, kan gjenopptas | — |

**Ett-klikks-prosjektoppsett-visjonen** (firma-mal per kontorsted/avdeling) er ført i [BACKLOG](BACKLOG.md) — Kloss 2b er første konkrete skive (samme `prosjekt.opprett`-hook + `OrganizationSetting`).

🔴 **Migrerings-avhengighet (Kloss 1+2+2b+2d):** neste test-deploy av develop MÅ kjøre `migrate deploy` mot `sitedoc_test` for alle ventende: (1) `20260723120000_flyt_rettighetsmatrise_config` (opprettet tabellene — alt applied på test). (2) `20260724120000_organization_setting_auto_prosjekt_admin` (`ADD COLUMN auto_prosjekt_admin` — alt applied). (3) `20260724130000_flytmatrise_global_dropp_orgid` — **TRUNCATE begge config-tabellene + dropp `org_id` + ny global unik `(rolle, fra_status, til_status)`.** Idempotent (`IF EXISTS`-guards). ⚠️ TRUNCATE avviker fra to-stegs-policyen — begrunnet (kastbar config, aldri prod); **Kenneth bekrefter tilnærmingen ved `migrate deploy`.** Uten (3) er tRPC/loader/UI orgId-frie mens DB fortsatt har `org_id` NOT NULL → `settRettighet` feiler.

🔵 **Pilot-synlig endring ved neste deploy (Kloss 2):** firma-admin ser ikke lenger admin-handlinger i flyt-menyen (web+mobil). **Ikke kapabilitetstap** — serveren (`verifiserFlytRolle`) avviste dem uansett med «Ikke medlem av prosjektet»; menyen viste et fantom. Føres i pilot-endringsloggen når Kloss 2 deployes.

**Lukket 2026-07-24 (flyt-binding + dedikert HMS-løp, seks merger):** **F1 flyt-binding ved opprettelse** (B1–B4, `a98269ed`) + registrator-innstramming B2b + admin-bypass fjernet (`a7924c59`) — et dokument tilhører alltid nøyaktig én flyt (`dokumentflytId` påkrevd på server i standard-grenen), og **kun registrator-medlem** kan opprette (ingen admin-unntak; admin legger seg selv i flyten). HMS-grenen er flyt-løs by design (vedtak A, Guard 1 avviser innsendt flyt). **Sjekkliste-visning:** dokumentflyt-navn-kolonne + person/faggruppe-ikon i Ansvarlig (`39c6897c`). **CI:** K13 onboarding-redirect unntatt + `docs/**`-paths-filter så rene docs-pushes ikke trigger `test` (`687c71e2`). **Dedikert HMS-svar-løp** (Kenneths «eget dyr»-modell, adskilt fra dokumentflyt/rolle-matrisen): server-Ordre A — egen maskin `sent→responded→closed` + `verifiserHmsHandling` + `erHmsAdmin` (delt kilde m/ `byggHmsSynlighetsFilter`) + fire mutasjoner (`hmsBesvar`/`hmsLukk`/`hmsGjenapne`/`hmsTilfoyInformasjon`) + e-postvarsling (`ad9d2e0c`); web-Ordre B — `HmsHandlingsflate` + `hms.erHmsAdmin`-query + tidslinje-append (`85bc4349`); malbygger-Ordre C — HMS egen malbygger-type (`category="hms"` = malbygger-organisering, `domain="hms"` = runtime; dedikert `hmsmaler`-side + «Meld HMS»-inngang + migrering `20260724140000_hms_category`, `07113b89`); **task-Ordre D** — utvidet HMS-løpet til tasks (RUH/avvik var `category="oppgave"` og kjørte generell statusmaskin; nå opprett=send + de fire HMS-mutasjonene på task-tabellen + `HmsHandlingsflate` på oppgave-detaljsiden, speiler A/B, `50f0a232`). Design: [flyt-binding-design](delplaner/flyt-binding-design-2026-07-24.md) · [hms-dedikert-lop-design](delplaner/hms-dedikert-lop-design-2026-07-24.md) · [flyt-rolle-verifisering](delplaner/flyt-rolle-verifisering-2026-07-24.md). **HMS-løpet er komplett (A+B+C+D) — dekker både checklist (SJA) og task (RUH/avvik).** Klikktest 2026-07-24 avdekket task-gapet (kun checklist var dekket) → Ordre D lukket det. **Gjenstår:** klikktest RUH + HMS-avvik (task) ende-til-ende i Chrome-Opus · HMS-vedlegg til «Tilføy informasjon» (backlog, krever server-endring) · `migrate deploy` ved neste test/prod-deploy (kø: flytmatrise-migreringer + `20260724140000_hms_category`). **Data-hygiene:** prod-maltagging ren (audit 2026-07-24: SJA/RUH/HMS-avvik alle `domain="hms"`); test har én feiltagget «Sikkerhetsinstruks» (PSI, `subdomain="avvik"`) — test-only, ikke prod. F1 (a)–(d) verifisert på test 2026-07-24 (alle positive).

**Ordre E — HMS-oppgave polish (branch `feat/hms-oppgave-polish`, ikke merget):** to bugs fra klikktest 2026-07-24, gatet mot kode. (1) **RUH-ruting** — RUH-radklikk gikk til `/sjekklister/${id}`, men RUH er en task (`category="oppgave"`) → rettet til `/oppgaver/${id}` (`hms/page.tsx`). (2) **`[object Object]` i RUH-kolonnene «Type observasjon» + «Innmelder»** — rot: felt-verdier lagres nestet som `{ verdi, kommentar, vedlegg }` (jf. skjema-hooks + endringslogg `oppgave.oppdaterData`), men `hentDataVerdi` (`components/hms/visning.tsx`) rendret wrapper-objektet direkte. Fikset ved å pakke ut `.verdi` + speile `hentFeltVerdi`-mønsteret (type-aware person/firma/liste + `navneLookup` bruker-ID→navn, bygget fra `medlem.hentForProsjekt` og sendt inn i `RuhTabell`). Bonus: samme rot-fiks fjerner latent `[object Object]` i SJA-/avvik-datakolonner (samme delte funksjon). Web typecheck + test grønt (43/43). **Verifisert i Chrome-Opus 2026-07-25** — begge PASS (RUH-lista lesbar tekst, radklikk → `/oppgaver/`). **Hele HMS-sporet (flyt A–D + polish E) er ferdig og ende-til-ende-verifisert på test** — checklist (SJA) + task (RUH/avvik). **✅ DEPLOYET TIL PROD 2026-07-25** (main `661ba3c2`): F1 + HMS A–E + flytmatrise-fundament (Kloss 1–2d) + A-3b — sekvensielt bygg (ingen OOM, ingen kaskade), alle 4 migreringer anvendt mot `sitedoc` (`20260723120000`/`20260724120000`/`20260724130000` TRUNCATE+dropp-orgid/`20260724140000` HMS-kategori), alle containere Up, verifisert innlogget (sitedoc.no kjører). Backup: `~/backup/sitedoc-predeploy.dump`. **Arkiveringsplikt:** hele denne bunten flyttes til [historikk-2026-07.md](historikk-2026-07.md) ved neste doc-rens.

**Lukket 2026-07-20/21 (seks økter):** N3-fiks synlighet (`fix/n3-flytmedlem-synlighet`) · kode-Opus sak 1 (`fd573b61`) · kode-Opus spor 2 + sak 2 (`cf76d81d`, `ecedb7eb`) · mobil-Opus TegningsCapture (`b15dfe56`) · CI-Opus spor 1 (PR #1+#2) · web-Opus testrunder (sak 1 + sak 2, testplaner merket KJØRT). Alle merget til develop; tilgangslaget deployet prod.

> ⚠️ **Tavla var tom for alle seks mens de kjørte.** Rader ble aldri skrevet, og Kenneth måtte avslutte to økter uten oppfølging. Rettet ved [SAMARBEIDSREGLER § Tavle-binding](SAMARBEIDSREGLER.md#tavle-binding--commit-gaten-vedtatt-2026-07-21): ordre ⇒ rad og merge ⇒ rad-fjerning skjer nå i samme commit.

**Del6b fase 1 lukket 2026-07-16** — fabel-designgodkjent, alle punkter. Merget `f9416424` (pkt 2/3/6) + `297f5670` (pkt 1/4/5). Levert: print-fella borte (`q0–q9` droppet stille 7 av 17) · døde søkebokser koblet · prioritet-rader klikkbare · 4 filter-paradigmer → 2 delte kilder, null regresjon · prosjekt-HMS-defaulten synlig som chips · 35 i18n-nøkler × 14 språk. Statuskilde: `verifisering/del6b-verifiseringslogg.md` (designprosjekt «Sitedoc redesign tips»). Exit-funn i [BACKLOG](BACKLOG.md).

**Doc-oppryddingen 2026-07-15/16 er lukket.** Syv økter, alle merget: statuskilde/lesbarhet-reglene (`8ae0a3ac`) · regel 11 + 11b (`d1c6b4c9`) · tre aktive doc-løgner (`be5307be`) · Type 1-rydding, 13 funn (`fc96fcee`) · negative påstander, F1/F3/F21/F22 (`eab9bb85`) · STATUS-changelog + STATUS-AKTUELT-oppbrudd. Auditens 23 funn: 20 lukket, F15 + F24 + F25 ført i [BACKLOG](BACKLOG.md).

⚠️ **Presedens verdt å beholde (2026-07-16):** to økter fikk samme branch-navn (`docs/status-aktuelt-oppbrudd`) — den ene slettet den mens den andre skulle bruke den; ren flaks at rekkefølgen reddet arbeidet. Og to økter fikk samme arbeidstre (`SiteDoc-oppfolgere`), så auditens tre flyttet seg under den mens den kjørte. Begge var coworks feil ved ordreskriving, og begge er nøyaktig det denne tavla finnes for.

## EAS-byggteller (kvote ~15/mnd, fri plan — nullstilles den 1.)

> Ordre 1 ([SAMARBEIDSREGLER § Cowork leveranse-ansvar](SAMARBEIDSREGLER.md#cowork-leveranse-ansvar-ordre-2026-07-14)): cowork sporer EAS-bygg her. Ved **12 bygg/mnd** → stopp + sjekk klar-tilstand + flagg i status før nytt bygg fyres. Dato/# bekreftes mot `eas build:list`.

**August 2026 — 2 bygg brukt (av ~15), ~13 igjen. Reset 1. sep.**

| # | Dato | Commit | Profil | Formål |
|---|------|--------|--------|--------|
| 43 | 2026-08-08 | `6d9a7c9` | production | HMS 5a+5b + utlegg U1. **Bygget OK, men aldri sluppet til testere** — holdt tilbake da Kenneth utsatte for å få mer med i 44. Ingen «What to Test», ingen export compliance besvart |
| 44 | 2026-08-09 | `2240f9f6` | production | **Bunt 44 → TestFlight.** HMS melder-flyt + tegnings-navigasjon + maskin ved redigering + seks katalog-cacher + åtte mobil-småfunn |

**Lærdom 43→44:** to mislykkede fyringsforsøk på 43 brente **null kvote** — begge feilet under credential-validering før byggestart. Første: `~/.zshrc:17` manglet linjeskift mellom to `export`-linjer → `Invalid Apple Team Type: INDIVIDUALexport`. Andre: Apple 403 «This provider does not exist» da de nå korrekt parsede `EXPO_APPLE_*`-variablene ble sendt i stedet for EAS' lagrede credentials. Kvote telles først når bygget faktisk starter.

**Juli 2026 — 4 bygg brukt (av ~15), ~11 igjen.** Kilde: `eas build:list --platform ios` (ikke gjetning — forrige teller hadde feil datoer og utelot #37).

| # | Dato | Commit | Profil | Formål |
|---|------|--------|--------|--------|
| 37 | 2026-07-01 | `bc744f82` | production | mobil-MS + F-G |
| 38 | 2026-07-11→13 | `d1b96cd5` | production | F4-serien (identitetsforsoning + attestering-deadlock + synk-robusthet) |
| 39 | 2026-07-13→14 | `cd3efcb5` | production | S-A tombstone + del 6 (F-b/e/f/g) + footer |
| 40 | 2026-07-15 | `43299d03` | production | timer F2/F3/F5 + edge #1 (byggeplass per rad + matpause-bærer). Build `15a47804` → TestFlight |

Terskel 12/mnd ikke nær. **#40-lærdom:** EAS autoIncrement teller mot EAS' egne byggrecords, ikke ASC — første submit feilet på “build number 40 already used” (ASC hadde en 40 EAS ikke kjente). Bygget var intakt; ingen kvote brent på retry.

## 🔵 PROD-LIVE MERKNAD — sidebar-label byttet for ALLE (2026-07-14)

`nav.sok` «Søk»→«Dokumentsøk» + `nav.kontrollplan` «Kontrollplaner»→«Kontrollplan» rendres i gammel `HovedSidebar` (`sidebar-elementer.tsx:131,145`) — **ikke** bak `nyNavigasjon`-flagg. Kilde: `73f88112` (finnbarhet i18n), live i prod via develop→main-deploy **`43299d03`** (2026-07-15). **Pilot-support:** etiketten byttet for ALLE brukere, ikke bare ny-nav — bevisst (unngår label-mismatch på tvers av flagg-tilstand, jf. Lokasjoner/Byggeplasser). `firmaNav.innstillinger`→«Firmaprofil» er derimot INERT i prod (gammel firma-nav hardkoder «Innstillinger»).

## 🔴 ÅPENT SIKKERHETSPUNKT — alle sjekkliste-/oppgavebilder er uautentisert tilgjengelige (målt 2026-08-12)

**Ikke en ny sårbarhet — dette er S1 Fase 1b, planlagt men ikke bygget.** `server.ts` sier det selv: *«Non-privat `/uploads/*` er uendret i Fase 1 (global gate kommer i Fase 1b).»* Målingen viser at hullet fortsatt står åpent.

**Målt på prod 2026-08-12:**

| plassering | bilder | volum |
|---|---|---|
| `uploads/` (åpen, ingen gate) | **50** | **46 MB** |
| `uploads/privat/` (signatur-gatet) | 0 | 0 |

`curl` mot `https://api.sitedoc.no/uploads/<uuid>.jpg` uten innlogging → **200**.

**Årsak:** `privat=1` sendes kun fra timer-siden (utleggsbilag, `dashbord/timer/[id]/page.tsx:2314,2967`) og mobil `opplasting.ts`. `bilde.ts` — som lagrer alle sjekkliste- og oppgavebilder — laster opp uten flagget. Kvitteringer er altså beskyttet; byggeplassbilder er ikke.

**Alvorlighet, ærlig vurdert:** UUID-er er 128 bit og ikke gjettbare, så ingen kan bla gjennom bildene. Men enhver URL som lekker — e-post, skjermdump, serverlogg, nettleserhistorikk på delt PC — gir permanent uautentisert tilgang til et byggeplassbilde som kan inneholde personer, kjøretøy eller skader. Personvernrelevant.

**Ikke løst av kveldens signaturfiks.** Den lukket omgåelse av gaten på `uploads/privat/*`; dette handler om at bildene aldri legges bak den gaten.

**Retning (ikke besluttet):** enten sende `privat=1` fra `bilde.ts` og signere bildelenker som timer-flaten gjør, eller bygge Fase 1bs globale gate på hele `/uploads/*`. Første er mindre, men flytter ikke eksisterende 50 filer; andre er riktig sluttilstand. Krever beslutning + migrering av eksisterende filstier.

## ✅ ARKIVERT — sikkerhetsfiks signaturgate `/uploads/privat/*` → [historikk-2026-08.md](historikk-2026-08.md)

Funnet, fikset, deployet prod (`0d5d54ee`) og verifisert i drift 2026-08-11. Fire utnyttbare omgåelsesformer (`//`, `/./`, `/../`, `%2e`) ga 200 mot ekte fil; alle gir 401 etter fiks på både test og prod. ⚠️ Gjenstår: innlogget nettleser-verifisering at bilder laster.

## Pågående arbeid (PR-historikk)

### 🟡 Startbar kontrollplan — Leveranse 1 (branch `feat/kontrollplan-startbar`) — PÅ BRANCH, venter diff-gate + test

Kontrollpunkt kan startes/kobles til sjekkliste → planen teller reell status. Null nye kolonner
(fyller `KontrollplanPunkt.sjekklisteId`). `sjekkliste.opprett` += valgfri `kontrollplanPunktId`
(atomisk kobling via delt `koblePunktTilSjekkliste`), ny `kontrollplan.koblePunkt` +
`hentKoblbareSjekklister`, fremdrift avledet fra sjekkliste-status (delt `kontrollplanFremdrift.ts`),
sjekklistefilter «hører til planen / kommer i tillegg». Bygget på egen branch fra develop (ikke oppå
revisjonsarbeidet). API+web typecheck grønt, i18n 15 språk. Leveranse 2 (tegningspunkter + passiv
fargevarsling) og aktiv scheduler-varsling (Leveranse 3) er egne saker.

### 🟢 PÅ TEST — fem spor merget til develop (`d4e0d8f1`, 2026-08-12)

Merget fra `SiteDoc-merge`, deployet test, migrering kjørt. **Ikke i prod.**

| Spor | Branch | Innhold |
|---|---|---|
| Sikkerhet | `fix/uploads-signatur-path-normalisering` | test som fester `%252e`-restformen (fiksen selv alt i prod `0d5d54ee`) |
| Dataeksport fase 1 | `feat/eksport-infrastruktur` | `EksportJobb`, poll-worker m/ watchdog + 7-dagers utløpsrydding, stream-zip til `uploads/privat/`, signert levering, `verifiserKanEksportere` |
| Dataeksport fase 2 | `feat/eksport-fase2-filer-csv` | filer på tvers av 5 modeller, manifest-innhold, timer/utlegg-CSV (`;` + BOM + desimalkomma), **Activity-logging** på `bestill` + URL-utstedelse |
| Lagringsstatistikk | `feat/lagringsstatistikk` | aggregering per prosjekt/firma på `primaryOrganizationId` (eierskap), 1t cache, to flater, **tre ærlige restposter** (foreldreløse · umålt størrelse · DB-estimat) |
| Dokumentgenerering fase 3 | `feat/dokumentgenerering` | arkivmal-datalag: rent lag i `packages/pdf/src/arkivmal/` (ingen Prisma — mobil importerer pakken) + fire logg-lesere i `apps/api/src/services/arkiv/` |

**Migrering kjørt på `sitedoc_test`:** `20260811160000_eksport_jobb` (176 migreringer totalt). Gaten (`grep -q sitedoc_test`) virket.

**Merge-lærdom:** `server.ts` ga konflikt mellom hotfixen og fase 1 (begge la til i samme område). `--theirs` ville tatt hele filen fra fase 1-branchen, som er *fra før* hotfixen — altså gjenåpnet sårbarheten. Løst manuelt ved å beholde begge. **Ved konflikt i en fil der en sikkerhetsfiks nylig landet: aldri `--theirs`/`--ours` på hele filen.**

⚠️ **Gjenstår før prod:**
1. **Kenneths test-verifisering av eksport:** `eksport.bestill` på prosjekt med bilder/tegninger/timer → `hentForProsjekt` viser `klar` → last ned zip → åpne `manifest.json` → sjekk `filer/`, `tegninger/`, `timer/*.csv`, og at manglende fil står som `mangler:true`. To raske bestillinger → andre skal gi CONFLICT.
2. **`activity_log`-sjekk:** etter `bestill` + `hentNedlastingsUrl`, verifiser rader med `target_type='eksport'` og utfylt `ip_address`/`user_agent`.
3. **Lagringsflatene:** `/dashbord/admin/lagring` (per firma × prosjekt × modell) + `/dashbord/firma/fakturering` (eget firma).
4. **Innlogget verifisering** at bilder i sjekklister laster — fase 1 rører filserving-området.

**Ikke merget:** `feat/kontrollplan-revisjon` del 1 (lokal hos Opus, push gitt) · deaktiver-mønster (under bygging).

### 🟢 Dokumentgenerering Stage 4 — arkivmal HTML→PDF (`feat/arkivmal-rendering`, ikke merget)

Bygger videre på fase 3-datalaget. **Stage 1–4b pushet** (`e4a3e455`): ramme/innhold/logg/signatur (`packages/pdf/src/arkivmal/`) · 4a `pdf-render`-container (`docker/pdf-render/`, ren HTML→PDF, bilde-vakt, `x-render-komplett`-header, ingen secret) · 4b-1 bilde-inliner (flatt-hvit + 1600px/q88, annotasjon-kvalitet) · persons-resolver (UUID→navn) · 4b-2 orkestrator (`sammenstilling.ts`). **4c (gatet, denne commiten):** render-endepunkt + signert levering — `apps/api/src/services/arkiv/{disk-bilde,render-templates,render}.ts` + tRPC `arkiv.rendrSjekkliste` (samme port som lesing, skriver `/uploads/privat/arkiv/`, 15-min signert URL, activity-logg). Per-side footer-sporbarhet (generert-stempel + dok-id + `Side X av Y`). `@page :first { margin-top:0 }` mot side-1 header-dublering (UVERIFISERT mot Chromium-margin-presedens). **Gjenstår:** container-up (Kenneth) → rendertid-måling BEF-001 + annotasjons-skarphet · klient-knapp (egen runde) · timer/utlegg/kontrollplan-innholdslesere. 80/80 arkiv-tester grønne.

**4c-fiks (denne commiten) — 3 bugs funnet ved prod-render av BEF-001 (Lakselv Lufthavn):** (1) `docker/pdf-render/server.mjs` — bilde-vakten var død: `page.evaluate(VENT_FN, …)` fikk `VENT_FN` som **streng** → Playwright tolket den som uttrykk, kalte den aldri → `x-render-komplett` alltid `false` + 20s-vakten kjørte aldri. Fiks: ekte funksjon + `networkidle` (ikke Puppeteer-`networkidle0`). (2) `services/arkiv/disk-bilde.ts` — `diskSti` strippet ikke `?exp=&sig=` → vedlegg lagret signert i `checklist.data` (4 av ~25 på BEF-001) falt stille ut av PDF-en. Fiks: `url.split("?")[0]` + `disk-bilde.test.ts`. (3) `server.ts` — `Cache-Control: no-store` på `/uploads/privat/` (Cloudflare cachet privat signert fil 4t). **Åpent (server-side, ikke kode):** signert arkiv-URL gir 404 ved nedlasting — skrive-sti (`UPLOADS_DIR`) vs serve-rot (`process.cwd()/uploads`); Kenneth diagnostiserer. 88/88 arkiv-tester.

**4c-oppfølging (samme branch): rekursjon + vei 3b.** Diagnose viste at browser-tRPC kjører in-process i **web**-containeren (Next route `appRouter`), ikke api — web mangler uploads-mount → arkiv-PDF ble skrevet til efemert fs (404) og bilde-lesing feilet. Dessuten: `bilderIFelt`/`inlinDataBilder`/`resolverPersonnavn` rekurserte ikke inn i repeater-rader → 14 av 18 BEF-001-bilder aldri samlet + nestet persons-UUID kunne lekke (nå dyp traversering, 90/90). Løsning: (1) **read-only uploads-mount på web** (`:ro`, begge compose-filer) + (2) **vei 3b — `arkiv.ts` returnerer PDF (base64) i responsen** (ingen `writeFile`/signert URL → 404-en forsvinner). Gjenstår: repeater-vedlegg-render mot mockup (de 14 nestede vises ennå ikke) + de fire målingene (rendertid/skarphet/header/responsstørrelse) etter test-redeploy med mount.

**De fire målingene (2026-08-15, ekte kall mot api-test, `AGENT-TEST-0001`):** `POST api-test.sitedoc.no/trpc/arkiv.rendrSjekkliste`, HTTP 200, `komplett=true`/`renderTimeout=false`/`manglendeVedlegg=[]`. (1) Rendertid **2,18 s** wall-clock — godt innenfor 20 s, og **`x-render-komplett=true` for første gang** (bug 1 bekreftet fikset i drift). (2) Annotasjon skarp+lesbar ved 1600px/q88 på ekte annotert bilde (rød pil/tekst). (3) `@page :first` fjernet — CSS-veien virkningsløs (`page.pdf({ margin })` overstyrer `@page`); dubleringen løst ved at margin-headeren (`render-templates.ts` `byggRenderHeader`) nå bærer **kun dokumentreferanse**, ikke firma/prosjekt. (4) Responsstørrelse **1,43 MB** (PDF 1,07 MB). Forbehold: måleobjektet har 2 bilder mot BEF-001s 18 → rendertid/størrelse ikke verste-fall-representative; skarphet/header er antallsuavhengige.

**Steg 2 — repeater-vedlegg-render (arkivmalen komplett).** De nestede repeater-bildene (14 av 18 på BEF-001) rendres nå samlet UNDER tabellen mot mockupen, ett kort per bilde merket «Bilde — punkt N (filnavn)» (radnummer = kryssreferanse til raden), radrekkefølge, `break-inside:avoid` per kort (flyter over sider, ett bilde+merke samlet). **Latent bug fikset:** `attachments`-kolonne med bilde-array som celle-`verdi` traff `cellVerdi` default → `JSON.stringify` dumpet hele data-URI-base64 i cellen på BEF-001; ny `attachments`-case + array-vakt viser kun filnavn-referanse. Alt i `packages/pdf/src/arkivmal/{repeater,arkiv-css}.ts` — `felt.ts` frossen. 91/91 arkiv-tester (5 nye + header-tester rettet til komplementær margin-header). **Gjenstår: visuell verifisering mot AGENT-TEST-0001 etter test-redeploy** (annoterte bilder i repeater vises under tabellen, rekkefølge, ingen base64 i celle). Arkivmalen er da komplett: ramme · felt · logg · signatur · container · komprimering · persons-resolver · repeater-vedlegg.

### ✅✅ ARKIVERT — august-deployene (03.08–06.08) → [historikk-2026-08.md](historikk-2026-08.md)

Fem prod-deployer arkivert med commit-refs, migreringer og verifisering: flytmodellen komplett + effektivitets-runden + mobil M1–M3 (`8b068c73` 03.08) · Funn A + Funn C (`0ac25705` 04.08) · Funn D + opprettvelger v2 + Spor 1 + kontaktside (`5bf25f83` 05.08) · Ordre 1.4 auto-hopp (`8a2f6d9c` 05.08) · Spor 2 HMS komplett (`70d2b752` 06.08).

> ✅ **Mobil-forbehold LØST 2026-08-09:** EAS-bygg **44** er fyrt og levert TestFlight. Mobil detalj-redesign M1–M3 + hele bunt 44 er nå hos testerne. Kenneths fysiske re-test gjenstår. (Bygg 43 ble bygget 08.08 men **aldri sluppet til testere** — 44 erstatter det.)

**Restanser etter deployene (åpne oppfølgere, ikke deprioritert backlog):**

- **Flytmodell:** Playwright pilot-e2e-spec (`feat/flytmodell-5b-uie2e`, remote-rigg) · trekk-tilbake-status-semantikk (fabel, parkert) · bøtte 4 = byggeplass-kontekst arves ikke ved opprett (pilot-funn #2/#3 → fabels kontekst-fra-innlogging-spor).
- **Statusmaskin:** F6-oppfølger (`received→approved` som default) · posisjonsutredning (H1/N-boks, `steg`-feltet finnes) · registrator-steg-1-validering · H2 (utførers venstre-send/tilbake-kant) · besvar=venstre-modellspenningen · § 0 delt-kilde-konsolidering (egen fase).
- **Effektivitet:** **P4c timer** (7→1-2 klikk, arver chip-komponenten) — ikke startet. Øvrige restanser i [BACKLOG](BACKLOG.md).
- **Mobil M1–M3:** #2 inline-kommentar-inngang · #7b liste-filter · #4 bekreft-på-send-vurdering · #5 testdata-flyt m/distinkte personer per ledd.
### ✅✅ ARKIVERT — prod-deploy 2026-08-10 (`7f838d80`, 33 commits) → [historikk-2026-08.md](historikk-2026-08.md)

Bunt 44 (mobil, via EAS 44) + web/api-siden + utlegg U3 + firma-admin prosjektopprett + mal-admin-gate + seed-verktøy + firmarolle-vakt Fase 1. Migrering `sheet_machine_timer_id` kjørt på prod. **A.Markussen fikk sine 5 utleggskategorier** — lønnsart 25/19 verifisert uendret.

<details><summary>Detaljer bunt 44 (mobil) — beholdt for sporing mot TestFlight-tilbakemelding</summary>



**Første mobilleveranse til felt siden EAS #40 (15.07).** Alt under er merget til `develop`, i bygg 44 og på TestFlight. **Ikke prod-deployet** (web/api-siden av HMS + utlegg U1 gikk prod `e37621e1` 08.08 — se historikk). Enhetsverifisert av simulator-Opus i tre runder; bevis i `relay/mobilverify-bevis/`.

**Kilder:** Kenneths enhetstest 08.08 (prosjekt 998 Instinniforbotn) → fabels ordre `docs/claude/delplaner/ORDRE-mobil-devicefunn-2026-08-08.md` (Del A–D) + `FABEL-SVAR-cowork-blokk2-mobil-device.md` (A1/B1/B2-godkjenning) + simulator-Opus' egne funn.

| Sak | Innhold | Verifisert |
|---|---|---|
| **fabel Del A** — tegnings-navigasjon | Trykk på tegningsrad åpner tegningen direkte (var: `router.push("/lokasjoner")` uten id → 2+ ekstra trykk). Delt `aapneTegning`-helper + nonce (`ts`) fordi `lokasjoner` er en montert tab-skjerm. «Fortsett der du slapp»-snarvei gjenbruker **eksisterende F1** (`ByggeplassKontekst.settSistTegning`, bygget men aldri wiret) framfor ny SQLite-tabell. Guard via `hentMedId` → slettet/feil prosjekt gir velger-fallback, aldri krasj | ✅ 1-trykk · snarvei etter kald-restart · offline · ugyldig-id-guard · nonce begge veier |
| **fabel Del B pkt 1** — maskin ved redigering | Maskin kunne kun føres ved NY timer-rad ⇒ **auto-utfylt dag ga ingen vei til å føre maskin**. Nå: maskin-seksjon også ved redigering (drop `!eksisterendeRad`-gaten), prefill fra koblet rad. **Additiv nullable `sheetTimerId`** på `SheetMachine` + `sheet_machine_local` (migrering `20260808130000`, svak String-FK, ingen backfill) — bøtte-match på fire felt avvist: integritet i skjemaet, ikke i logikk som kan glemmes. Null-rader har kodekommentar som forklarer hvorfor null er lovlig (stopper framtidig heuristisk backfill) | ✅ ≤2 trykk fra rad · re-rediger gir ÉN maskinrad · sync round-trip · oppgradering over eksisterende lokal data |
| **fabel Del B pkt 2+3** — cache + banner | `refreshMaskinKatalog` fanget pull-feil (`.catch(() => [])`) → destruktiv `delete` med tom liste ⇒ cachen tømte seg selv ved nettglipp, og bare re-login fylte den. Fjernet catchen (symmetri med `refreshKatalog`). Banner «Herav maskin 0.00t» skjules ved maskin = 0 | ✅ cache bevart etter framprovosert pull-feil, uten re-login |
| **Katalog-cache systemisk (funn #3)** | Simulator-Opus sporet rå UUID-er i dagsseddel-raden til **samme bug i fem tjenester til** — `prosjekt`/`byggeplass`/`kalender`/`oppmotested`/`reisetidMatrise` + `timerKatalog`-ECO. Én offline kaldstart tømte samtlige. Alle seks nå symmetriske; `organizationSetting` bevarte allerede (tidlig-retur). ECO-catchen fjernet etter at begrunnelsen ble **verifisert moot** (`krevBrukersOrg` kaster FORBIDDEN på lonnsart før ECO spørres) | ✅ offline kaldstart → navn står, 0 UUID-er · byggeplass-velger ikke tom |
| **fabel Del C + D** | Hjem-innboks maks 3 inline + «Se alle (N)»/«Vis færre» **inline-ekspansjon** (fabels `/boks`-destinasjon avvist — innboksen er sjekklister+oppgaver, `boks.tsx` er mappevisning; ingen samlet skjerm finnes). Byggeplass-velger markerer «· arves fra dagskortet» | ✅ ≤3-grenen live · D live |
| **HMS-listefunn A/B/C** | `slett`/`hmsSendInn`-onSuccess invaliderer nå `hms.hentDokumenter` (lista hang til refresh) · Forkast-dialog bruker `hms.forkast.*` («legges i papirkurven, 90 dager») i stedet for generisk Slett · låst felt viser «—» | ✅ alle tre stier live |
| **Funn #1 + #2** | `TekstfeltObjekt` (delt `text_field`, ALLE sjekkliste-/oppgaveskjemaer) viser «—» i leseModus · «Ingen byggeplass»-valg i sedel-velger, gatet bak `tillatIngen` så global `ByggeplassChip` er upåvirket | ✅ render-verifisert · ✅ live |

**Til bygg 45 (notert, ikke skjult):** Require cycle `TimerSeksjon ↔ MaskinSeksjon ↔ SplittRadModal` (ikke-fatal dev-warning, men undefined-risiko ved endret import-rekkefølge) · A3 tom equipment-cache kun kode-verifisert (tilstanden er vanskeligere å nå etter cache-fiksen) · B3 legitim-tom kun strukturelt bevart (suksess-stien urørt av fiksen) · tegningsbildets render bekreftes først på TestFlight (bilde-host unåbar over SSH-tunnel; bilde-stien er urørt i diffen).

</details>

### ✅ ARKIVERT — HMS 5a+5b + utlegg U1 → [historikk-2026-08.md](historikk-2026-08.md)

Begge prod-deployet `e37621e1` (08.08 kveld) og arkivert med mekanikk, asymmetri-tabell og verifisering. **Utlegg U3 web-registrering — MERGET develop (`aa111b45`), på test.** Mockup 8a+8b. API: `timer.expenseCategory.list` (utledet ordning + kilde per prosjekt) · `dagsseddel.tilfoy/oppdater/fjernUtleggRad` (`ordningVedFoering` stemplet ved insert, `sats` avvist — bæres av `SheetTillegg`) · `*UtleggVedlegg`; `hentMedId` returnerer `utlegg[]`. Web: `LeggTilVelger` (én inngang, to grupper, ordnings-pille som undertekst — aldri et valg), `UtleggRadDialog` (tre radformer + kilde-linje), `RaderUtlegg`. **Tillegg-flyten (sats) er urørt** — samme mutasjon/validering/lagring. **CHECK-constrainten er runtime-bevist på `sitedoc_test` 09.08:** fakturert+beløp avvist · fakturert+NULL godtatt · utlegg+NULL avvist · utlegg+beløp godtatt (alt rullet tilbake). ⚠️ **Før U5** står alle kategorier på `ordning='utlegg'` → flaten viser kun utlegg-formen på ekte data; `fakturert`/`sats` verifiseres via manuelt satt ordning. Navngitte oppfølgere: bro `ExpenseCategory`→lønnsart · utlegg i attesterings-redigering (arbeider-sti-only asymmetri).

**Utlegg gjenstår:** U2 eksport-guard (utsatt — ingen Proadm-eksportmotor i kode) · E2E-verifisering av U3 · U4 mobil · U5 firma-admin overstyring-UI (**firma-admin setter ordning per kategori; default `utlegg`; må advare ved navnekollisjon mellom `Tillegg` og `ExpenseCategory`**) · U6 migrering av feilførte rader (egen gate). **HMS gjenstår:** SJA-Returner + flyt-stripe på web · dedikert mobil-HMS-behandling.
### Sjekkliste ikke append-only (branch `fix/sjekkliste-ikke-append-only`) — PÅ BRANCH, venter merge

**Regresjonsfiks fra `04f6d295`** (kun develop/test, prod ikke rammet). `04f6d295` slo på append-only felt-låsing i alle fire skjema-hooks. Riktig for oppgave (mobil manglet den), **feil for sjekkliste** (spec `dokumentflyt.md § 2`: sjekkliste er redigerbar for den som har ballen + admin/registrator) — et innsendt tallfelt ble permanent låst, også for admin.

Fjernet felt-låsen fra begge sjekkliste-hooks (`useSjekklisteSkjema` web+mobil: import, `låsteFelterRef`, init-lås, `erFeltLåst`, settVerdi-guard, interface, retur) + `verdiLeseModus = leseModus` i begge sjekkliste-sidene. **Oppgave urørt** (låsen beholdt). Docs oppgave-only i 4 steder (`feltLaasing.ts`, `flytRolle.ts`, `mobile/hooks/CLAUDE.md`, `shared/utils/CLAUDE.md`) + BACKLOG § server-side scopet til oppgave. Separat funn (oppgave-låsen konsulterer ikke rettighet) → BACKLOG, ikke fikset her.

**Verifikasjon:** `next build` grønn, shared-tester grønne, mobil-typecheck uendret (11 baseline). **Flagg:** pre-eksisterende TS2589 i `sjekklister/[sjekklisteId]/page.tsx:117` finnes på origin/develop uten denne diffen (dukket opp etter del-2-mergen med samtidig arbeid) — feiler ikke `next build`, men bør ryddes separat. Runtime-verifisering på test etter deploy.

### Fase M-3a del 2 — MalBygger gap-bygging (branch `feat/faseM-3a-del2`) — PÅ BRANCH, venter merge + test-verifisering

**Levert i kode 2026-07-16** (build grønn, shared-tester grønne, web+api typecheck rent, mobil-typecheck uendret). Bygget mot del 1-matrisen + Kenneth-vedtak «norsk kanonisk grense-nøkkel + engelsk fallback-les»:

- **F1** grenseverdier (`min`/`maks`/`toleranse`/`enhet`/`desimaler`): delt `@sitedoc/shared/utils/grenseSjekk.ts` (normaliser + validering, m/test), editor-UI i `FeltKonfigurasjon.tsx`, web+mobil-render viser grense (≥ ≤ ±) + amber-markering utenfor (blokkerer ikke innsending). NS3420-seed rendrer nå uten å røres.
- **F2** quiz web (`QuizObjekt.tsx` + KOMPONENT_MAP) — web-datatapet lukket.
- **F4** `persons.max`-input.
- **pkt 2** kollapsbare heading-seksjoner (`seksjoner.ts` delt + `UtfyllingSeksjoner` web+mobil), utledet uten datamodell-endring, print-trygt.
- **pkt 4** `mal.kopier` (to-pass parentId + dokumentflyt-koblinger) + aktivert MalListe-knapp.
- i18n: 11 nøkler × 14 språk (generate.ts kjørt). Restanser (F2-rest/F3/F4-rest/pkt 2-rest) → [BACKLOG § MalBygger felttype-restanser](BACKLOG.md).

**Utestående:** skjermbilder/funksjonell verifisering på test.sitedoc.no etter deploy (kontroll-Claude, ikke Opus' egenrapport). Full detalj: [faseM-3a-felttype-matrise.md § Del 2](faseM-3a-felttype-matrise.md).

**Oppfølger `fix/pdf-enhet-fallback` (2026-07-16):** Del 2-editoren skriver `enhet`/sletter `unit`, men PDF (`felt.ts:78`), `RapportObjektVisning.tsx` og `BeregningObjekt` (web+mobil) leste kun `unit` → mistet enhet ved redigering av int/decimal-mal. Alle lest om til `enhet ?? unit` (pdf beholder null-avhengigheter). Ekte regresjon funnet i exit-runden (fabel). Web+pdf typecheck rent, mobil uendret.

### 🎨 Redesign navigasjon (branch `redesign/navigasjon`, bak `nyNavigasjon`-flagg — av-default, inert i prod)

**Aktiv front — steg viii (kunderunde mot prod-kopi) + pilot.** Infra reist + runbook komplett (2026-07-08); venter kunde-booking + Kenneth-drift: opprett demo-prosjekt m/ `oversettelse`-modul, kjør pre-flight-SQL, last opp SDS. Deretter pilot (flagg → `company_admin`).

Egen Docker-stack `docker-compose.redesign.yml` (web 3500 / api 3501), DB `sitedoc_redesign` (prod-kopi). Runbook + env/secrets/demo-strategi: [steg-viii-kunderunde.md](../redesign/steg-viii-kunderunde.md). Dev-login IKKE aktiv på redesign (verifisert 2026-07-09; se [dev-login-agent.md](dev-login-agent.md)). Full paritet + T/G: [redesign-paritetssjekkliste.md](redesign-paritetssjekkliste.md).

**🔴 Blokker før steg viii:** OAuth-redesign gjenbruker prods apper m/ to ekstra redirect-URIer — skal reverseres (egne app-registreringer + fjern URIene fra prod-appene). Kilde: [BACKLOG § OAuth: redesign holder prods nøkler](BACKLOG.md).

**Fullført kode — alt på prod + arkivert (ingen status-/designgodkjenning-kopi her, statuskilde-regelen):**
- Steg ii–vii + K9 URL-kanonisering + K6/P31 Kontakter — prod flagg-inert `0be103fa` (2026-07-07) → [historikk-2026-07.md](historikk-2026-07.md) § Redesign steg ii–vi.
- K13 full søkedekning + restanse-runde (P-a/kildeflagg/FM5/T9) + Plan 2 bruker-lagret flagg — prod flagg-inert (`ffc703df`/`0d3f21ac`, migrering `20260707120000_user_ny_navigasjon`). Presedens `?nyNav`-URL > konto > lokal > env > av i delt `resolverNyNavigasjon` (@sitedoc/shared). Statuskilde K13: designprosjekt «Sitedoc redesign tips» → `verifisering/K13-verifiseringslogg.md`. Detaljer: [k13-sokdekning-rapport.md](k13-sokdekning-rapport.md).
- Finnbarhets-revisjon (søkemotor `sok-match.ts` + begrepsfikser + byggeplasser-kort) — prod `43299d03` (2026-07-15), flagg-inert unntatt `nav.sok`/`nav.kontrollplan`-labels (se PROD-LIVE-merknad øverst) → [historikk-2026-07.md](historikk-2026-07.md).
- Delt `OppsettSidemeny` + sidebar aktiv-seksjon-fix + 🔴 per-rad geofence-indikator (LIVE, ikke bak flagg) — prod `e5859440` (2026-07-15, runde 2) → [historikk-2026-07.md](historikk-2026-07.md).
- Georeferanse-panel v2 + Kartverket-adressesøk (G2), i18n 13 språk `a2a8d5c7` — prod `387d10a2` (2026-07-15, runde 3). Statuskilde: designprosjekt «Sitedoc redesign tips» → `verifisering/georef-panel-verifiseringslogg.md`. Prod-runde: [historikk-2026-07.md](historikk-2026-07.md).

**Åpne oppfølgere (sporet annet sted):** redesign-mobil-restanser + steg vii/2c-leser-funn → [BACKLOG § Redesign-mobil](BACKLOG.md) + [§ Redesign steg vii/2c](BACKLOG.md); GPS-felttest av geofence → [BACKLOG § GPS-felttest](BACKLOG.md); MS-login mobil lokal dev-placeholder → BACKLOG.

### ✅ Timer-mobil F2/F3/F5 (feltfunn del-6) — DEPLOYET PROD `43299d03` + EAS #40 (2026-07-15) → arkivert [historikk-2026-07](historikk-2026-07.md#prod-deploy-2026-07-15-prod-merge-43299d03--eas-40--timer-f2f3f5-byggeplass-per-rad--matpause-b%C3%A6rer--finnbarhets-revisjon)

Byggeplass-velger tri-tilstand (F2) + byggeplass per timer-rad (F3) + matpause-bærer per rad (F5) + edge #1 dynamisk minutt-etikett. Prod-migrering `20260714120000_sheet_timer_pause_min` applied på `sitedoc`; mobil i TestFlight via EAS #40. Fasit: [timer-mobil-f2f3f5-spec.md](timer-mobil-f2f3f5-spec.md) · detaljer: [timer.md § F5](timer.md).

### ✅ Del-6-fiksrunde F-b/F-e/F-f/F-g — DEPLOYET PROD `f888fecc` 13.07 + EAS #38 → arkivert [historikk-2026-07](historikk-2026-07.md#prod-deploy-2026-07-13)
> _Deployet — detaljene under er historikk (flyttes/trimmes ved neste rens). Oppsummering + gate-lærdommer i historikk-2026-07._

Fire rotårsaksfikser på branch fra develop `2bbf9169` (ren base, S-A + footer merget). Rutet gjennom cowork-gate (ikke selv-committet).
- **F-b:** `utvidArbeidstidsvindu` (`StartSluttDagKort.tsx`) tar `sluttTidKilde`-param → utvider `endAt` KUN ved bekreftet `"bruker"`-slutt; `system`/`midnatt`-gjett skyver ikke vinduet ut med fabrikkerte tider.
- **F-e:** ny `PAUSE_TERSKEL_TIMER = 5.5` (fast, AML §10-9) + `pauseMinForDag(dagsTotal, standardPauseMin)`; **auto-gen-stien** gater pausefradrag på dagstotal i **`fordelArbeidstidFradrag`** (dag-nivå pause-kilden — re-fiks 2026-07-13 flyttet gaten hit fra `carveArbeidstider`-vinduet) — der 38-min-avviket oppstår. **De interaktive edit-flatene (TimerSeksjon/MaskinSeksjon/web) er ÅPNE** (dag-nivå-modelleringsproblem — se BACKLOG § F-e; flagget ved gate). **⚠️ KJENT BEGRENSNING (pilot):** manuell rad-redigering på en <5,5t-dag trekker fortsatt pause (interaktiv-sti, pre-eksisterende — IKKE regresjon). Fikses i F-e-interaktiv-oppfølgeren (design-gate hos fabel først). Fabels F-e-live-fangst denne runden tester KUN carve-stien.
- **F-f:** `redigerSedelRader` + `RedigerRadModal` fra/til-vakt via delt `finnTidsromKonflikt` (samme som `syncBatch`) + mangler-tid-vakt. `validerSplittFelles` avvist (sum-invariant). Nye i18n-nøkler.
- **F-g:** differensiert «for kort»-melding (`haddeEksisterendeRader` → pre-fylt-variant). Nye i18n-nøkler.
- Typecheck 0 nye feil (shared 9=9, api grønt, web 4=4 vitest-baseline, mobil 11=11). i18n generate → 13 språk.
- **✅ AKSEPT BESTÅTT (live-fangst 2026-07-13, bundle `7ab96531`):** F-b-a (faktiske økt-tider) + F-b-b (skjerming: manuell `bruker`-slutt ikke overskrevet) + F-f-web (fra/til-vakt blokkerer tom Fra, gyldig lagrer) + F-g-a/b (differensiert/gammel melding) + **F-e-carve re-test** (kort dag 42 min → rad 0,75t full varighet uten pause; lang dag 6t → rad 5,5t pause trukket) — alle PASS (simulator + web). **Merket:** F-e-carve hadde AVVIK i første impl (rad-verdi ugatet, gate-glipp fanget av simulator) → re-fiks (`7ab96531`) flyttet gaten til `fordelArbeidstidFradrag`. Skjermbilder for fabel: `docs/claude/skjermbilder-del6-live/`. **Venter fabel design-sign-off (F-g-copy-finpuss + F-b-UX) → del 6 DoD → prod spor b.**

### ✅ hentEndringerSiden «erstattet»-lekkasje (fiks B) — DEPLOYET PROD `f888fecc` 13.07 (2 migreringer kjørt på `sitedoc`) → arkivert [historikk-2026-07](historikk-2026-07.md#prod-deploy-2026-07-13)

**Rot:** mobil-pull `hentEndringerSiden` (`apps/api/src/routes/timer/dagsseddel.ts`) manglet `attestertStatus ≠ "erstattet"`-filteret som alle andre lesere har (aktiv-helper 394/403, web-attestering 1835-1837, `hentForAttestering` 1974) → mobil viste ×N rader (write-only audit-rader fra rediger-mutasjonene). **DB-bevist** (seddel `49a7c839` test = 3 live + 6 «erstattet» timer / 2 live + 4 «erstattet» maskin; web filtrerte og viste 3+2, mobil-pull viste 9+6).

**Fiks B («lagre rett» uten å slette data):**
- **Ny felles tabell `SheetRadHistorikk`** (`packages/db-timer`, migrering `20260713120000_sheet_rad_historikk`, **kun ADD**) — JSON-snapshot + `radType` + `originalRadId` + `parentRadId` + `erstattetVed`. Felles tabell fordi de tre kildetabellene har ulik kolonneform + historikk leses aldri for beregning.
- **Rediger-mutasjonene** (`rediger`-bulk 2804 + `splittRad` 3009): **FLYTTER** originalen til historikk (INSERT snapshot + DELETE hovedtabell i SAMME tx) i stedet for å sette `attestertStatus="erstattet"`. Parent-lenke bevart (ny rad.`parentRadId` → historikk.`originalRadId`).
- **Data-migrering** (i samme migrerings-tx): FLYTTER eksisterende «erstattet»-rader (alle 3 typer) fra hovedtabellene → historikk (INSERT via `to_jsonb(t.*)` + DELETE). **MOVE, aldri hard-delete.**
- **`hentEndringerSiden`** (3487): `not: "erstattet"`-vern på timer/tillegg/maskiner-include (rulleringsvern, no-op etter migrering).
- **`attestertStatus`-kolonnen beholdt** (pending/attestert/returnert brukes fortsatt).

Fiks B: `5c9d2070` (kode + migrering + docs). **DEPLOYET api-test + DB-verifisert** (hovedtabell 3 timer/2 maskin live, 6+4 audit-rader flyttet til `sheet_rad_historikk`). **M-1 PASS** (fresh full pull → 3/2) + **M-2 PASS** (stale enhet → normal delta-sync self-heal → 3/2 uten reinstall). Begge cowork-gatet — hele fiks B (hoved + self-heal) bevist ende-til-ende.

**Oppfølger — self-heal av stale lokal tilstand (M-1-funn, TEST-MIGRERT + M-2 PASS):** M-1 avdekket at eksisterende stale lokal visning (9/6) **ikke** self-healer via delta-pull: hoved-migreringen FLYTTET barn-rader uten å bumpe `daily_sheets.updated_at` (barn-endringer bumper ikke parent — bevisst i koden), så `hentEndringerSiden`-delta (`updatedAt > sistSynk`) tar ikke med de berørte sedlene → arbeideren beholder oppblåst visning til full pull/reinstall. Payroll trygt (server korrekt), kun kosmetisk. **Fiks:** ny migrering `20260713130000_bump_updatedat_erstattede_sedler` — ren `UPDATE daily_sheets SET updated_at = now() WHERE id IN (SELECT DISTINCT sheet_id FROM sheet_rad_historikk)`. Bumper de berørte sedlene → neste delta-pull re-henter → pull-apply (delete-all-local + insert-server) reconciler til 3/2. Self-heal uten reinstall. KUN `updated_at`-bump, ingen skjema-endring, idempotent. **Test-migrert 2026-07-13** (`87af7e5b`; `daily_sheets.updated_at` for `49a7c839` bumpet til migreringstid; **M-2 PASS** bekreftet delta-sync-heal uten reinstall). **Prod (begge migreringene) venter Kenneths go — spor b (full `develop→main` når del 6 m.m. er godkjent).**

### ✅ Del 6 timeføring — DEPLOYET PROD `f888fecc` 13.07 + EAS #38 → arkivert [historikk-2026-07](historikk-2026-07.md#prod-deploy-2026-07-13)

Redesign-Opus del-6-arbeid, isolerte branches fra develop, bak coworks dual-review-gate:
- **del 6 P1–P5** (`feat/del6-timeforing`, merget develop `fa2c47a3` + i18n `5f7e1aa8`): P1 maskin-i-rad (web+mobil, UI-only), P2 arbeider-splitt (`splittRadEier` + delt `validerSplittFelles`, web+mobil lokal Drizzle), P3 hybrid (HjemTimerChip 3 tilstander + kort på timer-flaten), P5/P4c allerede på develop. Web fabel-designgodkjent (`docs/claude/skjermbilder-del6-live/`). **P2-mobil duplikat-bug (S3) fikset** via update-original-id (`443c7b38`).
- **fra/til obligatorisk + GPS-carve** (`fix/timer-fra-til-obligatorisk`, `a0d510a5`+`62cee2dc`, merget develop `032491a0`): se [timer.md](timer.md)-rad. **Vedtak: a2-reversering + reise-unntak.**
- **oppfølgere** (`fix/del6-oppfolgere`, `8515555c`+`9d6a8d82`, venter gate): **F-a** tom dagskort-dag gir også variant B; **F-c** «Økten var for kort»-melding ved 0 carve-rader.
- **F-b «Til kl.»-fiks (design, IKKE kode):** designfila RUNDE 5 + `screenshots/runde5-tilkl-2026-07-13/` — forslag: «Slutt dag» skriver faktiske økt-tider. **Foreslått** sluttTidKilde="bruker"-skjerming (må implementeres — `utvidArbeidstidsvindu` sjekker ikke sluttTidKilde i dag). Venter Kenneth-valg.
- **S-A mobil rad-sletting propagerer ikke (S3) — TOMBSTONE LØST + TEST-VERIFISERT (M-3-reprise PASS), venter prod spor b:** Ny lokal `slettede_rader_local`-tombstone-tabell; fjern-handlerne skriver tombstone atomisk (`db.transaction`); syncBatch-push sender `slettedeIder: {timer,tillegg,maskiner}` (optional, #37-bakoverkompat) → server `deleteMany({ sheetId, id:{in} })` bak samme vakt som payload-replace (KRAV 2); pull-race-guard hopper over re-innsetting av rad med levende tombstone (KRAV 1); tombstones ryddes kun ved server-bekreftet sync (KRAV 3). Gatet `6bed19c3`. **✅ M-3-REPRISE PASS (simulator + server-SQL, IKKE EAS):** slett rad → sync → borte lokalt OG på server (`deleteMany` propagerte, `065dc8f4` borte) + pull re-innsetter ikke. Venter kun prod (spor b). Full design + 3 krav: [BACKLOG § Mobil timer-rad-sletting](BACKLOG.md).

### PSI Fase A + Maskin + ③ + timer-paritet — mobil-restanser (web/DB i prod, mobil venter EAS)

Web + DB-migreringer i prod (`80974276`/`0be103fa`); timer-paritet + pause-regler + overlapp/gjenåpne-vakt + nyNav sticky-flag i prod (`224c13f6`, 2026-07-09 → arkivert til [historikk-2026-07.md](historikk-2026-07.md)). **Gjenstår kun mobil-delene**, alle via neste **EAS-batch** (gjeld sporet i BACKLOG, ikke tapt):
- PSI `MannskapInnsjekkKort` inn/ut + dagsseddel-registrering + maskin/③-mobil.
- Timer-paritet mobil: bolk (e) B1–B4, bolk (f) gjenåpne-bekreftelse + `PRECONDITION_FAILED`-mapping, bolk (g) prefill-scope/`fra<til`/0==0 — [BACKLOG § Timer web-vs-mobil paritet](BACKLOG.md).
- maskin-vs-maskin-overlapp, `sedel.pauseMin`-avklaring, dagsnorm-varsel-vs-B2, midnatt-wrap-bug, Piece 2 (1b auto-utkast fra/til), maskin-`fra<til` på synk (SYNC-2-funn) — alle i BACKLOG. (`pauseBeregning.ts`-mobil-dedup ✅ M2.)

**Bolk (h) — mobil offline-synk-blokkere (rekkefølge SYNC-1 → SYNC-2 → M2–M7, én commit per steg, alle utsatt til EAS #38):**

> **Verifiseringsnivå (oppdatert 2026-07-10 — Fase 4):** SYNC-1, SYNC-2, M2, M3, M4, M5, M6, M7 statisk verifisert (typecheck/vitest/web-build/objekt-lesing) **+ bolk-(h)-kjernen nå enhets-verifisert** på simulator mot api-test (SSH-tunnel). **Fase 4-resultat:** punkt **1–6 ✅ runtime** (B3/auto-synk 11:00+3→14:30, hele-sedel-prefill, overlapp-speiling, B2-sperre, maskin B1–B3, SYNC-1 offline-avvisning rødt banner). Punkt **7–8 (M4 gjenåpne-koder + M7 Alert) BLOKKERT** av to attestering-bugger funnet under testen: rader forsvinner på mobil etter attestering (🔴 mulig SYNC-2-regresjon) + attestert-sedel-deadlock (🔴 retur-knapp forsvinner ved `accepted`). **Begge er #38-blokkere** til avklart. Se [BACKLOG § Timer web-vs-mobil paritet → Fase 4 simulator-funn](BACKLOG.md).
- **✅ SYNC-1 (develop 2026-07-10):** `syncBatch.ResultatRad` utvidet med `"avvist"` (permanent avvisning: P2002, katalog-mismatch, maskin>arbeid, FORBIDDEN) skilt fra transient `"feilet"`. Mobil gjør `avvist` terminal (forlater pending → retry stopper) med rødt banner i `timer/[id].tsx` + `TimerSyncStatusBar`. Ny lokal `syncStatus="avvist"` (TS-enum, ingen SQLite-migrering). Bakoverkompat: #37 faller til else på `avvist` → beholder pending (dagens oppførsel). Se [BACKLOG § Timer web-vs-mobil paritet → SYNC-1](BACKLOG.md).
- **✅ SYNC-2 (develop 2026-07-10):** overlapp + `fra<til`-regel løftet til `@sitedoc/shared/utils/tidsromValidering.ts` (ren + vitest 44/44); web (`sjekkTimerOverlapp`/`refineFraForTil`) + mobil-synk (`syncBatch` via `finnTidsromKonflikt`, batch-intern) kaller samme regel. Avvisning via `"avvist"`. **+ datatap-fiks:** `syncBatch` persisterer nå `fraTid`/`tilTid` (input + `createMany`, timer + maskin) — før droppet synken dem samtidig som `deleteMany`+`createMany` slettet tider ført på web. Ingen migrering. Se [BACKLOG § Timer web-vs-mobil paritet](BACKLOG.md).
- **✅ M2 (develop 2026-07-10):** dedup `pauseBeregning.ts` — mobil-kopien (uten `10622ee3`-grensefiksen, målt) slettet, `TimerSeksjon.tsx` importerer nå fra `@sitedoc/shared`. Ingen mobil-funksjonsendring, kun kilde-samling.
- **✅ M3 (develop 2026-07-10):** klient-side speiling i mobil. `TimerSeksjon` blokkerer lagring ved overlapp (`finnOverlappendeTidsrom` mot **alle timer-rader på sedelen, kryss-bøtte** via ny `alleTimerRader`-prop tråret fra `[id].tsx`; ekskl. redigert rad) + `fra<til` (`tilErEtterFra`); `MaskinSeksjon` får `fra<til`-redirect. Prefill forblir bøtte-scopet (ulikt scope). Duplikat `fraErForTil` slettet — begge kaller delt `@sitedoc/shared`. Ny nøkkel `timer.feil.overlapp` (serverens ordlyd). Ren klient, ingen api/migrering.
- **✅ M4 (develop 2026-07-10):** `gjenaapneDagsseddel`-feil mappes nå på tRPC-**kode**, ikke delstreng. Server (`apps/api/src/routes/timer/dagsseddel.ts`) gir distinkte koder — `CONFLICT` (accepted), `PRECONDITION_FAILED` (attestert rad), `BAD_REQUEST` (annen ikke-sent-status); i tillegg arver mutasjonen `FORBIDDEN`/`NOT_FOUND` fra eierskaps-helperen `hentEgenDagsseddel` (`NOT_FOUND` fikk melding «Dagsseddelen finnes ikke», var tom). **Meldingene på de tre gjenåpne-avvisningene uendret** (web-onError `e.message.includes("godkjent")` uberørt). Mobil (`apps/mobile/app/timer/[id].tsx`): `CONFLICT`→`feilGodkjent`, `PRECONDITION_FAILED`→`laastAttestert`, **enhver annen kode→server-melding** (BAD_REQUEST/FORBIDDEN/NOT_FOUND + fremtidig), **kun fravær av `code`→`feilNett`**. Fikser attestert-vakt + eierskaps-feil vist feilaktig som «Krever nett». Ingen nye i18n-nøkler (`laastAttestert` fantes, brukt av web), ingen SQLite-migrering. **To 🟡-oppfølgere lagt i BACKLOG:** mobil mangler webs proaktive `disabled`-guard (krever SQLite-`attestertStatus` + sync-pull) + `providers/index.tsx` `"UNAUTHORIZED"`-substring (samme feilklasse). Se [BACKLOG § Timer web-vs-mobil paritet](BACKLOG.md) + [timer.md § Gjenåpning](timer.md).
- **✅ M5 (develop 2026-07-10):** mobil maskin-modal (`MaskinSeksjon.tsx`) speiler nå webs `MaskinRadDialog` — **B1** (maskin trekker lunsjpause via `effektiveTimerFraSpenn` med `standardPauseMin`, «maskin følger føreren»), **B2** (hard sperre `antall == effektiveTimerFraSpenn` i `lagre()`, `timer.feil.timerAvvik`), **B3** (`timer` init fra prefill-spenn), auto-synk `handterFra/Til/Timer`, **B4-prefill** fra bucketens arbeidsspenn (`defaultTider` leser timer-rader i `(defaultProjectId, defaultEcoId)`). `standardPauseMin`/`pauseEtterTimer` fra `hentOrganizationSettingLokalt`, skiftstart fra `hentEffektivArbeidstidLokal`. **Server:** `syncBatch` validerer nå maskin-`fra<til` (`tilErEtterFra` på `lokal.maskiner`) → `"avvist"` (SYNC-1) — lukker SYNC-2-funnet. Ingen ny i18n, ingen SQLite-migrering. **Docs:** timer.md B2-drift rettet (var «Server-superRefine» — usant) + B1–B4 mobil; ny 🔴 BACKLOG «B2 ikke håndhevet på serveren» (klient-only begge flater); maskin-fra<til-🟡 lukket. Se [timer.md § B1–B4](timer.md) + [mobil.md § Maskin-modal](mobil.md).
- **✅ M6 (develop 2026-07-10):** mobil timer-modal (`TimerSeksjon.tsx`) fikk **B3** (`timer`-init lazy-kaller `effektiveTimerFraSpenn` når `prefillGyldig`; `tilTid` prefylles kun ved gyldig prefill — speiler webs `TimerRadDialog`) + **prefill-scope**: `defaultTider.fra` løftet fra bøtte-scopet siste-rad til **seneste `tilTid` over hele sedelen** (`alleTimerRader`, **maks** via `hhmmTilMin` — ikke array-rekkefølge; fjerner `.reverse().find()`), fallback `effektiv.startTid`. Lukker bolk-(g)-prefill-scope-bulleten (bolk (g) mobil nå KOMPLETT: fra<til M3, overlapp M3, 0==0 allerede vernet, prefill-scope M6). `eksisterendeRader` beholdt for lønnsart/aktivitet-prefill. Ren klient — ingen api, ingen i18n, ingen migrering. **Docs:** timer.md B3 mobil timer ✅; BACKLOG bolk-(g)-rad → 🟢 + usortert-prefill-🟡 avgrenset til maskin-B4 (mobil timer fjernet fra mengden). Se [timer.md § B3](timer.md) + [mobil.md § Timer-modal](mobil.md).
- **✅ M7 (develop 2026-07-10):** bekreftelse før gjenåpning i mobil. `gjenaapne()` (`apps/mobile/app/timer/[id].tsx`) viser nå `Alert.alert(bekreftTittel, bekreftTekst, [avbryt(cancel), bekreftKnapp → utforGjenaapne])`; mutasjons-kroppen (inkl. M4-`onError`, uendret) flyttet til `utforGjenaapne()`. **Ikke** `destructive` — gjenåpning er reversibel. Paritet med webs `<Modal>`-bekreftelse. Gjenbruker webs `bekreft*`-nøkler + `handling.avbryt` (alle nb+en; var web-only). `Alert.alert` er husets bekreftelses-idiom (33/12 — talt 32 i Steg 0 før denne raden selv la til den 33.) og regel-konformt (CLAUDE.md § Slett-bekreftelse treffer webs `confirm()`, ikke RN). Ren klient — ingen api, ingen ny i18n, ingen migrering. **Ny 🟡 BACKLOG:** samle de 33 `Alert.alert` i delt RN-komponent hvis e2e (Detox/Maestro) innføres. **Docs:** timer.md § Gjenåpning, mobil.md. Se [mobil.md § Gjenåpning-bekreftelse](mobil.md).
- **🏁 Bolk (h) FERDIG PÅ DEVELOP + server-delen PROD-DEPLOYET** (SYNC-1 → SYNC-2 → M2–M7, 2026-07-10). **Server-endringene (M4/M5/SYNC i `apps/api`) er live i prod via merge `373a109f`** (arkivert til [historikk-2026-07.md § Prod-deploy 2026-07-10](historikk-2026-07.md)). **Raden holdes AKTIV** fordi mobil-siden (EAS #38) er blokkert av de 2 🔴 Fase-4-funnene (rader-forsvinner-etter-attestering + accepted-deadlock) — se 🧪-raden under. Ingenting nytt startet.
- **🧪 Fase 4 simulator-verifisering (2026-07-10):** kjørt på ekte enhet mot api-test (SSH-tunnel `localhost:3301` → server-ny, dev-login). Punkt 1–6 ✅ runtime; 7–8 blokkert av to attestering-bugger (🔴 rader-forsvinner-etter-attestering + 🔴 accepted-deadlock) → begge #38-blokkere, dokumentert i [BACKLOG § Fase 4 simulator-funn](BACKLOG.md). Prod er deployet (`373a109f`, bolk (h) + M4/M5 + katalog-importer). **#38 IKKE klar** før de to 🔴 er avklart.
- **✅ F4-serien (F4-1/1b/1c/1d/2/2b/3/4) — DEPLOYET TIL PROD 2026-07-11 (`d1b96cd5`):** identitetsforsoning + attestering-deadlock (gjenåpne) + synk-robusthet (touch-parent, projectId-poison, NOT_FOUND-oppslag) + mobil display-fikser. Server/web-delene live i prod; mobil-only (F4-1c dedupe, F4-3 attestert-tittel) ligger i main men når enheter via **EAS #38**. Full detalj + per-rad fil:linje arkivert til [historikk-2026-07.md § Prod-deploy 2026-07-11](historikk-2026-07.md).
- **⚠️ Deploy-rekkefølge — server FØR EAS #38:** `1061dd5a` (M4) og `0b0eb38e` (M5) rører `apps/api/src/routes/timer/dagsseddel.ts` (distinkte tRPC-koder `code: "CONFLICT"`/`"BAD_REQUEST"` + `code: "NOT_FOUND", message: "Dagsseddelen finnes ikke"` + maskin-`fra<til`-vakt `lokal.maskiner.find((m) => !tilErEtterFra(...))`). `8ffb29b0` (M6) og `1d6d616c` (M7) er **mobil-only**. **Server (M4+M5) MÅ prod-deployes FØR #38 når testerne.** Mot gammel server: gjenåpne-avvisningene deler fortsatt `PRECONDITION_FAILED`, så en #38-klient (`timer/[id].tsx` `onError`: `code === "PRECONDITION_FAILED" → laastAttestert`) viser «be leder returnere» for en sedel som faktisk er **godkjent** (`accepted`). Gammel servers meldingsløse `NOT_FOUND` vises som den rå strengen «NOT_FOUND», fordi klienten nå viser `e.message` for ukjente koder (`code != null ? melding`). **Ikke datatap — feil tekst.** Motsatt retning er trygg: gammel klient (#37) mot ny server leser `e.message`, som er uendret.

**Dagsseddel-prod krever `aktiverNivaa1` på prod-firmaet** (lønnsart-katalog seedet) ellers mangler lønnsarter — jf. onboarding-wizard + lønnsart/katalog-import-trådene under. (Redesign steg viii-kontinuitet: se redesign-blokka øverst.)

**Leveransekanal — EAS-bunt #37 / TestFlight (venter Florians funksjonelle device-test):**

Gjeldende TestFlight-bunt (bygg-ID `496b6a63`, commit `bc744f82`, sky-bygget 2026-07-01 da juli-kvoten resatt, status `finished` m/ .ipa). **Kumulativt fra develop** → .ipa inneholder ALL tidligere merget mobil-kode (timer-UX UF-0…UF-4/U1–U3 fra #30-æraen, byggeplass-UX fra #31) + det nye under. Erstatter #30/#31 (juni-kvoten oppbrukt; lokalt bygg = blindvei, se [eas-build-veileder.md](eas-build-veileder.md)). **Ingen schema/server.** A.Markussen-validering av **full timer-UX** skjer via #37 når det er i TestFlight. **Neste bygg = #38, etter bolk (h) (mobil-paritet); #37 er gjeldende TestFlight-bunt til da.**

**Kenneths beslutning (2026-07-10): Florian tester ikke #37 — han venter på #38 (etter bolk (h)).** Grunn (verifisert i kode): en rad serveren avviste ble stående `syncStatus="pending"` og `TimerSyncStatusBar.tsx` viste den som gul spinner → falsk trygghet for tester. **SYNC-1 (develop 2026-07-10) lukker synligheten** — permanent avvisning settes nå til terminal `syncStatus="avvist"` med rødt banner. Rettelsen når først testeren via #38 (SYNC-1 er på develop, ikke i #37s .ipa). Se bolk (h)-punktet over + [BACKLOG § Timer web-vs-mobil paritet](BACKLOG.md).

Nytt i #37 (vs #31): **Mobil Microsoft-auth** (code+PKCE, `f8594d1c`) → [BACKLOG § Mobil Microsoft-auth](BACKLOG.md) (Azure-sjekkliste + Florians test der; ikke duplisert her); **F-G glemt-dag 0-fiks** (`c6babc44`, bug — kort start-segment klampes aldri til 0) → [BACKLOG § Org uten standard-lønnsart](BACKLOG.md).

Fra #31 (venter fortsatt device-verifisering via #37):
- **Byggeplass-UX F1–F6** — `ByggeplassKontekst` eneste kilde, header-chip, GPS auto-set + override, timer-default, favoritter (`a46d58e9`/`b2ee5fb4`/`0eb2c9ef`/`d7419e6b`/`7c3ae7e3`) → [BACKLOG § Mobil global byggeplass-UX](BACKLOG.md).
- **F-A glemt-dag-transparens** — `sluttTidKilde="system"`-utkast viser «Estimert slutt … (gjettet)»-banner. Ikke-blokkerende.
- **F-B auto-rundings-fiks** (bug) — auto-genererte timer-rader rundes til firma-tidsrunding-grid (15 min = 0.25 t) på arbeidstimer før normaltid/overtid-splitt (`rundTimerTilNarmeste`); reise urørt.
- **B2+B6 sedel-nivå byggeplass** — `arbeidsdag.byggeplassId` inn i auto-utkast (`dagsseddelOpprett.ts`), ny `ByggeplassVelgerModal` + blå sedel-topp, myk mismatch-advisory (G1: arbeider-valg autoritativt). Server/schema uendret; i18n 3 nøkler × 15 språk. **Parkert (Besl. 6-oppf.):** per-rad byggeplass / «splitt dagen mellom byggeplasser».

**Device-test (via TestFlight #37, alt før submit):** (a) org uten lønnsart → banner (ikke stille 0) · (b) org m/ lønnsart + start 21:33 → ~2.45t-rad dag-1, pause på lengste segment · + chip/GPS/favoritt + glemt-dag-transparens + 15-min-runding. **Før GPS-test:** prod-prosjekt mangler byggeplasser — opprett + geofence på sitedoc.no → Byggeplasser. **Reload:** Expo JS/TS (Fast Refresh). _(Web-sporet geofence-editor A+B + rename C ble deployet til prod 2026-06-24 `a558db2e` → arkivert til [historikk-2026-06.md](historikk-2026-06.md).)_

### Modul-onboarding-wizard (timer) — IMPLEMENTERT PÅ DEVELOP 2026-07-08 (web-only, venter prod)

Gjør firmamodul-onboarding synlig + veiledet ved aktivering. Bakgrunn: `organisasjon.settFirmamodul` (aktiver=true) flipper kun modul-flagget — **seeder ikke katalog** → timer-brukere traff tomme kataloger (jf. [BACKLOG § Modul-onboarding-veiledning](BACKLOG.md)). Generisk datadrevet modell (ferdig-state utledes fra status-tellinger, aldri lagret steg-posisjon) → maskin/varelager plugges inn senere.

- **TASK 1 (`ea4887a3`)** — modell `apps/web/src/lib/onboarding-wizard.ts` (`OnboardingWizardConfig`, `førsteUfullførteSteg`/`antallGjenstår`/`erOnboardingFullført`) + timer-config (4 steg, `ferdig = count > 0`, status-type fra tRPC `RouterOutputs`).
- **TASK 2 (`97a2912f` + Suspense-build-fix `1730263b`)** — dedikert wizard-side `/dashbord/firma/timer/oppsett` (URL-adresserbare steg `?steg=`, datadrevet gjenopptak). Orkestrerer: steg 1 = `aktiverNivaa1`, steg 2–3 lenker til aktivitet/tillegg-sider, steg 4 = utlegg-state. Oppsett-fane i timer-layout + hjelpetekst (?-ikon).
- **TASK 3 (`34ae939f`)** — modal-inngang i `firma/moduler` (`settFirmamodul.onSuccess` → «{Modul} aktivert. Sett opp nå?») + «Fullfør oppsett ({n} av N)»-indikator på modulkortet (skjules ved fullført). Generisk `MODUL_WIZARD_URL`-oppslag.
- **TASK 4 (docs)** — i18n-sveip (30 nøkler nb+en, 0 relikvier/manglende), hjelpetekst-verifisering, denne STATUS-oppdateringen, sluttverifisering (build 59/59 grønt).

**v1 = web-only** (mobil «oppsett ufullstendig»-visning = egen follow-up). i18n nb+en (generate.ts frossen under redesign → 13 språk faller tilbake til nb). **Konsolidering utsatt** (redirect gammel `onboarding`-fane → wizard + migrering/`aktiverTomKatalog` inn i steg 1) → [BACKLOG § Onboarding-wizard konsolidering](BACKLOG.md). **Gjenstår: prod-deploy** (adresserer også Åpne tråder pkt 1 — tom lønnsart-katalog på prod-firma synliggjøres nå av wizarden).

### Lønnsart/katalog-import (A.Markussen) — KJØRT PÅ PROD 2026-07-10 (etter deploy 373a109f)

Landet på `develop`:
- `c875ee6f` — 6 BACKLOG-rader (lønnsart/kode-funn) + drift-rettinger i `timer.md` og `docker/DOCKER-NOTES.md`.
- `92f15893` — generisk `importerKatalog` (`apps/api/src/services/katalog/`, søk `export async function importerKatalog`) + A.Markussen-fixture (`fixtures/a-markussen.json`) + tRPC `admin.importerTimerKatalog` bak `verifiserSiteDocAdmin`.

**Resultat (prod, 2026-07-10 etter deploy `373a109f`):** `admin.importerTimerKatalog` kjørt mot prod-org (A.Markussen) med `dryRun: false` + `deaktiverUmatchedeLonnsarter: false` (bevisst — Kenneth ville **ikke** auto-deaktivere). Oppsummering: **26 opprettet, 12 oppdatert** (alias-treff festet `kode` til eksisterende rad → ingen dubletter), **0 deaktivert**, stjerne flyttet km→120 (`nullstiltStandardvalg: 1`, `standardKodeSatt: 120`). `dryRun: true` ble kjørt FØRST og bekreftet match-veien før skriving. **14 legacy-rader BEHOLDT aktive** (diett/km/nattillegg/losji/lærlingelønn/velferdsperm./skift-som-lønnsart) — Kenneth sletter manuelt i UI eller i kundesesjon. **Åpent til Florian:** km/diett som utlegg? Skal nattillegg/matpenger/smusstillegg/lærlingelønn fortsatt registreres? → km-stjerna og 0-kode-radene er borte; nivå-1-seed-blokkeren i BACKLOG er lukket.

**Prod-tilstand** (målt 2026-07-09 av Kenneth, ikke egen-verifisert): A.Markussen har 25 lønnsarter, 0 med `kode`, `erStandardvalg` står på `Kilometergodtgjørelse (egen bil)`.

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
originalt kundeønske. fra<til-validering på mobil via delt `tilErEtterFra`
(`@sitedoc/shared`; `fraErForTil`-helperen erstattet i M3 2026-07-10) + onBlur-runding på web.

**T.4-implementasjons-bunke (planlagt 5 sub-PR-er):**

| Sub-PR | Status | Innhold |
|---|---|---|
| **T4-a** | ✅ Merget til develop 2026-05-16 (merge `5acd2a5d`, impl `cfe51fc5`) | Schema + migrasjon. `OrganizationSetting.standardStartTid/SluttTid/PauseMin` (defaults 07:00/15:00/30) + `ArbeidstidsKalender.standardStartTid?/SluttTid?/pauseMin?` (overstyring for sommertid_start/slutt/halvdag). Additiv migrasjon, ingen breaking. |
| **T4-b** | ✅ Merget til develop 2026-05-16 (merge `9bcfb5b1`, impl `088a1e37`) | `hentEffektivArbeidstid(orgId, dato)`-helper i `apps/api/src/services/timer/arbeidstid.ts` (sommertid-overstyring → firma-default). Hard sommertid-par-validering i kalender opprett/oppdater (`sommertid_start` krever `sommertid_slutt` samme år). |
| **T4-c** | ✅ Deployet til test 2026-05-16 (merge `c02df657`, impl `39c43aa8`) | Server-Zod-utvidelse for de tre T4-a-feltene i `oppdaterSetting` + kalender `opprett`/`oppdater` (+ `validerTidsfelter`-helper). Innstillinger-side: ny `StandardArbeidstidSeksjon`. Kalender-modal: betinget visning av tidsfelter for sommertid_start/slutt/halvdag + klokke-badge i månedsliste. 15 nye i18n-nøkler → 13 språk (2277 totalt). Venter på visuell verifisering før prod-merge. |
| **T4-d** | ✅ Merget til develop + deployet til test 2026-05-16 (merge `7bee1633`, impl `2f7bf42d`) | Mobil Drizzle: `fraTid`/`tilTid` på `sheet_timer_local` + `sheet_machine_local`. Nye lokale tabeller `arbeidstidskalender_local` + `organization_setting_local`. Nye services `kalenderKatalog.ts` (med `hentEffektivArbeidstidLokal`-helper, speil av server) + `organizationSettingKatalog.ts`. TimerSyncProvider utvidet til 2-stegs Promise.all (base-pulls → firma-spesifikke pulls per org-id fra prosjekt-cachen). `timerSync` push/pull utvidet med fraTid/tilTid per timer/maskin-rad. Server: ny medlems-tilgjengelig `organisasjon.hentArbeidstidDefaults` + fraTid/tilTid lagt til i `hentEndringerSiden`-respons-mapping. Typecheck 12 = 12 baseline. Venter på enhet-verifikasjon + prod-merge. |
| **T4-e** | ✅ Merget til develop + deployet til test 2026-05-16 (merge `e992aca3`, impl `cea8f99e`) | Mobil UI. Ny `FraTilTidFelt`-fellekomponent (DateTimePicker mode=time, 2 felter side ved side). Montert i TimerRadModal + MaskinRadModal. Forhåndsutfylling: ny rad uten forrige rader → `hentEffektivArbeidstidLokal(orgId, dato)` (kalender + firma-default). Ny rad med forrige rader → forrige rads tilTid som fraTid. Rediger eksisterende → radens egne verdier. Validering: fraTid < tilTid hvis begge satt (`fraErForTil`-helper — erstattet av delt `tilErEtterFra` i M3 2026-07-10). Lagring til Drizzle med syncStatus=pending. SummeringsBanner: arbeidstidTimer faller tilbake til kalender-dagsnorm hvis sedel.startAt/endAt mangler — UI viser alltid relevant sammenligning. Rad-visning utvidet med `HH:MM–HH:MM`-tekst. 0 nye i18n-nøkler — gjenbruker `timer.felt.startTid/sluttTid` + `timer.feil.sluttForStart`. Typecheck 12 = 12 baseline. Venter på enhet-verifikasjon + prod-merge. |
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
