# SiteFlow

Rapport- og kvalitetsstyringssystem for byggeprosjekter. Flerplattform (PC, mobil, nettbrett) med offline-støtte, bildekomprimering, GPS-tagging og entreprisearbeidsflyt.

## Tech Stack

- **Monorepo:** Turborepo med pnpm workspaces
- **Frontend web:** Next.js 14+ (App Router), React, TypeScript
- **Frontend mobil:** React Native, Expo (SDK 54)
- **Backend API:** Node.js, Fastify, tRPC
- **Database (server):** PostgreSQL med Prisma ORM (v6.19)
- **Database (lokal):** SQLite via expo-sqlite, Drizzle ORM
- **Fillagring:** S3-kompatibel (AWS S3 / Cloudflare R2 / MinIO)
- **Auth:** Auth.js v5 (next-auth) med Google og Microsoft Entra ID (Office 365), PrismaAdapter, database-sesjoner, `allowDangerousEmailAccountLinking` for inviterte brukere
- **E-post:** Resend (invitasjons-e-poster ved brukeropprettelse)
- **Bildekomprimering:** expo-image-manipulator (5:4 senter-crop + mål: 300–400 KB)
- **GPS:** expo-location (deaktiverbar per objekt)
- **Sensorer:** expo-sensors (akselerometer for kamera-UI-rotasjon)
- **PDF-eksport:** react-pdf
- **Styling:** Tailwind CSS (web), NativeWind (mobil)
- **Drag-and-drop:** dnd-kit (malbygger på PC)
- **Kart:** Leaflet + react-leaflet (kartvelger i prosjektinnstillinger), OpenStreetMap tiles
- **Værdata:** Open-Meteo API (gratis, ingen API-nøkkel) for automatisk værhenting
- **Ikoner:** lucide-react

## Prosjektstruktur

```
siteflow/
├── apps/
│   ├── web/              # Next.js PC-applikasjon
│   │   └── src/
│   │       ├── app/
│   │       │   ├── page.tsx                  # Landingsside med innlogging
│   │       │   ├── logg-inn/                 # OAuth-innlogging (Google + Entra ID)
│   │       │   ├── registrer/                # Redirect til innlogging
│   │       │   ├── aksepter-invitasjon/      # Aksept av prosjektinvitasjon (Server Component)
│   │       │   ├── api/trpc/                 # tRPC API-rutehåndterer for Next.js
│   │       │   ├── providers.tsx             # TRPCProvider + SessionProvider
│   │       │   └── dashbord/
│   │       │       ├── layout.tsx            # Tre-kolonne layout (Toppbar + Sidebar + innhold)
│   │       │       ├── page.tsx              # Dashbord med prosjektliste
│   │       │       ├── [prosjektId]/         # Nytt prosjektspesifikt rutetré
│   │       │       │   ├── layout.tsx        # Verktøylinje-wrapper
│   │       │       │   ├── page.tsx          # Prosjektoversikt
│   │       │       │   ├── sjekklister/      # Sjekkliste-tabell + detalj (med layout + panel)
│   │       │       │   ├── oppgaver/         # Oppgave-tabell (med layout + panel)
│   │       │       │   ├── maler/            # Mal-liste + malbygger (med layout + panel)
│   │       │       │   ├── entrepriser/      # Entreprise-liste (med layout + panel)
│   │       │       │   ├── mapper/           # Mapper (mappestruktur med layout + panel)
│   │       │       │   └── tegninger/        # Tegninger (med layout + panel)
│   │       │       ├── oppsett/              # Innstillinger
│   │       │       │   ├── layout.tsx        # Innstillings-sidebar med navigasjon
│   │       │       │   ├── brukere/          # Brukergrupper, roller, legg til medlemmer
│   │       │       │   ├── lokasjoner/       # Samlet lokasjonsliste med redigering og georeferanse
│   │       │       │   ├── field/            # Field-innstillinger
│   │       │       │   │   ├── page.tsx      # Field-oversikt (kategorikort)
│   │       │       │   │   ├── entrepriser/  # Entrepriser med arbeidsforløp
│   │       │       │   │   ├── oppgavemaler/ # Oppgavemaler (filtrert malliste)
│   │       │       │   │   ├── sjekklistemaler/ # Sjekklistemaler (filtrert malliste)
│   │       │       │   │   ├── _components/  # Delt MalListe-komponent
│   │       │       │   │   ├── box/          # Mappeoppsett (filstruktur/dokumenthåndtering)
│   │       │       │   │   └── kontrollplaner/ # Kontrollplaner (kommer)
│   │       │       │   ├── prosjektoppsett/  # Prosjektoppsett (navn, status, adresse)
│   │       │       │   └── eierportal-brukere/ # Owners Portal brukere
│   │       │       └── prosjekter/           # LEGACY: Gamle flat-navigasjonsruter
│   │       │           ├── page.tsx          # Prosjektliste (gammel)
│   │       │           ├── nytt/             # Opprett prosjekt (gammel)
│   │       │           └── [id]/             # Prosjektdetalj med tabs (gammel)
│   │       ├── components/
│   │       │   ├── Toppmeny.tsx              # LEGACY: Gammel toppmeny
│   │       │   ├── RapportObjektVisning.tsx   # Read-only renderer for alle 23 rapportobjekttyper (print)
│   │       │   ├── GeoReferanseEditor.tsx    # Georeferanse-kalibrering med zoom/pan og koordinatparser (UTM33, DMS, desimal)
│   │       │   ├── layout/                   # Toppbar, HovedSidebar, SekundaertPanel, Verktoylinje, ProsjektVelger
│   │       │   └── paneler/                  # Seksjonspaneler (Dashbord, Sjekklister, Oppgaver, Maler, Entrepriser, Tegninger, Mapper)
│   │       ├── kontekst/                     # ProsjektKontekst, NavigasjonKontekst
│   │       ├── hooks/                        # useAktivSeksjon, useVerktoylinje
│   │       ├── lib/
│   │       │   └── trpc.ts                   # tRPC-klient med React-Query (httpBatchLink → /api/trpc)
│   │       └── auth.ts                       # Auth.js konfigurasjon
│   ├── mobile/           # Expo React Native app
│   │   └── src/
│   │       ├── db/                           # SQLite lokal database (Drizzle ORM)
│   │       │   ├── schema.ts                 # Drizzle-skjema (sjekkliste_feltdata, oppgave_feltdata, opplastings_ko)
│   │       │   ├── database.ts               # Singleton database-instans
│   │       │   ├── migreringer.ts            # Idempotent CREATE TABLE + indekser
│   │       │   └── opprydding.ts             # Rydd fullførte opplastinger og foreldreløse bilder
│   │       ├── providers/
│   │       │   ├── DatabaseProvider.tsx       # Kjører migreringer ved oppstart
│   │       │   ├── OpplastingsKoProvider.tsx  # Bakgrunnskø for filopplasting
│   │       │   └── NettverkProvider.tsx       # Nettverkstilstand (erPaaNettet)
│   │       └── services/
│   │           └── lokalBilde.ts             # Persistent lokal bildelagring
│   └── api/              # Fastify backend
│       └── src/
│           ├── routes/                       # tRPC-routere (se API-seksjonen)
│           │   └── health.ts                 # REST: GET /health
│           ├── services/
│           │   └── epost.ts                  # E-posttjeneste (Resend) for invitasjoner
│           └── trpc/
│               ├── trpc.ts                   # publicProcedure + protectedProcedure
│               ├── context.ts                # Auth-verifisering fra sesjonstokens
│               └── router.ts                 # Samler alle routere til appRouter
├── packages/
│   ├── shared/           # Delte typer, Zod-schemaer, utils
│   ├── db/               # Prisma schema, migreringer, seed
│   └── ui/               # 14 delte UI-komponenter
├── CLAUDE.md
├── turbo.json
└── package.json
```

## Kommandoer

- `pnpm dev` — Start alle apps i dev-modus
- `pnpm dev --filter web` — Kun web (port 3100)
- `pnpm dev --filter mobile` — Kun mobil (Expo, LAN-modus)
- `cd apps/mobile && npx expo start --tunnel --clear` — Mobil med tunnel (fungerer over 5G/annet nettverk). **Bruk alltid `--tunnel` for mobilutvikling** — LAN-modus krever at telefonen er på samme WiFi. Tunnel-modus gir en offentlig URL via ngrok som fungerer fra alle nettverk. QR-koden vises i terminalen — skann med Expo Go. Etter kodeendringer: rist telefonen → trykk "Reload"
- `pnpm dev --filter api` — Kun API
- `pnpm build` — Bygg alle apps
- `pnpm test` — Kjør alle tester
- `pnpm test --filter api` — Tester kun for API
- `pnpm lint` — Kjør ESLint på alle pakker
- `pnpm typecheck` — TypeScript typesjekk hele monorepo
- `pnpm db:migrate` — Kjør Prisma-migreringer (NB: bruk prosjektets Prisma, ikke global `npx prisma`)
- `pnpm db:seed` — Seed database med testdata
- `pnpm db:studio` — Åpne Prisma Studio

## Arkitektur

### Database (PostgreSQL)

21 tabeller totalt. Kjernetabeller:

| Tabell | Beskrivelse |
|--------|-------------|
| `users` | Brukere med Auth.js-felter (email, name, image, role) |
| `accounts` | OAuth-tilkoblinger (Google, Microsoft Entra ID) |
| `sessions` | Database-sesjoner for Auth.js |
| `verification_tokens` | E-postverifiseringstokens |
| `projects` | Prosjekter med prosjektnummer (SF-YYYYMMDD-XXXX), status, valgfri lokasjon (`latitude`, `longitude`), valgfritt eksternt prosjektnummer (`external_project_number`), valgfri firmalogo (`logo_url`), `show_internal_project_number` (Boolean, default true) |
| `project_members` | Prosjektmedlemmer med rolle (member/admin), entrepriser via `member_enterprises` |
| `member_enterprises` | Mange-til-mange join-tabell mellom `project_members` og `enterprises` |
| `enterprises` | Entrepriser med `enterprise_number` (Dalux-format: "04 Tømrer, Econor"), bransje, firma, farge |
| `buildings` | Lokasjoner med `number` (auto-generert per prosjekt), `type` (deprecated, default `"bygg"`), status (unpublished/published) |
| `drawings` | Tegninger med metadata: tegningsnummer, fagdisiplin, revisjon, status, etasje, målestokk, opphav, valgfri `geoReference` (JSON) |
| `drawing_revisions` | Revisjonshistorikk for tegninger med fil, status og hvem som lastet opp |
| `report_templates` | Maler med category (oppgave/sjekkliste), prefix, versjon, `domain` (bygg/hms/kvalitet, default "bygg"), `subjects` (JSON-array med forhåndsdefinerte emnetekster) |
| `report_objects` | Rapportobjekter i maler (23 typer, JSON-konfig), rekursiv nesting via `parent_id` |
| `checklists` | Sjekklister med oppretter/svarer-entreprise, status, data (JSON) |
| `tasks` | Oppgaver med påkrevd mal (`template_id`), prefiks+løpenummer (`number`), prioritet, frist, oppretter/svarer, utfylt data (`data` JSON), valgfri tegningsposisjon og sjekkliste-kobling (`checklist_id`, `checklist_field_id`) |
| `document_transfers` | Sporbarhet: all sending mellom entrepriser |
| `images` | Bilder med valgfri GPS-data |
| `folders` | Rekursiv mappestruktur (Mapper-modul) med parent_id, `access_mode` (inherit/custom) |
| `folder_access` | Tilgangsoppføringer per mappe: entreprise, gruppe eller bruker (mange-til-mange) |
| `documents` | Dokumenter i mapper med fil-URL og versjon |
| `workflows` | Arbeidsforløp med oppretter-entreprise og valgfri svarer-entreprise (`responder_enterprise_id`) |
| `workflow_templates` | Kobling mellom arbeidsforløp og maler (mange-til-mange) |
| `project_invitations` | E-postinvitasjoner med token, status (pending/accepted/expired), utløpsdato |
| `group_enterprises` | Mange-til-mange kobling mellom `project_groups` og `enterprises` — styrer entreprise-begrenset fagområde-tilgang |

Viktige relasjoner:
- `member_enterprises` er mange-til-mange join-tabell: en bruker kan tilhøre flere entrepriser i samme prosjekt via `MemberEnterprise(projectMemberId, enterpriseId)`
- Sjekklister og oppgaver har ALLTID `creator_enterprise_id` (oppretter) og `responder_enterprise_id` (svarer)
- `document_transfers` logger all sending mellom entrepriser med full sporbarhet
- Bilder har valgfri GPS-data (`gps_lat`, `gps_lng`, `gps_enabled`)
- Oppgaver kan kobles til en tegning med posisjon (`drawing_id`, `position_x`, `position_y`) — brukes for markør-plassering på tegninger
- `workflows` tilhører en oppretter-entreprise (`enterpriseId`) med valgfri svarer-entreprise (`responderEnterpriseId`), kobler til maler via `workflow_templates`. Relasjoner er navngitte: `WorkflowCreator` / `WorkflowResponder`
- `report_objects` bruker selvrefererande relasjon (`parent_id`) for rekursiv nesting — kontainerfelt (`list_single`/`list_multi`) kan ha barnefelt som selv kan være kontainere (Dalux-stil), CASCADE-sletting av barn
- `report_templates` har `category` (`oppgave` | `sjekkliste`), valgfritt `prefix` og valgfri `subjects` (Json?, default `[]`) — forhåndsdefinerte emnetekster som vises som nedtrekksmeny ved opprettelse
- `buildings` tilhører et prosjekt, med tegninger koblet via `building_id`. `type`-feltet er deprecated — forskjellen mellom utomhus og innendørs styres nå av `geoReference` på tegningen
- `drawings` har full metadata (tegningsnummer, fagdisiplin, revisjon, etasje, målestokk, status) med `drawing_revisions` for historikk. Valgfri `geoReference` (JSON) med 2 referansepunkter for similaritetstransformasjon (pixel ↔ GPS)
- `folders` bruker selvrefererande relasjon (`parent_id`) for mappetreet i Mapper-modulen. `accessMode` styrer tilgang: `"inherit"` (arv fra forelder) eller `"custom"` (egendefinert tilgangsliste)
- `folder_access` kobler mapper til entrepriser, grupper eller brukere via `accessType` (`"enterprise"` | `"group"` | `"user"`). Cascade-sletting fra alle sider. Unikt constraint: `[folderId, accessType, enterpriseId, groupId, userId]`
- `project_invitations` kobles til project, enterprise (valgfri), group (valgfri) og invitedBy (User)
- `projects` har valgfri `latitude`/`longitude` (Float?) — brukes til kartvisning og automatisk værhenting i sjekklister
- `projects` har `showInternalProjectNumber` (Boolean, default true) — styrer om SF-prosjektnummeret vises i print-header
- `report_templates` har `domain` (String, default "bygg") — fagområde for tilgangskontroll
- `project_groups` har `domains` (JSON-array, default []) — gruppens fagområder, og `groupEnterprises` relasjon for entreprise-begrenset tilgang
- `group_enterprises` er mange-til-mange join-tabell mellom `project_groups` og `enterprises` med unikt constraint `[groupId, enterpriseId]`, cascade-sletting fra begge sider

### API-routere (tRPC)

Alle routere i `apps/api/src/routes/`:

| Router | Prosedyrer |
|--------|-----------|
| `prosjekt` | hentAlle, hentMedId, opprett, oppdater |
| `entreprise` | hentForProsjekt, hentMedId, opprett, oppdater, slett |
| `sjekkliste` | hentForProsjekt (m/statusfilter + buildingId-filter), hentMedId, opprett, oppdaterData, endreStatus |
| `oppgave` | hentForProsjekt (m/statusfilter), hentForTegning (markører per tegning), hentMedId (m/template.objects), opprett (m/tegningsposisjon, templateId påkrevd), oppdater, oppdaterData, endreStatus |
| `mal` | hentForProsjekt, hentMedId, opprett, oppdaterMal, slettMal, leggTilObjekt, oppdaterObjekt, oppdaterRekkefølge, sjekkObjektBruk, slettObjekt |
| `bygning` | hentForProsjekt (m/valgfri type-filter), hentMedId, opprett (m/type), oppdater, publiser, slett |
| `tegning` | hentForProsjekt (m/filtre), hentForBygning, hentMedId, opprett, oppdater, lastOppRevisjon, hentRevisjoner, tilknyttBygning, settGeoReferanse, fjernGeoReferanse, slett |
| `arbeidsforlop` | hentForProsjekt, hentForEnterprise, opprett, oppdater, slett |
| `mappe` | hentForProsjekt (m/tilgangsoppføringer), hentDokumenter, opprett, oppdater, slett, hentTilgang, settTilgang |
| `medlem` | hentForProsjekt, hentMineEntrepriser, leggTil (m/invitasjon), fjern, oppdater (navn/e-post/telefon/rolle), oppdaterRolle, sokBrukere |
| `gruppe` | hentMineTillatelser, hentMinTilgang, hentForProsjekt, opprettStandardgrupper, opprett, oppdater, slett, leggTilMedlem (m/invitasjon), fjernMedlem, oppdaterEntrepriser, oppdaterDomener |
| `invitasjon` | hentForProsjekt, validerToken, aksepter, sendPaNytt, trekkTilbake |
| `vaer` | hentVaerdata (Open-Meteo proxy: latitude, longitude, dato → temperatur, værkode, vind) |

**Auth-nivåer:** `publicProcedure` (åpen) og `protectedProcedure` (krever autentisert userId i context). Context bygges i `context.ts` som verifiserer Auth.js-sesjonstokens. De fleste routere bruker `protectedProcedure` med tilleggs-sjekker fra `tilgangskontroll.ts`.

### Tilgangskontroll

Hjelpemodul i `apps/api/src/trpc/tilgangskontroll.ts` med følgende funksjoner:

| Funksjon | Beskrivelse |
|----------|-------------|
| `hentBrukerEntrepriseIder(userId, projectId)` | Returnerer `string[]` (entreprise-IDer) eller `null` (admin, ser alt) |
| `byggTilgangsFilter(userId, projectId)` | Returnerer Prisma WHERE-filter som kombinerer entreprise-tilgang og fagområde-tilgang fra grupper. `null` for admin |
| `verifiserEntrepriseTilhorighet(userId, enterpriseId)` | Kaster FORBIDDEN hvis bruker ikke tilhører entreprisen (admin-bypass) |
| `verifiserAdmin(userId, projectId)` | Kaster FORBIDDEN hvis ikke admin |
| `verifiserProsjektmedlem(userId, projectId)` | Kaster FORBIDDEN hvis ikke medlem |
| `verifiserDokumentTilgang(userId, projectId, creatorId, responderId, domain?)` | Sjekker entreprise-tilgang + fagområde-tilgang via grupper |
| `hentBrukerTillatelser(userId, projectId)` | Samler `Permission`-set fra alle brukerens grupper. Admin har alle |
| `verifiserTillatelse(userId, projectId, permission)` | Kaster FORBIDDEN hvis tillatelse mangler |

**Tilgangslogikk for dokumentvisning:**
- Admin ser alltid alt
- Direkte entreprise-tilgang: bruker ser dokumenter der egen entreprise er oppretter/svarer (alle domener)
- Fagområde-tilgang via grupper:
  - Gruppe uten entrepriser → tverrgående: ser ALLE dokumenter med matchende domain (f.eks. HMS-gruppen ser alle HMS-sjekklister)
  - Gruppe med entrepriser → entreprise-begrenset: ser kun dokumenter med matchende domain OG entreprise
- Samlet: bruker ser union av alle sine gruppers tilganger + direkte MemberEnterprise-tilgang

**UI-tilgangskontroll (web):**
- `gruppe.hentMineTillatelser` eksponerer brukerens tillatelser til klienten (returnerer `Permission[]`)
- `gruppe.hentMinTilgang` returnerer `{ tillatelser: string[], domener: string[], erAdmin: boolean }` — brukes for tilgangsbasert malfiltrering i tegningsopprett-modal
- `HovedSidebar` — Maler-ikonet skjules for brukere uten `manage_field`
- `OppsettLayout` — Feltarbeid-seksjonen (Entrepriser, Oppgavemaler, Sjekklistemaler, Kontrollplan, Mappeoppsett) skjules for brukere uten `manage_field`
- Maler-siden (`/dashbord/[prosjektId]/maler`) — Viser "Ingen tilgang" EmptyState ved direkte URL uten `manage_field`
- Mønster: `tillatelse?: Permission` på nav-element-interfaces, filtrering av elementer basert på `tillatelser.includes()`

### Fagområder (domain)

Maler har et `domain`-felt (`"bygg"` | `"hms"` | `"kvalitet"`, default `"bygg"`). Brukergrupper har `domains` (JSON-array) og valgfri tilknytning til entrepriser via `group_enterprises`.

**Konsept:** HMS-gruppen (domains=["hms"], ingen entrepriser) ser **alle** HMS-dokumenter i prosjektet tverrgående. Bygg-grupper (domains=["bygg"], med entrepriser) ser kun egne entreprisers bygg-dokumenter.

**Tillatelsestyper:** `Permission` = `"manage_field"` | `"create_tasks"` | `"create_checklists"` | `"view_field"`. Definert i `@siteflow/shared`.

**Statusoverganger** valideres via `isValidStatusTransition()` fra `@siteflow/shared`:
```
draft → sent → received → in_progress → responded → approved | rejected → closed
                                                      rejected → in_progress (tilbake til arbeid)
draft / sent / received / in_progress → cancelled (avbryt — irreversibel)
```

### Entrepriseflyt

Sentral forretningslogikk. Dokumenter (sjekklister/oppgaver) flyter mellom entrepriser:

- Oppretter-entreprise initierer og godkjenner/avviser
- Svar-entreprise mottar, fyller ut og besvarer
- Alle overganger logges i `document_transfers`

### Flerforetagsbrukere

En bruker kan tilhøre flere entrepriser i samme prosjekt via `MemberEnterprise` join-tabell (mange-til-mange mellom `ProjectMember` og `Enterprise`).

**Database:** `member_enterprises` med `project_member_id` + `enterprise_id` (unik kombinasjon). Cascade-sletting fra begge sider.

**API:** `medlem.hentMineEntrepriser` (protectedProcedure) — returnerer brukerens entrepriser i et prosjekt. Admin uten entreprise-tilknytning ser alle entrepriser. `addMemberSchema` bruker `enterpriseIds: string[]` (array).

**Opprettelse av sjekklister/oppgaver:**
- **Web:** Oppretter-dropdown viser brukerens entrepriser (`hentMineEntrepriser`), svarer-dropdown viser alle entrepriser
- **Mobil:** Oppretter-liste viser kun brukerens entrepriser. Hvis brukeren har kun én entreprise → auto-valgt, ingen dropdown
- Svarer-entreprise utledes automatisk fra arbeidsforløp (mobil) eller velges fritt (web)

**Entreprise-veiviser (web):** Medlemsvalg i entreprise-opprettelse bruker `MemberEnterprise.createMany` (en bruker kan tilknyttes flere entrepriser uten å fjernes fra eksisterende)

### Statusendring (mobil)

Sjekkliste-detaljskjermen (`apps/mobile/app/sjekkliste/[id].tsx`) og oppgave-detaljskjermen (`apps/mobile/app/oppgave/[id].tsx`) har kontekstuelle statusknapper i bunnpanelet, over lagre-knappen. Knappene viser neste gyldige handling basert på nåværende status:

| Status | Knapp(er) | Neste status | Farge |
|--------|-----------|--------------|-------|
| `draft` | "Send" | `sent` | Blå |
| `sent` | "Motta" | `received` | Blå |
| `received` | "Start arbeid" | `in_progress` | Amber |
| `in_progress` | "Besvar" | `responded` | Lilla |
| `responded` | "Godkjenn" + "Avvis" | `approved` / `rejected` | Grønn + Rød |
| `rejected` | "Start arbeid igjen" | `in_progress` | Amber |
| `approved` | "Lukk" | `closed` | Grå |
| `closed` | (ingen knapp) | — | — |
| `cancelled` | (ingen knapp) | — | — |

- For `draft`, `sent`, `received`, `in_progress` vises "Avbryt"-knapp (rød) side om side med hovedhandlingen

- For `responded`-status vises to knapper side om side (flex-row)
- Bekreftelsesdialog (`Alert.alert`) før hver statusendring
- Bruker `trpc.sjekkliste.endreStatus` / `trpc.oppgave.endreStatus` med `senderId` fra `useAuth().bruker.id`
- Cache-invalidering etter suksess: `hentMedId` + `hentForProsjekt`
- `StatusMerkelapp` i metadata-bar oppdateres automatisk etter endring
- Overgang logges i `document_transfers` og vises i historikk-seksjonen
- `hentStatusHandlinger()` hjelpefunksjon mapper status til handlinger med `DocumentStatus`-type

### Invitasjonsflyt

Når admin legger til en bruker (via `medlem.leggTil` eller `gruppe.leggTilMedlem`):

1. Bruker opprettes/finnes i `users`-tabellen, `ProjectMember` opprettes
2. Sjekker om brukeren har `Account`-kobling (har logget inn med OAuth)
3. Hvis ikke → oppretter `ProjectInvitation` med unik token (7 dagers utløp), sender e-post via Resend
4. E-posten inneholder akseptlenke → `/aksepter-invitasjon?token=...`
5. Brukeren klikker → ser prosjektnavn og innloggingsknapper (Google/Microsoft)
6. Etter OAuth-innlogging → `allowDangerousEmailAccountLinking` kobler til eksisterende User-rad
7. Siden matcher innlogget e-post → markerer invitasjon som akseptert → redirect til `/dashbord/[projectId]`

**E-posttjeneste:** `apps/api/src/services/epost.ts` — lazy-initialisert Resend-klient (krasjer ikke uten API-nøkkel ved oppstart)
**Aksept-side:** `apps/web/src/app/aksepter-invitasjon/page.tsx` — Server Component med token-validering
**Brukere-side:** Viser gul "Ventende"-badge og "Send på nytt"-knapp for aktive invitasjoner

### Arbeidsforløp

Arbeidsforløp kobler maler til entrepriser og definerer oppretter/svarer-flyten. Konfigureres under Innstillinger > Field > Entrepriser:

- Hver entreprise (oppretter) kan ha flere arbeidsforløp (f.eks. "Uavhengig Kontroll", "Produksjon")
- Hvert arbeidsforløp har en valgfri `responderEnterpriseId` som angir svarer-entreprisen
  - Når `responderEnterpriseId` er `null` → svarer er samme entreprise som oppretter (intern flyt)
  - Når satt → dokumenter sendes til en annen entreprise (f.eks. admin sender til UE for utbedring)
  - Svarer-entreprise velges via dropdown i opprett/rediger-modal
- Hvert arbeidsforløp velger hvilke maler (oppgavetyper og sjekklistetyper) som er tilgjengelige
- Maler kategoriseres som `oppgave` eller `sjekkliste` via `report_templates.category`
- Visningen bruker to-kolonne layout: Oppretter (venstre) → pil → Svarer (høyre) med fargekodet badge
- Entreprise-headere har fast bredde (280px) og kun oppretter-kolonnen, arbeidsforløp-rader har oppretter + pil + svarer-badge
- Treprikk-menyer (⋮) på to nivåer: entreprise-header og arbeidsforløp-rad
- Alle arbeidsforløp for et prosjekt hentes i én query (`hentForProsjekt`) og grupperes klient-side per entreprise
- Sjekklister og oppgaver knyttes til arbeidsforløp via `workflowId` på Checklist/Task-modellene
- Svarer-entreprise bestemmes automatisk fra valgt arbeidsforløp ved opprettelse
- Sjekklister har valgfrie felter: `buildingId` (lokasjon), `drawingId` (tegning), `subject` (emne)
- Emne (`subject`) ved opprettelse: hvis malen har `subjects`-array → vises som nedtrekksmeny (web: `<Select>`, mobil: Pressable-liste). Uten subjects → fritekst (mobil) eller skjult (web)
- Tittel settes automatisk til prosjektnavn ved opprettelse fra mobil

### Prosjektgrupper

Prosjektgrupper kategoriserer brukere med tilhørende tillatelser. Gruppekategorier: `generelt`, `field`, `brukergrupper`.

**Standardgrupper** (opprettes automatisk via seed/`opprettStandardgrupper`):
- **Feltarbeid-administratorer** (`field-admin`) — `manage_field`, `create_tasks`, `create_checklists`
- **Oppgave- og sjekklisteregistratorer** (`oppgave-sjekkliste-koord`) — `create_tasks`, `create_checklists`
- **Feltarbeid-registrator** (`field-observatorer`) — `view_field`
- **HMS** (`hms-ledere`) — `create_tasks`, `create_checklists`

Standardgruppene er definert i `@siteflow/shared` (`STANDARD_PROJECT_GROUPS`).

### Tegningsmarkører (mobil)

Oppgaver kan opprettes direkte fra tegninger i mobilappen:
1. Bruker trykker på tegning → markør plasseres (rød pin)
2. OppgaveModal åpnes med posisjon, tegningsnavn, entreprisevalg og prioritet
3. Oppgaven lagres med `drawingId`, `positionX`, `positionY` (0–100 prosent)

Komponenter:
- `TegningsVisning` — Støtter `onTrykk`-callback og `markører`-prop for å vise pins
- `OppgaveModal` — Fullskjerm modal for oppgaveoppretting fra tegning
- Både bilde- og PDF-visning (WebView med injisert JS) støtter trykk-registrering

### Tegningsvisning (web)

Interaktiv tegningsvisning på `/dashbord/[prosjektId]/tegninger/` med zoom og markørplassering:

**Layout:** Full-høyde visning uten padding (layout bruker `flex flex-col overflow-hidden` i stedet for `p-6 overflow-auto`)

**Header:** Tegningsnavn, nummer, revisjon + zoom-kontroller (−/+/prosent) + plasseringsmodus-toggle (Navigering/Plasseringsmodus)

**Zoom:** 0.25x–3x med knapper, Ctrl+musehjul, klikk-på-prosent for reset. Bilde skaleres via `width: ${zoom * 100}%`

**Plasseringsmodus:** Toggle mellom navigering (scroll/pan) og plasseringsmodus (crosshair-cursor). Klikk i plasseringsmodus:
1. Plasserer blå bouncende markør
2. Åpner opprett-modal (oppgave eller sjekkliste)
3. Velg mal, entrepriser, tittel
4. Sender `drawingId`, `positionX`, `positionY`

**Eksisterende markører:** Røde MapPin fra `oppgave.hentForTegning` med hover-label (nummer), klikk navigerer til oppgave

**PDF-tegninger:** iframe med transparent overlay i plasseringsmodus, markører rendres over iframe

### TODO
- Nedtrekksmeny for å velge eksisterende prosjektmedlemmer i brukergrupper (erstatt e-postfelt)
- Oppgave-fra-tegning: Android-tilpasning for tegningstrykk (iOS/web implementert)
- Kvalitetssikring av alle 23 rapportobjekttyper (mobil-renderere)
- TegningPosisjonObjekt (mobil): full implementasjon med tegningsvelger og TegningsVisning-markering
- Oppgave-fra-felt i sjekkliste-utfylling: web er implementert, mobil har det allerede
- Adgangskontroll: Håndheve tillatelsesbasert opprettelse (verifiserTillatelse i opprett-prosedyrer), arbeidsforløp-begrensning per brukergruppe
- Videresending av sjekklister/oppgaver til annen entreprise (svarer og oppretter)
- TrafikklysObjekt (mobil): legge til 4. farge grå/"Ikke relevant" i mobilrenderer

### Oppgave fra tegning (mobil)

Brukeren kan opprette oppgaver direkte fra tegningsvisningen i Lokasjoner-taben:
1. Trykk på tegningen plasserer en markør
2. `MalVelger` åpnes — bruker velger oppgavemal (kategori `"oppgave"`)
3. `OppgaveModal` åpnes med valgt mal, posisjon, tegningsnavn, entreprisevalg og prioritet
4. Etter opprettelse navigeres bruker til oppgave-detaljskjermen (`/oppgave/${id}`) for utfylling
- Oppgaven lagres med `drawingId`, `positionX` og `positionY` (prosent 0-100)
- Task-modellen har valgfrie felter: `drawingId`, `positionX`, `positionY`
- Implementert for iOS/web. Android-tilpasning gjøres ved behov.

### Oppgavesystem

Oppgaver bruker NØYAKTIG samme rapportobjekt-system som sjekklister (23 typer), med lokal-first lagring og auto-synkronisering. En mal er ALLTID påkrevd for oppgaver (`templateId` er required i API).

**Oppgavenummerering:**
- Format: `mal.prefix + "-" + løpenummer` (f.eks. `BHO-001`, `S-BET-042`)
- Løpenummer auto-genereres per prosjekt (inkrementelt)
- Oppgavenummeret vises i oppgavelisten og i sjekklistefeltet der oppgaven ble opprettet

**Oppgave fra sjekklistefelt (mobil + web):**
- Hvert rapportobjekt (utfyllbart felt) i sjekkliste-utfyllingen kan opprette en oppgave
- Oppgavenummeret (med prefiks) vises nederst i feltet etter opprettelse som blå pill-badge (klikkbar → navigerer til oppgave)
- `+Oppgave`-knapp vises på felter uten eksisterende oppgave (skjult i lesemodus)
- Koblingen lagres via `checklistId` og `checklistFieldId` på Task-modellen
- **Web:** `OpprettOppgaveModal` (`apps/web/src/components/OpprettOppgaveModal.tsx`) — modal med malvelger (filtrert på kategori `"oppgave"` og tilgangskontroll), oppretter-entreprise, auto-utledet svarer fra arbeidsforløp, auto-generert tittel (`"Oppgave fra {sjekklisteNr}: {feltLabel}"`)
- **Web:** `FeltWrapper` har props `oppgaveNummer`, `oppgaveId`, `onOpprettOppgave`, `onNavigerTilOppgave`
- **Web:** Sjekkliste-detaljsiden bruker `trpc.oppgave.hentForSjekkliste` og bygger `feltOppgaveMap` (Map<feltId, oppgave>)

**Opprettelsespunkter:**
- Fra sjekklistefelt (med sporbarhet til sjekkliste og felt)
- Fra tegninger (med markørposisjon, via MalVelger → OppgaveModal)
- Fra oppgavelisten (frittstående, med malvelger)

**Oppgave-utfylling (mobil):**

Oppgave-detaljskjermen (`apps/mobile/app/oppgave/[id].tsx`) bruker `useOppgaveSkjema`-hooken og rendrer malobjekter identisk med sjekkliste-utfylling:

```
[Header: ← | nummer Oppgave | kø-teller synk lagre]
[Metadata-bar: prefix | malnavn | StatusMerkelapp]
[Entrepriser: Oppretter → Svarer]
─── ScrollView ───
  [Tittel (redigerbar via modal)]
  [Prioritet (4 knapper)]
  [Beskrivelse (redigerbar via modal)]
  [Sjekkliste-kobling (hvis fra sjekkliste)]
  [Tegning-kobling (hvis fra tegning)]
  ── Malobjekter ──
  Alle rapportobjekter fra malen med:
  - RapportObjektRenderer + FeltWrapper
  - Rekursiv synlighet og nesting-nivå
  ──────────────────
  [Historikk]
─── Bunnpanel ───
  [Statusknapper + Lagre]
```

**Auto-fill ved ny oppgave:**

| Rapportobjekttype | Auto-fill verdi |
|------------------|----------------|
| `date` | Dagens dato (ISO-streng) |
| `date_time` | Nåværende dato+tid (ISO-streng) |
| `person` | Innlogget brukers ID |
| `company` | Oppretter-entreprisens ID |
| `drawing_position` | `{ drawingId, positionX, positionY, drawingName }` fra oppgavens tegning |

**`useOppgaveSkjema`-hook** (`apps/mobile/src/hooks/useOppgaveSkjema.ts`):
- Tilpasset kopi av `useSjekklisteSkjema.ts` med oppgave-spesifikk logikk
- Bruker `oppgaveFeltdata` SQLite-tabell, `trpc.oppgave.hentMedId` og `trpc.oppgave.oppdaterData`
- Auto-fill av kjente felter ved initialisering (kun for nye oppgaver uten eksisterende data)
- Callback-filter: `dokumentType === "oppgave"` for opplastingskø-oppdateringer
- Returnerer samme interface som sjekkliste-hooken: `hentFeltVerdi`, `settVerdi`, `settKommentar`, `leggTilVedlegg`, `fjernVedlegg`, `erSynlig`, `valider`, `lagre`, `harEndringer`, `erRedigerbar`, `lagreStatus`, `synkStatus`

**Generaliserte komponenter:**
- `FeltWrapper` — `sjekklisteId` er nå valgfri, ny `oppgaveIdForKo`-prop for opplastingskø-routing. Skjuler oppgave-opprettelses-UI når `oppgaveIdForKo` er satt
- `FeltDokumentasjon` — `sjekklisteId` er nå valgfri, ny `oppgaveIdForKo`-prop. Sender riktig ID til `leggIKo()`

**Task-modellens feltert (implementert):**

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `number` | Int | Løpenummer per prosjekt (auto-generert) |
| `templateId` | String (påkrevd) | Kobling til oppgavemal (`report_templates`) |
| `data` | Json? | Utfylte rapportobjekter (likt `checklists.data`) |
| `checklistId` | String? | Sporbarhet til sjekkliste oppgaven ble opprettet fra |
| `checklistFieldId` | String? | Sporbarhet til spesifikt felt i sjekklisten |

### Tegninger (drawings)

Tegninger har full metadata basert på bransjestandarder (Dalux, ISO 19650, norsk praksis):

**Fagdisipliner:** ARK, LARK, RIB, RIV, RIE, RIG, RIBr, RIAku
**Tegningstyper:** plan, snitt, fasade, detalj, oversikt, skjema, montering
**Statuser:** utkast → delt → under_behandling → godkjent → for_bygging → som_bygget

Metadatafelter: tegningsnummer (f.eks. ARK-P-101), fagdisiplin, tegningstype, revisjon (A/B/C), versjon (autoinkrement), status, etasje, målestokk, beskrivelse, opphav (firma), utstedelsesdato, filstørrelse.

**Revisjonshistorikk:** Ved opplasting av ny revisjon lagres gjeldende versjon automatisk i `drawing_revisions` med full sporbarhet (fil, status, hvem som lastet opp). `Drawing`-tabellen viser alltid gjeldende versjon.

**Planlagt utvidelse (etter behov):**
- `DrawingSet` (tegningssett) — gruppering ved utsendelse ("Anbud", "For bygging", "Som bygget")
- Egendefinerte metadata-felter per prosjekt
- Filnavnmaler for automatisk utlesing av metadata

### Rapportobjekter (23 typer)

Maler bygges på PC med drag-and-drop. Hver mal inneholder objekter med definert type og konfigurasjon. Typene er definert i `packages/shared/src/types/index.ts`:

| Type | Kategori | Beskrivelse |
|------|----------|-------------|
| `heading` | tekst | Overskrift |
| `subtitle` | tekst | Undertittel |
| `text_field` | tekst | Tekstfelt |
| `list_single` | valg | Enkeltvalg (radio/dropdown) |
| `list_multi` | valg | Flervalg (avkrysning) |
| `integer` | tall | Heltall |
| `decimal` | tall | Desimaltall |
| `calculation` | tall | Beregning (formel) |
| `traffic_light` | valg | Trafikklys (grønn/gul/rød/grå — 4 farger: Godkjent, Anmerkning, Avvik, Ikke relevant) |
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
| `repeater` | spesial | Repeterende seksjon (kontainer med barnefelt, rendrer dupliserbare rader) |
| `location` | spesial | Lokasjon (read-only, viser prosjektets posisjon på kart) |
| `drawing_position` | spesial | Posisjon i tegning (tegningsvelger + klikkbar markør) |

Hvert objekt har metadata (`REPORT_OBJECT_TYPE_META`) med label, ikon, kategori og standardkonfigurasjon. Objektkonfigurasjon lagres som JSON i `report_objects.config`.

### Dato/tid-felter (mobil, Dalux-stil)

`DatoObjekt` og `DatoTidObjekt` i `apps/mobile/src/components/rapportobjekter/` har smart UX inspirert av Dalux:

**DatoObjekt:**
- Autoforslag: trykk på tomt felt → setter dagens dato + åpner picker for justering
- "I dag"-lenke (blå tekst under feltet): synlig kun når verdi finnes og ikke er dagens dato
- ×-knapp i feltet for å tømme verdi (setter til `null`)
- Behold eksisterende spinner (iOS) / dialog (Android) for justering

**DatoTidObjekt:**
- Splittet layout: dato-felt (`flex-[2]`) og tid-felt (`flex-1`) side om side
- Autoforslag: trykk på tomt dato- eller tid-felt → setter nåværende dato+tid
- "Nå"-lenke (blå tekst under feltene): setter dato+tid til nå, begge samtidig
- Uavhengig redigering: trykk dato → dato-picker, trykk tid → tid-picker direkte
- ×-knapp på dato-feltet tømmer hele verdien (dato+tid)
- Android: dato-picker → tid-picker automatisk ved nytt valg (bevart fra før)

Begge bruker `@react-native-community/datetimepicker`. Verdi lagres som ISO 8601-streng. I lesemodus skjules alle knapper/lenker.

### Malbygger (PC)

Drag-and-drop-editor for å bygge maler med rekursiv kontainer-nesting (Dalux-stil). Komponenter i `apps/web/src/components/malbygger/`:

| Komponent | Beskrivelse |
|-----------|-------------|
| `MalBygger` | Hovedkomponent: tre-kolonne layout (FeltPalett, DropSoner, FeltKonfigurasjon), bygger tre fra flat array. Fast «Lokasjon»-felt vises øverst i topptekst (grå, ikke slettbart) |
| `FeltPalett` | Venstre panel med draggbare felttyper (23 typer) |
| `DropSone` | Droppbar sone (topptekst/datafelter) med rekursiv `RekursivtFelt`-rendering |
| `DraggbartFelt` | Individuelt sorterbart felt med `nestingNivå`, `parentId` og `children`-prop for inline barn |
| `FeltKonfigurasjon` | Høyre panel for å redigere valgt felts label, påkrevd-status og type-spesifikk config. Valgalternativer (list_single/list_multi) er redigerbare inline |
| `DragOverlay_` | Visuell overlay under drag-operasjoner |
| `BetingelseBjelke` | Blå betingelsesbar inne i kontainerfelt: "Vis felter hvis verdien er en av følgende: [chips]" |
| `TreprikkMeny` | Kontekstmeny per felt: Rediger, Tilføy/Fjern betingelse, Slett |
| `typer.ts` | `TreObjekt` interface (MalObjekt + children) |

**Rekursiv kontainer-nesting (Dalux-stil):**
- Kontainertyper: `list_single`, `list_multi` og `repeater` (sjekkes med `erKontainerType()`)
- `akseptererBarn(objekt)` i MalBygger: repeater aksepterer alltid barn, list-kontainere kun med `conditionActive === true`
- Repeater vises med grønn ramme i malbygger (i stedet for blå), uten BetingelseBjelke
- Forelder-barn-relasjon via `report_objects.parent_id` DB-kolonne (ikke config JSON)
- Betingelse aktiveres på kontainerfelt: `conditionActive: true`, `conditionValues: string[]` i config
- Barn knyttes via `parentId` på ReportObject — ubegrenset nesting-dybde
- Visuelt: blå ramme (`border-l-2 border-blue-400 bg-blue-50/30`) rundt barnegrupper KUN i malbyggeren — fjernet fra utfylling, print og mobil
- "Dra og slipp felter her"-placeholder i tomme barnegrupper per nesting-nivå
- Rekursiv `RekursivtFelt`-komponent i DropSone rendrer barn inline med BetingelseBjelke
- Dra-og-slipp: felt arver `parentId` ved drop i kontainer, nullstilles ved drag ut
- Sletting av kontainerfelt kaskaderer via DB CASCADE — barn slettes automatisk
- **Slett-validering:** Sletting av rapportobjekter blokkeres hvis sjekklister/oppgaver inneholder data for feltet. `mal.sjekkObjektBruk` query sjekker bruk via JSONB `?|` operator (inkludert alle etterkommere). `SlettBekreftelse`-modal viser liste over berørte dokumenter — slett-knappen skjules helt ved bruk
- Trebygging: flat array → tre med `byggTre()` i MalBygger, splittes i topptekst/datafelter
- **Rekkefølge-sortering:** `sortOrder` lagres globalt (topptekst først, deretter datafelter) slik at mobil, web-utfylling og print viser felter i riktig rekkefølge. `byggObjektTre()` i `@siteflow/shared` og alle konsumenter sorterer etter sone (`config.zone === "topptekst"` → 0, ellers 1) før `sortOrder` innenfor sone
- `harForelderObjekt(obj)` fra `@siteflow/shared` sjekker `obj.parentId != null`
- `harBetingelse(config)` er deprecated — bruk `harForelderObjekt()` for nye kall

**Opsjon-normalisering:**
- Alternativer (`config.options`) kan lagres som strenger (`"Ja"`) eller objekter (`{value: "green", label: "Godkjent"}`)
- Malbyggeren lagrer som strenger, trafikklys bruker objekter
- All rendering-kode MÅ normalisere opsjoner: `opsjonTilStreng()` (web) og `normaliserOpsjon()` (mobil)
- `opsjonTilStreng(opsjon)` → returnerer string (sjekker string → obj.label → obj.value)
- `normaliserOpsjon(opsjon)` → returnerer `{value, label}` (sjekker string → obj med value/label)

### Innstillings-sidebar

Sidebaren under `/dashbord/oppsett/` er organisert i seksjoner:
- **Brukere** — Brukergrupper, rollestyring, legg til medlemmer (med bruker-søk)
- **Lokasjoner** — Samlet lokasjonsliste (alle bygninger/anlegg i én side, med redigering, georeferanse og publisering)
- **Field** — Entrepriser (med arbeidsforløp), Oppgavemaler, Sjekklistemaler, Kontrollplan, Mappeoppsett
- **Owners Portal** — Eierportalens brukere, Prosjektoppsett

### Prosjektlokasjon og kartvelger

Prosjekter kan ha valgfri GPS-lokasjon (`latitude`, `longitude` på Project-modellen). Koordinatene brukes til:
1. Kartvisning i `LokasjonObjekt` (rapportobjekt type `location`)
2. Automatisk værhenting basert på prosjektposisjon + befaringsdato

**Kartvelger (`apps/web/src/components/KartVelger.tsx`):**
- Leaflet MapContainer med OpenStreetMap tiles (gratis, ingen API-nøkkel)
- Klikkbar — plasserer draggbar markør
- Default senter Oslo (59.91, 10.75), zoom 5 uten koordinater / 15 med
- MÅ importeres med `dynamic(..., { ssr: false })` — Leaflet krever `window`
- Fix Leaflet-ikon-bug: sett icon URL manuelt med `L.icon()` (unpkg CDN)

**Prosjektoppsett-siden** (`/dashbord/oppsett/prosjektoppsett`):
- Seksjon "Firmalogo": opplasting (PNG/JPG), forhåndsvisning (maks 60×200px), slett-knapp, stiplet tom-boks
- Seksjon "Generell informasjon": prosjektnummer (read-only), eksternt prosjektnummer, navn, beskrivelse, adresse
- Seksjon "Prosjektlokasjon" med kartvelger, koordinater + "Fjern lokasjon"-knapp
- Lagres via `prosjekt.oppdater` med `latitude`/`longitude`, `externalProjectNumber`, `logoUrl`

### Automatisk værhenting

Sjekklister med vær-felt (`weather`) og dato-felt (`date`/`date_time`) kan auto-hente værdata fra Open-Meteo:

**Flyt:**
1. `useAutoVaer` hook finner vær-felt og dato-felt i malen
2. Når dato er utfylt + prosjektet har koordinater → kaller `trpc.vaer.hentVaerdata`
3. Open-Meteo returnerer timebasert data → hook plukker kl. 12:00 (middag)
4. Auto-fyller temperatur, forhold (WMO-kode → norsk tekst) og vind
5. Setter `kilde: "automatisk"` — bruker kan overstyre (setter `kilde: "manuell"`)

**Vær-router (`apps/api/src/routes/vaer.ts`):**
- `hentVaerdata` prosedyre: tar `latitude`, `longitude`, `dato` (YYYY-MM-DD)
- Proxy til Open-Meteo API (gratis, ingen nøkkel, cachet av React Query)
- Returnerer `hourly.temperature_2m`, `hourly.weather_code`, `hourly.wind_speed_10m`

**VaerObjekt (web):**
- **Utfyllingsmodus:** Kompakt tekstlinje (f.eks. "1.4°C · Overskyet · 6.1 m/s") — ingen inputfelter
- **Lesemodus/print:** Separate inputfelter for temperatur, forhold og vind
- Viser "Automatisk hentet fra Open-Meteo"-badge når `kilde === "automatisk"`
- Ved manuell endring → `kilde` endres til `"manuell"`, badge forsvinner

**WMO-koder (`packages/shared/src/utils/vaer.ts`):**
- `vaerkodeTilTekst(code)` — konverterer WMO-værkode til norsk tekst (Klart, Overskyet, Lett regn, osv.)

**VaerVerdi-interface (`packages/shared/src/types/`):**
```
{ temp?: string, conditions?: string, wind?: string, kilde?: "manuell" | "automatisk" }
```

### LokasjonObjekt og TegningPosisjonObjekt

To nye rapportobjekttyper (23 totalt). Begge er i `SKJULT_I_UTFYLLING` — skjules under utfylling av sjekklister/oppgaver, vises kun i lesemodus og print.

**`location` — Lokasjon:**
- Display-only (som `heading`/`subtitle`) — ingen redigerbar verdi, i `DISPLAY_TYPER`
- **Web:** Viser liten Leaflet-kart (200px) + adressetekst, henter prosjektkoordinater via `trpc.prosjekt.hentMedId`
- **Mobil:** Tekstbasert visning med adresse, koordinater og "Åpne i kart"-lenke (Google Maps)
- Uten koordinater: "Prosjektet har ikke satt lokasjon"

**`drawing_position` — Posisjon i tegning:**
- **Web:** Navigasjonsbasert posisjonsvelger — klikk «Velg posisjon i tegning» → navigerer til tegningssiden → klikk i tegning → returneres med posisjon. Bruker `BygningKontekst.startPosisjonsvelger(feltId)` / `fullførPosisjonsvelger(resultat)` / `hentOgTømPosisjonsResultat(feltId)` — state-basert (ikke callback) pga. komponent-unmount ved navigering
- **Mobil:** Viser posisjonsinformasjon (full tegningsvelger kommer i neste iterasjon)
- Verdi: `TegningPosisjonVerdi { drawingId, positionX, positionY, drawingName }`
- Config-filtre i malbygger: `buildingFilter` (bygning-ID), `disciplineFilter` (fagdisiplin)
- Lesemodus: viser tegningsnavn + posisjon kompakt
- Tegningssiden (`tegninger/page.tsx`) viser blå posisjonsvelger-banner når `posisjonsvelgerAktiv`, skjuler normal opprett-tekst, og kaller `router.back()` etter valg

### Malliste-UI (Dalux-inspirert)

Oppgavemaler og Sjekklistemaler deler `MalListe`-komponenten med:
- **Verktøylinje:** +Tilføy (dropdown: Opprett ny, Importer fra prosjekt/firma/PDF), Rediger, Slett, Mer, Søk
- **Tabell:** Navn (med ikon), Prefiks, Versjon — sortert alfabetisk
- **Radvalg:** Enkeltklikk velger (aktiverer Rediger/Slett), dobbeltklikk åpner malbygger
- **Opprett-modal:** Navn, Prefiks, Beskrivelse
- **Rediger-modal:** Navn, Prefiks, Beskrivelse, Forhåndsdefinerte emner (dynamisk liste med tekst-inputs + legg til/slett)
- **Bunnlinje:** Låsefunksjon for maler

### Print-til-PDF (web)

Sjekkliste-detaljsiden (`/dashbord/[prosjektId]/sjekklister/[sjekklisteId]`) har utskriftsstøtte via `@media print` CSS og nettleserens "Lagre som PDF":

**Print-header** (`PrintHeader`-komponent, skjult på skjerm via `.print-header`):
- Rad 1: Firmalogo (venstre, `max-h-[60px] max-w-[120px]`), prosjektnavn, prosjektnr (betinget via `visInterntNummer`) + eksternt nr, adresse, lokasjon/tegning, dato (høyrejustert, dd.mm.yyyy)
- Rad 2: Sjekkliste-tittel, nummer (prefiks+løpenummer), oppretter (entreprise + bruker) + svarer på samme linje
- Rad 3: Værdata (temperatur, forhold, vind) — kun hvis vær-felt har verdi
- Props: `logoUrl`, `prosjektAdresse`, `status`, `bygningNavn`, `tegningNavn`, `visInterntNummer` (default true), URL-konvertering for `/uploads/...` → `/api/uploads/...`

**Skjerm-header** (skjult ved print via `.print-skjul`):
- Tittel, StatusBadge, LagreIndikator, "Vis PDF"-knapp (åpner forhåndsvisning i ny fane) + "Skriv ut"-knapp (`window.print()`)
- Metadata: mal, oppretter, svarer, sjekkliste-nummer

**PDF-forhåndsvisning** (`/utskrift/sjekkliste/[sjekklisteId]`):
- Egen rute utenfor `/dashbord/`-layouten — ingen sidebar, toolbar eller navigasjon
- Ren A4-visning (`max-w-[210mm]`, hvit bakgrunn med skygge, `px-[15mm] py-[15mm]`)
- PrintHeader synlig på skjerm (inline, ikke `.print-header`-klassen)
- Read-only rapportobjekter via `RapportObjektVisning` + `byggObjektTre`
- Vedlegg og kommentarer vist under hvert felt via `FeltVedlegg`-komponent
- Flytende verktøylinje (sticky) med «Skriv ut / Lagre PDF» og «Åpne sjekkliste»-lenke
- Henter sjekkliste via `trpc.sjekkliste.hentMedId`, prosjekt via `trpc.prosjekt.hentMedId`
- Ved print: A4-arket fyller hele siden (reset margin/shadow/rounded)

**Print CSS** (`apps/web/src/app/globals.css`):
- `@page { margin: 15mm; size: A4; }` — korrekt A4-format
- `print-color-adjust: exact` — fargeriktig utskrift (logo, trafikklys, badges)
- `.print-header` — `display: none` på skjerm, `display: block` ved print
- `.print-skjul` — `display: none` ved print
- `.print-vedlegg-fullvisning` — `display: none` på skjerm, `display: block` ved print (5:4 bilder)
- `.print-no-break` — `page-break-inside: avoid`
- `header`, `aside`, `[data-panel="sekundaert"]`, `[data-toolbar]` skjules ved print
- `main` → fullbredde uten margin
- `box-shadow: none` — fjern skygger i print

**Data-attributter for print:**
- `SekundaertPanel` → `data-panel="sekundaert"`
- `Verktoylinje` → `data-toolbar`

**RapportObjektVisning** (`apps/web/src/components/RapportObjektVisning.tsx`):
- Read-only renderer for alle 23 rapportobjekttyper
- Rekursiv nesting med `TreObjekt`-interface (objekt + children)
- `data`-prop (`Record<string, { verdi?: unknown }>`) sendes ned rekursivt slik at barneobjekter henter sine verdier
- `FeltRad`-wrapper med label + verdi/tom-state
- Normaliserer opsjoner via `normaliserOpsjon()` fra `typer.ts`
- Bruker `formaterDato()` og `formaterDatoTid()` med `nb-NO`-locale
- Vedlegg (`attachments`): viser bilder i 2-kolonne rutenett med 5:4 aspect ratio, filer som tekstliste
- Ingen blå ramme for nestede barn — kun innrykk via marginKlasse

### Bildehåndtering

**Kameraflyt (mobil):** Kontinuerlig kameraflyt med lokal-first lagring:
- Kamera bruker `expo-camera` (`CameraView` + `takePictureAsync()`) — IKKE `expo-image-picker` — for å unngå iOS "Use Photo/Retake"-bekreftelsen
- Bilde tas → komprimeres → lagres lokalt → vises i filmrull med én gang → lastes opp i bakgrunnskø
- Opplasting blokkerer ALDRI UI — bilder vises fra lokal fil (`file://`) umiddelbart
- Bakgrunnskøen (`OpplastingsKoProvider`) laster opp til server og erstatter lokal URL med server-URL
- Bruker kan ta flere bilder raskt etter hverandre uten ventetid
- Annotering og sletting skjer via verktøylinje som vises når et bilde i filmrullen er valgt (trykk = blå ramme)
- Verktøylinje: [Slett] [Annoter] — Annoter kun for bilder, ikke filer
- `FeltDokumentasjon` er delt komponent brukt av `FeltWrapper` for ALLE utfyllbare rapportobjekter
- `FeltDokumentasjon` har `objektId`-prop (for bakgrunnskø) og `skjulKommentar`-prop (satt til `true` for `text_field`)
- **Web:** `FeltDokumentasjon` har to visninger — filmrull-thumbnails (72×72px, `print-skjul`) og print-versjon (`print-vedlegg-fullvisning`) med 5:4 bilder i 2-kolonne rutenett
- **Web:** `FeltDokumentasjon` har `prosjektId`-prop — når satt, vises «Tegning»-knapp (Map-ikon) ved siden av «Vedlegg»-knappen
- **Web:** `FeltWrapper` har valgfri `prosjektId`-prop som videresendes til `FeltDokumentasjon`

**Tegningsknapp (web):**
- Hvert utfyllbart felt i sjekkliste-utfylling har en «Tegning»-knapp som åpner `TegningsModal`
- `TegningsModal` (`apps/web/src/components/rapportobjekter/TegningsModal.tsx`): Modal med tegningsvelger (dropdown fra `trpc.tegning.hentForProsjekt`) + bildevisning + «Lagre som vedlegg»-knapp
- Canvas API fanger tegningsbildet som PNG → laster opp via `/api/trpc/../../../upload` → returnerer vedlegg via callback
- Krever `prosjektId` for å hente tegninger — `FeltWrapper` sender dette fra sjekkliste-detaljsiden (`params.prosjektId`)
- Bruker `crossOrigin="anonymous"` på `<img>` for å unngå tainted canvas ved Canvas API-eksport
- `Modal` fra `@siteflow/ui` med `max-w-2xl` for bredere visning

**Modal tekstredigering (mobil):**
- Alle tekstfelt i sjekkliste-utfylling bruker tappbar visning → fullskjerm modal med "Ferdig"-knapp
- `TekstfeltObjekt` — hovedverdi redigeres i modal (Pressable → Modal med blå header, label, autoFocus TextInput)
- `FeltDokumentasjon` kommentarfelt — redigeres i modal (samme mønster: Pressable → Modal med "Kommentar"-header)
- Modal bruker `SafeAreaView` + `KeyboardAvoidingView` (iOS padding) slik at tastaturet aldri dekker innholdet
- Lokal state under redigering — verdien lagres først når "Ferdig" trykkes

**Vedlegg-tidsstempel (print):**
- `Vedlegg`-interfacet har `opprettet?: string` (ISO 8601) — settes ved oppretting i FeltDokumentasjon (mobil + web) og TegningsModal
- Tidsstempelet vises under hvert bilde i ALLE print-varianter: FeltDokumentasjon print-versjon, RapportObjektVisning (attachments), og FeltVedlegg i utskrift-siden
- Format: `nb-NO` locale via `toLocaleString()`, 10px grå tekst under bildet
- Eksisterende vedlegg uten `opprettet` viser ingenting (bakoverkompatibelt)

**Filmrull (vedlegg-visning):**
- Horisontal `ScrollView` med 72×72px thumbnails (IKKE `FlatList` — unngår VirtualizedList-nesting i ScrollView)
- Vedlegg-URL-er kan være lokale (`file://`, `/var/`) eller server-relative (`/uploads/...`)
- Lokale filer vises direkte, server-relative prefikses med `AUTH_CONFIG.apiUrl`
- Bakgrunnskøen erstatter automatisk lokal URL med server-URL etter vellykket opplasting
- URL-logikk: `file://` / `/var/` → lokal | `/uploads/...` → `apiUrl + url` | annet → direkte

**Auto-lagring og datapersistering (SQLite-first):**
- `useSjekklisteSkjema` bruker SQLite som primær lagring — data skrives lokalt først, deretter synkroniseres til server
- Auto-lagring med 2s debounce for ALLE endringer: `oppdaterFelt`, `leggTilVedlegg`, `fjernVedlegg`
- `feltVerdierRef` brukes for å unngå stale closure i `lagreIntern` — sender alltid nyeste data
- `lagreStatus`: `"idle"` → `"lagret"` (lokal SQLite OK) → `"idle"` (2s) — aldri "lagrer" for lokal lagring
- `synkStatus`: `"synkronisert"` | `"lokalt_lagret"` | `"synkroniserer"` — sporer server-synk separat
- Initialisering: SQLite leses først (<10ms), usynkronisert lokal data prioriteres over server-data
- Nettverksovergang: når nett kommer tilbake, synkes usynkronisert data automatisk til server
- Header-ikoner: opplastingskø (gul spinner + antall), synkstatus (sky/offline-sky), lagrestatus (hake/advarsel)
- Tilbakeknapp lagrer automatisk uten bekreftelsesdialog
- Data bevares ved krasj/restart — SQLite er persistent

**Rekursiv synlighet og nesting (mobil):**
- `erSynlig(objekt)` i `useSjekklisteSkjema` er rekursiv — sjekker hele foreldrekjeden opp til rot
- Bruker `parentId` fra DB-kolonne med fallback til `config.conditionParentId` (bakoverkompatibilitet)
- `RapportObjekt` interface har `parentId: string | null`
- `FeltWrapper` har `nestingNivå: number` prop for gradert innrykk: 0=ingen, 1=`ml-4`, 2=`ml-8`, 3+=`ml-12`
- `erBetinget` prop er deprecated — bruk `nestingNivå` for nye kall
- Nesting-nivå beregnes rekursivt i sjekkliste-skjermen via `hentNestingNivå()`
- Blå venstre-kant fjernet fra utfylling og print — kun i malbyggeren

**Bildeannotering (Fabric.js):**
- `BildeAnnotering`-komponenten bruker WebView med Fabric.js canvas for å tegne på bilder
- HTML/JS-koden ligger i `apps/mobile/src/assets/annoterings-html.ts`
- Verktøy: pil, sirkel, firkant, frihåndstegning, tekst
- Tekststyling: `fontSize: 24`, `fontWeight: 'bold'`, rød fyll (`#ef4444`), hvit omriss (`stroke: '#ffffff'`, `strokeWidth: 3`, `paintFirst: 'stroke'`)
- Kommunikasjon: React Native → WebView via `postMessage`, WebView → RN via `ReactNativeWebView.postMessage`
- **Canvas-resize:** Når bilde lastes inn, resizes canvas til bildets skalerte dimensjoner (ikke hele skjermen) — bevarer 5:4 aspect ratio og fjerner svarte kanter
- **Eksport:** `lagre()` bruker `multiplier` (original bredde / canvas bredde) for å eksportere i full originaloppløsning
- Server-URL-er (`/uploads/...` eller `http://...`) MÅ lastes ned til lokal fil (`FileSystem.downloadAsync`) før base64-konvertering — `FileSystem.readAsStringAsync` feiler stille på server-URL-er

**Server-URL-håndtering (mobil):**
- Relative server-URL-er (`/uploads/...`) MÅ prefikses med `AUTH_CONFIG.apiUrl` for WebView, Image og FileSystem-operasjoner
- URL-logikk: `file://` / `/var/` → lokal | `/uploads/...` → `AUTH_CONFIG.apiUrl + url` | `http(s)://` → direkte
- Gjelder: `TegningsVisning`, `TegningsSkjermbilde`, `BildeAnnotering`, `FeltDokumentasjon` filmrull

**Komprimering (`komprimer()` i `apps/mobile/src/services/bilde.ts`):**
1. 5:4 senter-crop (bredde:høyde = 1.25) — `beregnCropAction()` beregner crop basert på dimensjoner
2. Maks 1920px bredde (resize)
3. Iterativ kvalitetsjustering til 300–400 KB
4. GPS-tag legges til hvis aktivert
5. Lagres lokalt via `lokalBilde.ts` (persistent `documentDirectory`), synkroniseres til S3 via bakgrunnskø

**Kamerazoom (`KameraModal`):**
- `zoom`-prop på `CameraView` (0–1, logaritmisk)
- Tre zoomknapper over utløserknappen: `0.5x` (zoom=0), `1x` (zoom=0.05), `3x` (zoom=0.15)
- Aktiv knapp: hvit bakgrunn med mørk tekst, inaktive: gjennomsiktig med hvit tekst
- Resettes til 0 ved lukking

**5:4 crop-guide (`KameraModal`):**
- Visuell guide som viser nøyaktig hva som ender opp i det endelige bildet
- Halvgjennomsiktige svarte felt (50% opacity) topp/bunn (portrett) eller justert for landskapsformat
- Tynne hvite guidelinjer (40% opacity) langs crop-kantene
- Beregnes dynamisk via `onLayout` — tilpasser seg orientering
- `pointerEvents="none"` slik at overlayet ikke blokkerer kamerainteraksjon

**Sensor-basert UI-rotasjon (`KameraModal`):**
- Akselerometer (`expo-sensors`) detekterer telefonens fysiske orientering
- Kun UI-elementer (lukk-knapp, bildeteller, zoom-piller) roterer med `Animated.spring` — skjermen forblir i portrett
- Samme tilnærming som iOS' innebygde kamera-app — ingen native orientasjonsendring, ingen krasj
- Terskelverdi 0.55 for å unngå flimring mellom orienteringer
- Akselerometer lyttes kun når kameraet er åpent (cleanup i useEffect)
- `expo-screen-orientation` fungerer IKKE med Modal + CameraView i Expo Go — forårsaker krasj

**Tidtaker (`KameraModal`):**
- Lang-trykk (0.6s) på utløserknappen aktiverer/deaktiverer 2-sekunders tidtaker
- Utløserknappen blir gul + timer-ikon med "2s" under når aktiv
- Ved trykk med aktiv tidtaker: stor nedtelling (2, 1) vises midt på kameraet, deretter tas bildet
- Nyttig for vanskelige vinkler der det er vanskelig å holde telefonen og nå utløserknappen samtidig
- Ryddes opp ved lukking og ved `synlig`-endring

**Viktig:** `InteractionManager.runAfterInteractions` MÅ brukes etter at kamera/picker lukkes, før state-oppdateringer, for å unngå React Navigation "Cannot read property 'stale' of undefined"-krasj.

### React Native-mønstre (mobil)

**Modal-rendering:** Render ALLTID `<Modal>` i komponenttreet med `visible`-prop — ALDRI bruk `{betingelse && <Modal visible>}`. Conditional mounting forårsaker animasjonsfrys (svart skjerm) i React Native.

**SafeAreaView i Modals:** Bruk `SafeAreaView` fra `react-native` (IKKE `react-native-safe-area-context`) inne i Modals, da `SafeAreaProvider` kanskje ikke er i det native view-hierarkiet.

**React Query cache-invalidering:** Invalider query-cache etter mutasjoner for å unngå stale data ved re-navigasjon: `utils.sjekkliste.hentMedId.invalidate({ id })` etter `oppdaterData`-mutasjon.

### Offline-first (SQLite lokal database)

Mobil-appen bruker SQLite (expo-sqlite + Drizzle ORM) for lokal-first lagring. Filer i `apps/mobile/src/db/`:

**SQLite-tabeller:**

| Tabell | Kolonner | Formål |
|--------|----------|--------|
| `sjekkliste_feltdata` | `id`, `sjekklisteId`, `feltVerdier` (JSON), `erSynkronisert`, `sistEndretLokalt`, `sistSynkronisert` | Lokal kopi av sjekkliste-utfylling |
| `oppgave_feltdata` | `id`, `oppgaveId`, `feltVerdier` (JSON), `erSynkronisert`, `sistEndretLokalt`, `sistSynkronisert` | Lokal kopi av oppgave-utfylling |
| `opplastings_ko` | `id`, `sjekklisteId` (nullable), `oppgaveId` (nullable), `objektId`, `vedleggId`, `lokalSti`, `filnavn`, `mimeType`, `filstorrelse`, GPS-felter, `status`, `forsok`, `serverUrl`, `feilmelding`, `opprettet` | Bakgrunnskø for filopplasting (sjekklister + oppgaver) |

**Lagringsstrategi:**
- All data skrives til SQLite først (instant, <10ms), deretter synkroniseres til server
- `erSynkronisert`-flagg sporer om lokal data er synkronisert med server
- Ved initialisering: SQLite leses først — usynkronisert lokal data prioriteres over server-data
- Konflikthåndtering: last-write-wins med `sistEndretLokalt`-tidsstempel

**Bakgrunnskø (OpplastingsKoProvider):**
- Bilder lagres lokalt (`documentDirectory/siteflow-bilder/`) og legges i opplastingskø
- Køen prosesserer én fil av gangen med eksponentiell backoff (maks 5 forsøk, maks 30s ventetid)
- Ved suksess: server-URL erstatter lokal URL i feltdata, lokal fil slettes
- Ved nettverksovergang: køen starter automatisk når nett kommer tilbake
- Ved krasj: `status = "laster_opp"` resettes til `"venter"` ved app-oppstart
- Callback-system: `registrerCallback()` lar `useSjekklisteSkjema` og `useOppgaveSkjema` lytte på URL-oppdateringer i sanntid
- Generalisert for sjekklister og oppgaver: `dokumentType` (`"sjekkliste"` | `"oppgave"`) identifiserer kilde i callback

**Provider-hierarki:**
```
DatabaseProvider → trpc.Provider → QueryClientProvider → NettverkProvider → OpplastingsKoProvider → AuthProvider → ProsjektProvider
```
`DatabaseProvider` kjører migreringer og opprydding ved oppstart, blokkerer rendering til databasen er klar.

**Opprydding:**
- Fullførte køoppføringer slettes ved app-oppstart
- Foreldreløse lokale bilder (uten køoppføring) slettes i bakgrunnen
- `ryddOppForProsjekt(sjekklisteIder, oppgaveIder)` sletter feltdata og køoppføringer for avsluttede prosjekter (både sjekklister og oppgaver)

**expo-file-system:** Bruk `expo-file-system/legacy`-importen (IKKE `expo-file-system`) for å få tilgang til `documentDirectory`, `cacheDirectory` osv.

## Web UI-arkitektur

Dalux-inspirert tre-kolonne layout:

```
+----------------------------------------------------------+
| TOPPBAR: [SiteFlow] [Prosjektvelger v]     [Bruker v]    |
+------+------------------+--------------------------------+
| IKON | SEKUNDÆRT PANEL  | HOVEDINNHOLD                   |
| 60px | 280px            | Verktøylinje: [Opprett] [...]  |
|      | - Filtre         |                                |
| Dash | - Statusgrupper  | Tabell / Detaljvisning         |
| Sjekk| - Søk            |                                |
| Oppg |                  |                                |
| Maler|                  |                                |
| Tegn |                  |                                |
| Entr |                  |                                |
| Mapp |                  |                                |
|      |                  |                                |
| Opps |                  |                                |
+------+------------------+--------------------------------+
```

### Ruter

```
/                                             -> Landingsside med OAuth-innlogging
/logg-inn                                     -> Google + Microsoft Entra ID innlogging
/aksepter-invitasjon?token=...                -> Aksepter prosjektinvitasjon (Server Component)
/utskrift/sjekkliste/[sjekklisteId]           -> PDF-forhåndsvisning (ren A4, utenfor dashbord-layout)
/dashbord                                     -> Dashbord (prosjektliste)
/dashbord/[prosjektId]                        -> Prosjektoversikt
/dashbord/[prosjektId]/sjekklister            -> Sjekkliste-tabell
/dashbord/[prosjektId]/sjekklister/[id]       -> Sjekkliste-detalj (utfylling + print)
/dashbord/[prosjektId]/oppgaver               -> Oppgave-tabell
/dashbord/[prosjektId]/maler                  -> Mal-liste
/dashbord/[prosjektId]/maler/[id]             -> Mal-detalj / malbygger
/dashbord/[prosjektId]/entrepriser            -> Entreprise-liste
/dashbord/[prosjektId]/mapper                 -> Mapper (read-only dokumentvisning, ?mappe=id)
/dashbord/[prosjektId]/tegninger              -> Interaktiv tegningsvisning: klikk for å opprette oppgave/sjekkliste, røde markører for eksisterende oppgaver. Opprett-modal med tilgangsbasert malfiltrering: admin→alle, entreprise→workflow+HMS, domene-grupper→matchende domain
/dashbord/oppsett                             -> Innstillinger (redirect til brukere)
/dashbord/oppsett/brukere                     -> Brukergrupper, roller, medlemmer
/dashbord/oppsett/lokasjoner                  -> Lokasjonsoversikt
/dashbord/oppsett/lokasjoner                  -> Samlet lokasjonsliste med redigering og georeferanse
/dashbord/oppsett/field                       -> Field-oversikt (kategorikort)
/dashbord/oppsett/field/entrepriser           -> Entrepriser med arbeidsforløp
/dashbord/oppsett/field/oppgavemaler          -> Oppgavemaler (filtrert malliste)
/dashbord/oppsett/field/sjekklistemaler       -> Sjekklistemaler (filtrert malliste)
/dashbord/oppsett/field/box                   -> Mappeoppsett (filstruktur/mappestruktur)
/dashbord/oppsett/field/kontrollplaner        -> Kontrollplaner (kommer)
/dashbord/oppsett/prosjektoppsett             -> Prosjektoppsett (navn, status, adresse, eksternt prosjektnummer)
```

**Legacy-ruter** (gamle flat-navigasjonsruter, fases ut):
```
/dashbord/prosjekter                          -> Prosjektliste
/dashbord/prosjekter/nytt                     -> Opprett prosjekt
/dashbord/prosjekter/[id]                     -> Prosjektdetalj med tabs
/dashbord/prosjekter/[id]/entrepriser         -> Entrepriser
/dashbord/prosjekter/[id]/maler               -> Maler
/dashbord/prosjekter/[id]/maler/[malId]       -> Malbygger
/dashbord/prosjekter/[id]/sjekklister         -> Sjekklister
/dashbord/prosjekter/[id]/sjekklister/[id]    -> Sjekkliste-detalj
/dashbord/prosjekter/[id]/oppgaver            -> Oppgaver
```

### Kontekster og hooks

- `ProsjektKontekst` — Valgt prosjekt synkronisert med URL-parameter `[prosjektId]`, alle prosjekter, loading-state
- `BygningKontekst` — Aktiv bygning (`id`, `name`, `number`) + to tegning-states: `standardTegning` (persistent default, localStorage, stjerne-ikon) og `aktivTegning` (visning, endres ved klikk). `useBygning()` hook. Standard-tegning brukes som forhåndsvalg ved opprettelse av sjekklister/oppgaver (IKKE filtrering). Aktiv tegning brukes på tegningssiden for visning. Posisjonsvelger: `startPosisjonsvelger(feltId)` → `fullførPosisjonsvelger(resultat)` → `hentOgTømPosisjonsResultat(feltId)` — state-basert cross-page kommunikasjon for `drawing_position`-felt
- `NavigasjonKontekst` — Aktiv seksjon + kontekstuelle verktøylinje-handlinger
- `useAktivSeksjon()` — Utleder aktiv seksjon fra pathname, oppdaterer NavigasjonKontekst
- `useVerktoylinje(handlinger)` — Registrerer kontekstuelle handlinger per side med auto-cleanup
- `useAutoVaer({ prosjektId, alleObjekter, hentFeltVerdi, settVerdi })` — Auto-henter værdata fra Open-Meteo når sjekklisten har vær-felt + dato-felt + prosjektkoordinater

### Layout-komponenter

- `Toppbar` — Mørk blå bar med logo, prosjektvelger (dropdown med søk), brukermeny med utlogging
- `HovedSidebar` — 60px ikonbar med Tooltip, deaktiverte ikoner uten valgt prosjekt. Seksjoner: Dashbord, Sjekklister, Oppgaver, Maler (krever `manage_field`-tillatelse), Tegninger, Entrepriser, Mapper (bunn: Oppsett)
- `SekundaertPanel` — 280px panel med seksjonsspesifikt innhold (filtre, lister, søk)
- `Verktoylinje` — Kontekstuell handlingsbar, registreres via `useVerktoylinje`
- `ProsjektVelger` — Dropdown med søk på prosjektnavn og prosjektnummer

### Paneler (SekundaertPanel-innhold)

- `DashbordPanel` — Prosjektliste med hurtignavigasjon og søk
- `SjekklisterPanel` — Sjekklister med statusgruppe-filtrering, viser aktiv standard-tegning som synlig badge (forhåndsvalg, ikke filter)
- `OppgaverPanel` — Oppgaver med status- og prioritetsgrupper
- `MalerPanel` — Malliste med søk
- `EntrepriserPanel` — Entrepriseliste med søk
- `TegningerPanel` — Bygning+tegningstrevisning med etasje-gruppering (Utomhus/etasjer), søk, utvid/kollaps, aktiv bygning (blå), aktiv tegning (blå markering), standard-tegning (gul stjerne). Klikk på tegning = vis den (aktivTegning), klikk på stjerne = sett/fjern standard (standardTegning). Tegninger vises med nummer og fagdisiplin-badge. Setter `aktivBygning`, `aktivTegning` og `standardTegning` via BygningKontekst
- `MapperPanel` — Klikkbar mappestruktur med søk, valgt mappe markeres blå, navigerer via URL-param `?mappe=id`

### Mer-meny

**Web** (`[prosjektId]/page.tsx`): ⋮-knapp (MoreVertical) øverst til høyre ved prosjektnavnet. Dropdown med:
- **Prosjektinnstillinger** — navigerer til `/dashbord/oppsett`, deaktivert for ikke-admin (`disabled:opacity-40`)
- **Skriv ut** — `window.print()`
- **Eksporter** — placeholder (TODO)

Admin-sjekk via `prosjekt.members` matchet mot `session.user.email`.

**Mobil** (`app/(tabs)/mer.tsx`): Mer-fanen med to seksjoner:
- **Prosjekt** — Prosjektinnstillinger (deaktivert + alert for ikke-admin), Skriv ut, Eksporter
- **Generelt** — Kontakter, Grupper, Forbered til offline, Skann QR-kode

Admin-sjekk via `trpc.medlem.hentForProsjekt` matchet mot `bruker.email`.

## Pakker

### @siteflow/ui — UI-komponentbibliotek

14 delte React-komponenter i `packages/ui/src/`:

| Komponent | Beskrivelse |
|-----------|-------------|
| `Button` | Knapp med varianter (primary, secondary, danger, ghost), størrelser (sm, md, lg), loading-state |
| `Input` | Tekstinput med label og feilmelding |
| `Textarea` | Flerlinjet tekstfelt med label og feilmelding |
| `Select` | Dropdown med options-array, label og placeholder |
| `Card` | Kort-wrapper med valgfri padding |
| `Badge` | Merkelapp med varianter (default, primary, success, warning, danger) |
| `StatusBadge` | Statusmerkelapp som mapper dokumentstatus til norsk tekst og farge |
| `Spinner` | Animert lastespinner (sm, md, lg) |
| `Modal` | Dialog med HTML `<dialog>`, tittel, lukk-knapp |
| `EmptyState` | Tom tilstand med tittel, beskrivelse og valgfri handling |
| `Tooltip` | CSS tooltip med side-plassering (right/bottom) |
| `SidebarIkon` | Ikonknapp med aktiv-markering og tooltip |
| `Table<T>` | Generisk tabell med kolonnedefinisjoner, radklikk, tom-melding |
| `SearchInput` | Søkefelt med innebygd søkeikon |

### @siteflow/shared — Delte typer, validering og utils

Tre eksportpunkter: `types`, `validation`, `utils`

**Typer** (`packages/shared/src/types/`):
- `DocumentStatus` — 9 statusverdier for sjekklister/oppgaver (draft, sent, received, in_progress, responded, approved, rejected, closed, cancelled)
- `ReportObjectType` — 23 rapportobjekttyper
- `ReportObjectCategory` — 7 kategorier (tekst, valg, tall, dato, person, fil, spesial)
- `REPORT_OBJECT_TYPE_META` — Komplett metadata for alle 23 typer med label, ikon, kategori, standardkonfig
- `TegningPosisjonVerdi` — Interface for tegningsposisjon: `{ drawingId, positionX, positionY, drawingName }`
- `VaerVerdi` — Interface for vær: `{ temp?, conditions?, wind?, kilde?: "manuell" | "automatisk" }`
- `BuildingType` — `"bygg"` | `"anlegg"`, `BUILDING_TYPES` konstantarray
- `GeoReferansePunkt` — Interface: `{ pixel: { x, y }, gps: { lat, lng } }`
- `GeoReferanse` — Interface: `{ point1: GeoReferansePunkt, point2: GeoReferansePunkt }`
- `TemplateZone` — Malsoner: `topptekst` | `datafelter`
- `EnterpriseRole` — `creator` | `responder`
- `GroupCategory` — 3 gruppekategorier (`generelt`, `field`, `brukergrupper`)
- `StandardProjectGroup` — Interface for standardgrupper med slug, navn, kategori, tillatelser, fagområder (`domains`)
- `STANDARD_PROJECT_GROUPS` — Konstantarray med 4 standardgrupper (inkl. `domains`-felt)
- `PERMISSIONS` — Konstantarray: `["manage_field", "create_tasks", "create_checklists", "view_field"]`, `Permission` type
- `DOMAINS` — Konstantarray: `["bygg", "hms", "kvalitet"]`, `Domain` type
- `DOMAIN_LABELS` — Record som mapper domain til norsk label: `{ bygg: "Bygg", hms: "HMS", kvalitet: "Kvalitet" }`
- `CONTAINER_TYPES` — Kontainertyper som kan ha barn: `["list_single", "list_multi", "repeater"]`
- `FOLDER_ACCESS_MODES` — `["inherit", "custom"]`, `FolderAccessMode` type
- `FOLDER_ACCESS_TYPES` — `["enterprise", "group", "user"]`, `FolderAccessType` type
- `TreObjekt` — Interface for rekursivt objekttre (id, type, label, parentId, children)
- `erKontainerType(type)` — Sjekker om en type kan ha barnefelt
- `harForelderObjekt(obj)` — Sjekker `obj.parentId != null`
- `byggObjektTre(objekter)` — Bygger tre fra flat array basert på `parentId`
- `harBetingelse(config)` — **Deprecated**: sjekker gammel `conditionParentId` i config
- `erBetingelseKvalifisert(type)` — **Deprecated**: bruk `erKontainerType()`
- `BaseEntity`, `GpsData`, `SyncableEntity` — Grunnleggende interfaces

**Valideringsschemaer** (`packages/shared/src/validation/`):
- `documentStatusSchema` — Enum for dokumentstatus
- `reportObjectTypeSchema` — Enum for rapportobjekttyper
- `enterpriseRoleSchema` — Enum for entrepriserolle
- `templateZoneSchema` — Enum for malsoner
- `templateCategorySchema` — Enum for `oppgave` | `sjekkliste`
- `templateDomainSchema` — Enum for `"bygg"` | `"hms"` | `"kvalitet"`
- `gpsDataSchema` — GPS med lat/lng-grenser
- `createProjectSchema` — Prosjektopprettelse (navn, beskrivelse, adresse, latitude, longitude, externalProjectNumber)
- `createEnterpriseSchema` — Entrepriseopprettelse (navn, prosjektId, org.nr)
- `buildingTypeSchema` — Zod enum for `"bygg"` | `"anlegg"`
- `geoReferanseSchema` — Zod-skjema for GeoReferanse med 2 referansepunkter (pixel + GPS)
- `createBuildingSchema` — Bygningsopprettelse (navn, prosjektId, beskrivelse, adresse, type)
- `createWorkflowSchema` — Arbeidsforløp (enterpriseId, responderEnterpriseId, navn, malIder)
- `updateWorkflowSchema` — Arbeidsforløp-oppdatering (id, responderEnterpriseId, navn, malIder)
- `addMemberSchema` — Legg til medlem (prosjektId, e-post, rolle, entrepriseId)
- `drawingDisciplineSchema` — Fagdisiplin-enum (ARK, LARK, RIB, RIV, RIE, RIG, RIBr, RIAku)
- `drawingTypeSchema` — Tegningstype-enum (plan, snitt, fasade, detalj, oversikt, skjema, montering)
- `drawingStatusSchema` — Tegningstatus-enum (utkast, delt, under_behandling, godkjent, for_bygging, som_bygget)
- `createDrawingSchema` — Tegningsopprettelse (alle metadatafelter)
- `groupCategorySchema` — Gruppekategori-enum (generelt, field, brukergrupper)
- `createProjectGroupSchema` — Prosjektgruppe-opprettelse (prosjektId, navn, slug, kategori)
- `updateProjectGroupSchema` — Prosjektgruppe-oppdatering (id, navn)
- `addGroupMemberByEmailSchema` — Legg til gruppemedlem via e-post (groupId, prosjektId, e-post, fornavn, etternavn, telefon)
- `settMappeTilgangSchema` — Sett mappeadgangskontroll (folderId, accessMode, entries med accessType/enterpriseId/groupId/userId)

**Konstanter og typer:**
- `DRAWING_DISCIPLINES`, `DRAWING_TYPES`, `DRAWING_STATUSES` — Konstantarrayer
- `DrawingDiscipline`, `DrawingType`, `DrawingStatus` — TypeScript-typer
- `GROUP_CATEGORIES` — Konstantarray for gruppekategorier

**Utilities** (`packages/shared/src/utils/`):
- `generateProjectNumber(sekvens)` — Format: `SF-YYYYMMDD-XXXX`
- `isValidStatusTransition(current, next)` — Validerer lovlige statusoverganger
- `vaerkodeTilTekst(code)` — WMO-værkode → norsk tekst (Klart, Overskyet, Lett regn, osv.)
- `beregnSynligeMapper(mapper, bruker)` — Beregner synlige mapper basert på tilgangsregler med arv. Returnerer `{ synlige: Set<string>, kunSti: Set<string> }`. Admin ser alt, `inherit` gir arv oppover, `custom` sjekker entreprise/gruppe/bruker-match
- `beregnTransformasjon(ref: GeoReferanse)` — Beregner similaritetstransformasjon fra 2 referansepunkter → `Transformasjon { a, b, c, d }`
- `gpsTilTegning(gps, transformasjon)` — GPS → tegningsposisjon (prosent 0-100, clampet)
- `tegningTilGps(pixel, transformasjon)` — Tegningsposisjon → GPS
- `erInnenforTegning(gps, transformasjon, margin?)` — Sjekker om GPS-posisjon er innenfor tegningens dekningsområde
- `utm33TilLatLng(nord, ost)` — Konverterer UTM sone 33N (EUREF89/Norgeskart) til WGS84 lat/lng (i `GeoReferanseEditor.tsx`)
- `parserKoordinater(tekst)` — Parser koordinater fra UTM33 (`Nord 7731109 Øst 652332`), DMS (`69°38'39.9"N 18°55'24.2"E`) og desimal (`69.644, 18.923`) (i `GeoReferanseEditor.tsx`)

## Kodestil

- TypeScript strict mode, ingen `any`
- Named exports, ikke default exports (unntak: Next.js pages/layouts)
- Zod-validering på alle API-endepunkter og skjemadata
- Prisma for server-side DB, Drizzle for lokal SQLite
- Alle API-ruter i `apps/api/src/routes/`
- Alle Expo-skjermer i `apps/mobile/src/screens/`
- Layout-komponenter i `apps/web/src/components/layout/`
- Seksjonspaneler i `apps/web/src/components/paneler/`
- Kontekster i `apps/web/src/kontekst/`
- Hooks i `apps/web/src/hooks/`
- Delte UI-komponenter i `packages/ui/src/`
- Delte typer i `packages/shared/src/types/`

### ESLint

Hele monorepoet bruker ESLint v8 med `.eslintrc.json` (legacy-format). Web bruker `next lint` med `eslint-config-next@14`.

**Konfigurasjon:** Root `.eslintrc.json` med `@typescript-eslint/recommended`. Regler:
- `@typescript-eslint/no-unused-vars`: `error` med `argsIgnorePattern: "^_"` og `varsIgnorePattern: "^_"` — prefiks ubrukte variabler med `_`
- `@typescript-eslint/no-explicit-any`: `error`
- `prefer-const`: `error`

**Viktig:**
- ESLint v8 brukes konsekvent — IKKE oppgrader til v9/v10 (krever flat config-migrering)
- `eslint-config-next` MÅ matche Next.js-versjonen (v14 → `eslint-config-next@14`)
- `react-hooks/exhaustive-deps`-pluginen er ikke konfigurert i web — bruk generisk `// eslint-disable-next-line` ved behov
- Ubrukte destrukturerte verdier: bruk `_`-prefiks (f.eks. `{ conditionActive: _conditionActive, ...rest }`)
- Ikon-props i layout-komponenter: bruk `JSX.Element` (ikke `React.ReactNode`) for å unngå dual `@types/react`-kollisjon mellom web (v18) og mobile (v19)

### TypeScript-mønstre

- **tRPC mutation-callbacks:** Bruk `_data: unknown, variabler: { id: string }` for å unngå TS2589 (excessively deep type instantiation)
- **Prisma-migreringer:** Bruk prosjektets lokale Prisma (`pnpm --filter @siteflow/db exec prisma migrate dev`), IKKE global `npx prisma` (versjonskonflikter med Prisma 7)
- **MalRad-type:** Cast `alleMaler as MalRad[]` ved filtrering siden tRPC-inferens kan bli for dyp
- **Ikon-typer:** Bruk `JSX.Element` for ikon-props i interfaces, ikke `React.ReactNode` (unngår `@types/react` v18/v19-kollisjon i monorepoet)

## Terminologi

- **Entreprise:** Kontrakt/arbeidspakke utført av en entreprenør/UE i et prosjekt. Dalux-format: `NUMMER Navn, Firma` (f.eks. "04 Tømrer, Econor"). Felter: `enterpriseNumber`, `name`, `industry` (fra `ENTERPRISE_INDUSTRIES` enum), `companyName`, `color`
- **Oppretter (creator):** Entreprisen som initierer en sjekkliste/oppgave
- **Svarer (responder):** Entreprisen som mottar og besvarer
- **UE:** Underentreprenør
- **Sjekkliste:** Strukturert dokument med objekter som fylles ut
- **Oppgave:** Enkeltstående arbeidsoppgave med ansvarlig og frist
- **Tegning:** Prosjekttegning (PDF/DWG) med versjonering
- **Rapportobjekt:** Byggeblokk i en mal (23 typer)
- **Mal (template):** Gjenbrukbar oppskrift for sjekklister/rapporter bygget med drag-and-drop, med prefiks og versjon
- **Arbeidsforløp (workflow):** Navngitt kobling mellom en oppretter-entreprise, valgfri svarer-entreprise, og et sett maler (oppgave-/sjekklistetyper)
- **Mapper (Mappeoppsett):** Filstruktur/dokumenthåndteringsmodul med rekursiv mappestruktur og tilgangskontroll. To visninger: (1) HovedSidebar → `/dashbord/[prosjektId]/mapper` — read-only dokumentvisning med tilgangsfiltrering (velg mappe i panel, se dokumenter i hovedinnhold), (2) Innstillinger > Field > Mappeoppsett (`/dashbord/oppsett/field/box`) — redigering av mappestruktur (opprett, gi nytt navn, slett, rediger tilgang)
- **Mappeadgangskontroll:** Fleksibel tilgangsstyring per mappe med arv. `accessMode: "inherit"` arver fra overordnet mappe (rotmappe med inherit = åpen for alle), `accessMode: "custom"` bruker en tilgangsliste med entrepriser, grupper og/eller brukere. `beregnSynligeMapper()` beregner synlige mapper klient-side. Admin ser alltid alt. Foreldre-mapper til synlige barn vises som "kun sti" (grå, lås-ikon, uten innholdstilgang)
- **Lokasjon:** Bygning/anlegg i et prosjekt (Building-modellen), med tilknyttede tegninger og publiseringsstatus. Én samlet liste i web og mobil — ingen tabs/kategorikort. Opprettelse åpner redigeringsvisningen direkte. `building.type` er deprecated (beholdt for bakoverkompatibilitet)
- **Utomhus-tegning:** Tegning med `geoReference` (georeferert). Vises i "Utomhus"-gruppen i tegningslisten. GPS auto-plassering i mobilappen. Viser brukerens GPS-posisjon som blå prikk (Google Maps-stil) via `watchPositionAsync` (3s/2m intervall). Admin kalibrerer med GeoReferanseEditor i redigeringsvisningen
- **Etasje-tegning:** Tegning uten `geoReference`. Grupperes etter `floor`-feltet. Manuell trykk-plassering i mobilappen
- **Georeferanse:** Kalibrering av en tegning med 2 referansepunkter (pixel ↔ GPS). Lagres som `geoReference` JSON på Drawing-modellen. Brukes til automatisk markørplassering fra GPS i mobilappen. Format: `{ point1: { pixel: {x,y}, gps: {lat,lng} }, point2: ... }`. GeoReferanseEditor-komponenten har zoom/pan-navigering (håndverktøy, +/- knapper, musehjul med zoom-mot-markør) og støtter koordinat-innliming fra Norgeskart (UTM33 EUREF89), Google Maps (DMS) og desimalformat. PDF-tegninger har permanent overlay som fanger alle events — viewport fyller `calc(100vh - 350px)` med `scrolling="no"` på iframe. Markører rendres utenfor transformert div for konstant størrelse (12px prikker). Bruker `transformOrigin: 0 0` for enkel koordinatmatematikk: `vx = lx * zoom + pan.x`, `lx = (vx - pan.x) / zoom`. Wheel-zoom bruker native `addEventListener` med `{ passive: false }` for å garantere `preventDefault()`. Zoom-knapper zoomer mot synlig senter. Drag-deteksjon via `harDratt`-ref forhindrer utilsiktet punktplassering etter panoring
- **Similaritetstransformasjon:** 2D-transformasjon (skalering + rotasjon + translasjon) som mapper mellom tegningskoordinater (prosent 0-100) og GPS-koordinater. Beregnes fra 2 referansepunkter via `beregnTransformasjon()` i `@siteflow/shared`
- **Prosjektnummer:** Unikt, autogenerert nummer på format `SF-YYYYMMDD-XXXX`
- **Prefiks:** Kort kode for en mal (f.eks. BHO, S-BET, KBO)
- **Invitasjon (ProjectInvitation):** E-postinvitasjon til et prosjekt med unik token, utløpsdato og status (pending/accepted/expired)
- **Prosjektgruppe (ProjectGroup):** Navngitt gruppe med kategori, tillatelser, fagområder (`domains`) og valgfri entreprise-tilknytning (`groupEnterprises`). Brukes for rollestyring (f.eks. Field-admin, HMS-ledere). Grupper uten entrepriser gir tverrgående tilgang til sine fagområder
- **Fagområde (domain):** Klassifisering av maler som `"bygg"`, `"hms"` eller `"kvalitet"`. Styrer hvem som ser dokumenter basert på gruppemedlemskap. Definert i `@siteflow/shared` som `DOMAINS`
- **Tverrgående tilgang:** Gruppe uten entrepriser ser ALLE dokumenter med matchende fagområde, uavhengig av oppretter/svarer-entreprise. F.eks. HMS-gruppen ser alle HMS-sjekklister
- **GroupEnterprise:** Mange-til-mange kobling mellom `ProjectGroup` og `Enterprise`. Begrenser gruppens tilgang til kun dokumenter der tilknyttede entrepriser er oppretter/svarer
- **Tillatelse (Permission):** Rettighet tildelt via prosjektgrupper: `manage_field`, `create_tasks`, `create_checklists`, `view_field`. Admin har alle tillatelser implisitt
- **Tegningsmarkør:** Posisjon (0–100% X/Y) på en tegning der en oppgave er opprettet fra mobilappen
- **Enkeltvalg (`list_single`):** Rapportobjekt der brukeren velger én verdi. Web: `<select>` nedtrekksmeny (kompakt). Mobil: radioknapper. Kan brukes som kontainer med betingelse.
- **Flervalg (`list_multi`):** Rapportobjekt der brukeren kan velge flere verdier. Web: dropdown med avkrysning, valgte vises som horisontale chips med ×-knapp. Mobil: avkrysningsbokser. Kan brukes som kontainer med betingelse.
- **Kontainer:** Et Enkeltvalg-, Flervalg- eller Repeater-felt som kan inneholde barnefelt. Enkeltvalg/Flervalg krever `conditionActive: true` for å akseptere barn (betingelsesbasert synlighet). Repeater aksepterer alltid barn uten betingelse — barna rendres som dupliserbare rader. Kontainere kan nestes rekursivt (eske-i-eske-prinsippet).
- **Betingelse:** Logikk på en kontainer som styrer synligheten av barnefelt. Defineres av `conditionValues` (trigger-verdier) i config. Når brukerens valg matcher en trigger-verdi, vises barnefeltene.
- **Eske-i-eske:** Metafor for rekursiv nesting — en kontainer kan inneholde andre kontainere med egne betingelser og barn, i ubegrenset dybde.
- **Repeater (kontainer):** `repeater`-feltet bruker `parentId`-systemet for barnefelt (som `list_single`/`list_multi`). I utfylling rendres barna som dupliserbare rader med `RepeaterObjekt`-komponenten. Verdi-formatet er `Array<Record<feltId, FeltVerdi>>` der hver rad inneholder verdier for alle barnefeltene. Barnefelt hoppes over i hoved-render-loopen og rendres i stedet inne i `RepeaterObjekt`. `barneObjekter`-prop på `RapportObjektProps` sender barneobjektene til RepeaterObjekt. Print-rendering via `RapportObjektVisning` bruker `objekt.children` fra `byggObjektTre()`. Kompakt visning: rad-header viser «1 Label, 2 Label, …» (repeaterens label med stigende nummer). Barnefelt rendres uten FeltWrapper/label — kun `RapportObjektRenderer` + `FeltDokumentasjon` direkte. Rad-container: `rounded border px-3 py-2`, gap `1.5` mellom rader.
- **Flerforetagsbruker:** Bruker som tilhører flere entrepriser i samme prosjekt. Koblet via `MemberEnterprise` join-tabell. Ved opprettelse av sjekklister/oppgaver velger brukeren hvilken entreprise de handler på vegne av.
- **Prosjektlokasjon:** Valgfri GPS-koordinater (`latitude`/`longitude`) på prosjektet. Settes via kartvelger i prosjektinnstillinger. Brukes til kartvisning i `LokasjonObjekt` og automatisk værhenting.
- **Lokasjon (`location`):** Display-only rapportobjekt som viser prosjektets posisjon på kart (web) eller med kart-lenke (mobil). Krever ingen brukerinndata.
- **Posisjon i tegning (`drawing_position`):** Rapportobjekt der brukeren velger en tegning og markerer en posisjon (0–100% X/Y). Config-filtre: `buildingFilter`, `disciplineFilter`.
- **Automatisk værhenting:** Sjekklister med vær-felt og dato-felt auto-henter værdata fra Open-Meteo basert på prosjektkoordinater. Kilde-sporing: `"automatisk"` (fra API) eller `"manuell"` (bruker-overstyrt).
- **WMO-værkode:** Internasjonal standard (WMO Code Table 4677) for å beskrive værforhold som tall. Konverteres til norsk tekst via `vaerkodeTilTekst()`.
- **Eksternt prosjektnummer:** Valgfritt felt (`externalProjectNumber`) på Project-modellen for kundens eller byggeherrens prosjektreferanse. Redigerbar i prosjektinnstillinger, vises i print-header.
- **Firmalogo:** Valgfritt felt (`logoUrl`) på Project-modellen for prosjektets firmalogo. Lastes opp via prosjektoppsett, vises i print-header øverst til venstre. URL lagres som `/uploads/{uuid}.ext`.
- **Print-til-PDF:** Utskriftsstøtte på sjekkliste-detaljsiden via `@media print` CSS. Print-header med prosjektinfo, oppretter/svarer og værdata vises kun ved utskrift. Nettleserens "Lagre som PDF" brukes.

## Språk

- All kode, kommentarer, UI-tekst, dokumentasjon og commit-meldinger skal skrives på **norsk bokmål** (IKKE nynorsk)
- Variabelnavn og tekniske identifikatorer kan være på engelsk der det er naturlig (f.eks. `id`, `status`, `config`)
- Brukervendt tekst (knapper, labels, feilmeldinger, hjelpetekst) skal ALLTID være på norsk
- Bruk alltid norske tegn (æ, ø, å) i all UI-tekst, kommentarer og strenger — ALDRI ASCII-erstatninger (aa, oe, ae)

## Fargepalett

Mobilappen skal bruke samme fargepalett som web-appen. Primærfargen er SiteFlow-blå (`#1e40af`), brukt i toppbar, aktive elementer og knapper. Fargene er definert i Tailwind-konfigurasjon:

| Farge | Hex | Bruk |
|-------|-----|------|
| `siteflow-primary` / `siteflow-blue` | `#1e40af` | Primærfarge (toppbar, aktive ikoner, knapper) |
| `siteflow-secondary` / `siteflow-blue-light` | `#3b82f6` | Sekundær blå (lenker, hover) |
| `siteflow-accent` | `#f59e0b` | Aksent (varsler, markering) |
| `siteflow-success` | `#10b981` | Suksess (godkjent, ferdig) |
| `siteflow-error` | `#ef4444` | Feil (avvist, slett) |

Bruk den blå primærfargen (`#1e40af`) konsekvent på tvers av web og mobil for et enhetlig utseende.

## Viktige regler

- ALDRI commit `.env`-filer
- Bilder skal ALLTID komprimeres før opplasting (mål 300–400 KB)
- Alle database-endringer via Prisma-migreringer, aldri manuell SQL
- Entreprisevelger-objektet MÅ ha rolle-konfigurasjon (`creator` eller `responder`)
- GPS-tagging er på som standard, men må kunne deaktiveres per objekt
- Prosjektnummer må være unike og genereres automatisk
- Alle API-endepunkter må ha Zod-validering og auth-middleware
- Mobil-appen må fungere fullt offline — test alltid med flymodus
- Alle delte typer, schemaer og utils skal ligge i `@siteflow/shared` (viktig for mobilapp-gjenbruk)
- Statusoverganger valideres via `isValidStatusTransition()` — bruk samme logikk på server og klient
- E-postsending (Resend) er valgfri — API-en starter uten `RESEND_API_KEY`, feiler først ved faktisk sending
- Invitasjons-e-post sendes i try/catch — feil blokkerer ikke brukeropprettelsen
- **Auto-commit:** Når en endring er ferdig implementert, commit og push automatisk uten å vente på at brukeren ber om det
- **Auto-oppdater CLAUDE.md:** Etter hver vesentlig endring, oppdater CLAUDE.md med nye komponenter, API-prosedyrer, mønstre eller arkitekturbeslutninger som en del av committen
