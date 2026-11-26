-- L1 LØNNSGRUPPER backfill-telling — kjøres manuelt (DRY-RUN-konvensjonen), FØR og ETTER migreringen.
-- Mønster: 20261003120000_timer_lag2_sporbarhet/backfill-telling-test.sql.
--
-- ─────────────────────────────────────────────────────────────────────────
-- FØR migrering (tabellene finnes ikke ennå). Disse to tallene SKAL bli
-- migreringens «standardgrupper» og «ansatt-rader» i RAISE NOTICE.
-- ─────────────────────────────────────────────────────────────────────────
SELECT count(*) AS forventet_standardgrupper FROM "public"."organizations";
SELECT count(*) AS forventet_ansatt_rader    FROM "public"."organization_members";
SELECT status, count(*) AS medlemmer FROM "public"."organization_members" GROUP BY status ORDER BY status;

-- ─────────────────────────────────────────────────────────────────────────
-- ETTER migrering. 🔴 Begge tallene MÅ være 0 — ellers feiler blokken under.
-- ─────────────────────────────────────────────────────────────────────────
-- SELECT
--   (SELECT count(*) FROM "public"."organizations" o
--     WHERE NOT EXISTS (SELECT 1 FROM "timer"."lonnsgrupper" g
--                       WHERE g."organization_id" = o."id" AND g."er_standard")) AS firma_uten_standardgruppe,
--   (SELECT count(*) FROM "public"."organization_members" m
--     WHERE NOT EXISTS (SELECT 1 FROM "timer"."ansatt_lonnsgrupper" a
--                       WHERE a."organization_id" = m."organization_id" AND a."user_id" = m."user_id")) AS medlemmer_uten_gruppe;
--
-- DO $$
-- DECLARE a bigint; b bigint;
-- BEGIN
--   SELECT count(*) INTO a FROM "public"."organizations" o
--    WHERE NOT EXISTS (SELECT 1 FROM "timer"."lonnsgrupper" g WHERE g."organization_id" = o."id" AND g."er_standard");
--   SELECT count(*) INTO b FROM "public"."organization_members" m
--    WHERE NOT EXISTS (SELECT 1 FROM "timer"."ansatt_lonnsgrupper" x
--                      WHERE x."organization_id" = m."organization_id" AND x."user_id" = m."user_id");
--   IF a > 0 OR b > 0 THEN
--     RAISE EXCEPTION 'STOPP: firma uten standardgruppe = %, medlemmer uten gruppe = %', a, b;
--   END IF;
--   RAISE NOTICE 'OK: 0 firma uten standardgruppe, 0 medlemmer uten gruppe';
-- END $$;
