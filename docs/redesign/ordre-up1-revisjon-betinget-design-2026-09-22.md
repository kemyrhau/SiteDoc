# Ordre: UP1 v2 – kum i grunnen med betingede felt, og kumnavnet i emnefeltet

**Til:** mal-Opus · **Fra:** design · **Dato:** 2026-09-22
**Metode:** MAL-METODE §1, §1c, §1e, §6a, §6b, §7b, §8 og §8b.
**Branch:** `feat/mal-up1-betinget` fra `origin/develop` **etter at JH2 v2 er merget** — `forgrening` er forutsetningen.
**Gatet av Kenneth 2026-09-22:** kumtypene, forkortelsene, at renneløp er felles for SP/OV/AF, og at brannkum er
egen type.

Andre mal som bruker betingede felt. JH2 var piloten; her brukes mønsteret på en mal der forgreningen følger **typen
objekt**, ikke typen underlag.

---

## 1. Hvorfor — Kenneths behov, i hans egne ord

> «ut av dette så trenger vi i emnefeltet for kummer og fortelle hvilken kum (kummens prosjektnavn) → da kan vi sortere
> ut riktig kumtype → sortere på spillvannskum, Felleskum, Overvannskum, vannkum og sandfangkummer → hvis vi blandeer
> kummer vil dette bli umulig»

Det gir to krav som henger sammen:

1. **Ett dokument per kum.** Blandes flere kummer i ett dokument, kan ingen av dem finnes igjen. Design foreslo først
   gjentakelse (kumgruppe som dokumentenhet) og sammenslåing av UM1 og UP1 — **Kenneth avslo begge**: «jeg tror vi
   effektiviserer litt for langt.» Ikke bygg noen av dem.
2. **Kumnavnet står i emnefeltet.** Emnet er ikke en merkelapp her — det er kummens identitet (SP-01, OV-03, V-02).
   Malen skal si det, i hjelpeteksten på typefeltet.

Dagens typeliste bommer på behovet: den skiller på byggemåte (nedstigningskum, sandfangkum, inspeksjonskum), mens
Kenneth sorterer på **funksjon**. Derfor byttes listen.

## 2. Terminologi — gatet av Kenneth, bruk ordrett

| Type | Forkortelse | Kenneths ord |
|---|---|---|
| Spillvannskum | SP | «SP (spillvann) … dette er de korrekte forkortelser» |
| Overvannskum | OV | «OV (overvann)» |
| Felleskum | AF | «AF (Avløp Felles)» |
| Vannkum | V | «V (vannkum)» |
| Sandfangkum | SF | «SF (sandfang)» |

**Alle tre avløpskummene (SP, OV, AF) har renneløp i bunnen** — Kenneth 2026-09-22: «alle disse har renneløp i bunnen».
AF behandles derfor i samme gruppe som SP og OV, ikke særskilt (gatet 2026-09-22).

🔴 **Brannkum er IKKE en egen type.** Design foreslo først brannkum som eget valg i typelisten. Kenneth avviste det
2026-09-22:

> «i sjekklister blir disse vannkum og det blir på ventilen merket at det er brannuttak → i praksis henger man opp et
> skilt som markerer brannkummen med avstand og retning fra skiltet»

**Følgen for malen:** typelisten har seks valg, ikke sju. Brannkummen er en **vannkum (V)**, også i emnefeltet, og
uttaket registreres på ventilen. Skiltet med avstand og retning blir et eget kontrollpunkt som bare vises når uttaket
finnes. Brannkummer sorteres altså ikke på emneprefiks, men på svaret i uttaksfeltet — og det er riktig, fordi det er
sånn de er merket i marka.

## 3. Treet — én forelder, tre grupper barn, og ett barnebarn

`forgrening("kumtype", …)` med typefeltet som forelder, og en nøstet `forgrening("brannuttak", …)` under vannkummen —
samme form som JH2 bruker for klebing → trafikk på klebet flate.

| Utløser | Barn |
|---|---|
| SP · OV · AF | Renneløp gjennom kummen |
| SF | Sandvolum og høyde til utløp · Dykker og tilgang for tømming |
| V | Hovedventil · Brannvannsuttak på ventilen |
| ↳ «Ja – kummen er brannkum» | Brannkumskilt – avstand og retning |

**Hvorfor brannuttaket ligger under vannkummen og ikke i typelisten:** fordi det er slik kummen faktisk er merket.
Uttaket registreres på ventilen, og skiltet står i terrenget med avstand og retning. Typelisten skal svare på hva
kummen **er** — en vannkum — mens uttaket er en egenskap ved ventilen. Da blir også emneprefikset entydig: alle vannkummer
heter V, uansett om de har uttak.

🔴 **To feller i `forgrening`:**

1. **To barn under samme utløser må være to egne poster** i `barn`-arrayet, med samme `naar`. Legger du dem som
   `felt: [a, b]`, får bare `a` (`hode`) sin `parentRef` — `b` blir stående som et vanlig, alltid synlig felt
   (`seed-bibliotek.ts:197–206`). Det gjelder **sandfang-paret** (felt 3 og 4) og **vannkum-paret** (felt 5 og 6).
2. **Formen `felt: [a, b]` er til nøstet `forgrening`**, der de øvrige radene alt har sin egen `parentRef`. Det er den
   formen brannuttaket skal bruke: posten for felt 6 er `felt: forgrening("brannuttak", …)` med skiltet som sitt barn.

## 4. Dette skal måles før du bygger — og meldes

**Kan et barn ha en annen fase enn forelderen?** Typefeltet er FØR. Renneløp, sandvolum, dykker, ventil og uttak
kontrolleres **UNDER** setting, og brannkumskiltet **ETTER**. I JH2 lå alle barna i samme fase som forelderen, så dette
er utestet — og her gjelder det både barn og barnebarn.

- `byggBibliotekRader` gir barna `sortOrder` rett etter forelderen. Grupperer utfyllingen på fase, havner barnet i sin
  egen fase med en lav `sortOrder` — altså først i UNDER-bolken. Grupperer den på `sortOrder` alene, brytes fasene.
- **Mål det, ikke anta det.** Virker det rent: behold fasene under. Virker det ikke: **stopp og meld** — da tar design
  stilling til om barna skal ligge i FØR sammen med forelderen, eller om appen må rettes først. Ikke velg selv.
- Skiltet er det verste tilfellet: forelderen (felt 6) er UNDER, barnet (felt 7) er ETTER. Er dette det ene som ikke
  virker, meld det særskilt — da kan skiltet eventuelt flyttes til UNDER med en hjelpetekst om at det monteres før
  overlevering, men det er **designs** valg, ikke ditt.

## 5. Malen (v2)

```
kapittelKode: "UP"
referanse:    "UP1"
navn:         "UP1 – Setting av kum i grunnen"
beskrivelse:  "Setting av kum i grunnen — type og plassering, fundament, skjøter, kumbunn, omfylling, ramme og lokk. Faglig grunnlag: NS 3420-U:2019, post UP1."
```

Revisjon: `version + 1`.

### Kontroll FØR utførelse

**1. Type kum** — `valg` · **forelder for felt 2–6**
- Spillvannskum (SP)
- Overvannskum (OV)
- Felleskum (AF)
- Vannkum (V)
- Sandfangkum (SF)
- Annen kum – se beskrivelsen

> Skriv kummens prosjektnavn i emnefeltet, for eksempel SP-01. Det er slik kummen finnes igjen og sorteres på type senere. Én kum per sjekkliste — settes flere kummer i samme kumgruppe, fylles én liste for hver. Typen avgjør hvilke kontrollpunkter som vises under.

**2. Renneløp gjennom kummen** — `valg` · **vises for SP, OV og AF**
- Riktig løp og fall
- Avvik

> Bunnseksjonen skal ha det løpet beskrivelsen angir, med jevnt fall gjennom kummen, uten kanter eller sprang som samler slam. Kum med mellomdekke skal ha nedstigningsåpningene forskjøvet i forhold til hverandre.

**3. Sandvolum og høyde til utløp** — `valg` · **vises for SF**
- Minst 0,8 m³ og 1 m
- Under kravet

> Sandvolumet bør ikke være mindre enn 0,8 m³, og høyden fra bunn til utløp bør være minst 1 m. Noter målt verdi i kommentaren.

**4. Dykker og tilgang for tømming** — `valg` · **vises for SF**
- Dykker montert, kummen kan tømmes
- Dykker ikke krevd i beskrivelsen
- Avvik

> Dykkeren holder flytende materiale tilbake og skal sitte som beskrevet. Kummen må stå slik at slamsugebil kommer til.

**5. Hovedventil** — `valg` · **vises for V**
- Riktig type og stilling, spindel kan betjenes
- Avvik

> Ventiltype og dimensjon står i beskrivelsen. Spindelen skal kunne betjenes fra overflaten, og stillingen skal være som prosjektert ved overlevering. Kontroller at ventilen ikke er skadet under nedsetting.

**6. Brannvannsuttak på ventilen** — `valg` · **vises for V** · **forelder for felt 7**
- Ja – kummen er brannkum
- Nei – ordinær vannkum

> Har ventilen uttak for brannvann, er kummen en brannkum. Den heter fortsatt V i emnefeltet — det er dette svaret som skiller den ut. Kontroller at uttaket har den kuplingen beskrivelsen angir, at det er fri adkomst, og at det er frostsikret slik beskrivelsen krever.

**7. Brannkumskilt** — `valg` · **vises når felt 6 = «Ja – kummen er brannkum»**
- Skilt montert med avstand og retning
- Skilt ikke montert – utestår
- Avvik

> Brannkummen markeres med skilt som viser avstand og retning fra skiltet til kummen, slik at brannvesenet finner den. Skiltet skal stå før overlevering. Ta bilde av skiltet.

**8. Kum og deler kontrollert** — `valg` *(uendret fra v1)*
- Riktig type og dimensjon, uskadd
- Avvik – feil type eller skadet

> Sjekk dimensjon, bunnseksjon og pakninger mot beskrivelsen. Der kummen skal være tett, skal den være T-merket. Skadde elementer settes ikke ned.

**9. Grøftebunn og fundament klare** — `trafikklys` *(uendret)*

> Bunnen er fri for tele, snø og is, og fundamentet er avrettet så kummen får jevnt anlegg.

### Kontroll UNDER utførelse

**10. Plassering** · **11. Skjøter og gjennomføringer** · **12. Omfylling rundt kummen** — `valg`, **uendret fra v1**,
ordrett som i dagens `UP1_MAL`.

### Kontroll ETTER utførelse

**13. Justeringsringer og ramme** · **14. Lokk eller rist** · **15. Lokkhøyde mot dekket** · **16. Kummen er ren,
innmålt og klar** — **uendret fra v1**, ordrett.

**Utgår fra v1:**
- **Typelisten** (nedstigningskum / sandfangkum / inspeksjonskum / annen kum) — erstattet av funksjonslisten i felt 1.
- **«Renneløp gjennom kummen»** mister svaralternativet «Ikke aktuelt». Feltet vises nå bare for kummer som **har**
  renneløp, og da er «Ikke aktuelt» ikke et svar noen skal kunne gi (§1c: «Ikke aktuelt» beholdes bare der en fagperson
  faktisk skal vurdere forholdet).
- **«Sandvolum og høyde til utløp»** mister «Ikke sandfang», av samme grunn.

**Nytt i v2:** brannvannsuttak og brannkumskilt (felt 6 og 7). Skiltkravet finnes ikke i v1 — Kenneth 2026-09-22: skiltet
viser avstand og retning fram til kummen, og det er slik brannvesenet finner den.

**Struktur:** ti felt vises alltid (1, 8–16). Malen har 16 felt i alt, og en typisk jobb viser elleve til tretten:

| Type | Synlige felt |
|---|---|
| SP · OV · AF | 11 (renneløp) |
| Sandfangkum | 12 (sandvolum, dykker) |
| Vannkum uten uttak | 12 (ventil, uttaksspørsmål besvart «nei») |
| Vannkum med uttak = brannkum | 13 (ventil, uttak, skilt) |
| Annen kum | 10 |

**Ikke gjør:** «Lokkhøyde mot dekket» **skal ikke** forgrenes på hvor kummen står. Design vurderte det og forkastet det:
en forelder «kummen står i vei / grønt» ville lagt til ett felt for å spare null — dagens tre svaralternativer
dokumenterer seg selv.

## 6. Rammer

- §7b-sjekk i `up1-mal.test.ts` som før: ingen `UP1 `, `Matrise`, `NS-EN`, `NS 3420`. Forkortelsene SP, OV, AF, V og SF
  er prosjekterings- og produktbetegnelser og er tillatt, som asfaltbetegnelsene i JH2 (§7c).
- **Strukturtest:** `up1-mal.test.ts` skal låse treet — hvilke felt som er barn av felt 1, og hvilke utløsersett de har.
  Særlig at renneløp har **tre** utløsere (SP, OV, AF), at sandfang og vannkum har **to barn hver**, og at skiltet er
  barn av uttaksfeltet og ikke av typefeltet. Rød først.
- Utløseren ligger på barnets **eget** sett (`BETINGELSE_EGEN_NOKKEL`), aldri `conditionValues`. Bruk `forgrening`.
- Fasit (§8) og `skriv-mal UP1` viser treet. Ingen i18n-nøkler. Ingen endring i `packages/shared` eller appene.
  Prod-gaten røres ikke. Ingen migrering.
- Gate-tall via `pnpm exec turbo run test --force`.

## 7. SQL og DoD

`generer-mal-sql.ts UP1 revisjon` — revisjonen sletter objekt-radene og setter inn de nye med `parent_id`. Lag
`up1-v2-test.sql`, parse-test mot engangsdatabase, slett den etterpå, lever de tre enlinjerne. **Ikke kjør mot test
selv.**

**DoD:**
1. Målingen i § 4 besvart — fase på barn og barnebarn mot forelder. Er svaret nei, er malen ikke bygget: meld i stedet.
2. `UP1_MAL` med 16 felt som over, ordrett, med riktig forelder og riktige utløsersett.
3. Strukturtest og §7b-sjekk grønne, fasit oppdatert i samme branch.
4. **Tekstbevis:** `skriv-mal UP1` limt i leveransen — den skal vise hvilke svar som utløser felt 2–7, og at felt 7 har
   felt 6 som forelder.
5. Gate-bygg med gate-tall.
6. Diff: `seed-bibliotek.ts`, `up1-mal.test.ts`, `mal-fasit.snap.md` og SQL-en. Rører du noe annet, meld hvorfor.
7. Leveranse nederst i hovedtreets `relay/inbox-design.md` + «design har post».

Design gater felt for felt, og særlig: at renneløpet har alle tre avløpstypene, at brannuttaket ligger under ventilen
og ikke i typelisten (§2), og at hjelpeteksten om emnefeltet står ordrett — den er hele grunnen til at malen revideres.

---

## 8. Åpent punkt — nedgravd ventil (ikke bygg før dette er avklart)

Kenneth 2026-09-22: «det er en type → søk på Bajo → dette er en vannventil som er nedgravd». Det er en sluseventil som
legges **direkte i grunnen**, med bajonettkobling til spindelforlenger og betjening gjennom et ventildeksel i overflaten
— altså uten kum.

**Dette er ikke avklart, og malen skal ikke bygges med en slik type før design har gatet det.** Grunnen: tre av
UP1s alltid-synlige ETTER-felt (justeringsringer og ramme, lokk eller rist, lokkhøyde mot dekket) gjelder en kumramme
som en nedgravd ventil ikke har. Skal typen inn i denne malen, må hele ETTER-bolken forgrenes. Design legger fram
alternativene for Kenneth før ordren oppdateres.
