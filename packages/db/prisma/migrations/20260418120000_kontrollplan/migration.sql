-- Kontrollplan — stedsbasert kvalitetskontroll (SAK10 §14-7)

-- Kontrollomrade-felt på sjekklistemaler
ALTER TABLE "report_templates" ADD COLUMN "kontrollomrade" TEXT;

-- Kontrollplan (én per byggeplass)
CREATE TABLE "kontrollplaner" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "byggeplass_id" TEXT NOT NULL,
    "navn" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'utkast',
    "godkjent_dato" TIMESTAMP(3),
    "godkjent_av_id" TEXT,
    "opprettet" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "oppdatert" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kontrollplaner_pkey" PRIMARY KEY ("id")
);

-- Milepel (grupperer kontrollplanpunkter)
CREATE TABLE "milepeler" (
    "id" TEXT NOT NULL,
    "kontrollplan_id" TEXT NOT NULL,
    "navn" TEXT NOT NULL,
    "maal_uke" INTEGER NOT NULL,
    "maal_aar" INTEGER NOT NULL,
    "sortering" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "milepeler_pkey" PRIMARY KEY ("id")
);

-- KontrollplanPunkt (kobling: mal × område × faggruppe × frist)
CREATE TABLE "kontrollplan_punkter" (
    "id" TEXT NOT NULL,
    "kontrollplan_id" TEXT NOT NULL,
    "milepel_id" TEXT,
    "omrade_id" TEXT,
    "sjekkliste_mal_id" TEXT NOT NULL,
    "faggruppe_id" TEXT NOT NULL,
    "frist_uke" INTEGER,
    "frist_aar" INTEGER,
    "varsel_uker_for" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'planlagt',
    "sjekkliste_id" TEXT,
    "avhenger_av_id" TEXT,
    "opprettet" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kontrollplan_punkter_pkey" PRIMARY KEY ("id")
);

-- KontrollplanHistorikk (audit trail for SAK10)
CREATE TABLE "kontrollplan_historikk" (
    "id" TEXT NOT NULL,
    "punkt_id" TEXT NOT NULL,
    "bruker_id" TEXT NOT NULL,
    "handling" TEXT NOT NULL,
    "kommentar" TEXT,
    "tidspunkt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kontrollplan_historikk_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "kontrollplaner_project_id_byggeplass_id_key" ON "kontrollplaner"("project_id", "byggeplass_id");
CREATE UNIQUE INDEX "kontrollplan_punkter_sjekkliste_id_key" ON "kontrollplan_punkter"("sjekkliste_id");
CREATE UNIQUE INDEX "kontrollplan_punkter_kontrollplan_id_omrade_id_sjekkliste_mal_id_key" ON "kontrollplan_punkter"("kontrollplan_id", "omrade_id", "sjekkliste_mal_id");

-- Indexes
CREATE INDEX "kontrollplaner_project_id_idx" ON "kontrollplaner"("project_id");
CREATE INDEX "milepeler_kontrollplan_id_idx" ON "milepeler"("kontrollplan_id");
CREATE INDEX "kontrollplan_punkter_kontrollplan_id_idx" ON "kontrollplan_punkter"("kontrollplan_id");
CREATE INDEX "kontrollplan_punkter_milepel_id_idx" ON "kontrollplan_punkter"("milepel_id");
CREATE INDEX "kontrollplan_punkter_omrade_id_idx" ON "kontrollplan_punkter"("omrade_id");
CREATE INDEX "kontrollplan_punkter_faggruppe_id_idx" ON "kontrollplan_punkter"("faggruppe_id");
CREATE INDEX "kontrollplan_punkter_status_idx" ON "kontrollplan_punkter"("status");
CREATE INDEX "kontrollplan_historikk_punkt_id_idx" ON "kontrollplan_historikk"("punkt_id");

-- Foreign keys
ALTER TABLE "kontrollplaner" ADD CONSTRAINT "kontrollplaner_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kontrollplaner" ADD CONSTRAINT "kontrollplaner_byggeplass_id_fkey" FOREIGN KEY ("byggeplass_id") REFERENCES "byggeplasser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kontrollplaner" ADD CONSTRAINT "kontrollplaner_godkjent_av_id_fkey" FOREIGN KEY ("godkjent_av_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "milepeler" ADD CONSTRAINT "milepeler_kontrollplan_id_fkey" FOREIGN KEY ("kontrollplan_id") REFERENCES "kontrollplaner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "kontrollplan_punkter" ADD CONSTRAINT "kontrollplan_punkter_kontrollplan_id_fkey" FOREIGN KEY ("kontrollplan_id") REFERENCES "kontrollplaner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kontrollplan_punkter" ADD CONSTRAINT "kontrollplan_punkter_milepel_id_fkey" FOREIGN KEY ("milepel_id") REFERENCES "milepeler"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "kontrollplan_punkter" ADD CONSTRAINT "kontrollplan_punkter_omrade_id_fkey" FOREIGN KEY ("omrade_id") REFERENCES "omrader"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "kontrollplan_punkter" ADD CONSTRAINT "kontrollplan_punkter_sjekkliste_mal_id_fkey" FOREIGN KEY ("sjekkliste_mal_id") REFERENCES "report_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "kontrollplan_punkter" ADD CONSTRAINT "kontrollplan_punkter_faggruppe_id_fkey" FOREIGN KEY ("faggruppe_id") REFERENCES "dokumentflyt_parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "kontrollplan_punkter" ADD CONSTRAINT "kontrollplan_punkter_sjekkliste_id_fkey" FOREIGN KEY ("sjekkliste_id") REFERENCES "checklists"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "kontrollplan_punkter" ADD CONSTRAINT "kontrollplan_punkter_avhenger_av_id_fkey" FOREIGN KEY ("avhenger_av_id") REFERENCES "kontrollplan_punkter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "kontrollplan_historikk" ADD CONSTRAINT "kontrollplan_historikk_punkt_id_fkey" FOREIGN KEY ("punkt_id") REFERENCES "kontrollplan_punkter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kontrollplan_historikk" ADD CONSTRAINT "kontrollplan_historikk_bruker_id_fkey" FOREIGN KEY ("bruker_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
