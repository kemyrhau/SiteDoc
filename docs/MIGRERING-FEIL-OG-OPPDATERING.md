# Migrering Fil-til-database → SiteDoc: Feil i plan og oppdatert strategi

> Dato: 2026-03-27
> Refererer til: `docs/MIGRERING-FIL-TIL-DATABASE.md`

## Gyldig kildekode

**Den gyldige versjonen av Fil-til-database er:**

```
/Users/kennethmyrhaug/Documents/Programmering/Fil til database-kopi
```

Det finnes tre mapper med lignende navn — kun denne er riktig:

| Mappe | Status |
|-------|--------|
| `Fil til database-kopi` | **GYLDIG** — nyeste versjon med web UI, FastAPI, Next.js, Azure SQL, Docker, Entra ID |
| `Fil til database` | Eldre versjon — kun desktop (Tkinter), mangler web UI |
| `Fil-til-database-clean` | Minimal/strippa — kun `ls` og `src/`, ufullstendig |

## Feil i eksisterende migreringsplan

### 1. NotaPost Prisma-skjema mangler 9 av 12 felter

Planen foreslår kun `mengde`, `enhetspris`, `sum`. Kilden (`db_utils_new.py:158-182`) har:
- `qty_this`, `qty_total`, `qty_prev` (mengde denne/totalt/forrige periode)
- `value_this`, `value_total`, `value_prev` (beløp denne/totalt/forrige)
- `percent_complete`, `mva_this`, `sum_this`
- `mengde_anbud`, `enhetspris`, `sumanbud` (kontraktverdier)

**Konsekvens:** Uten disse mister man delta-analyse, MVA-beregning og fremdriftsvisning.

### 2. NotaPeriod mangler denormaliserte totaler

Kilden har `total_qty_this`, `total_value_this`, `total_mva_this`, `total_sum_this`, `imported_by`, `source_document_id`. Disse brukes for rask GUI-visning.

### 3. SpecPost mangler NS-felter

Kilden har `chunk_id`, `ns_title`, `full_ns_text` — nødvendig for NS-standard-kobling.

### 4. enterpriseId på SpecPost er feil modellering

Budsjettposter (SpecPost) tilhører et **prosjekt**, ikke én entreprise. En SpecPost kan refereres av A-nota fra flere UE-er. `enterpriseId` hører hjemme på `NotaPeriod` (A-nota kommer fra én spesifikk UE).

### 5. Feil filreferanse

Planen refererer til `packages/shared/src/moduler/` — denne finnes ikke. Moduldefinisjoner ligger i `packages/shared/src/types/index.ts` (`PROSJEKT_MODULER`-arrayen).

### 6. Modulsystemet er ikke tilpasset funksjon-moduler

`ModulDefinisjon.kategori` er `"oppgave" | "sjekkliste" | "funksjon"`. Aktiveringskoden i `modul.ts` oppretter maler for oppgave/sjekkliste, men gjør ingenting spesielt for `"funksjon"` utover å registrere slug. Økonomi-modulen trenger egne tabeller og sidebar-seksjon — dette må håndteres separat.

### 7. Ingen T-nota-strategi

Planen nevner `type: "a_nota" | "t_nota"` men beskriver ikke hvordan T-nota (tilleggsarbeid utenfor kontrakt) håndteres i avviksanalyse og oversikt.

## Oppdatert strategi: Tre trinn

### Trinn 1 — API-bro (null risiko)

SiteDoc får en ny tRPC-router (`okonomi`) som kaller Fil-til-database sin eksisterende FastAPI via HTTP. Ingen endring i noen av systemene — kun en ny consumer.

```
SiteDoc tRPC → HTTP → Fil-til-database FastAPI → Azure SQL
```

### Trinn 2 — PostgreSQL-støtte i Fil-til-database

Legg til `DB_TYPE=postgresql` i `conn_db.py`. SQLAlchemy-koden er allerede database-agnostisk. Azure Database for PostgreSQL (Flexible Server) beholder hele Azure-økosystemet:
- Entra ID-autentisering
- VNet-integrasjon
- pgvector-utvidelse (gratis, innebygd)
- Managed backup og skalering

### Trinn 3 — Delt database, gradvis sammenslåing

Begge systemer peker mot samme Azure PostgreSQL. SiteDoc (Prisma) og Fil-til-database (SQLAlchemy) bruker hvert sitt skjema. Gradvis portes FtD-funksjonalitet til tRPC-routere i SiteDoc.

## Korrigert Prisma-skjema (fase 1)

```prisma
model SpecPost {
  id            String   @id @default(cuid())
  projectId     String   @map("project_id")
  postnr        String?
  beskrivelse   String?
  enhet         String?
  mengdeAnbud   Decimal? @map("mengde_anbud")
  enhetspris    Decimal?
  sumAnbud      Decimal? @map("sum_anbud")
  nsKode        String?  @map("ns_kode")
  nsTittel      String?  @map("ns_tittel")
  fullNsTekst   String?  @map("full_ns_tekst")
  eksternNotat  String?  @map("ekstern_notat")

  project       Project    @relation(fields: [projectId], references: [id])
  notaPoster    NotaPost[]

  @@map("spec_posts")
}

model NotaPeriod {
  id               String    @id @default(cuid())
  projectId        String    @map("project_id")
  enterpriseId     String    @map("enterprise_id")
  periodeNr        Int       @map("periode_nr")
  periodeStart     DateTime? @map("periode_start")
  periodeSlutt     DateTime? @map("periode_slutt")
  type             String    // "a_nota" | "t_nota"
  kildeFilnavn     String?   @map("kilde_filnavn")
  totalMengdeDenne Decimal?  @map("total_mengde_denne")
  totalVerdiDenne  Decimal?  @map("total_verdi_denne")
  totalMvaDenne    Decimal?  @map("total_mva_denne")
  totalSumDenne    Decimal?  @map("total_sum_denne")
  importertAv      String?   @map("importert_av")
  createdAt        DateTime  @default(now()) @map("created_at")

  project          Project    @relation(fields: [projectId], references: [id])
  enterprise       Enterprise @relation(fields: [enterpriseId], references: [id])
  poster           NotaPost[]

  @@map("nota_periods")
}

model NotaPost {
  id              String   @id @default(cuid())
  periodId        String   @map("period_id")
  specPostId      String   @map("spec_post_id")
  mengdeDenne     Decimal? @map("mengde_denne")
  mengdeTotal     Decimal? @map("mengde_total")
  mengdeForrige   Decimal? @map("mengde_forrige")
  verdiDenne      Decimal? @map("verdi_denne")
  verdiTotal      Decimal? @map("verdi_total")
  verdiForrige    Decimal? @map("verdi_forrige")
  prosentFerdig   Decimal? @map("prosent_ferdig")
  mvaDenne        Decimal? @map("mva_denne")
  sumDenne        Decimal? @map("sum_denne")
  mengdeAnbud     Decimal? @map("mengde_anbud")
  enhetspris      Decimal?
  sumAnbud        Decimal? @map("sum_anbud")

  period          NotaPeriod @relation(fields: [periodId], references: [id])
  specPost        SpecPost   @relation(fields: [specPostId], references: [id])

  @@map("nota_posts")
}
```

## Nøkkelbeslutning som gjenstår

Brukeren modner strategien. Ikke start implementering uten eksplisitt forespørsel.
