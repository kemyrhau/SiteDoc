---
status: midlertidig
opprettet: 2026-04-27
slettes: etter avsjekk mot Timer-modul-revurdering
---

# TIMER-FUNN fra drift-screening 2026-04-27

> 🟡 **Status:** Midlertidig fil. Slettes etter avsjekk mot Timer-modul-revurdering. Funnene her må gjennomgås før Fase 0-koding for Timer starter.

## Kontekst

Under drift-screening av 14 dokumentasjonsfiler 2026-04-27 dukket det opp avvik mellom dokumentasjon og kode som spesifikt påvirker Timer-modulen. Disse er samlet her for å sikre at de håndteres i kommende Timer/Maskin-revurdering, før modulen bygges.

Fundament-filer som er verifisert (sannhetskilde):
- [arkitektur.md](arkitektur.md)
- [terminologi.md](terminologi.md)
- [dokumentflyt.md](dokumentflyt.md)
- [fase-0-beslutninger.md](fase-0-beslutninger.md) — alle 7 BLOKKERE lukket

## Funn 1 — `packages/db-timer` eksisterer ikke

**Status:** Pakken er referert i 4+ doc-filer som om den eksisterer:
- [timer.md](timer.md) — appstruktur, dagsseddel-tabeller, sync-mønster
- [timer-input-katalog.md](timer-input-katalog.md) — peker til db-timer-skjema
- (tidligere) datamodell-arkitektur.md — listet `Wage`/`Addition`/`Allowance` "i db-timer"
- [arkitektur-syntese.md](arkitektur-syntese.md) — module-arkitektur

**Verifikasjon:** `ls packages/` viser kun `db`, `db-maskin`, `pdf`, `shared`, `ui`. Ingen `db-timer`.

**Implikasjon:** Timer-modulen kan ikke bygges før db-timer-pakken etableres. Dette er Fase 0-arbeid (ikke Fase 3 hvor Timer-tabeller fylles inn) — minimum tom Prisma-skjema-fil + klient-export, slik at fase-0-beslutninger sin C.1-utvidelse (organizationId-rename i Timer-skjema) kan refereres riktig.

**Avhandling i Timer-revurdering:**
- Skal db-timer opprettes i Fase 0 (sammen med øvrige migrasjons-steg) eller som første steg i Fase 3?
- Hvilke FK-koblinger fra db-timer til db-kjernen (User, Project, ExternalCostObject, Equipment) — alle er cross-package, må være "svake String-felt uten Prisma `@relation`" per CLAUDE.md
- Konfigurasjon av Prisma multi-schema (`schemas = ["timer"]`) speiler db-maskin sitt mønster

## Funn 2 — `OrganizationSetting`-felter må verifiseres mot Timer-bruk

**Status:** [timer.md](timer.md) refererer til følgende felter på `OrganizationSetting` som ikke er bekreftet implementert ennå:
- `dagsnorm` (default 7,5t — driver auto-fordeling normaltid/overtid)
- `overtidsmatTerskel` (default 9t — utløser overtidsmat-forslag)
- `tillattSelvAttestering` (true/false — togles to-knapp UX i dagsseddel-mobil)
- `timezone` (datoer/perioder må bruke firmaets sone)
- `timer_lock_after_days` (lås for redigering etter N dager)
- `bruksAvdelinger` (toggler Avdeling-funksjonalitet — fra forkastet datamodell-arkitektur.md)

**Verifikasjon:** `OrganizationSetting`-modellen er foreløpig ikke i Prisma-skjema (per fase-0-beslutninger A.X — etableres i Fase 0-migrasjon).

**Implikasjon:** Dagsseddel-flyt og auto-fordeling er bygget rundt disse feltene. Hvis modellering avviker (f.eks. `bruksAvdelinger` flyttes ut) må timer.md justeres synkront.

**Avhandling i Timer-revurdering:**
- Final liste over `OrganizationSetting`-felter Timer trenger
- Default-verdier ved firma-opprettelse (event-hook `onOrganizationCreated`)
- Hvilke felter som er per Organization vs per Avdeling (relevant hvis `bruksAvdelinger=true`)

## Funn 3 — maskin.md Vegvesen-mapping har større drift enn forventet

**Status:** Tabellen i [maskin.md § Datamapping](maskin.md#datamapping--vegvesen--sitedoc) lister ~30 Vegvesen-felt som "mappes til `vehicles`-tabellen". To åpenbare drift-punkter:

1. **Tabellnavn:** Dokumentet sier `vehicles`, faktisk schema har én felles `equipment`-tabell (per fase-0 og MVP-design "én tabell, kategori-felt styrer hvilke kolonner som er relevante")
2. **Felt-mismatch:** Av ~30 dokumenterte felter er kun ~10 implementert som egne kolonner i `equipment`-schema. Resten (`vin`, `forstegangsRegistrert`, `kjoretoygruppe`, `karosseritype`, `antallSeter`, `slagvolum`, `effektKw`, `motorKode`, `antallSylindre`, `girkasse`, `hybrid`, `forbrukLiterPer10km`, `co2GramPerKm`, `euroKlasse`, `nyttelast`, `tilhengervektMedBrems`, `tilhengervektUtenBrems`, `vogntogvekt`, `taklast`, `lengdeCm`, `breddeCm`) er ikke egne kolonner — ligger i `vegvesenData` JSON-blob

**Verifikasjon:** Mid-i Bunke 1 (denne committen) ble det lagt til en drift-merknad øverst i tabellen. Selve tabellen ble IKKE endret — dette krever en egen prioriterings-runde.

**Implikasjon:** Maskin-modulen er allerede under bygging på `feature/maskin-db`. Hvis `equipment` skal utvides med disse feltene, må migrasjon planlegges. Hvis derimot `vegvesenData` JSON-blob er bevisst valgt (mindre kolonne-spam, kun rå JSON), må mapping-tabellen i maskin.md skrives om som "datafelter som er tilgjengelige i `vegvesenData`-JSON" — ikke som "mappes til kolonner".

**Avhandling i Maskin-revurdering:**
- Hvilke Vegvesen-felter trenger SiteDoc å søke/filtrere på? (de blir egne kolonner)
- Hvilke kan leve i `vegvesenData`-blob? (vises kun)
- Skal det være migrasjon for å materialisere de mest brukte (`euroKlasse`, `co2GramPerKm`, etc.)?

## Funn 4 — SmartDok "Underprosjekt" har egen identitet, ikke avledning

**Status:** ÅPEN — krever arkitektur-avklaring under Timer-revurdering

**Drift:** Browser-research av A.Markussens SmartDok-produksjon (autorisert bruker, april 2026) viser at Underprosjekt har **EGEN identitet** i SmartDok: GPS-koordinater, HMS-ansvarlig, kvalitetsansvarlig, kortleser-tilkobling, HMSREG-nummer. Det er **IKKE en avledning** fra ProAdm/Godkjenning.

Volum hos A.Markussen: 1468 underprosjekter på tvers av alle prosjekter, 54 på prosjekt 494 (Vervet).

**Konflikt med eksisterende plan:**
- [timer.md](timer.md) modellerer Underprosjekt som **avledning** fra ProAdm/Godkjenning (`kilde: "proadm" | "sitedoc_godkjenning"`)
- Fase-0 A.1 (`ExternalCostObject`) er en **referanse-tabell** med `proAdmId` / `godkjenningId`

**Avklaring under Timer-revurdering:**
1. Skal SiteDoc-Underprosjekt få egen identitet (GPS, HMS-ansvarlig, kvalitetsansvarlig, HMSREG, kortleser) som SmartDok?
2. Eller beholde som ren referanse-tabell per A.1?
3. Hvis egen identitet: hvordan håndteres SmartDok-eksport hvis modellene er ulike (mapping-tabell)?
4. Hvis ren referanse: hvor lever GPS og HMS-ansvarlig — på Byggeplass? På Faggruppe?

**Kilde:** [smartdok-undersokelse.md § 11](smartdok-undersokelse.md) (browser-DOM-extraction av produksjonsdata)

**Forbehold:** A.Markussen er én kunde. Generaliserbarhet til andre SiteDoc-kunder må vurderes — kanskje deres modell er for spesialisert til å være SiteDoc-default.

## Funn 5 — Stengning + attestering: 4 hull i state-design

**Status:** ÅPEN — krever beslutninger før Timer-modul-koding

**Bakgrunn:** SmartDok-undersøkelsen viste 2-dagers stengning og obligatorisk leder-attestering hos A.Markussen ("Etter 2 dager blir timeregistreringen stengt og timer blir tapt", "Prosjektledere og anleggsledere attesterer timene innen mandag i påfølgende uke"). Eksisterende design har relevante felter, men flere mekanismer er ikke modellert.

### Hull 5.1 — Default-verdier mangler i dokumentasjon

- `OrganizationSetting.timer_lock_after_days`: ingen default oppgitt i timer.md
- `OrganizationSetting.tillattSelvAttestering`: ingen default oppgitt
- A.Markussen-praksis er 2 dager + obligatorisk leder-attestering — skal det være SiteDoc-default for nye firma?

### Hull 5.2 — Purring/eskalering ikke modellert

- SmartDok har "Etterspør godkjenning"-fane (purring av ledere som ikke har attestert)
- timer.md har ingen tilsvarende mekanisme — bare `attestertVed`/`attestertAvUserId`-felter
- Auto-purring (cron) eller manuell purring fra admin-UI?

### Hull 5.3 — Lock-mekanisme uklar

- `timer_lock_after_days = 2` betyr stengning av redigering etter 2 dager
- Men hvem/hva utfører stengningen?
- Tre alternativer:
  - **Read-time-sjekk:** `if (today - dato) > N → readonly` (ingen DB-state)
  - **Cron-job:** Setter `låst Boolean` på dagsseddel-rader (eksplisitt state)
  - **Mutation-guard:** Hver oppdatering avviser hvis dato er for gammel (defensiv)

### Hull 5.4 — State-transitions ved obligatorisk leder-attestering

Når `tillattSelvAttestering = false`, kan ansatt kun klikke "Send til leder" (`draft → sent`). Men:
- Hva skjer hvis leder ikke attesterer innen X dager?
- Auto-godkjenn? Auto-avvis? Eskalering til neste leder? Status quo (data går "tapt")?
- Ingen state-machine for leder-attestering-flow er dokumentert i timer.md

**Avklaring under Timer-revurdering:**
1. Defaults: `timer_lock_after_days = 2` og `tillattSelvAttestering = false` som SiteDoc-default? Eller mer permissive?
2. Lock-mekanisme: hvilken av tre teknikker (read-time, cron, mutation-guard)?
3. State-transitions ved manglende leder-attestering innen frist?
4. Trenger SiteDoc en "Etterspør attestering"-funksjon i Fase 3 — auto-purring eller admin-UI?

**Kilde:** [smartdok-undersokelse.md § 10](smartdok-undersokelse.md) + drøftings-runde 2026-04-27

## Funn 6 — Eksport-spor: 4 schema-hull

**Status:** ÅPEN — risiko for forretnings-feil hvis ikke avklart før Timer-koding

**Bakgrunn:** [timer.md § Filtrering per eksport-spor](timer.md) beskriver 3 separate eksport-spor:
- **Lønn:** Kun arbeidskraft (lønnsart + tillegg). Filtrer ut maskiner/materialer
- **ProAdm:** Inkluder alt — lønnsart + tillegg + maskiner + materialer
- **Regnskap:** Utenfor SiteDocs ansvar — håndteres av ProAdm

Schema støtter dette mangelfullt. Fire hull identifisert:

### Hull 6.1 — Spor-filtrering bor i kode, ikke schema

- `lonnsarter.skalEksporteres: boolean` filtrerer **per katalogelement**, men sier ikke **hvilket spor**
- `tillegg.skalEksporteres: boolean` samme problem
- `sheet_machines`, `sheet_materials`, `sheet_expenses` har **INGEN** `skalEksporteres`-felt
- Logikken "lønn ekskluderer maskiner" finnes bare i fremtidig adapter-kode

**Risiko:** Lønnssystem-adapter-feil kan eksportere maskindata til Visma — kunden får faktura-data i lønnssystemet. Stille feil, vanskelig å oppdage.

**Forbedrings-forslag:** Per-katalog-element ha `eksportSpor`-felt:
```
lonnsarter {
  ...
  eksportSpor String[]   // ["lonn", "proadm"] — Lønnsart 127 går begge veier
}
sheet_machines, sheet_materials, sheet_expenses {
  ...
  // implisitt eksportSpor: ["proadm"] — aldri til lønn (regel i kode)
}
```
Eventuelt: `EksportSporKonfig` per Organization med whitelist per ressurs-type.

### Hull 6.2 — `EksportertFlagg` mangler spor-felt

- A.16 definerer `EksportertFlagg(modul, kildeId, batchId)` med unique key
- Ingen `spor`-kolonne — én dagsseddel kan eksporteres til både Lønn-batch (uten maskiner) OG ProAdm-batch (med maskiner)
- To rader i `EksportertFlagg` for samme `kildeId`? Med ulik `batchId`? Hvordan vet vi hvilken er hvilken?
- Mer eksplisitt: legg til `spor` enum-felt i unique-key for sporbarhet og clarity

### Hull 6.3 — Per-spor eksport-kode mangler

- `lonnsarter.kode` er én tekst-kolonne. Ulike systemer (Visma, Hogia, ProAdm V4) kan kreve ulike kodeformater
- A.Markussen kan ha lønnsart `127 Fakturerbar tid` til Visma og `1271` til ProAdm — én `kode`-kolonne kan ikke begge
- timer.md sier "kopieres direkte ved migrering" — men hva hvis kunden faktisk har ulike koder per system?

**Forbedrings-forslag:** Egen tabell `LonnsartEksportKode(lonnsartId, eksportType, kode)` — én rad per (lønnsart, system).

### Hull 6.4 — Per-Organization-spor-konfigurasjon mangler

- Hvilke spor er aktive for et gitt firma?
- `OrganizationIntegration.type = "proadm"` aktiverer ProAdm. Men "Lønn" er ikke én integrasjon — det er en eksport-rute som krever per-system-mapping (Visma, Hogia, etc.)
- A.Markussen har Tripletex (lønn) + ProAdm (økonomi). Modellen for "begge spor er aktive med ulike systemer" er uklar

**Avklaring under Timer-revurdering:**
1. Skal `eksportSpor` modelleres eksplisitt på katalog/transaksjons-tabeller (skjema-løsning), eller bare i adapter-kode (kode-løsning)?
2. Skal `EksportertFlagg` ha `spor`-kolonne i unique-key?
3. Skal lønnsart ha per-system eksport-kode-tabell?
4. Hvordan modelleres per-Organization-spor-konfigurasjon (hvilke systemer aktive for hvilke spor)?

**Kilde:** [smartdok-undersokelse.md § 9](smartdok-undersokelse.md) + drøftings-runde 2026-04-27

## Avsjekk-prosedyre før denne filen slettes

Filen kan slettes når alle 6 funn er kvitterte:

1. ✅ **Funn 1 (db-timer):** Beslutning tatt om når `packages/db-timer` opprettes. Dokumentert i fase-0-beslutninger (eller i timer.md hvis Fase 3-tema).
2. ✅ **Funn 2 (OrganizationSetting):** Endelig liste av Timer-relevante felter dokumentert i timer.md eller fase-0-beslutninger med riktig modellering.
3. ✅ **Funn 3 (Vegvesen-mapping):** maskin.md mapping-tabell oppdatert til faktisk schema (eller schema utvidet til å matche dok). Drift-merknaden i maskin.md fjernes samtidig.
4. ✅ **Funn 4 (Underprosjekt):** Beslutning om Underprosjekt-modell — egen identitet (SmartDok-stil) eller ren referanse (A.1-stil). Reflektert i timer.md + fase-0-beslutninger.
5. ✅ **Funn 5 (Stengning + attestering):** Defaults, lock-mekanisme, state-transitions og purring-funksjon dokumentert i timer.md.
6. ✅ **Funn 6 (Eksport-spor):** Schema-utvidelser besluttet og dokumentert i timer.md + ev. fase-0-beslutninger (skal eksportSpor være i schema, EksportertFlagg-spor, per-system-kode, per-Org-konfig).

Når alle seks er kvitterte: slett denne filen og fjern referansen i `CLAUDE.md`-indeksen.
