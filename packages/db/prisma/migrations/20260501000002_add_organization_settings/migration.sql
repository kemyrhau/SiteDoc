-- OrganizationSetting — firma-instillinger (1:1 med Organization)
-- ========================================================
-- Per fase-0-beslutninger.md § A.14 + arkitektur-syntese.md § 1.3 + § 2.4.
-- Fase 0 § E steg 2.
--
-- Felter:
-- - timezone (A.14): default 'Europe/Oslo' for forretningsregler
-- - timer/vareforbruk/maskinbruk-tilgangs-defaults (§ 1.3 + § 2.4)
--
-- Bakfyll: Eksisterende organisasjoner får default-rad i samme migrasjon
-- (i dag 3 prod-rader: A.Markussen, HRP, Kenneths testmiljø). Unngår
-- NULL-håndtering i applikasjonskoden.
--
-- Idempotent (CREATE IF NOT EXISTS) — trygt på miljøer hvor tabellen
-- evt. allerede finnes.

CREATE TABLE IF NOT EXISTS "organization_settings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Oslo',
    "timer_tilgang_default" TEXT NOT NULL DEFAULT 'alle-ansatte',
    "vareforbruk_tilgang_default" TEXT NOT NULL DEFAULT 'alle-ansatte',
    "maskinbruk_tilgang_default" TEXT NOT NULL DEFAULT 'sertifiserte',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organization_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "organization_settings_organization_id_key"
    ON "organization_settings"("organization_id");

-- FK idempotent via DO-block
DO $$ BEGIN
    ALTER TABLE "organization_settings"
    ADD CONSTRAINT "organization_settings_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Bakfyll default-rader for alle eksisterende organisasjoner som mangler.
-- Idempotent via NOT EXISTS — trygt å re-kjøre.
INSERT INTO "organization_settings" ("id", "organization_id", "created_at", "updated_at")
SELECT gen_random_uuid()::text, o.id, NOW(), NOW()
FROM "organizations" o
WHERE NOT EXISTS (
    SELECT 1 FROM "organization_settings" s WHERE s.organization_id = o.id
);
