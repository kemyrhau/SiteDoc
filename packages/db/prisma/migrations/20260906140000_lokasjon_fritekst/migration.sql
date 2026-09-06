-- Fritekst-lokasjon (Kenneth-gate 2026-09-06). Rent additivt, nullbart. En
-- presisering innenfor byggeplassen når det ikke finnes tegning å pinne på
-- («Akse 4»). Eksisterende rader = NULL. Ingen backfill.

-- AlterTable
ALTER TABLE "checklists" ADD COLUMN "lokasjon_fritekst" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "lokasjon_fritekst" TEXT;
