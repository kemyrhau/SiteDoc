-- AlterTable
ALTER TABLE "dokumentflyt_medlemmer" ADD COLUMN "group_id" TEXT;

-- AddForeignKey
ALTER TABLE "dokumentflyt_medlemmer" ADD CONSTRAINT "dokumentflyt_medlemmer_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "project_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "dokumentflyt_medlemmer_dokumentflyt_id_group_id_rolle_steg_key" ON "dokumentflyt_medlemmer"("dokumentflyt_id", "group_id", "rolle", "steg");
