-- O-1 — Opprett OrganizationMember-tabell.
--
-- Per docs/claude/fase-0-beslutninger.md § OrganizationMember-refaktor (2026-05-12).
-- Skiller system-identitet (User) fra HR-relasjon (OrganizationMember).
--
-- O-1 er additiv: tabellen opprettes og bakfylles fra User.organizationId via
-- packages/db/scripts/backfill-organization-members.ts. Eksisterende
-- User.organizationId + Organization.users beholdes for dual-read i O-2.
--
-- ansatt_rolle-startverdier: 'ansatt' | 'bas' | 'prosjektleder' | 'daglig_leder'
-- firma_roller-startverdier: 'firma_admin' | 'hms_ansvarlig' | 'hr_ansvarlig'
-- Begge er TEXT/TEXT[] (ikke DB-enum) slik at verdier kan utvides uten
-- migrasjon.
--
-- Cascade på user_id og organization_id: medlemskap er meningsløst uten begge
-- ender. Skiller seg fra User.organization_id som er SetNull (User-raden
-- overlever org-sletting per A.10).

-- Etablert FK-mønster i kjernen: TEXT (Prisma String @default(uuid())) — ikke
-- Postgres native UUID-type. users.id og organizations.id er begge TEXT.
CREATE TABLE "organization_members" (
  "id"              TEXT         NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "user_id"         TEXT         NOT NULL,
  "organization_id" TEXT         NOT NULL,
  "ansatt_rolle"    TEXT         NOT NULL DEFAULT 'ansatt',
  "firma_roller"    TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
  "ansattnummer"    TEXT         NULL,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updated_at"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_members_user_id_organization_id_key"
  ON "organization_members" ("user_id", "organization_id");

CREATE INDEX "organization_members_organization_id_idx"
  ON "organization_members" ("organization_id");

CREATE INDEX "organization_members_user_id_idx"
  ON "organization_members" ("user_id");

ALTER TABLE "organization_members"
  ADD CONSTRAINT "organization_members_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "organization_members"
  ADD CONSTRAINT "organization_members_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
