-- AlterTable
ALTER TABLE "ftd_documents" ADD COLUMN "utfort_pr" TIMESTAMP(3);
ALTER TABLE "ftd_documents" ADD COLUMN "utfort_totalt" DECIMAL(18,2);
ALTER TABLE "ftd_documents" ADD COLUMN "utfort_forrige" DECIMAL(18,2);
ALTER TABLE "ftd_documents" ADD COLUMN "utfort_denne" DECIMAL(18,2);
ALTER TABLE "ftd_documents" ADD COLUMN "innestaaende" DECIMAL(18,2);
ALTER TABLE "ftd_documents" ADD COLUMN "innestaaende_forrige" DECIMAL(18,2);
ALTER TABLE "ftd_documents" ADD COLUMN "innestaaende_denne" DECIMAL(18,2);
ALTER TABLE "ftd_documents" ADD COLUMN "netto_denne" DECIMAL(18,2);
ALTER TABLE "ftd_documents" ADD COLUMN "mva" DECIMAL(18,2);
ALTER TABLE "ftd_documents" ADD COLUMN "sum_ink_mva" DECIMAL(18,2);
