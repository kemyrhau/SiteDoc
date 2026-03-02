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
| `report_objects` | Rapportobjekter i maler (21 typer, JSON-konfig) |
| `checklists` | Sjekklister med oppretter/svarer-entreprise, status, data (JSON) |
| `tasks` | Oppgaver med prioritet, frist, oppretter/svarer, valgfri tegningsposisjon |
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
```

### Entrepriseflyt

Sentral forretningslogikk. Dokumenter (sjekklister/oppgaver) flyter mellom entrepriser:

- Oppretter-entreprise initierer og godkjenner/avviser
- Svar-entreprise mottar, fyller ut og besvarer
- Alle overganger logges i `document_transfers`

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

### Oppgave fra tegning (mobil)

Brukeren kan opprette oppgaver direkte fra tegningsvisningen i Lokasjoner-taben:
- Trykk på tegningen plasserer en markør og åpner OppgaveModal
- Oppgaven lagres med `drawingId`, `positionX` og `positionY` (prosent 0-100)
- Task-modellen har valgfrie felter: `drawingId`, `positionX`, `positionY`
- Implementert for iOS/web. Android-tilpasning gjøres ved behov.

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

**Kameraflyt (mobil):** Kontinuerlig kameraflyt uten avbrytende dialoger:
- Kamera bruker `expo-camera` (`CameraView` + `takePictureAsync()`) — IKKE `expo-image-picker` — for å unngå iOS "Use Photo/Retake"-bekreftelsen
- Bilde tas → komprimeres → lastes opp → vises i horisontal filmrull med én gang (ingen Alert-dialoger)
- Bruker kan ta flere bilder raskt etter hverandre
- Annotering og sletting skjer via verktøylinje som vises når et bilde i filmrullen er valgt (trykk = blå ramme)
- Verktøylinje: [Slett] [Annoter] — Annoter kun for bilder, ikke filer
- `FeltDokumentasjon` er delt komponent brukt av `FeltWrapper` for ALLE utfyllbare rapportobjekter
- `FeltDokumentasjon` har `skjulKommentar`-prop — satt til `true` for `text_field`-typen (som har eget modal tekstfelt)

**Modal tekstredigering (mobil):**
- Alle tekstfelt i sjekkliste-utfylling bruker tappbar visning → fullskjerm modal med "Ferdig"-knapp
- `TekstfeltObjekt` — hovedverdi redigeres i modal (Pressable → Modal med blå header, label, autoFocus TextInput)
- `FeltDokumentasjon` kommentarfelt — redigeres i modal (samme mønster: Pressable → Modal med "Kommentar"-header)
- Modal bruker `SafeAreaView` + `KeyboardAvoidingView` (iOS padding) slik at tastaturet aldri dekker innholdet
- Lokal state under redigering — verdien lagres først når "Ferdig" trykkes

**Filmrull (vedlegg-visning):**
- Horisontal `ScrollView` med 72×72px thumbnails (IKKE `FlatList` — unngår VirtualizedList-nesting i ScrollView)
- Vedlegg-URL-er fra server er relative (`/uploads/...`) — må prefikses med `AUTH_CONFIG.apiUrl` for visning i React Native Image
- Lokale bilder bruker `file://`-URI direkte

**Komprimering:**
1. Maks 1920px bredde
2. Iterativ kvalitetsjustering til 300–400 KB
3. GPS-tag legges til hvis aktivert
4. Lagres lokalt i SQLite, synkroniseres til S3

**Viktig:** `InteractionManager.runAfterInteractions` MÅ brukes etter at kamera/picker lukkes, før state-oppdateringer, for å unngå React Navigation "Cannot read property 'stale' of undefined"-krasj.

### Offline-first

Mobil-appen bruker SQLite lokalt. All data skrives lokalt først, synkroniseres med server når nett er tilgjengelig. Bruk `is_synced`-flagg på alle tabeller. Konflikthåndtering: last-write-wins med tidsstempel.

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

### TypeScript-mønstre

- **tRPC mutation-callbacks:** Bruk `_data: unknown, variabler: { id: string }` for å unngå TS2589 (excessively deep type instantiation)
- **Prisma-migreringer:** Bruk prosjektets lokale Prisma (`pnpm --filter @siteflow/db exec prisma migrate dev`), IKKE global `npx prisma` (versjonskonflikter med Prisma 7)
- **MalRad-type:** Cast `alleMaler as MalRad[]` ved filtrering siden tRPC-inferens kan bli for dyp

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
