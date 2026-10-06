-- DRY-RUN for 20260926140000_prefiks_backfill — BEVISELIG READ-ONLY.
-- Kun SELECT. Ingen INSERT/UPDATE/DELETE/ALTER/CREATE/DROP. Trygg mot test OG prod.
--
-- Kjøres ÉN gang, av Kenneth, FØR migreringen. Svarer på ordrens §D-krav: tallene for
-- ALLE TRE gruppene, også de tomme («0 i gruppe 3» er en måling; et utelatt tall er ikke).

-- === FIRMAMALER (organization_templates) — de tre gruppene ===
SELECT
  CASE
    WHEN laant_fra_bibliotek_mal_id IS NOT NULL THEN '1_laant_utledes_automatisk'
    WHEN name ~ '^\S+\s*[–-]\s'                  THEN '2_navn_er_KODE_foreslaa'
    ELSE                                              '3_verken_eller_rapporter'
  END AS gruppe,
  count(*) AS antall
FROM organization_templates
WHERE prefix IS NULL
  AND deleted_at IS NULL
GROUP BY 1
ORDER BY 1;

-- Detaljer gruppe 1: hva blir utledet? (verifiser før kjøring)
SELECT ot.id,
       ot.name,
       bm.referanse,
       NULLIF(TRIM((regexp_split_to_array(bm.referanse, '[[:space:]/]'))[1]), '') AS utledet_prefiks
FROM organization_templates ot
JOIN bibliotek_maler bm ON bm.id = ot.laant_fra_bibliotek_mal_id
WHERE ot.prefix IS NULL
  AND ot.deleted_at IS NULL
ORDER BY ot.name;

-- Detaljer gruppe 2 (navn «KODE – …»): FORESLÅ, ikke sett. Kenneth avgjør.
SELECT id, name, category, domain
FROM organization_templates
WHERE prefix IS NULL
  AND deleted_at IS NULL
  AND laant_fra_bibliotek_mal_id IS NULL
  AND name ~ '^\S+\s*[–-]\s'
ORDER BY name;

-- Detaljer gruppe 3 (verken lånt eller kode-navn): RAPPORTÉR, ikke gjett.
SELECT id, name, category, domain
FROM organization_templates
WHERE prefix IS NULL
  AND deleted_at IS NULL
  AND laant_fra_bibliotek_mal_id IS NULL
  AND name !~ '^\S+\s*[–-]\s'
ORDER BY name;

-- === PROSJEKTMALER (report_templates) — arver fra firmamalen ===
-- Hvor mange får prefiks via organization_template_id, og hvor mange blir stående tomme?
SELECT
  CASE
    WHEN rt.organization_template_id IS NOT NULL THEN 'arver_fra_firmamal'
    ELSE                                              'ingen_firmamal_peker_rapporter'
  END AS gruppe,
  count(*) AS antall
FROM report_templates rt
WHERE rt.prefix IS NULL
GROUP BY 1
ORDER BY 1;
