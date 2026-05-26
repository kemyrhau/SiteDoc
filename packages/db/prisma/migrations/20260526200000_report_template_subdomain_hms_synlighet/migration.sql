-- Legger til subdomain + hms_synlighet på ReportTemplate.
-- Brukes kun når domain='hms' (Zod-validering i API-laget; DB tillater null).
ALTER TABLE "report_templates"
  ADD COLUMN "subdomain"     TEXT,
  ADD COLUMN "hms_synlighet" TEXT;

-- Backfill: eksisterende HMS-maler er per def HMS-avvik (SJA/RUH ble ikke
-- seedet før denne PRen). Sett subdomain='avvik' og default-synlighet='privat'.
UPDATE "report_templates"
   SET "subdomain"     = 'avvik',
       "hms_synlighet" = 'privat'
 WHERE "domain"    = 'hms'
   AND "subdomain" IS NULL;
