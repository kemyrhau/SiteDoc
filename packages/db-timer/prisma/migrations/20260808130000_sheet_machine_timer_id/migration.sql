-- Del B pkt 1 — sheet_machine.sheet_timer_id (device-funn 2026-08-08). REN ADDITIV.
--
-- Svak FK (String, ingen Prisma @relation — A.20-mønster) → sheet_timer.id i
-- samme skjema. Kobler en maskin-rad til timer-raden den ble ført sammen med,
-- slik at mobilens rediger-inngang finner igjen «radens» maskin (vis/rediger,
-- ikke dupliser).
--
-- NULLABLE UTEN backfill (to-stegs-policy): eksisterende maskin-rader ble ført
-- FØR koblingen fantes og kan ikke utledes i ettertid uten å gjette. De beholder
-- dagens søsken-rad-oppførsel. Ingen kolonner slettes eller endres.

ALTER TABLE "timer"."sheet_machines"
    ADD COLUMN "sheet_timer_id" TEXT;

CREATE INDEX "sheet_machines_sheet_timer_id_idx"
    ON "timer"."sheet_machines" ("sheet_timer_id");
