-- Registreringsmodell fase 2 (2026-08-30): prosjekttilgang per ansatt + firmadefault.
-- Ren additiv migrering, ingen DROP, ingen backfill (to-stegs-policyen: legg til,
-- aldri slett i samme runde).
--
-- prosjekt_tilgang er NULL = arv organizations firmadefault (prosjekt_tilgang_default),
--   IKKE «ingen tilgang». Eksisterende rader beholder NULL og arver dermed defaulten.
-- prosjekt_tilgang_default defaulter 'manuell' (Kenneth-vedtak 2026-08-28).
--
-- MERK: modulNokler er TATT UT av fase 2 (Kenneth 2026-08-30) — modulmodellen er ikke
-- avklart (fabel-utredning modulmodell-utredning-2026-08-30.md). Ingen modul-kolonne her.
ALTER TABLE "organization_members"
  ADD COLUMN "prosjekt_tilgang" TEXT;

ALTER TABLE "organization_settings"
  ADD COLUMN "prosjekt_tilgang_default" TEXT NOT NULL DEFAULT 'manuell';
