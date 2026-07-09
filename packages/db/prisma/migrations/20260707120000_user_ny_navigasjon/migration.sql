-- Redesign/navigasjon — bruker-lagret nyNavigasjon-flagg (Plan 2).
-- Rent additiv: én nullable kolonne, ingen backfill. null = ikke tildelt.
ALTER TABLE "users" ADD COLUMN "ny_navigasjon" BOOLEAN;
