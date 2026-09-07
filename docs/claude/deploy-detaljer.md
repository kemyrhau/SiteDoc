## 🔴 HENDELSE 2026-08-15: prod nede i 6 timer etter Docker-daemon-restart

**Hva skjedde:** Docker-daemonen restartet 2026-08-14 kl 23:05 UTC (`systemctl show docker --property=ActiveEnterTimestamp`). Serveren selv gikk uavbrutt — uptime 38 dager, ingen OOM i `dmesg`. Sannsynlig årsak: automatisk pakkeoppgradering av Docker.

**Åtte av ti containere kom ikke opp igjen**, på tvers av tre compose-prosjekter:
`sitedoc-api` · `sitedoc-web` · `sitedoc-pdf-render` (`Exited 137`) · `sitedoc-embed` · `sitedoc-oversettelse` · `salsaklubb` · `salsaklubb-postgres` · `postgres`

**Prod var utilgjengelig i ~6 timer** før det ble oppdaget — og da tilfeldig, under feilsøking av noe annet.

**Alle tjenester har `restart: unless-stopped`.** Den policyen restarter ikke pålitelig etter en daemon-restart; `restart: always` gjør det.

**Berging og diagnose (kommandoene):** [DEPLOY-RUNBOK.md § 6 Rollback](DEPLOY-RUNBOK.md) — postgres
først, så api/web/pdf-render, så embed/oversettelse, og diagnose-grepet som avslører en daemon-restart.

### 🔴 To tiltak som ikke er gjort

1. **`restart: unless-stopped` → `restart: always`** på alle tjenester i begge compose-filer og i salsaklubb-stacken. Ni forekomster.
2. **Ingen overvåking.** Ingenting varslet at prod var nede. En enkel cron mot `/version` som varsler ved feil ville fanget det på minutter i stedet for timer.

---
name: deploy-detaljer
description: Deploy-BAKGRUNN (branching, mobil reload-typer, tRPC-env-konsekvens, prisma-migrate-lærdom, prod-lærdommer). Kommandoene bor i DEPLOY-RUNBOK.md.
sist_verifisert_mot_kode: 2026-09-07
---

# Deploy-detaljer

> 🔴 **Deploy-KOMMANDOENE bor i [DEPLOY-RUNBOK.md](DEPLOY-RUNBOK.md)** (test · prod · OTA · env-filer ·
> rollback). Denne fila bærer *bakgrunnen* — branching, mobil-reload, tRPC-env-konsekvens,
> prisma-migrate-lærdom, prod-lærdommer — og har ingen deploy-kommandoblokker igjen (dedup 2026-09-07).
> ⚠️ Enkelte PM2/WSL-referanser lenger nede (`pm2`-cwd-fellen, `ssh sitedoc`-advarselen) beskriver den
> GAMLE serveren (utgått 2026-06-10) og står som host-uavhengige lærdommer / advarsler, ikke som noe å kjøre.

CLAUDE.md har kort oversikt over miljøer. Denne fila har detaljene: branching-regler,
modul-DB-pakke-lærdommer, mobil reload-typer, tRPC-mutations env-konsekvens og prod-lærdommer.

## 🔴 FELLE 2026-08-21: deploy sendte GAMMEL kode uten å feile

**Symptom:** `deploy-test.sh` kjørte grønt, docker bygde på 3,8 s med alt CACHED, og
popover-fiksen var ikke i imaget. Førte til en runde falsk `--no-cache`-feilsøking.

**Rotårsak — ikke cachen:** merge skjer i `SiteDoc-merge` og pushes rett til `develop`,
mens `deploy-test.sh` **rsyncer fra hovedtreet `SiteDoc`**. De to trærne synkes aldri
automatisk. Hovedtreet lå to merger bak, så rsync sendte forrige runde. Docker fikk
identisk kontekst (269 kB begge ganger), cachet riktig, og bygde et gammelt image —
**uten at noe feilet noe sted**.

Etter `git pull` ble konteksten 1,35 GB og bygget ekte.

**Asymmetrien som gjorde det mulig:** `deploy-prod.sh` HADDE allerede en ajour-guard
(«main skal være à jour med origin»). `deploy-test.sh` manglet den. Noen løste problemet
ett sted og ikke det andre — samme mønster som `ruteErFirmaKontekst` i tre kopier der én
var rettet.

**Fikset:** ajour-guard lagt inn i `deploy-test.sh` — stopper deployen hvis treet er bak
`origin/develop`, med instruksen `git pull --ff-only origin develop`.

**Regel for enhver deploy:** merger du i `SiteDoc-merge` og deployer i samme økt, må
hovedtreet pulles først. Vakten fanger det nå, men forstå hvorfor: **deploy leser fra
disk, ikke fra origin.**

**Verifiser alltid at koden faktisk er i imaget** — grep-kommandoen (kilden, aldri et kompilat)
bor i [DEPLOY-RUNBOK.md § 2 steg 5b](DEPLOY-RUNBOK.md). Svarer den `0`, kjører imaget gammel kode
uansett hva deploy-loggen sa.

### 🔴 `dist/` er DØDT i api-imaget — grep aldri der (målt 2026-08-21)

`Dockerfile.api:54` er `CMD ["pnpm", "exec", "tsx", "src/server.ts"]`. **Runtime kjører
TypeScript-kilden direkte.** `pnpm turbo build` (`:19`) produserer et `dist/` som aldri
startes — det fungerer som typesjekk-port i bygget, ikke som leveranse.

Konsekvens: `ls /app/apps/api/dist/...` sier **ingenting** om hva som kjører. En sjekk
mot `dist` kan vise ferske filer mens den kjørende koden er gammel, og motsatt. Cowork
gjorde nettopp den feilen 2026-08-21 og trodde et bygg var verifisert.

**`packages/pdf` har i tillegg ingen byggetrinn i det hele tatt** — `main`/`types`/
`exports` peker alle på `./src/index.ts`. Det finnes ingen `packages/pdf/dist`, og å lete
etter en kompilert `.js` derfra er å lete etter noe som aldri har eksistert.

Riktig sjekk for en `packages/pdf`-leveranse er **kilden, aldri kompilatet**, i **api**-containeren
— hele arkivmalen bor i `packages/pdf`, og det er api som rendrer. Kommandoen: [DEPLOY-RUNBOK.md
§ 2 steg 5b](DEPLOY-RUNBOK.md).

## Worktree-deploy (parallell-arbeid)

Flere git-worktrees deler samme repo (se [parallell-arbeid-lock.md](parallell-arbeid-lock.md)). **Prod-deploy kjøres ALLTID fra `../SiteDoc-deploy` (branch `main`)** — aldri fra det delte redesign-treet (`…/SiteDoc`, `redesign/navigasjon`) eller develop-treet. rsync-kilden må være riktig branch, ellers bygges feil kode (prod/test/redesign deler build-kontekst på server-ny).

**Verifiser server-ny FØR `sudo`:**
- Riktig server = **server-ny**. Bekreft compose-fila finnes: `ls ~/stack/sitedoc/docker/docker-compose.yml` (Kenneth, TTY).
- **`ssh sitedoc` → Kenspill = GAMMEL/legacy server — feil server for deploy/verifisering.** Ikke kjør deploy-steg der.
- Re-rsync riktig branch → `~/stack/sitedoc` FØR build; markør-grep på server bekrefter at koden landet. rsync ekskluderer `docker/env`. Aldri `--remove-orphans`.

## Branching

- **`develop`** — aktiv utvikling. All ny kode commites hit.
- **`main`** — produksjon. Kun oppdatert via merge fra `develop` etter testing.

### Branching-regler (obligatorisk)

Alle større operasjoner startes på en feature-branch — aldri direkte på develop.

**Workflow:**
1. `git checkout develop && git pull origin develop`
2. `git checkout -b feature/beskrivende-navn`
3. Bygg og test på feature-branch
4. Deploy feature-branch til test.sitedoc.no og verifiser
5. Merge til develop via `git merge --no-ff`
6. Deploy develop til produksjon

**Gjelder alltid for:**
- DB-migrasjoner
- Rename/refaktorering (>10 filer)
- Nye moduler
- Tilgangskontroll-endringer

## Timer-prototype — midlertidig plassering ❌ FORKASTET (2026-04-27)

Planen om egen `apps/timer/`-app (og at timer-sidene var en hardkodet demo som skulle slettes) er **forkastet**. Timer er bygget integrert som firmamodul — api-ruter, `packages/db-timer` og web-sider under `dashbord/`. Vedtak, begrunnelse og faktisk plassering: [timer.md](timer.md).

## Miljøer

| | Test | Produksjon |
|---|---|---|
| **Web** | test.sitedoc.no | sitedoc.no |
| **API (tRPC)** | api-test.sitedoc.no (port 3301) | api.sitedoc.no (port 3001) |
| **Branch** | `develop` | `main` |
| **Repo på server** | `~/programmering/sitedoc-test` | `~/programmering/sitedoc` |
| **Database** | `sitedoc_test` | `sitedoc` |
| **Mobil `.env`** | `api-test.sitedoc.no` | `api.sitedoc.no` |
| **Uploads** | Delt (symlinket) | Delt |

**KRITISK:** Databasene er SEPARATE. `psql -d sitedoc_test` for test, `psql -d sitedoc` for prod. ALDRI kjør testdata mot prod-databasen.

**Viktig:** Mobil `.env` peker mot **test** under utvikling. `.env.production` brukes for EAS Build / TestFlight.

**Primærmiljø:** Test er primærmiljø for utvikling, verifisering og audit. Lokal-DB er typisk bak test og kan inneholde gamle skjema, manglende migreringer eller utdaterte data.

- **Som referanse for "hva er state nå":** bruk alltid test. Spørringer mot lokal kan gi feil svar uten varsel.
- **Som arbeidsmiljø for vanlig utvikling:** ikke standardvalg. Vanlige kodeendringer (UI, business-logikk uten DB-endringer, små refaktorer) kan gå rett til test via feature-branch.
- **Som sandkasse for risiko-implementasjoner:** bruk lokal når en endring kan gå galt og trenger mellomtest før test/prod — DDL-migreringer, masse-UPDATE/DELETE, refaktor som rører mange tabeller, eksperimentell kode. Re-seede lokal fra test først (komplett dump) for å ha realistisk utgangspunkt. Verifiser mot lokal → så test → så prod.

## Arbeidsflyt

1. **Utvikle** — jobb på `develop`, commit og push
2. **Deploy til test** — se § «Test-deploy (server-ny, Docker) — KANONISK sekvens» under
3. **Test** — verifiser på test.sitedoc.no
4. **Deploy til prod** (kun på eksplisitt forespørsel) — merge develop → main + server-deploy: [DEPLOY-RUNBOK.md § 2](DEPLOY-RUNBOK.md)

## Deploy (server-ny, Docker) — *hvorfor*, ikke *hvordan*

🔴 **Kommandoene bor i [DEPLOY-RUNBOK.md § 1 (test)](DEPLOY-RUNBOK.md) og [§ 2 (prod)](DEPLOY-RUNBOK.md).**
`deploy-test.sh <hash>` / `deploy-prod.sh` rsyncer og skriver ut de ferdig utfylte `ssh -t`-kommandoene
Kenneth limer — cowork kjører aldri `sudo docker` selv. Denne fila bærer bakgrunnen scriptene er
skrudd sammen fra; endres et script, er scriptet fasiten (jf. runbokens innledning).

Test-deploy er MANUELL (ingen auto-deploy). Bygg SEKVENSIELT — to tunge images i samme `up --build`
→ OOM (137) tar ned delt postgres + PROD. Full mekanikk: [docker/DOCKER-NOTES.md](../../docker/DOCKER-NOTES.md).

### 🔴 Migrate droppes ALDRI — spør databasen, ikke diffen

Kjør `migrate deploy` for **alle fire** db-pakker ved hver deploy (scriptene gjør det). Kommandoen er
idempotent og svarer «No pending migrations» når det ikke er noe å gjøre — det koster sekunder og
fjerner en skjønnsvurdering.

**Bakgrunn (2026-08-28):** prod-releasen `a8750601` (25.08) var merket «ingen migreringer». Det var
sant for `packages/db` og **usant for `db-timer`** — `20260811130000_utlegg_ordning_justering` fra
11. august var aldri kjørt. Prod hadde dermed i to uker CHECK-constraints som avviste `'lonnstillegg'`
og manglet kolonnene `satsbasert`/`mulig_skattepliktig`, mens koden forventet begge. Ingen meldte fra
fordi timer-modulen ikke er i bruk i prod (0 attesterte sedler målt 27.08) — feilen var der, ingen
gikk på den. Den betingede formuleringen («ingen migrering i diffen → dropp migrate-linja») lot
konklusjonen bli trukket fra feil sted: **fire pakker har hver sin migreringsmappe; å se i én av dem
er ikke å ha sjekket.** Rekkefølgen er **build → migrate → up** (ny kode mot gammelt skjema gir 500 i
vinduet mellom).

### Bygg-stempel — hvorfor SHA sendes inn fra Mac

Imaget bærer commit-sha + byggtid (`/version` + Innstillinger-linje). **`.git` følger IKKE med rsync**
(scriptene ekskluderer `.git`) → server har ingen git → **SHA beregnes på Mac-kilden og sendes inn via
`ssh -t`** (scriptet gjør det). Utelates env-paret → `${GIT_SHA:-}`/`${BUILD_TID:-}`-fallback gir
«dev»/«ukjent» (ingen krasj, men stemplet blir «dev»; da vet vi ikke hvilken kode som kjører).
Build-args interpoleres fra SAMME env-par `GIT_SHA`/`BUILD_TID` for både api og web — de kan aldri
stemples ulikt. **Verifiser stemplet:** `curl https://api-test.sitedoc.no/version` (og prod) → `{gitSha, byggTid, node}`.

### ⚠️ `deploy.sh` er en FELLE — IKKE bruk (bør slettes/omskrives)

`deploy.sh` rsyncer fra `~/Documents/Programmering/SiteDoc/` (som står på **develop**) og kjører
`up -d --build` (bygger api+web parallelt → **OOM tar ned prod**). Den ville deployet develop-kode inn
i prod med OOM-risiko. Bruk `deploy-prod.sh` via [runbok § 2](DEPLOY-RUNBOK.md).

### Hvorfor (lærdommer, kort — full detalj i DOCKER-NOTES)
- **Sekvensielt bygg:** to tunge images i samme `up --build` → OOM (137) → daemon-blip → tar ned delt postgres + prod. `restart:unless-stopped` redder ikke exited containere.
- **rsync FØR build:** build-kontekst = server-fila; uten fersk rsync gjenbrukes cache (~6s «build», nye ruter 404).
- **Migrate `-c` ikke `-lc`; aldri pipe migrate gjennom tail/grep** (svelger feil-exit → deploy fortsetter uten schema).
- **Delt build-kontekst:** re-rsync riktig branch før HVER build (main=prod, develop=test).

**Prod bruker `prisma migrate deploy`** — IKKE `pnpm db:migrate` (som kjører interaktiv `prisma migrate dev`). `prisma generate` må kjøres etter migrate for at API-bygget skal se nye Prisma-modeller. **Kjør for alle fire db-pakker** (`@sitedoc/db` + `@sitedoc/db-maskin` + `@sitedoc/db-timer` + `@sitedoc/db-varelager`) — uten `db-maskin`-generate feiler `@sitedoc/api`-bygget med `Cannot find module '.prisma/maskin-client'` (tilsvarende for `db-timer`/`.prisma/timer-client`). Lærdom fra prod-deploy 2026-04-30 (db-maskin) + test-deploy 2026-05-01 (db-timer).

**Lokal `prisma migrate dev` feiler på shadow-DB** (`P3006: extension "vector" is not available` — pgvector er ikke installert i lokal PostgreSQL, så shadow-DB-en kan ikke replaye `20260331120000_embedding_vector_pgvector`). **Workaround:** håndskriv migrasjonen i idempotent stil (`CREATE TABLE IF NOT EXISTS` + `DO $$ … EXCEPTION WHEN duplicate_object`-blokker for FK-er, se f.eks. `20260608120000_oppmotested_fase1`) + `prisma generate` separat for klienten. Den anvendes korrekt på test/prod via `migrate deploy` (de har pgvector). Aldri kjør `migrate dev`-reset lokalt. Lærdom Fase 1 2026-06-08.

> 🖥️ **Lokal dev (Mac) bor i [lokal-dev.md](lokal-dev.md)** — koble til, feilsøke (`AccessDenied` = tom lokal DB, ikke OAuth), oppdatere test-data, teste nye funksjoner.

**Modul-DB-pakker (`db-maskin`/`db-timer`/`db-varelager`) leser `DATABASE_URL` fra sin egen `.env` ved migrate/generate** — symlink eller env-export fungerer ikke. I Docker-deployen bakes `prisma generate` for alle fire pakkene inn i imaget; **env-filkartet for server bor i [DEPLOY-RUNBOK.md § 4](DEPLOY-RUNBOK.md).** Mangler en pakke sin env, feiler `migrate deploy` med `P1012 — Environment variable not found: DATABASE_URL` (lærdom db-maskin prod-deploy 2026-04-30 + db-timer test-deploy 2026-05-01).

**ALDRI pipe `prisma migrate deploy` gjennom `tail`/`head`/`grep`** — pipens exit-kode er den siste kommandoen i pipen (typisk `tail` som returnerer 0), så `migrate`-feil **svelges** og `&&`-kjeden fortsetter som om alt gikk bra. Resultat: deploy-kjede kjører bygg + pm2-restart selv om migrasjonen feilet, og prod-DB ender uten påkrevd schema. Kjør `prisma migrate deploy` direkte (uten pipe), eller fang exit-koden eksplisitt med `set -o pipefail` før kjeden. Lærdom fra db-timer prod-deploy 2026-05-01 (timer-schema manglet 5 minutter på prod fordi `migrate | tail -3` skjulte P1012-feilen).

**Cache-tak:** `.next/cache` slettes automatisk ved deploy hvis den overstiger 500 MB. Normal cache etter ren build er ~420 MB — taket rydder kun akkumulert gammel cache.

Se [infrastruktur.md](infrastruktur.md) for detaljer.

## Mobil reload-typer (viktig: opplys ALLTID brukeren)

Etter endringer, oppgi alltid hvilken reload-metode som trengs:

| Endring | Reload-metode | Instruks til bruker |
|---------|--------------|---------------------|
| **React-komponent / styling** | Hot reload | «Shake → Reload» eller dra ned |
| **Provider / kontekst / hooks** | Full restart | «`npx expo start --clear`» |
| **WebView-innhold (mobil-viewer)** | Deploy + restart | «Deployet til test — restart Expo med `--clear`» |
| **API-endringer** | Deploy | «Deployet til test — shake → Reload» |
| **Native modul / config** | Ny build | «Trenger ny EAS-build» |

**Regel:** Etter HVER commit som påvirker mobil, skriv eksplisitt: «**Reload:** [metode]»

## tRPC-mutations kjører i web-prosessen — env-konsekvens

`apps/web/src/app/api/trpc/[...trpc]/route.ts` håndterer ALLE tRPC-kall fra browser/mobil **direkte i Next.js-prosessen** (sitedoc-web / sitedoc-test-web) — IKKE proxy til Fastify (sitedoc-api). Den importerer `appRouter` direkte fra `@sitedoc/api/src/trpc/router` og kjører tRPC i web-prosessens kontekst.

**Konsekvens for env-konfig:** Env-vars som brukes i tRPC-handlers (eksterne API-nøkler, integrasjonshemmeligheter, eks. `VEGVESEN_API_KEY`, `OPENAI_API_KEY`, `SITEDOC_INTEGRATION_KEY`) må ligge i `sitedoc-web` sin `ecosystem.config.js`-env, IKKE bare i `sitedoc-api`. Hvis nøkkelen kun finnes i api-prosessens env, vil tRPC-handler-koden i web-prosessen lese `process.env.X = undefined`.

Fastify (`sitedoc-api`) brukes for:
- Filopplasting (`/upload`, multipart)
- Statisk filservering (`/uploads/`)
- WebSocket presence
- Bakgrunns-workers (oversettelse, vegvesen-kø, FTD-prosessering)
- FTD-prosesserings-routes

**Sjekkliste ved nye eksterne integrasjoner:** Identifiser hvilken prosess som faktisk kaller endpoint:
- Klient-trigget tRPC-mutation/query? → web-prosessen, sett env i `sitedoc-web`
- Bakgrunns-worker eller batch-job? → api-prosessen, sett env i `sitedoc-api`
- Begge? → sett i begge ecosystem env-blokker

**Lærdom 2026-05-01 (Vegvesen-deploy):** Blokk B feilet i 30 minutter på test fordi `VEGVESEN_API_KEY` kun var lagt i `sitedoc-test-api`. Klient-mutations gikk via Next.js → web-prosess (uten nøkkel) → kastet `VegvesenApiNokkelMangler`. Løsning: nøkkelen tilføyd i begge ecosystem env-blokker.

**Lærdom 2026-05-02 (dev-login refactor til Fastify):** `ENABLE_DEV_LOGIN=true` skal stå i **`sitedoc-test-api`-blokken**, IKKE `sitedoc-test-web`. Dev-login-ruten ble flyttet fra Next.js (apps/web) til Fastify (apps/api) 2026-05-02 (commit `29cf833b`) fordi Cloudflare WAF blokkerte Expo Go-fetch mot test.sitedoc.no spesifikt. Mobil treffer `${AUTH_CONFIG.apiUrl}/dev-login` direkte mot Fastify, så env-flagget må være der prosessen kjører. Sett ALDRI på prod-server (`sitedoc-api`).

**Lærdom 2026-05-07 (Integrasjonsadmin SITEDOC_INTEGRATION_KEY):** `packages/db/src/encryption.ts` leser `process.env.SITEDOC_INTEGRATION_KEY` ved kall-tid. tRPC-mutation `firmaIntegrasjon.lagre` (samt admin-CRUD) kaller `krypter()` som leser env. Klient-trigget mutation kjører i web-prosessen → må ha nøkkelen der. Kun api-prosess feiler ikke ved import av `@sitedoc/db` (encryption-funksjonen kalles ikke ved modul-load). Løsning: nøkkelen i begge `ecosystem.config.js`-blokker (`sitedoc-test-web` + `sitedoc-test-api`, samme på prod). Master-key må være 64 hex-tegn (32 byte) — generér med `openssl rand -hex 32`. Test-deploy 2026-05-07: feilet 1+ time fordi nøkkelen kun lå i api-blokken; ble løst ved å duplisere i web-blokken. Samme prosedyre kreves på prod-deploy.

**Lærdom 2026-05-02 (PM2 cwd-cache-fellen):** PM2 cacher `cwd` i `~/.pm2/dump.pm2` ved boot/save. Hvis prosessen ble en gang i tiden startet fra hjem-mappen (`~`) i stedet for prosjekt-mappen (`~/programmering/sitedoc-test`), tolkes relativ `cwd: './apps/web'` som `/home/kemyr/apps/web` (eksisterer ikke) → restart-loop med `Could not find production build`. **`pm2 restart` fikser IKKE dette** — cwd er cachet. Løsning: `pm2 delete <name>` + `cd ~/programmering/sitedoc-test && pm2 start ecosystem.config.js --only <name>` + `pm2 save` (overskriver dump med korrekt cwd). Symptom: HTTP 502 fra Cloudflare, `pm2 describe` viser `exec cwd: /home/kemyr/apps/web` i stedet for `/home/kemyr/programmering/sitedoc-test/apps/web`. Lærdom fra 502-fix 2026-05-02 da `sitedoc-test-web` (ID 25) hadde stale cwd etter en tidligere restart.

## Mobil-app og URL-konstruksjon

- **URL-hjelpefunksjon:** Bruk `hentWebUrl()` fra `config/auth.ts` for web-URL (filnedlasting, mobil-viewer)
  ```
  hentWebUrl()
  // api.sitedoc.no → sitedoc.no
  // api-test.sitedoc.no → test.sitedoc.no
  ```
- **URL-mønster:** Alle `/uploads/`-URLer MÅ gå via Next.js proxy:
  ```
  baseUrl = hentWebUrl()
  url = `/api${fileUrl}`
  fullUrl = `${baseUrl}${url}`
  // → https://test.sitedoc.no/api/uploads/uuid.ifc ✅
  ```
- **ALDRI** bruk `AUTH_CONFIG.apiUrl.replace("api.", "")` direkte — bruk `hentWebUrl()`
- **ALDRI** send `file://`-stier til WebView — WebView kan ikke lese lokale filer fra en http-side (CORS)
- Reverse proxy: `test.sitedoc.no` → web, `test.sitedoc.no/api/` → API, `api-test.sitedoc.no` → tRPC
