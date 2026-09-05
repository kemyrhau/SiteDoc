# Fabel — lås-utløser og resterende kall (2026-09-05, natt — siste før ordre)

Supplement til 2015/2130/2300. Kenneth har bekreftet lås-regelen i arbeidsdag-språk;
dette lukker de åpne designvalgene. **Ordren kan skrives etter dette.**

## Rammen ordren skal bære: GJENBRUK

Kenneths hovedgevinst er styrende for ordre-innledningen: én SJA per arbeidsoperasjon
(«løft med mobilkran»), gjenbrukt hver gang jobben gjøres — ikke ny SJA per gang. Låsing og
runder er mekanismene som gjør gjenbruket forsvarlig. Klikk-budsjett i ordren måles mot
dette: «gjenta SJA for kjent jobb» skal være vesentlig færre interaksjoner enn «opprett ny».

## Lås-utløseren: HANDLING — tiltrer coworks lesning

- **«Avslutt runde»** (ansvarlig) låser innholdet — dagens slutt er et arbeidsbegrep, ikke et
  klokkeslett. Ingen automatisk døgn-lås (ville låst midt i kveldsøkter), ingen kobling til
  dokumentstatus (SJA-en lever på tvers av statuser).
- Valgfri MYK påminnelse ved døgnskifte der runden står åpen med signaturer («Runden fra i går
  står åpen — avslutt?») — nudge, aldri auto-lås.
- **Gjenåpning = «Start ny runde»** (fra 2300-modellen, uendret): åpner innholdet, nytt
  signatursett, forrige runde består i loggen.

## Innenfor ÅPEN runde: endring etter at noen har signert

Kenneths dag-modell betyr at innhold kan røres samme dag som folk signerer. Regel:

- Felt-endring når runden har signaturer → amber varsel («3 har signert denne runden —
  vurder ny runde») + føres i endringsloggen. Tillatt — feltvirkeligheten endrer seg midt på
  dagen, og ansvarlig eier vurderingen.
- Signaturene består, men PDF/visning viser tidsstempler — det er synlig hva som kom først.
  Ingen automatisk invalidering innenfor runden.

## Spørsmål 2 (tilbehør) — fabel-kall, smalere etter Kenneths modell

Foto/kommentar SAMME DAG går fint (før lås). **Etter «Avslutt runde» er dokumentet helt
lukket** — ingenting legges til; nye observasjoner hører i avvik/RUH eller ny runde.
Ført som fabel-kall; Kenneth kan overprøve senere uten at modellen endres (det er én guard).

## Status → ordre

Alle designvalg er nå lukket: modell (SignaturRunde + DokumentDeltaker + DokumentSignatur,
ingen dokumenttabell-migrering), begrep (runder), lås (handling), gjenbruk (rammen), gjest
(påkrevd), manko-UX (mockup), PDF (gjeldende runde + «Med logg»). Neste: coworks nå-rapport
verifiserer de enkeltmålte premissene (manko-spørring, Signaturliste-objektets omfang) →
fabel skriver ordre m/designlås-blokk over 2015+2130+2300+dette.

— fabel
