-- Timer-modul schema-redesign PR 1B (T.1 + T.2, vedtatt 2026-05-11)
--
-- PR 1B — innstramning:
-- 1. Sett project_id NOT NULL på SheetTimer/SheetMachine/SheetTillegg (etter backfill i PR 1A)
-- 2. Drop project_id fra DailySheet
-- 3. Drop avhengig index daily_sheets_project_id_dato_idx
-- 4. Endre unique fra (userId, projectId, dato) til (userId, dato)
--
-- Forutsetning (verifisert før migrasjon):
--   SELECT COUNT(*) FROM timer.sheet_timer    WHERE project_id IS NULL = 0
--   SELECT COUNT(*) FROM timer.sheet_machines WHERE project_id IS NULL = 0
--   SELECT COUNT(*) FROM timer.sheet_tillegg  WHERE project_id IS NULL = 0
--
-- NB: Sonnets opprinnelige SQL brukte `DROP CONSTRAINT uq_dailysheet_user_project_dato`
-- men på prod er det en UNIQUE INDEX (ikke formell CONSTRAINT) med navn
-- `daily_sheets_user_id_project_id_dato_key` (renamet i PR 1A). DROP INDEX brukes.

-- DropIndex
DROP INDEX "timer"."daily_sheets_project_id_dato_idx";

-- DropIndex
DROP INDEX "timer"."daily_sheets_user_id_project_id_dato_key";

-- AlterTable
ALTER TABLE "timer"."daily_sheets" DROP COLUMN "project_id";

-- AlterTable
ALTER TABLE "timer"."sheet_machines" ALTER COLUMN "project_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "timer"."sheet_tillegg" ALTER COLUMN "project_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "timer"."sheet_timer" ALTER COLUMN "project_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "daily_sheets_user_id_dato_key" ON "timer"."daily_sheets"("user_id", "dato");
