-- T7-4a (2026-05-16): externalCostObjectId på sheet_machines.
-- Maskin følger samme prosjekt+ECO-gruppe som arbeidstimer per T.7-vedtak
-- (låst 2026-05-16). Svak FK (A.20) — ingen @relation; kjernen-tabellen
-- external_cost_objects ligger utenfor db-timer-skjemaet.
--
-- Nullable + ingen backfill: alle eksisterende rader får NULL (= hovedprosjekt).
-- Grandfather-vedtak per BACKLOG 2026-05-16: gamle sedler valideres ikke
-- retroaktivt mot sum(maskin) ≤ sum(arbeid)-regelen.

ALTER TABLE "timer"."sheet_machines"
  ADD COLUMN "external_cost_object_id" TEXT NULL;

CREATE INDEX "sheet_machines_external_cost_object_id_idx"
  ON "timer"."sheet_machines"("external_cost_object_id");
