-- Printmotor fase 3 — lagrede utskriftsmaler for timer-rapport (2026-08-27).
-- REN ADDITIV migrering: én ny tabell, ingen eksisterende kolonner røres,
-- ingen data flyttes, ingen DROP (to-stegs-policy — en ny tabell er trivielt additiv).
--
-- EksportOppsett lagrer en VISNING (radTyper + format som JSON), IKKE
-- dokumentstruktur — derfor egen liten tabell, ikke ReportTemplate/
-- OrganizationTemplate (fabel-vedtak: ikke et tredje mal-begrep). Se
-- designnotat-eksportvalg rev 3.
--
-- To nivåer via nullable eier_id: NULL = firmamal (alle i firmaet leser, kun
-- firma-admin skriver), satt = personlig. basert_pa_id binder «Lagre som min»
-- til firmamalen den ble kopiert fra — svakt selvref-felt UTEN FK-constraint;
-- «SetNull ved sletting» håndheves i app-lagets slett-prosedyre, ikke i DB
-- (A.20 cross-modul-mønster: svake String-FK-er, ingen @relation på tvers).
-- organization_id → organizations.id og opprettet_av_id/eier_id → users.id er
-- likeledes svake FK-er (kjernen ligger i et annet postgres-schema).

CREATE TABLE "timer"."eksport_oppsett" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "config_version" INTEGER NOT NULL DEFAULT 1,
    "eier_id" TEXT,
    "basert_pa_id" TEXT,
    "opprettet_av_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eksport_oppsett_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "eksport_oppsett_organization_id_idx" ON "timer"."eksport_oppsett"("organization_id");
CREATE INDEX "eksport_oppsett_basert_pa_id_idx" ON "timer"."eksport_oppsett"("basert_pa_id");
