-- Backfill av prefiks på maler som ble født uten (ordre prefiks-påkrevd §D).
--
-- ADDITIV. 🔴 INGEN NOT NULL (steg 3 er en senere release, IKKE bestilt). Ingen DROP.
--
-- Bare GRUPPE 1 (lånt: laant_fra_bibliotek_mal_id satt) utledes automatisk — fra
-- bibliotekmalens referanse, samme regel som `prefiksFraReferanse` i @sitedoc/shared
-- (splitt på mellomrom/skråstrek, første token, PUNKTUM bevart: «KC3.1» → «KC3.1»).
-- Gruppe 2 (navn «KODE – …», foreslås) og gruppe 3 (verken lånt eller kode-navn) settes
-- IKKE her — de rapporteres for Kenneth, aldri gjettes. Se DRY-RUN.sql for gruppetallene.

-- 1. Firmamaler (gruppe 1): utled prefiks fra den lånte bibliotekmalens referanse.
UPDATE "organization_templates" ot
SET "prefix" = NULLIF(TRIM((regexp_split_to_array(bm."referanse", '[[:space:]/]'))[1]), '')
FROM "bibliotek_maler" bm
WHERE ot."laant_fra_bibliotek_mal_id" = bm."id"
  AND ot."prefix" IS NULL
  AND NULLIF(TRIM((regexp_split_to_array(bm."referanse", '[[:space:]/]'))[1]), '') IS NOT NULL;

-- 2. Prosjektmaler: arv fra sin (nå utfylte) firmamal via organization_template_id.
--    Måling 1 (Kenneth, test): alle 3 prefiks-løse report_templates bærer denne pekeren.
UPDATE "report_templates" rt
SET "prefix" = ot."prefix"
FROM "organization_templates" ot
WHERE rt."organization_template_id" = ot."id"
  AND rt."prefix" IS NULL
  AND ot."prefix" IS NOT NULL;
