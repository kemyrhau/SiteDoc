-- Signaturrunder (SJA/HMS) — «hvem har signert, hvem mangler» på gjenbrukt SJA.
-- Fabel-ordre 2026-09-06. Rent additiv (to-stegs-policy): kun CREATE, ingen DROP.
-- Vei 2: to nullbare FK-er (checklist_id XOR task_id) med onDelete: Cascade.
-- XOR-guard håndheves med CHECK-constraints nederst.

-- CreateTable
CREATE TABLE "signatur_runder" (
    "id" TEXT NOT NULL,
    "checklist_id" TEXT,
    "task_id" TEXT,
    "runde_nr" INTEGER NOT NULL,
    "startet_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startet_av" TEXT NOT NULL,
    "avsluttet_at" TIMESTAMP(3),
    "avsluttet_av" TEXT,
    "aarsak" TEXT,
    "antall_deltakere" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signatur_runder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dokument_deltakere" (
    "id" TEXT NOT NULL,
    "checklist_id" TEXT,
    "task_id" TEXT,
    "user_id" TEXT,
    "guest_name" TEXT,
    "guest_company" TEXT,
    "guest_phone" TEXT,
    "lagt_til_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lagt_til_av" TEXT NOT NULL,
    "fjernet_at" TIMESTAMP(3),
    "fjernet_av" TEXT,

    CONSTRAINT "dokument_deltakere_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dokument_signaturer" (
    "id" TEXT NOT NULL,
    "runde_id" TEXT NOT NULL,
    "deltaker_id" TEXT NOT NULL,
    "hms_kort_nr" TEXT,
    "har_ikke_hms_kort" BOOLEAN NOT NULL DEFAULT false,
    "signaturbilde" TEXT,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signert_tidspunkt" TEXT,

    CONSTRAINT "dokument_signaturer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "signatur_runder_checklist_id_idx" ON "signatur_runder"("checklist_id");

-- CreateIndex
CREATE INDEX "signatur_runder_task_id_idx" ON "signatur_runder"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "signatur_runder_checklist_id_runde_nr_key" ON "signatur_runder"("checklist_id", "runde_nr");

-- CreateIndex
CREATE UNIQUE INDEX "signatur_runder_task_id_runde_nr_key" ON "signatur_runder"("task_id", "runde_nr");

-- CreateIndex
CREATE INDEX "dokument_deltakere_checklist_id_idx" ON "dokument_deltakere"("checklist_id");

-- CreateIndex
CREATE INDEX "dokument_deltakere_task_id_idx" ON "dokument_deltakere"("task_id");

-- CreateIndex
CREATE INDEX "dokument_deltakere_user_id_idx" ON "dokument_deltakere"("user_id");

-- CreateIndex
CREATE INDEX "dokument_signaturer_runde_id_idx" ON "dokument_signaturer"("runde_id");

-- CreateIndex
CREATE INDEX "dokument_signaturer_deltaker_id_idx" ON "dokument_signaturer"("deltaker_id");

-- CreateIndex
CREATE UNIQUE INDEX "dokument_signaturer_runde_id_deltaker_id_key" ON "dokument_signaturer"("runde_id", "deltaker_id");

-- AddForeignKey
ALTER TABLE "signatur_runder" ADD CONSTRAINT "signatur_runder_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatur_runder" ADD CONSTRAINT "signatur_runder_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dokument_deltakere" ADD CONSTRAINT "dokument_deltakere_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dokument_deltakere" ADD CONSTRAINT "dokument_deltakere_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dokument_deltakere" ADD CONSTRAINT "dokument_deltakere_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dokument_signaturer" ADD CONSTRAINT "dokument_signaturer_runde_id_fkey" FOREIGN KEY ("runde_id") REFERENCES "signatur_runder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dokument_signaturer" ADD CONSTRAINT "dokument_signaturer_deltaker_id_fkey" FOREIGN KEY ("deltaker_id") REFERENCES "dokument_deltakere"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- XOR-guard: nøyaktig én dokument-FK satt (SJA=Checklist XOR avvik/RUH=Task).
-- Prisma modellerer ikke CHECK i schemaet; håndheves her på DB-nivå.
ALTER TABLE "signatur_runder" ADD CONSTRAINT "signatur_runder_dokument_xor"
    CHECK ((("checklist_id" IS NOT NULL)::int + ("task_id" IS NOT NULL)::int) = 1);

ALTER TABLE "dokument_deltakere" ADD CONSTRAINT "dokument_deltakere_dokument_xor"
    CHECK ((("checklist_id" IS NOT NULL)::int + ("task_id" IS NOT NULL)::int) = 1);

-- Identitet-XOR: deltaker er enten prosjektmedlem (user_id) eller gjest (guest_name),
-- aldri begge, aldri ingen. guest_company/guest_phone er valgfrie gjeste-attributter.
ALTER TABLE "dokument_deltakere" ADD CONSTRAINT "dokument_deltakere_identitet_xor"
    CHECK ((("user_id" IS NOT NULL)::int + ("guest_name" IS NOT NULL)::int) = 1);
