# Migrering: ReportTemplate → OrganizationTemplate (planlagt)

Skisse for å innføre firma-bibliotek av maler uten å bryte eksisterende prosjekt-maler. Ikke implementert.

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

Planlagt — ikke implementert. Beskrevet i [arkitektur.md § Datamodell-prinsipper](arkitektur.md#datamodell-prinsipper).
