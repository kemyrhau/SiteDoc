-- Fiks ø-inkonsistens: slett duplikater først, deretter rename
-- Slett rader med utfører der det allerede finnes utforer med samme nøkkel
DELETE FROM "dokumentflyt_medlemmer" a
USING "dokumentflyt_medlemmer" b
WHERE a.rolle = 'utfører' AND b.rolle = 'utforer'
  AND a.dokumentflyt_id = b.dokumentflyt_id
  AND a.steg = b.steg
  AND (
    (a.enterprise_id IS NOT NULL AND a.enterprise_id = b.enterprise_id) OR
    (a.project_member_id IS NOT NULL AND a.project_member_id = b.project_member_id) OR
    (a.group_id IS NOT NULL AND a.group_id = b.group_id)
  );

-- Samme for oppretter/bestiller
DELETE FROM "dokumentflyt_medlemmer" a
USING "dokumentflyt_medlemmer" b
WHERE a.rolle = 'oppretter' AND b.rolle = 'bestiller'
  AND a.dokumentflyt_id = b.dokumentflyt_id
  AND a.steg = b.steg
  AND (
    (a.enterprise_id IS NOT NULL AND a.enterprise_id = b.enterprise_id) OR
    (a.project_member_id IS NOT NULL AND a.project_member_id = b.project_member_id) OR
    (a.group_id IS NOT NULL AND a.group_id = b.group_id)
  );

-- Nå er det trygt å rename resterende
UPDATE "dokumentflyt_medlemmer" SET "rolle" = 'utforer' WHERE "rolle" = 'utfører';
UPDATE "dokumentflyt_medlemmer" SET "rolle" = 'bestiller' WHERE "rolle" = 'oppretter';
