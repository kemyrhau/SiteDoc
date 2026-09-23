-- Ordre unik-indeks-soft-delete (2026-09-16): partiell unik-indeks mot dobbelt-lån.
--
-- BAKGRUNN: Migrering 20260913140000 lagde en FULL unik-indeks (organization_id,
-- laant_fra_bibliotek_mal_id). Migrering 20260916120000 la til soft-delete (deleted_at).
-- Kombinasjonen ble en felle: en SOFT-SLETTET lånt mal beholder raden, så den fulle
-- indeksen teller den fortsatt → samme kapittelmal kunne IKKE lånes på nytt etter sletting
-- før papirkurven ble tømt (en angre-handling som tvang en destruktiv handling).
--
-- FIKS: dropp den fulle indeksen, lag en PARTIELL unik-indeks som kun teller AKTIVE
-- (ikke soft-slettede) rader. To aktive lån av samme bibliotekmal avvises fortsatt (P2002);
-- et lån etter soft-sletting av et tidligere lån er nå lov.
--
-- TO-STEGS-POLICY: gjelder KOLONNER (data), ikke indekser. En indeks bærer ingen data, så
-- DROP + gjenskap i samme migrering er trygt — ingen rad røres, ingen backfill nødvendig.
-- (Vurdert bevisst: å beholde den gamle indeksen parallelt ville gjenskapt fella.)
--
-- IDEMPOTENS: DROP ... IF EXISTS + CREATE ... IF NOT EXISTS → kan kjøres to ganger.
--
-- KREVER at ingen organisasjon har to AKTIVE rader med samme laant_fra_bibliotek_mal_id
-- FØR migreringen. CREATE UNIQUE INDEX FEILER HØYT ved duplikat — det er tilsiktet.
-- DRY-RUN.sql i denne mappa måler dette (read-only) FØR deploy.

-- DropIndex (den fulle, ikke-partielle indeksen fra 20260913140000)
DROP INDEX IF EXISTS "organization_templates_organization_id_laant_fra_bibliotek__key";

-- CreateIndex (partiell: kun aktive rader teller mot unikhet)
CREATE UNIQUE INDEX IF NOT EXISTS "organization_templates_org_laant_aktiv_unik"
  ON "organization_templates" ("organization_id", "laant_fra_bibliotek_mal_id")
  WHERE "deleted_at" IS NULL;
