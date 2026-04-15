-- Fjern eksisterende duplikater (behold laveste id = første batch)
DELETE FROM ftd_spec_posts a
USING ftd_spec_posts b
WHERE a.document_id = b.document_id
  AND a.postnr = b.postnr
  AND a.id > b.id
  AND a.document_id IS NOT NULL
  AND a.postnr IS NOT NULL;

-- Partial unique index: kun for rader der begge kolonner har verdi
CREATE UNIQUE INDEX "ftd_spec_post_doc_postnr"
ON "ftd_spec_posts" ("document_id", "postnr")
WHERE "document_id" IS NOT NULL AND "postnr" IS NOT NULL;
