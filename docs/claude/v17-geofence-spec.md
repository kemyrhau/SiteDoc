---
name: v17-geofence-spec
description: Spesifikasjon for V17 — byggeplassens lokasjon som sirkel (punkt+radius, standard) ELLER polygon (infrastruktur/trasé), med én delt erInnenfor for timer og PSI. Bygger på kontrollplans måling 2026-10-03. Skrevet av fabel 2026-10-04, gates av orkestrator før ordrer.
sist_verifisert_mot_kode: 2026-10-04
eier: fabel (kontroll-Claude) — orkestrator gater
status: ⚠️ UTKAST TIL GATE — ingen kode-ordre før orkestrator har gatet
---

# V17 — byggeplassens lokasjon: sirkel eller polygon

> Hjemmel: [timer-gps-helhetsplan.md](timer-gps-helhetsplan.md) § 4b V17 (Kenneth 2026-10-03: *«to måter å beregne
> lokasjon til en byggeplass → disse treffer også PSI. 1. punkt og radius som i dag … 2. polygon … spesielt for
> infrastrukturprosjekter»*) og H23. Grunnlag: [maaling-v17-geofence-2026-10-03.md](maaling-v17-geofence-2026-10-03.md)
> (kontrollplan, merget `82f6c44d`). **Alt under er spesifikasjon** — ❌ IKKE IMPLEMENTERT inntil ordren som bærer det
> er merget. Kode-referanser peker på det som skal endres, slik målingen fant dem.

## 0. Hva V17 er, og ikke er

**V17 svarer på ett spørsmål: «er jeg på denne byggeplassen?» for byggeplasser som ikke er runde.** Det endrer
*formen* gjenkjenningen måles mot. Det endrer **ikke** reisen: byggeplassens punkt er reise-ankeret
(`reisetidMatrise.ts:84-85`, måling § 5c) og bevares for alle former.

**Ikke i V17:** PSI-geofence-innsjekk (Fase C, juridisk sign-off — `mannskap.md:19`; V17 leverer funksjonen PSI
senere bruker, ikke bruken) · OS-region-monitoring · sporing (K3) · polygon-tegning på kartet i modalen (V17-b, egen
runde — trasé-utledning fra tegning kommer først, fordi verktøyet finnes).

## 1. Målt utgangspunkt (fra målingen — kun det specen bygger på)

| # | Fakta | Bevis |
|---|---|---|
| M1 | Avstand-mot-radius er ÉN linje: `sted.ts:70` i `gjenkjennSted`. Ingen kopier | måling § 1b |
| M2 | `Geofence = GpsPunkt & { radiusM }` (`sted.ts:26`); fire kallere bygger `{lat,lng,radiusM}` og filtrerer på `radiusM != null` (`StartSluttDagKort.tsx:464-471`, `ny.tsx:133-134`, `useArbeidsdag.ts:85-86`, `byggeplassKatalog.ts:91-94`) | § 1a, § 5b |
| M3 | 🔴 `Omrade.polygon` er `[{x,y}]` i tegnings-PROSENT; `trase` er en LINJE med valgfritt polygon (`omrade.ts:11-12`); mobil har verken transform eller speil av polygon/referansepunkter | § 3a, § 3d |
| M4 | Transformen `tegningTilGps` er ren og offline-kapabel, men bor kun i shared og brukes ikke på mobil; clamper ikke | § 3c |
| M5 | Auto-sirkelen fra tegning = midtpunkt + største hjørneavstand + 100 m (`georeferanse.ts:433-455`); skrives via `oppdaterByggeplassGeofence` som freder `manuell` | § 2b |
| M6 | `geofenceKilde` speiles ikke til mobil; `hentForFirma` sender kun `lat/lng/radiusM` | § 2c |
| M7 | 11 sirkel-avhengigheter, hvorav harde: typen, `sted.ts:70`, `Treff.avstandM`, tre `radiusM != null`-filtre, A5 `harPunkt`, radius-UI | § 5b |
| M8 | PSI: `"geofence"` er enum (`mannskap.ts:23`), ingen kodevei; `erInnenfor` blir første forbruker | § 4 |
| M9 | `RADIUS_GRENSER` har ingen produksjonskaller — dokumenterer, binder ikke | § 8 |
| M10 | `erInnenforTegning` er utestet | § 7 |

## 2. Beslutningene (det som gjør specen entydig)

| # | Beslutning | Begrunnelse |
|---|---|---|
| **B1** | **Polygonet lagres i lat/lng på `Byggeplass`** (`geofencePolygon Json? [{lat,lng}]`), ferdig transformert på serveren. Mobilen speiler lat/lng-polygonet og regner aldri om | Løser M3 uten å gi mobilen georeferanse-transform og referansepunkter offline. Serveren har alt (M4) |
| **B2** | **Punktet er obligatorisk for alle former.** Polygon uten punkt avvises (CHECK). Settes ikke punktet eksplisitt (geokodet/manuell), utledes det som polygonets **sentroide** med `geofenceKilde = "polygon"` | Reisen trenger punktet (§ 0). A5 `harPunkt` (M7 #9/#10) forblir riktig uten endring |
| **B3** | **Formen er utledet, ikke lagret:** `geofenceForm = polygon ? "polygon" : radiusM ? "sirkel" : null`. Én funksjon i shared, ingen kolonne | Ingen ny identitetskolonne å backfille (stille-tomhet); formen kan ikke drifte fra dataene |
| **B4** | **Polygon vinner over sirkel ved overlapp.** Treff-prioritet i `gjenkjennSted`: (1) polygon-treff, minst areal først · (2) sirkel-treff, nærmest sentrum først | Polygonet er den mer presise påstanden. Areal-regelen gir «rom i bygg» forrang over «hele anlegget» når begge er polygon |
| **B5** | **Trasé → polygon via korridor.** Et `trase`-område med polygon ≥ 3 punkter brukes som det er; en trasé som er en LINJE bufres til korridor med `TRASE_KORRIDOR_BREDDE_M = 30` (navngitt, justerbar pr. kall) | M3: trasé er en linje. Korridoren er det Kenneth beskrev («langt og relativt smalt») |
| **B6** | **Auto-sirkel over `GEOFENCE_UPRESIS_RADIUS_M = 1500` merkes «upresis»** i lista og matrise-flaten, med teksten «sirkelen dekker N km — tegn trasé eller sett polygon». Utledet ved visning fra radius, ingen kolonne | Straks-tiltaket fra K10. Stopper det verste for Røstbakken-klassen før polygonet er satt |
| **B7** | **Tegningsutledning foretrekker polygon:** finnes et `trase`-område på den georefererte tegningen, utleder «Beregn fra tegning» polygon (B5) i stedet for sirkel. Ellers sirkel som i dag (M5) | Verktøyet finnes; sirkelen er fallback, ikke standard, for anlegg |
| **B8** | **`manuell` fredes fortsatt** — både punkt og polygon satt manuelt overskrives aldri av tegningsutledning | Lag 1 C4 utvidet til polygon |

## 3. Leveranse A — stedsmodellen (`packages/shared/src/utils/sted.ts`)

```ts
export type Sirkel  = { form: "sirkel";  lat: number; lng: number; radiusM: number };
export type Polygon = { form: "polygon"; lat: number; lng: number; punkter: GpsPunkt[] }; // lat/lng = ankerpunktet (B2)
export type Geofence = Sirkel | Polygon;
```

| # | Funksjon | Kontrakt |
|---|---|---|
| **A1** | `erInnenfor(pos: GpsPunkt, g: Geofence): boolean` | Sirkel: `avstandM(pos, g) ≤ radiusM` (= dagens `sted.ts:70`). Polygon: ray-casting i et lokalt plan rundt ankerpunktet (`x = (lng−lng0)·cos(lat0)`, `y = lat−lat0`, begge i grader — polygoner er km-skala, ikke kontinent-skala). Kant teller som innenfor. **Dette er PSIs funksjon** (M8) — ingen PSI-kode i V17 |
| **A2** | `polygonArealM2(p: Polygon): number` | Shoelace i samme plan ×(m/grad)². Kun for B4-prioritet, ikke for visning |
| **A3** | `gjenkjennSted<T extends Geofence>(pos, kandidater): Treff<T> \| null` | Generalisert: treff = `erInnenfor`; prioritet etter B4. `Treff` får `form` og beholder `avstandM` (til ankerpunktet — for logging, ikke for avgjørelse) |
| **A4** | `harKomplettGeofence(b: { lat, lng, radiusM, polygon }): boolean` + `tilGeofence(b): Geofence \| null` | **Erstatter de tre `radiusM != null`-filtrene** (M7 #5–#7) med ÉN kilde. Komplett = punkt ∧ (radius ∨ polygon ≥ 3) |
| **A5** | `geofenceForm(b): "sirkel" \| "polygon" \| null` | B3, ren |
| **A6** | `GEOFENCE_GRENSER` | `RADIUS_GRENSER` (M9) utvides med `POLYGON_MIN_PUNKTER = 3`, `POLYGON_MAKS_PUNKTER = 500`, `GEOFENCE_UPRESIS_RADIUS_M = 1500`, `TRASE_KORRIDOR_BREDDE_M = 30` — **og API-validatorene (`byggeplass.ts:187`, `oppmotested.ts:154`) importerer dem**, så konstanten binder, ikke bare dokumenterer |

`tolkStart/tolkSlutt/velgDestinasjon` endres ikke i signatur — de får `Geofence`-kandidater via A4 og arver A3.

**Tester (shared):** A1 sirkel = dagens 5 tester uendret · A1 polygon: innenfor/utenfor/på kant/konkav (U-form, punkt i «bukta» = utenfor)/≥ 3 punkter krav · A3 blandet: punkt inne i både sirkel og polygon → polygon; to polygoner → minst areal; to sirkler → nærmest sentrum · A4: punkt+radius ✔, punkt+polygon ✔, polygon uten punkt ✘, punkt alene ✘ · **Røstbakken-testen:** trasé-polygon 6 km × 60 m, GPS 2 km langs vegen → `erInnenfor = true`, mens dagens auto-sirkel (M5) med samme tegning gir radius > 1500 m → `upresis`.

## 4. Leveranse B — datagrunnlag (db + api)

| # | Endring | Hvor |
|---|---|---|
| **B-1** | Additiv migrering i `packages/db`: `byggeplasser.geofence_polygon JSONB NULL`. **CHECK** `geofence_polygon IS NULL OR latitude IS NOT NULL` (B2). **Ingen backfill** — ingen polygon finnes (måling § 6 C måler trasé-områder; de utledes på bestilling, ikke automatisk). **Test som FEILER** ved polygon uten punkt | `schema.prisma:1041-1083`, ny migrering |
| **B-2** | `geofenceKilde` får verdien `"polygon"` (sentroide-punkt, B2). Kommentaren på `:1056` oppdateres | `schema.prisma:1056-1060` |
| **B-3** | `settGeofence` tar `polygon?: {lat,lng}[] \| null` (Zod: `POLYGON_MIN_PUNKTER..POLYGON_MAKS_PUNKTER`, lat/lng-grenser). Sendes polygon uten punkt → punkt = sentroide, kilde `"polygon"`; sendes punkt → kilde `"manuell"` som i dag. Trigger `recomputeRadForByggeplass` som i dag (punktet kan ha endret seg) | `byggeplass.ts:181-209` |
| **B-4** | Ny `utledPolygonFraOmrade(byggeplassId, omradeId)` (service + mutasjon): leser `Omrade.polygon` (prosent) + tegningens `geoReference`, transformerer hvert punkt med `tegningTilGps` (M4), bufrer linje til korridor (B5), skriver `geofencePolygon` + punkt (B2) med kilde `"tegning"`. **Freder `manuell`** (B8). Degenerert georeferanse → `BAD_REQUEST` som i dag | ny i `services/byggeplassGeofence.ts` |
| **B-5** | `oppdaterByggeplassGeofence` (tegningsutledning): **polygon først** (B7) — finnes `trase`-område på tegningen → B-4; ellers sirkel som i dag. `kunHvisTom` gjelder begge | `services/byggeplassGeofence.ts:18-63`, `tegning.ts:502` |
| **B-6** | `bygning.hentForFirma` returnerer `geofencePolygon` + `geofenceKilde` (M6) | `byggeplass.ts:31-43` |
| **B-7** | **Varsler (B6):** byggeplasslista og matrise-flaten viser «upresis» når `form = sirkel ∧ radiusM > GEOFENCE_UPRESIS_RADIUS_M`, med lenke til «Beregn fra tegning». Teller i matrise-flaten: «N byggeplasser med upresis sirkel» ved siden av «mangler punkt» fra lag 1 | `oppsett/byggeplasser/page.tsx:762-785`, `innstillinger/page.tsx` matrise-boksen |

## 5. Leveranse C — mobil

- **C-1** `byggeplass_local` får `geofence_polygon TEXT` (JSON `[{lat,lng}]`) + `geofence_kilde TEXT`; lokal idempotent
  migrering (`migreringer.ts`-mønster). `refreshByggeplassKatalog` mapper begge (`byggeplassKatalog.ts:55-57`).
- **C-2** `identifiserByggeplass` (`byggeplassKatalog.ts:78-97`), `StartSluttDagKort.tsx:464-471`, `ny.tsx:133-139`
  bygger kandidater med `tilGeofence(b)` / filtrerer med `harKomplettGeofence(b)` (A4) — **de tre
  `radiusM != null`-filtrene forsvinner.** Oppmøtested forblir sirkel (ingen polygon-behov meldt) — A4 dekker den
  likevel, så filteret er ett.
- **C-3** Ingen transform på mobil (B1). Polygonet med ≤ 500 punkter er < 20 KB JSON pr. byggeplass — katalogen
  tåler det (måling: ingen volumgrense i dag; B-6 sender det kun når det finnes).
- **Test:** sql.js-harness: byggeplass med polygon speiles og gjenkjennes; byggeplass med kun punkt (ingen radius,
  ingen polygon) gjenkjennes IKKE og gir ikke krasj.

## 6. Leveranse D — web-modal (minimum i V17-a)

- Modalen (`byggeplasser/page.tsx:1298-1435`) får en **form-velger**: «Sirkel» (dagens glider) · «Polygon fra
  tegning» (velg trasé-område på en georeferert tegning → B-4). Polygonet tegnes i Leaflet-kartet som lesevisning
  (`KartVelger.tsx` tegner i dag sirkel, `:26-43`). **Fri tegning av polygon på kartet er V17-b** — eget punkt i
  helhetsplanen, bestilles separat.
- Radius-UI skjules når formen er polygon (M7 #11). Punktet vises alltid (B2) og kan flyttes.
- «Mangler plassering»-merket fra lag 1 og «upresis»-merket (B-7) står side om side; begge klikkbare til modalen.

## 7. Ordre-splitt (anbefaling)

| Ordre | Innhold | Avhenger av | Migrering |
|---|---|---|---|
| **V17-A** | Leveranse A (shared) + C-2-ryddingen av filtrene (mobil, null atferdsendring for sirkler) | ingen | — |
| **V17-B** | Leveranse B (db + api) + D (web-modal, form-velger + trasé-utledning + varsler) | V17-A merget (typene) | `geofence_polygon` (Kenneth-gatet) |
| **V17-C** | Leveranse C (mobil: speil + gjenkjenning med polygon) | V17-A + V17-B merget (feltene må finnes i `hentForFirma` FØR mobilen leser dem — lag 2-lærdommen M6) | lokal mobil |

**Rekkefølgen er ufravikelig** av samme grunn som L2-A → L2-B: server deklarerer feltene før telefonen leser dem.

## 8. Tester som skal FEILE (DoD på tvers)

1. Polygon-byggeplass uten punkt lagres (CHECK) · 2. GPS inne i trasé-korridor men utenfor dagens auto-sirkel
gjenkjennes IKKE etter V17 (Røstbakken-testen) · 3. Et `radiusM != null`-filter finnes fortsatt utenfor `sted.ts`
(grep-vakt, som haversine-vakten i lag 1) · 4. Mobil-katalog mister polygonet ved refresh · 5. `manuell` polygon
overskrives av tegningsutledning · 6. Auto-sirkel > 1500 m uten upresis-merke.

## 9. Åpne punkter for gaten / Kenneth

1. **Sentroide som standardpunkt for polygon (B2)** — for en lang trasé kan sentroiden ligge utenfor vegen; OSRM
   snapper til nærmeste veg, så reisen blir riktig nok, men Kenneth kan foretrekke «første punkt på traséen» eller
   «krev eksplisitt punkt». Jeg anbefaler sentroide + mulighet til å flytte punktet i modalen.
2. **Korridorbredde 30 m og upresis-grense 1500 m** — tall valgt av fabel, navngitte konstanter; justerbare.
3. **B4 polygon-over-sirkel** — produktvalg, begrunnet; kan snus til «minst areal uansett form».
4. **V17-b (fri polygon-tegning i kartet)** — ikke nå; når Kenneth bestiller.
5. Målingens § 6-SQL (antall byggeplasser pr. kilde, største radius, antall trasé-områder) er ikke kjørt — tallene
   endrer ikke specen, men sier hvor mange som får «upresis»-merket på dag én.
