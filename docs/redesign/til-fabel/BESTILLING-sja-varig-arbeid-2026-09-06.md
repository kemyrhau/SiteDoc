# Bestilling til fabel — SJA over flere dager, justering underveis, og hvem som egentlig låser

**Fra cowork 2026-09-06, etter Kenneths verifisering av SJA-en på test.**
Tre funn fra én testrunde. Det siste treffer signaturmodellen din.

🔴 **Kenneths egne ord står ordrett under hvert punkt** — han ba uttrykkelig om det, i tilfelle
cowork har misforstått. **Stol på sitatene, ikke på coworks omskriving.**

---

## Funn 1 — signering er blokkert av dokumentflyt-låsen (BLOKKER)

> **Kenneth, foran skjermen på test:** *«Alle felter er låst → jeg kan ikke gjøre noe.»*

**Målt:** seeden satte dokumentet til `status: "sent"`. Da slår flyt-låsen inn, og
`SignaturListeObjekt.tsx:170` leser den:

```ts
kanSignere = !leseModus && !gjeldendeRundeLaast && (egenRad || …)
```

🔴 **Et sendt dokument kan ikke signeres.** En SJA sendes mens mannskapet signerer den —
funksjonen er dermed ubrukelig i den flyten den er laget for.

### Kenneths forslag, ordrett

> *«Jeg foreslår at vi holder SJA åpen og at bedriften selv bestemmer → dokumentet trenger
> ikke lås →*
> *→ alternativ: lås på ved godkjent → gjenåpne og send tilbake for å signeres på nytt?»*

### Coworks anbefaling — smalere enn begge

**Behold flyt-låsen på innholdet. Unnta signaturlista.**
Ikke «SJA har ingen lås», men **«signering er ikke redigering»**.

| | Flyt-lås («Sendt») | Runde-lås («Avslutt runde») |
|---|---|---|
| Innholdsfelter | Låst | Låst |
| **Signaturlista** | 🔴 **Åpen** | Låst |

**Mot «lås ved godkjent»:** det ville tvunget en gjenbrukt SJA gjennom ny godkjenning hver gang
laget skal signere — og **gjenbruk var hele gevinsten**.

---

## Funn 2 — byggherren godkjenner ikke, han påser

> **Kenneth:** *«Det er ikke byggherre som skal godkjenne en risikovurdering →
> byggherreforskriften sier at byggherre skal påse at en risikovurdering utføres.»*

⚠️ **Cowork hadde skrevet «byggherren godkjenner risikovurderingen» i forrige runde. Feil.**
Ansvaret for vurderingen ligger hos arbeidsgiver; SJA-en er arbeidsgivers dokument.

**Konsekvens for designet:**
- «Godkjent» finnes ikke som ekstern handling på en SJA → duger ikke som lås-utløser
- **Låsen tilhører arbeidsgiver.** Den som eier vurderingen avgjør når den er endelig — og det
  er nettopp «Avslutt runde»

🔴 **Og det gir manko-lista en juridisk funksjon cowork ikke hadde sett:** byggherrens
påse-plikt oppfylles ved å kontrollere at vurderingen er gjort **av dem som gjør jobben**. En
SJA der fire av seks har signert dokumenterer at to ikke har lest den. **Uten manko-lista kan
han ikke påse noe — bare bekrefte at et dokument finnes.**

📌 **Cowork fører «byggherre påser, arbeidsgiver vurderer» inn i `domene-arbeidsflyt.md` som
bindende** — den styrer flere valg enn dette, særlig ansvarsgrense-saken (AG).

---

## Funn 3 — varig arbeid bryter «lås ved dagens slutt»

> **Kenneth:** *«Et annet problem → hva om kranarbeidet utføres fortløpende de neste 5 eller
> 10 dager?»*

**Sammenlign med det han sa 05.09, som ble designlåsen din:**

> *«Jeg liker ideen om låsing av felter ved dagens slutt. Og gjenåpning når den skal brukes
> senere → det er mye administrasjon spart å gjenbruke SJA av tilnærmet like
> arbeidsoperasjoner.»*

**«Dagens slutt» var et spesialtilfelle** — en jobb som varte én dag. For ti dagers kranarbeid
gir det ti runder der de samme seks signerer det samme ti ganger.

🟢 **Modellen din tåler allerede det riktige:** en runde er ikke bundet til en dag. **Det som
avslutter en runde er arbeidsoperasjonen**, ikke døgnet. Ny mann på dag 5 legges til som
deltaker og signerer inn i den åpne runden; chippen går `6/6` → `6/7`, som er riktig — han
mangler til han har lest den.

⚠️ **Men formuleringen «lås ved dagens slutt» bør ut av designlåsen**, ellers bygges den inn.

### Åpent spørsmål cowork ikke kan avgjøre

Mange bedrifter har en **daglig gjennomgang** — kort verifisering av at forholdene er uendret.
Skal den etterlate spor i SJA-en?

**Coworks vurdering: ikke en signaturrunde**, men en logglinje («gjennomgått [dato] av [navn],
forhold uendret»). Om SiteDoc skal bære den, eller om den hører i dagsseddelen, er et
produktvalg. **Kenneth er spurt om praksis hos A.Markussen; ikke besvart ennå.**

---

## 🔴 Funn 4 — justering underveis: signaturmodellens svakeste punkt

> **Kenneth:** *«Og vi trenger å justere noe underveis.»*

**Justeres innholdet på dag 7, har de seks som signerte på dag 1 signert på noe annet.**

Ditt design (2345) gir amber varsel + endringslogg, uten auto-invalidering — riktig avveining.
🔴 **Men dokumentet viser ikke hvem som signerte før endringen.** Rundenummeret er versjonen
*mellom* runder; **innenfor** en åpen runde kan innholdet endres uten at noe registreres. En
signatur fra før justeringen ser identisk ut med en etter.

### Mønsteret finnes i produktet fra før — PSI

```ts
gjeldende: s.psiVersion === psi.version     // psi.ts:423
```

**En PSI-signatur vises som utdatert hvis dokumentet er endret etterpå.** Ingen tvinges til
noe — men ingen kan tro at signaturen gjelder det som står der nå.

### Coworks anbefaling — to deler, og systemet dømmer aldri

**1. Innholdsversjon per signatur.** Et heltall som telles opp når innholdet endres; hver
signatur bærer versjonen den ble gitt på. Lista viser da:
*«Ola Tømrer — signert 05.09, før endring 07.09»* i amber. **Faktum, ikke dom.**

**2. Eksplisitt handling for ansvarlig: «Krev ny signatur».** Vurderer han justeringen som
vesentlig, nullstilles runden — folk må lese på nytt. Vurderer han den som uvesentlig, står
signaturene, men **merket**.

**Hvorfor ikke automatikk:** tvungen re-signering ved enhver endring gjør at folk slutter å
justere dokumentet. Da får du **unøyaktige SJA-er i stedet for oppdaterte** — verre for
sikkerheten, ikke bedre.

**Hvorfor ikke bare amber-varselet:** det forsvinner når siden lukkes. Om tre måneder ser ingen
at seks personer signerte en annen tekst.

**Systemet kan ikke avgjøre vesentlighet.** «Presiserte at kranfører står på nordsiden» og
«byttet til større kran» ser like ut i en diff. Bare et menneske kan skille dem — men systemet
skal aldri skjule at endringen skjedde.

⚠️ **Kostnad:** ett heltall på dokumentet, ett på hver signatur. **Krever migrering — Kenneth
gater den.**

---

## Testrunden ellers — det som virket

🟢 Chip `1/4` amber i lista · manko FØRST i amber boks · gjest merket «signer på ansvarliges
enhet» · «Tidligere runder» i amber, teller ikke i X · PDF med topplinje, HMS-kort, og
forrige-runde-rader alltid med.

⚠️ **«IKKE SIGNERT» i PDF er UTESTET** — alle fire signerte runde 1 i seed-dataene, så ingen rad
viser den tilstanden. Seeden bør gi én deltaker som aldri har signert.

---

## Ingen ordre skrevet

Cowork skriver ordren når du har designet funn 1 og 4. Funn 2 og 3 er avklaringer som endrer
premisser i designlåsen din — de trenger ikke ny kode, men designlåsen bør rettes.
