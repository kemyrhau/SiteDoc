-- Endre embedding_vector fra 1536 (OpenAI) til 768 (NorBERT) som standard
-- Ingen eksisterende embeddings — trygt å endre dimensjon

-- Dropp gammel indeks
DROP INDEX IF EXISTS "idx_ftd_chunks_embedding_hnsw";

-- Endre kolonne til 768 dim (NorBERT ltgoslo/norbert2)
ALTER TABLE "ftd_document_chunks" DROP COLUMN IF EXISTS "embedding_vector";
ALTER TABLE "ftd_document_chunks" ADD COLUMN "embedding_vector" vector(768);

-- Ny HNSW-indeks for 768 dim
CREATE INDEX "idx_ftd_chunks_embedding_hnsw"
  ON "ftd_document_chunks"
  USING hnsw ("embedding_vector" vector_cosine_ops);

-- Oppdater default embedding-modell i innstillinger
UPDATE ai_sok_innstillinger
SET embedding_model = 'norbert2',
    embedding_provider = 'local'
WHERE embedding_model = 'text-embedding-3-small';
