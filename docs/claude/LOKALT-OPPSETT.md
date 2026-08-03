---
name: LOKALT-OPPSETT
description: SJEKK-FØRST-landingsside for alt miljø-/DB-/test-oppsett. Filkart over .env-filer + hvilken dyp-doc som svarer på hva. Les denne FØR du spør noen om oppsett.
status: aktiv
sist_verifisert_mot_kode: 2026-08-01
---

# Lokalt oppsett — sjekk-først-landingsside

**Formål:** kunnskapen om miljø-/DB-/test-oppsett bor i repoet, ikke i en agents samtaleminne. Hver compaction sletter minnet, ikke filene. Denne siden er der agenten leter FØR den ber Kenneth gjenta noe som allerede finnes.

## SJEKK-FØRST-PROTOKOLL (ufravikelig — før du spør om miljøoppsett)

1. **`ls` etter `.env*`** på de kjente stedene (`apps/api/`, `apps/web/`, `tests/e2e/`, repo-rot) og **les det som finnes**. `.env`-filer er gitignorert — de finnes på Kenneths disk selv om de ikke er i et ferskt worktree.
2. **Les den relevante dyp-doc-en** (tabellen under) — svaret står som regel der.
3. **Spør KUN om den ENE variabelen som faktisk mangler** — aldri «opprett .env» eller «gi meg DATABASE_URL» før du har lett. En manglende hemmelighet (f.eks. `DEV_LOGIN_SECRET` i et ferskt worktree) kopieres fra `.example` + fylles én gang; det er ikke «oppsett fra bunnen».

## Filkart — hvilke `.env`-filer finnes, hvor, hva de inneholder

| Fil | Sted | Innhold (variabelnavn, ikke verdier) | Opprettet |
|-----|------|--------------------------------------|-----------|
| `.env` | `apps/api/` | `DATABASE_URL` (→ lokal `sitedoc`, se under) + api-hemmeligheter. Gitignorert. | før 2026-04 |
| `.env.local` | `apps/web/` | web-miljø (peker mot samme lokale DB/api). Gitignorert. | før 2026-03 |
| `.env.local.example` | `tests/e2e/` | mal: `DEV_LOGIN_SECRET` (påkrevd), `E2E_BASE_URL`/`E2E_API_URL` (valgfrie, default test). **Kopieres til `.env.local` + fylles.** | 2026-07-26 |
| `.env.local` | `tests/e2e/` | `DEV_LOGIN_SECRET` = samme verdi som på `sitedoc-test-api`. Gitignorert, aldri i git/relé. Må gjenskapes i ferskt worktree (`cp .env.local.example .env.local`). | per maskin |
| `.env.example` | repo-rot + `packages/db-maskin/`, `packages/db-varelager/`, `scripts/smartdok/` | maler for respektive moduler. | div |

## Lokal DB — den ER satt opp (ikke en sandkasse som skal migreres)

Full detalj: **[lokal-dev.md](lokal-dev.md)** (verifisert 2026-07-15). Kort:

- **Homebrew `postgresql@16`**, binærer i `/opt/homebrew/opt/postgresql@16/bin` (ikke på PATH by default).
- **Rolle `kennethmyrhaug`** (OS-brukeren), **passordløs** (trust-auth). **DB `sitedoc`** på `localhost:5432`.
- `apps/api/.env` + `apps/web/.env.local` peker alt hit → **`DATABASE_URL=postgresql://kennethmyrhaug@localhost:5432/sitedoc`** (ingen passord).
- Den lokale DB-en er en **kopi av `sitedoc_test`** (restaurert fra dump), ikke en tom sandkasse. Ligger bak test så snart test får nye migreringer → frisk via dump-oppskriften i [lokal-dev.md § 3](lokal-dev.md). Etter schema-endring: ny dump-restore ELLER `prisma migrate deploy` mot lokal.
- **`grep -x postgres`** (eksakt) når du sjekker containere — løst `grep postgres` treffer `salsaklubb-postgres` først.

## Test-kjøring (e2e / agent) — hvilken doc svarer på hva

| Spørsmål | Doc |
|----------|-----|
| Hvordan kjører Playwright-e2e-suiten? (remote mot **test.sitedoc.no**, dev-login, seed, `pnpm e2e`) | **[tests/e2e/README.md](../../tests/e2e/README.md)** |
| Hvordan logger en agent/simulator inn uten OAuth? (dev-login-endepunkt, header, testbrukere, whitelist, secret) | **[dev-login-agent.md](dev-login-agent.md)** |
| Full oppstart→innlogget-løype + feilsøkingstabell | **[simulator-runbook.md](simulator-runbook.md)** |
| Lokal dev på Mac (se en endring på localhost, oppdatere test-data, feilsøke) | **[lokal-dev.md](lokal-dev.md)** |
| iOS-simulator henger / IPv6 / NordVPN | [simulator-ipv6-nordvpn.md](simulator-ipv6-nordvpn.md) |

**Kjernefakta e2e (fra README):** suiten kjører **mot test.sitedoc.no** (ikke lokal DB), autentiserer via **dev-login-token** (`DEV_LOGIN_SECRET`), seedes én gang mot `sitedoc_test` via `seed-testbrukere.ts` + `seed-e2e-flyt.ts` (kjøres av Kenneth på server-ny — test-DB er ikke direkte nåbar fra Mac). `data-testid`-ene må være **deployet til test** før suiten er grønn. Det er altså **Vei A (remote)** by design — ikke en lokal sandkasse.

## Eierskap — hvem eier hvilken DB

| Miljø | DB | Hvor | Bruk |
|-------|-----|------|------|
| **Lokal** | `sitedoc` | Homebrew pg16, `localhost:5432` (Mac) | Se en endring raskt (~1 min). Kopi av test. Sandkasse for risiko-DDL. |
| **Test** | `sitedoc_test` | server-ny (Docker) | **Primær-verifisering** før merge. E2e-suiten kjører hit. Ikke direkte nåbar fra Mac. |
| **Prod** | `sitedoc` | server-ny (Docker) | Kun eksplisitt go. Aldri PII på laptop. |

## Historikk

Oppsettet var udokumentert til 2026-07-15 ([lokal-dev.md](lokal-dev.md) fanget det). E2e-riggen ble bygget 2026-07-26 ([tests/e2e/README.md](../../tests/e2e/README.md) + [dev-login-agent.md](dev-login-agent.md)). Denne landingssiden (2026-08-01) samler filkart + sjekk-først-protokoll etter at en cowork-økt gjentatte ganger ba Kenneth «opprette» oppsett som allerede fantes — samme feilklasse som flytmodellen (sannhet i samtalen, ikke i kilden). Lærdom: **lete i repoet før du spør.**
