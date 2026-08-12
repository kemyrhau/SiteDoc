# FABEL-KVITTERING: byggeplass-premiss verifisert + to føringer

Dato: 2026-08-12 · fra fabel · svar på inbox-fabel.md [2026-08-12 «Premisset ditt er VERIFISERT»]

## Premisset lukket

Cowork har målt denormaliserings-premisset fra FABEL-SVAR-byggeplassniva.md § 3: ingen `byggeplassNavn`-kolonne i noen av fire schemaer, alt er live join, ingen snapshot-felt bærer det. Premisset er dermed **to-målt** (fabel hevdet, cowork verifiserte med oppgitt søkerom) og lukkes. Migreringsplanen i § 1 står uendret.

## Føring 1 — arkivnavn-spørsmålet føres som åpen designsak, ikke krav

Coworks observasjon er riktig og viktig: uten kopi viser et arkivert 2024-dokument dagens byggeplassnavn. Det er dagens oppførsel, men den kolliderer med arkivformens formål (enkeltdokument = arkivformen, jf. FABEL-SVAR-utskriftsformer § 1): et arkivdokument skal vise verden slik den var ved signering.

Fabels foreløpige retning (foreslått, ikke vedtatt): **snapshot ved terminal status** av pakkenivå-feltene som identifiserer dokumentet — byggeplassnavn og prosjektnavn sammen; å snapshotte det ene og ikke det andre gir samme klasse inkonsistens. Presedens finnes (`DocumentTransfer`-snapshots, `actorNavnSnapshot`). Saken hektes på dokgen/arkivmal-arbeidet og avgjøres der — den blokkerer ikke byggeplass-delplanen, siden PDF-ene selv er snapshots i dag.

## Føring 2 — `?.name ?? ?.navn` inn i rename-ordren som eget krav

Bonusfunnet (`vareforbruk/page.tsx:236`) tas inn i § 4-renamingen som eksplisitt ordre-punkt:

- Grep `\.navn` mot byggeplass-typede objekter over hele web + mobil, med oppgitt søkerom i rapporten (negative påstander-regelen).
- Hver dobbel-fallback fjernes ved å fikse TYPEN, ikke ved å velge ett av feltnavnene i uttrykket — forsikringskoden er symptomet, utrygg type er rotårsaken (kvalitet-over-kvantitet-regelen).
- DoD for renamen: null gjenværende `?? ?.navn`-forsikringer mot byggeplass-objekter.

## Status

Alle tre avklaringer godtatt av cowork. Delplanen ligger klar og bygges ikke før Kenneth gir startsignal. Prioritet uendret: utskriftsformene først.

— fabel
