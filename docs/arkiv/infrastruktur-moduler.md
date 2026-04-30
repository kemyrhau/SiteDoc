> ⚠️ **OBSOLETE per 2026-04-27**
>
> Denne filen beskriver en **forkastet plan**: isolert deploy av Timer/Maskin som egne apps med dedikerte porter (3302/3303). Den faktiske arkitekturen vedtatt i fase-0-beslutninger er **integrerte moduler** i eksisterende SiteDoc-app (`apps/web` + `apps/api` + `apps/mobile` + `packages/db`).
>
> **Maskin** er allerede implementert som integrert modul (verifisert 2026-04-27 — ingen `apps/maskin/`, kun `apps/api/src/routes/maskin/` + `apps/web/src/app/dashbord/maskin/` + `packages/db-maskin/`).
>
> **Timer** skal følge samme mønster (vedtatt 2026-04-27 etter kundedialog).
>
> Porter 3302/3303 brukes av **embedding (NorBERT)** og **oversettelse (OPUS-MT)** — ingen reell konflikt eksisterer i den faktiske arkitekturen.
>
> Filen beholdes som arkiv for kontekst om port-research. **Ikke følg planen i denne filen.**
>
> **Sannhetskilder:**
> - [arkitektur.md](../claude/arkitektur.md) — gjeldende arkitektur
> - [fase-0-beslutninger.md](../claude/fase-0-beslutninger.md) — alle vedtatte beslutninger
> - [infrastruktur.md](../claude/infrastruktur.md) — faktisk port-tildeling

# Infrastruktur — Timer og Maskin (isolerte moduler) — OBSOLETE

## Monorepo-oversikt

```
┌─────────────────────────────────────────────────────────────────┐
│ Eksisterende                                                    │
│  apps/web         apps/api       apps/mobile    packages/db     │
│  sitedoc.no       tRPC/Node.js   React Native   Prisma/PG      │
├─────────────────────────────────────────────────────────────────┤
│ Nye moduler (fase 3)                                            │
│  apps/timer       apps/maskin    Mobile timer-modul             │
│  timer.sitedoc.no maskin.sitedoc Isolert i apps/mobile          │
│  Next.js          Next.js        SQLite offline-first           │
├─────────────────────────────────────────────────────────────────┤
│ Nye Prisma-pakker (samme PostgreSQL-instans)                    │
│  packages/db-timer  packages/db-maskin   PostgreSQL             │
│  Timer-tabeller     GPS, kjøretøy        Én felles instans     │
├─────────────────────────────────────────────────────────────────┤
│ Delt infrastruktur                                              │
│  next-auth sessions  apps/api validering   nginx                │
│  Felles auth-tabell  Timer/Maskin → API    Subdomener + SSL     │
├─────────────────────────────────────────────────────────────────┤
│ Eksterne integrasjoner                                          │
│  GPS-leverandør    Statens vegvesen  HR-system   OrgIntegration │
│  Webfleet/Transpoco Kjøretøyregister Visma/Unit4 Proadm/SmartDoc│
└─────────────────────────────────────────────────────────────────┘
```

## Mappestruktur

### apps/timer

```
apps/timer/
├── src/
│   ├── app/           ← Next.js app-router sider
│   ├── components/    ← UI-komponenter (kun timer)
│   ├── lib/           ← hjelpefunksjoner
│   └── trpc/          ← tRPC-klient-oppsett
├── package.json
└── next.config.js
```

### apps/maskin

```
apps/maskin/
├── src/
│   ├── app/           ← Next.js app-router sider
│   ├── components/    ← UI-komponenter (kun maskin)
│   ├── lib/           ← hjelpefunksjoner
│   └── trpc/          ← tRPC-klient-oppsett
├── package.json
└── next.config.js
```

### packages/db-timer

```
packages/db-timer/
├── prisma/
│   └── schema.prisma  ← kun timer-tabeller (daily_sheets, sheet_machines, etc.)
└── src/
    └── index.ts       ← eksporterer Prisma-klient
```

### packages/db-maskin

```
packages/db-maskin/
├── prisma/
│   └── schema.prisma  ← kun maskin-tabeller (vehicles, gps_events, etc.)
└── src/
    └── index.ts       ← eksporterer Prisma-klient
```

## Regler — aldri bryt disse

1. **`packages/db-timer` og `packages/db-maskin` importeres aldri i `apps/web`, `apps/api` eller `apps/mobile`** — de er isolerte Prisma-klienter med egne connection strings mot samme PostgreSQL-instans
2. **`apps/timer` og `apps/maskin` er fullstendig isolerte** — de deler ikke kode med `apps/web`. Delt kode går via `packages/shared` eller `packages/ui`
3. **Timer og maskin er to separate moduler** — aldri slå dem sammen, selv om de refererer til hverandre (f.eks. `sheet_machines` → `vehicles`)
4. **Nye tabeller for timer og maskin legges aldri i `packages/db`** — `packages/db` er kun for SiteDoc-kjernen (brukere, prosjekter, sjekklister, oppgaver)

## Deploy — isolert per app

```bash
# Deploy kun timer (endringer i apps/timer eller packages/db-timer)
ssh sitedoc "cd ~/programmering/sitedoc && git pull && pnpm build --filter @sitedoc/timer && pm2 restart sitedoc-timer"

# Deploy kun maskin (endringer i apps/maskin eller packages/db-maskin)
ssh sitedoc "cd ~/programmering/sitedoc && git pull && pnpm build --filter @sitedoc/maskin && pm2 restart sitedoc-maskin"

# Deploy kun web (eksisterende — endringer i apps/web)
ssh sitedoc "cd ~/programmering/sitedoc && git pull && pnpm build --filter @sitedoc/web && pm2 restart sitedoc-web"

# Full deploy (kun ved endringer i delte pakker: packages/shared, packages/ui)
ssh sitedoc "cd ~/programmering/sitedoc && git pull && pnpm build && pm2 restart all"
```

### Trigger-matrise — hva deployes ved endring?

| Endring i | Deploy |
|-----------|--------|
| `apps/timer/**` | Kun `sitedoc-timer` |
| `packages/db-timer/**` | Kun `sitedoc-timer` |
| `apps/maskin/**` | Kun `sitedoc-maskin` |
| `packages/db-maskin/**` | Kun `sitedoc-maskin` |
| `apps/web/**` | Kun `sitedoc-web` |
| `apps/api/**` | Kun `sitedoc-api` (+ `sitedoc-test-api` for test) |
| `packages/shared/**` | Alle apper (`pnpm build && pm2 restart all`) |
| `packages/ui/**` | Alle web-apper (`sitedoc-web`, `sitedoc-timer`, `sitedoc-maskin`) |
| `packages/db/**` | `sitedoc-web` og `sitedoc-api` |

## Turbo-pipeline

Legg til i `turbo.json` når appene opprettes:

```json
{
  "pipeline": {
    "@sitedoc/timer#build": {
      "dependsOn": ["@sitedoc/db-timer#build", "@sitedoc/shared#build", "@sitedoc/ui#build"]
    },
    "@sitedoc/maskin#build": {
      "dependsOn": ["@sitedoc/db-maskin#build", "@sitedoc/shared#build", "@sitedoc/ui#build"]
    },
    "@sitedoc/db-timer#build": {
      "dependsOn": []
    },
    "@sitedoc/db-maskin#build": {
      "dependsOn": []
    }
  }
}
```

## PM2-prosesser

| Prosess | App | Port | Domene |
|---------|-----|------|--------|
| `sitedoc-web` | `apps/web` | 3100 | sitedoc.no |
| `sitedoc-api` | `apps/api` | 3001 | api.sitedoc.no |
| `sitedoc-timer` | `apps/timer` | 3002 | timer.sitedoc.no |
| `sitedoc-maskin` | `apps/maskin` | 3003 | maskin.sitedoc.no |
| `sitedoc-test-web` | `apps/web` (test) | 3100 | test.sitedoc.no |
| `sitedoc-test-api` | `apps/api` (test) | 3301 | api-test.sitedoc.no |
| `sitedoc-test-timer` | `apps/timer` (test) | 3302 | timer-test.sitedoc.no |
| `sitedoc-test-maskin` | `apps/maskin` (test) | 3303 | maskin-test.sitedoc.no |

**Merk:** Port 3302 og 3303 er i dag brukt av OPUS-MT (oversettelse) og E5 (embedding). Disse portene må flyttes eller timer/maskin bruker andre porter. Avklares ved oppstart.

## Nginx/Cloudflare

```
timer.sitedoc.no       → localhost:3002 (prod)
maskin.sitedoc.no      → localhost:3003 (prod)
timer-test.sitedoc.no  → localhost:3302 (test)
maskin-test.sitedoc.no → localhost:3303 (test)
```

Konfigureres i Cloudflare DNS (A-record → server IP) + Cloudflare Tunnel eller nginx reverse proxy på server. Samme mønster som eksisterende `sitedoc.no` → `:3100` og `api.sitedoc.no` → `:3001`.

## Auth — delt sessions-tabell

Alle apper deler auth via `sessions`-tabellen i `packages/db`:

```
Bruker logger inn på sitedoc.no → session-cookie settes på .sitedoc.no
→ timer.sitedoc.no leser samme cookie → validerer mot sessions-tabell
→ maskin.sitedoc.no leser samme cookie → validerer mot sessions-tabell
```

**Viktig:** Cookie-domain må settes til `.sitedoc.no` (med ledende punktum) for at subdomener deler session. Konfigureres i Auth.js:

```typescript
// apps/timer/src/lib/auth.ts
cookies: {
  sessionToken: {
    name: "authjs.session-token",
    options: { domain: ".sitedoc.no" }
  }
}
```

## Kryssreferanser mellom moduler

Timer refererer til maskin-data (`sheet_machines.vehicleId` → `vehicles.id`). Denne koblingen går **direkte i PostgreSQL** via FK, ikke via Prisma-relasjoner:

- `packages/db-timer` har en `vehicleId` kolonne med `@map("vehicle_id")` men **ingen** Prisma-relasjon til `packages/db-maskin`
- Oppslag gjøres via rå SQL eller separate Prisma-kall: hent `vehicleId` fra timer-DB, slå opp i maskin-DB
- Integritet sikres via FK-constraint i PostgreSQL (ikke i Prisma)

Denne tilnærmingen bevarer full isolasjon mellom Prisma-skjemaene mens databasen håndhever referanseintegritet.
