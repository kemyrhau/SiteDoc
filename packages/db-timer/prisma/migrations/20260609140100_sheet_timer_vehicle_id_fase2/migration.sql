-- Fase 2 / T.10: SheetTimer.vehicleId — kostnadsbærer for maskinvedlikehold.
-- Timene en mekaniker fører på vedlikehold av en maskin attribueres til
-- maskinen. DISTINKT fra sheet_machines.vehicle_id (drift/anleggstimer).
-- Svak FK → maskin.equipment (db-maskin, A.20-mønster). Nullable — settes kun
-- på interne verksted-rader. Additivt, ingen backfill.
ALTER TABLE "timer"."sheet_timer"
  ADD COLUMN "vehicle_id" TEXT;

CREATE INDEX "sheet_timer_vehicle_id_idx" ON "timer"."sheet_timer"("vehicle_id");
