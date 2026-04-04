-- CreateTable
CREATE TABLE "ftd_documents" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "folder_id" TEXT,
    "filename" TEXT NOT NULL,
    "file_url" TEXT,
    "filetype" TEXT,
    "doc_type" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "file_hash" TEXT,
    "standard_number" TEXT,
    "page_count" INTEGER,
    "word_count" INTEGER,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ftd_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ftd_document_chunks" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "chunk_text" TEXT NOT NULL,
    "page_number" INTEGER,
    "section_title" TEXT,
    "section_level" INTEGER,
    "page_heading" TEXT,
    "ns_code" TEXT,
    "heading_number" TEXT,
    "embedding_state" TEXT NOT NULL DEFAULT 'pending',
    "profile" TEXT,

    CONSTRAINT "ftd_document_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ftd_spec_posts" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "document_id" TEXT,
    "postnr" TEXT,
    "beskrivelse" TEXT,
    "enhet" TEXT,
    "mengde_anbud" DECIMAL(18,2),
    "enhetspris" DECIMAL(18,2),
    "sum_anbud" DECIMAL(18,2),
    "ns_kode" TEXT,
    "ns_tittel" TEXT,
    "full_ns_tekst" TEXT,
    "ekstern_notat" TEXT,

    CONSTRAINT "ftd_spec_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ftd_nota_periods" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "enterprise_id" TEXT,
    "periode_nr" INTEGER NOT NULL,
    "periode_start" TIMESTAMP(3),
    "periode_slutt" TIMESTAMP(3),
    "type" TEXT NOT NULL DEFAULT 'a_nota',
    "kilde_filnavn" TEXT,
    "total_mengde_denne" DECIMAL(18,2),
    "total_verdi_denne" DECIMAL(18,2),
    "total_mva_denne" DECIMAL(18,2),
    "total_sum_denne" DECIMAL(18,2),
    "importert_av" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ftd_nota_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ftd_nota_posts" (
    "id" TEXT NOT NULL,
    "period_id" TEXT NOT NULL,
    "spec_post_id" TEXT NOT NULL,
    "mengde_denne" DECIMAL(18,2),
    "mengde_total" DECIMAL(18,2),
    "mengde_forrige" DECIMAL(18,2),
    "verdi_denne" DECIMAL(18,2),
    "verdi_total" DECIMAL(18,2),
    "verdi_forrige" DECIMAL(18,2),
    "prosent_ferdig" DECIMAL(18,2),
    "mva_denne" DECIMAL(18,2),
    "sum_denne" DECIMAL(18,2),
    "mengde_anbud" DECIMAL(18,2),
    "enhetspris" DECIMAL(18,2),
    "sum_anbud" DECIMAL(18,2),

    CONSTRAINT "ftd_nota_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ftd_nota_comments" (
    "id" TEXT NOT NULL,
    "spec_post_id" TEXT,
    "period_id" TEXT,
    "comment_text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ftd_nota_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ftd_documents_folder_id_idx" ON "ftd_documents"("folder_id");

-- CreateIndex
CREATE UNIQUE INDEX "ftd_documents_project_id_filename_key" ON "ftd_documents"("project_id", "filename");

-- CreateIndex
CREATE INDEX "ftd_document_chunks_document_id_idx" ON "ftd_document_chunks"("document_id");

-- CreateIndex
CREATE INDEX "ftd_document_chunks_embedding_state_idx" ON "ftd_document_chunks"("embedding_state");

-- CreateIndex
CREATE INDEX "ftd_document_chunks_ns_code_idx" ON "ftd_document_chunks"("ns_code");

-- CreateIndex
CREATE INDEX "ftd_spec_posts_project_id_idx" ON "ftd_spec_posts"("project_id");

-- CreateIndex
CREATE INDEX "ftd_nota_periods_project_id_idx" ON "ftd_nota_periods"("project_id");

-- CreateIndex
CREATE INDEX "ftd_nota_periods_enterprise_id_idx" ON "ftd_nota_periods"("enterprise_id");

-- CreateIndex
CREATE INDEX "ftd_nota_posts_period_id_idx" ON "ftd_nota_posts"("period_id");

-- CreateIndex
CREATE INDEX "ftd_nota_posts_spec_post_id_idx" ON "ftd_nota_posts"("spec_post_id");

-- AddForeignKey
ALTER TABLE "ftd_documents" ADD CONSTRAINT "ftd_documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ftd_documents" ADD CONSTRAINT "ftd_documents_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ftd_document_chunks" ADD CONSTRAINT "ftd_document_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "ftd_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ftd_spec_posts" ADD CONSTRAINT "ftd_spec_posts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ftd_spec_posts" ADD CONSTRAINT "ftd_spec_posts_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "ftd_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ftd_nota_periods" ADD CONSTRAINT "ftd_nota_periods_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ftd_nota_periods" ADD CONSTRAINT "ftd_nota_periods_enterprise_id_fkey" FOREIGN KEY ("enterprise_id") REFERENCES "enterprises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ftd_nota_posts" ADD CONSTRAINT "ftd_nota_posts_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "ftd_nota_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ftd_nota_posts" ADD CONSTRAINT "ftd_nota_posts_spec_post_id_fkey" FOREIGN KEY ("spec_post_id") REFERENCES "ftd_spec_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ftd_nota_comments" ADD CONSTRAINT "ftd_nota_comments_spec_post_id_fkey" FOREIGN KEY ("spec_post_id") REFERENCES "ftd_spec_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ftd_nota_comments" ADD CONSTRAINT "ftd_nota_comments_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "ftd_nota_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
