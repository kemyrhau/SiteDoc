## DB-naming-audit — Fase 0 kartlegging

**Dato:** 2026-04-25
**Branch:** `feature/maskin-db` (HEAD `b66cdc6`)
**Metode:** Read-only SELECT mot `information_schema`, `pg_catalog`, `_prisma_migrations`. Ingen DDL utført.
**Scope:** Kun fysiske DB-objekter (tabeller, kolonner, FK, indekser, sekvenser, views, triggere, rutiner). Snapshot-felt og tRPC-aliaser er utenfor scope per [db-opprydning.md «Avgrensning»](db-opprydning.md#avgrensning-av-denne-fasen).

**Status:** Alle tre miljøer kartlagt (lokal, test, prod).

---

## Hovedfunn — kort oppsummering

**Test og prod er ALLEREDE ferdig renamed. Lokal er den eneste som er bak.**

| Funn | Lokal | Test (`sitedoc_test`) | Prod (`sitedoc`) |
|---|---|---|---|
| `enterprises`-tabell finnes? | **JA** (3 rader) | NEI | NEI |
| `member_enterprises` finnes? | **JA** (2 rader) | NEI | NEI |
| `group_enterprises` finnes? | **JA** (0 rader) | NEI | NEI |
| `workflows*`-tabeller finnes? | **JA** (alle 3) | NEI | NEI |
| `buildings`-tabell finnes? | **JA** (2 rader) | NEI | NEI |
| `dokumentflyt_parts` finnes? | NEI | JA (9 rader) | JA (17 rader) |
| `byggeplasser` finnes? | NEI | JA (5 rader) | JA (7 rader) |
| `enterprise_rename_dokumentflyt_part` applied? | NEI (uforsøkt) | **JA** (2026-04-15) | **JA** (2026-04-16) |
| `faggruppe_rename` applied? | NEI (uforsøkt) | **JA** (2026-04-16) | **JA** (2026-04-16) |
| `navnegjennomgang` applied? | NEI (failed) | **JA** (2026-04-05) | **JA** (2026-04-06) |
| `enterprise`-kolonner gjenstår | 17 (alle gamle) | **2** (snapshot-felt — utenfor scope) | **2** (snapshot-felt — utenfor scope) |
| pgvector-extension | NEI | JA v0.6.0 | JA v0.6.0 |
| Failed/pending migreringer | 6 | 2 (artifakter — se §3) | 0 |

**Konsekvens:**
- DB-naming-opprydningen er allerede gjennomført på test og prod for ~10 dager siden.
- Det som gjenstår er IKKE fysiske DB-renames — det er:
  1. Bringe **lokal** opp til samme state (re-seed eller fikse migreringskjeden)
  2. **Fjerne `@@map`-direktiver** fra Prisma-modellene (siden DB-navn nå matcher modellnavn)
  3. Avklare 4 mindre punkter (se §6)

---

## 1. Sammendrag — lokal (utdatert state)

| Funn | Detalj |
|---|---|
| **Lokal DB er 26 migreringer bak kildekoden** | 109 i `migrations/`, 83 applied, 6 failed = 89 kjent for Prisma. **20 senere migreringer aldri forsøkt** lokalt (blokkert av første failed) |
| **Migreringskjeden er brutt** | Førsteblokk er `20260331120000_embedding_vector_pgvector` (manglende `vector`-extension lokalt). Den setter av kjede som forhindrer alle senere migreringer |
| **Faggruppe-rename er IKKE applied lokalt** | Migreringene `20260415180000_enterprise_rename_dokumentflyt_part` og `20260416180000_faggruppe_rename` finnes i kildekoden men er aldri kjørt lokalt |
| **Workflow-rename er IKKE applied lokalt** | `20260405180000_navnegjennomgang` (sletter `workflows*`, renamer `buildings`→`byggeplasser`, `creator_*`→`bestiller_*`) er failed lokalt |
| **Lokal DB er IKKE gyldig referanse for «hva er state»** | Den er kraftig bak. Gamle tabeller (`enterprises`, `workflows`, `buildings`) eksisterer fortsatt parallelt med delvis-renamede `dokumentflyt*`-tabeller |
| **Spørsmålet «hva skal renames» er allerede besvart i kildekoden** | Komplett rename-SQL finnes i tre migreringer. Spørsmålet er KUN om disse er applied i test/prod |

**Implikasjon:** Hovedusikkerheten er om test og prod har samme dødvann som lokal, eller om de er foran (rename allerede kjørt). Krever same-shaped audit der.

---

## 2. Lokal DB — detaljerte funn

**Database:** `sitedoc` på `localhost:5432` (bruker `kennethmyrhaug`).

### 2.1 _prisma_migrations — status

| Status | Antall |
|---|---|
| APPLIED | 83 |
| FAILED/PENDING | 6 |
| Eksisterer i kildekoden men aldri forsøkt | 20 |
| **Totalt i kildekoden** | **109** |

### 2.2 Failed migreringer (alle blokkerer videre fremdrift)

Prisma stopper på første failed — alle senere blir værende uforsøkt.

| # | Migrering | Feilkode | Årsak |
|---|---|---|---|
| 1 | `20260331120000_embedding_vector_pgvector` | `0A000` | `extension "vector" is not available` (pgvector ikke installert lokalt) |
| 2 | `20260331130000_norbert_768_dim` | `42704` | Følgefeil av #1 (vector-type mangler) |
| 3 | `20260401010000_embedding_384_dim` | `42704` | Følgefeil av #1 |
| 4 | `20260401020000_norbert_768_python` | `42704` | Følgefeil av #1 |
| 5 | `20260402220000_source_language_to_project` | `42703` | Refererer kolonne som ikke finnes (kjede-følge) |
| 6 | `20260405180000_navnegjennomgang` | `42P01` | `relation "ftd_kontrakter" does not exist` — `ftd_kontrakter`-tabellen mangler fordi `nota_period_kontrakt_document` (også uforsøkt) ikke har kjørt |

**Tolkning:** Lokal DB har aldri hatt pgvector. Alle migreringer fra og med 2026-03-31 er blokkert. Dette inkluderer hele FTD-modulen (kontrakter, change events, oversettelse, oversettelses-cache), bibliotek/kontrollplan-systemet og alle rename-migreringer.

### 2.3 Migreringer i kildekoden men aldri forsøkt lokalt (20 stk)

```
20260406020000_fiks_rolle_utforer
20260406120000_dokumentflyt_roller
20260406190000_hovedansvarlig_person_id
20260406200000_er_firmaansvarlig
20260407010000_ytelsesindekser
20260407020000_sjekkliste_posisjon
20260407030000_transfer_snapshot
20260408100000_eier_felt
20260408110000_per_ledd_redigerbarhet
20260408120000_tabelloppsett
20260408130000_utskriftsinnstillinger
20260411120000_gruppe_rettighet
20260411130000_revert_gruppe_rettighet
20260411140000_bilde_sort_order
20260412160000_drawing_dimensions
20260413120000_spec_post_unique_constraint
20260413180000_nota_period_kontrakt_document
20260415120000_organisasjon_integrasjoner
20260415180000_enterprise_rename_dokumentflyt_part   ← rename del 1
20260415200000_add_sjekklistebibliotek
20260415220000_lest_av_mottaker_ved
20260415230000_task_enterprise_nullable              ← rename støttesteg
20260416180000_faggruppe_rename                      ← rename del 2
20260417180000_bibliotek_mal_prioritet
20260417200000_sone_modell
20260418120000_kontrollplan
```

### 2.4 Faktisk skjema — 50 tabeller, mange med gamle navn

**Tabeller med "enterprise" i navnet (skal renames per kildekoden):**

| Tabell | Rader | Skal renames til |
|---|---|---|
| `enterprises` | 3 | `dokumentflyt_parts` (per migrering 20260415180000) |
| `member_enterprises` | 2 | `dokumentflyt_koblinger` |
| `group_enterprises` | 0 | `group_faggrupper` |

**Tabeller med "workflow" i navnet (skal slettes per kildekoden):**

| Tabell | Rader | Skal |
|---|---|---|
| `workflows` | 3 | DROP (per `navnegjennomgang`) |
| `workflow_templates` | 4 | DROP |
| `workflow_step_members` | 0 | DROP |

**Andre relevante tabeller:**

| Tabell | Rader | Status |
|---|---|---|
| `buildings` | 2 | Skal renames til `byggeplasser` |
| `documents` | 0 | Ikke i Prisma-skjemaet — gammel rest fra eldre datamodell, ingen referanser |

**Tabeller som mangler (skulle eksistere per Prisma):**

`byggeplasser`, `omrader`, `bibliotek_standarder`, `bibliotek_kapitler`, `bibliotek_maler`, `prosjekt_bibliotek_valg`, `ftd_kontrakter`, `ftd_change_events`, `ftd_tnota_change_links`, `ftd_document_blocks`, `ftd_translation_jobs`, `translation_cache`, `dokumentflyt_parts`, `dokumentflyt_koblinger`, `group_faggrupper`.

(Konsekvens: Prisma-klient mot denne lokal-DB-en vil feile på spørringer mot disse modellene. Det gir mening at Kenneth jobber primært mot test-DB, ikke lokal.)

### 2.5 Kolonner med "enterprise" i navnet (17 stk)

Per query mot `information_schema.columns`:

| Tabell | Kolonne | Skal renames til (per kildekoden) |
|---|---|---|
| `checklists` | `creator_enterprise_id` | `bestiller_enterprise_id` (navnegjennomgang) → `bestiller_faggruppe_id` (faggruppe_rename) |
| `checklists` | `responder_enterprise_id` | `utforer_enterprise_id` → `utforer_faggruppe_id` |
| `dokumentflyt_medlemmer` | `enterprise_id` | `faggruppe_id` |
| `dokumentflyter` | `enterprise_id` | `faggruppe_id` |
| `enterprises` | `enterprise_number` | `faggruppe_nummer` |
| `folder_access` | `enterprise_id` | `faggruppe_id` (+ data: `access_type='enterprise'` → `'faggruppe'`) |
| `ftd_nota_periods` | `enterprise_id` | `faggruppe_id` (men: `ftd_nota_periods` mangler i lokal — finnes i kildekoden) |
| `group_enterprises` | `enterprise_id` | `faggruppe_id` |
| `member_enterprises` | `enterprise_id` | `faggruppe_id` |
| `project_invitations` | `enterprise_id` | `faggruppe_id` |
| `report_templates` | `show_enterprise` (boolean) | `show_faggruppe` |
| `tasks` | `creator_enterprise_id` | → `bestiller_enterprise_id` → `bestiller_faggruppe_id` |
| `tasks` | `responder_enterprise_id` | → `utforer_enterprise_id` → `utforer_faggruppe_id` |
| `workflows` | `enterprise_id` | tabellen skal droppes |
| `workflows` | `responder_enterprise_id` | tabellen skal droppes |
| `workflows` | `responder_enterprise_2_id` | tabellen skal droppes |
| `workflows` | `responder_enterprise_3_id` | tabellen skal droppes |

Pluss kolonner som `building_id` på `drawings`, `point_clouds`, `checklists`, `psi`, `ftd_kontrakter` — alle skal renames til `byggeplass_id`.

Pluss `building_ids` (jsonb) på `project_groups` — IKKE i `navnegjennomgang`-migreringen. Sannsynlig oversett, må verifiseres.

### 2.6 FK-constraints (23 relevante)

Alle FK som refererer `enterprises`, `workflows`, `buildings`, `documents`. Disse må droppes og gjenopprettes som del av rename — kildekoden i `20260415180000_enterprise_rename_dokumentflyt_part` håndterer dette eksplisitt for FK-ene som finnes på sitt tidspunkt.

**Bemerkning:** `kontrollplan_punkter.faggruppe_id` peker til `enterprises.id` — kolonnen er allerede renamed (kommer fra senere migrering), men FK-målet er fortsatt gammel tabell. Inkonsistent — skyldes manuell reparasjon eller blandet migreringsstate. Bør verifiseres mot test/prod om samme.

### 2.7 Sekvenser, views, triggere, rutiner

| Type | Antall | Relevant for rename? |
|---|---|---|
| Sekvenser med relevant navn | 0 | Nei — alle id-kolonner bruker UUID/`text`, ingen serial |
| Views | 0 | Nei |
| Triggere | 1 (`ftd_chunk_search_trigger` på `ftd_document_chunks`) | Nei — ikke relatert til rename |
| Funksjoner/prosedyrer | 1 (`ftd_chunk_search_vector_update`) | Nei |

**Konklusjon:** Ingen sequences eller views å oppdatere. Triggere/rutiner er FTD-relatert og urørt av rename.

### 2.8 Indekser

Indekser med relevante prefiks finnes på alle gamle tabeller (f.eks. `enterprises_pkey`, `member_enterprises_project_member_id_enterprise_id_key`). Kildekoden i `20260415180000` og `20260416180000` håndterer eksplisitt rename av disse.

---

## 3. Hva rename-migreringene i kildekoden gjør

Tre migreringer i kjede:

### 3.1 `20260405180000_navnegjennomgang` (failed lokalt)

- **Fase A:** Sletter `workflows`, `workflow_templates`, `workflow_step_members`. Dropper `workflow_id` fra `checklists` og `tasks`.
- **Fase B:** Renamer kolonner: `creator_enterprise_id` → `bestiller_enterprise_id`, `responder_enterprise_id` → `utforer_enterprise_id`, `creator_user_id` → `bestiller_user_id` (på `checklists` og `tasks`). Oppdaterer rolle-strenger i `dokumentflyt_medlemmer` (`oppretter`→`bestiller`, `svarer`→`utfører`).
- **Fase C:** Renamer `buildings` → `byggeplasser`. Renamer `building_id` → `byggeplass_id` på `drawings`, `point_clouds`, `checklists`, `ftd_kontrakter`, `psi`.

### 3.2 `20260415180000_enterprise_rename_dokumentflyt_part` (uforsøkt lokalt)

- Dropper alle FK som peker på `enterprises` og som `enterprises` har.
- Fjerner `enterprises.organization_id` (anses ikke å høre hjemme på dokumentflyt-rollen).
- Renamer `enterprises` → `dokumentflyt_parts`, `member_enterprises` → `dokumentflyt_koblinger`.
- Renamer indekser, gjenoppretter alle FK med riktige målnavn.

### 3.3 `20260416180000_faggruppe_rename` (uforsøkt lokalt)

- Renamer `enterprise_*`-kolonner → `faggruppe_*` på 8 tabeller.
- Renamer `group_enterprises` → `group_faggrupper`.
- Renamer `bestiller_enterprise_id` → `bestiller_faggruppe_id` (avhengig av at navnegjennomgang har gjort `creator_*` → `bestiller_*` først).
- Oppdaterer data: `folder_access.access_type='enterprise'` → `'faggruppe'`. Oppdaterer `project_groups.permissions` JSON (`enterprise_manage` → `faggruppe_manage`).
- Renamer relevante indekser.

**Bemerk:** Kildekoden henviser ikke til `project_groups.building_ids` (jsonb-kolonnen). Hvis den fortsatt heter `building_ids` etter `navnegjennomgang`, er det enten en oversikt eller en bevisst utelatelse (jsonb-innhold renames kan være risikabelt). **Diskuteres separat.**

---

## 4. Test (`sitedoc_test` på server)

**Database:** `sitedoc_test` på sitedoc-server (PostgreSQL 16.13).

### 4.1 _prisma_migrations — status

| Status | Antall rader |
|---|---|
| APPLIED | 110 |
| FAILED/PENDING | 2 |
| **Totalt** | **112** |

(Kildekoden har 109 unike migreringer. Test har 3 ekstra rader — se §4.7.)

### 4.2 Failed migreringer (begge er artifakter — ufarlig)

| # | Migrering | Status |
|---|---|---|
| 1 | `20260403120000_psi_building` | **DOBBEL RAD:** én FAILED + én OK (2026-04-05). Den FAILED-raden er en artefakt fra første forsøk; senere `prisma migrate resolve --applied` har lagt til en OK-rad. Det er den OK-raden som teller |
| 2 | `20260406020000_fiks_rolle_utforer` | FAILED uten OK-motpart. Likevel er ALLE senere migreringer applied OK (inkl. faggruppe_rename, kontrollplan), så Prisma har på et tidspunkt blitt fortalt å hoppe over. Bør verifiseres at sluttstaten er korrekt |

**Tolkning:** Verken hindrer videre fremdrift. Bør likevel ryddes (Prisma vil fortsatt klage hver gang `prisma migrate deploy` kjøres).

### 4.3 Rename-relaterte migreringer — ALLE APPLIED OK

| Migrering | Applied | Status |
|---|---|---|
| `20260309074947_dokumentflyt_ny_modell` | 2026-03-16 | OK |
| `20260403120000_psi_building` | 2026-04-05 | OK (med dobbel rad) |
| `20260404200000_hovedansvarlig_dokumentflyt` | 2026-04-04 | OK |
| `20260405180000_navnegjennomgang` | **2026-04-05** | **OK** ← `workflows*` slettet, `buildings` → `byggeplasser` |
| `20260406120000_dokumentflyt_roller` | 2026-04-06 | OK |
| `20260415180000_enterprise_rename_dokumentflyt_part` | **2026-04-15** | **OK** ← tabell-rename |
| `20260415230000_task_enterprise_nullable` | 2026-04-15 | OK |
| `20260416180000_faggruppe_rename` | **2026-04-16** | **OK** ← kolonne-rename |

### 4.4 Faktiske tabeller — ingen gamle navn

Av de 31 tabellene jeg sjekket eksplisitt:
- **EKSISTERER (24):** `bibliotek_kapitler`, `bibliotek_maler`, `bibliotek_standarder`, `byggeplasser`, `dokumentflyt_koblinger`, `dokumentflyt_maler`, `dokumentflyt_medlemmer`, `dokumentflyt_parts`, `dokumentflyter`, `ftd_change_events`, `ftd_document_blocks`, `ftd_kontrakter`, `ftd_nota_periods`, `ftd_nota_posts`, `ftd_tnota_change_links`, `ftd_translation_jobs`, `group_faggrupper`, `kontrollplan_historikk`, `kontrollplan_punkter`, `kontrollplaner`, `milepeler`, `omrader`, `prosjekt_bibliotek_valg`, `translation_cache`
- **EKSISTERER IKKE (gamle, godt slettet):** `enterprises`, `member_enterprises`, `group_enterprises`, `workflows`, `workflow_templates`, `workflow_step_members`, `buildings`, `documents`

### 4.5 Kolonner med "enterprise" i navnet — kun 2 gjenstår (snapshot-felter)

| Tabell | Kolonne | Status |
|---|---|---|
| `document_transfers` | `sender_enterprise_name` (text) | **Utenfor scope** per [db-opprydning.md «Avgrensning»](db-opprydning.md#avgrensning-av-denne-fasen) — bevisst beholdt som historisk snapshot |
| `document_transfers` | `recipient_enterprise_name` (text) | **Utenfor scope** — samme begrunnelse |

### 4.6 Kolonner med "faggruppe" i navnet — 14 stk, alle som forventet

`checklists.{bestiller,utforer}_faggruppe_id`, `dokumentflyt_koblinger.faggruppe_id`, `dokumentflyt_medlemmer.faggruppe_id`, `dokumentflyt_parts.faggruppe_nummer`, `dokumentflyter.faggruppe_id`, `folder_access.faggruppe_id`, `ftd_nota_periods.faggruppe_id`, `group_faggrupper.faggruppe_id`, `kontrollplan_punkter.faggruppe_id`, `project_invitations.faggruppe_id`, `report_templates.show_faggruppe`, `tasks.{bestiller,utforer}_faggruppe_id`.

### 4.7 Kolonner med "building"/"byggeplass" i navnet

| Tabell | Kolonne | Status |
|---|---|---|
| `checklists` | `byggeplass_id` | OK (renamed) |
| `drawings` | `byggeplass_id` | OK |
| `ftd_kontrakter` | `byggeplass_id` | OK |
| `kontrollplaner` | `byggeplass_id` | OK |
| `omrader` | `byggeplass_id` | OK |
| `point_clouds` | `byggeplass_id` | OK |
| `psi` | `byggeplass_id` | OK |
| **`project_groups`** | **`building_ids` (jsonb)** | **IKKE renamed.** Identisk på lokal, test, prod. Ikke håndtert av noen migrering |

### 4.8 FK-constraints — kolonner og refererte tabeller er rene, men constraint-NAVN er gamle

19 relevante FK-constraints. Alle peker korrekt til nye tabeller (`dokumentflyt_parts`, `byggeplasser`), men **navnene er beholdt fra entreprise-tida**:

- `checklists_creator_enterprise_id_fkey` (på kolonne `bestiller_faggruppe_id`)
- `checklists_responder_enterprise_id_fkey` (på `utforer_faggruppe_id`)
- `dokumentflyt_koblinger_enterprise_id_fkey` (på `faggruppe_id`)
- `dokumentflyt_medlemmer_enterprise_id_fkey`
- `dokumentflyter_enterprise_id_fkey`
- `folder_access_enterprise_id_fkey`
- `ftd_nota_periods_enterprise_id_fkey`
- `group_enterprises_enterprise_id_fkey` (på tabellen `group_faggrupper`)
- `project_invitations_enterprise_id_fkey`
- `tasks_creator_enterprise_id_fkey`, `tasks_responder_enterprise_id_fkey`
- `checklists_building_id_fkey`, `drawings_building_id_fkey`, `ftd_kontrakter_building_id_fkey`, `point_clouds_building_id_fkey`, `psi_building_id_fkey`
- (Konsistente i navngivning: `kontrollplan_punkter_faggruppe_id_fkey`, `kontrollplaner_byggeplass_id_fkey`, `omrader_byggeplass_id_fkey`)

Constraint-navn påvirker ikke funksjonalitet, kun lesbarhet i feilmeldinger og psql-output.

### 4.9 Sequences/views/triggere/rutiner

- **Sequences:** 0 relevante (alle id-er er UUID/text)
- **Views:** 0
- **Triggere:** 1 (`ftd_chunk_search_trigger` på `ftd_document_chunks` — pgvector-relatert, ikke rename)
- **Rutiner:** 38 (alle pgvector-funksjoner + 1 search-funksjon — ikke rename)

### 4.10 Avklart: `20260424001754_init` — er `db-maskin` Fase 1-init

Test har en applied-rad for `20260424001754_init` (2026-04-24 00:19:50). **Migreringen er legitim.** Den finnes i `packages/db-maskin/prisma/migrations/20260424001754_init/migration.sql` (211 linjer SQL: `CREATE SCHEMA "maskin"` + 5 tabeller). Den ble kjørt automatisk på test 2026-04-24 etter commit `a5667eb` («Maskin: opprett packages/db-maskin med Fase 1-skjema»), via `prisma migrate deploy`. Vil applies på prod ved neste merge til main.

Initial mistenksomhet skyldes at jeg kun sjekket `packages/db/prisma/migrations/` i forrige iterasjon. Se «Metode-merknad» nedenfor.

### 4.11 Metode-merknad: sjekk alle Prisma-skjemaer

`_prisma_migrations`-tabellen aggregerer migreringer fra **alle Prisma-skjemaer som peker på samme database**. SiteDoc har i dag to:
- `packages/db/prisma/migrations/` (hoved-skjema, 109 migreringer)
- `packages/db-maskin/prisma/migrations/` (maskin-modul, 1 migrering)

Fremtidige modul-skjemaer (`packages/db-timer`, `packages/db-mannskap`) vil tilføre flere. **Ved fremtidig audit av applied vs. kildekoden: sjekk ALLE migrations-kataloger i monorepoet, ikke bare `packages/db`.**

---

## 5. Prod (`sitedoc` på server)

**Database:** `sitedoc` på sitedoc-server (PostgreSQL 16.13).

### 5.1 _prisma_migrations — status

| Status | Antall rader |
|---|---|
| APPLIED | 109 |
| FAILED/PENDING | **0** |
| **Totalt** | **109** |

**Helt rent.** Matcher antall unike migreringer i kildekoden (109).

### 5.2 Rename-relaterte migreringer — ALLE APPLIED OK

| Migrering | Applied |
|---|---|
| `20260309074947_dokumentflyt_ny_modell` | 2026-03-09 |
| `20260403120000_psi_building` | 2026-04-05 |
| `20260404200000_hovedansvarlig_dokumentflyt` | 2026-04-05 |
| `20260405180000_navnegjennomgang` | **2026-04-06** |
| `20260406120000_dokumentflyt_roller` | 2026-04-16 |
| `20260415180000_enterprise_rename_dokumentflyt_part` | **2026-04-16** |
| `20260415230000_task_enterprise_nullable` | 2026-04-16 |
| `20260416180000_faggruppe_rename` | **2026-04-16** |

Alle siste applied (per LATEST_MIGS): `kontrollplan` (2026-04-23), `bibliotek_mal_prioritet` (2026-04-23), `sone_modell` (2026-04-23). Kildekoden er helt opp til siste migrering.

### 5.3 Faktiske tabeller

Av de 31 tabellene jeg sjekket eksplisitt:
- **EKSISTERER (22):** Samme som test, MINUS `ftd_change_events`, `ftd_tnota_change_links` (sannsynligvis ikke i bruk i prod-data ennå — bør verifiseres at det ikke er en applied-mismatch)
- **EKSISTERER IKKE:** Samme gamle som test (`enterprises`, `workflows*`, `buildings`, `documents` osv.)

**Sjekkpunkt:** `ftd_change_events` og `ftd_tnota_change_links` er definert i Prisma og applied (per migreringsstatus), men dukker ikke opp i tabell-listen. **Avvik. Bør verifiseres med ny query.**

### 5.4 Kolonner med "enterprise" — kun 2 (samme som test, snapshot-felt)

`document_transfers.{sender,recipient}_enterprise_name`. Utenfor scope.

### 5.5 Kolonner med "faggruppe" — 14, identisk med test

### 5.6 Kolonner med "building"/"byggeplass" — identisk med test

`project_groups.building_ids` (jsonb) er fortsatt IKKE renamed. Identisk på alle tre miljøer.

### 5.7 FK-constraints — identisk struktur som test

Samme 19 relevante FK-constraints. Samme inkonsistente navngivning (`*_enterprise_id_fkey` på `faggruppe_id`-kolonner, `*_building_id_fkey` på `byggeplass_id`-kolonner).

### 5.8 Sequences/views/triggere/rutiner — identisk med test

### 5.9 Rad-tellinger (kun gamle/nye relevant tabeller)

| Tabell | Test | Prod |
|---|---|---|
| `byggeplasser` | 5 | 7 |
| `omrader` | 2 | 0 |
| `dokumentflyt_parts` | 9 | 17 |
| `dokumentflyt_koblinger` | 20 | 11 |
| `group_faggrupper` | 0 | 0 |
| `dokumentflyter` | 9 | 24 |
| `dokumentflyt_maler` | 14 | 28 |
| `dokumentflyt_medlemmer` | 21 | 50 |
| `kontrollplan_punkter` | 8 | 0 |
| `ftd_kontrakter` | 2 | 1 |

Datamengdene er sunne. Alle gamle tabellnavn (`enterprises`, `member_enterprises`, `group_enterprises`, `workflows*`, `buildings`, `documents`) returnerer `<not-exists>` på begge — bekrefter at de er fysisk fjernet.

---

## 6. Endelig konklusjon — hva gjenstår faktisk

### 6.1 Det opprinnelige scope er allerede fullført på test og prod

Migreringene `navnegjennomgang`, `enterprise_rename_dokumentflyt_part` og `faggruppe_rename` er applied på begge serverdatabaser. Det er **ingen fysiske rename-operasjoner som gjenstår på test eller prod** for tabellene som var i scope.

### 6.2 Det reelle gjenstående arbeidet

**A. Rydde opp lokal (lav prioritet hvis lokal ikke er aktivt utviklingsmiljø)**

Lokal DB er 26 migreringer bak kildekoden. Valg:
1. Re-seed fra dump av test (raskest, gir ferskt skjema)
2. Installer pgvector lokalt og kjør alle migreringer (riktig på lang sikt, men `navnegjennomgang` og senere migreringer vil ALLEREDE feile fordi de antar mellomtilstander som ikke finnes lokalt)
3. La lokal forbli ubrukt — utvikling skjer kun mot test

**B. Fjern `@@map`-direktiver fra Prisma-modellene** — skjema-rensing, ikke DB-DDL

Modellene `Faggruppe`, `FaggruppeKobling`, `GroupFaggruppe`, `Byggeplass` har fortsatt `@@map`-direktiver fordi de tidligere brukte dette for å mappe til gamle tabellnavn. Etter rename matcher fysiske tabellnavn modellnavn delvis, men ikke alle:
- `Faggruppe` → `dokumentflyt_parts` (Prisma-modellen heter Faggruppe, fysisk tabell `dokumentflyt_parts` — `@@map` er fortsatt nødvendig her, **kan ikke fjernes**)
- `FaggruppeKobling` → `dokumentflyt_koblinger` (samme — `@@map` nødvendig)
- `GroupFaggruppe` → `group_faggrupper` (`@@map` nødvendig)
- `Byggeplass` → `byggeplasser` (`@@map` nødvendig)

**Korrigerer min tidligere antagelse:** `@@map` kan IKKE fjernes, fordi tabellnavnene er på snake_case norsk mens Prisma-modellnavnene er PascalCase. Det er konvensjonen i dette prosjektet (samme som `Project` → `projects`, `User` → `users`). Selve scope-spørsmålet faller bort her.

**C. Avklar 3 utestående detaljer (ned fra 4 — U.4 avklart, se § 4.10):**

1. **`project_groups.building_ids` (jsonb)** — IKKE renamed på noen miljø. Skal den renames til `byggeplass_ids`? Eller bevisst beholdt fordi det er et JSON-felt (rename krever data-omskriving som er forskjellig fra tabell/kolonne-rename)?
2. **FK-constraint-navn** — fortsatt navngitt som `*_enterprise_id_fkey` etc. på begge servere. Funksjonelt OK, men inkonsistent. Ren navngivning. Skal de renames?
3. **`fiks_rolle_utforer` failed-rad på test** — bør ryddes med `prisma migrate resolve` eller bekreftes som artefakt

### 6.3 Det opprinnelige problemet (slik det er beskrevet i CLAUDE.md og db-opprydning.md) er foreldet

`CLAUDE.md` sier: *«fysiske DB-tabeller heter fortsatt `enterprises`, `member_enterprises`, `group_enterprises`»* — dette stemmer på lokal, men IKKE på test eller prod.

`db-opprydning.md` § «Prioritet 1.1» sier: *«Prisma-modellene er renamed til Faggruppe... men fysiske DB-tabeller heter fortsatt enterprises»* — samme korreksjon: dette er kun sant på lokal.

**Anbefaling:** Oppdater `CLAUDE.md` og `db-opprydning.md` til å reflektere faktisk state.

---

## 7. Forslag til neste steg

**Diskuter med Kenneth:**

1. Skal lokal DB re-seedes fra test-dump, eller forblir lokal urørt? (Påvirker om vi trenger å installere pgvector lokalt og fikse migreringskjeden.)
2. Skal `project_groups.building_ids` renames? Hvis ja: i hvilken migrering?
3. Skal FK-constraint-navnene renames for konsistens?
4. Skal `CLAUDE.md` og `db-opprydning.md` oppdateres for å reflektere at hovedjobben er gjort, eller er det andre punkter i `db-opprydning.md` som fortsatt er aktuelle (CHECK constraint på `dokumentflyt_medlemmer` — Prioritet 1.2)?

**Avgrensningen i [db-opprydning.md](db-opprydning.md) gjelder fortsatt:** Snapshot-felt og tRPC-alias forblir uendret i denne fasen.

---

## Vedlegg — kommandoer brukt

**Lokal:**
```bash
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
psql -d sitedoc -f /tmp/audit.sql
```

**Test og prod (via SSH):**
```bash
ssh sitedoc 'cat > /tmp/audit.sql' < <audit-script>
ssh sitedoc 'psql -d sitedoc_test -f /tmp/audit.sql; psql -d sitedoc -f /tmp/audit.sql'
```

Audit-SQL er identisk for alle tre miljøer. Full SQL-tekst lagret i sesjonens tool-result-fil.
