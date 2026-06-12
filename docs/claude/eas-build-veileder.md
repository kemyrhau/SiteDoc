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

## Se også

- [infrastruktur.md § EAS Build og TestFlight](infrastruktur.md) — kort prod-release-prosedyre.
- [deploy-detaljer.md § Mobil reload-typer](deploy-detaljer.md) — når kreves EAS vs hot reload.
