-- Tegningsserie (T2, 2026-10-08, Kenneth-gatet 2026-10-06: «merk tegninger → flytt dem
-- inn i en serie … gi serier nye navn/metadata etterpå»).
--
-- ÉN NY TABELL + ÉN NY NULLABLE KOLONNE. Ingen eksisterende kolonne droppes, ingen data
-- migreres, ingen rad røres. Reversibel i praksis: DROP TABLE "tegningsserier" + DROP COLUMN
-- "drawings"."serie_id" gjenoppretter forrige tilstand. Additiv → to-stegs-policyen gjelder
-- ikke (ingen kolonne fjernes, ingen NOT NULL settes på eksisterende data).
--
-- «Stille tomhet» (Kenneth-regel), alle tre ledd:
--   (a) BACKFILL — IKKE AKTUELT, begrunnet: «ingen serie» er en GYLDIG, entydig tilstand
--       (som standalone-prosjekt med organizationId NULL). serie_id er bevisst tom på alle
--       eksisterende tegninger; en serie oppstår først når brukeren merker tegninger og
--       trykker «Ny serie fra valgte». Det finnes ingen historisk serie-tilhørighet å fylle.
--   (b) DB-GARANTI — FK "drawings_serie_id_fkey" ON DELETE SET NULL (sletting av en serie
--       nuller koblingen, aldri sletter tegningen) + indeks "drawings_serie_id_idx". Ingen
--       unik-krav: flere tegninger SKAL kunne dele samme serie (det er hele poenget), og en
--       serie uten tegninger er lovlig (tom nyopprettet serie).
--   (c) TEST — tegning-serie-gruppe.integration.test.ts (db/api) beviser at sletting av en
--       serie setter serie_id = NULL og BEVARER tegningen (DoD test 10), at «Flytt til serie»
--       kun rører serie_id (test 11), og at hentForByggeplass returnerer serie_id-feltet
--       (test 12). tegning-serie-gruppe.test.ts (enhet) låser at serie-schemaet IKKE bærer
--       revisjon/målestokk/status (test 9) — serien grupperer, den versjoneres ikke.

-- AlterTable: ny valgfri serie-kobling på tegningen (NULL = «ikke i serie»)
ALTER TABLE "drawings" ADD COLUMN "serie_id" TEXT;

-- CreateTable
CREATE TABLE "tegningsserier" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "byggeplass_id" TEXT,
    "name" TEXT NOT NULL,
    "discipline" TEXT,
    "originator" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tegningsserier_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: serien hører til prosjekt (Cascade) + evt. byggeplass (SET NULL, som Drawing)
ALTER TABLE "tegningsserier" ADD CONSTRAINT "tegningsserier_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tegningsserier" ADD CONSTRAINT "tegningsserier_byggeplass_id_fkey" FOREIGN KEY ("byggeplass_id") REFERENCES "byggeplasser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: tegningen peker på serien. ON DELETE SET NULL = sletting av serien
-- løsner tegningen, sletter den aldri (DoD test 10).
ALTER TABLE "drawings" ADD CONSTRAINT "drawings_serie_id_fkey" FOREIGN KEY ("serie_id") REFERENCES "tegningsserier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex: FK-ytelse + prosjektisolering-oppslag
CREATE INDEX "drawings_serie_id_idx" ON "drawings"("serie_id");
CREATE INDEX "tegningsserier_project_id_idx" ON "tegningsserier"("project_id");
CREATE INDEX "tegningsserier_byggeplass_id_idx" ON "tegningsserier"("byggeplass_id");
