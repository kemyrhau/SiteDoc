-- Vareforbruk-modul Steg 4b — Fase 5 (import-flyt)
-- A.Markussens SmartDok-katalog inneholder samme produkt med to enheter
-- (eks. "Pukk 0-120" som både m3 og Tonn med samme varenummer 31).
-- Endre unique-constraint slik at samme produkt kan registreres med flere enheter.
-- Domenet er klart: navn+enhet-kombinasjonen identifiserer en katalog-vare unikt
-- per firma; varenummer er valgfri referanse fra eksternt system.

-- DropIndex
DROP INDEX "varelager"."varer_organization_id_varenummer_key";

-- CreateIndex
CREATE UNIQUE INDEX "varer_organization_id_navn_enhet_key" ON "varelager"."varer"("organization_id", "navn", "enhet");
