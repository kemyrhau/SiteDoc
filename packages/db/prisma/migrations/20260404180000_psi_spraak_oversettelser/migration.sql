-- AlterTable: Legg til languages-array på PSI
ALTER TABLE "psi" ADD COLUMN "languages" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable: Legg til translations-JSON på ReportObject
ALTER TABLE "report_objects" ADD COLUMN "translations" JSONB NOT NULL DEFAULT '{}';
