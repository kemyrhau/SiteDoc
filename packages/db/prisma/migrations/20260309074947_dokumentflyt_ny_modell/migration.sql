-- Steg 1: Opprett nye tabeller

-- AlterTable
ALTER TABLE "checklists" ADD COLUMN     "dokumentflyt_id" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "dokumentflyt_id" TEXT;

-- CreateTable
CREATE TABLE "dokumentflyter" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dokumentflyter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dokumentflyt_medlemmer" (
    "id" TEXT NOT NULL,
    "dokumentflyt_id" TEXT NOT NULL,
    "enterprise_id" TEXT,
    "project_member_id" TEXT,
    "rolle" TEXT NOT NULL,
    "steg" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dokumentflyt_medlemmer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dokumentflyt_maler" (
    "id" TEXT NOT NULL,
    "dokumentflyt_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dokumentflyt_maler_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dokumentflyt_medlemmer_dokumentflyt_id_enterprise_id_rolle__key" ON "dokumentflyt_medlemmer"("dokumentflyt_id", "enterprise_id", "rolle", "steg");

-- CreateIndex
CREATE UNIQUE INDEX "dokumentflyt_medlemmer_dokumentflyt_id_project_member_id_ro_key" ON "dokumentflyt_medlemmer"("dokumentflyt_id", "project_member_id", "rolle", "steg");

-- CreateIndex
CREATE UNIQUE INDEX "dokumentflyt_maler_dokumentflyt_id_template_id_key" ON "dokumentflyt_maler"("dokumentflyt_id", "template_id");

-- AddForeignKey
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_dokumentflyt_id_fkey" FOREIGN KEY ("dokumentflyt_id") REFERENCES "dokumentflyter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_dokumentflyt_id_fkey" FOREIGN KEY ("dokumentflyt_id") REFERENCES "dokumentflyter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dokumentflyter" ADD CONSTRAINT "dokumentflyter_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dokumentflyt_medlemmer" ADD CONSTRAINT "dokumentflyt_medlemmer_dokumentflyt_id_fkey" FOREIGN KEY ("dokumentflyt_id") REFERENCES "dokumentflyter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dokumentflyt_medlemmer" ADD CONSTRAINT "dokumentflyt_medlemmer_enterprise_id_fkey" FOREIGN KEY ("enterprise_id") REFERENCES "enterprises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dokumentflyt_medlemmer" ADD CONSTRAINT "dokumentflyt_medlemmer_project_member_id_fkey" FOREIGN KEY ("project_member_id") REFERENCES "project_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dokumentflyt_maler" ADD CONSTRAINT "dokumentflyt_maler_dokumentflyt_id_fkey" FOREIGN KEY ("dokumentflyt_id") REFERENCES "dokumentflyter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dokumentflyt_maler" ADD CONSTRAINT "dokumentflyt_maler_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "report_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Steg 2: Migrer data fra workflows → dokumentflyter

-- Kopier workflows til dokumentflyter (hent project_id via enterprise)
INSERT INTO "dokumentflyter" ("id", "project_id", "name", "created_at", "updated_at")
SELECT w."id", e."project_id", w."name", w."created_at", w."updated_at"
FROM "workflows" w
JOIN "enterprises" e ON e."id" = w."enterprise_id";

-- Migrer oppretter-entreprise (steg 1)
INSERT INTO "dokumentflyt_medlemmer" ("id", "dokumentflyt_id", "enterprise_id", "rolle", "steg")
SELECT gen_random_uuid(), w."id", w."enterprise_id", 'oppretter', 1
FROM "workflows" w;

-- Migrer svarer-entreprise steg 1
INSERT INTO "dokumentflyt_medlemmer" ("id", "dokumentflyt_id", "enterprise_id", "rolle", "steg")
SELECT gen_random_uuid(), w."id", w."responder_enterprise_id", 'svarer', 1
FROM "workflows" w
WHERE w."responder_enterprise_id" IS NOT NULL;

-- Migrer svarer-entreprise steg 2
INSERT INTO "dokumentflyt_medlemmer" ("id", "dokumentflyt_id", "enterprise_id", "rolle", "steg")
SELECT gen_random_uuid(), w."id", w."responder_enterprise_2_id", 'svarer', 2
FROM "workflows" w
WHERE w."responder_enterprise_2_id" IS NOT NULL;

-- Migrer svarer-entreprise steg 3
INSERT INTO "dokumentflyt_medlemmer" ("id", "dokumentflyt_id", "enterprise_id", "rolle", "steg")
SELECT gen_random_uuid(), w."id", w."responder_enterprise_3_id", 'svarer', 3
FROM "workflows" w
WHERE w."responder_enterprise_3_id" IS NOT NULL;

-- Migrer personlige steg-medlemmer fra workflow_step_members
INSERT INTO "dokumentflyt_medlemmer" ("id", "dokumentflyt_id", "project_member_id", "rolle", "steg")
SELECT gen_random_uuid(), wsm."workflow_id", wsm."project_member_id", 'svarer', wsm."step"
FROM "workflow_step_members" wsm;

-- Migrer workflow_templates → dokumentflyt_maler
INSERT INTO "dokumentflyt_maler" ("id", "dokumentflyt_id", "template_id", "created_at")
SELECT gen_random_uuid(), wt."workflow_id", wt."template_id", wt."created_at"
FROM "workflow_templates" wt;

-- Koble eksisterende dokumenter til ny dokumentflyt (samme ID som workflow)
UPDATE "checklists" SET "dokumentflyt_id" = "workflow_id" WHERE "workflow_id" IS NOT NULL;
UPDATE "tasks" SET "dokumentflyt_id" = "workflow_id" WHERE "workflow_id" IS NOT NULL;
