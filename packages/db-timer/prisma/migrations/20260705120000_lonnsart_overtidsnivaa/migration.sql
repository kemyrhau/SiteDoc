-- ③a (2026-07-05): strukturert overtid-klassifisering på lønnsart.
-- Additivt NULLABLE felt (to-stegs-policy: trygt, metadata-only, ingen rewrite,
-- ingen data slettes). Erstatter fritekst-navne-match i mobil auto-gen.
ALTER TABLE "timer"."lonnsarter"
  ADD COLUMN "overtidsnivaa" INTEGER;

-- ③a backfill: KUN seed-navn (Nivå 1). Diskriminerende WHERE (navn + seed_nivaa)
-- per migrasjons-backfill-disiplin. Lærling-varianter (Nivå 2) og kunde-
-- importerte lønnsarter (seed_nivaa = null, f.eks. A.Markussens 170/172/175/177)
-- settes IKKE her — admin setter dem manuelt i lønnsart-UI. Å la lærling stå
-- null hindrer at auto-gen velger lærling-overtid for en normal arbeider.
UPDATE "timer"."lonnsarter"
  SET "overtidsnivaa" = 50
  WHERE "navn" = 'Overtid 50%' AND "seed_nivaa" = 1;

UPDATE "timer"."lonnsarter"
  SET "overtidsnivaa" = 100
  WHERE "navn" = 'Overtid 100%' AND "seed_nivaa" = 1;

-- ③b backfill: garantér at hvert firma med ≥1 ordinær lønnsart har en
-- standard (er_standardvalg). Auto-gen gjetter aldri — standard kommer fra
-- dette feltet. Kjøres kun for orgs som mangler standard (NOT EXISTS-guard).

-- Steg 1: foretrekk «Timelønn» (Nivå 1-seed) der org mangler standard.
UPDATE "timer"."lonnsarter" l
  SET "er_standardvalg" = true
  WHERE l."navn" = 'Timelønn' AND l."seed_nivaa" = 1 AND l."aktiv" = true
    AND NOT EXISTS (
      SELECT 1 FROM "timer"."lonnsarter" s
      WHERE s."organization_id" = l."organization_id"
        AND s."er_standardvalg" = true
    );

-- Steg 2: fallback — laveste-rekkefolge aktiv ordinær der org FORTSATT mangler
-- standard (ingen Timelønn-seed, f.eks. manuelt importert katalog).
UPDATE "timer"."lonnsarter" l
  SET "er_standardvalg" = true
  WHERE l."id" = (
      SELECT l2."id" FROM "timer"."lonnsarter" l2
      WHERE l2."organization_id" = l."organization_id"
        AND l2."type" = 'ordinaer' AND l2."aktiv" = true
      ORDER BY l2."rekkefolge" ASC, l2."navn" ASC
      LIMIT 1
    )
    AND NOT EXISTS (
      SELECT 1 FROM "timer"."lonnsarter" s
      WHERE s."organization_id" = l."organization_id"
        AND s."er_standardvalg" = true
    );
