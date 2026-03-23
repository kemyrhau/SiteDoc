# Infrastruktur og deployment

## Serverarkitektur

```
Mac (utvikling) → git push → GitHub → ssh sitedoc → git pull + build + pm2 restart
                                    → eas build → TestFlight

PC/WSL (server):
  Produksjon:
    Next.js    :3100 → sitedoc.no          (Cloudflare Tunnel)
    Fastify    :3001 → api.sitedoc.no      (Cloudflare Tunnel)
    PostgreSQL :5432 (db: sitedoc, bruker: kemyr)

  Test:
    Next.js    :3300 → test.sitedoc.no     (Cloudflare Tunnel)
    Fastify    :3301 → api-test.sitedoc.no (Cloudflare Tunnel)
    PostgreSQL :5432 (db: sitedoc_test, bruker: kemyr)

  Felles:
    SSH        :22   → ssh.sitedoc.no      (Cloudflare Tunnel)
```

## Deployment

### Produksjon (main-branch)

```bash
bash deploy.sh
# Eller manuelt:
ssh sitedoc "cd ~/programmering/sitedoc && git pull && pnpm install --frozen-lockfile && pnpm db:migrate && pnpm build && pm2 restart sitedoc-web sitedoc-api"
```

### Test (develop-branch)

```bash
bash deploy-test.sh
# Eller manuelt:
ssh sitedoc "cd ~/programmering/sitedoc-test && git pull && pnpm install --frozen-lockfile && pnpm db:migrate && pnpm build && pm2 restart sitedoc-test-web sitedoc-test-api"
```

### Kun web-deploy (prod)

```bash
ssh sitedoc "cd ~/programmering/sitedoc && git pull && pnpm build --filter @sitedoc/web && pm2 restart sitedoc-web"
```

**Viktig:**
- Filteret er `@sitedoc/web` (pakkenavn), IKKE `web`
- Prisma-endringer: `pnpm db:migrate` FØR bygg
- Koden MÅ være pushet til GitHub før deploy
- Produksjon bruker `pm2 restart sitedoc-web sitedoc-api` (IKKE `pm2 restart all` — unngå restart av test-prosesser)

## Serverdetaljer

- **SSH:** `ssh sitedoc` fra Mac (nøkkel `~/.ssh/sitedoc_server`)
- **Prosjektmappe (prod):** `~/programmering/sitedoc` (main-branch)
- **Prosjektmappe (test):** `~/programmering/sitedoc-test` (develop-branch)
- **PM2 (prod):** `sitedoc-web`, `sitedoc-api`
- **PM2 (test):** `sitedoc-test-web`, `sitedoc-test-api`
- **Cloudflare Tunnel:** Systemd, config `/etc/cloudflared/config.yml`, tunnel ID `189a5af2-59f9-48df-a834-8e934313aa51`
- **Domene:** sitedoc.no (Domeneshop, DNS via Cloudflare)

## Auth-konfigurasjon

- **Auth.js:** `trustHost: true` (bak Cloudflare). Klient-side `signIn()` (IKKE server actions — MissingCSRF bak tunnel). `allowDangerousEmailAccountLinking: true` (påkrevd for invitasjonsflyt — godkjent risiko)
- **Google OAuth:** Web + iOS client. Consent screen: SiteDoc
- **Microsoft Entra ID:** Multitenant, `checks: ["state"]` (PKCE feiler bak tunnel). App ID: `d7735b7a-c7fb-407c-9bf6-80048f6f3ac5`. Client secret: `SiteDoc_Prod2`

## Sikkerhet

**CORS:** Callback-basert whitelist (`https://sitedoc.no`, `https://test.sitedoc.no`, `http://localhost:3100`, `http://localhost:3300`, `http://localhost:3000`) med `credentials: true`. Ukjente origins avvises aktivt. Konfigurert i `apps/api/src/server.ts`.

**Filopplasting:** `/upload`-endepunkt krever autentisert sesjon. Tillatte typer: PDF, DWG, DXF, IFC, PNG, JPG, LAS, LAZ, E57, PLY. UUID-filnavn. `X-Content-Type-Options: nosniff`. Fastify-grense: 500 MB. **Cloudflare Free-plan begrenser uploads til 100 MB** — filer over dette krever chunked upload (se TODO).

**Rate limiting:** Minnebasert (`apps/api/src/utils/rateLimiter.ts`). Automatisk opprydding hvert 5. minutt. Grenser: `byttToken` (10/min), `/upload` (30/min), invitasjons-endepunkter (10-20/min).

**Mobilsesjon:** 256-bit token (`crypto.randomBytes`), roteres ved hver `verifiser`-kall, server-side sletting ved utlogging.

**API-autorisasjon:** Alle ruter med prosjektdata har `verifiserProsjektmedlem`-sjekk. Dokumentruter bruker `verifiserDokumentTilgang` (entreprise + domain). `endreStatus` bruker `ctx.userId` (aldri bruker-input som `senderId`).

### Kjente aksepterte risikoer

- **`allowDangerousEmailAccountLinking`** — Påkrevd for invitasjonsflyten (inviterte brukere uten OAuth-konto). Risiko: kontoovertakelse hvis angriper kontrollerer OAuth-konto med offerets e-post. Lav i praksis (Google/Microsoft verifiserer e-post)
- **OAuth access tokens lagres ukryptert** i `accounts`-tabellen (Auth.js standard). Krever DB-kompromittering for utnyttelse

### Anbefalte tiltak (prioritert)

1. **Oppgrader Next.js 14 → 15+** — Kjent DoS-sårbarhet (HTTP-deserialisering). Stor jobb pga. React 19 og App Router-endringer — gjøres som egen oppgave
2. **Sett sikkerhetsheadere i Cloudflare** — CSP, X-Frame-Options, Strict-Transport-Security. Konfigureres i Cloudflare Dashboard → Rules → Transform Rules
3. **Web-tRPC: verifiser sesjon i database** — I dag stoler web på Auth.js cookie-deserialisering uten DB-oppslag. En slettet sesjon forblir gyldig til cookien utløper. Fiks: legg til DB-sjekk i `apps/web/src/app/api/trpc/[...trpc]/route.ts`
4. **Maks alder på mobilappens offline-cache** — I dag brukes cached brukerdata uten tidsbegrensning. Legg til 24-timers maks alder i `AuthProvider`
5. **Flytt rate limiting til Redis** — Minnebasert rate limiter nullstilles ved restart. Ikke kritisk nå, men bør gjøres når brukerbase vokser

## TODO: Chunked upload for store filer

Cloudflare Free-plan har 100 MB upload-grense. Store IFC-filer (>100 MB) feiler. Løsning: chunked upload.

**Plan:**
1. **Klient:** Del filen i chunks (f.eks. 50 MB), send hver chunk med `uploadId` + `chunkIndex` + `totalChunks`
2. **API:** Nytt `/upload/chunk`-endepunkt som lagrer chunks midlertidig, og `/upload/complete` som setter dem sammen
3. **Opprydding:** Slett uferdige chunks etter 1 time (cron eller lazy cleanup)
4. **Fremdriftsindikator:** Vis upload-progress på klientsiden (prosent per chunk)

Berører: `apps/api/src/routes/upload.ts`, opplastingskomponenter i web og mobil.

## Env-filer på server

### Produksjon (`~/programmering/sitedoc/`)

| Fil | Nøkkelvariabler |
|-----|----------------|
| `apps/api/.env` | DATABASE_URL, PORT=3001, HOST, AUTH_SECRET, RESEND_API_KEY |
| `apps/web/.env.local` | AUTH_SECRET, AUTH_GOOGLE_ID/SECRET, AUTH_MICROSOFT_ENTRA_ID_*, DATABASE_URL, RESEND_API_KEY |
| `packages/db/.env` | DATABASE_URL |

### Test (`~/programmering/sitedoc-test/`)

| Fil | Nøkkelvariabler |
|-----|----------------|
| `apps/api/.env` | DATABASE_URL (sitedoc_test), PORT=3301, HOST, AUTH_SECRET (egen), APP_URL=https://test.sitedoc.no |
| `apps/web/.env.local` | API_PORT=3301, AUTH_SECRET (matcher API), AUTH_GOOGLE_ID/SECRET, AUTH_MICROSOFT_ENTRA_ID_*, DATABASE_URL (sitedoc_test) |
| `packages/db/.env` | DATABASE_URL (sitedoc_test) |

- `.env.local` har prioritet over `.env` i Next.js — sjekk BEGGE
- Microsoft-variabler MÅ stå i `.env.local`
- Test og produksjon har **separate AUTH_SECRET** og **separate databaser**

## Test-miljø detaljer

### Uploads
Test-API-en bruker en **symlink** til prod sin uploads-mappe:
```
~/programmering/sitedoc-test/apps/api/uploads → ~/programmering/sitedoc/apps/api/uploads
```
Begge miljøer deler altså samme lokale fillagring. Ikke slett filer i uploads-mappen uten å sjekke begge databaser.

### Test-API oppstart
Test-API-en kjøres med `tsx` (ikke kompilert JS), fordi root `tsconfig.json` har `noEmit: true`:
```bash
cd ~/programmering/sitedoc-test/apps/api && PORT=3301 pm2 start 'npx tsx src/server.ts' --name sitedoc-test-api
```

### Test-database
Test-databasen (`sitedoc_test`) ble populert med data kopiert fra prod (prosjekt, bygninger, tegninger, sjekklister, rapportmaler, etc.). Bruker-IDer er forskjellige mellom prod og test — ved kopiering av data må `created_by`/`user_id`-felt mappes til riktig test-bruker.

### Kjente problemer i test-miljøet
- **IFC 3D-viewer:** Modeller laster ikke (uvisst årsak — bør debugges)
- **Tegningsvisning:** Zoom/pan fungerer ikke (bug finnes også i prod — ikke testet der heller)

### Arbeidsflyt

1. Utvikle på `develop`-branch
2. `bash deploy-test.sh` → deployer til test.sitedoc.no
3. Test grundig
4. Merge `develop` → `main`
5. `bash deploy.sh` → deployer til sitedoc.no

## EAS Build og TestFlight

- **Expo-konto:** kemyrhau
- **Apple App ID:** 6760205962
- **Bundle ID:** com.kemyrhau.sitedoc (iOS), com.sitedoc.app (Android)
- **Bygg iOS:** `cd apps/mobile && eas build --platform ios --profile production`
- **Send til TestFlight:** `eas submit --platform ios --latest`
- **VIKTIG:** `.env`-filer leses IKKE av EAS. `EXPO_PUBLIC_*`-variabler MÅ stå i `eas.json` under `build.<profil>.env`
- TestFlight: opptil 10 000 testere via App Store Connect
