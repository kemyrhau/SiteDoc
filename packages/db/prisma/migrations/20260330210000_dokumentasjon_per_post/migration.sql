-- Koble mapper til kontrakt (valgfritt)
ALTER TABLE "folders" ADD COLUMN "kontrakt_id" TEXT;
CREATE INDEX "folders_kontrakt_id_idx" ON "folders"("kontrakt_id");

-- Side→postnr indeks for dokumentasjon per post
CREATE TABLE "ftd_document_pages" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "page_number" INTEGER NOT NULL,
    "postnr" TEXT NOT NULL,
    CONSTRAINT "ftd_document_pages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ftd_document_pages_document_id_page_number_key" ON "ftd_document_pages"("document_id", "page_number");
CREATE INDEX "ftd_document_pages_postnr_idx" ON "ftd_document_pages"("postnr");

ALTER TABLE "ftd_document_pages" ADD CONSTRAINT "ftd_document_pages_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "ftd_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "folders" ADD CONSTRAINT "folders_kontrakt_id_fkey" FOREIGN KEY ("kontrakt_id") REFERENCES "ftd_kontrakter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
