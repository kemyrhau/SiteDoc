-- Navnegjennomgang: Workflow→slett, Oppretter→Bestiller, Svarer→Utfører, Building→Byggeplass

-- ============================================================
-- FASE A: Slett Workflow-tabeller
-- ============================================================

-- Fjern workflow_id fra checklists og tasks (data bevares, bare FK fjernes)
ALTER TABLE "checklists" DROP CONSTRAINT IF EXISTS "checklists_workflow_id_fkey";
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_workflow_id_fkey";
ALTER TABLE "checklists" DROP COLUMN IF EXISTS "workflow_id";
ALTER TABLE "tasks" DROP COLUMN IF EXISTS "workflow_id";

-- Slett workflow-tabeller (kaskade: step_members og templates først)
DROP TABLE IF EXISTS "workflow_step_members";
DROP TABLE IF EXISTS "workflow_templates";
DROP TABLE IF EXISTS "workflows";

-- ============================================================
-- FASE B: Oppretter/Svarer → Bestiller/Utfører
-- ============================================================

-- Rename kolonner i checklists
ALTER TABLE "checklists" RENAME COLUMN "creator_enterprise_id" TO "bestiller_enterprise_id";
ALTER TABLE "checklists" RENAME COLUMN "responder_enterprise_id" TO "utforer_enterprise_id";
ALTER TABLE "checklists" RENAME COLUMN "creator_user_id" TO "bestiller_user_id";

-- Rename kolonner i tasks
ALTER TABLE "tasks" RENAME COLUMN "creator_enterprise_id" TO "bestiller_enterprise_id";
ALTER TABLE "tasks" RENAME COLUMN "responder_enterprise_id" TO "utforer_enterprise_id";
ALTER TABLE "tasks" RENAME COLUMN "creator_user_id" TO "bestiller_user_id";

-- Oppdater rolle-strenger i dokumentflyt_medlemmer
UPDATE "dokumentflyt_medlemmer" SET "rolle" = 'bestiller' WHERE "rolle" = 'oppretter';
UPDATE "dokumentflyt_medlemmer" SET "rolle" = 'utfører' WHERE "rolle" = 'svarer';

-- ============================================================
-- FASE C: Building → Byggeplass
-- ============================================================

-- Rename tabell
ALTER TABLE "buildings" RENAME TO "byggeplasser";

-- Rename kolonner i relaterte tabeller
ALTER TABLE "drawings" RENAME COLUMN "building_id" TO "byggeplass_id";
ALTER TABLE "point_clouds" RENAME COLUMN "building_id" TO "byggeplass_id";
ALTER TABLE "checklists" RENAME COLUMN "building_id" TO "byggeplass_id";
ALTER TABLE "ftd_kontrakter" RENAME COLUMN "building_id" TO "byggeplass_id";
ALTER TABLE "psi" RENAME COLUMN "building_id" TO "byggeplass_id";
