-- PsiTilstedevarelse (Fase 4 Mannskap, §15-innsjekk/utsjekk per byggeplass).
-- Rent additiv: ny tabell, ingen endring på eksisterende. Ingen backfill, ingen
-- kolonne-drop. Event-tidsserie (mange rader per person/dag) — ingen unik-krav.
-- Tidspunkt-feltene er firma-isolert på feltnivå i applikasjonslaget (byggherre
-- ser §15-aggregat, ikke klokkeslett) — DB lagrer alt, serialisering stripper.

-- CreateTable
CREATE TABLE "psi_tilstedevarelse" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "byggeplass_id" TEXT,
    "user_id" TEXT,
    "guest_name" TEXT,
    "guest_company" TEXT,
    "guest_phone" TEXT,
    "hms_kort_nr" TEXT,
    "har_ikke_hms_kort" BOOLEAN NOT NULL DEFAULT false,
    "innsjekk_tid" TIMESTAMP(3) NOT NULL,
    "utsjekk_tid" TIMESTAMP(3),
    "kilde" TEXT NOT NULL DEFAULT 'manuell',
    "auto_utlogget" BOOLEAN NOT NULL DEFAULT false,
    "registrert_av_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "psi_tilstedevarelse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "psi_tilstedevarelse_user_id_innsjekk_tid_idx" ON "psi_tilstedevarelse"("user_id", "innsjekk_tid");

-- CreateIndex
CREATE INDEX "psi_tilstedevarelse_byggeplass_id_utsjekk_tid_idx" ON "psi_tilstedevarelse"("byggeplass_id", "utsjekk_tid");

-- CreateIndex
CREATE INDEX "psi_tilstedevarelse_project_id_innsjekk_tid_idx" ON "psi_tilstedevarelse"("project_id", "innsjekk_tid");

-- AddForeignKey
ALTER TABLE "psi_tilstedevarelse" ADD CONSTRAINT "psi_tilstedevarelse_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psi_tilstedevarelse" ADD CONSTRAINT "psi_tilstedevarelse_byggeplass_id_fkey" FOREIGN KEY ("byggeplass_id") REFERENCES "byggeplasser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psi_tilstedevarelse" ADD CONSTRAINT "psi_tilstedevarelse_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
