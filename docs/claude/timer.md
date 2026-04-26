# Timeregistrering — Fase 3

## Formål

Timeregistrering for ansatte på byggeprosjekter. Offline-first — feltarbeidere registrerer timer uten nettdekning, synkroniserer når dekning er tilbake. Registrering fra mobil, administrasjon fra web.

## Appstruktur

| Komponent | Plassering | Beskrivelse |
|-----------|------------|-------------|
| **Web** | `apps/timer` | Next.js, `timer.sitedoc.no` — administrasjon, rapporter, eksport |
| **Mobil** | Isolert modul i `apps/mobile` | React Native, offline-first via SQLite — daglig registrering |
| **Database** | `packages/db-timer` | Eget Prisma-skjema, aldri inn i `packages/db` |

Deler PostgreSQL-instans med SiteDoc, men helt separate tabeller. Delt auth via eksisterende `sessions`-tabell.

## Dagsseddel-modell

Én **dagsseddel** per arbeidsdag samler alt: arbeidstimer, lønnsarter, reisetid, tillegg, maskinbruk og materialforbruk.

### Prinsipp

Systemet skiller alltid mellom:
- **Arbeidstid** — grunnlag for overtidsberegning (normaltid + overtid)
- **Betalte tillegg** — reisetid, kost, natt, helg — teller IKKE som arbeidstid
- **Maskinbruk** — timer per maskin med valgfri mengde
- **Materialforbruk** — mengde med enhet

Disse er separate kolonner i eksport til lønnssystem.

### Lønnsart-katalog (datadrevet, tre-nivå)

Lønnsart-katalogen er per Organization og bygges som tre nivåer.

#### Nivå 1 — Norsk lovpålagt grunnpakke (16 lønnsarter)

Auto-importeres ved firma-opprettelse via seed-mekanisme (event-hook `onOrganizationCreated`, etablert i Fase 0). Ingen bransje-bias. Pålagt av norsk lov (arbeidsmiljølov, ferielov, folketrygdlov, a-melding-krav).

| Kategori | Lønnsart | Lovgrunnlag |
|---|---|---|
| Grunnlønn | Fastlønn (månedslønn) | Arbeidsmiljølov |
| Grunnlønn | Timelønn | Arbeidsmiljølov |
| Overtid | Overtid 50% | AML § 10-6 |
| Overtid | Overtid 100% | AML § 10-6 + tariff |
| Fravær | Sykemelding 1–16 dager (fastlønn) | Folketrygdloven § 8 |
| Fravær | Sykemelding 1–16 dager (timelønn) | Folketrygdloven § 8 |
| Fravær | Sykemelding fra dag 17 | Folketrygdloven § 8 |
| Fravær | Egenmelding inntil 3 dager | Folketrygdloven § 8-23 |
| Fravær | Barns sykdom | Folketrygdloven § 9-5 |
| Fravær | Ferie m/lønn | Ferieloven |
| Fravær | Ferie u/lønn | Ferieloven |
| Fravær | Permittering m/lønn | Permitteringsloven |
| Fravær | Permittering u/lønn | Permitteringsloven |
| Fravær | Bevegelig helligdag | A-melding-krav |
| Feriepenger | Feriepenger 12% | Ferieloven minimum |
| Feriepenger | Feriepenger ved avslutning (inneværende år) | Ferieloven |

#### Nivå 2 — Bransje-relevant tilleggspakke for anlegg/bygg (25 lønnsarter)

Valgfri import ved onboarding. Pakke-orientert UX: vises som «Bransje: Anlegg/bygg (25 lønnsarter)» med «Vis detaljer»-knapp som ekspanderer listen. Standard: importer hele pakken eller hopp over — ikke 25 enkeltsjekkbokser.

| Kategori | Lønnsart | Brukstilfelle |
|---|---|---|
| Permisjon | Velferdspermisjon | Bedriftsavtale eller tariff |
| Reisegodtgjørelse | Reise 7,5–15 km | Pendling kort |
| Reisegodtgjørelse | Reise 15–30 km | Pendling mellom |
| Reisegodtgjørelse | Reise 30–45 km | Pendling lang |
| Reisegodtgjørelse | Reise 45–60 km | Pendling svært lang |
| Reisegodtgjørelse | Kilometergodtgjørelse (egen bil) | Tjenestereiser |
| Reisegodtgjørelse | Reise/transport til prosjekter | Daglig pendling |
| Diett | Diett med overnatting hotell | Reise med opphold |
| Diett | Diett enkel overnatting | Hybel uten kjøkken |
| Diett | Diett med kokemulighet | Hybel med kjøkken |
| Diett | Diett uten overnatting | Dagstur |
| Diett | Nattillegg trekkfritt | Ulegitimert |
| Diett | Losji | Trekkpliktig overnatting |
| Skifttillegg | 2. skift tillegg | Toskift |
| Skifttillegg | Nattskifttillegg (00–06) | Nattarbeid |
| Skifttillegg | Helligdagsskifttillegg | Skift på helligdag |
| Spesielle | Smusstilleg | Skitne arbeidsforhold |
| Spesielle | Matpenger overtid (ved 2+ timer) | Standard ved overtid |
| Lærling | Lærlingelønn (30–75% av fagarbeider) | Lærlinger |
| Lærling | Overtid lærling 50% | Lærlinger med overtid |
| Lærling | Overtid lærling 100% | Lærlinger med overtid |
| Andre | Praksistimer | Praktikanter |
| Andre | Innleid arbeidskraft | UE-timer |
| Andre | Fakturerbar tid | Skille fra intern |
| Andre | Timer prosjektleder | PL med egen sats |

#### Nivå 3 — Egendefinerte

Opprettes av kunden via admin-UI ved behov. SiteDoc leverer ingen mal — kun verktøyet. Eksempler på lønnsarter som typisk hører her: kloakk-tillegg, brøyte-beredskap, firma-spesifikke skifttillegg-satser (30/40/50% utenfor standard 2-skift/natt), tariff-spesifikke satser, bransje-detaljer (bergspreng, dykker, etc.).

### Onboarding — to scenarier

Ved firma-opprettelse vises modus-velger:

**A) «Nytt firma — ingen eksisterende katalog»**
Auto-importerer Nivå 1 (16 lønnsarter). Tilbyr Nivå 2 (25 lønnsarter) som valg. Standard for nye SiteDoc-kunder.

**B) «Migrerer fra annet system»**
Tom katalog. Import-verktøy aktivert (CSV-upload eller adapter mot kjent system). Forhindrer dobbel-katalog-problem hvis kunde flytter eksisterende lønnsarter inn — ellers ville Nivå 1 + importert katalog gi duplikater.

### Auto-fordeling normaltid/overtid

Når kunden bruker Nivå 1 «Timelønn» + «Overtid 50%/100%»: systemet foreslår fordeling basert på totaltimer og konfigurerbar dagsnorm (default 7,5t fra `OrganizationSetting`). Bruker kan overstyre.

Eksempel: 10t totalt → Timelønn 7,5t + Overtid 50% 2,5t. Bruker justerer til 8t + 2t hvis ønskelig.

Hvis kunden ikke har importert Nivå 1: ingen auto-fordeling, bruker velger lønnsart manuelt.

### Aktivitet-katalog (datadrevet, tre-nivå)

Aktivitet er en separat dimensjon for kostnadsføring (per ProAdm) — ikke det samme som lønnsart, ikke det samme som ECO. Brukes for å skille hovedarbeid fra garantiarbeid, ekstraarbeid, regulering osv. innenfor samme prosjekt.

**Nivå 1:** Ingen — aktivitet er ikke lovpålagt

**Nivå 2 (anlegg/bygg-pakke, valgfri):**
- Anleggsarbeid
- Maskintimer
- Garanti/reklamasjon

**Nivå 3 (kundens egne):**
Eksempler: Ekstra arbeid, Regulering lønn, kunde-spesifikke aktivitetskategorier.

### Tillegg (datadrevet katalog, tre-nivå)

Tillegg-katalogen er per Organization, samme tre-nivå-prinsipp som lønnsart. Skiller seg fra lønnsart ved at tillegg ikke regnes som arbeidstid — de er separate poster på dagsseddelen.

**Nivå 1:** Ingen — tillegg er ikke lovpålagt

**Nivå 2 (anlegg/bygg-pakke, valgfri):**
- Overtidsmat (avhuking, fast sats)
- Smusstilleg (avhuking)
- Beredskap-vakt (avhuking)

**Nivå 3 (kundens egne):**
Eksempler: Skifttillegg 30/40/50% (firma-spesifikk sats), Brøyte-beredskap, Kloakk-tillegg, tariff-spesifikke vakt-tillegg.

### Felt-typer på tillegg

| Type | Beskrivelse | Eksempel |
|---|---|---|
| `avhuking` | Fast sats, antall=1 ved avhuking | Overtidsmat, Smusstilleg |
| `antall` | Bruker oppgir antall | Henger-tillegg (antall ganger) |

Reisetid ligger ikke som tillegg — det er en lønnsart i Nivå 2 («Reise/transport til prosjekter»). Betales som arbeidstid (egen sats), men inngår ikke i normaltid/overtid-fordeling.

### Tilleggsregler (automatisering)

Admin setter opp regler per Organization. Reglene genererer **forslag** — brukeren kan alltid overstyre. Reglene refererer til konkrete lønnsart- eller tillegg-IDer i kundens katalog (datadrevet, ikke hardkodet).

| Regel | Utløser | Effekt | Konfigurasjon |
|-------|---------|--------|---------------|
| **Overtidsmat-forslag** | Arbeidstimer > terskel (default 9t) | Foreslår avhuking av angitt tillegg | `OrganizationSetting.overtidsmatTerskel` + `regel.tilleggId` |
| **Nattskift-forslag** | Klokkeslett mellom kl 21–06 (krever `startAt`/`endAt`) | Foreslår angitt skift-lønnsart | `regel.lonnsartId` |
| **Helgetillegg-forslag** | Dato er lørdag/søndag | Foreslår avhuking av angitt tillegg | `regel.tilleggId` |
| **Reisetid** | — | Aldri automatisk, alltid manuelt | Egen lønnsart-rad på dagsseddel |

Hvis kunden ikke har konfigurert regelen (eller ikke har importert tilhørende lønnsart/tillegg): regelen er inaktiv. Ingen feilmelding.

### Dagsseddel-flyt (mobil)

Stegvis flyt — hvert steg er en seksjon på skjermen:

```
1. Dato                  → normaldag fra OrganizationSetting
2. Prosjekt              → liste av aktive prosjekter
3. Tilleggsarbeid (ECO)  → valgfri dropdown — endring/varsel/regningsarbeid
4. Aktivitet             → dropdown (default «Anleggsarbeid» hvis seedet)
5. Avdeling              → valgfri (auto-foreslår fra User.avdelingId)
6. Klokkeslett           → valgfri (Fra/Til). Obligatorisk hvis
                           nattskift-tillegg krysses (krever klokkeslett
                           for å forsvares juridisk).
7. Pause                 → minutter (default 0)
8. Timer                 → totalt antall + auto-fordeling Nivå 1-lønnsarter
                           (Timelønn / Overtid 50% / 100%) basert på
                           dagsnorm. Bruker kan overstyre eller velge
                           andre lønnsarter manuelt.
9. Lønnsart-rader        → liste av (lønnsart, timer)
10. Tillegg              → automatiske forslag fra regler + manuelle
11. Maskiner             → fra maskinregister, timer + valgfri mengde
12. Materialer           → fritekst + mengde + enhet
13. Utlegg               → kategori + beløp + valgfritt kvitteringsbilde
14. Beskrivelse          → valgfri tekst
15. [Lagre utkast]   [Send til leder]
```

**Selv-attestering vs send-til-leder:** To knapper — kunden velger via `OrganizationSetting.tillattSelvAttestering` om begge tillates, eller kun «Send til leder».

### UX-visning — dagsseddel (mobil)

```
┌─────────────────────────────────────────────┐
│  Dagsseddel — 16. apr 2026                  │
│  Prosjekt: E6 Kvænangsfjellet               │
│  Tilleggsarbeid: [Plunder og heft uke 14 ▾] │
│  Aktivitet:      [Anleggsarbeid ▾]          │
├─────────────────────────────────────────────┤
│  Klokkeslett: [—:—]–[—:—]   Pause: [30] min │
│  Timer:    [10.0]                           │
│   Auto: Timelønn 7,5 + Overtid 50% 2,5      │
│   [endre fordeling ▾]  [legg til lønnsart]  │
│                                             │
│  Tillegg:                                   │
│  ☑ Overtidsmat (auto: timer > 9t)           │
│  ☐ Skifttillegg 30% ▾                       │
│  ☐ Brøyte-beredskap ▾                       │
│                                             │
│  ▸ Maskiner    (3)                          │
│  ▸ Materialer  (1)                          │
│  ▸ Utlegg      (kvittering)                 │
│                                             │
│  Kommentar: [_______________________]       │
│                                             │
│  [Lagre utkast]  [Send til leder]           │
└─────────────────────────────────────────────┘
```

**Smarte valg som minimerer inntasting:**

1. **Totaltimer øverst** — brukeren taster inn totaltimer, systemet fordeler automatisk på normaltid/50%/100% basert på dagsnorm
2. **Tilleggsregler** — automatiske forslag fra konfigurasjon, brukeren bekrefter eller overstyrer
3. **Maskiner** — nedtrekk fra maskinregisteret (kun maskiner tilordnet prosjektet). Sist brukte øverst
4. **Enhet** — auto-foreslått fra maskintype (kantsteinsetter → m, lastebil → m3). Kan overstyres
5. **Kopiér forrige dag** — én knapp som dupliserer gårsdagens seddel (vanlig at arbeidet ligner)
6. **Materialer** — fritekst + mengde + enhet-dropdown (m3/m2/tonn/kg/m)

## Eksport til lønnssystem

Støtter flere systemer via adapter-mønster (samme prinsipp som `BilagsKilde` i økonomi-modulen):

| System | Status | Beskrivelse |
|--------|--------|-------------|
| **Tripletex** | Primær | Eksisterende integrasjon via OrganizationIntegration |
| **Visma** | Planlagt | Visma.net Payroll API |
| **Unit4** | Planlagt | Unit4 Business World |
| **SAP** | Planlagt | SAP SuccessFactors / HCM |
| **CSV/Excel** | Fallback | Alltid tilgjengelig, universell eksport |

### Adapter-interface

```typescript
interface LonnssystemAdapter {
  eksporter(dagssedler: Dagsseddel[]): Promise<EksportResultat>;
  eksporterUtlegg(utlegg: Utlegg[]): Promise<EksportResultat>;
  valider(): Promise<boolean>; // sjekk API-tilkobling
}
```

Konkret implementasjon per leverandør. Konfigureres via `OrganizationIntegration` (type: `"tripletex"` / `"visma"` / `"unit4"` / `"sap"`).

### Timer-eksport — kolonner

Eksport joiner `sheet_timer`/`sheet_tillegg` med katalog-tabellene for å hente lønnsart-kode, navn og pris. Aldri slått sammen til faste kolonner — hver lønnsart-rad blir egen post i eksportfilen.

| Kolonne | Kilde |
|---------|-------|
| Dato | `daily_sheets.dato` |
| Ansatt | `userId` → `users.name` |
| Ansattnummer | `users.ansattnummer` (krevet for lønnseksport) |
| Prosjekt | `projectId` → `projects.name` |
| Aktivitet | `aktivitetId` → `aktiviteter.kode` |
| Avdeling | `avdelingId` → `avdelinger.kode` (valgfri) |
| Tilleggsarbeid | `externalCostObjectId` → `external_cost_objects.proAdmId` (valgfri) |
| Lønnsart-rader | `sheet_timer` joinet med `lonnsarter` (`kode`, `navn`, `timer`, `attestertSnapshot.prisMotKunde`) |
| Tillegg-rader | `sheet_tillegg` joinet med `tillegg` (`kode`, `navn`, `antall`, `attestertSnapshot.prisMotKunde`) |

**Pris-snapshot:** Eksport bruker `attestertSnapshot.prisMotKunde` fra hver rad — ikke gjeldende pris i katalogen. Sikrer at attesterte timer beholder sin opprinnelige pris selv om katalog-prisen endres senere (Fase 0 A.7).

**Eksport-kode-krav:** `lonnsarter.kode`/`tillegg.kode`/`aktiviteter.kode` er nullable. Eksport-modulen kaster tydelig feilmelding ved eksport-tid hvis kode mangler — gir kunden mulighet til å sette opp katalogen før første lønnssystem-eksport.

**Filtrering per eksport-spor** (per [smartdok-undersokelse.md § 9](smartdok-undersokelse.md)):
- **Lønn:** Kun arbeidskraft (lønnsart + tillegg). Filtrer ut maskiner/materialer
- **ProAdm:** Inkluder alt — lønnsart + tillegg + maskiner + materialer
- **Regnskap:** Utenfor SiteDocs ansvar — håndteres av ProAdm

### Utlegg-eksport — separat fra timer

Aldri blandet i lønnsrader. Tripletex: utlegg som reiseregning/bilag, ikke som lønn.

| Kolonne | Kilde |
|---------|-------|
| Dato | `daily_sheets.dato` |
| Ansatt | `userId` → `users.name` |
| Kategori | `sheet_expenses.kategori` |
| Beløp | `sheet_expenses.belop` |
| Notat | `sheet_expenses.notat` |
| Kvittering | `sheet_expenses.bildeUrl` (lenke) |

## Utleggsregistrering

Del av dagsseddelen. Ansatt tar bilde av kvittering direkte i mobilappen.

### Feltstruktur

- `kategori`: string — Drivstoff, Parkering, Diett, Verktøy, Annet (konfigurerbar per Organization)
- `belop`: decimal (NOK)
- `kvitteringsBilde`: string (URL til lagret bilde)
- `notat`: string? (valgfritt)
- `dagsseddelId`: FK → `daily_sheets`

### Teknisk

- Bilde tas med React Native ImagePicker
- Komprimeres til maks 800px, JPEG 80% før opplasting
- Lagres lokalt som base64 i SQLite → synkes som multipart/form-data til S3
- Eksporteres separat fra timer — som reiseregning/bilag i Tripletex

### Godkjenning

- Leder ser kvitteringsbilde i godkjenningsvisningen
- Godkjennes samtidig med dagsseddelen — ikke egen godkjenningsflyt

## Hjelpetekster (?-ikonet) — alle timer-sider

Per regelen i [CLAUDE.md](../../CLAUDE.md#hjelpetekster-per-side) skal hver side i SiteDoc ha hjelpetekst tilgjengelig via ?-ikonet øverst til høyre. For timer-modulen gjelder dette ALLE sider — bygges samtidig med siden, oppdateres når siden endres.

**Konsepter som MÅ forklares i ?-hjelp på relevante sider:**

| Side | Hjelpetekst skal dekke |
|------|------------------------|
| `/timer/min-tid` (dagsseddel) | Hva er en dagsseddel, lønnsart-valg, hvordan koble til Underprosjekt, signering |
| `/timer/oppsett/underprosjekter` | Hva er Underprosjekt, forskjell mellom Proadm-importert vs. SiteDoc-avledet, åpen/lukket-status |
| `/timer/oppsett/lonnsarter` | Hva er en lønnsart, kobling til Poweroffice-kode, fravær-flag |
| `/timer/oppsett/tillegg` | Skifttillegg, beredskap, automatiske vs. manuelle tillegg |
| `/timer/oppsett/godtgjorelser` | Diett, overtidsmat, kvitteringskrav |
| `/timer/oppsett/eksport-config` | Proadm vs. SiteDoc Godkjenning som kilde, Poweroffice-oppsett |
| `/timer/godkjenning` | Forenklet godkjenningsflyt (kun utførelse, ikke økonomi), signeringsregler |
| `/timer/eksport` | Hva er eksportert, hvordan markere som eksportert, Poweroffice-format |
| `/timer/rapporter/*` | Hva hver rapport viser, hvilke filtere, hvordan eksportere |
| Godkjenning-dokument (eksisterende) | Når «Opprett underprosjekt»-knappen vises, betingelser (modul-aktivering), juridisk grunnlag for at knappen ikke krever økonomisk avklaring |

**Spesielt viktig å forklare i hjelpetekst:**
- **Underprosjekt vs. kontraktsbegreper** — at ansatte ser «Underprosjekt», kontraktsadmin ser tilleggsarbeid/endring/varsel
- **Utførelse er frikoblet økonomi** — entreprenør kan/må føre timer selv om økonomi er uavklart (NS 8405/06/07)
- **Kilde-systemer** — Proadm vs. SiteDoc Godkjenning, hvordan velge, hvordan skille i listen
- **Forenklet godkjenning** — skiller seg fra eksisterende «Godkjenning»-dokumenttype ved at den IKKE inneholder økonomi

Bruk eksempler med norske navn (Ola, Trude, Per) — ikke abstrakte beskrivelser. Når sider bygges, oppdater også «Sidestatus ?-ikon»-tabellen i [CLAUDE.md](../../CLAUDE.md#hjelpetekster-per-side).

## Underprosjekt og forenklet godkjenning (planlagt)

### Begrepsbruk

- **I timer-modulens UI / mot ansatte:** «Underprosjekt»
- **I kontraktssammenheng / dokumentflyt:** Tilleggsarbeid, varsel, endring, varsel om endring, regningsarbeid
- Aldri bland disse to. Ansatte ser kun «Underprosjekt» — kontraktsbegreper er for kontraktsadministrasjon.

### Underprosjekt-modell (planlagt, `packages/db-timer/`)

```
Underprosjekt {
  id, navn, hovedprosjektId, status (åpen/lukket)

  // Kilde — Underprosjekt opprettes ALLTID fra et eksisterende godkjenningsdokument:
  kilde: "proadm" | "sitedoc_godkjenning"

  // Hvis Proadm (importert):
  proadmId, proadmNummer, proadmType
    (tilleggsarbeid/varsel/endring/regningsarbeid)

  // Hvis SiteDoc:
  godkjenningId  // → ReportInstance med malens type "Godkjenning"
}
```

### Avledning — Underprosjekt opprettes ikke selvstendig

Underprosjekt er **alltid en avledning** av et formelt godkjenningsdokument. Det opprettes ikke direkte i timer-modulen.

**To kilder — ulike flyter:**

#### A) Proadm-import (automatisk)

Når Proadm-integrasjonen er aktivert for prosjektet, importeres Underprosjekter automatisk fra Proadm. Proadm er kilden — vi henter, viser, kobler timer mot det. Endringer i godkjenningsstatus skjer i Proadm. Vi viser Proadm-status i Underprosjekt-listen, men endrer den ikke.

**Krav:**
- Timer-firmamodulen aktivert
- Proadm-integrasjon konfigurert på firma/prosjekt
- Ingen knapp på SiteDoc Godkjenning er relevant — Underprosjekt-listen befylles fra Proadm-sync

**Sync-strategi:** Proadm-import kjører på fast intervall (eller manuell trigger). Nye endringer/varsel/regningsarbeider blir Underprosjekter med `kilde = "proadm"`. Ved slettet i Proadm: marker som lukket, ikke slett (bevar timer-historikk).

#### B) SiteDoc Godkjenning-flyt (manuell knapp)

Når SiteDoc-dokumentflyt brukes for endringshåndtering: leder klikker «Opprett underprosjekt for timeregistrering» på Godkjenning-dokumentet. Den formelle Godkjenningen beholder økonomi-diskusjonen — Underprosjektet er kun utførelses-speilbildet ansatte ser.

**Krav:** Se «Avledning fra SiteDoc Godkjenning — manuell knapp» under.

#### Konfigurasjon per firma + per prosjekt

**Proadm er en valgfri integrasjon — ikke et krav.** Mange potensielle kunder bruker ikke Proadm. Timer-modulen må fungere uavhengig av om Proadm er konfigurert eller ikke.

**Konfigurasjonsmatrise:**

| Kundens oppsett | Underprosjekt-kilde | Konsekvens |
|---|---|---|
| Verken Proadm eller Godkjenning-modul | **Ingen** — Underprosjekt-feltet skjules i timeregistreringen | Timer føres direkte mot hovedprosjekt |
| Godkjenning-modul aktivert (uten Proadm) | **SiteDoc Godkjenning** — manuell knapp på Godkjenning-dokument | Standard for kunder uten ERP |
| Proadm aktivert | **Proadm** — automatisk import | A.Markussen-case |
| Proadm + drømmescenario | **Proadm** + auto-opprett SiteDoc Godkjenning som kommunikasjonsverktøy | Se neste seksjon |

**Eksklusivt valg når begge muligheter finnes:** Hvis et firma både har Proadm og Godkjenning-modulen aktivert, må de velge ÉN som kilde for Underprosjekt. Aldri begge som parallelle kilder — ville gitt konkurrerende sannheter og uklart eierskap.

Ved bytte av kilde: eksisterende Underprosjekter beholdes med opprinnelig kilde markert. Kun nye følger ny konfigurasjon.

#### Drømmescenario — Proadm → auto-opprett SiteDoc Godkjenning

Kombinasjons-mulighet som bør utforskes: Proadm-import oppretter automatisk en SiteDoc Godkjenning-dokumentinstans, som så blir kilde for Underprosjekt via knappen.

**Rollefordeling i dette scenarioet:**
- **Proadm** = entreprenørens interne kontrakts-/økonomisystem (kontraktsstatus, beløp, regningsarbeid-vurdering)
- **SiteDoc Godkjenning** = **kommunikasjonsverktøy mellom entreprenør og byggherre** — det er hele formålet med å auto-opprette den

**Statusflyt — manuell sync (første versjon):**
- Proadm → SiteDoc: auto-opprettelse ved import (envei)
- Når byggherre godkjenner i SiteDoc: noen oppdaterer status manuelt i Proadm
- Auto-sync SiteDoc → Proadm utsettes til senere — avklares når behov og teknisk grunnlag er klart

**Fordeler:**
- Byggherre kommuniserer i SiteDoc-flate (slipper Proadm-tilgang)
- Entreprenør beholder Proadm som sin økonomi-master
- Underprosjekt for timer kan avledes via SiteDoc Godkjenning-knappen
- Ett konsistent UI (SiteDoc) for både utførelse, kommunikasjon og dokumentasjon

**Åpne spørsmål:**
- Mapping mellom Proadm-felt (proadmType, beløp, beskrivelse) → Godkjenning-malens felter
- Hva skjer hvis SiteDoc Godkjenning endres manuelt etter auto-opprettelse — overskrives ved neste Proadm-sync, eller markeres som «konflikt»?
- Er SiteDoc Godkjenning read-only på økonomi-felter når Proadm er kilde (kun kommunikasjon/status redigeres i SiteDoc)?
- Når Proadm-endring importeres på nytt: oppdater eksisterende SiteDoc Godkjenning eller opprett ny versjon?

Foreløpig status: **idé, ikke besluttet.** Bør utredes før timer-modulen bygges ferdig.

### Forenklet godkjenningsflyt (mot ansatt)

Egen forelder-objekt-type «Timeregistrering» i [malbyggeren](../../MALBYGGER.md) som lar timeregistrering kobles til underprosjekt og sendes til ansatt for bekreftelse.

**Skal IKKE inneholde:**
- Priser, satser, kostnader
- Fakturering, beløp, kontraktssum
- Diskusjon om økonomiske forhold

**Skal KUN inneholde:**
- Hva ble gjort (aktivitet, kommentar)
- Antall timer, dato
- Hvilken lønnsart
- Eventuell signatur for bekreftelse av utførelse
- Vedlegg/bilder fra utførelsen

**Hvorfor:** Økonomi (priser, kontrakt, fakturering) håndteres i Proadm eller annet ERP. Ansatte skal kun forholde seg til utførelse — hva er gjort, hvor mange timer, har leder godkjent. Skiller dette tydelig fra den eksisterende «Godkjenning»-dokumenttypen som kan inkludere økonomi.

**Flyt:** Leder oppretter timeregistrering basert på mal → sendes til ansatt → ansatt bekrefter (signerer) → tilbake til leder for endelig godkjenning → eksporteres til lønnssystem (Poweroffice).

**Kobling til Underprosjekt:** Timeregistreringen knyttes til et Underprosjekt som allerede eksisterer (avledet fra Proadm eller fra SiteDoc Godkjenning-dokument — se «Underprosjekt-modell» over). Selve timeregistreringen oppretter ikke nytt Underprosjekt — den bruker et eksisterende.

### Avledning fra SiteDoc Godkjenning — manuell knapp

På et Godkjenning-dokument (uavhengig av status) finnes knappen **«Opprett underprosjekt for timeregistrering»**. Leder klikker når utførelsen skal starte.

**Synlighetsbetingelser for knappen** — vises kun når begge er sanne:
1. **Timeregistrerings-modulen er aktivert** (firmamodul, se [CLAUDE.md](../../CLAUDE.md#modulsystem--to-nivåer))
2. **Godkjenning-modulen er aktivert på prosjektet** (prosjektmodul)

Hvis én av disse er av, skjules knappen — ingen poeng å tilby Underprosjekt-opprettelse hvis ansatte ikke kan føre timer mot det, eller hvis Godkjenning ikke er en aktiv dokumenttype på prosjektet.

**Aldri automatisk basert på godkjent-status.** Begrunnelse: i norsk entrepriserett (NS 8405/8406/8407) er entreprenøren kontraktspliktig til å utføre arbeid selv ved økonomisk uenighet. Hvis vi blokkerte Underprosjekt-opprettelse til Godkjenningen var økonomisk avklart, ville vi hindre lovpålagt utførelse. Utførelse-spor (timer) må alltid kunne starte uavhengig av økonomi-spor (pris/fakturering).

Underprosjektets `kilde` settes til `sitedoc_godkjenning` og `godkjenningId` peker til kilde-dokumentet. Endringer i Godkjenningens økonomiske status påvirker ikke Underprosjektets åpen/lukket-status.

## Database — `packages/db-timer`

### Hovedtabell: `daily_sheets` (dagsseddel)

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | Server-generert ID |
| `clientUuid` | `uuid` UNIQUE | Klient-generert UUID for idempotent upsert |
| `organizationId` | `uuid` FK → `organizations` | Firma-eier (timer-data er firma-eid) |
| `userId` | `uuid` FK → `users` | Hvem timer gjelder for |
| `registrertAvUserId` | `uuid` FK → `users` | Hvem la inn registreringen (kan være ulik userId) |
| `projectId` | `uuid` FK → `projects` | Prosjekt |
| `externalCostObjectId` | `uuid?` FK → `external_cost_objects` | Tilleggsarbeid (ECO) |
| `aktivitetId` | `uuid` FK → `aktiviteter` | Aktivitet (ProAdm-kostnadsdimensjon) |
| `avdelingId` | `uuid?` FK → `avdelinger` | Avdeling (firma-intern, valgfri) |
| `byggeplassId` | `uuid?` FK → `byggeplasser` | Byggeplass (per byggeplass-strategi, valgfri) |
| `dato` | `date` | Arbeidsdag |
| `startAt` | `timestamptz?` | Klokkeslett start (valgfri, obligatorisk hvis nattskift-tillegg krysses) |
| `endAt` | `timestamptz?` | Klokkeslett slutt (valgfri) |
| `pauseMin` | `int` default 0 | Pause i minutter |
| `status` | `text` default `draft` | `draft` \| `sent` \| `returned` \| `accepted` |
| `beskrivelse` | `text?` | Fritekst fra ansatt |
| `lederKommentar` | `text?` | Toveis-kommunikasjon: leder kan svare ansatt |
| `syncStatus` | `text` | `pending` \| `synced` \| `conflict` |
| `syncedAt` | `timestamptz?` | Siste vellykket synkronisering |
| `attestertAvUserId` | `uuid?` FK → `users` | Leder som attesterte |
| `attestertVed` | `timestamptz?` | Tidspunkt for attestering |
| `createdAt` | `timestamptz` | |
| `updatedAt` | `timestamptz` | |

**Indekser:** `(userId, projectId, dato)` UNIQUE, `(organizationId)`, `(externalCostObjectId)`, `(clientUuid)` UNIQUE

### `sheet_timer` (timer-rader per dagsseddel)

Erstatter de tidligere faste kolonnene `normaltid/overtid50/overtid100`. Datadrevet — bruker velger lønnsart fra katalogen.

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | |
| `sheetId` | `uuid` FK → `daily_sheets` | |
| `lonnsartId` | `uuid` FK → `lonnsarter` | Datadrevet katalog |
| `timer` | `decimal` | Timer på denne lønnsarten |
| `attestertSnapshot` | `jsonb?` | Pris-snapshot ved attestering (Fase 0 A.7) |

### `sheet_tillegg` (tillegg-rader per dagsseddel)

Erstatter de tidligere faste boolean-kolonnene `overtidsmat/nattillegg/helgetillegg`. Datadrevet.

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | |
| `sheetId` | `uuid` FK → `daily_sheets` | |
| `tilleggId` | `uuid` FK → `tillegg` | Datadrevet katalog |
| `antall` | `decimal` | Antall (1 for avhuking) |
| `kommentar` | `text?` | Tvungen for noen tillegg (`Tillegg.tvungenKommentar=true`) |
| `attestertSnapshot` | `jsonb?` | Pris-snapshot ved attestering |

### `lonnsarter` (lønnsart-katalog per Organization)

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | |
| `organizationId` | `uuid` FK → `organizations` | Eier |
| `type` | `text` | `ordinaer` \| `fravaer` \| `feriepenger` \| `diett` |
| `kode` | `text?` | Eksport-kode (Poweroffice/Visma/etc.). NULL hvis ikke valgt eksport-system ennå. Eksport-modulen krever ikke-NULL ved eksport-tid med tydelig feilmelding. |
| `navn` | `text` | |
| `prisMotKunde` | `decimal?` | Null = bruker prosjektkontrakt |
| `internkostnad` | `decimal?` | |
| `skalEksporteres` | `boolean` default true | |
| `tvungenKommentar` | `boolean` default false | |
| `rekkefolge` | `int` | Sortering i UI |
| `aktiv` | `boolean` default true | Soft-delete |
| `seedNivaa` | `int?` | 1, 2 eller null (3 = egendefinert). Brukes for å skille auto-seeded fra kunde-opprettet. |

**Indeks:** `(organizationId, kode)` UNIQUE WHERE `kode IS NOT NULL` (delvis unik — to lønnsarter uten kode er lovlig).

### `aktiviteter` (aktivitet-katalog per Organization)

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | |
| `organizationId` | `uuid` FK | |
| `kode` | `text?` | Eksport-kode (samme nullable-prinsipp som lønnsart) |
| `navn` | `text` | |
| `internkostnad` | `decimal?` | |
| `prisMotKunde` | `decimal?` | |
| `aktiv` | `boolean` default true | |
| `seedNivaa` | `int?` | 1, 2 eller null (3 = egendefinert). Skill auto-seeded fra kunde-opprettet. |

### `tillegg` (tillegg-katalog per Organization)

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | |
| `organizationId` | `uuid` FK | |
| `kode` | `text?` | Eksport-kode (nullable) |
| `navn` | `text` | |
| `type` | `text` | `avhuking` \| `antall` |
| `prisMotKunde` | `decimal?` | |
| `internkostnad` | `decimal?` | |
| `skalEksporteres` | `boolean` default true | |
| `tvungenKommentar` | `boolean` default false | |
| `rekkefolge` | `int` | |
| `aktiv` | `boolean` default true | |
| `seedNivaa` | `int?` | 1, 2 eller null (3 = egendefinert) |

### `sheet_machines` (maskinbruk per dagsseddel)

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | |
| `sheetId` | `uuid` FK → `daily_sheets` | |
| `vehicleId` | `uuid` FK → `vehicles` (maskin-modul) | |
| `timer` | `decimal` | Timer brukt |
| `mengde` | `decimal?` | Valgfri mengde |
| `enhet` | `text?` | m3, m2, tonn, kg, m |

### `sheet_materials` (materialforbruk per dagsseddel)

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | |
| `sheetId` | `uuid` FK → `daily_sheets` | |
| `navn` | `text` | Materialnavn (fritekst) |
| `mengde` | `decimal` | Antall |
| `enhet` | `text` | m3, m2, tonn, kg, m |

### `sheet_expenses` (utlegg per dagsseddel)

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | |
| `sheetId` | `uuid` FK → `daily_sheets` | |
| `kategori` | `text` | Konfigurerbar per Organization (se `expense_categories`) |
| `belop` | `decimal` | Beløp i NOK |
| `notat` | `text?` | Fritekst (f.eks. «Shell Tromsø») |
| `bildeUrl` | `text?` | Kvitteringsbilde — S3-URL etter opplasting |
| `bildeSyncStatus` | `text` default `pending` | `pending` \| `synced` — bilde synkes separat |

**Kvitteringsbilde:**
- Tas med mobilkamera direkte i appen (Expo ImagePicker / Camera)
- Komprimeres før opplasting: maks 800px bredde, JPEG 80%
- Lagres lokalt som filsti i SQLite → synkes til S3 ved tilkobling
- Valgfritt men anbefalt — leder ser bildet i godkjenningsvisningen

### `expense_categories` (utleggskategorier per Organization)

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | `uuid` PK | |
| `organizationId` | `uuid` FK → `organizations` | |
| `navn` | `text` | Kategorinavn |
| `aktiv` | `boolean` default true | Kan deaktiveres uten å slette |

**Standardkategorier** seedes via samme event-hook (`onOrganizationCreated`) som lønnsart-Nivå 1: Drivstoff, Parkering, Diett, Verktøy, Annet.

### Avdeling — i kjernen, ikke db-timer

`Avdeling` lever i `packages/db` (kjernen) og bygges i Fase 0.5 sammen med Byggeplass-strategi. Brukes på tvers av Maskin (ansvarlig per avdeling), Mannskap og Timer. Ikke en del av db-timer-skjema.

### Fjernet: `enterprise_settings`

Erstattet av `OrganizationSetting` (Fase 0). Felter `dagsnorm`, `overtidsmatTerskel`, `timezone`, `timer_lock_after_days`, `tillattSelvAttestering` flyttes dit. Sats-felter (`overtidsmatSats` osv.) flyttes til `Tillegg.prisMotKunde`/`internkostnad` i datadrevet katalog.

## Sync-strategi — offline-first

### Arkitektur-oversikt

```
┌─────────────────────────────────────────────────────────────────────┐
│ MOBILENHET                                │ SERVER                  │
│                                           │                         │
│  Bruker registrerer timer                 │                         │
│  (start/stopp, prosjekt, beskrivelse)     │                         │
│       ↓                                   │                         │
│  SQLite lokalt                            │                         │
│  (timeEntries, syncStatus, uuid)          │                         │
│       ↓                                   │                         │
│  Nettverksstatus?                         │                         │
│   │                                       │                         │
│   ├─ Offline → Lagres lokalt              │                         │
│   │            syncStatus = "pending"     │                         │
│   │            ... (venter)               │                         │
│   │            Tilkobling gjenopptatt     │                         │
│   │            Sender pending-poster ────────→ apps/api (tRPC)     │
│   │                                       │   Auth + organizationId │
│   └─ Online ─→ Sync-motor ──────────────────→       ↓              │
│                Batch pending → API        │   packages/db-timer     │
│                                           │   PostgreSQL, eget skjema│
│                                           │         ↓               │
│                                           │   Konfliktløsning       │
│                                           │   Server-wins +         │
│                                           │   client uuid —         │
│                                           │   idempotent upsert     │
└─────────────────────────────────────────────────────────────────────┘

db-timer nøkkelfelter:
  id (uuid), userId, registrertAvUserId, organizationId, projectId,
  externalCostObjectId, aktivitetId, avdelingId, byggeplassId, dato,
  startAt, endAt, pauseMin, status, beskrivelse, syncedAt, clientUuid
  syncStatus: "pending" | "synced" | "conflict" — slettes aldri, kun markeres
```

### Mobil → Server

1. **Lokal lagring:** SQLite via Drizzle (samme mønster som resten av mobil-appen)
2. **Registrering:** Bruker oppretter dagsseddel lokalt med `clientUuid` og `syncStatus: "pending"`
3. **Batch-sync:** Når nettdekning er tilbake, sender alle `pending`-poster til API
4. **Idempotent upsert:** API bruker `clientUuid` for å unngå duplikater — `ON CONFLICT (clientUuid) DO UPDATE`
5. **Bekreftelse:** Server returnerer synkroniserte poster med `syncStatus: "synced"` og `syncedAt`

### Konfliktløsning

**Server-wins:** Hvis en dagsseddel er godkjent av leder og klienten sender en oppdatering, vinner server-versjonen. Klient merkes med `syncStatus: "conflict"` og brukeren informeres.

| Scenario | Løsning |
|----------|---------|
| Ny dagsseddel fra klient | Upsert via `clientUuid` |
| Klient redigerer usynkronisert seddel | Oppdater lokalt, sync ved neste batch |
| Klient redigerer godkjent seddel | `conflict` — godkjente sedler kan ikke endres |
| Server har nyere versjon | `conflict` — bruker informeres |

### Synk-intervall

- **Aktiv app:** Sync hvert 30. sekund når nettdekning finnes
- **Bakgrunn:** Expo BackgroundFetch (minimum 15 min intervall på iOS)
- **Manuell:** Pull-to-refresh trigger

## Auth

Delt auth via eksisterende `next-auth` sessions-tabell i `packages/db`. Timer-API validerer session-token mot samme tabell. Ingen egen innlogging — brukeren er allerede logget inn i SiteDoc.

**Viktig:** `packages/db-timer` har INGEN `users`-tabell — refererer kun via `userId` FK til `packages/db`.

## Tilgangsstyring

| Prinsipp | Implementasjon |
|----------|---------------|
| **Firma-isolering** | `organizationId` på alle dagssedler. Timer-data er firma-eid (per memory: feedback_timer_eierskap) |
| **Prosjektisolering** | `projectId` filtrerer alltid. Ingen data lekker mellom prosjekter |
| **Ledervisning** | Firmaansvarlig ser ansattes dagssedler i sin faggruppe |
| **Admin** | Prosjektadmin ser alle dagssedler i prosjektet |
| **Godkjenning** | Leder godkjenner dagssedler → `godkjentAv` + `godkjentVed`. Utlegg godkjennes samtidig — leder ser kvitteringsbilder i godkjenningsvisningen |

## API-ruter (planlagt)

| Rute | Metode | Beskrivelse |
|------|--------|-------------|
| `timer.registrer` | Mutation | Opprett/upsert dagsseddel (idempotent via clientUuid) |
| `timer.oppdater` | Mutation | Endre dagsseddel (kun egne, kun ikke-godkjente) |
| `timer.slett` | Mutation | Slett dagsseddel (kun egne, kun ikke-godkjente) |
| `timer.hentMine` | Query | Mine dagssedler, filtrert på prosjekt/periode |
| `timer.hentForProsjekt` | Query | Alle dagssedler i prosjekt (admin/leder) |
| `timer.godkjenn` | Mutation | Godkjenn dagsseddel (leder) |
| `timer.avvis` | Mutation | Avvis med kommentar (leder) |
| `timer.syncBatch` | Mutation | Batch-upsert fra mobil (array av clientUuid-dagssedler med maskiner/materialer) |
| `timer.hentInnstillinger` | Query | Organization-innstillinger (dagsnorm, satser) |
| `timer.oppdaterInnstillinger` | Mutation | Endre Organization-innstillinger (admin) |

## Prototype — kundevisning (pågår)

Interaktiv UI-prototype for kundedialog. Ingen backend, ingen migrering — kun hardkodet demodata og lokal state. Formål: vise kunden at funksjonaliteten er gjennomtenkt, og få tilbakemelding.

### Midlertidig plan: modul i prosjektet

For prototypen bygges timer som **en modul inne i prosjektet** (ikke separat app). Grunnen:

- **Mobil:** Feltarbeideren åpner prosjektet sitt og finner timer der — samme mønster som sjekklister, oppgaver, tegninger
- **Web:** Timer-ikon i prosjektets sidebar, åpner timer-visning i prosjektkontekst
- **Konsistent:** Samme navigasjon på web og mobil

Den opprinnelige planen om `apps/timer` som egen Next.js-app er **ikke forkastet** — dette er en midlertidig tilnærming for å teste UI og få kundetilbakemelding. Endelig arkitektur bestemmes etter kundedialog.

### Prototype-rute

`/dashbord/[prosjektId]/timer` — tilgjengelig via sidebar-ikon i prosjektet.

### Prototype-innhold (bygget)

**Tre faner:**

1. **Oversikt** — tabell med alle dagssedler
   - Hurtigfiltre alltid synlig: ansatt-søk, prosjekt-dropdown, dato fra-til, status-filter
   - Sortering ved klikk på kolonneoverskrift (pil opp/ned)
   - Filter-ikon på kolonner: dato-spenn, fritekst, checkbox-lister, tallintervall
   - Aktive filter som chips med × og "Fjern alle"
   - Tilleggsarbeid-kolonne med badges (E-042, E-038)
   - Sumrad nederst
   - Klikk markerer rad (blå), dobbeltklikk åpner redigering
   - Rediger-knapp (blyant) og slett-knapp (søppelbøtte) per rad

2. **Dagsseddel** — skjema med alle felter
   - Prosjektvalg, tilleggsarbeid-dropdown med endringsbeskrivelse
   - Arbeidstimer med auto-fordeling (normaltid/OT50/OT100)
   - Reisetid, tillegg med auto-forslag (overtidsmat >9t, helg)
   - Sammenleggbare seksjoner: maskiner, materialer, utlegg
   - Kopiér forrige dag-knapp
   - Redigeringsmodus: gult banner med dato og ansattnavn

3. **Rapporter** — 7 rapporttyper som klikkbare kort
   - Prosjektrapport, månedsrapport per ansatt/prosjekt, tilleggsarbeid, maskin, utlegg, eksport
   - Dato-, prosjekt- og ansatt-filter + generer/eksporter PDF
   - Rapporter-fanen bruker full bredde (statistikkpanel skjules)

**Statistikkpanel (høyre kolonne, skjult på mobil):**
- Ukeoversikt med prosjekter nedover, dager bortover
- Underrader for tilleggsarbeid per prosjekt
- Månedstotaler (normaltid, OT, reisetid)
- Årstotaler + utlegg

**Layout:**
- To-kolonner på PC: innhold (venstre) + statistikk (høyre, responsiv bredde)
- Statistikkpanel: `w-[340px] lg → w-[420px] xl → w-[500px] 2xl`
- Mobil: kun venstre kolonne

### Demodata

- Prosjekter: 998 Innstifjordbotn, E6 Kvænangsfjellet
- Ansatte: Florian Aschwanden - A. Markussen AS, Kenneth Myrhaug
- Tilleggsarbeid: E-042, E-038, E-035, G-012, E-051
- 5 dagssedler med variert data (ulike statuser, tillegg, utlegg)

### Hva prototypen IKKE gjør

- Ingen nye Prisma-modeller eller migreringer
- Ingen API-kall — alt er lokal state / hardkodet
- Ingen offline-sync
- Ingen auth-sjekk utover eksisterende prosjekttilgang
- Rapporter genereres ikke — kun filter-UI og placeholder

## Proadm-integrasjon

### Status (april 2026)

Proadm har **ikke** et offentlig REST API. Eneste eksisterende synk-integrasjon for timer/tillegg er mot SmartDok. Proadm har bekreftet interesse for å utvikle et generelt API, og SiteDoc forfølger rollen som **designpartner/pilotkunde** for dette.

Inntil REST API er på plass, utforskes tre kortsiktige spor (i prioritert rekkefølge):

1. **Gjenbruk SmartDok-formatet** — SiteDoc emitterer samme datastruktur som SmartDok sender til Proadm. Krever ingen ny utvikling på Proadm-siden. Avhenger av at Proadm deler formatspesifikasjonen.
2. **Fil-basert overføring** — daglig SFTP/CSV-drop i avtalt skjema.
3. **Direkte SQL** — kun hvis ingen av de over fungerer; mer skjørt og kundespesifikt.

### Premiss for integrasjon

- **All godkjenning skjer i SiteDoc.** Proadm mottar kun ferdig godkjente timer, tillegg og utlegg. Ingen godkjenningsflyt eller statusoppdateringer tilbake fra Proadm — kun valideringsfeil.
- Overføringen er i praksis **envei sendende**, og **enveis hentende** for masterdata (prosjekter, ansatte, lønnsarter, endringer).

### Dataflyt (mål-arkitektur)

- **Henting:** 1x per døgn fra Proadm (batch — masterdata)
- **Sending:** 1x per døgn til Proadm (batch — godkjente timer/tillegg/utlegg)
- **Mellom-løsning:** SmartDok brukes i dag av kunden — SiteDoc erstatter denne rollen

### Foreslåtte REST-endepunkter (designpartner-utkast)

| Retning | Endepunkt | Innhold |
|---------|-----------|---------|
| Hent | `GET /ansatte` | Aktive ansatte |
| Hent | `GET /prosjekter` | Aktive prosjekter |
| Hent | `GET /kontrakter` | Kontrakter per prosjekt |
| Hent | `GET /lonnsarter` | Lønnsarter og satser |
| Hent | `GET /endringsordrer` | Endringer/godkjenninger med status |
| Send | `POST /timer` | Godkjente dagssedler |
| Send | `POST /tillegg` | Tilleggsarbeid-timer med endringsreferanse |
| Send | `POST /utlegg` | Godkjente utlegg med kvitteringsreferanse |

### Hva SiteDoc henter fra Proadm

- **Endringsmeldinger:** nummer, navn, beskrivende tekst, status
- **Godkjenninger:** nummer, navn, beskrivende tekst, status

### "Send til timeregistrering" — egen funksjon

Separat handling på en endring/godkjenning i SiteDoc. Påvirker IKKE godkjenningsforløpet i Proadm. Flagget gjør endringen tilgjengelig som valgbar referanse ved timeregistrering.

### Hva arbeider ser

- Prosjektnummer og prosjektnavn
- Endringsnummer og endringsnavn
- Beskrivende tekst som medfølger arbeidet
- Egne timer ført mot dette
- **ALDRI:** kronebeløp, kontraktsum, budsjett eller økonomidata

### Hva SiteDoc sender tilbake til Proadm

To separate strømmer:
1. **Ordinære prosjekttimer** — alle timer uten tilleggskobling
2. **Tilleggsarbeid-timer** — timer knyttet til spesifikk endring/godkjenning, med endringsnummer som referanse

### Tilgangsstyring økonomi

| Rolle | Ser |
|-------|-----|
| **Arbeider** | Kun arbeidsbeskrivelse og egne timer |
| **Leder** | Timer + kostnad (timer × timesats) |
| **Økonomi/admin** | Full kobling mot Proadm-data |

### Validering

SiteDoc validerer og godkjenner timer — ikke Proadm. Leder godkjenner i SiteDoc → data sendes i neste batch til Proadm. Proadm-siden gjør kun teknisk validering (feltformat, refererte ID-er) og rapporterer eventuelle avviste poster tilbake for korreksjon i SiteDoc.

## Rapportmodul (planlagt)

Timer-modulen skal støtte utskrift og PDF-generering av diverse rapporter. Alle rapporter har fra-til datofilter.

### Rapporttyper

| Rapport | Gruppering | Innhold |
|---------|------------|---------|
| **Prosjektrapport** | Per prosjekt, fra–til dato | Alle ansatte, timer fordelt på lønnsarter, maskinbruk, utlegg |
| **Månedsrapport per ansatt** | Per ansatt, per måned | Alle prosjekter, dagssedler, timer, tillegg, utlegg |
| **Månedsrapport per prosjekt** | Per prosjekt, per måned | Alle ansatte, timer, tilleggsarbeid, maskinbruk |
| **Tilleggsarbeid-rapport** | Per endring/godkjenning | Timer ført mot spesifikt tilleggsarbeid, med endringsnummer |
| **Maskinrapport** | Per maskin | Timer, mengde, prosjekter maskinen er brukt på |
| **Utleggsrapport** | Per ansatt eller prosjekt | Kategori, beløp, kvitteringsbilder |
| **Eksportrapport** | Per lønnssystem-batch | Hva som ble sendt, tidspunkt, status |

### Felles for alle rapporter

- Fra–til datospenn
- Prosjektfilter (velg ett eller flere)
- Ansattfilter (velg én eller flere)
- PDF-eksport og utskrift
- Vises som tabell med sumrader

### Ikke avklart (rapporter)

- Layout/design for PDF-rapporter — bruke packages/pdf eller ny løsning?
- Hvilke rapporter er viktigst for kunden?
- Skal rapporter kunne deles/sendes som e-post?
- Faste rapportmaler vs. ad-hoc rapportbygger?

## Ikke avklart

- GPS-validering — skal posisjonen ved registrering logges for å verifisere at arbeideren var på byggeplassen?
- Akkord — trenger modulen støtte for akkordlønn i tillegg til timepris?
- Arbeidstidskalender — helligdager, feriedager, kortdager — import eller manuelt oppsett?
- Godkjenningsflyt detaljer — batch-godkjenning (uke), enkelt-godkjenning (dag), eller begge?
- `apps/timer` som separat app vs modul-i-prosjektet — avgjøres etter kundedialog med prototypen
