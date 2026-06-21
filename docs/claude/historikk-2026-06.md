---
name: historikk-2026-06
description: Arkiv av deployete/ferdigstilte PR-er og saker fra juni 2026.
sist_verifisert_mot_kode: 2026-06-05
---

# Historikk — juni 2026

Arkiv av ferdigstilt arbeid. Aktivt arbeid ligger i [STATUS-AKTUELT.md](STATUS-AKTUELT.md).

## § Timer-arkitektur SPOR 3 (Fase 1 + 1b + 1c-server + 2 + 3) — DEPLOYET TIL PROD 2026-06-10 (prod-merge `aed86d0f`)

Hele SPOR 3-sekvensen samlet prod-deployet 2026-06-10 etter at hver fase var dual-review'd og verifisert på develop/test. Deploy-sekvens per [deploy-detaljer.md](deploy-detaljer.md): `migrate deploy` + `generate` for alle 3 db-pakker, `&&`-kjedet uten tail-pipe, **navngitt** `pm2 restart sitedoc-api && sitedoc-web` (ikke `pm2 restart all` — prod-pm2 er delt infra med `sitedoc-test-*`/`norbert-embed`/`oversettelse-server`; CLAUDE.md ufravikelig navngitt-restart-regel).

**5 migrasjoner anvendt** (bekreftet via `_prisma_migrations` — alle `finished`, 0 blokkerende; prod-DB-migrering-LÅS satt før / sluppet etter):

| Migrasjon | Pakke |
|---|---|
| `20260608120000_oppmotested_fase1` | `@sitedoc/db` |
| `20260609100000_byggeplass_geofence_fase1c` | `@sitedoc/db` |
| `20260609140000_project_type_fase2` | `@sitedoc/db` |
| `20260609160000_reise_regelsett_fase3` | `@sitedoc/db` |
| `20260609140100_sheet_timer_vehicle_id_fase2` | `@sitedoc/db-timer` |

Schema live på prod (stikkprøve): `projects.type`, 5 reise-kolonner på `organization_settings`, `timer.sheet_timer.vehicle_id`, `byggeplasser.radius_m`, `oppmotesteder`-tabell. Web+api HTTP 200.

**Fase 1 — Oppmøtested + GPS-identifikasjon** (impl `ea511e3c`): `Oppmotested`-entitet (kjerne) + `oppmotestedRouter` (firma-admin CRUD + member-lesbar `hentForFirma`) + web `/dashbord/firma/oppmotesteder` (manuell lat/lng) + mobil `oppmotested_local`-cache + GPS-identifikasjon i «Start dag» (Haversine mot geofence-radius → `arbeidsdag_local`, dokumentasjon/forslag, aldri auto-rad). Sannhetskilde [timer.md § Reise og oppmøtested](timer.md).

**Fase 1b — Firma-isolasjons-fiks** (impl `eea004cb`, docs `47a6b38b`; ren additiv logikk, ingen migrasjon): delt `verifiserProsjekterTilhørerFirma(projectIds, orgId)` (union eid/`primaryOrganizationId` ELLER koblet/`ProjectOrganization`) på `tilfoyTimerRad` + `syncBatch` rad-nivå; `redigerSedelRader`+`splittRad` refaktorert til helper; `rapport.ts` sedel-`organizationId`-filter (SHA-modell). Lukker cross-firma-lekkasje. Sannhetskilde [timer.md § Firma-isolasjon](timer.md).

**Fase 1c-server — Byggeplass-geofence** (impl `ee45ead3`): `Byggeplass.latitude/longitude/radiusM` + `beregnByggeplassGeofence(ref, bufferM=100)` (shared) + `bygning.beregnGeofence`/`settGeofence` + auto-fyll i `tegning.settGeoReferanse` (kun når geofence tom) + web override-modal. Løser byggeplass-koordinat-gapet (`fase-0 T.8:990`). Mobil-deteksjon = 1c-mobil (gjenstår, BACKLOG). Sannhetskilde [timer.md § Byggeplass-geofence](timer.md).

**Fase 2 — Ikke-prosjekt-tid (Alt C)** (impl `12678577`): `Project.type "kunde"|"internt"` + `SheetTimer.vehicleId String?` (svak FK → Equipment). `seedInterneProsjekter` (2 interne prosjekter per firma, begge onboarding-modus) — **vilkår 3:** kun `Project`-rader, `syncProjektModulerPaaAktiver` ekskluderer `type="internt"`. `type="internt"`-unntak i `verifiserProsjektmedlem` (smalt) + ny `prosjekt.hentForTimer` (kundevendte lister filtrerer interne ut). **§2.D:** `verifiserKjoretoyTilhørerFirma` org-validerer `vehicleId` på alle skrive-stier. T.2 urørt. Sannhetskilde [timer.md § Ikke-prosjekt-tid](timer.md). **Oppfølger:** `SheetMachine.vehicleId` (drift) IKKE org-validert — BACKLOG sikkerhets-gap.

**Fase 3 — Reise-regelsett (§ B)** (impl `162ef59e`): 5 reise-felt på `OrganizationSetting` (`reiseTerskelMin`/`reiseUnderTerskelType`/`reiseOverTerskelType`/`reisetidTellerOvertid`/`reiseLonnsartId` svak FK → `timer.Lonnsart`). Shared `klassifiserReise`+`estimerReisetidMin`+`avstandMeter`. `oppdaterSetting` (org-validerer `reiseLonnsartId`) + `hentArbeidstidDefaults` utvidet. Web «Reise»-seksjon. Mobil setting-cache + reise-forslag i «Slutt dag» (kontor→byggeplass, **estimat-MVP** ×50 km/t — GPS-faktisk senere; `reisetidTellerOvertid` styrer dagsnorm-terskel). Avvik A: km-godtgjørelse-arter uendret, «Reise/transport» = reisetid-art. Sannhetskilde [timer.md § Reise og oppmøtested](timer.md). **Oppfølger:** reisetid-matrise (Google-kjøretid, anbefalt) + per-prosjekt berettigelse-flagg + kontinuerlig GPS (personvern-gate) — BACKLOG.

**Utestående (ikke prod-blokkerende):** mobil-delene (Fase 1 GPS, Fase 2 `vehicleId`-UI, Fase 3 reise-forslag) når brukere først via EAS-bygg; innlogget prod-verifisering i nettleser (Kenneth).

## § Timer auto-select lønnsart (Variant A + B) + auth-fiks — DEPLOYET TIL PROD 2026-06-06 (prod-merge `ac1a4367`)

Bunke på fire develop-commits, samlet prod-deployet 2026-06-06. Begge migrasjoner (`@sitedoc/db` + `@sitedoc/db-timer`) kjørt, klienter regenerert. Web `sitedoc.no` + api `api.sitedoc.no/health` HTTP 200. PM2 restart: `sitedoc-api` (pid 873348), `sitedoc-web` (pid 873368).

| Commit | Innhold |
|--------|---------|
| `13c33ed6` | **Variant A** — `TimerSeksjon.tsx`: ny rad forhåndsvelger forrige rads `lonnsartId` + `aktivitetId` på samme sedel (`defaultValg`-useMemo, speiler `defaultTider`). Full-bredde «Legg til timer-rad»-knapp ved tom sedel. Klient-only. |
| `336acdcb` | **Duplikat-fiks** — stiplet «+Legg til timer»-knapp i EcoBucket gates på `rader.length > 0` så den ikke vises samtidig som tom-tilstand-knappen. |
| `5d3e8579` | **Variant B** — `Lonnsart.erStandardvalg` + migrasjon `20260605180000_lonnsart_er_standardvalg` (additiv + backfill «Timelønn»). Seed markerer «Timelønn». `timer.lonnsart.settStandard` (maks én per org). Web stjerne-kolonne. Mobil cache + `hentStandardLonnsartLokalt`. Prioritetskjede: forrige rad → firma-default → tom. i18n 14 språk (2442→2445). |
| `0a79c42c` | **Auth-fiks** — `mobilAuth.verifiser` roterer ikke `sessionToken` lenger (forlenger kun `expires`), eliminerer startup-race der samtidige queries med gammelt token traff allerede-rotert sesjon → UNAUTHORIZED → utlogging. Sikkerhets-rotasjon beholdt i 7-dagers H1-mutation-middleware. |

**Prod-migrasjon-merknad:** Variant B-backfill traff 0 rader i prod (vs 1 i test) fordi prod-firmaet kun har Nivå 2-pakken (25 lønnsarter) seedet — ingen «Timelønn» (Nivå 1) å markere. Korrekt oppførsel; firma-admin kan markere default via web-stjernen, eller får «Timelønn» auto-markert hvis Nivå 1 seedes.

**Mobil-verifisering utestående:** Variant A/B + auth-fiks på enhet kunne ikke verifiseres i iOS-simulator pga Cloudflare↔Expo-Go-quirk (POST `/dev-login` svarer 200 på server, men responsen når ikke simulatoren — bekreftet via server-logg req-41) + Google passkey-prompt. Tas på fysisk enhet via TestFlight ved neste EAS-bygg. Web-delen av Variant B (stjerne-kolonne) verifiserbar direkte på `sitedoc.no`.

## § Mobil hentMineMedlemskap-bug (sitedoc_admin + standalone-/prosjekt-uten-firma-brukere) — FIKSET + verifisert i TestFlight build #29 (2026-06-02)

**Symptom (rapportert fra build #27/#28 TestFlight):** Bruker ser tom Hjem-skjerm med evig «Henter prosjekter…»-spinner, ingen prosjekter, ingen firma-velger. Gjelder prosjektadmin/medlemmer som ikke er `OrganizationMember`.

**Rotårsak (avdekket 2026-06-02 via Expo-simulator + iOS Console-diagnose):** Klienten gatet prosjekt-lasting på valgt firma — `enabled: !!valgtFirmaId` i `hjem.tsx` og `ProsjektVelger.tsx`. Bruker uten firma (eller med flere firmaer der ingen var auto-valgt) → query disabled → TanStack `isLoading=true` permanent → evig spinner. Serveren (`prosjekt.hentMine`) var aldri problemet — den returnerer alltid brukerens prosjekter (`members.some.userId`), med firma-filter kun når `organizationId` sendes.

**Fiks (2 deler):**

1. **Server-fallback** (commit `17e0419e`, prod-merge `21555a5c`, prod-deploy 2026-06-02): `hentMineMedlemskap` (`apps/api/src/routes/organisasjon.ts`) utleder firmaer fra `ProjectMember → Project.primaryOrganizationId` når bruker har 0 `OrganizationMember`-rader. Lukker firma-velger for prosjekt-medlemmer uten org-medlemskap. Live i prod.

2. **Klient-fiks** (commit `9e1bbf02`): `enabled: !!valgtFirmaId || (!lasterFirmaer && firmaer.length === 0)` i `hjem.tsx:116` + `ProsjektVelger.tsx:25`. 0-firma-brukere (kun standalone-prosjekt) får nå prosjektene lastet uten firmavalg — serveren returnerer alle prosjektene uten firma-filter. Diagnose-logging fjernet fra `FirmaKontekst.tsx` (commit `d9d90322`).

**Deploy + bygg:**
- Prod-server (web+api): prod-merge `21555a5c`, deployet 2026-06-02 (HTTP 200 `sitedoc.no` + `api.sitedoc.no/health`).
- EAS build #29 (iOS, commit `9e1bbf02`), submittet til TestFlight (submission `362bac68`).

**Verifisert 2026-06-02 (Kenneth, TestFlight build #29):** «Velg prosjekt» viser alle prosjekter brukeren er medlem av. Bekreftet fungerende i release-bygg.

**Bi-funn under sesjonen:**
- «Ukjent bruker»-meldingen ved utlogging kommer fra `mer.tsx` (`bruker?.name ?? "Ukjent bruker"`). Vises kortvarig når `setBruker(null)` rendres før navigasjon til logg-inn. Forventet adferd, ikke bug.
- Sist brukte firma + prosjekt persisteres allerede i SecureStore (`FirmaKontekst.tsx` + `ProsjektKontekst.tsx`) og gjenopprettes ved oppstart — appen åpner sist brukte prosjekt automatisk ved normal gjenåpning. «Velg prosjekt» vises kun etter fersk innlogging (intet lagret valg ennå).
- Re-login etter ny build skyldtes sletting+reinstall (fersk install tømmer Keychain/SecureStore), ikke en build-bug. En vanlig TestFlight-*oppdatering* beholder innloggingen.

**Diagnose-vei-lærdommer:**
- `console.log` fra et Hermes release-/TestFlight-bygg når **ikke** fram til Mac Console.app (kun native os_log-støy vises). Diagnose-logging i release-bygg er en blindvei — bruk dev-build mot Metro, eller les koden.
- Dev-login (`/dev-login`) returnerer 404 mot prod (kun test/lokal). Native Google-OAuth round-tripper ikke i Expo Go/`expo start` (custom URL-scheme ikke registrert) — kun i standalone/dev-client-bygg.

## § OAuth-innlogging: account-linking + orphan-guard + duplikat-opprydding — DEPLOYET TIL PROD 2026-06-05

Tre sammenhengende auth-forbedringer. Rotmekanisme: firma-ansatte logget inn med privat Gmail i stedet for invitert jobb-e-post → tomme orphan-kontoer uten firma/prosjekt som låste e-poster og ga «ser ingenting»-opplevelse. I tillegg kunne inviterte `@firma.no`-kontoer (User-rad uten OAuth-konto) ikke logge inn første gang pga `OAuthAccountNotLinked`.

### 1. Google↔Microsoft account-linking (prod-merge `e12355d9`)
`allowDangerousEmailAccountLinking: true` på begge OAuth-tilbydere i `apps/web/src/auth.ts`. Lar bruker logge inn med enten Google eller Microsoft 365 på samme e-post og lande på samme konto — fjerner `OAuthAccountNotLinked`. **Reverserer H3-audit (2026-05-27)**; trygt fordi begge IdP-er (Google + Microsoft) verifiserer e-post-eierskap, så den klassiske konto-overtakelse-vektoren (useriøs tilbyder) ikke gjelder.

### 2. signIn-guard mot orphan-kontoer (prod-merge `f6522a94`, commit `ef5906bb`)
Blokkerende `signIn`-callback i `auth.ts`: slipper kun gjennom hvis **(a)** eksisterende `canLogin`-User på e-posten (case-insensitiv), **(b)** ventende `ProjectInvitation`, **(c)** allerede koblet OAuth-konto via `accounts` (returnerende bruker — kritisk for e-postendringer), **(d)** `sitedoc_admin` (dekket av a). Ellers `return false` → **ingen User opprettes**, e-posten forblir fri. Feilmelding `auth.feil.AccessDenied`: «Du har ikke tilgang. Bruk e-posten du ble invitert med, eller kontakt administrator.» (14 språk). **Verifisert på test.sitedoc.no:** uinvitert innlogging (`kmy@sitedoc.no`) avvist, `sitedoc_test` users uendret (27), ingen User-rad opprettet → `return false` hindrer opprettelsen, ikke bare sesjonen. **Gjelder kun web-OAuth; mobil (`mobilAuth.byttToken`) er IKKE dekket — eget oppfølgingspunkt.**

### 3. Duplikat-/orphan-opprydding (prod-DB, read-only FK-sjekk før hver DELETE)
- A.Markussen: slettet typo-konto «Mathias Jensen 2» (`mathias.jenssen989@gmail.com`, 0 innlogginger) — medlemskap var duplikat av jobbkontoen `mathias@amarkussen.no`.
- Slettet gmail-orphans `malinbacklund89@gmail.com` og test-orphan `kmy@sitedoc.no`.
- Beholdt (per beslutning): `mathias.jensen989@gmail.com` (personlig login) + `mathias@amarkussen.no` (jobb) som to separate gyldige kontoer.

### 4. Mobil orphan-guard (oppfølger) — DEPLOYET TIL PROD 2026-06-05 (prod-merge `f3a16cef`, commit `91fa7867`)
Tilsvarende guard lagt til i `mobilAuth.byttToken` (`apps/api/src/routes/mobilAuth.ts`): før User-opprettelse sjekkes samme a/b/c/d-regler som web-guarden — (a) eksisterende canLogin-bruker (case-insensitiv), (b) ventende `ProjectInvitation`, (c) allerede koblet konto (slått opp før opprettelse → returnerende bruker), (d) sitedoc_admin (dekket av a). Ellers `TRPCError FORBIDDEN` med samme melding. Mobil-innlogging lager ikke lenger orphan-kontoer. Både web- og mobil-OAuth er nå dekket.
