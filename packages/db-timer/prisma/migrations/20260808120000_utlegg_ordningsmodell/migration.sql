-- U1 — Utleggs-ordningsmodell (2026-08-08). REN ADDITIV migrering.
-- Ingen eksisterende data flyttes, ingen kolonner slettes (to-stegs-policy).
--
-- Innhold:
--   1) ExpenseCategory.ordning  (firma-default: "sats"|"utlegg"|"fakturert")
--   2) SheetUtlegg              (utleggs-/fakturert-bærer, m/ CHECK-integritet)
--   3) SheetUtleggVedlegg       (speil av sheet_tillegg_vedlegg)
--   4) ProsjektOrdningOverstyring (firma-admin overstyrer ordning per prosjekt+kategori)
--
-- Enum-verdiene håndheves av DB-CHECK i tillegg til app-lag (@sitedoc/shared
-- erGyldigOrdning). Beløps-regelen står på radens EGET stempel
-- (ordning_ved_foering), aldri på et kategori-oppslag som kan drifte.

-- ---------------------------------------------------------------------------
-- 1) ExpenseCategory.ordning — additiv kolonne m/ trygg default.
-- ---------------------------------------------------------------------------
ALTER TABLE "timer"."expense_categories"
    ADD COLUMN "ordning" TEXT NOT NULL DEFAULT 'utlegg';

ALTER TABLE "timer"."expense_categories"
    ADD CONSTRAINT "expense_categories_ordning_check"
    CHECK ("ordning" IN ('sats', 'utlegg', 'fakturert'));

-- ---------------------------------------------------------------------------
-- 2) SheetUtlegg — egen bærer. projectId er svak FK → projects (kjernen),
--    ingen Prisma @relation (A.20 cross-modul-mønster).
-- ---------------------------------------------------------------------------
CREATE TABLE "timer"."sheet_utlegg" (
    "id" TEXT NOT NULL,
    "sheet_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "expense_category_id" TEXT NOT NULL,
    "belop" DECIMAL(10,2),
    "mva_sats" DECIMAL(5,2),
    "kommentar" TEXT,
    "ordning_ved_foering" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sheet_utlegg_pkey" PRIMARY KEY ("id")
);

-- Lukket enum på stempelet.
ALTER TABLE "timer"."sheet_utlegg"
    ADD CONSTRAINT "sheet_utlegg_ordning_ved_foering_check"
    CHECK ("ordning_ved_foering" IN ('sats', 'utlegg', 'fakturert'));

-- INTEGRITETSKJERNEN (ordrett fra spec): beløp bæres av alt annet enn
-- fakturert; fakturert kan ALDRI ha beløp. Håndheves i DB, ikke bare app.
ALTER TABLE "timer"."sheet_utlegg"
    ADD CONSTRAINT "sheet_utlegg_belop_ordning_check"
    CHECK (
        ("ordning_ved_foering" = 'fakturert' AND "belop" IS NULL)
        OR ("ordning_ved_foering" <> 'fakturert' AND "belop" IS NOT NULL)
    );

CREATE INDEX "sheet_utlegg_sheet_id_idx" ON "timer"."sheet_utlegg"("sheet_id");
CREATE INDEX "sheet_utlegg_project_id_idx" ON "timer"."sheet_utlegg"("project_id");
CREATE INDEX "sheet_utlegg_expense_category_id_idx" ON "timer"."sheet_utlegg"("expense_category_id");

ALTER TABLE "timer"."sheet_utlegg"
    ADD CONSTRAINT "sheet_utlegg_sheet_id_fkey"
    FOREIGN KEY ("sheet_id") REFERENCES "timer"."daily_sheets"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "timer"."sheet_utlegg"
    ADD CONSTRAINT "sheet_utlegg_expense_category_id_fkey"
    FOREIGN KEY ("expense_category_id") REFERENCES "timer"."expense_categories"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 3) SheetUtleggVedlegg — speil av sheet_tillegg_vedlegg (svak FK, ingen @relation).
-- ---------------------------------------------------------------------------
CREATE TABLE "timer"."sheet_utlegg_vedlegg" (
    "id" TEXT NOT NULL,
    "sheet_utlegg_id" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "gps_lat" DOUBLE PRECISION,
    "gps_lng" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sheet_utlegg_vedlegg_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sheet_utlegg_vedlegg_sheet_utlegg_id_idx"
    ON "timer"."sheet_utlegg_vedlegg"("sheet_utlegg_id");

-- ---------------------------------------------------------------------------
-- 4) ProsjektOrdningOverstyring — prosjektId svak FK → projects (kjernen).
-- ---------------------------------------------------------------------------
CREATE TABLE "timer"."prosjekt_ordning_overstyring" (
    "id" TEXT NOT NULL,
    "prosjekt_id" TEXT NOT NULL,
    "expense_category_id" TEXT NOT NULL,
    "ordning" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "prosjekt_ordning_overstyring_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "timer"."prosjekt_ordning_overstyring"
    ADD CONSTRAINT "prosjekt_ordning_overstyring_ordning_check"
    CHECK ("ordning" IN ('sats', 'utlegg', 'fakturert'));

CREATE UNIQUE INDEX "uq_overstyring_prosjekt_kategori"
    ON "timer"."prosjekt_ordning_overstyring"("prosjekt_id", "expense_category_id");

CREATE INDEX "prosjekt_ordning_overstyring_expense_category_id_idx"
    ON "timer"."prosjekt_ordning_overstyring"("expense_category_id");

ALTER TABLE "timer"."prosjekt_ordning_overstyring"
    ADD CONSTRAINT "prosjekt_ordning_overstyring_expense_category_id_fkey"
    FOREIGN KEY ("expense_category_id") REFERENCES "timer"."expense_categories"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
