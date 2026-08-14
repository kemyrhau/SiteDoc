-- L1.5: valgfritt forhåndsvalgt dokumentflyt på kontrollpunkt.
-- Nullable, additivt, ingen DROP, ingen backfill (to-stegs-policy).
-- Satt → Start bruker flyten direkte (plan-autorisert av admin), uavhengig av hvem
-- som trykker. Null → dagens registrator-regel (opprettbareFlytIder). onDelete SET NULL
-- → slettes flyten, faller punktet tilbake til registrator-regelen uten å miste punktet.
ALTER TABLE "kontrollplan_punkter"
    ADD COLUMN "dokumentflyt_id" TEXT;

ALTER TABLE "kontrollplan_punkter"
    ADD CONSTRAINT "kontrollplan_punkter_dokumentflyt_id_fkey"
    FOREIGN KEY ("dokumentflyt_id") REFERENCES "dokumentflyter"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "kontrollplan_punkter_dokumentflyt_id_idx"
    ON "kontrollplan_punkter"("dokumentflyt_id");
