# SmartDok-undersøkelse — muligheter for A.Markussen-overgang

**Mulighets-rapport** — kartlegger hva en eventuell engangs-migrering fra SmartDok til SiteDoc vil kreve. Ikke en aktiv migreringsplan: cutover-dato er ikke avtalt, og SiteDoc er ennå ikke tilstrekkelig utviklet.

**Status:** OpenAPI-spec hentet og kartlagt offentlig (uten autentisering). Ingen kundedata er trukket ut. API-nøkkel er lagret lokalt for senere bruk.

**Forutsetninger for migrering:**
- SiteDoc må først bygge ut manglende funksjonalitet (se "Funksjonsgap")
- A.Markussen må være klar til å bytte system
- Cutover-dato avtales separat når begge sider er klare

---

## API-info

| | |
|---|---|
| **Base URL** | `https://api.smartdok.no` |
| **Spec** | OpenAPI 3.0.4 — `https://api.smartdok.no/docs/v1` |
| **UI** | `https://api.smartdok.no/swagger/ui/index` (Scalar) |
| **Auth-skjema** | Bearer JWT |
| **Antall endepunkter** | 128 |
| **Antall schemaer** | 162 |

### Auth-flyt

API-nøkkelen byttes inn for et JWT-token før hvert kall:

```
POST /Authorize/ApiToken
Body: { "Token": "<API_KEY>" }
→ Returnerer JWT som brukes som "Authorization: Bearer <jwt>" på øvrige kall

POST /Authorize/ApiToken/Renew
→ Forlenger token før det utløper
```

API-nøkkel ligger i `scripts/smartdok/.env.local` (gitignored).

---

## Endepunktoversikt — gruppert etter ressurs

Tag-grupper relevant for migrering markert med ⭐. Tag-grupper vi sannsynligvis kan ignorere markert med ⏭️.

### Brukere og organisasjon

| Tag | Endepunkter | Relevans |
|---|---|---|
| ⭐ **Users** (8) | GET/POST/PUT/DELETE /Users, /Users/current, /Users/{id}, GET /Roles, GET /LicenseInfo | Migrer brukerlisten |
| ⭐ **Departments** (4) | CRUD /Departments | Avdelinger — kan kobles til SiteDoc-grupper |
| ⭐ **Group** (4) | GET /Group, POST AddUser, DELETE RemoveUser | Brukergrupper |

### Prosjekter og kunder

| Tag | Endepunkter | Relevans |
|---|---|---|
| ⭐ **Projects** (9) | CRUD + /NextNumber + /Prices, V1/V2/V3 PUT-varianter | Aktive prosjekter |
| ⭐ **SubProjects** (6) | CRUD pluss listing per prosjekt | Underprosjekter (kan mappes til SiteDoc-faggrupper eller områder) |
| **Areas** (6) | CRUD pr underprosjekt | Områder innen underprosjekt |
| ⭐ **Customers** (5) | CRUD /Customers | Kundeliste |
| **ProjectLocation** (3) | GET/PUT/DELETE /Projects/{id}/Location | GeoLocation per prosjekt |
| **SubProjectLocation** (3) | Tilsvarende på underprosjekt | |

### Timeregistrering (kjerne)

| Tag | Endepunkter | Relevans |
|---|---|---|
| ⭐ **WorkHours** (8) | GET /WorkHours, GET /WorkHours/v2, POST /WorkHours, POST /Absence, MarkAsExported, SetExportedExternal, UnmarkExportedExternal | **Dagssedler — kjernen i timer-modulen** |
| ⭐ **Wages** (4) | CRUD /Wages | Lønnsarter |
| ⭐ **Additions** (4) | CRUD /Additions | Tillegg (skifttillegg, beredskap, etc.) |
| ⭐ **Allowance** (5) | CRUD /Allowance + V2 PUT | Godtgjørelser/diett |
| **TripToFromWorkAddition** (4) | CRUD | Reise-tillegg (passasjer, henger) |
| **Activity** (4) / **ActivityCategory** (2) | /WorkDescriptions, /WorkDescriptionCategory | Aktiviteter koblet til timer |

### Maskiner og verktøy

| Tag | Endepunkter | Relevans |
|---|---|---|
| ⭐ **Machines** (4) | CRUD /Machines | **Maskinregister — viktig for vår maskin-modul** |
| **MachineCategories** (4) | CRUD | Kategorier |
| **Tools** (4) | CRUD /Tools | Småutstyr (passer til vår "småutstyr"-kategori) |
| **ToolCategories** (4) | CRUD | |
| **ToolLocations** (4) | CRUD | Hvor utstyr ligger |

### Vareforbruk

| Tag | Endepunkter | Relevans |
|---|---|---|
| **Goods** (6) | CRUD + units | Materialer/varer |
| **GoodsCategories** (4) | CRUD | |
| **GoodsConsumption** (6) | CRUD + MarkAsExported | Forbruksregistreringer |
| **GoodsLocations** (5) | CRUD + Flows | Lager |
| **GoodsProduction** (3) | GET + MarkAsExported | Produksjon |
| **GoodsTransportation** (3) | GET + MarkAsExported | Transport |

### Endringsmeldinger og fakturering

| Tag | Endepunkter | Relevans |
|---|---|---|
| **Orders** (8) | CRUD + NextNumber + types + GetByUser | Endringsordrer / tilleggsarbeid |
| **OrderTypes** (4) | CRUD | Bestillingstyper |
| **OrderWorkers** (2) | GET/PUT v2/orders/{projectId}/workers | Hvilke arbeidere på endring |
| **Invoices** (2) | GET (read-only) | Utgående fakturaer |
| **SupplierInvoices** (5) | POST + upload | Leverandørfakturaer |

### HMS og kvalitet

| Tag | Endepunkter | Relevans |
|---|---|---|
| **QualityDeviation** (3) | GET /qd, /qd/v2, /qd/{id}/pdf | Kvalitetsavvik |
| **RUE** (6) | GET /rue, summaries, eventlog, messages, pdf | Rapport om uønsket hendelse (HMS-avvik) |
| **SafeJobAnalysis** (3) | GET potential_hazards, reasons, POST overview | SJA |
| **Forms** (10) | CRUD /Forms + v2 + Machine + Project + elements + pdf | Skjemaer/sjekklister |

### Annet

| Tag | Endepunkter | Relevans |
|---|---|---|
| **ResourcePlanning** (3) | GET Plans, Resources, Resources/{id} | Ressursplanlegger |
| **Pictures** (1) | GET /Pictures/project/{projectId} | Bilder per prosjekt |
| ⏭️ **News** (2) | GET/POST | Nyhetsfeed |
| ⏭️ **Webhooks** (4) | CRUD | Vi setter ikke opp webhooks for engangs-migrering |
| **Authorize** (3) | ApiToken + Renew + PublicKeys | Auth-flyt |

---

## Mappingtabell — kjerne-ressurser

### SmartDok `User` → SiteDoc `User` + `OrganizationMember`

| SmartDok-felt | SiteDoc-felt | Merknader |
|---|---|---|
| `Id` (uuid) | — | Lagre i `externalId`-felt eller migration-tabell for sporing |
| `UserName` | — | Vi bruker email som identifikator, ikke username |
| `Name` | `User.name` | |
| `Email` | `User.email` | Unique-constraint i SiteDoc |
| `PhonePrefix` + `PhoneNumber` | `User.phone` | Slå sammen |
| `BirthDate` | — | Mangler i SiteDoc-User. Legge til? Eller droppe? |
| `Role` | `User.role` | Mapping: SmartDok-roller → `user`/`company_admin` |
| `EmployeeNo` | — | **MANGLER** — viktig for lønnseksport |
| `ExternalEmployeeNo` | — | **MANGLER** — for kobling mot Visma/HR |
| `DepartmentId` | — | **MANGLER** — vi har grupper, ikke avdelinger |
| `GroupId` / `GroupName` | `Group.id` | Krever opprettelse av tilsvarende grupper først |
| `LanguageCode` | `User.language` | Direkte mapping (nb, en, sv, lt, pl, ...) |
| `NextOfKin*` (8 felt) | — | **MANGLER** — pårørende-info, viktig for HMS |
| `IsEnded` | — | "Sluttet" — kan brukes for soft-delete |
| `EmployeeCost` | — | Internkost per time, mangler |
| `Expertise` | — | Kompetanse — mangler |

**Gap:** EmployeeNo, ExternalEmployeeNo, DepartmentId, NextOfKin*, EmployeeCost, BirthDate. Av disse er **EmployeeNo** og **ExternalEmployeeNo** kritiske for lønnseksport.

### SmartDok `Project` → SiteDoc `Project`

| SmartDok-felt | SiteDoc-felt | Merknader |
|---|---|---|
| `Id` (int) | `externalId` | Lagre original ID |
| `ProjectName` | `Project.name` | |
| `ProjectNumber` | `Project.projectNumber` (om finnes) | Sjekk SiteDoc-skjema |
| `CustomerId` | — | Krever Customer-migrering først |
| `StartDate` / `EndDate` | `Project.startDate` / `endDate` | |
| `Location` (string) + `GeoLocation` | `Project.location` | |
| `IsActive` | `Project.archived` (invertert) | |
| `IsAbsenceProject` | — | **MANGLER** — fraværs-prosjekt-flag |
| `Departments` (array) | — | **MANGLER** |
| `ClientCompany*` | `Project.kunde*` (om finnes) | Kontaktinfo |
| `HSEResponsibleId` / `QAResponsibleId` | — | HMS- og KS-ansvarlig |
| `InternalCostPerHour` / `HourlyRate` | — | Interne timesatser per prosjekt |
| `ToBeInvoiced` | — | Faktureringsflagg |

### SmartDok `Wage` → SiteDoc `LonnArt` (planlagt)

| SmartDok | SiteDoc | Merknader |
|---|---|---|
| `Id` | `externalId` | |
| `Number` | `nummer` | |
| `Name` | `navn` | |
| `Rate` | `sats` | |
| `IsAbsence` | `erFravaer` | |
| `IsDaytime` | `erDagtid` | |
| `Export` | `eksporteres` | |
| `IsCommentRequired` | `kommentarPaakrevd` | |
| `HourlyCost` / `InternalPrice` | — | Internkost |

→ **SiteDoc har ikke LonnArt-modell ennå** — må bygges som del av timer-modulen.

### SmartDok `Machine` → SiteDoc `Maskin`

Sjekk mot vår `packages/db-maskin/` — vi har 3 kategorier (kjøretøy, anleggsmaskin, småutstyr). SmartDok skiller `Machines` (anleggsmaskiner/kjøretøy) fra `Tools` (småutstyr) — passer godt med vår modell.

| SmartDok | SiteDoc-maskin | Merknader |
|---|---|---|
| `Id` | `externalId` | |
| `Name` | `navn` | |
| `InternalNumber` / `Code` | `internnummer` | |
| `RegistrationNumber` | `regnr` | Vegvesen API kan slå opp resten |
| `CategoryId` + `CategoryName` | `kategori` | |
| `ModelYear` | `aarsmodell` | |
| `HoursUsed` / `MilageKm` | `driftstimer` / `kilometerstand` | |
| `PricePerHour` / `InternalCost` | `pris*` | |
| `MaxTons` / `MaxM3` | — | Kapasitet — er dette i vår modell? |
| `ResponsibleUsers` (array) | — | Ansvarlige brukere |
| `DepartmentIds` (array) | — | |
| `ImageUrl` | `bildeUrl` | Krever last-ned + opplasting til vår S3 |

### SmartDok `WorkHour` (dagsseddellinje) → SiteDoc `Dagsseddel` (planlagt)

WorkHourOutput v1 har 50+ felt — V2 er enklere. Foreslår å bruke V2 for migrering:

```
WorkHourOutputV2: Id, UserId, Date, TimeFrom, TimeTo, BreakTime,
  ProjectId, SubProjectId, ActivityId, WageId, DepartmentId, AreaId,
  AdditionRegistrations[], MachineHourRegistrations[], AllowanceId, Comment
```

Dette matcher vår dagsseddel-prototype godt.

---

## Faktisk bruk hos A.Markussen (UI-inspeksjon 2026-04-25)

### Maskiner — 126 maskiner registrert

**Sider/faner:** Maskinoversikt, Maskinmerknader, Serviceintervaller, Drivstoff, Feilmeldinger, Oppsett. I tillegg snarveier til Verkstedordre (Ny + Oversikt), Skjema mot maskin, Importer maskiner.

**Kolonner i bruk:**
- Maskin (navn med internnummer prefix)
- Internnummer (4-sifret — A.Markussen bruker eget nummersystem)
- Reg.nr (norsk regnr eller "UREG" for uregistrerte anleggsmaskiner)
- Maskinkode
- Årsmodell (1998–2024)
- Lokasjon (peker til **prosjektnavn** med prosjektnummer-prefix, f.eks. "624 KIWI NARVIK - GRUNN OG UTOMHUS")
- Sist endret
- **Maskinansvarlig 1** og **Maskinansvarlig 2** (to ansvarlige støttes)
- Timetall (driftstimer)
- Km.stand
- Notat (servicehistorikk skrives inn som fritekst — flere maskiner har "Aggregat har hatt service på X timer" som notat)
- Status (Standard / Feil — visuell indikator)

**Internnummer-rekker observert:**
- 7000-tallet: Kjøretøy (varebiler, hengere, traktorer, ATV)
- 7600-tallet: Anleggsmaskiner (gravemaskin, hjullaster, hydraulikk-utstyr, Heatwork-aggregat)

**Implikasjoner for SiteDoc maskin-modul:**
- Vår 3-kategori-modell (kjøretøy / anleggsmaskin / småutstyr) matcher faktisk bruk godt
- Vi må støtte **flere ansvarlige per maskin** (Maskinansvarlig 1 og 2)
- "Lokasjon = prosjekt"-pattern — maskinen er fysisk på et prosjekt om gangen, ikke fri lokasjonstekst
- Servicehistorikk i fritekst-notat er suboptimalt — vår «Serviceintervaller»-modell er bedre, men må migrere fritekst-historikk til strukturerte poster
- Status-indikator (Feil/Standard) bør være avledet fra åpne feilmeldinger, ikke manuelt felt

### Vareforbruk — 64 varer registrert

**Sider:** Registrer forbruk, Vareforbruk (oversikt), Registrer transport (Massetransport), Oversikt transport, Vareoversikt, Ny vare, Varekategori.

**Kolonner i bruk på vareoversikt:**
- Varenavn, Varenummer, Pris, Internkostnad, Antall (saldo), Varekategori, Enhet, Aktivt, Strekkode

**Strekkode:** Kolonnen finnes, men ser ut til å være tom hos A.Markussen (ingen verdier registrert). Verdt å merke seg som ubenyttet funksjon.

**Varekategorier observert:**
- **Grus/pukk/jord** (mest brukt): Bærelag 0-22, Jernbanepukk, Kabelsand 0-8, Kult 0-250, Matjord, Natursingel, Overskuddsmasser, Betong
- **Naturstein:** Altaskifer, Kantstein 12/30 (rett + buet), Murstein Alta, Platekantstein 30/20
- **Betongstein og elementer:** Herregård gråmix helstein, New Jersey element 2m
- **Diverse:** Bark, Byggegjerde, Fiberduk, Gjødsel, Heydi-produkter (Bom Fast, KZ Primer), Kalk
- **Forbruk:** Fugesand
- **Deponiavgift:** egen kategori
- **Utleie Heatwork:** koblet til maskin-internnummer (7626, 7628, 7630, 7632, 7634)

**Enheter i bruk:** m², m³, Tonn, stk, Sekk, Døgn (utleie), Liter, Meter

**Massetransport:** Side finnes (`Trans_agg.aspx`) men er tom — funksjon ikke i aktiv bruk hos A.Markussen.

### Mannskapslister

**Sider:** Oversiktslister, **Byggekortleser oversikt** (fysisk kortleser), **Byggekortoversikt** (kobling kort↔bruker), **Rapportinnsyn (eksterne)**.

**Kolonner:** Navn, Kortnummer, Firma, Org.nummer, Tid inn, Tid ut, Total tid, Fødselsdato, Utløpsdato (HMS-kort), Prosjekt, Underprosjekt, Registreringsdato.

**Periode-filter:** Dagsbasert (én dag om gangen). Ingen registreringer hos A.Markussen for i dag — sannsynligvis ikke daglig brukt eller ikke aktiv på dette prosjektet.

**Implikasjoner:**
- A.Markussen har **fysisk byggekort-leser** — vår geofence + QR-løsning er en mer mobil-vennlig variant
- Støtter **eksterne firmaer** (Firma + Org.nummer per person) — vår mannskap-modul må håndtere underentreprenører på samme måte
- HMS-kort utløpsdato vises i listen — vi har dette i mannskap-modulen
- "Underprosjekt"-kolonne også her — bekrefter at terminologien er gjennomgående i SmartDok

### Kompetanser — meget rik standardliste (77 typer)

**Sider:** Kompetanseoversikt (matrise bruker × kompetanse), **Kompetansetyper** (definisjonsregister), **Brukernes kompetanser** (CRUD-kobling).

**A.Markussen har 47 brukere og 77 kompetansetyper.** Standard bransje-bibliotek:

| Kategori | Eksempler |
|---|---|
| **Maskinførerbevis** (M1-M6 + Mx) | Dozer, Gravemaskin, Veihøvel, Hjullaster, Gravelaster, Dumper |
| **Kranførerbevis** (G4, G8, Gx) | Travers/løpekran, Lastebilkran |
| **Truckførerbevis** (C1-C2, T1-T4, Tx) | Teleskoptruck, Palletruck, Skyvemast, Sidestablende, Motvektstruck |
| **HMS** | HMS-kurs 40 timer, HMS for verneombud, HMS lederopplæring, HLR, Førstehjelp, Fallsikring |
| **Bransje-spesifikt** | ADK1, NS3420-Anleggsdelen, Asbestsanering, Plastsveis, Elektromuffe-sveis, Komprimering MEF, Masseforflytning |
| **Arbeidsvarsling** | Nivå 1, 2, 3 |
| **Sikkerhet** | Liftkurs, Stillasmontør, Varme arbeider, Praktisk slukkeøvelse, Motorsag, Fareblind |
| **Fagbrev** | Anleggsgartner, Tømrer, Betong, Maskin |
| **Kunde-spesifikk** | Statkraft (Energi instruks), STATNETT (Trainor) |
| **«DO» (Dokumentert opplæring)** på spesifikt utstyr | DO Brøyteutstyr, DO CAT 305/316/325/908, DO Dumper, DO Hoppetusse, DO L70 Hjullaster, DO Laser, DO Steinklipe, DO Steinsag, DO Vakumløfter, DO Vinkelsliper |

**Implikasjoner for SiteDoc:**
- Vår mannskap-modul må støtte rikt kompetanseregister med utløpsdato + varsling
- **«DO»-konseptet** (dokumentert opplæring på spesifikt utstyr) er en hybrid mellom kompetanse og maskin-kobling — interessant pattern: «Person X er sertifisert til å bruke maskin Y»
- **Matrise-visning** (bruker × kompetanse) er nyttig admin-UI — markerer hvem mangler hva
- A.Markussens kompetansetypeliste er **migrasjonsverdig** som standardbibliotek for nye SiteDoc-kunder i grunn-/anleggsbransjen
- Kunde-spesifikke (Statkraft, STATNETT) bør være tagger eller egne typer — ulikt for ulike kunder

### Endring/tillegg — SmartDoks løsning er svakere enn vår Godkjenning

Inspisert kort. Tabell-kolonner: Rapport-ID, Tittel, Prosjekt, Underprosjekt, Type, Saksbehandler, Frist, Status. Multi-select status-filter. Periode-filter.

**Konklusjon:** Vår SiteDoc Godkjenning (med malbygger, dokumentflyt, rolle-spesifikk flyt, vedlegg, kommentar-kjede) er rikere enn SmartDoks endringsmelding-modul. Ikke prioritert å migrere SmartDok-data herfra — A.Markussen bruker uansett Proadm for endringshåndtering.

**Implikasjoner for SiteDoc:**
- Tett kobling mellom vareforbruk og maskin (utleie-kategorier referer til maskin-internnummer)
- Grunnentreprenør-fokus: 80% av varene er masser/grus/pukk/naturstein
- Strekkode-funksjon ubrukt — ikke prioriter for A.Markussen, men kan være nyttig for andre kunder
- Deponiavgift som egen vare er praktisk regnskapsteknisk — bør støttes
- Negative «Antall»-verdier: tolkes som «mer forbrukt enn på lager» — saldo som teller ned

## Funksjonsgap — SmartDok har, SiteDoc mangler

Identifisert i forhold til vår nåværende timer-prototype:

### Må bygges før migrering

1. **Lønnsart-register** — modell + admin-UI for opprettelse, kobling til timeføring
2. **Tillegg-register** — egne tillegg per firma (skifttillegg 30/40/50%, beredskap, kloakk-tillegg, etc.)
3. **Allowance / godtgjørelse-register** — diett, overtidsmat, etc.
4. **EmployeeNo + ExternalEmployeeNo** på User — for lønnseksport
5. **Avdeling (Department)** — eller kobles til vår grupper. Beslutning trengs

### Bør bygges (avhenger av A.Markussen sin bruk)

6. **Aktivitet (WorkDescription) + ActivityCategory** — strukturert aktivitetskoding på timer
7. **TripToFromWorkAddition** — reise-tillegg med passasjer/henger-flagg
8. **Resource Planning** — ressursplanlegger (men dette er Fase 4 i vår plan)
9. **Orders / OrderTypes** — endringsmeldinger med eget nummerformat
10. **MarkAsExported / SetExportedExternal** — sporing av hva som er sendt til lønnssystem
11. **Forms / Skjemaer** — vi har sjekklister, men SmartDok har eget Forms-konsept

### Trolig ikke prioritert nå

12. **Goods/Vareforbruk** — A.Markussen kan ha dette i annet system
13. **SupplierInvoices** — leverandørfakturering
14. **SmartMEF** — bransjespesifikt MEF-modul
15. **Webhooks** — for engangs-migrering ikke aktuelt

---

## Migreringsstrategi (når det blir aktuelt)

Faseinndelingen er rekkefølge-styrt, ikke tids-styrt. Cutover-dato avtales separat.

**Fase 1 — Klargjøring (denne fasen er pågående):**
- ✅ Kartlegg API (denne fila)
- [ ] Verifisere API-nøkkel mot `/Users/current` (én test-call, returnerer kun egen brukerinfo)
- [ ] Avklar med A.Markussen: hvilke ressurser brukes faktisk + hva er kritisk
- [ ] Beslutning: avdeling vs. gruppe i SiteDoc
- [ ] Beslutning: EmployeeNo legges til User-modell

**Fase 2 — Bygg manglende SiteDoc-funksjonalitet (blokkerer Fase 3):**
- [ ] Modeller for Wage, Addition, Allowance i `packages/db-timer/`
- [ ] Admin-UI for lønnsart/tillegg-register
- [ ] Utvid User med EmployeeNo + ExternalEmployeeNo
- [ ] Poweroffice-eksportformat (CSV/JSON — må bekreftes med Poweroffice-spec)

**Fase 3 — Skriv import-skript:**
- [ ] `scripts/smartdok/export.ts` — henter alt til JSON-snapshot
- [ ] `scripts/smartdok/import.ts` — leser JSON og skriver til sitedoc_test
- [ ] Mapping-tabell for ID-kobling (SmartDok-int-ID → SiteDoc-uuid)

**Fase 4 — Test og kjør (krever avtalt cutover-dato):**
- [ ] Kjør import mot sitedoc_test
- [ ] A.Markussen verifiserer
- [ ] Kjør mot prod på avtalt cutover-dato
- [ ] SmartDok som lese-backup i én måned

---

## Lønnseksport — Poweroffice (foreløpig antagelse)

A.Markussen bruker sannsynligvis **Poweroffice** som lønnssystem. Dette må bekreftes før vi bygger eksport-funksjonalitet.

Poweroffice støtter:
- **Poweroffice Go** har eget API + import via fil (CSV/Excel)
- Lønnsdata importeres typisk via lønnsfil med ansatt-nr, lønnsart-kode, antall, dato

Implikasjoner:
- SiteDoc-User må ha `EmployeeNo` (ansatt-nr i Poweroffice)
- SiteDoc-Wage må ha `Number` (lønnsart-kode i Poweroffice)
- Eksport-skript må kunne generere fil i Poweroffice-format

Skal undersøkes: er det lønnseksport via SmartDok i dag (manuell fil eller integrasjon)?

---

## Avklarte spørsmål

| Spørsmål | Svar |
|---|---|
| Historikk med? | Nei — utsatt beslutning. Tas opp når kunde og SiteDoc er klare |
| Lønnssystem? | Poweroffice (antagelse — må bekreftes) |
| Cutover-dato? | Ikke avtalt. Avhenger av SiteDoc-modenhet og kundens beredskap |

## Gjenstår å avklare

1. **Avdeling vs. gruppe** — vil A.Markussen ha begge konsepter, eller mappes avdelinger til våre grupper?
2. **Poweroffice-bekreftelse** — riktig system? Hvilket eksportformat brukes i SmartDok i dag?
3. **Vedlegg** — bilder og dokumenter på prosjekter, skal det migreres eller etterlates i SmartDok?
4. **Brukervisning** — vil eksisterende SmartDok-brukere få invitasjons-epost eller direkte aktivering?
5. **Kompetanser** — sertifikater og HMS-kort i SmartDok, mappes til vår mannskap-modul?
