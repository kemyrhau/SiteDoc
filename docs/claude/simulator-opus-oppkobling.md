---
name: simulator-opus-oppkobling
description: Autoritativ referanse for simulator-Opus — oppkobling (miljø fra null), fullt input-repertoar (simctl + idb, empirisk verifisert), auth/brukerbytte, hva som krever Kenneth-hånd, reset, og test-handoff/rapporterings-protokoll mot cowork.
status: aktiv
sist_verifisert_mot_kode: 2026-07-13 — DELVIS. KUN idb/simctl-repertoaret (§2) + koordinat-mapping (§3) er empirisk verifisert mot binær/kode. SiteDoc-app-atferdspåstander merket ⚠️ (§4) er kopiert fra simulator-runbook.md / dev-login-agent.md UTEN kodeverifisering denne økta — verifiser mot kode før du stoler på dem.
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

## 1. Oppstart fra null (sjekkliste)

Fire ledd må stå. Kondensert her; full løype + feilsøking i [simulator-runbook.md](simulator-runbook.md).

| # | Ledd | Kommando | Bekreft oppe |
|---|---|---|---|
| 1 | **Boot device** | `xcrun simctl boot "iPhone 16 Plus"` (eller åpne Simulator.app) | `xcrun simctl list devices booted \| grep Booted` → iPhone 16 Plus + UDID |
| 2 | **SSH-tunnel** (hold åpen) | `ssh -N -L 3301:localhost:3301 server-ny` | `pgrep -fl "3301:localhost:3301"` + `curl -s -o /dev/null -w "%{http_code}" http://localhost:3301` → 200. Ingen output fra ssh = står; prompt tilbake = falt ned |
| 3 | **Metro** (tre: `apps/mobile`) | `cd apps/mobile && npx expo run:ios` (native bygg+install+Metro) · ren JS: `npx expo start --clear` mot allerede-installert app | `pgrep -fl "expo start"`; rød «No script URL» i app = Metro nede |
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

⚠️ **Testbruker-tabellen under (roller/data + «admin-bypass-gap») er kopiert fra [dev-login-agent.md](dev-login-agent.md), IKKE re-verifisert mot kode/seed denne økta.**

| Knapp | Rolle | Data |
|---|---|---|
| 🧪 SiteDoc-admin (`test-admin`) | `sitedoc_admin` | **Ingen prosjekter** (mobil prosjektliste er medlemskaps-basert — admin-bypass-gap) |
| 🧪 Firma-admin (`test-firma`) | `company_admin` | Testfirma AS — firma-kontekst |
| 🧪 Arbeider (`test-arbeider`) | `user` uten manage_field | Agentprosjekt-seed |
| 👤 Egen bruker (`kemyrhau`) | `sitedoc_admin` **med** prosjektmedlemskap | Ekte data (Markussen Boligfelt B12 m/tegninger) |

**For data-verifisering: bruk «Egen bruker (kemyrhau)»** — de seedede har ikke alltid prosjekttilknytning.

**Brukerbytte gjør agenten selv:** Mer → Logg ut → velg annen dev-login-knapp. To fallgruver:
1. ⚠️ **(kopiert fra runbook, IKKE kodeverifisert denne økta — grep `SecureStore|Keychain` i `AuthProvider.tsx`+`config/auth.ts` ga tomt treff)** **Sesjonen skal ligge i iOS-nøkkelringen og OVERLEVE app-sletting** — reinstall bytter da IKKE bruker.
   Bytt via Logg ut (eller kandidat: `idb clear-keychain`, se § 2 — verifiser).
2. ⚠️ **(kopiert fra runbook, IKKE verifisert denne økta)** **s3-bug:** etter «Logg ut» skal appen bli stående på Mer m/«Ukjent bruker». Workaround (fra Mac):
   `xcrun simctl terminate booted com.kemyrhau.sitedoc && xcrun simctl launch booted com.kemyrhau.sitedoc`
   → kaldstart uten token lander på innloggingsskjermen.

**Whitelist/secret-teori:** [dev-login-agent.md](dev-login-agent.md). `401`/`SECRET_MANGLER` = `DEV_LOGIN_SECRET`
matcher ikke mellom bundel og server-container (Kenneth-sak — sjekksum, aldri echo).

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
Bevis:     <skjermbilde(r)>
Avvik:     <forventet vs faktisk, kun ved AVVIK>
Blokkert:  <hva som mangler + hvem: Kenneth-hånd / manglende seed / miljøledd nede>
```
- **Skjermbilde + sitert skjermtekst** på hvert ikke-trivielt steg — cowork gater mot fasit, så råobservasjon leveres, ikke en dom.
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
