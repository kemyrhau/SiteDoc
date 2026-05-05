---
name: Steg 4b-plan
description: Komplett implementasjonsplan for Vareforbruk-modul (Steg 4b) inkl. Equipment-utleie-utvidelse, A.Markussen-import og 5-faset utrulling
sist_verifisert_mot_kode: 2026-05-06
---

# Steg 4b — Vareforbruk-modul

Implementasjonsplan vedtatt 2026-05-05. Bygger på C.16 i
[fase-0-beslutninger.md](fase-0-beslutninger.md) og A.Markussens SmartDok-
varekatalog (`Varedetaljer.xls.xls`, 64 varer kartlagt 2026-05-05).

## 0. Beslutninger (2026-05-05)

| # | Beslutning | Rasjonale |
|---|---|---|
| 1 | **Pakke:** ny `packages/db-varelager` (egen Prisma-pakke, konsekvent med `db-timer` + `db-maskin`) | C.16 omtaler det som egen modul. Cross-package-FK-mønster etablert |
| 2 | **`Vare.enhet`:** fritekst med forslagsliste — `m / m² / m³ / kg / kilo / tonn / stk / sekk / meter / liter / døgn / timer` | A.Markussen-data viste 9 enheter brukt, hvorav 4 ikke i C.16-spec (Sekk, Meter, Døgn, Liter). Fritekst med forslagsliste skalerer |
| 3 | **Heatwork ekskluderes** fra Vareforbruk — håndteres via `Equipment.erUtleieobjekt`-flagg | A.Markussen har 6 Heatwork-rader i SmartDoks varekatalog som dobbelt-eksisterer som Equipment (internnr 7626/7628/...). Domenemodell: utstyr ≠ vare som forbrukes |
| 4 | **ECO-kobling:** `externalCostObjectId?` på Vareforbruk | Konsekvent med `SheetTimer.externalCostObjectId` (Timer-modul). Tillater fakturering mot underprosjekt/ECO uten å påvirke prosjekt-eier |
| 5 | **Import:** ~58 varer fra A.Markussens SmartDok (64 minus 6 Heatwork) | Konkret startpunkt — tom katalog ville sinket A.Markussen unødvendig |
| 6 | **Lag 3 Transport** utsettes — egen oppfølger | C.16 markerer det som «separat opsjon». Ikke bland inn i Vareforbruk-MVP |
| 7 | **Slug:** `varelager` (firmamodul-aktivering) | Klient-typen `ModulSlug` har den allerede; «kommer snart»-status i `/dashbord/firma/moduler` |

## 1. Avhengigheter (alle ✅ klare)

| Avhengighet | Status |
|---|---|
| **Steg 1e** (OrganizationModule for firma-aktivering) | ✅ deployet prod 2026-05-05 (`de044be4`) |
| `OrganizationSetting.vareforbrukTilgangDefault` | ✅ deployet (Steg 2c) — `alle-ansatte`/`kun-prosjektmedlemmer`/`sertifiserte` |
| `DailySheet` for valgfri `dagsseddelId`-kobling | ✅ db-timer (Runde 1B) |
| `ExternalCostObject` for ECO-kobling | ✅ kjernen |
| `Byggeplass` for valgfri lokasjon | ✅ Fase 0.5 |
| `Activity`-tabell for audit-spor | ✅ Fase 0 § E.1 |
| Cross-package-FK-mønster | ✅ etablert (db-maskin + SheetMachine) |
| `firma/moduler/page.tsx` UI | ✅ varelager-slug allerede registrert med i18n-nøkler |

## 2. Datamodell

### Lag 1 — Vare (firma-katalog) i `db-varelager`

```prisma
model Vare {
  id              String   @id @default(uuid())
  organizationId  String   @map("organization_id")  // svak FK → kjernen
  navn            String
  varenummer      String?
  enhet           String   // "m" | "m2" | "m3" | "kg" | "kilo" | "tonn" | "stk" | "sekk" | "meter" | "liter" | "doegn" | "timer" | (fritekst)
  pris            Decimal? @db.Decimal(12, 2)  // utsalgspris til kunde
  internkostnad   Decimal? @db.Decimal(12, 2)  // innkjøpspris
  kategori        String?  // fritekst per firma
  aktiv           Boolean  @default(true)
  createdAt       DateTime @default(now())  @map("created_at")  @db.Timestamptz()
  updatedAt       DateTime @updatedAt        @map("updated_at")  @db.Timestamptz()

  vareforbruk     Vareforbruk[]

  @@unique([organizationId, varenummer])
  @@index([organizationId, aktiv])
  @@map("varer")
  @@schema("varelager")
}
```

### Lag 2 — Vareforbruk (prosjekt-transaksjon) i `db-varelager`

```prisma
model Vareforbruk {
  id                     String   @id @default(uuid())
  dato                   DateTime @db.Date
  projectId              String   @map("project_id")              // svak FK → kjernen
  byggeplassId           String?  @map("byggeplass_id")           // svak FK, NULL = hele prosjektet (per A.30)
  externalCostObjectId   String?  @map("external_cost_object_id") // svak FK → ECO (kjernen)
  vareId                 String   @map("vare_id")
  antall                 Decimal  @db.Decimal(12, 2)
  registrertAvUserId     String   @map("registrert_av_user_id")   // ingen @relation (A.3-mønster)
  kommentar              String?
  dagsseddelId           String?  @map("dagsseddel_id")           // svak FK → DailySheet (db-timer)

  // Snapshot ved attestering (A.7-mønster)
  attestertSnapshot      Json?    @map("attestert_snapshot")      // {prisSnapshot, internkostnadSnapshot, varenavnSnapshot, enhetSnapshot, attestertVed}

  createdAt              DateTime @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt              DateTime @updatedAt       @map("updated_at") @db.Timestamptz()

  vare                   Vare     @relation(fields: [vareId], references: [id], onDelete: Restrict)

  @@index([projectId, dato])
  @@index([dagsseddelId])
  @@index([externalCostObjectId])
  @@map("vareforbruk")
  @@schema("varelager")
}
```

**Beslutninger:**
- `dato` er `Date` (ikke `DateTime`) — vareforbruk er per-dag, ikke per-tidspunkt
- `vareId` har **`onDelete: Restrict`** — sletting av vare med eksisterende forbruk blokkeres (forskriftspålagt audit-spor)
- `attestertSnapshot` følger A.7-mønsteret — låser pris/navn ved attestering for fakturering
- Ingen `enhet`-felt på Vareforbruk — utledes fra `vare.enhet` (snapshot ved attestering)

### Equipment-utleie-utvidelse i `db-maskin`

```prisma
model Equipment {
  // eksisterende felter +

  // Steg 4b Fase 2 — utleieobjekt
  erUtleieobjekt     Boolean  @default(false)        @map("er_utleieobjekt")
  utleieprisPerDogn  Decimal? @db.Decimal(10, 2)     @map("utleiepris_per_dogn")
  utleieprisPerTime  Decimal? @db.Decimal(10, 2)     @map("utleiepris_per_time")
  utleieEnhet        String?  @map("utleie_enhet")   // "doegn" | "time" — primærenhet for fakturering
}
```

**Hva som IKKE bygges i Fase 2:**
- `EquipmentRental`-tabell for utleie-transaksjoner — utsettes til **Steg 4d**
- `SheetMachine.fraDato`/`tilDato` periode-felter — utsettes til Steg 4d
- Faktiske utleie-transaksjoner registreres midlertidig via eksisterende `SheetMachine` med `enhet="doegn"` og `mengde=antall_dogn`

## 3. Fase 1 — Schema (~2t)

| Steg | Detalj |
|---|---|
| 1.1 | Opprett `packages/db-varelager/` — speil `db-timer`-struktur (package.json, tsconfig, prisma/, src/) |
| 1.2 | Skriv `prisma/schema.prisma` med `varelager`-schema, multiSchema preview, Vare + Vareforbruk-modeller |
| 1.3 | Migrasjon `20260506000001_init` — CREATE SCHEMA varelager + CREATE TABLE varer + vareforbruk |
| 1.4 | Egen Prisma-klient generering (`.prisma/varelager-client`) |
| 1.5 | `prismaVarelager` lagt til i tRPC-context (`apps/api/src/trpc/trpc.ts`) |
| 1.6 | Workspace-deps: `@sitedoc/db-varelager` i `apps/api/package.json` + `apps/web/package.json` |
| 1.7 | `pnpm install` + `pnpm --filter @sitedoc/db-varelager exec prisma generate` |

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. Migrasjons-SQL skrives ikke til lokal-DB ennå (test-deploy applier).

## 4. Fase 2 — Equipment-utleie-utvidelse (~2t)

| Steg | Detalj |
|---|---|
| 2.1 | Utvid `db-maskin/prisma/schema.prisma` Equipment-modell med 4 nye felter (erUtleieobjekt + 3 utleie-felter) |
| 2.2 | Migrasjon `db-maskin/prisma/migrations/20260506000002_equipment_utleieobjekt` — ALTER TABLE ADD COLUMN |
| 2.3 | tRPC: `maskin.equipment.oppdater` utvides med utleie-felter (allerede generisk RedigerInputs-mønster) |
| 2.4 | Klient: rediger-modal på `/dashbord/maskin/[id]` får ny seksjon «Utleie» (toggle + 2 pris-felter + enhet-velger) |
| 2.5 | Detaljside: ny «Utleie»-seksjon read-only (vises kun når `erUtleieobjekt=true`) |
| 2.6 | i18n: ~6 nye nøkler under `maskin.utleie.*` (nb+en) |

**Hva Fase 2 IKKE leverer:**
- Utleie-transaksjons-flyt (Steg 4d)
- Automatisk migrering av Heatwork-rader fra Vare til Equipment (gjøres som del av A.Markussen-import i Fase 5)

**Verifisering:** typecheck + build grønt. Lokal-DB ikke berørt.

## 5. Fase 3 — tRPC-routes (~3t)

### 5.1 Vare-katalog (firma-admin)

```
vare.list({ organizationId, kunAktive? })
vare.opprett({ organizationId, navn, varenummer?, enhet, pris?, internkostnad?, kategori? })
vare.oppdater({ id, organizationId, ... })
vare.deaktiver({ id, organizationId })  // soft-delete via aktiv=false
```

Gates med `verifiserFirmaAdmin` + `krevFirmamodulAktivert(orgId, "varelager")`.

### 5.2 Vareforbruk-registrering (prosjektmedlem)

```
vareforbruk.list({ projectId, periode?, byggeplassId?, dagsseddelId? })
vareforbruk.opprett({ projectId, dato, vareId, antall, byggeplassId?, externalCostObjectId?, kommentar?, dagsseddelId? })
vareforbruk.oppdater({ id, ... })  // kun før attestertSnapshot er satt
vareforbruk.slett({ id })
```

Gates med:
- `harProsjektTilgang` (medlem eller company_admin)
- `OrganizationSetting.vareforbrukTilgangDefault` — `alle-ansatte` / `kun-prosjektmedlemmer` / `sertifiserte` (sertifiserte krever Kompetanse-sjekk; foreløpig fallback til `kun-prosjektmedlemmer`)
- ECO-validering hvis `externalCostObjectId` gitt: samme firma+prosjekt, status=aktiv, vareforbrukApen=true (ny boolean på ECO — `externalCostObject`-utvidelse, eller bruk eksisterende `timerregistreringApen` som proxy?)

**Beslutning:** Bruk eksisterende `timerregistreringApen` som proxy for ECO-vareforbruk-tilgang. Egen flagg vurderes hvis behov dukker opp.

### 5.3 Vareforbruk-import (firma-admin)

```
vareforbruk.import.importerForhandsvisning({ organizationId, filinnhold (XML-Excel-string) })
vareforbruk.import.importerBekreft({ organizationId, filhash, varer: [...] })
```

Speiler `maskin.import.*`-mønsteret. Filtrerer ut `kategori === "Utleie Heatwork"` med rapport om utelatte rader (separat seksjon i forhåndsvisning). Atomisk Prisma-transaction. Filhash-validering for konsistens.

### 5.4 Activity-logging

`vareforbruk.opprett` + `oppdater` + `slett` skriver `Activity`-rad (best-effort try/catch):
- `target_type=vareforbruk`
- `action=vare.registrert | vare.endret | vare.slettet`
- `payload={projectId, vareId, antall, ...}`

## 6. Fase 4 — Klient (~4t)

### 6.1 Firma-admin: `/dashbord/firma/varelager`

| Side | Detalj |
|---|---|
| `/dashbord/firma/varelager/page.tsx` | Tabell over alle varer (navn, varenr, kategori, enhet, pris, aktiv-status). Filter på kategori + søk |
| `/dashbord/firma/varelager/import/page.tsx` | 4-stegs flyt (Last opp → Forhåndsvis → Bekreft → Resultat). Drag-and-drop på SpreadsheetML XML (samme som SmartDok eksporterer) |
| Modaler | `OpprettVareModal`, `RedigerVareModal`, `DeaktiverVareDialog` (ekte Modal per CLAUDE.md UI-regel) |

Sidebar-element «Varelager» (Boxes-ikon) i firma-layout — gates på `aktiveFirmamoduler.includes("varelager")`.

### 6.2 Prosjekt-side: `/dashbord/[prosjektId]/vareforbruk`

| Side | Detalj |
|---|---|
| `page.tsx` | Tabell over forbruk for prosjektet (filter på periode + byggeplass + dagsseddel-koblet/ikke). Inline opprett-knapp |
| `OpprettForbruktDialog` | Vare-velger (kombinert dropdown + søk når katalog > 7), antall + enhet-snapshot, dato, byggeplass, ECO-velger |
| Detalj-modal | Vis attestert-snapshot (read-only når låst) |

Sidebar-element «Vareforbruk» (Package-ikon) i prosjekt-sidebar — gates på `ProjectModule(slug="varelager", status="aktiv")`.

### 6.3 i18n

~50 nye nøkler under `firma.varelager.*` + `vareforbruk.*` + `firma.varelager.import.*` (nb+en).

### 6.4 Mobil — utsettes til Steg 4b.5

Mobile-flyt for å registrere vareforbruk fra dagsseddel:
- Drizzle-skjema for `vare_local` + `vareforbruk_local`
- Sync-motor (samme mønster som Timer Runde 2 C1-C8)
- UI-integrasjon i dagsseddel-detalj

**Beslutning:** Utsette til Steg 4b.5 etter web-MVP er stabilt. A.Markussen kan registrere via web som første milepæl.

## 7. Fase 5 — Import-flyt (~2t)

### 7.1 Server-side parser

`apps/api/src/utils/vareforbrukImport.ts`:

| Funksjon | Detalj |
|---|---|
| `parseSmartDokVarerXml(filinnhold: string)` | Parser SpreadsheetML XML — samme format som `Varedetaljer.xls.xls` |
| `klassifiserKategori(rad)` | Heatwork → utelat (med advarsel «kobles til Equipment via internnr»). Andre → behold |
| `normaliserEnhet(verdi: string)` | "Døgn" → "doegn", "Tonn" → "tonn", "m3" → "m3", behold ukjente som-er |
| `beregnFilHash(filinnhold)` | SHA-256 for konsistens-validering |

### 7.2 Forventet resultat for A.Markussen

| Kategori | Antall | Behandling |
|---|---|---|
| Grus/pukk/jord | 36 | Importeres som Vare |
| Diverse | 8 | Importeres |
| Naturstein | 8 | Importeres |
| Utleie Heatwork | 6 | **Utelates** + advarsel «koble til Equipment via internnr 7626/7628/7630/7632/7634 + HW-vifte» |
| Betongstein og elementer | 2 | Importeres |
| Rør og rørdeler | 2 | Importeres |
| Deponiavgift | 1 | Importeres |
| Forbruk | 1 | Importeres |
| **Sum importert** | **58** | |
| **Sum utelatt** | **6** | Manuelt etterarbeid: marker eksisterende Equipment-rader som `erUtleieobjekt=true` |

### 7.3 Datakvalitet-funn å håndtere

| Problem | Tiltak |
|---|---|
| 1 rad har «.» som navn | Filtrer ut, advarsel |
| Samme vare med to enheter (eks. Bærelag 0-22 m³ + Tonn) | Behold begge — `(orgId, varenummer)`-unique tillater det |
| Pris=0 på 62/64 rader | Importer som null. Bruker fyller inn manuelt |
| Internkostnad tom på alle | Importer som null |
| Antall-kolonnen (forbrukshistorikk) | Forkast — tilhører transaksjons-loggen, ikke katalog |

## 8. Hva er IKKE i scope for Steg 4b

| Punkt | Plassering |
|---|---|
| **Equipment-utleie-transaksjoner** (EquipmentRental-tabell, periode-felter på SheetMachine, faktiske utleie-rad) | Steg 4d |
| **Lag 3 Transport** (massetransport som egen strøm) | Egen oppfølger |
| **Mobil offline-sync** for Vareforbruk | Steg 4b.5 |
| **Eksport til ProAdm** av Vareforbruk | DO-kobling, Fase 6 |
| **Sertifiserte-policy-håndhevelse** (krever Kompetansetype med «kreves for vareregistrering»-flagg) | Senere — fallback til `kun-prosjektmedlemmer` i Fase 3 |

## 9. Estimat-totalt

| Fase | Estimat | Avhengig av |
|---|---|---|
| Fase 1 — Schema | 2t | — |
| Fase 2 — Equipment-utleie | 2t | Fase 1 (uavhengig DB-pakke, men gir mening sammen) |
| Fase 3 — tRPC-routes | 3t | Fase 1 + 2 |
| Fase 4 — Klient | 4t | Fase 3 |
| Fase 5 — Import | 2t | Fase 3 + 4 |
| **Sum** | **13t** | |

Pluss verifiserings-buffer (~2t) og dokumentasjons-oppdateringer (~1t) → **~16t totalt**.

Anbefales delt på 2-3 sesjoner:
- Sesjon 1: Fase 1 + 2 (schema + Equipment-utvidelse) → test-deploy
- Sesjon 2: Fase 3 + 4 (server + klient web) → test-deploy
- Sesjon 3: Fase 5 (import + A.Markussen-data) → prod-deploy

## 10. Verifiseringsplan

Per fase:

**Fase 1+2:** psql `\d varelager.varer` + `\d maskin.equipment` viser nye kolonner. Migrasjoner applied til test-DB.

**Fase 3:** tRPC-callsites kan kalles fra DevTools. Vare-CRUD round-trip + Vareforbruk-opprett verifiseres.

**Fase 4:** Som **Kari Firmaadmin** på Byggeleder: aktiver Varelager-modul i `/dashbord/firma/moduler` → katalog-side viser «Ingen varer ennå» → opprett vare → ny rad i tabell. Som **Per Prosjektadmin**: gå til prosjekt-vareforbruk-side → registrer forbruk → vises i tabell.

**Fase 5:** Last opp `Varedetaljer.xls.xls` → forhåndsvisning viser 58 importerbare + 6 utelatte (Heatwork) + 1 advarsel («.»-rad) → bekreft → 58 Vare-rader opprettet i test-DB.

**A.Markussen prod-deploy (etter Fase 5):**
1. Aktiver Varelager-modul for A.Markussen via `settFirmamodul`
2. Importer 58 varer
3. Manuell oppfølger: marker Equipment-rader 7626/7628/7630/7632/7634 + HW-vifte som `erUtleieobjekt=true`

## 11. Modul-typologi-bekreftelse

Per [terminologi.md § 0](terminologi.md):
- **Vareforbruk-modulen er firmamodul** (slug `varelager`)
- Aktiveres via `OrganizationModule(slug="varelager", status="aktiv")` på firmanivå
- Auto-syncs til `ProjectModule`-rader for alle firmaets prosjekter (Steg 1c-mønster)
- Per-prosjekt deaktivering ikke støttet (samme avgjørelse som Timer/Maskin)

## 12. Referanser

- [fase-0-beslutninger.md § C.16](fase-0-beslutninger.md) — Vareforbruk-modul vedtatt 2026-04-30
- [domene-arbeidsflyt.md](domene-arbeidsflyt.md) — Steg 4b i prioritert byggerekkefølge
- [dagsseddel-design.md](dagsseddel-design.md) — Cross-modul-grensesnitt mot dagsseddel
- [terminologi.md § 0](terminologi.md) — Firmamodul vs prosjektmodul
- A.Markussen-data: `Varedetaljer.xls.xls` (lokalt, 64 varer, 8 kategorier, 9 enheter)
- Steg 1e-deploy: `de044be4` (prod 2026-05-05) — forutsetning lukket
