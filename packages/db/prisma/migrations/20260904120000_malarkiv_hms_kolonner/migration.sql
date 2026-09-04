-- Malarkiv AM4 (2026-09-04): additive kolonner for firma-malarkiv + HMS (B3).
-- To-stegs migrasjons-policy: KUN ADD COLUMN, ingen DROP, ingen NOT NULL i steg 1.
-- Trygge defaults — alle eksisterende rader beholder gjeldende atferd:
--   subdomain/hms_synlighet NULL = ikke-HMS-mal (som ReportTemplate)
--   standard_for_nye_prosjekter false = seedes ikke automatisk (dagens atferd)
--   versjon_av_hovedmal 1 = ingen firmamal-avstamning ennå (nøytral baseline)
ALTER TABLE "organization_templates"
  ADD COLUMN "subdomain" TEXT,
  ADD COLUMN "hms_synlighet" TEXT,
  ADD COLUMN "standard_for_nye_prosjekter" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "report_templates"
  ADD COLUMN "versjon_av_hovedmal" INTEGER NOT NULL DEFAULT 1;
