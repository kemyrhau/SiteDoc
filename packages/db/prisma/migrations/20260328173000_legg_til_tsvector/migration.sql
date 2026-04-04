-- Fulltekstsøk: tsvector-kolonne med GIN-indeks og norsk stemming
-- Denne kolonnen styres utenfor Prisma (rå SQL) fordi Prisma ikke støtter tsvector

ALTER TABLE "ftd_document_chunks" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;

CREATE INDEX IF NOT EXISTS "idx_ftd_chunks_search" ON "ftd_document_chunks" USING GIN("search_vector");

-- Trigger som auto-oppdaterer search_vector ved insert/update av chunk_text
CREATE OR REPLACE FUNCTION ftd_chunk_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('norwegian', COALESCE(NEW.chunk_text, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ftd_chunk_search_trigger ON ftd_document_chunks;
CREATE TRIGGER ftd_chunk_search_trigger
  BEFORE INSERT OR UPDATE OF chunk_text ON ftd_document_chunks
  FOR EACH ROW EXECUTE FUNCTION ftd_chunk_search_vector_update();
