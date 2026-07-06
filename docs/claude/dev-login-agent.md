---
name: dev-login-agent
description: Dev-only test-innlogging for agent- + simulator-testing (test-miljø). Endepunkt, header, testbrukere, sikkerhetsgrense.
metadata:
  sist_verifisert_mot_kode: 2026-07-06
---

# Dev-login — agent- og simulator-testing (test-miljø)

Lar agent/simulator logge inn i SiteDoc **uten OAuth**, gated til test-miljø.
Nivå A+B (seedet testbruker + delt hemmelighet + whitelist).

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

## Testbrukere (seed)

Kjør seed mot test-DB (idempotent):

```bash
DATABASE_URL=<sitedoc_test> pnpm --filter @sitedoc/db exec tsx scripts/seed-testbrukere.ts
```

| Epost | Rolle | Bruk |
|---|---|---|
| `test-admin@sitedoc.test` | `sitedoc_admin` | Ser alt; admin-paritet, søk-gating (admin-bypass) |
| `test-firma@sitedoc.test` | `company_admin` | Firma-kontekst (Testfirma AS); FIRMA-sone, firma-hub |
| `test-arbeider@sitedoc.test` | `user` (prosjektmedlem, **uten manage_field**) | Søke-gating-testen (steg iv): skjulte manage_field-kort |

Whitelisten i `apps/api/src/routes/dev-login.ts` MÅ matche disse epostene.

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

## Relaterte filer

- `apps/api/src/routes/dev-login.ts` — ruten (whitelist + secret-gate)
- `packages/db/scripts/seed-testbrukere.ts` — testbrukere + org + prosjekt
- `apps/mobile/app/logg-inn.tsx` + `src/services/auth.ts` + `src/config/auth.ts` — mobil-UI + flyt
- `apps/mobile/eas.json` (`test`-profil) — `EXPO_PUBLIC_ENABLE_TEST_LOGIN`
