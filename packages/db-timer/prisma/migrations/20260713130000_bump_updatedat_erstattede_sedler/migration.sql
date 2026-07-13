-- Oppfølger til 20260713120000_sheet_rad_historikk (M-1-funn 2026-07-13).
-- Hoved-migreringen FLYTTET erstattede barn-rader til sheet_rad_historikk, men
-- bumpet IKKE daily_sheets.updated_at (barn-endringer bumper ikke parent — bevisst
-- i koden). Mobil delta-pull (hentEndringerSiden) filtrerer på updatedAt > sistSynk,
-- så sedler som fikk rader flyttet kommer ikke i delta-pullen → arbeideren beholder
-- stale oppblåst visning (9/6) inntil full pull/reinstall.
--
-- Denne bumpen setter updated_at = now() på nettopp de sedlene som fikk rader flyttet
-- til historikk → neste delta-pull re-henter dem → pull-apply (delete-all-local +
-- insert-server) reconciler til sann tilstand (3/2). Self-heal uten reinstall.
--
-- KUN updated_at-bump. Ingen andre felt, ingen andre tabeller, ingen skjema-endring.
-- Idempotent: gjentatt kjøring setter bare updated_at på nytt (uskadelig).
UPDATE "timer"."daily_sheets"
SET "updated_at" = now()
WHERE "id" IN (
    SELECT DISTINCT "sheet_id" FROM "timer"."sheet_rad_historikk"
);
