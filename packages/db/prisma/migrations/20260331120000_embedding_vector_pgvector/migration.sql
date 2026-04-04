-- Aktiver pgvector-utvidelsen
CREATE EXTENSION IF NOT EXISTS vector;

-- Legg til embedding_vector kolonne (1536 dim for OpenAI text-embedding-3-small)
ALTER TABLE "ftd_document_chunks" ADD COLUMN IF NOT EXISTS "embedding_vector" vector(1536);

-- HNSW-indeks for vektor-søk (cosine distance)
CREATE INDEX IF NOT EXISTS "idx_ftd_chunks_embedding_hnsw"
  ON "ftd_document_chunks"
  USING hnsw ("embedding_vector" vector_cosine_ops);

-- Partial indeks for raskere filtrering på pending embedding_state
CREATE INDEX IF NOT EXISTS "idx_ftd_chunks_embedding_pending"
  ON "ftd_document_chunks" ("embedding_state")
  WHERE "embedding_state" = 'pending';

-- AI-søk innstillinger per prosjekt
CREATE TABLE IF NOT EXISTS "ai_sok_innstillinger" (
  "project_id"         TEXT PRIMARY KEY REFERENCES "projects"("id") ON DELETE CASCADE,
  "embedding_provider" TEXT NOT NULL DEFAULT 'openai',
  "embedding_model"    TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  "embedding_api_key"  TEXT,
  "llm_provider"       TEXT,
  "llm_model"          TEXT DEFAULT 'claude-sonnet-4-5',
  "llm_api_key"        TEXT,
  "vekter"             JSONB,
  "created_at"         TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at"         TIMESTAMP NOT NULL DEFAULT NOW()
);
