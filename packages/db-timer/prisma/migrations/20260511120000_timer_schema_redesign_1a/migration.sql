-- Timer-modul schema-redesign PR 1A (T.1–T.6, vedtatt 2026-05-11)
--
-- Additive: legger til kolonner på SheetTimer/SheetMachine/SheetTillegg.
-- Backfill: kopierer projectId + byggeplassId fra DailySheet til hver rad.
-- DailySheet.projectId beholdes urørt — fjernes i PR 1B.
--
-- Se docs/claude/fase-0-beslutninger.md § T for arkitektur-begrunnelse.

-- ============================================================================
-- Steg 1 — ADD COLUMN (alle nullable per to-stegs migration-policy)
-- ============================================================================

-- T.2 + T.4 + T.3 — SheetMachine
ALTER TABLE "timer"."sheet_machines"
  ADD COLUMN "attestert_av_user_id" TEXT,
  ADD COLUMN "attestert_status" TEXT DEFAULT 'pending',
  ADD COLUMN "attestert_ved" TIMESTAMPTZ,
  ADD COLUMN "byggeplass_id" TEXT,
  ADD COLUMN "fra_tid" TEXT,
  ADD COLUMN "project_id" TEXT,
  ADD COLUMN "til_tid" TEXT;

-- T.2 + T.3 — SheetTillegg (ingen fraTid/tilTid)
ALTER TABLE "timer"."sheet_tillegg"
  ADD COLUMN "attestert_av_user_id" TEXT,
  ADD COLUMN "attestert_status" TEXT DEFAULT 'pending',
  ADD COLUMN "attestert_ved" TIMESTAMPTZ,
  ADD COLUMN "project_id" TEXT;

-- T.2 + T.4 + T.3 — SheetTimer
ALTER TABLE "timer"."sheet_timer"
  ADD COLUMN "attestert_av_user_id" TEXT,
  ADD COLUMN "attestert_status" TEXT DEFAULT 'pending',
  ADD COLUMN "attestert_ved" TIMESTAMPTZ,
  ADD COLUMN "byggeplass_id" TEXT,
  ADD COLUMN "fra_tid" TEXT,
  ADD COLUMN "project_id" TEXT,
  ADD COLUMN "til_tid" TEXT;

-- ============================================================================
-- Steg 2 — Indekser
-- ============================================================================

CREATE INDEX "sheet_machines_project_id_idx"      ON "timer"."sheet_machines"("project_id");
CREATE INDEX "sheet_machines_byggeplass_id_idx"   ON "timer"."sheet_machines"("byggeplass_id");
CREATE INDEX "sheet_machines_attestert_status_idx" ON "timer"."sheet_machines"("attestert_status");

CREATE INDEX "sheet_tillegg_project_id_idx"       ON "timer"."sheet_tillegg"("project_id");
CREATE INDEX "sheet_tillegg_attestert_status_idx" ON "timer"."sheet_tillegg"("attestert_status");

CREATE INDEX "sheet_timer_project_id_idx"      ON "timer"."sheet_timer"("project_id");
CREATE INDEX "sheet_timer_byggeplass_id_idx"   ON "timer"."sheet_timer"("byggeplass_id");
CREATE INDEX "sheet_timer_attestert_status_idx" ON "timer"."sheet_timer"("attestert_status");

-- ============================================================================
-- Steg 3 — Backfill projectId + byggeplassId fra DailySheet
-- Sikrer at alle eksisterende rader har korrekt prosjekt-/byggeplass-referanse
-- før PR 1B setter project_id NOT NULL.
-- Idempotent via IS NULL-guard.
-- ============================================================================

UPDATE "timer"."sheet_timer" st
SET "project_id" = ds."project_id",
    "byggeplass_id" = ds."byggeplass_id"
FROM "timer"."daily_sheets" ds
WHERE st."sheet_id" = ds."id"
  AND st."project_id" IS NULL;

UPDATE "timer"."sheet_machines" sm
SET "project_id" = ds."project_id",
    "byggeplass_id" = ds."byggeplass_id"
FROM "timer"."daily_sheets" ds
WHERE sm."sheet_id" = ds."id"
  AND sm."project_id" IS NULL;

UPDATE "timer"."sheet_tillegg" stl
SET "project_id" = ds."project_id"
FROM "timer"."daily_sheets" ds
WHERE stl."sheet_id" = ds."id"
  AND stl."project_id" IS NULL;

-- ============================================================================
-- Steg 4 — RenameIndex (kosmetisk: Prisma-standardnavn)
-- ============================================================================

ALTER INDEX "timer"."uq_dailysheet_user_project_dato" RENAME TO "daily_sheets_user_id_project_id_dato_key";
