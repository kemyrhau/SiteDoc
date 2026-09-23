# Ordre: UP1 deles i fire maler — nedstigningskum, inspeksjonskum, sandfangkum og nedgravd ventil

**Til:** mal-Opus · **Fra:** design · **Dato:** 2026-09-22
**Metode:** MAL-METODE §1, §1c, §1e, §6a, §6b, §7b, §8 og §8b.
**Branch:** `feat/mal-up1-deling` fra `origin/develop` **etter at JH2 v2 er merget** — `forgrening` er
forutsetningen.
**Gatet av Kenneth 2026-09-22:** kumtypene og forkortelsene · at renneløp er felles for SP/OV/AF · at brannkum
**ikke** er egen type men en egenskap ved ventilen · at Baio-kum er en nedgravd ventil med gatelokk · og til sist
**«ja, del UP1 i tre maler»** og **«ja, ta UP2 som fjerde mal»**.

**Normgrunnlag lest av design 2026-09-22** i `kilder/ns3420/NS 3420 Del U Rørinstallasjoner.pdf` (NS 3420-U:2019).
Normsidene står i § 3.

---

## 1. Hvorfor — to behov som peker samme vei

**Kenneths opprinnelige behov:**

> «ut av dette så trenger vi i emnefeltet for kummer og fortelle hvilken kum (kummens prosjektnavn) → da kan vi
> sortere ut riktig kumtype → sortere på spillvannskum, Felleskum, Overvannskum, vannkum og sandfangkummer →
> hvis vi blandeer kummer vil dette bli umulig»

Det ga to krav: **ett dokument per kum**, og **kumnavnet i emnefeltet**. Gjentakelse og sammenslåing av UM1+UP1
er avslått av Kenneth — «jeg tror vi effektiviserer litt for langt». **Ikke bygg noen av dem.**

**Og så kom normmålingen:** UP1 er ikke «kum» — det er **«Nedstigningskummer i grunnen»** (normside 340).
Kapittel UP deler etter konstruksjon, og sandfang er en egen post. Baio-kummen er ikke en kum i det hele tatt —
den er en ventil, i et annet kapittel.

**Kenneth 2026-09-22: «ja, del UP1 i tre maler.»** Og kort etter: **«ja, ta UP2 som fjerde mal.»** Fire maler.

🔴 **Delingen er også en forutsetning for kontrollplan-utledningen** — se
`designnotat-utled-kontrollplan-og-fremdrift-fra-mengdebeskrivelse-design-2026-09-22.md` § 2. Utledningen slår
opp mal fra NS-koden i mengdebeskrivelsen ved lengste prefiks. Det virker bare når **mal og post er samme ting**.
En mal som dekker fire poster, kan ingen utledning treffe.

## 2. Terminologi — gatet av Kenneth, bruk ordrett

| Type | Forkortelse | Kenneths ord |
|---|---|---|
| Spillvannskum | SP | «SP (spillvann) … dette er de korrekte forkortelser» |
| Overvannskum | OV | «OV (overvann)» |
| Felleskum | AF | «AF (Avløp Felles)» |
| Vannkum | V | «V (vannkum)» |
| Baio-kum | V | «Bajo kum er en nedgravd vannventil med et gatelokk på vei med avstenging og mulighet for brannuttak i enkelte tilfeller» |
| Sandfangkum | SF | «SF (sandfang)» |

**Alle tre avløpskummene (SP, OV, AF) har renneløp i bunnen** — Kenneth: «alle disse har renneløp i bunnen». AF
ligger i samme gruppe som SP og OV.

🔴 **Brannkum er IKKE en egen type.** Kenneth avviste designs forslag: «i sjekklister blir disse vannkum og det
blir på ventilen merket at det er brannuttak → i praksis henger man opp et skilt som markerer brannkummen med
avstand og retning fra skiltet». Uttaket registreres på ventilen, og skiltet er et eget kontrollpunkt.

🔴 **Skrivemåten er «Baio»**, ikke Bajo og ikke bajonett. Design skrev først «bajonettkobling» etter et websøk
som slo feil; Kenneth rettet det — «det er en kniv på et våpen». **Ordet «bajonett» skal ikke forekomme i noen av
malene.**

## 3. Normmålingen som ga delingen

| Post | Normens navn | Side |
|---|---|---|
| **UP** | Kummer i grunnen | 339 |
| **UP1** | **Nedstigningskummer i grunnen** | 340 |
| UP2 | Inspeksjonskummer i grunnen | 347 |
| **UP3** | **Sandfangskummer og hjelpesluk i grunnen** | 348 |
| UP8.2 | Markering av kummer i grunnen (kumanvisere, stolper) | 358 |
| **UO** | **Utendørs ventiler og utstyr** | 308 |
| **UO2.1** | **Utendørs stengeventiler** | 317 |
| UO2.73 | Utendørs brannventiler og -hydranter | 325 |

**Følgene:** sandfang hører i UP3, ikke i UP1 · Baio-kummen hører i UO2.1, ikke i UP-kapittelet i det hele tatt ·
og brannkumskiltet har sin egen post, UP8.2, som bekrefter at skiltet er noe eget.

✅ **UP2 «Inspeksjonskummer» — meldt som hull, og gatet i samme runde.** v1 hadde «Inspeksjonskum» som
svaralternativ. Med delingen falt det ut av UP1, siden UP1 er nedstigningskummer. Design meldte hullet og
anbefalte en fjerde mal; **Kenneth gatet den umiddelbart: «ja, ta UP2 som fjerde mal.»** Malen står i § 6b, og
ingen inspeksjonskum havner dermed i «Annen kum».

## 4. ✅ Fasemålingen er BESVART — POSITIV

**Mal-Opus, levert i `relay/inbox-design.md` 2026-09-22:** ja, et barn kan ha annen fase enn forelderen. Verste
tilfelle — forelder UNDER, barn ETTER, som brannkumskiltet i UO2.1 — er empirisk bekreftet i `byggBibliotekRader`,
`skriv-mal`, generator-SQL og en ekte Postgres parse-test med self-FK på `parent_id`. Trekoblingen er uavhengig av
rekkefølge, barnet vises under sin egen ETTER-overskrift, og self-FK-en holder på tvers av fasegrensen.

✅ **Ingen stopp-og-meld. De fire malene kan bygges med fasene som beskrevet.** Tre ikke-blokkerende edger står i
relay-leveransen.

### Opprinnelig målebestilling, beholdt som historikk

**Kan et barn ha en annen fase enn forelderen?** Typefeltet er FØR. Renneløp, ventil og uttak kontrolleres
**UNDER**, og brannkumskiltet **ETTER**. I JH2 lå alle barna i samme fase som forelderen, så dette er utestet —
og her gjelder det både barn og barnebarn.

- `byggBibliotekRader` gir barna `sortOrder` rett etter forelderen. Grupperer utfyllingen på fase, havner barnet
  i sin egen fase med lav `sortOrder`. Grupperer den på `sortOrder` alene, brytes fasene.
- **Mål det, ikke anta det.** Virker det rent: behold fasene. Virker det ikke: **stopp og meld** — design tar
  stilling, ikke du.
- Verste tilfelle: skiltet i UO2.1, der forelderen er UNDER og barnet ETTER.

## 5. 🔴 Basisfeltene deles av alle fire malene — ordrett

**Ti** felt gjelder enhver nedsetting i grøft og skal være **ord for ord identiske** i alle fire maler:

| # | Felt | Type |
|---|---|---|
| B1 | Kum og deler kontrollert | `valg` |
| B2 | Grøftebunn og fundament klare | `trafikklys` |
| B3 | Plassering | `valg` |
| B4 | Skjøter og gjennomføringer | `valg` |
| **B5** | **Oppdrift og vann i grøfta** | **`valg` — NYTT, se under** |
| B6 | Omfylling rundt kummen | `valg` |
| B7 | Justeringsringer og ramme | `valg` |
| B8 | Lokk eller rist | `valg` |
| B9 | Lokkhøyde mot dekket | `valg` |
| B10 | Ren, innmålt og klar | `trafikklys` |

**Alternativer og hjelpetekster tas ordrett fra dagens `UP1_MAL`**, med to unntak:

- **B1 og B6**, ordet «kummen» byttes til **«enheten»** i UO2.1, siden en nedgravd ventil ikke er en kum.
- **B7**, hjelpeteksten utvides i UO2.1: en nedgravd ventil har teleskop og deksel, ikke justeringsringer og
  topplate.

### 🔴 B5 «Oppdrift og vann i grøfta» — NYTT basisfelt, gatet av Kenneth 2026-09-22

Kenneth: **«behold oppdrift, husk at dette gjelder alle kummer som monteres i grunnvann, spesielt plast.»**

Design la først oppdrift i plastgrenen (M3). **Det var for smalt.** Oppdrift gjelder **enhver** kum som settes i
vann — plast er bare den letteste. Derfor er det et **basisfelt**, alltid synlig i alle fire maler, og **plassert
før omfyllingen**, fordi sikringen må stå før massene kommer.

**B5. Oppdrift og vann i grøfta** — `valg`
- Tørt i grøfta – ingen fare for oppdrift
- Vann i grøfta – sikret mot oppdrift før omfylling
- Avvik – ikke sikret

> Står det vann i grøfta, kan kummen løfte seg. Det gjelder alle kummer, og særlig kummer av plast, som er lette. Sikringen — ballast, forankring eller lensing — skal være på plass FØR omfyllingen begynner. En kum som har løftet seg, ser riktig ut helt til dekket sprekker eller fallet snur.

🔴 **Rekkefølgen er en del av kravet.** B5 skal stå **før** B6 «Omfylling», ikke etter. Et felt som spør om
oppdriftssikring etter at omfyllingen er kvittert, er for sent til å hjelpe noen.

🔴 **Delt-tekst-test:** en test som låser at B1–B6 og B8–B10 er **ord for ord identiske** på tvers av de fire
malene. Rød først. Uten den drifter de fra hverandre ved første revisjon av én av dem, og da kan ingen
sammenligne kontrollen av to kummer i samme grøft. Samme regel som gjorde at fasitfilen ble innført.

🔴 **B4 «Skjøter og gjennomføringer» passer dårlig på en nedgravd ventil.** Bygg det likevel som alltid synlig i
alle fire — design gater det etter bruk. **Ikke forgren det på eget initiativ.**

## 5b. 🔴 Materialeblokken — en ANDRE delt blokk, i UP1, UP2 og UP3

**Kenneth 2026-09-22: «materiale gjelder for UP1 også.»** Design hadde bare lagt materiale i UP2. Normmålingen
bekrefter at det gjelder bredere — og at design tok feil om UP3:

| Post | Normens underposter | Side |
|---|---|---|
| UP1.1 / UP1.2 / UP1.3 | betongelementer · kumbunn av plasstøpt betong · plast | 341 / 345 / 346 |
| UP2.1 / UP2.2 | plast · betong | 347 |
| UP3.1–UP3.4 | betong m/dykker · betong u/dykker · plast m/dykker · plast u/dykker | 348 |
| UP3.5 | hjelpesluk | 348 |

🔴 **Design tok feil om UP3 og retter seg:** ordren sa «UP3 — ingen forgrening, alle felt alltid synlige. Det er
hele gevinsten ved å skille den ut.» **Det var galt.** UP3 deler både på materiale og på dykker, og har hjelpesluk
som egen underpost. Gevinsten ved å skille UP3 ut er fortsatt reell — et sandfang slipper spørsmål om renneløp og
ventil — men den er ikke «ingen forgrening».

### Materialefeltet og barna — deles ordrett

**M1. Materiale** — `valg` · **forelder**. **Alternativene varierer pr. mal:**

| Mal | Alternativer |
|---|---|
| UP1 | Betongelementer · Kumbunn av plasstøpt betong · Plast |
| UP2 | Betong · Plast |
| UP3 | Betong · Plast |

**M2. Kumskjøt og pakninger** — `valg` · **vises for betong** *(i UP1: «Betongelementer»)*
- Elementer med falsskjøt og glidering som beskrevet
- Avvik

> Elementene skjøtes med falsskjøt og glidering, eller med not og fjær, etter beskrivelsen. Krav om T-merking der kummen skal være tett, dekkes av kontrollen av kum og deler.

**M3. Oppføringsrør og form** — `valg` · **vises for «Plast»**
- Kappet i riktig høyde, røret er rundt og uskadd
- Avvik

> Oppføringsrøret kappes så rammen får jevnt anlegg og lokket kommer i riktig høyde. Kontroller at røret ikke er blitt ovalt av gravemaskin eller ensidig omfylling — en deformert kum kan ikke spyles eller filmes. Oppdrift dekkes av eget kontrollpunkt, som gjelder alle materialer.

🔴 **Oppdrift er FLYTTET ut av M3** til basisfeltet B5 (§ 5), etter Kenneths retting: «dette gjelder alle kummer
som monteres i grunnvann, spesielt plast». **Legg det ikke tilbake her.** Siste setning i hjelpeteksten er
krysshenvisningen som hindrer at noen bygger det to steder.

**M4. Plasstøpt kumbunn** — `valg` · **vises for «Kumbunn av plasstøpt betong»** · **KUN i UP1**
- Forskaling, gjennomføringer og renneløp støpt som beskrevet
- Avvik

> Rørgjennomføringene skal støpes inn tette, og renneløpet skal få det fallet og løpet beskrivelsen angir. Betongen skal ha herdet før kummen belastes. Dette er den ene kumtypen der bunnen ikke kan byttes hvis den blir feil.

🔴 **M2 og M3 skal være ord for ord identiske i UP1, UP2 og UP3.** Betong er betong. **Delt-tekst-testen utvides
til å dekke materialeblokken**, ikke bare basisfeltene. **M4 finnes bare i UP1** og er unntatt.

🔴 **UO2.1 har INGEN materialeblokk.** Den er en ventilpost, ikke en kumpost, og normen deler den ikke på
materiale. **Legg den ikke inn der.**

---

## 6. Mal 1 — `UP1` «Nedstigningskum i grunnen» (REVISJON)

```
kapittelKode: "UP"
referanse:    "UP1"
navn:         "UP1 – Nedstigningskum i grunnen"
beskrivelse:  "Setting av nedstigningskum i grunnen — type og plassering, fundament, skjøter, kumbunn, omfylling, ramme og lokk. Én kum per sjekkliste. Faglig grunnlag: NS 3420-U:2019, post UP1."
```

Revisjon: `version + 1`.

**1. Type kum** — `valg` · **forelder for felt 2–4**
- Spillvannskum (SP)
- Overvannskum (OV)
- Felleskum (AF)
- Vannkum (V)
- Annen kum – se beskrivelsen

> Skriv kummens prosjektnavn i emnefeltet, slik det står på tegningen — for eksempel V-01 eller V01. Bruk samme skrivemåte gjennom hele prosjektet, ellers havner kummene i ulike bunker når de sorteres. Det er slik kummen finnes igjen senere. Én kum per sjekkliste — settes flere kummer i samme kumgruppe, fylles én liste for hver. Typen avgjør hvilke kontrollpunkter som vises under.

🔴 **Hjelpeteksten står ordrett** (Kenneth: «disse forklaringer i hjelpetekst er nyttig» og «SP-04–SP-05 er litt
mange dash» — derfor er eksempelet `V-01 eller V01`, uten tankestrek). **Sandfangkum og Baio-kum er ute av
listen** — de har egne maler.

**2. Renneløp gjennom kummen** — `valg` · **vises for SP, OV og AF**
- Riktig løp og fall
- Avvik

> Bunnseksjonen skal ha det løpet beskrivelsen angir, med jevnt fall gjennom kummen, uten kanter eller sprang som samler slam. Kum med mellomdekke skal ha nedstigningsåpningene forskjøvet i forhold til hverandre.

**3. Hovedventil** — `valg` · **vises for V**
- Riktig type og stilling, spindel kan betjenes
- Avvik

> Ventiltype og dimensjon står i beskrivelsen. Spindelen skal kunne betjenes, og stillingen skal være som prosjektert ved overlevering. Kontroller at ventilen ikke er skadet under nedsetting.

**4. Brannvannsuttak på ventilen** — `valg` · **vises for V** · **forelder for felt 5**
- Ja – kummen er brannkum
- Nei – ordinær vannkum

> Har ventilen uttak for brannvann, er kummen en brannkum. Den heter fortsatt V i emnefeltet — det er dette svaret som skiller den ut. Kontroller at uttaket har den kuplingen beskrivelsen angir, at det er fri adkomst, og at det er frostsikret slik beskrivelsen krever.

**5. Brannkumskilt** — `valg` · **vises når felt 4 = «Ja – kummen er brannkum»**
- Skilt montert med avstand og retning
- Skilt ikke montert – utestår
- Avvik

> Brannkummen markeres med skilt som viser avstand og retning fram til kummen, slik at brannvesenet finner den. Skiltet skal stå før overlevering. Ta bilde av skiltet.

**6. Stikkledningsuttak fra kummen** — `valg` · **vises for V** · **gatet av Kenneth 2026-09-22**
- Ingen stikkledninger fra denne kummen
- Uttak montert som beskrevet, avstenging kan betjenes
- Avvik

> Kenneth 2026-09-22: kommunen ønsker i noen tilfeller at stikkledninger kobles fra vannkummen i stedet for med anboring på hovedledningen. Er det beskrevet, skal uttakene ha den dimensjonen og avstengingen beskrivelsen angir, og avstengingen skal kunne betjenes etter at kummen er satt. «Ingen stikkledninger» er et gyldig svar — de fleste vannkummer har ingen.

🔴 **Feltet hører i UP1, ikke i UM1.1** — gatet av Kenneth: «stikkledning i UP1». Sitatet i hjelpeteksten over er
en **kilde­merknad til mal-Opus og skal IKKE stå i malen** — hjelpeteksten begynner med «Kommunen ønsker i noen
tilfeller …». Resten står ordrett.

**Deretter materialeblokken M1–M4** (§ 5b), med alle tre alternativene, og **deretter basisfeltene B1–B10** (§ 5) i
denne rekkefølgen: B1, B2 i FØR · B3, B4, B5 i UNDER · B6, B7, B8, B9 i ETTER.

**To foreldre i denne malen:** felt 1 «Type kum» og M1 «Materiale». Uavhengige trær, som i UM1 v2 — bruk **to
ulike `ref`-verdier** (`kumtype`, `materiale`) og la strukturtesten vise at de ikke blander seg.

**Utgår fra v1:** «Sandfangkum» og «Inspeksjonskum» fra typelisten (egne maler) · «Sandvolum og høyde til utløp»
som felt (flyttet til UP3) · «Ikke aktuelt» på renneløp, fordi feltet nå bare vises for kummer som **har**
renneløp (§1c).

**Struktur:** 20 felt. Tolv alltid synlige (1, M1, B1–B10). Én kumtype-gren og én materialegren vises i tillegg:
en betongkum på spillvann viser tretten · en plastkum på vann uten uttak fjorten · en brannkum av betong femten.

---

## 6b. Mal 2 — `UP2` «Inspeksjonskum i grunnen» (NY)

**Gatet av Kenneth 2026-09-22: «ja, ta UP2 som fjerde mal.»** Dermed er hullet i § 3 lukket i samme runde, og
ingen inspeksjonskum havner i «Annen kum».

```
kapittelKode: "UP"
referanse:    "UP2"
navn:         "UP2 – Inspeksjonskum i grunnen"
beskrivelse:  "Setting av inspeksjonskum i grunnen — materiale, gjennomløp, skjøt, fundament, omfylling, ramme og lokk. Én kum per sjekkliste. Faglig grunnlag: NS 3420-U:2019, post UP2."
```

**Normgrunnlaget (normside 347):** UP2.1 er inspeksjonskum **av plast** med gjennomløp (rett, med én avgrening,
med to avgreninger) og diameter DN 315–630. UP2.2 er **av betong** med kumskjøt (falsskjøt med glidering, eller
not og fjær) og gjennomløp (rett, rett med plastliner, Y, Y med plastliner). **Materialet er det som avgjør hvilke
krav som gjelder** — derfor er det forelderen.

**1. Gjennomløp og fall** — `valg` · **forelder for felt 2**
- Riktig gjennomløp og jevnt fall
- Avvik

> Skriv kummens prosjektnavn i emnefeltet, slik det står på tegningen — for eksempel SP-07. Bruk samme skrivemåte gjennom hele prosjektet. Gjennomløpet skal være det beskrivelsen angir — rett, med avgreining, eller Y — med jevnt fall gjennom kummen. Kontroller mot tegningen at avgreiningene peker rett vei før omfylling.

**2. Plastliner i gjennomløpet** — `valg` · **vises når felt 1 = «Riktig gjennomløp og jevnt fall»**
- Liner hel, overgang mot røret tett
- Ikke krevd i beskrivelsen
- Avvik

> Normen har gjennomløp både med og uten plastliner. Er liner beskrevet, skal den være hel og overgangen mot røret tett — en revnet liner gir slitasje og innlekking, og den kan ikke byttes uten å grave opp.

**3. Kummen kan spyles og inspiseres fra overflaten** — `trafikklys`

> En inspeksjonskum er for liten å gå ned i — hele hensikten er at ledningen kan spyles og filmes herfra. Kontroller at det er fri passasje ned og at gjennomløpet er rent før lokket legges på.

**Deretter materialeblokken M1–M3** (§ 5b) med alternativene **Betong · Plast** — **ikke** M4, som bare finnes i
UP1 — og **deretter basisfeltene B1–B10** (§ 5), i samme rekkefølge som i UP1.

**To foreldre:** felt 1 «Gjennomløp og fall» og M1 «Materiale». To ulike `ref`-verdier.

🔴 **Kumskjøtfeltet skal IKKE dupliseres.** Design skrev først et eget «Kumskjøt og plastliner»-felt i UP2. Det er
nå delt opp riktig: **skjøten hører i materialeblokkens M2** (delt med UP1 og UP3), og **plastliner hører i felt 2**,
fordi liner er en egenskap ved gjennomløpet og ikke ved skjøten. **Bygg ikke begge i ett felt.**

**Struktur:** 15 felt. Tolv alltid synlige (1, 3, M1, B1–B10). Betong med liner viser fjorten, plast med liner
tretten.

🔴 **Ingen nedstigningsfelt.** Malen skal **ikke** ha mellomdekke, stige eller nedstigningsåpning — kummen er
DN 315–630 og kan ikke gås ned i. Det er nettopp det som skiller den fra UP1, og feltet «kummen kan spyles og
inspiseres fra overflaten» er konsekvensen.

---

## 7. Mal 3 — `UP3` «Sandfangkum og hjelpesluk» (NY)

```
kapittelKode: "UP"
referanse:    "UP3"
navn:         "UP3 – Sandfangkum og hjelpesluk"
beskrivelse:  "Setting av sandfangkum og hjelpesluk i grunnen — sandvolum, dykker, tilgang for tømming, fundament, omfylling, ramme og rist. Én kum per sjekkliste. Faglig grunnlag: NS 3420-U:2019, post UP3."
```

🔴 **Normen deler UP3 i fem underposter** (normside 348): UP3.1–UP3.4 er **betong eller plast × med eller uten
dykker**, og **UP3.5 er hjelpesluk**. Det gir to foreldre, ikke ingen — se rettingen i § 5b.

**1. Type** — `valg` · **forelder for felt 2 og 3**
- Sandfangkum
- Hjelpesluk

> Skriv kummens prosjektnavn i emnefeltet, slik det står på tegningen — for eksempel SF-03. Bruk samme skrivemåte gjennom hele prosjektet. Et hjelpesluk har ikke sandfangvolum, så de to kontrolleres ulikt.

**2. Sandvolum og høyde til utløp** — `valg` · **vises for «Sandfangkum»**
- Minst 0,8 m³ og 1 m
- Under kravet

> Sandvolumet bør ikke være mindre enn 0,8 m³, og høyden fra bunn til utløp bør være minst 1 m. Noter målt verdi i kommentaren.

**3. Dykker og tilgang for tømming** — `valg` · **vises for «Sandfangkum»**
- Dykker montert, kummen kan tømmes
- Dykker ikke krevd i beskrivelsen
- Avvik

> Normen har sandfang både med og uten dykker, så «ikke krevd» er et gyldig svar og ikke en unnvikelse. Dykkeren holder flytende materiale tilbake og skal sitte som beskrevet. Kummen må stå slik at slamsugebil kommer til — er adkomsten sperret etter at anlegget er ferdig, kan kummen ikke driftes.

**Deretter materialeblokken M1–M3** (§ 5b) med alternativene **Betong · Plast** — **ikke** M4 — og **deretter
basisfeltene B1–B10** (§ 5). **B7 «Lokk eller rist»** er særlig aktuell her, siden et sandfang normalt har rist;
alternativene er uendret.

**To foreldre:** felt 1 «Type» og M1 «Materiale». To ulike `ref`-verdier.

**Struktur:** 15 felt. Tolv alltid synlige (1, M1, B1–B10). Et sandfang av betong viser femten, et hjelpesluk av
plast tolv.

🔴 **Rettelse fra forrige versjon av ordren:** design skrev «ingen forgrening, alle felt alltid synlige — det er
hele gevinsten ved å skille den ut». **Det var galt**, og normen sier noe annet. Gevinsten er fortsatt reell — et
sandfang slipper spørsmål om renneløp, ventil og brannuttak — men den er ikke fravær av forgrening.

---

## 8. Mal 4 — `UO2.1` «Nedgravd stengeventil» (NY, NYTT KAPITTEL)

```
kapittelKode: "UO"
referanse:    "UO2.1"
navn:         "UO2.1 – Nedgravd stengeventil"
beskrivelse:  "Setting av nedgravd stengeventil med gatelokk — ventil, brannvannsuttak, teleskop og deksel, omfylling og lokkhøyde. Én ventil per sjekkliste. Faglig grunnlag: NS 3420-U:2019, post UO2.1."
```

🔴 **Nytt kapittel `UO` «Utendørs ventiler og utstyr» i standard `NS3420-U`.** Normens rekkefølge er UM (249),
**UO (308)**, UP (339), UU (374). Dagens seed har **UM=1, UP=2, UU=3** (`seed-bibliotek.ts:1927`). UO skal
derfor inn på **sortering 2**, og **UP flyttes til 3, UU til 4** — `--sorter UP=3 --sorter UU=4`. **Meld hvilke
søstre som flyttes og bekreft at ingen lånt mal mister sin plass.**

**1. Hovedventil** — `valg` · **forelder for felt 2**
- Riktig type og stilling, spindel kan betjenes
- Avvik

> Skriv ventilens prosjektnavn i emnefeltet, slik det står på tegningen — for eksempel V-04. Bruk samme skrivemåte gjennom hele prosjektet. Ventiltype og dimensjon står i beskrivelsen. Spindelen betjenes gjennom dekselet — prøv avstengingen før gatelokket legges på plass.

**2. Brannvannsuttak på ventilen** — `valg` · **forelder for felt 3**
- Ja – ventilen har brannvannsuttak
- Nei – ordinær stengeventil

> Har ventilen uttak for brannvann, skal uttaket ha den kuplingen beskrivelsen angir, det skal være fri adkomst, og det skal være frostsikret slik beskrivelsen krever.

**3. Brannkumskilt** — `valg` · **vises når felt 2 = «Ja – ventilen har brannvannsuttak»**
- Skilt montert med avstand og retning
- Skilt ikke montert – utestår
- Avvik

> Uttaket markeres med skilt som viser avstand og retning fram til det, slik at brannvesenet finner det. Skiltet skal stå før overlevering. Ta bilde av skiltet.

**4. Spindelforlenger og forankring** — `valg`
- Montert som beskrevet, ventilen står stabilt
- Avvik

> Spindelforlengeren monteres på ventiltoppen og fungerer samtidig som forankring i grunnen. Kontroller at den står i lodd og i riktig høyde før gjenfylling — etterpå kommer ingen til.

**Deretter basisfeltene B1–B10** (§ 5), med de to ordbyttene fra § 5: «enheten» i B1 og B6, og utvidet hjelpetekst
i B6.

🔴 **Ingen renneløp, ingen nedstigning.** Men gatelokket ligger i vei, så **B7 og B8 gjelder fullt ut** —
styrkeklasse etter beskrivelsen og +0/−10 mm mot ferdig dekke. **ETTER-bolken skal ikke forgrenes.** Design
antok først at den måtte; Kenneth rettet det: kummen har gatelokk.

**Struktur:** fjorten felt. Tretten alltid synlige; skiltet vises bare ved brannvannsuttak.

✅ **GATET 2026-09-22: «bruk normens ord for baio».** Malen heter **UO2.1 – Nedgravd stengeventil**, og **ordet
«Baio» skal ikke forekomme noe sted** — verken i navn, beskrivelse, feltnavn eller hjelpetekst.

🔴 **§7b-testen for `uo2-1-mal.test.ts` skal derfor forby både «Baio», «Bajo» og «bajonett».** Produktnavnet er
utelukket fordi det er én leverandørs varemerke og ikke en generisk betegnelse slik Ab og Ska er i asfalt. Det
står i ordren her, slik at ingen senere runde «hjelpsomt» legger det inn igjen for gjenkjennelighet.

---

## 9. Rammer

- §7b-sjekk i `up1-mal.test.ts`, `up2-mal.test.ts`, `up3-mal.test.ts` og `uo2-1-mal.test.ts`: ingen `Matrise`,
  `NS-EN`, `NS 3420`, ingen referanse som prefiks i feltnavn, og **ingen forekomst av «bajonett»**. I `uo2-1-mal.test.ts` i tillegg: ingen «Baio» og ingen «Bajo» (§ 8).
  Forkortelsene SP, OV, AF, V og SF er prosjekteringsbetegnelser og er tillatt (§7c).
- **Strukturtest pr. mal — alle har nå TO foreldre unntatt UO2.1:** UP1 — kumtype og materiale som to uavhengige
  trær, renneløp har tre utløsere, ventil én, skiltet er barn av uttaksfeltet. UP2 — gjennomløp og materiale.
  UP3 — type og materiale; sandvolum og dykker bare for sandfangkum. UO2.1 — skiltet er barn av uttaksfeltet. Rød først.
- **Delt-tekst-test** på basisfeltene (§ 5) på tvers av alle fire, OG på materialeblokkens M2 og M3 (§ 5b) på tvers av UP1, UP2 og UP3. Rød først.
- 🔴 **Negativ test i UP2:** malen skal **ikke** inneholde mellomdekke, stige eller nedstigningsåpning, og **ikke**
  T-merking noe sted (den hører i B1). Negative krav glemmes oftest — de skal testes.
- Utløsere ligger på barnets **eget** sett (`BETINGELSE_EGEN_NOKKEL`), aldri `conditionValues`. Bruk
  `forgrening`.
- Fasit (§8) og `skriv-mal` viser trærne for alle fire. Ingen i18n-nøkler. Ingen endring i `packages/shared` eller
  appene. Prod-gaten røres ikke. Ingen migrering.
- Gate-tall via `pnpm exec turbo run test --force`.

## 10. SQL og DoD

Fire kall: `generer-mal-sql.ts UP1 revisjon` · `UP2 ny` · `UP3 ny` · `UO2.1 ny`. **UO2.1 krever nytt kapittel UO
på sortering 2 med `--sorter UP=3 --sorter UU=4`.** UP2 og UP3 går i eksisterende kapittel UP og trenger ingen
`--sorter`. Lever alt i **én transaksjon pr. mal**, parse-test mot engangsdatabase, slett den etterpå, lever de
tre enlinjerne pr. fil. **Ikke kjør mot test selv.**

**DoD:**
1. ✅ Målingen i § 4 er besvart og positiv — ingen sperre. (Punktet beholdes som spor.)
2. **Fire** maler som over, ordrett, med riktige foreldre og utløsersett.
3. Basisfeltene identiske på tvers av alle fire, låst av delt-tekst-testen.
4. Strukturtester, negativ test i UP2 og §7b-sjekker grønne, fasit oppdatert i samme branch.
5. **Tekstbevis:** `skriv-mal` for alle fire limt i leveransen, som viser hvilke svar som utløser hvilke felt.
6. Kapittel-innsettingen meldt: hvilke søstre ble flyttet, og at ingen lånt mal mistet sin plass.
7. Gate-bygg med gate-tall.
8. Diff: `seed-bibliotek.ts`, de **fire** testfilene, `KAPITTEL_DATA_U`, `mal-fasit.snap.md` og SQL-filene. Rører
   du noe annet, meld hvorfor.
9. Leveranse nederst i hovedtreets `relay/inbox-design.md` + «design har post».

## 11. Åpent for Kenneth før SQL

1. ~~**UP2 «Inspeksjonskum»**~~ ✅ **GATET 2026-09-22: «ja, ta UP2 som fjerde mal.»** Malen står i § 6b.
   ✅ **Og forelderen er gatet 2026-09-22: «materiale, det er skillet i praksis».** Design spurte om det i stedet
   burde være gjennomløpet; svaret er materiale, både i normen og i felt. **M1 «Materiale» er forelder i UP2, og
   det skal ikke stokkes om.**
2. ~~**«Baio» i beskrivelsen**~~ ✅ **GATET 2026-09-22: «bruk normens ord for baio».** Malen heter «Nedgravd
   stengeventil», og «Baio» forekommer ikke noe sted. §7b-testen forbyr det (§ 8).
3. ~~**Stikkledning fra vannkum**~~ ✅ **GATET 2026-09-22: «stikkledning i UP1».** Felt 6 i UP1, i vannkum-grenen
   (§ 6).
4. ✅ **Oppdrift: GATET 2026-09-22** — «behold oppdrift, husk at dette gjelder alle kummer som monteres i
   grunnvann, spesielt plast». Flyttet fra plastgrenen til basisfeltet B5, alltid synlig, plassert før omfyllingen
   (§ 5).

✅ **INGENTING STÅR ÅPENT FOR KENNETH I DENNE ORDREN.** Alle punkter er gatet 2026-09-22. Malene kan bygges når
JH2 v2 er merget. **Fasemålingen i § 4 er besvart og positiv**, så ingenting annet står i veien.

---

🔴 **MEKANISME-RETTING 2026-09-23 — gjelder foran denne ordrens bokstav.**

Ordren sier «bruk `forgrening`». Den ble skrevet før `forelderFelt` + `barnAv` fantes
(`seed-bibliotek.ts:218`/`:228`, lagt til av mal-Opus i KD1 v3). **Gjeldende regel er MAL-METODE §1f:**

- **Samme fase** som forelderen → `forgrening`
- **Annen fase** enn forelderen → **`forelderFelt` + `barnAv`**

Denne malen har typeforeldre i **FØR** med barn i **UNDER** og **ETTER**. Der skal `barnAv` brukes. Utføreren
melder i leveransen hvilken hjelper som ble brukt hvor.
