-- O12 pkt 16 (docs/claude/vedtak-timer-web.md § Reisevinduet, Kenneth 2026-11-22): en reise ført
-- som ARBEIDSTID lagrer at den er en reise — retningen ('ut' = til byggeplass, 'retur' = fra
-- byggeplass). Raden er og blir arbeid: er_reise, reise-sporet og alle eksisterende CHECK-er
-- (validerReiseInvarianter-speilet) er uendret.
--
-- Additiv: én nullable kolonne + én CHECK som bare tillater NULL, 'ut' eller 'retur'. CHECK-en
-- binder ikke er_reise: «Rediger timer-rad» (oppdaterTimerRad, uendret) kan bytte lønnsarten,
-- og lesere bruker merket bare når er_reise = false. INGEN backfill (bevisst, R7): arbeidstid-reiser lagret før O12 kan ikke skilles
-- fra vanlig arbeid i dataene og står uten merke — de vises og flyttes som arbeid, som før.
-- Ingen eksisterende rad endres; updated_at skrives ikke. Kjøres av Kenneth.
-- Telling før/etter: relay/sql/o12-arbeid-reise-retning-telling.sql.

ALTER TABLE "timer"."sheet_timer" ADD COLUMN "arbeid_reise_retning" TEXT;

ALTER TABLE "timer"."sheet_timer"
  ADD CONSTRAINT "sheet_timer_arbeid_reise_retning_chk"
  CHECK (
    "arbeid_reise_retning" IS NULL OR "arbeid_reise_retning" IN ('ut', 'retur')
  );
