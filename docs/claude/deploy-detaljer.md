---
name: deploy-detaljer
description: Detaljerte deploy-kommandoer, branching-regler, miljøer, mobil reload-typer, env-konsekvenser og lærdommer fra produksjons-deploy.
sist_verifisert_mot_kode: 2026-05-02
---

# Deploy-detaljer

CLAUDE.md har kort oversikt over miljøer + deploy-kommandoen. Denne fila har
alle detaljene: branching-regler, full bash-kommando, `.env`-krav for
modul-DB-pakker, mobil reload-typer, tRPC-mutations env-konsekvens og
prod-lærdommer.

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

## Timer-prototype — midlertidig plassering

Filen `apps/web/src/app/dashbord/[prosjektId]/timer/` er en **demo-prototype** laget for kundepresentasjon. Den skal IKKE videreutvikles til produksjonskode.

Når timer-modulen bygges ordentlig (Fase 3):
- Flyttes til `apps/timer/` — egen Next.js-app
- DB flyttes til `packages/db-timer/` — eget Prisma-skjema
- Eksisterende prototype-filer slettes fra `apps/web`

Regler frem til da:
- Ikke legg til nye API-kall i prototype-siden
- Ikke koble prototype til eksisterende tRPC-ruter
- Ikke bruk prototype som mal for andre sider
- Alt i prototype er hardkodet demodata

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
2. **Deploy til test** — bruk deploy-kommandoen under (inkluderer cache-rydding >300 MB)
3. **Test** — verifiser på test.sitedoc.no
4. **Deploy til prod** (kun på eksplisitt forespørsel) — `git checkout main && git merge develop --no-edit && git push origin main` etterfulgt av server-deploy

## Deploy-kommandoer

```bash
# Test (automatisk etter push til develop)
ssh sitedoc "cd ~/programmering/sitedoc-test && git fetch origin && git reset --hard origin/develop && pnpm install --frozen-lockfile && pnpm --filter @sitedoc/db exec prisma migrate deploy && pnpm --filter @sitedoc/db exec prisma generate && pnpm --filter @sitedoc/db-maskin exec prisma migrate deploy && pnpm --filter @sitedoc/db-maskin exec prisma generate && pnpm --filter @sitedoc/db-timer exec prisma migrate deploy && pnpm --filter @sitedoc/db-timer exec prisma generate && du -sm apps/web/.next/cache 2>/dev/null | awk '\$1>500{print \"Rydder .next/cache (\"\$1\"MB)\"}' && find apps/web/.next/cache -maxdepth 0 -type d 2>/dev/null | xargs -I{} sh -c 'size=\$(du -sm {} | cut -f1); [ \$size -gt 500 ] && rm -rf {}' && pnpm build --filter @sitedoc/web && pm2 restart sitedoc-test-web sitedoc-test-api"

# Produksjon (KUN på eksplisitt forespørsel)
ssh sitedoc "cd ~/programmering/sitedoc && git pull && pnpm install --frozen-lockfile && pnpm --filter @sitedoc/db exec prisma migrate deploy && pnpm --filter @sitedoc/db exec prisma generate && pnpm --filter @sitedoc/db-maskin exec prisma migrate deploy && pnpm --filter @sitedoc/db-maskin exec prisma generate && pnpm --filter @sitedoc/db-timer exec prisma migrate deploy && pnpm --filter @sitedoc/db-timer exec prisma generate && du -sm apps/web/.next/cache 2>/dev/null | awk '\$1>500{print \"Rydder .next/cache (\"\$1\"MB)\"}' && find apps/web/.next/cache -maxdepth 0 -type d 2>/dev/null | xargs -I{} sh -c 'size=\$(du -sm {} | cut -f1); [ \$size -gt 500 ] && rm -rf {}' && pnpm build && pm2 restart all"
```

**Prod bruker `prisma migrate deploy`** — IKKE `pnpm db:migrate` (som kjører interaktiv `prisma migrate dev`). `prisma generate` må kjøres etter migrate for at API-bygget skal se nye Prisma-modeller. **Kjør for ALLE tre db-pakker** (`@sitedoc/db` + `@sitedoc/db-maskin` + `@sitedoc/db-timer`) — uten `db-maskin`-generate feiler `@sitedoc/api`-bygget med `Cannot find module '.prisma/maskin-client'` (tilsvarende for `db-timer`/`.prisma/timer-client`). Lærdom fra prod-deploy 2026-04-30 (db-maskin) + test-deploy 2026-05-01 (db-timer).

**Modul-DB-pakker krever `.env` på server** (gitignored, må opprettes manuelt ved første deploy av en ny db-pakke). Hver pakke leser `DATABASE_URL` fra sin egen `.env`-fil ved migrate/generate — symlink eller env-export fungerer ikke. Filinnhold er identisk for `db-maskin` og `db-timer`:

```
# packages/db-maskin/.env  +  packages/db-timer/.env
# Test-server (~/programmering/sitedoc-test/):
DATABASE_URL="postgresql://kemyr:kemyr@localhost:5432/sitedoc_test"

# Prod-server (~/programmering/sitedoc/):
DATABASE_URL="postgresql://kemyr:kemyr@localhost:5432/sitedoc"
```

Symptom hvis `.env` mangler: `prisma migrate deploy` feiler med `Error code: P1012 — Environment variable not found: DATABASE_URL`. Lærdom fra db-maskin prod-deploy 2026-04-30 + db-timer test-deploy 2026-05-01.

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
