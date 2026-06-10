# Sitedoc — Docker på ny server (UTKAST 2026-06-09)

> Førsteutkast av full-Docker-oppsett for sitedoc. Vil trenge bygg-fiks-runder (som Prisma-openssl på salsaklubb).
> Bygges/testes **uten å røre prod** — gammel sitedoc kjører til cutover.

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

## Rollback
Gammel sitedoc (PM2 på gammel server) står urørt til cutover er bekreftet; DNS tilbake + PM2 = rollback.
