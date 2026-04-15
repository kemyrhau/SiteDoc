-- Gruppe-rettighet: defaultRettighet per gruppe, rettighetOverstyring per medlem
-- Alle eksisterende grupper får "redigerer" (default) — ingen atferdsendring

ALTER TABLE "project_groups"
ADD COLUMN "default_rettighet" TEXT NOT NULL DEFAULT 'redigerer';

ALTER TABLE "project_group_members"
ADD COLUMN "rettighet_overstyring" TEXT;
