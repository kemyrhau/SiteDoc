-- DWG-2 RETUR 4 (fullstendighet): parset-vs-tegnet-rapport på tegninger.
-- Additiv og nullbar. NULL er en GYLDIG tilstand: tegningen er ikke en DWG/DXF-
-- konvertering (PDF/IFC), eller er konvertert før denne releasen. Ingen backfill —
-- eksisterende DWG-tegninger får rapporten ved neste re-konvertering («Prøv igjen»).
-- Ikke en identitets-/koblingskolonne, så stille-tomhet-kravet om backfill/unik-indeks
-- gjelder ikke; fullstendighets-GATEN ligger i integrasjonstesten (ikkeTegnet = 0).
ALTER TABLE "drawings" ADD COLUMN "konvertering_rapport" JSONB;
