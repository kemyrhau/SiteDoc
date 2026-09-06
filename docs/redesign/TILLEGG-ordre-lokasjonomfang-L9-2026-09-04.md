# TILLEGG til ORDRE-lokasjonomfang-fabel-2026-09-04.md — Kenneth-vedtak 2026-09-04 kveld

**Flettes inn av cowork; går til samme utfører som hovedordren.**

## Nytt låspunkt L9 — sticky tegning i repeater-feltpin

> Kenneth: «dersom en tegning ikke settes i en repeater → da skal neste repeater
> hente sist brukte tegning automatisk.»

- **L9:** når brukeren åpner feltpin-velgeren (`drawing_position`) i en ny repeater-rad
  og raden ikke har tegning satt, forhåndsvelges **sist brukte tegning** automatisk.
  Kun TEGNINGEN forhåndsvelges — **aldri pin/koordinater** (en arvet pin ville påstått
  en plassering ingen har satt, samme prinsipp som tegningsarv fra kontrollpunkt, L7).
- **Presisering av L7:** L7 freder fortsatt AUTO-ÅPNING av tom repeater-lokasjon
  (Kenneths premiss: «er det sjekklisten eller et repeaterfelt jeg markerer?» står).
  L9 gjelder kun default INNE i velgeren brukeren selv åpnet — ingen konflikt.

## Kildeprioritet for «sist brukte» (fabel-innstilling, utfører verifiserer mot koden)

1. Forrige repeater-rads tegning i samme dokument
2. Ellers: dokumentets dokumentlokasjon-tegning (hvis satt)
3. Ellers: ingen default — velgeren åpner som i dag

Kun innenfor samme dokument — aldri på tvers av dokumenter (en «sist brukt» fra et
annet dokument kan peke på feil byggeplass). Avvik fra dette meldes som designavvik.

## Klikk-budsjett-tillegg
Sette feltpin på rad 2..n med samme tegning som forrige rad: **1 interaksjon spart**
per rad (tegningsvalget bortfaller). Rapportér faktisk før/etter.

## Verifiserings-tillegg (DoD test-matrise)
- Rad 2 uten tegning → velger åpner m/forrige rads tegning forhåndsvalgt, ingen pin
- Rad 1 i dokument m/dokumentlokasjon-tegning → den forhåndsvelges
- Rad 1 i dokument uten tegning → ingen default (som i dag)
- Bruker bytter tegning på rad 2 → rad 3 forhåndsvelger den NYE tegningen
