# Maskin- og utstyrsregister — Fase 3

## Formål

Maskin- og utstyrsregister med vedlikeholdsplan, EU-kontroll-varsling og GPS-sporing for byggeprosjekter. Dekker alt fra registreringspliktige kjøretøy til anleggsmaskiner til småutstyr og verktøy — firmaet bestemmer selv hva de vil registrere.

## Tre kategorier

```
┌─────────────────────────────────────────────────────────────────┐
│  1. KJØRETØY (registreringspliktig)                              │
│     Volvo V70, Toyota Hilux, Volvo FH16, Mercedes Sprinter       │
│     → Vegvesen-oppslag, EU-kontroll, reg.nr, km-stand            │
│                                                                  │
│  2. ANLEGGSMASKINER (store, med serienummer)                     │
│     CAT 320, Komatsu PC210, Volvo EC220E, Liebherr LTM 1100     │
│     → Driftstimer, telematikk, skuffekapasitet, løftekapasitet   │
│                                                                  │
│  3. SMÅUTSTYR OG VERKTØY                                        │
│     Boremaskin, komprimator, steinsag, laser, GPS-utstyr,        │
│     aggregat, sveiseapparat, kompressor, stillasdeler             │
│     → Internummer, plassering, kalibrering, antall, utlån        │
└─────────────────────────────────────────────────────────────────┘
```

Alle tre deler: **merke, modell, serienummer/internummer, plassering, ansvarlig, status, vedlikehold**. Kategori-felt styrer hvilke felter som er relevante i UI.

### Maskintyper per kategori

| Kategori | Type | Eksempler |
|----------|------|-----------|
| **Kjøretøy** | `personbil` | Volvo V70, Toyota Corolla |
| | `varebil` | Toyota Hilux, VW Crafter, Mercedes Sprinter |
| | `lastebil` | Volvo FH16, Scania R500 |
| | `tilhenger` | Brenderup, Ifor Williams |
| **Anleggsmaskin** | `gravemaskin` | CAT 320, Volvo EC220E, Komatsu PC210 |
| | `hjullaster` | Volvo L90, CAT 950M |
| | `dumper` | Volvo A30G, CAT 730 |
| | `kran` | Liebherr LTM 1100, Grove GMK |
| | `komprimator_stor` | Bomag BW213, Dynapac CA2500 |
| | `dozer` | CAT D6, Komatsu D65 |
| | `grader` | CAT 140M, Volvo G946 |
| | `asfaltlegger` | Vögele Super 1800, Volvo P6820 |
| | `materialhåndterer` | Fuchs MHL350, Liebherr LH 22 |
| | `boremaskin_stor` | Atlas Copco FlexiROC, Sandvik |
| **Småutstyr** | `komprimator` | Hoppetusse (vibrasjonsplate/-stampe) |
| | `aggregat` | Honda EU22i, Atlas Copco QAS |
| | `kompressor` | Atlas Copco XAS, Kaeser M27 |
| | `boremaskin` | Hilti TE 70, Bosch GBH |
| | `steinsag` | Stihl TS 420, Husqvarna K770 |
| | `sveiseapparat` | Lincoln, ESAB |
| | `laser` | Leica, Topcon, Trimble |
| | `gps_utstyr` | Trimble, Leica iCON |
| | `stillas` | Haki, Layher |
| | `pumpe` | Grindex, Flygt |
| | `annet` | Fritekst — bruker beskriver |

## Appstruktur

| Komponent | Plassering | Beskrivelse |
|-----------|------------|-------------|
| **Web** | `apps/maskin` | Next.js, `maskin.sitedoc.no` |
| **Database** | `packages/db-maskin` | Eget Prisma-skjema, aldri inn i `packages/db` |

Deler PostgreSQL-instans med SiteDoc, men helt separate tabeller. Delt auth via eksisterende `sessions`-tabell.

## Statens vegvesen — kjøretøyoppslag

### API-tilgang

| | Verdi |
|---|---|
| **Endepunkt** | `https://www.vegvesen.no/ws/no/vegvesen/kjoretoy/felles/datautlevering/enkeltoppslag/kjoretoydata` |
| **Autentisering** | Header: `SVV-Authorization: Apikey <nøkkel>` |
| **Parameter** | `?kjennemerke=ZH44186` (uten mellomrom) |
| **Env-variabel** | `VEGVESEN_API_KEY` i `apps/api/.env` |
| **Rate-limit** | Maks 50 000 kall/dag |
| **Swagger** | `https://autosys-kjoretoy-api.atlas.vegvesen.no/swagger-ui/index-enkeltoppslag.html` |

API-nøkkel er på plass og verifisert (2026-04-17).

### Datamapping — Vegvesen → SiteDoc

Vegvesen returnerer et stort JSON-objekt. Følgende felt mappes til `vehicles`-tabellen:

| Vegvesen JSON-sti | SiteDoc-felt | Eksempel |
|---|---|---|
| `kjoretoyId.kjennemerke` | `registreringsnummer` | ZH 44186 |
| `kjoretoyId.understellsnummer` | `vin` | YV1BW848BF1332433 |
| `tekniskeData.generelt.merke[0].merke` | `merke` | VOLVO |
| `tekniskeData.generelt.handelsbetegnelse[0]` | `modell` | V70 |
| `forstegangsregistrering.registrertForstegangNorgeDato` | `forstegangsRegistrert` | 2015-05-12 |
| `registrering.registrertForstegangPaEierskap` | `registrertPaEier` | 2018-04-24 |
| `registrering.registreringsstatus.kodeNavn` | `status` | Registrert |
| `tekniskeData.kjoretoyklassifisering.tekniskKode.kodeVerdi` | `kjoretoygruppe` | M1 |
| `tekniskeData.kjoretoyklassifisering.tekniskKode.kodeNavn` | `kjoretoygruppeNavn` | Personbil |
| `tekniskeData.kjoretoyklassifisering.karosseritype.kodeNavn` | `karosseritype` | Stasjonsvogn (AC) |
| `tekniskeData.karosseriOgLasteplan.rFarge[0].kodeNavn` | `farge` | Blå |
| `tekniskeData.persontall.sitteplasserTotalt` | `antallSeter` | 5 |
| `tekniskeData.motorOgDrivverk.motor[0].drivstoff[0].drivstoffKode.kodeNavn` | `drivstoff` | Diesel |
| `tekniskeData.motorOgDrivverk.motor[0].slagvolum` | `slagvolum` | 1560 |
| `tekniskeData.motorOgDrivverk.motor[0].drivstoff[0].maksNettoEffekt` | `effektKw` | 84 |
| `tekniskeData.motorOgDrivverk.motor[0].motorKode` | `motorKode` | D4162T |
| `tekniskeData.motorOgDrivverk.motor[0].antallSylindre` | `antallSylindre` | 4 |
| `tekniskeData.motorOgDrivverk.girkassetype.kodeNavn` | `girkasse` | Automat |
| `tekniskeData.motorOgDrivverk.hybridKategori.kodeNavn` | `hybrid` | Ingen |
| `tekniskeData.miljodata.miljoOgdrivstoffGruppe[0].forbrukOgUtslipp[0].forbrukBlandetKjoring` | `forbrukLiterPer10km` | 4.2 |
| `tekniskeData.miljodata.miljoOgdrivstoffGruppe[0].forbrukOgUtslipp[0].co2BlandetKjoring` | `co2GramPerKm` | 111 |
| `tekniskeData.miljodata.euroKlasse.kodeNavn` | `euroKlasse` | Euro 5L |
| `tekniskeData.vekter.egenvekt` | `egenvekt` | 1670 |
| `tekniskeData.vekter.tillattTotalvekt` | `totalvekt` | 2240 |
| `tekniskeData.vekter.nyttelast` | `nyttelast` | 495 |
| `tekniskeData.vekter.tillattTilhengervektMedBrems` | `tilhengervektMedBrems` | 1300 |
| `tekniskeData.vekter.tillattTilhengervektUtenBrems` | `tilhengervektUtenBrems` | 750 |
| `tekniskeData.vekter.tillattVogntogvekt` | `vogntogvekt` | 3540 |
| `tekniskeData.vekter.tillattTaklast` | `taklast` | 100 |
| `tekniskeData.dimensjoner.lengde` | `lengdeCm` | 4814 |
| `tekniskeData.dimensjoner.bredde` | `breddeCm` | 1861 |
| `periodiskKjoretoyKontroll.sistGodkjent` | `euKontrollSistGodkjent` | 2025-07-16 |
| `periodiskKjoretoyKontroll.kontrollfrist` | `euKontrollFrist` | 2027-07-16 |

**Rå JSON lagres alltid** i `vegvesenData` — parsede felt kopieres til egne kolonner for søk/filter/visning.

### Registreringsflyt

```
Bruker taster registreringsnummer: [ZH44186]  [Søk]
  ↓
API-kall til Vegvesen
  ↓
Forhåndsvisning:
  ┌───────────────────────────────────────────────┐
  │  VOLVO V70 — Stasjonsvogn (Blå)               │
  │  Diesel 1560 cm³, 84 kW (114 hk), Automat     │
  │  Totalvekt: 2240 kg, Nyttelast: 495 kg         │
  │  Seter: 5                                      │
  │  EU-kontroll: frist 16.07.2027                 │
  │  Første gang reg: 12.05.2015                   │
  │                                                │
  │  [Registrer kjøretøy]        [Avbryt]          │
  └───────────────────────────────────────────────┘
  ↓
Bruker bekrefter → vehicle opprettet med alle felt fylt inn
```

Kjøretøy uten registreringsnummer (anleggsmaskiner, gravemaskiner) registreres manuelt uten Vegvesen-oppslag.

## Database — `packages/db-maskin`

### `equipment` — alt utstyr (kjøretøy, maskiner, verktøy)

Én tabell for alle tre kategorier. `kategori`-felt styrer hvilke felter som er relevante.

#### Felles felt (alle kategorier)

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | |
| `organizationId` | `uuid` FK → `organizations` | Eier-firma (isolerer data) |
| `kategori` | `text` | `kjoretoy`, `anleggsmaskin`, `smautstyr` |
| `type` | `text` | Se maskintype-tabell over |
| `merke` | `text` | Volvo, CAT, Hilti, Trimble |
| `modell` | `text` | V70, EC220E, TE 70, S9 |
| `internNavn` | `text?` | Kallenavn ("Stor-Volvo", "Graver 3", "Laser 2") |
| `internNummer` | `text?` | Firmaets eget inventarnummer |
| `serienummer` | `text?` | Produsent-serienummer / PIN |
| `aarsmodell` | `int?` | Produksjonsår |
| `farge` | `text?` | |
| `drivstoff` | `text?` | Diesel, Bensin, Elektrisk, Hybrid, Batteri, Ingen |
| `bilde` | `text?` | Filreferanse til bilde |
| `status` | `text` | `aktiv`, `vedlikehold`, `utlånt`, `avregistrert`, `kassert` |
| `notat` | `text?` | Fritekst |
| `antall` | `int` @default(1) | For småutstyr: "10 stk vibrasjonsplater" |
| `createdAt` | `timestamptz` | |
| `updatedAt` | `timestamptz` | |

#### Kjøretøy-felt (kategori = `kjoretoy`)

| Felt | Type | Kilde | Beskrivelse |
|------|------|-------|-------------|
| `registreringsnummer` | `text?` UNIQUE | Vegvesen | ZH 44186 |
| `vin` | `text?` | Vegvesen | Understellsnummer |
| `kjoretoygruppe` | `text?` | Vegvesen | M1, N1, N2, N3, T |
| `kjoretoygruppeNavn` | `text?` | Vegvesen | Personbil, Varebil, Lastebil |
| `karosseritype` | `text?` | Vegvesen | Stasjonsvogn, Lukket kasse |
| `antallSeter` | `int?` | Vegvesen | Maks ansatte i kjøretøy |
| `forstegangsRegistrert` | `date?` | Vegvesen | |
| `registrertPaEier` | `date?` | Vegvesen | |
| `slagvolum` | `int?` | Vegvesen | cm³ |
| `effektKw` | `decimal?` | Vegvesen | kW |
| `motorKode` | `text?` | Vegvesen | D4162T |
| `antallSylindre` | `int?` | Vegvesen | |
| `girkasse` | `text?` | Vegvesen | Automat, Manuell |
| `hybrid` | `text?` | Vegvesen | Ingen, Hybrid, Plugin-hybrid |
| `forbrukLiterPer10km` | `decimal?` | Vegvesen | |
| `co2GramPerKm` | `decimal?` | Vegvesen | |
| `euroKlasse` | `text?` | Vegvesen | Euro 5L, Euro 6, Stage V |
| `egenvekt` | `int?` | Vegvesen | kg |
| `totalvekt` | `int?` | Vegvesen | kg |
| `nyttelast` | `int?` | Vegvesen | kg |
| `tilhengervektMedBrems` | `int?` | Vegvesen | kg |
| `tilhengervektUtenBrems` | `int?` | Vegvesen | kg |
| `vogntogvekt` | `int?` | Vegvesen | kg |
| `taklast` | `int?` | Vegvesen | kg |
| `lengdeCm` | `int?` | Vegvesen | cm |
| `breddeCm` | `int?` | Vegvesen | cm |
| `euKontrollSistGodkjent` | `date?` | Vegvesen | |
| `euKontrollFrist` | `date?` | Vegvesen | |
| `kilometerstand` | `int?` | Manuell/GPS | Sist registrerte km |
| `vegvesenData` | `JSON?` | Vegvesen | Komplett rå JSON |
| `vegvesenOppdatert` | `timestamptz?` | System | Sist hentet |

#### Anleggsmaskin-felt (kategori = `anleggsmaskin`)

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `motorSerienummer` | `text?` | Eget serienummer for motor |
| `effektKw` | `decimal?` | Motoreffekt kW |
| `slagvolum` | `int?` | cm³ |
| `euroKlasse` | `text?` | Stage V, Tier 4 |
| `operasjonsvekt` | `int?` | Driftsvekt med fører (kg) |
| `loftekapasitet` | `int?` | Maks løftekapasitet (kg) |
| `skuffekapasitet` | `decimal?` | m³ (gravemaskin/laster) |
| `lastekapasitet` | `int?` | tonn (dumper) |
| `rekkevidde` | `decimal?` | Maks graveradius/løftehøyde (m) |
| `storrelsesklasse` | `text?` | mini, mellom, stor, ekstra_stor |
| `driftstimer` | `int?` | Sist registrerte driftstimer |
| `tomgangstimer` | `int?` | Kumulativ tomgangstid |
| `totalForbrukLiter` | `decimal?` | Totalt drivstofforbruk siden ny |
| `telematikkId` | `text?` | KOMTRAX/Product Link/ActiveCare ID |
| `telematikkLeverandor` | `text?` | Komatsu, CAT, Volvo |

#### Småutstyr-felt (kategori = `smautstyr`)

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `kalibreringsDato` | `date?` | Sist kalibrert (laser, GPS) |
| `kalibreringsFrist` | `date?` | Neste kalibrering |
| `sertifiseringsDato` | `date?` | Sist sertifisert (løfteutstyr, sveis) |
| `sertifiseringsFrist` | `date?` | Neste sertifisering |
| `effektW` | `int?` | Watt (aggregat, kompressor) |
| `vekt` | `int?` | kg |

**Indekser:** `(organizationId)`, `(registreringsnummer)` UNIQUE WHERE NOT NULL, `(kategori)`, `(type)`, `(status)`, `(euKontrollFrist)`, `(internNummer)`

### `service_records` — servicehistorikk

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | |
| `equipmentId` | `uuid` FK → `equipment` | |
| `type` | `text` | `service`, `repair`, `inspection`, `eu_kontroll`, `dekk`, `olje` |
| `dato` | `date` | Utført dato |
| `km` | `int?` | Kilometerstand |
| `timer` | `int?` | Driftstimer (anleggsmaskiner) |
| `utfortAv` | `text?` | Verksted/person |
| `beskrivelse` | `text` | Hva ble gjort |
| `kostnad` | `decimal?` | Kostnad i NOK |
| `nesteServiceDato` | `date?` | Planlagt neste service |
| `nesteServiceKm` | `int?` | Neste service ved km-stand |
| `nesteServiceTimer` | `int?` | Neste service ved driftstimer |
| `vedlegg` | `JSON?` | Filreferanser (fakturaer, bilder) |
| `createdAt` | `timestamptz` | |

### `gps_events` — posisjonsdata

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | |
| `equipmentId` | `uuid` FK → `equipment` | |
| `latitude` | `float` | |
| `longitude` | `float` | |
| `altitude` | `float?` | Meter over havet |
| `speed` | `float?` | km/t |
| `heading` | `float?` | Retning 0-360 |
| `engineOn` | `boolean?` | Motor på/av (hvis leverandør støtter) |
| `timestamp` | `timestamptz` | Tidspunkt fra GPS-enhet |
| `source` | `text` | `webfleet`, `transpoco`, `manual` |
| `raw` | `JSON?` | Rå payload fra leverandør |
| `createdAt` | `timestamptz` | Mottatt av SiteDoc |

**Indekser:** `(vehicleId, timestamp)`, partisjonert på `timestamp` (månedsvis) for ytelse

**Retensjon:** GPS-events eldre enn 12 måneder aggregeres til daglig oppsummering og slettes.

### `equipment_assignments` — utstyr-tilordning

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | |
| `equipmentId` | `uuid` FK → `equipment` | |
| `projectId` | `uuid` FK → `projects` | Tilordnet prosjekt |
| `byggeplassId` | `uuid?` FK → `byggeplasser` | Tilordnet byggeplass (via innsjekk) |
| `userId` | `uuid?` FK → `users` | Ansvarlig fører |
| `fraDate` | `date` | Fra dato |
| `tilDate` | `date?` | Til dato (null = pågående) |
| `kilde` | `text` | `manuell`, `geofence` |
| `createdAt` | `timestamptz` | |

## EU-kontroll — varsling

> **Merk:** Varsling for EU-kontroll, service og sertifisering leveres av det tverrgående varslingssystemet (se `docs/claude/varsling.md`). Maskin-modulen leverer data, varslingssystemet håndterer regler, mottakere og kanaler.

### Kjøretøygrupper og intervaller

| Gruppe | Kode | Beskrivelse | EU-intervall |
|--------|------|-------------|--------------|
| Personbil | M1 | Inntil 8 passasjerer | 4-2-2 (første etter 4 år, deretter hvert 2. år) |
| Varebil | N1 | Godstransport ≤3500 kg | 4-2-2 |
| Lastebil | N2/N3 | Godstransport >3500 kg | 1-1-1 (årlig) |
| Buss | M2/M3 | >8 passasjerer | 1-1-1 |
| Tilhenger ≤3500 | O1/O2 | Lett tilhenger | Unntatt / 2-2-2 |
| Tilhenger >3500 | O3/O4 | Tung tilhenger | 1-1-1 |

### Varslingsregler

```
EU-kontroll frist nærmer seg:
  3 måneder før  → gul varsling i maskinlisten
  1 måned før    → oransje varsling + push til ansvarlig
  Forfalt        → rød varsling + push til leder + blokkér tilordning?

Vegvesen-data oppdateres:
  Automatisk ved innlogging (maks 1 gang per dag per kjøretøy)
  Manuell knapp: "Oppdater fra Vegvesen"
  Etter EU-kontroll: ny frist hentes automatisk
```

### Varslings-UI

```
┌─────────────────────────────────────────────────────────────┐
│  Maskinoversikt                                              │
│                                                              │
│  ⚠ 2 kjøretøy trenger oppmerksomhet                         │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ ZH 44186  Volvo V70        EU: 16.07.2027  ✅ 15 mnd │  │
│  │ AB 12345  Toyota Hilux     EU: 01.03.2026  🟡 -1 mnd │  │
│  │ CD 67890  CAT 320          Ikke reg.pliktig    —      │  │
│  │ EF 11111  Volvo FH16       EU: 15.02.2026  🔴 Forfalt│  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Vedlikeholdsplan

### Service-intervaller

Vedlikeholdsplan er per kjøretøy/maskin — konfigureres av eier:

```
┌─────────────────────────────────────────────────────────────┐
│  Vedlikeholdsplan — ZH 44186 Volvo V70                       │
│                                                              │
│  ┌──────────────────┬──────────┬───────────┬──────────────┐ │
│  │ Type             │ Intervall│ Sist utført│ Neste        │ │
│  ├──────────────────┼──────────┼───────────┼──────────────┤ │
│  │ EU-kontroll      │ 2 år     │ 16.07.2025│ 16.07.2027 ✅│ │
│  │ Oljeskift        │ 15000 km │ 82340 km  │ 97340 km   🟡│ │
│  │ Stor service     │ 30000 km │ 75000 km  │ 105000 km  ✅│ │
│  │ Dekkbytte (vår)  │ Årlig    │ 01.04.2026│ 01.04.2027 ✅│ │
│  │ Dekkbytte (høst) │ Årlig    │ 15.10.2025│ 15.10.2026 ✅│ │
│  └──────────────────┴──────────┴───────────┴──────────────┘ │
│                                                              │
│  [+ Legg til service-type]                                   │
│                                                              │
│  Kilometerstand: [89450    ] km   [Oppdater]                │
│  Driftstimer:    [—         ]     (kun anleggsmaskiner)      │
└─────────────────────────────────────────────────────────────┘
```

### Service-typer (standard + egendefinerte)

| Type | Intervall-basis | Beskrivelse |
|------|----------------|-------------|
| `eu_kontroll` | Dato (fra Vegvesen) | Automatisk — hentes fra API |
| `olje` | Km eller timer | Oljeskift, typisk 10-20 000 km |
| `service` | Km eller timer | Generell service |
| `dekk` | Dato (sesong) | Dekkbytte vår/høst |
| `repair` | Ad hoc | Reparasjon (ikke planlagt) |
| `inspection` | Dato | Intern inspeksjon |
| `egendefinert` | Km, timer eller dato | Bruker definerer selv |

### Varsling ved service

```
Service nærmer seg:
  Km-basert:  varsel ved 90% av intervall (oljeskift 15000 km → varsel ved 13500 km)
  Dato-basert: varsel X dager/uker før (konfigurerbart)
  Timer-basert: varsel ved 90% av intervall

Varsles til:
  → Ansvarlig fører (push)
  → Maskinansvarlig/leder (push + e-post)
  → Synlig i maskinoversikt (gul/rød markering)
```

### Kilometerstand-tracking

Kilometerstand oppdateres:
1. **Manuelt** — bruker taster inn ved service eller jevnlig
2. **GPS-basert** — beregnet fra GPS-spor (sum av distanse mellom punkter)
3. **Ved service** — verksted oppgir km-stand

For anleggsmaskiner: **driftstimer** i stedet for km.

## Kjøretøykort — detaljvisning

```
┌─────────────────────────────────────────────────────────────┐
│  ZH 44186 — VOLVO V70                              [Rediger]│
│  Stasjonsvogn (AC) · Blå · Diesel                           │
│  ─────────────────────────────────────────────────────────── │
│                                                              │
│  ┌─ Registrering ──────────────────────────────────────────┐│
│  │ Reg.nr: ZH 44186        VIN: YV1BW848BF1332433         ││
│  │ Gruppe: Personbil (M1)  Første reg: 12.05.2015         ││
│  │ Reg. på eier: 24.04.2018  Status: Registrert           ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─ Motor ─────────────────────────────────────────────────┐│
│  │ Diesel 1560 cm³ (D4162T)  4 syl. rekke                 ││
│  │ 84 kW (114 hk)  Automat  Euro 5L                       ││
│  │ Forbruk: 0,42 l/10 km  CO₂: 111 g/km                  ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─ Mål og vekt ──────────────────────────────────────────┐│
│  │ 481 × 186 cm  Egenvekt: 1670 kg  Totalvekt: 2240 kg   ││
│  │ Nyttelast: 495 kg  Tilhenger: 1300 kg  Taklast: 100 kg││
│  │ Seter: 5 (maks ansatte)                                ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─ EU-kontroll ──────────────────────────────── ✅ 15 mnd ┐│
│  │ Sist godkjent: 16.07.2025                              ││
│  │ Frist: 16.07.2027                                      ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─ Vedlikehold ──────────────────────────────────────────┐│
│  │ Neste service: Oljeskift ved 97 340 km (nå: 89 450 km)││
│  │ Siste service: 12.01.2026 — Stor service (82 340 km)  ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─ Tilordning ───────────────────────────────────────────┐│
│  │ Prosjekt: NRK Bjørvika · Byggeplass: Blokk A          ││
│  │ Fører: Ola Hansen · Siden: 01.03.2026                  ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  [Oppdater fra Vegvesen]  [Servicehistorikk]  [GPS-spor]   │
└─────────────────────────────────────────────────────────────┘
```

## GPS-leverandør — adapter-interface

Leverandør er ikke avklart. Kandidater: **Webfleet** (TomTom) og **Transpoco**. Bygges med adapter-mønster slik at leverandør kan byttes uten kodeendring.

```
interface GpsAdapter {
  // Hent siste posisjon for alle kjøretøy
  hentPosisjoner(deviceIds: string[]): Promise<GpsEvent[]>

  // Registrer webhook for sanntidsoppdateringer
  registrerWebhook(callbackUrl: string): Promise<void>

  // Parse innkommende webhook-payload
  parseWebhook(payload: unknown): GpsEvent[]
}
```

Samme mønster som `BilagsKilde` i økonomi-modulen — adapter bak et interface, konkret implementasjon per leverandør.

### Dataflyt

```
GPS-enhet → Leverandør-sky → Webhook til SiteDoc API
                                    ↓
                            parseWebhook(payload)
                                    ↓
                            gps_events-tabell
                                    ↓
                            Web UI (kart, tidslinje)
```

**Fallback:** Hvis webhook er nede, polling via `hentPosisjoner()` hvert 5. minutt.

## Geofencing — via mannskapsregistrering

Geofencing for maskiner fungerer via **mannskapsregistrering**. Fører sjekker inn seg selv + maskin på byggeplass:
- Person-innsjekk → MannskapsInnsjekk (mannskap-modulen)
- Maskin-innsjekk → vehicle_assignments oppdateres (maskin tilordnet byggeplass)

Automatisk geofence-forslag via expo-location bakgrunnsposisjon (se mannskap.md).

Maskinens posisjon på kart vises fra GPS-data — geofence-inn/ut styres av fører-innsjekk.

## Tilgangsstyring

| Prinsipp | Implementasjon |
|----------|---------------|
| **Organisasjons-isolering** | `equipment.organizationId` isolerer alltid data per firma |
| **Prosjektfiltrering** | `vehicle_assignments.projectId` viser kun maskiner tilordnet prosjektet |
| **Ledervisning** | Firmaansvarlig ser alle maskiner i sin organisasjon |
| **Admin** | Prosjektadmin ser alle tilordnede maskiner |
| **GPS-data** | Arver tilgang fra `vehicles` — ser du maskinen, ser du posisjonen |

## API-ruter (planlagt)

| Rute | Beskrivelse |
|------|-------------|
| `maskin.registrer` | Nytt utstyr — alle kategorier |
| `maskin.registrerMedVegvesen` | Nytt kjøretøy + Vegvesen-oppslag |
| `maskin.oppdater` | Endre utstyrsdata |
| `maskin.vegvesenOppslag` | Slå opp reg.nr mot Vegvesen API |
| `maskin.oppdaterFraVegvesen` | Oppdater kjøretøy med ferskt Vegvesen-data |
| `maskin.hentForOrganisasjon` | Alt utstyr i firmaet (filter: kategori, type, status) |
| `maskin.hentForProsjekt` | Tilordnet utstyr i prosjekt |
| `maskin.tilordne` | Tilordne utstyr til prosjekt/byggeplass/person |
| `maskin.hentPosisjon` | Siste GPS-posisjon (kjøretøy/anleggsmaskin) |
| `maskin.hentSpor` | GPS-spor for tidsperiode |
| `maskin.registrerService` | Ny servicepost |
| `maskin.hentServicehistorikk` | Servicehistorikk for utstyr |
| `maskin.oppdaterKmEllerTimer` | Oppdater km-stand eller driftstimer |
| `maskin.hentVarsler` | EU-kontroll + service + kalibrering-varsler |
| `maskin.gpsWebhook` | Motta GPS-events fra leverandør |

## Arkitektur-oversikt

```
┌──────────────────┐
│  GPS-leverandør  │──┐
│  Webfleet/Transpoco │
├──────────────────┤  │
│  Statens vegvesen│──┼──→  apps/api (tRPC)  ──→  packages/db-maskin
│  Kjøretøyregister│  │    Auth + org-isolasjon    vehicles, gpsEvents
├──────────────────┤  │                            serviceRecords
│  Manuell input   │──┘           │
│  Service, skader │              │
└──────────────────┘              ↓
                          ┌───────────────┐     ┌──────────────┐
                          │ apps/maskin    │     │ apps/mobile  │
                          │ maskin.sitedoc │     │ Innsjekk +   │
                          │ Kart, liste,  │     │ fører-maskin  │
                          │ service, EU   │     │ kobling       │
                          └───────────────┘     └──────────────┘

db-maskin:
  equipment (3 kategorier: kjøretøy, anleggsmaskin, småutstyr)
  gpsEvents (lat, lon, ts, speed)
  serviceRecords (type, dato, km/timer, neste)
  equipmentAssignments (prosjekt, byggeplass, ansvarlig)
```

## Mobil-visning

Feltarbeidere ser maskinposisjon og status i `apps/mobile`. Viser:
- Posisjon på kart (nærmeste maskiner)
- Maskin-status (aktiv, vedlikehold, avregistrert)
- Innsjekk av maskin på byggeplass (sammen med person-innsjekk)
- EU-kontroll-frist og service-varsler

Mobil leser data via API — ingen lokal maskin-database.

## Implementeringsrekkefølge

1. **DB-skjema** — `packages/db-maskin` med equipment, service_records, equipment_assignments
2. **Registrering — alle kategorier** — opprett utstyr med kategori-valg, type-velger
3. **Vegvesen-integrasjon** — API-oppslag for kjøretøy, auto-utfylling
4. **Utstyrsoversikt** — liste med filter (kategori, type, status), detaljvisning
5. **EU-kontroll-varsling** — automatisk varsling basert på frist fra Vegvesen
6. **Vedlikeholdsplan** — service-intervaller (km/timer/dato), varsling
7. **Kalibrering/sertifisering** — varsling for småutstyr (laser, løfteutstyr)
8. **Servicehistorikk** — CRUD for service-poster, vedlegg
9. **Tilordning** — utstyr til prosjekt/byggeplass/ansvarlig
10. **GPS-integrasjon** — adapter, webhook, kart-visning (kjøretøy + anleggsmaskin)
11. **Telematikk** — ISO 15143-3 / AEMP 2.0 for anleggsmaskiner
12. **Kobling til mannskap** — fører + maskin innsjekk

## Åpne spørsmål — krever planleggingsrunde

### Småutstyr (mangler fullstendig design)

Kjøretøy og anleggsmaskiner er godt dekket. Småutstyr har kun en skisse. Følgende må avklares med brukeren:

**Utstyrstyper og omfang:**
- Fullstendig liste over småutstyr firmaet vil registrere
- Grense: hva er "for smått" til å registrere? Skrutrekker vs. laser
- Forbruksvarer vs. inventar — registreres forbruksvarer (bor, sagblad)?

**Sporingsnivå:**
- Per serienummer (hver enkelt enhet) eller per type (3 stk boremaskiner)?
- Beholdning: antall tilgjengelig vs. utlånt vs. på service vs. destruert
- Lokasjon: på lager, på prosjekt, hos person, på verksted?

**Kalibrering:**
- Hvilke utstyr krever kalibrering? (laser, nivelleringsinstrument, GPS)
- Hvem kalibrerer? Internt eller eksternt sertifiseringsorgan?
- Dokumentasjon: sertifikat-fil, kalibreringsnummer, gyldighetsperiode
- Varsling: intervall per utstyrstype, hvem varsles?

**Sertifisering / lovpålagt kontroll:**
- Løfteutstyr (kraner, taljer, stropper) — årlig kontroll (maskinforskriften §13-2)
- Stiger og trapper — visuell kontroll + merking
- Sveiseutstyr — sertifisering av operatør, ikke bare utstyr
- Fallsikring (seler, line) — kontroll og utrangeringsfrister
- Trykktanker (kompressor) — trykkontroll ihht. regelverk
- Hvilke av disse er relevante for brukeren?

**Kontroll før bruk (daglig sjekk):**
- Lovpålagt for noe utstyr (løfteutstyr, stiger, stillaser)
- Digital sjekkliste? Eller bare "sjekket av" med initialer?
- Blokkere bruk hvis kontroll mangler?

**Livsløp og utrangering:**
- Status-verdier: bestilt → mottatt → i bruk → på service → solgt → destruert → tapt
- Utrangeringsgrunn: slitasje, skadet, utdatert, solgt, tapt
- Beholde historikk etter utrangering (for revisjon/forsikring)?

**Utlån og tildeling:**
- Utlån til person vs. prosjekt vs. byggeplass
- Retur-prosess: varsling ved forsinket retur?
- Intern utleie mellom prosjekter — sporing og fakturering?
- Reservasjon: kan noen reservere utstyr for en periode?

**Kobling til andre moduler:**
- Mannskap-innsjekk: "fører sjekker inn seg + maskin" — gjelder dette også håndverktøy?
- Timer: maskinbruk som rad i dagsseddel (maskintime per prosjekt)?
- Økonomi: maskinleie, service-kostnader som FTD-data?
- Kontrollplan: sjekkliste knyttet til utstyrskontroll?

### Kjøretøy og anleggsmaskiner (mindre åpne)

- Hvilken GPS-leverandør (Webfleet vs Transpoco) — adapter-interface gjør valget utsettbart
- Telematikk-integrasjon — Komatsu KOMTRAX, CAT Product Link, Volvo ActiveCare direkte eller via ISO 15143-3?
- Drivstofforbruk-tracking — beregnet fra GPS-distanse + forbruk, eller manuell?
- Kostnadsrapportering — maskinleie, drivstoff, service som økonomi-data (kobling til FTD)
- Forsikring — registrere forsikringsinfo og varsel ved forfall?
- Dekkhotell — sporing av dekksett (sommer/vinter)?
- QR-kode per utstyr — klistre på maskin/verktøy, scan for å se info/melde skade?
- Strekkode/RFID — for masseregistrering av småutstyr?

### Tverrgående spørsmål

- **Firmamodul vs. prosjektmodul:** Maskin/utstyr er designet som firmamodul (`apps/maskin/`). Er det riktig? Eller bør det være en prosjektmodul med deling på tvers?
- **Isolert app:** Plan sier `apps/maskin/` med `packages/db-maskin/`. Er dette fortsatt ønsket, eller kan det ligge i hovedappen?
- **MVP:** Hva er minimumsversjonen? Registrering + EU-kontroll + vedlikeholdsplan? Eller trenger vi utlån/kalibrering fra start?
