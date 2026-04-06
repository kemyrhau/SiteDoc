-- AlterTable: Legg til er_firmaansvarlig på project_members
ALTER TABLE "project_members" ADD COLUMN "er_firmaansvarlig" BOOLEAN NOT NULL DEFAULT false;
