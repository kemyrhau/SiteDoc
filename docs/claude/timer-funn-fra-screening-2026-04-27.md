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

## Avsjekk-prosedyre før denne filen slettes

Filen kan slettes når:

1. ✅ **Funn 1 (db-timer):** Beslutning tatt om når `packages/db-timer` opprettes. Dokumentert i fase-0-beslutninger (eller i timer.md hvis Fase 3-tema).
2. ✅ **Funn 2 (OrganizationSetting):** Endelig liste av Timer-relevante felter dokumentert i timer.md eller fase-0-beslutninger med riktig modellering.
3. ✅ **Funn 3 (Vegvesen-mapping):** maskin.md mapping-tabell oppdatert til faktisk schema (eller schema utvidet til å matche dok). Drift-merknaden i maskin.md fjernes samtidig.

Når alle tre er kvitterte: slett denne filen og fjern referansen i `CLAUDE.md`-indeksen.
