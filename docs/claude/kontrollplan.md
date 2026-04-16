# Kontrollplan og sjekklistebibliotek

## Bakgrunn og konsept

SiteDoc skal ha et **sentralarkiv for sjekklister** basert på norske byggstandarder (NS 3420 som første standard). Prosjekter velger hvilke sjekklister de vil bruke ved å huke av i biblioteket. Valgte sjekklister importeres som vanlige SjekklisteMaler (`ReportTemplate` + `ReportObjects`), fullt redigerbare i malbyggeren — inntil brukeren valgfritt kobler dem til kontrollplan eller dokumentflyt.

**Merk:** De ferdigbygde NS 3420-K malene er et utkast og skal forbedres.

## Fullstendig flyt

```
SENTRALARKIV (globalt, kun sitedoc_admin)
  BibliotekStandard → BibliotekKapittel → BibliotekMal
  Eksempel: NS 3420-K → KB (Jord og vegetasjon) → KB2.2 Jordarbeider
      ↓ prosjektleder åpner "Hent fra bibliotek" og huker av

PROSJEKT-SJEKKLISTEMALER (instansiert kopi per prosjekt)
  Vanlig ReportTemplate + ReportObjects i prosjektets enterprise
  Synlig og brukbar for alle fag uten kobling
  Kan redigeres og tilpasses fritt i malbyggeren
  ProsjektBibliotekValg holder referanse tilbake til kilde
      ↓ valgfritt steg A

KONTROLLPLAN
  Kobler sjekkliste → lokasjon (sone/rom) → tid → ansvarlig
  Gir sporbarhet, varsling og fremdriftstracking
      ↓ valgfritt steg B

DOKUMENTFLYT
  Kobler sjekkliste til entreprise-flyt med trinn og godkjennere
  Byggherre / Tømrer / Elektro osv.
```

## Arkitektur-oversikt

```
┌──────────────┐   ┌──────────────┐   ┌──────────────────┐
│  Malbygger   │   │  Tegninger   │   │   Sone / Rom     │
│  BIM-egenskap│   │  DWG/PDF/IFC │   │  Tegning-markup  │
│  Soneegenskap│   │  per bygge-  │──→│  Etasje → Sone   │
│  Romegenskap │   │  plass       │   │  Sone → Rom(mer) │
└──────┬───────┘   └──────┬───────┘   └────────┬─────────┘
       │ maler            │ kobles til          │ lokasjon
       ↓                  ↓                     ↓
┌──────────────┐   ┌─────────────────────────────────────┐
│  Sjekkliste  │──→│          KONTROLLPLAN                │
│  Fra mal     │   │  Sjekkliste + Sted + Tid             │
│  eller ad-hoc│   │  Ansvarlig + Status                  │──→ Varsling
│  Oppgaver/felt   │  Varsling                            │    Push / SMS
└──────────────┘   └──────────────┬──────────────────────┘    Frist / frekvens
                                  │
                                  ↓
                          ┌───────────────┐   ┌──────────────┐
                          │  Utførelse    │   │   Rapport    │
                          │  Mobil / felt │   │  PDF/oversikt│
                          │  Foto, sign,  │   │  Status per  │
                          │  kommentar    │   │  sone        │
                          └───────────────┘   └──────────────┘
```

## Datamodell

```
BibliotekStandard  (NS3420-K, NS3420-F, ...)
  └── BibliotekKapittel  (KA, KB, KC, KD, ...)
        └── BibliotekMal  (KB2 – Jordarbeider, KD1 – Utendørsbelegg, ...)
              │  malInnhold: JSON — feltdefinisjoner
              └── ProsjektBibliotekValg  (prosjektId + sjekklisteMalId)
```

### Prisma-modeller

Legg til i `schema.prisma`. Ikke endre eksisterende modeller.

```prisma
model BibliotekStandard {
  id        String              @id @default(cuid())
  kode      String              @unique  // "NS3420-K"
  navn      String              // "NS 3420-K:2024 Anleggsgartnerarbeider"
  aktiv     Boolean             @default(true)
  sortering Int                 @default(0)
  opprettet DateTime            @default(now())
  kapitler  BibliotekKapittel[]
}

model BibliotekKapittel {
  id         String            @id @default(cuid())
  kode       String            // "KB"
  navn       String            // "Jord og vegetasjon"
  sortering  Int
  standardId String
  standard   BibliotekStandard @relation(fields: [standardId], references: [id])
  maler      BibliotekMal[]
}

model BibliotekMal {
  id           String            @id @default(cuid())
  kapittelId   String
  kapittel     BibliotekKapittel @relation(fields: [kapittelId], references: [id])
  navn         String            // "KB2.2 – Jordarbeider"
  referanse    String            // "KB2.2 / KB2.5"
  beskrivelse  String?
  versjon      String            @default("1.0")
  aktiv        Boolean           @default(true)
  opprettet    DateTime          @default(now())
  malInnhold   Json              // Feltdefinisjoner som konverteres til ReportObjects ved import
  prosjektValg ProsjektBibliotekValg[]
}

model ProsjektBibliotekValg {
  id              String       @id @default(cuid())
  prosjektId      String
  bibliotekMalId  String
  bibliotekMal    BibliotekMal @relation(fields: [bibliotekMalId], references: [id])
  sjekklisteMalId String?      // ID til ReportTemplate opprettet etter import
  aktivertAv      String       // userId
  aktivertDato    DateTime     @default(now())

  @@unique([prosjektId, bibliotekMalId])
}
```

## Felttype-regler (KRITISK)

### Kun eksisterende ReportObject-typer

**Alle felt i bibliotek-maler MÅ bruke eksisterende ReportObject-typer.** Ingen egne felttyper. Ved import konverteres `malInnhold` direkte til ReportObjects — det som ikke er en gyldig type vises som "Ukjent felttype".

Gyldige typer for bibliotek-maler:

| Type | Bruk |
|------|------|
| `traffic_light` | Grønn/gul/rød (har vedlegg innebygd — ALDRI lag separate vedlegg-felt) |
| `list_single` | Nedtrekksmeny med forhåndsdefinerte valg |
| `decimal` | Desimaltall med enhet, min, maks, toleranse |
| `heading` | Seksjonstittel (brukes for FØR/UNDER/ETTER-overskrifter) |
| `text_field` | Fritekst |

**IKKE bruk:** `info_text` (vises som "Ukjent felttype"), `attachments` (redundant — trafikklys har vedlegg), `list_multi`, `integer`.

### Hjelpetekst i config.helpText

NS 3420-referanser legges inn som `helpText` i feltets config — **ALDRI som separate felt**:
- Referer til spesifikk paragraf/tabell (f.eks. "Tabell K4", "KB2.2 c1")
- Oppgi konkrete krav og toleranser (f.eks. "maks ±30 mm", "minimum 2 %")
- Kort og presis — én til to setninger

### Smarte nedtrekksmenyer

Bruk `list_single` med informative valg i stedet for trafikklys der det finnes flere spesifikke utfall:
- Inkluder kravet i teksten (f.eks. "Grasplen (15 cm vekstjord)")
- Dekk alle relevante scenarier inkludert avvik
- Reduser antall separate felt (ett valg i stedet for flere trafikklys)

### Fase-gruppering

Felt grupperes under FØR/UNDER/ETTER-overskrifter. Importfunksjonen oppretter automatisk `heading`-felt for hver fase:
- `"FØR"` — kontroll før utførelse
- `"UNDER"` — kontroll under utførelse
- `"ETTER"` — kontroll etter utførelse

### Kompakte maler

Maks ~10 felt per mal. Foretrekk én nedtrekk med 4 valg fremfor 4 separate trafikklys-felt. Informasjon inn i hjelpetekst, ikke i egne felt.

## malInnhold JSON-struktur

Flat array med feltdefinisjoner som konverteres til ReportObjects ved import:

```json
[
  {
    "label": "Underlagskontroll",
    "type": "list_single",
    "zone": "datafelter",
    "fase": "FØR",
    "sortOrder": 1,
    "config": {
      "options": ["Godkjent", "Godkjent med merknad", "Ikke godkjent"],
      "helpText": "KB2 c2: Hardpakket undergrunnsjord skal løses."
    }
  },
  {
    "label": "Lagtykkelse vekstjord",
    "type": "decimal",
    "zone": "datafelter",
    "fase": "UNDER",
    "sortOrder": 2,
    "config": {
      "enhet": "cm",
      "min": 20,
      "helpText": "Krav per prosjekt – Tabell K4 NS 3420-K"
    }
  },
  {
    "label": "Planhet – avvik fra planlagt nivå",
    "type": "traffic_light",
    "zone": "datafelter",
    "fase": "ETTER",
    "sortOrder": 3,
    "config": {
      "helpText": "Mål med 3 m rettholt, toleranse ±30 mm · ref KB2.5"
    }
  }
]
```

## Felttype-mapping fra NS 3420-K til ReportObject-typer

| NS 3420-K konsept | ReportObject-type | Merknad |
|---|---|---|
| Bekreftelsespunkt (ja/nei) | `traffic_light` | Har innebygd vedlegg-støtte |
| Bekreftelse med foto | `traffic_light` | Vedlegg innebygd — IKKE separat vedlegg-felt |
| Målverdi med toleranse | `decimal` | Med enhet, min, maks i config |
| Fase-overskrift (FØR/UNDER/ETTER) | `heading` | Opprettes automatisk ved import |
| Valg mellom flere utfall | `list_single` | Informative valgtekster |
| Fritekstkommentar | `text_field` | Brukes sparsomt |

## NS 3420 — seed-data

### NS 3420-K:2024 – Anleggsgartnerarbeider (4 kapitler, 6 maler)

| Kapittel | Mal | Felt | Nøkkelkrav |
|----------|-----|------|------------|
| KA | KA7 – Gjenbruk | 4 | Sortering, dokumentasjon, rengjøring |
| KB | KB2 – Jordarbeider | 9 | Tabell K4 lagtykkelser, steinstørrelse, komprimering |
| KB | KB4 – Grasdekke | 7 | Markdekningsgrad ≥95 %, fall ≥2 % |
| KB | KB6 – Planting | 8 | NS 4400, rothalsen over jord (KB6.1 c1) |
| KC | KC3.1 – Oppstøtting | 4 | Støttetype, bindmateriale, 1-sesong kontroll |
| KD | KD1 – Utendørsbelegg | 7 | Tabell K11 fall, Tabell K12 planhet ±3 mm |

### Detaljerte sjekklister per mal

#### KB2.2 – Jordarbeider, utlegging av eksterne masser (ref: KB2.2 / KB2.5)

**FØR:**
- Underlag kontrollert og godkjent `[traffic_light]` — Fri for is, snø, organisk materiale og stående vann
- Leveringsdokument kontrollert `[traffic_light]` — Vareseddel stemmer med spesifisert jordtype

**UNDER:**
- Lagtykkelse vekstjord `[decimal, enhet: cm, min: 20]` — Krav per prosjekt – Tabell K4 NS 3420-K
- Ingen komprimering av vekstjord `[traffic_light]` — Ikke kjøre med tunge maskiner på utlagt jordlag

**ETTER:**
- Planhet – avvik fra planlagt nivå `[decimal, enhet: mm, toleranse: ±30]` — Mål med 3 m rettholt · ref KB2.5
- Fritt for stein >30 mm og fremmedlegemer `[traffic_light]` — Visuell kontroll over hele arealet
- Ugrasbekjempelse utført `[traffic_light]` — KB2.4 – kjemisk eller mekanisk metode

#### KB4 – Grasdekke, etablering og kontroll (ref: KB4)

**FØR:**
- Frøblanding/rullegress dokumentert `[traffic_light]` — Emballasje merket – opphav og art kontrollerbart (KB4 b1)
- Jordlag løsgjort og finplanert `[traffic_light]` — KB2.5 – ingen store klumper, stein < 30 mm
- Fall/helning kontrollert `[decimal, enhet: %, min: 2.0]` — Avrenning sikret – min. 2 % mot sluk/kant

**UNDER:**
- God kontakt frø/plen mot jord `[traffic_light]` — Rullegress i forband, tett sammensatt (KB4 c2)
- Vannet etter legging/såing `[traffic_light]` — Rotbløyte / jevn fuktighet sikret

**ETTER:**
- Markdekningsgrad `[decimal, enhet: %, min: 95]` — KB4 c4 – ingen åpne flekker > 1,0 dm²
- Klippet jevnlig frem til overtakelse `[traffic_light]` — KB4 c3 – homogen og i god vekst

#### KB6 – Planting, trær busker og stauder (ref: KB6 / NS 4400)

**FØR:**
- Planter i henhold til NS 4400 `[traffic_light]` — Art, sort, størrelse og leveringsform som spesifisert
- Planter saftspente og fuktige ved ankomst `[traffic_light]` — KB6 c1 – barrotsplanter i hvile (KB6 c2)
- Plantehull riktig dimensjon `[traffic_light]` — Min. 2× rotklumpdiameter · dybde = rotklumphøyde

**UNDER:**
- Rothalsen over jordoverflate `[traffic_light]` — KB6.1 c1 – tre plantes med noe overhøyde (KB6.1 c2)
- God kontakt mellom rot og jord `[traffic_light]` — KB6 c3 – uten luftlommer
- Rotbløyte utført etter planting `[traffic_light]` — KB6 c4 – grundig vanning

**ETTER:**
- Plantefelt fritt for ugras `[traffic_light]` — KB6 c5 – ved overtakelse
- Oppbinding og støtte montert `[traffic_light]` — KC3.1 – midlertidig oppstøtting av trær

#### KD1 – Utendørsbelegg, legging og kontroll (ref: KD1 · Tabell K11/K12)

**FØR:**
- Underlag kontrollert og komprimert `[traffic_light]` — Jevnt, stabilt – ingen telehiv-risiko
- Belegningstype som spesifisert `[traffic_light]` — Farge, mønster, kornstruktur – visuell kontroll

**UNDER:**
- Fall gangarealer `[decimal, enhet: %, min: 2.0]` — Tabell K11 – annet belegg, gangarealer
- Fall kjørearealer `[decimal, enhet: %, min: 2.5]` — Tabell K11 – kjørearealer
- Fuger rette linjer/jevne kurver `[traffic_light]` — KD1 c5 – gjennomgående fuger uten hakk

**ETTER:**
- Planhet over 3 m målelengde `[decimal, enhet: mm, toleranse: ±3]` — Tabell K12 – belegningsstein betong/heller gangarealer
- Vertikalt sprang ved fuger `[decimal, enhet: mm, maks: 2]` — Tabell K12 – gangarealer betong/heller
- Steiner rengjort for fugemateriale `[traffic_light]` — KD1 c7 – etter fuging

### NS 3420-F:2024 – Grunnarbeider (4 kapitler, 4 maler)

| Kapittel | Mal | Felt | Nøkkelkrav |
|----------|-----|------|------------|
| FB | FB2 – Graving | 8 | Graveskråning (§21-4), vannhåndtering, kabelpåvisning, profilkontroll |
| FC | FC1 – Sprengning | 7 | Salveplan, rystelsesmåling (NS 8141), profilkontroll, skadekontroll |
| FD | FD2 – Fylling og komprimering | 7 | Lagtykkelse, Proctor-komprimering, planhet ±10–30 mm |
| FE | FE1 – Ledningsgrøfter | 8 | VA-norm, trykkprøve (NS-EN 1610), ledningsfall, varselbånd |

#### FB2 – Graving (ref: FB2)

**FØR:**
- Kabelpåvisning og grunnforhold `[list_single]` — Påvist/merket + grunnforhold vs rapport
- Graveprofil kontrollert `[traffic_light]` — Tegning med dybde, bredde, skråningsvinkel

**UNDER:**
- Graveskråning og sikring `[list_single]` — **Sikkerhetskritisk.** §21-4: >2 m krever avstiving/skråning. Valg per jordart med STOPP-alternativ
- Vannhåndtering i grøft `[list_single]` — **Sikkerhetskritisk.** Vann graver ut skråningsfot. STOPP ved ustabil fot
- Gravebunn `[list_single]` — Kote, jevnhet, overgraving
- Avvik fra prosjektert profil `[decimal, enhet: mm]` — Typisk ±50 mm

**ETTER:**
- Gravebunn godkjent for neste operasjon `[traffic_light]` — Fotodokumentasjon
- Grøft sikret `[traffic_light]` — Sperring, skilting, overvannssikring

#### FC1 – Sprengning (ref: FC1)

**FØR:**
- Salveplan og varsling `[list_single]` — Godkjent av bergsprenger + varsling utført
- Rystelsesmåler plassert `[traffic_light]` — Nærmeste bygning, avstand, grenseverdi

**UNDER:**
- Maks rystelsesnivå `[decimal, enhet: mm/s]` — NS 8141: 20 mm/s bolig, 35 industri, 70 fjell
- Sprengningsresultat `[list_single]` — Profil vs tegning: ren kontur / overberg / underberg

**ETTER:**
- Rensk utført og dokumentert `[traffic_light]` — All løs stein fjernet, fotodokumentert
- Profilkontroll – avvik `[decimal, enhet: mm]` — ±100 mm byggegrop, ±150 mm vegskjæring
- Skader på omgivelser `[list_single]` — Ingen / kosmetisk / konstruktiv (→ stopp)

#### FD2 – Fylling og komprimering (ref: FD2)

**FØR:**
- Massetype `[list_single]` — Sprengstein / grus / knust fjell / lette masser + vareseddel
- Underlag klargjort `[traffic_light]` — Fritt for snø, is, organisk, stående vann

**UNDER:**
- Lagtykkelse `[decimal, enhet: cm]` — Maks: sprengstein 60, grus 30, lette masser 50 cm
- Komprimering `[list_single]` — Iht. instruks / krever flere overfarter / ikke kontrollert
- Komprimeringsgrad `[decimal, enhet: %]` — ≥95 % bærelag, ≥97 % forsterkningslag

**ETTER:**
- Planhet – avvik `[decimal, enhet: mm]` — ±30 fylling, ±20 planum, ±10 bærelag
- Overflate og drenering `[list_single]` — Fall mot sluk, ingen vannlommer

#### FE1 – Ledningsgrøfter (ref: FE1)

**FØR:**
- Eksisterende ledninger påvist `[traffic_light]` — Kabelpåvisning, merking, forsiktig graving <1 m
- Grøfteprofil og fundament `[list_single]` — Dybde og bredde iht. VA-norm

**UNDER:**
- Fundament og sidefylling `[list_single]` — Jevnt fundament, riktig masse (0–8 mm)
- Ledningsfall `[decimal, enhet: ‰]` — Spillvann 10 ‰ (DN≤150), overvann 5 ‰
- Gjenfylling lagvis `[traffic_light]` — Lag à 30 cm, beskyttelsesmasse 15 cm over rør

**ETTER:**
- Tetthetsprøve / trykkprøve `[list_single]` — NS-EN 1610, 1,5× driftstrykk i 30 min
- Innmåling utført `[traffic_light]` — Topp rør, bunn grøft, knekkpunkt (SOSI/GML)
- Varselbånd og merking `[traffic_light]` — 30 cm over ledning: blå=vann, brun=spill, grønn=dren, rød=el

## NS 3420-standarder i databasen (oppslag)

Følgende NS 3420-dokumenter er lastet opp og indeksert i FTD-dokumentdatabasen. Kan brukes som kilde for krav, toleranser og referanser. Søk via `ftdSok.nsStandardSok` eller `ftdSok.sokDokumenter`.

| Fil | Del | Innhold |
|-----|-----|---------|
| ns-3420-1_2024 | Del 1 | Fellesbestemmelser |
| ns-3420-a_2024 | Del A | Rigg, drift og nedrigging |
| ns-3420-cd_2024 | Del CD | Betongarbeider, stål og aluminium |
| ns-3420-d_2024 | Del D | Stålkonstruksjoner |
| ns-3420-f_2024 | Del F | Grunnarbeider, graving, sprengning |
| ns-3420-gu_2024 | Del GU | Murarbeider, puss, flislegging |
| ns-3420-j_2024 | Del J | Tømrerarbeider |
| ns-3420-k_2024 | Del K | Anleggsgartnerarbeider |
| ns-3420-l_2024 | Del L | Malerarbeider, belegg, tapet |
| ns-3420-z_2024 | Del Z | Drift og vedlikehold |

**Bruk ved malutvikling:** Søk etter spesifikke krav (f.eks. "Tabell K4", "toleranse", "planhet") i chunked dokumentdata for å finne presise toleranser og kontrollkrav til hjelpetekstene.

## API-ruter

### tRPC-ruter (bibliotek.ts)

| Rute | Type | Auth | Beskrivelse |
|------|------|------|-------------|
| `hentStandarder` | query | protectedProcedure | Alle standarder med kapitler og maler |
| `hentProsjektValg` | query | verifiserProsjektmedlem | Hvilke maler prosjektet har importert |
| `importerMal` | mutation | verifiserProsjektmedlem | Importer mal → ReportTemplate + ReportObjects |
| `fjernValg` | mutation | verifiserProsjektmedlem | Fjern kobling (sletter ikke selve ReportTemplate) |

### REST-ruter (alternativ)

| Metode | Rute | Beskrivelse |
|--------|------|-------------|
| GET | `/api/bibliotek/standarder` | Alle standarder med kapitler og maler |
| GET | `/api/bibliotek/standarder/[standardId]/kapitler` | Kapitler med maler for én standard |
| POST | `/api/bibliotek/maler/[malId]/importer` | Importer. Body: `{ prosjektId, enterpriseId }` |
| GET | `/api/bibliotek/prosjekt/[prosjektId]/valg` | Prosjektets importerte maler |
| DELETE | `/api/bibliotek/prosjekt/[prosjektId]/valg/[valgId]` | Fjern kobling |

## Import-logikk

`src/lib/bibliotek/importFraBibliotek.ts`:

```typescript
async function importFraBibliotek(
  bibliotekMalId: string,
  prosjektId: string,
  enterpriseId: string,
  aktivertAv: string
): Promise<{ sjekklisteMalId: string }>
```

Steg:
1. Hent `BibliotekMal` med `malInnhold` JSON
2. Sjekk at `ProsjektBibliotekValg` ikke allerede eksisterer
3. Opprett `ReportTemplate` (name, description med NS-referanse, category=sjekkliste, domain=kvalitet)
4. Grupper felt etter fase (FØR/UNDER/ETTER)
5. For hver fase: opprett `heading`-felt + alle felt i fasen som `ReportObjects`
6. Opprett `ProsjektBibliotekValg` med referanse til ny mal
7. Mal er nå redigerbar i malbyggeren — brukeren kan tilpasse fritt

## Filstruktur

```
packages/db/prisma/
├── schema.prisma                    # BibliotekStandard, BibliotekKapittel, BibliotekMal, ProsjektBibliotekValg
├── seed-bibliotek.ts                # NS 3420-K seed-data (kjør: npx tsx prisma/seed-bibliotek.ts)
└── migrations/...

apps/api/src/routes/
└── bibliotek.ts                     # tRPC-ruter

apps/web/src/
├── components/bibliotek/
│   └── BibliotekPanel.tsx           # Slide-over panel for prosjekt-import
└── app/dashbord/oppsett/produksjon/
    ├── kontrollplan/page.tsx        # Kontrollplan-side (to faner)
    └── _components/MalListe.tsx     # "Hent fra bibliotek"-knapp
```

## UI-komponenter

### 1. BibliotekPanel (`src/components/bibliotek/BibliotekPanel.tsx`)

Shadcn `Sheet` (slide-over fra høyre):
- Henter fra `hentStandarder` med `prosjektId`
- Accordion per kapittel (KA, KB, KC, KD)
- Checkbox per mal
- Allerede importerte: grønn CheckCircle, disabled checkbox, "Se mal →"-lenke
- Klikk → `importerMal` → revalidate sjekklistemaler-lista
- Optimistisk UI: checkbox umiddelbart, rollback ved feil
- Viser referanse og beskrivelse under malnavnet

### 2. Knapp på sjekklistemaler-siden

På `src/app/dashbord/oppsett/produksjon/sjekklistemaler/page.tsx`:
- `[📚 Hent fra bibliotek]`-knapp ved siden av `[+ Legg til]`
- Åpner BibliotekPanel
- Importerte maler vises med "NS 3420-K"-badge

### 3. Kontrollplan-siden

`src/app/dashbord/oppsett/produksjon/kontrollplan/page.tsx` — to faner:
- **"Sjekklistebibliotek"** (aktiv): BibliotekPanel-innholdet som fullside
- **"Kontrollplan"** (placeholder): "Kommer snart"

### 4. Admin-side — Bibliotekredigering

`/admin/bibliotek` — kun sitedoc_admin.

#### Layout — to-panel

```
┌─────────────────────────┬──────────────────────────────────┐
│  Trestruktur (venstre)  │  Malredigering (høyre)           │
│                         │                                  │
│  ▸ NS 3420-K            │  KB2 – Jordarbeider              │
│    ▸ KA – Innledende    │  Ref: KB2  Beskrivelse: [___]    │
│    ▾ KB – Jord og veg.  │                                  │
│      • KA7 – Gjenbruk   │  ┌─ FØR ──────────────────────┐ │
│      ● KB2 – Jordarb.   │  │ 1. Formål/planteformål  ▾  │ │
│      • KB4 – Grasdekke  │  │ 2. Underlag             ▾  │ │
│      • KB6 – Planting   │  │ 3. Leveringsdok.        ▾  │ │
│    ▸ KC – Vanning       │  └────────────────────────────┘ │
│    ▸ KD – Belegg        │  ┌─ UNDER ─────────────────────┐ │
│                         │  │ 4. Lagtykkelse vekstjord ▾  │ │
│  [+ Standard]           │  │ 5. Maks steinstørrelse   ▾  │ │
│  [+ Kapittel]           │  │ 6. Jord ikke komprimert  ▾  │ │
│  [+ Mal]                │  └────────────────────────────┘ │
│                         │  ┌─ ETTER ─────────────────────┐ │
│                         │  │ 7. Planhet – avvik        ▾ │ │
│                         │  │ 8. Fall (%)               ▾ │ │
│                         │  │ 9. Overflate jevn         ▾ │ │
│                         │  └────────────────────────────┘ │
│                         │                                  │
│                         │  [+ Legg til felt]    [Lagre]    │
└─────────────────────────┴──────────────────────────────────┘
```

#### Felt-redigering (klikk på felt → ekspander)

Per felt vises:
- **Etikett** — fritekst
- **Type** — dropdown: `traffic_light`, `list_single`, `decimal`, `text_field`
- **Fase** — dropdown: FØR, UNDER, ETTER
- **Hjelpetekst** — NS-referanser, krav, toleranser
- **Config** — avhengig av type:
  - `list_single`: valgalternativer (legg til, fjern, endre rekkefølge)
  - `decimal`: enhet, min, maks, toleranse
  - `traffic_light`: kun hjelpetekst (vedlegg er innebygd)

#### Rekkefølge og fase

Drag-and-drop for sortering innenfor fase. Fasebytte via dropdown — ikke dra mellom faser.

#### Kopieringsmodell

Bibliotek-malen er **kilden**. Endringer i biblioteket påvirker kun **fremtidige importer**. Prosjekter som allerede har importert malen eier sin kopi og endrer den i prosjektets malbygger. Ingen synkronisering tilbake.

Konsekvenser:
- Ingen versjonsnummer nødvendig
- Ingen "oppdater prosjektkopier"-logikk
- Slett = `aktiv: false` (prosjektkopier påvirkes ikke)
- Admin kan fritt eksperimentere uten risiko

#### CRUD-operasjoner

| Objekt | Opprett | Rediger | Slett |
|--------|---------|---------|-------|
| Standard | Ny standard (f.eks. NS 3420-F) | Navn, kode | `aktiv: false` |
| Kapittel | Nytt kapittel i standard | Navn, kode, sortering | Kun hvis ingen maler |
| Mal | Ny mal i kapittel | Felter, navn, ref, beskrivelse | `aktiv: false` |
| Felt | Legg til i mal | Alle felt-egenskaper | Fjern fra malInnhold |

#### API-ruter

| Rute | Type | Auth | Beskrivelse |
|------|------|------|-------------|
| `bibliotek.opprettStandard` | mutation | sitedoc_admin | Ny standard |
| `bibliotek.opprettKapittel` | mutation | sitedoc_admin | Nytt kapittel i standard |
| `bibliotek.opprettMal` | mutation | sitedoc_admin | Ny mal i kapittel |
| `bibliotek.oppdaterMal` | mutation | sitedoc_admin | Endre navn, beskrivelse, felter |
| `bibliotek.deaktiverMal` | mutation | sitedoc_admin | `aktiv: false` |
| `bibliotek.oppdaterFeltrekkefølge` | mutation | sitedoc_admin | Sortering innenfor fase |

## Retningslinjer for effektive maler

### Prinsipp: Færre felt, mer informasjon per felt

En god bibliotek-mal har **6–10 felt**. Hver felt må rettferdiggjøre sin plass. Husk at brukeren fyller ut dette i felt med hansker og regn — hvert ekstra felt koster tid.

### Slå sammen overlappende felt

Hvis to felt spør om ulike sider av **samme kontrollpunkt**, kombiner dem til én `list_single` med informative valg.

**Før (2 felt):**
```
Underlag type        → list_single: [Stedlig jord, Steinfylling]
Underlagskontroll    → list_single: [Godkjent, Med merknad, Ikke godkjent]
```

**Etter (1 felt):**
```
Underlag             → list_single: [
  "Stedlig jord – godkjent og drenert",
  "Stedlig jord – krever løsgjøring/utbedring",
  "Steinfylling/berg – mineraljordlag påført",
  "Steinfylling/berg – krever mineraljordlag"
]
```

### Nedtrekksmenyer fremfor trafikklys

Bruk `list_single` i stedet for `traffic_light` når:
- Det finnes **mer enn to utfall** (ikke bare OK/avvik)
- Valget inneholder **spesifikk informasjon** (materialtype, dimensjon, metode)
- Du ville trengt **flere trafikklys** for å dekke samme kontrollpunkt

Bruk `traffic_light` kun for enkle bekreftelser: "Er X utført?" — ja/nei med vedlegg.

### Hjelpetekst erstatter informasjonsfelt

Aldri lag et eget felt for å forklare kravet. Legg kravet i `helpText` på selve kontrollfeltet:
- Referer til NS-paragraf/tabell (f.eks. "Tabell K4", "KB2.2 c1")
- Oppgi konkrete tall og toleranser
- Én til to setninger — ikke avsnitt

### Inkluder kravet i valgteksten

Når brukeren velger fra en nedtrekksmeny, skal de se kravet direkte — ikke måtte huske det:

**Dårlig:** `"Grasplen"` (brukeren må huske at grasplen krever 15 cm)
**Bra:** `"Grasplen (15 cm vekstjord)"` (kravet er synlig i valget)

**Dårlig:** `"Under 20 mm"` (ukjent hva det gjelder)
**Bra:** `"OK – under 20 mm (gras/blomstereng)"` (kontekst + krav i ett)

### Sjekkliste for nye maler

Før en mal publiseres i biblioteket:

1. **Under 10 felt?** Hvis over — finn felt som kan slås sammen
2. **Overlappende felt?** To felt om samme ting → kombiner til én `list_single`
3. **Trafikklys med bare OK/avvik?** Vurder om `list_single` med spesifikke utfall er bedre
4. **Hjelpetekst på alle felt?** NS-referanse + konkret krav
5. **Krav synlig i valgtekst?** Tall, toleranser, dimensjoner bakt inn
6. **Tre faser?** FØR/UNDER/ETTER — hvert felt i riktig fase

## Eksisterende UI-elementer (observert)

### Malbygger-felttyper tilgjengelig

- **Tekst:** Overskrift, Undertittel, Tekstfelt
- **Valg:** Enkeltvalg, Flervalg, **Trafikklyss** (rød/gul/grønn = OK/Avvik/N/A)
- **Tall:** Heltall, Desimaltall, **Beregning**
- **Dato/Tid:** Dato, Dato og tid
- **Person/Firma:** Person, Flere personer, Firma
- **Filer:** **Vedlegg** (for fotodokumentasjon)
- **Spesialfelt:** BIM-egenskap, Soneegenskap, Romegenskap, Vær, **Signatur**, **Repeater**, Lokasjon, **Posisjon i tegning**
- **Instruksjon/PSI:** Lesetekst, Bilde med tekst, Video, Quiz-spørsmål

### Sjekklistemal-struktur (fra Befaringsrapport-malen)

- `FASTE FELT`: Emne, Bestiller-entreprise, Lokasjon
- `TOPPTEKST`: frittstående felt øverst
- `DATAFELTER`: innholdsfelter, støtter Repeater med nestede felt

## Seed og migrering

```bash
# Migrering
pnpm --filter @sitedoc/db exec prisma migrate dev --name add-sjekklistebibliotek

# Seed NS 3420-K data
npx tsx prisma/seed-bibliotek.ts
```

## Viktige prinsipper

- Ikke endre eksisterende modeller, API-er eller komponenter
- Følg eksisterende auth/session/middleware-mønster
- `malInnhold` er JSON — ikke koblet til ReportTemplate før import
- Import lager alltid en **kopi** — prosjektet eier sin egen mal
- Oppdateringer i biblioteket oppdaterer IKKE automatisk prosjektets mal
- **Kun gyldige ReportObject-typer** i malInnhold (se felttype-regler over)
- `traffic_light` har innebygd vedlegg — aldri lag separate vedlegg-felt

## Kontrollplan — stedsbasert kvalitetskontroll (fase 4)

### Formål

Kobler sjekklister til fysiske steder (BIM-soner, rom, lokasjoner) med tidsfrist og ansvarlig. Gir sporbarhet, varsling og fremdriftstracking.

### Modul-registrering

Kontrollplan er en **modul** i `PROSJEKT_MODULER` — aktiveres/deaktiveres per prosjekt, samme mønster som `hms-avvik`, `godkjenning`, `befaringsrapport`.

```typescript
// packages/shared/src/types/index.ts — PROSJEKT_MODULER
{
  slug: "kontrollplan",
  navn: "Kontrollplan",
  beskrivelse: "Stedsbasert kvalitetskontroll med sjekklister koblet til BIM-soner, rom og lokasjoner",
  kategori: "funksjon",
  ikon: "ClipboardList",
  maler: [], // ingen auto-opprettede maler — bruker eksisterende sjekklister fra biblioteket
}
```

Sidebar viser kontrollplan-lenken kun når modulen er aktivert (`kreverModul: "kontrollplan"`).

### Mappestruktur

```
apps/web/src/app/dashbord/[prosjektId]/kontrollplan/   ← sider (liste, detalj, oppsett)
apps/web/src/components/kontrollplan/                   ← UI-komponenter
apps/api/src/routes/kontrollplan.ts                     ← API-ruter (tRPC)
```

### Database — i `packages/db`

Kontrollplan-tabeller ligger i `packages/db` (IKKE isolert pakke) fordi de trenger FK-relasjoner til:
- `report_templates` — sjekklisten som skal utføres
- `byggeplasser` — lokasjon/sone/rom
- `project_members` — ansvarlig person
- `projects` — prosjektisolering

| Tabell | Beskrivelse |
|--------|-------------|
| `kontrollplan_maler` | Mal: sjekkliste-referanse, sonetype, frekvens, ansvarlig-rolle |
| `kontrollplaner` | Instans per prosjekt — kobler mal til spesifikk sone/rom/lokasjon |
| `kontrollpunkt_utforelser` | Svar per kontrollpunkt: data, foto, signatur, tidsstempel, GPS |

### Kjerneflyt

```
Malbygger (BIM/Sone/Rom-egenskaper) + Tegninger + Soner/Rom
  → Kontrollplan (sjekkliste + sted + tid + ansvarlig + varsling)
  → Utførelse (mobil, foto, signering)
  → Rapport (PDF, status per sone)
```

### Varsling

- Push-varsling til ansvarlig når kontrollpunkt forfaller
- SMS-varsling (valgfritt, konfigurerbart)
- Frist-eskalering til leder ved manglende utførelse

### Avhengighet — BLOKKERT

Kontrollplan kan **ikke ferdigstilles** før malbygger er ferdig:
- Malbyggeren må støtte BIM-egenskap (`bim_property`), soneegenskap (`zone_property`) og romegenskap (`room_property`) felttyper
- Kontrollplan bruker sjekklister fra biblioteket — disse opprettes via malbyggeren
- Rekkefølge: **Malbygger → Kontrollplan**

## Status

- **Kontrollplan-siden:** 404 — ikke bygget ennå (`/oppsett/produksjon/kontrollplaner`)
- **Modul-registrering:** Ikke lagt til i `PROSJEKT_MODULER` ennå
- **Prisma-modeller:** Ikke migrert ennå
- **Seed-data:** Ikke opprettet ennå
- **NS 3420-K maler:** Utkast, trenger forbedring
- **Blokkert av:** Malbygger (MALBYGGER.md)
