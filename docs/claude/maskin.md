# Maskinregister — Fase 3

## Formål

Maskinregister med GPS-sporing og servicehistorikk for byggeprosjekter. Holde oversikt over hvor maskinene er, hvem som bruker dem, og når de trenger service.

## Appstruktur

| Komponent | Plassering | Beskrivelse |
|-----------|------------|-------------|
| **Web** | `apps/maskin` | Next.js, `maskin.sitedoc.no` |
| **Database** | `packages/db-maskin` | Eget Prisma-skjema, aldri inn i `packages/db` |

Deler PostgreSQL-instans med SiteDoc, men helt separate tabeller. Delt auth via eksisterende `sessions`-tabell.

## Database — `packages/db-maskin`

### `vehicles` — kjøretøy/maskin

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | |
| `enterpriseId` | `uuid` FK → `dokumentflyt_parts` | Eier-faggruppe (isolerer data) |
| `registrationNumber` | `text` UNIQUE | Registreringsnummer (AA 12345) |
| `vin` | `text?` | Chassisnummer |
| `make` | `text` | Merke (Volvo, CAT, Liebherr) |
| `model` | `text` | Modell |
| `year` | `int?` | Årsmodell |
| `type` | `text` | `gravemaskin` \| `hjullaster` \| `dumper` \| `kran` \| `varebil` \| `annet` |
| `fuelType` | `text?` | Diesel, elektrisk, hybrid |
| `maxWeight` | `int?` | Totalvekt i kg |
| `vegvesenData` | `JSON?` | Rå data fra Statens vegvesen API |
| `gpsDeviceId` | `text?` | ID hos GPS-leverandør (kobler til sanntidssporing) |
| `status` | `text` | `active` \| `maintenance` \| `decommissioned` |
| `notes` | `text?` | Fritekst |
| `createdAt` | `timestamptz` | |
| `updatedAt` | `timestamptz` | |

**Indekser:** `(enterpriseId)`, `(registrationNumber)` UNIQUE, `(gpsDeviceId)`

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
| `source` | `text` | `webfleet` \| `transpoco` \| `manual` |
| `raw` | `JSON?` | Rå payload fra leverandør |
| `createdAt` | `timestamptz` | Mottatt av SiteDoc |

**Indekser:** `(vehicleId, timestamp)`, partisjonert på `timestamp` (månedsvis) for ytelse

**Retensjon:** GPS-events eldre enn 12 måneder aggregeres til daglig oppsummering og slettes.

### `service_records` — servicehistorikk

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | |
| `vehicleId` | `uuid` FK → `vehicles` | |
| `type` | `text` | `service` \| `repair` \| `inspection` \| `eu_kontroll` |
| `dato` | `date` | Utført dato |
| `km` | `int?` | Kilometerstand |
| `timer` | `int?` | Driftstimer |
| `utfortAv` | `text?` | Hvem utførte (verksted/person) |
| `beskrivelse` | `text` | Hva ble gjort |
| `kostnad` | `decimal?` | Kostnad i NOK |
| `nesteServiceDato` | `date?` | Planlagt neste service |
| `nesteServiceKm` | `int?` | Neste service ved km |
| `vedlegg` | `JSON?` | Filreferanser (fakturaer, bilder) |
| `createdAt` | `timestamptz` | |

### `vehicle_assignments` — maskin-tilordning

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | |
| `vehicleId` | `uuid` FK → `vehicles` | |
| `projectId` | `uuid` FK → `projects` | Tilordnet prosjekt |
| `userId` | `uuid?` FK → `users` | Ansvarlig fører |
| `fraDate` | `date` | Fra dato |
| `tilDate` | `date?` | Til dato (null = pågående) |
| `createdAt` | `timestamptz` | |

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

## Statens vegvesen — kjøretøyoppslag

Åpent API for kjøretøyregister: `https://www.vegvesen.no/ws/no/vegvesen/kjoretoy/felles/datautlevering/enkeltoppslag/kjoretoydata`

Brukes ved registrering av nytt kjøretøy — bruker taster inn registreringsnummer, SiteDoc henter:
- Merke, modell, årsmodell
- Drivstofftype
- Totalvekt
- EU-kontroll-status og frist
- Tekniske data

Lagres i `vehicles.vegvesenData` som rå JSON. Parsede felt kopieres til egne kolonner. Kan oppdateres manuelt (knapp "Oppdater fra Vegvesen").

## Tilgangsstyring

| Prinsipp | Implementasjon |
|----------|---------------|
| **Enterprise-isolering** | `vehicles.enterpriseId` isolerer alltid data per faggruppe |
| **Prosjektfiltrering** | `vehicle_assignments.projectId` viser kun maskiner tilordnet prosjektet |
| **Ledervisning** | Firmaansvarlig ser alle maskiner i sin faggruppe |
| **Admin** | Prosjektadmin ser alle tilordnede maskiner |
| **GPS-data** | Arver tilgang fra `vehicles` — ser du maskinen, ser du posisjonen |

## API-ruter (planlagt)

| Rute | Beskrivelse |
|------|-------------|
| `maskin.registrer` | Nytt kjøretøy + Vegvesen-oppslag |
| `maskin.oppdater` | Endre kjøretøydata |
| `maskin.hentForEnterprise` | Alle maskiner i faggruppe |
| `maskin.hentForProsjekt` | Tilordnede maskiner i prosjekt |
| `maskin.tilordne` | Tilordne maskin til prosjekt/fører |
| `maskin.hentPosisjon` | Siste GPS-posisjon |
| `maskin.hentSpor` | GPS-spor for tidsperiode |
| `maskin.registrerService` | Ny servicepost |
| `maskin.hentServicehistorikk` | Servicehistorikk for maskin |
| `maskin.gpsWebhook` | Motta GPS-events fra leverandør |

## Arkitektur-oversikt

```
┌──────────────────┐
│  GPS-leverandør  │──┐
│  Webfleet/Transpoco │
├──────────────────┤  │
│  Statens vegvesen│──┼──→  apps/api (tRPC)  ──→  packages/db-maskin
│  Kjøretøyregister│  │    Auth + org-isolasjon    vehicles, gpsEvents
├──────────────────┤  │    OrganizationIntegration serviceRecords
│  Manuell input   │──┘           │
│  Service, skader │              │
└──────────────────┘              ↓
                          ┌───────────────┐     ┌──────────────┐
                          │ apps/maskin    │     │ apps/mobile  │
                          │ maskin.sitedoc │     │ Posisjon     │
                          │ Kart, liste,  │     │ Feltarbeider │
                          │ service       │     └──────────────┘
                          └───────────────┘

Sanntids GPS-polling:
  Cron-jobb / webhook fra GPS-leverandør → gpsEvents-tabell
  → SSE/WebSocket til klient (avhengig av leverandør-API)

db-maskin:
  vehicles (regnr, enterpriseId, Vegvesen-data)
  gpsEvents (lat, lon, ts, speed)
  serviceRecords (type, dato, km, utførtAv)
  vehicles.enterpriseId — aldri på tvers av organisasjoner
```

## Mobil-visning

Feltarbeidere ser maskinposisjon og status i `apps/mobile`. Viser:
- Posisjon på kart (nærmeste maskiner)
- Maskin-status (aktiv, vedlikehold, ute av drift)
- Enkel tilordning (meld inn at du bruker maskin)

Mobil leser data via API — ingen lokal maskin-database.

## Ikke avklart

- Hvilken GPS-leverandør (Webfleet vs Transpoco) — adapter-interface gjør valget utsettbart
- Geofencing — varsling når maskin forlater byggeplass
- Drivstofforbruk — sporing via GPS-leverandør eller manuell registrering?
- Kobling til timer-modulen — maskinbruk = arbeidstimer?
- Kostnadsrapportering — maskinleie, drivstoff, service som økonomi-data
