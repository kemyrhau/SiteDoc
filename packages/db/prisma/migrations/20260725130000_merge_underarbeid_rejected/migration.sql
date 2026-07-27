-- F3 Merge «Under arbeid»: `rejected` er merget inn i `in_progress`.
--
-- `status` er et String-felt (ikke enum) — «fjern rejected» betyr fjern verdien fra
-- statusmaskinen (VALID_TRANSITIONS/handlinger/etiketter), IKKE en enum-drop. Denne
-- migreringen flytter eksisterende `rejected`-rader til `in_progress` så ingen rad blir
-- foreldreløs når statusen forsvinner fra maskinen. Ballen lå allerede hos utbedreren i
-- den merged tilstanden — ingen datatap. Dekker HMS også (samme checklists/tasks-tabeller,
-- domain-feltet skiller HMS).
--
-- ⚠️ GATE (byggeordre F3): KJØRES IKKE mot test/prod uten Kenneths eksplisitte go.
-- Kjøres ved deploy SAMMEN med koden (build → migrate deploy → up), så ingen rad står
-- som `rejected` etter at statusen er fjernet fra maskinen.

UPDATE "checklists" SET "status" = 'in_progress' WHERE "status" = 'rejected';
UPDATE "tasks" SET "status" = 'in_progress' WHERE "status" = 'rejected';
