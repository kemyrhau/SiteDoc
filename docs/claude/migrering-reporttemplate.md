---
status: aktiv
sist_verifisert_mot_kode: 2026-09-04
sist_endret: 2026-09-04
gjelder_versjon: Fase 2
avhenger_av:
  - arkitektur.md
  - fase-0-beslutninger.md
påvirkes_av_beslutninger:
  - A.4
  - E.8
---

# Migrering: ReportTemplate → OrganizationTemplate (planlagt)

Skisse for å innføre firma-bibliotek av maler uten å bryte eksisterende prosjekt-maler. **Delvis implementert 2026-09-04** — se § Status.

## Mål

- Firmaadmin kan promotere prosjekt-mal → firma-bibliotek
- Ny prosjekt-mal kan starte fra firma-mal
- Ingen eksisterende ReportTemplate eller Checklist/Task brytes

## Strategi: tilleggs-modell + valgfri kobling

Vi legger til ny modell og felter — fjerner ikke noe.

### Steg 1 — Ny modell `OrganizationTemplate`

Speiler `ReportTemplate`, men eid av Organization. Egen tabell for objekter.

```prisma
model OrganizationTemplate {
  id              String   @id @default(uuid())
  organizationId  String   @map("organization_id")
  name            String
  description     String?
  prefix          String?
  category        String   @default("sjekkliste")
  domain          String   @default("bygg")
  subjects        Json?    @default("[]")
  showSubject     Boolean  @default(true)
  showFaggruppe   Boolean  @default(true)
  showLocation    Boolean  @default(true)
  showPriority    Boolean  @default(true)
  version         Int      @default(1)
  enableChangeLog Boolean  @default(false)
  kontrollomrade  String?
  promotedFromTemplateId String?  @map("promoted_from_template_id")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  organization    Organization               @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  promotedFrom    ReportTemplate?            @relation("PromotedTemplate", fields: [promotedFromTemplateId], references: [id], onDelete: SetNull)
  objects         OrganizationTemplateObject[]
  copiedTo        ReportTemplate[]           @relation("CopiedFromOrgTemplate")

  @@index([organizationId])
  @@map("organization_templates")
}

model OrganizationTemplateObject {
  // Identisk struktur som ReportObject men FK til OrganizationTemplate
  id            String   @id @default(uuid())
  templateId    String   @map("template_id")
  type          String
  config        Json
  sortOrder     Int      @map("sort_order")
  parentId      String?  @map("parent_id")
  required      Boolean  @default(false)
  translations  Json?
  ...

  template      OrganizationTemplate         @relation(fields: [templateId], references: [id], onDelete: Cascade)
  parent        OrganizationTemplateObject?  @relation("ObjectChildren", fields: [parentId], references: [id])
  children      OrganizationTemplateObject[] @relation("ObjectChildren")

  @@map("organization_template_objects")
}
```

### Steg 2 — Utvid `ReportTemplate` med valgfrie koblings-felter

```prisma
model ReportTemplate {
  // eksisterende felter beholdes uendret
  ...

  // NYE felter:
  organizationTemplateId String?  @map("organization_template_id")
  promotedToFirma        Boolean  @default(false) @map("promoted_to_firma")

  // NYE relasjoner:
  copiedFromOrgTemplate  OrganizationTemplate? @relation("CopiedFromOrgTemplate", fields: [organizationTemplateId], references: [id], onDelete: SetNull)
  promotedTo             OrganizationTemplate[] @relation("PromotedTemplate")
}
```

`organizationTemplateId` peker oppover hvis prosjekt-malen ble kopiert fra firma-mal. `promotedToFirma` markerer at denne prosjekt-malen er sendt opp.

### Steg 3 — Ingen datamigrering nødvendig

Eksisterende ReportTemplate-rader er fortsatt gyldige. Nye felter er valgfrie. Ingen INSERT/UPDATE/DELETE av eksisterende data.

## API-utvidelser (`mal.ts`-ruter)

| Ny rute | Beskrivelse |
|---|---|
| `firmamal.list` | Liste firma-maler for en organisasjon |
| `firmamal.hent` | Hent én firma-mal med objekter |
| `firmamal.opprett` | Opprett tom firma-mal direkte |
| `firmamal.promoter` | Kopierer ReportTemplate → ny OrganizationTemplate (firmaadmin-only) |
| `firmamal.kopierTilProsjekt` | Kopierer OrganizationTemplate → ny ReportTemplate i prosjekt |

Tilgangskontroll: `firmamal.*` krever `User.role = "company_admin"` eller `"sitedoc_admin"`.

## UI-konsekvenser

### Malbygger (eksisterende side)

- Ny knapp øverst (kun firmaadmin): **«Send til firmabibliotek»** → kaller `firmamal.promoter`
- Etter promotering: vis badge «I firmabibliotek» på malen
- Hvis malen kommer fra firmabibliotek: vis badge «Basert på firma-mal: [navn]»

### Ny mal-dialog (eksisterende «Ny mal»)

Tre valg ved opprettelse:
1. **Tom mal** — som idag
2. **Start fra firma-mal** — dropdown av OrganizationTemplate (kun de som matcher dokumenttype)
3. **Start fra globalt bibliotek (NS 3420 etc.)** — eksisterende ProsjektBibliotekValg-flyt

### Ny side: Firma-malbibliotek

`/oppsett/firma/maler` — admin-side for firmaadmin:
- Liste over OrganizationTemplate
- Filter på kategori (sjekkliste/oppgave/godkjenning/timeregistrering)
- Klikk → åpner samme malbygger-komponent, men i «firma-modus» (lagrer som OrganizationTemplate)
- Slett-handling med advarsel om at prosjekt-instanser ikke påvirkes

## Mal-versjonering ved oppdatering av firma-mal

Når en firma-mal oppdateres, skal eksisterende `ReportTemplate`-rader (kopiert fra firma-malen) vise en advarsel om at mal-versjonen er bak. Bruker bekrefter manuell oppdatering — automatisk overskriving er ikke ønsket.

**Schema-utvidelse av `ReportTemplate`:**
```prisma
model ReportTemplate {
  // ... eksisterende felter
  organizationTemplateId String? @map("organization_template_id")  // peker til firma-master
  bibliotekMalId         String? @map("bibliotek_mal_id")           // peker til SiteDoc-master
  versjonAvHovedmal      Int     @default(1) @map("versjon_av_hovedmal")
}
```

**UI-flyt:**
- Når `BibliotekMal.versjon > ReportTemplate.versjonAvHovedmal` (eller tilsvarende sjekk mot `OrganizationTemplate`): vis badge «X versjoner bak» på mal-raden
- «Oppdater»-knapp ved siden av — manuell handling, ikke automatisk
- Klikk på Oppdater: hvis prosjekt-mal er endret lokalt etter kopi, vis diff og kreve bekreftelse av merge (backlog-detalj)

**Edge case (backlog):** Lokal redigering etter kopi → diff-visning + merge-bekreftelse. Implementeres når use-case oppstår.

**Kilde:** Identifisert i Opus QA-runde 2 (2026-04-25), §6.3 Q2 — konsolidert hit 2026-04-28.

## Konflikt-regel: én mal-rad ikke samtidig i Kontrollplan + Dokumentflyt

`ReportTemplate.id` kan i dag teoretisk brukes av både `KontrollplanPunkt` og `DokumentflytMal` samtidig. Audit 2026-04-25 fant 0 slike kollisjoner i lokal-DB, men strukturelt er det mulig.

**Risiko:** Kontrollplan og Dokumentflyt har ulike forventninger til mal (felt-typer, status-overganger, signatur-mønster). Delt bruk kan gi inkonsistent UI og uventet oppførsel ved oppdatering.

**Tiltak — beslutning kreves FØR mal-promotering implementeres:**

1. **Constraint-alternativ:** Legg til check at en gitt `ReportTemplate.id` kun brukes av én av `KontrollplanPunkt` eller `DokumentflytMal` (ikke begge)
2. **Kategori-alternativ:** Bruk `BibliotekMal.kategori`-feltet (per A.4 / § E steg 8) til å skille — kontrollplan-maler vs dokumentflyt-maler er separate kategorier som ikke kan brukes på tvers
3. **Aksepter delt-bruk:** Definér eksplisitt UI-håndtering når én mal er begge

**Anbefaling (ikke besluttet):** Alternativ 2 — kategori-felt løser problemet på datamodell-nivå når mal-promotering bygges (Fase 2).

**Verifisering før implementering:** Audit i prod-DB om noen mal-rad faktisk er i delt bruk i dag (per audit «Spørsmål som ikke kan besvares» fra 2026-04-25 — krever read-only psql-tilgang og godkjenning).

**Kilde:** Identifisert i datamodell-audit 2026-04-25, Hull 3 — konsolidert hit 2026-04-28. Også referert fra [db-opprydning.md § 2.3](db-opprydning.md).

## Bakoverkompatibilitet

- Eksisterende ReportTemplate-rader fungerer som før
- Ingen kobling kreves — `organizationTemplateId` er nullable
- Mobil-app: ingen endring (ser kun prosjekt-instanser via Checklist/Task)
- Eksisterende API-ruter (`mal.*`) endres ikke — kun nye `firmamal.*` legges til

## Risiko og åpne spørsmål

1. **Versjonering** — hva skjer hvis firma-mal endres etter at prosjekt-instanser er kopiert? Idag: ingen sync. Forslag: legg til knapp «Oppdater til siste firma-versjon» på prosjekt-instans (manuell trigger)
2. **Sletting av firma-mal** — påvirker ikke eksisterende kopier, men `organizationTemplateId` på ReportTemplate blir SetNull. Bør vi vise «Forrige firma-mal slettet»?
3. **Tilgangskontroll for kopiering** — kan alle prosjektadmin kopiere fra firma-mal, eller kun firmaadmin? Anbefaling: alle prosjektadmin kan kopiere ned (det er bare gjenbruk), men kun firmaadmin kan promotere opp eller redigere firma-mal
4. **DokumentflytMal** — eksisterende mal-mal-modell. Skal også støtte firma-promotering? Sannsynligvis ja, men i senere fase
5. **Translations** — firma-mal må også støtte i18n. Bør kopieres ned ved kopiering

## Implementasjonsrekkefølge når dette skal bygges

1. Prisma-modell + migrering (kun additivt)
2. `firmamal.*` tRPC-ruter
3. `Firma-malbibliotek`-siden (ny)
4. Promote-knapp i eksisterende malbygger
5. «Start fra firma-mal»-valg i ny-mal-dialog
6. Versjonering / oppdater-knapp (Fase 2)

## Status

**Delvis implementert (AM4 bolk 1, 2026-09-04).** Bygget på branch `feat/firma-malarkiv`:

- **Additiv migrering** `20260904120000_malarkiv_hms_kolonner` (kun ADD COLUMN, to-stegs-policy): `organization_templates.subdomain` + `hms_synlighet` (B3/L4 HMS), `standard_for_nye_prosjekter` (F4-seeding-flagg), `laant_fra_bibliotek_mal_id` (B4 — strukturert avstamning til `BibliotekMal`, FK SetNull), `report_templates.versjon_av_hovedmal` (L6 manuell versjonering). Speiler `packages/db/prisma/schema.prisma:1038`/`:973-974`.
- **`firmamal.*` tRPC-ruter** (`apps/api/src/routes/firmamal.ts`, registrert `trpc/router.ts`): `list`/`hent`/`opprett`/`oppdater`/`slett` (firma-admin per L7), `promoter` (ReportTemplate→OrganizationTemplate m/objekter+translations, to-pass parentId), `kopierTilProsjekt` (motsatt vei, setter `organizationTemplateId`-avstamning + `versjonAvHovedmal`, L5/L6), `laanFraSentralarkiv` (BibliotekMal→OrganizationTemplate, L3 — setter strukturert peker `laantFraBibliotekMalId` per B4, ikke fritekst i description). `config`/`config.zone` kopieres verbatim (MALBYGGER.md zone-regel).

**AM4 bolk 2 UI (2026-09-04, branch `feat/firma-malarkiv-ui`).** Bygget på develop `ca83c9a2`:

- **Steg 2 — firma-arkivsiden** `apps/web/src/app/dashbord/firma/malarkiv/page.tsx` (amber FIRMA-sone, ikke `/oppsett/firma/*` — den ga prosjekt-sone; rute-avvik gatet av Kenneth). Tre faner (L9), tabell m/versjon + bruk-teller (`_count.copiedTo`) + «Standard for nye»-toggle + «Lån fra SiteDoc-arkivet» + «+ Ny firmamal». Nav: `firma-nav.tsx` + `firma/layout.tsx`. «Rediger» = metadata (påkoblingspunkt for firma-modus).
- **Steg 3 — promotering i MalBygger** (`MalBygger.tsx`): «Send til firmaarkiv» (gatet på ny `firmamal.kanPromotere`), badges «I firmaarkivet»/«Basert på firmamal … (X versjoner bak)», «Oppdater» (L6, ny `firmamal.oppdaterKopiFraHovedmal` — full erstatning, ikke diff/merge). `mal.hentMedId` utvidet m/ `copiedFromOrgTemplate {name, version}`.
- **Steg 4 — ny-mal-dialog** (`MalListe.tsx`): «Fra firmaarkivet» aktivert (ny `firmamal.listeForProsjekt` prosjektadmin-gatet + `kopierTilProsjekt`). L2-badge «Fra firmaarkivet» + «Erstatter standardmal {prefix}» (avledet mot `PROSJEKT_MODULER`-prefikser).
- **Steg 5 — seeding** i `modul.aktiver`: flaggede firmamaler seedes FØR standardmal-løkken, (category,domain)-matchet mot modulens fotavtrykk; L1 (firmamal vinner) faller ut av idempotent prefix-sjekk; idempotent på (organizationTemplateId, prefix). De syv inventar-linjene bevart additivt. Reell `prosjekt.opprett` seeder ingen prosjektmaler → seeding-hooken hører i `aktiver` alene; `opprettTestprosjekt` urørt (oppfølger).

**🔴 L2-nyanse (til fabel-gate):** «Erstatter standardmal»-badgen er BEREGNET ved visning mot `PROSJEKT_MODULER`, ikke et lagret seeding-resultat — fjernes standarden fra `PROSJEKT_MODULER` forsvinner badgen.

**Gjenstår:** L8 full firma-modus i MalBygger (direkte innholds-redigering av firmamal) — **egen branch `feat/malbygger-firmamodus`** (Kenneth-vedtak: egen gate; default MÅ være uendret prod-oppførsel).

Beskrevet i [arkitektur.md § Datamodell-prinsipper](arkitektur.md#datamodell-prinsipper).
