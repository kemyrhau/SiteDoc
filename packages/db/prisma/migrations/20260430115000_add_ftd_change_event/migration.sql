-- Manglende migrasjon: FtdChangeEvent + FtdTnotaChangeLink
-- ========================================================
-- Disse tabellene finnes i schema.prisma men har aldri hatt egen
-- migrasjon. På test ble de antagelig opprettet via prisma db push.
-- På prod feiler 20260430120000_add_klasse4_indekser pga manglende
-- ftd_tnota_change_links — denne migrasjonen lukker det gapet.
--
-- Idempotent (CREATE IF NOT EXISTS) — trygt på miljøer hvor
-- tabellene allerede finnes (test). Manuelt opprettet 2026-04-30 per
-- P-KRITISK-2 (oppryddings-plan-2026-04-28.md).

-- ========================================================
-- FtdChangeEvent
-- ========================================================

CREATE TABLE IF NOT EXISTS "ftd_change_events" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "kontrakt_id" TEXT,
    "event_type" TEXT NOT NULL,
    "event_number" TEXT,
    "description" TEXT,
    "sent_to_bh_at" TIMESTAMP(3),
    "document_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ftd_change_events_pkey" PRIMARY KEY ("id")
);

-- Foreign keys (idempotente via DO-block)
DO $$ BEGIN
    ALTER TABLE "ftd_change_events"
    ADD CONSTRAINT "ftd_change_events_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "ftd_change_events"
    ADD CONSTRAINT "ftd_change_events_kontrakt_id_fkey"
    FOREIGN KEY ("kontrakt_id") REFERENCES "ftd_kontrakter"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "ftd_change_events"
    ADD CONSTRAINT "ftd_change_events_document_id_fkey"
    FOREIGN KEY ("document_id") REFERENCES "ftd_documents"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "ftd_change_events_project_id_idx" ON "ftd_change_events"("project_id");

-- ========================================================
-- FtdTnotaChangeLink
-- ========================================================

CREATE TABLE IF NOT EXISTS "ftd_tnota_change_links" (
    "id" TEXT NOT NULL,
    "tnota_document_id" TEXT NOT NULL,
    "change_event_id" TEXT NOT NULL,
    CONSTRAINT "ftd_tnota_change_links_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    ALTER TABLE "ftd_tnota_change_links"
    ADD CONSTRAINT "ftd_tnota_change_links_tnota_document_id_fkey"
    FOREIGN KEY ("tnota_document_id") REFERENCES "ftd_documents"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "ftd_tnota_change_links"
    ADD CONSTRAINT "ftd_tnota_change_links_change_event_id_fkey"
    FOREIGN KEY ("change_event_id") REFERENCES "ftd_change_events"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "ftd_tnota_change_links_tnota_document_id_change_event_id_key"
    ON "ftd_tnota_change_links"("tnota_document_id", "change_event_id");
