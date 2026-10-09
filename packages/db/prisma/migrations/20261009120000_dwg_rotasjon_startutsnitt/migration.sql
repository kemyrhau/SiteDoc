-- DWG-2 RETUR 2: auto-rotasjon + startutsnitt på tegninger.
-- Additiv og nullbar. NULL er en GYLDIG tilstand (stille-tomhet-regelen):
--   auto_rotasjon NULL      = ingen tydelig veggrid detektert → urotert (f.eks. kartdata)
--   rotasjon_overstyrt NULL = ingen brukeroverstyring → følg auto
--   startutsnitt NULL       = vis hele viewBox
-- Ingen backfill: eksisterende tegninger beholder dagens atferd (urotert, fit-to-width)
-- til de re-konverteres. Ikke en identitets-/koblingskolonne, så stille-tomhet-kravet
-- om backfill/unik-indeks gjelder ikke.
ALTER TABLE "drawings" ADD COLUMN "auto_rotasjon" DOUBLE PRECISION;
ALTER TABLE "drawings" ADD COLUMN "rotasjon_overstyrt" DOUBLE PRECISION;
ALTER TABLE "drawings" ADD COLUMN "startutsnitt" JSONB;
