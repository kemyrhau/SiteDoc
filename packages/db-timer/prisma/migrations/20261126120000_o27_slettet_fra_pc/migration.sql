-- O27 SLETTET-ER-SLETTET (Kenneth 2026-11-26): spor for sedler og rader slettet på PC,
-- så telefonens synk aldri lager dem på nytt. Additiv: ny tabell, ingen endring i
-- eksisterende data. Tom ved oppstart — sporet skrives fra første sletting etter deploy.
CREATE TABLE "timer"."slettet_fra_pc" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sheet_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "dato" DATE NOT NULL,
    "slettet_av_user_id" TEXT NOT NULL,
    "slettet_ved" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slettet_fra_pc_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "slettet_fra_pc_user_id_type_idx" ON "timer"."slettet_fra_pc"("user_id", "type");

CREATE INDEX "slettet_fra_pc_sheet_id_idx" ON "timer"."slettet_fra_pc"("sheet_id");
