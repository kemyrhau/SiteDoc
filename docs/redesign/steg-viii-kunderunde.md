---
name: steg-viii-kunderunde
status: plan (godkjent Plan 1, 2026-07-07) — infra ikke reist
sist_verifisert_mot_kode: 2026-07-07
---

# Steg viii — kunderunde mot prod-kopi (redesign-stack)

Runbook + env-maler + kunderunde-manus for den tredje Docker-stacken (`sitedoc-redesign`)
på server-ny. Speiler test-stacken (`docker-compose.test.yml`). **Ingen infra reises før
Kenneths kommando.** Drift-steg (DB-kopi, stack-up, DNS, OAuth, reboot) kjøres av Kenneth.

## Stack-oversikt

| Element | Verdi |
|---|---|
| Compose-fil | `docker/docker-compose.redesign.yml` |
| Prosjektnavn | `sitedoc-redesign` (eksplisitt `name:`) |
| Containere | `sitedoc-redesign-api`, `sitedoc-redesign-web` |
| Porter | API **3501** / web **3500** (127.0.0.1-bundet). Unngår 3001/3100 (prod), 3301/3300 (test), 3302/3303 (ML), **3400/3401 (`sendfil.sitedoc.site` lytter på 127.0.0.1:3400 på server-ny — `ss` verifisert)** |
| DB | `sitedoc_redesign` (KOPI av prod `sitedoc`, sessions nullstilt) |
| Subdomener | `redesign.sitedoc.no` → :3500, `api-redesign.sitedoc.no` → :3501 |
| Env-filer | `docker/env/{api-redesign,web-redesign}.env` (server-side, gitignored) |
| Delt uendret | postgres-container, `appnet`, `embed` (3302), `oversettelse` (3303) |
| Uploads | prod-uploads montert **read-only** (`:ro`) — vedlegg synlige, prod-filer beskyttet |
| Flagg-default | **PÅ** via `NEXT_PUBLIC_NY_NAV_DEFAULT=1` (build-arg, bakt inn i web-image) |

## Env-maler (fyll inn verdier på server — ALDRI commit)

### Nøkler & secrets — proveniens

> **Ufravikelig:** ALDRI faktiske nøkkelverdier i denne tabellen eller noe annet sted i
> repoet — kun plassholdere/proveniens. Ingen delvise verdier eller lengde-hint om
> eksisterende secrets; kun genererings-oppskrift for NYE nøkler. Kenneth setter verdiene
> på server (TTY); Opus rører dem aldri. Global regel: CLAUDE.md § SIKKERHET — NØKKELHÅNDTERING.

| Nøkkel | Proveniens / hvordan skaffes | Fil |
|---|---|---|
| `DATABASE_URL`/`DIRECT_URL` (passord) | Delt `sitedoc`-postgres-bruker — **samme passord som prod/test-env-filene**, ikke nytt | begge |
| `AUTH_SECRET` | **Ny**, generér `openssl rand -base64 33`. MÅ være **identisk api↔web** i redesign-stacken, men **ANNEN verdi enn prod/test** (sesjons-isolasjon mellom miljøer) | begge |
| `AUTH_GOOGLE_*` + `AUTH_MICROSOFT_ENTRA_ID_ID`/`_SECRET` | **Prod-appene gjenbrukt** (Google Cloud Console + Entra-portalen) — **samme verdier som prod-`web.env`**. Kun to nye redirect-URIer lagt til (se Steg 4), verifisert 2026-07-07 | web |
| `AUTH_MICROSOFT_ENTRA_ID_ISSUER` | Samme tenant som prod: `https://login.microsoftonline.com/<tenant-id>/v2.0` | web |
| `RESEND_API_KEY` | **Tom** i demo — ingen e-post til ekte kunder | api |
| `RESEND_FROM_EMAIL` | Fast avsenderstreng (ikke hemmelig) | web |
| `VEGVESEN_API_KEY` | Samme som prod ved behov, ellers tom | api |
| `SITEDOC_INTEGRATION_KEY` | Hvis kryptering brukes: 64 hex (`openssl rand -hex 32`) og MÅ ligge i **både api og web** (lærdom 2026-05-07). **Tom OK for demo** | begge (hvis brukt) |
| `ENABLE_DEV_LOGIN` + `DEV_LOGIN_SECRET` | **Manuelt aktivert** i `api-redesign.env` for simulator-mot-redesign — `DEV_LOGIN_SECRET` = **samme som api-test**. Dokumentert unntak: **skrus AV etter pilot** | api |

### `docker/env/api-redesign.env`
```
DATABASE_URL=postgresql://sitedoc:<PASSORD>@postgres:5432/sitedoc_redesign
DIRECT_URL=postgresql://sitedoc:<PASSORD>@postgres:5432/sitedoc_redesign
APP_URL=https://redesign.sitedoc.no
AUTH_SECRET=<EGEN_REDESIGN_SECRET>
# Resend AV/sandbox i demo — ingen e-post til ekte kunder:
RESEND_API_KEY=
VEGVESEN_API_KEY=<samme som prod ved behov>
SITEDOC_INTEGRATION_KEY=<egen eller tom>
# PORT/HOST/NORBERT_URL/OVERSETTELSE_URL settes i compose (environment:) — IKKE her.
# Dev-login: AKTIVERT for pilot (simulator-mot-redesign) — DEV_LOGIN_SECRET = samme som api-test.
# Sikkerhetseksponering på kundevendt subdomene → dokumentert unntak, SKRUS AV etter pilot:
ENABLE_DEV_LOGIN=true
DEV_LOGIN_SECRET=<samme som api-test DEV_LOGIN_SECRET>
```

### `docker/env/web-redesign.env`

Speiler `docker/env/web-test.env` (feltnavn må matche `apps/web/src/auth.ts` — Entra
leser `AUTH_MICROSOFT_ENTRA_ID_*`, IKKE `AUTH_MICROSOFT_*`).
```
AUTH_SECRET=<SAMME som api-redesign AUTH_SECRET>
AUTH_URL=https://redesign.sitedoc.no
NEXTAUTH_URL=https://redesign.sitedoc.no
AUTH_TRUST_HOST=true
APP_URL=https://redesign.sitedoc.no
DATABASE_URL=postgresql://sitedoc:<PASSORD>@postgres:5432/sitedoc_redesign
DIRECT_URL=postgresql://sitedoc:<PASSORD>@postgres:5432/sitedoc_redesign
RESEND_FROM_EMAIL=SiteDoc <noreply@sitedoc.no>
# PROD-appene gjenbrukt (ikke egne redesign-apper) — SAMME verdier som prod-web.env.
# Kun to nye redirect-URIer lagt til i prod-appene (se Steg 4), verifisert 2026-07-07:
AUTH_GOOGLE_ID=<samme som prod>
AUTH_GOOGLE_SECRET=<samme som prod>
AUTH_MICROSOFT_ENTRA_ID_ID=<samme som prod>
AUTH_MICROSOFT_ENTRA_ID_SECRET=<samme som prod>
AUTH_MICROSOFT_ENTRA_ID_ISSUER=https://login.microsoftonline.com/<tenant-id>/v2.0
# NEXT_PUBLIC_NY_NAV_DEFAULT sendes som build-arg i compose (bakes inn). Runtime-env her er ikke nok.
```

## Kenneth-kommandoliste (drift — TTY via `! ssh -t server-ny`)

**Steg 0 — server-vedlikehold FØR stacken reises** (BACKLOG-varsel: 36 pending, restart required):
```
# vedlikeholdsvindu:
sudo apt update && sudo apt upgrade -y
sudo reboot
# etter oppstart: verifiser prod + test kommer opp igjen (innlogget i nettleser)
```

**Steg 1 — DB-kopi (prod → redesign, sessions nullstilt):**
```
# på server-ny, mot delt postgres-container — ALT via `sudo docker exec -i postgres …`.
# 1) opprett DB som postgres-superbruker, med sitedoc som eier (createdb -U sitedoc feilet — mangler CREATEDB):
sudo docker exec -i postgres createdb -U postgres -O sitedoc sitedoc_redesign
# 2) vector-extension MÅ opprettes (som postgres) FØR restore — dumpen refererer vector-typer,
#    så CREATE EXTENSION etter restore feiler. Rekkefølgen er kritisk (dagens funn):
sudo docker exec -i postgres psql -U postgres -d sitedoc_redesign -c 'CREATE EXTENSION IF NOT EXISTS vector;'
# 3) dump prod → restore inn i redesign (pipe kjøres inne i containeren via sh -c):
sudo docker exec -i postgres sh -c 'pg_dump -Fc -U sitedoc -d sitedoc | pg_restore --no-owner --no-privileges -U sitedoc -d sitedoc_redesign'
# 4) collation-refresh (som postgres):
sudo docker exec -i postgres psql -U postgres -d sitedoc_redesign -c 'ALTER DATABASE sitedoc_redesign REFRESH COLLATION VERSION;'
# 5) nullstill sesjoner/tokens (ingen ekte prod-sesjon lever i demoen):
sudo docker exec -i postgres psql -U sitedoc -d sitedoc_redesign -c 'TRUNCATE sessions, accounts CASCADE;'
```

**Steg 2 — env-filer:** legg `api-redesign.env` + `web-redesign.env` i `~/stack/sitedoc/docker/env/` (malene over).

**Steg 3 — DNS + tunnel (Cloudflare dashboard, ikke CLI):**
```
# /etc/cloudflared/config.yml — legg over http_status:404-linja:
#   - hostname: redesign.sitedoc.no
#     service: http://127.0.0.1:3500
#   - hostname: api-redesign.sitedoc.no
#     service: http://127.0.0.1:3501
sudo cloudflared --config /etc/cloudflared/config.yml tunnel ingress validate
sudo systemctl restart cloudflared
# Cloudflare dashboard: CNAME redesign + api-redesign → <tunnel-id>.cfargotunnel.com (proxied)
```

**DNS-feller (funn i kveld 2026-07-07):**
- **CNAME-target MÅ ha `.cfargotunnel.com`-suffiks** — `<tunnel-id>` alene (uten suffiks)
  gir ikke-fungerende oppslag. Kopier hele `<tunnel-id>.cfargotunnel.com`.
- **Negativ DNS-cache forsinker** første oppslag etter at recorden er lagt inn: både
  **Tailscale-resolveren** (MagicDNS på Mac) og **Chromes interne DNS-cache** holder på
  NXDOMAIN. Symptom: `dig`/annen maskin ser recorden, men Chrome nekter.
  - Midlertidig workaround mens cachen tømmes: legg en `hosts`-linje som peker domenet
    rett på Cloudflare-edge (fjern igjen etterpå):
    ```
    # /etc/hosts (midlertidig — fjern når DNS har propagert):
    104.21.x.x  redesign.sitedoc.no api-redesign.sitedoc.no
    ```
  - Evt. tøm Chrome-cachen: `chrome://net-internals/#dns` → «Clear host cache».

**Steg 4 — OAuth-callbacks (prod-appene GJENBRUKT — ikke egne redesign-apper):** de eksisterende
prod-appene i Google Cloud Console + Entra-portalen fikk to nye redirect-URIer:
`https://redesign.sitedoc.no/api/auth/callback/google` og `…/callback/microsoft-entra-id`.
Verifisert fungerende 2026-07-07. Web-env bruker dermed samme `AUTH_GOOGLE_*`/`AUTH_MICROSOFT_ENTRA_ID_*`
som prod. (Samme AADSTS50011-felle som test hvis en URI mangler.)

**Steg 5 — rsync + build + up** (Opus kan kjøre native rsync; `sudo docker` = Kenneth):
```
# RE-RSYNC redesign/navigasjon FØR build (delt build-kontekst!):
rsync -a --exclude node_modules --exclude .next --exclude .git --exclude docker/env \
  ~/Documents/Programmering/SiteDoc/ server-ny:~/stack/sitedoc/
# på server:
sudo docker compose -f docker/docker-compose.redesign.yml build \
  --build-arg API_PORT=3501 --build-arg NEXT_PUBLIC_NY_NAV_DEFAULT=1
# MIGRERING KREVES: prod-kopien mangler develop-migreringer (bl.a. 20260707120000_user_ny_navigasjon
# for nyNavigasjon-flagget — anvendt i kveld 2026-07-07). Kjør migrate deploy MOT redesign-DB,
# gated på $DATABASE_URL så prod/test aldri treffes:
sudo docker compose -f docker/docker-compose.redesign.yml exec sitedoc-redesign-api sh -c \
  'echo "$DATABASE_URL" | grep -q sitedoc_redesign || { echo "ABORT: feil DB"; exit 1; }; \
   pnpm --filter @sitedoc/db exec prisma migrate deploy'
sudo docker compose -f docker/docker-compose.redesign.yml up -d
```

**Verifiser:** `https://redesign.sitedoc.no` laster innlogget, ny nav default-på, `?nyNav=0` gir gammel nav.

## Demo-innhold for oversettelse/leser (FØR kunderunden — manus 4/5 + mobil 7/8)

Redesign-DB-en er en prod-kopi og har **0 parsede dokumenter** (`ftd_document_blocks = 0`,
verifisert). Manus-punkt 4 (oversettelsespanel), 5 (web-leser) og mobil 7/8 trenger innhold.

**Verifisert mot kode (ikke antatt):** blokk-parsingen kjører **in-process i api-en** — ingen
worker kreves. Kjede: `mappe.ts:924` (`lastOppDokument` → `triggerProsessering`) →
`prosesser.ts:18` (fire-and-forget) → `ftd-prosessering.ts` → `blokk-prosessering.ts:48`
(`ftdDocumentBlock.createMany`). Oversettelsesløkka kjører også in-process
(`oversettelse-service.ts`, startet i `server.ts:151`). Redesign-compose har kun api+web, men
det er nok — den deler `embed`(3302)/`oversettelse`(3303) fra prod-stacken via `appnet`.
→ **Opplasting via UI-et produserer blokker + oversettelse i denne stacken.**

**Modul-gate (verifisert):** mapper/opplasting er kjerne (ikke modul-gated — kun tilgangssjekk
i `mappe.ts`). Oversettelses-flyten («Oversett»-knapp, chips) gates av `oversettelse`-modulen
(3 steder i `mappe.ts`). Seed-scriptet aktiverer den modulen automatisk.

### Strategi: ekte opplasting primært (b), seed som forhåndslagret fallback (a)

**(b) PRIMÆR — ekte sikkerhetsdatablad, forhåndskjørt før kunden kommer** (parsing er async —
gjør ALDRI dette live):
1. Verifiser at `embed`(3302) + `oversettelse`(3303) kjører på server-ny (delt prod-ML).
2. **Demo-prosjekt:** bruk et dedikert prosjekt for kunderunden (ikke ekte kundedata synlig).
   Mangler prod-kopien et egnet prosjekt: opprett «Redesign-demo (SDS)» via superadmin-UI og
   aktiver `oversettelse`-modulen (Prosjekt → Moduler). Noter prosjekt-ID her når opprettet:
   `SEED_PROJECT_ID=__________`.
3. Last opp **1–2 ekte sikkerhetsdatablad (SDS) på fremmedspråk** — byggeplass-kontekst
   (sement/epoxy/lim). **Minst ett dokument MÅ ha kildespråk ≠ nb** så «🇳🇴 NB»-oversettelsen
   demonstreres. ⚠️ **Kildespråk≠prosjektspråk er en kjent BACKLOG-gap** — velg dokumenter der
   flyten er **bevist på test** først, så demoen ikke snubler i gapet live.
4. Poll til innholdet er klart — kopierbar Kenneth-kommando (TTY, mot `sitedoc_redesign`):
   ```
   # forvent blocks > 0 og alle jobber = completed:
   sudo docker exec -i postgres psql -U sitedoc -d sitedoc_redesign -c \
     'SELECT count(*) AS blokker FROM ftd_document_blocks;'
   sudo docker exec -i postgres psql -U sitedoc -d sitedoc_redesign -c \
     'SELECT status, count(*) FROM ftd_translation_jobs GROUP BY status;'
   ```

**(a) FALLBACK — seed (garantert, men syntetisk):** hvis ML nede eller opplasting feiler, kjør
seed-scriptet mot redesign-DB. Det oppretter mappa «🌐 Oversettelse-test (redesign)» med alle
chip-tilstander (grønn✓ / amber… / avvik / uparset) og aktiverer `oversettelse`-modulen:
```
# gate på DB-navn så prod/test aldri treffes:
DATABASE_URL=<sitedoc_redesign> SEED_PROJECT_ID=<demo-prosjekt> \
  pnpm --filter @sitedoc/db exec tsx scripts/seed-oversettelse-test.ts
```
(`SEED_PROJECT_ID` valgfri — uten den seedes eldste prosjekt. Kilde:
`packages/db/scripts/seed-oversettelse-test.ts`.) Bruk fallback kun hvis (b) svikter —
seed-innholdet ser syntetisk ut i en kundedemo.

## Kunderunde-manus

To overflater. **Web-stacken** dekker desktop + mobil-web (responsiv). **2a mobil-tabs + 2c leser
er React Native** → vises på mobil test-app via OTA, IKKE web-stacken.

### Overflate A — redesign.sitedoc.no (desktop + mobil-web)

Rekkefølge: struktur først, så funksjoner i strukturen.

1. **Ny sidebar + kontekst-chip** (steg iii) — PROSJEKT/FIRMA-soner, «{Firma} / {Prosjekt} ▾»,
   modul-fargeaksent, Innstillinger-footer. → *Finner kunden fram raskere? Er sone-inndelingen intuitiv?*
2. **Innstillinger-hub** (1a/ii) — kort m/ underlenke-chips, segmentert filter.
   → *«Alt oppsett ett sted» tydeligere enn dagens oppsett-sidebar?*
3. **Globalt søk (Ctrl+K)** (iv) — søk overalt, underlenker som egne treff, diakritikk-tolerant.
   → *Vil de bruke søk som primær-nav? Mangler noe i registeret?*
4. **2b oversettelsespanel** (v) — mappe-oversettelse: per-språk-chips, omfang N+M,
   ett-klikk «Oversett gjenstående», avvik-bekreft. → *Er oversettelses-statusen forståelig?*
5. **Web-dokumentleser** (P19) — Reader View + språkvelger + sammenlign (web-parallell til 2c).
6. **Mobil-web hamburger (T9) + «Min side» (FM5)** — responsiv nav, avatar-meny.
   → *Fungerer nav på liten skjerm/nettbrett?*

### Overflate B — mobil RN test-app (OTA-kanal)

7. **2a mobil-tabs** (vi) — Hjem·Tegninger·Dokumenter·Timer·Mer, Kontakter (K6).
8. **2c dokumentleser** (vii) — språkpille-rad, grønt banner, «+ Oversett», bunn-ark-sammenlign.

### Overordnet vi vil vite
- (a) Mistes noen funksjon kunden bruker i dag? (paritetslista = akseptkriteriet)
- (b) Er ny nav subjektivt raskere/klarere?
- (c) Noe som overrasker negativt (flyttet/fjernet der de forventet det)?

## Kjøreliste — kunderunde (én side, for presentøren)

Base: `https://redesign.sitedoc.no` (innlogget, ny nav default-på). **Mac:** `Cmd` for `Ctrl`.
**Presentøren leder ikke — vis flyten, la kunden reagere spontant, noter.**

**Før start:** ✅ demo-innhold klart (se «Demo-innhold»-seksjonen — SDS lastet + parset, eller seed kjørt) · ✅ `embed`/`oversettelse` oppe · ✅ mobil test-app har hentet siste **OTA** (verifiser `eas update`-kanal publisert — mobil 7/8 vises KUN da) · ✅ innlogget både web (Chrome) og mobil.

### Overflate A — web (desktop → mobil-web)
| # | Steg | URL / tast | Vis |
|---|---|---|---|
| 1 | Sidebar + kontekst-chip | `/dashbord` | PROSJEKT/FIRMA-soner, «{Firma} / {Prosjekt} ▾», modul-fargeaksent, Innstillinger-footer |
| 2 | Innstillinger-hub | `/dashbord/innstillinger` (+ `/dashbord/firma/innstillinger`) | kort m/ underlenke-chips, segmentert filter |
| 3 | Globalt søk | `Ctrl/Cmd + K` (fra hvor som helst) | søk overalt, underlenker som egne treff, diakritikk-tolerant |
| 4 | 2b oversettelsespanel | `/dashbord/{demo-prosjektId}/mapper` → velg SDS-/seed-mappa | per-språk-chips, omfang N+M, «Oversett gjenstående», avvik-bekreft |
| 5 | Web-dokumentleser | `/dashbord/{prosjektId}/dokumenter/{dokumentId}/les` | Reader View + språkvelger + sammenlign |
| 6 | Mobil-web hamburger + «Min side» | krymp vindu / DevTools responsiv | hamburger-nav, avatar-meny → «Min side»/«Mine timer» |
| — | **Gammel-nav-sammenligning** | legg `?nyNav=0` på en side (f.eks. `/dashbord?nyNav=0`) | side-om-side: gammel nav for kontrast |

### Overflate B — mobil RN test-app (OTA-kanal, IKKE web-stacken)
| # | Steg | Hvor | Vis |
|---|---|---|---|
| 7 | 2a mobil-tabs | test-app (siste OTA) | Hjem·Tegninger·Dokumenter·Timer·Mer, Kontakter (K6) |
| 8 | 2c dokumentleser | test-app → åpne et dokument | språkpille-rad, grønt banner, «+ Oversett», bunn-ark-sammenlign |

### To ekstra observasjonspunkter (kveldens Runde 3-beslutninger — noter, ikke led)
- **(a) Sidebar-lengden hos admin** (ved steg 1–2 i admin/firma-kontekst): reagerer kunden på
  at admin-sidebaren er lang? **3a-iterasjonen venter på dette funnet** — bare noter spontan
  reaksjon, ikke spør ledende.
- **(b) Hub-fargene** (ved steg 2): blå=firma / amber=prosjekt er **invertert mot innlært
  semantikk** (bytteforslag ligger klart). Noter om kunden stusser på fargene — ikke pek på det selv.

### Overordnet vi vil vite (samme som manus)
(a) Mistes en funksjon de bruker i dag? · (b) Er ny nav subjektivt raskere/klarere? ·
(c) Noe som overrasker negativt (flyttet/fjernet)?

## Avgrensning drift vs. Opus
- **Kenneth (drift):** steg 0 reboot, steg 1 DB-kopi, steg 2 env-secrets, steg 3 DNS/tunnel,
  steg 4 OAuth, `sudo docker`-build/up (TTY).
- **Opus (kode/dok):** compose-fil, Dockerfile/turbo build-arg, env-default-flagg i hook,
  env-maler + dette manuset, native rsync av redesign-branch.
