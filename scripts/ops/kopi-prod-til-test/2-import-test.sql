-- KOPI-PROD-TIL-TEST · STEG 2+3 · IMPORT TIL TEST (sitedoc_test). GENERERT av generer.py — ikke rediger for hånd.
-- Én transaksjon, ON_ERROR_STOP: første feil eller kontroll som ikke holder = psql avslutter og alt rulles tilbake.
-- Tørrkjøring (standard):  psql -v commit=0 …   → alt kjøres og kontrolleres, så ROLLBACK.
-- Ekte kjøring:            psql -v commit=1 …   → COMMIT bare hvis alle kontroller holder.
\set ON_ERROR_STOP on
\pset pager off
\pset footer off
\if :{?commit}
\else
  \set commit 0
\endif
SELECT current_database() AS db, now()::timestamp(0) AS tid, :'commit' AS commit_flagg;
DO $$ BEGIN
  IF current_database() <> 'sitedoc_test' THEN RAISE EXCEPTION 'STOPP: steg 2 skal kjøres mot sitedoc_test'; END IF;
END $$;

-- TEMP-tabeller lever bare i økta (spørsmål 10). Ingen skjemaendring.
CREATE TEMP TABLE _manifest (tabell text PRIMARY KEY, antall bigint);
CREATE TEMP TABLE _kolonner (tabell text PRIMARY KEY, kolonner text);
\copy _manifest FROM '/tmp/kopi-prod-til-test/_manifest.csv' WITH (FORMAT csv)
\copy _kolonner FROM '/tmp/kopi-prod-til-test/_kolonner.csv' WITH (FORMAT csv)

BEGIN;

\echo '== I0 forutsetninger på test (feil = stopp)'
DO $$
DECLARE avvik text;
BEGIN
  IF (SELECT count(*) FROM organizations WHERE id = 'f1000001-0000-0000-0000-000000000002' AND name ILIKE 'SITEDOC MYRHAUG%') <> 1 THEN
    RAISE EXCEPTION 'STOPP: test-SM (f1000001-0000-0000-0000-000000000002) finnes ikke med riktig navn';
  END IF;
  IF (SELECT count(*) FROM users WHERE id = '40153a94-f1ad-4fae-998e-707d17c68d4c' AND role = 'sitedoc_admin'
      AND left(md5(lower(email)), 12) = 'f51f39ca8fa0') <> 1 THEN
    RAISE EXCEPTION 'STOPP: Kenneths test-id (40153a94-f1ad-4fae-998e-707d17c68d4c) stemmer ikke';
  END IF;
  SELECT string_agg(id || ' «' || name || '»', ', ') INTO avvik FROM organizations
   WHERE id = '4488fe17-7490-409f-9c1c-2827f257c54d' OR name ILIKE '%markussen%'
      OR replace(coalesce(organization_number, ''), ' ', '') = '835000702';
  IF avvik IS NOT NULL THEN
    RAISE EXCEPTION 'STOPP: et A.Markussen finnes allerede på test: %', avvik;
  END IF;
  IF (SELECT count(*) FROM _manifest) <> 44 THEN
    RAISE EXCEPTION 'STOPP: manifestet har % tabeller, forventet 44', (SELECT count(*) FROM _manifest);
  END IF;
  SELECT string_agg(k.tabell, ', ') INTO avvik FROM _kolonner k
   LEFT JOIN (SELECT table_schema || '.' || table_name AS tabell,
                     string_agg(column_name || ':' || udt_name, ',' ORDER BY ordinal_position) AS kolonner
                FROM information_schema.columns GROUP BY 1) t ON t.tabell = k.tabell
   WHERE t.kolonner IS DISTINCT FROM k.kolonner;
  IF avvik IS NOT NULL OR (SELECT count(*) FROM _kolonner) <> 44 THEN
    RAISE EXCEPTION 'STOPP: kolonnene i prod og test er ulike for: %', coalesce(avvik, '(antall tabeller)');
  END IF;
  RAISE NOTICE 'I0 ok: test-SM, Kenneth, intet AM, manifest og kolonner stemmer';
END $$;

\echo '== I1 test-SMs timer-data og innstillinger som slettes (organisasjonsraden, prosjektene, malene og ECO blir stående)'
CREATE TEMP TABLE slettet (tabell text, id text);
INSERT INTO slettet SELECT 'timer.daily_sheets', id FROM timer.daily_sheets WHERE organization_id = 'f1000001-0000-0000-0000-000000000002';
INSERT INTO slettet SELECT 'timer.sheet_timer', id FROM timer.sheet_timer WHERE sheet_id IN (SELECT id FROM slettet WHERE tabell = 'timer.daily_sheets');
INSERT INTO slettet SELECT 'timer.sheet_timer_forslag', id FROM timer.sheet_timer_forslag WHERE sheet_id IN (SELECT id FROM slettet WHERE tabell = 'timer.daily_sheets');
INSERT INTO slettet SELECT 'timer.sheet_tillegg', id FROM timer.sheet_tillegg WHERE sheet_id IN (SELECT id FROM slettet WHERE tabell = 'timer.daily_sheets');
INSERT INTO slettet SELECT 'timer.sheet_tillegg_vedlegg', id FROM timer.sheet_tillegg_vedlegg WHERE sheet_tillegg_id IN (SELECT id FROM slettet WHERE tabell = 'timer.sheet_tillegg');
INSERT INTO slettet SELECT 'timer.sheet_utlegg', id FROM timer.sheet_utlegg WHERE sheet_id IN (SELECT id FROM slettet WHERE tabell = 'timer.daily_sheets');
INSERT INTO slettet SELECT 'timer.sheet_utlegg_vedlegg', id FROM timer.sheet_utlegg_vedlegg WHERE sheet_utlegg_id IN (SELECT id FROM slettet WHERE tabell = 'timer.sheet_utlegg');
INSERT INTO slettet SELECT 'timer.sheet_machines', id FROM timer.sheet_machines WHERE sheet_id IN (SELECT id FROM slettet WHERE tabell = 'timer.daily_sheets');
INSERT INTO slettet SELECT 'timer.sheet_rad_historikk', id FROM timer.sheet_rad_historikk WHERE sheet_id IN (SELECT id FROM slettet WHERE tabell = 'timer.daily_sheets');
INSERT INTO slettet SELECT 'varelager.varer', id FROM varelager.varer WHERE organization_id = 'f1000001-0000-0000-0000-000000000002';
INSERT INTO slettet SELECT 'varelager.vareforbruk', id FROM varelager.vareforbruk WHERE dagsseddel_id IN (SELECT id FROM slettet WHERE tabell = 'timer.daily_sheets') OR vare_id IN (SELECT id FROM slettet WHERE tabell = 'varelager.varer');
INSERT INTO slettet SELECT 'varelager.vare_kategorier', id FROM varelager.vare_kategorier WHERE organization_id = 'f1000001-0000-0000-0000-000000000002';
INSERT INTO slettet SELECT 'timer.expense_categories', id FROM timer.expense_categories WHERE organization_id = 'f1000001-0000-0000-0000-000000000002';
INSERT INTO slettet SELECT 'timer.prosjekt_ordning_overstyring', id FROM timer.prosjekt_ordning_overstyring WHERE expense_category_id IN (SELECT id FROM slettet WHERE tabell = 'timer.expense_categories');
INSERT INTO slettet SELECT 'timer.lonnsarter', id FROM timer.lonnsarter WHERE organization_id = 'f1000001-0000-0000-0000-000000000002';
INSERT INTO slettet SELECT 'timer.aktiviteter', id FROM timer.aktiviteter WHERE organization_id = 'f1000001-0000-0000-0000-000000000002';
INSERT INTO slettet SELECT 'timer.tillegg', id FROM timer.tillegg WHERE organization_id = 'f1000001-0000-0000-0000-000000000002';
INSERT INTO slettet SELECT 'timer.eksport_oppsett', id FROM timer.eksport_oppsett WHERE organization_id = 'f1000001-0000-0000-0000-000000000002';
INSERT INTO slettet SELECT 'maskin.equipment', id FROM maskin.equipment WHERE organization_id = 'f1000001-0000-0000-0000-000000000002';
INSERT INTO slettet SELECT 'maskin.equipment_ansvarlige', id FROM maskin.equipment_ansvarlige WHERE equipment_id IN (SELECT id FROM slettet WHERE tabell = 'maskin.equipment');
INSERT INTO slettet SELECT 'maskin.equipment_assignments', id FROM maskin.equipment_assignments WHERE equipment_id IN (SELECT id FROM slettet WHERE tabell = 'maskin.equipment');
INSERT INTO slettet SELECT 'maskin.service_records', id FROM maskin.service_records WHERE equipment_id IN (SELECT id FROM slettet WHERE tabell = 'maskin.equipment');
INSERT INTO slettet SELECT 'maskin.feilmeldinger', id FROM maskin.feilmeldinger WHERE equipment_id IN (SELECT id FROM slettet WHERE tabell = 'maskin.equipment');
INSERT INTO slettet SELECT 'maskin.vegvesen_ko', id FROM maskin.vegvesen_ko WHERE equipment_id IN (SELECT id FROM slettet WHERE tabell = 'maskin.equipment');
INSERT INTO slettet SELECT 'public.oppmote_perioder', id FROM public.oppmote_perioder WHERE organization_id = 'f1000001-0000-0000-0000-000000000002';
INSERT INTO slettet SELECT 'public.reisetid_matrise', id FROM public.reisetid_matrise WHERE organization_id = 'f1000001-0000-0000-0000-000000000002';
INSERT INTO slettet SELECT 'public.oppmotested_avstand', id FROM public.oppmotested_avstand WHERE organization_id = 'f1000001-0000-0000-0000-000000000002';
INSERT INTO slettet SELECT 'public.oppmotesteder', id FROM public.oppmotesteder WHERE organization_id = 'f1000001-0000-0000-0000-000000000002';
INSERT INTO slettet SELECT 'public.organization_members', id FROM public.organization_members WHERE organization_id = 'f1000001-0000-0000-0000-000000000002';
INSERT INTO slettet SELECT 'public.kompetansetyper', id FROM public.kompetansetyper WHERE organization_id = 'f1000001-0000-0000-0000-000000000002';
INSERT INTO slettet SELECT 'public.ansatt_kompetanser', id FROM public.ansatt_kompetanser WHERE kompetansetype_id IN (SELECT id FROM slettet WHERE tabell = 'public.kompetansetyper');
INSERT INTO slettet SELECT 'public.avdelinger', id FROM public.avdelinger WHERE organization_id = 'f1000001-0000-0000-0000-000000000002';
INSERT INTO slettet SELECT 'public.arbeidstids_kalender', id FROM public.arbeidstids_kalender WHERE organization_id = 'f1000001-0000-0000-0000-000000000002';
INSERT INTO slettet SELECT 'public.organization_modules', id FROM public.organization_modules WHERE organization_id = 'f1000001-0000-0000-0000-000000000002';
INSERT INTO slettet SELECT 'public.organization_settings', id FROM public.organization_settings WHERE organization_id = 'f1000001-0000-0000-0000-000000000002';
INSERT INTO slettet SELECT 'public.organization_reise_grenser', id FROM public.organization_reise_grenser WHERE organization_id = 'f1000001-0000-0000-0000-000000000002';
INSERT INTO slettet SELECT 'public.organization_seed_policies', id FROM public.organization_seed_policies WHERE organization_id = 'f1000001-0000-0000-0000-000000000002';
INSERT INTO slettet SELECT 'public.organization_partners', id FROM public.organization_partners WHERE organization_id = 'f1000001-0000-0000-0000-000000000002';
SELECT tabell, count(*) AS slettes FROM slettet GROUP BY 1 ORDER BY 1;

\echo '== I1b kontroll før sletting: ingen rad som blir stående, peker på en rad som slettes'
DO $$
DECLARE r record; n bigint; feil text := '';
BEGIN
  FOR r IN SELECT c.table_schema, c.table_name, c.column_name FROM information_schema.columns c
           JOIN information_schema.tables t USING (table_schema, table_name)
           WHERE t.table_type = 'BASE TABLE' AND c.table_schema IN ('public','timer','maskin','varelager')
             AND c.column_name LIKE '%\_id' AND c.data_type IN ('text','character varying')
             AND c.column_name NOT IN ('kort_id', 'original_rad_id', 'proadm_id', 'kilde_id')
             AND c.table_schema || '.' || c.table_name NOT IN ('public.activity_log', 'public.impersonation_audit') LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = r.table_schema AND table_name = r.table_name AND column_name = 'id') THEN
      EXECUTE format('SELECT count(*) FROM %I.%I WHERE %I IN (SELECT id FROM slettet) '
                     'AND id NOT IN (SELECT id FROM slettet WHERE tabell = %L)',
                     r.table_schema, r.table_name, r.column_name, r.table_schema || '.' || r.table_name) INTO n;
    ELSE
      EXECUTE format('SELECT count(*) FROM %I.%I WHERE %I IN (SELECT id FROM slettet)',
                     r.table_schema, r.table_name, r.column_name) INTO n;
    END IF;
    IF n > 0 THEN feil := feil || format(' %s.%s.%s peker på rad som slettes: %s;', r.table_schema, r.table_name, r.column_name, n); END IF;
  END LOOP;
  IF feil <> '' THEN RAISE EXCEPTION 'STOPP I1b:%', feil; END IF;
  RAISE NOTICE 'I1b ok: ingen rad som blir stående, peker på det som slettes';
END $$;
DELETE FROM varelager.vareforbruk WHERE id IN (SELECT id FROM slettet WHERE tabell = 'varelager.vareforbruk');
DELETE FROM timer.sheet_rad_historikk WHERE id IN (SELECT id FROM slettet WHERE tabell = 'timer.sheet_rad_historikk');
DELETE FROM timer.daily_sheets WHERE id IN (SELECT id FROM slettet WHERE tabell = 'timer.daily_sheets');
DELETE FROM timer.prosjekt_ordning_overstyring WHERE id IN (SELECT id FROM slettet WHERE tabell = 'timer.prosjekt_ordning_overstyring');
DELETE FROM timer.lonnsarter WHERE id IN (SELECT id FROM slettet WHERE tabell = 'timer.lonnsarter');
DELETE FROM timer.aktiviteter WHERE id IN (SELECT id FROM slettet WHERE tabell = 'timer.aktiviteter');
DELETE FROM timer.tillegg WHERE id IN (SELECT id FROM slettet WHERE tabell = 'timer.tillegg');
DELETE FROM timer.expense_categories WHERE id IN (SELECT id FROM slettet WHERE tabell = 'timer.expense_categories');
DELETE FROM timer.eksport_oppsett WHERE id IN (SELECT id FROM slettet WHERE tabell = 'timer.eksport_oppsett');
DELETE FROM varelager.varer WHERE id IN (SELECT id FROM slettet WHERE tabell = 'varelager.varer');
DELETE FROM varelager.vare_kategorier WHERE id IN (SELECT id FROM slettet WHERE tabell = 'varelager.vare_kategorier');
DELETE FROM maskin.equipment WHERE id IN (SELECT id FROM slettet WHERE tabell = 'maskin.equipment');
DELETE FROM public.oppmote_perioder WHERE id IN (SELECT id FROM slettet WHERE tabell = 'public.oppmote_perioder');
DELETE FROM public.reisetid_matrise WHERE id IN (SELECT id FROM slettet WHERE tabell = 'public.reisetid_matrise');
DELETE FROM public.oppmotested_avstand WHERE id IN (SELECT id FROM slettet WHERE tabell = 'public.oppmotested_avstand');
DELETE FROM public.oppmotesteder WHERE id IN (SELECT id FROM slettet WHERE tabell = 'public.oppmotesteder');
DELETE FROM public.organization_members WHERE id IN (SELECT id FROM slettet WHERE tabell = 'public.organization_members');
DELETE FROM public.ansatt_kompetanser WHERE id IN (SELECT id FROM slettet WHERE tabell = 'public.ansatt_kompetanser');
DELETE FROM public.kompetansetyper WHERE id IN (SELECT id FROM slettet WHERE tabell = 'public.kompetansetyper');
DELETE FROM public.avdelinger WHERE id IN (SELECT id FROM slettet WHERE tabell = 'public.avdelinger');
DELETE FROM public.arbeidstids_kalender WHERE id IN (SELECT id FROM slettet WHERE tabell = 'public.arbeidstids_kalender');
DELETE FROM public.organization_modules WHERE id IN (SELECT id FROM slettet WHERE tabell = 'public.organization_modules');
DELETE FROM public.organization_settings WHERE id IN (SELECT id FROM slettet WHERE tabell = 'public.organization_settings');
DELETE FROM public.organization_reise_grenser WHERE id IN (SELECT id FROM slettet WHERE tabell = 'public.organization_reise_grenser');
DELETE FROM public.organization_seed_policies WHERE id IN (SELECT id FROM slettet WHERE tabell = 'public.organization_seed_policies');
DELETE FROM public.organization_partners WHERE id IN (SELECT id FROM slettet WHERE tabell = 'public.organization_partners');

\echo '== I2 kontroll etter sletting: ingen rad igjen, og ingenting som står igjen på test peker på det slettede'
DO $$
DECLARE r record; n bigint; feil text := '';
BEGIN
  FOR r IN SELECT DISTINCT tabell FROM slettet LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE id IN (SELECT id FROM slettet WHERE tabell = %L)', r.tabell, r.tabell) INTO n;
    IF n > 0 THEN feil := feil || format(' %s: %s rader igjen;', r.tabell, n); END IF;
  END LOOP;
  FOR r IN SELECT c.table_schema, c.table_name, c.column_name FROM information_schema.columns c
           JOIN information_schema.tables t USING (table_schema, table_name)
           WHERE t.table_type = 'BASE TABLE' AND c.table_schema IN ('public','timer','maskin','varelager')
             AND c.column_name LIKE '%\_id' AND c.data_type IN ('text','character varying')
             AND c.column_name NOT IN ('kort_id', 'original_rad_id', 'proadm_id', 'kilde_id')
             AND c.table_schema || '.' || c.table_name NOT IN ('public.activity_log', 'public.impersonation_audit') LOOP
    EXECUTE format('SELECT count(*) FROM %I.%I WHERE %I IN (SELECT id FROM slettet)', r.table_schema, r.table_name, r.column_name) INTO n;
    IF n > 0 THEN feil := feil || format(' %s.%s.%s peker på slettet rad: %s;', r.table_schema, r.table_name, r.column_name, n); END IF;
  END LOOP;
  IF feil <> '' THEN RAISE EXCEPTION 'STOPP I2:%', feil; END IF;
  RAISE NOTICE 'I2 ok: slettet, og ingen gjenværende rad peker på det slettede';
END $$;

\echo '== I3 last prod-CSV inn i TEMP-tabeller'
CREATE TEMP TABLE stg_public__users (LIKE public.users);
\copy stg_public__users FROM '/tmp/kopi-prod-til-test/public.users.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_public__organizations (LIKE public.organizations);
\copy stg_public__organizations FROM '/tmp/kopi-prod-til-test/public.organizations.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_public__organization_settings (LIKE public.organization_settings);
\copy stg_public__organization_settings FROM '/tmp/kopi-prod-til-test/public.organization_settings.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_public__organization_reise_grenser (LIKE public.organization_reise_grenser);
\copy stg_public__organization_reise_grenser FROM '/tmp/kopi-prod-til-test/public.organization_reise_grenser.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_public__organization_partners (LIKE public.organization_partners);
\copy stg_public__organization_partners FROM '/tmp/kopi-prod-til-test/public.organization_partners.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_public__organization_modules (LIKE public.organization_modules);
\copy stg_public__organization_modules FROM '/tmp/kopi-prod-til-test/public.organization_modules.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_public__organization_seed_policies (LIKE public.organization_seed_policies);
\copy stg_public__organization_seed_policies FROM '/tmp/kopi-prod-til-test/public.organization_seed_policies.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_public__avdelinger (LIKE public.avdelinger);
\copy stg_public__avdelinger FROM '/tmp/kopi-prod-til-test/public.avdelinger.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_public__arbeidstids_kalender (LIKE public.arbeidstids_kalender);
\copy stg_public__arbeidstids_kalender FROM '/tmp/kopi-prod-til-test/public.arbeidstids_kalender.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_public__kompetansetyper (LIKE public.kompetansetyper);
\copy stg_public__kompetansetyper FROM '/tmp/kopi-prod-til-test/public.kompetansetyper.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_public__organization_members (LIKE public.organization_members);
\copy stg_public__organization_members FROM '/tmp/kopi-prod-til-test/public.organization_members.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_public__oppmotesteder (LIKE public.oppmotesteder);
\copy stg_public__oppmotesteder FROM '/tmp/kopi-prod-til-test/public.oppmotesteder.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_public__oppmotested_avstand (LIKE public.oppmotested_avstand);
\copy stg_public__oppmotested_avstand FROM '/tmp/kopi-prod-til-test/public.oppmotested_avstand.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_public__projects (LIKE public.projects);
\copy stg_public__projects FROM '/tmp/kopi-prod-til-test/public.projects.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_public__project_organizations (LIKE public.project_organizations);
\copy stg_public__project_organizations FROM '/tmp/kopi-prod-til-test/public.project_organizations.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_public__byggeplasser (LIKE public.byggeplasser);
\copy stg_public__byggeplasser FROM '/tmp/kopi-prod-til-test/public.byggeplasser.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_public__project_modules (LIKE public.project_modules);
\copy stg_public__project_modules FROM '/tmp/kopi-prod-til-test/public.project_modules.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_public__dokumentflyt_parts (LIKE public.dokumentflyt_parts);
\copy stg_public__dokumentflyt_parts FROM '/tmp/kopi-prod-til-test/public.dokumentflyt_parts.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_public__project_members (LIKE public.project_members);
\copy stg_public__project_members FROM '/tmp/kopi-prod-til-test/public.project_members.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_public__dokumentflyt_koblinger (LIKE public.dokumentflyt_koblinger);
\copy stg_public__dokumentflyt_koblinger FROM '/tmp/kopi-prod-til-test/public.dokumentflyt_koblinger.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_public__project_groups (LIKE public.project_groups);
\copy stg_public__project_groups FROM '/tmp/kopi-prod-til-test/public.project_groups.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_public__project_group_members (LIKE public.project_group_members);
\copy stg_public__project_group_members FROM '/tmp/kopi-prod-til-test/public.project_group_members.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_public__group_faggrupper (LIKE public.group_faggrupper);
\copy stg_public__group_faggrupper FROM '/tmp/kopi-prod-til-test/public.group_faggrupper.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_public__project_group_byggeplasser (LIKE public.project_group_byggeplasser);
\copy stg_public__project_group_byggeplasser FROM '/tmp/kopi-prod-til-test/public.project_group_byggeplasser.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_public__oppmote_perioder (LIKE public.oppmote_perioder);
\copy stg_public__oppmote_perioder FROM '/tmp/kopi-prod-til-test/public.oppmote_perioder.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_public__reisetid_matrise (LIKE public.reisetid_matrise);
\copy stg_public__reisetid_matrise FROM '/tmp/kopi-prod-til-test/public.reisetid_matrise.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_public__external_cost_objects (LIKE public.external_cost_objects);
\copy stg_public__external_cost_objects FROM '/tmp/kopi-prod-til-test/public.external_cost_objects.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_timer__lonnsarter (LIKE timer.lonnsarter);
\copy stg_timer__lonnsarter FROM '/tmp/kopi-prod-til-test/timer.lonnsarter.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_timer__aktiviteter (LIKE timer.aktiviteter);
\copy stg_timer__aktiviteter FROM '/tmp/kopi-prod-til-test/timer.aktiviteter.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_timer__tillegg (LIKE timer.tillegg);
\copy stg_timer__tillegg FROM '/tmp/kopi-prod-til-test/timer.tillegg.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_timer__expense_categories (LIKE timer.expense_categories);
\copy stg_timer__expense_categories FROM '/tmp/kopi-prod-til-test/timer.expense_categories.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_timer__prosjekt_ordning_overstyring (LIKE timer.prosjekt_ordning_overstyring);
\copy stg_timer__prosjekt_ordning_overstyring FROM '/tmp/kopi-prod-til-test/timer.prosjekt_ordning_overstyring.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_timer__eksport_oppsett (LIKE timer.eksport_oppsett);
\copy stg_timer__eksport_oppsett FROM '/tmp/kopi-prod-til-test/timer.eksport_oppsett.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_maskin__equipment (LIKE maskin.equipment);
\copy stg_maskin__equipment FROM '/tmp/kopi-prod-til-test/maskin.equipment.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_varelager__vare_kategorier (LIKE varelager.vare_kategorier);
\copy stg_varelager__vare_kategorier FROM '/tmp/kopi-prod-til-test/varelager.vare_kategorier.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_varelager__varer (LIKE varelager.varer);
\copy stg_varelager__varer FROM '/tmp/kopi-prod-til-test/varelager.varer.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_timer__daily_sheets (LIKE timer.daily_sheets);
\copy stg_timer__daily_sheets FROM '/tmp/kopi-prod-til-test/timer.daily_sheets.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_timer__sheet_timer (LIKE timer.sheet_timer);
\copy stg_timer__sheet_timer FROM '/tmp/kopi-prod-til-test/timer.sheet_timer.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_timer__sheet_timer_forslag (LIKE timer.sheet_timer_forslag);
\copy stg_timer__sheet_timer_forslag FROM '/tmp/kopi-prod-til-test/timer.sheet_timer_forslag.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_timer__sheet_tillegg (LIKE timer.sheet_tillegg);
\copy stg_timer__sheet_tillegg FROM '/tmp/kopi-prod-til-test/timer.sheet_tillegg.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_timer__sheet_utlegg (LIKE timer.sheet_utlegg);
\copy stg_timer__sheet_utlegg FROM '/tmp/kopi-prod-til-test/timer.sheet_utlegg.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_timer__sheet_machines (LIKE timer.sheet_machines);
\copy stg_timer__sheet_machines FROM '/tmp/kopi-prod-til-test/timer.sheet_machines.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_timer__sheet_rad_historikk (LIKE timer.sheet_rad_historikk);
\copy stg_timer__sheet_rad_historikk FROM '/tmp/kopi-prod-til-test/timer.sheet_rad_historikk.csv' WITH (FORMAT csv)
CREATE TEMP TABLE stg_varelager__vareforbruk (LIKE varelager.vareforbruk);
\copy stg_varelager__vareforbruk FROM '/tmp/kopi-prod-til-test/varelager.vareforbruk.csv' WITH (FORMAT csv)

\echo '== I4 id-omskriving: SM prod -> test, Kenneth prod -> test (tekst, tekst-lister og json)'
DO $$
DECLARE r record; n bigint;
BEGIN
  FOR r IN SELECT c.relname, a.attname, format_type(a.atttypid, a.atttypmod) AS typ
             FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
            WHERE c.relnamespace = pg_my_temp_schema() AND c.relname LIKE 'stg\_%' AND c.relkind = 'r' LOOP
    n := 0;
    IF r.typ = 'text' OR r.typ LIKE 'character varying%' AND r.typ NOT LIKE '%[]' THEN
      EXECUTE format('UPDATE pg_temp.%I SET %I = CASE %I WHEN %L THEN %L WHEN %L THEN %L END WHERE %I IN (%L, %L)',
        r.relname, r.attname, r.attname, '0bca7497-40e1-41ad-87da-d6e77f208598', 'f1000001-0000-0000-0000-000000000002', '74730685-c6dd-451b-aec6-ea401ec566a2', '40153a94-f1ad-4fae-998e-707d17c68d4c', r.attname, '0bca7497-40e1-41ad-87da-d6e77f208598', '74730685-c6dd-451b-aec6-ea401ec566a2');
      GET DIAGNOSTICS n = ROW_COUNT;
    ELSIF r.typ LIKE '%[]' AND (r.typ LIKE 'text%' OR r.typ LIKE 'character varying%') THEN
      EXECUTE format('UPDATE pg_temp.%I SET %I = array_replace(array_replace(%I, %L, %L), %L, %L) WHERE %I && ARRAY[%L, %L]::%s',
        r.relname, r.attname, r.attname, '0bca7497-40e1-41ad-87da-d6e77f208598', 'f1000001-0000-0000-0000-000000000002', '74730685-c6dd-451b-aec6-ea401ec566a2', '40153a94-f1ad-4fae-998e-707d17c68d4c', r.attname, '0bca7497-40e1-41ad-87da-d6e77f208598', '74730685-c6dd-451b-aec6-ea401ec566a2', r.typ);
      GET DIAGNOSTICS n = ROW_COUNT;
    ELSIF r.typ IN ('json', 'jsonb') THEN
      EXECUTE format('UPDATE pg_temp.%I SET %I = replace(replace(%I::text, %L, %L), %L, %L)::%s WHERE %I::text LIKE %L OR %I::text LIKE %L',
        r.relname, r.attname, r.attname, '0bca7497-40e1-41ad-87da-d6e77f208598', 'f1000001-0000-0000-0000-000000000002', '74730685-c6dd-451b-aec6-ea401ec566a2', '40153a94-f1ad-4fae-998e-707d17c68d4c', r.typ, r.attname, '%0bca7497-40e1-41ad-87da-d6e77f208598%', r.attname, '%74730685-c6dd-451b-aec6-ea401ec566a2%');
      GET DIAGNOSTICS n = ROW_COUNT;
    END IF;
    IF n > 0 THEN RAISE NOTICE 'omskrevet %.%: % rader', r.relname, r.attname, n; END IF;
  END LOOP;
  -- Negativkontroll: ingen prod-id for SM eller Kenneth igjen i noen kolonne.
  FOR r IN SELECT c.relname FROM pg_class c
            WHERE c.relnamespace = pg_my_temp_schema() AND c.relname LIKE 'stg\_%' AND c.relkind = 'r' LOOP
    EXECUTE format('SELECT count(*) FROM pg_temp.%I s WHERE row_to_json(s)::text LIKE %L OR row_to_json(s)::text LIKE %L',
      r.relname, '%0bca7497-40e1-41ad-87da-d6e77f208598%', '%74730685-c6dd-451b-aec6-ea401ec566a2%') INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'STOPP I4: % har fortsatt % rader med prod-id for SM/Kenneth', r.relname, n; END IF;
  END LOOP;
  RAISE NOTICE 'I4 ok: ingen prod-id for SM eller Kenneth igjen';
END $$;

\echo '== I5 import i FK-rekkefølge'
INSERT INTO public.users SELECT * FROM stg_public__users;
INSERT INTO public.organizations SELECT * FROM stg_public__organizations WHERE id <> 'f1000001-0000-0000-0000-000000000002';
UPDATE public.organizations o SET name = s.name, organization_number = s.organization_number, invoice_address = s.invoice_address, invoice_email = s.invoice_email, ehf_enabled = s.ehf_enabled, logo_url = s.logo_url, er_kunde = s.er_kunde, updated_at = now()
  FROM stg_public__organizations s WHERE o.id = s.id AND s.id = 'f1000001-0000-0000-0000-000000000002';
INSERT INTO public.organization_settings SELECT * FROM stg_public__organization_settings;
INSERT INTO public.organization_reise_grenser SELECT * FROM stg_public__organization_reise_grenser;
INSERT INTO public.organization_partners SELECT * FROM stg_public__organization_partners;
INSERT INTO public.organization_modules SELECT * FROM stg_public__organization_modules;
INSERT INTO public.organization_seed_policies SELECT * FROM stg_public__organization_seed_policies;
INSERT INTO public.avdelinger SELECT * FROM stg_public__avdelinger;
INSERT INTO public.arbeidstids_kalender SELECT * FROM stg_public__arbeidstids_kalender;
INSERT INTO public.kompetansetyper SELECT * FROM stg_public__kompetansetyper;
INSERT INTO public.organization_members SELECT * FROM stg_public__organization_members;
INSERT INTO public.oppmotesteder SELECT * FROM stg_public__oppmotesteder;
INSERT INTO public.oppmotested_avstand SELECT * FROM stg_public__oppmotested_avstand;
INSERT INTO public.projects SELECT * FROM stg_public__projects;
INSERT INTO public.project_organizations SELECT * FROM stg_public__project_organizations;
INSERT INTO public.byggeplasser SELECT * FROM stg_public__byggeplasser;
INSERT INTO public.project_modules SELECT * FROM stg_public__project_modules;
INSERT INTO public.dokumentflyt_parts SELECT * FROM stg_public__dokumentflyt_parts;
INSERT INTO public.project_members SELECT * FROM stg_public__project_members;
INSERT INTO public.dokumentflyt_koblinger SELECT * FROM stg_public__dokumentflyt_koblinger;
INSERT INTO public.project_groups SELECT * FROM stg_public__project_groups;
INSERT INTO public.project_group_members SELECT * FROM stg_public__project_group_members;
INSERT INTO public.group_faggrupper SELECT * FROM stg_public__group_faggrupper;
INSERT INTO public.project_group_byggeplasser SELECT * FROM stg_public__project_group_byggeplasser;
INSERT INTO public.oppmote_perioder SELECT * FROM stg_public__oppmote_perioder;
INSERT INTO public.reisetid_matrise SELECT * FROM stg_public__reisetid_matrise;
INSERT INTO public.external_cost_objects SELECT * FROM stg_public__external_cost_objects;
INSERT INTO timer.lonnsarter SELECT * FROM stg_timer__lonnsarter;
INSERT INTO timer.aktiviteter SELECT * FROM stg_timer__aktiviteter;
INSERT INTO timer.tillegg SELECT * FROM stg_timer__tillegg;
INSERT INTO timer.expense_categories SELECT * FROM stg_timer__expense_categories;
INSERT INTO timer.prosjekt_ordning_overstyring SELECT * FROM stg_timer__prosjekt_ordning_overstyring;
INSERT INTO timer.eksport_oppsett SELECT * FROM stg_timer__eksport_oppsett;
INSERT INTO maskin.equipment SELECT * FROM stg_maskin__equipment;
INSERT INTO varelager.vare_kategorier SELECT * FROM stg_varelager__vare_kategorier;
INSERT INTO varelager.varer SELECT * FROM stg_varelager__varer;
INSERT INTO timer.daily_sheets SELECT * FROM stg_timer__daily_sheets;
INSERT INTO timer.sheet_timer SELECT * FROM stg_timer__sheet_timer;
INSERT INTO timer.sheet_timer_forslag SELECT * FROM stg_timer__sheet_timer_forslag;
INSERT INTO timer.sheet_tillegg SELECT * FROM stg_timer__sheet_tillegg;
INSERT INTO timer.sheet_utlegg SELECT * FROM stg_timer__sheet_utlegg;
INSERT INTO timer.sheet_machines SELECT * FROM stg_timer__sheet_machines;
INSERT INTO timer.sheet_rad_historikk SELECT * FROM stg_timer__sheet_rad_historikk;
INSERT INTO varelager.vareforbruk SELECT * FROM stg_varelager__vareforbruk;

\echo '== K1 kontrolltall: prod-eksport = innlest = finnes på test, per tabell'
CREATE TEMP TABLE _kontroll (tabell text, prod bigint, innlest bigint, paa_test bigint);
DO $$
DECLARE r record; a bigint; b bigint;
BEGIN
  FOR r IN SELECT tabell, antall FROM _manifest LOOP
    EXECUTE format('SELECT count(*) FROM pg_temp.%I', 'stg_' || replace(r.tabell, '.', '__')) INTO a;
    EXECUTE format('SELECT count(*) FROM %s WHERE id IN (SELECT id FROM pg_temp.%I)', r.tabell, 'stg_' || replace(r.tabell, '.', '__')) INTO b;
    INSERT INTO _kontroll VALUES (r.tabell, r.antall, a, b);
  END LOOP;
END $$;
SELECT tabell, prod, innlest, paa_test, CASE WHEN prod = innlest AND innlest = paa_test THEN 'ok' ELSE 'AVVIK' END AS status
  FROM _kontroll ORDER BY tabell;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM _kontroll WHERE NOT (prod = innlest AND innlest = paa_test)) THEN
    RAISE EXCEPTION 'STOPP K1: kontrolltall avviker (se tabellen over)';
  END IF;
  IF (SELECT prod FROM _kontroll WHERE tabell = 'public.organizations') <> 2
     OR (SELECT prod FROM _kontroll WHERE tabell = 'timer.daily_sheets') = 0
     OR (SELECT prod FROM _kontroll WHERE tabell = 'public.users') = 0 THEN
    RAISE EXCEPTION 'STOPP K1: tom eller feil import (organisasjoner ≠ 2, eller 0 sedler/brukere)';
  END IF;
  RAISE NOTICE 'K1 ok';
END $$;

\echo '== K2 hengende løse referanser i de importerte radene (skal være 0)'
CREATE TEMP TABLE _alle_id (id text);
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.table_schema, c.table_name FROM information_schema.columns c
           JOIN information_schema.tables t USING (table_schema, table_name)
           WHERE t.table_type = 'BASE TABLE' AND c.table_schema IN ('public','timer','maskin','varelager')
             AND c.column_name = 'id' LOOP
    EXECUTE format('INSERT INTO _alle_id SELECT id::text FROM %I.%I', r.table_schema, r.table_name);
  END LOOP;
END $$;
CREATE INDEX ON _alle_id (id);
ANALYZE _alle_id;
CREATE TEMP TABLE _henger (tabell text, kolonne text, rader bigint);
DO $$
DECLARE r record; n bigint;
BEGIN
  FOR r IN SELECT c.relname, a.attname FROM pg_class c
             JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
            WHERE c.relnamespace = pg_my_temp_schema() AND c.relname LIKE 'stg\_%' AND c.relkind = 'r'
              AND a.attname LIKE '%\_id' AND a.attname NOT IN ('kort_id', 'original_rad_id', 'proadm_id', 'kilde_id')
              AND format_type(a.atttypid, a.atttypmod) IN ('text') LOOP
    EXECUTE format('SELECT count(*) FROM pg_temp.%I s WHERE s.%I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM _alle_id a WHERE a.id = s.%I)',
      r.relname, r.attname, r.attname) INTO n;
    IF n > 0 THEN INSERT INTO _henger VALUES (r.relname, r.attname, n); END IF;
  END LOOP;
END $$;
SELECT * FROM _henger ORDER BY 1, 2;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM _henger) THEN RAISE EXCEPTION 'STOPP K2: hengende referanser (se tabellen over)'; END IF;
  RAISE NOTICE 'K2 ok: 0 hengende referanser';
END $$;

\echo '== K3 negativkontroll persondata: importerte brukere har bare fiktiv e-post, ingen persondata, og ikke-medlemmer har ikke ekte navn'
SELECT count(*) AS importerte_brukere,
       count(*) FILTER (WHERE u.email NOT LIKE '%@test.sitedoc.invalid') AS ekte_epost,
       count(*) FILTER (WHERE u.phone IS NOT NULL OR u.image IS NOT NULL OR u.fodselsdato IS NOT NULL
                          OR u.hms_kort_nr IS NOT NULL OR u.nasjonalitet IS NOT NULL
                          OR u.arbeidstillatelse IS NOT NULL) AS persondata_igjen,
       count(*) FILTER (WHERE u.id NOT IN (SELECT user_id FROM stg_public__organization_members)) AS ikke_medlem,
       count(*) FILTER (WHERE u.id NOT IN (SELECT user_id FROM stg_public__organization_members)
                          AND u.name IS DISTINCT FROM 'Ekstern ' || left(u.id, 8)) AS ikke_medlem_ekte_navn,
       count(*) FILTER (WHERE NOT u.can_login) AS kan_ikke_logge_inn
  FROM users u WHERE u.id IN (SELECT id FROM stg_public__users);
DO $$
DECLARE n_imp bigint; n_ekte bigint; n_pd bigint; n_navn bigint;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE email NOT LIKE '%@test.sitedoc.invalid'),
         count(*) FILTER (WHERE phone IS NOT NULL OR image IS NOT NULL OR fodselsdato IS NOT NULL
                            OR hms_kort_nr IS NOT NULL OR nasjonalitet IS NOT NULL OR arbeidstillatelse IS NOT NULL),
         count(*) FILTER (WHERE id NOT IN (SELECT user_id FROM stg_public__organization_members)
                            AND name IS DISTINCT FROM 'Ekstern ' || left(id, 8))
    INTO n_imp, n_ekte, n_pd, n_navn
    FROM users WHERE id IN (SELECT id FROM stg_public__users);
  -- Kontrollen er ikke tom: den må ha brukere å se på.
  IF n_imp = 0 THEN
    RAISE EXCEPTION 'STOPP K3: negativkontrollen er tom (importerte=0)';
  END IF;
  IF n_ekte > 0 OR n_pd > 0 OR n_navn > 0 THEN
    RAISE EXCEPTION 'STOPP K3: ekte e-post=%, persondata igjen=%, ikke-medlem med ekte navn=%', n_ekte, n_pd, n_navn;
  END IF;
  IF EXISTS (SELECT 1 FROM organizations WHERE id IN ('4488fe17-7490-409f-9c1c-2827f257c54d', 'f1000001-0000-0000-0000-000000000002')
             AND invoice_email IS NOT NULL AND invoice_email NOT LIKE '%@test.sitedoc.invalid') THEN
    RAISE EXCEPTION 'STOPP K3: firma-faktura-e-post er ikke fiktiv';
  END IF;
  RAISE NOTICE 'K3 ok: % importerte brukere, alle fiktive', n_imp;
END $$;

\echo '== K4 prosjektnavn som finnes to ganger i samme firma etter import (meldes, begge beholdes)'
SELECT o.name AS firma, p.name AS prosjekt, count(*) AS antall
  FROM projects p JOIN organizations o ON o.id = p.primary_organization_id
 WHERE o.id IN ('4488fe17-7490-409f-9c1c-2827f257c54d', 'f1000001-0000-0000-0000-000000000002')
 GROUP BY 1, 2 HAVING count(*) > 1 ORDER BY 1, 2;

\echo '== K5 oversikt etter import'
SELECT o.name,
  (SELECT count(*) FROM organization_members m WHERE m.organization_id = o.id) AS medlemmer,
  (SELECT count(*) FROM projects p WHERE p.primary_organization_id = o.id) AS prosjekter,
  (SELECT count(*) FROM timer.lonnsarter l WHERE l.organization_id = o.id) AS lonnsarter,
  (SELECT count(*) FROM timer.daily_sheets d WHERE d.organization_id = o.id) AS dagssedler,
  (SELECT count(*) FROM maskin.equipment e WHERE e.organization_id = o.id) AS maskiner,
  (SELECT l.navn FROM organization_settings s JOIN timer.lonnsarter l ON l.id = s.reise_lonnsart_id
    WHERE s.organization_id = o.id) AS reise_lonnsart
  FROM organizations o WHERE o.id IN ('4488fe17-7490-409f-9c1c-2827f257c54d', 'f1000001-0000-0000-0000-000000000002') ORDER BY 1;

\if :commit
  COMMIT;
  \echo '== FERDIG: COMMIT'
\else
  ROLLBACK;
  \echo '== TØRRKJØRING: alt rullet tilbake (kjør med -v commit=1 for å lagre)'
\endif

