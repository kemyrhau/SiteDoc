-- Del 1: rad-identitet for kontrollplan-import + guard mot duplikat-import.
-- Rene tillegg: nye nullable kolonner, ny tabell, nye indekser. Ingen DROP,
-- ingen backfill (eksisterende punkter har ingen import-opprinnelse — korrekt
-- tilstand, ikke en mangel). Prod har 0 punkter → indeksen kan legges fritt.

-- Ny tabell: én rad per importhendelse
CREATE TABLE "kontrollplan_import" (
    "id" TEXT NOT NULL,
    "kontrollplan_id" TEXT NOT NULL,
    "filnavn" TEXT NOT NULL,
    "antall_parsede_rader" INTEGER NOT NULL,
    "importert_av_id" TEXT NOT NULL,
    "importert" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hoppet_over" JSONB NOT NULL,

    CONSTRAINT "kontrollplan_import_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "kontrollplan_import_kontrollplan_id_idx" ON "kontrollplan_import"("kontrollplan_id");

-- Rad-identitet på punkter (alle nullable)
ALTER TABLE "kontrollplan_punkter"
    ADD COLUMN "import_task_uid" INTEGER,
    ADD COLUMN "import_wbs" TEXT,
    ADD COLUMN "import_kilde_id" TEXT;

CREATE INDEX "kp_punkt_import_kilde_idx" ON "kontrollplan_punkter"("import_kilde_id");

-- Guard: to importer av samme fil gir samme (kontrollplan, uid, mal) → kollisjon.
-- NULL import_task_uid (manuelle/kopierte punkter) er distinkte i Postgres.
CREATE UNIQUE INDEX "kp_punkt_import_uid_mal_key" ON "kontrollplan_punkter"("kontrollplan_id", "import_task_uid", "sjekkliste_mal_id");

-- Fremmednøkler
ALTER TABLE "kontrollplan_import" ADD CONSTRAINT "kontrollplan_import_kontrollplan_id_fkey" FOREIGN KEY ("kontrollplan_id") REFERENCES "kontrollplaner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "kontrollplan_import" ADD CONSTRAINT "kontrollplan_import_importert_av_id_fkey" FOREIGN KEY ("importert_av_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "kontrollplan_punkter" ADD CONSTRAINT "kontrollplan_punkter_import_kilde_id_fkey" FOREIGN KEY ("import_kilde_id") REFERENCES "kontrollplan_import"("id") ON DELETE SET NULL ON UPDATE CASCADE;
