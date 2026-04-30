-- OrganizationPartner — firma-eid bibliotek over UE/byggherre/leverandører
-- ========================================================
-- Per fase-0-beslutninger.md § E steg 6 + arkitektur-syntese.md § 3.2 + § 4.
--
-- Felter (variant B): name, organizationNumber, partnerType, contactName,
-- contactEmail, contactPhone, notes, archived.
--
-- Faggruppe utvides med partnerId (nullable) — kunde-drevet migrering fra
-- eksisterende companyName-fritekst skjer over tid (ingen automatisk bakfyll).
--
-- @@unique([organizationId, organizationNumber]) forhindrer dobbel-
-- registrering av samme orgnr per firma. NULL er distinct i Postgres,
-- så flere partnere uten orgnr går likevel.
--
-- Idempotent (CREATE TABLE IF NOT EXISTS, DO-blocks for FK-er).

-- 1. OrganizationPartner-tabell
CREATE TABLE IF NOT EXISTS "organization_partners" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization_number" TEXT,
    "partner_type" TEXT,
    "contact_name" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organization_partners_pkey" PRIMARY KEY ("id")
);

-- 2. FK til organizations (idempotent)
DO $$
BEGIN
    ALTER TABLE "organization_partners"
        ADD CONSTRAINT "organization_partners_organization_id_fkey"
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 3. Unique-constraint (organizationId, organizationNumber) + index
CREATE UNIQUE INDEX IF NOT EXISTS "organization_partners_organization_id_organization_number_key"
    ON "organization_partners"("organization_id", "organization_number");

CREATE INDEX IF NOT EXISTS "organization_partners_organization_id_idx"
    ON "organization_partners"("organization_id");

-- 4. Faggruppe utvidelse: partner_id (nullable, FK til OrganizationPartner)
ALTER TABLE "dokumentflyt_parts"
    ADD COLUMN IF NOT EXISTS "partner_id" TEXT;

DO $$
BEGIN
    ALTER TABLE "dokumentflyt_parts"
        ADD CONSTRAINT "dokumentflyt_parts_partner_id_fkey"
        FOREIGN KEY ("partner_id") REFERENCES "organization_partners"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "dokumentflyt_parts_partner_id_idx"
    ON "dokumentflyt_parts"("partner_id");

-- Ingen bakfyll i Fase 0 — eksisterende Faggruppe.companyName-fritekst kan
-- ikke trygt mappes til partner-rader uten menneskelig bekreftelse.
-- Migrerings-UI bygges i senere fase (kunde-drevet).
