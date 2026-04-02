-- Flytt kildespråk fra mapper til prosjekt
ALTER TABLE "projects" ADD COLUMN "source_language" TEXT NOT NULL DEFAULT 'nb';

-- Kopier kildespråk fra mapper som har custom innstilling
UPDATE "projects" p
SET "source_language" = COALESCE(
  (SELECT f."source_language" FROM "folders" f
   WHERE f."project_id" = p."id" AND f."source_language" != 'nb'
   LIMIT 1),
  'nb'
);

-- Fjern source_language fra folders (beholder kolonnen for bakoverkompatibilitet, men den brukes ikke lenger)
-- ALTER TABLE "folders" DROP COLUMN "source_language";
-- Kommentert ut: beholder kolonnen midlertidig for å unngå runtime-feil fra cached Prisma-klienter
