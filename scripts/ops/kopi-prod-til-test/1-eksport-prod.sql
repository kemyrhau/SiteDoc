-- KOPI-PROD-TIL-TEST · STEG 1 · EKSPORT FRA PROD (sitedoc). GENERERT av generer.py — ikke rediger for hånd.
-- Leser bare: hele fila kjører i én READ ONLY-transaksjon (REPEATABLE READ = ett konsistent øyeblikksbilde).
-- Skriver CSV til /tmp/kopi-prod-til-test/ i postgres-containeren (psql kjører der). Anonymisering skjer i SELECT,
-- så ekte e-post, telefon og persondata havner aldri i en fil.
\set ON_ERROR_STOP on
\pset pager off
\pset footer off
SELECT current_database() AS db, now()::timestamp(0) AS tid;
DO $$ BEGIN
  IF current_database() <> 'sitedoc' THEN RAISE EXCEPTION 'STOPP: steg 1 skal kjøres mot sitedoc (prod)'; END IF;
END $$;
\! mkdir -p /tmp/kopi-prod-til-test && chmod 700 /tmp/kopi-prod-til-test && rm -f /tmp/kopi-prod-til-test/*.csv

BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;

\echo '== E0 kontroll av id-ene som skriptet bygger på (feil = stopp)'
DO $$ BEGIN
  IF (SELECT count(*) FROM organizations WHERE id = '4488fe17-7490-409f-9c1c-2827f257c54d' AND name ILIKE 'A.%Markussen%') <> 1 THEN
    RAISE EXCEPTION 'STOPP: AM-id/navn stemmer ikke i prod'; END IF;
  IF (SELECT count(*) FROM organizations WHERE id = '0bca7497-40e1-41ad-87da-d6e77f208598' AND name ILIKE 'SITEDOC MYRHAUG%') <> 1 THEN
    RAISE EXCEPTION 'STOPP: SM-id/navn stemmer ikke i prod'; END IF;
  IF (SELECT count(*) FROM users WHERE id = '74730685-c6dd-451b-aec6-ea401ec566a2' AND role = 'sitedoc_admin'
      AND left(md5(lower(email)), 12) = 'f51f39ca8fa0') <> 1 THEN
    RAISE EXCEPTION 'STOPP: Kenneths prod-id stemmer ikke'; END IF;
  RAISE NOTICE 'E0 ok: AM, SM og Kenneth stemmer i prod';
END $$;

\echo '== E1 eksport per tabell (antall rader står i manifestet E2)'
\o /tmp/kopi-prod-til-test/public.users.csv
COPY (SELECT (jsonb_populate_record(x, jsonb_build_object('email', left(x.id, 8) || '@test.sitedoc.invalid', 'email_verified', NULL, 'image', NULL, 'phone', NULL, 'fodselsdato', NULL, 'nasjonalitet', NULL, 'hms_kort_nr', NULL, 'hms_kort_utloper', NULL, 'arbeidstillatelse', NULL, 'arbeidstillatelse_utloper', NULL, 'can_login', CASE WHEN x.id IN (SELECT user_id FROM organization_members WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) THEN x.can_login ELSE false END, 'name', CASE WHEN x.id IN (SELECT user_id FROM organization_members WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) THEN x.name ELSE 'Ekstern ' || left(x.id, 8) END))).* FROM public.users x WHERE x.id IN (SELECT user_id FROM organization_members WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')
   UNION SELECT deaktivert_av_user_id FROM organization_members WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')
   UNION SELECT aktivert_av_user_id FROM organization_modules WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')
   UNION SELECT deaktivert_av_user_id FROM organization_modules WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')
   UNION SELECT sett_av_user_id FROM organization_seed_policies WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')
   UNION SELECT satt_av_user_id FROM oppmote_perioder WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')
   UNION SELECT opprettet_av_user_id FROM external_cost_objects WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')
   UNION SELECT lukket_av_user_id FROM external_cost_objects WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')
   UNION SELECT eier_id FROM timer.eksport_oppsett WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')
   UNION SELECT opprettet_av_id FROM timer.eksport_oppsett WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')
   UNION SELECT ansvarlig_user_id FROM maskin.equipment WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')
   UNION SELECT user_id FROM project_members WHERE project_id IN (SELECT id FROM projects WHERE primary_organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598') UNION SELECT project_id FROM project_organizations WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598'))
   UNION SELECT ansvarlig_id FROM dokumentflyt_parts WHERE project_id IN (SELECT id FROM projects WHERE primary_organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598') UNION SELECT project_id FROM project_organizations WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598'))
   UNION SELECT user_id FROM timer.daily_sheets WHERE id IN (SELECT id FROM timer.daily_sheets WHERE organization_id = '0bca7497-40e1-41ad-87da-d6e77f208598')
   UNION SELECT registrert_av_user_id FROM timer.daily_sheets WHERE id IN (SELECT id FROM timer.daily_sheets WHERE organization_id = '0bca7497-40e1-41ad-87da-d6e77f208598')
   UNION SELECT attestert_av_user_id FROM timer.daily_sheets WHERE id IN (SELECT id FROM timer.daily_sheets WHERE organization_id = '0bca7497-40e1-41ad-87da-d6e77f208598')
   UNION SELECT attestert_av_user_id FROM timer.sheet_timer WHERE sheet_id IN (SELECT id FROM timer.daily_sheets WHERE organization_id = '0bca7497-40e1-41ad-87da-d6e77f208598')
   UNION SELECT attestert_av_user_id FROM timer.sheet_tillegg WHERE sheet_id IN (SELECT id FROM timer.daily_sheets WHERE organization_id = '0bca7497-40e1-41ad-87da-d6e77f208598')
   UNION SELECT attestert_av_user_id FROM timer.sheet_machines WHERE sheet_id IN (SELECT id FROM timer.daily_sheets WHERE organization_id = '0bca7497-40e1-41ad-87da-d6e77f208598')
   UNION SELECT erstattet_av_user_id FROM timer.sheet_rad_historikk WHERE sheet_id IN (SELECT id FROM timer.daily_sheets WHERE organization_id = '0bca7497-40e1-41ad-87da-d6e77f208598')
   UNION SELECT registrert_av_user_id FROM varelager.vareforbruk WHERE dagsseddel_id IN (SELECT id FROM timer.daily_sheets WHERE organization_id = '0bca7497-40e1-41ad-87da-d6e77f208598')) AND x.id <> '74730685-c6dd-451b-aec6-ea401ec566a2') TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/public.organizations.csv
COPY (SELECT (jsonb_populate_record(x, jsonb_build_object('logo_url', NULL, 'invoice_email', CASE WHEN x.invoice_email IS NULL THEN NULL ELSE left(x.id, 8) || '-faktura@test.sitedoc.invalid' END))).* FROM public.organizations x WHERE x.id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/public.organization_settings.csv
COPY (SELECT x.* FROM public.organization_settings x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/public.organization_reise_grenser.csv
COPY (SELECT x.* FROM public.organization_reise_grenser x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/public.organization_partners.csv
COPY (SELECT (jsonb_populate_record(x, jsonb_build_object('contact_name', NULL, 'contact_email', NULL, 'contact_phone', NULL))).* FROM public.organization_partners x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/public.organization_modules.csv
COPY (SELECT x.* FROM public.organization_modules x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/public.organization_seed_policies.csv
COPY (SELECT x.* FROM public.organization_seed_policies x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/public.avdelinger.csv
COPY (SELECT x.* FROM public.avdelinger x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/public.arbeidstids_kalender.csv
COPY (SELECT x.* FROM public.arbeidstids_kalender x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/public.kompetansetyper.csv
COPY (SELECT x.* FROM public.kompetansetyper x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/public.organization_members.csv
COPY (SELECT x.* FROM public.organization_members x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/public.oppmotesteder.csv
COPY (SELECT x.* FROM public.oppmotesteder x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/public.oppmotested_avstand.csv
COPY (SELECT x.* FROM public.oppmotested_avstand x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/public.projects.csv
COPY (SELECT (jsonb_populate_record(x, jsonb_build_object('logo_url', NULL))).* FROM public.projects x WHERE x.id IN (SELECT id FROM projects WHERE primary_organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598') UNION SELECT project_id FROM project_organizations WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598'))) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/public.project_organizations.csv
COPY (SELECT x.* FROM public.project_organizations x WHERE x.project_id IN (SELECT id FROM projects WHERE primary_organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598') UNION SELECT project_id FROM project_organizations WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) AND x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/public.byggeplasser.csv
COPY (SELECT x.* FROM public.byggeplasser x WHERE x.project_id IN (SELECT id FROM projects WHERE primary_organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598') UNION SELECT project_id FROM project_organizations WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598'))) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/public.project_modules.csv
COPY (SELECT x.* FROM public.project_modules x WHERE x.project_id IN (SELECT id FROM projects WHERE primary_organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598') UNION SELECT project_id FROM project_organizations WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598'))) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/public.dokumentflyt_parts.csv
COPY (SELECT (jsonb_populate_record(x, jsonb_build_object('kontrakt_id', NULL, 'partner_id', NULL))).* FROM public.dokumentflyt_parts x WHERE x.project_id IN (SELECT id FROM projects WHERE primary_organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598') UNION SELECT project_id FROM project_organizations WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598'))) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/public.project_members.csv
COPY (SELECT x.* FROM public.project_members x WHERE x.project_id IN (SELECT id FROM projects WHERE primary_organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598') UNION SELECT project_id FROM project_organizations WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598'))) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/public.dokumentflyt_koblinger.csv
COPY (SELECT x.* FROM public.dokumentflyt_koblinger x WHERE x.project_member_id IN (SELECT id FROM project_members WHERE project_id IN (SELECT id FROM projects WHERE primary_organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598') UNION SELECT project_id FROM project_organizations WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')))) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/public.project_groups.csv
COPY (SELECT x.* FROM public.project_groups x WHERE x.project_id IN (SELECT id FROM projects WHERE primary_organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598') UNION SELECT project_id FROM project_organizations WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598'))) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/public.project_group_members.csv
COPY (SELECT x.* FROM public.project_group_members x WHERE x.group_id IN (SELECT id FROM project_groups WHERE project_id IN (SELECT id FROM projects WHERE primary_organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598') UNION SELECT project_id FROM project_organizations WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')))) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/public.group_faggrupper.csv
COPY (SELECT x.* FROM public.group_faggrupper x WHERE x.group_id IN (SELECT id FROM project_groups WHERE project_id IN (SELECT id FROM projects WHERE primary_organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598') UNION SELECT project_id FROM project_organizations WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')))) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/public.project_group_byggeplasser.csv
COPY (SELECT x.* FROM public.project_group_byggeplasser x WHERE x.group_id IN (SELECT id FROM project_groups WHERE project_id IN (SELECT id FROM projects WHERE primary_organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598') UNION SELECT project_id FROM project_organizations WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')))) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/public.oppmote_perioder.csv
COPY (SELECT x.* FROM public.oppmote_perioder x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/public.reisetid_matrise.csv
COPY (SELECT x.* FROM public.reisetid_matrise x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/public.external_cost_objects.csv
COPY (SELECT x.* FROM public.external_cost_objects x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/timer.lonnsarter.csv
COPY (SELECT x.* FROM timer.lonnsarter x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/timer.aktiviteter.csv
COPY (SELECT x.* FROM timer.aktiviteter x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/timer.tillegg.csv
COPY (SELECT x.* FROM timer.tillegg x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/timer.expense_categories.csv
COPY (SELECT x.* FROM timer.expense_categories x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/timer.prosjekt_ordning_overstyring.csv
COPY (SELECT x.* FROM timer.prosjekt_ordning_overstyring x WHERE x.expense_category_id IN (SELECT id FROM timer.expense_categories WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598'))) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/timer.eksport_oppsett.csv
COPY (SELECT x.* FROM timer.eksport_oppsett x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/maskin.equipment.csv
COPY (SELECT (jsonb_populate_record(x, jsonb_build_object('bilder', NULL))).* FROM maskin.equipment x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/varelager.vare_kategorier.csv
COPY (SELECT x.* FROM varelager.vare_kategorier x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/varelager.varer.csv
COPY (SELECT x.* FROM varelager.varer x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/timer.daily_sheets.csv
COPY (SELECT x.* FROM timer.daily_sheets x WHERE x.id IN (SELECT id FROM timer.daily_sheets WHERE organization_id = '0bca7497-40e1-41ad-87da-d6e77f208598')) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/timer.sheet_timer.csv
COPY (SELECT x.* FROM timer.sheet_timer x WHERE x.sheet_id IN (SELECT id FROM timer.daily_sheets WHERE organization_id = '0bca7497-40e1-41ad-87da-d6e77f208598')) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/timer.sheet_timer_forslag.csv
COPY (SELECT x.* FROM timer.sheet_timer_forslag x WHERE x.sheet_id IN (SELECT id FROM timer.daily_sheets WHERE organization_id = '0bca7497-40e1-41ad-87da-d6e77f208598')) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/timer.sheet_tillegg.csv
COPY (SELECT x.* FROM timer.sheet_tillegg x WHERE x.sheet_id IN (SELECT id FROM timer.daily_sheets WHERE organization_id = '0bca7497-40e1-41ad-87da-d6e77f208598')) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/timer.sheet_utlegg.csv
COPY (SELECT x.* FROM timer.sheet_utlegg x WHERE x.sheet_id IN (SELECT id FROM timer.daily_sheets WHERE organization_id = '0bca7497-40e1-41ad-87da-d6e77f208598')) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/timer.sheet_machines.csv
COPY (SELECT x.* FROM timer.sheet_machines x WHERE x.sheet_id IN (SELECT id FROM timer.daily_sheets WHERE organization_id = '0bca7497-40e1-41ad-87da-d6e77f208598')) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/timer.sheet_rad_historikk.csv
COPY (SELECT x.* FROM timer.sheet_rad_historikk x WHERE x.sheet_id IN (SELECT id FROM timer.daily_sheets WHERE organization_id = '0bca7497-40e1-41ad-87da-d6e77f208598')) TO STDOUT WITH (FORMAT csv);
\o
\o /tmp/kopi-prod-til-test/varelager.vareforbruk.csv
COPY (SELECT x.* FROM varelager.vareforbruk x WHERE x.dagsseddel_id IN (SELECT id FROM timer.daily_sheets WHERE organization_id = '0bca7497-40e1-41ad-87da-d6e77f208598')) TO STDOUT WITH (FORMAT csv);
\o

\echo '== E2 manifest: antall rader per tabell i eksporten'
\o /tmp/kopi-prod-til-test/_manifest.csv
COPY (
  SELECT 'public.users', count(*) FROM (SELECT (jsonb_populate_record(x, jsonb_build_object('email', left(x.id, 8) || '@test.sitedoc.invalid', 'email_verified', NULL, 'image', NULL, 'phone', NULL, 'fodselsdato', NULL, 'nasjonalitet', NULL, 'hms_kort_nr', NULL, 'hms_kort_utloper', NULL, 'arbeidstillatelse', NULL, 'arbeidstillatelse_utloper', NULL, 'can_login', CASE WHEN x.id IN (SELECT user_id FROM organization_members WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) THEN x.can_login ELSE false END, 'name', CASE WHEN x.id IN (SELECT user_id FROM organization_members WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) THEN x.name ELSE 'Ekstern ' || left(x.id, 8) END))).* FROM public.users x WHERE x.id IN (SELECT user_id FROM organization_members WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')
   UNION SELECT deaktivert_av_user_id FROM organization_members WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')
   UNION SELECT aktivert_av_user_id FROM organization_modules WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')
   UNION SELECT deaktivert_av_user_id FROM organization_modules WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')
   UNION SELECT sett_av_user_id FROM organization_seed_policies WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')
   UNION SELECT satt_av_user_id FROM oppmote_perioder WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')
   UNION SELECT opprettet_av_user_id FROM external_cost_objects WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')
   UNION SELECT lukket_av_user_id FROM external_cost_objects WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')
   UNION SELECT eier_id FROM timer.eksport_oppsett WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')
   UNION SELECT opprettet_av_id FROM timer.eksport_oppsett WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')
   UNION SELECT ansvarlig_user_id FROM maskin.equipment WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')
   UNION SELECT user_id FROM project_members WHERE project_id IN (SELECT id FROM projects WHERE primary_organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598') UNION SELECT project_id FROM project_organizations WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598'))
   UNION SELECT ansvarlig_id FROM dokumentflyt_parts WHERE project_id IN (SELECT id FROM projects WHERE primary_organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598') UNION SELECT project_id FROM project_organizations WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598'))
   UNION SELECT user_id FROM timer.daily_sheets WHERE id IN (SELECT id FROM timer.daily_sheets WHERE organization_id = '0bca7497-40e1-41ad-87da-d6e77f208598')
   UNION SELECT registrert_av_user_id FROM timer.daily_sheets WHERE id IN (SELECT id FROM timer.daily_sheets WHERE organization_id = '0bca7497-40e1-41ad-87da-d6e77f208598')
   UNION SELECT attestert_av_user_id FROM timer.daily_sheets WHERE id IN (SELECT id FROM timer.daily_sheets WHERE organization_id = '0bca7497-40e1-41ad-87da-d6e77f208598')
   UNION SELECT attestert_av_user_id FROM timer.sheet_timer WHERE sheet_id IN (SELECT id FROM timer.daily_sheets WHERE organization_id = '0bca7497-40e1-41ad-87da-d6e77f208598')
   UNION SELECT attestert_av_user_id FROM timer.sheet_tillegg WHERE sheet_id IN (SELECT id FROM timer.daily_sheets WHERE organization_id = '0bca7497-40e1-41ad-87da-d6e77f208598')
   UNION SELECT attestert_av_user_id FROM timer.sheet_machines WHERE sheet_id IN (SELECT id FROM timer.daily_sheets WHERE organization_id = '0bca7497-40e1-41ad-87da-d6e77f208598')
   UNION SELECT erstattet_av_user_id FROM timer.sheet_rad_historikk WHERE sheet_id IN (SELECT id FROM timer.daily_sheets WHERE organization_id = '0bca7497-40e1-41ad-87da-d6e77f208598')
   UNION SELECT registrert_av_user_id FROM varelager.vareforbruk WHERE dagsseddel_id IN (SELECT id FROM timer.daily_sheets WHERE organization_id = '0bca7497-40e1-41ad-87da-d6e77f208598')) AND x.id <> '74730685-c6dd-451b-aec6-ea401ec566a2') q
  UNION ALL SELECT 'public.organizations', count(*) FROM (SELECT (jsonb_populate_record(x, jsonb_build_object('logo_url', NULL, 'invoice_email', CASE WHEN x.invoice_email IS NULL THEN NULL ELSE left(x.id, 8) || '-faktura@test.sitedoc.invalid' END))).* FROM public.organizations x WHERE x.id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) q
  UNION ALL SELECT 'public.organization_settings', count(*) FROM (SELECT x.* FROM public.organization_settings x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) q
  UNION ALL SELECT 'public.organization_reise_grenser', count(*) FROM (SELECT x.* FROM public.organization_reise_grenser x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) q
  UNION ALL SELECT 'public.organization_partners', count(*) FROM (SELECT (jsonb_populate_record(x, jsonb_build_object('contact_name', NULL, 'contact_email', NULL, 'contact_phone', NULL))).* FROM public.organization_partners x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) q
  UNION ALL SELECT 'public.organization_modules', count(*) FROM (SELECT x.* FROM public.organization_modules x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) q
  UNION ALL SELECT 'public.organization_seed_policies', count(*) FROM (SELECT x.* FROM public.organization_seed_policies x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) q
  UNION ALL SELECT 'public.avdelinger', count(*) FROM (SELECT x.* FROM public.avdelinger x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) q
  UNION ALL SELECT 'public.arbeidstids_kalender', count(*) FROM (SELECT x.* FROM public.arbeidstids_kalender x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) q
  UNION ALL SELECT 'public.kompetansetyper', count(*) FROM (SELECT x.* FROM public.kompetansetyper x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) q
  UNION ALL SELECT 'public.organization_members', count(*) FROM (SELECT x.* FROM public.organization_members x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) q
  UNION ALL SELECT 'public.oppmotesteder', count(*) FROM (SELECT x.* FROM public.oppmotesteder x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) q
  UNION ALL SELECT 'public.oppmotested_avstand', count(*) FROM (SELECT x.* FROM public.oppmotested_avstand x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) q
  UNION ALL SELECT 'public.projects', count(*) FROM (SELECT (jsonb_populate_record(x, jsonb_build_object('logo_url', NULL))).* FROM public.projects x WHERE x.id IN (SELECT id FROM projects WHERE primary_organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598') UNION SELECT project_id FROM project_organizations WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598'))) q
  UNION ALL SELECT 'public.project_organizations', count(*) FROM (SELECT x.* FROM public.project_organizations x WHERE x.project_id IN (SELECT id FROM projects WHERE primary_organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598') UNION SELECT project_id FROM project_organizations WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) AND x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) q
  UNION ALL SELECT 'public.byggeplasser', count(*) FROM (SELECT x.* FROM public.byggeplasser x WHERE x.project_id IN (SELECT id FROM projects WHERE primary_organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598') UNION SELECT project_id FROM project_organizations WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598'))) q
  UNION ALL SELECT 'public.project_modules', count(*) FROM (SELECT x.* FROM public.project_modules x WHERE x.project_id IN (SELECT id FROM projects WHERE primary_organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598') UNION SELECT project_id FROM project_organizations WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598'))) q
  UNION ALL SELECT 'public.dokumentflyt_parts', count(*) FROM (SELECT (jsonb_populate_record(x, jsonb_build_object('kontrakt_id', NULL, 'partner_id', NULL))).* FROM public.dokumentflyt_parts x WHERE x.project_id IN (SELECT id FROM projects WHERE primary_organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598') UNION SELECT project_id FROM project_organizations WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598'))) q
  UNION ALL SELECT 'public.project_members', count(*) FROM (SELECT x.* FROM public.project_members x WHERE x.project_id IN (SELECT id FROM projects WHERE primary_organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598') UNION SELECT project_id FROM project_organizations WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598'))) q
  UNION ALL SELECT 'public.dokumentflyt_koblinger', count(*) FROM (SELECT x.* FROM public.dokumentflyt_koblinger x WHERE x.project_member_id IN (SELECT id FROM project_members WHERE project_id IN (SELECT id FROM projects WHERE primary_organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598') UNION SELECT project_id FROM project_organizations WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')))) q
  UNION ALL SELECT 'public.project_groups', count(*) FROM (SELECT x.* FROM public.project_groups x WHERE x.project_id IN (SELECT id FROM projects WHERE primary_organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598') UNION SELECT project_id FROM project_organizations WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598'))) q
  UNION ALL SELECT 'public.project_group_members', count(*) FROM (SELECT x.* FROM public.project_group_members x WHERE x.group_id IN (SELECT id FROM project_groups WHERE project_id IN (SELECT id FROM projects WHERE primary_organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598') UNION SELECT project_id FROM project_organizations WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')))) q
  UNION ALL SELECT 'public.group_faggrupper', count(*) FROM (SELECT x.* FROM public.group_faggrupper x WHERE x.group_id IN (SELECT id FROM project_groups WHERE project_id IN (SELECT id FROM projects WHERE primary_organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598') UNION SELECT project_id FROM project_organizations WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')))) q
  UNION ALL SELECT 'public.project_group_byggeplasser', count(*) FROM (SELECT x.* FROM public.project_group_byggeplasser x WHERE x.group_id IN (SELECT id FROM project_groups WHERE project_id IN (SELECT id FROM projects WHERE primary_organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598') UNION SELECT project_id FROM project_organizations WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')))) q
  UNION ALL SELECT 'public.oppmote_perioder', count(*) FROM (SELECT x.* FROM public.oppmote_perioder x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) q
  UNION ALL SELECT 'public.reisetid_matrise', count(*) FROM (SELECT x.* FROM public.reisetid_matrise x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) q
  UNION ALL SELECT 'public.external_cost_objects', count(*) FROM (SELECT x.* FROM public.external_cost_objects x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) q
  UNION ALL SELECT 'timer.lonnsarter', count(*) FROM (SELECT x.* FROM timer.lonnsarter x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) q
  UNION ALL SELECT 'timer.aktiviteter', count(*) FROM (SELECT x.* FROM timer.aktiviteter x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) q
  UNION ALL SELECT 'timer.tillegg', count(*) FROM (SELECT x.* FROM timer.tillegg x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) q
  UNION ALL SELECT 'timer.expense_categories', count(*) FROM (SELECT x.* FROM timer.expense_categories x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) q
  UNION ALL SELECT 'timer.prosjekt_ordning_overstyring', count(*) FROM (SELECT x.* FROM timer.prosjekt_ordning_overstyring x WHERE x.expense_category_id IN (SELECT id FROM timer.expense_categories WHERE organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598'))) q
  UNION ALL SELECT 'timer.eksport_oppsett', count(*) FROM (SELECT x.* FROM timer.eksport_oppsett x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) q
  UNION ALL SELECT 'maskin.equipment', count(*) FROM (SELECT (jsonb_populate_record(x, jsonb_build_object('bilder', NULL))).* FROM maskin.equipment x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) q
  UNION ALL SELECT 'varelager.vare_kategorier', count(*) FROM (SELECT x.* FROM varelager.vare_kategorier x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) q
  UNION ALL SELECT 'varelager.varer', count(*) FROM (SELECT x.* FROM varelager.varer x WHERE x.organization_id IN ('4488fe17-7490-409f-9c1c-2827f257c54d','0bca7497-40e1-41ad-87da-d6e77f208598')) q
  UNION ALL SELECT 'timer.daily_sheets', count(*) FROM (SELECT x.* FROM timer.daily_sheets x WHERE x.id IN (SELECT id FROM timer.daily_sheets WHERE organization_id = '0bca7497-40e1-41ad-87da-d6e77f208598')) q
  UNION ALL SELECT 'timer.sheet_timer', count(*) FROM (SELECT x.* FROM timer.sheet_timer x WHERE x.sheet_id IN (SELECT id FROM timer.daily_sheets WHERE organization_id = '0bca7497-40e1-41ad-87da-d6e77f208598')) q
  UNION ALL SELECT 'timer.sheet_timer_forslag', count(*) FROM (SELECT x.* FROM timer.sheet_timer_forslag x WHERE x.sheet_id IN (SELECT id FROM timer.daily_sheets WHERE organization_id = '0bca7497-40e1-41ad-87da-d6e77f208598')) q
  UNION ALL SELECT 'timer.sheet_tillegg', count(*) FROM (SELECT x.* FROM timer.sheet_tillegg x WHERE x.sheet_id IN (SELECT id FROM timer.daily_sheets WHERE organization_id = '0bca7497-40e1-41ad-87da-d6e77f208598')) q
  UNION ALL SELECT 'timer.sheet_utlegg', count(*) FROM (SELECT x.* FROM timer.sheet_utlegg x WHERE x.sheet_id IN (SELECT id FROM timer.daily_sheets WHERE organization_id = '0bca7497-40e1-41ad-87da-d6e77f208598')) q
  UNION ALL SELECT 'timer.sheet_machines', count(*) FROM (SELECT x.* FROM timer.sheet_machines x WHERE x.sheet_id IN (SELECT id FROM timer.daily_sheets WHERE organization_id = '0bca7497-40e1-41ad-87da-d6e77f208598')) q
  UNION ALL SELECT 'timer.sheet_rad_historikk', count(*) FROM (SELECT x.* FROM timer.sheet_rad_historikk x WHERE x.sheet_id IN (SELECT id FROM timer.daily_sheets WHERE organization_id = '0bca7497-40e1-41ad-87da-d6e77f208598')) q
  UNION ALL SELECT 'varelager.vareforbruk', count(*) FROM (SELECT x.* FROM varelager.vareforbruk x WHERE x.dagsseddel_id IN (SELECT id FROM timer.daily_sheets WHERE organization_id = '0bca7497-40e1-41ad-87da-d6e77f208598')) q
) TO STDOUT WITH (FORMAT csv);
\o
\echo '== E3 kolonne-fingeravtrykk (import stopper hvis test har annen kolonnerekkefølge/type)'
\o /tmp/kopi-prod-til-test/_kolonner.csv
COPY (
  SELECT table_schema || '.' || table_name,
         string_agg(column_name || ':' || udt_name, ',' ORDER BY ordinal_position)
  FROM information_schema.columns
  WHERE table_schema || '.' || table_name IN ('public.users', 'public.organizations', 'public.organization_settings', 'public.organization_reise_grenser', 'public.organization_partners', 'public.organization_modules', 'public.organization_seed_policies', 'public.avdelinger', 'public.arbeidstids_kalender', 'public.kompetansetyper', 'public.organization_members', 'public.oppmotesteder', 'public.oppmotested_avstand', 'public.projects', 'public.project_organizations', 'public.byggeplasser', 'public.project_modules', 'public.dokumentflyt_parts', 'public.project_members', 'public.dokumentflyt_koblinger', 'public.project_groups', 'public.project_group_members', 'public.group_faggrupper', 'public.project_group_byggeplasser', 'public.oppmote_perioder', 'public.reisetid_matrise', 'public.external_cost_objects', 'timer.lonnsarter', 'timer.aktiviteter', 'timer.tillegg', 'timer.expense_categories', 'timer.prosjekt_ordning_overstyring', 'timer.eksport_oppsett', 'maskin.equipment', 'varelager.vare_kategorier', 'varelager.varer', 'timer.daily_sheets', 'timer.sheet_timer', 'timer.sheet_timer_forslag', 'timer.sheet_tillegg', 'timer.sheet_utlegg', 'timer.sheet_machines', 'timer.sheet_rad_historikk', 'varelager.vareforbruk')
  GROUP BY 1
) TO STDOUT WITH (FORMAT csv);
\o
ROLLBACK;
\! chmod 600 /tmp/kopi-prod-til-test/*.csv && wc -l /tmp/kopi-prod-til-test/_manifest.csv /tmp/kopi-prod-til-test/_kolonner.csv

