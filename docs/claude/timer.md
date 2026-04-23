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

**Reisetid:** Registreres alltid separat — aldri automatisk. Type: timer (ikke avhuking). Teller ikke i arbeidstidsberegning. 1t reisetid + 8t arbeid = 8t normalarbeid + 1t reisetid betalt separat.

**Overtidsmat:** Beløp defineres av admin per enterprise (tariffavtale). Avhukingen foreslås automatisk men kan overstyres.

### Tilleggsregler (automatisering)

Admin setter opp regler per enterprise/prosjekt. Reglene genererer **forslag** — brukeren kan alltid overstyre.

| Regel | Utløser | Effekt | Konfigurasjon |
|-------|---------|--------|---------------|
| **Overtidsmat** | Arbeidstimer > terskel (default 9t) | Foreslår avhuking av overtidsmat | `enterprise_settings.overtidsmatTerskel` |
| **Nattillegg (100%)** | Arbeid registrert mellom kl 21–06 | Foreslår 100% tillegg automatisk | Klokkeslett-sjekk mot `startAt`/`endAt` hvis registrert |
| **Reisetid** | — | Aldri automatisk, alltid manuelt | Eget felt (timer) |
| **Helgetillegg** | Dato er lørdag/søndag | Foreslår avhuking av helgetillegg | Kalender-sjekk |

### Dagsseddel-flyt (mobil)

Stegvis flyt — hvert steg er en seksjon på skjermen:

```
1. Dato               → normaldag hentes fra arbeidstidskalender
2. Arbeidstimer       → totalt antall timer
3. Reisetid           → eget felt (timer) — valgfritt
4. Overtid            → systemet foreslår basert på arbeidstimer vs normaldag
5. Tillegg            → automatiske forslag fra regler + manuelle avhukinger
   ☑ Overtidsmat      (auto-foreslått: arbeidstimer > 9t)
   ☐ Nattillegg
   ☐ Helgetillegg
6. Maskiner           → fra maskinregister, timer + valgfri mengde
7. Materialer         → fritekst + mengde + enhet
8. Utlegg             → kategori + beløp + valgfritt kvitteringsbilde
9. Beskrivelse        → valgfri tekst
10. [Lagre]
```

### UX-visning — dagsseddel (mobil)

```
┌─────────────────────────────────────────────┐
│  Dagsseddel — 16. april 2026               │
│  Prosjekt: E6 Kvænangsfjellet              │
├─────────────────────────────────────────────┤
│                                             │
│  Arbeidstimer:    [10.0]                    │
│    Normaltid      [8.0]  ← auto fra dagsnorm│
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
│  MATERIALER                                 │
│  ┌───────────────────┬────────┬───────────┐ │
│  │ Grus              │ [10] │ m3 ▾      │ │
│  │ + Legg til materiale                   │ │
│  └───────────────────┴────────┴───────────┘ │
│                                             │
│  UTLEGG                                     │
│  ┌─────────────────────────────────────────┐ │
│  │ Kategori: [Drivstoff ▾]                │ │
│  │ Beløp:    [450] kr                     │ │
│  │ Bilde:    [📷 Ta bilde / Last opp]     │ │
│  │ Notat:    [Shell Tromsø]               │ │
│  │ + Legg til utlegg                      │ │
│  └─────────────────────────────────────────┘ │
│                                             │
│  Beskrivelse: [Graving + kantstein langs...]│
│                                     [Lagre] │
└─────────────────────────────────────────────┘
```

**Smarte valg som minimerer inntasting:**

1. **Totaltimer øverst** — brukeren taster inn totaltimer, systemet fordeler automatisk på normaltid/50%/100% basert på dagsnorm
2. **Tilleggsregler** — automatiske forslag fra konfigurasjon, brukeren bekrefter eller overstyrer
3. **Maskiner** — nedtrekk fra maskinregisteret (kun maskiner tilordnet prosjektet). Sist brukte øverst
4. **Enhet** — auto-foreslått fra maskintype (kantsteinsetter → m, lastebil → m3). Kan overstyres
5. **Kopiér forrige dag** — én knapp som dupliserer gårsdagens seddel (vanlig at arbeidet ligner)
6. **Materialer** — fritekst + mengde + enhet-dropdown (m3/m2/tonn/kg/m)

## Eksport til lønnssystem

Støtter flere systemer via adapter-mønster (samme prinsipp som `BilagsKilde` i økonomi-modulen):

| System | Status | Beskrivelse |
|--------|--------|-------------|
| **Tripletex** | Primær | Eksisterende integrasjon via OrganizationIntegration |
| **Visma** | Planlagt | Visma.net Payroll API |
| **Unit4** | Planlagt | Unit4 Business World |
| **SAP** | Planlagt | SAP SuccessFactors / HCM |
| **CSV/Excel** | Fallback | Alltid tilgjengelig, universell eksport |

### Adapter-interface

```typescript
interface LonnssystemAdapter {
  eksporter(dagssedler: Dagsseddel[]): Promise<EksportResultat>;
  eksporterUtlegg(utlegg: Utlegg[]): Promise<EksportResultat>;
  valider(): Promise<boolean>; // sjekk API-tilkobling
}
```

Konkret implementasjon per leverandør. Konfigureres via `OrganizationIntegration` (type: `"tripletex"` / `"visma"` / `"unit4"` / `"sap"`).

### Timer-eksport — kolonner

Separate kolonner per lønnsart — aldri slått sammen. Hver dagsseddel eksporteres som én rad:

| Kolonne | Kilde |
|---------|-------|
| Dato | `daily_sheets.dato` |
| Ansatt | `userId` → `users.name` |
| Prosjekt | `projectId` → `projects.name` |
| Normaltid | `normaltid` |
| Overtid 50% | `overtid50` |
| Overtid 100% | `overtid100` |
| Reisetid | `reisetid` |
| Overtidsmat | `overtidsmat` → sats fra `enterprise_settings` |
| Nattillegg | `nattillegg` → sats |
| Helgetillegg | `helgetillegg` → sats |

### Utlegg-eksport — separat fra timer

Aldri blandet i lønnsrader. Tripletex: utlegg som reiseregning/bilag, ikke som lønn.

| Kolonne | Kilde |
|---------|-------|
| Dato | `daily_sheets.dato` |
| Ansatt | `userId` → `users.name` |
| Kategori | `sheet_expenses.kategori` |
| Beløp | `sheet_expenses.belop` |
| Notat | `sheet_expenses.notat` |
| Kvittering | `sheet_expenses.bildeUrl` (lenke) |

## Utleggsregistrering

Del av dagsseddelen. Ansatt tar bilde av kvittering direkte i mobilappen.

### Feltstruktur

- `kategori`: string — Drivstoff, Parkering, Diett, Verktøy, Annet (konfigurerbar per enterprise)
- `belop`: decimal (NOK)
- `kvitteringsBilde`: string (URL til lagret bilde)
- `notat`: string? (valgfritt)
- `dagsseddelId`: FK → `daily_sheets`

### Teknisk

- Bilde tas med React Native ImagePicker
- Komprimeres til maks 800px, JPEG 80% før opplasting
- Lagres lokalt som base64 i SQLite → synkes som multipart/form-data til S3
- Eksporteres separat fra timer — som reiseregning/bilag i Tripletex

### Godkjenning

- Leder ser kvitteringsbilde i godkjenningsvisningen
- Godkjennes samtidig med dagsseddelen — ikke egen godkjenningsflyt

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

### `sheet_expenses` (utlegg per dagsseddel)

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | |
| `sheetId` | `uuid` FK → `daily_sheets` | |
| `kategori` | `text` | Konfigurerbar per enterprise (se `expense_categories`) |
| `belop` | `decimal` | Beløp i NOK |
| `notat` | `text?` | Fritekst (f.eks. «Shell Tromsø») |
| `bildeUrl` | `text?` | Kvitteringsbilde — S3-URL etter opplasting |
| `bildeSyncStatus` | `text` default `pending` | `pending` \| `synced` — bilde synkes separat |

**Kvitteringsbilde:**
- Tas med mobilkamera direkte i appen (Expo ImagePicker / Camera)
- Komprimeres før opplasting: maks 800px bredde, JPEG 80%
- Lagres lokalt som filsti i SQLite → synkes til S3 ved tilkobling
- Valgfritt men anbefalt — leder ser bildet i godkjenningsvisningen

### `expense_categories` (utleggskategorier per enterprise)

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | |
| `enterpriseId` | `uuid` FK → `dokumentflyt_parts` | |
| `navn` | `text` | Kategorinavn |
| `aktiv` | `boolean` default true | Kan deaktiveres uten å slette |

**Standardkategorier** (opprettes automatisk): Drivstoff, Parkering, Diett, Verktøy, Annet

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

### Arkitektur-oversikt

```
┌─────────────────────────────────────────────────────────────────────┐
│ MOBILENHET                                │ SERVER                  │
│                                           │                         │
│  Bruker registrerer timer                 │                         │
│  (start/stopp, prosjekt, beskrivelse)     │                         │
│       ↓                                   │                         │
│  SQLite lokalt                            │                         │
│  (timeEntries, syncStatus, uuid)          │                         │
│       ↓                                   │                         │
│  Nettverksstatus?                         │                         │
│   │                                       │                         │
│   ├─ Offline → Lagres lokalt              │                         │
│   │            syncStatus = "pending"     │                         │
│   │            ... (venter)               │                         │
│   │            Tilkobling gjenopptatt     │                         │
│   │            Sender pending-poster ────────→ apps/api (tRPC)     │
│   │                                       │   Auth + enterpriseId   │
│   └─ Online ─→ Sync-motor ──────────────────→       ↓              │
│                Batch pending → API        │   packages/db-timer     │
│                                           │   PostgreSQL, eget skjema│
│                                           │         ↓               │
│                                           │   Konfliktløsning       │
│                                           │   Server-wins +         │
│                                           │   client uuid —         │
│                                           │   idempotent upsert     │
└─────────────────────────────────────────────────────────────────────┘

db-timer nøkkelfelter:
  id (uuid), userId, enterpriseId, projectId, startAt, endAt,
  beskrivelse, syncedAt, clientUuid
  syncStatus: "pending" | "synced" | "conflict" — slettes aldri, kun markeres
```

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
| **Godkjenning** | Leder godkjenner dagssedler → `godkjentAv` + `godkjentVed`. Utlegg godkjennes samtidig — leder ser kvitteringsbilder i godkjenningsvisningen |

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

## Prototype — kundevisning (pågår)

Interaktiv UI-prototype for kundedialog. Ingen backend, ingen migrering — kun hardkodet demodata og lokal state. Formål: vise kunden at funksjonaliteten er gjennomtenkt, og få tilbakemelding.

### Midlertidig plan: modul i prosjektet

For prototypen bygges timer som **en modul inne i prosjektet** (ikke separat app). Grunnen:

- **Mobil:** Feltarbeideren åpner prosjektet sitt og finner timer der — samme mønster som sjekklister, oppgaver, tegninger
- **Web:** Timer-ikon i prosjektets sidebar, åpner timer-visning i prosjektkontekst
- **Konsistent:** Samme navigasjon på web og mobil

Den opprinnelige planen om `apps/timer` som egen Next.js-app er **ikke forkastet** — dette er en midlertidig tilnærming for å teste UI og få kundetilbakemelding. Endelig arkitektur bestemmes etter kundedialog.

### Prototype-rute

`/dashbord/[prosjektId]/timer` — tilgjengelig via sidebar-ikon i prosjektet.

### Prototype-innhold (bygget)

**Tre faner:**

1. **Oversikt** — tabell med alle dagssedler
   - Hurtigfiltre alltid synlig: ansatt-søk, prosjekt-dropdown, dato fra-til, status-filter
   - Sortering ved klikk på kolonneoverskrift (pil opp/ned)
   - Filter-ikon på kolonner: dato-spenn, fritekst, checkbox-lister, tallintervall
   - Aktive filter som chips med × og "Fjern alle"
   - Tilleggsarbeid-kolonne med badges (E-042, E-038)
   - Sumrad nederst
   - Klikk markerer rad (blå), dobbeltklikk åpner redigering
   - Rediger-knapp (blyant) og slett-knapp (søppelbøtte) per rad

2. **Dagsseddel** — skjema med alle felter
   - Prosjektvalg, tilleggsarbeid-dropdown med endringsbeskrivelse
   - Arbeidstimer med auto-fordeling (normaltid/OT50/OT100)
   - Reisetid, tillegg med auto-forslag (overtidsmat >9t, helg)
   - Sammenleggbare seksjoner: maskiner, materialer, utlegg
   - Kopiér forrige dag-knapp
   - Redigeringsmodus: gult banner med dato og ansattnavn

3. **Rapporter** — 7 rapporttyper som klikkbare kort
   - Prosjektrapport, månedsrapport per ansatt/prosjekt, tilleggsarbeid, maskin, utlegg, eksport
   - Dato-, prosjekt- og ansatt-filter + generer/eksporter PDF
   - Rapporter-fanen bruker full bredde (statistikkpanel skjules)

**Statistikkpanel (høyre kolonne, skjult på mobil):**
- Ukeoversikt med prosjekter nedover, dager bortover
- Underrader for tilleggsarbeid per prosjekt
- Månedstotaler (normaltid, OT, reisetid)
- Årstotaler + utlegg

**Layout:**
- To-kolonner på PC: innhold (venstre) + statistikk (høyre, responsiv bredde)
- Statistikkpanel: `w-[340px] lg → w-[420px] xl → w-[500px] 2xl`
- Mobil: kun venstre kolonne

### Demodata

- Prosjekter: 998 Innstifjordbotn, E6 Kvænangsfjellet
- Ansatte: Florian Aschwanden - A. Markussen AS, Kenneth Myrhaug
- Tilleggsarbeid: E-042, E-038, E-035, G-012, E-051
- 5 dagssedler med variert data (ulike statuser, tillegg, utlegg)

### Hva prototypen IKKE gjør

- Ingen nye Prisma-modeller eller migreringer
- Ingen API-kall — alt er lokal state / hardkodet
- Ingen offline-sync
- Ingen auth-sjekk utover eksisterende prosjekttilgang
- Rapporter genereres ikke — kun filter-UI og placeholder

## Proadm-integrasjon

### Dataflyt

- **Henting:** 1x per døgn fra Proadm (batch-API)
- **Sending:** 1x per døgn til Proadm (batch-API)
- **Mellom-løsning:** SmartDok brukes i dag av kunden — SiteDoc erstatter denne rollen

### Hva SiteDoc henter fra Proadm

- **Endringsmeldinger:** nummer, navn, beskrivende tekst, status
- **Godkjenninger:** nummer, navn, beskrivende tekst, status

### "Send til timeregistrering" — egen funksjon

Separat handling på en endring/godkjenning i SiteDoc. Påvirker IKKE godkjenningsforløpet i Proadm. Flagget gjør endringen tilgjengelig som valgbar referanse ved timeregistrering.

### Hva arbeider ser

- Prosjektnummer og prosjektnavn
- Endringsnummer og endringsnavn
- Beskrivende tekst som medfølger arbeidet
- Egne timer ført mot dette
- **ALDRI:** kronebeløp, kontraktsum, budsjett eller økonomidata

### Hva SiteDoc sender tilbake til Proadm

To separate strømmer:
1. **Ordinære prosjekttimer** — alle timer uten tilleggskobling
2. **Tilleggsarbeid-timer** — timer knyttet til spesifikk endring/godkjenning, med endringsnummer som referanse

### Tilgangsstyring økonomi

| Rolle | Ser |
|-------|-----|
| **Arbeider** | Kun arbeidsbeskrivelse og egne timer |
| **Leder** | Timer + kostnad (timer × timesats) |
| **Økonomi/admin** | Full kobling mot Proadm-data |

### Validering

SiteDoc validerer og godkjenner timer — ikke Proadm. Leder godkjenner i SiteDoc → data sendes i neste batch til Proadm.

## Rapportmodul (planlagt)

Timer-modulen skal støtte utskrift og PDF-generering av diverse rapporter. Alle rapporter har fra-til datofilter.

### Rapporttyper

| Rapport | Gruppering | Innhold |
|---------|------------|---------|
| **Prosjektrapport** | Per prosjekt, fra–til dato | Alle ansatte, timer fordelt på lønnsarter, maskinbruk, utlegg |
| **Månedsrapport per ansatt** | Per ansatt, per måned | Alle prosjekter, dagssedler, timer, tillegg, utlegg |
| **Månedsrapport per prosjekt** | Per prosjekt, per måned | Alle ansatte, timer, tilleggsarbeid, maskinbruk |
| **Tilleggsarbeid-rapport** | Per endring/godkjenning | Timer ført mot spesifikt tilleggsarbeid, med endringsnummer |
| **Maskinrapport** | Per maskin | Timer, mengde, prosjekter maskinen er brukt på |
| **Utleggsrapport** | Per ansatt eller prosjekt | Kategori, beløp, kvitteringsbilder |
| **Eksportrapport** | Per lønnssystem-batch | Hva som ble sendt, tidspunkt, status |

### Felles for alle rapporter

- Fra–til datospenn
- Prosjektfilter (velg ett eller flere)
- Ansattfilter (velg én eller flere)
- PDF-eksport og utskrift
- Vises som tabell med sumrader

### Ikke avklart (rapporter)

- Layout/design for PDF-rapporter — bruke packages/pdf eller ny løsning?
- Hvilke rapporter er viktigst for kunden?
- Skal rapporter kunne deles/sendes som e-post?
- Faste rapportmaler vs. ad-hoc rapportbygger?

## Ikke avklart

- GPS-validering — skal posisjonen ved registrering logges for å verifisere at arbeideren var på byggeplassen?
- Akkord — trenger modulen støtte for akkordlønn i tillegg til timepris?
- Arbeidstidskalender — helligdager, feriedager, kortdager — import eller manuelt oppsett?
- Godkjenningsflyt detaljer — batch-godkjenning (uke), enkelt-godkjenning (dag), eller begge?
- `apps/timer` som separat app vs modul-i-prosjektet — avgjøres etter kundedialog med prototypen
