# Ordre: ny mal UM1.1 – skjøting av PE-rør, én sjekkliste pr. skjøt

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

## 3. Referansen — besvart av Kenneth, ikke av normoppslaget

**Kenneth 2026-09-22:** «um1.1 benyttes både til PE bend og muffer og sveiseskjøt. noen ganger er bend og muffer egen
post, andre ganger er det lm komplett».

**Referansen er `UM1.1`, i eksisterende kapittel `UM`** — samme kapittel som UM1 selv. Ingen nytt kapittel, ingen ny
standard. Designs oppslagsbestilling er dermed trukket; Kenneths ord går foran normen når de spriker (§7b-linja).

🔴 **To følger, og den andre er den viktige:**

1. **Malen dekker mer enn sveisen.** UM1.1 brukes til **PE-bend, muffer og sveiseskjøt**. Derfor får malen et nytt
   første felt — «Hva skjøtes» — og bendet får sitt eget kontrollpunkt. Navnet endres fra designs arbeidstittel
   «PE-skjøt» til **«UM1.1 – Skjøting av PE-rør»**, som dekker alle tre.
2. **Prisformen skal ikke avgjøre om kontrollen gjøres.** Kenneth: bend og muffer er «noen ganger egen post, andre
   ganger lm komplett». Inngår bendet i løpemeterprisen, finnes det ingen egen post å henge en sjekkliste på — men
   skjøten er like avgjørende for at ledningen holder. **Malen sier det eksplisitt i felt 1s hjelpetekst**, slik at
   ingen hopper over kontrollen fordi delen ikke ble priset for seg.

**Det ene som fortsatt skal bekreftes av deg, og det er en bekreftelse og ikke et oppslag:** at `UM1.1` finnes som post
og at kapittel `UM` allerede bærer `UM1`. Stemmer det ikke, **stopp og meld** — feil referanse gir en bibliotekrad som
må rettes med lån-bevaring etterpå.

**Metodenavnene** står fortsatt åpne: designs arbeidstitler er *elektromuffesveis* og *speilsveis*. Bruker normen andre
ord, meld dem — men Kenneth sa «PE sveisemuffer», og hans ord går foran.

**Meld bekreftelsen før du bygger.**

## 4. Malen

```
kapittelKode: "UM"
referanse:    "UM1.1"
navn:         "UM1.1 – Skjøting av PE-rør"
beskrivelse:  "Skjøting av PE-rør — sveiseskjøt, bend og muffe: metode, forberedelse, parametre, avkjøling, visuell kontroll og merking. Én sjekkliste pr. skjøt. Faglig grunnlag: NS 3420-U:2019, post UM1.1."
```

**Alle felt er `valg` eller `trafikklys` — ingen tallfelt (§1).** Parametre og verdier hører i sveiseprotokollen og i
kommentaren, ikke som tallfelt i sjekklisten.

### Kontroll FØR utførelse

**1. Hva skjøtes** — `valg` · **forelder for felt 2**
- Skjøt på rett rør
- Bend
- Muffe eller overgang
- Annen del – se beskrivelsen

> Skriv ledningen og pelnummeret i emnefeltet: VL P120 for vannledning, SP P340 for spillvann, OV P95 for overvann. Det er slik skjøten finnes igjen senere, og slik to skjøter ved samme pel holdes fra hverandre. Én sjekkliste pr. skjøt. Kontrollen gjelder uansett om bendet eller muffen er priset som egen post eller inngår i løpemeterprisen — en skjøt som svikter, svikter like fullt.

🔴 **Eksemplene skal stå ordrett.** Kenneth 2026-09-22: «VL P120, SP P340, OV P95 → disse forklaringer i hjelpetekst er
nyttig». Tre eksempler viser mønsteret der ett bare viser et tilfelle — og de tre dekker de ledningstypene som faktisk
sveises i PE. Ikke kort dem ned til ett.

🔴 **Setningen om prisform skal også stå ordrett.** Den kommer av Kenneths «noen ganger er bend og muffer egen post,
andre ganger er det lm komplett». Inngår delen i løpemeterprisen, finnes ingen egen post å henge en sjekkliste på — og
da er det nettopp hjelpeteksten som må si at kontrollen gjelder likevel.

**2. Bendets retning og vinkel** — `valg` · **vises for «Bend»**
- Riktig vinkel og retning, forankret som beskrevet
- Forankring ikke krevd her
- Avvik

> Kontroller vinkelen og retningen mot tegningen før skjøten sveises — et bend som peker feil, rives opp igjen. Står ledningen under trykk, skyver bendet seg utover, og kraften skal tas opp av mothold eller strekkfaste skjøter slik beskrivelsen angir.

**3. Sveisemetode** — `valg` · **forelder for felt 6 og 10**
- Elektromuffe (sveisemuffe)
- Speilsveis
- Annen metode – se beskrivelsen

> Metoden avgjør hvilke kontrollpunkter som vises under. Elektromuffe og speilsveis forberedes og kontrolleres på helt ulike måter.

**4. Rør og deler kontrollert** — `valg`
- Riktig dimensjon og trykklasse, rene og uskadde
- Avvik – kassert eller kappet bort

> Dimensjon, trykklasse og materiale skal stemme med beskrivelsen, og delene som skjøtes skal passe sammen. Utvendige riper høyst 10 % av veggtykkelsen, ingen innvendige riper. Dypere skader kappes ut.

**5. Forholdene på stedet** — `valg`
- Tørt og skjermet, temperatur som foreskrevet
- Telt eller oppvarming brukt
- Avvik – sveiset likevel

> Sveis skal være beskyttet mot støv, vind og nedbør. Ikke sveis under 0 °C uten oppvarmet telt. Fukt i skjøteflaten gir en sveis som ser riktig ut og likevel ikke holder.

### Kontroll UNDER utførelse

**6a. Skraping og rengjøring** — `valg` · **vises for «Elektromuffe (sveisemuffe)»**
- Skrapt med godkjent verktøy over hele muffelengden, rengjort
- Avvik

> Skrap med godkjent skrapeverktøy, aldri for hånd eller med sandpapir — oksidsjiktet skal bort, ikke bare pusses. Rengjør med foreskrevet rensemiddel og la flaten tørke før muffen settes på. Ta ikke på skjøteflaten etter rengjøring.

**6b. Høvling og oppretting** — `valg` · **vises for «Speilsveis»**
- Endene høvlet, rørene i samme akse, kantavvik innenfor kravet
- Avvik

> Høvle begge ender umiddelbart før sveising, og kontroller at flatene ligger an mot hverandre hele veien rundt. Rørene skal ligge i samme akse — kantavvik gir en svak sveis selv med riktige parametre.

**7. Fiksering** — `valg`
- Rørene fastspent, ingen bevegelse
- Avvik

> Rørene skal være fastspent slik at ingenting beveger seg under sveising og avkjøling. Bevegelse i avkjølingsfasen ødelegger skjøten.

**8. Sveiseparametre** — `valg`
- Som foreskrevet, protokoll tatt vare på
- Avvik – meldt

> Følg parametrene for denne dimensjonen og metoden. Elektromuffe: bruk muffens egen kode, og kontroller at maskinen leste den riktig. Speilsveis: temperatur, trykk og tider etter tabellen. Protokollen fra maskinen er dokumentasjonen — ta vare på den og legg den ved.

**9. Avkjøling** — `valg`
- Full avkjølingstid i klemme, uten belastning
- Avvik

> Skjøten skal stå i klemme hele den foreskrevne avkjølingstiden, og den skal ikke belastes, beveges eller trykkprøves før tiden er ute. Dette er det punktet som oftest ryker under tidspress.

### Kontroll ETTER utførelse

**10a. Smelteindikatorer** — `valg` · **vises for «Elektromuffe (sveisemuffe)»**
- Indikatorer ute på begge sider, muffen sitter i posisjon
- Avvik

> Begge indikatorene skal ha kommet ut. Har bare én kommet ut, er skjøten ikke godkjent — den kappes ut. Kontroller også at muffen ikke har forskjøvet seg.

**10b. Vulsten** — `valg` · **vises for «Speilsveis»**
- Jevn og symmetrisk hele veien rundt
- Avvik

> Vulsten skal være jevn og like stor på begge sider hele veien rundt røret. Skjev eller ujevn vulst betyr skjev oppstilling eller feil parametre — skjøten kappes ut og sveises på nytt.

**11. Skjøten merket** — `valg`
- Merket med sveiserens ID og pelnummer
- Avvik

> Merk skjøten på røret med sveiserens ID og pelnummeret, slik at den kan knyttes til denne sjekklisten når grøfta er fylt igjen.

**12. Skjøten er dokumentert og klar** — `trafikklys`

> Protokollen er tatt vare på, skjøten er merket og innmålt, og den kan omfylles. Ta bilde av skjøten og av merkingen før den dekkes til.

**Struktur:** malen har **14 felt**, og **ni vises alltid** (1, 3, 4, 5, 7, 8, 9, 11, 12). To forgreninger legger på:

| Situasjon | Synlige felt |
|---|---|
| Skjøt på rett rør, elektromuffe | 11 (+ 6a, 10a) |
| Skjøt på rett rør, speilsveis | 11 (+ 6b, 10b) |
| Bend, elektromuffe | 12 (+ 2, 6a, 10a) |
| «Annen del» og «Annen metode» | 9 |

**To foreldre:** felt 1 «Hva skjøtes» utløser bendfeltet, og felt 3 «Sveisemetode» utløser de to metodeparene. Samme
mønster som UM1 v2, der ledningstype og skjøtemetode er to uavhengige trær.

## 5. Rammer

- §7b-sjekk i en ny `um1-1-mal.test.ts`: ingen `Matrise`, `NS-EN`, `NS 3420`, ingen `UM1.1 ` som prefiks i feltnavn, og
  **ingen forekomst av «pæl»**. `PE`, `SDR`, `elektromuffe` og `speilsveis` er produkt- og metodebetegnelser og er
  tillatt (§7c).
- **Strukturtest:** låse begge trærne — at 6a/10a hører til elektromuffe, 6b/10b til speilsveis, at bendfeltet hører
  til felt 1 og ikke til felt 3, og at ingen av de fem er alltid synlige. Rød først.
- To barn under samme utløser = **to egne poster** i `barn`-arrayet med samme `naar` (`seed-bibliotek.ts:197–206`).
  Det gjelder begge metodene her: 6a+10a er ett par, 6b+10b et annet.
- Utløseren ligger på barnets **eget** sett (`BETINGELSE_EGEN_NOKKEL`).
- Fasit (§8) og `skriv-mal` viser treet. Ingen i18n-nøkler. Ingen endring i `packages/shared` eller appene.
  Prod-gaten røres ikke. Ingen migrering.

## 6. SQL og DoD

`generer-mal-sql.ts UM1.1 ny`. Kapittel `UM` finnes fra UM1 — **ingen nytt kapittel skal opprettes.** Trenger UM1.1 en
plass i sorteringen rett etter UM1, bruk `--sorter` som i tidligere runder, og meld hvilke søstre som flyttes. Lag
SQL-filen, parse-test mot engangsdatabase, slett den etterpå, lever de tre enlinjerne. **Ikke kjør mot test selv.**

**DoD:**
1. § 3 bekreftet: `UM1.1` finnes som post, og kapittel `UM` bærer allerede `UM1`. Stemmer det ikke — stopp og meld.
2. Malen med 14 felt som over, ordrett, med riktige foreldre og utløsersett.
3. UM1 felt 9 endret i samme leveranse — de to malene hører sammen.
4. Strukturtest og §7b-sjekk grønne, fasit oppdatert i samme branch.
5. **Tekstbevis:** `skriv-mal UM1.1` limt i leveransen, som viser at bendfeltet henger på felt 1 og metodeparene på
   felt 3.
6. Gate-tall via `pnpm exec turbo run test --force`.
7. Leveranse nederst i hovedtreets `relay/inbox-design.md` + «design har post».

## 7. Fagpunkter design gater hos Kenneth før SQL

Designs forslag, ikke Kenneths ord:

1. **To metoder er nok?** Elektromuffe og speilsveis, pluss «Annen metode». Kenneth nevnte sveisemuffer særskilt, så
   design antar elektromuffe er den vanligste.
2. **Merkingen i felt 11** — design foreslår sveiserens ID og pelnummer på røret. Er det slik dere merker i dag?
3. **Én sjekkliste pr. skjøt gir mange dokumenter.** Design har ikke foreslått noen forenkling, fordi Kenneth avslo
   gjentakelse for kumgrupper 2026-09-22 som «litt for langt». Blir antallet et problem i praksis, er det en måling —
   ikke en designendring nå.
