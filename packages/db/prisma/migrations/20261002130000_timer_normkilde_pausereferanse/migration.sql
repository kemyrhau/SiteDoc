-- B6 v3 (V16, L1-B) + B3 (V6): lønnsnormens kilde og pausevinduets referanse
-- på organization_settings. Begge additive med default.
--
-- Kjøres ETTER 20261002120000_byggeplass_geofence_kilde (L1-C).
ALTER TABLE "organization_settings"
  ADD COLUMN "norm_kilde" TEXT NOT NULL DEFAULT 'fast',
  ADD COLUMN "pause_referanse" TEXT NOT NULL DEFAULT 'ankomst';

-- Backfill (stille-tomhet-regelen): firmaer med aktive sommertid_start-rader
-- har VALGT sesong → "kalender" (de beholder utledet norm, forslagene fortsetter
-- uendret). Alle andre står på lovnorm 'fast' (Kenneth: «norsk lov med 7,5 t»).
UPDATE "organization_settings" os
SET "norm_kilde" = 'kalender'
WHERE EXISTS (
  SELECT 1
  FROM "arbeidstids_kalender" ak
  WHERE ak."organization_id" = os."organization_id"
    AND ak."type" = 'sommertid_start'
    AND ak."aktiv" = true
);
