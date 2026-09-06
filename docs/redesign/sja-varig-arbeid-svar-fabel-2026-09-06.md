# Fabel — SJA varig arbeid: design for funn 1+4, retting av designlås for funn 2+3 (2026-09-06)

Svar på `docs/redesign/til-fabel/BESTILLING-sja-varig-arbeid-2026-09-06.md`.
Mockup oppdatert: `SJA Signaturer Mockup.dc.html` (før-endring-merking + «Krev ny signatur»).
Etter dette kan cowork skrive ordren for funn 1+4.

## Funn 1 (BLOKKER) — coworks anbefaling tiltres: signering er ikke redigering

- **Flyt-låsen («Sendt») består på innholdet; signaturlista unntas.** `kanSignere` slutter å
  lese `leseModus`; den leser KUN runde-låsen (`gjeldendeRundeLaast`) + egen-rad-gatingen.
  Tabellen i bestillingen er designlås ordrett (innhold: låst/låst · signaturliste: åpen ved
  flyt-lås, låst ved runde-lås).
- Kenneths alternativ «lås ved godkjent» avvises med coworks begrunnelse + funn 2: «godkjent»
  finnes ikke som ekstern handling på arbeidsgivers dokument. Gjenbruksgevinsten består.
- Også deltaker-handlingene («+ Legg til deltaker», gjest-skjema) unntas flyt-låsen — de er
  signeringsaktivitet (2215-vedtaket). «Start ny runde»/«Avslutt runde» følger samme unntak;
  runde-låsen er den eneste som stopper dem.

## Funn 2 — designlås RETTES (ingen kode)

- All formulering om byggherre-godkjenning utgår. **Byggherre påser; arbeidsgiver vurderer og
  låser** — «Avslutt runde» er arbeidsgivers handling. Tiltrer at dette føres bindende i
  `domene-arbeidsflyt.md`.
- Manko-listas juridiske funksjon (påse-plikten oppfylles ved å se at de som gjør jobben har
  signert) føres inn i ordrens gevinst-ramme — den styrker «manko aldri utelatt»-prinsippet i
  PDF (F7).

## Funn 3 — designlås RETTES (ingen kode)

- **«Lås ved dagens slutt» utgår av all designlås-tekst.** Runden avsluttes av
  ARBEIDSOPERASJONEN, ikke døgnet — «Avslutt runde» når jobben er ferdig, uansett om det tok
  én dag eller ti. Døgnskifte-nudgen fra 2345 omformuleres: vises først når runden har stått
  urørt i X dager (forslag 7), ikke ved hvert døgn — ti dagers kranarbeid skal ikke nudges
  daglig. Ny mann dag 5 → legges til, signerer inn i åpen runde, 6/6→6/7 (allerede støttet).
- **Daglig gjennomgang:** tiltrer coworks vurdering — IKKE en signaturrunde. Venter på
  Kenneths praksis-svar; hvis SiteDoc skal bære den, designes den som logglinje
  («gjennomgått dato av navn, forhold uendret») i en senere sak. Ikke i denne ordren.

## Funn 4 — innholdsversjon per signatur: tiltres, med tre presiseringer

Coworks todelte anbefaling tiltres (faktum-merking + menneskeeid «Krev ny signatur», aldri
automatikk — begrunnelsen om unøyaktige vs. oppdaterte SJA-er er riktig og føres i ordren).

1. **Bump-regelen:** `innholdsVersjon` (heltall på dokumentet) telles opp ved LAGRING av
   innholdsendring i åpen runde MED minst én signatur. Endring før første signatur bumper
   ikke (ingen har lest noe annet); tilbehør/deltaker/signatur-aktivitet bumper aldri
   (2215-skillet). Hver signatur lagrer `innholdsVersjon` ved signering.
2. **Visning (faktum, ikke dom):** rad med `signaturVersjon < dokumentVersjon` viser amber
   «signert 05.09, før endring 07.09» (dato fra endringsloggen, som allerede har raden).
   Telleren: raden TELLER fortsatt i X av Y (runde-vedtaket består — invalidering er
   menneskets kall), men chip/status får amber-tilstand «X av Y — N signert før endring» så
   det synes i lista uten å åpne. PDF: egen kolonneverdi «signert før endring av <dato>» —
   aldri utelatt, samme F7-prinsipp.
3. **«Krev ny signatur» (ansvarlig, i objektet):** nullstiller IKKE runden og sletter ingen
   rader — de N merkede radene flyttes til manko med sporet «ny signatur krevd 07.09 av
   <navn>»; tidligere signatur består i loggen/PDF-loggen for sin versjon. (Skille mot «Start
   ny runde»: den nullstiller ALLE og gjenåpner innhold; «Krev ny signatur» treffer kun dem
   som signerte før endringen, innholdet forblir låst/åpent som det var.)

**Migrering (Kenneth gater):** `innholdsVersjon Int @default(1)` på Checklist/Task +
`signertVersjon Int` på DokumentSignatur. Additiv; eksisterende rader = 1/1 (ingen falsk
før-endring-merking ved innføring). NB: dette gjeninnfører én kolonne på dokumenttabellene —
2300-vedtaket «ingen kolonne» gjaldt RUNDE-telleren og står; innholdsversjonen er en annen
størrelse med annet formål, og runde-på-dokument avvises fortsatt.

## Seed-hull (testrundens ⚠)

Inn i ordren: seeden gir én deltaker som ALDRI signerer → «IKKE SIGNERT»-raden i PDF blir
testbar. Walkthrough-punkt i gaten.

## Til ordren (cowork skriver)

Designlås = bestillingens tabell (funn 1) + § funn 4 her + rettelsene 2/3 inn i eksisterende
lås-dokumenter (2345-formuleringen «dagens slutt» erstattes). Mockup-fasit:
`SJA Signaturer Mockup.dc.html`. Klikk-budsjett uendret + «Krev ny signatur» ≤ 2 fra objektet.
Kenneth-gate: migreringen (funn 4) + praksis-svaret om daglig gjennomgang (blokkerer ikke
ordren — logglinjen er egen senere sak).

— fabel
