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
| `lv` | Latvisk | Middels |
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

Alle providere støtter de 13 målspråkene: nb, sv, en, lt, pl, uk, ro, et, fi, cs, de, lv, ru.

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
    tilgjengeligeSpraak: ["nb", "sv", "en", "lt", "pl", "uk", "ro", "et", "fi", "cs", "de", "lv", "ru"],
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

### Fase 0: Førstegangs språkvalg ved installasjon

**Mål:** Brukeren velger språk ved første åpning — appen oppleves umiddelbart på riktig språk.

**Mobil (Expo):**

```
Første åpning:
  1. expo-localization: les enhetens språk (f.eks. "uk" for ukrainsk telefon)
  2. Vis velkomstskjerm på detektert språk:
     "Ласкаво просимо до SiteDoc" (ukrainsk)
     "Velkommen til SiteDoc" (norsk)
  3. Dropdown: "Velg språk / Виберіть мову" med alle 12 språk + flagg
  4. Bruker bekrefter → lagres lokalt (AsyncStorage) + User.language i DB
  5. Appen laster med valgt språk — alle skjermer er oversatt
```

**Web (Next.js):**

```
Første innlogging:
  1. Sjekk navigator.language (nettleser-språk)
  2. Hvis brukerens User.language ikke er satt:
     → Vis språkvelger-modal: "Velg språk" med flagg-ikoner
  3. Lagre i localStorage + User.language
  4. Påfølgende besøk: bruk lagret språk direkte
```

**Invitasjonsflyt:**

```
Bruker inviteres til prosjekt via e-post:
  → E-posten sendes på prosjektets standardspråk (norsk)
  → Bruker klikker lenke → registrerer seg
  → Første innlogging: språkvelger-modal
  → Brukeren velger ukrainsk → alt vises på ukrainsk fra nå av
```

**Komponenter:**

```
apps/mobile/app/sprakvalg.tsx      — Velkomstskjerm med språkvelger (mobil)
apps/web/src/components/SprakModal.tsx — Modal ved første innlogging (web)
```

**Språkliste med flagg:**

| Flagg | Kode | Norsk | Lokalt |
|-------|------|-------|--------|
| 🇳🇴 | `nb` | Norsk bokmål | Norsk bokmål |
| 🇸🇪 | `sv` | Svensk | Svenska |
| 🇬🇧 | `en` | Engelsk | English |
| 🇱🇹 | `lt` | Litauisk | Lietuvių |
| 🇵🇱 | `pl` | Polsk | Polski |
| 🇺🇦 | `uk` | Ukrainsk | Українська |
| 🇷🇴 | `ro` | Rumensk | Română |
| 🇪🇪 | `et` | Estisk | Eesti |
| 🇫🇮 | `fi` | Finsk | Suomi |
| 🇨🇿 | `cs` | Tsjekkisk | Čeština |
| 🇩🇪 | `de` | Tysk | Deutsch |
| 🇱🇻 | `lv` | Latvisk | Latviešu |
| 🇷🇺 | `ru` | Russisk | Русский |

**Viktig:** Hvert språk vises på *sitt eget språk* i listen — en ukrainsk bruker skal gjenkjenne "Українська" uten å kunne lese norsk.

**Testing — fase 0:**
- [ ] Ny installasjon på ukrainsk telefon → velkomstskjerm på ukrainsk
- [ ] Ny installasjon på norsk telefon → velkomstskjerm på norsk
- [ ] Ukjent systemspråk (f.eks. kinesisk) → velkomstskjerm på engelsk (fallback)
- [ ] Valgt språk beholdes etter app-restart
- [ ] Valgt språk synkes til User.language i DB
- [ ] Web: første innlogging viser språkvelger-modal
- [ ] Web: påfølgende besøk bruker lagret språk uten modal

### Fase 1: UI-oversettelse (Lag 1)

**Mål:** App og web viser UI på brukerens valgte språk

1. Sett opp `i18next` i `packages/shared/src/i18n/`
2. Ekstraher alle hardkodede norske strenger (~300 mobil, ~1600 web)
3. Lag norsk kilde-fil (`nb.json`)
4. Google Translate script: auto-oversett til alle 11 språk
5. Manuell QA av fagtermer per språk
6. Integrer `expo-localization` + `i18next` i mobil
7. Integrer `next-intl` i web
8. Språkvelger i toppbar (web) og Mer-fanen (mobil)
9. Legg til `language`-felt på User-modellen
10. API-endpoint: `bruker.oppdaterSpraak`

**Filer som endres:**
- `packages/shared/src/i18n/` (ny — delt mellom web og mobil)
- `apps/mobile/src/` — alle skjermer og komponenter (erstatt hardkodet tekst)
- `apps/web/src/` — alle sider og komponenter (erstatt hardkodet tekst)
- `packages/db/prisma/schema.prisma` — `language` på User
- `apps/mobile/app/(tabs)/mer.tsx` — språkvelger
- `apps/web/src/components/layout/Toppbar.tsx` — språkvelger dropdown

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

### Fase 4: Automatisk fritekst-oversettelse (Lag 3)

**Mål:** Brukergenerert innhold oversettes automatisk. Ukrainsk bruker skriver på ukrainsk, norsk sjef leser på norsk, utskrift leveres på prosjektets standardspråk.

#### Komplett scenario

```
Oleksandr (ukrainsk, mobil) fyller ut sjekkliste:
  Trafikklys: 🟡 → velger "Anmerkning" (vises som "Зауваження" på ukrainsk)
  Fritekst:   "Тріщина у фундаментній стіні, ширина ~2мм"
  Bilde:      Tar foto av sprekken
  Signatur:   Signerer
  → Lagres:   data.trafikklys = "Anmerkning" (norsk nøkkel)
              data.fritekst = "Тріщина у фундаментній стіні, ширина ~2мм"
              data.fritekst_lang = "uk"
                    ↓
  → Server (automatisk, fire-and-forget):
    TranslationService.oversettOgCache({
      tekst: "Тріщина у фундаментній стіні, ширина ~2мм",
      fraSpraak: "uk",   // fra User.language
      tilSpraak: ["nb"], // prosjektets standardspråk (alltid)
    })
    → Google Translate: "Sprekk i grunnmuren, bredde ~2mm"
    → Lagres i ContentTranslation-tabell
                    ↓
Kjetil (norsk, PC) åpner samme sjekkliste:
  → API: hent data + oversettelser for brukerens språk (nb)
  → Trafikklys: "Anmerkning" (norsk nøkkel → vises direkte)
  → Fritekst: slå opp ContentTranslation(hash, "nb")
    → Cache hit: "Sprekk i grunnmuren, bredde ~2mm"
  → Vises med markering: "Sprekk i grunnmuren, bredde ~2mm"
                          ⓘ Oversatt fra ukrainsk
  → Kjetil kan klikke ⓘ for å se original: "Тріщина у..."
  → Kjetil kan korrigere oversettelsen manuelt
                    ↓
Utskrift (prosjektspråk: norsk):
  → Alle etiketter på norsk (fra mal-oversettelse)
  → Valgverdier på norsk (norsk nøkkel)
  → Fritekst: norsk oversettelse fra cache
  → Fotnote: "Originalspråk: ukrainsk" (valgfri innstilling)
```

#### Database

```prisma
model ContentTranslation {
  id             String   @id @default(cuid())
  sourceHash     String   // SHA-256 av originaltekst (for cache-oppslag)
  sourceLang     String   // "uk" (fra User.language)
  targetLang     String   // "nb"
  sourceText     String   // Originaltekst (ukrainsk)
  translatedText String   // Oversatt tekst (norsk)
  provider       String   // "google" | "deepl" | "claude" | "manual"
  isManual       Boolean  @default(false) // Manuelt korrigert av bruker
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([sourceHash, targetLang])
  @@index([sourceHash])
  @@map("content_translations")
}
```

**Viktig:** `sourceHash` er SHA-256 av kildeteksten. Identisk tekst = samme hash = ingen ny oversettelse. Cache-hit er <5ms (indeksert oppslag).

#### TranslationService — dynamisk provider

```typescript
// apps/api/src/services/oversettelse.ts

interface TranslationProvider {
  navn: string;
  oversett(tekster: string[], fra: string, til: string): Promise<string[]>;
}

class GoogleTranslateProvider implements TranslationProvider {
  navn = "google";
  async oversett(tekster: string[], fra: string, til: string): Promise<string[]> {
    // google-translate-api-x (gratis, uoffisiell)
    const translate = (await import("google-translate-api-x")).default;
    const resultater = await translate(tekster, { from: fra, to: til });
    return Array.isArray(resultater)
      ? resultater.map(r => r.text)
      : [resultater.text];
  }
}

class DeepLProvider implements TranslationProvider { ... }
class ClaudeProvider implements TranslationProvider { ... }

class TranslationService {
  private provider: TranslationProvider;
  private prisma: PrismaClient;

  async oversett(tekst: string, fra: string, til: string): Promise<string> {
    if (fra === til) return tekst;

    // 1. Cache-sjekk
    const hash = sha256(tekst);
    const cachet = await this.prisma.contentTranslation.findUnique({
      where: { sourceHash_targetLang: { sourceHash: hash, targetLang: til } },
    });
    if (cachet) return cachet.translatedText;

    // 2. Oversett
    const [oversatt] = await this.provider.oversett([tekst], fra, til);

    // 3. Cache
    await this.prisma.contentTranslation.create({
      data: {
        sourceHash: hash,
        sourceLang: fra,
        targetLang: til,
        sourceText: tekst,
        translatedText: oversatt,
        provider: this.provider.navn,
      },
    });

    return oversatt;
  }

  async oversettBatch(
    felter: Array<{ nøkkel: string; tekst: string }>,
    fra: string,
    til: string,
  ): Promise<Record<string, string>> {
    if (fra === til) {
      return Object.fromEntries(felter.map(f => [f.nøkkel, f.tekst]));
    }

    // 1. Sjekk cache for alle
    const hashes = felter.map(f => ({ ...f, hash: sha256(f.tekst) }));
    const cachet = await this.prisma.contentTranslation.findMany({
      where: {
        sourceHash: { in: hashes.map(h => h.hash) },
        targetLang: til,
      },
    });
    const cacheMap = new Map(cachet.map(c => [c.sourceHash, c.translatedText]));

    // 2. Finn manglende
    const manglende = hashes.filter(h => !cacheMap.has(h.hash));

    // 3. Oversett manglende i batch
    if (manglende.length > 0) {
      const oversatte = await this.provider.oversett(
        manglende.map(m => m.tekst), fra, til,
      );
      // Cache alle nye
      await this.prisma.contentTranslation.createMany({
        data: manglende.map((m, i) => ({
          sourceHash: m.hash,
          sourceLang: fra,
          targetLang: til,
          sourceText: m.tekst,
          translatedText: oversatte[i],
          provider: this.provider.navn,
        })),
        skipDuplicates: true,
      });
      manglende.forEach((m, i) => cacheMap.set(m.hash, oversatte[i]));
    }

    // 4. Returner alle
    return Object.fromEntries(
      hashes.map(h => [h.nøkkel, cacheMap.get(h.hash) ?? h.tekst]),
    );
  }
}
```

#### Dataflyt ved lagring (sjekkliste/oppgave)

```
Mobil → API: sjekkliste.oppdater({
  id: "...",
  data: { "felt_abc": "Тріщина у фундаментній стіні" },
})
    ↓
API (sjekkliste.oppdater):
  1. Lagre data som vanlig (original ukrainsk tekst i data JSON)
  2. Fire-and-forget: oversett fritekstfelt til prosjektspråk
     oversettService.oversettBatch(
       fritekstFelter,     // kun text_field-typer med ny verdi
       bruker.language,    // "uk"
       prosjekt.defaultLanguage, // "nb"
     )
  3. Returner suksess umiddelbart (ikke vent på oversettelse)
```

#### Dataflyt ved lesing

```
API: sjekkliste.hentMedId({ id, språk: "nb" })
    ↓
  1. Hent sjekkliste med data JSON
  2. Finn alle fritekstfelt i data
  3. For hvert felt med tekst på annet språk:
     - Beregn hash
     - Batch-oppslag i ContentTranslation
  4. Returner:
     {
       data: { "felt_abc": "Тріщина у фундаментній стіні" },  // original
       oversettelser: {
         "felt_abc": {
           tekst: "Sprekk i grunnmuren, bredde ~2mm",
           fraSpraak: "uk",
           provider: "google",
           erManuell: false,
         }
       }
     }
  5. UI viser oversatt tekst + "ⓘ Oversatt fra ukrainsk"
```

#### Manuell korrigering

```
Kjetil (norsk) ser dårlig oversettelse → klikker "Rediger oversettelse"
    ↓
Modal: viser original (ukrainsk) + oversettelse (norsk) side om side
    ↓
Kjetil korrigerer → lagre
    ↓
API: oversett.korrigerOversettelse({
  sourceHash: "abc123",
  targetLang: "nb",
  korrigertTekst: "Sprekk i grunnmur, bredde ca. 2 mm",
})
    ↓
ContentTranslation oppdateres:
  translatedText = korrigert tekst
  isManual = true
  provider = "manual"
    ↓
Neste gang noen ser denne teksten → cache hit med manuell oversettelse
```

#### tRPC-router

```typescript
// apps/api/src/routes/oversett.ts

export const oversettRouter = router({
  // Oversett enkeltfelt (brukes av web-klient for inline-oversettelse)
  tekst: protectedProcedure
    .input(z.object({
      tekst: z.string(),
      fraSpraak: z.string(),
      tilSpraak: z.string(),
    }))
    .query(/* ... */),

  // Oversett alle fritekstfelt i en sjekkliste/oppgave
  batch: protectedProcedure
    .input(z.object({
      felter: z.array(z.object({ nøkkel: z.string(), tekst: z.string() })),
      fraSpraak: z.string(),
      tilSpraak: z.string(),
    }))
    .query(/* ... */),

  // Hent cached oversettelser for en liste med hashes
  hentCachet: protectedProcedure
    .input(z.object({
      hashes: z.array(z.string()),
      tilSpraak: z.string(),
    }))
    .query(/* ... */),

  // Manuell korrigering av oversettelse
  korriger: protectedProcedure
    .input(z.object({
      sourceHash: z.string(),
      targetLang: z.string(),
      korrigertTekst: z.string(),
    }))
    .mutation(/* ... */),
});
```

#### Utskrift

```
Print-rute: /api/print/sjekkliste/[id]
    ↓
  1. Hent sjekkliste med data
  2. Hent mal med oversettelser for prosjektspråk (Lag 2)
  3. Hent fritekst-oversettelser fra ContentTranslation (Lag 3)
  4. Generer PDF:
     - Etiketter: prosjektspråk (norsk)
     - Valgverdier: norsk (lagret som nøkkel)
     - Fritekst: norsk oversettelse fra cache
     - Valgfri fotnote: "Original: ukrainsk"
  5. Byggherre mottar norsk dokumentasjon ✓
```

#### Offline-håndtering (mobil)

```
Oleksandr er offline og fyller ut sjekkliste:
  → Tekst lagres i SQLite med spraak = "uk"
  → Synk-kø: markert for oversettelse
  → Vises på hans enhet: ukrainsk original (alltid tilgjengelig)
    ↓
Oleksandr kommer online:
  → Synk sender data til server
  → Server oversetter fritekst → cacher i ContentTranslation
  → Neste synk: mobil henter oversettelser for lokal cache
    ↓
Kjetil (online) ser oversatt tekst umiddelbart etter synk
```

**SQLite-cache på mobil:**
```sql
CREATE TABLE content_translation_cache (
  source_hash TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  synced_at TEXT NOT NULL,
  PRIMARY KEY (source_hash, target_lang)
);
```

Ved åpning av sjekkliste/oppgave:
1. Sjekk lokal cache først → instant visning
2. Hent oppdateringer fra server i bakgrunnen
3. Oppdater cache + UI ved nye oversettelser

#### Kostnadsestimat

| Provider | Per sjekkliste (~2000 tegn) | 100 sjekklister/mnd | 1000/mnd |
|----------|---------------------------|---------------------|----------|
| Google Translate (uoffisiell) | $0 | $0 | $0 |
| Google Cloud Translation | $0.04 | $4 | $40 |
| DeepL Pro | $0.05 | $5 | $50 |

**Med cache:** Identisk tekst oversettes kun én gang. "Godkjent" oversettes til ukrainsk én gang — brukes for alle sjekklister. Typisk cache-hit rate: 60-80% etter første måned.

**Anbefaling:** Start med `google-translate-api-x` (gratis). Bytt til Google Cloud/DeepL ved behov.

#### Testing — fase 4

**Enhetstester:**
- [ ] `TranslationService.oversett()` returnerer korrekt oversettelse
- [ ] Cache-hit returnerer lagret tekst uten API-kall
- [ ] Batch-oversettelse: noen fra cache, resten via API
- [ ] Manuell korrigering overskriver maskinoversettelse
- [ ] SHA-256 hash er deterministisk for identisk tekst
- [ ] Provider-bytte (Google → DeepL) fungerer uten datamigrasjon

**Integrasjonstester:**
- [ ] Ukrainsk bruker lagrer fritekst → oversettelse opprettes i ContentTranslation
- [ ] Norsk bruker åpner samme sjekkliste → ser norsk oversettelse
- [ ] Litauisk bruker åpner → trigger ny oversettelse (uk→lt)
- [ ] Utskrift inneholder norsk tekst (prosjektspråk)
- [ ] Offline: original tekst vises → oversettelse dukker opp etter synk

**E2E-tester (manuell):**
- [ ] Opprett sjekkliste som ukrainsk bruker på mobil (offline)
- [ ] Synk → verifiser at oversettelse opprettes
- [ ] Åpne som norsk bruker på PC → les norsk versjon
- [ ] Korrigere oversettelse manuelt → verifiser at endringen lagres
- [ ] Skriv ut → verifiser norsk PDF
- [ ] Bytt provider (Google → DeepL) → nye oversettelser bruker ny provider
- [ ] Eksisterende cache beholdes uendret

**Ytelsestester:**
- [ ] Batch-oversettelse av 10 felt < 2 sekunder
- [ ] Cache-oppslag for 50 felt < 50ms
- [ ] Ingen merkbar forsinkelse ved åpning av sjekkliste med oversettelser

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

## Kjente kanttilfeller

### 1. Cache-invalidering ved redigering
Bruker endrer sin fritekst → gammel oversettelse er utdatert.
**Løsning:** Ved oppdatering av fritekstfelt — slett `ContentTranslation` der `sourceHash` matcher gammel tekst, generer ny oversettelse for ny tekst. Hash endres automatisk siden teksten endres.

### 2. Kommentarer (task_comments)
Kommentarer er en separat tabell med fritekst. Må også oversettes.
**Løsning:** Samme `ContentTranslation`-mekanisme. Ved henting av kommentarer — batch-oppslag av oversettelser basert på leserens språk.

### 3. Emne-feltet (subjects)
Brukeren skriver emne som fritekst ved opprettelse av sjekkliste/oppgave.
**Løsning:** Oversettes som fritekst (Lag 3). Predefinerte emner fra malen oversettes som mal-innhold (Lag 2).

### 4. E-postvarsler
Når sjekkliste sendes → e-post til mottaker.
**Løsning:** E-post sendes på **mottakerens språk** (`User.language`). E-postmaler oversettes som UI-tekst (Lag 1). Innhold (emne, kommentar) oversettes via `ContentTranslation`.

### 5. Språkdeteksjon vs brukerinnstilling
Bruker kan skrive på annet språk enn sin innstilling (f.eks. norsk bruker skriver på engelsk).
**Løsning:** Lagre `sourceLang` basert på `User.language`. Hvis oversettelse gir dårlig resultat — manuell korrigering. Fremtidig: auto-detect via Google Translate API.

### 6. Rammeverk-valg: i18next vs next-intl
Mobil bruker `i18next` (standard for React Native). Web kan bruke enten `next-intl` eller `react-i18next`.
**Beslutning:** Bruk `i18next` + `react-i18next` for **begge** plattformer. Samme JSON-filer i `packages/shared/src/i18n/`. `next-intl` er unødvendig kompleksitet når vi ikke bruker locale-basert ruting.

## Risiko

| Risiko | Mitigering |
|--------|------------|
| AI-oversettelser har feil fagterminologi | Admin kan redigere mal-oversettelser + manuell korrigering av fritekst |
| ~1900 UI-nøkler å ekstrahere (300 mobil + 1600 web) | Systematisk gjennomgang. Norsk fallback for manglende nøkler |
| Ytelse: ekstra DB-query per mal for oversettelser | Eager-load oversettelser med mal, cache i React Query |
| Offline: oversettelser må caches lokalt | SQLite-tabell for oversettelser, synkes ved oppstart |
| Verdier lagret som norsk nøkkel — hva om etikett endres? | Bruk `value`-felt (ikke label) som nøkkel for opsjoner |
| Fritekst-oversettelseskostnad ved høyt volum | Cache eliminerer duplikater. Google gratis-tier dekker de fleste |
| Google Translate uoffisiell API blokkeres | Bytt til offisiell Google Cloud ($20/M tegn) eller DeepL |
| Oversettelseskvalitet varierer per språk | Grundigere QA for fagtermer. Manuell korrigering tilgjengelig |
| Latens ved fritekst-oversettelse | Fire-and-forget ved lagring. Batch cache-oppslag ved lesing (<5ms) |
| Offline fritekst fra andre brukere | Vis original + "Oversettelse tilgjengelig når du er på nett" |
| Bruker redigerer fritekst → gammel oversettelse utdatert | Ny hash = ny oversettelse. Gammel cache irrelevant (ingen referanse) |
| E-post på feil språk | Send på mottakerens `User.language`, ikke avsenderens |
