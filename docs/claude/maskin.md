# Maskinregister — Fase 3

## Formål

Maskinregister med GPS-sporing, servicehistorikk og vedlikeholdsplan for byggeprosjekter. Holde oversikt over hvor maskinene er, hvem som bruker dem, når de trenger service, og når EU-kontroll utløper.

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

### `vehicles` — kjøretøy/maskin

| Felt | Type | Kilde | Beskrivelse |
|------|------|-------|-------------|
| `id` | `uuid` PK | | |
| `organizationId` | `uuid` FK → `organizations` | Manuell | Eier-firma (isolerer data) |
| `registreringsnummer` | `text?` UNIQUE | Vegvesen | ZH 44186 (null for anleggsmaskiner) |
| `vin` | `text?` | Vegvesen | Understellsnummer |
| `merke` | `text` | Vegvesen | Volvo, CAT, Liebherr |
| `modell` | `text` | Vegvesen | V70, EC220E, 950M |
| `kjoretoygruppe` | `text?` | Vegvesen | M1, N1, N2, N3, T (kjøretøygruppe-kode) |
| `kjoretoygruppeNavn` | `text?` | Vegvesen | Personbil, Varebil, Lastebil, Traktor |
| `karosseritype` | `text?` | Vegvesen | Stasjonsvogn (AC), Lukket kasse, etc. |
| `farge` | `text?` | Vegvesen | Blå |
| `antallSeter` | `int?` | Vegvesen | Maks antall ansatte i kjøretøy |
| `forstegangsRegistrert` | `date?` | Vegvesen | 2015-05-12 |
| `registrertPaEier` | `date?` | Vegvesen | 2018-04-24 |
| `drivstoff` | `text?` | Vegvesen | Diesel, Bensin, Elektrisk, Hybrid |
| `slagvolum` | `int?` | Vegvesen | cm³ (1560) |
| `effektKw` | `decimal?` | Vegvesen | kW (84) |
| `motorKode` | `text?` | Vegvesen | D4162T |
| `antallSylindre` | `int?` | Vegvesen | 4 |
| `girkasse` | `text?` | Vegvesen | Automat, Manuell |
| `hybrid` | `text?` | Vegvesen | Ingen, Hybrid, Plugin-hybrid |
| `forbrukLiterPer10km` | `decimal?` | Vegvesen | 4.2 |
| `co2GramPerKm` | `decimal?` | Vegvesen | 111 |
| `euroKlasse` | `text?` | Vegvesen | Euro 5L, Euro 6 |
| `egenvekt` | `int?` | Vegvesen | kg |
| `totalvekt` | `int?` | Vegvesen | kg |
| `nyttelast` | `int?` | Vegvesen | kg |
| `tilhengervektMedBrems` | `int?` | Vegvesen | kg |
| `tilhengervektUtenBrems` | `int?` | Vegvesen | kg |
| `vogntogvekt` | `int?` | Vegvesen | kg |
| `taklast` | `int?` | Vegvesen | kg |
| `lengdeCm` | `int?` | Vegvesen | cm |
| `breddeCm` | `int?` | Vegvesen | cm |
| `euKontrollSistGodkjent` | `date?` | Vegvesen | 2025-07-16 |
| `euKontrollFrist` | `date?` | Vegvesen | 2027-07-16 |
| `vegvesenData` | `JSON?` | Vegvesen | Komplett rå JSON |
| `vegvesenOppdatert` | `timestamptz?` | System | Sist hentet fra Vegvesen |
| `type` | `text` | Manuell | personbil, varebil, lastebil, gravemaskin, hjullaster, dumper, kran, annet |
| `internNavn` | `text?` | Manuell | Internt kallenavn ("Stor-Volvo", "Graver 3") |
| `gpsDeviceId` | `text?` | Manuell | ID hos GPS-leverandør |
| `status` | `text` | System | aktiv, vedlikehold, avregistrert |
| `notat` | `text?` | Manuell | Fritekst |
| `createdAt` | `timestamptz` | | |
| `updatedAt` | `timestamptz` | | |

**Indekser:** `(organizationId)`, `(registreringsnummer)` UNIQUE, `(gpsDeviceId)`, `(euKontrollFrist)`

### `service_records` — servicehistorikk

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | |
| `vehicleId` | `uuid` FK → `vehicles` | |
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
| `vehicleId` | `uuid` FK → `vehicles` | |
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

### `vehicle_assignments` — maskin-tilordning

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | |
| `vehicleId` | `uuid` FK → `vehicles` | |
| `projectId` | `uuid` FK → `projects` | Tilordnet prosjekt |
| `byggeplassId` | `uuid?` FK → `byggeplasser` | Tilordnet byggeplass (via innsjekk) |
| `userId` | `uuid?` FK → `users` | Ansvarlig fører |
| `fraDate` | `date` | Fra dato |
| `tilDate` | `date?` | Til dato (null = pågående) |
| `kilde` | `text` | `manuell`, `geofence` |
| `createdAt` | `timestamptz` | |

## EU-kontroll — varsling

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
| **Organisasjons-isolering** | `vehicles.organizationId` isolerer alltid data per firma |
| **Prosjektfiltrering** | `vehicle_assignments.projectId` viser kun maskiner tilordnet prosjektet |
| **Ledervisning** | Firmaansvarlig ser alle maskiner i sin organisasjon |
| **Admin** | Prosjektadmin ser alle tilordnede maskiner |
| **GPS-data** | Arver tilgang fra `vehicles` — ser du maskinen, ser du posisjonen |

## API-ruter (planlagt)

| Rute | Beskrivelse |
|------|-------------|
| `maskin.registrer` | Nytt kjøretøy + Vegvesen-oppslag |
| `maskin.oppdater` | Endre kjøretøydata |
| `maskin.vegvesenOppslag` | Slå opp reg.nr mot Vegvesen API |
| `maskin.oppdaterFraVegvesen` | Oppdater eksisterende kjøretøy med ferskt Vegvesen-data |
| `maskin.hentForOrganisasjon` | Alle maskiner i firmaet |
| `maskin.hentForProsjekt` | Tilordnede maskiner i prosjekt |
| `maskin.tilordne` | Tilordne maskin til prosjekt/fører |
| `maskin.hentPosisjon` | Siste GPS-posisjon |
| `maskin.hentSpor` | GPS-spor for tidsperiode |
| `maskin.registrerService` | Ny servicepost |
| `maskin.hentServicehistorikk` | Servicehistorikk for maskin |
| `maskin.oppdaterKilometerstand` | Oppdater km/timer |
| `maskin.hentVarsler` | EU-kontroll + service-varsler |
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
  vehicles (regnr, organizationId, Vegvesen-data, EU-frist, motor, vekt)
  gpsEvents (lat, lon, ts, speed)
  serviceRecords (type, dato, km/timer, neste)
  vehicleAssignments (prosjekt, byggeplass, fører)
```

## Mobil-visning

Feltarbeidere ser maskinposisjon og status i `apps/mobile`. Viser:
- Posisjon på kart (nærmeste maskiner)
- Maskin-status (aktiv, vedlikehold, avregistrert)
- Innsjekk av maskin på byggeplass (sammen med person-innsjekk)
- EU-kontroll-frist og service-varsler

Mobil leser data via API — ingen lokal maskin-database.

## Implementeringsrekkefølge

1. **DB-skjema** — `packages/db-maskin` med vehicles, service_records, vehicle_assignments
2. **Vegvesen-integrasjon** — API-oppslag, datamapping, registreringsflyt
3. **Kjøretøyoversikt** — liste med filter, kjøretøykort, søk
4. **EU-kontroll-varsling** — automatisk varsling basert på frist fra Vegvesen
5. **Vedlikeholdsplan** — service-intervaller (km/timer/dato), varsling
6. **Servicehistorikk** — CRUD for service-poster, vedlegg
7. **Tilordning** — maskin til prosjekt/byggeplass/fører
8. **GPS-integrasjon** — adapter, webhook, kart-visning
9. **Kobling til mannskap** — fører + maskin innsjekk via mannskap-modulen
10. **Kilometerstand-tracking** — manuell + GPS-beregnet

## Ikke avklart

- Hvilken GPS-leverandør (Webfleet vs Transpoco) — adapter-interface gjør valget utsettbart
- Drivstofforbruk-tracking — beregnet fra GPS-distanse + forbruk fra Vegvesen? Eller manuell registrering?
- Kostnadsrapportering — maskinleie, drivstoff, service som økonomi-data (kobling til FTD)
- Kobling til timer-modulen — maskinbruk som rad i dagsseddel (sheet_machines)
- Forsikring — registrere forsikringsinfo og varsel ved forfall?
- Dekkhotell — sporing av dekksett (sommer/vinter) og slitasje?
