-- Revert: defaultRettighet og rettighetOverstyring var feil plassert.
-- Rettighet styres av DokumentflytMedlem.kan_redigere (allerede finnes).

ALTER TABLE "project_groups"
DROP COLUMN IF EXISTS "default_rettighet";

ALTER TABLE "project_group_members"
DROP COLUMN IF EXISTS "rettighet_overstyring";
