---
name: UX/arkitektur-gjennomgang 2026-05-06
description: Beslutninger og åpne UX-oppgaver fra strukturert gjennomgang 2026-05-06. Anker for fremtidige UX-endringer i toppbar, sidebar og rapport-flyt.
sist_verifisert_mot_kode: 2026-05-06
---

# UX/arkitektur-gjennomgang 2026-05-06

## Beslutninger tatt

**B1 — Toppbar prosjektvelger** [DEPLOYET TIL PROD 2026-05-06]
ProsjektVelger-dropdown skal ha tre valg øverst:
- «Alle prosjekter (N)» — viser timer/data på tvers av alle firmaets prosjekter
- «Mine prosjekter (N)» — filtrert til brukerens egne prosjekter
- Separator, deretter liste over enkeltprosjekter

Kontekst-hierarki vises tydelig i toppbar:
Firma → Prosjekt → Byggeplass
«Alle prosjekter» som aktivt valg gjør rapport-scope umiddelbart klart.

**Implementasjon:** Server: `prosjekt.hentMine` endret til medlemskaps-filter
uavhengig av rolle (sitedoc_admin og company_admin filtreres nå også på
`members.some.userId`). `hentAlle` beholder admin-bypass. Klient:
ProsjektKontekst utvidet med `prosjektScope: "alle" | "mine" | "enkelt"`,
`mineProsjekter`-liste og `velgScope(scope)`-funksjon. Scope persisteres i
`localStorage` (`sitedoc-prosjekt-scope`, default `"mine"`). URL med
prosjektId tvinger scope = `"enkelt"`. ProsjektVelger viser to scope-rader
øverst (LayoutGrid + Star-ikon, telling i N) — kun for sitedoc_admin og
company_admin. Vanlig user (`role="user"`) får ren prosjektliste som før.
Knapp-tekst speiler aktiv scope. `velgScope` nullstiller prosjekt-id og
ruter til `/dashbord`. Dashbord-startsiden (`/dashbord/page.tsx`)
filtrerer visnings-listen på scope; auto-redirect-logikken bruker
fortsatt full prosjektliste (førstegangs-onboarding). Ny tom-state-tekst
for «Mine»-scope (peker brukeren til «Alle prosjekter»). 7 nye i18n-
nøkler nb+en (`prosjektVelger.*` + `dashbord.ingenMineProsjekterBeskrivelse`).
Deployet til prod som merge `2f22c503` etter test-verifisering.

**B2 — Onboarding-checkpoint-bar** [DEPLOYET TIL PROD 2026-05-06]
Den eksisterende «Oppsett som gjenstår»-baren på prosjekt er god og beholdes.
Utvides med modul-spesifikke punkter når Timer/Maskin/Varelager er aktivt:
- Timer aktivt → legg til «Timer-oppsett» (lønnsarter, aktiviteter)
- Maskin aktivt → legg til «Maskinregister» (importer utstyr)
- Varelager aktivt → legg til «Varekatalog» (legg til varer)

**Implementasjon:** Server: `prosjekt.hentOnboardingStatus` utvidet med
`timerAktiv/harTimerOppsett`, `maskinAktiv/harMaskinregister`,
`varelagerAktiv/harVarekatalog`. Modul-aktivering avledes fra
`ProjectModule.status="aktiv"` på prosjektet. Ferdig-kriterier:
Timer = lønnsart-count > 0 OG aktivitet-count > 0; Maskin = equipment-
count > 0; Varelager = vare-count > 0. Tellinger brukes mot prosjektets
`primaryOrganizationId`. Standalone prosjekt (ingen primary org) har
alltid alle modul-flagg = false.

Klient: `apps/web/src/app/dashbord/[prosjektId]/page.tsx` bygger steg-
array dynamisk — modul-piller tas med kun når aktivert. `alleFerdige`-
sjekken bruker bare synlige piller (skjuler hele banneret når alt er
gjort, inkludert modul-oppsett). Lenker peker til firma-sidene
(`/dashbord/firma/timer/onboarding`, `/dashbord/maskin`,
`/dashbord/firma/varelager`) — modul-oppsett er firma-nivå-arbeid.
3 nye i18n-nøkler nb+en (`onboarding.timerOppsett`,
`onboarding.maskinregister`, `onboarding.varekatalog`).
Deployet til prod som merge `da00d55d` etter test-verifisering
(banneret skjules korrekt når alle synlige steg er ferdige —
verifisert mot prosjekt 998 Instinniforbotn på test).

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

**U1 — Leder-timer-rapport på firmanivå** [LØST på develop 2026-05-07]
Ny under-router `timer.rapport` med firmaPeriodeRapport + hentFirmaProsjekterMedTimer
+ hentFirmaAnsatteMedTimer. Aggregerer DailySheet + SheetTimer + SheetTillegg
+ SheetMachine på tvers av firmaets prosjekter. Gates med autoriserAdminForFirma.
Klient: ny side `/dashbord/firma/timer/rapport` med periode-velger (hurtig-knapper
denne uken/forrige uke/denne måned/forrige måned + egendefinert), prosjekt- og
ansatt-dropdown, sammendrag-stripe (total timer/ansatte/sedler/sent/attestert),
sortbar tabell per ansatt med ekspanderbar detaljvisning (per-dag toggle uke +
per-prosjekt). Status-badges (kladd/sent/attestert) per ansatt. Sidebar-rad
«Timer-rapport» i firma-layout. ~30 i18n-nøkler nb+en.
IKKE deployet til prod ennå.

**U2 — Eksport alle ansatte** [LØST på develop 2026-05-07]
Ny `apps/web/src/lib/timer-rapport-eksport.ts` med eksporterCsv +
eksporterXlsx. Eksport-knapp i header på `/dashbord/firma/timer/rapport`
med dropdown CSV/Excel. Lazy-import av exceljs (allerede i deps).
- CSV: ett ark, semikolon-separert med UTF-8 BOM for Excel-kompatibilitet
- Excel: 3 ark (Sammendrag + Per prosjekt + Per dag)
- Filnavn-mønster: `SiteDoc-timer-{firma-slug}-{fra}-{til}.{csv|xlsx}`
- Norsk tallformat (komma som desimal)
- Respekterer alle valgte filtre (periode, prosjekt, ansatt)
IKKE deployet til prod ennå.

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

**U5 — Byggeplass som selvstendig flyt** [FORKASTET 2026-05-06]
Byggeplass-data (geofence, GPS, mannskaps-innsjekk, §15-liste) er
prosjekt-bundne — en byggeplass uten prosjekt ville blitt en orphan-rad
uten formål. Dagens prosjekt-bundne flyt er korrekt design og beholdes.
Server-router `byggeplass.ts` håndhever `projectId`-kravet via
`verifiserProsjektmedlem`; `/dashbord/oppsett/lokasjoner`-siden kjører
all CRUD i prosjekt-kontekst.

## A.Markussen prod-status (2026-05-06)
- Timer ✅ Aktivert
- Maskin ✅ Aktivert
- Varelager ✅ Aktivert
- Prosjekt «998 Instinniforbotn» opprettet (SD-20260506-0008)
- Varelager-seed: venter — kjøres etter denne gjennomgangen
