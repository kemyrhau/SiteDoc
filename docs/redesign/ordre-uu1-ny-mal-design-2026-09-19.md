# Ordre: UU1 – Prøving av VA-ledninger (ny mal)

**Til:** mal-Opus (`~/Documents/Programmering/SiteDoc-mal`) · **Fra:** design · **Dato:** 2026-09-19
**Metode:** MAL-METODE §1b, §1, §6a og §7b.
**Branch:** `feat/mal-uu1-ny` fra `origin/develop` **etter at UM1 (`feat/mal-um1-ny`) er merget.** UM1 oppretter standard
`NS3420-U`.
**Gatet av Kenneth 2026-09-19:** avgrensning og feltliste. Prøving gjøres ofte av andre enn dem som legger — malen står
derfor på egne ben og bekrefter selv at ledningen er ferdig før prøving.

Grøfteløpet: FD2 → UM1 → FS3 → **UU1**.

---

## 0. Mål før du bygger (meld i leveransen)

1. Standard `NS3420-U` og `KAPITTEL_DATA_U` finnes i develop (fra UM1).
2. Kapittel `UU` finnes ikke — opprettes i modus `ny`.

## 1. Normfakta — egen sammenstilling (NS 3420-U:2019, normside 252–253 og 360–371; PDF-side = normside + 14)

Egne ord per valg i malen (§7b). Normsidene står for gatens skyld; de skal ikke inn i malen.

**Generelt (s. 360–361):** prøving, kontroll og klargjøring gjøres etter gjenfylling og ferdigstillelse, og dokumenteres
i rapport: bestiller, kontrollør, sted, ledning eller kum (betegnelse, type, dimensjon), lengde på prøvestrekningen,
krav, prøvetrykk og prøvetid, trykk eller synk ved slutten, bestått ja/nei, stempel og underskrift.

**Tetthet (s. 361–365):**
- Tettingspropper i hver ende av prøvestrekningen og ved alle avgreininger.
- Før prøving med luft tømmes ledning eller kum for vann.
- Kum: tettes i alle inn- og utløp og på toppen; kjegle eller topplate forankres ved prøving med trykk.
- Kum med vann: fyll til topp, betongkum står minst 4 timer, fyll på, mål synk i 30 minutter; påfylt vann under
  0,2 l per m² innvendig kumflate.

**Trykk (s. 366):** metode og prøvetrykk står i beskrivelsen. Vann til prøving av drikkevannsledning skal ha
drikkevannskvalitet. Ledning eller kum sikres mot forskyvning under prøvingen.

**Deformasjon ved overtakelse (s. 252–253):** termoplast (PVC, PE, PP) høyst 5 % (reduserte krav: 8 %), GRP høyst 3 %.
Punktdeformasjon inntil 1/3 av dette.

**Inspeksjon (s. 367):** med kamera; feil og mangler registreres.

**Spyling (s. 369):** med vann fra nettet; etterpå fri for sand, grus, avleiringer og fremmedlegemer.

**Desinfisering av vannledning (s. 371):** rester av desinfeksjonsmiddel måles etter 24 timer. Bakterieprøver analyseres
ved sertifisert laboratorium. Vann med desinfeksjonsmiddel skal ikke inn i nett i drift, og slippes ut miljøforsvarlig.

## 2. Avgrensning (gatet av Kenneth)

**Med:** tetthetsprøving av ledninger og kummer (UU1.1) · trykkprøving (UU1.2) · kamerainspeksjon (UU1.3) · spyling og
desinfisering (UU1.4) · deformasjonskontroll.
**Ute:** energibærerledninger · røntgenkontroll av sveis (UU1.5) · ledninger under vann · innmåling (FS3).

## 3. Malen

```
kapittelKode: "UU"
referanse:    "UU1"
navn:         "UU1 – Prøving av VA-ledninger"
beskrivelse:  "Prøving og klargjøring av vann-, avløps- og drensledninger og kummer — tetthet, trykk, deformasjon, inspeksjon, spyling, desinfisering og rapport. Faglig grunnlag: NS 3420-U:2019, post UU1."
```

Nytt kapittel i `NS3420-U`: kode `UU`, navn «Felles arbeider for utendørs rørledningsanlegg». Eksporter som `UU1_MAL`
og legg den etter `UM1_MAL`.

### Kontroll FØR utførelse

**1. Hva prøves** — `valg`
- Avløp, selvfall
- Trykkledning
- Kum
- Drensledning
- Annet

> Hva som prøves, avgjør metode og krav. Metode og prøvetrykk står i beskrivelsen.

**2. Ledningen er gjenfylt og ferdig** — `trafikklys`

> Prøving gjøres etter at ledningen er gjenfylt og ferdigstilt. Sjekk at legging og gjenfylling er godkjent før du starter.

**3. Prøvestrekningen er klargjort** — `trafikklys`

> Tettingspropper i hver ende og ved alle avgreininger. Ledning og kum er sikret så de ikke forskyver seg. Før prøving med luft tømmes de for vann. Prøves en kum med trykk, forankres kjeglen eller topplaten.

### Kontroll UNDER utførelse

**4. Prøvemedium** — `valg`
- Luft
- Vann
- Undertrykk

> Vann til prøving av drikkevannsledning skal ha drikkevannskvalitet.

**5. Tetthetsprøving** — `valg`
- Bestått
- Ikke bestått – utbedres og prøves på nytt
- Ikke aktuelt

> Prøv etter metoden i beskrivelsen. Kum med vann: betongkum står minst 4 timer før prøving, synket måles i 30 minutter, og påfylt vann skal være under 0,2 liter per m² innvendig flate. Før resultatet i rapporten.

**6. Trykkprøving** — `valg`
- Bestått
- Ikke bestått – utbedres og prøves på nytt
- Ikke aktuelt

> Gjelder ledninger som skal stå under trykk. Prøvetrykk og metode står i beskrivelsen. Før prøvetrykk, prøvetid og trykkfall i rapporten.

**7. Deformasjon** — `valg`
- Innenfor kravet
- Over kravet – avvik
- Ikke aktuelt

> Gjelder plast- og GRP-rør. Ved overtakelse: plastrør høyst 5 % (8 % ved reduserte krav), GRP høyst 3 %. Punktvis deformasjon høyst en tredjedel av dette.

**8. Kamerainspeksjon** — `valg`
- Utført – ingen feil
- Utført – feil registrert
- Ikke krav

> Inspeksjon gjøres med kamera. Feil og mangler registreres og legges ved rapporten.

### Kontroll ETTER utførelse

**9. Spyling** — `valg`
- Utført – ledningen ren
- Ikke krav

> Spyl med vann fra nettet. Etterpå skal ledningen være fri for sand, grus, avleiringer og fremmedlegemer.

**10. Desinfisering** — `valg`
- Utført – prøver godkjent
- Venter på prøvesvar
- Ikke vannledning

> Mål restene av desinfeksjonsmiddel etter 24 timer. Bakterieprøver analyseres av sertifisert laboratorium. Vannet skal ikke inn i nett som er i drift, og slippes ut miljøforsvarlig. Venter du på prøvesvar, lagre sjekklisten og fullfør når svaret kommer.

**11. Prøverapporten er skrevet og signert** — `trafikklys`

> Rapporten viser bestiller, kontrollør, sted, ledning eller kum med type og dimensjon, lengde, krav, prøvetrykk og tid, resultat og signatur. Legg den ved.

**Helpers:** `valg`, `trafikklys`. Ingen tallfelt, ingen hardkodet JSON.

## 4. SQL

`generer-mal-sql.ts UU1 ny`. Standard finnes (no-op), kapittel `UU` opprettes. Ingen generatorendring forventet —
trengs en, stopp og meld. Lag `uu1-test.sql`, parse-test mot engangsdatabase og slett den etterpå. **Ikke kjør mot test
selv.**

## 5. Rammer

- §7b-sjekk i `uu1-mal.test.ts`: ingen hjelpetekst eller alternativ inneholder `UU1 `, `Tabell U`, `figur U`, `NS-EN`,
  `NS 3420`, `VA/Miljø` eller `Norsk Vann`.
- Ingen eksterne NS-referanser i malen → ingen rad i NS-loggen. Kjør NS-sjekken og meld at den er tom.
- Ingen i18n-nøkler. Prod-gaten røres ikke.

## 6. Definition of Done

**Obligatorisk:**
1. Steg 0 meldt.
2. Kapittel `UU` i `KAPITTEL_DATA_U`, `UU1_MAL` med 11 felt som over, ordrett.
3. `uu1-mal.test.ts`: antall, rekkefølge, typer, faser, navn og §7b-sjekken. Rød først.
4. Gate-bygg med gate-tall `unit-mock · unit-ren · integrasjon · e2e`.
5. `uu1-test.sql` (modus `ny`), parse-testet. Lever de tre enlinjerne.
6. Diff mot develop: `seed-bibliotek.ts`, `uu1-mal.test.ts`. Må du røre en annen fil, meld hvorfor.

Leveranse nederst i `relay/inbox-design.md` + «design har post» til Kenneth. Design forhåndssjekker tekstene, Kenneth
kjører SQL-en, design gater utskriften.
