---
name: timer-pause-en-kilde-spec
description: Spesifikasjon for V20 — pausen (matpause) på dagsseddelen får ÉN kilde, radens avkrysning, og hodet «Arbeidstid i dag» blir visning utledet av radene. Måler de tre uenige stedene pausen ligger i dag (radens skjulte fradrag, rad.pauseMin fra GPS, hodet = Σ rad), hva hodet faktisk driver, og gir A/B med anbefaling. Bærer også Kenneths to UI-funn 2026-10-06 som V21 (overtidsforslag ved manuell føring) og V22 (bekreft prosjekt/byggeplass ved direkte opprettelse).
sist_verifisert_mot_kode: 2026-10-06
eier: fabel (plan-eier) — orkestrator gater, Kenneth vedtar A/B
status: 🟢 GATET 2026-10-06 (orkestrator, rev. 2). **Leveranse S IMPLEMENTERT** (`feat/v20-s-pause-server`, server+shared): PK3 Zod+skriving, PK4 to-modi-vakt (interaktiv avvis / synk normaliser), PK5 `pauseVinduForDag`, PK6 `synkroniserHodePause`+invariant, PK8 backfill-migrering `20261006120000`→`20261006220000_v20_pause_backfill`, PK9 forslag fra norm. **M + W gjenstår** (klientene — egne ordrer). Orkestrator-beslutning i gaten: PK4b-3 `SheetTimer.timerAvvik` bygges IKKE (null ville betydd både «ikke vurdert» og «stemmer» — stille tomhet); avvik i synk telles og logges kun (`timer_avvik_sync`). Kenneth-vedtak V20 = B, V21 ja, V22 ja (på raden)
---

# V20 — én kilde for pause, og hodet «Arbeidstid i dag» som visning

> Hjemmel: **Kenneth 2026-10-06:** *«avhukingen skal vise tilstanden også for manuell føring»*; pausen «ble 0 og ga rot» så
> snart avkrysningen ble rørt. Orkestrators måling samme dag (BACKLOG `b48a2e02`). Redesign retter selve feilen i
> `fix/matpause-avkrysning` (ikke pushet 2026-10-06 kveld) — **denne specen bygger på den** og gjør regelen til én.
> Ført som **V20** i [timer-gps-helhetsplan.md](timer-gps-helhetsplan.md) § 4b. **Alt under er spesifikasjon.**

## 0. Hva V20 er, og ikke er

V20 svarer på: **hvor bor pausen, hvem viser den, og hva betyr tallene i «Arbeidstid i dag»?** Den rører ikke norm (V16),
reise (lag 1–2) eller overlapp/versjon (V19/V19.9). Den **stryker V19.9-H** (hode-konflikt) — 🟢 vedtatt med B 2026-10-06, ført i V19.9-specen § 9.2/§ 9.7.

## 1. Målt utgangspunkt (2026-10-06, develop `b48a2e02`)

| # | Fakta | Bevis |
|---|---|---|
| P1 | 🔴 **Radens timetall trekker pause skjult.** Mobil regner ny/redigert rad som `effektiveTimerFraSpenn(fra, til, pauseFra, pauseMin)` der `pauseMin` = **firmaets `standardPauseMin`** (ikke radens), og validerer mot samme (`timer.feil.timerAvvik`). Raden lagres **uten** `pauseMin` → kolonnen får default 0. Kenneths skjermbilde: 07:00–16:00 = 9 t vist som 8,50, avkrysningen «Matpause trukket» tom. *Avklart 2026-10-06: 8,50 var Kenneths egen redigering, ikke en feil — feilen er at fradraget er skjult og avkrysningen ikke viser tilstanden* | `TimerSeksjon.tsx:1043-1048, :1146-1153, :1455`, insert `:214-232`, `schema.ts:154` |
| P2 | `rad.pauseMin` (= avkrysningen, `rad.pauseMin > 0`) settes bare av GPS-dagsforslaget (bæreren = carve-vinduet med klokke-gap) og av selve avkrysningen (`skrivPauseTilstand`: setter rad-pauseMin, regner timer på nytt, setter hodet = Σ rad) | `dagsforslag.ts:787-799`, `matpause.ts:133-175`, `TimerSeksjon.tsx:747` |
| P3 | **Web regner fra hodet:** `beregningsPauseMin = sheet.pauseMin` i rad-dialogen; radene web skriver har **aldri** `pauseMin` (`tilfoyTimerRad`/`oppdaterTimerRad` Zod har ikke feltet) → server-default 0. En web-rad 07–15 med 7,5 t vises på mobil som «ikke trukket», mens 30 min faktisk er trukket | `page.tsx:1694-1699`, `dagsseddel.ts:1145-1190` |
| P4 | **Hodet skrives fire steder:** web-dialog «Rediger» (`startAt/endAt/pauseMin`), mobil `StartSluttDagKort` (stempling, `pauseMin: tider.pauseMin`), `dagsforslagAnvend` (`pauseMin: d.pauseMin`), API `opprett` (prefyll fra `hentEffektivArbeidstid` når start/slutt mangler) og `syncBatch` (payload). Mobil holder invarianten `hodet.pauseMin = Σ rad.pauseMin` kun i matpause-veien | `page.tsx:3731-3766`, `StartSluttDagKort.tsx:561`, `dagsforslagAnvend.ts:71`, `dagsseddel.ts:1524-1529`, `matpause.ts:165-168` |
| P5 | **Hva hodet faktisk driver:** (a) `opprettForsteTimerRadForslag` — første auto-rad = `(endAt−startAt) − pauseMin/60` med standard-lønnsart · (b) web-defaults for ny rad (`effektivStart/Slutt` fra `sheet.startAt/endAt`) · (c) **maskin-bucket-taket** `validerMaskinUnderArbeid(…, sheet.pauseMin)` / `maskinBucketKapasitet` (server + web + mobil) · (d) `sluttTidKilde` = glemt-dag-/midnatt-merket. **Ikke:** lønn (rad.timer), overtid (`beregnOvertidsgrunnlag`: rad.timer + `overtidsnivaa` + norm — pause-fri), norm (`arbeidstid.ts`: firma-setting/kalender, aldri sedelen), eksport/PDF (0 treff `pauseMin` i `rapport.ts` og `packages/pdf`). **UI-teksten «Brukes for å beregne overtid» er usann** | `dagsseddel.ts:1085-1120, :1762, :5700`, `page.tsx:384-391, :1094, :1240`, `overtidsgrunnlag.ts:56-70`, `arbeidstid.ts:60-135` |
| P6 | Pausevinduet for **manuelle** rader = `hentArbeidsdagTiderLokalt().startTid + pauseEtterTimer` (= V6 `fastStart`) **uansett** firmaets `pauseReferanse`; GPS-forslaget respekterer `ankomst` | `TimerSeksjon.tsx:1053-1060`, `dagsforslag.ts:757` |
| P7 | 5,5-timersregelen (AML § 10-9): `pauseMinForDag(brutto, standard)` → pause bare når dagsbrutto > 5,5 t; avkrysningen vises bare når regelen trigger OG raden krysser vinduet | `pauseBeregning.ts:42-47`, `matpause.ts:80-84`, `TimerSeksjon.tsx:743-746` |
| P8 | Alle formlene er alt delt i `@sitedoc/shared`: `effektiveTimerFraSpenn`, `pauseOverlappMin`, `pauseVinduFra`, `tilFraAntall`, `pauseMinForDag` — det som mangler er **én bestemmelse av hvilken `pauseMin` som sendes inn** | `packages/shared/src/utils/pauseBeregning.ts` |

🔴 **P1 + P3 er rotet Kenneth så:** tre regnestykker med tre ulike `pauseMin` (firma-default, hodet, raden) på to klienter,
og en avkrysning som bare speiler det tredje.

## 2. A/B — 🟢 VEDTATT B (Kenneth 2026-10-06, ordrett: *«B -> pausen utledes etter gjeldende regler "4" timer"»*)

**Presisering i vedtaket:** pausen utledes etter **gjeldende firmaregler** — «Pause starter etter (timer)» (`standardPauseEtterTimer`, i dag 4), `standardPauseMin` og 5,5-timersterskelen. Ingen nye tall. Hva «4 timer» måles fra, står i PK5.

| | **A — hodet eier pausen** | **B — radene eier pausen, hodet er visning** (anbefalt) |
|---|---|---|
| Kilde | `DailySheet.pauseMin` (web-dialog + stempling) | `SheetTimer.pauseMin` på **bæreren** (én rad pr. dag); avkrysningen ER kilden |
| Avkrysning | Må utledes: «denne raden krysser vinduet» — ikke en tilstand, bare en visning | Tilstand: huket = raden bærer pausen, timetallet er trukket (Kenneths krav ordrett) |
| Web/mobil likt | Krever at mobil slutter å bruke rad-pause og firma-default → GPS-bærer-modellen (F5) rives | Krever at web får avkrysningen og sender `pauseMin` på raden (Zod + dialog) — additivt |
| Hodet | Fortsatt input (fire skrivere) | `pauseMin` utledes (Σ rad) server-side; `startAt/endAt` beholdes som **ramme** (stempel/prefyll), visningen viser radene |
| V19.9-H | Må bygges (hode-konflikt PC↔mobil) | **Strykes**: det eneste hodefeltet med lønnsrelevans er borte; `startAt/endAt` er prefyll, sist skrevet vinner er akseptabelt |
| Risiko | Mister per-rad-bærer → maskin-bucket-taket (P5c) og flerprosjekt-dager (hvilket prosjekt tar pausen?) mister presisjon | Backfill av web-rader (P3) må plassere bæreren riktig — styres av timetall-formelen (§ 4 PK8) |

**Vedtatt: B.** Begrunnelsen som lå til grunn: lønn og overtid leser allerede radene, ikke hodet (P5); radene er det eneste nivået
der «hvilket prosjekt bar pausen» finnes; og Kenneths krav er en *tilstand* pr. rad, som bare B kan vise ærlig.

## 3. Reglene

| # | Regel | Lukker |
|---|---|---|
| **PK1** | 🔴 **Én formel, radens egen pause:** `rad.timer = effektiveTimerFraSpenn(fra, til, pauseFra, rad.pauseMin)`. `rad.pauseMin = 0` → fullt spenn, ingenting skjult; `rad.pauseMin = firmaets standardPauseMin` → bæreren. Mobil, web og server bruker samme delte kall med **radens** verdi — aldri firma-default, aldri hodet | P1, P3 |
| **PK2** | **Bæreren tildeles automatisk, synlig:** ny manuell rad (mobil OG web) får `pauseMin = standardPauseMin` **hvis** regelen trigger (dagsbrutto inkl. den nye raden > 5,5 t), raden krysser pausevinduet, og ingen annen rad alt bærer — ellers 0. Avkrysningen viser tilstanden og kan flyttes (`flyttMatpauseVedAvhuking`, kun-én-pr.-dag består). Dette er `fix/matpause-avkrysning` gjort til regel | Kenneth-vedtak |
| **PK3** | **Web får avkrysningen** i rad-dialogen (samme regel som mobil, samme tekst «Matpause trukket (30 min)»), og `tilfoyTimerRad`/`oppdaterTimerRad`/`redigerSedelRader` får `pauseMin: z.number().int().min(0).optional()` → skrives på raden. `forsonDagskort.oppdateringer/nyeRader` likeså | P3 |
| **PK4** | 🔴 **Server-vakt på timetallet — to modi (rev. 2 etter gate-AVVIK):** gjelder rader med `fraTid`+`tilTid` på en **timebasert** lønnsart (`satsEnhet` ∈ {`per_time`, null}; `per_km`/`per_dag`/`per_natt` og andre sats-arter vurderes aldri mot spennet — en km-rad med tider er km, ikke timer). Forventet = `effektiveTimerFraSpenn(fra, til, pauseFra, rad.pauseMin)`, `pauseFra` fra PK5, toleranse 0,01. **(a) Interaktive skrivere** (`tilfoyTimerRad`, `oppdaterTimerRad`, `redigerSedelRader`, `forsonDagskort`): avvik → **avvis** med `timer.feil.timerAvvik` — en bruker står og ser feilen. **(b) `syncBatch`: aldri avvisning, normalisering.** Rekkefølge pr. rad: (1) stemmer `timer` med formelen gitt `rad.pauseMin` → skriv · (2) `rad.pauseMin = 0` (eller mangler) og `timer` stemmer med formelen gitt `standardPauseMin` → **sett raden som bærer** (`pauseMin = standardPauseMin`) hvis ingen annen rad på dagen alt bærer, ellers skriv som den er og tell — det er PK8s bevis anvendt i sanntid, og det er veien alle eksisterende manuelle mobilrader (P1) og eldre apper tar inn · (3) stemmer med ingen → **godta som før** (status quo), `tell + logg` (`timer_avvik_sync`), og sett `SheetTimer.timerAvvik = true` (ny nullable boolean, additiv; attestanten ser «Timer stemmer ikke med fra–til» på raden, samme mønster som `reiseAvvik` fra lag 2). **Reiserader (V8):** vinduet bygges som `start + kjøretid` / `slutt − kjøretid` og `timer = round(kjøretid/60, 2)` (`dagsforslag.ts:828-846`) → spennet er eksakt kjøretiden, `pauseMin = 0` → formelen gir samme tall; målt: ingen unntak trengs, men test 14 i § 5 vokter det | P1, gate 2026-10-06 |
| **PK5** | **Pausevinduet følger V6 overalt:** én delt `pauseVinduForDag(rader, effektiv)` i shared: `pauseReferanse = "fastStart"` → `effektiv.startTid + pauseEtterTimer`; `"ankomst"` → første rad-`fraTid` på dagen + `pauseEtterTimer`. Mobil manuell rad, web og server bruker den (i dag bruker manuell rad alltid fastStart, P6). **Kenneths «4 timer» betyr dermed:** *4 timer etter ankomst* når firmaet står på «Ankomst» (Kenneths firma gjør det), *4 timer etter fast start* ellers. **Målt mot innstillingsteksten:** hjelpeteksten til «Pause starter etter (timer)» sier *«Hvor mange timer inn i skiftet pausen starter. F.eks. 4 t → 07:00-start gir pause 11:00»* (`nb.json:1854`) — den beskriver bare fast start; «Pausen starter fra»-hjelpen (`nb.json:1870`) sier riktig at «Ankomst» regner fra når arbeidet begynner. Koden: GPS-forslaget følger `pauseReferanse` (`dagsforslag.ts:757`), manuell rad gjør det **ikke** (`TimerSeksjon.tsx:1053-1060`). V20-W retter hjelpeteksten («… etter ankomst eller fast start, avhengig av «Pausen starter fra»»), V20-M retter manuell rad | P6, V6, Kenneth-presisering |
| **PK6** | **Hodet `pauseMin` = Σ rad.pauseMin, utledet server-side** etter hver radskriving (én helper `synkroniserHodePause(tx, sheetId)` i samme tx) og speilet til mobil ved pull. **Ingen klient skriver det direkte**: web-dialogen mister pause-feltet; `syncBatch` ignorerer payloadens `hodet.pauseMin` (bakoverkompatibelt: eldre app sender det, serveren regner selv). Maskin-bucket-taket (P5c) leser videre `sheet.pauseMin` — nå alltid lik Σ rad. **Invariant-test (stille tomhet c):** `hodet.pauseMin ≠ Σ rad.pauseMin` etter noen mutasjon → FEIL | P4, P5c |
| **PK7** | **«Arbeidstid i dag» blir visning:** med rader med tid viser den `første fraTid – siste tilTid · Σ pause · netto Σ timer`, utledet av radene (delt `utledArbeidstidFraRader`), og teksten «Forhåndsutfylt fra firmaets standardtider — … » erstattes med «Utledet av radene under». Uten rader viser den **rammen** (`startAt/endAt` fra stempling/norm) som prefyll-hint. «Brukes for å beregne overtid» fjernes (usann). `startAt/endAt` beholdes som ramme (stempel + `opprettForsteTimerRadForslag` + web-defaults) og `sluttTidKilde` som glemt-dag-merke — begge uendret | P5 |
| **PK8** | 🔴 **Backfill (stille tomhet a):** for hver sedel med `hodet.pauseMin > 0 ∧ Σ rad.pauseMin = 0` (web-rader + mobile manuelle rader med skjult fradrag): velg bæreren som den raden med tid der `|rad.timer − effektiveTimerFraSpenn(fra, til, pauseFra, hodet.pauseMin)| ≤ 0,01` (timetallet beviser at fradraget alt ligger der); finnes flere, den som krysser vinduet; finnes ingen → **ikke rør**, tell og logg (`pause_backfill_uavklart`). Lønnstall endres ikke av backfillen (timer står). **Mål antall på test før ordren:** sedler totalt / med hodet>0 / Σ=0 / uavklart | P1, P3 |
| **PK9** | **Forslag til nye rader:** `opprettForsteTimerRadForslag` (P5a) bruker rammen `startAt/endAt` som i dag, men pausen fra `hentEffektivArbeidstid(org, dato).pauseMin` (norm, V16) og **skriver den på raden** som bærer når regelen trigger — ikke `hodet.pauseMin`. Web/mobil prefyll av ny rad: fra siste `tilTid` (M6) eller rammen, som i dag | P5a |
| **PK10** | **Splitt bevarer bæreren (ført etter V20-S retur 1, 2026-10-07):** når en rad deles (`splittRad`/`splittRadEier`) flyttes originalens `pauseMin` til delraden som krysser pausevinduet (størst overlapp; uavgjort/ingen → første); Σ `pauseMin` er bevart og `timer` urørt; hodet synkroniseres (PK6) i samme tx. Delt `fordelPauseVedSplitt`. Mobilens «lengste-først»-fordeling gjelder GPS-forslagsgenerering, en annen operasjon | kontrollør-funn V20-S |

## 4. Leveranser

- **S (server, `db-timer` + api):** PK3 Zod + skriving · PK4 vakt (én helper, alle radskrivere) · PK5/PK7-utledning i shared ·
  PK6 `synkroniserHodePause` + invariant-test · PK8 backfill-migrering (SQL m/ `pauseFra` pr. firma: `standardStartTid +
  standardPauseEtterTimer`, fastStart-tilnærming er godt nok for backfill — ankomst-firmaer telles som uavklart) · PK9.
  `hentEndringerSiden`/`hentMedId` uendret i form (feltene finnes).
- **M (mobil):** PK1 (send `rad.pauseMin` inn i formelen — ikke `standardPauseMin`), PK2 auto-bærer ved manuell rad (= `fix/
  matpause-avkrysning`), PK5 pausevindu via shared, PK7 visning, hodet `pauseMin` leses fra server (skrives ikke lokalt
  utover Σ-speil). Lokal migrering: ingen (kolonnene finnes). **OTA.**
- **W (web):** PK3 avkrysning i `TimerRadDialog` + `pauseMin` i mutasjonene, PK1 formel med radens pause, PK7 visning,
  pause-felt ut av «Rediger»-dialogen (start/slutt beholdes), tekst-fiks. i18n ×15 for nye/endrede nøkler.

## 5. Tester som skal FEILE (DoD)

1. **Kenneths sak:** manuell rad 07:00–16:00 på mobil → `timer = 8,50` men `rad.pauseMin = 0` og avkrysning tom (skal: `pauseMin = 30`, huket, 8,50 — eller `pauseMin = 0` og 9,00; aldri 8,50 uhuket) · 2. web-rad 07–15 → `rad.pauseMin = 0` på server mens timetallet er 7,5 (skal: 30, PK3) · 3. server tar imot `timer` som ikke stemmer med spenn − overlapp(rad.pauseMin) (PK4, alle fem skrivere) · 4. `hodet.pauseMin ≠ Σ rad.pauseMin` etter tilfoy/oppdater/slett/syncBatch/forson (PK6) · 5. web «Rediger» sender `pauseMin` (skal: feltet finnes ikke) · 6. manuell rad på firma med `pauseReferanse = "ankomst"` bruker fastStart-vindu (PK5) · 7. to rader bærer pause samme dag (kun-én består) · 8. backfill endrer `rad.timer` på noen rad (skal: aldri) · 9. backfill setter bærer på en rad der timetallet ikke beviser fradraget (skal: uavklart, telt) · 10. «Arbeidstid i dag» viser rammen når rader med tid finnes (skal: utledet) · 11. `opprettForsteTimerRadForslag` leser `hodet.pauseMin` (skal: norm) · 12. grep-vakt: `effektiveTimerFraSpenn(` kalles med `standardPauseMin`/`sheet.pauseMin` som fjerde argument noe sted i klient- eller radskriver-kode (skal: kun `rad.pauseMin`) · **13. (gate a)** mobilrad med skjult fradrag (`pauseMin = 0`, `timer = spenn − 0,5`) synket → avvist eller skrevet uendret (skal: skrevet som **bærer**, `pauseMin = 30`, `timer` urørt, svar `ok`) · **14. (gate b)** rad på `per_km`-lønnsart med `fraTid/tilTid` og `timer = 60` → vurdert mot spennet (skal: ikke vurdert); reiserad V8 (`tidKilde = utledet`, vindu = kjøretid) → avvik (skal: stemmer, ingen normalisering) · **15. (gate c)** `oppdaterTimerRad` på web med `timer` ≠ formelen → skrevet (skal: avvist) · **16.** `syncBatch` med rad som stemmer med ingen av formlene → avvist (skal: skrevet, `timerAvvik = true`, telt) · **17.** `syncBatch` normaliserer til bærer når en annen rad alt bærer (skal: ikke to bærere — skriv uendret og tell).

## 6. Ordre (anbefaling)

| Ordre | Innhold | Avhenger av |
|---|---|---|
| **V20-S** | Leveranse S inkl. backfill (telling på test først) | `fix/matpause-avkrysning` merget (PK2 bygger på den) · Kenneth A/B |
| **V20-M ∥ V20-W** | Leveranse M og W | V20-S merget (Zod/vakt må finnes før klientene sender `pauseMin`) |

Server først. Backfill-tellingen leveres som egen melding før migreringen skrives.

## 7. Åpne punkter

1. ~~A/B~~ — 🟢 **B vedtatt 2026-10-06.**
2. **Flerprosjekt-dag og bæreren:** når pausen krysser et prosjektbytte (12:00 bytte, pause 11:30–12:00) bærer raden som
   dekker vinduet; krysser vinduet selve byttet, bærer **første** rad. Vedtak ønskes (lønn pr. prosjekt påvirkes ikke, bare
   hvilket prosjekt som «mister» 30 min).
3. ~~V19.9-H strykes~~ — 🟢 **strøket 2026-10-06** (planen + V19.9-specen § 9.2/§ 9.7 oppdatert i samme commit).
4. **Backfill-telling** på test før V20-S skrives (PK8).
5. **`SheetTimer.timerAvvik`** (PK4b-3) — ny nullable kolonne, additiv, ingen backfill (null = «ikke vurdert»/«stemmer»); test (c) = test 16. Gate om den er «billig nok» — alternativet er kun logg.

## 8. Kenneths to UI-funn 2026-10-06 → V21 og V22 — 🟢 VEDTATT (*«V21 ja, V22 ja -> vis registrert prosjekt og byggeplass på raden med små skrift»*). Egne små ordrer etter V20

**V21 — overtidsforslag ved manuell føring** (*«ved timer over normal dag → ingen overtidsforslag i timeføringen → en ny
linje etter at en passerer firmaets norm»*). Målt: GPS-dagsforslaget splitter normaltid/overtid strukturert
(`velgOvertidLonnsart` på `overtidsnivaa`, `dagsforslag.ts:740-770`); **manuell rad på mobil og web gjør det ikke** — eneste
signal er den gule summeringen «8,50 t av 7,50 t». Forslag: når en manuell rads `tilTid` (eller dagens Σ) passerer
dagsnormen (`hentEffektivArbeidstid`, V16), viser rad-dialogen én linje under raden: *«1,00 t over dagsnorm — del i
Timelønn 07:00–15:30 + Overtid 50 % 15:30–16:00?»* med én knapp. Deling via `klassifiserArbeidstid` + `velgOvertidLonnsart`
(samme regler som GPS: V1 reise aldri overtid, V4 kronologisk, siste prosjekt bærer). Delt helper `foreslaOvertidSplitt
(rader, norm, lonnsarter)` i shared; mobil og web rendrer. Ingen auto-skriving — forslag, ett trykk. Finnes ingen
overtid-lønnsart (`overtidsnivaa` null overalt) → ingen linje. **Lukker:** manuell føring står i dag uten overtidsvei;
bare GPS-brukere får splitt. 🟢 **Vedtatt ja.**

**V22 — prosjekt og byggeplass på RADEN med liten skrift (web-paritet)** (*«ingen informasjon/bekreftelse i registreringen at rett
prosjekt/byggeplass er valgt»*). Målt: web bærer `?nyttProsjekt=` kun for å forhåndsåpne gruppa (`page.tsx:156, :239`);
sedelens `byggeplassId` **rendres ikke** på web (0 treff utenom radtyper); mobil viser kortet «SD-… — prosjekt · Velg
byggeplass» + notisen `timer.dagFinnes.notis`. 🟢 **Kenneth: ikke i «Detaljer» — på raden, liten skrift.** **Målt mobil:** sekundærlinja «Prosjekt · Byggeplass»
under hver rad finnes alt (`ByggeplassLinjeTekst`, `TimerSeksjon.tsx:934-962`, grå ~12 px): prosjekt = `rad.projectId ??
gruppens`, byggeplass = **`rad.byggeplassId ?? sedelens`** — arvet fra sedelen vises nedtonet med «(fra dagskortet)»,
mangler begge: «Ingen byggeplass valgt». Hele linja er trykkflate til prosjekt+byggeplass-velgeren (F3). **Web
(`RaderTimer`, `page.tsx:1356-1420`)** viser lønnsart, aktivitet og fra–til — **ikke** prosjekt (det står bare som
gruppeoverskrift) og **ikke** byggeplass. **V22 = paritet på web:** samme sekundærlinje under raden (`text-xs
text-gray-500`): «Prosjekt · Byggeplass», byggeplass fra `rad.byggeplassId ?? sheet.byggeplassId` med samme
arvet-markering, klikk åpner rad-dialogen med byggeplass-feltet; har prosjektet nøyaktig én byggeplass utledes den
ved ny rad (ett-klikk-prinsippet) på begge klienter. Ingen ny tilstand. **Lukker:** arbeideren ser hvor timene havner
før «Send til leder», også på PC.
