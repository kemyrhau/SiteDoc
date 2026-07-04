---
name: historikk-2026-07
description: Arkiv av deployete PR-er/saker fra juli 2026. Flyttet hit fra STATUS-AKTUELT ved DEPLOYET TIL PROD.
sist_verifisert_mot_kode: 2026-07-04
---

# Historikk juli 2026

Arkiv av arbeid deployet til prod i juli 2026. Flyttet hit fra [STATUS-AKTUELT.md](STATUS-AKTUELT.md) per arkiveringsplikten (deployet arbeid ligger aldri igjen i STATUS-AKTUELT).

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
