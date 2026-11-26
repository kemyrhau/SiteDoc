#!/usr/bin/env python3
"""Genererer 1-eksport-prod.sql og 2-import-test.sql for KOPI-PROD-TIL-TEST.

Kjør fra repo-rot:  python3 scripts/ops/kopi-prod-til-test/generer.py
Ingen database røres. Filene skrives ved siden av dette skriptet.

Konstantene under er målt 2026-11-26 (relay/kopi-prod-til-test/ut-alle.txt).
Begge SQL-filene sjekker dem på nytt og stopper hvis de ikke stemmer.
"""
from pathlib import Path

AM = "4488fe17-7490-409f-9c1c-2827f257c54d"   # A.Markussen AS, prod (finnes ikke på test)
SMP = "0bca7497-40e1-41ad-87da-d6e77f208598"  # SITEDOC MYRHAUG, prod
SMT = "f1000001-0000-0000-0000-000000000002"  # SITEDOC MYRHAUG, test (beholdes)
KP = "74730685-c6dd-451b-aec6-ea401ec566a2"   # Kenneth, prod
KT = "40153a94-f1ad-4fae-998e-707d17c68d4c"   # Kenneth, test
K_MD5 = "f51f39ca8fa0"                         # 12 første tegn av md5(lower(e-post)), lik i begge
AM_ORGNR = "835000702"
DIR = "/tmp/kopi-prod-til-test"                # i postgres-containeren

ORG = f"('{AM}','{SMP}')"
PROSJ = (f"(SELECT id FROM projects WHERE primary_organization_id IN {ORG} "
         f"UNION SELECT project_id FROM project_organizations WHERE organization_id IN {ORG})")
PM = f"(SELECT id FROM project_members WHERE project_id IN {PROSJ})"
PG = f"(SELECT id FROM project_groups WHERE project_id IN {PROSJ})"
DS = f"(SELECT id FROM timer.daily_sheets WHERE organization_id = '{SMP}')"
EC = f"(SELECT id FROM timer.expense_categories WHERE organization_id IN {ORG})"
MEDLEM = f"(SELECT user_id FROM organization_members WHERE organization_id IN {ORG})"

# Alle bruker-kolonner i radene som kopieres (samme liste som M2 i målingen, pluss equipment/eksport).
BRUKERE = "(" + "\n   UNION ".join([
    f"SELECT user_id FROM organization_members WHERE organization_id IN {ORG}",
    f"SELECT deaktivert_av_user_id FROM organization_members WHERE organization_id IN {ORG}",
    f"SELECT aktivert_av_user_id FROM organization_modules WHERE organization_id IN {ORG}",
    f"SELECT deaktivert_av_user_id FROM organization_modules WHERE organization_id IN {ORG}",
    f"SELECT sett_av_user_id FROM organization_seed_policies WHERE organization_id IN {ORG}",
    f"SELECT satt_av_user_id FROM oppmote_perioder WHERE organization_id IN {ORG}",
    f"SELECT opprettet_av_user_id FROM external_cost_objects WHERE organization_id IN {ORG}",
    f"SELECT lukket_av_user_id FROM external_cost_objects WHERE organization_id IN {ORG}",
    f"SELECT eier_id FROM timer.eksport_oppsett WHERE organization_id IN {ORG}",
    f"SELECT opprettet_av_id FROM timer.eksport_oppsett WHERE organization_id IN {ORG}",
    f"SELECT ansvarlig_user_id FROM maskin.equipment WHERE organization_id IN {ORG}",
    f"SELECT user_id FROM project_members WHERE project_id IN {PROSJ}",
    f"SELECT ansvarlig_id FROM dokumentflyt_parts WHERE project_id IN {PROSJ}",
    f"SELECT user_id FROM timer.daily_sheets WHERE id IN {DS}",
    f"SELECT registrert_av_user_id FROM timer.daily_sheets WHERE id IN {DS}",
    f"SELECT attestert_av_user_id FROM timer.daily_sheets WHERE id IN {DS}",
    f"SELECT attestert_av_user_id FROM timer.sheet_timer WHERE sheet_id IN {DS}",
    f"SELECT attestert_av_user_id FROM timer.sheet_tillegg WHERE sheet_id IN {DS}",
    f"SELECT attestert_av_user_id FROM timer.sheet_machines WHERE sheet_id IN {DS}",
    f"SELECT erstattet_av_user_id FROM timer.sheet_rad_historikk WHERE sheet_id IN {DS}",
    f"SELECT registrert_av_user_id FROM varelager.vareforbruk WHERE dagsseddel_id IN {DS}",
]) + ")"

def overstyr(alias: str, felt: dict) -> str:
    """SELECT-liste som gir hele raden med enkelte felt overstyrt (kolonnerekkefølgen bevares)."""
    par = ", ".join(f"'{k}', {v}" for k, v in felt.items())
    return f"(jsonb_populate_record({alias}, jsonb_build_object({par}))).*"

# (tabell, WHERE på x, overstyrte felt) — i importrekkefølge (ekte FK-er tilfredsstilles).
TABELLER = [
    ("public.users", f"x.id IN {BRUKERE} AND x.id <> '{KP}'", {
        "email": "left(x.id, 8) || '@test.sitedoc.invalid'",
        "email_verified": "NULL", "image": "NULL", "phone": "NULL",
        "fodselsdato": "NULL", "nasjonalitet": "NULL", "hms_kort_nr": "NULL",
        "hms_kort_utloper": "NULL", "arbeidstillatelse": "NULL",
        "arbeidstillatelse_utloper": "NULL",
        "can_login": f"CASE WHEN x.id IN {MEDLEM} THEN x.can_login ELSE false END",
    }),
    ("public.organizations", f"x.id IN {ORG}", {
        "logo_url": "NULL",
        "invoice_email": "CASE WHEN x.invoice_email IS NULL THEN NULL "
                         "ELSE left(x.id, 8) || '-faktura@test.sitedoc.invalid' END",
    }),
    ("public.organization_settings", f"x.organization_id IN {ORG}", None),
    ("public.organization_reise_grenser", f"x.organization_id IN {ORG}", None),
    ("public.organization_partners", f"x.organization_id IN {ORG}",
     {"contact_name": "NULL", "contact_email": "NULL", "contact_phone": "NULL"}),
    ("public.organization_modules", f"x.organization_id IN {ORG}", None),
    ("public.organization_seed_policies", f"x.organization_id IN {ORG}", None),
    ("public.avdelinger", f"x.organization_id IN {ORG}", None),
    ("public.arbeidstids_kalender", f"x.organization_id IN {ORG}", None),
    ("public.kompetansetyper", f"x.organization_id IN {ORG}", None),
    ("public.organization_members", f"x.organization_id IN {ORG}", None),
    ("public.oppmotesteder", f"x.organization_id IN {ORG}", None),
    ("public.oppmotested_avstand", f"x.organization_id IN {ORG}", None),
    ("public.projects", f"x.id IN {PROSJ}", {"logo_url": "NULL"}),
    ("public.project_organizations", f"x.project_id IN {PROSJ} AND x.organization_id IN {ORG}", None),
    ("public.byggeplasser", f"x.project_id IN {PROSJ}", None),
    ("public.project_modules", f"x.project_id IN {PROSJ}", None),
    ("public.dokumentflyt_parts", f"x.project_id IN {PROSJ}",
     {"kontrakt_id": "NULL", "partner_id": "NULL"}),
    ("public.project_members", f"x.project_id IN {PROSJ}", None),
    ("public.dokumentflyt_koblinger", f"x.project_member_id IN {PM}", None),
    ("public.project_groups", f"x.project_id IN {PROSJ}", None),
    ("public.project_group_members", f"x.group_id IN {PG}", None),
    ("public.group_faggrupper", f"x.group_id IN {PG}", None),
    ("public.project_group_byggeplasser", f"x.group_id IN {PG}", None),
    ("public.oppmote_perioder", f"x.organization_id IN {ORG}", None),
    ("public.reisetid_matrise", f"x.organization_id IN {ORG}", None),
    ("public.external_cost_objects", f"x.organization_id IN {ORG}", None),
    ("timer.lonnsarter", f"x.organization_id IN {ORG}", None),
    ("timer.aktiviteter", f"x.organization_id IN {ORG}", None),
    ("timer.tillegg", f"x.organization_id IN {ORG}", None),
    ("timer.expense_categories", f"x.organization_id IN {ORG}", None),
    ("timer.prosjekt_ordning_overstyring", f"x.expense_category_id IN {EC}", None),
    ("timer.eksport_oppsett", f"x.organization_id IN {ORG}", None),
    ("maskin.equipment", f"x.organization_id IN {ORG}", {"bilder": "NULL"}),
    ("varelager.vare_kategorier", f"x.organization_id IN {ORG}", None),
    ("varelager.varer", f"x.organization_id IN {ORG}", None),
    ("timer.daily_sheets", f"x.id IN {DS}", None),
    ("timer.sheet_timer", f"x.sheet_id IN {DS}", None),
    ("timer.sheet_timer_forslag", f"x.sheet_id IN {DS}", None),
    ("timer.sheet_tillegg", f"x.sheet_id IN {DS}", None),
    ("timer.sheet_utlegg", f"x.sheet_id IN {DS}", None),
    ("timer.sheet_machines", f"x.sheet_id IN {DS}", None),
    ("timer.sheet_rad_historikk", f"x.sheet_id IN {DS}", None),
    ("varelager.vareforbruk", f"x.dagsseddel_id IN {DS}", None),
]

def stg(t: str) -> str:
    return "stg_" + t.replace(".", "__")

def fil(t: str) -> str:
    return f"{DIR}/{t}.csv"

def select(t: str, where: str, ov) -> str:
    cols = overstyr("x", ov) if ov else "x.*"
    return f"SELECT {cols} FROM {t} x WHERE {where}"

TABELLISTE = ", ".join(f"'{t}'" for t, _, _ in TABELLER)

# --------------------------------------------------------------------------- prod
def eksport() -> str:
    o = [f"""-- KOPI-PROD-TIL-TEST · STEG 1 · EKSPORT FRA PROD (sitedoc). GENERERT av generer.py — ikke rediger for hånd.
-- Leser bare: hele fila kjører i én READ ONLY-transaksjon (REPEATABLE READ = ett konsistent øyeblikksbilde).
-- Skriver CSV til {DIR}/ i postgres-containeren (psql kjører der). Anonymisering skjer i SELECT,
-- så ekte e-post, telefon og persondata havner aldri i en fil.
\\set ON_ERROR_STOP on
\\pset pager off
\\pset footer off
SELECT current_database() AS db, now()::timestamp(0) AS tid;
DO $$ BEGIN
  IF current_database() <> 'sitedoc' THEN RAISE EXCEPTION 'STOPP: steg 1 skal kjøres mot sitedoc (prod)'; END IF;
END $$;
\\! mkdir -p {DIR} && chmod 700 {DIR} && rm -f {DIR}/*.csv

BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;

\\echo '== E0 kontroll av id-ene som skriptet bygger på (feil = stopp)'
DO $$ BEGIN
  IF (SELECT count(*) FROM organizations WHERE id = '{AM}' AND name ILIKE 'A.%Markussen%') <> 1 THEN
    RAISE EXCEPTION 'STOPP: AM-id/navn stemmer ikke i prod'; END IF;
  IF (SELECT count(*) FROM organizations WHERE id = '{SMP}' AND name ILIKE 'SITEDOC MYRHAUG%') <> 1 THEN
    RAISE EXCEPTION 'STOPP: SM-id/navn stemmer ikke i prod'; END IF;
  IF (SELECT count(*) FROM users WHERE id = '{KP}' AND role = 'sitedoc_admin'
      AND left(md5(lower(email)), 12) = '{K_MD5}') <> 1 THEN
    RAISE EXCEPTION 'STOPP: Kenneths prod-id stemmer ikke'; END IF;
  RAISE NOTICE 'E0 ok: AM, SM og Kenneth stemmer i prod';
END $$;
"""]
    o.append("\\echo '== E1 eksport per tabell (antall rader står i manifestet E2)'")
    for t, where, ov in TABELLER:
        o.append(f"\\o {fil(t)}\nCOPY ({select(t, where, ov)}) TO STDOUT WITH (FORMAT csv);\n\\o")
    # Manifest: antall per tabell
    union = "\n  UNION ALL ".join(
        f"SELECT '{t}', count(*) FROM ({select(t, where, ov)}) q" for t, where, ov in TABELLER)
    o.append(f"""
\\echo '== E2 manifest: antall rader per tabell i eksporten'
\\o {DIR}/_manifest.csv
COPY (
  {union}
) TO STDOUT WITH (FORMAT csv);
\\o
\\echo '== E3 kolonne-fingeravtrykk (import stopper hvis test har annen kolonnerekkefølge/type)'
\\o {DIR}/_kolonner.csv
COPY (
  SELECT table_schema || '.' || table_name,
         string_agg(column_name || ':' || udt_name, ',' ORDER BY ordinal_position)
  FROM information_schema.columns
  WHERE table_schema || '.' || table_name IN ({TABELLISTE})
  GROUP BY 1
) TO STDOUT WITH (FORMAT csv);
\\o
\\echo '== E4 md5 av ekte e-post for brukerne i omfanget (negativkontroll på test; e-posten selv eksporteres aldri)'
\\o {DIR}/_epost_md5.csv
COPY (SELECT x.id, md5(lower(x.email)) FROM users x WHERE x.id IN {BRUKERE}) TO STDOUT WITH (FORMAT csv);
\\o
ROLLBACK;
\\! chmod 600 {DIR}/*.csv && wc -l {DIR}/_manifest.csv {DIR}/_kolonner.csv {DIR}/_epost_md5.csv
""")
    return "\n".join(o)

# --------------------------------------------------------------------------- test
SLETT = [
    # (tabell, WHERE som finner test-SMs rader) — i sletterekkefølge. Barn via Cascade er tatt med
    # i slettet-lista for kontrollens skyld.
    ("timer.daily_sheets", f"organization_id = '{SMT}'"),
    ("timer.sheet_timer", "sheet_id IN (SELECT id FROM slettet WHERE tabell = 'timer.daily_sheets')"),
    ("timer.sheet_timer_forslag", "sheet_id IN (SELECT id FROM slettet WHERE tabell = 'timer.daily_sheets')"),
    ("timer.sheet_tillegg", "sheet_id IN (SELECT id FROM slettet WHERE tabell = 'timer.daily_sheets')"),
    ("timer.sheet_tillegg_vedlegg", "sheet_tillegg_id IN (SELECT id FROM slettet WHERE tabell = 'timer.sheet_tillegg')"),
    ("timer.sheet_utlegg", "sheet_id IN (SELECT id FROM slettet WHERE tabell = 'timer.daily_sheets')"),
    ("timer.sheet_utlegg_vedlegg", "sheet_utlegg_id IN (SELECT id FROM slettet WHERE tabell = 'timer.sheet_utlegg')"),
    ("timer.sheet_machines", "sheet_id IN (SELECT id FROM slettet WHERE tabell = 'timer.daily_sheets')"),
    ("timer.sheet_rad_historikk", "sheet_id IN (SELECT id FROM slettet WHERE tabell = 'timer.daily_sheets')"),
    ("varelager.varer", f"organization_id = '{SMT}'"),
    ("varelager.vareforbruk", "dagsseddel_id IN (SELECT id FROM slettet WHERE tabell = 'timer.daily_sheets') "
                              "OR vare_id IN (SELECT id FROM slettet WHERE tabell = 'varelager.varer')"),
    ("varelager.vare_kategorier", f"organization_id = '{SMT}'"),
    ("timer.expense_categories", f"organization_id = '{SMT}'"),
    ("timer.prosjekt_ordning_overstyring", "expense_category_id IN (SELECT id FROM slettet WHERE tabell = 'timer.expense_categories')"),
    ("timer.lonnsarter", f"organization_id = '{SMT}'"),
    ("timer.aktiviteter", f"organization_id = '{SMT}'"),
    ("timer.tillegg", f"organization_id = '{SMT}'"),
    ("timer.eksport_oppsett", f"organization_id = '{SMT}'"),
    ("maskin.equipment", f"organization_id = '{SMT}'"),
    ("maskin.equipment_ansvarlige", "equipment_id IN (SELECT id FROM slettet WHERE tabell = 'maskin.equipment')"),
    ("maskin.equipment_assignments", "equipment_id IN (SELECT id FROM slettet WHERE tabell = 'maskin.equipment')"),
    ("maskin.service_records", "equipment_id IN (SELECT id FROM slettet WHERE tabell = 'maskin.equipment')"),
    ("maskin.feilmeldinger", "equipment_id IN (SELECT id FROM slettet WHERE tabell = 'maskin.equipment')"),
    ("maskin.vegvesen_ko", "equipment_id IN (SELECT id FROM slettet WHERE tabell = 'maskin.equipment')"),
    ("public.oppmote_perioder", f"organization_id = '{SMT}'"),
    ("public.reisetid_matrise", f"organization_id = '{SMT}'"),
    ("public.oppmotested_avstand", f"organization_id = '{SMT}'"),
    ("public.oppmotesteder", f"organization_id = '{SMT}'"),
    ("public.organization_members", f"organization_id = '{SMT}'"),
    ("public.kompetansetyper", f"organization_id = '{SMT}'"),
    ("public.ansatt_kompetanser", "kompetansetype_id IN (SELECT id FROM slettet WHERE tabell = 'public.kompetansetyper')"),
    ("public.avdelinger", f"organization_id = '{SMT}'"),
    ("public.arbeidstids_kalender", f"organization_id = '{SMT}'"),
    ("public.organization_modules", f"organization_id = '{SMT}'"),
    ("public.organization_settings", f"organization_id = '{SMT}'"),
    ("public.organization_reise_grenser", f"organization_id = '{SMT}'"),
    ("public.organization_seed_policies", f"organization_id = '{SMT}'"),
    ("public.organization_partners", f"organization_id = '{SMT}'"),
]
# Rekkefølgen DELETE kjøres i (Restrict-FK: barn før foreldre).
SLETT_REKKEFOLGE = [
    "varelager.vareforbruk", "timer.sheet_rad_historikk", "timer.daily_sheets",
    "timer.prosjekt_ordning_overstyring", "timer.lonnsarter", "timer.aktiviteter", "timer.tillegg",
    "timer.expense_categories", "timer.eksport_oppsett", "varelager.varer", "varelager.vare_kategorier",
    "maskin.equipment", "public.oppmote_perioder", "public.reisetid_matrise",
    "public.oppmotested_avstand", "public.oppmotesteder", "public.organization_members",
    "public.ansatt_kompetanser", "public.kompetansetyper", "public.avdelinger",
    "public.arbeidstids_kalender", "public.organization_modules", "public.organization_settings",
    "public.organization_reise_grenser", "public.organization_seed_policies",
    "public.organization_partners",
]
assert set(SLETT_REKKEFOLGE) <= {t for t, _ in SLETT}

# Kolonner som ender på _id men ikke er pekere til en rad (hoppes over i henge-kontrollen).
IKKE_PEKER = ("kort_id", "original_rad_id", "proadm_id", "kilde_id")
# Logg-tabeller der en peker til en slettet rad er forventet historikk, ikke feil.
LOGG = ("public.activity_log", "public.impersonation_audit")

ORG_OPPDATER = ["name", "organization_number", "invoice_address", "invoice_email",
                "ehf_enabled", "logo_url", "er_kunde"]

def importer() -> str:
    q = lambda xs: ", ".join(f"'{x}'" for x in xs)
    o = [f"""-- KOPI-PROD-TIL-TEST · STEG 2+3 · IMPORT TIL TEST (sitedoc_test). GENERERT av generer.py — ikke rediger for hånd.
-- Én transaksjon, ON_ERROR_STOP: første feil eller kontroll som ikke holder = psql avslutter og alt rulles tilbake.
-- Tørrkjøring (standard):  psql -v commit=0 …   → alt kjøres og kontrolleres, så ROLLBACK.
-- Ekte kjøring:            psql -v commit=1 …   → COMMIT bare hvis alle kontroller holder.
\\set ON_ERROR_STOP on
\\pset pager off
\\pset footer off
\\if :{{?commit}}
\\else
  \\set commit 0
\\endif
SELECT current_database() AS db, now()::timestamp(0) AS tid, :'commit' AS commit_flagg;
DO $$ BEGIN
  IF current_database() <> 'sitedoc_test' THEN RAISE EXCEPTION 'STOPP: steg 2 skal kjøres mot sitedoc_test'; END IF;
END $$;

-- TEMP-tabeller lever bare i økta (spørsmål 10). Ingen skjemaendring.
CREATE TEMP TABLE _manifest (tabell text PRIMARY KEY, antall bigint);
CREATE TEMP TABLE _kolonner (tabell text PRIMARY KEY, kolonner text);
CREATE TEMP TABLE _epost_md5 (id text, md5 text);
\\copy _manifest FROM '{DIR}/_manifest.csv' WITH (FORMAT csv)
\\copy _kolonner FROM '{DIR}/_kolonner.csv' WITH (FORMAT csv)
\\copy _epost_md5 FROM '{DIR}/_epost_md5.csv' WITH (FORMAT csv)

BEGIN;

\\echo '== I0 forutsetninger på test (feil = stopp)'
DO $$
DECLARE avvik text;
BEGIN
  IF (SELECT count(*) FROM organizations WHERE id = '{SMT}' AND name ILIKE 'SITEDOC MYRHAUG%') <> 1 THEN
    RAISE EXCEPTION 'STOPP: test-SM ({SMT}) finnes ikke med riktig navn';
  END IF;
  IF (SELECT count(*) FROM users WHERE id = '{KT}' AND role = 'sitedoc_admin'
      AND left(md5(lower(email)), 12) = '{K_MD5}') <> 1 THEN
    RAISE EXCEPTION 'STOPP: Kenneths test-id ({KT}) stemmer ikke';
  END IF;
  SELECT string_agg(id || ' «' || name || '»', ', ') INTO avvik FROM organizations
   WHERE id = '{AM}' OR name ILIKE '%markussen%'
      OR replace(coalesce(organization_number, ''), ' ', '') = '{AM_ORGNR}';
  IF avvik IS NOT NULL THEN
    RAISE EXCEPTION 'STOPP: et A.Markussen finnes allerede på test: %', avvik;
  END IF;
  IF (SELECT count(*) FROM _manifest) <> {len(TABELLER)} THEN
    RAISE EXCEPTION 'STOPP: manifestet har % tabeller, forventet {len(TABELLER)}', (SELECT count(*) FROM _manifest);
  END IF;
  SELECT string_agg(k.tabell, ', ') INTO avvik FROM _kolonner k
   LEFT JOIN (SELECT table_schema || '.' || table_name AS tabell,
                     string_agg(column_name || ':' || udt_name, ',' ORDER BY ordinal_position) AS kolonner
                FROM information_schema.columns GROUP BY 1) t ON t.tabell = k.tabell
   WHERE t.kolonner IS DISTINCT FROM k.kolonner;
  IF avvik IS NOT NULL OR (SELECT count(*) FROM _kolonner) <> {len(TABELLER)} THEN
    RAISE EXCEPTION 'STOPP: kolonnene i prod og test er ulike for: %', coalesce(avvik, '(antall tabeller)');
  END IF;
  RAISE NOTICE 'I0 ok: test-SM, Kenneth, intet AM, manifest og kolonner stemmer';
END $$;

\\echo '== I1 test-SMs timer-data og innstillinger som slettes (organisasjonsraden, prosjektene, malene og ECO blir stående)'
CREATE TEMP TABLE slettet (tabell text, id text);"""]
    for t, where in SLETT:
        o.append(f"INSERT INTO slettet SELECT '{t}', id FROM {t} WHERE {where};")
    o.append("SELECT tabell, count(*) AS slettes FROM slettet GROUP BY 1 ORDER BY 1;")
    for t in SLETT_REKKEFOLGE:
        o.append(f"DELETE FROM {t} WHERE id IN (SELECT id FROM slettet WHERE tabell = '{t}');")
    o.append(f"""
\\echo '== I2 kontroll etter sletting: ingen rad igjen, og ingenting som står igjen på test peker på det slettede'
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
             AND c.column_name LIKE '%\\_id' AND c.data_type IN ('text','character varying')
             AND c.column_name NOT IN ({q(IKKE_PEKER)})
             AND c.table_schema || '.' || c.table_name NOT IN ({q(LOGG)}) LOOP
    EXECUTE format('SELECT count(*) FROM %I.%I WHERE %I IN (SELECT id FROM slettet)', r.table_schema, r.table_name, r.column_name) INTO n;
    IF n > 0 THEN feil := feil || format(' %s.%s.%s peker på slettet rad: %s;', r.table_schema, r.table_name, r.column_name, n); END IF;
  END LOOP;
  IF feil <> '' THEN RAISE EXCEPTION 'STOPP I2:%', feil; END IF;
  RAISE NOTICE 'I2 ok: slettet, og ingen gjenværende rad peker på det slettede';
END $$;

\\echo '== I3 last prod-CSV inn i TEMP-tabeller'""")
    for t, _, _ in TABELLER:
        o.append(f"CREATE TEMP TABLE {stg(t)} (LIKE {t});")
        o.append(f"\\copy {stg(t)} FROM '{fil(t)}' WITH (FORMAT csv)")
    o.append(f"""
\\echo '== I4 id-omskriving: SM prod -> test, Kenneth prod -> test (tekst, tekst-lister og json)'
DO $$
DECLARE r record; n bigint;
BEGIN
  FOR r IN SELECT c.relname, a.attname, format_type(a.atttypid, a.atttypmod) AS typ
             FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
            WHERE c.relnamespace = pg_my_temp_schema() AND c.relname LIKE 'stg\\_%' AND c.relkind = 'r' LOOP
    n := 0;
    IF r.typ = 'text' OR r.typ LIKE 'character varying%' AND r.typ NOT LIKE '%[]' THEN
      EXECUTE format('UPDATE pg_temp.%I SET %I = CASE %I WHEN %L THEN %L WHEN %L THEN %L END WHERE %I IN (%L, %L)',
        r.relname, r.attname, r.attname, '{SMP}', '{SMT}', '{KP}', '{KT}', r.attname, '{SMP}', '{KP}');
      GET DIAGNOSTICS n = ROW_COUNT;
    ELSIF r.typ LIKE '%[]' AND (r.typ LIKE 'text%' OR r.typ LIKE 'character varying%') THEN
      EXECUTE format('UPDATE pg_temp.%I SET %I = array_replace(array_replace(%I, %L, %L), %L, %L) WHERE %I && ARRAY[%L, %L]::%s',
        r.relname, r.attname, r.attname, '{SMP}', '{SMT}', '{KP}', '{KT}', r.attname, '{SMP}', '{KP}', r.typ);
      GET DIAGNOSTICS n = ROW_COUNT;
    ELSIF r.typ IN ('json', 'jsonb') THEN
      EXECUTE format('UPDATE pg_temp.%I SET %I = replace(replace(%I::text, %L, %L), %L, %L)::%s WHERE %I::text LIKE %L OR %I::text LIKE %L',
        r.relname, r.attname, r.attname, '{SMP}', '{SMT}', '{KP}', '{KT}', r.typ, r.attname, '%{SMP}%', r.attname, '%{KP}%');
      GET DIAGNOSTICS n = ROW_COUNT;
    END IF;
    IF n > 0 THEN RAISE NOTICE 'omskrevet %.%: % rader', r.relname, r.attname, n; END IF;
  END LOOP;
  -- Negativkontroll: ingen prod-id for SM eller Kenneth igjen i noen kolonne.
  FOR r IN SELECT c.relname FROM pg_class c
            WHERE c.relnamespace = pg_my_temp_schema() AND c.relname LIKE 'stg\\_%' AND c.relkind = 'r' LOOP
    EXECUTE format('SELECT count(*) FROM pg_temp.%I s WHERE row_to_json(s)::text LIKE %L OR row_to_json(s)::text LIKE %L',
      r.relname, '%{SMP}%', '%{KP}%') INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'STOPP I4: % har fortsatt % rader med prod-id for SM/Kenneth', r.relname, n; END IF;
  END LOOP;
  RAISE NOTICE 'I4 ok: ingen prod-id for SM eller Kenneth igjen';
END $$;

\\echo '== I5 import i FK-rekkefølge'
INSERT INTO public.users SELECT * FROM {stg('public.users')};
INSERT INTO public.organizations SELECT * FROM {stg('public.organizations')} WHERE id <> '{SMT}';
UPDATE public.organizations o SET {", ".join(f"{c} = s.{c}" for c in ORG_OPPDATER)}, updated_at = now()
  FROM {stg('public.organizations')} s WHERE o.id = s.id AND s.id = '{SMT}';""")
    for t, _, _ in TABELLER[2:]:
        o.append(f"INSERT INTO {t} SELECT * FROM {stg(t)};")
    o.append(f"""
\\echo '== K1 kontrolltall: prod-eksport = innlest = finnes på test, per tabell'
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

\\echo '== K2 hengende løse referanser i de importerte radene (skal være 0)'
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
            WHERE c.relnamespace = pg_my_temp_schema() AND c.relname LIKE 'stg\\_%' AND c.relkind = 'r'
              AND a.attname LIKE '%\\_id' AND a.attname NOT IN ({q(IKKE_PEKER)})
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

\\echo '== K3 negativkontroll persondata: importerte brukere har bare fiktiv e-post, og ingen har prod-e-posten sin'
SELECT count(*) AS importerte_brukere,
       count(*) FILTER (WHERE u.email NOT LIKE '%@test.sitedoc.invalid') AS ekte_epost,
       count(*) FILTER (WHERE md5(lower(u.email)) IN (SELECT md5 FROM _epost_md5)) AS prod_epost_treff,
       count(*) FILTER (WHERE u.phone IS NOT NULL OR u.image IS NOT NULL OR u.fodselsdato IS NOT NULL
                          OR u.hms_kort_nr IS NOT NULL OR u.nasjonalitet IS NOT NULL
                          OR u.arbeidstillatelse IS NOT NULL) AS persondata_igjen,
       count(*) FILTER (WHERE NOT u.can_login) AS kan_ikke_logge_inn
  FROM users u WHERE u.id IN (SELECT id FROM {stg('public.users')});
DO $$
DECLARE n_imp bigint; n_ekte bigint; n_md5 bigint; n_pd bigint;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE email NOT LIKE '%@test.sitedoc.invalid'),
         count(*) FILTER (WHERE md5(lower(email)) IN (SELECT md5 FROM _epost_md5)),
         count(*) FILTER (WHERE phone IS NOT NULL OR image IS NOT NULL OR fodselsdato IS NOT NULL
                            OR hms_kort_nr IS NOT NULL OR nasjonalitet IS NOT NULL OR arbeidstillatelse IS NOT NULL)
    INTO n_imp, n_ekte, n_md5, n_pd
    FROM users WHERE id IN (SELECT id FROM {stg('public.users')});
  -- Kontrollen er ikke tom: den må ha brukere å se på, og prod-md5-lista må ha innhold.
  IF n_imp = 0 OR (SELECT count(*) FROM _epost_md5) = 0 THEN
    RAISE EXCEPTION 'STOPP K3: negativkontrollen er tom (importerte=%, md5=%)', n_imp, (SELECT count(*) FROM _epost_md5);
  END IF;
  IF n_ekte > 0 OR n_md5 > 0 OR n_pd > 0 THEN
    RAISE EXCEPTION 'STOPP K3: ekte e-post=%, prod-e-post-treff=%, persondata igjen=%', n_ekte, n_md5, n_pd;
  END IF;
  IF EXISTS (SELECT 1 FROM organizations WHERE id IN ('{AM}', '{SMT}')
             AND invoice_email IS NOT NULL AND invoice_email NOT LIKE '%@test.sitedoc.invalid') THEN
    RAISE EXCEPTION 'STOPP K3: firma-faktura-e-post er ikke fiktiv';
  END IF;
  RAISE NOTICE 'K3 ok: % importerte brukere, alle fiktive', n_imp;
END $$;
\\echo '   (info) test-brukere fra før med samme e-post som en prod-bruker i omfanget — forventet: Kenneth + de som T3 viste'
SELECT count(*) AS test_brukere_med_prod_epost FROM users WHERE md5(lower(email)) IN (SELECT md5 FROM _epost_md5);

\\echo '== K4 prosjektnavn som finnes to ganger i samme firma etter import (meldes, begge beholdes)'
SELECT o.name AS firma, p.name AS prosjekt, count(*) AS antall
  FROM projects p JOIN organizations o ON o.id = p.primary_organization_id
 WHERE o.id IN ('{AM}', '{SMT}')
 GROUP BY 1, 2 HAVING count(*) > 1 ORDER BY 1, 2;

\\echo '== K5 oversikt etter import'
SELECT o.name,
  (SELECT count(*) FROM organization_members m WHERE m.organization_id = o.id) AS medlemmer,
  (SELECT count(*) FROM projects p WHERE p.primary_organization_id = o.id) AS prosjekter,
  (SELECT count(*) FROM timer.lonnsarter l WHERE l.organization_id = o.id) AS lonnsarter,
  (SELECT count(*) FROM timer.daily_sheets d WHERE d.organization_id = o.id) AS dagssedler,
  (SELECT count(*) FROM maskin.equipment e WHERE e.organization_id = o.id) AS maskiner,
  (SELECT l.navn FROM organization_settings s JOIN timer.lonnsarter l ON l.id = s.reise_lonnsart_id
    WHERE s.organization_id = o.id) AS reise_lonnsart
  FROM organizations o WHERE o.id IN ('{AM}', '{SMT}') ORDER BY 1;

\\if :commit
  COMMIT;
  \\echo '== FERDIG: COMMIT'
\\else
  ROLLBACK;
  \\echo '== TØRRKJØRING: alt rullet tilbake (kjør med -v commit=1 for å lagre)'
\\endif
""")
    return "\n".join(o)

if __name__ == "__main__":
    her = Path(__file__).parent
    (her / "1-eksport-prod.sql").write_text(eksport() + "\n")
    (her / "2-import-test.sql").write_text(importer() + "\n")
    print(f"skrev {len(TABELLER)} tabeller til 1-eksport-prod.sql og 2-import-test.sql")
