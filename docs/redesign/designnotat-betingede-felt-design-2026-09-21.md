# Designnotat: betingede felt i sjekklistemalene

**Fra:** design · **Til:** Kenneth-gate · **Dato:** 2026-09-21
**Bakgrunn:** Kenneths spørsmål 2026-09-21 — kan malen vise kravene for *den* dekketypen som er valgt, i stedet for
alle? Og er han villig til å gå tilbake på eksisterende maler for å få det? Svaret på det siste var ja, med tre
grunner: riktigere veiledning, færre synlige felt, og dermed en kontroll som faktisk blir gjennomført.

---

## 1. Hva vi har i dag

Alle 21 bibliotekmalene er **flate lister**. Når kravene varierer med type, løser vi det ved å legge alle variantene
inn som svaralternativer:

> **Linjeføring i høyde og side** — OK innenfor 5 mm · OK innenfor 6 mm · OK innenfor 8 mm · Avvik

Det virker, men arbeideren må selv vite hvilken linje som gjelder hans steintype. Malen veileder ham ikke; den
oppbevarer kravene.

## 2. Hva systemet allerede kan (målt 2026-09-21)

| Ledd | Status |
|---|---|
| Datamodellen for bibliotekmaler | `parent_id` og `children` finnes på feltobjektene |
| Malbyggeren | Kan knytte et felt til ett eller flere svar på et enkeltvalg over det (`conditionValues`) |
| Utfylling på web | `useSjekklisteSkjema` skjuler felt som ikke er aktive |
| Utfylling på mobil | `useOppgaveSkjema` gjør det samme |
| Validering | Hopper over skjulte felt — et påkrevd felt som ikke vises, blokkerer ikke innsending |
| PDF | Kjenner treet med foreldre og barn |

**Kapasiteten finnes altså ende til ende.** Ingenting i appen må bygges.

## 3. Hva som mangler

Ingen av de 21 malene bruker det. Følgelig:

1. **Hjelpefunksjonene i seed** (`valg`, `trafikklys`) lager bare flate felt. Det finnes ingen måte å si «dette feltet
   hører under svaret *Betongkantstein*».
2. **Generatoren** må sette `parent_id` i riktig rekkefølge, slik at barnet kommer etter forelderen.
3. **Malfasiten** må vise treet, ellers kan en forelder-kobling endres uten at noe blir rødt.
4. **`skriv-mal`** må vise hvilket svar som utløser hvert felt, ellers gater design på en tekst som ikke viser strukturen.

Dette er arbeid i `packages/db/prisma`, ikke i appen.

## 4. Hva det gir, konkret

**KD1 – Belegg av stein og heller** i dag: tre toleransesett ligger som alternativer i to felt, og arbeideren velger
linje selv.
**Med betingede felt:** han velger belegningstype først, og ser bare kravene for den typen. Feltet kan da hete det det
er — «Linjeføring» — og alternativene blir «OK» eller «Avvik», med tallet i hjelpeteksten.

Samme gevinst i **JH2** (slitelag mot bindlag), **FD2** (grøftetype), **UU1** (hva som prøves), **UP1** (kumtype) og
**FS2** (type lag).

**Effekten Kenneth peker på:** en mal på elleve felt der fire er skjult for den aktuelle jobben, oppleves som sju felt.
Det er forskjellen på en liste som fylles ut og en som hoppes over.

## 5. Risikoene, og hva piloten må avklare

1. **Lånte firmamaler.** Kopier hos firmaene er tatt på lånetidspunktet og endres ikke av seg selv. De blir stående
   flate til de lånes på nytt. Det er ikke farlig, men badgen «X versjoner bak» må fortsatt stemme.
2. **PDF-en.** Treet kjennes, men vi har ikke sett en arkivert PDF av en mal med skjulte felt. Skriver den ut felt som
   aldri ble vist, blir dokumentet misvisende.
3. **Malforvaltning.** Firmaer som redigerer en lånt mal i malbyggeren, kan bryte forelder-koblingen. Oppførselen må
   sjekkes, ikke antas.
4. **Fasiten.** Uten tre i fasiten kan en kobling endres stille. Det er samme klasse feil som teksthullet cowork fant.

## 6. Forslag til vei videre

**Trinn 1 — tett hullet i asfaltmalen først, flatt.** JH2 mangler kontroll av underlaget (planhet og komprimering).
Det er en reell mangel i dag og bør ikke vente på en ny mønsterform. To nye felt, med kravene i hjelpeteksten og N200
navngitt etter §7c.

**Trinn 2 — pilot på betingede felt, på KD1.** Ren strukturendring, ingen nye krav: de tre toleransesettene flyttes fra
alternativer til betingede felt under «Belegningstype». KD1 er valgt fordi gevinsten er størst der og innholdet allerede
er gatet, så vi ser bare strukturen.
Piloten skal svare på de fire risikoene i § 5 — særlig PDF-en og malforvaltningen.

**Trinn 3 — utrulling, to maler per runde**, i denne rekkefølgen: JH2, FD2, UP1, UU1, FS2. Hver runde er en revisjon
med versjonsbump, tekstbevis og fasitoppdatering, som alle andre revisjoner.

**Det vi ikke gjør:** vi endrer ikke innholdet i kravene mens vi flytter dem. Struktur og innhold i samme diff gjør det
umulig å se hva som faktisk endret seg — samme grunn som at FB4/FD3 ble flyttet uten tekstendring.

## 7. Spørsmål til Kenneth

1. **Godkjenner du de tre trinnene, i den rekkefølgen?**
2. **KD1 som pilot** — eller vil du heller se det først på en mal du bruker oftere?
3. **N200:** skal design lese den og skrive om kravene for bærelag og slitelag med egne ord, eller holder det å navngi
   kapittelet og la beskrivelsen bestemme? Det første koster en arbeidsøkt med lesing.
