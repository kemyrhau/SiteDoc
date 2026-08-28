# Tilgangskontroll — Flerlagstilgang

## Oversikt

`tilgangskontroll.ts` implementerer SiteDoc sitt flerlagede tilgangssystem. Brukes av alle routere som sjekker dokumenttilgang.

## Tilgangsmodell (3 lag)

```
Lag 1: Admin-bypass → ser ALT, null-filter
Lag 2: Direkte faggruppe → FaggruppeKobling → bestiller/utfører (alle domener)
Lag 3: Gruppe-tilgang → domain-match + valgfri faggruppe-begrensning
```

### Lag 3 detalj: Gruppe-tilgang

| Gruppe-type | Oppførsel |
|-------------|-----------|
| Uten faggrupper | **Tverrgående:** ser ALLE dokumenter med matchende domain |
| Med faggrupper | **Begrenset:** kun dokumenter med matchende domain OG faggruppe |

Eksempel: HMS-gruppen (domains=["hms"], ingen faggrupper) → ser alle HMS-sjekklister i prosjektet.

## Nøkkelfunksjoner

```typescript
hentBrukerFaggruppeIder(userId, projectId)
  → null (admin) | string[] (brukerens faggruppe-IDer)

byggTilgangsFilter(userId, projectId)
  → null (admin) | Prisma WHERE { OR: [...] }
  // Kombinerer faggruppe-tilgang + gruppe-domain-tilgang

verifiserDokumentTilgang(userId, projectId, bestillerId, utforerId, domain?)
  // Kaster FORBIDDEN hvis bruker ikke har tilgang

hentBrukerTillatelser(userId, projectId)
  → Set<Permission> (aggregert fra alle grupper)

verifiserTillatelse(userId, projectId, permission)
  // Kaster FORBIDDEN hvis tillatelse mangler
```

## Bruksmønster i routere

```typescript
// Liste-query (filter)
const filter = await byggTilgangsFilter(ctx.userId, input.projectId);
return prisma.checklist.findMany({ where: { ...filter } });

// Enkelt-dokument (verifikasjon)
await verifiserDokumentTilgang(ctx.userId, projectId, bestillerId, utforerId, domain);

// Opprettelse (faggruppe-tilhørighet)
await verifiserFaggruppeTilhorighet(ctx.userId, input.bestillerFaggruppeId);

// Tillatelsessjekk
await verifiserTillatelse(ctx.userId, projectId, "manage_field");
```

## Ansettelses-guard (registreringsmodell fase 1, 2026-08-28)

Deaktivering av en ansatt er ÉN reversibel fakta på `OrganizationMember.status`
(`"aktiv"` | `"deaktivert"`), lest **ved porten** — ikke N `periodeSlutt`-skrivinger.

- `krevAktivAnsettelse(userId, projectId)` — kaster FORBIDDEN når brukeren er ansatt
  i prosjektets **eier-firma** (`Project.primaryOrganizationId`) og status er
  `"deaktivert"`. No-op for standalone-prosjekter og for ikke-ansatte (guest på annet
  firmas prosjekt). Kalt i alle 11 prosjekt-porter ETTER `sitedoc_admin`-bypass, FØR
  firma-admin-bypass (en deaktivert firma_admin skal ikke slippe inn via
  `erFirmaAdminForProsjekt`).
- `hentBrukersOrg` filtrerer på `status:"aktiv"` → dekker hele firma-nivå-medlemsveien
  (inkl. timeføring via `krevBrukersOrg`) på én linje. Bonus: løser multi-org rent til
  det aktive firmaet.
- `hentDeaktiverteOrgIder(userId)` — brukt av `prosjekt.hentAlle`/`hentSistBrukte` for å
  skjule prosjekter eid av org der ansettelsen er deaktivert (ProjectMember-radene
  ryddes bevisst ikke, så member-scopet ville ellers vist ikke-åpnbare prosjekter).
- Deaktivering-mutasjon: `organisasjon.settAnsattStatus` (firmaadmin-only, lockout-guard
  på egen rad, sitedoc_admin skjermet). Varig spor i `Activity` (`action:
  "ansatt_deaktivert"|"ansatt_aktivert"`, `targetType:"organization_member"`).
- Oppfølger i BACKLOG: en deaktivert firma-admin beholder admin-rettigheter (de
  `verifiserFirmaAdmin`-lokale rutene leser `firmaRoller`, ikke status).

## Fallgruver

- `null`-retur fra `byggTilgangsFilter` betyr admin — IKKE tomt filter
- Domain-sjekk er kun aktiv når malen har domain-felt — uten domain ser alle
- Gruppe uten faggrupper gir BREDERE tilgang enn med faggrupper
- `verifiserFaggruppeTilhorighet` har admin-bypass — admin kan opprette for alle
- Tillatelser aggregeres fra ALLE grupper — en bruker med manage_field i én gruppe har det globalt
