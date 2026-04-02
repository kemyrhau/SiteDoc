-- Kildespråk for dokumenter og mapper
ALTER TABLE ftd_documents ADD COLUMN IF NOT EXISTS source_language TEXT NOT NULL DEFAULT 'nb';
ALTER TABLE folders ADD COLUMN IF NOT EXISTS source_language TEXT NOT NULL DEFAULT 'nb';
