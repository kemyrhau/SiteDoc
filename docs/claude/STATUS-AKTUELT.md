---
name: STATUS-AKTUELT
description: Løpende statusrapport for pågående arbeid, pauset arbeid og planlagte faser. Oppdateres ved hver vesentlig fremdrift.
sist_verifisert_mot_kode: 2026-05-08
---

# SiteDoc — aktuell status

Detaljert løpende statusrapport. CLAUDE.md har kort sammendrag øverst med
peker hit. Beslutningsgrunnlag og arkitektur ligger i
[fase-0-beslutninger.md](fase-0-beslutninger.md) og
[arkitektur-syntese.md](arkitektur-syntese.md).

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

### #3 — Tidspunkt (fra/til) per linje i timeføringen 🟡 (T.4-bunken pågår)

**Side:** Timeføring.

Schema + server-input på plass (T.4). UI-felt og fra<til-validering mangler.

`SheetTimer.fraTid`/`tilTid` (`packages/db-timer/prisma/schema.prisma:183-184`) og `SheetMachine.fraTid`/`tilTid` (linje 256-257) er lagt til som `String? @map("fra_tid"/"til_tid")`. Server tar imot feltene i `timer.dagsseddel.tilfoyTimerRad` (`apps/api/src/routes/timer/dagsseddel.ts:372-373, 417-418`) og `redigerTimerRad` (1506-1507, 1533-1534). Mangler: server-side validering `fraTid < tilTid` (kommentar på schema-linje 183 lover dette i PR 2, ikke implementert ennå) + UI-felt for inntasting i web/mobil-skjemaene.

**T.4-implementasjons-bunke (planlagt 5 sub-PR-er):**

| Sub-PR | Status | Innhold |
|---|---|---|
| **T4-a** | ✅ Merget til develop 2026-05-16 (merge `5acd2a5d`, impl `cfe51fc5`) | Schema + migrasjon. `OrganizationSetting.standardStartTid/SluttTid/PauseMin` (defaults 07:00/15:00/30) + `ArbeidstidsKalender.standardStartTid?/SluttTid?/pauseMin?` (overstyring for sommertid_start/slutt/halvdag). Additiv migrasjon, ingen breaking. |
| **T4-b** | ✅ Merget til develop 2026-05-16 (merge `9bcfb5b1`, impl `088a1e37`) | `hentEffektivArbeidstid(orgId, dato)`-helper i `apps/api/src/services/timer/arbeidstid.ts` (sommertid-overstyring → firma-default). Hard sommertid-par-validering i kalender opprett/oppdater (`sommertid_start` krever `sommertid_slutt` samme år). |
| **T4-c** | ✅ Deployet til test 2026-05-16 (merge `c02df657`, impl `39c43aa8`) | Server-Zod-utvidelse for de tre T4-a-feltene i `oppdaterSetting` + kalender `opprett`/`oppdater` (+ `validerTidsfelter`-helper). Innstillinger-side: ny `StandardArbeidstidSeksjon`. Kalender-modal: betinget visning av tidsfelter for sommertid_start/slutt/halvdag + klokke-badge i månedsliste. 15 nye i18n-nøkler → 13 språk (2277 totalt). Venter på visuell verifisering før prod-merge. |
| **T4-d** | ✅ Merget til develop + deployet til test 2026-05-16 (merge `7bee1633`, impl `2f7bf42d`) | Mobil Drizzle: `fraTid`/`tilTid` på `sheet_timer_local` + `sheet_machine_local`. Nye lokale tabeller `arbeidstidskalender_local` + `organization_setting_local`. Nye services `kalenderKatalog.ts` (med `hentEffektivArbeidstidLokal`-helper, speil av server) + `organizationSettingKatalog.ts`. TimerSyncProvider utvidet til 2-stegs Promise.all (base-pulls → firma-spesifikke pulls per org-id fra prosjekt-cachen). `timerSync` push/pull utvidet med fraTid/tilTid per timer/maskin-rad. Server: ny medlems-tilgjengelig `organisasjon.hentArbeidstidDefaults` + fraTid/tilTid lagt til i `hentEndringerSiden`-respons-mapping. Typecheck 12 = 12 baseline. Venter på enhet-verifikasjon + prod-merge. |
| **T4-e** | ✅ Merget til develop + deployet til test 2026-05-16 (merge `e992aca3`, impl `cea8f99e`) | Mobil UI. Ny `FraTilTidFelt`-fellekomponent (DateTimePicker mode=time, 2 felter side ved side). Montert i TimerRadModal + MaskinRadModal. Forhåndsutfylling: ny rad uten forrige rader → `hentEffektivArbeidstidLokal(orgId, dato)` (kalender + firma-default). Ny rad med forrige rader → forrige rads tilTid som fraTid. Rediger eksisterende → radens egne verdier. Validering: fraTid < tilTid hvis begge satt (`fraErForTil`-helper). Lagring til Drizzle med syncStatus=pending. SummeringsBanner: arbeidstidTimer faller tilbake til kalender-dagsnorm hvis sedel.startAt/endAt mangler — UI viser alltid relevant sammenligning. Rad-visning utvidet med `HH:MM–HH:MM`-tekst. 0 nye i18n-nøkler — gjenbruker `timer.felt.startTid/sluttTid` + `timer.feil.sluttForStart`. Typecheck 12 = 12 baseline. Venter på enhet-verifikasjon + prod-merge. |
| **T.5 tidsrunding** | 🟡 Implementert på `feature/t5-tidsrunding` 2026-05-16 | Server: `oppdaterSetting` Zod-input + `hentArbeidstidDefaults` select utvidet med `tidsrundingMinutter`. Validering: `z.union([15, 30, 60, null])`. Web: ny dropdown i `StandardArbeidstidSeksjon` (Ingen/15/30/60). RedigerTimerRad + RedigerMaskinRad: `step={tidsrundingMinutter * 60}` + onBlur-fallback-runding via `apps/web/src/lib/tidsrunding.ts`. AttesteringDetalj_Edit henter `tidsrundingMinutter` fra `hentSetting` og passerer som prop. Mobil-cache: `organization_setting_local.tidsrunding_minutter` (idempotent ALTER) + service skriver feltet. Mobil-UI: ny `apps/mobile/src/utils/tidsrunding.ts` (speil av web). FraTilTidFelt fikk ny `tidsrundingMinutter`-prop + runder onChange-verdi før callback. `minuteInterval` på DateTimePicker for 15/30 hint til pickeren. TimerSeksjon + MaskinSeksjon henter via `hentOrganizationSettingLokalt`. 6 nye i18n-nøkler → 13 språk (2277 → 2283 totalt). Typecheck 0 nye feil i alle apper. Venter på review + enhet-verifikasjon. |

**T.4-bunken komplett på develop + test 2026-05-16:** Alle fem sub-PR-er (a/b/c/d/e) er merget og kjører på `test.sitedoc.no` + `api-test.sitedoc.no` (HTTP/2 200, migrasjoner kjørt i `sitedoc_test`). Neste: (1) Kenneth verifiserer T4-c web-UI + T4-d/e mobil-UI på testbygg (forhåndsutfylling, validering, fra/til-visning på rad). (2) Etter verifikasjon → prod-deploy av hele bunken samtidig (server-migrasjon, web-deploy, mobil-bygg via EAS → TestFlight/Play Store).

### #4 — Redigering og splitting av timer ved attestering 🟡

**Side:** Attestering.

Attesterende skal kunne redigere antall timer og splitte en rad i flere. **Steg 4a (ECO-flytt på attestering)** ble deployet til prod 2026-05-03 (`f98fa7a5`) — leder kan endre kostnadsbærer per rad. Mangler: redigering av timeantall + rad-splitting + audit-log på endringer.

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

### #8 — Fagområde og oppgaver i sjekklistemaler-listevisning 🔴

**Side:** Innstillinger – Produksjon – Sjekklistemaler.

`apps/web/src/app/dashbord/oppsett/produksjon/_components/MalListe.tsx` har kun 3 kolonner: Navn (`tabell.navn`), Prefiks (`maler.prefiks`), Versjon (`maler.versjon`). Mangler kolonner for fagområde og oppgaver.

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

---

## Pågående arbeid

### attestering-hint — kontekstuell hint om redigering DEPLOYET TIL PROD 2026-05-14 (prod-commit `d194332c`)

Diskret blå info-stripe i `AttesteringDetalj.tsx` under container-banneret. Synlig kun for firma-admin (gated via `kanAttestereFirma`-query mot sheet.organizationId) når `sheet.redigerTillatt === false`. 💡-emoji + tekst «Vil firmaet korrigere timer direkte under attestering?» + lenke til `/dashbord/firma/innstillinger#rediger-ved-attestering`. 2 nye i18n-nøkler (`timer.attestering.redigerHint.tekst` + `.lenke`) i nb/en, auto-oversatt til 13 språk. Progressive Disclosure-mønsteret — kan gjenbrukes andre steder.

### Server-side fix: `deploy-test-cron.sh` cache-bug DEPLOYET PÅ TEST-SERVER 2026-05-14

Auto-deploy-skriptet `~/programmering/deploy-test-cron.sh` (cron hvert 2. min på test-serveren) hadde en stale `.next`-cache-bug som trigget «Cannot read properties of undefined (reading 'clientModules')»-feilen tre ganger denne uken (T7-2b1, T7-2b3, attestering-hint). Hver gang krevde manuell `rm -rf apps/web/.next + pnpm build + pm2 restart` på test for å løse.

**Fiks:** Lagt til `STEG="clean_next" && rm -rf apps/web/.next` som eget steg i deploy-pipelinen mellom `prisma_migrate` og `build`. Trade-off: hver auto-deploy gjør nå full rebuild fra scratch (~30-60s lengre) i stedet for inkrementell, men eliminerer cache-divergens-bug. Backup-fil: `~/programmering/deploy-test-cron.sh.bak` på serveren.

Skriptet er **ikke i repoet** — det ligger kun på test-serveren. Endringen er server-side og påvirker ikke prod (`./deploy.sh` gjør allerede full rebuild).

### PR T7-3d per-rad-attestering for leder på mobil — Klar for review (branch `feature/t7-3d`)

Fjerde sub-PR av T7-3-bunken. Bringer attestering-flyten (T7-2b) til mobil-app. Prosjektledere og firma-admin kan nå attestere/returnere innsendte sedler fra telefonen — speil av webs `AttesteringDetalj`, forenklet for mobil-flate.

**Filer (alle nye, `apps/mobile`):**
- `src/components/timer-attestering/AttesteringStatusBadge.tsx` (~40 linjer)
- `src/components/timer-attestering/RadCheckbox.tsx` (~80 linjer)
- `src/components/timer-attestering/ReturnerModal.tsx` (~115 linjer)
- `src/components/timer-attestering/AttesteringDetaljMobil.tsx` (~360 linjer) — kjernekomponent. Tre rad-seksjoner med checkboxer, container-banner, bunn-action-bar. Pre-utvalg av pending-rader ved sideåpning. Cache-invalidering ved attester/returner.
- `app/timer/attestering/index.tsx` (~150 linjer) — liste-side. Henter via `hentTilAttesteringFirma`. Kort-format med dato/ansatt/prosjekt/sum. Gating-bannere ved ingen tilgang.
- `app/timer/attestering/[id].tsx` (~50 linjer) — tynn wrapper med tilbake-bar.

**Endret:**
- `app/(tabs)/mer.tsx` — ny menylenke «Attester timer» gated på `kanAttestereFirma`. Lenken er skjult for arbeidere uten leder-tilgang. Henter `orgId` via samme `prosjekt.hentMine`-proxy som liste-siden.

**Server/skjema:** Null endring. Bruker eksisterende `hentTilAttesteringFirma`, `hentForAttestering`, `kanAttestereFirma`, `attesterRader`, `returnerRader` fra T7-2b1.

**i18n:** Null nye nøkler. Alle gjenbrukt fra T7-2b.

**Forenklinger ifht. web (bevisst scope-redusering):**
- Ingen edit-modus (T7-2b2) — firma-admin redigerer på web
- Ingen ECO-flytting per rad — utelates på mobil
- Ingen rediger-header-modal
- Kun firma-kontekst (ingen `prosjektKontekst`-prop) — mobil-tabs er firma-orienterte

**Auth/datastrøm:** Online-only. Mutations krever nett (samme som web — snapshot-bygging via Fase 0 A.7). Ingen lokal queue.

**Verifisert:** `apps/api` typecheck 0 = 0 feil. `apps/mobile` typecheck 12 = 12 baseline (0 nye feil).

**Reload-metode:** TypeScript-only. Full app-reload eller `r` i Metro. Ingen native rebuild.

Klar for review — ikke merge før Kenneth verifiserer på enhet.

### T7-3-bunken (a/b1/b2) — DEPLOYET TIL PROD (server-route) + venter på mobil-bygg (2026-05-14)

Tre sub-PR-er av T7-3 (mobil timer-redesign) merget til develop og deretter til main (prod-commit `223afc17`). Server-endringene (rad-nivå `projectId` i `syncBatch` + `hentEndringerSiden` + auth per unike rad-projectId) er aktive i prod. Mobil-endringene venter på Expo Go-test (utvikler-enhet) eller EAS Build → TestFlight / Play Store (release).

| Sub-PR | Merge-commit | Impl-commit | Innhold |
|---|---|---|---|
| **T7-3a** | `22a97402` | `fc087b65` | Arbeidstid-seksjon + summerings-banner i mobil-detalj. Speil av T7-1a på mobil. |
| **T7-3b1** | `cd64c51a` | `65bf48cb` | Per-rad `projectId` (skjema + lokal migrasjon + sync push/pull + prosjekt-katalog-cache). Ingen UI. |
| **T7-3b2** | `3e34ec71` | `1717fd79` | UI for per-rad prosjekt-velger + ProsjektGruppe-visning i [id].tsx + geo-forslag i ny.tsx. |

Lokal SQLite-migrasjon (T7-3b1) er fullt additiv og idempotent. Server-input/respons er additivt utvidet — pre-T7-3b-mobiler fortsetter å fungere uendret (kompat-shim). Server-shim på sedel-nivå `projectId` ryddes opp i T7-4+ etter alle telefoner kjører ny app.

**Bygg-rute videre:**
1. **Utvikler-test:** Kenneth tester på enhet via Expo Go eller tilkoblet utviklingsbygg.
2. **EAS Build:** `eas build --platform ios --profile production` + `eas submit --platform ios --latest` for TestFlight når UI er bekreftet.
3. **Release-windows:** Når TestFlight-build er trygt, distribusjon til alle brukere.

**Gjenstår av T7-3-bunken:**
- **T7-3c** (planlagt eller forkastet): Mye av geo-forslag-leveransen ble inkludert i T7-3b2. Egen sub-PR kan dekke historikk-baserte forslag (sist brukte prosjekt) eller forkastes.
- **T7-3d** (planlagt eller forkastet): Per-rad-attestering på mobil for prosjektleder/firma-admin. Krever strategisk valg om mobil-attestering eller web-only.

### PR T7-3b2 prosjekt-velger per rad + geo-forslag — MERGET TIL DEVELOP (branch `feature/t7-3b2`, merge `3e34ec71`, impl `1717fd79`)

Tredje sub-PR av T7-3-bunken. Nå kan brukeren faktisk bruke per-rad-prosjekt: hver rad-modal har prosjekt-velger på toppen, dagsseddel-detaljsiden grupperer rader per prosjekt (én bolk med tre seksjoner per prosjekt), og «+ Legg til prosjekt»-knapp åpner velger for et nytt prosjekt på samme sedel. Ved opprettelse av ny dagsseddel foreslås nærmeste prosjekt basert på GPS.

**Klient-filer:**
- **Ny** `apps/mobile/src/components/timer-detalj/ProsjektVelger.tsx` (~130 linjer) — gjenbrukbar `ProsjektVelgerModal` (søk når > 7 prosjekter, `ekskluderIder`-prop) + trigger-knapp `ProsjektFelt`. Leser `prosjektLocal` via `hentProsjekterLokalt`.
- `apps/mobile/src/components/timer-detalj/TimerSeksjon.tsx` — `organizationId`-prop tilført. `leggTil`/`oppdater` skriver `projectId` per rad. `TimerRadModal` har ProsjektFelt øverst. Bytte av prosjekt nullstiller ECO (`valgtEcoId`) siden Underprosjekt er prosjekt-spesifikk.
- `apps/mobile/src/components/timer-detalj/TilleggSeksjon.tsx` — samme mønster: `organizationId` + `projectId` props, rad-modal med ProsjektFelt.
- `apps/mobile/src/components/timer-detalj/MaskinSeksjon.tsx` — samme.
- `apps/mobile/app/timer/[id].tsx` — beregner `aktiveProsjektIder` (union av sedel.projectId, alle rad.projectId, bruker-tilføyde ekstra-grupper). Rendre én `ProsjektGruppe` per id med tre seksjoner og filtrerte rader. Prosjekt-header (blå mini-bånd) vises kun ved multi-prosjekt. «+ Legg til prosjekt»-knapp åpner ProsjektVelgerModal med `ekskluderIder=aktiveProsjektIder`.
- `apps/mobile/app/timer/ny.tsx` — geo-forslag-hook: `Location.requestForegroundPermissionsAsync` → `getCurrentPositionAsync(Balanced)` → Haversine mot `hentProsjekterLokalt(orgId)` med 500m radius. Stille fallback ved permission-avslag eller ingen treff. `MapPin`-ikon + «Foreslått basert på posisjon»-tekst når geo-forslag er aktivt.

**Server/skjema:** Null endring. Alt fundament fra T7-3b1.

**i18n:** 1 ny nøkkel (`handling.sok` = «Søk» / «Search»). Rettet pre-eksisterende bug der eksisterende velgere brukte en t-key som ikke fantes (fallback ga «handling.sok» som ren tekst i UI). `timer.leggTilProsjekt`, `timer.geoForslag`, `timer.felt.prosjekt`, `timer.velgProsjekt`, `timer.ingenTilgjengelige` allerede definert. Auto-oversatt til 13 språk via `generate.ts`.

**`app.json`/permissions:** `expo-location` v19.0.8 allerede installert + config-plugin med norsk permission-tekst tidligere konfigurert for GPS-tagging av bilder. Null app.json-endring.

**Verifisert:** `apps/api` typecheck 0 = 0 feil. `apps/mobile` typecheck 12 = 12 baseline (0 nye feil). ECO-bytte ved prosjekt-bytte: `valgtEcoId` nullstilles i `TimerRadModal` når ProsjektVelger setter ny `valgtProjectId`.

**Reload-metode:** TypeScript- + i18n-endring. Full app-reload (close + open eller `r` i Metro). Ingen native rebuild (expo-location er allerede konfigurert).

**Forventede begrensninger:**
- Per-rad-attestering på mobil — kommer i T7-3d eller forkastes hvis attestering forblir web-only.
- `dagsseddelLocal.projectId` beholdes som default. NOT NULL → drop kommer i T7-4+.
- Geo-forslag krever permission ved første kjøring — brukeren får OS-dialog. Avslag = fall tilbake til manuell velger.

Klar for review — ikke merge før Kenneth verifiserer på test.

### PR T7-3b1 prosjekt per rad — skjema + sync + katalog — MERGET TIL DEVELOP (branch `feature/t7-3b1`, merge `cd64c51a`, impl `65bf48cb`)

Andre sub-PR av T7-3-bunken. Legger inn fundamentet for at hver rad på en mobil-dagsseddel kan tilhøre sitt eget prosjekt — uten å endre brukervendt UI ennå. Etter denne kan sync-protokollen bære per-rad-projectId mellom mobil og server, lokal SQLite har feltet, og brukerens prosjekter cacheres lokalt klare for rad-velger i T7-3b2.

**Klient-filer:**
- `apps/mobile/src/db/schema.ts` — `projectId: text("project_id")` (nullable) på `sheetTimerLocal/sheetTilleggLocal/sheetMachineLocal`. Ny `prosjektLocal`-tabell (id, organizationId, name, projectNumber, lat, lng, aktiv, sistOppdatert).
- `apps/mobile/src/db/migreringer.ts` — idempotent ALTER ADD COLUMN på de tre rad-tabellene + backfill fra parent `dagsseddel_local.project_id` (UPDATE WHERE NULL) + indekser. Ny CREATE TABLE for prosjekt_local + indeks (organization_id, aktiv).
- **Ny** `apps/mobile/src/services/prosjektKatalog.ts` (~95 linjer): `refreshProsjektKatalog` henter `trpc.prosjekt.hentMine`, hopper over standalone-prosjekter (uten `primaryOrganizationId`), lagrer til prosjekt_local med full overskriving. Eksponerer `hentProsjekterLokalt(orgId)` og `finnProsjektLokalt(id)` for kommende UI.
- `apps/mobile/src/providers/TimerSyncProvider.tsx` — `refreshProsjektKatalog` lagt til i `Promise.all` ved login + nett-gjenkomst (samme mønster som `refreshMaskinKatalog`).
- `apps/mobile/src/services/timerSync.ts` — push (`syncBatch`): hver rad sender `projectId: rad.projectId ?? sedel.projectId` (rad-nivå hvis satt, ellers fallback). Pull (`hentEndringerSiden`): lagrer `t.projectId ?? sedelProjectId` til hver rad i lokal SQLite.

**Server-filer (`apps/api/src/routes/timer/dagsseddel.ts`):**
- `syncBatch`-input: alle tre rad-array-objekter får `projectId: z.string().uuid().optional()`. CreateMany bruker `t.projectId ?? lokal.projectId` (rad overstyrer sedel; fallback for pre-T7-3b1-klienter).
- `hentEndringerSiden`-respons: timer/tillegg/maskiner returnerer `projectId` per rad i tillegg til det aggregerte `projectId` på sedel-nivå (proxy via første rad — beholdes for bakoverkompatibilitet).
- Ny auth-sjekk i syncBatch: `verifiserProsjektmedlem` kalles per unike rad-`projectId` som avviker fra `lokal.projectId`. Forhindrer at bruker fører timer på prosjekt de ikke er medlem av via per-rad-attributt.

**Server-skjema:** Null endring. `db-timer.SheetTimer/Tillegg/Machine.projectId` ble lagt inn med T.1/PR 1B (2026-05-11). Bare server-route-koden var fortsatt sedel-nivå-orientert.

**i18n:** Ingen endringer (ingen UI-strenger i denne PR-en).

**Verifisert:** `apps/api` typecheck 0 = 0 feil. `apps/mobile` typecheck 12 = 12 baseline (samme pre-eksisterende feil i `hjem.tsx`/`mer.tsx`/`oppgave/[id].tsx`/`psi/[psiId].tsx`/`sjekkliste/[id].tsx`/`useOppgaveSkjema.ts`/`useSjekklisteSkjema.ts`/`timerSync.ts`).

**Migrasjonsstrategi (to-stegs-policy):**
- Lokal SQLite-migrasjon er fullt-additiv (nullable ALTER ADD COLUMN + idempotent CREATE TABLE IF NOT EXISTS). Trygt ved app-oppstart.
- Server-input er additivt utvidet med optional-felt — pre-T7-3b1-mobiler fungerer uendret (sender ikke `projectId` per rad → server bruker shim).
- Server-respons er additivt utvidet — pre-T7-3b1-mobiler ignorerer det nye feltet (TypeScript-strukturen kjenner bare gamle felter).
- `dagsseddelLocal.projectId` beholdes som default-prosjekt + fallback. NOT NULL → drop kommer i T7-4+ etter alle telefoner har migrert.

**Reload-metode:** TypeScript- + Drizzle-skjema-endring. Krever full app-reload (close + open eller `r` i Metro) ved første installasjon slik at `migreringer.ts` kjører ALTER-statementene. Ingen native rebuild — alle endringer er JS + SQL.

**Forventede begrensninger (kommer i T7-3b2/c/d):**
- Ingen UI for per-rad-prosjektvelger ennå. Alle nye rader får automatisk `sedel.projectId` via fallback. T7-3b2 leverer rad-nivå-velgeren.
- Geo-forslag (lat/lng-feltene i prosjekt_local) brukes ikke ennå — kommer i T7-3c.
- Per-rad-attestering på mobil — kommer i T7-3d (eller forkastes hvis attestering forblir web-only).

Klar for review — ikke merge før Kenneth verifiserer på test.

### PR T7-3a arbeidstid-seksjon + summerings-banner på mobil — MERGET TIL DEVELOP (branch `feature/t7-3a`, merge `22a97402`, impl `fc087b65`) — venter på mobil-bygg

Første sub-PR av T7-3-bunken (mobil timer-redesign). Speil av T7-1a på mobil. Etter denne kan en arbeider sette start-/slutt-tid og pause på dagsseddel-detaljsiden i mobil-appen og se løpende summering av registrerte timer vs utledet arbeidstid før innsending. Ingen DB-migrasjon, ingen sync-endring, ingen server-endring.

**Filer:**
- **Ny** `apps/mobile/src/components/timer-detalj/ArbeidstidSeksjon.tsx` (~270 linjer) — visning + edit-modal med `DateTimePicker` (time-mode, 24h) for startAt/endAt + number-input for pauseMin. Skriver direkte til `dagsseddelLocal` via drizzle, setter `syncStatus="pending"` så `TimerSyncProvider` propagerer endringen i neste sync-runde.
- **Ny** `apps/mobile/src/components/timer-detalj/SummeringsBanner.tsx` (~45 linjer) — viser registrert vs total arbeidstid. Grønn ved `totaltimer >= arbeidstidTimer`, gul ellers, grå hvis arbeidstid mangler.
- `apps/mobile/src/utils/dato.ts` — ny `isoTidspunktTilHHMM(iso)`-helper.
- `apps/mobile/app/timer/[id].tsx` — monterer ArbeidstidSeksjon over TimerSeksjon, beregner `arbeidstidTimer = (endAt - startAt) - pauseMin/60` og `totaltimer` via `useMemo`. SummeringsBanner over Send-knappen (kun når `erRedigerbar`).

**Server/skjema:** Null endring. `dagsseddel.upsert`/`syncBatch` aksepterte allerede `startAt/endAt/pauseMin` fra T7-1a-deploy 2026-05-12. `dagsseddelLocal`-skjemaet har feltene fra Runde 2.

**i18n:** Gjenbruker T7-1a-nøkler (`timer.arbeidstidIDag*`, `timer.summering`, `timer.felt.startTid/sluttTid/pauseMin`). 2 nye feilmeldinger i nb/en (`timer.feil.ugyldigPause`, `timer.feil.sluttForStart`) auto-oversatt til 13 språk via `generate.ts`.

**Verifisert:** `apps/mobile` typecheck 12 = 12 baseline (0 nye feil). Pre-eksisterende mobil-typecheck-feil i `hjem.tsx`, `mer.tsx`, `oppgave/[id].tsx`, `psi/[psiId].tsx`, `sjekkliste/[id].tsx`, `useOppgaveSkjema.ts`, `useSjekklisteSkjema.ts`, `timerSync.ts` uberørt.

**Reload-metode:** Telefon-app er JS-only-endring — Expo Go: rist for å reloade, eller `r` i Metro-bundleren. Ingen native rebuild (ingen nye pods/permissions).

**Forventede begrensninger (kommer i T7-3b/c/d):**
- Sedel er fortsatt prosjekt-bundet (`sedel.projectId`) — multi-prosjekt på rad-nivå kommer i T7-3b
- Ingen geo-forslag ved sedel-opprettelse — kommer i T7-3c
- Per-rad-attestering på mobil — kommer i T7-3d eller forkastes hvis attestering forblir web-only

Klar for review — ikke merge før Kenneth verifiserer på test.

### PR T7-2b3 settings-toggle for «Tillat redigering ved attestering» DEPLOYET TIL PROD 2026-05-14 (prod-commit `af4a7deb`)

**T7-2b-bunken er nå komplett i prod:**

| PR | Prod-commit | Innhold |
|---|---|---|
| T7-2b1 | `3234c057` | Per-rad-attestering + AttesteringDetalj-felleskomponent + firma-detalj-side |
| T7-2b2 | `755c542a` | Edit-modus + `redigerSedelRader`-mutation + `parent_rad_id` + `tillatt_rediger_ved_attestering`-flagg (default false) |
| T7-2b3 | `af4a7deb` | Settings-toggle for å skru flagget på |

`tillatt_rediger_ved_attestering` er fortsatt false for alle firmaer i prod — Rediger-knappen er dormant overalt. Firma-admin kan skru på via `/dashbord/firma/innstillinger` ved behov.

Siste sub-PR av T7-2b-bunken. Aktiverer firma-admin til å skru `OrganizationSetting.tillattRedigerVedAttestering` på/av via UI. Når flagget er true, viser Rediger-knappen seg i attestering-detalj-siden (T7-2b2). Default false — kunder må eksplisitt slå på.

**Klient (`apps/web/src/app/dashbord/firma/innstillinger/page.tsx`):**
- Ny `RedigerVedAttesteringSeksjon`-komponent (~70 linjer). Følger eksakt samme mønster som eksisterende `TilgangPolicySeksjon`: `useFirma()` → `hentSetting`-query → checkbox-toggle som kaller `oppdaterSetting({ tillattRedigerVedAttestering: boolean })` ved endring.
- Layout: H2-tittel + beskrivelse + checkbox med inline-label og warning-tekst. Border + padding-stil matcher andre seksjoner.
- Montert i hovedsiden etter `KompetansePolicySeksjon`, før hjelp-modal.

**Server/schema:** Null endring. `oppdaterSetting`-input var allerede utvidet med `tillattRedigerVedAttestering: z.boolean().optional()` i T7-2b2. `hentSetting` returnerer hele OrganizationSetting-objektet → det nye feltet er allerede med i respons.

**i18n:** 5 nye nøkler i nb+en under `firma.innstillinger.redigerVedAttestering.*`:
- `.tittel` — «Rediger ved attestering» / «Edit during attestation»
- `.beskrivelse` — full forklaring + audit-log-omtale
- `.toggle` — checkbox-label
- `.warning` — «Egnet for bransjer der ansatte trenger hjelp med timeregistrering»
- `.feil` — feilmelding med `{{melding}}`-interpolering

Auto-oversatt til 13 språk via `generate.ts`.

**Verifisert:** `apps/web` typecheck 0 nye feil (kun pre-eksisterende vitest-typedef-feil). Ingen API-typecheck-endring (ingen server-endring).

**Etter prod-deploy er hele T7-2b-bunken komplett.** Gjenstår:
- T7-3 (mobil timer-redesign — speil av T7-1 strukturen på mobil)
- Audit-log-utvidelse (T7-2b2 logger antall + actor; før/etter-snapshots per rad utsettes til egen oppfølger)

Klar for review — ikke merge før Kenneth verifiserer.

### PR T7-2b2 edit-modus ved attestering DEPLOYET TIL PROD 2026-05-14 (prod-commit `755c542a`)

Andre sub-PR av T7-2b-bunken. Firma-admin kan redigere alle pending-rader på en sedel direkte uten å returnere til arbeider. Locked design fra Kenneth 2026-05-14:

- Rediger-modus per sedel (timer + tillegg + maskin samtidig)
- Original-rader komprimeres øverst som referanse (read-only)
- Eksisterende rader redigerbare inline
- «+»-knapp per type for nye rader, pre-fylt unntatt mengde-felter
- `tillattRedigerVedAttestering`-flagg (default false) gater Rediger-knappens synlighet
- Settings-UI for flagget = T7-2b3 (ikke i denne PR-en)

**Schema-endringer:**

| Tabell | Felt | Beskrivelse |
|---|---|---|
| `organization_settings` | `tillatt_rediger_ved_attestering BOOLEAN @default(false)` | Migration `20260514120000_t7_2b2_tillatt_rediger`. Default false (mest restriktivt). |
| `timer.sheet_timer` | `parent_rad_id TEXT NULL` + indeks | Migration `20260514120000_t7_2b2_parent_rad_id` (db-timer). Svak selvreferanse (A.20). |
| `timer.sheet_tillegg` | `parent_rad_id TEXT NULL` + indeks | Samme migration. |
| `timer.sheet_machines` | `parent_rad_id TEXT NULL` + indeks | Samme migration. |
| Alle tre rad-tabeller | `attestertStatus`-domene utvidet | Ny verdi `"erstattet"` — originaler som overskrives ved rediger beholdes som audit-spor. |

**Server (`apps/api/src/routes/timer/dagsseddel.ts`):**

| Mutation/query | Type | Beskrivelse |
|---|---|---|
| `redigerSedelRader` | Ny | Input: `{ sheetId, nyeRader: { timer[], tillegg[], maskin[] } }` der hver rad har `originalId: uuid \| null`. Auth: kun firma-admin (`autoriserAdminForFirma`). Gate: `tillattRedigerVedAttestering === true` → PRECONDITION_FAILED ellers. Cross-org-validering på alle `projectId` (via `ProjectOrganization`). Transaksjon: marker alle eksisterende pending som `"erstattet"` + opprett nye rader med `parentRadId = originalId` og `status = "pending"`. Activity-log per rediger med `actorUserId`, `targetType="DailySheet"`, `payload = { antallErstattet, antallNyeTimer/Tillegg/Maskin, sedelEier }`. |
| `hentForAttestering` | Utvidet | Respons utvidet med `redigerTillatt: boolean` (utledet fra `OrganizationSetting`). |
| `oppdaterSetting` (`organisasjon.ts`) | Utvidet input | Zod-input får `tillattRedigerVedAttestering: z.boolean().optional()`. |

**Web (`apps/web/src/components/timer/`):**

- **Ny `AttesteringDetalj_Edit.tsx`** (~400 linjer): eier edit-state via tre `useState<RedigerXxxRadData[]>`. Komprimert original-seksjon øverst i `<details open>`. Tre seksjoner under (timer/tillegg/maskin) med inline-rader + «+ Legg til»-knapper. Validerer at alle rader har påkrevde felter > 0 før kall. Lagre kaller `redigerSedelRader`. Avbryt forkaster.
- **Tre nye sub-komponenter** (`RedigerTimerRad.tsx`, `RedigerTilleggRad.tsx`, `RedigerMaskinRad.tsx`): inline-form per rad-type med slett-knapp. Grid-layout med dropdowns for prosjekt/lønnsart/aktivitet/ECO/tillegg/equipment/enhet, time-inputs for fra/til, number-inputs for timer/antall/mengde.
- **`rediger-types.ts`** (ny): delte TypeScript-typer for edit-modus.
- **`AttesteringDetalj.tsx`** integrert: ny `redigerModus`-state. Rediger-knapp i action-bar vises kun hvis `sheet.redigerTillatt === true` (default false → dormant i prod inntil T7-2b3 leverer settings-UI). Når redigerModus → erstatter standard rader+actions med Edit-komponenten. `TimerRad`/`MaskinRad`-typer utvidet med `byggeplassId`/`fraTid`/`tilTid` slik at de matcher Edit-komponentens forventninger.

**i18n:** 22 nye nøkler i nb/en (`timer.rediger.*`): knapp-tekster, modus-banner, slett/lagre, placeholders for dropdowns/mengde/kommentar, valideringsfeil per rad-type. Auto-oversatt til 13 språk via `generate.ts`.

**Verifisert:** `apps/api` typecheck 0 nye feil. `apps/web` typecheck 0 nye feil (kun pre-eksisterende vitest-feil i `import-hjelpere.test.ts`).

**Migrasjonsstrategi (to-stegs-policy):**

Begge migrasjoner er fullt-additive: nullable kolonner + boolean med default false. Krever ingen backfill. Trygt å deploye til test + prod uten ned-tids-vindu. `attestertStatus`-domene-utvidelsen er kun en applikasjons-konvensjon (ingen DB-constraint) — eksisterende rader er upåvirket.

**Forventede begrensninger (kommer i T7-2b3):**
- Settings-UI på `firma/innstillinger/page.tsx` for å skru `tillattRedigerVedAttestering` på/av — uten dette er Rediger-knappen dormant i prod.
- Activity-log-payload-utvidelse med før/etter-snapshots per rad (b2 logger kun antall + actor).
- Mobil får aldri edit-modus (firma-admin web-flyt kun).

**Splitting (1 → N rader)** er implisitt mulig i edit-modus: slett original-raden i edit-listen og legg til to nye. `parentRadId` settes til null på de nye (helt nye rader). Brukerens forrige spørsmål om dedikert splittRad-mutation ble forkastet til fordel for edit-modus-pattern.

Klar for review — ikke merge før Kenneth verifiserer.

### PR T7-2b1 per-rad-attestering + felleskomponent AttesteringDetalj DEPLOYET TIL PROD 2026-05-14 (prod-commit `3234c057`)

Første sub-PR av T7-2b-bunken. Bytter attestering fra per-sedel til per-rad. Refaktorerer detalj-siden til projectId-løs felleskomponent som monteres fra både prosjekt- og firma-kontekst.

**Bakgrunn:** T.3 Alt A låst i [fase-0-beslutninger.md § T.7](fase-0-beslutninger.md): «Leder attesterer kun sine rader; sedel er container uten egen attesterings-status.» PR 1B (2026-05-11) la `attestertStatus`/`attestertAvUserId`/`attestertVed` på rad-nivå i schema, men `attester`-mutationen var fortsatt per-sedel og brukte ikke feltene. Denne PR-en lukker gapet.

**Schema-endring (`packages/db-timer/prisma/schema.prisma`):** Kun kommentar-rensk. Verdi-domenet i kommentar normalisert fra `"pending" | "godkjent" | "returnert"` til `"pending" | "attestert" | "returnert"` (norsk-konvensjon, følger «attestering ≠ godkjenning»-regelen). Ingen migrasjon kreves — null historiske rader er skrevet med `"godkjent"` (mutationen brukte ikke feltet).

**Server-mutations (`apps/api/src/routes/timer/dagsseddel.ts`):**

| Mutation | Type | Beskrivelse |
|---|---|---|
| `attesterRader` | Ny | Per-rad-attestering. Input: `{ radIder: { timerIder, tilleggIder, maskinIder } }`. Auth: én `krevProsjektLeder`-sjekk per unike `projectId` på tvers av valgte rader. Validerer at hver rad har `attestertStatus === "pending"`. Bygger pris-snapshot per rad i én transaksjon (Fase 0 A.7). Post-transaksjon: hvis alle rader på en sedel nå er `"attestert"`, settes `DailySheet.status = "accepted"`. Returnerer `{ antallAttestert, ferdigeSedler }`. |
| `returnerRader` | Ny | Per-rad-retur. Input: samme `radIder` + `kommentar`. Setter rad-status til `"returnert"` + sedel-status til `"returned"` + lagrer kommentar på sedel-nivå. |
| `hentForAttestering` | Utvidet auth | `krevProsjektLeder` som primær, `autoriserAdminForFirma` som fallback. Lar firma-admin-detalj-siden bruke samme query. |
| `hentTilAttesteringFirma` | Utvidet | `include.maskiner: true` så klient kan vise fremdrift på tvers av alle tre rad-tabeller. |
| `attester`/`returner` | `@deprecated` thin wrapper | Beholder bakoverkompatibilitet for mobil-app pre-T7-2b1 og T7-3. Kaller samme snapshot-logikk som tidligere. Fjernes ~1 uke etter klient-migrering. |

**Klient-endringer (`apps/web`):**

- **Ny felleskomponent** `src/components/timer/AttesteringDetalj.tsx` (~620 linjer). Tar `sheetId`, `prosjektKontekst?`, `tilbakeUrl`. Per-rad-checkbox-state via tre `Set<string>` (timer/tillegg/maskin). Pre-utvalg ved sideåpning: alle rader hvor `attestertStatus === "pending"` AND leder har tilgang. Per-rad-statusbadge (`pending`/`attestert`/`returnert`). Container-status-banner viser fremdrift («3 av 8 attestert»). Rader fra andre prosjekter i prosjekt-kontekst rendres disabled (kontekst, ikke valgbar).
- **Wrapper-side prosjekt** `src/app/dashbord/[prosjektId]/timer/attestering/[id]/page.tsx`: 591 → ~50 linjer. Henter `kanAttestere` for prosjektet, monterer felleskomponenten med `prosjektKontekst={params.prosjektId}`.
- **Wrapper-side firma** `src/app/dashbord/firma/timer/attestering/[id]/page.tsx`: ny (~60 linjer). Bruker `useFirma()` + `kanAttestereFirma`, monterer felleskomponenten projectId-løs.
- **Firma-liste-lenke** `src/app/dashbord/firma/timer/attestering/page.tsx`: «Åpne»-knappen peker nå til `/dashbord/firma/timer/attestering/${rad.id}` istedenfor prosjekt-bundet ruten. Firma-admin uten prosjekt-medlemskap kan nå åpne detalj.

**i18n:** 12 nye nøkler i `nb.json` + `en.json` (rad-status × 3, rad-valg-knapper/etiketter × 6, container-banner × 3). Auto-oversatt til 13 språk via `generate.ts`.

**Verifisert:** `apps/api` typecheck 0 nye feil. `apps/web` typecheck 0 nye feil (kun pre-eksisterende vitest-typedef-feil i `import-hjelpere.test.ts`). Ingen DB-migrasjon. Ingen klient-API-brudd (gamle mutations beholdt som thin wrappers).

**Forventede begrensninger — kommer i etterfølgende PR-er:**
- **T7-2b2:** Rad-splitting (én rad → flere med ulike prosjekt/ECO/lønnsart/fra-til). Krever ny `parentRadId`-kolonne + `splittRad`-mutation.
- **T7-2b3:** `OrganizationSetting.tillattRedigerVedAttestering Boolean @default(false)` + direkte-rediger-mutations for firma-admin + Activity-tabell audit-log.
- **Returnert→pending-reset:** Når arbeider sender returnert sedel på nytt (`sendTilAttestering`), tilbakestilles ikke `attestertStatus` på returnerte rader til `"pending"` automatisk. Egen oppfølger.
- **Mobil:** T7-3 implementerer per-rad-attestering på mobil. Mobil bruker fortsatt thin-wrapper `attester`/`returner` inntil da.

**Multi-prosjekt-sedler:** Hvis sedel har rader i prosjekt A (lederens) + B (ikke lederens), kan A-leder attestere sine 5 av 9 rader. Sedel-status forblir `"sent"` til alle 9 er attestert (eller én returneres → `"returned"`). Pending B-rader synes i firma-listen så firma-admin eller B-leder kan ta dem.

**Prod-deploy** (main merge-commit `3234c057`): `./deploy.sh` kjørte build, PM2 `sitedoc-web` (id 6) + `sitedoc-api` (id 4) restartet, uptime 0-1s. HTTP/2 200 på `sitedoc.no` + `api.sitedoc.no/health` OK 2026-05-14 08:45:36 GMT. Browser-verifikasjon gjenstår.

## Pauset arbeid

**Timer/Maskin-revurdering** er utsatt til etter Fase 0-fundament er ferdig. timer.md og maskin.md har drift mot fase-0-beslutninger og må justeres før Fase 3 (Timer-modul) og Fase 1-fullføring (Maskin-modul-gateway) — men Fase 0-fundamentet bygges nå uavhengig av denne revurderingen.

## Planlagte oppgaver

### Superadmin-oversikt over firma-moduler

Superadmin trenger oversikt over hvilke moduler det enkelte firma har aktivert — delvis for fakturering. Ikke del av A.Markussen-kundelisten. Egen feature-sesjon.

**HMS-tilgang for arbeidsgiver på andres prosjekter (juridisk gap, 2026-05-03):**
A.27 gir firma-HMS-ansvarlig innsyn i «firmaets prosjekter» men IKKE i prosjekter
der firmaets ansatte jobber som UE. Arbeidsmiljøloven § 2-1 krever at arbeidsgiver
har HMS-ansvar for egne ansatte uavhengig av arbeidsplass. Løses i HMS-tilgang-runde
(Fase 4 / Mannskap).

**Steg 4c — Godkjenning UI (parkert 2026-05-03):**
Utsatt til etter møte med A.Markussen og/eller ProAdm API-tilgang.
Forutsetninger som mangler:
- Avklart dokumentflyt-mal for endringsmeldinger (krever A.Markussen-input)
- ProAdm API-integrasjon (eller manuell oppsett av mal)
- Domeneavklaring: hvilke felter skal med, hvem godkjenner, hvilken flyt

Modellen (Godkjenning + DocumentTransfer) er implementert i Fase 0 § E.12.
Teknisk grunnlag er på plass — kun domene-avklaring mangler.

**NB:** Når Godkjenning-detaljside bygges (Steg 4c): inkludér «Hvem har ballen»-badge etter samme mønster som sjekkliste/oppgave-detalj (`e82e51c5`). Server: include `recipientGroup` i `godkjenning.hentMedId`. Klient: amber pill ved siden av `<StatusBadge />` i header. Bruker eksisterende i18n-nøkkel `tabell.venterPaa`.

**Header-koordinering: firma-bytte nullstiller ikke prosjekt-kontekst (observert 2026-05-03):**
Når sitedoc_admin bytter aktivt firma via FirmaVelger, beholdes det aktive prosjektet i
ProsjektVelger selv om prosjektet tilhører et annet firma. Prosjektlisten bør:
1. Filtreres på valgt firma (vise kun prosjekter der primaryOrganizationId = valgtFirma.id)
2. Nullstille aktivt prosjekt ved firma-bytte

Kompleksitet: Lav-middels (~2-3t). Ikke blokkerende for pågående arbeid.
Tas som egen oppgave etter Steg 4 er ferdig.

**Arkitektur-planlegging — samlet sesjon nødvendig (2026-05-03):**
Følgende moduler mangler forankring i vedtatt arkitekturplan ([terminologi.md § 0](terminologi.md) tre nivåer: Firma → Firmaadministrasjon → Prosjekter, samt [arkitektur-syntese.md](arkitektur-syntese.md) helhetlig produktarkitektur):
- Timer-modul: bygget uten global firma-kontekst på plass
- Maskin-register: bygget uten global firma-kontekst på plass
- Mannskap/kompetansematrise: ikke planlagt i firma-kontekst
- Organization vs OrganizationPartner: skillet mangler i datamodellen

Før videre koding på noen av disse: hold en dedikert planleggingssesjon med
frisk Opus-kontekst. Les [terminologi.md § 0](terminologi.md) + [arkitektur-syntese.md](arkitektur-syntese.md) som utgangspunkt.
Kartlegg alle koblinger mellom modulene og firma-konteksten.
Prioriter: Strategi A (modul-filter) → firma-kontekst full konvergens → maskin-import.

**Organization vs OrganizationPartner — fundamentalt skille mangler (observert 2026-05-03):** Test-DB inneholder Organization-rader som ikke er reelle kunder (Byggherre, Tømrer Hansen, Elektrikker Hansen, Hovedentreprenør). De ble opprettet som «skall-firmaer» for å representere parter i faggrupper/dokumentflyt. Datamodellen tillater dette uten advarsel — det finnes ingen `type`/`erKunde`-felt på Organization som skiller «firma som bruker SiteDoc» fra «firma som er part i et prosjekt».

**Riktig modell:** `OrganizationPartner` (linje 197-217 i schema.prisma) er det rette stedet for faggruppe-parter. Hvert kunde-firma har sitt eget partner-bibliotek (`OrganizationPartner.organizationId` peker til kunden). `Faggruppe.partnerId` (nullable FK) kobler en faggruppe til en partner-rad. Den eksisterer for nettopp dette formålet, men test-data har misbrukt Organization-tabellen i stedet.

**Heuristikk-signaler for «reelt firma» (i fravær av eksplisitt felt):** users.length > 0 + harMaskinModul/harTimerModul satt + OrganizationSetting eksisterer + primaryProjects.length > 0 + avdelinger/kompetansetyper finnes. Alle disse er null/0 for skall-firmaer.

**Konsekvenser:**
- Firma-velger i Toppbar (etter `9175ab84`) viser skall-firmaer som om de var administrerbare. Klikk på dem fører til tom firma-admin-side.
- Maskin-import er særlig sårbart: hvis sitedoc_admin velger et skall-firma og kjører import, opprettes Equipment-rader under et firma ingen administrerer = datakorruption.
- Prod-DB ser korrekt ut i dag (3 reelle firmaer), men datamodellen forhindrer ikke fremtidig misbruk.

**Mulige strategier (rangert):**
- **A. Filter på modul-flagg** (5 min) — pragmatisk for maskin/timer-velgere. `WHERE har_maskin_modul = true` filtrerer skall-firmaer effektivt for import-flyten.
- **B. Filter på users-count** (30 min) — fanger reelle firmaer mer generelt.
- **C. Nytt felt `Organization.erKunde Boolean`** (2-3t migrasjon + backfill) — eksplisitt skille, riktig langsiktig.
- **D. Migrer skall-firmaer til OrganizationPartner** (6-8t DB-cleanup) — rensker datakorrupsjon, krever audit per rad.

**Anbefalt rekkefølge:** ~~Strategi A umiddelbart for maskin-import-velgeren.~~ ✅ **Strategi C IMPLEMENTERT 2026-05-03** (`Organization.erKunde`-feltet — se «Pågående arbeid» øverst). Strategi A kan nå bygges på erKunde-feltet hvis behov. Strategi D som datakvalitets-prosjekt etter A.Markussen er stabilt.

**Firma-administrasjons-navigasjon — strukturell rydding (observert 2026-05-03):** Etter at global firma-kontekst (`9175ab84`) ble bygd, observerte vi at firma-velger i Toppbar kun virker på `firma/layout.tsx` — ikke på undersidene. Dypere analyse avdekket to ulike «firma»-konsepter i kodebasen:

1. **`/dashbord/oppsett/firma` («Prosjekteiers innstillinger»)** — viser firma som eier det aktive prosjektet via `ProjectOrganization`-tabellen. Per-prosjekt-bundet, henter via `organisasjon.hentForProsjekt(projectId)`. Viser tom-state «Ingen firma — Du er ikke tilknyttet noe firma» når prosjektet mangler `ProjectOrganization`-rad. Skal IKKE følge FirmaVelger.
2. **`/dashbord/firma/*` (firma-admin-seksjon, ~12 sider)** — globale firma-funksjoner: avdelinger, brukere, fakturering, innstillinger, kompetanse, prosjekter, timer-katalog. Skal følge FirmaVelger, men hver underside henter sin egen orgId via `verifiserFirmaAdmin(ctx.userId)` som leser `bruker.organizationId` direkte. Sitedoc_admin uten orgId vil fortsatt feile på undersidene.

**Tre lag som mangler for full konvergens:**
- **Lag 1 (server, ~4-6t):** ~10 ruter må ta `organizationId` som input og bruke ny `autoriserAdminForFirma(userId, orgId)`-helper. Mønster eksisterer i `maskin/import.ts:autoriserImportForFirma`.
- **Lag 2 (klient, ~3-4t):** ~10 sider må sende `useFirma().valgtFirma.id` som input til mutations/queries.
- **Lag 3 (rename, ~30 min):** «Firmainnstillinger» under prosjekt-sidebar er forvirrende navngitt — bør rename til «Prosjekteier» eller «Eier-firma» for å tydeliggjøre at det IKKE er firma-admin.

**Total estimat:** ~10-12 timer. Ikke-blokkerende for vanlig drift; sitedoc_admin (Kenneth) påvirket — ikke A.Markussen-kunder. Prioriter etter Maskin-import-leveransen.

**Onboarding-veileder (prioritert — forutsetning for A.Markussen):** Ny bruker vet ikke rekkefølge eller URL for oppsett etter prosjektopprettelse. Observert 2026-05-02: 4 404-feil ved forsøk på å finne faggruppe-oppsett via intuitive URL-er. Konkret rotårsak: to nesten-identiske faggruppe-sider eksisterer (`/dashbord/[prosjektId]/faggrupper` er **read-only**, mens `/dashbord/prosjekter/[id]/faggrupper` har **full CRUD**) — ingen visuell forskjell, ingen lenke fra read-only-siden til full versjon.

**Runde 1 (a)+(b) DEPLOYET TIL PROD 2026-05-02** (`6ed8b676`):
- ✅ (a) Lenke fra read-only faggrupper-side til CRUD: ny header-knapp «Administrer faggrupper» (Settings-ikon, øverst til høyre) + action-knapp i EmptyState. Begge peker til `/dashbord/prosjekter/${prosjektId}/faggrupper`.
- ✅ (b) Pencil-ikon (alltid synlig, text-gray-300) ved siden av brukernavn i `/dashbord/oppsett/brukere` — klikk på navn eller ikon åpner redigeringsmodus (samme oppførsel som før, men nå oppdagbart).

**SmartDok maskin-import dag 1 på develop 2026-05-03:**
- ✅ `apps/api/src/utils/maskinImport.ts` — parser for SmartDok Excel-eksport. 13 kolonner (Maskin, Internnummer, Reg.nr, Maskinkode, Årsmodell, Lokasjon, Sist endret, Maskinansvarlig 1, Maskinansvarlig 2, Timetall, Km.stand, Notat, Status). SHA-256 fil-hash. Filtrering: «x»-rader = testdata. 0XXX-placeholder → `internNummer=null`. Kategori-mapping verifisert mot A.Markussen 126-rad-fil:
  - Med gyldig regnr → kjøretøy (Vegvesen-oppslag bekrefter)
  - 7000-7599 (uten regnr) → kjøretøy (bilpark)
  - 7600-7699 (uten regnr) → anleggsmaskin (truck, hjullaster, dumper)
  - 7700-7999 (uten regnr) → småutstyr (redskap, GPS, hammer)
  - 9XXX → anleggsmaskin (eierskap=leid)
  - 0XXX-placeholder → utled fra 4-sifret prefiks i navn-feltet
- ✅ `apps/api/src/routes/maskin/import.ts` — to nye tRPC-mutations:
  - `importerForhandsvisning` — parse + matching-rapport (kategori-fordeling, ansvarlig-match mot User.name case-insensitive, duplikat-sjekk på internNummer per org, 25 første rader som forhåndsvisning)
  - `importerBekreft` — atomisk Prisma-transaction: Equipment + EquipmentAnsvarlig (kun rader med Maskinansvarlig 2) + VegvesenKo prio 200. Skip duplikater. Umatcha ansvarlig → `null` + advarsel (ikke blokker per Kenneth's beslutning).
- ✅ Verifisert mot ekte fil: 125 importerbare av 126 (1 testrad filtrert), 36 med regnr, 11 leid, 10 0XXX-null, 15 ansvarlige. Fordeling 37 kjøretøy / 50 anleggsmaskin / 38 småutstyr.
- ✅ Vegvesen-prio 200 = lavere enn 100 (auto) — worker plukker én om gangen via `ORDER BY prioritet ASC, opprettet ASC` i 60s-polling. Naturlig spredning over tid (ingen 429-risiko).
- ✅ Dag 2: klient-UI på develop. Standalone-side `/dashbord/maskin/import` med 4-stegs progress-indikator (Last opp → Forhåndsvis → Bekreft → Resultat). Forhåndsvisning viser kategori-fordeling (kjøretøy/anleggsmaskin/småutstyr), totalsum, antall med regnummer, antall leid, fargemerkede advarsler (valideringsfeil rød / filtrerte testdata grå / duplikater gul / umatcha ansvarlig amber / matcha ansvarlig grønn) + tabell med 25 første rader (radnummer, navn, internnr, regnr, kategori, eierskap, ansvarlig 1+2 med Check/X-ikon for match-status). Bekreft-steg viser sammendrag + advarsel om atomisk operasjon. Resultat-steg viser opprettet-antall, Vegvesen-kø-antall, hoppet-over-liste, umatcha-liste. «Importer fra SmartDok»-knapp lagt til på `/dashbord/maskin`-hovedsiden. 60 nye i18n-nøkler i nb+en (`firma.maskin.import.*` + `maskin.importerFraSmartDok`). Verifisert med `pnpm build --filter @sitedoc/web` 37.6s grønt (Next.js strenge tsc).
- ⏳ Dag 3: test-runde mot test-firma i test-DB FØR prod (per Kenneth's beslutning).

**Dag 3 fix 2026-05-03 — fil-interne duplikater:** Test-runde mot Byggeleder feilet ved bekreft-steg. Rotårsak: SmartDok-fila har internnummer `7084` på to rader (17 og 99). `importerBekreft` filtrerte bare DB-eksisterende internnumre, ikke fil-interne. Andre forekomst brakk `@@unique([organizationId, internNummer])` og rullet tilbake hele transaksjonen. Fix: filtrer begge kategorier FØR `$transaction` — første forekomst importeres, etterfølgende hoppes over med grunn «duplisert i fila». Forhåndsvisning returnerer nå `duplikaterDB` + `duplikaterFilInterne` separat i tillegg til total. Hoppet-over-rapport skiller mellom «finnes allerede i firmaet» og «duplisert i fila». Klar for ny test-runde.

**Runde 1 (c) progress-banner DEPLOYET TIL PROD 2026-05-02** (`098f7586`):
- ✅ Ny tRPC-query `prosjekt.hentOnboardingStatus({ projectId })` returnerer 4 booleans: harDokumentflyt, harBrukergruppe (kategori="brukergrupper"), harMalKobletTilFlyt (DokumentflytMal-rader), harLokasjon (Byggeplass-rader).
- ✅ Banner på prosjekt-dashbord (`/dashbord/[prosjektId]`) plasseres over prosjekt-header og under prøveperiode-banneret. Vises kun for admin (`role ∈ {admin, owner}`) og kun når minst ett steg gjenstår. Hvert steg er en pill med lenke til riktig oppsett-side: Dokumentflyt + Maler → `/dashbord/oppsett/produksjon/kontakter`, Brukergrupper → `/dashbord/oppsett/brukere`, Lokasjoner → `/dashbord/oppsett/lokasjoner`.
- ✅ 5 nye i18n-nøkler under `onboarding.*` i nb+en.
- ✅ Konsolidering av de to faggruppe-sidene IMPLEMENTERT på develop 2026-05-05. `/dashbord/[prosjektId]/faggrupper` har full CRUD (opprett/rediger/slett). Legacy `/dashbord/prosjekter/[id]/faggrupper` slettet, Faggrupper-fane fjernet fra `prosjekter/[id]/layout.tsx`, oversiktskort i `prosjekter/[id]/page.tsx` peker til ny rute.

Blokkerer selvstendig A.Markussen-onboarding. Ankret i [onboarding-veileder.md](onboarding-veileder.md).

**Testbrukere (planlagt — etter Timer er ferdig):** Opprett strukturerte testbrukere i test-DB for systematisk verifisering av tilgangsnivåer:
- **Ola Tømrer** — produksjon-rolle (`ProjectMember.role = "worker"` eller `"field_user"`)
- **Per Prosjektadmin** — `ProjectMember.role = "project_manager"`
- **Kari Firmaadmin** — `User.role = "company_admin"` med `organizationId` satt
- **Tore SiteDocAdmin** — `User.role = "sitedoc_admin"`

Formål: systematisk verifisering av at riktige funksjoner er tilgjengelig per rolle, og at utilgjengelige funksjoner er skjult/blokkert. Eksempel: Timer-attestering skal kun være synlig for Per/Kari/Tore (ikke Ola); Firma-administrasjon skal kun være tilgjengelig for Kari/Tore; Superadmin-flater kun for Tore. Dekker også verifisering av RBAC-helpers (`harProsjektTilgang`, `verifiserOrganisasjonTilgang`, `verifiserSiteDocAdmin`) og sidebar-gating.

### ~~«Hvem har ballen» — mangler synlig indikator (observert 2026-05-02)~~ — LØST 2026-05-05

Listene fikk badge før denne sesjonen (sjekkliste-listen + oppgave-listen viser «Venter på: [gruppenavn]» når status ∈ {sent, received, in_progress}). Dokument-detaljsidene fikk samme badge 2026-05-05 — server utvidet med `recipientGroup`-include på `sjekkliste.hentMedId` + `oppgave.hentMedId`, klient viser badge ved siden av `<StatusBadge />` i header.

### ~~Auto-redirect ved innlogging — mangler (observert 2026-05-02)~~ — LØST

Verifisert 2026-05-05 at logikken er fullt implementert i `apps/web/src/app/dashbord/page.tsx:41-65` (auto-redirect basert på antall prosjekter) + skriving av `lastVisitedProjectId` i `apps/web/src/app/dashbord/[prosjektId]/layout.tsx:26`. Alle scenarier dekket: 0 prosjekter (admin → kom-i-gang, ikke-admin → tom-state), 1 prosjekt → direkte, 2+ → sist besøkte hvis i tilgjengelig liste, 2+ uten sist-besøkt → bli stående med oversikt. Sannsynligvis lagt til samtidig som auto-progress-arbeidet før denne sesjonen — ikke en mangel lenger.

## Kjente bugs

**~~Lokasjon-modal forhåndsvelger ikke når kun ett alternativ finnes (observert 2026-05-02)~~ — LØST.** Verifisert 2026-05-05 at auto-select er implementert i `apps/web/src/components/LokasjonVelger.tsx:66-81` (to useEffect-hooks: én for bygning, én for tegning, begge sjekker `length === 1` og setter valgt verdi). Sannsynligvis lagt til etter den opprinnelige observasjonen. TegningsModal (skjermbilder, ikke samme flyt) auto-velger kun ved `standardTegningId` — bevisst design.

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

## Neste oppgaver (ikke planlagt)

Konsolidert fra `neste-oppgave.md` (slettet 2026-05-14).

- **OrganizationMemberPermission** (modul-tilgang per ansatt) — låst i [fase-0-beslutninger.md](fase-0-beslutninger.md). Designet er klart, ikke startet.
- **T7-2b2** Rad-splitting ved attestering — én rad → flere med ulike prosjekt/ECO/lønnsart/fra-til. Krever `parentRadId`-kolonne + `splittRad`-mutation.
- **T7-2b3** `OrganizationSetting.tillattRedigerVedAttestering Boolean @default(false)` + direkte-rediger-mutations for firma-admin + Activity-tabell audit-log.
- **T7-3** Mobil timer-redesign (per-rad-attestering + prosjekt-gruppert dagsseddel). Avhenger av T7-2b-bunken og T7-0 (refaktor av `apps/mobile/app/timer/[id].tsx`).
- **Returnert→pending-reset** ved `sendTilAttestering` — når arbeider sender returnert sedel på nytt, tilbakestilles ikke `attestertStatus` på returnerte rader automatisk.
- **Nye integrasjonstester for `tilgangskontroll.ts`** — etter O-5c er den gamle test-fila slettet (16/22 broken). Integrasjonstester mot test-DB med OrganizationMember-fikstur er planlagt.

