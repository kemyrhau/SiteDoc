# Fabel — signaturRUNDER: modelltegning + svar på coworks måle-spørsmål (2026-09-05, natt)

Supplement til 2015/2130/2215. **Erstatter versjons-begrepet i alle tre** — Kenneths
presisering («flere sett med signaturer på samme SJA») er styrende. Mockupen er oppdatert
til runde-språk.

## Begrepet: runder, tiltres fullt

Samme SJA er malen for jobben; hver utførelse er en **signaturrunde**. Alle settene består.
UI-språk: «Runde 3 — startet 26.09 (tilsvarende løft)» · handling «Start ny runde».
«Ny gjennomgang» fra 2130-leveransen omdøpes.

## Svar på coworks måle-spørsmål: runde-på-signatur alene HOLDER IKKE — men løsningen er en rad, ikke en kolonne

Målt mot manko-kravet: hvis runden kun bor på `DokumentSignatur`, er «gjeldende runde» =
max(runde) blant signaturene. Da feiler det avgjørende øyeblikket: **idet ansvarlig starter
runde 3 og INGEN har signert ennå**, er max fortsatt 2 → manko-lista viser runde 2 som
gjeldende og «alle har signert». Akkurat når SHA-KU trenger «0 av 6 i runde 3», svarer
modellen feil. Runden trenger derfor et eget hjem — men ikke på dokumenttabellene:

- **`SignaturRunde`** (ny tabell): dokumentId · rundeNr · startetAt · startetAv · årsak
  (valgfri). Gjeldende runde = siste rad. Raden bærer også dato/årsak som PDF-loggen trenger
  («Runde 2 — 26.09, tilsvarende løft»).
- **`DokumentSignatur`** refererer runden (rundeId) + PsiSignatur-feltene fra 2015-svaret.
- **`DokumentDeltaker`** (ny tabell): deltakerlisten, levende på tvers av runder
  (lagtTil/fjernet-datoer — 2130-leveransen). Manko i runde N = aktive deltakere minus
  signaturer i runde N.
- **Ingen kolonne på `Checklist`/`Task`** — coworks ønske innfris; ingen migrering på
  dokumenttabellene. Runde 1 opprettes automatisk når deltakerliste-objektet tas i bruk;
  «Start ny runde» oppretter neste rad.

*(Enkeltmålt: fabel har resonnert modellen, ikke prototypet spørringen — cowork verifiserer
at manko-spørringen og chip-tallet kan svares effektivt fra de tre tabellene.)*

## Lås-regelen omformulert (Kenneth-gate fra 2215 står, i nytt språk)

1. **Innholdet er låst så lenge gjeldende runde har signaturer.** Endring krever «Start ny
   runde» (forrige rundes signaturer består i loggen — de gjaldt dokumentet slik det var).
   Endringsloggen dekker HVA som ble endret; runden dekker HVEM som signerte når.
   → Kenneth-spørsmål 1: bekreft at signert innhold ikke kan endres uten ny runde.
2. **Tilbehør etter signering** (foto/kommentar): fabels forslag fortsatt låst → spørsmål 2
   står uendret fra 2215.

## PDF (uendret fra 2130, i runde-språk)

Hovedtabellen viser gjeldende runde («Runde 3 — 3 av 6 signert»); tidligere runder i «Med
logg» med dato/årsak per runde. Byggherren ser at laget signerte ved hvert løft.

Etter Kenneth-gate på lås-spørsmålene: cowork nå-rapport → fabel-ordre m/designlås
(2015 + 2130 + dette; 2215 gjelder kun der den ikke motsies av runde-begrepet).

— fabel
