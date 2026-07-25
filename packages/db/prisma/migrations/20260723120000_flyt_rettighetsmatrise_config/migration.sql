-- Flyt-rettighetsmatrise — config-substrat (Kloss 1, config-design § 1 delta-modell).
-- Rent additivt: to nye tabeller, ingen endring på eksisterende, ingen backfill.
-- Idempotent ved konstruksjon (IF NOT EXISTS + FK-guard) — trygg å kjøre flere ganger.
-- FlytRettighetLogg opprettes nå, men skrives først i Kloss 2.

-- CreateTable: FlytRettighetOverride (gjeldende tilstand, per-firma avvik fra defaults)
CREATE TABLE IF NOT EXISTS "flyt_rettighet_overrides" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "rolle" TEXT NOT NULL,
    "fra_status" TEXT NOT NULL,
    "til_status" TEXT NOT NULL,
    "tillatt" BOOLEAN NOT NULL,
    "endret_av_user_id" TEXT NOT NULL,
    "endret_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flyt_rettighet_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FlytRettighetLogg (append-only endringslogg, skrives i Kloss 2)
CREATE TABLE IF NOT EXISTS "flyt_rettighet_logg" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "rolle" TEXT NOT NULL,
    "fra_status" TEXT NOT NULL,
    "til_status" TEXT NOT NULL,
    "fra_verdi" TEXT NOT NULL,
    "til_verdi" TEXT NOT NULL,
    "endret_av_user_id" TEXT NOT NULL,
    "endret_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kilde" TEXT NOT NULL,

    CONSTRAINT "flyt_rettighet_logg_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "flyt_rettighet_overrides_org_id_rolle_fra_status_til_status_key" ON "flyt_rettighet_overrides"("org_id", "rolle", "fra_status", "til_status");
CREATE INDEX IF NOT EXISTS "flyt_rettighet_overrides_org_id_idx" ON "flyt_rettighet_overrides"("org_id");
CREATE INDEX IF NOT EXISTS "flyt_rettighet_logg_org_id_idx" ON "flyt_rettighet_logg"("org_id");

-- AddForeignKey (guardet — Postgres mangler ADD CONSTRAINT IF NOT EXISTS)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'flyt_rettighet_overrides_org_id_fkey') THEN
        ALTER TABLE "flyt_rettighet_overrides" ADD CONSTRAINT "flyt_rettighet_overrides_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'flyt_rettighet_overrides_endret_av_user_id_fkey') THEN
        ALTER TABLE "flyt_rettighet_overrides" ADD CONSTRAINT "flyt_rettighet_overrides_endret_av_user_id_fkey" FOREIGN KEY ("endret_av_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'flyt_rettighet_logg_org_id_fkey') THEN
        ALTER TABLE "flyt_rettighet_logg" ADD CONSTRAINT "flyt_rettighet_logg_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'flyt_rettighet_logg_endret_av_user_id_fkey') THEN
        ALTER TABLE "flyt_rettighet_logg" ADD CONSTRAINT "flyt_rettighet_logg_endret_av_user_id_fkey" FOREIGN KEY ("endret_av_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
