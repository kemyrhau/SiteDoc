-- Byggeplass følger dokumentet (ORDRE 28, 2026-11-06, Kenneth-hjemmel etter prod-feil BEF-029).
--
-- ADDITIV og NULLABLE. Én ny kolonne `tasks.byggeplass_id` med FK til byggeplasser og
-- ON DELETE SET NULL, speilet etter `checklists.byggeplass_id`. Ingen kolonne droppes, ingen
-- settes NOT NULL, ingen rad slettes. Reversibel i praksis: DROP COLUMN gjenoppretter forrige
-- tilstand (backfill-verdien kan alltid utledes på nytt fra tegningen).
--
-- «Stille tomhet» (Kenneth-regel):
--   (a) BACKFILL — fra tegningen, med diskriminerende WHERE: kun rader UTEN egen byggeplass
--       og MED en tegning som selv har byggeplass. Oppgaver uten tegning eller på en
--       prosjekt-tegning har ingen kilde og forblir NULL = «gjelder hele prosjektet» — samme
--       tilhørighet som filteret ga dem før (byggeplassFilter.ts).
--   (b) GARANTI — tilhørighet er fortsatt valgfri (NULL er gyldig). Lesing faller tilbake til
--       tegningens byggeplass (byggeplassFilterViaTegning), så en rad backfillen ikke rakk
--       mister ikke tilhørigheten.
--   (c) TEST — prisma/task-byggeplass-migrering.test.ts (db) låser additiv + SET NULL + backfill-WHERE;
--       task-byggeplass.integration.test.ts (api) kjører backfillen mot ekte DB.

-- AlterTable: additiv nullable byggeplass-referanse
ALTER TABLE "tasks" ADD COLUMN "byggeplass_id" TEXT;

-- AddForeignKey: ON DELETE SET NULL (som checklists.byggeplass_id)
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_byggeplass_id_fkey" FOREIGN KEY ("byggeplass_id") REFERENCES "byggeplasser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex: byggeplass-filter i lister/KPI
CREATE INDEX "tasks_byggeplass_id_idx" ON "tasks"("byggeplass_id");

-- Backfill: arv tegningens byggeplass der oppgaven ikke har egen.
UPDATE "tasks" AS t
SET "byggeplass_id" = d."byggeplass_id"
FROM "drawings" AS d
WHERE t."byggeplass_id" IS NULL
  AND t."drawing_id" IS NOT NULL
  AND t."drawing_id" = d."id"
  AND d."byggeplass_id" IS NOT NULL;
