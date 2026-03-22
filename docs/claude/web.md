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

- Rekursiv `RekursivtFelt`-rendering med nesting
- Repeater: grønn ramme, uten BetingelseBjelke
- Slett-validering: blokkeres ved bruk (JSONB `?|` operator)
- Rekkefølge: topptekst-sone først, deretter datafelter

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

**Zoom:**
- Multiplikativ scroll-zoom: `faktor = deltaY > 0 ? 0.8 : 1.25`, `zoom * faktor`
- Musesentrert: beregner musposisjon som brøkdel av scroll-container, justerer scrollLeft/scrollTop etter zoom
- Zoom-nivåer for knapper: [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5, 10, 20, 50]
- Klikk på prosenttall tilbakestiller til 100%

**Markører og plasseringsmodus:**
- Navigering vs. Plasseringsmodus (crosshair-cursor)
- Klikk → blå markør → opprett-modal (oppgave/sjekkliste)
- Eksisterende markører: røde MapPin fra `oppgave.hentForTegning`
- PDF: iframe med transparent overlay

**GPS-koordinater (georefererte tegninger):**
- Tegninger med `geoReference` viser live GPS-koordinater i headeren ved musebevegelse
- Bruker `tegningTilGps()` fra `@sitedoc/shared` med tegningens transformasjon
- Fungerer for ALLE georefererte tegninger (ikke bare "Utomhus"-gruppert)
- Grønn MapPin-ikon + monospace koordinater (lat, lng med 6 desimaler)

**IFC-metadata:**
- Klikkbar "IFC"-badge i header viser uttrukket metadata (prosjekt, org, GPS, etasjer, programvare)
- Data fra `Drawing.ifcMetadata` (Json-felt, uttrukket ved opplasting)

## Malliste-UI

Delt `MalListe`-komponent: +Tilføy (dropdown), Rediger, Slett, Søk. Enkeltklikk velger, dobbeltklikk åpner.

## 3D-visning (samlet side)

Samlet 3D-visningsside `/dashbord/[prosjektId]/3d-visning` med tre faner:

### Fane 1: 3D-modell (IFC + punktsky)
Sammenslått IFC-viewer som laster ALLE prosjektets IFC-modeller i én @thatopen-scene. Avmerkingsbokser styrer synlighet per modell.

**Layout:** Sidepanel (280px, IFC-modeller med checkboxes + punktskyer) + 3D-viewer + flytende egenskapspanel.

**IFC-funksjonalitet:** Klient-side WASM-parsing, objektvelging med highlight, klippeplan (snitt).

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

**Skjulte IFC-typer:** `IfcSpace` (rom-volumer) og `IfcOpeningElement` (hull i vegger) skjules automatisk via `model.setVisible(ids, false)` etter lasting. web-ifc `GetLineIDsWithType()` finner element-IDer. `IfcBuildingElementPart` (isolasjon, platekledning etc.) beholdes synlig — noen kan "lekke ut" visuelt (f.eks. isolasjonslag over tak). Dalux skjuler disse, men vi beholder dem foreløpig. Hvis dette blir plagsomt, vurder å legge til **filterfunksjon** der brukeren kan skjule enkeltobjekter, IFC-typer, layers eller egenskaper — mer fleksibelt enn å skjule hele kategorier globalt.

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

**Render-løkke:** `requestAnimationFrame` → `fragmentsManager.core.update()` (oppdaterer LOD-tiles basert på kamera).

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

## Mer-meny

⋮-knapp: Prosjektinnstillinger (admin), Skriv ut, Eksporter (TODO).
