-- Funn #2: SheetTilleggVedlegg — kvittering-/bilde-vedlegg på en tillegg-rad.
-- Flere vedlegg per rad. sheetTilleggId er svak FK uten Prisma @relation
-- (A.20 cross-modul-mønster). Lagring via /upload (fileUrl), ikke S3.
-- Ren additiv CREATE TABLE — ingen eksisterende tabell røres, ingen backfill.
CREATE TABLE "timer"."sheet_tillegg_vedlegg" (
    "id" TEXT NOT NULL,
    "sheet_tillegg_id" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "gps_lat" DOUBLE PRECISION,
    "gps_lng" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sheet_tillegg_vedlegg_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sheet_tillegg_vedlegg_sheet_tillegg_id_idx"
    ON "timer"."sheet_tillegg_vedlegg"("sheet_tillegg_id");
