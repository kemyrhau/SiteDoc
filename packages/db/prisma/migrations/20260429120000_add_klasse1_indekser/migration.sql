-- Klasse 1-indekser per C.15 (oppryddings-plan-2026-04-28.md)
-- Manuelt opprettet 2026-04-29 — lokal-DB mangler pgvector-extension så
-- prisma migrate dev kunne ikke validere mot shadow DB. Indeksene er enkle
-- CREATE INDEX-statements; verifiseres ved test-DB-deploy.

-- Session: FK userId — sesjonoppslag ved hver login
-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- Account: FK userId — OAuth-tilkobling per bruker
-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- OrganizationIntegration: FK organizationId — integrasjons-oppslag per firma
-- CreateIndex
CREATE INDEX "organization_integrations_organization_id_idx" ON "organization_integrations"("organization_id");

-- Faggruppe (dokumentflyt_parts): 3 FK — sentral i dokumentflyt + prosjekt-isolering
-- CreateIndex
CREATE INDEX "dokumentflyt_parts_project_id_idx" ON "dokumentflyt_parts"("project_id");

-- CreateIndex
CREATE INDEX "dokumentflyt_parts_kontrakt_id_idx" ON "dokumentflyt_parts"("kontrakt_id");

-- CreateIndex
CREATE INDEX "dokumentflyt_parts_ansvarlig_id_idx" ON "dokumentflyt_parts"("ansvarlig_id");

-- Drawing: FK projectId + byggeplassId — tegnings-oppslag per prosjekt/byggeplass
-- CreateIndex
CREATE INDEX "drawings_project_id_idx" ON "drawings"("project_id");

-- CreateIndex
CREATE INDEX "drawings_byggeplass_id_idx" ON "drawings"("byggeplass_id");

-- PointCloud: FK projectId + byggeplassId — punktsky-oppslag per prosjekt/byggeplass
-- CreateIndex
CREATE INDEX "point_clouds_project_id_idx" ON "point_clouds"("project_id");

-- CreateIndex
CREATE INDEX "point_clouds_byggeplass_id_idx" ON "point_clouds"("byggeplass_id");

-- DrawingRevision: FK drawingId + uploadedById — revisjonshistorikk
-- CreateIndex
CREATE INDEX "drawing_revisions_drawing_id_idx" ON "drawing_revisions"("drawing_id");

-- CreateIndex
CREATE INDEX "drawing_revisions_uploaded_by_id_idx" ON "drawing_revisions"("uploaded_by_id");

-- ProjectGroupMember: FK projectMemberId (groupId allerede i unique-constraint)
-- CreateIndex
CREATE INDEX "project_group_members_project_member_id_idx" ON "project_group_members"("project_member_id");

-- GroupFaggruppe: FK faggruppeId (groupId allerede dekt av unique-constraint)
-- Composite (groupId, faggruppeId) er redundant siden @@unique([groupId, faggruppeId])
-- allerede oppretter B-tree-index. Singular @@index([faggruppeId]) gir spørringer
-- som filtrerer KUN på faggruppeId (f.eks. "hvilke grupper er tilknyttet faggruppe X").
-- CreateIndex
CREATE INDEX "group_faggrupper_faggruppe_id_idx" ON "group_faggrupper"("faggruppe_id");
