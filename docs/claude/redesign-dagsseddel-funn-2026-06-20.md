---
fil: redesign-dagsseddel-funn-2026-06-20.md
status: 🟠 MIDLERTIDIG ARBEIDSDOKUMENT — kun for dagsseddel-redesign
opprettet: 2026-06-20
sist_verifisert_mot_kode: 2026-06-20
emne: Funn fra dokumentasjon + kode-verifisering før redesign av dagsseddel-registrering
---

> # ⚠️ MIDLERTIDIG — IKKE i registeret / DOC-MAP / fil-telling
> Arbeidsdokument for dagsseddel-redesignet (samme konvensjon som
> `OPPSUMMERING-timer-arkitektur.md`). **Alle beslutninger og endringer som følger
> av dette skal omskrives inn i eksisterende sannhetskilder** (timer.md,
> dagsseddel-design.md, fase-0-beslutninger.md, terminologi.md, maskin.md,
> steg-4b-plan.md) — deretter slettes/arkiveres dette dokumentet.

# Funn: dagsseddel-registrering — dokumentasjon vs. kode

## Hovedkonklusjon (snur hypotesen)

Kenneth forventet «funn som logisk ikke eksisterer i UI». Sannheten er motsatt for de
fleste punktene: **funksjonaliteten ER bygget i mobil-koden — men skjult/gated** slik
at den er usynlig i normaltilfellet (én arbeider, ett prosjekt, ingen maskin-modul).
Skjermbildene viser et *innskrumpet* UI, ikke et *manglende* UI.

Det reelle problemet er **synlighet og selvforklaring**, ikke manglende felter.

## Metode

- Docs lest 2026-06-20 (11 filer) + kode-verifisert mot mobil-komponentene:
  `app/timer/[id].tsx`, `timer-detalj/{TimerSeksjon,MaskinSeksjon,ArbeidstidSeksjon,FraTilTidFelt,ProsjektVelger}.tsx`.
- Status: ✅ implementert+verifisert · 🟡 planlagt/ikke-bygget · ⚠️ bygget-men-skjult/gated · 📄 doc-drift

---

## DEL 1 — Per registrering: doc-intensjon vs. KODE (verifisert)

### A. Arbeidstid / timer-rad (`SheetTimer`) — ✅ + ⚠️
- **Doc:** rad bærer lønnsart + aktivitet + projectId + ECO + fra/til + timer; sedel
  bærer kun konvolutt (`startAt/endAt/pauseMin`). *(timer.md:756–784)*
- **Kode:** Bekreftet. `TimerRadModal` (`TimerSeksjon.tsx:383`) har prosjekt, lønnsart,
  aktivitet, antall timer, fra/til, underprosjekt. `EcoBucket` (`[id].tsx:570`) grupperer
  rader per prosjekt+ECO. **Per-rad `projectId` ER implementert på mobil** (insert `radProjectId`
  i `sheetTimerLocal.projectId`, `TimerSeksjon.tsx:93`).
- **⚠️ Skjult:** Ved ÉN prosjektgruppe vises ingen prosjekt-header (`[id].tsx:375`
  `visHeader={aktiveProsjektIder.length > 1}`). Toppbaren viser i stedet `aktivitet.navn`
  («Anleggsarbeid», `[id].tsx:277`) — som leses som prosjekt.

### B. Reisetid — ✅
- **Doc:** reisetid = egen lønnsart-rad, ikke felt/tillegg. *(timer.md:286)*
- **Kode:** Bekreftet — reisetid føres ved å velge «Reise»-lønnsart i `TimerRadModal`.
  R4 auto-forslag i `StartSluttDagKort` (matrise). Ingen egen reise-UI (riktig per modell).
- **🟡** Reise-regelsett + matrise R1–R4 = develop/test, ikke prod.

### C. Underprosjekt (= ECO) — ✅ + ⚠️
- **Doc:** «Underprosjekt» = `ExternalCostObject`, per rad. *(terminologi.md:105)*
- **Kode:** Bekreftet — `UnderprosjektVelgerModal` (`TimerSeksjon.tsx:925`, med fritekstsøk),
  ECO per timer-rad OG maskin-rad, ECO-bucket med «→ Godkjenning byggherre»-badge (`[id].tsx:633`).
- **⚠️ Skjult:** Underprosjekt-velgeren ligger inne i rad-modalen; ingen synlig inngang før
  man åpner en rad. ECO-listen krever at det finnes ECO-er (avledes fra Godkjenning/Proadm).

### D. Prosjekt-tilknytning + synlighet — ✅ modell / ⚠️ synlighet
- **Doc:** én sedel per (bruker, dag); projectId per rad; T.7 prosjekt+ECO-gruppert UI. *(fase-0 § T.1, T.7)*
- **Kode:** Bekreftet — `ProsjektGruppe` + `EcoBucket` + «+ Legg til prosjekt»
  (`ProsjektVelgerModal`, `[id].tsx:439`). T.7-strukturen ER bygget på mobil.
- **⚠️ HOVEDFUNN (svarer på spørsmål 1):** prosjektet er usynlig i normaltilfellet
  (én gruppe → ingen header). **Dette er rotårsaken — ikke at modellen mangler.**

### E. Maskintimer (`SheetMachine`) — ✅ + ⚠️
- **Doc:** maskin = egne rader, soft-skjul når Equipment-liste tom. *(C.18; dagsseddel-design.md:235)*
- **Kode:** Bekreftet — `MaskinSeksjon` + `MaskinRadModal` + `EquipmentVelgerModal`.
  **Soft-skjul:** `if (!harEquipmentCache && rader.length === 0) return null` (`MaskinSeksjon.tsx:143`).
- **⚠️ Forklarer skjerm 3:** «MASKINTIMER 0.00 T» uten «legg til»-vei = tom Equipment-cache
  (Maskin-modul ikke aktiv for firmaet).

### F. Produksjonsmengde — ✅ (kun maskin)
- **Kode:** `SheetMachine.mengde` + `enhet` finnes i `MaskinRadModal` (`MaskinSeksjon.tsx:555–576`,
  enhet-velger). Bekreftet bygget.
- **⚠️ Designspørsmål:** «annen produksjonsmengde» for *arbeider* (uten maskin) finnes ikke —
  mengde henger kun på maskin-raden.

### G. Varekjøp / vareforbruk — 🟡 IKKE BYGGET (ekte gap)
- **Doc:** Vare + Vareforbruk, registreres på sedel; men fase-0 sier «`SheetVareforbruk` mangler».
- **Kode:** `grep` i hele `apps/mobile` for vareforbruk/vare/SheetVare → **0 treff**. Ingen
  vare-seksjon, ingen import. **Reelt fravær — ikke skjult.** Dette er det eneste kravet av de
  seks som faktisk ikke finnes i UI.

### H. Roller: arbeider vs. maskinfører — 📄 modell-mismatch
- **Doc + kode:** «Maskinfører» er IKKE en rolle — maskinbruk er data (`SheetMachine`), gated på
  modul-aktivering. Alle ser samme flyt; maskin-seksjon soft-skjules.
- **⚠️ Designspørsmål til Kenneth:** ønsker du *rolle-baserte* registreringsoppsett (arbeider-modus
  vs. maskinfører-modus), eller holder dagens modul-gating + soft-skjul? Modellen har ikke roller i dag.

### I. Maskin/utstyr-velger fritekstsøk — ✅ ALLEREDE BYGGET
- **Krav (Kenneth):** fritekstsøk på maskin-nummer OG -navn, ingen lange nedtrekk.
- **Kode:** `EquipmentVelgerModal` filtrerer på merke, modell, internNavn, **internNummer**,
  registreringsnummer (`MaskinSeksjon.tsx:713–724`); søkefelt vises når listen > 7 (`:742`).
  **Kravet er oppfylt** — bare udokumentert. Samme mønster i lønnsart-, aktivitet- og ECO-velgerne.

---

## DEL 2 — Svar på Kenneths spørsmål (verifisert mot kode)

**Spørsmål 1 — forstår bruker hvilket prosjekt?**
Nei, men ikke fordi modellen mangler — fordi **prosjekt-headeren er gated til >1 prosjekt**
(`[id].tsx:375`) og toppbaren viser lønnsart/aktivitet («Anleggsarbeid») i stedet. Fjern gaten /
vis alltid prosjektet → løst.

**Spørsmål 2 — er «Legg til timer-rad» logisk?**
Delvis. Strukturen er: «Arbeidstid i dag» (konvolutt for overtid) → per prosjekt+ECO-bucket med
«Arbeidstimer» + «Legg til timer-rad» + maskin nestet under. Knappen er logisk *når man forstår*
at raden er der prosjekt/lønnsart/aktivitet/ECO settes — men det forklares ikke, og siden prosjektet
er skjult, mister raden sin kontekst.

**«+ Legg til prosjekt»:** nytt **hovedprosjekt** (ny prosjektgruppe), ikke underprosjekt. ✅ verifisert.
**Maskin «legg til»:** finnes, men **soft-skjult** når Equipment-cache er tom. ✅ verifisert.
**Varekjøp / arbeider-produksjonsmengde:** finnes **ikke**. ✅ verifisert.

---

## DEL 3 — Gap-liste (verifisert)

**Ekte mangler (bygges):**
- **GAP-1 — Vareforbruk/varekjøp:** ikke i mobil-UI i det hele tatt (0 grep-treff). Modul ikke bygget.
- **GAP-2 — Arbeider-produksjonsmengde:** mengde henger kun på maskin-rad; ikke for arbeider.

**Synlighets-/UX-feil (bygget, men skjult — dette er kjernen i redesignet):**
- **UX-1 — Prosjekt usynlig ved én gruppe** (`[id].tsx:375` `visHeader>1`) + toppbar viser aktivitet. → spørsmål 1.
  ✅ **LØST (2026-06-20, develop):** `visHeader={true}` (header alltid synlig) + fjernet aktivitet-undertittelen i toppbaren + dødkode-rens (aktivitet-state/-query/-import). Typecheck rent, ingen nye i18n-nøkler.

**Slice 1 — display-refinements mot v2-mockup (✅ gjort 2026-06-20, develop):**
- Maskin vises som «herav på maskin» (ny nøkkel `timer.gruppe.heravMaskin`), nesting + maskinAvArbeid-indikator beholdt.
- Prosjekt-subtotal (sum arbeidstimer, maskin utenfor) høyrejustert i gruppe-header.
- Dagssum-banner får valgfri «herav maskin {{maskin}} t»-linje (`timer.summering.heravMaskin`) når maskin > 0.
- Send-mikrotekst «Når du sender, godkjenner du timene dine.» (`timer.sendGodkjennHint`) under send-knappen.
- 3 nye i18n-nøkler i 15 språk. Auto-fyll-banner hører til Slice 3 (auto-utkast), ikke her.

**Slice 2 — T.12 fritekst per timer-rad (✅ gjort 2026-06-20, develop):**
- `SheetTimer.beskrivelse String? @db.Text` (nullable, additiv migrering `20260620120000_sheet_timer_beskrivelse`, ingen index/backfill). Speilet i `sheet_timer_local` (Drizzle + idempotent ALTER).
- tRPC: `tilfoyTimerRad`/`oppdaterTimerRad` (input+lagring), `hentEndringerSiden` (pull), `syncBatch` (input+createMany). timerSync push+pull.
- UI: `TimerRadModal` multiline-input («Hva gjorde du?») + `TimerRadVis` pencil-ikon-linje (jf. v2 «Støpte fundament, B-akse»).
- **Relikvi-felle unngått:** `timer.felt.beskrivelse`/`timer.beskrivelsePlaceholder` finnes allerede som *sedel-/dag-kommentar* (`DailySheet.beskrivelse`, brukt web `ny/page`+`[id]`+`AttesteringDetalj` / mobil `ny.tsx`). T.12 bruker nye distinkte nøkler `timer.felt.radBeskrivelse`/`timer.radBeskrivelsePlaceholder` (15 språk) for ikke å kollidere.
- **Web-parity** (`TimerRadDialog`): utestående kort follow-up — nullable felt, web brekker ikke uten.
- **UX-2 — «Legg til timer-rad»/konvolutt-relasjon uforklart.** → spørsmål 2.
- **UX-3 — Maskin-seksjon helt skjult** uten aktiv Maskin-modul (soft-skjul). Bevisst, men gir «hvor er maskin?».
- **UX-4 — Underprosjekt/ECO** kun synlig inne i rad-modal; ingen inngang utenfra.

**Tidsbug (skjerm 1, 165.57 T):**
- **BUG-1:** «Arbeidstid i dag» 14:32→12:37 = 165.57 T stammer trolig fra **glemt «Slutt dag»**:
  start 13. juni, «Slutt dag» trykket ~7 dager senere → 168 t. `StartSluttDagKort`-flyten har
  **ingen maks-varighet-vakt / auto-utsjekk** (jf. 12t-presedensen). Merk: manuell redigering
  *har* vakt (`ArbeidstidSeksjon.tsx:143` `diffMin<=0`), og `arbeidstidTimer` klamrer `Math.max(0,…)`
  (`[id].tsx:150`) — så **skjerm 1 (13. juni) er sannsynligvis et ELDRE bygg**; skjerm 3 (20. juni)
  er gjeldende kode. Bør bekreftes, men auto-flyt-vakten mangler uansett.

**Doc-drift (omskrives):**
- **DRIFT-1 (bekreftet 2026-06-20):** `timer.md:124` bunter ferdig + åpent arbeid under ett
  «🔴 Åpen»-banner (PR 2C). Verifisert mot kode — driften er *delvis*:
  - ✅ **Gjort:** `sheet_timer_local.projectId` (nullable, T7-3b1) + `fraTid`/`tilTid` (T4);
    `timerSync.ts:175/185/192` sender projectId per rad; screens bruker det. timer.md:124s
    «legge til project_id på sheet_timer_local» + «oppdatere timerSync/screens» er altså gjort.
  - 🔴 **Genuint åpent:** `dagsseddel_local.project_id` fortsatt `.notNull()` (`schema:84`);
    `byggeplassId` + attestert-felter på rad-tabellene + NOT NULL-constraint + full backfill gjenstår.
  - **Fiks:** rett timer.md:124 så ferdig/åpent ikke buntes — hører til BACKLOG-foldingen av DRIFT-1.
- **DRIFT-2:** `timer.md:330–357` UX-skisse viser prosjekt på sedel-nivå (pre-T.1) — utdatert.
- **DRIFT-3:** Fritekstsøk på alle velgere (incl. utstyr nr+navn) er bygget men udokumentert.
- **DRIFT-4:** `timer-input-katalog.md` er tom plassholder.
- **DRIFT-5:** auto-fordeling normaltid/overtid — T.9 (droppet) vs OPPSUMMERING (manglende). Koden
  forhåndsvelger kun lønnsart (Variant B), ingen fordelingsmotor → T.9 er korrekt; OPPSUMMERING bør rettes.

---

## DEL 4 — Beslutnings-status relevant for redesign

**LÅST:** T.1 (sedel/bruker/dag), T.2 (projectId per rad), T.3 (attestering per gruppe), T.4
(fra/til per rad + validering), T.7 (prosjekt+ECO-gruppert UI), Alt C (interne prosjekt-rader),
G1 (firma-nivå tilgang), reisetid = lønnsart-rad.

**ÅPENT (`timer-gps-prosjekt-utredning.md`):** BESLUTNING 1 (konservativ vs auto-utkast — **styrer
redesignet**), 2–6 (mismatch, dag-flyt, to-lags §15, autoritet, multi-byggeplass), reisetid-terskel/lovlighet,
byggeplass-GPS (1c-mobil). **Nye designspørsmål fra dette passet:** roller (H), arbeider-produksjonsmengde (F/GAP-2).

## DEL 5 — Hva må omskrives i eksisterende docs (etter beslutninger)

1. `timer.md:124` — fjern/oppdater «mobil bak»-claim (DRIFT-1).
2. `timer.md:330–357` — oppdater UX-skisse til T.7-gruppert, prosjekt per rad (DRIFT-2).
3. `maskin.md` / `dagsseddel-design.md` — dokumenter fritekstsøk-mønsteret på utstyr-velger (DRIFT-3).
4. `timer-input-katalog.md` — fyll eller slett (DRIFT-4).
5. fase-0 § T.9 vs `OPPSUMMERING` — reconcile auto-fordeling (DRIFT-5).
6. Nye beslutninger (synlighet/roller/varekjøp/produksjonsmengde) → riktig sannhetskilde når vedtatt.

---

## DEL 6 — Beslutninger fra Kenneth (2026-06-20) + design

### BESLUTNING R — «Roller» løses via kompetansematrisen, ikke rolle

Kenneth: les matrisen — om arbeider har **maskinførerbevis** / **40-timers sikkerhetskurs** —
og styr registreringsvalg ut fra det (ikke en hardkodet rolle).

**Verifisert mot kode/schema:**
- `Kompetansetype` (`schema.prisma:2034`) har `navn`, **`kategori`** (enum `KOMPETANSE_KATEGORIER`),
  `aktiv`, **`kobletTilEquipmentModell`** (fritekst merke+modell, forberedt for «DO-kobling Fase 6»).
- Kategori-katalogen inneholder **`"TRUCK-/MASKINFØRERBEVIS"`** (`fase-0:679`) — ren gating-akse.
- `AnsattKompetanse` har `utloper` (utløpsdato) → gating må respektere utløp.
- «Maskinførerbevis»/«40t» er IKKE seedet — `Kompetansetype` er firma-definert; firmaet oppretter
  typene selv (kategori settes ved opprettelse).

**Gap som må lukkes før dette kan bygges:**
- 🟡 **Kompetanse er ikke på mobil** (0 grep-treff i `apps/mobile`). Offline-gating krever ny
  lokal cache (`kompetansetype_local` + `ansatt_kompetanse_local`) + sync. **Største forutsetning.**
- 🟡 Ingen kryssmodul-konsum i dag (timer/maskin leser ikke kompetanse).
- 📄 CLAUDE.md-drift: påstår `apps/api/src/services/kompetanse/` — finnes ikke; er `routes/kompetanse.ts`
  + `routes/kompetansetype.ts` + `utils/kompetanseImport.ts`.

**Design (rangert):**
- **R-1 (anbefalt MVP):** vis maskin-seksjon kun hvis arbeider har aktiv (ikke-utløpt) kompetanse med
  `kategori = "TRUCK-/MASKINFØRERBEVIS"` — i tillegg til dagens `harEquipmentCache`-gate.
- **R-2 (Fase 2, sterkere):** begrens HVILKET utstyr via `kobletTilEquipmentModell` (kun sertifisert
  merke+modell). = «DO-kobling Fase 6», allerede forutsett i schema.
- Respekter `utloper` i begge.

**AVKLART (2026-06-20):** Matrise-drevet. Hent fra kompetansematrisen alle som er huket av for
**maskinfører / har 40-timers kurs**, og eksponer maskin-registrering for dem. Ingen separat hard
«site-gate» besluttet — maskinførerbevis + 40t leses som *kvalifikasjon* for maskin-registrering.
Eksakt kombinasjon (maskinførerbevis alene vs. + 40t) og om det skal være firma-konfigurerbart,
avklares ved bygging. **Forutsetning står: kompetanse må synces til mobil først.**

### BESLUTNING P — Produksjonsmengde for arbeider = fritekstfelt

Kenneth: arbeider skal ha et **fritekstfelt der han skriver hva han har gjort** (ikke tallmengde).

**Verifisert mot schema:**
- **`DailySheet.beskrivelse String? @db.Text`** finnes allerede (`db-timer schema:150`) — fritekst på
  **dag-nivå** — men eksponeres IKKE i mobil-UI i dag (ArbeidstidSeksjon viser den ikke).
- `SheetTimer` har INGEN fritekst. `SheetTillegg.kommentar` finnes (`:245`).

**Design (rangert):**
- **P-1 (minst arbeid):** eksponer eksisterende `DailySheet.beskrivelse` i mobil — ingen schema-endring.
  Men dag-nivå (én tekst for hele dagen).
- **P-2 (per aktivitet):** nytt fritekstfelt på `SheetTimer` (per rad) — krever schema + to-stegs migrering.
  Mest presist («hva jeg gjorde på denne posten»).
- **P-3:** per prosjektgruppe (mellomting).

**AVKLART (2026-06-20):** **Per timer-rad (P-2)** — nytt fritekstfelt på `SheetTimer` + to-stegs
migrering. Eksport: **utsatt** — rapport-valg (hva som skal med i utskrift) utvikles senere når
timeregistrering er funksjonell. Inntil da: lagres som intern dokumentasjon.

---

## DEL 7 — BESLUTNING 1 VEDTATT (2026-06-20): auto-utkast (Alternativ B)

Kenneth: «Modulen bygger seg selv, men viser arbeider hva som er registrert. Den må kunne korrigeres
av arbeider før innsending dersom automatikken registrerer noe annet enn arbeidstaker ønsker.»

→ **Alternativ B (auto-utkast)** valgt. Styrer hele to-be-redesignet.

**Invariant:** auto-skriving skjer alltid som `draft`. Arbeider ser alt, kan redigere/slette enhver
auto-rad, og **godkjenner ved innsending (`draft → sent`)**. Ingen lønn uten menneskelig godkjenning.
Formuleringen «aldri auto-rad» erstattes av **«aldri auto-*innsending*»**.

**Doc-konsekvens (omskrives i sannhetskilder via gaten):**
- `fase-0 § T.8` separasjons-prinsipp («innsjekk trigger aldri auto-dagsseddel/rader») → revideres til
  auto-utkast med godkjenning ved innsending.
- `timer.md:416` «aldri auto-rad» → «aldri auto-innsending».
- `timer-gps-prosjekt-utredning.md` BESLUTNING 1 → markeres **vedtatt (B)**.

**Byggbart nå (uten byggeplass-GPS) — «auto-utkast MVP»:** ved Slutt dag auto-genereres draft-dagsseddel
med arbeidstid-rad (timer = total − reise) på valgt prosjekt + reise-rad fra R4-matrise. Arbeider
korrigerer + sender. + synlighets-fiks (UX-1) så prosjektet vises.

**Slice 3 — auto-utkast MVP (✅ gjort 2026-06-20, develop):**
- **Viktig innsnevring:** selve auto-genereringen var **allerede bygget** (`genererForslag`, fra «Start/Slutt dag»-MVP 2026-06-06 + R4) — draft + arbeidstid (total − reise, splittet Timelønn/Overtid) + reise-rad. Slice 3 la til UX-signallaget + idempotens.
- **Idempotens (Alt 1):** `genererForslag` slår opp eksisterende `(userId, dato)`-draft lokalt → navigerer dit i stedet for å lage ny (server `@@unique([userId,dato])`). Edge: tom eksisterende draft åpnes uten auto-fyll (akseptabel MVP-tradeoff).
- **Auto-markør:** ny nullable lokal kolonne `dagsseddel_local.auto_generert` (idempotent ALTER, KUN lokal — synces aldri). `genererForslag` setter `autoGenerert: true`; manuelle `ny.tsx`-drafts lar den stå null.
- **Auto-fyll-banner** (`[id].tsx`): ✨ + «Dagen er fylt ut automatisk / Sjekk, rett og send», gated `status === "draft" && autoGenerert` → forsvinner automatisk ved innsending. Nye nøkler `timer.autoFyll.tittel`/`.hjelp` (15 språk).
- **Reise-rad-merking** (`TimerSeksjon`/`TimerRadVis`): reise-rad vises med 🚗 + «Reisetid» (gjenbruker `timer.reisetid`). Deteksjon via ny delt `hentReiseLonnsartId(orgId)` i `timerKatalog.ts` — ÉN sannhetskilde (reiseLonnsartId ellers `/reise|transport/i`), hoistet én gang i `TimerSeksjon`, så generering og render aldri drifter.
- **Verifisering:** mobil typecheck = 0 nye feil fra Slice 3-filene (kun pre-eksisterende baseline-gjeld, bl.a. `timerSync.ts` aktivitetId-null som er bevist uavhengig av kolonnen). **Reload:** full JS-reload (Metro «r») — idempotent ALTER kjører ved `DatabaseProvider`-mount.

**Slice 4a — midnatt-splitt (✅ gjort 2026-06-20, develop):**
- `genererForslag` refaktorert: ny ren helper `splittVedMidnatt` (`apps/mobile/src/utils/dagsegment.ts`) deler `[startAt, sluttIso]` ved hver lokale 00:00 → ett dag-segment per kalenderdag. `opprettDagsseddelForSegment` lager én draft per segment. Verifisert: 19:00→07:00 = 5t (dag D) + 7t (dag D+1), sum = reell total; dagskift uendret (1 segment).
- **Låst (Kenneth 2026-06-20):** pause (firma-standard) + reise **kun på start-dagen** (1a); per-dag Timelønn/Overtid-split beholdt (2, «registrer rådata»); overtid/tariff = regnskaps-scope.
- **«Delt ved midnatt»-merking:** lokal nullable `dagsseddel_local.delt_ved_midnatt` (idempotent ALTER, synces aldri), satt når segmenter > 1; lett indigo-badge på review-skjerm (`Split`-ikon, `timer.deltMidnatt.tittel`/`.hjelp` × 15 språk).
- **Idempotens per dag:** eksisterende `(userId, dato)`-sedel beholdes, øvrige dager opprettes; naviger til start-dagens sedel.
- **Kjent luke → Lag 2 (4b):** glemt «Slutt dag» over flere døgn over-splittes (3 dager → 4 sedler). Glemt-dag-prompt i 4b fanger det. 4b krever gated server-migrering (`sluttTidKilde` 3-verdi inkl. «midnatt» + arbeidstids-terskel) — ikke startet.
- **Verifisering:** typecheck 0 nye feil fra 4a-filene. **Reload:** full JS-reload (Metro «r»).

**Blokkert av byggeplass-GPS (1c-mobil):** BESLUTNING 2 (prosjekt-mismatch), 3 (dag-flyt-overganger),
6 (multi-byggeplass) — alt som krever GPS-drevet prosjekt/byggeplass-deteksjon + reise→arbeid-overganger.

**Kan låses uavhengig:** BESLUTNING 5 (arbeider-valg autoritativt, GPS advisory — G1). BESLUTNING 4
(to-lags §15-presence vs lønnstid) avhenger av Mannskap Fase 4.
