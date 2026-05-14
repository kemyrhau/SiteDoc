-- T7-2b2 (2026-05-14): parentRadId for sporing av rediger-erstattede rader
-- Svak selvreferanse (A.20-mønster) — ingen FK på selvreferansen.
-- attestertStatus får ny verdi "erstattet" når en rad overskrives ved rediger.

ALTER TABLE "timer"."sheet_timer"
  ADD COLUMN "parent_rad_id" TEXT NULL;
CREATE INDEX "sheet_timer_parent_rad_id_idx" ON "timer"."sheet_timer"("parent_rad_id");

ALTER TABLE "timer"."sheet_tillegg"
  ADD COLUMN "parent_rad_id" TEXT NULL;
CREATE INDEX "sheet_tillegg_parent_rad_id_idx" ON "timer"."sheet_tillegg"("parent_rad_id");

ALTER TABLE "timer"."sheet_machines"
  ADD COLUMN "parent_rad_id" TEXT NULL;
CREATE INDEX "sheet_machines_parent_rad_id_idx" ON "timer"."sheet_machines"("parent_rad_id");
