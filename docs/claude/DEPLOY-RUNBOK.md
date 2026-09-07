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

## Hvor bakgrunnen bor

| Fil | Hva den eier ETTER 2026-09-07 |
|---|---|
| [`deploy-detaljer.md`](deploy-detaljer.md) | Branching-modell, rollback, mobil reload-tabell, tRPC-env-konsekvens. **Ingen kommandoer.** |
| [`infrastruktur.md`](infrastruktur.md) | Server/host-mapping, env-filkart, EAS Build, TestFlight, OAuth. **Ingen kommandoer.** |
| [`DOCKER-NOTES.md`](../../docker/DOCKER-NOTES.md) | Compose-prosjektnavn, container-navnekollisjoner, deploy-mekanikkens *hvorfor*. **Ingen kommandoer.** |
| [`eas-build-veileder.md`](eas-build-veileder.md) | Bygg-økonomi og kvote, credentials, app variants, **OTA-logg**, hendelseshistorikk. **Ingen kommandoer.** |
| `CLAUDE.md` | Én pekerlinje hit. |
