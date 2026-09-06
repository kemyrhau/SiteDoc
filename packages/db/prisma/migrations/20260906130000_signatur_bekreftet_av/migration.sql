-- «Bekreftet av» på gjestesignatur (Kenneth-vedtak 2026-09-06). Rent additivt,
-- nullbart. Eksisterende rader = NULL (ingen backfill — vi vet ikke hvem som
-- bekreftet dem, og skal ikke gjette). Satt kun når ansvarlig bekrefter en gjest.

-- AlterTable
ALTER TABLE "dokument_signaturer" ADD COLUMN "bekreftet_av_user_id" TEXT;
