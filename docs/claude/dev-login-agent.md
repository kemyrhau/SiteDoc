---
name: dev-login-agent
description: Dev-only test-innlogging for agent- + simulator-testing (test-miljø). Endepunkt, header, testbrukere, sikkerhetsgrense.
metadata:
  sist_verifisert_mot_kode: 2026-07-26
---

# Dev-login — agent- og simulator-testing (test-miljø)

Lar agent/simulator logge inn i SiteDoc **uten OAuth**, gated til test-miljø.
Nivå A+B (seedet testbruker + delt hemmelighet + whitelist).

**E2e-bruk (levert 2026-07-26):** dette endepunktet er auth-grunnmuren for Playwright-røyksuiten (`tests/e2e/`, 8 tester, 3× grønn mot test.sitedoc.no) — se [delplaner/e2e-rigg-ordre-2026-07-26.md](delplaner/e2e-rigg-ordre-2026-07-26.md). Suiten minter session-token via dette endepunktet; `DEV_LOGIN_SECRET` ligger i `tests/e2e/.env.local` (gitignored, aldri i repo). Suitens 3× grønne kjøringer re-verifiserer at dev-login virker ende-til-ende på test.

## Hvorfor: automatisert Chrome avvises av OAuth (web-agent-læring, 2026-07-07)

Google og Microsoft **avviser en automatisert/headless Chrome-instans ved siste OAuth-steg** («Denne nettleseren er ikke sikker»/blokkert redirect) — en web-agent kan derfor ikke logge inn via OAuth i sin egen Chrome. Tre gjenbrukbare veier for web-agent-økter:

1. **Dev-login (test):** denne fila — agent minter session-token direkte mot `/dev-login` (whitelist + secret). Foretrukket for automatisert web-verifisering på test.
2. **Attach til Kenneths ekte Chrome:** start Chrome med `--remote-debugging-port=9222` (gjerne egen profil/`--user-data-dir`), og la agenten koble seg til den kjørende instansen (chrome-devtools MCP mot 9222). OAuth-sesjonen er allerede etablert i Kenneths profil → ingen ny innlogging. Dette er «Opus web»-mønsteret for bevis på deployede miljøer (prod/test).
3. **Kenneth logger inn manuelt** og relayer resultat (brukt for redesign-bevis a–d).

Kort: **deployede miljøer (prod/test) verifiseres via attach-til-Kenneths-Chrome eller manuelt; lokal/test-automatisering via dev-login.** En frisk agent-Chrome + OAuth virker ikke.

## Endepunkt

`POST https://api-test.sitedoc.no/dev-login`

| | |
|---|---|
| **Header** | `x-dev-login-secret: <DEV_LOGIN_SECRET>` (samme verdi som på `sitedoc-test-api`) |
| **Body** | `{ "email": "<whitelistet testbruker>" }` (utelates → `test-admin@sitedoc.test`) |
| **Svar** | `{ sessionToken, user: { id, name, email, image, role } }` |

Bruk `sessionToken` som `Authorization: Bearer <token>` på alle tRPC-/API-kall
(samme mekanikk som prod). Token varer 30 dager.

### Eksempel (agent)

```bash
TOKEN=$(curl -sS -X POST https://api-test.sitedoc.no/dev-login \
  -H "Content-Type: application/json" \
  -H "x-dev-login-secret: $DEV_LOGIN_SECRET" \
  -d '{"email":"test-arbeider@sitedoc.test"}' | jq -r .sessionToken)

curl -sS https://api-test.sitedoc.no/trpc/prosjekt.hentMine \
  -H "Authorization: Bearer $TOKEN"
```

> **Praktisk ende-til-ende-løype** (oppstart→innlogget, tastene, brukerbytte,
> feilsøkingstabell): se [simulator-runbook.md](simulator-runbook.md). Dette
> dokumentet er kilden for whitelist/secret/tunnel-teori; runbooken er løypa.

## Simulator/lokal dev — via localhost-port-forward (robust)

**Anbefalt metode for simulator-testing.** Fra iOS-simulator feilet RN-fetch mot
både `https://api-test.sitedoc.no` (Cloudflare) og `http://100.76.248.15:3301`
(Tailscale-IP) med «Network request failed» på **forbindelsesnivå**, mens
`https://example.com` → 200 fra samme app og Safari i samme simulator nådde alle
tre. Isolert til **appens transportlag**, sitedoc-domene-spesifikt. Ledende
rotårsak: **iOS Local Network-privacy** — begge sitedoc-målene løser til
private/lokale adresser, som en fersk app blokkerer uten Local Network-tillatelse
(Safari er systemunntatt; example.com er ekte offentlig IP).

**Løsning (omgår hele klassen — loopback er unntatt både ATS og Local Network):**

0. **Tailscale MÅ være oppe FØRST.** `ssh server-ny` går over Tailscale — er den nede, timer tunnelen ut («Operation timed out» på port 22, nettopp det som skjedde 2026-07-28). Sjekk `tailscale status` / koble til FØR steg 1.
1. Kenneth åpner en SSH-port-forward på Mac-en (hold åpen):
   ```
   ssh -N -L 3301:localhost:3301 server-ny
   ```
   (test-API lytter på server-ny `127.0.0.1:3301` per `docker-compose.test.yml`.)
2. `apps/mobile/.env` (gitignored, lokal): `EXPO_PUBLIC_API_URL=http://localhost:3301`.
3. Native rebuild: `npx expo prebuild --clean -p ios && npx expo run:ios`.

- **ATS:** `app.config.js` beholder `NSAllowsArbitraryLoads` gated til lokal dev
  (`!process.env.EAS_BUILD`) som sikkerhetsnett for http mot loopback — aldri i
  noe EAS-bygg (prod/test/preview bruker https-edge via `eas.json`, som overstyrer `.env`).
- **TestFlight-bygg** (fysiske enheter) bruker fortsatt `https://api-test.sitedoc.no`
  (test-profil) — edge-endepunktet øverst står ved lag.

Diagnostikk-instrumentering (midlertidig) i `services/auth.ts` logger fullt
feilobjekt + prober example.com/test.sitedoc.no/{apiUrl} (per-probe timeout) ved
fetch-feil. **Forkastet:** direkte Tailscale-IP (`100.76.248.15:3301`) — feilet
pga. Local Network-privacy; localhost er robust uansett.

> **Forholdet til [simulator-ipv6-nordvpn.md](simulator-ipv6-nordvpn.md) (reconcile 2026-07-28):** det dokumentet beskriver den ALTERNATIVE veien (`EXPO_PUBLIC_API_URL=https://api-test.sitedoc.no` + IPv6-off). Den public url-en HAR AAAA → happy-eyeballs prøver IPv6 → henger (hele IPv6-fella). **`localhost:3301`-via-tunnel (denne seksjonen) er PRIMÆR** — loopback har ikke AAAA og sidestepper IPv6-fella helt. Bruk public-url-veien kun hvis tunnelen ikke er et alternativ (f.eks. fysisk enhet uten tunnel).
>
> **Metro-port ved flere worktrees:** to Expo/Metro-instanser kan ikke dele port 8081. Kjører Metro fra ett worktree (`SiteDoc/apps/mobile`) og du starter et annet (`SiteDoc-del6b/apps/mobile`), havner det nye på 8082 mens sim-en fortsatt peker på 8081. **Stopp den gamle Metro-en først** (frigi 8081), ELLER åpne `exp://127.0.0.1:8082` i sim-en. Merk: sim-en er en **global macOS-ressurs** (ikke checkout-bundet — enhver Bash-økt når den via `xcrun simctl`); kun Metro (JS-bundelen) er worktree-bundet.

## 🔴 Mobil test-bygg krever `EXPO_PUBLIC_DEV_LOGIN_SECRET` i EAS (lærdom 2026-08-17)

Et EAS-bygg med `--profile test` gir «Dev-bypass feilet — Dev-login feilet (401):
`DEV_LOGIN_SECRET_MANGLER_ELLER_FEIL`» hvis variabelen ikke finnes i EAS' environment.

**Årsak:** `apps/mobile/src/config/auth.ts:11` leser
`process.env.EXPO_PUBLIC_DEV_LOGIN_SECRET ?? ""`, og `services/auth.ts:173` sender den som
`x-dev-login-secret`. `eas.json`s test-profil setter seks `EXPO_PUBLIC_*`-variabler — men
**ikke denne**, med vilje: `eas.json` er committet, og en secret i git er permanent.

**Fiks (engangs, per EAS-prosjekt):**

```bash
cd apps/mobile
eas env:set --environment preview --name EXPO_PUBLIC_DEV_LOGIN_SECRET --visibility sensitive
# type: String · verdi = samme som DEV_LOGIN_SECRET i docker/env/api-test.env (64 tegn)
```

Test-profilen laster `preview`-environmentet, så variabelen plukkes opp derfra.
**Krever nytt bygg** — `EXPO_PUBLIC_*` bakes inn ved kompilering.

⚠️ **Denne secreten er en terskel, ikke en lås.** `EXPO_PUBLIC_*` ligger i JS-bundelen og kan
leses av alle med IPA-en. Den skal aldri gjenbrukes mot prod, og prod-api skal fortsatt gi
**404** på `/dev-login` (fail-secure, `erDevLoginAktiv()`).

**Ikke min feil-sporet:** serveren var i orden hele tiden — `DEV_LOGIN_SECRET` satt (64 tegn),
`ENABLE_DEV_LOGIN=true`, nøkkelen i `api-test.env`. Mistanken om at rsync-hendelsen 2026-08-13
hadde slettet den ble målt og avkreftet før noe ble endret.

## Testbrukere (seed)

Kjør seed mot test-DB (idempotent):

```bash
DATABASE_URL=<sitedoc_test> pnpm --filter @sitedoc/db exec tsx scripts/seed-testbrukere.ts
```

| Epost | Rolle | Bruk |
|---|---|---|
| `test-admin@sitedoc.test` | `sitedoc_admin` | Ser alt; admin-paritet, søk-gating (admin-bypass) |
| `test-firma@sitedoc.test` | `company_admin` | Firma-kontekst (Testfirma AS); FIRMA-sone, firma-hub |
| `test-arbeider@sitedoc.test` | `user` (prosjektmedlem, **uten manage_field**) | Søke-gating-testen (steg iv): skjulte manage_field-kort. L1.6-gate: faggruppe-medlemskap toggles mellom scenario 4 (utenfor) og 2 (innenfor) |
| `test-bestiller@sitedoc.test` | `user` | 5b-pilot ledd 2 (distinkt-person 4-ledds flyt) |
| `test-godkjenner@sitedoc.test` | `user` | 5b-pilot ledd 4 |

Whitelisten i `apps/api/src/routes/dev-login.ts` MÅ matche disse epostene.

## Worktree — lokal web-bevis uten Kenneth-innlogging (localhost)

**Når:** en kode-Opus i et eget worktree (f.eks. `SiteDoc-p2`) trenger å fange web-skjermbilder av sin egen branch (fabel-designgate) — men branchen er ikke test-deployet (test tracker develop), og Google/Microsoft-OAuth avviser en agent-Chrome. Løsning: kjør branchen lokalt + mint token via dev-login + seed nødvendig data-tilstand. **Kenneth trenger IKKE logge inn.** (Etablert 2026-07-28, P2-bevis. Verifisert: `seed-e2e-flyt.ts` finnes + invokering; `worktree-bootstrap.sh` = fabels forslag, se BACKLOG.)

1. **Env inn i worktreet** (gitignorert interim — samme worktree-lærdom som e2e-rigg-ordren; aldri commit):
   ```
   cp ../SiteDoc/apps/api/.env       apps/api/.env
   cp ../SiteDoc/apps/web/.env.local apps/web/.env.local
   ```
2. **Lokal dev-login trenger IKKE secret** (`NODE_ENV=development`, localhost — se § Sikkerhetsgrense). Mint token mot lokal api (`localhost:3001`) som `test-arbeider@sitedoc.test` (utfører-rollen).
3. **Seed data-tilstanden mot LOKAL DB** (ikke test-DB): kjør `seed-testbrukere.ts` FØRST, så `seed-e2e-flyt.ts` — begge med `DATABASE_URL=<lokal>`:
   ```
   DATABASE_URL=<lokal> pnpm --filter @sitedoc/db exec tsx scripts/seed-testbrukere.ts
   DATABASE_URL=<lokal> pnpm --filter @sitedoc/db exec tsx scripts/seed-e2e-flyt.ts
   ```
   - ⚠️ **Kandidat — verifiser, ikke anta (2026-07-28):** `seed-e2e-flyt.ts` traff `ERR_MODULE_NOT_FOUND` under e2e-riggen (2026-07-26). `seed-testbrukere.ts` med samme invokering kjørte grønt → feilen ligger i `seed-e2e-flyt.ts` sine import-stier, ikke i `tsx`. Verifiser at den kjører; feiler den, fiks modul-oppslaget FØR du bygger bevis på den.
   - ⚠️ **Kandidat:** seed-en setter opp flyt-scaffolding (faggrupper/mal/flyt/medlemmer). Verifiser om den også lager en **`received`-status sjekkliste-instans med test-arbeider som utfører** — trengs for at «Besvar» vises. Hvis ikke: opprett + send én sjekkliste til `received` som del av oppsettet.
4. `pnpm dev --filter @sitedoc/web --filter @sitedoc/api` → browser `localhost:3100` med token → fang skjermbildene → `SiteDoc/<modul>-bevis/`.

### Worktree e2e — konkrete gotchas (Playwright + localhost, verifisert 2026-07-30 under P4b-e2e)

Skjelettet over stemmer, men fem ting er ikke åpenbare og koster runde-tap:

1. **dev-login-ruten gir 404 til api kjører med `NODE_ENV=development` EKSPLISITT.** `tsx watch src/server.ts` (api dev-script) setter ikke NODE_ENV → `erDevLoginAktiv()` = false → ruten monteres aldri. Start api slik:
   ```
   NODE_ENV=development DATABASE_URL="<lokal>" pnpm --filter @sitedoc/api dev
   ```
2. **DATABASE_URL auto-lastes ikke inn i api-prosessen** (maskin/Vegvesen-worker feiler «Environment variable not found: DATABASE_URL») — send den eksplisitt (som over). Web (3100) trenger den ikke.
3. **Cookie-navnet er Auth.js v5, ikke next-auth:** `authjs.session-token` (http/localhost) / `__Secure-authjs.session-token` (https). Kilde: `tests/e2e/lib/miljo.ts` (`COOKIE_NAVN`).
4. **Cookien er httpOnly → MÅ settes via Playwright `context.addCookies`**, aldri `document.cookie`/`evaluate`. Mint token mot lokal dev-login (ingen secret), sett cookie, naviger:
   ```js
   const { sessionToken } = await (await fetch('http://localhost:3001/dev-login', {
     method:'POST', headers:{'Content-Type':'application/json'},
     body: JSON.stringify({ email: 'test-firma@sitedoc.test' })
   })).json();
   await page.context().addCookies([{
     name:'authjs.session-token', value: sessionToken,
     domain:'localhost', path:'/', httpOnly:true, secure:false, sameSite:'Lax',
     expires: Math.floor(Date.now()/1000)+25*24*60*60,
   }]);
   await page.goto('http://localhost:3100/dashbord/<projectId>/sjekklister');
   ```
   (velg testbruker etter rolle: `test-firma` = registrator/opprett-tester, `test-arbeider` = utfører.)
5. **Port 3001 EADDRINUSE ved restart** (gammel api henger igjen): `lsof -ti:3001 | xargs kill -9` før ny start.

**Fremtidig forbedring (fabel-forslag 2026-07-28, ikke bygget):** `scripts/worktree-bootstrap.sh` som kopierer/lenker env fra hovedtreet ved oppsett av nytt worktree — lukker env-hullet for ALLE fremtidige worktrees i én kommando. Samme krav (gitignorert, aldri commit) som resten av e2e-rigg-ordren. Se BACKLOG.

## Sikkerhetsgrense

- **Prod (avgjørende):** ruten monteres kun når `erDevLoginAktiv()` = `NODE_ENV==="development"` **eller** `ENABLE_DEV_LOGIN==="true"`. Prod har ingen → **404**, ingen credential-vei til prod-sesjon (fail-secure whitelist).
- **Test:** ruten aktiv, men krever `x-dev-login-secret` = env `DEV_LOGIN_SECRET` (fail-secure: mangler env-secret → alle kall nektes) → ingen åpen session-minting på test-nettet. Kun whitelistede eposter godtas.
- **Lokal dev** (`NODE_ENV=development`, localhost): secret ikke nødvendig.
- **Mobil:** knappen vises kun når `EXPO_PUBLIC_ENABLE_TEST_LOGIN==="true"` (satt i `test`-EAS-profilen, ikke prod) → hverken knapp eller secret er i prod-bundelen.

## Env-oppsett (Kenneth — secrets settes aldri i git)

1. **`sitedoc-test-api`** (`docker/env/api-test.env` på server): `ENABLE_DEV_LOGIN=true` + `DEV_LOGIN_SECRET=<hemmelig>`.
2. **Mobil test-bygg:** EAS-secret `EXPO_PUBLIC_DEV_LOGIN_SECRET` (`eas secret:create --scope project --name EXPO_PUBLIC_DEV_LOGIN_SECRET --value <samme hemmelig>`) — samme verdi som (1).
3. **Lokal Expo mot api-test:** eksporter `EXPO_PUBLIC_DEV_LOGIN_SECRET` i en gitignored `.env.local` (ikke commit).

Verdiene i (1) og (2) MÅ være identiske.

## Web-verifisering i Kenneths Chrome

For web-verifisering som krever ekte OAuth-innlogging (prod, eller test-flyt der
dev-login ikke dekker) kan agenten ikke logge inn selv: **en agent-styrt Chrome-instans
blokkeres av Google/Microsoft-OAuth ved siste steg** (automasjonsdeteksjon). Løsningen
er å attache til en Chrome Kenneth allerede har logget inn i.

**Hovedspor: Opus web-utvidelsen** — foretrukket vei for web-verifisering når den er
tilgjengelig; den kjører i Kenneths egen browserkontekst uten separat oppsett.

**Alternativ 1 — attach til Kenneths debug-Chrome:**

1. Kenneth starter én gang en Chrome med remote-debugging og en **permanent** profil:
   ```
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
     --remote-debugging-port=9222 \
     --user-data-dir="$HOME/chrome-claude-profil" &
   ```
2. Kenneth logger inn manuelt via OAuth **én gang** — profilen (`chrome-claude-profil`)
   er permanent, så innloggingen overlever mellom økter.
3. Agenten verifiserer at instansen kjører og **attacher via browser-url** — den skal
   **aldri** launche sin egen instans (det utløser OAuth-blokkeringen på nytt):
   ```
   curl -s http://127.0.0.1:9222/json/version
   ```
   Bruk `webSocketDebuggerUrl` fra svaret til å koble til den kjørende profilen.

**Alternativ 2 — dev-login på test:** omgår OAuth helt (se resten av dette dokumentet).
Foretrekk denne når verifiseringen kan gjøres i test-miljøet.

## Relaterte filer

- `apps/api/src/routes/dev-login.ts` — ruten (whitelist + secret-gate)
- `packages/db/scripts/seed-testbrukere.ts` — testbrukere + org + prosjekt
- `apps/mobile/app/logg-inn.tsx` + `src/services/auth.ts` + `src/config/auth.ts` — mobil-UI + flyt
- `apps/mobile/eas.json` (`test`-profil) — `EXPO_PUBLIC_ENABLE_TEST_LOGIN`
- `apps/mobile/.env` (gitignored) + `apps/mobile/app.config.js` (lokal-dev-ATS) — Tailscale-oppsett for simulator
