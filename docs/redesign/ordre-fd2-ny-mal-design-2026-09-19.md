# Ordre: FD2 – Graving av grøft (ny mal)

**Til:** mal-Opus (`~/Documents/Programmering/SiteDoc-mal`) · **Fra:** design · **Dato:** 2026-09-19
**Metode:** MAL-METODE §1b, §1, §6a og §7b.
**Branch:** `feat/mal-fd2-ny` fra `origin/develop` **etter at FS2 (`feat/mal-fs2-omkoding` @ `edc176ed`) er merget.**
Uten FS2 i develop ligger den gamle `FD2` (fylling) fortsatt i seed, og referansen kolliderer.
**Gatet av Kenneth 2026-09-19:** avgrensning og feltliste, med tre alternativer i felt 9.

Ny mal i eksisterende kapittel `FD` («Uttak av løsmasser»). Ingen omkoding.

---

## 0. Mål før du bygger (meld i leveransen)

1. `FS2_MAL` finnes i develop, og ingen konstant eller seed-blokk bruker `referanse: "FD2"`.
2. På test er `FD2` fri (FS2-kjøringen 2026-09-19 flyttet den gamle raden). Bekreft ut fra FS2-utskriften, ikke kjør mot
   test.

## 1. Normfakta — egen sammenstilling (NS 3420-F:2024, normside 44–47 og 52–56; PDF-side = normside + 12)

Egne ord per valg i malen (§7b). Normsidene står for gatens skyld; de skal ikke inn i malen.

**Tillatt avvik for ferdig bunn (s. 53):**

| Grøftetype | Bunn |
|---|---|
| Rørgrøft i jord | ±50 mm |
| Rørgrøft i sprengstein | +50 til +100 mm |
| Fundamentgrøft i jord | ±50 mm |
| Fundamentgrøft i sprengstein | ±100 mm |
| Åpen grøft | +50 til +200 mm |
| Andre grøfter | ±100 mm |

Strengere bunnkrav løses med egen avretting etterpå (s. 54).

**Sideavvik (s. 47):** ±150 mm når beskrivelsen ikke sier noe annet.

**Utførelse (s. 44, 53, 56):**
- Gravingen skal ikke svekke stabiliteten, blande masser eller skade ledninger, kabler, konstruksjoner og røtter til trær
  som skal stå.
- Graves ledningsgrøft i fylling, skal fyllingen være lagt ut og komprimert til minst 0,5 m over øverste ledning først.
- Ledninger og kabler som blir avdekket, skal sikres.
- Grøften bør ikke være bredere enn nødvendig, så røret får støtte fra sidene.
- Grøftekasser trekkes eller løftes seksjonsvis, så massene rundt installasjonene ikke forstyrres.

## 2. Avgrensning (gatet av Kenneth)

**Med:** graving av grøft for rør, kabler og fundament, og åpne grøfter (FD2.1) · avstiving med grøftekasse (FD2.81).
**Ute:** spunt (egen normdel) · grøft under vann (FD5) · legging og gjenfylling (FS3 — egen mal) · sprengning av grøft
(FH1.5) · avretting (FF1).

## 3. Malen

```
kapittelKode: "FD"
referanse:    "FD2"
navn:         "FD2 – Graving av grøft"
beskrivelse:  "Graving av grøft for rør, kabler og fundament — påvisning, avstiving, bunn og toleranser. Faglig grunnlag: NS 3420-F:2024, post FD2."
```

Eksporter som `FD2_MAL` og legg den i F-arrayet rett etter `FD1_MAL`. `verifisert: false` arves. Seeden oppretter kun.

### Kontroll FØR utførelse

**1. Type grøft** — `valg`
- Rørgrøft
- Fundamentgrøft
- Åpen grøft
- Annen grøft

> Typen grøft avgjør hvilken bunntoleranse som gjelder.

**2. Kabler og ledninger påvist** — `valg`
- Påvist og merket i terrenget
- Ingen i området – bekreftet
- Ikke påvist – stopp graving

> Kabler og ledninger skal være påvist og merket før gravingen starter. Ta bilde av merkingen.

**3. Grøft i fylling** — `valg`
- Ikke i fylling
- Fylling komprimert minst 0,5 m over øverste ledning
- Ikke ferdig fylt – vent

> Skal grøften graves i en ny fylling, må fyllingen være lagt ut og komprimert til minst 0,5 m over øverste ledning før du graver.

**4. Utstikking etter tegning** — `trafikklys`

> Trasé og bunnhøyde er stukket ut etter tegningen før gravingen starter.

### Kontroll UNDER utførelse

**5. Skråning og avstiving** — `valg`
- Skråning etter tegning – stabil
- Grøftekasse
- Annen avstiving
- Ustabil – stopp

> Grøfter dypere enn 2 m sikres med avstiving eller forsvarlig skråning. Vurder stabiliteten uansett dybde, og på nytt etter nedbør. Grøftekasser trekkes eller løftes seksjonsvis, så massene rundt ledningen ikke forstyrres.

**6. Vannhåndtering** — `valg`
- Tørt – ingen tiltak
- Lensing/pumpe etablert – kontrollert
- Drenering/avskjæringsgrøft etablert
- Vanninntrengning – ustabil skråningsfot – stopp

> Vann i grøfta graver ut skråningsfoten. Kontroller ved hver arbeidsstart og etter nedbør. Pump ut vannet før noen går ned.

**7. Avdekkede ledninger og kabler** — `valg`
- Ingen avdekket
- Avdekket og sikret
- Skadet – meldt

> Ledninger og kabler som blir avdekket under gravingen, skal sikres. Skader meldes straks til eieren.

**8. Grøftebredden er ikke større enn nødvendig** — `trafikklys`

> En smal grøft gir røret støtte fra sidene. Grav ikke bredere enn tegningen og arbeidet krever.

### Kontroll ETTER utførelse

**9. Bunnhøyde** — `valg`
- Innenfor toleransen for grøftetypen
- Krav i beskrivelsen – oppfylt
- Utenfor – krever avretting

> Tillatt avvik i bunnen: rørgrøft i jord ±50 mm, rørgrøft i sprengstein +50 til +100 mm, fundamentgrøft i jord ±50 mm, fundamentgrøft i sprengstein ±100 mm, åpen grøft +50 til +200 mm, andre grøfter ±100 mm. Står det strengere krav i beskrivelsen, gjelder de. Noter største avvik i kommentaren.

**10. Sideavvik** — `valg`
- Innenfor ±150 mm
- Utenfor – avvik

> Kontroller grøftekanten mot utstikkingen. Tillatt sideavvik er ±150 mm når beskrivelsen ikke sier noe annet.

**11. Bunnen er ren og klar for ledning eller fundament** — `trafikklys`

> Bunnen er fri for løse masser, ikke forstyrret eller frossen, og godkjent før ledning eller fundament legges. Ta bilde.

**12. Grøften er sikret** — `trafikklys`

> Åpen grøft er sperret og skiltet, og sikret mot overvann og ras ved nedbør.

**Helpers:** `valg`, `trafikklys`. Ingen tallfelt, ingen hardkodet JSON.

## 4. SQL

Generatoren i modus `ny`: `pnpm --filter @sitedoc/db exec tsx prisma/generer-mal-sql.ts FD2 ny`. Kapittel `FD` finnes;
kapittelblokken er no-op. Ingen generatorendring forventes — trengs en, stopp og meld.

Lag `fd2-test.sql`. Parse-test mot engangsdatabase og slett den etterpå. **Ikke kjør mot test selv.**

## 5. Rammer

- §7b-sjekk i `fd2-mal.test.ts`: ingen hjelpetekst eller alternativ inneholder `FD2 `, `Tabell F`, `figur F`, `NS-EN`,
  `NS 3420` eller `NS 3070`.
- Ingen eksterne NS-referanser i malen → ingen rad i NS-loggen. Kjør NS-sjekken og meld at den er tom.
- Ingen i18n-nøkler. Prod-gaten røres ikke.

## 6. Definition of Done

**Obligatorisk:**
1. Steg 0 meldt.
2. `FD2_MAL` med 12 felt som over, ordrett.
3. `fd2-mal.test.ts`: antall, rekkefølge, typer, faser, navn og §7b-sjekken. Rød først.
4. Gate-bygg med gate-tall `unit-mock · unit-ren · integrasjon · e2e`.
5. `fd2-test.sql` (modus `ny`), parse-testet. Lever de tre enlinjerne.
6. Diff mot develop: `seed-bibliotek.ts`, `fd2-mal.test.ts`. Må du røre en annen fil, meld hvorfor.

Leveranse nederst i `relay/inbox-design.md` + «design har post» til Kenneth. Design forhåndssjekker tekstene, Kenneth
kjører SQL-en, design gater utskriften.

## 7. Neste i Del F (til orientering)

FC1 → FH1 (sprengning) · FE1 → FS3 eller FV3 (avklares mot normen).
