# Ordre: ny mal – PE-skjøt, én sjekkliste pr. skjøt

**Til:** mal-Opus · **Fra:** design · **Dato:** 2026-09-22
**Metode:** MAL-METODE §1, §1c, §1e, §6a, §6b, §7b, §8 og §8b.
**Branch:** samme som UM1 v2 — `feat/mal-um1-betinget`. **De to malene bygges sammen**, se § 1.
**Gatet av Kenneth 2026-09-22:** «for PE sveis eller PE sveisemuffer → en sjekkliste pr skjøt» og «skillet går på
vannledning og spillvannsledning i tillegg til pel nummer».

---

## 1. Hvorfor — og hvorfor den hører sammen med UM1

UM1 v1 har feltet «Sveiselogg for PE — ført og signert». **Ett svar for en strekning som kan ha tjue skjøter.** Det er
ikke en sveiselogg; det er en påstand om at det finnes en et annet sted.

Kenneths vedtak: **én sjekkliste pr. skjøt.** Da får hver skjøt sin egen signatur, sine egne parametre og sitt eget
bilde — som er hele grunnen til at en sveiselogg finnes.

Det følger samme regel som kummene: **dokumentets enhet er den enheten som skal kunne finnes igjen.** For en kum er det
kummen, for en strekning er det strekningen, for en sveis er det skjøten.

🔴 **UM1 felt 9 er endret i samme runde** til «Sveiseskjøter dokumentert — alle skjøter har egen sjekkliste». Det feltet
peker på denne malen. **Merges den ene uten den andre, peker UM1 på noe som ikke finnes.** Begge ordrene ligger på samme
branch og skal bygges i samme leveranse.

## 2. Emnefeltet — ledningstype og pelnummer

Kenneth 2026-09-22: sveisemuffer merkes med **P-nummer**, altså **pelnummer**, og skillet går på **vannledning og
spillvannsledning i tillegg til pelnummeret**.

**Emnet blir derfor `VL P120`, `SP P340`, `OV P95`** — ledningstype og pel. Forkortelsene er de samme som for kummene
(VL vannledning, SP spillvann, OV overvann, AF avløp felles), så VA-sporet har én konvensjon.

🔴 **Skrivemåten er «pel», ikke «pæl».** Kenneth tok den selv: «jeg tror det skrives Pel». Det er riktig, og forskjellen
er reell i faget — **pel** er merkestaven og posisjonen langs traseen, **pæl** er en fundamenteringspæl. Står det «pæl
120» i et byggedokument, sier dokumentet at det finnes en fundamenteringspæl der. **Ordet «pæl» skal ikke forekomme i
malen.**

**Hvorfor pel og ikke et løpenummer:** «skjøt 3» er en telling som mister betydning så snart noen legger inn en skjøt
til. Et pelnummer er en innmålt posisjon som står i tegningen for alltid. Og fordi ledningstypen står foran, kolliderer
ikke to skjøter som ligger ved samme pel i samme grøft.

## 3. Referansen må slås opp i normen FØR malen opprettes

Design har ikke NS 3420-U:2019 i sitt tre — **du har den.** Malen kan ikke opprettes før dette er svart, fordi en feil
referanse gir en feil bibliotekrad som må rettes med lån-bevaring etterpå:

1. **Hvilken post dekker skjøting av PE-rør?** Ligger det under UM1 (legging), eller har skjøting sin egen post?
2. **Hvilket kapittel og hvilken referanse skal malen ha?** Trengs et nytt kapittel, eller finnes det?
3. **Hva kaller normen metodene?** Designs arbeidstitler er *elektromuffesveis* og *speilsveis*. Bruker normen andre
   ord, er normens ord riktigere — men Kenneths ord går foran normens hvis de spriker, og han sa «PE sveisemuffer».

**Meld svaret før du bygger.** Design gater referansen.

## 4. Malen

```
navn:        "PE-skjøt – sveising av PE-rør"
beskrivelse: "Sveising av skjøt på PE-rør — metode, forberedelse, parametre, avkjøling, visuell kontroll og merking. Én sjekkliste pr. skjøt. Faglig grunnlag: NS 3420-U:2019, post <fastsettes av § 3>."
```

**Alle felt er `valg` eller `trafikklys` — ingen tallfelt (§1).** Parametre og verdier hører i sveiseprotokollen og i
kommentaren, ikke som tallfelt i sjekklisten.

### Kontroll FØR utførelse

**1. Sveisemetode** — `valg` · **forelder for felt 4 og 8**
- Elektromuffe (sveisemuffe)
- Speilsveis
- Annen metode – se beskrivelsen

> Skriv ledningen og pelnummeret i emnefeltet: VL P120 for vannledning, SP P340 for spillvann, OV P95 for overvann. Det er slik skjøten finnes igjen senere, og slik to skjøter ved samme pel holdes fra hverandre. Én sjekkliste pr. skjøt. Metoden avgjør hvilke kontrollpunkter som vises under.

🔴 **Eksemplene skal stå ordrett.** Kenneth 2026-09-22: «VL P120, SP P340, OV P95 → disse forklaringer i hjelpetekst er
nyttig». Tre eksempler viser mønsteret der ett bare viser et tilfelle — og de tre dekker de ledningstypene som faktisk
sveises i PE. Ikke kort dem ned til ett.

**2. Rør og deler kontrollert** — `valg`
- Riktig dimensjon og trykklasse, rene og uskadde
- Avvik – kassert eller kappet bort

> Dimensjon, trykklasse og materiale skal stemme med beskrivelsen, og delene som skjøtes skal passe sammen. Utvendige riper høyst 10 % av veggtykkelsen, ingen innvendige riper. Dypere skader kappes ut.

**3. Forholdene på stedet** — `valg`
- Tørt og skjermet, temperatur som foreskrevet
- Telt eller oppvarming brukt
- Avvik – sveiset likevel

> Sveis skal være beskyttet mot støv, vind og nedbør. Ikke sveis under 0 °C uten oppvarmet telt. Fukt i skjøteflaten gir en sveis som ser riktig ut og likevel ikke holder.

### Kontroll UNDER utførelse

**4a. Skraping og rengjøring** — `valg` · **vises for «Elektromuffe (sveisemuffe)»**
- Skrapt med godkjent verktøy over hele muffelengden, rengjort
- Avvik

> Skrap med godkjent skrapeverktøy, aldri for hånd eller med sandpapir — oksidsjiktet skal bort, ikke bare pusses. Rengjør med foreskrevet rensemiddel og la flaten tørke før muffen settes på. Ta ikke på skjøteflaten etter rengjøring.

**4b. Høvling og oppretting** — `valg` · **vises for «Speilsveis»**
- Endene høvlet, rørene i samme akse, kantavvik innenfor kravet
- Avvik

> Høvle begge ender umiddelbart før sveising, og kontroller at flatene ligger an mot hverandre hele veien rundt. Rørene skal ligge i samme akse — kantavvik gir en svak sveis selv med riktige parametre.

**5. Fiksering** — `valg`
- Rørene fastspent, ingen bevegelse
- Avvik

> Rørene skal være fastspent slik at ingenting beveger seg under sveising og avkjøling. Bevegelse i avkjølingsfasen ødelegger skjøten.

**6. Sveiseparametre** — `valg`
- Som foreskrevet, protokoll tatt vare på
- Avvik – meldt

> Følg parametrene for denne dimensjonen og metoden. Elektromuffe: bruk muffens egen kode, og kontroller at maskinen leste den riktig. Speilsveis: temperatur, trykk og tider etter tabellen. Protokollen fra maskinen er dokumentasjonen — ta vare på den og legg den ved.

**7. Avkjøling** — `valg`
- Full avkjølingstid i klemme, uten belastning
- Avvik

> Skjøten skal stå i klemme hele den foreskrevne avkjølingstiden, og den skal ikke belastes, beveges eller trykkprøves før tiden er ute. Dette er det punktet som oftest ryker under tidspress.

### Kontroll ETTER utførelse

**8a. Smelteindikatorer** — `valg` · **vises for «Elektromuffe (sveisemuffe)»**
- Indikatorer ute på begge sider, muffen sitter i posisjon
- Avvik

> Begge indikatorene skal ha kommet ut. Har bare én kommet ut, er skjøten ikke godkjent — den kappes ut. Kontroller også at muffen ikke har forskjøvet seg.

**8b. Vulsten** — `valg` · **vises for «Speilsveis»**
- Jevn og symmetrisk hele veien rundt
- Avvik

> Vulsten skal være jevn og like stor på begge sider hele veien rundt røret. Skjev eller ujevn vulst betyr skjev oppstilling eller feil parametre — skjøten kappes ut og sveises på nytt.

**9. Skjøten merket** — `valg`
- Merket med sveiserens ID og pelnummer
- Avvik

> Merk skjøten på røret med sveiserens ID og pelnummeret, slik at den kan knyttes til denne sjekklisten når grøfta er fylt igjen.

**10. Skjøten er dokumentert og klar** — `trafikklys`

> Protokollen er tatt vare på, skjøten er merket og innmålt, og den kan omfylles. Ta bilde av skjøten og av merkingen før den dekkes til.

**Struktur:** åtte felt vises alltid (1, 2, 3, 5, 6, 7, 9, 10). Metoden i felt 1 viser to felt til — enten 4a og 8a, eller
4b og 8b. **En typisk skjøt viser ti felt av tolv.** «Annen metode» viser åtte, og forventes brukt sjelden.

## 5. Rammer

- §7b-sjekk i en ny `pe-skjot-mal.test.ts`: ingen `Matrise`, `NS-EN`, `NS 3420`, og **ingen forekomst av «pæl»**.
  `PE`, `SDR`, `elektromuffe` og `speilsveis` er produkt- og metodebetegnelser og er tillatt (§7c).
- **Strukturtest:** låse treet — at 4a/8a hører til elektromuffe og 4b/8b til speilsveis, og at ingen av dem er alltid
  synlige. Rød først.
- To barn under samme utløser = **to egne poster** i `barn`-arrayet med samme `naar` (`seed-bibliotek.ts:197–206`).
  Det gjelder begge metodene her: 4a+8a er ett par, 4b+8b et annet.
- Utløseren ligger på barnets **eget** sett (`BETINGELSE_EGEN_NOKKEL`).
- Fasit (§8) og `skriv-mal` viser treet. Ingen i18n-nøkler. Ingen endring i `packages/shared` eller appene.
  Prod-gaten røres ikke. Ingen migrering.

## 6. SQL og DoD

`generer-mal-sql.ts <referanse> ny` — **først etter at § 3 er besvart og design har gatet referansen.** Mangler
kapittelet, opprettes det som i tidligere runder (WHERE NOT EXISTS). Lag SQL-filen, parse-test mot engangsdatabase,
slett den etterpå, lever de tre enlinjerne. **Ikke kjør mot test selv.**

**DoD:**
1. § 3 besvart og gatet av design **før** malen opprettes.
2. Malen med 12 felt som over, ordrett, med riktig forelder og utløsersett.
3. UM1 felt 9 endret i samme leveranse — de to malene hører sammen.
4. Strukturtest og §7b-sjekk grønne, fasit oppdatert i samme branch.
5. **Tekstbevis:** `skriv-mal` for den nye malen limt i leveransen, som viser hvilken metode som utløser 4a/8a og
   4b/8b.
6. Gate-tall via `pnpm exec turbo run test --force`.
7. Leveranse nederst i hovedtreets `relay/inbox-design.md` + «design har post».

## 7. Fagpunkter design gater hos Kenneth før SQL

Designs forslag, ikke Kenneths ord:

1. **To metoder er nok?** Elektromuffe og speilsveis, pluss «Annen metode». Kenneth nevnte sveisemuffer særskilt, så
   design antar elektromuffe er den vanligste.
2. **Merkingen i felt 9** — design foreslår sveiserens ID og pelnummer på røret. Er det slik dere merker i dag?
3. **Én sjekkliste pr. skjøt gir mange dokumenter.** Design har ikke foreslått noen forenkling, fordi Kenneth avslo
   gjentakelse for kumgrupper 2026-09-22 som «litt for langt». Blir antallet et problem i praksis, er det en måling —
   ikke en designendring nå.
