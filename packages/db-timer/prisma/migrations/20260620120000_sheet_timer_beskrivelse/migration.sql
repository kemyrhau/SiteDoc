-- T.12: SheetTimer.beskrivelse — fritekst per timer-rad («hva jeg gjorde» på
-- denne aktiviteten). Nullable, additivt, ingen backfill nødvendig. Ingen
-- index (fritekst-felt, ikke filtrerbart).
ALTER TABLE "timer"."sheet_timer"
  ADD COLUMN "beskrivelse" TEXT;
