---
tittel: Måling — kundeønske #1 (sjekkliste for service koblet til timetall)
type: delplan-måling
status: 🟡 MÅLING — ingen kode, ingen beslutning
opprettet: 2026-09-17
forfatter: kontrollplan-Opus
branch: docs/maaling-kundeonske-1 (fra origin/develop = 250dfc7f)
sist_verifisert_mot_kode: 2026-09-17
scope: KUN kundeønske #1. Ingen kode, migrering, i18n eller UI.
---

# Måling — kundeønske #1: service koblet til timetall

**Kundeønske #1 (A.Markussen, 2026-05-06, kunde satte «Høy», urørt fire måneder,
pilot denne måneden).** BACKLOG.md:5301 er **input, ikke fasit** — målt mot kode 2026-09-17.

**BACKLOG-teksten sier:** *«DB-feltet `nesteServiceTimer` finnes i
`packages/db-maskin/prisma/schema.prisma:188`. Mangler UI + serviceintervall-konfig +
sjekkliste med automatisk oppdatering.»*

**Målingen motbeviser premisset i BACKLOG-raden:** `nesteServiceTimer` er ikke et halvferdig
fundament man bygger videre på — det er en **tom kolonne uten skrivevei**, og hele
service-subsystemet (`ServiceRecord`) er skjelett uten en eneste rute eller UI. «Sjekkliste»
i ønsket er **ikke bygget i det hele tatt.** Se BACKLOG-korreksjon nederst.

---

## Krav 1 — hva finnes allerede (mot kode)

### `nesteServiceTimer` — TOM KOLONNE, ingen skrivevei

- Ligger på **`ServiceRecord`**, ikke `Equipment` (`schema.prisma:188`,
  `neste_service_timer Int?`). BACKLOG-teksten antyder implisitt Equipment — feil modell.
- **Aldri skrevet, aldri lest.** Repo-bredt søk (`*.ts`/`*.tsx`) gir **null treff**. Feltet
  finnes kun i `schema.prisma` + init-migrering `20260424001754_init/migration.sql`.
- `git log -S "nesteServiceTimer"` → **kun `a5667eb4`** («opprett db-maskin med Fase 1-skjema»).
  Født med skjemaet 2026-04-24, aldri rørt siden. Klassisk «stille tomhet».
- Søsken `nesteServiceDato` og `nesteServiceKm` (samme modell) er i samme tilstand.

### Driftstimer — finnes, MANUELL, oppdateres IKKE automatisk

- `Equipment.driftstimer Int?` (`schema.prisma:71`, anleggsmaskin-felt).
- **Kilder (to, begge manuelle):**
  1. **Manuell registrering** — create/update-input på `maskin.equipment`-ruten
     (`apps/api/src/routes/maskin/equipment.ts:299`), redigeres på web-detaljsiden
     (`apps/web/src/app/dashbord/maskin/[id]/page.tsx:1232`), vises som lese-linje (`:389`).
  2. **Regneark-import** — kolonne «Timetall» → `driftstimer`
     (`apps/api/src/routes/maskin/import.ts:385`, `utils/maskinImport.ts:64`).
- **Ingen automatisk oppdatering.** `SheetMachine.timer` (Decimal, `db-timer:449`) bærer
  faktisk **driftstimer per dag per maskin** (`vehicleId` = svak FK → Equipment) og føres
  live fra dagsseddel (mobil + web). **Men ingenting aggregerer `SheetMachine.timer` tilbake
  til `Equipment.driftstimer`.** Rådataene for auto-oppdatering finnes altså allerede — koblingen
  gjør det ikke. **Ikke fra Vegvesen** (Vegvesen leverer kjøretøydata, ikke driftstimer).

### `ServiceRecord` — modell finnes, INGEN produkt-skrivevei

- Full modell (`schema.prisma:176-202`): `type`, `dato`, `km`, `timer`, `kostnad`,
  `nesteServiceDato/Km/Timer`, `vedlegg`, `feilmeldingId` (lukker feilmelding), `beskrivelse`.
- **Ingen rute leser eller skriver den.** `apps/api/src/routes/maskin/` har ingen service-fil
  (`ansvarlig.ts`, `equipment.ts`, `import.ts`, `index.ts`, `vegvesenKo.ts`). `git log -S
  "serviceRecord.create"` → **null commits**. Ingen UI (web eller mobil) rører den.
- Eneste referanser i kode: to **GDPR/audit-vedlikeholdsskript**
  (`scripts/audit-sensitive-apen-sti.ts`, `scripts/migrer-sensitive-filer-til-privat.ts`) som
  skanner `vedlegg[].url` for fil-migrering. **Ikke en service-flyt.**
- **I praksis en tom tabell** — ingenting oppretter rader. **Hva utløser en rad i dag: ingenting.**

### `EquipmentChecklist` — FINNES IKKE (mal-Opus bekreftet)

- Ingen `EquipmentChecklist` / `EquipmentChecklistTemplate` i noe skjema eller TS/TSX.
- `maskin.md:233-259` dokumenterer dem som **planlagt Fase 1**: samme jsonb-`struktur`-format
  som `ReportTemplate.struktur`, så renderer `apps/web/src/components/paneler/SjekklisterPanel.tsx`
  kan gjenbrukes; auto-trigger fra service-varsel «må bygges parallelt med modellen».
- ⚠️ **Doc-drift funnet (ikke rettet — utenfor scope):** `maskin.md:259` påstår *«Brukeren kan
  opprette sjekkliste manuelt fra maskinregister — denne utgjør allerede primær-veien.»* Presens
  uten kode-referanse; **ingen slik vei finnes.** Bør status-markeres 🟡 PLANLAGT når maskin.md
  neste gang røres.

### `krevDagligKontroll` — flagg finnes, ingen konsument

- `Equipment.krevDagligKontroll Boolean` (`schema.prisma:42`) har **null lesere** i kode.
  Daglig-kontroll-sjekkliste er ikke bygget. Nevnt for fullstendighet — ikke del av ønsket.

---

## Krav 2 — hva er egentlig bestilt (de fire tolkningene)

| # | Tolkning | Status | Merknad |
|---|----------|--------|---------|
| 1 | **Terskelvarsel** («120 t til service» på maskinen) | ❌ MANGLER | Mønster finnes: `EuKontrollBanner` (`[id]/page.tsx:741`) varsler på dager-frist. Ingen timebasert motpart. Krever pålitelig `driftstimer` + intervall (#2). |
| 2 | **Serviceintervall-konfigurasjon** | ❌ MANGLER helt | Ingen felt, ingen UI. **UAVKLART: per maskin eller per maskintype** — spørsmål til Kenneth. |
| 3 | **Faktisk sjekkliste ved service, avkrysning** | ❌ MANGLER | `EquipmentChecklist` ikke bygget. Gjenbruker `SjekklisterPanel` + jsonb-format per maskin.md. |
| 4 | **Automatisk fremskriving** (`nesteServiceTimer` settes videre etter utført service) | ❌ MANGLER | Feltet finnes men er dødt. Avhenger av #2 (intervall) + en service-fullført-hendelse (= `ServiceRecord`-skrivevei). |

**Sammenheng:**
- **`ServiceRecord`-skriveveien er ankeret** — ingenting kan «fullføre en service» før den finnes.
  Uten den er #4 umulig og #3 har ingen sted å feste avkrysningen.
- **#4 avhenger av #2 + #3.** Intervall gir tallet å skrive videre; service-fullført-hendelsen
  gir tidspunktet.
- **#1 avhenger av #2 + pålitelig `driftstimer`.** I dag er `driftstimer` manuell/importert;
  et terskelvarsel er bare så ferskt som siste manuelle registrering — med mindre auto-aggregering
  fra `SheetMachine` bygges (eget, større spor — se spørsmål til Kenneth).

**Uavklart fra kode (skal IKKE landes her — spørsmål til Kenneth):**
- Intervall per maskin vs. per maskintype (#2).
- Om `driftstimer` skal auto-oppdateres fra dagsseddel (`SheetMachine.timer`) eller forbli manuell.
- Om «sjekkliste» (full #3) er med i pilot, eller om terskelvarsel + intervall + manuell servicelogg
  dekker pilotbehovet.

---

## Krav 3 — grovt omfang, avhengigheter, rekkefølge

Anslag er grove (én utvikler, uten redesign-kollisjon). 🔴 = krever skjemaendring/migrering
(Kenneth gater alle).

| Del | Omfang | Avhenger av | Migrering? |
|-----|--------|-------------|-----------|
| **A. Serviceintervall-felt + UI** (#2) | 0,5–1 dag | — | 🔴 Ja (nye felt på Equipment eller egen intervall-tabell) |
| **B. ServiceRecord skrive-/lesevei + servicelogg-UI** (ankeret for #3/#4) | 1,5–2 dager | A (for å skrive `nesteServiceTimer`) | Nei (modell finnes) |
| **C. Automatisk fremskriving** (#4) | 0,5 dag | A + B | Nei |
| **D. Terskelvarsel/banner** (#1) | 0,5–1 dag | A + `driftstimer` | Nei |
| **E. `EquipmentChecklist`(-Template) + renderer-gjenbruk** (full #3) | 3–5 dager | B + `SjekklisterPanel`-gjenbruk | 🔴 Ja (to nye modeller) |
| **(F. Auto-aggreger `driftstimer` fra `SheetMachine`)** | 1–2 dager | — | Nei | 

**Foreslått rekkefølge (mest kundeverdi, minst arbeid først):**

1. **A → B → C** (intervall → servicelogg → fremskriving). Dette gir kunden det den faktisk
   spurte om i kjernen: registrer service, «neste service ved X timer» settes og vises. `nesteServiceTimer`
   blir levende. Ett migrerings-steg (A), resten bygger på eksisterende modell.
2. **D** (terskelvarsel) rett etter — billig når A finnes, gjenbruker `EuKontrollBanner`-mønsteret,
   høy synlig verdi på maskin-detaljsiden.
3. **E** (full sjekkliste med avkrysning) sist — dyrest, egen migrering, og #1/#4 dekker
   trolig pilotbehovet uten den. **Avklar med Kenneth om E er pilot-scope før den startes.**
4. **F** (auto-`driftstimer`) er et **eget spor** — bare hvis Kenneth vil at varsel skal være
   selvoppdaterende. Ikke nødvendig for A–E.

**Begrunnelse:** A–C leverer «service koblet til timetall og status» ordrett med ett migrerings-steg
og null ny stor modell. Sjekkliste-modellen (E) er der 3–5 av dagene ligger; å utsette den til etter
pilot-tilbakemelding er lavest risiko.

---

## Krav 4 — kollisjonskart (hvilke filer en byggerunde ville røre)

⚠️ **Redesign er akkurat nå i `apps/api`, `apps/web`, `apps/mobile`, `packages/pdf` og i18n
(kontraktssak). Overlappet er reelt.**

| Fil/område | Del | Redesign-kollisjon |
|------------|-----|---------------------|
| `packages/db-maskin/prisma/schema.prisma` + ny migrering | A, E | Lav — redesign rører ikke db-maskin |
| `apps/api/src/routes/maskin/` (ny `service.ts`/`checklist.ts`, `equipment.ts`, `index.ts`) | A–E | **Middels** — redesign er i `apps/api` |
| `apps/web/src/app/dashbord/maskin/[id]/page.tsx` (service-seksjon, banner) | B, C, D | **Middels** — redesign er i `apps/web` |
| `apps/web/src/components/paneler/SjekklisterPanel.tsx` (gjenbruk) | E | **Høy** — sentral delt renderer redesign kan røre |
| **`packages/shared/src/i18n/nb.json` + `en.json`** (nye `maskin.service.*`/`maskin.sjekkliste.*`) + 13-språk-generate | A–E | **🔴 HØYEST — her skjer i18n-kollisjonene.** Kontraktssak-runden er i samme filer. Byggerunden må tidfestes ETTER at redesign-i18n har landet, ellers merge-konflikt i nb/en.json. |
| `packages/pdf` (hvis service-rapport skal skrives ut) | (valgfritt) | **Middels** — redesign er i pdf. Anbefaling: hold PDF utenfor MVP. |
| `apps/mobile` | (ingen i MVP) | Minimal — kun `maskinKatalog.ts` finnes i dag; ingen maskin-detalj/service på mobil |

**Konklusjon for cowork:** Hovedkollisjonen er **i18n (nb/en.json)** og **`apps/web`/`apps/api`**.
Byggerunden bør startes **etter** at redesign-kontraktssak har landet i i18n. `db-maskin`-migreringen
(A/E) er isolert og kan forberedes uavhengig — men Kenneth gater migreringen.

---

## Spørsmål som må til Kenneth (ikke avgjørbare fra kode)

1. **Serviceintervall per maskin eller per maskintype?** (styrer A: felt på Equipment vs. egen tabell)
2. **Skal `driftstimer` auto-oppdateres fra dagsseddel (`SheetMachine.timer`)**, eller forbli manuell/importert?
   (Avgjør om terskelvarsel er selvoppdaterende — spor F, +1–2 dager.)
3. **Er full sjekkliste med avkrysning (`EquipmentChecklist`, del E) pilot-scope**, eller holder
   terskelvarsel + intervall + manuell servicelogg (A–D) til piloten?
4. **Skal service-rapport kunne skrives ut (PDF)?** (Trekker `packages/pdf` inn i kollisjonssonen.)

---

## Hva som ikke gikk glatt

- **BACKLOG-radens linjereferanse var misvisende:** «`nesteServiceTimer` … på :188» stemmer på
  linjenummer, men modellen er `ServiceRecord`, ikke `Equipment` — og feltet er dødt, ikke et
  fundament. Krevde `git log -S` + repo-bredt søk for å avvise premisset trygt.
- **`ServiceRecord`-referansene i kode er falske positiver:** de to treffene er GDPR/audit-skript
  som skanner `vedlegg`, ikke en service-flyt. Uten negativ kontroll (`serviceRecord.create` = 0 commits)
  kunne det lest som «finnes delvis».
- **`driftstimer`-kilden er nyansert:** rådata finnes (`SheetMachine.timer` per dag), men koblingen
  til maskinens odometer-felt er ikke bygget. «Finnes driftstimer» = ja; «oppdateres automatisk» = nei.

## BACKLOG-korreksjon (eneste tillatte kodefil-endring — kun hvis målingen motbeviser raden)

BACKLOG.md:5301 impliserer `nesteServiceTimer` som halvferdig fundament. Målingen viser det er en
**tom kolonne uten skrivevei**, og at hele `ServiceRecord`-subsystemet er skjelett uten rute/UI.
Raden bør omformuleres til å speile at **ingenting av service-flyten er bygget** (kun døde felt/modell
finnes), med peker til denne målingen. **Ikke gjort i denne runden** — overlates til cowork/Kenneth,
da BACKLOG-redigering av en fire-måneders «Høy»-rad bør skje samtidig med at byggeordren skrives.
