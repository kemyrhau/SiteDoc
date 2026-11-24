-- w12, steg 1 (web-timeforing-plan.md § 4.11 del E; Kenneth 2026-11-20: B32 B, B34 B):
-- kort-id på reiserader, så reisen ligger i jobbens kort og attesteres med jobben.
--
-- Bare data. Ingen ny kolonne (kort_id finnes fra 20261116120000), ingen CHECK (steg 2, neste
-- utgivelse: `CHECK (kort_id IS NOT NULL)` etter én ny kjøring av denne utfyllingen), ingen andre
-- felt endres. updated_at skrives ikke (ingen sedel skal se «endret» ut for synken).
-- Diskriminerende WHERE i begge setningene: er_reise = true AND kort_id IS NULL. Rader som har
-- kort-id, røres ikke; kjørt to ganger gir samme resultat. Attesterte og erstattede reiserader
-- får også kort-id (planen del E). Forslagstabellen (sheet_timer_forslag) røres ikke (del B).
--
-- Regelen er den samme som `velgReiseKort` i packages/shared/src/utils/reiseKort.ts, skrevet som
-- ÉN sortering: underprosjekt-treff, byggeplass-treff (reisens EGEN byggeplass mot jobbens
-- EFFEKTIVE; reise uten byggeplass treffer aldri, så steget hoppes over), så plass i kortenes
-- visningsrekkefølge — stigende for første jobb (utreise), synkende for siste (retur). Uten
-- retning: før første arbeid i toppgruppen → første, ellers siste; uten klokkeslett → første.
-- Paritetstesten (apps/api/src/routes/reise-kortid-migrering.integration.test.ts) holder SQL og
-- den delte regelen like. Tekst sammenliknes med COLLATE "C", som JS-sammenlikningen.
-- Utfyllingen endrer aldri prosjekt, underprosjekt eller byggeplass på en rad (B34 B).

-- SETNING 1: reise med jobb på samme sedel og prosjekt
WITH sedel AS (
  SELECT ds.id, ds.byggeplass_id, b.project_id AS bp_prosjekt
    FROM "timer"."daily_sheets" ds
    LEFT JOIN "public"."byggeplasser" b ON b.id = ds.byggeplass_id
), jobb AS (
  SELECT t.sheet_id, t.project_id, t.kort_id,
         min(t.external_cost_object_id) AS eco,
         min(coalesce(t.byggeplass_id, CASE WHEN s.bp_prosjekt = t.project_id THEN s.byggeplass_id END)) AS bp,
         min(t.fra_tid COLLATE "C") AS forste_tid,
         min(t.created_at) AS eldste
    FROM "timer"."sheet_timer" t
    JOIN sedel s ON s.id = t.sheet_id
   WHERE t.er_reise = false AND t.kort_id IS NOT NULL AND t.attestert_status IS DISTINCT FROM 'erstattet'
   GROUP BY t.sheet_id, t.project_id, t.kort_id
), kandidat AS (
  SELECT r.id AS reise_id, j.kort_id,
         (j.eco IS NOT DISTINCT FROM r.external_cost_object_id) AS eco_treff,
         (r.byggeplass_id IS NOT NULL AND j.bp IS NOT DISTINCT FROM r.byggeplass_id) AS bp_treff,
         j.forste_tid, r.reise_retning, r.fra_tid AS reise_tid,
         row_number() OVER (PARTITION BY r.id
           ORDER BY (j.forste_tid IS NULL), j.forste_tid, j.eldste, j.kort_id COLLATE "C") AS posisjon
    FROM "timer"."sheet_timer" r
    JOIN jobb j ON j.sheet_id = r.sheet_id AND j.project_id = r.project_id
   WHERE r.er_reise = true AND r.kort_id IS NULL
), gruppe AS (
  SELECT k.*, min(k.forste_tid) OVER (PARTITION BY k.reise_id, k.eco_treff, k.bp_treff) AS gruppe_forste
    FROM kandidat k
), plassert AS (
  SELECT g.*, CASE
           WHEN g.reise_retning = 'ut'    THEN 'forst'
           WHEN g.reise_retning = 'retur' THEN 'sist'
           WHEN g.reise_tid IS NULL OR g.gruppe_forste IS NULL THEN 'forst'
           WHEN g.reise_tid COLLATE "C" < g.gruppe_forste THEN 'forst'
           ELSE 'sist' END AS plass
    FROM gruppe g
), valgt AS (
  SELECT DISTINCT ON (reise_id) reise_id, kort_id
    FROM plassert
   ORDER BY reise_id, eco_treff DESC, bp_treff DESC,
            CASE WHEN plass = 'forst' THEN posisjon END ASC NULLS LAST,
            CASE WHEN plass = 'sist'  THEN posisjon END DESC NULLS LAST
)
UPDATE "timer"."sheet_timer" r
   SET "kort_id" = v.kort_id
  FROM valgt v
 WHERE r.id = v.reise_id AND r.er_reise = true AND r.kort_id IS NULL;

-- SETNING 2: reise uten jobb på prosjektet → eget kort, utledet av reisens egen nøkkel
-- (samme uttrykk som `utledKortId` og BACKFILL 1 i 20261116120000_kortid_fravaer_normtak).
UPDATE "timer"."sheet_timer" r
   SET "kort_id" = md5('kort|' || ds.user_id || '|' || to_char(ds.dato, 'YYYY-MM-DD') || '|' || r.project_id
         || '|' || coalesce(coalesce(r.byggeplass_id, CASE WHEN b.project_id = r.project_id THEN ds.byggeplass_id END), 'ingen')
         || '|' || coalesce(r.external_cost_object_id, 'ingen'))::uuid::text
  FROM "timer"."daily_sheets" ds
  LEFT JOIN "public"."byggeplasser" b ON b.id = ds.byggeplass_id
 WHERE r.sheet_id = ds.id AND r.er_reise = true AND r.kort_id IS NULL;
