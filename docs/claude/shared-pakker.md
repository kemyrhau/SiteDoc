# Delte pakker — @sitedoc/shared og @sitedoc/ui

## @sitedoc/ui — UI-komponentbibliotek

14 komponenter i `packages/ui/src/`:

| Komponent | Beskrivelse |
|-----------|-------------|
| `Button` | Varianter (primary, secondary, danger, ghost), størrelser, loading |
| `Input` | Tekstinput med label og feilmelding |
| `Textarea` | Flerlinjet med label og feilmelding |
| `Select` | Dropdown med options-array |
| `Card` | Kort-wrapper med valgfri padding |
| `Badge` | Varianter (default, primary, success, warning, danger) |
| `StatusBadge` | Dokumentstatus → oversatt tekst og farge (bruker i18next) |
| `Spinner` | Lastespinner (sm, md, lg) |
| `Modal` | HTML `<dialog>`, tittel, lukk-knapp. Props: `open`, `onClose`, `title`, `children`, `className`, `lukkVedBackdropKlikk` (T7-5b-3: klikk på backdrop kaller onClose). `className` overstyrer default `max-w-lg` via regex-fallback (T7-5b-fix 2026-05-17) — caller med `max-w-*` får ingen cap-konflikt. |
| `EmptyState` | Tom tilstand med tittel, beskrivelse, handling |
| `Tooltip` | CSS tooltip (right/bottom) |
| `SidebarIkon` | Ikonknapp med aktiv-markering |
| `Table<T>` | Generisk tabell med sortering, kolonnefiltre, velgbare rader |
| `SearchInput` | Søkefelt med innebygd ikon |

## @sitedoc/shared — Typer, validering og utils

Fire eksportpunkter: `types`, `validation`, `utils`, `i18n`

### i18n (`packages/shared/src/i18n/`)

- 15 språkfiler, 2 328 nøkler hver. `en.json` er **master** (`generate.ts` oversetter fra engelsk for bedre presisjon på fagtermer). `nb.json` brukes for nøkkelrekkefølge.
- `index.ts` — `STOETTEDE_SPRAAK` (15 språk med flagg: nb, en, sv, lt, pl, uk, ro, et, fi, cs, de, ru, lv, fr, sq), `SpraakKode` type, `STANDARD_SPRAAK = "nb"`
- `generate.ts` — CLI-script for auto-oversettelse via Google Translate (`google-translate-api-x`)

#### Arbeidsflyt for ny i18n-nøkkel

1. Legg til nøkkel i **både** `nb.json` og `en.json`. `en.json` er master — generate.ts oversetter fra engelsk, så engelsk fagterm må være presis.
2. Kjør auto-oversetting: `pnpm --filter @sitedoc/shared exec tsx src/i18n/generate.ts` (default = kun manglende nøkler. `--force` regenererer alle).
3. Verifiser at alle 15 språkfiler har samme antall nøkler etterpå.
4. Stikkprøve-QA på fagtermer for noen utvalgte språk (de/fr/sv/pl typisk) — Google Translate kan ta feil i kontekst. Kjente quirks logget i [BACKLOG.md § i18n](BACKLOG.md): fransk «pause» kan bli oversatt til «saut» (hopp), klønete kildetekst gir klønete oversettelser på alle språk.
5. Mobil + web henter automatisk fra `@sitedoc/shared` ved neste build — ingen separat distribusjon.

#### Diagnostikk-regel: i18n-diff er ikke alltid en bug

Når en nøkkel mangler i ett språk men finnes i et annet, **verifiser kode-bruk via grep før du antar bug**. Hvis nøkkelen ikke brukes noe sted i `*.ts`/`*.tsx`, er det en relikvi som skal slettes — ikke en bug som skal fylles. Lærdom fra `hjelp.flyt.{bestiller,utforer,godkjenner}` 2026-05-23 (HjelpModal-refaktorering etterlot ubrukte nøkler i en.json).

### Typer (`packages/shared/src/types/`)

- `DocumentStatus` — 9 statusverdier
- `ReportObjectType` — 27 rapportobjekttyper (inkl. PSI-typer info_text/info_image/video/quiz)
- `ReportObjectCategory` — 7 kategorier
- `REPORT_OBJECT_TYPE_META` — Komplett metadata for alle typer
- `TegningPosisjonVerdi` — `{ drawingId, positionX, positionY, drawingName }`
- `VaerVerdi` — `{ temp?, conditions?, wind?, kilde? }`
- `ByggeplassType` (tidligere `BuildingType`), `GeoReferansePunkt`, `GeoReferanse` (utvidet med `ekstraPunkter?: GeoReferansePunkt[]`), `TemplateZone`, `EnterpriseRole`
- `GroupCategory`, `StandardProjectGroup`, `STANDARD_PROJECT_GROUPS`
- `PERMISSIONS` — 15 tillatelser (4 gamle + 11 nye)
- `PERMISSION_LABELS`, `PERMISSION_GROUPS`, `LEGACY_PERMISSION_MAP`, `utvidTillatelser()`
- `DOMAINS`, `DOMAIN_LABELS`
- `CONTAINER_TYPES`, `FOLDER_ACCESS_MODES`, `FOLDER_ACCESS_TYPES`
- `TreObjekt` — Rekursivt objekttre-interface
- `erKontainerType()`, `harForelderObjekt()`, `byggObjektTre()`
- `harBetingelse()` (**deprecated**), `erBetingelseKvalifisert()` (**deprecated**)

### Valideringsschemaer (`packages/shared/src/validation/`)

- `documentStatusSchema`, `reportObjectTypeSchema`, `enterpriseRoleSchema`
- `templateZoneSchema`, `templateCategorySchema`, `templateDomainSchema`
- `gpsDataSchema`, `geoReferanseSchema`
- `createProjectSchema`, `createEnterpriseSchema`, `createByggeplassSchema` (tidligere `createBuildingSchema`)
- `createWorkflowSchema`, `updateWorkflowSchema` (deprecated — erstattet av Dokumentflyt)
- `addMemberSchema`, `addGroupMemberByEmailSchema`
- `drawingDisciplineSchema`, `drawingTypeSchema`, `drawingStatusSchema`, `createDrawingSchema`
- `groupCategorySchema`, `createProjectGroupSchema`, `updateProjectGroupSchema`
- `settMappeTilgangSchema`
- Konstantarrayer: `DRAWING_DISCIPLINES`, `DRAWING_TYPES`, `DRAWING_STATUSES`, `GROUP_CATEGORIES`

### Utilities (`packages/shared/src/utils/`)

- `generateProjectNumber(sekvens)` — `SD-YYYYMMDD-XXXX`
- `isValidStatusTransition(current, next)` — Lovlige statusoverganger
- `vaerkodeTilTekst(code)` — WMO → norsk
- `beregnSynligeMapper(mapper, bruker)` — Mappesynlighet med arv
- `beregnTransformasjon(ref)` — Similaritetstransformasjon (2 punkter) eller affin transformasjon (3+ punkter via `ekstraPunkter`)
- `beregnKalibreringsFeil(ref)` — Kalibreringsfeil i meter for georeferanse med 3+ punkter
- `gpsTilTegning()`, `tegningTilGps()`, `erInnenforTegning()`
- `utm33TilLatLng()` — UTM sone 33N → WGS84
- `parserKoordinater(tekst)` — UTM33, DMS, desimal
