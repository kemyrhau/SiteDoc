-- B Kloss 2b (2026-07-24) — firma-innstilling «auto-prosjektadmin».
-- Løser hierarki-invarianten (firma-admin ≥ prosjektadmin i eget firma) via
-- medlemskap, ikke flyt-nivå. Når 'alle_firma_admins': ved oppretting av NYE
-- prosjekter auto-legges firmaets firma-admin(er) som ProjectMember.role=admin.
--
-- Additiv + idempotent: kun ADD COLUMN IF NOT EXISTS, ingen backfill, bevarer
-- eksisterende rader (default 'av' = dagens oppførsel).
ALTER TABLE "organization_settings"
  ADD COLUMN IF NOT EXISTS "auto_prosjekt_admin" TEXT NOT NULL DEFAULT 'av';
