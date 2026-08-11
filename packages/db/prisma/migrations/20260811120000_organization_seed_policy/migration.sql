-- OrganizationSeedPolicy — eksplisitt seed-policy per datatype per firma
-- (modul-onboarding, fabel-retning 2026-08-11). REN ADDITIV — ny tabell, ingen
-- eksisterende data endres av selve migreringen. Backfill av policy-rader
-- (A.Markussen + aktiverTomKatalog-/0-katalog-firma) kjøres SEPARAT som script
-- ETTER at listen er godkjent — ikke i denne migreringen.
--
-- Fravær av rad = 'standard' (default). Kun avvik ('egen_katalog') registreres.
-- CHECK-constraints håndhever policy-verdi + at 'egen_katalog' ALLTID har en
-- begrunnelse (en beslutning uten spor er nettopp slik dagens drift oppsto).

CREATE TABLE "organization_seed_policies" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "datatype" TEXT NOT NULL,
    "policy" TEXT NOT NULL,
    "begrunnelse" TEXT,
    "sett_av_user_id" TEXT,
    "sett_dato" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_seed_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_seed_policies_organization_id_datatype_key"
    ON "organization_seed_policies"("organization_id", "datatype");

CREATE INDEX "organization_seed_policies_organization_id_idx"
    ON "organization_seed_policies"("organization_id");

ALTER TABLE "organization_seed_policies"
    ADD CONSTRAINT "organization_seed_policies_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Policy-verdien er binær; datatype er bevisst fri (utvides uten migrasjon).
ALTER TABLE "organization_seed_policies"
    ADD CONSTRAINT "organization_seed_policies_policy_check"
    CHECK ("policy" IN ('standard', 'egen_katalog'));

-- 'egen_katalog' KREVER begrunnelse; 'standard' trenger den ikke.
ALTER TABLE "organization_seed_policies"
    ADD CONSTRAINT "organization_seed_policies_begrunnelse_check"
    CHECK ("policy" <> 'egen_katalog' OR "begrunnelse" IS NOT NULL);
