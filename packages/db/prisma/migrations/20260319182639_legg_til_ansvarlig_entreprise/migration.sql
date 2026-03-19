-- AlterTable
ALTER TABLE "enterprises" ADD COLUMN     "ansvarlig_id" TEXT;

-- AddForeignKey
ALTER TABLE "enterprises" ADD CONSTRAINT "enterprises_ansvarlig_id_fkey" FOREIGN KEY ("ansvarlig_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
