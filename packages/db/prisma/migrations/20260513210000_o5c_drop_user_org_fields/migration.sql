-- O-5c: dropp legacy User-felt + OrganizationRole-tabell
-- Forutsetning: O-5b + O-5b-fix deployet til prod. Ingen kode leser/skriver
-- User.organizationId, User.ansattnummer, User.avdelingId eller OrganizationRole.

-- 1. Fjern composite unique-constraints på User
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_organization_id_key";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_phone_organization_id_key";

-- 2. Legg til global email-unique
ALTER TABLE "users" ADD CONSTRAINT "users_email_key" UNIQUE ("email");

-- 3. Fjern FK + indeks + kolonne User.organizationId
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_organization_id_fkey";
DROP INDEX IF EXISTS "users_organization_id_idx";
ALTER TABLE "users" DROP COLUMN IF EXISTS "organization_id";

-- 4. Fjern kolonne User.ansattnummer
ALTER TABLE "users" DROP COLUMN IF EXISTS "ansattnummer";

-- 5. Fjern FK + indeks + kolonne User.avdelingId
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_avdeling_id_fkey";
DROP INDEX IF EXISTS "users_avdeling_id_idx";
ALTER TABLE "users" DROP COLUMN IF EXISTS "avdeling_id";

-- 6. Dropp OrganizationRole-tabell (0 rader verifisert i prod)
DROP TABLE IF EXISTS "organization_roles";
