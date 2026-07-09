-- Pausevindu: fast klokkeslett (standard_pause_fra) → relativt til skiftstart
-- (standard_pause_etter_timer). To-stegs migrering: gammel kolonne beholdes,
-- droppes i senere release.

-- 1) Nytt felt, NOT NULL med default 4,0 t (07:00-start → 11:00-vindu = ingen regresjon).
ALTER TABLE "organization_settings"
  ADD COLUMN "standard_pause_etter_timer" DOUBLE PRECISION NOT NULL DEFAULT 4.0;

-- 2) Backfill for firma som FAKTISK har konfigurert et pause-klokkeslett:
--    etterTimer = (pauseFra − startTid) i timer. WHERE matcher konfigurasjon
--    (ikke blind default), jf. migrasjons-backfill-disiplinen. GREATEST-guard
--    hindrer negativ verdi ved ev. inkonsistent konfig (pauseFra før startTid).
UPDATE "organization_settings"
SET "standard_pause_etter_timer" = GREATEST(
  0,
  (
    (split_part("standard_pause_fra", ':', 1)::int * 60 + split_part("standard_pause_fra", ':', 2)::int)
    - (split_part("standard_start_tid", ':', 1)::int * 60 + split_part("standard_start_tid", ':', 2)::int)
  )::double precision / 60.0
)
WHERE "standard_pause_fra" IS NOT NULL
  AND "standard_pause_fra" ~ '^[0-9]{1,2}:[0-9]{2}$'
  AND "standard_start_tid" ~ '^[0-9]{1,2}:[0-9]{2}$';
