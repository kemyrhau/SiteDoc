---
name: timer-overlapp-pc-mobil-spec
description: Spesifikasjon for V19 — når en dagsseddel registrert på PC og en registrert på mobil for samme dag overlapper i tid, varsles arbeideren og velger selv hvilken versjon som vinner, pr. tidsrom eller for hele dagen. Ingen stille sammenslåing, ingen avvist synk, ingen flagg-til-attestant som eneste løsning. Kenneth-vedtak 2026-10-04. Skrevet av fabel, gates av orkestrator.
sist_verifisert_mot_kode: 2026-10-04
eier: fabel (kontroll-Claude) — orkestrator gater
status: ⚠️ UTKAST TIL GATE — ingen kode-ordre før orkestrator har gatet
---

# V19 — overlapp PC ↔ mobil på samme dag: arbeideren velger

> Hjemmel: **Kenneth 2026-10-04, ordrett:** *«ingen av delene. den ansatte skal varsles → kunne lese begge og velge
> selv hvem som vinner»* — avviste (a) flagg til attestanten og lagre begge, (b) avvis synken, (c) dagens stille
> sammenslåing. Målt grunnlag: orkestrator 2026-10-04 (BACKLOG `1779dce8`) + fabels måling under. Ført som **V19**
> og **H25** i [timer-gps-helhetsplan.md](timer-gps-helhetsplan.md). **Alt under er spesifikasjon** — ❌ IKKE
> IMPLEMENTERT inntil ordren er merget.

## 0. Hva V19 er, og ikke er

**V19 svarer på ett spørsmål: hva skjer når to registreringer av samme dag overlapper i klokketid.** Den bygger på to
flater som finnes: sammenligningsvisningen (steg 1, `e4866f8d`) og den atomiske `forsonDagskort` (steg 2, `9c7c1ad1`).
Den endrer **ikke** reise, norm eller spor (lag 1–2), og **ikke** lederens retur-vei.

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
| M10 | Delt overlapp-regel finnes: `finnTidsromKonflikt(rader)` (sett) og `finnOverlappendeTidsrom(fra, til, andre)` (én mot mange), streng (`aF < bT && aT > bF`), hopper over tid-løse rader | `tidsromValidering.ts:39-100` |

🔴 **M3 + M4 sammen er hullet:** S2 ble bygget for å *ikke miste* mobilens rader ved dato-kollisjon — og lyktes — men
sammenslåingen er blind for tid. Vedtaket snur ikke S2; det setter en port foran den.

## 2. Vedtaket som regler

| # | Regel | Lukker |
|---|---|---|
| **V19.1** | 🔴 **Overlapp i tid mellom mobilens rader og serverens rader på samme sedel → ingen additiv sammenslåing.** Serveren skriver ingenting, svarer `conflict` med `aarsak: "overlapp"` og server-sedelens identitet. Mobilen setter `syncStatus = "conflict"` (ikke `pending`), beholder radene lokalt og **varsler arbeideren** | M3, M4 |
| **V19.2** | **Mens valget venter:** serveren er urørt (web-radene står som de var), mobilens rader ligger lokalt beskyttet av dagens `conflict`-vakt (M8). **Ingenting går tapt, ingenting blir dobbelt.** Pull oppdaterer kun hodet, som i dag | M8 |
| **V19.3** | **Valget:** arbeideren ser begge versjonene pr. tidsrom i sammenligningsvisningen (M6) og velger **pr. tidsrom** (radio) **eller for hele dagen** (to knapper «Behold appen for hele dagen» / «Behold web for hele dagen» som setter alle radioene — UI-snarvei, samme skrivevei). Valget skrives **atomisk** med `forsonDagskort` (M7). Rader som bare finnes på én side og ikke overlapper noe, beholdes alltid (de er ikke en konflikt) | M6, M7 |
| **V19.4** | ⚠️ **Rader som IKKE overlapper slås fortsatt sammen additivt som i dag** (S2 består for dem). Vedtaket gjelder overlapp. **Orkestrators tolkning — Kenneth må bekrefte** | — |
| **V19.5** | 🔴 **Konflikten er synlig for attestanten, men den avgjør ikke.** Serveren setter `DailySheet.konfliktVentendeSiden` (tidsstempel) når den svarer `conflict` med `aarsak: "overlapp"`; attesteringen viser «Arbeideren har en uavklart overlapp fra mobil (siden dd.mm) — N rader venter på telefonen» og **blokkerer attestering** til feltet er nullet (av `forsonDagskort`, eller av at mobilen pusher uten overlapp etter at arbeideren rettet lokalt). Dette er ikke (a) «flagg og lagre begge» — ingenting lagres dobbelt, og attestanten velger ikke. Det hindrer at halve dagen attesteres som hele | M9 |
| **V19.6** | **Når valget aldri tas:** lederen ser blokkeringen (V19.5) og har dagens utvei — **returnere sedelen** — som når telefonen via hodet (M8) og tvinger arbeideren til å handle. Etter `OVERLAPP_PURRING_DAGER = 3` får arbeideren push-varsel «Du har en dagsseddel med uavklart overlapp». Ingen automatisk avgjørelse, aldri | M8 |
| **V19.7** | 🔴 **Én delt regel:** overlapp avgjøres av `finnTidsromKonflikt([...serverRaderSomOverlever, ...payload])` — den eksisterende funksjonen på unionen, ingen ny kopi. Tid-løse rader (reise før V8) hoppes over som i dag | M10 |
| **V19.8** | **Offline:** sammenligningen trenger web-radene (M6) → uten nett viser skjermen «Konflikt — åpne med nett for å velge», radene står trygt lokalt. Ingen avgjørelse offline | M6 |

## 3. Leveranse A — serveren (api)

- **A-1 Vakten på unionen (V19.7):** i `syncBatch`, grenen for eksisterende sedel (etter S2-omnøkling), FØR
  `deleteMany/createMany`: hent serverens timer-rader som **ikke** har id i payloaden (de som overlever), og kjør
  `finnTidsromKonflikt([...overlevende, ...lokal.timer])`. Treff → `resultater.push({ clientUuid, resultat: "conflict",
  aarsak: "overlapp", serverData: { id, clientUuid, status, … }, overlapp: { fraTid, tilTid } })`, `continue` — **ingen
  skriving**. Ikke treff → som i dag (V19.4). Ny-sedel-grenen er uendret (ingen server-rader å overlappe).
- **A-2 `aarsak`-feltet** på `conflict`-resultatet: `"laast" | "nyere" | "dato_kollisjon" | "overlapp"` — i dag skilles
  grenene kun på `serverData.clientUuid !== clientUuid` (M3). Eksplisitt årsak gjør at mobilen aldri igjen må gjette fra
  identitet. Zod på klienten: ukjent årsak → behandles som `"laast"` (konservativt, ingen auto-merge).
- **A-3 `DailySheet.konfliktVentendeSiden DateTime?`** (additiv migrering i `db-timer`): settes i A-1 ved overlapp,
  **nulles** av `forsonDagskort` (atomisk i samme transaksjon) og av en vellykket push uten overlapp på samme sedel.
  CHECK ikke mulig (tilstand, ikke identitet); **test som FEILER** når `forsonDagskort` lykkes uten å nulle feltet.
- **A-4 `hentTilAttesteringFirma`/`hentForAttestering`** returnerer feltet; `attesterRader`/`attester` **avviser** med
  `PRECONDITION_FAILED «Arbeideren har en uavklart overlapp — avvent eller returner sedelen»` når det er satt (V19.5).
- **A-5 `forsonDagskort`** utvides ikke i form (M7 holder: in-place + nye), men får **én ny vakt**: resultatet etter
  anvendelse kjøres gjennom `finnTidsromKonflikt` — forsoningen skal aldri kunne etterlate en overlapp (V19.3 «pr. dag»
  er bare mange radio-valg, så dette er den eneste måten to valgte sider kan kollidere på: aldri, men vakten står).
- **A-6 Purring (V19.6):** daglig jobb (eksisterende cron-mønster for 12 t auto-utsjekk, `mannskap.ts:43-53`) som sender
  push-varsel til arbeideren for sedler med `konfliktVentendeSiden < now − OVERLAPP_PURRING_DAGER`. Én gang pr. døgn pr.
  sedel. Konstant i `rad-tak.ts`-stil.

## 4. Leveranse B — mobilen

- **B-1 `timerSync.ts` M3-grenen** brancher på `aarsak`: `"overlapp"` → `syncStatus = "conflict"`, `feilmelding =
  t("timer.sync.overlappKonflikt")`, teller `konflikt++` (ikke `merged`), **ingen omnøkling før valget** — identiteten
  følger med i `serverData.clientUuid` og brukes av forsoningen; `"dato_kollisjon"` uten overlapp → som i dag (V19.4).
- **B-2 Varsling (V19.1):** statusbaren viser konflikt (som server-wins gjør i dag), sedelen får banner «Dagen er også
  registrert på PC, og tidene overlapper. Se begge og velg.» med knapp til sammenligningen. Lokalt push-varsel når
  synken setter tilstanden (arbeideren er ikke nødvendigvis i appen).
- **B-3 Sammenligningen (V19.3):** `DagskortSammenligning` får de to «hele dagen»-knappene (setter `valg` for alle
  tidsrom); `onBekreft` → `forsonDagskort` som i dag; svaret speiles til lokal, `syncStatus = "synced"`, omnøkling til
  server-identiteten skjer **her** (etter valget), ikke i synken. Tidsrom som bare finnes på én side vises som i dag
  («ingen registrering» på den andre) og er ikke valgbare (Q3(b)-invarianten består — ingen `fjern`).
- **B-4 Offline (V19.8):** `erKonflikt && !erPaaNettet` → tekst, ingen valg-affordance; radene beholdes.
- **B-5 Modus C:** overlapp mot en **låst** web-sedel (`sent`/`accepted`) → `forsonDagskort` avviser (M7) → visningen
  er lesevisning + «be leder returnere» som i dag. V19 endrer ikke det.

## 5. Leveranse C — attestering (web)

- **C-1** Banner på sedel-kort og detalj når `konfliktVentendeSiden` er satt (V19.5), attester-knappen deaktivert med
  tooltip som sier hvorfor og hva lederen kan gjøre (returnere). i18n ×15.
- **C-2** Rapport/eksport: ingen endring — overlapp-tilstanden er pre-attestering.

## 6. Tester som skal FEILE (DoD)

1. PC 07–15 + mobil 07–15 → serveren skriver mobilens rader (skal: `conflict/overlapp`, 0 rader skrevet) ·
2. PC 07–11 + mobil 12–15 (ingen overlapp) → `conflict` (skal: additiv merge som i dag, V19.4) ·
3. Overlapp-vakten bruker en annen funksjon enn `finnTidsromKonflikt` (grep-vakt) ·
4. `forsonDagskort` lykkes uten å nulle `konfliktVentendeSiden` ·
5. Attestering lykkes mens `konfliktVentendeSiden` er satt ·
6. Mobil setter `pending`/omnøkler ved `aarsak: "overlapp"` (skal: `conflict`, rader urørt) ·
7. Pull erstatter lokale rader på en `conflict`-sedel (M8 består) ·
8. Ukjent `aarsak` fra server → auto-merge (skal: behandles som låst).

**Fasit-scenario (ende-til-ende, sql.js + mocket router):** Dag med web-rader 07:00–15:00 (7,5 t) og mobil 07:00–15:30
(8 t): push → conflict/overlapp → banner → arbeideren velger «appen» for hele dagen → `forsonDagskort` erstatter
web-raden in-place → serveren har 8 t, ikke 15,5; `konfliktVentendeSiden` null; attestering mulig.

## 7. Ordre (anbefaling)

| Ordre | Innhold | Avhenger av | Migrering |
|---|---|---|---|
| **V19-A** | Leveranse A (api): vakt på unionen, `aarsak`, `konfliktVentendeSiden`, attester-vakt, forson-vakt, purring | ingen | `db-timer` additiv (Kenneth-gatet) |
| **V19-B** | Leveranse B (mobil) + C (web attestering) | V19-A merget (`aarsak` må finnes i svaret før mobilen brancher på det — M6-lærdommen) | — |

## 8. Åpne punkter for gaten / Kenneth

1. 🔴 **V19.4 (Kenneth):** skal ikke-overlappende rader fortsatt slås sammen additivt? Orkestrators og min tolkning: ja.
2. **V19.5 (Kenneth):** blokkering av attestering mens konflikten venter — eller bare synlig varsel? Jeg anbefaler
   blokkering: alternativet er at halve dagen attesteres og lønn kjøres på den.
3. **`OVERLAPP_PURRING_DAGER = 3`** — tall valgt av fabel, navngitt konstant.
4. **A-2 `aarsak`** endrer `syncBatch`-kontrakten additivt; eldre app ignorerer feltet og faller til dagens oppførsel
   (omnøkling + pending) — **men da treffer A-1 igjen på neste push og svarer overlapp på nytt**: eldre app loop-er
   til den oppdateres. Akseptabelt (ingen skriving skjer), men bør stå i FUNKSJONSENDRINGER ved merge.
