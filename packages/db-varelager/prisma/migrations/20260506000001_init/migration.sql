-- Vareforbruk-modul Steg 4b — Fase 1 (Schema-init)
-- 3 tabeller i postgres-schema "varelager":
--   * vare_kategorier  — firma-definert kategori (Beslutning 8)
--   * varer            — firma-katalog over forbruksvarer
--   * vareforbruk      — prosjekt-transaksjon
-- Cross-package-FK håndteres som svake String-felt (samme mønster som db-timer/db-maskin).

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "varelager";

-- CreateTable
CREATE TABLE "varelager"."vare_kategorier" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "navn" TEXT NOT NULL,
    "kontonummer" TEXT,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "vare_kategorier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "varelager"."varer" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "navn" TEXT NOT NULL,
    "varenummer" TEXT,
    "enhet" TEXT NOT NULL,
    "pris" DECIMAL(12,2),
    "internkostnad" DECIMAL(12,2),
    "kategori_id" TEXT,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "varer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "varelager"."vareforbruk" (
    "id" TEXT NOT NULL,
    "dato" DATE NOT NULL,
    "project_id" TEXT NOT NULL,
    "byggeplass_id" TEXT,
    "external_cost_object_id" TEXT,
    "vare_id" TEXT NOT NULL,
    "antall" DECIMAL(12,2) NOT NULL,
    "registrert_av_user_id" TEXT NOT NULL,
    "kommentar" TEXT,
    "dagsseddel_id" TEXT,
    "attestert_snapshot" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "vareforbruk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vare_kategorier_organization_id_navn_key" ON "varelager"."vare_kategorier"("organization_id", "navn");

-- CreateIndex
CREATE INDEX "vare_kategorier_organization_id_aktiv_idx" ON "varelager"."vare_kategorier"("organization_id", "aktiv");

-- CreateIndex
CREATE UNIQUE INDEX "varer_organization_id_varenummer_key" ON "varelager"."varer"("organization_id", "varenummer");

-- CreateIndex
CREATE INDEX "varer_organization_id_aktiv_idx" ON "varelager"."varer"("organization_id", "aktiv");

-- CreateIndex
CREATE INDEX "varer_kategori_id_idx" ON "varelager"."varer"("kategori_id");

-- CreateIndex
CREATE INDEX "vareforbruk_project_id_dato_idx" ON "varelager"."vareforbruk"("project_id", "dato");

-- CreateIndex
CREATE INDEX "vareforbruk_dagsseddel_id_idx" ON "varelager"."vareforbruk"("dagsseddel_id");

-- CreateIndex
CREATE INDEX "vareforbruk_external_cost_object_id_idx" ON "varelager"."vareforbruk"("external_cost_object_id");

-- CreateIndex
CREATE INDEX "vareforbruk_vare_id_idx" ON "varelager"."vareforbruk"("vare_id");

-- AddForeignKey
ALTER TABLE "varelager"."varer" ADD CONSTRAINT "varer_kategori_id_fkey" FOREIGN KEY ("kategori_id") REFERENCES "varelager"."vare_kategorier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "varelager"."vareforbruk" ADD CONSTRAINT "vareforbruk_vare_id_fkey" FOREIGN KEY ("vare_id") REFERENCES "varelager"."varer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
