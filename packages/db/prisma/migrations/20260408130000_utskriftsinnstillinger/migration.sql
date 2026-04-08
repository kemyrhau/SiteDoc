-- AlterTable: Legg til utskriftsinnstillinger (JSON) på projects
ALTER TABLE "projects" ADD COLUMN "utskrifts_innstillinger" JSONB;
