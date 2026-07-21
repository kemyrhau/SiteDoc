# Utils — Delte verktøyfunksjoner (cross-platform)

## Oversikt

5 filer med verktøyfunksjoner brukt av web, mobil og API. Eksporteres via `index.ts`.

## Funksjoner

### `generateProjectNumber(sequentialNumber)` → `string`

Format: `SD-YYYYMMDD-XXXX`. Brukes ved prosjektopprettelse. 4-sifret padded løpenummer.

### `isValidStatusTransition(current, next)` → `boolean`

Tilstandsmaskin for dokumentstatus. Brukes på server (API-validering) og klient (knapp-visning).

```
draft → sent → received → in_progress → responded → approved/rejected → closed
                                                      rejected → in_progress
draft/sent/received/in_progress → cancelled (irreversibel)
```

### `hentStatusHandlinger(status)` → `StatusHandling[]`

**Fil:** `statusHandlinger.ts` — Mapper status til handlingsknapper for mobil-UI.

```typescript
interface StatusHandling {
  tekst: string           // Knappetekst (norsk)
  nyStatus: DocumentStatus
  farge: string           // Inaktiv Tailwind-farge
  aktivFarge: string      // Aktiv/trykket farge
}
```

Returnerer tom array for terminale statuser (`closed`, `cancelled`). `responded` gir to knapper (Godkjenn + Avvis).

### Georeferanse (`georeferanse.ts`)

Similaritetstransformasjon for tegning ↔ GPS-konvertering. 4 funksjoner:

| Funksjon | Input | Output | Beskrivelse |
|----------|-------|--------|-------------|
| `beregnTransformasjon(ref)` | 2 referansepunkter | `Transformasjon` | Beregner transformasjonsmatrise |
| `gpsTilTegning(gps, t)` | GPS + matrise | `{x, y}` (0-100) | GPS → tegningsposisjon (clampet) |
| `tegningTilGps(pixel, t)` | Posisjon + matrise | `{lat, lng}` | Tegning → GPS (ikke clampet) |
| `erInnenforTegning(gps, t, margin?)` | GPS + matrise + margin(10%) | `boolean` | Er GPS innenfor tegningen? |

**Matematikk:** 2D similaritetstransformasjon (skalering + rotasjon + translasjon). `cosLat` kompenserer for lengdegradskompresjon ved høye breddegrader (viktig for Norge, 58°–71°N).

**Feil-håndtering:** Kaster error ved identiske referansepunkter (`denom === 0`) eller degenerert matrise.

### `vaerkodeTilTekst(code)` → `string`

**Fil:** `vaer.ts` — WMO Code Table 4677 → norsk tekst. 28 koder (0–99). Returnerer "Ukjent" for ukjente koder. Brukes i vær-rendering (web + mobil).

### `beregnSynligeMapper(mapper, bruker)` → `SynligeMapperResultat`

**Fil:** `mappeTilgang.ts` — Beregner synlige mapper med arv-logikk.

```typescript
// Input
interface BrukerTilgangInfo {
  userId: string
  erAdmin: boolean
  entrepriseIder: string[]
  gruppeIder: string[]
}

// Output
interface SynligeMapperResultat {
  synlige: Set<string>  // Mapper med full tilgang
  kunSti: Set<string>   // Mapper synlige kun som sti til barn (grå, lås-ikon)
}
```

**Algoritme:**
1. Admin → alle synlige
2. `custom`-modus → sjekk entreprise/gruppe/bruker-match i `accessEntries`
3. `inherit`-modus → rekursivt oppover til `custom` eller rot
4. Rot med `inherit` = åpen for alle
5. Forelder-mapper til synlige barn → `kunSti` (trestruktur bevares)

**Cache:** `tilgangCache` Map forhindrer gjentatt rekursjon. Sirkulær-referanse håndtert med tidlig `false`-markør.

### Append-only felt-låsing (`feltLaasing.ts`) — KUN oppgave

Delt kilde for append-only-låsing i **oppgave**-hookene (web + mobil). **Sjekkliste bruker den IKKE** (vedtatt 2026-07-16): spec `dokumentflyt.md § 2` sier oppgave = append-only fra opprettelse, sjekkliste = redigerbar for den som har ballen + admin/registrator. `04f6d295` slo på låsen for alle fire hooks; feil for sjekkliste (låste innsendte felt permanent, også for admin) → fjernet fra sjekkliste-hookene.

| Funksjon | Input | Output | Beskrivelse |
|----------|-------|--------|-------------|
| `harFeltVerdi(verdi)` | `unknown` | `boolean` | Har feltet en reell (ikke-tom) verdi? Tom streng/null/tom array → false |
| `beregnLaasteFelter(serverData)` | `Task.data` | `Set<string>` | Objekt-IDer med server-bekreftet verdi → låst |

**Kritisk (mobil):** kall `beregnLaasteFelter` med SERVER-data, aldri lokal usynket SQLite — ellers låses egen offline-kladd. Klient-lås; server håndhever ikke append-only. Se `apps/mobile/src/hooks/CLAUDE.md`.

## Fallgruver

- `gpsTilTegning` clamper til 0-100 — bruk `erInnenforTegning` for å sjekke gyldighet først
- `tegningTilGps` clamper IKKE — kan returnere ugyldige koordinater
- `beregnSynligeMapper` kjøres klient-side — alle mapper med tilgangsdata MÅ hentes først
- `isValidStatusTransition` brukes på BEGGE sider (server + klient) — hold logikken synkronisert
