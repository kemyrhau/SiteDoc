-- Terminologi-rename: pensjonert → utgaatt (2026-05-02)
-- ======================================================
-- UI-tekst sier «Utgått» — schema, kolonner og status-verdi følger nå samme
-- terminologi for å unngå drift mellom UI og DB. Atomisk migrasjon — RENAME
-- bevarer data, UPDATE flytter status-verdi.
--
-- Risiko-vindu: pre-deploy-kode som leser/skriver pensjonert_dato/grunn
-- vil få P2022 (kolonne ikke funnet) i sekundene mellom migrate-deploy og
-- pm2-restart. Akseptert fordi maskin-modulen er lite brukt i prod (kun
-- A.Markussen har modulen aktiv) og tabellen har 0 rader med
-- status='pensjonert' per kunde-onboarding-status.

UPDATE "maskin"."equipment"
  SET "status" = 'utgaatt'
  WHERE "status" = 'pensjonert';

ALTER TABLE "maskin"."equipment"
  RENAME COLUMN "pensjonert_dato" TO "utgaatt_dato";

ALTER TABLE "maskin"."equipment"
  RENAME COLUMN "pensjonert_grunn" TO "utgaatt_grunn";
