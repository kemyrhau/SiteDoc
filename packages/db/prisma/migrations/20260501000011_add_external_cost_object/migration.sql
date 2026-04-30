-- ExternalCostObject — felles kostnadsbærer-referanse (Underprosjekt i UI)
-- ========================================================
-- Per fase-0-beslutninger.md § A.1 + § E steg 11 + B.1 + C.6 + C.7.
--
-- Refereres av Timer-modul (Fase 3) og Godkjenning-dokumentflyt (E.12).
-- UI-term «Underprosjekt»; variabelnavn `externalCostObject` / `eco`.
--
-- A.3-mønster: opprettet_av_user_id og lukket_av_user_id er TEXT UTEN
-- foreign key — bevarer audit-spor ved User-sletting.
--
-- Idempotent (CREATE TABLE IF NOT EXISTS, DO-blocks for FK-er).

CREATE TABLE IF NOT EXISTS "external_cost_objects" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "proadm_id" TEXT NOT NULL,
    "proadm_id_at_import" TEXT,
    "kort_navn" TEXT NOT NULL,
    "kilde" TEXT NOT NULL,                                   -- "proadm_import" | "manuell" | "felt_opprettet"
    "kilde_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'aktiv',                  -- "aktiv" | "lukket"
    "timerregistrering_apen" BOOLEAN NOT NULL DEFAULT true,  -- per B.1
    "lukket_ved" TIMESTAMP(3),
    "lukket_av_user_id" TEXT,
    "lukket_grunn" TEXT,
    "slettet_ved" TIMESTAMP(3),
    "opprettet_av_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "external_cost_objects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "external_cost_objects_organization_id_proadm_id_key"
    ON "external_cost_objects"("organization_id", "proadm_id");

CREATE INDEX IF NOT EXISTS "external_cost_objects_project_id_status_idx"
    ON "external_cost_objects"("project_id", "status");

CREATE INDEX IF NOT EXISTS "external_cost_objects_slettet_ved_idx"
    ON "external_cost_objects"("slettet_ved");

DO $$ BEGIN
    ALTER TABLE "external_cost_objects"
        ADD CONSTRAINT "external_cost_objects_organization_id_fkey"
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "external_cost_objects"
        ADD CONSTRAINT "external_cost_objects_project_id_fkey"
        FOREIGN KEY ("project_id") REFERENCES "projects"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
