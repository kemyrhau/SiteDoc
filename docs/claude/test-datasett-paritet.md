---
tittel: Test-datasett-paritet — additiv kopi av firma fra prod til sitedoc_test
status: 🟢 MÅLING (DEL 1 ferdig — repo-analyse). DEL 2 er psql-batcher Kenneth kjører.
sist_verifisert_mot_kode: 2026-09-03
kilde: packages/db + db-timer + db-maskin + db-varelager (schema.prisma)
eier: Opus (kontrollplan-tre) · meldt cowork, ikke committet
---

# Kan SITEDOC MYRHAUG kopieres additivt fra prod → sitedoc_test?

**Kort svar:** Ja, mekanisk additivt (ingen serial/sekvenser å kollidere på — alle
primærnøkler er `uuid()`/`cuid()`-strenger, globalt unike per konstruksjon). **MEN** det
er ikke en ren INSERT-jobb: tre globale-peker-akser og én global unik kolonne kan brekke
innsettingen. Den globale unike kolonnen er **`project_number` — globalt unikt på tvers av
HELE databasen, ikke per firma** (`@unique` på `Project.projectNumber`), så et prod-nummer
kan allerede være i bruk i test og må avklares før kopi. Alle tre aksene må avklares mot
test FØR kopi. DEL 2-batchene under måler nettopp
disse. Filer kopieres ikke — `uploads`-volumet deles allerede (`docker-compose.test.yml:36`).

---

## DEL 1 — Repo-analyse (målt mot koden)

### 1. Fysisk oppsett som avgjør kopimekanikken

- Prod = database `sitedoc`, test = `sitedoc_test` — **separate databaser**, samme
  server-instans. Kopi må derfor gå på tvers av databaser (dump av filtrerte rader eller
  `postgres_fdw`/`dblink` — Kenneths mekanikk, ikke en enkel `INSERT … SELECT`).
- Modulene bor i **postgres-skjemaer i samme database**: kjernen i `public`, timer i
  `timer`, maskin i `maskin`, varelager i `varelager` (`schemas=[…]` i hver
  `schema.prisma`). Et firma spenner altså over fire skjemaer i én database.

### 2. ID-er: ingen serial-kollisjon

Alle `@id` på tvers av de fire skjemaene er `String @default(uuid())` eller `cuid()`.
**Null `autoincrement()` noe sted** (verifisert med grep). Ingen sekvenser/serial som
ville kollidert ved additiv innsetting. Primærnøkler er trygge å bevare som de er.

### 3. Avhengighetsgraf — innsettingsrekkefølge (topologisk)

`→ user` / `→ bibliotek` markerer FK mot en **global** tabell (se § 4 — hazard).

| Lag | Tabeller (skjema) | Avhenger av |
|-----|-------------------|-------------|
| **0. Reconcile (IKKE kopier blindt)** | `users`, `bibliotek_standarder`/`_kapitler`/`_maler` | Globale — må FINNES på test med matchende id (§ 4) |
| **1. Firma** | `organizations` | — |
| **2. Org-direkte** | `organization_members` **→ user**, `organization_modules`, `organization_integrations`, `organization_settings`, `organization_seed_policies`, `organization_partners`, `organization_templates` (+ `_objects`), `external_cost_objects`, `avdelinger`, `oppmotesteder`, `kompetansetyper`, `arbeidstids_kalender` | `organizations` |
| **3. Prosjekt** | `projects` (`primary_organization_id`), `project_organizations` (junction) | `organizations` |
| **4. Prosjekt-barn** | `project_members` **→ user**, `project_groups`, `faggrupper` **→ user** (ansvarlig), `dokumentflyt_koblinger`, `byggeplasser`, `drawings`, `point_clouds`, `report_templates`, `project_modules`, `folders`, `project_invitations` **→ user** | `projects` |
| **5.** | `drawing_revisions` **→ user**, `omrader`, `report_objects`, `group_faggrupper`, `project_group_members` **→ user**, `project_group_byggeplasser`, `folder_access`, `reisetid_matrise` | lag 4 |
| **6.** | `checklists` **→ user**×3, `tasks` **→ user**×3, `godkjenninger` **→ user**×3, `dokumentflyter`, `psi` | lag 4/5 |
| **7.** | `checklist_change_log` **→ user**, `task_change_log` **→ user**, `task_comments` **→ user**, `document_transfers` **→ user**×2, `dokumentflyt_medlemmer`, `dokumentflyt_maler`, `psi_signaturer`, `psi_tilstedevarelse` **→ user** | lag 6 |
| **8.** | `kontrollplaner` **→ user**, `milepeler`, `kontrollplan_punkter`, `kontrollplan_historikk` **→ user**, `kontrollplan_import` **→ user**, `prosjekt_bibliotek_valg` **→ bibliotek**, `activity_log` **→ user**, `images`, `ftd_*` (økonomi), `ansatt_kompetanser` **→ user** + kompetansetype | lag 4–7 |
| **9. Moduler** | `timer.lonnsarter`/`aktiviteter`/`tillegg`/`expense_categories` (org) → `timer.daily_sheets` **→ user**,org,prosjekt → `sheet_timer`/`sheet_tillegg`/`sheet_utlegg`/`sheet_machines` → `timer.eksport_oppsett`; `maskin.equipment` (org) → `equipment_ansvarlige`/`equipment_assignments` **→ user**; `varelager.vare_kategorier`/`varer` (org) → `vareforbruk` **→ user** | lag 1/3 |

Barn-tabeller ikke listet eksplisitt (f.eks. `sheet_tillegg_vedlegg`, `ftd_document_blocks`,
`kontrollplan_punkter`-barn) følger sin forelder i samme lag.

### 4. Der additiv innsetting BREKKER — globale pekere + global unik kolonne

Dette er kjernen i spørsmålet. Fire punkter, alle må avklares mot test først:

**A) `users` er 100 % global — ingen `organizationId` på `User`.** Bekreftet: legacy
`User.organizationId` ble droppet (O-1/O-2), medlemskap går kun via `organization_members`.
`email` er `@unique` (global). Konsekvens:
- Hver bruker som org-radene peker på, må finnes på test **med samme id**.
- Er `kemyrhau@gmail.com` (og øvrige medlemmer) på test med en **annen** id enn på prod,
  er dette **ikke** en additiv kopi: hver `*_user_id`/`sender_id`/`bruker_id` osv. må
  **remappes** prod-id → test-id før innsetting. Uten remap: FK-brudd på de **harde**
  FK-ene (`checklists.bestiller_user_id`, `tasks.bestiller_user_id`,
  `godkjenninger.bestiller_user_id`, `document_transfers.sender_id`,
  `*_change_log.user_id`, `organization_members.user_id`, `ansatt_kompetanser.user_id`,
  `kontrollplan_historikk.bruker_id`, `kontrollplan_import.importert_av_id`,
  `project_invitations.invited_by_user_id`) — og **dinglende** svak-FK i modul-skjemaene
  (`daily_sheets.user_id`, `attestert_av_user_id`, `equipment_assignments.user_id`,
  `vareforbruk` osv., som ikke har DB-FK og derfor ikke feiler, men peker på feil/ingen bruker).
- Finnes brukeren **ikke** på test: da kan `users`-raden fra prod settes inn (ingen
  e-post-kollisjon) med bevart id → referansene løser seg.
- ⚠️ **Referert bruker-sett ⊋ medlems-sett.** Dokumentflyt kan referere brukere i ANDRE
  firmaer (`document_transfers.recipient_user_id`, `checklists.recipient_user_id` mot en
  byggherre i annet org). Remap-tabellen må dekke **alle faktisk refererte** userId, ikke
  bare `organization_members`. DEL 2 prod-batch samler derfor det faktiske referanse-settet.

**B) `projects.project_number` er GLOBALT `@unique`** (`schema.prisma:575`) — ikke
org-scopet. Har test allerede et prosjekt med samme `project_number` som et av firmaets
prod-prosjekter, **feiler innsettingen**. Må sjekkes (DEL 2) og evt. remappes.

**C) `prosjekt_bibliotek_valg → bibliotek_maler`.** `bibliotek_standarder/_kapitler/_maler`
er globale system-tabeller (`bibliotek_standarder.kode @unique`, ingen `organizationId`).
Er biblioteket ikke seedet identisk på test (samme mal-id-er), peker kopierte
`prosjekt_bibliotek_valg.bibliotek_mal_id` på ikke-eksisterende mal. Verifiser at
`bibliotek_maler` matcher, ellers remap/hopp over disse radene.

**D) Firmaet må IKKE finnes på test fra før.** Org-scopede unike nøkler er alle
`@@unique([organizationId, …])` → nytt org gir ingen kollisjon. Men `organization_settings`
har `organizationId @unique` (én rad pr. firma), og et halvt-eksisterende firma på test
ville kollidert. DEL 2 test-batch sjekker eksistens først.

### 5. Skal IKKE kopieres (miljøspesifikt / efemert / globalt)

- `sessions`, `accounts`, `verification_tokens` — auth, per-miljø. (Sesjoner/tokens er verdiløse på test.)
- `impersonation_audit` — revisjonsspor, per-miljø.
- `eksport_jobber`, `timer.eksport_oppsett`-artefakter, `ftd_translation_jobs` — efemere jobber med utløp/filstier.
- `translation_cache` — global cache, ikke org-scopet, regenereres.
- `uploads`-filer — deles allerede via volum (`docker-compose.test.yml:36`); kun DB-rader kopieres.
- `activity_log` — valgfritt (feed). Bærer harde `user_id`-FK; kopier kun hvis feed-historikk ønskes, ellers hopp over.

---

## DEL 2 — psql-batcher (Kenneth kjører; Opus har ikke server-tilgang)

To blokker, én pr. database. Sammenlign de to utskriftene: match `email → id` mellom prod
og test, og sjekk `project_number`-overlapp. Bytt firmanavnet i `WHERE` hvis stavemåten avviker.

### Blokk 1 — PROD (`sitedoc`)

```sql
\set ON_ERROR_STOP on
\echo '===== PROD sitedoc ====='
\echo '--- 1. Firma-rad ---'
SELECT id, name, organization_number FROM organizations WHERE name ILIKE 'SITEDOC MYRHAUG';

\echo '--- 2. Medlemmer (email -> id, rolle) ---'
SELECT om.user_id, u.email, u.role AS bruker_rolle, om.role AS org_rolle
FROM organization_members om
JOIN users u ON u.id = om.user_id
WHERE om.organization_id = (SELECT id FROM organizations WHERE name ILIKE 'SITEDOC MYRHAUG')
ORDER BY u.email;

\echo '--- 3. ALLE faktisk refererte brukere (utover medlemmer) — remap-grunnlag ---'
WITH org AS (SELECT id FROM organizations WHERE name ILIKE 'SITEDOC MYRHAUG'),
     prj AS (
       SELECT id FROM projects WHERE primary_organization_id IN (SELECT id FROM org)
       UNION SELECT project_id FROM project_organizations WHERE organization_id IN (SELECT id FROM org)
     ),
     refs AS (
       SELECT user_id AS uid FROM organization_members WHERE organization_id IN (SELECT id FROM org)
       UNION SELECT user_id FROM project_members WHERE project_id IN (SELECT id FROM prj)
       UNION SELECT ansvarlig_id FROM faggrupper WHERE project_id IN (SELECT id FROM prj)
       UNION SELECT bestiller_user_id FROM checklists WHERE project_id IN (SELECT id FROM prj)
       UNION SELECT eier_user_id FROM checklists WHERE project_id IN (SELECT id FROM prj)
       UNION SELECT recipient_user_id FROM checklists WHERE project_id IN (SELECT id FROM prj)
       UNION SELECT bestiller_user_id FROM tasks WHERE project_id IN (SELECT id FROM prj)
       UNION SELECT recipient_user_id FROM tasks WHERE project_id IN (SELECT id FROM prj)
       UNION SELECT bestiller_user_id FROM godkjenninger WHERE project_id IN (SELECT id FROM prj)
       UNION SELECT godkjent_av_user_id FROM godkjenninger WHERE project_id IN (SELECT id FROM prj)
       UNION SELECT sender_id FROM document_transfers WHERE project_id IN (SELECT id FROM prj)
       UNION SELECT recipient_user_id FROM document_transfers WHERE project_id IN (SELECT id FROM prj)
       UNION SELECT user_id FROM checklist_change_log ccl
             JOIN checklists c ON c.id = ccl.checklist_id WHERE c.project_id IN (SELECT id FROM prj)
     )
SELECT DISTINCT u.id, u.email
FROM refs JOIN users u ON u.id = refs.uid
WHERE refs.uid IS NOT NULL
ORDER BY u.email;

\echo '--- 4. project_number for firmaets prosjekter (global unik — kollisjonssjekk) ---'
SELECT id, project_number, name
FROM projects
WHERE primary_organization_id = (SELECT id FROM organizations WHERE name ILIKE 'SITEDOC MYRHAUG')
   OR id IN (SELECT project_id FROM project_organizations
             WHERE organization_id = (SELECT id FROM organizations WHERE name ILIKE 'SITEDOC MYRHAUG'));

\echo '--- 5. Radtelling pr. tabell for firmaet (prod) ---'
WITH org AS (SELECT id FROM organizations WHERE name ILIKE 'SITEDOC MYRHAUG'),
     prj AS (
       SELECT id FROM projects WHERE primary_organization_id IN (SELECT id FROM org)
       UNION SELECT project_id FROM project_organizations WHERE organization_id IN (SELECT id FROM org)
     )
SELECT 'organization_members' t, count(*) n FROM organization_members WHERE organization_id IN (SELECT id FROM org)
UNION ALL SELECT 'organization_modules', count(*) FROM organization_modules WHERE organization_id IN (SELECT id FROM org)
UNION ALL SELECT 'organization_settings', count(*) FROM organization_settings WHERE organization_id IN (SELECT id FROM org)
UNION ALL SELECT 'organization_integrations', count(*) FROM organization_integrations WHERE organization_id IN (SELECT id FROM org)
UNION ALL SELECT 'organization_partners', count(*) FROM organization_partners WHERE organization_id IN (SELECT id FROM org)
UNION ALL SELECT 'organization_templates', count(*) FROM organization_templates WHERE organization_id IN (SELECT id FROM org)
UNION ALL SELECT 'external_cost_objects', count(*) FROM external_cost_objects WHERE organization_id IN (SELECT id FROM org)
UNION ALL SELECT 'avdelinger', count(*) FROM avdelinger WHERE organization_id IN (SELECT id FROM org)
UNION ALL SELECT 'oppmotesteder', count(*) FROM oppmotesteder WHERE organization_id IN (SELECT id FROM org)
UNION ALL SELECT 'kompetansetyper', count(*) FROM kompetansetyper WHERE organization_id IN (SELECT id FROM org)
UNION ALL SELECT 'projects', count(*) FROM projects WHERE id IN (SELECT id FROM prj)
UNION ALL SELECT 'project_members', count(*) FROM project_members WHERE project_id IN (SELECT id FROM prj)
UNION ALL SELECT 'faggrupper', count(*) FROM faggrupper WHERE project_id IN (SELECT id FROM prj)
UNION ALL SELECT 'byggeplasser', count(*) FROM byggeplasser WHERE project_id IN (SELECT id FROM prj)
UNION ALL SELECT 'drawings', count(*) FROM drawings WHERE project_id IN (SELECT id FROM prj)
UNION ALL SELECT 'report_templates', count(*) FROM report_templates WHERE project_id IN (SELECT id FROM prj)
UNION ALL SELECT 'checklists', count(*) FROM checklists WHERE project_id IN (SELECT id FROM prj)
UNION ALL SELECT 'tasks', count(*) FROM tasks WHERE project_id IN (SELECT id FROM prj)
UNION ALL SELECT 'godkjenninger', count(*) FROM godkjenninger WHERE project_id IN (SELECT id FROM prj)
UNION ALL SELECT 'document_transfers', count(*) FROM document_transfers WHERE project_id IN (SELECT id FROM prj)
UNION ALL SELECT 'dokumentflyter', count(*) FROM dokumentflyter WHERE project_id IN (SELECT id FROM prj)
UNION ALL SELECT 'kontrollplaner', count(*) FROM kontrollplaner WHERE project_id IN (SELECT id FROM prj)
UNION ALL SELECT 'psi', count(*) FROM psi WHERE project_id IN (SELECT id FROM prj)
UNION ALL SELECT 'images', count(*) FROM images WHERE project_id IN (SELECT id FROM prj)
UNION ALL SELECT 'timer.daily_sheets', count(*) FROM timer.daily_sheets WHERE organization_id IN (SELECT id FROM org)
UNION ALL SELECT 'maskin.equipment', count(*) FROM maskin.equipment WHERE organization_id IN (SELECT id FROM org)
UNION ALL SELECT 'varelager.varer', count(*) FROM varelager.varer WHERE organization_id IN (SELECT id FROM org)
ORDER BY t;
```

### Blokk 2 — TEST (`sitedoc_test`)

```sql
\set ON_ERROR_STOP on
\echo '===== TEST sitedoc_test ====='
\echo '--- 1. Finnes firmaet alt? (skal helst gi 0 rader) ---'
SELECT id, name, organization_number FROM organizations WHERE name ILIKE 'SITEDOC MYRHAUG';

\echo '--- 2. kemyrhau@gmail.com paa test — id for sammenligning mot prod ---'
SELECT id, email, role FROM users WHERE email ILIKE 'kemyrhau@gmail.com';

\echo '--- 3. Alle test-brukere (email -> id) — diff mot prod blokk 1 pkt 2+3 ---'
-- Test-DB har faa brukere; hele lista er greivest for email->id-remap.
-- Er den stor: legg til  WHERE email = ANY( ARRAY[ <prod-e-postene> ] )
SELECT id, email, role FROM users ORDER BY email;

\echo '--- 4. Kolliderer noe project_number? Lim inn prod-numrene fra blokk 1 pkt 4 ---'
SELECT id, project_number, name FROM projects
WHERE project_number = ANY( ARRAY['<PRJ-fra-prod-1>','<PRJ-fra-prod-2>'] );

\echo '--- 5. Er bibliotek seedet identisk? (antall + noen id-er for stikkprove) ---'
SELECT count(*) AS antall_maler FROM bibliotek_maler;
```

### Slik leses resultatet

1. **Blokk 2 pkt 1 tom** → firmaet finnes ikke på test (bra, additivt mulig). Ikke-tom →
   avklar før noe kopieres (punkt D).
2. **Match blokk 1 pkt 2+3 mot blokk 2 pkt 3 på `email`:**
   - Samme email + **samme id** → ingen remap nødvendig for den brukeren.
   - Samme email + **ulik id** → remap `prod-id → test-id` kreves for ALLE `*_user_id` i kopien.
   - Email finnes kun i prod → `users`-raden kan settes inn med bevart id (ingen kollisjon).
3. **Blokk 1 pkt 4 vs. blokk 2 pkt 4:** overlappende `project_number` → må remappes (global unik).
4. **Blokk 2 pkt 5:** avvin `bibliotek_maler`-antall mot prod → verifiser mal-id-paritet før `prosjekt_bibliotek_valg` kopieres.

---

## Konklusjon

Additiv kopi er **mulig og trygg mot eksisterende test-data** (ingen sletting/endring, ingen
serial-kollisjon) forutsatt at DEL 2 viser: (A) firmaet ikke finnes på test, (B) refererte
brukere har matchende id-er ELLER en fullstendig `email→id`-remap bygges, (C) ingen
`project_number`-overlapp, (D) bibliotek-paritet. Er (B)/(C) ikke oppfylt, er det fortsatt
gjennomførbart — men da med en id-remap som del av kopien, ikke en ren `INSERT … SELECT`.

**Advarsel om referanse-integritet:** modul-skjemaene (timer/maskin/varelager) bruker
**svake** String-FK-er uten DB-constraint. De vil IKKE feile ved feil userId — de dingler
stille. Remap må derfor dekke dem eksplisitt; DB-en fanger dem ikke.
