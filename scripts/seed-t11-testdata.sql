-- T.11 testdata for EAS-enhetstest — KUN sitedoc_test (server-ny).
-- Idempotent: re-kjøring dupliserer ikke (INSERT ... WHERE NOT EXISTS).
-- Ingen schema/migrering — kun data. Rører IKKE medlemskap.
\set ON_ERROR_STOP on

-- Firma «Byggeleder -Firma» — matches på org-id (dash-uavhengig).
\set ORG 'f1000001-0000-0000-0000-000000000002'

-- ===========================================================================
-- GUARD: avbryt hvis ikke sitedoc_test (aldri prod)
-- ===========================================================================
DO $$
BEGIN
  IF current_database() <> 'sitedoc_test' THEN
    RAISE EXCEPTION 'AVBRUTT: feil database (%) — dette skriptet kjører KUN mot sitedoc_test', current_database();
  END IF;
END $$;

\echo '=== DIAGNOSTIKK: firma som matcher Byggeleder ==='
SELECT id, name FROM organizations WHERE name ILIKE '%Byggeleder%';

\echo '=== DIAGNOSTIKK: relevante brukere ==='
SELECT id, email, name FROM users
WHERE email IN ('k.emyrhau@gmail.com', 'kemyrhau@gmail.com');

-- ===========================================================================
-- 1. Equipment ×1 (maskin.equipment) — kreves for harEquipmentCache på mobil
-- ===========================================================================
INSERT INTO maskin.equipment
  (id, organization_id, kategori, type, merke, modell, intern_navn, intern_nummer, status, created_at, updated_at)
SELECT gen_random_uuid(), o.id, 'anleggsmaskin', 'Gravemaskin', 'Volvo', 'EC220E',
       'Gravemaskin EQ-042', 'EQ-042', 'tilgjengelig', now(), now()
FROM organizations o
WHERE o.id = :'ORG'
  AND NOT EXISTS (
    SELECT 1 FROM maskin.equipment e
    WHERE e.organization_id = o.id AND e.intern_nummer = 'EQ-042'
  );

-- ===========================================================================
-- 2. Kompetansetype «Maskinførerbevis» (TRUCK-/MASKINFØRERBEVIS, aktiv)
-- ===========================================================================
INSERT INTO kompetansetyper
  (id, organization_id, navn, kategori, aktiv, created_at, updated_at)
SELECT gen_random_uuid(), o.id, 'Maskinførerbevis', 'TRUCK-/MASKINFØRERBEVIS', true, now(), now()
FROM organizations o
WHERE o.id = :'ORG'
  AND NOT EXISTS (
    SELECT 1 FROM kompetansetyper k
    WHERE k.organization_id = o.id AND k.navn = 'Maskinførerbevis'
  );

-- ===========================================================================
-- 3. AnsattKompetanse: gyldig (3 år frem) maskinførerbevis for Ola Tømrer
--    (k.emyrhau@gmail.com). Kenneth (kemyrhau@gmail.com) får BEVISST ingen.
-- ===========================================================================
INSERT INTO ansatt_kompetanser
  (id, user_id, kompetansetype_id, utstedt_dato, utloper, utsteder_organ, importert_via, importert_ved, created_at, updated_at)
SELECT gen_random_uuid(), u.id, k.id, CURRENT_DATE, (CURRENT_DATE + INTERVAL '3 years')::date,
       'Testdata', 'manuell', now(), now(), now()
FROM users u
JOIN organizations o ON o.id = :'ORG'
JOIN kompetansetyper k ON k.organization_id = o.id AND k.navn = 'Maskinførerbevis'
WHERE u.email = 'k.emyrhau@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM ansatt_kompetanser ak
    WHERE ak.user_id = u.id AND ak.kompetansetype_id = k.id
  );

-- ===========================================================================
-- VERIFISERING
-- ===========================================================================
\echo '=== RESULTAT: equipment ==='
SELECT e.id, e.intern_nummer, e.merke, e.modell, e.status
FROM maskin.equipment e JOIN organizations o ON o.id = e.organization_id
WHERE o.id = :'ORG' AND e.intern_nummer = 'EQ-042';

\echo '=== RESULTAT: kompetansetype ==='
SELECT k.id, k.navn, k.kategori, k.aktiv
FROM kompetansetyper k JOIN organizations o ON o.id = k.organization_id
WHERE o.id = :'ORG' AND k.navn = 'Maskinførerbevis';

\echo '=== RESULTAT: Ola Tømrer MED bevis (utloper skal være ~3 år frem) ==='
SELECT u.email, ak.utloper, ak.importert_via
FROM ansatt_kompetanser ak
JOIN users u ON u.id = ak.user_id
JOIN kompetansetyper k ON k.id = ak.kompetansetype_id AND k.navn = 'Maskinførerbevis'
WHERE u.email = 'k.emyrhau@gmail.com';

\echo '=== KONTROLL: Kenneth UTEN bevis (skal være t/true) ==='
SELECT NOT EXISTS (
  SELECT 1 FROM ansatt_kompetanser ak
  JOIN users u ON u.id = ak.user_id
  JOIN kompetansetyper k ON k.id = ak.kompetansetype_id AND k.navn = 'Maskinførerbevis'
  WHERE u.email = 'kemyrhau@gmail.com'
) AS kenneth_uten_bevis;
