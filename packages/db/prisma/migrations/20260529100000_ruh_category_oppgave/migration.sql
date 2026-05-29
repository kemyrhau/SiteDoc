-- RUH bytter fra sjekkliste til oppgave (vedtatt 2026-05-29).
-- Bakgrunn: RUH-fanen hentet fra checklist.findMany, men datamodellen for
-- RUH-arbeidsflyt (tildeling, statusendring, dokumentflyt) er bedre tjent
-- med task-shape som avvik allerede bruker. Server-laget i hms.ts er
-- oppdatert til å hente RUH fra task-tabellen — denne migrasjonen
-- backfiller eksisterende RUH-maler så de matcher.
--
-- Verifisert i prod 2026-05-29: 0 RUH-dokumenter eksisterer (checklists
-- JOIN report_templates WHERE subdomain='ruh' → 0 rader). Ingen
-- dokument-migrasjon nødvendig.
UPDATE "report_templates"
   SET "category" = 'oppgave'
 WHERE "subdomain" = 'ruh'
   AND "category"  = 'sjekkliste';
