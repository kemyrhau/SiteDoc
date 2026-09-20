# Ordre: FF1 – Avretting (ny mal)

**Til:** mal-Opus · **Fra:** design · **Dato:** 2026-09-20
**Metode:** MAL-METODE §1b, §1, §6a, §7b, §8 og §8b.
**Runde D** — bygges sammen med `ordre-jh2-ny-mal-design-2026-09-20.md` i **én branch**: `feat/mal-runde-d` fra
`origin/develop` **etter at runde C (`feat/mal-runde-c` @ `aec7688f`) er merget.**
**Gatet av Kenneth 2026-09-20:** avgrensning og feltliste.

Nytt kapittel `FF` i `NS3420-F`. De andre F-malene peker hit («krever avretting», «strengere krav løses med egen
avretting») — etter denne finnes sjekklisten de peker på.

---

## 1. Normfakta — egen sammenstilling (NS 3420-F:2024, normside 84–88; PDF-side = normside + 12)

Egne ord per valg i malen (§7b). Normsidene står for gatens skyld; de skal ikke inn i malen.

**Planhet (s. 84):** planhetsavvik måles langs en rett linje mellom to punkter med 3 meters avstand.

**Krav velges i beskrivelsen (s. 84–85):**

| Hva | Valgene normen gir |
|---|---|
| Tillatt høydeavvik | ±10 mm · ±20 mm · ±50 mm · +0 til 20 mm · +0 til 50 mm · +20 til 0 mm |
| Tillatt planhetsavvik | ±10 mm · ±20 mm · ±30 mm · ±40 mm · ±50 mm |

**Flater som avrettes (s. 84):** utlagte masser · utgravd flate · traubunn · forsterkningslag · bærelag · grusdekke ·
bunn i grøft · fundament i grøft.

**Metode (s. 86–88):**
- Uten tilføring: avrettes med massene som ligger der. Overskuddsmasser fjernes, og laget etterkomprimeres til slutt.
- Med tilføring: fraksjonen tilpasses underlaget, og det etterkomprimeres med normal komprimering.
- Ved fjerning: masse tas av, for eksempel ved høvling.
- Det bør vurderes om kravet er mulig å nå med den største steinen som ligger i underlaget. Massene endrer seg ved
  komprimering.

**Kontroll av underlaget (s. 85–86):** kan bestilles som egen kontroll av nivå, av nivå, jevnhet og fall, av fasthet
eller av vanninfiltrasjonsevne. All kontroll skal dokumenteres. Rekomprimeres flaten, kontrolleres den etterpå.

## 2. Avgrensning (gatet av Kenneth)

**Med:** avretting med og uten tilføring av masser og ved fjerning (FF1.2–FF1.4), og kontroll av underlaget (FF1.1).
**Ute:** avretting under vann (FF1.5) · arrondering (FF3) · rensk av bergoverflate (FF5).

## 3. Malen

```
kapittelKode: "FF"
referanse:    "FF1"
navn:         "FF1 – Avretting"
beskrivelse:  "Avretting av planum, lag og grøftebunn — metode, masser, høyde, planhet og fall. Faglig grunnlag: NS 3420-F:2024, post FF1."
```

Nytt kapittel i `NS3420-F`: kode `FF`, navn «Avretting og rensk», sortering mellom `FD` og `FH` (FB, FD, FF, FH, FS).
Bruk `--sorter` fra runde C hvis eksisterende kapitler må flyttes for å gi plass — meld hva du flytter.
Eksporter som `FF1_MAL`.

### Kontroll FØR utførelse

**1. Hva avrettes** — `valg`
- Planum eller traubunn
- Forsterkningslag
- Bærelag
- Grusdekke
- Bunn eller fundament i grøft
- Annen flate

> Hvilken flate som avrettes, avgjør hvilke krav beskrivelsen setter til høyde og planhet.

**2. Underlaget kontrollert** — `valg`
- Nivå, jevnhet og fall kontrollert
- Avvik funnet – meldt
- Ikke bestilt som egen kontroll

> Er kontroll av underlaget bestilt, skal den dokumenteres. Rekomprimeres flaten, kontrolleres den på nytt etterpå.

**3. Metode** — `valg`
- Uten tilføring av masser
- Med tilføring av masser
- Ved fjerning av masser

> Uten tilføring brukes massene som ligger der. Vurder om kravet er mulig å nå med den største steinen i underlaget — hvis ikke, skal det tilføres masser.

### Kontroll UNDER utførelse

**4. Masser til avretting** — `valg`
- Fraksjon tilpasset underlaget
- Ikke aktuelt – avrettes uten tilføring
- Avvik

> Ved tilføring skal fraksjonen passe til underlaget og til kravet som skal nås. Husk at massene endrer seg ved komprimering.

**5. Overskuddsmasser fjernet** — `trafikklys`

> Masser som blir til overs ved avrettingen, er fjernet fra flaten.

**6. Etterkomprimering** — `valg`
- Utført
- Ikke krav
- Avvik

> Avrettingen avsluttes med komprimering slik beskrivelsen angir.

### Kontroll ETTER utførelse

**7. Høyde** — `valg`
- Innenfor kravet i beskrivelsen
- Utenfor – rettes

> Beskrivelsen velger kravet: ±10 mm, ±20 mm, ±50 mm, +0 til 20 mm, +0 til 50 mm eller +20 til 0 mm. Noter største avvik i kommentaren.

**8. Planhet** — `valg`
- Innenfor kravet i beskrivelsen
- Utenfor – rettes

> Mål langs en rett linje mellom to punkter som ligger 3 m fra hverandre. Beskrivelsen velger kravet, fra ±10 mm til ±50 mm.

**9. Fall og avrenning** — `valg`
- Fall som prosjektert
- Ikke krav til fall
- Vannlommer – rettes

> Kontroller at vannet renner dit det skal, og at det ikke blir stående igjen på flaten.

**10. Flaten er godkjent for neste lag** — `trafikklys`

> Flaten oppfyller kravene over og kan bygges videre på. Ta bilde.

**Helpers:** `valg`, `trafikklys`. Ingen tallfelt, ingen hardkodet JSON.

## 4. Rammer og DoD (gjelder hele runde D)

- §7b-sjekk i `ff1-mal.test.ts`: ingen hjelpetekst eller alternativ inneholder `FF1 `, `Tabell F`, `figur F`, `NS-EN`,
  `NS 3420` eller `NS 3458`.
- Ingen eksterne NS-referanser i malene → ingen rad i NS-loggen. Kjør NS-sjekken og meld at den er tom.
- Fasiten (§8) oppdateres i samme branch. Lokal utskrift (`skriv-mal FF1 JH2`) limes i leveransen.
- Gate-bygg med gate-tall (`pnpm exec turbo run test --force`). Diff: `seed-bibliotek.ts`, `ff1-mal.test.ts`,
  `jh2-mal.test.ts`, `mal-fasit.snap.md`, og generator bare hvis noe mangler — meld i så fall.
- Ingen i18n-nøkler. Prod-gaten røres ikke.

## 5. SQL

`generer-mal-sql.ts FF1 JH2 ny` → én fil, én transaksjon. **JH2 krever ny standard `NS3420-J`** (se JH2-ordren) — den
opprettes av generatorens standard-logikk fra runde B. Lag `runde-d-test.sql`, parse-test mot engangsdatabase, slett
den etterpå, og lever de tre enlinjerne. **Ikke kjør mot test selv.**
