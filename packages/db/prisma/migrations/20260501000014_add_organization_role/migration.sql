-- OrganizationRole — granulære firma-roller (siste § E-steg)
-- ========================================================
-- Per fase-0-beslutninger.md § A.25 + § E steg 14.
--
-- Egen tabell (Variant B fra P4.3-beslutning) — ikke utvidelse av
-- User.role-enum. Skalerbar uten enum-endringer (nye roller = nye rader).
--
-- Første rolle: "hms_ansvarlig" (per A.27 — automatisk lese-tilgang til
-- HMS-rapporter på tvers av firmaets prosjekter).
--
-- Tildeling: firma-admin (User.role = "company_admin") via nye endepunkter
-- organisasjon.tildelOrgRolle / fjernOrgRolle.
-- Tilgangskontroll: harOrgRolle(userId, role) i tilgangskontroll.ts.
--
-- Idempotent (CREATE TABLE IF NOT EXISTS, DO-blocks for FK-er).

CREATE TABLE IF NOT EXISTS "organization_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,                                       -- "hms_ansvarlig" osv.
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organization_roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "organization_roles_user_id_organization_id_role_key"
    ON "organization_roles"("user_id", "organization_id", "role");

CREATE INDEX IF NOT EXISTS "organization_roles_organization_id_role_idx"
    ON "organization_roles"("organization_id", "role");

DO $$ BEGIN
    ALTER TABLE "organization_roles"
        ADD CONSTRAINT "organization_roles_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "organization_roles"
        ADD CONSTRAINT "organization_roles_organization_id_fkey"
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
