---
name: simulator-opus-oppkobling
description: Autoritativ referanse for simulator-Opus — oppkobling (miljø fra null), fullt input-repertoar (simctl + idb, empirisk verifisert), auth/brukerbytte, hva som krever Kenneth-hånd, reset, og test-handoff/rapporterings-protokoll mot cowork.
status: aktiv
sist_verifisert_mot_kode: 2026-09-22 — § 0 (Xcode 27-omlegging, headless-oppkobling, SimulatorKit-symlink, deployment-target-fiks, env-presedens, prod-sperre, dev-login-secret-kilde) verifisert ende-til-ende mot test (gitSha 47f24ed8). Eldre note: 2026-07-13 — DELVIS. KUN idb/simctl-repertoaret (§2) + koordinat-mapping (§3) er empirisk verifisert mot binær/kode. SiteDoc-app-atferdspåstander merket ⚠️ (§4) er kopiert fra simulator-runbook.md / dev-login-agent.md UTEN kodeverifisering denne økta — verifiser mot kode før du stoler på dem.
---

# Simulator-Opus — oppkobling + kapabilitet + handoff

Autoritativ referanse for **simulator-Opus-rollen**: en Opus-økt som driver iOS-simulatoren
mot test-API og rapporterer observasjoner tilbake til cowork (kontroll-Opus), som gater mot fasit.
Overlever kontekst-bytte. Empirisk verifisert 2026-07-12 (idb-repertoar mot faktisk binær).

**Fil-index (ikke dupliser — pek hit):**
| Fil | Eier |
|---|---|
| **denne** | Rolle, kapabilitetsmatrise, koord-mapping, handoff-protokoll |
| [simulator-runbook.md](simulator-runbook.md) | Praktisk oppstartsløype + feilsøkingstabell + tastene |
| [dev-login-agent.md](dev-login-agent.md) | Auth-teori: endepunkt, whitelist, secret, testbrukere, tunnel-rotårsak |
| [simulator-ipv6-nordvpn.md](simulator-ipv6-nordvpn.md) | Feilsøking «henger på spinner» — AAAA/IPv6-rotårsak (sjekk FØR koden) |

---

## 0. Xcode 27-omlegging (GJELDENDE — les før §1)

Fra Xcode 27 (build `27A266a`, sept. 2026) virker ikke den gamle `expo run:ios`-veien. Den
**praktiske, kopierbare oppstartsløypa** står i
[simulator-runbook.md § Xcode 27-oppstart](simulator-runbook.md) — dupliser den ikke her. Dette
avsnittet eier de autoritative **hvorfor**-fakta:

**Tre ting brøt samtidig (målt 2026-09-22):**

| Hva | Symptom | Rot | Konsekvens |
|---|---|---|---|
| `Simulator.app` fjernet fra bunten | `Can't determine id of Simulator app` (`expo run:ios`, `open -a Simulator`) | Xcode 27 flyttet hjelpe-appene til `Contents/Applications/` og droppet frittstående `Simulator.app` (→ `DeviceHub.app`) | Bygg headless (`xcodebuild`+`simctl`); GUI-vinduet trengs ikke for agent |
| `SimulatorKit.framework` flyttet | `SimulatorKit is required for HID interactions … does not exist` (`idb ui tap`) | Framework ligger nå i `Contents/SharedFrameworks/`; idb leter på gammel sti under `Contents/Developer/Library/PrivateFrameworks/` | Symlink gammel→ny (sudo). `describe-all` (a11y) upåvirket; kun input dør |
| Pods under deployment-target 15.0 | `IPHONEOS_DEPLOYMENT_TARGET … 15.0 to 27.0.x` → `BUILD FAILED` | Xcode 27 min-target = 15.0; gamle Pods deklarerer 9.0–12.4 | `IPHONEOS_DEPLOYMENT_TARGET=15.1` på xcodebuild-linja |

🔴 **Reinstall-fella:** Xcode 27 er ~3,7 GB og den manglende `Contents/Developer/Applications/`
ser ut som en avkuttet nedlasting. **Det er den ikke** — det er den nye normalen. En full
reinstall 2026-09-22 ga identisk resultat. Ikke bruk en runde på å reinstallere.

🔴 **SimulatorKit-symlinken endrer Xcode-bunten.** Nøyaktig kommando, hvorfor, og fjerning står i
[runbook § steg 0](simulator-runbook.md). Den bør fjernes etter bruk **eller** meldes eksplisitt
at den står — hver ny økt trenger den, så «la stå» er et bevisst valg, ikke en glemsel.

### Env-presedens — det viktigste funnet (gjelder ALLE Expo-bygg, ikke bare simulatoren)

`@expo/env` laster `.env`-filer **first-wins** (første fil som setter en nøkkel vinner). I
development: `.env.development.local` → `.env.local` → `.env.development` → `.env`.

- **Shell-eksportert `EXPO_PUBLIC_*` overstyrer IKKE** `.env`-filene (motsatt av vanlig dotenv).
- **`apps/mobile/.env.local` peker på PROD** (`https://api.sitedoc.no`) og slår `.env` sin
  `localhost:3301` → appen traff prod stille, dev-login `404`.
- **Pek mot test uten å røre `.env.local`:** midlertidig `apps/mobile/.env.development.local`
  (høyest presedens) med `EXPO_PUBLIC_API_URL=http://localhost:3301`, `expo start --clear`,
  slett etterpå. Full oppskrift + prod-sperre: [runbook § 3a](simulator-runbook.md).

🔴 **Prod-sperre før innlogging:** les effektiv `EXPO_PUBLIC_API_URL` og **avbryt hvis den er
`api.sitedoc.no`**. Runtime-bevis: dev-login lykkes kun mot test (prod svarer `404`).

## 1. Oppstart fra null (sjekkliste)

Fire ledd må stå. Kondensert her; full løype + feilsøking i [simulator-runbook.md](simulator-runbook.md).

| # | Ledd | Kommando | Bekreft oppe |
|---|---|---|---|
| 1 | **Boot device** | `xcrun simctl boot "iPhone 16 Plus"` (eller åpne Simulator.app) | `xcrun simctl list devices booted \| grep Booted` → iPhone 16 Plus + UDID |
| 2 | **SSH-tunnel** (hold åpen) | `ssh -N -L 3301:localhost:3301 server-ny` | `pgrep -fl "3301:localhost:3301"` + `curl -s -o /dev/null -w "%{http_code}" http://localhost:3301` → 200. Ingen output fra ssh = står; prompt tilbake = falt ned |
| 3 | **Metro** (tre: `apps/mobile`) | **Xcode ≤ 16:** `cd apps/mobile && npx expo run:ios`. **🔴 Xcode 27:** `expo run:ios` er død — bygg headless (`xcodebuild`+`simctl`, se § 0 + [runbook § Xcode 27-oppstart](simulator-runbook.md)), start Metro separat med `npx expo start --clear` | `pgrep -fl "expo start"`; rød «No script URL» i app = Metro nede |
| 4 | **Mobil .env** | `apps/mobile/.env` → `EXPO_PUBLIC_API_URL=http://localhost:3301` (IKKE api-test-edge, IKKE Tailscale-IP — loopback omgår ATS + iOS Local Network-privacy) | `grep API_URL apps/mobile/.env` |

**IPv6-forbehold (før du mistenker kode):** henger appen på spinner mot en host med AAAA →
`sudo networksetup -setv6off Wi-Fi`. Full rotårsak: [simulator-ipv6-nordvpn.md](simulator-ipv6-nordvpn.md).
Med `localhost:3301`-oppsettet er dette normalt ikke i spill (loopback har ingen AAAA), men gjelder
hvis .env skulle peke på edge/Tailscale.

**Ende-til-ende-bekreftelse at appen når API:** dev-login-knapp på innloggingsskjermen →
firma/prosjekt laster (ikke «Network request failed»). Server-side: `[DEV-LOGIN] Svar: 200` i Metro/server-logg.

---

## 2. Input-repertoar (empirisk verifisert 2026-07-12)

Verktøy = **`xcrun simctl`** (skjermbilde, livssyklus) + **Facebooks `idb`** (input, a11y, GPS, media, tillatelser).
Ingen MCP kreves for simulatoren — `simctl`+`idb` dekker alt. (Playwright/chrome-devtools-MCP er for **web** i
Kenneths Chrome, ikke simulatoren — se [mcp-playwright-simulator-oppsett.md](mcp-playwright-simulator-oppsett.md).)

**Single booted device → `--udid` kan utelates.** Er flere bootet: legg til `--udid <UDID>` (eller sett `IDB_UDID`).

🔴 **Xcode 27:** all **input** (`tap`/`text`/`swipe`/`key` — HID) krever SimulatorKit-symlinken (§ 0 / [runbook steg 0](simulator-runbook.md)), ellers `SimulatorKit is required for HID interactions … does not exist`. **A11y-lesing** (`describe-all`, `describe-point`) og `simctl io screenshot` virker uten symlinken.

| Handling | Kommando | Merknad |
|---|---|---|
| **Skjermbilde** | `xcrun simctl io booted screenshot f.png` | Utenfor idb. Les PNG i chat for visuell verifisering |
| **A11y-dump** | `idb ui describe-all` · `idb ui describe-point X Y` | Senterkoord per element — tap direkte på dem (alternativ til å regne fra PNG) |
| **Tap** | `idb ui tap X Y` | X Y i **punkter**. RN-switch krever `--duration 0.1` |
| **Skriv tekst** | `idb ui text "tekst"` | Fokusér feltet med tap først. Æ/ø/å: bekreftes ad hoc (HID-mapping kan svikte — se Grenser) |
| **Scroll / swipe** | `idb ui swipe x0 y0 x1 y1 [--duration s] [--delta px]` | Scroll ned = swipe fra lav→høy y baklengs (dra opp). `--delta` = tetthet, `--duration` = fart/flick |
| **Fysisk knapp** | `idb ui button {HOME,LOCK,SIDE_BUTTON,SIRI,APPLE_PAY}` | HOME = til hjemskjerm; LOCK = lås |
| **Tastekode** | `idb ui key <hid>` · `idb ui key-sequence <hid> <hid> …` | HID-keycodes (f.eks. 40=Enter, 42=Backspace) |
| **Deep link** | `idb open <url>` | Naviger via app-scheme/URL uten UI-tapping der ruten støtter det |
| **GPS-posisjon** | `idb set-location <lat> <lon>` | **Geofence/innsjekk testbart av agent** — sett koordinat innenfor/utenfor geofence |
| **Foto til bibliotek** | `idb add-media bilde.jpg …` | Seeder kamerarull → bildevelger kan plukke. (Live kamera-capture finnes ikke i simulator) |
| **Push** | `idb send-notification <bundle> '<json>'` | Leverer push-payload til appen |
| **Tillatelses-dialog** | `idb approve <bundle> {photos,camera,contacts,url,location,notification}` | Innvilg uten å tappe systemdialog |
| **Reset keychain** | `idb clear-keychain` | Kandidat for programmatisk sesjon-reset (SecureStore er keychain-basert) — **verifiser før du stoler på den**; tømmer hele keychain |
| **Livssyklus** | `xcrun simctl terminate booted <bundle>` / `launch booted <bundle>` | Reload/kaldstart (se § 4) |

**Dev-app bundle-id:** test-bygg = `com.kemyrhau.sitedoc.test` (kilde `app.config.js:28`), base/prod = `com.kemyrhau.sitedoc` (`app.json:14`). **Dev via Expo Go = `host.exp.Exponent`** (verifisert 2026-07-13 via GPS-tillatelsesdialog + SQLite-DB-sti). ⚠️ `terminate/launch com.kemyrhau.sitedoc`-kommandoene lenger nede FEILER når appen kjører i Expo Go-dev — bruk `host.exp.Exponent` da.

**idb-installasjon** (om binæren mangler — begge deler kreves): `pipx install fb-idb --python python3.11`
(Python 3.14 har asyncio-inkompat) + `brew install idb-companion`.

**zsh-felle:** uciterte koord-variabler ordsplittes ikke — `idb ui tap $K` blir ett arg.
`read X Y <<< "$K"` → `idb ui tap "$X" "$Y"`.

---

## 3. Koordinatsystem (mapping PNG → tap-punkt)

iPhone 16 Plus: **430×932 punkter**, skjermbilde **1290×2796 px** (3× skala). `idb ui tap` tar **punkter**.

- **Fra skjermbilde-piksler:** `punkt = px / 3`.
- **Fra bilde vist i chatten** (chatten oppgir «displayed 923×2000, multipliser med 1.40» for å nå original-px):
  `punkt ≈ vist_koord × 1.40 / 3 ≈ vist × 0.467`.
- **Bunnlinje-tab-rad** ligger ~y=885 punkter; kolonner fordeles jevnt over 430 px bredde.
- Slipp regnestykket helt: `idb ui describe-all` gir senterkoordinat i punkter direkte.

**Vent på bundling uten `sleep`** (bar sleep er blokkert): poll med skjermbilde-loop —
`for i in $(seq 1 8); do xcrun simctl io booted screenshot x.png; done`.

---

## 4. Auth / login + brukerbytte

**Simulator-Opus logger inn selv** — ingen Kenneth-hånd, ingen OAuth. Innloggingsskjermen viser fire
dev-login-knapper (kun test-/dev-bygg: `erTestLoginAktiv || __DEV__`; fraværende i prod). ✓ **Verifisert
2026-07-13: `apps/mobile/app/logg-inn.tsx:158`** (`(erTestLoginAktiv || __DEV__) && …`). Tap knappen → innlogget.

🔴 **Slik virker dev-login faktisk nå (verifisert 2026-09-22):** knappen POSTer mot
`${EXPO_PUBLIC_API_URL}/dev-login` med `EXPO_PUBLIC_DEV_LOGIN_SECRET`. **Begge kommer fra
env** — og secreten bor **kun i `apps/mobile/.env`** (ikke i `.env.local`/`.env.test`). Fordi
`@expo/env` er first-wins **per nøkkel**, kan du overstyre `EXPO_PUBLIC_API_URL` i en
`.env.development.local` mens secreten fortsatt arves fra `.env`. Krav for at dev-login skal
lykkes: (1) API_URL = `http://localhost:3301` (test), (2) secreten fra `.env`, (3) tunnelen oppe.
🔴 **Peker API_URL på prod, får du `https://api.sitedoc.no/dev-login → 404`.** Kjør prod-sperren
i § 0 FØR du tapper en dev-login-knapp. Env-presedens og fiks: § 0 + [runbook § 3a](simulator-runbook.md).

🔴 **DEBUG-BYGG, ALDRI RELEASE.** Dette er den enkeltfeilen som har kostet mest tid her:

```sh
cd apps/mobile && npx expo run:ios          # Debug — riktig
```

`--configuration Release` gjør **to** ting stille: `__DEV__` blir `false` så dev-login-knappene
forsvinner (kun OAuth igjen — en blindvei for en agent), **og** bygget laster `.env.production` og
peker mot **PROD** (`api.sitedoc.no`). Debug laster `.env` → `localhost:3301` = test.

**Symptom:** innloggingsskjermen viser bare «Logg inn med Google» og «Logg inn med Microsoft 365».
Ser du det, har du bygget Release. Bygg på nytt — ikke feilsøk innloggingen.
*(Kostet en runde 2026-09-02.)*

---

⚠️ **RESTEN AV DETTE AVSNITTET ER FJERNET 2026-09-02 — det var en KOPI.**

Testbruker-tabellen, brukerbytte-fallgruvene og whitelist/secret-teorien sto her som kopier fra
[dev-login-agent.md](dev-login-agent.md) og [simulator-runbook.md](simulator-runbook.md), hver med
⚠️ «ikke re-verifisert». **En ⚠️ på en kopi er ikke en fiks — det er en kopi med en etikett.**
Resultatet var at lesere landet på den degraderte versjonen i stedet for kilden, og at
Release-fella (som runbooken beskriver korrekt) aldri ble lest.

**Kildene, som er de eneste stedene dette skal stå:**

| Hva du trenger | Hvor det bor |
|---|---|
| **Løypa: oppstart → innlogget, tastene, brukerbytte, feilsøkingstabell** | [simulator-runbook.md](simulator-runbook.md) ← **START HER** |
| Testbrukere, whitelist, secret, `/dev-login`-endepunktet, tunnel-rotårsak | [dev-login-agent.md](dev-login-agent.md) |
| «Henger på spinner» — AAAA/IPv6-rotårsak (sjekk FØR koden) | [simulator-ipv6-nordvpn.md](simulator-ipv6-nordvpn.md) |

Denne fila eier **rollen, kapabilitetsmatrisen (§2), koordinat-mappingen (§3) og
handoff-protokollen (§7)** — ikke auth-detaljer.

---

## 5. Grenser — agent-doable vs Kenneth-hånd

Mange tidligere «Kenneth-hånd»-poster er nå **agent-doable via idb** (revidert 2026-07-12):

| Domene | Status | Hvordan |
|---|---|---|
| GPS / geofence / innsjekk | ✅ Agent | `idb set-location <lat> <lon>` — sett innenfor/utenfor geofence |
| Foto til bildevelger | ✅ Agent | `idb add-media f.jpg` seeder kamerarull |
| Tillatelses-dialoger | ✅ Agent | `idb approve <bundle> {photos,camera,location,notification,…}` |
| Push-varsel | ✅ Agent | `idb send-notification <bundle> '<json>'` |
| Deep-link-navigasjon | ✅ Agent | `idb open <scheme://…>` |
| **Live kamera-capture** | ⛔ Ikke mulig | Simulator har intet kamera — seed via `add-media` i stedet |
| **Face ID / biometrikk** | 🟡 Delvis | Ingen idb-primitiv; Simulator-meny «Features → Face ID → Matching/Non-matching» (GUI). Be Kenneth, eller unngå biometri-gate i test |
| **Offline (flymodus)** | 🟡 | Ingen ekte flymodus i simulator. Slå av host-nett / stopp tunnelen (`kill` ssh-forward) for å simulere API-tap — koordinér med Kenneth (tunnelen er hans hånd) |
| **Systemdialoger utover tillatelser** | 🟡 | Tap via koordinat der mulig; ellers Kenneth/GUI |
| **Æ/ø/å + spesialtegn i tekstfelt** | 🟡 | `idb ui text` HID-mapping kan svikte på ikke-ASCII — verifiser i skjermbilde; ved svikt, meld til cowork (fasit bør unngå ikke-ASCII input der mulig, eller Kenneth skriver) |
| **SSH-tunnel / secrets / prod-DB / EAS-bygg** | ⛔ Kenneth | Delt infra + kvote — aldri agent |

---

## 6. Reload + data-reset

| Behov | Hvordan |
|---|---|
| **Reload JS** (ny kode/rute) | Tast `r` **i Metro-vinduet** (Terminal B), IKKE som shell-kommando. Alternativ kaldstart: `xcrun simctl terminate booted com.kemyrhau.sitedoc && … launch …` (kan nullstille valgt prosjekt → naviger på nytt) |
| **Native endring** (pakke, `app.config.js`, plugin, scheme) | `cd apps/mobile && npx expo prebuild --clean -p ios && npx expo run:ios` |
| **Metro-taster** | `r` reload · `i` åpne i simulator · `j` debugger · `m` dev-meny |
| **Nullstill lokal cruft** (sedler/synk-kladder) | Reinstall app (`xcrun simctl uninstall booted <bundle>` → `expo run:ios`) — men sesjon overlever (keychain). Full reset: `xcrun simctl erase booted` (river ALT på device) |
| **Nullstill sesjon** | Mer → Logg ut · kandidat `idb clear-keychain` (verifiser) |

---

## 7. Test-handoff + rapportering (protokoll)

Trepartsflyt: **cowork eier fasiten, simulator-Opus utfører + observerer, Kenneth gir produkt-input/hånd-steg.**

**Cowork → simulator-Opus (fasit-format), per test:**
```
TEST <id>: <kort mål>
Forutsetning: <bruker + prosjekt/firma-kontekst + evt. seed/GPS>
Steg:        1. <handling>  2. <handling>  …
Forventet:   <observerbar fasit per steg / sluttilstand>
```
Presise, observerbare forventninger (tekst på skjerm, badge-tall, navigasjonsmål) — ikke «ser riktig ut».

**Simulator-Opus → cowork (observasjon), per test:**
```
TEST <id>: PASS | AVVIK | BLOKKERT
Faktisk:   <hva skjedde per steg — sitér skjermtekst>
Bevis:     <sitert a11y-tekst / logglinje — skjermbilde KUN når spørsmålet er visuelt>
Avvik:     <forventet vs faktisk, kun ved AVVIK>
Blokkert:  <hva som mangler + hvem: Kenneth-hånd / manglende seed / miljøledd nede>
```

🔴 **TEKST ER BEVISET, IKKE SKJERMBILDET (Kenneth 2026-08-26).** Denne linjen sa tidligere
«skjermbilde + sitert skjermtekst på hvert ikke-trivielt steg». Det kostet **46 % av Kenneths
ukebudsjett på én time** — 50+ skjermbilder à ~1000–1500 tokens. Simulatoren har vært brukt
uten problemer i månedsvis nettopp fordi verifiseringen var tekstbasert; det var protokollen
her som ba om bildene.

- **Standard: `idb ui describe-all`** for hva som finnes på skjermen, og **Metro-loggen** for
  hva som faktisk skjedde (`[OPPL] size:`, statusendringer, feil). Det svarer på «virker det»
  uten å lagre et eneste bilde.
- **Skjermbilde kun når SPØRSMÅLET er visuelt** — blør en strek, er lerretet svart, tegner en
  tegning. «Finnes velgeren», «endret statusen seg», «hvor stor ble fila» er tekst.
- Ett bilde, ikke en serie. Cowork gater mot fasit, så råobservasjon leveres, ikke en dom.
- **Batch handlingene.** Flere tapp, så én verifisering — ikke tapp, sjekk, tapp, sjekk. Hver
  verifisering er en ny lesning av hele samtalen, og det er antall lesninger som koster.
- **Skriv funnet til ordrefila med én gang det er gjort**, ikke i en sluttoppsummering. Da
  overlever resultatet uansett hva som skjer med økten — og du slipper å bære bevismaterialet
  videre i konteksten for å kunne rapportere senere.
- **Må et bilde tas: lagre det på disk og oppgi stien.** Bruk bildet, ikke bær det. Den som
  skal vurdere det leser det én gang.
- **Meld hva runden ETTERLOT** — utkast, rader, opplastede filer. Uten det degraderer
  agent-prosjektet for hver runde, og til slutt vet ingen hva som er seed og hva som er søppel.
  (Målt: fire tomme utkast etter to runder, fordi «+» auto-oppretter når malvelgeren åpnes.)
- **Driftskunnskap hører i [simulator-runbook.md](simulator-runbook.md), ikke i en rapport.**
  Oppdager du hvordan noe oppfører seg — at kamera ikke finnes og galleriveien må brukes, at
  «+» lager utkast, hvilke koordinater som treffer hva — skriv det dit. Ellers oppdager neste
  agent det på nytt, og hver oppdagelse koster.
- **Ikke selv-godkjenn mot fasit.** Simulator-Opus rapporterer hva som skjedde; **cowork avgjør PASS/AVVIK**.
- **Blokkert ≠ fail:** miljøledd nede, manglende seed eller Kenneth-hånd-steg meldes eksplisitt med hvem som må handle — ikke gjett rundt det.
- **En AVVIK stopper ikke resten** av batchen med mindre den er en forutsetning — kjør videre, samle alt, rapporter samlet.

**Rollegrense:** simulator-Opus tolker ikke produktkrav og endrer ikke fasit — spørsmål om forventning
går til cowork; produkt-/designvalg går videre til Kenneth via cowork.

---

## 8. Kryssreferanser

- [simulator-runbook.md](simulator-runbook.md) — oppstartsløype, tastene, feilsøkingstabell
- [dev-login-agent.md](dev-login-agent.md) — auth-endepunkt, whitelist, secret, testbrukere
- [simulator-ipv6-nordvpn.md](simulator-ipv6-nordvpn.md) — spinner/henge-rotårsak (AAAA/IPv6)
- [mcp-playwright-simulator-oppsett.md](mcp-playwright-simulator-oppsett.md) — web-verktøy (Kenneths Chrome), ikke simulator
- [COWORK-KONTROLL-VEILEDER.md](../../COWORK-KONTROLL-VEILEDER.md) — kontroll-rollens arbeidsmåte (cowork-siden)
