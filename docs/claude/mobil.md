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

### Arkitekturbeslutning: WebView-tilnærming

@thatopen/fragments + Three.js fungerer ikke i React Native. WebView-tilnærming gjenbruker web-vieweren — enklest å implementere og vedlikeholde. Appen bruker allerede `react-native-webview` (v13.15.0) for signatur-canvas.

### Implementasjonsplan

**Steg 1: Lag en standalone IFC-viewer HTML-side på web**
- Ny rute: `/mobil-viewer` (eller statisk HTML i `public/`)
- Bare canvas + OBC-initialisering — ingen sidebar, verktøylinje eller Next.js-layout
- Aksepterer parametere via URL eller `postMessage`:
  - `modelUrls` — liste med IFC-fil-URLer
  - `token` — auth-token for filnedlasting
- Sender hendelser tilbake via `postMessage`:
  - `{ type: "objektValgt", data: { localId, modelId, kategori, egenskaper } }`
  - `{ type: "modellLastet", data: { antall } }`
  - `{ type: "feil", data: { melding } }`
- **Fil:** `apps/web/src/app/mobil-viewer/page.tsx`

**Steg 2: WebView-komponent i mobilappen**
- Ny komponent: `apps/mobile/src/components/IfcViewer.tsx`
- `<WebView source={{ uri: "https://sitedoc.no/mobil-viewer?..." }}>`
- `onMessage` håndterer `postMessage` fra web-vieweren
- Overlay-kontroller i React Native over WebView:
  - Modell-toggle (avkrysning per fag)
  - Snitt-knapp
  - Tilbake-knapp
- **Touch-kontroller:** WebView videresender touch til Three.js orbit controls (fungerer ut av boksen)

**Steg 3: Navigasjon og integrasjon**
- Ny tab eller knapp i `(tabs)/` — "3D" ikon i bottom-tab, eller knapp i Lokasjoner
- Alternativt: dedikert rute `app/3d-visning.tsx` tilgjengelig fra hjem-skjermen
- Hent IFC-tegninger via `trpc.tegning.hentForProsjekt` (filtrerer `fileType === "ifc"`)

**Steg 4: Offline-støtte**
- Forhåndslast IFC-filer til `expo-file-system` lokal lagring
- WebView laster fra `file://` i stedet for `https://`
- Krever: ny synk-logikk i `OpplastingsKoProvider` eller egen `IfcCacheProvider`
- Vis nedlastings-progress og lagringsstatus

**Avhengigheter som allerede finnes:**
- `react-native-webview` (v13.15.0) ✓
- `expo-file-system` ✓
- tRPC-klient med auth ✓

**Nye avhengigheter:** Ingen (WebView dekker alt)

### Funksjoner å støtte (prioritert)
1. Modellvisning med orbit-kontroll (touch)
2. Modell-toggle per fag (checkbox-liste)
3. Objektklikk med egenskapspanel
4. Klippeplan (snitt)
5. Filtrering (skjul/vis IFC-typer)

---

## Planlagt: Live site-view — AR/3D på byggeplass (Fase 3)

### Konsept
Vis IFC-modell overlagt på kamera for å følge/sjekke byggeprosessen i sanntid.

### Implementasjonsplan — to tilnærminger

**Tilnærming A: Enkel "split-view" (MVP)**
- Delt skjerm: kamerabilde øverst, 3D-modell i WebView nederst
- GPS-posisjon vises i begge visninger
- Bruker roterer modellen manuelt til den matcher kameravinkelen
- Minimal kompleksitet — kan implementeres med eksisterende teknologi
- **Komponenter:** `expo-camera` + `IfcViewer` WebView + GPS overlay

**Tilnærming B: Full AR-overlay (avansert)**
- IFC-modell overlagt direkte på kamerastrømmen
- GPS + kompass + akselerometer for automatisk posisjonering
- Manuell finjustering (dra/roter/skaler modell)

**Teknologivalg for AR:**
- **expo-three + expo-gl:** Three.js i React Native med GL-kontekst. Kan rendere IFC-geometri over kamerabakgrunn. Krever egen IFC-parser (ikke @thatopen som trenger DOM)
- **ViroReact:** Open-source AR-rammeverk for React Native. Støtter ARKit/ARCore, 3D-modeller, GPS-forankring. Krever native modul (Expo prebuild)
- **react-native-arkit / react-native-arcore:** Direkte bindings. Mest kontroll, mest arbeid
- **WebXR i WebView:** Eksperimentelt — nettleser-AR i WebView. Begrenset støtte

**Implementert: Tilnærming A (split-view MVP)**
- `apps/mobile/app/live-view.tsx` — split-view med kamera + WebView
- Kamera øverst, 3D-modell nederst (justerbar ratio: 50/50, 70/30, 30/70)
- Live GPS med kompass på begge visninger
- Bruker `/mobil-viewer` WebView og offline IFC-cache
- Navigasjon fra hjem-skjermen

**Neste steg:**
1. Evaluer AR-behov basert på brukertesting av split-view
2. Tilnærming B med expo-three/expo-gl for full AR (Expo prebuild påkrevd)

**Posisjonering av modell:**
- IFC-filer kan ha georeferanse (UTM-koordinater) i metadata — uttrukket ved opplasting og lagret i `Drawing.ifcMetadata`
- `expo-location` gir GPS (WGS84) — konverter til UTM via `koordinatKonvertering.ts` (allerede i @sitedoc/shared)
- Kompass (`expo-sensors` Magnetometer) gir retning
- Akselerometer gir tilt for kameravinkel

**GPS-presisjon:**
- Standard GPS: ±5-10m — for grov plassering
- RTK-GPS (eksternt via Bluetooth): ±2cm — for presis overlay
- Manuell justering nødvendig uansett for starten

**Verdi:** Kvalitetskontroll på byggeplass — sjekke at ting er bygget riktig uten å gå tilbake til kontoret. Marker avvik direkte i visningen.

## Planlagt: Bygningskontekst — sentral bygningsvelger

### Problem
Mobilappen mangler en persistent bygningsvelger. Brukere jobber typisk i én bygning om gangen — sjekklister, oppgaver, tegninger, 3D-modeller og live view bør alle filtreres til valgt bygning. Det gir ikke mening å vise IFC-modeller fra en annen bygning, eller sjekklister som tilhører et annet bygg.

### Løsning: BygningKontekst i mobilappen

**Ny kontekst:** `apps/mobile/src/kontekst/BygningKontekst.tsx`
- `valgtBygningId: string | null` — persistent i AsyncStorage/SecureStore
- `valgtBygning: { id, name, number } | null` — hentet fra API
- `settBygning(id)` — oppdaterer valg
- Alle barn-komponenter bruker `useBygning()` for å filtrere data

**Bygningsvelger UI:**
- Dropdown/velger i app-headeren eller på hjem-skjermen — alltid synlig
- Viser bygningsnavn + nummer
- Lagrer siste valg per prosjekt (Map<prosjektId, bygningId> i AsyncStorage)

**Hva som filtreres på bygning:**
- Sjekklister (`checklist.buildingId`)
- Oppgaver (`task.drawingId → drawing.buildingId`)
- Tegninger (`drawing.buildingId`)
- 3D-modeller/IFC (`drawing.buildingId + fileType=ifc`)
- Live View (kun modeller for valgt bygning)
- Bilder (via sjekkliste/oppgave → bygning)

**Provider-plassering i hierarkiet:**
```
DatabaseProvider → trpc → QueryClient → Nettverk → OpplastingsKo → Auth → Prosjekt → Bygning
```

**API-endringer:** Ingen — alle queries filtrerer allerede på `buildingId` (valgfritt). Mobilappen sender bare `buildingId` som parameter.

**Berører:**
- `apps/mobile/src/kontekst/` — ny BygningKontekst
- `apps/mobile/app/(tabs)/hjem.tsx` — bygningsvelger
- `apps/mobile/app/3d-visning.tsx` — filtrer IFC på bygning
- `apps/mobile/app/live-view.tsx` — filtrer IFC på bygning
- `apps/mobile/app/sjekkliste/` — filtrer på bygning
- `apps/mobile/app/oppgave/` — filtrer på bygning
- `apps/mobile/src/providers/index.tsx` — legg til BygningProvider

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
