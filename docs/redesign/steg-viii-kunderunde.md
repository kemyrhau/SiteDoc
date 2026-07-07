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
# PORT/HOST/NORBERT_URL/OVERSETTELSE_URL settes i compose (environment:)
```

### `docker/env/web-redesign.env`
```
AUTH_SECRET=<SAMME som api-redesign AUTH_SECRET>
AUTH_URL=https://redesign.sitedoc.no
NEXTAUTH_URL=https://redesign.sitedoc.no
AUTH_TRUST_HOST=true
DATABASE_URL=postgresql://sitedoc:<PASSORD>@postgres:5432/sitedoc_redesign
# Egne OAuth-apper for redesign-subdomenet (egne client-id/secret):
AUTH_GOOGLE_ID=<redesign google client id>
AUTH_GOOGLE_SECRET=<redesign google secret>
AUTH_MICROSOFT_ID=<redesign entra client id>
AUTH_MICROSOFT_SECRET=<redesign entra secret>
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

**Steg 4 — OAuth-callbacks:** legg `https://redesign.sitedoc.no/api/auth/callback/{google,microsoft-entra-id}`
i redesign-Google-appen + web-Entra-appen (samme AADSTS50011-felle som test).

**Steg 5 — rsync + build + up** (Opus kan kjøre native rsync; `sudo docker` = Kenneth):
```
# RE-RSYNC redesign/navigasjon FØR build (delt build-kontekst!):
rsync -a --exclude node_modules --exclude .next --exclude .git --exclude docker/env \
  ~/Documents/Programmering/SiteDoc/ server-ny:~/stack/sitedoc/
# på server:
sudo docker compose -f docker/docker-compose.redesign.yml build \
  --build-arg API_PORT=3501 --build-arg NEXT_PUBLIC_NY_NAV_DEFAULT=1
sudo docker compose -f docker/docker-compose.redesign.yml up -d
# migrering trengs normalt IKKE (DB er prod-kopi, samme schema). Hvis kjørt: gate på $DATABASE_URL:
#   echo "$DATABASE_URL" | grep -q sitedoc_redesign || { echo ABORT; exit 1; }
```

**Verifiser:** `https://redesign.sitedoc.no` laster innlogget, ny nav default-på, `?nyNav=0` gir gammel nav.

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

## Avgrensning drift vs. Opus
- **Kenneth (drift):** steg 0 reboot, steg 1 DB-kopi, steg 2 env-secrets, steg 3 DNS/tunnel,
  steg 4 OAuth, `sudo docker`-build/up (TTY).
- **Opus (kode/dok):** compose-fil, Dockerfile/turbo build-arg, env-default-flagg i hook,
  env-maler + dette manuset, native rsync av redesign-branch.
