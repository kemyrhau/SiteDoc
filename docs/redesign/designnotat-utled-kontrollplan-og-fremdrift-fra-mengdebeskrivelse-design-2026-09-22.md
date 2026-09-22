# Designnotat: kan kontrollplan og fremdriftsplan utledes fra en priset mengdebeskrivelse?

**Fra:** design · **Til:** Kenneth-gate · **Dato:** 2026-09-22
**Utløst av:** Kenneths spørsmål under malarbeidet 2026-09-22.

> «Akkurat nå lurer jeg på → går det å utlede en fremdriftsplan og en kontrollplan ut fra en priset
> mengdebeskrivelse på en enkel måte for et VA prosjekt?»

**Kort svar: ja på kontrollplanen, og den er liten — tre av fire deler finnes i koden alt.
Fremdriftsplanen går også, fordi Kenneths egne tilnærminger holder, men den trenger en ratetabell som
ikke finnes i dag.**

---

## 1. Målingen — hva som faktisk finnes i koden

Ikke antatt. Lest 2026-09-22.

| Del | Hvor | Status |
|---|---|---|
| Priset mengdebeskrivelse pr. prosjekt | `ftd_spec_posts` (`packages/db/prisma/schema.prisma:1968`) | **Finnes:** `postnr`, `beskrivelse`, `enhet`, `mengdeAnbud`, `enhetspris`, `sumAnbud`, `mengdeTotal`, `prosentFerdig` — og egne kolonner **`nsKode`, `nsTittel`, `fullNsTekst`** |
| Kontrollplanpunkt som peker på en mal | `KontrollplanPunkt` (`schema.prisma:2425`) | **Finnes:** `sjekklisteMalId`, `faggruppeId`, `fristUke`, `fristAar`, `omradeId`, `milepelId`, `avhengerAvId`, `drawingId` + posisjon |
| Import som lager punkter automatisk, med rad-identitet ved revisjon | `KontrollplanImport` (`schema.prisma:2517`) + `importTaskUid`/`importWbs`/`importNavn` på punktet | **Finnes:** bygget for fremdriftsplan-import (MS Project), med `hoppetOver` og fingerprint-matching ved ny fil |
| Fremdrift avledet fra koblet sjekkliste | `packages/shared/src/utils/kontrollplanFremdrift.ts` | **Finnes:** punktets fremdrift leses fra sjekklistens status, ikke punktets egen |
| **Koblingen mellom beskrivelsen og malene** | — | **Mangler. Dette er hele jobben.** |

**Konsekvensen av målingen:** dette er ikke en ny modul. Det er en ny utleder ved siden av
MS Project-importen, som skriver til samme tabeller med samme rad-identitet.

## 2. Koblingen som mangler — og hvorfor den er triviell

Bibliotekets `referanse` **er** prefiks av NS-koden i beskrivelsen. Oppslaget er lengste match:

| `nsKode` i beskrivelsen | Treffer mal |
|---|---|
| `UP1.1-xxx` | `UP1` |
| `UM1.1211-xxx` | `UM1.1` — hvis den bygges, ellers `UM1` |
| `UM1.221-xxx` | `UM1` |
| `JH2.1-xxx` | `JH2` |

Ingen kunstig kobling, ingen manuell tilordning. **Det er dette som gjør at «én mal pr. post» vinner
avveiningen Kenneth selv formulerte:**

> «en pr post har sine styrker → lett å lage kontrollplan basert på fremdriftsplan → den har sin
> svakhet i at det blir flere sjekklister»

Svakheten er reell, men det er nettopp én-til-én-forholdet som gjør utledningen mulig. Blander vi flere
poster i én mal, må et menneske bestemme hvilken mal som hører til hvilken post — og da er automatikken
borte. **Og antall felt pr. dokument går ned**, fordi forgreningen skjuler det som ikke gjelder: en
klemringsskjøt viser seks felt av atten. Flere dokumenter, mindre arbeid i hvert.

🔴 **Dette er argumentet for å dele UP1 i tre maler** (UP1 nedstigningskum · UP3 sandfang · UO2.1 nedgravd
ventil), som står ugatet fra tidligere i dag. Utledningen forutsetter at malen og posten er samme ting.

**Bonus som treffer forgreningsarbeidet:** NS-koden bærer matrisesifrene. Står skjøt = 15 i koden, **er**
skjøtetypen elektromuffesveis — bestemt av kontrakten, ikke av den som fyller ut. Forelderfeltet i en
forgrenet mal kan forhåndsutfylles fra beskrivelsen, og arbeideren slipper å velge det andre har avgjort.

## 3. Ratemodellen — Kenneths tilnærminger, og hvorfor de holder

> «f.eks en kumgruppe tar 5 dager å etablere for 3 ledninger. grøft kan ta ca 6 m pr dag for 3
> ledninger» · «60-80 m mellom kumgrupper → begrensning → lengden en traktor kan filme» · «en kum pr
> ledning er normalt»

**Det avgjørende i tallene: de er pr. grøft, ikke pr. post.** Summerer man postene, blir 340 m VL +
340 m SP + 340 m OV til 1020 meter arbeid. Men det er 340 meter grøft, og de tre ledningene ligger i den
samme. **Grøfta er kritisk linje; ledningene er passasjerer.** Kumgruppa er én hendelse på fem dager, ikke
tre kummer som telles hver for seg.

Driveren finnes i beskrivelsen: grøft er egen post i Del F (vi har mal på den). Mengden hentes derfra, ikke
ved å summere rørpostene.

| Driver | Enhet | Rate | Kilde |
|---|---|---|---|
| Grøft, 3 ledninger | m/dag | 6 | Kenneth 2026-09-22 |
| Kumgruppe, 3 ledninger | dager pr. gruppe | 5 | Kenneth 2026-09-22 |
| Avstand mellom kumgrupper | m | 60–80 | Kenneth 2026-09-22 — **fysisk begrensning** |
| Kummer pr. kumgruppe | stk | 1 pr. ledning | Kenneth 2026-09-22 |
| Ledning i grøft | — | ingen egen varighet | følger grøfta |

🔴 **Avstanden er ikke en vurdering.** Den er satt av hvor langt rørinspeksjonstraktoren rekker å filme.
Det betyr at **antall kumgrupper kan utledes**, ikke gjettes — og at en avstand over 80 m er et reelt
byggbarhetsavvik, ikke en preferanse. Ledningen kan da ikke inspiseres.

Raten må bære **antall ledninger** som parameter: én ledning går fortere enn tre. Det er den ene
dimensjonen Kenneths tall alt har i seg.

## 4. Regnestykket, med Kenneths tall

340 m grøft, 3 ledninger, 70 m mellom kumgrupper:

| Ledd | Regning | Resultat |
|---|---|---|
| Kumgrupper | 340 / 70, rundet opp | **5 grupper** |
| Kummer | 5 × 3 ledninger | **15 kummer** |
| Strekninger | 4 spenn × 3 ledninger | **12 strekninger** |
| Grøft, varighet | 340 / 6 | **57 dager** |
| Kumgrupper, varighet | 5 × 5 | **25 dager** |
| **Sum** | | **82 dager ≈ 16,5 uker** |

**At summen er additiv og ikke parallell, er riktig her:** kumgruppa stopper grøftefremdriften på det
punktet. Den enkle tilnærmingen treffer virkeligheten bedre enn en overlappingsmodell ville gjort.

**Og her er poenget som gjør det verdt å bygge:** varigheten fyller `fristUke` og `fristAar` på
kontrollplanpunktene — felter som alt finnes. **Det trengs ikke to funksjoner.** Én utledning gir både
kontrollplanen og fristene, altså fremdriften.

**Dokumentantallet faller også ut:** 15 kum-dokumenter + 12 strekningsdokumenter = **27 dokumenter** på en
340-metersgrøft, før sveiseskjøter. Det er tallet Kenneth bør reagere på, ikke en følelse av «flere
sjekklister».

## 4b. 🔴 Modellen ble målt mot et virkelig prosjekt, og bommet med faktor to

Kenneth 2026-09-22: «jeg hadde et prosjekt på 1100m grøft som hadde byggetid 2 år».

| Ledd | Regning | Resultat |
|---|---|---|
| Grøft | 1100 / 6 | 183 dager |
| Kumgrupper | 1100 / 70 = 16 grupper × 5 dager | 79 dager |
| **Modellens svar** | | **262 dager ≈ 52 uker ≈ 1 år** |
| **Faktisk byggetid** | | **2 år** |

**Feilen ligger ikke i ratene — den ligger i at design forvekslet produksjonsdager med kalendertid.**
1100 m på to år er 550 m/år, som ved 6 m/dag blir 92 grøftedager i året. Raten er altså plausibel; det er
de resterende dagene i kalenderåret modellen ikke vet om.

**Følgen for designet: modellen må ha to lag.** Produksjonsdager fra mengde og rate, og deretter en
kalenderomregning. Å skrive 262 dager rett i `fristUke` ville gitt en plan som er feil med ett år — og det
er verre enn ingen plan, fordi den ser presis ut.

**Én av årsakene er kjent.** Kenneth 2026-09-22: «entreprenøren rotet et strekk → 60 m tok over 3 mnd
produksjon». Ved 6 m/dag skulle 60 m tatt 10 dager; det tok over 60. Det er ~50 tapte dager.

**Vintersesong er utelukket.** Kenneth 2026-09-22: «vi jobbet sommer og vinter». Året rundt gir ~230
arbeidsdager, altså ~460 på to år. Modellen sa 262; differansen er ~198 dager, og det rotete strekket
forklarer ~50. **~148 dager står igjen uforklart** — og de faller på plass hvis raten er lest feil:

| Rate | Grøft | + kumgrupper | Sum | Mot ~460 arbeidsdager |
|---|---|---|---|---|
| 6 m/dag | 183 d | 79 d | 262 d | halvparten |
| **3 m/dag** | 367 d | 79 d | **446 d** | **treffer** |

🔴 **Den avgjørende ukjente er derfor ikke raten, men hva raten er et mål på:** en **god dag i normal grøft**,
eller et **prosjektsnitt** som bærer kryssinger, fjellpartier, gjenfylling, asfalt og dagene det står stille.
Ligger modellen på god-dag-rate, vil den systematisk love halv byggetid — den farligste feilen den kan
gjøre, fordi svaret ser rimelig ut.

### 🔴 Raten er et anslag, ikke en måling — og prosjektet sier noe annet

Kenneth 2026-09-22, uoppfordret: **«jeg gjetter på 6 m pr dag → jeg har ikke prøvd å utlede tallet».**

Det er den viktigste opplysningen i notatet, fordi hele ratemodellen hviler på det tallet. Og Kenneths eget
prosjekt lar det utledes:

| Ledd | Regning | Resultat |
|---|---|---|
| Arbeidsdager, 2 år året rundt | ~230 × 2 | ~460 |
| Kumgrupper | 16 × 5 dager | 79 |
| Igjen til grøft | 460 − 79 | 381 |
| **Utledet rate** | 1100 / 381 | **2,9 m/dag** |
| Uten det rotete strekket | 1040 / 321 | **3,2 m/dag** |

**Anslaget var 6. Prosjektet gir ~3.** Det stemmer med tabellen over: 3 m/dag treffer byggetiden.

**Forbeholdet design ikke kan sjekke:** at mannskapet sto på den grøfta sammenhengende i to år. Flyttet
laget seg mellom jobber, var de reelle grøftedagene færre og raten høyere. **Timene i dagsseddelen avgjør
det presist** — timer ført på prosjektet delt på lagstørrelse gir faktiske dager på stedet. Ligger
prosjektet i SiteDoc med timer, kan raten måles i stedet for gjettes. Det er en måling, ikke en bygging.

**Følge for byggerekkefølgen: ikke seed ratetabellen med anslaget.** En tabell med et tall som er dobbelt
feil, er verre enn en tom tabell — den gir falsk presisjon og systematisk halv byggetid.

### Stopp-varsling først — den trenger ingen rate

Har et strekk **ingen godkjente dokumenter på tre uker**, er det verdt et varsel enten raten er 3 eller 6.
De 60 meterne på tre måneder ville blitt fanget uansett — ikke fordi systemet visste hvor fort det *burde*
gått, men fordi det så at ingenting skjedde.

**Stopp-varsling er rate-fritt, og det er den eneste avviksdeteksjonen som virker før noe er målt.**
Ratebasert varsling kommer etter at raten er målt på noen prosjekter; da er den reell og firmaets egen.
Dette er tatt inn i rekkefølgen i § 7.

### 🔴 Hva som faktisk gikk galt — og hvor bibliotekets grense går

Design spurte om en sjekkliste ville fanget det rotete strekket. **Kenneth 2026-09-22: nei.**

> «en sjekkliste ville ikke fanget rotet → entreprenøren skulle spare penger på å sprenge hele strekket i en
> runde fordelt på flere boringer og salver istedenfor fortløpende graving, boring, sprenging og uttak av
> stein»

**Arbeidet var ikke dårlig utført — rekkefølgen var feil valgt, før arbeidet begynte.** Det er et
metodevalg, og en KS-sjekkliste stiller ikke det spørsmålet. Det er den samme grensen Kenneth selv satte
(MAL-METODE §1d): KS behandler kvaliteten på levert arbeid.

**Det er riktig at biblioteket ikke fanger dette, og grensen skal stå.** Sjekklistene dokumenterer at
arbeidet er riktig utført; utledningen fanger at arbeidet ikke blir gjort. To ulike jobber, og ingen av dem
skal late som den gjør den andres.

**Men signaturen til et blokkert strekk er skarpere enn stopp-varsling alene:**

| Situasjon | Timer | Godkjente dokumenter |
|---|---|---|
| Normal, treg fremdrift | går | kommer, bare sakte |
| **Blokkert arbeidsstuff** | **går** | **står stille** |
| Stans i arbeidet | står | står |

🔴 **Kombinasjonen «timer går, dokumenter står» er detektoren.** Den skiller et metodevalg som blokkerer
stuffen fra ren treghet **og** fra en planlagt stans — og den trenger verken rate eller kvalitetsvurdering.
Begge tallene finnes: timer ført på prosjektet i dagsseddelen, og godkjente dokumenter pr. strekning.

Med 60 m fylt av sprengt stein som ikke er tatt ut, blir ingen strekning ferdig mens timene løper. Tre uker
inn ville det vært synlig.

**Observasjon design ikke gjør noe med:** et metodevalg som dette hører i en sprengningsplan eller
metodebeskrivelse, ikke i en sjekkliste. Om SiteDoc skal ha en slik dokumenttype, er et annet spørsmål enn
malbiblioteket — notert her for at det ikke skal bli borte.

### Dette snur hva planen er til for

Modellen kan ikke forutse at en entreprenør roter et strekk, og skal ikke prøve. **Den kan gjøre det synlig
mens det ennå er 20 meter og ikke 60.** 6 m/dag er ikke et løfte, det er en målestokk: står det 8 meter
etter tre uker der planen sa 90, skal noen vite det da.

**Målestokken finnes allerede i malarbeidet.** 340 m gir 15 kum-dokumenter og 12 strekningsdokumenter (§ 4).
Hvert godkjent dokument er et målbart steg, og granulariteten er fin nok til å se et strekk som står stille
innen en uke. Sammen med `prosentFerdig` på postene og timene i dagsseddelen har SiteDoc nok til å se det
**uten at noen rapporterer noe ekstra**.

🔴 **Derfor snus anbefalingen i § 7: avviksdeteksjon er den primære verdien, startplanen er bieffekten.**
En utledet startplan som er feil med ett år, er lite verdt. En baseline som viser at et strekk har stått
stille i tre uker, er mye verdt — og den tåler at raten er omtrentlig.

## 4c. Fremdriftslyset — og hvorfor det er bevis, ikke dashbord

Kenneth 2026-09-22, under samtalen: «du gir meg en god ide → som byggeleder → trafikklys på fremdrift».
Design foreslo en definisjon basert på timer og dokumenter. **Kenneths definisjon er bedre, og forskjellen er
prinsipiell:**

| Lys | Betyr | Krav |
|---|---|---|
| **Grønn** | normal fremdrift | ingen |
| **Gul** | manglende fremdrift | **forklar hva som ikke fungerer optimalt** |
| **Rød** | ingen eller svært svak fremdrift | **forklar** — er det ingen arbeidere på anlegget? |

🔴 **Gul og rød krever en forklaring. Da konkluderer ikke systemet — det spør.** Et lys som stiller et
spørsmål, tåler at datagrunnlaget er omtrentlig; et lys som feller en dom, gjør det ikke. Det løser problemet
design selv pekte på: godkjente dokumenter er for grov takt til å dømme fremdrift uke for uke.

**Forklaringen skal være forhåndsdefinerte valg** (CLAUDE.md § UI-prinsipper), ikke fritekst. Designs
forslag, ikke gatet: ingen mannskap på anlegget · venter på leveranse · venter på godkjenning eller befaring ·
fjell eller grunnforhold · vær · maskinstans · omdisponert til annet arbeid · annet (fritekst). Talt over tid
svarer listen på om det er leveranser eller bemanning som er firmaets problem.

**Formålet er sluttoppgjøret.** Kenneth: «når sluttoppgjøret kommer → ta frem alle rapporter med gul og rød
fremdrift → det kan være med å forklare hvorfor et prosjekt er forsinket → men det krever gode rapporter».

🔴 **Det avgjør ett designvalg: notatet må være et dokument i dokumentflyten, ikke en redigerbar status.** En
gul uke som kan endres i ettertid, er verdiløs i et oppgjør. Og det sterkeste ved flyten er ikke låsingen —
det er at **motparten mottok den**. En gul uke entreprenøren fikk og ikke bestred, veier tungt; et notat i
byggelederens egen perm veier nesten ingenting.

**Kenneths fire krav til «gode rapporter»:** datert og låst etter sending · mottatt av motparten · **ubrutt
serie** (er uke 1–10 dokumentert og 11–20 tomme, svekker hullet hele bunken) · samme årsaksvokabular hele
veien.

**Ansvarsside pr. årsak** gjør summen til et kravgrunnlag i stedet for en følelse — men **den skal være
innstillbar pr. kontrakt og aldri hardkodet.** SiteDoc dokumenterer; det avgjør ikke. Ingenting i UI skal se
ut som en juridisk konklusjon.

**Frekvens, gatet av Kenneth:** **2–3 ganger ukentlig med månedlig oppsummering.** Det gir 10–12 notater i
måneden — nok til at en tre-ukers stans ikke kan bortforklares, lite nok til at hvert notat er ett
skjermbilde. Design foreslo ukentlig; Kenneths tall er tettere og bedre.

**Og her finner den automatiske utledningen sin rette plass:** systemet **foreslår** fargen fra timer og
dokumenter, byggelederen bekrefter eller overstyrer, velger årsak og sender. **Utledningen skriver utkastet,
den dømmer ikke.** En omtrentlig rate er god nok til å foreslå en farge et menneske bekrefter — men ikke god
nok til å sette en frist. Det var brikken som manglet i § 4b.

**Risikoen som avgjør alt:** et notat som koster innsats, blir ikke skrevet, og da er serien brutt der den
betyr mest. Ett skjermbilde, under ett minutt, forhåndsfylt.

**Månedsrapporten** er bestilt som egen backlog-post (`docs/claude/BACKLOG.md § 3`). Kort: sammendragstabellen
er **deterministisk** — en telleoppgave, ikke en AI-oppgave — notatene gjengis **ordrett med dato**, og
oppsummeringen er byggelederens egne ord. 🔴 **Ingen AI i beviskjeden:** sitat er trygt, parafrase er det
ikke. Arkiv-sammenstillingen og PDF-pakken gjør mesteparten alt; det nye er notat-dokumenttypen og tabellen.

## 5. Tre hull, som skal stå i planen og ikke skjules

1. **«lm komplett».** Er bend, muffer og skjøter ikke egne poster, finnes antallet ikke i beskrivelsen.
   Sveiseskjøter kan ikke telles automatisk — Kenneth påpekte dette selv: «noen ganger er bend og muffer
   egen post, andre ganger er det lm komplett». Utledningen må da si at antallet er ukjent, ikke gjette.
2. **Meterposter gir ikke objekttall.** 340 m ledning sier ikke hvor mange strekninger. Her løser
   kumgruppeavstanden det: antall grupper gir antall spenn. Uten grøftepost må lengden oppgis.
3. **Kontraktsmengde er ikke bygd mengde.** Punktene må kunne justeres uten at planen mister rad-identitet
   ved revisjon — samme problem MS Project-importen alt har løst, og løsningen skal gjenbrukes, ikke
   bygges om.

## 6. Ratene er ferskvare — og det er en styrke

6 m/dag gjelder normal grøft. Fjell, grunnvann, trafikkavvikling og telehiv endrer den kraftig. Raten bør
derfor ha et forholdstillegg — normal / fjell / trafikkert — heller enn å late som den er presis. Planen
presenteres som **utledet forslag** som et menneske justerer, akkurat som fremdriftsplan-importen gjør i
dag.

**Ratene kan kalibreres fra firmaets egne data senere.** `prosentFerdig` ligger på postene, og dagsseddelen
har timene. Da kan systemet regne tilbake: hva ble den faktiske raten på dette prosjektet? Det er der
verdien blir stor — firmaets egne rater, målt på firmaets egne jobber, i stedet for erfaringstall fra en
bok. Dette er en senere fase, ikke en forutsetning.

## 7. Anbefaling

**Kontrollplan-utledningen først, som egen leveranse.** Liten, bygger på fire ting som finnes, gir verdi
umiddelbart. Ratemodellen kommer som steg to i samme spor — den er den samme utledningen med et tall til.

Rekkefølge design anbefaler:

1. **Oppslaget** `nsKode` → mal-referanse (lengste prefiks). Målbart alene: hvor mange poster i et
   virkelig prosjekt treffer en mal? Det tallet avgjør om resten er verdt å bygge.
2. **Punktutledning** fra poster med treff, med antall fra `mengdeAnbud` og enhet.
3. **Stopp-varsling** — ingen godkjente dokumenter på et strekk i N uker, **mens timer føres på prosjektet**.
   **Rate-fri**, og fanger tilfellet som kostet Kenneth 2,5 måned (§ 4b). Timekravet er det som skiller et
   blokkert strekk fra en planlagt stans, og som gjør varselet verdt å stole på.
4. **Måling av raten** fra dagsseddel på et ferdig prosjekt, ikke et anslag i en tabell.
5. **Ratetabellen** firmaet eier, fylt fra steg 4, med antall ledninger som parameter.
6. **Fristene** fra ratene, skrevet til `fristUke`/`fristAar`.
7. *(senere)* løpende kalibrering fra dagsseddel og `prosentFerdig`.

**Steg 1 og 4 er målinger, ikke bygginger.** Steg 1 bør kjøres først, mot et virkelig prosjekt med importert
beskrivelse.

🔴 **Rekkefølgen er endret 2026-09-22** etter at Kenneth opplyste at 6 m/dag er et anslag han ikke har
utledet. Stopp-varsling (steg 3) er flyttet foran ratetabellen, og ratetabellen skal **ikke seedes med
anslaget** — den fylles fra måling. En tabell med et tall som er dobbelt feil, gir falsk presisjon og
systematisk halv byggetid.

## 8. Hva Kenneth skal ta stilling til

1. **Godkjenner du rekkefølgen i § 7, med målingen i steg 1 før noe bygges?**
2. **UP1-delingen i § 2** — den henger nå sammen med dette, ikke bare med malkvalitet. Tre maler
   (UP1 nedstigningskum · UP3 sandfang · UO2.1 nedgravd ventil) er forutsetningen for at utledningen
   treffer riktig mal pr. post.
3. **Skal 80 m-regelen brukes som byggbarhetsvarsel** når prosjekterte kumgrupper ligger for langt fra
   hverandre til å kunne filmes? Design anbefaler ja, som et varsel og aldri som en sperre — det er
   prosjekterendes ansvar, men SiteDoc kan se det.
4. **Stikkledning fra vannkum.** Kenneth 2026-09-22: «i noen tilfeller ønsker kommunen å koble
   stikkledninger fra en vannkum». Det er et kontrollpunkt UP1 ikke har i dag. Skal det inn i
   vannkum-grenen i UP1 v2, eller holder feltet i UM1.1 om stikkledningsuttak?
5. ~~**Er 6 m/dag en god dag eller et prosjektsnitt?**~~ **Besvart 2026-09-22:** «jeg gjetter på 6 m pr dag
   → jeg har ikke prøvd å utlede tallet». Raten er et anslag. Design har utledet ~2,9–3,2 m/dag fra
   1100-metersprosjektet (§ 4b), med forbehold om at laget sto der sammenhengende. **Nytt spørsmål:**
   ligger det prosjektet i SiteDoc med timer, slik at raten kan måles fra dagsseddelen?
6. ~~**Hva ble rotet på det strekket?**~~ **Besvart 2026-09-22:** et metodevalg, ikke en kvalitetsfeil — hele
   strekket skulle sprenges i én runde i stedet for fortløpende syklus. **En sjekkliste ville ikke fanget
   det, og skal ikke gjøre det.** Se § 4b. Funnet ga i stedet detektoren «timer går, dokumenter står».
   **Nytt spørsmål:** skal metodebeskrivelse eller sprengningsplan være en egen dokumenttype i SiteDoc?
   Design foreslår ingenting nå — spørsmålet er notert så det ikke blir borte.
