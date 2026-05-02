-- C9 2026-05-02 — Aktivitet per rad + SheetMachine
-- ==================================================
-- 1. SheetTimer.aktivitetId NOT NULL + Restrict-FK (backfill fra parent)
-- 2. DailySheet.aktivitetId blir nullable default (UX-bekvemmelighet)
-- 3. Ny SheetMachine-tabell (vehicleId svak FK til db-maskin per A.20)
--
-- Bakgrunn: dagsseddel-design.md vedtatt — Maskintimer + Anleggsarbeid
-- må kunne ligge på samme dag/prosjekt. ECO-flyttingen 2026-04-29 var
-- presedensen.

-- ----------------------------------------------------------------------
-- Steg 1: SheetTimer.aktivitetId — add nullable, backfill, set NOT NULL
-- ----------------------------------------------------------------------

ALTER TABLE "timer"."sheet_timer"
  ADD COLUMN "aktivitet_id" TEXT;

UPDATE "timer"."sheet_timer" st
  SET "aktivitet_id" = ds."aktivitet_id"
  FROM "timer"."daily_sheets" ds
  WHERE ds."id" = st."sheet_id"
    AND ds."aktivitet_id" IS NOT NULL;

-- Sanity-check: alle eksisterende rader må ha aktivitet_id satt etter backfill.
-- Hvis noen mangler (parent.aktivitet_id var NULL), feiler NOT NULL-constraint
-- under og migrasjonen rulles tilbake. På prod (Runde 1B) er alle parents NOT NULL,
-- så dette er trygt.
ALTER TABLE "timer"."sheet_timer"
  ALTER COLUMN "aktivitet_id" SET NOT NULL;

ALTER TABLE "timer"."sheet_timer"
  ADD CONSTRAINT "sheet_timer_aktivitet_id_fkey"
  FOREIGN KEY ("aktivitet_id")
  REFERENCES "timer"."aktiviteter"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

CREATE INDEX "sheet_timer_aktivitet_id_idx"
  ON "timer"."sheet_timer"("aktivitet_id");

-- ----------------------------------------------------------------------
-- Steg 2: DailySheet.aktivitetId — drop NOT NULL (blir default-felt)
-- ----------------------------------------------------------------------

ALTER TABLE "timer"."daily_sheets"
  ALTER COLUMN "aktivitet_id" DROP NOT NULL;

-- ----------------------------------------------------------------------
-- Steg 3: SheetMachine — ny tabell for maskinbruk per dagsseddel
-- ----------------------------------------------------------------------

CREATE TABLE "timer"."sheet_machines" (
    "id" TEXT NOT NULL,
    "sheet_id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "timer" DECIMAL(6,2) NOT NULL,
    "mengde" DECIMAL(12,2),
    "enhet" TEXT,
    "attestert_snapshot" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sheet_machines_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "timer"."sheet_machines"
  ADD CONSTRAINT "sheet_machines_sheet_id_fkey"
  FOREIGN KEY ("sheet_id")
  REFERENCES "timer"."daily_sheets"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

CREATE INDEX "sheet_machines_sheet_id_idx"
  ON "timer"."sheet_machines"("sheet_id");

CREATE INDEX "sheet_machines_vehicle_id_idx"
  ON "timer"."sheet_machines"("vehicle_id");
