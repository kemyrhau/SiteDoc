---
status: aktiv
sist_verifisert_mot_kode: ikke aktuelt
sist_endret: 2026-04-28
gjelder_versjon: post-Fase 0
avhenger_av:
  - forretningslogikk.md
  - arkitektur-syntese.md
påvirkes_av_beslutninger: []
---

# Onboarding-veileder for firma

> 🟡 **Status:** Idé-stadium. Planlagt ~1 måned frem (post-Fase 0). Etablert som dokumentasjon 2026-04-28 for å bevare beslutningsgrunnlag per sannhetskilde-prinsippet.

## Formål

Veileder for firma å raskt komme i gang med sitt arbeid i SiteDoc. Pedagogisk støtte gjennom avhengighets-kjeden — riktig rekkefølge er kritisk for at samhandlingen mellom moduler skal fungere.

## Sekvensiell logikk (riktig rekkefølge påkrevd)

1. **Opprette tilgang til prosjekt** — invitere brukere, etablere medlemskap
2. **Opprette brukergrupper** — med pedagogisk forklaring av hva grupper brukes til (`ProjectGroup`-modell)
3. **Opprette dokumentflyt basert på brukergrupper** — med forklaring av hvorfor brukergrupper må eksistere først
4. **Opprette sjekkliste/oppgave** — 1-2 eksempler med eksplisitte koblinger til dokumentflyt
5. **Opprette byggeplass** — fysisk lokasjon innenfor prosjektet
6. **Legge til tegninger** — med veiledning om DWG/IFC/punktsky-import

## Design-prinsipper

### Idempotens (kritisk)

Veilederen må kunne kjøres på nytt uten at allerede gjort arbeid mistes. Hver entitet trenger:

- **«Finnes allerede»** — vis eksisterende, ikke duplikat-opprett
- **«Opprett ny»** — standard førstegangs-flyt
- **«Oppdater eksisterende»** — endre tidligere oppsett uten å miste relasjoner

Dette skiller veilederen fra en typisk wizard som kun kan kjøres én gang.

### Pedagogisk lag

Forklaringer underveis i hvert steg — bruker lærer hvorfor rekkefølgen er kritisk. Dette er ikke valgfritt feilmelding-tekst, men kjernen i hvorfor veilederen finnes:

- Hvorfor må brukergrupper opprettes før dokumentflyt?
- Hva blir konsekvensen hvis sjekkliste opprettes uten kobling til dokumentflyt?
- Hva betyr en byggeplass i kontekst av prosjekt?

### Kritisk avhengighet

Riktig rekkefølge er ikke valgfri:

- Dokumentflyt avhenger av brukergrupper (kan ikke ha flyt uten deltakere)
- Sjekkliste/oppgave avhenger av dokumentflyt (mottakerstruktur er forutsetning)
- Brutt rekkefølge = brutt samhandling mellom moduler

Veilederen håndhever rekkefølgen, men forklarer hvorfor — ikke bare blokkerer.

## Avhengigheter til andre moduler

| Modul | Status | Modell |
|---|---|---|
| Brukergrupper | Eksisterende | `ProjectGroup`, `ProjectGroupMember` |
| Dokumentflyt | Eksisterende | `Dokumentflyt`, `DokumentflytMedlem`, `DokumentflytMal` |
| Sjekkliste/Oppgave-mal | Eksisterende | `ReportTemplate`, `Checklist`, `Task` |
| Byggeplass | Planlagt Fase 0.5 | `Byggeplass`, `Omrade` (delvis eksisterende) |
| Tegninger | Eksisterende | `Drawing`, `DrawingRevision`, `PointCloud` |

## Åpne spørsmål

1. **Wizard-state-strategi:** Skal idempotens implementeres som «wizard-state» i DB (egen tabell som sporer hvilket steg firma er på), eller som UI-detection mot eksisterende rader?
   - DB-state: enklere å gjenoppta etter pause, krever ny tabell
   - UI-detection: ingen ny modell, men logikk må håndtere alle delvise tilstander
2. **Delvis fullført veileder:** Hvordan håndtere brukere som lukker veilederen midt i — neste innlogging, vis fortsatt veileder med «fortsett her»-markør?
3. **Målgruppe:** Skal veilederen også finnes for sluttbrukere (ikke kun firma-admin)? Eller er sluttbruker-onboarding et separat tema?

## Status

Idé-stadium. Planlagt implementasjon ~1 måned frem (post-Fase 0). Etablert som dokumentasjon 2026-04-28 for å bevare beslutningsgrunnlag per sannhetskilde-prinsippet — kunnskap som ikke skrives inn er usynlig.

## Kilde

Beslutning om å dokumentere modulen identifisert under K2-konsolideringssesjonen 2026-04-28 (Kenneth-input). Selve modulen ble nevnt som plan-element av Kenneth — ingen tidligere dokumentasjon eksisterte.
