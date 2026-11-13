-- Tillegg og utlegg på prosjektkortet (spec tillegg-utlegg-prosjektkort-spec.md § 2,
-- Kenneth 2026-11-13 «Ja til alle»). Hver tillegg-/utleggsrad bærer kortets nøkkel
-- (prosjekt, byggeplass, underprosjekt) som SheetTimer/SheetMachine.
--
-- Additiv og nullable. Steg 2 (NOT NULL) kommer aldri: NULL er en gyldig tilstand.
--   byggeplass_id NULL            = arver sedelens byggeplass (A.30)
--   external_cost_object_id NULL  = uten underprosjekt (hovedgruppa)
-- Ingen backfill (B2): NULL betyr nøyaktig det raden betydde da den ble ført.
-- Svake FK-er (A.20) — byggeplasser og external_cost_objects ligger i kjernen.

ALTER TABLE "timer"."sheet_tillegg"
  ADD COLUMN "byggeplass_id" TEXT,
  ADD COLUMN "external_cost_object_id" TEXT;

ALTER TABLE "timer"."sheet_utlegg"
  ADD COLUMN "byggeplass_id" TEXT,
  ADD COLUMN "external_cost_object_id" TEXT;

CREATE INDEX "sheet_tillegg_byggeplass_id_idx" ON "timer"."sheet_tillegg"("byggeplass_id");
CREATE INDEX "sheet_tillegg_external_cost_object_id_idx" ON "timer"."sheet_tillegg"("external_cost_object_id");
CREATE INDEX "sheet_utlegg_byggeplass_id_idx" ON "timer"."sheet_utlegg"("byggeplass_id");
CREATE INDEX "sheet_utlegg_external_cost_object_id_idx" ON "timer"."sheet_utlegg"("external_cost_object_id");
