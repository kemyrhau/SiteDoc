-- Session-impersonering (sitedoc_admin "view as user"). Når impersonatedUserId
-- er satt og impersonationExpiresAt > now, opptrer admin som en annen bruker.
-- originalUserId peker tilbake til admin for audit-logger.
ALTER TABLE "sessions"
  ADD COLUMN "impersonated_user_id" TEXT,
  ADD COLUMN "original_user_id" TEXT,
  ADD COLUMN "impersonation_expires_at" TIMESTAMP(3);

CREATE INDEX "sessions_impersonated_user_id_idx" ON "sessions"("impersonated_user_id");
