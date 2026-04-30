-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "maskin";

-- CreateTable
CREATE TABLE "maskin"."equipment" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kategori" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "merke" TEXT,
    "modell" TEXT,
    "intern_nummer" TEXT,
    "ansvarlig_user_id" TEXT,
    "lokasjon" TEXT,
    "anskaffelses_dato" DATE,
    "nypris" DECIMAL(12,2),
    "notater" TEXT,
    "bilder" JSONB,
    "status" TEXT NOT NULL DEFAULT 'tilgjengelig',
    "pensjonert_dato" DATE,
    "pensjonert_grunn" TEXT,
    "krev_daglig_kontroll" BOOLEAN NOT NULL DEFAULT false,
    "registreringsnummer" TEXT,
    "km_stand" INTEGER,
    "eu_kontroll_sist" DATE,
    "eu_kontroll_frist" DATE,
    "motor" TEXT,
    "drivstoff" TEXT,
    "forste_registrering" DATE,
    "egenvekt" INTEGER,
    "totalvekt" INTEGER,
    "farge" TEXT,
    "vegvesen_data" JSONB,
    "vegvesen_data_oppdatert" TIMESTAMP(3),
    "vegvesen_data_status" TEXT,
    "serienummer" TEXT,
    "driftstimer" INTEGER,
    "skuffe_kapasitet" DECIMAL(6,2),
    "loft_kapasitet" DECIMAL(6,2),
    "maks_vekt" INTEGER,
    "kalibrerings_dato" DATE,
    "kalibrerings_frist" DATE,
    "sertifiserings_dato" DATE,
    "sertifiserings_frist" DATE,
    "effekt_w" INTEGER,
    "vekt" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maskin"."equipment_assignments" (
    "id" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "tildelt_til" TEXT NOT NULL,
    "user_id" TEXT,
    "project_id" TEXT,
    "byggeplass_id" TEXT,
    "utlevert_dato" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "forventet_retur" DATE,
    "returnert_dato" TIMESTAMP(3),
    "utlevert_av_user_id" TEXT,
    "kommentar" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maskin"."service_records" (
    "id" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "dato" DATE NOT NULL,
    "km" INTEGER,
    "timer" INTEGER,
    "utfort_av" TEXT,
    "beskrivelse" TEXT NOT NULL,
    "kostnad" DECIMAL(12,2),
    "neste_service_dato" DATE,
    "neste_service_km" INTEGER,
    "neste_service_timer" INTEGER,
    "vedlegg" JSONB,
    "feilmelding_id" TEXT,
    "registrert_av_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maskin"."feilmeldinger" (
    "id" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "kategori" TEXT NOT NULL,
    "kommentar" TEXT,
    "bilder" JSONB,
    "meldt_av_user_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'aapen',
    "lukket_av" TEXT,
    "lukket_dato" TIMESTAMP(3),
    "lukket_av_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feilmeldinger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maskin"."vegvesen_ko" (
    "id" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "registreringsnummer" TEXT NOT NULL,
    "prioritet" INTEGER NOT NULL DEFAULT 100,
    "status" TEXT NOT NULL DEFAULT 'ventende',
    "forsok_antall" INTEGER NOT NULL DEFAULT 0,
    "sist_forsok" TIMESTAMP(3),
    "feilmelding" TEXT,
    "opprettet" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fullfort" TIMESTAMP(3),

    CONSTRAINT "vegvesen_ko_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "equipment_organization_id_idx" ON "maskin"."equipment"("organization_id");

-- CreateIndex
CREATE INDEX "equipment_kategori_idx" ON "maskin"."equipment"("kategori");

-- CreateIndex
CREATE INDEX "equipment_type_idx" ON "maskin"."equipment"("type");

-- CreateIndex
CREATE INDEX "equipment_status_idx" ON "maskin"."equipment"("status");

-- CreateIndex
CREATE INDEX "equipment_ansvarlig_user_id_idx" ON "maskin"."equipment"("ansvarlig_user_id");

-- CreateIndex
CREATE INDEX "equipment_eu_kontroll_frist_idx" ON "maskin"."equipment"("eu_kontroll_frist");

-- CreateIndex
CREATE INDEX "equipment_kalibrerings_frist_idx" ON "maskin"."equipment"("kalibrerings_frist");

-- CreateIndex
CREATE INDEX "equipment_sertifiserings_frist_idx" ON "maskin"."equipment"("sertifiserings_frist");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_organization_id_intern_nummer_key" ON "maskin"."equipment"("organization_id", "intern_nummer");

-- CreateIndex
CREATE UNIQUE INDEX "uq_equipment_regnummer" ON "maskin"."equipment"("registreringsnummer");

-- CreateIndex
CREATE INDEX "equipment_assignments_equipment_id_idx" ON "maskin"."equipment_assignments"("equipment_id");

-- CreateIndex
CREATE INDEX "equipment_assignments_user_id_idx" ON "maskin"."equipment_assignments"("user_id");

-- CreateIndex
CREATE INDEX "equipment_assignments_project_id_idx" ON "maskin"."equipment_assignments"("project_id");

-- CreateIndex
CREATE INDEX "equipment_assignments_byggeplass_id_idx" ON "maskin"."equipment_assignments"("byggeplass_id");

-- CreateIndex
CREATE INDEX "equipment_assignments_returnert_dato_idx" ON "maskin"."equipment_assignments"("returnert_dato");

-- CreateIndex
CREATE INDEX "service_records_equipment_id_dato_idx" ON "maskin"."service_records"("equipment_id", "dato");

-- CreateIndex
CREATE INDEX "service_records_type_idx" ON "maskin"."service_records"("type");

-- CreateIndex
CREATE INDEX "service_records_neste_service_dato_idx" ON "maskin"."service_records"("neste_service_dato");

-- CreateIndex
CREATE INDEX "feilmeldinger_equipment_id_status_idx" ON "maskin"."feilmeldinger"("equipment_id", "status");

-- CreateIndex
CREATE INDEX "feilmeldinger_status_idx" ON "maskin"."feilmeldinger"("status");

-- CreateIndex
CREATE INDEX "feilmeldinger_created_at_idx" ON "maskin"."feilmeldinger"("created_at");

-- CreateIndex
CREATE INDEX "vegvesen_ko_status_prioritet_opprettet_idx" ON "maskin"."vegvesen_ko"("status", "prioritet", "opprettet");

-- CreateIndex
CREATE INDEX "vegvesen_ko_equipment_id_idx" ON "maskin"."vegvesen_ko"("equipment_id");

-- AddForeignKey
ALTER TABLE "maskin"."equipment_assignments" ADD CONSTRAINT "equipment_assignments_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "maskin"."equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maskin"."service_records" ADD CONSTRAINT "service_records_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "maskin"."equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maskin"."service_records" ADD CONSTRAINT "service_records_feilmelding_id_fkey" FOREIGN KEY ("feilmelding_id") REFERENCES "maskin"."feilmeldinger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maskin"."feilmeldinger" ADD CONSTRAINT "feilmeldinger_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "maskin"."equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maskin"."vegvesen_ko" ADD CONSTRAINT "vegvesen_ko_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "maskin"."equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

