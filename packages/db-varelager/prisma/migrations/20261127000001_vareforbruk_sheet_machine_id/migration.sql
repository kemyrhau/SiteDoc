-- Runde 5 (Kenneth 2026-11-27, vedtak A): varen kobles til maskinraden den er ført fra
-- i maskinvinduet. Bare additivt: nullable kolonne + indeks. Ingenting droppes, ingen
-- data endres. Ingen backfill: eldre varer og varer fra «+ Legg til vare» har NULL, som
-- betyr «vare uten maskin» (riktig betydning, ikke tomhet). Eldre koblinger kan ikke
-- utledes uten å gjette.

-- AlterTable
ALTER TABLE "varelager"."vareforbruk" ADD COLUMN "sheet_machine_id" TEXT;

-- CreateIndex
CREATE INDEX "vareforbruk_sheet_machine_id_idx" ON "varelager"."vareforbruk"("sheet_machine_id");
