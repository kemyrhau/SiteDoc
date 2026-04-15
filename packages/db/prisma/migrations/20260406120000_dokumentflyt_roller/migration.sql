-- AlterTable: Legg til roller JSONB-kolonne på dokumentflyter
ALTER TABLE "dokumentflyter" ADD COLUMN "roller" JSONB NOT NULL DEFAULT '[]';

-- Populer roller fra eksisterende DokumentflytMedlem-rader
UPDATE "dokumentflyter" d SET "roller" = sub.roller_json
FROM (
  SELECT
    dm.dokumentflyt_id,
    COALESCE(
      jsonb_agg(
        jsonb_build_object('rolle', dm.rolle, 'label', null)
        ORDER BY CASE dm.rolle
          WHEN 'registrator' THEN 0
          WHEN 'bestiller' THEN 1
          WHEN 'utforer' THEN 2
          WHEN 'godkjenner' THEN 3
          ELSE 4
        END
      ),
      '[]'::jsonb
    ) AS roller_json
  FROM (
    SELECT DISTINCT dokumentflyt_id, rolle
    FROM "dokumentflyt_medlemmer"
  ) dm
  GROUP BY dm.dokumentflyt_id
) sub
WHERE d.id = sub.dokumentflyt_id;
