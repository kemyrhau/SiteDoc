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

**B3 — Modul-fargedesign (Alternativ C)**
Toppbar forblir mørkeblå (brand-identitet).
Fargeaksentuering brukes kun i sidebar og indikatorer — ikke i toppbar.

Fargepalett per kontekst:
- Prosjekt = blå (#378ADD)
- Timer = grønn (#3B6D11)
- Maskin = amber (#854F0B)
- Varelager = teal (#1D9E75)

Implementasjon: sidebar-aksentlinje (border-left 3px) på aktiv modul,
farget ikon i samme ramp. Ingen endring i toppbar.
Gjelder både firma-sidebar og prosjekt-sidebar.

Implementasjon av B3 planlegges som en dedikert frontend-sesjon etter at
A.Markussen-onboarding er stabilisert. Erstatter U4 i åpne oppgaver.

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

**U4 — Visuell distinksjon mellom kontekster/moduler** [LØST i B3]
Erstattet av B3-beslutning (sidebar-aksent per modul, toppbar uendret).

**U6 — Maskin-modul mangler sitedoc_admin firma-kontekst** [LØST på develop 2026-05-07]
Server: ny `hentMaskinOrgFraInput(userId, inputOrgId?)` delegerer til
`autoriserAdminForFirma` ved input-orgId, fallback til `hentBrukerOrg`. Ny
lokal `verifiserMaskinTilgang(userId, orgId)` med sitedoc_admin-bypass
erstatter `verifiserOrganisasjonTilgang` for utstyr-baserte sjekker.
Migrert: list, antallPerKategori, hentMuligeAnsvarlige, opprett, oppdater,
hentMedId, settStatus, hentFraVegvesenForhandsvisning, opprettMedVegvesen.
oppdaterFraVegvesen hadde sitedoc_admin-bypass fra før.
Klient: maskin/{page,nytt,[id]}.tsx sender `useFirma().valgtFirma?.id`.
Detaljside bruker utstyrets eget orgId for ansvarlig-velger (gir riktig
brukerliste også når sitedoc_admin er på et annet firma enn valgtFirma).
Tom-state på nytt-utstyr-side hvis ingen firma valgt.
IKKE deployet til prod ennå — venter på test-verifisering.

**U7 — Utstyr-type er hardkodet enum, ikke firma-definert** [LØST på develop 2026-05-07]
Nytt-utstyr-side: `<select>` byttet til `<input type="text">` med `list`-attributt
+ `<datalist>` som forhåndspopulerer eksisterende typer som forslag. Detalj-
side: eksisterende fritekst-input fikk samme datalist-supplement.
Vegvesen-auto-foreslag oppdatert til labelKey-form (Personbil/Varebil/etc.)
for å matche datalist-oppføringene.
Server tok allerede fritekst — kun klient-endring.
IKKE deployet til prod ennå.

**U5 — Byggeplass som selvstendig flyt** [MANGLER]
Byggeplass kan bare opprettes inne i prosjektkontekst i dag.
Vurdér om byggeplass bør kunne opprettes på firmanivå uavhengig.

## A.Markussen prod-status (2026-05-06)
- Timer ✅ Aktivert
- Maskin ✅ Aktivert
- Varelager ✅ Aktivert
- Prosjekt «998 Instinniforbotn» opprettet (SD-20260506-0008)
- Varelager-seed: venter — kjøres etter denne gjennomgangen
