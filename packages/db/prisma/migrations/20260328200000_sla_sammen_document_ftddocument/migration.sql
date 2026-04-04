-- Slå sammen Document → FtdDocument
-- Utvid FtdDocument med manglende felter fra Document

ALTER TABLE "ftd_documents" ADD COLUMN IF NOT EXISTS "file_size" INTEGER;
ALTER TABLE "ftd_documents" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ftd_documents" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Migrer eksisterende Document-rader til FtdDocument
INSERT INTO "ftd_documents" ("id", "project_id", "folder_id", "filename", "file_url", "filetype", "file_size", "version", "uploaded_at", "updated_at", "processing_state")
SELECT d."id", f."project_id", d."folder_id", d."name", d."file_url", d."file_type", d."file_size", d."version", d."created_at", d."updated_at", 'pending'
FROM "documents" d
JOIN "folders" f ON f."id" = d."folder_id"
ON CONFLICT ("project_id", "filename") DO NOTHING;

-- Dropp Document-tabellen
DROP TABLE IF EXISTS "documents";
