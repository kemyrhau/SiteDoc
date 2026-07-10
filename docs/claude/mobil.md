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
- **Utfører**: Auto fra dokumentflyt (read-only)
- **Tittel**: Auto-generert i API (malnavn + løpenummer)
- **Lokasjon**: IKKE i opprettelsesmodal — settes fra tegning ved klikk, eller kobles etterpå
- **VIKTIG**: Ikke bruk `presentationStyle="pageSheet"` på Modal — forstyrrer navigering etter dismiss på iOS
- Etter opprettelse navigeres til detaljskjermen for umiddelbar registrering

## Bildeannotering

- Annotert bilde erstatter original in-place via `erstattVedlegg()` — ingen duplikater
- `BildeAnnotering`-komponent returnerer annotert fil → `FeltDokumentasjon` oppdaterer vedleggets URL
- Opplastingskø håndterer ny fil med samme vedlegg-ID

## Statusendring

Sjekkliste-/oppgave-detaljskjermen har posisjon-basert handlingsmeny i bunnpanelet:

### Header (blå bar)
```
← BEF-002  Befaring betong  [☁][Mottatt]
   [Elektro] →●→ [BH · Byggeleder] +1
```
- Rad 1: Tilbake · Prefix+nummer · Tittel · Synk-ikoner · StatusBadge
- Rad 2: FlytIndikator (`apps/mobile/src/components/FlytIndikator.tsx`) — native View, kompakt

### Bunnpanel (DokumentHandlingsmeny)
`apps/mobile/src/components/DokumentHandlingsmeny.tsx` — ActionSheet (iOS) / Alert (Android).

| Status | Knapper |
|--------|---------|
| draft | `[Send ▾]` + `[Slett]` |
| sent | `[Trekk tilbake]` |
| received/in_progress/rejected | `[Send ▾]` (ActionSheet med entrepriser) |
| responded | `[Godkjenn]` + `[Avvis]` + `[Send ▾]` |
| approved | `[Lukk]` + `[Videresend ▾]` |
| cancelled | `[Gjenåpne]` + `[Slett]` |

- Send-dropdown: primærmottaker, Send tilbake (boks 2+), videresend til andre entrepriser
- Admin-seksjon (registrator/admin/siste boks): Godkjenn, Lukk, Trekk tilbake, Gjenåpne
- Kommentar-modal (bottom sheet) med tastaturhåndtering etter ActionSheet-valg
- Lagre-knapp beholdt under handlingsmeny (offline-first)

### Rettighetsbasert UI
`useOppgaveSkjema(id, rettighetInput?)` og `useSjekklisteSkjema(id, rettighetInput?)` — valgfri `rettighetInput` med `utledDokumentRettighet()`. Uten param → gammel status-basert logikk.

## Oppgave-utfylling

`useOppgaveSkjema`-hook i `apps/mobile/src/hooks/useOppgaveSkjema.ts`. Identisk med sjekkliste-utfylling:

```
[Blå header med FlytIndikator]
─── ScrollView ───
  [Tittel] [Prioritet] [Beskrivelse]
  [Koblinger] [Malobjekter] [Historikk]
─── Bunnpanel ───
  [DokumentHandlingsmeny + Lagre]
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

## Timer (firma timer-modul)

Timeregistrering for feltarbeider. Skjermene ligger i `apps/mobile/app/timer/` (offline-first via lokal Drizzle/SQLite). Detaljer i [docs/claude/timer.md](timer.md).

| Skjerm | Formål |
|--------|--------|
| `index.tsx` | Dagsseddel-liste — leser lokale dagssedler (`dagsseddelLocal`) for innlogget bruker, sortert på dato, m/totaltimer per sedel |
| `mine.tsx` | «Mine timer» — kompakt rapport på tvers av prosjekter (lokal Drizzle-spørring, klient-side aggregering). Periodevalg: denne uken / forrige uke / denne måneden (egendefinert periode er web-only) |
| `ny.tsx` | Ny dagsseddel — velg prosjekt + aktivitet, dato, GPS-fangst. Skriver lokalt (`dagsseddelLocal`/`aktivitetLocal`), dagstotal-banner viser allerede ført tid |
| `[id].tsx` | Dagsseddel-detalj — rediger timer-/tillegg-/maskinrader lokalt, send, slett |
| `attestering/index.tsx` + `[id].tsx` | Firma-attestering (firma-kontekst via `useFirma()`, online-only): liste + detalj. Speil av webs `/dashbord/firma/timer/attestering`. Bruker `timer.dagsseddel.kanAttestereFirma`/`hentTilAttesteringFirma` |

**Attestering ≠ Godkjenning:** Attestering = arbeider får lønn for registrert tid (timer-modul). Se [terminologi.md](terminologi.md).

**Synk-status (SYNC-1, 2026-07-10):** lokal `dagsseddelLocal.syncStatus` = `pending | synced | conflict | avvist`. `avvist` (permanent server-avvisning) er **terminal** — raden forlater pending så 30s-retryen stopper, og `[id].tsx` viser rødt banner (`timer.sync.avvist*`) + `TimerSyncStatusBar` rødt varsel (`tellAvvist`). Skilles fra transient `feilet` (beholdes pending, retries). Ren TS-enum-utvidelse i `db/schema.ts` — ingen SQLite-migrering (tekstkolonne). Detaljer i [timer.md § Synk-resultat](timer.md) + [BACKLOG SYNC-1](BACKLOG.md).

**Synk bevarer nå fra/til (SYNC-2, 2026-07-10):** `syncBatch` persisterer `fraTid`/`tilTid` på timer- og maskin-rader. Før dette droppet synkveien tidene (input-skjema strippet + `createMany` utelot), så en mobilsynk **slettet** fra/til ført på web på samme sedel (`deleteMany`+`createMany`). Overlapp/`fra<til` valideres nå på synkveien via delt `@sitedoc/shared/utils/tidsromValidering.ts` → avvist rutes via `"avvist"`. Se [timer.md § Overlapp](timer.md).

**Klient-speiling av overlapp/`fra<til` (M3, 2026-07-10):** `TimerSeksjon`/`MaskinSeksjon` blokkerer lagring lokalt via samme delte regel (`tilErEtterFra`, `finnOverlappendeTidsrom` fra `@sitedoc/shared`) før synk — arbeideren stoppes før raden lagres, ikke etter server-avvisning. `TimerSeksjon` sjekker overlapp mot **alle timer-rader på sedelen på tvers av (projectId, ECO)-bøtter** (egen `alleTimerRader`-prop tråret fra `[id].tsx`, ikke det bøtte-scopede `rader`), ekskl. redigert rad; pre-eksisterende overlapp låser ikke ute. Prefill forblir bøtte-scopet (ulikt scope). Duplikat-helperen `fraErForTil` slettet. Feiltekst = serverens ordlyd (`timer.feil.overlapp`).

**Timer-modal B3 + prefill-scope (M6, 2026-07-10):** `TimerSeksjon.tsx` (`TimerRadModal`) prefyller nå **antall** for ny rad: `timer`-init lazy-kaller delt `effektiveTimerFraSpenn(fra, til, pauseFra, standardPauseMin)` når `prefillGyldig` (begge tider satt + `hhmmTilMin(fra) < hhmmTilMin(til)`), ellers tom — speiler webs `TimerRadDialog`. `tilTid` prefylles kun ved gyldig prefill (som web). **Prefill-scope løftet til hele sedelen:** `defaultTider.fra` = seneste `tilTid` over `alleTimerRader` (alle bøtter), beregnet som **maks** via `hhmmTilMin` (ikke array-rekkefølge — fjerner det gamle `[...eksisterendeRader].reverse().find()`), fallback `effektiv.startTid`. `eksisterendeRader` beholdt for lønnsart/aktivitet-prefill (`defaultValg`, bevisst bøtte-scopet). Lukker bolk-(g)-prefill-scope-bulleten. Ingen ny i18n, ingen api, ingen migrering. Detaljer i [timer.md § B3](timer.md) + [BACKLOG § bolk (g)](BACKLOG.md).

**Maskin-modal speiler web B1/B2/B3 (M5, 2026-07-10):** `MaskinSeksjon.tsx` (`MaskinRadModal`) speiler nå webs `MaskinRadDialog` (ikke `RedigerMaskinRad`, som er leder-attestering uten B2). **B1** — maskintimene trekker lunsjpause via delt `effektiveTimerFraSpenn` med `standardPauseMin` (firma-default fra `hentOrganizationSettingLokalt`, «maskin følger føreren» — IKKE sedel-`pauseMin`, som er Del 2 bucket-taket). **B2** — hard sperre i `lagre()`: når begge tider er satt MÅ `antall == effektiveTimerFraSpenn(...)` (`timer.feil.timerAvvik`), ellers blokkeres lagring. Klient-only (serveren håndhever ikke B2 — se [BACKLOG](BACKLOG.md)). **B3** — `timer`-feltet init fra prefill-spennet. Auto-synk (`handterFraEndret`/`handterTilEndret`/`handterTimerEndret`) via `effektiveTimerFraSpenn`/`tilFraAntall`, sist-rørte felt vinner. **B4-prefill** — `defaultTider` foreslår maskinens driftsvindu fra bucketens arbeidsspenn (første/siste timer-rad i `(defaultProjectId, defaultEcoId)`), faller til `hentEffektivArbeidstidLokal`. Ingen ny i18n (`timer.feil.timerAvvik`/`sluttForStart` finnes), ingen SQLite-migrering. **Synk-vakt:** `syncBatch` validerer nå maskin-`fra<til` (`tilErEtterFra` på `lokal.maskiner`) → `"avvist"` (SYNC-1); før M5 omgikk synkveien vakten. Detaljer i [timer.md § B1–B4](timer.md).

**Gjenåpning — feilkode-mapping (M4, 2026-07-10):** `apps/mobile/app/timer/[id].tsx` sin `gjenaapneMutation.onError` mapper nå på `e.data?.code` i stedet for delstreng på meldingen. **To kjente koder** får egne i18n-tekster: `CONFLICT` → `timer.gjenaapne.feilGodkjent`, `PRECONDITION_FAILED` (attestert-vakt) → `timer.gjenaapne.laastAttestert` (nøkkel finnes i nb+en, delt med web). **Enhver annen kode** viser serverens egen `message` — dette dekker `BAD_REQUEST` (ikke-sent-status) og `FORBIDDEN`/`NOT_FOUND` som `gjenaapneDagsseddel` arver fra eierskaps-helperen `hentEgenDagsseddel` (`apps/api/src/routes/timer/dagsseddel.ts`), pluss alt fremtidig. **Kun fravær av `code`** → `timer.gjenaapne.feilNett`. Tidligere falt alt uten delstrengen `"godkjent"` til «Krever nett» — også attestert-vakten og en sedel arbeideren ikke eier, som er rene server-avvisninger, ikke nett. `NOT_FOUND` fikk samtidig serverside-meldingen `"Dagsseddelen finnes ikke"` (var tom). `e.data.code`/`e.data.httpStatus` er tilgjengelig fra default tRPC-feilform (samme kilde som `erPermanentFeil` i `timerSync.ts` leser). Ingen nye i18n-nøkler. Mobil mangler fortsatt webs proaktive `disabled`-guard (krever SQLite-migrering) — se [BACKLOG](BACKLOG.md). Detaljer i [timer.md § Gjenåpning](timer.md).

**Offline-cacher (Drizzle/SQLite) for «Start/Slutt dag»-forslag:** `oppmotested_local` (Fase 1, GPS-kontor-identifikasjon) + `arbeidstidskalender_local`/`organization_setting_local` (arbeidstid/reise-regelsett) + **R4 (2026-06-11):** `reisetid_matrise_local` (kjøretid kontor×byggeplass, `kjoretidMin < 0` = uoppnåelig) + `byggeplass_local` (id/projectId/number/status for prosjekt→primær-byggeplass-resolusjon). Refresh via katalog-tjenestene (`oppmotestedKatalog`, `reisetidMatriseKatalog`, `byggeplassKatalog`, …) wiret i `TimerSyncProvider` (per-org, ved login + nett-gjenkomst). Reise-forslaget i `StartSluttDagKort.genererForslag` slår opp matrisen (kontor→primær-byggeplass → faktisk reisetid), med graceful `estimerReisetidMin`-fallback når rad mangler. Detaljer i [timer.md § Reise og oppmøtested](timer.md).

## Flerspråklig (i18n)

**Oppsett:** i18next + react-i18next, gjenbruker JSON-filer fra `packages/shared/src/i18n/` (14 språk, ~920 nøkler).

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

**Skjermkonvertering:** Komplett — alle skjermer og komponenter bruker t(). Inkludert: hjem, lokasjoner, sjekkliste/[id], oppgave/[id], tabs, login, mer, boks, OpprettDokumentModal, FeltDokumentasjon, FeltWrapper, RepeaterObjekt, TekstfeltObjekt, StatusMerkelapp. `hentStatusHandlinger()` i shared bruker `tekstNoekkel` (i18n-nøkler).

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

## Implementert: Byggeplasskontekst — sentral byggeplassvelger (Dalux-mønster)

**Kontekst:** `apps/mobile/src/kontekst/ByggeplassKontekst.tsx`
- `valgtByggeplassId: string | null` — persistent i SecureStore, lagret per prosjekt (Map<prosjektId, byggeplassId>)
- `settByggeplass(id | null)` — oppdaterer valg, null = "Alle"
- `useByggeplass()` hook for alle barn-komponenter

**Byggeplassvelger UI:**
- **Lokasjoner-fanen** har horisontalt chip-bånd ("Alle" + byggeplasser) øverst når tegning ikke vises
- Valgt byggeplass vises som undertekst i lokasjoner-headeren og hjem-headeren
- Prosjektvelgeren i headeren forblir uendret

**Hva som filtreres på byggeplass (implementert):**
- Sjekklister i hjem (`checklist.buildingId` via API)
- Tegninger i lokasjoner (`drawing.buildingId` via API)
- 3D-modeller/IFC (`drawing.buildingId + fileType=ifc`)
- Live View (kun modeller for valgt byggeplass)

**Gjenstår:**
- Oppgaver: API-ruten `oppgave.hentForProsjekt` mangler `buildingId`-filter (oppgaver kobles via `drawing.buildingId`)
- Sjekkliste-liste og oppgave-liste (egne listevisninger) filtrerer ikke ennå

**Provider-plassering:**
```
DatabaseProvider → trpc → QueryClient → Nettverk → OpplastingsKo → Auth → Prosjekt → Byggeplass
```

## Tegningsmarkører

1. Trykk på tegning → markør → 2. MalVelger → 3. OppgaveModal → 4. Naviger til oppgave.

`TegningsVisning`: Rendrer tegning + markører + GPS-prikk i **én samlet WebView** (HTML med CSS-posisjonering). Alle markører posisjoneres med pikselverdier beregnet fra `img.clientWidth/clientHeight` etter bildelasting. GPS-markør oppdateres via `injectJavaScript` uten re-render.

**VIKTIG:** PDF-er konverteres til PNG på serveren (pdftoppm). Mobilappen viser KUN PNG/bilder — aldri PDF i WebView (iOS WebView har ukontrollerbar PDF-skalering som ødelegger markørposisjonering). Georeferering MÅ gjøres på PNG-versjonen.

Georeferansepunkter (P1, P2, P3) vises som oransje markører for visuell verifisering.

## Oppgave fra sjekklistefelt

`+Oppgave`-knapp på felter → oppgavenummer som blå pill-badge → navigerer til oppgave.

## PDF-utskrift og deling

**PDF-bygger:** `@sitedoc/pdf` (packages/pdf/) — delt pakke for web og mobil. Genererer komplett HTML-strenger.

**Arkitektur:**
- `byggSjekklisteHtml()` / `byggOppgaveHtml()` tar data-objekter + config → returnerer HTML
- Null runtime-avhengigheter — kun TypeScript-strenger
- `PdfConfig`: bildeBaseUrl, maksbildeHoyde, gjentakendeHeader, visSidenummer, tegningScreenshot, tegningDetaljScreenshot

**Layout:**
1. Header-ramme: logo, prosjektnummer · navn, fra→til, status, vær (styrt av utskriftsinnstillinger)
2. Tegningsposisjon: oversikt + detalj side om side (canvas-screenshot)
3. Feltblokker: label → bilder (2-kolonners flex) → verdi → kommentar

**Tegningsposisjon i PDF:**
- `TegningsCapture.tsx`: offscreen WebView med `<canvas>` som tegner bilde + prikk
- Genererer to bilder: oversikt (maks 2400px) og detalj (800px utsnitt, 12.5% av bildet)
- Canvas `toDataURL()` → base64-PNG → `postMessage` → React Native
- Ingen native snapshot (ViewShot) — alt i WebView canvas
- Feature-flag: `BRUK_SCREENSHOT_TEGNING = true` i sjekkliste.ts

**Bilde-URLer:** `hentWebUrl() + "/api"` som bildeBaseUrl — alle bilder via Next.js proxy

**Forhåndsvisning:** `PdfForhandsvisning`-komponent — WebView med HTML-preview. Del-knapp genererer PDF via `expo-print` → `expo-sharing`.

**Flyt:** Share-ikon → forhåndsvisning → Del-knapp → PDF → iOS delearket

**Sider:** Ren block-layout (ingen `<table>` wrapping). `page-break-inside: avoid` på feltblokker. `page-break-after: always` etter tegning.

**Støttede felttyper:** text_field, list_single/multi, traffic_light, integer/decimal/calculation (med enhet), date, date_time, person, persons, company, weather, signature (base64), repeater (med barnefelt), bim/zone/room_property, attachments.

**Lokasjonsvelger:**
- Vises øverst i felter-listen (over rapportobjektene)
- Trykk → fullskjerm tegningsvisning (TegningsVisning) med posisjonsprikk
- Trykk på tegning for å sette/flytte prikk
- «Bytt tegning»-knapp i bunnbar
- GPS-auto-valg ved opprettelse (erInnenforBounds, sist brukt fallback)

**Opprett-modal:**
- Dokumentflyt-filtrering: kun entrepriser med flyt for valgt mal
- Auto-kobling: én flyt → auto-velg, flere → dropdown
- GPS-lokasjon sendes med ved opprettelse (byggeplassId + drawingId)
