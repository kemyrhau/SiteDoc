-- PSI (Prosjektspesifikk Sikkerhetsinstruks)

CREATE TABLE "psi" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "psi_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "psi_signaturer" (
    "id" TEXT NOT NULL,
    "psi_id" TEXT NOT NULL,
    "psi_version" INTEGER NOT NULL,
    "user_id" TEXT,
    "guest_name" TEXT,
    "guest_company" TEXT,
    "guest_phone" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "signature_data" TEXT,
    "language" TEXT NOT NULL DEFAULT 'nb',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "psi_signaturer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "psi_project_id_key" ON "psi"("project_id");
CREATE UNIQUE INDEX "psi_signaturer_psi_id_user_id_key" ON "psi_signaturer"("psi_id", "user_id");
CREATE INDEX "psi_signaturer_psi_id_idx" ON "psi_signaturer"("psi_id");

ALTER TABLE "psi" ADD CONSTRAINT "psi_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "psi" ADD CONSTRAINT "psi_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "report_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "psi_signaturer" ADD CONSTRAINT "psi_signaturer_psi_id_fkey" FOREIGN KEY ("psi_id") REFERENCES "psi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "psi_signaturer" ADD CONSTRAINT "psi_signaturer_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
