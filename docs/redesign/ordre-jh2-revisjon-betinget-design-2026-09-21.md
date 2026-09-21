# Ordre: JH2 v2 – asfaltdekke med betingede felt (PILOT)

**Til:** mal-Opus · **Fra:** design · **Dato:** 2026-09-21
**Metode:** MAL-METODE §1b, §1, §6a, §6b, §7b, §7c, §8 og §8b.
**Branch:** `feat/mal-jh2-betinget` fra `origin/develop` **etter at runde E er merget.**
**Grunnlag:** `docs/redesign/designnotat-betingede-felt-design-2026-09-21.md`.
**Gatet av Kenneth 2026-09-21:** skissen, asfalttyper, underlagskontroll og at mykasfalt dekkes av generell hjelpetekst.

Dette er **piloten på betingede felt i bibliotekmaler**. Ingen av de 21 malene bruker forelder/barn i dag, selv om
appen støtter det. Piloten bygger kapasiteten i malverktøyene og bruker den på én mal.

Kenneths tre grunner: riktigere veiledning om hva som kontrolleres og mot hvilke krav · færre synlige felt · en kontroll
som faktisk blir gjennomført fordi listen bare viser det som gjelder jobben.

---

## 1. Kapasiteten som skal bygges (del A)

Appen kan dette allerede — målt av design 2026-09-21: malbyggeren setter `conditionActive`/`conditionValues`,
`useSjekklisteSkjema` (web) og `useOppgaveSkjema` (mobil) skjuler felt som ikke er aktive, valideringen hopper over
skjulte felt, og PDF-en kjenner treet. **Det som mangler ligger i `packages/db/prisma`:**

1. **Hjelpefunksjon i seed** for et betinget felt — et felt som hører under et enkeltvalg og bare vises for bestemte
   svar. Formen velger du; den skal være like lesbar som `valg` og `trafikklys`, og den skal sette `parentId` på
   objektet og `conditionActive`/`conditionValues` på forelderen.
2. **`byggBibliotekRader`** må gi barna riktig `parentId` og en `sortOrder` som plasserer dem rett etter forelderen.
3. **Generatoren** må skrive `parent_id` i SQL-en. Foreldre settes inn før barn i samme transaksjon.
4. **Fasiten (§8)** må vise treet: hvert barn med hvilken forelder og hvilke svar som utløser det. Uten det kan en
   kobling endres stille.
5. **`skriv-mal`** må vise det samme, slik at design gater på en utskrift som viser strukturen.

**Rød først** på hvert punkt der det lar seg gjøre.

## 2. Spørsmål piloten skal svare på (meld i leveransen)

1. **PDF:** skriver arkiv-PDF-en ut felt som aldri ble vist? Mål det — ikke anta.
2. **Lånte firmamaler:** hva skjer med en kopi som ble lånt før treet fantes? Forventet: den står flat til den lånes på
   nytt, og badgen «X versjoner bak» teller som før. Bekreft.
3. **Malbyggeren:** kan et firma bryte forelder-koblingen ved å redigere en lånt mal? Bare mål oppførselen; ikke rett
   noe.
4. **Validering:** bekreft at et påkrevd, skjult felt ikke blokkerer innsending (design målte dette i web-koden —
   bekreft for mobil).

Finner du noe som gjør mønsteret utrygt: **stopp og meld**. Da tar vi malen flat i stedet.

## 3. Malen (del B)

```
kapittelKode: "JH"
referanse:    "JH2"
navn:         "JH2 – Asfaltdekke"
beskrivelse:  "Varmprodusert asfaltdekke — underlag, klebing, utlegging, komprimering, skjøter og ferdig overflate. Faglig grunnlag: NS 3420-J:2008, post JH2."
```

Revisjon: `version + 1`. **Skrivemåte for asfalttyper i hele malen:** fullt navn første gang, forkortelse i parentes —
asfaltbetong (Ab), skjelettasfalt (Ska), mykasfalt (Ma), asfaltgrusbetong (Agb), asfaltert grus (Ag).

### Kontroll FØR utførelse

**1. Type lag** — `valg`
- Slitelag
- Bindlag
- Opprettingslag

> Beskrivelsen sier hvilket lag som legges, med tykkelse og masse. Bærelag av asfalt hører til et eget kapittel i normen og får egen mal — bruk ikke denne for det.

**2. Asfalttype** — `valg`
- Asfaltbetong (Ab)
- Skjelettasfalt (Ska)
- Mykasfalt (Ma)
- Asfaltgrusbetong (Agb)
- Annen type – se beskrivelsen

> Type masse, nominell steinstørrelse og bindemiddel står i beskrivelsen. Kontroller følgeseddelen mot den.

**3. Underlaget består av** — `valg` · **forelder for felt 4 og 5**
- Ubundet lag: grus, forkilt pukk eller knust fjell
- Bundet lag: asfaltert grus (Ag), asfaltgrusbetong (Agb) eller annet bitumenstabilisert lag
- Gammelt asfaltdekke

> Hva du legger på, avgjør hva som må kontrolleres: et ubundet lag skal være komprimert og jevnt, mens et bundet lag skal rengjøres og klebes.

**4. Planhet og komprimering på underlaget** — `valg` · **vises når felt 3 = «Ubundet lag: grus, forkilt pukk eller knust fjell»**
- Kontrollert – innenfor kravene
- Oppretting utført før legging
- Avvik – rettes før legging

> Mål planheten med 3 m rettholt mot kravet i beskrivelsen. For veg gjelder toleransene i vegvesenets håndbok N200. Laget skal være komprimert og kontrollert før dekket legges — be om måleresultatet i stedet for å anta. Ujevnheter rettes med opprettingslag, ikke ved å variere tykkelsen på slitelaget.

**5. Rengjøring og klebing** — `valg` · **vises når felt 3 = «Bundet lag: asfaltert grus (Ag), asfaltgrusbetong (Agb) eller annet bitumenstabilisert lag» eller «Gammelt asfaltdekke»** · **forelder for felt 6**
- Rengjort og klebet – virksom over hele flaten
- Rengjort – klebing ikke krevd
- Avvik

> Rengjør ved feiing eller spyling før klebing. Klebemiddelet skal virke over hele arealet. Også et bundet bærelag, for eksempel asfaltert grus (Ag), skal klebes før neste lag legges. Fås ikke vedheft mellom lagene, freses laget bort, det klebes på nytt, og ny asfalt legges.

**6. Trafikk på klebet flate** — `valg` · **vises når felt 5 = «Rengjort og klebet – virksom over hele flaten»**
- Ikke trafikkert før legging
- Trafikkert – strødd med sand først
- Avvik

> Klebet flate bør ikke kjøres på før laget legges. Må den kjøres på, strøs den med sand først.

**7. Vær og underlag** — `valg`
- Tørt underlag – klart for legging
- Fritt vann på underlaget – vent
- Frossent eller for kaldt underlag – vent

> Det skal ikke asfalteres når det står fritt vann på underlaget. Frossent underlag gir dårlig vedheft og skal ikke asfalteres.

### Kontroll UNDER utførelse

**8. Masse og temperatur** — `valg`
- Type og temperatur som beskrevet
- Avvik – meldt

> Massen skal være homogen, og filler, finstoff og fiber tørre ved innmatning. Laveste utleggingstemperatur følger massetypen og står i beskrivelsen — mykasfalt (Ma) legges ved langt lavere temperatur enn varm asfaltbetong (Ab).

**9. Komprimering fullført i tide** — `valg`
- Ja – før temperaturen falt 50 °C under laveste utleggingstemperatur
- Avvik

> Valsingen skal være ferdig mens massen fortsatt er varm nok. Kommer den for sent, blir dekket ikke tett.

### Kontroll ETTER utførelse

**10. Skjøter, kanter og overflate** — `valg`
- Følger vegens geometri, overflaten er homogen
- Sprekker, hull eller fete partier – utbedres
- Skjøt eller kant avviker – utbedres

> Langsgående skjøter legges der det kjøres minst, og skjøter og kanter følger vegens linjer. Dekket skal være jevnt i utseende og friksjon.

**11. Jevnhet og høyde** — `valg`
- Innenfor kravene i beskrivelsen
- Avvik

> Jevnheten måles med rettholt. Tillatt sideavvik er +100 / −0 mm. For bind- og slitelag i veg gjelder toleransene i vegvesenets håndbok N200 — beskrivelsen sier hvilke som er avtalt for jobben.

**12. Ferdig dekke godkjent og dokumentert** — `trafikklys`

> Avstrøing er utført der det kreves, følgesedler er samlet, og dekket er klart for overlevering. Ta bilde.

**Struktur:** ni felt vises alltid (1, 2, 3, 7, 8, 9, 10, 11, 12). Felt 4 **eller** 5 vises etter svaret i felt 3, og
felt 6 bare når det er klebet. Typisk jobb viser ti eller elleve felt.

**Utgår fra v1:** «Underlaget rengjort» og «Klebing» som egne felt (slått sammen til 5) · «Overflaten» som eget felt
(slått sammen med skjøter og kanter i 10).

## 4. Rammer

- §7b-sjekk i `jh2-mal.test.ts` som før: ingen `JH2 `, `JH1 `, `Matrise`, `NS-EN`, `NS 3420` eller `NS 3458`.
  Asfaltbetegnelsene (Ab, Ska, Ma, Agb, Ag) og N200 er tillatt (§7c).
- **Strukturtest:** `jh2-mal.test.ts` skal låse treet — hvilke felt som er barn, av hvem, og hvilke svar som utløser
  dem. Rød først.
- Fasit og `skriv-mal` viser treet (del A). Ingen i18n-nøkler. Prod-gaten røres ikke.
- Gate-tall via `pnpm exec turbo run test --force`.

## 5. SQL og DoD

`generer-mal-sql.ts JH2 revisjon` — revisjonen sletter objekt-radene og setter inn de nye, nå med `parent_id`.
Lag `jh2-v2-test.sql`, parse-test mot engangsdatabase, slett den etterpå, og lever de tre enlinjerne. **Ikke kjør mot
test selv.**

**DoD:**
1. Del A: hjelpefunksjon, `byggBibliotekRader`, generator, fasit og `skriv-mal` håndterer tre. Rød først der det lar seg
   gjøre.
2. De fire pilotspørsmålene i § 2 besvart med måling.
3. `JH2_MAL` med 12 felt som over, ordrett, med riktig forelder/barn.
4. Strukturtest og §7b-sjekk grønne, fasit oppdatert i samme branch.
5. Gate-bygg med gate-tall. Lokal utskrift (`skriv-mal JH2`) limt i leveransen — den skal vise hvilket svar som utløser
   felt 4, 5 og 6.
6. Diff: `seed-bibliotek.ts`, `jh2-mal.test.ts`, `mal-fasit.snap.md`, `generer-mal-sql.ts`, `skriv-mal.ts` og deres
   tester. Rører du noe annet, meld hvorfor.
7. Leveranse i hovedtreets `relay/inbox-design.md` + «design har post».

Design gater felt for felt, og leser treet særlig nøye: dette er første mal der struktur og innhold endres i samme
runde.
