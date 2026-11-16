-- F1 (prosjektkort-kortid-spec.md § 11.2, Kenneth 2026-11-16): firmavalg for hvem som attesterer
-- fravær uten prosjekt. Additiv, ingen backfill: false = bare lønnsansvarlig (firma-admin), som er
-- standarden Kenneth vedtok og er sant for hvert firma fra første dag.
ALTER TABLE "organization_settings" ADD COLUMN "fravaer_attesteres_av_prosjektleder" BOOLEAN NOT NULL DEFAULT false;
