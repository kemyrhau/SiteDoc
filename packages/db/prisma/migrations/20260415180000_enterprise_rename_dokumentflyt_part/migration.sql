-- ==========================================================================
-- Enterprise → DokumentflytPart: rename tabeller, indekser, fremmednøkler
-- Ingen data endres — kun metadata (navn, constraints)
-- ==========================================================================

-- -------------------------------------------------------
-- 1. Dropp fremmednøkler som PEKER PÅ enterprises
--    (må droppes før tabellen kan renames)
-- -------------------------------------------------------
ALTER TABLE "checklists"             DROP CONSTRAINT "checklists_creator_enterprise_id_fkey";
ALTER TABLE "checklists"             DROP CONSTRAINT "checklists_responder_enterprise_id_fkey";
ALTER TABLE "dokumentflyt_medlemmer" DROP CONSTRAINT "dokumentflyt_medlemmer_enterprise_id_fkey";
ALTER TABLE "dokumentflyter"         DROP CONSTRAINT "dokumentflyter_enterprise_id_fkey";
ALTER TABLE "folder_access"          DROP CONSTRAINT "folder_access_enterprise_id_fkey";
ALTER TABLE "ftd_nota_periods"       DROP CONSTRAINT "ftd_nota_periods_enterprise_id_fkey";
ALTER TABLE "group_enterprises"      DROP CONSTRAINT "group_enterprises_enterprise_id_fkey";
ALTER TABLE "member_enterprises"     DROP CONSTRAINT "member_enterprises_enterprise_id_fkey";
ALTER TABLE "project_invitations"    DROP CONSTRAINT "project_invitations_enterprise_id_fkey";
ALTER TABLE "tasks"                  DROP CONSTRAINT "tasks_creator_enterprise_id_fkey";
ALTER TABLE "tasks"                  DROP CONSTRAINT "tasks_responder_enterprise_id_fkey";

-- Dropp fremmednøkler SOM enterprises SELV HAR
ALTER TABLE "enterprises" DROP CONSTRAINT "enterprises_ansvarlig_id_fkey";
ALTER TABLE "enterprises" DROP CONSTRAINT "enterprises_kontrakt_id_fkey";
ALTER TABLE "enterprises" DROP CONSTRAINT "enterprises_organization_id_fkey";
ALTER TABLE "enterprises" DROP CONSTRAINT "enterprises_project_id_fkey";

-- Dropp fremmednøkler PÅ member_enterprises
ALTER TABLE "member_enterprises" DROP CONSTRAINT "member_enterprises_project_member_id_fkey";

-- -------------------------------------------------------
-- 2. Fjern organization_id-kolonnen (hører ikke hjemme på dokumentflyt-rollen)
-- -------------------------------------------------------
DROP INDEX IF EXISTS "enterprises_organization_id_idx";
ALTER TABLE "enterprises" DROP COLUMN IF EXISTS "organization_id";

-- -------------------------------------------------------
-- 3. Rename tabeller
-- -------------------------------------------------------
ALTER TABLE "enterprises"        RENAME TO "dokumentflyt_parts";
ALTER TABLE "member_enterprises" RENAME TO "dokumentflyt_koblinger";

-- -------------------------------------------------------
-- 4. Rename indekser
-- -------------------------------------------------------
ALTER INDEX "enterprises_pkey"                                       RENAME TO "dokumentflyt_parts_pkey";
ALTER INDEX "member_enterprises_pkey"                                RENAME TO "dokumentflyt_koblinger_pkey";
ALTER INDEX "member_enterprises_project_member_id_enterprise_id_key" RENAME TO "dokumentflyt_koblinger_project_member_id_enterprise_id_key";

-- -------------------------------------------------------
-- 5. Gjenopprett fremmednøkler PÅ dokumentflyt_parts (tidl. enterprises)
-- -------------------------------------------------------
ALTER TABLE "dokumentflyt_parts" ADD CONSTRAINT "dokumentflyt_parts_ansvarlig_id_fkey"
  FOREIGN KEY ("ansvarlig_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "dokumentflyt_parts" ADD CONSTRAINT "dokumentflyt_parts_kontrakt_id_fkey"
  FOREIGN KEY ("kontrakt_id") REFERENCES "ftd_kontrakter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "dokumentflyt_parts" ADD CONSTRAINT "dokumentflyt_parts_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- -------------------------------------------------------
-- 6. Gjenopprett fremmednøkler PÅ dokumentflyt_koblinger (tidl. member_enterprises)
-- -------------------------------------------------------
ALTER TABLE "dokumentflyt_koblinger" ADD CONSTRAINT "dokumentflyt_koblinger_project_member_id_fkey"
  FOREIGN KEY ("project_member_id") REFERENCES "project_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dokumentflyt_koblinger" ADD CONSTRAINT "dokumentflyt_koblinger_enterprise_id_fkey"
  FOREIGN KEY ("enterprise_id") REFERENCES "dokumentflyt_parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- -------------------------------------------------------
-- 7. Gjenopprett fremmednøkler FRA andre tabeller → dokumentflyt_parts
-- -------------------------------------------------------
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_creator_enterprise_id_fkey"
  FOREIGN KEY ("bestiller_enterprise_id") REFERENCES "dokumentflyt_parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "checklists" ADD CONSTRAINT "checklists_responder_enterprise_id_fkey"
  FOREIGN KEY ("utforer_enterprise_id") REFERENCES "dokumentflyt_parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "dokumentflyt_medlemmer" ADD CONSTRAINT "dokumentflyt_medlemmer_enterprise_id_fkey"
  FOREIGN KEY ("enterprise_id") REFERENCES "dokumentflyt_parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dokumentflyter" ADD CONSTRAINT "dokumentflyter_enterprise_id_fkey"
  FOREIGN KEY ("enterprise_id") REFERENCES "dokumentflyt_parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "folder_access" ADD CONSTRAINT "folder_access_enterprise_id_fkey"
  FOREIGN KEY ("enterprise_id") REFERENCES "dokumentflyt_parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ftd_nota_periods" ADD CONSTRAINT "ftd_nota_periods_enterprise_id_fkey"
  FOREIGN KEY ("enterprise_id") REFERENCES "dokumentflyt_parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "group_enterprises" ADD CONSTRAINT "group_enterprises_enterprise_id_fkey"
  FOREIGN KEY ("enterprise_id") REFERENCES "dokumentflyt_parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_invitations" ADD CONSTRAINT "project_invitations_enterprise_id_fkey"
  FOREIGN KEY ("enterprise_id") REFERENCES "dokumentflyt_parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_creator_enterprise_id_fkey"
  FOREIGN KEY ("bestiller_enterprise_id") REFERENCES "dokumentflyt_parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_responder_enterprise_id_fkey"
  FOREIGN KEY ("utforer_enterprise_id") REFERENCES "dokumentflyt_parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
