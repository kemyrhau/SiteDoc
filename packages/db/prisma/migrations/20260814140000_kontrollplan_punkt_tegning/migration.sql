-- L2: valgfri plassering av kontrollpunkt på en tegning. Prosent (0-100) av bilde-
-- containeren, samme koordinatmodell som Checklist/Task-markører. Nullable, additivt,
-- ingen DROP (to-stegs-policy). onDelete SET NULL → slettes tegningen, mister punktet
-- plasseringen men ikke seg selv.
ALTER TABLE "kontrollplan_punkter"
    ADD COLUMN "drawing_id" TEXT,
    ADD COLUMN "position_x" DOUBLE PRECISION,
    ADD COLUMN "position_y" DOUBLE PRECISION;

ALTER TABLE "kontrollplan_punkter"
    ADD CONSTRAINT "kontrollplan_punkter_drawing_id_fkey"
    FOREIGN KEY ("drawing_id") REFERENCES "drawings"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "kontrollplan_punkter_drawing_id_idx"
    ON "kontrollplan_punkter"("drawing_id");
