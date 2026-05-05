-- Steg 1e Fase A — opprett OrganizationModule-tabell + bakfyll fra firma-flagg.
--
-- Bakgrunn: Steg 1c (2026-05-03) gjorde overgangen til to-nivås modul-aktivering
-- (firma-master + ProjectModule per prosjekt). Steg 1e erstatter de hardkodede
-- Organization.har_timer_modul/har_maskin_modul-kolonnene med en generisk
-- OrganizationModule-tabell. Skalerbar til flere firmamoduler (kompetanse,
-- fremdrift, varelager) uten schema-endring per ny modul.
--
-- Fase A er bakoverkompatibel: tabellen opprettes og bakfylles fra eksisterende
-- flagg. Alle eksisterende callsites fortsetter å lese fra har_*_modul-flagg i
-- denne fasen. organisasjon.settFirmamodul gjør dual-write til både flagg og
-- ny tabell i samme $transaction. Migrering av callsites skjer i Fase B, drop
-- av flagg i Fase C.
--
-- Audit-felter (aktivert_ved/aktivert_av_user_id/deaktivert_ved/deaktivert_av_user_id)
-- følger A.3-mønster: aktivert/deaktivert_av_user_id er String? uten Prisma-
-- @relation slik at audit-spor bevares ved User-sletting.

-- Etablert FK-mønster i kjernen: TEXT (Prisma String @default(uuid())) — ikke
-- Postgres native UUID-type. organizations.id, users.id m.fl. er alle TEXT.
CREATE TABLE "organization_modules" (
  "id"                    TEXT         NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "organization_id"       TEXT         NOT NULL,
  "module_slug"           TEXT         NOT NULL,
  "status"                TEXT         NOT NULL DEFAULT 'aktiv',
  "aktivert_ved"          TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "aktivert_av_user_id"   TEXT         NULL,
  "deaktivert_ved"        TIMESTAMP(3) NULL,
  "deaktivert_av_user_id" TEXT         NULL,
  "config"                JSONB        NULL,
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updated_at"            TIMESTAMP(3) NOT NULL,

  CONSTRAINT "organization_modules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_modules_organization_id_module_slug_key"
  ON "organization_modules" ("organization_id", "module_slug");

CREATE INDEX "organization_modules_module_slug_status_idx"
  ON "organization_modules" ("module_slug", "status");

ALTER TABLE "organization_modules"
  ADD CONSTRAINT "organization_modules_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Bakfyll: opprett rader for alle firma med aktive flagg.
-- aktivert_ved settes til organization.created_at som beste tilnærming
-- (eksakt aktiveringstidspunkt finnes ikke i historikken).
INSERT INTO "organization_modules"
  ("id", "organization_id", "module_slug", "status", "aktivert_ved", "updated_at")
SELECT gen_random_uuid()::TEXT, "id", 'timer', 'aktiv', "created_at", NOW()
FROM "organizations"
WHERE "har_timer_modul" = true;

INSERT INTO "organization_modules"
  ("id", "organization_id", "module_slug", "status", "aktivert_ved", "updated_at")
SELECT gen_random_uuid()::TEXT, "id", 'maskin', 'aktiv', "created_at", NOW()
FROM "organizations"
WHERE "har_maskin_modul" = true;
