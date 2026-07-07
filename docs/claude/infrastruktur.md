# Infrastruktur og deployment

> **Prod kjører i Docker på ny server (gjeldende fra 2026-06-10).** En dedikert Ubuntu 24.04-boks
> (`192.168.1.209`, hostname `sitedoc`) erstattet den gamle prod-en (Kenspill/WSL).
> Den har TPM-auto-opplåsing av kryptert disk, slår seg på selv etter strømbrudd, og nås via
> Tailscale: `ssh server-ny` fra Mac (tailnet `100.76.248.15`, nøkkel `~/.ssh/server_ny`).
> Alle tre apper (sendfil, salsaklubb, sitedoc) kjører i Docker bak tunnel `sitedoc-ny`.
> Docker-oppsett: [`../../docker/DOCKER-NOTES.md`](../../docker/DOCKER-NOTES.md) + [`../../docker/docker-compose.yml`](../../docker/docker-compose.yml).
> **Drift, deploy og gjenoppretting (runbook): [`ny-server-veileder.md`](ny-server-veileder.md).**
> Migreringshistorikk: [`../../ny-server-migrering-plan.md`](../../ny-server-migrering-plan.md).

## Serverarkitektur

```
Mac (utvikling) → git push → GitHub
                → rsync repo → server-ny:~/stack/sitedoc → docker compose build + up
                → eas build → TestFlight

server-ny (Ubuntu 24.04, Docker):
  Container sitedoc-api   :3001 → api.sitedoc.no   (publiserer også :3100 — se under)
  Container sitedoc-web   :3100 → sitedoc.no       (deler api sitt nett-namespace)
  Container sitedoc-embed :3302 → NorBERT + multilingual-e5-base   (internt på appnet)
  Container sitedoc-oversettelse :3303 → OPUS-MT   (internt på appnet)
  Container postgres      :5432 → pgvector/pgvector:pg16 (delt, egen compose ~/stack/postgres)
                                  db: sitedoc (+ sitedoc_test), rolle: sitedoc
  cloudflared (systemd)         → tunnel sitedoc-ny → sitedoc.no / api.sitedoc.no
```

> **Web↔API-nettverk (cutover-lærdom):** `sitedoc-web` bruker `network_mode: "service:sitedoc-api"` og deler API-containerens nett-namespace. Derfor publiserer `sitedoc-api` **begge** porter (`127.0.0.1:3001` + `127.0.0.1:3100`), og web sin server-side proxy av `/uploads`/`/api` til `localhost:3001` treffer API-en. Uten dette ble tegninger/3D brutt.

## Containere (docker compose)

| Container | Image | Port (host) | Beskrivelse |
|-----------|-------|-------------|-------------|
| `sitedoc-api` | Dockerfile.api | `127.0.0.1:3001` + `:3100` | Fastify/tRPC, kjøres via `tsx src/server.ts` (root `tsconfig` har `noEmit`) |
| `sitedoc-web` | Dockerfile.web | (deler api-namespace) | Next.js 14, `pnpm start`, PORT 3100 |
| `sitedoc-embed` | Dockerfile.ml | intern `appnet:3302` | NorBERT (norsk) + multilingual-e5-base (flerspråklig, lazy) |
| `sitedoc-oversettelse` | Dockerfile.ml | intern `appnet:3303` | OPUS-MT, pivot nb→en→target, LRU-cache |
| `postgres` | pgvector/pgvector:pg16 | `127.0.0.1:5432` | delt, egen compose i `~/stack/postgres` |

API når ML-tjenestene via env: `NORBERT_URL=http://embed:3302`, `OVERSETTELSE_URL=http://oversettelse:3303`.

> ⚠️ **Kode-feil — fiks klar på develop, deploy gjenstår:** `norbert-server.py` bandt `127.0.0.1` (loopback) → embedding/AI-søk var **utilgjengelig cross-container**. Fiks ligger på develop (Opus): bind gjort konfigurerbar via `NORBERT_HOST`, satt `0.0.0.0` i compose. Embedding er gjenopprettet straks fiksen er deployet + re-sjekket (`REACHABLE`). `oversettelse-server.py` binder korrekt `0.0.0.0`.

## Native avhengigheter

Bygges nå inn i Docker-imagene (ikke apt på host). `Dockerfile.api` installerer `poppler-utils` (PDF→PNG), `tesseract-ocr` + `tesseract-ocr-nor` (OCR), `xvfb`, `openssl`, `ca-certificates`, `fontconfig`. DWG→DXF: `libredwg`/ODA er kommentert ut (legg ODA-`.deb` i `docker/vendor/` for bedre DWG-konvertering).

## Miljøvariabler

Container-env settes via `env_file` (se «Env-filer på server» under) + `environment:` i `docker-compose.yml`. Uploads er bind-mountet (`~/stack/sitedoc/uploads` → `/app/apps/api/uploads`), så egen `UPLOADS_DIR`-variabel trengs ikke som på gammel server.

## Deployment

Server-git er ikke satt opp ennå, så deploy går via rsync fra Mac + Docker-bygg på server-ny:

```bash
git push                                  # fra Mac (kildekontroll)
rsync -a --exclude node_modules --exclude .next --exclude .git \
  ~/Documents/Programmering/SiteDoc/ server-ny:stack/sitedoc/
ssh -t server-ny 'cd ~/stack/sitedoc && sudo docker compose -f docker/docker-compose.yml up -d --build'
```

**Viktig:**
- `ssh -t` (TTY) kreves for at `sudo` skal kunne lese passord. **Opus/kontroll-Claude-skall er ikke-interaktive → kan IKKE kjøre `sudo`** (`ssh -t … sudo` og `sudo -n` feiler begge på passord). **Kenneth kjører alle `sudo docker`-steg via `!`-prefiks** (ekte TTY); Opus kjører native `git`/`rsync` selv. Full deploy-mekanikk + lærdommer: [docker/DOCKER-NOTES.md § Deploy-mekanikk](../../docker/DOCKER-NOTES.md).
- **Compose-prosjekt:** kjørende prod-containere er prosjekt `docker` (ikke `sitedoc` fra `name:`-linja) → bruk **`-p docker`** ved `compose`-kommandoer, ellers navnekonflikt. Deploy kun api+web: `up -d --no-deps sitedoc-api sitedoc-web` (rør ikke embed/oversettelse).
- **Postgres-container:** heter `postgres`, ikke `sitedoc-postgres` — finn via `docker ps --format '{{.Names}}' | grep postgres`.
- Prisma-endringer: de fire klientene (db/db-maskin/db-timer/db-varelager) genereres i `Dockerfile.api`-bygget, men `prisma migrate deploy` mot Postgres-containeren er **ikke automatisert ennå** — kjøres manuelt via engangs-container (`compose run --rm --no-deps --entrypoint sh sitedoc-api -c '…'`, bruk `-c` IKKE `-lc` — login-shell tømmer `$DATABASE_URL`), gated på db-navn (prod `/sitedoc`, test `sitedoc_test`). Se DOCKER-NOTES § Deploy-mekanikk pkt. 5.
- Rebuild/restart gir et kort avbrudd — varsle ved aktivitet. (Additive migreringer kan kjøres null-nedetid: build → migrate → `up --no-deps api web`; gammel api kjører OLD-klient under migrate.)
- Cutover (DNS-flytt) for `sitedoc.no`/`api.sitedoc.no` gjøres via **Cloudflare-dashboard** (egen sone — cloudflared CLI ruter feil her, jf. salsaklubb-lærdom).

## Serverdetaljer

- **SSH:** `ssh server-ny` fra Mac (Tailscale, nøkkel `~/.ssh/server_ny`)
- **Prosjekt-/stack-mappe:** `~/stack/sitedoc` (rsync-mål, inneholder `docker/` + repo) og `~/stack/postgres` (delt DB)
- **Containere (prod):** `sitedoc-api`, `sitedoc-web`, `sitedoc-embed`, `sitedoc-oversettelse`
- **Cloudflare Tunnel:** systemd, config `/etc/cloudflared/config.yml`, tunnel `sitedoc-ny` (ID `eb262307-f893-4fbf-82b7-420178cf6aea`)
- **Domene:** sitedoc.no (Domeneshop, DNS via Cloudflare)

> **Gammel server (Kenspill/WSL, PM2) — legacy, utgått 2026-06-10, beholdes som rollback.** Gammelt oppsett: `~/programmering/sitedoc` + `~/programmering/sitedoc-test`, **SSH-alias `ssh sitedoc`**, `pm2`, tunnel `sitedoc` (ID `189a5af2-…`). **IKKE bruk `ssh sitedoc` for deploy eller verifisering** — gjeldende server er `server-ny` (`ssh server-ny` via Tailscale; sudo via `! ssh -t server-ny`).
>
> ℹ️ **Kenspill kjører fortsatt en STALE test-PM2 (avklart 2026-06-21).** `sitedoc-test-api`/`sitedoc-test-web` står online som PM2 på Kenspill (3301/3300) med et eget `sitedoc_test` + cloudflared-mapping `api-test → localhost:3301` i Kenspill-tunnelen `sitedoc`. **Men edge serveres IKKE herfra** — `test.sitedoc.no`/`api-test.sitedoc.no` går til **server-ny** (tunnel `sitedoc-ny`, bevist via Funn #2-deploy: 401/405 først etter server-ny-deploy). Kenspill-test-stacken er en legacy-levning (inkl. en harmløs Funn #2-migrering som ved uhell traff Kenspills `sitedoc_test`). **Ikke bruk Kenspill for noe; bør stoppes/avvikles.**

## Cloudflare Tunnel — viktig

Gjelder tunnel `sitedoc-ny` på ny server (mekanikken er identisk med den gamle):

- **Aktiv config:** `/etc/cloudflared/config.yml` (root-eid, lest av systemd via `--config`-flagg). `~/.cloudflared/config.yml` ignoreres.
- **Sync-modell:** cloudflared pusher lokal config til Cloudflare-edge ved restart. PATCH via Cloudflare API blir overskrevet ved neste restart — `/etc/cloudflared/config.yml` er eneste varige sannhetskilde.
- **Ny hostname (5 steg):**
  1. `sudo cp /etc/cloudflared/config.yml /etc/cloudflared/config.yml.bak-$(date +%Y%m%d-%H%M%S)` — gratis backup
  2. `sudo nano /etc/cloudflared/config.yml` — entry over `http_status:404`-linja
  3. Cloudflare DNS → CNAME `<host>` → `eb262307-f893-4fbf-82b7-420178cf6aea.cfargotunnel.com`, proxied
  4. `sudo cloudflared --config /etc/cloudflared/config.yml tunnel ingress validate` — fanger YAML-feil før restart
  5. `sudo systemctl restart cloudflared` + verifiser med `curl -sI https://<host>`
- **Felle:** `cloudflared tunnel route dns <id> <host>` sier «already configured» selv om edge ikke ruterer dit — sjekker kun CNAME, ikke remote tunnel-config. For hostnames utenfor cert-sonen: bruk Cloudflare-dashboard (jf. salsaklubb `.online`-lærdom).

### Klient-IP gjennom Cloudflare Tunnel

Cloudflare Tunnel sender IKKE klient-IP i `X-Forwarded-For`. I stedet brukes `Cf-Connecting-Ip`-headeren (blokkert mot spoofing av Cloudflare-edge — verifisert med HTTP 403 ved override-forsøk).

cloudflared (på host) treffer API-containeren over docker-nettet, så `req.ip` viser ikke faktisk klient. Derfor: `trustProxy: true` + les `cf-connecting-ip`.

> Historikk: på gammel WSL2-server traff cloudflared Fastify via WSL2 Mirror Mode (ikke loopback), med samme konklusjon. Rasjonalet er det samme i Docker.

**Trygt fordi:** Fastify eksponeres aldri direkte — alltid bak cloudflared. Ved fremtidig direkte-eksponering MÅ `trustProxy` strammes igjen.

**Bruksmønster i kode:**
- `apps/api/src/utils/rateLimiter.ts:hentKlientIp(req)` prioriterer `cf-connecting-ip`, faller tilbake til `req.ip`.
- `apps/api/src/server.ts`: `trustProxy: true` + custom request-serializer som leser samme header.

## Auth-konfigurasjon

- **Auth.js:** `trustHost: true` (bak Cloudflare). Klient-side `signIn()` (IKKE server actions — MissingCSRF bak tunnel). `allowDangerousEmailAccountLinking: true` (påkrevd for invitasjonsflyt — godkjent risiko)
- **AUTH_URL / NEXTAUTH_URL = `https://sitedoc.no`** i `web.env` (cutover-lærdom): cloudflared sender `Host: localhost` internt, så uten eksplisitt AUTH_URL bygde Auth.js `redirect_uri=https://localhost:3100` → OAuth `redirect_uri_mismatch`. `AUTH_TRUST_HOST=true` settes også.
- **Google OAuth:** Web + iOS client. Consent screen: SiteDoc
- **Microsoft Entra ID (web):** Multitenant, `checks: ["state"]` (PKCE feiler bak tunnel). App ID: `d7735b7a-c7fb-407c-9bf6-80048f6f3ac5`
- **Microsoft Entra ID (mobil) — DEDIKERT public-client-app** «SiteDoc Mobile», App ID `234ca0e0-afd1-48e3-9736-b904d4b5a008` (separat fra web for ren posture-isolasjon). Mobil bruker **authorization code + PKCE** (`expo-auth-session`, app-side `exchangeCodeAsync`), ikke web-Auth.js. Azure-oppsett (kjørt manuelt — ikke i kode):
  - Supported account types: **Accounts in any organizational directory** (multitenant — så A.Markussens tenant virker).
  - Authentication → plattform **«Mobile and desktop applications»** → custom redirect URI **`sitedoc://auth`** (eksakt; path-segment unngår trailing-slash-mismatch). IKKE «Web».
  - Advanced → **«Allow public client flows» → Yes**. Ingen client-secret (public client).
  - API permissions → Microsoft Graph (delegated): `openid`, `email`, `profile`, `User.Read`.
  - Client-id er offentlig → ligger i `apps/mobile/eas.json` (ikke secret). Mobil-flyt leverer MS access token til `mobilAuth.byttToken` (Graph-verifisering + orphan-guard, uendret).

## Sikkerhet

**CORS:** Callback-basert whitelist (`https://sitedoc.no`, `https://test.sitedoc.no`, `http://localhost:3100`, `http://localhost:3300`, `http://localhost:3000`) med `credentials: true`. Ukjente origins avvises aktivt. Konfigurert i `apps/api/src/server.ts`.

**Filopplasting:** `/upload`-endepunkt krever autentisert sesjon. Tillatte typer: PDF, DWG, DXF, IFC, PNG, JPG, LAS, LAZ, E57, PLY. UUID-filnavn. `X-Content-Type-Options: nosniff`. Fastify-grense: 500 MB. **Cloudflare Free-plan begrenser uploads til 100 MB** — filer over dette krever chunked upload (se TODO).

**Rate limiting:** Minnebasert (`apps/api/src/utils/rateLimiter.ts`). Automatisk opprydding hvert 5. minutt. Grenser: `byttToken` (10/min), `/upload` (30/min), invitasjons-endepunkter (10-20/min).

**Mobilsesjon:** 256-bit token (`crypto.randomBytes`), roteres ved hver `verifiser`-kall, server-side sletting ved utlogging.

**API-autorisasjon:** Alle ruter med prosjektdata har `verifiserProsjektmedlem`-sjekk. Dokumentruter bruker `verifiserDokumentTilgang`. `endreStatus` bruker `ctx.userId` (aldri bruker-input som `senderId`).

### Kjente aksepterte risikoer

- **`allowDangerousEmailAccountLinking`** — Påkrevd for invitasjonsflyten. Risiko: kontoovertakelse hvis angriper kontrollerer OAuth-konto med offerets e-post. Lav i praksis (Google/Microsoft verifiserer e-post)
- **OAuth access tokens lagres ukryptert** i `accounts`-tabellen (Auth.js standard). Krever DB-kompromittering for utnyttelse

### Anbefalte tiltak (prioritert)

1. **Oppgrader Next.js 14 → 15+** — Kjent DoS-sårbarhet (HTTP-deserialisering). Stor jobb pga. React 19 og App Router-endringer — egen oppgave
2. **Sett sikkerhetsheadere i Cloudflare** — CSP, X-Frame-Options, Strict-Transport-Security (Cloudflare Dashboard → Rules → Transform Rules)
3. **Web-tRPC: verifiser sesjon i database** — web stoler i dag på Auth.js cookie-deserialisering uten DB-oppslag. En slettet sesjon forblir gyldig til cookien utløper. Fiks: DB-sjekk i `apps/web/src/app/api/trpc/[...trpc]/route.ts`
4. **Maks alder på mobilappens offline-cache** — 24-timers maks alder i `AuthProvider`
5. **Flytt rate limiting til Redis** — minnebasert nullstilles ved restart; bør gjøres når brukerbasen vokser

## TODO: Chunked upload for store filer

Cloudflare Free-plan har 100 MB upload-grense. Store IFC-filer (>100 MB) feiler. Løsning: chunked upload.

**Plan:**
1. **Klient:** Del filen i chunks (f.eks. 50 MB), send hver chunk med `uploadId` + `chunkIndex` + `totalChunks`
2. **API:** Nytt `/upload/chunk`-endepunkt som lagrer chunks midlertidig, og `/upload/complete` som setter dem sammen
3. **Opprydding:** Slett uferdige chunks etter 1 time
4. **Fremdriftsindikator:** Upload-progress på klientsiden

Berører: `apps/api/src/routes/upload.ts`, opplastingskomponenter i web og mobil.

## Env-filer på server

Env ligger nå i `~/stack/sitedoc/docker/env/` (lest av compose via `env_file`):

| Fil | Nøkkelvariabler |
|-----|----------------|
| `docker/env/api.env` | `DATABASE_URL`/`DIRECT_URL` (`postgresql://sitedoc:***@postgres:5432/sitedoc`), `PORT=3001`, `AUTH_SECRET`, `RESEND_API_KEY`, `VEGVESEN_API_KEY`, `SITEDOC_INTEGRATION_KEY` |
| `docker/env/web.env` | `AUTH_SECRET`, `AUTH_GOOGLE_*`, `AUTH_MICROSOFT_*`, `AUTH_URL`/`NEXTAUTH_URL=https://sitedoc.no`, `AUTH_TRUST_HOST=true`, `DATABASE_URL` (samme), `RESEND_*` |

> Env-filene kopieres aldri inn i image (`.dockerignore` ekskluderer `docker/env/*.env`); de leses kun på host ved `up`. Nøkler håndteres av Kenneth.

## Test-miljø

Test-databasen `sitedoc_test` finnes i den delte Postgres-containeren (restoret med `pg_restore --no-owner` + `REFRESH COLLATION VERSION`).

**Test-stack på server-ny (etablert 2026-06-11):** egne containere `sitedoc-test-api` + `sitedoc-test-web` (prosjekt `sitedoc-test`) via `docker/docker-compose.test.yml`, mot `sitedoc_test`-DB, deler prod sin `embed`/`oversettelse`/`postgres`. Eksponert på `test.sitedoc.no` (3300) + `api-test.sitedoc.no` (3301) via tunnel `sitedoc-ny`. Env: `docker/env/{api-test,web-test}.env`. Verifisert HTTP 200 eksternt (2026-06-11). Deploy-prosedyre i [`ny-server-veileder.md`](ny-server-veileder.md) → «Test-stack».

> ✅ **Denne (server-ny) er den autoritative test-stacken som serverer edge (bekreftet 2026-06-21).** `test.sitedoc.no`/`api-test.sitedoc.no` går hit (tunnel `sitedoc-ny`). Bevis: Funn #2-rutene ga 404 på edge før server-ny-deploy og 401/405 etter — så edge = server-ny. **Deploy/migrer test KUN her** (rsync + `docker-compose.test.yml`, se [`ny-server-veileder.md`](ny-server-veileder.md) → «Test-stack»). Kenspills test-PM2 (se «Gammel server»-blokken) er en stale legacy-levning som ikke serverer edge.

> ⚠️ **Test-deploy er MANUELL — ingen auto-deploy finnes** (bekreftet 2026-07-07). Push til `develop` oppdaterer IKKE test av seg selv (ingen CI/cron/hook/webhook — «auto-deployen» var den gamle PM2-ettlinjeren som gikk tapt i migreringen 2026-06-10). Kjør `./deploy-test.sh` fra Mac (rsync `--delete` til `server-ny:stack/sitedoc`, excludes `docker/env`+bloat, branch-guard develop) → den skriver ut `sudo docker compose -f docker/docker-compose.test.yml up -d --build` som Kenneth kjører i egen TTY. Se [BACKLOG § «Auto-deploy til test» finnes ikke](BACKLOG.md).

> Gjenstår fortsatt: automatisert `prisma migrate deploy` (kjøres manuelt ved schema-endring — se TODO over).

## EAS Build og TestFlight

- **Expo-konto:** kemyrhau
- **Apple App ID:** 6760205962
- **Bundle ID:** com.kemyrhau.sitedoc (iOS), com.sitedoc.app (Android)
- **Bygg iOS:** `cd apps/mobile && eas build --platform ios --profile production`
- **Send til TestFlight:** `eas submit --platform ios --latest`
- **VIKTIG:** `.env`-filer leses IKKE av EAS. `EXPO_PUBLIC_*`-variabler MÅ stå i `eas.json` under `build.<profil>.env`
- TestFlight: opptil 10 000 testere via App Store Connect
