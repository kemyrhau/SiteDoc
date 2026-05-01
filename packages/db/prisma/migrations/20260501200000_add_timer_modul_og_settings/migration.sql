-- Timer-modul Fase 3 — Infrastruktur-commit
-- 1) Organization.harTimerModul (midlertidig modul-flagg, samme mønster som harMaskinModul)
-- 2) OrganizationSetting utvides med timer-relaterte felt:
--    dagsnorm, overtidsmatTerskel, tillattSelvAttestering, timerLockEtterDager
-- Erstattes av OrganizationModule + modulProcedure i Fase 0 per A.4

-- AddColumn: Organization.har_timer_modul
ALTER TABLE "organizations"
  ADD COLUMN "har_timer_modul" BOOLEAN NOT NULL DEFAULT false;

-- AddColumn: OrganizationSetting timer-felt
ALTER TABLE "organization_settings"
  ADD COLUMN "dagsnorm" DECIMAL(4,2) NOT NULL DEFAULT 7.5,
  ADD COLUMN "overtidsmat_terskel" DECIMAL(4,2) NOT NULL DEFAULT 9.0,
  ADD COLUMN "tillatt_selv_attestering" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "timer_lock_etter_dager" INTEGER;
