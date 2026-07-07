---
name: historikk-2026-07
description: Arkiv av deployete PR-er/saker fra juli 2026. Flyttet hit fra STATUS-AKTUELT ved DEPLOYET TIL PROD.
sist_verifisert_mot_kode: 2026-07-04
---

# Historikk juli 2026

Arkiv av arbeid deployet til prod i juli 2026. Flyttet hit fra [STATUS-AKTUELT.md](STATUS-AKTUELT.md) per arkiveringsplikten (deployet arbeid ligger aldri igjen i STATUS-AKTUELT).

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
