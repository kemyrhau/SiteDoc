-- AlterTable
ALTER TABLE "dokumentflyter" ADD COLUMN "enterprise_id" TEXT;

-- AddForeignKey
ALTER TABLE "dokumentflyter" ADD CONSTRAINT "dokumentflyter_enterprise_id_fkey" FOREIGN KEY ("enterprise_id") REFERENCES "enterprises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: sett enterprise_id basert på eksisterende medlemmer (oppretter-entreprise)
UPDATE "dokumentflyter" d
SET "enterprise_id" = (
  SELECT dm."enterprise_id"
  FROM "dokumentflyt_medlemmer" dm
  WHERE dm."dokumentflyt_id" = d."id"
    AND dm."enterprise_id" IS NOT NULL
    AND dm."rolle" = 'oppretter'
  LIMIT 1
)
WHERE d."enterprise_id" IS NULL;
