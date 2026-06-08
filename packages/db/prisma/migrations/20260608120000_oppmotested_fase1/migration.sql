-- Oppmotested — firma-eid geo-entitet (kontor/verksted) med geofence-radius.
-- ========================================================
-- Fase 1 (2026-06-08, timer-arkitektur SPOR 3): søsken til Avdeling i kjernen.
-- GPS identifiserer hvilket oppmøtested arbeider startet på ved «Start dag»
-- (mobil, lokal-only dokumentasjon). Ingen lønns-/reiselogikk. Rent additivt.
--
-- Cascade-policy:
-- - Oppmotested → Organization: Cascade (slettes med firma)
-- - Oppmotested.avdeling_id → Avdeling: SetNull (valgfri kobling, org- vs fysisk-akse)
--
-- Idempotent (CREATE TABLE IF NOT EXISTS, DO-blocks for FK-er).

CREATE TABLE IF NOT EXISTS "oppmotesteder" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "navn" TEXT NOT NULL,
    "adresse" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "radius_m" INTEGER NOT NULL DEFAULT 150,
    "avdeling_id" TEXT,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "oppmotesteder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "oppmotesteder_organization_id_navn_key"
    ON "oppmotesteder"("organization_id", "navn");

CREATE INDEX IF NOT EXISTS "oppmotesteder_organization_id_aktiv_idx"
    ON "oppmotesteder"("organization_id", "aktiv");

CREATE INDEX IF NOT EXISTS "oppmotesteder_avdeling_id_idx"
    ON "oppmotesteder"("avdeling_id");

DO $$ BEGIN
    ALTER TABLE "oppmotesteder"
        ADD CONSTRAINT "oppmotesteder_organization_id_fkey"
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "oppmotesteder"
        ADD CONSTRAINT "oppmotesteder_avdeling_id_fkey"
        FOREIGN KEY ("avdeling_id") REFERENCES "avdelinger"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
