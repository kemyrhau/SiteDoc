-- AlterTable: Gjør enterprise-felter nullable på tasks (for HMS-avvik uten entreprise)
ALTER TABLE "tasks" ALTER COLUMN "bestiller_enterprise_id" DROP NOT NULL;
ALTER TABLE "tasks" ALTER COLUMN "utforer_enterprise_id" DROP NOT NULL;
