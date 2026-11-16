-- POST 2026-11-15 (13) del B: midlertidig oppmøtested via overføring.
--
-- En Tur til et annet kontor åpner en midlertidig kontorperiode UTEN sluttdato;
-- Retur (eller «Avslutt» i reise-kortet) setter sluttdatoen. Derfor:
--   1. Ny kolonne "kilde" ('admin' | 'overforing'). Nullable (to-stegs-policy),
--      default 'admin'. Backfill: alle eksisterende rader er satt av firmaadmin.
--   2. fast_check slakkes: et midlertidig kontor kan stå åpent.
--   3. Maks ÉN åpen midlertidig kontorperiode pr. ansatt (delindeks, samme
--      mønster som oppmote_perioder_ett_fast_key).
-- Additiv: ingen data slettes, ingen kolonne droppes.

-- 1. kilde — legges til uten default, backfilles, får deretter default.
ALTER TABLE "oppmote_perioder" ADD COLUMN "kilde" TEXT;
UPDATE "oppmote_perioder" SET "kilde" = 'admin' WHERE "kilde" IS NULL;
ALTER TABLE "oppmote_perioder" ALTER COLUMN "kilde" SET DEFAULT 'admin';
ALTER TABLE "oppmote_perioder" ADD CONSTRAINT "oppmote_perioder_kilde_check" CHECK ("kilde" IS NULL OR "kilde" IN ('admin', 'overforing'));

-- 2. Fast finnes kun for kontor; et midlertidig kontor kan nå stå åpent (overføring).
ALTER TABLE "oppmote_perioder" DROP CONSTRAINT "oppmote_perioder_fast_check";
ALTER TABLE "oppmote_perioder" ADD CONSTRAINT "oppmote_perioder_fast_check" CHECK (
  ("fast" AND "type" = 'kontor')
  OR (NOT "fast")
);

-- 3. Maks én ÅPEN midlertidig kontorperiode pr. ansatt.
CREATE UNIQUE INDEX "oppmote_perioder_en_apen_midlertidig_key" ON "oppmote_perioder"("organization_member_id") WHERE NOT "fast" AND "type" = 'kontor' AND "til_dato" IS NULL;
