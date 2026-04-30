-- Rename: OrganizationProject → ProjectOrganization + rolle-felt
-- ========================================================
-- Per fase-0-beslutninger.md § A.5 + § E steg 3 (Fase 0).
--
-- Endringer:
-- 1. Rename tabell organization_projects → project_organizations
-- 2. Rename PK + FK + UNIQUE constraint-navn til nytt prefix
-- 3. Legg til rolle-kolonne (NOT NULL etter bakfyll)
-- 4. Bytt unique-rekkefølge: (organization_id, project_id) → (project_id, organization_id)
-- 5. Bakfyll rolle = 'hovedeier' for alle eksisterende rader
--
-- Trygg én-skudds-migrasjon: rename + ADD COLUMN m/backfill + SET NOT NULL
-- i samme migrasjon. A.18 to-stegs-policy gjelder DROP COLUMN, ikke ADD.
-- Pragmatisk idempotens via DO-blocks der det er praktisk.

-- 1. Rename tabell (idempotent via existence-check)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'organization_projects'
    ) THEN
        ALTER TABLE "organization_projects" RENAME TO "project_organizations";
    END IF;
END $$;

-- 2. Rename PK constraint (idempotent)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'project_organizations'
          AND constraint_name = 'organization_projects_pkey'
    ) THEN
        ALTER TABLE "project_organizations"
            RENAME CONSTRAINT "organization_projects_pkey" TO "project_organizations_pkey";
    END IF;
END $$;

-- 3. Rename FK constraints (idempotent)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'project_organizations'
          AND constraint_name = 'organization_projects_organization_id_fkey'
    ) THEN
        ALTER TABLE "project_organizations"
            RENAME CONSTRAINT "organization_projects_organization_id_fkey"
            TO "project_organizations_organization_id_fkey";
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'project_organizations'
          AND constraint_name = 'organization_projects_project_id_fkey'
    ) THEN
        ALTER TABLE "project_organizations"
            RENAME CONSTRAINT "organization_projects_project_id_fkey"
            TO "project_organizations_project_id_fkey";
    END IF;
END $$;

-- 4. Drop gammelt unique-indeks (organization_id, project_id) og opprett nytt
--    med byttet rekkefølge (project_id, organization_id) per A.5
DROP INDEX IF EXISTS "organization_projects_organization_id_project_id_key";

-- 5. Legg til rolle-kolonne med NOT NULL DEFAULT 'hovedeier'.
--    Postgres bakfyller alle eksisterende rader med default-verdien.
--    Default beholdes på kolonnen så Prisma create() uten rolle-felt
--    fortsetter å virke (matcher @default("hovedeier") i schema.prisma).
ALTER TABLE "project_organizations"
    ADD COLUMN IF NOT EXISTS "rolle" TEXT NOT NULL DEFAULT 'hovedeier';

-- 6. Opprett ny unique-indeks med byttet rekkefølge
CREATE UNIQUE INDEX IF NOT EXISTS "project_organizations_project_id_organization_id_key"
    ON "project_organizations"("project_id", "organization_id");
