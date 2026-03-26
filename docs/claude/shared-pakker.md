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
| `StatusBadge` | Dokumentstatus → norsk tekst og farge |
| `Spinner` | Lastespinner (sm, md, lg) |
| `Modal` | HTML `<dialog>`, tittel, lukk-knapp |
| `EmptyState` | Tom tilstand med tittel, beskrivelse, handling |
| `Tooltip` | CSS tooltip (right/bottom) |
| `SidebarIkon` | Ikonknapp med aktiv-markering |
| `Table<T>` | Generisk tabell med sortering, kolonnefiltre, velgbare rader |
| `SearchInput` | Søkefelt med innebygd ikon |

## @sitedoc/shared — Typer, validering og utils

Tre eksportpunkter: `types`, `validation`, `utils`

### Typer (`packages/shared/src/types/`)

- `DocumentStatus` — 9 statusverdier
- `ReportObjectType` — 23 rapportobjekttyper
- `ReportObjectCategory` — 7 kategorier
- `REPORT_OBJECT_TYPE_META` — Komplett metadata for alle typer
- `TegningPosisjonVerdi` — `{ drawingId, positionX, positionY, drawingName }`
- `VaerVerdi` — `{ temp?, conditions?, wind?, kilde? }`
- `BuildingType`, `GeoReferansePunkt`, `GeoReferanse` (utvidet med `ekstraPunkter?: GeoReferansePunkt[]`), `TemplateZone`, `EnterpriseRole`
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
- `createProjectSchema`, `createEnterpriseSchema`, `createBuildingSchema`
- `createWorkflowSchema`, `updateWorkflowSchema`
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
