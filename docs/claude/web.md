# Web — Next.js frontend

## UI-arkitektur

Dalux-inspirert tre-kolonne layout (skjules på mobil < 768px, hamburger-meny i Toppbar):

```
+----------------------------------------------------------+
| TOPPBAR: [SiteDoc] [Prosjektvelger v]     [Bruker v]    |
+------+------------------+--------------------------------+
| IKON | SEKUNDÆRT PANEL  | HOVEDINNHOLD                   |
| 60px | 280px            | Verktøylinje: [Opprett] [...]  |
|      | - Filtre         |                                |
| Dash | - Statusgrupper  | Tabell / Detaljvisning         |
| Sjekk| - Søk            |                                |
| Oppg |                  |                                |
| Maler|                  |                                |
| Tegn |                  |                                |
| Entr |                  |                                |
| Mapp |                  |                                |
| Opps |                  |                                |
+------+------------------+--------------------------------+
```

## Ruter

```
/                                             -> Landingsside (hero, CTA). Innloggede → /dashbord
/logg-inn                                     -> OAuth (klient-side signIn())
/aksepter-invitasjon?token=...                -> Aksepter invitasjon (Server Component)
/personvern                                   -> Personvernerklæring (GDPR)
/utskrift/sjekkliste/[sjekklisteId]           -> PDF-forhåndsvisning (A4)
/dashbord                                     -> Prosjektliste (→ kom-i-gang hvis ingen prosjekter)
/dashbord/kom-i-gang                          -> Velkomstside for nye brukere
/dashbord/nytt-prosjekt                       -> Opprett prosjekt
/dashbord/[prosjektId]                        -> Prosjektoversikt (m/prøveperiode-banner)
/dashbord/[prosjektId]/sjekklister            -> Sjekkliste-tabell
/dashbord/[prosjektId]/sjekklister/[id]       -> Sjekkliste-detalj (utfylling + print)
/dashbord/[prosjektId]/oppgaver               -> Oppgave-tabell
/dashbord/[prosjektId]/oppgaver/[id]          -> Oppgave-detalj
/dashbord/[prosjektId]/maler                  -> Mal-liste
/dashbord/[prosjektId]/maler/[id]             -> Malbygger
/dashbord/[prosjektId]/entrepriser            -> Entreprise-liste
/dashbord/[prosjektId]/mapper                 -> Mapper (read-only, ?mappe=id)
/dashbord/[prosjektId]/tegninger              -> Interaktiv tegningsvisning
/dashbord/[prosjektId]/3d-visning            -> Samlet 3D-visning (IFC + punktsky + overflater + kutt/fyll)
/dashbord/[prosjektId]/tegning-3d            -> Split-view tegning + 3D-modell med koordinatsynk og georeferanse
/dashbord/[prosjektId]/punktskyer            -> Redirect → /3d-visning
/dashbord/[prosjektId]/modeller              -> Redirect → /3d-visning
/dashbord/[prosjektId]/bilder                 -> Bildegalleri (liste + tegningsvisning)
/dashbord/oppsett                             -> Innstillinger
/dashbord/oppsett/brukere                     -> Brukergrupper, roller
/dashbord/oppsett/brukere/tillatelser         -> Tillatelsesmatrise (read-only)
/dashbord/oppsett/lokasjoner                  -> Lokasjonsliste med georeferanse
/dashbord/oppsett/field                       -> Field-oversikt
/dashbord/oppsett/field/dokumentflyt          -> Dokumentflyt (roller, maler, medlemmer)
/dashbord/oppsett/field/entrepriser           -> Entrepriser med arbeidsforløp (gammel)
/dashbord/oppsett/field/oppgavemaler          -> Oppgavemaler
/dashbord/oppsett/field/sjekklistemaler       -> Sjekklistemaler
/dashbord/oppsett/field/moduler               -> Forhåndsdefinerte mal-pakker
/dashbord/oppsett/field/box                   -> Mappeoppsett
/dashbord/oppsett/prosjektoppsett             -> Prosjektoppsett
/dashbord/oppsett/firma                       -> Firmainnstillinger
/dashbord/admin                               -> SiteDoc-admin (kun sitedoc_admin)
/dashbord/admin/firmaer                       -> Firmaer
/dashbord/admin/prosjekter                    -> Alle prosjekter (m/prøveperiode-kolonner)
/dashbord/admin/testsider                     -> Testsider (prøveprosjekter uten firma, aktive/deaktiverte)
/dashbord/admin/tillatelser                   -> Global tillatelsesmatrise
/dashbord/firma                               -> Firma-admin
/dashbord/firma/prosjekter                    -> Firmaets prosjekter
/dashbord/firma/brukere                       -> Firmaets brukere
/dashbord/firma/fakturering                   -> Fakturering (placeholder)
```

## Kontekster og hooks

- `ProsjektKontekst` — Valgt prosjekt fra URL `[prosjektId]`, alle prosjekter, loading
- `BygningKontekst` — Aktiv bygning + `standardTegning` (persistent, localStorage) + `aktivTegning` (visning). Posisjonsvelger: `startPosisjonsvelger(feltId)` → `fullførPosisjonsvelger(resultat)` → `hentOgTømPosisjonsResultat(feltId)`
- `BilderKontekst` — Visningsmodus (liste/tegning), plasseringsmodus (rapportlokasjon/GPS), datofilter, områdevalg
- `TreDViewerKontekst` — Persistent IFC 3D-viewer som lever i prosjekt-layouten. Holder modellStatuser, valgtObjekt, skjulteObjekter, aktiveFiltre, viewerRef (ViewerAPI). `ViewerCanvas`-komponenten rendres i 3d-visning/page.tsx men Three.js-scenen overlever navigasjon mellom ruter fordi all state og OBC-initialisering styres av konteksten. Typer, konstanter og hjelpefunksjoner er ekstrahert til separate filer under `3d-visning/`.
- `NavigasjonKontekst` — Aktiv seksjon + verktøylinje-handlinger
- `useAktivSeksjon()` — Utleder seksjon fra pathname
- `useVerktoylinje(handlinger)` — Registrerer handlinger per side med auto-cleanup
- `useAutoVaer(...)` — Auto-henter værdata fra Open-Meteo

## Layout-komponenter

- `Toppbar` — Klikkbar logo (→ `/`), prosjektvelger, brukermeny, hamburgermeny (mobil). Admin: ShieldCheck-ikon, Firma: Building2-ikon
- `HovedSidebar` — 60px ikonbar (`hidden md:flex`), deaktiverte ikoner uten prosjekt
- `SekundaertPanel` — 280px panel (`hidden md:flex`)
- `Verktoylinje` — Kontekstuell handlingsbar

## Paneler

- `DashbordPanel` — Prosjektliste med søk
- `SjekklisterPanel` — Statusgruppe-filtrering, standard-tegning badge
- `OppgaverPanel` — Status- og prioritetsgrupper
- `MalerPanel` — Malliste med søk
- `EntrepriserPanel` — Entrepriseliste med søk
- `TegningerPanel` — Bygning+tegningstrevisning med etasje-gruppering, stjerne-standard
- `BilderPanel` — Visningsmodus-toggle (liste/tegning) + tegningsvelger med bygning/etasje-tre
- `MapperPanel` — Klikkbar mappestruktur med søk

## Malbygger

Drag-and-drop i `apps/web/src/components/malbygger/`: `MalBygger`, `FeltPalett`, `DropSone`, `DraggbartFelt`, `FeltKonfigurasjon`, `BetingelseBjelke`, `TreprikkMeny`.

- **Faste felt** (metadata): Emne, Oppretter-entreprise, Lokasjon — vises øverst i «Faste felt»-seksjonen med øye-toggle (`showSubject`, `showEnterprise`, `showLocation` på `ReportTemplate`)
- **Lokasjon settes IKKE i opprettelsesmodal** — settes automatisk fra tegning ved klikk, eller kobles etterpå via tegningsvisning. Bygning/tegning-dropdown er fjernet fra opprettelseskjema (web + mobil)
- Rekursiv `RekursivtFelt`-rendering med nesting
- Repeater: grønn ramme, uten BetingelseBjelke
- Slett-validering: blokkeres ved bruk (JSONB `?|` operator)
- Rekkefølge: topptekst-sone først, deretter datafelter
- Entreprise-dropdown i opprettelse viser kun brukerens entrepriser (`hentMineEntrepriser`)

## Opprettelsesflyt — ett-klikk

Oppgaver og sjekklister opprettes med ett klikk — velg mal, alt annet utledes automatisk:
- **Oppretter-entreprise**: Første fra `hentMineEntrepriser`
- **Svarer-entreprise**: Utledes fra dokumentflyt som matcher malen og oppretter-entreprisen
- **Tittel**: Auto-generert i API fra malnavn + løpenummer
- **Prioritet**: Default "medium"
- **Lokasjon**: Settes fra tegning (ved klikk) eller kobles etterpå — ALDRI i opprettelsesmodal
- **Emne/beskrivelse**: Redigeres etterpå i detaljvisningen

Etter opprettelse navigeres brukeren direkte til detaljsiden for å begynne registrering. Ingen skjemamodal med felter — kun mal-picker.

## Print-til-PDF

**Print-header** (`PrintHeader`): logo, prosjektnavn, nr, adresse, dato, sjekkliste-tittel, oppretter/svarer, vær.

**Print CSS** (`globals.css`): `@page { margin: 15mm; size: A4; }`, `.print-header`, `.print-skjul`, `.print-vedlegg-fullvisning`.

**PDF-forhåndsvisning** (`/utskrift/sjekkliste/[sjekklisteId]`): A4-visning utenfor dashbord-layout, `RapportObjektVisning` + `FeltVedlegg`.

**Data-attributter:** `data-panel="sekundaert"`, `data-toolbar`.

## Tegningsvisning

Interaktiv visning med musesentrert zoom (0.25x–50x / 25%–5000%):

**SVG-rendering (DWG-konverterte tegninger):**
- Inline SVG via `dangerouslySetInnerHTML` (ikke `<img>` — kreves for zoom-uavhengig strektykkelse)
- Injisert CSS: `stroke-width: calc(1.5 / var(--svg-zoom, 1)) !important` — tynne linjer uansett zoom
- `--svg-zoom` CSS-variabel settes på container via `style={{ "--svg-zoom": zoom }}`
- SVG hentes, width/height fjernes, erstattes med `width="100%" height="auto"`
- Originale `<style>`-blokker fjernes, egen zoom-aware style injiseres
- SVG-elementer har `data-layer` (lagnavn) og `data-type` (entitetstype) attributter fra DWG-konverteringen

**Zoom og panorering:**
- Multiplikativ scroll-zoom: `faktor = deltaY > 0 ? 0.8 : 1.25`, `zoom * faktor`
- Musesentrert: beregner innholdspunkt under musen, justerer scrollLeft/scrollTop etter zoom
- Zoom-nivåer for knapper: [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5, 10, 20, 50]
- Klikk på prosenttall tilbakestiller til 100%
- Dra-for-å-panorere: venstre museknapp + dra (>5px) panorerer tegningen
- Pan/klikk-skilling: musedown-posisjon lagres, onClick ignoreres hvis bevegelse >5px
- useEffect med `[tegningId, isLoading]` dependencies — registrerer wheel/pointer-handlers når container mountes etter data-lasting

**Klikkemodus (toggle i verktøylinjen, kun SVG-tegninger):**
- **Oppgave** (standard): klikk plasserer blå markør → opprett-modal (oppgave/sjekkliste)
- **Inspeksjon**: klikk på SVG-element viser DWG-egenskaper (lag, type, tekstinnhold) i popup. Elementer med `data-layer` får bredere stroke (5px) og blå hover-highlight. For TEXT/MTEXT-elementer hentes tekstinnholdet fra DOM via `target.textContent`
- Eksisterende markører: røde MapPin fra `oppgave.hentForTegning`
- PDF: Pressable overlay (ikke injisert JS) for koordinatregistrering

**PDF→PNG auto-konvertering:**
- PDF-tegninger konverteres automatisk til PNG ved opplasting (pdftoppm, 200 DPI)
- Konvertering skjer asynkront med `conversionStatus: "converting" → "done"/"failed"`
- Georeferering gjøres alltid på PNG — sikrer at web og mobil bruker identisk koordinatsystem
- `UPLOADS_DIR` env-variabel peker til `apps/api/uploads/` (påkrevd for Next.js server-side)
- Server-krav: `poppler-utils` (pdftoppm) installert

**GPS-koordinater (georefererte tegninger):**
- Tegninger med `geoReference` viser live GPS-koordinater i headeren ved musebevegelse
- Bruker `tegningTilGps()` fra `@sitedoc/shared` med tegningens transformasjon
- Fungerer for ALLE georefererte tegninger (ikke bare "Utomhus"-gruppert)
- Grønn MapPin-ikon + monospace koordinater (lat, lng med 6 desimaler)

**IFC-metadata:**
- Klikkbar "IFC"-badge i header viser uttrukket metadata (prosjekt, org, GPS, etasjer, programvare)
- Data fra `Drawing.ifcMetadata` (Json-felt, uttrukket ved opplasting)

### Kartvisning og bildeeksport (implementert)

Tredje visningsmodus i Bilder-seksjonen: kart med markører for bilder med GPS.

**Kartvisning:** `BildeKart.tsx` — Leaflet-kart med 📷-markører. Klikk åpner popup med thumbnail. Dynamic import (SSR-safe).

**Velgemodus:**
- Klikk markør = toggle valgt (grønn ✓)
- Shift+dra = rektangelvalg for flere bilder
- Sidepanel (280px) viser valgte bilder sortert etter dato med metadata
- Eksporter-knapp åpner utskriftsvennlig HTML (2 bilder per rad, kompakt metadata, A4)

### Planlagt: Kartfilter og utvidet eksport

**Dynamisk filtersystem for kartvisning:**
- **Bygning** — dropdown, filtrer bilder etter hvilken bygning de tilhører (via sjekkliste/oppgave → building_id)
- **Rapportmal** — dropdown, filtrer etter mal (template_id på sjekklisten/oppgaven)
- **Datoperiode** — fra/til datovalg (datoFra/datoTil finnes allerede i BilderKontekst)
- Filtrene bør ligge i en kompakt verktøylinje over kartet, eller i BilderPanel
- Filtrene er dynamiske — bygningslisten hentes fra prosjektet, mallisten fra tilgjengelige maler

**Utvidet eksport — forsideinformasjon:**
- Prosjektnavn, prosjektnummer, adresse
- Bygning bildene tilhører
- Dato-range for utvalget
- Antall bilder
- Valgfri: kartutsnitt med markerte posisjoner (Leaflet canvas export)

**Datakrav:** `NormalisertBilde` trenger utvidelse med `buildingId`, `buildingName`, `templateId`, `templateName` for filtrering. Disse kan utledes fra `parentId` (sjekkliste/oppgave) → building_id/template_id. Kan kreve utvidelse av `bilde.hentForProsjekt`-queryen.

**Berører:** `BildeKart.tsx`, `page.tsx` (KartVisningMedValg), `BilderPanel.tsx`, `apps/api/src/routes/bilde.ts`

## Malliste-UI

Delt `MalListe`-komponent: +Tilføy (dropdown), Rediger, Slett, Søk. Enkeltklikk velger, dobbeltklikk åpner.

## 3D-visning (samlet side)

Samlet 3D-visningsside `/dashbord/[prosjektId]/3d-visning` med tre faner.

**Filstruktur (etter fase 1-refaktorering):**
- `typer.ts` — Alle interfaces (ValgtObjekt, ModellStatus, ViewerAPI, etc.)
- `konstanter.ts` — INTERNE_FELT, ifcFilCache, KLASSE_FARGER, QUANTITY_ENHETER
- `hjelpefunksjoner.ts` — hentNavn, hentVerdi, formaterVerdi, finnIfcTypeKode, parseLandXMLFil
- `komponenter/EgenskapsPopup.tsx` — Flytende egenskapspanel for valgt objekt
- `komponenter/FilterChipBar.tsx` — Chip-bar for aktive filtre/skjulte objekter
- `page.tsx` — Tynt skall med fane-bar, sidebar og delegering til kontekst
- `kontekst/tred-viewer-kontekst.tsx` — Provider (state) + ViewerCanvas (Three.js/OBC)

### Fane 1: 3D-modell (IFC + punktsky)
Sammenslått IFC-viewer som laster ALLE prosjektets IFC-modeller i én @thatopen-scene. Avmerkingsbokser styrer synlighet per modell. `TreDViewerKontekst` holder all viewer-state i prosjekt-layouten slik at Three.js-scenen overlever navigasjon.

**Layout:** Sidepanel (280px, IFC-modeller med checkboxes + punktskyer) + 3D-viewer + flytende egenskapspanel.

**IFC-funksjonalitet:** Klient-side WASM-parsing, objektvelging med highlight, klippeplan (snitt). Norske IFC-kategorinavn i egenskapspanelet. Prioriterte attributter vises øverst. Scrollbart panel med større visningsområde.

**3D-visning som modul:** 3D-visning er en modul (`3d-visning`, kategori `funksjon`) i `PROSJEKT_MODULER`. Deaktivert som standard — aktiveres per prosjekt via Innstillinger > Feltarbeid > Moduler. Sidebar-ikonet for 3D skjules når modulen er deaktivert.

**@thatopen initialisering (kritisk rekkefølge):**
1. `components.init()` — initialiserer Components-systemet
2. `SimpleScene.setup({ backgroundColor, ambientLight, directionalLight })` — MÅ kalles for lys (constructor alene legger ikke til lys)
3. `fragmentsManager.init("/fragments-worker.mjs")` — starter worker for tile-basert rendering
4. `ifcLoader.settings.autoSetWasm = false` — forhindrer at unpkg overskriver lokal WASM-bane
5. `ifcLoader.settings.wasm = { path: "/", absolute: true }` — peker til lokale WASM-filer i `public/`
6. Etter lasting: `model.useCamera(threeCamera)` — påkrevd for LOD/tile-lasting
7. Render-løkke: `fragmentsManager.core.update()` via `requestAnimationFrame` — oppdaterer tiles
8. `scene.add(model.object)` — legger modellens Object3D til scenen manuelt

**Modell-lasting (ytelsesoptimalisert):**
- Alle IFC-filer lastes ned parallelt (`Promise.all`) — nettverks-I/O
- WASM-parsing skjer sekvensielt (web-ifc er enkelttrådet)
- Lasting uten `addAllAttributes()`/`addAllRelations()` — gir rask parsing uten feil
- Rå IFC-data (Uint8Array) lagres per modell for on-demand egenskapsoppslag
- `clipper.create(world)` kalles eksplisitt på `dblclick` — Clipper har ingen auto-lytter

**Objektklikk og egenskaper (on-demand via web-ifc):**
- `hitModel.getItem(localId)` → `item.getCategory()` for rask IFC-type
- Dedikert `WEBIFC.IfcAPI()`-instans åpner IFC-data on-demand ved klikk
- `propsApi.properties.getItemProperties()` → element-attributter
- `propsApi.properties.getPropertySets()` → PropertySets med verdier (HasProperties/HasQuantities)
- `propsApi.properties.getTypeProperties()` → type-egenskaper
- Web-ifc instans og åpne modeller caches mellom klikk for rask respons
- IFC-typekode konverteres til lesbart navn via WEBIFC-konstanter (IFCWALL → "Wall")
- Interne felt (OwnerHistory, ObjectPlacement, Representation) filtreres bort

**Raycasting og objektvelging:**
- Raycast itererer kun synlige modeller via `model.raycast()` — skjulte modeller blokkerer ikke klikk
- **VIKTIG:** `model.raycast()` og `fragmentsManager.raycast()` forventer rå `clientX`/`clientY` pikselkoordinater (IKKE NDC -1 til 1). Internt konverterer de via `dom`-elementet. Å sende NDC gir treff på helt feil objekter
- Three.js `Raycaster` krasjer på fragment-geometri (BufferAttribute.getX på zero-length) — IKKE bruk
- Skjulte modeller MÅ fjernes fra scene (`scene.remove`), ikke bare `.visible = false` — fragments raycast ignorerer visible-flagg
- `synligeModeller` Set sporer hvilke modeller som er synlige

**Skjulte IFC-typer:** `IfcSpace` (rom-volumer) og `IfcOpeningElement` (hull i vegger) skjules automatisk via `model.setVisible(ids, false)` etter lasting. web-ifc `GetLineIDsWithType()` finner element-IDer. `IfcBuildingElementPart` (isolasjon, platekledning etc.) beholdes synlig — noen kan "lekke ut" visuelt (f.eks. isolasjonslag over tak).

**Kontekstdrevet filtersystem:**
Brukeren kan skjule enkeltobjekter eller filtrere på tvers av alle modeller basert på IFC-kategori, lag (layer) eller system. Tre typer state:

1. `skjulteObjekter` — array av `{modelId, localId, kategori, navn}`, sporer individuelt skjulte objekter. EyeOff-knappen i EgenskapsPopup legger til her.
2. `aktiveFiltre` — array av `{type: 'kategori'|'lag'|'system', verdi: string}`, representerer batch-filtre. FilterChipBar viser alle aktive filtre/skjulte objekter som chips med X-knapp.
3. `FilterChipBar` — kompakt bar mellom verktøylinjen og 3D-canvas, vises KUN ved aktive filtre/skjulte objekter. Nullstill-knapp gjenoppretter alt.

ViewerRef-metoder for filtrering:
- `visObjekt(modelId, localId)` — gjenopprett enkeltobjekt
- `skjulAlleAvKategori(ifcTypeKode)` / `visAlleAvKategori(ifcTypeKode)` — batch-vis/skjul alle av en IFC-type via `GetLineIDsWithType`
- `skjulAlleAvLag(lagNavn)` / `visAlleAvLag(lagNavn)` — batch-vis/skjul via `IFCPRESENTATIONLAYERASSIGNMENT`
- `skjulAlleAvSystem(systemNavn)` / `visAlleAvSystem(systemNavn)` — batch-vis/skjul via `IFCRELASSIGNSTOGROUP`

Filterknapper (EyeOff-ikoner) i EgenskapsPopup ved kategori-header, Layer og System attributter. `finnIfcTypeKode()` konverterer lesbart kategorinavn tilbake til WEBIFC-konstant (caches ved init).

**Egenskapsoppslag (on-demand via web-ifc):**
- Klikkkoordinater (Øst/Nord/Høyde) fra `hitResult.point`
- Type via `IfcRelDefinesByType` → `RelatingType.Name`
- Layer via `IfcPresentationLayerAssignment` → traverserer `IfcProductDefinitionShape.Representations`
- System via `IfcRelAssignsToGroup` → `RelatingGroup.Name` (IfcSystem/IfcDistributionSystem)
- Foreldre-element via `IfcRelAggregates` for underdeler (BuildingElementPart etc.) — henter foreldrens PropertySets, TypeProperties og BaseQuantities
- Quantity-enheter: LengthValue→mm, AreaValue→m², VolumeValue→m³, WeightValue→kg

**Solo-modus:** Layers-ikon per modell i sidepanelet. Klikk → skjuler alle andre modeller. Klikk igjen → viser alle.

**3D-markør:** Rød sfære (radius 0.15, `depthTest: false`, `renderOrder: 999`) plasseres på `hitResult.point` (det faktiske treffpunktet fra raycast). Fjernes ved klikk utenfor objekt.

**Objekt-highlight:** Blå semi-transparent overlay (`#3b82f6`, opacity 0.6) via `hitModel.highlight([localId], material)`. Resettes ved nytt klikk.

**Render-løkke:** `requestAnimationFrame` → `fragmentsManager.core.update()` (oppdaterer LOD-tiles basert på kamera). Idle-deteksjon pauser render-loop når kamera ikke beveger seg. Visibilitetspause stopper rendering når fanen ikke er synlig — reduserer strømforbruk.

**Z-fighting fiks:** Camera `near`/`far` settes dynamisk basert på modellstørrelse for å unngå z-fighting artefakter.

**Filer i `public/`:** `web-ifc.wasm`, `web-ifc-mt.wasm`, `fragments-worker.mjs`

**Avhengigheter:** `@thatopen/components`, `@thatopen/fragments`, `web-ifc`, `three`, `potree-core`

### Fane 2: Overflatemodeller
Vis triangulerte overflater (TIN) fra LandXML-filer i 3D.

**LandXML-parser** (`src/lib/landxml-parser.ts`): Parser `<Surface>` → `<Pnts>` + `<Faces>` med `fast-xml-parser`. Returnerer `TINData` (vertices + triangles + bbox).

**Punktsky-triangulering** (`src/lib/punktsky-triangulering.ts`): Subsample + Delaunay-triangulering med `delaunator`.

**Avhengigheter:** `fast-xml-parser`, `delaunator`

### Fane 3: Kutt/fyll-analyse
Sammenlign to overflatemodeller med rød/blå visualisering og volumberegning.

**Kutt/fyll-algoritme** (`src/lib/kutt-fyll.ts`):
1. Finn overlappende bounding box
2. Regulært rutenett (konfigurerbar oppløsning: 0.5m–5m)
3. Barycentric interpolasjon for Z-verdier
4. ΔZ > 0 → fyll (rød), ΔZ < 0 → kutt (blå)
5. Volum = Σ(|ΔZ| × celleAreal)

**Layout:** Sidepanel (280px, overflatevalg + oppløsning + resultat) + 3D-viewer med rød/blå differansemesh.

### Navigasjon
Erstatter separate `/punktskyer` og `/modeller`-ruter. Gamle URLer redirectes via `next.config.js`. Sidebar viser én "3D"-knapp i stedet for to.

### Persistent 3D-viewer (Fase 1 — implementert)

`ViewerCanvas` lever i prosjekt-layouten (`/dashbord/[prosjektId]/layout.tsx`), ikke i page.tsx. Three.js-scene, WebGL-kontekst og lastede IFC-modeller overlever navigasjon mellom ruter.

- **Layout:** ViewerCanvas rendres permanent i layout med `absolute inset-0`. Vis/skjul med CSS basert på `usePathname().endsWith("/3d-visning")`
- **Children:** Page-innhold (sidepanel, verktøylinje, filter-bar) rendres over vieweren med `pointer-events-none` på wrapper, `pointer-events-auto` på interaktive elementer
- **Bakgrunnslasting:** IFC-modeller begynner lasting så snart prosjektet åpnes, uavhengig av aktiv rute. Når bruker navigerer til 3D-visning er modellene ofte allerede lastet
- **Verktøylinje og filter-bar:** Flyttet fra ViewerCanvas til page.tsx (`Fane3DModell`-komponenten)

## Sjekkliste-endringslogg

`enableChangeLog` på mal → server-side diff i `oppdaterData` → `ChecklistChangeLog`-poster. `EndringsloggSeksjon` i detaljsiden.

## Oppgavedialog

Kommentarseksjon med `TaskComment`. `DialogSeksjon` med innlinjet tekstfelt, Enter sender.

## Automatisk værhenting

`useAutoVaer` → `trpc.vaer.hentVaerdata` (Open-Meteo, gratis). Kl. 12:00, kilde: "automatisk"/"manuell".

## Prosjektlokasjon og kartvelger

`KartVelger.tsx`: Leaflet + OpenStreetMap, `dynamic(ssr: false)`. Prosjektoppsett: firmalogo, generell info, kartvelger.

## LokasjonObjekt og TegningPosisjonObjekt

Begge i `SKJULT_I_UTFYLLING` — kun lesemodus/print.
- `location`: Leaflet-kart + adresse
- `drawing_position`: Navigasjonsbasert velger via `BygningKontekst`

## Bildegalleri

Samlet oversikt over alle bilder i prosjektet. To visningsmodus:

**Listevisning (standard):** Alle bilder sortert etter dato (nyeste først), gruppert dato → rapport. GPS-varsel (AlertTriangle) på bilder utenfor alle georefererte tegninger. Datofilter med hurtigvalg.

**Tegningsvisning:** Velg tegning fra sidepanelet, bilder vises som prikker på tegningen. Verktøylinje med:
- Plasseringsmodus: "Rapportlokasjon" (solid blå prikker fra drawingId+positionX/Y) eller "GPS" (stiplet prikker via gpsTilTegning())
- Datoperiode-filter med hurtigvalg
- Områdevalg: dra rektangel for å filtrere bilder i et område
- Zoom (0.25x–3x)

`BildeLightbox`: Fullskjerm overlay med pil-navigering, metadata, rapport-lenke. Escape lukker.

## Bygningsvelger (toppbar)

`BygningsVelger` i `apps/web/src/components/layout/BygningsVelger.tsx`.
Dropdown i toppbar etter prosjektvelger. Auto-velger første bygning.
Lagrer valg per prosjekt i localStorage via `BygningKontekst`.

Bygningsvalg påvirker:
- 3D-viewer (filtrerer IFC-modeller)
- Tegning+3D split-view (filtrerer tegninger)
- Sidebar: 3D og Tegning+3D skjules hvis bygning ikke har IFC
- API-filtrering: oppgaver, sjekklister og bilder filtrerer på `aktivBygning.id`

## Tegning+3D split-view

Rute: `/dashbord/[prosjektId]/tegning-3d`

Split-screen med plantegning (venstre) og 3D-modell (høyre).
Draggbar skillelinje.

**PDF-rendering (pdf.js canvas):**
- Canvas-basert rendering via pdf.js (erstattet iframe)
- Zoom mot musepeker — punktet under pekeren forblir fast
- Auto-fit PDF til container ved oppstart
- Full scroll-zoom og panorering

**Markør med retningsindikator:**
- SVG-kjegle viser kameraretning fra 3D-vieweren på tegningen
- Oppdateres live ved kamerabevegelse i 3D

**Kamerahøyde-kalibrering:**
- Klikk på gulv i 3D for å kalibrere kamerahøyde
- Lagres i localStorage per bygning
- Brukes for nøyaktig posisjonering av markør på tegning

**Etasjeklipp:**
- OBC `Clipper.createFromNormalAndCoplanarPoint()` klipper modellen horisontalt
- Viser kun valgt etasje i 3D-vieweren

**Koordinatbro** (`@sitedoc/shared/utils/koordinatBro.ts`):
- `gpsTil3D(gps, ifcOrigin, system, hoyde)` — GPS → Three.js
- `tredjeTilGps(punkt3d, ifcOrigin, system)` — Three.js → GPS
- `wgs84TilUtm/wgs84TilNtm` — WGS84 → UTM/NTM projeksjon

**Georeferanse:**
- Georeferanse-redigering (opprett/slett) skjer KUN i Lokasjoner-siden (`/dashbord/oppsett/lokasjoner`)
- Tegning-3d viser kun status: "Georeferert" (grønt) eller "Georeferér i Lokasjoner" (lenke)
- Støtter 3+ punkter: affin transformasjon med `ekstraPunkter`-array, viser kalibreringsfeil i meter

**Tilgangskontroll:**
- Georeferanse og kalibrering kun tilgjengelig for felt-admin (`manage_field`/`drawing_manage`)

## Brukergrupper (oppsett)

Brukergrupper under Oppsett → Brukere. Opprettet via «+ Ny gruppe».
Modulikoner med tooltip (sjekklister, oppgaver, tegninger, 3D).

**Rettigheter per gruppe:**
- Moduler: sjekklister, oppgaver, tegninger, 3D (default alle på)
- Bygningsfilter: velg spesifikke bygninger (null = alle)
- Gruppeadmin: `isAdmin` på `ProjectGroupMember` — badge + toggle i brukergrupper-UI (`settGruppeAdmin` mutation)
- Slett: kun feltarbeid-admin

**Dokumentflyt:**
- Opprett/send og Mottaker: bruker eller gruppe (ikke entreprise)
- Dokumentflyt kobles til entreprise via `forvalgtEntrepriseId` på oppretter-medlemmet
- Entrepriser fjernet fra sidebar — kun i Oppsett

**Entreprise fargevelger:**
- 20 forhåndsdefinerte farger i opprettelsesveiviseren

## Mer-meny

⋮-knapp: Prosjektinnstillinger (admin), Skriv ut, Eksporter (TODO).
