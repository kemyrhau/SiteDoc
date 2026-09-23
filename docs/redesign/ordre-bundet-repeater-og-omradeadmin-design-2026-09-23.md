# Ordre: bundet repeater — og område-administrasjonen den hviler på

**Til:** cowork fordeler til app-sporet · **Fra:** design · **Dato:** 2026-09-23
**Branch-forslag:** `feat/omradeadmin` (steg 1+2) og `feat/bundet-repeater` (steg 3) fra `origin/develop`.
**Gatet av Kenneth 2026-09-23:** «A. Bundet repeater først» og «ja, skriv ordren med alle tre stegene».
**Forutsetning for:** `BEF1` og `BEF2` i
`ordre-byggeleder-befaringsrapport-design-2026-09-22.md`. **Malene kan ikke bygges som beskrevet før steg 3
finnes** — mal-Opus er varslet.

---

## 1. Hvorfor — Kenneths eget funn

Kenneth 2026-09-23, om repeateren i en sjekkliste:

> «repeateren er et fantastisk verktøy → spesielt ved registrering av HMS hendelser og sluttbefaringer på
> mindre prosjekter med få eller ingen UE. … man får en ustabil struktur, man setter trasenavn tilfeldig fra
> dag til dag og data blir umulig å nyttiggjøre seg etterpå → man kan ikke forhåndsdefinere flere navn i en
> repeater»

**Han beskriver to ulike jobber for samme verktøy, og bare én av dem trenger fritekst:**

| Modus | Radens identitet | Riktig for |
|---|---|---|
| **Fri rad** — finnes i dag | skapes underveis, antallet er ukjent | HMS-hendelser, sluttbefaring |
| **Bundet rad** — mangler | **kommer fra en forhåndsdefinert liste** | traséer, soner, etasjer |

**Målet, med Kenneths eksempel:** Austadvegen · Grønnlivegen · Røstbakken · Hagavegen står i listen fra før.
Byggelederen trykker: *Austadvegen → ingen arbeid pågår* (barna kollapser, ingen oppgave opprettes) ·
*Grønnlivegen → arbeid pågår* (barna utledes).

🔴 **Og løsningen ligger ikke i repeateren — den ligger i at listen eies på prosjektnivå.** Defineres navnene
én gang ved prosjektoppsett, gjenbruker hver befaring de samme, og tallene kan sammenlignes over hele
prosjektet. Skrives de pr. befaring, drifter de uansett hvor god widgeten er.

## 2. Målingen — hva som finnes, og det ene som er farlig

Design har lest koden 2026-09-23. **Registeret finnes nesten ferdig; det er UI og én vakt som mangler.**

| Del | Status |
|---|---|
| `Omrade`-tabellen (`schema.prisma:1021`) | **Finnes:** `projectId`, `byggeplassId`, `tegningId`, `navn`, `type`, `polygon`, `farge`, `sortering` |
| `omrade.hentForProsjekt` / `hentForByggeplass` / `hentForTegning` | **Finnes** |
| `omrade.opprett` | **Finnes**, kalles fra `tegninger/page.tsx:235` (polygon på tegning) og `kontrollplan/OpprettPunktDialog.tsx:77` (inline) |
| `omrade.oppdater` · `omrade.slett` | 🔴 **Finnes i API-et, kalles INGEN steder** i web eller mobil |
| `repeater` som containertype | **Finnes** (`packages/shared/src/types/index.ts:258`, `:811`) — men `defaultConfig: {}`, **radene legges til av brukeren** |

🔴 **Funnet som endrer steg 1 fra «koble opp» til «koble opp MED VAKT»:**

**`omrade.slett` (`omrade.ts:122`) er en naken `prisma.omrade.delete`** — ingen opptelling, ingen advarsel.
Og relasjonen fra kontrollplan er **`onDelete: SetNull`** (`schema.prisma:2472`).

**Følgen, og den er verre enn en feilmelding:** sletter noen et område som er i bruk, nullstilles `omradeId`
på **alle** punktene som brukte det. De blir da liggende med samme mal og uten område —
og **`@@unique([kontrollplanId, omradeId, sjekklisteMalId])`** (`schema.prisma:2483`) **fanger det ikke**,
fordi Postgres regner NULL som distinkt. **Resultatet er stille duplikater i kontrollplanen og en plan som
har mistet inndelingen sin, uten at noe feilet.**

**Det er «stille tomhet er forbudt» (CLAUDE.md) i praksis: en skrivevei som finnes på serveren, ikke kan nås
fra UI, og som ville gjort skade første gang den ble nådd.**

---

## Steg 1 — Område-administrasjon i UI (kan merges alene)

**Hvor:** seksjon under `oppsett/byggeplasser/page.tsx`, som alt har redigering og sletting av byggeplass.
Områder hører under byggeplassen. **Ingen ny side, ingen ny navigasjon.**

**Hva:**

1. **Liste** pr. byggeplass: navn, type, farge, og **antall bruk** — hvor mange kontrollplanpunkter og
   rapportobjekter som peker på området.
2. **Opprett** — navn + type. Bruker `omrade.opprett`, som finnes.
3. **Omdøp** — bruker `omrade.oppdater`, som finnes og er ubrukt. **Dette er det viktigste enkeltpunktet i
   hele ordren:** uten omdøping blir en skrivefeil i «Austadvegen» permanent, og da er den stabile identiteten
   borte uansett hvor god repeateren er.
4. 🔴 **Slett — MED VAKT.** Se § Slettevakten under. **Ikke koble opp `omrade.slett` som den står.**
5. **Sortering** — `sortering` finnes på modellen; rekkefølgen i lista er rekkefølgen i repeateren senere.

### 🔴 Slettevakten — GATET av Kenneth 2026-09-23: «blokkere → hvis feltet inneholder data fra før»

**`slett` skal utvides på serveren før den nås fra UI:**

- **Tell først.** Returner antall kontrollplanpunkter og rapportobjekter som refererer området.
- **Er tallet 0 — området er ubrukt:** slett, som i dag. **Ikke blokkér et tomt område**; da blir lista
  umulig å rydde i.
- **Er tallet > 0 — området inneholder data fra før:** 🔴 **BLOKKÉR.** Ikke advar, ikke tilby «slett
  likevel». Returner tellingen, og la UI si hva som bruker området.
- **Feilmeldingen skal navngi tallet**, ikke bare nekte: «Området brukes av 4 kontrollplanpunkter og kan ikke
  slettes.» En nektelse uten tall sender brukeren på leting.

**Begrunnelsen for at blokkering er riktig og advarsel er for svak:** `@@unique`-fella over gir **stille
duplikater**, ikke en synlig feil. En advarsel forutsetter at brukeren forstår konsekvensen — og konsekvensen
her er usynlig til noen lurer på hvorfor kontrollplanen mistet inndelingen sin.

**Veien ut for brukeren er omdøping, ikke sletting.** Er området feil, retter han navnet. Skal det bort, må
punktene flyttes først — og det er en bevisst handling, ikke en bieffekt.

### 🔴 Tilgang — GATET av Kenneth 2026-09-23: «og bare admin»

**Bytt `verifiserProsjektmedlem` til `verifiserAdmin`** (`apps/api/src/trpc/tilgangskontroll.ts:578`) på
**`opprett`, `oppdater` og `slett`** i `omrade.ts`. Funksjonen finnes og gjør nøyaktig det som trengs:
`sitedoc_admin`-bypass, aktiv ansettelse, ikke-frosset prosjekt, `ProjectMember.role === "admin"`, og
firma-admin-fallback.

**Lesetilgangen (`hentForProsjekt`, `hentForByggeplass`, `hentForTegning`) røres IKKE.** Alle må kunne se
lista; bare admin skal kunne endre den.

🔴 **KONSEKVENS SOM MÅ MELDES FØR DEN BYGGES — den treffer to eksisterende flater:**

`omrade.opprett` kalles i dag fra to steder, og begge er tilgjengelige for **alle prosjektmedlemmer**:

| Flate | Hva som skjer med admin-kravet |
|---|---|
| `tegninger/page.tsx:235` — tegne polygon på tegning | et medlem uten admin får **FORBIDDEN** der det i dag virker |
| `kontrollplan/OpprettPunktDialog.tsx:77` — opprette område inline | samme |

**Design bygger det som gatet — admin på alle tre skriveveiene — fordi det er det som gjør lista stabil.** Et
medlem som kan opprette, kan skrive «Austadvegn», og da drifter identiteten uansett hvor streng sletting er.

⚠️ **Men de to flatene skal ikke bare begynne å feile.** Kravet er: **skjul eller deaktivér
opprett-muligheten for ikke-admin**, med begrunnelsen synlig — ikke la brukeren trykke og få en feilmelding.
Det er samme regel som `fix/utilgjengelige-flyter` innførte for maler: **synlig med begrunnelse, ikke stille
eller ved feil.**

**Meld i leveransen hvor mange steder som må endres for å nå det**, og om noen av dem er i mobil.

**Rød først:** en test som sletter et område brukt av to kontrollplanpunkter med samme mal, og viser at
resultatet i dag blir to punkter med `omradeId = NULL` som **ikke** brytes av unik-indeksen. **Den testen skal
være rød mot dagens kode**, og grønn når vakten er på.

### Skal måles og meldes (steg 1)

1. **Hvem refererer `Omrade` utover kontrollplan?** `RomEgenskapObjekt.tsx:14` og `SoneEgenskapObjekt.tsx:14`
   leser `hentForProsjekt` — altså peker rapportobjekter på områder. **Mål hvordan**, og få dem med i
   tellingen. En sletting som tømmer et rapportobjekt stille, er samme feil i en annen flate.
2. **Kan et område slettes i dag fra en annen vei** — kaskade fra byggeplass eller tegning? `byggeplassId` har
   `onDelete: Cascade`. Slettes en byggeplass, forsvinner områdene, og punktene blir nullstilt. **Meld om
   byggeplass-sletting alt har en vakt som dekker dette.**
3. **Offline:** mobil trenger ikke område-administrasjon. Bekreft at listen kan leses offline der repeateren
   skal brukes.

---

## Steg 2 — ny type `trase` på `Omrade`

**Målt:** `type` er en **Zod-enum** i `omrade.ts:78` — `z.enum(["sone", "rom", "etasje"]).default("sone")`. På
modellen er den en fri streng med enumverdiene i kommentar (`schema.prisma:1027`). **Å legge til `trase`
krever altså en kodeendring, ikke en migrering.**

- Utvid enumen til `["sone", "rom", "etasje", "trase"]`.
- **`polygon` skal være valgfritt for `trase`.** En trasé er en linje, ikke en flate — `polygon` har
  `default([])` og skal kunne stå tom uten at noe i UI antar at et område har areal.
- Typen skal vises i lista fra steg 1, og den skal kunne velges ved opprettelse.

🔴 **Ikke gjør `trase` til noe annet enn en type.** Det er fristende å lage en egen `Trase`-tabell med
start- og sluttpel. **Ikke nå.** `Omrade` bærer navnet, som er det repeateren trenger; pel-intervallet ligger
på befaringsraden, ikke på traseen (se befaringsordren § A2).

---

## Steg 3 — bundet repeater

**Radens identitet skal være en `omradeId`, ikke en streng.**

1. **Ny config på `repeater`:** binding til en prosjektliste — kilde (`omrade`) og filter (`type`). Formen
   velger du; den skal være lesbar i malbyggeren.
2. **Radene fylles fra listen**, ikke av brukeren. Alle områder av den valgte typen på byggeplassen står der
   når dokumentet åpnes, i `sortering`-rekkefølge.
3. **Brukeren legger ikke til rader, og sletter ikke rader.** Det er hele poenget: listen eies av prosjektet.
4. **Hver rad har sitt eget svarfelt** — Kenneths «arbeid pågår / ingen arbeid pågår» — og **radens barn
   vises bare når svaret er ja.**
5. **Fri-rad-repeateren skal virke uendret.** HMS-hendelser og sluttbefaring bruker den, og Kenneth kaller den
   «et fantastisk verktøy». **Bundet er en ny modus, ikke en erstatning.** Det er kravet som skal testes
   hardest.

### 🔴 Dette er umålt og skal måles før bygging

**Kan et felt inne i en repeater-rad være forelder i en `forgrening`?** Hele mønsteret i punkt 4 forutsetter
det, og alle forgreninger i biblioteket i dag ligger på toppnivå i en mal — ikke inne i en repeater-rad.
**Mål det og meld.** Virker det ikke, stopp — design tar stilling til om barna skal ligge flatt i raden i
stedet.

**Og:** `erObjektSynlig` i `packages/shared/src/utils/betingelse.ts` har alt et repeater-unntak. **Les det
først** — det kan være at unntaket nettopp hindrer det punkt 4 krever.

### Rapport og utskrift

- **En rad som er besvart «ingen arbeid pågår» skal vises med navn og svar**, ikke utelates. Den dokumenterer
  at traseen ble vurdert — Kenneth-vedtaket 2026-09-21 om at «Ikke aktuelt» som **svar** blir stående.
- **Radens skjulte barn utelates**, som alle andre aldri-viste felt (ordre `feat/pdf-ikke-aktuelt`).
- **Tomme rader skal ikke fylle rapporten:** ti traséer der ni er uten arbeid, skal gi ni korte linjer og én
  full — ikke ti fulle blokker.

### 🔴 Sideeffekten: svaret oppretter et dokument

Kenneth: «ingen oppgave for austadvegen opprettes». **Et svar i en sjekkliste bestemmer altså om et annet
dokument blir til.** Det er ny oppførsel, og den skal designes her og ikke oppdages senere:

- **Nei → ja:** oppgaven opprettes.
- **Ja → nei etter at oppgaven finnes:** 🔴 **oppgaven skal IKKE slettes.** Den har innhold, signatur og
  historikk. **Svaret oppretter, det sletter aldri.**
- **Meld hva som skjer med et dokument som alt er sendt** når svaret endres. Er dokumentet låst etter sending,
  er svaret kanskje også låst — og da er hele spørsmålet borte.

---

## Rammer

- **Steg 1+2 og steg 3 er to leveranser.** Steg 1+2 kan merges og tas i bruk før steg 3 finnes.
- Ingen endring i `packages/db/prisma` utover det § Steg 2 sier om enumen — og den er i `omrade.ts`, ikke i
  schemaet. **Trenger du en migrering, meld hvorfor før du skriver den.**
- i18n: nye nøkler i `nb.json` og `en.json`, deretter `--only`-generering fra `packages/shared`. Husk fella
  ved endring av eksisterende nøkkel.
- Prod-gaten røres ikke.
- Gate-tall via `pnpm exec turbo run test --force`, web build og mobil typecheck. **Reload oppgis eksplisitt.**

## Definition of Done

1. **Rød først på slettevakten** — testen i § Steg 1 som viser dagens stille duplikater.
2. Område-administrasjon: liste med bruksantall, opprett, omdøp, slett med vakt, sortering.
3. `trase` som type, med valgfritt polygon.
4. Bundet repeater: rader fra listen, ingen brukerlagde rader, eget svarfelt pr. rad, barn betinget av svaret.
5. **Fri-rad-repeateren er uendret** — vis det med en test, ikke med en påstand.
6. Målingene besvart: forgrening inne i repeater-rad · repeater-unntaket i `betingelse.ts` · hvem ellers
   refererer `Omrade` · byggeplass-kaskaden · offline-lesing.
7. **Tekstbevis:** en generert rapport med tre traséer der to er uten arbeid, limt i leveransen. Ingen
   skjermbilder.
8. Diff avgrenset til `omrade.ts`, `oppsett/byggeplasser`, repeater-typen, `betingelse.ts` om nødvendig, og
   tester. Rører du noe annet, meld hvorfor.
9. Leveranse nederst i hovedtreets `relay/inbox-design.md` + «design har post».

## ✅ Alle punkter GATET — ingenting venter på Kenneth

1. ✅ **Blokkere eller advare: «blokkere → hvis feltet inneholder data fra før»** (2026-09-23). Ubrukt område
   slettes fritt; område i bruk blokkeres med tallet i meldingen. Se § Slettevakten.
2. ✅ **Tilgang: «og bare admin»** (2026-09-23). `verifiserAdmin` på alle tre skriveveiene, lesetilgang urørt.
   Se § Tilgang — **med den meldeplikten som følger for de to eksisterende opprett-flatene.**

🔴 **Det eneste som fortsatt kan snu noe i steg 3, er en måling og ikke et valg:** kan et felt inne i en
repeater-rad være forelder i en `forgrening`? Er svaret nei, kommer saken tilbake til design — ikke til
Kenneth.
