-- OrganizationTemplate — firma-eid mal-bibliotek (mal-promotering)
-- ========================================================
-- Per fase-0-beslutninger.md § E steg 7 + migrering-reporttemplate.md.
--
-- To nye tabeller:
-- - organization_templates: speiler report_templates, eid av Organization
-- - organization_template_objects: speiler report_objects
--
-- ReportTemplate utvides med to valgfrie koblings-felter:
-- - organization_template_id: peker oppover hvis kopiert fra firma-mal
-- - promoted_to_firma: true når denne mal er promotert til firma-bibliotek
--
-- Ingen datamigrering: eksisterende ReportTemplate-rader er gyldige uten
-- endring (begge nye felter er valgfrie/har default).
--
-- API-ruter (firmamal.*) og UI bygges i Fase 2 (per migrering-reporttemplate.md).
--
-- Idempotent (CREATE TABLE IF NOT EXISTS, DO-blocks for FK-er).

-- 1. organization_templates
CREATE TABLE IF NOT EXISTS "organization_templates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "prefix" TEXT,
    "category" TEXT NOT NULL DEFAULT 'sjekkliste',
    "domain" TEXT NOT NULL DEFAULT 'bygg',
    "subjects" JSONB DEFAULT '[]',
    "show_subject" BOOLEAN NOT NULL DEFAULT true,
    "show_faggruppe" BOOLEAN NOT NULL DEFAULT true,
    "show_location" BOOLEAN NOT NULL DEFAULT true,
    "show_priority" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "enable_change_log" BOOLEAN NOT NULL DEFAULT false,
    "kontrollomrade" TEXT,
    "promoted_from_template_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organization_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "organization_templates_organization_id_idx"
    ON "organization_templates"("organization_id");

CREATE INDEX IF NOT EXISTS "organization_templates_promoted_from_template_id_idx"
    ON "organization_templates"("promoted_from_template_id");

DO $$ BEGIN
    ALTER TABLE "organization_templates"
        ADD CONSTRAINT "organization_templates_organization_id_fkey"
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "organization_templates"
        ADD CONSTRAINT "organization_templates_promoted_from_template_id_fkey"
        FOREIGN KEY ("promoted_from_template_id") REFERENCES "report_templates"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. organization_template_objects
CREATE TABLE IF NOT EXISTS "organization_template_objects" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "translations" JSONB NOT NULL DEFAULT '{}',
    "sort_order" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organization_template_objects_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "organization_template_objects_template_id_idx"
    ON "organization_template_objects"("template_id");

CREATE INDEX IF NOT EXISTS "organization_template_objects_parent_id_idx"
    ON "organization_template_objects"("parent_id");

DO $$ BEGIN
    ALTER TABLE "organization_template_objects"
        ADD CONSTRAINT "organization_template_objects_template_id_fkey"
        FOREIGN KEY ("template_id") REFERENCES "organization_templates"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "organization_template_objects"
        ADD CONSTRAINT "organization_template_objects_parent_id_fkey"
        FOREIGN KEY ("parent_id") REFERENCES "organization_template_objects"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. ReportTemplate-utvidelse: organization_template_id + promoted_to_firma
ALTER TABLE "report_templates"
    ADD COLUMN IF NOT EXISTS "organization_template_id" TEXT;

ALTER TABLE "report_templates"
    ADD COLUMN IF NOT EXISTS "promoted_to_firma" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "report_templates_organization_template_id_idx"
    ON "report_templates"("organization_template_id");

DO $$ BEGIN
    ALTER TABLE "report_templates"
        ADD CONSTRAINT "report_templates_organization_template_id_fkey"
        FOREIGN KEY ("organization_template_id") REFERENCES "organization_templates"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
