-- Unikt løpenummer pr. mal på checklists og tasks (2026-09-08)
--
-- Løpenummeret utledes fra `MAX(number) + 1` scopet til templateId, i en
-- transaksjon, men UTEN lås (Read Committed) — sjekkliste.opprett (sjekkliste.ts)
-- og oppgave.opprett (oppgave.ts). To samtidige opprettelser i samme mal kan
-- lese samme MAX og få samme nummer. Skjer online i dag; offline gjør det bare
-- hyppigere. Denne indeksen gjør duplikatet umulig — den ene racende
-- opprettelsen feiler på unikhet og retryes (medNummerRetry) med ny MAX.
--
-- FULL constraint, IKKE partiell (WHERE deleted_at IS NULL):
--   Nummer-tildelingen teller BEVISST soft-slettede rader (sjekkliste.ts:488-497,
--   aggregate uten deletedAt-guard) for å bevare nummer-monotoni — et gjenopprettet
--   dokument skal aldri dele nummer med et nyopprettet. En partiell constraint
--   ville tillatt at et slettet og et nytt dokument delte nummer, og dermed
--   motsagt den regelen. Full constraint er derfor riktig.
--
-- NULL er distinkt i Postgres: maler uten `prefix` gir aldri nummer (number
-- forblir NULL), så vilkårlig mange nummerløse dokumenter pr. mal er lovlige.
--
-- To-stegs migrerings-policy (CLAUDE.md): rent additivt (to indekser). Ingen
-- DROP, ingen backfill, ingen datamigrering.
--
-- 🔴 Trygg UTEN opprydding: prod-telling 2026-09-08 ga 0 duplikater i BEGGE
--    tabeller, UTEN deleted_at-filter (dvs. talt over alle rader, også slettede).
--    Den fulle constrainten kan derfor bygges direkte — ingen tilbakerulling.

CREATE UNIQUE INDEX "checklists_template_id_number_key" ON "checklists"("template_id", "number");

CREATE UNIQUE INDEX "tasks_template_id_number_key" ON "tasks"("template_id", "number");
