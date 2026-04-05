# Tilgangskontroll — Flerlagstilgang

## Oversikt

`tilgangskontroll.ts` implementerer SiteDoc sitt flerlagede tilgangssystem. Brukes av alle routere som sjekker dokumenttilgang.

## Tilgangsmodell (3 lag)

```
Lag 1: Admin-bypass → ser ALT, null-filter
Lag 2: Direkte entreprise → MemberEnterprise → bestiller/utfører (alle domener)
Lag 3: Gruppe-tilgang → domain-match + valgfri entreprise-begrensning
```

### Lag 3 detalj: Gruppe-tilgang

| Gruppe-type | Oppførsel |
|-------------|-----------|
| Uten entrepriser | **Tverrgående:** ser ALLE dokumenter med matchende domain |
| Med entrepriser | **Begrenset:** kun dokumenter med matchende domain OG entreprise |

Eksempel: HMS-gruppen (domains=["hms"], ingen entrepriser) → ser alle HMS-sjekklister i prosjektet.

## Nøkkelfunksjoner

```typescript
hentBrukerEntrepriseIder(userId, projectId)
  → null (admin) | string[] (brukerens entreprise-IDer)

byggTilgangsFilter(userId, projectId)
  → null (admin) | Prisma WHERE { OR: [...] }
  // Kombinerer entreprise-tilgang + gruppe-domain-tilgang

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

// Opprettelse (entreprise-tilhørighet)
await verifiserEntrepriseTilhorighet(ctx.userId, input.bestillerEnterpriseId);

// Tillatelsessjekk
await verifiserTillatelse(ctx.userId, projectId, "manage_field");
```

## Fallgruver

- `null`-retur fra `byggTilgangsFilter` betyr admin — IKKE tomt filter
- Domain-sjekk er kun aktiv når malen har domain-felt — uten domain ser alle
- Gruppe uten entrepriser gir BREDERE tilgang enn med entrepriser
- `verifiserEntrepriseTilhorighet` har admin-bypass — admin kan opprette for alle
- Tillatelser aggregeres fra ALLE grupper — en bruker med manage_field i én gruppe har det globalt
