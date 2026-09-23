# Ordre: KM2 – Mur av stein i terreng (ny mal)

**Til:** mal-Opus (`~/Documents/Programmering/SiteDoc-mal`) · **Fra:** design · **Dato:** 2026-09-18
**Metode:** MAL-METODE — **§1b først**, deretter §1, §6, §6a og §7b.
**Rekkefølge:** én mal om gangen (MAL-METODE §3). **Start først når KD2 er merget** — denne ordren bruker
`generer-mal-sql.ts` fra KD2, og `KM2_MAL` skal ligge etter `KD2_MAL`. Branch `feat/mal-km2-ny` fra `origin/develop`.
**Gatet av Kenneth 2026-09-18:** avgrensning og feltliste.

---

## 0. Dette er en annen type mal enn KD1 og KD2 — les før du bygger

Normen har **ingen utførelseskrav og ingen toleranser** for murer i terreng (NS 3420-K:2024, normside 114–124: bare
omfang, materialer, mengderegler og hva beskrivelsen skal angi). Tillegg A (s. 145–152) gir bare handelsformater og
steinkvaliteter.

Malen er derfor **en kontroll mot prosjektets beskrivelse**: hvert felt spør om muren er utført slik beskrivelsen sier,
på de punktene normen sier at beskrivelsen skal dekke (MAL-METODE §1: der kravene er prosjektspesifikke, peker
hjelpeteksten til beskrivelsen). **Ingen tall i hjelpetekstene, og ingen tallfelt.** Legg ikke inn tall fra egen
kunnskap — malen skal ikke påstå krav som ikke finnes i normen.

## 1. Normfakta — egen sammenstilling

- **Hva som er mur (s. 114):** mur med flere elementer i høyden, og mur av ett element i høyden med vishøyde over
  300 mm. Lavere vishøyde med ett element er kant (KD2).
- **Typer (s. 118–122):** ensidig mur (visflate på én side) og tosidig mur (visflater på to sider, med kjerne). Hver kan
  være tørrmur eller murt mur; i tillegg ett-skifts mur og tosidig mur av gjennomgående elementer.
- **Materialer (s. 115):** naturstein, betong, imitert stein, tegl, kalksandstein, lettklinkerbetong, porebetong.
- **Egne poster, ikke del av muren (s. 119, 121):** fundament av løsmasser, filterlag, drensledning, bakfylling mot
  terreng, avdekning på topp.
- **Det beskrivelsen skal angi (s. 115–116):** helningsgrad eller tverrsnitt (evt. tegning) · kjernefyll for tosidige
  murer · drenshull · bindere, armering eller forankring · bindemiddel · fuger (tetting, bredde, materiale) ·
  toleransekrav for synlig flate og fuger · mønster og linjeføring.

## 2. Avgrensning (gatet av Kenneth)

**Med:** ensidige og tosidige murer i terreng — tørrmur, murt mur og ett-skifts mur — av naturstein, betongstein eller
imitert stein (KM2.2 og KM2.3).
**Ute:** gabioner/steinkurver (KM2.4, egen liten mal senere) · stålmurer (KM2.5) · avdekning (KM4) · forblending (KM5) ·
erosjonssikring (KM6) · referansefelt (KM1) · plasstøpt betongmur (Del L).

## 3. Malen

```
kapittelKode: "KM"
referanse:    "KM2"
navn:         "KM2 – Mur av stein i terreng"
beskrivelse:  "Ensidig og tosidig mur, tørrmur og murt mur — fundament, oppbygging og fuger kontrollert mot beskrivelsen. Faglig grunnlag: NS 3420-K:2024, post KM2."
```

**Nytt kapittel:** `KM` finnes ikke i biblioteket i dag (seeden har KA, KB, KC, KD). Legg det til i `kapittelData`:
`{ kode: "KM", navn: "Murer i terreng", sortering: 5 }`. Seeden oppretter kun (`finnEllerOpprettKapittel`).

Eksporter som `KM2_MAL` og legg den etter `KD2_MAL`. `verifisert: false` arves.

### Kontroll FØR utførelse

**1. Murtype** — `valg`
- Ensidig tørrmur
- Ensidig murt mur
- Tosidig tørrmur
- Tosidig murt mur
- Ett-skifts mur
- Annet – se beskrivelsen

> Ensidig mur har visflate på én side, tosidig på begge sider med kjerne mellom. Ett-skifts mur har ett element i høyden og vishøyde over 300 mm — lavere enn det er en kant, ikke en mur.

**2. Materiale** — `valg`
- Naturstein
- Betongstein
- Imitert stein
- Annet – se beskrivelsen

> Kontroller steinen mot materialspesifikasjonen i beskrivelsen: bergart eller type, utseende, dimensjon og bearbeiding av visflaten. Ta bilde av leveransen.

**3. Fundament, filterlag og drenering på plass** — `trafikklys`

> Fundament, filterlag og drensledning er egne poster, men muren skal ikke settes før de er ferdige og slik beskrivelsen angir. Ta bilde før muringen starter — etterpå er det ikke synlig.

### Kontroll UNDER utførelse

**4. Helning og tverrsnitt iht. beskrivelsen** — `trafikklys`

> Kontroller helningen og tverrsnittet mot beskrivelsen eller tegningen. Ved avvik: noter hva som er målt og hvor i kommentaren.

**5. Bindere, forankring eller armering** — `valg`
- OK – iht. beskrivelsen
- Ikke krevd i beskrivelsen
- Avvik

> Kontroller type, plassering og antall mot beskrivelsen. Ta bilde før de dekkes.

**6. Kjernefyll** — `valg`
- OK – iht. beskrivelsen
- Ikke aktuelt – ensidig mur
- Avvik

> Gjelder tosidig mur. Kontroller at kjernen er fylt med materialet beskrivelsen angir.

**7. Drenshull** — `valg`
- OK – iht. beskrivelsen
- Ikke krevd i beskrivelsen
- Avvik

> Kontroller plassering og antall mot beskrivelsen, og at hullene er åpne.

### Kontroll ETTER utførelse

**8. Ligge- og stussfuger iht. beskrivelsen** — `trafikklys`

> Kontroller tetting, bredde og materiale i fugene mot beskrivelsen. Ved avvik: noter sted og hva som avviker.

**9. Linjeføring, mønster og toleranser iht. beskrivelsen** — `trafikklys`

> Toleransene for mur står i beskrivelsen, ikke som faste tall. Kontroller synlig flate, linjeføring og mønster mot dem. Ved avvik: noter største måling og sted.

**10. Krav oppfylt og dokumentasjon levert** — `trafikklys`

> Muren er utført slik beskrivelsen angir og er klar for overlevering. Ta bilde av ferdig mur.

**Helpers:** `valg`, `trafikklys`. Ingen tallfelt. Ingen hardkodet JSON.

## 4. Generatoren — én utvidelse

`generer-mal-sql.ts` fra KD2 slår opp kapittelet på kode. `KM` finnes ikke på test. Utvid modus `ny`: **finnes ikke
kapittelet, opprettes det i samme transaksjon** (under standarden NS3420-K, med kode, navn og sortering fra
`kapittelData`). Finnes det, gjenbrukes det. Legg til et testtilfelle for begge.

## 5. Rammer

- §7b-sjekken i testen: ingen hjelpetekst inneholder `Tabell K`, `KM2 c`, `NS-EN`, eller et tall med `mm`, `%` eller
  `cm` (denne malen skal ikke ha normtall).
- Ingen eksterne NS-referanser → ingen rad i NS-loggen. Kjør sjekken og meld at den er tom.
- Ingen i18n-nøkler. Seeden oppretter kun. Prod-gaten røres ikke.

## 6. Definition of Done

**Obligatorisk:**
1. `KM2_MAL` og kapittel `KM` i `seed-bibliotek.ts`, feltene ordrett som over.
2. `km2-mal.test.ts`: antall, rekkefølge, typer (6× enkeltvalg eller trafikklys som over, ingen tallfelt), faser, navn,
   §7b-sjekken. Rød først.
3. Generator-utvidelsen med test for kapittel som finnes og som ikke finnes. Rød først.
4. Gate-bygg med gate-tall `unit-mock · unit-ren · integrasjon · e2e`.
5. `km2-test.sql` (modus `ny`), parse-testet mot engangsdatabase. Lever de tre enlinjerne. **Ikke kjør mot test.**
6. Diff mot develop: `seed-bibliotek.ts`, `km2-mal.test.ts`, `generer-mal-sql.ts`, `generer-mal-sql.test.ts`.

**Valgfritt:** ingenting.

Kenneth kjører SQL-en og limer utskriften til design. Design svarer «Designgatet – klar for merge» eller «Avvik: …».
