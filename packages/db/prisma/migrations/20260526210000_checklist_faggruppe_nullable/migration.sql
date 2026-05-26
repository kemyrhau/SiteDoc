-- Speil av Task: HMS-sjekklister (SJA, RUH) auto-rutes til HMS-gruppen uten
-- faggruppe. Krever at FK-ene er nullable. Eksisterende rader er upåvirket.
ALTER TABLE "checklists" ALTER COLUMN "bestiller_faggruppe_id" DROP NOT NULL;
ALTER TABLE "checklists" ALTER COLUMN "utforer_faggruppe_id"   DROP NOT NULL;
