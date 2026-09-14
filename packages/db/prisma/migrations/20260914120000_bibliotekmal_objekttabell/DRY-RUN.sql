-- DRY-RUN for 20260914120000_bibliotekmal_objekttabell (vei C del 1).
-- READ-ONLY. Kjøres FØR migreringen, mot den databasen migreringen skal treffe.
-- Viser pr. mal de TRE tallene fabel gater på: felt (JSON) · distinkte faser ·
-- predikert radantall (== felt + faser). Flagger maler der formen avviker fra FeltDef.
--
-- Kjør mot test (bytt -d sitedoc_test) eller prod (-d sitedoc):
--   ssh -t server-ny "sudo docker exec -i <db-container> psql -U <bruker> -d sitedoc_test" < DRY-RUN.sql
-- eller lim SQL-en inn i en psql-økt.

\echo '=== Pr. mal: felt | faser | predikerte rader (= felt+faser) | felt uten fase | ukjente nokler ==='
SELECT
  bm.navn,
  bm.referanse,
  jsonb_array_length(bm.mal_innhold) AS felt,
  (SELECT count(DISTINCT NULLIF(e->>'fase','')) FROM jsonb_array_elements(bm.mal_innhold) e
     WHERE NULLIF(e->>'fase','') IS NOT NULL) AS faser,
  jsonb_array_length(bm.mal_innhold)
    + (SELECT count(DISTINCT NULLIF(e->>'fase','')) FROM jsonb_array_elements(bm.mal_innhold) e
         WHERE NULLIF(e->>'fase','') IS NOT NULL) AS predikerte_rader,
  (SELECT count(*) FROM jsonb_array_elements(bm.mal_innhold) e WHERE NULLIF(e->>'fase','') IS NULL) AS felt_uten_fase,
  -- Nøkler utover FeltDef (label,type,zone,fase,config,required,sortOrder) → MELD, ikke reparér.
  (SELECT COALESCE(string_agg(DISTINCT k, ','), '') FROM jsonb_array_elements(bm.mal_innhold) e, jsonb_object_keys(e) k
     WHERE k NOT IN ('label','type','zone','fase','config','required','sortOrder')) AS ukjente_nokler,
  -- Elementer med type=heading LIGGER ALLEREDE i JSON (uventet — headings skal genereres) → MELD.
  (SELECT count(*) FROM jsonb_array_elements(bm.mal_innhold) e WHERE e->>'type'='heading') AS heading_i_json
FROM bibliotek_maler bm
WHERE jsonb_typeof(bm.mal_innhold) = 'array'
ORDER BY bm.navn;

\echo '=== Maler med IKKE-array mal_innhold (migreringen hopper over dem — skal normalt 0) ==='
SELECT id, navn FROM bibliotek_maler WHERE jsonb_typeof(mal_innhold) <> 'array' OR mal_innhold IS NULL;

\echo '=== Totaler: antall maler · sum felt · sum predikerte rader ==='
SELECT count(*) AS maler,
       sum(jsonb_array_length(mal_innhold)) AS sum_felt,
       sum(jsonb_array_length(mal_innhold)
         + (SELECT count(DISTINCT NULLIF(e->>'fase','')) FROM jsonb_array_elements(mal_innhold) e
              WHERE NULLIF(e->>'fase','') IS NOT NULL)) AS sum_predikerte_rader
FROM bibliotek_maler WHERE jsonb_typeof(mal_innhold)='array';
