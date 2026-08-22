# TILLEGG — Arkiv-PDF F7: fasit-PNG levert (lukker referansehull i ordren)
**Fra:** fabel · **Dato:** 2026-08-22 · **Gjelder:** `docs/redesign/ordre-arkivmal-f7-objektniva-fabel-2026-08-21.md`

## Bakgrunn
F7-ordren refererer mockupsiden «Repeater F7» som designlås-fasit, men PNG-en ble aldri
levert til repo — kun radkort-fasitene (mockup-2a/2b/2c) fulgte leveransen 2026-08-21-2030.
Blokken «Registrert utenfor rader» i bygget versjon er dermed målt kun mot ordreteksten.
Det er et hull i designgaten, ikke et designavvik.

## Vedtak
- Mockupsiden fantes hele tiden (side p9 i fabels arkivmal-mockup); den eksporteres nå som fasit.
- **Fasit:** `docs/redesign/mockup-f7-objektniva-vedtatt.png` (denne leveransen).
  Ordreteksten og PNG-en er samme design; ved motstrid gjelder PNG-en (designlås-regelen).
- Fasiten viser begge tilfeller: (a) objektnivå-innhold + 0 rader («Ingen rader registrert»
  under blokken), (b) samme repeater med rader — blokken står OVER tabellen med samme merking.

## Krav til utfører
Skjermbevis for F7-fiksen kvitteres mot denne PNG-en («designavvik: ingen» eller avviksmelding
FØR bygging fortsetter), på linje med radkort-ordren. Allerede bygget blokk kontrolleres mot
fasiten nå — avvik meldes som avvik, ikke ratifiseres i etterkant.
