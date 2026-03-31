-- Endre embedding_vector fra 768 (NorBERT) til 384 (multilingual-e5-small)
-- NorBERT (Xenova/norbert2) er gated/utilgjengelig — bruk multilingual-e5-small

DROP INDEX IF EXISTS "idx_ftd_chunks_embedding_hnsw";
ALTER TABLE "ftd_document_chunks" DROP COLUMN IF EXISTS "embedding_vector";
ALTER TABLE "ftd_document_chunks" ADD COLUMN "embedding_vector" vector(384);

CREATE INDEX "idx_ftd_chunks_embedding_hnsw"
  ON "ftd_document_chunks"
  USING hnsw ("embedding_vector" vector_cosine_ops);
