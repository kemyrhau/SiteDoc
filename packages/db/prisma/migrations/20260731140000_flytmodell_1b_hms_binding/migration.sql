-- Flytmodell Fase 1b (HMS flyt-binding) — backfill av EKSISTERENDE flyt-løse HMS-dok.
-- Nye HMS-dok bindes i opprett-koden (sjekkliste.ts/oppgave.ts). Denne migreringen binder
-- de historiske HMS-dokumentene (dokumentflyt_id IS NULL) til prosjektets HMS-flyt slik at
-- gamle og nye HMS-dok blir konsistente. ALDRI drop. Idempotent (kun dokumentflyt_id IS NULL).
--
-- aktivPosisjon (HMS = 2-ledds flyt: oppretter=Ledd 1 → HMS-gruppe=Ledd 2):
--   ball hos Ledd 2 (HMS-gruppe) normalt; hos Ledd 1 (oppretter) etter besvar (responded).
--   Terminaler: closed lukkes av Ledd 2 (HMS-gruppe, kanTerminereUtenBall) → 2;
--   evt. firma-terminaler → 2 (gruppe-side / siste ledd).
--   draft (anomali — HMS starter normalt sent) → Ledd 1 (oppretter, ikke sendt).
--   Regel: draft/responded → 1, ellers → 2. sendt/terminal er alt satt av Fase 1a.
-- Binder kun HMS-dok som faktisk HAR en HMS-flyt (EXISTS dokumentflyt_maler) — gamle
-- prosjekter uten seedet HMS-flyt forblir flyt-løse (graceful, som opprett-koden).

UPDATE "checklists" c
SET "dokumentflyt_id" = (
      SELECT dm."dokumentflyt_id" FROM "dokumentflyt_maler" dm
      WHERE dm."template_id" = c."template_id" LIMIT 1
    ),
    "aktiv_posisjon" = CASE WHEN c."status" IN ('draft', 'responded') THEN 1 ELSE 2 END
WHERE c."dokumentflyt_id" IS NULL
  AND EXISTS (SELECT 1 FROM "report_templates" rt WHERE rt."id" = c."template_id" AND rt."domain" = 'hms')
  AND EXISTS (SELECT 1 FROM "dokumentflyt_maler" dm WHERE dm."template_id" = c."template_id");

UPDATE "tasks" t
SET "dokumentflyt_id" = (
      SELECT dm."dokumentflyt_id" FROM "dokumentflyt_maler" dm
      WHERE dm."template_id" = t."template_id" LIMIT 1
    ),
    "aktiv_posisjon" = CASE WHEN t."status" IN ('draft', 'responded') THEN 1 ELSE 2 END
WHERE t."dokumentflyt_id" IS NULL
  AND EXISTS (SELECT 1 FROM "report_templates" rt WHERE rt."id" = t."template_id" AND rt."domain" = 'hms')
  AND EXISTS (SELECT 1 FROM "dokumentflyt_maler" dm WHERE dm."template_id" = t."template_id");
