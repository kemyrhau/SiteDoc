-- ReisetidMatrise (R1): forhåndsberegnet kjøretid per [kontor × byggeplass].
-- Rent additiv: ny tabell, ingen endring på eksisterende. Ingen backfill.

-- CreateTable
CREATE TABLE "reisetid_matrise" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "oppmotested_id" TEXT NOT NULL,
    "byggeplass_id" TEXT NOT NULL,
    "kjoretid_min" INTEGER NOT NULL,
    "kilde" TEXT NOT NULL,
    "beregnet_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reisetid_matrise_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reisetid_matrise_organization_id_idx" ON "reisetid_matrise"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "reisetid_matrise_oppmotested_id_byggeplass_id_key" ON "reisetid_matrise"("oppmotested_id", "byggeplass_id");

-- AddForeignKey
ALTER TABLE "reisetid_matrise" ADD CONSTRAINT "reisetid_matrise_oppmotested_id_fkey" FOREIGN KEY ("oppmotested_id") REFERENCES "oppmotesteder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reisetid_matrise" ADD CONSTRAINT "reisetid_matrise_byggeplass_id_fkey" FOREIGN KEY ("byggeplass_id") REFERENCES "byggeplasser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
