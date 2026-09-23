-- Ordre versjonssporing-softdelete (2026-09-16): versjonssporing firmamal→sentralarkiv
-- + soft-delete på OrganizationTemplate. ÉN migrering, to funksjoner (én mot prod).
--
-- To-stegs-migreringspolicy: KUN additive endringer. `bibliotek_maler.versjon` (String)
-- SLETTES IKKE — den fryses og droppes i egen senere runde. Ingen DROP, ingen destruktiv DDL.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + DO-block for CHECK → kan kjøres to ganger med
-- samme resultat. Backfillen (steg 2b) har diskriminerende WHERE + IS NULL-guard.

-- 1. BibliotekMal: monoton Int-revisjonsteller (krav 1). DEFAULT 1 backfyller alle
--    eksisterende sentralmaler til 1 — beviselig riktig: `versjon String` ble ALDRI
--    skrevet i kode (kun lest i select), alle tolv sentralmalene står på "1.0", og hver
--    firmamal ble dermed lånt på versjon 1 (krav 5a). Ingen egen UPDATE nødvendig.
ALTER TABLE "bibliotek_maler" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

-- 2. OrganizationTemplate: snapshot av BibliotekMal.version ved lån (krav 2). NULLABLE —
--    NULL for firmaets EGNE (ikke-lånte) maler, non-null for lånte. Nullbarheten er det
--    som gjør DB-garantien (2c) meningsfull: uten den kunne en default'et 1 skjule et
--    manglende snapshot («stille tomhet»).
ALTER TABLE "organization_templates" ADD COLUMN IF NOT EXISTS "versjon_av_hovedmal" INTEGER;

-- 2b. Backfill (krav 5a): alle LÅNTE firmamaler ble lånt på sentralmal-versjon 1 (bevist
--     over — sentralmalene har aldri blitt versjonert). Egne maler
--     (laant_fra_bibliotek_mal_id IS NULL) forblir NULL — de har ingen avstamning.
--     Diskriminerende WHERE (backfill-disiplin): treffer KUN lånte rader, aldri en
--     generisk default på alt. IS NULL-guarden gjør re-kjøring idempotent.
UPDATE "organization_templates"
  SET "versjon_av_hovedmal" = 1
  WHERE "laant_fra_bibliotek_mal_id" IS NOT NULL
    AND "versjon_av_hovedmal" IS NULL;

-- 2c. DB-GARANTI (krav 2b / «stille tomhet» krav b): en LÅNT mal MÅ ha snapshot. Prisma-
--     skjemaet kan IKKE uttrykke CHECK-constraints — derfor rå SQL her, og skjemaet bærer
--     den ikke (meldt). En framtidig skrivevei som glemmer snapshot på et lån avvises av
--     databasen (constraint-brudd), ikke oppdaget for sent på skjermen. Kjøres ETTER
--     backfillen slik at eksisterende lånte rader alt tilfredsstiller den.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organization_templates_laant_har_snapshot'
  ) THEN
    ALTER TABLE "organization_templates"
      ADD CONSTRAINT "organization_templates_laant_har_snapshot"
      CHECK ("laant_fra_bibliotek_mal_id" IS NULL OR "versjon_av_hovedmal" IS NOT NULL);
  END IF;
END $$;

-- 3. Soft-delete på OrganizationTemplate (krav 3) — låser opp Papirkurv-fanen. Speiler
--    Checklist/Task. Backfill: NULL = ikke slettet (kolonne-default, ingen rader røres,
--    krav 5a). deleted_by_id er svakt String-felt (ingen FK til users, som Checklist).
ALTER TABLE "organization_templates" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "organization_templates" ADD COLUMN IF NOT EXISTS "deleted_by_id" TEXT;
