---
name: navigasjon-arkitektur-analyse-2026-05-03
description: Komplett kartlegging av innstillings- og navigasjonssider mot vedtatt tre-nivå-arkitektur. Anker for all fremtidig navigasjons-rydding.
status: aktiv
sist_verifisert_mot_kode: 2026-05-03
---

# Navigasjon og arkitektur-analyse — 2026-05-03

## Grunnlag

Vedtatt arkitektur: [terminologi.md § 0](terminologi.md) (tre nivåer: Firma → Firmaadministrasjon → Prosjekter) + [arkitektur-syntese.md](arkitektur-syntese.md) (helhetlig produktarkitektur).

```
Firma (Organization)
├── Firmaadministrasjon
│   ├── Firmamoduler (tverrgående): Timer, Maskin, Kompetanse, Fremdrift
│   └── Prosjektmalverk
└── Prosjekter
    └── Prosjekt
        ├── Faggrupper + Dokumentflyt (alltid på)
        ├── Tegninger (alltid på)
        └── Prosjektmoduler (av/på per prosjekt):
            Sjekklister/Oppgaver/Godkjenning, Dokumentsøk, Mapper,
            HMS-avvik, 3D-visning, Økonomi, PSI, Kontrollplan
```

## Dagens hierarki — fem toppnoder

1. **Globale firma-admin-sider** (`/dashbord/firma/*`) — 10 sider
2. **Globale firmamodul-arbeidsflater** (`/dashbord/maskin/*`, `/dashbord/timer/mine`) — 5 sider
3. **Per-prosjekt-funksjoner** (`/dashbord/[prosjektId]/*`) — 18 modul-ruter
4. **Prosjekt-oppsett** (`/dashbord/oppsett/*` — kontekst-bundet via prosjekt-velger) — 14 sider
5. **Sitedoc-admin** (`/dashbord/admin/*`) — 4 sider (utenfor brukerens arkitektur, kun Kenneth)

## Komplett tiltak-tabell

### A. Firma-administrasjon (skal under `/dashbord/firma/*`)

| Side | Dagens plassering | Riktig plassering | Tiltak |
|------|-------------------|-------------------|--------|
| Firma-master (navn, org.nr, faktura) | `/dashbord/firma/innstillinger` | ✅ Korrekt | Behold |
| Brukere (firma-ansatte) | `/dashbord/firma/brukere` | ✅ Korrekt | Behold |
| Avdelinger | `/dashbord/firma/avdelinger` | ✅ Korrekt | Behold |
| Kompetansematrise | `/dashbord/firma/kompetanse` | ✅ Korrekt (firmamodul) | Behold |
| Fakturering | `/dashbord/firma/fakturering` | ✅ Korrekt | Behold |
| Prosjekter (firmaets liste) | `/dashbord/firma/prosjekter` | ✅ Korrekt | Behold |
| Timer-katalog (lønnsart/aktivitet/tillegg/onboarding) | `/dashbord/firma/timer/*` | ✅ Korrekt (firmamodul-konfig) | Behold, men Lag 1+2 firma-konvergens |
| Maskin-register | `/dashbord/maskin/*` | ⚠️ **Avvik:** Maskin er firmamodul, men ligger ikke under `/firma/` | **Vurder flytt** til `/dashbord/firma/maskin/*` ELLER aksepter som arbeidsflate-avvik |
| Mine timer (egen rapport) | `/dashbord/timer/mine` (også lenket fra firma-sidebar) | ⚠️ **Brukerflate, ikke firma-admin** | Fjern fra firma-sidebar; flytt til toppnivå-meny eller bruker-meny |
| **Prosjektmalverk** (firma-bibliotek) | **MANGLER** | Skal være `/dashbord/firma/maler` | **Bygg i Fase 2** (OrganizationTemplate) |
| **Fremdriftsplanlegger** | **MANGLER** | `/dashbord/firma/planlegger` | Fase 4+ |
| **Varelager** | **MANGLER** | `/dashbord/firma/varelager` | Fase 5 |
| **Firma-HMS-dashbord** | `/dashbord/firma/hms` | ✅ Implementert 2026-05-29 (Trinn 1–3 deployet via `526db462`) | Aggregering av HMS-avvik/SJA/RUH på tvers av firma-prosjekter. Gated via `kreverHmsTilgang`-felt på NavElement, sjekkes via ny `trpc.organisasjon.harHmsTilgang`-query. Synlig for firma-admin og bruker med `firmaRoller.includes("hms_ansvarlig")` |

### B. Per-prosjekt — alltid på (Faggrupper + Tegninger)

| Side | Dagens plassering | Riktig plassering | Tiltak |
|------|-------------------|-------------------|--------|
| Faggrupper (read-only liste) | `/dashbord/[prosjektId]/faggrupper` | ⚠️ **Duplikat** med CRUD-side | **Konsolider** (allerede flagget i STATUS-AKTUELT) |
| Faggrupper (CRUD-admin) | `/dashbord/prosjekter/[id]/faggrupper` | Alltid-på prosjekt-funksjon | Konsolider sammen med read-only |
| Dokumentflyt-konfig (kontakter) | `/dashbord/oppsett/produksjon/kontakter` | Alltid-på prosjekt-funksjon | Behold, men terminologi: «kontakter» → «dokumentflyt» |
| Tegninger | `/dashbord/[prosjektId]/tegninger` | ✅ Korrekt | Behold |
| Lokasjoner (Byggeplass) | `/dashbord/oppsett/lokasjoner` | Alltid-på prosjekt-funksjon | Behold |

### C. Prosjektmoduler (av/på per prosjekt)

| Side | Dagens plassering | Riktig plassering | Tiltak |
|------|-------------------|-------------------|--------|
| Sjekklister | `/dashbord/[prosjektId]/sjekklister` | ✅ Korrekt | Behold |
| Sjekklistemaler | `/dashbord/oppsett/produksjon/sjekklistemaler` | ✅ Per-prosjekt-malverk | Behold (kandidat for promotering til firma-bibliotek senere) |
| Oppgaver | `/dashbord/[prosjektId]/oppgaver` | ✅ Korrekt | Behold |
| Oppgavemaler | `/dashbord/oppsett/produksjon/oppgavemaler` | ✅ Per-prosjekt-malverk | Behold |
| Maler-bibliotekvalg | `/dashbord/[prosjektId]/maler` | ✅ Korrekt | Behold |
| Mapper | `/dashbord/[prosjektId]/mapper` | ✅ Korrekt | Behold |
| Mapper-oppsett (Box) | `/dashbord/oppsett/produksjon/box` | ⚠️ Gammel terminologi «box» | **Rename** til `/oppsett/produksjon/mapper` |
| 3D-visning | `/dashbord/[prosjektId]/3d-visning` + `tegning-3d` | ✅ Korrekt | Behold (to relaterte ruter — vurder konsolidering) |
| Kontrollplan | `/dashbord/[prosjektId]/kontrollplan` | ✅ Korrekt | Behold |
| Økonomi | `/dashbord/[prosjektId]/okonomi` | ✅ Korrekt | Behold |
| PSI (utfylling) | `/dashbord/[prosjektId]/psi` | ✅ Korrekt | Behold |
| PSI-mal-oppsett | `/dashbord/oppsett/produksjon/psi` | ✅ Per-prosjekt-konfig | Behold |
| Dokumentsøk | `/dashbord/[prosjektId]/sok` | ✅ Korrekt | Behold |
| AI-søk-config | `/dashbord/oppsett/ai-sok` | ✅ Per-prosjekt-konfig | Behold |
| Modul av/på | `/dashbord/oppsett/produksjon/moduler` | ✅ Per-prosjekt-modul-toggle | Behold |
| **HMS-avvik** | Implementert som oppgavemal med `domain="hms"` | Eksplisitt prosjektmodul i arkitektur | **Avklar:** egen modul-flag eller behold som oppgave-domain? |
| **Godkjenning (UI)** | **MANGLER** (Prisma-modell finnes) | Samlet med Sjekklister/Oppgaver-pakken | **Bygg i Fase 0** (per A.2/A.8) |

### D. Per-prosjekt — admin/oppsett som krever ryddig plassering

| Side | Dagens plassering | Riktig plassering | Tiltak |
|------|-------------------|-------------------|--------|
| Prosjekteier-info («Firmainnstillinger») | `/dashbord/oppsett/firma` | Per-prosjekt info om eier-firma | **Rename** «Prosjekteier», read-only når brukeren er firma-admin (lenke til `/dashbord/firma/innstillinger`) |
| Prosjektmedlemmer (ProjectMember) | `/dashbord/oppsett/brukere` | ✅ Per-prosjekt | Behold |
| Generelle prosjekt-innstillinger | `/dashbord/oppsett/prosjektoppsett` | ✅ Per-prosjekt | Behold |
| Timer-attestering (leder) | `/dashbord/[prosjektId]/timer/attestering` | ✅ Per-prosjekt arbeidsflate | Behold |
| Timer-godkjenning (legacy alias) | `/dashbord/[prosjektId]/timer/godkjenning` | Redirect til `/timer/attestering` | Slett etter mobil-app oppdatert (>1 uke etter rename per CLAUDE.md API-regel) |
| Timer-registrering (bruker) | `/dashbord/[prosjektId]/timer/*` | ✅ Per-prosjekt arbeidsflate | Behold |

### E. Sitedoc-admin (utenfor brukerens arkitektur)

| Side | Dagens plassering | Riktig plassering | Tiltak |
|------|-------------------|-------------------|--------|
| Firmaer-liste (alle) | `/dashbord/admin/firmaer` | Lag 6 sitedoc_admin | Behold |
| Prosjekter-liste (alle) | `/dashbord/admin/prosjekter` | Lag 6 sitedoc_admin | Behold |
| Tillatelse-debug | `/dashbord/admin/tillatelser` | Lag 6 sitedoc_admin | Behold (debug-verktøy) |
| Testsider | `/dashbord/admin/testsider` | ⚠️ Utviklerverktøy i prod-UI | **Vurder fjernet** fra prod-build |

## Sammendrag på fire spørsmål

### 1. Samsvar — hva matcher arkitekturen
- ✅ **Firma-admin-seksjonen** (`/dashbord/firma/*`) er bra strukturert mot arkitekturen
- ✅ **Prosjektmoduler** (sjekkliste/oppgave/3D/økonomi/etc.) ligger korrekt under `/dashbord/[prosjektId]/`
- ✅ **Faggrupper + Dokumentflyt** behandles som alltid-på prosjekt-funksjoner
- ✅ **Modul-toggle** finnes på `/dashbord/oppsett/produksjon/moduler`

### 2. Feil plassering
- ⚠️ **Maskin** ligger på `/dashbord/maskin/*`, ikke under `/dashbord/firma/maskin/*` — diskutabelt om dette er feil eller designvalg (arbeidsflate-avvik)
- ⚠️ **«Firmainnstillinger»** under prosjekt-oppsett er forvirrende navngitt — skal være «Prosjekteier»
- ⚠️ **«Mine timer»** lenkes fra firma-admin-sidebar — det er en brukerrapport, ikke firma-admin
- ⚠️ **«Box»** terminologi er gammel — skal være «Mapper»
- ⚠️ **To faggrupper-sider** (read-only + CRUD) er duplikat — allerede flagget

### 3. Mangler i implementasjon
- **Prosjektmalverk** (firma-bibliotek) — Fase 2
- **Godkjenning UI** — Fase 0 (modell finnes)
- **HMS-avvik som eksplisitt modul** (i dag bare oppgavemal med domain) — avklaringspunkt
- **Fremdriftsplanlegger** — Fase 4+
- **Varelager** — Fase 5
- **PSI med innsjekk/utsjekk + mannskaps-vy** — Fase 4
- **OrganizationModule-overgang** — erstatter midlertidige `harTimerModul`/`harMaskinModul`-flag

### 4. Bør fjernes/deaktiveres
- **`/dashbord/admin/testsider`** — utviklerverktøy i prod-UI, vurder fjernet eller gated bak miljø-flag
- **`/dashbord/[prosjektId]/timer/godkjenning`** (legacy redirect) — slett etter mobil-app-oppdatering
- **«Mine timer»-lenke fra firma-admin-sidebar** — flytt til bruker-meny
- **«Box»-rute** — rename til «Mapper»

## Åpne avklaringspunkter (Kenneth må beslutte)

1. **HMS-avvik** — eksplisitt modul-flag eller behold som oppgave-domain?
2. **Maskin-plassering** — `/dashbord/maskin/*` eller `/dashbord/firma/maskin/*`? (Konsekvenser: sidebar-plassering, URL-stabilitet for eksisterende kunder, breadcrumbs)
3. **«Mine timer»-plassering** — toppnivå-meny, bruker-meny (under avatar), eller ny seksjon?
4. **3D-visning konsolidering** — `/3d-visning` og `/tegning-3d` er to relaterte ruter; skal de slås sammen?
5. **Sjekklistemaler/Oppgavemaler under produksjon** — beholde under `/oppsett/produksjon/*` eller løfte til toppnivå-prosjekt-meny som egne ruter?
6. **«Kontakter» (dokumentflyt-konfig)** — rename til «Dokumentflyt»?
7. **OrganizationModule-overgang timing** — gjøres som egen Fase 0-fortsettelse eller integrert med Lag 1+2+3?

## Prioritert rekkefølge

| # | Tiltak | Estimat | Konflikt med andre planer? |
|---|--------|---------|----------------------------|
| 1 | Rename «Firmainnstillinger» → «Prosjekteier» + read-only-mode + lenke | 1t | Innebygd i Lag 3 av Firma-admin-navigasjon |
| 2 | Konsolider de to faggruppe-sidene | 2-3t | Allerede flagget |
| 3 | Fjern «Mine timer» fra firma-admin-sidebar | 15 min | Trivielt |
| 4 | Rename «Box» → «Mapper» | 30 min | Selvstendig opprydding |
| 5 | HMS-avvik avklarings-runde (eksplisitt modul vs domain) | 1t analyse | Krever beslutning |
| 6 | Maskin-plassering avklaring (`/maskin/` vs `/firma/maskin/`) | 30 min analyse | Krever beslutning |
| 7 | Bygg Prosjektmalverk-rute (`/dashbord/firma/maler`) | Fase 2 | Avhenger av OrganizationTemplate |
| 8 | OrganizationModule-overgang | 6-10t | Lukker Fase 0-fundament |

## Status

- [ ] Tiltak 1: Rename Firmainnstillinger → Prosjekteier
- [x] Tiltak 2: Konsolider faggruppe-sider — implementert på develop 2026-05-05
- [ ] Tiltak 3: Fjern Mine timer fra firma-sidebar
- [ ] Tiltak 4: Rename Box → Mapper
- [ ] Tiltak 5: HMS-avvik avklaring
- [ ] Tiltak 6: Maskin-plassering avklaring
- [ ] Tiltak 7: Prosjektmalverk (Fase 2)
- [ ] Tiltak 8: OrganizationModule-overgang

## Relaterte dokumenter

- [terminologi.md § 0](terminologi.md) — Tre-nivå-anker (sannhetskilde for modul-typologi)
- [arkitektur-syntese.md](arkitektur-syntese.md) — Helhetlig produktarkitektur (loan-pattern, mal-arkitektur, Fase 0-7)
- [fase-0-beslutninger.md](fase-0-beslutninger.md) — Låste arkitektur-beslutninger (særlig A.4/A.17 om OrganizationModule)
- [STATUS-AKTUELT.md](STATUS-AKTUELT.md) — Pågående arbeid + planlagte oppgaver (Lag 1+2+3 firma-admin-navigasjon, Strategi A modul-filter)
- [onboarding-veileder.md](onboarding-veileder.md) — A.Markussen onboarding-blokker (faggruppe-konsolidering)
