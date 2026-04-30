# SmartDok-undersøkelse — 2026-04-26

**Hensikt:** Empirisk grunnlag for SiteDoc Timer-modul-arkitektur, basert på direkte
observasjon av A.Markussen AS sitt SmartDok-oppsett som autorisert bruker
(Silje Grimstad).

**Metode:** Browser-research via Claude in Chrome, kombinert med DOM-extraction
(JavaScript) for å hente komplette dropdown-data og tabell-data fra både ny
React-app (`web.smartdok.no/app/`) og legacy iframe-sider
(`_legacy/.../*.aspx`).

**Avgrensning:** Dette dokumentet beskriver hva A.Markussen faktisk har konfigurert
og hvordan SmartDok faktisk fungerer i deres oppsett. Det er ikke fasit-svar på
hvordan SmartDok generelt fungerer, men et konkret datapunkt for én etablert
MEF-bedrift.

**Tidligere versjon:** Se [smartdok-undersokelse-2026-04-25.md](smartdok-undersokelse-2026-04-25.md)
for API-kartlegging, OpenAPI-spec, endepunktoversikt og mapping-tabeller fra
første research-runde.

---

## 0. Disclaimer — om bruk av dette dokumentet

Empirisk grunnlag fra én norsk anleggsentreprenør (A.Markussen AS).
Dokumentet er **research-grunnlag for funksjonell forståelse** av timer-,
maskin- og mannskapsregistrering — ikke en mal SiteDoc distribuerer eller
kopierer.

A.Markussens 26 lønnsarter, 7 enhetstillegg og 5 aktiviteter er IKKE
startpakke for nye SiteDoc-kunder. SiteDocs lønnsart-katalog bygges som
tre nivåer (se [timer.md](timer.md)):

- **Nivå 1: Norsk lovpålagt grunnpakke** (16 lønnsarter, auto-importert
  ved firma-opprettelse)
- **Nivå 2: Bransje-relevant tilleggspakke for anlegg/bygg** (25
  lønnsarter, valgfri import som pakke)
- **Nivå 3: Kundens egendefinerte** (opprettes av kunden ved behov;
  SiteDoc leverer ingen mal)

A.Markussens spesifikke lønnsart-koder (148 Brøyte-beredskap, 157 Kloakk
tillegg, 153–155 Skifttillegg 30/40/50%, etc.) hører i Nivå 3 — de er
firma-spesifikke avtaler, ikke en bransjestandard som kan distribueres.

Se Appendiks A for analyse av A.Markussens katalog mot SiteDocs tre-
nivå-modell.

---

## 1. Sammendrag av hovedfunn

1. **Underprosjekt-konseptet hos A.Markussen er ikke strukturelle delprosjekter** —
   det er konkrete arbeidsoppgaver og tilleggsarbeid. Sterkt overlapp med
   FtdChangeEvent. Krever arkitektur-beslutning før Fase 0 påvirkes.

2. **SmartDoks tilgangskontroll per prosjekt gjelder kun administrative roller**
   (Bas, Prosjektadministrator). Vanlige brukere har åpen tilgang for
   timeregistrering. Bekrefter SiteDocs Lag 4-mønster (admin-scope).

3. **Eksport går i tre uavhengige spor** — lønn, prosjektøkonomi (ProAdm) og
   regnskap er tre forskjellige systemer med ulike datakutt.
   **ProAdm er ikke lønnssystem** — det produserer fakturagrunnlag som sendes
   videre til regnskapssystem for faktisk fakturering. Filbasert eksport, ikke API.

4. **Equipment er bredere enn "maskiner"** — A.Markussens register blander
   entreprenørmaskiner, kjøretøy og småverktøy under ett kostnadsbærer-konsept med
   unikt internnummer. Tre datakilder per kategori (MEF Sentralregister,
   Statens Vegvesen, manuell registrering).

5. **A.Markussens timer-policy er stram** — 2-dagers stengning, ledere attesterer
   innen mandag. SiteDoc må håndheve eller tillate konfigurasjon av slike regler.

---

## 2. Kontekst — A.Markussen AS

- **Bransje:** Anleggsentreprenør (MEF-medlem)
- **Brukerlisenser:** 47 av 47 brukt
- **Avdelinger:** 10 (Harstad, Infrastruktur, Kostnader til fordeling, Landskap,
  Narvik, Storgata Nord, Svalbard, Transport, Tromsø, Vedlikehold + "Uten avdeling")
- **Aktive prosjekter:** ~30+ synlig i prosjektliste
- **Aktivitet april 2026:** 3737.53 timer, 189 pause, 45 prosjekter, 34 ansatte,
  839 timer-rader

**Sentral integrasjon (verifisert):**
- ProAdm + ProAdm V4 i SmartDoks eksport-meny
- SmartMEF-modul aktiv (MEF Sentralregister-kobling)

**Sentral integrasjon (ikke verifisert):**
- Lønnssystem — ukjent. Sannsynligvis et av de SmartDok eksporterer til
  (Visma Lønn / Hogia / Huldt & Lillevik er typiske for bygg)
- Regnskapssystem — sannsynligvis PowerOffice (kontering av innkommende
  fakturaer); ikke verifisert om PowerOffice gjør all regnskapsføring eller om
  A.Markussen har et annet system parallelt

---

## 3. Dagsseddel-skjema

### 3.1 Gammel side (`_legacy/WorkHours/register_work_hours.aspx`)

**Felter i rekkefølge:**

| Felt | Type | Notater |
|---|---|---|
| Dato | Datofelt | Default: i dag |
| Ansatte | Multi-select | Leder kan registrere på vegne av flere |
| Prosjekt | Søkbar dropdown | Påkrevd |
| Underprosjekt | Dropdown | Default "Ingen valgt" — IKKE påkrevd |
| Aktivitet | Dropdown | Default "Velg" |
| Timer (Fra/Til) | Klokkeslett | Beregner timer automatisk |
| Pause | Dropdown | Default "0 min", desimal-timer (24 verdier) |
| Lønnsart | Dropdown | Default "Fakturerbar tid" |
| Inkluder lønnsarter ved fravær | Checkbox | Toggler frem fravær-lønnsarter |
| Tillegg (Enhetstillegg) | Antall-felt × 7 | Alle tillegg synlige som tomme felt |
| Kommentar | Fritekst | |
| Maskintimer | Sub-form | Kjørt maskin + Timer + Minutter, "Legg til flere" |
| Registrer uten maskintimer | Checkbox | Eksplisitt opt-out |

**Tre handlingsknapper:**
- Tøm skjema
- **Registrer og godkjenn** (selvgodkjenning)
- **Registrer uten godkjenning** (sender til leder)

### 3.2 Ny side (React-detaljpanel via Godkjenn timer)

Fire collapsible seksjoner per arbeidsdag-detalj:

**Generelt** — Kalendervisning av timer per dag, ukentlig og månedlig totalsum

**Timer** — Utvidet skjema:
- Dato / Fra / Til / Pause / Antall timer (auto)
- Prosjekt / Underprosjekt / Aktivitet / Lønnsart
- **Diett** (egen dropdown — finnes ikke på gammel side)
- Kommentar (fra ansatt)
- **Kommentar fra administrator** (toveis-kommunikasjon — leder kan svare)

**Tillegg** — Dropdown + antall + X-knapp + "Legg til tillegg" (kompakt UI vs.
gammel side som viste alle tomme)

**Maskiner** — Sub-form med valg fra maskinregister

**Informasjon om registrering** — Audit-spor:
- Navn (ansatt)
- Registrert av (kan være annen enn ansatt)
- Tidspunkt for registrering
- Avdeling
- Gruppe

---

## 4. Konfigurerbare entiteter (firma-nivå)

### 4.1 Lønnsarter (26 totalt)

**11 ordinære (arbeidstid):**

| Kode | Navn |
|---|---|
| 127 | Fakturerbar tid |
| 128 | Praksistimer |
| 129 | Timer innleid arbeidskraft |
| 120 | Timer |
| 122 | Reise/transport til/fra prosjekter |
| 170 | Overtid 50% |
| 175 | Overtid 100% |
| 172 | OT lærling 50% |
| 177 | OT lærling 100% |
| 142 | Skifttillegg lærling 30% |
| 109 | Timer prosjektleder |

**15 fravær-typer** (delt på "Fastlønn" og "Timelønn"-varianter):

| Kode | Navn | Type |
|---|---|---|
| 223 | Barns sykdom - Fastlønn | Fravær |
| 220 | Egenmelding inntil 3 dager - Fastlønn | Fravær |
| 132 | Ferie m/lønn Fastlønn | Fravær |
| 136 | Permittering u/lønn | Fravær |
| 137 | Permittering m/lønn | Fravær |
| 221 | Sykemelding 1-16 dag - Fastlønn | Fravær |
| 130 | Fravær m/lønn timelønn | Fravær |
| 240 | Bevegelig helligdag timelønn | Fravær |
| 225 | Egenmelding inntil 3 dager Timelønn | Fravær |
| 226 | Sykemelding 1.-16. dag Timelønn | Fravær |
| 227 | Sykemelding fra 17. dag | Fravær |
| 228 | Barns sykdom Timelønn | Fravær |
| 135 | Fravær u/lønn | Fravær |
| 131 | Ferie m/lønn Timelønn | Fravær |
| 134 | Ferie u/lønn | Fravær |

**Detaljskjema for lønnsart:**
Type, Kode, Navn, Aktiv, Skal eksporteres, Tvungen kommentar, Pris mot kunde,
Internkostnad, Rekkefølge

### 4.2 Aktiviteter (5 totalt)

| Kode | Navn | Internkostnad | Pris mot kunde |
|---|---|---|---|
| 11 | Anleggsarbeid | 1,00 | 1,00 |
| 15 | Ekstra Arbeid | 0,00 | 0,00 |
| 14 | Garanti/reklamasjon | 0,00 | 0,00 |
| 18 | Maskintimer | 0,00 | 0,00 |
| 17 | Regulering lønn | 0,00 | 0,00 |

**Detaljskjema:** Type, Kode, Navn, Internkostnad, Pris mot kunde, Aktiv

**Merk:** Anleggsarbeid har 1,00/1,00 — sannsynligvis multiplikator-rolle eller
default-prising. Ekstra Arbeid har 0,00 fordi det skal prises spesifikt per
fakturagrunnlag.

### 4.3 Enhetstillegg (7 totalt)

| Kode | Navn | Tvungen kommentar |
|---|---|---|
| 248 | Regulering Lønn | nei |
| 157 | Kloakk tillegg | **ja** |
| 148 | Brøyte-beredskap | nei |
| 149 | Overordnet vakt/beredskap | nei |
| 153 | Skifttillegg 30% | nei |
| 154 | Skifttillegg 40% | nei |
| 155 | Skifttillegg 50% | nei |

**Detaljskjema:** Type, Kode (maks 15 tegn), Navn (maks 50 tegn), Aktiv,
Skal eksporteres, Tvungen kommentar, Pris mot kunde, Internkostnad, **Rekkefølge**

### 4.4 Diett-tabell (struktur — tom hos A.Markussen)

Kode, Navn, **Sats**, Tvungen kommentar

### 4.5 Regler (struktur — tom hos A.Markussen)

**Tre seksjoner i regel-skjema:**
- Informasjon om regelen (Tittel, Status, Type)
- Gjelder for
- Når det gjelder

**Type-dropdown har 4 verdier:**
- Lønnsart
- Tillegg
- Enhetstillegg
- **Timekonto** (sannsynligvis fleksitid/avspasering — ikke verifisert)

**Liste-kolonner:** Tittel, Lønnsart, Prosjekt, Gruppe, Gjelder alle grupper,
Periode

### 4.6 Avdelinger (10)

| Nummer | Navn |
|---|---|
| 3 | Harstad |
| 12 | Infrastruktur |
| 10 | Kostnader til fordeling |
| 11 | Landskap |
| 1 | Narvik |
| 562 | Storgata Nord |
| 5 | Svalbard |
| 14 | Transport |
| 2 | Tromsø |
| 13 | Vedlikehold |

(I tillegg: "Uten avdeling" som default).

### 4.7 Grupper (tom hos A.Markussen)

**Liste-kolonner som indikerer formålet:**
Navn, Antall medlemmer, **Lønnsarter, Tillegg, Enhetstillegg, Diett, Aktiviteter**

**Tolkning:** Gruppe-mekanismen begrenser hvilke lønnsarter / tillegg /
aktiviteter en gruppe kan velge i timer-skjemaet. A.Markussen bruker det ikke —
alle ansatte har åpen tilgang til alt. Mekanismen ligner SiteDocs planlagte
modul-gating.

### 4.8 Pause-verdier (24 totalt)

0–115 min i 5-minutters steg, lagret som desimaltimer (`0,00` til `1,92`).

---

## 5. Equipment-register (utvidet — bredere enn "maskiner")

### 5.1 Volum og struktur

A.Markussen har **126 oppføringer** i SmartDoks "Maskin"-register. Dette er
ikke bare entreprenørmaskiner — registret blander tre typer kostnadsbærere:

- **Tunge maskiner** (Cat 305/308/315/325, Hamm vals, Hydrema dumper, Case 721G)
- **Kjøretøy** (varebiler 7022 Mitsubishi Fuso, 7034 CADDY, 7051 VW Transporter,
  7053 Toyota Proace, 7054 Ford Ranger, 7085 E-Golf, kranbiler, lastebiler)
- **Småverktøy/utstyr** (Hilti meiselmaskin, hoppetusse, generator/aggregat,
  vakuum-kantsteinsløfter, GPS-utstyr som Trimble R12i)

### 5.2 Maskin-modul faner

Egen seksjon i SmartDok med fem faner:
- **Maskinoversikt** — Hovedlisten
- **Maskinmerknader** — Notater per maskin
- **Serviceintervaller** — Vedlikeholdsplan
- **Drivstoff** — Drivstoff-forbruk
- **Feilmeldinger** — Status/problemer

**Sidemeny-funksjoner:**
- Ny verkstedordre
- Skjema mot maskin
- Verkstedordre oversikt
- Importer maskiner

### 5.3 Maskin-tabell kolonner

Maskin (navn), **Internnummer**, **Reg.nr**, **Maskinkode**, **Årsmodell**,
**Lokasjon** (hvor maskinen står nå), **Sist endret**, **Maskinansvarlig 1**,
**Maskinansvarlig 2**, Status

### 5.4 Internnummer-konvensjon hos A.Markussen

A.Markussen bruker en **bedrifts-egen kategorisering** via internnummer-rom —
ikke håndhevet av SmartDok:

| Nummerserie | Hva |
|---|---|
| **7XXX** (7019–7845) | **Eget utstyr og kjøretøy** (76% av oppføringer) |
| **9XXX** (9000–9012) | **Leid utstyr** (14%) |

**Eksempler på leie-konvensjonen:**
- 9000 Leiemaskin
- 9001 Leiebil
- 9002 Leie Lastebil
- 9007 Cat 315 Leiemaskin
- 9009 Hydrema 912 Leiedumper

### 5.5 Datakvalitets-observasjoner

| Observasjon | Andel av synlige rader |
|---|---|
| Navn starter med 4-sifret prefiks | 89% |
| Navn IKKE prefikset | 11% (eksempler: "CAT Hammer H115S", "Cramer 82ZT107", "Spartveit DKJ-3P") |
| Internnummer-felt utfylt korrekt | 92% |
| Internnummer = 0 (ikke utfylt) | 8% |
| Reg.nr = "UREG" (eksplisitt uregistrert) | 37% |
| Reg.nr tomt | 58% |
| Reg.nr ekte (vegregistrerte kjøretøy) | 4% |

**Test-data:** En "x | int:x"-rad ble funnet — sannsynligvis test-oppføring
som aldri ble slettet.

### 5.6 Datakilder per kategori (fra Kenneth)

| Kategori | Sync-kilde | Sync-strategi |
|---|---|---|
| Maskin (entreprenør) | sentralregisteret.no (MEF) | Automatisk |
| Kjøretøy med reg.nr | Statens Vegvesen | Automatisk (allerede implementert i SiteDoc; Opus har kontroll) |
| Småverktøy | Manuell registrering | Bruker fyller inn |

### 5.7 Designprinsipp (fra Kenneth)

- Kunden avgjør hva som er hensiktsmessig å registrere — SiteDoc skal **ikke
  vurdere terskel**
- ID-rommet må være romslig nok til at en kunde kan velge å registrere alt fra
  en gravemaskin til en drill
- Internnummer i eget felt — **ikke parse fra navn**, navn-format er ikke
  pålitelig

### 5.8 Implikasjon for SiteDoc-arkitektur

Maskin-modulen som er under bygging må håndtere alle tre kategorier som
varianter:

```
Equipment (firma-eid, har unik ID, kostnadsføres mot prosjekt)
├── kategori: maskin / kjøretøy / småverktøy
├── intern_id (felles ID-rom på tvers av kategorier)
├── ekstern_id + sync-kilde (avhengig av kategori)
├── timer-pris (intern + ekstern, kan være null)
├── lokasjon (nåværende prosjekt-tilknytning)
├── ansvarlig_1 + ansvarlig_2 (User-FK)
└── status

Sync per kategori:
- maskin → MEF Sentralregister
- kjøretøy → Statens Vegvesen (allerede implementert)
- småverktøy → manuell
```

---

## 6. Brukere og roller

### 6.1 Bruker-felter (synlige i liste)

Navn, **Ansattnummer** (3-sifret), Rolle/Tilgangsnivå, Avdeling, Gruppe,
Brukernavn, E-post, **HMS-kort utløpsdato**

HMS-kort har eget varselsystem — Anne Nordeng ble vist med varsel-ikon
(utløper 22.06.2026, 2 måneder frem i tid).

### 6.2 Standard tilgangsnivåer (7) + custom

| Tilgangsnivå | Rolle | Antall hos A.Markussen |
|---|---|---|
| Standard brukertilgang | Bruker | flesteparten |
| Standard bas-/formanntilgang | Bas | få |
| Standard prosjektadministratortilgang | Prosjektadministrator | flere |
| Standard administratortilgang | Administrator | ~5 (Anne, Christopher, Florian, Eirik, Afrim) |
| Standard gjestetilgang | Gjest | 0 |
| Standard underentreprenør-tilgang | **Underentreprenør** | 0 |
| Standard tilgang for ansatt uten innlogging | **Ansatt uten innlogging** | 0 |
| Infrakraft (custom) | Bas | 1 |

**To roller jeg ikke har sett tidligere:**
- **Underentreprenør** — for innleid arbeidskraft fra annet firma
- **Ansatt uten innlogging** — for ansatt som registreres av andre, men ikke
  logger inn selv

### 6.3 Kompetansetyper (ikke verifisert)

Egen fane under Brukere — ikke åpnet i denne sesjonen. Relevant for SiteDocs
planlagte Kompetanseregister (del av Timer-modulen).

---

## 7. Tilgangskontroll-arkitektur

**Kritisk klargjøring fra hjelpetekst i SmartDok:**

> "Her kan du velge å gi **Bas og Prosjektadministratorer** tilganger/rettigheter
> knyttet opp mot prosjekter."

Per-prosjekt-tilgangsstyring i SmartDok gjelder **kun for administrative
roller** — ikke vanlige brukere. Vanlige brukere ser alle firmaets prosjekter
for timeregistrering.

**Verifisert eksempel:**
Daniel Pedersen (Prosjektadministrator) har tilgang til kun 2 av 30+ prosjekter
(632 E8 Båthavna, 700 Transport). Det er administrativ scope-begrensning, ikke
en restriksjon på timeregistrering.

**To faner i Tilgangskontroll-siden:**
- **Prosjekt** — velg prosjekt, så hvilke admin-roller som har tilgang
- **Ansatt** — velg admin-rolle-bruker, så hvilke prosjekter den styrer

UX: Overflytt-listebokser (venstre = uten tilgang, høyre = med tilgang).

**Implikasjon for SiteDocs 7-lag-modell:**
Bekrefter at SiteDocs Lag 4 (prosjekt-admin med scope) er riktig modellert.
Vanlige produksjons-brukere har åpen tilgang innenfor firma; det er kun
admin-roller som scopes per prosjekt.

---

## 8. Status-flyt og godkjenning

**4 statuser** på timer-poster:
- Ikke godkjent
- Handling kreves
- Delvis godkjent
- Godkjent

**3-trinns flyt-indikator** (3 prikker per rad i godkjenningsoversikt) —
sannsynligvis: ansatt-registrering → leder-attestering → endelig godkjenning.

**Godkjennings-fane-struktur:**
- Oversikt
- Totaloversikt
- Lønnsrapport
- Etterspør godkjenning (purring)
- Siste registreringer
- Månedlig oversikt
- Eksporter timer

---

## 9. Eksport-arkitektur

### 9.1 Tre uavhengige spor

Timer-eksport går til **tre forskjellige systemer med ulike datakutt og
formål** — viktig at disse ikke blandes:

| Spor | Datakilde | Mottaker | Datakutt | Frekvens |
|---|---|---|---|---|
| **Lønnsspor** | Timer (kun arbeidskraft) | Lønnssystem | Per ansatt × lønnsart × periode | Månedlig |
| **Prosjektøkonomi-spor** | Timer (arbeidskraft + Equipment-bruk) + Vareforbruk | **ProAdm** | Per prosjekt × aktivitet × kost-type | Kontinuerlig |
| **Regnskapsspor** | ProAdm fakturagrunnlag → Regnskap | Regnskapssystem | Per kunde × faktura | Kontinuerlig |

**Viktig om ProAdm:**
- ProAdm er **prosjektøkonomi-system**, ikke regnskap og ikke lønn
- ProAdm produserer **fakturagrunnlag** som sendes til regnskapssystem for
  faktisk fakturering og bokføring
- Regnskapsporet (ProAdm → Regnskapssystem) er **utenfor SmartDok/SiteDocs
  ansvar** — det er en separat integrasjon fra ProAdm til regnskap

**Konsekvens for SiteDoc Timer-modul:**
- Eksport til lønnssystem skal **filtrere ut** Equipment-bruk og kun ta
  arbeidskraft
- Eksport til ProAdm skal ta **alt**: timer + Equipment-bruk
  (maskiner/kjøretøy/småverktøy) + vareforbruk
- DO-koblings-modulen (i Kenneths fase-plan) er eksport til ProAdm — IKKE
  direkte regnskap-integrasjon

### 9.2 Implementasjon i SmartDok

**Filbasert eksport** (ikke API). Bruker velger:
- Periode (datointervall)
- Avdelinger (multi-select; default alle)
- Gruppe (single-select)
- System (klikk på ønsket system → fil-nedlasting)

**Tre kontroll-flagg:**
- Inkluder tidligere eksporterte timer
- Ikke merk timer som eksportert (re-eksport)
- "Eksportert"-flagg per timeregistrering forhindrer dobbel-eksport

**Prerequisite:** Kun attesterte (godkjente) timer eksporteres. Lønnsart-konfig
avgjør om en lønnsart skal eksporteres.

### 9.3 Støttede systemer (25+)

| Kategori | Systemer |
|---|---|
| Lønn (typisk) | Visma Lønn (mange varianter inkl. lønn %, Bunt, Ent.HRM, Contracting, fravær, Payroll, Payroll %), Hogia (lønn, lønn-bunt, lön SWE, lön+ SWE), Huldt & Lillevik (lønn, fravær, %), Agda + Agda fravær, Personec, Midas, Visma Scenario |
| Prosjektøkonomi | **ProAdm**, **ProAdm V4**, Tripletex, UNI Økonomi (3 versjoner), Cordel |
| Andre/regnskap | Mamut, DI-systemer, Concorde, Zirius, Xledger.NET |

---

## 10. A.Markussens timer-rutiner (firma-policy)

Hentet direkte fra `/app/workhours/view-workhour-registration-routines`:

**Metoder (timeregistrering):**
1. Samtlige timer for personell og maskiner registreres i SmartDok
2. Materiell registreres i SmartDok
3. **Tilleggsarbeider og kjøring for andre registreres i tillegg på
   time-/kjøreseddel (A5-format). Timene skal signeres av oppdragsgiver**
4. Registreringene skal være så nøyaktig som mulig
5. Det skal kun registreres ett prosjekt pr timeseddel
6. Fastansatte og sesongansatte fører alle sine egne timer
7. **Etter 2 dager blir timeregistreringen stengt og timer blir tapt**

**Generelle rutiner:**
1. Arbeidstid registreres iht. den til enhver tid gjeldende «arbeidstidsavtale»
2. ALLE ansatte skal daglig registrere timer fortløpende
3. **Prosjektledere og anleggsledere attesterer timene innen mandag i
   påfølgende uke**

**Tilleggsarbeid/kjøreseddel-rutiner:**
- A5-format papirseddel for tilleggsarbeid hos kunde (parallelt med digital
  registrering)
- Hvit seddel (original): leveres oppdragsgiver
- Gul seddel (kopi): leveres prosjektleder
- Rød seddel (kopi): blir i timeboken
- Time-/kjøresedler leveres minst en gang pr uke til prosjektleder

**Implikasjon for SiteDoc:**
- 2-dagers stengning er en konfigurerbar firma-regel, ikke hardkodet
- Mandag-attestering må kunne automatiseres (purring)
- Det digitale skiftet bør eliminere A5-seddel-flyten ved å bygge
  signering/kunde-attestering inn i timer-eksport-flow

---

## 11. Underprosjekt — kritisk arkitektur-funn

### 11.1 Volum

| Nivå | Antall |
|---|---|
| Underprosjekter på tvers av alle prosjekter | 1468 |
| Underprosjekter på ETT prosjekt (494 Vervet) | 54 |

### 11.2 Karakteristikk av A.Markussens underprosjekter

Komplett liste av 54 underprosjekter på prosjekt 494 (Vervet - slipptorget og
kaipromenaden) viser et tydelig mønster:

**Noen er nummererte/strukturelle:**
- 002 Acodrain meglerkontor
- 049 Oppretting heller lagt uten bøyler

**Mange er konkrete arbeidsoppgaver:**
- Avdekking kabler til trekkekum
- Brøyting snø for Pilar nordside
- Fjerning byggeplassgjerde
- Kapping av stein på riggområde
- Smågatestein i møbleringsfelt

**Flere er klart tilleggsarbeid/endringer:**
- Plunder og heft
- Heftelse grunnet stengt veg
- Heftelser langs kaifronten/i park
- Omprosjektering grunnet OPI
- Omprosjektering park
- Oppretting av påkjørte heller
- Venting grunnet søppel

### 11.3 Underprosjekt-eierskap (rikere enn jeg trodde)

Detaljpanel for et underprosjekt har 5 seksjoner:
1. Detaljer (grunninfo)
2. **Posisjon** (GPS-koordinater)
3. **Administrasjon** — egen HMS-ansvarlig + Kvalitetsansvarlig
4. **Kortlesere** (fysisk byggekortleser kobles per underprosjekt)
5. **Tilkoblinger** (HMSREG-nummer for myndighetskobling)

Underprosjekt eier altså mer enn bare en timer-kategori — det har egne
ansvarspersoner, lokasjon, fysisk kortleser-tilknytning og HMSREG-registrering.

### 11.4 Implikasjon for SiteDoc-arkitektur

**Konflikt med tidligere antagelse:**
`docs/claude/timer.md` modellerte Underprosjekt som avledning fra
endringsmelding/godkjenning (kilde: "proadm" | "sitedoc_godkjenning").
Datafunnene viser at det er en **strukturell prosjekt-entitet med egen
identitet**, ikke en avledning.

**Overlapp med FtdChangeEvent (varsel/varsel om endring/endringsmelding/
regningsarbeid):**
Mange av A.Markussens underprosjekter er klart kategori "endringsmelding"
("Plunder og heft", "Heftelse grunnet stengt veg", "Omprosjektering grunnet
OPI"). Disse registreres dobbelt i dag: som underprosjekt i timer-systemet og
som endringshendelse i økonomi-systemet (ProAdm).

**Tre alternativer (avventer Kenneth-beslutning):**

| Alternativ | Beskrivelse | Konsekvens |
|---|---|---|
| **A** | Underprosjekt overordnet i `packages/db`, FtdChangeEvent kobler til underprosjekt | Underprosjekt blir kjerne-entitet, FtdChangeEvent en "avledning" |
| **B** | FtdChangeEvent kjerne, Timer kobler direkte | Underprosjekt forsvinner som konsept; alt blir change-events |
| **C** (hybrid) | To separate modeller med valgfri kobling | Mer fleksibelt, men dobbeltregistrering kan vedvare |

SmartDok-data **styrker valg A** eller hybrid C: Underprosjekt er strukturell
prosjekt-inndeling (med GPS, ansvarspersoner, HMSREG, byggekortleser),
FtdChangeEvent er én av flere kilder til opprettelse av underprosjekt.

---

## 12. Kritiske implikasjoner for SiteDoc-arkitektur

### 12.1 Underprosjekt-modellen (Fase 0-blokker)

Krever beslutning før Fase 0-koding kan starte. Anbefaling: **Alternativ A**
(Underprosjekt som kjerne-entitet i `packages/db`, eier GPS / HMS-ansvarlig /
HMSREG / kortleser-tilknytning, FtdChangeEvent kobler valgfritt mot
underprosjekt).

### 12.2 Lønnsart-modellen

- Single-table med `type`-felt (Ordinær/Fravær)
- Eksport-flagg per lønnsart
- Tvungen kommentar-flagg
- Internkostnad + Pris mot kunde + Rekkefølge

### 12.3 Equipment-modellen (utvidet bredde)

Bredere enn opprinnelig "Maskin"-modul — dekker tre kategorier under ett
kostnadsbærer-konsept:

```
Equipment (firma-eid, har unik ID, kostnadsføres mot prosjekt)
├── kategori: maskin / kjøretøy / småverktøy
├── intern_id (felles ID-rom; bedrift-egen kategorisering tillatt)
├── ekstern_id + sync-kilde (avhengig av kategori)
├── timer-pris (intern + ekstern, kan være null)
├── lokasjon (nåværende prosjekt)
├── ansvarlig_1, ansvarlig_2 (User-FK)
└── status (aktiv/inaktiv/varsler)
```

Maskin-modulen som er under bygging må utvides eller modul-laget må håndtere
disse tre kategoriene som varianter.

**Datakvalitet:** SiteDoc bør ikke håndheve at navn skal starte med
internnummer-prefiks. Internnummer i eget felt, navn-felt er fri tekst.

### 12.4 Tilgangskontroll (bekreftet eksisterende modell)

SiteDocs 7-lag-modell + 2-akser er korrekt. Per-prosjekt-scope er administrativ
(Lag 4), ikke produksjons-restriksjon. Vurder å legge til:
- **Underentreprenør-rolle** (innleid arbeidskraft fra annet firma)
- **Ansatt uten innlogging** (registreres av andre, ingen brukerkonto)

Disse passer inn i Lag 1 (firma-ansatt) som varianter, eller som egne
sub-kategorier.

### 12.5 Eksport-arkitektur (to spor i Timer-modulen)

Timer-modulens eksport-lag må støtte to parallelle spor:

| Spor | Mottaker | Filtrer ut |
|---|---|---|
| Lønn | Lønnssystem | Equipment-bruk, vareforbruk |
| Prosjektøkonomi | **ProAdm** | (Ingenting — alt med) |

**Regnskapsporet** (ProAdm-fakturagrunnlag → Regnskap) er ikke SiteDocs
ansvar — det er en separat integrasjon fra ProAdm til kundens regnskapssystem.

### 12.6 Tillegg/Diett som separate konfigurerbare tabeller

Skal **ikke** modelleres som lønnsart-varianter:

```
Tillegg (Enhetstillegg)
├── kode, navn, type
├── pris mot kunde, internkostnad
├── tvungen_kommentar (bool)
├── skal_eksporteres (bool)
└── rekkefølge (sortering på registreringsskjerm)

Diett
├── kode, navn
├── sats
└── tvungen_kommentar
```

### 12.7 Timekonto (potensiell Fase 7-funksjon)

Sett som regel-type i SmartDok — sannsynligvis fleksitid/avspasering. Ikke
verifisert. Notér som mulig fremtidig modul.

### 12.8 Konfigurerbar firma-policy

A.Markussens 2-dagers stengning og mandag-attestering er **firma-konfigurerbare
regler**, ikke hardkodet logikk. OrganizationSetting (i Fase 0) bør støtte:

- `timer_lock_after_days` (int)
- `attestasjon_frist` (ukedag + tidspunkt)
- Andre firma-policy-flagg som dukker opp

### 12.9 HMS-kort utløpsdato på User

Eget felt på User med varsling før utløp. Ikke en del av kompetansemodul, men
en egen attributt på bruker. Notér for User-utvidelse i Fase 0.

---

## 13. Åpne spørsmål

Disse er ikke arkitektur-blokker, men bør verifiseres før Timer-modul-koding:

1. **Hvilket lønnssystem bruker A.Markussen?** Sannsynligvis et av de SmartDok
   eksporterer til, men ikke verifisert. Kan sjekkes via "Inkluder tidligere
   eksporterte timer"-historikk.

2. **Hvilket regnskapssystem bruker A.Markussen?** PowerOffice antydet for
   kontering av innkommende fakturaer; ikke verifisert om PowerOffice gjør all
   regnskapsføring.

3. **Vareforbruk-modulens eksport-rute** — eksporterer den til ProAdm direkte
   eller går materiell via annen rute (f.eks. registrering direkte i ProAdm)?

4. **Kompetansetyper-strukturen** i SmartDok (under Brukere-fanen) — relevant
   for SiteDocs Kompetanseregister i Fase 3.

5. **Mine timer / Registrer mine timer-UI** — egen-registrerings-skjermen for
   vanlig ansatt. Antas å være samme datamodell som leder-registrering, men
   UI-flyten er ikke verifisert.

6. **Equipment-bruk i lønn-eksport** — verifiser at maskintimer/kjøretøytimer
   faktisk filtreres ut når man eksporterer til lønnssystem.

---

## 14. Anbefalt neste steg

1. **Trinn 1.5-analyse i ny Code-chat:** Beslutning på Underprosjekt vs
   FtdChangeEvent (Alt A / B / C). Anbefaling: Alt A.

2. **Refaktorering av `docs/claude/timer.md`:** Bytt `enterpriseId` →
   `organizationId`, flytt `enterprise_settings` inn i `OrganizationSetting`,
   juster Underprosjekt-arkitektur etter beslutning.

3. **8 gjenværende treffpunkter mot Fase 0** (fra opprinnelig Code-plan):
   - OrganizationSetting (arbeidstidskalender, dagsnorm, overtidsterskler,
     timer_lock_after_days)
   - Lønnsart-katalog
   - User-utvidelse (ansattnummer, externalEmployeeNo, HMS-kort utløpsdato)
   - Tilleggsregler (Regler-tabell-strukturen)
   - Godkjenningsroller
   - Dagsseddel-felter (komplett spec klar fra dette dokumentet)
   - HMS-kobling
   - Kompetanseregister (separat verifisering trengs)

4. **Etter timer-planlegging er ferdig:** Oppdater `fase-0-beslutninger.md`
   hvis justeringer kreves, deretter starter Fase 0-koding.

---

## Appendiks A — A.Markussens katalog scoret mot SiteDocs tre-nivå-modell

Analytisk speiling av A.Markussens lønnsart- og tillegg-katalog (datert
2026-04-26) mot SiteDocs tre-nivå-modell. Brukes til å verifisere at
tre-nivå-modellen dekker faktisk bruk uten å kopiere katalogen.

### A.1 A.Markussens 11 ordinære lønnsarter

| Kode | Navn | SiteDoc-nivå |
|---|---|---|
| 120 | Timer | Nivå 1 («Timelønn») |
| 127 | Fakturerbar tid | Nivå 2 |
| 128 | Praksistimer | Nivå 2 |
| 129 | Timer innleid arbeidskraft | Nivå 2 |
| 122 | Reise/transport til/fra prosjekter | Nivå 2 |
| 170 | Overtid 50% | Nivå 1 |
| 175 | Overtid 100% | Nivå 1 |
| 172 | OT lærling 50% | Nivå 2 |
| 177 | OT lærling 100% | Nivå 2 |
| 142 | Skifttillegg lærling 30% | Nivå 3 (avvikende lærling-skift) |
| 109 | Timer prosjektleder | Nivå 2 |

### A.2 A.Markussens 15 fravær-typer

| Kode | Navn | SiteDoc-nivå |
|---|---|---|
| 130 | Fravær m/lønn timelønn | Nivå 2 («Velferdspermisjon» — bedriftsavtale) |
| 131 | Ferie m/lønn timelønn | Nivå 1 |
| 132 | Ferie m/lønn fastlønn | Nivå 1 |
| 134 | Ferie u/lønn | Nivå 1 |
| 135 | Fravær u/lønn | Nivå 2 (velferdspermisjon-variant) |
| 136 | Permittering u/lønn | Nivå 1 |
| 137 | Permittering m/lønn | Nivå 1 |
| 220 | Egenmelding 1–3 d fastlønn | Nivå 1 |
| 221 | Sykemelding 1–16 d fastlønn | Nivå 1 |
| 223 | Barns sykdom fastlønn | Nivå 1 |
| 225 | Egenmelding 1–3 d timelønn | Nivå 1 |
| 226 | Sykemelding 1–16 d timelønn | Nivå 1 |
| 227 | Sykemelding fra 17. dag | Nivå 1 |
| 228 | Barns sykdom timelønn | Nivå 1 |
| 240 | Bevegelig helligdag timelønn | Nivå 1 |

### A.3 A.Markussens 7 enhetstillegg

| Kode | Navn | SiteDoc-nivå |
|---|---|---|
| 248 | Regulering Lønn | Nivå 3 (firma-spesifikk) |
| 157 | Kloakk tillegg | Nivå 3 (kommunalt anlegg-spesifikt) |
| 148 | Brøyte-beredskap | Nivå 3 (vintervaktordning) |
| 149 | Overordnet vakt/beredskap | Nivå 3 (firma-spesifikk avtale) |
| 153 | Skifttillegg 30% | Nivå 3 (avvikende sats) |
| 154 | Skifttillegg 40% | Nivå 3 (avvikende sats) |
| 155 | Skifttillegg 50% | Nivå 3 (avvikende sats) |

### A.4 Konklusjon fra speilingen

Av A.Markussens 33 poster (26 lønnsarter + 7 enhetstillegg):

- **16 dekkes av Nivå 1** (auto-importert ved firma-opprettelse) — 3 ordinære lønnsarter (120 Timer, 170 Overtid 50%, 175 Overtid 100%) + 13 fravær-typer
- **9 dekkes av Nivå 2** (bransje-pakke som A.Markussen kunne valgt) — 7 ordinære lønnsarter + 2 fravær-varianter (Velferdspermisjon)
- **8 hører i Nivå 3** (firma-spesifikke — A.Markussen oppretter selv) — 1 ordinær lønnsart (142 Skifttillegg lærling 30%) + 7 enhetstillegg

> **Merknad om tellingen:** Nivå 1 og 2 i SiteDocs grunnpakke har **16** og **25** lønnsarter som strukturell bredde (se [timer.md](timer.md)). Tallet **16 / 9 / 8** her er noe annet — det er scoring av hvordan A.Markussens **33 poster** fordeler seg over de tre nivåene (hvor mange A.Markussen-poster som matcher hvert nivå). De to tallsettene betyr ulike ting og må ikke forveksles.

Speilingen verifiserer at tre-nivå-modellen dekker en reell katalog uten å kopiere den. Bekrefter også at firma-spesifikke avtaler (skiftsatser, vaktordninger, anleggs-spesifikke tillegg) ikke skal generaliseres til standardpakker.
