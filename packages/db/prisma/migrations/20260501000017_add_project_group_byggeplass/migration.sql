-- ProjectGroupByggeplass m2m + drop building_ids (Fase 0.5 § 3)
-- ========================================================
-- Per byggeplass-strategi.md § Prinsipp C (C1: koblingstabell) +
-- arkitektur-syntese.md § 5.
--
-- Erstatter ProjectGroup.byggeplassIder (jsonb «building_ids»).
-- Per Prinsipp C-verifisering 2026-05-01 var jsonb-feltet DØDT:
-- - Skrevet i ÉN rute (gruppe.ts:495-503 oppdaterByggeplasser)
-- - LESES ALDRI noe sted i apps/api/src eller apps/web/src
-- - Ingen data å migrere → kan droppes i samme migrasjon
--
-- Semantikk: ingen rader for en gruppe = alle byggeplasser tillatt.
-- Rader = begrenset til disse byggeplassene.
--
-- Cascade-policy: Cascade på begge FK-er (sletting av gruppe eller byggeplass
-- sletter koblingen).
--
-- Idempotent (CREATE TABLE IF NOT EXISTS, DROP COLUMN IF EXISTS,
-- DO-blocks for FK-er).

-- 1. project_group_byggeplasser-tabell (m2m-koblingstabell)
CREATE TABLE IF NOT EXISTS "project_group_byggeplasser" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "byggeplass_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_group_byggeplasser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_group_byggeplasser_group_id_byggeplass_id_key"
    ON "project_group_byggeplasser"("group_id", "byggeplass_id");

CREATE INDEX IF NOT EXISTS "project_group_byggeplasser_byggeplass_id_idx"
    ON "project_group_byggeplasser"("byggeplass_id");

DO $$ BEGIN
    ALTER TABLE "project_group_byggeplasser"
        ADD CONSTRAINT "project_group_byggeplasser_group_id_fkey"
        FOREIGN KEY ("group_id") REFERENCES "project_groups"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "project_group_byggeplasser"
        ADD CONSTRAINT "project_group_byggeplasser_byggeplass_id_fkey"
        FOREIGN KEY ("byggeplass_id") REFERENCES "byggeplasser"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Drop building_ids fra project_groups (verifisert dødt felt)
ALTER TABLE "project_groups"
    DROP COLUMN IF EXISTS "building_ids";
