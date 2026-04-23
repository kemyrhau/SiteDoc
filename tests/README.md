# Tester via Claude Code + chrome-devtools MCP

Denne mappen inneholder fixtures og dokumentasjon for manuelle/semi-automatiserte tester som kjøres via Claude Code med chrome-devtools MCP.

## Oppsett (én gang)

1. **Verifiser at `.mcp.json` i prosjektrot er aktiv.**
   Første gang du åpner prosjektet i Claude Code etter at `.mcp.json` ble opprettet, vil Claude spørre om tillatelse til å starte `chrome-devtools`-serveren. Godkjenn den.

2. **Sjekk at MCP er aktiv** — i Claude Code, kjør `/mcp` og bekreft at `chrome-devtools` står som "connected".

3. **Chrome må være åpen og innlogget på test.sitedoc.no.**
   chrome-devtools MCP bruker din kjørende Chrome-instans (ikke-isolert modus er satt i `.mcp.json`), så sessions og cookies deles.

## Kjøre tester

I Claude Code-prompt:

- `/test-import-veiviser` — Kjører ende-til-ende-test av MS Project XML-importen. Tester spesielt de nye forbedringene i steg 2 (inline «Opprett som faggruppe», bulk-opprettelse, alltid synlig standard-faggruppe).

- `/test-sluttrapport` — Verifiserer at sluttrapport-PDF-en bruker korrekt «Returnert»-terminologi (ikke «Avvik»), har punkt-liste øverst, dd.MM.yyyy-datoformat og ingen lekket CSS.

## Fixtures

- `fixtures/ms-project-testfil.xml` — MS Project-kompatibel XML med 5 aktiviteter i 2 sammendragsgrupper og 3 ressurser (ingen matcher standard faggrupper — nødvendig for å teste bulk-opprettelse).

## Opprydning etter test

Testene oppretter faggrupper og kontrollpunkter i prosjektet `2bd15f09-...` på test.sitedoc.no. Slett dem manuelt etter bruk, eller la dem stå som referanse-data.

## Hvis du vil legge til flere tester

Lag en ny fil i `.claude/commands/test-<navn>.md` med YAML-frontmatter (`description:`) og en klar testprotokoll. Legg tilhørende fixtures her i `tests/fixtures/`.
