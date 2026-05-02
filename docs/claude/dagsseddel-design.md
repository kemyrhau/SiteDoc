---
fil: dagsseddel-design.md
status: 🟢 VEDTATT — implementert i Runde 2.5/C9 2026-05-02
opprettet: 2026-05-02
sist_verifisert_mot_kode: 2026-05-02
emne: Dagsseddel-arkitektur — aktivitet/maskinbruk/vareforbruk på sedel- vs rad-nivå
---

# Dagsseddel-design — vedtatte arkitektur-beslutninger

> **Status (2026-05-02):** Alle åpne spørsmål lukket. Implementert i
> Runde 2.5/C9 (`feature/timer-2.5`). Se § Vedtatte beslutninger nederst.

## Modul-avhengigheter for dagsseddel

Avhengigheten er **hierarkisk, ikke flat** — Timer eier dagsseddelen.
Uten Timer-modul finnes ingen dagsseddel.

```
Timer (eier dagsseddel)
├── Vareforbruk  ← del av Timer-flyten på dagsseddel.
│                  Egen Varelager-modul eier varekatalog (Vare-tabell).
│                  Vareforbruk-registrering skjer i dagsseddel.
└── Maskin       ← betinget integrasjon. Hvis Maskin-modul er aktivert,
                   registreres maskinbruk i dagsseddel som kostnad
                   (sheet_machines, planlagt Runde 2.5/3).
```

| Modul | Rolle | Dokument |
|-------|-------|----------|
| **Timer** | **Eier** dagsseddelen (`daily_sheets`, `sheet_timer`, `sheet_tillegg`) | [timer.md](timer.md) |
| **Varelager** | Eier varekatalog (`Vare`-tabell, Lag 1). Vareforbruk-rad (`Vareforbruk.dagsseddelId?`) registreres inni Timer-flyten på dagsseddel | [fase-0-beslutninger.md C.16](fase-0-beslutninger.md) |
| **Maskin** | Selvstendig firmamodul (Equipment-register, vedlikehold, EU-kontroll). Cross-modul-integrasjon via service-lag (per [arkitektur-syntese § 6.1.1](arkitektur-syntese.md)). `sheet_machines` legges på dagsseddel når Maskin-modul er aktivert | [maskin.md](maskin.md) |

**Regel:** Ingen endring i `daily_sheets`, `sheet_timer`, `sheet_tillegg`
eller `sheet_machines` kan gjøres uten å lese alle tre dokumentene.
Spesielt viktig fordi Timer er eier — endringer i Timer-schema rir
oppstrøms til Vareforbruk- og Maskin-integrasjon.

**Bakgrunn for regelen:** Aktivitet/maskinbruk/vareforbruk-konflikten i kveld
2026-05-02 (Maskintimer-aktivitet vs `sheet_machines` vs `Vareforbruk`) viste
at modulgrenser er klare i isolerte spec-er men UKLARE når dagsseddelen er
knutepunkt. Begrepet «materialer» har f.eks. tre konkurrerende
representasjoner: `sheet_materials`-skissen (foreldet), `sheet_machines.mengde`
(maskin-utlagt mengde), `Vareforbruk` (varekatalog-FK). Endringer på én side
gir ringvirkninger som kun ses ved å lese alle tre.

## Problemstilling

Under Runde 2 visuell verifisering av Timer-modulen oppdaget Kenneth at han
**ikke kan registrere både maskintimer og anleggsarbeid på samme dag/prosjekt**.

### Rotårsak (verifisert mot kode 2026-05-02)

Schema fra Runde 1B (commit `c1122c2e`):

```prisma
model DailySheet {
  aktivitetId String  // ← på sedel-nivå, ikke rad-nivå
  ...
  @@unique([userId, projectId, dato])  // ← én sedel per dag/prosjekt
}

model SheetTimer {
  lonnsartId           String
  externalCostObjectId String?  // ← FLYTTET TIL RAD 2026-04-29 (precedens)
  // INGEN aktivitetId her
}
```

A.Markussen-empiri (per [smartdok-undersokelse.md § 4.2](smartdok-undersokelse.md))
har fem aktiviteter, deriblant **både `Anleggsarbeid` (kode 11) og
`Maskintimer` (kode 18)**. En typisk anleggsentreprenør-arbeider gjør begge
samme dag på samme prosjekt.

Med dagens schema må arbeideren velge én aktivitet for hele dagen — det er
umulig å fordele 5t som maskintimer + 3t som anleggsarbeid innen én sedel.

## Beslektede avgrensninger

Tre planlagte/eksisterende modeller dekker ulike aspekter av samme tema —
viktig å skille rollene før beslutning:

| Tabell | Status | Rolle | Skill mot aktivitet |
|---|---|---|---|
| **`SheetTimer.aktivitetId`** (foreslått) | ❌ Ikke implementert | Lønnsart-kategorisering på time-rad — «av timene mine var 5t maskintimer-aktivitet» | Dette er det Kenneth trenger nå. Lønn-relevant. |
| **`sheet_machines`** | ❌ Planlagt Runde 2/3 ([timer.md:740](timer.md)) | Konkret Equipment-bruk: «kantsteinsetter EQ-042, 5t, 47m» | Maskinregnskap — avskrivning, vedlikehold, kunde-fakturering for maskin |
| **`Vareforbruk`** (C.16) | ❌ Planlagt Fase 3 ([fase-0-beslutninger.md C.16](fase-0-beslutninger.md)) | Materialer fra varekatalog: «47m kantstein, 12 tonn pukk» | Vareforbruk-modul, transaksjonslogg uten lagerstand |
| ~~`sheet_materials`~~ | ❌ **FORELDET** ([timer.md:755](timer.md)) | Eldre skisse — fritekst materiale på dagsseddel | Erstattet av C.16 Vareforbruk (2026-04-30) |

**Disse er ikke redundante.** En arbeider kan ha alle samtidig:
- 5t arbeidstid kategorisert som «Maskintimer»-aktivitet (lønn — krever rad-nivå-aktivitet)
- + en `sheet_machines`-rad: kantsteinsetter EQ-042, 5t, 47m (maskinregnskap)
- + en `Vareforbruk`-rad: 47m smågatestein (varekatalog → faktura)

## Tre alternativer for aktivitet på rad-nivå

### Alternativ A — Flytt `aktivitetId` til `SheetTimer` (anbefalt)

**Endring:** `SheetTimer.aktivitetId String` (NOT NULL) + Restrict-FK.

**Presedens:** ECO ble flyttet fra `daily_sheets` → `sheet_timer` 2026-04-29
([timer.md:642](timer.md)) av samme grunn — multi-ECO innen én sedel. Aktivitet
er den naturlige neste flyttingen.

**Konsekvens:**
- ✅ Matcher virkeligheten 1:1 (lønnsart + aktivitet + ECO alle per rad)
- ✅ Konsistent med C8 ECO-design
- ✅ Migrasjon triviell — backfill fra parent-sedlens `aktivitetId`
- ⚠️ `DailySheet.aktivitetId` — beholdes som default for nye rader (UX) eller
  fjernes? Anbefaler **beholde som "default"** — folks første rad arver
  default-aktivitet, kan overstyres per rad
- ⚠️ Berører server (tilfoyTimerRad/oppdaterTimerRad/syncBatch), mobil
  (sheet_timer_local + TimerRadModal), web (Runde 1B detaljside), eksport-spec

### Alternativ B — Bruk `sheet_machines` for maskinbruk-spor, behold aktivitet på sedel

**Endring:** Implementer `sheet_machines` (Runde 2.5/3). Aktivitet på sedel forblir
"Anleggsarbeid"; maskinbruk registreres som egne rader med Equipment-FK + timer
+ mengde.

**Konsekvens:**
- ✅ Ingen schema-endring av eksisterende tabeller
- ❌ Løser ikke det grunnleggende problemet — «Maskintimer» som *aktivitet* er
  fortsatt blokkert. Lønn-rapportering kan ikke skille time-kategoriene
- ❌ Krever maskin-modul-integrasjon (db-maskin EquipmentLocal-cache),
  utsatt scope

### Alternativ C — La som er

**Konsekvens:** Kunden bruker én aktivitet per dag. Maskinbruk skilles via
fremtidig `sheet_machines`. Lønn-eksport mister muligheten til å rapportere
«hvor mye av timene er maskinarbeid».

## Anbefaling

**Alternativ A** — flytt `aktivitetId` til `SheetTimer` (rad-nivå).

Grunner:
1. Matcher A.Markussen-virkelighet (Maskintimer + Anleggsarbeid samme dag/prosjekt)
2. Konsistent med ECO-flyttingen 2026-04-29
3. Migrasjon trivial (backfill fra parent)
4. `sheet_machines` (Alt B) løser et annet problem — Equipment-spesifikk
   bruk, ikke time-kategorisering
5. Lønn-eksport per [timer.md § Eksport-kolonner:390](timer.md) inkluderer
   `aktivitetId` → `aktiviteter.kode` — meningsfullt kun hvis aktivitet er
   per rad

## Åpne spørsmål før koding

1. **Beholde `DailySheet.aktivitetId` som default?** Anbefaler ja for UX-bekvemmelighet.
2. **Web Runde 1B-detaljside:** Skal aktivitet vises per rad der også, eller
   kun mobil? Anbefaler begge — schema endres uansett.
3. **Backfill-strategi:** Eksisterende `sheet_timer`-rader får parent-sedlens
   aktivitet som default. Trivielt SQL-update i samme migrasjon.
4. **Eksport-format:** Hvordan rapporteres aktivitet per rad i CSV-output for
   ProAdm/Tripletex? Tilsvarende ECO — én kolonne per rad.

## Maskinbruk-spørsmål (separat fra aktivitet-flytting)

`sheet_machines` (Runde 2.5/3) er **separat beslutning**. Når den implementeres:

- **Hvis maskin brukes på flere prosjekter samme dag** (kranbil flyttes mellom
  3 byggeplasser): krever 3 separate dagssedler per dagens schema.
  Ikke designet eksplisitt i timer.md eller maskin.md — se [§ 3 i
  varelager-rapport-tråd 2026-05-02 (denne sesjonen)].
- **Sheet_machines.vehicleId** → svak FK til db-maskin Equipment, samme
  cross-package-mønster som ECO/avdeling.
- Per [maskin.md:144](maskin.md) skal Timer kalle `hentKjoretoyForFirma(orgId)`
  fra service-laget — ikke direkte db-maskin-import.

## Vareforbruk-avklaring (også separat)

C.16 ([fase-0-beslutninger.md:1305-1376](fase-0-beslutninger.md)):

- `Vare` (firma-katalog) + `Vareforbruk` (per prosjekt med valgfri `dagsseddelId`)
- **Erstatter `sheet_materials`** fra timer.md:755 — ikke arkivert formelt der ennå
- Plassering (egen `db-varelager` vs integrert i `db`) ikke besluttet
- Fase 3 per C.16 (vs Fase 5 per arkitektur-syntese:389) — C.16 er nyere og
  mer presis; gjeldende plassering

## Hva må gjøres når beslutning er fattet

Hvis Alternativ A vedtas:

1. **packages/db-timer schema:** `SheetTimer.aktivitetId` NOT NULL + Restrict-FK
2. **Migrasjon:** ALTER TABLE + backfill fra DailySheet.aktivitetId + NOT NULL
3. **Server tRPC:** `tilfoyTimerRad` / `oppdaterTimerRad` / `syncBatch` får
   `aktivitetId`-parameter
4. **`hentEndringerSiden`:** returnerer `aktivitet` per rad
5. **Mobil Drizzle:** `sheet_timer_local.aktivitetId TEXT NOT NULL` +
   idempotent ALTER (eller drop+recreate siden ingen prod-data)
6. **Mobil sync-motor (`timerSync.ts`):** sender og lagrer `aktivitetId` per rad
7. **Mobil [id].tsx TimerRadModal:** ny aktivitet-velger (default fra sedel)
   + visning på TimerRadVis under lønnsart
8. **i18n:** `timer.felt.aktivitetPerRad` eller behold eksisterende `felt.aktivitet`
9. **Web Runde 1B detaljside:** matchende aktivitet-velger per rad
10. **timer.md:** marker `sheet_materials` som foreldet (peker til C.16
    Vareforbruk), oppdater Eksport-kolonner-tabellen, oppdater
    Dagsseddel-flyt-mockup
11. **fase-0-beslutninger.md:** ny C.18 «Aktivitet flyttet fra
    DailySheet til SheetTimer» (samme mønster som C.16 ECO)

Estimert scope: 1.5–2 timer.

## Tid-stempel for kontekst

Identifisert under Runde 2 visuell verifisering 2026-05-02 ~kl 02:00.
Ikke en del av Runde 2-scope. Tas i egen runde (Runde 2.5 eller C9) i
neste sesjon.

---

## Vedtatte beslutninger (2026-05-02 — implementert i C9)

| # | Beslutning | Verdi |
|---|---|---|
| 1 | `SheetTimer.aktivitetId` | NOT NULL, Restrict-FK, backfill fra parent |
| 2 | `DailySheet.aktivitetId` | nullable default — arves av nye rader, kan overstyres per rad |
| 3 | Auto-fordeling | begge rader får sedelens default-aktivitet, kan overstyres |
| 4 | `sheet_machines` | implementert nå (samme runde som aktivitet-flytt) |
| 5 | `attestertSnapshot` på SheetMachine | felt i schema, null inntil Equipment-prising er spec'd (Maskin Fase 1+) |
| 6 | Maskin-cache mobil | utsatt til Runde 2.6 (Equipment_local + sync-lokal) |
| 7 | Mutation-plassering maskin | `timer.dagsseddel.maskin.*` (db-timer eier tabellen) |
| 8 | `hentDagstotal({userId, dato})` | sum timer på tvers av prosjekter per dag |
| 9 | `ExternalCostObject.proAdmType` | `String?` — fri tekst, utvides dynamisk når nye typer dukker opp |
| 10 | ECO-type → Godkjenning-mapping | utsatt til egen runde før Runde 3 (eksport-adaptere) |
| 11 | Multi-sedel per dag (`(userId, projectId, dato)` UNIQUE) | beholdt — én sedel per arbeidsdag/prosjekt; `hentDagstotal` aggregerer |

## Implementasjons-spor (C9 commit)

- packages/db: `proadm_type` på `external_cost_objects` (migrasjon `20260502000001_add_eco_proadm_type`)
- packages/db-timer: `aktivitet_id` NOT NULL på `sheet_timer` + nullable på `daily_sheets` + `sheet_machines`-tabell (migrasjon `20260502000001_aktivitet_per_rad_og_sheet_machines`)
- apps/api: `tilfoyTimerRad`/`oppdaterTimerRad`/`syncBatch`/`hentEndringerSiden` får `aktivitetId` per rad. `attester` snapshot inkluderer aktivitet-felter. Ny `timer.dagsseddel.maskin.{tilfoy,oppdater,fjern}` + `timer.dagsseddel.hentDagstotal`. `eksternKostObjekt.list` returnerer `proAdmType`.
- apps/web: TimerRadDialog får aktivitet-velger (default fra sedel). Ny MaskinSeksjon + MaskinRadDialog med soft-skjul (skjules hvis Equipment-listen er tom).
- apps/mobile: TimerRadModal får aktivitet-velger inline + ny AktivitetVelgerModal. sheet_timer_local utvides idempotent. sheet_machine_local opprettes (men UI utsatt til 2.6 — sync-laget håndterer det).

## Etter C9 — gjenstående arbeid

- **Runde 2.6** (egen): equipment_local + maskinKatalog + maskin-seksjon på mobil
- **Runde ECO-type → Godkjenning-mapping** (egen, før Runde 3): mapping-policy fra ProAdm-typer til Godkjenning-flytmaler
- **Runde 3** (Eksport-adaptere): bruker C9-snapshot for lønn-eksport per aktivitet
