# Mobil — React Native / Expo

## React Native-mønstre

- **Modal-rendering:** ALLTID `<Modal visible={...}>` — ALDRI `{betingelse && <Modal>}` (animasjonsfrys)
- **SafeAreaView i Modals:** Bruk fra `react-native` (IKKE `react-native-safe-area-context`)
- **React Query invalidering:** Invalider query-cache etter mutasjoner
- **`InteractionManager.runAfterInteractions`:** MÅ brukes etter kamera/picker lukkes
- **Lukkeknapp i modaler/fullskjerm:** ALLTID i en header-bar under SafeAreaView — ALDRI absolutt posisjonert (havner under notch/Dynamic Island). Standard: `<X size={22} color="#ffffff" />` med `hitSlop={12}` i en `flex-row items-center px-4 py-3` View. Se `PdfForhandsvisning.tsx` som referanse.

## Opprettelsesflyt

`OpprettDokumentModal` — brukes for både sjekklister og oppgaver.

**Synlighet uten speil-state (frys-rotårsak, 2026-10-07):** `<Modal visible>` bindes DIREKTE til `synlig`-propen (`OpprettDokumentModal.tsx`). Tidligere speilet modalen `synlig` i en lokal `internSynlig`-state som hang én render etter: når auto-opprett fullførte og parenten satte `synlig=false`, sluttet `return null`-vakten (entydig kontekst) å slå inn mens speilet fortsatt var `true` → en native `<Modal visible={true}>` ble montert i ÉN render samtidig med `router.push` og etterlot en usynlig, touch-fangende modal-host over sjekklisten (frysen; fjerde gang i klassen a29f89b2 · df86b817 · d4a76020 · 28e55ed5). Ved å binde `visible` til `synlig` kan modalen aldri rendres synlig etter at `synlig` er satt `false`. Opprett-suksess navigerer DIREKTE i `fullførOpprett` (ikke via `<Modal onDismiss>`). Grep-vakt: `oppgave-modal-synlig-vakt.test.ts`.
- **Auto-opprett-skip er nå trygt ved entydig kontekst** (bestiller-faggruppe + flyt + utledet svarer): trykk mal → kort «Oppretter…»-spinner (ingen skjema-flash) → rett inn i utfyllingen, ingen «Opprett»-bekreftelse. Ved reell flertydighet (≥2 faggrupper/flyter) beholdes skjemaet for manuelt valg.
- **Flyt-oppløsning = serverens `mal.opprettbareFlytIder` (én sannhet med mal-velgeren):** Modalen bygger flyt-kandidatene FRA det server-feltet (`mal.hentForProsjekt`, `mal.ts:84-95` — samme registrator-medlemskaps-regel som `sjekkliste.opprett`/`oppgave.opprett` validerer på), ikke en egen klient-regel. Bestiller = flytens eier-faggruppe (`df.faggruppeId`); utfører = medlem `rolle="utforer"` (fallback eier = intern flyt) — paritet med web `malFlytStatus`. Retter divergens der en mal vises opprettbar i velgeren, men opprett feilet med «Dokumentflyt er påkrevd»: den gamle `matchendeDokumentflyter` krevde at brukerens EGEN faggruppe var flytens bestiller (bommet på registrator via gruppe/projectMember), OG modalen sendte aldri `dokumentflytId` i mutate-payloaden. Nå auto-velges/​sendes `dokumentflytId` fra kandidat-flyten. Ingen server-endring (`verifiserFaggruppeTilhorighet` godtar bestiller=eier-faggruppe via flyt-medlemskap). `fix/mobil-opprett-flytresolusjon`.
- **Bestiller-faggruppe**: Auto-velges når det finnes kun 1 eier-faggruppe blant de opprettbare flytene for malen
- **Utfører/svarer**: Auto fra valgt dokumentflyt (read-only), medlem `rolle="utforer"`
- **Tittel**: Oppgave = malnavn (redigerbar); API tildeler løpenummer
- **Lokasjon**: GPS-auto + sist brukt byggeplass/tegning, redigerbar i modalen. Ved auto-opprett er GPS **best-effort** — det som er utledet ved opprett tas med, vi venter ikke (fallback-stigen: manglende signal blokkerer aldri opprettelse). Lokasjon kan settes i detaljskjermen etterpå. GPS-på-chip + post-opprett-patch = senere mobil-chip-runde (P4a #2/#3, backlogget)
- **VIKTIG**: Ikke bruk `presentationStyle="pageSheet"` på Modal — forstyrrer navigering etter dismiss på iOS
- Etter opprettelse navigeres til detaljskjermen for umiddelbar registrering

## Bildeannotering

- Annotert bilde erstatter original in-place via `erstattVedlegg()` — ingen duplikater
- `BildeAnnotering`-komponent (`apps/mobile/src/components/BildeAnnotering.tsx`) returnerer annotert fil → `FeltDokumentasjon` oppdaterer vedleggets URL
- Opplastingskø håndterer ny fil med samme vedlegg-ID
- **Tegnemotoren er DELT:** HTML-strengen bor i `@sitedoc/shared` (`packages/shared/src/annotering/annoterings-html.ts`, `ANNOTERINGS_HTML`) og deles med web-flatens annotering. Broen er toveis (mobil: `window.ReactNativeWebView`; web: `window.parent.postMessage`) — ÉN implementasjon. Verktøy-etikettene går via i18n (`annotering.*`), ikke lenger hardkodet i `BildeAnnotering.tsx`
- ⚠️ **Lag-modellen (redigerbar annotering) er foreløpig WEB-ONLY** (Kenneth-vedtak 2026-09-29). Den delte HTML-en BÆRER nå lag-støtten (`settBilde(lag)`, lag-eksport ved lagre, `select`-verktøy) og web bruker den, men mobil sender aldri et lag og viser ikke Velg-verktøyet — mobil erstatter fortsatt originalen in-place (koden over). Mobilens egen lag-runde holdes utenfor denne gaten fordi den rører offline-køen; se [shared-pakker.md § Bildeannotering](shared-pakker.md) + [web.md § Bildeannotering](web.md)

## Statusendring — detalj-redesign M1–M3 (2026-07-30)

Sjekkliste-/oppgave-detaljskjermen ble omstrukturert til **én** flyt-representasjon i
headeren + **P3-mønster** handlingslinje i bunnpanelet. Begge skjermer bruker de samme
FELLES komponentene (ingen duplisert JSX). Speiler web-P3-linjen; ingen server-/statusmaskin-
/ledd-logikk endret — delte kilder: `hentRolleFiltrertHandlinger`, `statusKreverBegrunnelse`,
`byggLedd`/`finnAktivtIndex`.

### M1 — Flytlinje i header (`apps/mobile/src/components/Flytlinje.tsx`)
```
← BEF-002  Befaring betong  [☁][Mottatt]
   [Elektro] → ⟨Byggeleder⟩ +1        ← aktivt ledd = hvit chip, farge-svatt + navn
   ● Du har ballen  /  Venter på Byggeleder
```
- Én linje (erstatter tidligere FlytIndikator + boks-raden i bunn). Farge-svatt (10px) +
  faggruppenavn per ledd; aktivt ledd = hvit chip m/fet tekst. Kompakt: aktiv + nabo, «+N» >3 ledd.
- Mikrotekst under: «Du har ballen» (grønn prikk) når recipient = meg/min gruppe, ellers
  «Venter på [aktivt ledd]». → «hvem har ballen» = 0 taps (synlig).
- Tap → **flyt-sheet (M3)**: ledd vertikalt 1→2→3, nummererte fargede noder, aktivt ledd grønn
  ramme + «DIN TUR»-badge når det er brukerens tur; per ledd faggruppenavn · rolle, ★ hovedansvarlig,
  «(deg)», siste overførings-tidsstempel. Ren visning (ingen statushandlinger), synlig «Lukk».

### M2 — Handlingslinje i bunn (`apps/mobile/src/components/DokumentHandlingslinje.tsx`)
Én primærknapp (kildens `erPrimaer`, ellers første lovlige) full bredde m/retningsnavn
(«Send til [neste ledd]» / «Besvar til [forrige ledd]», fra `byggLedd`) + split-▾ → ÉN sheet
med ALLE øvrige lovlige handlinger fra `hentRolleFiltrertHandlinger` i fabel-rekkefølge:
**framover → Lagre og lukk → destruktive (Avvis, rød) → Videresend → Bytt flyt → Admin.**
Egen flyt-bytte-knapp og ⋯-admin-meny slått sammen inn i denne sheeten.

- **Lagre demotert:** autolagring dekker persistering (alle 21 utfyllbare felttyper, verifisert
  nå-sjekk 2026-07-30) → baren viser «Lagret automatisk HH:MM ✓»-mikrotekst; «Lagre og lukk» bor
  i split-sheeten (validerer ALDRI — utkast kan være ufullstendige).
- **Påkrevd-validering (fabel 2026-07-30):** framover-primær (Send/Besvar) deaktiveres m/caption
  «X påkrevde felt gjenstår» når påkrevde synlige felt mangler — KUN framover. Feltmarkeringen
  (`valideringsfeil`) er veiviseren, captionen er telleren. Erstatter dagens Lagre-knapp-Alert.
- Bekreftelses-sheet ved statushandling beholdt (ER kommentar-inngangen; Avvis krever begrunnelse).
- Ikke-eier/lesevisning: ingen handlingslinje (som før), men flytlinjen (M1) vises alltid.

Klikk-budsjett: **Send 3 → 2 taps** (primær → bekreft), **hvem-har-ballen 0 taps**.

> M4 (Avbryt-affordance i 4 form-modaler) landet separat (`9bbeb2e5`). M5 (tidslinje-kollaps) = backlog.

### Rettighetsbasert UI
`useOppgaveSkjema(id, rettighetInput?)` og `useSjekklisteSkjema(id, rettighetInput?)` — valgfri `rettighetInput` med `utledDokumentRettighet()`. Uten param → gammel status-basert logikk.

## Oppgave-utfylling

`useOppgaveSkjema`-hook i `apps/mobile/src/hooks/useOppgaveSkjema.ts`. Identisk med sjekkliste-utfylling:

```
[Blå header med Flytlinje (M1)]
─── ScrollView ───
  [Tittel] [Prioritet] [Beskrivelse]
  [Koblinger] [Malobjekter] [Historikk]
─── Bunnpanel ───
  [DokumentHandlingslinje (M2): primær m/retning + split-▾]
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

**Bildeannotering (Fabric.js):** WebView-basert canvas. Verktøy: pil, sirkel, firkant, frihånd, tekst. Canvas-resize til bildets 5:4. HTML-en er delt med web via `@sitedoc/shared` `ANNOTERINGS_HTML` (se § Bildeannotering).

**Server-URL-håndtering:** `file://` → lokal, `/uploads/...` → `AUTH_CONFIG.apiUrl + url`, `http(s)://` → direkte.

**URL-konstruksjon:** Alle `/uploads/`-URLer MÅ gå via Next.js proxy: `sitedoc.no/api/uploads/...` (IKKE direkte til API-serveren). Dette gjelder både mobilappen og WebView.

**Filmrull:** Horisontal ScrollView med 72×72px thumbnails (IKKE FlatList).

**Bilderekkefølge:** Velg bilde → `◀`/`▶`-piler i verktøylinjen for å flytte. `flyttVedlegg(objektId, vedleggId, "opp"|"ned")` i begge hooks. Rekkefølgen lagres i vedlegg-arrayet og reflekteres i PDF.

**Modal tekstredigering:** Alle tekstfelt bruker Pressable → fullskjerm Modal med **Avbryt** (venstre i header) + «Ferdig»/handling (høyre). Avbryt-affordance er ufravikelig — en handling skal aldri være eneste utvei ut av en modal (FABEL-RAMMEVERK § Effektivitets-gate pkt 5; Kenneth-mobiltest 2026-07-30, «Ny kommentar» hadde kun Send). Mønster: `<Pressable onPress={() => settVisXModal(false)} hitSlop={8}>` med `t("handling.avbryt")`, samme header-plassering som `OpprettDokumentModal.tsx:573`. Gjelder de fire form-modalene som ble fikset: `oppgave/[id].tsx` (Ny kommentar/Dialog, Rediger tittel, Rediger beskrivelse) + `FeltDokumentasjon.tsx` (Feltkommentar). Avbryt forkaster (lukker uten å lagre/sende — utkast reinitialiseres ved neste åpning); høyre knapp lagrer/sender. Merk skillet mot linje 9: **X-ikon**-standarden gjelder rene visnings-/fullskjermmodaler (PDF, kamera, bilde-zoom); **tekst-Avbryt** gjelder skjema-modaler som har en primærhandling (Send/Ferdig/Opprett) til høyre — iOS Cancel/Done-konvensjon.

## Utviklingsmiljø — Tunnel og nettverk

**API-tilkobling og miljøseparasjon:**
- Sporet i git (2026-07-10): **`.env.test`** → `https://api-test.sitedoc.no` og **`.env.production`** → `https://api.sitedoc.no`. Det finnes **ingen** committet `.env` på disk. Koden leser `process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001"` (`apps/mobile/src/config/auth.ts`). Expo (dev-modus, `expo start`) laster `.env`/`.env.development`/`.env.local` — **ikke** `.env.test`/`.env.production` (de krever `NODE_ENV=test`/`production`). En simulator-kjøring trenger derfor en lokal `.env` (kopiér `.env.test` → `.env`, eller SSH-tunnel-varianten under). `eas.json`: **`development`- og `preview`-profilene peker på prod** (`api.sitedoc.no`) — kun én profil på api-test; overstyr env til test for utviklings-kjøring.
- `.env.production` → `https://api.sitedoc.no` (produksjon, brukes av EAS `production`-bygg)
- `hentWebUrl()` i `apps/mobile/src/config/auth.ts` erstatter alle `replace("api.", "")` / `replace("api-test.", "")` kall — gir korrekt web-URL uavhengig av miljø
- Cloudflare Tunnel på PC. Fungerer fra ethvert nettverk.

**SSH-tunnel dev-tilkobling (simulator mot api-test — brukt i Fase 4 2026-07-10):** Simulatoren nådde ikke `api-test.sitedoc.no` direkte pga. **IPv6/AAAA-stall** (samme rotårsak som [simulator-ipv6-nordvpn.md](simulator-ipv6-nordvpn.md) — simulatorens IPv6-oppslag henger). Løsning: SSH-port-forward til server-ny og pek mobil-`.env` på loopback:
- `ssh -N -L 3301:localhost:3301 server-ny` (forward lokal `3301` → api-test på server-ny)
- mobil-`.env`: `EXPO_PUBLIC_API_URL=http://localhost:3301`
- `localhost` løser via IPv4-loopback → omgår AAAA-fella. Verifiser i Metro-loggen at timer-/prosjekt-kall går mot `localhost:3301`, aldri `api.sitedoc.no`.

**Oppstart-sekvens for simulator mot test-API (rekkefølge er ufravikelig — verifisert 2026-07-28):**
1. **Tailscale må være oppe** — `server-ny` nås kun via Tailscale (`100.76.248.15`). Sjekk at noden er tilkoblet i Tailscale-menylinjen. `ping -c3 100.76.248.15` med 100 % pakketap = server-ny offline → tunnelen vil time ut (`ssh: connect ... Operation timed out`, exit 255).
2. **Start SSH-tunnelen** (eget terminalvindu, `ssh -N` blokkerer): `ssh -N -L 3301:localhost:3301 server-ny`. Verifiser: `lsof -nP -iTCP:3301 -sTCP:LISTEN` skal vise `ssh` som lytter; `curl -s -o /dev/null -w "%{http_code}" http://localhost:3301/` → `404` (server svarer, ingen rot-rute) bekrefter at API-et nås.
3. **Start simulator + Metro:** `cd apps/mobile && npx expo start --clear --ios` (auto-booter sim, installerer Expo Go første gang, åpner appen). Bruker Expo Go — **ingen** `expo-dev-client`.
- **Symptom uten tunnel:** appen laster, men dev-login-knappene gir «Dev-bypass feilet: Fetch feilet mot http://localhost:3301/dev-login: Network request failed». Rotårsak er alltid trinn 1–2 (Tailscale/tunnel), ikke appen.
- **Bundling-feil «Unable to resolve … from …» etter pull:** kjør `pnpm install --frozen-lockfile` fra repo-roten — en ny dependency (f.eks. `expo-application`) mangler symlink i `apps/mobile/node_modules` til install er kjørt. Lockfil er allerede i sync, så `--frozen-lockfile` lager kun lenken (ingen lockfil-endring).
- **Checkout-merknad:** aktiv checkout er `~/Documents/Programmering/SiteDoc` (branch `develop`). Den gamle `SiteDoc-develop`-stien finnes ikke lenger.

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

**V20-M — pausen eies av radene (mobil, `feat/v20-m-pause-mobil` 2026-10-07, OTA):** **PK1** rad-modalens timetall regnes med radens egen pause (`radPauseMinFor`, erstatter firma-default `standardPauseMin` i prefill/synk-vakten M6/B3 over) — grep-vakt `timer-pause-en-kilde-vakt.test.ts`. **PK5** pausevinduet følger firmaets `pauseReferanse`: `matpauseKontekst` (`matpause.ts`) bruker delt `pauseVinduForDag` med `pauseReferanse`/`startTid`/`pauseEtterTimer` fra `hentDagsnormLokalt` (svar-cachen) og dagens rader — «Ankomst» regner fra tidligste `fraTid`, ikke lenger alltid fastStart (P6); mangler cachet norm → fastStart-fallback. `pauseVinduFra` fjernet fra `TimerSeksjon`. **PK7** `ArbeidstidSeksjon` viser «Arbeidstid i dag» utledet av radene (`utledArbeidstidFraRader`, tekst «Utledet av radene under»); pause-feltet er fjernet fra Rediger-modalen (hodet `pauseMin` skrives ikke lokalt utover Σ-speilet, kommer fra server ved pull). **Låst visning:** bæreren vises skrivebeskyttet i rad-lista (`TimerRadVis`) og i attesteringsvisningen (`AttesteringDetaljMobil`). Detaljer i [timer.md § V20 leveranse M](timer.md).

**Maskin-modal speiler web B1/B2/B3 (M5, 2026-07-10):** `MaskinSeksjon.tsx` (`MaskinRadModal`) speiler nå webs `MaskinRadDialog` (ikke `RedigerMaskinRad`, som er leder-attestering uten B2). **B1** — maskintimene trekker lunsjpause via delt `effektiveTimerFraSpenn` med `standardPauseMin` (firma-default fra `hentOrganizationSettingLokalt`, «maskin følger føreren» — IKKE sedel-`pauseMin`, som er Del 2 bucket-taket). **B2** — hard sperre i `lagre()`: når begge tider er satt MÅ `antall == effektiveTimerFraSpenn(...)` (`timer.feil.timerAvvik`), ellers blokkeres lagring. Klient-only (serveren håndhever ikke B2 — se [BACKLOG](BACKLOG.md)). **B3** — `timer`-feltet init fra prefill-spennet. Auto-synk (`handterFraEndret`/`handterTilEndret`/`handterTimerEndret`) via `effektiveTimerFraSpenn`/`tilFraAntall`, sist-rørte felt vinner. **B4-prefill** — `defaultTider` foreslår maskinens driftsvindu fra bucketens arbeidsspenn (første/siste timer-rad i `(defaultProjectId, defaultEcoId)`), faller til `hentEffektivArbeidstidLokal`. Ingen ny i18n (`timer.feil.timerAvvik`/`sluttForStart` finnes), ingen SQLite-migrering. **Synk-vakt:** `syncBatch` validerer nå maskin-`fra<til` (`tilErEtterFra` på `lokal.maskiner`) → `"avvist"` (SYNC-1); før M5 omgikk synkveien vakten. Detaljer i [timer.md § B1–B4](timer.md).

**Gjenåpning — feilkode-mapping (M4, 2026-07-10):** `apps/mobile/app/timer/[id].tsx` sin `gjenaapneMutation.onError` mapper nå på `e.data?.code` i stedet for delstreng på meldingen. **To kjente koder** får egne i18n-tekster: `CONFLICT` → `timer.gjenaapne.feilGodkjent`, `PRECONDITION_FAILED` (attestert-vakt) → `timer.gjenaapne.laastAttestert` (nøkkel finnes i nb+en, delt med web). **Enhver annen kode** viser serverens egen `message` — dette dekker `BAD_REQUEST` (ikke-sent-status) og `FORBIDDEN`/`NOT_FOUND` som `gjenaapneDagsseddel` arver fra eierskaps-helperen `hentEgenDagsseddel` (`apps/api/src/routes/timer/dagsseddel.ts`), pluss alt fremtidig. **Kun fravær av `code`** → `timer.gjenaapne.feilNett`. Tidligere falt alt uten delstrengen `"godkjent"` til «Krever nett» — også attestert-vakten og en sedel arbeideren ikke eier, som er rene server-avvisninger, ikke nett. `NOT_FOUND` fikk samtidig serverside-meldingen `"Dagsseddelen finnes ikke"` (var tom). `e.data.code`/`e.data.httpStatus` er tilgjengelig fra default tRPC-feilform (samme kilde som `erPermanentFeil` i `timerSync.ts` leser). Ingen nye i18n-nøkler. Mobil mangler fortsatt webs proaktive `disabled`-guard (krever SQLite-migrering) — se [BACKLOG](BACKLOG.md). Detaljer i [timer.md § Gjenåpning](timer.md).

**Gjenåpning — bekreftelse før kjøring (M7, 2026-07-10):** `gjenaapne()` i `apps/mobile/app/timer/[id].tsx` viser nå `Alert.alert(bekreftTittel, bekreftTekst, [avbryt(cancel), bekreftKnapp → utforGjenaapne])` før mutasjonen kjøres (paritet med webs `<Modal>`-bekreftelse). Mutasjons-kroppen (inkl. M4-`onError`-mappingen, uendret) er flyttet til `utforGjenaapne()`. Bekreft-knappen er **ikke** `style: "destructive"` — gjenåpning er reversibel (sedelen sendes bare på nytt), ulikt `slettSedel()`. Gjenbruker `timer.gjenaapne.bekreftTittel/bekreftTekst/bekreftKnapp` + `handling.avbryt` (alle i nb+en; var web-only). `Alert.alert` er mobilens bekreftelses-idiom (33 treff/12 filer; talt 32 i M7-Steg-0 før denne endringen selv la til den 33.) — CLAUDE.md § Slett-bekreftelse forbyr `confirm()` i web, ikke RN-dialoger (se [BACKLOG § Alert.alert vs e2e](BACKLOG.md)).

**Offline-cacher (Drizzle/SQLite) for «Start/Slutt dag»-forslag:** `oppmotested_local` (Fase 1, GPS-kontor-identifikasjon) + `arbeidstidskalender_local`/`organization_setting_local` (arbeidstid/reise-regelsett) + **R4 (2026-06-11):** `reisetid_matrise_local` (kjøretid kontor×byggeplass, `kjoretidMin < 0` = uoppnåelig) + `byggeplass_local` (id/projectId/number/status for prosjekt→primær-byggeplass-resolusjon). Refresh via katalog-tjenestene (`oppmotestedKatalog`, `reisetidMatriseKatalog`, `byggeplassKatalog`, …) wiret i `TimerSyncProvider` (per-org, ved login + nett-gjenkomst). Reise-forslaget i `StartSluttDagKort.genererForslag` slår opp matrisen (kontor→primær-byggeplass → faktisk reisetid), med graceful `estimerReisetidMin`-fallback når rad mangler. Detaljer i [timer.md § Reise og oppmøtested](timer.md).

## Flerspråklig (i18n)

**Oppsett:** i18next + react-i18next, gjenbruker JSON-filer fra `packages/shared/src/i18n/` (samme språk og nøkler som web — kanon-liste i `STOETTEDE_SPRAAK`).

**Filer:**
- `apps/mobile/src/lib/i18n.ts` — Config, statisk import av alle språk fra `packages/shared/src/i18n/`, SecureStore-lagring
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
| `sjekkliste_local` | Offline-katalog for sjekklist**elista** (read-only mirror, fase 1 2026-09-11; `user_id` + lesefilter lagt til fase 2 2026-10-03) |
| `oppgave_local` | Offline-katalog for oppgave**lista** (read-only mirror, 2026-10-03) |
| `hms_local` | Offline-katalog for HMS-**lista** (én tabell, `kategori` avvik/sja/ruh, 2026-10-03) |
| `dokument_speil` | Offline-speil av **hele dokumentet** (`hentMedId`-JSON) for LESING uten nett (fase 2 2026-10-03). Nøklet (dokumentType, id, userId); signaturer strippet |

**Offline dokumentlister (fase 1):** list-skjermene leste før rett på tRPC uten fallback → tom liste
uten dekning (brøt CLAUDE.md «Mobil-appen MÅ fungere offline»). Nå speiler `*_local`-tabeller lista.
Delt mønster (`services/sjekklisteKatalog.ts` · `oppgaveKatalog.ts` · `hmsKatalog.ts`): full-overskriv
PER PROSJEKT, henter HELE prosjektet uten `byggeplassId` så lokal lesing selv gjør byggeplass-scopingen.
Kildevalg via den delte rene `velgOfflineListeKilde` (`@sitedoc/shared`, testet): **med nett + bekreftet
svar er serveren autoritativ (også tomt) — like fersk som før**; uten (offline/henger/feilet) leses
lokal cache. Banner skiller «frakoblet, lagrede data (sist hentet …)» fra «ikke synkronisert ennå».
🔴 **Synlighet (alle tre lister):** `oppgave_local`/`hms_local`/`sjekkliste_local` bærer `user_id` og
lesing filtrerer på innlogget bruker — en ny bruker på samme telefon ser ALDRI forrige brukers
(tilgangs-/synlighets-filtrerte) liste offline (speiler den trygge timer-cache-nøklingen). Refresh
full-overskriver per prosjekt for ALLE brukere, så en ny brukers sync også fjerner forrige brukers rader.
🟢 **Lekkasjen i `sjekkliste_local` er lukket fase 2 (2026-10-03):** kolonnen var fraværende (kun
`project_id`); ALTER ADD COLUMN `user_id` (nullable — eksisterende rader kan ikke etterfylles med riktig
eier, så NULL-rader er usynlige for alle til neste refresh skriver eieren). Lukker BACKLOG «SJEKKLISTE-
SPEILET LEKKER VED BRUKERBYTTE».
Refresh trigges i `triggerKatalogRefresh` (sekvensiell fei over aktive `prosjekt_local`-prosjekter,
per-(prosjekt,liste) try/catch — de 13 timer-katalogene upåvirket) + `startOffline` (Mer, valgt
prosjekt, egen try/catch per liste så tegninger lastes uansett). Standalone-prosjekter
(`organizationId=null`) er ikke i `prosjekt_local` → dekkes kun av `startOffline`/list-skjermen.

- **Sjekkliste (2026-09-11):** `sjekkliste.hentForProsjekt`; byggeplass direkte (`byggeplassFilterDirekte`).
- **Oppgave (2026-10-03):** `oppgave.hentForProsjekt` (uten `domain` → HMS ekskludert). Task har ingen
  egen `byggeplassId` — tilhørighet via tegning. Serverens tre-ledds `byggeplassFilterViaTegning`
  kollapser til den samme to-ledds «valgt ELLER byggeplass-løs»-regelen når speilet lagrer den UTLEDETE
  effektive byggeplassen (`drawing.byggeplass.id`; ingen/prosjekt-tegning → null → hele prosjektet).
- **HMS (2026-10-03):** `hms.hentDokumenter` (alle tre kategorier i ett kall → én `hms_local`-tabell med
  `kategori`-diskriminator; atomisk refresh/lesevei). avvik/RUH er Task (byggeplass via tegning), SJA er
  Checklist (direkte) — begge utledes til samme effektive `byggeplassId`. 🔴 Speilet bærer ALDRI `data`/
  signerte vedleggs-URL-er (utløper 15 min); kun visningsfelt. `TASK_SELECT`/`CHECKLIST_SELECT` i
  `apps/api/src/routes/hms.ts` fikk ett additivt byggeplass-felt hver (scalar `byggeplassId` + grunn
  `drawing.byggeplassId`) så offline-lesing kan scope likt serveren.

### Tegningsvisning: trykk-hint, langt trykk og måling (2026-10-08)

`apps/mobile/src/components/TegningsVisning.tsx` (WebView) + `app/(tabs)/lokasjoner.tsx`. OTA-only
(ingen server-endring — `tegning.hentMedId` returnerer allerede `mmPrPiksel`/`scale`/`scaleKilde`/
`imageWidth`/`imageHeight`). Funksjonsendring med hjemmel (Kenneth 2026-10-07).

- **Pekerbasert trykk-klassifisering:** WebView-en rapporterer rå gest (`{type:'gest', varighetMs,
  flyttet, antallPekere, x, y}`) på `pointerup`; RN avgjør via den **rene, testede** `avgjorTrykkHandling`
  (`src/lib/tegningTrykk.ts`, `tegningTrykk.test.ts`): pan (flyttet) og knip (≥2 pekere) → `ingen`;
  målemodus → `malepunkt`; plassering → `opprett`; navigering → langt trykk (≥500 ms) `opprett`, kort
  trykk `hint`. Legacy `onTrykk`/`{type:'trykk'}` (klikk) beholdt for de andre forbrukerne
  (sjekkliste, rapportobjekt, skjermbilde, 3D) — aktiveres kun når `onHint`/`onOpprett`/`maleData`
  mangler.
- **§ 1 Hint:** kort trykk i navigering tegner en hint-boble ved punktet (`window.tegnHint`, ~2 s) og
  blinker modus-bryteren én gang. Ingen bunn-toast. Ikke ved pan/knip, ikke i plassering.
- **§ 2 Langt trykk:** setter markøren OG åpner malvalget direkte (`håndterOpprett`). Plasserings­modus
  beholder dagens verifiser-flyt (sett markør → Bekreft-banner). Kort trykk panorerer som før.
- **§ 3 Måling (tre verktøy, paritet med web):** linjal/polylinje/areal, ett aktivt. **All matematikk
  gjenbrukt fra `@sitedoc/shared`** (`kanMale`, `malMm`, `malArealMm2`, `parseMalestokk`) — ingen kopi.
  Overlayet (polylinje/polygon + punkter + etiketter) injiseres med `window.tegnMaling` (ingen reload;
  re-injiseres i `onLoadEnd` når markør-refetch bygger HTML på nytt). Kilden vises ved resultatet
  («1:50 (fra tittelfeltet)» osv.). **Samme lås som web:** `kanMale` styrer; usann → sperret knapp. Teksten
  følger årsaken (reparasjon 2026-10-09): mangler `mmPrPiksel` → «Tegningen mangler målegrunnlag. Oppdater
  den på web.»; ellers «Målestokken må bekreftes på web». **Ingen kalibrering på mobil.** Måling er papir-veien (georef-
  avstand måles på web). Lukking: linjal etter 2 punkter; polylinje/areal via «Fullfør»/«Lukk flate»
  eller trykk nær et eksisterende punkt (`LUKK_TERSKEL_PCT`). Esc finnes ikke på mobil → «Lukk»-knapp.
- **SVAR (orkestrator):** måling bare online; ingen lokal metadata-tabell (offline-viseren er egen
  ordre). Uten nett er «Mål» sperret likt som ved usann `kanMale`.

**RETUR 1 (2026-10-08) — fire feil fra enhet + dra-punkter:**
- **§1 Størrelse:** punkter/etiketter/hint fikk `scale(1/visualViewport.scale)` **ved opprettelse**
  (ikke bare i `oppdaterZoom`, som tidlig-returnerer ved uendret zoom) → fast skjermstørrelse uansett
  zoom. Punkt 11 px, etikett 9 px.
- **§2 iOS-bildemeny:** `-webkit-touch-callout/user-select/user-drag: none` på `html/body/#container/
  #tegning`, `#tegning { pointer-events:none }`, `draggable=false` + `oncontextmenu` på img. Dette var
  også rotårsaken til at §3/§4 (måletrykk) ikke registrerte — den native bilde-dra-gesten ga
  `pointermove` → `flyttet=true` → trykket ble forkastet.
- **§3/§4 Forrang:** måling har forrang i modus-utledningen (`maleVerktoy` → `"maling"`), og
  `onMaleModusEndring` slår av plasseringsmodus (skjuler banneret) når et verktøy velges.
- **TILLEGG dra-punkter:** et satt punkt kan dras (hit-test ≤ 22 px mot `window.__malePunkter`).
  WebView sender `{type:'maledrag',index,x,y}` live; RN `flyttMalepunkt` oppdaterer uten å røre
  `maleFerdig` (lukket areal/polylinje forblir lukket). En **lupe** (`window.visLupe`, forstørret
  utsnitt + trådkors, forskjøvet over fingeren) vises under draget. Dra avsluttes med
  `gest.drarPunkt=true` → `avgjorTrykkHandling` → `"ingen"` (aldri nytt punkt/hint/opprett; testet).
  Web-paritet: punkt-prikkene i `MaalingOverlay` er dragbare med musa (`onPunktNed`), pan undertrykkes
  via `punktDragRef` i tegningssidens pan-handler.
- 🔴 **Simulator-verifisering blokkert:** `apps/mobile/.env` (dev-login-secret) mangler → ingen
  innlogging → ingen in-app-repro; `.env` er gitignorert/secret (Kenneths hånd). `idb` har ingen
  knip-primitiv → zoom-skalering (§1) kan ikke gest-reproduseres headless. Lupe-plassering trenger
  on-device-finjustering. Verifiseres av Kenneth på enhet etter OTA.

**RETUR 2 (2026-10-08) — strek-skala, flere målinger, valg, slett, høyere zoom:**
- **§1 Strektykkelse:** `vector-effect: non-scaling-stroke` nøytraliserer bare SVG-viewBox-skaleringen,
  IKKE nettleserens pinch-zoom. Streken får nå `stroke-width = 2 · (1/visualViewport.scale)` både ved
  opprettelse og i `oppdaterZoom` (klasse `.male-stroke`) → fast ~2 pt på skjermen. Areal-skravering
  halvgjennomsiktig (`rgba(...,0.15)`).
- **§2 Hit-test / bom-trykk:** ALLE punkter er dragbare (`finnPunkt` itererer `__malePunkter`, som nå
  er den AKTIVE målingens punkter). Et bom-trykk sletter ALDRI en ferdig figur: punktlegging skjer kun
  i en påbegynt aktiv måling (delt `leggTilPunkt`); ellers velges en truffet måling, eller trykket er
  no-op. Ingen reset-på-neste-klikk lenger.
- **§3 Maks zoom:** `maximum-scale` 10 → 20 i viewport-metaen. A1 i 200 DPI ≈ 4600 px bred, vist på
  ~390 pt → mild oppskalering først forbi ~12× zoom; 20× er akseptabelt.
- **🟢 Flere målinger (delt modell):** `packages/shared/src/utils/malinger.ts` — `MaleTilstand =
  {malinger[], aktivId}` + rene reducers (`startMaling`/`leggTilPunkt`/`settFerdig`/`flyttPunkt`/
  `velgMaling`/`slettAktiv`/`slettAlle`/`avsluttAktiv`) + hit-test (`finnMalingTreff`/
  `finnNaermestePunkt`). **Ingen kopi** — web (`tegninger/page.tsx`) bruker samme modul. Trykk på
  verktøyknappen starter en NY måling; forrige blir stående (dempet grå, én resultat-etikett). Trykk
  på en eksisterende måling velger den (WebView sender `rectW/rectH` i gesten; RN hit-tester).
  `window.tegnMalinger` tegner alle (aktiv blå + dragbar, inaktiv grå). «Slett» (aktiv) · «Slett alle»
  (bekreftelsesmodal, ikke `confirm()`) · «Lukk». `onMaleModusEndring(aktivId != null)`. Målinger
  lagres IKKE (forsvinner når tegningen lukkes). Tester: `packages/shared/src/utils/malinger.test.ts`
  (hit-test alle punkter · bom-trykk sletter aldri · flere målinger/valg/slett).

**RETUR 3 (2026-10-08) — eksplisitte verktøy, set-on-release, lupe ved siden, §0 skjermlås:**
- **🔴 § 0 skjermlås (rotårsak + fiks):** den gamle gesten gjettet fire ting (nytt punkt / dra / velg /
  langt trykk) ut fra hvor/hvor lenge fingeren lå, og pekertelleren (`antallPekere`) kunne bli stående
  > 0 hvis en `pointerup` gikk tapt (systemgest/overtatt) → `slutt()` returnerte tidlig for alltid =
  lås. Fiksen: gest-livssyklusen er forankret i PRIMÆRfingeren og nullstilles HELT ved
  `pointerup`/`pointercancel` (`nullstill()` tømmer `pekere={}`), pluss selvheling (nytt nedtrykk
  > 1,2 s etter siste hendelse nullstiller først). Ingen teller som kan låse. Lupa ryddes alltid.
- **Eksplisitte verktøy (ren funksjon):** `avgjorTrykkHandling(verktoy, gest)` i `src/lib/tegningTrykk.ts`
  tar nå `TegningVerktoy` (navigering/flytt/linjal/polylinje/areal/opprett) + kontekst (`nedPaaPunkt`,
  `traffMaling`) → `settPunkt/draPunkt/velgMaling/opprett/hint/pan`. Verktøyet — ikke gjetting — avgjør.
  Tester (`tegningTrykk.test.ts`): «trykk i Flytt setter ALDRI punkt» og «trykk i måleverktøy drar
  ALDRI» (begge røde før RETUR 3), + knip→pan, opprett, navigering.
- **Verktøylinje:** `[✋ Flytt] [📏 Linjal] [〰 Polylinje] [▱ Areal] [＋ Opprett]`, ett aktivt.
  Måleverktøyene sperres når `kanMale` er usann; Flytt/Opprett alltid. Ferdig figur → auto til Flytt med
  figuren valgt. Flytt = velg + dra (aldri punkt). ＋ Opprett = markør + mal (erstatter langt trykk mens
  et verktøy er i bruk). Uten verktøy = forelderens bryter (plassering → opprett) / navigering (hint,
  langt trykk). `window.__maleModus` injiseres ved modusbytte så WebView-en vet hva gesten skal gjøre.
- **§ 2 Set-on-release + lupe:** punktet settes ved SLIPP (`touch-up`), ikke nedtrykk — så man kan
  justere mot lupa først. Lupa (`window.visLupe`, ~2,5× lokal zoom + trådkors) står forskjøvet OPP og
  TIL SIDEN for fingeren og bytter side/retning ved skjermkanten; vises i måleverktøy (alltid) og i
  Flytt (på punkt). Flytt drar live (`maledrag`); måleverktøy committer på slipp (`gest` → `settPunkt`).

**RETUR 4 (2026-10-08) — pan-sperre under drag, synlig lupe, piltast-finjustering:**
- **🔴 § 1 Tegningen panorerte under drag:** pointer-events' `preventDefault` stopper IKKE
  WKWebView-scroll/zoom. Fiks: non-passive `touchmove`-lytter på `#container` som `preventDefault`-er
  når `lupeAktiv` (ett-finger sett/dra) og `!pinch` → tegningen står helt stille mens et punkt
  settes/dras. Knip (≥2 fingre) og vanlig pan slippes gjennom. Pan-sperren = samme predikat som
  `visLupeForGest` (testet i `tegningTrykk.test.ts`).
- **🔴 § 2 Lupa usynlig på enhet (rotårsak):** `position: fixed` rendres upålitelig i WKWebView under
  pinch-zoom (forankres til visuelt viewport). Fiks: `position: absolute` forankret i SIDEKOORDINATER
  (`pageX/pageY`), lagt på `document.body` (ikke `#container`, som kan klippe), `z-index: 9999`, og
  **quotet** `url("…")` (en usitert signert URL med spesialtegn kan knekke `background-image`). Lupa er
  nå ~100 pt, ~3× lokal zoom, forskjøvet ~80 pt opp/side (RETUR 4-mål). Geometrien er rene, testbare
  funksjoner i `src/lib/lupe.ts` (`lupePlassering` kant-flipp · `lupeBakgrunn` 3×-crop · `nudgePunkt` ·
  `Z_LUPE > Z_MALELAG …` z-rekkefølge) — `lupe.test.ts`. WebView-JS speiler matematikken.
- **Piltast-finjustering:** et punkt som dras/trykkes i Flytt blir «valgt» (`valgtPunktIndeks` fra
  `gest.dragIdx`); stripa viser fire piler (← ↑ ↓ →). Hvert trykk flytter punktet 1 skjermpiksel
  (`nudgePunkt`, px→prosent via siste viste bilde-rect); langt trykk gjentar (hold-repeat, 90 ms).
- 🔴 **Verifisering: ingen simulator (Kenneth-vedtak 2026-10-08).** Simulator-sporet ble opphevet
  («koster mer enn å teste selv»). Verifisert via rene tester + testbar logikk (gest-modell,
  pan-sperre-predikat, lupe-geometri, nudge). Kenneth tester på telefon etter OTA.

**RETUR 5 (2026-10-08) — bare siste punkt flyttes, usynlig lupe, piltastene ut:**
- **🔴 § 1 Bare siste punkt kunne flyttes på enhet (rotårsak):** drag-hit-testen i den injiserte
  WebView-JS-en (`finnPunkt`) regnet i SKJERM-koordinater (`clientX`/`getBoundingClientRect`), mens
  lupa — det eneste som ble synlig i RETUR 4 — regnet i SIDE-/DOKUMENT-koordinater (`pageX/pageY`).
  Under WKWebView pinch-zoom + pan peker de to rommene på ulike steder, og avviket vokser med
  scroll-offset → bare punkter nær der man nettopp zoomet (typisk det siste satte) traff
  treffradiusen. **Fiks:** alt regnes nå i side-/dokumentkoordinater (`pageX/pageY` + bildets
  offset-boks `offsetLeft/Top/Width/Height`, alt zoom-invariant), og treffradius skaleres med
  `1/zoom`. Matematikken er rene, testbare funksjoner i `src/lib/tegningKoordinat.ts`
  (`sideTilProsent` · `finnNaermesteSidePunkt` · `sideTilSkjerm`); `tegningKoordinat.test.ts` treffer
  **punkt nr. 1 av 4** med WebViewens transform (zoom ≠ 1, scroll ≠ 0) og demonstrerer bugen. Den
  injiserte JS-en speiler funksjonene.
- **🔴 § 2 Lupa fortsatt usynlig → RN-nativ lupe (plan B):** den DOM-baserte lupa (RETUR 4,
  `window.visLupe`) ble aldri synlig på enhet. Flyttet UT av WebView-en: WebView-en poster nå
  `{type:'lupe', fingerX/Y (synlig skjerm-dp), pctX/Y (bilde), dispB/H (vist bildestørrelse)}`, og RN
  tegner en `<View>`-sirkel (~100 pt) med et forstørret `<Image>`-utsnitt (~3×) + trådkors i senter.
  Plassering/crop gjenbruker `lupePlassering`/`lupeBakgrunn` fra `src/lib/lupe.ts` (testet,
  crop-rect-akseptansetest: trådkorset treffer bildepunktet uansett zoom). DOM-lupa + CSS fjernet.
- **§ 3 Piltastene fjernet:** `valgtPunktIndeks`-pilrad + `nudgePunkt` er borte (Kenneth: «stegene blir
  for store og løser ikke problemet»). Lupa er presisjonsgrepet. Renest mulig UI.
- Verifisert via rene tester (hit-test punkt 1 av 4 under zoom/scroll, crop-rect, full mobil-suite) +
  mobil-typecheck. Kenneth tester på telefon etter OTA.

**RETUR 6 (2026-10-08) — areal lukket seg selv, rediger figur, lupe-hopp, zoom/oppløsning, forhåndslast:**
- **🔴 § 1 + TILLEGG — figur avsluttes KUN eksplisitt.** Polylinje auto-lukket før på trykk nær et
  hvilket som helst punkt (`malinger.ts punktTilMaling: some(erNaer)`) → ferdig → mobil hoppet til
  Flytt «av seg selv»; areal lukket for lett fordi terskelen var i PROSENT (`LUKK_TERSKEL_PCT = 3.5`),
  enorm ved innzoom. Fiks: polylinje auto-lukker **aldri** (kun Fullfør/Enter); areal lukkes kun ved
  trykk på FØRSTE punkt, nå med terskel i SKJERM-px (`LUKK_TERSKEL_PX = 12`, regnet mot vist
  bildestørrelse fra gesten) eller «Lukk flate». `avgjorTrykkHandling` i måleverktøy returnerer alltid
  `settPunkt` (bytter aldri til Flytt). Test: N raske trykk i polylinje/areal → aldri ferdig/Flytt
  (`malinger.test.ts`), og måleverktøy setter punkt uansett gest (`tegningTrykk.test.ts`).
- **🟢 § 2 Rediger figur etter etablering (hjemmel: Kenneth).** Delte, testede funksjoner i
  `malinger.ts`: `settInnPunktPaaKant` (nytt hjørne etter en kant), `fjernPunkt` (beholder min 3 areal
  / 2 linje), `finnNaermesteKant` (kant-treff inkl. sluttkant for lukket areal), `nyKantPunktIndeks`.
  **Mobil (Flytt):** trykk på en kant setter inn et hjørne og drar det straks (injisert `finnKant` →
  `settInnKant`-melding → shared; `window.__maleLukket` = areal+ferdig styrer sluttkanten); langt trykk
  på et hjørne → `fjernPunkt`-bekreftelsesmodal. Hint i stripa. **Web:** shift-klikk på en kant setter
  inn, klikk velger et hjørne (uthevet ring), Delete/Backspace fjerner det.
- **🔴 § 3 Lupa hoppet/stoppet over elementer.** `setPointerCapture` på `#container` ved gest-start →
  pointermove/up havner på beholderen selv når fingeren drar over en markør/målelinje/tekst; posisjon
  regnes uansett fra `pageX/pageY` (RETUR 5). Capture slippes ved slipp.
- **§ 4 (MÅLT) oppløsning + zoomgrense.** Mobil laster FULL 200-DPI-PNG via `fileUrl` — ingen
  forminsket/thumbnail-variant finnes (tegningen gjøres ikke mindre). Zoom var kappet på 20× av
  `maximum-scale=20` (ingen native WKWebView-cap: `scalesPageToFit={false}`, ingen `maximumZoomScale`);
  web tillater 50×. Hevet mobil til `maximum-scale=50` for å matche web.
- **§ 5 Lupa kommer med en gang.** `Image.prefetch(tegningUrl)` når tegningen åpnes, så RN-lupa (samme
  URL) har bildet i cache før fingeren legges ned.
- Verifisert: shared + mobil-tester grønne, mobil/web-typecheck + eslint rent. Kenneth tester på
  telefon etter OTA. Ikke publisert OTA.

**90°-lås + snapping (ordre «90°-lås og snapping» + GJENOPPTA, 2026-10-08):**
- **Delt geometri** i `packages/shared/src/utils/maaling.ts` (begge flater kaller SAMME funksjon):
  `laasVinkel` (lås til nærmeste av vannrett/loddrett/vinkelrett-på-forrige, ELLER parallelt/vinkelrett
  på en referanselinje), `snapTilPunkt` (12 pt skjerm), `snapTil90Linje` (H/V-hjelpelinjer fra punkter),
  `aksehjelpelinje` (akse tvers over bildet), `beregnSnap` (presedens: punkt-snap > ortho-lås >
  hjelpelinje; returnerer `punkt`, `traffPunkt`, `hjelpelinjer`, `aksehjelpelinje`, `vinkelrett`). Alt i
  pikselrom (prosent forvrenger vinkler). Tester i `maaling.test.ts`.
- **Tre toggler** i måleverktøylinja: **90°** (`TriangleRight`), **Referanse** (`Spline`, kun når 90° på),
  **Snap** (`Magnet`, PÅ som standard).
- **Referanselinje (GJENOPPTA § 1 — skrå vegger):** trykk «Referanse», så på et segment i en eksisterende
  måling (vegg langs en skrå linje) → neste linje låses PARALLELT eller VINKELRETT på den, uten snap til
  tegningsgeometri. Referanselinja vises gul (persistent, i `tegnMalinger`).
- **Veiledning (GJENOPPTA § 2):** stiplet akse fra ankeret + H/V-hjelpelinjer tegnes live via `tegnVeiledning`
  (round-trip: RN beregner med delt `beregnSnap`, WebView-en tegner); «90°»-etikett når linja står
  vinkelrett. Snap/lås anvendes på commit (gest `settPunkt` + `maledrag`) så LAGRET geometri er den testede.
- **Snap til egne punkter:** et punkt som slippes innen ~12 pt av et eksisterende målepunkt (alle målinger)
  legges eksakt der; lukker også areal mot første punkt.
- **§ 3 (MÅLT, ikke bygd):** mobil/web viser tegningen som RASTER-PNG (PDF→PNG 200 DPI); SVG-path finnes kun
  for DWG-konverterte. Snap til tegningens egne linjer/hjørner krever enten vektorgrunnlag (`pdftocairo -svg`
  ved konvertering) eller kantdeteksjon i bildet — se leveransen for omfang. Referanselinje-grepet dekker
  skrå vegger uten dette.

**RETUR 1 (2026-10-09) — snap fester seg ikke til usynlige objekter:** `beregnSnap` tar nå et valgfritt
`utsnitt` (synlig del av bildet i prosent). WebView-en beregner det (`utsnitt(box)`: `visualViewport` mot
bildeboksen) og legger det på `forhaandspunkt`/`maledrag`/`gest`-meldingene; RN sender det til
`beregnSnapForKandidat`. Snap-mål og 90°-hjelpelinjer utenfor utsnittet ignoreres (margin pr. akse =
treffradius→prosent). I tillegg nullstilles `maleTilstand` ved `tegningUrl`-bytte så målinger fra en annen
tegning ikke blir snap-kandidater. Treffradiusen var allerede i skjerm-px (`box.bredde*visualViewport.scale`)
— ingen endring der. Tester: `maaling.test.ts`.

### Offline-LESING av dokumenter (fase 2, 2026-10-03)

Fase 1 speilet LISTENE; trykk på et dokument offline ga spinner/«ikke funnet». Fase 2 speiler
HELE dokumentet (`hentMedId`-svaret) i `dokument_speil` så detaljskjermen kan rendre uten nett i
**tvungen lesemodus** (sjekkliste · oppgave · HMS — HMS har ingen egen hook, så begge
skjema-hookene dekker SJA/avvik/RUH). Tjeneste: `services/dokumentSpeil.ts`.

- **Når speiles det?** (1) **Write-through:** hver gang `hentMedId` lykkes online lagres svaret
  (`useSjekklisteSkjema`/`useOppgaveSkjema`, ingen ekstra nettkall). (2) **«Forbered offline»**
  (`mer.tsx`): forhånds-nedlaster prosjektets ikke-terminale dokumenter fra de nå-oppdaterte
  listene. Tak: `FORHAANDSLAST_TAK = 200`, stopper ikke på ett feilet dokument.
- 🔴 **Bieffekt-fri forhånds-nedlasting:** `hentMedId` stempler `lestAvMottakerVed` når mottakeren
  åpner. Forhånds-nedlasting skal ALDRI endre lesekvitteringen → egne server-prosedyrer
  `sjekkliste.hentForOffline` / `oppgave.hentForOffline` (delt leser med `stemplLest`-flagg;
  online-atferd bit-identisk). **Mobilen tåler gammel server:** mangler prosedyren (NOT_FOUND),
  hoppes forhånds-nedlasting over stille-men-logget — write-through virker uansett.
- 🔴 **Signaturer strippes før lagring** (`raaVedleggIData`, @sitedoc/shared) — samme skrive-vei-
  vaksine som server. Signaturer (base64 i `data`) vises offline; bilder krever nett → eksisterende
  `BildeFallback`-plassholder.
- **Visning offline:** hooken faller tilbake til speilet når `hentMedId` er offline/feilet (kildevalg
  via delt `velgOfflineListeKilde`), tvinger `erRedigerbar=false`, og eksponerer
  `offlineModus`/`offlineHentetVed`/`offlineIkkeLastet`. Skjermen viser banner «Frakoblet – viser
  lagret versjon fra {tid}», skjuler handlingslinjen, og viser «ikke lastet ned»-tekst (ikke evig
  spinner) når dokumentet ikke er i speilet. Prosjekt-queriene (flyt/faggrupper/tillatelser) tåler
  `undefined` offline. **Ingen skriving offline.**
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

**Flere oppgaver pr. felt (C, 2026-10-07):** Et felt kan ha FLERE oppgaver — hver vises som en egen blå chip, og `+Oppgave` blir stående ved siden av (erstattes ikke), så ett felt kan utløse flere oppgaver. Datamodellen tillot dette alt (`Task.checklistFieldId` ikke unik, ingen server-sjekk); kun klienten begrenset til én. `FeltWrapper` tar nå `oppgaver: {id, nummer?}[]` (ikke `oppgaveNummer`/`oppgaveId`), og speiler repeater-radenes chip-mønster (`RepeaterObjekt.tsx`). Repeater-radene er uendret (per-rad `radOppgaver`).

## 🟢 Mobilens dokumentsøk er LISTESØK, ikke innholdssøk (Kenneth-vedtak 2026-09-06)

> **Kenneth, etter å ha testet sheetet på test:** *«Egentlig — fritekstsøk inni dokumenter
> hører til web-flaten. App er ok slik den står nå.»*

**Søkeindeksen** (`dokumentlisteFilter.ts:96`): dokumentnummer · tittel · emne · malnavn ·
dokumentflyt · byggeplass · tegning. **`Checklist.data` er IKKE med** — altså ikke det brukeren
har skrevet i tekstfeltene.

**Hvorfor det er riktig:** listesøket svarer på *«finn dokumentet jeg vet finnes»*. Innholdssøk
ville krevd at telefonen laster alle dokumenters fulle `data`-JSON for å filtrere en liste — og
produktet har allerede en flate for det: **Dokumentsøk** med embedding og hybrid søk
([ai-sok.md](ai-sok.md)).

⚠️ **Ikke meld dette som en mangel.** Endres vedtaket, er innholdssøk på mobil en egen sak med
egen kostnadsmåling.

## 🟢 Dokumentflyt på mobil er LESEVISNING — og det er etter design (målt 2026-09-06)

**Kenneth meldte at flaten «ser ulik ut» på mobil og web.** Målt av redesign-Opus:
**forskjellen er legitim, og saken er avklart bort — ikke utsatt.**

| Flate | Er |
|---|---|
| **Web** (`oppsett/produksjon/dokumentflyt`) | Konfigurasjon: faggruppe → flyt → roller som steg-kort, «+ Legg til rolle», maler. **Eier hele konfig-settet** — opprett/oppdater/slett, `leggTilMedlem`, `oppdaterRoller`, `settHovedansvarlig`, `settKanRedigere` |
| **Mobil** (`dokumentflyt.tsx`) | **Oppslagsvisning: «hvem har ballen, hvem er med».** Tre `useQuery`, **null `useMutation`** — eksplisitt dokumentert read-only i koden (`:114-127`) |

🔴 **«Redigerer»-etiketten på mobil er en TILGANGSTILSTAND, ikke en rolle.** Den er
`kanRedigere`-boolen per dokumentflyt-medlemskap: grå «Redigerer» = skrivetilgang, amber
«Leser» = kun lese. **De ekte rollene** (Registrator/Bestiller/Utfører/Godkjenner) vises i
per-flyt-detaljen når raden ekspanderes (`:308`).

**Hvorfor det ikke er en paritetsfeil:** [feltarbeid-skillet](SAMARBEIDSREGLER.md) sier at
mobil får feltarbeidet og web kontorarbeidet. **Å konfigurere en dokumentflyt er kontorarbeid.**
Testen for ekte paritetsfeil er *«kan samme handling gi ULIKT UTFALL på de to flatene»* — og
mobil har ingen handling som skriver. **Ulik form er greit; ulikt utfall er ikke.**

⚠️ **Ikke meld dette som funn på nytt.** Endres det slik at mobil får en mutasjon, er saken en
annen — da gjelder paritetsregelen igjen.

## PDF-utskrift og deling

**PDF-bygger:** `@sitedoc/pdf` (packages/pdf/) — delt pakke for web og mobil. Genererer komplett HTML-strenger.

**Arkitektur:**
- `byggSjekklisteHtml()` tar data-objekter + config → returnerer HTML (`byggOppgaveHtml` pensjonert 2026-08-12 — var kallerløs)
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
