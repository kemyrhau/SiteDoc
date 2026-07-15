---
name: eas-build-veileder
status: aktiv
sist_verifisert_mot_kode: 2026-06-12
---

# EAS Build-veileder (iOS) — credentials + bygg

> **Skrevet 2026-06-12 mens prosessen var fersk** (R4 mobil enhet-verifisering).
> Hovedpoenget: **bruk App Store Connect API-nøkkel, ALDRI Apple-passord** — 2FA gjør
> passord-veien umulig og gir misvisende feilmelding. Resten er stort sett engangsoppsett.

## Når brukes EAS build

Mobil-endringer (React Native/Expo) kan ikke testes i web/test-stacken — de krever et
faktisk iOS-bygg på enhet. EAS bygger appen på skyen → installerbar på iPhone (ad-hoc/intern
distribusjon eller TestFlight).

## Bygg-økonomi (REGEL)

Sky-bygg er **knappe**: ~15 iOS-bygg/mnd på fri plan, **reset den 1. i måneden**. Før **HVERT** sky-bygg:

1. **Sjekk gjenstående kvote** — `eas build:list --platform ios` eller Expo-dashboard. ⚠️ Disse viser **antall brukte bygg, IKKE dager til reset** — regn dager selv fra bygg-loggen under (reset = 1. i mnd).
2. **Bekreft med Kenneth** — et sky-bygg er en beslutning, ikke en refleks.
3. **Kun TestFlight-leveranser**, aldri iterasjon — kode/Azure/docs skal være verifisert klar først.
4. **Lokale bygg er blindvei** i dette monorepoet (se babel-noten under § Fallgruver) — ikke bruk dem for å spare kvote.

### Bygg-logg (reset 1. i mnd — oppdateres ved HVERT sky-bygg)

| Mnd | Brukt | Bygg |
|-----|-------|------|
| Juli 2026 | 4 av ~15 (**~11 igjen, reset 1. aug**, bekreftet mot `eas build:list --platform ios` 15.07) | #37 (`496b6a63`, `bc744f82`, 01.07, production, finished) — mobil-MS + F-G. #38 (`a61b924a`, `d1b96cd5`, 11.07→13.07, production, finished) — F4-serien (identitetsforsoning + attestering-deadlock + synk-robusthet). #39 (`47c22b1a`, `cd3efcb5`, 13.07→14.07, production, finished) — S-A tombstone-klient + del 6 (F-b/F-e/F-f/F-g) + footer. **#40 (`15a47804`, `43299d03`, 15.07, production, finished)** — timer F2/F3/F5 (byggeplass per rad + matpause-bærer) + edge #1 → TestFlight |

> ⚠️ **Nummererings-rettelse 2026-07-15:** raden over kalte tidligere `47c22b1a`/`cd3efcb5` for «#38» — `eas build:list` sier at det er **#39**, og det ekte #38 (`a61b924a`/`d1b96cd5`, F4-serien) var aldri logget. Derfor viste telleren 2 der fasit var 3. **Regel:** bygg-nummer leses fra `eas build:list`-feltet «Build number», aldri fra hukommelse eller antatt rekkefølge — build-ID og bygg-nummer er to forskjellige ting.
>
> ⚠️ **Submit-felle (#40, 2026-07-15):** `eas build` autoIncrement teller mot **EAS' egne** byggrecords, ikke App Store Connect. Ligger det et bygg-nummer i ASC som EAS ikke kjenner, kolliderer submit: «Build number N for app version X has already been used» — feiler raskt (~400 ms) på «Creating Build Upload», IKKE en outage-timeout selv om statusbanneret sier «High submission times». Bygget er intakt ved slik feil; en ny submit koster ingen byggkvote. Sjekk ASC → Builds → iOS (ikke TestFlight-gruppevisningen, som skjuler uprosesserte bygg) før du vurderer rebuild.

**#38-merknad:** bygget fra **`SiteDoc-develop`** (ikke SiteDoc-deploy — deploy-worktreet mangler `node_modules`, som ga prompt-flom + `expo-modules-autolinking`-feil; lærdom: EAS-bygg må kjøres fra et worktree med installerte deps). `cd3efcb5` == main-innhold (prod-server deployet samme kode via `f888fecc` 13.07). Sveipet inn hele develop-batchen (inkl. evt. tidligere køede ②/③ hvis merget før `cd3efcb5`). **Neste batch (kø):** det som lander på develop ETTER `cd3efcb5`. Fyres samlet ved neste TestFlight-leveranse (kvote-bevisst).

## Profiler (`apps/mobile/eas.json`)

| Profil | `EXPO_PUBLIC_API_URL` | Bruk |
|--------|----------------------|------|
| `development` | api.sitedoc.no (prod) | dev-client |
| `preview` | api.sitedoc.no (prod) | intern prod-preview |
| **`test`** | **api-test.sitedoc.no** | **enhet-verifisering MOT TEST før prod** (lagt til 2026-06-12) |
| `production` | api.sitedoc.no (prod) | TestFlight prod-release |

> ⚠️ **Standard-profilene peker på PROD.** For å verifisere en feature som ligger på
> develop/test (ikke prod ennå), MÅ du bygge med `test`-profilen — ellers snakker appen med
> prod der feature-endepunktene ikke finnes, og du tester ingenting. Test-først-prinsippet
> gjelder også på mobil.

**Env-presedens:** Hvis en variabel er definert i både build-profilens `env` OG et EAS-hostet
«environment», **vinner build-profilens verdi**. (EAS skriver «Resolved 'preview' environment»
selv for test-profilen — det er ufarlig, override-noten bekrefter at test-verdien brukes.)

> **Microsoft-innlogging (mobil):** `EXPO_PUBLIC_MICROSOFT_CLIENT_ID` = `234ca0e0-afd1-48e3-9736-b904d4b5a008`
> (dedikert Entra public-client «SiteDoc Mobile») på alle fire profiler. Var `"disabled"` til 2026-06-26 →
> mobil-MS feilet for alle (knappen vist, men client-id ugyldig). Client-id er offentlig (ikke secret).
> MS-knappen skjules automatisk hvis verdien er `""`/`"disabled"` (`erMicrosoftKonfigurert`). Flyt =
> authorization code + PKCE. Krever Azure-oppsett (redirect `sitedoc://auth`, public client flows,
> Graph-scopes) — se [infrastruktur.md § Auth-konfigurasjon](infrastruktur.md). Mobil-MS virker først
> etter et **nytt EAS-bygg** (env bakes inn ved byggetid); production-bygg lages fra `main`.

## Apple-auth — KRITISK: bruk API-nøkkel, ikke passord

**2FA-fellen:** Med tofaktor (som alle utvikler-kontoer har) gir Apple-ID + passord-flyten
(fastlane, som EAS bruker) meldingen **«Invalid username and password combination» selv når
passordet er HELT riktig.** Det er ikke passordet — fastlane håndterer ikke 2FA i denne flyten.
**Ikke kast bort tid på passordet. App-spesifikt passord hjelper ofte heller ikke.**

**Løsningen — App Store Connect API-nøkkel (ingen passord, ingen 2FA):**

1. **Generer nøkkel:** appstoreconnect.apple.com → **Users and Access** → fanen
   **Integrations** (eller **Keys**) → **App Store Connect API** → **Generate API Key** →
   rolle **App Manager** → Generate.
2. **Last ned `.p8`-fila** — kan **KUN lastes ned én gang**. Lagre den trygt
   (f.eks. `~/Downloads/AuthKey_XXXX.p8` → flytt til et fast sted).
3. Noter **Key ID** (ved nøkkelen) + **Issuer ID** (øverst på Keys-siden).

**Bruk via miljøvariabler** (gjelder KUN den terminal-økta du setter dem i):
```bash
export EXPO_ASC_API_KEY_PATH="$HOME/sti/til/AuthKey_DINKEY.p8"
export EXPO_ASC_KEY_ID="DIN_KEY_ID"
export EXPO_ASC_ISSUER_ID="DIN_ISSUER_ID"
export EXPO_APPLE_TEAM_ID="WVFPRZ8T98"
export EXPO_APPLE_TEAM_TYPE="INDIVIDUAL"
```
Når disse er satt, autentiserer EAS med nøkkelen. Tegn på at det funker: linja
*«Skipping capability identifier syncing because the current Apple authentication session is
not using Cookies (username/password)»* — da brukes API-nøkkelen.

**Gjør det permanent** (slipp å sette env hver gang):
- Enklest: lim de 5 `export`-linjene inn i `~/.zshrc`.
- Renest: legg nøkkelen i `eas.json` (`ascApiKeyPath` / `ascApiKeyId` / `ascApiKeyIssuerId`),
  eller lagre via `eas credentials`.

## Lagrede credentials (gjenbrukes automatisk — ligger på EAS)

| Credential | Verdi | Merknad |
|-----------|-------|---------|
| Bundle ID | `com.kemyrhau.sitedoc` | |
| Apple Team | `WVFPRZ8T98` (Kenneth Myrhaug, **Individual**) | |
| Distribusjons-sertifikat | Cert ID `7YWA2DMGT2` | utløper 2027-03-06 |
| Provisioning-profil | aktiv | ad-hoc, knyttet til registrerte enheter |

Disse spør EAS om å **gjenbruke** ved hvert bygg → svar `Y`. Apple begrenser antall
sertifikater, så ALLTID gjenbruk, aldri lag nytt uten grunn.

## Enhet-registrering (intern/ad-hoc distribusjon)

`distribution: internal` krever at enhetens **UDID** ligger i provisioning-profilen. Første gang:
`eas build` spør «register devices now?» → `Y` → velg **Website** → den gir URL + QR.
På iPhone-en du skal teste på: skann/åpne → last ned profil → **Innstillinger → Generelt →
VPN og enhetsadministrasjon → installer**. Velg så enheten i terminalen (`◉` + Enter).

Registrert enhet (2026-06-12): iPhone `00008140-000A40280EFB001C`.
Ny enhet senere = bare gjenta registreringen for den.

## Bygg-kommando

```bash
cd apps/mobile && eas build --platform ios --profile test
```
- «Do you want to log in to your Apple account?» → **`n`** (env-nøkkelen brukes).
- Maser den om passord likevel → env-variablene mangler i økta. Sett dem, ev. legg til
  `--non-interactive` for å tvinge nøkkel-veien (feiler tydelig i stedet for å spørre).

Bygget legges i kø (~15–30 min) → du får en build-URL. Når ferdig: installer på enhet
(intern distribusjon-lenke), eller `eas submit --platform ios --latest` til TestFlight.

## Automatisert bygg (.env + wrapper) — slipp å sette env hver gang

For å unngå å eksportere ASC-nøkkel-variablene manuelt i hvert nytt terminalvindu finnes en
wrapper: **`apps/mobile/eas-build.sh`**.

1. **Opprett `apps/mobile/.env.eas.local`** (én gang) med de fem credential-variablene:
   ```bash
   EXPO_ASC_API_KEY_PATH=/Users/<bruker>/sti/AuthKey_DINKEY.p8
   EXPO_ASC_KEY_ID=DIN_KEY_ID
   EXPO_ASC_ISSUER_ID=DIN_ISSUER_ID
   EXPO_APPLE_TEAM_ID=WVFPRZ8T98
   EXPO_APPLE_TEAM_TYPE=INDIVIDUAL
   ```
2. **Kjør wrapperen:**
   ```bash
   cd apps/mobile && ./eas-build.sh          # profil "test" (default)
   ./eas-build.sh preview                     # annen profil
   ```
   Scriptet `source`-er `.env.eas.local` (`set -a` → env eksporteres) og kjører
   `eas build --platform ios --profile <profil>`. Apple-login-prompt → API-nøkkelen brukes
   automatisk (svar `n` om den spør).

> 🔒 **`.env.eas.local` committes ALDRI** — den inneholder Apple-credentials. Den er git-ignorert
> både av rot-`.gitignore` (`.env.*.local`) og eksplisitt av `apps/mobile/.gitignore`. Verifisér
> ved tvil: `git check-ignore -v apps/mobile/.env.eas.local` skal returnere en treff-linje.

## App variants — test + prod side om side (implementert 2026-06-12)

**Problem (oppdaget 2026-06-12):** Test-bygget (Expo intern distribusjon, mot api-test) og
prod-bygget (TestFlight, mot prod) har **samme bundle-ID** (`com.kemyrhau.sitedoc`). iOS tillater
ikke to apper med samme ID samtidig → å installere den ene erstatter den andre. Du må slette/
reinstallere for å bytte. Tungvint.

**Løsning — gi test-bygget eget bundle-ID + navn** så de sameksisterer:

1. **`app.json` beholdes som statisk base** + ny **`apps/mobile/app.config.js`** (dynamisk config
   som utvider basen via `config`-parameteren Expo sender inn, og overstyrer KUN på `APP_VARIANT`):
   ```js
   module.exports = ({ config }) => {
     const erTest = process.env.APP_VARIANT === "test";
     return {
       ...config,
       name: erTest ? "SiteDoc TEST" : config.name,
       ios: {
         ...config.ios,
         bundleIdentifier: erTest ? "com.kemyrhau.sitedoc.test" : config.ios.bundleIdentifier,
       },
     };
   };
   ```
   Kun `name` + `ios.bundleIdentifier` er betinget — alt annet arves fra `app.json` (ingen
   duplisering).
2. **`eas.json`** — `"APP_VARIANT": "test"` ligger i `test`-profilens `env`-blokk.
3. **Bygg på nytt** med `test`-profilen. Det nye bundle-ID-et (`...sitedoc.test`) trenger ny
   provisioning-profil — men **API-nøkkelen ordner det uten passord** (registrerer ID + lager
   ad-hoc-profil med den allerede registrerte enheten).

Resultat: «SiteDoc TEST» installeres som **egen app** ved siden av prod-«SiteDoc». Ingen bytting.

> ⚠️ **`scheme` ("sitedoc") og `android.package` holdes BEVISST DELT.** `auth.ts:84` hardkoder
> `makeRedirectUri({ scheme: "sitedoc" })`, så å gjøre scheme betinget ville brutt test-OAuth.
> Full scheme-separasjon (app.json + `auth.ts:84` + Google `sitedoc-test://`-registrering) er en
> egen senere oppfølger — se [BACKLOG.md](BACKLOG.md). Praktisk konsekvens nå: ikke kjør OAuth i
> begge apper «samtidig» (iOS-udefinert hvilken app som fanger redirect på delt scheme).
> Eget test-ikon (lettere å skille på hjemskjerm) er valgfritt, ikke gjort nå.

## Fallgruver (lærdom 2026-06-12)

- **«Invalid username and password» = 2FA, ikke feil passord.** Bruk API-nøkkel.
- **Env-variabler er økt-spesifikke** — borte i nytt terminalvindu.
- **Eksisterende API-nøkkels `.p8` kan ikke lastes ned på nytt** — generer en ny om du mangler den.
- **`eas-cli` utdatert** → `npm install -g eas-cli`. Eldre CLI tilbyr API-nøkkel kun for *submit*,
  ikke build — env-variabel-veien fungerer uansett.
- **Apple-login er «optional», MEN intern distribusjon krever credential-tilgang** (API-nøkkel
  eller passord) for å lage/oppdatere ad-hoc-profilen med enheten.
- **Lokale iOS-bygg (`eas build --local`) er BLINDVEI i dette pnpm-monorepoet (lærdom 2026-06-26 → 2026-07-01).**
  Symptomet starter som `Cannot find module 'babel-preset-expo'`: babel resolver preset-strenger via
  node-resolusjon fra `babel.config.js` (apps/mobile), IKKE via Metros `nodeModulesPaths`; preset-en er
  kun transitiv under `expo` → ikke symlinket i `apps/mobile/node_modules` (sky-EAS har annen hoisting →
  virker der). **`babel-preset-expo`-fiksen** (direkte devDep `~54.0.10` + `require.resolve` i
  `babel.config.js`, committet `458bc674`) løser **den ene** feilen — men lokale bygg **kaskader videre**:
  neste feil er `@babel/plugin-transform-react-jsx`, deretter ~20 andre transitivt-hoistede pakker babel/
  Metro ikke finner lokalt. Dette er **klassefeilen** ved lokal pnpm-hoisting, ikke enkeltpakker. Ekte
  klasse-fiks ville vært `.npmrc node-linker=hoisted` (flat node_modules som npm) — men **uverifisert mot
  sky-bygget** og en install-topologi-hammer som treffer hele workspacet. **Konklusjon: bruk SKY-bygg for
  iOS.** Ikke jag lokale bygg videre — hver ny «fant ikke modul X» er samme klasse. (`babel-preset-expo`-
  fiksen beholdes uansett — den er riktig for sky + dev og ufarlig.)

## Se også

- [infrastruktur.md § EAS Build og TestFlight](infrastruktur.md) — kort prod-release-prosedyre.
- [deploy-detaljer.md § Mobil reload-typer](deploy-detaljer.md) — når kreves EAS vs hot reload.
