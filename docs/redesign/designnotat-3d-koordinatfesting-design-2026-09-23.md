---
status: 🟡 UTREDNING. § 4 lukket ved måling 2026-09-23. 🔴 § 8 trinn 2 RETTET 2026-09-24 — punktsky skal leve (masseregnskap)
opprettet: 2026-09-23
forfatter: design
utløst_av: Kenneth 2026-09-23 — «det var vanskelig å koordinatfeste 3d mot dwg/pdf tegninger. den ene fiksen ødela i den andre. En utledning og en plan er nødvendig.»
sist_verifisert_mot_kode: 2026-09-23
søsternotat: designnotat-georeferanse-speiling-design-2026-09-23.md
---

# 3D-koordinatfesting mot tegning — hvorfor den ene fiksen ødela den andre

**Kenneth 2026-09-23, ordrett:** *«det jeg opplevde av problemer med 3d → det er at det var vanskelig å
koordinatfeste 3d mot dwg/pdf tegninger. den ene fiksen ødela i den andre. En utledning og en plan er
nødvendig.»*

**BACKLOG-grep før kravene (§ Ordre-anatomi steg 0):** fem søkeformer — `3D`, `punktsky`, `potree`,
`koordinat`, `georefer`. **Treff finnes, men ingen på selve saken.** §296 og §318 handler om de manglende
binærene, §345 om at punktsky feiler lesbart, §239 er georeferanse-speilingen. **Koordinatfestingen av 3D mot
tegning står ikke i BACKLOG i noen form.** Det skrives ned her slik at neste leser vet at det ble søkt, ikke
glemt.

---

## § 1 Svaret på setningen din, i én tabell

Setningen «den ene fiksen ødela i den andre» er ikke en følelse. Den har en dato, to commit-hasher og en
mekanisme.

| Dato | Commit | Hva den gjorde | Hva den rørte |
|---|---|---|---|
| 2026-03-31 | **`c043b67f`** | «Direkte similarity-transform i stedet for GPS+rotasjon+skala» | `routes/tegning.ts` (+11), `tegning-3d/page.tsx` (228 linjer) |
| 2026-08-13 | **`7dd4df8d`** | «fix(georef): rett speilfeil i 2-punkts kalibrering» | `georeferanse.ts` (+67/−27), `georeferanse.test.ts` (+171) |

**Ingen av de to rører én eneste fil den andre rørte.** Det er hele saken.

`c043b67f` gjorde 3D-siden **uavhengig** av GPS-veien — med vilje, fordi GPS-veien ga drift. Etter den commiten
har `tegning-3d/page.tsx` to veier mellom tegning og 3D-modell, og den delte er andrevalg
(`tegning-3d/page.tsx:623-632`, målt):

```
if (kalibTransform)                         → tegningTil3D()      ← direkte piksel↔3D, rører ALDRI GPS
else if (transformasjon && ifcOpprinnelse)  → tegningTilGps() → gpsTil3DRotert()  ← den delte veien
else return
```

`7dd4df8d` rettet speilfeilen i `georeferanse.ts`. **Men en kalibrert modell tar aldri den veien.** Fiksen var
riktig, testene var grønne (171 nye linjer), og for en kalibrert 3D-modell var den usynlig.

🔴 **Det er ikke to fikser som slåss. Det er én fiks som ikke kan nå fram, fordi den andre fiksen med vilje
bygde en omvei rundt koden den ligger i.**

---

## § 2 Det er ikke to koordinatmodeller. Det er tre — og den tredje er tom

Alle tre ble født innenfor elleve dager i mars 2026, og ingen av dem er forsonet med de andre.

| # | Hva | Hvordan den stedfester | Hvor koden bor | Født |
|---|---|---|---|---|
| **1** | **2D-tegning** | `geoReference` = to piksel↔GPS-par | `georeferanse.ts` (9 commits, sist 2026-08-13) | `b0e823eb` 20.03 |
| **2** | **IFC-modell** | `gpsOverride.transform` = `{a,b,tx,tz}` piksel↔3D **(primær)**, `koordinatBro` GPS↔UTM↔3D **(fallback)** | `tegning-3d/page.tsx` + `koordinatBro.ts` (**1 commit**, sist 2026-03-23) | `146673cf` 23.03 |
| **3** | **Punktsky** | 🔴 **ingenting** | — | `dd5df1a1` 20.03 |

**Modell 1 har vandret ni ganger. Modell 2 har stått stille siden mars. Modell 3 ble aldri bygget.**

At `koordinatBro.ts` har **én** commit — `146673cf`, 23. mars, aldri endret siden — er den viktigste enkelt-
målingen i notatet. Broen mellom GPS og 3D-verden er et halvt år gammel og har ikke fulgt noen av de ni
rettelsene på 2D-siden.

---

## § 3 Punktsky har ingen koordinatmodell. Ikke feil koordinater — ingen

Dette er ikke en bug som skal rettes. Det er en funksjon som aldri ble ferdig.

| Ledd | Hva som mangler | Målt |
|---|---|---|
| **Konvertering inn** | `-GLOBAL_SHIFT` sendes ikke til CloudCompare | `punktskyKonvertering.ts:55-60` |
| **Konvertering ut** | `--projection` sendes ikke til PotreeConverter | `punktskyKonvertering.ts:107-111` |
| **Filheader** | LAS' egen scale + offset **leses aldri** (header-byte 131-179) | `lasHeader.ts:77-205` |
| **Database** | `PointCloud.coordinateSystem` er **aldri skrevet og aldri lest** | `schema.prisma:944` |
| **Viewer** | leser ingen transformasjon; kameraet sentreres på punktene | `punktskyer/page.tsx:544-551` |
| **Broen** | punktsky-koden importerer **null** koordinatfunksjoner | 0 treff i tre filer |

🔴 **`PointCloud.coordinateSystem` er et brudd på «Stille tomhet er forbudt»** (CLAUDE.md, Kenneth-vedtak
2026-09-10). Kolonnen bærer identitet — *hvilket system er disse tallene i* — og har stått tom siden `dd5df1a1`
20. mars. Målt: hver eneste forekomst av `coordinateSystem` i hele monorepoet tilhører `Drawing`
(`routes/tegning.ts:163,198,527,550` skriver, tre sider leser). **For `PointCloud`: null skrivevei, null
lesevei.** Samme mønster som `group_faggrupper` og `users.ny_navigasjon` — regelen ble vedtatt på grunn av
nøyaktig dette, og denne kolonnen er eldre enn regelen.

**Det lagrede `boundingBox` (`punktsky.ts:90`) er derfor ikke tolkbart.** Er filen UTM33, er tallene UTM33.
Er den lokal, er de lokale. **Ingen felt i systemet sier hvilket**, og et tall uten system er ikke en
koordinat — det er et tall.

**Og hele visningsveien er død, ikke bare ukoordinatfestet:**
- URL-en redirecter bort fra vieweren — `next.config.js:126-130`, `/punktskyer` → `/3d-visning`.
- I `/3d-visning` rendres punktskyen **kun som tekst i et sidepanel**, uten onClick — `3d-visning/page.tsx:213-232`.
- `punktsky-triangulering.ts` har **null kallere**.
- `PotreeCanvas` (`punktskyer/page.tsx:451`) er eneste `loadPointCloud`-kallsted i hele `apps/`.

⚠️ **Det endrer hastesaken fullstendig.** Punktsky kan ikke koordinatfestes «tilbake til slik det var», for det
har aldri virket geografisk. Og siden `CloudCompare`/`PotreeConverter` mangler i begge containere
([BACKLOG §296](../claude/BACKLOG.md)), kan ingen ny punktsky i det hele tatt lages i dag — **det finnes ingen
testartefakt å måle en fiks mot.**

---

## § 4 🟢 Fella som var lukket før den ble funnet — MÅLT 2026-09-23

**Denne seksjonen sa opprinnelig «en felle som venter på en helt normal handling». Målingen motbeviste det.
Mekanismen finnes i koden; ingen rad oppfyller forutsetningen.**

`gpsOverride` er ett JSON-felt (`schema.prisma:914`), skrevet i én mutasjon (`routes/tegning.ts:430-453`),
med to halvdeler av ulik alder:

| Halvdel | Hvordan den beregnes | Berørt av `7dd4df8d`? |
|---|---|---|
| `lat` / `lng` | `tegningTilGps({x:50,y:50}, transformasjon)` — **gjennom** `georeferanse.ts` (`tegning-3d/page.tsx:487`) | Ja — **men bare når en georeferanse finnes** |
| `transform:{a,b,tx,tz}` | tilpasset direkte fra klikkede pikselpar, uten GPS (`:453-470`) | Nei |

🔴 **Forutsetningen er en `geoReference`.** `transformasjon` utledes av den; uten den kan `tegningTilGps`
ikke kalles, og `lat/lng` kan ikke ha kommet den veien.

### Målingen (Kenneth kjørte, test + prod, 2026-09-23)

| Base | Rader med `gps_override` | Med `transform` **og** `lat` | Skrevet før 2026-08-13 | Med `geo_reference` |
|---|---|---|---|---|
| `sitedoc_test` | **1** | 1 | 1 | 🟢 **0 — `har_georef = f`** |
| `sitedoc` (prod) | 🟢 **0** | 0 | 0 | — |

**Den ene raden:** `1264d656`, `file_type = ifc`, `updated_at 2026-04-15`,
`{"lat":69.637…, "lng":18.915…, "transform":{a,b,tx,tz}}`, **`geo_reference` NULL**.

🟢 **Konklusjon: ingen forurensede koordinater finnes.** Den ene kalibrerte tegningen har ingen georeferanse,
så `lat/lng` er satt en annen vei (kartvelger eller IFCSITE) og har aldri vært gjennom den speilfeil-rammede
funksjonen. Prod har ingen kalibrerte tegninger i det hele tatt. **Og vinduet er lukket:** funksjonen ble
rettet 13. august, så enhver kalibrering fra da av bruker den rettede versjonen.

**Ingen backfill kreves. Ingen varsling kreves.** Det som gjensto av saken var et tall, og tallet er 0.

### 🟢 Men raden beviser § 1 — på data, ikke på commit-innhold

**Den eneste kalibrerte modellen i systemet er en IFC-tegning UTEN georeferanse, posisjonert utelukkende av
`gpsOverride.transform`.** Den fungerer uten noen kobling til GPS eller tegningens georeferanse. Det er presis
avkoblingen `c043b67f` innførte — og den er nå målt, ikke utledet.

⚠️ **Én bifunn i samme rad:** `coordinate_system` er **NULL** på en IFC-tegning, og
`tegning-3d/page.tsx:145-150` defaulter da blindt til `"utm33"`. For Tromsø-området er utm33 tilfeldigvis
riktig (Kartverket bruker sone 33 for hele fastlandet), **så feilen er usynlig her**. Den blinde defaulten
står fortsatt — se § 5 og `koordinatKonvertering.ts:211-212`.

## § 5 Fire ting som ikke finnes, og ett stykke villedende kode

| Hva | Følge | Målt |
|---|---|---|
| **`koordinatBro.test.ts`** finnes ikke | `wgs84TilTm` (`koordinatBro.ts:27-78`) er en håndskrevet invers av `tmTilWgs84` (`koordinatKonvertering.ts:40-119`). **To uavhengige serieutviklinger, ingen rundturs-test.** De kan drifte uten at noe sier fra | kun `georeferanse.test.ts` finnes |
| **Ingen test binder de to 3D-veiene** | `tegningTil3D` og `gpsTil3D` skal gi samme svar for samme punkt. Ingen test sier det | — |
| **`proj4` brukes ikke** | All Transverse Mercator er egen-implementert, WGS84-ellipsoiden hardkodet to steder (`koordinatKonvertering.ts:47-48`, `koordinatBro.ts:34-35`) | 0 treff |
| **Ingen backfill etter `7dd4df8d`** | § 4 | 2 filer i commiten |
| ⚠️ **GPS-beinet av kalibreringen er dødt** | `kalibPunktA.tegningGps` (`:444`) og `kalibTegningGpsB` (`:611`) **settes, men leses aldri**. Rester av veien `c043b67f` erstattet — og de får kalibreringen til å *se ut* som den går via georeferansen når den ikke gjør det | kun deklarasjon + setter |

Og to små, konkrete opprydninger som ikke er en plan verdt, men som bør med når filene først røres:
`lasHeader.ts:110-121` bygger et `boundingBox` med **feil byte-offsets** som aldri brukes (`:126-137` bygger
det på nytt riktig), med kommentaren «La meg re-lese korrekt» stående på `:125`. Og debug-`console.log` fra
`2ab0783b` (14. april) står fortsatt i prod-koden (`tegning-3d/page.tsx:165,178,471-479`).

---

## § 6 Anbefalingen: projiserte koordinater som nav, ikke GPS

Alle tre modellene prøver å svare på samme spørsmål — *hvor i verden er dette punktet* — og de bruker tre
ulike mellomformater. **Anbefalingen er ett felles mellomformat, og at det ikke er GPS.**

**Hvorfor ikke GPS:** en breddegrad er ~111 km overalt, en lengdegrad er ~55 km på 60° nord. Grader har
**ulik skala i x og y**, og en similaritetstransformasjon kan ikke uttrykke ulik skala i x og y — det er
presis samme matematiske årsak som ga speilfeilen i søsternotatet. **Å bruke GPS som mellomformat er å
invitere feilen inn på nytt, i hvert ledd.**

**Hvorfor UTM/NTM:** metrisk og plan. Avstander er meter, rotasjon er grader, og en similaritet oppfører seg.
Og tallene finnes allerede i hvert ledd, før noe degraderes:

| Ledd | Har projiserte koordinater alt | Hvor |
|---|---|---|
| DWG-tegning | `extents` + detektert system, **før** de degraderes til to punkter | `dwgKonvertering.ts:970-977` |
| Punktsky | LAS-headerens egne scale + offset | `lasHeader.ts` (leses ikke) |
| IFC | IFCSITE-referansepunkt | `ifcMetadata.ts:172-186` |

🔴 **GPS blir et presentasjonsformat i ytterkantene** — kartfliser, telefonens GPS — ikke utvekslingsformatet
mellom lagene. **Dette er samme konklusjon som søsternotatet:** der er anbefalingen å utlede transformasjonen
fra `extents` framfor å kalibrere, og det *er* en piksel↔UTM-transformasjon. De to notatene peker på samme
nav.

---

## § 7 Rekkefølgen er ikke fri — og 3D er riktig sist

Du spurte indirekte om rekkefølge da du sa «pdf og dwg nå». **Målingen støtter din egen rekkefølge, av tre
grunner som ikke er smakssaker:**

1. 🔴 **3D fester seg til tegningens transformasjon.** Er den speilvendt, fester 3D seg til noe speilvendt.
   Å koordinatfeste 3D før georeferansemetoden er valgt, er å bygge på et fundament som skal rives.
2. 🔴 **Punktsky-veien kan ikke testes i dag.** `CloudCompare` og `PotreeConverter` mangler i begge
   containere ([BACKLOG §296](../claude/BACKLOG.md)). Ingen ny punktsky kan lages → ingen testartefakt →
   ingen målbar fiks.
3. 🟢 **Ingenting forfaller mens man venter.** Punktsky har aldri virket geografisk, så ingen funksjon går
   tapt av å stå i kø. Fella i § 4 er den ene tingen som kan slå til — og den håndteres med en **måling**,
   ikke en ombygging.

**Rekkefølge:**

```
1. Binærene tilbake (pdftoppm + tesseract nå, DWG-beslutning)   ← BACKLOG §296, ikke denne saken
2. Georeferansemetoden valgt og DWG-veien rettet                ← søsternotatet § 7
3. Fella i § 4 målt (hvor mange rader, og hva de bærer)         ← kan gjøres NÅ, koster én SQL
4. UTM-navet + rundturs-testen                                  ← denne saken, trinn 1
5. Punktsky koordinatfestet ELLER bevisst avskrevet              ← denne saken, trinn 2
```

⚠️ **Trinn 3 er unntaket som ikke skal vente.** Det er én lesende SQL, den avgjør om fella er teoretisk eller
reell, og den kan kjøres uten at noe bygges.

---

## § 8 Plan — rangert, med det billigste og mest avgjørende først

### 🟢 Trinn 0 — tre målinger, null kode

| # | Måling | Hvorfor den avgjør noe |
|---|---|---|
| ~~**0a**~~ | 🟢 **UTFØRT 2026-09-23.** Test: 1 rad, men `geo_reference` NULL. Prod: 0 rader | **§ 4 er lukket — ingen forurensede koordinater finnes.** Se § 4 |
| **0b** | Antall rader i `point_clouds`, og hvor mange har `conversion_status = 'done'` | Er svaret 0, er § 3 en ren opprydding. Er det > 0, finnes det data ingen kan tolke |
| **0c** | For hver punktsky som finnes: hva sier `bounding_box`-tallene? Seks- og syvsifret = UTM. Små tall = lokalt | Sier om systemet kan **utledes** fra data vi har, framfor å gjettes |

🔴 **SQL kjøres av Kenneth, mot test, én gang** — leseoperasjoner, men det er hans database.

### 🟡 Trinn 1 — UTM-navet og testen som mangler

Bygges **etter** at georeferansemetoden er valgt. Minste versjon som er verdt noe:

- **Én rundturs-test** som binder `wgs84TilTm` og `tmTilWgs84` (`koordinatBro.test.ts`, som ikke finnes).
  Uten den kan de to serieutviklingene drifte i det stille — og de har gjort det i et halvt år uten at noen
  kunne se det.
- **Én test som binder de to 3D-veiene:** samme punkt gjennom `tegningTil3D` og gjennom `gpsTil3D` skal gi
  samme svar innenfor toleranse. **Det er testen som ville fanget `c043b67f`-splittelsen da den skjedde.**
- Dødt GPS-bein fjernet (`kalibPunktA.tegningGps`, `kalibTegningGpsB`) — ellers fortsetter koden å lyve om
  hvilken vei den går.

### 🔴 Trinn 2 — punktsky: RETTET 2026-09-24, formålet snur anbefalingen

> 🔴 **Denne seksjonen anbefalte opprinnelig å AVSKRIVE visningsveien. Det var feil, og feilen var at jeg
> vurderte punktskyen på om vieweren var nåbar — ikke på hva den er til.**
>
> **Kenneth 2026-09-24, ordrett:** *«en punktsky lastes opp, denne overflateberegnes → 2 uker senere lastes en
> ny punktsky opp → begge sammenlignes → sammenligning av overflater kan gjøres → rød betyr at masser er
> fjernet/gravd bort, blå overflate betyr fyll/tilfylt. beregning av volum kan utføres. Dette er viktig for å
> dokumentere uttak og transport av masser.»*

**Punktsky er ikke en visningsfunksjon. Den er et måleinstrument for masseregnskap.** Det endrer to ting: hva
som mangler, og hvor alvorlig § 3 er.

#### 🟢 Funksjonen finnes alt — og mer av den enn notatet påstod

**`apps/web/src/lib/kutt-fyll.ts` (252 linjer) er koblet og i bruk**, i motsetning til
`punktsky-triangulering.ts` som notatet målte til null kallere. De er to ulike filer, og førsteversjonen
blandet dem.

| Ledd | Finnes | Hvor |
|---|---|---|
| Fane i UI | `"kutt-fyll"` | `3d-visning/typer.ts:5`, `page.tsx:54,90-91` |
| Komponent | `FaneKuttFyll` | `3d-visning/page.tsx:451` |
| Beregning | `beregnKuttFyll(topp, bunn, celleStr)` | `kutt-fyll.ts:34`, kalt `page.tsx:502-503` |
| Volum | `kuttVolum` / `fyllVolum` / `netto` i m³ | `kutt-fyll.ts:13-15` |
| Fargelagt differanse | `genererDiffMesh` | `kutt-fyll.ts:185` |

🔴 **FUNN — fargene er invertert mot Kenneths konvensjon:**

| | Koden | Kenneth |
|---|---|---|
| Masse **fjernet** (kutt, ΔZ < 0) | 🔵 **blå** (`kutt-fyll.ts:32,208`) | 🔴 **rød** |
| Masse **tilført** (fyll, ΔZ > 0) | 🔴 **rød** | 🔵 **blå** |

**Volumtallene er riktig merket** — `kuttVolum` = «terreng fjernet», `fyllVolum` = «masse tilført»
(`:13-14`). **Det er bare fargeleggingen som står motsatt.** Begge konvensjoner finnes i bransjen, så dette
er ikke en regnefeil — det er et valg som må stemme med den som leser kartet i felt. **Kenneth-valg V1b.**

⚠️ **En invertert fargelegende på et volumdokument er den typen feil som overlever, fordi begge varianter ser
plausible ut.** Tallene stemmer uansett; det er tolkningen som snus.

#### 🔴 Og § 3 er dermed ikke en opprydding — den er en forutsetning

**To punktskyer kan bare differanseberegnes hvis de ligger i SAMME ramme.** Det er ikke georeferering mot en
tegning det står på — det er at skann A og skann B har samme origo.

| Hull (§ 3) | Konsekvens for masseregnskapet |
|---|---|
| 🔴 `-GLOBAL_SHIFT` sendes ikke til CloudCompare (`punktskyKonvertering.ts:55-60`) | **Velger CloudCompare shift selv, per fil, kan A og B få ULIKE origo.** Et rent Z-avvik gir da et plausibelt volum som er feil. ⚠️ **Må måles** — at flagget mangler er målt, at CloudCompare auto-shifter i `-SILENT`-modus er **ikke** målt |
| LAS scale+offset leses aldri (`lasHeader.ts:77-205`) | Ingen kan verifisere at to skann har samme referanse |
| `PointCloud.coordinateSystem` tom (`schema.prisma:944`) | Ingenting registrerer hvilket system en sky er i → ingenting kan avvise en sammenligning av to uforenlige skann |

🔴 **Rangert, med formålet lagt til grunn:**

**1. Mål shift-atferden først.** Konverter samme fil to ganger og to ulike filer fra samme sted; sammenlign
origo. **Det er den ene målingen som avgjør om eksisterende volumtall kan stoles på.** Krever binærene tilbake.

**2. Skriv `coordinateSystem` og les LAS-offset.** «Stille tomhet»-kravet, og her er det ikke formelt — det er
det eneste som kan fange en sammenligning av to skann i ulike systemer.

**3. Fargekonvensjonen rettes** når Kenneth har bekreftet retningen. Enlinjefiks i `genererDiffMesh`.

**4. Georeferering mot tegning er SIST og valgfritt.** Masseregnskapet trenger at A og B er i samme ramme —
ikke at rammen er knyttet til en tegning. **Det er en annen, mindre presserende funksjon.**

### 🟡 Trinn 3 — `gpsOverride.transform`: primærvei eller ikke

**Dette er en Kenneth-beslutning, ikke en teknisk.** Så lenge `transform` er primærvei, er `georeferanse.ts`
avkoblet fra det brukeren ser i `tegning-3d`, og **hver framtidig georeferanse-fiks vil igjen «ikke virke» på
kalibrerte modeller** — nøyaktig det du opplevde. Men `c043b67f` ble skrevet fordi GPS-veien ga drift, og den
driften var ekte.

Anbefaling: **behold `transform`, men la den bli utledet av navet framfor å konkurrere med det.** En klikket
kalibrering skal fortsatt kunne overstyre — det er riktig at et menneske kan si «nei, der». Forskjellen er at
den lagres som en korreksjon *på* transformasjonen, ikke som en egen vei *rundt* den.

---

## § 9 Kenneth-valg som venter

| # | Valg | Design anbefaler |
|---|---|---|
| ~~**V1**~~ | 🟢 **BESVART 2026-09-24: punktsky skal leve.** Formålet er masseregnskap — overflatesammenligning + volum for å dokumentere uttak og transport | Anbefalingen om å avskrive er **trukket**. Se § 8 trinn 2 |
| 🔴 **V1b** | **Fargekonvensjon:** koden gir rød = fyll, blå = kutt. Kenneth sier rød = fjernet, blå = tilfylt | **Kenneths konvensjon vinner** — han leser kartet i felt. Enlinjefiks, men bekreft retningen først |
| 🔴 **V1c** | Skal shift-atferden måles før eksisterende volumtall brukes som dokumentasjon? | **Ja.** Uten den vet ingen om to skann lå i samme ramme |
| **V2** | Skal `gpsOverride.transform` fortsatt være primærvei? | **Behold, men gjør den til korreksjon på navet, ikke omvei rundt det** |
| **V3** | Skal Trinn 0-målingene kjøres nå, før alt annet? | **Ja for 0a** — én lesende SQL som avgjør om § 4 er reell |
| **V4** | Er UTM/NTM som felles nav akseptert som retning? | **Ja** — det er samme nav søsternotatet peker på |

---

## § 10 Hva dette notatet IKKE påstår

- **Ikke at punktsky «virket før og ble ødelagt».** Det har aldri vært geografisk stedfestet. Det Kenneth
  kjørte på Kenspill var visning, ikke koordinatfesting.
- **Ikke at `c043b67f` var feil.** Den løste en reell drift. Feilen var at splittelsen aldri ble skrevet ned
  noe sted — og at ingen test bandt de to veiene sammen etterpå.
- 🟢 **Ikke at fella i § 4 har rammet noen — det er nå målt, og svaret er nei.** Seksjonen sto opprinnelig
  som «en felle som venter». Måling 0a viste at den ene kalibrerte tegningen mangler `geo_reference`, som er
  forutsetningen, og at prod har null kalibrerte tegninger. **Mistanken var riktig utledet av koden og feil om
  dataene.** Den står igjen som § 4, omskrevet, fordi mekanismen fortsatt finnes i koden.
