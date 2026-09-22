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
3. **Ratetabellen** firmaet eier, seedet med Kenneths tall, med antall ledninger som parameter.
4. **Fristene** fra ratene, skrevet til `fristUke`/`fristAar`.
5. *(senere)* kalibrering fra dagsseddel.

**Steg 1 er en måling, ikke en bygging.** Den bør kjøres først, mot et virkelig prosjekt med importert
beskrivelse.

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
