# Ordre: UM1 v2 – legging av VA-ledninger med betingede felt

**Til:** mal-Opus · **Fra:** design · **Dato:** 2026-09-22
**Metode:** MAL-METODE §1, §1c, §1e, §6a, §6b, §7b, §8 og §8b.
**Branch:** `feat/mal-um1-betinget` fra `origin/develop` **etter at UP1 v2 er merget** — fasemålingen der er
forutsetningen, se § 4.
**Gatet av Kenneth 2026-09-22:** «ja, ta UM1 samme vei nå.»

Tredje mal med betingede felt, etter JH2 (underlagstype) og UP1 (kumtype). Her følger forgreningen **ledningstypen**,
og i tillegg får malen sin første forgrening på et felt som ikke er typefeltet: skjøtemetoden.

---

## 1. Hvorfor

UM1 v1 har elleve felt, og to av dem bærer et «gjelder ikke meg»-svar som en fagperson må lese seg gjennom hver gang:

| Felt i v1 | Svaret som avslører problemet |
|---|---|
| «Sveiselogg for PE» | **«Ikke PE-sveis»** — vises selv når du nettopp svarte «Muffe» på skjøting |
| «Fall» | tillatt avvik i ‰ vises også for vannledning og trykkledning, som ikke legges med prosjektert fall |

Det er samme mønster Kenneth pekte på for asfalt og kum: **spørsmålet er ikke aktuelt, og skal ikke vises.** Til
forskjell fra UP1 er ikke dette bare en opprydding — malen mangler i dag felt som drensledning og trykkledning faktisk
krever, og de kan bare legges inn uten å blåse opp listen **fordi** de kan skjules for de andre typene.

**Kenneths tre grunner, uendret fra JH2:** riktigere veiledning om hva som kontrolleres og mot hvilke krav · færre
synlige felt · en kontroll som faktisk blir gjennomført fordi listen bare viser det som gjelder jobben.

## 2. Treet — to foreldre

`forgrening("ledningstype", …)` på felt 1, og `forgrening("skjoting", …)` på felt 6. To uavhengige trær i samme mal.

| Forelder | Utløser | Barn |
|---|---|---|
| **1 Type ledning** | Avløp, selvfall · Drensledning | Fall |
| | Drensledning | Filterlag og duk rundt ledningen · Perforering og retning |
| | Vannledning · Avløp, trykk | Forankring av bend og avgreininger |
| **6 Skjøting** | PE-sveis | Sveiselogg for PE |

**Hvorfor skjøtemetoden får sin egen forelder:** sveiseloggen henger ikke på hva slags ledning det er, men på hvordan
den skjøtes. En PE-vannledning og en PE-trykkavløpsledning skal begge ha logg; en muffeskjøtt PE-ledning skal ikke.
Legger man loggen under ledningstypen, blir den feil i begge retninger. Det er derfor malen får to trær — og det er
verdt å merke seg som mønster: **forelderen skal være feltet som faktisk avgjør kravet.**

🔴 **Fellene i `forgrening`, som i UP1:**

1. **To barn under samme utløser = to egne poster** i `barn`-arrayet med samme `naar`. `felt: [a, b]` gir bare `a` sin
   `parentRef` (`seed-bibliotek.ts:197–206`). Det gjelder **drensledning-paret** (felt 3 og 4).
2. Utløseren ligger på barnets **eget** sett (`BETINGELSE_EGEN_NOKKEL`), aldri `conditionValues`.
3. To trær i samme mal er ikke prøvd før. Bruk **to ulike `ref`-verdier** (`ledningstype`, `skjoting`), og
   la strukturtesten vise at de ikke blander seg.

## 3. Malen (v2)

```
kapittelKode: "UM"
referanse:    "UM1"
navn:         "UM1 – Legging av VA-ledninger"
beskrivelse:  "Legging og skjøting av vann-, avløps- og drensledninger i grøft — rørmateriell, fundament, skjøter, forankring, fall og plassering. Faglig grunnlag: NS 3420-U:2019, post UM1."
```

Revisjon: `version + 1`. Beskrivelsen får med **forankring**, som er nytt innhold.

### Kontroll FØR utførelse

**1. Type ledning** — `valg` · **forelder for felt 2–5** *(alternativene uendret fra v1)*
- Vannledning
- Avløp, selvfall
- Avløp, trykk
- Drensledning
- Annen ledning

> Typen ledning avgjør skjøtemetode, hvilke krav som gjelder for fall og forankring, og hvilken prøving som skal gjøres etterpå. Skriv strekningen i emnefeltet med kumnavnene fra tegningen: SP-04 til SP-05, V-01 til V-02, OV-02 til OV-03. Går ikke strekningen mellom to kummer, skriver du ledningstypen og pelene i stedet: VL P120 til P180. Det er slik strekningen finnes igjen senere.

🔴 **Emnet for en strekning — rettet to ganger av Kenneth 2026-09-22, les hele punktet:**

Design foreslo først `VL V-01–V-02`, altså ledningstype pluss kumnavn. **Den falt på to punkter:**

1. **Ledningstypen er overflødig når strekningen går mellom to kummer.** Går den fra SP-04 til SP-05, *er* det en
   spillvannsledning — kumnavnet sier det. Og siden spillvannskummen heter **SP**-04 (ikke S-04, som design feilaktig
   skrev i første utkast), ble forslaget `SP SP-04–SP-05`, som sier det samme to ganger.
2. **Tankestrek mellom kumnavnene gir tre bindestreker på rad.** Kenneth: «SP-04–SP-05 er litt mange dash». Riktig form
   er **`SP-04 til SP-05`**, med ordet «til».

**Design anbefalte «til» framfor «mellom … og …» av én grunn: sortering.** Begynner emnet med «mellom», sorterer hver
eneste strekning under M, og kumnavnet — det man leter etter — ligger gjemt inne i teksten. Starter emnet med `SP-04`,
grupperer listen seg selv etter startkum. Gatet av Kenneth.

| Strekningen går | Emne |
|---|---|
| mellom to kummer | kumnavnene: `SP-04 til SP-05` |
| ellers (drensledning, stikkledning, tilkobling) | ledningstype + pel: `VL P120 til P180` |

**Alle tre kumeksemplene skal stå ordrett** — Kenneth 2026-09-22: «disse forklaringer i hjelpetekst er nyttig». Ett
eksempel viser et tilfelle; tre viser mønsteret. Ledningstypene (VL, SP, OV, AF) er de samme forkortelsene som
kummene bruker, så VA-sporet har én konvensjon; sveiseskjøten bruker den med pelnummer i stedet for kumnavn.

**2. Fall** — `valg` · **vises for «Avløp, selvfall» og «Drensledning»** · fase **ETTER**
- Innenfor toleransen for prosjektert fall
- Avvik

> Tillatt avvik: ±2 ‰ når fallet er under 10 ‰, ±3 ‰ ved 10–20 ‰, og ±5 ‰ når fallet er over 20 ‰. Gjelder hvert rør og hele strekningen. Mål før omfylling — etterpå er det for sent å rette.

**3. Filterlag og duk rundt ledningen** — `valg` · **vises for «Drensledning»** · fase **UNDER**
- Filtermasse og duk som beskrevet
- Avvik – rettes før omfylling

> Drensledningen skal omgis av den filtermassen beskrivelsen angir, og duken skal ligge slik at finstoff ikke vaskes inn i røret. Et drensrør som gror igjen, kan ikke utbedres senere uten å grave opp.

**4. Perforeringen vendt opp** — `valg` · **vises for «Drensledning»** · fase **UNDER**
- Slissene ligger opp
- Avvik – rettes før omfylling

> Slissene skal ligge opp. Silt og finstoff bygger seg opp fra bunnen av røret, så perforering vendt ned tetter seg igjen — og da kan ledningen ikke utbedres uten å grave opp. Kontroller også at spylepunkter og utløp er der tegningen viser.

🔴 **RETTET 2026-09-22 etter Kenneth: «Opp, silt bygger seg opp fra bunnen».** Designs første utkast lot
beskrivelsen bestemme retningen og hadde svaret «Lagt som beskrevet». **Det var for svakt** — det finnes en
hovedregel, og malen skal si den. Både feltnavnet og begrunnelsen er Kenneths, og de skal stå ordrett.

**5. Forankring av bend** — `valg` · **vises for «Vannledning» og «Avløp, trykk»** · fase **UNDER**
- Forankret som beskrevet – bend over 15° med muffeskjøter
- Ikke krav – ledningen er sveist, skjøtene er strekkfaste
- Ikke krav – ingen bend over 15° på denne strekningen
- Avvik

> Kenneth 2026-09-22: forankring gjelder bend over 15° og trykkledninger med muffer. En sveist PE-ledning får ikke forankring — sveiseskjøtene er strekkfaste og tar kraften selv. En trykkledning skyver seg utover i bend, T-rør, reduksjoner og endelokk, og forankringen skal være på plass før ledningen settes under trykk.

🔴 **RETTET 2026-09-22 etter Kenneth: «Ja, men jeg tror det må være over 15 grader bend og trykkledninger med
muffer. sveiste PE ledninger får ikke forankring».** To ting fulgte av det:

1. **15°-grensen og muffekravet er nå i svaralternativene**, ikke bare i hjelpeteksten. Designs «Forankret eller
   strekkfaste skjøter, som beskrevet» var for løst — det skjulte at de to er ulike tilstander med ulik årsak.
2. 🔴 **Skjøtemetoden avgjør, men den kan IKKE være forelder her.** Feltet henger på ledningstypen (felt 1), og et
   barn har bare én forelder. Løsningen er at **«sveist» er et SVAR og ikke en betingelse** — alternativ 2. Det er
   ærligere enn en to-forelder-konstruksjon, og det dokumenterer *hvorfor* forankring ikke var krevd.
   **Ikke forsøk å binde feltet til felt 8 «Skjøting».**

**Hjelpeteksten i malen begynner med «Forankring gjelder bend over 15° …»** — Kenneth-attribusjonen over er en
kildemerknad til mal-Opus og skal ikke inn i malen.

**6. Rør og deler kontrollert** — `valg` *(uendret fra v1, ordrett)*

**7. Grøftebunn og fundament klare** — `trafikklys` *(uendret fra v1, ordrett)*

### Kontroll UNDER utførelse

**8. Skjøting** — `valg` · **forelder for felt 9** *(alternativene uendret fra v1)*
- Muffe
- PE-sveis
- Flens eller kobling
- Avvik

> Rørene sentreres, og skjøtekraften skal virke langs røret. Rør som brukes som mothold, støttes så de ikke forskyves. Flensskjøter ettertrekkes. Klemringskobling på PE-rør skal ha støttehylse innvendig.

**9. Sveiseskjøter dokumentert** — `valg` · **vises når felt 8 = «PE-sveis»**
- Alle skjøter har egen sjekkliste
- Mangler

> Hver sveiseskjøt dokumenteres i sin egen sjekkliste, med sveiseparametre, sveiserens ID og signatur. Dette feltet bekrefter bare at ingen skjøt på strekningen mangler — selve loggen hører ikke hjemme her.

🔴 **Dette feltet erstatter v1s «Sveiselogg for PE», og endringen er Kenneths:** «for PE sveis eller PE sveisemuffer →
en sjekkliste pr skjøt» (2026-09-22). En strekning kan ha tjue skjøter; ett svar for alle tjue er ikke en sveiselogg.
Selve loggen flyttes til en egen mal, se `ordre-pe-skjot-ny-mal-design-2026-09-22.md` i samme branch. **De to ordrene
skal merges og bygges sammen** — felt 9 peker på en mal som må finnes.

**10. Røret hviler på fundamentet, ingen skolinger** · **11. Ledningen holdt ren innvendig** — `trafikklys`,
**uendret fra v1**, ordrett.

**12. Avstand til kum og andre ledninger** — `valg`, **uendret fra v1**, ordrett.

### Kontroll ETTER utførelse

**13. Plassering i høyde og side** — `valg`, **uendret fra v1**, ordrett.

**14. Ledningen er klar for omfylling** — `trafikklys`. Hjelpeteksten utvides med innmåling:

> Ledningen er lagt, skjøtt, innmålt og kontrollert og kan omfylles. Innmålingen tas før ledningen dekkes til — etterpå må det graves opp. Ta bilde.

**Utgår fra v1:**
- **«Ikke PE-sveis»** som svaralternativ på sveiseloggen. Feltet vises nå bare når det faktisk er sveiset (§1c).
- **«Fall» som alltid synlig felt.** Toleransene i ‰ er riktige, men de gjelder ikke en trykkledning, og skal ikke stå
  der som om de gjorde.

**Nytt i v2:** filterlag og duk, perforering og retning, forankring av bend og avgreininger, innmåling i felt 14.

**Struktur:** ni felt vises alltid (1, 6, 7, 8, 10–14). Malen har 14 felt i alt:

| Type ledning | Synlige felt |
|---|---|
| Vannledning | 10, eller 11 med PE-sveis |
| Avløp, selvfall | 10, eller 11 med PE-sveis |
| Avløp, trykk | 10, eller 11 med PE-sveis |
| Drensledning | 12, eller 13 med PE-sveis |
| Annen ledning | 9, eller 10 med PE-sveis |

## 4. Avhengighet — UP1 måles først

UP1 v2 bærer målingen av **om et barn kan ha annen fase enn forelderen** (der er forelderen FØR og barna UNDER/ETTER).
UM1 har samme situasjon: felt 1 er FØR, mens fall er ETTER og de tre andre barna er UNDER.

**Derfor bygges UM1 etter UP1.** Er svaret på fasemålingen at det ikke virker, skal du **ikke** bygge UM1 — meld i
stedet, så retter design begge ordrene sammen. Er svaret ja, er UM1 ren rutine.

Det ene som er nytt her og ikke dekkes av UP1: **to `forgrening`-kall i samme mal.** Meld om noe overrasker.

## 5. Rammer

- §7b-sjekk i `um1-mal.test.ts` som før: ingen `UM1 `, `Matrise`, `NS-EN`, `NS 3420`.
- **Strukturtest:** låse begge trærne — at fall har **to** utløsere, at drensledning har **to barn**, at forankring har
  **to** utløsere, og at sveiseloggen er barn av **skjøtefeltet** og ikke av typefeltet. Rød først.
- Fasit (§8) og `skriv-mal UM1` viser begge trærne. Ingen i18n-nøkler. Ingen endring i `packages/shared` eller appene.
  Prod-gaten røres ikke. Ingen migrering.
- Gate-tall via `pnpm exec turbo run test --force`.

## 6. SQL og DoD

`generer-mal-sql.ts UM1 revisjon`. Lag `um1-v2-test.sql`, parse-test mot engangsdatabase, slett den etterpå, lever de
tre enlinjerne. **Ikke kjør mot test selv.**

**DoD:**
1. UP1s fasemåling er besvart positivt. Ellers: ikke bygget, meld i stedet.
2. `UM1_MAL` med 14 felt som over, ordrett, med riktige foreldre og utløsersett.
3. Strukturtest og §7b-sjekk grønne, fasit oppdatert i samme branch.
4. **Tekstbevis:** `skriv-mal UM1` limt i leveransen — den skal vise begge trærne, og at sveiseloggen henger på felt 8.
5. Gate-bygg med gate-tall.
6. Diff: `seed-bibliotek.ts`, `um1-mal.test.ts`, `mal-fasit.snap.md` og SQL-en. Rører du noe annet, meld hvorfor.
7. Leveranse nederst i hovedtreets `relay/inbox-design.md` + «design har post».

## 7. Fagpunkter — ALLE FIRE GATET av Kenneth 2026-09-22

✅ **SQL-sperren er opphevet.** Alle fire punktene er besvart, og rettingene er gjort i feltene over.

1. ✅ **Fall for drensledning: «ja».** De samme ‰-toleransene gjelder. Drensledning blir liggende i samme
   utløsersett som selvfall, som design foreslo. Ingen endring.
2. ✅ **Perforering: «Opp, silt bygger seg opp fra bunnen».** Feltet er omskrevet — se felt 4. Design lot
   beskrivelsen bestemme; det var for svakt, og hovedregelen står nå i malen med Kenneths begrunnelse.
3. ✅ **Forankring: «Ja, men … over 15 grader bend og trykkledninger med muffer. sveiste PE ledninger får ikke
   forankring».** Feltet er omskrevet — se felt 5. 15°-grensen og muffekravet ligger i svaralternativene, og
   «sveist» er et **svar** og ikke en betingelse, fordi et barn bare kan ha én forelder.
4. ✅ **Emnefeltet for ledning:** emnet er kumnavnene med «til» mellom — `SP-04 til SP-05`. Går strekningen ikke
   mellom to kummer, brukes ledningstype og peler: `VL P120 til P180`. Kenneth: «skillet går på vannledning og
   spillvannsledning i tillegg til pel nummer» og «SP-04–SP-05 er litt mange dash».

## 7b. ✅ Fasemålingen (§ 4) er BESVART — POSITIV

**Mal-Opus, levert i `relay/inbox-design.md` 2026-09-22:** ja, et barn kan ha annen fase enn forelderen. Verste
tilfelle — forelder UNDER, barn ETTER — er empirisk bekreftet i `byggBibliotekRader`, `skriv-mal`, generator-SQL og
en ekte Postgres parse-test med self-FK på `parent_id`. Trekoblingen er uavhengig av rekkefølge, barnet vises under
sin egen ETTER-overskrift, og self-FK-en holder på tvers av fasegrensen.

**Ingen stopp-og-meld.** UM1 v2, UM1.1 og UP-delingen kan bygges med fasene som beskrevet. Tre ikke-blokkerende
edger står i relay-leveransen.
4. ~~**Emnefeltet for ledning.**~~ **Avklart 2026-09-22, se felt 1:** emnet er kumnavnene med «til» mellom —
   `SP-04 til SP-05`. Går strekningen ikke mellom to kummer, brukes ledningstype og peler: `VL P120 til P180`. Selve
   sveiseskjøten dokumenteres i egen mal med `VL P120`. Kenneth: «skillet går på vannledning og spillvannsledning i
   tillegg til pel nummer» og «SP-04–SP-05 er litt mange dash».

---

🔴 **MEKANISME-RETTING 2026-09-23 — gjelder foran denne ordrens bokstav.**

Ordren sier «bruk `forgrening`». Den ble skrevet før `forelderFelt` + `barnAv` fantes
(`seed-bibliotek.ts:218`/`:228`, lagt til av mal-Opus i KD1 v3). **Gjeldende regel er MAL-METODE §1f:**

- **Samme fase** som forelderen → `forgrening`
- **Annen fase** enn forelderen → **`forelderFelt` + `barnAv`**

Denne malen har typeforeldre i **FØR** med barn i **UNDER** og **ETTER**. Der skal `barnAv` brukes. Utføreren
melder i leveransen hvilken hjelper som ble brukt hvor.
