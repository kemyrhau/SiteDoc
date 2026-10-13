-- Hotfix 2026-10-13: `FtdDocument.splitSources` (@map "split_sources") ble lagt i schema.prisma
-- 31.03 (c8d60431) uten migrering. Test-DB fikk kolonnen utenom migreringene; prod manglet den,
-- og alle ftdDocument-spørringer feilet («column ftd_documents.split_sources does not exist»).
-- Additiv og idempotent: trygg der kolonnen alt finnes (test/lokal).
ALTER TABLE "ftd_documents" ADD COLUMN IF NOT EXISTS "split_sources" JSONB;
