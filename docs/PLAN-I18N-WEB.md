# Plan: Flerspråklig UI — Web-app

## Mål

Alle UI-tekster i web-appen oversettes til brukerens valgte språk. Språkbytte via dropdown i toppbar. Google Translate for automatisk oversettelse med mulighet for manuell korrigering.

## Omfang

| | Antall |
|---|---|
| Unike oversettbare strenger | ~1 600 |
| Filer med hardkodet tekst | 181 |
| Språk | 12 (nb, sv, en, lt, pl, uk, ro, et, fi, cs, de, ru) |

## Teknologivalg

| Komponent | Valg | Begrunnelse |
|-----------|------|-------------|
| i18n-rammeverk | `next-intl` | Best integrasjon med Next.js 14 App Router |
| Oversettelse-API | `google-translate-api-x` (start) | Gratis, robust, 130+ språk, ingen nøkkel |
| Språklagring | `localStorage` + `User.language` i DB | Rask klient-side + persistent server-side |
| Oversettelse-fil format | JSON (`nb.json`, `en.json` etc.) | Standard for next-intl |

## Arkitektur

```
Bruker klikker "🇬🇧 English" i toppbar
    ↓
localStorage.setItem('sitedoc-language', 'en')
    ↓
next-intl IntlProvider bytter locale
    ↓
Alle t('nøkkel') oppdateres umiddelbart
    ↓
API-kall oppdaterer User.language i DB (persistent)
```

### Filstruktur

```
packages/shared/src/i18n/
├── index.ts              # Konfigurasjon, hjelpefunksjoner
├── nb.json               # Norsk bokmål (kilde, ~1600 nøkler)
├── en.json               # Engelsk
├── sv.json               # Svensk
├── ... (9 andre språk)
└── generate.ts           # Script: oversett nb.json → alle språk via Google Translate
```

### Nøkkelstruktur

```json
{
  "nav.dashboard": "Dashbord",
  "nav.checklists": "Sjekklister",
  "nav.tasks": "Oppgaver",
  "status.draft": "Utkast",
  "status.sent": "Sendt",
  "status.approved": "Godkjent",
  "action.create": "Opprett",
  "action.save": "Lagre",
  "action.delete": "Slett",
  "action.cancel": "Avbryt",
  "search.placeholder.checklists": "Søk sjekklister...",
  "error.notFound": "Ikke funnet",
  "label.firstName": "Fornavn",
  "label.lastName": "Etternavn",
  "priority.low": "Lav",
  "priority.high": "Høy"
}
```

## Faser

### Fase 1: Infrastruktur + navigasjon (dag 1-2)

**Mål:** Språkvelger fungerer, sidebar + toppbar oversatt.

1. `pnpm add next-intl` i web-pakken
2. Opprett `packages/shared/src/i18n/nb.json` med ~100 nøkler (nav, status, actions)
3. Konfigurer `next-intl` i `apps/web/src/app/layout.tsx`
4. Språkvelger-dropdown i `Toppbar.tsx` (flagg + språknavn)
5. Oversett `HovedSidebar.tsx` og `Toppbar.tsx`
6. Oversett `OppsettLayout.tsx` (innstillinger-sidebar)
7. Legg til `language` felt på User-modellen
8. API-endpoint: `bruker.oppdaterSpraak`
9. Script: `generate.ts` — oversett `nb.json` → alle språk via Google Translate

**Filer som endres:**
- `apps/web/package.json` — legg til next-intl
- `apps/web/src/app/layout.tsx` — IntlProvider wrapper
- `apps/web/src/components/layout/Toppbar.tsx` — språkvelger + t()
- `apps/web/src/components/layout/HovedSidebar.tsx` — t()
- `apps/web/src/app/dashbord/oppsett/layout.tsx` — t()
- `packages/shared/src/i18n/` — ny mappe med JSON-filer
- `packages/db/prisma/schema.prisma` — language på User

**Testing:**
- [ ] Språkvelger vises i toppbar
- [ ] Bytte til engelsk → sidebar viser "Checklists", "Tasks" etc.
- [ ] Bytte tilbake til norsk → alt er norsk igjen
- [ ] Refresh beholder valgt språk (localStorage)
- [ ] Ny innlogging henter språk fra User.language

### Fase 2: Statuser + handlinger + tabeller (dag 3-4)

**Mål:** Alle statuser, knapper og tabellhoder er oversatt.

1. Flytt status-labels fra hardkodet til i18n (~38 nøkler)
2. Flytt action-buttons til i18n (~30 mest brukte)
3. Flytt tabellhoder til i18n (~50 nøkler)
4. Flytt søke-placeholders til i18n (~12 nøkler)
5. Oppdater `StatusHandlinger.tsx`, `StatusBadge` etc.

**Filer som endres:**
- `apps/web/src/app/dashbord/[prosjektId]/oppgaver/page.tsx`
- `apps/web/src/app/dashbord/[prosjektId]/sjekklister/page.tsx`
- `apps/web/src/components/StatusHandlinger.tsx`
- `apps/web/src/components/paneler/*.tsx`
- Diverse sider med action-knapper

**Testing:**
- [ ] Statusbadger viser riktig språk
- [ ] "Opprett sjekkliste"-knapp → "Create checklist" på engelsk
- [ ] Tabellhoder oversettes
- [ ] Søkefelt-placeholder oversettes
- [ ] Statusfiltre i sidepanel oversettes

### Fase 3: Skjemaer + feilmeldinger + tooltips (dag 5-6)

**Mål:** Alle form-labels, validering og feilmeldinger er oversatt.

1. Form-labels og placeholders (~200 nøkler)
2. Feilmeldinger og valideringsstekster (~100 nøkler)
3. Tooltips og title-attributter (~100 nøkler)
4. Modale dialoger (bekreftelser, varsler)

**Filer som endres:**
- Alle sider under `oppsett/`
- Alle modale komponenter
- Skjema-komponenter

**Testing:**
- [ ] Opprett-dialoger viser riktig språk
- [ ] Feilmeldinger (f.eks. "Påkrevd felt") oversettes
- [ ] Bekreftelsesdialoger ("Er du sikker?") oversettes
- [ ] Tooltips ved hover viser riktig språk

### Fase 4: Resterende sider + QA (dag 7-8)

**Mål:** Alt oversatt, kvalitetssikret.

1. Landingsside (`page.tsx`)
2. Spesialsider (3D-visning, økonomi, dokumentsøk)
3. Sjekk alle sider systematisk
4. Korrigere maskinoversettelser (spesielt fagtermer)
5. Legge til manglende nøkler

**Testing:**
- [ ] Naviger gjennom ALLE sider på engelsk — ingen norsk tekst synlig
- [ ] Naviger gjennom ALLE sider på polsk — ingen norsk tekst synlig
- [ ] Fagtermer er korrekte (sjekkliste ≠ checklist i alle kontekster)
- [ ] Datoformat følger locale (nb: 01.04.2026, en: 4/1/2026)
- [ ] Tallformat følger locale (nb: 1 234,56, en: 1,234.56)

## Oversettelsesscript

```typescript
// packages/shared/src/i18n/generate.ts
// Kjøres: npx tsx packages/shared/src/i18n/generate.ts

import nb from './nb.json';
import translate from 'google-translate-api-x';

const SPRAAK = ['en', 'sv', 'lt', 'pl', 'uk', 'ro', 'et', 'fi', 'cs', 'de', 'ru'];

async function generer() {
  for (const lang of SPRAAK) {
    const resultat: Record<string, string> = {};
    const nøkler = Object.entries(nb);

    // Batch à 50 for å unngå rate-limiting
    for (let i = 0; i < nøkler.length; i += 50) {
      const batch = nøkler.slice(i, i + 50);
      const tekster = batch.map(([_, v]) => v);

      const oversatt = await translate(tekster, { from: 'no', to: lang });

      batch.forEach(([key], j) => {
        resultat[key] = oversatt[j].text;
      });

      // Vent 1s mellom batcher
      await new Promise(r => setTimeout(r, 1000));
    }

    // Skriv til fil
    writeFileSync(`./packages/shared/src/i18n/${lang}.json`, JSON.stringify(resultat, null, 2));
    console.log(`${lang}: ${Object.keys(resultat).length} nøkler oversatt`);
  }
}
```

## Manuell QA-sjekkliste per språk

Etter maskinoversettelse — sjekk disse fagtermer:

| Norsk | Korrekt engelsk | Vanlig feil |
|-------|----------------|-------------|
| Sjekkliste | Checklist | Check list |
| Oppgave | Task / Issue | Assignment |
| Entreprise | Trade contractor | Enterprise |
| Anmerkning | Remark | Annotation |
| Avvik | Non-conformance / Deviation | Deviation (ok) |
| Byggherre | Client / Owner | Builder |
| Arbeidsforløp | Workflow | Work sequence |
| Feltarbeid | Field work | Field labor |
| Maler | Templates | Paintings |
| Fagområde | Discipline / Domain | Subject area |

## Risiko og mitigering

| Risiko | Mitigering |
|--------|------------|
| Google Translate gir feil fagtermer | Manuell QA-runde per språk, korrigere JSON |
| Rate-limiting på uoffisiell Google API | Batch + delay, bytt til offisiell API ved behov |
| Noen strenger er dynamisk konstruert | Bruk interpolering: `t('greeting', { name })` |
| next-intl + App Router kompleksitet | Start enkelt med klient-side provider, unngå ruting per locale |
| Ytelse: 1600 strenger i minnet | JSON er ~50 KB per språk — ubetydelig |
| Eksisterende data (statusverdier i DB) | Verdier lagres alltid på norsk, oversettes ved visning |

## Viktige designbeslutninger

1. **Ingen ruting per locale** — bruker `/dashbord`, ikke `/en/dashbord`. Språk styres av klient-side provider.
2. **Norsk er alltid kilden** — alle oversettelser genereres fra `nb.json`
3. **DB-verdier er språknøytrale** — statusverdier som "draft", "approved" lagres som engelske nøkler, oversettes ved visning via status-map
4. **Gradvis migrering** — ikke alt må oversettes samtidig. Norsk fallback for manglende nøkler.
5. **Shared package** — i18n-filer i `packages/shared` slik at mobil kan gjenbruke samme oversettelser
