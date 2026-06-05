-- Variant B (2026-06-05): firma-konfigurerbar default-lønnsart for ny timer-rad.
-- Additivt felt med NOT NULL DEFAULT false (to-stegs-policy: trygt, ingen data slettes).
ALTER TABLE "timer"."lonnsarter"
  ADD COLUMN "er_standardvalg" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: marker «Timelønn» (Nivå 1-seed) som standard for eksisterende firma.
-- Diskriminerende WHERE (navn + seed_nivaa) per migrasjons-backfill-disiplin —
-- treffer maks én rad per organisasjon (seed lager kun én «Timelønn» på Nivå 1).
UPDATE "timer"."lonnsarter"
  SET "er_standardvalg" = true
  WHERE "navn" = 'Timelønn' AND "seed_nivaa" = 1;
