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
| KS-dokumentasjon (Sjekkliste, Oppgave, Kontrollplan, Godkjenning) | Eksisterer |
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
- Mannskap og PSI slått sammen (PSI valgfri innenfor)
- Maskin-modul inkluderer EquipmentChecklist (separat fra prosjekt-sjekkliste)

### 1.3 Firma-instillinger (ikke moduler) ✅

| Instilling | Datatype | Default |
|---|---|---|
| Avdelinger på/av | boolean | false |
| Timer-tilgang default | enum (String) | 'alle-ansatte' |
| Vareforbruk-tilgang default | enum (String) | 'alle-ansatte' |
| Maskinbruk-tilgang default | enum (String) | 'sertifiserte' |

Lagres på `OrganizationSetting` som nøkkel-verdi-par.

### 1.4 Eksempler på firma-konfigurasjon

**Firma A — kun prosjekthotell:** ingen tilleggsmoduler. Bruker SiteDoc til dokumentflyt, kontrollplan, HMS, tegninger. Bruker eget timeregistreringssystem.

**Firma B (A.Markussen):** Timer, Maskin, Mannskap/PSI, Proadm-eksport. Senere Varelager, DO-kobling, AI-ukeplan. Erstatter SmartDok fullstendig.

**Firma C — kun timer (edge case):** Timer + Tripletex-eksport. Mulig, men ikke prioritert kundesegment.

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

Steg 2 er **gateway** (`OrganizationModule`), steg 3-5 er **hierarki**.

**Implementeres som tRPC procedure-wrappers i Fase 0:**
- `prosjektProcedure` (auth + scope-sjekk)
- `modulProcedure(slug)` (auth + sjekk `OrganizationModule.active` for prosjektets primaryOrg)

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
| Multi-firma-bruker | Ikke prioritert — duplikat User per firma som default |
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

**HMS-rapport (Psi)** får firma-kontekst i Fase 0:

```
Psi
├── organizationId (required, NEW)         — alltid firma som eier
├── projectId? (nullable, ENDRET fra required)
├── byggeplassId? (uendret)
├── kontekstType String @default("prosjekt") (NEW)
│   // 'prosjekt' | 'byggeplass' | 'kontor' | 'verksted' | 'firmabil' | 'annet'
└── eksisterende felter
```

**Maskin-vedlikeholds-sjekklister** lever som separat domene i `db-maskin` (se §3.6).

**Kontor/verksted-sjekklister utenfor HMS-rapport-modellen** ⏸️ — ikke i Fase 0. Vurderes hvis kunde etterspør.

### 3.5 kontekstType — etablert mønster ✅

`String` med default-verdi og kommentar-enum. Følger eksisterende stil i `Project.status`, `ProjectGroup.category`, `Drawing.status`, `Checklist.status`.

`OrganizationKontekstType` som utvidbar tabell — utelates til konkret behov dukker opp.

### 3.6 Maskin-koblede sjekklister — separat domene ✅

**To parallelle, isolerte sjekkliste-systemer:**

| Type | Modell | Lever i | Mal-bibliotek | Flyt |
|---|---|---|---|---|
| Prosjekt-sjekkliste | `Checklist` | `db` | `BibliotekMal` (kategori='prosjekt-sjekkliste') | Faggruppe-flyt |
| Maskin-sjekkliste | `EquipmentChecklist` | `db-maskin` | `EquipmentChecklistTemplate` (i `db-maskin`) | Enkel: utfører + valgfri godkjenner |

**Cross-package-grense respekteres:** `EquipmentChecklist` referrer til `User.id` som svak String-FK (etablert mønster i db-maskin — se §6).

**UI-skille:** Maskin-sjekklister vises kun under maskinregister (`/dashbord/maskin/[id]/sjekklister`). Prosjekt-sjekklister vises under prosjekt. Firma-admin-dashboard kan ha samlet maler-vy med tabs.

**EquipmentChecklistTemplate.struktur** bruker samme jsonb-felt-format som `ReportTemplate.struktur` for å gjenbruke UI-renderer-komponenter.

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

---

## 4. Manglende firma-modeller (Fase 0) ✅

| Modell | Formål | Avhengigheter |
|---|---|---|
| `OrganizationModule` | Modul-aktivering per firma (gateway) | — |
| `OrganizationSetting` | Tilgangs-defaults og firma-flagg | — |
| `OrganizationPartner` | Faste UE/byggherre/leverandører | — |
| `Avdeling` (valgfri via flagg) | Intern struktur for større firma | OrganizationSetting |
| `OrganizationTemplate` | Firma-mal-bibliotek (mal-promotering) | — |
| Firma-HMS-rolle (på User eller egen tabell) | Behandler firma-eide HMS-rapporter | — |

**`OrganizationKontekstType`** — utelates (besluttet).
**`OrganizationChecklist`** — utsatt til kundeforespørsel (besluttet).

**Rekkefølge internt i Fase 0:**

1. `OrganizationModule` + `OrganizationSetting` (gateway og defaults)
2. `OrganizationPartner` (referanse fra Faggruppe)
3. `Avdeling`-flagg
4. `OrganizationTemplate` (forberedelse til Fase 2 mal-promotering)
5. `Project.primaryOrganizationId String?` (nullable FK)
6. `Psi`-utvidelse (`organizationId`, `projectId` nullable, `kontekstType`)
7. `BibliotekMal`-utvidelse (4 nye felter)
8. `ProjectMember.periodeSlutt`
9. Firma-HMS-rolle (på `User.role` eller egen tabell — designvalg under Fase 0)

---

## 5. Byggerekkefølge ✅

### Fase 0 — Firma-fundament + tilgangsinfrastruktur

Detaljer i [fase-0-beslutninger.md](fase-0-beslutninger.md) §«Implementeringsrekkefølge i Fase 0».

**Datamodell:** OrganizationModule, OrganizationSetting, OrganizationPartner, Avdeling-flagg, OrganizationTemplate, Project.primaryOrganizationId nullable, Psi-utvidelse, BibliotekMal-utvidelse, ProjectMember med periode.

**Infrastruktur:** prosjektProcedure, modulProcedure(slug), refaktor av 9 funksjoner i tilgangskontroll.ts.

**Ingen UI-endringer.**

### Fase 0.5 — Byggeplass-fundament

- **Tre åpne arkitektur-prinsipper besluttes** (NULL-betydning, default-byggeplass, FK vs jsonb) — fra `byggeplass-strategi.md`
- `ByggeplassMedlemskap` (loan-pattern: User → Byggeplass over tid)
- Drop `building_ids` jsonb fra `project_groups` — erstattes av m2m-koblingstabell
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

### Fase 4 — Mannskap/PSI-modul

- §15-liste, HMS-kort, geofence-innsjekk
- PSI som valgfri per byggeplass
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

## 6. Cross-schema-strategi (db-maskin) ✅

`db-maskin`-pakken har eget Prisma-schema (`maskin`) i samme database-instans. Kommunikasjon med `db` skjer via:

- **Svake String-referanser** (uten `@relation`) — `Equipment.ansvarligUserId`, `EquipmentAssignment.userId`/`projectId`/`byggeplassId`, etc.
- **App-lag-oppslag** — `prisma.user.findUnique({ id: someStringRef })` etter behov
- **Ingen cascade-FK på tvers av schemas** — orphan-deteksjon må bygges separat (backlog)

**Konsekvens for nye db-maskin-modeller:** følg samme mønster (svake refs, dokumenter eksplisitt i schema-kommentar).

**Backlog:** Nightly cron som logger orphan-refs for `Equipment.ansvarligUserId`, etc.

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
- [arkitektur-qa-runde-2-2026-04-25.md](arkitektur-qa-runde-2-2026-04-25.md) — Opus' QA-rapport
- [arkitektur.md § Datamodell-prinsipper](arkitektur.md#datamodell-prinsipper) — To-nivå-modell og loan-pattern (konsolidert 2026-04-27)
- [byggeplass-strategi.md](byggeplass-strategi.md) — Fase 0.5-grunnlag
- [db-naming-audit-2026-04-25.md](db-naming-audit-2026-04-25.md) — Lokal/test/prod-status
- [maskin.md](maskin.md) — Maskin-modul-spesifikasjon
- [timer.md](timer.md) — Timer-modul-spesifikasjon
- [kontrollplan.md](kontrollplan.md) — Kontrollplan + Sjekklistebibliotek
- [mannskap.md](mannskap.md) — Mannskap/PSI-spesifikasjon
- [smartdok-undersokelse.md](smartdok-undersokelse.md) — A.Markussen-referanse
- [arkitektur-oppsummering-2026-04-25.md](arkitektur-oppsummering-2026-04-25.md) — Faktabasert status

---

*Sist oppdatert: 2026-04-26*
*Status: Beslutninger låst, men venter på timer-modul-planlegging før Fase 0-koding kan starte. Timer kan medføre justeringer av Fase 0-beslutninger — se [fase-0-beslutninger.md](fase-0-beslutninger.md) § «Forutsetning før koding starter».*
