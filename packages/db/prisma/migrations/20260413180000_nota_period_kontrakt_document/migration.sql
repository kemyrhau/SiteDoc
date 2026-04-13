-- FtdSpecPost: legg til ikkeIBudsjett-flagg
ALTER TABLE "ftd_spec_posts" ADD COLUMN "ikke_i_budsjett" BOOLEAN NOT NULL DEFAULT false;

-- FtdNotaPeriod: legg til kontraktId (obligatorisk), documentId (obligatorisk), erSluttnota, gapFlagg
-- Tabellen er tom (0 rader), så NOT NULL er trygt uten default
ALTER TABLE "ftd_nota_periods" ADD COLUMN "kontrakt_id" TEXT NOT NULL;
ALTER TABLE "ftd_nota_periods" ADD COLUMN "document_id" TEXT NOT NULL;
ALTER TABLE "ftd_nota_periods" ADD COLUMN "er_sluttnota" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ftd_nota_periods" ADD COLUMN "gap_flagg" BOOLEAN NOT NULL DEFAULT false;

-- Foreign keys
ALTER TABLE "ftd_nota_periods"
  ADD CONSTRAINT "ftd_nota_periods_kontrakt_id_fkey"
  FOREIGN KEY ("kontrakt_id") REFERENCES "ftd_kontrakter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ftd_nota_periods"
  ADD CONSTRAINT "ftd_nota_periods_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "ftd_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Unique: én periode per kontrakt per periodeNr
CREATE UNIQUE INDEX "ftd_nota_period_kontrakt_nr"
  ON "ftd_nota_periods" ("kontrakt_id", "periode_nr");

-- Index for oppslag
CREATE INDEX "ftd_nota_periods_kontrakt_id_idx"
  ON "ftd_nota_periods" ("kontrakt_id");
