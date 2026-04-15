# Timeregistrering — Fase 3

## Formål

Timeregistrering for ansatte på byggeprosjekter. Offline-first — feltarbeidere registrerer timer uten nettdekning, synkroniserer når dekning er tilbake. Registrering fra mobil, administrasjon fra web.

## Appstruktur

| Komponent | Plassering | Beskrivelse |
|-----------|------------|-------------|
| **Web** | `apps/timer` | Next.js, `timer.sitedoc.no` — administrasjon, rapporter, eksport |
| **Mobil** | Isolert modul i `apps/mobile` | React Native, offline-first via SQLite — daglig registrering |
| **Database** | `packages/db-timer` | Eget Prisma-skjema, aldri inn i `packages/db` |

Deler PostgreSQL-instans med SiteDoc, men helt separate tabeller. Delt auth via eksisterende `sessions`-tabell.

## Dagsseddel-modell

Én **dagsseddel** per arbeidsdag samler alt: arbeidstimer, lønnsarter, reisetid, tillegg, maskinbruk og materialforbruk.

### Prinsipp

Systemet skiller alltid mellom:
- **Arbeidstid** — grunnlag for overtidsberegning (normaltid + overtid)
- **Betalte tillegg** — reisetid, kost, natt, helg — teller IKKE som arbeidstid
- **Maskinbruk** — timer per maskin med valgfri mengde
- **Materialforbruk** — mengde med enhet

Disse er separate kolonner i eksport til lønnssystem.

### Lønnsarter

| Kode | Navn | Type | Beskrivelse |
|------|------|------|-------------|
| NT | Normaltid | Arbeidstid | Ordinær arbeidstid (opp til dagsnorm) |
| OT50 | Overtid 50% | Arbeidstid | 50% tillegg utover dagsnorm |
| OT100 | Overtid 100% | Arbeidstid | 100% tillegg (kveld, natt, helg) |

**Overtidsberegning:** Systemet foreslår fordeling basert på totaltimer og konfigurerbar dagsnorm (default 7,5t). Brukeren kan overstyre.

Eksempel: 10t totalt → normaltid 7,5t, 50% 2,5t. Bruker justerer til 8t + 2t.

### Tillegg (ikke arbeidstid)

| Kode | Navn | Type | Beskrivelse |
|------|------|------|-------------|
| RT | Reisetid | Timer | Betales som arbeidstid (timesats), men inngår IKKE i overtidsberegning |
| OTM | Overtidsmat | Avhuking | Fast sats per dag. Utløses automatisk når arbeidstimer > terskel (konfigurerbart, default 9t) |
| NATT | Nattillegg | Avhuking | Fast sats, manuell avhuking |
| HELG | Helgetillegg | Avhuking | Fast sats, manuell avhuking |

**Reisetid:** Registreres separat. 1t reisetid + 8t arbeid = 8t normalarbeid + 1t reisetid betalt separat. Reisetiden påvirker ikke når overtid utløses.

**Overtidsmat:** Beløp defineres av admin per enterprise (tariffavtale). Avhukingen utløses automatisk men kan overstyres.

### UX-flyt — dagsseddel (mobil)

```
┌─────────────────────────────────────────────┐
│  Dagsseddel — 16. april 2026               │
│  Prosjekt: E6 Kvænangsfjellet              │
├─────────────────────────────────────────────┤
│                                             │
│  Arbeidstimer:    [10.0]                    │
│    Normaltid      [8.0]  ← auto-beregnet   │
│    50%            [2.0]  ← auto-beregnet   │
│    100%           [0.0]                     │
│                                             │
│  Reisetid:        [1.0]  (betales separat)  │
│                                             │
│  Tillegg:                                   │
│  ☑ Overtidsmat   (auto: arbeidstimer > 9t)  │
│  ☐ Nattillegg                               │
│  ☐ Helgetillegg                             │
│                                             │
│  MASKINER              Timer    Mengde      │
│  ┌───────────────────┬────────┬───────────┐ │
│  │ Lastebil ▾        │ [2  ] │ [10] m3 ▾ │ │
│  │ Hjullaster ▾      │ [2  ] │           │ │
│  │ Kantsteinsetter ▾ │ [4  ] │ [40] m  ▾ │ │
│  │ + Legg til maskin                      │ │
│  └───────────────────┴────────┴───────────┘ │
│                                             │
│  MATERIALER (valgfritt)                     │
│  ┌───────────────────┬────────┬───────────┐ │
│  │ Grus              │ [10] │ m3 ▾      │ │
│  │ + Legg til materiale                   │ │
│  └───────────────────┴────────┴───────────┘ │
│                                             │
│  Beskrivelse: [Graving + kantstein langs...]│
│                                     [Lagre] │
└─────────────────────────────────────────────┘
```

**Smarte valg som minimerer inntasting:**

1. **Totaltimer øverst** — brukeren taster inn totaltimer, systemet fordeler automatisk på normaltid/50%/100%
2. **Maskiner** — nedtrekk fra maskinregisteret (kun maskiner tilordnet prosjektet). Sist brukte øverst
3. **Enhet** — auto-foreslått fra maskintype (kantsteinsetter → m, lastebil → m3). Kan overstyres
4. **Tillegg** — avhukinger, ikke tallfelt. Overtidsmat auto-utløst
5. **Kopiér forrige dag** — én knapp som dupliserer gårsdagens seddel
6. **Materialer** — fritekst + mengde + enhet-dropdown (m3/m2/tonn/kg/m)

## Database — `packages/db-timer`

### Hovedtabell: `daily_sheets` (dagsseddel)

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | Server-generert ID |
| `clientUuid` | `uuid` UNIQUE | Klient-generert UUID for idempotent upsert |
| `userId` | `uuid` FK → `users` | Hvem registrerte |
| `enterpriseId` | `uuid` FK → `dokumentflyt_parts` | Faggruppe (isolerer data) |
| `projectId` | `uuid` FK → `projects` | Prosjekt |
| `dato` | `date` | Arbeidsdag |
| `normaltid` | `decimal` | Timer normaltid |
| `overtid50` | `decimal` default 0 | Timer 50% overtid |
| `overtid100` | `decimal` default 0 | Timer 100% overtid |
| `reisetid` | `decimal` default 0 | Timer reisetid (ikke arbeidstid) |
| `overtidsmat` | `boolean` default false | Overtidsmat utløst |
| `nattillegg` | `boolean` default false | Nattillegg |
| `helgetillegg` | `boolean` default false | Helgetillegg |
| `beskrivelse` | `text?` | Fritekst |
| `syncStatus` | `text` | `pending` \| `synced` \| `conflict` |
| `syncedAt` | `timestamptz?` | Siste vellykket synkronisering |
| `godkjentAv` | `uuid?` FK → `users` | Leder som godkjente |
| `godkjentVed` | `timestamptz?` | Tidspunkt for godkjenning |
| `createdAt` | `timestamptz` | |
| `updatedAt` | `timestamptz` | |

**Indekser:** `(userId, projectId, dato)` UNIQUE, `(enterpriseId)`, `(clientUuid)` UNIQUE

### `sheet_machines` (maskinbruk per dagsseddel)

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | |
| `sheetId` | `uuid` FK → `daily_sheets` | |
| `vehicleId` | `uuid` FK → `vehicles` (maskin-modul) | |
| `timer` | `decimal` | Timer brukt |
| `mengde` | `decimal?` | Valgfri mengde |
| `enhet` | `text?` | m3, m2, tonn, kg, m |

### `sheet_materials` (materialforbruk per dagsseddel)

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | |
| `sheetId` | `uuid` FK → `daily_sheets` | |
| `navn` | `text` | Materialnavn (fritekst) |
| `mengde` | `decimal` | Antall |
| `enhet` | `text` | m3, m2, tonn, kg, m |

### `enterprise_settings` (tilleggskonfigurasjon per enterprise)

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | |
| `enterpriseId` | `uuid` FK → `dokumentflyt_parts` | |
| `dagsnorm` | `decimal` default 7.5 | Timer normaldag |
| `overtidsmatTerskel` | `decimal` default 9.0 | Timer før overtidsmat utløses |
| `overtidsmatSats` | `decimal?` | Fast beløp for overtidsmat (tariffavtale) |
| `nattilleggSats` | `decimal?` | Fast beløp for nattillegg |
| `helgetilleggSats` | `decimal?` | Fast beløp for helgetillegg |

## Sync-strategi — offline-first

### Mobil → Server

1. **Lokal lagring:** SQLite via Drizzle (samme mønster som resten av mobil-appen)
2. **Registrering:** Bruker oppretter dagsseddel lokalt med `clientUuid` og `syncStatus: "pending"`
3. **Batch-sync:** Når nettdekning er tilbake, sender alle `pending`-poster til API
4. **Idempotent upsert:** API bruker `clientUuid` for å unngå duplikater — `ON CONFLICT (clientUuid) DO UPDATE`
5. **Bekreftelse:** Server returnerer synkroniserte poster med `syncStatus: "synced"` og `syncedAt`

### Konfliktløsning

**Server-wins:** Hvis en dagsseddel er godkjent av leder og klienten sender en oppdatering, vinner server-versjonen. Klient merkes med `syncStatus: "conflict"` og brukeren informeres.

| Scenario | Løsning |
|----------|---------|
| Ny dagsseddel fra klient | Upsert via `clientUuid` |
| Klient redigerer usynkronisert seddel | Oppdater lokalt, sync ved neste batch |
| Klient redigerer godkjent seddel | `conflict` — godkjente sedler kan ikke endres |
| Server har nyere versjon | `conflict` — bruker informeres |

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
| **Enterprise-isolering** | `enterpriseId` på alle dagssedler. Samme mønster som resten av SiteDoc |
| **Prosjektisolering** | `projectId` filtrerer alltid. Ingen data lekker mellom prosjekter |
| **Ledervisning** | Firmaansvarlig ser ansattes dagssedler i sin faggruppe |
| **Admin** | Prosjektadmin ser alle dagssedler i prosjektet |
| **Godkjenning** | Leder godkjenner dagssedler → `godkjentAv` + `godkjentVed` |

## API-ruter (planlagt)

| Rute | Metode | Beskrivelse |
|------|--------|-------------|
| `timer.registrer` | Mutation | Opprett/upsert dagsseddel (idempotent via clientUuid) |
| `timer.oppdater` | Mutation | Endre dagsseddel (kun egne, kun ikke-godkjente) |
| `timer.slett` | Mutation | Slett dagsseddel (kun egne, kun ikke-godkjente) |
| `timer.hentMine` | Query | Mine dagssedler, filtrert på prosjekt/periode |
| `timer.hentForProsjekt` | Query | Alle dagssedler i prosjekt (admin/leder) |
| `timer.godkjenn` | Mutation | Godkjenn dagsseddel (leder) |
| `timer.avvis` | Mutation | Avvis med kommentar (leder) |
| `timer.syncBatch` | Mutation | Batch-upsert fra mobil (array av clientUuid-dagssedler med maskiner/materialer) |
| `timer.hentInnstillinger` | Query | Enterprise-innstillinger (dagsnorm, satser) |
| `timer.oppdaterInnstillinger` | Mutation | Endre enterprise-innstillinger (admin) |

## Ikke avklart

- Eksport-format (Excel, CSV, lønnssystem-integrasjon — Visma, Tripletex?)
- GPS-validering — skal posisjonen ved registrering logges for å verifisere at arbeideren var på byggeplassen?
- Akkord — trenger modulen støtte for akkordlønn i tillegg til timepris?
