-- Steg 1d — drop ProjectModule.active.
--
-- Per fase-0-beslutninger.md A.4 + A.18 (to-stegs migration-policy):
-- Steg 1 (allerede deployet i 20260501000005): la til `status TEXT NOT NULL
-- DEFAULT 'aktiv'` parallelt med `active Boolean`. Eksisterende rader fikk
-- status='aktiv' eller 'arkivert' basert på active-verdien.
-- Steg 2 (denne): drop `active`-kolonnen — ingen kode-callsites igjen
-- (verifisert via grep 2026-05-03).
--
-- Unique-indeks (project_id, module_slug) beholdes uendret. Cross-org-aktivering
-- (`(projectId, organizationId, moduleSlug)`-unique) er utsatt til Steg 1e
-- når OrganizationModule-tabell lages og cross-org-flow er designet konkret.
--
-- Idempotent via DROP COLUMN IF EXISTS.

ALTER TABLE "project_modules" DROP COLUMN IF EXISTS "active";
