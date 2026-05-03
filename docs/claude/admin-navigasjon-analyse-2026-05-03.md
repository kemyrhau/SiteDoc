---
name: admin-navigasjon-analyse-2026-05-03
description: Analyse av manglende kobling mellom firma- og prosjekt-kontekst i UI.
  Grunnlag for redesign av admin-navigasjon iht. vedtatt arkitektur.
status: aktiv
sist_oppdatert: 2026-05-04
---

# Admin-navigasjon analyse — 2026-05-03

## Korrigert hierarki (Kenneth, 2026-05-03)

Prosjekt er IKKE en selvstendig toppnivå-entitet. Det er en firmamodul
på samme nivå som Timer, Maskin og Kompetanse:

```
Sitedoc
└── Firma
    ├── Firmamoduler (tverrgående):
    │   ├── Timer
    │   ├── Maskin
    │   ├── Kompetanse
    │   ├── Prosjekt  ← firmamodul, ikke toppnivå
    │   └── Fremdrift
    └── Prosjektmalverk
```

Konsekvens for navigasjon:
- Firma velges FØRST — alt annet er under firma
- ProsjektVelger i toppbar er en snarvei/arbeidsflate, ikke primær navigasjon
- Riktig flyt for sitedoc_admin:
  Admin → Velg firma → Se firmaets moduler (inkl. Prosjekter) → Velg prosjekt
- Dagens UI bryter dette ved å behandle ProsjektVelger som uavhengig av firma

## Grunnlag
Vedtatt arkitektur (terminologi.md § 0):
```
Firma (Organization)
├── Firmaadministrasjon
│   ├── Firmamoduler: Timer, Maskin, Kompetanse, Fremdrift
│   └── Prosjektmalverk
└── Prosjekter
    └── Prosjekt
        ├── Faggrupper + Dokumentflyt (alltid på)
        ├── Tegninger (alltid på)
        └── Prosjektmoduler (av/på per prosjekt)
```

## Observerte problemer (Kenneth, 2026-05-03)

### P1 — Prosjekt og firma er ikke koblet i UI
- Toppbar viser tre uavhengige velgere: ProsjektVelger + ByggeplassVelger + FirmaVelger
- Man kan velge Byggeleder som firma og Markussen Boligfelt B12 som prosjekt
  (prosjektet tilhører et annet firma — A.Markussen)
- Bytte av firma nullstiller ikke prosjekt-kontekst
- Prosjektlisten filtreres ikke på valgt firma

**Rotårsak (kode):**
- `prosjekt-kontekst.tsx` og `firma-kontekst.tsx` er fullstendig isolerte
- `prosjekt.hentAlle` filtrerer ikke på `primaryOrganizationId`
- Provider-hierarkiet har ingen kobling mellom de to kontekstene

### P2 — Admin-siden viser skall-firmaer blandet med reelle firmaer
- `/dashbord/admin/firmaer` viser alle Organization-rader uten distinksjon
- Byggherre, Tømrer Hansen, Elektrikker Hansen, Hovedentreprenør er faggruppe-rader
  opprettet som Organization — ikke reelle SiteDoc-kunder
- `erKunde`-feltet finnes (Steg 1a) men brukes ikke som filter på admin-siden
- Mangler Timer-kolonne — kun Maskin vises
- Proadm-badge vises på Byggherre (skall-firma)

### P3 — «Byggeleder» er et forvirrende navn
- «Byggeleder» er en faggruppe-betegnelse i dokumentflyt
- Brukes som firmanavn i test-DB — gir feil assosiasjoner
- Testdata-kvalitet: begge testprosjekter har `primary_organization_id = null`

### P4 — Navigasjonsstrukturen gjenspeiler ikke arkitekturen
- Firma-admin-sider er tilgjengelige via FirmaVelger i toppbar — ikke via
  prosjekt-navigasjon
- Som sitedoc_admin er det ingen tydelig vei til firma-admin fra dashbordet
  uten å kjenne URL-en
- Admin-siden (`/dashbord/admin/firmaer`) er ikke koblet til firma-admin-sidene

### P5 — Manglende admin-funksjonalitet (ikke bygget)
Kenneth etterspurte følgende som ikke finnes i dag:
- Firmaliste med abonnement-status (Aktiv / Prøveperiode / Deaktivert)
- Moduloversikt per firma fra admin-perspektiv
- Klikke på firma → se firmaets prosjekter
- Klikke på prosjekt → se prosjektmoduler
- Fakturaoversikt basert på modulvalg (Fase om ~4 uker)

## Teknisk analyse

### Hva som må til for P1 (firma↔prosjekt-kobling)

**Server (~1-2t):**
- `prosjekt.hentAlle/hentMine` får valgfri `organizationId`-input
- sitedoc_admin med `orgId`: `where: { primaryOrganizationId: orgId }`
- sitedoc_admin uten `orgId`: alle prosjekter (status quo)

**Klient (~1t):**
- `prosjekt-kontekst.tsx` importerer `useFirma()`
- Sender `organizationId: valgtFirma?.id` til `prosjekt.hentAlle`
- Tom-state: «Ingen prosjekter for [firma]» med lenke til «Opprett nytt prosjekt»

**Fase 2 (~2-3t, kan utsettes):**
- Auto-reset av prosjekt-kontekst ved firma-bytte (kun ved reell konflikt)
- redirect til `/dashbord` ved mismatch

**Bakfyll test-DB:**
- Sett begge testprosjekter til `primaryOrganizationId = Byggeleder-id` (30 sek SQL)

**Estimat Fase 1:** ~3-4t | **Fase 2:** ~2-3t

### Hva som må til for P2 (admin-siden)

- Filter `WHERE er_kunde = true` på `admin/firmaer`-siden
- Legg til Timer-kolonne ved siden av Maskin
- Merk/skjul skall-firmaer eller fjern dem fra listen

**Estimat:** ~2t

### Hva som må til for P4+P5 (admin-navigasjon, ny funksjonalitet)

Dette er en større redesign-runde:
- Ny admin-oversikt: firmaliste med abonnement-status + moduloversikt
- Drill-down: firma → prosjekter → prosjektmoduler
- Abonnement-modell må designes (Aktiv/Prøveperiode/Deaktivert)

**Estimat:** ~1-2 dager, krever planleggingssesjon

## Prioritert tiltak-rekkefølge

| # | Tiltak | Estimat | Blokkerende? |
|---|---|---|---|
| 1 | Bakfyll test-DB `primary_organization_id` | 5 min | Ja, for P1 |
| 2 | P1 Fase 1: prosjektliste filtreres på firma | ~3-4t | Ja, for kundevisning |
| 3 | P2: admin/firmaer — erKunde-filter + Timer-kolonne | ~2t | Nei |
| 4 | P3: Rename «Byggeleder» i test-DB | 5 min | Nei |
| 5 | P1 Fase 2: auto-reset ved firma-bytte | ~2-3t | Nei |
| 6 | P4+P5: Admin-navigasjon redesign | ~1-2 dager | Nei |

## Åpne beslutninger (Kenneth må avklare)

- [ ] Abonnement-modell: hvilke statuser, hva betyr «Prøveperiode», når deaktiveres?
- [ ] Admin-navigasjon: skal sitedoc_admin ha egen admin-seksjon adskilt fra
      vanlig firma-admin, eller integrert?
- [ ] Rename test-firma: hva skal «Byggeleder» hete?
- [ ] Fase 2 auto-reset: ønsket atferd eller holder Fase 1?
