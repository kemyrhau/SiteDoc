-- Kontrakt- og nota-felter på FtdDocument
ALTER TABLE "ftd_documents" ADD COLUMN IF NOT EXISTS "kontrakt_navn" TEXT;
ALTER TABLE "ftd_documents" ADD COLUMN IF NOT EXISTS "nota_type" TEXT;
ALTER TABLE "ftd_documents" ADD COLUMN IF NOT EXISTS "nota_nr" INTEGER;
ALTER TABLE "ftd_documents" ADD COLUMN IF NOT EXISTS "entreprenor" TEXT;
