-- w7 (web-timeforing-plan.md § 8.5, Kenneth 2026-11-18 «Ja, (a)»): «Attestant kan attestere egne
-- timer» står på Nei for alle firmaer. Kolonnen kom i 20260501200000 med standard true, men ingen kode
-- har lest eller skrevet den før w7, så hver true i databasen er standardverdien, ikke et valg.
-- Ny standard false, og eksisterende rader settes til false. Ingen rader slettes; kjøres av Kenneth.
ALTER TABLE "organization_settings" ALTER COLUMN "tillatt_selv_attestering" SET DEFAULT false;
UPDATE "organization_settings" SET "tillatt_selv_attestering" = false WHERE "tillatt_selv_attestering" = true;
