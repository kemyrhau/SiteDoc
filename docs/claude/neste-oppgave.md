# Neste oppgave: PR O-4 — Flytt felt + firma/ansatte rename

Dato: 2026-05-12
Status: Klar til start

## O-3 fullført
O-3a + O-3b deployet til prod (commits fc929051 + 89423097).
tilgangskontroll.ts og organisasjon.ts + prosjekt.ts bruker nå OrganizationMember.

## O-4 scope

### 1. Flytt felt fra User → OrganizationMember (schema + migrasjon)
- `ansattnummer` flyttes fra User → OrganizationMember (finnes allerede som nullable)
- `avdelingId` flyttes fra User → OrganizationMember (FK til Avdeling, onDelete: SetNull)
- Backfill: kopier verdier fra User til OrganizationMember for eksisterende rader

### 2. Rename firma/brukere → firma/ansatte
- URL: /dashbord/firma/brukere → /dashbord/firma/ansatte (Next.js route rename)
- DB: ingen — URL-endring er kun routing
- Sidebar-lenke oppdateres
- i18n-nøkler oppdateres

### 3. UI: oppdater firma-bruker-side
- Siden leser ansattnummer + avdelingId fra OrganizationMember i stedet for User
- inviterBruker + oppdaterBruker mutations skrives til OrganizationMember

## Viktig å sjekke før O-4
- avdelingId har FK-relasjon til Avdeling (onDelete: SetNull) — må håndteres i migrasjon
- ansattnummer UI (commit 62f98b69) er på develop/main — må oppdateres til å lese/skrive OrganizationMember
- To-stegs migrasjon: 1) legg til felt på OrganizationMember, 2) backfill, 3) fjern fra User (O-5)

## Les før O-4
- docs/claude/fase-0-beslutninger.md § OrganizationMember-refaktor
- packages/db/prisma/schema.prisma (User-modellen, Avdeling-relasjonen)
- apps/api/src/routes/organisasjon.ts (inviterBruker + oppdaterBruker)
