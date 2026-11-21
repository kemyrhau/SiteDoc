-- w15c (web-timeforing-plan.md § 4.15 del E og del F punkt 2; Kenneth 2026-11-20/21: B43 B, B44,
-- B47 A, B48 A og § 8.20): reisen står i kortet regelen gir — byggeplassen og et valgt
-- underprosjekt er krav; ingen jobb på stedet → eget kort; reise til annet kontor etter arbeid
-- → eget kort.
--
-- Bare data. Ingen ny kolonne, ingen CHECK, ingen andre felt endres. updated_at skrives ikke
-- (ingen sedel skal se «endret» ut for synken). Kjøres av Kenneth. 20261120120000 røres ikke.
-- Diskriminerende WHERE: er_reise = true, ikke (kort_id satt OG attestert/erstattet) — nøyaktig
-- vakten i `sikreKortId` — og kort_id IS DISTINCT FROM målet. Rader som står riktig, røres ikke;
-- kjørt to ganger gir samme resultat. Forslagstabellen (sheet_timer_forslag) røres ikke.
-- Reise uten prosjekt (project_id IS NULL) røres ikke, som i `sikreKortId`: den er ugyldig
-- (plan FA16) og sperret av sheet_timer_uten_prosjekt_chk; vakten hindrer at md5 av NULL
-- tømmer kort-id-en om sperren noen gang løsnes.
--
-- Regelen er den samme som `velgReiseKort` + `egetReiseKort` i
-- packages/shared/src/utils/reiseKort.ts (paritetstesten i
-- apps/api/src/routes/reise-kortid-migrering.integration.test.ts holder dem like):
--  kandidater  = jobber (kort med arbeid, ikke erstattet) på samme sedel og prosjekt,
--                med reisens EFFEKTIVE byggeplass (kontorreise: alle), og
--                med reisens underprosjekt når den har et;
--  sortering   = underprosjekt-treff (reise uten underprosjekt: jobb «Uten» foran), så plass i
--                kortenes visningsrekkefølge — stigende for første (utreise), synkende for siste
--                (retur); uten retning: før første arbeid i toppgruppen → første, ellers siste;
--                uten klokkeslett → første;
--  kontorreise = reise_kilde 'overforing' som ikke er retur og starter kl. >= dagens første
--                arbeid på prosjektet → eget kort;
--  eget kort   = kontorreise: md5('reisekort|…|overforing|…'); ellers md5('kort|…') av reisens
--                nøkkel, men md5('reisekort|…') når den id-en er kortet til en jobb på sedelen.
-- Tekst sammenliknes med COLLATE "C", som JS-sammenlikningen.

-- SETNING 1: hver reise som ikke er attestert eller erstattet, får kortet regelen gir
WITH sedel AS (
  SELECT ds.id, ds.user_id, to_char(ds.dato, 'YYYY-MM-DD') AS dato, ds.byggeplass_id, b.project_id AS bp_prosjekt
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
), prosjekt_forste AS (
  SELECT sheet_id, project_id, min(forste_tid COLLATE "C") AS forste FROM jobb GROUP BY sheet_id, project_id
), reise AS (
  SELECT r.id, r.sheet_id, r.project_id, r.external_cost_object_id AS eco, r.reise_retning, r.fra_tid,
         r.kort_id, s.user_id, s.dato,
         coalesce(r.byggeplass_id, CASE WHEN s.bp_prosjekt = r.project_id THEN s.byggeplass_id END) AS bp,
         coalesce(r.reise_kilde = 'overforing', false) AS overforing,
         coalesce(r.reise_kilde = 'overforing' AND r.reise_retning IS DISTINCT FROM 'retur' AND r.fra_tid IS NOT NULL
            AND pf.forste IS NOT NULL AND r.fra_tid COLLATE "C" >= pf.forste, false) AS kontor_etter_arbeid
    FROM "timer"."sheet_timer" r
    JOIN sedel s ON s.id = r.sheet_id
    LEFT JOIN prosjekt_forste pf ON pf.sheet_id = r.sheet_id AND pf.project_id = r.project_id
   WHERE r.er_reise = true AND r.project_id IS NOT NULL
     AND NOT (r.kort_id IS NOT NULL AND r.attestert_status IN ('attestert', 'erstattet'))
), kandidat AS (
  SELECT r.id AS reise_id, j.kort_id,
         (j.eco IS NOT DISTINCT FROM r.eco) AS eco_treff,
         j.forste_tid, r.reise_retning, r.fra_tid AS reise_tid,
         row_number() OVER (PARTITION BY r.id
           ORDER BY (j.forste_tid IS NULL), j.forste_tid, j.eldste, j.kort_id COLLATE "C") AS posisjon
    FROM reise r
    JOIN jobb j ON j.sheet_id = r.sheet_id AND j.project_id = r.project_id
   WHERE NOT r.kontor_etter_arbeid
     AND (r.overforing OR j.bp IS NOT DISTINCT FROM r.bp)
     AND (r.eco IS NULL OR j.eco = r.eco)
), gruppe AS (
  SELECT k.*, min(k.forste_tid) OVER (PARTITION BY k.reise_id, k.eco_treff) AS gruppe_forste
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
   ORDER BY reise_id, eco_treff DESC,
            CASE WHEN plass = 'forst' THEN posisjon END ASC NULLS LAST,
            CASE WHEN plass = 'sist'  THEN posisjon END DESC NULLS LAST
), utledet AS (
  SELECT r.*, v.kort_id AS jobb_kort,
         md5('kort|' || r.user_id || '|' || r.dato || '|' || r.project_id || '|' || coalesce(r.bp, 'ingen')
             || '|' || coalesce(r.eco, 'ingen'))::uuid::text AS kort_utledet,
         md5('reisekort|' || r.user_id || '|' || r.dato || '|' || r.project_id || '|' || coalesce(r.bp, 'ingen')
             || '|' || coalesce(r.eco, 'ingen'))::uuid::text AS reise_utledet,
         md5('reisekort|' || r.user_id || '|' || r.dato || '|' || r.project_id || '|overforing|'
             || coalesce(r.eco, 'ingen'))::uuid::text AS kontor_utledet
    FROM reise r
    LEFT JOIN valgt v ON v.reise_id = r.id
), maal AS (
  SELECT u.id, CASE
           WHEN u.jobb_kort IS NOT NULL THEN u.jobb_kort
           WHEN u.overforing THEN u.kontor_utledet
           WHEN EXISTS (SELECT 1 FROM jobb j WHERE j.sheet_id = u.sheet_id AND j.kort_id = u.kort_utledet)
             THEN u.reise_utledet
           ELSE u.kort_utledet END AS kort_id
    FROM utledet u
)
UPDATE "timer"."sheet_timer" r
   SET "kort_id" = m.kort_id
  FROM maal m
 WHERE r.id = m.id
   AND r.er_reise = true AND r.project_id IS NOT NULL
   AND NOT (r.kort_id IS NOT NULL AND r.attestert_status IN ('attestert', 'erstattet'))
   AND r.kort_id IS DISTINCT FROM m.kort_id;
