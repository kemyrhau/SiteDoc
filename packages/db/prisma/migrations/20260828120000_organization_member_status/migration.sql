-- Registreringsmodell fase 1 (2026-08-28): ansettelsesstatus på OrganizationMember.
-- Ren additiv migrering med trygg default — ingen DROP, ingen gjettende backfill.
-- Alle eksisterende rader blir "aktiv". Deaktivering leses ved porten
-- (tilgangskontroll.ts: krevAktivAnsettelse + hentBrukersOrg-filter).
ALTER TABLE "organization_members"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'aktiv',
  ADD COLUMN "deaktivert_ved" TIMESTAMP(3),
  ADD COLUMN "deaktivert_av_user_id" TEXT;
