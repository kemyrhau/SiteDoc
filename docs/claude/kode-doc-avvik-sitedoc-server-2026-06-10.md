---
name: kode-doc-avvik-sitedoc-server-2026-06-10
status: 🟡 HISTORISK — UVERIFISERT
sist_verifisert_mot_kode: 2026-06-10 (av forfatteren; IKKE re-verifisert siden)
---

# Kode/dokumentasjon-avvik — sitedoc-server

> 🟡 **HISTORISK REVISJON — IKKE PRESENS. Ingen av de 13 avvikene er re-verifisert.**
>
> Dokumentet ble skrevet **2026-06-10**, under Docker-cutoveren. Det lå **untracked** i `sitedoc-server`-arbeidstreet i fem uker og ble reddet 2026-07-17 da treet skulle fjernes — `git worktree remove` nektet fordi treet var dirty, og det var eneste grunn til at fila ble funnet. Null commits i repoet rørte den; den fantes i ett eksemplar, på én maskin.
>
> **Les den som en tilstandsrapport fra 10. juni, ikke som en funnliste.** Avvikene kan være rettet, kan ha råtnet videre, eller kan ha byttet form. Serveren er migrert til Docker siden (`server-ny`, cutover 2026-06-10 → isolert 2026-07-09), så flere av premissene har flyttet seg. Re-verifisering er ført som egen sak i [BACKLOG.md](BACKLOG.md).
>
> Ført i git 2026-07-17 fordi den ellers ville dødd med treet — tredje foreldreløse leveranse funnet samme døgn, sammen med fase-M-forarbeidets vedlegg og `plan-testflight-38.md`.

**Dato:** 2026-06-10
**Gjennomgang:** Systematisk sammenligning av dokumentasjon mot faktisk kode/konfig i `sitedoc-server`-mappen (server-/migreringsvarianten).

## Sammendrag

- **Totalt 13 avvik** funnet.
- **Høy alvorlighet: 4** — gjelder hovedsakelig at `infrastruktur.md`, `deploy.sh` og `deploy-test.sh` fortsatt beskriver/retter seg mot den gamle PM2/WSL-serveren, mens migreringen til ny Docker-server er fullført 2026-06-10.
- **Middels: 5** — udokumentert `docker/`-mappe, modellnavn-/versjons-drift, en sannsynlig cross-container-nettverksfeil i compose.
- **Lav: 4** — utdaterte versjons-/forutsetningsangivelser i README, kosmetiske strukturavvik.

Hovedfunnet: **`docker/`-mappen er IKKE dokumentert i hovedfilene (CLAUDE.md, README.md), og migreringsstatus-dokumentene spriker** — `parallell-arbeid-lock.md` og selve migreringsplanen er oppdatert til «FULLFØRT», men `infrastruktur.md` og deploy-skriptene beskriver fortsatt gammel server som live prod.

---

## Avvikstabell

### A1 — `infrastruktur.md` sier sitedoc IKKE er migrert (HØY)
- **Doc:** `docs/claude/infrastruktur.md:7` — «sitedoc + salsaklubb er foreløpig IKKE migrert — resten av dette dokumentet beskriver fortsatt live prod (gammel server).» Linje 3: «Ny server under oppsett (2026-06-08) — IKKE prod ennå.»
- **Faktisk:** `parallell-arbeid-lock.md:15` og `ny-server-migrering-plan.md:200` sier **«FULLFØRT 2026-06-10 ✅»** — sitedoc kjører i full Docker på ny server (web 3100, api 3001, ML 3302, oversettelse 3303, pgvector-Postgres), DNS for `sitedoc.no`/`api.sitedoc.no` flyttet til tunnel `sitedoc-ny`, gamle apper stoppet som rollback. Brukeren bekreftet migrering fullført 2026-06-10.
- **Alvorlighet:** Høy
- **Forslag:** Oppdater toppblokken i `infrastruktur.md` til å beskrive ny Docker-server som live prod. Hele dokumentet (PM2-tabell, serverarkitektur-diagram, deploy-seksjoner, env-fil-stier) beskriver gammel server og må revideres eller markeres som arkivert/historisk.

### A2 — `deploy.sh` deployer til gammel PM2-server (HØY)
- **Doc/kode:** `deploy.sh:13` — `ssh sitedoc "cd ~/programmering/sitedoc && git pull && pnpm install ... && pm2 restart sitedoc-web sitedoc-api"`. Bruker SSH-alias `sitedoc` (gammel server), PM2, og git-pull-bygg-modellen.
- **Faktisk:** Prod kjøres nå i Docker på ny server (`ssh server-ny`), via `docker compose -f docker/docker-compose.yml`. Cutover skjedde via Cloudflare-dashboard, ikke deploy-skriptet. `pm2 restart sitedoc-web/-api` treffer en stoppet rollback-instans på gammel server.
- **Alvorlighet:** Høy (å kjøre skriptet nå deployer til feil/avviklet maskin)
- **Forslag:** Oppdater eller deprecate `deploy.sh`. Ny deploy-prosess (docker compose build/up på `server-ny`) bør dokumenteres; se `docker/DOCKER-NOTES.md` som finnes men ikke er lenket fra noen indeks.

### A3 — `deploy-test.sh` retter seg mot gammel test-server (HØY)
- **Kode:** `deploy-test.sh:13` — `ssh sitedoc "cd ~/programmering/sitedoc-test && ... && pm2 restart sitedoc-test-web sitedoc-test-api"`.
- **Faktisk:** Test-miljøet ble etablert på ny server (`sitedoc_test` i pgvector-container, jf. `docker/DOCKER-NOTES.md:31-32`). Skriptet peker fortsatt på gammel PM2-test.
- **Alvorlighet:** Høy
- **Forslag:** Samme som A2 — oppdater eller marker som utdatert; beskriv test-deploy på ny Docker-server.

### A4 — CLAUDE.md deploy-seksjon beskriver gammel PM2-flyt (HØY)
- **Doc:** `CLAUDE.md` § «Utviklingsmiljø og deploy» og § «Deploy-sekvens» — hele seksjonen er bygget rundt `ssh sitedoc`, `pm2 restart`, `~/programmering/sitedoc(-test)`, Turbo-cache-`.next`-rensing på gammel server. Refererer `deploy-detaljer.md` og `infrastruktur.md` for server-detaljer.
- **Faktisk:** Prod/test kjører nå i Docker-containere på `server-ny`. PM2-restart-reglene, `.next`-rense-reglene og `git pull`-modellen gjelder ikke det nye Docker-bygget (image bygges fra repo-rot, web deler api sitt nett-namespace, osv. — jf. `docker/docker-compose.yml`).
- **Alvorlighet:** Høy (CLAUDE.md er styrende; gir Claude feil deploy-mental-modell)
- **Forslag:** Legg til en seksjon om Docker-deploy på ny server, eller marker PM2-seksjonen som «gammel server (avviklet/rollback)». Merk: dette er server-/migreringsvarianten — i hovedmappen `SiteDoc` kan PM2-flyten fortsatt være gjeldende, så avgrens tydelig hvilken variant som gjelder.

### A5 — `docker/`-mappen er udokumentert i hovedfilene (MIDDELS)
- **Doc:** Verken `CLAUDE.md`, `README.md` eller `MALBYGGER.md` nevner ordet «docker» (grep: 0 treff). `README.md` § Prosjektstruktur (linje 76-89) og `CLAUDE.md` § Prosjektstruktur lister `apps/`, `packages/`, `docs/` — men ikke `docker/`, `ftd-worker/` eller `scripts/`.
- **Faktisk:** `docker/` finnes med `docker-compose.yml`, `Dockerfile.api`, `Dockerfile.web`, `Dockerfile.ml`, `DOCKER-NOTES.md` (sist endret 10. jun). `.dockerignore:14` refererer `docker/vendor`. `ftd-worker/` (Python `main.py` + `requirements.txt`) og `scripts/` finnes også uten omtale i strukturoversiktene.
- **Alvorlighet:** Middels
- **Forslag:** Legg `docker/`, `ftd-worker/` og `scripts/` inn i prosjektstruktur-oversikten i README/CLAUDE.md, og lenk `docker/DOCKER-NOTES.md` fra CLAUDE.md-indeksen.

### A6 — `embed`-container binder 127.0.0.1, men compose adresserer den cross-container (MIDDELS)
- **Kode:** `apps/api/src/services/norbert-server.py:168` — `HTTPServer(("127.0.0.1", PORT), …)`. Serveren lytter kun på loopback inne i sin egen container.
- **Doc/konfig:** `docker/docker-compose.yml:13,21` — api setter `NORBERT_URL: "http://embed:3302"` og embed er på `appnet`. Cross-container-kall til `embed:3302` vil ikke nå en server som kun binder `127.0.0.1` i en annen container → AI-søk/embedding feiler i Docker-oppsettet.
- **Sammenligning:** `oversettelse-server.py:182` binder `("0.0.0.0", PORT)` — riktig for cross-container. `embed` er inkonsistent.
- **Alvorlighet:** Middels (funksjonell feil hvis ikke allerede patchet på server)
- **Forslag:** Verifiser om embedding faktisk virker i prod-Docker. Hvis ikke: bind `norbert-server.py` til `0.0.0.0` (det er trygt fordi containeren kun er på internt `appnet`). DOCKER-NOTES.md bør notere dette.

### A7 — Embedding-modell beskrevet inkonsistent (MIDDELS)
- **Doc:** `CLAUDE.md` § Tech Stack: «Flerspråklig embedding: intfloat/multilingual-e5-base (768 dim, …, port 3302)». `docker/DOCKER-NOTES.md:11` og `docker/Dockerfile.ml:1`: «NorBERT + multilingual-e5».
- **Faktisk:** `norbert-server.py:28-46` laster **begge** modeller: NorBERT (`ltgoslo/norbert2`) ved oppstart + multilingual-e5-base (lazy). `embedding-service.ts:40-59` har egne kodebaner for begge.
- **Alvorlighet:** Middels (CLAUDE.md utelater NorBERT, som er hovedmodellen lastet ved oppstart)
- **Forslag:** CLAUDE.md bør nevne at embedding-tjenesten kjører NorBERT (norsk) + multilingual-e5-base (flerspråklig, lazy), slik `infrastruktur.md:30,43` faktisk gjør.

### A8 — README: Expo SDK-versjon utdatert (LAV→MIDDELS)
- **Doc:** `README.md:21` — «Expo (SDK 52+)».
- **Faktisk:** `apps/mobile/package.json` — `"expo": "~54.0.33"`. CLAUDE.md sier korrekt «Expo (SDK 54)».
- **Alvorlighet:** Lav
- **Forslag:** Oppdater README til SDK 54.

### A9 — README: Node-/PostgreSQL-versjon for lav (LAV)
- **Doc:** `README.md:32-34` — «Node.js 18+», «PostgreSQL 15+».
- **Faktisk:** Root `package.json:18` — `"node": ">=20.0.0"`. Postgres er pinnet til major 16 (`docker/DOCKER-NOTES.md:13` `pgvector/pgvector:pg16`; `ny-server-migrering-plan.md:47,140` bekrefter PG 16).
- **Alvorlighet:** Lav
- **Forslag:** README → Node 20+, PostgreSQL 16.

### A10 — README mangler timer/maskin/pdf/varelager-pakker (LAV)
- **Doc:** `README.md:74-89` prosjektstruktur lister kun `packages/shared`, `db`, `ui`.
- **Faktisk:** `packages/` har i tillegg `db-maskin`, `db-timer`, `db-varelager`, `pdf`. CLAUDE.md § Prosjektstruktur er mer korrekt (men mangler `db-varelager` og `pdf` i sin liste — CLAUDE.md nevner `db-timer`, `db-maskin`, `pdf` men ikke `db-varelager`).
- **Alvorlighet:** Lav
- **Forslag:** Synk pakkeoversiktene i README og CLAUDE.md mot faktisk `packages/`-innhold (7 pakker: db, db-maskin, db-timer, db-varelager, pdf, shared, ui).

### A11 — README: feil web/API-portbeskrivelse vs CLAUDE.md (LAV)
- **Doc:** `README.md:60-62` — Web 3100, API 3001 (korrekt for prod). `apps/web/package.json:6` bekrefter `next dev --port 3100`; `.env.example:5` `PORT=3001`.
- **Merknad:** Dette samsvarer. Tatt med kun for å bekrefte at portene 3100/3001 er konsistente på tvers av README, .env.example og kode. **Ingen avvik** — listet for sporbarhet.
- **Alvorlighet:** Lav (ikke et reelt avvik)

### A12 — deploy-test.sh bruker `migrate dev` i stedet for `migrate deploy` (MIDDELS)
- **Kode:** `deploy-test.sh:13` kjører `pnpm db:migrate`, som er `prisma migrate dev` (jf. `packages/db/package.json:4` `"migrate": "prisma migrate dev"`).
- **Doc:** `CLAUDE.md` § «Etter Prisma schema-endring» og deploy-sekvens foreskriver `prisma migrate deploy` + eksplisitt `generate` på server. `deploy.sh:13` (prod) gjør det riktig per pakke (`migrate:deploy` + `generate` × 4). Test-skriptet gjør det ikke.
- **Alvorlighet:** Middels (`migrate dev` på server er feil verktøy — kan forsøke shadow-DB/skjemaendringer; treffer dessuten kun `@sitedoc/db`, ikke de tre andre db-pakkene)
- **Forslag:** Uansett uaktuelt på ny Docker-server, men hvis test-deploy-skript beholdes: bruk `migrate:deploy` + `generate` for alle fire db-pakker, slik prod-skriptet gjør.

### A13 — `MALBYGGER.md` ikke verifisert mot kode i denne gjennomgangen (LAV)
- **Merknad:** `MALBYGGER.md` (felles malbygger: dokumenttyper, felttyper, migreringsstrategi) ble lest for migreringsrelevans, men en full felt-for-felt-verifisering mot malbygger-koden i `apps/web` lå utenfor scope for denne kode/doc-runden. Ingen migreringsrelaterte avvik funnet der.
- **Alvorlighet:** Lav (åpent punkt, ikke et bekreftet avvik)

---

## Migreringsstatus-avvik (eget avsnitt)

Migreringen til ny Docker-server er **bekreftet fullført 2026-06-10**. Dokumentene spriker på status:

**Oppdatert til «fullført» (korrekt):**
- `parallell-arbeid-lock.md:15` — «**MIGRERING FULLFØRT 2026-06-10 ✅** — alle tre apper i Docker på ny server.» Beskriver gjenstående opprydding (avvikle gamle, off-disk-backup, ODA for DWG, slett junk-DNS).
- `ny-server-migrering-plan.md:169` (Sendfil), `:184` (Salsaklubb), `:200` (SiteDoc) — alle markert «FULLFØRT» med dato og lærdommer.
- `ny-server-fjerntilgang-plan.md:173` — «STATUS — FULLFØRT 2026-06-08 ✅» (fjerntilgang-forutsetningen).
- `ny-server-migrering-kickoff.md` — formulert som oppstartsbrief («Hva er ferdig (forutsetningen)»). Beskriver fortsatt arbeidet som forestående, men er en kickoff og kan stå som historisk.

**IKKE oppdatert (avvik — beskriver fremtidig tilstand som nå er faktisk):**
- `docs/claude/infrastruktur.md:1-9` — toppblokk sier eksplisitt «sitedoc + salsaklubb er foreløpig IKKE migrert» og «Ny server under oppsett — IKKE prod ennå». **Dette er nå feil.** Hele dokumentet (PM2-tabell, serverdiagram, deploy-kommandoer, env-stier) beskriver gammel WSL/PM2-prod. → A1 (Høy).
- `deploy.sh` / `deploy-test.sh` — retter seg fortsatt mot gammel `ssh sitedoc` + PM2. → A2/A3 (Høy).
- `CLAUDE.md` deploy-seksjon — PM2/`.next`-rense-flyt på gammel server. → A4 (Høy).

**Konklusjon migreringsstatus:** Migreringsplan- og lock-filene er ryddig oppdatert. De operasjonelle dokumentene som styrer daglig deploy (`infrastruktur.md`, `deploy.sh`, `deploy-test.sh`, CLAUDE.md-deploy) er **etterslepende** og beskriver den avviklede serveren som om den er live prod. Dette er den mest alvorlige klyngen av avvik.

## Er `docker/`-mappen dokumentert?

**Nei — ikke i de styrende hovedfilene.**
- `CLAUDE.md`, `README.md`, `MALBYGGER.md`: 0 treff på «docker».
- `docs/claude/infrastruktur.md`: 2 treff, men kun i kontekst «Sendfil er migrert dit (Docker, 2026-06-08)» — ingen omtale av sitedoc sin egen `docker/`-mappe eller compose-oppsettet.
- Eneste interne dokumentasjon av `docker/`-mappen er `docker/DOCKER-NOTES.md` (markert «UTKAST 2026-06-09»), som ikke er lenket fra noen indeks. Dockerfilene er også markert «UTKAST 2026-06-09» i toppkommentaren, til tross for at de er kjørt i prod 2026-06-10 (jf. `ny-server-migrering-plan.md:202`).

→ Se A5. Anbefaling: lenk `DOCKER-NOTES.md` fra CLAUDE.md-indeksen, oppdater «UTKAST»-merkingen til faktisk status, og ta `docker/` med i prosjektstruktur-oversiktene.

## Ting som samsvarer godt (kort)

- **Tech stack i hovedtrekk:** Turborepo/pnpm, Next.js 14 (`apps/web/package.json` `^14.2.0`), Fastify/tRPC, Prisma v6 (`@prisma/client ^6.3.0`), Auth.js v5 — alt stemmer med CLAUDE.md/README.
- **Workspace-pakkenavn:** alle `@sitedoc/*`-pakker (db, db-maskin, db-timer, db-varelager, pdf, shared, ui) finnes som dokumentert; `pnpm-workspace.yaml` matcher `apps/*` + `packages/*`.
- **Porter:** 3100 (web), 3001 (api), 3302 (embed), 3303 (oversettelse) er konsistente på tvers av `.env.example`, kode (`ai-sok-service.ts`, `oversettelse-service.ts`), `infrastruktur.md` og `docker/docker-compose.yml`.
- **Env-variabler:** `.env.example` matcher CLAUDE.md/README (DATABASE_URL, AUTH_SECRET, Google/Microsoft OAuth, RESEND, VEGVESEN_API_KEY, SITEDOC_INTEGRATION_KEY).
- **4 Prisma-klienter:** `Dockerfile.api`/`Dockerfile.web` genererer db, db-maskin, db-timer, db-varelager — samme fire som `deploy.sh` migrerer. Konsistent.
- **API kjøres via `tsx`:** Dockerfile.api (`tsx src/server.ts`) og `infrastruktur.md:198-200` (test-API via tsx pga. `noEmit`) er samstemte med begrunnelsen.
- **Migreringslærdommer:** Docker-lærdommene i `ny-server-migrering-plan.md:204-210` (Prisma openssl-target, cloudflared Host-header → AUTH_URL, web↔api `network_mode`) matcher faktisk compose-konfig (`network_mode: "service:sitedoc-api"`).

---

## Runde 2 — dyp dekning (2026-06-10)

Tre agenter leste systematisk: apps/packages, hele `docker/`-mappen + deploy/infra, og `ftd-worker/`/Python-servere/scripts. **Viktigste nye funn: en ny cross-container-feil (oversettelse) på linje med norbert-funnet, og at hele docker-stacken fortsatt er «UTKAST»-merket.**

### A. Docker / cross-container (funksjonelle feil)

| # | Tittel | Kode | Alv. |
|---|--------|------|------|
| R2-DOK-1 | `OVERSETTELSE_URL` utkommentert i compose | `docker/docker-compose.yml:15` (`# OVERSETTELSE_URL …`); koden bruker allerede env-navnet (`oversettelse-service.ts:11`), så API faller tilbake til `localhost:3303` som ikke finnes i nett-namespacet → oversettelse feiler | **Høy** (samme klasse som norbert) |
| R2-DOK-2 | norbert binder `127.0.0.1` (bekreftet, ikke patchet i repo) | `norbert-server.py:168` binder loopback; `docker-compose.yml:14` adresserer `http://embed:3302`. `oversettelse-server.py:182` binder korrekt `0.0.0.0` | Middels (= runde-1 A6) |
| R2-DOK-3 | Hele stacken merket «UTKAST 2026-06-09» | Topp-kommentar i `docker-compose.yml:1`, `Dockerfile.{api,web,ml}:2`, `DOCKER-NOTES.md:1` + cutover beskrevet som ugjort — men cutover er fullført 2026-06-10 | Middels |
| R2-DOK-4 | ML-deps upinnet + `numpy` udokumentert | `Dockerfile.ml:9-10` `torch transformers sentencepiece numpy` uten versjoner; ingen requirements.txt for ML-serverne | Middels (reproduserbarhet) |
| R2-DOK-5 | `.dockerignore` fanger ikke `docker/env/*.env` | `.dockerignore:8-9` matcher `.env.*`, men filnavn er `api.env`/`web.env` → COPY-es inn i image-lag ved `COPY . .` | Lav (secrets i image-lag) |

`DOCKER-NOTES.md` er fortsatt kun lenket fra denne rapporten, ikke fra noen styrende hovedfil (bekrefter runde-1 om udokumentert `docker/`). DOCKER-NOTES:15 («bundet til 127.0.0.1») er upresis — kun api/web publiseres på host; embed/oversettelse er intern-only på `appnet`.

### B. Apps / packages

- R2-APP-1 (L→M): `CLAUDE.md:91` sier Prisma «v6.19», men alle fire db-pakker pinner `^6.3.0`. Verifiser mot lockfil eller rett CLAUDE.md.
- R2-APP-2 (M): `README.md:3,7,9,118,122-132` bruker forbudt term «entreprise» gjennomgående. Koden bruker `faggruppe` (alias beholdt).
- R2-APP-3 (M): `README.md:127` statusflyt `received/responded/closed` matcher ikke dagens `dokumentflytRouter`/`isValidStatusTransition()`.
- R2-APP-4 (L): `CLAUDE.md:117-124` strukturblokk mangler `db-varelager` (kun i indeks/steg-4b-plan).
- R2-APP-5 (L): `CLAUDE.md:123` sier db-maskin «Fase 1», schema sier «Fase 3» (`db-maskin/schema.prisma:1`).
- R2-APP-6 (L→M): `apps/timer/` dokumentert som planlagt egen app, finnes ikke — timer implementert integrert (api-routere + db-timer + mobil).
- R2-APP-7 (L): README web-ikonsidebar utdatert (mangler HMS, kontrollplan, økonomi, maskin, timer …).
- Verifisert OK: 7 pakkenavn, «14 UI-komponenter» (eksakt), Prisma-isolasjon, pgvector(768), Node>=20/pnpm@9.15.4, Expo SDK 54, web/mobil-struktur, tRPC-aliaser korrekt merket. Merknad: `pdf-parse` pinnet ulikt i api (1.1.1) vs web (^2.4.5).

### C. ftd-worker / Python / scripts

- R2-PY-1 (M): `ftd-worker/` er foreldreløs — A-nota/NS3420/XML-parsing er implementert i TS (`ftd-prosessering.ts:1580-1819`, «Portert fra Python»). `apps/api/src/services/ftd-parser.ts` finnes ikke; 0 treff på `FTD_PARSER_URL`/`8001`. Doc Steg 8 (`IMPLEMENTASJON-FTD-FRONTEND.md:819-862`) beskriver forkastet arkitektur.
- R2-PY-2 (L→M): `main.py` er v0.1.0-skjelett (placeholder-grener, Word «kommer»).
- R2-PY-3 (M): ML-deps (`Dockerfile.ml`) upinnet, `numpy` udokumentert i `infrastruktur.md:32` venv-beskrivelse.
- R2-PY-4 (L→M): `scripts/psi-mal.sql:2,11` bruker forbudt `show_enterprise` + ASCII-erstatninger gjennomgående (`:19-57`).
- R2-PY-5 (L): `scripts/smartdok` README-status (ikke startet) spriker mot CLAUDE.md-indeks («AKTIV»).
- **Migreringsstatus:** Ingen NYE avvik i Python/scripts-filene. Restavvik: `ny-server-migrering-plan.md:5` toppstatus «UTKAST til godkjenning» (selv om app-seksjoner er «FULLFØRT»); `parallell-arbeid-lock.md:6,34` datostempel ikke oppdatert til 06-10 (kosmetisk). De reelle status-avvikene som peker på gammel server er fortsatt `infrastruktur.md` + `deploy.sh`/`deploy-test.sh` (runde-1 A1-A4).
- Verifisert OK: `oversettelse-server.py` (OPUS-MT, port 3303, LRU-cache, pivot nb→en→target, binder 0.0.0.0), `norbert-server.py` (NorBERT2 768-dim + E5 lazy, mean-pooling+L2), `norbert-embed.py` stdin/stdout-batch, porter 3302/3303 konsistente, python:3.12, ftd-worker requirements matcher imports.
