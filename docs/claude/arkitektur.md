# Arkitektur — Database og tilgangskontroll

## Database (PostgreSQL)

23+ tabeller. Kjernetabeller:

| Tabell | Beskrivelse |
|--------|-------------|
| `users` | Brukere med Auth.js-felter (email, name, image, role), valgfri `organizationId`. Role: `user` (default), `company_admin` (firmaadmin), `sitedoc_admin` (superadmin) |
| `accounts` | OAuth-tilkoblinger (Google, Microsoft Entra ID) |
| `sessions` | Database-sesjoner for Auth.js |
| `verification_tokens` | E-postverifiseringstokens |
| `projects` | Prosjekter med prosjektnummer (SD-YYYYMMDD-XXXX), status, valgfri lokasjon (`latitude`, `longitude`), valgfritt eksternt prosjektnummer (`external_project_number`), valgfri firmalogo (`logo_url`), `show_internal_project_number` (Boolean, default true) |
| `project_members` | Prosjektmedlemmer med rolle (member/admin), entrepriser via `member_enterprises` |
| `member_enterprises` | Mange-til-mange join-tabell mellom `project_members` og `enterprises` |
| `enterprises` | Entrepriser med `enterprise_number` (format: "04 Tømrer, Econor"), bransje, firma, farge |
| `buildings` | Lokasjoner med `number` (auto-generert per prosjekt), `type` (deprecated, default `"bygg"`), status (unpublished/published) |
| `drawings` | Tegninger med metadata: tegningsnummer, fagdisiplin, revisjon, status, etasje, målestokk, opphav, valgfri `geoReference` (JSON), `ifcMetadata` (JSON — prosjekt, org, GPS, etasjer, programvare), DWG-konvertering (`conversionStatus`, `coordinateSystem`) |
| `point_clouds` | Punktskyer med `potreeUrl` (konvertert octree), `hasClassification`, `hasRgb`, `classifications` (JSON), `boundingBox` (JSON), asynkron konvertering via CloudCompare+PotreeConverter |
| `drawing_revisions` | Revisjonshistorikk for tegninger med fil, status og hvem som lastet opp |
| `report_templates` | Maler med category (oppgave/sjekkliste), prefix, versjon, `domain` (bygg/hms/kvalitet, default "bygg"), `subjects` (JSON-array), `enable_change_log` (Boolean, default false) |
| `report_objects` | Rapportobjekter i maler (23 typer, JSON-konfig), rekursiv nesting via `parent_id` |
| `checklists` | Sjekklister med oppretter/svarer-entreprise, status, data (JSON) |
| `tasks` | Oppgaver med påkrevd mal (`template_id`), prefiks+løpenummer (`number`), prioritet, frist, oppretter/svarer, utfylt data (`data` JSON), valgfri tegningsposisjon og sjekkliste-kobling |
| `document_transfers` | Sporbarhet: all sending mellom entrepriser |
| `images` | Bilder med valgfri GPS-data |
| `folders` | Rekursiv mappestruktur med parent_id, `access_mode` (inherit/custom) |
| `folder_access` | Tilgangsoppføringer per mappe: entreprise, gruppe eller bruker |
| `documents` | Dokumenter i mapper med fil-URL og versjon |
| `workflows` | Arbeidsforløp med oppretter-entreprise og opptil 3 svarer-entrepriser |
| `workflow_templates` | Kobling mellom arbeidsforløp og maler (mange-til-mange) |
| `workflow_step_members` | Personbaserte steg-medlemmer i arbeidsforløp (Svarer 2/3) |
| `task_comments` | Kommentarer/dialog på oppgaver |
| `checklist_change_log` | Automatisk endringslogg for sjekklister |
| `project_invitations` | E-postinvitasjoner med token, status, utløpsdato |
| `group_enterprises` | Mange-til-mange mellom `project_groups` og `enterprises` |
| `project_modules` | Aktiverte moduler per prosjekt |
| `organizations` | Firmaer/organisasjoner med navn, org.nr, fakturaadresse, logo |
| `organization_projects` | Mange-til-mange mellom organisasjoner og prosjekter |
| `ftd_documents` | Eneste dokumentmodell (Document er fjernet). Filinfo, docType, processingState (pending/processing/completed/failed), kobles til `folders`. Opplasting → automatisk prosessering |
| `ftd_document_chunks` | Søkbare tekstbiter med tsvector-indeks (norsk stemming, GIN), NS-koder, sideinfo. Trigger auto-oppdaterer search_vector |
| `ftd_spec_posts` | FTD-modul: budsjettlinjer/spesifikasjonsposter med mengde, enhetspris, NS-kode |
| `ftd_nota_periods` | FTD-modul: A-nota/T-nota perioder per entreprise |
| `ftd_nota_posts` | FTD-modul: poster per periode med mengde/verdi denne, forrige, total |
| `ftd_nota_comments` | FTD-modul: kommentarer på spesifikasjonsposter og perioder |

## Viktige relasjoner

- `member_enterprises` er mange-til-mange: en bruker kan tilhøre flere entrepriser i samme prosjekt via `MemberEnterprise(projectMemberId, enterpriseId)`
- Sjekklister og oppgaver har ALLTID `creator_enterprise_id` (oppretter) og `responder_enterprise_id` (svarer)
- `document_transfers` logger all sending mellom entrepriser med full sporbarhet
- Bilder har valgfri GPS-data (`gps_lat`, `gps_lng`, `gps_enabled`)
- Oppgaver kan kobles til tegning med posisjon (`drawing_id`, `position_x`, `position_y`)
- `workflows` tilhører oppretter-entreprise med valgfri svarer-entreprise. Svarer 2/3 er personbasert via `workflow_step_members`
- `report_objects` bruker selvrefererande relasjon (`parent_id`) for rekursiv nesting — CASCADE-sletting av barn
- `report_templates` har `category` (`oppgave` | `sjekkliste`), valgfritt `prefix` og valgfri `subjects` (forhåndsdefinerte emnetekster)
- `buildings` tilhører prosjekt, tegninger koblet via `building_id`. `type`-feltet er deprecated
- `drawings` har full metadata med `drawing_revisions` for historikk. Valgfri `geoReference` (JSON) med 2 referansepunkter
- `folders` bruker selvrefererande relasjon for mappetreet. `accessMode`: `"inherit"` eller `"custom"`
- `folder_access` kobler mapper til entrepriser/grupper/brukere via `accessType`
- `projects` har valgfri `latitude`/`longitude` for kartvisning og værhenting
- `project_groups` har `domains` (JSON-array) og `groupEnterprises` for entreprise-begrenset tilgang
- `group_enterprises` er mange-til-mange med unikt constraint `[groupId, enterpriseId]`

## Tilgangskontroll

Hjelpemodul i `apps/api/src/trpc/tilgangskontroll.ts`:

| Funksjon | Beskrivelse |
|----------|-------------|
| `hentBrukerEntrepriseIder(userId, projectId)` | Returnerer `string[]` eller `null` (admin) |
| `byggTilgangsFilter(userId, projectId)` | Prisma WHERE-filter, `null` for admin |
| `verifiserEntrepriseTilhorighet(userId, enterpriseId)` | FORBIDDEN hvis ikke tilhører (admin-bypass) |
| `verifiserAdmin(userId, projectId)` | FORBIDDEN hvis ikke admin |
| `verifiserProsjektmedlem(userId, projectId)` | FORBIDDEN hvis ikke medlem |
| `verifiserDokumentTilgang(userId, projectId, creatorId, responderId, domain?)` | Entreprise + fagområde-tilgang |
| `hentBrukerTillatelser(userId, projectId)` | `Permission`-set fra grupper. Admin har alle |
| `verifiserTillatelse(userId, projectId, permission)` | FORBIDDEN hvis mangler |

**Tilgangslogikk for dokumentvisning:**
- Admin ser alltid alt
- Direkte entreprise-tilgang: bruker ser dokumenter der egen entreprise er oppretter/svarer
- Fagområde-tilgang via grupper:
  - Gruppe uten entrepriser → tverrgående: ser ALLE dokumenter med matchende domain
  - Gruppe med entrepriser → entreprise-begrenset: kun matchende domain OG entreprise
- Samlet: union av gruppers tilganger + direkte MemberEnterprise-tilgang

**UI-tilgangskontroll (web):**
- `gruppe.hentMineTillatelser` eksponerer tillatelser til klienten
- `HovedSidebar` — Maler-ikonet skjules uten `manage_field`
- `OppsettLayout` — Field-seksjonen skjules uten `manage_field`
- Mønster: `tillatelse?: Permission` på nav-element-interfaces

## Fagområder (domain)

Maler har `domain` (`"bygg"` | `"hms"` | `"kvalitet"`, default `"bygg"`). Grupper har `domains` og valgfri entreprise-tilknytning.

**Konsept:** HMS-gruppen (domains=["hms"], ingen entrepriser) ser ALLE HMS-dokumenter tverrgående. Bygg-grupper med entrepriser ser kun egne entreprisers bygg-dokumenter.

**Tillatelsestyper:** Gamle: `manage_field`, `create_tasks`, `create_checklists`, `view_field`. Nye granulære: `checklist_edit/view`, `task_edit/view`, `template_manage`, `drawing_manage/view`, `folder_manage/view`, `enterprise_manage`, `member_manage`. `utvidTillatelser()` mapper gamle → nye.

**Global tillatelsesstyring:** Tillatelser per gruppe-mal er globale — kun SiteDoc-admin kan endre. Prosjektadmin kan kun tilordne brukere til grupper.

## Statusoverganger

Valideres via `isValidStatusTransition()` fra `@sitedoc/shared`:
```
draft → sent → received → in_progress → responded → approved | rejected → closed
                                                      rejected → in_progress
draft / sent / received / in_progress → cancelled (irreversibel)
```

## Rapportobjekter (23 typer)

| Type | Kategori | Beskrivelse |
|------|----------|-------------|
| `heading` | tekst | Overskrift |
| `subtitle` | tekst | Undertittel |
| `text_field` | tekst | Tekstfelt |
| `list_single` | valg | Enkeltvalg (kontainer med betingelse) |
| `list_multi` | valg | Flervalg (kontainer med betingelse) |
| `integer` | tall | Heltall |
| `decimal` | tall | Desimaltall |
| `calculation` | tall | Beregning (formel) |
| `traffic_light` | valg | Trafikklys (4 farger: Godkjent, Anmerkning, Avvik, Ikke relevant) |
| `date` | dato | Dato |
| `date_time` | dato | Dato og tid |
| `person` | person | Enkeltperson |
| `persons` | person | Flere personer |
| `company` | person | Firma/entreprise |
| `attachments` | fil | Filvedlegg |
| `bim_property` | spesial | BIM-egenskap |
| `zone_property` | spesial | Sone-egenskap |
| `room_property` | spesial | Rom-egenskap |
| `weather` | spesial | Vær |
| `signature` | spesial | Signatur |
| `repeater` | spesial | Repeterende seksjon (dupliserbare rader) |
| `location` | spesial | Lokasjon (read-only kart) |
| `drawing_position` | spesial | Posisjon i tegning |

Metadata i `REPORT_OBJECT_TYPE_META`. Konfigurasjon lagres som JSON i `report_objects.config`.

**Rekursiv kontainer-nesting:**
- Kontainertyper: `list_single`, `list_multi`, `repeater` (`erKontainerType()`)
- Forelder-barn via `report_objects.parent_id` — ubegrenset nesting
- Betingelse: `conditionActive: true`, `conditionValues: string[]` i config
- Repeater aksepterer alltid barn uten betingelse

**Opsjon-normalisering:**
- Alternativer kan være strenger (`"Ja"`) eller objekter (`{value, label}`)
- `opsjonTilStreng()` (web) og `normaliserOpsjon()` (mobil)
