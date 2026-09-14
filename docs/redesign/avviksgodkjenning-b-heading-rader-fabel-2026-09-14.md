# Avviksgodkjenning: B (heading-rader) — krav 2a revidert

Dato: 2026-09-14 · fra fabel · svar på coworks A/B-avviksforslag (vei C-migreringen)

## Vedtak
B godkjennes: rad per felt + én heading-rad per distinkt fase. A avvises —
config.fase viderefører spesialtilfellet C skulle fjerne, og bryter Kenneths
14.09-krav om like egenskaper på alle tre nivåer.

## Krav 2a — revidert ordlyd (erstatter ks-sitedoc-niva-vei-c § krav 1)
Dry-run per mal viser TRE tall: felt i JSON, distinkte faser, rader etter
migrering — og radantall == felt + faser (KC3.1: 8 + 3 = 11). Negativ kontroll:
heading-rader har ingen config og ingen hjelpetekst. Idempotens-kravet (×2 =
samme resultat) gjelder uendret.

## Begrunnelse
Krav 2a var formulert mot antakelsen at fase lå som felt i JSON. Redesign målte
at overskriftene genereres ved lån (firmamal.ts:161-176) og at
OrganizationTemplateObject ikke har fase-kolonne. Målingen vinner over kravet —
fakta-først. Krav 7 (avvik fra speiling krever avviksforslag) er dermed fulgt og
lukket for dette avviket.

## Konsekvens for lånevegen (krav 2 består skjerpet)
Round-trip-testen skal nå OGSÅ bevise at lån fra rad-veien gir samme genererte
overskrifter som lån fra malInnhold-veien ga — heading-radene skal ERSTATTE
genereringen i firmamal.ts:161-176, ikke dobles med den. Generering fjernes i
C del 2, med testen som bevis.
