-- AlterTable: Legg til per-ledd redigerbarhet på dokumentflyt-medlemmer
ALTER TABLE "dokumentflyt_medlemmer" ADD COLUMN "kan_redigere" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "dokumentflyt_medlemmer" ADD COLUMN "laases_etter_passeringer" INTEGER;
