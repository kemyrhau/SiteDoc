---
name: BACKLOG
description: Konsolidert backlog — alt planlagt men ikke ferdig, kategorisert. STATUS-AKTUELT.md eier kun aktivt arbeid (maks 3 PR).
sist_verifisert_mot_kode: 2026-06-08
---

# Backlog

All planlagt-men-ikke-startet eller deprioritert arbeid samles her, slik
at STATUS-AKTUELT.md kan holdes kort (kun aktive PRs). Nye oppgaver
plasseres i riktig kategori. Når en oppgave startes, flyttes den til
STATUS-AKTUELT.md § Pågående arbeid; ferdige PRs flyttes videre til
`historikk-YYYY-MM.md` etter prod-deploy.

Legenda: 🔴 ikke startet · 🟡 delvis · ⏸️ parkert · ❓ trenger avklaring.

## 1. Teknisk gjeld

### 🔴 SIKKERHETS-GAP: `SheetMachine.vehicleId` (maskindrift) er IKKE org-validert

Oppdaget under Timer Fase 2-dual-review (2026-06-09). `SheetMachine.vehicleId` (drift/maskinfører-timer) skrives på `syncBatch` (`dagsseddel.ts` maskin-createMany), `redigerSedelRader` og `splittRad` **uten** å validere at maskinen tilhører firmaet. Samme cross-firma-lekkasje-klasse som §2.D dekket for det nye `SheetTimer.vehicleId` — men dette er **pre-eksisterende** (gjelder maskinbruk-raden, ikke kostnadsbæreren), og ble bevisst holdt utenfor Fase 2-scope.

**Konsekvens:** en klient kan teoretisk sende en `vehicleId` som peker på et annet firmas `Equipment`-rad. `Equipment` er svak FK (`db-maskin`, ingen `@relation`), så Prisma håndhever ingenting — org-isolasjon MÅ skje i app-lag. I dag mangler den på alle SheetMachine-skrive-stier.

**Foreslått fiks:** gjenbruk `verifiserKjoretoyTilhørerFirma(vehicleId, organizationId)` (`dagsseddel.ts`, innført i Fase 2 §2.D) på maskin-radene i `tilfoyMaskinRad`/`oppdaterMaskinRad`/`syncBatch`/`redigerSedelRader`/`splittRad` — samlet pr. unik ID, samme mønster som timer-stiene allerede bruker. Rent additiv logikk, ingen schema/migrasjon. **Ikke fikset her** (egen PR for sporbarhet — Fase 2 holdt seg til §2.D-scope).

### Pre-eksisterende typecheck-gjeld (mobil + web) 🟡

Fanget under R4-konsistens-sjekk (2026-06-11) — **ikke R-serie-introdusert** (R-serie-filer er rein; verifisert mot kode). Type-only, blokkerer **ikke** byggene (EAS = Metro/Babel uten `tsc`; web Next.js-build typesjekker ikke test-filer).

- **Mobil (~12 feil):** `erstattVedlegg` mangler i `UseOppgaveSkjemaResultat`/`UseSjekklisteSkjemaResultat` (`useOppgaveSkjema.ts:615`/`useSjekklisteSkjema.ts:594` — egenskapen finnes i runtime, type-interface usynket); `timerSync.ts:313/339` Drizzle-overload på `byggeplassId` (`string | null` vs insert-type); + følgefeil i `oppgave/[id].tsx`, `psi/[psiId].tsx`, `sjekkliste/[id].tsx`.
- **Web (1 feil):** `vitest`-modul mangler typer i `src/components/mengde/__tests__/import-hjelpere.test.ts` (test-tooling, ikke produksjonskode).

Fiks når noen rører de filene: synk hook-resultat-typene med faktisk retur, og gi `byggeplassId` riktig Drizzle-type / `vitest` til devDependencies+tsconfig. Lav prio — ingen runtime-effekt.

### `apps/mobile` mangler test-runner — rene utils udekket 🟡

`apps/mobile` har ingen test-runner (verken `test`-script, jest/vitest-config eller `*.test.ts`). Rene, logikk-tunge hjelpere er derfor udekket av automatiserte tester. Konkret fanget ved Slice 4a (2026-06-20): **`splittVedMidnatt`** (`apps/mobile/src/utils/dagsegment.ts`) ble kun manuelt verifisert (tsx-kjøring). Casene som bør dekkes når en test-beslutning tas: **nattskift 19→07 = 5t+7t=12t** (sum = reell total), **dagskift** (1 segment, uendret), **degenerert** (slutt ≤ start → ett 0-segment), **fler-døgn** (glemt-dag → N segmenter, sum = total). Vurder å **flytte den rene helperen til `@sitedoc/shared`** (web bruker allerede `vitest` — jf. `src/components/mengde/__tests__/`), evt. introdusere vitest i `apps/mobile`. Lav prio — ingen runtime-effekt, men midnatt-splitt er lønns-sensitiv logikk som fortjener regresjonsdekning.

### Følgesaker etter prod-deploy 2026-06-21

Fanget i avslutnings-auditen etter Slice 1–4 + reise + GPS L1 prod-deploy (`32b88bd7`).

- **🔴 EAS prod-bygg = GATE før mobil-prod (gjenstår — arbeidere kjører gammel app):** prod-deployen 2026-06-21 var server (API+web) KUN. ALLE mobil-endringene (auto-utkast/Slice 3, midnatt-splitt/4a, glemt-dag-prompt/4b-1, reise-cache/R4, GPS L1, attestering-badges) når IKKE arbeidernes telefoner før et **EAS prod-bygg + TestFlight/Play**. **Forutsetning:** enhetstest på fysisk enhet (Start/Slutt-dag, midnatt-splitt, glemt-dag-prompt, badges) — simulator er blokkert (NordVPN/IPv6 + Cloudflare↔Expo-Go-quirk). Enhetstest er gaten; ingen mobil-prod før den er grønn.
- **NorBERT `embed`/`oversettelse`-rebuild (gjenstår — krever Kenneth sudo):** bind-fix-koden (`NORBERT_HOST`) er merget til prod, men containerne ble bevisst IKKE gjenskapt i denne deployen (`--no-deps`). Rebuild + re-sjekk `REACHABLE` (3302) + innlogget AI-søk-verifisering = egen oppgave. Reconciler samtidig prosjektnavn (under).
- **Compose-prosjektnavn-reconcile (`docker` ↔ `sitedoc`):** kjørende prod-containere er prosjekt `docker`; `docker-compose.yml` har `name: sitedoc` → krever `-p docker` ved hver `compose`-kommando. Bestem ett navn permanent (down + up under riktig `-p`, eller dropp `name:`). Gjøres når NorBERT-rebuild uansett gjenskaper embed/oversettelse. Dok: [DOCKER-NOTES § Deploy-mekanikk](../../docker/DOCKER-NOTES.md).
- **`add_klasse4_indekser` finished_at NULL (lavprio):** `_prisma_migrations` viser `20260430120000_add_klasse4_indekser` med tom `finished_at` på prod. Avklart ikke-blokkerende (indeksene er anvendt, `migrate deploy` 2026-06-21 lyktes uten å snuble på den). Rydd raden (sett finished_at, eller resolve) når noen uansett er i prod-DB.
- **CLAUDE.md nær størrelsesgrense (39844/40k):** hovedfila er ~156 tegn under den ufravikelige 40k-grensen etter deploy-mekanikk-blokken. Trim ved neste anledning (flytt detalj til `docs/claude/`-filer, behold kun overordnede regler) før nye tilføyelser.
- **Slett `redesign-dagsseddel-funn-2026-06-20.md` (klar):** Slice 3/4-atferden er nå konsolidert i kanonisk [timer.md § Auto-generering av dagsseddel](timer.md) (2026-06-21) — funn-doken er merket KLAR FOR SLETTING og kan fjernes ved neste rens-pass (ikke slettet ennå for å beholde spor).
- Eksisterende (står fortsatt): web-parity T.12 (`TimerRadDialog`), DRIFT-1..5 (timer.md-rensing), arbeider-review arbeidstids-badge (§ Slice 4 over).

### Legacy eide prosjekter mangler `ProjectOrganization`-rad (datakvalitet) 🟡

Funnet under Timer Fase 1b-data-sjekk (2026-06-09). `admin.ts:266` + `prosjekt.ts:220-226` oppretter nå en `ProjectOrganization`-rad for eier-org ved prosjekt-opprettelse, men dette var en **senere bugfix** — prosjekter opprettet før den mangler raden, selv om de har `Project.primaryOrganizationId` satt. Verifisert mot test-DB: minst ett slikt prosjekt («Test redigert mal») med timer-rader. Prod kan ha tilsvarende (ikke sjekket).

**Konsekvens:** kode som avgjør firma-tilhørighet **kun** via `ProjectOrganization` (uten å falle tilbake på `primaryOrganizationId`) vil feilaktig behandle disse som ikke-firma-prosjekter. Fase 1b-helperen `verifiserProsjekterTilhørerFirma` dekker dette via union (eid ELLER koblet), men andre stier kan ikke ha samme beskyttelse.

**Foreslått fiks:** backfill-migrasjon som setter inn manglende `ProjectOrganization`-rader for alle `Project` med `primaryOrganizationId IS NOT NULL` som ikke allerede har en kobling for den orgen (idempotent `INSERT ... WHERE NOT EXISTS`). Da kan union-fallbacken på sikt forenkles til ren ProjectOrganization-sjekk. **Krever migrasjon → prod = LÅS + Kenneth.** Lav hast (1b-unionen holder timer trygg i mellomtiden).

### H3 — `allowDangerousEmailAccountLinking` reversert + signIn-guard — ✅ DEPLOYET TIL PROD 2026-06-05

✅ Arkivert til [historikk-2026-06.md § OAuth-innlogging: account-linking + orphan-guard + duplikat-opprydding](historikk-2026-06.md).

**Kort:** `allowDangerousEmailAccountLinking` reversert fra `false` (H3-audit 2026-05-27, prod-merge `9ca0257e`) til `true` (prod-merge `e12355d9`) — lar Google/Microsoft logge inn på samme konto via e-post; trygt fordi begge IdP-er verifiserer e-post-eierskap. Samtidig lagt til en **blokkerende `signIn`-guard** (`f6522a94`) som hindrer uinviterte pålogginger i å opprette tomme orphan-kontoer (a/b/c/d-regler, verifisert på test at `return false` hindrer User-opprettelse).

**Merknad — `User.email` er globalt unik** (`@unique`, ikke composite). `getUserByEmail`-overstyringen bruker `findFirst` med `canLogin=true` + eldste-først for determinisme.

**Mobil-guard** (`91fa7867`, prod-merge `f3a16cef`, 2026-06-05): tilsvarende orphan-guard lagt til i `mobilAuth.byttToken` med samme a/b/c/d-regler → `TRPCError FORBIDDEN` ved ingen match. **Både web- og mobil-OAuth er nå dekket.** (Account-linking på mobil håndteres allerede i `byttToken` via account-koblingen — ikke samme PrismaAdapter-mekanisme som web.)

### Sikkerhets-audit 2026-05-27 — alle høy-prio funn lukket ✅

Alle 14 funn fra sikkerhets-audit 2026-05-27 er adressert i prod. Se [historikk-2026-05.md](historikk-2026-05.md) for full arkiv.

| Funn | Prod-merge | Arkiv |
|---|---|---|
| K1 + M2 + M3 + M4 + H3 + error-håndtering | `9ca0257e` | [§ Sikkerhets-audit-bunke](historikk-2026-05.md) |
| M1 (global tRPC-rate-limit) | `54885eb2` | [§ M1](historikk-2026-05.md) |
| H2 (case-sensitive invitasjon-match) + Fastify-logger | `b97494cd` | [§ Fastify-logger + H2](historikk-2026-05.md) |
| H1 (mobil token-rotasjon) | `29bdded8` + fix `43460d80` | [§ H1](historikk-2026-05.md) |

**Sekundære oppfølgere (ikke kode-fix):**
- Sjekk eksisterende serverlogger for token-lekkasje før M4-redaction ble aktivert. Manuell loggevurdering.
- Permanent `deploy-test-cron.sh` → `pnpm build --force`-fiks. Server-side skript, ikke i repo. Rammet 3+ ganger i mai 2026, krever manuell `pnpm build --force` per deploy. Bør prioriteres for å redusere friksjon.
- **User.email-normalisering** (oppstått fra H2 2026-05-27) — PrismaAdapter + Auth.js OAuth-flyt skriver `User.email` med casing fra provider. To brukere med samme lowercase-e-post men ulik case kan eksistere som separate rader pga `@unique` er case-sensitive. Ikke aktuell utnytting kjent, men inkonsekvent med invitasjons-flyten som nå er lowercase. Bredere refaktor som krever migrering av `User.email` + adapter-override + verifisering av Google/Microsoft OAuth-flyt.

### Refaktor: web-tRPC-route — DEPLOYET TIL PROD 2026-05-27 (prod-merge `77e6553d`)

✅ Implementert via `lagContextStamme`-helper (Alternativ 1). Arkivert til [historikk-2026-05.md § lagContextStamme + B5](historikk-2026-05.md).

**Tilleggsforslag fortsatt åpent:** Server-side `deploy-test-cron.sh` skal feile hard på `pnpm build` exit ≠ 0 og IKKE kjøre `pm2 restart`. CLAUDE.md har regelen (commit `95ff4a07`), men cron-skriptet er server-side og ikke i repo. Krever manuell oppdatering av skriptet på `sitedoc`-serveren.

### Mobil hentMineMedlemskap — tom for sitedoc_admin + standalone-brukere — ✅ FIKSET + verifisert (build #29, 2026-06-02)

**Oppdaget 2026-06-01**, fikset + verifisert i TestFlight build #29 2026-06-02. Rotårsak: klienten gatet prosjekt-lasting på valgt firma (`enabled: !!valgtFirmaId`) → 0-firma-/uvalgt-firma-bruker hang på evig «Henter prosjekter…». Fiks: server-fallback (prod-merge `21555a5c`) + klient-fiks (`9e1bbf02`). Arkivert til [historikk-2026-06.md § Mobil hentMineMedlemskap-bug](historikk-2026-06.md).

**To-sporet problem:**
1. **Design-svakhet (bekreftet):** `organisasjon.hentMineMedlemskap` returnerer `[]` for brukere uten OrganizationMember-rad. Rammer brukere invitert via ProjectMember-bare og brukere på standalone-prosjekt. Mobil-flyten gater alle prosjekt-spørringer på `valgtFirmaId` → tom hjem.
2. **Sitedoc_admin runtime-mismatch (ikke avdekket):** Kenneth er sitedoc_admin, server skal returnere 3 firmaer, men klienten ser 0. Token er ferskt, endepunkt deployet, mobil-koden i build #27 = dagens develop. Krever enhets-logger fra build #28.

**Plan:**
1. Server-fiks: utvid `hentMineMedlemskap` til å inkludere `Organization` via `ProjectMember → Project.primaryOrganizationId` når `OrganizationMember.count === 0`. Konkret kode-skisse i STATUS-AKTUELT.
2. Diagnose-logging i `FirmaKontekst.tsx:71-78` (`console.log(firmaerQuery.data/error/isLoading)`) for build #28.
3. Begge endringer i samme PR til develop → server-fiks deployes til prod separat → mobil-bygg #28 til TestFlight.
4. Etter rotårsak avdekket fra enhets-logger: konkret runtime-fiks i oppfølger-PR.

**Bi-funn:** «Ukjent bruker»-meldingen ved utlogging (`mer.tsx:248`, `bruker?.name ?? "Ukjent bruker"`) er forventet kortvarig fallback når `setBruker(null)` rendres før navigation. Ikke en bug.

### Avklaring-modul — TE/Endring/Varsel statusflyt (høy prioritet)

> **Terminologi-rename 2026-05-28 (A.31):** Modul-konseptet tidligere kalt «Godkjenning» er omdøpt til **Avklaring** for å unngå kollisjon med status-verdien `"godkjent"` i `DocumentTransfer.toStatus`. Schema-rename (`model Godkjenning` → `model Avklaring`, `godkjenninger` → `avklaringer`) gjennomføres når modulen bygges. Se [fase-0-beslutninger.md § A.31](fase-0-beslutninger.md).

**Oppdaget 2026-05-26** ved sporing av Avklaring-modulens (tidligere «Godkjenning-modulens») faktiske implementasjon, og presisert med produktbeskrivelse fra Kenneth samme dag.

**Produktbeskrivelse (Kenneth 2026-05-26):** Avklaring dekker formell kommunikasjon mellom kontraktsparter i to relasjoner:

1. **Entreprenør → Byggherre:** Teknisk avklaring (TE) eller Økonomisk krav
2. **UE → HE (Hovedentreprenør):** Teknisk avklaring eller Økonomisk krav

Brukeren konfigurerer selv dokumentflyter per relasjon. Systemet dikterer ikke partsstrukturen.

Et dokument starter som **Teknisk avklaring** og kan eskalere til **Økonomisk krav** (Endring/Varsel) — men må bevare historikken fra original-dokumentet gjennom hele livsløpet.

**Manglende:**
- Statusprogresjonen TE → Endring/Varsel er ikke implementert.
- `Godkjenning`-tabellen i schema (`schema.prisma:984-1027`) har riktige felter (`externalCostObjectId`, `internRef`, `byggherreRef`, `kortNavn`, `godkjentVed`, `transfers` med kostnadsnapshot) men **ingen route bruker den**. NB: Tabellnavn omdøpes til `avklaringer` per A.31 når routen bygges.
- Avklaring-modulen lager i dag kun en vanlig `Task` fra GM-malen via `oppgave.opprett`. Den ekstra tabellen forblir tom og urørt.
- Verifisert i prod-DB 2026-05-26: «Godkjenning»-malen (GM, bygg) har 0 rader i `DokumentflytMal` — ingen mottaker-utledning fungerer. (Mal-navnet i prod-DB kan omdøpes til «Avklaring» som del av modul-leveransen.)

**Krever (i prioritert rekkefølge):**
1. **`avklaring.opprett`-route** + statusovergangs-logikk (TE → Endring/Varsel) med bevart referanse til original-dokument. Bygger på eksisterende `Godkjenning`-tabell (omdøpes til `Avklaring`) og `DocumentTransfer.kostnadsnapshot`-mønster.
2. **Samme modul-seeding-redesign som HMS:** utvid modul-aktivering til å seed maler + plassholder-flyter for de to standard-relasjonene (TE-til-byggherre, TE-til-HE) som brukeren kan justere.
3. **UI-skille:** Brukeren må kunne se Avklaring som egen dokumenttype (ikke vanlig oppgave) i opprett-modaler og listevisninger.

**Avhengighet:** Krever Kenneths produktbeslutning om eskalering-mekanikken (knapp i dokumentet? statusovergang via dokumentflyt? egen «Eskaler til Økonomisk krav»-handling?). Spec-runde anbefales før koding.

**Oppfølger:** Avklaring-hake i mal-builder (samme mønster som HMS-haken, `0278cfb3`) aktiveres når Avklaring-modulen er designet.

### HMS-modul redesign — DEPLOYET TIL PROD 2026-05-26/27 (prod-merge `69068ba0` + fix `c1fbc19f` + åpen-synlighet `c0c00374`)

✅ **Implementert.** HMS-modul-seeding (`dd491081`) + HMS-prosjektvisning (`69068ba0`) + subdomain-fix (`c1fbc19f`) + åpen-synlighet (`c0c00374`) dekker hele specen + synlighet-oppfølgeren. Detaljer i [historikk-2026-05.md § HMS-prosjektvisning](historikk-2026-05.md) + [§ HMS åpen-synlighet](historikk-2026-05.md).

**Status per del:**
- Modul-seeding: HMS-gruppe + HMS-flyt + mal-koblinger ✅
- SJA + RUH-maler i `PROSJEKT_MODULER` med subdomain/synlighet ✅
- HMS-spesialrute i `sjekkliste.opprett` (speil av `oppgave.opprett`) ✅
- Synlighet per mal (`hmsSynlighet: "privat" | "apen"`) + tilgangskontroll i `hms.hentDokumenter` (privat) og `verifiserDokumentTilgang` (åpen) ✅
- Mal-builder UI for subdomain + synlighet ✅
- HMS-prosjektvisning med KPI + 4 tabs + statistikk ✅
- Sidebar-element gated på `hms-avvik` ✅
- Fix-migrasjon for prefix-baserte subdomains (SJA/RUH som var feilklassifisert som avvik etter PR 1) ✅
- Prod-backfill kjørt for alle 3 HMS-aktive prosjekter ✅

**Gjenstående oppgaver (lav prioritet, eventuelle oppfølgere):**
- Web DokumentHandlingsmeny redesign for HMS-dokumenter — venter på mobil-bunke-verifikasjon (build #23). § 2 «Halvferdige features».
- Backfill-script kjørt på test, **IKKE på prod** — Kenneth tar beslutning. Prosjekter uten manuelt opprettede SJA/RUH-maler får dem KUN ved neste `modul.aktiver`-call eller manuell trigger.
- Statistikk-fane utvidelser (CSV/PDF-eksport, per-måned drill-down) — separat oppfølger ved kundeønske.
- Same-modul-seeding for Avklaring-modul (§ Avklaring-modul nedenfor) — generalisering vurderes ved den implementasjon.

### MASKIN-TIMER KOBLING — arkitektursvikt (høy prioritet)

Kenneth-avklaring 2026-05-16: Maskintimer er en del av arbeidsdagen,
ikke additivt. `sum(SheetMachine.timer) ≤ sum(SheetTimer.timer)` per sedel.

Nåværende feil: maskin og timer faktureres som to separate summer.
Korrekt: maskin er utstyrsbidrag av samme tidsperiode.

Krever:
1. Server-validering: `maskin.timer ≤ total worker.timer` ved opprett/oppdater
2. UI: vis maskin som underpost av timer-seksjonen, ikke separat
3. Attestering: `splittRad` på maskin bør validere mot timer-totalsum
4. Mobil: samme logikk

Tas i planleggingssesjon — ingen videre koding i mellomtiden.

Se [fase-0-beslutninger.md T.7](fase-0-beslutninger.md) for full spec (låst 2026-05-16) — flytskille arbeidstaker/attestering/Byggherre-godkjenning + dagsseddel-struktur per prosjekt+ECO.

### Innsender-tilgang — DEPLOYET TIL PROD 2026-05-27 (prod-merge `b3194f1d`, develop-commit `b4e53e17`)

✅ **Implementert.** `verifiserDokumentTilgang` utvidet med innsender/mottaker-gren rett etter firmaansvarlig (linje 451-460). `findUnique` for `bestillerUserId`/`recipientUserId` løftet til lokal helper, gjenbrukes av firmaansvarlig + innsender. Alle 17 kallsteder uendret. Slett-sikring håndheves fortsatt av `slett`-mutasjonens egen status-sjekk (`status !== "draft" && status !== "cancelled"`). Detaljer i [historikk-2026-05.md § Innsender-tilgang](historikk-2026-05.md).

### HMS-prosjektvisning teknisk gjeld (lav prioritet)

**Samlet fra HMS-PR-analyse 2026-05-27** etter prod-deploy. Seks kjente avvik som ikke blokkerer funksjon, men reduserer konsistens/skala:

1. **TS2589-workaround i `apps/web/src/app/dashbord/[prosjektId]/hms/page.tsx`** — imperativ `utils.client.X.mutate()` i stedet for `useMutation`-hook (kombinasjonen av `oppgave.opprett` + `sjekkliste.opprett` typegen pumpet for dyp etter `recipientGroupId`-utvidelse). Mister `isPending`/`error`-state og optimistic updates.
2. ~~**Plain HTML-tabell** brukt i HMS-side-tabellene i stedet for `@sitedoc/ui` Table.~~ ✅ DEPLOYET TIL PROD 2026-05-28 (prod-merge `12e19c0a`, arkivert til [historikk-2026-05.md](historikk-2026-05.md)). Tre HMS-tabeller (AvvikTabell, SjaTabell, RuhTabell) konvertert til delt `Table`-komponent. Gjelder både prosjekt-HMS og firma-HMS automatisk. Status-snarvei «Alle åpne» kun på AvvikTabell.
3. ~~**HMS-siden støtter byggeplass-filter innad i prosjektet.**~~ ✅ DEPLOYET TIL PROD 2026-05-29 (prod-merge `526db462`, impl `c3dc62c4`). `hms.hentDokumenter` utvidet med `byggeplassId: z.string().uuid().optional()`. Asymmetri Task vs Checklist (Task via `drawing.byggeplassId`, Checklist direkte). Prosjekt-brede dokumenter (`null`) inkluderes alltid. Klient sender `aktivByggeplass?.id` fra `useByggeplass()`. Cache-invalidering uendret.
4. **Statistikk-fanen aggregerer på klient.** `månederData`, `statusData`, `faggruppeData` regnes på klient fra `dokumenter.avvik`-arrayet. Hvis prosjekt har 1000+ HMS-avvik, blir søyler/bars trege. Server-aggregering kreves for skala.
5. **`useVerktoylinje`-pattern droppet** — HMS-siden bruker inline header med Ny-dropdown i stedet for global verktøylinje (oppgaver/sjekklister mønster). Funksjonelt OK, men inkonsistent.
6. **Modul-slug `hms-avvik` misvisende.** Slug-en var korrekt da modulen kun dekket HMS-avvik. Nå dekker den SJA + RUH også. Rename krever migrasjon + mobil-app-bakover-kompat-arbeid (mobil sender slug-en ved aktivering). Vurder ved neste modul-redesign.

**Vurderes som samlet oppfølger-PR** når kundefeedback indikerer behov, eller når Avklaring-modul-redesign trigger generalisering av modul-mønstre.

### Firma-nivå HMS-dashboard — aggregering på tvers av prosjekter ✅ FERDIG (alle 4 trinn deployet til prod 2026-05-29, prod-merger `526db462` + `eacdb40e`, arkivert til [historikk-2026-05.md](historikk-2026-05.md))

**Oppdaget 2026-05-29** ved gjennomgang av HMS-arkitekturen. HMS er i dag strikt prosjekt-isolert: én side på `/dashbord/[prosjektId]/hms/` per prosjekt, `verifiserProsjektmedlem`-gating på server, ingen firma-nivå-aggregering. Det finnes ingen ruter under `/dashbord/firma/` som matcher HMS, avvik, SJA eller RUH.

**Mål:** Firma-admin og HMS-ansvarlig skal se HMS-tilstand på tvers av alle firma-prosjektene fra ett sted — statistikk (åpne avvik per prosjekt, gjennomsnittlig saksbehandlingstid, SJA-frekvens, RUH-rate), prioritert handlingsliste (eldste åpne avvik, frister som nærmer seg) og felles behandling (kommentere/godkjenne uten å hoppe inn i hvert prosjekt).

**Skiller seg fra oppgaver/sjekklister:** HMS har juridisk + arbeidsmiljø-dimensjon som krever firma-overblikk (internkontroll-forskriften §5, NS 5814). Oppgaver og sjekklister er strengt prosjekt-brede per design — det er produksjon-/leveranse-styring uten tilsvarende kryss-prosjekt-mandat. HMS skiller seg.

**Filter-krav på firma-nivå:** Brukeren skal kunne filtrere HMS-hendelser på prosjekt og byggeplass. Default er «alle prosjekter, alle byggeplasser» — filter-velgere lar firma-admin/HMS-ansvarlig snevre inn til ett eller flere prosjekter, og videre til byggeplass(er) innenfor de valgte prosjektene. Filter-state gjenspeiles i URL slik at delbar lenke kan peke til «alle åpne HMS-avvik på Byggeplass A i Prosjekt X». Knyttes til samme byggeplass-felter som prosjekt-nivå-filter (asymmetri Task `drawing.byggeplassId` vs Checklist `byggeplassId`).

**Rolle-modell:** To separate HMS-roller:

1. **HMS-ansvarlig på firma-nivå** — ser alle prosjekters HMS-data, kan behandle fra firma-dashbordet. **Finnes ikke i kodebasen i dag.** Krever enten ny `OrganizationGroup`-type (gruppe-basert tilgang på firma-nivå, parallell til `ProjectGroup` på prosjekt-nivå) eller ny rolle på `OrganizationMember` (felt-basert, f.eks. `OrganizationMember.hmsAnsvarlig: boolean` eller utvidelse av eksisterende `role`-enum).
2. **HMS-ansvarlig på prosjekt-nivå** — `ProjectGroup` med `domains: ["hms"]`. Eksisterer allerede og er aktivt brukt i `byggHmsSynlighetsFilter` for å gi utvidet tilgang til private HMS-dokumenter.

De to rollene kan tilhøre ulike personer — firma-HMS-ansvarlig er typisk én sentral person eller HMS-koordinator, prosjekt-HMS-ansvarlig er prosjektspesifikk og kan rotere. Tilgangsmodellen må reflektere at firma-nivå-tilgang ikke automatisk gir prosjekt-nivå-tilgang og omvendt, men firma-HMS-ansvarlig får implisitt lese-tilgang til alle prosjekters HMS-data (eventuell sammenheng med `hmsSynlighet: "privat"` må avklares).

**Avhengighet for implementasjon:** Beslutning om OrganizationGroup vs OrganizationMember-rolle må tas FØR firma-HMS-dashbord bygges, ellers risikerer vi å skrive tilgangskontroll to ganger. **Vedtak 2026-05-29: OrganizationMember.firmaRoller += "hms_ansvarlig"** (utvidelse av eksisterende array, ingen schema-endring). Server-fundament implementert i Trinn 1 (`93970feb`) og Trinn 2 (utvidet `byggHmsSynlighetsFilter` + ny `hms.hentFirmaOversikt`). **Trinn 3** (klient-side: ny side `/dashbord/firma/hms/page.tsx` med filter, URL-state, 4 faner + statistikk-panel, samt refaktor av delte HMS-komponenter til `components/hms/`) implementert 2026-05-29. **Trinn 4** implementert på develop 2026-05-29: (Del A) `RedigerModal` + `InviterModal` i `firma/ansatte/page.tsx` har ny checkbox for `hms_ansvarlig`, grønn chip vises i tabellraden, `inviterBruker`-input utvidet med `erHmsAnsvarlig`; (Del B) ny `FirmaHurtigModal` + `hms.firmaBehandleAvvik`-prosedyre lar HMS-ansvarlig endre status + legge til intern kommentar på avvik direkte fra firma-dashbord uten flyt-rolle-validering. Drill-ned forblir hovedflyt. SJA/RUH får ikke hurtig-modal (ingen ChecklistComment-tabell — drill-ned er primær for dem).

**Konsekvenser for arkitektur:**
- Ny rute `apps/web/src/app/dashbord/firma/hms/` (planlagt under firmamoduler)
- Ny server-prosedyre `firma.hms.aggregerForOrganisasjon` eller `hms.hentFirmaOversikt`, gated på firma-admin / HMS-ansvarlig-rolle
- Behandling fra firma-nivå må navigere ned til prosjekt-detalj eller åpne modal i prosjekt-kontekst — felles vs. prosjekt-isolert tilgangskontroll må avklares
- Aggregering kan gjenbruke `hms.hentDokumenter` per prosjekt med `Promise.all` initialt, server-side aggregering for skala senere (jf. punkt 4 i HMS-prosjektvisning teknisk gjeld)

**Spec-beslutninger 2026-05-29:**

- **Behandling:** Full behandling fra firma-dashbordet — kommentere, statusendring og tildele utfører direkte fra firma-listen uten å forlate dashbordet. Server-prosedyrene som gjør disse handlingene må aksepteres uten prosjekt-kontekst, eller dashbordet kaller eksisterende prosjekt-prosedyrer med projectId hentet fra dokument-raden.
- **Synlighet:** Firma-HMS-ansvarlig ser alle HMS-dokumenter inkl. private (`hmsSynlighet: "privat"`). Likestilt med prosjekt-HMS-ansvarlig i tilgang. `byggHmsSynlighetsFilter` må utvides eller bypass-es når firma-HMS-rolle er aktiv. Tilgang logges som audit-spor.
- **Statistikk-KPI-er** (alle fire valgt):
  1. Åpne avvik per prosjekt (status ≠ closed/approved/cancelled, gruppert per prosjekt)
  2. SJA-frekvens per måned (siste 12 mnd, total + per prosjekt)
  3. RUH-rate per måned + trend (indikerer rapporteringskultur)
  4. Saksbehandlingstid median (dager fra opprettet til closed, per prosjekt + firma-total)

**Avhengighet:** Krever rolle-modell-beslutning (`OrganizationGroup` vs `OrganizationMember`-rolle) før implementasjon. Server-aggregering av statistikk skal være rask nok for firma med 50+ prosjekter — vurderes om Promise.all per prosjekt eller én rå-SQL-query. Fase 7-nivå arbeid; ikke startet.

**Eksisterende referanse:** Fase 7 § «HMS-statistikk på firma-nivå» nevner dette kort — denne entry-en utvider med konkret arkitekturskisse.

### Status-audit på tvers av dokumenttyper — UTFØRT 2026-05-27

✅ **Audit kjørt 2026-05-27.** Tre handlingsrettede tickets opprettet nedenfor (F1, F7, Tiltak 1). Andre funn (timestamp-felter for SLA, flyt-oppsett-validering, stuck-state ved manglende godkjenner-rolle, tooltip ved blokkert handling) ble vurdert som ikke-handlingsrettede uten produktbeslutning — tas opp ved Avklaring-modul-redesign eller kundefeedback.

**Sammendrag av kode-grunnlag** (verifiser mot kode FØR oppfølger-handling, kan ha endret seg):
- `DOCUMENT_STATUSES` (9 verdier) i `packages/shared/src/types/index.ts:4-14`.
- Tilstandsmaskin: `isValidStatusTransition` i `packages/shared/src/utils/index.ts:33`.
- Rolle-handling-matrise: `ROLLE_HANDLINGER` (bestiller/utforer/godkjenner) i `packages/shared/src/utils/statusHandlinger.ts:110-125`. Registrator får alle handlinger.
- Auto-overgang `sent → received` skjer i `endreStatus`-mutationen (oppgave.ts:1022 / sjekkliste.ts:923).
- HMS-modulen bruker samme statusflyt uten subdomain-spesifikk differensiering.

**Avhengighet:** Avklaring-modul-redesign (§ Avklaring-modul TE/Endring/Varsel) bør re-bruke disse fakta istedenfor å lage egen modell. Verifiser mot kode på det tidspunktet.

### F1 — `cancelled`-status mangler i HMS-filter — IMPLEMENTERT PÅ DEVELOP 2026-05-27

✅ **Fix:** `cancelled` lagt til i `LUKKET_STATUSER` i `apps/web/src/app/dashbord/[prosjektId]/hms/page.tsx:63`. Avbrutt er en endelig tilstand (samme semantikk som closed/approved), ikke en åpen. KPI-tellingen `apneAvvik` er uendret — vi vil ikke at avbrutte saker skal telle som åpne. Verifisering på test etter auto-deploy.

### F7 — HMS subdomain-spesifikk statusflyt (høy prioritet, krever spec-runde)

**Oppdaget under status-audit 2026-05-27.** Alle tre HMS-subdomains (Avvik, SJA, RUH) bruker samme generelle dokumentflyt — ingen subdomain-spesifikk håndtering på server eller i mal-builder.

**Antagelse om reell bruk per subdomain:**
- **SJA** (Sikker Jobb Analyse) — formell godkjenning er kjernen. Bør kreve `approved` før `closed`. I dag er hele flyten valgfri.
- **RUH** (Rapporterte Uønskede Hendelser) — primært rapport-orientert. Flyten `received → closed` direkte (uten responded/approved) er trolig vanlig praksis. I dag tvinges samme flyt som SJA.
- **Avvik** — full flyt er sannsynligvis korrekt.

**Krever (i prioritert rekkefølge):**
1. Produktbeslutning: skal hver subdomain ha hardkodet default-flyt eller fortsatt konfigurerbar per mal?
2. Hvis hardkodet default: utvid `mal.opprett` til å seede subdomain-spesifikk dokumentflyt med riktige roller. Mal-builder UI viser default-flyt med mulighet for overstyring.
3. Hvis konfigurerbar: legg til UI-advarsel i mal-builder ved subdomain SJA hvis flyten mangler `godkjenner`-rolle.

**Avhengighet:** Bør koordineres med F-tickets fra HMS-prosjektvisning teknisk gjeld (§ 1 over) og Avklaring-modul-redesign. Estimat 8-12t etter spec-runde.

### Tiltak 1 — «Alle åpne»-filter i oppgave/sjekkliste-filter — IMPLEMENTERT PÅ DEVELOP 2026-05-27

✅ **Fix:** Ny `filterSnarveier`-prop på `KolonneDef<T>` i `packages/ui/src/table.tsx` + render-blokk i `FilterDropdown` (rad rett under «Alle», visuelt skille med border-bottom). Klikk setter `filterVerdier[kolId] = verdier.join(",")`. Multi-select-mekanikken finnes fra før i page.tsx-filtrering.

Aktivert på status-kolonnen i oppgaver + sjekklister med snarvei `["draft", "sent", "received", "in_progress", "responded"]` (5 åpne statuser, ekskluderer `approved/closed/rejected/cancelled`).

HMS-siden bruker binær `visAlle`-toggle (annen UX-modell) som etter F1-fiks effektivt allerede er en «Alle åpne»-toggle — ikke endret.

i18n: ny `status.alleApne` i nb («Alle åpne») + en («All open»), auto-generert til 13 språk.

### Dokumentflyt send-modal redesign — DEPLOYET TIL PROD 2026-05-25 (prod-merge `4968a23c`)

**Status:** ✅ Implementert og deployet i én bunke (server-Commit 1 `584148b2` + mobil-Commit 2 `91bc235f` + i18n `495d3a37` → develop-merge `88d8299f` → prod-merge `4968a23c`). EAS iOS build #23 (`a5e6e2ea`) submittert til TestFlight (`898599df`). Fire kjente avvik fra spec dokumentert for enhet-testing. Detaljer i [historikk-2026-05.md § Dokumentflyt send-modal redesign](historikk-2026-05.md). Spec under beholdes for referanse til hva som ble låst før implementasjon.

**Oppdaget 2026-05-25** ved gjennomgang av mobilens `DokumentHandlingsmeny.tsx`. Gjelder både oppgave og sjekkliste (samme komponent). Spec låst 2026-05-25, utvidet samme dag.

**Problemet:** Dagens send-modal blander fire konseptuelle kategorier i én flat ActionSheet-liste uten visuell separasjon (flyt-progresjon i aktiv flyt / flyt-bytte til annen flyt / godkjenner-respons / admin-livssyklus). Brukeren mangler kontekst om HVOR de er i flyten. ⚙ brukes som separator for admin, semantisk feil.

**Kjerneinnsikt:** Flyten må visualiseres permanent i detaljsiden med brukerens egen boks markert. Trykk på en boks åpner popup med tilgjengelige STATUSER for den retningen — status er primær-handlingen, ikke et generisk «Send hit».

#### Låst design

1. **Flyt-bokser alltid synlig i detaljsiden** — fargede bokser (`Faggruppe.color`) uten tekst, brukerens boks markert med ring/aktivt-indikator. Bunn-bar erstattes; bokse-raden er den nye primær-handlings-UI-en.
2. **Trykk på boks → popup med tilgjengelige STATUSER** (ikke «Send hit»-knapp). Hver tilgjengelig status er en separat knapp. Eksempler:
   - Nabo-boks fra status `received`: `[Send hit]` (→ `sent` til nabo)
   - Nabo-boks fra status `in_progress`: `[Send videre]` + `[Send tilbake]`
   - Egen boks med status `responded`: `[Godkjenn]` + `[Avvis]` (statusforespørsler — handle på egen ballen)

   Status bærer semantikken; mottaker styres deterministisk av flyt-oppsett. «Send hit»-knappen er fjernet.
3. **Bekreftelses-modal etter status-valg** — «Ønsker du å sende og bytte til [ny status]?» + valgfritt kommentarfelt + Bekreft/Avbryt. To-trinns-flyt: boks → status → bekreft.
4. **Ingen tekst under boksene** — boksnavn vises kun i popup ved trykk. Bevisst minimalisme.
5. **Mottaker styrt av flyt-oppsett** — `recipientUserId`/`recipientGroupId` utledes fra boksens hovedansvarlig-medlem (markert med stjerne i popup'ens medlems-liste). Bruker velger ikke mottaker.
6. **Admin-handlinger bak `⋯`-meny** — Lukk, Gjenåpne, Trekk tilbake skjult under «⋯»-knapp ved siden av bokse-raden. Synlig kun for `minRolle === "registrator"` eller `erFirmaAdmin`. Bryter dagens mønster med ⚙-prefiks.
7. **Flyt-bytte = egen nedtrekksmeny** ved siden av bokse-raden, synlig kun for brukere som er medlem av minst én annen dokumentflyt på samme dokumenttype. Velg flyt → oppgaven flyttes dit og **lander hos brukerens egen boks i den nye flyten** (ikke vilkårlig mottaker). Bekreftelses-modal: «Oppgaven flyttes fra [flyt A] til [flyt B]. Forrige flyt forlates.»
8. **Layout-regler:**
   - ≤4 bokser: én rad
   - ≥5 bokser: to rader med wrap (lese-rekkefølge venstre→høyre, ikke U-form)
   - Pil-konnektor mellom siste på rad 1 og første på rad 2
9. **Skip-over (ikke-nabo-trykk) tillatt** — samme popup-flyt som nabo-trykk. Bekreftelses-modalen i punkt 3 fungerer som safeguard; ingen ekstra mellom-bekreftelse trengs.
10. **Android = custom RN Modal** — ingen `ActionSheetIOS`, ingen plattform-spesifikk `Alert`. Samme komponent på iOS og Android (samme mønster som `FirmaVelger`/`ProsjektVelger`).

#### Fortsatt åpent (detalj-spørsmål, ikke blokkerer implementasjon)

- **`approved`/`closed`-tilstand:** Skal flyt-boksene grå-tones som «lukket flyt» eller forbli trykkbare for «videresend som referanse»? Dagens server flytter oppgaven mellom flyter også fra approved/closed via `forwarded`-mekanisme. Foreslått retning: grå-toning + trykkbart, popup viser tilgjengelige statuser (typisk kun «Send som referanse») med klar advarsel om at oppgaven flyttes over. Avklares ved implementasjon.

#### Tilgangs-utvidelse i samme runde

`endreStatus` server-regel utvides — dagens regel tillater kun `admin`/`registrator` å bytte flyt. Utvides til også å tillate:
- «Har ballen» (`userId === recipientUserId` eller medlem av `recipientGroup`)
- «Cross-flyt-medlem» (medlem av både gammel og ny flyt) — tett knyttet til at flyt-bytte lander på brukerens egen boks i ny flyt

Skip-over-nabo: tillatt for alle med flyt-tilgang. Server validerer ikke retning — det er en UX-konvensjon styrt av bekreftelses-modalen.

#### Berører

- `apps/mobile/src/components/DokumentHandlingsmeny.tsx` — full omskriving til boks-basert komponent med statusvalg-popup
- `apps/mobile/src/components/FlytIndikator.tsx` — sannsynligvis innlemmes i ny komponent (`byggLedd` blir delt helper)
- `apps/api/src/routes/oppgave.ts` — ny `hentTilgjengeligeFlyter`-prosedyre + utvidet `endreStatus`-tilgangs-validering
- `apps/api/src/routes/sjekkliste.ts` — speilet endring
- `packages/shared/src/utils/statusHandlinger.ts` — kilde for tilgjengelige statuser per boks. Mobil bør konsumere `hentRolleFiltrertHandlinger` (i dag dupliserer den logikken lokalt).
- `packages/shared/src/i18n/*` — nye nøkler: bekreftelses-tekst, popup-tittel, flyt-bytte-tekst, admin-meny-elementer
- Server-tilgangskontroll-helper for å sjekke flyt-medlemskap

#### Estimat

Server ~45 min, mobil-UI ~5 timer (oppgave, ny boks-komponent med statusvalg-popup), sjekkliste ~30 min (gjenbruk). I18n auto-oversett. Totalt ~7 timer Opus-arbeid + EAS-bygg.

### Datamodell og migrasjon

- **P-KRITISK-1 — Sentralbiblioteket ikke seedet i prod** 🔴 — se [oppryddings-plan-2026-04-28.md § P-KRITISK-1](oppryddings-plan-2026-04-28.md). Lovpålagt grunnpakke skal auto-seedes ved firma-opprettelse.
- ~~**P-KRITISK-2 — `FtdChangeEvent` og `FtdTnotaChangeLink` mangler i prod**~~ ✅ DEPLOYET — migrasjon tilført i `4f32d702 fix(migrations): tilføy FtdChangeEvent + FtdTnotaChangeLink-migrasjon` (merget til main via `29a3733f`). Verifisert 2026-05-28 mot kode + git-historikk. Entry var hjemløs drift fra før prod-deploy.
- ~~**P-KRITISK-3 — `BibliotekMal` mangler 4 fase-0-besluttede felt**~~ ✅ DEPLOYET — alle 4 felt (`kategori`, `domene`, `kobletTilModul`, `verifisert`) lagt til i `29311756 feat(db): Fase 0 § E steg 8 — BibliotekMal-utvidelse`. Verifisert 2026-05-28: `packages/db/prisma/schema.prisma` har feltene; commit er i main. Entry var hjemløs drift.
- **DB-naming-audit alias-rydding** 🟡 — etter mobil-app-oppdatering kan alias-feltene fjernes. Se [db-naming-audit-2026-04-25.md](db-naming-audit-2026-04-25.md).
- **Cross-package svake FK orphan-deteksjon** 🔴 — `db-maskin` referer til `User.id` via String uten cascade. Backlog-oppgave per [arkitektur-syntese.md § 6.1](arkitektur-syntese.md).
- **Organization vs OrganizationPartner — strategi D (DB-cleanup, 6-8t)** 🔴 — skall-firmaer i test-DB. Strategi C `Organization.erKunde` implementert 2026-05-03. Audit per rad gjenstår.

### Refaktor og rydding

- **40 åpne P-oppgaver i [oppryddings-plan-2026-04-28.md](oppryddings-plan-2026-04-28.md)** 🟡 — P2 faggruppe-rename, P3 drift-detaljer, P4 Kenneth-drøftinger, P5 svakhet-reparering.
- ~~**Firma-administrasjons-navigasjon strukturell rydding (~10-12t)**~~ ✅ FERDIG — audit utført 2026-05-28. Alle tre lag i mål: (1) rename «Firmainnstillinger» → «Prosjekteier» (`f3b8bb1a` + `e7168b32`), (2) firma-relevante server-ruter har `organizationId`-input (organisasjon 15/22 — 7 manglende er bruker-spesifikke queries; avdeling, kompetansetype, kalender, lonnsart, aktivitet, tillegg, vare, vareKategori 100%; kompetanse `opprett`/`oppdater`/`slett` utleder org via `verifiserKompetanseSkriveTilgang` per design, ikke bug; vareImport 2/2 — telle-feil i tidligere audit), (3) 10/10 firma-sider bruker `useFirma()` (kun stub-siden `fakturering` mangler, og den får det naturlig når den implementeres). Opprinnelig «~10-12t»-estimat var foreldet — reelt arbeid skjedde gradvis gjennom Blokk A-C + andre PRs.
- ~~**Header-koordinering: firma-bytte nullstiller ikke prosjekt**~~ ✅ LØST — verifisert mot kode 2026-05-27. `prosjekt-kontekst.tsx:101-114` har auto-reset useEffect (P1 Fase 2, 2026-05-05). `byggeplass-kontekst.tsx:70-79` har defensiv cleanup ved firma-bytte. Entry-en var hjemløs drift fra før P1 Fase 2-deploy.
- **Nye integrasjonstester for `tilgangskontroll.ts`** 🔴 — etter O-5c er gammel test-fil slettet (16/22 broken). Integrasjonstester mot test-DB med OrganizationMember-fikstur er planlagt.
- **Activity-logging — aktivere `activity_log` for tilstandsendringer** 🔴 — `activity_log`-skjema finnes (15 kolonner, payload jsonb, retention-felter, anonymisering) men **ingen kode skriver til tabellen**. Bekreftet 2026-05-28: 0 rader siste 24t, ingen spor av template-sletting eller tilgangs-endringer. **Note — dokumentflyt-domenet er allerede dekket:** `DocumentTransfer`-tabellen (`schema.prisma:1029-1060`) logger juridisk audit-trail for alle status-overganger (draft→sent→received→responded/godkjent), kommentarer, faggruppe-snapshots og kostnad-snapshot. `TaskComment` dekker frittstående kommentarer, `ChecklistChangeLog` dekker sjekkliste-felt-endringer, og fra 2026-05-29 dekker `TaskChangeLog` task-felt-endringer (opt-in via `enableChangeLog`). Disse skal IKKE replikeres til `activity_log` — Activity dekker det som ikke har egen audit-mekanisme i dag. **Implementasjonsrekkefølge (mangler i dag):** (1) **template-CRUD** (`report_templates`) — opprettelse/endring/sletting (akutt etter Florian-k-avv-mysteriet 2026-05-28: hard-delete uten spor), (2) **`project_members`-endringer** (role, kanAttestere, erFirmaansvarlig — tilgangs-kritisk), (3) **`groups`/permissions** (permission-endringer er audit-kritiske), (4) **hard-delete generelt** via Prisma middleware som sikkerhetsnett for alle modeller. **Arkitektur-skisse (5 dager):** Hybrid Prisma middleware + eksplisitt tRPC-skriving, AsyncLocalStorage for userId-context, whitelist per modell, retention 18 mnd via PM2 cron. Erstatter T7-2b3 før/etter-snapshot-utvidelse (samme tabell, samme infrastruktur).
- ~~**TaskChangeLog — audit-trail for felt-endringer på oppgaver etter sending**~~ ✅ DEPLOYET TIL PROD 2026-05-29 (prod-merge `fff9daf4`, impl `6d6e2321`). Arkivert til [historikk-2026-05.md § TaskChangeLog](historikk-2026-05.md).
- **UI-cache-forsinkelse ved gruppe-oppdatering** 🟡 — React Query oppdaterer ikke andre brukeres sesjoner ved DB-endring (gruppe-permissions, ProjectMember-rolle etc.). Bruker som er midt i en sesjon ser gammel rolle-state inntil window-focus eller manuell refresh. Kjent begrensning av React Query sin per-klient-cache-modell. Mulige fremtidige løsninger: kortere `staleTime` på gruppe-queries (offer mot ekstra server-trafikk), optimistisk invalidering via WebSocket/SSE-broadcast ved gruppe-endring, eller polling-interval på sentrale tilgangs-queries. Ikke prioritert — tas opp ved kundefeedback eller når impersonerings-tilgangs-oversikt-UX-sesjonen drøftes.
- ~~**Returnert→pending-reset ved `sendTilAttestering`**~~ ✅ Implementert 2026-05-27 på develop. `send`-mutation i `dagsseddel.ts:931` utvidet med betinget `$transaction` som nullstiller returnerte rader til pending ved re-send. Backfill-SELECT mot prod-DB ga 0 rader — ingen migrasjon nødvendig.
- ~~**HMS-prefix-UX-felle — amber-hint i mal-modal**~~ ✅ DEPLOYET TIL PROD 2026-05-30 (prod-merge `765e060e`, impl `8d517732`). Arkivert til [historikk-2026-05.md § Subdomain↔category-validering + HMS-prefiks amber-hint](historikk-2026-05.md).
- ~~**Subdomain↔category-sammenheng-validering**~~ ✅ DEPLOYET TIL PROD 2026-05-30 (prod-merge `765e060e`, impl `8d517732`). Server-validering med mapping `avvik+ruh → oppgave, sja → sjekkliste` (konsistent med 2026-05-29-redesign). Feilmelding: «SJA bruker sjekkliste-format. Avvik og RUH bruker oppgave-format.» Arkivert til [historikk-2026-05.md § Subdomain↔category-validering + HMS-prefiks amber-hint](historikk-2026-05.md).
- **MalbyggerV2 — fire-fane redesign (`MalListeV2.tsx`)** 🔵 **UTSATT** — Frafalt inntil videre — fokus på å rydde opp dagens problemer (HMS/oppgave-konsistens, sammenheng subdomain↔category, send-modal-flytvalg). Vurderes på nytt etter HMS/oppgave-rydding er komplett. *(Opprinnelig skisse: Ny komponent på `/dashbord/oppsett/produksjon/maler-v2` bak feature-flag, fire faner Oppgave | Sjekkliste | HMS | Avklaring. Begrunnelse: dagens UI blander to akser, fire-fane-modell gjør valgene visuelt likestilt og forberedt på Avklaring som tredje kategori. Forutsetter: avklare om HMS skal være egen fane eller filter, og at Avklaring-modul er spesifisert. Minimal-fiks (HMS-checkbox-gate) deployet 2026-05-29.)*

### Mobil og sync

- **Pre-eksisterende timerSync.ts baseline-feil (linje 308, 334)** 🟡 — `string | null` mot lokal `.notNull()`. Akseptert som baseline, ikke prioritert.

- **Full scheme-separasjon for app variants (oppfølger til app-variants 2026-06-12)** 🟡 — App-variants (del B, 2026-06-12) gir test-bygget eget `ios.bundleIdentifier` (`com.kemyrhau.sitedoc.test`) via `app.config.js`, men `scheme` ("sitedoc") + `android.package` holdes DELT fordi `apps/mobile/src/services/auth.ts:84` hardkoder `makeRedirectUri({ scheme: "sitedoc" })`. Konsekvens: «SiteDoc TEST» og prod-«SiteDoc» deler URL-scheme → iOS-udefinert hvilken app som fanger OAuth-redirect hvis begge er installert. For ekte isolasjon: (1) gjør `scheme` betinget i `app.config.js` (`sitedoc-test` på APP_VARIANT), (2) la `auth.ts:84` lese scheme fra config i stedet for hardkoding, (3) registrer `sitedoc-test://`-redirect i Google OAuth-klient. Lav prio — praktisk workaround er å ikke kjøre OAuth i begge apper samtidig. Se [eas-build-veileder.md § App variants](eas-build-veileder.md).

### Attestering-rediger-flyt — inkonsistens (oppdaget 2026-05-17, LØST 2026-05-17 via T7-5d)

**Status:** ✅ Adressert. T7-5d (merge `9727c7f9` på develop) erstatter RedigerSeddelModal med RedigerRadModal. Penn-klikk åpner nå kun prosjekt+ECO-bucken, ikke hele sedelen i side-i-modal. AttesteringDetalj renset for modal-spesifikke props. Detaljer i [STATUS-AKTUELT.md § T7-4g + T7-5d](STATUS-AKTUELT.md).

Original diagnose beholdt under for historikk.

---

### Attestering-rediger-flyt (original diagnose)

**Stop og planlegg.** Etter T7-4f-bunken har vi to overlappende redigeringsstier som skaper forvirring. Diagnose og anbefalt arkitektur:

#### Hva skjer teknisk etter penn-klikk i SeddelKort

Penn-ikonet er en `<Link>` til `/dashbord/firma/timer/attestering/[id]?rediger=1`. Next.js gjør full sidebytte til detalj-siden (`apps/web/src/app/dashbord/firma/timer/attestering/[id]/page.tsx`), som monterer `AttesteringDetalj`. `useSearchParams()` leser `?rediger=1` og setter `redigerModus=true` via `useEffect` — **men kun hvis `sheet.redigerTillatt=true`**.

`sheet.redigerTillatt` kommer fra `OrganizationSetting.tillattRedigerVedAttestering`, **default `false`**. Hvis firmaet ikke har slått den på, ignoreres `?rediger=1` og siden vises read-only med en liten advarsel-banner.

#### Hva mangler i edit-modus-flyten

**Teknisk:** ingenting. Lagre-knapp (`AttesteringDetalj_Edit.tsx:481`), avbryt-knapp (linje 478), cache-invalidering — alt finnes.

**UX:**
- `redigerTillatt=false` → penn-ikonet «lyver». Brukeren ser ingen åpenbar tilbakemelding på hvorfor edit ikke aktiveres.
- Etter lagring blir bruker stående på detalj-siden i read-only. Forventer retur til listen.
- Ingen toast/badge på listen som bekrefter at sedelen ble endret.
- Edit-modus krever hele sedelen lastet — per-rad-edit-løfte fra penn-ikonet er overdrevet.
- Detalj-siden duplikerer ✓/↩-knappene fra listen — to måter å gjøre samme attestering på.

**Brukerens nåværende vei fra «vil endre én rad» til «endring lagret»:** 8 steg (klikk penn → vent navigasjon → sjekk redigerTillatt → endre → lagre → vent → klikk tilbake → se listen).

#### Korrekt arkitektur — anbefaling: **Modal overlay (Alternativ B)**

| Alternativ | Vurdering |
|---|---|
| A: Inline i listen | ❌ Liste-state blir kompleks. 50+ sedler × edit-state. Kataloger queries multipliseres per kort. Ytelse-risiko. |
| **B: Modal overlay** | ✅ Beholder list-kontekst. Gjenbruker `AttesteringDetaljEdit`. Lukk = umiddelbar retur. Per-rad-attestering fungerer i bred modal. |
| C: Sidebytte (dagens) | ❌ Tar bruker ut av list-kontekst (Kenneths hovedklage). Duplikate knapper. 8 steg. |

**Implementasjons-skisse (planlagt som T7-5b):**
- SeddelKort: penn-klikk åpner modal i stedet for å navigere
- Ny `<AttesteringDetaljModal>`-wrapper rundt eksisterende `AttesteringDetalj`-komponent
- `?rediger=1`-mønsteret avvikles for liste-bruk (kan beholdes for direktelink hvis aktuelt)
- Detalj-siden beholdes for bokmark/e-post-deeplinking, men blir tertiær

**Krever før implementasjon:**
1. Avklar om `tillattRedigerVedAttestering` skal være default `true` for nye firma (i dag default `false`)
2. Avklar om listens ✓/↩-knapper og modalens per-rad-checkboxer skal forenes til ett mønster
3. Vurder om detalj-siden bør slankes til kun det den gjør bedre enn modalen (per-rad multiselect, inline rediger), og fjerne det som duplikerer listen

**Status 2026-05-17:** T7-5b-1..4 + B-fixes implementert og deployet til test (se STATUS-AKTUELT.md). T7-5c (sammenheng-håndtering i splitt) åpen. Plasseres i `historikk` når hele bunken er deployet til prod.

### Kompakt sedel-layout — utnytt skjerm bedre (oppdaget 2026-05-17, ✅ T7-4g 2026-05-17)

**Status:** ✅ Forslag 1 implementert. T7-4g (merge `5c6347d9` på develop) reduserer SeddelKort-header til én linje (~48px) med default-kollapsing. Auto-expand ved tilleggHarKrav eller mertid. Action-rad fjernet. Detaljer i [STATUS-AKTUELT.md § T7-4g](STATUS-AKTUELT.md).

**Gjenstående:**
- Forslag 3 (periode-presets + faner + paginering) — egen oppfølger T7-4h
- Forslag 2 (view-toggle [Kort]/[Tabell]) — vurder etter Forslag 3

### B_ny / T7-5f — Lagre-knapp grå→grønn — DEPLOYET TIL PROD 2026-05-23 (prod-merge `c2792f28`, impl `e7ac0f83` + utvidelse `f0e1a740`)

✅ Implementert på både `AttesteringDetalj_Edit.tsx:296-305, 487-499` (`harUlagredeEndringer`-memo + grønn className når dirty) OG `RedigerRadModal`. Tidligere arkiv-commit `be73e2c6`. Entry var hjemløs drift som ikke ble fjernet etter prod-deploy.

### T7-5e — Attestert-filter på attestering-listen — DEPLOYET TIL PROD 2026-05-20 (prod-merge `cc8f0067`, impl `c523323a`)

✅ Implementert. Fane-toggle `[Venter ●N] [Attestert ●M]` over uke-navigasjon, to parallelle queries, `readOnly`-prop til SeddelKort + ProsjektGruppe, i18n-nøkler `timer.attestering.fane.{venter,attestert}` i 15 språk. Tidligere arkiv-commit `8aa664cb`. Entry var hjemløs drift som ikke ble fjernet etter prod-deploy.

### Pause-modell på timer-rad — IMPLEMENTERT 2026-05-18 (pauseFra/pauseTil i daily_sheets)

**Faktisk implementasjon på develop 2026-05-18:** Pause med eksplisitt fra/til-vindu på sedel-nivå, ikke inline checkbox uten tider. Mer ambisiøst enn opprinnelig MVP-vedtak fordi maskin-validering for døgn-utleide maskiner (Heatwork-mønster) krevde å vite pause-lengde for invariant-justering.

**Schema (`packages/db-timer/prisma/schema.prisma`):**
- `DailySheet.pauseFra: String?` og `DailySheet.pauseTil: String?` (HH:MM, nullable). Migrasjon `20260517220000_add_pause_fra_til`.
- `pauseMin` beholdt som denormalisert sum for raskt oppslag. Server beregner `pauseMin = Math.round((pauseTil - pauseFra) / 60)` ved hver oppdatering.

**Klient-flyt (RedigerRadModal):**
- Checkbox auto-hukes ved overlap mellom rad.fraTid/tilTid og sheet.pauseFra/pauseTil.
- Klikk på checkbox når ingen pause finnes lager default 30 min midt i rad-intervallet (se § Pause-default).
- `beregnTimerMedPause(fraTid, tilTid, pauseFra, pauseTil)` returnerer `(til-fra) - pauseMin/60` ved overlap.
- Sheet-level state — endring fra én rad reflekteres på alle overlapp.

**Server-validering (utvidet):**
- `validerMaskinUnderArbeid(timer, maskin, pauseMin)` — pause-buffer på maskin-invarianten (se § utleie_enhet-prinsipp).
- `redigerSedelRader`-mutation aksepterer `pauseFra/pauseTil` i input + oppdaterer DailySheet i samme transaksjon.

**Bakgrunn (opprinnelig analyse):** Pause-data-analyse på 3 sedler i test-DB viste tre ulike praksiser (gap mellom rader / pause trukket fra første timer-rad / pause trukket fra maskin-rad også). Sedel B brøt maskin-timer-koblingen. Eksplisitt pause-vindu var nødvendig for å gi maskin-validering riktig kontekst.

**Kjente begrensninger — se egne seksjoner:**
- Stille overskriving av manuelt-justert rad.timer (T7-5h)
- Default pause-vindu er midtpunkt — bør være firma-konfigurerbar
- Multi-rad-overlap ikke server-validert
- utleie_enhet-prinsipp ikke håndhevet i UI ennå

### T7-5h — Stille overskriving av manuelt-justert rad.timer — DEPLOYET TIL PROD 2026-05-28 (prod-merge `6fd294d1`)

✅ Arkivert til [historikk-2026-05.md § T7-5h](historikk-2026-05.md). Scope: kun web. Mobil-komponenter har separat recompute-logikk og er ikke berørt — egen sub-PR ved behov.

### Pause-vindu default — DEPLOYET TIL PROD 2026-05-28 ✅ (prod-merge `75a09ccf`, arkivert til [historikk-2026-05.md](historikk-2026-05.md))

### Multi-rad-overlap pause — ikke håndtert (oppdaget 2026-05-18)

Hvis flere timer-rader overlapper samme pause-vindu (f.eks. 07:00–12:00 + 11:30–15:00 med pause 11:45–12:00), trekkes pause-min fra hver rad isolert i `beregnTimerMedPause`. Server-validering (`validerMaskinUnderArbeid` med pauseMin-buffer) regner pause kun én gang per bucket — det er konsistent for invarianten, men klient-summering kan vise dobbel-trukket pause.

Sjeldent i praksis (typisk én sammenhengende rad per dag), ikke server-blokk. Vurdere om recompute bør splitte pause-fradraget på tvers av overlappende rader, eller om det er en arbeider-feil å registrere overlappende rader uten å selv justere pause.

### utleie_enhet-prinsipp som styrende for maskin-validering (vedtatt 2026-05-18)

**Vedtak:** `equipment.utleie_enhet ∈ {'doegn', 'time'}` er det styrende skillet for hvordan maskin-timer relaterer seg til arbeidstimer — ikke et hypotetisk «kreverForer»-flagg eller «mannsbetjent vs autonom»-konsept.

**Bakgrunn (verifisert mot test-DB 2026-05-18):**
- `maskin.equipment`-tabellen har ALLEREDE feltene `er_utleieobjekt: boolean`, `utleie_enhet: text` ('doegn' | 'time'), `utleiepris_per_dogn`, `utleiepris_per_time`.
- Det finnes **ikke** noe `krever_foerer`-felt. Tidligere foreslåtte spesialtilfeller (Heatwork som «autonom», CAT 320 som «mannsbetjent») var gjettet uten datagrunnlag.

**Konsekvens for maskin-invariant per (projectId, ECO)-bucket:**
- `utleie_enhet = 'doegn'`: maskin går mens operatør pauser → invariant tillater `maskin ≤ arbeid + pauseMin/60`. Heatwork 7626 (9.00t maskin / 8.50t arbeid + 0.50t pause = 9.00t) er innenfor.
- `utleie_enhet = 'time'`: maskin styres av operatør → faller naturlig under `maskin ≤ arbeid` (pause-buffer brukes ikke fordi maskin pauser når operatør pauser).
- `er_utleieobjekt = false`: intern bruk, ikke fakturert utleie — invariant gjelder uansett som baseline.

**Implementasjon-status 2026-05-18:**
- Server-invariant er utvidet med `pauseMin`-buffer universelt (`validerMaskinUnderArbeid` tar pauseMin). Maskin-utleie-enhet brukes ikke i invariantsjekken — gjelder for alle.
- UI-info-warning i `KompaktMaskinRad` viser fortsatt «⚠ Maskintimer overstiger arbeidstimer» når over arbeidstimer, uten å hensynta `utleie_enhet`. Ikke blokker, men kan misforstås for døgn-utleide.

**Åpne avklaringer:**
- Skal invariant være ulik for `utleie_enhet='time'` (strengere: `maskin ≤ arbeid`, ingen pause-buffer)? I så fall: kreves split av sjekken per maskin-rad basert på equipment-data.
- Skal UI-warning skjules for `utleie_enhet='doegn'`-rader når maskin > arbeid (forventet)?

**Foreslås som styrende prinsipp i fase-0-beslutninger.md.**

### B5 — Sum-indikator (maskin-av-arbeid) i SeddelKort — DEPLOYET TIL PROD 2026-05-27 (prod-merge `f7a836f8`)

✅ Implementert. Grønn/rød badge med samme invariant som EcoBucketAttest (inkl. pause-buffer per T.7 2026-05-18). Auto-expand-trigger utvidet med `maskinOver`. Arkivert til [historikk-2026-05.md § lagContextStamme + B5](historikk-2026-05.md).

### Detalj-siden vs modal — slankhetsvurdering (vedtatt 2026-05-17)

Detaljsiden beholdes fullt funksjonell (sammenheng-prinsipp krever det). Reverserer tidligere skissert slanking. Detaljsiden er riktig sted for kompleks redigering der sammenhenger må vurderes (multi-rad-utvalg på tvers av ECO, full sedel-overblikk).

### i18n: pause-drift (fr + de/sv/et) — ✅ DEPLOYET TIL PROD 2026-05-27 (prod-merger `baa462e1` + `d8b60854`)

Auto-oversettings-skriptet forvekslet engelsk «break» (pause) med «break» (knekke/avbryte) på fire språk. Fikset i to runder:

- **fr** (prod-merge `baa462e1`, impl `da0b2aad`): label «Casser» → «Pause», toggleHint «saut» → «pause», intervall «rupture» → «pause», maskinAvArbeid-formulering forbedret. Arkivert til [historikk-2026-05.md § Returnert→pending-reset + fr.json](historikk-2026-05.md).
- **de/sv/et** (prod-merge `d8b60854`, impl `eae412c0`): samme mønster fikset på tysk («Brechen» → «Pause»), svensk («Bryta» → «Paus» + hint «avbrott» → «paus»), estisk («Katkesta» → «Paus»). Audit-funn via pre-compact dokumentasjons-sjekk.

### i18n: `timer.gruppe.maskinAvArbeid` — IMPLEMENTERT PÅ DEVELOP 2026-05-28 ✅

Engelsk kildetekst forenklet fra «Machine hours {{maskin}}h of work hours {{arbeid}}h» til «Machine {{maskin}}h / Work {{arbeid}}h» (kort, klar struktur med universell slash-separator). Norsk speilet: «Maskin {{maskin}}t / Arbeid {{arbeid}}t». Nøkkelen slettet i 12 språk og re-generert via `generate.ts` — alle oversettelser nå gramatisk korrekte. ro fikset manuelt (Google Translate hoppet over «Work»; satt til «Lucru»). fr beholdt sin manuelle verdi fra `baa462e1`.

## 2. Halvferdige features

### Tilbake-pil i kommentar-modal (mobil `oppgave/[id].tsx`) 🟡

`ArrowLeft`-knapp i headeren på kommentar-dialogen for å lukke den. Ucommittet WIP fra 2026-06-01 (forkastet 2026-06-05 — endringen lå ucommittet lokalt gjennom flere sesjoner uten å bli fullført). Skal vurderes på nytt: om kommentar-dialogen trenger en eksplisitt tilbake-/lukk-pil i tillegg til eksisterende lukking.

### Dokumentflyt/kontaktliste redesign — skille faggrupper fra interne grupper (høy prioritet)

**Oppdaget 2026-05-26** etter prod-deploy av HMS-modul-seeding (`dddf2732`). Dagens dokumentflyt-side grupperer alt etter faggruppe, men `HMS-ansvarlige`-gruppen (og andre `ProjectGroup`-instanser med `domains: ["hms"]` eller `category: "brukergrupper"`) er ikke faggrupper — det er en annen datatype som ikke vises i dagens visning.

**To konkrete problemer:**
1. **HMS-flyten (opprettet av `modul.aktiver` for hms-avvik) er usynlig i dokumentflyt-administrasjon.** Flyten har et `DokumentflytMedlem` med `faggruppeId = null` + `groupId = HMS-gruppen.id`. Dagens UI grupperer kun på faggruppe-medlemmer og hopper over null-faggruppe-rader.
2. **Kenneth opplever faggruppe-visningen som svak.** Ønsker to visningsmoduser: én for navn/enkle lister (interne grupper, ansatte), én for faggruppe-struktur (kontraktsparter med faggruppe-farge + rolle-organisering).

**Rotårsak:** UI blander to konsepter som er forskjellige i datamodellen:
- **Faggruppe** (`Faggruppe`-tabell) — eksterne kontraktsparter (Byggherre, Bygg, Elektro, VVS, Ventilasjon). Har `color`, `industry`, `faggruppeNummer`. Vises i dokumentflyt som «boks» i flytkjeden.
- **ProjectGroup** (`ProjectGroup`-tabell) — interne grupper (HMS-ansvarlige, brukergrupper). Har `domains`, `permissions`, `modules`. Brukes til tilgangskontroll og som flyt-medlem via `DokumentflytMedlem.groupId`.

`DokumentflytMedlem`-schemaet støtter allerede begge via `faggruppeId | projectMemberId | groupId` (mutex), men UI gjenspeiler ikke den fleksibiliteten.

**Krever design-runde før implementasjon.** Åpne spørsmål:
- Skal interne grupper vises i samme flyt-visualisering som faggrupper, eller i et separat panel?
- Hvordan visualiserer vi en flyt med både faggruppe- og gruppe-medlemmer (eks. HMS-flyt der bestiller er åpen og utforer er HMS-gruppen)?
- Skal Kenneths to visningsmoduser være toggle-bare per side, eller skal de skilles ut til separate sider (kontaktliste vs flyt-administrasjon)?
- Hva med brukergrupper som ikke er involvert i noen flyt — vises de noe sted i dag?

**Berører:**
- `apps/web/src/app/dashbord/oppsett/produksjon/dokumentflyt/page.tsx` — primær side
- `apps/web/src/app/dashbord/oppsett/produksjon/_components/dokumentflyt-komponenter.tsx` — komponenter
- `apps/web/src/app/dashbord/oppsett/produksjon/kontakter/` — kontaktliste (sannsynligvis berørt av samme to-konsept-skille)
- Server `gruppe.hentForProsjekt` returnerer allerede ProjectGroup-data — UI må bare konsumere det

### Web DokumentHandlingsmeny — redesign til boks-modell (høy prioritet)

Samme redesign som mobil fikk i Commit 2 (`91bc235f`). Web-versjonen (`apps/web/src/components/DokumentHandlingsmeny.tsx`, 734 linjer) bruker fortsatt gammelt ActionSheet-mønster uten flyt-kontekst — brukeren bekrefter «Send» uten å se hvor dokumentet går.

Bør speile mobil-modellen: flyt-bokser alltid synlig, klikkbare, popup med statuser, ⋯-admin-meny, flyt-bytte-dropdown. Avventer til mobil-UX er verifisert på enhet (build #23) før vi kjører samme redesign på web — får bekreftet at modellen fungerer i praksis først.

Eksisterende `apps/web/src/components/FlytIndikator.tsx` (199 linjer) og `apps/web/src/components/StatusHandlinger.tsx` (278 linjer) kan gjenbrukes som byggesteiner. Server-API (`oppgave.hentTilgjengeligeFlyter` + utvidet `endreStatus`-tilgang) er allerede i prod (`4968a23c`) og kan konsumeres uten endring.

### Innstillinger + IA/UX-restrukturering (egen sesjon, etter R-fasene) 🟡

`firma/innstillinger` er blitt uoversiktlig, og enkelte modul-koblinger havner adskilt fra det de hører til (f.eks. maskin-side ved en innstillingsknapp — må diskuteres). Mye har fornuftig plassering; dette gjelder primært innstillinger + noen spredte enkeltsider, ikke en total omskriving. Plan: dedikert sesjon med full IA-analyse — enumerér alle innstillings-/modul-ruter, mål mot domene-arbeidsflyt + tre-nivå-arkitektur, foreslå logiske grupperinger + ny navigasjonsstruktur med visuelle mockups. Bygg på [navigasjon-arkitektur-analyse-2026-05-03](navigasjon-arkitektur-analyse-2026-05-03.md), [ux-arkitektur-agenda](ux-arkitektur-agenda.md), [admin-navigasjon-analyse-2026-05-03](admin-navigasjon-analyse-2026-05-03.md), [domene-arbeidsflyt](domene-arbeidsflyt.md). Ingen ad-hoc flytting underveis — samles til én restrukturering. Trigget av reise-matrise-knapp-plassering (R3, 2026-06-11).

### Hilsen viser ekte admin-navn under impersonering (funn 2026-06-11) 🟡

Toppbar-hilsenen bruker `useSession()` (ekte innlogget bruker), ikke impersonerings-bevisst kontekst → viser `sitedoc_admin` sitt navn mens man impersonerer. Uavhengig, isolert fiks (impersonerings-bevisst bruker-kontekst i hilsenen). Lav prioritet. Kilde: `funn-impersonering-og-prosjektoppsett.md`.

### kom-i-gang viser «første prosjekt»-onboarding feilaktig (funn 2026-06-11) 🟡

`kom-i-gang` viser «første prosjekt»-onboarding for ikke-admin selv med valgt prosjekt; redirect kun for `sitedoc_admin`, mangler prosjekt-guard. Sannsynligvis erstattet av planlagt prosjektoppsett-omstrukturering (firma-malprosjekt) → knytt til IA/restrukturerings-saken over, ikke isolert fiks. Kilde: `funn-impersonering-og-prosjektoppsett.md`.

### 3D/IFC/georeferanse

Status og roadmap dokumentert i Claude-memory (`project_3d_status.md`,
`project_3d_roadmap.md`, `project_3d_viewers.md`). 3D/IFC tilhører
separat chat per `feedback_3d_annen_chat`.

- **3D Fase 1 — Web layout-level viewer-persistering** 🔴 — flytt `SammenslattIfcViewer` til prosjekt-layout, vis/skjul basert på rute. Eliminerer re-lasting ved 3D ↔ Tegninger-bytte.
- **3D Fase 2 — Mobil IFC-visning i React Native** 🟡 — grunnleggende viewer DEPLOYET via `eef2ee92 Mobil IFC 3D-viewer — WebView-komponent og navigasjon (Fase 2 Steg 2-3)`. Komponenten lever i `apps/mobile/src/components/IfcViewer.tsx` + ruter `apps/mobile/app/{3d-visning,tegning-3d}.tsx`. Persistent WebView-optimaliseringen ble forsøkt to ganger og revertert begge (`773720d1`, `a319c7e8`) — viewer re-laster ved navigasjon, men fungerer. Fragment-caching tilført (`8c86c85c`). Offline-støtte og persistent-mount gjenstår.
- **3D Fase 3 — Live site-view (AR/3D på byggeplass)** 🔴 — ARKit (iOS) / ARCore (Android). GPS + kompass for grov posisjonering, manuell justering for presisjon.
- **Test absolutt `treDTilTegning`** 🟡 — markør-offset-fixen kan ha løst hele problemet. Ikke testet etter fix.
- **Fjern 3D debug-logging** 🟡 — `tegningTil3D` og `treDTilTegning` logger til console når debug ferdig.
- **Fragment-caching verifisering** 🟡 — sjekk at 2. lasting er raskere.

### Tegning/PDF

- **Split-view pdf.js-migrering** 🔴 — PDF iframe-begrensninger i nåværende implementasjon. Planlagt migrering til pdf.js.

### Timer-relatert

- ~~**Attestering edit-modus bugs (oppdaget 2026-05-16)**~~ ✅ LØST — fixet i T7-2e (commit `c480fe8a`, prod-deploy via `86fdb5a3`). Bug 1 (fra-tid «0:») rotårsak: `col-span-1` for smal + `step=3600` skjuler minutter i Chrome — fix: `min-w-[120px]` + clamp `step ≤ 1800`. Bug 2 (timer-desimaler): controlled re-render «spiste» punktum — fix: lokal `timerStr`-state, parse ved blur. Entry var hjemløs drift fra før prod-deploy. Verifisert mot kode 2026-05-28 (`RedigerTimerRad.tsx:41-48` + `RedigerMaskinRad.tsx:46-52`).
- **T7-3c geo-forslag-utvidelser** ❓ — historikk-baserte forslag (sist brukte prosjekt). Mye av geo-forslag-leveransen kom i T7-3b2. Egen sub-PR eller forkastes.
- **`OrganizationMemberPermission` (modul-tilgang per ansatt)** 🔴 — låst i [fase-0-beslutninger.md](fase-0-beslutninger.md). Designet klart, ikke startet.
- **Mobil enhet-verifisering: Variant A/B default-lønnsart + auth-fiks** 🟡 — deployet til prod 2026-06-06 (`ac1a4367`), men ikke verifisert på enhet. iOS-simulator blokkert av Cloudflare↔Expo-Go-quirk (POST `/dev-login` svarer 200 server-side men responsen når ikke simulatoren — bekreftet via server-logg req-41) + Google passkey-prompt. Verifiser på fysisk enhet ved neste EAS/TestFlight-bygg: (a) tom sedel forhåndsvelger «Timelønn», (b) rad 2+ arver forrige rad, (c) bruker forblir innlogget over app-reload (auth-fiks).
- **Default-lønnsart per ansatt-avlønningsform (avklaring — Kenneths spørsmål 2026-06-06)** 🟡 — Variant B bruker firma-nivå default («Timelønn», ordinær type) markert via web-stjerne. Åpent: bør «ordinær standard-lønnsart» heller utledes fra **ansattens avlønningsform** (timelønnet → «Timelønn», fastlønnet → «Fastlønn (månedslønn)») enn et firma-globalt valg? Avlønningsform er per-ansatt, mens firmaets arbeidstidsordning (`OrganizationSetting.standardStartTid/SluttTid/pauseMin/dagsnorm`) definerer **timer**, ikke lønnsart — så arbeidstidsordningen kan ikke alene utlede hvilken lønnsart. Naturlig kobling: arbeidstidsordningens `dagsnorm` driver **auto-fordeling normaltid/overtid** (eget, større feature, ikke implementert — `timer.md § Auto-fordeling`). Firma-nivå default (nåværende) dekker det vanlige tilfellet der et firma er enhetlig time- eller fastlønnet; per-ansatt `avlonningsform`-felt på `User` vurderes hvis firma blander begge. Ikke besluttet.
- ~~**iOS-simulator henger på evig spinner — IPv6/NordVPN (ROTÅRSAK FUNNET 2026-06-06)**~~ ✅ BEKREFTET LØST 2026-06-07 — etter reboot (NordVPN avsluttet) returnerer `[HEALTH]` + `[AUTH] verifiser` 200 på 83–117 ms (hang evig før), appen kommer forbi spinneren. Rotårsak var ødelagt IPv6-ruting fra NordVPN-`utun`-rester; happy-eyeballs stallet på død IPv6-sti. **Ikke kode/server/Cloudflare/ngrok.** Full diagnose + løsninger (reboot / IPv6 Link-local only) i [simulator-ipv6-nordvpn.md](simulator-ipv6-nordvpn.md).
- ~~**AuthProvider `verifiser`-fetch mangler timeout/AbortController**~~ ✅ FIKSET 2026-06-07 — `verifiser`-fetchen i `apps/mobile/src/providers/AuthProvider.tsx` har nå AbortController med 12 s timeout; `AbortError` → ytre catch → cachet bruker, ingen evig spinner. Samme commit fjernet debug-instrumenteringen fra rotårsak-diagnosen. **Gjenstående oppfølger (konkrete tilfeller identifisert 2026-06-08):** rå mobil-auth-fetcher uten timeout — `auth.ts loggUt` (se egen logout-frys-entry under) + dev-login-fetchen. Legg AbortController-timeout på alle rå mobil-auth-fetcher; vurder global tRPC/React-Query-timeout. tRPC/React Query har fortsatt ingen global timeout satt. Detaljer i [simulator-ipv6-nordvpn.md § Separat kode-robusthetsbug](simulator-ipv6-nordvpn.md).
- **Logout fryser appen — manglende timeout (bekreftet mot kode 2026-06-08)** 🟡 NÆR-FIKS-KANDIDAT — `apps/mobile/src/services/auth.ts` `loggUt()` (linje 173–192): rå `fetch` mot `mobilAuth.loggUt` UTEN AbortController/timeout. Når api-test er unåelig henger fetch (settler aldri, kaster ikke) → koden når aldri `slettSessionToken()`/`slettBrukerData()` (som ligger ETTER try/catch) → AuthProviders `setBruker(null)` etter `await loggUtTjeneste()` kjøres aldri → appen fryser i «Ukjent bruker». Reprodusert i simulator 2026-06-08. **Fiks (anbefalt: lokal-først):** slett token/bruker + rut til login *først* og ubetinget; server-kall best-effort med timeout etterpå (instant utlogging, ikke 12s-vent som ren AbortController ville gitt).
- **dev-login/simulator IPv6-reachability — re-surfaced 2026-06-08** 🟡 (dev-miljø) — dev-login POST mot api-test feiler intermitterende med «Network request failed» i simulator (AAAA/IPv6-død sti). `setv6off` + `/etc/hosts`-IPv4-pin er flaky. Blokkerer mobil-runtime-test mot api-test. Trenger fokusert infra-feilsøking; skjerp [simulator-ipv6-nordvpn.md](simulator-ipv6-nordvpn.md) med dev-login-spesifikt. Web (test.sitedoc.no) er upåvirket (verifisert via Chrome 2026-06-08).
- **Ansatt-deaktivering — ubygd spor (latent, SPOR 1-research 2026-06-08)** 🟡 — Det finnes ingen deaktiverings-*handling* i koden: `User.canLogin` (arkiv-flagg, `schema.prisma:22`) leses ved login (`auth.ts:15/90`, `mobilAuth.ts:104`) men **settes aldri false** noe sted i `apps/api` (grep: 0 treff). Tre koblede luker: (1) ingen `deaktiverAnsatt`-mutasjon — `OrganizationMember` har ingen livssyklus-felt (`schema.prisma:115-135`), ProjectMember rører ikke; (2) aktive sesjoner / mobile bearer-tokens revokeres ikke — `verifiser` re-sjekker ikke canLogin; (3) timer-mutasjoner (`dagsseddel.ts:560` opprett, `:664` tilfoyTimerRad) gater ikke på canLogin → deaktivert bruker med levende token kan i prinsippet føre timer. **Bygges ikke nå (latent).** Rangerte alt.: (1A) `deaktiverAnsatt` setter `canLogin=false` + `periodeSlutt` på aktive ProjectMember (bevarer, sletter ikke) vs (1B) kun canLogin; (2A) `verifiser` re-sjekker canLogin (treffer 30-dagers-tokens) vs (2B) aktiv sesjons-sletting; (3) canLogin-sjekk i timer-mutasjonene. Historikk er strukturelt bevart uansett (`ProjectMember.userId` SetNull `:446/458`; timer i eget db-timer-schema).
- **`medlem.fjern` hard-sletter ProjectMember — nær-fiks-kandidat (SPOR 1, aktivt i dag)** 🟡 — `medlem.fjern` (`medlem.ts:294-300`) gjør `projectMember.delete()` ved fjern-fra-prosjekt, i strid med den myke-livssyklus-intensjonen `periodeSlutt` (null=aktiv) på `ProjectMember:455`. Foreslått: bytt til `periodeSlutt`-setting for bevart historikk (konsistens med C.13-mønsteret). Liten, isolert endring.
- **Attestant-kontinuitet ved ansatt-slutt — parkert, lav prio (SPOR 1)** 🟢 — Hvis eneste prosjekt-attestant slutter, er åpne attesteringer dekket av firma_admin-fallbacken i `erProsjektLeder` (`dagsseddel.ts:46-58`). Foreldreløs-risiko kun hvis firmaet mangler firma_admin. Parkert; evt. varsel når eneste prosjekt-attestant deaktiveres.
- **Timer-arkitektur (reise / oppmøtested / ikke-prosjekt-tid / firma-isolasjon) — åpne/parkerte punkter** 🟡 — Fra [OPPSUMMERING-timer-arkitektur.md § G](OPPSUMMERING-timer-arkitektur.md): (G3) 30-min-reise-terskel + retning + lovlighet av reisetid utenfor overtid → kun A.Markussen/regnskap/jurist kan bekrefte; (G4) fra/til → HMS-register → uavklart, designes ikke nå; (G5) maskinkost-fordeling + ProAdm utgående eksport (finnes ikke i dag) + per-maskin-vedlikeholdsrapport (`groupBy vehicleId` — finnes ikke) + planlegger-integrasjon → datamodell holdes åpen, bygges ikke nå. Fase-plan + schema-skisse i OPPSUMMERING; den aktive delen rutes til `timer.md` / `fase-0-beslutninger.md` / `arkitektur.md` via SPOR 2.
- **T.8-revisjon — auto-utkast vs konservativ (utredning, 2026-06-13)** 🟡 — T.8 (`fase-0:970`) er i dag **konservativ**: innsjekk/GPS-dagflyt trigger ALDRI auto-dagsseddel eller -rader; data brukes KUN som *hint* i prosjekt-velgeren, og arbeider oppretter rader eksplisitt (`fase-0 T.8:983`). Kenneth foreslår **evolusjon**: GPS-dagflyt **auto-skriver utkast-rader** (draft), og arbeider godkjenner ved **innsending** (draft→sent). **Beslutning for utredningen:** behold konservativ T.8 vs. evolusjon til auto-utkast + innsendings-godkjenning. Begge bevarer arbeider-godkjenning før *endelig* innsending — forskjellen er (a) **hvem som skriver utkastet** (arbeider manuelt vs. systemet fra GPS-dagflyt) og (b) **hvor godkjennings-punktet ligger** (ved opprettelse vs. ved innsending). Berører `fase-0 T.8`, Fase 1c-mobil (`:582` — «aldri auto-rad»-formuleringen må revideres ved evolusjon) og dagsseddel-flyt; avgjøres før Fase 4 Mannskap-koblingen. Ingen kode før beslutning.
- **Oppmøtested Fase 1-oppfølgere (etter Fase 1 develop/test 2026-06-08; Fase 1b ferdig 2026-06-09 `eea004cb`)** 🟡 — tre oppfølgere fanget fra `FASE-1-PLAN`-arbeidsdokumentet (alt nå i BACKLOG → arbeidsdokumentet kan fjernes). Rekkefølge videre: **Fase 1c → Fase 2 (Alt C) → Fase 3 (reise)**:
  - **Leaflet-kartvelger** for oppmøtested-koordinater (web `/dashbord/firma/oppmotesteder` bruker i dag manuell lat/lng — react-leaflet er ikke wiret i web ennå). Kart-klikk + marker-drag → setter lat/lng, manuell inntasting som fallback.
  - **EAS-enhet-verifisering** av Fase 1 mobil-del (GPS-identifikasjon i «Start dag»). Simulator dekker, men ikke fysisk enhet; krever EAS/TestFlight-bygg.
  - **Fase 1c-server — byggeplass-geofence fra georeferert tegning:** ✅ IMPLEMENTERT 2026-06-09 (develop/test, venter prod). `Byggeplass.latitude/longitude/radiusM` + `beregnByggeplassGeofence` (shared) + `bygning.beregnGeofence`/`settGeofence` + auto-fyll i `tegning.settGeoReferanse` (kun når tom) + web override. Løser byggeplass-koordinat-gapet (`fase-0 T.8:990`). Sannhetskilde [timer.md § Byggeplass-geofence](timer.md).
  - **Fase 1c-mobil — byggeplass-GPS-deteksjon i «Start dag»:** 🟡 GJENSTÅR. Utvid `apps/mobile/app/timer/ny.tsx:138-150` (Haversine `mobile/src/utils/geo.ts`) til å detektere byggeplass via `Byggeplass`-koordinater i tillegg til prosjekt. Krever EAS-bygg → buntes med Fase 1 mobil-verifisering over. Aldri auto-rad (`T.8:983`).
- **Web-parity TimerRadDialog — T.12 beskrivelse (ikke-blokkerende, 2026-06-20)** 🟢 — T.12 (fritekst per timer-rad, `SheetTimer.beskrivelse`) ble bygget mobil-fokusert (Slice 2, commit `a51821c3`). Web `TimerRadDialog` mangler tilsvarende felt. Feltet er nullable + tRPC-input er `.optional()` → web brekker ikke uten det. Speil mobil-mønsteret: multiline-input med `t("timer.felt.radBeskrivelse")` + visning i rad-detalj. Kort follow-up.

### Doc-drift (timer) — fanget fra redesign-screening 2026-06-20 🟡

Fra [redesign-dagsseddel-funn-2026-06-20.md DEL 3](redesign-dagsseddel-funn-2026-06-20.md). Reconcile sannhetskilder mot faktisk kode.

- **DRIFT-1 — `timer.md:124` PR 2C-status utdatert** — bunter ferdig + åpent arbeid under ett «🔴 Åpen»-banner. Faktisk *delvis gjort*: per-rad `projectId`/`fraTid`/`tilTid` + `timerSync` + screens er levert (T7-3b1/T4). Genuint åpent: `dagsseddel_local.project_id` fortsatt `.notNull()` (`schema:84`), + `byggeplassId`/attestert-felter på rad-tabellene + NOT NULL-constraint + full backfill. Fiks: rett `timer.md:124` så ferdig/åpent ikke buntes.
- **DRIFT-2 — `timer.md:330-357` UX-skisse pre-T.1** — viser prosjekt på sedel-nivå (før per-rad-projectId). Utdatert; oppdater til per-rad-modellen.
- **DRIFT-3 — fritekstsøk udokumentert** — fritekstsøk på alle velgere (inkl. utstyr nr+navn) er bygget, men ikke dokumentert i `timer.md`.
- **DRIFT-4 — `timer-input-katalog.md` tom plassholder** — fyll eller slett.
- **DRIFT-5 — auto-fordeling normaltid/overtid: T.9-droppet vs OPPSUMMERING-manglende** — koden forhåndsvelger kun lønnsart (Variant B), ingen fordelingsmotor → T.9 (droppet) er korrekt; OPPSUMMERING bør rettes. Reconcile de to.

### BUG-1 — StartSluttDagKort mangler maks-varighet-vakt / auto-utsjekk 🟡

`StartSluttDagKort`-flyten har ingen maks-varighet-vakt eller auto-utsjekk (jf. 12t-presedensen for innsjekk). Glemt «Slutt dag» → urealistisk arbeidstid (165.57 t observert på skjerm 1 i screening 2026-06-20: «Start dag» 13. juni, «Slutt dag» trykket ~7 dager senere → 168 t brutto). Manuell rad-redigering *har* vakt (`ArbeidstidSeksjon.tsx:143` `diffMin<=0`) og `arbeidstidTimer` klamrer `Math.max(0,…)` (`[id].tsx`), men auto-flyt-vakten mangler. Fiks: maks-varighet/auto-utsjekk i «Start dag»-økt-flyten.

### Slice 3 — auto-utkast MVP (auto-generer draft ved «Slutt dag») ✅ DEVELOP 2026-06-20 (`a79a8fae`)

Mål = v2-mockup (låst 2026-06-20). Forankret i BESLUTNING 1 = Alternativ B (auto-utkast + innsendings-godkjenning, jf. `fase-0` T.8-revisjon over). Ved «Slutt dag» auto-genereres en **draft**-dagsseddel på valgt prosjekt med arbeidstid + reise, med **auto-fyll-banner** og **reise som egen rad**. Arbeider korrigerer + sender (draft→sent = godkjenning). Synlighets-fiks (UX-1) er allerede levert. Senere utvidelser: maskin + multi-prosjekt-auto-deteksjon (krever byggeplass-GPS L2). Ingen kode før beslutnings-detaljene er låst per mockup.

**Innsnevring (verifisert mot kode 2026-06-20):** Selve auto-genereringen er **allerede bygget** — `genererForslag` (`apps/mobile/src/components/StartSluttDagKort.tsx`, fra «Start dag/Slutt dag»-MVP 2026-06-06 + R4; per 4a delt i `genererForslag` + `opprettDagsseddelForSegment`) lager draft på Haversine-prosjekt med arbeidstid (= total − reise, splittet Timelønn/Overtid 50%) + reise-rad (egen lønnsart via `OrganizationSetting.reiseLonnsartId`, navne-match-fallback, gated på terskel + identifisert oppmøtested). Slice 3 sin gjenstående kode er derfor kun **UX-signallaget**: (1) auto-fyll-banner, (2) auto-markør (skille auto-draft fra manuell `ny.tsx`-draft), (3) reise-rad-merking.

**Idempotens (LÅST 2026-06-20, Alt 1):** ved «Slutt dag» — finnes allerede en draft for `(userId, dato)` → naviger til den eksisterende i stedet for å lage ny. Begrunnelse: server håndhever `@@unique([userId, dato])` på `DailySheet` (`db-timer/schema.prisma:164`), så «alltid ny» ville gitt sync-konflikt og «merge» dobbelttellings-risiko. Alt 1 respekterer modellen, unngår duplikat + dobbel-lønn, enklest. *(`@@unique([userId, dato])` per 2026-06-21 på `db-timer/schema.prisma:172` — flyttet av Slice 4b-2 `sluttTidKilde`.)*
- **Edge case (akseptabel MVP-tradeoff):** er den eksisterende draften tom (manuelt opprettet, ingen rader), åpnes den uten auto-fyll → arbeider mister auto-genereringen i det sjeldne tilfellet. Greit for MVP. «Auto-fyll tom eksisterende draft» (skriv auto-rader inn i tom draft) er en mulig senere forfining.

### Slice 4 — dag-grense + nattskift + glemt-dag + system-flagg + arbeidstids-varsel ✅ DEPLOYET TIL PROD 2026-06-21 (server; mobil via EAS)

> **Server-deler (migreringer + web-attestering-badges + admin-UI) DEPLOYET TIL PROD 2026-06-21** (prod-merge `32b88bd7`) — arkivert i [historikk-2026-06.md § Slice 1–4 + reisetid R1–R4 + GPS L1](historikk-2026-06.md). **Mobil-delene (auto-utkast, midnatt-splitt, glemt-dag-prompt, badges) er IKKE på arbeidernes telefoner** — krever EAS prod-bygg etter enhetstest (gate, se § Følgesaker etter prod-deploy). Detalj-spec under beholdt for referanse.

> **Slice 4a — midnatt-splitt ✅ DEVELOP 2026-06-20.** Mobil-lokalt, ingen migrering. `genererForslag` (`StartSluttDagKort.tsx`) refaktorert til per-segment via ren `splittVedMidnatt`-helper (`utils/dagsegment.ts`): skift som krysser 00:00 → én draft per kalenderdag, timer summerer til reell total (verifisert: 19:00→07:00 = 5t+7t=12t). **Låst:** pause + reise kun på start-dagen (1a), per-dag Timelønn/Overtid-split beholdt (2), «delt ved midnatt»-merking (lokal nullable `dagsseddel_local.delt_ved_midnatt`, idempotent ALTER) + badge på review-skjerm (`timer.deltMidnatt.*`, 15 språk). Idempotens per dag (eksisterende `(userId,dato)`-sedel beholdes, øvrige opprettes), naviger til start-dagens sedel.
> - **Kjent luke (→ Lag 2/4b):** en glemt «Slutt dag» over flere døgn over-splittes (3 dager → 4 sedler à ~24t). Lag 2 glemt-dag-prompt fanger dette. Inntil 4b: akseptabel (bedre enn dagens ene 72t-sedel; per-dag-tallene er i det minste avgrenset).

**Sub-split (vedtatt 2026-06-20):**
- **4b-1 — Lag 2 glemt-dag-prompt ✅ DEVELOP 2026-06-20.** Mobil-lokalt, ingen migrering. `StartSluttDagKort`: åpen `arbeidsdag_local` med start-dato < i dag → amber-prompt «Glemte du å avslutte?» med «Jeg glemte å avslutte» (gjenoppretting: estimer slutt = firma `standardSluttTid` på start-dagen, `utforSluttDag(overstyrtSluttIso)` uten GPS-ved-slutt → draft arbeider korrigerer) / «Jeg jobber fortsatt» (behold åpen, vis normal «Slutt dag»). Fanger BUG-1 + 4a over-splitt-luken. i18n `timer.glemtDag.*` (15 språk). `sluttTidKilde="system"`-merking påføres i 4b-2.
- **4b-2 — Lag 3 (`sluttTidKilde`) + arbeidstids-varsel ✅ DEVELOP/TEST 2026-06-21 (migrering anvendt + verifisert på `sitedoc_test`):** to additive migreringer anvendt + verifisert 2026-06-21 — `slutt_tid_kilde` (NOT NULL DEFAULT 'bruker') på `timer.daily_sheets` + `arbeidstid_varsel_timer` (NOT NULL DEFAULT 13) på `organization_settings`; gaten traff `sitedoc_test`, begge migreringer «applied», 12/12 rader backfill (0 berørt), upload-regresjon 401 (web-port OK). Ikke prod. to additive migreringer (`db-timer DailySheet.sluttTidKilde @default("bruker")` + `db OrganizationSetting.arbeidstidVarselTimer @default(13)`). Server: felt i `opprett`/`oppdater`/`syncBatch`/`hentEndringerSiden`/`hentForAttestering` + `organisasjon.oppdaterSetting`/`hentSetting`/`hentArbeidstidDefaults`. Mobil: lokal kolonne `dagsseddel_local.slutt_tid_kilde` + ALTER + sync (push/pull) + set-semantikk (`opprettDagsseddelForSegment`: ikke-siste→`"midnatt"`, siste→`"bruker"`/`"system"` via threaded param; reset `"bruker"` ved redigering i `ArbeidstidSeksjon`). Smartere natt-estimat i `gjenopprettGlemtDag` (standardSluttTid ≤ start → start+dagsnorm, `"system"`). Badges (web `AttesteringDetalj` + mobil `AttesteringDetaljMobil`): kontroll-badge ved `sluttTidKilde==="system"` + arbeidstids-varsel når `sum(timer-rader inkl. reise) > arbeidstidVarselTimer` (varsel, ikke blokkering). Admin-UI: terskel-felt i `firma/innstillinger`. i18n 4 nøkler × 15 språk. Typecheck: 0 nye feil. **Gjenstår (ikke-blokkerende):** arbeider-review arbeidstids-badge (eget punkt under) + mobil-distribusjon via EAS. Prod ikke deployet.

**Følgesaker fra Slice 4 (ikke startet):**
- **Arbeider-review arbeidstids-badge (tidlig-varsel) 🟡** — 4b-2 viser arbeidstids-varsel kun i *attestering* (leder-siden). Arbeider bør se samme varsel på review-skjermen (`apps/mobile/app/timer/[id].tsx`) FØR innsending, så lange dager fanges tidlig. Krever `arbeidstidVarselTimer` i mobil-cache (`organizationSettingKatalog` + `organisasjon.hentArbeidstidDefaults`-select — terskelen er ikke cachet i dag) + samme `sum(timer-rader inkl. reise) > terskel`-beregning som attestering. Varsel, ikke blokkering.
- **Arbeider-review system-slutt-badge 🟢 (valgfri)** — tilsvarende «delt ved midnatt»-mønsteret kan en `sluttTidKilde==="system"`-merking vises på arbeider-review (lokal kolonne finnes alt). Lav prio — gjenopprettings-flyten leder arbeider rett til draften uansett.
  - **Edge case fra 4b-1 å håndtere smartere i 4b-2:** glemt-dag-gjenopprettingen estimerer slutt = `standardSluttTid` på start-dagen. Var det egentlig et **nattskift** (start sent på kvelden, `standardSluttTid` < `startAt`) gir estimatet en 0-times draft. 4b-2 bør (a) detektere dette og estimere smartere (f.eks. start + dagsnorm, eller standardSluttTid på NESTE dag → midnatt-splitt), og (b) uansett merke gjenopprettings-slutten `sluttTidKilde="system"` så attestant ser at tiden er gjettet og må sjekkes.

**Låste design-punkter (2026-06-20):** (1) `sluttTidKilde`: midnatt-grense→`"midnatt"` (ingen badge), «Slutt dag»-trykk/manuell→`"bruker"`, glemt-dag-gjenoppretting/maks-varighet→`"system"` (kontroll-badge). (2) Arbeidstids-terskel teller **alle timer-rader inkl. reise** per dagsseddel (kompensert reise = arbeidstid → mer AML-riktig + konservativt). (3) Glemt-dag-gjenoppretting bruker estimert slutt = firma `standardSluttTid` (arbeider korrigerer). (4) Terskel = `Int` (13 default / 16 tariff via samme felt); admin-redigerings-UI = liten følgesak.

Større slice enn 1–3: krever **én server-migrering (gated)** + split-logikk + gjenopprettings-prompt + attesterings-badge → eget bygg i frisk økt. Bygger på Slice 3 («Start/Slutt dag»-flyten + `genererForslag`). Forankret i AML **§ 10-6** (alminnelig/utvidet arbeidstid: 13 t varsel-default, 16 t ved tariff) + **§ 10-8** (11 t døgnhvile). **Prinsipp:** SiteDoc *flagger + registrerer* — juridisk ansvar for arbeidstidsgrenser ligger hos firmaets HMS, ikke i appen.

**Lag 1 — midnatt-SPLITT (ikke klemming):** et skift som krysser 00:00 deles i **én dagsseddel per kalenderdag**; timene summerer til reell total (12 t nattskift fra 19:00 → 5 t på dag 1 + 7 t på dag 2). Ikke klem til én dag, ikke kutt på midnatt-totalen. Reise føres på **start-dagen**. Overtid/tariff-behandling av nattetimene er **regnskaps-scope** (lønnsart-grensen — SiteDoc registrerer rådata, regnskap eier satser/kobling).

**Lag 2 — glemt-dag vs. nattskift (gjenopprettings-prompt):** ved «Start dag» / app-åpning, hvis en arbeidsdag fra en **tidligere dato** fortsatt er åpen (`arbeidsdag_local.status="paagaar"`) → spør arbeider: **«Jobber du fortsatt, eller glemte du å avslutte i går?»**. «Jobber fortsatt» → behold åpen (ekte nattskift/lang vakt → Lag 1 splitt ved avslutning). «Glemte å avslutte» → la arbeider sette riktig slutt-tid (system-flagg, Lag 3). Erstatter dagens manglende maks-varighet-vakt (jf. BUG-1: 165 t fra glemt «Slutt dag»).

**Lag 3 — system-flagg på slutt-tid:** nytt server-felt **`DailySheet.sluttTidKilde: "bruker" | "system" | "midnatt"`** (Prisma-migrering i `db-timer`, **gated** + `/sitedoc_test` foran). Tre verdier (vedtatt 2026-06-20) så **legitim midnatt-splitt ikke utløser kontroll-badge**: `"midnatt"` = start-segmentets `endAt` er en automatisk dag-grense (Slice 4a) — normalt, ingen badge; `"system"` = slutt-tiden er system-*gjettet* (glemt-dag-gjenoppretting/maks-varighet-klamp) → **kontroll-badge i attestering** (ikke arbeider-bekreftet); `"bruker"` = arbeider satte/bekreftet tiden. Settes til `"bruker"` ved **eksplisitt redigering** (nullstiller system/midnatt). Det lokale 4a-feltet `delt_ved_midnatt` mappes til `"midnatt"` på start-segmentet når 4b lander. Speiler 12 t auto-utsjekk-presedensen (`MannskapsInnsjekk.autoUtlogget`, mannskap.md) for timer-domenet.

**Arbeidstids-varsel (samme badge-mekanisme):** ny `OrganizationSetting`-terskel (**default 13 t**, firma kan heve til **16 t** ved tariff). Overskrides **total av alle timer-rader (inkl. reise) på en dagsseddel** terskelen (vedtatt 2026-06-20: inkluder reise — kompensert reise er arbeidstid, og det er konservativt for varsel) → **varsel, ikke blokkering** (arbeider kan fortsatt sende; utførelse låses aldri bak dette). Per kalenderdag/dagsseddel (et midnatt-splittet nattskift trigger normalt ikke siden hver dag < terskel; ekte AML-«døgn» = utenfor MVP). Samme badge i attestering så attestant/HMS ser flagget. To-stegs-migrerings-policy gjelder for både `sluttTidKilde` og terskel-feltet.

**Avhengigheter/rekkefølge:** Lag 1+2 er mobil-lokalt (kan bygges uten server-migrering om system-flagget utsettes), men Lag 3 + arbeidstids-varsel krever server-migreringen → mest sammenhengende å ta hele Slice 4 som ett bygg med migrerings-OK i forkant. Berører `StartSluttDagKort.tsx` (gjenopprettings-prompt + splitt), `genererForslag` (per-dag-splitt), `db-timer/schema.prisma` (`sluttTidKilde` + terskel på `OrganizationSetting`), attestering-UI (badge), mobil-cache (terskel). Modul-avhengighets-regelen: verifiser mot [timer.md](timer.md) + [mannskap.md](mannskap.md) (auto-utsjekk-presedens) før koding.

### Byggeplass-ankomst → HMS mannskaps-register (byggherreforskriften §15) 🟡

Når 1c-mobil bygges (byggeplass-GPS-ankomst), skal ankomst-innlogging mate HMS/PSI-mannskaps-oversikten (§15, lovpålagt) som **PRIMÆR** formål. HMS-compliance, ikke produktivitets-sporing → sterkere personvern-grunnlag enn reisetid. Reisetid (R4) er sekundær avledning. Kobling: 1c-mobil (ankomst-deteksjon) + [mannskap.md](mannskap.md) (§15-tilstedeværelse, fra/til firma-isolert). Design: ankomst-event → PSI-presence + HMS-register.

### Reise (Fase 3) — forbedringer etter MVP

Tre idéer fanget 2026-06-09 etter at Fase 3 reise-MVP (estimat ×50 km/t, avvik C) ble implementert på develop/test. Distinkt fra §G3-punktet (`:554` — som gjelder *policy-bekreftelse* av terskel/lovlighet hos A.Markussen/regnskap/jurist). Disse er *byggbare forbedringer* av selve reisetid-utledningen.

- **Reisetid-matrise: Google-kjøretid kontor×byggeplass (ANBEFALT — Kenneth: bør implementeres 2026-06-09)** 🟡 — Forhåndsberegn [oppmøtested × byggeplass] kjøretid via Google Directions ved georeferanse-oppsett (byggeplass-koordinater fra Fase 1c). Per tur blir et rent oppslag: GPS-identifisert kontor → byggeplass → ferdig reisetid, offline-cachet, håndterer fler-kontor-firma. **Erstatter estimat-MVP (×50 km/t, avvik C)** med faktisk kjøretid. Recompute toveis ved samme invalidering som 1c i `tegning.settGeoReferanse`: byggeplass-georef endres → recompute den raden; oppmøtested legges til/flyttes → recompute den kolonnen. Google-nøkkel brukes KUN ved oppsett (ikke per registrering). Fallback: ikke-registrert startsted → estimat/ingen reisetid. Ny matrise-tabell (oppmotestedId × byggeplassId → minutter) + mobil-cache.

- **Per-prosjekt reisetid-berettigelse-flagg** 🟡 — `Project.reisetidBerettiget` (boolean), satt ved prosjekt-opprettelse, gate for om reisetid i det hele tatt gjelder prosjektet. Kombineres med terskelen: reisetid foreslås kun når prosjektet er berettiget OG reisetid > terskel. Lar firma skru av reise-forslag på nær-/by-prosjekter uten å rote til terskel-regelen.

- **Kontinuerlig GPS-logging for faktisk reisetid — NEDGRADERT, KREVER PERSONVERN-VURDERING** 🔴 (lavest prio, notert for fullstendighet) — App logger GPS kontinuerlig (midlertidig under reise) for *målt* reisetid (ankomst − avreise) i stedet for estimat. **To grunner til at dette IKKE bygges:** (1) **Sporing av ansatte er regulert** (GDPR + arbeidsmiljølov, Datatilsynets praksis om lokasjonssporing) — bygges ikke uten personvern-/juridisk vurdering. (2) **Læring (R4, 2026-06-11): et observert ankomst−avreise-delta er ikke ren reisetid** — det inkluderer arbeids-stopp underveis, så det måler feil størrelse. R4-modellen er autoritativ i stedet: matrise-kjøretid = reisetid; `arbeidstimer = total − reisetid` håndterer arbeids-stopp korrekt som arbeidstid. Reisetid-matrisen gir altså både nøyaktighet UTEN sporing OG riktig begrep — denne entryen er derfor nedgradert til kun-for-fullstendighet.

- **Matrise-trigger ved prosjekt-koordinat (fallback-luke, lav prioritet)** 🟢 — Byggeplass som kun bruker `Project.latitude/longitude`-fallback (uten georeferert tegning) får ingen auto-recompute ved opprettelse; ingen trigger fyrer på prosjekt-koordinat. Dekkes i dag av «beregn matrise»-knappen + graceful estimat-fallback i oppslaget. Fiks når ønsket: trigger `recomputeRadForByggeplass` når `Project.latitude/longitude` settes/endres, for prosjektets byggeplasser. Normal-flyt (georeferering → `oppdaterByggeplassGeofence`) er allerede dekket av R3.

- **Matrise-viewer + uoppnåelig-surfacing (drøftet R3, utsatt 2026-06-11)** 🟢 — reisetid-matrisen er i dag en black box: «beregn» gir kun «X rader beregnet», ingen måte å SE radene (kontor→byggeplass-tider, særlig -1/veiløse par som trenger koordinat-sjekk, og mistenkelig like/store tider). To nivåer: (a) **LETT:** la `recomputeMatrise` returnere antall uoppnåelige → «X beregnet, Y uoppnåelige» i knapp-resultatet (~5 linjer, fanger sikkerhetssignalet). (b) **FULL:** read-only tabell kontor × byggeplass → minutter (-1 markert) i Reise-seksjonen. Vurdering: full viewer er smal admin-diagnostikk (gull-plating nå) → vurder under IA/innstillinger-restruktureringen. (a) kan gjøres når som helst hvis -1-synlighet ønskes. Kontekst: reisetid er justerbart forslag (feil verdi ikke kritisk), men -1 = ingen forslag, og firmaet bør vite hvilke par som mangler.

- **R4-avhengighet av `bygning`-router-alias (back-compat-flagg, lav prioritet)** 🟡 — R4 mobil-cache henter byggeplasser via `klient.bygning.hentForFirma` (`apps/mobile/src/services/byggeplassKatalog.ts:29`). `bygning` er kun en bakoverkompatibel alias for `byggeplassRouter` i `apps/api/src/trpc/router.ts:53`, merket «1 uke». **Fjernes aliaset, brytes R4s byggeplass-fetch** (matrise-oppslaget på mobil mister byggeplass-koblingen). Avklar om `bygning`-nøkkelen skal være permanent; hvis ikke, flytt R4-kallet (og evt. andre konsumenter) til den kanoniske router-nøkkelen FØR aliaset fjernes. Funnet under R4-verifisering 2026-06-12.

### Attestering-liste — expanded inline-visning (oppdaget 2026-05-16)

Attestering-listen viser kun rad-antall, ikke innhold. Prosjektleder
må åpne enkelt-sedel for å verifisere timeføring.

Ønsket: alle registreringer synlige inline + redigering tilgjengelig
direkte fra listen.

- Alternativ A: expandable rader (default expanded).
- Alternativ B: to-panel-visning (liste + detalj side om side).

### Onboarding og brukerveileder

- **Onboarding-veileder (forutsetning for A.Markussen)** 🟡 — Runde 1 (a)+(b)+(c) deployet til prod 2026-05-02. Resterende: full guidet flyt for ny bruker. Se [onboarding-veileder.md](onboarding-veileder.md).
- **Prosjektoppsett-veileder** 🟡 — steg-for-steg ny bruker etter prosjektopprettelse. Se [prosjektoppsett-veileder.md](prosjektoppsett-veileder.md).
- **Testbrukere i test-DB** 🔴 — Ola Tømrer (worker), Per Prosjektadmin, Kari Firmaadmin, Tore SiteDocAdmin. Planlagt etter Timer er ferdig.

### Søk og mobil

- **Adaptivt søk for sjekklister/oppgaver/HMS/RUH** 🔴 — krever kode-utforskning. Se [adaptiv-sok-plan.md](adaptiv-sok-plan.md).
- **Dokumentflyt mobil** 🔴 — finner ikke arbeidsforløp (bruker-basert vs entreprise-basert matching).
- ~~**Oppgave-mobil rettighetsoppfølger**~~ ✅ DEPLOYET TIL PROD 2026-05-29 (prod-merge `526db462`, impl `32dd43ac`). `apps/mobile/app/oppgave/[id].tsx` får nå `rettighetInput` ved kall til `useOppgaveSkjema` — speil av sjekkliste-mønster fra `60601d3c`. Aktiveres på mobil ved neste EAS-bygg + TestFlight/Play Store-distribusjon.

## 3. Fremtidige faser

Detaljert plan: [arkitektur-syntese.md § 5](arkitektur-syntese.md).
Beslutningsgrunnlag: [fase-0-beslutninger.md](fase-0-beslutninger.md).
Aktiv Fase: 0 (firma-fundament) er i hovedsak ferdig — gjenstående §-E-steg dokumentert der.

### Fase 0.5 — Byggeplass + Avdeling-fundament

- To åpne arkitektur-prinsipper besluttes (default-byggeplass, FK vs jsonb) per [byggeplass-strategi.md](byggeplass-strategi.md). NULL = «hele prosjektet» allerede vedtatt (A.30).
- `ByggeplassMedlemskap` (loan-pattern: User → Byggeplass over tid)
- Drop `building_ids` jsonb fra `project_groups` — erstattes av m2m-koblingstabell
- `Avdeling`-tabell i `packages/db` (kjernen)
- `User.avdelingId` valgfri
- Forbered byggeplassId-felt på fremtidige Timer/Mannskap/Varelager-modeller

### Fase 1 — Maskin med modul-gateway (under bygging)

- Refaktor maskin-rutene til `modulProcedure('maskin')` — må gjøres før prod-deploy
- `EquipmentChecklist` + `EquipmentChecklistTemplate` i `db-maskin`
- UI for maskin-sjekkliste på maskin-detalj-side
- Manuell trigger fra maskinregister (auto-trigger fra service-varsel utsettes til Fase 7)

### Fase 2 — Mal-promotering

- `OrganizationTemplate` + `ReportTemplate.organizationTemplateId`
- UI for «Send til firmabibliotek»
- «Start fra firma-mal»-valg ved opprettelse

### Fase 3 — Timer-modul (inkluderer Kompetanseregister)

- Lønnsarter, arbeidstidskalender (delvis startet via T9-bunken), dagsseddel med byggeplassId fra dag 1
- Underprosjekt (Proadm-import eller SiteDoc Godkjenning)
- Steg 4c — Godkjenning UI (parkert 2026-05-03, venter på A.Markussen-input / ProAdm API)

### Fase 4 — PSI-utvidelse + mannskaps-vy

- Innsjekk/utsjekk-mekanikk
- Mannskaps-vy aggregerer PSI-tilstedeværelses-data per byggeplass
- §15-liste-eksport, HMS-kort-validering, geofence-innsjekk
- `eksternSystem`-felt på Psi
- 12t auto-utsjekk
- **HMS-tilgang for arbeidsgiver på andres prosjekter (juridisk gap A.27)** — løses her per [fase-0-beslutninger.md](fase-0-beslutninger.md).

### Fase 5 — Varelager-modul

- Goods, GoodsCategory, GoodsLocation
- Vareforbruk på dagsseddel (kobler til Timer-modul)
- Saldo-håndtering
- Strekkode-skanning (mobil)

### Fase 6 — Avansert

- DO-kobling (Kompetanse ↔ Equipment-validering)
- AI-ukeplan (Timer + Mannskap + Maskin)
- Strekkode-skanning utvidelser

### Fase 7 — Prosjekthotell-utvidelser (parallelt spor)

- Møtemal (ny dokumenttype)
- Månedsrapport (auto-aggregering)
- HMS-statistikk på firma-nivå
- Street View for byggeplass (eget prosjekt)
- Auto-trigger maskin-sjekkliste fra service-varsel (forutsetter Varsling-modul)

### Etter Fase 1 + Fase 3

- **Aktivitetsfeed på dashboard** — bruker eksisterende Activity-tabell, polling via tRPC, konfigurerbar periode (default 10 dager) + hendelsestyper + GDPR-retensjon i `OrganizationSetting`. Ekstern partner-feed-scope krever egen designrunde. Se [aktivitetsfeed.md](aktivitetsfeed.md).

### Konfigurerbare statuser per flyt (lav prioritet)

**Idé 2026-05-25.** Tillat at hver dokumentflyt (eller dokumenttype-mal) aktiverer kun et subset av tilgjengelige statuser. Konfigureres i mal-byggeren for sjekklister/oppgaver — en enkel flyt kan eks. ha kun `draft → sent → responded → approved`, mens en kompleks flyt har hele matrisen (`in_progress`, `rejected`, mellomtrinn osv.).

**Konsekvens for send-modal-redesign:** Popup'en med tilgjengelige statuser per boks filtreres på flyt-konfigurasjon i tillegg til rolle-tilgang. Færre status-knapper å vise — enklere for brukeren.

**Konfigurasjonssted:** Mal-bygger-UI ([MALBYGGER.md](../../MALBYGGER.md)). Eksisterende mal-konfigurasjon utvides med status-toggle-matrise. Mest sannsynlig per dokumenttype-mal, ikke per enkelt dokumentflyt.

**Avhengighet:** Krever migrering — ny `ReportTemplate.tilgjengeligeStatuser: Json` (eller `OrganizationTemplate.tilgjengeligeStatuser` når Fase 2 mal-promotering lander). Default = alle statuser aktive (bakover-kompat).

**Lav prioritet:** Vurder etter dokumentflyt send-modal-redesignen er deployet og i bruk. Sjelden at kunder spør om dette — eksisterende standard-flyt dekker de fleste tilfeller.

### Tverrgående

- **Firma-nivå tilgangskontrolloversikt** 🔴 — firma-admin skal kunne se en samlet oversikt over hvem som har hvilke roller og tilganger i firmaet, i ett strukturert UI. I dag finnes data spredt (User.role, OrganizationMember.firmaRoller, ProjectMember.role + kapabiliteter, OrganizationMember.firmaansvarlig, ProjectGroup-medlemskap, modul-tilganger). Ingen sentralisert visning. Skal designes fra bunnen — IKKE kopiert eller portert fra Tromsø Salsaklubb-prosjektet (annet domene, annen tilgangsmodell). Del av planlagt UX-sesjon for firma-innstillinger + tilgangsoversikt (se rapport 2026-05-28). Krever: (1) skisse av visnings-struktur (matrise person × tilgang? person × rolle med expand? rolle × tildelte personer?), (2) avklaring av om dette skal være lese-bare oversikt eller redigerbart kontrollpanel, (3) hvilke roller/tilganger som er relevante å vise (kjerne-roller, kapabiliteter, firma-roller, prosjekt-roller, modul-tilganger). Estimat 6-10t etter spec-runde.
- **Superadmin-oversikt over firma-moduler** 🔴 — fakturerings-orientert. Egen feature-sesjon.
- **Vis som bruker (impersonering)** 🟡 — DEPLOYET TIL PROD 2026-05-28 (audit-log prod-merge `30467d74`). Schema, 3 server-prosedyrer, context-håndtering, UI, i18n, `utloperVed`-fix, persistent `ImpersonationAudit`-spor (Variant B) — alt på plass. **Gjenstående:** Lese-prosedyre + UI for audit-loggen — venter på tilgangs-oversikt-UX-sesjon. Audit-log-PR arkivert til [historikk-2026-05.md § Impersonering audit-log](historikk-2026-05.md).
- **Import-modul (HR-data)** 🔴 — datainfrastruktur, mater Timer med ansattnummer, hmsKortNr osv.
- **AI-integrasjon** 🔴 — Copilot plugin, MCP server, innebygd assistent. Se [ai-integrasjon.md](ai-integrasjon.md).
- **Fremdriftsplanlegger** 🔴 — ressursplanlegging, kompetanse, bemanning, forslag-motor. Etter timer+maskin+HR. Se [planlegger.md](planlegger.md).
- **AI-drevet ukeplan** 🔴 — utvidelse av planlegger Fase 4.
- **Dokumentsøk + OCR plan** 🟡 — OCR-fallback, dokumentasjon per post (splitting).
- **NS 3420 kontrollmaler** 🔴 — auto-genererte sjekklistemaler fra NS 3420 via OCR/søkemotor.
- **Cross-prosjekt-deling** ❓ — UE med eget prosjekt deler sjekklister til hovedentreprenør. Flere tilnærminger drøftes.

## 4. Kundeønsker ikke startet (A.Markussen)

Liste mottatt 2026-05-06. Se også [STATUS-AKTUELT.md § Kundeønsker](STATUS-AKTUELT.md).

- **#1 Sjekkliste for service koblet til timetall og status** 🟡 — DB-feltet `nesteServiceTimer` finnes i `packages/db-maskin/prisma/schema.prisma:188`. Mangler UI på maskin-detaljside + serviceintervall-konfigurasjon + sjekkliste med automatisk oppdatering.
- **#5 Registrering av HMS-gruppe på brukere** ⏸️ — parkert.
- **#7 Rettighetsmatrise med rolle-styring (Prosjektleder + Bas)** 🔴 — ny rolle-modell + matrise-UI. Eksisterende roller dekker ikke `Prosjektleder`/`Bas` som DB-roller.
- **#9 Justeringer på SJA (signatur/lesetilgang/deltaker)** 🔴 — utvidet sjekkliste-mekanikk: re-signaturforespørsel, auto-lesetilgang for prosjektmedlemmer, selv-påmelding som deltaker.
- **#10 «Flere personer»-feltet på SJA — definere hvem som er valgbare** 🔴 — felt-konfigurasjon for å begrense valgbare personer per SJA-mal.
- **#11 Pushvarsel/SMS til ansattliste** 🔴 — ny varslingstjeneste (SMS-leverandør-integrasjon), målgruppe-velger, kostnadsavklaring.

## Vedlikehold

Når en oppgave startes: flytt linje til [STATUS-AKTUELT.md § Pågående
arbeid](STATUS-AKTUELT.md). Når oppgaven er prod-deployet: flytt videre
til `historikk-YYYY-MM.md`. Se også [DOC-MAP.md](DOC-MAP.md) og
[CLAUDE.md § Dokumentasjons-regler](../../CLAUDE.md).
