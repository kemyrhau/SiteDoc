# Opus QA-runde 2 — SiteDoc arkitektur-revisjon

**Dato:** 2026-04-25 (sent på kveld)
**Forutsetter:** Kenneths reviderte syntese-dokument («Arkitektur-revisjon etter Opus' QA + Kenneth-avklaringer») og Opus QA-runde 1 fra samme dato.
**Resulterer i:** [fase-0-beslutninger.md](fase-0-beslutninger.md) — 7 mikrobeslutninger godkjent og klare for koding.

---

**Verdict:** Revisjonen løser de 5 kritiske risikoene fra runde 1 godt. To-parallelle-sjekkliste-modellen er **renere enn én utvidet modell**. Men runde 2 avdekket **én vesentlig redundans**: `SiteDocMalverk` er det `BibliotekMal` allerede er. Hvis det kan utvides i stedet for nytt, sparer dere én tabell og én migrering.

---

## §6.1 — Verifisering av beslutninger mot kodebase

### Q1: Project.primaryOrganizationId — kan migreringen gjøres rent?

**Ja, men med 1 av 1 prosjekt i lokal-DB er dette ikke testet i skala.** Strategien:

- **Default:** `Project.primaryOrganizationId = OrganizationProject.organizationId` (eneste rad hvis kun én)
- **Fallback hvis ingen OrganizationProject:** `User.organizationId` til creator (`createdById`)
- **Edge case:** Standalone prosjekt uten organizationId og creator uten organisation → **må være nullable**

**Min anbefaling:** Gjør `primaryOrganizationId` **nullable**, ikke required. Standalone-prosjekter er gyldig permanent tilstand per CLAUDE.md (`Standalone (organizationId = null) — gyldig permanent tilstand, ikke en mangel`). Krav på primær-eier kolliderer med dette prinsippet.

**Spørsmålet om `OrganizationProject.erHovedeier`-flagg:** Redundant. `Project.primaryOrganizationId` er sannheten — `OrganizationProject` er m:n for ekstra firma-tilknytninger (partnerskap). Bruker du flagg får du dobbel sannhetskilde.

### Q2: Cross-package svake referanser — finnes det presedens?

**Ja, etablert mønster i hele db-maskin.** Bekreftet i `packages/db-maskin/prisma/schema.prisma`:

- `Equipment.ansvarligUserId` (String, weak FK)
- `EquipmentAssignment.userId`, `projectId`, `byggeplassId` (alle String)
- `ServiceRecord.utfortAv`, `registrertAvUserId`
- `Feilmelding.meldtAvUserId`, `lukketAvUserId`

Cross-package join skjer i `apps/api/src/routes/maskin/equipment.ts:34-46` med `prisma.user.findUnique({ id: userId })`.

**Konklusjon:** `EquipmentChecklist` med `utforerUserId String` følger eksisterende mønster — **ingen ny presedens kreves**. Men:

- **INGEN orphan-deteksjon eller cascade-håndtering ved User-sletting i dag.** Hvis User slettes, blir alle weak refs i db-maskin til orphan-strenger uten varsel.
- Dette er teknisk gjeld som ALLEREDE finnes — ikke noe revisjonen introduserer.

**Min anbefaling:** Aksepter mønsteret nå (Fase 0–6), men plasser «cross-schema orphan-håndtering» i backlog. Konkret tiltak: nightly cron som sjekker `Equipment.ansvarligUserId NOT IN (SELECT id FROM users)` og varsler.

### Q3: BibliotekMal — antall rader, NS 3420-andel

**Stort funn:** `BibliotekMal` er **allerede et globalt mal-bibliotek tilgjengelig for alle firma**. Den har:

- Hierarki: `BibliotekStandard → BibliotekKapittel → BibliotekMal`
- `malInnhold: Json` lagrer struktur
- `versjon`, `aktiv`, `prioritet` (1=grunnpakke, 2=utvidet, 3=spesialist)
- `ProsjektBibliotekValg` for å spore at firma har importert mal til prosjekt
- `bibliotek.importerMal()`-rute kopierer til `ReportTemplate + ReportObjects`

Seed-data inneholder NS 3420-K:2024 (4 kapitler: KA/KB/KC/KD, 6+ maler).

**Konsekvens for revisjonen:** `SiteDocMalverk` slik beskrevet i §3.3 er **konseptuelt det samme** som eksisterende `BibliotekMal`. Forskjellene er kun:
- Du vil ha flere kategorier enn NS 3420 (maskin, kontor)
- Du vil ha eksplisitt `domene`-felt
- Du vil ha `kobletTilModul`-felt

**Min sterke anbefaling:** Ikke lag ny tabell. Utvid `BibliotekMal` med:
```
+ kategori: String  // 'prosjekt-sjekkliste' | 'maskin-sjekkliste' | 'kontor-sjekkliste' | 'oppgave' | 'hms'
+ domene: String?   // 'ns3420' | 'maskin-vedlikehold' | 'kontor' | etc.
+ kobletTilModul: String?  // 'maskin' | 'mannskap' | null = kjerne
+ verifisert: Boolean  // kvalitetssikret av SiteDoc-team
```

Det er **6 grunner** til at utvidelse er bedre enn ny tabell:

1. **Eksisterende migreringssti** (`bibliotek.importerMal()` → `ReportTemplate`) — fungerer allerede
2. **Hierarkiet med Standard → Kapittel → Mal er allerede etablert** — bruk NS 3420-strukturen som referanse for andre standarder også
3. **`malInnhold` som jsonb** håndterer alle felt-typer — ingen begrensning
4. **`prioritet`-feltet** kan brukes til sortering på tvers av kategorier
5. **`ProsjektBibliotekValg`** er etablert sporing av hva som er importert hvor
6. **Mindre kognisjon for utviklere** — én tabell å lære, ikke to

**Caveat:** Hvis Kenneth har sterke pedagogiske grunner (Malverk = brand-navn, "biblioteket" føles teknisk), kan tabellen bytte navn til `SiteDocMalverk` med Prisma `@@map("bibliotek_mal")` — beste av begge verdener.

### Q4: prismaMaskin-context

**Etablert.** Linje 3 + 45 i `apps/api/src/trpc/context.ts`:
```typescript
import { prismaMaskin } from "@sitedoc/db-maskin"
return { prisma, prismaMaskin, req, res, userId }
```

`EquipmentChecklist` skal bruke samme context (`ctx.prismaMaskin.equipmentChecklist.findMany(...)`). Ingen ny infrastruktur kreves.

---

## §6.2 — Verifisering av arkitektur-konsistens

### Q1: To parallelle sjekkliste-systemer — UI-forvirring?

**Liten reell risiko, men én skarp kant.** Skillet er klart for de fleste tilfeller:
- Mekaniker går til `/maskin/[id]` → ser maskin-sjekklister
- Prosjektleder går til `/dashbord/[prosjektId]/sjekklister` → ser prosjekt-sjekklister

**Den skarpe kanten:** Maler-administrasjon. Hvis firma-admin skal vedlikeholde maler, må vedkommende vite *to* steder:
- `/oppsett/firma/maler` for prosjekt-mal-bibliotek (`OrganizationTemplate`)
- `/oppsett/firma/maskin-maler` for maskin-mal-bibliotek (`EquipmentChecklistTemplate`)

**Min anbefaling:** Ett firma-admin-dashboard `/oppsett/firma/maler` med tabs:
- «Prosjekt-maler» (NS 3420, KS, HMS)
- «Maskin-maler» (vedlikehold, EU-kontroll)
- «Kontor/verksted-maler» (hvis OrganizationChecklist bygges)

Bak kulissene er det fortsatt to parallelle systemer — UI samler dem. Lett å gjøre i frontend uten å bryte modell-isolasjonen.

### Q2: SiteDoc Malverk + BibliotekMal — bør slås sammen?

**Ja, slå sammen.** Begrunnelse i §6.1 Q3 over.

### Q3: ProjectMember-migrering med periode — bryter eksisterende queries?

**Ja, 9 funksjoner i `tilgangskontroll.ts` antar `medlem == aktiv`** (eksistens av rad). Spesifikt:
- `hentBrukerFaggruppeIder` (linje 18)
- `verifiserFaggruppeTilhorighet` (linje 78)
- `verifiserAdmin` (linje 108)
- `verifiserProsjektmedlem` (linje 140)
- `verifiserAdminEllerFirmaansvarlig` (linje 202)
- `verifiserDokumentTilgang` (linje 242)
- `verifiserFlytRolle` (linje 371)
- `byggTilgangsFilter` (linje 428)
- `hentBrukerTillatelser` (linje 540)

**Migreringsplan:**
1. Legg til `periodeSlutt: DateTime?` på `ProjectMember`
2. Lag helper `aktivMedlemFilter = { OR: [{ periodeSlutt: null }, { periodeSlutt: { gt: new Date() } }] }`
3. Refaktorer alle 9 funksjoner til å bruke filteret
4. Migrasjon: alle eksisterende rader får `periodeSlutt: null` (= aktive)

**Risiko:** Lav. Default-verdi gir ingen oppførselsendring. Men de 9 endringene må gjøres atomisk — kan ikke deployes halvveis.

### Q4: Andre eksisterende loan-pattern-modeller jeg har glemt?

Sjekket på nytt. Tre eksisterende koblingstabeller utover ProjectMember/EquipmentAssignment/ProsjektBibliotekValg:

- **`ProjectGroupMember`** — bruker → gruppe → prosjekt. Mangler periode.
- **`FaggruppeKobling`** (DokumentflytPart-koblinger) — bruker → faggruppe. Mangler periode.
- **`DokumentflytMedlem`** — faggruppe/bruker/gruppe → dokumentflyt. Mangler periode.

**Tre flere kandidater for samme migrering.** Ikke kritisk for Fase 0, men bør på listen som teknisk gjeld.

---

## §6.3 — Nye hull i revidert modell

### Q1: Modul-deaktivering — hva skjer med data?

**Eksisterende mønster: soft-delete via flag.** `ProjectModule.active: Boolean` (default true) eksisterer. Data bevares når modul deaktiveres. Dokumenter har egne `active`-flags (Psi.active, FtdDocument.isActive). Ingen cascade.

**Problem:** 5+ ruter sjekker `modul?.active` korrekt, men flere ruter (mal.ts, sjekkliste.ts) henter data uten modul-sjekk. Hvis Maskin-modulen deaktiveres for et firma:
- Equipment-data ligger i db-maskin (intakt)
- UI for maskin må skjules (krever route-guard)
- Ingen advarsel-dialog finnes i dag

**Min anbefaling for Fase 0:**
- Etabler regel: «modul-data bevares ved deaktivering, UI skjules, reaktivering gir tilbake»
- Bygg `modulProcedure(slug)` som sjekker `OrganizationModule.active` — alle modul-ruter må bruke denne
- Backlog: advarsel-dialog ved permanent sletting (ikke deaktivering)

### Q2: Mal-versjonering ved Malverk-oppdatering

**Du foreslo (b) varsel + manuell oppdatering — godt valg.** Implementering:

```
ReportTemplate
├── + organizationTemplateId? (peker til firma-master)
├── + bibliotekMalId? (peker til SiteDoc Malverk-master, hvis kopiert direkte)
├── + versjonAvHovedmal: Int (versjons-snapshot ved kopi)
└── (eksisterende felter)
```

Hvis `BibliotekMal.versjon > ReportTemplate.versjonAvHovedmal` → vis badge «X versjoner bak» + «Oppdater»-knapp i UI.

**Edge case:** Hvis prosjekt-mal er endret lokalt etter kopi, må «Oppdater»-knapp vise diff og kreve bekreftelse av merge. Implementer som backlog.

### Q3: Byggeplass-sletting

**Eksisterende oppførsel:** `Psi.byggeplassId` er nullable, `onDelete: SetNull`. Data bevares, kontekst går tapt. **Ingen advarsel-dialog finnes**.

**Min anbefaling:** Før Fase 0.5 (byggeplass-fundament), lag policy:
- Slett-rute returnerer telleresult: «X PSI-rader, Y kontrollplan-punkter, Z dokumenter er knyttet til denne byggeplassen»
- Krev bekreftelse med tekstinput («skriv byggeplass-navn for å bekrefte»)
- SetNull beholdes som default (data bevares som «ikke-byggeplass-knyttet»), men cascade kan velges av brukeren eksplisitt

### Q4: Primær-eier slettes (firmakonkurs)

**Helt udekket scenario.** Ingen `organization.delete()`-rute finnes. Hvis det implementeres:
- `User.organizationId` → må SetNull eller migrer til annen org
- `OrganizationProject` → CASCADE sletter koblinger
- `Project.primaryOrganizationId` → BLOKKERER sletting hvis required, eller blir orphan

**Min anbefaling:** Ikke implementer Organization-sletting i Fase 0. Krev manuell prosess via `sitedoc_admin`-rolle. Når dere bygger sletting senere:
1. Sjekk om noen Project har primaryOrganizationId = denne org → blokkér eller krev overføring
2. Lag `overfor`-flyt: `transferProsjekter(fromOrgId, toOrgId)` + `transferUsers(...)`
3. Kun da: `organization.delete()` med CASCADE på resterende koblinger

### Q5: Møtemal/Månedsrapport/Street View påvirker Fase 0?

- **Møtemal:** Ny dokumenttype som lever i samme `ReportTemplate`-modell. Ingen påvirkning på Fase 0.
- **Månedsrapport:** Aggregering av eksisterende data. Krever ingen nye modeller. Påvirker ikke Fase 0.
- **Street View for byggeplass:** Helt separat domene (kart-tjeneste, S3-lagring av panorama). Ingen påvirkning på Fase 0.

**Konklusjon:** Ingen av de tre påvirker Fase 0-beslutningene.

---

## §7 — Spesielt fokus på svakheter

### 1. Sjekkliste-arkitekturen — to systemer vs ett

**Renere med to systemer.** Begrunnelse:

- **Domene-isolasjon:** Maskin-vedlikehold trenger ikke faggruppe-flyt. Tvinge dem inn i `Checklist` ville krevd faggruppe-bypass eller dummy-faggrupper.
- **Schema-isolasjon:** EquipmentChecklist i db-maskin følger eksisterende isolasjon. Ingen FK-brudd.
- **UI-isolasjon:** Mekaniker skal ikke se NS 3420-maler, prosjektleder ikke maskin-vedlikehold.

**Skarp kant:** Hvis et firma vil ha *samme sjekkliste* brukt både på prosjekt og på verksted (eks. EL-kontroll), må de lage to maler. Akseptabel friksjon.

**Anbefaling:** Aksepter to-system-modellen. Men `EquipmentChecklistTemplate.struktur` bør bruke **samme jsonb-felt-format** som `ReportTemplate.struktur` (svar på din §3.4 Q2: ja, kompatibilitet er viktig). Da kan UI-renderer-komponenter gjenbrukes.

### 2. Equipment-isolasjon — svake referanser akseptabel?

**Ja, men med eksplisitt bekreftelse.** Tre tiltak:

1. **Dokumenter eksplisitt i schema:**
   ```prisma
   model Equipment {
     ansvarligUserId String? // Weak FK to db.User.id — håndheves i app-lag
   }
   ```
2. **App-lag-orphan-deteksjon:** Nightly job som logger orphan refs (ikke sletter)
3. **Sletting av User skal varsle eier av db-maskin-data** — kan implementeres som hook eller pre-delete sjekk

Svake referanser er ikke teknisk gjeld — de er bevisst arkitekturvalg for modul-isolasjon. Men *udokumenterte* svake referanser er gjeld.

### 3. Fase 0.5 byggeplass-fundament — for snever?

**Litt for snever.** Du nevner kun `ByggeplassMedlemskap`. Bør også inneholde:

- **Default-byggeplass-policy:** Hva er standard når et prosjekt ikke har byggeplasser? (Foreslag: implisitt «hele prosjektet» = byggeplassId null)
- **`building_ids` jsonb-cleanup:** Per `byggeplass-strategi.md` ligger denne urørt på `project_groups`. Bør ryddes som del av Fase 0.5.
- **Eksisterende byggeplass-eide modeller** (Psi, Kontrollplan, Folder?) — sjekk at periodeStart/Slutt-konsept er konsistent
- **Tre åpne arkitektur-prinsipper** fra `byggeplass-strategi.md` (NULL-betydning, default-byggeplass, FK vs jsonb) MÅ besluttes som del av Fase 0.5 — ikke Fase 6

### 4. Project.primaryOrganizationId — migreringsstrategi

**Gjennomførbar, men jeg anbefaler nullable framfor required.** Per CLAUDE.md er standalone-prosjekt gyldig permanent tilstand. Required `primaryOrganizationId` bryter dette prinsippet.

Med nullable:
- Default for nye prosjekter: `creator.organizationId`
- Migrering av eksisterende: `OrganizationProject.organizationId` hvis én rad, ellers null
- Modul-gateway: hvis null → fall tilbake til «alle moduler tilgjengelig» eller «ingen» basert på firma-policy

---

## Nye svakheter avdekket i runde 2

| # | Svakhet | Konsekvens | Anbefaling |
|---|---|---|---|
| 1 | `SiteDocMalverk` redundant med `BibliotekMal` | To tabeller for samme konsept | Utvid `BibliotekMal` i stedet |
| 2 | `primaryOrganizationId` required bryter standalone-prinsipp | Konflikt med dokumentert policy | Gjør nullable |
| 3 | 3 ekstra loan-pattern-modeller mangler periode (ProjectGroupMember, FaggruppeKobling, DokumentflytMedlem) | Inkonsistens vokser | Inkluder i Fase 0 eller plasser eksplisitt i backlog |
| 4 | Modul-deaktivering uten advarsel-dialog | Brukere mister tilgang uten varsel | Backlog, men dokumenter regel |
| 5 | Cross-schema orphan-deteksjon mangler | User-sletting kan etterlate orphan-refs i db-maskin | Backlog, dokumenter eksplisitt |
| 6 | Fase 0.5 mangler tre åpne byggeplass-prinsipp-beslutninger | Implementering blir blokkert | Inkluder beslutningsrunde i Fase 0.5 |
| 7 | Service-varsel-trigger ikke implementert i db-maskin | Maskin-sjekkliste «trigget av varsel» har ikke noe som trigger | Service-varsel må bygges parallelt med EquipmentChecklist |

---

## Go/No-go for Fase 0

**Go**, etter disse mikrobeslutningene (under 30 min):

1. **`primaryOrganizationId` required eller nullable?** Min stemme: nullable
2. **`SiteDocMalverk` ny tabell eller utvidelse av BibliotekMal?** Min stemme: utvidelse
3. **Hvor mange loan-pattern-modeller migreres i Fase 0?** Min stemme: bare ProjectMember (de andre i backlog som ren ressurs-/tids-spørsmål)
4. **`OrganizationChecklist` (kontor/verksted) i Fase 0 eller backlog?** Min stemme: backlog, hvis ingen kunde har bedt om det
5. **`OrganizationKontekstType` i Fase 0?** Min stemme: utelat, bruk String + kommentar-enum (etablert mønster)
6. **Tre åpne byggeplass-prinsipper besluttet før Fase 0.5 starter?** Må — ellers blokkeres senere faser

---

## Memory-oppdateringer (revidert anbefaling)

Etter denne runden bør memorier være:

| Memory | Status | Begrunnelse |
|---|---|---|
| Ny: `project_arkitektur_syntese.md` | Oppdater til revidert versjon | Erstatter spredte arkitektur-memorier |
| Ny: `feedback_loan_pattern.md` | Lag etter Fase 0-beslutning | EquipmentAssignment-mønster + dokumenter at 3 modeller har gjeld |
| Ny: `feedback_modul_gateway.md` | Lag etter Fase 0-beslutning | 5-trinns autorisasjonsstige + soft-delete-regel |
| Ny: `feedback_bibliotekmal_er_malverk.md` | Lag etter beslutning | Hindrer fremtidige forsøk på å lage ny `SiteDocMalverk`-tabell |
| Ny: `feedback_svake_refs_db_maskin.md` | Lag nå | Etablert mønster, dokumenter eksplisitt |
| Ny: `project_kritiske_arkitektur_beslutninger.md` | Lag etter beslutninger | Sporbarhet for de 6 mikrobeslutningene over |
| `project_byggeplan.md` (eksisterende) | Erstatt med peker til revidert §5 i syntese | Tre konkurrerende rekkefølger må reduseres til én |
