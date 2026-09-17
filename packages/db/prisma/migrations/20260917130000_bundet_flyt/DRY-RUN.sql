-- DRY-RUN for 20260917130000_bundet_flyt — BEVISELIG READ-ONLY.
--
-- Kun SELECT-setninger. Ingen ALTER / INSERT / UPDATE / DELETE / CREATE / DROP.
-- Trygg å kjøre mot test. Kenneth gater; migreringen selv kjøres ALDRI av agenten.
--
-- Formål (krav 5): vis hvor mange dokumentflyter migreringen berører per prosjekt,
-- og bevis at kolonnen 'bundet' ikke finnes ennå (0 rader = ikke migrert).

-- 1) Antall dokumentflyter per prosjekt (omfanget migreringen berører).
SELECT project_id, COUNT(*) AS antall_flyter
FROM dokumentflyter
GROUP BY project_id
ORDER BY antall_flyter DESC;

-- 2) Bevis at kolonnen 'bundet' IKKE finnes ennå. Forventet: 0 rader.
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'dokumentflyter' AND column_name = 'bundet';
