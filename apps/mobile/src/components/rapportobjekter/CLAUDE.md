# Rapportobjekter — 23 frittstående felttyper for mobil

## Oversikt

29 filer, ~2500 linjer. Hver felttype er en frittstående komponent som settes sammen i sjekkliste-/oppgave-utfylling. Alle implementerer `RapportObjektProps`-kontrakten.

## Arkitektur

```
RapportObjektRenderer (dispatcher)
├── DISPLAY_TYPER: heading, subtitle, location (ingen wrapper)
├── READONLY_TYPER: calculation (grå visning)
└── Alle andre → FeltWrapper → [Komponent] + FeltDokumentasjon
```

**FeltWrapper** omslutter alle redigerbare felter med: label, påkrevd-badge, valideringsfeil, `nestingNivå`-innrykk (0/1/2/3+), og `FeltDokumentasjon` (kommentar + vedlegg).

**FeltDokumentasjon** håndterer kamera, dokumentvelger, tegningsskjermbilde, bildeannotering, filmrull-thumbnails og kommentarfelt. Bruker refs (`onLeggTilVedleggRef`, `leggIKoRef`) for å unngå stale closures i asynkrone kamera-callbacks.

**Funn 6 (Kenneth-vedtak 2026-08-22):** `tilbehorVisning(type, globalLeseModus, harData)` i `RapportObjektRenderer.tsx` gater FeltDokumentasjon på BEGGE monteringssteder (`FeltWrapper.tsx` + `RepeaterObjekt.tsx`). `date`/`date_time`/`drawing_position`/`location`/`weather` → ingen tilbehør i nyregistrering (ren fjerning); `repeater` → objektnivå-tilbehør read-only KUN når `harData` (mobil FeltDokumentasjon self-hider IKKE en tom kommentar-boks, derfor has-data-gate). Deny-list PER felttype: et `text_field`-barn i en repeater-rad beholder tilbehøret. Print-veien (arkiv-PDF F7) er urørt.

## Props-kontrakt (`RapportObjektProps`)

```typescript
{
  objekt: RapportObjekt      // metadata: id, type, label, required, config, sortOrder, parentId
  verdi: unknown             // nåværende verdi (type varierer per objekttype)
  onEndreVerdi(verdi): void  // endrings-callback
  leseModus?: boolean        // skjuler redigerings-UI
  // prosjektId FJERNET 2026-08-24 — var valgfri + aldri threadet til repeater-barn (stille tomme
  // felt). Prosjekt-avhengige felt (person/firma/rom/sone/lokasjon/drawing_position) henter fra
  // useProsjekt()-KONTEKST, ikke prop.
  barneObjekter?: RapportObjekt[]  // for repeater
  sjekklisteId?: string      // for opplastingskø
  oppgaveIdForKo?: string    // for oppgave-opplastingskø
}
```

## Komponentoversikt

### Visnings-typer (ingen brukerinndata)

| Komponent | Type | Verdi | Beskrivelse |
|-----------|------|-------|-------------|
| `OverskriftObjekt` | `heading` | — | Bold overskrift (text-lg) |
| `UndertittelObjekt` | `subtitle` | — | Undertittel (text-base) |
| `LokasjonObjekt` | `location` | — | Prosjektposisjon + "Åpne i kart"-lenke (Google Maps) |
| `BeregningObjekt` | `calculation` | `number` | Read-only beregnet verdi i grå pill |

### Tekst

| Komponent | Type | Verdi | Beskrivelse |
|-----------|------|-------|-------------|
| `TekstfeltObjekt` | `text_field` | `string` | Trykk → fullskjerm modal med autoFocus TextInput |

### Valg

| Komponent | Type | Verdi | Beskrivelse |
|-----------|------|-------|-------------|
| `EnkeltvalgObjekt` | `list_single` | `string` | Radioknapper, toggle-deselect, normaliserer opsjoner |
| `FlervalgObjekt` | `list_multi` | `string[]` | Avkrysningsbokser, normaliserer opsjoner |
| `TrafikklysObjekt` | `traffic_light` | `string` | 4 fargesirkler (grønn/gul/rød/grå «Ikke relevant»), 24px prikk i 44px trykkflate |

### Tall

| Komponent | Type | Verdi | Beskrivelse |
|-----------|------|-------|-------------|
| `HeltallObjekt` | `integer` | `number` | `number-pad`, regex `[^0-9-]`, valgfri enhet fra config |
| `DesimaltallObjekt` | `decimal` | `number` | `decimal-pad`, komma→punktum, valgfri enhet |

### Dato/tid

| Komponent | Type | Verdi | Beskrivelse |
|-----------|------|-------|-------------|
| `DatoObjekt` | `date` | `string` (ISO) | Autoforslag (trykk tomt → i dag), "I dag"-lenke, ×-tøm |
| `DatoTidObjekt` | `date_time` | `string` (ISO) | Splittet dato+tid, "Nå"-lenke, Android auto-advance |

### Person/firma

| Komponent | Type | Verdi | Beskrivelse |
|-----------|------|-------|-------------|
| `PersonObjekt` | `person` | `string` (userId) | Modal med prosjektmedlemmer (FlatList) |
| `FlerePersonerObjekt` | `persons` | `string[]` | Modal med avkrysning, "N valgt"-teller |
| `FirmaObjekt` | `company` | `string` (faggruppeId) | Modal med faggruppeliste |

### Spesial

| Komponent | Type | Verdi | Beskrivelse |
|-----------|------|-------|-------------|
| `VedleggObjekt` | `attachments` | — | Placeholder-tekst, faktisk UI i FeltDokumentasjon |
| `VaerObjekt` | `weather` | `{temp?, conditions?, wind?, precipitation?}` | 4 TextInputs, auto-henting styrt av hook |
| `SignaturObjekt` | `signature` | `string` (dataURL) | WebView + Fabric.js canvas, 3 states (tom/signert/redigerer) |
| `TegningPosisjonObjekt` | `drawing_position` | `{drawingId, positionX, positionY, drawingName}` | Placeholder — full tegningsvelger kommer |
| `RepeaterObjekt` | `repeater` | `Array<Record<feltId, FeltVerdi>>` | Dupliserbare rader med barnefelt, refs mot stale closures |

### Egenskap

| Komponent | Type | Verdi | Beskrivelse |
|-----------|------|-------|-------------|
| `BimEgenskapObjekt` | `bim_property` | `string` | Enkel TextInput |
| `SoneEgenskapObjekt` | `zone_property` | `string` | Enkel TextInput |
| `RomEgenskapObjekt` | `room_property` | `string` | Enkel TextInput |

### Fallback

| Komponent | Type | Verdi | Beskrivelse |
|-----------|------|-------|-------------|
| `UkjentObjekt` | ukjent | — | Gul advarsel: "Felttype «X» er ikke støttet ennå" |

## Opsjon-normalisering

Config `options` kan være strenger (`"Ja"`) eller objekter (`{value: "green", label: "Godkjent"}`). `EnkeltvalgObjekt` og `FlervalgObjekt` normaliserer automatisk — begge formater støttes.

## Verdi-lagring per type

| Kategori | Format |
|----------|--------|
| Tekst, enkeltvalg, dato, signatur | `string` |
| Tall (heltall, desimal) | `number` |
| Flervalg, flere personer | `string[]` |
| Vær, tegningsposisjon | objekt |
| Repeater | `Array<Record<string, FeltVerdi>>` |

## Plattformforskjeller

- **iOS:** DateTimePicker via delt `DatoVelgerFelt` (`components/DatoVelgerFelt.tsx`) — spinner/inline + eksplisitt «Ferdig»-knapp (iOS-velgeren lukker seg ikke selv; uten «Ferdig» sto brukeren fast, fikset 2026-08-24). Siden eier vis/skjul-state + onChange-logikk; komponenten eier boksen. Modal-varianten (`timer-detalj/FraTilTidFelt.tsx`) brukes når velgeren ER hovedhandlingen.
- **Android:** DateTimePicker bruker dialog, auto-advance dato→tid (håndteres i sidens onChange)
- **InteractionManager:** MÅ brukes etter kamera/picker lukkes for å unngå React Navigation-krasj
- **Modal:** ALLTID rendres i komponenttreet med `visible`-prop — ALDRI conditional mount (`{betingelse && <Modal>}`)

## RepeaterObjekt — detalj

Mest kompleks komponent. Hver rad inneholder verdier for alle barnefelt:
- `raderRef` brukes for å unngå stale closures i barn-callbacks
- Barn rendres via `RapportObjektRenderer` + `FeltDokumentasjon` (uten FeltWrapper/label)
- Rad-header: "1 Label, 2 Label, ..." med sletteknapp
- Sender `sjekklisteId`/`oppgaveIdForKo` videre til barn for opplastingskø

## Fallgruver

- Opsjon-normalisering er PÅKREVD i alle valg-komponenter — uten den krasjer rendering
- `FeltDokumentasjon` skjules for `date_time` (dato+tid inline i samme komponent)
- `skjulKommentar: true` sendes for `text_field` (unngå dobbelt kommentarfelt)
- SignaturObjekt bruker `webViewRef.current?.injectJavaScript()` — WebView MÅ være montert
- Server-URL-er (`/uploads/...`) MÅ prefikses med `AUTH_CONFIG.apiUrl`
