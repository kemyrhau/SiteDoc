-- Byggeplass geofence — lat/lng-senter + radius avledet fra georeferert tegning.
-- ========================================================
-- Fase 1c (2026-06-09, timer-arkitektur SPOR 3): gir Byggeplass koordinater så
-- GPS kan identifisere hvilken byggeplass arbeider står på (1c-mobil, senere).
-- Løser byggeplass-koordinat-gapet (fase-0 T.8:990) som også Fase 3 trenger.
--
-- Rent additivt: tre nullable kolonner, ingen sletting, enkelt-steg. Settes når
-- en koblet tegning georefereres (auto, kun når tom) eller manuelt overstyrt.
-- Idempotent (ADD COLUMN IF NOT EXISTS).

ALTER TABLE "byggeplasser" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "byggeplasser" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
ALTER TABLE "byggeplasser" ADD COLUMN IF NOT EXISTS "radius_m" INTEGER;
