-- DWG-2 (D6, 2026-10-08, Kenneth-gatet rev. 2 Q1/Q3): layout-kobling uten duplikater +
-- revisjonsarkiv for DWG-layouts.
--
-- TRE NYE NULLABLE KOLONNER, ingen eksisterende kolonne droppes, ingen NOT NULL settes.
-- Additiv → to-stegs-policyen gjelder ikke. Reversibel: DROP COLUMN på de tre.
--   • drawings.parent_drawing_id  — layout-tegningens hovedtegning (modelspace). Svak FK
--     (ingen Prisma self-relasjon; kaskade-sletting av layouts gjøres i koden).
--   • drawings.layout_navn        — paper space-layoutens navn (kun på layout-rader).
--   • drawing_revisions.layouter  — JSONB [{layoutNavn, fileUrl}] arkivert ved revisjon.
--
-- «Stille tomhet» (Kenneth-regel):
--   (a) BACKFILL — eksisterende «Layout fra …»-rader kobles til hovedtegningen de deler
--       original_file_url med (se UPDATE under). NULL parent_drawing_id = HOVEDTEGNING, en
--       gyldig, entydig tilstand — kun layout-rader skal få parent satt.
--   (b) DB-GARANTI — indeks drawings_parent_drawing_id_idx. Ingen unik-krav i DB: koden
--       erstatter layout-rader på (parent_drawing_id, layout_navn) ved revisjon/«prøv igjen»
--       (DoD test 9), og eksisterende prod-duplikater (konverteringen feilet for alle DWG
--       før DWG-1) ryddes der, ikke av en unik-indeks som ville FEILET på dem.
--   (c) TEST — dwg-konvertering-layout.test.ts beviser at nye layouts bærer parentDrawingId
--       (DoD test 10) og at revisjon erstatter i stedet for å doble (DoD test 9).

-- AlterTable: layout-kobling + layout-navn på tegningen
ALTER TABLE "drawings" ADD COLUMN "parent_drawing_id" TEXT;
ALTER TABLE "drawings" ADD COLUMN "layout_navn" TEXT;

-- AlterTable: layout-arkiv på revisjonen
ALTER TABLE "drawing_revisions" ADD COLUMN "layouter" JSONB;

-- CreateIndex
CREATE INDEX "drawings_parent_drawing_id_idx" ON "drawings"("parent_drawing_id");

-- Backfill: koble eksisterende layout-rader til hovedtegningen (samme original_file_url).
-- original_file_url er en UUID-basert /uploads/-sti, i praksis unik pr. opplasting, så
-- koblingen er entydig. «Layout fra …»-rader uten original_file_url kan ikke kobles trygt
-- og forblir NULL (telles i melding 1 / verifiseres etter kjøring).
UPDATE "drawings" AS layout
SET "parent_drawing_id" = parent.id,
    "layout_navn" = layout.name
FROM "drawings" AS parent
WHERE layout.description LIKE 'Layout fra %'
  AND layout.parent_drawing_id IS NULL
  AND layout.original_file_url IS NOT NULL
  AND parent.id <> layout.id
  AND parent.project_id = layout.project_id
  AND parent.original_file_url = layout.original_file_url
  AND (parent.description IS NULL OR parent.description NOT LIKE 'Layout fra %');
