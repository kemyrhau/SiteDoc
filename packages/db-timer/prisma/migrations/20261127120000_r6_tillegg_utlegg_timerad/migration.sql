-- Runde 6 (Kenneth 2026-11-27): tillegg og utlegg knyttes til menneskets timer i
-- dagskort-modus. REN ADDITIV, samme mønster som 20260808130000_sheet_machine_timer_id.
--
-- Svak FK (String, ingen Prisma @relation — A.20-mønster) → sheet_timer.id i samme
-- skjema. Raden kan være arbeid eller reise.
--
-- NULLABLE UTEN backfill (to-stegs-policy, stille tomhet vurdert): eldre rader og rader
-- ført i prosjektkort-modus kan ikke knyttes til en timerad uten å gjette. NULL betyr
-- «ført før vedtaket / prosjektkort-modus». Serveren krever feltet ved føring på web i
-- dagskort-modus (dagsseddel.ts, krevTimeradForTilleggUtlegg); integrasjonstesten
-- tillegg-utlegg-timerad feiler når en slik rad står uten kobling.

ALTER TABLE "timer"."sheet_tillegg"
    ADD COLUMN "sheet_timer_id" TEXT;

CREATE INDEX "sheet_tillegg_sheet_timer_id_idx"
    ON "timer"."sheet_tillegg" ("sheet_timer_id");

ALTER TABLE "timer"."sheet_utlegg"
    ADD COLUMN "sheet_timer_id" TEXT;

CREATE INDEX "sheet_utlegg_sheet_timer_id_idx"
    ON "timer"."sheet_utlegg" ("sheet_timer_id");
