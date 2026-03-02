-- AlterTable
ALTER TABLE "checklists" ADD COLUMN     "building_id" TEXT,
ADD COLUMN     "drawing_id" TEXT,
ADD COLUMN     "subject" TEXT,
ADD COLUMN     "workflow_id" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "workflow_id" TEXT;

-- AddForeignKey
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_drawing_id_fkey" FOREIGN KEY ("drawing_id") REFERENCES "drawings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;
