# Ordre: KD1 v3 – belegg av stein og heller med betingede kravfelt

**Til:** mal-Opus · **Fra:** design · **Dato:** 2026-09-22
**Metode:** MAL-METODE §1, §1c, §1e, §6a, §6b, §6c, §7b, §8 og §8b.
**Branch:** `feat/mal-kd1-betinget` fra `origin/develop` **etter at JH2 v2 er merget.**
**Gatet av Kenneth 2026-09-22:** alternativ 1 — alle fire kravfeltene forgrenes.

Andre mal med betingede felt, og den første der **innholdet** er grunnen: KD1 bærer i dag fire tabeller med krav som
arbeideren selv må finne raden i. Etter denne runden ser han bare kravet for steinen han la.

---

## 1. Problemet, målt i dagens mal (fasiten, develop)

| Felt | Hvordan kravet står i dag |
|---|---|
| f04 Tykkelse settelag | fem alternativer med hvert sitt intervall |
| f07 Fugebredde | seks alternativer |
| f08 Planhet | seks alternativer, og hjelpeteksten lister seks kravsett |
| f09 Sprang ved fuger | hjelpeteksten lister fem kravsett |

**Alle fire avhenger av belegningstypen, som allerede er valgt i f01.** Det er nøyaktig det betingede felt løser.

## 2. Grepet

**`Belegningstype` (f01) blir forelder.** De elleve typene beholdes som de er — de er gjenkjennelige for den som
legger. **Hvert kravfelt får én gren per kravsett**, og grenen utløses av de typene som deler kravet.

**Alternativene blir enkle** — «Innenfor kravet» og «Avvik» — og **tallet flyttes til hjelpeteksten** (§1e).

**Gang- og kjøreareal skilles fortsatt i hjelpeteksten**, ikke i en gren: kravet avhenger av to ting, og en gren kan
bare henge på ett svar. Formen er «gangareal X, kjøreareal Y».

## 3. Byggekrav: barn i en annen fase enn forelderen

`forgrening()` fra del A legger barna **rett etter** forelderen. Her hører barna til ulike faser: tykkelse i FØR,
fugebredde, planhet og sprang i ETTER, mens forelderen står i FØR.

**Trengs det, utvid hjelpefunksjonen** med en måte å feste et barn til en forelder-`ref` lenger opp i lista (f.eks.
`barnAv(ref, naar, felt)`), slik at barnet får riktig `parentId` og sin egen plass i rekkefølgen.

🔴 **Mål først at dette virker i utfyllingen:** et barn som står i en senere fase enn forelderen, skal vises og skjules
riktig. Synlighetsfunksjonen bryr seg ikke om rekkefølge, men det er **ikke verifisert** med avstand mellom forelder og
barn. **Finner du at det ikke virker: stopp og meld.** Da tar vi kravfeltene i samme fase som forelderen i stedet.

## 4. Malen

Revisjon av `KD1_MAL`, `version + 1`. Navn og beskrivelse uendret.

### Uendret fra v2 (samme tekst, samme rekkefølge)

- **f01 Belegningstype** — alle elleve alternativer og hjelpeteksten beholdes ordrett. **Blir forelder.**
- **f02 Areal** — uendret.
- **f03 Settelag** — uendret.
- **f05 Fall mot avrenning** — uendret (kravet følger areal og gatestein, ikke typen alene).
- **f06 Fuger og striper i rette linjer eller jevne buer** — uendret.
- **f10 Krav oppfylt og dokumentasjon levert** — uendret.

### Erstattes: tykkelse settelag (FØR, etter f03)

Fire grener, alle `valg` med alternativene **«Innenfor kravet» · «Avvik – måles og noteres»**:

| Gren | Vises når belegningstype er | Hjelpetekst |
|---|---|---|
| A | Betongheller · Belegningsstein av betong · Belegningsstein av tegl | Settelaget skal være 20–40 mm. Legg med overhøyde på 3–5 mm, så belegget ender i riktig høyde etter komprimering. Ved avvik: noter målt tykkelse og sted i kommentaren. |
| B | Mosaikkstein · Natursteinsplater – sagde sider · Natursteinsplater – råhogde kanter / bruddheller · Belegningsstein av naturstein | Settelaget skal være 30–50 mm. Legg med overhøyde på 3–5 mm. Ved avvik: noter målt tykkelse og sted i kommentaren. |
| C | Storgatestein · Smågatestein | Settelaget skal være 50–70 mm. Gatestein legges med overhøyde på 8–12 mm. Ved avvik: noter målt tykkelse og sted i kommentaren. |
| D | Permeabelt belegg · Annet – se beskrivelsen | Tykkelsen står i beskrivelsen. Med snøsmelteanlegg gjelder leverandørens tykkelse. Ved avvik: noter målt tykkelse og sted i kommentaren. |

### Erstattes: fugebredde (ETTER)

Fem grener, `valg` med **«Innenfor kravet» · «Avvik – måles og noteres»**:

| Gren | Vises når | Hjelpetekst |
|---|---|---|
| A | Storgatestein · Smågatestein · Mosaikkstein · Natursteinsplater – råhogde kanter / bruddheller | Fugene legges i knas — steinene ligger tett mot hverandre. Ved avvik: noter sted i kommentaren. |
| B | Betongheller · Belegningsstein av betong | Fugebredden skal være 2–5 mm. Ved avvik: noter målt bredde og sted i kommentaren. |
| C | Belegningsstein av naturstein | Fugebredden skal være 5–7 mm. Enkeltsteiner kan avvike ±3 mm. Ved avvik: noter målt bredde og sted. |
| D | Natursteinsplater – sagde sider | Fugebredden avhenger av platetykkelsen: 5–8 mm for plater under 80 mm, og 9–12 mm for plater fra 80 til 150 mm. Over 150 mm står bredden i beskrivelsen. Enkeltplater kan avvike ±2 mm. |
| E | Belegningsstein av tegl · Permeabelt belegg · Annet – se beskrivelsen | Fugebredden står i beskrivelsen. Ved avvik: noter målt bredde og sted i kommentaren. |

### Erstattes: planhet (ETTER)

Fire grener, `valg` med **«Innenfor kravet» · «Avvik – måles og noteres»**. Alle hjelpetekster åpner med «Målt med 3 m
rettholt.»:

| Gren | Vises når | Hjelpetekst |
|---|---|---|
| A | Betongheller · Belegningsstein av betong · Belegningsstein av tegl · Belegningsstein av naturstein · Smågatestein · Mosaikkstein | Målt med 3 m rettholt: svanker og bulninger skal være innenfor ±3 mm på gangareal og ±5 mm på kjøreareal. Mål flere steder. Ved avvik: noter største måling og sted. |
| B | Storgatestein · Natursteinsplater – sagde sider | Målt med 3 m rettholt: innenfor ±5 mm på gangareal og ±8 mm på kjøreareal. Mål flere steder. Ved avvik: noter største måling og sted. |
| C | Natursteinsplater – råhogde kanter / bruddheller | Målt med 3 m rettholt: innenfor ±8 mm på gangareal og ±10 mm på kjøreareal. Mål flere steder. Ved avvik: noter største måling og sted. |
| D | Permeabelt belegg · Annet – se beskrivelsen | Målt med 3 m rettholt: for maskinlagt permeabelt belegg gjelder ±3 mm på gangareal og ±6 mm på kjøreareal. Ellers står kravet i beskrivelsen. |

### Erstattes: største sprang ved fuger (ETTER)

**Beholdes som tallfelt** (`heltall`, `{ enhet: "mm" }`, ingen maks) — det er én veldefinert måling, og verdien er verdt
å ha i dokumentet (§1). Fem grener, der bare hjelpeteksten skiller:

| Gren | Vises når | Hjelpetekst |
|---|---|---|
| A | Betongheller · Belegningsstein av betong · Belegningsstein av tegl · Belegningsstein av naturstein | Største tillatte sprang er 2 mm på gangareal og 3 mm på kjøreareal. Før inn den største målingen i hele mm. |
| B | Smågatestein · Mosaikkstein | Største tillatte sprang er 3 mm på gangareal og 5 mm på kjøreareal. Før inn den største målingen i hele mm. |
| C | Storgatestein | Største tillatte sprang er 5 mm på gangareal og 8 mm på kjøreareal. Før inn den største målingen i hele mm. |
| D | Natursteinsplater – sagde sider | Største tillatte sprang er 4 mm på gangareal og 6 mm på kjøreareal. Før inn den største målingen i hele mm. |
| E | Natursteinsplater – råhogde kanter / bruddheller · Permeabelt belegg · Annet – se beskrivelsen | Største tillatte sprang er 6 mm på gangareal og 8 mm på kjøreareal for råhogde plater. For permeabelt og annet står kravet i beskrivelsen. Før inn den største målingen i hele mm. |

**Feltnavnene beholdes** som i dag: «Tykkelse settelag», «Fugebredde», «Planhet – svanker/bulninger over 3 m»,
«Største vertikale sprang ved fuger (mm)». Grenene er samme felt for ulike typer, ikke ulike felt.

## 5. Resultatet

Fire kravfelt vises, ett per gren, skreddersydd for typen. Ingen av dem lister krav som ikke gjelder.
**Synlig for en betongheller-jobb: ti felt, alle relevante.** Malen inneholder 18 grener, men arbeideren ser fire.

## 6. Rammer og DoD

- §7b-sjekk som før i `kd1-mal.test.ts`: ingen `Tabell K`, `KD1 c`, `NS-EN` eller `NS 3420` i hjelpetekst eller
  alternativ.
- **Strukturtest:** lås hvilke felt som er barn, av hvem, og hvilke typer som utløser dem. Rød først.
- **§6c:** SQL-utskriften skal vise forelder og utløsersett per rad.
- Fasiten oppdateres i samme branch. Diffen skal være begrenset til KD1-regionen.
- §8b: SQL-runde kreves. Lever de tre enlinjerne, ikke kjør dem selv.
- Gate-tall via `pnpm exec turbo run test --force`, og lokal `skriv-mal KD1` limt i leveransen.
- Leveranse i hovedtreets `relay/inbox-design.md` + «design har post».

**Design gater gren for gren** — det er atten av dem, og en feil utløser sender arbeideren til feil krav.
