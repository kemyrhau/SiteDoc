# Kontrollplan — arkitektur og implementasjonsplan

## Bakgrunn og konsept

SiteDoc skal ha et **sentralarkiv for sjekklister** basert på norske byggstandarder (NS 3420 som første standard). Prosjekter velger hvilke sjekklister de vil bruke ved å huke av i biblioteket. Valgte sjekklister blir til vanlige `SjekklisteMal`-er i prosjektet — tilgjengelig for alle fag uten begrensning — inntil brukeren valgfritt kobler dem til kontrollplan eller dokumentflyt.

**Merk:** De ferdigbygde NS 3420-K malene under er et utkast og skal forbedres.

## Fullstendig flyt

```
SENTRALARKIV (globalt, admin vedlikeholder)
  BibliotekStandard → BibliotekKapittel → BibliotekMal
  Eksempel: NS 3420-K → KB (Jord og vegetasjon) → KB2.2 Jordarbeider
      ↓ prosjektleder åpner "Hent fra bibliotek" og huker av

PROSJEKT-SJEKKLISTEMALER (instansiert kopi per prosjekt)
  Vanlig SjekklisteMal i prosjektets enterprise
  Synlig og brukbar for alle fag uten kobling
  Kan redigeres og tilpasses av prosjektet
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

## Arkitektur-oversikt (fra SVG-diagram)

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

## Eksisterende UI-elementer (observert i test.sitedoc.no)

### Sjekklistemal-struktur (fra Befaringsrapport-malen)

- `FASTE FELT`: Emne (med emne-kategorier), Bestiller-entreprise, Lokasjon
- `TOPPTEKST`: frittstående felt øverst i dokumentet
- `DATAFELTER`: innholdsfelter, støtter Repeater med nestede felt

### Tilgjengelige felttyper i malbyggeren

- **Tekst:** Overskrift, Undertittel, Tekstfelt
- **Valg:** Enkeltvalg, Flervalg, **Trafikklyss** (rød/gul/grønn = OK/Avvik/N/A)
- **Tall:** Heltall, Desimaltall, **Beregning**
- **Dato/Tid:** Dato, Dato og tid
- **Person/Firma:** Person, Flere personer, Firma
- **Filer:** **Vedlegg** (for fotodokumentasjon)
- **Spesialfelt:** BIM-egenskap, Soneegenskap, Romegenskap, Vær, **Signatur**, **Repeater**, Lokasjon, **Posisjon i tegning**
- **Instruksjon/PSI:** Lesetekst, Bilde med tekst, Video, Quiz-spørsmål

### Felttype-mapping for NS 3420-K sjekklister

| NS 3420-K konsept | Malbygger-felttype |
|---|---|
| Bekreftelsespunkt (ja/nei) | **Trafikklyss** |
| Målverdi med toleranse | **Desimaltall** |
| Fotodokumentasjon | **Vedlegg** |
| Fase-overskrift (FØR/UNDER/ETTER) | **Lesetekst** (Overskrift-variant) |
| Gjentagende punkter per sone | **Repeater** |

### Eksisterende infrastruktur

- **Sjekklistemaler-siden:** Kolonner: Navn, Prefiks, Versjon — versjonering allerede støttet
- **Dokumentflyt-siden:** Per entreprise (Byggherre, Elektro, etc.), opprettes per entreprise
- **Moduler-siden:** Pakker (Funksjon/Sjekklistemal/Oppgavemal), aktiveres per prosjekt med Aktiver/Deaktiver-knapp
- **Kontrollplan:** Lenket i venstremenyen under Produksjon, returnerer 404 — skal bygges

## NS 3420-K:2024 — første standard i biblioteket

Standard: **NS 3420-K:2024 – Anleggsgartnerarbeider**

### KA – Innledende arbeider

- **KA7**: Forberedende arbeider ved gjenbruk av materialer

### KB – Jord og vegetasjon

#### KB2.2 – Jordarbeider, utlegging av eksterne masser (ref: KB2.2 / KB2.5)

**FØR:**
- Underlag kontrollert og godkjent `[Trafikklyss]` — Fri for is, snø, organisk materiale og stående vann
- Leveringsdokument kontrollert `[Trafikklyss]` — Vareseddel stemmer med spesifisert jordtype

**UNDER:**
- Lagtykkelse vekstjord `[Desimaltall, enhet: cm, min: 20]` — Krav per prosjekt – Tabell K4 NS 3420-K
- Ingen komprimering av vekstjord `[Trafikklyss]` — Ikke kjøre med tunge maskiner på utlagt jordlag

**ETTER:**
- Planhet – avvik fra planlagt nivå `[Desimaltall, enhet: mm, toleranse: ±30]` — Mål med 3 m rettholt · ref KB2.5
- Fritt for stein >30 mm og fremmedlegemer `[Trafikklyss + Vedlegg]` — Visuell kontroll over hele arealet
- Ugrasbekjempelse utført `[Trafikklyss]` — KB2.4 – kjemisk eller mekanisk metode

#### KB4 – Grasdekke, etablering og kontroll (ref: KB4)

**FØR:**
- Frøblanding/rullegress dokumentert `[Trafikklyss]` — Emballasje merket – opphav og art kontrollerbart (KB4 b1)
- Jordlag løsgjort og finplanert `[Trafikklyss + Vedlegg]` — KB2.5 – ingen store klumper, stein < 30 mm
- Fall/helning kontrollert `[Desimaltall, enhet: %, min: 2.0]` — Avrenning sikret – min. 2 % mot sluk/kant

**UNDER:**
- God kontakt frø/plen mot jord `[Trafikklyss + Vedlegg]` — Rullegress i forband, tett sammensatt (KB4 c2)
- Vannet etter legging/såing `[Trafikklyss]` — Rotbløyte / jevn fuktighet sikret

**ETTER:**
- Markdekningsgrad `[Desimaltall, enhet: %, min: 95]` — KB4 c4 – ingen åpne flekker > 1,0 dm²
- Klippet jevnlig frem til overtakelse `[Trafikklyss + Vedlegg]` — KB4 c3 – homogen og i god vekst

#### KB6 – Planting, trær busker og stauder (ref: KB6 / NS 4400)

**FØR:**
- Planter i henhold til NS 4400 `[Trafikklyss]` — Art, sort, størrelse og leveringsform som spesifisert
- Planter saftspente og fuktige ved ankomst `[Trafikklyss]` — KB6 c1 – barrotsplanter i hvile (KB6 c2)
- Plantehull riktig dimensjon `[Trafikklyss + Vedlegg]` — Min. 2× rotklumpdiameter · dybde = rotklumphøyde

**UNDER:**
- Rothalsen over jordoverflate `[Trafikklyss + Vedlegg]` — KB6.1 c1 – tre plantes med noe overhøyde (KB6.1 c2)
- God kontakt mellom rot og jord `[Trafikklyss]` — KB6 c3 – uten luftlommer
- Rotbløyte utført etter planting `[Trafikklyss]` — KB6 c4 – grundig vanning

**ETTER:**
- Plantefelt fritt for ugras `[Trafikklyss + Vedlegg]` — KB6 c5 – ved overtakelse
- Oppbinding og støtte montert `[Trafikklyss]` — KC3.1 – midlertidig oppstøtting av trær

### KC – Vanningsanlegg, sikring og beskyttelse

- **KC3.1**: Oppstøtting og oppbinding av trær

### KD – Utendørsbelegg, kanter, renner

#### KD1 – Utendørsbelegg, legging og kontroll (ref: KD1 · Tabell K11/K12)

**FØR:**
- Underlag kontrollert og komprimert `[Trafikklyss + Vedlegg]` — Jevnt, stabilt – ingen telehiv-risiko
- Belegningstype som spesifisert `[Trafikklyss]` — Farge, mønster, kornstruktur – visuell kontroll

**UNDER:**
- Fall gangarealer `[Desimaltall, enhet: %, min: 2.0]` — Tabell K11 – annet belegg, gangarealer
- Fall kjørearealer `[Desimaltall, enhet: %, min: 2.5]` — Tabell K11 – kjørearealer
- Fuger rette linjer/jevne kurver `[Trafikklyss + Vedlegg]` — KD1 c5 – gjennomgående fuger uten hakk

**ETTER:**
- Planhet over 3 m målelengde – gangarealer `[Desimaltall, enhet: mm, toleranse: ±3]` — Tabell K12 – belegningsstein betong/heller gangarealer
- Vertikalt sprang ved fuger `[Desimaltall, enhet: mm, maks: 2]` — Tabell K12 – gangarealer betong/heller
- Steiner rengjort for fugemateriale `[Trafikklyss]` — KD1 c7 – etter fuging

## Prisma-datamodell — nye tabeller

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
  malInnhold   Json              // Feltstruktur — uavhengig av enterprise ved import
  prosjektValg ProsjektBibliotekValg[]
}

model ProsjektBibliotekValg {
  id              String       @id @default(cuid())
  prosjektId      String
  bibliotekMalId  String
  bibliotekMal    BibliotekMal @relation(fields: [bibliotekMalId], references: [id])
  sjekklisteMalId String?      // ID til SjekklisteMal opprettet etter import
  aktivertAv      String       // userId
  aktivertDato    DateTime     @default(now())

  @@unique([prosjektId, bibliotekMalId])
}
```

## malInnhold JSON-struktur

```json
{
  "prefiks": "KB2",
  "faser": [
    {
      "fase": "FØR",
      "felter": [
        {
          "navn": "Underlag kontrollert og godkjent",
          "type": "TRAFIKKLYSS",
          "hjelpetekst": "Fri for is, snø, organisk materiale og stående vann",
          "pakrevd": true
        },
        {
          "navn": "Lagtykkelse vekstjord",
          "type": "DESIMALTALL",
          "enhet": "cm",
          "toleranse": { "type": "min", "verdi": 20 },
          "hjelpetekst": "Krav per prosjekt – Tabell K4 NS 3420-K",
          "pakrevd": true
        },
        {
          "navn": "Fotodokumentasjon underlag",
          "type": "VEDLEGG",
          "pakrevd": false
        }
      ]
    }
  ]
}
```

## API-ruter

| Metode | Rute | Beskrivelse |
|--------|------|-------------|
| GET | `/api/bibliotek/standarder` | Alle standarder med kapitler og maler. Inkluder om prosjektet har importert (via `prosjektId` query param) |
| GET | `/api/bibliotek/standarder/[standardId]/kapitler` | Kapitler med maler for én standard |
| POST | `/api/bibliotek/maler/[malId]/importer` | Importer mal til prosjekt. Body: `{ prosjektId, enterpriseId }`. Oppretter SjekklisteMal + ProsjektBibliotekValg |
| GET | `/api/bibliotek/prosjekt/[prosjektId]/valg` | Alle bibliotekmaler prosjektet har importert |
| DELETE | `/api/bibliotek/prosjekt/[prosjektId]/valg/[valgId]` | Fjern kobling (sletter ikke selve SjekklisteMal) |

## Import-funksjon

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
1. Hent `BibliotekMal` med `malInnhold`
2. Sjekk at `ProsjektBibliotekValg` ikke allerede eksisterer
3. Opprett `SjekklisteMal` i prosjektets enterprise — bruk eksisterende mønster
4. Iterer `malInnhold.faser` og opprett feltene med riktig type/konfig
5. Opprett `ProsjektBibliotekValg` med `sjekklisteMalId`
6. Returner `{ sjekklisteMalId }`

## UI-komponenter

### 1. BibliotekSheet (`src/components/bibliotek/BibliotekSheet.tsx`)

Shadcn `Sheet` (slide-over fra høyre):
- Henter fra `GET /api/bibliotek/standarder?prosjektId=...`
- Accordion per kapittel (KA, KB, KC, KD)
- Checkbox per mal
- Allerede importerte: grønn CheckCircle-ikon, disabled checkbox, "Se mal →"-lenke
- Klikk på avhukingsboks → POST importer → revalidate sjekklistemaler-lista
- Optimistisk UI: checkbox slår seg på umiddelbart, ruller tilbake ved feil
- Viser referanse og beskrivelse under malnavnet

### 2. Knapp på sjekklistemaler-siden

På `src/app/dashbord/oppsett/produksjon/sjekklistemaler/page.tsx`:
- Legg til `[📚 Hent fra bibliotek]`-knapp ved siden av `[+ Legg til]`
- Åpner BibliotekSheet
- Importerte maler i lista vises med et lite "NS 3420-K"-badge (source-tag)

### 3. Kontrollplan-siden (`src/app/dashbord/oppsett/produksjon/kontrollplan/page.tsx`)

To faner:
- **"Sjekklistebibliotek"** (aktiv): BibliotekSheet-innholdet som fullside-visning
- **"Kontrollplan"** (placeholder): "Kommer snart"-melding

## Seed og migrering

```bash
# Migrering
npx prisma migrate dev --name add-sjekklistebibliotek

# Seed NS 3420-K data
npx tsx prisma/seed-bibliotek.ts
```

`prisma/seed-bibliotek.ts` — seed alle NS 3420-K kapitler og maler med komplett `malInnhold` JSON.

## Viktige prinsipper

- Ikke endre eksisterende modeller, API-er eller komponenter
- Følg eksisterende auth/session/middleware-mønster
- Følg eksisterende kodekonvensjoner
- `malInnhold` er JSON — ikke koblet til SjekklisteMal-tabellen før import
- Import lager alltid en **kopi** — prosjektet eier sin egen mal og kan redigere den
- Oppdateringer i biblioteket oppdaterer IKKE automatisk prosjektets mal
