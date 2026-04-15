-- Ytelsesindekser for list-queries og firmaansvarlig-filter
CREATE INDEX idx_tasks_template ON tasks(template_id);
CREATE INDEX idx_tasks_bestiller_user ON tasks(bestiller_user_id);
CREATE INDEX idx_tasks_recipient_user ON tasks(recipient_user_id);
CREATE INDEX idx_checklists_template ON checklists(template_id);
CREATE INDEX idx_checklists_bestiller_user ON checklists(bestiller_user_id);
CREATE INDEX idx_checklists_recipient_user ON checklists(recipient_user_id);
CREATE INDEX idx_document_transfers_sender ON document_transfers(sender_id);
CREATE INDEX idx_users_organization ON users(organization_id);
