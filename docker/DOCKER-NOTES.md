# Sitedoc — Docker på ny server (I PROD fra 2026-06-10)

> Full-Docker-oppsett for sitedoc, **deployet til prod på server-ny 2026-06-10** (test+prod, pgvector, ML, innlogget+tegninger+3D verifisert). Gammel sitedoc (PM2) er rollback.
> Gjeldende deploy/infra: `../docs/claude/infrastruktur.md`. Seksjonene under er oppsett-/build-referansen som ble fulgt.
>
> 🖥️ **Server-tilgang:** gjeldende server = **`server-ny`** (Tailscale; sudo-steg kjøres av Kenneth via **`! ssh -t server-ny ...`**). SSH-aliaset **`ssh sitedoc` → Kenspill/WSL = GAMMEL (legacy) server — IKKE for deploy/verifisering.** **Host-mapping (bekreftet 2026-06-21):** både prod OG test (`test.sitedoc.no` 3300 / `api-test.sitedoc.no` 3301, prosjekt `sitedoc-test`, tunnel `sitedoc-ny`) serveres fra **server-ny**. Kenspills test-PM2 + `sitedoc_test` er en stale legacy-levning som ikke serverer edge — ikke bruk (jf. [infrastruktur.md](../docs/claude/infrastruktur.md)).

## Komponenter
| Tjeneste | Image | Port | Innhold |
|---|---|---|---|
| `sitedoc-api` | Dockerfile.api | 3001 | Fastify/tRPC + native konvertere (poppler, tesseract+nor, xvfb, libredwg, evt. ODA) |
| `sitedoc-web` | Dockerfile.web | 3100 | Next.js 14 |
| `embed` | Dockerfile.ml | 3302 | NorBERT + multilingual-e5 (torch/transformers) |
| `oversettelse` | Dockerfile.ml | 3303 | OPUS-MT (samme image, annen command) |
| `postgres` | pgvector/pgvector:pg16 | 5432 | delt container (egen compose) — pgvector klar |

Alle på docker-nett `appnet`, bundet til `127.0.0.1`.

## Det Kenneth må skaffe / sette (nøkler — Claude ser dem aldri)
1. **Env-filer** i `docker/env/`:
   - `api.env` — `DATABASE_URL=postgresql://<rolle>:<pw>@postgres:5432/sitedoc`, `AUTH_SECRET`, `RESEND_API_KEY`, `VEGVESEN_API_KEY`, `APP_URL`, `SITEDOC_INTEGRATION_KEY` …
   - `web.env` — `AUTH_SECRET`, `AUTH_GOOGLE_*`, `AUTH_MICROSOFT_*`, `AUTH_TRUST_HOST=true`, `DATABASE_URL` (samme), `RESEND_*` …
   - Kopier fra gammel server (`~/programmering/sitedoc/apps/{api/.env,web/.env.local}`), endre kun `DATABASE_URL`/`DIRECT_URL` → `@postgres:5432`.
2. **DB-rolle:** opprett `sitedoc`-rolle (least-privilege) + database, som vi gjorde med `salsa`. Prod-DB er eid av `postgres` på gammel server — vi restorer med `--no-owner` til ny rolle.
3. **(Valgfritt) ODAFileConverter .deb** → `docker/vendor/` + fjern kommentar i Dockerfile.api. Uten den: `dwg2dxf` (libredwg) som fallback.

## Åpne punkter å verifisere under bygg
- **Oversettelse-URL env-navn:** sjekk `apps/api/src/services/oversettelse-service.ts` — sett riktig env (f.eks. `OVERSETTELSE_URL=http://oversettelse:3303`) i `api.env`/compose. (`NORBERT_URL` er bekreftet.)
- **web build** kan trenge `output: "standalone"` i `next.config.mjs` for slankere/raskere runtime (oppfølger, ikke blokkerende).
- **ML første start** laster flere GB modellvekter fra HuggingFace → `ml_models`-volum. Bygg/kjør `embed` først så vekter caches.

## Build-/test-rekkefølge (TEST-miljø først — generalprøve)
1. Postgres → pgvector ✅ (gjort). Opprett rolle `sitedoc` + database `sitedoc_test`.
2. **DB-migrering (test):** `pg_dump -Fc sitedoc_test` (gammel) → Mac → ny server → `pg_restore --no-owner --no-privileges -U sitedoc -d sitedoc_test` → `ALTER DATABASE sitedoc_test REFRESH COLLATION VERSION;` → bekreft `CREATE EXTENSION vector` finnes.
3. **Kode på server:** rsync ny-server-branch (eller prod-kode) til `~/stack/sitedoc`.
4. **Bygg:** `sudo docker compose -f docker/docker-compose.yml build` (api + web + ml — tar tid).
5. **Opp:** `... up -d`. Verifiser lokalt: `curl 127.0.0.1:3001/health`, `curl -H "Host: test.sitedoc.no" 127.0.0.1:3100/` (innlogget), AI-søk + oversettelse (treffer embed/oversettelse).
6. **Cutover** (eget steg, prod): fersk `pg_dump sitedoc` → restore (ALDRI slett data) → flytt DNS for `sitedoc.no` + `api.sitedoc.no` via **Cloudflare-dashboard** (egen sone — cloudflared CLI virker IKKE her, jf. salsaklubb-lærdom) → verifiser innlogget i nettleser.

## Gotcha: `API_PORT` for Next `/api/upload`-rewrite — 3 lag (lærdom 2026-06-12/13)
Web-containeren deler API-ens nett-namespace (`network_mode: service:<api>`). Next-rewriten i
`apps/web/next.config.js` proxer `/api/upload` + `/api/uploads/:path*` til
`http://localhost:${API_PORT || "3001"}/upload`. **`API_PORT` MÅ matche API-ens `PORT`** i samme
namespace, ellers treffer rewriten en død port → 500 «Internal Server Error» → «Kunne ikke laste opp
filen» i UI (og tegningsbilder vises ikke). Prod-API = 3001 (= default, virket tilfeldigvis), men
**test-API = 3301** → test fikk feil port og all tegning/bilde-opplasting var brutt etter
Docker-migreringen. Feilsøkingen avdekket TRE lag som alle må stemme:

1. **Runtime-env er for sent.** Rewrite-destinasjonen bakes inn i `.next/routes-manifest.json` ved
   `next build`-tid. `environment:` / `env_file` påvirker ikke en allerede bygd manifest.
2. **Build-arg.** `API_PORT` settes som build-arg: `Dockerfile.web` har `ARG API_PORT=3001` → `ENV
   API_PORT=${API_PORT}` FØR `pnpm turbo build`. Per miljø: **test 3301 / prod 3001**.
3. **Turbo v2 strict-env.** Selv med ARG/ENV stripper Turbo v2 ukjente env-variabler bort fra
   build-taskens miljø → `next build` så aldri `API_PORT`. **`turbo.json` må ha
   `tasks.build.env: ["API_PORT"]`** (slipper den gjennom OG inn i cache-hashen, så portbytte
   buster cachen). Uten dette nr. 2 er virkningsløst.

**Bevist deploy-sti:** `docker build --build-arg API_PORT=<port> ...` (eksplisitt) + `up -d`.
Hvorvidt `compose.build.args` alene når frem til buildx/bake er **uavklart** — ikke bekreftet, ikke
anta det. Bruk eksplisitt `--build-arg` ved web-rebuild til dette evt. er verifisert. Verifiser
manifest etter build: `grep '/api/upload' apps/web/.next/routes-manifest.json` skal vise riktig
port; live: `curl -X POST https://test.sitedoc.no/api/upload` skal gi `401 JSON` (ikke `500`).

## Deploy-mekanikk (lærdommer fra Slice 1–4 prod-deploy 2026-06-21)

Denne deployen traff gjentatt friksjon som ikke var dokumentert → «gjenoppdaget». Fanget her som fast prosedyre.

1. **sudo/TTY-barriere.** `server-ny` `sudo` krever interaktivt passord (ingen NOPASSWD). Opus/kontroll-Claude kjører i ikke-interaktive skall → `ssh -t … sudo …` gir «Pseudo-terminal will not be allocated» + «sudo: a password is required», og `sudo -n` gir «a password is required». **Konklusjon:** Opus prøver ALDRI å kjøre `sudo` på server — Kenneth kjører alle `sudo docker`-steg via `!`-prefiks (ekte TTY). Opus kjører native `git`/`rsync` (uten sudo) selv.

2. **Postgres-container heter `postgres`** (compose-tjeneste), IKKE `sitedoc-postgres`. Finn robust:
   ```
   PG=$(sudo docker ps --format '{{.Names}}' | grep -m1 postgres)
   sudo docker exec "$PG" psql -U sitedoc -d <db> -c "…"
   ```

3. **Compose-prosjektnavn-mismatch.** Kjørende prod-containere ble opprettet under prosjekt `docker` (mappe-avledet, før `name:`-linja fantes), men `docker-compose.yml` har nå `name: sitedoc`. `compose up` uten `-p` lager da et NYTT prosjekt → `Conflict. The container name "/sitedoc-api" is already in use`. **Workaround:** `-p docker` (matcher kjørende prosjekt). Diagnostiser med `docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' sitedoc-api`. **Reconcile-følgesak:** bestem ett prosjektnavn permanent — gjøres når NorBERT-rebuild uansett gjenskaper embed/oversettelse.

4. **Nett-topologi.** `appnet` er `external: true` (delt på tvers av stacks → ufarlig ved recreate). `sitedoc-web` bruker `network_mode: "service:sitedoc-api"` (deler api-namespace) → web recreates med/etter api.

5. **Migrate via engangs-container.** Runtime-imaget har prisma CLI + migrasjonsfiler (`COPY --from=build /app`). Kjør:
   ```
   sudo docker compose -p docker -f docker/docker-compose.yml run --rm --no-deps \
     --entrypoint sh sitedoc-api -c '<gate>; pnpm --filter @sitedoc/db exec prisma migrate deploy && pnpm --filter @sitedoc/db-timer exec prisma migrate deploy'
   ```
   - **Bruk `-c`, IKKE `-lc`.** Login-shell (`-l`) sourcer container-profil som gir `sh: 1: : not found`-støy OG tømmer `$DATABASE_URL` → gaten ser tom URL → **falsk «ABORT: ikke sitedoc»** (skjedde 2026-06-21; ingen skade, gate feilet trygt).
   - **Gate (db-navn, ikke secret):** prod krever `/sitedoc`, test krever `sitedoc_test`:
     ```
     echo "$DATABASE_URL" | grep -q sitedoc_test && { echo ABORT test; exit 1; }
     echo "$DATABASE_URL" | grep -qE "/sitedoc([?]|$)" || { echo ABORT ikke-sitedoc; exit 1; }
     ```
   - **`generate` er bakt inn i `Dockerfile.api`-bygget** (4 klienter) → IKKE eget runtime-steg (en `--rm`-generate ville vært flyktig).

6. **Deploy KUN api+web** (ikke rør embed/oversettelse): `up -d --no-deps sitedoc-api sitedoc-web`. `--no-deps` hindrer at compose gjenskaper `embed`/`oversettelse` (begge `sitedoc-ml:latest`) — viktig når ml-imaget også ble bygd men NorBERT-rebuild skal være egen oppgave.

**Bevist null-nedetid additiv-migrerings-sekvens (2026-06-21):** rsync → `build --build-arg API_PORT=<port>` → migrate (engangs-container, gated) → `up -d --no-deps sitedoc-api sitedoc-web`. Gammel api kjører OLD-klient under build+migrate (rører ikke nye kolonner) → null gap. Backup først: `pg_dump -Fc -U sitedoc -d sitedoc`.

## Rollback
Gammel sitedoc (PM2 på gammel server) står urørt til cutover er bekreftet; DNS tilbake + PM2 = rollback.
