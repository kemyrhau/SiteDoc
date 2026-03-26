-- Mottaker på sjekklister
ALTER TABLE "checklists" ADD COLUMN "recipient_user_id" TEXT;
ALTER TABLE "checklists" ADD COLUMN "recipient_group_id" TEXT;
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_recipient_group_id_fkey" FOREIGN KEY ("recipient_group_id") REFERENCES "project_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Mottaker på oppgaver
ALTER TABLE "tasks" ADD COLUMN "recipient_user_id" TEXT;
ALTER TABLE "tasks" ADD COLUMN "recipient_group_id" TEXT;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_recipient_group_id_fkey" FOREIGN KEY ("recipient_group_id") REFERENCES "project_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Mottaker på overføringer
ALTER TABLE "document_transfers" ADD COLUMN "recipient_user_id" TEXT;
ALTER TABLE "document_transfers" ADD COLUMN "recipient_group_id" TEXT;
ALTER TABLE "document_transfers" ADD CONSTRAINT "document_transfers_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "document_transfers" ADD CONSTRAINT "document_transfers_recipient_group_id_fkey" FOREIGN KEY ("recipient_group_id") REFERENCES "project_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
