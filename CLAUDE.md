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
- **Auth:** Clerk (rollebasert tilgang)
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
│   ├── mobile/         # Expo React Native app
│   └── api/            # Fastify backend
├── packages/
│   ├── shared/         # Delte typer, utils, validering (Zod)
│   ├── db/             # Prisma schema, migreringer, seed
│   └── ui/             # Delte UI-komponenter
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

Kjernetabeller: `projects`, `enterprises`, `drawings`, `report_templates`, `report_objects`, `checklists`, `tasks`, `document_transfers`, `images`, `folders`, `documents`, `users`.

Viktige relasjoner:
- Sjekklister og oppgaver har ALLTID `creator_enterprise_id` (oppretter) og `responder_enterprise_id` (svarer)
- `document_transfers` logger all sending mellom entrepriser med full sporbarhet
- Bilder har valgfri GPS-data (`gps_lat`, `gps_lng`, `gps_enabled`)

### Entrepriseflyt

Sentral forretningslogikk. Dokumenter (sjekklister/oppgaver) flyter mellom entrepriser:

Statusverdier: `draft` → `sent` → `received` → `in_progress` → `responded` → `approved` | `rejected` → `closed`

- Oppretter-entreprise initierer og godkjenner/avviser
- Svar-entreprise mottar, fyller ut og besvarer
- Alle overganger logges i `document_transfers`

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

## Kodestil

- TypeScript strict mode, ingen `any`
- Named exports, ikke default exports (unntak: Next.js pages/layouts)
- Zod-validering på alle API-endepunkter og skjemadata
- Prisma for server-side DB, Drizzle for lokal SQLite
- Alle API-ruter i `apps/api/src/routes/`
- Alle Expo-skjermer i `apps/mobile/src/screens/`
- Komponenter i `packages/ui/src/`
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
