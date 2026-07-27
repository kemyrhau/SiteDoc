# E2E-røyksuite (Playwright → test.sitedoc.no)

Liten, streng regresjonssuite for dokumentflyten (sjekkliste). Kjører headless
mot **test.sitedoc.no**, autentisert via **dev-login-token** — ingen OAuth, ingen
deling av en ekte Chrome (eliminerer debugger-kollisjon + stale-økt).

Regressjonene her eies av suiten; Chrome-Opus-klikktester reserveres til nye/
utforskende flater. Kvalitet foran bredde: **hvis en test flaker, fikses eller
fjernes den samme dag** — suiten skal være troverdig eller ikke finnes.

## Hva testes (7 røyk-tester)

| # | Fil | Sjekker |
|---|-----|---------|
| 1 | `01-login` | dev-login-token → dashbord/prosjekt laster |
| 2 | `02-opprett` | opprett via UI → status **Utkast** (`draft`) |
| 3 | `03-send` | Send → kollaps til **Mottatt** (`received`) |
| 4 | `04-flytposisjon` | flyt-header rendrer FULL ledd-rad, aktiv boks = ball-holder (byggLedd-vern) |
| 5 | `05-besvar-godkjenn` | Besvar → `responded` (utfører) · Godkjenn → `approved` (godkjenner) |
| 6 | `06-videresend-rolle` | Videresend synlig for admin, skjult for menig utfører (H3-vern) |
| 7 | `07-gjenapne` | Gjenåpne fra `closed` → `draft` |

Statusassertene leser `data-status` på status-pillen (perspektiv-uavhengig).
Handlingsknapper og flyt-ledd har `data-testid` (additive, se diff).

## Engangs-oppsett

### 1. Seed testdata (kjøres av Kenneth mot `sitedoc_test`)

Én gang, på server-ny (test-DB er ikke direkte nåbar fra Mac). Idempotent:

```bash
DATABASE_URL=<sitedoc_test> pnpm --filter @sitedoc/db exec tsx scripts/seed-testbrukere.ts
DATABASE_URL=<sitedoc_test> pnpm --filter @sitedoc/db exec tsx scripts/seed-e2e-flyt.ts
```

`seed-e2e-flyt.ts` bygger en flyt på `Agent-testprosjekt` (AGENT-TEST-0001):
faggrupper (E2E Bestiller/Utfører), mal (`E2E Sjekklistemal`), og en 3-ledds
flyt registrator(firma) → utfører(arbeider) → godkjenner(firma).

### 2. Hemmelighet (gitignored, aldri i git)

```bash
cp tests/e2e/.env.local.example tests/e2e/.env.local
# fyll inn DEV_LOGIN_SECRET = samme verdi som på sitedoc-test-api
```

### 3. Installer Playwright-nettleser (én gang)

```bash
pnpm e2e:install
```

### 4. Deploy web til test

`data-testid`-ene ligger i web/ui-komponenter og må være deployet til
test.sitedoc.no før suiten er grønn (`./deploy-test.sh` + docker build).

## Kjøre

```bash
pnpm e2e                 # hele suiten headless
pnpm --filter @sitedoc/e2e run e2e:headed   # med nettleser
pnpm --filter @sitedoc/e2e run e2e:report   # HTML-rapport etter kjøring
```

## Hvordan det henger sammen

- **`global-setup.ts`** minter session-tokens via `POST /dev-login` (secret-gated)
  for firma/arbeider/admin, skriver `storageState`-cookies (`.auth/`), og slår
  opp flyt-/mal-IDer fra agentprosjektet → `.runtime.json`.
- **Testene** setter opp forutsetning via tRPC-API (rask, isolert) og gjør den
  **asserterte** handlingen i UI. Dokumenter får tittel-prefiks `E2E-<runId>`.
- **`global-teardown.ts`** soft-sletter (`deletedAt`) alle dokumenter denne
  kjøringen laget (via `sjekkliste.slett`, best-effort). ALDRI mot prod.

Roller: **firma** = prosjektadmin (driver), **arbeider** = menig utfører
(rolle-tester). Alt kjører serielt (`workers: 1`) mot delt test-DB, `retries: 0`.

## Flake-policy

`retries: 0` — ingen retry maskerer ustabilitet. En flaky test skal fikses eller
fjernes samme dag. Ny test legges i `tests/NN-navn.spec.ts` med `data-testid`-
kroker (ikke tekstavhengige selektorer der i18n kan variere).

## Sikkerhet

`.env.local`, `.auth/` og `.runtime.json` er gitignored — hemmelighet og tokens
havner aldri i git. Dev-login er 404 i prod (fail-secure). Suiten kjører kun mot
test-miljøet.
