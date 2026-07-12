---
tittel: Nettleser- og simulator-styring for Claude (Playwright MCP + idb)
status: 🟢 AKTIV
sist_verifisert_mot_kode: 2026-07-08
gjelder: verktøyoppsett for Opus-økter (web-verifisering + iOS-simulator)
---

# Nettleser- og simulator-styring for Claude

Hvordan en Opus-økt kan (1) styre Kenneths **ekte, innloggede Chrome** for
web-verifisering/seeding, og (2) styre **iOS-simulatoren** for mobil-app-testing.
Oppsettet persisterer på maskinen — en ny økt trenger kun å kjenne til det.

## 0. Hurtig-sjekkliste — hva Kenneth gjør for å få Opus på nettleser (verifisert 2026-07-11)

For SiteDoc-web (test/prod) **bruk Playwright-utvidelsen, IKKE `claude-in-chrome`** (sistnevnte henger — se caveat under). Steg:

1. **Har Playwright-økten startet på nytt?** Da har utvidelsen ny token. Kopier den fra
   utvidelsen og lim til Opus (som kjører `claude mcp remove/add` — se § 4), eller kjør selv.
   Er token uendret: hopp over.
2. **Åpne fanen** på `test.sitedoc.no` og **logg inn** (firma-admin for de fleste verifiseringer;
   lav-priv testkonto for negativ-/gating-tester).
3. **Klikk «Playwright Extension»** på den fanen → relay-en attacher til akkurat den fanen.
4. Si fra til Opus. Da driver Opus med `browser_snapshot`/`browser_navigate`/`browser_type`.

**Caveat A — `claude-in-chrome` henger på SiteDoc (verifisert 2026-07-11):** dashbordet holder
en vedvarende tilkobling (SSE/websocket) → `document_idle` fyrer aldri → alle
`claude-in-chrome`-handlinger feiler «waited 45000ms for document_idle». **Bruk Playwright** for SiteDoc.

**Caveat B — nyNav er en PER-FIRMA-toggle; sjekk den er PÅ før globalsøk (verifisert 2026-07-11):**
`Ctrl+K` (globalsøk-paletten) trigget først ikke — årsaken var at **nyNav var avslått for firmaet**, ikke en
relay-begrensning. nyNav slås av/på **per Organization/firma** (ikke per bruker, ikke bare `?nyNav=1`-param
— den droppes ved redirect). Ved impersonering følger nyNav-tilstanden **det impersonerte firmaets** innstilling:
bytter du til en bruker i et annet firma, endres nav-tilstanden. Da Kenneth slo nyNav på for firmaet fungerte
`browser_press_key` med `Control+k` fint. **Lærdom:** verifiser i snapshot at topbar viser «Søk overalt Ctrl K»-knapp
+ Prosjekt/Firma-seksjonert sidebar (= nyNav på for gjeldende firma) FØR du feilsøker snarveien.

## 1. Playwright MCP → Kenneths ekte Chrome (anbefalt for web)

**Allerede konfigurert (user scope — gjelder alle prosjekter, alle økter):**

```
playwright: npx @playwright/mcp@latest --extension
  env: PLAYWRIGHT_MCP_EXTENSION_TOKEN=<konfigurert, ikke i repo>
```

- **Chrome-utvidelse:** «Playwright Extension» (Microsoft, Chrome Web Store) er
  installert i Kenneths vanlige Chrome. Nettstedstilgang er begrenset til
  `redesign.sitedoc.no`, `sitedoc.no`, `test.sitedoc.no`, modus **«Ved klikk»**.
  Token-en i utvidelsen må matche `PLAYWRIGHT_MCP_EXTENSION_TOKEN` i MCP-configen.

**Slik bruker en ny økt det:**
1. Last verktøyene (de er deferred): `ToolSearch` med
   `select:mcp__playwright__browser_snapshot,mcp__playwright__browser_navigate,mcp__playwright__browser_take_screenshot,mcp__playwright__browser_click,mcp__playwright__browser_type,mcp__playwright__browser_resize,mcp__playwright__browser_tabs`
2. **Kenneth klikker Playwright-utvidelsen på fanen** som skal styres (sitedoc-domene).
   Da attacher MCP-en til akkurat den fanen.
3. Driv med `browser_snapshot` (a11y-tre m/ ref-er) → `browser_click`/`browser_type`
   (target = ref fra snapshot, eller CSS/`text=`-selector) → `browser_take_screenshot`.
   `browser_resize` for mobil-web-viewport (390×844).

**Viktig sikkerhet + realiteter:**
- Dette styrer Kenneths **ekte admin-sesjon** (høy privilegium, alle firma/prosjekter).
  Minste privilegium: gjør kun det oppgaven krever. Domenescope + «Ved klikk» begrenser
  skadeflaten til sitedoc.
- `test.sitedoc.no` kan være innlogget som lav-priv testkonto «Bruker» (ingen
  prosjekttilgang). Admin-handlinger (seeding o.l.) krever Kenneths egen sesjon der —
  be Kenneth logge inn / attache riktig fane.
- Refs (`f8e1` osv.) endres ved hver navigasjon — ta nytt `browser_snapshot` etter navigasjon.

## 2. chrome-devtools MCP → isolert automasjons-Chrome (begrenset nytte)

```
chrome-devtools: npx -y chrome-devtools-mcp@latest --isolated=false --channel=stable
```

- Starter en **egen** Chrome (profil `~/.cache/chrome-devtools-mcp/chrome-profile`),
  adskilt fra Kenneths vanlige Chrome. Var innlogget som lav-priv «Bruker».
- **Blindvei for innlogging:** Google avviser OAuth i denne automasjons-nettleseren
  («Denne nettleseren er muligens ikke sikker»). Bruk Playwright-utvidelsen (pkt. 1)
  mot Kenneths ekte Chrome i stedet når du trenger en innlogget/privilegert sesjon.

## 3. iOS-simulator (idb + simctl) → mobil-app-testing

Metro/Expo kjører allerede; iPhone-simulator er booted. Mobil-`.env` peker på
`EXPO_PUBLIC_API_URL=http://localhost:3301` (test-API via tunnel
`ssh -N -L 3301:localhost:3301 server-ny` — Kenneth reiser tunnelen). Dev-app-bundle:
`com.kemyrhau.sitedoc` (Expo Go: `host.exp.Exponent`).

**Skjermbilde:** `xcrun simctl io booted screenshot <fil>.png`

**Trykk:** `idb ui tap <X> <Y>` — X/Y er **punkter** (logiske px), IKKE bildepiksler.
- iPhone 16 Plus = 430×932 punkter, skjermbilde = 1290×2796 px (3×).
- **Fra skjermbilde-piksler:** `punkt = px / 3`.
- **Fra et bilde vist i chatten** (oppgir «displayed 923×2000, multipliser med 1.40»):
  `punkt ≈ vist_koordinat × 1.40 / 3 ≈ vist × 0.467`.

**Skrive tekst:** `idb ui text "<tekst>"` (fokuser feltet med tap først).

**Reload dev-app (ny rute/kode):** `xcrun simctl terminate booted com.kemyrhau.sitedoc`
så `xcrun simctl launch booted com.kemyrhau.sitedoc` (reconnecter til Metro, laster
JS på nytt). Merk: reload kan nullstille valgt prosjekt → naviger firma/prosjekt på nytt.

**Vent på bundling uten bar `sleep`** (blokkert): poll med skjermbilde-loop, f.eks.
`for i in $(seq 1 8); do xcrun simctl io booted screenshot x.png; done`.

## 4. Fallgruver ved oppsett (om configen må gjenskapes)

- **`claude mcp add`-scope:** kjør med **`-s user`** (ellers legges serveren under
  cwd-ens prosjekt-scope og lastes ikke for repo-rot-økta).
- **Variadisk `-e`:** sett **navnet først** og `--` rett før kommandoen, ellers sluker
  `-e` navnet:
  `claude mcp add playwright -s user -e PLAYWRIGHT_MCP_EXTENSION_TOKEN=<token> -- npx @playwright/mcp@latest --extension`
- **Aktivering i kjørende økt:** nylagt server blir tilgjengelig først etter reconnect
  (`/mcp`) eller restart av `claude` med «resume» (beholder samtalen).
- **Token-håndtering ved ny økt/ny nøkkel:** `PLAYWRIGHT_MCP_EXTENSION_TOKEN` er
  pairing-hemmeligheten — MCP-serveren og utvidelsen må ha **samme** verdi. Den
  ligger i `~/.claude.json` (user-scope) og persisterer.
  - **Observert (2026-07-08):** utvidelsen genererer en **ny token ved hver
    oppstart av Playwright-økten**. Da må configen oppdateres hver gang — «hold
    stabil» er ikke oppnåelig med mindre utvidelsen har en fast-token-innstilling
    (verdt å undersøke i utvidelsens options).
  - **Standard flyt hver ny økt** (ny token): Kenneth kopierer token-en →
    oppdater config + reconnect:
    ```
    claude mcp remove -s user playwright
    claude mcp add playwright -s user -e PLAYWRIGHT_MCP_EXTENSION_TOKEN=<ny-token> -- npx @playwright/mcp@latest --extension
    ```
    deretter `/mcp` (reconnect) eller restart `claude` med «resume».
    Kenneth kan lime token-en til økta (som kjører kommandoen) eller kjøre den selv.
  - **Hvis token tilfeldigvis er uendret** → ingenting å gjøre; klikk bare utvidelsen
    på fanen.
  - Token-en er lav-risiko lokal pairing (ikke prod-hemmelighet), men hold den utenfor
    repoet; den havner i klartekst i `~/.claude.json` + evt. logg.
- `redesign.sitedoc.no` er **ikke** en MCP-server (bare en web-app) — ikke legg den til
  som HTTP-MCP.
