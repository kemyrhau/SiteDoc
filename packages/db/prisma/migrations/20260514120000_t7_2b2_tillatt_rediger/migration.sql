-- T7-2b2 (2026-05-14): Firma-admin rediger-modus ved attestering
-- Tillater firma-admin å redigere sedel-rader direkte uten å returnere
-- sedelen til arbeider. Default false (mest restriktivt). Settings-UI i T7-2b3.

ALTER TABLE "organization_settings"
  ADD COLUMN "tillatt_rediger_ved_attestering" BOOLEAN NOT NULL DEFAULT false;
