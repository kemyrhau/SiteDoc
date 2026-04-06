-- AlterTable: Legg til hovedansvarlig_person_id for å peke på spesifikk person i gruppe
ALTER TABLE "dokumentflyt_medlemmer" ADD COLUMN "hovedansvarlig_person_id" TEXT;

-- AddForeignKey
ALTER TABLE "dokumentflyt_medlemmer" ADD CONSTRAINT "dokumentflyt_medlemmer_hovedansvarlig_person_id_fkey" FOREIGN KEY ("hovedansvarlig_person_id") REFERENCES "project_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
