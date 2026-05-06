---
name: UX/arkitektur-gjennomgang 2026-05-06
description: Beslutninger og åpne UX-oppgaver fra strukturert gjennomgang 2026-05-06. Anker for fremtidige UX-endringer i toppbar, sidebar og rapport-flyt.
sist_verifisert_mot_kode: 2026-05-06
---

# UX/arkitektur-gjennomgang 2026-05-06

## Beslutninger tatt

**B1 — Toppbar prosjektvelger**
ProsjektVelger-dropdown skal ha tre valg øverst:
- «Alle prosjekter (N)» — viser timer/data på tvers av alle firmaets prosjekter
- «Mine prosjekter (N)» — filtrert til brukerens egne prosjekter
- Separator, deretter liste over enkeltprosjekter

Kontekst-hierarki vises tydelig i toppbar:
Firma → Prosjekt → Byggeplass
«Alle prosjekter» som aktivt valg gjør rapport-scope umiddelbart klart.

**B2 — Onboarding-checkpoint-bar**
Den eksisterende «Oppsett som gjenstår»-baren på prosjekt er god og beholdes.
Utvides med modul-spesifikke punkter når Timer/Maskin/Varelager er aktivt:
- Timer aktivt → legg til «Timer-oppsett» (lønnsarter, aktiviteter)
- Maskin aktivt → legg til «Maskinregister» (importer utstyr)
- Varelager aktivt → legg til «Varekatalog» (legg til varer)

## Åpne oppgaver (krever planlegging)

**U1 — Leder-timer-rapport på firmanivå** [MANGLER]
Firmaadmin trenger: alle ansattes timer per periode, sorterbar/filtrerbar,
med eksport. Tilsvarer «Mine timer» men for alle brukere i firmaet.
Plassering: /dashbord/firma/timer/rapport

**U2 — Eksport alle ansatte** [MANGLER]
CSV/Excel-eksport av timer per ansatt, per prosjekt, per periode.
Forutsetning for ProAdm-eksport og lønnskjøring.

**U3 — Sidebar tekst-labels i prosjektkontekst** [UX-svakhet]
Prosjekt-sidebar viser kun ikoner uten tekst. Uleselig for nye brukere.
Forslag: ekspanderbar sidebar med tekstlabels, eller tooltip alltid synlig.

**U4 — Visuell distinksjon mellom kontekster/moduler** [UX-svakhet]
All navigasjon er samme mørkeblå. Vurdér fargeaksentuering per modul
(Timer = en farge, Maskin = annen) for å tydeliggjøre hvilken modul
brukeren er i.

**U5 — Byggeplass som selvstendig flyt** [MANGLER]
Byggeplass kan bare opprettes inne i prosjektkontekst i dag.
Vurdér om byggeplass bør kunne opprettes på firmanivå uavhengig.

## A.Markussen prod-status (2026-05-06)
- Timer ✅ Aktivert
- Maskin ✅ Aktivert
- Varelager ✅ Aktivert
- Prosjekt «998 Instinniforbotn» opprettet (SD-20260506-0008)
- Varelager-seed: venter — kjøres etter denne gjennomgangen
