-- ProjectModule-utvidelse — organizationId + status (3-nivå)
-- ========================================================
-- Per fase-0-beslutninger.md § A.4 + § A.17 + § A.18 (Fase 0 § E steg 5).
--
-- Steg 1 (denne migrasjonen):
-- - Legg til organization_id (nullable per B.4 interim)
-- - Legg til status TEXT NOT NULL DEFAULT 'aktiv' (3-nivå per A.17)
-- - Bakfyll organization_id fra Project.primary_organization_id (krever § E steg 4)
-- - Bakfyll status fra eksisterende active-flagg
-- - active beholdes parallelt — droppes i steg 2 (post-Fase 1) når all kode er
--   bekreftet å bruke status
--
-- Steg 2 (POST-FASE 1, ikke nå):
-- - DROP unique-indeks (project_id, module_slug)
-- - CREATE unique-indeks (project_id, organization_id, module_slug)
-- - DROP COLUMN active
-- - ALTER COLUMN organization_id SET NOT NULL (avhenger av B.4-utfall)
--
-- Idempotent (ADD COLUMN IF NOT EXISTS, DO-block FK).

-- 1. Tilføy organization_id (nullable)
ALTER TABLE "project_modules"
    ADD COLUMN IF NOT EXISTS "organization_id" TEXT;

-- 2. FK til organizations (idempotent via DO-block)
DO $$
BEGIN
    ALTER TABLE "project_modules"
        ADD CONSTRAINT "project_modules_organization_id_fkey"
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 3. Indeks for FK-lookup
CREATE INDEX IF NOT EXISTS "project_modules_organization_id_idx"
    ON "project_modules"("organization_id");

-- 4. Tilføy status med default 'aktiv' (Postgres bakfyller alle eksisterende rader)
ALTER TABLE "project_modules"
    ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'aktiv';

-- 5. Overstyr status='arkivert' for eksisterende rader hvor active=false
--    Idempotent: kun rader hvor active=false OG status fortsatt er 'aktiv'
UPDATE "project_modules"
SET "status" = 'arkivert'
WHERE "active" = false
  AND "status" = 'aktiv';

-- 6. Bakfyll organization_id fra Project.primary_organization_id
--    Idempotent — kun rader hvor organization_id ennå er NULL
UPDATE "project_modules" pm
SET "organization_id" = p.primary_organization_id
FROM "projects" p
WHERE pm.project_id = p.id
  AND pm.organization_id IS NULL
  AND p.primary_organization_id IS NOT NULL;
