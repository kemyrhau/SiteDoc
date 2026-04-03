-- PSI per bygning (valgfritt)
ALTER TABLE "psi" ADD COLUMN "building_id" TEXT;
ALTER TABLE "psi" ADD CONSTRAINT "psi_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Fjern gammel unique (project_id alene) og lag ny (project_id + building_id)
ALTER TABLE "psi" DROP CONSTRAINT IF EXISTS "psi_project_id_key";
CREATE UNIQUE INDEX "psi_project_id_building_id_key" ON "psi"("project_id", "building_id");
