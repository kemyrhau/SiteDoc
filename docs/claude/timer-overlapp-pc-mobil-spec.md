---
name: timer-overlapp-pc-mobil-spec
description: Spesifikasjon for V19 — når en dagsseddel registrert på PC og en registrert på mobil for samme dag overlapper i tid, lagres mobilens rader som FORSLAG på serveren (egen tabell), arbeideren varsles og velger selv — på telefonen eller på PC — pr. tidsrom eller for hele dagen; attestanten ser begge versjonene lesbart og kan ikke attestere før valget er tatt. Kenneth-vedtak 2026-10-04 (b · V19.4 ja · V19.5 blokkert). v4. Skrevet av fabel, gates av orkestrator.
sist_verifisert_mot_kode: 2026-10-04
eier: fabel (kontroll-Claude) — orkestrator gater
status: 🟢 GATET 2026-10-04 (orkestrator, v3). V19-A-ordren venter KUN på Kenneths svar på V19.4 (additiv sammenslåing uten overlapp) og V19.5 (blokkere vs. varsle attestering)
---

# V19 — overlapp PC ↔ mobil på samme dag: forslaget lagres på serveren, arbeideren velger

> Hjemmel: **Kenneth 2026-10-04, ordrett:** *«ingen av delene. den ansatte skal varsles → kunne lese begge og velge
> selv hvem som vinner»* — avviste flagg-til-attestant-og-lagre-begge-som-lønn, avvis-synk og dagens stille
> sammenslåing. **Samme dag, tre vedtak til (v4):** *«hvorfor er det ikke aktuelt å vise mobilens forslag på pc
> også?»* → **«b»: mobilens forslag lagres på SERVEREN** (egen tabell, ikke flagg på `sheet_timer`), valgbart på PC og
> telefon (BACKLOG `3a53503e`) · **V19.4 «1. ja»**: rader uten overlapp slås sammen som i dag (`06d1220c`) ·
> **V19.5 «2. blokkert»**: attestering blokkeres mens valget venter, lederens utvei er retur (`49039856`).
> v3 (`853cb7d5`, gatet) holdt forslaget kun lokalt: tap hvis telefonen mistes, usynlig for PC og attestant. Målt grunnlag: orkestrator 2026-10-04 (BACKLOG `1779dce8`) + fabels måling under. Ført som **V19**
> og **H25** i [timer-gps-helhetsplan.md](timer-gps-helhetsplan.md). **Alt under er spesifikasjon** — ❌ IKKE
> IMPLEMENTERT inntil ordren er merget.

## 0. Hva V19 er, og ikke er

**V19 svarer på ett spørsmål: hva skjer når to registreringer av samme dag overlapper i klokketid.** Svaret i v4:
mobilens rader blir et **forslag** som bor på serveren ved siden av sedelen, synlig overalt, og som ingen lønnsleser
ser. Arbeideren velger — på telefonen eller på PC. Den bygger på to flater som finnes: sammenligningsvisningen (steg 1,
`e4866f8d`) og den atomiske `forsonDagskort` (steg 2, `9c7c1ad1`). Den endrer **ikke** reise, norm eller spor
(lag 1–2), og **ikke** lederens retur-vei.

**Paritetsmatrise (vedtatt):** forslag + valg på mobil ✅ · forslag + valg på web for arbeideren selv ✅ (ny flate) ·
attestant web: **kun lesing** av begge versjonene ✅ · PDF/eksport ❌ — forslag er før attestering og går aldri ut.

## 1. Målt utgangspunkt (2026-10-04)

| # | Fakta | Bevis |
|---|---|---|
| M1 | `DailySheet @@unique([userId, dato])` — én sedel pr. dag pr. person | `db-timer/schema.prisma:203` |
| M2 | Mobil-push mot en dag som alt finnes fra web gir P2002 → serveren svarer `conflict` med server-sedelens `clientUuid` (S2) | `dagsseddel.ts:5830-5870` |
| M3 | Mobilen **nøkler om** den lokale sedelen til serverens identitet, setter `pending` og pusher **additivt** — tekst «slått sammen», teller `merged`, **ikke** konflikt i statusbaren | `timerSync.ts:259-290`, `forsonSedelIdentitet` |
| M4 | 🔴 Overlapp-vakten i `syncBatch` sjekker **kun payloaden**: `finnTidsromKonflikt(lokal.timer)`. Kommentaren sier «post-state = eksakt lokal.timer» — det stemmer bare når sedelen er ny. Ved S2 sletter `deleteMany` kun rader med id i payloaden; web-radene står igjen → **PC 07–15 + mobil 07–15 = 16 t lagret**, ingen vakt | `dagsseddel.ts:5441-5450`, `deleteMany`/`createMany` `:5284-5376` (L2-A-måling) |
| M5 | Eneste signal i dag er AML-varselet over firmaets terskel (>13 t) — ikke en overlapp-vakt, og det treffer ikke 7,5 + 7,5 | `AttesteringDetalj.tsx` (arbeidstidVarsel) |
| M6 | **Sammenligningsvisningen finnes:** `DagskortSammenligning.tsx` viser appens rader mot webens pr. tidsrom, radio pr. tidsrom («appen»/«web»), kun når `syncStatus === "conflict"`; web-radene hentes live via `hentMedId` (krever nett); modus C (låst sedel) = ren lesevisning | `[id].tsx:296-305, :914-916`, `DagskortSammenligning.tsx:13-21, :87-89` |
| M7 | **Forsoningen finnes:** `forsonDagskort({ sheetId, oppdateringer[], nyeRader[] })` — valgt-lokal på et tidsrom begge hadde → erstatt server-raden **in-place på dens id**; lokal-only beholdt → opprett; valgt-web → no-op. Én `$transaction`, samme skriveregler som rad-mutasjonene, `PRECONDITION_FAILED` på låst sedel. **Ingen `fjern`-op** (Q3(b): forutsetter at tomme sider ikke er trykkbare) | `dagsseddel.ts:1819-1900` |
| M8 | **`conflict`-tilstanden beskytter lokale rader:** pull hopper over raderstatningen og oppdaterer kun hodet (status/lederKommentar/attestertVed) — utveien via lederens retur når telefonen | `timerSync.ts:684-694` |
| M9 | 🔴 **Attestanten ser ingenting:** `syncStatus` er en mobil-tilstand; web/api har ingen konflikt-indikator (0 treff i attestering). Web-radene attesteres som om de var hele dagen | grep `apps/web` attestering |
| M11 | 🔴 **Flyten ved første push** (gate-funn): mobilen sender dagen med sin egen `clientUuid` → oppslag på id treffer ikke → `create` → **P2002** → S2-handleren svarer `conflict` med serverens `clientUuid` → mobilen **nøkler om** → **først neste push** treffer grenen for eksisterende sedel. En vakt som bare ligger i eksisterende-sedel-grenen kjører aldri for den vanligste saken (dag ført på PC først, telefon synker etterpå) | `dagsseddel.ts:5830-5870` (S2), `timerSync.ts:259-290` |
| M12 | Eksisterende-sedel-grenen leser `eksisterendeITx` **inni** `$transaction` for å lukke vinduet mot samtidig attestering (`SedelAttestertConflict`) — en overlapp-vakt må ligge innenfor samme grense | `dagsseddel.ts:~5537` |
| M13 | Nøyaktig **to** skrivinger av `status: "accepted"`: `attesterRader` (`:3385`, skriver `:3562`) og `attester` (`:4529`, skriver `:4671`) | gate-måling |
| M14 | 🔴 **Pull-vakten M2 nøkler om uansett** (gate-funn v2): finner pull en lokal sedel for samme `(userId, dato)` under annen id, hoppes `pending`/`avvist` over, men alt annet — **også `conflict`** — nøkles om med `forsonSedelIdentitet`. «Ingen omnøkling før valget» holder derfor ikke over én pull-syklus. **Og omnøklingen er ufarlig:** `forsonSedelIdentitet` flytter kun id-en (rader, tillegg, maskiner, tombstones + hode), **rører ikke `syncStatus`** — en `conflict`-sedel er fortsatt `conflict`, M8 beskytter radene på neste pull, og conflict-pushvakten sender den ikke | `timerSync.ts:612-645` (M2), `:192-230` (`forsonSedelIdentitet`), `:684-694` (M8) |
| M15 | 🔴 **Hvis forslaget var et FLAGG på `sheet_timer`**, måtte hver leser filtrere det bort — overtidsgrunnlag (`overtidsgrunnlag.ts`), eksport (`rapport.ts detaljEksport`), attestering (`hentTilAttesteringFirma`, `hentForAttestering`), pull (`hentEndringerSiden` timer-rader), lønn. Én glemt leser = dobbel lønn — samme klasse som `OvertidRad.erReise?` i L2-A. **Derfor egen tabell** (Kenneth «b»): ingen eksisterende leser ser forslaget uten å spørre etter det | gate-krav v4 |
| M16 | `hentEndringerSiden` returnerer sedel-hodet (`id, clientUuid, dato, status, lederKommentar, attestertVed, normStatus, updatedAt`) + rader; pull på mobil behandler `conflict` med hode-oppdatering og hopper over rader (M8). **Det finnes ingen vei ut av lokal `conflict` uten lederens retur** — v4 trenger en, fordi valget nå kan tas på PC | `dagsseddel.ts:4735-4870`, `timerSync.ts:684-694` |
| M10 | Delt overlapp-regel finnes: `finnTidsromKonflikt(rader)` (sett) og `finnOverlappendeTidsrom(fra, til, andre)` (én mot mange), streng (`aF < bT && aT > bF`), hopper over tid-løse rader | `tidsromValidering.ts:39-100` |

🔴 **M3 + M4 sammen er hullet:** S2 ble bygget for å *ikke miste* mobilens rader ved dato-kollisjon — og lyktes — men
sammenslåingen er blind for tid. Vedtaket snur ikke S2; det setter en port foran den.

## 2. Vedtaket som regler

| # | Regel | Lukker |
|---|---|---|
| **V19.1** | 🔴 **Overlapp i tid mellom mobilens rader og serverens rader på samme sedel → ingen additiv sammenslåing.** Serveren skriver mobilens payload-rader til **forslagstabellen** `SheetTimerForslag` (ikke `sheet_timer`), setter `konfliktVentendeSiden`, og svarer `conflict` med `aarsak: "overlapp"` + server-sedelens identitet. Mobilen nøkler om som i dag (M14, ufarlig), setter `syncStatus = "conflict"` (ikke `pending`), **ingen push av rader**, og **varsler arbeideren**. Forslaget overlever at telefonen mistes | M3, M4, M14, M15 |
| **V19.2** | **Mens valget venter:** `sheet_timer` er urørt (web-radene står som de var); forslaget ligger på serveren i egen tabell, usynlig for alle lønnslesere (M15); mobilens lokale kopi er beskyttet av dagens `conflict`-vakt (M8). **Ingenting går tapt, ingenting blir dobbelt, og ingenting lønnes dobbelt.** Pull oppdaterer kun hodet — til valget er tatt (V19.7b) | M8, M15 |
| **V19.3** | **Valget kan tas to steder, med samme skrivevei:** på telefonen (`DagskortSammenligning`, M6) og på **web for arbeideren selv** (ny seksjon på `dashbord/timer/[id]`). Begge leser forslaget fra serveren, viser begge versjonene pr. tidsrom og velger **pr. tidsrom** (radio) **eller for hele dagen** (to knapper som setter alle radioene — UI-snarvei). Valget skrives **atomisk** med `forsonDagskort` (M7), som i samme tx **sletter forslaget og nuller `konfliktVentendeSiden`**. Rader som bare finnes på én side og ikke overlapper noe, beholdes alltid | M6, M7 |
| **V19.4** | 🟢 **VEDTATT (Kenneth «1. ja»):** rader som IKKE overlapper slås fortsatt sammen additivt som i dag (S2 består for dem). Vedtaket gjelder overlapp | `06d1220c` |
| **V19.5** | 🟢 **VEDTATT (Kenneth «2. blokkert»):** attesteringen **blokkeres** så lenge valget venter (`konfliktVentendeSiden` satt / forslag finnes). **Attestanten ser begge versjonene lesbart** — sedelens rader og forslaget side om side pr. tidsrom — men velger ikke. Lederens utvei er retur. Dette er ikke «flagg og lagre begge som lønn»: forslaget er ikke lønnsdata før arbeideren har valgt | `49039856`, M9 |
| **V19.6** | **Når valget aldri tas:** lederen ser blokkeringen og forslaget (V19.5) og har dagens utvei — **returnere sedelen** — som når telefonen via hodet (M8). Etter `OVERLAPP_PURRING_DAGER = 3` får arbeideren push-varsel (`services/pushVarsel.ts` finnes). Ingen automatisk avgjørelse, aldri | M8 |
| **V19.7** | 🔴 **Én delt regel:** overlapp avgjøres av `finnTidsromKonflikt([...serverRaderSomOverlever, ...payload])` — den eksisterende funksjonen på unionen, ingen ny kopi. Tid-løse rader (reise før V8) hoppes over som i dag | M10 |
| **V19.7b** | 🔴 **Veien ut av lokal `conflict` når valget er tatt på PC** (M16): pull bærer `konfliktVentendeSiden` og `antallForslag` på sedel-hodet. Mobilens pull-vakt (M8) slipper raderstatningen **kun** når (a) den lokale sedelen har `konflikt_aarsak = "overlapp"` **og** (b) serveren svarer `konfliktVentendeSiden = null` og `antallForslag = 0` → `syncStatus = "synced"`, lokale rader erstattes av serverens (det forsonede settet). For alle andre konflikt-årsaker (`laast`/`nyere`/ukjent) består M8 uendret — der finnes radene fortsatt bare lokalt. `konflikt_aarsak` er tilstand med én leser (pull), ikke identitet | M8, M16 |
| **V19.8** | **Offline:** sammenligningen trenger web-radene (M6) → uten nett viser skjermen «Konflikt — åpne med nett for å velge», radene står trygt lokalt OG på serveren. Ingen avgjørelse offline | M6 |

## 3. Leveranse A — serveren (db-timer + api)

- **A-0 Forslagstabellen `SheetTimerForslag`** (`@@map("sheet_timer_forslag")`, `packages/db-timer`, additiv migrering):
  `id` (= mobilens rad-id → idempotent erstatning pr. sedel), `sheetId` (FK → `DailySheet`, `onDelete: Cascade`),
  speil av `SheetTimer`s payload-felt (`projectId, byggeplassId?, lonnsartId, aktivitetId, fraTid?, tilTid?, timer,
  pauseMin, beskrivelse?, externalCostObjectId?, vehicleId?` + lag 2-sporet `erReise, reiseRetning, reiseOppmotestedId,
  reiseKjoretidMin, reiseAvstandM, reiseKilde, reiseRegel, tidKilde`), `kilde = "mobil"`, `mottattAt`. **Ingen
  `attestert*`-felt** — et forslag kan ikke attesteres. `@@index([sheetId])`. Stille-tomhet: tabellen er transaksjonell
  (ikke identitet) — ingen backfill; garanti = FK cascade + PK; **test (c) = grep-vakt:** `sheetTimerForslag` leses KUN i
  sammenligning (mobil-prosedyre `hentForslag`, web `hentMedId`-utvidelse for eier/attestant) og i `forsonDagskort`
  — **aldri** i `overtidsgrunnlag`, `rapport.ts`, `hentEndringerSiden`-rader eller attesteringens radsett (M15).

- **A-1 Vakten på unionen (V19.7) — på BEGGE stedene flyten kan møte server-rader, med ÉN hjelpefunksjon:**
  `finnOverlappMotServer(serverRader, payloadRader)` i `dagsseddel.ts` (eller `tidsromValidering.ts`) som bygger
  unionen av serverrader som overlever + payload og kaller `finnTidsromKonflikt` — **ingen av de to stedene skriver sin
  egen union.**
  - **A-1a S2-handleren** (M11, `:5830-5870`): etter `findUnique(userId_dato)` har truffet en sedel med annen
    `clientUuid`, les **dens** timer-rader og kjør hjelpefunksjonen mot `lokal.timer`. Treff → **i én tx:** slett
    sedelens eksisterende forslag, `createMany` payload-radene som forslag (A-0), sett `konfliktVentendeSiden = now()`;
    svar `conflict` med `aarsak: "overlapp"` + `serverData.clientUuid/id`. **`sheet_timer` urørt.** Ikke treff →
    `aarsak: "dato_kollisjon"` (V19.4 vedtatt: mobilen nøkler om og pusher additivt som i dag). **Dette er den
    vanligste saken** — dag ført på PC først.
  - **A-1b eksisterende-sedel-grenen** (etter en tidligere sammenslåing, eller samme enhet): web legger til en rad
    ETTER merge, mobilen pusher igjen. 🔴 **Inni `$transaction`** (M12, TOCTOU): les de overlevende serverradene med
    `tx` **etter `eksisterendeITx` og før `deleteMany`**; treff → kast `SedelOverlappConflict` (egen klasse, samme
    mønster som `SedelAttestertConflict`) → tx ruller tilbake (**ingenting i `sheet_timer` skrives**) → `catch` skriver
    forslaget i en **egen, kort tx** (slett + `createMany` + `konfliktVentendeSiden`, som A-1a) og svarer `conflict/
    overlapp`. Forslaget skrives utenfor hoved-tx med vilje: hoved-tx MÅ rulle tilbake, forslaget MÅ bestå. En lesning
    utenfor tx ville latt en web-rad lagt til mellom sjekk og skriving slippe gjennom — TOCTOU-klassen fra
    `forsonDagskort` (lukket `9c7c1ad1`). **Idempotent:** ny push av samme forslag erstatter pr. sedel.
  - Ny-sedel-grenen er uendret (ingen server-rader å overlappe).
- **A-2 `aarsak`-feltet** på `conflict`-resultatet: `"laast" | "nyere" | "dato_kollisjon" | "overlapp"` — i dag skilles
  grenene kun på `serverData.clientUuid !== clientUuid` (M3). Eksplisitt årsak gjør at mobilen aldri igjen må gjette fra
  identitet. Zod på klienten: ukjent årsak → behandles som `"laast"` (konservativt, ingen auto-merge).
- **A-3 `DailySheet.konfliktVentendeSiden DateTime?`** (samme migrering som A-0): settes i A-1 ved overlapp, **nulles**
  av `forsonDagskort` (atomisk, samme tx som sletter forslaget) og av en vellykket push uten overlapp på samme sedel (da
  slettes også ev. forslag — arbeideren rettet på telefonen). Invariant: `konfliktVentendeSiden != null ⇔ forslag
  finnes` — **test som FEILER** når én av dem står alene etter en mutasjon.
- **A-4 `hentTilAttesteringFirma`/`hentForAttestering`** returnerer feltet; **begge attesteringsveiene** (M13) —
  `attesterRader` (`:3385`, skriving `:3562`) og `attester` (`:4529`, skriving `:4671`) — **avviser** med
  `PRECONDITION_FAILED «Arbeideren har en uavklart overlapp — avvent eller returner sedelen»` når feltet er satt
  (V19.5). Vakten ligger i én delt helper begge kaller, før `status: "accepted"` skrives.
- **A-5 `forsonDagskort`** beholder formen (M7: `oppdateringer` in-place + `nyeRader`), og får tre ting: (1) i SAMME
  interaktive tx (den status-betingede `updateMany` åpner den, `:2014-2017`): `deleteMany` forslag for sedelen +
  `konfliktVentendeSiden = null` — **også når `oppdateringer` og `nyeRader` er tomme** («behold web for hele dagen» er
  et gyldig valg; dagens tidlige `return` ved tomt sett må inn i tx-en) · (2) vakt: resultatet kjøres gjennom
  `finnTidsromKonflikt` — forsoningen skal aldri etterlate en overlapp · (3) klientene bygger `oppdateringer`/`nyeRader`
  fra **forslaget på serveren** (ikke fra lokale rader) — mobil og web gjør det identisk, via én delt
  `byggForsonInputFraValg(sedelRader, forslag, valg)` i `@sitedoc/shared` (ren, testet).
- **A-7 Lesing av forslaget:** `dagsseddel.hentMedId` (eier) og `hentForAttestering` (leder) får `forslag:
  SheetTimerForslag[]` + `konfliktVentendeSiden`; `hentEndringerSiden` får **kun** `konfliktVentendeSiden` og
  `antallForslag` på hodet (V19.7b) — aldri forslagsradene (M15). Ny mobil-prosedyre `hentForslag(sheetId)` er unødig:
  mobilen bruker `hentMedId` som i dag (M6).
- **A-6 Purring (V19.6):** daglig jobb (eksisterende cron-mønster for 12 t auto-utsjekk, `mannskap.ts:43-53`) som sender
  push-varsel til arbeideren for sedler med `konfliktVentendeSiden < now − OVERLAPP_PURRING_DAGER`. Én gang pr. døgn pr.
  sedel. Konstant i `rad-tak.ts`-stil.

## 4. Leveranse B — mobilen

- **B-1 `timerSync.ts` M3-grenen** brancher på `aarsak` **ved første svar** (A-1a gjør at svaret alt vet om overlapp):
  `"overlapp"` → **omnøkling som i dag** (`forsonSedelIdentitet(lokal, serverData.clientUuid)`, M14: ufarlig, rører
  ikke `syncStatus`), **men `syncStatus = "conflict"` i stedet for `pending`** → ingen push; `feilmelding =
  t("timer.sync.overlappKonflikt")`, teller `konflikt++` (ikke `merged`). Sammenligningen henter web-kortet på
  sedelens egen id (= serverens) og `forsonDagskort` skriver til den — **nøyaktig dagens konflikt-vei (M6/M7).**
  🔴 **Ingen ny lokal kolonne, ingen lokal migrering** (v2s `konflikt_server_id` er strøket: en identitetskolonne uten
  behov som ville driftet fra M2 — stille tomhet i miniatyr). `"dato_kollisjon"` → omnøkling + additiv push som i dag
  (V19.4); `"laast"`/`"nyere"`/ukjent → dagens server-wins-konflikt. **B-1 er dermed én linje: `conflict` i stedet for
  `pending`.**
- **B-1b `dagsseddel_local.konflikt_aarsak TEXT`** (lokal, idempotent migrering): settes fra `aarsak` når `conflict`
  settes; leses av pull (V19.7b). Tilstand med én leser — ikke identitet.
- **B-2 Varsling (V19.1):** statusbaren viser konflikt (som server-wins gjør i dag), sedelen får banner «Dagen er også
  registrert på PC, og tidene overlapper. Se begge og velg — her eller på PC.» med knapp til sammenligningen. Lokalt
  push-varsel når synken setter tilstanden.
- **B-3 Sammenligningen (V19.3):** `DagskortSammenligning` leser **forslaget fra serveren** (`hentMedId.forslag`) i stedet
  for lokale rader som «appen»-siden — da viser telefonen det samme som PC-en, også etter at brukeren rettet lokalt
  (lokale rader er fortsatt kilden til NESTE push, ikke til visningen). To «hele dagen»-knapper (setter `valg` for alle
  tidsrom); `onBekreft` → `byggForsonInputFraValg` → `forsonDagskort`; svaret speiles til lokal, `syncStatus =
  "synced"`, `konflikt_aarsak = null`. Tidsrom som bare finnes på én side er ikke valgbare (Q3(b) består).
- **B-3b Valget tatt på PC (V19.7b):** pull ser `konfliktVentendeSiden = null ∧ antallForslag = 0` på en lokal
  `conflict`-sedel med `konflikt_aarsak = "overlapp"` → `syncStatus = "synced"`, raderstatning som normalt. **Test
  som FEILER** hvis en `laast`-konflikt slippes av samme regel (M8 skal bestå for den).
- **B-4 Offline (V19.8):** `erKonflikt && !erPaaNettet` → tekst, ingen valg-affordance; radene beholdes.
- **B-5 Modus C:** overlapp mot en **låst** web-sedel (`sent`/`accepted`) → `forsonDagskort` avviser (M7) → visningen
  er lesevisning + «be leder returnere» som i dag. V19 endrer ikke det.

## 5. Leveranse C — web: arbeiderens valg + attestantens lesing

- **C-1 Arbeiderens flate (V19.3):** `dashbord/timer/[id]` (`DagsseddelDetaljSide`) får seksjonen «Forslag fra mobilen —
  velg» når `hentMedId.forslag.length > 0`: to kolonner pr. tidsrom (PC-rad / forslag), radio, to «hele dagen»-knapper,
  «Bekreft» → `byggForsonInputFraValg` → `forsonDagskort`. Samme regler som mobil (Q3(b): en side alene er ikke
  valgbar). Kun for sedelens eier.
- **C-2 Attestanten (V19.5):** `SeddelKort`/`AttesteringDetalj` viser forslaget **lesbart** side om side med radene
  («Forslag fra mobil, venter på arbeiderens valg siden dd.mm»), ingen radio; attester-knappen deaktivert med tooltip
  («Arbeideren har ikke valgt mellom PC og mobil — avvent eller returner sedelen»). i18n ×15.
- **C-3** Rapport/eksport/PDF: **ingen endring** — forslag går aldri ut (paritetsmatrisen).

## 6. Tester som skal FEILE (DoD)

1. **Første push** (M11): PC 07–15 finnes, mobil 07–15 med egen `clientUuid` → S2 svarer `dato_kollisjon` og mobilen
merger (skal: `conflict/overlapp` i S2-svaret, 0 rader i `sheet_timer`, **N rader i `sheet_timer_forslag`**,
`konfliktVentendeSiden` satt) · 1d. **Forslaget lekker:** en forslagsrad dukker opp i `beregnOvertidsgrunnlag`-input,
`detaljEksport`, `hentEndringerSiden.timer` eller attesteringens radsett (grep-vakt + ende-til-ende) · 1e. Ny push av
samme forslag dobler radene (skal: erstattes pr. sedel) · 1b. **Etter merge:** web legger til 12–14, mobil
pusher 13–15 → skrives (skal: `SedelOverlappConflict` → rollback → `conflict/overlapp`) · 1c. **TOCTOU:** vakten i A-1b
leser serverrader med en annen klient enn `tx` (grep-/typevakt: helperen tar `tx`, ikke `prismaTimer`) ·
2. PC 07–11 + mobil 12–15 (ingen overlapp) → `conflict` (skal: additiv merge som i dag, V19.4) ·
3. Overlapp-vakten bruker en annen funksjon enn `finnTidsromKonflikt` (grep-vakt) ·
4. `forsonDagskort` lykkes uten å nulle `konfliktVentendeSiden` **eller uten å slette forslaget** — også ved tomt
valgsett («behold web for hele dagen») ·
5. Attestering lykkes mens `konfliktVentendeSiden` er satt — **testes for BEGGE veier**, `attesterRader` og `attester` (M13) ·
6. Mobil setter `pending`/omnøkler ved `aarsak: "overlapp"` (skal: `conflict`, rader urørt) ·
7. Pull erstatter lokale rader på en `conflict`-sedel (M8 består) ·
8. Ukjent `aarsak` fra server → auto-merge (skal: behandles som låst) · 9. De to overlapp-stedene (A-1a/A-1b) kaller
hver sin union-bygging (skal: én `finnOverlappMotServer`, grep-vakt) · **10. (M14, i `timerSync.test.ts`-harnessen):**
overlapp-konflikt satt → pull leverer serverens sedel for samme dato under annen id, **med forslag fortsatt på
server** → den lokale sedelen er **fortsatt `conflict`** og mobilens rader **urørt** · **11. (V19.7b):** samme, men
serveren svarer `konfliktVentendeSiden = null, antallForslag = 0` → `synced`, rader erstattet; og en `laast`-konflikt
slippes IKKE av samme pull · 12. **Eldre app** (uten `aarsak`-branch): første push → S2 lagrer forslag + conflict →
eldre app nøkler om, pending → neste push → A-1b lagrer forslag igjen (idempotent) + conflict med lik `clientUuid` →
vanlig konflikt, radene beskyttet; **ingen rad i `sheet_timer`** i noe steg.

**Fasit-scenario A (telefon):** web 07:00–15:00 (7,5 t) + mobil 07:00–15:30 (8 t): push → forslag lagret, conflict/
overlapp → banner → arbeideren velger «appen» for hele dagen på telefonen → `forsonDagskort` erstatter web-raden
in-place, sletter forslaget → serveren har 8 t, ikke 15,5; `konfliktVentendeSiden` null; attestering mulig.
**Fasit-scenario B (PC):** samme start → arbeideren åpner `dashbord/timer/[id]` på PC, ser forslaget, velger «behold PC
for hele dagen» → `forsonDagskort` med tomt sett sletter forslaget + nuller feltet → serveren har 7,5 t → telefonen
puller: `konfliktVentendeSiden = null, antallForslag = 0` → `synced`, lokale rader erstattet av 7,5-t-raden.
**Mens valget venter (begge):** attestanten ser begge versjonene, attester-knappen er død; overtidsgrunnlag og eksport
ser 7,5 t (kun `sheet_timer`).

## 7. Ordre (anbefaling)

| Ordre | Innhold | Avhenger av | Migrering |
|---|---|---|---|
| **V19-A** | Leveranse A (db-timer + api): `SheetTimerForslag` + `konfliktVentendeSiden`, vakt på unionen (A-1a/A-1b), `aarsak`, forslagsskriving, `forsonDagskort`-utvidelsen, lesing i `hentMedId`/`hentForAttestering`/`hentEndringerSiden`-hode, attester-vakt (begge veier), purring, `byggForsonInputFraValg` i shared | ingen | `db-timer` additiv: tabell + kolonne (Kenneth-gatet) |
| **V19-B** | Leveranse B (mobil): `aarsak`-branch, `konflikt_aarsak`, sammenligning fra server-forslag, V19.7b-slipp | V19-A merget (feltene må finnes i svaret før mobilen leser dem — M6-lærdommen) | lokal mobil (`konflikt_aarsak`) |
| **V19-C** | Leveranse C (web): arbeiderens valg på `dashbord/timer/[id]` + attestantens lesing + blokkering | V19-A merget | — |

**Server først. V19-B ∥ V19-C etter V19-A.** V19-A går til kontrollplan når V17-B er ferdig (orkestrators kø).

## 8. Åpne punkter for gaten / Kenneth

1. ~~V19.4~~ — 🟢 Kenneth «1. ja» (`06d1220c`).
2. ~~V19.5~~ — 🟢 Kenneth «2. blokkert» (`49039856`).
3. **`OVERLAPP_PURRING_DAGER = 3`** — tall valgt av fabel, navngitt konstant.
5. **Eldre app etter valg på PC:** uten V19-B har den ingen V19.7b-slipp og blir stående i lokal `conflict` til den
   oppdateres (radene er trygge, forslaget er borte på server). Akseptert — OTA-oppdatering løser det; føres i
   FUNKSJONSENDRINGER.
6. **Forslag på en LÅST sedel** (`sent`/`accepted` — modus C): A-1 lagrer forslaget og setter feltet selv om sedelen er
   låst? Jeg sier **nei**: låst sedel → dagens server-wins-konflikt (`laast`), ingen forslag — forslaget ville ikke
   kunne velges (`forsonDagskort` avviser låst), og attestanten blokkeres ikke av noe hun alt har attestert. Gate det.
4. **A-2 `aarsak` — eldre app (målt mot `timerSync.ts:259-290`, rettet etter gate):** eldre app ignorerer `aarsak`.
   Første svar (A-1a, `overlapp`) har `serverData.clientUuid ≠ lokal` → den nøkler om og setter `pending` (M3) → neste
   push treffer A-1b → `conflict/overlapp` med `clientUuid` **lik** → eldre app faller i den vanlige `conflict`-grenen:
   `syncStatus = conflict`, radene beskyttet (M8), sammenligningen vises. **Ingen loop — en vanlig konflikt**, og
   ingenting skrives i noe steg. Bedre enn først antatt; FUNKSJONSENDRINGER-notatet sier «eldre app får konflikt i
   stedet for stille sammenslåing», ikke «loop».
