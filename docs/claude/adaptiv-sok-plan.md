# Adaptivt søk for sjekklister, oppgaver, HMS og RUH

**Status:** 🟡 Skal drøftes på tvers av flere systemer før implementering kan starte.
**Opprettet:** 2026-04-27
**Mangel-grunnlag:** Brukeren oppdaget at sjekklister, oppgaver, HMS og RUH mangler
adaptivt søk etter at adaptive nedtrekksmenyer for fritekst-felt ble innført som
UI-regel i [CLAUDE.md § UI-designprinsipper](../../CLAUDE.md#ui-designprinsipper).

## Hvorfor «drøftes på tvers»

Planen rører flere arkitektur-områder samtidig:

- **`packages/db`** — ny `Tag`- og `TagAssignment`-tabell krever koordinasjon med
  Fase 0-arbeid (kan kollidere med andre migreringer)
- **`packages/ui`** — ny `<FilterBar>` og aktivering av `<SearchInput>`. Påvirker
  alle apper som senere bruker disse komponentene (web, mobil, planlagte
  isolerte moduler som timer)
- **`packages/shared`** — nye hooks (`useListFilter`, `useRecentlyUsed`).
  Mønsteret må stemme med eksisterende mønstre
- **Oppgaver/HMS-domain** — endringen krever standardisering av feltnavn
  (`recipientFaggruppe` vs `utforerFaggruppe`). Dette berører dokumentflyt-
  arkitekturen
- **RUH** — er ikke implementert i dag. Beslutning trengs: egen liste eller
  filter-view i HMS?
- **Mobil** — har minimal liste-visning i dag. Hvor langt skal denne planen
  følge mobilen?

Disse trådene må kobles før koding starter, ellers risikerer vi parallell
utvikling som krever ny refaktor.

---

## 1. Funn fra kode-utforskning (2026-04-27)

| Tema | Faktisk tilstand i dag |
|---|---|
| **HMS** | Ikke egen modul — `domain: "hms"` i `Task`-tabellen |
| **RUH** | Ikke implementert som liste — kun referanser i PSI |
| **Søkefelt** | Mangler i alle fire — ingen global søk |
| **Filter-logikk** | Duplisert mellom `sjekklister/page.tsx` (648 linjer) og `oppgaver/page.tsx` (830 linjer) |
| **Tags** | Lagres som JSON i `data`-felt, ikke normalisert tabell |
| **Sortering** | Default + manuell kolonne-sort. Ingen «nylig brukt øverst» |
| **Delt komponent** | `<SearchInput>` finnes i `packages/ui` men er **ikke i bruk** noe sted |
| **Inkonsistens** | Sjekklister bruker `recipientFaggruppe`, oppgaver bruker `utforerFaggruppe` — samme konsept, ulike nøkler |

---

## 2. Avgrensning

**Inkludert:**
- Sjekklister (mal-velger + instans-liste)
- Oppgaver (inkl. HMS-domain)
- RUH (krever egen liste-side først, eller integreres i HMS-visning)

**Ikke inkludert i denne runden:**
- Andre lister (kontakter, mapper, kontrollpunkter, mannskap) — kan vurderes
  senere når mønsteret er etablert
- Mobil — søk i lange lister er web-fokus først; mobil har minimal
  liste-visning i dag

---

## 3. Faseinndelt løsning

### Fase A — Felles infrastruktur (1 sprint)

Bygg de delte byggesteinene én gang, så de kan brukes av alle fire modulene.

**A.1 Aktiver eksisterende `<SearchInput>` i `packages/ui`**
- Komponenten finnes — fyll den med faktisk funksjonalitet (debounce, fokus,
  clear-knapp)
- Søker over felter definert av forelder via prop

**A.2 Ny `useListFilter`-hook i `packages/ui` eller `packages/shared`**
- Kapsler dagens duplisert logikk (`filterVerdier`, `dynamiskFilter`)
- Returnerer filtrert liste + filter-state + `setFilter`/`clearFilter`
- Bruker generisk over T

**A.3 Ny `<FilterBar>`-komponent i `packages/ui`**
- Filter-chips med × (allerede mønster i kontrollplan)
- «Fjern alle»-knapp
- Knytte filter-typer (status/dato/dropdown) deklarativt

**A.4 Ny `useRecentlyUsed`-hook**
- Lagrer siste 5 åpnede ID-er per (bruker, listetype) i `localStorage`
- Returnerer en sortert ID-liste som kalleren bruker for å re-ordne resultater

**A.5 Terskler som UI-konstanter**
- `MIN_FOR_SEARCH = 7` (vis søkefelt når ≥7 elementer)
- `RECENT_LIMIT = 5`
- `MIN_TAG_USES = 3` (tag blir foreslått som filter etter 3 bruk)

### Fase B — Tags som strukturert dimensjon (1 sprint)

Forhindrer at tags forblir fritekst i JSON, slik at de kan læres og foreslås.

**B.1 Ny tabell `Tag` i `packages/db`**
- `id`, `organizationId`, `navn`, `farge?`, `forsteBrukt`, `bruktAntall`, `aktiv`
- Soft-delete via `aktiv = false`

**B.2 Ny m:n-tabell `TagAssignment`**
- `tagId`, `entityType` (`checklist`/`task`/`hms`/`ruh`), `entityId`, `createdAt`
- Indeks på `(entityType, entityId)` og `(tagId)`

**B.3 Migrering — én-skudds-script**
- Les eksisterende `Checklist.data.tags` og `Task.data.tags`
- Opprett unike `Tag`-rader per organisasjon
- Opprett `TagAssignment`-rader
- Skript kjøres én gang, ikke på hver migrering

**B.4 JSON-feltet beholdes midlertidig**
- Lese-kompatibilitet til alle klienter er oppdatert
- Fjernes i senere migrering (følger to-stegs migrations-policy i
  [CLAUDE.md § Viktige regler](../../CLAUDE.md#viktige-regler))

### Fase C — Innfør i hver modul (1 sprint per modul)

**C.1 Sjekklister** — `apps/web/src/app/dashbord/[prosjektId]/sjekklister/page.tsx`
- Erstatt lokal filter-logikk med `useListFilter`
- Legg til `<SearchInput>` over tabellen (vises ved ≥7 sjekklister)
- Anvend `useRecentlyUsed` for å plassere nylig åpnede øverst
- Tags blir filter-chips når Tag-tabellen er populated

**C.2 Oppgaver (+HMS-domain)** — `apps/web/src/app/dashbord/[prosjektId]/oppgaver/page.tsx`
- Samme refactor
- HMS er allerede filtrert via `domain`-felt — ingen ny logikk for det
- Standardiser feltnavn: `recipientFaggruppe` vs `utforerFaggruppe` — velg én
  og rename i samme PR

**C.3 RUH** — krever to del-beslutninger først
- Skal RUH bli egen liste, eller filter-view innenfor HMS-listen?
  **Beslutning trengs.**
- Hvis egen liste: opprett `apps/web/src/app/dashbord/[prosjektId]/ruh/page.tsx`
  basert på samme komponenter

### Fase D — Adaptiv ranking (1 sprint)

«Nylig brukt øverst» er enkelt. Tag-læring er mer avansert.

**D.1 Tag-foreslag-logikk**
- Backend: tRPC-prosedyre `tag.foreslagForEntitet({ entityType, entityId })`
- Returnerer tags som forekommer ≥3 ganger i samme organisasjon + entityType
- Brukes i create-form for å foreslå tagging

**D.2 Filter-foreslag**
- Når en tag har vært brukt ≥3 ganger på en entitetstype, vises den
  automatisk som filter-chip i lista
- Rydding: bruker kan markere tag som «ikke vis i filter» (lagres i
  `User`-preferanser)

---

## 4. Filer som må endres / opprettes

| Fil | Endring |
|---|---|
| `packages/ui/src/search-input.tsx` | Aktiver, legg til funksjonalitet |
| `packages/ui/src/filter-bar.tsx` | **Ny** |
| `packages/shared/src/hooks/useListFilter.ts` | **Ny** |
| `packages/shared/src/hooks/useRecentlyUsed.ts` | **Ny** |
| `packages/db/prisma/schema.prisma` | Tag + TagAssignment tabeller |
| `packages/db/prisma/migrations/{ts}_tags_struktur/` | Migrering |
| `scripts/migrate-tags-from-json.ts` | **Ny** — én-skudds-skript |
| `apps/web/src/app/dashbord/[prosjektId]/sjekklister/page.tsx` | Refactor |
| `apps/web/src/app/dashbord/[prosjektId]/oppgaver/page.tsx` | Refactor |
| `apps/api/src/routes/tag.ts` | **Ny** tRPC-router |
| `apps/web/src/app/dashbord/[prosjektId]/ruh/` | **Ny mappe** (hvis egen liste) |

---

## 5. Estimat

| Fase | Innhold | Estimat |
|---|---|---|
| A | Felles infrastruktur | 1 sprint (~5 dager) |
| B | Tags-modell + migrering | 1 sprint |
| C | Innfør i sjekklister + oppgaver + RUH | 2–3 sprint (én per modul) |
| D | Adaptiv ranking + tag-foreslag | 1 sprint |
| **Totalt** | | **5–6 sprint** |

---

## 6. Åpne beslutninger før koding

| # | Spørsmål | Foreslått svar |
|---|---|---|
| 1 | Skal RUH bli egen liste eller filter-view i HMS? | **Egen liste** — RUH er en juridisk distinkt rapporteringsplikt |
| 2 | Skal feltnavn `recipientFaggruppe`/`utforerFaggruppe` standardiseres nå? | **Ja** — samme PR som oppgave-refactor (Fase C.2) |
| 3 | Tag-tabell skal være per Organization, eller per Project? | **Per Organization** — tags gjenbrukes på tvers av prosjekter |
| 4 | Skal mobil omfattes av planen? | **Nei i denne runden** — mobil har minimal liste-visning. Tas senere når mobil-listene utvikles |
| 5 | Tag-rydding: hvor skjer det (admin-side eller selvbetjent)? | **Admin** kan slå sammen/slette. **Bruker** kan kun skjule i eget filter-view |

---

## 7. Avhengigheter mot andre fase-arbeider

- **Fase 0 (DB-fundament):** Ikke direkte avhengig — Tag-tabell kan bygges
  parallelt, men migrerings-rekkefølge må koordineres
- **Faggruppe-rename:** Ferdig — ingen blokker
- **Maskin-modul (`feature/maskin-db`):** Uavhengig
- **Timer-modul:** Uavhengig av plan-innholdet, men `<SearchInput>` og
  `<FilterBar>` vil være nyttig for timer-listene når de bygges
- **Malbygger:** Eventuelle nye dokumenttyper (timeregistrering, RUH-mal)
  bør vurderes mot tag-modellen

---

## 8. Status og neste steg

**Status:** 🟡 Skal drøftes på tvers av flere systemer før implementering.

**Anbefalt neste steg:**
1. Diskusjon på tvers av db / ui / shared / dokumentflyt-arkitekturen
2. Beslutning på de 5 åpne spørsmålene i § 6
3. Koordinering med Fase 0-arbeid og Maskin-modul-bygging
4. Når alt er på plass: opprett `feature/adaptiv-sok` branch og start med Fase A
