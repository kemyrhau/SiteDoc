-- Måling i tegning — steg 1 (2026-09-24)
--
-- To additive, nullable felt på Drawing. Ingen DROP, ingen backfill nødvendig:
-- feltene er tomme for eksisterende tegninger med vilje (jf. «stille tomhet»-
-- regelen). En tegning uten kjent målestokk SKAL ha NULL — og måleverktøyet er
-- da avslått (håndhevet i kanMale() + web-UI + test).
--
-- mm_pr_piksel : mm pr. piksel PÅ PAPIRET, utledet av papirbredde (pdfinfo) ÷
--                pikselbredde (sharp) ved PDF-konvertering. ALDRI DPI-konstanten.
-- scale_kilde  : opphav til `scale` — "tittelfelt" | "manuell" | "kalibrert" |
--                "georeferanse". Verktøyet krever menneske-bekreftet kilde.

ALTER TABLE "drawings" ADD COLUMN "mm_pr_piksel" DOUBLE PRECISION;
ALTER TABLE "drawings" ADD COLUMN "scale_kilde" TEXT;
