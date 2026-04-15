-- AlterTable: Legg til eier_user_id på checklists og tasks
ALTER TABLE "checklists" ADD COLUMN "eier_user_id" TEXT;
ALTER TABLE "tasks" ADD COLUMN "eier_user_id" TEXT;

-- Backfill: Sett eier = bestiller for eksisterende dokumenter
UPDATE "checklists" SET "eier_user_id" = "bestiller_user_id" WHERE "eier_user_id" IS NULL;
UPDATE "tasks" SET "eier_user_id" = "bestiller_user_id" WHERE "eier_user_id" IS NULL;

-- AddForeignKey
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_eier_user_id_fkey" FOREIGN KEY ("eier_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_eier_user_id_fkey" FOREIGN KEY ("eier_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
