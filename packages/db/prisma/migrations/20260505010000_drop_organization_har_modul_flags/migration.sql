-- Steg 1e Fase C — drop Organization.har_timer_modul + har_maskin_modul.
--
-- Bygger på Fase A (OrganizationModule-tabell + bakfyll, 20260505000001) og
-- Fase B (callsites migrert til OrganizationModule, ingen kolonne-endring).
-- OrganizationModule er nå sannhetskilde for firma-master-aktivering.
--
-- Per CLAUDE.md to-stegs migrations-policy:
--   Steg 1 (Fase A): legg til ny tabell + bakfyll (nullable mot eksisterende kolonner)
--   Steg 2 (Fase B): migrer kode (lese-veien)
--   Steg 3 (Fase C, denne): drop gamle kolonner
--
-- Verifisering før drop: grep mot apps/web og apps/api viser at lese-veien
-- ikke lenger refererer til disse kolonnene. Dual-write er fjernet i samme
-- commit som denne migrasjonen.

ALTER TABLE "organizations" DROP COLUMN IF EXISTS "har_timer_modul";
ALTER TABLE "organizations" DROP COLUMN IF EXISTS "har_maskin_modul";
