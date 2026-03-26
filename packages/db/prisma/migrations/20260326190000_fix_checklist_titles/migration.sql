-- Fjern nummer+prefix fra eksisterende sjekkliste-titler
-- Matcher mønstre som "001BHO Malnavn" eller "002SHA-S-003 Malnavn"
UPDATE checklists
SET title = TRIM(regexp_replace(title, '^\d{3}[A-Za-z\-]+ ', ''))
WHERE title ~ '^\d{3}[A-Za-z\-]+ ';
