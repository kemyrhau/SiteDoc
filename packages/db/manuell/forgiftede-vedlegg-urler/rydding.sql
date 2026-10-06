-- RYDDING — strip død signatur fra forgiftede /uploads/-URL-er i dokumentdata
-- =====================================================================
-- 🔴 KJØR IKKE FØR DRY-RUN.sql ER GODKJENT AV KENNETH.
-- 🔴 IKKE en Prisma-migrering: denne fila ligger med vilje UTENFOR
--    packages/db/prisma/migrations/ så `prisma migrate deploy` ALDRI kjører den
--    automatisk. Kenneth kjører den manuelt, per miljø, etter godkjent dry-run.
--
-- «ALDRI slett eksisterende data»: dette er en UPDATE som KUN fjerner den døde
-- query-strengen (?exp=…&sig=…) fra /uploads/-URL-er. Selve stien, filnavn og
-- all annen data er urørt. regexp_replace treffer bare den faktiske delstrengen
-- /uploads/…?…sig=…; «sig=» i fritekst røres ikke.
--
-- Med del A (hmac.ts) på plass er dette RYDDING, ikke redning — dokumentene
-- viser alt bildene sine. Poenget er at lagret verdi skal være den rå stien, så
-- vakten i del B (avvisForgiftetVedleggIData) og gjenopprydding er konsistent.
--
-- Kjør transaksjonen, VERIFISER radtallet mot det godkjente, COMMIT deretter.

BEGIN;

UPDATE checklists
SET data = regexp_replace(data::text, '(/uploads/[^"?]+)\?[^"]*sig=[^"]*', '\1', 'g')::jsonb
WHERE data::text ~ '/uploads/[^"?]+\?[^"]*sig=';
-- Forventet (prod, målt 28.09): 5 rader. Stemmer tallet? Ellers ROLLBACK.

UPDATE tasks
SET data = regexp_replace(data::text, '(/uploads/[^"?]+)\?[^"]*sig=[^"]*', '\1', 'g')::jsonb
WHERE data::text ~ '/uploads/[^"?]+\?[^"]*sig=';
-- Forventet (prod, målt 28.09): 1 rad.

-- Kontroll: skal returnere 0 etter ryddingen (ingen forgiftede URL-er igjen).
SELECT 'checklists_igjen' AS sjekk, count(*) AS antall
FROM checklists WHERE data::text ~ '/uploads/[^"?]+\?[^"]*sig='
UNION ALL
SELECT 'tasks_igjen', count(*)
FROM tasks WHERE data::text ~ '/uploads/[^"?]+\?[^"]*sig=';

-- COMMIT;   -- ← fjern kommentaren når radtall + 0-kontroll er verifisert.
-- ROLLBACK; -- ← bruk denne hvis noe avviker.
