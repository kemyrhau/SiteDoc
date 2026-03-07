-- AlterTable
ALTER TABLE "users" ADD COLUMN     "organization_id" TEXT;

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization_number" TEXT,
    "invoice_address" TEXT,
    "invoice_email" TEXT,
    "ehf_enabled" BOOLEAN NOT NULL DEFAULT false,
    "logo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_projects" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_projects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_projects_organization_id_project_id_key" ON "organization_projects"("organization_id", "project_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_projects" ADD CONSTRAINT "organization_projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_projects" ADD CONSTRAINT "organization_projects_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
