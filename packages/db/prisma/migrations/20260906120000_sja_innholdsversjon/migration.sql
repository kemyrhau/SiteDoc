-- SJA varig arbeid (fabel-designlås 2026-09-06). Rent additivt — ingen kolonne
-- slettes. Eksisterende rader får innholdsVersjon/signertVersjon = 1 (default) og
-- nySignaturKrevd* = NULL, så ingen falsk «før endring»-merking ved innføring.

-- AlterTable
ALTER TABLE "checklists" ADD COLUMN "innholds_versjon" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "innholds_versjon" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "dokument_signaturer" ADD COLUMN "signert_versjon" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "ny_signatur_krevd_at" TIMESTAMP(3),
ADD COLUMN "ny_signatur_krevd_av" TEXT;
