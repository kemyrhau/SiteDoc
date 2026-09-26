---
status: 🟢 STYRENDE — vedtatt av Kenneth 2026-09-26
opprettet: 2026-09-26
forfatter: design
gjelder: enhver verdi som en bruker vil lese som en måling
---

# Et tall som ser ut som en måling, må bære sin opprinnelse

## § 1 Regelen

🔴 **En verdi som en bruker vil lese som en måling, skal bære to ting — og begge skal være synlige DER tallet
vises, ikke bare i databasen:**

1. **Rammen** — hvilket koordinatsystem, hvilken målestokk, hvilken enhet den står i
2. **Utledningen** — hvordan verdien ble til

⚠️ **«2,45 m» er ikke en måling. «2,45 m (målestokk 1:50, fra tittelfelt — bekreftet)» er det.**

**Begrunnelsen er ikke ryddighet.** SiteDocs tall havner i sluttoppgjør. **Et tall uten opprinnelse er en
påstand, og en påstand taper mot en som kan gjøre rede for seg.**

## § 2 Tre følgeregler

### 🔴 2a. Mangler rammen, skal funksjonen være AVSLÅTT — ikke vise tallet likevel

**Er målestokken ukjent, skal måleverktøyet være av, med lesbar grunn.** ⚠️ **Å vise piksler som om de var
meter er verre enn å ikke måle.**

### 🔴 2b. To verdier i ULIKE rammer skal ikke kunne sammenlignes

**Systemet skal nekte, ikke regne.** ⚠️ **Et volum utledet av to punktskyer i hver sin lokale ramme ser
plausibelt ut og er feil — og ingenting protesterer med mindre noen har bygget vakten.**

### 🔴 2c. Etiketten skal si det tallet ER, ikke det vi ønsker det var

**Står det «Øst» over et modellokalt X, lyver flaten.** ⚠️ **Enten gjøres tallet sant, eller så sier etiketten
hva det er.** **Å beholde en geodetisk etikett over et vilkårlig tall er den dyreste av de tre mulighetene.**

## § 3 Målt belegg — fire tilfeller, alle 2026-09

**Regelen er ikke utledet av prinsipp. Den er destillert av fire saker som dukket opp uavhengig samme uke.**

| Sak | Feltet som bærer opprinnelsen | Hva det skiller |
|---|---|---|
| **Overflate fra punktsky** | `bakkeMetode` | `klasse2` (leverandørens klassifisering) vs `minZ` (grov tilnærming). 🔴 **Ikke like mye verdt som dokumentasjon** |
| **Måling i tegning** | `scaleKilde` | `tittelfelt` · `manuell` · `kalibrert` · `georeferanse`. **En kalibrert verdi måler bakken; en avlest måler papiret** |
| **Sammenligning av overflater** | `ramme` | 🔴 **Vakt, ikke bare merkelapp** — ulik ramme gir feil volum uten feilmelding |
| **3D-klikk** | *(mangler)* | Etiketten sier «Øst»/«Nord» over rå Three.js-koordinater. **`ifcMetadata.ts` leser IFCSITE-anker, men INGEN nordretning** — så øst og nord kan ikke regnes ut |

🔴 **Det fjerde er grunnen til § 2c.** Panelet har løyet siden `bf665590` (2026-03-22) — **ikke fordi noe ble
ødelagt, men fordi etiketten ble skrevet før transformasjonen fantes, og transformasjonen kom aldri.**

## § 4 Hva regelen IKKE krever

- **Ikke at hver verdi får en egen kolonne.** Ett felt kan bære rammen for mange verdier
- **Ikke at usikkerhet tallfestes.** ⚠️ **Kenneth har selv sagt at bemanningstall aldri blir helt rett — en
  mal som later som noe annet, blir ikke brukt.** **Regelen krever at kilden er kjent, ikke at feilen er målt**
- **Ikke at gamle rader fylles.** **Ny verdi bærer opprinnelse; eldre merkes som ukjent framfor å gjettes**

## § 5 Når regelen gjelder

**Ved enhver ny funksjon som produserer et tall en bruker kan komme til å oppgi videre** — volum, lengde,
areal, koordinat, antall som skal avstemmes.

⚠️ **Tvilstilfelle: still spørsmålet «kan noen bli bedt om å forsvare dette tallet om to år?»** **Er svaret ja,
gjelder regelen.**
