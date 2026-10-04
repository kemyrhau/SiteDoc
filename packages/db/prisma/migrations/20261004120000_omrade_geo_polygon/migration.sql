-- V17-B (timer-GPS, ordre V17-B) — sonens geofence-polygon i lat/lng på Omrade.
--
-- ADDITIV (to-stegs-policy): kun ADD COLUMN + CHECK. Ingen DROP, ingen NOT NULL, INGEN backfill
-- (ingen sone har lat/lng i dag; tegnings-prosent-polygonet `polygon` står urørt). Geometrien
-- utledes på bestilling: tegnet på kart (geo_kilde='kart') eller «Hent fra tegning» (geo_kilde='tegning').
-- Idempotent: ADD COLUMN IF NOT EXISTS + DO-block for CHECK → trygg å kjøre to ganger.
--
-- Stille-tomhet-regelen (CLAUDE.md) i denne releasen:
--   (a) backfill  — IKKE aktuelt: feltet fødes tomt FORDI ingen geometri finnes; det er ikke en
--                   identitetskolonne som skal speile eksisterende rader, men en opt-in-geometri.
--   (b) garanti   — CHECK (geo_polygon IS NULL) = (geo_kilde IS NULL) + geo_kilde IN ('kart','tegning')
--   (c) test      — pakke @sitedoc/api: omrade-geo-polygon.integration.test.ts (CHECK, rød mot tabell
--                   uten constraint) + origo-invariant (settGeometri utleder origo på punktløs byggeplass).

-- 1. Nye kolonner (nullable, ingen default — settes eksplisitt av settGeometri/utledGeometriFraTegning).
ALTER TABLE "omrader" ADD COLUMN IF NOT EXISTS "geo_polygon" JSONB;
ALTER TABLE "omrader" ADD COLUMN IF NOT EXISTS "geo_kilde" TEXT;

-- 2. Garanti: polygon og kilde følges alltid ad (begge satt eller begge NULL), og kilden er
--    kjent (kart|tegning). Prisma modellerer ikke CHECK; den bor derfor her (idempotent via DO-block).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'omrade_geo_polygon_sammenheng'
  ) THEN
    ALTER TABLE "omrader" ADD CONSTRAINT "omrade_geo_polygon_sammenheng"
      CHECK (("geo_polygon" IS NULL) = ("geo_kilde" IS NULL));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'omrade_geo_kilde_verdi'
  ) THEN
    ALTER TABLE "omrader" ADD CONSTRAINT "omrade_geo_kilde_verdi"
      CHECK ("geo_kilde" IS NULL OR "geo_kilde" IN ('kart', 'tegning'));
  END IF;
END $$;
