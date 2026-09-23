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
--   (b) DB-GARANTI — CHECK mot TVETYDIGHET (design SNUDDE 2026-09-23): koblingen forblir
--       VALGFRI, men tilstanden lokasjonOmfang="omrade" MED omradeId=null er en navngivbar
--       tvetydighet — «område er valgt, men INGEN område». CHECK-en gjør nettopp DEN ulovlig,
--       uten å tvinge omradeId på rader med annet/ikke omfang. App-vaktene (oppgave/sjekkliste,
--       fire skriveveier) STÅR i tillegg — de gir lesbar feil på veiene som finnes i dag; CHECK-en
--       fanger den femte veien som kommer (og enhver rå skriv). Additiv: en CHECK er ikke NOT NULL.
--   (c) TEST — omrade-lokasjonsomfang.test.ts (api) feiler når app-laget slipper omfang="omrade"
--       + omradeId=null (DoD 12); omrade-check-constraint.integration.test.ts (api) beviser at
--       DB-en selv AVVISER kombinasjonen (sett rød først: uten CHECK går raden inn); og
--       omrade-lokasjonsniva-migrering.test.ts (db) låser at migreringen forblir additiv +
--       SET NULL + at CHECK-en er til stede.

-- AlterTable: additiv nullable område-referanse
ALTER TABLE "checklists" ADD COLUMN "omrade_id" TEXT;
ALTER TABLE "tasks" ADD COLUMN "omrade_id" TEXT;

-- AddForeignKey: ON DELETE SET NULL (sletting av område nullstiller referansen, som KontrollplanPunkt)
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_omrade_id_fkey" FOREIGN KEY ("omrade_id") REFERENCES "omrader"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_omrade_id_fkey" FOREIGN KEY ("omrade_id") REFERENCES "omrader"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex: oppslag pr. område (og FK-ytelse)
CREATE INDEX "checklists_omrade_id_idx" ON "checklists"("omrade_id");
CREATE INDEX "tasks_omrade_id_idx" ON "tasks"("omrade_id");

-- CHECK: DB-garanti mot tvetydigheten «omfang=omrade UTEN et område». Koblingen er fortsatt
-- valgfri (omradeId kan være null for punkt/byggeplass/ingen omfang) — men velges "omrade",
-- MÅ et område være satt. Speiler app-vaktene (DoD 12), backstop for enhver rå/framtidig skriv.
ALTER TABLE "checklists"
    ADD CONSTRAINT "checklists_omrade_omfang_check"
    CHECK ("lokasjon_omfang" <> 'omrade' OR "omrade_id" IS NOT NULL);
ALTER TABLE "tasks"
    ADD CONSTRAINT "tasks_omrade_omfang_check"
    CHECK ("lokasjon_omfang" <> 'omrade' OR "omrade_id" IS NOT NULL);
