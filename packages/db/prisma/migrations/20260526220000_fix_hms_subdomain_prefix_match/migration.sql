-- Fiks: PR 1-migrasjonen (20260526200000_report_template_subdomain_hms_synlighet)
-- hardkodet subdomain='avvik' på ALLE eksisterende HMS-maler uten å sjekke prefix.
-- For prosjekter som hadde manuelt opprettede SJA/RUH-maler før PR 1, ble disse
-- feilaktig klassifisert som 'avvik'. Dropdown i HMS-prosjektvisning viste dermed
-- alle tre alternativer med "avvik"-hjelpetekst.
--
-- Korrigerer subdomain basert på prefix-konvensjon (samme som modul-seeding bruker).
-- Endrer IKKE hms_synlighet — bevarer eksisterende tilgangskontroll for evt.
-- dokumenter knyttet til malen.
UPDATE "report_templates"
   SET "subdomain" = 'sja'
 WHERE "domain"    = 'hms'
   AND "prefix"    = 'SJA'
   AND "subdomain" = 'avvik';

UPDATE "report_templates"
   SET "subdomain" = 'ruh'
 WHERE "domain"    = 'hms'
   AND "prefix"    = 'RUH'
   AND "subdomain" = 'avvik';
