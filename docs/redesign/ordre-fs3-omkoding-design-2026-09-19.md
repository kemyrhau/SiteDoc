# Ordre: FS3 – Legging og gjenfylling i grøft (omkoding av FE1 + revisjon)

**Til:** mal-Opus (`~/Documents/Programmering/SiteDoc-mal`) · **Fra:** design · **Dato:** 2026-09-19
**Metode:** MAL-METODE §1b, §1, §6a og §7b. Samme mønster som FS2- og FH1-ordrene.
**Branch:** `feat/mal-fs3-omkoding` fra `origin/develop` **etter at FH1 (`feat/mal-fh1-omkoding`) er merget.** FH1 gir
generatoren sletting av tomt kildekapittel, som trengs her.
**Gatet av Kenneth 2026-09-19:** FS3 (ikke FV3), feltliste, og at fall og trykkprøve flyttes ut.

Dagens «FE1 – Ledningsgrøfter» ligger i kapittel `FE`, som ikke finnes i normen. Legging og gjenfylling i grøft hører til
FS3. FV3 er en samlepost for prising uten egne krav, så sjekklisten følger FS3. Grøfteløpet blir FD2 (graving) → FS3.

---

## 0. Mål før du bygger (meld i leveransen)

1. `FE1` ligger alene i kapittel `FE`. Kapittel `FS` finnes (fra FS2).
2. Sletting av tomt kildekapittel finnes i `--fra` (fra FH1).

## 1. Normfakta — egen sammenstilling (NS 3420-F:2024, normside 226–237; PDF-side = normside + 12)

Egne ord per valg i malen (§7b). Normsidene står for gatens skyld; de skal ikke inn i malen.

**Fundament (s. 227–229):**

| Hva | Krav |
|---|---|
| Rør: overkant fundament | ±30 mm |
| Rør: vanlig minste tykkelse nedre fundament | 150 mm under DN 400; tykkere for større rør |
| Rør: øvre fundament | komprimeres så røret ikke hever seg |
| Kabel og kabelrør: tykkelse | minst 50 mm |
| Kabel og kabelrør: kornstørrelse | inntil 8 mm (kabel), 16 mm (kabelrør) |

**Sidefylling og beskyttelseslag (s. 227–228):**
- Legges forsiktig, lagvis på begge sider, og pakkes godt rundt ledningen. Ikke tipp rett fra lasteplanet. Røret skal
  ikke skades eller forskyves.
- Lagvis i hele grøftebredden til 0,3 m over øverste ledning.
- Kabel: beskyttelseslag minst 100 mm, kornstørrelse inntil 8 mm. Innstøpte kabelrør og kulverter: minst 100 mm,
  inntil 64 mm.

**Komprimeringsutstyr ved siden av ledningen (s. 228):**

| Rørtype | Største vekt |
|---|---|
| Plastrør og korrugerte stålrør | 60 kg |
| Betong-, stål- og støpejernsrør til og med DN 1000 | 100 kg |
| Betong-, stål- og støpejernsrør over DN 1000 | 200 kg |

**Gjenfylling (s. 226, 228):**
- Stein over 500 mm sorteres ut der fyllingen skal komprimeres. Stedlige masser skal godkjennes av oppdragsgiver.
- Ikke tipp rett fra lasteplanet. Ledningen skal ikke belastes mer enn den er dimensjonert for — anleggsmaskiner kan gi
  flere ganger større last.
- Over kabel: beskyttet kabel tåler masser inntil 120 mm rett over; ubeskyttet kabel skal ha de første 0,20 m med masser
  inntil 45 mm. Ellers inntil 200 mm.

**Beskyttelse og markering (s. 235–237):**
- To eller flere kabler i samme grøft: tett rekke skillestein eller skilleplater mellom kablene.
- Markeringsbånd: minst 40 mm bredt, holdbar og lys kontrastfarge, lagt oppå beskyttelseslaget i senterlinjen for
  øverste ledning.

## 2. Avgrensning (gatet av Kenneth)

**Med:** utlegging i grøft (FS3.1) · beskyttelse av installasjoner (FS3.81) · markering (FS3.82).
**Ute:** graving (FD2) · strømningsavskjæring (FS3.5) · under vann (FS7.3) · ledningsfall og tetthets-/trykkprøving
(rørinstallasjon, Del U — ev. egen mal senere) · tilbakefylling mot kummer og konstruksjoner (FS4).

## 3. Omkoding og kapitler (obligatorisk)

| Felt i `bibliotek_maler` | Før | Etter |
|---|---|---|
| `referanse` | `FE1` | `FS3` |
| kapittel | `FE` | `FS` (finnes) |
| `navn` | FE1 – Ledningsgrøfter | FS3 – Legging og gjenfylling i grøft |

Kapittel `FE` slettes når det er tomt (samme `NOT EXISTS`-vakt som FH1), og fjernes fra `KAPITTEL_DATA_F`.

## 4. Malen

```
kapittelKode: "FS"
referanse:    "FS3"
navn:         "FS3 – Legging og gjenfylling i grøft"
beskrivelse:  "Fundament, sidefylling, beskyttelse, markering og gjenfylling i grøft for rør og kabler. Faglig grunnlag: NS 3420-F:2024, post FS3."
```

Eksporter som `FS3_MAL` og bruk den i F-arrayet der FE1-blokken står i dag.

### Kontroll FØR utførelse

**1. Innhold i grøfta** — `valg`
- Rørledning
- Kabel eller kabelrør
- Kulvert eller kanal
- Flere typer

> Hva som ligger i grøfta, avgjør kravene til fundament, beskyttelseslag og masser.

**2. Grøftebunnen er godkjent** — `trafikklys`

> Bunnen er kontrollert og godkjent i sjekklisten for graving av grøft før fundamentet legges.

**3. Masser** — `valg`
- Riktig masse – vareseddel kontrollert
- Stedlige masser – godkjent av byggherre
- Avvik

> Sjekk vareseddelen mot beskrivelsen. Stedlige masser skal være godkjent av byggherren. Stein over 500 mm sorteres ut der fyllingen skal komprimeres.

### Kontroll UNDER utførelse

**4. Fundament** — `valg`
- Riktig tykkelse, overkant innenfor ±30 mm
- Avvik

> Rør: overkant fundament innenfor ±30 mm. Vanlig minste tykkelse er 150 mm for rør under DN 400, tykkere for større rør — se beskrivelsen. Kabel og kabelrør: minst 50 mm, med masser inntil 8 mm for kabel og 16 mm for kabelrør. Røret skal ikke heve seg når fundamentet komprimeres.

**5. Sidefylling og beskyttelseslag** — `valg`
- Lagvis på begge sider, godt pakket
- Avvik

> Legg massene forsiktig og lagvis på begge sider, og pakk godt rundt ledningen. Ikke tipp rett fra lasteplanet. Fyll i hele grøftebredden til 0,3 m over øverste ledning. Kabel: beskyttelseslag minst 100 mm med masser inntil 8 mm.

**6. Komprimering ved ledningen** — `valg`
- Utstyr innenfor vektgrensen for rørtypen
- Avvik – for tungt utstyr

> Største vekt på komprimeringsutstyr ved siden av ledningen: plastrør og korrugerte stålrør 60 kg, betong-, stål- og støpejernsrør 100 kg (over DN 1000: 200 kg). Røret skal ikke skades eller forskyves.

**7. Innmåling før gjenfylling** — `trafikklys`

> Ledninger og kabler er målt inn før de dekkes til.

**8. Beskyttelse og skille** — `valg`
- Lagt etter beskrivelsen
- Ikke krav
- Mangler

> Varerør, lastfordelingsplater, dekkplater og skillestein legges slik beskrivelsen sier. Ligger to eller flere kabler i samme grøft, skal det være en tett rekke skillestein eller skilleplater mellom dem.

**9. Markeringsbånd** — `valg`
- Lagt midt over øverste ledning
- Ikke krav
- Mangler

> Båndet legges oppå beskyttelseslaget, midt over øverste ledning. Det skal være minst 40 mm bredt og ha en holdbar, lys kontrastfarge.

### Kontroll ETTER utførelse

**10. Gjenfylling** — `valg`
- Lagvis og komprimert etter beskrivelsen
- Avvik

> Fyll lagvis og komprimer slik beskrivelsen angir. Ikke tipp rett fra lasteplanet, og ikke kjør tunge maskiner over ledningen før overdekningen er stor nok. Over ubeskyttet kabel skal de første 0,20 m være masser inntil 45 mm.

**11. Grøfta er ferdig gjenfylt og klar for overlevering** — `trafikklys`

> Grøfta er fylt opp til prosjektert høyde, og ledningene er uskadet. Ta bilde.

**Helpers:** `valg`, `trafikklys`. Ingen tallfelt, ingen hardkodet JSON.

**Utgår fra FE1:** «Eksisterende ledninger påvist» (ligger i FD2) · «Grøfteprofil og fundament» og «Fundament og
sidefylling» (erstattet av 2, 4 og 5) · «Ledningsfall (‰)» (tallfelt, Del U) · «Tetthetsprøve / trykkprøve» (Del U) ·
«Gjenfylling lagvis» og «Varselbånd og merking» som rene trafikklys (erstattet av 9 og 10 med kravene i
alternativer og hjelpetekst — lukker cowork-merknaden om metodekrav i trafikklys) · alle hjelpetekster med normkoder.

## 5. Generatoren

Ingen endring forventet: `FS3 revisjon --fra FE1` bruker målkapittel-opprettelse (no-op, `FS` finnes) og sletting av
tomt kildekapittel fra FH1. Trengs en endring, stopp og meld.

Lag `fs3-test.sql`. Parse-test mot engangsdatabase og slett den etterpå. **Ikke kjør mot test selv.**

## 6. Rammer

- §7b-sjekk i `fs3-mal.test.ts`: ingen hjelpetekst eller alternativ inneholder `FE1`, `FS3 `, `Tabell F`, `figur F`,
  `NS-EN`, `NS 3420`, `NS 3458` eller `NS 3065`.
- Ingen eksterne NS-referanser i malen → ingen rad i NS-loggen. Kjør NS-sjekken og meld at den er tom.
- Ingen i18n-nøkler. Prod-gaten røres ikke.

## 7. Definition of Done

**Obligatorisk:**
1. Steg 0 meldt.
2. `FS3_MAL` med 11 felt som over, ordrett. `FE` ut av `KAPITTEL_DATA_F`.
3. `fs3-mal.test.ts`: antall, rekkefølge, typer, faser, navn og §7b-sjekken. Rød først.
4. Gate-bygg med gate-tall `unit-mock · unit-ren · integrasjon · e2e`.
5. `fs3-test.sql`, parse-testet. Lever de tre enlinjerne.
6. Diff mot develop: `seed-bibliotek.ts`, `fs3-mal.test.ts`. Må du røre en annen fil, meld hvorfor.

Leveranse nederst i `relay/inbox-design.md` + «design har post» til Kenneth. Design forhåndssjekker tekstene, Kenneth
kjører SQL-en, design gater utskriften.

## 8. Etter FS3

Del F-revisjonene er da ferdige. Parkert: FB4 (spunt, mangler normdel) og FD3 (grunnforsterkning, NS 3420-G). Mulig
senere: egen mal for rørinstallasjon (fall, tetthet, trykkprøve — Del U).
