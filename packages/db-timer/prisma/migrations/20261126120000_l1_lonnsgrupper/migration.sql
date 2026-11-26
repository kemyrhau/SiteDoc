-- L1 LØNNSGRUPPER (spec-lonnsgrupper.md § 2 og «Migreringen (L1)», Kenneth 2026-11-26):
-- «Hvert firma lager egne grupper.» · «Ved registrering av ansatt må den enkelte som standard få
-- ordinær gruppe.» · B11 ja: alle eksisterende ansatte, også deaktiverte, settes til «Ordinær».
--
-- ADDITIV: fem nye tabeller i skjemaet "timer". Ingen eksisterende tabell endres, ingen data slettes.
-- Leser "public"."organizations" og "public"."organization_members" (samme mønster som
-- 20261003120000_timer_lag2_sporbarhet). Kjøres av Kenneth: bygg → migrer → start (DEPLOY-RUNBOK).
--
-- Stille-tomhet-regelen (arkitektur.md § Schema- og migreringsregler):
--   (a) backfill — «Ordinær» (er_standard) pr. firma + én ansatt_lonnsgrupper-rad pr. firmamedlem.
--   (b) garanti  — delvis unik indeks: høyst én er_standard pr. firma; unik (organization_id, user_id).
--                  «Minst én» og «raden finnes alltid» holdes av sikreAnsattLonnsgruppe (API) + vernet
--                  ved oppslag — de to Prisma-klientene kan ikke dele transaksjon.
--   (c) test     — backfill-telling-test.sql (ved siden av) feiler når et firma mangler standardgruppe
--                  eller et firmamedlem mangler gruppe; API-test for V1–V3.
--
-- Tom kobling (lonnsart_lonnsgrupper osv.) er en LOVLIG verdi: «Hvis lønnsgruppe ikke er valgt, gjelder
-- den for alle» — ingen etterfylling der, og ingen velger endrer seg før firmaadmin merker noe.

-- CreateTable
CREATE TABLE "timer"."lonnsgrupper" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "navn" TEXT NOT NULL,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "rekkefolge" INTEGER NOT NULL DEFAULT 0,
    "er_standard" BOOLEAN NOT NULL DEFAULT false,
    "standard_lonnsart_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lonnsgrupper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timer"."ansatt_lonnsgrupper" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "lonnsgruppe_id" TEXT NOT NULL,
    "satt_av_user_id" TEXT,
    "satt_ved" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ansatt_lonnsgrupper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timer"."lonnsart_lonnsgrupper" (
    "lonnsart_id" TEXT NOT NULL,
    "lonnsgruppe_id" TEXT NOT NULL,

    CONSTRAINT "lonnsart_lonnsgrupper_pkey" PRIMARY KEY ("lonnsart_id","lonnsgruppe_id")
);

-- CreateTable
CREATE TABLE "timer"."tillegg_lonnsgrupper" (
    "tillegg_id" TEXT NOT NULL,
    "lonnsgruppe_id" TEXT NOT NULL,

    CONSTRAINT "tillegg_lonnsgrupper_pkey" PRIMARY KEY ("tillegg_id","lonnsgruppe_id")
);

-- CreateTable
CREATE TABLE "timer"."expense_category_lonnsgrupper" (
    "expense_category_id" TEXT NOT NULL,
    "lonnsgruppe_id" TEXT NOT NULL,

    CONSTRAINT "expense_category_lonnsgrupper_pkey" PRIMARY KEY ("expense_category_id","lonnsgruppe_id")
);

-- CreateIndex
CREATE INDEX "lonnsgrupper_organization_id_aktiv_idx" ON "timer"."lonnsgrupper"("organization_id", "aktiv");

-- CreateIndex
CREATE UNIQUE INDEX "uq_lonnsgruppe_navn_per_org" ON "timer"."lonnsgrupper"("organization_id", "navn");

-- CreateIndex
CREATE INDEX "ansatt_lonnsgrupper_lonnsgruppe_id_idx" ON "timer"."ansatt_lonnsgrupper"("lonnsgruppe_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_ansatt_lonnsgruppe" ON "timer"."ansatt_lonnsgrupper"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "lonnsart_lonnsgrupper_lonnsgruppe_id_idx" ON "timer"."lonnsart_lonnsgrupper"("lonnsgruppe_id");

-- CreateIndex
CREATE INDEX "tillegg_lonnsgrupper_lonnsgruppe_id_idx" ON "timer"."tillegg_lonnsgrupper"("lonnsgruppe_id");

-- CreateIndex
CREATE INDEX "expense_category_lonnsgrupper_lonnsgruppe_id_idx" ON "timer"."expense_category_lonnsgrupper"("lonnsgruppe_id");

-- AddForeignKey
ALTER TABLE "timer"."ansatt_lonnsgrupper" ADD CONSTRAINT "ansatt_lonnsgrupper_lonnsgruppe_id_fkey" FOREIGN KEY ("lonnsgruppe_id") REFERENCES "timer"."lonnsgrupper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timer"."lonnsart_lonnsgrupper" ADD CONSTRAINT "lonnsart_lonnsgrupper_lonnsart_id_fkey" FOREIGN KEY ("lonnsart_id") REFERENCES "timer"."lonnsarter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timer"."lonnsart_lonnsgrupper" ADD CONSTRAINT "lonnsart_lonnsgrupper_lonnsgruppe_id_fkey" FOREIGN KEY ("lonnsgruppe_id") REFERENCES "timer"."lonnsgrupper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timer"."tillegg_lonnsgrupper" ADD CONSTRAINT "tillegg_lonnsgrupper_tillegg_id_fkey" FOREIGN KEY ("tillegg_id") REFERENCES "timer"."tillegg"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timer"."tillegg_lonnsgrupper" ADD CONSTRAINT "tillegg_lonnsgrupper_lonnsgruppe_id_fkey" FOREIGN KEY ("lonnsgruppe_id") REFERENCES "timer"."lonnsgrupper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timer"."expense_category_lonnsgrupper" ADD CONSTRAINT "expense_category_lonnsgrupper_expense_category_id_fkey" FOREIGN KEY ("expense_category_id") REFERENCES "timer"."expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timer"."expense_category_lonnsgrupper" ADD CONSTRAINT "expense_category_lonnsgrupper_lonnsgruppe_id_fkey" FOREIGN KEY ("lonnsgruppe_id") REFERENCES "timer"."lonnsgrupper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Garanti: høyst én standardgruppe pr. firma (Prisma kan ikke uttrykke delvise indekser).
CREATE UNIQUE INDEX "uq_lonnsgruppe_en_standard_per_org" ON "timer"."lonnsgrupper"("organization_id") WHERE "er_standard";

-- ===========================================================================
-- Etterfylling 1: «Ordinær» (er_standard) for hvert firma som ikke har en standardgruppe.
-- WHERE NOT EXISTS → kan kjøres to ganger uten dobbeltrader.
-- ===========================================================================
INSERT INTO "timer"."lonnsgrupper" ("id", "organization_id", "navn", "aktiv", "rekkefolge", "er_standard", "created_at", "updated_at")
SELECT gen_random_uuid()::text, o."id", 'Ordinær', true, 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "public"."organizations" o
WHERE NOT EXISTS (
  SELECT 1 FROM "timer"."lonnsgrupper" g WHERE g."organization_id" = o."id" AND g."er_standard"
);

-- ===========================================================================
-- Etterfylling 2: én gruppe pr. firmamedlem (aktive OG deaktiverte) — firmaets standardgruppe.
-- satt_av_user_id = NULL betyr «satt av migreringen».
-- ===========================================================================
INSERT INTO "timer"."ansatt_lonnsgrupper" ("id", "organization_id", "user_id", "lonnsgruppe_id", "satt_av_user_id", "satt_ved")
SELECT gen_random_uuid()::text, m."organization_id", m."user_id", g."id", NULL, CURRENT_TIMESTAMP
FROM "public"."organization_members" m
JOIN "timer"."lonnsgrupper" g ON g."organization_id" = m."organization_id" AND g."er_standard"
WHERE NOT EXISTS (
  SELECT 1 FROM "timer"."ansatt_lonnsgrupper" a
  WHERE a."organization_id" = m."organization_id" AND a."user_id" = m."user_id"
);

-- Rapport til Kenneth (leses i migreringsloggen).
DO $$
DECLARE n_grupper bigint; n_ansatte bigint; n_uten_std bigint; n_uten_gruppe bigint;
BEGIN
  SELECT count(*) INTO n_grupper FROM "timer"."lonnsgrupper" WHERE "er_standard";
  SELECT count(*) INTO n_ansatte FROM "timer"."ansatt_lonnsgrupper";
  SELECT count(*) INTO n_uten_std FROM "public"."organizations" o
   WHERE NOT EXISTS (SELECT 1 FROM "timer"."lonnsgrupper" g WHERE g."organization_id" = o."id" AND g."er_standard");
  SELECT count(*) INTO n_uten_gruppe FROM "public"."organization_members" m
   WHERE NOT EXISTS (SELECT 1 FROM "timer"."ansatt_lonnsgrupper" a
                     WHERE a."organization_id" = m."organization_id" AND a."user_id" = m."user_id");
  RAISE NOTICE 'L1 lønnsgrupper: % standardgrupper, % ansatt-rader; firma uten standard = %, medlemmer uten gruppe = %',
    n_grupper, n_ansatte, n_uten_std, n_uten_gruppe;
  IF n_uten_std > 0 OR n_uten_gruppe > 0 THEN
    RAISE EXCEPTION 'L1 lønnsgrupper: etterfyllingen er ufullstendig (firma uten standard = %, medlemmer uten gruppe = %)', n_uten_std, n_uten_gruppe;
  END IF;
END $$;
