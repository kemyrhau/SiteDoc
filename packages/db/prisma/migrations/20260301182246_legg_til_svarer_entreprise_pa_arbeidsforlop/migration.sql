-- AlterTable
ALTER TABLE "workflows" ADD COLUMN     "responder_enterprise_id" TEXT;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_responder_enterprise_id_fkey" FOREIGN KEY ("responder_enterprise_id") REFERENCES "enterprises"("id") ON DELETE SET NULL ON UPDATE CASCADE;
