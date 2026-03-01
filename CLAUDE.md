# SiteFlow

Rapport- og kvalitetsstyringssystem for byggeprosjekter. Flerplattform (PC, mobil, nettbrett) med offline-støtte, bildekomprimering, GPS-tagging og entreprisearbeidsflyt.

## Tech Stack

- **Monorepo:** Turborepo
- **Frontend web:** Next.js 14+ (App Router), React, TypeScript
- **Frontend mobil:** React Native, Expo (SDK 52+)
- **Backend API:** Node.js, Fastify, tRPC
- **Database (server):** PostgreSQL med Prisma ORM
- **Database (lokal):** SQLite via expo-sqlite, Drizzle ORM
- **Fillagring:** S3-kompatibel (AWS S3 / Cloudflare R2 / MinIO)
- **Auth:** Auth.js v5 (next-auth) med Google og Microsoft Entra ID (Office 365), PrismaAdapter, database-sesjoner
- **Bildekomprimering:** expo-image-manipulator (mål: 300–400 KB)
- **GPS:** expo-location (deaktiverbar per objekt)
- **PDF-eksport:** react-pdf
- **Styling:** Tailwind CSS (web), NativeWind (mobil)
- **Drag-and-drop:** dnd-kit (malbygger på PC)

## Prosjektstruktur

```
siteflow/
├── apps/
│   ├── web/            # Next.js PC-applikasjon
│   │   └── src/
│   │       ├── app/dashbord/
│   │       │   ├── layout.tsx              # Tre-kolonne layout (Toppbar + Sidebar + innhold)
│   │       │   ├── page.tsx                # Dashbord med prosjektliste
│   │       │   ├── oppsett/               # Innstillinger
│   │       │   │   ├── layout.tsx          # Innstillings-sidebar med navigasjon
│   │       │   │   ├── brukere/           # Brukergrupper og roller
│   │       │   │   ├── lokasjoner/        # Lokasjoner + bygninger
│   │       │   │   ├── field/             # Field-innstillinger
│   │       │   │   │   ├── entrepriser/   # Entrepriser med arbeidsforløp
│   │       │   │   │   ├── box/           # Box (filstruktur/dokumenthåndtering)
│   │       │   │   │   ├── oppgavemaler/  # Oppgavens arbeidsflyt
│   │       │   │   │   └── kontrollplaner/# Kontrollplaner
│   │       │   │   ├── prosjektoppsett/   # Prosjektoppsett (navn, status, adresse)
│   │       │   │   └── eierportal-brukere/# Owners Portal brukere
│   │       │   └── [prosjektId]/          # Prosjektspesifikke ruter
│   │       │       ├── layout.tsx          # Verktøylinje-wrapper
│   │       │       ├── page.tsx            # Prosjektoversikt
│   │       │       ├── sjekklister/       # Sjekkliste-tabell + detalj
│   │       │       ├── oppgaver/          # Oppgave-tabell
│   │       │       ├── maler/             # Maler med malbygger
│   │       │       ├── entrepriser/       # Entreprise-liste
│   │       │       └── tegninger/         # Tegninger (kommer)
│   │       ├── components/
│   │       │   ├── layout/                # Toppbar, HovedSidebar, SekundaertPanel, Verktoylinje, ProsjektVelger
│   │       │   └── paneler/               # Seksjonspaneler (filter/statusgrupper per seksjon)
│   │       ├── kontekst/                  # ProsjektKontekst, NavigasjonKontekst
│   │       └── hooks/                     # useAktivSeksjon, useVerktoylinje
│   ├── mobile/         # Expo React Native app
│   └── api/            # Fastify backend
├── packages/
│   ├── shared/         # Delte typer, utils, validering (Zod)
│   ├── db/             # Prisma schema, migreringer, seed
│   └── ui/             # Delte UI-komponenter (Button, Card, Table, Tooltip, SidebarIkon, SearchInput, m.m.)
├── CLAUDE.md
├── turbo.json
└── package.json
```

## Kommandoer

- `pnpm dev` — Start alle apps i dev-modus
- `pnpm dev --filter web` — Kun web
- `pnpm dev --filter mobile` — Kun mobil (Expo)
- `pnpm dev --filter api` — Kun API
- `pnpm build` — Bygg alle apps
- `pnpm test` — Kjør alle tester
- `pnpm test --filter api` — Tester kun for API
- `pnpm lint` — Kjør ESLint på alle pakker
- `pnpm typecheck` — TypeScript typesjekk hele monorepo
- `pnpm db:migrate` — Kjør Prisma-migreringer
- `pnpm db:seed` — Seed database med testdata
- `pnpm db:studio` — Åpne Prisma Studio

## Arkitektur

### Database (PostgreSQL)

Kjernetabeller: `projects`, `enterprises`, `drawings`, `report_templates`, `report_objects`, `checklists`, `tasks`, `document_transfers`, `images`, `folders`, `documents`, `users`, `buildings`, `workflows`, `workflow_templates`.

Viktige relasjoner:
- Sjekklister og oppgaver har ALLTID `creator_enterprise_id` (oppretter) og `responder_enterprise_id` (svarer)
- `document_transfers` logger all sending mellom entrepriser med full sporbarhet
- Bilder har valgfri GPS-data (`gps_lat`, `gps_lng`, `gps_enabled`)
- `workflows` tilhører en entreprise og kobler til maler via `workflow_templates`
- `report_templates` har `category` (`oppgave` | `sjekkliste`) for å skille maltyper
- `buildings` tilhører et prosjekt, med tegninger koblet via `building_id`

### Entrepriseflyt

Sentral forretningslogikk. Dokumenter (sjekklister/oppgaver) flyter mellom entrepriser:

Statusverdier: `draft` → `sent` → `received` → `in_progress` → `responded` → `approved` | `rejected` → `closed`

- Oppretter-entreprise initierer og godkjenner/avviser
- Svar-entreprise mottar, fyller ut og besvarer
- Alle overganger logges i `document_transfers`

### Arbeidsforløp

Arbeidsforløp kobler maler til entrepriser. Konfigureres under Innstillinger > Field > Entrepriser:

- Hver entreprise kan ha flere arbeidsforløp (f.eks. "Uavhengig Kontroll", "Produksjon")
- Hvert arbeidsforløp velger hvilke maler (oppgavetyper og sjekklistetyper) som er tilgjengelige
- Maler kategoriseres som `oppgave` eller `sjekkliste` via `report_templates.category`
- Treprikk-menyer (⋮) på to nivåer: entreprise-header og arbeidsforløp-rad

### Innstillings-sidebar

Sidebaren under `/dashbord/oppsett/` er organisert i seksjoner:
- **Brukere** — Brukergrupper og rollestyring
- **Lokasjoner** — Bygninger
- **Field** — Entrepriser, Oppgavens arbeidsflyt, Kontrollplan, Box
- **Owners Portal** — Eierportalens brukere, Prosjektoppsett

### Rapportobjekter (15 typer)

Maler bygges på PC med drag-and-drop. Hver mal inneholder objekter med definert type og konfigurasjon:

1. Tekstfelt, 2. Kamerafelt, 3. Bildevelger, 4. Avkrysning, 5. Flervalg, 6. Tallverdi, 7. Dato/Tid, 8. Signatur, 9. Lokasjonsvelger, 10. Kommentarfelt, 11. Statusvelger, 12. Entreprisevelger (med rolle: creator/responder), 13. Filvedlegg, 14. Tegningsreferanse, 15. Seksjonsdeler

Objektkonfigurasjon lagres som JSON i `report_objects.config`.

### Bildehåndtering

Bilder fra mobil komprimeres ALLTID før lagring:
1. Maks 1920px bredde
2. Iterativ kvalitetsjustering til 300–400 KB
3. GPS-tag legges til hvis aktivert
4. Lagres lokalt i SQLite, synkroniseres til S3

### Offline-first

Mobil-appen bruker SQLite lokalt. All data skrives lokalt først, synkroniseres med server når nett er tilgjengelig. Bruk `is_synced`-flagg på alle tabeller. Konflikthåndtering: last-write-wins med tidsstempel.

## Web UI-arkitektur

Dalux-inspirert tre-kolonne layout:

```
+----------------------------------------------------------+
| TOPPBAR: [SiteFlow] [Prosjektvelger v]     [Bruker v]    |
+------+------------------+--------------------------------+
| IKON | SEKUNDÆRT PANEL  | HOVEDINNHOLD                   |
| 60px | 280px            | Verktøylinje: [Opprett] [...]  |
|      | - Filtre         |                                |
| Dash | - Statusgrupper  | Tabell / Detaljvisning         |
| Sjekk| - Søk            |                                |
| Oppg |                  |                                |
| Maler|                  |                                |
| Tegn |                  |                                |
| Entr |                  |                                |
|      |                  |                                |
| Opps |                  |                                |
| Hjelp|                  |                                |
+------+------------------+--------------------------------+
```

### Ruter

```
/dashbord                                  -> Dashbord (prosjektliste)
/dashbord/[prosjektId]                     -> Prosjektoversikt
/dashbord/[prosjektId]/sjekklister         -> Sjekkliste-tabell
/dashbord/[prosjektId]/sjekklister/[id]    -> Sjekkliste-detalj
/dashbord/[prosjektId]/oppgaver            -> Oppgave-tabell
/dashbord/[prosjektId]/maler               -> Mal-liste
/dashbord/[prosjektId]/maler/[id]          -> Mal-detalj / malbygger
/dashbord/[prosjektId]/entrepriser         -> Entreprise-liste
/dashbord/[prosjektId]/tegninger           -> Tegninger
/dashbord/oppsett                          -> Innstillinger (redirect til brukere)
/dashbord/oppsett/brukere                  -> Brukergrupper og roller
/dashbord/oppsett/lokasjoner              -> Lokasjonsoversikt
/dashbord/oppsett/lokasjoner/bygninger    -> Bygningsliste
/dashbord/oppsett/field                    -> Field-oversikt (kategorikort)
/dashbord/oppsett/field/entrepriser        -> Entrepriser med arbeidsforløp
/dashbord/oppsett/field/box                -> Box (filstruktur/mappestruktur)
/dashbord/oppsett/field/oppgavemaler       -> Oppgavens arbeidsflyt
/dashbord/oppsett/field/kontrollplaner     -> Kontrollplaner
/dashbord/oppsett/prosjektoppsett          -> Prosjektoppsett
```

### Kontekster og hooks

- `ProsjektKontekst` — Valgt prosjekt synkronisert med URL-parameter `[prosjektId]`
- `NavigasjonKontekst` — Aktiv seksjon + kontekstuelle verktøylinje-handlinger
- `useAktivSeksjon()` — Utleder aktiv seksjon fra pathname
- `useVerktoylinje(handlinger)` — Registrerer kontekstuelle handlinger per side

### Layout-komponenter

- `Toppbar` — Mørk blå bar med logo, prosjektvelger (dropdown med søk), brukermeny
- `HovedSidebar` — 60px ikonbar med Tooltip, deaktiverte ikoner uten valgt prosjekt
- `SekundaertPanel` — 280px panel med seksjonsspesifikt innhold (filtre, lister, søk)
- `Verktoylinje` — Kontekstuell handlingsbar, registreres via `useVerktoylinje`

## Kodestil

- TypeScript strict mode, ingen `any`
- Named exports, ikke default exports (unntak: Next.js pages/layouts)
- Zod-validering på alle API-endepunkter og skjemadata
- Prisma for server-side DB, Drizzle for lokal SQLite
- Alle API-ruter i `apps/api/src/routes/` (prosjekt, entreprise, sjekkliste, oppgave, mal, bygning, tegning, arbeidsforlop, mappe, medlem)
- Alle Expo-skjermer i `apps/mobile/src/screens/`
- Layout-komponenter i `apps/web/src/components/layout/`
- Seksjonspaneler i `apps/web/src/components/paneler/`
- Kontekster i `apps/web/src/kontekst/`
- Hooks i `apps/web/src/hooks/`
- Delte UI-komponenter i `packages/ui/src/`
- Delte typer i `packages/shared/src/types/`

## Terminologi

- **Entreprise:** Kontrakt/arbeidspakke utført av en entreprenør/UE i et prosjekt
- **Oppretter (creator):** Entreprisen som initierer en sjekkliste/oppgave
- **Svarer (responder):** Entreprisen som mottar og besvarer
- **UE:** Underentreprenør
- **Sjekkliste:** Strukturert dokument med objekter som fylles ut
- **Oppgave:** Enkeltstående arbeidsoppgave med ansvarlig og frist
- **Tegning:** Prosjekttegning (PDF/DWG) med versjonering
- **Rapportobjekt:** Byggeblokk i en sjekklistemal (15 typer)
- **Mal (template):** Gjenbrukbar oppskrift for sjekklister/rapporter bygget med drag-and-drop
- **Arbeidsforløp (workflow):** Navngitt kobling mellom en entreprise og et sett maler (oppgave-/sjekklistetyper)
- **Box:** Filstruktur/dokumenthåndteringsmodul med rekursiv mappestruktur
- **Bygning:** Fysisk bygning i et prosjekt, med tilknyttede tegninger

## Språk

- All kode, kommentarer, UI-tekst, dokumentasjon og commit-meldinger skal skrives på **norsk**
- Variabelnavn og tekniske identifikatorer kan være på engelsk der det er naturlig (f.eks. `id`, `status`, `config`)
- Brukervendt tekst (knapper, labels, feilmeldinger, hjelpetekst) skal ALLTID være på norsk

## Viktige regler

- ALDRI commit `.env`-filer
- Bilder skal ALLTID komprimeres før opplasting (mål 300–400 KB)
- Alle database-endringer via Prisma-migreringer, aldri manuell SQL
- Entreprisevelger-objektet MÅ ha rolle-konfigurasjon (`creator` eller `responder`)
- GPS-tagging er på som standard, men må kunne deaktiveres per objekt
- Prosjektnummer må være unike og genereres automatisk
- Alle API-endepunkter må ha Zod-validering og auth-middleware
- Mobil-appen må fungere fullt offline — test alltid med flymodus
