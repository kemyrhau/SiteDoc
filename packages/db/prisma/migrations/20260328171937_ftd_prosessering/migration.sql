-- AlterTable
ALTER TABLE "ftd_documents" ADD COLUMN     "processing_error" TEXT,
ADD COLUMN     "processing_state" TEXT NOT NULL DEFAULT 'pending';

-- Fulltekstsøk: tsvector-kolonne med GIN-indeks og norsk stemming
ALTER TABLE "ftd_document_chunks" ADD COLUMN "search_vector" tsvector;

CREATE INDEX "idx_ftd_chunks_search" ON "ftd_document_chunks" USING GIN("search_vector");

-- Trigger som auto-oppdaterer search_vector ved insert/update
CREATE OR REPLACE FUNCTION ftd_chunk_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('norwegian', COALESCE(NEW.chunk_text, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ftd_chunk_search_trigger
  BEFORE INSERT OR UPDATE OF chunk_text ON ftd_document_chunks
  FOR EACH ROW EXECUTE FUNCTION ftd_chunk_search_vector_update();
