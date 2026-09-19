# Ordre: FH1 – Sprengning i dagen (omkoding av FC1 + revisjon)

**Til:** mal-Opus (`~/Documents/Programmering/SiteDoc-mal`) · **Fra:** design · **Dato:** 2026-09-19
**Metode:** MAL-METODE §1b, §1, §6a og §7b. Samme mønster som FS2-ordren.
**Branch:** `feat/mal-fh1-omkoding` fra `origin/develop` **etter at FD2 (`feat/mal-fd2-ny`) er merget.** Én mal om gangen:
begge rører `seed-bibliotek.ts`, og FS2 må også være inne (generatoren oppretter målkapittel ved `--fra`).
**Gatet av Kenneth 2026-09-19:** avgrensning, feltliste, og sletting av tomt kildekapittel.

Dagens «FC1 – Sprengning» ligger i kapittel `FC`, som ikke finnes i normen. Sprengning hører til FH (uttak av berg).

---

## 0. Mål før du bygger (meld i leveransen)

1. `FC1` ligger alene i kapittel `FC` (seed og FS2-/FD2-kjøringene). Kapittel `FH` finnes ikke.
2. Er det andre tabeller enn `bibliotek_maler` som peker på `bibliotek_kapitler.id`? List dem. Finnes det, stopp og meld
   før du lager slettingen.

## 1. Normfakta — egen sammenstilling (NS 3420-F:2024, normside 99–108; PDF-side = normside + 12)

Egne ord per valg i malen (§7b). Normsidene står for gatens skyld; de skal ikke inn i malen.

**Planer og rapporter (s. 105, 107):**
- Sprengningsplan og risikovurdering skal være skriftlige før sprengningsarbeidet starter, og oppbevares i minst 3 år.
- Salveplan skal være skriftlig i god tid før hver salve, i tråd med sprengningsplanen.
- Salverapport skal være skriftlig: boring, lading, tennernummerering, dekking, målinger av støy og vibrasjon, vurdering
  av salven, avvik og hvordan de ble håndtert.
- Sikkerhetstiltak omfatter varsling, sperring, skilting, vakter og dekking.

**Grenseverdier (s. 101):** vibrasjon, støy og støv står i beskrivelsen, satt av oppdragsgiver.

**Endelig flate (s. 99–103):**
- Ingen ansett innenfor prosjektert endelig flate.
- Ansett for hull i endelig flate: innenfor 100 mm fra teoretisk ansett. Retning: maks 2 % avvik per pall.
- Redusert ladning i endelig flate, og ved behov i raden innenfor.
- Uttaket skal ikke svekke den endelige bergflaten unødig.

| Toleranseklasse (fra beskrivelsen) | Knøler innenfor endelig flate |
|---|---|
| 0 | ingen |
| 1 | maks 0,15 m |
| 2 | maks 0,5 m |
| 3 | ingen krav |

**Såle (s. 100, 107):** ikke berg over prosjektert nivå i sålen. Kontroller etter hver salve at det er skutt ut nok i
bunnen.

**Minsteavstander (s. 99–100):**

| Hva | Krav |
|---|---|
| Betongvegg til skjæring, skjæring inntil 8 m | 1,5 m |
| Betongvegg til skjæring, skjæring over 8 m | 2,0 m |
| Fundament til skjæring, fundament inntil 1,0 m høyt | 1,0 m |
| Fundament til skjæring, høyere fundament | 1,5 m |

**Gjenstående sprengstoff (s. 101–102):** der det er sprengt før, må det tas hensyn til risikoen for udetonert
sprengstoff, også ved pigging, rensk og opplasting etterpå.

## 2. Avgrensning (gatet av Kenneth)

**Med:** sikkerhetstiltak (FH1.1) og sprengning i dagen (FH1.33), med kravene fra FH og FH1.
**Ute:** under jord (FH1.4) · under vann (FH1.7) · kontursprengning som egen post (FH1.37) · rensk (FF5) · pigging og
vaiersaging (FH2) · sprengning av grøft og grop (FH1.5, FH1.6 — ev. egne maler senere).

## 3. Omkoding og kapitler (obligatorisk)

| Felt i `bibliotek_maler` | Før | Etter |
|---|---|---|
| `referanse` | `FC1` | `FH1` |
| kapittel | `FC` | `FH` (nytt) |
| `navn` | FC1 – Sprengning | FH1 – Sprengning i dagen |

**Nytt kapittel** i `NS3420-F`: kode `FH`, navn «Uttak av berg». Legg det i `KAPITTEL_DATA_F` i normens rekkefølge
(FB, FD, FH, FS …).

**Tomt kildekapittel slettes (Kenneth 2026-09-19):** etter omkodingen, i samme transaksjon, slettes kildekapittelet
**bare hvis det ikke har flere maler**: `DELETE FROM bibliotek_kapitler WHERE id = <kildekapittel> AND NOT EXISTS
(SELECT 1 FROM bibliotek_maler WHERE kapittel_id = <kildekapittel>)`. `FC` fjernes fra `KAPITTEL_DATA_F`.
Lag dette som generell `--fra`-logikk (gjelder også FE senere); for FB og FD blir det en no-op fordi de har maler igjen.

## 4. Malen

```
kapittelKode: "FH"
referanse:    "FH1"
navn:         "FH1 – Sprengning i dagen"
beskrivelse:  "Sprengning i dagen — planer, varsling, boring og lading, vibrasjoner, endelig flate og salverapport. Faglig grunnlag: NS 3420-F:2024, post FH1."
```

Eksporter som `FH1_MAL` og bruk den i F-arrayet der FC1-blokken står i dag.

### Kontroll FØR utførelse

**1. Sprengningsplan og risikovurdering er skriftlige** — `trafikklys`

> Sprengningsplanen og risikovurderingen skal være skriftlige før sprengningsarbeidet starter, og tas vare på i minst 3 år etter at arbeidet er ferdig.

**2. Salveplan** — `valg`
- Skriftlig salveplan foreligger
- Mangler – ikke lad

> Hver salve skal ha skriftlig salveplan i god tid før den skytes, i tråd med sprengningsplanen.

**3. Varsling, sperring og dekking** — `valg`
- Berørte varslet, område sperret, salven dekket
- Mangler – ikke skyt

> Naboer og berørte er varslet, området er sperret og skiltet med vakter på plass, og salven er dekket etter planen.

**4. Vibrasjonsmåling** — `valg`
- Målere satt ut etter plan
- Ikke krav i beskrivelsen
- Mangler – ikke skyt

> Grenseverdiene for vibrasjon, støy og støv står i beskrivelsen. Plasser målerne slik planen sier før salven skytes.

### Kontroll UNDER utførelse

**5. Boring i endelig flate** — `valg`
- Ansett innenfor 100 mm og retning innenfor 2 %
- Ikke endelig flate i denne salven
- Avvik

> Ingen hull skal settes an innenfor den endelige flaten. Ansettet skal ligge innenfor 100 mm fra planlagt punkt, og retningen kan avvike høyst 2 % per pall.

**6. Redusert ladning i endelig flate** — `trafikklys`

> Hullene i endelig flate, og ved behov raden innenfor, lades med redusert ladning tilpasset hullavstand og berg, så flaten ikke svekkes unødig.

### Kontroll ETTER utførelse

**7. Vibrasjon, støy og støv** — `valg`
- Innenfor grenseverdiene
- Ikke krav – ikke målt
- Over grenseverdi – stopp og meld

> Les av målerne etter hver salve. Over grenseverdien: stopp, meld fra og vurder salveplanen før neste salve.

**8. Skutt ut nok i bunnen** — `valg`
- OK – ikke berg over såle
- Gjenstående berg – pigges eller skytes

> Kontroller etter hver salve. Det skal ikke stå igjen berg over prosjektert nivå i sålen.

**9. Endelig flate** — `valg`
- Innenfor toleranseklassen i beskrivelsen
- Knøler utenfor klassen – fjernes
- Avvik

> Toleranseklassen står i beskrivelsen: klasse 0 tillater ingen knøler innenfor endelig flate, klasse 1 enkeltknøler på høyst 0,15 m, klasse 2 høyst 0,5 m, klasse 3 har ingen krav.

**10. Avstand fra skjæring til konstruksjon** — `valg`
- Oppfyller minsteavstanden
- Ikke aktuelt
- For smalt – avvik

> Betongvegg: minst 1,5 m fra skjæringen når den er inntil 8 m høy, ellers 2,0 m. Fundament: minst 1,0 m når fundamentet er inntil 1,0 m høyt, ellers 1,5 m. Beskrivelsen kan kreve mer.

**11. Udetonert sprengstoff** — `valg`
- Kontrollert – ingen funnet
- Funnet – håndtert etter rutine

> Der det er sprengt før, kan det ligge igjen sprengstoff som ikke har gått av. Kontroller før pigging, rensk og opplasting.

**12. Salverapport er skriftlig** — `trafikklys`

> Rapporten viser boring, lading, tenning, dekking og målinger for salven, vurderer hvordan den gikk, og beskriver avvik og hvordan de ble håndtert.

**Helpers:** `valg`, `trafikklys`. Ingen tallfelt, ingen hardkodet JSON.

**Utgår fra FC1:** grenseverdiene 20/35/70 mm/s og henvisningen til NS 8141 (står ikke i vårt normgrunnlag; grenseverdier
står i beskrivelsen) · profiltoleransene ±100/±150 mm (erstattet av toleranseklassen i 9) · rensk (egen post, FF5) ·
tallfelt for rystelse og profilavvik (§1) · alle hjelpetekster med normkoder.

## 5. Generatoren (obligatorisk)

1. `--fra` sletter tomt kildekapittel etter § 3, i samme transaksjon, etter `UPDATE … referanse`.
2. Utskriften før `COMMIT` viser i tillegg om kildekapittelet finnes (forventet: `FC` borte).
3. **Test:** `FH1 revisjon --fra FC1` gir kapittel-INSERT for `FH`, `UPDATE … referanse` og `DELETE … bibliotek_kapitler`
   med `NOT EXISTS`-vakt, i den rekkefølgen. Rød først.
4. Guard som før: avbryt hvis `FC1` mangler eller `FH1` finnes.

Lag `fh1-test.sql`. Parse-test mot engangsdatabase og slett den etterpå. **Ikke kjør mot test selv.**

## 6. Rammer

- §7b-sjekk i `fh1-mal.test.ts`: ingen hjelpetekst eller alternativ inneholder `FC1`, `FH1 `, `Tabell F`, `figur F`,
  `NS-EN`, `NS 3420`, `NS 8141` eller `NS 5815`.
- Ingen eksterne NS-referanser i malen → ingen rad i NS-loggen. Kjør NS-sjekken og meld at den er tom.
- Ingen i18n-nøkler. Prod-gaten røres ikke.

## 7. Definition of Done

**Obligatorisk:**
1. Steg 0 meldt.
2. `FH1_MAL` med 12 felt som over, ordrett. `FH` inn og `FC` ut av `KAPITTEL_DATA_F`.
3. `fh1-mal.test.ts`: antall, rekkefølge, typer, faser, navn og §7b-sjekken. Rød først.
4. Generatoren etter § 5, med tester. Rød først.
5. Gate-bygg med gate-tall `unit-mock · unit-ren · integrasjon · e2e`.
6. `fh1-test.sql`, parse-testet. Lever de tre enlinjerne.
7. Diff mot develop: `seed-bibliotek.ts`, `fh1-mal.test.ts`, `generer-mal-sql.ts`, `generer-mal-sql.test.ts`.
   Må du røre en annen fil, meld hvorfor.

Leveranse nederst i `relay/inbox-design.md` + «design har post» til Kenneth. Design forhåndssjekker tekstene, Kenneth
kjører SQL-en, design gater utskriften.

## 8. Neste i Del F (til orientering)

FE1 → FS3 eller FV3 (avklares mot normen; kapittel `FE` slettes da på samme måte).
