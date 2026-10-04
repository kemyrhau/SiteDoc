---
name: v17-geofence-spec
description: Spesifikasjon for V17 — byggeplassens lokasjon som sirkel (punkt+radius, standard) ELLER én eller flere soner (polygon tegnet på kart, trasé + sideveger), med origo utledet av sonene og én delt erInnenfor for timer og PSI. v2 etter Kenneth 2026-10-04. Bygger på kontrollplans måling 2026-10-03. Gates av orkestrator før ordrer.
sist_verifisert_mot_kode: 2026-10-04
versjon: v2 (2026-10-04) — Kenneth: polygon tegnes selv, origo utledes av resultatet, hver sideveg = egen sone
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
| **B1** | **Polygonet lagres i lat/lng på `Omrade`** (`geoPolygon Json? [{lat,lng}]` + `geoKilde "kart" \| "tegning" \| null`), **ett polygon pr. sone**, en byggeplass har null eller flere. Tegnes på kartet (primær vei) eller transformeres fra tegningsprosent på serveren (sekundær, krever georeferert tegning). Mobilen speiler lat/lng-polygonene og regner aldri om | Kenneth v2: tegnes selv, hver sideveg = egen sone. `Omrade` er alt byggeplassens soner (måling § 3a). Løser M3 uten transform på mobil |
| **B2** | **Origo (punktet) er obligatorisk for alle former og UTLEDES av sonene** når det ikke er satt eksplisitt: sentroiden av alle sone-hjørner, `geofenceKilde = "soner"`; lagres første gang en sone får geometri, re-utledes ikke automatisk når soner endres (punktet er reise-anker — stabilt), men kan flyttes i modalen (→ `manuell`). Invariant: byggeplass med ≥ 1 geo-sone ⇒ punkt finnes (service + test; kryss-tabell-CHECK finnes ikke) | Kenneth v2: «utlede et origo basert på resultat av polygon» + 9.1 ok. Reisen trenger punktet (§ 0); A5 `harPunkt` forblir riktig |
| **B3** | **Formen er utledet, ikke lagret:** `geofenceForm = polygon ? "polygon" : radiusM ? "sirkel" : null`. Én funksjon i shared, ingen kolonne | Ingen ny identitetskolonne å backfille (stille-tomhet); formen kan ikke drifte fra dataene |
| **B4** | **Sone vinner over sirkel ved overlapp.** Treff-prioritet i `gjenkjennSted`: (1) sone-treff, minst areal først · (2) sirkel-treff, nærmest sentrum først. **Treffet bærer `omradeId`** — en sideveg-sone vinner over hovedtraséen der de overlapper | Sonen er den mer presise påstanden. Areal-regelen gir sidevegen forrang over hovedtraséen, og «rom i bygg» over «hele anlegget» |
| **B5** | **Linje → korridor.** Tegnes eller utledes en sone som LINJE (`trase` uten polygon, `omrade.ts:11-12`), bufres den til korridor med `TRASE_KORRIDOR_BREDDE_M = 30` (navngitt, justerbar pr. sone i modalen). Kartet tilbyr både polygon og linje-med-bredde | M3: trasé er en linje. Korridoren er «langt og relativt smalt»; en sideveg tegnes raskest som linje |
| **B6** | **Auto-sirkel over `GEOFENCE_UPRESIS_RADIUS_M = 1500` merkes «upresis»** i lista og matrise-flaten, med teksten «sirkelen dekker N km — tegn trasé eller sett polygon». Utledet ved visning fra radius, ingen kolonne | Straks-tiltaket fra K10. Stopper det verste for Røstbakken-klassen før polygonet er satt |
| **B7** | **Tegningsutledning foretrekker soner:** finnes områder med tegnings-polygon på en georeferert tegning, utleder «Beregn fra tegning» geo-polygon pr. område (B5) i stedet for én sirkel. Ellers sirkel som i dag (M5). Sekundær vei — karttegning er primær | Eksisterende trasé-områder får geometri uten ny tegning; sirkelen er fallback, ikke standard, for anlegg |
| **B8** | **`manuell`/`kart` fredes** — punkt satt manuelt og soner tegnet på kart (`geoKilde = "kart"`) overskrives aldri av tegningsutledning | Lag 1 C4 utvidet til soner |
| **B9** | **Byggeplassens geofence = unionen av sonene**, med sirkelen som fallback KUN når ingen sone har geometri. Sirkel og soner kombineres ikke | Én modell pr. byggeplass å resonnere om; «upresis»-merket (B6) gjelder bare sirkel-byggeplasser |

## 3. Leveranse A — stedsmodellen (`packages/shared/src/utils/sted.ts`)

```ts
export type Sirkel  = { form: "sirkel";  lat: number; lng: number; radiusM: number };
export type Polygon = { form: "polygon"; lat: number; lng: number; punkter: GpsPunkt[]; omradeId: string; omradeNavn: string }; // lat/lng = byggeplassens origo (B2)
export type Geofence = Sirkel | Polygon;
```

| # | Funksjon | Kontrakt |
|---|---|---|
| **A1** | `erInnenfor(pos: GpsPunkt, g: Geofence): boolean` | Sirkel: `avstandM(pos, g) ≤ radiusM` (= dagens `sted.ts:70`). Polygon: ray-casting i et lokalt plan rundt ankerpunktet (`x = (lng−lng0)·cos(lat0)`, `y = lat−lat0`, begge i grader — polygoner er km-skala, ikke kontinent-skala). Kant teller som innenfor. **Dette er PSIs funksjon** (M8) — ingen PSI-kode i V17 |
| **A2** | `polygonArealM2(p: Polygon): number` | Shoelace i samme plan ×(m/grad)². Kun for B4-prioritet, ikke for visning |
| **A3** | `gjenkjennSted<T extends Geofence>(pos, kandidater): Treff<T> \| null` | Generalisert: treff = `erInnenfor`; prioritet etter B4. **Kandidatene er geofencer, ikke byggeplasser** — en byggeplass med tre soner bidrar tre polygon-kandidater (samme `byggeplassId`), en sirkel-byggeplass én. `Treff` får `form` + `omradeId` (null for sirkel) og beholder `avstandM` (til origo — logging, ikke avgjørelse). Kallerne mapper treff → byggeplass |
| **A4** | `tilGeofencer(b: { lat, lng, radiusM, soner: {id,navn,punkter}[] }): Geofence[]` (tom liste = ikke gjenkjennbar) | **Erstatter de tre `radiusM != null`-filtrene** (M7 #5–#7) med ÉN kilde. Soner med ≥ 3 punkter → én polygon-kandidat hver; ingen soner ∧ radius → én sirkel (B9); ellers tom. Krever punkt (B2) |
| **A5** | `geofenceForm(b): "sirkel" \| "polygon" \| null` | B3, ren |
| **A6** | `GEOFENCE_GRENSER` | `RADIUS_GRENSER` (M9) utvides med `POLYGON_MIN_PUNKTER = 3`, `POLYGON_MAKS_PUNKTER = 500`, `GEOFENCE_UPRESIS_RADIUS_M = 1500`, `TRASE_KORRIDOR_BREDDE_M = 30` — **og API-validatorene (`byggeplass.ts:187`, `oppmotested.ts:154`) importerer dem**, så konstanten binder, ikke bare dokumenterer |

`tolkStart/tolkSlutt/velgDestinasjon` endres ikke i signatur — de får `Geofence`-kandidater via A4 og arver A3.

**Tester (shared):** A1 sirkel = dagens 5 tester uendret · A1 polygon: innenfor/utenfor/på kant/konkav (U-form, punkt i «bukta» = utenfor)/≥ 3 punkter krav · A3 blandet: punkt inne i både sirkel og sone → sone; **hovedtrasé + sideveg overlapper → sidevegen (minst areal), og treffet bærer sidevegens `omradeId`**; to sirkler → nærmest sentrum · A4: punkt+radius ✔, punkt+soner ✔ (tre kandidater), soner uten punkt → tom, punkt alene → tom · **Røstbakken-testen:** hovedtrasé 6 km × 60 m + sideveg 800 m × 40 m; GPS 2 km langs hovedvegen → hovedtrasé; GPS 300 m inn på sidevegen → sidevegen; dagens auto-sirkel (M5) med samme tegning gir radius > 1500 m → `upresis`.

## 4. Leveranse B — datagrunnlag (db + api)

| # | Endring | Hvor |
|---|---|---|
| **B-1** | Additiv migrering i `packages/db`: `omrader.geo_polygon JSONB NULL` + `omrader.geo_kilde TEXT NULL` (`kart \| tegning`). CHECK `(geo_polygon IS NULL) = (geo_kilde IS NULL)`. **Ingen backfill** — ingen sone har lat/lng i dag (tegningsprosent-polygonet står urørt; måling § 6 C teller trasé-områder, de utledes på bestilling via B-4). Invarianten «≥ 1 geo-sone ⇒ byggeplass har punkt» håndheves i servicen (B2) med **test som FEILER** når en sone lagres på en punktløs byggeplass uten at origo utledes | `schema.prisma:1086-1110` (Omrade), ny migrering |
| **B-2** | `Byggeplass.geofenceKilde` får verdien `"soner"` (origo utledet av sonene, B2). Kommentaren på `:1056` oppdateres. `radiusM` beholdes for sirkel-byggeplasser; for sone-byggeplasser er den irrelevant (B9) og UI skjuler den | `schema.prisma:1056-1060` |
| **B-3** | Ny `omrade.settGeometri({ omradeId, polygon?: {lat,lng}[], linje?: {lat,lng}[], korridorBreddeM? })` — polygon direkte, eller linje som bufres (B5) på serveren. Zod: `POLYGON_MIN_PUNKTER..POLYGON_MAKS_PUNKTER`, lat/lng-grenser. `geoKilde = "kart"`. Har byggeplassen ikke punkt → origo = sentroide av alle sonenes hjørner, `geofenceKilde = "soner"`, og `recomputeRadForByggeplass` trigges (reise-ankeret er nytt). `settGeofence` (`byggeplass.ts:181-209`) beholdes for punkt/radius; punkt flyttet manuelt → `manuell` som i dag | ny i `omrade.ts` |
| **B-4** | Ny `utledGeometriFraTegning(omradeId)` (service + mutasjon): leser `Omrade.polygon` (prosent) + tegningens `geoReference`, transformerer hvert punkt med `tegningTilGps` (M4 — transformer FØR buffer, siden den ikke clamper), bufrer linje til korridor (B5), skriver `geoPolygon` med `geoKilde = "tegning"` + origo (B2). **Freder `kart`** (B8). Degenerert georeferanse → `BAD_REQUEST` som i dag | ny i `services/byggeplassGeofence.ts` |
| **B-5** | `oppdaterByggeplassGeofence` (tegningsutledning): **soner først** (B7) — finnes områder med polygon på tegningen → B-4 pr. område; ellers sirkel som i dag. `kunHvisTom` gjelder begge; `manuell`/`kart` fredes | `services/byggeplassGeofence.ts:18-63`, `tegning.ts:502` |
| **B-6** | `bygning.hentForFirma` returnerer `geofenceKilde` + `soner: { id, navn, type, geoPolygon }[]` (kun soner med geometri) pr. byggeplass (M6) | `byggeplass.ts:31-43` |
| **B-7** | **Varsler (B6):** byggeplasslista og matrise-flaten viser «upresis» når `form = sirkel ∧ radiusM > GEOFENCE_UPRESIS_RADIUS_M`, med lenke til «Beregn fra tegning». Teller i matrise-flaten: «N byggeplasser med upresis sirkel» ved siden av «mangler punkt» fra lag 1 | `oppsett/byggeplasser/page.tsx:762-785`, `innstillinger/page.tsx` matrise-boksen |

## 5. Leveranse C — mobil

- **C-1** Ny lokal tabell `sone_geo_local { id, byggeplass_id, project_id, navn, type, geo_polygon TEXT, sist_oppdatert }`
  (én rad pr. sone med geometri) + `byggeplass_local.geofence_kilde TEXT`; lokal idempotent migrering
  (`migreringer.ts`-mønster). `refreshByggeplassKatalog` skriver begge (`byggeplassKatalog.ts:23-64`), hele settet
  overskrives pr. firma som i dag.
- **C-2** `identifiserByggeplass` (`byggeplassKatalog.ts:78-97`), `StartSluttDagKort.tsx:464-471`, `ny.tsx:133-139`
  bygger kandidater med `tilGeofencer(b)` (A4) over byggeplass + dens soner — **de tre `radiusM != null`-filtrene
  forsvinner.** Treffet mappes tilbake til byggeplass; `omradeId` følger med i `arbeidsdag_local`
  (`byggeplass_sone_id`, ny kolonne) som dokumentasjon — brukes ikke til lønn i V17. Oppmøtested forblir sirkel.
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
| **V17-C** | Leveranse C (mobil: `sone_geo_local` + gjenkjenning over soner + `byggeplass_sone_id` på arbeidsdagen) | V17-A + V17-B merget (feltene må finnes i `hentForFirma` FØR mobilen leser dem — lag 2-lærdommen M6) | lokal mobil |

**Rekkefølgen er ufravikelig** av samme grunn som L2-A → L2-B: server deklarerer feltene før telefonen leser dem.

## 8. Tester som skal FEILE (DoD på tvers)

1. Sone får geometri på en punktløs byggeplass uten at origo utledes (service-invariant) · 2. GPS 300 m inn på
sidevegen gir hovedtraséen, ikke sidevegen (B4) · 3. Et `radiusM != null`-filter finnes fortsatt utenfor `sted.ts`
(grep-vakt, som haversine-vakten i lag 1) · 4. Mobil-katalog mister en sone ved refresh · 5. Sone tegnet på kart
(`kart`) overskrives av tegningsutledning · 6. Auto-sirkel > 1500 m uten upresis-merke · 7. Linje-sone bufres FØR
transform (koordinatene blir da feil; testen sammenligner korridor-bredde i meter etter transform).

## 9. Åpne punkter for gaten / Kenneth

1. ~~Sentroide som standardpunkt~~ — 🟢 **Kenneth 2026-10-04: ok** (sentroide av alle sone-hjørner, flyttbar). Åpent
   detaljspørsmål: når soner legges til senere, re-utledes origo IKKE automatisk (B2) — stabilt reise-anker. Snu hvis
   Kenneth vil at origo følger sonene til noen har flyttet det manuelt.
2. **Korridorbredde 30 m og upresis-grense 1500 m** — tall valgt av fabel, navngitte konstanter; justerbare.
3. **B4 polygon-over-sirkel** — produktvalg, begrunnet; kan snus til «minst areal uansett form».
4. ~~V17-b fri tegning~~ — 🟢 **Kenneth 2026-10-04: tegnes selv — kjernen i V17, ikke senere.** Tegneverktøy i
   Leaflet (`leaflet-draw` el.l.) er ny avhengighet i web — orkestrator velger bibliotek, CLAUDE.md-regelen om pakker
   som påvirker andre moduler gjelder (spør).
5. Målingens § 6-SQL (antall byggeplasser pr. kilde, største radius, antall trasé-områder) er ikke kjørt — tallene
   endrer ikke specen, men sier hvor mange som får «upresis»-merket på dag én.
