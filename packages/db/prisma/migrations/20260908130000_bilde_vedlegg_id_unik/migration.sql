-- Bilde-idempotens: unik vedlegg-id på images (2026-09-08)
--
-- Bilde-registreringen (bilde.opprettForSjekkliste/opprettForOppgave) gjorde blind
-- image.create. Opplastingskøen retrier feilede opplastinger, og /upload mynter et
-- nytt randomUUID-filnavn PER request — så et retry gir ny fileUrl, og samme foto
-- kan havne som flere rader. Klienten har en stabil vedlegg-id (lokal SQLite-rad);
-- den blir nå idempotens-nøkkel via upsert.
--
-- To-stegs migrerings-policy (CLAUDE.md): Steg 1 (denne) legger til NULLABLE kolonne.
-- Ingen DROP, ingen backfill.
--
-- 🔴 Trygg mot eksisterende data UTEN opprydding: alle gamle rader får vedlegg_id
--    NULL, og Postgres regner NULL som distinkt i en unik-indeks — så vilkårlig
--    mange NULL-rader er lovlige. Unikheten gjelder kun de nye, populerte radene.
--    Derfor ruller ikke denne tilbake selv om images alt har logiske duplikater.
--    Opprydding av gamle duplikater er en egen, gatet operasjon (ikke her).

ALTER TABLE "images" ADD COLUMN "vedlegg_id" TEXT;

CREATE UNIQUE INDEX "images_vedlegg_id_key" ON "images"("vedlegg_id");
