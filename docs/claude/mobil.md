# Mobil — React Native / Expo

## React Native-mønstre

- **Modal-rendering:** ALLTID `<Modal visible={...}>` — ALDRI `{betingelse && <Modal>}` (animasjonsfrys)
- **SafeAreaView i Modals:** Bruk fra `react-native` (IKKE `react-native-safe-area-context`)
- **React Query invalidering:** Invalider query-cache etter mutasjoner
- **`InteractionManager.runAfterInteractions`:** MÅ brukes etter kamera/picker lukkes

## Statusendring

Sjekkliste-/oppgave-detaljskjermen har kontekstuelle statusknapper i bunnpanelet:

| Status | Knapp(er) | Neste status | Farge |
|--------|-----------|--------------|-------|
| `draft` | "Send" | `sent` | Blå |
| `sent` | "Motta" | `received` | Blå |
| `received` | "Start arbeid" | `in_progress` | Amber |
| `in_progress` | "Besvar" | `responded` | Lilla |
| `responded` | "Godkjenn" + "Avvis" | `approved` / `rejected` | Grønn + Rød |
| `rejected` | "Start arbeid igjen" | `in_progress` | Amber |
| `approved` | "Lukk" | `closed` | Grå |
| `closed` | (ingen) | — | — |

- "Avbryt"-knapp (rød) for draft→in_progress
- Bekreftelsesdialog før statusendring
- `hentStatusHandlinger()` hjelpefunksjon

## Oppgave-utfylling

`useOppgaveSkjema`-hook i `apps/mobile/src/hooks/useOppgaveSkjema.ts`. Identisk med sjekkliste-utfylling:

```
[Header] [Metadata-bar] [Entrepriser]
─── ScrollView ───
  [Tittel] [Prioritet] [Beskrivelse]
  [Koblinger] [Malobjekter] [Historikk]
─── Bunnpanel ───
  [Statusknapper + Lagre]
```

**Auto-fill:** date→i dag, date_time→nå, person→bruker, company→entreprise, drawing_position→fra oppgavens tegning.

## Dato/tid-felter (Dalux-stil)

- **Dato:** Autoforslag ved trykk, "I dag"-lenke, ×-knapp for å tømme
- **DatoTid:** Splittet dato+tid, "Nå"-lenke, uavhengig redigering

## Bildehåndtering

**Kameraflyt:** kamera åpnes + GPS startes parallelt → bilde tas → komprimering + GPS-resultat hentes → lokal lagring → filmrull → bakgrunnskø → server.

**GPS-strategi:**
- GPS-henting starter **samtidig** med kameraåpning (`gpsPromiseRef`) — posisjon er klar når bildet tas
- `hentGps()`: High accuracy med 5s timeout → fallback til Balanced med 5s timeout → null
- KartVisning: GPS med 8s timeout, statusmelding til bruker
- Tillatelse: `requestForegroundPermissionsAsync()` — krever "Når appen er i bruk"

**Komprimering (`komprimer()`):**
1. 5:4 senter-crop → 2. Maks 1920px → 3. Iterativ kvalitet 300–400 KB → 4. GPS-tag → 5. Lokal lagring

**Kamerazoom:** `0.5x`/`1x`/`3x` knapper. **5:4 crop-guide:** Halvgjennomsiktig overlay.

**Sensor-basert UI-rotasjon:** Akselerometer, kun UI roterer, terskel 0.55.

**Tidtaker:** Lang-trykk (0.6s) → 2s nedtelling.

**Bildeannotering (Fabric.js):** WebView-basert canvas. Verktøy: pil, sirkel, firkant, frihånd, tekst. Canvas-resize til bildets 5:4.

**Server-URL-håndtering:** `file://` → lokal, `/uploads/...` → `AUTH_CONFIG.apiUrl + url`, `http(s)://` → direkte.

**Filmrull:** Horisontal ScrollView med 72×72px thumbnails (IKKE FlatList).

**Bilderekkefølge:** Velg bilde → `◀`/`▶`-piler i verktøylinjen for å flytte. `flyttVedlegg(objektId, vedleggId, "opp"|"ned")` i begge hooks. Rekkefølgen lagres i vedlegg-arrayet og reflekteres i PDF.

**Modal tekstredigering:** Alle tekstfelt bruker Pressable → fullskjerm Modal med "Ferdig"-knapp.

## Utviklingsmiljø — Tunnel og nettverk

**API-tilkobling:** Mobilen bruker alltid `https://api.sitedoc.no` (Cloudflare Tunnel på PC). Fungerer fra ethvert nettverk.

**Expo dev-server:**
- `pnpm dev:tunnel` — Starter ngrok v3-tunnel + Expo. Telefon og Mac kan være på forskjellige nettverk.
- `npx expo start --clear` — LAN-modus. Krever Mac og telefon på samme WiFi.

**Skriptet `scripts/dev-tunnel.sh`:**
1. Starter `ngrok http 8081` i bakgrunnen
2. Henter tunnel-URL fra ngrok API (localhost:4040)
3. Setter `EXPO_PACKAGER_PROXY_URL` → Expo bruker ngrok-URL i QR-kode
4. Rydder opp ngrok-prosess ved Ctrl+C

**Viktig:** `@expo/ngrok` (v2) er fjernet. Vi bruker systeminstallert ngrok v3 (`brew install ngrok`).

## Offline-first (SQLite)

**SQLite-tabeller:**

| Tabell | Formål |
|--------|--------|
| `sjekkliste_feltdata` | Lokal sjekkliste-utfylling |
| `oppgave_feltdata` | Lokal oppgave-utfylling |
| `opplastings_ko` | Bakgrunnskø for filopplasting |

**Lagringsstrategi:**
- SQLite først (<10ms), deretter server-synk
- `erSynkronisert`-flagg, `sistEndretLokalt`-tidsstempel
- Usynkronisert data prioriteres over server-data
- Auto-synk ved nettverksovergang

**Bakgrunnskø:**
- Én fil av gangen, eksponentiell backoff (maks 5 forsøk)
- Callback: `registrerCallback()` for URL-oppdateringer i sanntid
- Ved krasj: `laster_opp` → `venter` ved oppstart

**Provider-hierarki:**
```
DatabaseProvider → trpc → QueryClient → Nettverk → OpplastingsKo → Auth → Prosjekt
```

**Sesjonshåndtering:**
- `mobilAuth.verifiser` fornyer sesjonen med 30 nye dager OG roterer token (returnerer `nyttToken`)
- `AuthProvider` lagrer rotert token automatisk via `lagreSessionToken(nyttToken)`
- Sesjontoken: `crypto.randomBytes(32).toString("hex")` (256-bit entropi)
- Offline: cached brukerdata fra SecureStore
- UNAUTHORIZED → automatisk utlogging
- `loggUt()` sletter sesjon server-side (`mobilAuth.loggUt`) FØR lokal opprydding (med try/catch for offline)

**expo-file-system:** Bruk `expo-file-system/legacy` (IKKE `expo-file-system`)

## Planlagt: IFC 3D-visning i mobil (Fase 2)

Støtte mest mulig av web-funksjonalitet for 3D-modeller i mobilappen.

**Tilnærming:**
- @thatopen/fragments + Three.js fungerer ikke direkte i React Native
- **WebView-tilnærming (anbefalt):** Gjenbruk web-vieweren i en WebView med kommunikasjon via `postMessage`. Enklest å implementere og vedlikeholde.
- Alternativer: expo-gl + three.js (begrenset), native IFC-viewer (Swift/Kotlin)
- **Offline-støtte:** Forhåndslast IFC-filer til lokal lagring, vis fra cached data

**Funksjoner å støtte:**
- Modellvisning med orbit-kontroll
- Objektklikk med egenskaper
- Modell-toggle per fag
- Filtrering (skjul/vis objekter)
- Klippeplan (snitt)

## Planlagt: Live site-view — AR/3D på byggeplass (Fase 3)

Vis IFC-modell overlagt på kamera for å følge/sjekke byggeprosessen i sanntid.

**Konsept:**
- AR-visning med kamera som bakgrunn, 3D-modell overlagt
- GPS + kompass for grov posisjonering
- Manuell justering for presisjon (dra/roter modell)
- Sammenlign planlagt (modell) vs. bygget (virkelighet)
- Marker avvik direkte i visningen

**Teknologi:**
- iOS: ARKit via expo-ar eller native modul
- Android: ARCore
- Alternativ: enklere "split-view" med modell ved siden av kamerabilde
- IFC-modellens georeferanse (UTM-koordinater) kan brukes for automatisk plassering

**Verdi:** Stor verdi for kvalitetskontroll på byggeplass — sjekke at ting er bygget riktig uten å gå tilbake til kontoret.

## Tegningsmarkører

1. Trykk på tegning → markør → 2. MalVelger → 3. OppgaveModal → 4. Naviger til oppgave.

`TegningsVisning`: `onTrykk`-callback + `markører`-prop. Bilde- og PDF-visning.

## Oppgave fra sjekklistefelt

`+Oppgave`-knapp på felter → oppgavenummer som blå pill-badge → navigerer til oppgave.

## PDF-utskrift og deling

**PDF-bygger:** `apps/mobile/src/utils/sjekklistePdf.ts` — genererer HTML for expo-print.

**Layout:**
1. Tittel (stor, fet) med logo til venstre
2. 4×2 metadata-rutenett: Prosjekt, Prosjekt nr, Bygning, Opprettet av, Opprettet, Endret av, Endret, Status
3. Feltblokker: label øverst → bilder i 2-kolonners rutenett med nummerering → tekstverdi → kommentar

**Bildevisning i PDF:** Vedlegg-bilder embedderes som `<img>` med full URL (`apiUrl + /uploads/...`). Nummerering per felt (1, 2, 3...).

**Forhåndsvisning:** `PdfForhandsvisning`-komponent — WebView med HTML-preview i et hvitt kort med luft til skjermkantene. Del-knapp genererer PDF via `expo-print` → `expo-sharing`.

**Flyt:** Share-ikon → forhåndsvisning → Del-knapp → PDF → iOS delearket (e-post, AirDrop, etc.)

**Støttede felttyper:** text_field, list_single/multi (normalisert), traffic_light, integer/decimal/calculation (med enhet), date, date_time, person, persons, company, weather, signature (base64), repeater (med barnefelt), bim/zone/room_property.
