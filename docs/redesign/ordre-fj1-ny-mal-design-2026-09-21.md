# Ordre: FJ1 – Vannhåndtering (ny mal)

**Til:** mal-Opus · **Fra:** design · **Dato:** 2026-09-21
**Metode:** MAL-METODE §1b, §1, §6a, §6b, §7b, §7c, §8 og §8b.
**Runde E** — bygges sammen med `ordre-fp1-ny-mal-design-2026-09-21.md` i **én branch**: `feat/mal-runde-e` fra
`origin/develop`.
**Gatet av Kenneth 2026-09-21:** avgrensning og feltliste.

Nytt kapittel `FJ` i `NS3420-F`. Vannhåndtering er HMS-nært og dokumenteres sjelden — normen krever faktisk at
vannmengdene måles.

---

## 1. Normfakta — egen sammenstilling (NS 3420-F:2024, normside 158–173; PDF-side = normside + 12)

Egne ord per valg i malen (§7b). Normsidene står for gatens skyld; de skal ikke inn i malen.

**Krav som gjelder hele kapittelet (s. 158):** håndterte vannmengder skal dokumenteres med vannmåler eller på annen
måte. Krav til utslippsvann og krav fra myndigheter angis i beskrivelsen.

**Lensing (s. 159–160):**
- Prisen for lensing for egne arbeider dekker drift og vedlikehold av utstyret, og nødvendig beredskap utenom vanlig
  skiftordning mens arbeidet pågår — også helger, helligdager og ferie.
- Det skal være vurdert hvordan lensingen håndteres ved lange pauser, og etter at entreprenøren er ferdig.

**Drenering av bergoverflate (s. 161):** drenering som festes til berget, skal festes slik at den får god kontakt og
følger ujevnhetene. Ved sprøytebetong i dagen føres dreneringen ned under partiet som sprøytes.

**Sedimentering og rensing (s. 169):**
- Anlegget planlegges slik at vannet resirkuleres i størst mulig grad.
- Ved tømming av slam pumpes vann over slamnivå ut først.
- Slam leveres til godkjent mottak om ikke annet er avtalt.

**Kontroll av utslipp (s. 171):** måles etter avtalt frekvens og prosedyre. Typiske målinger er pH og partikkelinnhold.

**Siltskjørt (s. 171–172):** skal være riktig montert, virke etter hensikten, og grenseverdiene for partikler, målt som
turbiditet, skal overholdes.

## 2. Avgrensning (gatet av Kenneth)

**Med:** rigging og drift av lensing (FJ1), drenering av bergoverflate (FJ2), sedimentering og rensing (FJ6), kontroll
av utslipp (FJ7) og drift av siltskjørt (FJ8.2).
**Ute:** vanninfiltrasjon (FJ4) · lekkasjemåling i tunnel (FJ5) · håndtering av plastavfall i vann (FJ8.4) ·
grunnvannsbrønner og wellpoint (egen normdel) · injeksjon.

## 3. Malen

```
kapittelKode: "FJ"
referanse:    "FJ1"
navn:         "FJ1 – Vannhåndtering"
beskrivelse:  "Lensing, drenering, sedimentering og kontroll av utslipp — utstyr, beredskap, måling og slamhåndtering. Faglig grunnlag: NS 3420-F:2024, post FJ1."
```

Nytt kapittel i `NS3420-F`: kode `FJ`, navn «Vannhåndtering», sortering mellom `FH` (5) og `FS` (6). Er plassen opptatt,
bruk `--sorter` og meld hva du flytter. Eksporter som `FJ1_MAL`.

### Kontroll FØR utførelse

**1. Hva håndteres** — `valg`
- Lensing av byggegrop eller grøft
- Drenering av bergoverflate
- Sedimentering og rensing før utslipp
- Flere av delene

> Sier hva jobben omfatter, og styrer hvilke felt under som er aktuelle.

**2. Krav til utslipp** — `valg`
- Krav og tillatelse er kjent
- Ikke krav til utslippet
- Ikke avklart – stopp før utslipp

> Krav til utslippsvann og krav fra myndighetene står i beskrivelsen eller i tillatelsen. Slipp ikke vann ut før dette er avklart.

**3. Utstyret er rigget** — `trafikklys`

> Pumper, slanger, lenseledning og strøm er på plass og virker, og det er avklart hvem som følger opp utstyret utenom arbeidstid.

### Kontroll UNDER utførelse

**4. Vannmengden dokumenteres** — `valg`
- Vannmåler
- Dokumentert på annen måte
- Ikke dokumentert – avvik

> Vannmengden som håndteres, skal dokumenteres. Vannmåler er det enkleste, men pumpekapasitet ganget med driftstid kan også brukes når det er avtalt.

**5. Beredskap utenom arbeidstid** — `valg`
- Avklart og på plass
- Ikke behov
- Uavklart – avvik

> Lensingen må også virke i helger, på helligdager og i ferier så lenge arbeidet pågår. Avklar hvem som sjekker, og hva som skjer ved lange pauser.

**6. Sedimentering og rensing** — `valg`
- I drift
- Ikke krav
- Ute av drift – stopp utslippet

> Anlegget skal resirkulere vannet så mye som mulig. Ved tømming av slam pumpes vannet over slamnivået ut først.

**7. Kontroll av utslipp** — `valg`
- Målt etter avtalt frekvens
- Ikke krav
- Ikke målt – avvik

> Typiske målinger er pH og partikkelinnhold. Frekvens og prosedyre står i beskrivelsen. Før resultatene i loggen.

**8. Siltskjørt** — `valg`
- Montert riktig, grenseverdiene overholdes
- Ikke aktuelt
- Grenseverdi overskredet – tiltak

> Gjelder arbeid ved eller i vann. Skjørtet skal være riktig montert og virke etter hensikten, og partikkelspredningen skal holdes innenfor grensen.

### Kontroll ETTER utførelse

**9. Slam levert til godkjent mottak** — `valg`
- Levert – kvittering foreligger
- Ikke aktuelt
- Mangler kvittering

> Slam leveres til godkjent mottak om ikke annet er avtalt. Ta vare på kvitteringen.

**10. Nedrigging og dokumentasjon** — `trafikklys`

> Utstyret er tatt ned, målinger og kvitteringer er samlet, og området er ryddet. Ta bilde.

**Helpers:** `valg`, `trafikklys`. Ingen tallfelt, ingen hardkodet JSON.

## 4. Rammer og DoD (gjelder hele runde E)

- §7b-sjekk i `fj1-mal.test.ts`: ingen hjelpetekst eller alternativ inneholder `FJ1 `, `FJ8 `, `Tabell F`, `figur F`,
  `Matrise`, `NS-EN` eller `NS 3420`.
- §7c: gratis offentlige kilder kan navngis. Ingen av dem er aktuelle i denne malen.
- Ingen eksterne NS-referanser i malene → ingen rad i NS-loggen. Kjør NS-sjekken og meld at den er tom.
- Fasiten (§8) oppdateres i samme branch. Lokal utskrift (`skriv-mal FJ1 FP1`) limes i leveransen.
- Gate-tall via `pnpm exec turbo run test --force`. Diff: `seed-bibliotek.ts`, `fj1-mal.test.ts`, `fp1-mal.test.ts`,
  `mal-fasit.snap.md`, og generator bare hvis noe mangler — meld i så fall.
- **§6b:** oppgi feltnummer (`f10`), ikke radnummer, når du viser til et felt.
- Ingen i18n-nøkler. Prod-gaten røres ikke.

## 5. SQL

`generer-mal-sql.ts FJ1 FP1 ny` → én fil, én transaksjon. Begge kapitlene er nye i en standard som finnes.
Lag `runde-e-test.sql`, parse-test mot engangsdatabase, slett den etterpå, og lever de tre enlinjerne. **Ikke kjør mot
test selv.**
