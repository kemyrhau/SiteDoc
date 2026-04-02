# Plan: Flerspråklig støtte — Videre utvikling

## Status per april 2026

### Ferdig (Fase 0 + 1 delvis)

| Komponent | Status |
|-----------|--------|
| Prisma: `User.language` felt | ✅ |
| i18next + react-i18next i web | ✅ |
| SpraakVelger i toppbar (13 språk med flagg) | ✅ |
| API: `bruker.hentSpraak` / `oppdaterSpraak` | ✅ |
| localStorage + DB-synkronisering | ✅ |
| `nb.json` + `en.json` (~500 nøkler) | ✅ |
| StatusBadge med automatisk oversettelse | ✅ |
| Alle hovedsider oversatt til i18n (web) | ✅ |
| `generate.ts` script for auto-oversettelse | ✅ (ikke kjørt ennå) |

### Gjenstår

## Steg 1: Generer de 11 gjenværende språkene (1 time)

Kjør oversettelsesscriptet for å generere sv, lt, pl, uk, ro, et, fi, cs, de, ru, lv fra nb.json.

```bash
pnpm add -D google-translate-api-x --filter @sitedoc/shared
npx tsx packages/shared/src/i18n/generate.ts
```

Etter generering: importer alle språkfiler statisk i `apps/web/src/lib/i18n.ts`:
```typescript
import sv from "@sitedoc/shared/src/i18n/sv.json";
import lt from "@sitedoc/shared/src/i18n/lt.json";
// ... etc
```

Alternativt: bygg en dynamisk import-mekanisme som laster via API.

**Testing:** Bytt til polsk/ukrainsk i SpraakVelger → verifiser at navigasjon, statusbadger og sideinnhold vises riktig.

## Steg 2: Manuell QA av fagtermer (2-3 timer)

Google Translate gir feil for byggfagtermer. Sjekk og korriger:

| Norsk | Korrekt engelsk | Vanlig feil |
|-------|----------------|-------------|
| Sjekkliste | Checklist | Check list |
| Entreprise | Trade contractor | Enterprise |
| Anmerkning | Remark | Annotation |
| Avvik | Non-conformance | Deviation |
| Byggherre | Client / Owner | Builder |
| Fagområde | Discipline | Subject area |
| Maler | Templates | Paintings |

Gjør dette for hvert språk — spesielt polsk, litauisk og ukrainsk.

## Steg 3: Oversett gjenværende web-strenger (2-4 timer)

Noen dype under-sider har fortsatt hardkodede strenger:
- Sjekkliste-detaljside (utfylling, statushandlinger, print)
- Oppgave-detaljside
- Dokumentflyt-komponenter (OPPRETT/SEND header i kortvisning, "Legg til"-dropdown med ENTREPRISER/GRUPPER/PERSONER)
- BetingelseBjelke (trigger-verdier UI)
- Prosjektoppsett: Adresse-label, Beskrivelse-placeholder, rapportinnstillinger checkboxer
- Firmainnstillinger-side

## Steg 4: Mobil i18n (1-2 dager)

Mobil-appen har ca. 300 hardkodede strenger. Plan:

1. `pnpm add i18next react-i18next --filter @sitedoc/mobile`
2. Initialiser i18next i `apps/mobile/src/providers/I18nProvider.tsx`
3. Hent brukerens språk fra `expo-localization` (førstegangvalg)
4. Språkvelger i "Mer"-fanen
5. Oversett alle skjermer systematisk (ca. 20 filer)
6. Gjenbruk `packages/shared/src/i18n/*.json` — samme nøkler som web

**Viktig:** Mobil bruker allerede `@sitedoc/shared` — i18n-filene er tilgjengelige uten ekstra konfigurasjon.

## Steg 5: Fase 0 — Førstegangsvalg (0.5 dag)

**Web:** Modal ved første innlogging hvis `User.language` ikke er satt:
- Sjekk `navigator.language` for å foreslå
- Vis modal med alle 13 språk og flagg
- Lagre valg → localStorage + API

**Mobil:** Velkomstskjerm ved første åpning:
- Bruk `expo-localization.getLocales()` for å detektere enhetsspråk
- Vis velkomstskjerm på detektert språk
- Bruker bekrefter eller endrer

## Steg 6: Mal-oversettelse — Lag 2 (2-3 dager)

Maler lages på norsk. Når en polsk bruker åpner sjekklisten, skal feltlabels vises på polsk.

### Database

```prisma
model ReportObjectTranslation {
  id              String @id @default(cuid())
  reportObjectId  String
  language        String
  label           String
  options         Json?
  reportObject    ReportObject @relation(fields: [reportObjectId], references: [id], onDelete: Cascade)
  @@unique([reportObjectId, language])
}

model ReportTemplateTranslation {
  id              String @id @default(cuid())
  templateId      String
  language        String
  name            String
  description     String?
  subjects        Json?
  template        ReportTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  @@unique([templateId, language])
}
```

### API-endringer

- `mal.hentMedId({ id, language })` — returner oversatte labels
- `mal.oversettMal({ id, language })` — generer oversettelse via Google Translate/DeepL
- `mal.oppdaterOversettelse({ id, language, ... })` — manuell korrigering

### UI — Malbygger

- "Oversett mal"-knapp i malbygger-verktøylinjen
- Språk-dropdown: velg målspråk
- Vis oversatt label ved siden av norsk i konfigurasjonspanelet
- Redigerbar — admin kan korrigere feil

### Mobil + Web utfylling

- Sjekkliste/oppgave-skjema henter oversatte labels
- Fallback til norsk hvis oversettelse mangler

## Steg 7: Fritekst-oversettelse — Lag 3 (3-5 dager)

Mest komplekst. Bruker skriver på sitt språk, andre ser oversatt.

### TranslationService

```typescript
class TranslationService {
  providers: TranslationProvider[]; // google → deepl → claude

  async oversett(tekst: string, fra: string, til: string): Promise<string> {
    const hash = sha256(tekst + til);
    const cached = await prisma.contentTranslation.findUnique({ where: { sourceHash_targetLang: { sourceHash: hash, targetLang: til } } });
    if (cached) return cached.translatedText;

    const oversatt = await this.providers[0].oversett([tekst], fra, til);
    await prisma.contentTranslation.create({ data: { sourceHash: hash, sourceLang: fra, targetLang: til, sourceText: tekst, translatedText: oversatt[0], provider: this.providers[0].navn } });
    return oversatt[0];
  }
}
```

### Segmentert oversettelse (blandet språk)

Byggebransjen har tekster med norske fagtermer blandet inn i andre språk. Løsning:
1. Detekter segmenter med språk-mix
2. Beskytt NS-koder, produktnavn, mål med `{{placeholder}}`
3. Oversett resten
4. Sett tilbake beskyttede segmenter

### Dataflyt

```
Polsk bruker skriver: "Pęknięcie w ścianie"
  → Lagres som original (polsk) i DB
  → TranslationService oversetter til norsk + andre aktive språk
  → Caches i ContentTranslation
  → Norsk bruker ser: "Sprekk i veggen"
  → Litauisk bruker ser: "Sienos įtrūkimas"
```

## Steg 8: Prosjektspråk og print (0.5 dag)

- `Project.defaultLanguage` felt i Prisma
- Språkvelger i prosjektinnstillinger
- Print-ruter bruker prosjektspråk (ikke brukerens)
- Fritekst-felt: oversettes til prosjektspråk ved print

## Prioritert rekkefølge

| # | Steg | Tid | Avhengigheter |
|---|------|-----|---------------|
| 1 | Generer 11 språk + statisk import | 1t | Ingen |
| 2 | QA av fagtermer | 2-3t | Steg 1 |
| 3 | Gjenværende web-strenger | 2-4t | Ingen |
| 4 | Mobil i18n | 1-2d | Steg 1 |
| 5 | Førstegangsvalg (web + mobil) | 0.5d | Steg 4 |
| 6 | Mal-oversettelse (Lag 2) | 2-3d | Steg 1 |
| 7 | Fritekst-oversettelse (Lag 3) | 3-5d | Steg 6 |
| 8 | Prosjektspråk + print | 0.5d | Steg 6 |

**Total estimert tid:** 10-15 arbeidsdager for komplett flerspråkstøtte.

**Anbefalt startrekkefølge:** 1 → 2 → 3 → 4 (parallelt med 6) → 5 → 7 → 8
