# Fase 0-beslutninger — komplett (oppdatert 2026-04-26)

**Status:** 🟡 23 beslutninger vedtatt (§A) + 5 åpne BLOKKERER (§B; B.2 lukket etter at § E ble rettet) + 12 anbefalte utvidelser (§C; hvorav C.8 og C.9 lukket — innarbeidet i A.3/A.6, og ny C.12 lagt til 2026-04-27) etter tre runder Opus-stresstesting + Kenneth-justeringer + verifiseringsrunde 2026-04-27 (A.13 reklassifisert til B.6 etter kode-verifisering). Avventer Kenneth-svar på 5 blokkerende inkonsistenser før Fase 0-koding kan starte.

**Bruk:** Anker for ny Code-chat. Neste Code-instans skal lese denne filen + lenker under FØR koding.

**Lesing før koding starter:**
1. Denne filen (beslutninger + åpne spørsmål)
2. [arkitektur-syntese.md](arkitektur-syntese.md) — helhetlig produktarkitektur
3. [smartdok-undersokelse.md](smartdok-undersokelse.md) — empirisk grunnlag fra A.Markussen
4. [datamodell-arkitektur.md](datamodell-arkitektur.md) — to-nivå-modell og loan-pattern
5. [timer.md](timer.md) — timer-modul-spesifikasjon (krever refaktor jf. C.1 + organizationId-rename)

> ⚠️ **Til neste Code-instans:** IKKE start Fase 0-koding før Kenneth har lukket de 5 åpne BLOKKERER-spørsmålene i § B (B.1, B.3, B.4, B.5, B.6). Hvis spørsmålene ser besluttet ut, sjekk denne filens commit-historikk for siste oppdatering.

---

## A. Vedtatte beslutninger (23)

### A.1 ExternalCostObject — felles kostnadsbærer-referanse

Ny tabell i `packages/db` (kjernen). Felles referansepunkt for ProAdm-underprosjekter. Refereres av Timer-modul og Godkjenning-dokumentflyt.

```prisma
model ExternalCostObject {
  id                    String   @id @default(uuid())
  organizationId        String   @map("organization_id")
  projectId             String   @map("project_id")

  proAdmId              String   @map("proadm_id")
  proAdmIdAtImport      String?  @map("proadm_id_at_import")

  kortNavn              String   @map("kort_navn")
  kilde                 String   // "proadm_import" | "manuell" | "felt_opprettet"
  kildeId               String?  @map("kilde_id")

  status                String   @default("aktiv")  // "aktiv" | "lukket"
  timerregistreringApen Boolean  @default(false) @map("timerregistrering_apen")

  opprettetAvUserId     String   @map("opprettet_av_user_id")
  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")

  @@unique([organizationId, proAdmId])
  @@index([projectId, status])
  @@map("external_cost_objects")
}
```

**Egenskaper:**
- Lever i kjernen — referert av flere moduler
- Har INGEN GPS, HMS-ansvarlig, kortleser, HMSREG (avklart i runde 2 — det var feilframing)
- `proAdmId` vises i UI; UUID brukes i alle FK-er
- Tre opprettelses-kilder: import fra ProAdm, manuell, felt-opprettet

**Terminologi — bransje-naturlig i UI, presis i kode:**
- **UI / dokumentasjon mot bruker:** «Underprosjekt» (anleggsbransjens etablerte begrep, brukt av A.Markussen og SmartDok)
- **Prisma-modell / kode / DB-tabell:** `ExternalCostObject` / `external_cost_objects` (presist navn — beskriver teknisk rolle som ekstern kostnadsbærer-referanse)
- **Variabelnavn i kode:** `externalCostObjectId`, `eco`, `externalCostObject`
- **Dropdown-label i timer-skjema mobil:** «Underprosjekt» (ikke «ECO» eller «External cost object»)
- Samme mønster som `proAdmId` (UI-vennlig referanse) vs UUID (FK-feltet)

> ⚠️ **Åpen B-spørsmål:** `timerregistreringApen` default `false` er omdiskutert. Mangler også `lukketAvUserId` + soft-delete. Se § B.1, B.6, B.7.

### A.2 Godkjenning — utvidet dokumentflyt-type

Ny modell i `packages/db`. Følger Checklist/Task/Psi-mønsteret (samme felter `bestillerFaggruppeId`/`utforerFaggruppeId`/`status`/`dokumentflytId`).

```prisma
model Godkjenning {
  id                    String    @id @default(uuid())
  templateId            String?   @map("template_id")
  projectId             String    @map("project_id")
  bestillerUserId       String    @map("bestiller_user_id")
  bestillerFaggruppeId  String    @map("bestiller_faggruppe_id")
  utforerFaggruppeId    String    @map("utforer_faggruppe_id")
  eierUserId            String?   @map("eier_user_id")
  status                String    @default("draft")
  dokumentflytId        String?   @map("dokumentflyt_id")

  externalCostObjectId  String?   @map("external_cost_object_id")
  internRef             String?   @map("intern_ref")
  byggherreRef          String?   @map("byggherre_ref")
  kortNavn              String    @map("kort_navn")

  godkjentVed           DateTime? @map("godkjent_ved")
  godkjentAvUserId      String?   @map("godkjent_av_user_id")

  createdAt             DateTime  @default(now()) @map("created_at")
  updatedAt             DateTime  @updatedAt @map("updated_at")

  @@unique([projectId, internRef])
  @@map("godkjenninger")
}
```

**Kostnads-historikk via DocumentTransfer** (ikke egen sub-tabell):
DocumentTransfer-mønsteret eksisterer (linje 603) og utvides med `kostnadSnapshot Json?`. Hver send/retur/godkjenning skaper en DocumentTransfer-rad med snapshot. Hele forhandlingshistorikken bevares automatisk.

**DocumentTransfer må også utvides** med `godkjenningId String?` for å gjenbruke transfer-mekanismen for Godkjenning (i dag støtter den kun Checklist+Task).

> ⚠️ **Åpen B-spørsmål:** `endretEtterSending`-felt er nevnt i I.1 men mangler i Prisma-modellen. Manglende «aktiv versjon»-pointer. Indeks-svakheter. Se § B.3, B.8, B.9.

### A.3 Activity — sentral audit-tabell

Ny tabell i `packages/db`. Per-modell-logger (ChecklistChangeLog, KontrollplanHistorikk) beholdes — Activity er for **action-events**, ikke felt-nivå-diff.

```prisma
model Activity {
  id                String   @id @default(cuid())
  actorUserId       String?  @map("actor_user_id")
  actorNavnSnapshot String?  @map("actor_navn_snapshot")
  organizationId    String?  @map("organization_id")
  projectId         String?  @map("project_id")
  targetType        String   @map("target_type")
  targetId          String   @map("target_id")
  action            String
  payload           Json?
  ipAddress         String?  @map("ip_address")
  userAgent         String?  @map("user_agent")
  createdAt         DateTime @default(now()) @map("created_at")

  retainedUntil     DateTime? @map("retained_until")
  anonymizedAt      DateTime? @map("anonymized_at")

  @@index([organizationId, createdAt])
  @@index([projectId, createdAt])
  @@index([actorUserId, createdAt])
  @@index([targetType, targetId])
  @@index([targetType, action, createdAt])
  @@map("activity_log")
}
```

**GDPR-strategi:**
- `actorUserId` bevares (ingen FK-relation), `actorNavnSnapshot` settes ved opprettelse
- Ved User-anonymisering: `actorNavnSnapshot = "[anonymisert]"`, `anonymizedAt = NOW()`. `actorUserId` beholdes for audit-spor (kan ikke knyttes til person uten User-rad)
- `retainedUntil` differensieres per type:
  - **Lønnsdata (timer, attestering):** `endOfYear(handling) + 5 år` (skattelov § 5-12)
  - **Fakturagrunnlag (Godkjenning, eksport):** `endOfYear(handling) + 10 år` (bokføringsloven § 13)
  - **UI-handlinger (visninger, navigasjon):** 90 dager
  - **IP-adresse:** 30 dager (separat retention selv om handling beholdes)
  - **Signering (juridisk):** aldri
- `payload Json?` valideres mot Zod-schema per `targetType + action`-kombinasjon, lagret i `packages/shared/src/audit-schemas/`
- Cron-job sletter rader hvor `retainedUntil < NOW()` (utenfor Fase 0)

### A.4 ProjectModule → utvidelse, ikke ny tabell

`ProjectModule` eksisterer allerede (linje 752, brukt 30+ steder i kodebasen). Utvides med `organizationId` for å støtte cross-org-modul-aktivering. **Samtidig: `active Boolean` deprecates til fordel for `status String` per A.17 (3-nivå: `aktiv`/`arkivert`/`slettet`).**

**Steg 1 (uke 1) — bakfyll fra primary org + status-konvertering:**
```sql
ALTER TABLE project_modules ADD COLUMN organization_id UUID NULL;
ALTER TABLE project_modules ADD COLUMN status TEXT NULL DEFAULT 'aktiv';

-- Bakfyll organizationId fra primary org
UPDATE project_modules pm
SET organization_id = p.primary_organization_id
FROM projects p WHERE pm.project_id = p.id;

-- Konverter active Boolean til status
UPDATE project_modules SET status = CASE WHEN active = true THEN 'aktiv' ELSE 'arkivert' END;
```

**Steg 2 (neste release etter all kode er oppdatert):**
```sql
DROP INDEX project_modules_project_id_module_slug_key;
CREATE UNIQUE INDEX ON project_modules (project_id, organization_id, module_slug);
ALTER TABLE project_modules DROP COLUMN active;
ALTER TABLE project_modules ALTER COLUMN status SET NOT NULL;
-- ALTER TABLE project_modules ALTER COLUMN organization_id SET NOT NULL;
-- ⚠️ NOT NULL avhenger av B.4: standalone-prosjekt-håndtering
```

**Hvorfor Alt B (utvidelse) og ikke Alt C (separat tabell):**
- Én tabell — konsistent med rest av modellen som bruker organizationId overalt
- Fall-back-logikk forenkles
- Klar slutt-tilstand, ingen evigvarende to-tabell-løsning

**Konsekvens:** 30+ kode-steder må oppdateres med organizationId i where-klausul. Verifiserte forekomster:
- `apps/api/src/routes/oppgave.ts:618-619`, `mappe.ts:589-590`, `modul.ts` (full router)
- `apps/web/src/components/layout/HovedSidebar.tsx:189`
- `apps/web/src/app/dashbord/oppsett/produksjon/moduler/page.tsx`
- `apps/web/src/app/dashbord/oppsett/layout.tsx:113`

**CI-sjekk mellom steg 1 og 2** (se § C.5):
```bash
grep -rn "projectId_moduleSlug" apps/ packages/ | wc -l  # må være 0
```

> ⚠️ **Åpen B-spørsmål:** Standalone-prosjekt med `primaryOrganizationId IS NULL` får `organization_id = NULL` i bakfyll. Steg 2 NOT NULL bryter da. Se § B.4.

### A.5 OrganizationProject → ProjectOrganization med rolle

Rename eksisterende `OrganizationProject` (linje 84, eksisterende m:n med kun `id`/`organizationId`/`projectId`/`createdAt` og bidireksjonale relasjoner) til `ProjectOrganization` og utvid med `rolle`-felt.

```prisma
model ProjectOrganization {
  id              String   @id @default(uuid())
  projectId       String   @map("project_id")
  organizationId  String   @map("organization_id")
  rolle           String   // "hovedeier" | "byggherre" | "konsulent" | "underentreprenor"
  createdAt       DateTime @default(now()) @map("created_at")

  @@unique([projectId, organizationId])
  @@map("project_organizations")
}
```

**Migrering:** Alle eksisterende rader får `rolle = "hovedeier"` som default.

**OBS — tabell-rename-vurdering:** Mindre invasivt alternativ er å beholde tabellnavn `organization_projects` i `@@map` og kun rename Prisma-modellen. Avgjøres av Kenneth (se § B.10 — ikke blokkerende).

### A.6 EquipmentAnsvarlig — m:n i stedet for ansvarligUserId

Ny m:n-tabell i `packages/db-maskin`. Eksisterende `Equipment.ansvarligUserId` migreres og fjernes.

```prisma
model EquipmentAnsvarlig {
  id            String    @id @default(uuid())
  equipmentId   String    @map("equipment_id")
  userId        String    @map("user_id")
  rolle         String    @default("primary")  // "primary" | "secondary" | annet
  periodeStart  DateTime  @default(now()) @map("periode_start")
  periodeSlutt  DateTime? @map("periode_slutt")
  createdAt     DateTime  @default(now()) @map("created_at")

  @@unique([equipmentId, userId, periodeStart])
  @@map("equipment_ansvarlige")
  @@schema("maskin")
}
```

**Periode-felter** lagt til for konsistens med loan-pattern (B.1 fra opprinnelig Fase 0). Migrering bevarer historikk: `periodeStart = Equipment.createdAt`.

### A.7 Hybrid logg + snapshot ved attestering

Ikke ren snapshot, ikke ren logg. Beste praksis fra regnskapssystemer:

**1. Logg på Lonnsart** (Source of Truth med historikk):
- Pris-endringer på Lonnsart skaper Activity-rader automatisk via Prisma middleware (`prisma.$extends` for v5+; `$use` for v4)
- Activity-loggen fanger hvem-endret-hva-når

**2. Snapshot ved attestering** på Timer:
```prisma
model TimerRegistrering {
  // ...
  attesteringStatus    String    @default("ikke_attestert")
  attestertAvUserId    String?
  attestertVed         DateTime?
  attestertSnapshot    Json?     // settes ved attestering, ikke ved registrering
}
```

`attestertSnapshot` valideres mot Zod-schema:
```typescript
// packages/shared/src/audit-schemas/timer.ts
export const AttestertSnapshotSchema = z.object({
  snapshotVersjon: z.number().int().default(1),
  lonnsartId: z.string().uuid(),
  lonnsartKode: z.string(),
  lonnsartNavn: z.string(),
  prisMotKunde: z.number().nonnegative(),
  internkostnad: z.number().nonnegative(),
  dagsnorm: z.number().positive(),
  otTerskel: z.number().positive(),
  valuta: z.literal("NOK"),
});
```

**Hvorfor attestering er låsepunktet:**
- Ansatt kan korrigere flere ganger før attestering — uavhengig av pris-endringer
- Attestering er juridisk relevant: da godkjennes for lønn/fakturering
- Pris-endring etter attestering rører ikke ferdige rader

**Samme mønster for andre transaksjoner:**
- `EquipmentAssignment.attestertSnapshot` (maskin-pris ved attestering)
- `Vareforbruk.attestertSnapshot` (enhetspris ved attestering, Fase 5)

### A.8 Attestering vs Godkjenning — ufravikelig terminologi

Låst i CLAUDE.md som ufravikelig terminologi-regel.

| Konsept | Hva det betyr | Domene |
|---------|---------------|--------|
| **Attestering** | Arbeider får lønn for registrert tid | Timer-modul |
| **Godkjenning** | Entreprenør kan fakturere mot byggherre | Dokumentflyt |

Bransje-naturlig (A.Markussens timer-rutiner bruker "attestere"). Konsistent i kode, UI, hjelpetekst, dokumentasjon.

**Konsekvens for kodebasen** (verifisert i runde 2):
- Forurenset i timer-prototypen + 14 språkfiler (omfang dokumentert)
- Mest kritiske: `apps/web/src/app/dashbord/[prosjektId]/timer/page.tsx` (linje 27, 217, 221, 237, 606), `packages/shared/src/i18n/nb.json` (linje 53, 61, 62) + 13 andre språk
- Renames i samme PR som timer-modulen bygges (Fase 3)
- Risiko er lav fordi timer-prototypen er hardkodet demodata
- **Atomisk i18n-rename** — alle 14 språk samtidig (i18next viser nøkkel som tekst hvis den mangler)

**Bekreftelse:** `DokumentflytMedlem.rolle = "godkjenner"` (linje 720) er KORREKT bruk av godkjenning (dokumentflyt-rolle). Ikke renames.

### A.9 ProjectMember.role = "underentreprenor"

UE-rolle som streng-verdi på ProjectMember.role. Ingen ny rolle-tabell. Ingen snapshot — én User per (person × firma).

**Policy:** Hvis Joakim bytter fra A.Markussen til Bravida:
- A.Markussen-User får periodeSlutt
- Bravida oppretter ny User-rad
- Gamle timer beholder gammel User.id — historikken intakt
- Ingen snapshot trengs fordi User-organisasjon ikke endres for samme rad

**Konsekvens:** harProsjektTilgang() trenger ingen endring (verifisert: 9 forekomster av `medlem.role === "admin"`-bypass; andre roller behandles som vanlige medlemmer). Filtrering per rolle (UE ser bare egne timer) legges inn i Timer/Vareforbruk-routerene når de bygges.

> ⚠️ **Åpen B-spørsmål:** Dobbeltspor — UE kan identifiseres både via `User.organizationId !== prosjekt.primaryOrganizationId` OG via `ProjectMember.role = "underentreprenor"`. Risiko for drift. Se § B.5.

### A.10 User.canLogin

Ny boolean på User for «ansatt uten innlogging».

```prisma
model User {
  // ... eksisterende
  canLogin Boolean @default(true)
}
```

`canLogin = false` betyr brukeren har lønn/timer registrert av andre, men logger ikke inn selv. Ikke en ny rolle — bare en attributt.

**Implementering:** Sjekk i NextAuth `signIn`-callback. Hvis `false`, returner `false` og blokker innlogging. Verifisert: ingen eksisterende `canLogin`-sjekk i Auth-laget.

**Tilgangskontroll:** Kun org-admin (`User.role = "company_admin"`) eller sitedoc-admin kan opprette `canLogin = false`-bruker. Bør stå i tRPC-validering.

### A.11 GDPR data-minimalisering

SiteDoc registrerer kun:
- Navn (fornavn, etternavn)
- E-post
- Telefon
- Fødselsdato
- **Nasjonalitet** (kreves for §15-liste, allmenngjort tariffavtale)
- **Arbeidstillatelse-status + utløpsdato** (utenlandske arbeidere)

Ingen andre PII-felter uten eksplisitt forretningsbehov.

**HMS-kort lagres TO steder** (verifisert 2026-04-27 — `PsiSignatur.hmsKortNr` finnes allerede på `schema.prisma:1153`):

- **`User.hmsKortNr` + `User.hmsKortUtloper`** — sannhetskilde for fast ansatte (legges til i Fase 0)
- **`PsiSignatur.hmsKortNr`** — eksisterer i dag som snapshot ved signering (per A.7 snapshot-pattern)

**Logikk:**
- Når en User med `hmsKortNr` signerer en PSI: kortnummer kopieres til `PsiSignatur.hmsKortNr` som historisk snapshot
- Ad-hoc-gjester uten User-rad registrerer kortnummer direkte på `PsiSignatur` uten User-kobling
- Snapshot på PsiSignatur sikrer at endring av brukerens kortnummer (f.eks. fornyelse) ikke endrer historisk signering

**Varsling for HMS-kort utløp:** Tverrgående varslingssystem (se [varsling.md](varsling.md)) sender varsel til brukeren selv + firmaadmin på 90/30/7 dager før utløp basert på `User.hmsKortUtloper`. SmartDok-research viser at A.Markussen aktivt bruker tilsvarende varsling (Anne Nordeng — varsel 2 mnd før utløp). Lovgrunnlag: byggherreforskriften § 15 + arbeidsmiljøloven krever gyldig HMS-kort på byggeplass. Utløpt HMS-kort blokkerer **ikke** innlogging eller timeregistrering — det er kun varsling. Innsjekk på byggeplass kan blokkeres separat (mannskap-modul, egen beslutning).

### A.12 Anonymizing-policy ved sletting

`anonymizeUser(userId)`-funksjon ryddes konsistent over alle tabeller med PII-snapshot:

| Datatype | Strategi ved sletting |
|----------|----------------------|
| User-rad | Navn → "Slettet bruker", e-post/telefon → null |
| Timer-rader | Beholdes (skattegrunn), Timer.userId beholdes (FK-onDelete: SetNull eller Restrict — krever beslutning) |
| Activity-rader | actorNavnSnapshot → "[anonymisert]", anonymizedAt = NOW(), actorUserId beholdes |
| Snapshot-felt med navn | Erstattes med "[anonymisert]" ved sletting |
| Signaturer | Beholdes (juridisk audit), navn anonymiseres i visning |

`anonymizeUser()` må eksistere fra Fase 0 hvis noen User-rad slettes.

### A.14 Firma-konfigurerbar tidssone for forretningsregler

`OrganizationSetting.timezone` (default `"Europe/Oslo"`). Brukes for «etter X dager»-regler (`timer_lock_after_days`). Bruk `startOfDayInZone(date, timezone)` for å unngå DST-feller.

**Kritisk: `date-fns-tz` er IKKE installert i dag** (verifisert). Krever Fase 0-tillegg:
1. `pnpm add date-fns-tz --filter @sitedoc/shared`
2. Implementer `startOfDayInZone`, `endOfDayInZone`, `addBusinessDaysInZone` i `packages/shared/src/utils/timezone.ts`
3. Test mot DST-overgang (siste søndag i mars og oktober)

### A.15 Eksport interface-kontrakt i Fase 0

Ingen `db-eksport`-pakke i Fase 0. Hver modul eksponerer `getExportableData(periode, projectId)` som returnerer normalisert struktur. Implementering bygges i Fase 3 sammen med Timer.

### A.16 EksportertFlagg som sentral tabell

Sentral `EksportertFlagg`-tabell med `(modul, kildeId, batchId)` som unique key. Forhindrer dobbel-eksport på tvers av moduler.

### A.17 Eksport-tilgang ved deaktivert modul

Tre nivåer av modul-tilstand (justert fra opprinnelig forslag):
- `aktiv` — full bruk
- `arkivert` — data leses, ny-opprettelse blokkert; eksporteres
- `slettet` — data er der, men IKKE i eksport

Default deaktivering = `arkivert`. Slettet krever eksplisitt admin-handling. Dokumenteres som arkitektur-policy.

**Implementering:** Konkret schema-endring (`active Boolean` → `status String`) skjer i samme migrasjon som A.4 sin `organizationId`-tillegg — se A.4 for SQL-detaljer og to-stegs migration.

### A.18 To-stegs migration-policy

Aldri slett kolonner i én migrering. Alltid:
1. Legg til ny kolonne (nullable)
2. Migrer data
3. Sett NOT NULL eller drop gammel kolonne i NESTE release etter at all kode er oppdatert

Tillater rollback. Beskytter mot deploy-rekkefølge-feil. Låst i CLAUDE.md.

### A.19 Migrasjoner aldri redigeres etter merge til main

Sikrer reproduserbarhet. Eksisterende avvik (`20260406020000_fiks_rolle_utforer`) er allerede kjørt overalt — ingen aksjon, regelen gjelder fra nå.

### A.20 Cross-package-FK-mønster

Cross-schema-FK håndteres som svake String-felt uten Prisma `@relation`. Etablert mønster i db-maskin. Krever orphan-deteksjons-cron (i backlog).

### A.21 Cache-invalidation-mønster

Definér `apps/web/src/lib/cache-invalidation.ts` med `invalidationMaps`-objekter som mapper mutation → liste over queries som invalideres. Hver mutation bruker `onSuccess: () => invalidationMaps.timerOpprett(utils, { projectId })`.

**Mønsteret defineres i Fase 0** (tom skjelett-fil + dokumentert konvensjon — `cache-invalidation.ts` opprettes med JSDoc-eksempler men ingen konkrete maps). **Faktisk fylling skjer i Fase 3** sammen med Timer-modul-bygging — eksisterende 30 ad-hoc invalidate-kall refaktoreres samtidig som første Timer-mutations får sine maps.

### A.22 ProAdm vinner med varsel

Hvis ProAdm endrer kostnad etter at Godkjenning er sendt:
1. SiteDoc oppdager avvik fra `kostnadSnapshot` ved import
2. Setter `endretEtterSending = true` på Godkjenning (krever felt — se B.3)
3. Logger til Activity
4. Varsler bestiller-faggruppen
5. Krever ny signering før Godkjenning kan brukes til fakturering

### A.23 Server-wins ved mobile/web sync-konflikt

Server-wins (etablert i timer.md linje 517). Bedre policy beskrevet for Fase 3 (pending edits-modal).

### A.24 Felt-opprettet ECO orphan uten ProAdm-match

Akseptabelt at felt-opprettet ECO blir orphan hvis ProAdm aldri matcher. Markeres som «venter på ProAdm-synkronisering». Detaljer for Fase 3.

---

## B. ÅPNE BLOKKERER-SPØRSMÅL — må besluttes før koding

Disse er identifisert i Opus-runde 3 (2026-04-26) og blokkerer Fase 0-koding.

### B.1 ECO timerregistreringApen default — true eller false?

**Problem:** Default `false` betyr ALLE importerte ECO er låst for time-registrering ved import. Joakim ser tom dropdown. Hvis ProAdm-import ikke setter den til `true`, må prosjektleder manuelt åpne hver ECO.

**Forslag:** Default `true`. Eksplisitt admin-handling lukker en ECO.

**Krever Kenneth-beslutning.**

### B.2 Bytt rekkefølge K.5 og K.6 i migrerings-rekkefølgen — **BESLUTTET 2026-04-27**

**Problem:** K.5 (`ProjectModule.organizationId`) bakfylles fra `Project.primary_organization_id`. K.6 (`Project.primaryOrganizationId`) må eksistere FØRST.

**Forslag:** Endre planen til K.6 → K.5.

**Status:** ✅ **LUKKET** — § E reflekterer beslutningen. Project.primaryOrganizationId (steg 4) kommer før ProjectModule-utvidelse (steg 5) i nåværende rekkefølge. Beholdt her for historikk.

### B.3 Godkjenning.endretEtterSending — felt eller annen mekanisme?

**Problem:** I.1 referer eksplisitt til `endretEtterSending`-felt som mekanisme for ProAdm-konflikt-håndtering. Modellen i A.2 inneholder ikke feltet.

**Forslag:** Legg til `endretEtterSending Boolean @default(false)` på Godkjenning, eller endre I.1 til å bruke avledet logikk (sjekk om siste DocumentTransfer.kostnadSnapshot avviker fra opprinnelig signering).

**Krever Kenneth-beslutning.**

### B.4 Standalone-prosjekt + ProjectModule.organizationId

**Problem:** Standalone-prosjekt har `Project.primaryOrganizationId IS NULL`. Bakfyll i K.5 setter `ProjectModule.organization_id = NULL`. Plan-steg 2 «SET NOT NULL» bryter da migreringen.

**Alternativ A:** Tillat NULL permanent for standalone. Bryter med planens steg 2.
**Alternativ B:** Opprett seed «system-org» med UUID `00000000-0000-0000-0000-000000000000`. Standalone prosjekt får default organizationId = system-org.

**Krever Kenneth-beslutning.** Min anbefaling: Alternativ A (NULL permanent — enklere, mer ærlig).

### B.5 UE-identifikasjon — én sannhet

**Problem:** UE kan identifiseres både via `User.organizationId !== prosjekt.primaryOrganizationId` OG via `ProjectMember.role = "underentreprenor"`. Risiko for drift.

**Konkret eksempel:** Joakim tilhører Bravida-org, men har `ProjectMember.role = "worker"` på A.Markussen-prosjekt. Eksport filtrerer ut basert på org (UE = ekstern lønn). UI viser ALLE timer (ikke filtrert basert på rolle). Inkonsistens.

**Forslag:** Bruk `User.organizationId`-mismatch som primær. Rolle-feltet utledes som UI-tag, ikke lagres som egen verdi.

**Krever Kenneth-beslutning.**

### B.6 Timestamptz-migrasjon før Timer

**Problem:** Vedtak om UTC i DB krever schema-wide migrasjon av 100+ DateTime-kolonner til `@db.Timestamptz`. Verifisert 2026-04-27: **0 forekomster av `@db.Timestamptz`** i `schema.prisma` i dag — alle DateTime-felter bruker default Prisma `DateTime` (mapper til `timestamp(3)` uten tidssone). Tidligere markert som A.13 (vedtatt), men reklassifisert etter kode-verifisering — for stor beslutning til å være låst uten Kenneth-vurdering.

**Tre alternativer:**

a) **Full migrasjon i Fase 0** — riktig fundament, stor jobb (én migrasjon som rører hele schema)
b) **Selektiv migrasjon** — kun Timer-relevante tabeller i Fase 0 (DailySheet, sheet_*, attestering-felter), resten gradvis. Mindre risiko, men midlertidig inkonsistens i schema
c) **Utsett til etter Timer-MVP** — Timer.dato som date-only først (`@db.Date`), klokkeslett (startAt/endAt) lagres uten tidssone. Migrer til Timestamptz først ved første tidssone-bug eller før internasjonalisering

**Anbefaling:** Avgjør før Fase 0-koding starter — påvirker Timer-modul direkte. Alt b) er trolig riktig kompromiss for A.Markussen-case (norsk-only, men ren Timer-modul fra dag 1).

**Konsekvens for andre punkter:**
- A.7 `attestertSnapshot` — lagrer ikke tidssone-data (er JSON), upåvirket
- A.14 OrganizationSetting.timezone — krever Timestamptz-felter for å fungere riktig (DST-sensitive forretningsregler)
- C.1 date-fns-tz-installasjon — fortsatt nødvendig uansett alternativ

**Krever Kenneth-beslutning.**

---

## C. Anbefalte Fase 0-utvidelser

Disse er ikke blokkere, men bør være med i Fase 0 for å unngå arkitektur-gjeld.

### C.1 Installer date-fns-tz og tidssone-utils

Verifisert: `date-fns-tz` ikke installert i dag. Krevet for A.14 (Firma-konfigurerbar tidssone) og B.6 (Timestamptz-migrasjon).

**Tiltak:**
1. `pnpm add date-fns-tz --filter @sitedoc/shared`
2. Implementer `startOfDayInZone`, `endOfDayInZone`, `addBusinessDaysInZone` i `packages/shared/src/utils/timezone.ts`
3. Test mot DST-overgang

### C.2 aktivMedlemFilter for periode-sjekk

Verifisert: `tilgangskontroll.ts` har 9 steder med admin-bypass, INGEN steder sjekker `periodeSlutt`. Etter B.1 (`ProjectMember.periodeSlutt`)-implementasjon må alle 9 utvides.

**Tiltak:** Lag `aktivMedlemFilter`-konstant i `tilgangskontroll.ts`:
```typescript
export const aktivMedlemFilter = {
  OR: [
    { periodeSlutt: null },
    { periodeSlutt: { gt: new Date() } },
  ],
};
```
Refaktorer ALLE 9 steder atomisk i én PR.

### C.3 Implementer canLogin-sjekk i NextAuth signIn-callback

D.2 spesifiserer feltet, men implementasjon mangler. Verifisert: ingen eksisterende `canLogin`-sjekk.

**Tiltak:** Legg til i `apps/api/src/auth/...` eller `apps/web/src/lib/auth.ts`. Verifiser Prisma-versjon (NextAuth v4 vs v5 har annet API).

### C.4 Definer Zod-schema for attestertSnapshot

A.7 (Hybrid logg + snapshot ved attestering) refererer Json-felt uten validering. Risiko for inkonsistens.

**Tiltak:** Definér Zod-schema med `snapshotVersjon`-felt i `packages/shared/src/audit-schemas/timer.ts`. Validering i app-lag før lagring.

### C.5 CI-sjekk for projectId_moduleSlug-mønster mellom A.4 steg 1 og 2

Mellom steg 1 og 2 må all kode oppdateres. Risiko for at noen kodesteder glemmes.

**Tiltak:** CI-sjekk:
```bash
grep -rn "projectId_moduleSlug" apps/ packages/ | wc -l  # må være 0
```
Steg 2 deployes ikke før denne returnerer 0.

**⚠️ Forutsetning:** Per 2026-04-27 finnes ingen `.github/workflows/` — ingen CI-pipeline overhodet. CI-etablering er separat prerequisite — se C.12.

### C.6 Legg til lukketAvUserId/lukketVed/lukketGrunn på ECO

A.1 mangler audit på lukking. Activity dekker det generelt, men felter på selve ECO gir raskere oppslag.

### C.7 Soft-delete på ECO

A.1 mangler `slettetVed`. Hvis ECO opprettes ved feil (typo i ProAdm-ID), `status = "lukket"` skjuler den ikke fra lister.

**Tiltak:** Legg til `slettetVed DateTime?` + filter alle queries.

### C.8 actorNavnSnapshot på Activity — ✅ **LUKKET — innarbeidet i A.3**

A.3 har inkonsistens med E.2 om GDPR-håndtering. Løsning: behold `actorUserId` + legg til `actorNavnSnapshot String?` som settes ved opprettelse. Allerede inkludert i revidert A.3-modell over (verifisert linje 112: `actorNavnSnapshot String?`). Beholdt her for historikk.

### C.9 EquipmentAnsvarlig.periodeSlutt — ✅ **LUKKET — innarbeidet i A.6**

A.6 mangler periode-felt. Strider mot loan-pattern. Allerede inkludert i revidert A.6-modell over (verifisert linje 217: `periodeSlutt DateTime?`). Beholdt her for historikk.

### C.10 Seed-mekanisme via event-hook i Fase 0

Lønnsart-Nivå 1, standard `expense_categories` og andre datadrevne kataloger må seedes ved firma-opprettelse. Mekanismen må eksistere i Fase 0 selv om innholdet (lønnsart-katalogen) først kommer i Fase 3.

**Begrunnelse:** Hvis vi venter til Fase 3 med å innføre event-hook, må alle eksisterende firmaer seedes retroaktivt ved Fase 3-deploy. Det er et migrerings-problem som unngås ved å ha hook-mekanismen klar fra start.

**Tiltak (Fase 0):**
1. Definér `apps/api/src/events/organization.ts` med `onOrganizationCreated(organizationId)`-hook
2. Hooken kalles fra `organisasjon.opprett`-tRPC-mutation
3. Tom implementasjon i Fase 0 (ingen seedere registrert)
4. Fase 3 (Timer): registrer `seedLonnsartNivaa1`, `seedExpenseCategories`
5. Fase 0.5 (Avdeling): vurder om standard-avdelinger seedes eller opprettes manuelt

**Datamodell-konsekvens:** `Lonnsart`, `Tillegg` og `Aktivitet` har `seedNivaa Int?`-felt for å skille auto-seeded fra kunde-opprettet (se datamodell i [timer.md](timer.md)).

### C.11 Avdeling-tabell i Fase 0.5 (sammen med Byggeplass)

Tidligere Fase 0-design hadde `Avdeling`-flagg på `OrganizationSetting`. Ny analyse (2026-04-26 timer-runde 2) viser at Avdeling brukes på tvers av Maskin (ansvarlig per avdeling), Mannskap (avdeling per User) og Timer (eksport-filtrering, dagsseddel-tagging).

**Tiltak:** Egen `Avdeling`-tabell i `packages/db` (kjernen) bygges i **Fase 0.5** (sammen med Byggeplass-strategi), ikke Fase 3. Hvis utsatt til Fase 3 må moduler som kommer før (Maskin Fase 1, Mannskap Fase 4) refaktoreres når avdeling til slutt opprettes.

**Skille mot byggeplass:**
- Byggeplass = fysisk lokasjon innenfor et prosjekt (per [byggeplass-strategi.md](byggeplass-strategi.md))
- Avdeling = organisatorisk inndeling av firma (Tromsø, Narvik, etc.)
- To ortogonale dimensjoner — passer å bygges samtidig som tverrgående organisatoriske konsepter

**Equipment-presisering:**
- `Equipment.lokasjon` er GPS-koordinat (sporing av hvor maskinen står fysisk), IKKE avdelings-tilknytning
- Avdeling kobles til Equipment via `EquipmentAnsvarlig.avdelingId` eller `EquipmentEier.avdelingId` (firma-intern eier-relasjon, hvis aktuelt)
- Selve Equipment-objektet har ingen `avdelingId`

**Datamodell-skisse:**
```prisma
model Avdeling {
  id              String   @id @default(uuid())
  organizationId  String   @map("organization_id")
  kode            String?  // intern kode (kan være null)
  navn            String
  aktiv           Boolean  @default(true)
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@unique([organizationId, navn])
  @@map("avdelinger")
}
```

**Migrerings-rekkefølge:** Settes i Fase 0.5-plan, ikke i Fase 0-rekkefølgen (§ E). Fase 0.5 bygges etter Fase 0-koding er ferdig.

### C.12 Etabler CI-pipeline før Fase 0-deploy

Verifisert 2026-04-27: ingen `.github/workflows/` finnes. Repoet har ingen automatisert CI-pipeline.

**Hvorfor relevant for Fase 0:** Flere C-punkter (C.5 i tillegg til generell trygghet ved migrasjoner) forutsetter at CI kan kjøre kontroller. Uten CI er to-stegs migration-policy (A.18) håndhevd kun av menneske-disiplin — risiko for at steg 2 deployes før all kode er oppdatert.

**Minimum CI-stack for Fase 0:**
1. Type-check (`pnpm typecheck`)
2. Lint (`pnpm lint`)
3. Test-suite (`pnpm test`)
4. Prisma-validering (`pnpm --filter @sitedoc/db exec prisma validate`)
5. C.5 grep-sjekk (kan kjøres som test eller egen workflow-step)

**Tiltak:** Opprett `.github/workflows/ci.yml` med stegene over. Trigger på pull-request mot `main` og `develop`. Eventuelt utvid til auto-deploy mot test-miljø.

**Når:** Bør være ferdig før noen Fase 0-migrasjoner kjøres. Kan etableres parallelt med planlegging av andre Fase 0-arbeid.

---

## D. Lovverk-svakheter som krever vurdering

### D.1 GDPR Art. 20 — dataportabilitet

Brukeren har rett til å få utlevert egne data i strukturert maskinlesbart format. Plan har ingen mekanisme.

**Tiltak:** Hver modul må eksponere `getUserDataForExport(userId)` som returnerer normalisert struktur. Eksport-modulen aggregerer. Planlegges nå selv om implementeres senere.

### D.2 GDPR Art. 9 — samtykkehåndtering for spesielle data

GPS-spor (mannskap-modul Fase 4) er spesiell kategori. Krever eksplisitt samtykke.

**Tiltak:** `User.consents Json?` med versjonert samtykke per datatype. Designes inn nå selv om brukes i Fase 4.

### D.3 Skattelov § 5-12 + Bokføringsloven § 13 — differensiert retention

Planens E.2 sier «5 år for lønnsdata». Lovkrav er mer presist:
- **Skattelov:** lønnsdata 5 år FØLGENDE INNTEKTSÅR (ikke fra registreringsdato)
- **Bokføringsloven:** fakturagrunnlag (Godkjenning, eksport-batches) 10 år
- **Bokføringsloven:** timelister 5 år

`retainedUntil`-beregning: `endOfYear(handling) + N år`. Differensiert per handling-type. Allerede inkludert i revidert A.3.

### D.4 §15-liste — utenlandske arbeidere

Krever nasjonalitet + arbeidstillatelse på User. Allerede inkludert i A.11 (data-minimalisering).

---

## E. Migrerings-rekkefølge for Fase 0 (13 steg)

| Steg | Migration | Avhengighet |
|------|-----------|-------------|
| 1 | Activity-tabell | Ingen |
| 2 | OrganizationSetting | Organization (finnes) |
| 3 | Rename OrganizationProject → ProjectOrganization + rolle | OrganizationProject (finnes) |
| **4** | **Project.primaryOrganizationId nullable** | Project (finnes) |
| **5** | **ProjectModule-utvidelse (organizationId nullable + status String)** — se A.4/A.17 for SQL-detaljer (én atomisk migrasjon, ikke to separate steg) | ProjectModule + Project.primaryOrganizationId |
| 6 | OrganizationPartner | Organization |
| 7 | OrganizationTemplate | Organization |
| 8 | BibliotekMal-utvidelse (4 felt: kategori/domene/kobletTilModul/verifisert) | BibliotekMal (finnes) |
| 9 | Psi.organizationId + projectId nullable + kontekstType — **inkluder oppdatering av `@@unique([projectId, byggeplassId])`** når projectId blir nullable. Vurder ny unique: `@@unique([organizationId, projectId, byggeplassId])` eller separat håndtering for null-projectId-tilfeller. Sjekk byggeplassId-FK-konsistens også | Psi (finnes) |
| 10 | ProjectMember.periodeSlutt + UE-rolle dokumentasjon | ProjectMember (finnes) |
| 11 | ExternalCostObject | Organization, Project |
| 12 | Godkjenning + DocumentTransfer.kostnadSnapshot + DocumentTransfer.godkjenningId | DocumentTransfer (finnes), ECO |
| 13 | User-utvidelse (canLogin, HMS-kort, ansattnummer, nasjonalitet, arbeidstillatelse) | User (finnes) |

**Etter alle 13 er kjørt (neste release):**
- ProjectModule.organizationId — vurdér NOT NULL avhengig av B.4-beslutning
- ProjectModule.status NOT NULL + drop active-kolonne (per A.4 steg 2)
- Equipment.ansvarligUserId migreres til EquipmentAnsvarlig + droppes

**Note om B.6 (Timestamptz-migrasjon):** Ikke i denne rekkefølgen ennå. Avhengig av B.6-beslutning må den plasseres som steg 0 (pre-Fase 0, full migrasjon — alt a) eller integreres i Timer-relevante steg (selektiv migrasjon — alt b) eller utsettes til etter Timer-MVP (alt c). Avgjøres når B.6 lukkes.

**Note om utelatte steg:**
- **Avdeling utsatt til Fase 0.5** per C.11 — ikke i Fase 0-rekkefølgen. Bygges sammen med Byggeplass-strategi
- **Tidligere E.2 «OrganizationModule»** fjernet — A.4 vedtok at ProjectModule utvides, ikke ny tabell. Utvidelsen skjer i nåværende steg 5

**Endring fra opprinnelig plan:** Steg 4 og 5 er byttet rekkefølge (Project.primaryOrganizationId før ProjectModule-utvidelse). Identifisert i Opus-runde 3 — primaryOrganizationId må eksistere før ProjectModule kan bakfylles. Dette er den B.2 som nå er lukket.

---

## F. End-to-end-test som må kjøre kontinuerlig

> Joakim oppretter timer-registrering på mobil offline mot ExternalCostObject «Plunder og heft uke 14». Synkroniserer. Prosjektleder attesterer (snapshot låses). Eksport-filen til ProAdm inneholder riktig proAdmId med riktig kostnad-snapshot.

Kjøres etter hver merge til main. Rød test = arkitektur-feil, ikke kun kode-feil.

---

## G. Beslutninger bevisst utsatt

| Tema | Når besluttes | Hvorfor utsatt |
|------|---------------|----------------|
| Byggherre-modul som produkt | Når reell kunde ber | Datamodellen støtter det allerede |
| LonnsartMalverk (startpakker per bransje) | Etter første kunde-pilot | Ingen bevist behov |
| Eksport-modul-implementering | Fase 3 | Ingen data å eksportere før Timer er på plass |
| Cross-schema orphan-deteksjon (cron) | Fase 5+ | Manuell rensing tilstrekkelig i tidlig fase |
| Subproject-malverk for import | Fase 2 sammen med BibliotekMal-promotering | Konsistens |
| EquipmentAssignment.externalCostObjectId | Fase 5 (eller tidligere) | Avhenger av om Vareforbruk-modul utvikles parallelt |
| Faggruppe.partnerOrganizationId | Fase 5+ | Cross-prosjekt firma-gjenkjenning, lavt-prioritert |
| Sluttoppgjør-frist-varsling per NS 8407 | Fase 7 | Krever Varsling-modul |
| GDPR consent-håndtering for GPS | Fase 4 (mannskap) | Designes inn nå (E.2) |

---

## H. Status-snapshot per 2026-04-26

**Siste runde:** Opus-runde 3 ferdig 2026-04-26.

**Lukket:** 23 beslutninger (A.1-A.24 minus A.13 som ble reklassifisert til B.6).

**Åpent:** 5 BLOKKERER-spørsmål (§ B.1, B.3, B.4, B.5, B.6 — B.2 lukket etter at § E ble rettet).

**Anbefalte utvidelser:** 12 punkter (§ C.1-C.12), hvorav 2 lukket (C.8, C.9 — innarbeidet i A.3/A.6). Nye etter Runde 2 (2026-04-27): C.12 (CI-pipeline før Fase 0-deploy).

**Lovverk-vurderinger:** 4 områder (§ D).

**Migrerings-rekkefølge:** 13 steg i § E (var 15 — OrganizationModule fjernet per A.4, Avdeling utsatt til Fase 0.5 per C.11).

**Neste handling:** Kenneth lukker B.1, B.3, B.4, B.5, B.6. Når lukket: oppdater denne filen, og start Fase 0-koding via migration-rekkefølge i § E.

**Anker for ny Code-chat:**
- Denne filen + lenker øverst
- [smartdok-undersokelse.md](smartdok-undersokelse.md) for empirisk grunnlag
- [arkitektur-syntese.md](arkitektur-syntese.md) for helhetlig produktarkitektur
