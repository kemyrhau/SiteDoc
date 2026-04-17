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
  Kobler sjekkliste → lokasjon (område/rom) → tid → ansvarlig
  Gir sporbarhet, varsling og fremdriftstracking
      ↓ valgfritt steg B

DOKUMENTFLYT
  Kobler sjekkliste til entreprise-flyt med trinn og godkjennere
  Byggherre / Tømrer / Elektro osv.
```

## Arkitektur-oversikt

```
┌──────────────┐   ┌──────────────┐   ┌──────────────────┐
│  Malbygger   │   │  Tegninger   │   │   Område / Rom    │
│  BIM-egenskap│   │  DWG/PDF/IFC │   │  Tegning-markup  │
│  Soneegenskap│   │  per bygge-  │──→│  Etasje → Område │
│  Romegenskap │   │  plass       │   │  Område → Rom    │
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
                          │  kommentar    │   │  område      │
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

### NS 3420-F:2024 – Grunnarbeider (4 kapitler, 6 maler)

| Kapittel | Mal | Felt | Prioritet | Nøkkelkrav |
|----------|-----|------|-----------|------------|
| FB | FB2 – Graving | 8 | ★ Grunnpakke | Graveskråning (§21-4), vannhåndtering, kabelpåvisning, profilkontroll |
| FB | FB4 – Spunting og avstiving | 7 | Utvidet | Spuntprofil, vertikalitet, tetthet, stagkraft, setningskontroll |
| FC | FC1 – Sprengning | 7 | Utvidet | Salveplan, rystelsesmåling (NS 8141), profilkontroll, skadekontroll |
| FD | FD2 – Fylling og komprimering | 7 | ★ Grunnpakke | Lagtykkelse, Proctor-komprimering, planhet ±10–30 mm |
| FD | FD3 – Grunnforsterkning | 7 | Utvidet | KC-peler/jetinjeksjon, bindemiddel, prøvebelastning, setning |
| FE | FE1 – Ledningsgrøfter | 8 | ★ Grunnpakke | VA-norm, trykkprøve (NS-EN 1610), ledningsfall, varselbånd |

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

#### FB4 – Spunting og avstiving (ref: FB4) — utvidet

**FØR:**
- Spunt levert iht. spesifikasjon `[list_single]` — Riktig type+dimensjon / feil dimensjon / feil type (→ stopp)
- Nabokontroll utført `[traffic_light]` — Tilstandsregistrering av bygninger i influensområdet

**UNDER:**
- Vertikalitet – avvik `[decimal, enhet: mm/m]` — Krav ≤1 % av lengde, korrigering vanskelig etter ramming
- Tetthet mellom elementer `[list_single]` — Tett / mindre lekkasje / lekkasje / gjennombrudd (→ STOPP)
- Stagkraft `[decimal, enhet: kN]` — Avvik >10 % → varsle geotekniker

**ETTER:**
- Setningskontroll nabolag `[list_single]` — Innenfor toleranse / overvåkes / tiltak nødvendig
- Spuntvegg stabil `[traffic_light]` — Visuell kontroll deformasjon, lekkasje, erosjon

#### FD3 – Grunnforsterkning (ref: FD3) — utvidet

**FØR:**
- Metode iht. prosjektering `[list_single]` — Iht. spesifikasjon / avvik (→ avklar med geotekniker)
- Grunnundersøkelse verifisert `[traffic_light]` — Geoteknisk rapport dekker aktuelt område

**UNDER:**
- Dybde `[decimal, enhet: m]` — Avvik >0,5 m → varsle geotekniker
- Bindemiddelmengde `[list_single]` — Iht. resept / avvik <10 % / avvik >10 % (→ stopp)

**ETTER:**
- Prøvebelastning `[list_single]` — Bestått / marginal / ikke bestått (→ tiltak)
- Setning `[decimal, enhet: mm]` — Krav <25 mm total, <10 mm differanse
- Bæreevne dokumentert `[traffic_light]` — Geotekniker har signert

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

### Hjelpetekst = NS-kravet til koden

Hjelpeteksten er **ikke en generell forklaring** — den er den konkrete NS-referansen som forteller brukeren hva kravet er. Mønster:

1. **NS-paragraf** — "FB4 c2:", "Tabell K4:", "KB2.2 b3:"
2. **Konkret krav** — tall, toleranser, grenseverdier
3. **Hva brukeren skal gjøre** — målemetode, antall punkter, verktøy

**Eksempel:**
```
Hjelpetekst: "FB4 c1: Mål avvik fra lodd etter hvert element. 
Krav typisk ���1 % av lengde. Korrigering vanskelig etter nedramming."
```

Nedtrekksmenyen gir **resultatet av kontrollen** (godkjent/avvik/stopp). Hjelpeteksten forklarer **kravet som kontrolleres**. Aldri lag et eget felt for å forklare kravet.

### Inkluder kravet i valgteksten

Når brukeren velger fra en nedtrekksmeny, skal de se kravet direkte — ikke måtte huske det:

**Dårlig:** `"Grasplen"` (brukeren må huske at grasplen krever 15 cm)
**Bra:** `"Grasplen (15 cm vekstjord)"` (kravet er synlig i valget)

**Dårlig:** `"Under 20 mm"` (ukjent hva det gjelder)
**Bra:** `"OK – under 20 mm (gras/blomstereng)"` (kontekst + krav i ett)

### Prioritetsnivåer

Maler grupperes i nivåer for å hjelpe brukeren velge riktig omfang:

| Nivå | Visning | Beskrivelse |
|------|---------|-------------|
| 1 – Grunnpakke | ★ markert, øverst | Relevant for nesten alle prosjekter innen standarden |
| 2 – Utvidet | Normal visning | Relevant når prosjektet har spesifikke disipliner |
| 3 – Spesialist | Kollapset | Store/komplekse prosjekter, sjelden brukt |

Lagres som `prioritet: Int @default(1)` på `BibliotekMal`. UI grupperer og sorterer etter prioritet.

### Ansvarsfraskrivelse — AI-genererte maler

Alle maler i sjekklistebiblioteket er **AI-genererte utkast** basert på NS 3420-standarder. De er ment som utgangspunkt — ikke som ferdig kvalitetssikrede kontrollplaner.

**Krav til visning i UI:**
- Ved import fra biblioteket vises en advarsel i bekreftelsesdialogen:
  > *"Malene i biblioteket er generert med AI-assistanse og er ment som utgangspunkt. Hvert firma er ansvarlig for å kontrollere at feltene er dekkende for sitt virke og sine prosjekter. Tilpass malen etter import."*
- Advarselen vises **ved hver enkeltimport**. Ved fellesimport (flere maler samtidig) vises den **én gang** i bekreftelsesdialogen
- Importerte maler er fullt redigerbare — brukeren oppfordres til å tilpasse

**Krav til seed-data:**
- Beskrivelse på hver mal skal inneholde "(AI-utkast)" som suffix
- Hjelpetekster skal referere til faktiske NS-paragrafer der mulig, men er ikke juridisk verifisert

### Sjekkliste for nye maler

Før en mal publiseres i biblioteket:

1. **Under 10 felt?** Hvis over — finn felt som kan slås sammen
2. **Overlappende felt?** To felt om samme ting → kombiner til én `list_single`
3. **Trafikklys med bare OK/avvik?** Vurder om `list_single` med spesifikke utfall er bedre
4. **Hjelpetekst = NS-krav?** Paragrafhenvisning + konkret krav + målemetode
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

## Kontrollplan — stedsbasert kvalitetskontroll

### Lovgrunnlag

Kontrollplanen skal oppfylle kravene i norsk bygningslovgivning:

| Lov/forskrift | Paragraf | Krav | SiteDoc-funksjon |
|---------------|----------|------|------------------|
| PBL Kap. 24 | §24-1, §24-2 | Kvalitetssikring og uavhengig kontroll | Sjekklister med sporbarhet |
| SAK10 | §10-1 | Skriftlige KS-rutiner, sjekklister, avviksbehandling | Sjekklistebibliotek + kontrollplan |
| SAK10 | §14-2 | Obligatorisk uavhengig kontroll: fukt, luft, brann, konstruksjon, geo | Kontrollområde-tagging på maler |
| SAK10 | §14-7 | Sluttrapport + kontrollerklæring: hva er kontrollert, avvik, lukking | PDF-eksport per kontrollområde |
| Byggherreforskriften | §7, §8 | SHA-plan med risikovurdering og avviksrapportering | SHA som kontrollområde |
| TEK17 | Diverse | Tekniske krav (fukt §13-5, energi §14-2, brann kap. 11) | NS/TEK-referanser i hjelpetekst |

### Målgruppe og skalering

Kontrollplanen fungerer på **to skalaer**:

**Stort prosjekt** (industribygg, boligblokker, infrastruktur):
- Tiltaksklasse 2/3 — obligatorisk uavhengig kontroll
- 10–20 faggrupper, 50+ områder markert på tegning
- Matrisevisning (områder × maler) med fargekoder og fremdrift
- Avhengigheter, milepæler, kaskade-fristflytting

**Lite prosjekt** (enebolig, rehabilitering):
- Ingen tegninger, ingen områder
- Flat listevisning med sjekklister + frister + faggrupper
- Like nyttig — bare enklere

UI velger visning automatisk basert på om punkter har områder.

### Kontrollplan per byggeplass

Kontrollplanen opprettes **per byggeplass**, ikke per prosjekt. Byggeplassen er den naturlige enheten:
- Tegninger tilhører en byggeplass
- Områder tilhører en byggeplass
- Ferdigattest utstedes per byggeplass (SAK10 §14-7)
- Hvert bygg har sin egen fremdrift, sine faggrupper, sine frister

Et prosjekt med 3 byggeplasser får 3 separate kontrollplaner.

### Formål

Kobler sjekklister til fysiske områder/rom (valgfritt), med frist, ansvarlig faggruppe og dokumentflyt-godkjenning. Gir sporbarhet, fremdriftstracking og sluttrapport for kommunal kontroll (SAK10 §14-7).

### Prosjektmodul

Kontrollplan er en **prosjektmodul** (`slug: "kontrollplan"`, kategori: `"funksjon"`). Vises kun når modulen er aktivert i Innstillinger > Produksjon > Moduler. Anbefalt oppsett: tegninger → georeferering → områder → kontrollplan.

### Område-opprettelse — primært via tegning

Områder opprettes primært som **polygoner i tegningsviseren** — ikke inline i kontrollplanen. Anbefalt flyt:

```
1. Last opp tegninger for byggeplass
2. Marker områder som polygoner i tegningsviseren
   → Gi navn, type (sone/rom/etasje), farge
   → Området lagres med polygon + tegningsreferanse
3. Åpne kontrollplan for byggeplassen
   → System henter alle områder fra byggeplassens tegninger
   → Foreslår dem automatisk ved opprettelse av punkt
```

Hvis tegninger mangler markerte områder, viser kontrollplanen en anbefaling:
> "Denne byggeplassen har 3 tegninger uten markerte områder. Marker områder i tegningsviseren for bedre kontrollplan."

For lite prosjekt uten tegninger: områder er valgfrie — kontrollplanen fungerer som flat liste.

### Kjerneflyt

```
Planlegging (prosjektleder, kontrollplan-siden):
  1. Velg sjekklistemal (fra bibliotek eller prosjektets maler)
  2. Velg område(r) fra byggeplassens tegninger (valgfritt)
     → Flervalg for bulk: "Alle bad i 3. etg"
     → Uten områder: punkt opprettes uten stedskobling
  3. Sett frist (uke) og ansvarlig faggruppe
  4. Kontrollplanpunkt(er) opprettet — vises i matrise/liste

Utførelse (feltarbeider):
  5. Åpne sjekklister → filtrert på min faggruppe + område
  6. Start sjekkliste → KontrollplanPunkt.status = pågår
  7. Fyll ut → send via dokumentflyt

Godkjenning (dokumentflyt):
  8. Godkjenner mottar via eksisterende dokumentflyt
  9. Godkjent → KontrollplanPunkt.status = godkjent

Sluttrapport (SAK10 §14-7):
  10. Eksporter per kontrollområde: kontrollert, avvik, lukking, signatur
```

### Datamodell

```
Kontrollplan (ny — overordnet enhet)
  ├── id, projectId, navn, status (utkast | aktiv | godkjent | arkivert)
  ├── godkjentDato, godkjentAvId
  └── punkter[]

Område (ny — polygon på tegning)
  ├── id, navn, type (sone | rom | etasje)
  ├── byggeplassId       → tilhører en byggeplass
  ├── tegningId          → tegningen den er markert på
  ├── polygon            → Json [{x, y}, ...] i prosent av tegning
  └── farge              → hex-farge for visning

KontrollplanPunkt (ny — kobling mal × område)
  ├── id, kontrollplanId → tilhører en kontrollplan
  ├── omradeId           → hvilket område
  ├── sjekklisteMalId    → hvilken mal (ReportTemplate)
  ├── faggruppeId        → ansvarlig faggruppe
  ├── frist, varselDagerFør
  ├── status             → planlagt | pågår | utført | godkjent
  ├── avhengerAvId?      → punkt som må fullføres først
  ├── sjekklisteId?      → null → fylles når sjekkliste opprettes
  └── historikk[]        → sporbarhet (SAK10)

KontrollplanHistorikk (ny — audit trail)
  ├── punktId, brukerId, handling, kommentar, tidspunkt

Kontrollområde på mal:
  ReportTemplate.kontrollomrade → fukt | brann | konstruksjon | geo | grunnarbeid | sha | null
```

#### Prisma-skjema

```prisma
model Kontrollplan {
  id            String    @id @default(cuid())
  projectId     String    @map("project_id")
  byggeplassId  String    @map("byggeplass_id")  // Kontrollplan per byggeplass
  navn          String                          // "Kontrollplan - Blokk A"
  status        String    @default("utkast")    // utkast | aktiv | godkjent | arkivert
  godkjentDato  DateTime? @map("godkjent_dato")
  godkjentAvId  String?   @map("godkjent_av_id")
  opprettet     DateTime  @default(now())
  oppdatert     DateTime  @updatedAt

  project       Project    @relation(fields: [projectId], references: [id])
  byggeplass    Byggeplass @relation(fields: [byggeplassId], references: [id])
  godkjentAv    User?      @relation(fields: [godkjentAvId], references: [id])
  milepeler     Milepel[]
  punkter       KontrollplanPunkt[]

  @@unique([byggeplassId])  // Én kontrollplan per byggeplass
  @@index([projectId])
  @@map("kontrollplaner")
}

model Område {
  id            String   @id @default(cuid())
  projectId     String   @map("project_id")
  byggeplassId  String   @map("byggeplass_id")
  tegningId     String?  @map("tegning_id")
  navn          String
  type          String   @default("sone")     // sone | rom | etasje (type-verdier forblir uendret)
  polygon       Json                           // [{x: number, y: number}, ...]
  farge         String   @default("#3b82f6")
  sortering     Int      @default(0)
  opprettet     DateTime @default(now())

  project       Project    @relation(fields: [projectId], references: [id])
  byggeplass    Byggeplass @relation(fields: [byggeplassId], references: [id])
  tegning       Drawing?   @relation(fields: [tegningId], references: [id])
  kontrollpunkter KontrollplanPunkt[]

  @@index([projectId])
  @@index([byggeplassId])
  @@index([tegningId])
  @@map("omrader")
}

model Milepel {
  id              String   @id @default(cuid())
  kontrollplanId  String   @map("kontrollplan_id")
  navn            String                          // "2. etasje bad ferdig"
  maalUke         Int      @map("maal_uke")       // Ukenummer (1-52)
  maalAar         Int      @map("maal_aar")       // År (2026)
  sortering       Int      @default(0)

  kontrollplan    Kontrollplan @relation(...)
  punkter         KontrollplanPunkt[]

  @@index([kontrollplanId])
  @@map("milepeler")
}

model KontrollplanPunkt {
  id              String    @id @default(cuid())
  kontrollplanId  String    @map("kontrollplan_id")
  milepelId       String?   @map("milepel_id")
  omradeId        String?   @map("omrade_id")     // Nullable — lite prosjekt trenger ikke områder
  sjekklisteMalId String    @map("sjekkliste_mal_id")
  faggruppeId     String    @map("faggruppe_id")
  fristUke        Int?      @map("frist_uke")       // Ukenummer (1-52)
  fristAar        Int?      @map("frist_aar")       // År (2026)
  varselUkerFør   Int       @default(1) @map("varsel_uker_for")
  status          String    @default("planlagt")    // planlagt | pågår | utført | godkjent
  sjekklisteId    String?   @map("sjekkliste_id")
  avhengerAvId    String?   @map("avhenger_av_id")
  opprettet       DateTime  @default(now())

  kontrollplan   Kontrollplan     @relation(fields: [kontrollplanId], references: [id])
  milepel        Milepel?         @relation(fields: [milepelId], references: [id])
  område         Område?          @relation(fields: [omradeId], references: [id])
  sjekklisteMal  ReportTemplate   @relation(fields: [sjekklisteMalId], references: [id])
  faggruppe      Faggruppe        @relation(fields: [faggruppeId], references: [id])
  sjekkliste     Checklist?       @relation(fields: [sjekklisteId], references: [id])
  avhengerAv     KontrollplanPunkt? @relation("PunktAvhengighet", fields: [avhengerAvId], references: [id])
  blokkerer      KontrollplanPunkt[] @relation("PunktAvhengighet")
  historikk      KontrollplanHistorikk[]

  @@unique([kontrollplanId, omradeId, sjekklisteMalId])  // én mal per område per kontrollplan
  @@index([kontrollplanId])
  @@index([milepelId])
  @@index([omradeId])
  @@index([faggruppeId])
  @@index([status])
  @@map("kontrollplan_punkter")
}

model KontrollplanHistorikk {
  id          String   @id @default(cuid())
  punktId     String   @map("punkt_id")
  brukerId    String   @map("bruker_id")
  handling    String                         // opprettet | startet | utført | godkjent | avvist | endret
  kommentar   String?
  tidspunkt   DateTime @default(now())

  punkt       KontrollplanPunkt @relation(fields: [punktId], references: [id], onDelete: Cascade)

  @@index([punktId])
  @@map("kontrollplan_historikk")
}
```

#### Frister på ukenivå

Byggeprosjekter planlegges i uker, ikke dager. Frist er `fristUke` (1–52) + `fristAar`.

```prisma
// På KontrollplanPunkt:
  fristUke      Int?      @map("frist_uke")    // 1-52
  fristAar      Int?      @map("frist_aar")    // 2026

// På Milepel:
  maalUke       Int       @map("maal_uke")
  maalAar       Int       @map("maal_aar")
```

Varsling trigges ved starten av fristuken (mandag).

#### Stadier — dokumentasjonsprogresjon

Noen sjekklister krever dokumentasjon i **flere faser** av samme arbeid. Stadiene er ikke planleggingsenheter — de er en progressindikator for "har du dokumentert alle fasene?"

```prisma
model SjekklisteMalStadium {
  id          String   @id @default(cuid())
  templateId  String   @map("template_id")
  navn        String                         // "Fundament", "Bunnseksjon"
  sortering   Int

  template    ReportTemplate @relation(...)

  @@unique([templateId, sortering])
  @@map("sjekkliste_mal_stadier")
}
```

Maler uten stadier har én befaring og én godkjenning. Maler med stadier viser progresjon (3/6) i matrisen.

#### Avhengigheter mellom punkter

`avhengerAvId` blokkerer oppstart inntil forrige punkt er godkjent. Typisk rekkefølge:

```
FB2 Graving → FD2 Fylling → betongfundament → armering → støp
```

UI viser blokkerte punkter som låste (🔒, ikke klikkbare). Når forrige punkt godkjennes → neste punkt blir klart → varsling sendes til ansvarlig faggruppe.

#### Hjelpetekster i kontrollplanbyggeren

Hjelpeteksten i UI forklarer brukeren hvordan de skal planlegge. Eksempler:

**Ved fristsetting:**
> *Planlegg i uker. En VA-kum etableres på én dag — sett frist til uken arbeidet skal utføres. Et bad tar 2 måneder med ulike fag — sett separate frister per sjekkliste (membran uke 18, flis uke 22, sluttkontroll uke 24).*

**Ved stadier:**
> *Stadier brukes når samme arbeid må dokumenteres i flere faser. Eksempel: VA-kum har 6 stadier (fundament → bunnseksjon → ferdig bygget → omfylling → ferdig omfylt → asfaltert) — hvert lag dekkes til og kan aldri ses igjen. Feltarbeideren dokumenterer fortløpende.*

**Ved avhengigheter:**
> *Sett avhengighet når neste steg ikke kan starte før forrige er godkjent. Eksempel: Flislegging kan ikke starte før membran er godkjent. Armering kan ikke støpes før den er kontrollert.*

**Ved milepæler:**
> *Milepæler grupperer kontrollpunkter med en felles målsetning. Eksempel: «2. etasje bad ferdig — uke 24» samler alle bad-sjekklister for 2. etasje. Fremdrift vises som prosent av godkjente punkter.*

**Ved bulk-operasjoner:**
> *For like områder (f.eks. 12 identiske bad i en blokk): legg til sjekkliste på alle områder samtidig. For like etasjer: kopier kontrollplan fra én etasje til neste og juster ukenummer.*

### Tegningsvisning — to lag

**Lag 1: Områder (polygoner)**
Fargekode etter aggregert status for alle kontrollplanpunkter i området:

| Farge | Betydning |
|-------|-----------|
| Grå | Ingen sjekklister planlagt |
| Blå | Planlagt — ikke startet |
| Gul | Pågår — minst én sjekkliste under arbeid |
| Grønn | Alle godkjent |
| Rød | Avvik eller frist overskredet |

Klikk på område → vis kontrollplanpunkter for området (liste med maler, status, frist).

**Lag 2: Sjekkliste-markører (punkter)**
Eksisterende markør-system utvides fra kun oppgaver til også sjekklister. Vises innenfor områdene. Klikk → åpne sjekkliste.

### Matrisevisning (kontrollplan-siden)

```
═══ Milepæl: Grunnarbeid ferdig (mål: uke 22) ═════════════════

                    FB2 Graving   FD2 Fylling   FE1 Grøft
Område A (kjeller)  ✅ uke 16      🟡 uke 18      ⬜ uke 20
Område B (1. etg)   🟡 uke 18      ⬜ uke 20      🔒 uke 22
Område C (2. etg)   ⬜ uke 20      🔒 uke 22      🔒 uke 24 ⚠️
─────────────────────────────────────────────────────────────
Fremdrift:          1/3 (33%)     0/3 (0%)      0/3 (0%)
⚠️ = frist etter milepælens mål

═══ Milepæl: 2. etg bad ferdig (mål: uke 30) ══════════════════

                    Membran       Flis          Sluttkontroll
Bad 301             ⬜ uke 24      🔒 uke 27      🔒 uke 30
Bad 302             ⬜ uke 24      🔒 uke 27      🔒 uke 30
Bad 303             ⬜ uke 25      🔒 uke 28      🔒 uke 30

═══ VA-kummer (mål: uke 26) ════════════════════════════════════

                    VA-kum
Kum K12             🟡 3/6 (uke 20)     ← stadier som progresjon
Kum K13             ✅ 6/6
Kum K14             ⬜ 0/6 (uke 21)
```

Filtrering:
- Per kontrollområde (fukt, brann, konstruksjon, geo)
- Per faggruppe — betongentreprenøren ser kun sine 30 punkter, ikke alle 200
- Per byggeplass / etasje / fløy
- Per status (planlagt, pågår, godkjent, avvik)
- Per avhengighet (vis kun klare punkter)

### Bulk-operasjoner (viktig for store prosjekter)

Et industribygg med 50 områder og 10 maler = 500 kontrollplanpunkter. Disse kan ikke opprettes én og én.

**Legg til mal på flere områder:**
Velg mal (f.eks. "Membran våtrom") → velg områder (alle bad i 3. etg) → sett frist + faggruppe → opprett 12 punkter i ett klikk.

**Kopier kontrollplan mellom etasjer:**
"3. etasje" har 8 områder med 6 maler hver = 48 punkter. "4. etasje" er identisk planløsning. Kopier → juster frister → ferdig.

**Bulk fristendring:**
Forsinkelse i grunnarbeid → velg alle berørte punkter → flytt frist +2 uker.

### Fristflytting — tre nivåer

Forsinkelser er hverdagen i byggeprosjekter. Fristflytting må være raskere enn å ringe prosjektleder.

#### Nivå 1: Enkelt punkt (klikk i matrise)
Klikk på cellen → endre uke direkte. Logges i historikk med gammel/ny verdi.

#### Nivå 2: Skyv et område (hele raden i matrisen)
Forsinkelser rammer typisk et sted — "Kjeller A er forsinket 2 uker". Velg område → "+N uker" → alle punkter for det området forskyves.

```
Skyv: Kjeller A  +2 uker

Berørte punkter:
  • FB2 Graving  (uke 16 → uke 18)
  • FD2 Fylling  (uke 18 → uke 20)
  • FE1 Grøft   (uke 20 → uke 22)

  [Skyv 3 punkter]  [Avbryt]
```

Kan også skyve per milepæl, per faggruppe, eller manuelt merke flere punkter.

#### Nivå 3: Kaskade-flytt (viktigst)
Flytt ett punkt → systemet identifiserer alle nedstrøms avhengigheter (også i andre områder) → tilbyr å skyve dem med.

```
Kjeller A × FB2 Graving: uke 16 → uke 18 (+2 uker)

⚠ 4 punkter avhenger av dette (direkte og indirekte):
  Kjeller A:
  • FD2 Fylling (uke 18 → uke 20)  — direkte avhengighet
  • FE1 Grøft  (uke 20 → uke 22)  — indirekte (via FD2)
  Kjeller B:
  • FD2 Fylling (uke 20 → uke 22)  — delt avhengighet
  • FE1 Grøft  (uke 22 → uke 24)  — indirekte

  [Skyv alle nedstrøms +2 uker]  [Kun dette punktet]
```

Kaskade-flytten traverserer hele avhengighetsgrafen rekursivt — også på tvers av områder. Alle berørte punkter vises i forhåndsvisningen. Historikk logges for hvert punkt som flyttes, med årsak: "Kaskade fra [punkt]".

#### Kombinasjon: Område + kaskade
Skyv et helt område → systemet sjekker om punkter i *andre* områder avhenger av punkter i dette området → tilbyr kaskade-flytt. Vanlig scenario: grunnarbeid i kjeller forsinkes → alt som bygger på kjelleren i øvrige etasjer må også skyves.

**Milepæl-varsling:** Hvis en fristflytting gjør at punkter havner etter milepælens mål-uke, vises advarsel: "⚠ 3 punkter vil ha frist etter milepælen «Grunnarbeid ferdig» (uke 22)".

### MS Project som datakilde (fremtidig)

MS Project (.mpp/.xml) inneholder WBS, Gantt-frister, ressurser og avhengigheter — nøyaktig det kontrollplanen trenger.

**Via AI-integrasjon (MCP/Copilot/innebygd assistent):**
```
Bruker: "Importer fremdriftsplan" → laster opp .mpp/.xml
Agent:  Parser WBS-struktur → foreslår kontrollplanpunkter:
        - Aktivitet "Membran 3. etg" → mal: Membran, område: Bad 301-312
        - Gantt-frist → uke 18/2026
        - Ressurs "VVS-Rør AS" → faggruppe
        - FS-avhengighet → avhengerAv
Bruker: [Godkjenn] / [Juster] / [Avbryt]
```

**Via manuell import (enklere):**
- Last opp MS Project XML → parser → foreslå punkter med forhåndsvisning
- Bruker mapper kolonner: aktivitet → mal, ressurs → faggruppe
- Importerer frister og avhengigheter automatisk

Implementeres når AI-integrasjonen (REST API-lag) er på plass — samme endepunkter brukes.

### Kontrollområde

Kontrollområde er en egenskap på **sjekklistemalen** (ReportTemplate), ikke på kontrollplanpunktet. Én mal har alltid samme kontrollområde.

| Kontrollområde | SAK10-referanse | Typiske maler |
|----------------|-----------------|---------------|
| `fukt` | §14-2: Fuktsikring | Våtrom, dampsperre, membran |
| `brann` | §14-2: Brannsikkerhet | Brannceller, rømningsveier, sprinkler |
| `konstruksjon` | §14-2: Konstruksjonssikkerhet | Betong, stål, treverk, bæring |
| `geo` | §14-2: Geoteknikk | Graving, peling, fylling |
| `grunnarbeid` | NS 3420-F | FB2, FD2, FE1, FC1, FB4, FD3 |
| `sha` | Byggherreforskriften | Vernerunder, risikovurdering |
| `null` | Ingen spesifikk | Generelle sjekklister |

### Kontrollplan-godkjenning

Kontrollplanen har sin egen livssyklus uavhengig av enkeltpunktene:

| Status | Betydning | Handling |
|--------|-----------|----------|
| `utkast` | Under planlegging — områder og punkter legges til | Prosjektleder redigerer fritt |
| `aktiv` | Godkjent for bruk — feltarbeid kan starte | Nye punkter kan legges til, eksisterende kan ikke slettes |
| `godkjent` | Alle punkter godkjent, sluttrapport generert | Låst — kun arkivering mulig |
| `arkivert` | Ferdig — tilgjengelig som historikk | Skrivebeskyttet |

### Historikk og sporbarhet (SAK10 §10-1)

Alle endringer på kontrollplanpunkter logges i `KontrollplanHistorikk`:

```
KP-042: Membran bad 3B
  2026-03-15 09:12  Ola Hansen     opprettet    Planlagt frist: 2026-05-01
  2026-04-28 14:30  Trude Berg     startet      Faggruppe: VVS-Rør AS
  2026-04-29 08:15  Trude Berg     utført       Sjekkliste utfylt, sendt til godkjenning
  2026-04-29 10:45  Per Nilsen     avvist       Kommentar: Mangler foto av hjørnedetalj
  2026-04-30 07:00  Trude Berg     utført       Re-kontrollert med foto
  2026-04-30 11:20  Per Nilsen     godkjent
```

Historikken er grunnlaget for sluttrapporten og kan etterspørres ved kommunalt tilsyn.

### Sluttrapport (SAK10 §14-7)

PDF-eksport per kontrollområde. Knyttes til `Kontrollplan`-entiteten.

```
SLUTTRAPPORT — Kontrollområde: Fuktsikring
Kontrollplan: Bjørvika Blokk A  |  Dato: 2026-06-15

1. Oppsummering
   Kontrollert: 48 sjekklister i 12 områder
   Godkjent: 48  |  Avvik totalt: 5  |  Avvik lukket: 5  |  Åpne: 0

2. Kontrollerte områder
   ┌──────────────────┬──────────────┬──────────┬──────────┬──────────────┐
   │ Område           │ Sjekkliste   │ Status   │ Dato     │ Faggruppe    │
   ├──────────────────┼──────────────┼──────────┼──────────┼──────────────┤
   │ Bad 201          │ Membran      │ Godkjent │ 12. jun  │ VVS-Rør AS   │
   │ Bad 202          │ Membran      │ Godkjent │ 12. jun  │ VVS-Rør AS   │
   │ Bad 301          │ Membran      │ Godkjent │ 15. jun  │ VVS-Rør AS   │
   │ ... (48 rader)   │              │          │          │              │
   └──────────────────┴──────────────┴──────────┴──────────┴──────────────┘

3. Avvik og lukking
   A-001: Membran utilstrekkelig overlapp (Bad 301) — Lukket 16. jun
   A-002: Manglende foto av hjørnedetalj (Bad 302) — Lukket 17. jun
   ... (5 avvik, alle lukket)

4. Historikk-sammendrag
   Gjennomsnittlig behandlingstid: 2,3 dager per punkt
   Avvist og re-kontrollert: 5 av 48 (10,4 %)

5. Kontrollerklæring
   Kontrollområde fuktsikring er gjennomført iht. SAK10 §14-7.
   Alle avvik er dokumentert og lukket.

   Ansvarlig kontrollerende: ________________  Dato: ________
   Prosjektleder:           ________________  Dato: ________
```

### Gjenbruk av eksisterende systemer

| Behov | Eksisterende løsning |
|-------|---------------------|
| Godkjenning | Dokumentflyt (bestiller → utfører → godkjenner) |
| Ansvarlig | Faggrupper (DokumentflytPart) |
| Maler | Sjekklistemaler + sjekklistebibliotek |
| Tegningsvisning | Tegningsviewer med zoom/pan/markører |
| Punkt-markører | Eksisterende positionX/Y på Checklist/Task |
| Filtrering | Sjekklisteliste med dynamiske filtre |
| Kontrollområde | Nytt felt på ReportTemplate |

Nye komponenter:
- Kontrollplan-siden med byggeplass-velger og auto-deteksjon av visningstype
- Matrisevisning (med områder) / listevisning (uten) — auto-switch
- Fristflytting: enkelt punkt, skyv område, kaskade (3 nivåer)
- Polygon-tegneverktøy for områder på tegning
- Bulk-operasjoner (flervalg av områder, kopier mellom etasjer)
- Avhengighetsvisning (blokkerte punkter, kaskade-forhåndsvisning)
- Historikk-logg per punkt (SAK10 sporbarhet)
- Sluttrapport PDF-eksport per kontrollområde
- MS Project-import (fremtidig, via AI-integrasjon)

### Modul-registrering

```typescript
// packages/shared/src/types/index.ts — PROSJEKT_MODULER
{
  slug: "kontrollplan",
  navn: "Kontrollplan",
  beskrivelse: "Stedsbasert kvalitetskontroll med sjekklister koblet til områder på tegning",
  kategori: "funksjon",
  ikon: "ClipboardList",
  maler: [],
}
```

### Mappestruktur

```
apps/web/src/app/dashbord/[prosjektId]/kontrollplan/   ← matrise, område-oversikt
apps/web/src/components/kontrollplan/                   ← matrisevisning, område-editor
apps/web/src/components/tegning/OmradeOverlay.tsx         ← polygon-rendering på tegning
apps/web/src/components/tegning/OmradeTegneverktoy.tsx    ← polygon-oppretting
apps/api/src/routes/kontrollplan.ts                     ← KontrollplanPunkt CRUD
apps/api/src/routes/omrade.ts                             ← Område CRUD + polygon
```

### Database — i `packages/db`

Kontrollplan-tabeller ligger i `packages/db` (IKKE isolert pakke) fordi de trenger FK-relasjoner til `report_templates`, `byggeplasser`, `dokumentflyt_parts` og `projects`.

### Implementeringsrekkefølge

1. ✅ **Område-modell + API** — DB (`omrader`-tabell), tRPC CRUD, Prisma-relasjonene
2. ✅ **Område-velger og rom-velger** — zone_property og room_property oppgradert fra fritekst til nedtrekksmenyer (web + mobil)
3. **DB-tabeller + modul-registrering** — Kontrollplan, KontrollplanPunkt, Milepel, KontrollplanHistorikk + `slug: "kontrollplan"` i PROSJEKT_MODULER
4. **Kontrollplan-side med listevisning** — `/dashbord/[prosjektId]/kontrollplan/`, byggeplass-velger, opprett punkt (mal + faggruppe + frist), enkel liste
5. **Matrisevisning** — auto-switch til matrise når punkter har områder, status-fargekoder, fremdrift
6. **Fristflytting** — 3 nivåer: enkelt punkt, skyv område, kaskade-flytt med avhengigheter
7. **Polygon-tegneverktøy** — tegn områder på tegning, kontrollplan henter dem automatisk
8. **Bulk-operasjoner** — flervalg av områder, kopier mellom etasjer
9. **Kontrollområde på maler** — nytt felt på ReportTemplate, filter i matrise/liste
10. **Historikk + sporbarhet** — KontrollplanHistorikk, audit trail per punkt
11. **Sluttrapport PDF** — eksport per kontrollområde, kontrollerklæring (SAK10 §14-7)
12. **Varsling** — varselUkerFør, push ved frist, eskalering
13. **MS Project import** — parser .mpp/.xml → foreslå kontrollplanpunkter (via AI-integrasjon)

### Avhengigheter

- Steg 1–2: ✅ Ferdig implementert og deployet
- Steg 3–4: Kan bygges nå — ingen blokkere (neste steg)
- Steg 5: Bygger på steg 4 (liste) + krever områder
- Steg 6: Bygger på steg 4 (punkter med frister og avhengigheter)
- Steg 7: Uavhengig — kan bygges parallelt med steg 4–6
- Steg 8–12: Kan bygges etter steg 4
- Steg 13: Krever AI-integrasjon (REST API-lag)

## Fremtidig utvidelse av biblioteket

### Neste NS 3420-standarder (prioritert)

| Standard | Del | Innhold | Typiske maler | Kommentar |
|----------|-----|---------|---------------|-----------|
| NS 3420-CD | CD | Betongarbeider | Forskaling, armering, støp, herding, etterbehandling | Stor standard — mange kontrollpunkter. Start med betongstøp og armeringskontroll |
| NS 3420-J | J | Tømrerarbeider | Bindingsverk, isolasjon, dampsperre, kledning | Relevant for de fleste bolig- og næringsbygg |
| NS 3420-GU | GU | Murarbeider, puss, flis | Flislegging, puss, murverk | Våtromskontroll er høy etterspørsel |
| NS 3420-L | L | Malerarbeider, belegg | Overflatebehandling, gulvbelegg | Ofte siste kontroll før overtakelse |
| NS 3420-D | D | Stålkonstruksjoner | Sveisekontroll, boltekontroll, korrosjon | Spesialist — færre brukere |
| NS 3420-A | A | Rigg, drift, nedrigging | SHA-plan, vernerunder, avfallshåndtering | Tverrgående — relevant for HMS-modulen |

### Tips ved utvidelse

- **Start med de hyppigste kontrollpunktene** — ikke dekk hele standarden. Én mal med 8 gode felt slår tre maler med 30 halvgode felt
- **Bruk FTD-dokumentsøket** for å finne krav: `ftdSok.nsStandardSok({ projectId, nsKode: "CD" })` søker i de indekserte NS-dokumentene
- **Følg mønsteret**: nedtrekksmeny = kontrollresultat, hjelpetekst = NS-kravet, desimal = kun der det måles
- **Test med en fagarbeider** — be noen som faktisk utfører arbeidet om å gå gjennom malen. De finner overlapp og mangler som ikke synes fra skrivebordet
- **Prioritet:** Grunnpakke (1) for det alle trenger, utvidet (2) for spesifikke disipliner, spesialist (3) for komplekse prosjekter
- **Sikkerhetskritiske felt** skal ha et tydelig "STOPP"-alternativ i nedtrekksmenyen — ikke bare "avvik"

### Bransjespesifikke maler (utenfor NS 3420)

På sikt kan biblioteket utvides med maler fra andre kilder:
- **TEK17** — energikrav, brannsikring, universell utforming
- **VA/Miljø-blad** (Norsk Vann) — nasjonale anbefalinger for vann og avløp. Kommunale VA-normer varierer, men VA-bladene er den felles referansen
- **Byggherreforskriften** — SHA-kontrollpunkter
- **Firmaspesifikke** — admin kan lage egne maler i `/admin/bibliotek`

## Status

- **Sjekklistebibliotek:** ✅ 2 standarder, 12 maler, 74 felt — fungerer i produksjon
- **Admin-redigering:** Planlagt (`/admin/bibliotek`) — ikke bygget ennå
- **Kontrollplan design:** ✅ Fullstendig spesifikasjon med lovkrav, datamodell, bulk-ops, sporbarhet, sluttrapport
- **Område-modell:** ✅ Implementert — `omrader`-tabell, API CRUD, velger-komponenter (web + mobil)
- **Område-/rom-velger i sjekklister:** ✅ zone_property → nedtrekksmeny, room_property → filtrert nedtrekksmeny
- **Kontrollplan-siden:** Ikke bygget ennå — neste steg (steg 3)
- **Modul-registrering:** Ikke lagt til i `PROSJEKT_MODULER` ennå
- **Polygon på tegning:** Ikke bygget ennå (steg 5)
- **Målgruppe:** Industribygg, boligblokker, infrastruktur (tiltaksklasse 2/3)
