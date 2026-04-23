# SiteDoc

Rapport- og kvalitetsstyringssystem for byggeprosjekter. Flerplattform (PC, mobil, nettbrett) med offline-støtte, bildekomprimering, GPS-tagging og dokumentflyt mellom faggrupper.

## Detaljert dokumentasjon

| Fil | Innhold |
|-----|---------|
| [docs/claude/arkitektur.md](docs/claude/arkitektur.md) | Database-skjema, relasjoner, tilgangskontroll, fagområder, rapportobjekter |
| [docs/claude/api.md](docs/claude/api.md) | API-routere, prosedyrer, gratis-grenser, prøveperiode |
| [docs/claude/web.md](docs/claude/web.md) | Web UI, ruter, kontekster, malbygger, print, tegningsvisning |
| [docs/claude/mobil.md](docs/claude/mobil.md) | React Native, offline-first, kamera, bilde, statusendring |
| [docs/claude/forretningslogikk.md](docs/claude/forretningslogikk.md) | Dokumentflyt, arbeidsforløp, grupper, moduler, admin, TODO |
| [docs/claude/entreprise-faggruppe-rapport.md](docs/claude/entreprise-faggruppe-rapport.md) | Historikk: entreprise→faggruppe rename (gjennomført april 2026) |
| [docs/claude/faggruppe-rename-plan.md](docs/claude/faggruppe-rename-plan.md) | Historikk: rename-plan som ble fulgt (gjennomført) |
| [docs/claude/shared-pakker.md](docs/claude/shared-pakker.md) | @sitedoc/shared typer + validering + utils, @sitedoc/ui komponenter |
| [docs/claude/infrastruktur.md](docs/claude/infrastruktur.md) | Deploy, server, env-filer, EAS Build, TestFlight, OAuth |
| [docs/claude/terminologi.md](docs/claude/terminologi.md) | Alle termer og definisjoner |
| [docs/claude/ai-sok.md](docs/claude/ai-sok.md) | AI-søk plan: embedding, hybrid søk, RAG, settings UI, testing UI |
| [docs/claude/dokumentflyt.md](docs/claude/dokumentflyt.md) | Dokumentflyt-spesifikasjon: eier, mottaker, dokumenttyper, flytregler, redigerbarhet |
| [docs/claude/okonomi.md](docs/claude/okonomi.md) | Økonomi-modul: kontrakter, notaer, avvik, parsere, prosessering, dokumentsøk |
| [docs/claude/bibliotek.md](docs/claude/bibliotek.md) | → Peker til kontrollplan.md (konsolidert) |
| [docs/claude/timer.md](docs/claude/timer.md) | Timeregistrering: dagsseddel, lønnsarter, tillegg, utlegg, offline-sync |
| [docs/claude/maskin.md](docs/claude/maskin.md) | Utstyrsregister: 3 kategorier (kjøretøy/anleggsmaskin/småutstyr), Vegvesen API, EU-kontroll, vedlikeholdsplan, GPS, telematikk |
| [docs/claude/kontrollplan.md](docs/claude/kontrollplan.md) | Kontrollplan + Sjekklistebibliotek: NS 3420-K/F, Område-modell, lovkrav, matrise, sluttrapport, AI-utkast |
| [docs/claude/infrastruktur-moduler.md](docs/claude/infrastruktur-moduler.md) | Isolert deploy: mappestruktur, turbo-pipeline, PM2, porter, auth-deling |
| [docs/claude/planlegger.md](docs/claude/planlegger.md) | Fremdriftsplanlegger: ressursplanlegging, kompetanse, bemanning, forslag-motor |
| [docs/claude/mannskap.md](docs/claude/mannskap.md) | Mannskapsregistrering: §15-liste, HMS-kort, geofence-innsjekk, PSI-kobling, GDPR, 12t auto-utlogging |
| [docs/claude/varsling.md](docs/claude/varsling.md) | Tverrgående varsling: firmanivå, kontrollplan-frister, EU-kontroll, service, sertifisering, in-app klokke |
| [docs/claude/ai-integrasjon.md](docs/claude/ai-integrasjon.md) | AI-integrasjon: Copilot plugin, MCP server, innebygd assistent, risikoer, API-lag |
| [MALBYGGER.md](MALBYGGER.md) | Felles malbygger: dokumenttyper, felttyper, beslutninger, migreringsstrategi |

**Ved "oppdater CLAUDE.md"**: oppdater den relevante detalj-filen i `docs/claude/`, ikke denne hovedfilen (med mindre det gjelder tech stack, struktur, kommandoer, kodestil eller regler).

## Tech Stack

- **Monorepo:** Turborepo med pnpm workspaces
- **Frontend web:** Next.js 14+ (App Router), React, TypeScript
- **Frontend mobil:** React Native, Expo (SDK 54)
- **Backend API:** Node.js, Fastify, tRPC
- **Database (server):** PostgreSQL med Prisma ORM (v6.19)
- **Database (lokal):** SQLite via expo-sqlite, Drizzle ORM
- **Fillagring:** S3-kompatibel (AWS S3 / Cloudflare R2 / MinIO)
- **Auth:** Auth.js v5 (next-auth) med Google og Microsoft Entra ID, database-sesjoner
- **E-post:** Resend (invitasjoner)
- **Styling:** Tailwind CSS (web), NativeWind (mobil)
- **Drag-and-drop:** dnd-kit (malbygger)
- **Kart:** Leaflet + react-leaflet, OpenStreetMap
- **Værdata:** Open-Meteo API (gratis)
- **3D/Punktsky:** Three.js, potree-core (punktsky-viewer), @thatopen/components (IFC 3D-viewer)
- **Tegningskonvertering:** ODA File Converter / libredwg (DWG→SVG), CloudCompare (E57/PLY→LAS), PotreeConverter (LAS→Potree octree)
- **Ikoner:** lucide-react
- **i18n:** i18next + react-i18next (13 språk, ~600 nøkler i packages/shared/src/i18n/)
- **Dokumentoversettelse:** OPUS-MT (selvhostet, port 3303) + Google Translate (gratis, google-translate-api-x) + DeepL (betalt). Translation memory cache, kildespråk-deteksjon
- **Flerspråklig embedding:** intfloat/multilingual-e5-base (768 dim, 100+ språk, port 3302)
- **Dokumentleser:** Blokkbasert Reader View med språkvelger, sammenlign-panel for motorbytte

## Prosjektstruktur

```
sitedoc/
├── apps/
│   ├── web/              # Next.js — src/app/, src/components/, src/kontekst/, src/hooks/, src/lib/
│   ├── mobile/           # Expo — src/db/, src/providers/, src/services/, app/
│   ├── api/              # Fastify — src/routes/, src/services/, src/trpc/
│   ├── timer/            # (planlagt) Next.js — timer.sitedoc.no
│   └── maskin/           # (planlagt) Next.js — maskin.sitedoc.no
├── packages/
│   ├── shared/           # Delte typer, Zod-schemaer, utils
│   ├── db/               # Prisma schema, migreringer, seed
│   ├── ui/               # 14 delte UI-komponenter
│   ├── pdf/              # Delt PDF-generering (HTML-strenger, null avhengigheter)
│   ├── db-timer/         # (planlagt) Egne Prisma-tabeller for timer
│   └── db-maskin/        # (planlagt) Egne Prisma-tabeller for maskin
├── docs/claude/          # Detaljert Claude-dokumentasjon
├── CLAUDE.md             # Denne filen
└── turbo.json
```

Nye moduler (timer, maskin) bruker samme PostgreSQL-instans men separate Prisma-skjemaer. Delt auth via eksisterende next-auth sessions-tabell. Nye modulers tabeller skal ALDRI inn i `packages/db`.

## Kommandoer

- `pnpm dev` — Start alle apps i dev-modus
- `pnpm dev --filter web` — Kun web (port 3100)
- `pnpm dev --filter mobile` — Kun mobil (Expo)
- `cd apps/mobile && pnpm dev:tunnel` — Mobil med ngrok v3-tunnel (fungerer på tvers av nettverk)
- `cd apps/mobile && npx expo start --clear` — Mobil LAN-modus (Mac og telefon på samme nettverk)
- `pnpm build` — Bygg alle apps
- `pnpm test` / `pnpm lint` / `pnpm typecheck`
- `pnpm db:migrate` — Prisma-migreringer (bruk prosjektets Prisma, IKKE global `npx prisma`)
- `pnpm db:seed` / `pnpm db:studio`

## Utviklingsmiljø og deploy

### Branching
- **`develop`** — aktiv utvikling. All ny kode commites hit.
- **`main`** — produksjon. Kun oppdatert via merge fra `develop` etter testing.

### Branching-regler (obligatorisk)

Alle større operasjoner startes på en feature-branch — aldri direkte på develop.

**Workflow:**
1. `git checkout develop && git pull origin develop`
2. `git checkout -b feature/beskrivende-navn`
3. Bygg og test på feature-branch
4. Deploy feature-branch til test.sitedoc.no og verifiser
5. Merge til develop via `git merge --no-ff`
6. Deploy develop til produksjon

**Gjelder alltid for:**
- DB-migrasjoner
- Rename/refaktorering (>10 filer)
- Nye moduler
- Tilgangskontroll-endringer

### Timer-prototype — midlertidig plassering

Filen `apps/web/src/app/dashbord/[prosjektId]/timer/` er en **demo-prototype** laget for kundepresentasjon. Den skal IKKE videreutvikles til produksjonskode.

Når timer-modulen bygges ordentlig (Fase 3):
- Flyttes til `apps/timer/` — egen Next.js-app
- DB flyttes til `packages/db-timer/` — eget Prisma-skjema
- Eksisterende prototype-filer slettes fra `apps/web`

Regler frem til da:
- Ikke legg til nye API-kall i prototype-siden
- Ikke koble prototype til eksisterende tRPC-ruter
- Ikke bruk prototype som mal for andre sider
- Alt i prototype er hardkodet demodata

### Miljøer

| | Test | Produksjon |
|---|---|---|
| **Web** | test.sitedoc.no | sitedoc.no |
| **Branch** | `develop` | `main` |
| **Repo på server** | `~/programmering/sitedoc-test` | `~/programmering/sitedoc` |
| **API-port** | 3301 | 3001 |
| **Database** | `sitedoc_test` | `sitedoc` |
| **Uploads** | Delt (symlinket) | Delt |

**KRITISK:** Databasene er SEPARATE. `psql -d sitedoc_test` for test, `psql -d sitedoc` for prod. ALDRI kjør testdata mot prod-databasen.

### Arbeidsflyt

1. **Utvikle** — jobb på `develop`, commit og push
2. **Deploy til test** — bruk deploy-kommandoen under (inkluderer cache-rydding >300 MB)
3. **Test** — verifiser på test.sitedoc.no
4. **Deploy til prod** (kun på eksplisitt forespørsel) — `git checkout main && git merge develop --no-edit && git push origin main` etterfulgt av server-deploy

### Deploy-kommandoer

```bash
# Test (automatisk etter push til develop)
ssh sitedoc "cd ~/programmering/sitedoc-test && git fetch origin && git reset --hard origin/develop && pnpm install --frozen-lockfile && du -sm apps/web/.next/cache 2>/dev/null | awk '\$1>500{print \"Rydder .next/cache (\"\$1\"MB)\"}' && find apps/web/.next/cache -maxdepth 0 -type d 2>/dev/null | xargs -I{} sh -c 'size=\$(du -sm {} | cut -f1); [ \$size -gt 500 ] && rm -rf {}' && pnpm build --filter @sitedoc/web && pm2 restart sitedoc-test-web sitedoc-test-api"

# Produksjon (KUN på eksplisitt forespørsel)
ssh sitedoc "cd ~/programmering/sitedoc && git pull && pnpm install --frozen-lockfile && pnpm --filter @sitedoc/db exec prisma migrate deploy && pnpm --filter @sitedoc/db exec prisma generate && du -sm apps/web/.next/cache 2>/dev/null | awk '\$1>500{print \"Rydder .next/cache (\"\$1\"MB)\"}' && find apps/web/.next/cache -maxdepth 0 -type d 2>/dev/null | xargs -I{} sh -c 'size=\$(du -sm {} | cut -f1); [ \$size -gt 500 ] && rm -rf {}' && pnpm build && pm2 restart all"
```

**Prod bruker `prisma migrate deploy`** — IKKE `pnpm db:migrate` (som kjører interaktiv `prisma migrate dev`). `prisma generate` må kjøres etter migrate for at API-bygget skal se nye Prisma-modeller.

**Cache-tak:** `.next/cache` slettes automatisk ved deploy hvis den overstiger 500 MB. Normal cache etter ren build er ~420 MB — taket rydder kun akkumulert gammel cache.

Se [docs/claude/infrastruktur.md](docs/claude/infrastruktur.md) for detaljer.

### Mobil reload-typer (viktig: opplys ALLTID brukeren)

Etter endringer, oppgi alltid hvilken reload-metode som trengs:

| Endring | Reload-metode | Instruks til bruker |
|---------|--------------|---------------------|
| **React-komponent / styling** | Hot reload | «Shake → Reload» eller dra ned |
| **Provider / kontekst / hooks** | Full restart | «`npx expo start --clear`» |
| **WebView-innhold (mobil-viewer)** | Deploy + restart | «Deployet til test — restart Expo med `--clear`» |
| **API-endringer** | Deploy | «Deployet til test — shake → Reload» |
| **Native modul / config** | Ny build | «Trenger ny EAS-build» |

**Regel:** Etter HVER commit som påvirker mobil, skriv eksplisitt: «**Reload:** [metode]»

### Miljøer og URL-oppsett

| | Test | Produksjon |
|---|---|---|
| **Web** | test.sitedoc.no | sitedoc.no |
| **API (tRPC)** | api-test.sitedoc.no (port 3301) | api.sitedoc.no (port 3001) |
| **Database** | sitedoc_test | sitedoc |
| **Mobil `.env`** | `api-test.sitedoc.no` | `api.sitedoc.no` |
| **Branch** | `develop` | `main` |

**Viktig:** Mobil `.env` peker mot **test** under utvikling. `.env.production` brukes for EAS Build / TestFlight.

### Mobil-app og URL-konstruksjon

- **URL-hjelpefunksjon:** Bruk `hentWebUrl()` fra `config/auth.ts` for web-URL (filnedlasting, mobil-viewer)
  ```
  hentWebUrl()
  // api.sitedoc.no → sitedoc.no
  // api-test.sitedoc.no → test.sitedoc.no
  ```
- **URL-mønster:** Alle `/uploads/`-URLer MÅ gå via Next.js proxy:
  ```
  baseUrl = hentWebUrl()
  url = `/api${fileUrl}`
  fullUrl = `${baseUrl}${url}`
  // → https://test.sitedoc.no/api/uploads/uuid.ifc ✅
  ```
- **ALDRI** bruk `AUTH_CONFIG.apiUrl.replace("api.", "")` direkte — bruk `hentWebUrl()`
- **ALDRI** send `file://`-stier til WebView — WebView kan ikke lese lokale filer fra en http-side (CORS)
- Reverse proxy: `test.sitedoc.no` → web, `test.sitedoc.no/api/` → API, `api-test.sitedoc.no` → tRPC

## Kodestil

- TypeScript strict mode, ingen `any`
- Named exports (unntak: Next.js pages/layouts)
- Zod-validering på alle API-endepunkter
- Prisma (server), Drizzle (lokal SQLite)
- ESLint v8 med `.eslintrc.json` — IKKE oppgrader til v9/v10
- `@typescript-eslint/no-unused-vars`: prefiks med `_`
- `eslint-config-next` MÅ matche Next.js-versjonen (v14)
- Ikon-props: `JSX.Element` (ikke `React.ReactNode`) for å unngå `@types/react` v18/v19-kollisjon
- tRPC mutation-callbacks: `_data: unknown` for å unngå TS2589
- Prisma-migreringer: `pnpm --filter @sitedoc/db exec prisma migrate dev`

## UI-designprinsipper

- **Renest mulig UI** — hvert element må rettferdiggjøre sin eksistens
- Unngå toasts, bannere, animasjoner uten tydelig behov
- Foretrekk subtile signaler fremfor påtrengende meldinger
- Dalux-stil: profesjonelt, kompakt, funksjonelt

## Fargepalett

| Farge | Hex | Bruk |
|-------|-----|------|
| `sitedoc-primary` | `#1e40af` | Primærfarge (toppbar, knapper) |
| `sitedoc-secondary` | `#3b82f6` | Sekundær (lenker, hover) |
| `sitedoc-accent` | `#f59e0b` | Aksent (varsler) |
| `sitedoc-success` | `#10b981` | Suksess (godkjent) |
| `sitedoc-error` | `#ef4444` | Feil (avvist, slett) |

## Språk

- All kode, kommentarer og commits på **norsk bokmål**
- Variabelnavn kan være engelske der naturlig (`id`, `status`, `config`)
- Bruk alltid æ, ø, å — ALDRI ASCII-erstatninger
- **i18n-krav:** Alle synlige UI-strenger i web-appen MÅ bruke `t()` fra react-i18next — ALDRI hardkod norsk tekst i JSX. Ved nye sider/komponenter:
  1. `import { useTranslation } from "react-i18next";`
  2. `const { t } = useTranslation();`
  3. Legg til nøkler i **både** `packages/shared/src/i18n/nb.json` og `en.json`
  4. Nøkkelformat: `seksjon.noekkel` (f.eks. `oppgaver.tittel`, `handling.lagre`)
  5. Gjenbruk eksisterende nøkler der mulig (`handling.lagre`, `handling.avbryt`, `tabell.navn` etc.)
  6. For data utenfor komponenter (arrays, configs): bruk `labelKey` i stedet for `label`, kall `t()` ved rendering

## Terminologi og hierarki

### Tre nivåer

```
Firma (Organization)                  ← Selskapet (A.Markussen AS, Veidekke)
├── Firmaadministrasjon               ← Modulvalg, prosjektmalverk
│   ├── Firmamoduler (tverrgående):   ← Slås av/på for hele firmaet
│   │   ├── Timeregistrering
│   │   ├── Maskinregistrering
│   │   ├── HR/Mannskap
│   │   └── Fremdriftsplanlegging
│   └── Prosjektmalverk               ← Standardoppsett for nye prosjekter
│
└── Prosjekter
    └── Prosjekt: NRK
        ├── Faggrupper + Dokumentflyt  ← Prosjektspesifikk dokumentflyt
        └── Prosjektmoduler:           ← Slås av/på per prosjekt
            ├── Sjekklister, Oppgaver, Tegninger, Mapper
            ├── Kontrollplan, Økonomi (FTD), PSI
            ├── 3D-visning, AI-søk, HMS-avvik
            └── ...
```

### Begreper — endelig definisjon

| Begrep | DB-modell | DB-tabell | Variabelnavn | Beskrivelse |
|--------|-----------|-----------|-------------|-------------|
| **Firma** | `Organization` | `organizations` | `organization` | Selskapet som eier SiteDoc-kontoen |
| **Faggruppe** | `Faggruppe` | `dokumentflyt_parts` | `faggruppe`, `faggruppeId` | Deltaker i dokumentflyt innenfor ett prosjekt |
| **Faggruppe-kobling** | `FaggruppeKobling` | `dokumentflyt_koblinger` | `faggruppeKoblinger` | Kobling mellom bruker og faggruppe |
| **Gruppefaggruppe** | `GroupFaggruppe` | `group_faggrupper` | `groupFaggrupper` | Begrenser gruppes tilgang til spesifikke faggrupper |
| **Dokumentflyt** | `Dokumentflyt` | `dokumentflyter` | `dokumentflyt` | Rute mellom to faggrupper (BH → TE) |
| **Dokumentflytmedlem** | `DokumentflytMedlem` | `dokumentflyt_medlemmer` | — | Person/gruppe koblet til rolle i dokumentflyt |
| **Bestiller-faggruppe** | — | `bestiller_faggruppe_id` | `bestillerFaggruppeId` | Faggruppen som initierer sjekkliste/oppgave |
| **Utfører-faggruppe** | — | `utforer_faggruppe_id` | `utforerFaggruppeId` | Faggruppen som mottar og besvarer |
| **Prosjektmodul** | `ProjectModule` | `project_modules` | — | Modul av/på per prosjekt |
| **Firmamodul** | (planlagt) | — | — | Modul av/på for hele firmaet, tverrgående |

### ⚠️ "Entreprise" brukes IKKE i koden

Rename gjennomført april 2026 (112 filer, feature/faggruppe-rename). Regler:
- **ALDRI** bruk "entreprise"/"enterprise" i ny kode, UI-strenger eller dokumentasjon
- Prisma-modell: `Faggruppe` (ikke DokumentflytPart, ikke Enterprise)
- Variabelnavn: `faggruppe`, `faggruppeId`, `faggruppeIder`
- tRPC-router: `trpc.faggruppe.*` (alias `trpc.entreprise.*` beholdt midlertidig for mobil)
- Tillatelse: `"faggruppe_manage"` (ikke "enterprise_manage")
- Mappeadgang: `accessType = "faggruppe"` (ikke "enterprise")
- 26 tilsiktede gjenværende "enterprise"-refs: deprecated aliaser, DB snapshot-felt, NS standardnavn

### Modulsystem — to nivåer

**Prosjektmoduler** (eksisterende, `ProjectModule`):
- Slås av/på **per prosjekt** i Innstillinger > Produksjon > Moduler
- Hvert prosjekt kan ha ulik konfigurasjon
- Eksempler: Sjekklister, Oppgaver, Tegninger, Kontrollplan, Økonomi, PSI, 3D, AI-søk, HMS

**Firmamoduler** (planlagt):
- Slås av/på **én gang for hele firmaet** i Firmaadministrasjon
- Deler data på tvers av alle firmaets prosjekter
- Eksempler: Timeregistrering, Maskinregistrering, HR/Mannskap, Fremdriftsplanlegging
- Egne apper (`apps/timer/`, `apps/maskin/`) med egne DB-skjemaer (`packages/db-timer/` osv.)

## Admin-arkitektur og roller

To DB-kolonner styrer tilgang: `User.role` (`sitedoc_admin` | `company_admin` | `user`) og `ProjectMember.role` (`admin` | `project_manager` | `worker` | `field_user`).

| Nivå | DB-verdi | Arver | Beskyttelse |
|------|----------|-------|-------------|
| **Superadmin** (Kenneth) | `User.role = "sitedoc_admin"` | Alt | `verifiserSiteDocAdmin()` |
| **Org-admin** (kundens admin) | `User.role = "company_admin"` | Admin i alle org-prosjekter, UTEN ProjectMember-rad | `verifiserOrganisasjonTilgang()` |
| **Prosjektadmin** | `ProjectMember.role = "admin"` | — | `harProsjektTilgang()` |
| **Prosjektleder** | `ProjectMember.role = "project_manager"` | — | `harProsjektTilgang()` |
| **Arbeider** | `ProjectMember.role = "worker"` | — | `harProsjektTilgang()` |
| **Feltbruker** | `ProjectMember.role = "field_user"` | — | `harProsjektTilgang()` |

**`harProsjektTilgang(userId, projectId)`**: Sjekker ProjectMember-rad ELLER company_admin med riktig org. Alle prosjekt-ruter bruker denne — aldri inline-sjekk. Ligger i `tilgangskontroll.ts`.

`company_admin` uten `organizationId` er ugyldig — fanget i `verifiserOrganisasjonTilgang()`. Standalone prosjekt (`organizationId = null`) er gyldig permanent tilstand.

**Kritiske regler:**
- Firma-admin ser **KUN** sitt eget firmas data — absolutt umulig å se andre firmaer
- Firma-grense-sjekk ligger **ALLTID** i server-laget (tRPC), aldri kun i frontend
- API-nøkler sendes **ALDRI** til klienten — returner kun `harNøkkel: boolean`
- Firmaoverføring (standalone → Organization) er **permanent** — krever superadmin + firmaadmin-godkjenning

**Organisasjonsmodellen — to spor:**
- **Standalone** (`organizationId = null`) — gyldig permanent tilstand, ikke en mangel
- **Under Organization (firma)** — firma-admin har innsyn, integrasjoner og firmamoduler tilgjengelig

**Kryssorg-deling:**
- Deaktivert som standard (`eksternDeling = false` på Project)
- Kun push, aldri pull — sender initierer
- Varsling ≠ deling — RUH gir varsel med metadata, ikke dokumentet
- Ingen duplikater — dokument bor alltid hos eier-org

## Viktige regler

- **Beskriv løsningen først:** Før kodeendringer, beskriv den logiske løsningen med ord og be om brukerens godkjenning. Ikke anta — still kontrollspørsmål ved tvil
- **ALDRI bruk "entreprise"/"enterprise"** i ny kode, UI-strenger eller dokumentasjon. Bruk **faggruppe** (UI/variabelnavn) eller **Faggruppe** (Prisma-modell). Se "Terminologi og hierarki"-seksjonen
- ALDRI commit `.env`-filer
- Bilder komprimeres til 300–400 KB før opplasting
- Alle database-endringer via Prisma-migreringer
- **ALDRI slett eksisterende data** — migreringer må bevare brukere, medlemskap og prosjektdata (bruk ALTER/RENAME/INSERT, ikke DROP+CREATE)
- **API-bakoverkompatibilitet:** Ved rename av tRPC-routere, behold gammel router som alias i minst 1 uke — mobilbrukere kan ikke oppdatere umiddelbart
- Mobil-appen MÅ fungere offline
- **Prosjektisolering:** Alle spørringer, filtre og søk SKAL være prosjektbasert. Ingen data skal lekke mellom prosjekter — hvert prosjekt er en isolert enhet. Alle API-queries MÅ filtrere på `projectId`
- Statusoverganger via `isValidStatusTransition()` på server og klient
- E-postsending (Resend) er valgfri — API starter uten nøkkel
- **Delt infrastruktur:** Brukeren har flere prosjekter som deler domene (sitedoc.no), OAuth-klienter, ngrok-konto og server. ALDRI endre `.env`-filer, DNS/tunnel-config eller OAuth-oppsett uten å spørre — endringer kan påvirke andre prosjekter
- **Auto-commit:** Commit og push til `develop` automatisk etter ferdig implementasjon
- **Auto-deploy til test:** Etter push til `develop`, deploy til test.sitedoc.no automatisk
- **ALDRI deploy til produksjon** uten eksplisitt forespørsel fra brukeren ("deploy til prod")
- **Auto-oppdater dokumentasjon:** Oppdater relevant fil i `docs/claude/` etter vesentlige endringer
- **Kontekstsparing:** Kontekstvinduet er begrenset — spar plass:
  - **Batch SSH-kommandoer:** Kombiner flere SSH-kall til ett script/én kommando i stedet for mange enkeltkommandoer. F.eks. ett `ssh sitedoc "cmd1 && cmd2 && cmd3"` i stedet for tre separate kall
  - **Filtrer output:** Bruk `| tail -n`, `| head -n`, `| grep` for å begrense output fra verbose kommandoer (build-logger, PM2-lister, psql-resultater)
  - **Unngå gjentatte lesinger:** Les en fil én gang, ikke les samme fil flere ganger i samme sesjon
  - **Bruk subagenter** for utforskning som krever mange søk/fillesinger

## Hjelpetekster per side

Hver side i SiteDoc skal ha en hjelpetekst tilgjengelig via hjelp-ikonet (?) øverst til høyre. Hjelpeteksten bygges når siden bygges, og oppdateres når siden endres.

**Referanseimplementasjon:** Kontakter-siden (`/oppsett/brukere`) med tre faner.

```tsx
<HjelpKnapp>
  <HjelpFane tittel="Hva er dette?">
    <p>Forklaring av siden...</p>
  </HjelpFane>
</HjelpKnapp>
```

**Når en ny side bygges:**
1. Lag hjelpetekst i samme PR — ikke i en separat oppgave
2. Minimum: hva siden er til for (én setning), hvem som kan bruke den (rolle-krav), viktigste handlinger
3. Bruk eksempler med norske navn (Ola, Trude, Per) — ikke abstrakte beskrivelser

**Når en eksisterende side endres:**
1. Oppdater hjelpeteksten i samme PR
2. Sjekk at begreper stemmer med nye navn
3. Hvis siden rename-es: hjelpeteksten rename-es samtidig

**Konsistente begreper:**
- "Faggruppe" — en deltaker i dokumentflyten på et prosjekt (Byggherre, Tømrer, Elektro). ALDRI "Entreprise"/"Enterprise"/"Part". Engelsk: "Trade group". Prisma: `Faggruppe`, DB: `dokumentflyt_parts`
- "Dokumentflyt" — rute mellom to faggrupper (bestiller → utfører → godkjenner). DB: `Dokumentflyt`
- "Firma" — selskapet som eier SiteDoc-kontoen (A.Markussen AS). DB: `Organization`
- "Firmamodul" — modul som gjelder hele firmaet på tvers av prosjekter (Timer, Maskin, HR, Planlegging)

**Sidestatus ?-ikon:**

| Side | URL | Har ? | Prioritet |
|------|-----|-------|-----------|
| Brukere | /oppsett/brukere | ✅ | OK — oppdatert til faggruppe-terminologi |
| Mappeoppsett | /oppsett/produksjon/box | ✅ | Sjekk konsistens |
| Lokasjoner | /oppsett/lokasjoner | ❌ | Legg til |
| Dokumentflyt | /oppsett/produksjon/kontakter | ❌ | Legg til |
| Oppgavemaler | /oppsett/produksjon/oppgavemaler | ❌ | Legg til |
| Sjekklistemaler | /oppsett/produksjon/sjekklistemaler | ❌ | Legg til |
| Moduler | /oppsett/produksjon/moduler | ❌ | Legg til |
| PSI | /oppsett/produksjon/psi | ❌ | Legg til |
| AI-søk | /oppsett/ai-sok | ❌ | Legg til |
| Admin/Firmaer | /admin/firmaer | ❌ | Legg til |
| Kontrollplan | /dashbord/[prosjektId]/kontrollplan | ✅ | OK — matrise/liste, polygon-tegning, sluttrapport, kaskade-flytt |
