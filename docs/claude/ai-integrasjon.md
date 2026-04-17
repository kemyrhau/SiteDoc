# AI-integrasjon — Copilot, MCP og innebygd assistent

## Visjon

SiteDoc eksponerer et AI-vennlig API-lag som lar eksterne AI-assistenter (Microsoft Copilot, Claude via MCP) og en fremtidig innebygd assistent utføre konkrete handlinger i prosjekter — opprett kontrollplan, importer maler, sett frister, generer rapporter.

AI-en er et **verktøy** — aldri ansvarlig kontrollerende. Brukeren verifiserer og godkjenner.

## Tre integrasjonsnivåer

### Nivå 1: MCP + Copilot (prioritert)

Mange norske byggefirmaer bruker Microsoft 365 Copilot. SiteDoc eksponerer handlinger som Copilot og Claude kan kalle direkte.

```
Bruker i Copilot/Claude:
  "Opprett kontrollplan for fuktsikring av 12 bad i 3. etasje"

AI → SiteDoc Plugin/MCP → REST API → utfører handlinger

AI svarer:
  "Opprettet 12 kontrollplanpunkter for membran i bad 301-312.
   Frister satt til uke 18-22. Faggruppe: VVS-Rør AS.
   Vil du justere noe?"
```

**Teknisk:**
- REST API-lag (`/api/v1/ai/`) med OpenAPI-spec
- OAuth2-autentisering (firmaets bruker logger inn)
- Copilot: registrer som API Plugin via Copilot Studio
- Claude: registrer som MCP Server
- Samme API-lag fungerer for begge — bygges én gang

### Nivå 2: Innebygd AI-assistent i SiteDoc

Chatbot i SiteDoc-grensesnittet som har kontekst om prosjektet og kan utføre handlinger direkte.

```
┌─────────────────────────────────────────────┐
│  Kontrollplan — NRK Bjørvika                │
│                                             │
│  [matrise med områder × maler]              │
│                                             │
│  ┌─ AI-assistent ─────────────────────────┐ │
│  │ 💬 Hjelp meg med å sette opp           │ │
│  │    fuktsikring for alle bad i 2. etg   │ │
│  │                                        │ │
│  │ 🤖 Jeg finner 8 bad i 2. etasje.      │ │
│  │    Foreslår: Membran-sjekkliste fra     │ │
│  │    NS 3420-GU, frist uke 18-20,        │ │
│  │    faggruppe VVS-Rør AS.               │ │
│  │    [Godkjenn] [Juster] [Avbryt]        │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

**Fordel:** Full kontroll over opplevelsen. Premium-feature. Ingen ekstern avhengighet.

**Teknisk:** Kaller samme interne API-er som UI-et. Prompten har kontekst om prosjektets maler, områder, faggrupper og NS-standarder.

### Nivå 3: Kunnskapsbase (enklest)

AI gir råd og veiledning basert på dokumentasjon (hjelpetekster, NS-referanser, kontrollplan-guider) men utfører ingen handlinger. Brukeren gjør alt manuelt.

**Fordel:** Null risiko. **Ulempe:** Minst nyttig.

## AI-handlinger (hva AI-en kan gjøre)

### Tillatte handlinger

| Handling | Beskrivelse | Bekreftelse |
|----------|-------------|-------------|
| Les prosjektdata | Hent sjekklister, maler, områder, kontrollplan | Nei — leseoperasjon |
| Importer fra bibliotek | Hent NS 3420-maler inn i prosjekt | Ja — vis hva som importeres |
| Opprett område | Nytt område med navn, type, byggeplass | Ja — vis detaljer |
| Opprett kontrollplanpunkt | Koble mal + område + frist + faggruppe | Ja — vis matrise-endring |
| Oppdater frister | Enkelt eller bulk fristendring | Ja — vis før/etter |
| Generer rapport | Sluttrapport per kontrollområde | Nei — leseoperasjon |
| Foreslå maler | Basert på prosjekttype og kontrollområde | Nei — kun forslag |

### Blokkerte handlinger

| Handling | Grunn |
|----------|-------|
| Slett data | Destruktivt — kun via UI med bekreftelse |
| Endre tilgangskontroll | Sikkerhetsrisiko |
| Kryss-prosjekt tilgang | Prosjektisolering |
| Godkjenn sjekklister | Juridisk ansvar — kun mennesker godkjenner |
| Endre dokumentflyt | Konfigurasjon — kun prosjektadmin via UI |
| Eksporter brukerdata | Personvern |

### Bekreftelsesflyt

Alle skriveoperasjoner krever brukerbekreftelse:

```
AI foreslår → Bruker ser forhåndsvisning → [Godkjenn] / [Avbryt]
```

Aldri direkte utførelse uten at brukeren ser hva som skjer.

## API-lag for AI-integrasjon

### Endepunkter (`/api/v1/ai/`)

```
GET  /api/v1/ai/prosjekt/:id/kontrollplan     — Hent kontrollplan med punkter
GET  /api/v1/ai/prosjekt/:id/omrader          — Hent alle områder
GET  /api/v1/ai/prosjekt/:id/maler            — Hent tilgjengelige sjekklistemaler
GET  /api/v1/ai/prosjekt/:id/faggrupper       — Hent faggrupper
GET  /api/v1/ai/bibliotek/standarder           — Hent sjekklistebiblioteket

POST /api/v1/ai/prosjekt/:id/kontrollplan/punkt     — Opprett kontrollplanpunkt
POST /api/v1/ai/prosjekt/:id/kontrollplan/bulk       — Opprett flere punkter
POST /api/v1/ai/prosjekt/:id/omrade                  — Opprett område
POST /api/v1/ai/prosjekt/:id/bibliotek/importer      — Importer mal fra bibliotek

PUT  /api/v1/ai/kontrollplan/punkt/:id/frist         — Oppdater frist
PUT  /api/v1/ai/kontrollplan/bulk-frist               — Bulk fristendring

GET  /api/v1/ai/prosjekt/:id/rapport/:kontrollomrade — Generer sluttrapport
```

### Autentisering

- OAuth2 med brukerens SiteDoc-konto
- Samme tilgangskontroll som vanlige ruter (`verifiserProsjektmedlem`, `verifiserFaggruppeTilhorighet`)
- API-nøkkel per firma for rate-limiting
- Ingen snarveier — AI-en har **nøyaktig samme rettigheter** som brukeren

### Rate-limiting

- Maks 100 skriveoperasjoner per bruker per dag
- Maks 1000 leseoperasjoner per bruker per dag
- Bulk-operasjoner teller som én operasjon

## Risikoer og tiltak

| Risiko | Sannsynlighet | Konsekvens | Tiltak |
|--------|---------------|------------|--------|
| **Data-lekkasje via AI-leverandør** | Lav | Høy | Kun metadata og strukturerte felter sendes til AI. Aldri hele dokumenter, tegninger eller kontrakter. Sensitiv prosjektdata (priser, personinfo) filtreres bort i API-laget |
| **AI hallusinerer handlinger** | Middels | Middels | Bekreftelse før alle skriveoperasjoner. Forhåndsvisning av endringer. Bruker kan alltid avbryte |
| **Tilgangs-omgåelse** | Lav | Høy | AI-API bruker nøyaktig samme tilgangskontroll som UI. Ingen egne admin-ruter. Alle kall logges |
| **Ansvar ved feil kontrollplan** | Middels | Høy | AI-generert innhold merkes med "(AI-forslag)". Prosjektleder er alltid ansvarlig for å verifisere. AI er verktøy, ikke ansvarlig kontrollerende. SAK10 ansvar ligger hos foretaket |
| **Plattformavhengighet** | Middels | Lav | Eget REST API-lag. Copilot/MCP er tynne adaptere. Hvis plattform endres, byttes adapter — ikke API |
| **Kostnad/misbruk** | Middels | Lav | Rate-limiting per bruker og prosjekt. Daglig tak på operasjoner |

### Spesiell risiko: Byggebransjen

SiteDoc brukes i prosjekter der feil kan ha alvorlige konsekvenser (brannsikring, konstruksjonssikkerhet, geoteknikk). AI-en må **aldri**:
- Godkjenne sjekklister eller kontrollplanpunkter
- Fjerne kontrollpunkter fra en plan
- Endre kontrollområde-tagging
- Opprette kontrollplan uten at bruker verifiserer innholdet

All AI-generert kontrollplan-data merkes synlig i UI og i sluttrapporter.

## Implementeringsrekkefølge

1. **REST API-lag** — `/api/v1/ai/` med OpenAPI-spec, OAuth2, rate-limiting
2. **MCP Server** — adapter som kaller REST API-et (Claude-brukere)
3. **Copilot Plugin** — adapter via Copilot Studio (Microsoft 365-brukere)
4. **Innebygd assistent** — chatbot i SiteDoc UI (premium-feature)

Steg 1 bygges én gang — steg 2-4 er tynne lag oppå.

## Merking av AI-generert innhold

| Kontekst | Merking |
|----------|---------|
| Bibliotek-maler | "(AI-utkast)" i beskrivelse |
| Kontrollplanpunkter opprettet av AI | Badge: "🤖 AI-forslag" inntil bruker godkjenner |
| Sluttrapport | Fotnote: "Kontrollplan oppsatt med AI-assistanse. Verifisert av [prosjektleder]" |
| Sjekklister | Ingen merking — sjekklisten utfylles av mennesker uansett |

## Relasjon til eksisterende AI-funksjonalitet

SiteDoc har allerede:
- **AI-søk** — embedding-basert søk i dokumenter (intfloat/multilingual-e5-base)
- **Dokumentoversettelse** — OPUS-MT + Google Translate + DeepL
- **FTD-dokumentsøk** — NS 3420-standarder indeksert og søkbare

AI-integrasjonen bygger på dette:
- AI-assistenten kan bruke FTD-søk for å finne NS-krav
- AI-assistenten kan foreslå maler basert på prosjekttype via embedding-søk
- Oversettelse av kontrollplan-innhold for flerspråklige prosjekter
