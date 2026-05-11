-- Timer-modul T.5 (vedtatt 2026-05-11) — Tidsrunding i minutter
--
-- Default 15 for nye rader. Eksisterende rader får NULL og kan eksplisitt
-- konfigureres til 15/30/60 eller forbli NULL (= ingen avrunding).
-- Bakoverkompatibel — ingen klient-endring kreves.

ALTER TABLE "organization_settings"
  ADD COLUMN "tidsrunding_minutter" INTEGER DEFAULT 15;
