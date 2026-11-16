-- Kort-id, ordre b steg 1 (prosjektkort-kortid-spec.md § 3, Kenneth 2026-11-16: B1 = A,
-- B2 = CHECK i neste release / ordre e). Additiv: ny nullable kolonne + indeks + backfill.
-- Ingen data slettes eller flyttes, ingen eksisterende kolonne endres, updated_at skrives ikke
-- (ingen sedel skal se «endret» ut for synken).
--
-- Utledet id (§ 3.2) — samme uttrykk som `utledKortId` i packages/shared/src/utils/kortId.ts:
--   md5('kort|' || user_id || '|' || dato || '|' || prosjekt || '|' || coalesce(effektiv_bp,'ingen')
--       || '|' || coalesce(eco,'ingen'))::uuid
-- Effektiv byggeplass (M1): radens egen, ellers sedelens når sedelens byggeplass hører til
-- radens prosjekt. Dato som to_char(…,'YYYY-MM-DD') — uavhengig av DateStyle.
-- Reise-rader får aldri kort (§ 2.2) og står med NULL med vilje.

-- 1) Kolonner
ALTER TABLE "timer"."sheet_timer"         ADD COLUMN "kort_id" TEXT;
ALTER TABLE "timer"."sheet_timer_forslag" ADD COLUMN "kort_id" TEXT;
ALTER TABLE "timer"."sheet_machines"      ADD COLUMN "kort_id" TEXT;
ALTER TABLE "timer"."sheet_tillegg"       ADD COLUMN "kort_id" TEXT;
ALTER TABLE "timer"."sheet_utlegg"        ADD COLUMN "kort_id" TEXT;

-- 2) Backfill, én setning pr. tilfelle med diskriminerende WHERE (§ 3.2). Idempotent:
--    alle filtrerer på kort_id IS NULL.

-- BACKFILL 1: arbeidsrader
UPDATE "timer"."sheet_timer" r
   SET "kort_id" = md5('kort|' || ds.user_id || '|' || to_char(ds.dato, 'YYYY-MM-DD') || '|' || r.project_id
         || '|' || coalesce(coalesce(r.byggeplass_id, CASE WHEN b.project_id = r.project_id THEN ds.byggeplass_id END), 'ingen')
         || '|' || coalesce(r.external_cost_object_id, 'ingen'))::uuid::text
  FROM "timer"."daily_sheets" ds
  LEFT JOIN "public"."byggeplasser" b ON b.id = ds.byggeplass_id
 WHERE r.sheet_id = ds.id AND r.kort_id IS NULL AND r.er_reise = false;

-- BACKFILL 2: koblet maskin → timerradens kort (K6)
UPDATE "timer"."sheet_machines" m
   SET "kort_id" = t.kort_id
  FROM "timer"."sheet_timer" t
 WHERE m.kort_id IS NULL AND m.sheet_timer_id = t.id AND m.sheet_id = t.sheet_id
   AND m.project_id = t.project_id AND t.kort_id IS NOT NULL;

-- BACKFILL 3: øvrig maskin — egen nøkkel
UPDATE "timer"."sheet_machines" r
   SET "kort_id" = md5('kort|' || ds.user_id || '|' || to_char(ds.dato, 'YYYY-MM-DD') || '|' || r.project_id
         || '|' || coalesce(coalesce(r.byggeplass_id, CASE WHEN b.project_id = r.project_id THEN ds.byggeplass_id END), 'ingen')
         || '|' || coalesce(r.external_cost_object_id, 'ingen'))::uuid::text
  FROM "timer"."daily_sheets" ds
  LEFT JOIN "public"."byggeplasser" b ON b.id = ds.byggeplass_id
 WHERE r.sheet_id = ds.id AND r.kort_id IS NULL;

-- BACKFILL 4: tillegg — egen nøkkel
UPDATE "timer"."sheet_tillegg" r
   SET "kort_id" = md5('kort|' || ds.user_id || '|' || to_char(ds.dato, 'YYYY-MM-DD') || '|' || r.project_id
         || '|' || coalesce(coalesce(r.byggeplass_id, CASE WHEN b.project_id = r.project_id THEN ds.byggeplass_id END), 'ingen')
         || '|' || coalesce(r.external_cost_object_id, 'ingen'))::uuid::text
  FROM "timer"."daily_sheets" ds
  LEFT JOIN "public"."byggeplasser" b ON b.id = ds.byggeplass_id
 WHERE r.sheet_id = ds.id AND r.kort_id IS NULL;

-- BACKFILL 5: utlegg — egen nøkkel
UPDATE "timer"."sheet_utlegg" r
   SET "kort_id" = md5('kort|' || ds.user_id || '|' || to_char(ds.dato, 'YYYY-MM-DD') || '|' || r.project_id
         || '|' || coalesce(coalesce(r.byggeplass_id, CASE WHEN b.project_id = r.project_id THEN ds.byggeplass_id END), 'ingen')
         || '|' || coalesce(r.external_cost_object_id, 'ingen'))::uuid::text
  FROM "timer"."daily_sheets" ds
  LEFT JOIN "public"."byggeplasser" b ON b.id = ds.byggeplass_id
 WHERE r.sheet_id = ds.id AND r.kort_id IS NULL;

-- BACKFILL 6: forslagsrader (V19) — egen nøkkel, ikke reise
UPDATE "timer"."sheet_timer_forslag" r
   SET "kort_id" = md5('kort|' || ds.user_id || '|' || to_char(ds.dato, 'YYYY-MM-DD') || '|' || r.project_id
         || '|' || coalesce(coalesce(r.byggeplass_id, CASE WHEN b.project_id = r.project_id THEN ds.byggeplass_id END), 'ingen')
         || '|' || coalesce(r.external_cost_object_id, 'ingen'))::uuid::text
  FROM "timer"."daily_sheets" ds
  LEFT JOIN "public"."byggeplasser" b ON b.id = ds.byggeplass_id
 WHERE r.sheet_id = ds.id AND r.kort_id IS NULL AND r.er_reise = false;

-- 3) Indekser (§ 3.1)
CREATE INDEX "sheet_timer_sheet_id_kort_id_idx"         ON "timer"."sheet_timer"("sheet_id", "kort_id");
CREATE INDEX "sheet_timer_forslag_sheet_id_kort_id_idx" ON "timer"."sheet_timer_forslag"("sheet_id", "kort_id");
CREATE INDEX "sheet_machines_sheet_id_kort_id_idx"      ON "timer"."sheet_machines"("sheet_id", "kort_id");
CREATE INDEX "sheet_tillegg_sheet_id_kort_id_idx"       ON "timer"."sheet_tillegg"("sheet_id", "kort_id");
CREATE INDEX "sheet_utlegg_sheet_id_kort_id_idx"        ON "timer"."sheet_utlegg"("sheet_id", "kort_id");

-- ===========================================================================
-- Fraværskort uten prosjekt (prosjektkort-kortid-spec.md § 11.2, Kenneth 2026-11-16, B6/B8).
-- Additiv: en NOT NULL-sperre løsnes og en kolonne legges til; ingen data flyttes.
-- Ingen backfill trengs: hver eksisterende rad har prosjekt (NOT NULL fram til nå), så
-- uten_prosjekt = false (DEFAULT) er sant for alle. CHECK legges på NÅ (ikke i ordre e):
-- gammel API skriver alltid prosjekt og aldri flagget, så den passerer sperren.
-- Eksisterende fravær-rader med prosjekt (FM3) røres ikke.
-- ===========================================================================
ALTER TABLE "timer"."sheet_timer"         ALTER COLUMN "project_id" DROP NOT NULL;
ALTER TABLE "timer"."sheet_timer"         ADD COLUMN "uten_prosjekt" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "timer"."sheet_timer_forslag" ALTER COLUMN "project_id" DROP NOT NULL;
ALTER TABLE "timer"."sheet_timer_forslag" ADD COLUMN "uten_prosjekt" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "timer"."sheet_timer" ADD CONSTRAINT "sheet_timer_uten_prosjekt_chk" CHECK (
  ("uten_prosjekt" = false AND "project_id" IS NOT NULL)
  OR ("uten_prosjekt" = true AND "project_id" IS NULL AND "byggeplass_id" IS NULL
      AND "external_cost_object_id" IS NULL AND "vehicle_id" IS NULL AND "er_reise" = false)
);
ALTER TABLE "timer"."sheet_timer_forslag" ADD CONSTRAINT "sheet_timer_forslag_uten_prosjekt_chk" CHECK (
  ("uten_prosjekt" = false AND "project_id" IS NOT NULL)
  OR ("uten_prosjekt" = true AND "project_id" IS NULL AND "byggeplass_id" IS NULL
      AND "external_cost_object_id" IS NULL AND "vehicle_id" IS NULL AND "er_reise" = false)
);
