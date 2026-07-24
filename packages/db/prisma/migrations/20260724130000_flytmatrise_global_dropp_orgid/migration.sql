-- Flyt-rettighetsmatrise — global konfig (Kloss 2d, config-design rev.7 § 0/§ 1).
-- Kenneth-vedtak 2026-07-24: matrisen er ÉN global sitedoc-konfig, ikke per-firma.
-- Dropper `org_id` fra begge config-tabellene; ny unik `(rolle, fra_status, til_status)`.
--
-- 🔴 DATA-AVVIK (flagget for gaten): TRUNCATE begge tabellene før ALTER. Avviker fra
--    to-stegs-migrasjonspolicyen + «aldri slett data». Begrunnet: tabellene er dager gamle
--    (Kloss 1, 2026-07-23), ALDRI på prod, og holder kun regenererbar config (sitedoc-admin
--    re-konfigurerer). Ny unik-nøkkel ville ellers kollidere om to org-er overstyrte samme
--    celle. Ingen bruker-/medlemskaps-/prosjektdata berøres.
--
-- Idempotent ved konstruksjon (DO $$-guards, IF EXISTS) — trygg å kjøre flere ganger.

-- 1) Tøm config-tabellene (kastbar per-org test-config; hindrer unik-kollisjon).
TRUNCATE TABLE "flyt_rettighet_overrides";
TRUNCATE TABLE "flyt_rettighet_logg";

-- 2) Dropp FK-er mot organizations (guardet — Postgres mangler DROP CONSTRAINT IF EXISTS på eldre).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'flyt_rettighet_overrides_org_id_fkey') THEN
        ALTER TABLE "flyt_rettighet_overrides" DROP CONSTRAINT "flyt_rettighet_overrides_org_id_fkey";
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'flyt_rettighet_logg_org_id_fkey') THEN
        ALTER TABLE "flyt_rettighet_logg" DROP CONSTRAINT "flyt_rettighet_logg_org_id_fkey";
    END IF;
END $$;

-- 3) Dropp gamle indekser (org-nøklet unik + org_id-indekser).
DROP INDEX IF EXISTS "flyt_rettighet_overrides_org_id_rolle_fra_status_til_status_key";
DROP INDEX IF EXISTS "flyt_rettighet_overrides_org_id_idx";
DROP INDEX IF EXISTS "flyt_rettighet_logg_org_id_idx";

-- 4) Dropp org_id-kolonnen fra begge tabellene.
ALTER TABLE "flyt_rettighet_overrides" DROP COLUMN IF EXISTS "org_id";
ALTER TABLE "flyt_rettighet_logg" DROP COLUMN IF EXISTS "org_id";

-- 5) Ny global unik-nøkkel på overrides.
CREATE UNIQUE INDEX IF NOT EXISTS "flyt_rettighet_overrides_rolle_fra_status_til_status_key" ON "flyt_rettighet_overrides"("rolle", "fra_status", "til_status");
