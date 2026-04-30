-- Project.primaryOrganizationId — nullable FK til Organization
-- ========================================================
-- Per fase-0-beslutninger.md § A.4 + § E steg 4 (Fase 0).
--
-- Bakgrunn:
-- - § E steg 5 (ProjectModule-utvidelse) bakfyller ProjectModule.organization_id
--   fra Project.primary_organization_id (per A.4 SQL).
-- - Feltet forblir nullable i Fase 0 per B.4 interim-beslutning
--   (standalone-prosjekt skal kunne eksistere uten firma-tilknytning).
-- - NOT NULL-håndhevelse er post-Fase 1 (når OrganizationTemplate er bygget).
--
-- Bakfyll-strategi:
-- Eksisterende ProjectOrganization med rolle='hovedeier' brukes som kilde.
-- DISTINCT ON velger eldste hovedeier-rad hvis flere finnes (deterministisk).
-- WHERE p.primary_organization_id IS NULL gjør bakfyllen idempotent.

-- 1. Legg til kolonnen (idempotent)
ALTER TABLE "projects"
    ADD COLUMN IF NOT EXISTS "primary_organization_id" TEXT;

-- 2. FK med ON DELETE SET NULL (idempotent via DO-block)
DO $$
BEGIN
    ALTER TABLE "projects"
        ADD CONSTRAINT "projects_primary_organization_id_fkey"
        FOREIGN KEY ("primary_organization_id") REFERENCES "organizations"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 3. Indeks for framtidig modul-gateway-WHERE og admin-spørringer
CREATE INDEX IF NOT EXISTS "projects_primary_organization_id_idx"
    ON "projects"("primary_organization_id");

-- 4. Bakfyll fra ProjectOrganization rolle='hovedeier'
--    Idempotent — kun rader hvor primary_organization_id ennå er NULL
UPDATE "projects" p
SET "primary_organization_id" = sub.organization_id
FROM (
    SELECT DISTINCT ON (project_id) project_id, organization_id
    FROM "project_organizations"
    WHERE rolle = 'hovedeier'
    ORDER BY project_id, created_at ASC
) sub
WHERE p.id = sub.project_id
  AND p.primary_organization_id IS NULL;
