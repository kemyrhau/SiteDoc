-- Avdeling — firma-intern organisatorisk inndeling (Fase 0.5 § 1)
-- ========================================================
-- Per fase-0-beslutninger.md § C.11 + byggeplass-strategi.md § Avdeling.
--
-- Avdeling skiller seg fra Byggeplass:
-- - Avdeling = organisatorisk inndeling av firma (Tromsø, Narvik, Transport)
-- - Byggeplass = fysisk lokasjon innenfor et prosjekt (eksisterende tabell)
--
-- A.Markussen-mønster: «Uten avdeling» er gyldig permanent tilstand
-- (User.avdelingId = NULL).
--
-- Cascade-policy:
-- - Avdeling → Organization: Cascade (Avdeling-er slettes med firma)
-- - User.avdelingId → Avdeling: SetNull (sletting av Avdeling skal IKKE slette brukere)
--
-- Idempotent (CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS,
-- DO-blocks for FK-er).

-- 1. avdelinger-tabell
CREATE TABLE IF NOT EXISTS "avdelinger" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kode" TEXT,                                         -- intern kode (kan være null)
    "navn" TEXT NOT NULL,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "avdelinger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "avdelinger_organization_id_navn_key"
    ON "avdelinger"("organization_id", "navn");

CREATE INDEX IF NOT EXISTS "avdelinger_organization_id_aktiv_idx"
    ON "avdelinger"("organization_id", "aktiv");

DO $$ BEGIN
    ALTER TABLE "avdelinger"
        ADD CONSTRAINT "avdelinger_organization_id_fkey"
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. User-utvidelse: avdeling_id (nullable + SetNull)
ALTER TABLE "users"
    ADD COLUMN IF NOT EXISTS "avdeling_id" TEXT;

CREATE INDEX IF NOT EXISTS "users_avdeling_id_idx"
    ON "users"("avdeling_id");

DO $$ BEGIN
    ALTER TABLE "users"
        ADD CONSTRAINT "users_avdeling_id_fkey"
        FOREIGN KEY ("avdeling_id") REFERENCES "avdelinger"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
