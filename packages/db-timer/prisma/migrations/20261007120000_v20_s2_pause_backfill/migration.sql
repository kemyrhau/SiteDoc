-- V20-S2/PK8 (pause — én kilde) — backfill der HODET ER 0 (og generelt Σ rad = 0).
--
-- Hjemmel: Kenneth 2026-10-07, test på test.sitedoc.no etter V20-S (`3b06dcb1`):
-- mandag 05.10 har raden 07:00–16:00, 8,50 t, avkrysning tom, rad.pause_min = 0,
-- og hodet viser «Pause 0 min» (hodet er 07:00–15:30). Timetallet beviser at 30 min
-- er trukket, men raden ble ikke rettet. Spec timer-pause-en-kilde-spec.md § 3 PK8
-- + § 4 leveranse S (TILLEGG 1 til V20-W-ordren).
--
-- Rotårsak (målt): V20-S-migreringen `20261006220000_v20_pause_backfill` tar bare
-- kandidater med `ds.pause_min > 0` og bruker HODET som pausebeløp. Når hodet er 0
-- (Kenneths tilfelle) blir det skjulte fradraget stående, og PK4b-2 i `syncBatch`
-- retter raden bare når telefonen sender den på nytt.
--
-- Forskjell fra S:
--   * Kandidat = sedel med Σ rad.pause_min = 0, UANSETT hode (også hode = 0).
--   * Pausebeløpet er firmaets `standard_pause_min` (ikke hodet) — det eneste tallet
--     som fantes da raden ble ført uten å skrive pause_min.
--   * Etter at bæreren er satt, settes HODET = Σ rad (PK6) i samme migrering.
--     (S kunne la hodet stå fordi hodet allerede var pausebeløpet; her er hodet
--     typisk 0 og må settes.)
--
-- Beviset er det samme som i S (speiler effektiveTimerFraSpenn i @sitedoc/shared og
-- tellings-SQL-en relay/v20-telling.sql § C):
--   pauseFra (fastStart-tilnærming) = standard_start_tid + standard_pause_etter_timer
--   pm        = standard_pause_min (COALESCE 30)
--   overlapp  = max(0, min(til, pauseFra+pm) - max(fra, pauseFra))
--   bærer     = timebasert rad (sats_enhet ∈ {per_time, null}) der overlapp > 0 OG
--               |timer - (til-fra-overlapp)/60| <= 0,01. Finnes flere → tidligste fra.
--   Settes pr. sedel KUN der Σ rad.pause_min = 0 (kandidat).
--
-- 🔴 Ufravikelig:
--   - Endrer ALDRI rad.timer (test: en rad 07–16 med 9,00 t skal ikke røres).
--   - Bærer settes BARE der timetallet beviser fradraget. Uavklarte sedler (ingen
--     bevist bærer) røres ikke — de telles og logges (pause_backfill_uavklart).
--   - Idempotent: rører kun Σ=0-sedler; etter kjøring er Σ>0 → ingen gjen-treff.
--     Uavklarte står med Σ=0, men uten bevist bærer skjer ingen UPDATE.
--   - Additiv: ingen DDL, ingen DROP. Kun UPDATE av pause_min + updated_at.
--
-- 🔴 KJØRES AV KENNETH mot sitedoc_test først, deretter prod. Tellings-SQL (fire tall
--    + breakdown) står i relay/v20-telling.sql § C med SAMME definisjon.

DO $$
DECLARE
  v_backfilt int := 0;
  v_hode     int := 0;
  v_uavklart int := 0;
BEGIN
  -- Bæreren pr. kandidat-sedel (DISTINCT ON → kun-én, tidligste fra ved flere).
  CREATE TEMP TABLE _v20_s2_baerer ON COMMIT DROP AS
  WITH kandidat AS (
    SELECT
      ds.id AS sheet_id,
      LEAST(1439, GREATEST(0,
        (split_part(COALESCE(os.standard_start_tid, '07:00'), ':', 1)::int * 60
         + split_part(COALESCE(os.standard_start_tid, '07:00'), ':', 2)::int)
        + round(COALESCE(os.standard_pause_etter_timer, 4.0) * 60)::int
      )) AS pfm,
      COALESCE(os.standard_pause_min, 30) AS pm
    FROM timer.daily_sheets ds
    LEFT JOIN public.organization_settings os
      ON os.organization_id = ds.organization_id
    WHERE (
        SELECT COALESCE(SUM(st.pause_min), 0)
        FROM timer.sheet_timer st WHERE st.sheet_id = ds.id
      ) = 0
  )
  SELECT DISTINCT ON (k.sheet_id)
    k.sheet_id,
    st.id AS rad_id,
    k.pm
  FROM kandidat k
  JOIN timer.sheet_timer st ON st.sheet_id = k.sheet_id
  JOIN timer.lonnsarter   l  ON l.id = st.lonnsart_id
  CROSS JOIN LATERAL (
    SELECT (split_part(st.fra_tid, ':', 1)::int * 60 + split_part(st.fra_tid, ':', 2)::int) AS fm,
           (split_part(st.til_tid, ':', 1)::int * 60 + split_part(st.til_tid, ':', 2)::int) AS tm
  ) t
  CROSS JOIN LATERAL (
    SELECT GREATEST(0, LEAST(t.tm, k.pfm + k.pm) - GREATEST(t.fm, k.pfm)) AS ov
  ) o
  WHERE st.fra_tid IS NOT NULL AND st.til_tid IS NOT NULL AND t.tm > t.fm
    AND (l.sats_enhet IS NULL OR l.sats_enhet = 'per_time')
    AND o.ov > 0
    AND abs(st.timer - round(((t.tm - t.fm - o.ov)::numeric / 60.0), 2)) <= 0.01
  ORDER BY k.sheet_id, t.fm ASC;

  -- Sett bæreren (aldri rad.timer). pause_min = firmaets standard_pause_min.
  UPDATE timer.sheet_timer st
  SET pause_min = bb.pm, updated_at = now()
  FROM _v20_s2_baerer bb
  WHERE st.id = bb.rad_id;
  GET DIAGNOSTICS v_backfilt = ROW_COUNT;

  -- PK6: hodet = Σ rad.pause_min for de berørte sedlene (bumper også updated_at så
  -- korrigerte rader når mobil ved neste pull). Σ = pm siden kandidaten hadde Σ=0.
  UPDATE timer.daily_sheets ds
  SET pause_min = (
        SELECT COALESCE(SUM(st.pause_min), 0)
        FROM timer.sheet_timer st WHERE st.sheet_id = ds.id
      ),
      updated_at = now()
  FROM _v20_s2_baerer bb
  WHERE ds.id = bb.sheet_id;
  GET DIAGNOSTICS v_hode = ROW_COUNT;

  -- Uavklart = kandidater som står igjen med Σ = 0 etter backfillen.
  SELECT count(*) INTO v_uavklart
  FROM timer.daily_sheets ds
  WHERE (
      SELECT COALESCE(SUM(st.pause_min), 0)
      FROM timer.sheet_timer st WHERE st.sheet_id = ds.id
    ) = 0;

  RAISE NOTICE 'V20-S2/PK8 backfill: % baerer satt, % hoder synket, % uavklart (urort, pause_backfill_uavklart)',
    v_backfilt, v_hode, v_uavklart;
END $$;
