-- ezdxf-motor (L1): mobil-variant av visnings-SVG ved siden av web-varianten.
-- Web beholder full mønster-hatch i `file_url`; mobil får en lettere `hatch=solid`-
-- SVG som rendrer i iOS WebKit `<img>` (PoC: full-hatch 19 MB dekoder ikke på iPhone).
-- Additiv og nullbar. NULL = bruk `file_url` — en gyldig og varig tilstand for
-- tegninger konvertert med `egen`-motoren (egen-SVG rendrer på mobil) og for ikke-DWG
-- (Kenneth 2026-10-11: ingen backfill). Mobil velger `mobil_file_url ?? file_url`.
-- Egen kolonne (ikke JSON) så adressen synes der `/uploads/` signeres/herdes/lastes
-- ned/slettes. Test (c) gater at en ezdxf-konvertert tegning uten verdi feiler.
ALTER TABLE "drawings" ADD COLUMN "mobil_file_url" TEXT;

-- Revisjonsarkiv: uten dette mister en arkivert ezdxf-revisjon mobilvarianten og
-- faller tilbake til web-full-hatch (rendrer ikke på mobil = selve buggen). Samme
-- NULL=bruk file_url-semantikk. Additiv, nullbar, ingen backfill.
ALTER TABLE "drawing_revisions" ADD COLUMN "mobil_file_url" TEXT;
