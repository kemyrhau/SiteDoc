# Tillegg til SJA-signatur-svaret — levende deltakerliste + «Ny gjennomgang» (Kenneth-funn 2026-09-05, sen kveld)

Supplement til `docs/redesign/sja-signaturer-svar-fabel-2026-09-05.md` (leveranse 2015) —
erstatter ikke. Kenneths kranløft-scenario: SJA signeres ved første løft; tre uker senere
gjøres tilsvarende løft med samme mannskap + én ny → ny signering. To hull i 2015-designet
tettes:

## 1. Deltakerlisten er LEVENDE — ikke et øyeblikksbilde fra planleggingen

«Hvem mangler» er bare sann hvis lista over hvem som SKAL signere holdes ved like:

- **Legg til når som helst:** nytt lagsmedlem legges til deltakerlisten → personen vises
  umiddelbart som manko («Mangler (1): …»). Chip og teller oppdateres (3/6 → 3/7).
- **Fjern uten å slette historikk:** person som går av laget markeres fjernet (dato), telles
  ikke lenger i manko — men en avgitt signatur SLETTES ALDRI; den består i logg/PDF for
  versjonen den gjaldt. (Samme prinsipp som soft-delete ellers: dokumentasjon forsvinner ikke.)
- **Eierskap:** SJA-ansvarlig eier lista. Appen FORESLÅR deltakere fra kontekst (mannskap på
  byggeplassen / prosjektmedlemmer — kontekst-default-regelen), men lista er menneskeeid;
  ingen automatisk inn/ut uten handling.

## 2. Gjentatt aktivitet = eksplisitt handling «Ny gjennomgang»

Versjonsmodellen fra 2015-svaret bar bare innholdsendring. Kranløft-scenarioet viser at ny
runde trengs OGSÅ uten endring — samme jobb, ny dag, delvis nytt mannskap:

- **Handling «Ny gjennomgang»** på SJA-en (ansvarlig): bumper versjon (v3 → v4) med dato og
  valgfri årsak («tilsvarende løft 26.09»), uten at innholdet må røres.
- Effekt: ALLE signaturer blir utdaterte → hele laget står som manko igjen; ny person legges
  til lista og signerer sammen med resten. Én mekanisme dekker dermed begge triggere:
  innholdsendring (automatisk bump, fra 2015-svaret) og ny runde (manuell bump).
- Versjonsbump krever ingen re-planlegging — deltakerlisten består over versjoner.

## 3. Konsekvens for PDF

- Hovedtabellen viser GJELDENDE versjons runde (som mockupen).
- Tidligere runder (v1–v2-signaturene) hører i logg-delen — «Med logg»-varianten fra
  DG-sporet viser signaturhistorikk per versjon med årsak/dato for hver gjennomgang. En
  byggherre kan da se at laget signerte ved BEGGE løftene.

## Mockup oppdatert

`SJA Signaturer Mockup.dc.html` (designprosjektet) viser nå «+ Legg til deltaker» og
«Ny gjennomgang»-handlingen i objektet.

Inn i ordren som del av designlås-blokken; cowork tar de to mekanismene med i
kostnadsmålingen (pkt 2 i 2015-svaret).

— fabel
