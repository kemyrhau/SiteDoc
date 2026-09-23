# Ordre: UM1 – Legging av VA-ledninger (ny mal, ny standard NS 3420-U)

**Til:** mal-Opus (`~/Documents/Programmering/SiteDoc-mal`) · **Fra:** design · **Dato:** 2026-09-19
**Metode:** MAL-METODE §1b, §1, §6a og §7b.
**Branch:** `feat/mal-um1-ny` fra `origin/develop` **etter at FS3 (`feat/mal-fs3-omkoding`) er merget.** Én mal om gangen.
**Gatet av Kenneth 2026-09-19:** legging og prøving som to maler (UM1 og UU1), og feltlista under. Kenneth: prøving
utføres ofte av andre enn dem som legger — derfor egen prøvemal (UU1) senere.

Første mal fra NS 3420-U. Grøfteløpet blir FD2 (graving) → **UM1 (legging)** → FS3 (omfylling og gjenfylling) →
UU1 (prøving).

---

## 0. Mål før du bygger (meld i leveransen)

1. Hvordan seeden oppretter standardene i dag (`NS3420-K`, `NS3420-F`: upsert med `update: {}`) og hvordan generatoren
   finner standard per mal (`KAPITTEL_DATA_K/F`).
2. Hva som mangler for en tredje standard: standard-rad, `KAPITTEL_DATA_U`, F-/K-lignende array i seed, og at
   generatoren oppretter standarden hvis den mangler (i dag oppretter den bare kapittel).

## 1. Normfakta — egen sammenstilling (NS 3420-U:2019, normside 249–253; PDF-side = normside + 14)

Egne ord per valg i malen (§7b). Normsidene står for gatens skyld; de skal ikke inn i malen.

**Rørmateriell (s. 249–250):**
- Rør og deler gjøres rene inn- og utvendig før montering. Plastrør som tåler dårlig varme og sol, skjermes ved lagring.
- PE: utvendige riper maks 10 % av veggtykkelsen (dypere: kapp ut eller reparer). Ingen innvendige riper.

**Før legging (s. 251):**
- Grøftebunnen fri for tele, snø og is.
- Øverste tredjedel av fundamentet løsnes i en bredde på minst halve rørdiameteren langs senterlinjen.
- Muffegroper: grav ut så røret hviler på fundamentet, ikke på muffene.

**Skjøting (s. 250–251):**
- Rør sentreres; skjøtekraften virker langs røret. Lagte rør som brukes som mothold, støttes og forankres.
- PE-sveis: beskyttet mot støv og nedbør, ikke under 0 °C uten oppvarmet telt, rørender tildekket mot trekk. Ovalitet
  kontrolleres og rettes med rundingsverktøy. Skraping med godkjent verktøy — ikke for hånd.
- Sveisene føres i eget skjema med parametre og signatur; hver skjøt merkes med sveiserens ID.
- Klemringskobling på PE: støttehylse innvendig. Flensskjøter ettertrekkes.

**Legging i grøft (s. 251):**
- Ingen skolinger. Slam, jord og fremmedlegemer skal ikke komme inn i ledningen, heller ikke ved opphold.
- Minst 100 mm fra kumvegg og fra forbigående ledninger og kabler; ellers tiltak mot direkte kontakt.
- Flere ledninger i ulike plan: den nederste omfylles og komprimeres opp til underkant av den neste før den legges.

**Toleranser for plassering (s. 253)** — gjelder hvert rør og hele strekningen:

| Hva | Krav |
|---|---|
| Høyde | ±30 mm |
| Side | ±100 mm |
| Fall under 10 ‰ | ±2 ‰ |
| Fall 10–20 ‰ | ±3 ‰ |
| Fall over 20 ‰ | ±5 ‰ |

## 2. Avgrensning (gatet av Kenneth)

**Med:** legging og skjøting av utendørs vann-, avløps- og drensledninger i grøft (UM1).
**Ute:** prøving, inspeksjon og deformasjonskontroll (UU1 — egen mal, ofte andre utførende) · legging i vann ·
kummer (UP) · ventiler og utstyr (UO) · omfylling og gjenfylling (FS3) · innmåling (ligger i FS3).

## 3. Ny standard og kapittel (obligatorisk)

| Hva | Verdi |
|---|---|
| Standard | kode `NS3420-U`, navn «NS 3420-U:2019 Rørinstallasjoner», sortering 3 |
| Kapittel | kode `UM`, navn «Utendørs rørledninger» |

I seed: samme mønster som F (upsert med `update: {}`, `KAPITTEL_DATA_U`, eget array). I generatoren: modus `ny`
oppretter standarden hvis den mangler (WHERE NOT EXISTS), deretter kapittelet, deretter malen — i samme transaksjon.

## 4. Malen

```
kapittelKode: "UM"
referanse:    "UM1"
navn:         "UM1 – Legging av VA-ledninger"
beskrivelse:  "Legging og skjøting av vann-, avløps- og drensledninger i grøft — rørmateriell, fundament, skjøter, fall og plassering. Faglig grunnlag: NS 3420-U:2019, post UM1."
```

Eksporter som `UM1_MAL`.

### Kontroll FØR utførelse

**1. Type ledning** — `valg`
- Vannledning
- Avløp, selvfall
- Avløp, trykk
- Drensledning
- Annen ledning

> Typen ledning avgjør skjøtemetode og hvilken prøving som skal gjøres etterpå.

**2. Rør og deler kontrollert** — `valg`
- Rene og uskadde
- Skadet – kassert eller reparert

> Rør og deler skal være rene inn- og utvendig før montering. Plastrør lagres skjermet mot sol og varme. PE-rør: utvendige riper høyst 10 % av veggtykkelsen, ingen innvendige riper. Dypere skader kappes ut eller repareres.

**3. Grøftebunn og fundament klare** — `trafikklys`

> Bunnen er fri for tele, snø og is. Øverste tredjedel av fundamentet er løsnet langs senterlinjen, minst en halv rørdiameter bredt. Grav ut for muffene så røret hviler på fundamentet.

### Kontroll UNDER utførelse

**4. Skjøting** — `valg`
- Muffe
- PE-sveis
- Flens eller kobling
- Avvik

> Rørene sentreres, og skjøtekraften skal virke langs røret. Rør som brukes som mothold, støttes så de ikke forskyves. Flensskjøter ettertrekkes. Klemringskobling på PE-rør skal ha støttehylse innvendig.

**5. Sveiselogg for PE** — `valg`
- Ført og signert, skjøter merket
- Ikke PE-sveis
- Mangler

> Sveis beskyttet mot støv og nedbør, og ikke under 0 °C uten oppvarmet telt. Skrap med godkjent verktøy, ikke for hånd. Før hver sveis i skjemaet med parametre og signatur, og merk skjøten med sveiserens ID.

**6. Røret hviler på fundamentet, ingen skolinger** — `trafikklys`

> Røret skal ligge jevnt på fundamentet hele veien og ikke på klosser eller steiner.

**7. Ledningen holdt ren innvendig** — `trafikklys`

> Slam, jord og fremmedlegemer skal ikke komme inn i ledningen. Tett åpne ender når arbeidet stopper.

**8. Avstand til kum og andre ledninger** — `valg`
- Minst 100 mm
- Tiltak mot kontakt utført
- Avvik

> Minst 100 mm fra kumvegg og fra ledninger og kabler som krysser eller går forbi. Ligger ledningene i flere lag, omfylles og komprimeres den nederste opp til neste før den legges.

### Kontroll ETTER utførelse

**9. Plassering i høyde og side** — `valg`
- Innenfor ±30 mm høyde og ±100 mm side
- Avvik

> Kontroller mot prosjektert plassering, både for hvert rør og for hele strekningen. Noter største avvik i kommentaren.

**10. Fall** — `valg`
- Innenfor toleransen for prosjektert fall
- Avvik

> Tillatt avvik: ±2 ‰ når fallet er under 10 ‰, ±3 ‰ ved 10–20 ‰, og ±5 ‰ når fallet er over 20 ‰. Gjelder hvert rør og hele strekningen.

**11. Ledningen er klar for omfylling** — `trafikklys`

> Ledningen er lagt, skjøtt og kontrollert og kan omfylles. Ta bilde før den dekkes til.

**Helpers:** `valg`, `trafikklys`. Ingen tallfelt, ingen hardkodet JSON.

## 5. SQL

`generer-mal-sql.ts UM1 ny`. Standard `NS3420-U` og kapittel `UM` opprettes (WHERE NOT EXISTS) før malen. Lag
`um1-test.sql`, parse-test mot engangsdatabase og slett den etterpå. **Ikke kjør mot test selv.**

Test i `generer-mal-sql.test.ts`: `UM1 ny` gir standard-INSERT før kapittel-INSERT før mal-INSERT; en K- og en F-mal
gir ingen standard-INSERT (eller no-op — meld hvilket). Rød først.

## 6. Rammer

- §7b-sjekk i `um1-mal.test.ts`: ingen hjelpetekst eller alternativ inneholder `UM1 `, `Tabell U`, `figur U`,
  `NS-EN`, `NS 3420`, `CEN/TR` eller `VA/Miljø`.
- Ingen eksterne NS-referanser i malen → ingen rad i NS-loggen. Kjør NS-sjekken og meld at den er tom.
- Ingen i18n-nøkler. Prod-gaten røres ikke.
- Hvis UI-et (biblioteksvisningen) antar bare to standarder et sted, stopp og meld — ikke rett UI i denne ordren.

## 7. Definition of Done

**Obligatorisk:**
1. Steg 0 meldt.
2. Standard U + kapittel UM i seed, `UM1_MAL` med 11 felt som over, ordrett.
3. `um1-mal.test.ts`: antall, rekkefølge, typer, faser, navn og §7b-sjekken. Rød først.
4. Generatoren oppretter manglende standard, med test. Rød først.
5. Gate-bygg med gate-tall `unit-mock · unit-ren · integrasjon · e2e`.
6. `um1-test.sql`, parse-testet. Lever de tre enlinjerne.
7. Diff mot develop: `seed-bibliotek.ts`, `um1-mal.test.ts`, `generer-mal-sql.ts`, `generer-mal-sql.test.ts`.
   Må du røre en annen fil, meld hvorfor.

Leveranse nederst i `relay/inbox-design.md` + «design har post» til Kenneth. Design forhåndssjekker tekstene, Kenneth
kjører SQL-en, design gater utskriften.

## 8. Neste (til orientering)

UU1 – Prøving av VA-ledninger (tetthet, trykk, deformasjon, rapport), kapittel `UU`. Egen ordre etter Kenneths gate.
