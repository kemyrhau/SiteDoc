---
name: simulator-runbook
description: iOS-simulator ende-til-ende — oppstart, innlogging, tastene, brukerbytte og feilsøkingstabell. Alt verifisert 2026-07-07 under 2a-verifiseringsrunden. Hindrer at feilsøkingsløypa gjentas.
status: aktiv
sist_verifisert_mot_kode: 2026-09-22 — Xcode 27-oppstartsløypa (headless xcodebuild+simctl, SimulatorKit-symlink, deployment-target-fiks, env-presedens, prod-sperre) verifisert ende-til-ende mot test (gitSha 47f24ed8). Den gamle `expo run:ios`-GUI-veien (§1) er Xcode ≤ 16 og ikke re-verifisert.
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

## 🔴 Xcode 27 (fra sept. 2026) — den gamle oppkoblingen virker ikke. Les denne først.

Xcode 27 (build `27A266a`) la om simulator-verktøyene. Tre ting brøt samtidig, og
`npx expo run:ios` / `open -a Simulator` er **død vei** nå. Symptomer og fiks står i
[§ 4 Feilsøkingstabell](#4-feilsøkingstabell-symptom--årsak--fiks); her er den **gjeldende
oppstartsløypa** som faktisk virker. Agenten trenger ikke GUI-vinduet — `simctl` (headless) +
`idb` + `simctl io screenshot` leser skjermen uten det.

**Hva som brøt (kort — detalj i feilsøkingstabellen):**
1. **`Simulator.app` er fjernet fra Xcode-bunten.** Apple flyttet hjelpe-appene fra
   `Contents/Developer/Applications/` til `Contents/Applications/` og droppet den frittstående
   `Simulator.app` (erstattet av `DeviceHub.app`). `expo run:ios` feiler med
   `Can't determine id of Simulator app`. **Xcode.app er ~3,7 GB og ser avkuttet ut — det er
   den ikke.** Reinstall hjelper ikke (kostet en full reinstall å bekrefte 2026-09-22).
2. **`idb ui tap`/`text`/`swipe` (HID) feiler** fordi idb leter etter `SimulatorKit.framework`
   på gammel sti. Krever symlink (steg 0 under). `idb ui describe-all` (a11y-lesing) virker uten.
3. **`xcodebuild` feiler** fordi gamle Pods har `IPHONEOS_DEPLOYMENT_TARGET` < 15.0. Løses med
   én flagg-overstyring (steg 3 under).

### Steg 0 — SimulatorKit-symlink (ÉN gang, krever Kenneths `sudo`)

idb trenger `SimulatorKit.framework` på den gamle stien. Xcode 27 flyttet den til
`Contents/SharedFrameworks/`. Pek gammel sti dit:

```bash
sudo mkdir -p /Applications/Xcode.app/Contents/Developer/Library/PrivateFrameworks
```

```bash
sudo ln -s /Applications/Xcode.app/Contents/SharedFrameworks/SimulatorKit.framework /Applications/Xcode.app/Contents/Developer/Library/PrivateFrameworks/SimulatorKit.framework
```

🔴 **Dette endrer Xcode-bunten.** Den overlever til neste Xcode-oppdatering (som kan gjenskape
den gamle mappa og gjøre symlinken overflødig eller stå i veien). **Fjern den når testøkta er
ferdig** — eller meld eksplisitt at den står:

```bash
sudo rm /Applications/Xcode.app/Contents/Developer/Library/PrivateFrameworks/SimulatorKit.framework
```

*(Merk: hver ny agent-økt trenger symlinken. Lar du den stå, slipper neste økt steg 0 — men da
er Xcode-bunten modifisert mellom øktene, og det skal være et bevisst valg, ikke en glemsel.)*

### Steg 1 — boot device (headless, ingen GUI)

```bash
xcrun simctl boot "iPhone 16 Plus"
```

```bash
xcrun simctl list devices booted | grep Booted
```

### Steg 2 — SSH-tunnel (Kenneths hånd — delt/prod-host, sandkassen blokkerer agenten)

```bash
ssh -N -L 3301:localhost:3301 server-ny
```

Ingen output = står. Prompt tilbake = falt ned.

### Steg 3 — Metro + native bygg (fra `apps/mobile`)

Metro først (Debug henter JS + `EXPO_PUBLIC_*` fra Metro ved runtime):

```bash
npx expo start --clear
```

Bygg headless med **deployment-target-overstyringen** (uten den: `BUILD FAILED` på gamle Pods):

```bash
UDID=$(xcrun simctl list devices booted | awk -F'[()]' '/Booted/{print $2; exit}')
xcodebuild -workspace ios/SiteDoc.xcworkspace -scheme SiteDoc -configuration Debug -sdk iphonesimulator -destination "id=$UDID" -derivedDataPath ios/build IPHONEOS_DEPLOYMENT_TARGET=15.1 -quiet build
```

### Steg 4 — installer + start appen

```bash
xcrun simctl install booted ios/build/Build/Products/Debug-iphonesimulator/SiteDoc.app
```

```bash
xcrun simctl launch booted com.kemyrhau.sitedoc
```

### Steg 5 — les skjermen (a11y, ikke skjermbilde)

```bash
IDB_UDID=$(xcrun simctl list devices booted | awk -F'[()]' '/Booted/{print $2; exit}') idb ui describe-all
```

Tap/tekst/swipe krever symlinken fra steg 0. Skjermbilde ved visuelt behov:
`xcrun simctl io booted screenshot skjerm.png`.

### 🔴 Sperre FØR du logger inn: verifiser at appen IKKE peker på prod

`.env`-filene vinner over shell-eksport, og en `.env.local` med prod-URL kan sende appen mot
**produksjon** uten at du merker det (se [§ 3a Env-presedens](#3a-env-presedens--pek-appen-mot-test-uten-å-røre-envlocal)).
Kjør denne i `apps/mobile` og **avbryt hvis den viser `api.sitedoc.no`**:

```bash
cd apps/mobile; for f in .env.development.local .env.local .env; do [ -f "$f" ] || continue; V=$(grep -E '^EXPO_PUBLIC_API_URL=' "$f" | head -1 | cut -d= -f2-); [ -n "$V" ] && { echo "API_URL=$V  (fra $f)"; break; }; done
```

Runtime-bekreftelse: dev-login **lykkes** kun mot test — prod svarer `404` på `/dev-login`.
Ser du prod-404, står appen på prod. Fiks env (§ 3a) før du gjør noe mer.

## 0. Fast simulator-worktree (`SiteDoc-simulator`) — kjør dette først

Simulatoren kjøres fra et **eget, permanent worktree**, ikke fra hovedtreet. Grunn: hovedtreet
brukes til merging og branch-bytte, og filer som endres under en pågående test gir falske funn.

🔴 **`scripts/simulator-tre.sh` FINNES IKKE** (målt 2026-08-18, bekreftet 2026-08-20).
Stegene under er den manuelle løypa som erstatter den. Kommandoene i den gamle
script-formen er fjernet fra dette avsnittet fordi de sendte agenter i blindvei.

**Førstegangsoppsett:**

```bash
git -C ~/Documents/Programmering/SiteDoc worktree add \
  ~/Documents/Programmering/SiteDoc-simulator --detach origin/develop
cd ~/Documents/Programmering/SiteDoc-simulator && pnpm install
```

**`.env` — settes ÉN gang, kun hvis fila ikke finnes:**

```bash
cd ~/Documents/Programmering/SiteDoc-simulator/apps/mobile \
&& [ -f .env ] && echo "FINNES ALLEREDE — ikke rør" \
|| printf 'EXPO_PUBLIC_API_URL=http://localhost:3301\n' > .env
```

⚠️ **Gaten `[ -f .env ]` er ufravikelig.** `> .env` mot en eksisterende fil sletter
gitignorerte verdier som ikke finnes noe annet sted — det har skjedd (dev-login-secreten
forsvant slik, og lokal Expo sluttet å virke). Se
[infrastruktur.md § Miljøvariabler](infrastruktur.md).

**Oppdatere treet til ny kode senere:**

```bash
git -C ~/Documents/Programmering/SiteDoc-simulator fetch origin \
&& git -C ~/Documents/Programmering/SiteDoc-simulator checkout --detach origin/develop
```

`.env` er gitignorert og overlever ref-bytte — den settes bare første gang.

- **Sti:** `~/Documents/Programmering/SiteDoc-simulator`
- **Detached HEAD med vilje** — `develop` er checked out i hovedtreet, og en branch kan bare være
  ute i ett worktree om gangen. Treet er kun for kjøring/testing, aldri for commits.
- `.env` er gitignorert og overlever ref-bytte — settes bare første gang.

Kenneth kan starte simulatoren selv herfra når som helst; simulator-Opus bruker samme tre
(koordiner så ikke to Metro-instanser kjemper om samme device).

## 1. Oppstartssekvens (to terminaler)

> 🔴 **På Xcode 27 er `npx expo run:ios` død vei** (den frittstående `Simulator.app` finnes
> ikke). Bruk den headless-løypa i **§ Xcode 27-oppstart** øverst i dokumentet. Avsnittet under
> beskriver den gamle GUI-veien og gjelder kun Xcode ≤ 16, der `Simulator.app` finnes.

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

## 3a. Env-presedens — pek appen mot test uten å røre `.env.local`

🔴 **Dette funnet gjelder ikke bare simulatoren — det gjelder ethvert Expo-bygg.**

Expo (`@expo/env`) laster `.env`-filene med **«first-wins»**: den FØRSTE fila som setter en
nøkkel, vinner, og senere filer overstyrer ikke. I development-modus (`expo start`) er
rekkefølgen:

```
.env.development.local  →  .env.local  →  .env.development  →  .env
```

**To feller som kostet flere runder 2026-09-22:**

1. **Shell-eksport overstyrer IKKE `.env`-filene.** `EXPO_PUBLIC_API_URL=... npx expo start`
   blir ignorert — `@expo/env` vinner over prosessmiljøet (motsatt av vanlig dotenv). Verifisert.
2. **`apps/mobile/.env.local` (gitignorert) peker på PROD.** Den setter
   `EXPO_PUBLIC_API_URL=https://api.sitedoc.no` og slår `.env` sin `http://localhost:3301`.
   Resultat: appen traff **produksjon** stille, og dev-login ga `404` (prod har ikke `/dev-login`).

**Env-filene som finnes nå (målt 2026-09-22):**

| Fil | `EXPO_PUBLIC_API_URL` | Merknad |
|---|---|---|
| `.env` | `http://localhost:3301` | + `EXPO_PUBLIC_DEV_LOGIN_SECRET` (secreten bor KUN her) |
| `.env.local` | `https://api.sitedoc.no` (**PROD**) | Kenneths — **rør aldri** |
| `.env.test` | `https://api-test.sitedoc.no` | |
| `.env.production` | `https://api.sitedoc.no` | |

**Riktig måte å tvinge appen mot test (localhost:3301) uten å røre `.env.local`:** lag en
**midlertidig** `.env.development.local` (høyest presedens), og slett den etterpå.

Verifiser at den er gitignorert FØR du skriver den:

```bash
git check-ignore -v apps/mobile/.env.development.local
```

Skriv den (kun API_URL — secreten arves fra `.env` fordi first-wins er per nøkkel):

```bash
printf 'EXPO_PUBLIC_API_URL=http://localhost:3301\n' > apps/mobile/.env.development.local
```

Restart Metro med `--clear` (`EXPO_PUBLIC_*` inlines per fil ved transform, cache-nøklet på
filinnhold — uten `--clear` gjenbrukes gammel verdi):

```bash
npx expo start --clear
```

Slett den når du er ferdig og bekreft:

```bash
rm -f apps/mobile/.env.development.local && ls apps/mobile/.env.development.local 2>/dev/null || echo "slettet"
```

## 4. Feilsøkingstabell (symptom → årsak → fiks)

| Symptom | Årsak | Fiks |
|---|---|---|
| `CommandError: Can't determine id of Simulator app; the Simulator is most likely not installed` (fra `npx expo run:ios` **og** `open -a Simulator`) | **Xcode 27** fjernet den frittstående `Simulator.app` fra bunten (hjelpe-appene flyttet til `Contents/Applications/`, GUI erstattet av `DeviceHub.app`) | **Ikke reinstaller Xcode** (3,7 GB er normalt for 27, ikke avkuttet — bekreftet med full reinstall). Bygg headless: `xcodebuild` + `simctl install/launch` (se § Xcode 27-oppstart øverst) |
| `SimulatorKit is required for HID interactions: Error ... '/Applications/Xcode.app/Contents/Developer/Library/PrivateFrameworks/SimulatorKit.framework' ... does not exist` (fra `idb ui tap`/`text`/`swipe`) | Xcode 27 flyttet `SimulatorKit.framework` til `Contents/SharedFrameworks/`; idb leter på gammel sti | Symlink gammel→ny sti (sudo, se steg 0 øverst). `idb ui describe-all` (a11y) virker uten symlinken — kun input krever den |
| `error: The iOS Simulator deployment target 'IPHONEOS_DEPLOYMENT_TARGET' is set to 12.0, but the range of supported deployment target versions is 15.0 to 27.0.x` → `** BUILD FAILED **` (Pods: ReachabilitySwift, react-native-maps, SDWebImage, RNSVG m.fl.) | Gamle Pods deklarerer deployment target < 15.0; Xcode 27 krever minst 15.0 | Legg `IPHONEOS_DEPLOYMENT_TARGET=15.1` på `xcodebuild`-kommandolinjen (overstyrer alle targets, ingen Podfile-endring) |
| Dev-login feiler: `Dev-login ikke aktiv (https://api.sitedoc.no/dev-login → 404)` | `.env.local` overstyrer `EXPO_PUBLIC_API_URL` til **PROD** (first-wins slår `.env`) | Midlertidig `.env.development.local=http://localhost:3301` + `expo start --clear` (se § 3a). **Kjør prod-sperren først.** |
| Shell-eksport `EXPO_PUBLIC_API_URL=... npx expo start` ignoreres | `@expo/env` first-wins fra `.env`-filer slår prosessmiljøet | Bruk `.env.development.local` (høyest presedens), ikke shell-eksport (§ 3a) |
| Appens versjon-footer viser gammel git-hash etter tre-oppdatering | Git-SHA bakes inn i native `Constants.manifest` ved `xcodebuild`-tid; Metro-JS er allerede fersk | Rebuild native (`xcodebuild`) for å regenerere manifesten. JS-atferden er allerede oppdatert via Metro — footeren er kun etikett |
| «Send til …»-knappen virker død (ingen sending, dialog eller logg) | RN-dev-toasten `Open debugger to view warnings` ligger over knappen og avskjærer tappet | Dismiss toasten (tapp `×`) før du tapper Send. Gjelder Debug-bygg |
| `Invalid regular expression flag` fra `.env.eas.local` ved `expo run:ios` | Metro `blockList`-glob traff env-fil | Fikset (Metro `blockList`-mønster) — nevnes fordi den blokkerte hele bygget. Ved retur: sjekk `metro.config.js` blockList |
| `Network request failed` (RN-fetch) | (a) tunnel nede · (b) iOS Local Network-privacy · (c) feil API-URL | (a) sjekk Terminal A henger · (b) loopback omgår klassen — bruk `localhost` · (c) `apps/mobile/.env` = `http://localhost:3301` |
| `401` / `SECRET_MANGLER` fra `/dev-login` | `DEV_LOGIN_SECRET` matcher ikke mellom mobil-bundel og server-container | Sjekksum-prosedyre (aldri echo verdien): sammenlign `sha1sum` av Mac-`.env`-verdi, `docker/env/api-test.env` på server, og container-runtime (`/proc/PID/environ`). Env-endring krever **recreate** api + **force-recreate** web — se [DOCKER-NOTES.md punkt 8](../../docker/DOCKER-NOTES.md) |
| `No script URL provided` (rød RN-skjerm) | Metro er ikke i gang | Start `npx expo start` i Terminal B → trykk `i` |
| test-admin ser ingen prosjekter | Admin-bypass-gapet — mobil prosjektliste er medlemskaps-basert, `sitedoc_admin` uten `ProjectMember`-rad ser tomt (web fikk bypass i redesign steg ii) | **Forventet.** Bruk «Egen bruker (kemyrhau)» for data. Oppfølger: [BACKLOG § Mobil prosjektliste mangler sitedoc_admin-bypass](BACKLOG.md) |
| Release-bygg feiler på `[CP] Copy XCFrameworks` (hermes-engine) med `rsync … hermes.xcframework/ios-arm64_x86_64-simulator/*: No such file` | **Debug→Release-artefakt-fella.** Et dev-bygg (Debug) laster kun `hermes-ios-<v>-debug.tar.gz` til `ios/Pods/hermes-engine-artifacts/`; release-tarballen mangler (evt. som avbrutt `hermes-ios.download`). Første Release-bygg feiler da på `tar`. | Se **§ 4a** — ikke bare bygg på nytt (idempotens-fella under gir 3 bygg). |

> ### 4a. Debug→Release Hermes-fella (kostet 3 bygg 2026-08-27 — skal koste 0)
>
> `expo run:ios --configuration Release` etter et Debug-dev-bygg feiler på hermes-`Copy XCFrameworks`
> fordi **kun debug-Hermes-prebuilt er lastet ned.** To feller stablet:
>
> 1. **Manglende release-artefakt.** `ios/Pods/hermes-engine-artifacts/` har `hermes-ios-<v>-debug.tar.gz`
>    men ikke `-release.tar.gz` (ofte en halvferdig `hermes-ios.download`). Byggets `[Hermes] Replace`-steg
>    kjører `tar -xf …-release.tar.gz` → «No such file» → tom `destroot` → rsync i `Copy XCFrameworks` feiler.
> 2. **🔴 Idempotens-buggen som gjør at «bygg på nytt» IKKE hjelper.** `node_modules/react-native/sdks/hermes-engine/utils/replace_hermes_version.js`
>    `main()` sjekker **ikke** om `tar` lyktes: den kjører `rmSync('hermes-engine')` (sletter destroot),
>    `tar` feiler, men den skriver likevel `.last_build_configuration=Release` (i `ios/Pods/`). Neste
>    Release-bygg ser «samme config» → **hopper over ekstraksjonen** → destroot forblir tom → samme rsync-feil.
>    Uendret kildekode ⇒ transform-cachen hjelper heller ikke.
>
> **Fiks (én gang, ~15 s — ingen ny nedlasting hvis release-tarball finnes):**
> ```bash
> cd apps/mobile/ios/Pods
> # 1) hent release-artefakt om den mangler (samme Maven-kilde som debug):
> A=hermes-engine-artifacts; V=0.81.5   # V = RN-versjon (matcher debug-tarballens navn)
> [ -f "$A/hermes-ios-$V-release.tar.gz" ] || curl -s -o "$A/hermes-ios-$V-release.tar.gz" \
>   "https://repo1.maven.org/maven2/com/facebook/react/react-native-artifacts/$V/react-native-artifacts-$V-hermes-ios-release.tar.gz"
> rm -f "$A/hermes-ios.download"; gzip -t "$A/hermes-ios-$V-release.tar.gz"   # valider
> # 2) ekstrahér manuelt til destroot (det replace-scriptet skulle gjort), og sett marker konsistent:
> rm -rf hermes-engine && mkdir hermes-engine && tar -xf "$A/hermes-ios-$V-release.tar.gz" -C hermes-engine
> ls -d hermes-engine/destroot/Library/Frameworks/universal/hermes.xcframework/ios-arm64_x86_64-simulator  # skal finnes
> printf 'Release' > .last_build_configuration
> ```
> Deretter `npx expo run:ios --configuration Release` — Copy XCFrameworks finner nå slicen.
> (RNDeps-artefakten har typisk begge varianter allerede; det er kun Hermes som mangler release.)

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
