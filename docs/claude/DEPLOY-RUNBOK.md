---
name: DEPLOY-RUNBOK
description: ENESTE kilde for deploy-kommandoer — test, prod, OTA. Alle andre filer peker hit og bærer kun bakgrunn.
status: 🔴 STYRENDE — kommandoer bor KUN her
sist_verifisert_mot_kode: 2026-09-07
---

# Deploy-runbok — den eneste kilden til kommandoer

> **Kenneth 2026-09-07:** *«Det føles ut som om jeg har en løs kanon på dekk — veldig mange feil
> mht. deploy til test og deploy til produksjon som mikses.»* → *«Fjern de gamle stiene, ingen
> duplikater som skaper nye problemer.»*

**Målt samme dag: 12 filer inneholder deploy-kommandoer, 5 av dem i mengde.**
`deploy-detaljer.md` (23 treff) · `eas-build-veileder.md` (17) · `infrastruktur.md` (7) ·
`DOCKER-NOTES.md` (5) · `CLAUDE.md` (4).

🔴 **Fra 2026-09-07 bor kommandoene KUN her.** De andre filene beholder *hvorfor* og *bakgrunn*
og peker hit for *hvordan*. **Finner du en kommando i en annen fil, er den foreldet — rett den,
ikke følg den.**

## 🔴 Regelen som utløste denne fila

**Cowork ga fem feil kommandoer eller påstander på to døgn:** `.env.local`-kopieringen som
forgiftet prod-OTA-en · `--ff-only` mot en divergert `main` · feil sti til env-fila (`api.test.env`
i stedet for `api-test.env`) · en sirkulær merge-gate · et api-testtall gjentatt tre ganger uten
måling.

**Mønsteret i alle fem: rekonstruksjon fra hukommelse i stedet for måling.** Der cowork målte
først samme dag — script-signatur, tabellnavn, variabelnavn, branch-kollisjon — traff den hver gang.

🔴 **Derfor: hver kommando cowork gir Kenneth skal utledes fra en måling i SAMME melding.**
Sti, flagg, signatur, hash. Ikke fra denne fila heller — **denne fila er utgangspunktet, ikke
fasiten.** Endres et script, er målingen sannheten og fila skal rettes.

---

# 1 · Deploy til TEST

**Miljø:** `test.sitedoc.no` · api `api-test.sitedoc.no` · DB `sitedoc_test` ·
env `docker/env/api-test.env` + `web-test.env` + `felles.env`

### Steg 1 — synk og les hashen

```sh
cd ~/Documents/Programmering/SiteDoc && git checkout develop && git pull --ff-only && git log --oneline -1
```

🔴 **Les hashen. Den skal inn i neste kommando.** Ikke gjett den.

### Steg 2 — deploy

```sh
cd ~/Documents/Programmering/SiteDoc && ./deploy-test.sh <hashen fra steg 1>
```

⚠️ **Scriptet KREVER hash-argument** (innhold-guard, Kenneth-vedtak 2026-09-04). Uten det avbryter
det. Det gjør rsync selv og **skriver ut** docker-kommandoen du kjører etterpå med `ssh -t`.
🔴 **Cowork kjører aldri `sudo docker` — det krever Kenneths TTY.**

### Steg 3 — verifiser at riktig kode er ute

```sh
curl -s https://api-test.sitedoc.no/version
```

**`gitSha` skal matche hashen fra steg 1.** Gjør den ikke det, stopp.

---

# 2 · Deploy til PRODUKSJON

🔴 **ALDRI uten Kenneths eksplisitte ordre.**
**Miljø:** `sitedoc.no` · api `api.sitedoc.no` · DB `sitedoc` · env `docker/env/api.env` +
`web.env` + `felles.env`

### Steg 1 — merge develop inn i main

```sh
cd ~/Documents/Programmering/SiteDoc && git checkout main && git pull --ff-only && git merge --no-ff develop -m "release: <hva som går ut>"
```

🔴 **`--no-ff`, ALDRI `--ff-only`.** `main` og `develop` divergerer permanent fordi hver release
lager en merge-commit som aldri går tilbake. **Målt 2026-09-07: 125 slike commits.**
`--ff-only` vil alltid feile her — det er ikke et symptom på noe galt.

### Steg 2 — verifiser at merge ble innholdslik

```sh
cd ~/Documents/Programmering/SiteDoc && git diff --stat origin/develop HEAD | tail -3
```

🔴 **Skal være TOM.** Er den ikke det, har `main` innhold `develop` ikke har — **stopp og meld.**

### Steg 3 — push

```sh
cd ~/Documents/Programmering/SiteDoc && git push origin main
```

### Steg 4 — deploy

```sh
cd ~/Documents/Programmering/SiteDoc && ./deploy-prod.sh
```

⚠️ **Scriptet tar INGEN argumenter.** Det krever at du står på `main`, at `HEAD == origin/main`,
og utleder SHA selv. Det spør om bekreftelse (skriv `prod`), gjør rsync med
`--exclude docker/env` innebygd, og skriver ut fire `ssh -t`-kommandoer: bygg api · bygg web ·
migrate · opp.

🔴 **Migrerings-gaten:** `migrate deploy` sjekker at `DATABASE_URL` peker på `/sitedoc`.
Har runden ingen nye migreringer, svarer den «No pending migrations» — **det er forventet, ikke
en feil.**

### Steg 5 — verifiser

```sh
curl -s https://api.sitedoc.no/version
```

🔴 **Og deretter som INNLOGGET bruker på `https://sitedoc.no/dashbord`** — prosjektlista skal
laste med data. **Anonym 200 er ikke verifisering** (vedtak 2026-05-02).

### Steg 5b — bekreft at koden FAKTISK er i imaget (ved tvil)

En grønn deploy-logg beviser ikke at imaget har koden din. Bygger rsync fra et tre som lå bak,
cacher Docker et gammelt image uten at noe feiler (målt 2026-08-21 — «build» på 3,8 s, alt cached,
fiksen ikke med). Grep etter en distinkt streng fra endringen i den KJØRENDE containeren:

```sh
ssh -t server-ny 'sudo docker exec sitedoc-web grep -c "<distinkt streng>" /app/apps/web/src/<fil>'
```

🔴 **Grep KILDEN, aldri et kompilat.** Api-runtime kjører `tsx src/server.ts` direkte — `dist/`
startes aldri, og `packages/pdf` har intet byggetrinn (`main`/`types`/`exports` peker alle på
`./src`). Arkiv-PDF-endringer verifiseres i **api**-containeren, som er den som rendrer:

```sh
ssh -t server-ny 'sudo docker exec sitedoc-api grep -c "<distinkt streng>" /app/packages/pdf/src/arkivmal/<fil>.ts'
```

Svarer den `0`, kjører imaget gammel kode uansett hva loggen sa. (Test: samme teknikk mot
`sitedoc-test-web` / `sitedoc-test-api`.)

### Steg 5c — pdf-render er egen container

Endrer du bare pdf-render-tjenesten, bygg og start den alene (den deler ikke image med api/web):

```sh
ssh -t server-ny 'cd ~/stack/sitedoc && sudo docker compose -f docker/docker-compose.yml up -d --build --no-deps pdf-render'
```

### 🔴 Steg 6 — GÅ TILBAKE TIL DEVELOP

```sh
cd ~/Documents/Programmering/SiteDoc && git checkout develop
```

**Uten dette blir du stående på `main`, og de neste docs-commitene havner feil sted uten at noe
advarer. Skjedde 2026-09-07 — to commits måtte cherry-pickes tilbake.**

---

# 3 · Mobil-JS ut til telefonen (OTA)

🔴 **Mobil-JS hører i SAMME runde som prod-deployen, ikke som en oppfølger.**
Etterslepet 06.–07.09 ble 17 timer, og testerne kjørte gammel kode uten at noen merket det.

**Bakgrunn, kvote og hendelseslogg:** [`eas-build-veileder.md`](eas-build-veileder.md).
**Kommandoene bor her.**

### Steg 1 — rydd miljøet

```sh
cd ~/Documents/Programmering/SiteDoc/apps/mobile && ls -a | grep env
```

🔴 **Ser du `.env.local`, MÅ den vekk før noe annet.** Den vinner over `.env.production` og
forgiftet prod-bundelen 2026-09-06.

```sh
cd ~/Documents/Programmering/SiteDoc/apps/mobile && rm -f .env.local && ls -a | grep env
```

**Forventet liste:** `.env.eas.local` (ASC-credentials, ufarlig — ingen `EXPO_PUBLIC_*`) ·
`.env.production` · `.env.test` · `nativewind-env.d.ts`.

### Steg 2 — MÅL bundelen før du publiserer

```sh
cd ~/Documents/Programmering/SiteDoc/apps/mobile && rm -rf /tmp/otacheck node_modules/.cache .expo
```

```sh
cd ~/Documents/Programmering/SiteDoc/apps/mobile && npx expo export --clear --platform ios --output-dir /tmp/otacheck
```

```sh
strings /tmp/otacheck/_expo/static/js/ios/*.hbc | grep -o "https://api[a-z.-]*sitedoc\.no" | sort | uniq -c
```

🔴 **For produksjon: kun `https://api.sitedoc.no`.** Ser du `api-test`, STOPP.
🔴 **`node_modules/.cache` og `.expo` MÅ slettes** — Metro gjenbruker ellers en cachet bundel og
målingen viser en utdatert sannhet (målt 06.09).

⚠️ **`--platform ios` er ikke valgfritt.** Uten det tar eksporten med web, som feiler i dette
monorepoet.

### Steg 3 — sjekk at treet er rent

```sh
cd ~/Documents/Programmering/SiteDoc && git status --short | head
```

Er den ikke tom, får publiseringen en `*` etter commit-hashen — **da vet vi ikke hva som gikk ut.**

### Steg 4 — publiser

```sh
cd ~/Documents/Programmering/SiteDoc/apps/mobile && eas update --platform ios --channel production --clear-cache --message "<hva som er fikset>"
```

**Test-kanalen setter API-URL-en INLINE:**

```sh
cd ~/Documents/Programmering/SiteDoc/apps/mobile && EXPO_PUBLIC_API_URL=https://api-test.sitedoc.no eas update --platform ios --channel test --clear-cache --message "<hva som er fikset>"
```

🔴 **Kanalen bestemmer hvilken APP som mottar — ikke hva bundelen peker på.** `eas update` kjører
`expo export`, som baker `EXPO_PUBLIC_*` inn. Inline framfor fil, fordi en fil blir liggende.

🔴 **`eas.json` gjelder KUN `eas build`, ikke `eas update`.** En verdi som bare står der, overlever
binæren men ikke OTA-en. **Det brakk Microsoft-innlogging i en uke** (plassholder fra 25.03 ble
aktiv da OTA ble leveringsvei 04.09, funnet 07.09).

### Steg 5 — les Commit-linja, verifiser på telefon

**Ingen asterisk etter hashen.** Ideelt matcher den prod-API-ets `gitSha`.
**Tving appen helt lukket to–tre ganger** — tredje gangen var den som traff 06.09.
**Prosjektlista er tellingen.**

### Steg 6 — før ny rad i OTA-loggen

[`eas-build-veileder.md § OTA-logg`](eas-build-veileder.md) — **i SAMME runde som publiseringen.**

---

# 4 · Env-filer på server

🔴 **ALDRI `>` mot en env-fil.** Tre hendelser på fem dager.
**Alltid: backup → `>>` → verifiser med telling.**

| Miljø | Api | Web | Delt |
|---|---|---|---|
| **Test** | `docker/env/api-test.env` | `web-test.env` | `felles.env` |
| **Prod** | `docker/env/api.env` | `web.env` | `felles.env` |

⚠️ **Bindestrek i test-navnet** (`api-test.env`), ikke punktum. Cowork bommet 07.09.

### Sjekk om en nøkkel finnes — les aldri verdien

```sh
ssh -t server-ny 'cd ~/stack/sitedoc/docker/env && for f in api-test.env web-test.env; do echo "--- $f"; for k in NØKKEL1 NØKKEL2; do printf "  %s: " $k; grep -q "^$k=" $f && echo FINNES || echo MANGLER; done; done'
```

### Legg til en nøkkel — med backup

```sh
ssh -t server-ny 'cd ~/stack/sitedoc/docker/env && cp api-test.env api-test.env.bak-$(date +%Y%m%d-%H%M) && echo "NØKKEL=verdi" >> api-test.env && grep -c "^NØKKEL=" api-test.env'
```

**Skal svare `1`.** Svarer den `2`, er linja lagt til dobbelt — rydd før deploy.

🔴 **Nøkkelhåndtering:** bruk `${#VAR}` for lengde og `grep -c` for eksistens.
**Aldri `echo $VAR` eller `cat` på en env-fil.**

---

# 5 · Rekkefølgen når alt skal ut

```
merge til develop  →  test-deploy  →  Kenneth verifiserer på test
                                   →  OTA kanal test (hvis mobil-JS er endret)
                                   →  prod-deploy  →  verifiser innlogget
                                   →  OTA kanal production
                                   →  git checkout develop
```

🔴 **Verifisering på test er ikke seremoni.** 2026-09-06/07 kom **fem** funn fra at Kenneth åpnet
flatene selv — uleselige tegninger, lønnsdata i arkivet, uforklart manifest, krav som endret seg
under føttene, og dokumentene som ikke var i arkivet i det hele tatt. **Ingen av dem kunne build
eller typecheck ha fanget.**

# 5b · 🔴 PROD-NEDETID 2026-09-11 — web-buildet kjørte aldri

**~30 minutters nedetid på prod. Les denne før neste store deploy.**

## Symptomet

`https://sitedoc.no/api/auth/error?error=Configuration` — **både Google og Microsoft feilet.**
En eksisterende sesjon kom inn på dashbordet, men fikk «Venter på prosjekttilgang».
🔴 **`curl /version` svarte 200 med riktig SHA hele tiden** — den ruta rører ikke databasen.

⚠️ **`error=Configuration` betyr IKKE at OAuth er feilkonfigurert.** Det er Auth.js sin generiske
melding når adapteren feiler. **Gå rett i `docker logs sitedoc-web` — der står den ekte feilen.**

## Rotårsaken

**Web-loggen sa det ordrett:**

```
[auth][cause]: PrismaClientKnownRequestError:
Invalid `prisma.account.findUnique()` invocation:
The column `users.ny_navigasjon` does not exist in the current database.
```

**Målt etterpå:**

```sh
ssh -t server-ny "sudo docker inspect sitedoc-api:latest sitedoc-web:latest --format '{{.RepoTags}} {{.Created}}'"
```

| Image | Bygget |
|---|---|
| `sitedoc-api:latest` | 2026-09-10 22:40 — **i deployen** |
| `sitedoc-web:latest` | 2026-09-08 06:49 — **to døgn gammelt** |

🔴 **Web-buildet ble aldri kjørt.** `deploy-prod.sh` SKRIVER UT fire kommandoer, men kjører dem
ikke. Kommando 2 av 4 (`build sitedoc-web`) ble hoppet over, og `up` startet det gamle imaget.
**Resultat: ny api + ny database + to døgn gammel web med en Prisma-klient fra før
`DROP COLUMN`.**

## 🔴 Berging — kolonnen tilbake, ikke rollback

**Raskeste vei opp når ny database møter en gammel klient:**

```sh
ssh -t server-ny "sudo docker exec postgres psql -U sitedoc -d sitedoc -c 'ALTER TABLE \"users\" ADD COLUMN IF NOT EXISTS \"ny_navigasjon\" BOOLEAN;'"
```

🟢 **Kolonnen er ubrukt i ny kode, så både gammel og ny klient fungerer med den der.**
**Ingen rollback nødvendig — all ny kode ble stående.** **Prod var oppe på sekunder.**

**Deretter bygges og startes web:**

```sh
ssh -t server-ny "cd ~/stack/sitedoc && sudo env GIT_SHA=af0093b8 BUILD_TID=\$(date -u +%Y-%m-%dT%H:%MZ) docker compose -f docker/docker-compose.yml build sitedoc-web"
```

```sh
ssh -t server-ny "cd ~/stack/sitedoc && sudo docker compose -f docker/docker-compose.yml up -d --no-deps sitedoc-web"
```

## 🔴 To tiltak som IKKE er gjort — begge kan gi samme nedetid igjen

**1. `deploy-prod.sh` kan ikke se om du kjørte alle fire kommandoene.**
Scriptet skriver dem ut og avslutter. **Hopper du over én, sier ingenting fra.**
🔴 **Til det er løst: verifiser byggetidene FØR du kjører `up`:**

```sh
ssh -t server-ny "sudo docker inspect sitedoc-api:latest sitedoc-web:latest --format '{{.RepoTags}} {{.Created}}'"
```
**Begge skal være fra de siste minuttene.**

**2. ⚠️ `prisma generate` traff Docker-cache i web-buildet 2026-09-11:**

```
=> CACHED [5/9] COPY . .
=> CACHED [7/9] RUN pnpm --filter @sitedoc/db exec prisma generate ...
=> [8/9] RUN pnpm turbo build --filter @sitedoc/web    105.3s
```

🔴 **`turbo build` kjørte, men `prisma generate` var cachet — selv om `schema.prisma` var endret.**
**Koden ble ny; klienten var ikke bevist ny.**

🟢 **LØST samme natt.** Web ble bygget om med `--no-cache` (349 s mot 266 s), og linje 7 kjørte
da i 10,9 s i stedet for `CACHED`. **Kolonnen ble droppet etterpå, innlogging verifisert.**
**Prod har ingen lapp igjen.**

### 🔴 Rekkefølgen som gjelder når en droppet kolonne skal ryddes

**1.** `build --no-cache sitedoc-web` — 🔴 **verifiser at linje 7 (`prisma generate`) IKKE er
CACHED.** Er den det, STOPP: klienten er fortsatt gammel.
**2.** `up -d --no-deps sitedoc-web` — 🔴 **FØR droppen.** Den gamle containeren kjører fortsatt
gammel klient; dropper du først, er prod nede på sekundet.
**3.** `DROP COLUMN IF EXISTS`.
**4.** **Logg ut og inn i nettleseren.** `docker logs | grep -c` beviser lite — en stille logg kan
bare bety at ingen har forsøkt å logge inn.

# 6 · Rollback — når noe er ute og feiler

## 🔴 En dårlig prod-release — koden virker, men den er feil

**Skrevet 2026-09-11, før prod-deployen som lå 44 merger bak. Fram til da fantes ingen dokumentert
vei tilbake fra en dårlig release — bare fra daemon-restart og fra en forgiftet OTA-bundel.**

### 🔴 FØRST: er migreringen reversibel?

**Dette avgjør alt, og det må avklares FØR du ruller tilbake — ikke mens prod er nede.**

🔴 **En `DROP COLUMN` gjør deployen ENVEIS.** Ruller du koden tilbake, kjenner den gamle
Prisma-klienten et felt som ikke finnes lenger, og **hver spørring mot tabellen feiler.**
**Kolonnen må legges tilbake før gammel kode starter.**

**Konkret for releasen 2026-09-11** (`20260910120000_drop_ny_navigasjon`):

```sql
ALTER TABLE "users" ADD COLUMN "ny_navigasjon" BOOLEAN;
```

🟢 **Verdien trenger ikke gjenskapes** — prod hadde `true` på 10 av 10, og flagget styrte
ingenting etter trinn 2. **Kolonnen må bare finnes.**

🟢 **De tre andre migreringene i samme release er additive** (`brukerinnstilling` = ny tabell,
`dokumentnummer_unik` + `gruppe_systemnokkel` = nye indekser/kolonne). **Gammel kode bryr seg ikke
om at de finnes. De skal IKKE rulles tilbake.**

⚠️ **Regelen generelt: les migreringene i releasen før du ruller tilbake.** `ADD` er ufarlig å la
stå. `DROP` må reverseres først. **`packages/db/prisma/migrations/` sorterer kronologisk.**

### Veien tilbake — den som virker garantert

**1. Finn forrige release-commit på `main`:**

```sh
cd ~/Documents/Programmering/SiteDoc && git log --oneline --first-parent origin/main | head -5
```

**2. Legg tilbake droppede kolonner** (se over) hvis releasen hadde en `DROP`.

**3. Revert release-mergen på `main` og deploy på nytt.**
🔴 **`git revert -m 1 <release-merge-sha>`**, ikke `reset --hard` — `main` er pushet, og historikk
skal ikke skrives om.
**Deretter vanlig `./deploy-prod.sh` fra `SiteDoc-deploy`-worktreet.**

⚠️ **Dette tar en full rebuild (to `docker compose build`).** **Regn minutter, ikke sekunder.**

### 🟢 Raskere vei — tagg dagens image FØR deployen

**Målt 2026-09-11:** prod-imagene har **kun `:latest`**, ingen SHA-tagger
(`sudo docker images | grep sitedoc`). **En rebuild overskriver taggen, og det gamle imaget blir
dangling — det finnes, men uten navn.** 🔴 **Uten forberedelse er det ingen snarvei tilbake.**

🟢 **Men compose peker på et image-NAVN** — `image: sitedoc-api:latest`
(`docker/docker-compose.yml:16`) og `image: sitedoc-web:latest` (`:47`) — **og `up -d` uten
`--build` bruker taggen som ligger der.** **Derfor virker dette:**

**FØR en stor deploy — gir et navngitt fallback:**

```sh
ssh -t server-ny "sudo docker tag sitedoc-api:latest sitedoc-api:rollback && sudo docker tag sitedoc-web:latest sitedoc-web:rollback && sudo docker images | grep rollback"
```

**VED rollback — sekunder, ingen rebuild:**

```sh
ssh -t server-ny "cd ~/stack/sitedoc && sudo docker tag sitedoc-api:rollback sitedoc-api:latest && sudo docker tag sitedoc-web:rollback sitedoc-web:latest && sudo docker compose -f docker/docker-compose.yml up -d --no-deps sitedoc-api sitedoc-web"
```

🔴 **`--no-deps` og INGEN `--build`** — legger du på `--build`, bygger den forrige koden på nytt
fra kildene som ligger der, og du får akkurat det du prøvde å komme deg vekk fra.
🔴 **Migreringsregelen over gjelder fortsatt:** droppede kolonner må legges tilbake FØR imaget
starter, ellers feiler den gamle Prisma-klienten.
⚠️ **`:rollback`-taggen overskrives ved neste forberedelse.** **Den er ett steg tilbake, ikke et
arkiv.**

### 🔴 Databasedump før store deployer

**`deploy-prod.sh` tar INGEN dump** — verifisert ved lesing av scriptet 2026-09-11.
**Ved en release med flere migreringer, særlig irreversible, tas dumpen manuelt først.**
⚠️ **Uten den finnes ingen vei tilbake fra en migrering som ødelegger data — bare fra en som
feiler.** **De to er ikke det samme.**

## api/web nede etter en daemon-restart

Docker-daemonen kan restarte (typisk en automatisk pakkeoppgradering) og ta containerne med seg.
`restart: unless-stopped` restarter dem **ikke** pålitelig etter en daemon-restart — `restart: always`
ville gjort det (ni forekomster er ikke endret ennå). 2026-08-14 tok dette prod ned i **~6 timer**
før noen oppdaget det, fordi ingenting varsler. (Åpent tiltak: en cron mot `/version` som varsler.)

**Berging — postgres FØRST.** Alt annet feiler uten den, og feilene ser ut som nettverks- eller
auth-problemer (`Can't reach database server`, `error=Configuration`) — ikke som «databasen er nede»:

```sh
ssh -t server-ny 'cd ~/stack/postgres && sudo docker compose up -d'
ssh -t server-ny 'cd ~/stack/sitedoc && sudo docker compose -f docker/docker-compose.yml up -d --no-deps sitedoc-api sitedoc-web pdf-render'
ssh -t server-ny 'cd ~/stack/salsaklubb && sudo docker compose up -d'
ssh -t server-ny 'sudo docker start sitedoc-embed sitedoc-oversettelse'   # eget compose-prosjekt «docker» → navnekonflikt ved `up`
```

**Diagnose ved mistanke om daemon-restart:**

```sh
ssh -t server-ny 'sudo docker ps --format "{{.Names}}\t{{.Status}}"'   # forventet: 10 containere
ssh -t server-ny 'sudo systemctl show docker --property=ActiveEnterTimestamp; uptime'
```

Er `ActiveEnterTimestamp` nyere enn containernes oppetid, har daemonen restartet.

## OTA — rull tilbake en forgiftet eller feil bundel

Minutter, ingen byggkvote. Gjelder KUN mobil-JS (kanal `production`/`test`), ikke api/web.

```sh
cd ~/Documents/Programmering/SiteDoc/apps/mobile && eas update:rollback
```

Valgene, i rekkefølge: **Published Update** → **Channel** → **production** → *den nyeste RENE
gruppa* → skriv en melding som sier HVORFOR («ROLLBACK: forrige bundel pekte mot api-test»).

🔴 **«Published Update», ikke «Embedded Update».** Den første går til forrige publiserte bundel og
beholder fiksene i den; den andre kaster helt tilbake til JS-en i binæren og mister dem.

---

## Hvor bakgrunnen bor

| Fil | Hva den eier ETTER 2026-09-07 |
|---|---|
| [`deploy-detaljer.md`](deploy-detaljer.md) | Branching-modell, rollback, mobil reload-tabell, tRPC-env-konsekvens. **Ingen kommandoer.** |
| [`infrastruktur.md`](infrastruktur.md) | Server/host-mapping, env-filkart, EAS Build, TestFlight, OAuth. **Ingen kommandoer.** |
| [`DOCKER-NOTES.md`](../../docker/DOCKER-NOTES.md) | Compose-prosjektnavn, container-navnekollisjoner, deploy-mekanikkens *hvorfor*. **Ingen kommandoer.** |
| [`eas-build-veileder.md`](eas-build-veileder.md) | Bygg-økonomi og kvote, credentials, app variants, **OTA-logg**, hendelseshistorikk. **Ingen kommandoer.** |
| `CLAUDE.md` | Én pekerlinje hit. |
