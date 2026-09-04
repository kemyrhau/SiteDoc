-- Malarkiv AM4 (2026-09-04): additive kolonner for firma-malarkiv + HMS (B3).
-- To-stegs migrasjons-policy: KUN ADD COLUMN, ingen DROP, ingen NOT NULL i steg 1.
-- Trygge defaults — alle eksisterende rader beholder gjeldende atferd:
--   subdomain/hms_synlighet NULL = ikke-HMS-mal (som ReportTemplate)
--   standard_for_nye_prosjekter false = seedes ikke automatisk (dagens atferd)
--   versjon_av_hovedmal 1 = ingen firmamal-avstamning ennå (nøytral baseline)
ALTER TABLE "organization_templates"
  ADD COLUMN "subdomain" TEXT,
  ADD COLUMN "hms_synlighet" TEXT,
  ADD COLUMN "standard_for_nye_prosjekter" BOOLEAN NOT NULL DEFAULT false,
  -- B4: strukturert avstamning til SiteDoc-sentralarkivet (BibliotekMal). Spørrbar
  -- peker, ikke fritekst. Nullable = ikke lånt. FK SetNull = lånet består om
  -- bibliotekmalen slettes (samme semantikk som L5-avstamningen på report_templates).
  ADD COLUMN "laant_fra_bibliotek_mal_id" TEXT;

ALTER TABLE "report_templates"
  ADD COLUMN "versjon_av_hovedmal" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "organization_templates_laant_fra_bibliotek_mal_id_idx"
  ON "organization_templates"("laant_fra_bibliotek_mal_id");

ALTER TABLE "organization_templates"
  ADD CONSTRAINT "organization_templates_laant_fra_bibliotek_mal_id_fkey"
  FOREIGN KEY ("laant_fra_bibliotek_mal_id") REFERENCES "bibliotek_maler"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
