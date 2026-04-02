-- Auto-detektert språk for kontrollspørsmål ved avvik
ALTER TABLE "ftd_documents" ADD COLUMN "detected_language" TEXT;
