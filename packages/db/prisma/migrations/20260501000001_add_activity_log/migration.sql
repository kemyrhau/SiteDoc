-- Activity — sentral audit-tabell (action-events)
-- ========================================================
-- Per fase-0-beslutninger.md § A.3 + § E steg 1 (Fase 0).
--
-- Designvalg:
-- - Ingen FOREIGN KEY på actor_user_id / organization_id / project_id —
--   audit-spor må overleve user-anonymisering (A.12) og prosjekt-/
--   organisasjons-sletting. Ved User-sletting settes
--   actor_navn_snapshot = '[anonymisert]' og anonymized_at = NOW(),
--   actor_user_id beholdes for revisjon (kan ikke knyttes til person uten
--   User-rad).
-- - created_at som TIMESTAMPTZ per B.6 (selektiv migrasjon).
-- - retained_until + anonymized_at støtter differensiert retention
--   (skattelov § 5-12 / bokføringsloven § 13). Cron-job som
--   sletter rader hvor retained_until < NOW() bygges utenfor Fase 0.
-- - payload Json validers mot Zod-schema per (target_type, action) —
--   schemaer ligger i packages/shared/src/audit-schemas/ (utenfor Fase 0).
--
-- Idempotent (CREATE IF NOT EXISTS) — trygt på miljøer hvor tabellen
-- allerede finnes.

CREATE TABLE IF NOT EXISTS "activity_log" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "actor_navn_snapshot" TEXT,
    "organization_id" TEXT,
    "project_id" TEXT,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retained_until" TIMESTAMP(3),
    "anonymized_at" TIMESTAMP(3),
    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "activity_log_organization_id_created_at_idx"
    ON "activity_log"("organization_id", "created_at");

CREATE INDEX IF NOT EXISTS "activity_log_project_id_created_at_idx"
    ON "activity_log"("project_id", "created_at");

CREATE INDEX IF NOT EXISTS "activity_log_actor_user_id_created_at_idx"
    ON "activity_log"("actor_user_id", "created_at");

CREATE INDEX IF NOT EXISTS "activity_log_target_type_target_id_idx"
    ON "activity_log"("target_type", "target_id");

CREATE INDEX IF NOT EXISTS "activity_log_target_type_action_created_at_idx"
    ON "activity_log"("target_type", "action", "created_at");
