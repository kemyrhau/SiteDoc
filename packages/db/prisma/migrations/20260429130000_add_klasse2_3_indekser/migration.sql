-- Klasse 2 (varsling/frist) + Klasse 3 (status-filtrering) per C.15
-- (oppryddings-plan-2026-04-28.md). Manuelt opprettet 2026-04-29 — lokal-DB
-- mangler pgvector-extension. Verifiseres ved test-DB-deploy.

-- =========================================================================
-- KLASSE 2 — Varsling + frist
-- =========================================================================

-- Project: trial-utløp-varsling
-- CreateIndex
CREATE INDEX "projects_trial_expires_at_idx" ON "projects"("trial_expires_at");

-- Checklist: dueDate brukes for varsling om kommende frister
-- CreateIndex
CREATE INDEX "checklists_due_date_idx" ON "checklists"("due_date");

-- Task: dueDate brukes for varsling om kommende frister
-- CreateIndex
CREATE INDEX "tasks_due_date_idx" ON "tasks"("due_date");

-- ProjectInvitation: expiresAt for utløpte invitasjoner-rens
-- CreateIndex
CREATE INDEX "project_invitations_expires_at_idx" ON "project_invitations"("expires_at");

-- KontrollplanPunkt: composite (fristUke, fristAar) for frist-baserte spørringer
-- CreateIndex
CREATE INDEX "kontrollplan_punkter_frist_uke_frist_aar_idx" ON "kontrollplan_punkter"("frist_uke", "frist_aar");

-- =========================================================================
-- KLASSE 3 — Status-filtrering (hyppige WHERE status = ...)
-- =========================================================================

-- Checklist: status-filter (draft/sent/accepted etc.)
-- CreateIndex
CREATE INDEX "checklists_status_idx" ON "checklists"("status");

-- Task: status-filter
-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- Drawing: status-filter (utkast/delt/godkjent/etc.)
-- CreateIndex
CREATE INDEX "drawings_status_idx" ON "drawings"("status");

-- Byggeplass: status-filter (unpublished/published)
-- CreateIndex
CREATE INDEX "byggeplasser_status_idx" ON "byggeplasser"("status");

-- FtdDocument: processingState-filter (pending/processing/done/failed)
-- CreateIndex
CREATE INDEX "ftd_documents_processing_state_idx" ON "ftd_documents"("processing_state");

-- =========================================================================
-- EKSTRA COMPOSITE — hyppige kombinasjoner
-- =========================================================================

-- Checklist: dokumentflyt + status (finn drafts/sent per flyt)
-- CreateIndex
CREATE INDEX "checklists_dokumentflyt_id_status_idx" ON "checklists"("dokumentflyt_id", "status");

-- Task: dokumentflyt + status (samme mønster)
-- CreateIndex
CREATE INDEX "tasks_dokumentflyt_id_status_idx" ON "tasks"("dokumentflyt_id", "status");

-- ProjectInvitation: project + status (pending invitasjoner per prosjekt)
-- CreateIndex
CREATE INDEX "project_invitations_project_id_status_idx" ON "project_invitations"("project_id", "status");
