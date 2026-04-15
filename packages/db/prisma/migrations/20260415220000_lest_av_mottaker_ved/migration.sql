-- AlterTable: Legg til lest_av_mottaker_ved på checklists og tasks
ALTER TABLE "checklists" ADD COLUMN "lest_av_mottaker_ved" TIMESTAMP(3);
ALTER TABLE "tasks" ADD COLUMN "lest_av_mottaker_ved" TIMESTAMP(3);
