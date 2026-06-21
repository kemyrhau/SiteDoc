---
status: aktiv
sist_verifisert_mot_kode: 2026-04-27
sist_endret: 2026-04-28
gjelder_versjon: Fase 0
avhenger_av:
  - arkitektur.md
  - terminologi.md
  - dokumentflyt.md
---

# Fase 0-beslutninger — komplett (oppdatert 2026-04-26)

**Status:** 🟢 23 beslutninger vedtatt (§A) + **0 åpne BLOKKERE (§B)** — alle 7 lukket 2026-04-27 (B.1 default true, B.2 § E-retting, B.3 eksplisitt felt, B.4 interim utsatt, B.5 organizationId-mismatch, B.6 selektiv Timestamptz, B.7 Modell A — én User per person×firma med reaktivering). § C: 12 anbefalte utvidelser, hvorav 3 lukket (C.8, C.9 innarbeidet i A.3/A.6; C.1 lukket implisitt av B.6). **Klart for Timer/Maskin-revurdering**, deretter Fase 0-koding via § E.

**Bruk:** Anker for ny Code-chat. Neste Code-instans skal lese denne filen + lenker under FØR koding.

**Lesing før koding starter:**
1. Denne filen (beslutninger + åpne spørsmål)
2. [arkitektur-syntese.md](arkitektur-syntese.md) — helhetlig produktarkitektur
3. [smartdok-undersokelse.md](smartdok-undersokelse.md) — empirisk grunnlag fra A.Markussen
4. [arkitektur.md § Datamodell-prinsipper](arkitektur.md#datamodell-prinsipper) — to-nivå-modell og loan-pattern
5. [timer.md](timer.md) — timer-modul-spesifikasjon (krever refaktor jf. C.1 + organizationId-rename)

> ✅ **Til neste Code-instans:** Alle BLOKKERE er lukket (B.1–B.7, 2026-04-27). Klart for Fase 0-koding etter at Timer/Maskin-revurderingen er ferdig. § B beholdes for historikk — alle 7 punkter har nå "LUKKET"-status.

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
  timerregistreringApen Boolean  @default(true) @map("timerregistrering_apen")

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

> ⚠️ **Åpen B-spørsmål:** Default for `timerregistreringApen` er nå satt til `true` (B.1 lukket 2026-04-27). Mangler fortsatt `lukketAvUserId` + soft-delete (C.6, C.7).

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

  godkjentVed           DateTime? @db.Timestamptz @map("godkjent_ved")
  godkjentAvUserId      String?   @map("godkjent_av_user_id")

  endretEtterSending    Boolean   @default(false) @map("endret_etter_sending")
  sistEndretVed         DateTime? @db.Timestamptz @map("sist_endret_ved")

  createdAt             DateTime  @default(now()) @db.Timestamptz @map("created_at")
  updatedAt             DateTime  @updatedAt @db.Timestamptz @map("updated_at")

  @@unique([projectId, internRef])
  @@map("godkjenninger")
}
```

**Kostnads-historikk via DocumentTransfer** (ikke egen sub-tabell):
DocumentTransfer-mønsteret eksisterer (linje 603) og utvides med `kostnadSnapshot Json?`. Hver send/retur/godkjenning skaper en DocumentTransfer-rad med snapshot. Hele forhandlingshistorikken bevares automatisk.

**DocumentTransfer må også utvides** med `godkjenningId String?` for å gjenbruke transfer-mekanismen for Godkjenning (i dag støtter den kun Checklist+Task).

> ✅ **B.3 lukket 2026-04-27:** `endretEtterSending` + `sistEndretVed` er nå inkludert i modellen over. Manglende «aktiv versjon»-pointer og indeks-svakheter er fortsatt åpne (§ B.8, B.9 — utenfor BLOKKERER).

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

> **🔄 OVERSTYRT 2026-05-05 (Steg 1e Fase A):** A.4 forkastet originalt en separat `OrganizationModule`-tabell. Beslutningen reverseres delvis i [Steg 1e](domene-arbeidsflyt.md) — `ProjectModule`-utvidelsen (denne A.4) består uendret for **prosjekt-instans**-laget, men firma-master-laget (tidligere `Organization.har_*_modul`-flagg) flyttes til en dedikert `OrganizationModule`-tabell. Rasjonale: et firma kan aktivere Timer-modulen uten å ha prosjekter ennå (A.Markussen-flow — onboarder lønnsarter før første prosjekt opprettes), så firma-master-bryteren kan ikke avledes fra ProjectModule alene. To-nivås-modellen (firma-master + prosjekt-instans) krever to tabeller.

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

### A.6 EquipmentAnsvarlig — hybrid (single primær + optional m:n for tilleggsansvarlige) — ✅ **REFORMULERT 2026-05-01**

**Bakgrunn for reformulering:** Opprinnelig A.6 (2026-04) vedtok ren m:n med `rolle="primary"|"secondary"`. Ved kode-verifisering 2026-05-01 ble det klart at:
- Eksisterende `Equipment.ansvarligUserId` (single, nullable) er deployet i prod og brukes i listevisning og UI
- A.Markussens dominerende mønster er én ansvarlig per maskin (SmartDok har «Maskinansvarlig 1 + 2», men 1 er nesten alltid hovedlast)
- Ren m:n krever join i alle listevisninger og bryter ytelse uten ekvivalent gevinst

**Vedtatt hybrid-modell:**

`Equipment.ansvarligUserId String?` **beholdes** som primær ansvarlig (single, nullable).

Ny tabell `EquipmentAnsvarlig` legges til i `packages/db-maskin` for **kun tilleggsansvarlige** — brukes når en maskin trenger flere ansvarlige. Ingen `rolle`-kolonne (alle rader er per definisjon «secondary»; primær ligger på Equipment).

```prisma
model EquipmentAnsvarlig {
  id            String    @id @default(uuid())
  equipmentId   String    @map("equipment_id")
  userId        String    @map("user_id")           // svak String-FK til User.id (etablert mønster, § 6.1 arkitektur-syntese)
  periodeStart  DateTime  @default(now()) @map("periode_start")
  periodeSlutt  DateTime? @map("periode_slutt")     // NULL = aktiv ansvarlig
  opprettetAvUserId String? @map("opprettet_av_user_id") // hvem la til denne ansvarligheten (audit)
  createdAt     DateTime  @default(now()) @map("created_at")

  equipment Equipment @relation(fields: [equipmentId], references: [id], onDelete: Cascade)

  @@unique([equipmentId, userId, periodeStart])
  @@index([userId])
  @@index([equipmentId, periodeSlutt])
  @@map("equipment_ansvarlige")
  @@schema("maskin")
}
```

**Periode-felter** beholdes for konsistens med loan-pattern (§ 3.3 arkitektur-syntese). Tilleggsansvarlige har historikk; primær endres sjeldent og trenger ikke loan-pattern (Activity-tabellen logger endringer).

**Migrering:** Tom tabell ved tilføyelse. Ingen data-migrering trengs — eksisterende `ansvarligUserId`-rader fortsetter å fungere uendret. Ingen drop av kolonne.

**UI-konsekvens:** «+ Legg til ansvarlig»-knapp i detaljside åpner skjema som skriver til `EquipmentAnsvarlig`. Listevisning bruker fortsatt `ansvarligUserId` direkte (én join), evt. med tag «+N» bak navn hvis tilleggsansvarlige finnes.

**Tilgangskontroll:** Ny funksjon `verifiserMaskinAnsvarligSkriveTilgang(ctxUserId, equipmentId)` i `tilgangskontroll.ts` — tillater firma-admin (`company_admin`) ELLER nåværende primær-ansvarlig (`Equipment.ansvarligUserId`) å tilføye/fjerne tilleggsansvarlige. Vanlige brukere har lese-tilgang. Detaljer i [maskin.md § Ansvarlig per utstyr](../claude/maskin.md).

**Avvik fra opprinnelig A.6:** Ingen `rolle`-kolonne i tabellen. Ingen drop av `Equipment.ansvarligUserId`. C.9 («periodeSlutt-felter») forblir innarbeidet i denne tabellen.

**Utløst av:** Schema-reconciliation-blokk (Blokk A) før Maskin Fase 1 fortsettes — Kenneth-vedtak 2026-05-01 etter design-runde mot Opus.

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

### A.9 ProjectMember.role — gyldige verdier

Etter B.5-lukking 2026-04-27: **`"underentreprenor"` er IKKE en gyldig verdi** for `ProjectMember.role`.

**Gyldige forslagsverdier på `ProjectMember.role`:**
- `"admin"` — prosjektadmin (full tilgang til prosjektet)
- `"member"` (default) — vanlig prosjektmedlem

**Andre relevante role-verdier (på `User.role`, ikke ProjectMember):**
- `"sitedoc_admin"` — superadmin (Kenneth)
- `"company_admin"` — firmaadmin (arver admin-tilgang via Organization)
- `"user"` (default) — vanlig bruker

**UE-status utledes deterministisk** via `erUnderentreprenor(user, project)` — se § B.5 for utledning og edge cases. Lagres ALDRI som verdi på `ProjectMember.role`.

**Policy:** Hvis Joakim bytter fra A.Markussen til Bravida:
- A.Markussen-User får `periodeSlutt`
- Bravida oppretter ny User-rad
- Gamle timer beholder gammel `User.id` — historikken intakt
- Ingen snapshot trengs fordi User-organisasjon ikke endres for samme rad

**Konsekvens:** `harProsjektTilgang()` trenger ingen endring (verifisert: 9 forekomster av `medlem.role === "admin"`-bypass; andre roller behandles som vanlige medlemmer). Filtrering per UE-status (UE ser bare egne timer) bygger på `erUnderentreprenor()`-utledning når Timer/Vareforbruk-rutene bygges.

**Migrering:** Hvis `"underentreprenor"`-rader finnes i DB i dag (skal sjekkes ved migrasjon), behandles som legacy — ingen tilgangs-effekt. La radene stå, men avskaff fra fremtidige forslag.

### A.10 User.canLogin

Ny boolean på User med **to bruksområder** (utvidet 2026-04-27 etter B.7):

```prisma
model User {
  // ... eksisterende
  canLogin Boolean @default(true)
}
```

**Bruksområde 1 (original A.10): «Data-mottaker uten innloggings-tilgang»**
- Eldre arbeidere uten smarttelefon, registreres av andre, logger ikke inn selv
- Sesongarbeidere som ikke trenger digital tilgang
- `canLogin = false` settes ved opprettelse, beholdes permanent

**Bruksområde 2 (B.7-utvidelse): «Arkivert User-rad ved org-bytte»**
- Joakim slutter hos A.Markussen → A.Markussen-User-rad får `canLogin = false`
- Joakim returnerer til A.Markussen senere → samme rad reaktiveres med `canLogin = true`
- Bevarer historikk uten å slette rader

Begge representerer samme tekniske tilstand (`canLogin = false`), men oppstår fra ulike forretningsbehov.

**Identifikator-merknad (per B.7-utvidelse 2026-04-27):** Lederen kan registrere User-rader med kun `phone` (uten e-post) for sesongarbeidere/daglig felt-personell hvor telefon er mer naturlig identifikator enn e-post. `phone`-feltet er allerede etablert som identifikator i kode (`medlem.ts`, `gruppe.ts`, `brukere/page.tsx`). I Fase 0 forblir `email` NOT NULL — full tlf-only-bruker introduseres ved fremtidig multi-identifikator-auth-utvidelse.

**Implementering:** Sjekk i NextAuth `signIn`-callback. Hvis `false`, returner `false` og blokker innlogging. Verifisert 2026-04-27: ingen eksisterende `canLogin`-sjekk i Auth-laget.

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

`anonymizeUser(userId)`-funksjon ryddes konsistent over alle tabeller med PII-snapshot.

**Per-User-rad-isolasjon (klargjort 2026-04-27 etter B.7):** `anonymizeUser(userId)` virker per User-rad — én rad om gangen. For å anonymisere «alle Joakim på tvers av firmaer» må funksjonen kjøres separat per User-rad. Identifikator på tvers: e-post (siden vi har composite `@@unique([email, organizationId])`, finner vi alle Joakim-rader via `WHERE email = $email`).

**Per-firma-isolasjon — drivende forretningsregel:** A.Markussen kan slette sin User-rad uten å påvirke Bravidas. Forhindrer at GDPR-sletting fra firma 2 fjerner firma 1s lov-pålagte lønnsdata-historikk (skattelov § 5-12, bokføringsloven § 13).

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

> **Utvidet 2026-04-29:** A.29 erstatter naiv server-wins med felt-nivå conflict-modal. A.23 beholdes som default ved manglende klient-respons (timeout) og ved system-mutations.

### A.24 Felt-opprettet ECO orphan uten ProAdm-match

Akseptabelt at felt-opprettet ECO blir orphan hvis ProAdm aldri matcher. Markeres som «venter på ProAdm-synkronisering». Detaljer for Fase 3.

### A.25 OrganizationRole-tabell for granulære firma-roller — ✅ **VEDTATT 2026-04-29**

Variant B fra P4.3-beslutning. Granulære firma-roller modelleres som egen tabell, ikke utvidelse av `User.role`-enum.

```prisma
model OrganizationRole {
  id              String   @id @default(uuid())
  userId          String
  organizationId  String
  role            String   // "hms_ansvarlig" | etc. (utvides etter behov)
  createdAt       DateTime @default(now())
  
  user            User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  @@unique([userId, organizationId, role])
  @@index([organizationId, role])
}
```

**Begrunnelse:**
- Skalerbar uten enum-endringer (nye roller = nye rader, ikke schema-migrasjon)
- Retro-kostnad A→B senere er 5x B nå (krever migrasjon av rader fra `User.role` til `OrganizationRole`)
- Unngår A.Markussen-research-infeksjon — User.role-enum sementeres ikke basert på én kunde
- Følger samme mønster som ProjectMember (separat tabell for prosjekt-roller) — symmetrisk arkitektur

**`tilgangskontroll.ts`-utvidelse:** Ny funksjon `harOrgRolle(user, "hms_ansvarlig")` brukes i tilgangskontroll for HMS-rapport-tilgang og lignende.

**Tildelings-policy (klargjort 2026-04-30):**

OrganizationRole-rader tildeles av **firma-admin** (`User.role = "company_admin"`) — ikke prosjekt-admin. Følger samme mønster som eksisterende `organisasjon.endreRolle` (apps/api/src/routes/organisasjon.ts:236-280).

Implementasjon i Fase 0:
- Nye endepunkter `organisasjon.tildelOrgRolle` + `organisasjon.fjernOrgRolle`
- Begge gated med `verifiserFirmaAdmin` (eksisterende helper)
- Validering: målbruker må tilhøre samme `organizationId` som tildeleren

**Skille fra prosjekt-spesifikke roller:**

OrganizationRole gjelder **cross-project tilgang innenfor firma** og tildeles av firma-admin. Prosjekt-spesifikke roller forblir uendret og tildeles av prosjekt-admin via eksisterende mekanikker:

- **HMS-ansvarlig på prosjekt** = medlemskap i `ProjectGroup` med `domains: ["hms"]` (tildeles via `gruppe`-router)
- **Firma-koordinator på prosjekt** = `ProjectMember.erFirmaansvarlig` (tildeles via `medlem.settFirmaansvarlig`)
- **Prosjekt-admin** = `ProjectMember.role = "admin"` (tildeles via `medlem.oppdater`)

Scope for tildeling matcher scope for tilgang: cross-firma → firma-admin tildeler, ett-prosjekt → prosjekt-admin tildeler.

**Fase 0-konsekvens:** Ny § E-rad (steg 14) registreres for å bygge tabellen i Fase 0-migrasjonen + de to nye endepunktene.

### A.26 Smart modulProcedure med valgfri byggeplass-scope — ✅ **VEDTATT 2026-04-29**

Variant A v2 fra P4.4-beslutning. `modulProcedure` håndterer både modul-aktivering og byggeplass-scope i én procedure med valgfri input.

```typescript
modulProcedure(slug, input?: { projectId: string; byggeplassId?: string })
```

**Sjekker (Fase 0):**
1. Auth (alltid)
2. Modul-aktivering for prosjektets primaryOrganization (alltid hvis projectId i input)
3. Prosjekt-scope (alltid hvis projectId i input)

**Sjekker tilføyes Fase 0.5 uten endring av modulProcedure-signatur:**
4. Byggeplass-scope HVIS `byggeplassId` er satt OG `ByggeplassMedlemskap`-tabellen eksisterer

**Begrunnelse:**
- Ingen retro-arbeid for Fase 0 → Fase 0.5-oppgradering (modulProcedure-implementasjon utvides, ikke ruter som bruker den)
- Eliminerer utvikler-feilbarhet (kontra separat `byggeplassProcedure` som krever at utvikler velger riktig procedure)
- Fase 0 kan deployes alene; Fase 0.5 utvider funksjonalitet automatisk

**Eksisterende standalone-edge** (per § 2.3 i arkitektur-syntese): `Project.primaryOrganizationId IS NULL` → fallback til standalone-policy. Smart modulProcedure bevarer denne adferden.

### A.27 Firma-HMS-ansvarlig får automatisk lese-tilgang til HMS-rapporter på tvers av prosjekter — ✅ **VEDTATT 2026-04-29**

Alt A fra HMS-flyt-koblings-vurdering. Firma-HMS-ansvarlig (User med `OrganizationRole.role = "hms_ansvarlig"` per A.25) får implisitt lese-tilgang til alle HMS-flyter i firmaets prosjekter — uten å være registrert som DokumentflytMedlem.

**Begrunnelse (Kenneth 2026-04-29):**
> Firma-HMS-ansvarlig har kontrolloppgave — skal se og kontrollere at HMS på prosjektnivå ivaretas og besvares. Krever derfor automatisk lese-tilgang til HMS-rapporter på tvers av alle firmaets prosjekter.

**Tilgangskontroll-utvidelse:**

`harDokumentflytTilgang(user, dokumentflytId)` i `tilgangskontroll.ts` utvides med:

```typescript
// Nivå 1: eksisterende DokumentflytMedlem-sjekk (uendret)
if (await harDokumentflytMedlemTilgang(user, dokumentflytId)) return true;

// Nivå 2: ny firma-HMS-ansvarlig-sjekk (lese-tilgang)
const flyt = await prisma.dokumentflyt.findUnique({
  where: { id: dokumentflytId },
  include: { project: true },
});

if (flyt.dokumentType !== "hms") return false;
if (user.organizationId !== flyt.project.organizationId) return false;

return await harOrgRolle(user.id, "hms_ansvarlig");
```

**Avgrensning:**
- **Lese-tilgang:** Ja (firma-HMS-ansvarlig kan se alle HMS-rapporter i firmaets prosjekter)
- **Behandling:** Nei (godkjenne, kommentere, redigere forblir begrenset til HMS-gruppen på prosjektet)
- **Cross-firma-tilgang:** Nei (kryssorg-deling deaktivert som default — bruker kan ikke se andre firmaers HMS-rapporter)

**Konsekvens for dokumentflyt.md § 2.3 (HMS-dokumenttype):**

«Admin/registrator: Kan lese alltid»-regelen utvides til:
- **Lese:** HMS-gruppe + admin/registrator + firma-HMS-ansvarlig (kontrolloppgave)
- **Behandling:** Kun HMS-gruppen (uendret)

**Implementasjons-fase:** Fase 0 — krever A.25 (OrganizationRole) som forutsetning. Tilgangskontroll-utvidelsen registreres som del av `tilgangskontroll.ts`-refaktor (per fase-0-beslutninger § E + Infrastruktur i syntese § 5).

**Tildeling:** Se [A.25 § Tildelings-policy](#a25-organizationrole-tabell-for-granulære-firma-roller--✅-vedtatt-2026-04-29). Firma-HMS-ansvarlig (`role="hms_ansvarlig"`) settes av `company_admin` på person fra samme firma. Skiller seg fra prosjekt-HMS-rolle (HMS-gruppe-medlemskap) som tildeles av prosjekt-admin.

### A.28 AnsattKompetanse + Kompetansetype — kompetansematrise i Fase 0.5 — ✅ **VEDTATT 2026-04-29**

**To-tabell-struktur verifisert mot SmartDok** (browser-research 2026-04-29). SmartDok har tre faner: Kompetanseoversikt (matrise-vy), Kompetansetyper (definisjonsregister, 77 typer hos A.Markussen), Brukernes kompetanser (CRUD-kobling, 362 rader hos A.Markussen).

**Datamodell:**

```prisma
model Kompetansetype {
  id              String    @id @default(uuid())
  organizationId  String    @map("organization_id")
  navn            String                                  // "M2 Gravemaskin" | "DO CAT 325" | "HMS-kurs 40t"
  kategori        String                                  // se KOMPETANSE_KATEGORIER nedenfor
  aktiv           Boolean   @default(true)                // SmartDok har aktiv/inaktiv-flagg
  defaultUtloperAarEtterUtstedt Int? @map("default_utloper_aar")  // null = ingen default-utløp
  beskrivelse     String?
  kobletTilEquipmentModell String? @map("koblet_til_equipment_modell")  // for DO-kobling Fase 6
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  organization      Organization       @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  ansattKompetanser AnsattKompetanse[]
  
  @@unique([organizationId, navn])
  @@index([organizationId, kategori])
}

model AnsattKompetanse {
  id                String    @id @default(uuid())
  userId            String    @map("user_id")
  kompetansetypeId  String    @map("kompetansetype_id")
  utstedtDato       DateTime? @db.Date @map("utstedt_dato")  // SmartDok kaller det "Fullført dato" — SiteDoc bruker norsk sertifikat-konvensjon (utstedelsesdato på beviset)
  utloper           DateTime? @db.Date
  utstederOrgan     String?   @map("utsteder_organ")
  sertifikatNr      String?   @map("sertifikat_nr")
  vedlegg           Json?                                  // [{url, filename, type, uploadedAt}] — per ServiceRecord-mønster
  notat             String?
  opprettetAvUserId String?   @map("opprettet_av_user_id")
  importertVia      String?   @map("importert_via")        // "manuell" | "csv" | "xlsx" | "hr_api" | "smartdok"
  importertVed      DateTime? @map("importert_ved")
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  user              User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  kompetansetype    Kompetansetype @relation(fields: [kompetansetypeId], references: [id], onDelete: Restrict)
  
  @@unique([userId, kompetansetypeId])
  @@index([utloper])
  @@index([kompetansetypeId])
}
```

**Kategori-katalog (SmartDok-bekreftet, seedes i `packages/shared/src/types/index.ts`):**

```typescript
export const KOMPETANSE_KATEGORIER = [
  "ANNET",
  "ARBEID PÅ / VED VEI",
  "DIVERSE KJØRETØY",
  "EGENDEFINERT",
  "HMS - FØRSTEHJELP",
  "TRUCK-/MASKINFØRERBEVIS",
  "FAGBREV/FAGSKOLE",
] as const;
```

**Avgrensning fra A.Markussen-research-infeksjon (per N2.2-PRINSIPP):** Kategori-listen seedes (verifisert 7-kategori-struktur fra SmartDok), men **ikke** A.Markussens 77 kompetansetyper. Hver kunde definerer egne typer ved bruk eller via CSV-import.

**Vedlegg-mønster:** Json-array på AnsattKompetanse (samme mønster som `ServiceRecord.vedlegg` i `db-maskin`):
```json
[{"url": "s3://...", "filename": "M2-bevis-Joakim.pdf", "type": "sertifikat", "uploadedAt": "2026-04-29T10:00:00Z"}]
```
Antall vedlegg = `array_length(vedlegg)`. Ingen separat `AnsattKompetanseVedlegg`-tabell. Refaktoreres til relasjons-tabell **kun hvis** søk/JOIN på vedlegg-metadata blir nødvendig (lite sannsynlig).

**Fil-import:**
- Format: CSV + Excel (`exceljs` allerede installert; `csv-parse` ny avhengighet)
- Påkrevde kolonner: `ansattnummer`, `kompetansetype`
- Valgfrie: `kategori`, `utstedt`, `utloper`, `utstederOrgan`, `sertifikatNr`, `notat`
- Auto-opprettelse av ukjente kompetansetyper ved import (importertVia="csv"/"xlsx")
- Atomisk import (alt eller intet) for første versjon

**Default-utløp:** SmartDok-mønster ikke kartlagt med eksakte verdier i research-docs. `defaultUtloperAarEtterUtstedt` settes som null som default — kunden setter eksplisitt utløp ved registrering. Kjente verdier (M2-bevis = 5 år, HMS-40t = ingen utløp) kan seedes senere når SmartDok-research utvides.

**Begrunnelse for Fase 0.5:**
1. Tabellene er kjerne-data (`packages/db`), ikke modul-spesifikke
2. Brukes av Timer (Fase 3), Mannskap (Fase 4), DO-kobling (Fase 6) — ingen modul har eksklusiv eierskap
3. Dag-1-bruk for A.Markussen krever at tabellene eksisterer før Fase 3 deployes
4. Naturlig bunke med Avdeling (per C.11 + ny C.14) i Fase 0.5
5. Per Kenneth-presisering 2026-04-29: kompetansematrise designes nå med fil-import — venter ikke på HR-API

**Implementasjons-fase:** Fase 0.5 (per C.14). Krever ikke A.25 (OrganizationRole) som forutsetning.

### A.29 Offline sync-konflikt-strategi — ✅ **VEDTATT 2026-04-29**

Erstatter naiv server-wins (A.23) med felt-nivå conflict-modal + grace-periode for token-rotasjon.

**Bakgrunn:** Sync-konflikt-analyse 2026-04-29 verifiserte mot kode at A.23 «server-wins» ikke er korrekt implementert i dag. Reell oppførsel er **«siste klient vinner»** — server-merge i `oppdaterData` er shallow `{...eksisterende, ...input.data}` uten timestamp-sjekk. Mobil-SQLite har `sistEndretLokalt` + `sistSynkronisert`-felter som aldri sendes til server eller valideres. Concurrent editing av samme rad gir stille tap av endringer uten audit.

**Vedtak — to deler:**

**1) Conflict-modal til bruker (datakollisjon):**

Ved sync-konflikt vises modal til klient som taper:
> «Bruker B har endret felt X til Y siden du gikk offline. Behold ditt svar (Z) eller godta B's?»

- **Felt-nivå merge,** ikke automatisk overskrivning
- **Hver felt-konflikt** vises separat (ikke samle-modal)
- Ved timeout / manglende klient-respons → fall tilbake til server-wins (A.23 default)

**2) Token-rotasjon recovery (grace-periode):**

- Server beholder `forrigeToken` i 60 sekunder etter rotasjon
- Klient som sender gammelt token får `200 OK` + `nyttToken` på nytt (idempotent)
- Eliminerer race window mellom server-update og klient-lagring uten å lempe sikkerhet vesentlig
- Etter 60 sek invalideres forrigeToken — UNAUTHORIZED → re-login som i dag

**Forutsetning før implementasjon:**
- `updatedAt` må sendes i alle `hentMedId`-returer (i dag utelatt fra mobil-payload)
- `oppdater`-mutations må ta `forventetServerUpdatedAt` som input
- Server validerer mismatch → kaster `CONFLICT`-feil med ny server-state

**Implementasjons-fase:** Fase 3 (utsatt). Designes inn i Timer-modul-bygging hvor de første offline-førlige skrivinger på linje-nivå realiseres. Pending edits-modal-mønsteret gjenbrukes for sjekkliste/oppgave når mobil-app neste oppdatering går ut.

**Berører:**
- `mobilAuth.verifiser` (apps/api/src/routes/mobilAuth.ts:159-181) — utvides med forrigeToken-felt
- `Session`-tabellen (Prisma) — tilføyes `forrigeSessionToken: String?` + `forrigeTokenExpires: DateTime?`
- Alle `oppdater*`-mutations på data-tabeller (Checklist, Task, Timer-rader senere)
- Mobil-klient (apps/mobile) — conflict-modal-komponent + auto-retry på 401 hvis biometri-cache finnes

**Sammenheng:**
- Erstatter delvis A.23 (beholdes som fallback-policy)
- Lukker P5.6 i [oppryddings-plan-2026-04-28.md](oppryddings-plan-2026-04-28.md) — sesjon-rotasjon-recovery er del av denne pakken
- Konsumerer behov for Activity-rad ved overskrivning (per A.3) — konflikt-resolving logges

### A.30 byggeplassId-NULL-semantikk — A1 — ✅ **VEDTATT 2026-04-30**

**NULL betyr «gjelder hele prosjektet»** — ikke mid-state, ikke per-modell-tolkning. Én konsistent regel på tvers av alle modeller med nullable `byggeplassId`.

**Bakgrunn:** Sync-konflikt-analyse 2026-04-30 verifiserte at A1 allerede er implementert i kode på tvers av routere og UI:

- `apps/api/src/routes/sjekkliste.ts:38` — `OR: [{byggeplassId: input.byggeplassId}, {byggeplassId: null}]`
- `apps/api/src/routes/oppgave.ts:51` — samme mønster via `drawing.byggeplassId`
- `apps/api/src/routes/psi.ts:8-14` — composite-key med NULL-permitert
- `apps/web/src/components/LokasjonVelger.tsx` — «fjern lokasjon» setter NULL eksplisitt
- `packages/db/prisma/schema.prisma:1164` (Psi) — eksplisitt kommentar `// null = gjelder hele prosjektet`

**Vedtaket lukker** intern motsigelse i [arkitektur-syntese.md § 5 Fase 0.5](arkitektur-syntese.md) (NULL-betydning var listet både som «åpent prinsipp» og «besluttet»). § 5 oppdateres til kun to gjenstående åpne prinsipper (default-byggeplass, FK vs jsonb).

**Modeller med nullable `byggeplassId` (7 stk):** Drawing, PointCloud, Checklist, Psi, FtdKontrakt, Task (indirekte via drawing), tegning-relaterte. Omrade har required `byggeplassId` (Cascade) — ikke berørt.

**Filtreringspattern (kanon):** Når bruker filtrerer på spesifikk byggeplass, OR-include NULL-rader. UI viser «Alle byggeplasser» som default — ikke separat «Ikke satt»-kategori.

**Konsekvenser for fremtidige moduler:**
- **Timer (Fase 3):** dagsseddel.byggeplassId nullable. NULL = timer ført uten byggeplass-spesifikasjon (gjelder hele prosjektet). Lønn/eksport-filtrering kan inkludere NULL ved spørring per byggeplass.
- **Mannskap-innsjekk (Fase 4):** byggeplassId required (geofence-innsjekk forutsetter spesifikk byggeplass). §15-liste-eksport per byggeplass viser kun rader for den byggeplassen, ikke NULL.
- **Funksjoner som krever byggeplass:** Kontrollplan, Mannskap-innsjekk, Område — required byggeplassId. UI viser «Opprett byggeplass først»-melding (eksisterende mønster).

**Edge-cases håndtert:**
- Prosjekt med 0 byggeplasser: dokumenter opprettes med NULL, vises i «alle byggeplasser»-vy senere
- Prosjekt med 1 byggeplass: ingen auto-tildeling. Brukerens valg av byggeplass i filter inkluderer NULL via OR
- Sletting av byggeplass: `onDelete: SetNull` bevarer dokumenter, mister kun byggeplass-kontekst (allerede implementert)

**Migrering:** Eksisterende NULL-rader bevares uten retro-tildeling.

**Lukker også:** [oppryddings-plan-2026-04-28.md](oppryddings-plan-2026-04-28.md) P1.4 (intern motsigelse) og 3A.7 (cross-modul-konflikt — overgår hit).

### A.31 Godkjenning-dokumentflyt-konsept omdøpes til Avklaring — ✅ **VEDTATT 2026-05-28**

**Beslutning:** Fase 0-konseptet «Godkjenning» (dokumentforløp til byggherre for kontraktsmessig avklaring av tilleggsarbeid, endringer, varsel, regningsarbeid) omdøpes til **Avklaring**.

**Begrunnelse:** «Godkjenning» som modul-/entitetsnavn kolliderer med eksisterende **status-verdi `"godkjent"`** i `DocumentTransfer.toStatus`. Navnekollisjonen skapte semantisk forvirring i kode-undersøkelse 2026-05-28 (Godkjenning som planlagt feature vs. godkjent som flyt-tilstand). Avklaring er bransje-naturlig norsk for byggherre-prosessen og kolliderer ikke med eksisterende terminologi.

**Definisjoner etter A.31:**

| Begrep | Hva det betyr | Domene |
|--------|---------------|--------|
| **Attestering** | Arbeider får lønn for registrert tid | Timer-modul |
| **Avklaring** | Dokument som leder til en beslutning fra byggherre (TE, endringsmelding, varsel, regningsarbeid → avklart/avvist) | Dokumentflyt |
| **Godkjent / avvist** | Status-verdier i `DocumentTransfer.toStatus` (gjelder ALLE dokumenttyper, ikke kun Avklaring) | Flyt-mekanikk |

**Erstatter:** A.8-tabellens andre rad («Godkjenning | Entreprenør kan fakturere mot byggherre | Dokumentflyt») — Avklaring tar over som modul-/konsept-navn. A.8 selv beholdes som historisk anker; A.31 supersederer raden om Godkjenning.

**Påvirker (ikke implementert ennå — schema-renamen tas når Avklaring bygges):**
- `model Godkjenning` (`schema.prisma:984-1027`) → `model Avklaring`
- `DocumentTransfer.godkjenningId` (linje 1033) → `DocumentTransfer.avklaringId`
- `Godkjenning.endretEtterSending` / `sistEndretVed` / `godkjentVed` / `godkjentAvUserId` — feltnavn endres tilsvarende (`endretEtterSending` beholdes som generell semantikk; `godkjentVed/AvUserId` → `avklartVed/AvUserId`)
- Tabellnavn `godkjenninger` → `avklaringer`
- A.2-seksjon i denne fila (Godkjenning — utvidet dokumentflyt-type) får note om rename
- BACKLOG-entries med «Godkjenning-modul» → «Avklaring-modul»

**Bevares uten endring:**
- `DocumentTransfer.toStatus = "godkjent"` (status-verdi, ikke modul-navn) — gjelder fortsatt alle dokumenttyper
- `DokumentflytMedlem.rolle = "godkjenner"` — dokumentflyt-rolle, ikke modul (jf. A.8 bekreftelse linje 337)
- Timer-attestering (A.8 første rad) — uendret

**Status:** Godkjenning-konseptet er IKKE implementert i UI/API i dag (verifisert 2026-05-28: ingen `apps/api/src/routes/godkjenning.ts`, kun `Godkjenning`-modell i schema + redirect-stub `timer/godkjenning/page.tsx` → `attestering`). Renamen kan gjennomføres rent uten data-migrasjon når Avklaring bygges som modul.

**Konsekvens for sannhetskilder:**
- [terminologi.md](terminologi.md) får ny rad for Avklaring og note om at Godkjenning-modul-navnet er erstattet (men status-verdien `godkjent` fortsatt finnes)
- [arkitektur-syntese.md](arkitektur-syntese.md) — referanser til Godkjenning-modul oppdateres ved neste rens
- [dokumentflyt.md](dokumentflyt.md) — eventuelle Godkjenning-modul-referanser oppdateres ved neste rens

---

## T. Timer-modul arkitektur (låst 2026-05-11)

Egen prefiks T (Timer) for å holde timer-spesifikke arkitektur-beslutninger samlet. Alle vedtatt 2026-05-11 etter kartlegging dokumentert i [STATUS-AKTUELT.md](STATUS-AKTUELT.md) § «Timer-modul revisjon — kartlegging 2026-05-11».

### T.1 DailySheet eierskap — ✅ **VEDTATT 2026-05-11**

DailySheet tilhører arbeider/firma, ikke prosjekt.

- `projectId` fjernes fra `DailySheet`.
- Unique constraint endres fra `(userId, projectId, dato)` til `(userId, dato)`.
- Én sedel per arbeider per dag — uavhengig av antall prosjekter arbeideren jobber på den dagen.

**Begrunnelse:** Arbeideren registrerer sin arbeidsdag som én enhet. Hvilke prosjekter timene fordeles på er en rad-egenskap, ikke en sedel-egenskap.

### T.2 Prosjekttilhørighet på rad-nivå — ✅ **VEDTATT 2026-05-11**

`projectId String NOT NULL` legges til `SheetTimer`, `SheetMachine` og `SheetTillegg`.
`byggeplassId String?` legges til samme tabeller.

Tre separate tabeller beholdes — ingen konsolidering til én `SheetLine`-tabell. Hver rad-type har egen `attestertSnapshot Json?` som er type-spesifikk (Lonnsart-snapshot vs Equipment-snapshot vs Tillegg-snapshot).

**Vareforbruk** har allerede `projectId String` NOT NULL i `packages/db-varelager` — ingen schema-endring nødvendig der.

### T.3 Attestering — Alternativ A — ✅ **VEDTATT 2026-05-11**

Dagsseddelen er **container uten egen attesterings-status**. Attestering skjer per prosjektgruppe av rader på sedelen.

**To attesterings-nivåer i UI:**
- **Prosjektleder** — attesterer rader for sitt prosjekt
- **Firma-admin** — attesterer på tvers av firma

**SiteDoc superadmin** har teknisk tilgang ved behov for kundestøtte/feilsøking. Eksponeres **ikke** i UI og kommuniseres **ikke** til kunder.

**Konsekvens for schema:** `DailySheet.status` + `attestertAvUserId` + `attestertVed` fjernes eller flyttes til rad-nivå/prosjekt-gruppering. Detaljert datamodell besluttes i PR 1-planlegging.

### T.4 Fra/til per rad — ✅ **VEDTATT 2026-05-11**

`fraTid String?` og `tilTid String?` (HH:MM-format) legges til `SheetTimer` og `SheetMachine`.

`startAt` og `endAt` beholdes på `DailySheet`-nivå som **forenklet forslag** til arbeideren (default-rammen for arbeidsdagen). Den faktiske tidssettingen ligger på rad-nivå.

**Validering:** `fraTid < tilTid` per rad. Server- og klient-side.

**Lukker kundeønske #3.**

### T.5 Avrunding — ✅ **VEDTATT 2026-05-11**

`tidsrundingMinutter Int? @default(15)` legges til `OrganizationSetting`.

**Støttede verdier:** 15, 30, 60, `null` (ingen avrunding).

Avrunding anvendes ved registrering/lagring av rad-timer. Implementasjon (rund opp/ned/nærmeste) presiseres i PR 2-design.

### T.6 Leveransestrategi — ✅ **VEDTATT 2026-05-11**

To PR-er, sekvensielle:

1. **PR 1** = schema + migrasjon. Inkluderer alle T.1–T.5 schema-endringer. Backfill av eksisterende DailySheet-rader (kopier `projectId` til alle SheetTimer/SheetMachine/SheetTillegg-rader, fjern `projectId` fra DailySheet til slutt).
2. **PR 2** = API + UI + mobil. Refaktorerer ~120–150 callsites (kartlagt i STATUS-AKTUELT.md). Inkluderer attestering-flyt-endring per T.3.

PR 2 **starter ikke** før PR 1 er deployet og verifisert på prod.

**Begrunnelse:** Schema-endring av denne størrelsen krever isolert prod-verifikasjon før applikasjonslag-endringer påbygges. Reduserer rollback-overflate.

### T.7 — Dagsseddel UI-redesign (låst 2026-05-12)

Dagsseddelen redesignes med prosjekt-gruppert struktur:

- Øverst: «Arbeidstid i dag» Fra kl. / Til kl. / Pause — gjelder hele dagen
- Hoveddel: én seksjon per prosjekt, hver med timer-, maskin- og vare-rader
- Hver timer-rad: lønnsart, aktivitet, fra/til, beregnet timer, underprosjekt (ECO)
- Løpende summering nederst: «X.Xt av Y.Yt registrert» — grønn når komplett
- Geo-forslag: GPS-avstand mot Project.lat/lng foreslår prosjekt automatisk
- «+ Legg til prosjekt» for å legge til ny prosjektgruppe
- Gjelder web og mobil
- Forutsetter: T.1–T.6 (projectId per rad, fra/til-felt) ✅
- Planlegges i egen sesjon etter kundeliste er ryddet

**URL-struktur (låst 2026-05-12 — Alternativ C med tre kontekster):**

| URL | Kontekst | Bruker |
|---|---|---|
| `/dashbord/timer/[id]` | Arbeider-registrering (firma-kontekst, ikke prosjekt-bundet) | Den ansatte selv |
| `/dashbord/[prosjektId]/timer/attestering` | Prosjektleder-attestering | Prosjektleder for ett prosjekt |
| `/dashbord/firma/timer/attestering` | Firma-admin-attestering på tvers | Firmaadmin/HMS-ansvarlig |

Dagens sti `/dashbord/[prosjektId]/timer/[id]` blir misvisende når sedel kan spenne flere prosjekter. Beholdes som server-side redirect-stub for bakoverkompatibilitet (eldre bokmerker, eksterne lenker) — peker til ny `/dashbord/timer/[id]` uten prosjekt-prefix.

**Plattform-prioritet (låst 2026-05-12):** Web først. Mobil får egen refaktor-PR FØR T.7-mobil-implementasjon, fordi `apps/mobile/app/timer/[id].tsx` (2084 linjer) må splittes til komponenter før prosjekt-gruppe-konseptet kan innføres uten regresjons-risiko.

**Leveranserekkefølge (låst 2026-05-12):**

| PR | Innhold | Avhenger av |
|---|---|---|
| **PR T7-0** | Mobil-refaktor — splitt `apps/mobile/app/timer/[id].tsx` til komponenter (TimerSeksjon, TilleggSeksjon, MaskinSeksjon, modaler). INGEN funksjonalitetsendring. | T.1–T.6 ✅ |
| **PR T7-1** | Web ny dagsseddel — prosjekt-gruppert UI, multi-prosjekt, løpende summering, geo-forslag. Inkluderer ny URL `/dashbord/timer/[id]` + redirect-stub fra gammel sti. | T.1–T.6 ✅ |
| **PR T7-2** | Web attestering — `/dashbord/[prosjektId]/timer/attestering` (prosjektleder) + `/dashbord/firma/timer/attestering` (firma-admin på tvers). Krever T.3-attestering-flyt-utvidelse (per-rad-attestering). | PR T7-1 |
| **PR T7-3** | Mobil dagsseddel — speil av PR T7-1 strukturen på mobil. | PR T7-0 + PR T7-1 |

PR T7-2 starter etter PR T7-1 er deployet og verifisert på prod. PR T7-3 kan i prinsippet kjøre parallelt med PR T7-2, men anbefales sekvensielt for å redusere mobil-test-overflate.

**PR T7-2 forutsetter T.3 Alt A (per-rad-attestering). Scope inkluderer:**

1. **T.3 Alt A** — leder attesterer kun sine rader; sedel er container uten egen attesterings-status
2. **Refaktor** av `[prosjektId]/timer/attestering/[id]/page.tsx` til projectId-løs felleskomponent
3. **Ny `/dashbord/firma/timer/attestering/`-side** (liste + detalj) gated på firma-admin
4. **Ny server-query:** `hentTilAttesteringFirma({ organizationId })` — aggregerer sedler på tvers av prosjekter i firmaet hvor minst én rad har `status="sent"`. Gates med `autoriserAdminForFirma`. Tilsvarende `kanAttestereFirma({ organizationId })` for sidebar-gating.

**Splitting-regler (låst 2026-05-12):**

- En rad kan splittes i to eller flere nye rader
- Hver ny rad kan ha ulikt prosjekt, underprosjekt (ECO), lønnsart og fra/til
- Sum av timer på nye rader må matche original-raden (validering server-side)
- Splitting kan gjøres av: attesterende prosjektleder (egne prosjekt-rader) + firma-admin (alle rader)
- Audit-log: original rad markeres som splittet, nye rader refererer til original via `parentRadId`
- Eksempel: Prosjekt A | 07:00–16:00 | 9t → Prosjekt A | 07:00–12:00 | 5t + Prosjekt B | 12:00–16:00 | 4t

**Firminnstilling direkteredigering ved attestering (låst 2026-05-12):**

- Nytt felt på `OrganizationSetting`: `tillattRedigerVedAttestering Boolean @default(false)`
- `true`: firma-admin kan redigere rader (timeantall, fra/til, ECO, lønnsart) direkte under attestering uten å returnere sedelen til arbeider
- `false` (default): kun returner-flyt tillatt — leder må skrive kommentar og sende sedel tilbake til arbeider for korreksjon
- Implementeres som del av PR T7-2b
- Alle redigeringer loggføres i audit-log uavhengig av innstilling (Activity-tabell med `actorId` + `before`/`after`-payload)
- Splitting-regler over (rad-splitting) er tillatt uavhengig av denne innstillingen — splitting er attestering-flyt-mekanikk, ikke verdi-endring

**Flytskille (låst 2026-05-16):**

- Arbeidstaker: registrerer timer — ingenting annet
- Attestering (prosjektleder): bekrefter at timer er korrekte — IKKE godkjenning til Byggherre
- Godkjenning til Byggherre: SEPARAT prosess i dokumentflyt-modulen
  → Byggherre kan avvise timer → ikke fakturerbart, men fortsatt prosjektkostnad
  → Timer-modulen styrer ALDRI timer direkte til Byggherre

**Dagsseddel-struktur (låst 2026-05-16):**

Grupperes per prosjekt+ECO — ikke per radtype.

```
Prosjekt A (ECO=null): Arbeidstimer + Maskintimer (≤ arb.t A) + Vareforbruk
Prosjekt B (ECO=null): Arbeidstimer + Maskintimer + Vareforbruk
Prosjekt B (ECO=B.1):  Arbeidstimer + Maskintimer (≤ arb.t B.1) + Vareforbruk
                       → Godkjenning via dokumentflyt (ikke timer-attestering)
```

GPS: finner prosjekt A og B, ikke ECO/underprosjekt (manuell valg av arbeider).
Datamodell (`projectId` + `externalCostObjectId`) er KORREKT. Kun UI-gruppering mangler.

### T.8 — Innsjekk-basert prosjektforslag i dagsseddel (låst 2026-05-12)

> **✅ VEDTATT 2026-06-20: Alternativ B (auto-utkast) — BYGGET (Slice 3, develop 2026-06-20).** Modulen auto-skriver dagsseddel-utkast (`draft`) fra GPS-dagflyt; arbeider ser alt, kan redigere/slette enhver auto-rad, og **godkjenner ved innsending** (`draft → sent`). Ingen lønn uten menneskelig godkjenning.
>
> **Viktig historikk:** auto-*opprettelsen* (draft + arbeidstid/overtid/reise-rader ved «Slutt dag») var **allerede live fra «Start dag/Slutt dag»-MVP 2026-06-06** (`genererForslag`, `StartSluttDagKort.tsx`). Den opprinnelige T.8-formuleringen «aldri auto-rad» beskrev altså et **eksisterende avvik** mot koden — ikke en regel Slice 3 brøt. Slice 3 (2026-06-20) la til UX-signallaget (auto-fyll-banner, lokal `autoGenerert`-markør, reise-rad-merking) + idempotens (naviger til eksisterende `(userId,dato)`-draft) og **retter formuleringen: «aldri auto-rad» → «aldri auto-innsending»**.
>
> L1 byggeplass-GPS (2026-06-20) er fortsatt ren dokumentasjon. Utredning: [timer-gps-prosjekt-utredning.md](timer-gps-prosjekt-utredning.md).
>
> **Slice 4 (2026-06-20/21):** midnatt-splitt (4a) + glemt-dag-prompt (4b-1) + `DailySheet.sluttTidKilde` 3-verdi (`bruker`/`midnatt`/`system`) + arbeidstids-varsel (4b-2). System-gjettet slutt-tid (glemt-dag-gjenoppretting) merkes `system` → kontroll-badge i attestering. Full spec: [BACKLOG.md § Slice 4](BACKLOG.md).

Når arbeider åpner «Ny dagsseddel», foreslås prosjekt basert på innsjekk-historikk fra Mannskap-modulen (Fase 4). Arbeider bestemmer alltid selv — forslaget kan overstyres.

**Forslags-prioritet:**

1. Aktiv innsjekk i dag (arbeider er fortsatt på byggeplass) → foreslå det prosjektet
2. Siste utsjekk i dag (arbeider har forlatt) → foreslå det prosjektet
3. Ingen innsjekk i dag → fall tilbake til GPS-avstand (dagens T7-1b-implementasjon)
4. Ingen GPS-koordinater → ingen forslag

**Separasjons-prinsipp (REVIDERT 2026-06-20 etter Alt B / Slice 3 — gjelder framtidig *innsjekk*-kobling fra Mannskap Fase 4, ikke dagens GPS-dagflyt):**

- **Aldri auto-*innsending*:** auto-skrevne rader havner alltid som `draft`; lønn krever menneskelig godkjenning ved innsending (`draft → sent`). (Erstatter den gamle «aldri auto-rad» — som var et avvik mot koden, jf. banneret over.)
- Arbeider kan redigere/slette enhver auto-rad før innsending
- Fremtidig Mannskap-innsjekk (Fase 4) er fortsatt kun *hint* i prosjekt-forslag — den trigger ikke i seg selv auto-dagsseddel (GPS-dagflyt via «Start/Slutt dag» gjør det)

**Avhengigheter:**

- Krever Fase 4 Mannskap-modul (innsjekk/utsjekk-tabeller i `db-mannskap`)
- Krever koordinater på Byggeplass (ikke implementert — se [STATUS-AKTUELT.md](STATUS-AKTUELT.md))
- Dagens T7-1b GPS-forslag er MVP inntil Fase 4 er klar

Implementeres som del av Fase 4 — ikke T7.

### T.9 — Firmakalender (arbeidstidskalender) — besluttet 2026-05-15

**Datamodell:** Variant B (dynamisk) i `packages/db` (kjernen, ikke db-timer).
Tabell: ArbeidstidsKalender med feltene id, organizationId, aar, dato, type, navn, timerOverstyr, aktiv.
Type-enum: helligdag | fellesferie | klemdager | sommertid_start | sommertid_slutt | halvdag | firma_fri
Unique constraint: (organizationId, dato)

**Sommer/vinter:** Valgfritt per firma. Flertall firmaer bruker flat dagsnorm (7.5t).
Firma med sommer/vinter definerer sommertid_start og sommertid_slutt per år.
Sommertid = 8t arbeid + 30min pause. Vintertid = 7t + 30min pause.
Ingen sommer/vinter-poster = fall back til OrganizationSetting.dagsnorm.

**Halvdager:** Firma-definerte per dato. timerOverstyr-feltet angir antall timer (f.eks. 3.5).
Tariff-variabelt — kan endres fra år til år.

**DB-plassering:** packages/db (kjernen) — kalenderen angår mer enn timer-modulen.

**Tidsrunding (T.5 utdypet):** Visuelt ved input — pickeren avrunder til nærmeste tidsrundingMinutter.
Det brukeren ser er det som lagres. Ingen server-side runding bak ryggen.

**Offline-strategi mobil:** Lokal cache (arbeidstidskalender_local) — samme mønster som prosjektKatalog.
Oppdateres ved login og nett-gjenkomst. Nødvendig for halvdag-visning uten nett.

**Import:** `beregnNorskeHelligdager(aar: number)` via innebygd Gauss-påskealgoritme
(~30 linjer). Ingen ekstern dato-bibliotek-avhengighet. Plasseres i
`packages/db/src/seed/helligdager.ts`. Norske helligdager er nasjonale (ingen
region-varianter), så de 12 årlige datoene (5 faste + 7 bevegelige relativt til
1. påskedag) beregnes deterministisk uten tidssone-håndtering. Firma legger til
klemdager, halvdager og sommertid manuelt.

**Endring fra opprinnelig spec (2026-05-15):** Tidligere antok at `date-fns-tz`
trengtes for å beregne bevegelige helligdager. Verifisert at vi lagrer `date`
(uten tid), så tidssone er irrelevant. Gauss-algoritmen gir påskedato i ren
heltall-aritmetikk — de seks øvrige bevegelige helligdagene avledes av offset.

**Avhengigheter som venter på denne:**
- T.4 (fra/til per rad) — trenger kalender for standard arbeidstid-forslag
- T.5 (tidsrunding) — trenger kalender for korrekt dagsnorm
- SummeringsBanner.tsx (T7-3a) — må oppdateres til å lese dagsnorm fra kalender-cache
- ~~Auto-fordeling normaltid/overtid — trenger kalender for terskelverdi~~ **Droppet 2026-05-16** — besluttet å ikke implementere. Kunden registrerer lønnsart manuelt per rad (gjeldende praksis).

### T.10 — Ikke-prosjekt-tid (Alt C) + oppmøtested + reise-regelsett — besluttet 2026-06-08

Beslutningssett for reise, oppmøtested og ikke-prosjekt-tid. Grunnlag: [OPPSUMMERING-timer-arkitektur.md](OPPSUMMERING-timer-arkitektur.md) (fil:linje verifisert mot kode). Spec i [timer.md § Planlagte arkitektur-utvidelser](timer.md); schema-skisse i [arkitektur.md](arkitektur.md). Faseinndelt via SPOR 3 — ikke kodet. Alt additivt → enkelt-stegs.

**Ikke-prosjekt-tid (Alt C):** Internt arbeid + maskinvedlikehold = interne `Project`-rader (`Project.type "kunde"|"internt"`, default "kunde"). **T.2 (`projectId NOT NULL`) gjenåpnes IKKE** — prosjekt-isolasjon urørt, ~185 projectId-bruksstedene urørt. Dynamisk intern-liste = eksisterende `Aktivitet` (firma-scoped), ingen ny katalog. Kostnadsbærer = `SheetTimer.vehicleId String?` (svak FK → Equipment), distinkt fra `SheetMachine.vehicleId` (drift, jf. C.18). Tilgang til interne prosjekter via `type="internt"`-unntak i `verifiserProsjektmedlem`. **Ingen fordelingsmotor i SiteDoc** (regnskap/ProAdm eier fordeling).

> **✅ IMPLEMENTERT (Fase 2, 2026-06-09, develop/test — venter dual-review):** Migrasjoner `20260609140000_project_type_fase2` + `20260609140100_sheet_timer_vehicle_id_fase2` (begge additive). 2 interne prosjekter seedet per firma («Internt arbeid» + «Verksted/maskinvedlikehold»). **Vilkår 3 (Kenneth):** intern-prosjekt-seed enabler INGEN andre prosjektmoduler — `syncProjektModulerPaaAktiver` ekskluderer `type="internt"`, og seeden oppretter verken ProjectMember, ProjectOrganization eller ProjectModule. §2.D vehicleId→Equipment.organizationId-validering håndhevet på alle skrive-stier. Detaljer + fil-referanser i [timer.md § Ikke-prosjekt-tid](timer.md).

**Oppmøtested:** egen geo-entitet i kjernen (søsken til `Avdeling`) med `lat/lng/radiusM` + valgfri `avdelingId`. GPS identifiserer kontor + dokumenterer inn/ut + foreslår starttid — aldri auto-rad (T.8). MVP på `Project.latitude/longitude` (byggeplass-GPS er senere, T.8).

**Reise:** kompensert kun kontor→byggeplass / byggeplass→byggeplass (ikke hjem→arbeidssted). Reisetid = lønnsart-rad utenfor overtid (ikke avstands-/godtgjørelse-sats). Reise-regelsett = konfigurerbar firmainnstilling på `OrganizationSetting` (`reiseTerskelMin` m.fl.), ikke regelmotor. Terskel + lovlighet per firmas tariff/avtale.

**Firma-isolasjon:** timer-data isoleres på `organizationId` (sikkerhetslag, `DailySheet` org-eid per T.1). ⚠️ **Kjent issue (ikke fikset):** `rapport.ts:80-92` mangler org-filter → cross-firma-lekkasje på delte prosjekter; `tilfoyTimerRad` mangler firma-grense-sjekk. Fikses SPOR 3 Fase 1b. Forretningslag (G1): firma-nivå tilgang, GPS = smart velger, ikke hard port.

### T.11 — Maskin-registrering gated på kompetansematrise — ✅ VEDTATT 2026-06-20

«Maskinfører» er ikke en rolle i modellen — maskinbruk er data (`SheetMachine`). Maskin-registrering (maskin-seksjonen på dagsseddel) styres i stedet av **kompetansematrisen**: eksponer maskin-registrering kun for arbeidere som i matrisen er huket av for maskinfører / 40-timers kurs. Mekanisme: aktiv, ikke-utløpt `AnsattKompetanse` med `Kompetansetype.kategori = "TRUCK-/MASKINFØRERBEVIS"` (+ evt. 40t-kurs-type). Senere (Fase 2 / DO-kobling): begrens hvilket utstyr via `Kompetansetype.kobletTilEquipmentModell`. Gating kommer i tillegg til dagens soft-skjul på Equipment-cache.

**Forutsetning (ikke bygget):** kompetanse er IKKE synket til mobil (0 referanser i `apps/mobile`). Offline-gating krever ny lokal cache (`kompetansetype_local` + `ansatt_kompetanse_local`) + sync FØR T.11 kan implementeres.

#### Implementert (Funksjon #3, 2026-06-22) — soft-flagg, ikke hard gating

Forutsetningen over («full kompetanse-cache til mobil») viste seg unødvendig: i stedet for å replikere hele matrisen ned, **avleder serveren ett boolean per bruker** og synker kun flagget. Fire beslutninger låst:

- **(1a) Gating-regel — kun maskinførerbevis.** Maskin-registrering vurderes mot kategori `MASKINFORERBEVIS_KATEGORI = "TRUCK-/MASKINFØRERBEVIS"` (gyldig = `utloper` null eller ikke utløpt; `kompetanseStatus() !== "utlopt"`). **40-timers teorikurs er forløper/delkomponent i maskinfører-løpet fram mot beviset** — ikke et urelatert kurs og ikke et eget gating-punkt. Vi gater på det fullførte beviset, som fanger løpet implisitt når beviset er registrert som gyldig kompetanse. (40t som generell plass-/verneombud-tilgang hører eventuelt hjemme i mannskap/PSI, ikke i maskin-gating.)
- **(1b) Ett grovt flagg.** `harGyldigMaskinforerbevis: boolean` per (bruker, org) — «har minst én gyldig maskinførerbevis-kompetanse». Ikke fin-matchet mot maskinmodell ennå (`kobletTilEquipmentModell` er fritekst, tynt utfylt — **Fase 6-utvidelse** for DO-kobling).
- **(2) Ingen migrering.** Rent avledet server-side. Mobil bærer flagget per org i **SecureStore** (`sitedoc_maskinforerbevis`), hentet sammen med equipment-cachen (`refreshMaskinKatalog`, login + nett-gjenkomst). Ingen SQLite-kolonne, ingen Prisma-migrering.
- **(4) Live, ikke snapshot.** Leder-varselet beregnes live mot dagens kompetanse ved attestering-tidspunkt (avledet `manglerMaskinforerbevis` per sedel i `hentForAttestering` + `hentTilAttesteringFirma`). Revisjonsspor kan senere legges i eksisterende `SheetMachine.attestertSnapshot` — ikke bygget nå.

**Soft-flagg, aldri blokkerende** (jf. «flagg, ikke avvis», samme mønster som arbeidstids-varselet i Slice 4b-2): MaskinSeksjon vises og lagring tillates uendret — varselet er informativt («flagget for synlighet»), ikke anklagende. Arbeider ser eget varsel (`timer.maskinforerbevis.arbeider`); leder ser per-sedel-varsel i attestering web+mobil (`timer.maskinforerbevis.leder`). Synlighet av maskin-seksjonen styres fortsatt av Equipment-cache-gaten (`harEquipmentCache`) — uendret.

Service: `apps/api/src/services/kompetanse/maskinforerbevis.ts` (`harGyldigMaskinforerbevis` + `...Batch`). Mobil-status-query: `kompetanse.minMaskinstatus`.

### T.12 — Produksjonsbeskrivelse (fritekst) per timer-rad — ✅ VEDTATT 2026-06-20

Arbeider skal kunne skrive fritekst «hva jeg har gjort» **per timer-rad** (ikke tallmengde). Nytt nullable fritekstfelt på `SheetTimer` (per aktivitet) + to-stegs migrering (per migrasjonspolicy). Eksisterende `DailySheet.beskrivelse` (dag-nivå) er forkastet som for grovt. Eksport: **utsatt** — rapport-valg (hva som tas med i utskrift) utvikles senere når timeregistrering er funksjonell; inntil da intern dokumentasjon.

> **Konsekvens-notis (avklart ved Funn #1-reversering 2026-06-21):** Numerisk **produksjonsmengde hører til vareforbruk-modulen (`db-varelager`), IKKE timeregistrering.** Et `mengde`+`enhet`-felt på `SheetTimer` ble bygget i sin helhet (server+mobil+web+sync+migrering) og **fullstendig revertert** — mengde på timer-rad er forkastet. **T.12 forblir fritekst-only.** Produksjonsmengde tas opp som egen runde i vareforbruk-modulen senere.

---

## B. ÅPNE BLOKKERER-SPØRSMÅL — må besluttes før koding

Disse er identifisert i Opus-runde 3 (2026-04-26) og blokkerer Fase 0-koding.

### B.1 ECO timerregistreringApen default — true eller false? — ✅ **LUKKET 2026-04-27**

**Problem:** Default `false` betyr ALLE importerte ECO er låst for time-registrering ved import. Joakim ser tom dropdown. Hvis ProAdm-import ikke setter den til `true`, må prosjektleder manuelt åpne hver ECO.

**Forslag:** Default `true`. Eksplisitt admin-handling lukker en ECO.

**Status:** ✅ **BESLUTTET — Alternativ a (default true).** `ExternalCostObject.timerregistreringApen Boolean @default(true)`. Når ECO opprettes (manuell, ProAdm-import, felt-opprettet) er timeregistrering åpen umiddelbart. Prosjektleder lukker eksplisitt når ECO ikke skal brukes.

**Risiko-mitigering (allerede vedtatt):**
- C.6: `lukketAvUserId`/`lukketVed`/`lukketGrunn` på ECO
- C.7: Soft-delete på ECO
- Eksport-modulen kan vise advarsel hvis timer registreres mot ECO som burde vært lukket

**Begrunnelse:** Matcher A.Markussens nåværende SmartDok-praksis (alle underprosjekter åpne by default). ProAdm er sannhetskilden — hvis underprosjekt eksisterer i ProAdm, skal det brukes.

**Konsekvens for A.1:** Oppdater Prisma-blokken — `timerregistreringApen Boolean @default(true)` (var `false`).

### B.2 Bytt rekkefølge K.5 og K.6 i migrerings-rekkefølgen — **BESLUTTET 2026-04-27**

**Problem:** K.5 (`ProjectModule.organizationId`) bakfylles fra `Project.primary_organization_id`. K.6 (`Project.primaryOrganizationId`) må eksistere FØRST.

**Forslag:** Endre planen til K.6 → K.5.

**Status:** ✅ **LUKKET** — § E reflekterer beslutningen. Project.primaryOrganizationId (steg 4) kommer før ProjectModule-utvidelse (steg 5) i nåværende rekkefølge. Beholdt her for historikk.

### B.3 Godkjenning.endretEtterSending — felt eller annen mekanisme? — ✅ **LUKKET 2026-04-27**

**Problem:** I.1 referer eksplisitt til `endretEtterSending`-felt som mekanisme for ProAdm-konflikt-håndtering. Modellen i A.2 inneholder ikke feltet.

**Forslag:** Legg til `endretEtterSending Boolean @default(false)` på Godkjenning, eller endre I.1 til å bruke avledet logikk (sjekk om siste DocumentTransfer.kostnadSnapshot avviker fra opprinnelig signering).

**Status:** ✅ **BESLUTTET — Alternativ a (eksplisitt felt).**

**Felter på Godkjenning (legges til i A.2-modellen):**
- `endretEtterSending Boolean @default(false)`
- `sistEndretVed DateTime?` (Timestamptz per B.6)

**Trigger-logikk:**
- Settes `true` når kostnad endres etter Godkjenning er sendt (status === `"sent"` eller senere)
- Aktiveres på ProAdm-cost-update mot tilknyttet ECO
- Aktiveres på FtdChangeEvent som påvirker tilknyttet ECO
- Resettes til `false` ved status-overgang til `"sent"` (ny sending) eller `"approved"`

**Sentral hjelpefunksjon:**
- `markerEndretEtterSending(godkjenningId)` eksisterer som ETT sentralt punkt — alle kostnad-endringer kaller denne for å unngå glemte triggere
- Dekkes av test for hver kjent kostnad-endrings-vei

**Hva regnes som «kostnad-endring»:**
- Alt som påvirker `kostnadSnapshot` på Godkjenning
- Sannsynligvis: ny T-nota tilknyttet ECO, manuell ECO-kostnad-justering, ProAdm-resync som endrer kostnad
- Presiseres når Godkjenning faktisk bygges

**Activity-logging:** Kostnad-endring logges uansett (per A.3). Trigger-logikken kobler til samme hendelse — ikke duplisert.

**UI-konsekvens:** Byggherrens flytboks viser rødt flagg eller «endret»-indikator når `endretEtterSending === true`. Etter ny sending: flagg fjernes.

**Begrunnelse:** Performance i lister, klar UI-kode, sporbart i Activity, resettbar livssyklus. Avledet logikk er overengineering for ja/nei-spørsmål.

**Konsekvens for A.2:** Oppdater Prisma-blokken — legg til `endretEtterSending Boolean @default(false)` og `sistEndretVed DateTime?`.

### B.4 Standalone-prosjekt + ProjectModule.organizationId — **BESLUTTET (interim) 2026-04-27**

**Problem:** Standalone-prosjekt har `Project.primaryOrganizationId IS NULL`. Bakfyll i K.5 setter `ProjectModule.organization_id = NULL`. Plan-steg 2 «SET NOT NULL» bryter da migreringen.

**Alternativ A:** Tillat NULL permanent for standalone. Bryter med planens steg 2.
**Alternativ B:** Opprett seed «system-org» med UUID `00000000-0000-0000-0000-000000000000`. Standalone prosjekt får default organizationId = system-org.

**Status:** ✅ **BESLUTTET (interim)** — `Project.primaryOrganizationId` og `ProjectModule.organizationId` forblir **nullable** i Fase 0. NOT NULL-håndhevelse innføres ikke nå.

**Begrunnelse:** Endelig regel er at alle prosjekter skal tilhøre et firma med firmamaler, men:
- Firmamal-struktur er ikke designet ennå
- Designet forutsetter at timer + maskin + GPS-sporing er implementert først
- Project-opprettelses-flyten er ikke ferdig

**Oppfølgingspunkt (post-Fase 1):**
- Designe firmamal-struktur (OrganizationTemplate, E-steg 7 i nåværende § E)
- Migrere eksisterende Project uten primaryOrganizationId (hvis noen)
- Gjøre `Project.primaryOrganizationId` NOT NULL
- Gjøre `ProjectModule.organizationId` NOT NULL
- Oppdatere oppretter-flyt til å kreve organizationId

**Konsekvens for § E:** Steg 5 i Fase 0 setter ikke NOT NULL på ProjectModule.organizationId. NOT NULL-konvertering flyttes fra «Etter alle 13 er kjørt»-listen til post-Fase 1-arbeid.

### B.5 UE-identifikasjon — én sannhet — ✅ **LUKKET 2026-04-27**

**Problem:** UE kan identifiseres både via `User.organizationId !== prosjekt.primaryOrganizationId` OG via `ProjectMember.role = "underentreprenor"`. Risiko for drift.

**Konkret eksempel:** Joakim tilhører Bravida-org, men har `ProjectMember.role = "worker"` på A.Markussen-prosjekt. Eksport filtrerer ut basert på org (UE = ekstern lønn). UI viser ALLE timer (ikke filtrert basert på rolle). Inkonsistens.

**Forslag:** Bruk `User.organizationId`-mismatch som primær. Rolle-feltet utledes som UI-tag, ikke lagres som egen verdi.

**Status:** ✅ **BESLUTTET — Alternativ a (User.organizationId-mismatch er PRIMÆR).**

**Utledning** (i `packages/shared/src/utils/`, ny fil eller utvidelse av `flytRolle.ts`):

```typescript
function erUnderentreprenor(
  user: { organizationId: string | null },
  project: { primaryOrganizationId: string | null }
): boolean {
  return user.organizationId !== null
      && project.primaryOrganizationId !== null
      && user.organizationId !== project.primaryOrganizationId;
}
```

**Edge cases:**
- `User.organizationId === null` → IKKE UE (standalone-bruker, ingen firma-kontekst)
- `Project.primaryOrganizationId === null` → IKKE UE (standalone-prosjekt per B.4 interim)
- Bytter user firma midt i prosjekt → UE-status oppdateres automatisk ved neste sjekk. ProjectMember-historikk bevares
- Frilanser uten firma → standalone-bruker, ikke UE. Tilgang via ProjectMember alene
- **Intern UE-behandling** (egen ansatt skal behandles som UE på spesifikt prosjekt) → IKKE støttet i denne beslutningen. Hvis behov dukker opp senere, kan vi legge til `ProjectMember.behandleSomUE Boolean` (eksplisitt overstyring), men ikke nå

**Konsekvens for tidligere vedtak:**
- **A.9 KLARGJØRES** (se under): `ProjectMember.role`-verdier er `admin` / `member` / `sitedoc_admin` / `company_admin`. `"underentreprenor"` er **IKKE** en gyldig verdi for `ProjectMember.role`
- Hvis `"underentreprenor"`-rader finnes i DB i dag (sannsynlig ikke, men skal sjekkes ved migrasjon), behandles de som legacy — ingen tilgangs-effekt. Migrering: la radene stå (skader ingen), men avskaff fra fremtidige forslag
- D.1 (dataportabilitet) forblir uendret — utledning er primær, denne beslutningen bekrefter det

**Konsekvenser for kode/UI/eksport:**

UI:
- «UE»-tag i prosjekt-medlem-liste utledes på frontend via `erUnderentreprenor()`-funksjonen
- Ingen UI-element setter `ProjectMember.role = "underentreprenor"`
- Eventuelle eksisterende «Sett som UE»-knapper fjernes eller omdøpes — dette er nå utledet, ikke valgt

Eksport-filtrering:
- Lønn-eksport bruker `erUnderentreprenor()` for å filtrere ut UE-timer (UE-arbeider lønnes av eget firma, ikke A.Markussen)
- ProAdm-eksport inkluderer alle (UE og interne) for komplett prosjektkostnad

Tilgangskontroll:
- `byggFaggruppeFilter()` kan utvides til å vurdere UE-status hvis spesifikk filtrering kreves
- Standard tilgangs-logikk er ProjectMember-basert — UE-flagg påvirker ikke tilgang per se, kun visning og eksport

**Schema-status:**
- `User.organizationId` finnes allerede
- `Project.primaryOrganizationId` legges til i § E steg 4 (nullable per B.4)
- `ProjectMember.role` beholdes som er, kun forslagsverdiene klargjøres (se A.9)

**Snapshot-pattern (avklart via B.7):** `User.id` ER snapshot — ingen `Timer.organizationIdAtRegistrering`-felt kreves. Per B.7 (Modell A) er `User.organizationId` stabil per User-rad, så Timer-rader peker via `userId` til riktig org-rad. Dette skiller seg fra A.7 (attestertSnapshot) som lagrer pris-data (mutable verdier) — User-org er nå immutable per rad.

**Begrunnelse:** Én sannhet (kan ikke drifte). Skala-vennlig (50 Bravida-arbeidere får UE-status automatisk uten manuell rolle-setting). Naturlig mapping til faktisk virkelighet — UE er en jobb-relasjon, ikke en konfigurasjon.

### B.6 Timestamptz-migrasjon før Timer — ✅ **LUKKET 2026-04-27**

**Problem:** Vedtak om UTC i DB krever schema-wide migrasjon av 100+ DateTime-kolonner til `@db.Timestamptz`. Verifisert 2026-04-27: **0 forekomster av `@db.Timestamptz`** i `schema.prisma` i dag.

**Tre alternativer:**

a) **Full migrasjon i Fase 0** — riktig fundament, stor jobb
b) **Selektiv migrasjon** — kun timer/audit-relevante tabeller, resten gradvis
c) **Utsett til etter Timer-MVP**

**Status:** ✅ **BESLUTTET — Alternativ b (Selektiv migrasjon, Medium scope).**

**Tabeller som migreres til `@db.Timestamptz`:**

| Tabell | Felter | Begrunnelse |
|---|---|---|
| `daily_sheets` | `startAt`, `endAt`, `attestertVed`, `createdAt`, `updatedAt` (`dato` forblir `@db.Date` — hele-dag-konsept) | Timer-modul-fundament |
| `sheet_timer` | `createdAt`, `updatedAt` | Timer-rader audit |
| `sheet_tillegg` | `createdAt`, `updatedAt` | Tillegg-rader audit |
| `document_transfers` | `createdAt` + alle snapshot-tidsstempler | Sporbarhet, samspill med Godkjenning |
| `godkjenninger` | `sistEndretVed`, `godkjentVed`, `createdAt`, `updatedAt` | Audit-relevant, samspiller med `document_transfers` |
| `activity_log` | `createdAt` | Sentral audit-tabell |
| `equipment_assignments` | `startAt`, `endAt` | **BESLUTNING 2026-04-27 — utvidet:** Timestamptz fra start, samme som `daily_sheets` (sporing av maskinbruk på tvers av tidssoner) |
| `psi_signaturer` | `completedAt` | **BESLUTNING 2026-04-27 — utvidet:** Juridisk relevant. Signaturer på byggeplass krever DST-presisjon (per A.12 anonymizing-policy: signaturer beholdes for juridisk audit) |
| `checklists` | `frist` | **BESLUTNING 2026-04-27 — utvidet:** DST-bug-risiko ved mars/oktober — forfallsdatoer kan bli off-by-one-time uten Timestamptz |
| `tasks` | `frist` | **BESLUTNING 2026-04-27 — utvidet:** Samme DST-risiko som `checklists.frist` |
| `project_invitations` | `expiresAt` | **BESLUTNING 2026-04-27 — utvidet:** Sikkerhetskritisk — token-utløp må ikke kunne bli off-by-one ved DST |

Resten av schema beholder `timestamp(3)` inntil dedikert behov.

**Forutsetning:** `date-fns-tz` installeres (lukker C.1 implisitt — se C.1).

**Migrerings-rekkefølge:**
- Plasseres som dedikerte steg i § E der respektive tabeller bygges (ikke separat steg 0)
- `activity_log` (§ E steg 1): tidsstempler er Timestamptz fra start
- `godkjenninger` + `document_transfers`-snapshot-felt (§ E steg 12): Timestamptz fra start
- `checklists.frist`, `tasks.frist`, `project_invitations.expiresAt`: Timestamptz fra start (legges til i § E som utvidelse av eksisterende tabeller — bør koordineres i Fase 0)
- `daily_sheets`, `sheet_timer`, `sheet_tillegg` (Timer-modul Fase 3): Timestamptz fra start når tabellene opprettes
- `psi_signaturer.completedAt` (eksisterende tabell): Timestamptz som schema-utvidelse i Fase 0
- `equipment_assignments` (db-maskin Fase 1, allerede under bygging): Timestamptz fra start

**Konsekvens for andre punkter:**
- A.7 `attestertSnapshot` — lagrer ikke tidssone-data (er JSON), upåvirket
- A.14 `OrganizationSetting.timezone` — bruker selektivt-migrerte felter for forretningsregler — fungerer korrekt
- C.1 `date-fns-tz`-installasjon — lukkes implisitt av denne beslutningen

### B.7 Org-bytte-mekanikk — ✅ **LUKKET 2026-04-27**

**Vurdering 2026-05-03:** Modell B (firma-bytte uten utlogging, Interaxo/Dalux-stil)
ble vurdert. Konklusjon: Behold Modell A. Begrunnelse: 0 multi-firma-brukere i prod,
sitedoc_admin har allerede firma-bytte via FirmaVelger. Modell B (~20-30t, høy RBAC-risiko)
utsettes til reelt behov oppstår i prod.

**Problem:** B.5 forutsetter «én User per (person × firma)» og at ny User-rad opprettes når en person bytter firma. Mekanikken er ikke spesifisert.

**Status:** ✅ **BESLUTTET — Modell A (Én User per person × firma med reaktivering ved retur).**

**Kjernekonsept:**
- Hver kombinasjon av (person × firma) er én User-rad
- Person som bytter firma får ny User-rad
- Person som returnerer til tidligere firma reaktiverer gammel User-rad (bevarer historikk)
- Per-firma-isolasjon for GDPR, retention og databehandlingsansvar

**Drivende begrunnelse — GDPR/juridisk kollisjon:**
- Hvis User er én person på tvers av firmaer, kan firma 2 utløse GDPR-sletting som fjerner firma 1s data
- Firma 1 har juridisk plikt til å beholde lønnsdata (skattelov § 5-12, 5 år; bokføringsloven § 13, 10 år)
- En slik kollisjon mellom GDPR-rettigheter og lov-pålagte retention-perioder må ikke kunne oppstå
- Modell A løser dette: hvert firma eier sin User-rad, GDPR-sletting og retention håndteres uavhengig

**Schema-endringer:**

1. **`User.email`** endres fra `@unique` til composite:
   ```prisma
   @@unique([email, organizationId])
   ```
   - Joakim kan ha én User per firma
   - Joakim kan IKKE ha to User-rader i samme firma
   - Migrasjon: krever drop av eksisterende `email_key`-index og ny composite-index

2. **`User.canLogin`** — A.10 utvidet bruksområde (to scenarier):
   - Original A.10: `canLogin = false` for «data-mottakere uten innloggings-tilgang» (eldre arbeidere)
   - **B.7-utvidelse:** `canLogin = false` brukes også for **arkiverte User-rader** (Joakim sluttet hos A.Markussen)
   - Reaktivering ved retur: `canLogin = true` igjen

3. **`ProjectMember.userId`** — cascade-policy endres:
   - **Før:** `onDelete: Cascade`
   - **Etter:** `onDelete: SetNull`
   - Begrunnelse: Bevarer ProjectMember-historikk når User-rad slettes (sjelden — vi arkiverer normalt med `canLogin = false`, ikke sletter)

**Reaktiverings-policy:**
- Ved onboarding/invitasjon: lookup på `(email, organizationId)` FØR oppretting av ny User-rad
- Hvis match: reaktiver eksisterende rad (`canLogin = true`)
- Hvis ingen match: opprett ny User-rad
- Aldri opprett ny User-rad hvis match finnes
- UI: «Vi fant tidligere konto for denne e-posten i dette firmaet — reaktiverer den.»

**NextAuth-implikasjoner:**

Dagens NextAuth-konfigurasjon forutsetter `email @unique`. Med composite unique trengs custom adapter eller modifisert `signIn`-logikk:

1. Custom NextAuth-adapter eller `signIn`-callback må:
   - Finne aktiv User-rad (`canLogin = true`) for gitt e-post
   - Hvis flere aktive User-rader (deltidsstilling i to firmaer parallelt): org-velger ved login eller annen mekanikk
   - Hvis bare én aktiv: log inn som den

2. **Edge case — deltidsstilling i to firmaer:** Joakim har User-rad #1 (A.Markussen, `canLogin = true`) og User-rad #2 (Bravida, `canLogin = true`) parallelt. Krever org-velger ved login. Behandles som lavt prioritet edge case for MVP — antar at de fleste brukere har kun én aktiv User-rad om gangen.

3. JWT/session må inkludere `userId` (ikke kun e-post) for å peke til riktig User-rad.

**Fase 0 minimum-implementasjon (vedtatt 2026-04-30):**

For Fase 0 implementeres kun «velg første aktive User-rad»-strategi:
- `signIn`-callback finner alle User-rader hvor `email` matcher OG `canLogin = true`
- Hvis 0 treff → eksisterende NextAuth opprett-flyt (ny User-rad)
- Hvis 1 treff → log inn som den
- Hvis 2+ treff → log inn som første treff (deterministisk: laveste `id` eller eldste `createdAt`)
- Org-velger-UI utsettes til første reelle multi-firma-bruker oppstår i prod

**Begrunnelse:** Prod har 0 multi-org-tilfeller per 2026-04-27 (verifisert i tabellen over). Edge case-policy «lavt prioritet for MVP» tilsier at minimum-versjon dekker 100% av faktiske brukere i Fase 0. UI-spec defineres når reell deltidsstillings-bruker registreres.

**Implementeringsstatus:** Auth-implementeringsdetaljer dokumenteres som teknisk forutsetning for Fase 0-koding. Implementeres når User-modellen utvides (§ E steg 13).

**Eksisterende DB-tilstand (verifisert 2026-04-27):**

| DB | Multi-org-tilfeller (samme e-post, flere User-rader) | Standalone-brukere | Standalone-prosjekter |
|---|---:|---:|---:|
| sitedoc_test | 0 | 0 av 23 | 1 |
| sitedoc (prod) | 0 | **13 av 13** (alle) | 6 |

Ingen multi-org-tilfeller eksisterer — Modell A kan innføres uten data-konflikt. Prod har 13/13 standalone-brukere — disse må håndteres ved fremtidig firmamal-design (post-Fase 1 per B.4).

**Konsekvenser for andre beslutninger:**

- **B.5 (UE-utledning):** Forbedres. `User.organizationId` er nå stabil per User-rad (ingen org-bytte på samme rad). Timer-rader peker til riktig User-rad via `userId`. `erUnderentreprenor()` fungerer naturlig korrekt. **Ingen `Timer.organizationIdAtRegistrering`-snapshot kreves — User.id ER snapshot.**
- **A.10 (User.canLogin):** Klargjøres med to bruksområder (se A.10).
- **A.12 (anonymizeUser):** Klargjøres — virker per User-rad, ikke per person på tvers (se A.12).

#### B.7 utvidelse — Multi-identifikator-støtte (forberedende, 2026-04-27)

**Kontekst:**
- Kunde har bekreftet at dagens login (OAuth + e-post) beholdes i Fase 0
- Tlf+passord-login med 3-måneders rotasjon vurderes som fremtidig utvidelse (estimert 12 mnd, **IKKE ny BLOKKERE**)
- `User.phone`-felt finnes allerede (verifisert 2026-04-27, `schema.prisma:16` — `String?` uten `@unique`, brukt i `medlem.ts`, `gruppe.ts`, `brukere/page.tsx`)
- Kunden bekrefter at alle ansatte har e-post (lønnslipp sendes via e-post), men e-postene er ikke garantert knyttet til Google Workspace eller Microsoft 365 — dvs. OAuth fungerer ikke for alle
- Bygg/anlegg-bransjen: telefon er universal identifikator, e-post varierer (privat: gmail.com, online.no, outlook.com osv.)

**User-modell-status etter Fase 0 (steg 13 i § E):**
- `email String` NOT NULL (uendret nullability)
- `phone String?` (eksisterende, uendret type)
- `@@unique([email, organizationId])` (NYTT — endret fra global `@unique` per B.7 Modell A)
- `@@unique([phone, organizationId])` (NYTT — forberedende for fremtidig tlf-login)

**Auth-modell i Fase 0 — UENDRET fra dagens praksis:**
- OAuth + e-post per dagens implementering
- `phone`-feltet eksisterer og brukes (medlem.ts, gruppe.ts, brukere/page.tsx) men IKKE til login
- Lederen kan registrere phone på User-rader for `canLogin = false`-arbeidere (per A.10)

**Fremtidig auth-utvidelse (estimert 12 mnd, IKKE ny BLOKKERE)** støtter tre login-metoder parallelt:

1. **OAuth** (Google Workspace / Microsoft 365)
   - Brukergruppe: faste ansatte i firmaer med firma-e-post på Google eller MS
   - Dagens implementering, beholdes
2. **E-post + passord**
   - Brukergruppe: alle med e-post men uten OAuth-leverandør (online.no, gmail.com, outlook.com osv.)
   - Argon2-hashing per User-rad
3. **Telefon + passord**
   - Brukergruppe: sesongarbeidere og daglig felt-personell hvor telefon er mer naturlig enn e-post
   - Samme passord-mekanikk

Alle tre kjører parallelt. Brukeren velger metode ved login. 3-måneders passord-rotasjon for metode 2 og 3.

**Schema-endringer for fremtidig utvidelse (post-Fase 0):**
- Legge til `password_hash`, `password_set_at`-kolonner (felles for metode 2 og 3)
- Recovery-mekanismer (SMS for tlf-login, e-post for e-post-login)
- `email` forblir NOT NULL inntil reelt behov for tlf-only-brukere oppstår
- CHECK-constraint (`email OR phone`) utsettes til samme tidspunkt

**Begrunnelse for å forberede composite unique på phone NÅ:**
- `phone`-feltet eksisterer og er aktivt brukt i kode
- 0 phone-duplikater i nåværende DB (verifisert i begge sitedoc_test og sitedoc 2026-04-27)
- Composite unique kan innføres uten data-konflikt
- Fremtidig tlf+passord-login krever det
- Trivielt å legge til nå, dyrere senere

**GDPR:**
- `phone` er personopplysning (allerede behandlet i A.12)
- Anonymisering: `phone` settes NULL ved `anonymizeUser()` per A.12
- Retention som andre PII-felter

**Status:** B.7 forblir **LUKKET**. Composite unique på `phone` legges til i steg 13 (User-utvidelse) som forberedende endring. Tlf+passord-login og e-post+passord-login er fremtidig utvidelse uten BLOKKERE.

---

## C. Anbefalte Fase 0-utvidelser

Disse er ikke blokkere, men bør være med i Fase 0 for å unngå arkitektur-gjeld.

### C.1 Installer date-fns-tz og tidssone-utils — ✅ **LUKKET 2026-04-27 (implisitt av B.6)**

Verifisert: `date-fns-tz` ikke installert i dag. Krevet for A.14 (Firma-konfigurerbar tidssone) og B.6 (Timestamptz-migrasjon).

**Tiltak:**
1. `pnpm add date-fns-tz --filter @sitedoc/shared`
2. Implementer `startOfDayInZone`, `endOfDayInZone`, `addBusinessDaysInZone` i `packages/shared/src/utils/timezone.ts`
3. Test mot DST-overgang

**Status:** ✅ **LUKKET** — B.6-beslutningen (selektiv Timestamptz-migrasjon) krever `date-fns-tz`. Pakken installeres som forutsetning for Fase 0-koding. Tiltak-listen over står fortsatt som implementasjons-spec.

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

**Utvidelse (per C.13):** `aktivMedlemFilter` brukes også på de 3 andre loan-pattern-tabellene (`ProjectGroupMember`, `FaggruppeKobling`, `DokumentflytMedlem`) når deres `periodeSlutt`-felter legges til. Filteret må fungere konsistent på alle 4 tabeller fra dag én.

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

### C.14 Kompetansetype + AnsattKompetanse i Fase 0.5 — ✅ **VEDTATT 2026-04-29**

Bygges i **Fase 0.5** (sammen med Avdeling per C.11 og Byggeplass). Datamodell-detaljer i A.28.

**Tiltak (Fase 0.5):**
1. Prisma-migrasjon: opprett `Kompetansetype` + `AnsattKompetanse` i `packages/db`
2. Seed `KOMPETANSE_KATEGORIER`-konstant i `packages/shared/src/types/index.ts` (7 SmartDok-bekreftede kategorier)
3. tRPC-rute `kompetanse.*`: CRUD + CSV/Excel-import
4. Admin-UI: matrise-vy (bruker × kompetanse) + manuell registrering + import-modal
5. Varsling-integrasjon: `AnsattKompetanse.utloper` brukes i tverrgående varslingssystem (varsling.md) for utløp-varsel 90/30/7 dager før

**Skille mot C.11 (Avdeling):** Begge er Fase 0.5-kjerne-tabeller, men logisk distinkte:
- **C.11 Avdeling** = firma-intern organisatorisk inndeling (10 hos A.Markussen)
- **C.14 Kompetanse** = person-eid sertifikat-/opplærings-data (362 rader hos A.Markussen)

**Avhengigheter:**
- A.11 (User-utvidelse — ansattnummer kreves for CSV-import-mapping)
- C.10 (Seed-mekanisme — `KOMPETANSE_KATEGORIER` seedes via samme event-hook hvis kategori blir firma-konfigurerbar senere; ikke nødvendig for Fase 0.5 siden det er konstant)
- N2.2-PRINSIPP (A.Markussen-research-infeksjon: kategori-liste OK, men IKKE A.Markussens 77 typer)

**Avhengigheter andre veien (post-Fase 0.5):**
- Fase 3 (Timer) — kompetanse-validering ved timer-føring (utsatt per 1D-anker, kan tilføyes senere)
- Fase 4 (Mannskap) — §15-listen kan inkludere kompetanse-kolonner
- Fase 6 (DO-kobling) — `Kompetansetype.kobletTilEquipmentModell` brukes for maskinbruk-validering

**Kilde:** SmartDok-research 2026-04-29 (verifisert via browser): Kompetansetyper-fane og Brukernes kompetanser-fane åpnet og dokumentert. Fra-tidligere-flagg «ikke verifisert» (smartdok-undersokelse.md § 6.3) er nå løst.

### C.13 Periode på loan-pattern-modeller (3 modeller)

Tre eksisterende koblingstabeller utover ProjectMember/EquipmentAssignment/ProsjektBibliotekValg mangler `periodeStart`/`periodeSlutt`-felter:

- **`ProjectGroupMember`** — bruker → gruppe → prosjekt
- **`FaggruppeKobling`** — bruker → faggruppe (dokumentflyt-rolle)
- **`DokumentflytMedlem`** — faggruppe/bruker/gruppe → dokumentflyt

**Begrunnelse for å gjøre i Fase 0:** Konsistens med `ProjectMember.periodeSlutt` (per B.7 + § E steg 10). Hvis kjerne-loan-modellen får periode mens disse tre ikke får det, har vi inkonsistens fra dag én. Refaktor senere blir vesentlig dyrere når historiske rader finnes.

**Tiltak (Fase 0):**
1. Legg til `periodeSlutt: DateTime?` på alle tre tabeller (samme mønster som `ProjectMember.periodeSlutt`)
2. Default for eksisterende rader: `null` (= aktiv)
3. Utvid `aktivMedlemFilter` (per C.2) til å virke konsistent på alle fire tabeller
4. Oppdater alle queries som joiner mot disse tabellene til å bruke perioden-filteret

**Konsekvens for § E:** Steg 10 (ProjectMember.periodeSlutt) utvides til også å dekke disse tre. Migrasjonen kan ligge i samme migrasjon som ProjectMember-utvidelsen.

**Kilde:** Identifisert i Opus QA-runde 2 (2026-04-25), §6.2 Q4 — konsolidert hit 2026-04-28 før arkivering av QA-rapporten.

### C.16 Vareforbruk-modul: forbruksregistrering per prosjekt — ✅ **VEDTATT 2026-04-30** (SmartDok-verifisert)

**Konsept:** Vareforbruk i SiteDoc er en **transaksjonslogg** — ikke lagerstyring. Kopierer IKKE SmartDok-modellen. Ingen lagerstand, ingen falske negative tall.

**Tre lag:**

**Lag 1 — Varekatalog (firma-nivå):**
```prisma
model Vare {
  id              String  @id @default(uuid())
  organizationId  String
  navn            String
  varenummer      String?
  enhet           String   // m, m2, m3, kg, tonn, stk
  pris            Decimal? // utsalgspris til kunde
  internkostnad   Decimal? // innkjøpspris
  kategori        String?  // fritekst per firma
  aktiv           Boolean  @default(true)

  @@unique([organizationId, varenummer])
  @@index([organizationId, aktiv])
}
```
Ingen lagerstand-felt. Kategorier defineres fritt per firma.

**Lag 2 — Vareforbruk (prosjekt-nivå):**
```prisma
model Vareforbruk {
  id                    String   @id @default(uuid())
  dato                  DateTime
  projectId             String
  byggeplassId          String?  // NULL = gjelder hele prosjektet (per A.30)
  vareId                String
  antall                Decimal
  registrertAvUserId    String
  kommentar             String?
  dagsseddelId          String?  // valgfri kobling til Timer-modul

  @@index([projectId, dato])
  @@index([dagsseddelId])
}
```

Forbruk knyttes direkte til prosjekt. Kobling til dagsseddel muliggjør registrering av materiale samtidig som timer — i ett skjermbilde på mobil.

**Lag 3 — Transport (separat opsjon):**

Massetransport som egen strøm: kjøretøy + antall lass + hentet fra + levert til + mengde. **Ikke bland inn i vanlig vareforbruk** — egne tabell og UI.

**Differensiator vs SmartDok:**
- Registrer vare direkte fra dagsseddel (mobil) — ett skjermbilde, én tap
- Ingen falsk lagerstand (SmartDok-modellen har f.eks. -746.554 tonn Bærelag)
- Rapport: `forbruk × pris → prosjektkostnad → eksporterbar til Tripletex/ProAdm`

**Fase-plassering:** **Fase 3** — etter Timer. Dagsseddel-koblingen forutsetter timer-modulen. Tabellene bygges først når Timer-modul deployes.

**SmartDok-research 2026-04-30 (kilde-grunnlag):**
- SmartDok Vareforbruk er manuelt forbruksregister
- A.Markussen har 64 varer
- Negative lagertall (f.eks. -746.554 tonn Bærelag) viser at SmartDok ikke driver reell lagerstyring — det er bare et tellingsavvik
- Ingen kobling til timeregistrering i SmartDok
- Transport er separat modul (samsvarer med vårt Lag 3-skille)
- Datagrunnlag: manuelt registrert i SmartDok, ikke hentet fra PowerOffice/ProAdm
- **Migrering til SiteDoc:** CSV-eksport fra SmartDok → import-skript ved firma-onboarding (per § 3.10 eksport-kode-policy: koder kopieres 1:1)

**Berører:**
- Ny `packages/db-varelager/` — egen Prisma-pakke (samme cross-schema-mønster som db-maskin per § 6.1)
- Eller integrert i `packages/db` — designvalg utsatt til Fase 3-design starter
- Ny modul-flagg i `ProjectModule` (slug `varelager`)
- Eksport-adapter for Tripletex/ProAdm (per § 7.4)

**Tre-nivå-katalog (per § 3.8):** Vurdér om Vare-katalogen skal følge 3-nivå-mønsteret (lovpålagt grunnpakke, bransje-relevant, egendefinert) eller om Lag 3 (egendefinert) er tilstrekkelig. Avgjøres ved Fase 3-design — ikke nå.

> **🟡 Modul-avhengighets-regel:** `Vareforbruk.dagsseddelId?` knytter
> Vareforbruk til Timer-modulens dagsseddel. Vareforbruk-registrering
> skjer inni Timer-flyten. Endringer i koblingen krever lesing av
> [dagsseddel-design.md § Modul-avhengigheter](dagsseddel-design.md).

### C.18 Aktivitet flyttet fra DailySheet → SheetTimer + sheet_machines + ECO.proAdmType — ✅ **VEDTATT 2026-05-02** (implementert i C9 / Runde 2.5)

**Bakgrunn:** Identifisert under Runde 2 visuell verifisering 2026-05-02. A.Markussen-empiri (per [smartdok-undersokelse.md § 4.2](smartdok-undersokelse.md)) krever at samme dagsseddel kan ha både `Anleggsarbeid`-rader (kode 11) og `Maskintimer`-rader (kode 18). Med aktivitet på sedel-nivå var det umulig. Løsning: flytt aktivitet til rad-nivå, samme presedens som ECO-flyttingen (vedtatt 2026-04-29).

**Vedtatte endringer:**

1. **`SheetTimer.aktivitetId String` (NOT NULL)** + `Aktivitet` Restrict-FK + index. Backfill fra `DailySheet.aktivitetId` i samme migrasjon.
2. **`DailySheet.aktivitetId String?` (nullable)** — beholdes som default-felt for UX (kopieres til første rad ved opprettelse, kan overstyres per rad).
3. **Ny `SheetMachine`-tabell** i `db-timer` med `vehicleId String` (svak FK til db-maskin Equipment per A.20), `timer Decimal`, `mengde Decimal?`, `enhet String?`, `attestertSnapshot Json?` (null inntil Equipment-prising er spec'd i Maskin Fase 1+).
4. **`ExternalCostObject.proAdmType String?`** i kjernen — fri tekst, utvides dynamisk når nye ProAdm-typer dukker opp. Ikke enum. Mapping ECO-type → Godkjenning-flytmal utsettes til egen runde før Runde 3.
5. **Ny `timer.dagsseddel.maskin.{tilfoy,oppdater,fjern}` tRPC-router** — sheet_machines lever i db-timer fordi Timer eier dagsseddelen. Equipment-katalog leveres av Maskin-modul via service-lag (cross-modul-konvensjon per § 6.1.1 i arkitektur-syntese).
6. **Ny `timer.dagsseddel.hentDagstotal({userId, dato})`** — sum timer på tvers av prosjekter for én bruker × én dato. Multi-sedel per dag aksepteres (eksisterende unique-constraint `(userId, projectId, dato)` beholdes).
7. **Soft-skjul-mønster på UI:** Maskin-seksjon vises kun hvis Equipment-listen er ikke-tom (Maskin-modul aktivert). Ingen feilmelding hvis modul av.
8. **Mobil maskin-cache utsatt** til Runde 2.6 — `equipment_local`-tabell + `maskinKatalog.ts` + sync-mekanikk for sheet_machines på mobil. C9 leverer kun aktivitet-per-rad på mobil; sheet_machine_local-tabellen opprettes for sync-symmetri.

**Påvirkning på eksisterende beslutninger:**

- **A.7 (Snapshot ved attestering):** SheetTimer.attestertSnapshot utvides med `aktivitetId/aktivitetKode/aktivitetNavn`. SheetMachine.attestertSnapshot legges på i samme transaksjon (uten pris-felter inntil videre).
- **C.16 (Vareforbruk):** Ingen endring — Vareforbruk-modulen forblir egen modul med `Vareforbruk.dagsseddelId?`-kobling. Sheet_materials-skissen i timer.md:769 forblir foreldet.

**Implementasjon:** `feature/timer-2.5`-branchen — se [dagsseddel-design.md § Implementasjons-spor](dagsseddel-design.md).

**Foreldet av C.18:** dagsseddel-design.md var åpen — nå lukket. Alle 11 spørsmål besvart i § Vedtatte beslutninger der.

---

### C.17 BibliotekMal/OrganizationTemplate språkstøtte — 🟡 **ÅPEN — IKKE SPEC'ET (notert 2026-05-01)**

**Bakgrunn:** Identifisert under E.8-kartlegging 2026-05-01. `BibliotekMal.navn` og `BibliotekKapittel.navn` er flate strenger uten `translations Json`-felt. `ReportObject` og `OrganizationTemplateObject` (E.7) har `translations Json @default("{}")` — men `ReportTemplate`/`OrganizationTemplate`/`BibliotekMal` selv har det ikke. Sentralbibliotek er i dag kun norsk; engelsk/andre språk på selve mal-navnene mangler.

**To alternativer (besluttes i Fase 2 når sentralbibliotek-UI designes):**

- **A — Schema-utvidelse:** Tilføy `translations Json @default("{}")` på `BibliotekMal`, `BibliotekKapittel`, `ReportTemplate`, `OrganizationTemplate`. Mønster matcher eksisterende `ReportObject.translations`. Manuelle oversettelser per mal-navn.
- **B — Dynamisk oversettelse:** Bruk OPUS-MT-tjenesten (eksisterende infrastruktur, port 3303, ingen schema-endring). Mal-navn oversettes on-the-fly. Lavere kvalitet for fagbegreper, men ingen vedlikeholds-byrde.

**Status:** Åpen. Adresseres ikke i Fase 0 (E.8 utvider BibliotekMal med 4 forretnings-felter, ikke i18n). Tas opp ved Fase 2 mal-promotering når UI-strategi for sentralbibliotek besluttes.

**Berører ved beslutning:**
- Schema (4 modeller hvis Alt A)
- `bibliotek.ts` import-flyt (hvis Alt A — kopier translations til ReportTemplate ved kopiering til prosjekt)
- Sentralbibliotek-UI (Fase 2)

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

> **Timestamptz-håndtering per B.6 — selektiv migrasjon.** Tabeller som får `@db.Timestamptz` fra start: `daily_sheets`, `sheet_timer`, `sheet_tillegg`, `document_transfers`, `godkjenninger`, `activity_log`, `equipment_assignments`, `psi_signaturer.completedAt`, `checklists.frist`, `tasks.frist`, `project_invitations.expiresAt`. Resten av schema uberørt (beholder `timestamp(3)`).

| Steg | Migration | Avhengighet |
|------|-----------|-------------|
| 1 | Activity-tabell — `createdAt` som `@db.Timestamptz` per B.6 | Ingen |
| 2 | OrganizationSetting | Organization (finnes) |
| 3 | Rename OrganizationProject → ProjectOrganization + rolle | OrganizationProject (finnes) |
| **4** | **Project.primaryOrganizationId nullable** | Project (finnes) |
| **5** | **ProjectModule-utvidelse (organizationId nullable + status String)** — se A.4/A.17 for SQL-detaljer (én atomisk migrasjon, ikke to separate steg) | ProjectModule + Project.primaryOrganizationId |
| 6 | OrganizationPartner | Organization |
| 7 | OrganizationTemplate | Organization |
| 8 | BibliotekMal-utvidelse (4 felt: kategori/domene/kobletTilModul/verifisert) — versjons-felt på `ReportTemplate` koordineres her per [migrering-reporttemplate.md § Mal-versjonering](migrering-reporttemplate.md). **Drift bekreftet 2026-04-28** — feltene mangler i `schema.prisma:1200-1216`; `bibliotek.ts importerMal` hardkoder `category`/`domain` (linje 106-107). Prioriteres tidlig i Fase 0 — koblet til P-KRITISK-3 i [oppryddings-plan-2026-04-28.md](oppryddings-plan-2026-04-28.md) | BibliotekMal (finnes) |
| 9 | ~~Psi-utvidelse (organizationId + projectId nullable + kontekstType)~~ — **FORKASTET 2026-04-28 per 1D-anker.** PSI er ren prosjektmodul med `projectId` alltid required. Eventuelle PSI-utvidelser (`eksternSystem`-felt + innsjekk/utsjekk-tabell + mannskaps-vy) hører til Fase 4, ikke Fase 0. Steget bevart i listen for at de gjenværende stegene (10–13) beholder sin nummerering — fjernes ved konsekvent re-nummerering når andre § E-endringer kommer | — |
| 10 | ProjectMember.periodeSlutt + UE-rolle dokumentasjon + **userId cascade-policy endres fra Cascade til SetNull (per B.7)** + **ProjectGroupMember/FaggruppeKobling/DokumentflytMedlem.periodeSlutt (per C.13)** | ProjectMember + 3 loan-tabeller (alle finnes) |
| 11 | ExternalCostObject | Organization, Project |
| 12 | Godkjenning (m/`endretEtterSending`, `sistEndretVed`, alle tidsstempler som `@db.Timestamptz`) + DocumentTransfer.kostnadSnapshot + DocumentTransfer.godkjenningId + Timestamptz på snapshot-tidsstempler | DocumentTransfer (finnes), ECO |
| 13 | User-utvidelse (canLogin, HMS-kort, ansattnummer, nasjonalitet, arbeidstillatelse) + **email-unique drop og composite `@@unique([email, organizationId])` (per B.7)** + **`@@unique([phone, organizationId])` (forberedende per B.7-utvidelse, multi-identifikator-auth)** + custom NextAuth-adapter eller signIn-tilpasning. **Email forblir NOT NULL i Fase 0** (alle har e-post per kunde-bekreftelse). **Ingen passord-felter eller CHECK-constraint i Fase 0** — utsettes til fremtidig multi-identifikator-auth-utvidelse | User (finnes) |
| 14 | OrganizationRole-tabell (per A.25) — granulære firma-roller med composite unique `(userId, organizationId, role)` + indeks `(organizationId, role)`. Første verdier: `"hms_ansvarlig"`. `tilgangskontroll.ts` får `harOrgRolle(user, role)`-funksjon. Tildeling via nye endepunkter `organisasjon.tildelOrgRolle` / `organisasjon.fjernOrgRolle` gated med `verifiserFirmaAdmin` (per A.25 § Tildelings-policy) | Organization, User (begge finnes) |

**Etter alle 13 er kjørt (neste release):**
- ProjectModule.status NOT NULL + drop active-kolonne (per A.4 steg 2)
- Equipment.ansvarligUserId migreres til EquipmentAnsvarlig + droppes

**Post-Fase 1 (utsatt arbeid per B.4 interim-beslutning):**
- `Project.primaryOrganizationId` NOT NULL
- `ProjectModule.organizationId` NOT NULL
- Migrere eksisterende standalone-prosjekt til firma-tilknytning
- Oppdatere Project-opprettelses-flyt til å kreve primaryOrganizationId
- Krever at OrganizationTemplate (firmamal-struktur) er designet og bygget først

**Note om utelatte steg:**
- **Avdeling utsatt til Fase 0.5** per C.11 — ikke i Fase 0-rekkefølgen. Bygges sammen med Byggeplass-strategi
- **Tidligere E.2 «OrganizationModule»** fjernet — A.4 vedtok at ProjectModule utvides, ikke ny tabell. Utvidelsen skjer i nåværende steg 5

**Endring fra opprinnelig plan:** Steg 4 og 5 er byttet rekkefølge (Project.primaryOrganizationId før ProjectModule-utvidelse). Identifisert i Opus-runde 3 — primaryOrganizationId må eksistere før ProjectModule kan bakfylles. Dette er den B.2 som nå er lukket.

---

## F. Fase 0.7 — Data-rens (prod-forberedelse) — ✅ **VEDTATT 2026-04-30**

**Bakgrunn:** Audit av prod-DB 2026-04-30 viste at **alle 13 prod-brukere har `organizationId = NULL`** og 6 av 8 prosjekter mangler firma-tilknytning. Dette er inkompatibelt med:

1. **Tre-strukturen i CLAUDE.md § Tre nivåer** — som forutsetter `Bruker → Firma → Prosjekter`
2. **§ E steg 13b** (composite `@@unique([email, organizationId])`) — PostgreSQL behandler NULL som distinct, så constraint blir uvirksom for standalone-brukere

**Beslutning:** Kjør Fase 0.7-data-rens **FØR** § E steg 13b kan kjøres trygt. Fase 0.7 er prod-spesifikk forberedelse — test-DB er allerede ren via re-seed-mønsteret.

**Steg F.1 — Opprett A.Markussen AS på prod**

Mangler i dag (kun HRP AS + Kenneths testmiljø finnes som Organization-rader). Opprett:
```sql
INSERT INTO organizations (id, name, organization_number, created_at, updated_at)
VALUES (gen_random_uuid(), 'A.Markussen AS', '<orgnr fra Brønnøysund>', now(), now());
```

**Steg F.2 — Knytt `florian@amarkussen.no` til A.Markussen AS**

```sql
UPDATE users SET organization_id = '<a-markussen-id>' WHERE email = 'florian@amarkussen.no';
```

**Steg F.3 — Slett øvrige standalone-brukere (bevisst valg)**

Per Kenneth-vedtak 2026-04-30: alle prod-brukere unntatt Florian er testdata eller utdaterte registreringer som kan registreres på nytt ved onboarding. Bevisst data-tap er akseptabelt — ingen lønn-/HMS-data avhenger av disse i dag.

`kemyrhau@gmail.com` (sitedoc_admin) bevares — kreves for systemadministrasjon.

Eksempel-spørring (verifisér før kjøring):
```sql
DELETE FROM users WHERE email IN (
  'kmy@hrpas.no', 'fredrik.ch@live.no', 'kmaryna2@gmail.com', 'vilde@kult.design',
  'rogerkr07@yahoo.com', 'be.roland@gmail.com',
  'jonas.snekker@test.sitedoc.no', 'hans.bas@test.sitedoc.no',
  'lars.formann@test.sitedoc.no', 'karen.laerling@test.sitedoc.no',
  'ingrid.tommer@test.sitedoc.no'
);
-- Cascade-effekter: ProjectMember-rader, faggruppeKoblinger, sentInvitations osv.
-- onDelete er Cascade for User i de fleste relasjoner — verifiseres før kjøring.
```

**Steg F.4 — Vurder test-prosjekter på prod (6 stk)**

Følgende prosjekter er testdata på prod og forurenser Fase 0-migrasjonen:
- `Test` (SD-20260308-0003)
- `Test` (SD-20260308-0004)
- `998 Innstifjordbotn` (SD-20260309-0005) — verifiser status før sletting
- `Testside Roger Ramstad` (SD-20260309-0006)
- `Test redigert mal Kenneth Myrhaug` (SD-20260310-0007)
- `Testside Erik Roland` (SD-20260311-0008)

**To beholdes (allerede tilknyttet firma):**
- `Testprosjekt` (SD-20260306-0001) — knyttet til Kenneths testmiljø
- `Fredriks testprosjekt` (SD-20260307-0002) — knyttet til HRP AS

**Anbefaling:** Slett de 6 første eller arkiver. Krever Kenneth-bekreftelse per prosjekt før kjøring.

**Rekkefølge i forhold til § E:**

```
§ E steg 1-12 (datamodell-endringer som ikke krever org-tilknytning)
   ↓
§ F (Fase 0.7 data-rens) — opprett A.Markussen, slett standalone-brukere/test-prosjekter
   ↓
§ E steg 13 (User-utvidelse + composite unique on (email, organizationId))
   ↓
§ E steg 14 (OrganizationRole)
```

**Konsekvenser hvis Fase 0.7 hoppes over:**
- Composite unique-constraint blir uvirksom for standalone-brukere (NULL behandles som distinct i PostgreSQL)
- Tre-strukturen «Bruker → Firma → Prosjekter» bryter for 12 av 13 prod-brukere
- B.7 Modell A-reaktiverings-logikk (`lookup på (email, organizationId)`) returnerer ikke deterministiske resultater når organizationId er NULL

**Implementasjons-ansvar:** Kenneth utfører F.1-F.4 manuelt mot prod-DB ved Fase 0-deploy. SQL-baserte data-rens er tryggest med menneskelig verifikasjon per spørring.

**Audit-grunnlag:** Prod-DB-status verifisert 2026-04-30 via `psql sitedoc`. 13 brukere, 8 prosjekter, 2 organizations, 2 organization_projects-rader, 17 dokumentflyt_parts (Faggruppe) hvorav 5 har `companyName` satt (alle som fritekst, ikke konsistent med Organization-navn).

---

## I. End-to-end-test som må kjøre kontinuerlig

> Joakim oppretter timer-registrering på mobil offline mot ExternalCostObject «Plunder og heft uke 14». Synkroniserer. Prosjektleder attesterer (snapshot låses). Eksport-filen til ProAdm inneholder riktig proAdmId med riktig kostnad-snapshot.

Kjøres etter hver merge til main. Rød test = arkitektur-feil, ikke kun kode-feil.

---

## J. Beslutninger bevisst utsatt

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
| Modul-deaktivering UI (advarsel-dialog ved permanent sletting) | Fase 3+ | UI-detalj over modul-gateway-mekanikk; ikke Fase 0-blocker. Konsolidert fra Opus QA-runde 2 §6.3 Q1 (2026-04-28) |
| Organization-sletting (firmakonkurs) | Når reell kunde har scenarioet | Krever transferProsjekter/transferUsers-flyt + sitedoc_admin-prosess. Ikke implementer i Fase 0. Manuelle inngrep dekker dagens behov. Konsolidert fra Opus QA-runde 2 §6.3 Q4 (2026-04-28) |

---

## K. Status-snapshot per 2026-04-26

**Siste runde:** Opus-runde 3 ferdig 2026-04-26.

**Lukket:** 23 beslutninger (A.1-A.24 minus A.13 som ble reklassifisert til B.6).

**Åpent:** 0 BLOKKERE — alle 7 lukket 2026-04-27.

**Lukkede BLOKKERE 2026-04-27:** B.1 default true, B.2 § E-retting, B.3 eksplisitt felt, B.4 interim utsatt, B.5 organizationId-mismatch, B.6 selektiv Timestamptz (utvidet 2026-04-27 med `psi_signaturer`/`checklists`/`tasks`/`project_invitations`/`equipment_assignments`), B.7 Modell A (én User per person×firma med reaktivering, composite email-unique, ProjectMember cascade SetNull).

**Anbefalte utvidelser:** 12 punkter (§ C.1-C.12), hvorav 3 lukket: C.1 (implisitt av B.6), C.8 (innarbeidet i A.3), C.9 (innarbeidet i A.6). Aktive: 9.

**Lovverk-vurderinger:** 4 områder (§ D).

**Migrerings-rekkefølge:** 13 steg i § E (var 15 — OrganizationModule fjernet per A.4, Avdeling utsatt til Fase 0.5 per C.11).

**Neste handling:** Timer/Maskin-revurdering med rent fundament. Etter revurdering: start Fase 0-koding via migration-rekkefølge i § E.

**Anker for ny Code-chat:**
- Denne filen + lenker øverst
- [smartdok-undersokelse.md](smartdok-undersokelse.md) for empirisk grunnlag
- [arkitektur-syntese.md](arkitektur-syntese.md) for helhetlig produktarkitektur

## OrganizationMember-refaktor (låst 2026-05-12, **komplett 2026-05-13**)

> **Komplett:** alle O-1 → O-5c deployet til prod 2026-05-13, prod-commit `fe1d703d`.
> `User.organizationId`, `User.ansattnummer`, `User.avdelingId` og `OrganizationRole`-tabellen droppet fra DB. `OrganizationMember` er nå eneste sannhetskilde for firma-medlemskap, ansattnummer og avdelingsskap. `User.email` globalt unik.


### Beslutning

User-modellen skiller ikke mellom system-identitet og HR-relasjon. OrganizationMember-tabell opprettes som korrekt arkitektur for firma-ansattskap.

### Strukturelle valg (låst)

- `User.email`: globalt unik — én person = én User-rad
- `User.role`: kun `sitedoc_admin | user` etter refaktor
- `company_admin` flyttes til `OrganizationMember.firmaRoller = ["firma_admin"]`
- `ansattRolle: String` (ikke DB-enum) — verdier kan endres uten migrasjon
- `firmaRoller: String[]` (ikke DB-enum) — samme grunn

### OrganizationMember-modell

**Felt som flyttes fra User → OrganizationMember:**
- `organizationId` (selve relasjonen)
- `ansattnummer`
- `avdelingId`

**Nye felt på OrganizationMember:**
- `ansattRolle: String @default("ansatt")`
  Startverdier: `ansatt | bas | prosjektleder | daglig_leder`
- `firmaRoller: String[] @default([])`
  Startverdier: `firma_admin | hms_ansvarlig | hr_ansvarlig`

**Felt som BLIR på User (personlig data):**
- `role` (`sitedoc_admin | user`)
- `name`, `email`, `phone`, `language`
- `fodselsdato`, `nasjonalitet`
- `hmsKortNr`, `hmsKortUtloper`
- `arbeidstillatelse`, `arbeidstillatelseUtloper`
- `canLogin`, `tabelloppsett`

### URL-rename

`/dashbord/firma/brukere` → `/dashbord/firma/ansatte` (DB + UI)

### Fasedelt implementering (5 PR-er)

- **PR O-1:** Opprett OrganizationMember-tabell, backfill fra `User.organizationId` (additivt)
- **PR O-2:** Refaktorer `tilgangskontroll.ts` — dual-read med fallback til User-felt
- **PR O-3:** Migrer routes batch-vis (organisasjon → admin → prosjekt → modul-routes)
- **PR O-4:** Flytt `ansattnummer` + `avdelingId` + nye felt, rename `firma/brukere` → `firma/ansatte`
- **PR O-5:** Drop `User.organizationId`, `User.ansattnummer`, `User.avdelingId` + rydd `User.role`

### Scope (fra kartlegging 2026-05-12)

- 749 treff totalt (594 API, 117 web, 38 mobile)
- 107 callsites til `verifiserFirmaAdmin`/`autoriserAdminForFirma`
- Auth-laget (NextAuth/session) berøres IKKE
- Risiko-konsentrasjon: `tilgangskontroll.ts` + `organisasjon.ts` + `timer/dagsseddel.ts`

### Åpne beslutninger

- `phone`: per-person (User) eller per-firma (OrganizationMember)? Uavklart.
- `firmaRoller`-verdier: startsett låst, nye verdier legges til ved behov uten migrasjon

### OrganizationRole-konsolidering (låst 2026-05-12)

`OrganizationRole`-tabellen (opprettet 2026-05-01, per A.27) deprecated til fordel for `OrganizationMember.firmaRoller`. Begrunnelse: 0 rader i prod/test, ingen klient-UI, identisk semantikk. `harOrgRolle`-helper oppdateres i O-2 til å lese fra `OrganizationMember.firmaRoller`. `tildelOrgRolle`/`fjernOrgRolle` oppdateres i O-3. `OrganizationRole`-tabellen droppes i O-5.

### Modul-tilgangssystem: OrganizationMemberPermission (låst 2026-05-12)

Separat tabell for per-bruker, per-modul tilgangsstyring på firma-nivå. `firmaRoller`-arrayen beholder org-roller (`firma_admin`, `hms_ansvarlig`, `hr_ansvarlig`). Modul-tilgang er en egen dimensjon.

Modell:

```prisma
model OrganizationMemberPermission {
  id             String   @id @default(uuid())
  userId         String   @map("user_id")
  organizationId String   @map("organization_id")
  modul          String   // "timer" | "prosjekt" | "maskin" | "varelager"
  tilgang        String   // "les" | "les_skriv"
                          // ingen rad = ingen tilgang
  createdAt      DateTime @default(now())

  @@unique([userId, organizationId, modul])
  @@map("organization_member_permissions")
}
```

Implementeres som dedikert PR etter O-3. `tilgangskontroll.ts` får ny hjelpefunksjon `harModulTilgang(userId, organizationId, modul, krevdTilgang)`.

### T7-4f — Attestering-liste expanded inline (låst 2026-05-16)

**Visuell struktur (godkjent mockup v7):**
- Uke-navigasjon øverst (← Uke 20 →)
- Filter-pills: Prosjekt | Ansatte | Avdeling
- Gruppering per prosjekt (toggle: per ansatt)
- Per gruppe-header: antall sedler · arbeidstimer · maskintimer · [Attester gruppe (N)]
- Per sedel-kort med tabell:
  Kolonner: Lønnsart | Aktivitet | Fra–til | Timer | Maskin · fra–til · timer
  - Maskin: indentert chip per rad med maskinnavn · fra–til · timer
  - Vareforbruk: rad integrert i sedel-tabellen (📦 vare · antall · enhet)
  - ECO/underprosjekt: egen sub-header innen sedelen med blå venstrekant + «→ Godkjenning byggherre»
  - Tilleggskrav (lønnsart-type): oransje rad + oransje sedel-kant
  - Mertid uten tilleggskrav: ingen oransje — badge «X.Xt — ingen tilleggskrav»
  - Sum-rad: arbeidstimer · maskintimer (inkl. OT-notering hvis tillegg finnes)

**Nøkkelprinsipp (låst):**
Oransje farge utløses av lønnsart-TYPE (tillegg-lønnsart registrert av arbeidstaker),
IKKE av antall timer. Mertid uten tilleggskrav = normal grå sedel.

**Handlinger per sedel:**
- Detalj-knapp → åpner AttesteringDetalj (full redigering)
- ↩ Returner | ✓ Attester (oransje ved tilleggskrav)
- ⋯-meny: Rediger sedel | Splitt rad | Returner

#### Sub-PR-plan (4 PR-er, ~3 timer Opus-arbeid totalt)

**T7-4f-1 — Server: utvid `hentTilAttesteringFirma`** (~30 min)
- `apps/api/src/routes/timer/dagsseddel.ts`
- Speile `hentForAttestering`-shape: per-rad `project`-join (cross-package `prisma.project.findMany` på alle unike `projectId`), `redigerTillatt` fra `orgSetting`, beriket `aktivitet` per rad om relevant.
- Én batch-`findMany` for prosjekter på tvers av alle sedler — ingen N+1.
- Bakover-kompatibel: alle eksisterende felter (`totaltimer`, `antallRader`, `ansatt`, `prosjekt`) består; nye felter legges på rad-arrayene.
- Akseptkriterier: `rader[].timer[].project` finnes når rad har annet prosjekt enn sedel-hodet; `redigerTillatt` reflekterer `OrganizationTimerSetting`.

**T7-4f-2 — Refaktor: ekstraher `ProsjektSectionAttest` + `EcoBucketAttest`** (~30 min)
- Flytt blokk `AttesteringDetalj.tsx:892–1119` til ny `apps/web/src/components/timer/attestering-buckets.tsx`.
- Eksporter komponenter + delte typer (`TimerRad`, `MaskinRad`, `TilleggRad`, `RadProsjekt`, `EcoBucketAttestProps`).
- `AttesteringDetalj.tsx` importerer fra ny fil — ingen funksjonell endring. Verifiser med `pnpm typecheck --filter web` + åpne én sedel på test.

**T7-4f-3 — Web: expanded inline + uke-nav + filter-pills** (~90 min)
- `apps/web/src/app/dashbord/firma/timer/attestering/page.tsx` — fullstendig redesign per mockup v7.
- Uke-navigasjon (← Uke 20 →) med dato-range-filter på klient.
- Filter-pills: Prosjekt | Ansatte | Avdeling (Avdeling-modell finnes — C.11 deployet).
- Gruppering per prosjekt (default), toggle per ansatt. Gruppe-header med sum + «Attester gruppe (N)» (kaller `attester`-mutasjon i loop, viser per-rad-feilmelding ved partial fail).
- Per sedel-kort: tabell-layout med Lønnsart | Aktivitet | Fra–til | Timer | Maskin-kolonne.
- Tilleggskrav-detektering: hvis `timer.some(r => r.lonnsart.type === "tillegg")` → oransje rad + sedel-kant.
- Vareforbruk-rad: foreløpig stub eller skjult (se åpen avklaring 2).
- i18n-nøkler i `nb.json` + `en.json` (uke-nav, filter-pills, gruppe-header).

**T7-4f-4 — Avklaring + evt. mini-fix: ECO-flytting fra firma-listen** (~20 min)
- `flyttTimerRadEco` krever `krevProsjektLeder` — har INGEN firma-admin-fallback (i motsetning til `hentForAttestering`).
- Alt A (aktivere): utvid auth med `autoriserAdminForFirma`-fallback parallell med `hentForAttestering`-mønsteret.
- Alt B (skjule): send `kanFlytte={false}` til `ProsjektSectionAttest` fra firma-listen — detalj-siden beholder velgeren.

**Avhengigheter:** T7-4f-1 → T7-4f-3 (server-shape først). T7-4f-2 → T7-4f-3 (eksport før gjenbruk). T7-4f-4 parallelt eller før T7-4f-3.

#### Ikke i scope
- Inline rad-edit (åpne detalj for full redigering — designvalg)
- Persistert collapse-state per bruker
- Bulk-attestering på tvers av grupper (T7-4g om aktuelt)
- Prosjektleder-listen `[prosjektId]/timer/attestering/page.tsx` (egen oppfølger med samme mønster)

#### Åpne avklaringer (før T7-4f-3 startes)
1. **ECO-flytt i firma-listen** — aktivere (T7-4f-4 Alt A) eller skjule (Alt B)?
2. **Vareforbruk-rad i sedel-kort** — `SheetVareforbruk` finnes IKKE i db-timer; vareforbruk er per-prosjekt, ikke per-sedel. Tre veier:
   - (a) Skjul vareforbruk-rad i T7-4f-3, åpne ny PR T7-4f-5 når vareforbruk-kobling til sedel finnes
   - (b) Server-side aggregering: hent `Vareforbruk`-rader per ansatt+dato og injiser i respons
   - (c) Utsette hele T7-4f-spec til vareforbruk-modell er knyttet til SheetTimer
3. **«Mertid uten tilleggskrav»-badge** — krever lønnsart-konfigurasjon for «normal arbeidsdag» (8t? per ansattgruppe?). Eksisterer denne grensen som data, eller hardkodes 7,5/8t i T7-4f-3?

### T7-5 — Web dagsseddel-redigering (beslutninger 2026-05-17)

**Arkitekturprinsipp (låst):**
Web = ekte web-UI. Mobil = app. Ingen formfaktor-kompromiss.
Nettleser på mobil er ikke en reell bruker-kanal for SiteDoc.

**Sammenheng-prinsipp (låst 2026-05-17):**
En «registrering» er én logisk enhet:
```
Timer-rad 5.0t [07:00–12:00] Anleggsarbeid
  ↳ Maskin-rad 3.0t [07:00–10:00] CAT 320
  ↳ Vare: 12 liter grunning
```
Disse henger SAMMEN på samme prosjekt + ECO + tidslinje. Splitt eller
redigering av én del krever at hele enheten vises og kan redigeres i
kontekst — leder må vurdere hva som skjer med maskin og varer når
timer-raden splittes (følger nye timer-rad? deles? blir på original?).

**Sammenheng-validering (låst 2026-05-17, utvidet 2026-05-18):**
- `sum(maskin.timer) ≤ sum(arbeidstimer) + pauseMin/60` PER prosjekt+ECO-gruppe
- Pause-buffer-tillegget (utvidelse 2026-05-18) er nødvendig fordi
  døgn-utleide maskiner (se § utleie_enhet-prinsipp under) går mens
  operatør pauser. Timer-utleide maskiner faller naturlig under
  `≤ arbeid` siden de styres av operatør (pause-bufferen brukes ikke).
- Gjelder også etter splitt: hver ny rad-gruppe må tilfredsstille
  ≤-invarianten med pause-buffer
- Splitt-modal (T7-5c) MÅ vise maskin-rad og kreve fordeling av
  maskintimer slik at ingen ny gruppe bryter invarianten
- Server (T7-4b `validerMaskinUnderArbeid`) er autoritativ — klient-
  visning er veiledende. Funksjonen tar `pauseMin = 0`-parameter
  (default for å bevare gamle kall som ikke vet om pause)

**utleie_enhet-prinsipp (låst 2026-05-18):**
`equipment.utleie_enhet ∈ {'doegn', 'time'}` er det styrende skillet
for hvordan maskin-timer relaterer seg til arbeidstimer. Ikke
hypotetiske «kreverForer» eller «mannsbetjent»-flagg — disse
finnes IKKE i schema og skal ikke innføres.
- `'doegn'`: maskin går mens operatør pauser → pause-buffer i invariant
- `'time'`: maskin styres av operatør → naturlig ≤ arbeid uten buffer
- `er_utleieobjekt=false` (intern bruk): invariant gjelder som baseline
Detaljer i [BACKLOG.md § utleie_enhet-prinsipp](BACKLOG.md). Åpent
spørsmål: skal invariant være per-rad strengere for `'time'`-maskiner?

**Pause-modell-vedtak (låst 2026-05-18):**
Eksplisitt pause-vindu på sedel-nivå: `DailySheet.pauseFra/pauseTil`
(HH:MM, nullable). `pauseMin` denormalisert sum, server-beregnet.
Migrasjon `20260517220000_add_pause_fra_til`. Erstatter opprinnelig
MVP-vedtak (inline checkbox uten tider) — pause-vindu var nødvendig
for å gi maskin-validering riktig pause-buffer. Klient bruker
overlap-deteksjon (`rad.tilTid > pauseFra AND rad.fraTid < pauseTil`)
for å vise pause-status per rad. Detaljer i
[BACKLOG.md § Pause-modell på timer-rad](BACKLOG.md).

**Konsekvenser av sammenheng-prinsippet:**

1. **SplittRadModal er ufullstendig i dag** — splitter kun timer-raden
   alene. Må utvides til å vise tilhørende maskin- og vare-rader for
   samme prosjekt+ECO+tidsoverlapp, og lar leder velge hva som skjer
   med hver. Planlegges som T7-5c (etter T7-5b modal-flyt).

2. **Detaljsiden beholdes fullt funksjonell** — IKKE slankes. Den er
   riktig sted for kompleks redigering der sammenhenger må vurderes
   (multi-rad-utvalg, cross-relationship-edits, full sedel-overblikk).
   Modal-flyten (T7-5b) er for enkle endringer; detaljsiden for komplekse.

3. **Modal-grenser:** Modal håndterer rad-rediger i kontekst av
   sammenheng-gruppen, men ved kompleks attestering (multi-prosjekt,
   per-rad-utvalg over flere ECO-er) leder bytte til detaljside.

**Redigeringsmodell — ansatt:**
- Inline tabell-redigering (hybrid: Sonnet A + Opus A)
- Fra/til → Timer auto-beregnet (Fra+Til → timer), manuelt overstyrbart
- + Legg til ny rad = ansattes primære verktøy
- Splitt: KUN lederverktøy i attestering-flow — ansatt splitter IKKE

**Splitt-tilgjengelighet:**
- I dag: 3 klikk (oversikt → detalj → edit → splitt)
- Mål: 1 klikk fra attestering-liste via ✂-ikon per rad i SeddelKort
- T7-4f-splitt-1-klikk implementerer dette
- **Etterspørsel for sammenheng-håndtering (T7-5c):** SplittRadModal må
  inkludere relaterte maskin/vare-rader, ikke kun timer-raden alene

**Edit-flyt-arkitektur (oppdatert 2026-05-17 etter sammenheng-prinsipp):**

```
Listen (SeddelKort)        Modal (T7-5b)              Detaljside (beholdt)
─────────────────────      ──────────────────         ──────────────────────
✓ Attester hel sedel       ✏ Rediger sammenheng-      Per-rad-utvalg på tvers
↩ Returner hel sedel          gruppen for én rad        av ECO/prosjekter
✂ Splitt sammenheng-       ✓/↩ rad-utvalg innen      Kompleks rediger med
   gruppen (T7-5c)            modalen                    full overblikk
                            Lagre = invalider + lukk    Direktelink-mål
```

**Default for `tillattRedigerVedAttestering`:**
- Nye firma: `true` (lederverktøy bør være aktivt som standard)
- Eksisterende firma: uendret (beholder sin verdi)
- Implementeres via Prisma-schema default-endring (kun DEFAULT-clause,
  ingen UPDATE av eksisterende rader)

**Sub-PR-rekkefølge:**
- T7-5b-1 — DB-default-endring (~15 min)
- T7-5b-2 — `AttesteringDetalj` refaktor: `onFerdig?`-prop som overstyrer
  router-push i modal-modus (~30 min)
- T7-5b-3 — `<RedigerSeddelModal>`-wrapper med max-w-[80vw] (~30 min)
- T7-5b-4 — SeddelKort penn-klikk → modal (lokal state, ikke route) (~20 min)
- T7-5c — SplittRadModal utvidet med sammenheng-håndtering (egen plan)

**Lagre-knapp UX-mønster (vedtatt 2026-05-17):**
Lagre-knapp alltid synlig i modal, grå/inaktiv som default. Aktiveres
(grønn) når noe er endret. Escape/klikk-utenfor lukker uten advarsel —
grønn knapp har allerede signalisert at endringer finnes. Forkastes
endringer ved klikk utenfor.

**Grid-nivåer:**
- Dag-grid: eksisterer (T7-4c, `/dashbord/timer/[id]`)
- Uke-grid: erstatter `/mine` — T7-5a (planlegges separat)
- Måned-grid: kompakt rapport-visning, én linje per registrering,
  sidevei-scroll, kolonnevalg/filter — vurderes som del av timer-rapport

**Maskin-rad i redigering:**
- Vises inline i samme tabell som timer-rader med 🚜-prefiks
- Indentert som underrad (↳) under timer-raden den hører til visuelt
- Fra/til-tid obligatorisk på web (som på attestering edit)
- **Per sammenheng-prinsipp:** maskin-rad er underordnet timer-rad
  visuelt OG logisk — ved splitt/rediger av timer-raden må maskin-raden
  vurderes (T7-5c-scope)

**Vareforbruk:**
- Modell finnes ikke i db-timer ennå (`SheetVareforbruk` mangler)
- Når implementert: skal være en del av sammenheng-gruppen sammen med
  timer og maskin
- Sammenheng-prinsippet er forberedelse for vareforbruk-rader

**Åpent:**
- timer-rapport eksisterer men er prosjektbundet og mangler grid-funksjonalitet
- Overlapp med måned-grid må kartlegges
- T7-5c krever spec for sammenheng-deteksjon: er det fra/til-overlap som
  binder timer + maskin? Eller eksplisitt FK? I dag: ingen FK, kun
  prosjekt+ECO+sedel-id som visuell heuristikk
