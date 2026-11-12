-- Dagsoversikt i radform (Kenneth 2026-11-12): vareforbruk kobles til timerraden
-- den er ført fra. Additivt steg: nullable kolonne + indeks. Ingenting droppes,
-- ingen data endres, ingen backfill (koblingen kan ikke utledes uten å gjette —
-- eldre linjer står ukoblet og vises under «Uten rad»).

-- AlterTable
ALTER TABLE "varelager"."vareforbruk" ADD COLUMN "sheet_timer_id" TEXT;

-- CreateIndex
CREATE INDEX "vareforbruk_sheet_timer_id_idx" ON "varelager"."vareforbruk"("sheet_timer_id");
