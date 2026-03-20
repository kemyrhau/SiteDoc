-- CreateTable
CREATE TABLE "point_clouds" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "building_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "file_url" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_size" INTEGER,
    "potree_url" TEXT,
    "conversion_status" TEXT NOT NULL DEFAULT 'pending',
    "conversion_error" TEXT,
    "coordinate_system" TEXT,
    "point_count" INTEGER,
    "has_classification" BOOLEAN NOT NULL DEFAULT false,
    "has_rgb" BOOLEAN NOT NULL DEFAULT false,
    "classifications" JSONB,
    "bounding_box" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "point_clouds_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "point_clouds" ADD CONSTRAINT "point_clouds_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_clouds" ADD CONSTRAINT "point_clouds_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
