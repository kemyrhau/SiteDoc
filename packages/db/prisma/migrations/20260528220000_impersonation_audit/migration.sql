-- CreateTable: ImpersonationAudit (persistent audit-spor for impersonering).
-- Variant B (isolert tabell) — erstatter console.log-mønsteret i
-- admin.startImpersonering/stoppImpersonering. sessionId lagres som ren string
-- (uten FK) slik at auditen overlever Session.delete().
CREATE TABLE "impersonation_audit" (
    "id" TEXT NOT NULL,
    "admin_user_id" TEXT NOT NULL,
    "target_user_id" TEXT NOT NULL,
    "target_organization_id" TEXT,
    "session_id" TEXT NOT NULL,
    "startet_ved" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "utloper_ved" TIMESTAMP(3) NOT NULL,
    "avsluttet_ved" TIMESTAMP(3),
    "avsluttet_grunn" TEXT,

    CONSTRAINT "impersonation_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "impersonation_audit_admin_user_id_idx" ON "impersonation_audit"("admin_user_id");
CREATE INDEX "impersonation_audit_target_user_id_idx" ON "impersonation_audit"("target_user_id");
CREATE INDEX "impersonation_audit_avsluttet_ved_idx" ON "impersonation_audit"("avsluttet_ved");

-- AddForeignKey
ALTER TABLE "impersonation_audit" ADD CONSTRAINT "impersonation_audit_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "impersonation_audit" ADD CONSTRAINT "impersonation_audit_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
