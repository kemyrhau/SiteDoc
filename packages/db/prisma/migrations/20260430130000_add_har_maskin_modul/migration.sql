-- Midlertidig firma-modul-flagg for maskin-modul. Erstatter behov for
-- modulProcedure('maskin')-gating midlertidig — frontend-skjul i sidebar
-- + eksisterende firma-isolering i maskin-rutene gir tilstrekkelig
-- avgrensning. Erstattes av OrganizationModule-tabell i Fase 0 (per A.4
-- i fase-0-beslutninger.md).
--
-- Manuelt opprettet 2026-04-30 — lokal-DB mangler pgvector-extension.
-- Verifiseres ved test-DB-deploy.
--
-- AKTIVERING: Etter deploy må A.Markussen aktiveres manuelt:
--   UPDATE organizations SET har_maskin_modul = true WHERE id = '<a-markussen-id>';
-- Default for alle eksisterende rader er false.

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN "har_maskin_modul" BOOLEAN NOT NULL DEFAULT false;
