-- Timer-modul Fase 3 — Infrastruktur-commit
-- 7 Runde-1-tabeller i postgres-schema "timer"
-- Cross-package-FK håndteres som svake String-felt (samme mønster som db-maskin)

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "timer";

-- CreateTable
CREATE TABLE "timer"."lonnsarter" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "kode" TEXT,
    "navn" TEXT NOT NULL,
    "pris_mot_kunde" DECIMAL(12,2),
    "internkostnad" DECIMAL(12,2),
    "sats" DECIMAL(12,2),
    "sats_enhet" TEXT,
    "skal_eksporteres" BOOLEAN NOT NULL DEFAULT true,
    "tvungen_kommentar" BOOLEAN NOT NULL DEFAULT false,
    "rekkefolge" INTEGER NOT NULL DEFAULT 0,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "seed_nivaa" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lonnsarter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timer"."aktiviteter" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kode" TEXT,
    "navn" TEXT NOT NULL,
    "internkostnad" DECIMAL(12,2),
    "pris_mot_kunde" DECIMAL(12,2),
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "seed_nivaa" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aktiviteter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timer"."tillegg" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kode" TEXT,
    "navn" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "pris_mot_kunde" DECIMAL(12,2),
    "internkostnad" DECIMAL(12,2),
    "skal_eksporteres" BOOLEAN NOT NULL DEFAULT true,
    "tvungen_kommentar" BOOLEAN NOT NULL DEFAULT false,
    "rekkefolge" INTEGER NOT NULL DEFAULT 0,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "seed_nivaa" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tillegg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timer"."expense_categories" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "navn" TEXT NOT NULL,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timer"."daily_sheets" (
    "id" TEXT NOT NULL,
    "client_uuid" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "registrert_av_user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "aktivitet_id" TEXT NOT NULL,
    "avdeling_id" TEXT,
    "byggeplass_id" TEXT,
    "dato" DATE NOT NULL,
    "start_at" TIMESTAMPTZ,
    "end_at" TIMESTAMPTZ,
    "pause_min" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "beskrivelse" TEXT,
    "leder_kommentar" TEXT,
    "sync_status" TEXT NOT NULL DEFAULT 'synced',
    "synced_at" TIMESTAMPTZ,
    "attestert_av_user_id" TEXT,
    "attestert_ved" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "daily_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timer"."sheet_timer" (
    "id" TEXT NOT NULL,
    "sheet_id" TEXT NOT NULL,
    "lonnsart_id" TEXT NOT NULL,
    "external_cost_object_id" TEXT,
    "timer" DECIMAL(6,2) NOT NULL,
    "attestert_snapshot" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sheet_timer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timer"."sheet_tillegg" (
    "id" TEXT NOT NULL,
    "sheet_id" TEXT NOT NULL,
    "tillegg_id" TEXT NOT NULL,
    "antall" DECIMAL(6,2) NOT NULL,
    "kommentar" TEXT,
    "attestert_snapshot" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sheet_tillegg_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_lonnsart_kode_per_org" ON "timer"."lonnsarter"("organization_id", "kode");

-- CreateIndex
CREATE INDEX "lonnsarter_organization_id_aktiv_idx" ON "timer"."lonnsarter"("organization_id", "aktiv");

-- CreateIndex
CREATE UNIQUE INDEX "uq_aktivitet_kode_per_org" ON "timer"."aktiviteter"("organization_id", "kode");

-- CreateIndex
CREATE INDEX "aktiviteter_organization_id_aktiv_idx" ON "timer"."aktiviteter"("organization_id", "aktiv");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tillegg_kode_per_org" ON "timer"."tillegg"("organization_id", "kode");

-- CreateIndex
CREATE INDEX "tillegg_organization_id_aktiv_idx" ON "timer"."tillegg"("organization_id", "aktiv");

-- CreateIndex
CREATE INDEX "expense_categories_organization_id_idx" ON "timer"."expense_categories"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_sheets_client_uuid_key" ON "timer"."daily_sheets"("client_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "uq_dailysheet_user_project_dato" ON "timer"."daily_sheets"("user_id", "project_id", "dato");

-- CreateIndex
CREATE INDEX "daily_sheets_organization_id_idx" ON "timer"."daily_sheets"("organization_id");

-- CreateIndex
CREATE INDEX "daily_sheets_project_id_dato_idx" ON "timer"."daily_sheets"("project_id", "dato");

-- CreateIndex
CREATE INDEX "daily_sheets_organization_id_dato_idx" ON "timer"."daily_sheets"("organization_id", "dato");

-- CreateIndex
CREATE INDEX "daily_sheets_organization_id_status_idx" ON "timer"."daily_sheets"("organization_id", "status");

-- CreateIndex
CREATE INDEX "daily_sheets_attestert_av_user_id_attestert_ved_idx" ON "timer"."daily_sheets"("attestert_av_user_id", "attestert_ved");

-- CreateIndex
CREATE INDEX "daily_sheets_byggeplass_id_dato_idx" ON "timer"."daily_sheets"("byggeplass_id", "dato");

-- CreateIndex
CREATE INDEX "daily_sheets_avdeling_id_dato_idx" ON "timer"."daily_sheets"("avdeling_id", "dato");

-- CreateIndex
CREATE INDEX "daily_sheets_user_id_sync_status_idx" ON "timer"."daily_sheets"("user_id", "sync_status");

-- CreateIndex
CREATE INDEX "sheet_timer_sheet_id_idx" ON "timer"."sheet_timer"("sheet_id");

-- CreateIndex
CREATE INDEX "sheet_timer_lonnsart_id_idx" ON "timer"."sheet_timer"("lonnsart_id");

-- CreateIndex
CREATE INDEX "sheet_timer_external_cost_object_id_idx" ON "timer"."sheet_timer"("external_cost_object_id");

-- CreateIndex
CREATE INDEX "sheet_tillegg_sheet_id_idx" ON "timer"."sheet_tillegg"("sheet_id");

-- CreateIndex
CREATE INDEX "sheet_tillegg_tillegg_id_idx" ON "timer"."sheet_tillegg"("tillegg_id");

-- AddForeignKey
ALTER TABLE "timer"."daily_sheets" ADD CONSTRAINT "daily_sheets_aktivitet_id_fkey" FOREIGN KEY ("aktivitet_id") REFERENCES "timer"."aktiviteter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timer"."sheet_timer" ADD CONSTRAINT "sheet_timer_sheet_id_fkey" FOREIGN KEY ("sheet_id") REFERENCES "timer"."daily_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timer"."sheet_timer" ADD CONSTRAINT "sheet_timer_lonnsart_id_fkey" FOREIGN KEY ("lonnsart_id") REFERENCES "timer"."lonnsarter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timer"."sheet_tillegg" ADD CONSTRAINT "sheet_tillegg_sheet_id_fkey" FOREIGN KEY ("sheet_id") REFERENCES "timer"."daily_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timer"."sheet_tillegg" ADD CONSTRAINT "sheet_tillegg_tillegg_id_fkey" FOREIGN KEY ("tillegg_id") REFERENCES "timer"."tillegg"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
