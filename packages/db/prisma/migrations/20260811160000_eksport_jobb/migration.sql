-- EksportJobb — asynkron server-side dokumentgenerering/eksport (fase 1 infrastruktur, 2026-08-11).
-- Kanon-jobbtabell (arkitektur-syntese § 6.2), speiler ftd_translation_jobs.
-- CHECK-invarianter håndheves i skjemaet (samme prinsipp som U1 + organization_seed_policies).

CREATE TABLE "eksport_jobber" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'prosjekt_eksport',
    "status" TEXT NOT NULL DEFAULT 'bestilt',
    "project_id" TEXT,
    "organization_id" TEXT,
    "dokument_type" TEXT,
    "dokument_id" TEXT,
    "bestilt_av_user_id" TEXT NOT NULL,
    "feilmelding" TEXT,
    "antall_totalt" INTEGER,
    "antall_ferdig" INTEGER,
    "resultat_sti" TEXT,
    "resultat_storrelse" INTEGER,
    "utloper_ved" TIMESTAMP(3),
    "startet_ved" TIMESTAMP(3),
    "fullfort_ved" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eksport_jobber_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "eksport_jobber_status_idx" ON "eksport_jobber"("status");
CREATE INDEX "eksport_jobber_project_id_idx" ON "eksport_jobber"("project_id");

ALTER TABLE "eksport_jobber" ADD CONSTRAINT "eksport_jobber_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "eksport_jobber" ADD CONSTRAINT "eksport_jobber_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "eksport_jobber" ADD CONSTRAINT "eksport_jobber_type_check"
    CHECK ("type" IN ('prosjekt_eksport', 'firma_eksport', 'dokument'));

ALTER TABLE "eksport_jobber" ADD CONSTRAINT "eksport_jobber_status_check"
    CHECK ("status" IN ('bestilt', 'bygger', 'klar', 'feilet', 'utløpt'));
