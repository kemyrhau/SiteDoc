-- Brukerminne på server (Kenneth-gate 2026-09-09). Fase 1: sist brukt byggeplass +
-- sist brukt tegning overlever mobil-reinstallering. Språk/nav-flagg bor på `users` og
-- dupliseres bevisst IKKE hit. Kun ADD — ingen DROP, ingen NOT NULL på eksisterende,
-- ingen backfill (to-stegs migrasjons-policy).

-- CreateTable
CREATE TABLE "bruker_innstilling" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT,
    "nokkel" TEXT NOT NULL,
    "verdi" JSONB NOT NULL,
    "oppdatert" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bruker_innstilling_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (oppslag for hent(projectId?))
CREATE INDEX "bruker_innstilling_user_id_project_id_idx" ON "bruker_innstilling"("user_id", "project_id");

-- Partielle unike indekser: Postgres teller NULL som distinkt, så én samlet unik-indeks
-- ville tillatt to globale rader med samme (user_id, nokkel). Delt i to (husmønster, jf.
-- 20260413120000_spec_post_unique_constraint + 20260810120000_mal_integritet):
--   prosjektnær — én rad per (bruker, prosjekt, nøkkel)
CREATE UNIQUE INDEX "bruker_innstilling_prosjekt_nokkel_unik"
    ON "bruker_innstilling" ("user_id", "project_id", "nokkel")
    WHERE "project_id" IS NOT NULL;

--   global — én rad per (bruker, nøkkel) når project_id er NULL
CREATE UNIQUE INDEX "bruker_innstilling_global_nokkel_unik"
    ON "bruker_innstilling" ("user_id", "nokkel")
    WHERE "project_id" IS NULL;

-- AddForeignKey — User er @@map'et til "users" (@@map-fella som blokkerte test-DB 07.09)
ALTER TABLE "bruker_innstilling" ADD CONSTRAINT "bruker_innstilling_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
