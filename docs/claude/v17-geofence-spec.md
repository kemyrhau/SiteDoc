---
name: v17-geofence-spec
description: Spesifikasjon for V17 — byggeplassens lokasjon som sirkel (punkt+radius, standard) ELLER én eller flere soner (polygon tegnet på kart, trasé + sideveger), med origo utledet av sonene og én delt erInnenfor for timer og PSI. v2 etter Kenneth 2026-10-04. Bygger på kontrollplans måling 2026-10-03. Gates av orkestrator før ordrer.
sist_verifisert_mot_kode: 2026-10-04
versjon: v2.2 (2026-10-04) — v2 etter Kenneth (soner, karttegning, origo utledet); v2.2 etter gate-AVVIK (ingen linje-trasé i data, geometri-operasjoner navngitt, vern pr. objekt, selvkryssing avvises, sone-id utelatt, Polygon bærer id)
eier: fabel (kontroll-Claude) — orkestrator gater
status: ⚠️ UTKAST TIL GATE — ingen kode-ordre før orkestrator har gatet
---

# V17 — byggeplassens lokasjon: sirkel eller soner (polygon)

> **v2 (2026-10-04), Kenneth:** *«jeg tror at vi må tegne polygon selv. så utlede et origo basert på resultat av
> polygon. Det kan hende en vegtrase har flere sideveger. hver sideveg bør kunne settes opp som egen sone.»*
> Tre følger: (1) karttegning er kjernen i V17, ikke en senere runde · (2) en byggeplass har **én eller flere soner**,
> hver med egen geometri · (3) origo (reise-ankeret) **utledes** av sonene og kan flyttes. Modellen som finnes bærer
> dette alt: `Omrade` (`sone | rom | etasje | trase`) tilhører en byggeplass (måling § 3a) — en sideveg er et område.

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
senere bruker, ikke bruken) · OS-region-monitoring · sporing (K3) · å regne sone-polygonet TILBAKE til
tegningsprosent for tegnings-overlegget (`OmradeOverlay`) — mulig via `gpsTilTegning` når tegningen er georeferert,
men egen runde.

## 1. Målt utgangspunkt (fra målingen — kun det specen bygger på)

| # | Fakta | Bevis |
|---|---|---|
| M1 | Avstand-mot-radius er ÉN linje: `sted.ts:70` i `gjenkjennSted`. Ingen kopier | måling § 1b |
| M2 | `Geofence = GpsPunkt & { radiusM }` (`sted.ts:26`); fire kallere bygger `{lat,lng,radiusM}` og filtrerer på `radiusM != null` (`StartSluttDagKort.tsx:464-471`, `ny.tsx:133-134`, `useArbeidsdag.ts:85-86`, `byggeplassKatalog.ts:91-94`) | § 1a, § 5b |
| M3 | 🔴 `Omrade.polygon` er `[{x,y}]` i tegnings-PROSENT; mobil har verken transform eller speil av polygon/referansepunkter. **Rettet i gate (AVVIK 1): det finnes INGEN lagret linje** — `omrade.ts:11-12` er en kommentar, `Omrade` har kun `polygon` (`schema.prisma:1093`), og tegneverktøyet krever ≥ 3 punkter (`OmradeTegneverktoy.tsx:40,:47`). En trasé på tegning er et polygon ≥ 3 punkter eller tom | § 3a, § 3d + gate |
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
| **B1** | **Polygonet lagres i lat/lng på `Omrade`** (`geoPolygon Json? [{lat,lng}]` + `geoKilde "kart" \| "tegning" \| null`), **ett polygon pr. sone**, en byggeplass har null eller flere. Tegnes på kartet (primær vei) eller transformeres fra tegningsprosent på serveren (sekundær, krever georeferert tegning). Mobilen speiler lat/lng-polygonene og regner aldri om | Kenneth v2: tegnes selv, hver sideveg = egen sone. `Omrade` er alt byggeplassens soner (måling § 3a). Løser M3 uten transform på mobil |
| **B2** | **Origo (punktet) er obligatorisk for alle former og UTLEDES av sonene** når det ikke er satt eksplisitt: sentroiden av alle sone-hjørner, `geofenceKilde = "soner"`; lagres første gang en sone får geometri, re-utledes ikke automatisk når soner endres (punktet er reise-anker — stabilt), men kan flyttes i modalen (→ `manuell`). Invariant: byggeplass med ≥ 1 geo-sone ⇒ punkt finnes (service + test; kryss-tabell-CHECK finnes ikke) | Kenneth v2: «utlede et origo basert på resultat av polygon» + 9.1 ok. Reisen trenger punktet (§ 0); A5 `harPunkt` forblir riktig |
| **B3** | **Formen er utledet, ikke lagret:** `geofenceForm = polygon ? "polygon" : radiusM ? "sirkel" : null`. Én funksjon i shared, ingen kolonne | Ingen ny identitetskolonne å backfille (stille-tomhet); formen kan ikke drifte fra dataene |
| **B4** | **Sone vinner over sirkel ved overlapp.** Treff-prioritet i `gjenkjennSted`: (1) sone-treff, minst areal først · (2) sirkel-treff, nærmest sentrum først. **Treffet bærer `omradeId`** — en sideveg-sone vinner over hovedtraséen der de overlapper | Sonen er den mer presise påstanden. Areal-regelen gir sidevegen forrang over hovedtraséen, og «rom i bygg» over «hele anlegget» |
| **B5** | **Linje → korridor — KUN for linjer tegnet på kart** (ny i V17-B, kommer i lat/lng). Linjen bufres på serveren i A1s lokale plan med `TRASE_KORRIDOR_BREDDE_M = 30` (navngitt, justerbar pr. sone i modalen) og lagres KUN som `geo_polygon` — linjen selv lagres ikke. **Tegningsutledning (B7) har ingen linje å bufre** (M3 rettet) | Korridoren er «langt og relativt smalt»; en sideveg tegnes raskest som linje. Egen buffer-implementasjon, se § 2b |
| **B6** | **Auto-sirkel over `GEOFENCE_UPRESIS_RADIUS_M = 1500` merkes «upresis»** i lista og matrise-flaten, med teksten «sirkelen dekker N km — tegn trasé eller sett polygon». Utledet ved visning fra radius, ingen kolonne | Straks-tiltaket fra K10. Stopper det verste for Røstbakken-klassen før polygonet er satt |
| **B7** | **Tegningsutledning foretrekker soner — fra polygon ≥ 3 punkter, bare det:** finnes områder med tegnings-polygon på en georeferert tegning, utleder **eksplisitt «Hent fra tegning»** geo-polygon pr. område (transform, ingen buffer) i stedet for én sirkel. Ellers sirkel som i dag (M5). 🔴 **Auto-triggeren ved georeferering (`tegning.ts:502`) utleder IKKE soner** — den setter punkt + sirkel som i dag; ellers ville gjenkjenningen skiftet stille fra sirkel til soner (B9) uten at noen trykket (gate-anbefaling, tatt) | Eksisterende trasé-områder får geometri uten ny tegning; sirkelen er fallback, ikke standard, for anlegg |
| **B8** | **Vernet gjelder PR. OBJEKT** (AVVIK 3): **punktet** fredes av `geofenceKilde = "manuell"`, og `kunHvisTom` for punktet betyr «har punkt» · **sonen** fredes av `geoKilde = "kart"`, og `kunHvisTom` for sonen betyr «har `geo_polygon`». To uavhengige vakter — `oppdaterByggeplassGeofence` (`byggeplassGeofence.ts:18-63`) returnerer i dag tidlig for HELE byggeplassen på `manuell`/«har punkt», og det ville stoppet soneutledning for de fleste byggeplasser etter L1-C. **Test som FEILER** når en byggeplass med manuelt punkt ikke får soner fra eksplisitt «Hent fra tegning» | Lag 1 C4 utvidet til soner, uten å blokkere dem |
| **B9** | **Byggeplassens geofence = unionen av sonene**, med sirkelen som fallback KUN når ingen sone har geometri. Sirkel og soner kombineres ikke | Én modell pr. byggeplass å resonnere om; «upresis»-merket (B6) gjelder bare sirkel-byggeplasser |
| **B10** | **Alt er soner — hovedtraséen også.** Det finnes ikke noe «hovedtrasé»-objekt: hovedvegen er en sone som sidevegene, og **en lang trasé kan deles i flere soner** («km 0–2», «km 2–4»). **Soneinndelingen er brukerens valg** — systemet deler aldri automatisk. **Planen for inndeling i V17-B er «tegn flere soner»** — brukeren tegner hver del selv (og sletter en gammel om den erstattes). **«Del sone» (klipp én sone langs en linje) er V17-D**, egen runde, fordi polygon-splitting krever en geometripakke Kenneth må velge (§ 2b) — det er ikke nødutgang, det er rekkefølgen. Tilstøtende soner som deler kant er normalen; et punkt på kanten treffer begge, og B4 (minst areal) avgjør — deterministisk, aldri «ingen» | Kenneth 2026-10-04: *«hovedtrase bør også bli sin egen sone. er hovedtrase lang → kan denne deles opp i flere soner. men det må være brukerens valg … soneinndeling må også støttes»* |

### 2b. Hvor geometrien beregnes (AVVIK 2) — hver operasjon navngitt

Målt: ingen geometripakke finnes (`apps/api`, `packages/shared`, `apps/web` har kun `leaflet` 1.9 + `react-leaflet` 5).

| Operasjon | Hvor | Hvordan |
|---|---|---|
| Punkt-i-polygon (A1) | **egen, `sted.ts`** | ray-casting i lokalt plan rundt origo; kant = innenfor; testet |
| Areal (A2) | **egen, `sted.ts`** | shoelace i samme plan |
| Sentroide (B2) | **egen, `sted.ts`** | aritmetisk snitt av hjørner i samme plan → tilbake til lat/lng |
| Selvkryssing (presisering 1) | **egen, `sted.ts`** `erEnkeltPolygon(p)` | segment-mot-segment O(n²), n ≤ 500 → < 125 000 sjekker, ren |
| Korridor fra kartlinje (B5) | **egen, `sted.ts`** `korridorFraLinje(linje, breddeM)` | i lokalt plan: forskyv hvert segment ± bredde/2 normalt, runde skjøter approksimert med 8 punkter pr. ledd, lukk; resultatet kjøres gjennom `erEnkeltPolygon` — feiler det (skarp sving), avvises linjen med navngitt feil. Overkommelig, ren, testbar |
| Polygon-splitting («Del sone», B10) | **ny pakke — V17-D, Kenneths beslutning** | ikke trivielt; kandidater med lisens: `polygon-clipping` (MIT, boolske operasjoner — split = differanse mot en tynn korridor langs klippelinjen) · `@turf/turf` (MIT, bredt, tungt). Legges fram for Kenneth med navn og lisens FØR V17-D-ordren. Ikke i V17-A/B/C |
| Tegneverktøy i kart (polygon + linje) | **ny pakke i web — Kenneths beslutning FØR V17-B** | kandidater: `@geoman-io/leaflet-geoman-free` (MIT, vedlikeholdt; polygon + polyline i free; «cut» i free er hull-klipping, ikke split — split er Pro) · `leaflet-draw` (MIT, lite vedlikeholdt). Fabel anbefaler geoman-free. Lesevisning av soner krever ingen pakke (`react-leaflet` `Polygon`) |

Alle egne operasjoner bor i `sted.ts` (ingen Node-moduler, jf. lag 0c-kanten), testes i det lokale planet fra A1, og
**ingen av dem trengs på mobil** — mobilen får ferdige lat/lng-polygoner og kjører kun A1/A3.

## 3. Leveranse A — stedsmodellen (`packages/shared/src/utils/sted.ts`)

```ts
export type Polygon = { form: "polygon"; id: string; lat: number; lng: number; punkter: GpsPunkt[]; omradeId: string; omradeNavn: string };
// id = byggeplassId (tolkPosisjon leser sted.id som byggeplass, sted.ts:107-110) · omradeId = sonen · lat/lng = byggeplassens origo (B2)
export type Sirkel  = { form: "sirkel"; id: string; lat: number; lng: number; radiusM: number };
export type Geofence = Sirkel | Polygon;
```

| # | Funksjon | Kontrakt |
|---|---|---|
| **A1** | `erInnenfor(pos: GpsPunkt, g: Geofence): boolean` | Sirkel: `avstandM(pos, g) ≤ radiusM` (= dagens `sted.ts:70`). Polygon: ray-casting i et lokalt plan rundt origo (`x = (lng−lng0)·cos(lat0)`, `y = lat−lat0`, begge i grader — polygoner er km-skala, ikke kontinent-skala). Kant teller som innenfor. **Forutsetter enkelt (ikke selvkryssende) polygon** — garantert ved lagring (`erEnkeltPolygon`, § 2b), så A1 trenger ikke sjekke. **Dette er PSIs funksjon** (M8) — ingen PSI-kode i V17 |
| **A2** | `polygonArealM2(p: Polygon): number` | Shoelace i samme plan ×(m/grad)². Kun for B4-prioritet, ikke for visning |
| **A3** | `gjenkjennSted<T extends Geofence>(pos, kandidater): Treff<T> \| null` | Generalisert: treff = `erInnenfor`; prioritet etter B4. **Kandidatene er geofencer, ikke byggeplasser** — en byggeplass med tre soner bidrar tre polygon-kandidater (samme `byggeplassId`), en sirkel-byggeplass én. `Treff` får `form` + `omradeId` (null for sirkel) og beholder `avstandM` (til origo — logging, ikke avgjørelse). Kallerne mapper treff → byggeplass |
| **A4** | `tilGeofencer(b: { lat, lng, radiusM, soner: {id,navn,punkter}[] }): Geofence[]` (tom liste = ikke gjenkjennbar) | **Erstatter de tre `radiusM != null`-filtrene** (M7 #5–#7) med ÉN kilde. Soner med ≥ 3 punkter → én polygon-kandidat hver; ingen soner ∧ radius → én sirkel (B9); ellers tom. Krever punkt (B2) |
| **A5** | `geofenceForm(b): "sirkel" \| "polygon" \| null` | B3, ren |
| **A6** | `GEOFENCE_GRENSER` | `RADIUS_GRENSER` (M9) utvides med `POLYGON_MIN_PUNKTER = 3`, `POLYGON_MAKS_PUNKTER = 500`, `GEOFENCE_UPRESIS_RADIUS_M = 1500`, `TRASE_KORRIDOR_BREDDE_M = 30` — **og API-validatorene (`byggeplass.ts:187`, `oppmotested.ts:154`) importerer dem**, så konstanten binder, ikke bare dokumenterer |

`tolkStart/tolkSlutt/velgDestinasjon` endres ikke i signatur — de får `Geofence`-kandidater via A4 og arver A3.

**Tester (shared):** A1 sirkel = dagens 5 tester uendret · A1 polygon: innenfor/utenfor/på kant/konkav (U-form, punkt i «bukta» = utenfor)/≥ 3 punkter krav · **`erEnkeltPolygon`: sløyfe-polygon (figur-8) → false, konveks/konkav enkel → true** · `korridorFraLinje`: rett linje 1 km × 30 m → areal ≈ 30 000 m² (±5 %), bredde målt normalt på linjen = 30 m · A3 blandet: punkt inne i både sirkel og sone → sone; **hovedtrasé + sideveg overlapper → sidevegen (minst areal), og treffet bærer sidevegens `omradeId`**; to sirkler → nærmest sentrum · A4: punkt+radius ✔, punkt+soner ✔ (tre kandidater), soner uten punkt → tom, punkt alene → tom · **Røstbakken-testen:** hovedtrasé 6 km × 60 m + sideveg 800 m × 40 m; GPS 2 km langs hovedvegen → hovedtrasé; GPS 300 m inn på sidevegen → sidevegen; **hovedtraséen delt i «km 0–3» og «km 3–6» som deler kant: GPS nøyaktig på
kanten → ett deterministisk treff (B4), aldri null**; dagens auto-sirkel (M5) med samme tegning gir radius > 1500 m →
`upresis`.

## 4. Leveranse B — datagrunnlag (db + api)

| # | Endring | Hvor |
|---|---|---|
| **B-1** | Additiv migrering i `packages/db`: `omrader.geo_polygon JSONB NULL` + `omrader.geo_kilde TEXT NULL` (`kart \| tegning`). CHECK `(geo_polygon IS NULL) = (geo_kilde IS NULL)`. **Ingen backfill** — ingen sone har lat/lng i dag (tegningsprosent-polygonet står urørt; måling § 6 C teller trasé-områder, de utledes på bestilling via B-4). Invarianten «≥ 1 geo-sone ⇒ byggeplass har punkt» håndheves i servicen (B2) med **test som FEILER** når en sone lagres på en punktløs byggeplass uten at origo utledes | `schema.prisma:1086-1110` (Omrade), ny migrering |
| **B-2** | `Byggeplass.geofenceKilde` får verdien `"soner"` (origo utledet av sonene, B2). Kommentaren på `:1056` oppdateres. `radiusM` beholdes for sirkel-byggeplasser; for sone-byggeplasser er den irrelevant (B9) og UI skjuler den | `schema.prisma:1056-1060` |
| **B-3** | Ny `omrade.settGeometri({ omradeId, polygon?: {lat,lng}[], linje?: {lat,lng}[], korridorBreddeM? })` — polygon direkte, eller linje som bufres (B5) på serveren. Zod: `POLYGON_MIN_PUNKTER..POLYGON_MAKS_PUNKTER`, lat/lng-grenser. `geoKilde = "kart"`. 🔴 **Avviser selvkryssende polygon med navngitt feil** (`erEnkeltPolygon`, presisering 1) — både direkte polygon og korridor-resultat. Har byggeplassen ikke punkt → origo = sentroide av alle sonenes hjørner, `geofenceKilde = "soner"`, og `recomputeRadForByggeplass` trigges (reise-ankeret er nytt). `settGeofence` (`byggeplass.ts:181-209`) beholdes for punkt/radius; punkt flyttet manuelt → `manuell` som i dag | ny i `omrade.ts` |
| **B-4** | Ny `utledGeometriFraTegning(omradeId)` (service + mutasjon): leser `Omrade.polygon` (prosent) + tegningens `geoReference`, transformerer hvert punkt med `tegningTilGps` (M4), **kun polygon ≥ 3 punkter — ingen buffer** (AVVIK 1), validerer `erEnkeltPolygon`, skriver `geoPolygon` med `geoKilde = "tegning"` + origo (B2). **Freder `kart`** pr. sone (B8). Degenerert georeferanse → `BAD_REQUEST` som i dag | ny i `services/byggeplassGeofence.ts` |
| **B-5** | `oppdaterByggeplassGeofence` splittes i to uavhengige vakter (B8): **punkt-delen** som i dag (`kunHvisTom` = har punkt, `manuell` fredes) · **sone-delen** (ny, kalles KUN fra eksplisitt «Hent fra tegning», B7): pr. område, `kunHvisTom` = har `geo_polygon`, `kart` fredes. Auto-triggeren `tegning.ts:502` kaller kun punkt-delen (uendret). **Test som FEILER:** byggeplass med `manuell` punkt + område med tegningspolygon → «Hent fra tegning» gir sonen geometri | `services/byggeplassGeofence.ts:18-63`, `tegning.ts:502` |
| **B-6** | `bygning.hentForFirma` returnerer `geofenceKilde` + `soner: { id, navn, type, geoPolygon }[]` (kun soner med geometri) pr. byggeplass (M6) | `byggeplass.ts:31-43` |
| **B-7** | **Varsler (B6):** byggeplasslista og matrise-flaten viser «upresis» når `form = sirkel ∧ radiusM > GEOFENCE_UPRESIS_RADIUS_M`, med lenke til «Beregn fra tegning». Teller i matrise-flaten: «N byggeplasser med upresis sirkel» ved siden av «mangler punkt» fra lag 1 | `oppsett/byggeplasser/page.tsx:762-785`, `innstillinger/page.tsx` matrise-boksen |

## 5. Leveranse C — mobil

- **C-1** Ny lokal tabell `sone_geo_local { id, byggeplass_id, project_id, navn, type, geo_polygon TEXT, sist_oppdatert }`
  (én rad pr. sone med geometri) + `byggeplass_local.geofence_kilde TEXT`; lokal idempotent migrering
  (`migreringer.ts`-mønster). `refreshByggeplassKatalog` skriver begge (`byggeplassKatalog.ts:23-64`), hele settet
  overskrives pr. firma som i dag.
- **C-2** `identifiserByggeplass` (`byggeplassKatalog.ts:78-97`), `StartSluttDagKort.tsx:464-471`, `ny.tsx:133-139`
  bygger kandidater med `tilGeofencer(b)` (A4) over byggeplass + dens soner — **de tre `radiusM != null`-filtrene
  forsvinner.** Treffet mappes tilbake til byggeplass. 🔴 **`omradeId` lagres IKKE på arbeidsdagen i V17** (presisering 2:
  et felt uten leser er stille tomhet, jf. `users.ny_navigasjon`) — det finnes i `Treff` i minnet og tas inn den dagen
  en leser er bestilt (f.eks. «Sone: Sideveg 3» i attesteringen). Oppmøtested forblir sirkel.
- **C-3** Ingen transform på mobil (B1). En sone med ≤ 500 punkter er < 20 KB JSON; et anlegg med ti soner < 200 KB —
  katalogen tåler det (B-6 sender kun soner med geometri).
- **Test:** sql.js-harness: byggeplass med to soner speiles og GPS i sideveg gir treff med sidevegens `omradeId`;
  byggeplass med kun punkt (ingen radius, ingen soner) gjenkjennes IKKE og gir ikke krasj.

## 6. Leveranse D — web-modal: soner tegnes på kartet (kjernen i V17)

- Modalen (`byggeplasser/page.tsx:1298-1435`) får en **form-velger**: «Sirkel» (dagens glider) · «Soner». I
  «Soner»: liste over byggeplassens områder med geometri (navn, type, areal/lengde), **«Tegn sone»** (polygon eller
  linje med bredde i Leaflet — `leaflet-draw` eller tilsvarende; `KartVelger.tsx` tegner i dag kun sirkel, `:26-43`),
  rediger/slett pr. sone, og **«Hent fra tegning»** pr. område som har tegningspolygon på en georeferert tegning (B-4).
  Hver sone er et `Omrade` (navn + type `sone | trase`), så en sideveg får navn — det er det Kenneth ba om.
  **Inndeling i V17-B = tegn flere soner** (B10). **«Del sone» = V17-D** (krever geometripakke, § 2b). Tegneverktøyet
  (polygon + linje) er ny web-pakke — **Kenneth velger før V17-B** (§ 2b), fabel anbefaler `@geoman-io/leaflet-geoman-free`.
- Origo vises alltid (B2), utledet første gang og flyttbart; flytting → `manuell`. Radius-UI skjules når formen er
  soner (M7 #11).
- Områdelista på byggeplass-siden (BACKLOG-funnet fra 2026-10-03: ingen vei til geometrien) får nå nettopp den veien
  — modalens sone-liste.
- «Mangler plassering»-merket fra lag 1 og «upresis»-merket (B-7) står side om side; begge klikkbare til modalen.
- 🟡 **Ikke i V17:** å regne sonen tilbake til tegningsprosent så den vises i `OmradeOverlay` på tegningen. Mulig
  (`gpsTilTegning`), egen runde.

## 7. Ordre-splitt (anbefaling)

| Ordre | Innhold | Avhenger av | Migrering |
|---|---|---|---|
| **V17-A** | Leveranse A (shared) + C-2-ryddingen av filtrene (mobil, null atferdsendring for sirkler) | ingen | — |
| **V17-B** | Leveranse B (db + api) + D (web-modal: sone-liste, karttegning polygon/linje, hent-fra-tegning, origo, varsler) | V17-A merget (typene) | `omrader.geo_polygon` + `geo_kilde` (Kenneth-gatet) |
| **V17-C** | Leveranse C (mobil: `sone_geo_local` + gjenkjenning over soner) | V17-A + V17-B merget (feltene må finnes i `hentForFirma` FØR mobilen leser dem — lag 2-lærdommen M6) | lokal mobil |

| **V17-D** | «Del sone» (polygon-splitting) | V17-B + Kenneths pakkevalg | — |

**Rekkefølgen er ufravikelig** av samme grunn som L2-A → L2-B: server deklarerer feltene før telefonen leser dem.
**V17-A kan bestilles nå** — den avhenger av ingen pakke og ingen Kenneth-beslutning (gate 2026-10-04).

## 8. Tester som skal FEILE (DoD på tvers)

1. Sone får geometri på en punktløs byggeplass uten at origo utledes (service-invariant) · 2. GPS 300 m inn på
sidevegen gir hovedtraséen, ikke sidevegen (B4) · 3. Et `radiusM != null`-filter finnes fortsatt utenfor `sted.ts`
(grep-vakt, som haversine-vakten i lag 1) · 4. Mobil-katalog mister en sone ved refresh · 5. Sone tegnet på kart
(`kart`) overskrives av tegningsutledning · 6. Auto-sirkel > 1500 m uten upresis-merke · 7. Kartlinje bufret til korridor har feil bredde (målt normalt på linjen ≠ 30 m ± 5 %) · 8. Selvkryssende polygon
(figur-8) lagres · 9. Byggeplass med `manuell` punkt får ingen soner fra «Hent fra tegning» · 10. Auto-triggeren ved
georeferering gir en byggeplass soner (skal KUN gi punkt + sirkel). *(Areal-bevaring ved «Del sone» → V17-D.)*

## 9. Åpne punkter for gaten / Kenneth

1. ~~Sentroide som standardpunkt~~ — 🟢 **Kenneth 2026-10-04: ok** (sentroide av alle sone-hjørner, flyttbar). Åpent
   detaljspørsmål: når soner legges til senere, re-utledes origo IKKE automatisk (B2) — stabilt reise-anker. Snu hvis
   Kenneth vil at origo følger sonene til noen har flyttet det manuelt.
2. **Korridorbredde 30 m og upresis-grense 1500 m** — tall valgt av fabel, navngitte konstanter; justerbare.
3. **B4 polygon-over-sirkel** — produktvalg, begrunnet; kan snus til «minst areal uansett form».
4. ~~V17-b fri tegning~~ — 🟢 **Kenneth 2026-10-04: tegnes selv — kjernen i V17.** 🔴 **To pakkevalg er Kenneths
   (CLAUDE.md-pakkeregelen), med navn og lisens (§ 2b):** (a) tegneverktøy i web FØR V17-B — anbefalt
   `@geoman-io/leaflet-geoman-free` (MIT) · (b) polygon-splitting FØR V17-D — anbefalt `polygon-clipping` (MIT).
6. **Auto-trigger og soner:** avgjort etter gate-anbefaling — auto-triggeren utleder KUN punkt + sirkel; soner
   bare ved eksplisitt «Hent fra tegning» (B7). Kenneth kan snu.
5. Målingens § 6-SQL (antall byggeplasser pr. kilde, største radius, antall trasé-områder) er ikke kjørt — tallene
   endrer ikke specen, men sier hvor mange som får «upresis»-merket på dag én.
