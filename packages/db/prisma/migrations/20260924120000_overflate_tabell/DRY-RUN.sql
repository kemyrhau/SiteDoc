-- DRY-RUN for 20260924120000_overflate_tabell — BEVISELIG READ-ONLY.
--
-- Kun SELECT-setninger. Ingen ALTER / INSERT / UPDATE / DELETE / CREATE / DROP.
-- Trygg å kjøre mot test. Kenneth gater; migreringen selv kjøres ALDRI av agenten.
--
-- Formål: bevis at tabellen 'overflater' IKKE finnes ennå (0 rader = ikke migrert),
-- og at foreldre-tabellene FK-ene peker på finnes (projects, byggeplasser, point_clouds).

-- 1) Bevis at 'overflater' IKKE finnes ennå. Forventet: 0 rader.
SELECT table_name
FROM information_schema.tables
WHERE table_name = 'overflater' AND table_schema = 'public';

-- 2) Bevis at foreldre-tabellene FK-ene refererer finnes. Forventet: 3 rader.
SELECT table_name
FROM information_schema.tables
WHERE table_name IN ('projects', 'byggeplasser', 'point_clouds') AND table_schema = 'public'
ORDER BY table_name;

-- 3) Antall LAS-punktskyer pr. prosjekt som KAN overflateberegnes (kilde-materiale).
--    Uendret av migreringen — kun kontekst for hva tabellen vil fylles med.
SELECT project_id, COUNT(*) AS antall_las_punktskyer
FROM point_clouds
WHERE LOWER(file_type) = 'las'
GROUP BY project_id
ORDER BY antall_las_punktskyer DESC;

-- 4) CHECK + partial unique legges til i denne migreringen mot en TOM tabell — kan ikke
--    feile på eksisterende data (det finnes ingen rader). Denne bekrefter bare at ingen
--    tabell ved navn 'overflater' allerede bærer en motstridende constraint.
SELECT conname
FROM pg_constraint
WHERE conname IN ('overflater_punktsky_felt_check', 'overflater_pointcloud_malavstand_key');
