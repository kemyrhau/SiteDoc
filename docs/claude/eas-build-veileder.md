---
name: eas-build-veileder
status: aktiv
sist_verifisert_mot_kode: 2026-09-04
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

### 🔴 FØR HVERT BYGG: sammenlign env-variabler i kode mot profil (30 sekunder, sparer bygg)

**Lærdom 2026-08-17 — cowork brukte tre bygg som diagnoseverktøy for noe én grep avslørte.**
Kjør dette før du fyrer:

```bash
cd <repo>
echo "=== koden leser ==="
grep -rhoE "EXPO_PUBLIC_[A-Z_]+" apps/mobile/src | sort -u
echo "=== profilen setter ==="
python3 -c "import json;print('\n'.join(sorted(json.load(open('apps/mobile/eas.json'))['build']['<profil>']['env'].keys())))"
cd apps/mobile && eas env:list --environment preview   # test-profilen laster preview
```

Differansen er en variabel appen leser som tom streng. **Symptomet er ikke en tydelig feil** —
det blir en 401, en 404 eller en tom skjerm langt inne i appen, og det koster et bygg å oppdage.

🔴 **PRESISERT 2026-09-02 — differansen mot `eas env:list` er TRE på production, ikke to.**

**Kilden bygget faktisk bruker er `apps/mobile/eas.json` → `build.<profil>.env`**, ikke EAS' env-lager.
`build.production.env` (linje 60-65) setter **alle fire**: `API_URL`, `GOOGLE_CLIENT_ID`,
`GOOGLE_IOS_CLIENT_ID` og **`MICROSOFT_CLIENT_ID`**.

⚠️ **`EXPO_PUBLIC_MICROSOFT_CLIENT_ID` finnes KUN i `eas.json`, aldri i env-lageret.** Sammenligner
du kodens behov mot `eas env:list --environment production`, mangler den — og det er **ikke** en
feil. Cowork stoppet et bygg på det 2026-09-02 før `eas.json` var lest.

**Riktig sjekk: sammenlign mot `eas.json`-profilen, ikke mot env-lageret:**

```sh
grep -rhoE "EXPO_PUBLIC_[A-Z_]+" apps/mobile/src | sort -u        # hva koden trenger
sed -n '/"production": {/,/}/p' apps/mobile/eas.json              # hva bygget får
```

Env-lageret er en **delvis overlappende** kilde og duger ikke alene som gate.

Den opprinnelige formuleringen under gjelder fortsatt for de to dev-login-variablene:

🔴 **På `production` skal `ENABLE_TEST_LOGIN` og `DEV_LOGIN_SECRET` mangle, og det er RIKTIG** (målt 2026-08-31).
`EXPO_PUBLIC_ENABLE_TEST_LOGIN` og `EXPO_PUBLIC_DEV_LOGIN_SECRET` skal **ikke** finnes der:
`auth.ts:19` er `=== "true"`, så fravær gir `false` og slår av test-innlogging i prod, og
`devLoginSecret` faller til `""` i en sti som da er avslått. `test`-profilen har flagget
(det var fiksen 17.08); `production` skal ikke ha det.

**Sjekken er altså laget for test-profilen.** På production betyr «tom differanse» at noe er
galt, ikke omvendt. Cowork var 2026-08-31 i ferd med å stoppe et bygg på denne differansen —
mål hvordan variabelen LESES før du kaller den en mangel.

Konkret utslag 2026-08-17: koden leste seks variabler, test-profilen satte fem.
`EXPO_PUBLIC_DEV_LOGIN_SECRET` manglet → dev-login ga 401
`DEV_LOGIN_SECRET_MANGLER_ELLER_FEIL` selv om serveren var korrekt satt opp.
Løsning: `eas env:set --environment preview` (ikke `eas.json` — den er committet).

⚠️ **`EXPO_PUBLIC_*` bakes inn ved kompilering.** En variabel satt etter at bygget startet,
krever nytt bygg. Verifiser med `eas env:list` **før** du bygger, ikke etter.

### Bygg-logg (reset 1. i mnd — oppdateres ved HVERT sky-bygg)

| Mnd | Brukt | Bygg |
|-----|-------|------|
| **September 2026** | **Les tellingen fra `eas build:list` — denne raden er en logg, ikke en fasit.** **#54** (04.09, production — fyrt etter at `runtimeVersion` ble eksplisitt; innhold: alle seks bygg-50-funn + expo-updates + galleri-flervalg + kø-robusthet + vedlegg-forsvinner + repeater-traversering, prod-deployet `4eb05f73` som forutsetning). 🔴 **#53 (04.09 12:05, ERRORED i «Configure expo-updates»)** — fingerprint-mismatch: lokalt `5cb93609…`, EAS `a09f46b8…`, og EAS' diff-seksjon var **tom**. 🔴 **#52 (04.09 11:20, ERRORED i samme fase)** — lokalt `file:fingerprint` (plassholder: `@expo/fingerprint` kunne ikke resolves fra `apps/mobile` i pnpm-treet; rettet i `3aca2d5a`). **Begge feilet FØR selve bygget** (~2 min hver, «Errored» i `eas build:list`) — om errored bygg teller mot kvoten er ikke verifisert. **Rotårsak og vedtak: se § OTA → runtimeVersion.** 🔴 **#51 var `preview`-bygget, IKKE et produksjonsbygg** (`9a69bf7`, 03.09, «iOS internal distribution build», profil `preview`, Runtime `None`, Channel `None` — verifisert mot `eas build:list` 04.09). **Konsekvens: de seks funnene fra bygg 50 nådde ALDRI testerne før #54.** Cowork skrev flere ganger 03.–04.09 at «bygg 51 er ute hos testerne» og førte det slik i tavla — det var galt, og feilen ble først fanget da Kenneth viste EAS-lista. **Samme feilklasse som 31.08** («bygg 47 er hos testerne» etter at 48 var fyrt): byggnummer og profil leses fra `eas build:list`, aldri fra hukommelsen om hva som ble startet. **#50** (build-id `28f117a8`, **commit `da0f0181`** — develop-tip, ikke main; koden er lik `af49823f` bortsett fra docs. 02.09 23:43, production, finished → TestFlight 03.09). ⚠️ **Innsendingen sto «in queue» i EAS over natta** — det er gratisplanens kø, ikke en feil. `Ctrl+C` avbryter ikke: innsendingen kjører serverside. Til sammenligning tok #47 seksten sekunder og #48 tjuesju minutter. 🔴 **Byggnummer 49 ble brukt opp av et avbrutt forsøk** (feil valg på «Apple Team Type» → Enterprise i stedet for Individual); ingen artefakt, derfor ingen 49 i ASC. Fyrt etter prod-release `af49823f` (132 commits) — `modul.effektivTilstand` var den ene harde server-avhengigheten, og den måtte i prod FØR bygget. **Første bygg der hele settet var verifisert på simulator på forhånd** (røykliste 15/15 + målepunkt 13b, kvalitetssikringsplanens lag 2 slik den var tenkt). Innhold: tegningsminne i repeater (flyt 3: 7→4 trykk) · repeater arver tegning fra rad n−1 (5→0 trykk på rad 3) · «Hele prosjektet»-utvei i byggeplass-chip · modulgating av Timer m/fail-open · lokasjonsparitet · deaktiverte knapper forklarer seg · i18n rapportobjekter + tegningsvelger (72 nøkler × 15 språk) · HMS-terminologi pl/lt/sq med bransjekontekst. 🔴 **Nummeret ble 50, ikke 49** — `appVersionSource: "remote"` har egen teller som lå på 49; cowork gjettet fra siste *ferdige* bygg (48) + 1. **Les nummeret, ikke regn det ut.** |
| **August 2026 — RETTET 2026-08-31 (var 12/11)** | **14 bygg, 13 tellende** (~2 igjen, reset 1. sept). 🔴 **#47 (31.08 12:57)** — tegningsposisjon-fella lukket (`0101bd25`); **innførte tekstfelt-regresjonen** via de sju `SafeAreaView`-importbyttene. 🔴 **#48 (31.08 17:42)** — `ModalFlate` + lint-vakt (`b852c2ea`), rettet regresjonen fra 47. **Cowork sa «bygg 47 er hos testerne» gjentatte ganger etter at 48 var fyrt** — Kenneth fanget det på ASC-skjermbildet. Bygg-nummer leses fra `eas build:list` eller App Store Connect, aldri fra hukommelse. Tidligere rad (før #47/#48): ⚠️ Raden sa tidligere «7 av ~15» — den var ført fra hukommelse og manglet **tre** test-bygg 17.–18.08 (`9d7d869f`, `dca69ffe`, `9942f178`). Samme feilklasse som nummererings-rettelsen 15.07. **Regel: tellingen leses fra `eas build:list`, aldri fra denne raden.** · **#46 (`5605775d`, 28.08, production, finished, 5m27s → TestFlight)** — første bygg etter prod-releasen `5dcdeb58`: H8-tegningsvelger, H1 HMS-behandling fra mobil, annoterings-JPEG (var 3,4 MB PNG — pilot-blokkeren), D3 aktivitetsfordeling i «Mine timer», D4 slettepropagering, og opprett-frysen (fire runder: `a29f89b2` → `df86b817` → `d4a76020` → `28e55ed5`; den fjerde traff fordi premisset «Fabric rendrer `<Modal>` inline» ble motbevist av en grabber i skjermbildet). Git ref viste `5605775*` — asterisken var én ucommittet docs-fil, ingen effekt på bundelen. Historikk under: | **#43** (`6d9a7c91`, 08.08, production) · **#44** (`9ee8242c`, 09.08, production) — begge før mobil-vinduet under. **17.–19.08, fem bygg på tre dager, alle for å jage samme frys:** `c88e160f` (17.08, test, **errored** — CocoaPods CDN 429, EAS-infra, *«does not count towards usage»*) · `1bfd3b53` (17.08, test, finished — dev-login 401, `EXPO_PUBLIC_DEV_LOGIN_SECRET` manglet i EAS) · `4c06948` (18.08, test) · `30825449` (19.08 13:23, test) · `0d9550cd` (19.08 16:54, test) · **#45 (`d2d25b03`, `8fdd82bc`, 19.08 19:38, production, finished, 6m49s → TestFlight)** — frys-fiks (modal-livssyklus under Fabric), lokasjonsvelger m/ortofoto + pin-treff, bilde-URL-fiks, OppgaveModal krasj-guard, georef-punkter skjult, dokumentflyt-auto-utledning (`templates`→`maler`, brutt siden 06.03), værsnapshot, `bildeNr` ved opptak, arkiv-PDF fase 1, `harAktivLocation`. **Lærdom: fire av byggene gikk til feilsøking, ikke verifisering** — se § FØR HVERT BYGG (env-diff) og § transient CocoaPods 429 |
| Juli 2026 | 5 av ~15 (**~10 igjen, reset 1. aug**; #37-#40 bekreftet mot `eas build:list` 15.07, #41 lagt til 31.07) | #37 (`496b6a63`, `bc744f82`, 01.07, production, finished) — mobil-MS + F-G. #38 (`a61b924a`, `d1b96cd5`, 11.07→13.07, production, finished) — F4-serien (identitetsforsoning + attestering-deadlock + synk-robusthet). #39 (`47c22b1a`, `cd3efcb5`, 13.07→14.07, production, finished) — S-A tombstone-klient + del 6 (F-b/F-e/F-f/F-g) + footer. #40 (`15a47804`, `43299d03`, 15.07, production, finished) — timer F2/F3/F5 (byggeplass per rad + matpause-bærer) + edge #1 → TestFlight. **#41 (fingerprint `593d25c`, `88ce430`, 31.07, TEST-profil, internal distribution, finished, 5m18s)** — mobil-arbeid på develop: P4a iOS-modal + KB2-opprett-flyt-fiks + M4 Avbryt-sweep + M1-M3 detalj-redesign + mobil-typecheck-grønn + PSI-navnefiks → «SiteDoc TEST» mot api-test for **enhet-verifisering** (IKKE TestFlight/prod). Bygg-nr verifiseres mot `eas build:list` ved neste anledning |

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

> 🔴 **IKKE legg `EXPO_APPLE_TEAM_ID`/`EXPO_APPLE_TEAM_TYPE` i `~/.zshrc` (lærdom 43→44, gjentatt 2026-08-16).**
> EAS har credentials lagret på serveren («Using remote iOS credentials (Expo server)»), og de
> eksplisitte variablene **overstyrer** dem. Bygg 43 feilet to ganger på dette: først
> `Invalid Apple Team Type: INDIVIDUALexport` (manglende linjeskift mellom to `export`-linjer i
> `.zshrc:17`), deretter Apple 403 «This provider does not exist» da de nå korrekt parsede
> variablene ble sendt i stedet for EAS' lagrede. Bygg 44 gikk gjennom **uten** dem.
>
> Samme feil traff igjen 2026-08-16 fordi denne seksjonen anbefalte `.zshrc`-veien mens
> [STATUS-AKTUELT.md](STATUS-AKTUELT.md) dokumenterte at den feilet. **Verdien `INDIVIDUAL` er
> riktig — problemet er at variabelen settes i det hele tatt.**
>
> Trenger du dem for en engangs-operasjon, sett dem i den ene terminal-økta (blokka over), aldri
> permanent. Wrapper-veien under (`.env.eas.local` + `eas-build.sh`) har samme risiko og skal kun
> brukes hvis EAS' lagrede credentials mangler.

### 🟡 Transient: «Install pods» feiler med CocoaPods CDN 429 (2026-08-16)

Symptom i CLI: `iOS build failed: Unknown error. See logs of the Install pods build phase`.
I loggen står den ekte årsaken:

```
[!] CDN: trunk URL couldn't be downloaded: https://raw.githubusercontent.com/CocoaPods/Specs/.../libwebp.podspec.json
    Response: 429 429: Too Many Requests
pod install exited with non-zero code: 1
```

CocoaPods' CDN faller tilbake til `raw.githubusercontent.com`, og GitHub rate-limiter.
**Ikke en feil i repoet — ikke feilsøk `Podfile.lock`, native deps eller fingerprint.**
Bare fyr på nytt; er grensen fortsatt varm, vent ~20 min.

⚠️ **Kvote:** EAS merker slike bygg «This build does not count towards your EAS Build usage»
— sjekk banneret øverst på bygg-siden før du fører det i bygg-loggen. Et bygg som feiler i
EAS' egen infrastruktur koster ingenting.

**Gjør det permanent** (slipp å sette env hver gang):
- ⚠️ Se advarselen over før du gjør dette — de to `EXPO_APPLE_*`-linjene skal IKKE inn i `~/.zshrc`.
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

   > 🔴 **Fila er gitignorert og finnes KUN i worktreet du opprettet den i.** Bytter du
   > arbeidstre — eller rydder et — stopper wrapperen med «Fant ikke .env.eas.local».
   > Skjedde 2026-08-23.
   >
   > **Kanonisk env-filkart (hvor `.p8` og de fem variablene bor, og hva som ikke kan
   > gjenopprettes): [infrastruktur.md § Miljøvariabler](infrastruktur.md).** Duplisér
   > ikke kartet hit — én kilde.
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

> 🔴 **Google-innlogging virker IKKE i test-bygget — og det er forventet (verifisert 2026-08-17).**
> `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` er den samme i test- og prod-profilen, men en Google
> **iOS**-OAuth-klient er bundet til **én** bundle-id. Klienten er registrert for
> `com.kemyrhau.sitedoc`, så forespørsler fra test-appens `com.kemyrhau.sitedoc.test` avvises —
> appen har en identitet klienten ikke kjenner. Delt `scheme` (noten over) løser redirect-veien,
> ikke klient-bindingen.
>
> **Innloggingsveien i test-bygget er dev-login**, ikke Google. Se
> [dev-login-agent.md](dev-login-agent.md) — husk at `EXPO_PUBLIC_DEV_LOGIN_SECRET` må ligge i
> EAS' `preview`-environment, ellers får du 401 `DEV_LOGIN_SECRET_MANGLER_ELLER_FEIL`.
>
> **Vil man ha Google i test likevel** (egen oppfølger, ikke gjort): ny iOS-OAuth-klient i Google
> Cloud Console for `com.kemyrhau.sitedoc.test` (additivt — prod-klienten røres ikke) ·
> `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` overstyres i test-profilen (klient-IDer er ikke hemmelige,
> så `eas.json` er greit) · URL scheme (reversed client ID) for test-varianten i `app.config` ·
> nytt bygg. Koster en Console-runde + ett bygg for en vei dev-login allerede dekker.

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

## OTA-oppdateringer (expo-updates) — JS-fikser uten nytt bygg

**Oppsett levert på branch `feat/expo-updates` (`app.config.js`, `apps/mobile/eas.json`,
`VersjonsFooter.tsx`, 2026-09-03).** Første faktiske `eas update` er Kenneths beslutning —
oppsettet gjør bare veien klar.

**Hvorfor:** 3. september kostet fem rene JavaScript-funn tre av ~15 månedlige iOS-bygg. Ingen
av dem trengte en ny binær — de trengte bare en vei til telefonen. `expo-updates` er den veien:
en publisert JS-bundel byttes ved neste oppstart, uten TestFlight-runde, også for testerne.

**Konfigurasjon (kode er fasit):**
- `runtimeVersion: "1"` (`app.config.js`) — **eksplisitt streng, IKKE `{ policy: "fingerprint" }`
  og IKKE `appVersion`.** Fingerprint-policy ble forsøkt og forkastet 2026-09-04 etter to feilede
  bygg (52 + 53): 42 av 50 kilder i avtrykket er pnpm-stier med peer-avhengighetshash i
  katalognavnet, og EAS kjører `pnpm install` i sitt eget miljø → lokalt og EAS-avtrykk matcher
  aldri. Fingerprint-policy og pnpm-monorepo er ikke kompatible. `appVersion` ble også forkastet
  (appen er `1.0.0` gjennom 53 bygg med skiftende native innhold → mismatch). Med eksplisitt streng
  ligger disiplinen hos oss: **strengen MÅ bumpes manuelt ved enhver native-endring** (se
  sjekklisten under). `@expo/fingerprint` beholdes som avhengighet for diagnostikk
  (`eas fingerprint:generate`), men policyen brukes ikke.
- `updates.fallbackToCacheTimeout: 0` + `checkAutomatically: "ON_LOAD"` — **offline-first er
  ufravikelig.** Appen starter alltid umiddelbart fra cachet bundle og henter en ev. oppdatering i
  bakgrunnen; ingen nett → oppstart som før, uten forsinkelse eller feilmelding.
- **Én kanal pr. `eas.json`-profil** (`development`/`preview`/`test`/`production`). En
  `preview`-oppdatering kan aldri nå et produksjonsbygg.
- `VersjonsFooter` viser kjørende `Updates.updateId` (7 tegn) ved siden av byggets commit — når
  JS-en er nyere enn binæren, lyver commit-hashen alene.

**Datalaget er urørt:** `expo-updates` lagrer bundler i egen intern katalog, aldri
`documentDirectory` der SQLite, opplastingskøen og SecureStore bor.

### 🔴 Hva som IKKE kan sendes som oppdatering (den avgjørende grensen)

Tror vi noe er ute når det ikke er det, er vi tilbake i feilklassen fra 3. september. Alt som
rører **native laget** krever nytt bygg **og en `runtimeVersion`-bump** (se sjekklisten under) —
uten bump kan en JS-oppdatering lande på en binær den ikke passer til:

- Ny/fjernet/oppgradert native modul (expo-camera, expo-sqlite, react-native-webview, expo-location …)
- Native config i `app.json`/`app.config.js`: `permissions`, `plugins`, `bundleIdentifier`,
  Info.plist/entitlements, ikon/splash, `scheme`
- Expo SDK-oppgradering, native versjonsbump, nye native tillatelser

**Kan** sendes OTA: ren JS/TS, React-komponenter, forretningslogikk, styling, i18n-strenger,
JS-refererte assets.

### 🔴 `runtimeVersion`-bump — sjekkliste før hvert bygg

`runtimeVersion` er en fast streng (`"1"`) vi styrer selv. **Bump den (`"1"` → `"2"` → …) i
`app.config.js` FØR bygg dersom noe av dette er endret siden forrige bygg.** En glemt bump betyr
at en OTA JS-oppdatering kan lande på en binær den ikke passer til.

- [ ] Ny/fjernet/oppgradert native modul (expo-camera, expo-sqlite, react-native-webview, expo-location …)
- [ ] Endret `plugins` i `app.json`/`app.config.js`
- [ ] Endret `infoPlist` / entitlements
- [ ] Endret `permissions`
- [ ] Endret `bundleIdentifier`
- [ ] Endret ikon eller splash
- [ ] Endret `scheme`
- [ ] Expo SDK-oppgradering (eller native versjonsbump)

Kun JS/TS/styling/i18n endret → **ikke bump** (da er hele poenget at OTA når den eksisterende
binæren). Bump ↔ nytt bygg går hånd i hånd: bumper du, MÅ du bygge; bygger du med native-endring,
MÅ du ha bumpet.

### Ikraftsetting, tilbakerulling, grenser

- **Trer i kraft:** ett nytt bygg **pr. kanal** du vil OTA-e til. En oppdatering lander bare på en
  binær bygget *etter* dette oppsettet (den må inneholde expo-updates-runtimen + matchende
  `runtimeVersion`). Eksisterende bygg 51 kan **ikke** motta oppdateringer.
- **Tilbakerulling:** `eas update:rollback` / republiser forrige gode update til kanalen. En bruker
  som alt har hentet den dårlige: sjekker ved neste oppstart, henter rettelsen i bakgrunnen,
  **anvender den ved oppstarten etter** — typisk to oppstarter. Faresone: en oppdatering som
  krasjer *før* sjekken rekker å anvende rettelsen, blir stående (starter fra cachet dårlig bundel).
  Derfor: test på `preview`/`test`-kanal først.
- **Gratisplan:** ~50 brukere (A.Markussen-piloten) er komfortabelt innenfor. Gratis har historisk
  ~1 000 MAU + båndbredde-tak — **verifiser gjeldende tall på expo.dev/pricing før pilot.**

## Se også

- [infrastruktur.md § EAS Build og TestFlight](infrastruktur.md) — kort prod-release-prosedyre.
- [deploy-detaljer.md § Mobil reload-typer](deploy-detaljer.md) — når kreves EAS vs hot reload.
