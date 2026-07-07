---
name: simulator-runbook
description: iOS-simulator ende-til-ende — oppstart, innlogging, tastene, brukerbytte og feilsøkingstabell. Alt verifisert 2026-07-07 under 2a-verifiseringsrunden. Hindrer at feilsøkingsløypa gjentas.
status: aktiv
sist_verifisert_mot_kode: 2026-07-07
---

# Simulator-runbook — oppstart til innlogget (test-miljø)

Ende-til-ende-oppskrift for å teste mobil-appen i iOS-simulator mot **test-API**
(`api-test.sitedoc.no` via localhost-tunnel). Alt her er verifisert 2026-07-07.
Sikkerhetsgrense, testbrukere og tunnelens rotårsak: se
[dev-login-agent.md](dev-login-agent.md) (dette dokumentet er den praktiske løypa,
dev-login-agent.md er kilden for whitelist/secret/tunnel-teori).

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

## 5. Agent-tap-lærdommer (idb/simctl — funn Plan 2-bevis 2026-07-07)

Fallgruver ved å drive simulatoren programmatisk via `idb ui tap`/`simctl` (agent uten manuell touch):

1. **zsh ordsplitter IKKE uciterte variabler.** `COORD=$(... "215 837" ...); idb ui tap $COORD` sender `"215 837"` som ÉN posisjon → `error: invalid int value: '215 837'`. Bruk `read X Y <<< "$COORD"; idb ui tap "$X" "$Y"` (eller literal-tall). Literal `idb ui tap 388 683` virker; variabel-via-`$VAR` gjør det ikke.
2. **RN-`Switch` trenger `--duration` på tappet.** Et momentant `idb ui tap x y` på en React Native-switch registreres ofte IKKE (verdi uendret). `idb ui tap x y --duration 0.12` (ekte trykk) flipper den. Gjelder trolig andre RN-gesture-komponenter også.
3. **`--udid`-flagget på `idb ui tap` kan feile** i noen idb-versjoner («usage»-feil) — sett `export IDB_UDID=<udid>` i stedet og dropp flagget.
4. **SecureStore-nøkler forbyr `:`** (kun alfanumerisk + `. - _`). Per-bruker cachenøkler må bruke `.`/`_` som separator, ikke kolon — ellers `Invalid key provided to SecureStore` (uncaught). Fanget i Plan 2 nyNavigasjon-hooken; localStorage (web) tåler kolon, så web traff det ikke.
5. **A11y-koordinater kan ligge utenfor synlig område** i en scrollview (frame-`y` > viewport) — swipe for å bringe elementet inn, og les koordinaten på nytt FØR tap (den flytter seg ved scroll).
6. **Offline-simulering:** iOS-simulator har ingen per-enhet nett-bryter via CLI. Kutt `ssh -L 3301`-tunnelen (test-API unåbar) for å teste offline-fallback, og **gjenopprett den etterpå** (`ssh -f -N -L 3301:localhost:3301 server-ny`).

## 6. Kryssreferanser

- [dev-login-agent.md](dev-login-agent.md) — endepunkt, whitelist, secret-oppsett, tunnel-rotårsak (Local Network-privacy)
- [DOCKER-NOTES.md punkt 8](../../docker/DOCKER-NOTES.md) — secret-endring krever recreate api + force-recreate web
- [BACKLOG.md](BACKLOG.md) — admin-bypass-gap, Metro blockList-fiks, s3 utlogging-navigasjon
- [simulator-ipv6-nordvpn.md](simulator-ipv6-nordvpn.md) — eldre simulator-henge-sak (IPv6/NordVPN — sjekk FØR koden)
