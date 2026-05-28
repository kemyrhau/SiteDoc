-- CreateTable: TaskChangeLog (audit-trail for felt-endringer på oppgaver).
-- Speil av ChecklistChangeLog (`checklist_change_log`). Gjenbruker
-- `enableChangeLog`-flagget på ReportTemplate (felles for oppgave- og
-- sjekkliste-maler) — ingen schema-endring på malen. Skrives i samme
-- transaksjon som task.update via `tx.taskChangeLog.createMany` når
-- malen har flagget på.
CREATE TABLE "task_change_log" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "field_id" TEXT NOT NULL,
    "field_label" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_change_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_change_log_task_id_idx" ON "task_change_log"("task_id");

-- AddForeignKey
ALTER TABLE "task_change_log" ADD CONSTRAINT "task_change_log_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_change_log" ADD CONSTRAINT "task_change_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
