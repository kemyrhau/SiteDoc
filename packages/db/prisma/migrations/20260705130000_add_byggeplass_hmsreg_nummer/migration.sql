-- Byggeplass.hmsregNummer — HMSREG-lokasjon-ID (ruting-nøkkel for §15-push til
-- HMSREG /api/v2/registration). HMSREG «location» = fysisk checkpoint/byggeplass.
-- Rent additivt: én nullable kolonne, ingen sletting, ingen backfill. Idempotent.
-- Push-fasen (HMSREG-integrasjon) er ubygd — kun ruting-nøkkelen legges til nå.

ALTER TABLE "byggeplasser" ADD COLUMN IF NOT EXISTS "hmsreg_nummer" INTEGER;
