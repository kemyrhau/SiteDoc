-- HMS blir egen malbygger-type (Ordre C, D3-vedtak 2026-07-24).
-- Bakgrunn: HMS-maler lå som domain='hms' på tvers av category='oppgave'|'sjekkliste',
-- og dukket dermed opp i BÅDE oppgave- og sjekkliste-opprett-modalene. HMS løftes til
-- egen topp-nivå-type (category='hms') med egen malbygger-side og «Meld HMS»-inngang.
-- Opprett-modalene filtrerer på category, så category='hms' auto-ekskluderer HMS derfra.
--
-- Additiv: category er alt String (ingen skjemaendring). domain='hms' BEVARES —
-- runtime-identifisering av HMS-dokumenter (KPI-tellinger, erHms-guarder, flyt-logikk)
-- leser domain, ikke category. Invariant fremover: en category='hms'-mal har alltid
-- også domain='hms' (settes sammen i MalListe). To-stegs-policy: kun UPDATE, ingen DROP.
UPDATE "report_templates"
   SET "category" = 'hms'
 WHERE "domain" = 'hms';
