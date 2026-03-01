-- CreateTable
CREATE TABLE "project_groups" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'field',
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_group_members" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "project_member_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_groups_project_id_slug_key" ON "project_groups"("project_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "project_group_members_group_id_project_member_id_key" ON "project_group_members"("group_id", "project_member_id");

-- AddForeignKey
ALTER TABLE "project_groups" ADD CONSTRAINT "project_groups_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_members" ADD CONSTRAINT "project_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "project_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_members" ADD CONSTRAINT "project_group_members_project_member_id_fkey" FOREIGN KEY ("project_member_id") REFERENCES "project_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
