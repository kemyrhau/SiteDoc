---
status: 🟢 ORDRE — steg 1 klar til utførelse. Steg 2–3 skissert, ikke bestilt
til: kode-agent (worktree og branch bestemmes av cowork)
fra: design
dato: 2026-09-24
grunnlag: designnotat-3d-koordinatfesting-design-2026-09-23.md § 8 trinn 2
kenneth_vedtak: 2026-09-24 — «server, og skriv ordren». Formål: masseregnskap, 10–20 cm oppløsning
---

# Ordre: server-side overflate fra punktsky — steg 1

## [1] HVA SOM ER GJORT — og hva målingen avdekket

**Formålet (Kenneth 2026-09-24):** *«en punktsky lastes opp, denne overflateberegnes → 2 uker senere lastes en
ny punktsky opp → begge sammenlignes … beregning av volum kan utføres. Dette er viktig for å dokumentere uttak
og transport av masser.»* Ønsket oppløsning: **10–20 cm.**

**Alt måles 2026-09-24 på `origin/develop` `4d9fc788`.**

| Ledd | Tilstand |
|---|---|
| Punktsky inn | E57/PLY → LAS (CloudCompare) → Potree-oktre. `punktskyKonvertering.ts` |
| Kutt/fyll + volum | **Finnes og virker** — `kutt-fyll.ts:34`, volum i m³ `:13-15` |
| Overflate inn til kutt/fyll | `TINData` fra **`landxml-parser.ts`** — manuelt opplastet LandXML |
| 🔴 **Broen punktsky → TIN** | `punktsky-triangulering.ts` — **skrevet, null kallere** |
| 🔴 **Lagring av overflater** | **Finnes ikke.** `useState<OverflateData[]>([])`, ingen tRPC-rute, ingen tabell |

🔴 **De to sporene møtes aldri.** Kutt/fyll bruker ikke punktskyer i dag — den krever LandXML fra ekstern
programvare. Og analysen lever i React-state: **last siden på nytt, og den er borte.**

⚠️ **For et volumdokument er det den alvorligste mangelen** — ikke oppløsningen. Et tall som ikke kan hentes
fram igjen er ikke dokumentasjon.

### 🟢 Og det gode funnet: steg 1 er IKKE blokkert av de manglende binærene

- **CloudCompare kalles bare for `.e57`/`.ply`** (`punktskyKonvertering.ts:150`). **En LAS/LAZ-opplasting går
  rett forbi den.**
- **`lasHeader.ts` går alt gjennom punktarrayet** — `offsetTilPunkter` (`:95`), `punktStørrelse` (`:144`),
  `posisjon = offsetTilPunkter + punktIdx * faktiskPunktStørrelse` (`:156`), klassifisering pr. punkt (`:145`).
  **Å lese X/Y/Z er en utvidelse av kode som virker, ikke ny mekanikk.**
- **Originalfila beholdes:** `PointCloud.fileUrl` (`schema.prisma:938`).

🔴 **Steg 1 kan derfor bygges OG testes i dag med en LAS-fil.** `PotreeConverter` (oktreet) er en annen vei og
skal ikke være en avhengighet for overflaten.

**🔴 BACKLOG-grep (steg 0):** null treff på `kutt.?fyll` / `volumbereg` / `masseregn` / `masseuttak` som sak.
**Ordren lukker ingen post.** Notatets § 8 trinn 2 er grunnlaget.

## [2] HVA SOM GJENSTÅR

**Steg 1 (denne ordren):** les punkter fra LAS på server, lag en bakkeoverflate, **lagre den**, og la kutt/fyll
velge en lagret overflate.

**Steg 2 (ikke bestilt):** volumberegning på server + lagret resultat som dokument, rutenett 0,1/0,2 m.
**Steg 3 (ikke bestilt):** `-GLOBAL_SHIFT`-målingen og `coordinateSystem` — krever binærene tilbake (V1c).

## [3] OPPGAVE — steg 1

### 🔴 A. Les X/Y/Z fra LAS — og les skalaen som hører til

Utvid `apps/api/src/services/lasHeader.ts` (eller ny søsterfil, agentens valg — begrunn det).

🔴 **LAS lagrer X/Y/Z som `int32` som MÅ multipliseres med scale og adderes med offset.** De feltene leses
ikke i dag:

| Felt | Header-byte |
|---|---|
| X/Y/Z scale factor | 131–155 |
| X/Y/Z offset | 155–179 |

⚠️ **Hopper du over dem, blir koordinatene rå heltall og volumet meningsløst.** Dette er hele grunnen til at
punktet står først.

**Bare LAS i steg 1.** LAZ er komprimert og krever en dekoder — **ikke i denne ordren.** Er fila `.laz`, feil
tydelig: «LAZ støttes ikke ennå — last opp LAS».

### 🔴 B. Bakkeoverflate, ikke «hvert n-te punkt»

🔴 **Dette er det punktet som avgjør om volumtallet kan forsvares.**

Den eksisterende `subsample` (`punktsky-triangulering.ts:17`) tar **hvert n-te punkt**. På et terrengskann
beholder den vegetasjon, gjerder og gravemaskiner. **En gravemaskin midt i feltet blir da til fyllmasse.**

**Krav — desimér til et rutenett, ikke til et antall:**

1. Rutenett i XY med **målavstand** som parameter (default **0,15 m**, Kenneths 10–20 cm).
2. **Er skyen klassifisert** (`lasInfo.harKlassifisering`, finnes alt `:23`): bruk **kun klasse 2 «Bakke»**.
3. **Ellers:** ta **laveste Z** pr. rute. En grov, dokumentert bakketilnærming.
4. **Skriv i retur-metadata hvilken av de to som ble brukt.** Leseren skal kunne se om overflaten er
   klassifisert bakke eller min-Z — **de er ikke like mye verdt som dokumentasjon.**

⚠️ **Ikke bygg et filter som gjetter.** Klassifisering eller min-Z, og det skal stå hvilken.

### 🔴 C. Trianguler på server

Flytt `triangulerPunkter` (`apps/web/src/lib/punktsky-triangulering.ts`) til api.

- **`delaunator` er i dag kun i `apps/web`** (`package.json:33`). Den må legges til `apps/api`.
  ⚠️ **CLAUDE.md krever at Kenneth spør-før-installer — meld pakke + versjon FØR du legger den inn.**
  *(Design vurderer den som lav risiko: liten, ingen avhengigheter, samme versjon som web alt bruker.)*
- **Punkttaket styres av målavstanden, ikke av `maksAntall = 50_000`.** Det taket ga ~45 cm punktavstand på
  100 × 100 m og gjorde 10 cm umulig. **Behold en øvre grense som vern, men sett den høyt nok til at
  målavstanden er det som bestemmer.**
- **Web-versjonen slettes IKKE i denne ordren.** Den har null kallere; la den ligge til steg 2 har flyttet
  også volumberegningen, så vi ikke river to ting samtidig.

### 🔴 D. Lagre overflaten — schema-endring, og den krever Kenneths ok

🔴 **STOPP: dette punktet skal IKKE kjøres før Kenneth har sagt ja til migreringen eksplisitt.** Meld
skjemaforslaget, vent på svar, bygg deretter. (CLAUDE.md § «Spør alltid før du … endrer database-skjema».)

**Foreslått modell — ny tabell `Overflate`:**

| Felt | Type | Merknad |
|---|---|---|
| `id` | uuid | |
| `projectId` | String | 🔴 **Prosjektisolering — alle spørringer filtrerer på den** |
| `byggeplassId` | String? | `onDelete: SetNull`, som `PointCloud` |
| `navn` | String | |
| `kilde` | String | `"punktsky"` \| `"landxml"` — **to kilder, én tabell** |
| `pointCloudId` | String? | Satt når `kilde = "punktsky"`. `onDelete: SetNull` |
| `filUrl` | String | TIN-en på disk. **Ikke i Postgres** — en 15 cm TIN blir store filer |
| `malavstandM` | Float | Hva den ble desimert til |
| `bakkeMetode` | String | `"klasse2"` \| `"minZ"` — **B pkt 4** |
| `punktAntall` | Int | Etter desimering |
| `boundingBox` | Json | |
| `createdAt` / `updatedAt` | DateTime | |

🔴 **«Stille tomhet er forbudt» (CLAUDE.md) gjelder:** tabellen er ny og tom, så **(a) backfill er n/a — skriv
det i rapporten**. **(b) DB-garanti:** unik indeks som hindrer to identiske overflater av samme punktsky med
samme målavstand — `@@unique([pointCloudId, malavstandM])` der `pointCloudId` ikke er null.
⚠️ **Postgres regner NULL som distinkt — bruk partial unique index**, samme felle som `omradeId` i steg 2b.
**(c) En test som FEILER** når `bakkeMetode` eller `malavstandM` er tom der den skal ha verdi.

**Filformat på disk — enkelt og dokumentert:** binær, `Float32` vertekser + `Uint32` trekantindekser, med en
liten header (antall vertekser, antall trekanter, bbox). **Ingen JSON** — en 15 cm TIN i JSON er titalls MB
tekst. **Legg layouten i en kommentar i koden**, ikke bare i denne ordren.
🟡 **LandXML-eksport er IKKE i denne ordren** — god idé senere, egen sak.

### 🔴 E. Koble kutt/fyll til lagrede overflater

`FaneKuttFyll` (`3d-visning/page.tsx:451`) velger i dag fra `useState`-lista.

- Legg til at lagrede overflater kan velges — hent via ny tRPC-rute, filtrert på `projectId`.
- **LandXML-opplasting beholdes** som kilde. Den skal nå **lagres** med `kilde = "landxml"`, så den ikke lenger
  forsvinner ved reload. 🟢 **Det er en forbedring Kenneth får gratis av denne ordren.**
- **`beregnKuttFyll` er urørt i steg 1.** Den kjører fortsatt i nettleseren, på 0,5–5 m rutenett.
  **Rutenettvalget utvides IKKE til 0,1/0,2 nå** — det hører i steg 2, når beregningen er på server.
  ⚠️ **Å tilby 10 cm i en nettleserberegning ville love en presisjon flaten ikke tåler.**

## [4] UFRAVIKELIG

- **Arbeidstre + branch:** cowork bestemmer. Design rører ikke git-koreografi.
- **Filer ordren eier:** `apps/api/src/services/lasHeader.ts` (+ evt. ny søsterfil) ·
  ny api-tjeneste for triangulering · `apps/api/src/routes/punktsky.ts` eller ny `overflate.ts` ·
  `packages/db/prisma/schema.prisma` + **én** migrering · `3d-visning/page.tsx` (kun `FaneKuttFyll` +
  overflate-fanen) · `apps/api/package.json` (delaunator) · `packages/shared/src/i18n/*.json`.
- ⚠️ **`nb.json`/`en.json` er høytrafikk — meld til cowork hvis de er tatt.**
- 🔴 **Din ordre er input, ikke fasit — mål premisset selv.** Linjenumrene er målt på `4832ef0c`-etterfølgeren
  `4d9fc788`. **Stemmer de ikke, er treet ditt en annen alder.**
- 🔴 **Sjekk treets alder før du melder et fravær.**
- 🔴 **Ingen migrering kjøres mot Kenneths lokale DB.** SQL mot test kjøres **én gang, av Kenneth**.
- **To-stegs migrasjons-policy:** ny tabell er tilføyelse, ingen DROP. Ingen kolonner slettes.
- **Kald web-bygg** siden `apps/web` røres:
  `rm -f apps/web/tsconfig.tsbuildinfo apps/web/.next/cache/.tsbuildinfo && rm -rf apps/web/.next`
- **Forsteg før gaten:** `pnpm install` + `prisma generate` for alle fire db-pakker.
- **Gate:** `pnpm test` fra ROT (`--force`) + `pnpm --filter @sitedoc/web build` kaldt +
  `pnpm --filter @sitedoc/mobile typecheck`.

## [5] FORVENTET OUTPUT

1. **Skjemaforslaget MELDT og godkjent før migreringen ble skrevet** — si eksplisitt at du ventet.
2. **`delaunator` meldt før install**, med versjon.
3. **Scale/offset-lesingen:** vis på en ekte LAS at koordinatene blir metriske, ikke rå heltall.
   **Negativ kontroll: hopp over scale/offset og vis at tallene blir åpenbart gale.**
4. **Bakkemetoden:** hvilken vei som ble brukt på testfila, og at `bakkeMetode` bærer den.
5. **Partial unique index:** vis at to overflater med samme `pointCloudId` + `malavstandM` avvises, **og** at
   to med `pointCloudId = NULL` ikke kolliderer.
6. **Testen som feiler ved tom `bakkeMetode`/`malavstandM`.** Rød-først.
7. **Gate-tall som sier hva som kjørte:** db · api (før → etter) · pdf · shared · web · mobil · X/Y.
8. **At LandXML-overflater nå overlever reload.**

⚠️ **Skjermbilde bestilles IKKE av deg** — visuell godkjenning går via en verifiserings-agent cowork utpeker.

## [6] OPPRYDDING

Cowork sletter branchen etter merge. Agenten gjør ingenting.

---

## Akseptkriterier (designgate)

| # | Krav | Bevis |
|---|---|---|
| 1 | X/Y/Z leses med scale **og** offset | Negativ kontroll |
| 2 | Bakkeoverflate: klasse 2 hvis den finnes, ellers min-Z pr. rute — **aldri hvert n-te punkt** | Kode + `bakkeMetode` |
| 3 | Målavstand er parameter, default 0,15 m, og styrer desimeringen | Kode + lagret verdi |
| 4 | Overflaten lagres og overlever reload — **også LandXML** | Demo |
| 5 | Partial unique index virker i begge retninger | Pkt 5 over |
| 6 | Test som feiler ved tomt identitetsfelt | Rød-først |
| 7 | Ingen avhengighet til `PotreeConverter` eller `CloudCompare` for LAS-veien | Kjørt uten dem |
| 8 | `beregnKuttFyll` og rutenettvalget urørt | `git diff` |

🔴 **Ikke i steg 1:** LAZ · volum på server · 0,1/0,2 m rutenett · `-GLOBAL_SHIFT` · `coordinateSystem` ·
LandXML-eksport · sletting av web-trianguleringen.
