-- F0 Soft-delete / 90-dagers papirkurv.
-- Additiv, nullable (to-stegs migrasjons-policy steg 1): legg til deletedAt/deletedById
-- på checklists + tasks. Ingen DROP/rename. Guard-filteret `deleted_at IS NULL`
-- skjuler slettede rader fra alle lister; papirkurv-visningen er inversen.
-- deleted_by_id er svakt TEXT-felt uten FK (bevisst — ingen relasjon til users).

ALTER TABLE "checklists" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "checklists" ADD COLUMN "deleted_by_id" TEXT;

ALTER TABLE "tasks" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "tasks" ADD COLUMN "deleted_by_id" TEXT;

-- Delindeks for papirkurv-spørring (kun rader med deleted_at satt) og for guard-filter.
CREATE INDEX "checklists_deleted_at_idx" ON "checklists"("deleted_at");
CREATE INDEX "tasks_deleted_at_idx" ON "tasks"("deleted_at");
