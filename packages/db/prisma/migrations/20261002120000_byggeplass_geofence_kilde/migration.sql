-- LAG 1 C3 (timer-GPS, ordre L1-C) — punktets kilde på Byggeplass.
--
-- ADDITIV (to-stegs-policy): kun ADD COLUMN + backfill + CHECK. Ingen DROP, ingen NOT NULL.
-- Idempotent: ADD COLUMN IF NOT EXISTS + DO-block for CHECK → trygg å kjøre to ganger.
--
-- Stille-tomhet-regelen (CLAUDE.md) oppfylt i denne releasen:
--   (a) backfill  — latitude IS NOT NULL → 'ukjent', ellers NULL (se under)
--   (b) garanti   — CHECK (latitude IS NULL) = (geofence_kilde IS NULL)
--   (c) test      — pakke @sitedoc/db: geofence-kilde-koblingen feiler rød når en rad
--                   har punkt uten kilde (byggeplass-geofence-kilde.test.ts)
--
-- Førstemann av lag 1s to migreringer. pauseReferanse (L1-B) kommer ETTER denne.

-- 1. Ny kolonne (nullable, ingen default — kilden settes eksplisitt av skriverne).
ALTER TABLE "byggeplasser" ADD COLUMN IF NOT EXISTS "geofence_kilde" TEXT;

-- 2. Backfill: hver eksisterende byggeplass MED punkt får 'ukjent' — kilden kan ikke
--    rekonstrueres (tegning/manuell/geokodet er ikke lagret historisk), og 'ukjent' er
--    ærlig der en gjetting ville vært verre. Rader uten punkt forblir NULL.
UPDATE "byggeplasser" SET "geofence_kilde" = 'ukjent'
WHERE "latitude" IS NOT NULL AND "geofence_kilde" IS NULL;

-- 3. Garanti: punkt og kilde følges alltid ad — begge satt eller begge NULL.
--    Prisma modellerer ikke CHECK; den bor derfor her (idempotent via DO-block).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'byggeplass_geofence_kilde_sammenheng'
  ) THEN
    ALTER TABLE "byggeplasser" ADD CONSTRAINT "byggeplass_geofence_kilde_sammenheng"
      CHECK (("latitude" IS NULL) = ("geofence_kilde" IS NULL));
  END IF;
END $$;
