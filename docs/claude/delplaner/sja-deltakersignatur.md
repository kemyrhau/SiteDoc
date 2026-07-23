---
name: sja-deltakersignatur
status: 🟡 VEDTATT RETNING (Kenneth 2026-07-21) — ikke bygget. Begge hovedspørsmål besvart; én liten presisering igjen (relukking)
eier: Kenneth (domenesannhet) · fabel (design + malbygger-konsekvens) · cowork (måling)
sist_verifisert_mot_kode: 2026-07-21
---

# SJA — deltakerliste som bygges av signaturene

> **Kenneth 2026-07-21:** *«Hvem bygger listen med deltagere? Listen bygger seg selv hver gang en arbeider signerer — denne funksjonen må utbedres.»*
>
> Utløst av gaten: kan SJA gå i standard dokumentflyt? **Ja — men ikke med dagens signaturfelt.**

## Kravet

En SJA gjennomgås av et arbeidslag og signeres. Utføres samme arbeid igjen **tre uker senere med et nytt gruppemedlem**, skal den nye personen kunne signere **samme SJA** — også etter at dokumentet er ferdigbehandlet.

**Deltakerlisten skal bygge seg selv:** hver signatur legger til én person. Ingen fyller ut listen manuelt.

## Dagens tilstand (cowork-målt 2026-07-21)

SJA-malen (`packages/shared/src/types/index.ts:565-573`) har to atskilte felter:

```
persons     "Deltakere"             påkrevd   ← manuelt utfylt liste
signature   "Signatur arbeidsleder" påkrevd   ← ÉN signatur
```

**Signaturfeltet:** `apps/web/src/components/rapportobjekter/SignaturObjekt.tsx` — canvas-tegning lagret som én PNG data-URL i `verdi`.

### Tre hindre

| # | Hinder | Detalj |
|---|---|---|
| 1 | **Én signatur per felt** | `verdi` er én streng. Ingen struktur for flere signaturer |
| 2 | **Ingen tidsstempel** | Signaturen bærer ikke når den ble avgitt. «Tre uker senere» er usynlig |
| 3 | **Signaturfeltet bor i dokumentets data** | Å signere = **redigere dokumentet**. Er SJA-en `closed`, blokkerer statuslåsen (`flytRolle.ts:182`: `closed/approved/cancelled → leser`) |

**Hinder 3 er det avgjørende.** Det er ikke en manglende funksjon — det er at signaturen er modellert som dokumentinnhold. En liste som skal vokse etter lukking kan ikke ligge der.

Deltakerne signerer heller ikke i dag: `persons` er en navneliste, `signature` er arbeidslederens alene.

## Vedtatt retning

**Deltakerlisten er signaturene.** De to feltene kollapser til én mekanisme:

- Én rad per signatur: **person · tidspunkt · signaturbilde**
- Listen er **avledet**, ikke utfylt — den vokser når noen signerer
- Ligger **ved siden av dokumentdataen**, ikke i den → sen signering treffer ikke statuslåsen

### Referansemønster finnes: `PsiSignatur`

`packages/db/prisma/schema.prisma:1677` har allerede nøyaktig denne formen — én rad per person, `signatureData`, og gjeste-felter for QR-signering (`:1719`). Den er bygget for at folk signerer seg inn på **ulike tidspunkt**, som er samme problem.

**Gjenbruk mønsteret, ikke tabellen** — `PsiSignatur` er bundet til PSI-domenet. Cross-package-FK håndteres som svakt String-felt per CLAUDE.md § To-stegs migrations-policy.

## ✅ Besvart av Kenneth 2026-07-21

**1. Hvem får signere senere?** → **Er SJA-en lukket: be om åpning. Deretter kan alle signere.**

Åpningen er kontrollpunktet — ikke en tillatelsesliste per person. Ett sted å gate, i stedet for en rettighetsmatrise som må vedlikeholdes. Er dokumentet åpent, er signering fritt.

**2. Endrer en sen signatur SJA-ens status?** → **Nei.** Signaturen dokumenterer at personen har gjennomgått SJA-en. Den flytter ikke dokumentet.

### Arkitektonisk konsekvens — statuslåsen respekteres, den omgås ikke

Dette endrer skissen over. Cowork antydet først at signaturlisten burde ligge utenfor dokumentdataen **for å unngå** statuslåsen. Kenneths modell er bedre: låsen **gjelder**, og en bevisst åpning kreves for å signere på et lukket dokument.

**Gevinsten er sporbarhet.** «Hvem åpnet en lukket SJA, og når» blir en registrert handling i stedet for noe som skjer stille i bakgrunnen. På et HMS-dokument er det verdt mer enn bekvemmeligheten.

**Signaturlisten kan dermed leve i dokumentets data** — hindret var aldri lagringsstedet, det var at ingen hadde bestemt hvordan man kommer forbi låsen. Nå er det bestemt.

## Hvem åpner — arbeidsflyten (Kenneth 2026-07-21)

> **Kenneth:** *«Prosjektleder vet at nye mennesker tilkommer og gir beskjed om at SJA må oppdateres. HMS-ansvarlig får beskjed om å åpne SJA.»*

**Sekvensen:**

```
1. Prosjektleder ser at nye folk kommer på arbeidet
2. → varsler at SJA må oppdateres
3. HMS-ansvarlig åpner den lukkede SJA-en
4. De nye signerer (alle kan — åpningen var kontrollpunktet)
5. HMS-ansvarlig lukker igjen
```

**Steg 5 følger av steg 3:** den som åpnet et lukket HMS-dokument avslutter handlingen. Det holder sporet helt — «hvem åpnet, hvem signerte, hvem lukket» er en sammenhengende kjede. *(Cowork-utledning fra Kenneths flyt, ikke eksplisitt uttalt — bekreftes ved ordreskriving.)*

**Merk at åpningen dermed ikke er en systemtillatelse, men en HMS-faglig handling.** HMS-ansvarlig vurderer om SJA-en fortsatt er dekkende for arbeidet, eller om den må oppdateres før nye signerer. Det er poenget med at det er *han* som åpner, og ikke hvem som helst.

### SJA er lederdrevet — ikke arbeiderdrevet (Kenneth 2026-07-21)

> **Kenneth:** *«I praksis er det slik at arbeideren ikke selv oppdager at han må gjøre en SJA — det er lederne som vet at farlig arbeid skal utføres og planlegger deretter.»*

**Dette er hovedflyten, og den er planlagt ovenfra:** ledelsen vet at farlig arbeid kommer, planlegger SJA-en, vet hvem som skal delta, og sørger for at den er åpnet før folk møter.

**Arbeiderens rolle er å signere** — ikke å initiere. En arbeider som selv må oppdage at en SJA mangler, er allerede et symptom på at planleggingen sviktet.

**Prioritering:** lederflyten (prosjektleder → HMS-ansvarlig → åpning) er hovedveien og bygges først.

## Når planleggingen glipper — arbeiderne gjør SJA-en selv (Kenneth 2026-07-21)

> **Kenneth:** *«I et byggeprosjekt jobber alle sammen for et sikkert arbeidsmiljø — vi hjelper hverandre. Men det er slik at lederne planlegger og skal fange opp farlig arbeid, og planlegge SJA i henhold til det. Noen ganger glipper det, og arbeiderne utfører SJA på egen hånd.»*
>
> Og: *«Arbeid er farlig dersom han selv opplever det slik.»*

**Ansvaret ligger hos lederne** — de skal fange opp farlig arbeid og planlegge SJA deretter. Glipper det, tar arbeiderne det selv. Det er ikke en konflikt mellom nivåene, det er at alle drar i samme retning.

**Arbeiderens vurdering er likevel avgjørende:** opplever han arbeidet som farlig, er det farlig. Terskelen for å ta en SJA skal derfor være lav — ingen skal måtte argumentere seg til den.

### ✅ Dette er allerede bygget

Cowork antok først at dette krevde en ny «krev SJA»-funksjon. **Det gjør det ikke** — måling på to nivåer:

```
dokumentflyt.md § HMS   Oppretter | Alle brukere
modul.ts:59             Boks 1: bestiller — null-medlem (åpen for alle prosjektmedlemmer)
```

**En arbeider kan opprette en SJA selv i dag.** HMS-flytens steg 1 har ingen medlemsbinding, så alle prosjektmedlemmer slipper inn — uavhengig av faggruppe. Det er samme egenskap som gjør SJA tverrgående (§ over), og den dekker dette tilfellet gratis.

### Det som gjenstår er ikke tilgang, men synlighet

Spørsmålet er ikke *om* arbeideren kan, men **om han vet at han kan**. En funksjon som finnes, men som ingen finner, er ikke i bruk.

**Til vurdering (fabel, ikke avgjort):**
- Er «Ny HMS-rapport → SJA» nåbar og forståelig fra mobil, der feltarbeideren står?
- Kommer terskelen i veien — antall felter, påkrevde felt, mal-valg?

**Ikke bygg en ny inngang før dette er målt.** Det finnes allerede én; problemet kan være at den er for godt gjemt.

**Kodemåling:** `leggTilKommentar` (`apps/api/src/routes/oppgave.ts:234`) har **kun** `verifiserDokumentTilgang` — ingen status-vakt, ingen rolle-vakt. **Serveren tillater altså kommentar på et lukket dokument allerede i dag.**

> ⚠️ **Klienten skjuler det sannsynligvis.** `utledDokumentRettighet:182` gir `"leser"` for `closed/approved/cancelled`, og kommentarfeltet er trolig skjult for lesere. Samme klient/server-divergens som er truffet flere ganger 2026-07-21. **Må verifiseres i UI, ikke antas.**

### Kommentar duger — men handling er riktig form

| | Fritekstkommentar | «Be om åpning»-handling |
|---|---|---|
| Varsler HMS-ansvarlig | ❌ Han må tilfeldigvis åpne dokumentet — og han har ingen grunn til å åpne en lukket SJA | ✅ |
| Søkbar tilstand («hvilke SJA-er venter på åpning?») | ❌ Ligger som tekst i en tråd | ✅ |
| Lukkes når den er besvart | ❌ Ingen vet om den er håndtert uten å lese tråden | ✅ |
| Byggekostnad | ✅ Null — finnes | Krever bygging |

**Anbefaling:** kommentaren er en gyldig nødløsning hvis UI-et viser den på lukkede dokumenter. Målet er en egen handling — **men først for lederflyten**, som er hovedveien. Arbeider-forespørselen er sikkerhetsnettet.

**Steg 2 trenger uansett et varsel.** «Prosjektleder gir beskjed» er i dag utenfor systemet — en melding på telefon eller i forbifarten. Tverrgående varsling er eget spor ([varsling.md](../varsling.md)); **åpningsforespørselen bør vurderes sammen med den saken**, ikke bygges isolert her.

## Konsekvenser å ta med i designet

- **Malbyggeren:** «Deltakere»-feltet på SJA-malen blir overflødig hvis listen avledes. Skal felttypen `persons` fjernes fra SJA-malen, eller beholdes for planlagte deltakere (i motsetning til faktiske)? Det er et reelt skille — hvem *skulle* delta vs. hvem *har* signert.
- **Gjelder dette kun SJA?** Signaturfeltet brukes også i andre maler (`types/index.ts:515`, `:549`, `:622`). Endres felttypen, treffer det dem. Piloten bør være SJA alene.
- **Utskrift:** en SJA med signaturer avgitt over tid må vise dem med dato i print/PDF.

## ✅ SJA hører i HMS-flyten — ikke standard dokumentflyt (Kenneth 2026-07-21)

> **Kenneth:** *«En kranbil utfører løft over en hovedinngang til byggeplass → SJA utføres → dette involverer arbeidere på tvers av forskjellige dokumentflyter → oppgaven må derfor ligge som HMS-flyt, ikke som standard dokumentflyt. Den hører også til i HMS-arbeidet.»*

**Dette omgjør en tidligere cowork-gate.** Cowork svarte først at SJA *kunne* gå i standard dokumentflyt forutsatt at signeringen ble løst. **Den vurderingen var feil akse** — den gatet på signeringsmekanikk, ikke på hvem som deltar.

**Argumentet som avgjør:** en SJA for et kranløft samler folk fra flere faggrupper og flere dokumentflyter samtidig. Standard dokumentflyt er bundet til faggruppe- og flytmedlemskap og kan per definisjon ikke romme en gruppe som går på tvers.

**HMS-flyten er allerede bygget for det** (cowork-målt, `apps/api/src/routes/modul.ts:60`):

```
steg 1:  rolle "bestiller",  null-medlem  → åpen for ALLE prosjektmedlemmer
steg 2:  rolle "utforer",    groupId      → HMS-gruppen
```

Null-medlemmet på steg 1 er nettopp den tverrgående egenskapen et kranløft krever. **Ingen strukturendring trengs for å plassere SJA riktig** — SJA-malen ligger allerede i HMS-domenet (`subdomain: "sja"`).

**Deltakersignatur-kravet står uendret.** Det er uavhengig av hvilken flyt SJA lever i — listen skal bygges av signaturene uansett.

## Relatert

- **Synlighet:** SJA er **åpen** (Kenneth 2026-07-21); RUH og HMS-avvik er private. Se [hms-synlighet-regel.md](hms-synlighet-regel.md) — SJA som åpen HMS-type er nettopp det som gjør tverrgående deltakelse mulig.
- HMS-domenemodell (to akser, arbeidsgiver-ruting): [hms-domenemodell.md](../hms-domenemodell.md).
- Rollematrisen ([dokumentflyt.md](../dokumentflyt.md)) gjelder dokumentet. **Signering er ikke redigering** i denne modellen — det er en egen handling med egen adgangsregel (spørsmål 1).
