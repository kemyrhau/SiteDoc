-- O-4a — legg til avdeling_id på organization_members.
--
-- Per docs/claude/fase-0-beslutninger.md § OrganizationMember-refaktor (2026-05-12).
-- Steg 1 i to-stegs-migrasjon: feltet legges til på OrganizationMember (nullable).
-- Backfill via packages/db/scripts/backfill-org-member-avdeling.ts kopierer
-- verdier fra User.avdelingId. User.avdelingId beholdes for dual-read; droppes
-- i O-5 sammen med User.organizationId og User.ansattnummer.
--
-- onDelete: SetNull — sletting av Avdeling skal ikke slette medlemskapet
-- (samme semantikk som User.avdelingId i dag).

ALTER TABLE "organization_members"
  ADD COLUMN "avdeling_id" TEXT NULL;

ALTER TABLE "organization_members"
  ADD CONSTRAINT "organization_members_avdeling_id_fkey"
  FOREIGN KEY ("avdeling_id") REFERENCES "avdelinger" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "organization_members_avdeling_id_idx"
  ON "organization_members" ("avdeling_id");
