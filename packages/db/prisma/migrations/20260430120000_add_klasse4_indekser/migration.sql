-- Klasse 4 (lavere prioritet) per C.15 (oppryddings-plan-2026-04-28.md).
-- Manuelt opprettet — lokal-DB mangler pgvector-extension. Verifiseres ved
-- test-DB-deploy.
--
-- Note om hoppede indekser: Følgende ble spesifisert av Kenneth, men hoppet
-- over som redundante (composite-unique-prefix dekker allerede spørringen):
--   - FolderAccess(folderId)         — @@unique([folderId, accessType, ...])
--   - DokumentflytMedlem(dokumentflytId) — @@unique([dokumentflytId, ...]) x3
--   - ProjectModule(projectId)       — @@unique([projectId, moduleSlug])
--   - FtdTnotaChangeLink(tnotaDocumentId) — @@unique([tnotaDocumentId, changeEventId])
--   - FtdTranslationJob(documentId)  — @@unique([documentId, targetLang])
--   - TranslationCache(contentHash, sourceLang, targetLang) — identisk @@unique
--   - Psi(projectId)                 — @@unique([projectId, byggeplassId])
--
-- DokumentflytMedlem.userId hoppet over fordi feltet ikke finnes — bruker
-- projectMemberId i stedet (logisk samme behov: User → DokumentflytMedlem
-- via ProjectMember).

-- =========================================================================
-- FolderAccess
-- =========================================================================

-- CreateIndex
CREATE INDEX "folder_access_user_id_idx" ON "folder_access"("user_id");

-- CreateIndex
CREATE INDEX "folder_access_faggruppe_id_idx" ON "folder_access"("faggruppe_id");

-- CreateIndex
CREATE INDEX "folder_access_group_id_idx" ON "folder_access"("group_id");

-- =========================================================================
-- Dokumentflyt
-- =========================================================================

-- CreateIndex
CREATE INDEX "dokumentflyter_project_id_idx" ON "dokumentflyter"("project_id");

-- CreateIndex
CREATE INDEX "dokumentflyter_faggruppe_id_idx" ON "dokumentflyter"("faggruppe_id");

-- =========================================================================
-- DokumentflytMedlem (userId → projectMemberId)
-- =========================================================================

-- CreateIndex
CREATE INDEX "dokumentflyt_medlemmer_project_member_id_idx" ON "dokumentflyt_medlemmer"("project_member_id");

-- CreateIndex
CREATE INDEX "dokumentflyt_medlemmer_faggruppe_id_idx" ON "dokumentflyt_medlemmer"("faggruppe_id");

-- CreateIndex
CREATE INDEX "dokumentflyt_medlemmer_group_id_idx" ON "dokumentflyt_medlemmer"("group_id");

-- =========================================================================
-- Image
-- =========================================================================

-- CreateIndex
CREATE INDEX "images_checklist_id_idx" ON "images"("checklist_id");

-- CreateIndex
CREATE INDEX "images_task_id_idx" ON "images"("task_id");

-- =========================================================================
-- FtdTnotaChangeLink
-- =========================================================================

-- CreateIndex
CREATE INDEX "ftd_tnota_change_links_change_event_id_idx" ON "ftd_tnota_change_links"("change_event_id");

-- =========================================================================
-- FtdTranslationJob
-- =========================================================================

-- CreateIndex
CREATE INDEX "ftd_translation_jobs_status_idx" ON "ftd_translation_jobs"("status");

-- =========================================================================
-- FtdNotaComment
-- =========================================================================

-- CreateIndex
CREATE INDEX "ftd_nota_comments_spec_post_id_idx" ON "ftd_nota_comments"("spec_post_id");

-- CreateIndex
CREATE INDEX "ftd_nota_comments_period_id_idx" ON "ftd_nota_comments"("period_id");

-- =========================================================================
-- Psi
-- =========================================================================

-- CreateIndex
CREATE INDEX "psi_byggeplass_id_idx" ON "psi"("byggeplass_id");
