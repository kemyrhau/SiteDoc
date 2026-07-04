---
name: historikk-2026-07
description: Arkiv av deployete PR-er/saker fra juli 2026. Flyttet hit fra STATUS-AKTUELT ved DEPLOYET TIL PROD.
sist_verifisert_mot_kode: 2026-07-04
---

# Historikk juli 2026

Arkiv av arbeid deployet til prod i juli 2026. Flyttet hit fra [STATUS-AKTUELT.md](STATUS-AKTUELT.md) per arkiveringsplikten (deployet arbeid ligger aldri igjen i STATUS-AKTUELT).

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
