-- Translation memory cache
CREATE TABLE IF NOT EXISTS translation_cache (
  id TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL,
  source_lang TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  source_text TEXT NOT NULL,
  target_text TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_translation_cache_unique ON translation_cache(content_hash, source_lang, target_lang);
