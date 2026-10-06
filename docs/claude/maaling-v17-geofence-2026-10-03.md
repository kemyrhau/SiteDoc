---
name: maaling-v17-geofence-2026-10-03
description: Lesende måling (ingen kode) av dagens geofence-modell for V17 — byggeplass-lokasjon som sirkel (punkt+radius) ELLER polygon, med delt erInnenfor for timer + PSI. Fakta med fil:linje; grunnlag for fabels V17-spec. Hjemmel K10→V17 (helhetsplan § 4b V17, § 4 H23), Kenneth 2026-10-03.
sist_verifisert_mot_kode: 2026-10-03
eier: kontrollplan (måling) — fabel eier V17-specen som bygges på dette
status: 🟢 MÅLING KOMPLETT 2026-10-03. Lesende, ingen kodeendring. Størrelse-SQL (§6) venter Kenneth-kjøring mot sitedoc_test
---

# V17-MÅLING — byggeplass-lokasjon som sirkel ELLER polygon

> **Metode:** Hver påstand er **målt** (`fil:linje`), **utledet** (merket, slutning av fravær)
> eller **ikke målt**. Stier er repo-relative. Måledato 2026-10-03, branch `docs/maaling-v17-geofence`
> fra `origin/develop` (L2-B merget `28c7d168`).

## 0. Hovedfunn (det specen må bygge på)

1. **Avstand-mot-radius er ALLEREDE konsolidert til ÉN linje:** `sted.ts:70` (`m <= k.radiusM` i
   `gjenkjennSted`). Det finnes **ingen gjenværende kopier** av «haversine-avstand ≤ geofence-radius» å
   samle — `utils/geo.ts` og haversine-kopien i `dagsforslag.ts` er slettet (målt). Den delte `erInnenfor`
   V17 ber om er altså en **generalisering av `sted.ts:70`**, ikke en samling av spredt logikk. — målt.
2. **Det som ER spredt, er radius-GRENSENE** (byggeplass-API, oppmøtested-API, web-modal, DB-defaults) —
   `RADIUS_GRENSER` (`sted.ts:198-202`) navngir dem, men håndhevingen bor fortsatt på opprinnelsesstedene. — målt.
3. **PSI har INGEN geofence-innsjekk bygget** — `"geofence"` er kun en enum-/kildemarkør
   (`mannskap.ts:23`); ingen kodevei sammenligner GPS mot byggeplass. Fase C, krever juridisk sign-off
   (`mannskap.md:19`). Den delte `erInnenfor` blir dermed PSIs **første** geofence-forbruker. — målt.
4. **Polygon finnes alt** som `Omrade.polygon` (`Json [{x,y}]` i tegnings-PROSENT 0–100), men kan i dag
   **ikke** konverteres til lat/lng på mobil offline (mobil importerer ingen georeferanse-transform og
   speiler verken polygon eller referansepunkter). — målt + utledet.
5. **Byggeplassens PUNKT (sentrum) er reise-ankeret** og må bevares uansett geofence-form — matrisen bygges
   fra `b.latitude/b.longitude` (`reisetidMatrise.ts:84-85`); polygon endrer ikke reisen så lenge punktet står. — målt.

---

## 1. Dagens geofence-modell (`sted.ts`) + alle radius-sammenligninger

### 1a. `Geofence` + funksjonene og deres kallere
Kilde: `packages/shared/src/utils/sted.ts`. Re-eksportert i `packages/shared/src/utils/index.ts:31` (funksjoner)
og `:32` (typer) via `@sitedoc/shared`.

| Element | Def | Levende kallere (ikke-test) |
|---|---|---|
| `type Geofence = GpsPunkt & { radiusM }` | `sted.ts:26` | Strukturelt (kallerne bygger `{lat,lng,radiusM}`-objekter); import i `sted.test.ts:9` |
| `type Treff<T> = { sted, avstandM }` | `sted.ts:29` | returneres av `gjenkjennSted` |
| `avstandM(a,b)` (A1, haversine) | `sted.ts:42-53` | **Ingen ekstern direktekaller.** Kun internt av `gjenkjennSted` (`sted.ts:69`) + test |
| `gjenkjennSted(pos, kandidater)` (A2) | `sted.ts:62-75` | `ny.tsx:136`, `useArbeidsdag.ts:88`, `byggeplassKatalog.ts:95`; internt av `tolkPosisjon` |
| `tolkStart` (A3) | `sted.ts:120` | `StartSluttDagKort.tsx:480` |
| `tolkSlutt` (A4) | `sted.ts:132` | `StartSluttDagKort.tsx:481` |
| `velgDestinasjon` (A5) | `sted.ts:170-188` | `StartSluttDagKort.tsx:489` (eneste kaller) |
| `RADIUS_GRENSER` (A6) | `sted.ts:198-202` | **Ingen kaller** utenom `sted.test.ts` — kun navngitt konstant |
| `tolkPosisjon` (intern) | `sted.ts:96-117` | `tolkStart`/`tolkSlutt` |

— alt målt.

### 1b. Hvor `radiusM` leses og hvor avstand sammenlignes MOT radius
**Eneste levende avstand-mot-radius-sammenligning:** `sted.ts:70` — `if (m <= k.radiusM && (beste===null || m < beste.avstandM))`.
Alle fire geofence-kallere går via denne. — målt.

**Ingen gjenværende KOPIER** (eksplisitt verifisert ved fravær):
- `apps/mobile/src/utils/geo.ts` — SLETTET (finnes ikke). — målt (fravær)
- haversine-kopien i `dagsforslag.ts` — borte; avstander kommer ferdig fra reisematrise-celler. — målt
- `ny.tsx` «innenfor 500 m» — erstattet av `gjenkjennSted` (`ny.tsx:136`); «500 m» kun i kommentar (`:106,:129`). — målt
- `apps/web/.../timer/ny/page.tsx:48` — «GPS innenfor 500m» er KUN kommentar (web har ingen GPS). — målt

**Kallernes geofence-FILTRE** (leser `radiusM`, men sammenligner ikke avstand — kun null-sjekk på komplett geofence):
`ny.tsx:133-134` · `StartSluttDagKort.tsx:465-466` (bygg) + `:469-470` (oppmøte) · `useArbeidsdag.ts:85-86` ·
`byggeplassKatalog.ts:92-93` (+ leser `:57`) · `oppmotestedKatalog.ts:51` · web `byggeplasser/page.tsx:753-754`
(`harGeofence`). — målt.

**Radius LESES/SKRIVES (grense/validering/UI, ingen avstandssammenligning):**
`byggeplass.ts:187` (`z.int().min(1).max(100000)`), `:127` (`GEOKODET_RADIUS_M`), `:41,:117,:201` ·
`oppmotested.ts:154` (`radiusSchema.default(150)`), `:98,:170,:203,:221` · web `byggeplasser/page.tsx:1031,:1409,:1441` +
modal-glider (25–500) · web `firma/oppmotesteder/page.tsx` (flere) · `KartVelger.tsx:26,:35,:42-43,:179` (tegner sirkel) ·
`services/byggeplassGeofence.ts:21,:41,:56` + `georeferanse.ts:453` (BEREGNER radius fra tegning) ·
mobil `schema.ts:502` (oppmøte default 150), `:522` (byggeplass nullable); migrering `migreringer.ts:433,:515`. — målt.

**Avstand-mot-terskel som IKKE er geofence-radius (reise — tatt med for avgrensning):**
`reise.ts:188` (`avstandM < reiseTerskelM`, km-klassifisering) · `reise.ts:260` (`g.grenseM <= avstandM`, avstandsbånd).
Begge mot matrisens veiavstand, ingen haversine, ikke sirkel-avhengige. — målt.

**Bounds-sjekk (rektangel, ikke radius):** `OpprettDokumentModal.tsx:28,:236` (`erInnenforBounds`) ·
`georeferanse.ts:363,:369` (`erInnenforTegning`, margin mot 0–100). — målt.

### 1c. Gjenværende haversine-implementasjoner
Kun `sted.ts:32,:42-53` (kanonisk, `JORDRADIUS_M = 6_371_000`). `georeferanse.ts:394-395,:415-418`
er en EGEN ekvirektangulær tilnærming (`R=6371000`, `dx=dLng*cos(midLat)*R`, ingen `atan2`) for
tegnings-transformasjoner — ikke haversine, røres ikke. Ingen andre. — målt.

---

## 2. Byggeplass-datamodellen

### 2a. Prisma-modell + migrering
`model Byggeplass` (`packages/db/prisma/schema.prisma:1041`, `@@map("byggeplasser")` `:1083`). Geofence-felt (alle nullable):
- `latitude Float?` `schema.prisma:1053` · `longitude Float?` `:1054`
- `radiusM Int? @map("radius_m")` `:1055` (kommentar «tegningsutstrekning + buffer»)
- `geofenceKilde String? @map("geofence_kilde")` `:1060` — verdier (kommentar `:1056`): `"tegning" | "manuell" | "geokodet" | "ukjent" | null`
- (ikke geofence: `hmsregNummer Int?` `:1065`)

**Polygon bor IKKE på Byggeplass** — kun på `Omrade` (§3). Byggeplass = ren sirkel (punkt+radius). — målt.

**Migrering `20261002120000`** (`packages/db/prisma/migrations/20261002120000_byggeplass_geofence_kilde/migration.sql`):
- `:15` `ADD COLUMN IF NOT EXISTS "geofence_kilde" TEXT`
- `:20-21` backfill `latitude IS NOT NULL AND geofence_kilde IS NULL → 'ukjent'`
- `:25-33` CHECK `byggeplass_geofence_kilde_sammenheng`: `(latitude IS NULL) = (geofence_kilde IS NULL)` (idempotent DO-block; Prisma modellerer ikke CHECK). — målt.

### 2b. Hvor punkt/radius/kilde SKRIVES (tre veier)
- **Opprettelse** (`byggeplass.ts opprett`, `:98-139`): adresse → geokoding (`:122`), nøyaktig ett treff →
  `latitude/longitude = treff`, `radiusM = GEOKODET_RADIUS_M (150, :20)`, `geofenceKilde="geokodet"` (`:124-129`).
  Null/flere treff → ingen geo-felt. Geokoding kaster aldri (`:131-133`). — målt.
- **Kartmodal (web)** (`byggeplasser/page.tsx`): kartklikk `onVelgPosisjon` setter lat/lng + default radius 150
  (`:1410-1414`); lat/lng-input `:1424-1435`; radius slider 25–500 + tallfelt opp til 100000 `:1444-1460`.
  Lagre `handleLagreGeofence` (`:1028-1041`) → mutasjon **`settGeofence`** (`byggeplass.ts:181-209`), som skriver
  `geofenceKilde: input.latitude != null ? "manuell" : null` (`:204`) — manuell overstyring → `"manuell"`, nullstilling → `null`. — målt.
- **Utledning fra georeferert tegning:** `beregnByggeplassGeofence(ref, bufferM=100)` (`georeferanse.ts:433-455`):
  senter = tegningens midtpunkt (50,50 %)→GPS, radius = største senter→hjørne + buffer, avrundet. Service
  `oppdaterByggeplassGeofence` (`services/byggeplassGeofence.ts:18-63`) skriver `geofenceKilde:"tegning"` (`:57`),
  **freder `"manuell"`** (`:30`), `kunHvisTom` hopper om punkt finnes (`:27`). Auto-trigger ved georeferering:
  `tegning.ts:502` (kunHvisTom=true, best-effort `:500-506`). Eksplisitt: `beregnGeofence`-mutasjon
  (`byggeplass.ts:161-178` → `oppdaterByggeplassGeofence(…, false)`).
  🔴 **Korreksjon av ordrens hint:** `byggeplass.ts:135` er tom linje rett før `create`; tegnings-utledningen
  bor i `services/byggeplassGeofence.ts`, ikke `byggeplass.ts:135`. — målt.

### 2c. Mobil-speiling
Lokal tabell `byggeplassLocal` (`apps/mobile/src/db/schema.ts:513-524`): `lat real` `:520`, `lng real` `:521`,
`radiusM integer` `:522`. Katalog `byggeplassKatalog.refreshByggeplassKatalog` (`:23-64`) henter via
`bygning.hentForFirma` (`:36`) og mapper `lat/lng/radiusM` (`:55-57`). GPS-gjenkjenning `identifiserByggeplass`
(`:78-97`) filtrerer komplett geofence (`:91-94`) + `gjenkjennSted` (`:95`).
🔴 **`geofenceKilde` speiles IKKE på mobil** — verken i server-querien `hentForFirma` (`byggeplass.ts:31-43`)
eller i `byggeplass_local`. Mobil bruker kun punkt+radius. — målt.

---

## 3. Trasé/polygon i dag

### 3a. `Omrade` + `trase`
`model Omrade` (`schema.prisma:1086`, `@@map("omrader")` `:1110`): `type String @default("sone") // sone|rom|etasje|trase`
(`:1092`, `trase` lagt til 2026-09-23, enum håndheves i `omrade.ts:13`). Polygon: `polygon Json @default("[]")`
(`:1093`) = array av `{x,y}`. Knyttet til tegning via `tegningId String?` (`:1090`). — målt.
**Koordinatsystem: tegnings-PROSENT 0–100** (ikke piksler, ikke lat/lng) — Zod `polygonPunktSchema` krever
`x,y ∈ [0,100]` (`omrade.ts:6-9`); `GeoReferansePunkt.pixel` dokumentert «prosent 0-100» (`types/index.ts:903`).
`trase` = LINJE, `polygon` valgfritt for den (`omrade.ts:11-12`). — målt.

### 3b. Rendering (web + mobil)
- Web `OmradeOverlay.tsx`: SVG `viewBox="0 0 100 100"` + `preserveAspectRatio="none"` (`:27-28`),
  `points = polygon.map(p => \`${p.x},${p.y}\`)` (`:33`), krever `length >= 3` (`:32`).
- Mobil `TegningsVisning.tsx`: `interface Omrade { polygon: {x,y}[] }` (`:31-35`, «prosent-koordinater — parallelt med web»),
  WebView-SVG 100×100 (`:96`), samme punkt-mapping (`:79`).
Begge rendrer rått i prosent, ingen GPS-konvertering ved rendering. — målt.

### 3c. `georeferanse.ts`-funksjonene
- `beregnTransformasjon(ref)` `:191` — 2 pkt → similaritet, 3+ → affin minste-kvadrat; kaster ved degenerert (`:253,:276`).
- `gpsTilTegning(gps, t) → {x,y}` `:305` — **clamper 0–100** (`:326-327`).
- `tegningTilGps(pixel, t) → {lat,lng}` `:335` — invers; **clamper IKKE** (kan gi ugyldige koord.); kaster ved skala 0 (`:349`).
- `erInnenforTegning(gps, t, margin=10)` `:363` — `gpsTilTegning` + `-margin..100+margin` (`:368-369`).
Alle krever en `Transformasjon` fra `GeoReferanse` (2+ referansepunkter `{pixel(prosent), gps}`, `types/index.ts:902-911`).
Ren matte, ingen IO/nett. — målt.

### 3d. Polygon → lat/lng uten nett, på mobil?
- Transformasjonen er **ren/offline** (`georeferanse.ts` har null IO, kun `import type`). — målt.
- **MEN kan i dag ikke gjøres på mobil:** mobil importerer INGEN georeferanse-funksjoner (grep
  `tegningTilGps|gpsTilTegning|beregnTransformasjon|erInnenforTegning` i `apps/mobile/src` → 0 treff); mobil har
  en egen bbox-sjekk `OpprettDokumentModal.tsx:27-38` (`erInnenforBounds`, min/max — ikke affin). — målt.
- **Georeferanse-data speiles ikke i mobil SQLite:** ingen `drawing/tegning/omrade`-tabell, ingen
  `geoReference/polygon/referansepunkt`-kolonner i `schema.ts`; tegning + `geoReference` hentes online via
  `trpc.tegning.hentForProsjekt/hentMedId`. Eneste offline geo-data = byggeplassens avledede sirkel
  (`byggeplassLocal lat/lng/radiusM`). — målt (fravær) + utledet.
  **Konsekvens for V17:** polygon-geofence på mobil krever at polygonet (eller et avledet punkt/forhåndskonvertert
  lat/lng-polygon) speiles lokalt — rå `tegningTilGps` på mobil holder ikke uten at referansepunktene også speiles. — utledet.

---

## 4. PSI

- `mannskap.ts:23` — `KILDER = ["manuell","qr","geofence","hmskort","app"]` er en ren Zod-enum; `:184` input,
  `:214-223` `sjekkInn`-create lagrer `kilde` direkte. **Ingen GPS/lat/lng/avstand-mot-radius i mutasjonen.**
  Eneste kaller `MannskapInnsjekkKort.tsx:92-96` sender hardkodet `kilde:"app"`. Ingen kode produserer `"geofence"`. — målt.
- `mannskap.md:155-172` beskriver geofence-innsjekk-flyten (design-skisse, ingen status-markør på linjene);
  `:209-220` viser `startGeofencingAsync(...)` merket «// Forenklet». Autoritativ status `mannskap.md:19`:
  OS-geofence-region-monitoring = **Fase C, ikke bygd, krever juridisk sign-off**. — målt.
- **Bygget PSI:** manuell/app innsjekk+utsjekk (`mannskap.ts:179-225`), 12t auto-utsjekk/lazy-close
  (`mannskap.ts:43-53`, 🟢 `mannskap.md:19`). Ingen `expo` region-monitoring i repo (grep `startGeofencingAsync/Geofencing` → 0). — målt.
- **Konklusjon:** PSI-geofence-innsjekk er **enum/doc, ikke bygget**. Den delte `erInnenfor` blir PSIs første geofence-forbruker. — målt.

---

## 5. Timer-forbrukerne + sirkel-avhengighet

### 5a. Hvor «på byggeplassen» avgjøres (timer)
- `sted.ts` (§1a) er kilden; tolkningen (`kontor/byggeplass/utenfor/ukjent`) skjer i `tolkPosisjon` (`:96-117`).
- `dagsforslag.ts:369-417` `beregnReiseEtapper` bygger ut/retur kun på `start.type/slutt.type/destinasjon.type` —
  ingen rå lat/lng/radius (alt avgjort oppstrøms av `gjenkjennSted`). — målt.
- `StartSluttDagKort.tsx` LES-fase: `byggGeofencer`-filter `:464-466`, `oppmGeofencer` `:468-471`,
  `tolkStart/tolkSlutt` `:480-481`, `velgDestinasjon` `:483-493` (`harPunkt` `:486`), matrise `:501-508`. — målt.
- `ny.tsx` (faktisk sti `apps/mobile/app/timer/ny.tsx`): `gjenkjennSted` `:136`, kandidatfilter `:133-134`,
  treff→forvelg prosjekt `:141-145`; erstatter «500 m» (`:104-108,:128-131`). — målt.
- Ingen andre produksjonskall av sted.ts-funksjonene i timer. — målt.

### 5b. 🔴 Sirkel-avhengighet (knekker/endrer betydning med polygon)
| # | fil:linje | Hva skjer med polygon |
|---|---|---|
| 1 | `sted.ts:26` (`type Geofence`) | Datatypen ER punkt+radius; polygon passer ikke → alle kallere må endre form |
| 2 | `sted.ts:70` (`m <= k.radiusM`) | Radius-terskel; «inni?» må bli punkt-i-polygon. **KNEKKER** |
| 3 | `sted.ts:70` (`m < beste.avstandM`) | «Nærmeste vinner» målt til SENTRUM; polygon har ikke veldefinert senter-avstand. **ENDRER BETYDNING** |
| 4 | `sted.ts:29,:62-65` (`Treff.avstandM`) | Treffet returnerer en avstand; udefinert «inni» polygon. **ENDRER BETYDNING** |
| 5 | `StartSluttDagKort.tsx:464-466` | `radiusM != null`-filter → ren-polygon-byggeplass filtreres bort. **KNEKKER** |
| 6 | `StartSluttDagKort.tsx:469-470` | Samme for oppmøtested → `start.type` blir aldri `kontor` → ingen reise-etappe. **KNEKKER** |
| 7 | `ny.tsx:133-134` | `radiusM !== null`-filter → polygon-byggeplass gir aldri geo-forslag (H2). **KNEKKER** |
| 8 | `ny.tsx:136-139` | `gjenkjennSted` arver #2/#3 |
| 9 | `sted.ts:177-178` (A5 `harPunkt`, nøyaktig én) | Polygon uten lagret punkt → `harPunkt=false` → `ingen_byggeplass_med_punkt`. **ENDRER/KNEKKER** |
| 10 | `StartSluttDagKort.tsx:486` | `harPunkt = lat!=null && lng!=null` — binært på punkt; mater #9 |
| 11 | `sted.ts:198-202` (`RADIUS_GRENSER`) + UI | Radius-glider/tallfelt mister mening for polygon. **ENDRER BETYDNING (UI)** |

Harde knekkpunkter: typen (`sted.ts:26`), radius-terskel + nærmeste-sentrum (`sted.ts:70`), `Treff.avstandM`
(`sted.ts:29`), de tre `radiusM != null`-filtrene, A5s `harPunkt`-opptelling, og radius-UI. — målt.

### 5c. Reise bruker byggeplassens PUNKT (bevares uansett form)
Matrisen slås opp på ID (`reisetidMatriseKatalog.hentMatriseRadLokalt:66-83`), bygges server-side fra
`b.latitude/b.longitude` (`reisetidMatrise.ts:84-85`, kommentar `:77` «KUN byggeplassens eget punkt»);
byggeplass uten punkt → «mangler-punkt»-sett (`:42`). Polygon endrer IKKE reisen **så lenge punktet bevares**
som ruteanker. — målt.

---

## 6. Størrelse — lim-klar SQL mot `sitedoc_test` (Kenneth kjører)

> Byggeplass-tabell `byggeplasser`; kolonner `latitude/longitude/radius_m/geofence_kilde/created_at` (§2a).
> Polygon-tabell `omrader`, `type`, `opprettet` (§3a). Kjør hver for seg:

```sh
# (A) Byggeplasser med punkt, per kilde, med radius-spenn + nyeste created_at
ssh -t server-ny "sudo docker exec postgres psql -U sitedoc -d sitedoc_test -c \"SELECT geofence_kilde, count(*) AS antall, min(radius_m) AS min_radius, max(radius_m) AS max_radius, max(created_at) AS nyeste FROM byggeplasser WHERE latitude IS NOT NULL GROUP BY geofence_kilde ORDER BY antall DESC;\""

# (B) Totalt med/uten punkt
ssh -t server-ny "sudo docker exec postgres psql -U sitedoc -d sitedoc_test -c \"SELECT count(*) FILTER (WHERE latitude IS NOT NULL) AS med_punkt, count(*) FILTER (WHERE latitude IS NULL) AS uten_punkt, count(*) AS totalt FROM byggeplasser;\""

# (C) Trasé/polygon-områder (type=trase): finnes noen på test? + nyeste
ssh -t server-ny "sudo docker exec postgres psql -U sitedoc -d sitedoc_test -c \"SELECT count(*) AS antall_trase, max(opprettet) AS nyeste FROM omrader WHERE type = 'trase';\""
```
Spørsmålene «hvor mange auto-utledet fra tegning» + «største radius» besvares av (A): rad `geofence_kilde='tegning'`
= auto-utledet, kolonnen `max_radius` = største radius. — SQL forfattet; **tallene ikke målt** (krever Kenneth-kjøring).

---

## 7. Tester som dekker `sted.ts` + geofence

| Fil | Antall `it` | Dekker |
|---|---|---|
| `packages/shared/src/utils/sted.test.ts` | **21** | A1 avstandM (4, `:29-48`), A2 gjenkjennSted (5, `:57-80`), A3/A4 tolkStart/Slutt (6, `:92-122`), A5 velgDestinasjon (5, `:137-182`), A6 RADIUS_GRENSER (1, `:193`) |
| `apps/api/src/routes/byggeplass-geofence-kilde.integration.test.ts` | 5 | DB CHECK `geofence_kilde` ↔ punkt (`:37-61`) |
| `apps/api/src/services/byggeplass-geofence-manuell-vern.test.ts` | 3 | `oppdaterByggeplassGeofence` manuell-vern (`:47-68`) |
| `apps/api/src/routes/byggeplass-opprett-geokod.test.ts` | 4 | geokoding ved opprettelse |
| `apps/mobile/src/utils/dagsforslag.test.ts` | 25 (herav 11 reise-etappe/vindu `:317`) | ut-etappe+V8, reise ikke-OT, samme-byggeplass→ingen etappe, mangler_matrise |
| `apps/api/src/services/reisetidMatrise-h21.test.ts` | 3 | matrise fra byggeplass-punkt, mangler-punkt, uoppnåelig (-1) |
| `packages/shared/src/utils/georeferanse.test.ts` | 4 | beregnTransformasjon, gpsTilTegning, tegningTilGps (`:54-148`) |

🔴 **`erInnenforTegning` har INGEN test** (0 forekomster i testfiler) — relevant hvis V17 gjenbruker/utvider den
for polygon-innenfor. — målt.
Ikke geofence (avgrensning): `byggeplassFilter.test.ts` (7) tester query-filtrering, ikke radius. — målt.

---

## 8. Funn utenfor scope (merket separat)
- **`erInnenforTegning` utestet** (§7) — eksportert + dokumentert i `utils/CLAUDE.md`, men null tester. Egen lapp.
- **`RADIUS_GRENSER` har ingen produksjonskaller** (`sted.ts:198-202`) — grensene håndheves fortsatt på
  opprinnelsesstedene (`byggeplass.ts:187`, `oppmotested.ts:154`, web-modal). Konstanten dokumenterer, binder ikke. Egen lapp.
- **`geofenceKilde` speiles ikke til mobil** (§2c) — i dag irrelevant (mobil bruker kun punkt+radius), men hvis V17
  lar mobil skille sirkel/polygon trengs et form-/kilde-felt i `byggeplass_local` + server-query. Egen lapp.
