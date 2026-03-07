-- CreateTable
CREATE TABLE "workflow_step_members" (
    "id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "project_member_id" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_step_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workflow_step_members_workflow_id_project_member_id_step_key" ON "workflow_step_members"("workflow_id", "project_member_id", "step");

-- AddForeignKey
ALTER TABLE "workflow_step_members" ADD CONSTRAINT "workflow_step_members_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_members" ADD CONSTRAINT "workflow_step_members_project_member_id_fkey" FOREIGN KEY ("project_member_id") REFERENCES "project_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
