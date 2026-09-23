# Ordre: ny mal UM1.1 – skjøt på PE-ledning, én sjekkliste pr. skjøt

**Til:** mal-Opus · **Fra:** design · **Dato:** 2026-09-22
**Metode:** MAL-METODE §1, §1c, §1e, §6a, §6b, §7b, §8 og §8b.
**Branch:** samme som UM1 v2 — `feat/mal-um1-betinget`. **De to malene bygges sammen**, se § 1.
**Gatet av Kenneth 2026-09-22:** «en sjekkliste pr skjøt» · «skillet går på vannledning og spillvannsledning i tillegg
til pel nummer» · «um1.1 benyttes både til PE bend og muffer og sveiseskjøt» · «for mindre PE ledninger fins det andre
alternativer, disse ledningene leveres på kveil og stikkledninger tas ut».

**Normgrunnlag lest av design 2026-09-22** i `kilder/ns3420/NS 3420 Del U Rørinstallasjoner.pdf` (NS 3420-U:2019).
Kenneth ga stien; design har verifisert hvert krav mot normteksten i stedet for å gjette. Normsidene står i § 3.

---

## 1. Hvorfor — og hvorfor den hører sammen med UM1

UM1 v1 har feltet «Sveiselogg for PE — ført og signert». **Ett svar for en strekning som kan ha tjue skjøter.**

**Normen krever det Kenneth krever.** NS 3420-U:2019, c3.2.8 (normside 251): sveisene skal dokumenteres **i eget
skjema** der sveisenummer, muffeidentitet, sveisetrykk, sveisetemperatur, sveisetid, værforhold, lufttemperatur og
tildekking framgår, **signert av utførende sveiser**. Og c3.2.9: **hver skjøt skal merkes med sveiserens
identifikasjon**.

Kenneths «en sjekkliste pr skjøt» er altså ikke en preferanse — det er kravet, skrevet ned. Dokumentets enhet er
skjøten, slik den for en kum er kummen og for en strekning er strekningen.

🔴 **UM1 felt 9 er endret i samme runde** til «Sveiseskjøter dokumentert — alle skjøter har egen sjekkliste». Det feltet
peker på denne malen. **Merges den ene uten den andre, peker UM1 på noe som ikke finnes.** Én leveranse.

## 2. Emnefeltet — ledningstype og pelnummer

Kenneth 2026-09-22: sveisemuffer merkes med **P-nummer**, altså **pelnummer**, og skillet går på **vannledning og
spillvannsledning i tillegg til pelnummeret**.

**Emnet blir `VL P120`, `SP P340`, `OV P95`.** Forkortelsene er de samme som for kummene (VL, SP, OV, AF), så VA-sporet
har én konvensjon.

🔴 **Skrivemåten er «pel», ikke «pæl».** Kenneth tok den selv. **pel** er merkestaven og posisjonen langs traseen, **pæl**
er en fundamenteringspæl. **Ordet «pæl» skal ikke forekomme i malen**, og §7b-testen skal fange det.

**Hvorfor pel og ikke et løpenummer:** «skjøt 3» mister betydning så snart noen legger inn en skjøt til. Et pelnummer er
en innmålt posisjon som står i tegningen for alltid. Normen krever bare sveiserens ID på skjøten (c3.2.9); pelnummeret er
Kenneths tillegg, og det er det som gjør skjøten gjenfinnbar.

## 3. Hva normen faktisk krever — verifisert, med normside

Alt under er lest i normteksten, ikke gjettet. Kravene er **omskrevet til SiteDocs egne ord** (§7b) — standardene
navngis ikke i malen.

| Normpunkt | Side | Krav |
|---|---|---|
| c2.2 | 29 | PE-sveising skal utføres av **sertifisert operatør** |
| c2.3 | 29 | **Sveisemaskinen skal være kalibrert** |
| c2.4 | 29 | **Sveiseprosedyre skal utarbeides før arbeidet starter**, på grunnlag fra rørprodusenten. Ved uklarhet gjelder produsentens anvisning |
| c3.1.1 | 250 | Tidligere lagte rør brukt som mothold skal være understøttet og forankret |
| c3.2.1 | 250 | Utvendig ripe høyst **10 % av godstykkelsen**; rensk jevnt med skarp kniv **før** måling; skarpe riper avrundes og fylles med ekstrudersveis; dypere skade kappes bort eller dekkes med elektrisk reparasjonssadel |
| c3.2.2 | 250 | **Ingen innvendige riper** aksepteres |
| c3.2.3 | 250 | Klemringskobling på PE: **støttehylse innvendig** |
| c3.2.4 | 251 | **Flenseskjøter skal ettertrekkes** — PE relakserer |
| c3.2.5 | 251 | Sveising beskyttet mot støv og nedbør; ikke under 0 °C uten oppvarmet telt; **rørender tildekkes med plast**; **kappe fjernes før sveising** |
| c3.2.6 | 251 | **Ovalitet og toleranser kontrolleres og rettes før sveising**, med rundingsverktøy; sveiseområdet oppspennes så muffen står stabil; verktøy levert eller godkjent av muffeleverandøren |
| c3.2.7 | 252 | Elektromuffe: skraping med leverandørens verktøy og instruks. **Håndskraping er ikke tillatt** |
| c3.2.8 | 252 | Sveisen dokumenteres i **eget skjema** med parametrene over, signert av utførende sveiser |
| c3.2.9 | 252 | **Hver skjøt merkes med sveiserens identifikasjon** |
| UM1.181 b1 / a3 | 265 | Anboringsklammer og T-rør **tilpasset rørmaterialene**; ledningen rengjøres utvendig |

**Skjøtetypene** står i Matrise UM:2 (normside 254): muffeskjøt strekkfast / ikke strekkfast · sveiseskjøt ·
**buttsveisskjøt** · **elektro muffesveis** · klemringsskjøt · laminert skjøt · løsflens · flenseskjøt · skjøtemansjett ·
annen.

🔴 **Design tok feil, og retter seg selv:** i forrige melding meldte design at normen ikke bruker ordet «speilsveis».
**Det gjør den** — c3.2.5 heter «Speilsveising og elmuffe-sveising». Matrisen bruker «Buttsveisskjøt», brødteksten
bruker «Speilsveising». Begge er normens ord. Malen bruker **«Speilsveis (buttsveis)»** og **«Elektromuffesveis»**, som
dekker begge skrivemåter.

**Referansen:** `UM1.1` er i normen «Utendørs vannledninger» (side 260), ikke en skjøtepost — skjøten er en
matriseegenskap. Kenneth valgte likevel UM1.1, fordi det er posten han skriver i beskrivelsene, og fordi bend, muffer og
sveiseskjøt prises der. **Beskrivelsen sier derfor eksplisitt at malen gjelder PE-skjøter på alle VA-ledninger**, ikke
bare vannledning. Dette punktet er gatet: se § 7.

## 4. Kveilrør — grunnen til at malen ble omskrevet

Kenneth 2026-09-22: «for mindre PE ledninger fins det andre alternativer, disse ledningene leveres på kveil og
stikkledninger tas ut».

Designs første utkast spurte bare om **sveisemetode**. Det ville tvunget en klemringsskjøt på et kveilrør gjennom
spørsmål om avkjølingstid og smelteindikatorer — felt som ikke gjelder den i det hele tatt.

**Malen dekker derfor skjøten, ikke sveisen.** Klemringsskjøt og flenseskjøt er egne skjøtetyper i normen med egne krav
(c3.2.3 og c3.2.4), og stikkledningsuttak er en egen post (UM1.181). Alle tre er nå med, og alle tre er forgrenet — en
klemringsskjøt viser seks felt, en full elektromuffesveis tolv.

**Det finnes ingen «ingen skjøt på stedet».** Kenneth: bendet skjøtes i grøfta enten det kommer ferdig fra fabrikk med
elektromuffer eller uten. Malen har derfor ingen unntakssti for prefabrikkerte deler.

## 5. Malen

```
kapittelKode: "UM"
referanse:    "UM1.1"
navn:         "UM1.1 – Skjøt på PE-ledning"
beskrivelse:  "Skjøt på PE-ledning for vann, avløp og drens — skjøtetype, rørkontroll, sveiseprosedyre, parametre, avkjøling og merking. Én sjekkliste pr. skjøt. Gjelder sveiste og mekaniske skjøter, bend, muffer og stikkledningsuttak. Faglig grunnlag: NS 3420-U:2019, post UM1.1."
```

**Alle felt er `valg` eller `trafikklys` — ingen tallfelt (§1).** Parametrene hører i sveiseskjemaet, ikke som tallfelt i
sjekklisten.

### Kontroll FØR utførelse

**1. Hva skjøtes** — `valg` · **forelder for felt 2 og 3**
- Skjøt på rett rør
- Bend
- Muffe eller overgang
- Uttak av stikkledning
- Annen del – se beskrivelsen

> Skriv ledningen og pelnummeret i emnefeltet: VL P120 for vannledning, SP P340 for spillvann, OV P95 for overvann. Det er slik skjøten finnes igjen senere, og slik to skjøter ved samme pel holdes fra hverandre. Én sjekkliste pr. skjøt. Kontrollen gjelder uansett om bendet eller muffen er priset som egen post eller inngår i løpemeterprisen — en skjøt som svikter, svikter like fullt.

🔴 **To setninger som skal stå ordrett:** emne-eksemplene (Kenneth: «disse forklaringer i hjelpetekst er nyttig» — tre
eksempler viser mønsteret, ett viser et tilfelle) og setningen om prisform (Kenneth: «noen ganger er bend og muffer egen
post, andre ganger er det lm komplett» — inngår delen i løpemeterprisen, finnes ingen post å henge sjekklisten på, og da
er det hjelpeteksten som må si at kontrollen gjelder likevel).

**2. Bendets retning og vinkel** — `valg` · **vises for «Bend»**
- Riktig vinkel og retning, forankret som beskrevet
- Forankring ikke krevd her
- Avvik

> Kontroller vinkelen og retningen mot tegningen før skjøten lages — et bend som peker feil, rives opp igjen. Står ledningen under trykk, skyver bendet seg utover, og kraften skal tas opp av mothold eller strekkfaste skjøter slik beskrivelsen angir.

**3. Anboring og uttak** — `valg` · **vises for «Uttak av stikkledning»**
- Klammer og deler tilpasset rørmaterialene, ledningen rengjort, uttaket tett
- Avvik

> Anboringsklammer og T-rør skal passe til rørmaterialet i både hovedledning og stikkledning. Rengjør ledningen utvendig der klammeret settes på. Kontroller at uttaket er tett, og at hovedledningen ikke er svekket av boringen.

**4. Rør og deler kontrollert** — `valg`
- Riktig dimensjon og trykklasse, riper innenfor grensen
- Skade kappet bort eller reparert
- Avvik

> Utvendig ripe kan være høyst 10 % av godstykkelsen. Rensk området jevnt med rørflaten med skarp kniv før du måler dybden — ellers måler du feil. Skarpe riper avrundes og fylles med ekstrudersveis. Er skaden dypere, kappes delen bort, eller den dekkes med en elektrisk reparasjonssadel. Innvendige riper aksepteres ikke. Rør levert på kveil rettes ut, og eventuell kappe fjernes der skjøten skal lages.

**5. Skjøtetype** — `valg` · **forelder for felt 6–10 (sveis), 11–12, 13–14, 15 og 16**
- Elektromuffesveis
- Speilsveis (buttsveis)
- Klemringsskjøt
- Flenseskjøt eller løsflens
- Annen skjøt – se beskrivelsen

> Skjøtetypen avgjør hva som kontrolleres. Mindre dimensjoner leveres på kveil og skjøtes ofte med klemring i stedet for sveis — da gjelder helt andre krav enn ved sveising.

### Sveisegruppe — **utløses av «Elektromuffesveis» OG «Speilsveis (buttsveis)»**

**6. Prosedyre, kalibrering og sertifikat** — `valg`
- Prosedyre foreligger, maskinen kalibrert, sveiseren sertifisert
- Avvik

> Sveiseprosedyren for denne maskinen og dette rørmaterialet skal være utarbeidet før arbeidet starter, på grunnlag fra rørprodusenten. Er noe uklart, er det produsentens anvisning som gjelder. Maskinen skal være kalibrert, og sveiseren skal ha gyldig sertifikat for metoden.

**7. Forholdene på stedet** — `valg`
- Tørt og skjermet, rørendene tildekket
- Telt eller oppvarming brukt
- Avvik – sveiset likevel

> Sveising skal være beskyttet mot støv og nedbør, og skal ikke utføres under 0 °C uten oppvarmet telt. Dekk rørendene med plast for å hindre trekk og avkjøling gjennom røret.

**8. Ovalitet og oppspenning** — `valg`
- Ovalitet kontrollert og rettet, sveiseområdet oppspent
- Avvik

> Ovalitet og toleranser kontrolleres og rettes før sveising, med rundingsverktøy. Kveilrør er alltid ovalt og skal rundes. Sveiseområdet spennes opp så muffen står stabil gjennom hele sveisen. Bruk verktøy levert eller godkjent av muffeleverandøren.

**9. Sveiseparametre ført i skjema** — `valg`
- Ført og signert av utførende sveiser
- Avvik

> Skjemaet skal vise sveisenummer, muffeidentitet, sveisetrykk, sveisetemperatur, sveisetid, værforhold, lufttemperatur og tildekking, og være signert av den som sveiset. Legg skjemaet ved.

**10. Avkjøling** — `valg`
- Full avkjølingstid, uten belastning
- Avvik

> Skjøten skal stå hele den foreskrevne avkjølingstiden, og skal ikke belastes, beveges eller trykkprøves før tiden er ute. Dette er punktet som oftest ryker under tidspress.

### Elektromuffe — **utløses av «Elektromuffesveis»**

**11. Skraping av røroverflaten** — `valg`
- Skrapt med leverandørens verktøy over hele muffelengden
- Avvik

> Skrap med verktøy levert eller godkjent av muffeleverandøren, etter leverandørens instruks. Håndskraping er ikke tillatt — oksidsjiktet skal bort, ikke bare pusses. Ta ikke på skjøteflaten etterpå.

**12. Smelteindikatorer** — `valg`
- Indikatorer ute på begge sider, muffen sitter i posisjon
- Avvik

> Begge indikatorene skal ha kommet ut. Har bare én kommet ut, er skjøten ikke godkjent — den kappes ut. Kontroller også at muffen ikke har forskjøvet seg.

### Speilsveis — **utløses av «Speilsveis (buttsveis)»**

**13. Høvling og oppstilling** — `valg`
- Endene høvlet, rørene i samme akse, kantavvik innenfor kravet
- Avvik

> Høvle begge ender umiddelbart før sveising, og kontroller at flatene ligger an mot hverandre hele veien rundt. Rørene skal ligge i samme akse — kantavvik gir en svak sveis selv med riktige parametre.

**14. Vulsten** — `valg`
- Jevn og symmetrisk hele veien rundt
- Avvik

> Vulsten skal være jevn og like stor på begge sider hele veien rundt røret. Skjev eller ujevn vulst betyr skjev oppstilling eller feil parametre — skjøten kappes ut og sveises på nytt.

### Mekaniske skjøter

**15. Støttehylse og tiltrekking** — `valg` · **vises for «Klemringsskjøt»**
- Støttehylse montert innvendig, koblingen trukket til
- Avvik

> Klemringskobling på PE-rør skal ha støttehylse innvendig. Uten den trekker røret seg sammen under klemringen, og skjøten begynner å lekke. Trekk til etter leverandørens anvisning.

**16. Ettertrekking av flens** — `valg` · **vises for «Flenseskjøt eller løsflens»**
- Ettertrukket etter montering
- Avvik

> Flenseskjøter skal ettertrekkes. PE gir seg over tid, og en flens som bare er trukket én gang, lekker senere.

### Kontroll ETTER utførelse

**17. Skjøten merket** — `valg`
- Merket med pelnummer, og med sveiserens ID der det er sveiset
- Avvik

> Hver sveiset skjøt skal merkes med sveiserens identifikasjon. Ta med pelnummeret på alle skjøter, også de mekaniske, så kan skjøten knyttes til denne sjekklisten når grøfta er fylt igjen.

**18. Skjøten er dokumentert og klar** — `trafikklys`

> Skjema og følgesedler er tatt vare på, skjøten er merket og innmålt, og den kan omfylles. Ta bilde av skjøten og av merkingen før den dekkes til.

**Struktur:** malen har **18 felt**, og **fem vises alltid** (1, 4, 5, 17, 18). Skjøtetypen avgjør resten:

| Situasjon | Synlige felt |
|---|---|
| Klemringsskjøt på kveilrør | **6** |
| Flenseskjøt | 6 |
| Stikkledningsuttak med klemring | 7 |
| Elektromuffesveis på rett rør | **12** |
| Speilsveis på rett rør | 12 |
| Bend med elektromuffesveis | 13 |
| «Annen skjøt», «Annen del» | 5 |

**To foreldre:** felt 1 «Hva skjøtes» utløser bend- og anboringsfeltene, og felt 5 «Skjøtetype» utløser resten. Samme
mønster som UM1 v2, der ledningstype og skjøtemetode er to uavhengige trær.

**Det er hele poenget med forgreningen:** en klemringsskjøt på et kveilrør viser seks felt. Uten forgrening måtte den
samme mannen svare «ikke aktuelt» på avkjølingstid, smelteindikatorer, vulst, høvling og sveiseprosedyre.

## 6. Rammer

- §7b-sjekk i en ny `um1-1-mal.test.ts`: ingen `Matrise`, `NS-EN`, `NS 3420`, `NS 416`, `DS/INF`, ingen `UM1.1 ` som
  prefiks i feltnavn, og **ingen forekomst av «pæl»**. `PE`, `SDR`, `elektromuffe`, `speilsveis` og `buttsveis` er
  produkt- og metodebetegnelser og er tillatt (§7c).
- **Strukturtest:** låse begge trærne — at bend- og anboringsfeltene henger på felt 1 · at sveisegruppen (6–10) har
  **to** utløsere · at 11–12 bare gjelder elektromuffe, 13–14 bare speilsveis, 15 bare klemring og 16 bare flens · og at
  ingen av de tretten er alltid synlige. Rød først.
- **Fem barn under samme utløserpar** (felt 6–10) = **fem egne poster** i `barn`-arrayet med samme `naar`
  (`seed-bibliotek.ts:197–206`). Legger du dem som `felt: [a, b, c, d, e]`, får bare `a` sin `parentRef` og de fire
  andre blir alltid synlige. Dette er den største forgreningen i biblioteket så langt — test den hardest.
- Utløseren ligger på barnets **eget** sett (`BETINGELSE_EGEN_NOKKEL`).
- Fasit (§8) og `skriv-mal` viser treet. Ingen i18n-nøkler. Ingen endring i `packages/shared` eller appene.
  Prod-gaten røres ikke. Ingen migrering.

## 7. SQL og DoD

`generer-mal-sql.ts UM1.1 ny`. Kapittel `UM` finnes fra UM1 — **ingen nytt kapittel skal opprettes.** Trenger UM1.1
plass rett etter UM1 i sorteringen, bruk `--sorter` og meld hvilke søstre som flyttes. Lag SQL-filen, parse-test mot
engangsdatabase, slett den etterpå, lever de tre enlinjerne. **Ikke kjør mot test selv.**

**DoD:**
1. Malen med 18 felt som over, ordrett, med riktige foreldre og utløsersett.
2. UM1 felt 9 endret i samme leveranse — de to malene hører sammen.
3. Strukturtest og §7b-sjekk grønne, fasit oppdatert i samme branch.
4. **Tekstbevis:** `skriv-mal UM1.1` limt i leveransen, som viser at sveisegruppen har to utløsere og at de fire
   metodespesifikke gruppene er skilt.
5. Gate-tall via `pnpm exec turbo run test --force`.
6. Diff: `seed-bibliotek.ts`, `um1-1-mal.test.ts`, `mal-fasit.snap.md`, `um1-mal.test.ts` og SQL-en. Rører du noe annet,
   meld hvorfor.
7. Leveranse nederst i hovedtreets `relay/inbox-design.md` + «design har post».

**Normoppslaget er trukket** — design har lest normen selv, se § 3. Du skal ikke slå opp noe for denne malen.

## 8. Åpent punkt design gater hos Kenneth før SQL

**Referansen `UM1.1`.** Normen kaller UM1.1 «Utendørs vannledninger» (side 260), og skjøten er en matriseegenskap, ikke
en egen post. Kenneth valgte UM1.1 fordi det er posten han skriver i beskrivelsene. Malen brukes altså bredere enn
posten, og beskrivelsen sier det.

**Alternativet, hvis Kenneth heller vil:** legge malen på `UM1`, som i normen dekker vann, avløp og drens — men `UM1` er
opptatt av eksisterende mal. Da måtte referansen bli noe annet, og design vil ikke finne opp en referanse som ikke står
i normen.

## 8b. ✅ GATET 2026-09-22: to sjekklister pr. bend, og sveisenummeret skiller dem

Kenneth: **«To lister … men de er lokalisert på samme sted og det kan være 6 timer å sveise på et bend sdr11 Ø630
PE».**

**Svaret er to lister**, og tidsanslaget er begrunnelsen: **en sveis kan ta seks timer.** Seks timers arbeid med
egne parametre, egen operatør og egen avkjølingstid er ikke et delspørsmål i en annen liste — det er en leveranse.
Og normens c3.2.8 krever eget skjema pr. sveis uansett.

🔴 **Kollisjonen løses med sveisenummeret, ikke med a/b.** Design foreslo `VL P120a` / `VL P120b`. Det er unødvendig
å finne opp, fordi **normen alt krever sveisenummer** i skjemaet (c3.2.8: «sveisenummer, muffeidentitet,
sveisetrykk …»). Nummeret finnes altså allerede, det er unikt i prosjektet, og det står på skjøten (c3.2.9).

**Emnet for en sveiseskjøt blir derfor:**

| Del | Eksempel |
|---|---|
| Ledningstype | `VL` |
| Pelnummer | `P120` |
| **Sveisenummer** | **`S14`** |
| **Samlet** | **`VL P120 S14`** |

**Rekkefølgen er valgt for sortering:** ledning først, så posisjon, så sveis. Da grupperer listen seg etter
strekning, og de to skjøtene på samme bend står ved siden av hverandre — som de skal, siden de er samme arbeid.

🔴 **Felt 1s hjelpetekst i § 5 må oppdateres tilsvarende.** Den sier i dag «VL P120 for vannledning, SP P340 for
spillvann, OV P95 for overvann». **Ny ordlyd, som skal stå ordrett:**

> Skriv ledningen, pelnummeret og sveisenummeret i emnefeltet: VL P120 S14 for vannledning, SP P340 S22 for spillvann, OV P95 S07 for overvann. Sveisenummeret er det samme som i sveiseskjemaet og på merkingen av skjøten, og det er det som skiller to skjøter på samme bend. Én sjekkliste pr. skjøt — et bend har to ender og gir to lister. Kontrollen gjelder uansett om bendet eller muffen er priset som egen post eller inngår i løpemeterprisen — en skjøt som svikter, svikter like fullt.

**Og felt 17 «Skjøten merket» skal nevne nummeret**, siden merkingen og emnet nå bruker samme nøkkel — se § 5.

---

## 8. Åpent punkt design gater hos Kenneth før SQL — LUKKET

**Referansen `UM1.1` er gatet** (Kenneth: «um1.1 benyttes både til PE bend og muffer og sveiseskjøt»). Normen kaller
UM1.1 «Utendørs vannledninger» (side 260), og skjøten er en matriseegenskap, ikke en egen post. Malen brukes altså
bredere enn posten, og **beskrivelsen sier det eksplisitt**. Design foreslo `UM1` som alternativ, men den referansen
er opptatt av den eksisterende malen, og design finner ikke opp referanser som ikke står i normen.

✅ **Ingenting står åpent for Kenneth i denne ordren.**

---

🔴 **MEKANISME-RETTING 2026-09-23 — gjelder foran denne ordrens bokstav.**

Ordren sier «bruk `forgrening`». Den ble skrevet før `forelderFelt` + `barnAv` fantes
(`seed-bibliotek.ts:218`/`:228`, lagt til av mal-Opus i KD1 v3). **Gjeldende regel er MAL-METODE §1f:**

- **Samme fase** som forelderen → `forgrening`
- **Annen fase** enn forelderen → **`forelderFelt` + `barnAv`**

Denne malen har typeforeldre i **FØR** med barn i **UNDER** og **ETTER**. Der skal `barnAv` brukes. Utføreren
melder i leveransen hvilken hjelper som ble brukt hvor.
