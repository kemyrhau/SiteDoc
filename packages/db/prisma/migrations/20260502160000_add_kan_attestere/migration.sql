-- Add kanAttestere kapabilitet på ProjectMember (vedtatt 2026-05-02)
-- Skiller timer-attestering fra prosjekt-admin-rollen. role="admin" beholder
-- implisitt attestering-tilgang (via erProsjektLeder), men gir også eksplisitt
-- opt-in for medlemmer som ikke er admin.

ALTER TABLE "project_members"
  ADD COLUMN "kan_attestere" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: alle eksisterende admin-medlemmer får attesterings-kapabilitet
-- (matcher logikken i erProsjektLeder før denne endringen).
UPDATE "project_members" SET "kan_attestere" = true WHERE "role" = 'admin';
