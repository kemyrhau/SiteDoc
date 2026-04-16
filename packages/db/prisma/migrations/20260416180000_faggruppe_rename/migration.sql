-- Faggruppe-rename: enterprise → faggruppe
-- Alle kolonner, tabellnavn, indekser og data-verdier

-- === dokumentflyt_parts (Faggruppe) ===
ALTER TABLE "dokumentflyt_parts" RENAME COLUMN "enterprise_number" TO "faggruppe_nummer";

-- === dokumentflyt_koblinger (FaggruppeKobling) ===
ALTER TABLE "dokumentflyt_koblinger" RENAME COLUMN "enterprise_id" TO "faggruppe_id";

-- === group_enterprises → group_faggrupper (GroupFaggruppe) ===
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

-- === Indekser ===
ALTER INDEX IF EXISTS "dokumentflyt_koblinger_project_member_id_enterprise_id_key"
  RENAME TO "dokumentflyt_koblinger_project_member_id_faggruppe_id_key";
ALTER INDEX IF EXISTS "group_enterprises_group_id_enterprise_id_key"
  RENAME TO "group_faggrupper_group_id_faggruppe_id_key";
ALTER INDEX IF EXISTS "dokumentflyt_medlemmer_dokumentflyt_id_enterprise_id_rolle_s_key"
  RENAME TO "dokumentflyt_medlemmer_dokumentflyt_id_faggruppe_id_rolle_st_key";
ALTER INDEX IF EXISTS "folder_access_folder_id_access_type_enterprise_id_group_id_u_key"
  RENAME TO "folder_access_folder_id_access_type_faggruppe_id_group_id_us_key";
ALTER INDEX IF EXISTS "ftd_nota_periods_enterprise_id_idx"
  RENAME TO "ftd_nota_periods_faggruppe_id_idx";

-- === Permissions data i ProjectGroup.permissions JSON ===
UPDATE "project_groups"
SET permissions = REPLACE(permissions::text, '"enterprise_manage"', '"faggruppe_manage"')::jsonb
WHERE permissions::text LIKE '%enterprise_manage%';
