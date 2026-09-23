-- Funn #21/#22 omfangsmåling. BEVISELIG READ-ONLY: kun SELECT — ingen INSERT, UPDATE,
-- DELETE, DROP, ALTER, CREATE. Én blokk per spørsmål. Kjør mot sitedoc_test FØRST, senere
-- sitedoc. Via: ssh -t server-ny "sudo docker exec -i <db> psql -U <bruker> -d sitedoc_test"
--
-- «Faktisk innhold» speiler server-predikatet harFaktiskInnholdForObjekt (mal.ts:25):
-- en verdi teller som utfylt hvis {verdi|kommentar|vedlegg} er ikke-tom, eller (eldre data)
-- skalaren direkte er ikke-tom. grenseSnapshot alene teller IKKE som innhold.

-- =========================================================================
-- A) Hvor mange prosjektmaler har dokumenter (Checklist/Task) knyttet?
-- =========================================================================
SELECT
  COUNT(DISTINCT rt.id)                                            AS maler_totalt,
  COUNT(DISTINCT rt.id) FILTER (WHERE d.template_id IS NOT NULL)   AS maler_med_dokument
FROM report_templates rt
LEFT JOIN (
  SELECT template_id FROM checklists WHERE deleted_at IS NULL
  UNION ALL
  SELECT template_id FROM tasks      WHERE deleted_at IS NULL AND template_id IS NOT NULL
) d ON d.template_id = rt.id;

-- =========================================================================
-- B) Hvor mange dokumenter er FAKTISK utfylt (ikke tomme)?
-- =========================================================================
SELECT 'checklist' AS type, COUNT(*) AS antall_utfylt
FROM checklists c
WHERE c.deleted_at IS NULL
  AND c.data IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM jsonb_each(c.data) AS e(key, value)
    WHERE CASE
      WHEN jsonb_typeof(e.value) = 'object' THEN
        CASE WHEN (e.value ? 'verdi' OR e.value ? 'kommentar' OR e.value ? 'vedlegg') THEN (
              (e.value->'verdi'     IS NOT NULL AND e.value->'verdi'     NOT IN ('null'::jsonb,'""'::jsonb,'[]'::jsonb,'{}'::jsonb))
           OR (e.value->'kommentar' IS NOT NULL AND e.value->'kommentar' NOT IN ('null'::jsonb,'""'::jsonb))
           OR (e.value->'vedlegg'   IS NOT NULL AND e.value->'vedlegg'   NOT IN ('null'::jsonb,'[]'::jsonb)))
             ELSE e.value <> '{}'::jsonb END
      ELSE e.value NOT IN ('null'::jsonb,'""'::jsonb,'[]'::jsonb) END)
UNION ALL
SELECT 'task' AS type, COUNT(*) AS antall_utfylt
FROM tasks t
WHERE t.deleted_at IS NULL
  AND t.data IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM jsonb_each(t.data) AS e(key, value)
    WHERE CASE
      WHEN jsonb_typeof(e.value) = 'object' THEN
        CASE WHEN (e.value ? 'verdi' OR e.value ? 'kommentar' OR e.value ? 'vedlegg') THEN (
              (e.value->'verdi'     IS NOT NULL AND e.value->'verdi'     NOT IN ('null'::jsonb,'""'::jsonb,'[]'::jsonb,'{}'::jsonb))
           OR (e.value->'kommentar' IS NOT NULL AND e.value->'kommentar' NOT IN ('null'::jsonb,'""'::jsonb))
           OR (e.value->'vedlegg'   IS NOT NULL AND e.value->'vedlegg'   NOT IN ('null'::jsonb,'[]'::jsonb)))
             ELSE e.value <> '{}'::jsonb END
      ELSE e.value NOT IN ('null'::jsonb,'""'::jsonb,'[]'::jsonb) END);

-- =========================================================================
-- C) Har en mal blitt endret ETTER at et dokument mot den ble opprettet?
--    (ReportTemplate.updated_at > dokumentets created_at)
--    MERK: updated_at bumpes av ENHVER mal-endring (også metadata), så dette er
--    et ØVRE anslag på «struktur endret etter utfylling», ikke et presist tall.
-- =========================================================================
SELECT
  COUNT(*)                                                     AS dok_med_mal_endret_etter_opprettelse,
  COUNT(DISTINCT rt.id)                                        AS berorte_maler
FROM checklists c
JOIN report_templates rt ON rt.id = c.template_id
WHERE c.deleted_at IS NULL
  AND rt.updated_at > c.created_at;

-- =========================================================================
-- D) VIKTIGST: maler med firmamal-avstamning (organization_template_id) som
--    HAR utfylte dokumenter = eksponert flate for oppdaterKopiFraHovedmal-
--    foreldreløsgjøring (firmamal.ts:818). D=0 → hullet er teoretisk i dag.
-- =========================================================================
SELECT
  COUNT(DISTINCT rt.id)                                        AS laante_maler_med_dokument,
  COUNT(d.dok_id)                                              AS antall_dokumenter_pa_dem
FROM report_templates rt
JOIN (
  SELECT id AS dok_id, template_id FROM checklists WHERE deleted_at IS NULL
  UNION ALL
  SELECT id AS dok_id, template_id FROM tasks      WHERE deleted_at IS NULL AND template_id IS NOT NULL
) d ON d.template_id = rt.id
WHERE rt.organization_template_id IS NOT NULL;
