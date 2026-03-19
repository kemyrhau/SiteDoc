-- AlterTable
ALTER TABLE "drawings" ADD COLUMN     "conversion_error" TEXT,
ADD COLUMN     "conversion_status" TEXT,
ADD COLUMN     "coordinate_system" TEXT,
ADD COLUMN     "original_file_url" TEXT;
