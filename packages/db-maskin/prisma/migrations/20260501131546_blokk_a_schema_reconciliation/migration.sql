-- AlterTable
ALTER TABLE "maskin"."equipment" ADD COLUMN     "aarsmodell" INTEGER,
ADD COLUMN     "antall_seter" INTEGER,
ADD COLUMN     "co2_gram_per_km" DECIMAL(6,2),
ADD COLUMN     "effekt_kw" DECIMAL(6,2),
ADD COLUMN     "eierskap" TEXT DEFAULT 'eid',
ADD COLUMN     "eksport_kode" TEXT,
ADD COLUMN     "euro_klasse" TEXT,
ADD COLUMN     "forbruk_liter_per_10km" DECIMAL(5,2),
ADD COLUMN     "girkasse" TEXT,
ADD COLUMN     "har_sporingsenhet" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "intern_navn" TEXT,
ADD COLUMN     "kjoretoygruppe" TEXT,
ADD COLUMN     "kjoretoygruppe_navn" TEXT,
ADD COLUMN     "nyttelast" INTEGER,
ADD COLUMN     "vin" TEXT;

-- CreateTable
CREATE TABLE "maskin"."equipment_ansvarlige" (
    "id" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "periode_start" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periode_slutt" TIMESTAMP(3),
    "opprettet_av_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_ansvarlige_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "equipment_ansvarlige_user_id_idx" ON "maskin"."equipment_ansvarlige"("user_id");

-- CreateIndex
CREATE INDEX "equipment_ansvarlige_equipment_id_periode_slutt_idx" ON "maskin"."equipment_ansvarlige"("equipment_id", "periode_slutt");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_ansvarlige_equipment_id_user_id_periode_start_key" ON "maskin"."equipment_ansvarlige"("equipment_id", "user_id", "periode_start");

-- CreateIndex
CREATE INDEX "equipment_eierskap_idx" ON "maskin"."equipment"("eierskap");

-- CreateIndex
CREATE INDEX "equipment_eksport_kode_idx" ON "maskin"."equipment"("eksport_kode");

-- CreateIndex
CREATE INDEX "equipment_kjoretoygruppe_idx" ON "maskin"."equipment"("kjoretoygruppe");

-- CreateIndex
CREATE INDEX "equipment_euro_klasse_idx" ON "maskin"."equipment"("euro_klasse");

-- AddForeignKey
ALTER TABLE "maskin"."equipment_ansvarlige" ADD CONSTRAINT "equipment_ansvarlige_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "maskin"."equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
