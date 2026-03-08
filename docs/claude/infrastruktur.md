# Infrastruktur og deployment

## Serverarkitektur

```
Mac (utvikling) → git push → GitHub → ssh sitedoc → git pull + build + pm2 restart
                                    → eas build → TestFlight

PC/WSL (server):
  Next.js    :3100 → sitedoc.no      (Cloudflare Tunnel)
  Fastify    :3001 → api.sitedoc.no  (Cloudflare Tunnel)
  SSH        :22   → ssh.sitedoc.no  (Cloudflare Tunnel)
  PostgreSQL :5432 (lokal, db: sitedoc, bruker: kemyr)
```

## Deployment

**Full deploy (anbefalt):**
```bash
ssh sitedoc "cd ~/programmering/sitedoc && git pull && pnpm install --frozen-lockfile && pnpm db:migrate && pnpm build && pm2 restart all"
```

**Alternativt — deploy-script fra Mac:**
```bash
bash deploy.sh
```

**Kun web-deploy:**
```bash
ssh sitedoc "cd ~/programmering/sitedoc && git pull && pnpm build --filter @sitedoc/web && pm2 restart sitedoc-web"
```

**Viktig:**
- Filteret er `@sitedoc/web` (pakkenavn), IKKE `web`
- Prisma-endringer: `pnpm db:migrate` FØR bygg
- Koden MÅ være pushet til GitHub før deploy

## Serverdetaljer

- **SSH:** `ssh sitedoc` fra Mac (nøkkel `~/.ssh/sitedoc_server`)
- **Prosjektmappe:** `~/programmering/sitedoc`
- **PM2:** `sitedoc-web`, `sitedoc-api`
- **Cloudflare Tunnel:** Systemd, config `/etc/cloudflared/config.yml`, tunnel ID `189a5af2-59f9-48df-a834-8e934313aa51`
- **Domene:** sitedoc.no (Domeneshop, DNS via Cloudflare)

## Auth-konfigurasjon

- **Auth.js:** `trustHost: true` (bak Cloudflare). Klient-side `signIn()` (IKKE server actions — MissingCSRF bak tunnel)
- **Google OAuth:** Web + iOS client. Consent screen: SiteDoc
- **Microsoft Entra ID:** Multitenant, `checks: ["state"]` (PKCE feiler bak tunnel). App ID: `d7735b7a-c7fb-407c-9bf6-80048f6f3ac5`. Client secret: `SiteDoc_Prod2`

## Env-filer på server

| Fil | Nøkkelvariabler |
|-----|----------------|
| `apps/api/.env` | DATABASE_URL, PORT, HOST, AUTH_SECRET, RESEND_API_KEY |
| `apps/web/.env.local` | AUTH_SECRET, AUTH_GOOGLE_ID/SECRET, AUTH_MICROSOFT_ENTRA_ID_*, DATABASE_URL, RESEND_API_KEY |
| `packages/db/.env` | DATABASE_URL |

- `.env.local` har prioritet over `.env` i Next.js — sjekk BEGGE
- Microsoft-variabler MÅ stå i `.env.local`

## EAS Build og TestFlight

- **Expo-konto:** kemyrhau
- **Apple App ID:** 6760205962
- **Bundle ID:** com.kemyrhau.sitedoc (iOS), com.sitedoc.app (Android)
- **Bygg iOS:** `cd apps/mobile && eas build --platform ios --profile production`
- **Send til TestFlight:** `eas submit --platform ios --latest`
- **VIKTIG:** `.env`-filer leses IKKE av EAS. `EXPO_PUBLIC_*`-variabler MÅ stå i `eas.json` under `build.<profil>.env`
- TestFlight: opptil 10 000 testere via App Store Connect
