-- Utleggs-ordningsmodell — MODELLJUSTERING (2026-08-11, gate 1).
--
-- Fabel/Kenneth landet domenet: «sats» var et homonym (lønnstillegg med fast
-- sats vs. utlegg beregnet ETTER statens satser). Justeringen:
--   1) Omdøp ordning "sats" → "lonnstillegg" (data + CHECK-verdisett).
--   2) Behold "fakturert" i CHECK for historikk-sikkerhet (app-lag gjør den
--      ikke-valgbar; 0 rader finnes i dag).
--   3) Nye markeringer på ExpenseCategory: satsbasert + mulig_skattepliktig
--      (ren metadata — ENDRER IKKE bærer/ordning/eksport).
--
-- CHECK-verdiene håndheves i DB i tillegg til app-lag (@sitedoc/shared). De tre
-- CHECK-ene enumererer ordningene; de må derfor droppes + gjenskapes med det nye
-- settet. Data omdøpes FØRST slik at ingen rad bryter den nye CHECK-en.
--
-- Datatrygghet (bekreftet 2026-08-11): ingen seed/default setter "sats" (U1-
-- default er "utlegg"); "sats" kan bare ha blitt satt manuelt via U5 settOrdning.
-- sheet_utlegg.ordning_ved_foering kan ALDRI være "sats" — serveren avviser sats
-- ved insert (baeresAvSheetUtlegg). UPDATE-en på sheet_utlegg er derfor en
-- defensiv no-op som verner mot uventet drift ved CHECK-gjenskapingen.

-- 1) Data-omdøping: "sats" → "lonnstillegg" (FØR CHECK gjenskapes).
UPDATE "timer"."expense_categories"
    SET "ordning" = 'lonnstillegg' WHERE "ordning" = 'sats';
UPDATE "timer"."prosjekt_ordning_overstyring"
    SET "ordning" = 'lonnstillegg' WHERE "ordning" = 'sats';
UPDATE "timer"."sheet_utlegg"
    SET "ordning_ved_foering" = 'lonnstillegg' WHERE "ordning_ved_foering" = 'sats';

-- 2) Gjenskap de tre ordning-CHECK-ene med det nye verdisettet.
ALTER TABLE "timer"."expense_categories"
    DROP CONSTRAINT "expense_categories_ordning_check";
ALTER TABLE "timer"."expense_categories"
    ADD CONSTRAINT "expense_categories_ordning_check"
    CHECK ("ordning" IN ('lonnstillegg', 'utlegg', 'fakturert'));

ALTER TABLE "timer"."sheet_utlegg"
    DROP CONSTRAINT "sheet_utlegg_ordning_ved_foering_check";
ALTER TABLE "timer"."sheet_utlegg"
    ADD CONSTRAINT "sheet_utlegg_ordning_ved_foering_check"
    CHECK ("ordning_ved_foering" IN ('lonnstillegg', 'utlegg', 'fakturert'));

ALTER TABLE "timer"."prosjekt_ordning_overstyring"
    DROP CONSTRAINT "prosjekt_ordning_overstyring_ordning_check";
ALTER TABLE "timer"."prosjekt_ordning_overstyring"
    ADD CONSTRAINT "prosjekt_ordning_overstyring_ordning_check"
    CHECK ("ordning" IN ('lonnstillegg', 'utlegg', 'fakturert'));

-- (belop-CHECK-en refererer kun 'fakturert' og er uendret av omdøpingen.)

-- 3) Nye markeringer på ExpenseCategory — additive, trygg default.
ALTER TABLE "timer"."expense_categories"
    ADD COLUMN "satsbasert" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "timer"."expense_categories"
    ADD COLUMN "mulig_skattepliktig" BOOLEAN NOT NULL DEFAULT false;
