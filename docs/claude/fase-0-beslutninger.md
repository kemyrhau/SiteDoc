# Fase 0 — beslutninger og anker for ny chat

**Dato:** 2026-04-25
**Status:** 🟡 **Beslutninger låst, men IKKE klart for koding ennå.** Timer-modul-planlegging må fullføres først — den kan påvirke arkitektur-modellen og medføre justeringer av beslutningene under.
**Forutsetninger:** Opus QA runde 1 + revisjon + Opus QA runde 2 ferdig.

> ⚠️ **Til neste Code-instans:** IKKE start Fase 0-koding selv om alt ser klart ut. Timer-planlegging tas opp først i ny chat. Vent på Kenneth's grønne lys etter timer-planlegging er fullført og eventuelle justeringer av disse beslutningene er dokumentert. Se § «Forutsetning før koding starter» nederst.

**Lesing før koding starter:**
1. Denne filen (beslutningene)
2. [arkitektur-syntese.md](arkitektur-syntese.md) — helhetlig produktarkitektur
3. [arkitektur-qa-runde-2-2026-04-25.md](arkitektur-qa-runde-2-2026-04-25.md) — Opus' QA-rapport runde 2
4. [datamodell-arkitektur.md](datamodell-arkitektur.md) — to-nivå-modell og loan-pattern
5. **Timer-planlegging-resultat** (kommer fra ny chat, lenkes inn her når ferdig)

---

## De 7 mikrobeslutningene

### 1. `Project.primaryOrganizationId` — nullable

**Beslutning:** Feltet legges til som **nullable** (`String?`), ikke required.

**Begrunnelse:** Standalone-prosjekt (`organizationId = null`) er gyldig permanent tilstand per CLAUDE.md § «Organisasjonsmodellen — to spor». Required `primaryOrganizationId` ville bryte dette prinsippet og blokkere standalone-flyten.

**Konsekvens for modul-gateway:**
- Hvis `primaryOrganizationId IS NULL` → standalone-fallback (alle moduler tilgjengelig som default, eller ingen — settes som firma-policy senere)
- Hvis satt → modul-gateway sjekker `OrganizationModule` for det firmaet
- `OrganizationProject` (m:n) består uendret som ekstra firma-tilknytning (partnerskap)

**Migreringsstrategi for eksisterende data:**
- Default for nye prosjekter: `creator.organizationId`
- Migrering av eksisterende: `OrganizationProject.organizationId` hvis én rad finnes, ellers `null`

**Ikke gjort:** Ingen `OrganizationProject.erHovedeier`-flagg. `Project.primaryOrganizationId` er sannheten.

---

### 2. Utvid `BibliotekMal` — ikke ny `SiteDocMalverk`-tabell

**Beslutning:** Utvid eksisterende `BibliotekMal`-modell med fire felter:

```prisma
model BibliotekMal {
  // eksisterende felter
  + kategori: String           // 'prosjekt-sjekkliste' | 'maskin-sjekkliste' | 'kontor-sjekkliste' | 'oppgave' | 'hms'
  + domene: String?            // 'ns3420' | 'maskin-vedlikehold' | 'kontor' | etc.
  + kobletTilModul: String?    // 'maskin' | 'mannskap' | null = kjerne
  + verifisert: Boolean        // kvalitetssikret av SiteDoc-team
}
```

**Begrunnelse:** Opus avdekket i runde 2 at `BibliotekMal` allerede ER det vi kalte `SiteDocMalverk`:
- Globalt mal-bibliotek tilgjengelig for alle firma
- Hierarki `BibliotekStandard → BibliotekKapittel → BibliotekMal`
- `malInnhold: Json` håndterer alle felt-typer
- `prioritet`-felt for sortering
- `ProsjektBibliotekValg` etablert sporing av importer
- `bibliotek.importerMal()` etablert kopierings-rute til `ReportTemplate`

Å lage ny tabell ville være konseptuell duplikasjon.

**Pedagogisk caveat:** Hvis «Malverk» som brand-navn er viktig for brukerne, bruk Prisma `@@map("sitedoc_malverk")` for å bytte fysisk tabellnavn uten å endre modell-strukturen.

---

### 3. Bare `ProjectMember` får periode-felt i Fase 0

**Beslutning:** I Fase 0 utvides kun `ProjectMember` med:
- `periodeStart: DateTime` (default = `createdAt` for eksisterende rader)
- `periodeSlutt: DateTime?` (nullable — null = aktiv)

**Backlog (utsatt):** Tre andre loan-pattern-modeller har samme gjeld og oppgraderes ved «konsekvent oppgradering ved fremtidig anledning»:
- `ProjectGroupMember`
- `FaggruppeKobling`
- `DokumentflytMedlem`

**Begrunnelse:** ProjectMember har størst praktisk konsekvens (innleide arbeidere som slutter). De andre er ikke kundekritiske nå. Konsekvent oppgradering kan gjøres når en av dem berøres for andre grunner.

**Migreringsplan ProjectMember:**
1. Legg til `periodeSlutt` (nullable) på modellen
2. Lag helper `aktivMedlemFilter = { OR: [{ periodeSlutt: null }, { periodeSlutt: { gt: new Date() } }] }`
3. Refaktorer 9 funksjoner i `apps/api/src/trpc/tilgangskontroll.ts` (identifisert i QA-runde 2 §6.2 Q3) — atomisk i én PR
4. Eksisterende rader får `periodeSlutt: null` ved migrasjon

---

### 4. HMS-rapport får firma-kontekst — kontor-sjekkliste utsettes

**Beslutning:** I Fase 0:
- `Psi`-modellen får `organizationId` (required) og `projectId` blir nullable
- Nytt felt `kontekstType: String` på Psi (etablert mønster: String + kommentar-enum med verdier `prosjekt`, `byggeplass`, `kontor`, `verksted`, `firmabil`, `annet`)

**Backlog:** `OrganizationChecklist` (egen modell for kontor/verksted-sjekklister) bygges ikke før en kunde eksplisitt etterspør det. Per nå er HMS-rapport tilstrekkelig for firma-eid kontekst.

**Begrunnelse:** Tre kunder har bedt om HMS på kontor/verksted/firmabil. Ingen har bedt om generell sjekkliste utenfor maskin-domenet. Bygg det som etterspørres, ikke det som kan etterspørres.

**Forbehold:** Faggruppe-tilknytning på HMS-rapport må vurderes ved firma-kontekst. Default: hvis `projectId IS NULL`, bypass faggruppe-flyt; ellers eksisterende dokumentflyt.

---

### 5. `kontekstType` som String — ingen `OrganizationKontekstType`-tabell

**Beslutning:** `kontekstType` modelleres som `String` med default-verdi og kommentar-enum:

```prisma
model Psi {
  kontekstType String @default("prosjekt") // 'prosjekt' | 'byggeplass' | 'kontor' | 'verksted' | 'firmabil' | 'annet'
}
```

**Begrunnelse:** Etablert mønster i kodebasen — verifisert av Opus i runde 1: `Project.status`, `ProjectGroup.category`, `Drawing.status`, `Checklist.status`, `Kontrollplan.status` følger alle samme mønster.

**`OrganizationKontekstType` som utvidbar tabell:** Utelates til konkret behov dukker opp. Krever ingen presedens i kodebasen og legger til kompleksitet uten gevinst akkurat nå.

---

### 6. Byggeplass forblir valgfri på Project — selv-håndhevelse

**Beslutning:** Ingen tvungne valg ved prosjektopprettelse. Byggeplass legges til når det er behov.

**Funksjonalitet som krever byggeplass blir utilgjengelig hvis byggeplass mangler:**
- Tegninger
- 3D-visning
- PSI-signering

**Funksjonalitet som fungerer uten byggeplass:**
- Mapper
- Dokumentflyt
- Sjekklister
- Oppgaver
- HMS-rapporter (med `kontekstType`)

**Begrunnelse:** Ren UX — verken tving brukere til å opprette byggeplass for prosjekter som ikke trenger det, eller la dem opprette tegninger uten kontekst. Funksjoner som trenger byggeplass viser meldingen «Opprett byggeplass først» og lenker dit.

**Konsekvens for Fase 0.5 (byggeplass-fundament):**
- Beslutning treffer §3 åpent prinsipp i `byggeplass-strategi.md`: «Default-byggeplass-policy»
- Svar: implisitt `byggeplassId IS NULL` betyr «hele prosjektet» eller «ikke knyttet til byggeplass» — modellene tolker selv

---

### 7. Maskin-sjekkliste-trigger: manuell i Fase 1, auto i Fase 7

**Beslutning:**
- **Fase 1:** `EquipmentChecklist` får manuell trigger fra maskinregister-UI («Kjør sjekkliste nå»-knapp). Implementeres sammen med EquipmentChecklistTemplate.
- **Fase 7:** Auto-trigger fra service-varsel implementeres som del av Varsling-modulen. Forutsetter at varslings-infrastruktur er på plass.

**Begrunnelse:** Service-varsel-trigger krever:
- Varsling-modul (tverrgående firma-nivå)
- Cron eller worker-job i db-maskin
- Konfigurerbar per firma (noen vil ha manuell kontroll, andre automatikk)

Ingenting av dette finnes i Fase 1. Bygg det enkle først, automatikken når infrastrukturen er på plass.

**Field-skisse for Fase 1:**
```prisma
model EquipmentChecklist {
  triggerKilde     String   @default("manuell")  // 'manuell' | 'service-varsel' (Fase 7)
  triggerKildeId   String?  // FK til ServiceRecord/Feilmelding (Fase 7)
  // ...
}
```

---

## Implementeringsrekkefølge i Fase 0

Når ny chat starter, kjør i denne rekkefølgen:

1. **Datamodell-fundament (Prisma):**
   - `Project.primaryOrganizationId String?` (nullable FK)
   - `OrganizationModule` (firma + slug + active + config + timestamps)
   - `OrganizationSetting` (firma + nøkkel-verdi-par for tilgangs-defaults)
   - `OrganizationPartner` (firma + navn + kontakt-felt + UE/byggherre/leverandør-flag)
   - `OrganizationTemplate` (firma-mal-bibliotek)
   - `Avdeling` som flagg på `OrganizationSetting` eller egen lett tabell
   - `BibliotekMal` utvidelse (4 nye felter)
   - `Psi.organizationId` (required) + `Psi.projectId` blir nullable + `Psi.kontekstType String`
   - `ProjectMember.periodeSlutt DateTime?`

2. **Tilgangs-infrastruktur (tRPC):**
   - `prosjektProcedure` (auth + scope-sjekk)
   - `modulProcedure(slug)` (auth + sjekk `OrganizationModule.active` for prosjektets primaryOrg)
   - Refaktor 9 funksjoner i `tilgangskontroll.ts` for ProjectMember-periode

3. **Migreringer:**
   - Backup test+prod først
   - `Project.primaryOrganizationId` populere fra OrganizationProject hvor mulig
   - `ProjectMember.periodeSlutt = null` for alle eksisterende
   - `Psi.organizationId` populere fra `Psi.project.primaryOrganizationId`
   - `BibliotekMal.kategori = 'prosjekt-sjekkliste'`, `domene = 'ns3420'`, `verifisert = true` for eksisterende NS 3420-rader

4. **Ingen UI-endringer i Fase 0** — kun datamodell og infrastruktur. UI kommer i Fase 1+.

---

## Hva som IKKE er en del av Fase 0

- `OrganizationKontekstType` som tabell (besluttet utelatt)
- `OrganizationChecklist` (utsatt til kundeforespørsel)
- `OrganizationGroup` (firma-gruppe — ikke besluttet ennå)
- Periode-felt på `ProjectGroupMember`/`FaggruppeKobling`/`DokumentflytMedlem` (backlog)
- `DokumentflytEksternMedlem` for eksterne kontrollører (backlog)
- Mal-versjonering med push-down (backlog)
- Cross-schema orphan-deteksjon for db-maskin (backlog)
- Advarsel-dialog ved Byggeplass-sletting (backlog, men dokumenter regel)
- `Organization.delete()`-flyt (backlog — manuell sletting via sitedoc_admin frem til da)

---

## Hva som forutsettes ferdig før Fase 0-koding starter

- ✅ DB-naming-opprydning på test+prod (gjennomført 2026-04-15/16)
- ✅ `feature/maskin-db` parkert (commits backupert til origin)
- ✅ Opus QA runde 1 + 2 (denne)
- ✅ Beslutninger i denne filen
- ⏳ **Timer-modul-planlegging** — neste steg i ny chat. Kan påvirke arkitekturen og medføre justeringer av beslutningene over (særlig rundt firma-eide ressurser, Kompetanseregister, lønnsarter, OrganizationModule-aktivering for Timer)
- ⏳ **Eventuelle justeringer av beslutningene** etter timer-planlegging — dokumenteres her som tillegg/endringer
- ⏳ **Kenneths grønne lys** — eksplisitt klarsignal om at koding kan starte

**Inntil disse fire er ferdige skal Code IKKE starte Fase 0-koding.** Selv om beslutningene under ser komplette ut, er de subjekt til revidering basert på timer-funn.

## Hva som skjer rett etter Fase 0

**Fase 0.5 — Byggeplass-fundament:**
- Tre åpne arkitektur-prinsipper fra `byggeplass-strategi.md` MÅ besluttes (NULL-betydning, default-byggeplass, FK vs jsonb)
- `ByggeplassMedlemskap` (loan-pattern: User → Byggeplass over tid)
- Drop `building_ids` jsonb fra `project_groups`
- Forbered byggeplassId-felt på fremtidige Timer/Mannskap/Varelager-modeller

**Fase 1 — Maskin med modul-gateway:**
- Refaktorer maskin-rutene til å bruke `modulProcedure('maskin')`
- `EquipmentChecklist` + `EquipmentChecklistTemplate` i db-maskin
- UI for maskin-sjekkliste på maskin-detalj-side
- Manuell trigger fra maskinregister

Se [arkitektur-syntese.md §5](arkitektur-syntese.md) for full faseplan.
