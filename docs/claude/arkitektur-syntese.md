---
status: aktiv
sist_verifisert_mot_kode: ukjent
sist_endret: 2026-04-28
gjelder_versjon: tverrgående
avhenger_av:
  - arkitektur.md
  - terminologi.md
  - fase-0-beslutninger.md
påvirkes_av_beslutninger:
  - A.4
  - A.17
  - B.4
  - B.7
  - C.11
---

# SiteDoc — Helhetlig produktarkitektur (syntese)

Anker for Fase 0-koding. Resultat av iterative diskusjoner mellom Kenneth og Opus, kvalitetssikret i to QA-runder. Korreksjoner fra Opus' QA-runde 2 er integrert.

> **Status:** Designgrunnlag for Fase 0. Beslutninger låst i [fase-0-beslutninger.md](fase-0-beslutninger.md). Arkitektur-detaljer og åpne backlog-punkter står her.
>
> **Markører:** ✅ Bekreftet — 🟡 Foreslått, ikke besluttet — ❓ Åpent spørsmål — ⏸️ Backlog

---

## 1. Produktstruktur

SiteDoc består av **ett kjerneprodukt** (prosjekthotell) + **tilleggsmoduler firma kan aktivere**.

### 1.1 Prosjekthotell (kjerneprodukt — alle firma får) ✅

Norsk byggebransje har «prosjekthotell» som etablert produktkategori (Interaxo, Byggeweb). Dokumentsamarbeid og prosjekt-koordinering — ikke bemanning eller produksjonsstyring.

| Komponent | Status |
|---|---|
| Prosjekt- og byggeplass-administrasjon | Eksisterer |
| Faggrupper og brukergrupper | Eksisterer |
| Dokumentflyt | Eksisterer (kjernen) |
| KS-dokumentasjon (Sjekkliste, Oppgave, Kontrollplan) | Eksisterer |
| **Godkjenning** (utvidet dokumentflyt-type) | Mangler — Fase 0 (per A.2) |
| HMS-oppfølging (rapporter, RUH, avvik) | Eksisterer per prosjekt |
| Tegninger og IFC | Eksisterer |
| Dokumentlagring (mapper, kontrakter) | Eksisterer |
| Prosjektering | Eksisterer |
| Mal-bibliotek (`BibliotekMal`, NS 3420) | Eksisterer |
| **Mal-promotering (firma-bibliotek)** | Mangler — Fase 2 |
| **HMS-statistikk på firma-nivå** | Mangler — Fase 7 |
| **Møtemal** | Mangler — Fase 7 |
| **Månedsrapport** | Mangler — Fase 7 |
| **Street View for byggeplass** | Mangler — eget prosjekt |
| Varsling (firma konfigurerer) | Delvis |

### 1.2 Tilleggsmoduler ✅

| Modul | Inneholder | Avhengigheter |
|---|---|---|
| Mannskap/PSI | Mannskapsoversikt, innsjekk/utsjekk, PSI (valgfri per byggeplass) | — |
| Maskin | Maskinregister, service, EU-kontroll, EquipmentAssignment, EquipmentChecklist | — |
| Timer | Dagsseddel, lønnsarter, arbeidstidskalender, **Kompetanseregister**, godkjenningsflyt | — |
| Varelager | Vareregister, vareforbruk, saldo, lager-lokasjoner | — |
| DO-kobling | Sertifisering ↔ maskinbruk-validering | Maskin + Timer |
| AI-ukeplan | Automatisk ukeplan-forslag | Timer + Mannskap + Maskin |
| Tripletex-eksport | Lønn-, faktura-, vareforbruks-eksport | Timer eller Varelager |
| Proadm-eksport | Timer + tilleggsarbeid | Timer |

**Endringer fra tidligere skisser:**
- Kompetanseregister flyttet til Timer-modul (var foreslått som egen modul)
- Mannskap er vy i PSI-modulen, ikke separat modul. PSI utvides med innsjekk/utsjekk-mekanikk; mannskaps-vyen aggregerer tilstedeværelses-data per byggeplass (per CLAUDE.md § Tre nivåer-anker, korrigert 2026-04-28)
- Maskin-modul inkluderer EquipmentChecklist (separat fra prosjekt-sjekkliste)

### 1.3 Firma-instillinger (ikke moduler) ✅

| Instilling | Datatype | Default |
|---|---|---|
| Timer-tilgang default | enum (String) | 'alle-ansatte' |
| Vareforbruk-tilgang default | enum (String) | 'alle-ansatte' |
| Maskinbruk-tilgang default | enum (String) | 'sertifiserte' |

Lagres på `OrganizationSetting` som nøkkel-verdi-par.

> **Avdelinger** er ikke en av/på-instilling, men en egen tabell per C.11 (bygges Fase 0.5 — se § 5).

### 1.4 Eksempler på firma-konfigurasjon

**Firma A — kun prosjekthotell:** ingen tilleggsmoduler. Bruker SiteDoc til dokumentflyt, kontrollplan, HMS, tegninger. Bruker eget timeregistreringssystem.

**Firma B (A.Markussen):** Timer, Maskin, Mannskap/PSI, Proadm-eksport. Senere Varelager, DO-kobling, AI-ukeplan. Erstatter SmartDok fullstendig.

**Firma C — kun timer (edge case):** Timer + Tripletex-eksport. Mulig, men ikke prioritert kundesegment.

### 1.5 Samlet maler-administrasjon (UI-prinsipp)

To parallelle sjekkliste-systemer (per § 1.1) gir god domene-isolasjon på datamodell-nivå. Skarp kant: maler-administrasjon for firma-admin.

**Prinsipp:** Firma-admin skal ha samlet UI-tilgang til alle mal-typer (prosjekt-maler, maskin-maler, eventuelle fremtidige typer) — selv om de lever i ulike Prisma-schemas. Datamodell-isolasjonen opprettholdes; UI-aggregeringen skjer i frontend-laget.

**Implementeringsspec — IKKE besluttet:**
- Eksakt rute (`/oppsett/firma/maler` vs annet sted)
- Tabs-struktur eller annet UX-mønster
- Hvordan aggregering skjer mot to schemas

**Kontekst:** I dag finnes ikke firma-admin-mal-side. Når OrganizationTemplate bygges (Fase 2), må UI-strategi besluttes. Dette prinsippet er retningsgivende, ikke spec.

**Kilde:** Identifisert i Opus QA-runde 2 (2026-04-25), §6.2 Q1 — konsolidert hit 2026-04-28 som prinsipp (implementeringsdetaljer utsatt).

---

## 2. Tilgangsarkitektur

To uavhengige akser kombinert med modul-gateway.

### 2.1 Akse A — Handlingstype ✅

| Handlingstype | Kjennetegn | Eksempel |
|---|---|---|
| Produksjon | Bredt åpent for firma-ansatte | Føre timer, registrere vareforbruk, bruke maskin |
| Dokumentasjon | Kontekst-begrenset (prosjekt/byggeplass) | Se tegninger, kontrollplan, mapper |
| Dokumentflyt | Eksplisitt rolle via invitasjon | Delta i sjekkliste, godkjenne dokument |
| Administrasjon | Administrative roller | Konfigurere firma, godkjenne timer, eksportere |

### 2.2 Akse B — Hierarki ✅

```
Lag 6 — SiteDoc super-admin (sitedoc_admin)
Lag 5 — Firma-admin (company_admin)
Lag 5b — Firma-HMS-ansvarlig (kan se firma-HMS, ikke nødvendigvis annet)
Lag 4 — Prosjekt-admin (bas, prosjektleder, byggeleder)
Lag 3 — Prosjekt-medlem (ser alle byggeplasser på prosjektet)
Lag 2 — Byggeplass-medlem (begrenset til spesifikke byggeplasser)
Lag 1 — Firma-ansatt (default produksjons-tilgang)
Lag 0 — Ingen tilgang / ekstern uten invitasjon
```

**Dokumentflyt-deltakelse er ortogonalt** — eksterne kontrollører (Lag 0) kan inviteres direkte til spesifikk flyt via `DokumentflytMedlem` (utvidelse i backlog).

### 2.3 Modul-gateway (autorisasjons-rekkefølge) ✅

```
1. Er brukeren autentisert?               → ellers 401
2. Er firma-modulen aktivert?              → ellers 404
3. Har brukeren tilgangslag som kreves?    → ellers 403
4. Har brukeren prosjekt/byggeplass-scope? → ellers 403
5. Har brukeren handlingsrolle?            → ellers 403
```

Steg 2 er **gateway** (`ProjectModule.organizationId` + `status`, per A.4/A.17), steg 3-5 er **hierarki**.

**Implementeres som tRPC procedure-wrappers i Fase 0:**
- `prosjektProcedure` (auth + scope-sjekk)
- `modulProcedure(slug)` (auth + sjekk `ProjectModule.status` for prosjektets primaryOrganization, per A.4/A.17)

**Standalone-prosjekt-edge:** Hvis `Project.primaryOrganizationId IS NULL`, faller modul-gateway tilbake til standalone-policy (alle moduler tilgjengelig som default; settes som firma-policy senere).

### 2.4 Konfigurerbarhet per firma ✅

A.Markussen har åpen kultur (alle ansatte fører timer på alle prosjekter). Andre firma kan ha lukket kultur. Løses via `OrganizationSetting`:

```
OrganizationSetting (nøkkel-verdi)
├── timerTilgangDefault: 'alle-ansatte' | 'kun-prosjektmedlemmer'
├── vareforbrukTilgangDefault: ...
└── maskinbrukTilgangDefault: ...

Project (overstyring per prosjekt)
├── timerTilgangOverride?: ...
└── ...
```

### 2.5 Andre tilgangsbeslutninger ✅

| Spørsmål | Beslutning |
|---|---|
| Default byggeplass-tilgang for prosjekt-medlem | Alle byggeplasser (kan begrenses) |
| Tidsbegrenset byggeplass-tilgang | Ja — `gyldigFra`/`gyldigTil` på `ByggeplassMedlemskap` (Fase 0.5) |
| Multi-firma-bruker | Modell A vedtatt (B.7) — én User per person×firma med reaktivering. Composite unique på `(email, organizationId)` + `(phone, organizationId)` forbereder multi-identifikator-auth. |
| Firma-HMS-rapporter synlig for vanlige ansatte | Kun egne (default), konfigurerbart per firma |

---

## 3. Datamodell-prinsipper

### 3.1 To-nivå arkitektur ✅

**Firma-eid:** ressurser som lever på tvers av prosjekter — eies én gang, gjenbrukes mange steder.

**Prosjekt-eid:** lokal arbeidsenhet som låner fra firma-ressurser, produserer dokumenter, avsluttes med prosjektet.

**Transaksjoner er data, ikke arkitekturnivå.** Timer, vareforbruk, innsjekk, maskinbruk er hendelser som binder firma-ressurs til prosjekt over tid — krever ikke egne abstraksjoner.

### 3.2 Faggruppe ≠ Firma ✅

Bravida kan ha to faggrupper (Elektro, Ventilasjon) på samme prosjekt med samme `partnerId` (peker til `OrganizationPartner`-bibliotek).

### 3.3 Loan-pattern ✅

Etablert mønster i tre eksisterende implementasjoner. **Kanon: `EquipmentAssignment`-mønsteret** (eksplisitt periode + status).

| Firma-ressurs | Lånes via | Status |
|---|---|---|
| User | ProjectMember | Eksisterer (får periode-felt i Fase 0) |
| Equipment | EquipmentAssignment | Eksisterer (kanon-mønster) |
| BibliotekMal | ProsjektBibliotekValg | Eksisterer |
| OrganizationTemplate | ReportTemplate (kopi) | Bygges Fase 2 |
| Goods | Vareforbruk-linje | Bygges Fase 5 |
| Lønnsart | Dagsseddel-linje | Bygges Fase 3 |
| Kompetanse | DO-kobling til Equipment | Bygges Fase 6 |

**Eksisterende koblingstabeller med periode-gjeld** (utsatt til konsekvent oppgradering): `ProjectGroupMember`, `FaggruppeKobling`, `DokumentflytMedlem`.

### 3.4 Dokument-kontekst ✅

**Sjekklister/Oppgaver/Godkjenning** beholder kun prosjekt-kontekst — krever required `bestillerFaggruppeId` + `utforerFaggruppeId`. Ingen endring.

**HMS-rapport (Psi)** beholder ren prosjekt-kontekst — `projectId` forblir required (per CLAUDE.md § Tre nivåer-anker, korrigert 2026-04-28). PSI er prosjektmodul. Tidligere foreslått firma-eid PSI-utvidelse (organizationId + projectId nullable + kontekstType) er **forkastet**.

**PSI-utvidelser i fremtidige faser:**
- `eksternSystem`-felt (PSI gjennomført i SiteDoc eller eksternt system per byggeplass) — registrert som NY-7 / 4A i [oppryddings-plan-2026-04-28.md](oppryddings-plan-2026-04-28.md)
- Innsjekk/utsjekk-mekanikk + mannskaps-vy — design utsettes til Fase 4 (PSI-modul-utvidelse). Se [mannskap.md](mannskap.md) for vy-beskrivelse

**Maskin-vedlikeholds-sjekklister** lever som separat domene i `db-maskin` (se §3.6).

**Kontor/verksted-sjekklister utenfor HMS-rapport-modellen** ⏸️ — ikke i Fase 0. Vurderes hvis kunde etterspør.

### 3.5 kontekstType — etablert mønster ✅

`String` med default-verdi og kommentar-enum. Følger eksisterende stil i `Project.status`, `ProjectGroup.category`, `Drawing.status`, `Checklist.status`.

`OrganizationKontekstType` som utvidbar tabell — utelates til konkret behov dukker opp.

### 3.6 Maskin-koblede sjekklister — separat domene ✅

**To parallelle, isolerte sjekkliste-systemer:**

| Type | Modell | Lever i | Mal-bibliotek | Flyt | Status |
|---|---|---|---|---|---|
| Prosjekt-sjekkliste | `Checklist` | `db` | `BibliotekMal` (kategori='prosjekt-sjekkliste') | Faggruppe-flyt | Eksisterer |
| Maskin-sjekkliste | `EquipmentChecklist` | `db-maskin` | `EquipmentChecklistTemplate` (i `db-maskin`) | Enkel: utfører + valgfri godkjenner | Mangler — Fase 1 (sammen med modul-gateway) |

**Cross-package-grense respekteres:** `EquipmentChecklist` referrer til `User.id` som svak String-FK (etablert mønster i db-maskin — se §6).

**UI-skille:** Maskin-sjekklister vises kun under maskinregister (`/dashbord/maskin/[id]/sjekklister`). Prosjekt-sjekklister vises under prosjekt. Firma-admin-dashboard kan ha samlet maler-vy med tabs.

**EquipmentChecklistTemplate.struktur** bruker samme jsonb-felt-format som `ReportTemplate.struktur` for å gjenbruke UI-renderer-komponenter. Detaljer i [maskin.md § Sjekkliste-mal-format](maskin.md).

### 3.7 Mal-arkitektur — utvid eksisterende ✅

**Beslutning:** `BibliotekMal` ER det globale malverket. Ingen ny `SiteDocMalverk`-tabell.

**Utvidelse i Fase 0:**

```prisma
model BibliotekMal {
  // eksisterende felter
  + kategori        String  // 'prosjekt-sjekkliste' | 'maskin-sjekkliste' | 'kontor-sjekkliste' | 'oppgave' | 'hms'
  + domene          String? // 'ns3420' | 'maskin-vedlikehold' | 'kontor' | etc.
  + kobletTilModul  String? // 'maskin' | 'mannskap' | null = kjerne
  + verifisert      Boolean // kvalitetssikret av SiteDoc-team
}
```

**Tre-lags hierarki bevares:**

```
BibliotekMal (globalt SiteDoc-bibliotek)
    ↓ kopier ned via importerMal()
ReportTemplate (prosjekt-instans — kan modifiseres lokalt)
    ↑ promoter opp i Fase 2
OrganizationTemplate (firma-bibliotek — Fase 2)
    ↓ kopier ned
ReportTemplate (annet prosjekt-instans)
```

**Pedagogisk caveat:** Hvis «Malverk» som brand-navn er viktig, bruk `@@map("sitedoc_malverk")` for å bytte fysisk tabellnavn uten å endre modell-strukturen.

### 3.8 Datadrevne kataloger og 3-nivå-onboarding ✅

Lønnsart, tillegg, aktivitet og lignende per-firma-kataloger bygges som tre nivåer:

1. **Lovpålagt grunnpakke** — auto-importeres ved firma-opprettelse via seed-mekanisme (event-hook `onOrganizationCreated`, etablert tom i Fase 0 per C.10, fylles i Fase 3). Ingen bransje-bias.
2. **Bransje-relevant tilleggspakke** — valgfri pakke-import ved onboarding (helhetlig pakke, ikke enkelt-sjekkbokser).
3. **Egendefinerte** — opprettes av kunden via admin-UI. SiteDoc leverer verktøyet, ikke malen.

**Onboarding differensierer to scenarier** (per [timer.md § Onboarding-modi](timer.md)):

- **Nytt firma:** Auto-importerer Nivå 1, tilbyr Nivå 2 som valg.
- **Migrerer fra annet system:** Tom katalog. Import-verktøy aktivert (CSV eller adapter). Forhindrer dobbel-katalog-problem.

Detaljer for lønnsart spesifikt i [timer.md](timer.md). Samme mønster gjenbrukes for andre per-firma-kataloger som introduseres.

### 3.9 Snapshot-pattern ved attestering ✅

Transaksjoner som binder firma-ressurs til prosjekt over tid (timer-rad, maskinbruk, vareforbruk) lagrer snapshot av pris/navn/relevante katalog-felter ved attestering — ikke ved registrering. Garanterer at attesterte rader beholder opprinnelig pris selv om katalogen endres senere. Juridisk relevant for lønn- og fakturagjennomgang.

Detaljer og Zod-schema-spec i [fase-0-beslutninger.md § A.7](fase-0-beslutninger.md). Aktivitetslogg (Activity per A.3) registrerer katalog-endringer separat for full reviderbarhet.

### 3.10 Eksport-kode-policy (NULL → migrering 1:1) ✅

Eksport-koder (lønnsart-kode, tillegg-kode, aktivitet-kode) er nullable i katalog-tabellene. Eksport-modulen validerer ved eksport-tid og kaster tydelig feilmelding hvis kode mangler — gir kunden mulighet til å sette opp katalogen før første eksport.

**Ved migrering kopieres kundens eksisterende koder 1:1** — ingen renumerering. Hvis kunde A har «127 Fakturerbar tid» i sitt nåværende system, beholdes nøyaktig samme kode. Lønns-/økonomi-systemet matcher uten rekonfigurasjon.

Detaljer og tilhørende kontrakter i [fase-0-beslutninger.md § A.15-A.17](fase-0-beslutninger.md): A.15 (eksport interface-kontrakt — `getExportableData()` per modul), A.16 (sentral `EksportertFlagg`-tabell mot duplikat-eksport på tvers av moduler), A.17 (eksport-tilgang ved deaktivert modul: aktiv/arkivert/slettet-tilstander).

---

## 4. Manglende firma-modeller (Fase 0) ✅

| Modell | Formål | Avhengigheter |
|---|---|---|
| `OrganizationSetting` | Tilgangs-defaults og firma-flagg | — |
| `OrganizationPartner` | Faste UE/byggherre/leverandører | — |
| `OrganizationTemplate` | Firma-mal-bibliotek (mal-promotering) | — |
| Firma-HMS-rolle (på User eller egen tabell) | Behandler firma-eide HMS-rapporter | — |

**Modul-aktivering (gateway):** `ProjectModule` eksisterer allerede — utvides med `organizationId` + `status` per A.4/A.17 (3-nivå: aktivert/deaktivert/standalone). Ingen ny `OrganizationModule`-tabell.

**Avdeling:** Egen tabell per C.11, men bygges i Fase 0.5 (sammen med Byggeplass-fundament) — ikke i Fase 0. Se § 5 Fase 0.5.

**`OrganizationKontekstType`** — utelates (besluttet).
**`OrganizationChecklist`** — utsatt til kundeforespørsel (besluttet).

**Rekkefølge internt i Fase 0:**

1. `ProjectModule`-utvidelse (`organizationId` + `status` per A.4/A.17 — gateway) + `OrganizationSetting` (defaults)
2. `OrganizationPartner` (referanse fra Faggruppe)
3. `OrganizationTemplate` (forberedelse til Fase 2 mal-promotering)
4. `Project.primaryOrganizationId String?` (nullable FK)
5. `Psi`-utvidelse (`organizationId`, `projectId` nullable, `kontekstType`)
6. `BibliotekMal`-utvidelse (4 nye felter)
7. `ProjectMember.periodeSlutt`
8. Firma-HMS-rolle (på `User.role` eller egen tabell — designvalg under Fase 0)

> Sannhetskilde for endelig migrasjons-rekkefølge er [fase-0-beslutninger.md § E](fase-0-beslutninger.md). Listen over er logisk gruppering, ikke nummerert utførelses-rekkefølge.

---

## 5. Byggerekkefølge ✅

### Fase 0 — Firma-fundament + tilgangsinfrastruktur

**Migrasjons-rekkefølge:** Sannhetskilde er [fase-0-beslutninger.md § E](fase-0-beslutninger.md) (13-stegs migrasjons-rekkefølge med eksplisitte avhengigheter). Denne syntesen lister ikke datamodell-detaljer — leser § E direkte for korrekt og oppdatert oversikt.

**Infrastruktur:** prosjektProcedure, modulProcedure(slug), refaktor av 9 funksjoner i tilgangskontroll.ts. Detaljer i § E + tilhørende A.-rader.

**Ingen UI-endringer.**

### Fase 0.5 — Byggeplass + Avdeling-fundament

- **To åpne arkitektur-prinsipper besluttes** (default-byggeplass, FK vs jsonb) — fra `byggeplass-strategi.md`. NULL-betydning er **vedtatt A1** per [A.30](fase-0-beslutninger.md): NULL = «gjelder hele prosjektet».
- `ByggeplassMedlemskap` (loan-pattern: User → Byggeplass over tid)
- Drop `building_ids` jsonb fra `project_groups` — erstattes av m2m-koblingstabell
- `Avdeling`-tabell i `packages/db` (kjernen) — firma-intern organisatorisk inndeling, separat dimensjon fra byggeplass (per C.11)
- `User.avdelingId` valgfri (ny kolonne)
- Forbered byggeplassId-felt på fremtidige Timer/Mannskap/Varelager-modeller

**Default-byggeplass-policy (besluttet):** `byggeplassId IS NULL` betyr «hele prosjektet» eller «ikke knyttet til byggeplass» — modellene tolker selv. Ingen tvungen byggeplass ved prosjektopprettelse. Funksjoner som krever byggeplass viser «Opprett byggeplass først».

### Fase 1 — Maskin med modul-gateway (allerede under bygging)

- Refaktor maskin-rutene til `modulProcedure('maskin')` — **må gjøres før prod-deploy**
- `EquipmentChecklist` + `EquipmentChecklistTemplate` i `db-maskin`
- UI for maskin-sjekkliste på maskin-detalj-side
- Manuell trigger fra maskinregister (auto-trigger fra service-varsel utsettes til Fase 7)

### Fase 2 — Mal-promotering

- Utvid `BibliotekMal` med kategori/domene/kobletTilModul/verifisert (gjøres egentlig i Fase 0, men Fase 2 utnytter det)
- `OrganizationTemplate` + `ReportTemplate.organizationTemplateId`
- UI for «Send til firmabibliotek» på prosjekt-mal
- «Start fra firma-mal»-valg ved opprettelse

### Fase 3 — Timer-modul

- Inkluderer **Kompetanseregister** (per beslutning)
- Lønnsarter, arbeidstidskalender, dagsseddel med byggeplassId fra dag 1
- Underprosjekt (Proadm-import eller SiteDoc Godkjenning)
- Reset-status: prototype i `apps/web/src/app/dashbord/[prosjektId]/timer/` slettes når faktisk modul bygges (per CLAUDE.md)

### Fase 4 — PSI-utvidelse (innsjekk/utsjekk + mannskaps-vy)

- PSI utvides med innsjekk/utsjekk-mekanikk (datamodell-design Fase 4)
- Mannskaps-vyen aggregerer PSI-tilstedeværelses-data per byggeplass
- §15-liste-eksport, HMS-kort-validering, geofence-innsjekk
- `eksternSystem`-felt på Psi (SiteDoc eller eksternt system per byggeplass)
- 12t auto-utsjekk

### Fase 5 — Varelager-modul

- Goods, GoodsCategory, GoodsLocation
- Vareforbruk på dagsseddel (kobler til Timer-modul)
- Saldo-håndtering
- Strekkode-skanning (mobil)

### Fase 6 — Avansert

- DO-kobling (Kompetanse ↔ Equipment-validering)
- AI-ukeplan (Timer + Mannskap + Maskin)
- Strekkode-skanning utvidelser

### Fase 7 — Prosjekthotell-utvidelser (parallelt spor)

- Møtemal (ny dokumenttype)
- Månedsrapport (auto-aggregering)
- HMS-statistikk på firma-nivå
- Street View for byggeplass (eget prosjekt)
- **Auto-trigger maskin-sjekkliste fra service-varsel** (forutsetter Varsling-modul)

---

## 6. Cross-schema og asynkron arbeid ✅

### 6.1 Cross-schema-strategi (db-maskin) ✅

`db-maskin`-pakken har eget Prisma-schema (`maskin`) i samme database-instans. Kommunikasjon med `db` skjer via:

- **Svake String-referanser** (uten `@relation`) — `Equipment.ansvarligUserId`, `EquipmentAssignment.userId`/`projectId`/`byggeplassId`, etc.
- **App-lag-oppslag** — `prisma.user.findUnique({ id: someStringRef })` etter behov
- **Ingen cascade-FK på tvers av schemas** — orphan-deteksjon må bygges separat (backlog)

**Konsekvens for nye db-maskin-modeller:** følg samme mønster (svake refs, dokumenter eksplisitt i schema-kommentar).

**Backlog:** Nightly cron som logger orphan-refs for `Equipment.ansvarligUserId`, etc.

### 6.2 Asynkron arbeid — kø-og-job-mønster ✅

SiteDoc håndterer offloaded arbeid (filopplasting, batch-oversettelse, eksterne API-kall med rate-limit) via persisterte køer. Tre kanon-implementasjoner i kodebasen:

| Kø | Persistering | Backoff | Bruk |
|---|---|---|---|
| `OpplastingsKo` | SQLite (mobil) | Eksponentiell, 5 forsøk, maks 30s | Bilde-upload offline-first ([mobil.md](mobil.md)) |
| `FtdTranslationJob` | Prisma (server) | Polling 10s + watchdog 5 min, batch 30 | OPUS-MT/Google Translate/DeepL ([okonomi.md](okonomi.md)) |
| `VegvesenKo` | Prisma (db-maskin, Fase 1) | Prioritets-basert, respekt for 50/t-grense | Kjøretøy-oppslag ([maskin.md](maskin.md)) |

**Felles prinsipper:**
- **Persistering** — status overlever app/server-restart
- **Watchdog** — detekterer rader stuck i `processing` og resetter til `pending`
- **Backoff** — eksponentiell ventetid eller prioritets-rekkefølge, ikke immediate retry
- **Recovery** — krasj-håndtering ved oppstart (`laster_opp` → `venter` for OpplastingsKo)

**Gap:** Direkte API-kall mot SmartDok (kilde-import), Tripletex/Visma/PowerOffice (lønn-eksport), Open-Meteo (vær), Google Translate (sub-system) gjør i dag direct calls uten persistert retry. Hvis nettverk dør midt i Tripletex-eksport må brukeren manuelt re-kjøre.

**Når ny kø trengs:** Bruk én av tre kanon-implementasjoner som mal. Ikke gjenoppfinn mønsteret. Felles abstraksjons-bibliotek vurderes når fjerde uavhengig kø-mekanisme bygges.

**HTTP-rate-limiting** (innkommende, in-memory token-bucket på `/upload`, `/byttToken`, invitasjon-endepunkter) er en separat mekanisme — `apps/api/src/utils/rateLimiter.ts`. Ikke kø-pattern, men nevnes for fullstendighet.

---

## 7. Eksterne integrasjoner ✅

### 7.1 Proadm — designpartner-rolle

Proadm har ikke offentlig REST API. SiteDoc forfølger rolle som designpartner. I mellomtiden:

1. Gjenbruk SmartDok-formatet (preferert)
2. Fil-basert overføring (SFTP/CSV)
3. Direkte SQL (siste utvei)

**Premiss:** All godkjenning skjer i SiteDoc. Proadm mottar kun ferdig godkjente data. Henting av masterdata er enveis Proadm → SiteDoc, 1×/døgn.

### 7.2 SmartDok — referanse, ikke modell

A.Markussens SmartDok-bruk er kartlagt (126 maskiner, 64 varer, 47 brukere, 77 kompetansetyper). **Vi henter samme datapunkter, ikke samme datamodell.** 12 bevisste forskjeller dokumentert i [smartdok-undersokelse.md](smartdok-undersokelse.md).

### 7.3 Tripletex — eksisterende

`BilagsKilde`-adapter eksisterer fra Tromsø Salsaklubb-prosjektet. Gjenbrukes for timer-eksport (lønn) og vareforbruk-eksport (faktura). Tre-lags duplikatbeskyttelse-pattern allerede etablert.

### 7.4 Adapter-mønster (destinasjons- og kilde-systemer) ✅

`BilagsKilde`-mønsteret fra § 7.3 er kanon for alle eksterne integrasjoner. Hver leverandør implementerer enkelt interface (`eksporter()`, `eksporterUtlegg()`, `valider()`) og konfigureres via `OrganizationIntegration`.

**To-dimensjonal klassifisering** (per Kenneth-vedtak 2026-04-29):

- `kategori String` — `"kilde"` | `"destinasjon"` | `"begge"`
- `leverandor String` — `"proadm"` | `"tripletex"` | `"poweroffice"` | `"visma"` | `"unit4"` | `"sap"` | `"hr"` | `"gps"` | `"smartdoc"`

Eksempel-roller: ProAdm/SmartDoc/GPS = kilde, Tripletex/Visma/PowerOffice = destinasjon, HR-system = begge. Hver adapter håndterer egen duplikat-deteksjon via `EksportertFlagg` (per A.16).

GPS-validering (geofence-innsjekk) tilhører Mannskap-modul, ikke Timer — adapter-mønsteret gjenbrukes der med `kategori = "kilde"` for posisjonsdata. Detaljer per leverandør i [timer.md § Eksport](timer.md).

---

## 8. Bakoverkompatibilitet ✅

**Mobil-app i TestFlight kan ikke oppdateres ofte.** Strategi:

- tRPC-alias `entreprise: faggruppeRouter` beholdes som beskyttelse
- Snapshot-felter (`senderEnterpriseName`, `recipientEnterpriseName`) beholdes med engelsk navn
- For nye breaking endringer: oppdater mobil-app → distribuer ny TestFlight → verifisér → så API-endring

---

## 9. Backlog (ikke i Fase 0–6)

### Datamodell
- Periode-felt på `ProjectGroupMember`/`FaggruppeKobling`/`DokumentflytMedlem`
- `OrganizationChecklist` (kontor/verksted-sjekklister) — vurderes ved kundeforespørsel
- `OrganizationKontekstType` (utvidbar enum) — vurderes ved konkret behov
- `DokumentflytEksternMedlem` (token-basert tilgang for eksterne kontrollører)
- `Organization.delete()`-flyt med overføring av prosjekter
- Cross-schema orphan-deteksjon for db-maskin

### Funksjonelt
- Møtemal (ny dokumenttype) — Fase 7
- Månedsrapport (auto-generert) — Fase 7
- HMS-statistikk på firma-nivå — Fase 7
- Street View for byggeplass — eget prosjekt
- Multi-firma-bruker (modellering)
- Mal-versjonering med push-down ved firma-mal-endring
- Advarsel-dialog ved Byggeplass-sletting
- Advarsel-dialog ved modul-deaktivering

---

## 10. Memory-oppdateringer (etter Fase 0-koding)

Følgende memorier skal opprettes/oppdateres når implementeringen i ny chat begynner:

| Memory | Type | Innhold |
|---|---|---|
| `project_arkitektur_syntese` | project | Peker til denne filen |
| `project_kritiske_arkitektur_beslutninger` | project | De 7 mikrobeslutningene |
| `feedback_loan_pattern` | feedback | EquipmentAssignment-mønster som kanon, 3 modeller har gjeld |
| `feedback_modul_gateway` | feedback | 5-trinns autorisasjonsstige + soft-delete-regel |
| `feedback_bibliotekmal_er_malverk` | feedback | Hindrer fremtidige forsøk på ny SiteDocMalverk-tabell |
| `feedback_svake_refs_db_maskin` | feedback | Etablert mønster, dokumenter eksplisitt |
| `project_byggeplan` (eksisterende) | project | Erstatt med peker til §5 i denne filen |

---

## 11. Referanser

- [fase-0-beslutninger.md](fase-0-beslutninger.md) — Anker for koding-sesjon
- [arkitektur-qa-runde-2-2026-04-25.md](../arkiv/arkitektur-qa-runde-2-2026-04-25.md) — Opus' QA-rapport (arkivert 2026-04-28)
- [arkitektur.md § Datamodell-prinsipper](arkitektur.md#datamodell-prinsipper) — To-nivå-modell og loan-pattern (konsolidert 2026-04-27)
- [byggeplass-strategi.md](byggeplass-strategi.md) — Fase 0.5-grunnlag
- [db-naming-audit-2026-04-25.md](db-naming-audit-2026-04-25.md) — Lokal/test/prod-status
- [maskin.md](maskin.md) — Maskin-modul-spesifikasjon
- [timer.md](timer.md) — Timer-modul-spesifikasjon
- [kontrollplan.md](kontrollplan.md) — Kontrollplan + Sjekklistebibliotek
- [mannskap.md](mannskap.md) — Mannskaps-vy + PSI-utvidelser-spesifikasjon
- [smartdok-undersokelse.md](smartdok-undersokelse.md) — A.Markussen-referanse
- [arkitektur-oppsummering-2026-04-25.md](../arkiv/arkitektur-oppsummering-2026-04-25.md) — Faktabasert status (arkivert 2026-04-28)

---

*Sist oppdatert: 2026-04-26*
*Status: Beslutninger låst, men venter på timer-modul-planlegging før Fase 0-koding kan starte. Timer kan medføre justeringer av Fase 0-beslutninger — se [fase-0-beslutninger.md](fase-0-beslutninger.md) § «Forutsetning før koding starter».*
