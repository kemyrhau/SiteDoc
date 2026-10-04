-- V19 (overlapp PC ↔ mobil — ordre V19-A, Leveranse A) — serverens datalag.
--
-- Hjemmel: Kenneth 2026-10-04 «b» — mobilens overlappende rader lagres som FORSLAG
-- på serveren (egen tabell), arbeideren velger selv. Spec timer-overlapp-pc-mobil-spec.md
-- § 3 A-0/A-3.
--
-- ADDITIV (to-stegs-policy): kun CREATE TABLE + ADD COLUMN. Ingen DROP, ingen
-- NOT NULL på eksisterende kolonner, ingen backfill (tabellen er TRANSAKSJONELL,
-- ikke identitet — Kenneth-vedtak «stille tomhet»: en forslagsrad fødes ved en
-- overlapp-synk, aldri retroaktivt). Idempotent: IF NOT EXISTS på begge → trygg å
-- kjøre to ganger.
--
-- 🔴 KJØRES AV KENNETH mot sitedoc_test først, deretter prod. Additiv + tom → ingen
--    backfill-tall å lese. Telle-SQL for verifisering i leveransen.
--
-- Stille-tomhet-regelen (CLAUDE.md):
--   (a) backfill — IKKE aktuelt. Tabellen bærer et forslag som OPPSTÅR ved en
--                  overlapp-synk; eksisterende sedler har per definisjon ingen.
--                  konflikt_ventende_siden fødes NULL (ingen uavklart overlapp ennå).
--   (b) garanti  — FK ON DELETE CASCADE (slettet sedel river forslaget) + PK på id
--                  (= mobilens rad-id, idempotent erstatning pr. sedel).
--   (c) test     — @sitedoc/api integrasjonstest kjører denne migreringen mot ekte
--                  Postgres + verifiserer at forslaget ALDRI lekker til en lønnsleser
--                  (overlapp-forslag-lekkasje.integration.test.ts, spec § 6 test 1d).

-- ===========================================================================
-- 1. Forslagstabellen — speil av sheet_timers payload-felt + lag 2-sporet.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS "timer"."sheet_timer_forslag" (
  "id"                       TEXT          NOT NULL,
  "sheet_id"                 TEXT          NOT NULL,
  "project_id"               TEXT          NOT NULL,
  "byggeplass_id"            TEXT,
  "lonnsart_id"              TEXT          NOT NULL,
  "aktivitet_id"             TEXT          NOT NULL,
  "fra_tid"                  TEXT,
  "til_tid"                  TEXT,
  "timer"                    DECIMAL(6,2)  NOT NULL,
  "pause_min"                INTEGER       NOT NULL DEFAULT 0,
  "beskrivelse"              TEXT,
  "external_cost_object_id"  TEXT,
  "vehicle_id"               TEXT,
  "er_reise"                 BOOLEAN       NOT NULL DEFAULT false,
  "reise_retning"            TEXT,
  "reise_oppmotested_id"     TEXT,
  "reise_kjoretid_min"       INTEGER,
  "reise_avstand_m"          INTEGER,
  "reise_kilde"              TEXT,
  "reise_regel"              JSONB,
  "tid_kilde"                TEXT,
  "kilde"                    TEXT          NOT NULL DEFAULT 'mobil',
  "mottatt_at"               TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT "sheet_timer_forslag_pkey" PRIMARY KEY ("id")
);

-- FK → daily_sheets. ON DELETE CASCADE: slettet sedel river forslaget (garanti b).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'timer'
      AND constraint_name = 'sheet_timer_forslag_sheet_id_fkey'
  ) THEN
    ALTER TABLE "timer"."sheet_timer_forslag"
      ADD CONSTRAINT "sheet_timer_forslag_sheet_id_fkey"
      FOREIGN KEY ("sheet_id") REFERENCES "timer"."daily_sheets"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "sheet_timer_forslag_sheet_id_idx"
  ON "timer"."sheet_timer_forslag"("sheet_id");

-- ===========================================================================
-- 2. daily_sheets.konflikt_ventende_siden — satt ved overlapp, nulles ved valg.
--    Invariant: konflikt_ventende_siden != null ⇔ forslag finnes (A-3).
-- ===========================================================================
ALTER TABLE "timer"."daily_sheets"
  ADD COLUMN IF NOT EXISTS "konflikt_ventende_siden" TIMESTAMPTZ;
