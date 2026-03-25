-- AlterTable
ALTER TABLE "project_group_members" ADD COLUMN     "is_admin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "project_groups" ADD COLUMN     "building_ids" JSONB,
ADD COLUMN     "modules" JSONB NOT NULL DEFAULT '["sjekklister","oppgaver","tegninger","3d"]';
