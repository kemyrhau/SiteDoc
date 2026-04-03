# Mobil — React Native / Expo

## React Native-mønstre

- **Modal-rendering:** ALLTID `<Modal visible={...}>` — ALDRI `{betingelse && <Modal>}` (animasjonsfrys)
- **SafeAreaView i Modals:** Bruk fra `react-native` (IKKE `react-native-safe-area-context`)
- **React Query invalidering:** Invalider query-cache etter mutasjoner
- **`InteractionManager.runAfterInteractions`:** MÅ brukes etter kamera/picker lukkes
- **Lukkeknapp i modaler/fullskjerm:** ALLTID i en header-bar under SafeAreaView — ALDRI absolutt posisjonert (havner under notch/Dynamic Island). Standard: `<X size={22} color="#ffffff" />` med `hitSlop={12}` i en `flex-row items-center px-4 py-3` View. Se `PdfForhandsvisning.tsx` som referanse.

## Opprettelsesflyt

`OpprettDokumentModal` — brukes for både sjekklister og oppgaver. Brukeren trykker alltid "Opprett" manuelt (auto-opprett fjernet pga. iOS Modal-animasjon som blokkerte navigering).
- **Entreprise**: Auto-velges hvis bruker kun er i 1 entreprise
- **Svarer**: Auto fra arbeidsforløp/dokumentflyt (read-only)
- **Tittel**: Auto-generert i API (malnavn + løpenummer)
- **Lokasjon**: IKKE i opprettelsesmodal — settes fra tegning ved klikk, eller kobles etterpå
- **VIKTIG**: Ikke bruk `presentationStyle="pageSheet"` på Modal — forstyrrer navigering etter dismiss på iOS
- Etter opprettelse navigeres til detaljskjermen for umiddelbar registrering

## Bildeannotering

- Annotert bilde erstatter original in-place via `erstattVedlegg()` — ingen duplikater
- `BildeAnnotering`-komponent returnerer annotert fil → `FeltDokumentasjon` oppdaterer vedleggets URL
- Opplastingskø håndterer ny fil med samme vedlegg-ID

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

**Strømforbruk-optimalisering:**
- GPS: Balanced accuracy, 5s intervall (ikke continuous high accuracy)
- WebView: Fjernet unødvendig `mediaPlayback`-innstilling, beholdt `allowsInlineMediaPlayback` for WebGL

**Komprimering (`komprimer()`):**
1. 5:4 senter-crop → 2. Maks 1920px → 3. Iterativ kvalitet 300–400 KB → 4. GPS-tag → 5. Lokal lagring

**Kamerazoom:** `0.5x`/`1x`/`3x` knapper. **5:4 crop-guide:** Halvgjennomsiktig overlay.

**Sensor-basert UI-rotasjon:** Akselerometer, kun UI roterer, terskel 0.55.

**Tidtaker:** Lang-trykk (0.6s) → 2s nedtelling.

**Bildeannotering (Fabric.js):** WebView-basert canvas. Verktøy: pil, sirkel, firkant, frihånd, tekst. Canvas-resize til bildets 5:4.

**Server-URL-håndtering:** `file://` → lokal, `/uploads/...` → `AUTH_CONFIG.apiUrl + url`, `http(s)://` → direkte.

**URL-konstruksjon:** Alle `/uploads/`-URLer MÅ gå via Next.js proxy: `sitedoc.no/api/uploads/...` (IKKE direkte til API-serveren). Dette gjelder både mobilappen og WebView.

**Filmrull:** Horisontal ScrollView med 72×72px thumbnails (IKKE FlatList).

**Bilderekkefølge:** Velg bilde → `◀`/`▶`-piler i verktøylinjen for å flytte. `flyttVedlegg(objektId, vedleggId, "opp"|"ned")` i begge hooks. Rekkefølgen lagres i vedlegg-arrayet og reflekteres i PDF.

**Modal tekstredigering:** Alle tekstfelt bruker Pressable → fullskjerm Modal med "Ferdig"-knapp.

## Utviklingsmiljø — Tunnel og nettverk

**API-tilkobling og miljøseparasjon:**
- `.env` → `https://api-test.sitedoc.no` (testdatabase, brukes under utvikling)
- `.env.production` → `https://api.sitedoc.no` (produksjon, brukes av EAS builds)
- `hentWebUrl()` i `apps/mobile/src/lib/url.ts` erstatter alle `replace("api.", "")` / `replace("api-test.", "")` kall — gir korrekt web-URL uavhengig av miljø
- Cloudflare Tunnel på PC. Fungerer fra ethvert nettverk.

**Expo dev-server:**
- `pnpm dev:tunnel` — Starter ngrok v3-tunnel + Expo. Telefon og Mac kan være på forskjellige nettverk.
- `npx expo start --clear` — LAN-modus. Krever Mac og telefon på samme WiFi.

**Skriptet `scripts/dev-tunnel.sh`:**
1. Starter `ngrok http 8081` i bakgrunnen
2. Henter tunnel-URL fra ngrok API (localhost:4040)
3. Setter `EXPO_PACKAGER_PROXY_URL` → Expo bruker ngrok-URL i QR-kode
4. Rydder opp ngrok-prosess ved Ctrl+C

**Viktig:** `@expo/ngrok` (v2) er fjernet. Vi bruker systeminstallert ngrok v3 (`brew install ngrok`).

## PSI (Prosjektspesifikk Sikkerhetsinstruks)

**Skjerm:** `apps/mobile/app/psi/[psiId].tsx` — PSI-leser

PSI er en personlig sikkerhetsgjennomgang, IKKE en sjekkliste. Gjennomføres via QR-kode eller innboks-lenke.

**Flyt:** Seksjon-for-seksjon progresjon → quiz → signatur → fullført
- Seksjoner basert på `heading`-objekter i malen
- Tekst/bilder: scroll til bunnen for å gå videre
- Video: må ses ferdig (WebView HTML5 video)
- Quiz: må svare riktig (`PsiQuiz`-komponent med auto-sjekk)
- Signatur: siste seksjon (`PsiSignaturFelt`-komponent med scroll-lås og auto-lagring)
- Forrige/Neste/Lukk-knapper for navigering

**HMS-kort:** HMS-kort-felt + "Har ikke HMS-kort"-avkrysning ved signering

**Hjemskjerm PSI-statuslinje:** Slankt statusbånd (grønn/amber/rød) over innboksen:
- Grønn: PSI fullført og gyldig
- Amber: PSI pågår eller utdatert (ny versjon krever re-signering)
- Rød: PSI ikke gjennomført

**Nye rapportobjekter:** `info_text`, `info_image`, `video` (WebView), `quiz`

**Viktig:** PSI-maler har `category = "psi"` — IKKE `"sjekkliste"`. Skal ALDRI vises i sjekkliste-opprettelsesdialogen.

## Flerspråklig (i18n)

**Oppsett:** i18next + react-i18next, gjenbruker JSON-filer fra `packages/shared/src/i18n/` (14 språk, ~690 nøkler).

**Filer:**
- `apps/mobile/src/lib/i18n.ts` — Config, statisk import av alle 14 språk, SecureStore-lagring
- `apps/mobile/src/providers/SpraakProvider.tsx` — Synkroniserer brukerens språk

**Provider-plassering:** `AuthProvider → SpraakProvider → ProsjektProvider`

**Språkprioritet:** `bruker.language` (server) > lagret i SecureStore > `nb` (standard)

**Bruk i komponenter:**
```typescript
import { useTranslation } from "react-i18next";
const { t } = useTranslation();
// t("nav.hjem"), t("tid.minSiden", { n: 5 })
```

**Skjermkonvertering:** Ferdig for hjem, lokasjoner, sjekkliste/[id], oppgave/[id], tabs, login, mer, boks. **Gjenstår:** FeltDokumentasjon, FeltWrapper, RepeaterObjekt, StatusMerkelapp, hentStatusHandlinger.

**Auto-save hooks (useSjekklisteSkjema/useOppgaveSkjema):** Bruker `lagreInternRef` og stabil `planleggLagring` (tom dep-array) for å bryte dependency-kaskaden `oppdaterDataMutasjon → lagreIntern → planleggLagring → oppdaterFelt → settVerdi`. Uten refs: mutation-state-skifte gjenskaper hele kjeden → effects re-trigges → loop.

**Oversettelse ved lagring (Lag 3):** API `oppdaterData` prøver auto-oversettelse (OPUS-MT) ved lagring. Wrappet i try/catch — lagring skal ALDRI feile pga. oversettelsesserver. OPUS-MT trenger pivot via engelsk (lt→en→nb) — **TODO**: implementer pivot-logikk i `kallOversettelsesServer()`.

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

## Implementert: IFC 3D-visning i mobil (WebView)

### Arkitekturbeslutning: WebView-tilnærming

@thatopen/fragments + Three.js fungerer ikke i React Native. WebView-tilnærming gjenbruker web-vieweren — enklest å implementere og vedlikeholde. Appen bruker allerede `react-native-webview` (v13.15.0) for signatur-canvas.

### Implementasjon

- **Web-side:** `apps/web/src/app/mobil-viewer/page.tsx` — standalone IFC-viewer uten Next.js-layout
- **WebView-komponent:** `apps/mobile/src/components/IfcViewer.tsx`
- **Navigasjon:** Dedikert rute `app/3d-visning.tsx` tilgjengelig fra hjem-skjermen
- **postMessage-kommunikasjon:**
  - Web → mobil: `objektValgt`, `modellLastet`, `feil`, `fragmentCachet` (base64 fragment-data)
  - Mobil → web: `lastModeller` (med valgfri cached fragments), `flyTil` (koordinatsynk)
- **Egenskapspanel:** Norske IFC-kategorinavn, prioriterte attributter øverst, stort scrollbart panel
- **Touch-kontroller:** WebView videresender touch til Three.js orbit controls (fungerer ut av boksen)
- **Persistent WebView:** Forsøkt og revertert — for ustabilt med React Native WebView. Bruker per-skjerm IfcViewer

### Modellcache med versjonering

**Fil:** `apps/mobile/src/services/ifcCache.ts`

- `.meta`-filer med `updatedAt`-tidsstempel per cachet modell
- Ved oppstart sjekkes serverens `updatedAt` mot lokal cache
- Utdatert cache slettes og lastes ned på nytt
- WebView laster fra `file://` når modellen er cachet lokalt

### Fragment-cache (parsed IFC)

Mobil-vieweren cacher parsed IFC som fragments for raskere gjenåpning:

- Web-side (`mobil-viewer`) eksporterer parsed IFC via `model.getBuffer()` etter lasting
- Sender base64-kodet fragment-data til React Native via `postMessage` (`fragmentCachet`-melding)
- `IfcViewer.tsx` lagrer fragments i `sitedoc-fragments/`-mappe (dokumentkatalogen)
- Ved gjenåpning sendes cached fragments tilbake med `lastModeller`-meldingen
- Fallback til full IFC-parsing hvis fragments mangler eller er utdatert

### Tegning+3D split-view

**Fil:** `apps/mobile/app/tegning-3d.tsx`

- TegningsVisning (topp) + WebView 3D-viewer (bunn)
- Justerbar split-ratio: 50/50, 70/30, 30/70
- Klikk-synk begge veier via `postMessage` + koordinatbro:
  - Klikk på tegningsmarkør → sender `flyTil`-melding til 3D-viewer
  - Klikk på 3D-objekt → markerer posisjon på tegning
- Lenke fra hjem-skjermen

### Offline-klargjøring

**Fil:** `apps/mobile/src/services/offlineKlargjoring.ts`

- «Forbered til offline»-handling i Mer-menyen
- Laster ned tegninger (PDF/SVG) og IFC-modeller til lokal lagring
- Fremdriftsrapportering under nedlasting

### Avhengigheter
- `react-native-webview` (v13.15.0) ✓
- `expo-file-system` ✓
- tRPC-klient med auth ✓
- Ingen nye avhengigheter (WebView dekker alt)

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

## Implementert: Bygningskontekst — sentral bygningsvelger (Dalux-mønster)

**Kontekst:** `apps/mobile/src/kontekst/BygningKontekst.tsx`
- `valgtBygningId: string | null` — persistent i SecureStore, lagret per prosjekt (Map<prosjektId, bygningId>)
- `settBygning(id | null)` — oppdaterer valg, null = "Alle"
- `useBygning()` hook for alle barn-komponenter

**Bygningsvelger UI:**
- **Lokasjoner-fanen** har horisontalt chip-bånd ("Alle" + bygninger) øverst når tegning ikke vises
- Valgt bygning vises som undertekst i lokasjoner-headeren og hjem-headeren
- Prosjektvelgeren i headeren forblir uendret

**Hva som filtreres på bygning (implementert):**
- Sjekklister i hjem (`checklist.buildingId` via API)
- Tegninger i lokasjoner (`drawing.buildingId` via API)
- 3D-modeller/IFC (`drawing.buildingId + fileType=ifc`)
- Live View (kun modeller for valgt bygning)

**Gjenstår:**
- Oppgaver: API-ruten `oppgave.hentForProsjekt` mangler `buildingId`-filter (oppgaver kobles via `drawing.buildingId`)
- Sjekkliste-liste og oppgave-liste (egne listevisninger) filtrerer ikke ennå

**Provider-plassering:**
```
DatabaseProvider → trpc → QueryClient → Nettverk → OpplastingsKo → Auth → Prosjekt → Bygning
```

## Tegningsmarkører

1. Trykk på tegning → markør → 2. MalVelger → 3. OppgaveModal → 4. Naviger til oppgave.

`TegningsVisning`: Rendrer tegning + markører + GPS-prikk i **én samlet WebView** (HTML med CSS-posisjonering). Alle markører posisjoneres med pikselverdier beregnet fra `img.clientWidth/clientHeight` etter bildelasting. GPS-markør oppdateres via `injectJavaScript` uten re-render.

**VIKTIG:** PDF-er konverteres til PNG på serveren (pdftoppm). Mobilappen viser KUN PNG/bilder — aldri PDF i WebView (iOS WebView har ukontrollerbar PDF-skalering som ødelegger markørposisjonering). Georeferering MÅ gjøres på PNG-versjonen.

Georeferansepunkter (P1, P2, P3) vises som oransje markører for visuell verifisering.

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
