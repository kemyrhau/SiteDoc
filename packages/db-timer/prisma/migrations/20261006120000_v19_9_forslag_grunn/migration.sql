-- V19.9 (versjonssjekk pr. rad — ordre V19.9-A, Leveranse A') — serverens datalag.
--
-- Hjemmel: Kenneth 2026-10-05, ordrett «dersom systemet ikke finner ut av dette uten en
-- perfekt måte å opprette ting på → da mangler systemet noe». Spec
-- timer-overlapp-pc-mobil-spec.md § 9 (V19.9), GATET 2026-10-06. En versjonssjekk pr.
-- rad oppdager avvik PC ↔ telefon uansett hvordan dagen ble opprettet.
--
-- ADDITIV (to-stegs-policy): kun ADD COLUMN med NOT NULL DEFAULT. Ingen DROP, ingen
-- backfill-UPDATE nødvendig — DEFAULT 'overlapp' fyller alle eksisterende forslagsrader
-- korrekt (V19.9.6: hvert forslag som finnes i dag ER et overlapp-forslag fra V19-A).
-- Idempotent: IF NOT EXISTS → trygg å kjøre to ganger.
--
-- 🔴 KJØRES AV KENNETH mot sitedoc_test først, deretter prod. Telle-SQL i leveransen.
--
-- Stille-tomhet-regelen (CLAUDE.md):
--   (a) backfill — DEFAULT 'overlapp' ER backfillen: ingen rad fødes tom, og alle
--                  eksisterende forslag er per definisjon overlapp-forslag (V19-A).
--   (b) garanti  — CHECK-constraint låser verdien til de fire gyldige grunnene, så
--                  ingen leser kan møte en ukjent grunn.
--   (c) test     — @sitedoc/api enhetstest (klassifiserSyncRader, R1–R12/S1–S4) +
--                  integrasjonstest (grunn skrives/leses) feiler hvis grunn mangler.

ALTER TABLE "timer"."sheet_timer_forslag"
  ADD COLUMN IF NOT EXISTS "grunn" TEXT NOT NULL DEFAULT 'overlapp';

-- DB-garanti (b): kun de fire gyldige V19.9-grunnene. Navngitt så den er droppbar.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sheet_timer_forslag_grunn_check'
  ) THEN
    ALTER TABLE "timer"."sheet_timer_forslag"
      ADD CONSTRAINT "sheet_timer_forslag_grunn_check"
      CHECK ("grunn" IN ('overlapp', 'endret_begge', 'slettet_pc', 'slettet_telefon'));
  END IF;
END $$;
