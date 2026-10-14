-- Leveranse 1 (arbeidstegning, TEGNING_MOTOR=dxfviewer): forenklet DXF (XDATA/
-- extension-dicts/ubrukte blokker fjernet, koordinater avrundet <=0,1 mm — spike
-- 0,5b, relay/inbox-orkestrator.md) + O1-registeret i rå DXF-verdenskoordinater
-- (render.py --register-world). Additiv og nullbar. Begge NULL = TEGNING_MOTOR var
-- av ved siste konvertering, eller filen er ikke DWG/DXF — en gyldig, varig tilstand
-- (SVG-veien er fortsatt default). Alltid satt SAMMEN (som mobil_file_url) så en
-- re-konvertering med flagget av rydder stale URL-er.
ALTER TABLE "drawings" ADD COLUMN "dxf_viewer_file_url" TEXT;
ALTER TABLE "drawings" ADD COLUMN "register_world_url" TEXT;

-- Revisjonsarkiv: speiler mobil_file_url-arkiveringen (20261011120000) — uten dette
-- ville en arkivert revisjon konvertert med TEGNING_MOTOR=dxfviewer PÅ miste
-- artefaktene og falle tilbake til SVG-veien kun for gamle revisjoner (drift).
ALTER TABLE "drawing_revisions" ADD COLUMN "dxf_viewer_file_url" TEXT;
ALTER TABLE "drawing_revisions" ADD COLUMN "register_world_url" TEXT;
