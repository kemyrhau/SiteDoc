# Neste oppgave: PR O-3 — Routes batch-migrering

Dato: 2026-05-12
Status: Klar til start

## Kontekst
OrganizationMember-refaktoren er i gang. O-1 og O-2 er deployet til prod.

O-1: OrganizationMember-tabell opprettet og backfylt (3 prod-brukere, 26 test-brukere)
O-2: tilgangskontroll.ts oppdatert med dual-read for autoriserAdminForFirma,
     verifiserOrganisasjonTilgang og harOrgRolle

## O-3 scope
Batch-migrering av routes som fortsatt leser User.organizationId direkte.

Gjenstående i tilgangskontroll.ts (~17 prisma.user-kall utover de 3 som ble fikset i O-2):
- verifiserAdmin (linje 100) — company_admin-fallback via User.role
- verifiserProsjektmedlem (linje 132) — company_admin-fallback via User.role
- verifiserAdminEllerFirmaansvarlig (linje 253) — company_admin-fallback via User.role
- verifiserKompetanseSkriveTilgang (linje 684) — leser User.role + User.organizationId
- øvrige funksjoner som leser User.organizationId

Topp-routes som bruker User.organizationId direkte (ikke via tilgangskontroll-helpers):
- organisasjon.ts (69 treff) — viktigst
- maskin/equipment.ts (44 treff)
- timer/dagsseddel.ts (43 treff)
- prosjekt.ts (35 treff)
- admin.ts (27 treff)
- vare.ts (25 treff)

## Strategi
Dual-read mønster: OrganizationMember først, fallback til User.organizationId (fjernes i O-5).
Batch-vis: tilgangskontroll.ts resterende → organisasjon.ts → admin.ts → modul-routes.

## Viktige beslutninger (lås i fase-0-beslutninger.md)
- OrganizationRole-tabellen deprecated → OrganizationMember.firmaRoller (0 rader, trygt)
- tildelOrgRolle/fjernOrgRolle oppdateres i O-3 til å skrive til OrganizationMember.firmaRoller
- OrganizationMemberPermission (modul-tilgang) implementeres etter O-3

## Les før du starter O-3
- docs/claude/fase-0-beslutninger.md § OrganizationMember-refaktor
- apps/api/src/trpc/tilgangskontroll.ts (se O-2-endringene for mønster)
- CLAUDE.md § Pågående arbeid

## Branch
feature/org-member-o3 fra develop
