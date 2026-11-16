-- Kort-id på vareforbruk (prosjektkort-kortid-spec.md § 2.2, § 3). Kjøres ETTER
-- db-timer-migreringen 20261116120000_kortid_fravaer_normtak (deploy-løkka migrerer
-- db → db-timer → db-maskin → db-varelager): backfillen leser timer.sheet_timer.kort_id.
-- Additiv; vare uten sedel (dagsseddel_id IS NULL) står med NULL med vilje.
-- Svak referanse (annet skjema) — ingen FK, som sheet_timer_id.

ALTER TABLE "varelager"."vareforbruk" ADD COLUMN "kort_id" TEXT;

-- BACKFILL 1: koblet vare → timerradens kort (K6)
UPDATE "varelager"."vareforbruk" v
   SET "kort_id" = t.kort_id
  FROM "timer"."sheet_timer" t
 WHERE v.kort_id IS NULL AND v.sheet_timer_id = t.id AND v.dagsseddel_id = t.sheet_id
   AND v.project_id = t.project_id AND t.kort_id IS NOT NULL;

-- BACKFILL 2: øvrig vare med sedel — egen nøkkel (samme uttrykk som utledKortId)
UPDATE "varelager"."vareforbruk" r
   SET "kort_id" = md5('kort|' || ds.user_id || '|' || to_char(ds.dato, 'YYYY-MM-DD') || '|' || r.project_id
         || '|' || coalesce(coalesce(r.byggeplass_id, CASE WHEN b.project_id = r.project_id THEN ds.byggeplass_id END), 'ingen')
         || '|' || coalesce(r.external_cost_object_id, 'ingen'))::uuid::text
  FROM "timer"."daily_sheets" ds
  LEFT JOIN "public"."byggeplasser" b ON b.id = ds.byggeplass_id
 WHERE r.dagsseddel_id = ds.id AND r.kort_id IS NULL;

CREATE INDEX "vareforbruk_dagsseddel_id_kort_id_idx" ON "varelager"."vareforbruk"("dagsseddel_id", "kort_id");
