-- Slice 4b-2: OrganizationSetting.arbeidstidVarselTimer — arbeidstids-varsel-
-- terskel (timer per dagsseddel). Total av alle timer-rader (inkl. reise) >
-- denne → varsel-badge i attestering (IKKE blokkering). Default 13 (AML § 10-6);
-- firma hever til 16 ved tariff via samme felt.
-- Additivt, NOT NULL DEFAULT 13 backfiller eksisterende rader atomisk
-- (to-stegs-policy: trygt, ingen data slettes).
ALTER TABLE "organization_settings"
  ADD COLUMN "arbeidstid_varsel_timer" INTEGER NOT NULL DEFAULT 13;
