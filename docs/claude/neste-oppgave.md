# Neste oppgave: PR O-5 — Drop legacy User-felt

Dato: 2026-05-13
Status: Klar til planlegging (ikke koding ennå)

## O-4 fullført
O-4a + O-4b deployet til prod (commits 3852ed8c + 0932da51 + cf1669b7).
firma/ansatte live. hentBrukere leser fra OrganizationMember.

## O-5 scope

### Forutsetning: dual-read-fallback kan fjernes
Alle OrganizationMember-rader er backfylt (prod: 3, test: 26).
Ingen kode legger til nye User-rader uten tilhørende OrganizationMember.
Fallback-koden i erFirmaAdmin, autoriserAdminForFirma, hentBrukersOrg etc. er trygg å fjerne.

### Schema-endringer (migrasjon kreves)
DROP fra User:
- organizationId + organization-relasjon + tilhørende indekser + composite uniques
- ansattnummer
- avdelingId + avdeling-relasjon

DROP tabell:
- organization_roles (OrganizationRole — 0 rader, deprecated i O-3a)

### Kode-endringer
- Fjern fallback-grener i: erFirmaAdmin, autoriserAdminForFirma,
  verifiserOrganisasjonTilgang, harOrgRolle, hentBrukersOrg (alle O-5-kommentarer)
- Fjern User.role === "company_admin" (erstattes av OrganizationMember.firmaRoller)
  → User.role reduseres til "sitedoc_admin" | "user"
- Fjern Organization.users back-relasjon (erstattes av Organization.members)

### Viktig: global email-unique
Dagens schema: @@unique([email, organizationId]) på User
Etter O-5: @@unique([email]) globalt
Krever: sjekk at ingen duplikate e-poster eksisterer på tvers av orger i prod-DB FØR migrasjon

## Sjekk FØR O-5 starter
ssh sitedoc "psql -d sitedoc -c \"SELECT email, COUNT(*) FROM users GROUP BY email HAVING COUNT(*) > 1;\""

## Les før O-5
- docs/claude/fase-0-beslutninger.md § OrganizationMember-refaktor
- Alle O-5-kommentarer i tilgangskontroll.ts og organisasjon.ts
