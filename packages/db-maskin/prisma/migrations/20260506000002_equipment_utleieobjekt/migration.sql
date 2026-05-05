-- Steg 4b Fase 2 — Equipment-utleie-utvidelse
-- Legger til 4 felter for å markere Equipment som utleieobjekt med pris.
-- Bakoverkompatibel: alle felter nullable / default false.
-- Selve utleie-transaksjons-flowen (EquipmentRental, periode-felter på SheetMachine)
-- utsettes til Steg 4d.

ALTER TABLE "maskin"."equipment"
  ADD COLUMN "er_utleieobjekt" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "utleiepris_per_dogn" DECIMAL(10,2),
  ADD COLUMN "utleiepris_per_time" DECIMAL(10,2),
  ADD COLUMN "utleie_enhet" TEXT;
