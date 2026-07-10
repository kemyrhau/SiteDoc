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

3. **Compose-prosjektnavn-mismatch.** Kjørende prod-containere ble opprettet under prosjekt `docker` (mappe-avledet, før `name:`-linja fantes), men `docker-compose.yml` har nå `name: sitedoc`. `compose up` uten `-p` lager da et NYTT prosjekt → `Conflict. The container name "/sitedoc-api" is already in use`. **Workaround:** `-p docker` (matcher kjørende prosjekt). Diagnostiser med `docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' sitedoc-api`. **Reconcile-følgesak:** bestem ett prosjektnavn permanent — gjøres når NorBERT-rebuild uansett gjenskaper embed/oversettelse. **`--force-recreate` løser IKKE cross-prosjekt-orphan (lærdom 2026-07-07):** når containeren finnes under ett compose-prosjekt (`docker`) og du kjører `up` under et annet (default `sitedoc`), lager `--force-recreate` fortsatt en ny/kolliderende container i feil prosjekt — den re-adopterer ikke den kjørende under riktig prosjekt. Løs med **`-p docker`** (matcher kjørende prosjekt) ELLER **`docker rm -f <container>` + `up`** (fjern orphan-en, la `up` gjenskape rent). Force-recreate alene = fortsatt navnekonflikt/orphan.

   > **✅ Reconcile UTFØRT for api/web (verifisert 2026-07-09) — `-p docker` er nå UTDATERT for `sitedoc-api`/`sitedoc-web`.** `docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' sitedoc-api sitedoc-web sitedoc-embed` gir `sitedoc` / `sitedoc` / `docker`: api/web ble recreatet **uten** `-p` (da `connection_limit` ble satt) og tilhører nå prosjekt **`sitedoc`**. Kun `embed`/`oversettelse` ligger igjen i `docker`. **`-p docker` for api/web gir nå «Conflict. The container name /sitedoc-api is already in use» — IKKE bruk det.** Riktig i dag for api/web-`up`: `docker compose -f docker/docker-compose.yml up -d --no-deps sitedoc-api sitedoc-web` (**uten `-p`**; `--no-deps` beskytter embed/oversettelse på tvers av prosjektgrensen). **Migrate-steget (punkt 5) bruker fortsatt `-p docker`** — engangs-container (`run --rm`), ingen navnekonflikt.

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

7. **Verifiser hvilken kode et KJØRENDE image inneholder (lærdom 2026-07-04).** Ved «er commit X allerede på prod?» — IKKE stol på i18n-streng-grep i `.next`: Next inliner ikke UI-strenger grep-bart i standalone-buildet (kontroll-grep `Geofence` traff bare `.next/trace`, ikke chunks → alle i18n-markører falt falskt ABSENT). To pålitelige metoder: **(a) commit-dato vs image-byggetid** — `docker inspect -f '{{.Created}}' sitedoc-web` gir image-tid; `git show -s --format=%cI <commit>` gir commit-tid; commit nyere enn image → IKKE i kjørende image. **(b) kode-streng-markør i `apps/*/src`** — runtime-imaget kopierer `COPY --from=build /app` (inkl. `src`), så `docker exec sitedoc-api grep -rl '<distinkt norsk kode-streng>' /app/apps/api` er pålitelig for api-kode. Merk: `main` kan ligge FORAN kjørende prod (commits merget for f.eks. mobil-bunt uten prod-server-deploy) — sammenlign alltid mot image-byggetid, ikke mot `main`-tip.

8. **Env-endring (secret) krever RECREATE, ikke restart — og web force-recreate pga. delt namespace (lærdom 2026-07-06).** Ny verdi i `docker/env/api-test.env` (f.eks. `DEV_LOGIN_SECRET`) plukkes IKKE opp av `docker restart` — `env_file` leses kun ved container-**opprettelse**. Kjør `up -d --force-recreate --no-deps sitedoc-test-api`. Fordi `sitedoc-test-web` deler api-ens nett-namespace (`network_mode: service:sitedoc-test-api`, jf. punkt 4), **invalideres web-en når api recreates** → force-recreate web også (`up -d --force-recreate --no-deps sitedoc-test-api sitedoc-test-web`), ellers står web med død namespace-referanse (connection reset på :3300). **Verifiser runtime-env ved secret-mistanke (aldri echo verdien):**
   ```
   sudo docker exec sitedoc-test-api sh -c 'printf %s "$DEV_LOGIN_SECRET" | sha1sum'
   ```
   Sammenlign sha1 med kilden (samme kommando mot `.env`-verdien Mac-side). Ulik sha1 = containeren kjører gammel secret → recreate. (Rotårsak til at dev-login feilte 401 selv med «riktig» secret 2026-07-06: containeren kjørte en tidligere `DEV_LOGIN_SECRET`.)

**Bevist null-nedetid additiv-migrerings-sekvens (2026-06-21):** rsync → `build --build-arg API_PORT=<port>` → migrate (engangs-container, gated) → `up -d --no-deps sitedoc-api sitedoc-web`. Gammel api kjører OLD-klient under build+migrate (rører ikke nye kolonner) → null gap. Backup først: `pg_dump -Fc -U sitedoc -d sitedoc`.

> ⚠️ **rsync MÅ skje FØR `docker compose build` (lærdom 2026-06-22).** Bygg-konteksten er server-fila i `~/stack/sitedoc` (`context: ..`), ikke Mac-en. Kjøres `build` uten fersk rsync, gjenbruker Docker cachede lag og imaget får IKKE den nye koden. **Diagnostisk fingerprint:** et ekte (cache-miss) bygg tar ~**268 s**; et tomt cache-bygg uten ny kode tar ~**6,1 s** — og nye tRPC-ruter svarer da **404** på edge fordi de aldri kom inn i imaget. Ser du et ~6 s «build» etter en kodeendring: du glemte rsync. Rekkefølge alltid: **rsync → build → (migrate) → up**.

> ⚠️ **Delt build-kontekst prod↔test — re-rsync riktig branch før hver build (lærdom 2026-07-04).** Både prod (`docker-compose.yml`, `-p docker`) og test (`docker-compose.test.yml`, `sitedoc-test`) bygger fra **samme** `~/stack/sitedoc`. Konteksten holder koden fra **siste rsync** — så etter en test-deploy (develop) ligger develop-kode der, og et påfølgende prod-build ville bygget **develop inn i prod** uten en fersk `main`-rsync. **Regel:** re-rsync alltid riktig branch før build — **`main` for prod, `develop` for test**. Bekreft med markør-grep i konteksten (distinkt kode-streng fra branchen) FØR `up -d --build`.

> ⚠️ **rsync ekskluderer `docker/env` (lærdom 2026-07-04).** Server-env-filene (`docker/env/{api,web,api-test,web-test}.env`) er **autoritative + gitignored**. Kanonisk rsync: `rsync -a --exclude node_modules --exclude .next --exclude .git --exclude docker/env`. Uten `--exclude docker/env` kan en lokal `docker/env`-mappe overskrive server-env (`DATABASE_URL` m.m.) → brutt miljø. (2026-07-04: prod-rsync droppet excluden — harmløst **kun** fordi Mac-kilden ikke hadde `docker/env`. Ikke stol på flaks.)
>
> **Merk:** rsync ekskluderer KUN `docker/env`, ikke hele `docker/` — bevisst. Repoet er sannhetskilde for `docker-compose*.yml` + `Dockerfile.*`, så de SKAL overskrive serverens versjoner ved rsync (holdes i synk med koden). Kun `docker/env/*.env` er server-autoritativ (gitignored) og ekskluderes.

## Rollback
Gammel sitedoc (PM2 på gammel server) står urørt til cutover er bekreftet; DNS tilbake + PM2 = rollback.
