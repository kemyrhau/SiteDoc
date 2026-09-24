---
status: 🟢 ORDRE — klar til utførelse
til: kode-agent (worktree og branch bestemmes av cowork)
fra: design
dato: 2026-09-24
grunnlag: ordre-punktsky-serveroverflate-design-2026-09-24.md (steg 1, levert `5b15c84e`) + BACKLOG «Overflate fra LAS er ARITMETISK bevist»
kenneth_vedtak: 2026-09-24 — «ja, skriv LAZ-ordren»
---

# Ordre: LAZ-støtte i punktsky-lesingen

## [1] HVA SOM ER GJORT — og hvorfor denne ordren finnes

**Steg 1 (`feat/punktsky-overflate` @ `5b15c84e`) leser LAS og avviser LAZ med vilje.** Det var riktig da
ordren ble skrevet. **En måling 2026-09-24 gjorde det galt.**

**Kenneth la ut en ekte fil fra Laserinnsyn** — `3D eksempelfiler/Rallkattlia test 4  bu/4882/data/`:

| Fil | Størrelse |
|---|---|
| `33-1-516-337-63.laz` | 21 MB |
| `33-1-516-337-64.laz` | 9,2 MB |

**Datasett:** NDH Lavangen 2 pkt 2020 (Kartverkets nasjonale høydemodell).
**Koordinatsystem, målt i `metadata/…_Klippefil.prj`:** `ETRS_1989_UTM_Zone_33N`, sentralmeridian 15,0,
false easting 500 000, scale 0,9996 → **EPSG:25833**, som `koordinatKonvertering.ts` støtter som `utm33`.

🔴 **Funnet: LAZ er ikke et sjeldent format i Norge — det er normalen.** Laserinnsyn leverer LAZ.
**En pipeline som bare tar LAS avviser den vanligste norske leveransen.**

🔴 **Og ingen kan lese fila i dag.** Målt på Kenneths maskin: `laszip`, `laszip-cli`, `las2las`, `pdal`,
`lasinfo`, `CloudCompare` — **alle mangler**. Python `laspy`/`pylas`/`pdal` — **mangler**. CloudCompare mangler
også i begge server-containere ([BACKLOG § FIRE FUNKSJONER TAPT](../claude/BACKLOG.md)).
⚠️ **Akseptkriteriet i BACKLOG kan derfor ikke kjøres i det hele tatt før denne ordren er levert.**

**BACKLOG-grep (steg 0):** `laz` gir kun treff på ordet «lazy» i urelaterte filer. **Ingen eksisterende post.**
**Denne ordren er en forutsetning for posten «Overflate fra LAS er ARITMETISK bevist …», ikke en erstatning.**

## [2] HVA SOM GJENSTÅR

Få `.laz` inn i **samme** `DekodetPunkt`-strøm som `.las`, uten å røre resten av kjeden.

🟢 **To målinger som gjør dette lite:**

1. **LAZ-headeren er LAS-kompatibel.** En LAZ-fil starter med `LASF` og har standard header; komprimeringen
   ligger i **punktpostene**, beskrevet av en laszip-VLR (user ID `laszip encoded`, record ID 22204).
   **`lesLasPunktHeader` (`lasPunkter.ts:66`) skal virke uendret.**
2. **`lasHeader.ts:96` gjør `readUInt8(104) & 0x3f`** — masken **stripper komprimeringsbitene** (bit 7 settes
   av laszip-skrivere). **Header-leseren er altså allerede LAZ-tolerant.** ⚠️ **Verifiser det, ikke stol på
   det — det ser ut som en heldig bivirkning, ikke et valg.**

## [3] OPPGAVE

### 🔴 A. Dekoder inn, som et nytt lag — ikke som en gren i punkt-løkka

- **Ny fil** (f.eks. `apps/api/src/services/lazDekoder.ts`). **`lasPunkter.ts` beholder sin nåværende form
  for ukomprimerte punktposter.**
- 🔴 **Sømmen: dekoderen skal levere samme `DekodetPunkt`-strøm som LAS-veien.** `bakkeOverflate` og
  `triangulering` skal **ikke** vite om komprimering. **Rører du dem, har du valgt feil søm.**
- **Pakke:** design foreslår **`laz-perf`** (WASM-bygg av LASzip, Node-kompatibelt).
  🔴 **Meld pakke + versjon + at den er ren dekoder FØR install** — Kenneths spør-først-regel.
  ⚠️ **Finner du et bedre alternativ, meld det med begrunnelse framfor å følge forslaget blindt.** Krav:
  vedlikeholdt, ingen native byggesteg i Docker-imaget, og **ingen nettverkskall ved kjøring.**

### 🔴 B. Deteksjon på INNHOLD, ikke på filnavn

🔴 **Dette er et fast prinsipp i dette repoet nå, ikke en preferanse.**
`detekterKoordinatSystem(filnavn, …)` gjetter fra filnavnet, og
[georeferanse-notatet](designnotat-georeferanse-speiling-design-2026-09-23.md) fører det som en målt svakhet.
**Ikke lag en ny av samme klasse.**

**Detekter komprimering fra ett av to innholdssignal:**
1. **laszip-VLR til stede** (user ID `laszip encoded`, record ID 22204) — primær.
2. **Bit 7 satt i punktformat-byten** (offset 104) — sekundær.

**Filendelsen kan brukes som hint i feilmeldinger, aldri som beslutning.** ⚠️ **En LAZ-fil døpt `.las` skal
virke. En LAS-fil døpt `.laz` skal virke.**

### 🔴 C. Snevre avvisningen, ikke fjern den

`apps/api/src/routes/overflate.ts:93` sier i dag:

> «Kun LAS-punktskyer kan overflateberegnes i steg 1 (fikk .X). LAZ/E57/PLY støttes ikke ennå.»

**Skal bli: LAS og LAZ godtas. E57 og PLY avvises fortsatt, med samme tydelighet.**
⚠️ **Ikke bytt til en generisk «ugyldig fil»** — meldingen skal fortsatt navngi hva som mangler.

### 🔴 D. Tester — to lag, og det andre er der fella ligger

**D1 — permanent, kjører alltid:** ekte data inn i repoet **som liten LAS-fixture**. Dekod én av Kenneths
LAZ-filer én gang, ta N punkter (noen tusen), og skriv en LAS-fixture med **ekte header-verdier**
(scale/offset/punktformat fra originalen). **Det gir varig dekning av virkelige formatverdier — presis det den
syntetiske fixturen fra steg 1 ikke kan.**

🔴 **Assertér på UTM-størrelsesorden:** koordinatene skal ligge rundt **~500 000 østing / ~7 700 000 nording**.
⚠️ **Det er nettopp der float32 ville gitt ~0,5 m** — en fixture med små tall beviser ikke det som må bevises.

**D2 — LAZ-dekodingen selv.** 🔴 **Her er problemet ærlig:** de ekte filene er 21 MB og 9,2 MB, altså **for
store for repoet**, og de ligger i `3D eksempelfiler/` som er **gitignorert** (`.gitignore:86`).

**Rangert:**
1. 🟢 **Kan du produsere en liten LAZ** (encoder tilgjengelig i valgt pakke, eller et minimalt
   håndkonstruert tilfelle): **commit den.** Da er dekodingen permanent dekket. **Førstevalg.**
2. 🔴 **Kan du ikke:** da skal LAZ-veien **merkes provisorisk med samme mekanisme kontrollplan bygde for
   `RAMME_LAS_PROVISORISK`** — en konstant i en `PROVISORISKE_*`-liste, med **en test som FEILER hvis noen
   fjerner merket mens ingen committet LAZ-fixture finnes.** ⚠️ **En test som SKIPPER når en fil mangler, er
   stille tomhet. Forbudt.**

**Og i begge tilfeller:** kjør den ekte fila én gang og **skriv ned fasiten** — punktantall, bbox,
klassehistogram — i rapporten. **Uten nedskrevne tall kan ingen oppdage en regresjon senere.**

### 🟡 E. Valgfritt — les klassehistogrammet høyt i rapporten

NDH er ASPRS-klassifisert og **Kenneth sier fila er ufiltrert**. **Si i rapporten hvor mange punkter som er
klasse 2 (bakke) mot totalen.** Det er ikke et krav til koden — men det er det som viser at
`bakkeMetode="klasse2"` har noe å filtrere på, og **det svarer på (b) i BACKLOG-posten.**

## [4] UFRAVIKELIG

- **Arbeidstre + branch:** cowork bestemmer.
- **Filer ordren eier:** ny `lazDekoder.ts` + test · `apps/api/src/services/lasPunkter.ts` (kun sømmen) ·
  `apps/api/src/routes/overflate.ts` (kun meldingen på `:93`) · `apps/api/package.json` · fixtures.
  🔴 **`bakkeOverflate.ts` og `triangulering.ts` skal IKKE røres.** Gjør du det, er sømmen valgt feil.
- 🔴 **Ingen ny i18n-nøkkel med mindre du faktisk trenger en** — `nb.json`/`en.json` er høytrafikk, og to
  andre saker står i kø der.
- 🔴 **Din ordre er input, ikke fasit — mål premisset selv.** Linjenumre er målt på `5b15c84e`.
- 🔴 **Sjekk treets alder før du melder et fravær.**
- **Kenneths filer ligger utenfor git.** Les dem for engangsmålingen; **kopier aldri en 21 MB-fil inn i
  repoet.**
- **Gate:** `pnpm test` fra ROT (`--force`) + `pnpm --filter @sitedoc/web build` kaldt +
  `pnpm --filter @sitedoc/mobile typecheck`. **`apps/api` sin testtelling skal STIGE.**

## [5] FORVENTET OUTPUT

1. **Pakken meldt før install**, med versjon og at den er ren dekoder uten native byggesteg.
2. **At `lesLasPunktHeader` virket uendret på LAZ-headeren** — eller hva som måtte til. **`& 0x3f`-masken:
   bekreftet eller motbevist.**
3. **Deteksjon på innhold:** vis at en LAZ døpt `.las` virker, og en LAS døpt `.laz` virker.
4. **D1-fixturen:** at koordinatene ligger i UTM33-størrelsesorden, med tallene.
5. **D2:** committet LAZ-fixture, **eller** provisorisk-merket + testen som feiler ved fjerning. **Si hvilken.**
6. **Fasiten fra den ekte fila:** punktantall, bbox, klassehistogram.
7. **Gate-tall som sier hva som kjørte.**

## [6] OPPRYDDING

Cowork sletter branchen etter merge. Agenten gjør ingenting.

---

## Akseptkriterier (designgate)

| # | Krav | Bevis |
|---|---|---|
| 1 | `.laz` gir samme `DekodetPunkt`-strøm som `.las` | Test |
| 2 | Deteksjon på **innhold**, ikke filnavn — begge retninger | Pkt 3 over |
| 3 | `bakkeOverflate` og `triangulering` **urørt** | `git diff` |
| 4 | Permanent fixture med **ekte** header-verdier og UTM-størrelsesorden | Test |
| 5 | LAZ-dekodingen er permanent dekket **eller** provisorisk-merket med test | Pkt 5 over |
| 6 | E57/PLY avvises fortsatt med navngitt årsak | `overflate.ts` |
| 7 | Fasiten fra den ekte fila skrevet ned | Rapport |

🔴 **Ikke i denne ordren:** E57 · PLY · volum på server · 0,1/0,2 m rutenett · `-GLOBAL_SHIFT`.

⚠️ **Og en forventning som IKKE er kodens ansvar:** NDH Lavangen er **2 pkt/m²** (~0,7 m punktavstand).
**Et 15 cm rutenett gir ~0,045 punkter pr. celle — over 95 % tomme celler.** Denne fila beviser **format og
klassifisering**, ikke 10–20 cm. **Kjør engangsmålingen på 1 m målavstand.** 10–20 cm hører til en
drone-LiDAR over en anleggstomt, og det er tettheten som avgjør — ikke rutenettet.
