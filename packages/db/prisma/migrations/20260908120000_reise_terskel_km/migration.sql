-- Reise-terskel-km (2026-09-08)
-- Firmaet skal kunne sette reise-terskelen i AVSTAND (km), ikke bare TID (min).
-- A.Markussen bruker km-grense; andre firmaer bruker tid. Begge skal finnes.
--
-- To-stegs migrerings-policy (CLAUDE.md, ufravikelig):
--   Steg 1 (denne): legg til NULLABLE kolonner. Ingen DROP. Ingen backfill som
--   hardkoder én verdi på alle rader.
--   reise_terskel_min beholdes urørt — begge terskel-akser lever side om side.
--
-- 🔴 DEFAULT 'minutter' ER ET BEVISST VALG, IKKE en tilfeldighet:
--   Eksisterende firmaer har reise_terskel_min = 30 og ingen enhet satt. Ved å
--   la enheten defaulte til 'minutter' oppfører ALLE eksisterende firmaer seg
--   NØYAKTIG som før — ingen stille endring i lønnsklassifisering. Endres denne
--   defaulten til 'km', endres lønn for alle firmaer uten at noen har bedt om
--   det. Rør den aldri.

-- Matrise: kjøreavstand i METER fra samme OSRM-kall (annotations=duration,distance).
-- Nullable — rader beregnet før denne kolonnen har NULL til neste recompute
-- fyller dem. Uoppnåelig par lagres som -1, symmetrisk med kjoretid_min.
ALTER TABLE "reisetid_matrise" ADD COLUMN "avstand_m" INTEGER;

-- OrganizationSetting: enhet-diskriminator + km-terskel i meter.
-- reise_terskel_enhet: 'minutter' | 'km'. Default 'minutter' (se over).
-- reise_terskel_m: aktiv KUN når enhet = 'km' (7,5 km lagres som 7500). Nullable
-- — minutter-firmaer har den ikke.
ALTER TABLE "organization_settings" ADD COLUMN "reise_terskel_enhet" TEXT NOT NULL DEFAULT 'minutter';
ALTER TABLE "organization_settings" ADD COLUMN "reise_terskel_m" INTEGER;
