-- AlterTable: pause-modell vedtatt 2026-05-17.
-- pauseFra/pauseTil definerer tidspunktet for pausen. pauseMin beholdes
-- som denormalisert sum. Eksisterende sedler har ingen pause-vindu
-- (kun pauseMin) — nullable.
ALTER TABLE "timer"."daily_sheets"
  ADD COLUMN "pause_fra" TEXT,
  ADD COLUMN "pause_til" TEXT;
