-- Vei C del 1 (ordre bibliotekmal-objekttabell): sentralmalens innhold flyttes fra
-- flat `bibliotek_maler.mal_innhold`-JSON til RADER i `bibliotek_mal_objekter`, som
-- speiler `organization_template_objects` FELT FOR FELT (Krav 1).
--
-- Design B (fabels avviksgodkjenning 2026-09-14): overskriftene ble aldri lagret i JSON —
-- de ble generert ved lån/import fra `fase`. Migreringen MATERIALISERER dem som egne
-- heading-rader (tom config), slik at lånevegen kopierer dem verbatim i stedet for å
-- generere. Radantall == feltantall + antall distinkte faser.
--
-- Idempotent: strukturen bruker IF NOT EXISTS / DO-block, og backfill skriver kun for
-- maler som ennå ikke har rader (NOT EXISTS). Kjørt to ganger → samme resultat.
--
-- `mal_innhold` FRYSES men slettes IKKE (to-stegs-migreringspolicy) — egen senere runde.

-- 1. Tabellen (speiler organization_template_objects).
CREATE TABLE IF NOT EXISTS "bibliotek_mal_objekter" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "translations" JSONB NOT NULL DEFAULT '{}',
    "sort_order" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bibliotek_mal_objekter_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "bibliotek_mal_objekter_template_id_idx"
    ON "bibliotek_mal_objekter"("template_id");

CREATE INDEX IF NOT EXISTS "bibliotek_mal_objekter_parent_id_idx"
    ON "bibliotek_mal_objekter"("parent_id");

DO $$ BEGIN
    ALTER TABLE "bibliotek_mal_objekter"
        ADD CONSTRAINT "bibliotek_mal_objekter_template_id_fkey"
        FOREIGN KEY ("template_id") REFERENCES "bibliotek_maler"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "bibliotek_mal_objekter"
        ADD CONSTRAINT "bibliotek_mal_objekter_parent_id_fkey"
        FOREIGN KEY ("parent_id") REFERENCES "bibliotek_mal_objekter"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Backfill: transformér eksisterende mal_innhold → rader. Speiler byggBibliotekRader
--    (@sitedoc/shared) NØYAKTIG. Kun maler UTEN rader (idempotens).
WITH kilde AS (
    SELECT bm.id AS template_id, bm.mal_innhold
    FROM "bibliotek_maler" bm
    WHERE jsonb_typeof(bm.mal_innhold) = 'array'
      AND NOT EXISTS (SELECT 1 FROM "bibliotek_mal_objekter" o WHERE o.template_id = bm.id)
),
elems AS (
    SELECT k.template_id,
           e.elem,
           e.ord,
           NULLIF(e.elem->>'fase', '') AS fase
    FROM kilde k
    CROSS JOIN LATERAL jsonb_array_elements(k.mal_innhold) WITH ORDINALITY AS e(elem, ord)
),
fase_forst AS (
    -- Distinkte faser pr. mal + ordinaliteten fasen FØRST opptrer på (grupperekkefølge).
    SELECT template_id, fase, MIN(ord) AS forst_ord
    FROM elems
    WHERE fase IS NOT NULL
    GROUP BY template_id, fase
),
heading_rader AS (
    SELECT ff.template_id,
           ff.forst_ord AS gruppe,
           0::numeric AS sub,               -- heading FØR sine felt
           'heading'::text AS type,
           CASE ff.fase
               WHEN 'FØR'   THEN 'Kontroll FØR utførelse'
               WHEN 'UNDER' THEN 'Kontroll UNDER utførelse'
               ELSE              'Kontroll ETTER utførelse'
           END AS label,
           '{}'::jsonb AS config,           -- tom config (Krav 2-B)
           false AS required
    FROM fase_forst ff
),
fase_felt AS (
    SELECT e.template_id,
           ff.forst_ord AS gruppe,
           e.ord::numeric AS sub,           -- array-orden innenfor fasen
           e.elem->>'type' AS type,
           e.elem->>'label' AS label,
           jsonb_build_object('zone', COALESCE(e.elem->>'zone', 'datafelter'))
             || CASE WHEN jsonb_typeof(e.elem->'config') = 'object' THEN e.elem->'config' ELSE '{}'::jsonb END AS config,
           COALESCE((e.elem->>'required')::boolean, false) AS required
    FROM elems e
    JOIN fase_forst ff ON ff.template_id = e.template_id AND ff.fase = e.fase
    WHERE e.fase IS NOT NULL
),
utenfase_felt AS (
    -- Felt uten fase: ingen heading, plasseres ETTER alle faser (gruppe > enhver forst_ord).
    SELECT e.template_id,
           (SELECT COALESCE(MAX(x.ord), 0) FROM elems x WHERE x.template_id = e.template_id) + 1 AS gruppe,
           e.ord::numeric AS sub,
           e.elem->>'type' AS type,
           e.elem->>'label' AS label,
           jsonb_build_object('zone', COALESCE(e.elem->>'zone', 'datafelter'))
             || CASE WHEN jsonb_typeof(e.elem->'config') = 'object' THEN e.elem->'config' ELSE '{}'::jsonb END AS config,
           COALESCE((e.elem->>'required')::boolean, false) AS required
    FROM elems e
    WHERE e.fase IS NULL
),
alle AS (
    SELECT * FROM heading_rader
    UNION ALL SELECT * FROM fase_felt
    UNION ALL SELECT * FROM utenfase_felt
),
ordnet AS (
    SELECT a.*,
           row_number() OVER (PARTITION BY a.template_id ORDER BY a.gruppe, a.sub) AS sort_order
    FROM alle a
)
INSERT INTO "bibliotek_mal_objekter"
    ("id", "template_id", "parent_id", "type", "label", "config", "translations", "sort_order", "required", "created_at", "updated_at")
SELECT gen_random_uuid()::text, o.template_id, NULL, o.type, o.label, o.config, '{}'::jsonb,
       o.sort_order::int, o.required, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM ordnet o;
