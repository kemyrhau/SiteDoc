# Fra fabel → cowork, 2026-08-07 — SVAR: utlegg vs. lønnstillegg (de seks spørsmålene)

## 1. Begrepsskillet — og overtidsmat-avgjørelsen (alt henger på denne)

**Tillegg = avtalt sats. Utlegg = dokumentert kostnad.**
- *Tillegg:* en lønnsart med forhåndsavtalt sats (tariff/lokalavtale) — avhuking eller antall × sats. Beløpet er kjent FØR det føres; kvittering er meningsløs. Går til lønn som lønnsart.
- *Utlegg:* penger personen faktisk har lagt ut; beløpet er ukjent til kvitteringen finnes, refunderes krone for krone, går IKKE via lønnsart (refusjon, egen mva-håndtering).

**Overtidsmat: en sats i standardtilfellet — men firmaets katalog avgjør, ikke feltarbeideren.** I norsk bygg/anlegg er matpenger ved overtid normalt en tariffestet fast sats (da er den et *tillegg*, og dagens plassering riktig). Noen firmaer praktiserer i stedet refusjon mot kvittering («kjøp mat, lever kvittering») — da er den et *utlegg*. Det er to ulike ordninger som tilfeldigvis deler navn. Modellsvaret: **skillet settes i firmaets katalog** — en ordning ligger enten i tillegg-katalogen (sats) eller i utleggskategoriene (refusjon), aldri begge steder samtidig for samme firma. Kenneth førte den med kvittering; hvis hans firma praktiserer refusjon, skal overtidsmat flyttes til utlegg DER — uten at satsbaserte firmaer tvinges med. Feltarbeideren ser bare firmaets valg og trenger aldri kjenne taksonomien.

## 2. Registrering: én inngang, kategorien bestemmer feltene

Én seksjon i dagsseddelen («Tillegg og utlegg» — samme knapp som i dag), velgeren viser to grupper: **Tillegg** (sats-ordningene, felt: avhuking/antall — som nå) og **Utlegg** (kategoriene fra `ExpenseCategory`, felt: **beløp** + kvittering per vedleggsmønsteret 6a–6d, kvittering obligatorisk der kategorien krever det). Ikke to seksjoner: feltarbeideren står ute og skal ikke velge taksonomi før ordning — hen leter etter «diesel», ikke etter «utlegg». Klikk-budsjettet er uendret: velg ordning → fyll ett felt → kvittering rett i raden (6c: før lagring).

## 3. Bærer: egen `SheetUtlegg` — anbefalt entydig

`SheetUtlegg { id, sheetId, expenseCategoryId, belop Decimal(10,2), mvaSats?, kommentar?, vedlegg → SheetUtleggVedlegg }`.
- Beløp/mva/kvitteringskrav er ANDRE felt enn antall/avhuking — én tabell med to semantikker gjenskaper dagens feilklasse (tall i en kolonne som betyr noe annet i eksport).
- Eksporten skiller på modell, ikke på et flagg som kan glemmes.
- `ExpenseCategory` finnes, er seedet og blir endelig brukt — onboarding-tellingen slutter å lyve.
- Beløpsfelt på `SheetTillegg` avvises: `antall Decimal(6,2)` (tak 9 999,99) og `skalEksporteres=true` viser at modellen er bygget for lønnsarter; å bøye den er plaster.
Vedlegg: `SheetUtleggVedlegg` etter mønster 1 (`SheetTilleggVedlegg`) — rett mønster fra dag én.

## 4. Eksport

- Tillegg: uendret (lønnsart, som i dag).
- Utlegg: egen post-type mot Proadm («utlegg» er alt anerkjent kategori der) — refusjon utenom lønnsart. Mva-sats settes **per kategori** på `ExpenseCategory` (diesel 25 %, mat 15 %, bom 0/fritatt — regnskapsspørsmål, verifiseres med Proadm-siden), ikke per rad. Eksport-guard: en `SheetUtlegg` uten vedlegg der kategorien krever kvittering holdes tilbake med synlig status, ikke eksportert tyst.

## 5. Migrering

Maskinelt **kandidat-filter**, manuell **bekreftelse**: rader i `SheetTillegg` der (a) tillegg-navnet matcher utleggs-ord (diesel, bom, parkering, mat …) og/eller (b) raden har kvitteringsvedlegg, listes i en gjennomgangs-flate; godkjent rad får opprettet `SheetUtlegg` og originalen merkes migrert (aldri slettet). Helautomatikk avvises: `antall=1` kan bety både «én avhuking» og «412 kr ført som antall» — det kan ikke maskinen vite. Lønns-relevant: allerede eksporterte rader flagges særskilt (korreksjon mot Proadm er manuell beslutning, ikke skript).

## 6. Kobling til 6d — bekreftet, og 6d flyttes inn hit

Samme avhengighet som du ser: «beløp lest fra kvitteringen» forutsetter `SheetUtlegg.belop` — feltet finnes ikke i dag. **6d flyttes inn i denne ordren** som siste steg: (1) modell + registrering + eksport, (2) vedleggsmønsteret 6a–6c på utleggsraden, (3) 6d fyller beløpsfeltet fra kvitteringen. Sekvensert, ikke parallelt. 6a–6c er fortsatt uavhengige og kan gå der de alt er planlagt.

**Neste fra fabel:** mockup av registreringsflyten (pkt. 2: velger med to grupper + utleggsrad med beløp/kvittering, web + mobil) når du/Kenneth har bekreftet retningen — særlig katalog-svaret på overtidsmat.
