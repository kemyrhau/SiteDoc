-- F5 (2026-07-14): SheetTimer.pauseMin — matpause-bærer per timer-rad.
-- Minutter lunsjpause denne raden trekker (0 = ingen). Kun ÉN rad per sedel har
-- pauseMin > 0 (kun-én-per-dag, håndhevet som flytt i mobil-UI).
--
-- Additivt NOT NULL DEFAULT 0 (to-stegs-policy: trygt, metadata-only, ingen
-- rewrite, ingen data slettes). Eksisterende rader får 0.
--
-- FORBEREDT — IKKE KJØRT. Kjøres på Kenneths go (build → migrate deploy → up),
-- migrerings-gate: prod krever DB /sitedoc, test krever sitedoc_test.
--
-- Modul-avhengighet (verifisert 2026-07-14): maskin-kapasitetsregelen
-- (validerMaskinUnderArbeid) bruker DailySheet.pauseMin (sedel-nivå) — UENDRET.
-- sheet_machines får INGEN pauseMin (maskin går gjennom operatørens pause).
-- Klient-invariant fremover: DailySheet.pauseMin = Σ(SheetTimer.pauseMin).
ALTER TABLE "timer"."sheet_timer"
  ADD COLUMN "pause_min" INTEGER NOT NULL DEFAULT 0;

-- BACKFILL: bevisst UTELATT — cowork gater backfill-disiplinen separat.
-- Eksisterende rader beholder pause_min = 0. Dette er trygt for maskin-regelen
-- (som leser DailySheet.pauseMin, ikke summen). Konsekvens: for gamle, urørte
-- sedler viser F5-checkboxen «ingen bærer» selv om dagen hadde pause (carve-
-- baket i rad-timene) — kosmetisk gap til raden røres. En eventuell backfill må
-- velge bærer-rad per eksisterende sedel (lunsj-kryssende, jf. genererings-
-- regelen) og diskriminere på DailySheet.pauseMin > 0 — ikke en generisk default.
