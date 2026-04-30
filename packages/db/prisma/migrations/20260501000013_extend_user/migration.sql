-- User-utvidelse + composite unique (per B.7)
-- ========================================================
-- Per fase-0-beslutninger.md § A.10 + § A.11 + B.7 + § E steg 13.
--
-- Schema-endringer:
-- 1. Nye felter:
--    - can_login (per A.10) — to bruksområder: data-mottaker uten login OG
--      arkivert User-rad ved org-bytte
--    - GDPR-felter (per A.11): fodselsdato, nasjonalitet, hms_kort_nr,
--      hms_kort_utloper, arbeidstillatelse, arbeidstillatelse_utloper
--    - ansattnummer (per § E)
--
-- 2. Drop email @unique → composite @@unique([email, organizationId]) (per B.7)
--    Modell A: én User per (person × firma). Joakim får én User-rad per firma.
--
-- 3. Tilføy @@unique([phone, organizationId]) — forberedende for multi-
--    identifikator-auth-utvidelse (per B.7-utvidelse).
--
-- B.7 Fase 0 minimum: NextAuth signIn-policy via custom getUserByEmail
-- (orderBy createdAt asc — eldste først hvis 2+ aktive User-rader).
-- Implementert i apps/web/src/auth.ts.
--
-- Email forblir NOT NULL i Fase 0 (alle har e-post per kunde-bekreftelse).
-- Ingen passord-felter eller CHECK-constraint i Fase 0.
--
-- Idempotent (ADD COLUMN IF NOT EXISTS).

-- 1. Nye User-kolonner
ALTER TABLE "users"
    ADD COLUMN IF NOT EXISTS "can_login" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "users"
    ADD COLUMN IF NOT EXISTS "fodselsdato" TIMESTAMP(3);

ALTER TABLE "users"
    ADD COLUMN IF NOT EXISTS "nasjonalitet" TEXT;

ALTER TABLE "users"
    ADD COLUMN IF NOT EXISTS "hms_kort_nr" TEXT;

ALTER TABLE "users"
    ADD COLUMN IF NOT EXISTS "hms_kort_utloper" TIMESTAMP(3);

ALTER TABLE "users"
    ADD COLUMN IF NOT EXISTS "arbeidstillatelse" TEXT;

ALTER TABLE "users"
    ADD COLUMN IF NOT EXISTS "arbeidstillatelse_utloper" TIMESTAMP(3);

ALTER TABLE "users"
    ADD COLUMN IF NOT EXISTS "ansattnummer" TEXT;

-- 2. Duplikat-sjekk FØR composite unique opprettes
--    Hvis duplikater finnes, kaster migrasjonen med tydelig melding.
--    Postgres' NULL distinct gjelder også her: NULL i organization_id går
--    likevel.
DO $$
DECLARE
    duplicate_count INTEGER;
    duplicate_phone_count INTEGER;
BEGIN
    -- Sjekk (email, organization_id)-duplikater
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT email, organization_id
        FROM "users"
        GROUP BY email, organization_id
        HAVING COUNT(*) > 1
    ) AS dups;

    IF duplicate_count > 0 THEN
        RAISE EXCEPTION 'Migrasjon avbrutt: % rader har duplikate (email, organization_id). Rydd manuelt før retry. Spørring: SELECT email, organization_id, COUNT(*) FROM users GROUP BY 1,2 HAVING COUNT(*)>1', duplicate_count;
    END IF;

    -- Sjekk (phone, organization_id)-duplikater (kun rader hvor phone er satt)
    SELECT COUNT(*) INTO duplicate_phone_count
    FROM (
        SELECT phone, organization_id
        FROM "users"
        WHERE phone IS NOT NULL
        GROUP BY phone, organization_id
        HAVING COUNT(*) > 1
    ) AS dups;

    IF duplicate_phone_count > 0 THEN
        RAISE EXCEPTION 'Migrasjon avbrutt: % rader har duplikate (phone, organization_id). Rydd manuelt før retry. Spørring: SELECT phone, organization_id, COUNT(*) FROM users WHERE phone IS NOT NULL GROUP BY 1,2 HAVING COUNT(*)>1', duplicate_phone_count;
    END IF;
END $$;

-- 3. Drop eksisterende email @unique
DROP INDEX IF EXISTS "users_email_key";

-- 4. Composite unique (email, organization_id) per B.7
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_organization_id_key"
    ON "users"("email", "organization_id");

-- 5. Composite unique (phone, organization_id) per B.7-utvidelse
CREATE UNIQUE INDEX IF NOT EXISTS "users_phone_organization_id_key"
    ON "users"("phone", "organization_id");
