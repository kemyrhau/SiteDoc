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

## Fallgruver

- `null`-retur fra `byggTilgangsFilter` betyr admin — IKKE tomt filter
- Domain-sjekk er kun aktiv når malen har domain-felt — uten domain ser alle
- Gruppe uten faggrupper gir BREDERE tilgang enn med faggrupper
- `verifiserFaggruppeTilhorighet` har admin-bypass — admin kan opprette for alle
- Tillatelser aggregeres fra ALLE grupper — en bruker med manage_field i én gruppe har det globalt
