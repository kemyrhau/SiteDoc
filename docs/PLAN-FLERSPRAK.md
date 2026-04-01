# Plan: Flerspråkstøtte — SiteDoc

## Mål

Brukeren velger språk i mobilappen. Alt vises på valgt språk: UI, mal-etiketter, valg-alternativer, statusnavn. Rapporter skrives ut på prosjektets standardspråk.

## Støttede språk

| Kode | Språk | Prioritet |
|------|-------|-----------|
| `nb` | Norsk bokmål | Standard (eksisterende) |
| `sv` | Svensk | Høy |
| `en` | Engelsk | Høy |
| `lt` | Litauisk | Høy |
| `pl` | Polsk | Høy |
| `uk` | Ukrainsk | Høy |
| `ro` | Rumensk | Middels |
| `et` | Estisk | Middels |
| `fi` | Finsk | Middels |
| `cs` | Tsjekkisk | Middels |
| `de` | Tysk | Middels |
| `ru` | Russisk | Lav |

## Tre lag av oversettelse

### Lag 1: Statisk UI-tekst (mobil + web)

Alt som ikke er brukergenerert innhold: knapper, navigasjon, statusnavn, feilmeldinger, placeholders.

**Løsning:** `i18next` + `react-i18next` (web) + `expo-localization` + `i18next` (mobil)

```
packages/shared/src/i18n/
├── index.ts              # i18next konfigurasjon
├── nb.json               # Norsk (kilde-språk, ~300 nøkler)
├── sv.json               # Svensk
├── en.json               # Engelsk
├── lt.json               # Litauisk
├── pl.json               # Polsk
├── ro.json               # Rumensk
├── uk.json               # Ukrainsk
└── ru.json               # Russisk
```

**Eksempler på nøkler:**
```json
{
  "status.draft": "Utkast",
  "status.sent": "Sendt",
  "status.approved": "Godkjent",
  "action.save": "Lagre",
  "action.send": "Send",
  "action.cancel": "Avbryt",
  "field.selectDate": "Velg dato...",
  "field.selectPerson": "Velg person...",
  "field.required": "Påkrevd",
  "checklist.create": "Opprett sjekkliste",
  "trafficLight.approved": "Godkjent",
  "trafficLight.remark": "Anmerkning",
  "trafficLight.deviation": "Avvik",
  "trafficLight.notRelevant": "Ikke relevant"
}
```

**Omfang:** ~300 nøkler for mobil, ~200 ekstra for web. Oversettes profesjonelt eller via AI-assistert batch.

### Lag 2: Mal-innhold (etiketter, alternativer, overskrifter)

Mal-etiketter og valgalternativer som defineres i malbyggeren på PC.

**Problem:** Maler lages på norsk i malbyggeren. Når en litauisk bruker åpner sjekklisten, skal "Ansvarlig person" vise som "Atsakingas asmuo".

**Løsning:** Oversettelsesstabell i databasen.

```prisma
model ReportObjectTranslation {
  id              String @id @default(cuid())
  reportObjectId  String
  language        String // "en", "pl", "lt", etc.
  label           String // Oversatt etikett
  options         Json?  // Oversatte alternativer (samme struktur som config.options)

  reportObject    ReportObject @relation(fields: [reportObjectId], references: [id], onDelete: Cascade)

  @@unique([reportObjectId, language])
}

model ReportTemplateTranslation {
  id              String @id @default(cuid())
  templateId      String
  language        String
  name            String // Oversatt malnavn
  description     String?
  subjects        Json?  // Oversatte emner

  template        ReportTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)

  @@unique([templateId, language])
}
```

**Opprettelse av oversettelser:**
1. Mal lages på norsk i malbyggeren (som i dag)
2. Admin trykker "Oversett mal" → velger språk → AI oversetter alle etiketter og alternativer
3. Admin kan redigere/korrigere oversettelsen
4. Lagres i `ReportObjectTranslation` / `ReportTemplateTranslation`

**Henting:** API-et returnerer oversettelser basert på forespurt språk:
```typescript
mal.hentMedId({ id, språk: "lt" })
// → returnerer objekter med litauiske etiketter, fallback til norsk
```

### Lag 3: Brukergenerert innhold (fritekst, kommentarer)

Tekstfelt-svar, kommentarer, titler — skrevet av brukeren på eget språk.

**Strategi:** Automatisk server-side oversettelse med caching. Bruker ser alltid innhold på sitt språk.

```
Polsk bruker skriver:     "Pęknięcie w ścianie fundamentowej"
                                    ↓
                         Node.js backend (TranslationService)
                                    ↓
                         Cache: sjekk DB først
                         Hvis ikke cachet → kall DeepL / Claude
                         Lagre original + oversettelser i DB
                                    ↓
Norsk bruker ser:         "Sprekk i grunnmuren"
Polsk bruker ser fortsatt: "Pęknięcie w ścianie fundamentowej"
```

**Database-lagring av oversettelser:**

```prisma
model ContentTranslation {
  id            String   @id @default(cuid())
  sourceHash    String   // SHA-256 av originaltekst (for cache-oppslag)
  sourceLang    String   // "pl"
  targetLang    String   // "nb"
  sourceText    String   // Originaltekst
  translatedText String  // Oversatt tekst
  contentType   String?  // "defect_description", "comment", "field_value"
  provider      String   // "deepl", "claude", "manual"
  createdAt     DateTime @default(now())

  @@unique([sourceHash, targetLang])
  @@index([sourceHash])
}
```

**TranslationService på Node.js:**

```typescript
// apps/api/src/services/oversettelse.ts

class TranslationService {
  // Prioritert rekkefølge for oversettere:
  // 1. DeepL API — best for skandinaviske språk, rimelig
  // 2. Claude API — forstår byggfaglig kontekst, dyrere
  // 3. Google Translate — billigst fallback

  async oversett(input: {
    tekst: string
    fraSpraak: string
    tilSpraak: string
    innholdstype?: string  // gir kontekst til AI
  }): Promise<string> {
    // 1. Beregn hash av kildetekst
    // 2. Sjekk cache (ContentTranslation-tabell)
    // 3. Hvis ikke cachet → kall oversetter-API med fagkontekst
    // 4. Lagre i cache-tabell
    // 5. Returner oversettelse
  }
}
```

**Kontekstuell AI-oversettelse (Claude):**
```
Du er oversetter for en norsk byggeplassapp.
Oversett følgende til {tilSpraak} faglig byggspråk.
Behold fagtermer korrekt (avvik, mangel, anmerkning).
Tekst: "{brukerInput}"
Returner kun oversatt tekst, ingen forklaring.
```

**Oversettelsestilbyder: Dynamisk provider-abstraksjon**

Samme mønster som embedding-servicen — en felles interface med utbyttbare providere. Konfigurerbart per prosjekt via innstillinger.

```typescript
// apps/api/src/services/oversettelse.ts

interface TranslationProvider {
  oversett(tekster: string[], fraSpraak: string, tilSpraak: string): Promise<string[]>;
  navn: string;
}

class GoogleTranslateProvider implements TranslationProvider {
  // google-translate-api-x (gratis, uoffisiell) eller @google-cloud/translate (offisiell)
  navn = "google";
}

class DeepLProvider implements TranslationProvider {
  // DeepL API (api-free.deepl.com eller api.deepl.com)
  navn = "deepl";
}

class ClaudeProvider implements TranslationProvider {
  // Anthropic Claude API med byggfaglig kontekst-prompt
  navn = "claude";
}
```

**Tilgjengelige providere:**

| Provider | Pris | Kvalitet | API-nøkkel | Språk |
|----------|------|----------|------------|-------|
| Google Translate (uoffisiell) | Gratis | God | Nei | 130+ |
| Google Cloud Translation | $20/M tegn | God | Ja | 130+ |
| DeepL Free | Gratis (500k/mnd) | Svært god | Ja | ~30 |
| DeepL Pro | $25/M tegn | Svært god | Ja | ~30 |
| Claude | ~$3/M tokens | Best for fagtermer | Ja | Alle |

**Anbefalt oppsett:**
1. **Start med:** `google-translate-api-x` (gratis, ingen nøkkel, robust)
2. **Oppgrader til:** Google Cloud eller DeepL ved høyere volum/kvalitetskrav
3. **Fallback:** Claude for byggfagspesifikke termer

Alle providere støtter de 12 målspråkene: nb, sv, en, lt, pl, ro, uk, ru, et, fi, cs, de.

**Konfigurasjon per prosjekt:**
```typescript
// ai_sok_innstillinger eller egen tabell
{
  translationProvider: "google" | "deepl" | "claude",
  translationApiKey?: string, // Kun for offisiell Google Cloud / DeepL / Claude
}
```
- LibreTranslate (uten GPU) gir ~70% nøyaktighet — ikke godt nok for fagterminologi

**Dataflyt ved felt-endring:**
```
1. Bruker skriver fritekst → lagres i sjekkliste/oppgave data (originalspråk)
2. Ved synk til server: TranslationService oversetter til prosjektets aktive språk
3. Oversettelsen caches i ContentTranslation med sourceHash
4. Andre brukere henter → API returnerer oversatt versjon basert på brukerens språk
5. Samme tekst = samme hash → ingen ny API-kall (cache hit)
```

**Offline-håndtering:**
- Originaltekst vises umiddelbart (alltid tilgjengelig)
- Oversettelse hentes når nett er tilgjengelig
- Cachet i SQLite lokalt for fremtidige offline-oppslag
- Markering: liten indikator under feltet viser "Oversatt fra polsk"

## Dataflyt

### Utfylling (Bruker 1, polsk)

```
Bruker 1 (språk: pl) åpner sjekkliste
  → API henter mal med polske oversettelser (Lag 2)
  → UI viser polske etiketter: "Data" → "Data", "Osoba" → "Person"
  → Valgalternativer vises på polsk: "Zatwierdzony" / "Odrzucony"
  → Bruker fyller ut fritekst på polsk
  → Bruker velger "Zatwierdzony" (som er oversettelse av "Godkjent")
  → Lagres i DB: verdi = "Godkjent" (NORSK nøkkelverdi, IKKE polsk)
```

### Visning (Bruker 2, litauisk)

```
Bruker 2 (språk: lt) åpner samme sjekkliste
  → API henter mal med litauiske oversettelser (Lag 2)
  → Etiketter vises på litauisk
  → Verdi "Godkjent" → slås opp i litauisk opsjonsmap → "Patvirtinta"
  → Fritekst (polsk) → API sjekker ContentTranslation cache
    → Cache hit → returnerer litauisk oversettelse direkte
    → Cache miss → kaller DeepL/Claude → cacher → returnerer
  → Bruker ser alt på litauisk, med markering "Oversatt fra polsk" på fritekstfelt
```

### Utskrift (prosjektspråk: norsk)

```
Admin skriver ut sjekklisten
  → Prosjektets standardspråk = norsk
  → Alle etiketter på norsk (original, Lag 2)
  → Alle valgverdier på norsk (lagret som nøkler)
  → Fritekst: oversatt til norsk via TranslationService (Lag 3)
  → Valgfritt: vis originalspråk i parentes eller fotnote
```

## Kritisk designbeslutning: Verdier i databasen

**Valg-verdier (list_single, list_multi, traffic_light) lagres ALLTID som norsk nøkkelverdi.**

Hvorfor: Norsk er kilde-språket. Verdien "Godkjent" er unik nøkkel som kan slås opp i alle oversettelser. Hvis vi lagret på brukerens språk ("Zatwierdzony"), ville vi trenge omvendt oppslag for alle andre språk.

**Konsekvens for eksisterende data:** Ingen migrering nødvendig — alle verdier er allerede på norsk.

**Mapping-flyt:**
```
DB-verdi: "Godkjent"
  → Bruker (pl): opsjon-map["Godkjent"] → "Zatwierdzony" ✓
  → Bruker (lt): opsjon-map["Godkjent"] → "Patvirtinta" ✓
  → Print (nb): "Godkjent" ✓ (ingen oppslag nødvendig)
```

For trafikklys lagres allerede farge-koder (`green`, `yellow`, `red`) — disse er språknøytrale. Label-oversettelsen skjer i Lag 1 (UI-tekst).

## Prosjektspråk

```prisma
// Eksisterende Project-modell utvides:
model Project {
  // ... eksisterende felter
  defaultLanguage  String  @default("nb") // Prosjektets standardspråk (for print)
}
```

Brukes KUN for print-output. Brukerens app-språk styrer alt annet.

## Brukerens språkvalg

```prisma
// Eksisterende User-modell utvides:
model User {
  // ... eksisterende felter
  language  String  @default("nb") // Brukerens foretrukne språk
}
```

- Settes i mobilappen (Mer → Innstillinger → Språk)
- Settes i web (Brukermeny → Språk)
- Lagres på bruker-nivå (ikke enhet-nivå) — samme språk på alle enheter

## Modulsystem-integrasjon

Språkstøtte er en **prosjektmodul** som aktiveres per prosjekt:

```typescript
// packages/shared/src/types/index.ts
const SPRAAK_MODUL: ModulDefinisjon = {
  slug: "spraak",
  navn: "Flerspråk",
  beskrivelse: "Støtte for flere språk i maler, sjekklister og oppgaver",
  kategori: "system",
  ikon: "Languages",
  maler: [], // Ingen maler — dette er en systemmodul
  config: {
    tilgjengeligeSpraak: ["nb", "sv", "en", "lt", "pl", "ro", "uk", "ru"],
    standardSpraak: "nb",
  }
}
```

**Aktivering:**
1. Admin aktiverer "Flerspråk"-modulen i Innstillinger > Feltarbeid > Moduler
2. Velger hvilke språk som skal være tilgjengelige i prosjektet
3. "Oversett maler"-knapp dukker opp i malbyggeren
4. AI oversetter alle mal-etiketter til valgte språk

**Uten aktiv modul:** Alt fungerer som i dag (kun norsk). Ingen ekstra DB-queries.

## Oversettelse av maler (Lag 2)

### Oversettelsestjeneste

Bruker **samme TranslationService** som fritekst-oversettelse — DeepL API som primær.

```typescript
// apps/api/src/services/oversettelse.ts

async function oversettMal(
  malId: string,
  fraSpraak: string, // "nb"
  tilSpraak: string, // "pl"
): Promise<void> {
  // 1. Hent alle rapportobjekter for malen
  // 2. Samle alle etiketter + alternativer i én batch
  // 3. Kall DeepL batch-oversettelse (alle tekster i ett kall)
  // 4. Parse og lagre i ReportObjectTranslation
  // 5. Oversett malnavn/beskrivelse → ReportTemplateTranslation
}
```

### DeepL batch for maler

DeepL aksepterer arrays — alle etiketter og alternativer sendes i ett kall:

```typescript
const response = await fetch("https://api-free.deepl.com/v2/translate", {
  method: "POST",
  headers: {
    "Authorization": `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    text: [
      "Ansvarlig person",     // objekt 1: label
      "Utført dato",          // objekt 2: label
      "Godkjent",             // objekt 3: alternativ 1
      "Anmerkning",           // objekt 3: alternativ 2
      "Avvik",                // objekt 3: alternativ 3
    ],
    source_lang: "NB",
    target_lang: "PL",
  }),
});
// → { translations: [
//   { text: "Osoba odpowiedzialna" },
//   { text: "Data wykonania" },
//   { text: "Zatwierdzony" },
//   { text: "Uwaga" },
//   { text: "Odchylenie" },
// ]}
```

### Kostnad og volum

- Typisk mal: 10-30 rapportobjekter, ~50-100 tekststykker totalt
- Per mal per språk: ~500 tegn → $0.01 (DeepL) — praktisk talt gratis
- Totalt per prosjekt (10 maler × 7 språk): ~$0.70 engangs
- Gratis-tier (500k tegn/mnd) dekker ~1000 mal-oversettelser
- Admin kan redigere/korrigere oversettelser i malbyggeren etterpå

## Implementeringsplan

### Fase 1: UI-oversettelse (Lag 1)

**Mål:** Mobilappen viser UI på brukerens språk

1. Sett opp `i18next` i `packages/shared/src/i18n/`
2. Ekstraher alle hardkodede norske strenger fra mobil-appen (~300 nøkler)
3. Lag norsk kilde-fil (`nb.json`)
4. Oversett til 7 språk (AI-assistert + manuell QA)
5. Integrer `expo-localization` for system-språk-deteksjon
6. Legg til språkvelger i Mer-fanen (mobil)
7. Legg til `language`-felt på User-modellen

**Filer som endres:**
- `packages/shared/src/i18n/` (ny)
- `apps/mobile/src/` — alle skjermer og komponenter (erstatt hardkodet tekst)
- `packages/db/prisma/schema.prisma` — `language` på User
- `apps/mobile/app/(tabs)/mer.tsx` — språkvelger

### Fase 2: Mal-oversettelse (Lag 2)

**Mål:** Mal-etiketter og alternativer vises på brukerens språk

1. Opprett `ReportObjectTranslation` og `ReportTemplateTranslation` tabeller
2. Utvid `mal.hentMedId` til å returnere oversettelser for forespurt språk
3. Bygg oversettelsestjeneste (AI-basert)
4. Legg til "Oversett mal"-knapp i malbyggeren
5. Legg til oversettelsesredigering i malbyggeren (korrigere AI-oversettelser)
6. Oppdater mobil-hooks (`useSjekklisteSkjema`, `useOppgaveSkjema`) til å bruke oversatte etiketter
7. Oppdater `RapportObjektRenderer` og alle 23 feltkomponenter til å bruke oversatt label/options

**Filer som endres:**
- `packages/db/prisma/schema.prisma` — nye modeller
- `apps/api/src/routes/mal.ts` — oversettelsesprosedyrer
- `apps/api/src/services/oversettelse.ts` (ny)
- `apps/web/src/components/malbygger/` — oversettelse-UI
- `apps/mobile/src/hooks/` — bruk oversatte etiketter
- `apps/mobile/src/components/rapportobjekter/` — alle 23 komponenter

### Fase 3: Prosjektspråk og print (Lag 2 + print)

**Mål:** Utskrifter bruker prosjektets standardspråk

1. Legg til `defaultLanguage` på Project-modellen
2. Legg til språkvelger i prosjektinnstillinger
3. Oppdater print-ruter til å hente oversettelser basert på prosjektspråk
4. `RapportObjektVisning` bruker prosjektspråk ved print

### Fase 4: Automatisk fritekst-oversettelse (Lag 3) — FREMTIDIG

> **Status:** Planlagt som fremtidig forbedring. Fase 1–3 gir nok verdi til lansering.
> Fase 4 krever mer detaljering av offline-sync-logikk, UX for feiloversettelser,
> og språkdeteksjon (bruker kan skrive på annet språk enn sin innstilling).

**Mål:** Brukergenerert innhold oversettes automatisk server-side

**Åpne spørsmål som må løses før implementering:**

1. **Språkdeteksjon på kildetekst:** Skal vi stole på `User.language`, eller bruke
   DeepL sin automatiske språkdeteksjon? En norsk bruker kan skrive på engelsk.
   DeepL støtter `source_lang: null` for auto-detect — bør trolig brukes.

2. **UX ved feiloversettelse:** Hvordan håndterer vi dårlige oversettelser?
   - "Oversatt fra {språk}"-markering under feltet
   - Mulighet for bruker å se originaltekst (toggle?)
   - Rapporterings-/korrigeringsmekanisme?

3. **Offline-sync av oversettelser:** Ikke-triviell logikk:
   - Når caches oversettelser i SQLite?
   - Hva vises offline for tekst skrevet av andre brukere?
   - Synkroniseringsstrategi for nye oversettelser ved nettverkstilkobling

4. **Kostnads-/volumkontroll:** Budsjettgrense per prosjekt? Rate limiting?

**Skisse (implementeres når åpne spørsmål er løst):**

1. Opprett `ContentTranslation`-tabell (cache for oversettelser)
2. Bygg `TranslationService` med DeepL (primær) + Claude (fallback)
3. tRPC-router `oversett`:
   - `oversett.tekst({ tekst, fraSpraak, tilSpraak, innholdstype? })` — enkeltfelt
   - `oversett.batch({ felter: [...], tilSpraak })` — hele skjema på én gang
   - `oversett.hentCachet({ hashListe, tilSpraak })` — bulk cache-oppslag
4. Integrer i `sjekkliste.hentMedId` / `oppgave.hentMedId`
5. Oppdater mobil-hooks og print

**Kostnadsestimat (DeepL):**
- Typisk sjekkliste: 5-10 fritekstfelt, ~200 tegn hver
- Per sjekkliste-oversettelse: ~2000 tegn → $0.04 (DeepL Pro)
- 100 sjekklister/mnd: ~$4/mnd
- Cache eliminerer gjentatte oversettelser av identisk tekst

## Modulsystem: Alle tre moduler

| Modul | Slug | Avhengighet | Beskrivelse |
|-------|------|-------------|-------------|
| Flerspråk | `spraak` | Ingen | UI + mal-oversettelse + prosjektspråk |
| Søk | `sok` | Ingen | Fulltekstsøk i dokumenter (FTS), valgfritt AI-søk |
| Økonomi | `okonomi` | Ingen | Mengde, A-nota, budsjett, avviksanalyse |

Alle tre aktiveres uavhengig per prosjekt via Innstillinger > Feltarbeid > Moduler.

## Hva "Fil til database" bidrar med

| Komponent | Relevant for | Bidrag |
|-----------|-------------|--------|
| Mengde-service (80 KB) | Økonomi | Direkte portering av forretningslogikk |
| Frontend mengde-komponenter | Økonomi | 7 React-komponenter gjenbrukes direkte |
| Søke-UI + re-ranking | Søk | Frontend + algoritme portes |
| Backend-abstraksjon | Søk | Lokal vs. Azure pattern |
| Azure OpenAI-klient | Søk (embeddings) | Klientmønster for API-kall |

**For Språk-modulen:** "Fil til database" bidrar ikke direkte. DeepL API er en enklere og bedre løsning enn å bygge på Azure OpenAI-infrastrukturen. Oversettelsestjenesten bygges fra scratch som en enkel HTTP-klient mot DeepL — samme mønster som vær-API-et allerede bruker.

## Oversettelsesserver — arkitektur

```
┌──────────────────────────────────────────────────────────┐
│              SiteDoc Node.js Backend (Fastify)            │
│                                                           │
│  TranslationService (apps/api/src/services/oversettelse.ts)
│  ├── oversett(tekst, fra, til, type?)                     │
│  ├── oversettBatch(felter[], til)                         │
│  └── oversettMal(malId, fra, til)                         │
│       │                                                   │
│       ├── 1. Cache-sjekk (ContentTranslation i PostgreSQL)│
│       │   └── SHA-256 hash → instant resultat (<5ms)      │
│       │                                                   │
│       ├── 2. DeepL API (api-free.deepl.com)               │
│       │   └── HTTP POST fra serveren, ~200ms              │
│       │   └── Støtter batch: flere tekster i ett kall     │
│       │                                                   │
│       ├── 3. Fallback: Claude API (ved fagtermer)         │
│       │   └── Byggfaglig kontekst-prompt                  │
│       │                                                   │
│       └── 4. Lagre i cache + returner                     │
│                                                           │
│  tRPC-router: oversett                                    │
│  ├── oversett.tekst      — enkeltfelt                     │
│  ├── oversett.batch      — hele skjema på én gang         │
│  ├── oversett.hentCachet — bulk cache-oppslag             │
│  └── oversett.oversettMal — mal-etiketter batch           │
└──────────────────────────────────────────────────────────┘
         ↑                              ↑
    Mobil-app                       Web-app
    (brukerens språk)               (print: prosjektspråk)
```

**Samme mønster som vær-API-et:** TranslationService kaller DeepL via `fetch()` fra Node.js — ingen ekstra infrastruktur, ingen GPU, ingen Docker. Bare en API-nøkkel i `.env`.

**Språkdeteksjon:** Brukerens valgte språk sendes med i API-kall (`Accept-Language` header eller `språk`-parameter). Kildetekstens språk utledes fra skrivende brukers språkinnstilling (lagret på User-modellen).

**Batch-optimalisering:** DeepL API aksepterer arrays av tekster i ett kall. Ved åpning av sjekkliste/oppgave sendes alle fritekstverdier i én batch — unngår N separate API-kall.

**Env-konfigurasjon:**
```env
DEEPL_API_KEY=...           # DeepL API-nøkkel (gratis eller pro)
ANTHROPIC_API_KEY=...       # Claude fallback (valgfritt)
```

## Risiko

| Risiko | Mitigering |
|--------|------------|
| AI-oversettelser har feil fagterminologi | Admin kan redigere mal-oversettelser i malbygger |
| ~300 UI-nøkler å ekstrahere fra mobil | Systematisk gjennomgang, komponent for komponent |
| Ytelse: ekstra DB-query per mal for oversettelser | Eager-load oversettelser med mal, cache i React Query |
| Offline: oversettelser må caches lokalt | SQLite-tabell for oversettelser, synkes ved oppstart |
| Verdier lagret som norsk nøkkel — hva om etikett endres? | Opsjoner bruk `value`-felt (ikke label) som nøkkel der mulig |
| Fritekst-oversettelseskostnad ved høyt volum | DeepL-cache eliminerer duplikater, budsjettgrense per prosjekt |
| DeepL nede / rate limit | Automatisk fallback til Claude API |
| Oversettelseskvalitet varierer per språk | Litauisk/rumensk/ukrainsk: grundigere QA av mal-oversettelser |
| Latens ved fritekst-oversettelse | Batch-kall + cache → sub-100ms for cache hits |
| Offline fritekst fra andre brukere | Vis original + "Oversettelse tilgjengelig når du er på nett" |
| Bruker skriver på annet språk enn sin innstilling | DeepL auto-detect (`source_lang: null`) i Fase 4 |
