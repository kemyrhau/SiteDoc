-- AlterTable: OrganizationSetting.standardPauseFra (nullable HH:MM)
-- Brukes som default pause-start i RedigerRadModal.togglePause når vinduet
-- ligger innenfor rad-intervallet. Tom verdi = eksisterende midtpunkt-fallback.
-- Bakover-kompatibilitet bevart.
ALTER TABLE "organization_settings" ADD COLUMN "standard_pause_fra" TEXT;
