-- FtdKontrakt: overliggende kontrakt for økonomi
CREATE TABLE IF NOT EXISTS "ftd_kontrakter" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "navn" TEXT NOT NULL,
  "kontrakt_type" TEXT,
  "entreprenor" TEXT,
  "building_id" TEXT,
  "hms_samordningsgruppe" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ftd_kontrakter_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ftd_kontrakter_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
  CONSTRAINT "ftd_kontrakter_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "ftd_kontrakter_project_id_idx" ON "ftd_kontrakter"("project_id");

-- Legg til kontraktId på enterprises og ftd_documents
ALTER TABLE "enterprises" ADD COLUMN IF NOT EXISTS "kontrakt_id" TEXT;
ALTER TABLE "ftd_documents" ADD COLUMN IF NOT EXISTS "kontrakt_id" TEXT;

CREATE INDEX IF NOT EXISTS "ftd_documents_kontrakt_id_idx" ON "ftd_documents"("kontrakt_id");

-- Foreign keys
ALTER TABLE "enterprises" ADD CONSTRAINT "enterprises_kontrakt_id_fkey"
  FOREIGN KEY ("kontrakt_id") REFERENCES "ftd_kontrakter"("id") ON DELETE SET NULL;

ALTER TABLE "ftd_documents" ADD CONSTRAINT "ftd_documents_kontrakt_id_fkey"
  FOREIGN KEY ("kontrakt_id") REFERENCES "ftd_kontrakter"("id") ON DELETE SET NULL;
