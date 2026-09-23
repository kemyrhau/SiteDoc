-- DRY-RUN for 20260923120000_omrade_lokasjonsniva — BEVISELIG READ-ONLY.
--
-- Kun SELECT-setninger. Ingen ALTER / INSERT / UPDATE / DELETE / CREATE / DROP.
-- Trygg å kjøre mot test. Kenneth gater; migreringen selv kjøres ALDRI av agenten.
--
-- Formål: bevis at kolonnen 'omrade_id' IKKE finnes ennå (0 rader = ikke migrert), og vis
-- omfanget — hvor mange dokumenter som i dag har lokasjonOmfang satt (uendret av migreringen).

-- 1) Bevis at 'omrade_id' IKKE finnes ennå på checklists/tasks. Forventet: 0 rader.
SELECT table_name, column_name
FROM information_schema.columns
WHERE column_name = 'omrade_id' AND table_name IN ('checklists', 'tasks');

-- 2) Dagens lokasjonsomfang-fordeling (uendret av migreringen — additiv kolonne rører ikke data).
SELECT 'checklists' AS tabell, COALESCE(lokasjon_omfang, '(null)') AS omfang, COUNT(*) AS antall
FROM checklists GROUP BY lokasjon_omfang
UNION ALL
SELECT 'tasks' AS tabell, COALESCE(lokasjon_omfang, '(null)') AS omfang, COUNT(*) AS antall
FROM tasks GROUP BY lokasjon_omfang
ORDER BY tabell, omfang;

-- 3) Antall definerte områder pr. prosjekt (mulige framtidige koblinger). Uendret av migreringen.
SELECT project_id, COUNT(*) AS antall_omrader
FROM omrader
GROUP BY project_id
ORDER BY antall_omrader DESC;
