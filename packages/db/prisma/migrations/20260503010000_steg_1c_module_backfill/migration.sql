-- Steg 1c Fase A — bakfyll ProjectModule fra firma-modul-flagg.
--
-- Bakgrunn: I dag styres Timer/Maskin-tilgang via Organization.har_timer_modul
-- og har_maskin_modul. Steg 1c gjør overgangen til ProjectModule som sannhets-
-- kilde. Denne migrasjonen oppretter ProjectModule-rader (status='aktiv') for
-- alle prosjekter der primary_organization har modulen aktivert.
--
-- Avgrenset til primary_organization_id som bakfyll-kilde — dagens unique-
-- indeks (project_id, module_slug) tillater kun én rad per prosjekt+slug.
-- Cross-org-aktivering (UE med egen Timer-modul på samme prosjekt) håndteres
-- i Steg 1d når unique endres til (project_id, organization_id, module_slug).
--
-- Idempotent via ON CONFLICT — kan kjøres flere ganger uten effekt.
-- har_timer_modul/har_maskin_modul-kolonnene beholdes inntil Steg 1c Fase C.

INSERT INTO "project_modules" ("id", "project_id", "module_slug", "organization_id", "active", "status", "created_at")
SELECT gen_random_uuid(), p."id", 'timer', o."id", true, 'aktiv', NOW()
FROM "projects" p
JOIN "organizations" o ON o."id" = p."primary_organization_id"
WHERE o."har_timer_modul" = true
ON CONFLICT ("project_id", "module_slug") DO NOTHING;

INSERT INTO "project_modules" ("id", "project_id", "module_slug", "organization_id", "active", "status", "created_at")
SELECT gen_random_uuid(), p."id", 'maskin', o."id", true, 'aktiv', NOW()
FROM "projects" p
JOIN "organizations" o ON o."id" = p."primary_organization_id"
WHERE o."har_maskin_modul" = true
ON CONFLICT ("project_id", "module_slug") DO NOTHING;
