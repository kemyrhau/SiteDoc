---
name: timer-gps-prosjekt-utredning
status: agenda
sist_verifisert_mot_kode: 2026-06-23
---

# Utredning: Timer-registrering, GPS, prosjekt-tilknytning og dag-flyt

> 🔴 **HELHETSPLANEN ER SKREVET 2026-10-01 — les den FØR noe her bestilles:**
> **[timer-gps-helhetsplan.md](timer-gps-helhetsplan.md)**
> Den syr sammen GPS, reise, flerprosjekt-dag og bekreftelsessteget i fem lag med bindende
> rekkefølge, og lister seks beslutninger som venter på Kenneth. **Denne fila er grunnlaget
> (målinger og beslutningshistorikk); planen er veien.**

> **Session-klar agenda** for en dedikert utredningssesjon. Samler beslutningene som dukket
> opp 2026-06-13 rundt R4 (reisetid-matrise) + EAS-enhet-test. Ingen kode tas før beslutningene
> er fattet. Rekkefølgen er **avhengighets-ordnet**: Beslutning 1 styrer resten.

## Formål

Avgjøre hvordan timer-modulen håndterer **prosjekt-tilknytning + GPS-dagflyt**, forankret i
to-produkt-modellen og byggherreforskriften §15. Spenningen: SiteDoc er opprinnelig et
**prosjektstyringsverktøy** (streng prosjekt-isolasjon), mens timer-modulen behandler prosjekt
som en *etikett* arbeider velger. De kolliderer når valgt prosjekt ≠ faktisk posisjon.

## Forankring (les først)

- `terminologi.md § 0` — to-produkt-modell (firmamodul vs prosjektmodul; timer isolerer på org)
- `fase-0-beslutninger.md § T.8` — innsjekk-prosjektforslag (**🟡 under revurdering**)
- `mannskap.md` — PSI/§15 innsjekk-utsjekk, byggherreforskriften, 12t auto-utsjekk
- `domene-arbeidsflyt.md` — virkelig arbeidsflyt (styrende)
- `timer.md § Reise og oppmøtested` — R1–R4 reise-modell, «aldri auto-rad»
- `OPPSUMMERING-timer-arkitektur.md § D (G1)` — **GPS = friksjonsfjerner + bevis, ikke hard port**

## Kode-fakta (verifisert 2026-06-13)

- Tid registreres mot `valgtProsjekt` (`StartSluttDagKort:442`) **uansett fysisk posisjon**.
- «Start dag»-GPS identifiserer **kun oppmøtested (kontor)** — ikke byggeplass/prosjekt. Byggeplass-GPS = **1c-mobil, gjenstår**.
- **Ingen** validering av valgt prosjekt mot GPS-posisjon i dag.
- Dagsseddel-status: `draft → sent → accepted` (`draft/returned` redigerbar, `sent/accepted` låst). Innsending = `draft→sent`; leder-attestering = `→accepted`.
- T.8 i dag: innsjekk = **hint** i prosjekt-velger; arbeider oppretter dagsseddel + rader **eksplisitt**; innsjekk trigger **aldri** auto-dagsseddel/rader.

---

## 2026-06-23 — kode-review + justering

Uavhengig kode-sjekk (Opus) av tilstanden siden 2026-06-13. Endrer status på Beslutning 2–6 og fastsetter neste byggbare runde.

### Verifiserte funn

- **L1 byggeplass-GPS ferdig.** `byggeplassLocal`-cache med navn + `lat/lng/radiusM` (alle nullable) — `apps/mobile/src/db/schema.ts:364`. `identifiserByggeplass()` Haversine point-in-circle — `byggeplassKatalog.ts:79`. Server `bygning.hentForFirma` leverer `latitude/longitude/radiusM` → caches lokalt (`byggeplassKatalog.ts:30,61`). Byggeplass **identifiseres kun ved Start** (`StartSluttDagKort.tsx:168`, i `startDag`) — ved slutt fanges kun `endLat/endLng`, ingen ny byggeplass-deteksjon. **Én arbeidsdag = én byggeplass.**
- **Auto-utkast (Slice 3) live** — `genererForslag()` → `opprettDagsseddelForSegment` lager draft + auto-rader (`StartSluttDagKort.tsx`).
- **R4 reisetid-matrise live** (`reisetidMatriseKatalog.ts`, `resolverPrimaerByggeplass`) · **UF-1 multi-prosjekt live** (GPS velger nærmeste blant flere prosjekter, `StartSluttDagKort.tsx:455-462`).
- **Sedel-nivå byggeplass: server + sync ferdig.** `dagsseddelLocal.byggeplassId` finnes (`schema.ts:90`); mobil-sync sender det (`timerSync.ts:223`); `syncBatch`-input tar imot på sedel-nivå (`dagsseddel.ts:3026`) og **propagerer til alle rader** ved skriving (`createMany`: `byggeplassId: lokal.byggeplassId ?? null` — `dagsseddel.ts:3369` timer, `:3398` maskin). **Eneste manglende ledning:** `opprettDagsseddelForSegment` hardkoder `byggeplassId: null` (`dagsseddelOpprett.ts:107`) → GPS-byggeplassen på `arbeidsdagLocal` kopieres ikke inn i auto-utkastet.
- **Per-rad byggeplass: IKKE server-klart.** `syncBatch` rad-input (`timer`/`maskiner`) har kun `projectId`, ikke `byggeplassId` (`dagsseddel.ts:3039-3073`) — byggeplass kommer kun fra sedel-nivå og propageres ned. `sheetTimerLocal`/`sheetMachineLocal` (mobil rad-tabeller) mangler `byggeplassId` (kun `projectId`, `schema.ts:126,155`). Ekte per-rad krever derfor **både** server-input-utvidelse **og** mobil rad-tabeller.
- **§15/innsjekk-utsjekk + OS-region-monitoring: ikke bygd** (0 treff på `innsjekk`/`utsjekk`/`mannskap`/`startGeofencing`/region-monitoring). Geofence i dag er kun Haversine point-in-circle ved Start, ikke kontinuerlig OS-overvåking.

### Justert status, Beslutning 2–6

| Beslutning | Status etter review |
|---|---|
| **B2** — prosjekt-mismatch advisory | **Byggbar nå** (sedel-nivå). Byggeplass-deteksjon finnes; mangler å koble soft advarsel. |
| **B3** — dag-flyt-overganger (ankomst/avreise) | Trenger **OS-geofence** (region monitoring) — ikke bygd. |
| **B4** — §15-presence vs lønnstid | Lønns-laget **live** (auto-utkast); **§15-presence gated** (Fase 4 Mannskap + juridisk sign-off). |
| **B5** — autoritet arbeider-valg vs GPS | = **dagens oppførsel** (arbeider-valg autoritativt, GPS advarer/foreslår, jf. G1). |
| **B6** — multi-byggeplass-dager | = **byggeplass-registrering**, fases (sedel-nivå nå, per-rad/splitt-dag som oppfølger). |

### Vedtak — B2+B6 sedel-nivå-runde ✅ IMPLEMENTERT PÅ DEVELOP 2026-06-23 (mobil)

1. **Kopier `arbeidsdag.byggeplassId` → draft** — `FinnEllerOpprettArgs.byggeplassId` + insert (`dagsseddelOpprett.ts`); threadet via `genererForslag`/`opprettDagsseddelForSegment`; `ny.tsx` sender `null`. Kun NYE drafts (UF-1-append urørt).
2. **Byggeplass-velger** (`ByggeplassVelgerModal`, filtrert på `sedel.projectId`) + blå sedel-topp-oversikt m/ pil-til-høyre på `[id].tsx`. Redundant gruppe-header-visning for primærprosjektet fjernet.
3. **Mismatch-advisory** (soft, ikke-blokkerende) når GPS-byggeplass tilhører annet prosjekt enn valgt.

Sedel-nivå var allerede server-klart (sync + propagering) → ren mobil-runde, ingen schema/server. i18n: 3 nøkler × 15 språk. Distribueres via NESTE TestFlight prod-bygg (ikke #30). Se [STATUS-AKTUELT.md § B2+B6 sedel-nivå byggeplass](STATUS-AKTUELT.md).

### Parkert (eksplisitt)

- **Per-rad byggeplass / «splitt dagen mellom byggeplasser»** (prosjekt-101-behovet) = **Beslutning 6-oppfølger.** Krever server `syncBatch` rad-input + mobil rad-tabeller (`sheetTimerLocal`/`sheetMachineLocal.byggeplassId`). Begrunnelse: `@@unique(userId, dato)` på `DailySheet` → sedel-nivå = én byggeplass/dag; splitt-dagen krever per-rad-modell.
- **Underprosjekt** (dokumentflyt-utledet, distinkt fra byggeplass) · **multi-leg reise** → Fase 3.
- **§15-presence + OS-region-monitoring** → Fase 4 Mannskap + juridisk sign-off.

---

## BESLUTNING 1 (avgjør resten) — T.8: konservativ vs auto-utkast

> **✅ VEDTATT 2026-06-20: Alternativ B (auto-utkast).** Modulen bygger seg selv (draft fra dag-flyt), viser arbeider alt, korrigerbart, godkjennes ved innsending (`draft→sent`). Styrer Del 2/3 + BESLUTNING 2–6. Foldet til `fase-0 § T.8`; «aldri auto-rad» → «aldri auto-innsending» ved bygging av Del 3.

**Spørsmål:** Hvem skriver timer-radene, og hvor ligger godkjennings-punktet?

| | Hvem skriver utkastet | Godkjennings-punkt |
|---|---|---|
| **A. Konservativ (dagens T.8)** | Arbeider oppretter manuelt (GPS = hint) | Ved opprettelse + innsending |
| **B. Auto-utkast (Kenneths forslag)** | Systemet auto-skriver fra GPS-dagflyt (draft) | Ved **innsending** (`draft→sent`) |

**Invariant (begge):** Arbeider godkjenner før noe blir *endelig* (innsending/attestering). Ingen lønn uten menneskelig godkjenning.

**Avveiing:** A = tryggest mot feil auto-rader, men mer manuelt (mer tasting). B = mye lavere friksjon («dagen fyller seg selv»), men hviler på at innsendings-gjennomgangen faktisk gjøres nøye.

**Konsekvens:** Velges B må «aldri auto-rad»-formuleringen i T.8 + 1c-mobil-noten (`timer.md:416`) revideres til «aldri auto-*innsending*». Styrer hele dag-flyt-designet under.

---

## BESLUTNING 2 — Prosjekt-mismatch (valgt prosjekt ≠ faktisk posisjon)

**Scenario:** Arbeider velger Prosjekt A, men er fysisk på Prosjekt B.

**Konsekvens i dag (udetektert):** feil prosjekt-kostnad (kjerne for prosjektverktøy), feil reise-forslag (R4 bruker A's byggeplass), feil §15-mannskaps-oversikt.

| Alternativ | Avveiing |
|---|---|
| **GPS-advisory (anbefalt, jf. G1)** | byggeplass-GPS detekterer B → soft advarsel ved mismatch → arbeider bekrefter/bytter. Balansert. |
| Status quo (kun valg) | Korrumperer kostnad + §15. Ikke holdbart. |
| Hard GPS-gate | For rigid — GPS upålitelig, bryter legitime kryss-prosjekt-dager. |

**Avhengighet:** 1c-mobil (byggeplass-GPS).

---

## BESLUTNING 3 — Dag-flyt-overgangene (ankomst + avreise)

**Scenario:** Kontor (A valgt) → kjør til B → ankomst B (reise→arbeid + prosjekt-bytte) → forlater B (utsjekk).

**Spørsmål:** Hvordan signaliseres overgangene? Popup? Auto? Timeout-fallback?

Se **Beslutning 4** (to-lags-modellen) — den gir svaret på «hvis ubesvart». Kort: popup ved ankomst/avreise; auto-fallback skiller §15-presence (kan auto-logges) fra lønnstid (utkast, ikke auto-commit med mindre Beslutning 1 = B).

**Åpent:** popup-design, terskel for «forlatt byggeplass», sammenheng med 12t auto-utsjekk.

---

## BESLUTNING 4 — To-lags-modell: §15-presence vs lønnstid

Geofence-overgangene driver **to lag med ulik commit-semantikk:**

| Lag | Hva | «Hvis ubesvart» |
|---|---|---|
| **§15-presence** (innsjekk/utsjekk per byggeplass) | Dokumentasjon, rettslig forpliktelse (GDPR art. 6(1)(c), byggherreforskriften §15). Primær nytte: katastrofe-mønstring. | **Kan auto-logges** (presedens: 12t auto-utsjekk). |
| **Lønnstid** (reise→arbeid, prosjekt-bytte) | Påvirker lønn. | **Konservativ T.8:** ikke auto. **Auto-utkast (B):** utkast skrives, bekreftes ved innsending. |

**Nøkkel:** §15-presence (nærvær) er mindre sensitiv enn lønnstid og kan automatiseres uavhengig av Beslutning 1. Lønnslaget følger Beslutning 1.

**Privacy-by-design (prinsipp):** Appen lagrer **kun inn/ut-hendelser, aldri bevegelsesspor.** Geofence-evalueringen skjer i OS-laget (iOS/Android region monitoring) — appen mottar og persisterer bare selve overgangs-eventet (innsjekk/utsjekk med tidspunkt + byggeplass), ikke kontinuerlig posisjon. Eventene mapper direkte til **PSI/§15-nærværsdata** (rettslig forpliktelse, GDPR art. 6(1)(c) — byggherreforskriften §15), ikke til en sporings-logg. Dette **de-risker feature-en betydelig** personvernmessig (ingen bevegelseshistorikk = ingen sporings-profil), men **juridisk sign-off på rettsgrunnlaget gjenstår** før implementasjon. Skiller seg fra «kontinuerlig GPS-sporing» (eksplisitt ut av scope, se under).

**Avhengighet:** Fase 4 Mannskap (PSI innsjekk/utsjekk-tabeller).

---

## BESLUTNING 5 — Autoritet: arbeider-valg vs GPS

Forankret i **G1: GPS = friksjonsfjerner + bevis, ikke hard port.** Arbeider-valg bør forbli autoritativt (legitime kryss-prosjekt-tilfeller: forberedelser, materialhenting, flytting). GPS detekterer + advarer/foreslår. Bekreft at dette holder for alle lagene over.

---

## BESLUTNING 6 — Multi-byggeplass-dager

Arbeider beveger seg mellom flere byggeplasser/prosjekter samme dag. Hvordan håndteres flere reise→arbeid-segmenter + flere §15-innsjekk/utsjekk på én dagsseddel? (R4 primær-byggeplass-regel er deterministisk per *prosjekt* — multi-prosjekt-dag trenger egen håndtering.)

---

## 🔴 KENNETHS MODELL + REMÅLING MOT KODE 2026-10-01

> **Kenneth 2026-10-01, hans egne ord:**
> *«sjekk gps. hvor starter timeføringen · starter den på et oppmøtested · hvor langt tid/km er
> det til prosjektet? · hvilket prosjekt kommer vi til → registrer prosjekt! · reiser vi til
> annet prosjekt underveis på arbeidsdagen? registrer arbeidstid der!»*
>
> *«den mest avanserte timeføringen skjer hos en sjåfør som leverer til mange prosjekter»*

**Målt av to agenter parallelt, verifisert av orkestrator.** ⚠️ **Reise/km-leddet er ennå ikke
målt** — egen agent kjører, seksjonen suppleres.

### 🟢 Dette svarer på BESLUTNING 6, og det bryter IKKE G1

**BESLUTNING 6 (multi-byggeplass-dager) er nå besvart av Kenneth:** flere prosjekter på én dag
skal registreres, hver med sin arbeidstid.

🔴 **Og det står ikke i strid med G1** («GPS = friksjonsfjerner + bevis, ikke hard port;
arbeider-valg forblir autoritativt») — **forutsatt at bekreftelsessteget finnes.** Kenneth
vedtok begge samme dag: GPS **foreslår** prosjekt pr. segment, og arbeideren **bekrefter eller
retter** før noe blir et dagskort (U-BEKREFT modus A, `mobil-dagsseddel-ui-spec.md § 6.2`).
**Uten bekreftelsessteget blir GPS en hard port, og da faller G1.** De to vedtakene er ett
system, ikke to saker.

### 🟢 Serveren er allerede klar — mobilen er ikke

| Lag | Status |
|---|---|
| **Server** | 🟢 **Flerprosjekt-klar siden T.1 (2026-05-11).** `DailySheet` har ingen `projectId` (`db-timer/schema.prisma:156-157`), unik er `@@unique([userId, dato])` (`:196`), prosjekt ligger på `SheetTimer.projectId` (`:221`). **Ingen migrering kreves** |
| **Web + manuell mobil** | 🟢 Flerprosjekt-sedel er et levende UI-konsept — prosjektgrupper, «+ Legg til prosjekt» |
| 🔴 **GPS-auto-veien på mobil** | 🔴 **Enkelt-prosjekt ved konstruksjon** |
| 🔴 **Lokal mobil-base** | 🔴 `dagsseddelLocal.projectId` er fortsatt `.notNull()` — gjelden `timer.md:124` navngir som utløst av nettopp «mobil-flerprosjekt-dagsseddel» |

### 🔴 Forutsetninger i koden som modellen bryter

1. **Ett prosjektvalg pr. arbeidsdag, tatt på ETT GPS-punkt** (`StartSluttDagKort.tsx:436-451`)
   — startposisjon, sluttposisjon som reserve. Alle rader arver det, inkl. reiseraden.
2. 🔴 **Ingen avstandsgrense i auto-veien.** Nærmeste prosjekt vinner uansett avstand, og uten
   koordinater tas `prosjekter[0]` — **stille**. Den manuelle veien har til sammenligning et
   hardkodet tak på 500 m (`timer/ny.tsx:139`). **To innganger, uenige om når GPS har rett.**
3. **«Segment» = kalenderdøgn, ikke sted** (`utils/dagsegment.ts:93-94`). Grensen er lokal
   midnatt. Et prosjektbytte midt på dagen produserer ikke et nytt segment, og segmenttypen har
   ingen stedsfelt.
4. **«Én arbeidsdag = én byggeplass»** står eksplisitt i koden (`StartSluttDagKort.tsx:596-598`).
5. 🔴 **Posisjon fanges kun to ganger** — ved start og ved slutt (`db/schema.ts:362-366`). **Ingen
   sporing underveis, ingen tabell for det** (målt negativt, to søkeformer). **Sjåfør-leddet har
   ingen data å utledes fra.**
6. **Arbeidsdagen synkes ALDRI til server** (`db/schema.ts:352-353`). Posisjonen dør på enheten;
   serveren får resultatet uten beviset. **Ingen etterprøvbarhet.**
7. 🔴 **Overlapp er forbudt på tvers av prosjekt, håndhevet klient OG server**
   (`tidsromValidering.ts:4-7`, `dagsseddel.ts:635`, `:1750`). Prosjektbytte må uttrykkes som
   adskilte klokkevinduer. **«To prosjekter samtidig» er ikke uttrykkbart** — og det er trolig
   riktig.
8. **Dagsnorm, overtid, pause og reise fordeles pr. døgn-segment, ikke pr. prosjekt.**
9. **Play-raden viker HELT ved overlapp** (`StartSluttDagKort.tsx:829-832`) — en GPS-rad for
   prosjekt B droppes i sin helhet mot en manuell rad på prosjekt A. Ingen splitting.

### 🔴 Dataene modellen hviler på finnes stort sett ikke

| Sted | Geofence | Konsekvens |
|---|---|---|
| **Oppmøtested** | 🟢 **PÅKREVD** — `lat Float`, `lng Float`, `radiusM Int @default(150)` (`db/schema.prisma:2759-2761`) | **Første ledd i modellen er fast grunn.** «Startet dagen på et oppmøtested» kan avgjøres i dag |
| **Byggeplass** | 🔴 **VALGFRI** — alle tre nullable (`:1043-1045`), og **ikke med i `createByggeplassSchema`** (`validation/index.ts:95-101`) i det hele tatt | Geofence oppstår bare hvis noen georefererer en tegning, eller taster den manuelt etterpå. **En arbeider på en byggeplass uten geofence får `null`, ikke en feilmelding** |
| **Prosjekt** | 🔴 **Punkt, men INGEN radius** (`db/schema.prisma:652-653`) | Derfor de to improviserte reglene i punkt 2 over |

### 🔴 Fire konkurrerende definisjoner av «jeg er her»

`byggeplassKatalog.ts:72-96` (byggeplass, egen radius) · `useArbeidsdag.ts:71-87` (oppmøtested,
egen radius) · `timer/ny.tsx:131-142` (prosjekt, hardkodet 500 m) · `StartSluttDagKort.tsx:441-451`
(prosjekt, **ingen grense**). **Alle fire bor på mobilen. Ingen er delt. Ingen er testet.**

🔴 **`haversineKm` finnes KUN i `apps/mobile/src/utils/geo.ts:6-21`** — ikke i `packages/shared`.
**Server og web kan ikke regne avstand mot en geofence i det hele tatt.**

### 🔴 Koden forbyr i dag eksplisitt det modellen krever

**Tre steder, ordrett:** *«KUN dokumentasjon — aldri lønn/reise/prosjektvalg»*
(`byggeplassKatalog.ts:70`, `useArbeidsdag.ts:141-142`, `db/schema.ts:374`).

**Og `mannskap.md:347-349`:** innsjekkstid skal **ikke** brukes som forslag til arbeidstid;
«pauser inne i geofence er ikke arbeidstid».

🔴 **Dette er vedtak, ikke forglemmelser. De må reverseres bevisst og føres — ikke rives ved
uhell.** ⚠️ **Og G1-grensen består:** det som reverseres er «GPS foreslår aldri prosjekt», ikke
«arbeider-valg er autoritativt». Bekreftelsessteget er det som holder den forskjellen.

### 🟡 PSI er ikke en snarvei

`sjekkInn` tar **ingen koordinat** (`mannskap.ts:179-186`); `kilde="geofence"` er **kun en
etikett**. 12-timers auto-utsjekk er rent tidsbasert (`:43-53`). `mannskap.md:19`:
geofence-innsjekk er **Fase C, ubygd, og krever juridisk sign-off.**

**Nærmeste eksisterende posisjon→sted-eksempel er timer-mobilens egne funksjoner**, ikke PSI.

### 🟡 Håndhevingsnivået er parkert — av Kenneth selv

`psi-geofence-handhevning-utredning.md` har fire nivåer (av · forslag · advarsel · blokkering)
og anbefaler **advarsel** som standard. **Parkert 2026-07-15, ingenting bygget.** Dagens faktiske
atferd tilsvarer **forslag**, uten innstilling og uten avvikslogg.

⚠️ **Og juks-grensen står:** serveren kan **flagge** en påstått koordinat, ikke hindre spoofing.
**GPS er et hjelpemiddel, ikke et lønnsbevis.**

### 🟢 REISE/KM-MÅLINGEN (2026-10-01) — to av fem ledd er ALLEREDE BYGGET

🔴 **Dette var det store funnet, og det motsier antakelsen om at modellen må bygges fra null.**

| Hva | Status | Bevis |
|---|---|---|
| **Oppmøtested-gjenkjenning** | 🟢 **Bygget og i drift** | `useArbeidsdag.ts:71-87`, kalt `:143` ved «Start dag». Nærmeste innenfor egen radius. Mobil-cache `oppmotestedKatalog.ts`. **Radius valideres 10–5000 m** (`oppmotested.ts:66`) |
| **Tid OG km til prosjektet** | 🟢 **Bygget — for ÉN akse** | `ReisetidMatrise` (`db/schema.prisma:2788-2807`): `kjoretidMin` **og** `avstandM` i METER, fra **ekte OSRM-ruting** (`rute-service.ts:100-120`, `annotations=duration,distance`). Hendelsesdrevet vedlikeholdt, **tilgjengelig offline** (`reisetidMatriseKatalog.ts`) |
| **Reise som lønn** | 🟢 Bygget, klient-side | Firma-regelsett (`db/schema.prisma:442-471`): terskel i **minutter ELLER meter**, + avstandsbånd → lønnsart (`shared/utils/reise.ts:85-157`) |

🔴 **MEN aksen er `@@unique([oppmotestedId, byggeplassId])`** — **kontor × byggeplass.**
**Sjåførens rute er byggeplass → byggeplass → byggeplass. Den aksen finnes ikke.**

### 🔴 Fire hull som er konkrete, ikke prinsipielle

**1. Avstanden kastes.** Matrisen HAR meter. De brukes til å velge lønnsart — og lagres så
**ingen steder**. Reise-raden er en naken timer-verdi: `fraTid: null`, `tilTid: null`
(`StartSluttDagKort.tsx:866-888`), ingen km, ingen fra-sted, ingen til-sted, ingen
oppmøtested-referanse. **Ingen kan etterprøve hvorfor den ble som den ble.**

**2. 🔴 Km finnes ikke som størrelse.** Det er **intet km-felt** i hele timer-modulen. Kilometer
skrives inn i feltet som heter `timer` — **med tak på 24** (`dagsseddel.ts:1329`
`z.number().min(0).max(24)`). **En rad på «Kilometergodtgjørelse» kan altså ikke overstige 24 km
på den interaktive veien.** ⚠️ `syncBatch` har ikke taket (`:3528`, `:3551`) — **de to veiene er
usymmetriske.** Og `satsEnhet = per_km` er en etikett som aldri ganges med noe: `sats` leses
kun til `attestertSnapshot`.

**3. 🔴 Serveren har NULL reiselogikk.** `grep -ic reise apps/api/src/routes/timer/dagsseddel.ts`
= **0**. Hele reise-modellen lever i mobil-klienten pluss firmainnstillinger. **Web-dagsseddelen
kan ikke generere reise, og serveren kan ikke etterprøve en reise-rad.**

**4. `vehicleId` på timeraden er en MEKANIKER-funksjon** (`db-timer/schema.prisma:231-236`) —
«timene en mekaniker fører på vedlikehold av en maskin». **Ikke en sjåfør-funksjon.** Det finnes
ingen leveranse-, tur- eller lass-entitet. **Sjåfør er ikke modellert, ikke spesifisert og ikke
nevnt i dokumentasjonen** (målt med flere søkeformer).

### 🟡 Doktrine-spenningen, presist

`useArbeidsdag.ts:69-70`: oppmøtested-treffet er «KUN dokumentasjon + forslag — aldri
lønnsgrunnlag». **Men `StartSluttDagKort.tsx:473` gjør `oppmotestedId` til betingelsen for at en
reise-lønnsart-rad i det hele tatt foreslås.**

🟢 **Påstanden holder — men bare fordi arbeideren godkjenner utkastet.** Det er nøyaktig G1 i
praksis, og det er nok et argument for at bekreftelsessteget er bærende, ikke kosmetisk.

### 🟡 «Utenfor alle oppmøtesteder» skiller ikke to ulike ting

`null` betyr både **«startet hjemmefra»** (doktrine: ikke kompensert, `timer.md:1086`) og
**«GPS var avslått»** (`useArbeidsdag.ts:55` returnerer `{null, null}`). **Samme utfall, ulik
årsak, ingen melding til brukeren.**

### 🟡 Beslutninger som venter — målt som fravær, ikke som feil

- **Oppmøtested × byggeplass overlapper:** begge gjenkjennes uavhengig på samme punkt og begge
  lagres (`useArbeidsdag.ts:143-144`). **Ingen kode forener dem.** Og matrise-oppslaget ignorerer
  det GPS-identifiserte byggeplass-treffet — det bruker `resolverPrimaerByggeplass` i stedet.
- **To oppmøtesteder kan overlappe fritt** — eneste skranke er unikt NAVN, ikke geometri.
- **Radius-spennene er vilt ulike:** oppmøtested 10–5000 m, byggeplass 1–100 000 m. Ingen delt
  konstant.
- **Avdeling på oppmøtested har ingen leser** utenfor admin-tabellen — ren merkelapp i dag.

### Hva som må på plass, i rekkefølge

| Ledd | Hviler på | Status |
|---|---|---|
| **1. Startet dagen på oppmøtested?** | Oppmøtested-geofence (påkrevd) | 🟢 **Byggbart nå** |
| **2. Hvilket prosjekt kom vi til?** | At prosjekter/byggeplasser FAKTISK har geofence | 🔴 **Dataopprydding først** — geofence må inn i opprettelsen av en byggeplass, ellers er utledningen tom |
| **3. Bytte underveis** | Segment med stedsdimensjon + posisjon pr. rad | 🔴 **Ny struktur** |
| **4. Sjåfør, mange leveranser** | Posisjonssporing gjennom dagen | 🔴 **Personvernvalg, ikke teknisk** |

---

## Avhengigheter (oppsummert)

- **Fase 1c-mobil** (byggeplass-GPS) — forutsetning for Beslutning 2, 3, 6.
- **Fase 4 Mannskap** (PSI innsjekk/utsjekk) — forutsetning for §15-laget (Beslutning 4).
- **Beslutning 1** styrer «aldri auto-rad»-formuleringen i T.8 + `timer.md:416`.

## Ut av scope (ikke i denne utredningen)

- Maskinkost-fordeling, ProAdm-eksport (OPPSUMMERING G5).
- Kontinuerlig GPS-sporing (🔴 personvern — BACKLOG, bygges ikke uten juridisk vurdering).
- Fra/til → HMS-register (G4, uavklart).
