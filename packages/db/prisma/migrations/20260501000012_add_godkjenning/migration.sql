-- Godkjenning + DocumentTransfer-utvidelse
-- ========================================================
-- Per fase-0-beslutninger.md § A.2 + § E steg 12 + B.3 + B.6.
--
-- Godkjenning er ny dokumentflyt-type for byggherre-godkjenning av kostnad.
-- Følger Checklist/Task-mønsteret. Forhandlingshistorikk og kostnad-snapshot
-- lagres på DocumentTransfer-radene (én rad per send/retur/godkjenn).
--
-- DocumentTransfer utvides med:
-- - godkjenning_id (nullable FK) — gjenbruker transfer-mekanismen for Godkjenning
-- - kostnad_snapshot (JSONB) — snapshot av kostnad ved tidspunktet
--
-- B.6 Timestamptz: created_at, updated_at, godkjent_ved, sist_endret_ved
-- får TIMESTAMPTZ (per § E B.6-note for godkjenning-spor).
--
-- Cascade-policy:
-- - Godkjenning → Project: Cascade
-- - Godkjenning → ECO/Dokumentflyt/Template: SetNull
-- - Godkjenning → bestiller/bestillerFaggruppe/utforerFaggruppe: Restrict (default)
-- - DocumentTransfer.godkjenning_id: Cascade (transfers slettes med godkjenning)
--
-- Idempotent (CREATE TABLE IF NOT EXISTS, DO-blocks for FK-er).

-- 1. godkjenninger-tabell
CREATE TABLE IF NOT EXISTS "godkjenninger" (
    "id" TEXT NOT NULL,
    "template_id" TEXT,
    "project_id" TEXT NOT NULL,
    "bestiller_user_id" TEXT NOT NULL,
    "bestiller_faggruppe_id" TEXT NOT NULL,
    "utforer_faggruppe_id" TEXT NOT NULL,
    "eier_user_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "dokumentflyt_id" TEXT,
    "external_cost_object_id" TEXT,
    "intern_ref" TEXT,
    "byggherre_ref" TEXT,
    "kort_navn" TEXT NOT NULL,
    "godkjent_ved" TIMESTAMPTZ,
    "godkjent_av_user_id" TEXT,
    "endret_etter_sending" BOOLEAN NOT NULL DEFAULT false,
    "sist_endret_ved" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "godkjenninger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "godkjenninger_project_id_intern_ref_key"
    ON "godkjenninger"("project_id", "intern_ref");

CREATE INDEX IF NOT EXISTS "godkjenninger_project_id_status_idx"
    ON "godkjenninger"("project_id", "status");

CREATE INDEX IF NOT EXISTS "godkjenninger_external_cost_object_id_idx"
    ON "godkjenninger"("external_cost_object_id");

CREATE INDEX IF NOT EXISTS "godkjenninger_dokumentflyt_id_idx"
    ON "godkjenninger"("dokumentflyt_id");

-- FK-er (idempotent via DO-blocks)
DO $$ BEGIN
    ALTER TABLE "godkjenninger" ADD CONSTRAINT "godkjenninger_project_id_fkey"
        FOREIGN KEY ("project_id") REFERENCES "projects"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "godkjenninger" ADD CONSTRAINT "godkjenninger_template_id_fkey"
        FOREIGN KEY ("template_id") REFERENCES "report_templates"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "godkjenninger" ADD CONSTRAINT "godkjenninger_bestiller_user_id_fkey"
        FOREIGN KEY ("bestiller_user_id") REFERENCES "users"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "godkjenninger" ADD CONSTRAINT "godkjenninger_bestiller_faggruppe_id_fkey"
        FOREIGN KEY ("bestiller_faggruppe_id") REFERENCES "dokumentflyt_parts"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "godkjenninger" ADD CONSTRAINT "godkjenninger_utforer_faggruppe_id_fkey"
        FOREIGN KEY ("utforer_faggruppe_id") REFERENCES "dokumentflyt_parts"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "godkjenninger" ADD CONSTRAINT "godkjenninger_eier_user_id_fkey"
        FOREIGN KEY ("eier_user_id") REFERENCES "users"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "godkjenninger" ADD CONSTRAINT "godkjenninger_dokumentflyt_id_fkey"
        FOREIGN KEY ("dokumentflyt_id") REFERENCES "dokumentflyter"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "godkjenninger" ADD CONSTRAINT "godkjenninger_external_cost_object_id_fkey"
        FOREIGN KEY ("external_cost_object_id") REFERENCES "external_cost_objects"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "godkjenninger" ADD CONSTRAINT "godkjenninger_godkjent_av_user_id_fkey"
        FOREIGN KEY ("godkjent_av_user_id") REFERENCES "users"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. DocumentTransfer-utvidelse (per A.2)
ALTER TABLE "document_transfers"
    ADD COLUMN IF NOT EXISTS "godkjenning_id" TEXT;

ALTER TABLE "document_transfers"
    ADD COLUMN IF NOT EXISTS "kostnad_snapshot" JSONB;

CREATE INDEX IF NOT EXISTS "document_transfers_godkjenning_id_idx"
    ON "document_transfers"("godkjenning_id");

DO $$ BEGIN
    ALTER TABLE "document_transfers" ADD CONSTRAINT "document_transfers_godkjenning_id_fkey"
        FOREIGN KEY ("godkjenning_id") REFERENCES "godkjenninger"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
