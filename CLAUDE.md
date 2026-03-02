# SiteFlow

Rapport- og kvalitetsstyringssystem for byggeprosjekter. Flerplattform (PC, mobil, nettbrett) med offline-støtte, bildekomprimering, GPS-tagging og entreprisearbeidsflyt.

## Tech Stack

- **Monorepo:** Turborepo med pnpm workspaces
- **Frontend web:** Next.js 14+ (App Router), React, TypeScript
- **Frontend mobil:** React Native, Expo (SDK 52+)
- **Backend API:** Node.js, Fastify, tRPC
- **Database (server):** PostgreSQL med Prisma ORM (v6.19)
- **Database (lokal):** SQLite via expo-sqlite, Drizzle ORM
- **Fillagring:** S3-kompatibel (AWS S3 / Cloudflare R2 / MinIO)
- **Auth:** Auth.js v5 (next-auth) med Google og Microsoft Entra ID (Office 365), PrismaAdapter, database-sesjoner, `allowDangerousEmailAccountLinking` for inviterte brukere
- **E-post:** Resend (invitasjons-e-poster ved brukeropprettelse)
- **Bildekomprimering:** expo-image-manipulator (mål: 300–400 KB)
- **GPS:** expo-location (deaktiverbar per objekt)
- **PDF-eksport:** react-pdf
- **Styling:** Tailwind CSS (web), NativeWind (mobil)
- **Drag-and-drop:** dnd-kit (malbygger på PC)
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
│   │       │       │   └── tegninger/        # Tegninger (med layout + panel)
│   │       │       ├── oppsett/              # Innstillinger
│   │       │       │   ├── layout.tsx        # Innstillings-sidebar med navigasjon
│   │       │       │   ├── brukere/          # Brukergrupper, roller, legg til medlemmer
│   │       │       │   ├── lokasjoner/       # Lokasjonsoversikt + bygninger
│   │       │       │   ├── field/            # Field-innstillinger
│   │       │       │   │   ├── page.tsx      # Field-oversikt (kategorikort)
│   │       │       │   │   ├── entrepriser/  # Entrepriser med arbeidsforløp
│   │       │       │   │   ├── oppgavemaler/ # Oppgavemaler (filtrert malliste)
│   │       │       │   │   ├── sjekklistemaler/ # Sjekklistemaler (filtrert malliste)
│   │       │       │   │   ├── _components/  # Delt MalListe-komponent
│   │       │       │   │   ├── box/          # Box (filstruktur/dokumenthåndtering)
│   │       │       │   │   └── kontrollplaner/ # Kontrollplaner (kommer)
│   │       │       │   ├── prosjektoppsett/  # Prosjektoppsett (navn, status, adresse)
│   │       │       │   └── eierportal-brukere/ # Owners Portal brukere
│   │       │       └── prosjekter/           # LEGACY: Gamle flat-navigasjonsruter
│   │       │           ├── page.tsx          # Prosjektliste (gammel)
│   │       │           ├── nytt/             # Opprett prosjekt (gammel)
│   │       │           └── [id]/             # Prosjektdetalj med tabs (gammel)
│   │       ├── components/
│   │       │   ├── Toppmeny.tsx              # LEGACY: Gammel toppmeny
│   │       │   ├── layout/                   # Toppbar, HovedSidebar, SekundaertPanel, Verktoylinje, ProsjektVelger
│   │       │   └── paneler/                  # Seksjonspaneler (Dashbord, Sjekklister, Oppgaver, Maler, Entrepriser, Tegninger)
│   │       ├── kontekst/                     # ProsjektKontekst, NavigasjonKontekst
│   │       ├── hooks/                        # useAktivSeksjon, useVerktoylinje
│   │       ├── lib/
│   │       │   └── trpc.ts                   # tRPC-klient med React-Query (httpBatchLink → /api/trpc)
│   │       └── auth.ts                       # Auth.js konfigurasjon
│   ├── mobile/           # Expo React Native app
│   │   └── src/
│   │       ├── db/                           # SQLite lokal database (Drizzle ORM)
│   │       │   ├── schema.ts                 # Drizzle-skjema (sjekkliste_feltdata, opplastings_ko)
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
- `pnpm dev --filter mobile` — Kun mobil (Expo)
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
| `projects` | Prosjekter med prosjektnummer (SF-YYYYMMDD-XXXX), status |
| `project_members` | Prosjektmedlemmer med rolle (member/admin) og valgfri entreprisetilknytning |
| `enterprises` | Entrepriser/kontrakter per prosjekt |
| `buildings` | Bygninger med status (unpublished/published) |
| `drawings` | Tegninger med metadata: tegningsnummer, fagdisiplin, revisjon, status, etasje, målestokk, opphav |
| `drawing_revisions` | Revisjonshistorikk for tegninger med fil, status og hvem som lastet opp |
| `report_templates` | Maler med category (oppgave/sjekkliste), prefix, versjon |
| `report_objects` | Rapportobjekter i maler (21 typer, JSON-konfig), rekursiv nesting via `parent_id` |
| `checklists` | Sjekklister med oppretter/svarer-entreprise, status, data (JSON) |
| `tasks` | Oppgaver med mal-tilknytning (`template_id`), prefiks+løpenummer (`number`), prioritet, frist, oppretter/svarer, utfylt data (JSON), valgfri tegningsposisjon og sjekkliste-kobling (`checklist_id`, `checklist_field_id`) |
| `document_transfers` | Sporbarhet: all sending mellom entrepriser |
| `images` | Bilder med valgfri GPS-data |
| `folders` | Rekursiv mappestruktur (Box-modul) med parent_id |
| `documents` | Dokumenter i mapper med fil-URL og versjon |
| `workflows` | Arbeidsforløp med oppretter-entreprise og valgfri svarer-entreprise (`responder_enterprise_id`) |
| `workflow_templates` | Kobling mellom arbeidsforløp og maler (mange-til-mange) |
| `project_invitations` | E-postinvitasjoner med token, status (pending/accepted/expired), utløpsdato |

Viktige relasjoner:
- Sjekklister og oppgaver har ALLTID `creator_enterprise_id` (oppretter) og `responder_enterprise_id` (svarer)
- `document_transfers` logger all sending mellom entrepriser med full sporbarhet
- Bilder har valgfri GPS-data (`gps_lat`, `gps_lng`, `gps_enabled`)
- Oppgaver kan kobles til en tegning med posisjon (`drawing_id`, `position_x`, `position_y`) — brukes for markør-plassering på tegninger
- `workflows` tilhører en oppretter-entreprise (`enterpriseId`) med valgfri svarer-entreprise (`responderEnterpriseId`), kobler til maler via `workflow_templates`. Relasjoner er navngitte: `WorkflowCreator` / `WorkflowResponder`
- `report_objects` bruker selvrefererande relasjon (`parent_id`) for rekursiv nesting — kontainerfelt (`list_single`/`list_multi`) kan ha barnefelt som selv kan være kontainere (Dalux-stil), CASCADE-sletting av barn
- `report_templates` har `category` (`oppgave` | `sjekkliste`) og valgfritt `prefix`
- `buildings` tilhører et prosjekt, med tegninger koblet via `building_id`
- `drawings` har full metadata (tegningsnummer, fagdisiplin, revisjon, etasje, målestokk, status) med `drawing_revisions` for historikk
- `folders` bruker selvrefererande relasjon (`parent_id`) for mappetreet i Box
- `project_invitations` kobles til project, enterprise (valgfri), group (valgfri) og invitedBy (User)

### API-routere (tRPC)

Alle routere i `apps/api/src/routes/`:

| Router | Prosedyrer |
|--------|-----------|
| `prosjekt` | hentAlle, hentMedId, opprett, oppdater |
| `entreprise` | hentForProsjekt, hentMedId, opprett, oppdater, slett |
| `sjekkliste` | hentForProsjekt (m/statusfilter), hentMedId, opprett, oppdaterData, endreStatus |
| `oppgave` | hentForProsjekt (m/statusfilter), hentMedId, opprett (m/tegningsposisjon), oppdater, endreStatus |
| `mal` | hentForProsjekt, hentMedId, opprett, oppdaterMal, slettMal, leggTilObjekt, oppdaterObjekt, oppdaterRekkefølge, slettObjekt |
| `bygning` | hentForProsjekt, hentMedId, opprett, oppdater, publiser, slett |
| `tegning` | hentForProsjekt (m/filtre), hentForBygning, hentMedId, opprett, oppdater, lastOppRevisjon, hentRevisjoner, tilknyttBygning, slett |
| `arbeidsforlop` | hentForProsjekt, hentForEnterprise, opprett, oppdater, slett |
| `mappe` | hentForProsjekt, opprett, oppdater, slett |
| `medlem` | hentForProsjekt, leggTil (m/invitasjon), fjern, oppdaterRolle, sokBrukere |
| `gruppe` | hentForProsjekt, opprettStandardgrupper, opprett, oppdater, slett, leggTilMedlem (m/invitasjon), fjernMedlem |
| `invitasjon` | hentForProsjekt, validerToken, aksepter, sendPaNytt, trekkTilbake |

**Auth-nivåer:** `publicProcedure` (åpen) og `protectedProcedure` (krever autentisert userId i context). Context bygges i `context.ts` som verifiserer Auth.js-sesjonstokens.

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

### Statusendring (mobil)

Sjekkliste-detaljskjermen (`apps/mobile/app/sjekkliste/[id].tsx`) har kontekstuelle statusknapper i bunnpanelet, over lagre-knappen. Knappene viser neste gyldige handling basert på nåværende status:

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
- Bruker `trpc.sjekkliste.endreStatus.useMutation()` med `senderId` fra `useAuth().bruker.id`
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
- Tittel settes automatisk til prosjektnavn ved opprettelse fra mobil

### Prosjektgrupper

Prosjektgrupper kategoriserer brukere med tilhørende tillatelser. Gruppekategorier: `generelt`, `field`, `brukergrupper`.

**Standardgrupper** (opprettes automatisk via seed/`opprettStandardgrupper`):
- **Field-administratorer** (`field-admin`) — `manage_field`, `create_tasks`, `create_checklists`
- **Oppgave- og sjekklistekoordinatorer** (`oppgave-sjekkliste-koord`) — `create_tasks`, `create_checklists`
- **Field-observatorer** (`field-observatorer`) — `view_field`
- **HMS-ledere** (`hms-ledere`) — `create_tasks`, `create_checklists`

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

### TODO
- Nedtrekksmeny for å velge eksisterende prosjektmedlemmer i brukergrupper (erstatt e-postfelt)
- Oppgave-fra-tegning: Android-tilpasning for tegningstrykk (iOS/web implementert)
- Kvalitetssikring av alle 21 rapportobjekttyper (mobil-renderere)
- Oppgave-fra-felt i sjekkliste-utfylling (knapp per rapportobjekt + visning av oppgavenummer)
- Oppgave-utfylling med maler (tilsvarende sjekkliste-utfylling, med samme 21 rapportobjekttyper)
- Databasemigrering: nye felter på Task-modellen (`number`, `templateId`, `data`, `checklistId`, `checklistFieldId`)
- Adgangskontroll: Field-admin kan sende kryssentreprise, brukergruppe-brukere kun til eget arbeidsforløp
- Videresending av sjekklister/oppgaver til annen entreprise (svarer og oppretter)
- Flerforetagsbrukere: velg entreprise å sende fra ved opprettelse

### Oppgave fra tegning (mobil)

Brukeren kan opprette oppgaver direkte fra tegningsvisningen i Lokasjoner-taben:
- Trykk på tegningen plasserer en markør og åpner OppgaveModal
- Oppgaven lagres med `drawingId`, `positionX` og `positionY` (prosent 0-100)
- Task-modellen har valgfrie felter: `drawingId`, `positionX`, `positionY`
- Implementert for iOS/web. Android-tilpasning gjøres ved behov.

### Oppgavesystem

Oppgaver bruker samme malsystem som sjekklister. Oppgavemaler bygges i malbyggeren på PC med `report_templates` der `category: "oppgave"` — alle 21 rapportobjekttyper er tilgjengelige.

**Oppgavenummerering:**
- Format: `mal.prefix + "-" + løpenummer` (f.eks. `BHO-001`, `S-BET-042`)
- Løpenummer auto-genereres per prosjekt (inkrementelt)
- Oppgavenummeret vises i oppgavelisten og i sjekklistefeltet der oppgaven ble opprettet

**Oppgave fra sjekklistefelt:**
- Hvert rapportobjekt (utfyllbart felt) i sjekkliste-utfyllingen kan opprette en oppgave
- Oppgavenummeret (med prefiks) vises nederst i feltet etter opprettelse
- Koblingen lagres via `checklistId` og `checklistFieldId` på Task-modellen

**Opprettelsespunkter:**
- Fra sjekklistefelt (med sporbarhet til sjekkliste og felt)
- Fra tegninger (med markørposisjon)
- Fra oppgavelisten (frittstående)

**Planlagte databaseendringer på Task-modellen:**

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `number` | Int | Løpenummer per prosjekt (auto-generert) |
| `templateId` | String (valgfri) | Kobling til oppgavemal (`report_templates`) |
| `data` | Json | Utfylte rapportobjekter (likt `checklists.data`) |
| `checklistId` | String (valgfri) | Sporbarhet til sjekkliste oppgaven ble opprettet fra |
| `checklistFieldId` | String (valgfri) | Sporbarhet til spesifikt felt i sjekklisten |

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

### Rapportobjekter (21 typer)

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
| `traffic_light` | valg | Trafikklys (rød/gul/grønn) |
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
| `repeater` | spesial | Repeterende seksjon |

Hvert objekt har metadata (`REPORT_OBJECT_TYPE_META`) med label, ikon, kategori og standardkonfigurasjon. Objektkonfigurasjon lagres som JSON i `report_objects.config`.

### Malbygger (PC)

Drag-and-drop-editor for å bygge maler med rekursiv kontainer-nesting (Dalux-stil). Komponenter i `apps/web/src/components/malbygger/`:

| Komponent | Beskrivelse |
|-----------|-------------|
| `MalBygger` | Hovedkomponent: tre-kolonne layout (FeltPalett, DropSoner, FeltKonfigurasjon), bygger tre fra flat array |
| `FeltPalett` | Venstre panel med draggbare felttyper (21 typer) |
| `DropSone` | Droppbar sone (topptekst/datafelter) med rekursiv `RekursivtFelt`-rendering |
| `DraggbartFelt` | Individuelt sorterbart felt med `nestingNivå`, `parentId` og `children`-prop for inline barn |
| `FeltKonfigurasjon` | Høyre panel for å redigere valgt felts label, påkrevd-status og type-spesifikk config |
| `DragOverlay_` | Visuell overlay under drag-operasjoner |
| `BetingelseBjelke` | Blå betingelsesbar inne i kontainerfelt: "Vis felter hvis verdien er en av følgende: [chips]" |
| `TreprikkMeny` | Kontekstmeny per felt: Rediger, Tilføy/Fjern betingelse, Slett |
| `typer.ts` | `TreObjekt` interface (MalObjekt + children) |

**Rekursiv kontainer-nesting (Dalux-stil):**
- Kontainertyper: `list_single` og `list_multi` (sjekkes med `erKontainerType()`)
- Forelder-barn-relasjon via `report_objects.parent_id` DB-kolonne (ikke config JSON)
- Betingelse aktiveres på kontainerfelt: `conditionActive: true`, `conditionValues: string[]` i config
- Barn knyttes via `parentId` på ReportObject — ubegrenset nesting-dybde
- Visuelt: blå ramme (`border-l-2 border-blue-400 bg-blue-50/30`) rundt barnegrupper
- "Dra og slipp felter her"-placeholder i tomme barnegrupper per nesting-nivå
- Rekursiv `RekursivtFelt`-komponent i DropSone rendrer barn inline med BetingelseBjelke
- Dra-og-slipp: felt arver `parentId` ved drop i kontainer, nullstilles ved drag ut
- Sletting av kontainerfelt kaskaderer via DB CASCADE — barn slettes automatisk
- Trebygging: flat array → tre med `byggTre()` i MalBygger, splittes i topptekst/datafelter
- `harForelderObjekt(obj)` fra `@siteflow/shared` sjekker `obj.parentId != null`
- `harBetingelse(config)` er deprecated — bruk `harForelderObjekt()` for nye kall

### Innstillings-sidebar

Sidebaren under `/dashbord/oppsett/` er organisert i seksjoner:
- **Brukere** — Brukergrupper, rollestyring, legg til medlemmer (med bruker-søk)
- **Lokasjoner** — Bygninger (med publisering/status)
- **Field** — Entrepriser (med arbeidsforløp), Oppgavemaler, Sjekklistemaler, Kontrollplan, Box
- **Owners Portal** — Eierportalens brukere, Prosjektoppsett

### Malliste-UI (Dalux-inspirert)

Oppgavemaler og Sjekklistemaler deler `MalListe`-komponenten med:
- **Verktøylinje:** +Tilføy (dropdown: Opprett ny, Importer fra prosjekt/firma/PDF), Rediger, Slett, Mer, Søk
- **Tabell:** Navn (med ikon), Prefiks, Versjon — sortert alfabetisk
- **Radvalg:** Enkeltklikk velger (aktiverer Rediger/Slett), dobbeltklikk åpner malbygger
- **Opprett-modal:** Navn, Prefiks, Beskrivelse
- **Bunnlinje:** Låsefunksjon for maler

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

**Modal tekstredigering (mobil):**
- Alle tekstfelt i sjekkliste-utfylling bruker tappbar visning → fullskjerm modal med "Ferdig"-knapp
- `TekstfeltObjekt` — hovedverdi redigeres i modal (Pressable → Modal med blå header, label, autoFocus TextInput)
- `FeltDokumentasjon` kommentarfelt — redigeres i modal (samme mønster: Pressable → Modal med "Kommentar"-header)
- Modal bruker `SafeAreaView` + `KeyboardAvoidingView` (iOS padding) slik at tastaturet aldri dekker innholdet
- Lokal state under redigering — verdien lagres først når "Ferdig" trykkes

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
- Alle nivåer viser blå venstre-kant (`border-l-2 border-l-blue-300`)

**Bildeannotering (Fabric.js):**
- `BildeAnnotering`-komponenten bruker WebView med Fabric.js canvas for å tegne på bilder
- HTML/JS-koden ligger i `apps/mobile/src/assets/annoterings-html.ts`
- Verktøy: pil, sirkel, firkant, frihåndstegning, tekst
- Tekststyling: `fontSize: 24`, `fontWeight: 'bold'`, rød fyll (`#ef4444`), hvit omriss (`stroke: '#ffffff'`, `strokeWidth: 3`, `paintFirst: 'stroke'`)
- Kommunikasjon: React Native → WebView via `postMessage`, WebView → RN via `ReactNativeWebView.postMessage`
- Server-URL-er (`/uploads/...` eller `http://...`) MÅ lastes ned til lokal fil (`FileSystem.downloadAsync`) før base64-konvertering — `FileSystem.readAsStringAsync` feiler stille på server-URL-er

**Server-URL-håndtering (mobil):**
- Relative server-URL-er (`/uploads/...`) MÅ prefikses med `AUTH_CONFIG.apiUrl` for WebView, Image og FileSystem-operasjoner
- URL-logikk: `file://` / `/var/` → lokal | `/uploads/...` → `AUTH_CONFIG.apiUrl + url` | `http(s)://` → direkte
- Gjelder: `TegningsVisning`, `TegningsSkjermbilde`, `BildeAnnotering`, `FeltDokumentasjon` filmrull

**Komprimering:**
1. Maks 1920px bredde
2. Iterativ kvalitetsjustering til 300–400 KB
3. GPS-tag legges til hvis aktivert
4. Lagres lokalt via `lokalBilde.ts` (persistent `documentDirectory`), synkroniseres til S3 via bakgrunnskø

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
| `opplastings_ko` | `id`, `sjekklisteId`, `objektId`, `vedleggId`, `lokalSti`, `filnavn`, `mimeType`, `filstorrelse`, GPS-felter, `status`, `forsok`, `serverUrl`, `feilmelding`, `opprettet` | Bakgrunnskø for filopplasting |

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
- Callback-system: `registrerCallback()` lar `useSjekklisteSkjema` lytte på URL-oppdateringer i sanntid

**Provider-hierarki:**
```
DatabaseProvider → trpc.Provider → QueryClientProvider → NettverkProvider → OpplastingsKoProvider → AuthProvider → ProsjektProvider
```
`DatabaseProvider` kjører migreringer og opprydding ved oppstart, blokkerer rendering til databasen er klar.

**Opprydding:**
- Fullførte køoppføringer slettes ved app-oppstart
- Foreldreløse lokale bilder (uten køoppføring) slettes i bakgrunnen
- `ryddOppForProsjekt(sjekklisteIder)` sletter feltdata og køoppføringer for avsluttede prosjekter

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
|      |                  |                                |
| Opps |                  |                                |
| Hjelp|                  |                                |
+------+------------------+--------------------------------+
```

### Ruter

```
/                                             -> Landingsside med OAuth-innlogging
/logg-inn                                     -> Google + Microsoft Entra ID innlogging
/aksepter-invitasjon?token=...                -> Aksepter prosjektinvitasjon (Server Component)
/dashbord                                     -> Dashbord (prosjektliste)
/dashbord/[prosjektId]                        -> Prosjektoversikt
/dashbord/[prosjektId]/sjekklister            -> Sjekkliste-tabell
/dashbord/[prosjektId]/sjekklister/[id]       -> Sjekkliste-detalj
/dashbord/[prosjektId]/oppgaver               -> Oppgave-tabell
/dashbord/[prosjektId]/maler                  -> Mal-liste
/dashbord/[prosjektId]/maler/[id]             -> Mal-detalj / malbygger
/dashbord/[prosjektId]/entrepriser            -> Entreprise-liste
/dashbord/[prosjektId]/tegninger              -> Tegninger
/dashbord/oppsett                             -> Innstillinger (redirect til brukere)
/dashbord/oppsett/brukere                     -> Brukergrupper, roller, medlemmer
/dashbord/oppsett/lokasjoner                  -> Lokasjonsoversikt
/dashbord/oppsett/lokasjoner/bygninger        -> Bygningsliste med redigering
/dashbord/oppsett/field                       -> Field-oversikt (kategorikort)
/dashbord/oppsett/field/entrepriser           -> Entrepriser med arbeidsforløp
/dashbord/oppsett/field/oppgavemaler          -> Oppgavemaler (filtrert malliste)
/dashbord/oppsett/field/sjekklistemaler       -> Sjekklistemaler (filtrert malliste)
/dashbord/oppsett/field/box                   -> Box (filstruktur/mappestruktur)
/dashbord/oppsett/field/kontrollplaner        -> Kontrollplaner (kommer)
/dashbord/oppsett/prosjektoppsett             -> Prosjektoppsett (navn, status, adresse)
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
- `NavigasjonKontekst` — Aktiv seksjon + kontekstuelle verktøylinje-handlinger
- `useAktivSeksjon()` — Utleder aktiv seksjon fra pathname, oppdaterer NavigasjonKontekst
- `useVerktoylinje(handlinger)` — Registrerer kontekstuelle handlinger per side med auto-cleanup

### Layout-komponenter

- `Toppbar` — Mørk blå bar med logo, prosjektvelger (dropdown med søk), brukermeny med utlogging
- `HovedSidebar` — 60px ikonbar med Tooltip, deaktiverte ikoner uten valgt prosjekt
- `SekundaertPanel` — 280px panel med seksjonsspesifikt innhold (filtre, lister, søk)
- `Verktoylinje` — Kontekstuell handlingsbar, registreres via `useVerktoylinje`
- `ProsjektVelger` — Dropdown med søk på prosjektnavn og prosjektnummer

### Paneler (SekundaertPanel-innhold)

- `DashbordPanel` — Prosjektliste med hurtignavigasjon og søk
- `SjekklisterPanel` — Sjekklister med statusgruppe-filtrering
- `OppgaverPanel` — Oppgaver med status- og prioritetsgrupper
- `MalerPanel` — Malliste med søk
- `EntrepriserPanel` — Entrepriseliste med søk
- `TegningerPanel` — Tegninger (placeholder med søk)

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
- `DocumentStatus` — 8 statusverdier for sjekklister/oppgaver
- `ReportObjectType` — 21 rapportobjekttyper
- `ReportObjectCategory` — 7 kategorier (tekst, valg, tall, dato, person, fil, spesial)
- `REPORT_OBJECT_TYPE_META` — Komplett metadata for alle 21 typer med label, ikon, kategori, standardkonfig
- `TemplateZone` — Malsoner: `topptekst` | `datafelter`
- `EnterpriseRole` — `creator` | `responder`
- `GroupCategory` — 3 gruppekategorier (`generelt`, `field`, `brukergrupper`)
- `StandardProjectGroup` — Interface for standardgrupper med slug, navn, kategori, tillatelser
- `STANDARD_PROJECT_GROUPS` — Konstantarray med 4 standardgrupper
- `CONTAINER_TYPES` — Kontainertyper som kan ha barn: `["list_single", "list_multi"]`
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
- `gpsDataSchema` — GPS med lat/lng-grenser
- `createProjectSchema` — Prosjektopprettelse (navn, beskrivelse, adresse)
- `createEnterpriseSchema` — Entrepriseopprettelse (navn, prosjektId, org.nr)
- `createBuildingSchema` — Bygningsopprettelse (navn, prosjektId, beskrivelse, adresse)
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

**Konstanter og typer:**
- `DRAWING_DISCIPLINES`, `DRAWING_TYPES`, `DRAWING_STATUSES` — Konstantarrayer
- `DrawingDiscipline`, `DrawingType`, `DrawingStatus` — TypeScript-typer
- `GROUP_CATEGORIES` — Konstantarray for gruppekategorier

**Utilities** (`packages/shared/src/utils/`):
- `generateProjectNumber(sekvens)` — Format: `SF-YYYYMMDD-XXXX`
- `isValidStatusTransition(current, next)` — Validerer lovlige statusoverganger

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

- **Entreprise:** Kontrakt/arbeidspakke utført av en entreprenør/UE i et prosjekt
- **Oppretter (creator):** Entreprisen som initierer en sjekkliste/oppgave
- **Svarer (responder):** Entreprisen som mottar og besvarer
- **UE:** Underentreprenør
- **Sjekkliste:** Strukturert dokument med objekter som fylles ut
- **Oppgave:** Enkeltstående arbeidsoppgave med ansvarlig og frist
- **Tegning:** Prosjekttegning (PDF/DWG) med versjonering
- **Rapportobjekt:** Byggeblokk i en mal (21 typer)
- **Mal (template):** Gjenbrukbar oppskrift for sjekklister/rapporter bygget med drag-and-drop, med prefiks og versjon
- **Arbeidsforløp (workflow):** Navngitt kobling mellom en oppretter-entreprise, valgfri svarer-entreprise, og et sett maler (oppgave-/sjekklistetyper)
- **Box:** Filstruktur/dokumenthåndteringsmodul med rekursiv mappestruktur
- **Bygning:** Fysisk bygning i et prosjekt, med tilknyttede tegninger og publiseringsstatus
- **Prosjektnummer:** Unikt, autogenerert nummer på format `SF-YYYYMMDD-XXXX`
- **Prefiks:** Kort kode for en mal (f.eks. BHO, S-BET, KBO)
- **Invitasjon (ProjectInvitation):** E-postinvitasjon til et prosjekt med unik token, utløpsdato og status (pending/accepted/expired)
- **Prosjektgruppe (ProjectGroup):** Navngitt gruppe med kategori og tillatelser, brukes for rollestyring (f.eks. Field-admin, HMS-ledere)
- **Tegningsmarkør:** Posisjon (0–100% X/Y) på en tegning der en oppgave er opprettet fra mobilappen

## Språk

- All kode, kommentarer, UI-tekst, dokumentasjon og commit-meldinger skal skrives på **norsk**
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
