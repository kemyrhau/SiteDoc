# Designnotat: opprettelse uten modal — mobil tar etter web, og emnet flyttes inn i dokumentet

**Fra:** design · **Til:** Kenneth-gate · **Dato:** 2026-09-22
**Utløst av:** Kenneths måling på telefon 2026-09-22, med skjermbilder.

> «jeg liker ikke dette startbildet i det hele tatt → det er et ekstra steg som kun tar tid og ikke gir reel mening.
> hvorfor kommer det opp valg av faggruppe? → dokumentflyten til dokumentet bestemmer faggruppen.»

**Kenneth 2026-09-22: likt for web og mobil, i hvert fall så likt vi kan.**

---

## 1. Hva skjermbildene viser

**Opprett-skjermen på mobil** (`OpprettDokumentModal`) har fem felt, og fire av dem er allerede avgjort når skjermen
åpnes: mal er låst, prosjekt er låst, lokasjon er satt fra GPS, og emne er valgfritt. Det eneste som gjenstår, er
**bestiller-faggruppe**, som er påkrevd — en gul stripe sier «Velg bestiller-faggruppe for å opprette», og
Opprett-knappen er slått av til du har gjort det.

**Skjermen finnes altså for ett felt.**

**I utfyllingen** står dokumentflyten øverst («Sitedoc Ledelse → …») og lokasjonslinja rett under («Bygg B12 ·
Skjermbilde …»). Begge tingene du måtte ta stilling til i forrige steg, vises her uansett. **Emnet vises ikke i det
hele tatt.**

## 2. Målingen som avgjør saken: web gjør det allerede riktig

| Flate | Hvordan et dokument opprettes i dag |
|---|---|
| **Web** | Malene listes gruppert: faggruppe → dokumentflyt → mal. **Ett klikk på malen oppretter dokumentet.** Flyten følger av hvor malen står, og `bestillerFaggruppeId` settes fra flyten (`sjekklister/page.tsx:334`). En mal som hører til flere flyter, vises under hver, så klikket er entydig — ingen steg to. Byggeplass og tegning arves fra konteksten i toppen. |
| **Mobil** | Modal med fem felt, der ett er påkrevd og må velges manuelt. |

**Kenneths påstand er altså ikke bare rimelig — den er allerede bygget, på den andre flaten.** Serveren utleder det
samme på kontrollplan-veien (`sjekkliste.ts:329–353`).

Dette gjør «likt for web og mobil» til en ryddejobb, ikke en oppfinnelse: **mobil tar etter web.**

## 3. Hva som foreslås

### A. Mobil: bort med opprett-modalen

Trykk **+** → mal-velger gruppert som på web (faggruppe → dokumentflyt → mal) → **klikk oppretter dokumentet** → du
lander i utfyllingen.

- **Bestiller-faggruppe forsvinner som felt.** Den følger av flyten, slik den gjør på web.
- **Ingen egen flyt-velger.** En mal i flere flyter står under hver, som på web. Da er klikket entydig.
- **Lokasjon settes ikke i opprettelsen.** Byggeplass og tegning arves fra konteksten, slik web gjør, og justeres i
  lokasjonslinja inne i dokumentet — der den uansett vises.
- **«Opprett fra tegning» beholdes urørt.** Der er posisjonen satt på forhånd, og den veien skal virke som før.

### B. Begge flater: emnet inn i dokumentet

Emne er i dag **bare** mulig å sette i opprett-modalen på mobil. I dokumentet er det borte: `EmneVelger.tsx:117` viser
i lesemodus bare blek grå kursiv «ingen emne» — uten etikett og uten ramme.

**Det undergraver Kenneths eget vedtak 2026-08-29:** emne er en merkelapp, ikke dokumentasjon, og skal kunne endres
etter sending. I dag er det motsatt — det kan bare settes før dokumentet finnes.

**Foreslått:** emnefeltet står synlig øverst i dokumentet på begge flater, med malens forhåndsdefinerte emner som
forslag (de finnes allerede i mobilkoden). Tomt emne vises som et tydelig, trykkbart felt — ikke som grå kursiv.

## 4. Dette må måles før det bygges

1. **Hvem andre enn opprettelsen er avhengig av at klienten sender `bestillerFaggruppeId`?** Zod har den som valgfri,
   og serveren utleder den alt på én vei. Finnes det kall som i dag lener seg på klientens verdi, skal de meldes, ikke
   endres i stilhet.
2. **Offline.** Oppretting uten nett må virke som før. Utledes faggruppen på serveren, må køen tåle at feltet er tomt.
3. **«Opprett fra tegning»** og kontekstkjeden: uendret oppførsel, målt.
4. **Sist-brukt-minnet** på mobil (byggeplass og tegning per byggeplass) — hvor hører det hjemme når modalen
   forsvinner? Trolig i kontekstvelgeren i toppen, som web.

## 5. Hva Kenneth bør ta stilling til

1. **Godkjenner du A og B?**
2. **Skal mobilens mal-velger bruke samme gruppering som web** (faggruppe → dokumentflyt → mal), selv om det gjør
   listen dypere enn i dag? Design anbefaler ja — det er det som gjør at flyten kan utledes uten et ekstra valg.
3. **Skal emnefeltet være synlig også når dokumentet er sendt** (lesemodus for andre), eller bare for den som har
   ballen? Design anbefaler synlig alltid, redigerbart for den som kan redigere — ellers gjentar vi feilen fra i dag.
