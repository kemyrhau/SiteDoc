-- Område som lokasjonsnivå på sjekkliste og oppgave (steg 2b, 2026-09-23, Kenneth-gatet).
--
-- ADDITIV og NULLABLE. To nye kolonner (`omrade_id` på checklists + tasks), begge nullable,
-- med FK til omrader og ON DELETE SET NULL (som KontrollplanPunkt.omrade). Ingen kolonne
-- droppes, ingen settes NOT NULL, ingen data migreres. To-stegs-policyen (CLAUDE.md): dette
-- er STEG 1 (legg til nullable) — en senere release kan evt. stramme, men denne rører ikke det.
-- Reversibel i praksis: DROP COLUMN gjenoppretter forrige tilstand.
--
-- «Stille tomhet» (Kenneth-regel):
--   (a) BACKFILL — IKKE AKTUELT, begrunnet: INGEN eksisterende rad HAR et område i dag
--       (feltet fantes ikke). Kolonnen skal være tom der prosjektet ikke bruker områder
--       («dersom prosjektet mener dette er nyttig», Kenneth 2026-09-23) — en tom kolonne er
--       her den korrekte tilstanden, ikke en felle.
--   (b) DB-GARANTI — WAIVES for denne kolonnen (design/ordre 2026-09-23): omradeId er en
--       VALGFRI kobling, ikke en identitet. Den eneste ugyldige tilstanden — lokasjonOmfang=
--       "omrade" MED omradeId=null — håndheves i app-laget (validering i oppgave/sjekkliste),
--       ikke med en DB-CHECK, slik at feilmeldingen blir lesbar og enkeltkilde med klienten.
--   (c) TEST — omrade-lokasjonsomfang.test.ts (api) feiler når et dokument har omfang="omrade"
--       og omradeId=null (DoD 12), og omrade-lokasjonsniva-migrering.test.ts (db) feiler hvis
--       denne migreringen slutter å være additiv/nullable eller mister SET NULL.

-- AlterTable: additiv nullable område-referanse
ALTER TABLE "checklists" ADD COLUMN "omrade_id" TEXT;
ALTER TABLE "tasks" ADD COLUMN "omrade_id" TEXT;

-- AddForeignKey: ON DELETE SET NULL (sletting av område nullstiller referansen, som KontrollplanPunkt)
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_omrade_id_fkey" FOREIGN KEY ("omrade_id") REFERENCES "omrader"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_omrade_id_fkey" FOREIGN KEY ("omrade_id") REFERENCES "omrader"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex: oppslag pr. område (og FK-ytelse)
CREATE INDEX "checklists_omrade_id_idx" ON "checklists"("omrade_id");
CREATE INDEX "tasks_omrade_id_idx" ON "tasks"("omrade_id");
