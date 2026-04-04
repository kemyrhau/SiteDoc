-- Bytt til NorBERT (768 dim) via Python — nullstill e5-small (384 dim) embeddings

DROP INDEX IF EXISTS "idx_ftd_chunks_embedding_hnsw";
ALTER TABLE "ftd_document_chunks" DROP COLUMN IF EXISTS "embedding_vector";
ALTER TABLE "ftd_document_chunks" ADD COLUMN "embedding_vector" vector(768);

CREATE INDEX "idx_ftd_chunks_embedding_hnsw"
  ON "ftd_document_chunks"
  USING hnsw ("embedding_vector" vector_cosine_ops);

-- Nullstill alle embeddings — må re-genereres med NorBERT
UPDATE "ftd_document_chunks" SET embedding_state = 'pending' WHERE embedding_state = 'done';
