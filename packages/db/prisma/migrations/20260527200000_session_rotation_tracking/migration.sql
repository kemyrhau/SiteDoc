-- H1 sikkerhets-audit 2026-05-27: spor token-alder for rotasjon ved bruk
--
-- To-stegs additiv migrasjon:
-- 1. Legg til nullable kolonner
-- 2. Backfill basert på expires (eksisterende sessions har ingen
--    historikk — anta worst-case at de er ~30 dager gamle: last_rotated_at
--    = expires - 30d)
-- 3. SET NOT NULL + default NOW()

ALTER TABLE "sessions" ADD COLUMN "created_at" TIMESTAMP(3);
ALTER TABLE "sessions" ADD COLUMN "last_rotated_at" TIMESTAMP(3);

UPDATE "sessions"
SET
  "created_at" = "expires" - INTERVAL '30 days',
  "last_rotated_at" = "expires" - INTERVAL '30 days'
WHERE "created_at" IS NULL;

ALTER TABLE "sessions" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "sessions" ALTER COLUMN "last_rotated_at" SET NOT NULL;
ALTER TABLE "sessions" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "sessions" ALTER COLUMN "last_rotated_at" SET DEFAULT CURRENT_TIMESTAMP;
