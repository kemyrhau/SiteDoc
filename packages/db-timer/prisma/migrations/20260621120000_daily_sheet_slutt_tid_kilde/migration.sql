-- Slice 4b-2: DailySheet.sluttTidKilde — kilde for slutt-tiden.
--   "bruker"  = arbeider satte/bekreftet tiden (normal «Slutt dag»/manuell)
--   "midnatt" = automatisk dag-grense fra midnatt-splitt (Slice 4a)
--   "system"  = system-gjettet (glemt-dag-gjenoppretting / maks-varighet)
-- Additivt, NOT NULL DEFAULT 'bruker' backfiller eksisterende rader atomisk
-- (to-stegs-policy: trygt, ingen data slettes). Ingen index (ikke filtrerbart).
ALTER TABLE "timer"."daily_sheets"
  ADD COLUMN "slutt_tid_kilde" TEXT NOT NULL DEFAULT 'bruker';
