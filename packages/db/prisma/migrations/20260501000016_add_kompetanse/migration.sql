-- Kompetansetype + AnsattKompetanse + OrganizationSetting-utvidelse (Fase 0.5 § 2)
-- ========================================================
-- Per fase-0-beslutninger.md § A.28 + § C.14.
--
-- To-tabell-struktur verifisert mot SmartDok 2026-04-29:
-- - Kompetansetype: definisjons-register (hvilke kompetanser firmaet bruker)
-- - AnsattKompetanse: bruker × kompetansetype med utstedt-/utløp-data
--
-- OrganizationSetting utvides med kompetanse_registrering_tilgang
-- (RBAC-policy: firma_admin | bruker_egen | alle, default firma_admin).
--
-- Cascade-policy:
-- - Kompetansetype → Organization: Cascade
-- - AnsattKompetanse → User: Cascade (sletting av User sletter kompetanse-historikk)
-- - AnsattKompetanse → Kompetansetype: Restrict (kan ikke slette type med
--   tilknyttede ansatt-rader — krever migrering først)
--
-- A.3-mønster: opprettet_av_user_id er TEXT UTEN foreign key — bevarer
-- audit-spor ved User-sletting.
--
-- Idempotent (CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS,
-- DO-blocks for FK-er).

-- 1. kompetansetyper-tabell
CREATE TABLE IF NOT EXISTS "kompetansetyper" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "navn" TEXT NOT NULL,                                          -- "M2 Gravemaskin" | "DO CAT 325"
    "kategori" TEXT NOT NULL,                                      -- se KOMPETANSE_KATEGORIER (7 SmartDok-bekreftede)
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "default_utloper_aar" INTEGER,                                 -- null = ingen default-utløp
    "beskrivelse" TEXT,
    "koblet_til_equipment_modell" TEXT,                            -- for DO-kobling Fase 6
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "kompetansetyper_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "kompetansetyper_organization_id_navn_key"
    ON "kompetansetyper"("organization_id", "navn");

CREATE INDEX IF NOT EXISTS "kompetansetyper_organization_id_kategori_idx"
    ON "kompetansetyper"("organization_id", "kategori");

DO $$ BEGIN
    ALTER TABLE "kompetansetyper"
        ADD CONSTRAINT "kompetansetyper_organization_id_fkey"
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. ansatt_kompetanser-tabell
CREATE TABLE IF NOT EXISTS "ansatt_kompetanser" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kompetansetype_id" TEXT NOT NULL,
    "utstedt_dato" DATE,                                           -- SmartDok kaller det «Fullført dato»
    "utloper" DATE,
    "utsteder_organ" TEXT,
    "sertifikat_nr" TEXT,
    "vedlegg" JSONB,                                               -- [{url, filename, type, uploadedAt}]
    "notat" TEXT,
    "opprettet_av_user_id" TEXT,                                   -- A.3-mønster: ingen FK, audit-spor overlever User-sletting
    "importert_via" TEXT,                                          -- "manuell" | "csv" | "xlsx" | "hr_api" | "smartdok"
    "importert_ved" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ansatt_kompetanser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ansatt_kompetanser_user_id_kompetansetype_id_key"
    ON "ansatt_kompetanser"("user_id", "kompetansetype_id");

CREATE INDEX IF NOT EXISTS "ansatt_kompetanser_utloper_idx"
    ON "ansatt_kompetanser"("utloper");

CREATE INDEX IF NOT EXISTS "ansatt_kompetanser_kompetansetype_id_idx"
    ON "ansatt_kompetanser"("kompetansetype_id");

DO $$ BEGIN
    ALTER TABLE "ansatt_kompetanser"
        ADD CONSTRAINT "ansatt_kompetanser_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "ansatt_kompetanser"
        ADD CONSTRAINT "ansatt_kompetanser_kompetansetype_id_fkey"
        FOREIGN KEY ("kompetansetype_id") REFERENCES "kompetansetyper"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. OrganizationSetting-utvidelse: kompetanse_registrering_tilgang
ALTER TABLE "organization_settings"
    ADD COLUMN IF NOT EXISTS "kompetanse_registrering_tilgang" TEXT NOT NULL DEFAULT 'firma_admin';
