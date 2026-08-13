-- Del 2-prep for kontrollpunkter: arkivering + siste kjente aktivitetsnavn.
-- Rene tillegg (default/nullable), ingen DROP, ingen backfill (prod har 0 punkter).

-- Arkivering: et punkt som forsvinner fra en revidert fremdriftsplan slettes aldri
-- automatisk — brukeren arkiverer manuelt. Arkiverte punkter bevares (sjekklister/
-- utført arbeid intakt) men skjules fra planen.
ALTER TABLE "kontrollplan_punkter"
    ADD COLUMN "arkivert" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "arkivert_dato" TIMESTAMP(3);

-- import_navn: SISTE KJENTE aktivitetsnavn (ikke opprinnelig). Fullfører rad-
-- identiteten fra del 1 slik at revisjons-diffen kan vise deaktiverte punkters navn
-- og fingerprint-matche på WBS + navn. Oppdateres ved hver UID-matchede revisjon.
ALTER TABLE "kontrollplan_punkter"
    ADD COLUMN "import_navn" TEXT;
