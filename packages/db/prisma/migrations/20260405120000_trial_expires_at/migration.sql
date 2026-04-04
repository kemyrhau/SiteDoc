-- AlterTable
ALTER TABLE "projects" ADD COLUMN "trial_expires_at" TIMESTAMP(3);

-- Sett trialExpiresAt = createdAt + 30 dager for eksisterende prosjekter uten firma
UPDATE "projects" SET "trial_expires_at" = "created_at" + INTERVAL '30 days'
WHERE "id" NOT IN (SELECT "project_id" FROM "organization_projects")
AND "trial_expires_at" IS NULL;
