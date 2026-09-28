-- DRY-RUN — forgiftede vedlegg-URL-er i checklists.data / tasks.data
-- =====================================================================
-- 🔴 SELECT-ONLY. Trygt mot prod. Skriver INGENTING. Kjør denne FØRST og
--    les hver rad før du vurderer rydding.sql.
--
-- Bakgrunn: en signert («forgiftet») /uploads/-URL — /uploads/…?exp=…&sig=… —
-- ble skrevet til dokumentdata i Fase 1 (ca7f16b6). Signaturen har innebygd
-- utløp, så den dør i databasen. Del A (hmac.ts) heler visningen ved emisjon,
-- så disse dokumentene VISER bildene igjen uten at DB røres. Denne ryddingen
-- fjerner bare den døde query-strengen slik at lagret verdi er den rå stien.
--
-- ⚠️ `LIKE '%sig=%'` alene er et TAK — «sig=» kan stå i fritekst. Derfor
--    matcher vi den FAKTISKE delstrengen /uploads/…?…sig=… (regex `~`), og
--    dry-run-en viser hver URL eksplisitt så du ser at det er en /uploads/-URL.
--
-- Målt av Kenneth 28.09 (prod): 5 checklists + 1 task. Én av checklist-radene
-- tilhører en KUNDE (A.Markussen AS, id f4337dff…) — den sorteres øverst og
-- flagges, så du ser nøyaktig hva en UPDATE ville gjort med kundens dokument.

SELECT
  tabell,
  id,
  (id LIKE 'f4337dff%')                          AS er_kunde_amarkussen,
  (arr)[1]                                        AS forgiftet_url,
  regexp_replace((arr)[1], '\?.*$', '')           AS blir_til_ra_sti
FROM (
  SELECT 'checklist' AS tabell, c.id,
         regexp_matches(c.data::text, '/uploads/[^"?]+\?[^"]*sig=[^"]*', 'g') AS arr
  FROM checklists c
  WHERE c.data::text ~ '/uploads/[^"?]+\?[^"]*sig='
  UNION ALL
  SELECT 'task' AS tabell, t.id,
         regexp_matches(t.data::text, '/uploads/[^"?]+\?[^"]*sig=[^"]*', 'g') AS arr
  FROM tasks t
  WHERE t.data::text ~ '/uploads/[^"?]+\?[^"]*sig='
) s
ORDER BY er_kunde_amarkussen DESC, tabell, id;

-- Antall berørte rader (skal stemme med det målte: prod = 5 checklists + 1 task):
SELECT 'checklists' AS tabell, count(*) AS antall_rader
FROM checklists WHERE data::text ~ '/uploads/[^"?]+\?[^"]*sig='
UNION ALL
SELECT 'tasks', count(*)
FROM tasks WHERE data::text ~ '/uploads/[^"?]+\?[^"]*sig=';
