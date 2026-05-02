-- ExternalCostObject.proAdmType (C9 2026-05-02)
-- ==============================================
-- Fri tekst — utvides dynamisk når nye ProAdm-typer dukker opp.
-- Eksempler i bruk: "tilleggsarbeid", "varsel", "endring", "regningsarbeid".
-- Kan kobles til Godkjenning-flytmal i fremtidig runde (utsatt fra C9).

ALTER TABLE "external_cost_objects"
  ADD COLUMN "proadm_type" TEXT;
