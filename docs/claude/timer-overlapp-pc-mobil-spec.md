---
name: timer-overlapp-pc-mobil-spec
description: Spesifikasjon for V19 — når en dagsseddel registrert på PC og en registrert på mobil for samme dag overlapper i tid, lagres mobilens rader som FORSLAG på serveren (egen tabell), arbeideren varsles og velger selv — på telefonen eller på PC — pr. tidsrom eller for hele dagen; attestanten ser begge versjonene lesbart og kan ikke attestere før valget er tatt. Kenneth-vedtak 2026-10-04 (b · V19.4 ja · V19.5 blokkert). v4. Skrevet av fabel, gates av orkestrator.
sist_verifisert_mot_kode: 2026-10-04
eier: fabel (kontroll-Claude) — orkestrator gater
status: 🟢 IMPLEMENTERT 2026-10-05 — V19-A `73fe99c0` · V19-B `8100fcc0` · V19-C `9d400c02` (A-6 purring utsatt, BACKLOG). Test: V19-A+B deployet `9145404b`; V19-C venter web-deploy · **§ 9 V19.9 (versjonssjekk pr. rad) 🟢 GATET 2026-10-06 (orkestrator) — 🟡 V19.9-A (server) LEVERT i `feat/v19-9a-versjonssjekk-server` (IKKE merget): klassifisering `apps/api/src/routes/timer/sync-versjon.ts`, `radInnholdLikt` `packages/shared/src/utils/radInnhold.ts`, paring/valg `forsonValg.ts`, migrering `20261006120000_v19_9_forslag_grunn`. V19.9-B (mobil+web) + V19.9-H (hode) IKKE STARTET**
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

**§ 9 (2026-10-06) utvider spørsmålet:** hva skjer når *samme rad* er endret på PC og telefon uten å overlappe i tid
— versjonssjekk pr. rad, samme forslagsvei (V19.9).

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
  - **Én hjelpefunksjon `lagreOverlappForslag(tx, sheetId, payloadRader)`** brukes av BEGGE stedene, så statusvakten
    finnes ett sted. Den gjør, i den tx-en kalleren alt står i: (1) `updateMany({ where: { id: sheetId, status: { notIn:
    ["sent","accepted"] } }, data: { konfliktVentendeSiden: now } })` — **antall 0 = sedelen er låst → returner
    `"laast"`** (§ 8.6: ingen forslag på låst sedel, ingen `konfliktVentendeSiden`); den betingede `updateMany` er både
    statusvakt og radlås, samme mønster som `SedelAttestertConflict`-guarden og `forsonDagskort` · (2) `deleteMany` +
    `createMany` på `SheetTimerForslag` for sedelen (idempotent erstatning) · (3) returner `"overlapp"`. **Ingen
    `throw`, ingen egen feilklasse, ingen andre tx.**
  - **A-1a S2-handleren** (M11, `:5830-5870`): etter `findUnique(userId_dato)` har truffet en sedel med annen
    `clientUuid`: åpne én tx, les **dens** timer-rader via `tx`, kjør `finnOverlappMotServer` mot `lokal.timer`. Treff →
    `lagreOverlappForslag(tx, …)` → `"overlapp"` → svar `conflict` med `aarsak: "overlapp"` + `serverData.clientUuid/id`;
    `"laast"` → svar `conflict` med `aarsak: "laast"` (dagens server-wins). **`sheet_timer` urørt.** Ikke treff →
    `aarsak: "dato_kollisjon"` (V19.4 vedtatt: mobilen nøkler om og pusher additivt som i dag). **Dette er den
    vanligste saken** — dag ført på PC først.
  - **A-1b eksisterende-sedel-grenen** (etter en tidligere sammenslåing, eller samme enhet): web legger til en rad
    ETTER merge, mobilen pusher igjen. 🔴 **Inni den eksisterende `$transaction`** (M12), **rett etter `eksisterendeITx`
    (`:5535`) og FØR header-skrivingen** (`create`/den status-betingede `updateMany` ~`:5578`): les de overlevende
    serverradene via `tx`, kjør `finnOverlappMotServer`. Treff → `lagreOverlappForslag(tx, …)` i **samme tx** og
    `return` en markør — **ingen header- eller radskriving fra payloaden, ingen `throw`**; `catch`-blokken berøres ikke.
    `"laast"` fra hjelperen → markør `laast`. *(v4 kastet `SedelOverlappConflict` og skrev forslaget i en egen tx —
    gate 2026-10-05: den andre tx-en hadde ingen statusvakt, så et forslag kunne lande på en sedel attestert i vinduet
    mellom tilbakerullingen og forslags-tx-en — og låse den uten utvei. Én tx lukker det og er enklere.)* **Idempotent:**
    ny push av samme forslag erstatter pr. sedel.
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
pusher 13–15 → payloadens header-felt eller rader skrives (skal: forslaget lagres, `sheet_timer` urørt, **header-feltene
fra payloaden IKKE skrevet**, `conflict/overlapp`) · 1c. **TOCTOU:** vakten i A-1b
leser serverrader med en annen klient enn `tx` (grep-/typevakt: `lagreOverlappForslag` og lesingen tar `tx`, ikke
`prismaTimer`) ·
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
vanlig konflikt, radene beskyttet; **ingen rad i `sheet_timer`** i noe steg · **13. (§ 8.6, begge steder):** sedelen er
`accepted` idet overlappsjekken treffer → svaret er `laast`, og det skrives **ingen** forslag og ingen
`konfliktVentendeSiden` — i A-1a OG A-1b (den betingede `updateMany` gir 0).

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
6. ~~Forslag på en LÅST sedel~~ — 🟢 **avgjort i gate 2026-10-05: nei** (statusvakten i `lagreOverlappForslag` gir `laast`). Begrunnelsen var: låst sedel → dagens server-wins-konflikt (`laast`), ingen forslag — forslaget ville ikke
   kunne velges (`forsonDagskort` avviser låst), og attestanten blokkeres ikke av noe hun alt har attestert. Gate det.
4. **A-2 `aarsak` — eldre app (målt mot `timerSync.ts:259-290`, rettet etter gate):** eldre app ignorerer `aarsak`.
   Første svar (A-1a, `overlapp`) har `serverData.clientUuid ≠ lokal` → den nøkler om og setter `pending` (M3) → neste
   push treffer A-1b → `conflict/overlapp` med `clientUuid` **lik** → eldre app faller i den vanlige `conflict`-grenen:
   `syncStatus = conflict`, radene beskyttet (M8), sammenligningen vises. **Ingen loop — en vanlig konflikt**, og
   ingenting skrives i noe steg. Bedre enn først antatt; FUNKSJONSENDRINGER-notatet sier «eldre app får konflikt i
   stedet for stille sammenslåing», ikke «loop».

---

## 9. V19.9 — versjonssjekk pr. rad: avvik PC ↔ telefon oppdages uansett hvordan dagen ble opprettet (2026-10-06)

> Hjemmel: **Kenneth 2026-10-05, ordrett:** *«det er mennesker som skal fylle ut → dersom systemet ikke finner ut av
> dette uten en perfekt måte å opprette ting på → da mangler systemet noe»*. Målt på test samme kveld (orkestrator):
> 5. oktober ført på telefon og PC uten å sende → serveren har ÉN sedel (`f6085a9c`) med én rad; telefonen og PC-en
> jobber i **samme** sedel, og V19.1–V19.8 slo ikke inn fordi de bare dekker overlapp i **klokketid**. BACKLOG
> `8819b046`. **Alt under er spesifikasjon** — ❌ IKKE IMPLEMENTERT inntil ordren er merget. V19.9 **gjenbruker V19
> fullt ut** (forslagstabell, `konfliktVentendeSiden`, `aarsak: "overlapp"`, `forsonDagskort`, blokkert attestering,
> V19.7b-slipp) — ingen ny konfliktmekanisme, kun en ny *oppdager* foran den.

### 9.1 Målt utgangspunkt (2026-10-06, develop `0be85a36`)

| # | Fakta | Bevis |
|---|---|---|
| M17 | 🔴 **`syncBatch` erstatter rader etter id uten å spørre om serverraden er endret siden telefonen hentet den:** `deleteMany({ sheetId, id: { in: timerIder } })` + `createMany(lokal.timer)`. Sist synket vinner, stille. `createMany` gir raden ny `createdAt`/`updatedAt` ved hver push | `dagsseddel.ts:5893-5896, :5936-5964` |
| M18 | Serveren har en radversjon: `SheetTimer.updatedAt @updatedAt`. Web-redigering går via `sheetTimer.update` (`:1909`, `:3538`, `:3682`) og `delete` (`:1936`) → versjonen bumpes pr. rad. `hentEndringerSiden` returnerer `updatedAt` **kun på sedel-hodet**, ikke pr. rad | `schema.prisma:302`, `dagsseddel.ts:5068-5114` |
| M19 | Mobilen husker ikke serverversjonen: `sheet_timer_local` har `sistEndretLokalt` (ms, enhetsklokke), ingen `server_versjon`; `slettede_rader_local` har `radId, dagsseddelId, radType, slettetVed` | `schema.ts:142-164, :250-258` |
| M20 | Mobilen sender **alle** rader ved hver push (ikke bare endrede), pluss `slettedeIder` fra tombstones; push-`ok` oppdaterer kun sedel-hodet lokalt (`syncStatus/status/lederKommentar/attestertVed/sistSynkronisert`) og rydder tombstones — radene røres ikke | `timerSync.ts:391-395, :446-450, :537-545, :238-257` |
| M21 | Pull erstatter alle lokale rader for sedelen (`delete` + insert fra server), stempler dem `sistEndretLokalt = sistSynkronisert = serverTidMs` (servertid). Pull hoppes over for `pending`/`avvist` (M2) og for `conflict` uten V19.7b-slipp (M8) | `timerSync.ts:694-699, :760-763, :853-868` |
| M22 | Sedel-hodet (`startAt/endAt/pauseMin/beskrivelse`) er egen brukerinput begge steder: web `oppdater` (`:1638-1641`), mobil `StartSluttDagKort`/`dagsforslagAnvend`. `DailySheet.updatedAt` bumpes eksplisitt også ved rad-mutasjoner (F4-1d, `:215-232`) → hode-versjonen kan **ikke** skilles fra rad-endringer med dagens kolonner | `dagsseddel.ts:215-232`, `schema.ts:100-141` |
| M23 | Validerings-lagene i `syncBatch` (`finnTidsromKonflikt(lokal.timer)`, `validerMaskinUnderArbeid`, reise-felter) regner på **hele payloaden** som post-state. Å utelate uendrede rader fra payloaden ville bryte dem — derfor sendes alle rader fortsatt (M20), og versjonssjekken avgjør pr. rad hva som faktisk skrives | `dagsseddel.ts:5654-5720` |
| M24 | V19-A-flyten ved avvik: `lagreOverlappForslag(tx, sheetId, payloadRader, projectId)` → betinget `updateMany` (statusvakt) → `deleteMany`+`createMany` forslag → markør `overlapp`; **ingen** header- eller radskriving. `SheetTimerForslag` har ingen årsak-kolonne | `dagsseddel.ts:355-400`, `schema.prisma:341-375` |
| M25 | `parForslagMotSedel` parer forslag ↔ sedelrad **på overlapp i tid**, ikke på id; forslag uten motpart = «forslag kun», **ikke valgbar, opprettes alltid** ved forsoning (Q3(b)); sedelrad uten motpart beholdes alltid. `forsonDagskort` tar `oppdateringer` + `nyeRader` — ingen sletting | `forsonValg.ts:92-153, :178-210`, `dagsseddel.ts:1965-2000` |

🔴 **M17 + M20 er hullet:** én endret rad på PC overlever bare til telefonens neste push av *samme* sedel — og telefonen
pusher hele sedelen hver gang den endrer *noe*. Dette treffer både dager telefonen har opprettet og synket, og dager
den har hentet. V19 (S2/P2002) ser aldri saken, fordi det er samme `clientUuid`.

### 9.2 Vedtaket som regler

| # | Regel | Lukker |
|---|---|---|
| **V19.9.1** | 🔴 **Radversjonen er `SheetTimer.updatedAt`** (finnes, M18). Pull (`hentEndringerSiden.timer[]`) returnerer `updatedAt` pr. rad. Mobilen lagrer den som `sheet_timer_local.server_versjon` (ISO-streng) ved pull og ved push-`ok` (fra svaret), og sender den tilbake som `serverVersjon` på hver rad i `syncBatch`. Sammenligning = **streng-likhet på ISO-ms** (`s.updatedAt.toISOString() === r.serverVersjon`); Prisma skriver `@updatedAt` med ms-presisjon, så rundturen er tapsfri — **test (c) i § 9.6 nr. 9 vokter presisjonen** | M17–M19 |
| **V19.9.2** | 🔴 **Mobilen sier om den selv har rørt raden:** `endretLokalt: boolean` pr. rad = `rad.sistEndretLokalt !== sedel.sistSynkronisert`. Likhets-, ikke størrelses-sammenligning — pull stempler begge med samme `serverTidMs` (M21), og push-`ok` skal **restemple** payloadens rader og sedelen med samme `naa`. Da er regelen immun mot klokkeskjevhet mellom enhet og server (en `>`-regel ville gjort en ekte redigering «ren» når enhetsklokken står bak serveren → stille tap). Edit under pågående push: restemplingen gjelder kun rader med `sistEndretLokalt <= byggetVed` (payloadens byggetidspunkt) | M20, M21 |
| **V19.9.3** | 🔴 **Klassifisering pr. payload-rad i eksisterende-sedel-grenen (A-1b), inni `$transaction`, FØR noe skrives** — tabellen i § 9.3 er uttømmende. Tre utfall: **skriv** (som i dag), **hopp over** (serverraden står, payload-raden ignoreres — PC-en har en nyere versjon telefonen ikke hadde rørt), **avvik** (→ forslag). «Ukjent» versjon (eldre app, felt mangler, eller `null` på en rad som likevel finnes på server) avgjøres på **innhold**: likt → skriv (idempotent), ulikt → avvik. **Aldri** stille overskriving av en serverrad med annen versjon | M17 |
| **V19.9.4** | **Innhold** = de payload-skrivbare feltene `projectId, byggeplassId, lonnsartId, aktivitetId, externalCostObjectId, vehicleId, timer, fraTid, tilTid, beskrivelse, pauseMin` — **ikke** reise-sporet (server-utledet, lag 2) og ikke `attestert*`. Én delt, ren funksjon `radInnholdLikt(server, payload)` i `@sitedoc/shared` (testet; normaliserer `null`/`undefined`/`""` og `Decimal`→tall) | M18 |
| **V19.9.5** | 🔴 **Ved avvik: V19s vei, uendret.** `lagreOverlappForslag(tx, …)` med **forslagsradene = de avvikende radene** (telefonens versjon, eller en slett-markør), `konfliktVentendeSiden` settes, svaret er `conflict` med `aarsak: "overlapp"` (wire-kompatibelt med V19-B: `conflict` + rader beskyttet + V19.7b-slipp virker uendret). **Rader uten avvik og hodet skrives som i dag i samme tx** (Kenneths krav 4) — det er forskjellen fra ren V19.1, der hele payloaden blir forslag; begrunnelse: ved versjonsavvik er de øvrige radene *ikke* omstridt, og å holde dem tilbake ville gjøre telefonens dag usynlig for attestanten uten grunn. Overlapp i tid (V19.1) har fortsatt forrang: finnes overlapp i post-state-unionen, går **hele** payloaden som forslag som i V19-A, og avvikende rader beholder sin `grunn` | M24, V19.4 |
| **V19.9.6** | **`SheetTimerForslag.grunn`** `String @default("overlapp")` ∈ `overlapp · endret_begge · slettet_pc · slettet_telefon`. Additiv kolonne med default → alle eksisterende forslag er korrekt «overlapp» (backfill = default, ingen tom verdi fødes). En `slettet_telefon`-rad er en **kopi av serverraden** (samme id) med `grunn = "slettet_telefon"` — forslaget er «ingen rad her». En `slettet_pc`-rad er telefonens rad (serverraden finnes ikke) | M24 |
| **V19.9.7** | 🔴 **Paring og valg i `parForslagMotSedel`/`byggForsonInputFraValg` (delt shared, begge klienter):** forslag med `grunn ∈ {endret_begge, slettet_telefon}` pares **på id** med sedelraden (før dagens tidsoverlapp-paring); `slettet_pc` har ingen motpart og blir en **valgbar** «forslag kun»-slot (PC: *slettet* / telefon: raden) — i motsetning til Q3(b)s alltid-opprett, som ville gjenoppstått en rad PC-en slettet med vilje. Valg «forslag» på en `slettet_telefon`-slot → ny `forsonDagskort.slettinger: string[]` (sedelrad-id-er som slettes i samme tx); valg «sedel» → no-op. Mangler valg → behold PC (dagens konservative regel). `forsonDagskort` kjører fortsatt `finnTidsromKonflikt` på resultatet etter sletting | M25 |
| **V19.9.8** | **Push-`ok`-svaret bærer versjonene:** `serverData.rader: { id, updatedAt }[]` for radene som ble **skrevet**, og `hoppetOver: string[]`. Mobilen skriver `server_versjon` for `rader` og restempler (V19.9.2). **Hoppede rader speiles aktivt (rettet 2026-10-06, gate V19.9-B retur 1):** ved `ok` med `hoppetOver ≠ ∅` henter mobilen sedelen (`hentMedId`, samme `medTimeout`) og speiler **kun** de hoppede radene — serverens innhold + `server_versjon = updatedAt` + `sistEndretLokalt = naa`; rad borte på server (R8) → slettes lokalt; feiler hentingen → raden restemples (`naa`), versjon og innhold står, og speilingen prøves ved neste `ok`. *Hvorfor ikke «neste pull»:* `hentEndringerSiden` bruker `updatedAt > max(sistSynkronisert)`, og push-`ok` setter `sistSynkronisert = naa` **etter** serverens skriving — serverens egen push-tx faller derfor utenfor delta-vinduet, og en hoppet rad ville stått stale på telefonen til noe annet bumpet sedelen (og blitt en falsk R4 ved neste push). Alternativ (ikke valgt): server-svar med `hoppetOverRader` (innhold + `updatedAt`). **Aldri** sett versjon på en rad hvis innhold ikke ble lagret — da ville neste push skrevet stale innhold med «riktig» versjon | M20 |
| **V19.9.9** | **Sedel-hodet (`startAt/endAt/pauseMin/beskrivelse`) — egen leveranse (§ 9.5 V19.9-H):** ny `DailySheet.hodeOppdatertAt DateTime?` bumpes **kun** av prosedyrer som skriver ett av de fire feltene (`opprett`, `oppdater`, `syncBatch` header-skriving, midnatt-deling) — grep-vakt + test; backfill `= updatedAt` i migreringen (ingen tom fødsel); pull returnerer den; mobilen lagrer `dagsseddel_local.server_hode_versjon`, sender `hodeVersjon` + `hodeEndretLokalt`. Avvik (ulik versjon ∧ `hodeEndretLokalt` ∧ ulikt innhold) → `DailySheet.hodeForslag Json?` (`{ startAt, endAt, pauseMin, beskrivelse, mottattAt }`), `konfliktVentendeSiden` settes, hodet **ikke** skrevet; invariant utvides: `konfliktVentendeSiden ≠ null ⇔ (forslag finnes ∨ hodeForslag ≠ null)`. Valg-slot «Dagens start/slutt/pause» i begge klienter; `forsonDagskort.hode?: {…}` skriver valgt hode og nuller `hodeForslag` alltid. **Inntil V19.9-H er merget gjelder dagens hode-skriving (sist synket vinner) — ført som kjent hull, ikke lønnsbærende (radene bærer `fraTid/tilTid`)** | M22 |

### 9.3 Matrisen — alle kombinasjoner (Kenneths krav 3)

**Rader.** `s` = serverrad med samme id på sedelen, `v` = `serverVersjon` i payloaden, `e` = `endretLokalt`, `=`/`≠` = innhold (V19.9.4).

| # | Situasjon | `s` | `v` | `e` | innhold | Utfall | Dekker |
|---|---|---|---|---|---|---|---|
| R1 | uendret begge | finnes | `= s.updatedAt` | — | — | **skriv** (idempotent, som i dag) | — |
| R2 | endret telefon, uendret PC | finnes | `= s.updatedAt` | true | ≠ | **skriv** — telefonens endring lander | — |
| R3 | uendret telefon, **endret PC** | finnes | ≠ | false | ≠ | **hopp over** — PC-en vinner uten støy; telefonen henter den ved neste pull | 🔴 dagens stille overskriving (Kenneths test 5. okt) |
| R4 | **endret begge** | finnes | ≠ | true | ≠ | **avvik** → forslag `endret_begge` (telefonens rad), serverraden står, valg pr. rad | krav 3a |
| R5 | begge endret til det samme | finnes | ≠ | true | = | **hopp over** (ingenting å velge; serverraden er alt riktig) | — |
| R6 | ny rad på telefon | mangler | `null`/mangler | — | — | **opprett** (som i dag) | — |
| R7 | **slettet PC, endret telefon** | mangler | satt | true | — | **avvik** → forslag `slettet_pc` (telefonens rad), **ingen gjenoppstandelse** i `sheet_timer` | krav 3c |
| R8 | slettet PC, uendret telefon | mangler | satt | false | — | **hopp over** (PC-slettingen står; telefonen rydder ved pull) | i dag: stille gjenoppstandelse |
| R9 | eldre app / ukjent versjon, serverrad finnes | finnes | mangler (eller `null`) | mangler | = | **skriv** (idempotent) | krav 5 |
| R10 | eldre app / ukjent versjon, serverrad finnes | finnes | mangler (eller `null`) | mangler | ≠ | **avvik** → forslag `endret_begge` — trygg retning: aldri stille overskriving. Kostnad for eldre app: hver reell redigering av en eksisterende rad blir en konflikt til appen er OTA-oppdatert (V19-B-appen viser den som vanlig konflikt, rader beskyttet, valg på PC virker) | krav 5 |
| R11 | eldre app, serverrad mangler | mangler | mangler | mangler | — | **opprett** (status quo; kan ikke skilles fra R6 — restrisiko R7/R8 for eldre app til OTA) | krav 5 |
| R12 | lagt til på begge (ulike id-er) | mangler | `null` | — | — | **opprett** → begge finnes; deretter V19.7-unionen: overlapp i tid → **hele payloaden forslag** (V19.1, `grunn = overlapp`); ikke overlapp → begge beholdes (V19.4) | krav 3d |

**Slettinger** (tombstone `d` med `serverVersjon` kopiert fra raden idet den slettes lokalt):

| # | Situasjon | `s` | `d.serverVersjon` | Utfall | Dekker |
|---|---|---|---|---|---|
| S1 | slettet telefon, uendret PC | finnes | `= s.updatedAt` | **slett** (som i dag) | — |
| S2' | **slettet telefon, endret PC** | finnes | ≠ | **avvik** → forslag `slettet_telefon` (kopi av serverraden), serverraden står, valg: «slett» (forslag) / «behold PC» (sedel) | krav 3b |
| S3 | slettet begge | mangler | — | **no-op** (enige) | — |
| S4 | eldre app (ingen versjon) | finnes | mangler | **avvik** → forslag `slettet_telefon` — trygg retning (PC kan ha endret den). Kostnad til OTA som R10 | krav 5 |

**Hodet (V19.9-H):** H1 uendret/uendret → skriv · H2 endret telefon/uendret PC → skriv · H3 uendret telefon/endret PC
(`hodeVersjon ≠`, `hodeEndretLokalt = false`) → hopp over · H4 endret begge (≠, true, ulikt innhold) → `hodeForslag`,
valg · H5 ≠ men likt innhold → hopp over · H6 eldre app (ingen `hodeVersjon`) → innhold likt → skriv, ulikt → `hodeForslag`
(trygg retning). **`hodeEndretLokalt` er over-approksimert på mobil** (`dagsseddel_local.sistEndretLokalt` bumpes også av
rad-endringer) → H4 kan utløses der kun PC endret hodet og telefonen kun rader; kostnaden er ett valg, ikke tap. Ført i § 9.7.

**Rekkefølge i tx (A-1b):** (1) les sedel + alle serverrader via `tx` · (2) klassifiser alle payload-rader og tombstones
(§ 9.3) · (3) bygg post-state-unionen = serverrader som overlever (hoppede, avvikende, uberørte) ∪ rader som skal skrives
· (4) `finnOverlappMotServer` på unionen — treff → **V19-A som i dag** (hele payloaden forslag, `grunn` pr. rad, ingen
skriving, markør `overlapp`) · (5) ingen overlapp: skriv hodet (V19.9-H: eller hopp/forslag) og «skriv»-radene
(`deleteMany` kun deres id-er + `createMany`), utfør «slett»-tombstones, **og** hvis avvik-settet er ikke-tomt →
`lagreOverlappForslag(tx, sheetId, avvikRader m/ grunn)` i samme tx → markør `overlapp` (svar `conflict/overlapp`,
`serverData.rader` for det som ble skrevet) · ellers markør `ok` med `rader` + `hoppetOver`. **S2-handleren (A-1a) er
uendret** — der har telefonens rader aldri vært på serveren (`v = null`), så versjonssjekken har ingenting å sammenligne;
V19.1/V19.4 gjelder.

### 9.4 Leveranse A' — serveren (db-timer + api)

- **A'-1 Migrering (additiv, `db-timer`):** `SheetTimerForslag.grunn TEXT NOT NULL DEFAULT 'overlapp'` (V19.9.6). V19.9-H i
  egen migrering: `DailySheet.hodeOppdatertAt TIMESTAMPTZ` + `UPDATE … SET hode_oppdatert_at = updated_at` (backfill) +
  `hodeForslag JSONB`.
- **A'-2 Zod i `syncBatch`:** rad får `serverVersjon: z.string().datetime().nullable().optional()` og `endretLokalt:
  z.boolean().optional()`; `slettedeIder` får `timerVersjoner: z.array(z.object({ id, serverVersjon: string|null
  })).optional()` (gammel `timer: string[]` beholdes — eldre app). Sedel får (V19.9-H) `hodeVersjon?`, `hodeEndretLokalt?`.
- **A'-3 Klassifiseringen** som én ren funksjon `klassifiserSyncRader(serverRader, payloadRader, tombstones)` →
  `{ skriv[], hoppOver[], avvik[] (m/ grunn), slett[] }` i `apps/api/src/routes/timer/sync-versjon.ts` (ren, uten Prisma,
  enhetstestet mot § 9.3 rad for rad) — `syncBatch` kaller den inni tx-en (M12) og handler på resultatet. `radInnholdLikt`
  fra shared.
- **A'-4 `lagreOverlappForslag`** får `grunn` pr. rad (default `"overlapp"` for V19-A-kallerne — signaturen er
  bakoverkompatibel). `slettet_telefon`-rader bygges fra serverraden.
- **A'-5 Svar:** `ResultatRad.serverData` får `rader?: { id: string; updatedAt: string }[]` og `hoppetOver?: string[]`
  (begge `ok` og `conflict/overlapp`).
- **A'-6 Pull:** `hentEndringerSiden.timer[]` får `updatedAt` (ISO); V19.9-H: hodet får `hodeOppdatertAt`, `hodeForslag`.
  **Ikke** forslagsrader (M15 består).
- **A'-7 `forsonDagskort`:** `slettinger: z.array(uuid).default([])` — `deleteMany({ sheetId, id in })` i samme tx, før
  overlapp-vakten; `hode?` (V19.9-H). Forslaget slettes + `konfliktVentendeSiden`/`hodeForslag` nulles som i dag (A-5).
- **A'-8 `hentMedId`/`hentForAttestering`:** forslaget bærer `grunn` → attestanten leser «Endret både på PC og telefon» /
  «Slettet på telefonen» / «Slettet på PC» i stedet for alltid «overlapp» (C-2-teksten blir årsaksstyrt).

### 9.5 Leveranse B' — mobilen, og C' — web

- **B'-1 Lokal migrering (idempotent, `migreringer.ts`-mønsteret `:1156-1171`):** `sheet_timer_local.server_versjon TEXT`,
  `slettede_rader_local.server_versjon TEXT`; V19.9-H: `dagsseddel_local.server_hode_versjon TEXT`. **Stille tomhet
  (Kenneths krav 6):** `NULL` betyr «ikke hentet» og er trygg ved konstruksjon — serveren behandler `null` på en rad som
  finnes som *ukjent* (R9/R10, innhold avgjør), og på en rad som mangler som *ny* (R6). Ingen lokal backfill trengs:
  første pull etter oppdateringen fyller alle synkede sedler; sedler som var `pending` (redigert offline FØR
  oppdateringen) beholder `NULL` til sin push → serveren bruker innholdsregelen for dem (aldri stille overskriving),
  og push-`ok` fyller versjonen. **Test (c):** pull-testen feiler hvis en hentet rad har `server_versjon = NULL`;
  server-testen feiler hvis `null` + eksisterende rad + ulikt innhold skrives.
- **B'-2 Pull (M21):** skriv `server_versjon = t.updatedAt` i raderstatningen. **B'-3 Push:** `serverVersjon`,
  `endretLokalt` (V19.9.2), `slettedeIder.timerVersjoner` fra tombstonens kopi; tombstone-innsettingen i
  `TimerSeksjon.tsx:399/:470` kopierer radens `server_versjon`. **B'-4 Push-`ok`:** V19.9.8 (skriv `server_versjon` for
  `rader`, restemple, speil hoppede via `hentMedId`). **B'-4b Forsoning:** speilingen etter `forsonDagskort`
  (`anvendForsonetLokalt`) setter `server_versjon = updatedAt` pr. rad og `sistSynkronisert = naa` på sedelen —
  ellers blir første redigering etter løst konflikt en falsk R10 (gate-funn retur 1). **B'-5 Banner-tekst** generaliseres: «Dagen er også endret på PC. Se begge og
  velg — her eller på PC.» (`timer.sync.overlappKonflikt` → ny nøkkel, i18n ×15). **B'-6 Sammenligningen:** slot-typer
  for `slettet_telefon` («Telefonen: slettet») og `slettet_pc` («PC: slettet»), hode-slot (V19.9-H); `byggForsonInputFraValg`
  gir `slettinger`/`hode`.
- **C'-1 Web (arbeiderens valg, `dashbord/timer/[id]`) og C'-2 attestantens lesing:** samme slot-typer og årsaks-tekster
  via den delte `parForslagMotSedel` — ingen egen logikk på web. **C'-3** Rapport/eksport/PDF: uendret.

### 9.6 Tester som skal FEILE (DoD, i tillegg til § 6)

1. **Kenneths sak:** sedel synket fra telefon, PC endrer raden 15:00→15:30 (`update`), telefonen pusher samme sedel med
   raden uendret (`endretLokalt = false`, gammel versjon) → **i dag:** 15:00 lagret (skal: hopp over, 15:30 står, svar `ok`
   med `hoppetOver = [id]`, `rader` uten id-en) · 2. samme, men telefonen endret raden til 15:15 (`endretLokalt = true`) →
   skal: `sheet_timer` har 15:30, forslag `endret_begge` m/ 15:15, `konfliktVentendeSiden` satt, `conflict/overlapp` ·
   3. R7: PC sletter raden, telefonen endrer den → skal: ingen rad i `sheet_timer`, forslag `slettet_pc` · 3b. R8 → ingen
   rad, intet forslag · 4. S2': PC endrer, telefonen sletter → skal: raden står, forslag `slettet_telefon` (kopi, samme
   id); forsoning med valg «forslag» → `slettinger` sletter den i samme tx som forslaget slettes og feltet nulles ·
   5. R10/S4 eldre app (ingen `serverVersjon`/`endretLokalt`): ulikt innhold → forslag; likt → skriv · 6. **Rader uten
   avvik skrives i samme tx som avvik-forslaget lagres** (Kenneths krav 4) — test feiler hvis en uomstridt ny rad
   mangler i `sheet_timer` etter `conflict/overlapp` · 7. overlapp i tid + versjonsavvik samtidig → hele payloaden
   forslag, `grunn` = `endret_begge` på avvik-raden, `overlapp` på resten, ingen skriving (V19.1 har forrang) ·
   8. `parForslagMotSedel`: `endret_begge` pares på **id** også når tidene ikke overlapper; `slettet_pc` er **valgbar**
   og **opprettes ikke** uten valg (Q3(b)-unntak) · 9. **presisjon:** `updatedAt` fra pull sendt tilbake uendret gir
   «lik versjon» (ISO-ms-rundtur), og en `update` på raden gir «ulik» · 10. **mobil (`timerSync.test.ts`-harnessen):**
   pull setter `server_versjon` på alle hentede rader (feiler ved NULL); push sender `serverVersjon`/`endretLokalt`
   korrekt for (a) hentet-og-urørt, (b) hentet-og-redigert, (c) født lokalt; push-`ok` skriver `server_versjon` for
   `rader`, **ikke** for `hoppetOver`, og restempler kun rader med `sistEndretLokalt <= byggetVed` · 11. tombstone
   bærer radens `server_versjon` (feiler ved NULL for en hentet rad) · 12. invariant-testen (A-3) utvidet med
   `hodeForslag` (V19.9-H) · 13. grep-vakt: `klassifiserSyncRader` er eneste sted som leser `serverVersjon`; ingen
   `createMany` på `sheet_timer` i `syncBatch` uten at id-en kom fra `skriv[]`.

### 9.7 Ordre (anbefaling) og åpne punkter

| Ordre | Innhold | Avhenger av | Migrering |
|---|---|---|---|
| **V19.9-A** | A'-1 (`grunn`), A'-2–A'-8 unntatt hode; `radInnholdLikt` + paring/valg-utvidelsen i shared (A'-3, V19.9.7) | ingen | `db-timer` (`grunn`) |
| **V19.9-B** | B'-1–B'-6 unntatt hode; C'-1/C'-2 slot-typer (web deler shared) | V19.9-A merget (svar-feltene må finnes først — M6-lærdommen) | lokal mobil (2 kolonner) |
| **V19.9-H** | V19.9.9: `hodeOppdatertAt` + `hodeForslag`, server + mobil + web | V19.9-A+B merget | `db-timer` (2 kolonner + backfill) · lokal mobil (1) |

**Server først; mobil+web i én ordre fordi slot-typene bor i shared og begge klienter bare rendrer dem. Hodet sist** —
ikke lønnsbærende, og det er den eneste delen som trenger ny tilstandskolonne på `DailySheet`.

Åpne punkter:
1. **Eldre app til OTA (R10/S4):** hver redigering/sletting av en eksisterende rad fra en app uten V19.9-B blir en konflikt
   (trygg retning). Prod får V19-A og V19.9-A i samme deploy; OTA samtidig → vinduet er kort. Føres i FUNKSJONSENDRINGER.
2. **Edit etter konflikt (arvet fra V19, ikke V19.9):** lokale rader redigert *mens* sedelen står i `conflict` erstattes
   av serverens ved V19.7b-slipp (M8/B-3b). Ikke endret her — eget BACKLOG-punkt om det skal lukkes.
3. **Hode-dirty over-approksimert (H4):** eksakt krever en pulled-kopi av hodet lokalt; valgt bort (ett valg vs. én kolonne
   til). Kan strammes i V19.9-H hvis det viser seg støyende.
4. `sistEndretLokalt`-restempling ved push-`ok` er ny atferd (V19.9.2) — grep alle lesere av `sistEndretLokalt` på rader
   før ordren (`dagsforslagAnvend`, PSI-stempel?) så ingen bruker den som «når redigerte brukeren sist».
