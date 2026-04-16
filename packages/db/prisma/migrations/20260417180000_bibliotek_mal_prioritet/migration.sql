-- AlterTable: Legg til prioritet-felt på bibliotek_maler (1=grunnpakke, 2=utvidet, 3=spesialist)
ALTER TABLE "bibliotek_maler" ADD COLUMN "prioritet" INTEGER NOT NULL DEFAULT 1;
