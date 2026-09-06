-- Lokasjonsomfang (2026-09-04): «gjelder hele byggeplassen» som eksplisitt svar, ikke tomt felt.
-- Additiv steg-1-migrering (to-stegs migrasjons-policy): kun ADD COLUMN, nullable, ingen backfill.
-- Eksisterende rader beholder NULL → dagens atferd uendret. Verdier: 'punkt' | 'byggeplass' | NULL.
ALTER TABLE "checklists" ADD COLUMN "lokasjon_omfang" TEXT;
ALTER TABLE "tasks" ADD COLUMN "lokasjon_omfang" TEXT;
