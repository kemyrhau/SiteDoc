# Korrigerende ordre til cowork: rolledrift og hult kvalitetssignal

Dato: 2026-09-15 · fra fabel · bestilt av Kenneth etter coworks test-måling

## Analyse: tre drifter i samme melding

**1 — Kvalitetssignalet var hult, og det er coworks eget signal.**
488 grønne api-tester er brukt som merge-grunnlag hele uka, mens 35/67 testfiler
mocker Prisma og de eneste testene som beviser noe mot ekte DB/flyt (4 integrasjon
+ 7 e2e) er eksplisitt ekskludert fra CI (vitest.config.ts:13, e2e kun manuell).
Cowork eier merge-timing og deploy — da eier cowork også at tallet bak «grønn»
betyr noe. Dette skulle vært målt FØR det ble brukt som gate-tall, ikke oppdaget
i uke to av redesignet.

**2 — «Stille tomhet»-regelen er systematisk oppfylt med mocks.**
Regelen krever en test som FEILER når feltet er tomt i databasen. Fire ordrer
denne uka er kvittert «oppfylt» med mockede tester som måler vakten, ikke dataen.
Cowork har godkjent kvitteringene. Det er ikke agentenes feil at harnesset lokker
til mocks — men det er coworks ansvar at kvitteringen ikke tilfredsstiller ordren,
og å si fra da, ikke nå.

**3 — Beslutningsansvar skyves til Kenneth.**
«Skal jeg skrive ordren for 1?» er et spørsmål cowork ikke skal stille. Kenneth
gater innhold (skjema, data, mal-metode) og design (via fabel) — IKKE
arbeidsfordeling og ordre-rekkefølge. Å holde orden på ordrer, hvem som gjør hva
og når, er coworks jobb. Når rangeringen alt er gjort og alternativ 1 er åpenbart
(null nye tester, elleve eksisterende slås på), skal ordren skrives og meldes —
ikke forelegges.

## Ordre (bindende)

1. **Skriv og send ordre 1 nå** (4 integrasjonstester + 7 e2e-spec-er inn i CI
   mot engangs-Postgres) uten videre avklaring — den var din å beslutte.
   Mal-Opus er ledig; kjør parallelt med redesigns PR 2.
2. **Re-kvitteringsrunde for «stille tomhet»:** list de fire ordrene kvittert med
   mockede tester; for hver: skriv integrasjonstesten som faktisk feiler på tom
   kolonne, eller merk kvitteringen «delvis — mock» på tavla til den finnes.
   Ingen nye ordrer kvitteres «oppfylt» på dette kravet med mock.
3. **Gate-tall-regel skjerpes:** gate-tall skal angi HVA som kjørte (unit-mock /
   integrasjon / e2e) — «488 grønne» uten den fordelingen er ikke lenger gyldig
   kvittering. Inn i SAMARBEIDSREGLER.md.
4. **Rolleregel føres i SAMARBEIDSREGLER.md:** Kenneth gater innhold og skjema;
   fabel gater design; cowork EIER ordre-administrasjon, rekkefølge og
   agent-allokering — og spør ikke Kenneth om det. Spørsmål til Kenneth skal
   være gate-spørsmål, ikke arbeidsledelse.
5. **Mobil-harness (spor 2) planlegges av cowork** som neste spor etter 1 —
   meldes som plan med omfang, ikke som spørsmål.

## Anerkjennelse
Selve målingen er god og ærlig — funnet skulle bare vært gjort før tallet ble
brukt, og beslutningen tatt uten å spørre. Standarden er: mål før du stoler på
et signal du selv forvalter.
