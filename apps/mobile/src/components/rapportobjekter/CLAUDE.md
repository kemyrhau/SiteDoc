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

## Props-kontrakt (`RapportObjektProps`)

```typescript
{
  objekt: RapportObjekt      // metadata: id, type, label, required, config, sortOrder, parentId
  verdi: unknown             // nåværende verdi (type varierer per objekttype)
  onEndreVerdi(verdi): void  // endrings-callback
  leseModus?: boolean        // skjuler redigerings-UI
  prosjektId?: string        // for kontekstavhengige objekter (person, firma)
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
| `TrafikklysObjekt` | `traffic_light` | `string` | 3 fargesirkler (grønn/gul/rød), 48×48px |

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

- **iOS:** DateTimePicker bruker "spinner", forblir åpen etter valg
- **Android:** DateTimePicker bruker dialog, auto-advance dato→tid
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
- TrafikklysObjekt har kun 3 farger i mobil — grå/"Ikke relevant" er TODO
- Server-URL-er (`/uploads/...`) MÅ prefikses med `AUTH_CONFIG.apiUrl`
