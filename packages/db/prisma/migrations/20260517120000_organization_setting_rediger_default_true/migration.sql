-- T7-5b-1 (2026-05-17): Endre DEFAULT på tillatt_rediger_ved_attestering
-- fra false til true. Lederverktøy bør være aktivt som standard for
-- nye firma. Eksisterende rader er ikke berørt — bare DEFAULT-clause
-- endres slik at nye INSERT uten eksplisitt verdi får true.

ALTER TABLE "organization_settings"
  ALTER COLUMN "tillatt_rediger_ved_attestering" SET DEFAULT true;
