-- Service pr. timetall (kundeønske #1, ordre 2026-09-18)
-- REN TILLEGG: to nye nullable-kolonner på equipment, ingen eksisterende kolonne endres,
-- ingen data slettes.
--
-- (a) BACKFILL — bevisst INGEN backfill: begge kolonner fødes NULL på alle eksisterende
--     maskiner. NULL = «ingen intervall satt» → ingen varsling. En oppdiktet default ville
--     varslet om service ingen har bestemt (jf. CLAUDE.md § «Stille tomhet»: en tom kolonne
--     er bare en felle når tomhet er tvetydig — her betyr NULL entydig «ikke bestemt»).
--
-- (b) DB-GARANTI — CHECK hindrer meningsløse verdier: et serviceintervall på 0 eller negativt
--     driftstimer-tall er ikke en gyldig innstilling. DB avviser det, ingen leser gjetter.
--
-- serviceIntervallTimer: intervallet i driftstimer (konfigureres i maskinens innstillinger).
-- nesteServiceTimer:     gjeldende terskel «skal til service ved X driftstimer» (denormalisert
--                        fra ServiceRecord-fremskrivingen; speiler euKontrollFrist-mønsteret).

ALTER TABLE "maskin"."equipment"
  ADD COLUMN "service_intervall_timer" INTEGER,
  ADD COLUMN "neste_service_timer" INTEGER;

ALTER TABLE "maskin"."equipment"
  ADD CONSTRAINT "equipment_service_intervall_timer_positiv"
    CHECK ("service_intervall_timer" IS NULL OR "service_intervall_timer" > 0),
  ADD CONSTRAINT "equipment_neste_service_timer_positiv"
    CHECK ("neste_service_timer" IS NULL OR "neste_service_timer" > 0);

CREATE INDEX "equipment_neste_service_timer_idx"
  ON "maskin"."equipment" ("neste_service_timer");
