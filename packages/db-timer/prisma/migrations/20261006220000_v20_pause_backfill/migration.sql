-- V20/PK8 (pause — én kilde) — backfill av matpause-BÆREREN på eksisterende sedler.
--
-- Hjemmel: Kenneth 2026-10-06, V20 = B («radens avkrysning er kilden»). Spec
-- timer-pause-en-kilde-spec.md § 3 PK8 + § 4 leveranse S, GATET rev. 2.
--
-- Problem (P1/P3): web-rader og mobile manuelle rader har timetallet med pausen
-- trukket fra (f.eks. 07:00–15:00 = 7,50 t), men `sheet_timer.pause_min = 0` —
-- hodet `daily_sheets.pause_min > 0` bærer pausen alene. V20 flytter sannheten til
-- raden. Denne migreringen attribuerer bæreren der timetallet BEVISER fradraget.
--
-- Regel (speiler effektiveTimerFraSpenn i @sitedoc/shared og tellings-SQL-en):
--   pauseFra (fastStart-tilnærming) = standard_start_tid + standard_pause_etter_timer
--   overlapp  = max(0, min(til, pauseFra+hode) - max(fra, pauseFra))
--   bærer     = timebasert rad (sats_enhet ∈ {per_time, null}) der overlapp > 0 OG
--               |timer - (til-fra-overlapp)/60| <= 0,01. Finnes flere → tidligste fra.
--   Settes pr. sedel KUN der hode > 0 OG Σ rad.pause_min = 0 (kandidat).
--
-- 🔴 Ufravikelig:
--   - Endrer ALDRI rad.timer (test 8) — kun pause_min på bæreren.
--   - Bærer settes BARE der timetallet beviser fradraget (test 9). Uavklarte
--     sedler (ingen bevist bærer) røres ikke — de telles og logges.
--   - Idempotent: rører kun Σ=0-sedler; etter kjøring er Σ>0 → ingen gjen-treff.
--   - Additiv: ingen DDL, ingen DROP. Kun UPDATE av pause_min + updated_at.
--   - Hodet (daily_sheets.pause_min) er allerede verdien vi setter på bæreren,
--     så invarianten hode = Σ rad holder etter kjøring uten å røre hodet.
--
-- 🔴 KJØRES AV KENNETH mot sitedoc_test først, deretter prod. Tellings-SQL leveres
--    som egen melding (fire tall: sedler / hode>0 / Σ=0 / uavklart).

DO $$
DECLARE
  v_backfilt int := 0;
  v_uavklart int := 0;
BEGIN
  -- Bæreren pr. kandidat-sedel (DISTINCT ON → kun-én, tidligste fra ved flere).
  CREATE TEMP TABLE _v20_baerer ON COMMIT DROP AS
  WITH kandidat AS (
    SELECT
      ds.id        AS sheet_id,
      ds.pause_min AS hode,
      LEAST(1439, GREATEST(0,
        (split_part(COALESCE(os.standard_start_tid, '07:00'), ':', 1)::int * 60
         + split_part(COALESCE(os.standard_start_tid, '07:00'), ':', 2)::int)
        + round(COALESCE(os.standard_pause_etter_timer, 4.0) * 60)::int
      )) AS pfm
    FROM timer.daily_sheets ds
    LEFT JOIN public.organization_settings os
      ON os.organization_id = ds.organization_id
    WHERE ds.pause_min > 0
      AND (
        SELECT COALESCE(SUM(st.pause_min), 0)
        FROM timer.sheet_timer st WHERE st.sheet_id = ds.id
      ) = 0
  )
  SELECT DISTINCT ON (k.sheet_id)
    k.sheet_id,
    st.id AS rad_id,
    k.hode
  FROM kandidat k
  JOIN timer.sheet_timer st ON st.sheet_id = k.sheet_id
  JOIN timer.lonnsarter   l  ON l.id = st.lonnsart_id
  CROSS JOIN LATERAL (
    SELECT (split_part(st.fra_tid, ':', 1)::int * 60 + split_part(st.fra_tid, ':', 2)::int) AS fm,
           (split_part(st.til_tid, ':', 1)::int * 60 + split_part(st.til_tid, ':', 2)::int) AS tm
  ) t
  CROSS JOIN LATERAL (
    SELECT GREATEST(0, LEAST(t.tm, k.pfm + k.hode) - GREATEST(t.fm, k.pfm)) AS ov
  ) o
  WHERE st.fra_tid IS NOT NULL AND st.til_tid IS NOT NULL AND t.tm > t.fm
    AND (l.sats_enhet IS NULL OR l.sats_enhet = 'per_time')
    AND o.ov > 0
    AND abs(st.timer - round(((t.tm - t.fm - o.ov)::numeric / 60.0), 2)) <= 0.01
  ORDER BY k.sheet_id, t.fm ASC;

  -- Sett bæreren (aldri rad.timer). pause_min = sedelens hode → Σ = hode.
  UPDATE timer.sheet_timer st
  SET pause_min = bb.hode, updated_at = now()
  FROM _v20_baerer bb
  WHERE st.id = bb.rad_id;
  GET DIAGNOSTICS v_backfilt = ROW_COUNT;

  -- Bump hodets updated_at så korrigerte rader når mobil ved neste pull.
  UPDATE timer.daily_sheets ds
  SET updated_at = now()
  FROM _v20_baerer bb
  WHERE ds.id = bb.sheet_id;

  -- Uavklart = kandidater som står igjen med Σ = 0 etter backfillen.
  SELECT count(*) INTO v_uavklart
  FROM timer.daily_sheets ds
  WHERE ds.pause_min > 0
    AND (
      SELECT COALESCE(SUM(st.pause_min), 0)
      FROM timer.sheet_timer st WHERE st.sheet_id = ds.id
    ) = 0;

  RAISE NOTICE 'V20/PK8 backfill: % baerer satt, % uavklart (urort, pause_backfill_uavklart)',
    v_backfilt, v_uavklart;
END $$;
