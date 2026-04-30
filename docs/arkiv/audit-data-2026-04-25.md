# Datamodell-audit — dev-DB (sitedoc, lokal)

**Dato:** 2026-04-25
**Database:** `sitedoc` på `localhost:5432` (utviklingsmiljø)
**Metode:** Read-only SELECT-spørringer + Prisma-skjema-parsing
**Endringer i kode/schema:** Ingen

## Datasett-størrelse

Veldig lite. Strukturelle funn er gyldige, kvantitative trender er ikke statistisk meningsfulle.

| Tabell | Antall rader |
|---|---|
| `users` | 3 |
| `organizations` | 1 |
| `projects` | 1 (standalone — ikke i `organization_projects`) |
| `report_templates` | 2 |
| `checklists` / `tasks` | 1 / 1 |
| `enterprises` (faggrupper) | 3 |
| `project_groups` | 4 |
| `project_group_members` | 2 |
| `member_enterprises` (FaggruppeKobling) | 2 |
| `group_enterprises` (GroupFaggruppe) | 0 |
| `folders` | 3 |
| `folder_access` | 0 |
| `dokumentflyter` | 3 |
| `dokumentflyt_medlemmer` | 3 |
| `dokumentflyt_maler` | 4 |
| `kontrollplan_punkter` | 0 |

**NB:** DB-tabellnavn bruker fortsatt `enterprise*` (ikke renamed til `faggruppe*` på fysisk nivå). Prisma har `@@map` som dekker dette, men rå SQL må bruke gamle navn.

## Analyse 1 — Schema-konsistens FK cascade

### `organizationId`-relasjoner (3 modeller)

| Modell | FK | onDelete |
|---|---|---|
| `User` | `organizationId` | **SetNull** |
| `OrganizationIntegration` | `organizationId` | Cascade |
| `OrganizationProject` | `organizationId` | Cascade |

**Avvik:** `User.organizationId` er SetNull mens andre er Cascade. Dette er forsvarlig — bruker skal bevares når firma slettes. Ingen handling nødvendig.

### `projectId`-relasjoner (23 modeller)

Alle 23 har `onDelete: Cascade`. Inkluderer: `OrganizationProject`, `ProjectMember`, `FaggruppeKobling`, `ProjectGroup`, `ProjectGroupMember`, `ProjectInvitation`, `Faggruppe`, `Drawing`, `PointCloud`, `Byggeplass`, `Omrade`, `ReportTemplate`, `Folder`, `Dokumentflyt`, `DokumentflytMedlem`, `ProjectModule`, `FtdDocument`, `FtdKontrakt`, `FtdChangeEvent`, `FtdSpecPost`, `FtdNotaPeriod`, `Psi`, `Kontrollplan`.

**Konsistent.** Når et prosjekt slettes, ryddes alt avhengig data automatisk.

## Analyse 2 — Orphan-deteksjon

| Sjekk | Funn |
|---|---|
| `ReportTemplate` med ikke-eksisterende `project_id` | 0 |
| `ReportTemplate` på arkivert prosjekt (`status='archived'`) | 0 |
| `FolderAccess` med ikke-eksisterende `user_id` | 0 |
| `FolderAccess` med ikke-eksisterende `group_id` | 0 |
| `FolderAccess` med ikke-eksisterende `enterprise_id` | 0 |
| `DokumentflytMedlem` med MER ENN ÉN av (enterprise_id, group_id, project_member_id) | **0** |
| `DokumentflytMedlem` total fordeling | 3 totalt — alle har kun `enterprise_id` (faggruppe) |

**Tolkning:**
- Ingen orphans — FK-cascade fungerer som forventet
- **Hull 2 (Group vs Faggruppe i samme rad) er teoretisk, ikke reelt** i nåværende data. Det er trygt å innføre constraint som forbyr multiple FK satt samtidig

## Analyse 3 — Multi-firma-brukere

| Sjekk | Funn |
|---|---|
| Brukere på prosjekter eid av ulike Organizations | 0 |
| Total `project_members` | 3 |
| Prosjekter koblet til Organization (`organization_projects`) | 0 |
| Standalone prosjekter | 1 |
| Brukere med `User.organizationId` satt | 1 av 3 |

**Tolkning:**
- **Datasettet kan ikke teste multi-firma-scenarioet** — eneste prosjekt er standalone
- 1 av 3 brukere har firma-tilknytning. To brukere har ingen organizationId. Sannsynligvis test-/demo-brukere
- Strukturelt er det fortsatt mulig at en bruker kan bli ProjectMember på prosjekter eid av flere firmaer — designet tillater det. Må avklares som regel før produksjonsbruk

## Analyse 4 — Mal-bruks-distribusjon

| Sjekk | Funn |
|---|---|
| `ReportTemplate` per Organization | `<standalone>=2` (begge på prosjekt uten organisasjon) |
| `ReportTemplate.id` brukt av BÅDE `KontrollplanPunkt` OG `DokumentflytMal` | **0** |
| Distinkte `ReportTemplate` brukt av Kontrollplan | 0 |
| Distinkte `ReportTemplate` brukt av Dokumentflyt | 2 (alle) |
| `dokumentflyt_maler` total | 4 (multiple flytdefinisjoner per mal) |
| Histogram instanser per mal | 2 maler × 1 instans = `1x=2` |

**Tolkning:**
- **Hull 3 (delt mal-bruk Kontrollplan + Dokumentflyt) er teoretisk, ikke reelt** i nåværende data
- Ingen kontrollplan-data finnes i dev-DB — gjør at vi ikke kan se kollisjons-risiko mellom Kontrollplan og Dokumentflyt på samme mal
- Begge maler er aktive Dokumentflyt-mottakere
- Strukturelt fortsatt mulig å havne i delt-bruk-tilstand. Constraint kunne legges til, men data viser at dette ikke har skjedd ennå

## Analyse 5 — FolderAccess konfliktdeteksjon

| Sjekk | Funn |
|---|---|
| Total `folder_access` | **0 rader** |
| Bruker med direkte access OG group-access (motsatt access_type) | 0 (n/a) |
| Bruker med direkte og via gruppe (overlapping) | 0 (n/a) |

**Tolkning:**
- **Hull 5 (FolderAccess prioritet) er ikke testbart** — ingen folder_access-rader i dev-data
- 3 mapper finnes uten access-konfigurasjon. Sannsynligvis bruker eksisterende kode default-tilgang basert på prosjektmedlemskap
- Strukturelt fortsatt potensielt sikkerhetshull. Når funksjonen begynner å brukes må prioritetsregel være klar FØR data legges inn

## Sammendrag — hvilke hull er reelle vs. teoretiske

| Hull | Status i data | Anbefaling |
|---|---|---|
| 1 — ProjectGroup nivå | Teoretisk | Diskuter design før timer/mannskap-modul bygges |
| 2 — DokumentflytMedlem multiple FK | **Teoretisk (0/3 rader)** | Trygt å legge til CHECK constraint nå |
| 3 — Delt mal Kontrollplan+Dokumentflyt | **Teoretisk (0/2 maler)** | Diskuter regel før mal-promotering implementeres |
| 4 — Tilgangskontroll firma-mal | Ikke relevant ennå | Avklares når OrganizationTemplate bygges |
| 5 — FolderAccess prioritet | **Ikke testbart (0 rader)** | Avklare regel FØR funksjon tas i bruk |
| 10 — `Faggruppe.partnerId` | Bekreftet ikke implementert | Legges til i ny Prisma-migrering |

## Tilleggsfunn

1. **DB-tabellnavn er ikke renamed.** Faggruppe-rename ble gjort på Prisma-modell-nivå (`@@map`), men fysisk i DB heter tabellene fortsatt `enterprises`, `member_enterprises`, `group_enterprises`, og kolonner heter `enterprise_id`. Migrering for å rename på fysisk nivå er ennå ikke gjort. Dette påvirker ikke kode (Prisma håndterer det), men kan forvirre direkte SQL-tilgang og dump/restore.

2. **Eneste prosjekt er standalone.** Dev-DB representerer ikke firma-koblet prosjekt-scenario. Multi-firma-tester må gjøres mot test-server (`sitedoc_test`) eller ny seed.

3. **`group_enterprises` er tomt** (0 rader). `GroupFaggruppe`-modellen er bygget, men ikke i bruk i dev-data. Funksjonen «begrens gruppe til spesifikke faggrupper» er ikke testet med data.

## Spørsmål som ikke kan besvares av denne audit

- Vil hull 1, 3, 5 oppstå i produksjons-data? (Krever audit mot `sitedoc` på server — KUN read-only, og kun med tillatelse)
- Hvor mange firmaer i prod har multi-prosjekt-brukere?
- Hvor mange ReportTemplates i prod brukes av både Kontrollplan og Dokumentflyt?

Disse besvares enten ved å kjøre samme audit mot prod (krever eksplisitt godkjenning), eller venter til vi har realistisk seed.
