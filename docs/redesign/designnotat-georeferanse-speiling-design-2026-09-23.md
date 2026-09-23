# Designnotat: hvorfor speilingen blir feil vei — og hvorfor nord slutter å være nord

**Fra:** design · **Til:** Kenneth-gate · **Dato:** 2026-09-23
**Utløst av:** Kenneth 2026-09-23.

> «vi har nå en feil med speiling av tegning/bilde når vi georefererer med to koordinater. Jeg forstår ikke
> hvorfor det skjer. alle tegninger har en retning nord. når vi koordinatfester med to koordinater, og
> speilingen blir feil vei, da er ikke Nord lenger mot nord»

**Kort svar: det er to årsaker, og den andre er større enn speilingen.** Begge er strukturelle — ingen av dem er
en slurvefeil, og ingen av dem lar seg fikse med en bedre to-punktsformel.

---

## 1. Første årsak: to punkter kan ikke vite hvilken vei som er opp

**Dette er matematikk, ikke en bug.**

En similaritet — skalering, rotasjon, forskyvning — har fire frihetsgrader. To punktpar gir fire likninger. Så
løsningen er **entydig**… for hver av de to kiralitetene:

| | Form | Determinant | Treffer de to punktene |
|---|---|---|---|
| **Uspeilet** | `[a −b; b a]` | `+ (a²+b²)` | **eksakt** |
| **Speilet** | `[a b; b −a]` | `− (a²+b²)` | **eksakt** |

🔴 **Begge treffer de to kalibreringspunktene perfekt. Informasjonen om hvilken som er riktig, finnes ikke i to
punkter.** Koden må derfor **anta** — og fiksen fra 2026-08-13 (`georeferanse.ts:217-236`, feltverifisert på
Lakselv lufthavn) antar **alltid speilet**, fordi breddegrad vokser nordover mens piksel-y vokser nedover.

**Antakelsen er riktig i prinsippet.** Enhver avbildning fra et høyrehendt geografisk plan til et venstrehendt
bildeplan *er* orienterings-reverserende. **Derfor kan ikke «feil vei speilet» alene forklare det du ser.**

## 2. 🔴 Andre årsak, og den forklarer symptomet: koordinatene er PROSENT

**Målt 2026-09-23:** `georeferanse.ts:4` og `:18-20` sier det selv — transformasjonen mapper til
**«pixel-prosent»**, ikke til piksler. Referansepunktenes `pixel.x` og `pixel.y` er **prosent av bildet**.

**Og der bryter similariteten sammen:**

På en tegning som er 2:1 i bredde/høyde, tilsvarer **1 % i x dobbelt så mange meter som 1 % i y**.
Avbildningen fra meter til prosent er altså en **ikke-uniform skalering** — ulik faktor i x og y.

🔴 **En similaritet tvinger samme skala i begge retninger.** Den *kan ikke* uttrykke det. Men med bare to punkter
har den nok frihetsgrader til å treffe dem eksakt likevel — **så den fordeler hele formatfeilen som ROTASJON
overalt ellers.**

**Det er presis forklaringen på setningen din:** «nord er ikke nord lenger». Rotasjonen er ikke en speiling som
gikk feil vei — **det er en tvangsrotasjon som kompenserer for at tegningen ikke er kvadratisk.** Jo mer avlang
tegningen er, jo mer dreier nord.

## 3. Derfor virker tre punkter — og det er ikke tilfeldig

**3+ punkter bruker en annen gren:** `beregnAffine` (`georeferanse.ts:199-200`). En **affin** transformasjon har
seks frihetsgrader og tillater **ulik skala i x og y, pluss skjevhet**.

🟢 **Den absorberer formatforholdet gratis, og den bestemmer kiraliteten selv** — tre ikke-kollineære punkter
kan bare avbildes på én måte. **Begge årsakene over forsvinner i samme grep.**

## 4. 🔴 Fellen som gjør feilen usynlig: kalibreringsfeilen er ALLTID 0 med to punkter

`beregnKalibreringsFeil` (`:376`) måler avviket **bare i kalibreringspunktene**. Med to punkter treffer
similariteten dem eksakt per konstruksjon.

🔴 **Den rapporterer altså «±0 m» — på en kalibrering som kan være titalls meter feil ti meter unna.**

**Det er «stille tomhet» i en femte variant: et kvalitetstall som er strukturelt null og derfor ikke måler noe.**
Brukeren ser 0 og stoler på den. Det er verre enn ingen måling, fordi den ser ut som en bekreftelse.

## 5. Anbefaling

**A. Krev tre punkter. Gjør to punkter til unntaket, ikke normalen.**

Tre punkter løser kiralitet og formatforhold i samme grep, **og gir et kalibreringstall som faktisk måler noe**
— med tre punkter er feilen i punktene ikke lenger strukturelt null.

**B. To punkter kan beholdes som fallback, men da må én av to ting gjøres:**

- **Normalisér før fit:** regn prosent om til et metrisk proporsjonalt rom via `Drawing.imageWidth`/
  `imageHeight` før similariteten fittes, og tilbake etterpå. ⚠️ **Begge feltene er nullable**
  (`schema.prisma:905-906`, satt «for tegningsposisjon i PDF») — **mål hvor ofte de faktisk er satt før dette
  bygges.** Er de tomme for DWG-layouter, virker ikke fallbacken der.
- **Eller: la brukeren peke ut nord** på tegningen. Det er Kenneths eget poeng — «alle tegninger har en retning
  nord» — og det er den tredje opplysningen som mangler. Én pil er lettere å oppgi enn et tredje innmålt punkt.

**C. 🔴 Uansett valg: slutt å vise «±0 m» for en to-punktskalibrering.** Vis at feilen **ikke er målbar** med to
punkter. En tom verdi som sier «ikke målt» er ærlig; en null som betyr «perfekt» er ikke.

## 6. Hva som skal måles før noe bygges

1. **Er formatforholdet allerede kompensert noe sted i kallkjeden?** Design har lest `georeferanse.ts`, ikke alle
   kallstedene. Om `GeoReferanseEditor` normaliserer prosent før den lagrer punktene, faller årsak 2 bort — og
   da står bare kiralitet igjen.
2. **Hvor mange eksisterende georefererte tegninger har to punkter?** De er alle mistenkte, og de må
   rekalibreres — ikke migreres automatisk. **En automatisk «fiks» av gamle kalibreringer ville flyttet
   markører uten at noen ba om det.**
3. **Er `imageWidth`/`imageHeight` satt i praksis?** Avgjør om fallbacken i B er mulig.

## 7. Hva Kenneth skal ta stilling til

1. **Tre punkter som krav?** Design anbefaler ja. Det koster ett ekstra innmålt punkt og fjerner to
   strukturelle feilkilder.
2. **Hvis to punkter skal beholdes: nord-pil eller normalisering?** Design heller mot **nord-pilen**, fordi den
   er den opplysningen som faktisk mangler, og fordi den ikke avhenger av felter som kan være tomme.
3. 🔴 **Eksisterende to-punktskalibreringer: varsle og be om rekalibrering, eller la dem stå?** Design anbefaler
   **varsle** — de er alle mistenkte, og en markør som ligger feil er verre enn en som mangler.

---

# 🔴 TILLEGG 2026-09-23 — Kenneth utfordret metoden, og han har rett

> «jeg må utfordre dette → kalibrerer vi med beste metode? kan det finnes bedre metoder? jeg vet dakux benytter
> en metode der man setter et koordinat inn i en tegning → dwg som man koordinatfester etter»

**Svar: nei, vi bruker ikke beste metode. Og SiteDoc HAR allerede den bedre informasjonen — den kastes i siste
steg.**

## Målingen som endrer hele saken

**`dwgKonvertering.ts:969-991`, målt 2026-09-23.** Konverteringen gjør faktisk det Dakux gjør:

1. **`detekterKoordinatSystem(filnavn, extents)`** — systemet detekteres (utm33, ntm6 …)
2. **DWG-ens `extents`** — tegningens virkelige omriss i kildesystemet — konverteres til WGS84
3. 🔴 **Og så pakkes resultatet ned i TO PUNKTER PÅ DIAGONALEN:**

```
point1: pixel { x: 0,   y: 0   } → gps(maxY, minX)   // øvre venstre
point2: pixel { x: 100, y: 100 } → gps(minY, maxX)   // nedre høyre
```

**En eksakt kjent transformasjon blir degradert til et to-punkts-estimat.** Og det estimatet mates inn i
nøyaktig den similariteten som ikke kan uttrykke ulik skala i x og y (§ 2).

## 🔴 Og det forklarer symptomet med tall

De to punktene ligger på **diagonalen**. I prosentrommet peker vektoren fra p1 til p2 i **45°**. I metrisk rom
peker den i retning `(bredde, −høyde)`.

**For en tegning som er 2:1 — si 200 × 100 m:** metrisk diagonal er `(200, −100)`, altså **−26,6°**.
Similariteten **må** rotere 45° over på −26,6°. **Hele tegningen dreies ~71,6°** — på en tegning som er
nord-opp og skal ha 0°.

🔴 **Det er ikke en speiling som gikk feil vei. Det er en tvangsrotasjon på over 70 grader, og den er verst for
de mest avlange tegningene.** Kvadratiske tegninger treffer 45° = 45° og ser riktige ut — **derfor har feilen
overlevd.**

## Den bedre metoden, som ikke krever kalibrering i det hele tatt

**Extents gir en EKSAKT affin transformasjon direkte. Ingen fitting, ingen estimering, ingen brukerklikk:**

```
prosent-x ∈ [0,100]  →  [minX, maxX]        (lineært)
prosent-y ∈ [0,100]  →  [maxY, minY]        (lineært, invertert)
```

**Ulik skala i x og y faller ut av seg selv**, fordi det er to uavhengige lineære avbildninger. **Kiraliteten
faller ut av y-inversjonen.** Begge årsakene i § 1 og § 2 forsvinner — ikke fordi vi fitter bedre, men fordi vi
**slutter å fitte noe som er kjent**.

## Revidert anbefaling — metodevalg etter hva tegningen VET om seg selv

| Tegningen har | Metode | Brukerklikk | Feil |
|---|---|---|---|
| **Koordinater i fila** (DWG/DXF fra oppmåling) | **Utled affin fra `extents` + detektert system** | **ingen** | **0 — det er aritmetikk** |
| Kjent målestokk og nord (tittelfelt) | ett punkt fester forskyvningen | 1 | liten |
| Ingenting kjent (foto, skannet PDF) | **tre punkter, affin** | 3 | målbar |
| — | ~~to punkter, similaritet~~ | ~~2~~ | 🔴 **utgår som primærvei** |

🔴 **Tre punkter er altså IKKE hovedanbefalingen lenger — det er fallbacken for tegninger uten koordinater.**
For DWG er svaret at kalibrering ikke skal skje.

**Dakux-metoden Kenneth beskriver, er rad 1 og 2:** tegningen er alt i et metrisk system, så ett innsatt
koordinat er nok å feste den med. **Den virker fordi den stoler på tegningen — ikke fordi den fitter bedre.**

## Hva som skal måles før dette bygges

1. 🔴 **Hvor ofte er `extents` og `coordinateSystem` faktisk satt?** Hele forslaget hviler på dem. Er
   deteksjonen basert på **filnavn** (den tar `filnavn` som argument!), er den svakere enn den ser ut — og da må
   brukeren kunne bekrefte eller overstyre systemet.
2. **Hva skjer med tegninger som alt er kalibrert med to punkter?** De er alle mistenkte (§ 6). Auto-georeferansen
   fra DWG-konverteringen er **også** to punkter — så **de mistenkte inkluderer alle auto-georefererte
   DWG-tegninger**, ikke bare de manuelt kalibrerte. Det er sannsynligvis flertallet.
3. **Beholder SVG-konverteringen extents-forholdet?** Blir tegningen normalisert til en viewbox med annet
   formatforhold enn extents, må omregningen ta hensyn til det. (Det finnes en `dwg-viewbox-overflow`-sak i
   reléhistorikken — sjekk den først.)

## Og én ting som blir bedre gratis

**Med utledet transformasjon er `beregnKalibreringsFeil` ikke lenger strukturelt null** — den er ikke
*relevant*, fordi det ikke er et estimat. **UI-en skal da si «utledet fra tegningens koordinatsystem», ikke
«±0 m».** Det er forskjellen mellom «vi har ikke målt» og «det er ingenting å måle».
