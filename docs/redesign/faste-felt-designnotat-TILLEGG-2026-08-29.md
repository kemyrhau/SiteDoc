# TILLEGG til docs/redesign/faste-felt-designnotat-fabel-2026-08-29.md

> Cowork: flett inn nederst i notatet — eksisterende fil leveres som tillegg, ikke helfil.

## Kenneth-vedtak 2026-08-29 (etter mockup-runden)

- **Spørsmål 1 avgjort:** utskriften skriver alltid «Lokasjon: Byggeplass — {navn}» når
  lokasjon ikke er aktivert — seksjonen utelates aldri. Begrunnelse (Kenneth): rapporten går
  til byggherre; en utelatt seksjon lar leseren gjette om lokasjon ble glemt eller bevisst
  utelatt.
- **Spørsmål 2 avgjort:** emne-kolonnen er allerede standardkolonne (STANDARD_AKTIVE,
  `sjekklister/page.tsx:131`, `oppgaver/page.tsx:146`) — ingen kolonne-endring, kun
  skrivevei.
- **Rapportrekkefølge (låst):** hode → lokasjon/byggeplass → sjekklistens overskrift →
  **Emne som første datafelt**. Mockup-panel 1d akseptert 29.08.
- Mockup: fabels designprosjekt, `Faste-felt-mockup.dc.html` (1a malbygger, 1b opprett-modal,
  1c detaljside, 1d rapport).
- Ordre skrevet: `relay/inbox-opus-faste-felt.md` (levert samme dato).
