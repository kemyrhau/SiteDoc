-- Overflate-tabell (punktsky steg 1, 2026-09-24, Kenneth-gatet EKSPLISITT).
--
-- ÉN NY TABELL. Ingen eksisterende tabell endres, ingen kolonne droppes, ingen data
-- migreres. Reversibel i praksis: DROP TABLE "overflater" gjenoppretter forrige tilstand.
--
-- To kilder, én tabell: kilde="punktsky" (TIN avledet server-side fra en LAS) og
-- kilde="landxml" (importert TIN). En LandXML-flate har verken målavstand eller
-- bakkemetode — derfor er malavstand_m/bakke_metode NULLABLE, ikke NOT NULL. NOT NULL
-- ville tvunget oppdiktede verdier på landxml-rader = «stille tomhet i forkledning».
--
-- «Stille tomhet» (Kenneth-regel), alle tre ledd:
--   (a) BACKFILL — IKKE AKTUELT, begrunnet: ny tom tabell, det finnes ingen historiske
--       overflater å fylle. Rader oppstår først når en punktsky overflateberegnes eller
--       en LandXML importeres.
--   (b) DB-GARANTI — TO stykker:
--       · PARTIAL UNIQUE (point_cloud_id, malavstand_m) WHERE point_cloud_id IS NOT NULL:
--         samme punktsky skal ikke kunne gi to identiske overflater med samme målavstand.
--         Partial fordi Postgres regner NULL som distinkt — landxml-rader (point_cloud_id
--         NULL) skal ikke kollidere med hverandre (samme felle som omrade_id i steg 2b).
--       · CHECK mot tvetydighet: en punktsky-overflate UTEN målavstand/bakkemetode er en
--         navngivbar tomhet — «avledet fra en sky, men vi vet ikke hvordan». CHECK-en gjør
--         nettopp DEN ulovlig, uten å tvinge feltene på landxml-rader. Speiler CHECK-mønsteret
--         fra 20260923120000_omrade_lokasjonsniva. Additiv: en CHECK er ikke NOT NULL.
--   (c) TEST — overflate-tabell-migrering.test.ts (db) låser at migreringen er additiv +
--       at CHECK + partial unique er til stede; overflate-check-constraint.integration.test.ts
--       (api) beviser at DB-en selv AVVISER en punktsky-rad med tomt felt (rød først: uten
--       CHECK går raden inn) OG at partial unique virker i begge retninger.

-- CreateTable
CREATE TABLE "overflater" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "byggeplass_id" TEXT,
    "navn" TEXT NOT NULL,
    "kilde" TEXT NOT NULL,
    "point_cloud_id" TEXT,
    "fil_url" TEXT NOT NULL,
    "malavstand_m" DOUBLE PRECISION,
    "bakke_metode" TEXT,
    "ramme" TEXT NOT NULL,
    "origo_beskrivelse" TEXT,
    "punkt_antall" INTEGER,
    "bounding_box" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "overflater_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: prosjekt (Cascade), byggeplass + punktsky (SET NULL, som PointCloud)
ALTER TABLE "overflater" ADD CONSTRAINT "overflater_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "overflater" ADD CONSTRAINT "overflater_byggeplass_id_fkey" FOREIGN KEY ("byggeplass_id") REFERENCES "byggeplasser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "overflater" ADD CONSTRAINT "overflater_point_cloud_id_fkey" FOREIGN KEY ("point_cloud_id") REFERENCES "point_clouds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex: prosjektisolering-oppslag + FK-ytelse
CREATE INDEX "overflater_project_id_idx" ON "overflater"("project_id");
CREATE INDEX "overflater_byggeplass_id_idx" ON "overflater"("byggeplass_id");
CREATE INDEX "overflater_point_cloud_id_idx" ON "overflater"("point_cloud_id");

-- CreateIndex: PARTIAL UNIQUE — samme punktsky + samme målavstand = samme overflate.
-- WHERE point_cloud_id IS NOT NULL: landxml-rader (NULL) unntas, ellers ville Postgres'
-- NULL-distinkthet uansett tillate dubletter — men vi vil ikke at to landxml skal telle
-- som kollisjon på (NULL, NULL). (Samme mønster som 20260917120000_unik_indeks_partiell.)
CREATE UNIQUE INDEX "overflater_pointcloud_malavstand_key" ON "overflater"("point_cloud_id", "malavstand_m") WHERE "point_cloud_id" IS NOT NULL;

-- CHECK: DB-garanti mot tvetydigheten «punktsky-overflate UTEN målavstand/bakkemetode».
-- Feltene er valgfrie for landxml, men for kilde="punktsky" MÅ begge være satt.
ALTER TABLE "overflater"
    ADD CONSTRAINT "overflater_punktsky_felt_check"
    CHECK ("kilde" <> 'punktsky' OR ("malavstand_m" IS NOT NULL AND "bakke_metode" IS NOT NULL));
