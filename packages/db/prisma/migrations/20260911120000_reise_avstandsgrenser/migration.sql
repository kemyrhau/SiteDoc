-- Reise-avstandsskala (A.Markussen-krav 2026-09-11, Kenneth-gate). Løser
-- ikke-determinismen der fem reise-arter matcher navne-regexen /reise|transport/i
-- og find() uten orderBy plukket vilkårlig → feil lønnsart = feil utbetaling.
--
-- GRENSEPUNKTER, ikke intervaller: hver rad = «fra og med grense_m meter føres
-- reisen på lonnsart_id, til neste grensepunkt tar over». Overlapp er strukturelt
-- umulig (ingen intervaller som KAN overlappe) → ingen btree_gist-extension.
-- UNIQUE(organization_id, grense_m) er DB-garantien. Hull = lonnsart_id NULL.
--
-- Kun ADD — ingen DROP, ingen backfill (to-stegs migrasjons-policy). Tom tabell =
-- firma uten bånd = uendret oppførsel (navne-match/reiseLonnsartId som før).
-- lonnsart_id er svak FK → timer.Lonnsart (A.20-mønster): INGEN FK-constraint her,
-- org-isolasjon håndheves i app-laget (settReiseGrensepunkter).

-- CreateTable
CREATE TABLE "organization_reise_grenser" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "grense_m" INTEGER NOT NULL,
    "lonnsart_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_reise_grenser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (oppslag pr. firma: WHERE grense_m <= avstand ORDER BY grense_m DESC)
CREATE INDEX "organization_reise_grenser_organization_id_idx" ON "organization_reise_grenser"("organization_id");

-- CreateIndex — DB-garanti: to intervaller kan ikke starte på samme meter i
-- samme firma, altså kan de ikke overlappe.
CREATE UNIQUE INDEX "organization_reise_grenser_organization_id_grense_m_key" ON "organization_reise_grenser"("organization_id", "grense_m");

-- AddForeignKey — Organization er @@map'et til "organizations".
ALTER TABLE "organization_reise_grenser" ADD CONSTRAINT "organization_reise_grenser_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
