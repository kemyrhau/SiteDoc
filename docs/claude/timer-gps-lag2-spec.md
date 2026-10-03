---
name: timer-gps-lag2-spec
description: Spesifikasjon for LAG 2 i timer-GPS-helhetsplanen — sporbarhet. Det som avgjør lønn (reise-etappe, avstand, regel, norm, tidskilde) følger raden fra telefon til server til eksport, uten at serveren regner om (K5 «mottak med sporbarhet»). Skrevet av fabel 2026-10-03, gates av orkestrator.
sist_verifisert_mot_kode: 2026-10-03
eier: fabel (kontroll-Claude) — orkestrator gater
status: 🟢 GATET 2026-10-03 (orkestrator) med to presiseringer — ført samme dag (backfill-rapport, reiseAvvik dobbel terskel). Ordrer kan skrives på Kenneths signal
---

# LAG 2 — sporbarhet: det som avgjør lønn skal kunne etterprøves

> 🟢 **L2-A LEVERT (branch `feat/timer-l2a-sporbarhet`, 2026-10-03 — venter gate/merge):** Leveranse A
> (db-timer-migrering `20261003120000_timer_lag2_sporbarhet` + shared-typer + `erReiseLonnsart`-regel) og
> Leveranse C (C1–C5: syncBatch-mottak, C2-invarianter, C3 `reiseAvvik`, V1/V2 i `beregnOvertidsgrunnlag`,
> `reisetidTellerOvertid`-deprecation) er bygget. **Avvik fra § 2 ført:** `erReise=true ⇒ reiseRetning` er IKKE
> en DB-CHECK (backfill + overgangsrader bærer utledet flagg uten retning) — håndheves i C2-mottaket kun når
> klienten sendte `erReise` eksplisitt. Migreringen er **ikke kjørt** (Kenneth kjører mot test, leser navne-match-
> tallet før prod). **L2-B (mobil) og L2-C (attestering/eksport) gjenstår.**

> Forelder: [timer-gps-helhetsplan.md](timer-gps-helhetsplan.md) § 2 og § 5 LAG 2. Forutsetter lag 1
> (komplett `2e993250`). Hjemmel: V1, V2, V8, K5 (vedtatt 2026-10-03: **mottak med sporbarhet** —
> serveren tar imot klassifiseringen med alt den bygde på, og regner IKKE om). **Alt under er
> spesifikasjon** — ❌ IKKE IMPLEMENTERT inntil ordren som bærer det er merget.

## 0. Hva lag 2 er, og ikke er

**Lag 2 svarer på ett spørsmål: «hvorfor fikk jeg denne lønnen?»** — fra raden på telefonen, via
serverens mottak, til attestantens skjerm og regnskapets eksport. Det gir ingen ny beregning. Det gir
at beregningen som alt skjer (lag 1) etterlater seg spor som ikke kan gjettes bort.

**Ikke i lag 2:** rå GPS-posisjon til server (K3, personvern — `mannskap.md:45`) · server-omregning av
reise eller norm (K5 valgte mottak) · bekreftelsesskjermen (lag 3) · mellometapper og flere prosjekter
(lag 4) · polygon-geofence (V17, før lag 3/4).

## 1. Målt utgangspunkt (2026-10-03, `develop` ≥ `a762da2f`)

| # | Fakta | Bevis |
|---|---|---|
| M1 | 🔴 **L1-B regner etappene, men raden lagrer ingenting av dem.** `Etappe` (retning, oppmøtested, byggeplass, kjøretid, avstand, kategori, kilde) finnes kun i minnet; `reiseForRetning` reduserer til `{ kjoretidMin, lonnsartId }`; innsettingen skriver verken `erReise`, `beskrivelse` eller `byggeplassId` | `dagsforslag.ts:133-140`, `:494-508`, `:742-753`, `dagsforslagAnvend.ts:102-116` |
| M2 | Raden har ingen felt for avstand, oppmøtested, retning, kilde eller tidskilde — hverken på server eller mobil. `beskrivelse` er «hva jeg gjorde» (T.12) | `db-timer/schema.prisma:212-272`, `mobile/db/schema.ts:131-165`, `timerKatalog.ts:276-277` |
| M3 | **En reise-rad gjenkjennes kun ved lønnsart**: `reiseLonnsartId`, avstandsbånd-arter, eller regex `/reise\|transport/i`. Intet flagg på raden; `Lonnsart.type` har ingen reise-verdi | `reise.ts:38`, `organisasjon.ts:1040`, `timerKatalog.ts:289`, `TimerSeksjon.tsx:189`, `db-timer/schema.prisma:25` |
| M4 | 🔴 **Serverens overtidsgrunnlag summerer reise inn** — `OvertidRad = { timer, overtidsnivaa }`, ingen reise-filtrering; brukt av uke-grunnlaget og firma-attesteringen. `totaltimer` i attestering inkluderer reise. V1 er bare gjennomført på mobil | `overtidsgrunnlag.ts:20-24, :50`, `dagsseddel.ts:427-475, :2818-2824, :2845` |
| M5 | `reisetidTellerOvertid` leses fortsatt av api (select/skriv), web (innstillinger-UI), mobil (cache, schema, sendes inn i regelen uten å brukes); `lonnsregel.ts:34` beskriver fradraget som finnes | `organisasjon.ts:1107, :1209`, `innstillinger/page.tsx:1286, :1354`, `organizationSettingKatalog.ts:80`, `StartSluttDagKort.tsx:449`, `dagsforslag.ts:678-679` |
| M6 | **`syncBatch` stripper ukjente felt stille** (`z.object` uten `.strict()`, kommentar «MÅ deklareres her ellers stripper Zod dem»). Rader uten tider slipper gjennom («håndheves BEVISST IKKE her»); fra<til og overlapp sjekkes | `dagsseddel.ts:4725-4750, :4734-4736, :5348-5353, :5354-5376` |
| M7 | Attestanten ser en reise-rad som en vanlig rad med «—» i tid; ingen reise-markering; `rad.beskrivelse` vises ikke | `SeddelKort.tsx:551-602`, `AttesteringDetalj.tsx:234-250` |
| M8 | Eksporten bærer lønnsartnavn, timer, fra/til, beskrivelse — ikke km, avstand, sted, kilde, lønnsart-type eller `satsEnhet` | `timerDetaljRader.ts:373-391`, `rapport.ts:377, :468-501` |
| M9 | `attestertSnapshot` (lønnsart/aktivitet/sats/overtidsgrunnlag) leses kun i `hentForAttestering`; **`timer.md:680/683` sier eksporten bruker `attestertSnapshot.prisMotKunde` — det stemmer ikke** | `dagsseddel.ts:3251-3274, :3010-3011` |
| M10 | `DailySheet` har `sluttTidKilde` (`bruker\|midnatt\|system`) — et presedens for kilde-markør på sedel-nivå — men ingen `normStatus` | `db-timer/schema.prisma:172-179` |
| M11 | Ingen test dekker reise-rader i overtidsgrunnlag/eksport, feltpersistering i `syncBatch`, eller `detaljEksport` | agent-måling |

🔴 **M1 + M6 sammen:** selv om mobilen fikk sende etappen i dag, ville serveren kastet den uten feil.
Sporbarhet må deklareres i begge ender i samme release.

## 2. Leveranse A — radmodellen (db-timer + mobil)

**Additiv migrering i `packages/db-timer`** (Kenneth-gatet) + **lokal mobil-migrering** (`migreringer.ts`).

| Felt | Type | Betydning |
|---|---|---|
| `SheetTimer.erReise` | `Boolean @default(false)` | 🔴 **Eksplisitt flagg.** Ingen leser skal gjette reise fra lønnsart/regex etter lag 2 |
| `reiseRetning` | `"ut" \| "retur" \| null` | Etappens retning (lag 4 legger til `"mellom"`) |
| `reiseOppmotestedId` | `String?` (svak FK → `Oppmotested`, A.20-mønster) | Fra-/til-kontoret |
| `byggeplassId` | finnes | Destinasjonen (allerede på raden — skal nå faktisk skrives, M1) |
| `reiseKjoretidMin` | `Int?` | Matrisecellens kjøretid som ble brukt |
| `reiseAvstandM` | `Int?` | Matrisecellens avstand (meter) som avgjorde kategori/bånd |
| `reiseKilde` | `"matrise" \| "manuell" \| null` | Hvor tallene kom fra. `manuell` = arbeideren la til/endret raden selv |
| `reiseRegel` | `Json?` | Snapshot: `{ enhet, terskelMin, terskelM, underType, overType, kategori, grensepunktTreff }` — regelen slik den var da raden ble laget |
| `tidKilde` | `"stempel" \| "utledet" \| "manuell" \| null` | **V8.** `utledet` = vindu fra GPS ± matrise; `stempel` = ekte ankomst (lag 4); `manuell` = arbeider satte tiden |
| `DailySheet.normStatus` | `"server" \| "cachet" \| "ukjent" \| null` | Fra B6.3 i lag 1 — følger sedelen til attestanten |
| `DailySheet.normSnapshot` | `Json?` | `{ dagsnorm, normKilde, dato, hentetAt }` — normen som delte normaltid/overtid |

**Garantier (stille-tomhet-regelen, CLAUDE.md):**
- **Backfill `erReise`:** `true` der `lonnsartId ∈ { org.reiseLonnsartId } ∪ { grensepunkt-arter }`, og — kun
  for firmaer med `reiseLonnsartId = null` — der lønnsartnavnet matcher regexen. **Det speiler nøyaktig dagens
  leser-regel** (M3), ikke en ny gjetning. Gamle rader får `reiseKilde = null` (vi vet ikke) — ærlig, som
  `geofenceKilde = 'ukjent'` i lag 1.
  🔴 **Migreringen skal RAPPORTERE antall rader satt via navne-match-grenen** (firmaer med `reiseLonnsartId =
  null`), **separat fra** antall satt via konfigurert art (`reiseLonnsartId` + grensepunkt-arter). Grunn
  (gate 2026-10-03): regexen matcher et brukerredigerbart lønnsartnavn — et firma uten konfigurert reise-art
  med en art «Transporttillegg» får `erReise = true` frosset som eksplisitt sannhet. Settet fra konfigurerte arter
  er trygt; regex-grenen arver dagens falske positive og gjør dem permanente, så tallet skal være synlig i
  migreringsloggen (`RAISE NOTICE` / returnert telling), ikke bare resultatet. Kenneth leser tallet før han
  kjører mot prod.
- **CHECK:** `erReise = false ⇒ reiseRetning IS NULL AND reiseKjoretidMin IS NULL AND reiseAvstandM IS NULL` ·
  `erReise = true ⇒ reiseRetning IS NOT NULL`.
- **Test som FEILER** hvis en rad med reise-lønnsart står med `erReise = false` etter backfill, og hvis en
  `erReise`-rad opprettet etter lag 2 mangler `reiseKilde`.

## 3. Leveranse B — mobilen skriver sporet, og V8-vinduet

- **B1** `dagsforslagAnvend.ts` skriver alle felt fra `Etappe` på raden (M1): `erReise`, `reiseRetning`,
  `reiseOppmotestedId`, `byggeplassId`, `reiseKjoretidMin`, `reiseAvstandM`, `reiseKilde: "matrise"`,
  `reiseRegel` (snapshot av regelen `beregnReiseEtapper` brukte), `tidKilde`. `DagsforslagRad` utvides
  tilsvarende; `reiseForRetning` slutter å redusere etappen.
- **B2 V8 — klokkevindu på reise-rader.** `ut`: `fraTid = startGPS`, `tilTid = startGPS + kjoretidMin` ·
  `retur`: `fraTid = sluttGPS − kjoretidMin`, `tilTid = sluttGPS`. `tidKilde = "utledet"`. 🔴 **Vinduet SER
  målt ut, men er det ikke** — markøren er det som gjør V8 forenlig med sporbarheten (gate-funn lag 1).
  REISE-UNNTAKET i koden (`dagsforslag.ts:742-753` null-tider) reverseres med henvisning til V8.
- **B3 Overlapp-vakten.** Med tider trer reise-rader inn i `finnOverlappendeTidsrom` (klient) og
  `finnTidsromKonflikt` (server, avviser hele synken). Vinduene i B2 berører arbeidsvinduet i endepunktene
  (`tidsromOverlapper` er streng) — **test, ikke slutning:** Dag A synkes med fire rader (ut, ordinær, OT50,
  retur) og passerer serverens vakt.
- **B4** Når arbeideren **legger til eller endrer** en reise-rad manuelt (`TimerSeksjon`): `erReise = true`
  (lønnsart-velgeren setter det når arten er reise-art), `reiseKilde = "manuell"`, `tidKilde = "manuell"`,
  avstand/kjøretid `null`, **og `reiseRetning = null`** — manuell-UI-et har ingen retningsvelger, og skal ikke få
  en (🟢 **valg A, 2026-10-03**: retningen er informasjon, ikke lønn; lønnsarten avgjøres av arten arbeideren
  velger, og et ekstra trykk kjøper ingenting). Attestanten ser «Reise (manuell)». Endrer han tiden på en
  `utledet` rad → `tidKilde = "manuell"`. 🔴 **Aldri «ikke send `erReise` og la serveren utlede»** (alternativ C):
  da blir `reiseKilde = null`, og raden lyver om en kilde vi faktisk kjenner.
- **B5** `normStatus` + `normSnapshot` skrives på sedelen fra svar-cachen (lag 1 B6) og synkes.
- **B6** Mobilens reise-gjenkjenning ved visning (`TimerSeksjon.tsx:189-190, :480`) leser `erReise`,
  ikke lønnsart-id.

## 4. Leveranse C — mottak med sporbarhet (K5) og V1/V2 på serveren

- **C1 `syncBatch` deklarerer og skriver alle nye felt** (M6). Zod: `erReise`, `reiseRetning`,
  `reiseOppmotestedId`, `reiseKjoretidMin`, `reiseAvstandM`, `reiseKilde`, `reiseRegel`, `tidKilde` på
  timer-rader; `normStatus`, `normSnapshot` på sedelen. **Test som FEILER hvis et felt sendes og ikke
  lagres** (M11 — ingen slik test finnes i dag).
  🔴 **C1 gjelder BEGGE retninger** (presisert 2026-10-03, funnet av orkestrator i L2-B): **pull**
  (`hentEndringerSiden`) må returnere alle spor-feltene, og mobilen må lagre dem lokalt — ellers sletter neste
  push dem på serveren, fordi `syncBatch` erstatter radene (`deleteMany` + `createMany`). **Test som FEILER:**
  rad med spor → pull til tom klient → push → sporet står fortsatt på serveren. Blokkerende i L2-B (TILLEGG 1).
- **C2 Invarianter ved mottak** (validering, ikke omregning): `erReise ⇒ reiseKilde` ·
  🔴 **`erReise ∧ reiseKilde = "matrise" ⇒ reiseRetning ∧ reiseKjoretidMin ≥ 0 ∧ reiseAvstandM ≥ 0 ∧ reiseRegel`**
  *(presisert 2026-10-03, valg A: retningskravet gjelder KUN matrise-rader — en manuell rad har ingen retning å
  gi. Forrige formulering `erReise ⇒ reiseRetning ∧ reiseKilde` avviste manuelle rader fra `TimerSeksjon`,
  funnet av kontrollplan i L2-B. Endringen i `validerReiseInvarianter` legges i L2-B-branchen, så mobil og
  server endres i samme release.)* · `reiseOppmotestedId`
  tilhører firmaet · `reiseAvstandM ≤ 1 000 000` (navngitt konstant i `rad-tak.ts`-stil). Brudd → avvis
  raden med navngitt feil, ikke hele synken stille.
- **C3 Kontroll, ikke omregning** 🟢 *(gate 2026-10-03: INNENFOR K5 — «et snapshot ingen kontrollerer er et
  arkiv, ikke sporbarhet»; omregning ville vært at serveren satte en annen lønnsart, og det gjør den ikke)*: ved
  mottak av en `matrise`-rad slår serveren opp cellen `(reiseOppmotestedId, byggeplassId)` og **sammenligner**
  med snapshotet. 🔴 **Dobbel terskel — flagg først når avviket overstiger BÅDE prosenten OG en nedre grense**
  (gate-krav: ren prosent roper på korte turer og tier på mellomlange — 10 % av 2 km er 200 m støy). Navngitte
  konstanter i `rad-tak.ts`-stil, én kilde:
  `REISEAVVIK_MIN_PROSENT = 10` · `REISEAVVIK_MIN_AVSTAND_M = 2000` (meter) · `REISEAVVIK_MIN_KJORETID_MIN = 10`
  (minutter). `reiseAvvik = true` når `|avstand_rad − avstand_celle| > 10 %` **og** `> 2000 m`, **eller**
  `|kjøretid_rad − kjøretid_celle| > 10 %` **og** `> 10 min`. Ellers `false`. **Mangler cellen → `reiseAvvik =
  null`** (kan ikke kontrolleres — tre tilstander, «vet ikke» er ærlig). Flagget er **varsel til attestanten**;
  ingenting klassifiseres på nytt. Tallene er fabels forslag — orkestrator kan justere dem i ordren, men de skal
  stå som konstanter, aldri som tall i kode.
- **C4 V1/V2 på serveren.** `OvertidRad` får `erReise: boolean`; `beregnOvertidsgrunnlag` ekskluderer
  reise-rader; `byggUkeOvertidsgrunnlag` og `hentTilAttesteringFirma` sender flagget; `totaltimer` i
  attestering deles i `arbeidstimer` og `reisetimer`. **Test:** Dag A på serveren → overtidsgrunnlag 10 t
  arbeid, 2 t OT, reise 4 t utenfor; **feiler** hvis reise telles.
- **C5 `reisetidTellerOvertid` deprecates** (to-stegs): UI-avkrysningen fjernes fra `innstillinger/page.tsx`;
  api-select/skriv beholdes men ignoreres; mobil-cache/skjema-felt fjernes; `lonnsregel.ts:34`-docstring
  rettes. Kolonnen droppes i en senere release.

## 5. Leveranse D — attestanten og regnskapet ser sporet

- **D1 Attestering web** (`SeddelKort`, `AttesteringDetalj`): en `erReise`-rad får merke «Reise ut/retur»,
  linjen «Kontor Narvik → Grønnåsen · 42 km · 48 min · matrise», og tidskilde-merke (`utledet` vises som
  «tid utledet fra matrise»). `normStatus ≠ "server"` gir sedel-banner («Norm fra siste kjente svar» /
  «Norm ukjent — overtid ikke fordelt»). `reiseAvvik` (C3) gir varsel. «(inkl. reise)»-badgen skrives om til
  arbeid/reise. `rad.beskrivelse` vises (M7 — den er allerede i typen).
- **D2 Eksport** (`TIMER_KOL_KEYS` + `detaljEksport` + Excel-bygger): nye kolonner `reise` (ja/nei),
  `retning`, `fraSted`, `tilSted`, `avstandKm`, `kjoretidMin`, `reiseKilde`, `tidKilde`, `normStatus`.
  Arknavn/overskrifter via `t()` (i18n gjelder også ikke-JSX, CLAUDE.md). `lonnsart.type` og `satsEnhet`
  tas med — regnskap trenger dem for km-arter (K4-forberedelse, ikke K4).
  🟡 **Hull funnet i L2-C-gaten 2026-10-03:** `reiseAvvik` (true/false/tom) var ikke listet som eksportkolonne. I UI er
  `null` og `false` bevisst uskillbare (støy), men regnskap/revisjon skal kunne skille «kontrollert, innenfor» fra
  «ikke kontrollerbar». **Legges til D2 i en senere runde** (intern kolonne, strippes for ekstern). Ikke del av L2-C.
  ⚠️ **To tolkninger fra L2-C ligger hos Kenneth:** AML «lang dag»-varselet teller reise (total tilstedeværelse) ·
  Excel-kolonnene er dynamiske (kun når data finnes) — fabel anbefaler stabilt kolonnesett i Excel, dynamisk på skjerm.
- **D3 Doc-drift:** `timer.md:680/683` om `attestertSnapshot.prisMotKunde` i eksport rettes til det koden
  gjør (M9).

## 6. Ordre-splitt (anbefaling)

| Ordre | Innhold | Avhenger av | Migrering |
|---|---|---|---|
| **L2-A** | Leveranse A (db-timer-migrering + typer i shared) + C1–C5 (mottak, invarianter, kontroll, V1/V2 server, deprecation) | ingen | `db-timer` additiv, Kenneth-gatet |
| **L2-B** 🟢 BYGGET (branch `feat/timer-l2b-mobil-spor`, 2026-10-03 — venter gate/merge) | Leveranse B (mobil: skriver sporet, V8-vindu, normStatus-sync, erReise-visning) + C5 mobil. **B4 delvis:** manuell `tidKilde` satt; `erReise`/`reiseKilde="manuell"` IKKE satt (C2 `erReise⇒reiseRetning` + ingen retningsvelger → server utleder). **Funn:** pull (`hentEndringerSiden`) bærer ikke sporet → B6-fallback til pull utvides | L2-A merget (feltene må finnes i `syncBatch` FØR mobilen sender, M6) | lokal mobil-migrering |
| **L2-C** | Leveranse D (attestering web + eksport + doc-drift) | L2-A merget | — |

L2-B ∥ L2-C etter L2-A. **Rekkefølgen er ufravikelig: server deklarerer feltene før telefonen sender
dem**, ellers kastes sporet stille (M6).

## 7. Tester (DoD på tvers)

Dag A ende-til-ende: mobil lager fire rader med spor → `syncBatch` lagrer alle felt → attestering viser
«Reise ut 05:00–07:00 · Kontor → Byggeplass · km · min · matrise · tid utledet» → eksport har kolonnene
fylt → overtidsgrunnlag 2 t uten reise. **Fem tester som skal FEILE:** felt sendt men ikke lagret (C1) ·
reise telt i overtid (C4) · `erReise`-rad uten `reiseKilde` (A) · utledet vindu uten `tidKilde` (B2) ·
eksportrad for reise uten km når kilde er matrise (D2).

## 8. Åpne punkter for gaten

1. ~~C3 kontroll vs. omregning~~ — 🟢 avgjort av gaten: innenfor K5.
2. **`reiseRegel` som Json vs. kolonner** — Json valgt for migreringsenkelhet; eksporten trenger bare
   `kategori` derfra.
4. ~~B4 manuell reise-rad vs. C2~~ — 🟢 **avgjort 2026-10-03: valg A** (retningskrav kun for matrise-rader).
3. **Backfill-regelen for `erReise`** speiler dagens leser (M3). Alternativet er å la gamle rader stå
   `false` og kun merke nye — da lyver attesteringen om gamle reise-rader. Jeg anbefaler backfill.
