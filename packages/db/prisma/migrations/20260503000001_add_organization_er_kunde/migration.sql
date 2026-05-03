-- Steg 1a (domene-arbeidsflyt: Prioritert byggerekkefølge).
-- Skiller reelle kundefirmaer (bruker SiteDoc) fra skall-firmaer
-- (kun part i prosjekt/dokumentflyt).
--
-- Heuristikk for backfill (verifisert mot test-DB + prod-DB 2026-05-03):
--   er_kunde = har_maskin_modul
--           OR har_timer_modul
--           OR EXISTS primaryProjects (Project.primary_organization_id)
--           OR EXISTS Avdeling
--
-- Dropp signaler som viste seg ubrukelige:
--   - organization_settings: auto-upsert ved første hentSetting-kall
--   - users: testdata-misbruk (rolle-test-brukere lagt på skall-firmaer)

ALTER TABLE "organizations"
  ADD COLUMN "er_kunde" BOOLEAN NOT NULL DEFAULT false;

UPDATE "organizations" o SET "er_kunde" = true
WHERE
  o."har_maskin_modul" = true
  OR o."har_timer_modul" = true
  OR EXISTS (SELECT 1 FROM "projects" p WHERE p."primary_organization_id" = o."id")
  OR EXISTS (SELECT 1 FROM "avdelinger" a WHERE a."organization_id" = o."id");
