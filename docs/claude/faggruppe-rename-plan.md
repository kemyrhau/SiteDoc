# Faggruppe-rename: Komplett plan

## Bakgrunn

Hele kodebasen bruker "enterprise"/"entreprise" for det som egentlig er **faggrupper** (DokumentflytPart). Besluttet 2026-04-16 å rydde opp fullstendig — fra DB-kolonner til UI-strenger.

Se `docs/claude/entreprise-faggruppe-rapport.md` for kartlegging av alle ~1200 forekomster.

## Prinsipp

- **Full konsistens**: UI → variabelnavn → Prisma-felt → DB-kolonne. Ingen `@map`-krykker som skjuler gammelt navn
- **Feature-branch**: `feature/faggruppe-rename` — aldri direkte på develop
- **tRPC-aliaser i 2 uker** for mobil-bakoverkompatibilitet
- **Én migrering** for alle DB-rename — atomisk
- **Backup** før migrering på prod

## Begreper (endelig)

| UI-tekst | Variabelnavn | Prisma-felt | DB-kolonne | Prisma-modell |
|----------|-------------|-------------|------------|--------------|
| Faggruppe | `faggruppe` | `faggruppeId` | `faggruppe_id` | `DokumentflytPart` |
| Bestiller-faggruppe | `bestillerFaggruppe` | `bestillerFaggruppeId` | `bestiller_faggruppe_id` | — |
| Utfører-faggruppe | `utforerFaggruppe` | `utforerFaggruppeId` | `utforer_faggruppe_id` | — |
| Dokumentflyt | `dokumentflyt` | `dokumentflytId` | `dokumentflyt_id` | `Dokumentflyt` |
| Faggruppe-nummer | `faggruppeNummer` | `faggruppeNummer` | `faggruppe_nummer` | — |
| Vis faggruppe | `showFaggruppe` | `showFaggruppe` | `show_faggruppe` | — |

---

## FASE 0: Akutt fix (FØR rename)

Deploy include-fix (commit b7d9734) til prod. Dokumentflyt-siden er ødelagt.

```bash
git checkout main && git merge develop --no-edit && git push origin main
# Deploy til prod
```

---

## FASE 1: Database-migrering

### 1.1 Backup

```bash
ssh sitedoc "pg_dump sitedoc > ~/backups/pre_faggruppe_rename_$(date +%Y%m%d).sql"
ssh sitedoc "pg_dump sitedoc_test > ~/backups/pre_faggruppe_rename_test_$(date +%Y%m%d).sql"
```

### 1.2 SQL-migrering (én fil)

Alle RENAME COLUMN i én migrering:

```sql
-- === dokumentflyt_parts (DokumentflytPart) ===
ALTER TABLE "dokumentflyt_parts" RENAME COLUMN "enterprise_number" TO "faggruppe_nummer";

-- === dokumentflyt_koblinger (DokumentflytKobling) ===
ALTER TABLE "dokumentflyt_koblinger" RENAME COLUMN "enterprise_id" TO "faggruppe_id";

-- === group_enterprises (GroupDokumentflytPart) ===
ALTER TABLE "group_enterprises" RENAME COLUMN "enterprise_id" TO "faggruppe_id";
ALTER TABLE "group_enterprises" RENAME TO "group_faggrupper";

-- === project_invitations (ProjectInvitation) ===
ALTER TABLE "project_invitations" RENAME COLUMN "enterprise_id" TO "faggruppe_id";

-- === folder_access (FolderAccess) ===
ALTER TABLE "folder_access" RENAME COLUMN "enterprise_id" TO "faggruppe_id";
UPDATE "folder_access" SET access_type = 'faggruppe' WHERE access_type = 'enterprise';

-- === dokumentflyter (Dokumentflyt) ===
ALTER TABLE "dokumentflyter" RENAME COLUMN "enterprise_id" TO "faggruppe_id";

-- === dokumentflyt_medlemmer (DokumentflytMedlem) ===
ALTER TABLE "dokumentflyt_medlemmer" RENAME COLUMN "enterprise_id" TO "faggruppe_id";

-- === checklists (Checklist) ===
ALTER TABLE "checklists" RENAME COLUMN "bestiller_enterprise_id" TO "bestiller_faggruppe_id";
ALTER TABLE "checklists" RENAME COLUMN "utforer_enterprise_id" TO "utforer_faggruppe_id";

-- === tasks (Task) ===
ALTER TABLE "tasks" RENAME COLUMN "bestiller_enterprise_id" TO "bestiller_faggruppe_id";
ALTER TABLE "tasks" RENAME COLUMN "utforer_enterprise_id" TO "utforer_faggruppe_id";

-- === report_templates (ReportTemplate) ===
ALTER TABLE "report_templates" RENAME COLUMN "show_enterprise" TO "show_faggruppe";

-- === ftd_nota_periods (FtdNotaPeriod) ===
ALTER TABLE "ftd_nota_periods" RENAME COLUMN "enterprise_id" TO "faggruppe_id";

-- === Indekser (rename for konsistens) ===
ALTER INDEX IF EXISTS "dokumentflyt_koblinger_project_member_id_enterprise_id_key" 
  RENAME TO "dokumentflyt_koblinger_project_member_id_faggruppe_id_key";
ALTER INDEX IF EXISTS "group_enterprises_group_id_enterprise_id_key" 
  RENAME TO "group_faggrupper_group_id_faggruppe_id_key";
ALTER INDEX IF EXISTS "dokumentflyt_medlemmer_dokumentflyt_id_enterprise_id_rolle_s_key" 
  RENAME TO "dokumentflyt_medlemmer_dokumentflyt_id_faggruppe_id_rolle_s_key";
```

**IKKE renames:**
- `senderEnterpriseName` / `recipientEnterpriseName` i `document_transfers` — historiske snapshot-data
- Migreringsfiler — historikk

### 1.3 Prisma-skjema

Oppdater alle felt og relasjoner. Eksempel:

```prisma
// FØR:
model Checklist {
  bestillerEnterpriseId String  @map("bestiller_enterprise_id")
  utforerEnterpriseId   String  @map("utforer_enterprise_id")
  bestillerEnterprise   DokumentflytPart  @relation("ChecklistCreatorDokumentflytPart", ...)
  utforerEnterprise     DokumentflytPart  @relation("ChecklistResponderDokumentflytPart", ...)
}

// ETTER:
model Checklist {
  bestillerFaggruppeId String  @map("bestiller_faggruppe_id")
  utforerFaggruppeId   String  @map("utforer_faggruppe_id")
  bestillerFaggruppe   DokumentflytPart  @relation("ChecklistCreatorDokumentflytPart", ...)
  utforerFaggruppe     DokumentflytPart  @relation("ChecklistResponderDokumentflytPart", ...)
}
```

Komplett liste over felt som renames:

| Modell | Gammelt felt | Nytt felt | Ny DB-kolonne |
|--------|-------------|-----------|---------------|
| DokumentflytPart | `enterpriseNumber` | `faggruppeNummer` | `faggruppe_nummer` |
| DokumentflytKobling | `enterpriseId` | `faggruppeId` | `faggruppe_id` |
| GroupDokumentflytPart | `enterpriseId` | `faggruppeId` | `faggruppe_id` |
| ProjectInvitation | `enterpriseId` | `faggruppeId` | `faggruppe_id` |
| FolderAccess | `enterpriseId` | `faggruppeId` | `faggruppe_id` |
| Dokumentflyt | `enterpriseId` | `faggruppeId` | `faggruppe_id` |
| DokumentflytMedlem | `enterpriseId` | `faggruppeId` | `faggruppe_id` |
| Checklist | `bestillerEnterpriseId` | `bestillerFaggruppeId` | `bestiller_faggruppe_id` |
| Checklist | `utforerEnterpriseId` | `utforerFaggruppeId` | `utforer_faggruppe_id` |
| Task | `bestillerEnterpriseId` | `bestillerFaggruppeId` | `bestiller_faggruppe_id` |
| Task | `utforerEnterpriseId` | `utforerFaggruppeId` | `utforer_faggruppe_id` |
| ReportTemplate | `showEnterprise` | `showFaggruppe` | `show_faggruppe` |
| FtdNotaPeriod | `enterpriseId` | `faggruppeId` | `faggruppe_id` |

Relasjoner:

| Modell | Gammel relasjon | Ny relasjon |
|--------|----------------|-------------|
| Checklist | `bestillerEnterprise` | `bestillerFaggruppe` |
| Checklist | `utforerEnterprise` | `utforerFaggruppe` |
| Task | `bestillerEnterprise` | `bestillerFaggruppe` |
| Task | `utforerEnterprise` | `utforerFaggruppe` |
| DokumentflytKobling | `dokumentflytPart` | `faggruppe` |
| GroupDokumentflytPart | `dokumentflytPart` | `faggruppe` |
| ProjectInvitation | `dokumentflytPart` | `faggruppe` |
| FolderAccess | `dokumentflytPart` | `faggruppe` |
| Dokumentflyt | `dokumentflytPart` | `faggruppe` |
| DokumentflytMedlem | `dokumentflytPart` | `faggruppe` |
| FtdNotaPeriod | `dokumentflytPart` | `faggruppe` |

Tabellnavn:

| Modell | Gammelt @@map | Nytt @@map |
|--------|-------------|------------|
| GroupDokumentflytPart | `group_enterprises` | `group_faggrupper` |

Unique constraints (oppdateres automatisk med Prisma):

| Modell | Gammel | Ny |
|--------|--------|-----|
| DokumentflytKobling | `@@unique([projectMemberId, enterpriseId])` | `@@unique([projectMemberId, faggruppeId])` |
| GroupDokumentflytPart | `@@unique([groupId, enterpriseId])` | `@@unique([groupId, faggruppeId])` |
| DokumentflytMedlem | `@@unique([dokumentflytId, enterpriseId, rolle, steg])` | `@@unique([dokumentflytId, faggruppeId, rolle, steg])` |
| FolderAccess | `@@unique([folderId, accessType, enterpriseId, groupId, userId])` | `@@unique([folderId, accessType, faggruppeId, groupId, userId])` |

---

## FASE 2: Shared-pakker

### Typer (`packages/shared/src/types/index.ts`)

| Gammelt | Nytt |
|---------|------|
| `EnterpriseRole` | `FaggruppeRolle` |
| `EnterpriseIndustry` | `FaggruppeBransje` |
| `EnterpriseColor` | `FaggruppeFarge` |
| `StandardEnterprise` | `StandardFaggruppe` |
| `ENTERPRISE_INDUSTRIES` | `FAGGRUPPE_BRANSJER` |
| `ENTERPRISE_COLORS` | `FAGGRUPPE_FARGER` |
| `STANDARD_ENTREPRISER` | `STANDARD_FAGGRUPPER` |
| `"enterprise_manage"` (tillatelse) | `"faggruppe_manage"` |

### Validering (`packages/shared/src/validation/index.ts`)

| Gammelt | Nytt |
|---------|------|
| `enterpriseRoleSchema` | `faggruppeRolleSchema` |
| `createEnterpriseSchema` | `createFaggruppeSchema` |
| `copyEnterpriseSchema` | `copyFaggruppeSchema` |
| Alle `enterpriseId`-felt | `faggruppeId` |
| Alle `enterpriseIds`-felt | `faggruppeIder` |
| `bestillerEnterpriseId` | `bestillerFaggruppeId` |
| `utforerEnterpriseId` | `utforerFaggruppeId` |

### Utils

| Fil | Gammelt | Nytt |
|-----|---------|------|
| `flytRolle.ts` | `entrepriseIder` | `faggruppeIder` |
| `flytRolle.ts` | `enterpriseId` | `faggruppeId` |
| `mappeTilgang.ts` | `enterpriseId` | `faggruppeId` |
| `mappeTilgang.ts` | `accessType === "enterprise"` | `accessType === "faggruppe"` |

### Permissions data-migrering

`"enterprise_manage"` er lagret i `ProjectGroup.permissions` JSON-felt:

```sql
UPDATE project_groups 
SET permissions = REPLACE(permissions::text, '"enterprise_manage"', '"faggruppe_manage"')::jsonb
WHERE permissions::text LIKE '%enterprise_manage%';
```

---

## FASE 3: API

### Router rename

| Gammelt | Nytt | Fil |
|---------|------|-----|
| `entrepriseRouter` | `faggruppeRouter` | `routes/entreprise.ts` → `routes/faggruppe.ts` |
| Registrert som `entreprise` | `faggruppe` + alias `entreprise` (2 uker) | `trpc/router.ts` |

### Prosedyrer

| Router | Gammel prosedyre | Ny prosedyre |
|--------|-----------------|-------------|
| faggruppe | `hentForProsjekt` | (uendret) |
| faggruppe | `hentMedId` | (uendret) |
| faggruppe | `opprett` | (uendret) |
| faggruppe | `oppdater` | (uendret) |
| faggruppe | `kopier` | (uendret) |
| faggruppe | `settAnsvarlig` | (uendret) |
| faggruppe | `slett` | (uendret) |
| medlem | `hentMineEntrepriser` | `hentMineFaggrupper` + alias |
| medlem | `tilknyttEntreprise` | `tilknyttFaggruppe` + alias |
| medlem | `fjernFraEntreprise` | `fjernFraFaggruppe` + alias |
| gruppe | `oppdaterEntrepriser` | `oppdaterFaggrupper` + alias |

### Tilgangskontroll (`tilgangskontroll.ts`)

| Gammel funksjon | Ny funksjon |
|----------------|-------------|
| `hentBrukerEntrepriseIder` | `hentBrukerFaggruppeIder` |
| `byggEntrepriseFilter` | `byggFaggruppeFilter` |
| `verifiserEntrepriseTilhorighet` | `verifiserFaggruppeTilhorighet` |

### Feilmeldinger

Alle "entreprise"-strenger i feilmeldinger → "faggruppe".

### Include-objekter

Alle `bestillerEnterprise`/`utforerEnterprise` i Prisma includes → `bestillerFaggruppe`/`utforerFaggruppe`.

---

## FASE 4: Web frontend (~260 forekomster)

### Filnavn

| Gammel fil | Ny fil |
|-----------|--------|
| `components/paneler/EntrepriserPanel.tsx` | `FaggrupperPanel.tsx` |
| `components/mengde/entreprise-velger.tsx` | `faggruppe-velger.tsx` |
| `_components/EntrepriseTilknytningModal.tsx` | `FaggruppeTilknytningModal.tsx` |
| `_components/entreprise-farger.ts` | `faggruppe-farger.ts` |
| `prosjekter/[id]/entrepriser/page.tsx` | `prosjekter/[id]/faggrupper/page.tsx` |
| `[prosjektId]/entrepriser/page.tsx` | `[prosjektId]/faggrupper/page.tsx` |

### URL-ruter

| Gammel | Ny |
|--------|-----|
| `/entrepriser` | `/faggrupper` |

### tRPC-kall

Alle `trpc.entreprise.*` → `trpc.faggruppe.*`

### Variabelnavn (mekanisk rename)

- `entreprise` → `faggruppe`
- `entrepriser` → `faggrupper`
- `entrepriseId` → `faggruppeId`
- `entrepriseIder` → `faggruppeIder`
- `entrepriseNavn` → `faggruppeNavn`
- `entrepriseKontakter` → `faggruppeKontakter`
- `enterpriseId` → `faggruppeId`
- `bestillerEnterpriseId` → `bestillerFaggruppeId`
- `utforerEnterpriseId` → `utforerFaggruppeId`
- `EntrepriseItem` → `FaggruppeItem`
- `filterEntreprise` → `filterFaggruppe`
- `oppretterEntreprise` → `oppretterFaggruppe`

### Navigasjonskontekst

`"entrepriser"` → `"faggrupper"` i `navigasjon-kontekst.tsx` og `useAktivSeksjon.ts`

---

## FASE 5: Mobil (~78 forekomster)

Samme mønster som web. Alle `entreprise`/`enterprise` → `faggruppe`.

Etter rename:
1. Bygge ny EAS-build
2. Push til TestFlight
3. Fjern tRPC-aliaser **først etter** mobiloppdatering er distribuert

---

## FASE 6: i18n (14 språk, ~50 nøkler per språk)

### Nøkkel-rename (alle språk)

| Gammel nøkkel-prefiks | Ny nøkkel-prefiks |
|----------------------|-------------------|
| `entrepriser.*` | `faggrupper.*` |
| `tabell.entreprise` | `tabell.faggruppe` |
| `kontakter.entrepriser` | `kontakter.faggrupper` |
| `oppsett.entrepriser` | `oppsett.faggrupper` |
| `dashbord.entrepriser` | `dashbord.faggrupper` |
| `hjelp.entrepriseOverskrift` | `hjelp.faggruppeOverskrift` |
| `hjelp.entrepriseBeskrivelse` | `hjelp.faggruppeBeskrivelse` |
| `landing.entrepriseflyt` | `landing.dokumentflyt` |
| `produksjon.entreprisetilknytning` | `produksjon.faggruppetilknytning` |

### Verdi-endringer

| Språk | Gammel verdi | Ny verdi |
|-------|-------------|---------|
| nb | "Entreprise" / "Entrepriser" | "Faggruppe" / "Faggrupper" |
| en | "Enterprise" / "Enterprises" | "Trade group" / "Trade groups" (verifiser — kan allerede være riktig) |
| Andre | Manuell gjennomgang per språk |

### Metode

Node-skript som:
1. Leser JSON-fil
2. Renames nøkler (gammel → ny)
3. Oppdaterer verdier der påkrevet
4. Skriver tilbake formatert JSON

**ALDRI sed** på JSON-filer.

---

## FASE 7: Dokumentasjon

| Fil | Handling |
|-----|---------|
| `docs/claude/forretningslogikk.md` | Full oppdatering — "entreprise" → "faggruppe" |
| `docs/claude/dokumentflyt.md` | Full oppdatering — "entreprise" → "faggruppe" |
| `docs/claude/terminologi.md` | Allerede oppdatert |
| `CLAUDE.md` | Allerede oppdatert |
| `docs/claude/entreprise-faggruppe-rapport.md` | Slett etter fullført rename |
| Denne filen | Slett etter fullført rename |

---

## FASE 8: Cleanup (2+ uker etter deploy)

1. Fjern tRPC-aliaser (`entreprise` router-alias, prosedyre-aliaser)
2. Grep hele kodebasen for "entreprise"/"enterprise" — skal gi 0 treff utenom:
   - Migreringsfiler (historikk)
   - `senderEnterpriseName`/`recipientEnterpriseName` i DocumentTransfer (historiske snapshot)
   - Denne rapport-filen (som da slettes)
3. Fjern eventuell URL-redirect `/entrepriser` → `/faggrupper`

---

## Rekkefølge og avhengigheter

```
Fase 0 (include-fix til prod)
    ↓
Fase 1 (DB + Prisma) ← MÅ deployes sammen med Fase 2+3
    ↓
Fase 2 (Shared) ← MÅ deployes sammen med Fase 1+3
    ↓
Fase 3 (API med aliaser) ← MÅ deployes sammen med Fase 1+2
    ↓
Fase 4 (Web) ← kan deployes separat etter 1+2+3
    ↓
Fase 5 (Mobil) ← kan deployes separat, trenger EAS-build
    ↓
Fase 6 (i18n) ← kan gjøres parallelt med Fase 4
    ↓
Fase 7 (Docs) ← siste
    ↓
Fase 8 (Cleanup) ← 2+ uker etter at mobil er oppdatert
```

**Kritisk:** Fase 1, 2 og 3 må deployes **atomisk** (samme commit/deploy). Prisma-felt, Zod-skjemaer og API-kode må matche.

---

## Sjekkliste

### Før start
- [ ] Include-fix deployet til prod (Fase 0)
- [ ] Feature-branch `feature/faggruppe-rename` opprettet fra develop
- [ ] Backup av prod og test DB

### Per fase
- [ ] `prisma generate` uten feil
- [ ] `pnpm typecheck` uten feil
- [ ] `pnpm build` uten feil
- [ ] Manuell test av dokumentflyt-siden
- [ ] Manuell test av opprettelse sjekkliste/oppgave
- [ ] Manuell test av videresending

### Etter deploy
- [ ] Prod health check
- [ ] PM2 error logs sjekket
- [ ] Dokumentflyt-side fungerer
- [ ] Sjekkliste opprettelse fungerer
- [ ] Oppgave opprettelse fungerer
