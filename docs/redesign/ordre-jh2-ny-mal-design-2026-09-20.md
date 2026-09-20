# Ordre: JH2 – Asfaltdekke (ny mal, ny standard NS 3420-J)

**Til:** mal-Opus · **Fra:** design · **Dato:** 2026-09-20
**Metode:** MAL-METODE §1b, §1, §6a, §7b, §8 og §8b.
**Runde D** — bygges sammen med `ordre-ff1-ny-mal-design-2026-09-20.md` i **én branch**: `feat/mal-runde-d`.
Rammer, DoD og SQL står i FF1-ordren §4–5 og gjelder hele runden.
**Gatet av Kenneth 2026-09-20:** avgrensning og feltliste.

Fjerde standard: **NS 3420-J:2008 Dekke- og banearbeider**. Merk årstallet — de andre standardene i arkivet er 2024
(K, F) og 2019 (U). Dette er hullet vi selv laget da asfalt ble tatt ut av KD1.

---

## 1. Normfakta — egen sammenstilling (NS 3420-J:2008, normside 39–44; PDF-side = normside + 2)

Egne ord per valg i malen (§7b). Normsidene står for gatens skyld; de skal ikke inn i malen.

**Underlag (s. 40–41):**
- Rengjøres ved feiing eller spyling. Er underlaget forurenset, kan det kreve egen håndtering.
- Klebemiddelet skal være virksomt over hele arealet.
- Etter påsprøyting bør underlaget ikke trafikkeres før opprettingslag eller dekke legges. Må det trafikkeres, strøs det
  først med sand.
- Oppnås ikke vedheft mellom lagene, og det ikke lar seg løse på annen måte, freses siste lag bort, det klebes på nytt,
  og ny asfalt legges.

**Utførelse (s. 42):**
- Filler, finstoff og eventuell fiber skal være tørt og homogent ved innmatning.
- Det skal ikke asfalteres når det står fritt vann på underlaget.
- Komprimeringen skal være fullført før temperaturen er sunket 50 °C under laveste utleggingstemperatur.
- Dekket skal være homogent og ensartet, uten sprekker, hull eller fete partier, med mest mulig ensartet friksjon.
  Avstrøing med sand eller asfaltert finpukk der det kreves.
- Skjøter og kanter følger vegens geometri. Langsgående skjøter legges på de minst trafikkerte arealene, av hensyn til
  trafikk og utstyr.

**Toleranser (s. 39):** tillatt sideavvik er +100 / −0 mm. Toleranser for bind- og slitelag i vegbygging følger
vegvesenets håndbok, altså beskrivelsen. Jevnhet måles med rettholt.

**Valg som står i beskrivelsen (s. 43–44):** formål (veg, bilopp­stillingsplass, gang- og sykkelveg, innkjørsel, annet) ·
asfalttype (Agb, Ab, Ska, Ma, Sta, Top, Da, T) · nominell steinstørrelse · lag (slitelag eller bindlag) · tykkelse ·
bindemiddel · klebemiddel.

## 2. Avgrensning (gatet av Kenneth)

**Med:** varmprodusert asfaltdekke (JH2.1) med behandling av underlaget — rengjøring, klebing og oppretting (JH1) — og
avstrøing (JH2.81).
**Ute:** kaldprodusert asfalt (JH3) · bærelag med bitumen eller sement (JB) · oppmerking (JK) · fartshumper (JH8.2) ·
kanter og renner (JH6) · kunstgress (JM) og kunststoffdekker (JP) · alt som bare gjelder flyplasser.

## 3. Malen

```
kapittelKode: "JH"
referanse:    "JH2"
navn:         "JH2 – Asfaltdekke"
beskrivelse:  "Varmprodusert asfaltdekke — rengjøring, klebing, utlegging, komprimering, skjøter og ferdig overflate. Faglig grunnlag: NS 3420-J:2008, post JH2."
```

**Ny standard:** kode `NS3420-J`, navn «NS 3420-J:2008 Dekke- og banearbeider», sortering 4.
**Nytt kapittel:** kode `JH`, navn «Asfaltdekker», sortering 1. Begge opprettes av generatorens standard- og
kapittel-logikk. Eksporter som `JH2_MAL`.

### Kontroll FØR utførelse

**1. Type lag** — `valg`
- Slitelag
- Bindlag
- Opprettingslag
- Annet lag

> Beskrivelsen sier hvilket lag som legges, med asfalttype, steinstørrelse og tykkelse.

**2. Underlaget rengjort** — `valg`
- Feid
- Spylt
- Ikke krav
- Avvik – ikke rent

> Underlaget skal være rent før klebing. Er det forurenset, håndteres det slik beskrivelsen sier.

**3. Klebing** — `valg`
- Utført, virksom over hele flaten
- Ikke krav
- Avvik

> Klebemiddelet skal virke over hele arealet. Velg type og mengde etter beskrivelsen.

**4. Vær og underlag** — `valg`
- Tørt underlag – klart for legging
- Fritt vann på underlaget – vent
- Underlaget for kaldt eller vått – vent

> Det skal ikke asfalteres når det står fritt vann på underlaget.

### Kontroll UNDER utførelse

**5. Masse og temperatur** — `valg`
- Type og temperatur som beskrevet
- Avvik – meldt

> Massen skal være homogen, og filler, finstoff og fiber tørre ved innmatning. Følgeseddel kontrolleres mot beskrivelsen.

**6. Komprimering fullført i tide** — `valg`
- Ja – før temperaturen falt 50 °C under laveste utleggingstemperatur
- Avvik

> Valsingen skal være ferdig mens massen fortsatt er varm nok. Kommer den for sent, blir dekket ikke tett.

**7. Skjøter og kanter** — `valg`
- Følger vegens geometri, langsgående skjøt utenfor mest kjørte felt
- Avvik

> Legg langsgående skjøter der det kjøres minst. Skjøter og kanter skal følge vegens linjer.

**8. Trafikk på klebet flate** — `valg`
- Ikke trafikkert før legging
- Trafikkert – strødd med sand først
- Avvik

> Klebet flate bør ikke kjøres på før laget legges. Må den kjøres på, strøs den med sand først.

### Kontroll ETTER utførelse

**9. Overflaten** — `valg`
- Homogen og ensartet
- Sprekker, hull eller fete partier – utbedres

> Dekket skal være jevnt i utseende og friksjon. Manglende vedheft mellom lagene løses ved å frese bort laget, klebe på nytt og legge ny asfalt.

**10. Jevnhet og høyde** — `valg`
- Innenfor kravene i beskrivelsen
- Avvik

> Jevnheten måles med rettholt. Tillatt sideavvik er +100 / −0 mm. Toleransene for bind- og slitelag i veg står i beskrivelsen.

**11. Ferdig dekke godkjent og dokumentert** — `trafikklys`

> Avstrøing er utført der det kreves, følgesedler er samlet, og dekket er klart for overlevering. Ta bilde.

**Helpers:** `valg`, `trafikklys`. Ingen tallfelt, ingen hardkodet JSON.

## 4. Rammer

§7b-sjekk i `jh2-mal.test.ts`: ingen hjelpetekst eller alternativ inneholder `JH2 `, `JH1 `, `Matrise`, `NS-EN`,
`NS 3420`, `NS 3458` eller `Håndbok`. Asfalttypene (Ab, Ska, Ma …) og klebemidlene er bransjebetegnelser på produktet og
er tillatt — standardene bak navngis ikke. **«Statens vegvesen» og håndboknummer skal ikke stå i malen**; skriv
«beskrivelsen» i stedet.

Ellers gjelder rammene, DoD-en og SQL-avsnittet i FF1-ordren for hele runden.
