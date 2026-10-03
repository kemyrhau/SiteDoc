-- LAG 2-A backfill-telling — kjør mot sitedoc_test FØR og ETTER migreringen.
-- Gitignorert (*-test.sql). Verifiserer at de to RAISE NOTICE-tallene stemmer, og
-- at regex-grenen (navne-match) ikke fryser uventet mange falske positive.
--
-- ─────────────────────────────────────────────────────────────────────────
-- FØR migrering (er_reise-kolonnen finnes ikke ennå → referer den IKKE).
-- Disse to tallene SKAL bli migreringens «konfigurert» og «navne-match».
-- ─────────────────────────────────────────────────────────────────────────

-- Forventet «konfigurert»-tall (GREN 1: reise_lonnsart_id ∪ grensepunkt-art):
SELECT count(*) AS forventet_konfigurert
FROM "timer"."sheet_timer" st
JOIN "timer"."lonnsarter" la ON la.id = st.lonnsart_id
WHERE
  st.lonnsart_id = (
    SELECT os.reise_lonnsart_id FROM "public"."organization_settings" os
    WHERE os.organization_id = la.organization_id
  )
  OR EXISTS (
    SELECT 1 FROM "public"."organization_reise_grenser" g
    WHERE g.organization_id = la.organization_id AND g.lonnsart_id = st.lonnsart_id
  );

-- Forventet «navne-match»-tall (GREN 2: regex, KUN firmaer uten konfigurert art,
-- og som IKKE alt treffes av GREN 1 — disjunkt, som migreringen):
SELECT count(*) AS forventet_navnematch
FROM "timer"."sheet_timer" st
JOIN "timer"."lonnsarter" la ON la.id = st.lonnsart_id
WHERE la.navn ~* 'reise|transport'
  AND NOT EXISTS (
    SELECT 1 FROM "public"."organization_settings" os
    WHERE os.organization_id = la.organization_id AND os.reise_lonnsart_id IS NOT NULL
  )
  -- ikke alt talt i GREN 1:
  AND NOT (
    st.lonnsart_id = (
      SELECT os.reise_lonnsart_id FROM "public"."organization_settings" os
      WHERE os.organization_id = la.organization_id
    )
    OR EXISTS (
      SELECT 1 FROM "public"."organization_reise_grenser" g
      WHERE g.organization_id = la.organization_id AND g.lonnsart_id = st.lonnsart_id
    )
  );

-- Hvilke lønnsartnavn treffer regex-grenen (les disse — er noen en ikke-reise-art
-- som «Transporttillegg»?). Hvert navn her blir frosset som er_reise=true.
SELECT la.organization_id, la.navn, count(*) AS rader
FROM "timer"."sheet_timer" st
JOIN "timer"."lonnsarter" la ON la.id = st.lonnsart_id
WHERE la.navn ~* 'reise|transport'
  AND NOT EXISTS (
    SELECT 1 FROM "public"."organization_settings" os
    WHERE os.organization_id = la.organization_id AND os.reise_lonnsart_id IS NOT NULL
  )
GROUP BY la.organization_id, la.navn
ORDER BY rader DESC;

-- ─────────────────────────────────────────────────────────────────────────
-- ETTER migrering — verifiser resultatet.
-- ─────────────────────────────────────────────────────────────────────────

-- Totalt antall reise-rader etter backfill:
-- SELECT count(*) AS er_reise_totalt FROM "timer"."sheet_timer" WHERE er_reise = true;

-- 🔴 Må være 0: en reise-lønnsart-rad som står igjen som er_reise=false
-- (GREN 1-kriteriet, men ikke satt) — da har backfillen bommet:
-- SELECT count(*) AS reise_art_men_false
-- FROM "timer"."sheet_timer" st
-- JOIN "timer"."lonnsarter" la ON la.id = st.lonnsart_id
-- WHERE st.er_reise = false AND (
--   st.lonnsart_id = (SELECT os.reise_lonnsart_id FROM "public"."organization_settings" os WHERE os.organization_id = la.organization_id)
--   OR EXISTS (SELECT 1 FROM "public"."organization_reise_grenser" g WHERE g.organization_id = la.organization_id AND g.lonnsart_id = st.lonnsart_id)
-- );
