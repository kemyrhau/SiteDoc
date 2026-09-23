---
name: arkivredigering-designnotat
description: Fabels designnotat — redigering av firmaarkiv og SiteDoc-arkiv: interaksjonsmønster + versjonspublisering som lagringsmodell. Svar på coworks flagg 2026-09-12. Hører sammen med README-mockup.md (til-repo-2026-09-12-1600).
status: 🟢 Kenneth-vedtatt 2026-09-12 (interaksjon + versjonsmodell) — klar til ordre
skrevet: 2026-09-12 av fabel
---

# Redigering av arkivmaler — designnotat (fabel)

Coworks flagg: hvordan redigeres firmaarkivet og SiteDoc-arkivet manuelt i praksis?
Kenneth-vedtak 2026-09-12, samme modell for begge arkiver:

## 1. Interaksjonsmønster (i arkivlisten)

- **Henting:** checkbokser på radene for å velge en serie; samlehandling
  «Hent kopi (N)» i bunnlinjen når noe er valgt. Enkeltrad: «Hent kopi» som i mockupen.
- **Redigering:** dobbeltklikk på en rad ÅPNER malen i malbyggeren — og samme handling
  ligger som «Rediger» i radens ⋮-meny (dobbeltklikk alene er udiskoverbart).
  «Rediger» vises kun når rollen har redigeringsrett på arkivnivået — samme
  synlighetsfunksjon som styrer fanene (nivå + lese/redigere, README-mockup.md pkt. 3).
- **Malbyggeren er desktop-kun (Kenneth 2026-09-12):** den kan ikke åpnes fra mobil-UI.
  På mobil finnes arkivet kun som visning/henting; redigeringsinnganger (dobbeltklikk,
  «Rediger») skal ikke rendres der. Ingen mobil-bygger skal lages.

## 2. Lagringsmodell: versjonspublisering (IKKE direkte lagring + endringslogg)

- Malbyggeren åpner en **arbeidskopi**; arkivmalen står urørt til brukeren trykker
  **«Publiser som vX.Y»**. Byggeren vet nivået (prosjekt/firma/SiteDoc — parameterisert
  datalag, coworks krav 1) og publiserer til riktig arkiv. Nivå-badge i tittellinjen
  (FIRMAMAL / SENTRAL MAL) så brukeren alltid ser hvor det lagres.
- **Sporing = versjonene.** Hver publisert versjon er en komplett, gjenskapbar tilstand
  (hvem publiserte, når, hvilket innhold). Ingen separat felt-for-felt-endringslogg
  bygges — «gjenskape senere» er å åpne en eldre versjon. VERSJON-feltet i listene
  finnes allerede.
- **Samspill med V5 (kopi ved henting):** prosjekter som hentet kopi av v1.1 påvirkes
  beviselig ikke av at arkivet publiserer v1.2. Senere (egen ordre, ikke nå) kan
  prosjektkopien vise «nyere versjon finnes i arkivet» — fortsatt aldri levende referanse.
- Forkastes en arbeidskopi, lagres ingenting.

## 3. Til ordren (utfører måler først)

- Hvordan versjoner lagres i dag rundt `ReportTemplate` (finnes versjonsrader, eller kun
  et versjonsfelt?) — modellen over krever lagrede versjonstilstander, ikke bare et tall.
- Arbeidskopi-mekanikk: utkast-rad vs. klientside-tilstand — utfører anbefaler etter måling.
- Gjelder alle tre malfamilier byggeren tjener (sjekkliste/oppgave/HMS), samme mønster.
