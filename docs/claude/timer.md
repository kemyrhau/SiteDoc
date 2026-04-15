# Timeregistrering — Fase 3

## Formål

Timeregistrering for ansatte på byggeprosjekter. Offline-first — feltarbeidere registrerer timer uten nettdekning, synkroniserer når dekning er tilbake.

## Appstruktur

| Komponent | Plassering | Beskrivelse |
|-----------|------------|-------------|
| **Web** | `apps/timer` | Next.js, `timer.sitedoc.no` |
| **Mobil** | Isolert modul i `apps/mobile` | React Native, offline-first via SQLite |
| **Database** | `packages/db-timer` | Eget Prisma-skjema, aldri inn i `packages/db` |

Deler PostgreSQL-instans med SiteDoc, men helt separate tabeller. Delt auth via eksisterende `sessions`-tabell.

## Database — `packages/db-timer`

### Hovedtabell: `time_entries`

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | Server-generert ID |
| `clientUuid` | `uuid` UNIQUE | Klient-generert UUID for idempotent upsert |
| `userId` | `uuid` FK → `users` | Hvem registrerte |
| `enterpriseId` | `uuid` FK → `dokumentflyt_parts` | Faggruppe (isolerer data) |
| `projectId` | `uuid` FK → `projects` | Prosjekt |
| `startAt` | `timestamptz` | Start-tidspunkt |
| `endAt` | `timestamptz?` | Slutt-tidspunkt (null = pågående) |
| `beskrivelse` | `text?` | Fritekst |
| `pauseMinutter` | `int` default 0 | Trekk fra pause |
| `syncStatus` | `enum` | `pending` \| `synced` \| `conflict` |
| `syncedAt` | `timestamptz?` | Siste vellykket synkronisering |
| `createdAt` | `timestamptz` | Opprettet |
| `updatedAt` | `timestamptz` | Sist endret |

**Indekser:** `(userId, projectId, startAt)`, `(enterpriseId)`, `(clientUuid)` UNIQUE

### Hjelpetabeller

| Tabell | Beskrivelse |
|--------|-------------|
| `time_entry_types` | Valgfrie kategorier (normal, overtid, reisetid) per prosjekt |
| `time_entry_approvals` | Godkjenning av timer (leder godkjenner ansattes timer) |

## Sync-strategi — offline-first

### Mobil → Server

1. **Lokal lagring:** SQLite via Drizzle (samme mønster som resten av mobil-appen)
2. **Registrering:** Bruker oppretter timepost lokalt med `clientUuid` og `syncStatus: "pending"`
3. **Batch-sync:** Når nettdekning er tilbake, sender alle `pending`-poster til API
4. **Idempotent upsert:** API bruker `clientUuid` for å unngå duplikater — `ON CONFLICT (clientUuid) DO UPDATE`
5. **Bekreftelse:** Server returnerer synkroniserte poster med `syncStatus: "synced"` og `syncedAt`

### Konfliktløsning

**Server-wins:** Hvis en post er endret på server (f.eks. godkjent av leder) og klienten sender en oppdatering, vinner server-versjonen. Klient merkes med `syncStatus: "conflict"` og brukeren informeres.

| Scenario | Løsning |
|----------|---------|
| Ny post fra klient | Upsert via `clientUuid` |
| Klient redigerer usynkronisert post | Oppdater lokalt, sync ved neste batch |
| Klient redigerer synkronisert post | Send oppdatering, server sjekker `updatedAt` |
| Server har nyere versjon | `conflict` — bruker velger |

### Synk-intervall

- **Aktiv app:** Sync hvert 30. sekund når nettdekning finnes
- **Bakgrunn:** Expo BackgroundFetch (minimum 15 min intervall på iOS)
- **Manuell:** Pull-to-refresh trigger

## Auth

Delt auth via eksisterende `next-auth` sessions-tabell i `packages/db`. Timer-API validerer session-token mot samme tabell. Ingen egen innlogging — brukeren er allerede logget inn i SiteDoc.

**Viktig:** `packages/db-timer` har INGEN `users`-tabell — refererer kun via `userId` FK til `packages/db`.

## Tilgangsstyring

| Prinsipp | Implementasjon |
|----------|---------------|
| **Enterprise-isolering** | `enterpriseId` på alle time-poster. Samme mønster som resten av SiteDoc |
| **Prosjektisolering** | `projectId` filtrerer alltid. Ingen data lekker mellom prosjekter |
| **Ledervisning** | Firmaansvarlig ser ansattes timer i sin faggruppe |
| **Admin** | Prosjektadmin ser alle timer i prosjektet |
| **Godkjenning** | Leder godkjenner timer → `time_entry_approvals` |

## API-ruter (planlagt)

| Rute | Metode | Beskrivelse |
|------|--------|-------------|
| `timer.registrer` | Mutation | Opprett/upsert timepost (idempotent via clientUuid) |
| `timer.oppdater` | Mutation | Endre timepost (kun egne, kun ikke-godkjente) |
| `timer.slett` | Mutation | Slett timepost (kun egne, kun ikke-godkjente) |
| `timer.hentMine` | Query | Mine timer, filtrert på prosjekt/periode |
| `timer.hentForProsjekt` | Query | Alle timer i prosjekt (admin/leder) |
| `timer.godkjenn` | Mutation | Godkjenn ansattes timer (leder) |
| `timer.avvis` | Mutation | Avvis med kommentar (leder) |
| `timer.syncBatch` | Mutation | Batch-upsert fra mobil (array av clientUuid-poster) |

## Ikke avklart

- Eksport-format (Excel, CSV, lønnssystem-integrasjon)
- Akkord vs timepris — trenger malen støtte for ulike avlønningsmodeller?
- GPS-validering — skal posisjonen ved inn/utstempling logges for å verifisere at arbeideren var på byggeplassen?
- Integrasjon med maskin-modulen — timer knyttet til maskinbruk?
