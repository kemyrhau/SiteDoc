---
name: simulator-runbook
description: iOS-simulator ende-til-ende — oppstart, innlogging, tastene, brukerbytte og feilsøkingstabell. Alt verifisert 2026-07-07 under 2a-verifiseringsrunden. Hindrer at feilsøkingsløypa gjentas.
status: aktiv
sist_verifisert_mot_kode: 2026-07-07
---

# Simulator-runbook — oppstart til innlogget (test-miljø)

> 🔴 **`EXPO_PUBLIC_*`-endringer krever cache-tømming (lærdom 2026-08-19).**
> Verdiene **inlines per fil ved Metro-transform**, og transform-cachen nøkles på
> **filinnhold — ikke på env-verdier.** Endrer du en `EXPO_PUBLIC_*`-variabel og bygger på
> nytt uten å tømme cachen, gjenbrukes den gamle transformen med den gamle verdien.
> Symptomet er at endringen «ikke virker» selv etter fersk install — typisk at dev-login
> ikke vises fordi `EXPO_PUBLIC_ENABLE_TEST_LOGIN` fortsatt leses som `undefined`.
>
> Alltid ved env-endring: `npx expo start --clear`, eller avinstaller appen **og** tøm
> Metro-cache før `expo run:ios`.
>
> **Release-sim:** `--configuration Release` laster `.env.production`, ikke `.env`. Skal du
> ha dev-login i Release-sim, må test-verdiene ligge der (`EXPO_PUBLIC_API_URL`,
> `EXPO_PUBLIC_DEV_LOGIN_SECRET`, `EXPO_PUBLIC_ENABLE_TEST_LOGIN`) **og** cachen tømmes.
> ⚠️ Fila er gitignorert — **slett den etter testen.** Den skal aldri overleve økta og aldri
> inn i et EAS-bygg.
>
> Kostnaden ved å ikke vite dette: tre Release-sim-bygg der dev-login «manglet», før
> rotårsaken ble funnet. Cowork ga `.env.production`-instruksen uten `--clear`, og uten å
> verifisere den mot dokumentasjon — den var hentet fra en tidligere observasjon i samme
> økt.

⚠️ **`scripts/simulator-tre.sh` finnes ikke lenger** (målt 2026-08-18) — referanser til den
under er drift. Bruk et eksisterende worktree med `node_modules` i stedet.

Ende-til-ende-oppskrift for å teste mobil-appen i iOS-simulator mot **test-API**
(`api-test.sitedoc.no` via localhost-tunnel). Alt her er verifisert 2026-07-07.
Sikkerhetsgrense, testbrukere og tunnelens rotårsak: se
[dev-login-agent.md](dev-login-agent.md) (dette dokumentet er den praktiske løypa,
dev-login-agent.md er kilden for whitelist/secret/tunnel-teori).

## 0. Fast simulator-worktree (`SiteDoc-simulator`) — kjør dette først

Simulatoren kjøres fra et **eget, permanent worktree**, ikke fra hovedtreet. Grunn: hovedtreet
brukes til merging og branch-bytte, og filer som endres under en pågående test gir falske funn.

```bash
cd ~/Documents/Programmering/SiteDoc
./scripts/simulator-tre.sh            # oppretter ved første kjøring, ellers oppdaterer til origin/develop
./scripts/simulator-tre.sh main       # eller annen ref (f.eks. verifisere prod-kode)
```

Scriptet er idempotent: henter fra origin, setter treet på ønsket ref (detached), oppretter
`apps/mobile/.env` med `EXPO_PUBLIC_API_URL=http://localhost:3301` første gang, og kjører
`pnpm install` **kun** når lockfilen har endret seg. Til slutt skriver det ut oppstartsstegene.

- **Sti:** `~/Documents/Programmering/SiteDoc-simulator`
- **Detached HEAD med vilje** — `develop` er checked out i hovedtreet, og en branch kan bare være
  ute i ett worktree om gangen. Treet er kun for kjøring/testing, aldri for commits.
- `.env` er gitignorert og overlever ref-bytte — settes bare første gang.

Kenneth kan starte simulatoren selv herfra når som helst; simulator-Opus bruker samme tre
(koordiner så ikke to Metro-instanser kjemper om samme device).

## 1. Oppstartssekvens (to terminaler)

**Terminal A — SSH-tunnel (hold åpen hele økta):**
```
ssh -N -L 3301:localhost:3301 server-ny
```
- **Ingen output = tunnelen står.** Terminalen «henger» med vilje (`-N` = ingen kommando).
- **Får du prompten tilbake = tunnelen falt ned** → start på nytt.
- Test-API lytter på server-ny `127.0.0.1:3301` (`docker-compose.test.yml`). Loopback er
  unntatt både iOS ATS og Local Network-privacy — derfor `localhost`, ikke Tailscale-IP.

**Terminal B — Metro + native bygg:**
```
cd apps/mobile && npx expo run:ios
```
- **Native endringer** (nye pakker, `app.config.js`, plugins, ikon/scheme) krever full
  prebuild først: `npx expo prebuild --clean -p ios` → deretter `npx expo run:ios`.
- **Ren JS/TS-endring** (komponenter, hooks, i18n) trenger IKKE rebuild — bare `r` i
  Metro-vinduet (se punkt 2). 2a mobil-tabs var ren JS → Fast Refresh holdt.

`apps/mobile/.env` (gitignored) må ha `EXPO_PUBLIC_API_URL=http://localhost:3301`.

## 2. Tastene (trykkes I Metro-vinduet, IKKE som shell-kommando)

| Tast | Effekt |
|---|---|
| `r` | Reload JS-bundelen (Fast Refresh / full reload) |
| `i` | Åpne/installer appen i booted iOS-simulator |
| `j` | Åpne debugger · `m` | toggle dev-meny |

Vanligste feil: å skrive `r` eller `i` som shell-kommando. De er **tastetrykk i den
kjørende `expo`-prosessen** (Terminal B).

## 3. Innlogging (dev-login-knapper)

Innloggingsskjermen viser fire dev-login-knapper (kun i test-/dev-bygg —
`erTestLoginAktiv || __DEV__`; fraværende i prod). Kilde:
`apps/mobile/app/logg-inn.tsx` (`TESTBRUKERE`).

> ⚠️ **`npx expo run:ios --configuration Release` gir IKKE dev-login (målt 2026-08-19).**
> Release-bygg laster `.env.production` (`EXPO_PUBLIC_API_URL=https://api.sitedoc.no`
> = **prod**, ingen `EXPO_PUBLIC_ENABLE_TEST_LOGIN`) → `__DEV__=false` + `erTestLoginAktiv=false`
> → kun Google/Microsoft. **Release-sim er dermed stengt for agent-testing** med mindre du
> legger en gitignorert `apps/mobile/.env.production.local` (høyest presedens) som overstyrer
> `EXPO_PUBLIC_API_URL=http://localhost:3301` + `EXPO_PUBLIC_ENABLE_TEST_LOGIN=true` +
> `EXPO_PUBLIC_DEV_LOGIN_SECRET=…`. **Advarsel:** uten den overstyringen peker Release-sim mot
> **prod-API** — ikke last opp/skriv testdata fra et slikt bygg. Vanlig `npx expo run:ios`
> (dev) er upåvirket og gir dev-login som normalt.

| Knapp | Rolle | Data |
|---|---|---|
| 🧪 SiteDoc-admin (`test-admin`) | `sitedoc_admin` | **Ingen prosjekter** (admin-bypass-gapet, se punkt 4) |
| 🧪 Firma-admin (`test-firma`) | `company_admin` | Testfirma AS — firma-kontekst |
| 🧪 Arbeider (`test-arbeider`) | `user` uten manage_field | Agentprosjekt-seed |
| 👤 Egen bruker (`kemyrhau@gmail.com`) | `sitedoc_admin` **med** prosjektmedlemskap | Ekte data — `Markussen Boligfelt B12` har tegninger + `Oversettelse-test (redesign)`-seedmappe |

**For 2a-/data-verifisering: bruk «Egen bruker (kemyrhau)»** — de seedede testbrukerne
mangler prosjekttilknytning der reell data trengs.

**⚠️ Sesjonen ligger i iOS-nøkkelringen og OVERLEVER app-sletting.** Å slette appen
nullstiller IKKE innloggingen. Brukerbytte skjer via **Mer → Logg ut**, ikke reinstall.

**Kjent s3-bug — utlogging navigerer ikke automatisk:** etter «Logg ut» blir appen
stående på Mer med «Ukjent bruker» i stedet for å gå til `/logg-inn`. Workaround
(fra Mac, ikke i Metro):
```
xcrun simctl terminate booted com.kemyrhau.sitedoc
xcrun simctl launch    booted com.kemyrhau.sitedoc
```
Kaldstart uten gyldig token lander på innloggingsskjermen. (Bi-observasjon: `Ny
navigasjon`-togglen kan vises stale i utloggingsvinduet — `bruker.hentMin`-cachen
tømmes ved kaldstart/ny innlogging.) Se [BACKLOG](BACKLOG.md).

## 4. Feilsøkingstabell (symptom → årsak → fiks)

| Symptom | Årsak | Fiks |
|---|---|---|
| `Invalid regular expression flag` fra `.env.eas.local` ved `expo run:ios` | Metro `blockList`-glob traff env-fil | Fikset (Metro `blockList`-mønster) — nevnes fordi den blokkerte hele bygget. Ved retur: sjekk `metro.config.js` blockList |
| `Network request failed` (RN-fetch) | (a) tunnel nede · (b) iOS Local Network-privacy · (c) feil API-URL | (a) sjekk Terminal A henger · (b) loopback omgår klassen — bruk `localhost` · (c) `apps/mobile/.env` = `http://localhost:3301` |
| `401` / `SECRET_MANGLER` fra `/dev-login` | `DEV_LOGIN_SECRET` matcher ikke mellom mobil-bundel og server-container | Sjekksum-prosedyre (aldri echo verdien): sammenlign `sha1sum` av Mac-`.env`-verdi, `docker/env/api-test.env` på server, og container-runtime (`/proc/PID/environ`). Env-endring krever **recreate** api + **force-recreate** web — se [DOCKER-NOTES.md punkt 8](../../docker/DOCKER-NOTES.md) |
| `No script URL provided` (rød RN-skjerm) | Metro er ikke i gang | Start `npx expo start` i Terminal B → trykk `i` |
| test-admin ser ingen prosjekter | Admin-bypass-gapet — mobil prosjektliste er medlemskaps-basert, `sitedoc_admin` uten `ProjectMember`-rad ser tomt (web fikk bypass i redesign steg ii) | **Forventet.** Bruk «Egen bruker (kemyrhau)» for data. Oppfølger: [BACKLOG § Mobil prosjektliste mangler sitedoc_admin-bypass](BACKLOG.md) |

## 5. Autonom styring med idb (agent-tap — funn Plan 2-bevis 2026-07-07)

Når agenten skal trykke i simulatoren selv (ikke bare lese), brukes Facebooks
`idb` — den gir a11y-koordinater og tap/swipe uten museautomasjon.

**Installasjon (to deler — begge kreves):**
```
pipx install fb-idb          # Python-klienten (idb-kommandoen)
brew install idb-companion   # native companion som snakker med simulatoren
```
- **`fb-idb` MÅ installeres på Python 3.11.** Python 3.14 har en asyncio-inkompat
  som får `idb` til å kræsje ved oppstart. Tving versjon: `pipx install fb-idb
  --python python3.11`.

**Bruk (`<U>` = simulator-UDID, hent med `xcrun simctl list devices booted`):**
```
idb ui describe-all --udid <U>          # dumper alle a11y-elementer + koordinater
idb ui tap --udid <U> X Y               # trykk på punkt (X Y fra describe-all)
idb ui tap --udid <U> X Y --duration 0.1  # RN-switcher krever eksplisitt varighet
```
- Koordinatene fra `describe-all` er senterpunkt for hvert element — tap direkte på dem.
- Skjermbilde tas utenfor idb: `xcrun simctl io booted screenshot skjerm.png`.

**Fallgruver (agent uten manuell touch):**

1. **zsh ordsplitter IKKE uciterte variabler.** `COORD=$(... "215 837" ...); idb ui tap $COORD` sender `"215 837"` som ÉN posisjon → `error: invalid int value: '215 837'`. Bruk `read X Y <<< "$COORD"; idb ui tap "$X" "$Y"` (eller literal-tall). Literal `idb ui tap 388 683` virker; variabel-via-`$VAR` gjør det ikke.
2. **RN-`Switch` trenger `--duration` på tappet.** Et momentant `idb ui tap x y` på en React Native-switch registreres ofte IKKE (verdi uendret). `idb ui tap x y --duration 0.12` (ekte trykk) flipper den (f.eks. `Ny navigasjon`-togglen). Gjelder trolig andre RN-gesture-komponenter også.
3. **`--udid`-flagget på `idb ui tap` kan feile** i noen idb-versjoner («usage»-feil) — sett `export IDB_UDID=<udid>` i stedet og dropp flagget.
4. **SecureStore-nøkler forbyr `:`** (kun alfanumerisk + `. - _`). Per-bruker cachenøkler må bruke `.`/`_` som separator, ikke kolon — ellers `Invalid key provided to SecureStore` (uncaught). Fanget i Plan 2 nyNavigasjon-hooken; localStorage (web) tåler kolon, så web traff det ikke.
5. **A11y-koordinater kan ligge utenfor synlig område** i en scrollview (frame-`y` > viewport) — swipe for å bringe elementet inn, og les koordinaten på nytt FØR tap (den flytter seg ved scroll).
6. **Offline-simulering:** iOS-simulator har ingen per-enhet nett-bryter via CLI. Kutt `ssh -L 3301`-tunnelen (test-API unåbar) for å teste offline-fallback, og **gjenopprett den etterpå** (`ssh -f -N -L 3301:localhost:3301 server-ny`).

## 6. Kryssreferanser

- [dev-login-agent.md](dev-login-agent.md) — endepunkt, whitelist, secret-oppsett, tunnel-rotårsak (Local Network-privacy)
- [DOCKER-NOTES.md punkt 8](../../docker/DOCKER-NOTES.md) — secret-endring krever recreate api + force-recreate web
- [BACKLOG.md](BACKLOG.md) — admin-bypass-gap, Metro blockList-fiks, s3 utlogging-navigasjon
- [simulator-ipv6-nordvpn.md](simulator-ipv6-nordvpn.md) — eldre simulator-henge-sak (IPv6/NordVPN — sjekk FØR koden)
