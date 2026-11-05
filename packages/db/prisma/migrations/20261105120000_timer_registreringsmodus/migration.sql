-- Prosjektkort L1 (2026-11-05): firmaets visningsmodus for timeføring på
-- organization_settings. Additiv med default 'dagskort' — ingen backfill:
-- alle firmaer fører i dag dagskort, og modusen endrer bare visningen.
ALTER TABLE "organization_settings"
  ADD COLUMN "timer_registreringsmodus" TEXT NOT NULL DEFAULT 'dagskort';
