-- OrganizationIntegration: fleksibel integrasjonstabell per organisasjon
CREATE TABLE "organization_integrations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT,
    "api_key" TEXT,
    "config" JSONB,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_integrations_pkey" PRIMARY KEY ("id")
);

-- Enterprise → Organization (nullable)
ALTER TABLE "enterprises" ADD COLUMN "organization_id" TEXT;

-- Indekser
CREATE UNIQUE INDEX "organization_integrations_organization_id_type_key" ON "organization_integrations"("organization_id", "type");
CREATE INDEX "organization_integrations_organization_id_idx" ON "organization_integrations"("organization_id");
CREATE INDEX "enterprises_organization_id_idx" ON "enterprises"("organization_id");

-- Fremmednøkler
ALTER TABLE "organization_integrations" ADD CONSTRAINT "organization_integrations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "enterprises" ADD CONSTRAINT "enterprises_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
