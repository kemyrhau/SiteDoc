-- Fase 2 / T.10: Project.type for ikke-prosjekt-tid (Alt C).
-- "kunde" | "internt". Interne prosjekter er firma-eide bærere for internt
-- arbeid + maskinvedlikehold i Timer-modulen.
-- Additivt felt med NOT NULL DEFAULT 'kunde' (to-stegs-policy: trygt, ingen
-- data slettes). Alle eksisterende prosjekter blir 'kunde' uten backfill.
ALTER TABLE "projects"
  ADD COLUMN "type" TEXT NOT NULL DEFAULT 'kunde';

-- Filtrering på interne prosjekter (kundevendte lister + timer-velger).
CREATE INDEX "projects_type_idx" ON "projects"("type");
