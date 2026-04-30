-- BibliotekMal-utvidelse — kategori/domene/kobletTilModul/verifisert
-- ========================================================
-- Per fase-0-beslutninger.md § E steg 8 (Fase 0).
--
-- Lukker P-KRITISK-3 fra oppryddings-plan-2026-04-28.md:
-- bibliotek.ts:106-107 hardkoder category="sjekkliste" og domain="kvalitet"
-- ved import. Etter denne migrasjonen leses verdiene fra BibliotekMal-raden.
--
-- Felter:
-- - kategori (default 'sjekkliste'): "oppgave" | "sjekkliste" — matcher ReportTemplate.category
-- - domene (default 'kvalitet'): "bygg" | "hms" | "kvalitet" — matcher dagens hardkoding
-- - koblet_til_modul (nullable): slug til prosjektmodul (f.eks. "okonomi", "psi")
-- - verifisert (default false): konservativt — verifisering er eksplisitt admin-handling
--
-- Postgres bakfyller alle eksisterende rader med default-verdier ved
-- ADD COLUMN ... NOT NULL DEFAULT ... — ingen separat UPDATE-steg trengs.
--
-- Idempotent (ADD COLUMN IF NOT EXISTS).

ALTER TABLE "bibliotek_maler"
    ADD COLUMN IF NOT EXISTS "kategori" TEXT NOT NULL DEFAULT 'sjekkliste';

ALTER TABLE "bibliotek_maler"
    ADD COLUMN IF NOT EXISTS "domene" TEXT NOT NULL DEFAULT 'kvalitet';

ALTER TABLE "bibliotek_maler"
    ADD COLUMN IF NOT EXISTS "koblet_til_modul" TEXT;

ALTER TABLE "bibliotek_maler"
    ADD COLUMN IF NOT EXISTS "verifisert" BOOLEAN NOT NULL DEFAULT false;
