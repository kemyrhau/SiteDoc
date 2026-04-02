-- Legg til språkstøtte på mapper
ALTER TABLE folders ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT ARRAY['nb']::TEXT[];

-- Blokkbasert dokumentinnhold for flerspråklig visning
CREATE TABLE IF NOT EXISTS ftd_document_blocks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES ftd_documents(id) ON DELETE CASCADE,
  sort_order INT NOT NULL,
  page_number INT NOT NULL,
  block_type TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'nb',
  content TEXT NOT NULL,
  source_block_id TEXT REFERENCES ftd_document_blocks(id) ON DELETE CASCADE,
  heading_level INT,
  image_url TEXT,
  embedding_state TEXT NOT NULL DEFAULT 'pending',
  embedding_vector vector(768),
  embedding_model TEXT
);

CREATE INDEX IF NOT EXISTS idx_ftd_doc_blocks_doc_lang_order ON ftd_document_blocks(document_id, language, sort_order);
CREATE INDEX IF NOT EXISTS idx_ftd_doc_blocks_embedding ON ftd_document_blocks(embedding_state);
CREATE INDEX IF NOT EXISTS idx_ftd_doc_blocks_source ON ftd_document_blocks(source_block_id);

-- Oversettelsesoppdrag
CREATE TABLE IF NOT EXISTS ftd_translation_jobs (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES ftd_documents(id) ON DELETE CASCADE,
  target_lang TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  blocks_total INT NOT NULL DEFAULT 0,
  blocks_done INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ftd_translation_jobs_unique ON ftd_translation_jobs(document_id, target_lang);
