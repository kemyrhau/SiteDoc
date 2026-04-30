-- ProjectMember.periodeSlutt + cascade SetNull + 3 loan-tabeller
-- ========================================================
-- Per fase-0-beslutninger.md § E steg 10 + B.7 + C.13.
--
-- Endringer:
-- 1. ProjectMember.userId: Cascade → SetNull (per B.7), nullable
-- 2. ProjectMember.periodeSlutt: nullable (null = aktiv)
-- 3. ProjectGroupMember.periodeSlutt: nullable
-- 4. FaggruppeKobling.periodeSlutt: nullable
-- 5. DokumentflytMedlem.periodeSlutt: nullable
--
-- Begrunnelse for SetNull (per B.7): Bevarer ProjectMember-historikk når
-- User slettes. I praksis skjer det sjelden — vi arkiverer normalt med
-- canLogin = false (per A.10).
--
-- A.9-merknad: "underentreprenor"-rader i ProjectMember.role behandles
-- som legacy. Ingen aktiv migrering — la radene stå, avskaffes fra
-- fremtidige forslag (verdi utledes via erUnderentreprenor()).

-- 1. ProjectMember.userId: Cascade → SetNull
--    Drop eksisterende FK, gjør kolonne nullable, recreate FK med SetNull
DO $$
BEGIN
    ALTER TABLE "project_members"
        DROP CONSTRAINT IF EXISTS "project_members_user_id_fkey";
END $$;

ALTER TABLE "project_members"
    ALTER COLUMN "user_id" DROP NOT NULL;

DO $$
BEGIN
    ALTER TABLE "project_members"
        ADD CONSTRAINT "project_members_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. ProjectMember.periodeSlutt
ALTER TABLE "project_members"
    ADD COLUMN IF NOT EXISTS "periode_slutt" TIMESTAMP(3);

-- 3. ProjectGroupMember.periodeSlutt (per C.13)
ALTER TABLE "project_group_members"
    ADD COLUMN IF NOT EXISTS "periode_slutt" TIMESTAMP(3);

-- 4. FaggruppeKobling.periodeSlutt (per C.13)
ALTER TABLE "dokumentflyt_koblinger"
    ADD COLUMN IF NOT EXISTS "periode_slutt" TIMESTAMP(3);

-- 5. DokumentflytMedlem.periodeSlutt (per C.13)
ALTER TABLE "dokumentflyt_medlemmer"
    ADD COLUMN IF NOT EXISTS "periode_slutt" TIMESTAMP(3);
