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
| `project_members` | Prosjektmedlemmer med rolle (member/admin), `erFirmaansvarlig` (Boolean, per prosjekt), faggrupper via `dokumentflyt_koblinger` |
| `dokumentflyt_koblinger` | Mange-til-mange join-tabell mellom `project_members` og `dokumentflyt_parts` (tidl. `member_enterprises`) |
| `dokumentflyt_parts` | Faggrupper i prosjektet (tidl. `enterprises`): Byggherre, Tømrer, Elektro. Med `enterprise_number`, bransje, firma, farge |
| `byggeplasser` | Lokasjoner med `number` (auto-generert per prosjekt), `type` (deprecated, default `"bygg"`), status (unpublished/published) |
| `drawings` | Tegninger med metadata: tegningsnummer, fagdisiplin, revisjon, status, etasje, målestokk, opphav, valgfri `geoReference` (JSON), `ifcMetadata` (JSON — prosjekt, org, GPS, etasjer, programvare), `gpsOverride` (JSON — manuell GPS/kalibrering for IFC med valgfri similarity-transform), DWG-konvertering (`conversionStatus`, `coordinateSystem`) |
| `point_clouds` | Punktskyer med `potreeUrl` (konvertert octree), `hasClassification`, `hasRgb`, `classifications` (JSON), `boundingBox` (JSON), asynkron konvertering via CloudCompare+PotreeConverter |
| `drawing_revisions` | Revisjonshistorikk for tegninger med fil, status og hvem som lastet opp |
| `report_templates` | Maler med category (oppgave/sjekkliste), prefix, versjon, `domain` (bygg/hms/kvalitet, default "bygg"), `subjects` (JSON-array), `enable_change_log` (Boolean, default false) |
| `report_objects` | Rapportobjekter i maler (27 typer inkl. PSI: info_text, info_image, video, quiz), rekursiv nesting via `parent_id` |
| `checklists` | Sjekklister med bestiller/utfører-entreprise, status, data (JSON), `lest_av_mottaker_ved` (DateTime, settes når mottaker åpner) |
| `tasks` | Oppgaver med påkrevd mal (`template_id`), prefiks+løpenummer (`number`), prioritet, frist, bestiller/utfører (nullable for HMS), utfylt data (`data` JSON), valgfri tegningsposisjon og sjekkliste-kobling, `lest_av_mottaker_ved` (DateTime, settes når mottaker åpner) |
| `document_transfers` | Sporbarhet: all sending mellom entrepriser |
| `images` | Bilder med valgfri GPS-data |
| `folders` | Rekursiv mappestruktur med parent_id, `access_mode` (inherit/custom), valgfri `kontrakt_id` (kobler mappe til økonomi-kontrakt → blått ikon) |
| `folder_access` | Tilgangsoppføringer per mappe: entreprise, gruppe eller bruker |
| `documents` | Dokumenter i mapper med fil-URL og versjon |
| `workflows` | (Deprecated — erstattet av Dokumentflyt) Gammel arbeidsforløp-tabell, beholdt for bakoverkompatibilitet |
| `workflow_templates` | (Deprecated) Kobling mellom arbeidsforløp og maler |
| `workflow_step_members` | (Deprecated) Personbaserte steg-medlemmer i arbeidsforløp |
| `dokumentflyter` | Dokumentflyt per prosjekt. `enterpriseId` (peker til `dokumentflyt_parts`), `roller` (JSONB — tilpassbare labels per rolle: `{ registrator?: { label }, bestiller?: { label }, utforer?: { label }, godkjenner?: { label } }`) |
| `dokumentflyt_medlemmer` | Medlemmer i dokumentflyt-steg. `rolle`, `steg`, `enterpriseId` (peker til `dokumentflyt_parts`)/`projectMemberId`/`groupId`, `erHovedansvarlig` (Boolean), `hovedansvarligPersonId` |
| `dokumentflyt_maler` | Maltilknytning per dokumentflyt |
| `task_comments` | Kommentarer/dialog på oppgaver |
| `checklist_change_log` | Automatisk endringslogg for sjekklister |
| `project_invitations` | E-postinvitasjoner med token, status, utløpsdato |
| `group_enterprises` | Mange-til-mange mellom `project_groups` og `dokumentflyt_parts` (tabellnavn uendret) |
| `project_modules` | Aktiverte moduler per prosjekt |
| `psi` | Prosjektspesifikk Sikkerhetsinstruks. Én per prosjekt+bygning (buildingId valgfri). Peker til ReportTemplate, versjonering for ny signering, `guestMessage` (HTML-tekst vist til gjester ved QR-tilgang), soft delete via `deactivatedAt`. category = "psi" (ikke "sjekkliste"). API: 15 endepunkter inkl. deaktiver/reaktiver, kopier (deep copy mal til annen bygning), hentForProsjektPublic, oppdaterGjesteBeskjed |
| `psi_signaturer` | Personlig PSI-gjennomføring. Innlogget bruker (userId) ELLER gjest (guestName/guestCompany/guestPhone). Progresjon, quiz-data, signatur (base64), completedAt, `hmsKortNr` (String? — HMS-kortnummer), `harIkkeHmsKort` (Boolean, default false — avkrysning "Har ikke HMS-kort"). Unique: (psiId, userId) |
| `organizations` | Firmaer/organisasjoner med navn, org.nr, fakturaadresse, logo |
| `organization_projects` | Mange-til-mange mellom organisasjoner og prosjekter |
| `organization_integrations` | Integrasjoner per organisasjon: type (proadm/hr/gps/smartdoc), url, apiKey (kryptert), config (JSON), aktiv. Unik per (orgId, type) |
| `ftd_kontrakter` | Overliggende kontrakt: Byggherre → Entreprenør. Felter: navn, kontraktType (8405/8406/8407), byggherre, entreprenor, byggeplassId (valgfri), hmsSamordningsgruppe. Entrepriser og dokumenter kobles via kontraktId |
| `ftd_documents` | Eneste dokumentmodell. Filinfo, docType, processingState, kontraktId, notaType, notaNr. Header-verdier fra A-nota: utfortPr, utfortTotalt, utfortForrige, utfortDenne, innestaaende, innestaaendeForrige, innestaaendeDenne, nettoDenne, mva, sumInkMva. Mapper → auto scanning. Økonomi → manuell import |
| `ftd_document_pages` | Side→postnr mapping for dokumentasjon per post. Regex: POST XX.YY.ZZ. Arv fra forrige side. Unique constraint (documentId, pageNumber) |
| `ftd_document_chunks` | Søkbare tekstbiter med tsvector (norsk stemming, GIN), NS-koder, sideinfo, `embedding_vector` (pgvector 768 dim, NorBERT), `embeddingState` (pending/processing/done). OCR-fallback (pdftoppm+tesseract), OCR-rensing (CamelCase-splitting, søppelfilter). HNSW-indeks for vektor-søk |
| `ftd_document_blocks` | Blokkbasert dokumentinnhold for flerspråklig visning. Typer: heading/text/image/caption/table. Felter: language, sourceBlockId (peker til norsk original), headingLevel, imageUrl, embedding_vector (multilingual-e5-base 768 dim). Indeks: (documentId, language, sortOrder) |
| `ftd_translation_jobs` | Asynkron oversettelseskø. Status: pending/processing/done/failed. Fremdrift: blocksDone/blocksTotal. Unique constraint: (documentId, targetLang) |
| `translation_cache` | Translation memory — SHA-256 hash av kildetekst → oversatt tekst. Unngår re-oversettelse av identisk innhold. Unique: (contentHash, sourceLang, targetLang) |
| `ai_sok_innstillinger` | AI-søk konfigurasjon per prosjekt: embedding_provider (local/openai), embedding_model, API-nøkler, LLM-provider, søkevekter (JSONB). Én rad per prosjekt |
| `ftd_spec_posts` | NS 3420 budsjettlinjer fra PDF/Excel/XML/GAB. Postnr, beskrivelse, enhet, mengde, pris, sum, NS-kode, fullNsTekst, mengdeDenne, mengdeTotal, verdiDenne, verdiTotal, prosentFerdig (Decimal — sammenligningsfelter for A-nota/perioder), importNotat (String? — notat fra import, f.eks. mengde-avvik). Seksjonsoverskrifter lagres som poster (erOverskrift). Sub-postnr fra prislinjer, postnr-tail merging, auto-dedup. Migrering: `20260330180000_legg_til_import_notat` |
| `ftd_nota_periods` | A-nota/T-nota perioder per entreprise |
| `ftd_nota_posts` | Poster per periode med mengde/verdi denne, forrige, total |
| `ftd_nota_comments` | Kommentarer på spesifikasjonsposter og perioder |

## Viktige relasjoner

- `dokumentflyt_koblinger` er mange-til-mange: en bruker kan tilhøre flere faggrupper i samme prosjekt via `DokumentflytKobling(projectMemberId, enterpriseId)`
- Sjekklister og oppgaver har ALLTID `bestiller_enterprise_id` (bestiller) og `utforer_enterprise_id` (utfører) — kolonnenavn beholdt for bakoverkompatibilitet
- `document_transfers` logger all sending mellom faggrupper med full sporbarhet
- Bilder har valgfri GPS-data (`gps_lat`, `gps_lng`, `gps_enabled`)
- Oppgaver kan kobles til tegning med posisjon (`drawing_id`, `position_x`, `position_y`)
- `workflows` (deprecated) — erstattet av Dokumentflyt. Tabellen beholdes for bakoverkompatibilitet
- `report_objects` bruker selvrefererande relasjon (`parent_id`) for rekursiv nesting — CASCADE-sletting av barn
- `report_templates` har `category` (`oppgave` | `sjekkliste`), valgfritt `prefix` og valgfri `subjects` (forhåndsdefinerte emnetekster)
- `byggeplasser` tilhører prosjekt, tegninger koblet via `building_id`. `type`-feltet er deprecated
- `drawings` har full metadata med `drawing_revisions` for historikk. Valgfri `geoReference` (JSON) med 2 referansepunkter
- `folders` bruker selvrefererande relasjon for mappetreet. `accessMode`: `"inherit"` eller `"custom"`
- `folder_access` kobler mapper til faggrupper/grupper/brukere via `accessType`
- `projects` har valgfri `latitude`/`longitude` for kartvisning og værhenting
- `project_groups` har `domains` (JSON-array) og `groupDokumentflytParts` for faggruppe-begrenset tilgang
- `group_enterprises` er mange-til-mange med unikt constraint `[groupId, enterpriseId]`

## Tilgangskontroll

Hjelpemodul i `apps/api/src/trpc/tilgangskontroll.ts`:

| Funksjon | Beskrivelse |
|----------|-------------|
| `hentBrukerEntrepriseIder(userId, projectId)` | Returnerer `string[]` eller `null` (admin) |
| `byggTilgangsFilter(userId, projectId)` | Prisma WHERE-filter, `null` for admin |
| `verifiserEntrepriseTilhorighet(userId, enterpriseId)` | FORBIDDEN hvis ikke tilhører (admin-bypass) |
| `verifiserAdmin(userId, projectId)` | FORBIDDEN hvis ikke admin. company_admin med riktig org arver admin uten ProjectMember-rad |
| `verifiserAdminEllerFirmaansvarlig(userId, projectId)` | Returnerer `{ erAdmin: boolean }`. Admin → true, firmaansvarlig → false. Vanlig member → FORBIDDEN. Brukes for invitasjoner |
| `verifiserProsjektmedlem(userId, projectId)` | FORBIDDEN hvis ikke medlem. company_admin med riktig org arver tilgang uten ProjectMember-rad |
| `verifiserOrganisasjonTilgang(userId, organisationId)` | FORBIDDEN hvis bruker ikke tilhører organisasjonen. company_admin uten organizationId = ugyldig |
| `verifiserDokumentTilgang(userId, projectId, bestillerId, utforerId, domain?)` | Faggruppe + fagområde-tilgang. bestillerId/utforerId nullable for HMS |
| `hentBrukerTillatelser(userId, projectId)` | `Permission`-set fra grupper. Admin har alle |
| `verifiserTillatelse(userId, projectId, permission)` | FORBIDDEN hvis mangler |
| `verifiserFlytRolle(...)` | Sjekker flytrolle for statusovergang (403 ved mismatch) |

**Tilgangslogikk for dokumentvisning:**
- Admin ser alltid alt
- company_admin ser alt i alle prosjekter tilknyttet sin organisasjon (uten ProjectMember-rad)
- Direkte faggruppe-tilgang: bruker ser dokumenter der egen faggruppe er bestiller/utfører
- Fagområde-tilgang via grupper:
  - Gruppe uten faggrupper → tverrgående: ser ALLE dokumenter med matchende domain
  - Gruppe med faggrupper → faggruppe-begrenset: kun matchende domain OG faggruppe
- Samlet: union av gruppers tilganger + direkte DokumentflytKobling-tilgang

**Rettighetsbasert redigering (per dokument):**
- `utledDokumentRettighet()` i `@sitedoc/shared` → `"admin"` / `"redigerer"` / `"leser"`
- Admin/registrator → alltid admin. Terminal status → alltid leser.
- Har ballen + `DokumentflytMedlem.kanRedigere = true` + edit-tillatelse → redigerer
- `kanRedigere` settes per flytmedlem i dokumentflyt-oppsettet (toggle i UI)
- Fallback: brukere uten grupper (`tillatelser.size === 0`) får redigering hvis de har ballen

**UI-tilgangskontroll (web):**
- `gruppe.hentMineTillatelser` eksponerer tillatelser til klienten
- `gruppe.hentMinFlytInfo` returnerer `userId`, `projectMemberId`, `entrepriseIder`, `gruppeIder`, `erAdmin`
- `HovedSidebar` — Maler-ikonet skjules uten `manage_field`
- `OppsettLayout` — Produksjon-seksjonen skjules uten `manage_field`
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

## Ytelsesindekser

8 dedikerte indekser for ytelse:
- `checklists`: `(project_id, status)`, `(project_id, dokumentflyt_id)`
- `tasks`: `(project_id, status)`, `(project_id, dokumentflyt_id)`
- `document_transfers`: `(project_id, sender_id)`, `(project_id, recipient_user_id)`
- `dokumentflyt_medlemmer`: `(dokumentflyt_id, rolle)`
- `project_members`: `(project_id, er_firmaansvarlig)`
