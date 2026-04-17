-- CreateTable: Område — polygon-markerte områder på tegning (sone, rom, etasje)
CREATE TABLE "omrader" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "byggeplass_id" TEXT NOT NULL,
    "tegning_id" TEXT,
    "navn" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'sone',
    "polygon" JSONB NOT NULL DEFAULT '[]',
    "farge" TEXT NOT NULL DEFAULT '#3b82f6',
    "sortering" INTEGER NOT NULL DEFAULT 0,
    "opprettet" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "omrader_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "omrader_project_id_idx" ON "omrader"("project_id");
CREATE INDEX "omrader_byggeplass_id_idx" ON "omrader"("byggeplass_id");
CREATE INDEX "omrader_tegning_id_idx" ON "omrader"("tegning_id");

-- AddForeignKey
ALTER TABLE "omrader" ADD CONSTRAINT "omrader_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "omrader" ADD CONSTRAINT "omrader_byggeplass_id_fkey" FOREIGN KEY ("byggeplass_id") REFERENCES "byggeplasser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "omrader" ADD CONSTRAINT "omrader_tegning_id_fkey" FOREIGN KEY ("tegning_id") REFERENCES "drawings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
