-- SheetRadHistorikk — write-only audit av erstattede rad-versjoner (T7-2b-oppfølger).
-- Del 1: additiv CREATE TABLE (kun ADD).
-- Del 2: FLYTT eksisterende attestert_status='erstattet'-rader (alle 3 typer) fra
--        hovedtabellene til historikk (INSERT snapshot via to_jsonb + DELETE) — MOVE,
--        aldri hard-delete. Prisma kjører hele migreringen i én transaksjon, så
--        INSERT+DELETE er atomisk per Postgres.
-- attestert_status-kolonnen beholdes uendret (pending/attestert/returnert brukes fortsatt).

-- ── Del 1: tabell ─────────────────────────────────────────────────────────
CREATE TABLE "timer"."sheet_rad_historikk" (
    "id" TEXT NOT NULL,
    "rad_type" TEXT NOT NULL,
    "original_rad_id" TEXT NOT NULL,
    "sheet_id" TEXT NOT NULL,
    "parent_rad_id" TEXT,
    "snapshot" JSONB NOT NULL,
    "erstattet_av_user_id" TEXT,
    "erstattet_ved" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sheet_rad_historikk_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sheet_rad_historikk_sheet_id_idx"
    ON "timer"."sheet_rad_historikk"("sheet_id");
CREATE INDEX "sheet_rad_historikk_original_rad_id_idx"
    ON "timer"."sheet_rad_historikk"("original_rad_id");
CREATE INDEX "sheet_rad_historikk_rad_type_idx"
    ON "timer"."sheet_rad_historikk"("rad_type");

-- ── Del 2: FLYTT eksisterende 'erstattet'-rader → historikk ───────────────
-- Timer
INSERT INTO "timer"."sheet_rad_historikk"
    ("id", "rad_type", "original_rad_id", "sheet_id", "parent_rad_id", "snapshot", "erstattet_av_user_id", "erstattet_ved", "created_at")
SELECT gen_random_uuid(), 'timer', t."id", t."sheet_id", t."parent_rad_id",
       to_jsonb(t.*), t."attestert_av_user_id", COALESCE(t."attestert_ved", CURRENT_TIMESTAMP), CURRENT_TIMESTAMP
FROM "timer"."sheet_timer" t
WHERE t."attestert_status" = 'erstattet';

DELETE FROM "timer"."sheet_timer" WHERE "attestert_status" = 'erstattet';

-- Tillegg
INSERT INTO "timer"."sheet_rad_historikk"
    ("id", "rad_type", "original_rad_id", "sheet_id", "parent_rad_id", "snapshot", "erstattet_av_user_id", "erstattet_ved", "created_at")
SELECT gen_random_uuid(), 'tillegg', t."id", t."sheet_id", t."parent_rad_id",
       to_jsonb(t.*), t."attestert_av_user_id", COALESCE(t."attestert_ved", CURRENT_TIMESTAMP), CURRENT_TIMESTAMP
FROM "timer"."sheet_tillegg" t
WHERE t."attestert_status" = 'erstattet';

DELETE FROM "timer"."sheet_tillegg" WHERE "attestert_status" = 'erstattet';

-- Maskin
INSERT INTO "timer"."sheet_rad_historikk"
    ("id", "rad_type", "original_rad_id", "sheet_id", "parent_rad_id", "snapshot", "erstattet_av_user_id", "erstattet_ved", "created_at")
SELECT gen_random_uuid(), 'maskin', m."id", m."sheet_id", m."parent_rad_id",
       to_jsonb(m.*), m."attestert_av_user_id", COALESCE(m."attestert_ved", CURRENT_TIMESTAMP), CURRENT_TIMESTAMP
FROM "timer"."sheet_machines" m
WHERE m."attestert_status" = 'erstattet';

DELETE FROM "timer"."sheet_machines" WHERE "attestert_status" = 'erstattet';
