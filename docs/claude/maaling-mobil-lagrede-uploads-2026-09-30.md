---
tittel: "MÅLING — mobilens lagrede /uploads/-URL-er mot default-deny + 15-min-signatur"
type: maaling
status: ferdig
opprettet: 2026-09-30
forfatter: kontrollplan (Opus)
ordre: relay/inbox-mobil-lagrede-uploads-urler.md (cowork, 2026-09-30)
sist_verifisert_mot_kode: 2026-09-30 (develop 230f2b64)
gjelder_kode:
  - apps/mobile/src/hooks/useSjekklisteSkjema.ts
  - apps/mobile/src/hooks/useOppgaveSkjema.ts
  - apps/mobile/src/utils/signerteUrler.ts
  - apps/mobile/src/providers/OpplastingsKoProvider.tsx
  - apps/mobile/src/components/rapportobjekter/FeltDokumentasjon.tsx
  - apps/api/src/utils/hmac.ts
  - apps/api/src/utils/vedleggSignering.ts
  - apps/api/src/utils/signerUploadsOutput.ts
  - packages/shared/src/utils/uploadsSti.ts
  - packages/shared/src/utils/vedleggLokal.ts
---

# MÅLING — hva skjer med mobilens LAGREDE `/uploads/`-URL-er etter prod-deploy?

**Ingen kodeendring. Måling og rapport.** Bestilt fordi prod (`eb9071f2`, 24.09) ligger 174
commits bak develop, og to endringer som **aldri har kjørt utenfor develop** treffer mobilens
lokale base: (1) **default-deny på HELE `/uploads/`** — enhver fil krever gyldig HMAC-signatur,
ellers 401 (`hmac.ts:236` `vurderUploadsFilForesporsel`), og (2) **signaturlevetid 24 t → 15 min**.

---

## Svar Kenneth kan handle på

> **Vil A.Markussens telefoner miste bilder dagen etter en prod-deploy — ja, nei, eller under
> hvilke betingelser?**

**Under betingelser — for det store flertallet NEI, men JA i et avgrenset, forbigående vindu, og
det vinduet er nettopp gjort verre av 24 t → 15 min.**

- 🟢 **NEI for normaltilfellet.** Mobilen lagrer vedlegg-URL-er **rått** (`/uploads/…` uten
  signatur) på skrive-veien, og bytter RÅ→signert **kun i visningen** fra en fersk server-emisjon
  (`signerteUrler.ts`). Så lenge telefonen er på nett og dokumentet er synket, hentes en fersk
  15-min-signatur ved hver visning/refetch (React Query refetcher ved app-fokus og reconnect). Rå
  URL-er kan ikke utløpe, og de re-signeres ferskt. **Offline** kan bildene uansett ikke lastes —
  men det er forventet offline-atferd (mobilen laster **ikke** ned foto lokalt, krav 2), ikke et
  deploy-tap.

- 🔴 **JA, forbigående, under disse betingelsene samtidig:** et dokument med **ikke-synkroniserte
  offline-endringer** der SQLite bærer en **signert (utløpende) vedlegg-URL** fra en tidligere
  synket init (se **Funn C**), vist **online** etter at 15-min-vinduet er passert og **før** neste
  vellykkede sync. Da 401-er bildet, og display-resolveren kan **ikke** lege det — den leger kun
  **RÅ** URL-er, ikke utløpt-signerte (`signerteUrler.ts:70`). Det løser seg ved neste vellykkede
  server-sync (da flippes `erSynkronisert`, og neste init henter fersk data). Altså **forbigående,
  ikke permanent** — men i vinduet er bildet dødt, og mobilen har **ingen selvfornyelse** (krav 3),
  så et feilet bilde blir liggende feilet til komponenten re-monteres / query-en refetcher.

- ⚠️ **Feilen er ikke alltid stille, men noen ganger er den det.** Sjekkliste/oppgave-vedlegg viser
  en **synlig** feiltilstand («Vedlegget kunne ikke lastes» + `ImageOff`-ikon,
  `FeltDokumentasjon.tsx:399-410`). Men **PSI-/instruksjonsbilder** (`InfoBildeObjekt.tsx:24-28`)
  har **ingen `onError`** → de feiler helt stille (tom ramme), akkurat slik ordren fryktet.

- 🔴 **Det jeg IKKE fikk målt: faktisk innhold i A.Markussens lokale base.** Det krever en enhet
  eller en simulator mot **test** (der gaten alt kjører). **Simulatoren peker mot PROD** — jeg la
  den ikke om (egen, uavklart sak; ordren forbød det). Rapporten hviler derfor på **kodelesing**,
  som ordren aksepterer for krav 1–4. Den empiriske bekreftelsen (lagre data, vent 15 min, se om
  bildet lever) gjenstår og bør kjøres mot test før deploy — se **Anbefalt neste steg**.

---

## Hvordan mobilen håndterer `/uploads/`-URL-er (mekanismen)

Serveren gater hele `/uploads/`-treet default-deny og **signerer ved EMISJON, aldri ved lagring**.
To signeringsveier, begge nøkkel-agnostiske (enhver `/uploads/`-streng, uansett feltnavn/nivå):

- **Global query-middleware:** `signerUploadsOutput.ts` (`signerOutputHvisQuery`) signerer alle
  `/uploads/`-strenger i **ethvert tRPC query-svar**.
- **Eksplisitt ved emisjon:** `sjekkliste/oppgave.hentMedId` → `signerDataRad` → `signerVedleggIData`
  (`vedleggSignering.ts:45`). ⚠️ Merk: kommentaren i `vedleggSignering.ts:17` sier at signeringen er
  «no-op utenfor `/uploads/privat/`». **Den er STALE** (datert 2026-08-12). Gjeldende
  `signerHvisPrivat` (`hmac.ts:108-112`) signerer nå **hele** `/uploads/`-treet
  (`url.startsWith(UPLOADS_PREFIKS)`). Navnet er misvisende; funksjonen dekker alt.

Mobilen holder — **etter design** — `feltVerdier` rå, og resolver RÅ→signert kun i visning:

- **Skrive-vei (fersk opplasting):** opplastingssvaret er en REST-rute utenfor tRPC
  (`upload.ts:166`), så den returnerer **rå** `fileUrl`. Skrives rått til `opplastings_ko.serverUrl`
  (`OpplastingsKoProvider.tsx:447`) og inn i `feltVerdier` (`useSjekklisteSkjema.ts:344`). **RÅ.**
- **Vis-vei:** `hentFeltVerdi` kjører `resolveSignerteUrler(fv, map)` der `map` bygges ferskt fra
  server-emisjonen (`samleSignerteVedleggUrler`, `useSjekklisteSkjema.ts:354-367`). Bytter RÅ
  `/uploads/`-URL til den signerte serverversjonen, matchet på vedlegg-`id`, immutabelt.
- 🔴 **Kritisk grense:** `resolveSignerteUrler` bytter **kun** når `erRaaUploadsUrl(ny.url)` er sann
  — dvs. URL-en er RÅ (`!url.includes("sig=")`, `uploadsSti.ts:22`). En **allerede-signert
  (utløpt)** URL slipper urørt gjennom (`signerteUrler.ts:70`). Resolveren leger altså rå, men
  **ikke** utløpt-signert.

Mobilen har **ingen** motstykke til webs `raaVedleggIData` (nøkkel-agnostisk strip på skrive-veien).
Grep etter `raaVedleggIData` i `apps/mobile` gir null treff. Mobilen er derfor **helt avhengig** av
at `feltVerdier` faktisk ER rå — og der bryter init-veien forutsetningen (Funn C).

---

## Per krav

### Krav 1 — hva lagres lokalt, og i hvilken form?

Lokale kolonner med `/uploads/`-strenger (`apps/mobile/src/db/schema.ts`):

| Tabell / kolonne | Domene | Form | Vei |
|---|---|---|---|
| `sjekkliste_feltdata.felt_verdier` (JSON) | Sjekkliste (+ HMS/RUH/avvik/SJA — samme hooks) | **RÅ** ved fersk opplasting · **SIGNERT** ved init fra synket server-data (**Funn C**) | opplastingskø / init |
| `oppgave_feltdata.felt_verdier` (JSON) | Oppgave | Identisk med sjekkliste (paritet) | opplastingskø / init |
| `opplastings_ko.server_url` | Offline-kø | **RÅ** | `/upload`-REST-svar (utenfor tRPC-signering) |
| `sheet_tillegg_vedlegg_local.server_url` | Timer (tillegg-kvittering) | **RÅ** ved kø · **SIGNERT** ved pull (`timerSync.ts:761/770`) | kø / timer-pull |
| `sheet_utlegg_vedlegg_local.server_url` | Timer (utlegg-kvittering) | Som over (`timerSync.ts:833/842`) | kø / timer-pull |
| `sjekkliste_local` m.fl. kataloger | Liste-metadata | ingen URL | — |

Signatur-felt (`signature`) lagrer base64 `dataUrl`, ikke `/uploads/` — utenfor scope.

🔴 **FUNN C (kjernen):** Contrary to design-kommentaren i `signerteUrler.ts:12-15`
(«`feltVerdier` … forblir rå») persisterer **init-veien signerte URL-er til SQLite**:

1. `sjekkliste.hentMedId` er en tRPC **query** → svaret er signert (begge signeringsveier over).
2. Init kopierer server-vedlegget **verbatim** inn i feltverdien:
   `useSjekklisteSkjema.ts:282-288` (`vedlegg: lagret.vedlegg`), parallelt `useOppgaveSkjema.ts:270-274`.
3. `sammenstillMedLokaleVedlegg` (`vedleggLokal.ts`) legger kun lokale `file://`-vedlegg over
   serverbasen — den **stripper ikke** signatur-query.
4. Resultatet persisteres: `skrivTilSQLite(…, altSynket=true)` (`useSjekklisteSkjema.ts:330`,
   `useOppgaveSkjema.ts:337`).

Så et dokument som har vært hentet online har **`?exp=&sig=`-URL-er med innebygd utløp liggende i
lokal SQLite**. De virker mens `exp` er gyldig — men er ikke rene rå-URL-er slik display-resolveren
forutsetter for hele `feltVerdier`.

### Krav 2 — lastes bildene ned lokalt for offline-visning?

🔴 **NEI for foto.** Alle flater som viser server-lagrede bilder (sjekkliste/oppgave/HMS,
`InfoBildeObjekt`/PSI, dokument-bilder) bruker en server-URL direkte i `<Image>`
(`FeltDokumentasjon.tsx:371-377,414`; `InfoBildeObjekt.tsx:18,25,49`; `dokument/[id].tsx:546`).
Ingen `downloadAsync` av foto til `file://`. `file://` finnes kun for (a) nytt tatt/valgt bilde før
opplasting (transient, slettes etter opplasting, `lokalBilde.ts`/`OpplastingsKoProvider.tsx:468`),
og (b) **tegninger (PDF/SVG) + IFC-modeller** via eksplisitt «Forbered offline»
(`offlineKlargjoring.ts:62-98`, `ifcCache.ts`). Appen bruker RNs innebygde `Image` (ingen
`expo-image`/`fast-image`), så eneste foto-cache er RNs plattformavhengige HTTP-cache — ikke
app-styrt, ingen offline-garanti.

**Konsekvens:** risikoen faller **ikke** bort for foto — hvert server-foto krever en live forespørsel
med gyldig signatur mot gaten.

### Krav 3 — finnes selvfornyelse på mobil?

🔴 **NEI.** Webs `SignertBilde` (tre forsøk, backoff, debouncet invalidering, `4ef039fd`;
delt policy i `signertBildePolicy.ts`) har **ingen** motpart i mobilen — den delte policyen
importeres kun av web (null treff i `apps/mobile`). Ved bildefeil gjør mobilen kun `markerFeilet`
(`FeltDokumentasjon.tsx:68-75,419`) → statisk feiltilstand. Ingen retry, backoff, invalidering
eller re-signering utløst av feilen. Fersk signatur kommer **bare** som sidevirkning når query-en
refetcher av andre grunner (fokus/reconnect/staleTime), ikke fordi et bilde feilet. `InfoBildeObjekt`
(PSI) har ikke engang `onError` → feiler stille.

### Krav 4 — hva skjer ved sync?

🟢 **Rå URL-er: forbigående, løser seg.** Feltdata re-hentes via `hentMedId` ved app-fokus,
reconnect, `staleTime`-utløp (30 s) og etter egen lagring (`invalidate`). Hver refetch gir ferske
signaturer i visnings-mappet, og rå URL-er re-signeres. Timer-vedlegg upsertes med server-verdi på
hver pull (`timerSync.ts`), og timer-UI henter dessuten en fersk signert visnings-URL via egne
queries (`signerUtleggVedlegg`/`signerTilleggVedlegg`, `UtleggSeksjon.tsx:286-293`) → lav risiko.

🔴 **Signert-i-SQLite (Funn C): forbigående, men med et dødt vindu.** Sync leser server-data inn i
SQLite, **men** når SQLite har **usynkroniserte lokale endringer** tar init `!sqliteSynkronisert`-
grenen (`useSjekklisteSkjema.ts:257-263`) og viser sqliteData **direkte** — der ligger den utløpte
signerte URL-en, og resolveren leger den ikke (kun rå). Dødt til den lokale endringen er pushet
(flippes til synkronisert) og neste init henter fersk data. Ingen feltdata er write-once; kun
nedlastede tegning-/IFC-**filer** re-valideres ikke, men de er binærfiler på disk, ikke signerte
URL-er → rammes ikke.

---

## Når overlever bildene, og når ikke (sammenstilt)

| Situasjon | Utfall |
|---|---|
| Online, dokument synket, rå URL i SQLite | 🟢 Fersk signatur ved visning (resolver + emisjon). Virker. |
| Online, dokument synket, signert URL i SQLite (Funn C), `<15 min` gammel | 🟢 Virker (signaturen er fersk fra siste refetch). |
| Online, dokument med **usynket lokal endring**, signert URL i SQLite, `>15 min` | 🔴 401 → feiltilstand. Resolver leger ikke. Heler ved neste vellykkede sync. |
| Online, smalt vindu: stale React Query-cache vist før refetch fullfører, signert `>15 min` | 🔴 Kortvarig 401 til refetch lander. |
| Offline (uansett form) | ⚪ Kan ikke lastes — forventet (ingen lokal foto-cache). Ikke et deploy-tap. |
| PSI/`InfoBildeObjekt` ved enhver feil | 🔴 **Stille** tom ramme (ingen `onError`). |

**24 t → 15 min forverrer nettopp de røde radene:** før overlevde en signert-i-SQLite-URL et helt
døgn før den ble giftig; nå 15 minutter. Sannsynligheten for at et usynket dokument åpnes etter at
vinduet er passert, går kraftig opp.

---

## Hva jeg IKKE fikk målt (skilt fra det målte)

- **Faktisk innhold i A.Markussens telefoners lokale base.** Krever enhet eller simulator mot test.
  Simulatoren peker mot **prod** — ikke lagt om (ordre + egen uavklart sak). **Ikke målt.**
- **Prods nåværende signerings-tilstand.** Om prod i dag signerer `privat/` (Fase 1) eller ikke er
  en deployet tilstand, ikke lesbar fra develop-koden. Har betydning for hvor mange **allerede
  lagrede** URL-er som er signert vs. rå før deploy. **Ikke målt** — antatt at ikke-privat er rå på
  prod i dag (gaten er ikke default-deny der), noe som gjør pre-deploy-data overveiende trygt
  (resolveren leger rå).
- **Empirisk 15-min-forfall.** Ordrens foreslåtte test (lagre lokalt, vent >15 min, se) er **ikke
  kjørt** — ingen nådd flate mot test.

---

## Anbefalt neste steg (ikke bestilt — for Kenneths beslutning)

Rapporten er nok til å ta deploy-beslutningen, men **ett** billig, målbart steg vil lukke det siste
hullet før grønt lys:

1. **Empirisk test mot test.sitedoc.no** (gaten kjører der alt): logg inn på en simulator/enhet
   **mot test**, åpne et sjekkliste-/oppgavedokument med bilde, gjør en liten offline-endring, vent
   >15 min, kom online og reåpne. Bekreft om Funn C-vinduet er reelt observerbart. Dette krever at
   simulatoren legges mot test — **egen sak, ikke del av denne målingen.**

🔴 **Ikke rørt (per ordre):** gaten, `hmac.ts`, signaturformatet, utløpet (Kenneth har akseptert
15 min) og mobilkoden. `feat/mobil-bildeheader` `1250580b` er lest som referanse, ikke endret.

Funn C og krav 3 (manglende selvfornyelse) er de to reelle svakhetene. Begge er **herdingssaker for
en egen runde**, ikke blokkere for deploy i seg selv — men de bestemmer om det forbigående vinduet
blir merkbart hos piloten.
