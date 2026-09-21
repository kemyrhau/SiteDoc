---
name: STATUS-AKTUELT
description: Løpende statusrapport for pågående arbeid, pauset arbeid og planlagte faser. Oppdateres ved hver vesentlig fremdrift.
sist_verifisert_mot_kode: 2026-08-09
---

# 🔴 TAVLA — hvem sitter hvor

**Eneste skribent: cowork** (SAMARBEIDSREGLER `:1054`). 🔴 **Føres FRA MÅLING — `git log
origin/develop`, `git worktree list`, `git branch -r` — aldri fra hukommelse.**

**Sist ført: 2026-09-21 · develop `aa9fd26b` (Runde E-rettelse: FP1 f08 «per 1000»→«pr. 1000 satte», husstil pr., [no-ff]) · GATE (`--force`): api 513 · db 189 · pdf 124 · shared 834 · web 304 · mobil 34 · 7/7 (ALLE stille — rettelsen endrer tekst, ikke antall tester) · fasit-diff nøyaktig `1 1` · `per 1000` = 0 treff i kodefiler · ingen migrering, ingen SQL (Kenneth kjører `fj1-fp1-test.sql`), ingen mobil · test flere steg bak (deploy føres av cowork)**

| Agent | Worktree | Branch | Tilstand | Venter på |
|---|---|---|---|---|
| **redesign** | `SiteDoc-redesign` | tre små rettinger merget `e4ada0e3` (worktree står på `fix/tre-smaa-rettinger` `2438886b`, som er i develop) | ⚪ **LEDIG** (ingen ny branch pushet) | — |
| **dokgen** | `SiteDoc-dokgen` | — | ⚪ **LEDIG** | — |
| **mal-Opus** | `SiteDoc-mal` | Runde E + FP1-rettelse merget `aa9fd26b` (worktree på `feat/mal-runde-e` `172529ed`, som er i develop) | ⚪ **LEDIG** (ingen ny branch pushet utover runde E) | Ingen malordre i kø — design melder neste |
| **kontrollplan** | `SiteDoc-kontrollplan` | varig-grå merget `1dace3b0` | ⚪ **LEDIG** | — |
| **merge** | `SiteDoc-merge` | `merge-restart` | ⚪ **LEDIG** | — |
| **simulator** | `SiteDoc-simulator` | — | ⚪ **LEDIG** | — |
| **deploy** | — | — | ⚪ **LEDIG** | — |
| **design** (tidligere fabel) | `SiteDoc-design` 🔴 ikke opprettet ennå (Kenneth) | `docs/design-<emne>`-brancher | ⚪ **LEDIG** | plan-sporet (redesign + maler) |

**Tilstander:** ⚪ LEDIG · 🟠 FERDIGSKREVET (ikke relayet) · 🔵 ORDRE GITT · 🟢 LEVERT · 🔴 BLOKKERT

> ✅ **SJA-skjermbildegate — LUKKET 2026-09-17 (etterkontroll, delvis dekket).** SJA-signaturrundene er i prod (release-merge `ad18df93`). Etterkontrollen var en port for avvik, ikke rollback. **Flate 3 (signering på egen rad) er IKKE DEKKET:** demodataen har allerede Kenneths rad signert, og Kenneth vedtok 2026-09-17 «la SJA være» — de radene er BEVIS på at funksjonen virket, ikke støy å nullstille (`packages/db/prisma/reset-sja-runde2.sql`, merket «SKAL IKKE KJØRES»). Skal flate 3 verifiseres senere, seedes et NYTT demo-SJA ved siden av (se [DEPLOY-RUNBOK § 7](DEPLOY-RUNBOK.md#7--seeding-mot-test)). Ordrefil: `docs/redesign/ORDRE-verifisering-sja-skjermbildegate-2026-09-17.md`.

## 🔴 Coworks kø — bestilt, ikke skrevet

| Sak | Utløser | Til |
|---|---|---|
| ✅ **SPERREDE KNAPPER MERGET `b9d8ddec`** (2026-09-19c) — 48 knapper web+mobil, `KnappMedForklaring`, 35 nøkler under `sperret.*`. Fire oppfølgere → BACKLOG § 1. Se datert seksjon under | Ferdig | — |
| ✅ **KM2 MERGET `a59d0e44`** (2026-09-19c) + **KD2 `c1e29dc9`** (19a) — begge via maløypa. Se dater seksjoner under | Ferdig | — |
| 🔵 **KM2 — KD2 er nå inne → mal-Opus kan starte** (han sjekker selv). Går på maløypa (design → mal-Opus direkte). `docs/redesign/ordre-km2-ny-mal-design-2026-09-18.md` (mur av stein i terreng), merget `1056b302`. KM2 bruker generatoren fra KD2 og skal ligge **etter `KD2_MAL`** i `seed-bibliotek.ts`. Normen har ingen utførelseskrav/toleranser for mur → **kontroll mot beskrivelsen, ingen tall** (Kenneth godkjent). Branch `feat/mal-km2` | KD2 inne (nå) | design → mal-Opus |
| **Bundet flyt — UI** | Nå. Kolonne + serversperre er inne (`be2217d1`); radiovalg ved opprettelse, bryter i etterkant, fotnote og `Anchor`-symbol mangler | redesign |
| **Strengharmonisering** — «Sentralarkiv»/«Malarkiv» ut som synlige begreper + kapittel/underkapittel/post | Nå. Har ventet siden 16.09 | mal-Opus |
| ✅ **§7b-RETTING BYGGET + MERGET `5cd113ab`** (2026-09-19e) — KA7, KB2, KB4, KB6 **og KC3.1** rettet, alle version 2. Designgatet på tekstbevis. Lukker den gamle KC3.1-§7b-raden (sto siden 18.09). **Hele NS 3420-K-biblioteket (KA7–KM2) følger nå MAL-METODE §7b — opphavsrettssaken lukket for biblioteket** | Ferdig | — |
| **`hentStandarder`-sikkerhetsrunde** — ingen tilgangsgate. 🟢 Ulåst 15.09 av lese/redigere-aksen | Nå | — |
| **`terminologi.md § 0`** — lese/redigere-aksen i rettighetsmatrisen + kapittel/underkapittel/post | Med sikkerhetsrunden | — |
| **`06-videresend`** — eneste e2e-spec som gjenstår. Var ikke drift: handlingen var fjernet fra menyen | Etter Kenneths visuelle gate av personvalget | dokgen |
| **Tørrkjøring for ↻** — `firmamal.forhandsvisOppdatering`, ~30–40 linjer, gjenbruker `diffObjektTre` | 🔴 Kenneth gater | — |
| **NUL-bytes i `objektkopi.ts`** — fire `\0` som feltskiller gjør fila binær for git og `grep`. Vi måler i den konstant | Med neste kontrollplan-runde | kontrollplan |
| **`data-testid` på begrunnelse-dialogen** (`DokumentHandlingsmeny.tsx:646`) — spec henger i placeholder-tekst | Med neste redesign-runde | redesign |
| **Mobil videresend** — kun person-velger innen egen flyt mangler; flyt-bytte finnes alt | Etter web er gatet | redesign |
| 🔴 **REMÅL MASTERPLANEN MOT KODE** — `arkitektur-syntese.md:48,104,211` sier Fase 2 «mangler»/«bygges». Den ER bygget: `OrganizationTemplate` med objekt-tabell, versjonssporing, soft-delete, `firmamal.promoter`, Malforvaltning. Samme tilstand som BACKLOG hadde 11.09 («seks poster var levert uten at noen førte det»), ett nivå opp | 🔴 Kenneth velger: denne eller A.Markussen-lista først | — |
| **A.Markussen — seks kundeønsker urørt siden 06.05** — servicesjekkliste m/ timetall · rettighetsmatrise Prosjektleder/Bas · tre SJA-justeringer · pushvarsel/SMS. **Piloten starter i september** | 🔴 Kenneth velger | — |

---

## 🟢 2026-09-21 — Runde E-rettelse: FP1 f08 følger husstilen «pr.» i satser. Ingen migrering, ingen SQL, ingen mobil. develop `aa9fd26b`.

**Én branch, `--no-ff`:** `feat/mal-runde-e` `172529ed` — to kodefiler (`seed-bibliotek.ts` + `mal-fasit.snap.md`), hver `1 1`.

### Rettelsen
- **FP1 f08 hjelpetekst:** «Deretter 50 bolter **per 1000**.» → «Deretter 50 bolter **pr. 1000 satte**.» I både seed (`FP1_MAL`) og fasiten. Følger husstilen «pr.» i satser/enheter (CLAUDE.md § Språk). Ingen annen tekst rørt.
- ⚠️ **Eneste gang fasiten endres uten at slettetallet er 0 — og det er riktig her:** en RETTELSE av eksisterende tekst SKAL vise 1 slettet + 1 lagt til. Fasit-diff målt = nøyaktig **`1 1`**.
- **`per 1000` = 0 treff i kodefiler** (seed + fasit) på develop etter merge. De 2 gjenværende repo-treffene ligger i design-ordredokumentet `ordre-fp1-ny-mal-design-2026-09-21.md` — historisk record av malteksten, korrekt latt urørt.

### 🔴 PROSESSFUNN — runde E ble merget UGATET (coworks ansvar)
`0ab36a84` merget runde E til develop **før design hadde gatet den.** Årsaken var coworks ordre: branchen ble tatt inn fordi cowork hadde **målt at den fantes på origin**, ikke fordi det forelå en «Designgatet – klar for merge». Design holdt den tilbake nettopp med denne tekstrettelsen — men meldingen gikk til mal-Opus, ikke cowork. **Ingen skade, fordi SQL-en ikke var kjørt — men det var flaks, ikke system.**

⚠️ **Ikke designs feil:** deres tilbakeholdelse gikk til mal-Opus. Coworks egen merge-regel skulle uansett fanget det.

🔴 **Ny regel i `SAMARBEIDSREGLER.md` § MALØYPE (etter punkt 3):** en pushet branch er IKKE et klarsignal — gate-MELDINGEN «Designgatet – klar for merge» i `relay/inbox-cowork.md` for nøyaktig den branchen utløser merge, ikke branchens eksistens. Gjelder også når cowork har målt branchen på origin.

---

## 🟢 2026-09-21 — Tre rettinger + Runde E (FJ1 + FP1) + ordrene merget. Ingen migrering, ingen mobil-kode. develop `e4ada0e3`.

**Tre brancher, alle `--no-ff`, alle konfliktfrie mot develop (merge-tree 0 markører — verifisert selv etter at develop hadde flyttet til `2d2a32b9` for CLAUDE.md-runden):**
- **1 — `fix/tre-smaa-rettinger` `2438886b`** (18 filer: 2 api, 1 web hms, 15 i18n).
- **2 — `feat/mal-runde-e` `963d34d6`** (5 filer, `packages/db/prisma`): `seed-bibliotek.ts` · `fj1-mal.test.ts` + `fp1-mal.test.ts` · `generer-mal-sql.test.ts` · `mal-fasit.snap.md`.
- **3 — `docs/design-runde-e` `73869c99`** (🔴 ikke ff, base `4b46aa2b`): to nye ordrefiler `ordre-fj1-…` + `ordre-fp1-…`. Non-ff trygghetsmålt selv: begge nye, 0 commits på develop siden basen, merge-tree 0 markører.

### De tre rettingene — designgatet per sak
- **`dismissed`-råstreng:** `dismissed: "status.avvist"` i `STATUS_I18N`. Funnet bekreftet — `dismissed` sto i `FIRMA_TERMINALE` og ble vist rått. `rejected` er inert og latt stå (som ordren sa).
- **Tiebreaker:** `orderBy: [{ sortering }, { kode }]` på både standarder og kapitler; enhetstesten sett rød først (`api` 511→513). 🔴 **Presisering (ordrett i innhold):** enhetstesten låser at spørringen **ber om** tiebreakeren; at databasen faktisk **leverer** den rekkefølgen kan bare en integrasjonstest vise. Design har vurdert dekningen som god nok her.
- **Dokumentklasse:** `nb.json` «Dokumentklasse», `en.json` «Document class», 13 språkfiler med én endret linje hver. Ingen drift dratt med.

### Runde E — FJ1 + FP1
- **FJ1 + FP1 v1.** 🟢 **Generatoren (`generer-mal-sql.ts`) er URØRT** — kun `generer-mal-sql.test.ts` endret. **SQL-regelen utløses altså ikke av generatorendring denne runden**, men malene er nye, så Kenneth kjørte SQL-en (gatemelding). Merge-agenten kjørte ikke SQL selv.
- **🔴 REN TILLEGG — verifisert med tall:** `git diff --numstat` på `mal-fasit.snap.md` = **`108 0`** (0 slettinger). **Biblioteket har nå 23 maler.**

**Gate (`--force`, 0 cached, ingen FULL TURBO):** api 511→**513** (tiebreaker) · db 175→**189** (FJ1+FP1) · pdf 124 · shared 834 · web 304 · mobil 34 (alle fire stille) · 7/7. Ingen migrering, ingen mobil-kode. *(web/shared kunne steget på i18n-endringen, men gjorde det ikke — endringene var verdiendringer, ikke nye nøkler/tester.)*

🔴 **i18n-fella er ALLEREDE dokumentert** i `shared-pakker.md` (kodelinje `generate.ts:70`, filteret `!eksisterende[key]`, «Bekreftet på nytt 2026-09-11»). **Dette er fjerde gang den ikke ble funnet** — det er selve poenget, og grunnen til at regelen ble løftet til `CLAUDE.md` i egen runde (`325edf37`). **Ikke skrevet inn på nytt i `shared-pakker.md`.**

---

## 🟢 2026-09-21 — CLAUDE.md § i18n: regel om ENDRING av eksisterende nøkkel løftet inn. Ren docs, ingen branch. develop `325edf37`.

**Ingen merge-branch — én direkte commit på `CLAUDE.md` (Kenneth-gatet):** i18n-punkt 3 fikk én setning — **endrer du en EKSISTERENDE nøkkel, slett den fra de 13 målspråkene først; `--only` fyller kun manglende, oppdaterer aldri.**

🔴 **Begrunnelse (hvorfor den flyttes, ikke bare at den finnes): tredje gjenoppdagelse.** Fella er allerede dokumentert i `shared-pakker.md` (kodelinje `generate.ts:70`, filteret `!eksisterende[key]`, «Bekreftet på nytt 2026-09-11»), men `CLAUDE.md:223` — det agentene leser ved sesjonsstart — beskrev bare `--only` for å LEGGE TIL nøkler. Regelen løftes dit fordi det er der den blir lest.

**Størrelsesgate (`wc -m`, ikke `wc -c`):** CLAUDE.md 40486 → **40541 tegn, margin 419** (grense 40960; krav ≥400). Komprimerte tre eksempler/datoer i samme i18n-blokk — **kun eksempler og datoer, ingen begrunnelse rørt**: datoen «(funnet 2026-08-24)» på ikke-JSX-punktet, parentesen «(lærdom `hjelp.flyt.*` 2026-05-23)» på diagnostikk-regelen, og ett av tre gjenbruks-eksempler (`handling.avbryt`). Reglenes hvorfor-setninger står intakt.

**Gate — ALT HELT stille (`--force`, 0 cached, ingen FULL TURBO):** db 175 · api 511 · pdf 124 · shared 834 · web 304 · mobil 34 · 7/7. Runden rører ingen kode.

---

## 🟢 2026-09-21 — MAL-METODE §6b (feltnummer vs. radnummer) + ordre «tre små rettinger» merget. Ren docs. develop `b506d551`.

**To brancher, begge `--no-ff`, begge ff-mulig mot `4b46aa2b`:**
- **1 — `docs/design-feltnummer` `003ceaea`**: `docs/claude/MAL-METODE.md` (`+16/−0`) — §6b.
- **2 — `docs/design-tre-smaa` `efc4453b`**: `docs/redesign/ordre-tre-smaa-rettinger-design-2026-09-21.md` (ny) — dismissed-råstreng, kapittel-tiebreaker, Dokumenttype→Dokumentklasse.

**MAL-METODE §6b er inne:** et felt har to tall — **feltnummer** (ordre/test/fasit, uten overskrifter) og **radnummer** (psql-utskrift/`sort_order`, med overskrifter). Regelen: si alltid hvilken telling; ved tvil er fasitfilen fasit. (Løser JH2-forvirringen fra runde D — «felt 13» i gatemeldingen var radnummeret; feltnummeret er 10.)

**Ordren for de tre små rettingene ligger lesbar i develop** — redesign eier dem. 🔴 **Redesign har IKKE startet; nudgen sendes etter denne mergen.**

**Gate — ALT HELT stille (`--force`, 0 cached, ingen FULL TURBO):** db 175 · api 511 · pdf 124 · shared 834 · web 304 · mobil 34 · 7/7. Runden rører ingen kode.

---

## 🟢 2026-09-20 — Runde D: FF1 + JH2 (fjerde standard NS 3420-J) merget + MAL-PLAN-rydding. Biblioteket har 21 maler i fire standarder. Ingen migrering, ingen mobil. develop `42bdb03e`.

**To brancher, begge `--no-ff`, begge ff-mulig mot `692dfefd`:**
- **1 — `feat/mal-runde-d` `fe97e498`** (seks filer, alle `packages/db/prisma`): `seed-bibliotek.ts` · `ff1-mal.test.ts` + `jh2-mal.test.ts` · `generer-mal-sql.ts` (4 linjer) + `generer-mal-sql.test.ts` · `mal-fasit.snap.md`.
- **2 — `docs/design-rydding` `c946c01c`**: `docs/claude/MAL-PLAN.md` (`+18/−7`) + `docs/redesign/status-designsporet-2026-09-20.md` (ny).

**🔴 REN TILLEGG — verifisert med tall:** `git diff --numstat` på `mal-fasit.snap.md` = **`110 0`** (0 slettinger). Ingen eksisterende maltekst endret.

**🟢 MAL-PLAN-rydding er statusoppdatering, ikke drift:** de sju slettede linjene i `MAL-PLAN.md` var **stale status-/planrader** (gamle statuser «klar for merge»/«–»/«Starter etter …» for FS2/FD2/FH1/FS3, FB4/FD3-parkeringsrader, og planplassholderen «Del U – rørledning i grøft») — alle **erstattet av korrekte merget-rader** (nå rad 10–21). Intet innhold forsvant uten erstatning.

**FF1 (10 felt + 3 headings) + JH2 (11 felt + 3 headings), begge v1.** **Kapitlene FF og JH opprettet.** **Biblioteket har nå 21 maler i fire standarder — K, F, U og J.**

**🔴 To ting eksplisitt:**
- **§7c virker i praksis:** JH2 navngir **N200 ordrett** — første mal som peker arbeideren til en kilde han faktisk kan åpne (gratis offentlig vegvesen-håndbok; NS-standarden navngis ikke).
- **FF fikk sortering 4** — som var **ledig mellom FD og FH**. **Ingen eksisterende kapitler flyttet.**

**🟢 GODKJENT GENERATORENDRING (ikke drift):** `kapittelArrays()` kjente bare K/F/U; den fjerde standarden krevde `KAPITTEL_DATA_J` + oppslag i `kapittelArrays()`. Nødvendig for standard nr. 4, testdekket.

**Gate — KUN db steg, alle andre HELT stille (`--force`, 0 cached, ingen FULL TURBO):** db 156→175 (**+19**, FF1+JH2-tester + utvidet generator-test) · api 511 · pdf 124 · shared 834 · web 304 · mobil 34 · 7/7. Ingen migrering, ingen mobil-endring, ingen i18n.

**SQL-regelen (§8b) utløst og fulgt:** generatoren er endret (`generer-mal-sql.ts`, 4 linjer), så SQL mot test kreves. **Kjørt av Kenneth, `ff1-jh2-test.sql`:** fjerde standard NS 3420-J:2008 opprettet, kapitlene FF og JH opprettet, FF1 v1 (10 felt + 3 headings), JH2 v1 (11 felt + 3 headings). 🔴 §1b: én kjøring per fil — merge-agenten kjørte ikke SQL selv.

**Ingen ny malordre i kø.** 🟡 **Målt: mal-Opus har ikke startet ny runde** — worktreet står på `feat/mal-runde-d` (nå merget), ingen kodebranch utover runde D. Neste kandidater står i `docs/redesign/status-designsporet-2026-09-20.md`; startsignalet sender design.

---

## 🟢 2026-09-20 — Runde C: UP1 + FB1 (nytt kap UP) merget + runde D-ordrene lagt lesbare. VA-kjeden komplett. Ingen migrering, ingen mobil. develop `ca44f9e3`.

**To brancher, begge `--no-ff` — runde C først (blokkerte D):**
- **1 — `feat/mal-runde-c` `aec7688f`** (🔴 ikke ff, base `37864435`; seks filer, alle `packages/db/prisma`): `seed-bibliotek.ts` · `up1-mal.test.ts` + `fb1-mal.test.ts` · `generer-mal-sql.ts` (`+76/−4`) + `generer-mal-sql.test.ts` · `mal-fasit.snap.md`. **Non-ff trygghetsmålt selv:** alle fire kodefiler 0 commits på develop siden basen, `merge-tree` → 0 konfliktmarkører. Ingen rebase.
- **2 — `docs/design-runde-d` `63b56af7`** (ff-bar): `docs/claude/MAL-METODE.md` (§7c) + `ordre-ff1-ny-mal-design-2026-09-20.md` + `ordre-jh2-ny-mal-design-2026-09-20.md`.

**🔴 REN FLYTTING/TILLEGG — verifisert med tall:** `git diff --numstat` på `mal-fasit.snap.md` = **`113 0`** (0 slettinger). Ingen eksisterende maltekst endret.

**UP1 (12 felt + 3 headings) + FB1 (10 felt + 3 headings), begge v1.** **Nytt kapittel UP** (i NS 3420-U). **Kapittelet FB er ikke lenger tomt.** **Biblioteket har nå 19 maler**, og **VA-kjeden er komplett: FD2 → UM1 → UP1 → FS3 → UU1.**

**🟢 GODKJENT UTVIDELSE (ikke drift):** mal-Opus løste sorteringsrettingen (UU → sortering 3) som et `--sorter KODE=n`-valg i generatoren i stedet for håndskrevet SQL — smal, innenfor riktig standard, kun modus `ny`, testdekket. Design har godkjent.

**Gate — KUN db steg, alle andre HELT stille (`--force`, 0 cached, ingen FULL TURBO):** db 137→156 (**+19**, UP1+FB1-tester + utvidet generator-test) · api 511 · pdf 124 · shared 834 · web 304 · mobil 34 · 7/7. Ingen migrering, ingen mobil-endring, ingen i18n.

**SQL-regelen (§8b) utløst og fulgt:** generatoren er endret (`+76/−4`), så SQL mot test kreves. **Kjørt av Kenneth, `up1-fb1-test.sql`:** kapittel UP opprettet, UP1 v1, FB1 v1, `UPDATE 1` flyttet UU til sortering 3. 🔴 §1b: én kjøring per fil — merge-agenten kjørte ikke SQL selv.

**Runde D-ordrene (FF1, JH2) + MAL-METODE §7c ligger lesbare i develop.** 🟡 **Målt: mal-Opus har IKKE startet runde D** — worktreet står fortsatt på `feat/mal-runde-c`, ingen runde-D-kodebranch finnes. Startsignalet sender design.

### 🟡 BACKLOG-post fra runde C — kapittel-sortering mangler tiebreaker
- `bibliotek.ts:37` sorterer kapittel-lista kun på `sortering`, uten tiebreaker. To kapitler med samme tall gir udefinert rekkefølge i UI-et — samme klasse som «stille tomhet».
- **Selve tilfellet er løst i runde C** (UU flyttet til egen sortering). Koden bør sortere på `sortering`, deretter `kode`. **Ikke hastesak, ikke fikset i denne runden — ført til cowork/BACKLOG.**

---

## 🟢 2026-09-20 — Ordrefiler for runde C (FB1 + UP1) lagt i develop. Ren docs. develop `c0985f7c`.

**Én branch `docs/design-runde-c` `ea7f5d48` [no-ff]:** to NYE ordrefiler i `docs/redesign/` — `ordre-fb1-ny-mal-design-2026-09-20.md` (130 linjer) + `ordre-up1-ny-mal-design-2026-09-20.md` (162 linjer). Begge status `A`, 0 slettede linjer, ingen eksisterende fil rørt.

**Gate — ALT HELT stille (`--force`, 0 cached, ingen FULL TURBO):** db 137 · api 511 · pdf 124 · shared 834 · web 304 · mobil 34 · 7/7. Runden rører ingen kode.

🔴 **RETTELSE (korreksjon av påstand, ikke en statusendring):** denne seksjonen sa opprinnelig at ordrefilene var «klare for mal-Opus / ingen har startet». **Det var feil.** Runde C var på det tidspunktet allerede **bygget, frosset og designgatet** (`feat/mal-runde-c` `aec7688f`). Feilen kom fra coworks ordre, som skrev «ingen har startet» uten å ha lest inboksen. **Det som faktisk skjedde:** ordrefilene ble lagt i develop mens malbygget allerede var gatet — ikke som et startsignal.

---

## 🟢 2026-09-20 — Runde B: UM1 + UU1 (ny standard NS 3420-U) + MAL-PLAN merget. Del U påbegynt. Ingen migrering, ingen mobil. develop `0b1506d1`.

**To brancher, begge `--no-ff`, begge ff-mulig mot `717f5981`:**
- **1 — `feat/mal-um1-uu1` `9c9af247`** (seks filer, alle `packages/db/prisma`): `seed-bibliotek.ts` (UM1+UU1, hver 11 felt + 3 headings, modus «ny»; kapitlene UM og UU) · `um1-mal.test.ts` + `uu1-mal.test.ts` · `generer-mal-sql.ts` (`+75/−9`) + `generer-mal-sql.test.ts` (`+100/−2`) · `mal-fasit.snap.md`.
- **2 — `docs/design-malplan-2` `b6076127`**: `docs/claude/MAL-PLAN.md`.

**🟢 GODKJENT AVVIK (ikke drift):** ordrene fra 19.09 sa separate brancher for UM1 og UU1; **én felles branch fulgt Kenneths samlerunde-vedtak 20.09**. Innholdet er uendret. Design har godkjent.

**Biblioteket har nå TRE standarder: NS 3420-K, -F og -U.** **Generatoren er utvidet:** den kan nå **opprette en manglende standard** (`opprettStandardSql`) og **bygge flere nye maler i én fil** (`byggFlerNySql`). K- og F-maler får no-op standard-INSERT.

**🔴 REN FLYTTING/TILLEGG — verifisert med tall:** `git diff --numstat` på `mal-fasit.snap.md` = **`111 0`** (111 tillegg, **0 slettinger**). Ingen eksisterende maltekst endret.

**Gate — KUN db steg, alle andre HELT stille (`--force`, 0 cached, ingen FULL TURBO):** db 111→137 (**+26**, UM1+UU1-tester + utvidet generator-test) · api 511 · pdf 124 · shared 834 · web 304 · mobil 34 · 7/7. Ingen migrering, ingen mobil-endring, ingen i18n.

### 🔴 SQL-REGELEN UTLØST OG FULGT — første gang i praksis (2026-09-20)
- Dette er **første runde som treffer den nye SQL-regelen** (MAL-METODE §8b): generatoren ER endret (`generer-mal-sql.ts` `+75/−9`), og regelen sier da at SQL mot test **skal** kjøres.
- **Den er kjørt — av Kenneth, `um1-uu1-test.sql`** (designgate-input): ny standard NS 3420-U opprettet, kapitlene UM og UU opprettet, UM1 og UU1 v1 med 11 felt + 3 headings hver, tekstbevis ordrett (45 og 49 tekster, målt av design).
- 🔴 **§1b: én kjøring per fil, aldri to.** Merge-agenten kjørte ikke SQL selv.

---

## 🟢 2026-09-20 — FB4/FD3 løftet inn i malfasiten + SAMARBEIDSREGLER: gate-tall fra `--force`. Ingen migrering, ingen mobil, ingen SQL. develop `a0349089`.

**To brancher, begge `--no-ff`:**
- **1 — `feat/mal-fasit-fb4-fd3` `10e04f72`** (ff-bar): `seed-bibliotek.ts` (FB4/FD3 løftet fra inline-blokk til `export const *_MAL`) + `mal-fasit.snap.md` (FB4/FD3 nå med i snapshotet).
- **2 — `docs/design-fasit-fb4-fd3` `c05897fe`** (🔴 ikke ff, base `af349b0e`): `docs/redesign/ordre-fasit-fb4-fd3-design-2026-09-20.md`. Trygghetsmålt: fila urørt på develop siden basen (0 commits), `merge-tree` → 0 konfliktmarkører. Ingen rebase.

**🔴 REN FLYTTING — verifisert med tall:** `git diff --numstat` på `mal-fasit.snap.md` = **`74 0`** (74 tillegg, **0 slettinger**). Ingen eksisterende maltekst endret; FB4/FD3-teksten er identisk, kun løftet inn i fasitens dekningsområde. `seed-bibliotek.ts` viser 92/88 (strukturell inline→export-flytting) — men snapshotens 0 slettinger er garantien for at innholdet er uendret.

**Gate — ALLE HELT stille, kjørt med `--force` (0 cached, ingen FULL TURBO):** db **111 uendret** (runden la ikke til testfil, bare innhold i eksisterende snapshot) · api 511 · pdf 124 · shared 834 · web 304 · mobil 34 · 7/7. Ingen migrering, ingen mobil-endring, ingen i18n, ingen SQL.

**🟡 MÅLT (ikke endret): FB4/FD3 er nå med i `malRegister()`** (kjente refs: FB4, FD1, FD2, FD3, FH1, FS2, FS3, KA7, KB2, KB4, KB6, KC3.1, KD1, KD2, KM2). Konsekvens: `generer-mal-sql.ts` **kan** nå produsere SQL for dem, og §7b-vakter kan se dem. Ingen effekt i denne runden (generator/SQL ikke rørt), men **kjør ikke generatoren mot FB4/FD3 før normkode-revisjonen er Kenneth-gatet**.

**🔴 FB4/FD3-fasithullet fra forrige runde er nå LUKKET.** Presisering: **normkodene i FB4/FD3-hjelpetekstene står fortsatt urettet** — det er bevisst, Kenneth-gatet. De rettes ved revisjon og vil da vises som ekte diff mot fasiten.

**SAMARBEIDSREGLER (samme commit):** ny regel «Gate-tall skal komme fra `--force`, ikke fra cache» lagt inn under § «GATE-TALL SKAL SI HVA SOM KJØRTE» — et FULL TURBO-treff er ikke en gate-kjøring; gaten er en observasjon, ikke et oppslag.

---

## 🟢 2026-09-20 — Malfasit + lokalt tekstbevis (skriv-mal) merget. Ingen migrering, ingen mobil, ingen SQL. develop `c1d51726`.

**To brancher, begge `--no-ff`, begge ff-mulig mot `af349b0e`:**
- **A — `feat/mal-fasit` `fa60f2b2`** (fire filer, alle `packages/db/prisma`): `mal-fasit.snap.md` + `mal-fasit.test.ts` (låser HELE maltekstene — hjelpetekster **og** alternativer, ikke bare etiketter; endres en tekst senere blir det en diff i `pnpm test`, ikke en stille passering) · `skriv-mal.ts` + `skriv-mal.test.ts` (skriver ut malen lokalt i §6a-form via `byggBibliotekRader`, uten DB/scp/docker/TTY).
- **B — `docs/design-malfasit` `b7bb1f4a`** (to filer): `docs/claude/MAL-METODE.md` §8/§8b + `docs/redesign/ordre-malfasit-design-2026-09-20.md`. Kenneth-gatet 2026-09-20.

**Runden legger et lag OVER seeden — `seed-bibliotek.ts` og `generer-mal-sql.ts` er URØRT.** Innholdsgaten går nå på **lokal utskrift** (`skriv-mal.ts`, låst av malfasiten), ikke på SQL mot test. **SQL mot test kjøres per RUNDE (ikke per mal), og alltid når `generer-mal-sql.ts`/`byggBibliotekRader` er endret** (MAL-METODE §8b, Kenneth-gatet).

**Gate — KUN db steg, alle andre HELT stille:** db 106→111 (**+5**, malfasit + skriv-mal-tester, to nye testfiler) · api 511 · pdf 124 · shared 834 · web 304 · mobil 34 · integrasjon 61 · 7/7. Ingen migrering, ingen mobil-endring, ingen i18n, ingen SQL.

**`docs/design-um1` + `docs/design-uu1` IKKE merget** — begge er allerede i develop (inn med `083ac0da` 19.09; verifisert med `git merge-base --is-ancestor` → ancestor). Å merge dem ville gitt tomme merge-commits.

**§4-verifisering utført:** `skriv-mal.ts` kjørt for FD1 (`pnpm --filter @sitedoc/db exec tsx prisma/skriv-mal.ts FD1`) — full §6a-utskrift kom (metadata + 13+ objektrader med type/label/alternativer/hjelpetekst). Scriptet virker, ikke bare grønn test.

### 🔴 HULL I FASITEN — `FB4` og `FD3` er inline-blokker, ikke dekket (2026-09-20)
- `FB4` og `FD3` ligger som **inline-blokker i F-arrayet** i `seed-bibliotek.ts`, ikke som eksporterte konstanter. Malfasiten dekker kun eksporterte `*_MAL`-konstanter → **teksten deres er fortsatt ULÅST**.
- Begge bærer **gamle normkoder i hjelpetekstene**.
- 🔴 **Ikke fikset — Kenneth avgjør timingen.** Ført her kun for at hullet skal være synlig. (design står alt på `docs/design-fasit-fb4-fd3`.)

---

## 🟢 2026-09-20 — FH1 + FS3 omkodet + samlerunder-docs merget. Del F ferdig omkodet. develop `d876932a`.

**To brancher:** `feat/mal-fh1-fs3` `00cd602f` (`seed-bibliotek.ts` + `fh1-mal.test.ts` + `fs3-mal.test.ts` + `generer-mal-sql.ts` + `generer-mal-sql.test.ts`) · `docs/design-samlerunder` `ba70270f` (`docs/redesign/tillegg-samlerunder-design-2026-09-20.md`). Begge `--no-ff`, begge ff-mulig mot `6b294d58`.

**Gate — KUN db steg, alle andre HELT stille:** db 83→106 (**+23**, FH1+FS3-tester) · api 511 · pdf 124 · shared 834 · web 304 · mobil 34 · integrasjon 61 · 7/7. Ingen migrering, ingen mobil-endring, ingen i18n.

**Del F er nå ferdig omkodet.** FH1 v2 (12 felt + 3 headings, nytt kapittel FH) + FS3 v2 (11 felt + 3 headings, i FS), begge tekstbevis ordrett (designgate 2026-09-20, Kenneth kjørte `fh1-fs3-test.sql` mot `sitedoc_test`). **Kildekapitlene FC og FE slettet (tomme — bevis viser 0 rader). Lån intakt, id bevart.** FC1/FE1-delen av den bevisste mellomtilstanden er dermed avviklet (FD3 under «Uttak av løsmasser» ikke nevnt i denne ordren — ikke målt her).

---

## 🟢 2026-09-20 — FD2 «Graving av grøft» (ny mal) + tre docs merget. Ingen migrering, ingen mobil-endring. develop `083ac0da`.

**Fire brancher, FD2 først:** `feat/mal-fd2-ny` `11f83fae` (`packages/db/prisma/seed-bibliotek.ts` + `fd2-mal.test.ts`) · `docs/design-um1` `1bb0409a` · `docs/design-uu1` `80bc8a55` · `docs/design-malplan` `eeda9440` (`docs/claude/MAL-PLAN.md`). Alle `--no-ff`.

**Branch 4 ikke-ff (base `3616d140`), merget etter to reproduserte trygghetsmålinger:** `git log 3616d140..origin/develop -- docs/claude/MAL-PLAN.md` → tom (develop hadde ikke rørt fila), og `git merge-tree` → 0 konfliktmarkører. Ingen rebase — historikk urørt.

**Gate — KUN db steg, alle andre HELT stille:** db 76→83 (**+7**, FD2-seedtest) · api 511 · pdf 124 · shared 834 · web 304 · mobil 34 · integrasjon 61 · 7/7. Ingen migrering, ingen mobil-endring, ingen i18n.

**Koden FD2 var ledig** etter at gamle FD2 ble omkodet til FS2 i mellomrunden. 🟡 **Bevisst mellomtilstand (ikke drift — ingen skal «rette» den):** FD3 under «Uttak av løsmasser», FC1/FE1 i gamle kapitler — venter egne omkodinger. Neste Del F: FH1 → FS3.

### 🔴 Guard i seed-SQL verifisert tannete i FELT (2026-09-20)
- `fd2-test.sql` ble kjørt **to ganger** mot `sitedoc_test` ved et **uhell**. **Vakten stoppet den andre kjøringen («FD2 finnes allerede») og rullet alt tilbake — ingen skade, ingen dublett.**
- 🔴 **Ført som bevis, ikke anekdote:** guarden ble testet av et uhell, ikke av en planlagt negativkontroll. **Det gjør beviset sterkere** — den ekte skrivestien traff vakten, ikke en konstruert test. Idempotens-guarden i seed-SQL-en er dermed verifisert i drift, ikke bare i teori.

---

## 🟢 2026-09-19g — FD1 (omkoding fra FB2) merget. Ingen migrering, ingen i18n. develop `5ac878ff`.

**To brancher, docs først:** `docs/design-fd1` (ordrefil, ikke ff — develops nye commits siden `f2867985` rører mobil/i18n/tavla, null overlapp med ny ordrefil; test-merge bekreftet) + `feat/mal-fd1-omkoding` (fem filer, alle `packages/db/prisma`). Begge `--no-ff`.

**Gate — KUN db steg, alle andre HELT stille:** db 51→65 (**+14**) · api 511 · pdf 124 · shared 824 · web 292 · mobil 21 · integrasjon 61 · 7/7. Ingen migrering, ingen i18n. **Prod-gaten røres ikke.**

### FD1 «Uttak av løsmasser» — Bygget ✓ / Gatet ✓ design (tekstbevis, ordrett mot ordren) 2026-09-19
- **Første OMKODING:** FB2 → FD1. **version 2**, 11 felt + 3 headings, nytt kapittel **FD «Uttak av løsmasser»**. **Id bevart — lånet er intakt.**
- `fd1-test.sql` kjørt **én gang** mot test og skal **ikke** kjøres igjen (gitignorert).
- 🟡 **KJENT MELLOMTILSTAND, bevisst (ikke drift — ingen skal «rette» den):** FB4 ligger fortsatt under «Markrydding», FD2 (fylling) og FD3 under «Uttak av løsmasser» — begge venter egne omkodinger. Neste Del F-ordre: **FD2 fylling → FS2**.
- 🔴 **§7b-vakten (`mal-7b.test.ts`) er nå K-filtrert** (FD1 ligger i `malRegister`, F-maler har egne vakter som `fd1-mal.test.ts`). Design godkjente. **Cowork verifiserte at vakten fortsatt FEILER på K-brudd:** injisert «Tabell K» i KA7-hjelpetekst → `KA7: ingen forbudte referanser` ble RØD. Filtreringen snevrer inn *hvilke* maler den ser på, ikke *hva* den krever. Meta-testen krever dessuten at alle 8 K-maler er til stede, så en K-mal kan ikke forsvinne stille ut av registeret.

---

## 🟢 2026-09-19f — Varig-grå Google-innloggingsknapp merget. OTA, ingen migrering. develop `1dace3b0`.

**`fix/innlogging-varig-graa` `--no-ff`.** **Ikke ff** — develop flyttet `f3c0affa → f2867985` (§7b-mergen) mens kontrollplan jobbet. **Cowork målte: ingen rebase nødvendig** — §7b rørte `mal-ns-standard-logg.md`/`packages/db/*`/tavla, branchen rører `apps/mobile/*` + `packages/shared/i18n/*`. Null filoverlapp → `--no-ff` gikk rent (test-merge bekreftet). **Branchen ikke rørt.**

**Gate — KUN mobil steg, alle andre HELT stille:** db 51 · api 511 · pdf 124 · shared 824 · web 292 · mobil 18→21 (**+3**) · integrasjon 61 · 7/7. `sperret.googleIkkeTilgjengelig` lagt i alle 15 språk uten at shared-tellingen (824) rører seg. **Reload: OTA.**

### Varig-grå innloggingsknapp — Bygget ✓ (kontrollplan)
- **Bug:** Google-innloggingsknappen på mobil kunne stå **død permanent** når `useAuthRequest` gir `request=null` (`logg-inn.tsx`). Nå forklarer den seg via `KnappMedForklaring` + ny helper `apps/mobile/src/utils/innlogging-sperre.ts` (+ vaktest rød→grønn).
- Ny nøkkel: `sperret.googleIkkeTilgjengelig` = «Google-innlogging er ikke tilgjengelig i denne versjonen».
- **Scope:** regelen utelater bevisst `laster` — spinneren er signalet der. **Kun Google-knappen** er i scope; Microsoft og test er kun disabled på `laster` og har ingen varig-grå-tilstand.

### 🔴 PROSESSFUNN — ordren lå kun i nudgen, ikke i fil (coworks brudd på SAMARBEIDSREGLER regel 11)
Ordren til kontrollplan lå **kun i nudgen**, ikke i en `relay/inbox-*.md`-fil. Den forsvant med kontrollplans `/clear` og måtte rekonstrueres fra tavla, BACKLOG og koden. **Det var coworks brudd** — regel 11 krever at ordren bor i fil, ikke bare i den flyktige nudgen. Herfra: hver ordre skrives til `relay/inbox-<navn>.md` FØR nudgen limes, uten unntak.

---

## 🟢 2026-09-19e — §7b-retting av fem maler merget. Ingen migrering, ingen i18n. develop `5cd113ab`.

**`feat/mal-7b-retting` `--no-ff`.** Branchen var **ikke fast-forward** — develop flyttet fra `c7349cd6` til `f3c0affa` (19d-runden, 6 docs-commits) mens mal-Opus jobbet. **Cowork målte: ingen rebase nødvendig** — develops nye commits rører kun `MAL-PLAN.md`/`docs/redesign/*`/`STATUS-AKTUELT.md`/`BACKLOG.md`, branchen rører `mal-ns-standard-logg.md` + fire `packages/db/`-filer. Null filoverlapp → `--no-ff`-merge gikk rent uten konflikt (test-merge bekreftet før commit). **mal-Opus' branch ble ikke rørt.**

**Gate — KUN db steg, alle andre HELT stille:** db 34→51 (**+17**) · api 511 · pdf 124 · shared 824 · web 292 · mobil 18 · integrasjon 61 · 7/7. Full `pnpm test` fra ROT grønn; db-tellingen verifisert direkte (51 passed). Ingen migrering, ingen i18n.

### §7b-retting KA7, KB2, KB4, KB6, KC3.1 — Bygget ✓ / Gatet ✓ design (tekstbevis) 2026-09-19
- **Ren tekstretting, ikke innholdsendring.** Antall felt og typer uendret. Designgatens bevis: alle fem på **version 2**, rader **11/12/12/13/11**, navn og beskrivelser med «Faglig grunnlag», **INGEN normkoder eller standardnavn i hjelpetekster eller alternativer** — standarden nevnes kun i beskrivelsen.
- 🟢 **Hele NS 3420-K-biblioteket (KA7–KM2) følger nå MAL-METODE §7b. Opphavsrettssaken er lukket for biblioteket.**
- Den gamle KC3.1-§7b-kø-raden (sto siden 18.09) er dermed lukket.
- Ny `mal-7b.test.ts` (§7b-vakt over K-malene) + utvidet `generer-mal-sql.ts`/-test. `7b-retting-test.sql` er kjørt **én gang** mot test og skal **ikke** kjøres igjen (gitignorert).
- 🔴 **Reelt funn rettet i samme runde:** NS-loggens «Reproduserbar sjekk»-SQL (`mal-ns-standard-logg.md`) spurte kolonnen `mal_innhold`, som har vært **fryst tom siden migrering `20260914120000`** (innholdet bor i `bibliotek_mal_objekter`). SQL-en returnerte derfor ingenting og kunne få en leser til å tro at malene var tomme. Nå rettet til `bibliotek_mal_objekter`. **Merk: dette var aldri en formell BACKLOG-post** (grep på `mal_innhold` i BACKLOG.md = 0 treff) — funnet bodde i loggfila. Ført lukket her.

---

## 🟢 2026-09-19d — To docs-brancher merget. Rene docs, ingen migrering, ingen kode. develop `7212edb3`.

**To docs-brancher, begge `--no-ff`, ingen felles filer, begge ff fra `c7349cd6`.** Ingen kode rørt → **gaten står HELT stille** (db 34 · api 511 · pdf 124 · shared 824 · web 292 · mobil 18 · integrasjon 61 · 7/7). Ingen test kjørt (docs-only).

### §7b-retting-ordre (`e3dc2566`) — KA7, KB2, KB4, KB6, KC3.1
- `docs/redesign/ordre-7b-retting-fem-maler-design-2026-09-19.md` + `MAL-PLAN.md`-loggrad. Tekst-only retting av fem maler; KC3.1 minimalt. Kenneth-gatet.
- **Allerede gitt mal-Opus via maløypa** (design → mal-Opus direkte), branch `feat/mal-7b-retting`. Merget her lukker den gamle KC3.1-§7b-raden i køen (sto siden 18.09).

### Statusfarger-paritet (`7212edb3`) — designnotat + ordre
- `docs/redesign/designnotat-statusfarger-paritet-design-2026-09-19.md` (én fargetabell web+mobil, fem farge-familier) + `ordre-...md`. **Kenneth-gatet § 8.**
- **To vedtak:** (1) `responded` er **blå** i lister, gul bare på detaljside for godkjenner. (2) 🔴 `in_progress` heter **«Under arbeid» for ALLE** — dette **overstyrer** runde-2-vedtaket 2026-08-02 (Q1=A: «Mottatt»). Ført som overstyring i § 8, ikke som parallelt vedtak.
- **Ordren relayes til redesign** (LEDIG) av cowork nå — omfang: `perspektivEtikett` (NOEYTRAL-eksport), web-`StatusBadge` + mobil `StatusMerkelapp`/`STATUS_MAP` utledes fra NOEYTRAL, mobil detaljsider tar i bruk `perspektivEtikett`.

**BACKLOG § 1:** ny post fra designs etterkontroll av kontraktssaken — `aria-label` `dokumentklasse.segmentTittel` sier «Dokumenttype», maldialogen sier «Dokumentklasse» (samme begrep, to ord).

---

## 🟢 2026-09-19c — KM2-mal + sperrede knapper merget. Ingen migrering. develop `b9d8ddec`.

**To uavhengige runder, KM2 først** (liten + isolert, så en feil i den store står alene i diffen). Begge `--no-ff`, null felles filer. Mellom 19b og denne: CLAUDE.md § «Commit + push» skrevet om + strammet (`496579d2`/`3dc7c9bc` — Opus pusher egen branch på grønn gate uten klarsignal; frys etter «klar for merge»).

**Gate — db og mobil steg, web og resten HELT stille:** db 25→34 (KM2 +9) · api 511 · pdf 124 · shared 824 · web 292 (stille) · mobil 16→18 (+2) · integrasjon 61 · 7/7. Prisma generate ×4 + web build (regel 10) + mobil typecheck — alle grønne.

**i18n (57-fils-runden — største flate på lenge):** 4627→4662 = **+35** i alle 15 filer, **identisk nøkkelsett**, **0 nøkler fjernet** (verifisert nøkkel-for-nøkkel mot `a59d0e44`; numstats «1 deleted» er komma-artefakten på `videresend.radAvsenderMedRolle`, ikke en sletting).

### KM2 «mur av stein i terreng» — Bygget ✓ / Gatet ✓ design 2026-09-19
- Tekstbevis: kapittel KM + mal lagt inn, version 1, 13 rader (overskrifter 1/5/10), 5 enkeltvalg + 5 trafikklys, **NULL tallfelt**.
- ⚠️ **Eneste tall i hele malen er definisjonen «300 mm»** — Kenneth-gatet unntak: det definerer *hva en mur er*, ikke *hvordan den utføres*. §5-testen beviser at unntaket er smalt.
- Seedkommentaren rettet til 14 maler. `km2-test.sql` kjørt mot test ÉN gang — skal IKKE kjøres igjen.

### Sperrede knapper — Bygget ✓ / Gatet ✓ design 2026-09-19
- 48 knapper kartlagt (web + mobil), 35 nøkler under `sperret.*`. Ny mobil-komponent `KnappMedForklaring`. Alle designs rettelser brukt.
- 🔴 **Fler-grunn-knapper velger forklaring etter hvilken grunn som faktisk slår til.** «Ingen endringer å lagre ennå» vises BARE når det virkelig ikke er endringer — ellers ville teksten lyve.
- **Betingelsene er urørt.** Vi forklarer *hvorfor* en knapp er sperret; vi endrer ikke *når* den er det.
- **Fire oppfølgere → BACKLOG § 1 Teknisk gjeld** (ingen blokkerende): 🔴 web-tsc-gjeld (papirkurv/page.tsx TS2589 + bibliotek-mal.test.ts TS2532 — CI kjører ikke web-tsc = hull i gaten) · «Kopier mal» i MalListe mangler forklaring · videresend-kommentar påkrevd uten å være merket · Google-innlogging mobil kan bli varig grå (kontrollplan har runden).

---

## 🟢 2026-09-19a — KD2-mal + NettverkProvider-selvheling merget. OTA (NettverkProvider), ingen migrering. develop `c1e29dc9`.

**Fire ting inne** (KD2 `--no-ff`, resten ff-kjede fra `5d4dabff`): maløype-docs (`5d4dabff`), NettverkProvider (`7d383605`), KD2-mal (merge `c1e29dc9`), `.gitignore /*-test.sql`.

**Gate — kun db og mobil steg, resten HELT stille:** db 14→25 (+11) · api 511 · pdf 124 · shared 824 · web 292 · mobil 14→16 (+2) · integrasjon 61 · 7/7. Prisma generate ×4 kjørt før gaten. Web build gir null signal (KD2-filene ligger i `packages/db/prisma/`, ikke i byggets flate; NettverkProvider er mobil-only).

### KD2 «Setting av kantstein» — Bygget ✓ / Gatet ✓ design 2026-09-19
- 🟢 **Første NYE mal i biblioteket**, og **første med den generelle generatoren** (`generer-mal-sql.ts <REF> <ny|revisjon>`) — erstatter det KD1-spesifikke skriptet som bevisst aldri ble committet.
- **Tekstbevis (design gatet på):** version 1 · «KD2 – Setting av kantstein» · «Faglig grunnlag» i beskrivelsen · 13 rader med overskrifter på 1/5/8 · 4 enkeltvalg, 5 trafikklys, 1 heltall · ingen normkoder, §7b oppfylt.
- ⚠️ **`kd2-test.sql` er kjørt mot test ÉN gang og skal IKKE kjøres igjen.**
- 🟢 **Første runde maløypa ble brukt:** design og mal-Opus gikk direkte, cowork fikk ÉN melding med branch, hash, filer og docs-branch. **Den fungerte.**

### NettverkProvider-selvheling — OTA (kun JS)
- Selvheler nå fastlåst `erPaaNettet`. To mekanismer gjennom samme `anvendTilstand()`: **AppState→active-refresh** (telefon låst under nett-overgang) + et **offline-BARE intervall på 20s** som river seg ned ved første online-probe → null batterikost online.
- 🔴 **MÅLT FUNN: `TimerSyncProvider` sitt 30s-intervall redder IKKE** — gated på `erPaaNettet` både i effekt-oppsettet (`:198`, river ned intervallet når false) og inne i `triggerSync` (`:167`), og kaller aldri `NetInfo.fetch()`. Samme sykdom, ikke kur. Ingen eksisterende mekanisme selvhelet tilstanden.
- `erPaaNettet` leses i 13 konsumentfiler; **fem fryser arbeid** (OpplastingsKoProvider, VaerKoProvider, TimerSyncProvider, skjema-sync i `useSjekklisteSkjema`/`useOppgaveSkjema`) — resten er ren UI-tilstand uten datatap.
- Valgte `isConnected`, ikke `isInternetReachable` (sistnevnte prober Googles connectivity-endepunkt, blokkerbart på anleggsnett selv når vårt API er nåbart; server-nåbarhet avgjøres av køens retry/backoff). Bevisst IKKE bygget: mount-fetch (`addEventListener` leverer initialtilstand ved subscribe).
- 🔴 **ÆRLIG (KRAV 4):** dette retter et **konkret strukturelt hull** — ikke bare «ingenting hindrer det» som forrige runde. HVIS årsaken var fastlåst `erPaaNettet`, lukker dette den og bounder frysen til ≤20s i forgrunn / umiddelbart ved opplåsing. **MEN kontrollplan har ikke reprodusert felt-hendelsen** og kan ikke bevise at stuck-false var årsaken; en tredje umodellert årsak kan ikke utelukkes. Selvhelingen er forgrunns-scopet. **IKKE ført som «kø-frysen løst».**

### `.gitignore`: `/*-test.sql`
- MAL-METODE sa mal-revisjons-SQL var ignorert; det stemte ikke — de var bare aldri `git add`-et. Verifisert før linja: ingen slik regel fantes, ingen slike filer i hovedtreet. Én linje gjør dokumentasjonen sann før noen committer en ved uhell.

---

## 🟢 2026-09-18i — KM2-ordre merget (ren docs) + tavla rettet + nudge-rutine

**Merge:** `docs/design-km2` `1056b302` → develop, ren fast-forward fra `3b32c646`. Diff = nøyaktig to filer: `docs/redesign/ordre-km2-ny-mal-design-2026-09-18.md` (ny) + `MAL-PLAN.md` (KM2-rad). Ingen kode → gate-tallene HELT stille (db 14 · api 511 · pdf 124 · shared 824 · web 292 · mobil 14 · integrasjon 61 · 7/7 — docs-only, ikke re-kjørt).
- 🔴 **KM2-ordren IKKE relayet** — én mal om gangen. KM2 går til mal-Opus først når KD2 er merget (begge rører `seed-bibliotek.ts` + `generer-mal-sql.ts`; KM2 skal ligge etter `KD2_MAL` og bruker KD2-generatoren). KM2 = kontroll mot beskrivelsen, **ingen tall** (normen har ingen utførelseskrav/toleranser for mur — Kenneth sett og godkjent).
- 🔴 **TAVLA RETTET — den løy:** kø-raden fremstilte KD2-relayet som gitt/aktivt («mal-Opus lager KD2-branchen … nå»). Målt av design: mal-Opus står fortsatt på `feat/mal-kd1-revisjon` @ `51caefda`, ingen KD2-branch, ingen KD2-filer. KD2-nudgen ble skrevet av cowork, men limt til feil økt — nådde ALDRI mal-Opus, og cowork førte «i arbeid» uten å måle. KD2 er ordret + committet, men IKKE startet; branch blir `feat/mal-kd2-ny`.
- 🟢 **NY RUTINE — SAMARBEIDSREGLER § Meldingsflyt rule 14** (design foreslo praksisen; regelteksten er coworks): den som skriver en ordre lager nudgen i sin EGEN melding, cowork svarer KUN «kan relayes» eller «vent». «Kan relayes» er samtidig § design pkt 2-gaten — cowork sier den først når han har sett hvilke filer ordren rører. Da finnes alltid nøyaktig én kjent nudge.

## 🟢 2026-09-18h — KD1-revisjon (første tekstbevis-gate) + KD2-ordre/§1b merget. WEB-DEPLOY (seed) for KD1, ingen migrering, ingen OTA.

**To brancher, bindende rekkefølge, begge ff fra `031105ed`.** 1. `feat/mal-kd1-revisjon` `51caefda` → `6bbfe0dc`. 2. `docs/design-kd2` `828ddd73` → `4fb25469`.
- 🟢 **KD1 «Belegg av stein og heller» — FØRSTE mal gatet på TEKSTBEVIS** (ikke skjermbilder). **Designgatens bevis:** version 2 · navn «KD1 – Belegg av stein og heller» · beskrivelse med «Faglig grunnlag» · **13 rader** med overskrifter på rad 1/5/9 · **6× enkeltvalg, 3× trafikklys, 1× heltall** · alternativer og hjelpetekster ord for ord mot ordren + TILLEGG 1 · ingen normkoder, **§7b oppfylt**.
- 🟢 **Teknisk gate (cowork):** skrivevei `opprettMalHvisMangler` URØRT (bekreftet i diff-kommentar + grep), hjelpefunksjoner (ingen hardkodet JSON), `verifisert: false` eksplisitt, prod-gate urørt (uverifiserte seedes ikke i prod). Gate: **`db` 7→14** (+7, ny `kd1-mal.test.ts`; kjørt lokalt 14/14 grønt). Alle andre HELT stille: `api` 511 · `pdf` 124 · `shared` 824 · `web` 292 · `mobil` 14 · `integrasjon` 61. Ingen migrering. *(«version 2» kommer fra `kd1-test.sql` Kenneth kjørte på test 18.09 — MAL-METODE §1b pkt 5 — ikke fra seeden; seeden er create-only.)*
- 🟢 **KD2 — designs FØRSTE leveranse etter den nye modellen.** Ren docs: KD2-ordre (kantstein), MAL-METODE **§1b** (felles regler for design + mal-Opus), MAL-PLAN KD2-rad. **Merget FØR relay (§ design pkt 2 — første praktiske bruk av regelen).** → KD2-relay lagt i Coworks kø.
- **Reload:** ingen (seed; eksisterende maler urørt til re-seed).
- ⚠️ `_gen-kd1-sql.ts` ble bevisst IKKE committet — KD2 leverer `generer-mal-sql.ts` generalisert; den KD1-spesifikke ville vært utdatert. Ikke etterlyst.

## 🟢 2026-09-18g — § design (rollen etter Fabel) innfletta i SAMARBEIDSREGLER + seks fabel-steder merket historiske. INGEN kode, ingen deploy, ingen OTA.

**Kilde:** `relay/forslag-samarbeidsregler-designrollen-2026-09-18.md` (gitignorert), Kenneth-godkjent v2 i sin helhet.
- 🟢 **Nytt § design** flettet inn i SAMARBEIDSREGLER rett etter § Roller (før «redesign-Opus»-seksjonen). Sitatblokken (seks punkter: eget worktree · ingen relay før cowork har sett filene · egen innboks `inbox-design.md` · faste gate-ord · bevis agenten kan levere · uenighet maks én runde) tatt inn **ordrett** — verifisert byte-identisk mot kilden (`diff` tomt).
- 🟢 **Seks fabel-steder merket historiske (ikke slettet):** SAMARBEIDSREGLER § Leveranser fra fabel · meldingsflyt `fabel → …/Fra fabel/til-repo-*` · § Dokument-eierskap · `informasjonsflyt-fabel-cowork.md` (øverst) · MAL-METODE «Hvor fabels ordrer lander» + «fabel snakker aldri direkte». Banner-linje øverst i hvert.
- 🟢 **To steder navnebyttet (gjelder fortsatt):** roller-raden `fabel` → «design (tidligere fabel)» · «redesign-Opus»-seksjonens overskrift + generell regel → design. **Det daterte 04.09-tilfellet forblir «fabel»** (det VAR fabel — historisk faktum).
- 🟢 **Tavla:** `fabel`-raden erstattet av **design** (`SiteDoc-design`, `docs/design-<emne>`-brancher, plan-sporet). 🔴 **Worktreet finnes ikke ennå — Kenneth oppretter det** (`git worktree add ~/Documents/Programmering/SiteDoc-design -b design-base origin/develop`).
- 🔴 **`relay/KONVENSJON.md` er GITIGNORERT — IKKE rørt.** Tre steder der inne peker fortsatt på fabel (:21 regel 7, :36 «Unntaket = fabel», :44 «fabel → cowork»). **Kenneth retter dem selv i hovedtreet** — en endring herfra når ingen.
- MAL-METODE/MAL-PLAN fabel→design-swap er valgfri («når filene uansett røres») — IKKE gjort denne runden (utenfor ordren).

## 🟢 2026-09-18f — Docs-runde: tekstbevis erstatter skjermbilder + BACKLOG #23. INGEN kode, ingen deploy, ingen OTA.

**Tre commits, alle docs.** 1. `ef8f1d9b` — design-rollens tre filer overført fra hovedtreet (mal-Opus var BLOKKERT på TILLEGG-2): MAL-METODE §3/§6/§6a — **tekstbevis fra revisjons-SQL erstatter skjermbilder** (mal-Opus har verken innlogget nettleser eller simulator); hver revisjons-SQL **øker `bibliotek_maler.version` med 1** og skriver ut hele malinnholdet før `COMMIT` (tekstbeviset gaten kjøres på); MAL-PLAN oppskrift pkt 7; TILLEGG-2 (ny). **Felle-note tilføyd (autorisert av ordren):** `versjon String` (schema:2313) er død for versjonsvisning, `version Int` (schema:2320) er badge-kilden (`versjonerBak`, `MalListe.tsx:654`) — feil felt gir stille feil. 2. `919897ff` — BACKLOG #23 «Malinnhold som tekst» (superadmin-visning m/kopier-knapp, Kenneth-godkjent, ikke nå; erstatter §6a-utskriften når den finnes). 3. denne.
- De to andre untrackede hovedtre-filene (TILLEGG-kd1-egne-krav, ordre-kd1-revisjon) er ALT i develop og byte-identiske — IKKE committet på nytt (verifisert `git diff` = tomt). Kenneth rydder dem selv.
- 🔴 **`feat/mal-kd1-revisjon` MERGES IKKE** — fortsatt ikke designgatet. Gaten kjøres nå på **tekstbevis**, ikke skjermbilder: mal-Opus lager `kd1-test.sql` på nytt per TILLEGG-2, Kenneth kjører den og limer utskriften til design-rollen.

## 🟢 2026-09-18e — §7b opphavsrett (design-docs) + KC3.1 9→8 «sesongfelt ut» merget. WEB-DEPLOY (seed), ingen migrering, ingen OTA.

**Tre commits, alle på develop.** 1. `9c83f547` — design-rollens fire filer overført fra hovedtreet (mal-Opus var BLOKKERT på dem): MAL-METODE **§7b** (malene er SiteDocs egne sjekklister, skal ikke fremstå som NS 3420 — opphavsrett; navn = kode + egne ord, ingen tabell-/punktkoder i hjelpetekster, «Faglig grunnlag: NS 3420-K:2024, post <kode>» én gang i beskrivelsen), **§6a** rettet (revisjons-SQL treffer `bibliotek_mal_objekter`, ikke `mal_innhold` — feil i metoden siden 14.09), **§5** KD2/KM2 foran Del F; MAL-PLAN statustabell remålt mot develop. 2. `37e98b0c` — merge `fix/kc31-sesongfelt-ut` (KC3.1 9→8 felt: sesongkontroll-feltet fjernet fra `seed-bibliotek.ts`, omdøpt konklusjon beholdt). 3. `2073ffc0` — bindende vedtak oppdatert: sesongfeltet ER fjernet (hash).
- Gate: **`db` 8→7** (−1, testtilfellet fjernet MED feltet — uvanlig retning, bekreftet ved kjøring: `db`-test 7/7 grønt lokalt). Alle andre HELT stille: `api` 511 · `pdf` 124 · `shared` 824 · `web` 292 · `mobil` 14 · `integrasjon` 61. Branchen rørte kun `packages/db` (seed+test) + to docs-filer.
- 🔴 **§7b-KONSEKVENS FOR KC3.1 (nettopp merget) — i køen, IKKE fikset:** malens undertittel «NS3420-K KC3.1 — Oppstøtting og oppbinding» er normens egen overskriftstekst. Under §7b skal navnet være **kode + egne ord**. KC3.1 trenger en §7b-runde → Coworks kø, mal-Opus.
- **Reload:** ingen (seed; eksisterende maler urørt til re-seed).

## 🟢 2026-09-18d — KC3.1 niende felt + flytvalg etter «Hent fra arkiv» merget. WEB-DEPLOY, ingen migrering, ingen OTA.

**To brancher** (`feat/kc31-niende-felt` `41835523` · `feat/hent-fra-arkiv-flytvalg` `c7049531`, begge ren ff, null felles filer). Gate (etter `prisma generate` ×4): **`db` 7→8** (+1) · **`web` 285→292** (+7). Alle andre HELT stille: `api` 511 · `pdf` 124 · `shared` 824 · `mobil` 14. 7/7. ⚠️ De 6 lokale typecheck-feilene (maskin/service.ts + bibliotek-mal.test.ts) var **stale db-maskin Prisma-klient** etter service-migreringen — borte etter `generate`, verifisert grønn. Ingen migrering.

- 🟢 **KC3.1 rettet 8→9 felt:** nytt «Kontrollert etter 1. vekstsesong – etterstrammet/justert» (trafikklys) i ETTER-fasen; siste felt omdøpt til «Krav oppfylt og dokumentasjon levert». **Skriveveien `opprettMalHvisMangler` fortsatt URØRT.** Testen låst på 9, sett rød mot dagens 8.
- 🔴 **ÅPENT (meldt av mal-Opus) — grenseoppgang for Kenneth:** konklusjonens hjelpetekst sier fortsatt «Etterfølgende sesongskontroll … er vedlikehold (egen post) — ikke del av denne sjekklisten», mens **rad 9 nå ER en sesongkontroll.** mal-Opus rørte den ikke (ordre: «alt annet uendret»). **Kenneth avgjør grensen.**
- 🔴 **ÅPENT:** hjelpeteksten på det nye feltet er mal-Opus' egen formulering, **ikke avlest fra Kenneths skjerm** — Kenneth kan overstyre.
- 🟢 **Flytvalg etter «Hent fra arkiv»:** etter at en mal hentes fra **FIRMA-arkivet** til et prosjekt, åpnes «Velg dokumentflyt» lagvis over hent-modalen, med «Velg» og «Hopp over» **likestilt**. Fler-velger (`DokumentflytMal` har `@@unique([dokumentflytId, templateId])` = mange-til-mange), gjenbruker `FaggruppeTilknytningModal`. **Steget skjules helt når prosjektet ikke har dokumentflyter** (et «Velg» til tom liste er blindvei).
- 🔴 **PREMISS-KORRIGERING (målt av redesign):** Kenneth ba om «begge arkiver», men det er **schema-umulig for SiteDoc-lån**: `laanFraSentralarkiv` lager en firma-`OrganizationTemplate` UTEN `projectId`, mens `Dokumentflyt`/`DokumentflytMal` er prosjekt-scoped (`schema.prisma:1541/1608`). Kravet oppfylles **indirekte**: enhver mal som faktisk entrer prosjektet gjør det via `kopierTilProsjekt` — også en lånt SiteDoc-mal (lånes først til firmaarkivet, hentes deretter til prosjektet).
- 🟢 **Ingen nye i18n-nøkler** — `maler.velgDokumentflyt`, `handling.velg`, `handling.hoppOver` fantes alle.
- ⚠️ **EDGE, meldt:** flyter uten `faggruppeId` vises ikke i velgeren (pre-eksisterende picker-atferd).

## 🟢 2026-09-18c — KC3.1-port + kø-mutex-herding merget. Kø-fiks OTA (kun JS), ingen migrering.

**To brancher** (`feat/kc31-port` `48fc5dfc` · `fix/opplastingsko-finally` `b95c88ac`). Gate: **`db` 2→7** (+5, KC3.1-testen) · **`mobil` 13→14** (+1, kø-vaktest). Alle andre HELT stille: `api` 511 · `pdf` 124 · `shared` 824 · `web` 285. 7/7. Ingen migrering.

- 🟢 **KC3.1-PORT levert (lukker GLEMT-ARBEID fra branch-kartleggingen):** KC3.1 «Oppstøtting av trær» revidert 4→8 felt (NS 3420-ZK2.7112) — portet på **dagens objekttabell-arkitektur**. **Skriveveien `opprettMalHvisMangler` er URØRT** (create-only bevart, `BibliotekMalObjekt`-radskriving ikke reversert — verifisert i merge-diffen). Testen låser 8 felt, sett rød mot dagens 4-felt-tilstand. **Den gamle `feat/mal-kc31-revisjon` (stale arkitektur) er nå overflødig.** [BACKLOG § KC3.1-PORT](BACKLOG.md) → 🟢 LØST.
- 🟢 **Kø-mutex herdet — men IKKE en bevist feil rettet (ærlig framing):** `try/finally` erstatter åtte spredte nullstillinger av `prosessererRef`; rekursjonen flyttet ut av `try`, etter `finally`. Vaktest kjører ekte `prosesserNeste` med mocket drizzle (uten `finally`: rød, med logg «prosesserer: true» som bevis på at rekursjonen traff guarden). 🔴 **kontrollplan fant INGEN vei der `prosessererRef` faktisk blir stående — fiksen HERDER, den løser IKKE den observerte kø-frysen.**
- 🔴 **HOVEDFUNN til egen runde — sannsynlig rotårsak til kø-frysen:** `NettverkProvider` har **ingen selvhelende mekanisme**. `erPaaNettet` settes **kun** av `addEventListener` — ingen `NetInfo.fetch()` ved mount, ingen `AppState`-sjekk, ingen polling. En **tapt reconnect-hendelse** låser `erPaaNettet = false` permanent og fryser køen. Forklarer «online, men fryst» bedre enn mutex-stien. **Egen runde kommer** ([BACKLOG § KØ-FRYS](BACKLOG.md) oppdatert).
- **Reload:** OTA på kø-fiksen (kun JS). KC3.1 er seed (ingen reload-krav for eksisterende maler).

## 🟢 2026-09-18b — Dobbel «Type» i mal-dialogen rettet. WEB-DEPLOY, ingen migrering, ingen OTA.

**Én branch, `fix/mal-dialog-dobbel-type`** (`dde98b07`, ren ff fra `6e78d56d`). Gate: **`web` 270→285** (+15, én testcase pr. språk). Alle andre HELT stille: `db` 2 · `api` 511 · `pdf` 124 · `shared` 824 · `mobil` 13. 7/7. i18n: nøkkeltallet **UENDRET 4627** i alle 15 — kun *verdien* av `mal.type.tittel` endret (+1/-1 pr. fil, ingen nøkkel lagt til/fjernet). **Null apps/api-filer rørt** → redesigns 14 lokale `projectGroup.create`-feil er miljø (umigrert lokal integrasjons-DB), ikke kode; CI mot fersk pgvector er fasit (integrasjon 61).

- 🟢 **Dobbel «Type» rettet.** To akser bar samme navn: det **gamle låste** feltet styrer dokument-**FORM** (oppgave/sjekkliste/HMS — hvilken tabell dokumentet havner i); det **nye** styrer dokument-**KLASSE**. redesign omdøpte SIN EGEN overskrift (`mal.type.tittel`) til **«Dokumentklasse»** og lot det låste feltet stå.
- 🟢 **Låsen på det gamle feltet har reell grunn (målt):** opprett-modalen leser kontekst (hardkodet `readOnly`), rediger-modalen låser når `harDokumenter` — å bytte form etter at dokumenter finnes ville **foreldreløst dem i feil tabell.**
- 🟢 **Testen er en i18n-INVARIANT, ikke render-test:** form- og klasse-overskriften kan aldri løse til samme streng, i alle 15 språk. Leser JSON, ingen DOM — bevisst for å unngå skjørhet.
- 🟢 **FUNN, rettet som bieffekt:** fransk `mal.type.tittel` sto som **«Taper»** (verbet «å taste», ikke substantivet) → «Classe de documents».
- ⚠️ **MELDT, IKKE FIKSET — PRE-EKSISTERENDE dobbel «Type» i HMS-fanen:** den gamle låste Type-blokken er ikke guardet mot HMS, så den vises sammen med `hms.subdomain.label="Type"` i `erHms`-blokken. **Gatet HMS-område, urørt** (egen runde).

## 🟢 2026-09-18 — Service pr. timetall (kundeønske #1) merget. ✅ DEPLOYET TIL TEST 01:12 MED MIGRERING (db-maskin), ingen OTA.

**Én branch, `feat/service-timetall`** (`2926b625`, ren ff fra `fad2e71e` — ingen rebase). **🔴 Første migrering siden push_token:** `20260918120000_service_timetall` (db-maskin). **Verifisert additiv:** 2× `ADD COLUMN` (nullable), 2× CHECK-constraint (>0 eller NULL), 1× CREATE INDEX — **NULL DROP/TRUNCATE/DELETE i hele diffen.** Gate: **`api` 503→511** (+8) · **`pdf` 120→124** (+4) · **`web` 264→270** (+6) · **`integrasjon` 59→61** (+2, CI). `db` 2 · `shared` 824 · `mobil` 13 HELT stille (null mobilfiler rørt). 7/7. i18n: alle 15 filer **4585→4627** (+42/-0, identisk sett).

- 🟢 **Kundeønske #1 levert (pilot-delene):** serviceintervall pr. maskin i maskinens innstillinger · servicelogg med skrivevei til `ServiceRecord` · automatisk fremskriving · terskelvarsel (`service-varsel-niva.ts`) · PDF-utskrift (`packages/pdf/service-rapport.ts`). **Del E (sjekkliste med avkrysning) er UTENFOR pilot-scope** (Kenneth).
- 🟢 **«Neste service» bor BEGGE steder — bevisst, følger husets EU-kontroll-mønster:** `ServiceRecord` bærer **historikk**, ny `Equipment.nesteServiceTimer` bærer **gjeldende tilstand** (denormalisert fra fremskrivingen) — nøyaktig som `Equipment.euKontrollFrist` ligger ved siden av `ServiceRecord type="eu_kontroll"`. **Ikke en ny struktur.**
- 🟢 **BACKLOG-raden var beviselig FEIL og er rettet (i branchen):** premisset sa `nesteServiceTimer` lå på `ServiceRecord` — det gjorde den ikke (lå ingen steder), var **aldri skrevet og aldri lest**, og `ServiceRecord` hadde **ingen produkt-skrivevei**. (Samme feilklasse som «stille tomhet»: en påstått kobling ingen leser hadde.)
- 🟢 **ci.yml-endringen fulgte med og er merget:** integrasjonsjobben migrerte kun `@sitedoc/db`; kontrollplan la til `@sitedoc/db-maskin migrate deploy` fordi den nye `service-timetall.integration.test.ts` rører maskin-Prisma. **Reelt CI-hull, ikke scope-kryp** — flagget av ham, godkjent av cowork.
- ✅ **DEPLOYET TIL TEST 01:12 MED MIGRERING:** `20260918120000_service_timetall` mot `db-maskin` er KJØRT — Service-seksjonen viser data med korrekt fremskriving. (Prod gjenstår — Kenneth gater.)

## 🟢 2026-09-17c — Kontraktssak runde 1 merget. WEB+API-DEPLOY, INGEN migrering (schema kun kommentar), ingen OTA-krav.

**Én branch, `feat/kontraktssak-runde1`** (`0542d39b`, alt rebaset på dagens develop `1ea48a10` — **trengte ikke rebase**; ordrens `36539f74`/base `250dfc7f` var stale). Gate: **`api` 495→503** (+8, `mal-subdomain-validering.test.ts`) · **`integrasjon` 57→59** (+2, `kontraktssak.integration.test.ts`, bekreftes i CI). Alle andre HELT stille: `db` 2 · `pdf` 120 · `shared` 824 · `web` 264 · `mobil` 13. 7/7.

- 🟢 **Kontraktssak runde 1 levert** — **visuelt skille i Oppgaver via `subdomain="kontrakt"`** (web + mobil oppgaveliste/-detalj), **klassen erklært på malen** (`ReportTemplate.subdomain`). Lovlige `(domain, subdomain)`-par eies av `LOVLIG_SUBDOMAIN` i `mal.ts:169` (`bygg → kontrakt`); `valideerSubdomainKombinasjon` (`mal.ts:193`) avviser kontrakt under HMS. **VEDTAK 17.09: `subdomain` i runde 1, `domain` i runde 2** (domain-endring blokkert av dokumenter, VAR-001).
- 🟢 **INGEN migrering** — `schema.prisma`-diffen er **kun `//`-kommentar** på `subdomain`-feltet (felt-def byte-identisk), verifisert i diffen.
- 🟢 **i18n: alle 15 filer nøyaktig +13 nøkler, identisk sett, `-0` slettinger** — ingen verdi tapt i mergen (kontrollert bevisst, ikke bare nøkkelsett-testen).
- ⚠️ **PDF-labelen «Kontraktssak» er bevisst hardkodet norsk** (`sammenstilling.ts`, `dokumenttype`) — **arkiv-PDF-pakken er ikke i18n** (presedens `grensesnapshot.ts:22`).
- ⚠️ **Api-feilmeldingen er hardkodet** — `apps/api` har ingen i18n-rigg.
- 🔴 **kontrollplan bygger service/timetall og skal inn i `nb.json` ETTER dette.** Develop-hash å fetche FØR i18n røres føres ved push.

## 🟢 2026-09-17b — To docs-brancher merget + branch-kartlegging ført. Ingen kode, ingen deploy, ingen migrering.

**To rene docs-brancher inn på develop** (`docs/arkitektur-syntese-drift-2` `a1716dcc` · `docs/maaling-kundeonske-1` `391c0aaf`). **Gate står HELT stille** (ingen kode/test-fil rørt): `db` 2 · `api` 495 · `pdf` 120 · `shared` 824 · `web` 264 · `mobil` 13 · `integrasjon` 57 · 7/7.

- 🟢 **mal-Opus:** `arkitektur-syntese.md` — tre drift-rader lukket med positiv kontroll mot `250dfc7f`: § 4 firma-modeller (alle fire bygget, `schema.prisma`-linjer), HMS-statistikk på firma-nivå (`hms.hentFirmaOversikt`), footer remålt (7 av 8 datamodell-steg bygget; PSI-utvidelsen steg 5 IKKE bygget; hel-Fase-0-status 🟡 usikker — egen runde).
- 🟢 **kontrollplan:** ny `delplaner/maaling-kundeonske-1-2026-09-17.md` — målingen som veltet BACKLOG-raden om service↔timetall (kundeønske #1).
- 🟢 **BRANCH-KARTLEGGING GJORT** (seks umergede origin-brancher, bevis: `git cherry` patch-ekvivalens + 3-punkts diff):
  - 🟢 **DØD** (patch alt i develop, ingen unik rest): `ci/e2e-del2` · `fix/e2e-dedrift` (begge superseded — develops e2e-CI gikk videre til 05/07) · `feat/versjonssporing-softdelete` (begge migreringer + schema + firmamal soft-delete i develop via 17.09-mergen; **rettet memo-drift** — sto som «pending»).
  - 🟡 **GLEMT ARBEID:** `feat/mal-kc31-revisjon` — unik KC3.1-revisjon (8 felt mot NS 3420-ZK2.7112), men bygget på stale seed-arkitektur → **skal PORTES, ikke merges** (festet i [BACKLOG § KC3.1-PORT](BACKLOG.md)).
  - 🟢 **DØD kode / 🟡 måling beholdt:** `wip/diag-exif` (EXIF-fraværsårsaker) · 🔴 `wip/diag-ko-trigger` (kø-frys mens online — ÅPEN) — begge `__DEV__`, funnene festet i [BACKLOG § WIP-diagnostikkbranches](BACKLOG.md).
  - 🔴 **Ingen branch slettet — Kenneth gater.** Tre funn festet i BACKLOG først (eneste bærer).

## 🟢 2026-09-17 — Docs + redesign merget: død Opprett-knapp forklart + seedeveien + design-leveranser. WEB-DEPLOY (redesign), ingen migrering, ingen OTA.

**To brancher + design-leveransene inn på develop** (`docs/seederegler-runbok` `db80c755` · `fix/dokumentflyt-navn-primaert` `4568387e`). Gate: `pnpm test` **7/7** — **`web` 261→264** (+3 `knapp-med-forklaring.test.tsx`). Alle andre HELT stille: `db` 2 · `api` 495 · `pdf` 120 · `shared` 824 · `mobil` 13. `integrasjon` uendret 57 (redesign rørte null api/db, skal stå 57 i CI). `prisma generate` ×4 kjørt før test. ⚠️ Pre-eksisterende `tsc`-rød på `bibliotek-mal.test.ts:25-26` (ikke fra denne runden).

- 🟢 **DØD OPPRETT-KNAPP FORKLART** — navnefeltet løftet til primært (fet `<label>` + rød påkrevd-`*`, `htmlFor`/`useId`, `aria-required`), `BundetFlytVelger` dempet minimalt (valgt-fyll beholdt som funksjonell indikator, radiovalg/ordlyd/anker urørt), tooltip via `@sitedoc/ui` på både «Opprett» og «Legg til faggruppe». Rekkefølge urørt. **Utløst av at Kenneth selv ble stoppet av sin egen flate under bundet flyt-gaten.**
- 🔴 **MÅLT FUNN:** `pointer-events:none` på et disabled barn **bryter hover på wrapperen** (0 fyringer) — den vanlige folkloren er feil her. **Verifisert i ekte Chrome, ikke antatt;** derfor satt bevisst IKKE. Kontrakten er `aria-describedby` (test satt rød: fjernet wrapper → 2 av 3 falt).
- 🟡 **20+ andre disabled-knapper mangler forklaring.** `KnappMedForklaring.tsx` er gjenbrukbar for dem — **egen runde** (meldt, ikke fikset).
- 🟢 **DEPLOY-RUNBOK § 7 «Seeding mot test»** — `scp` → `docker cp` → `psql` (steg 1 agent, 2–3 Kenneths TTY; `-d sitedoc_test`≠`-d sitedoc`; legg-til-aldri-slett; `.ts`-seeds ikke på server; `SEED_CONFIRM_DB`-vakt). ⚠️ **Merket IKKE re-verifisert etter serverendringene 17.09.**
- 🟢 **`LOKALT-OPPSETT.md:48` rettet** — «kjøres av Kenneth på server-ny» stemte ikke; nå SSH-tunnel + peker RUNBOK § 7.
- 🟢 **SJA-GATEN LUKKET** — «etterkontroll, delvis dekket». **Flate 3 (signer egen rad) IKKE DEKKET** («la SJA være»). simulator → ⚪ LEDIG. Prod-hash rettet til release-merge `ad18df93`.
- 🟢 **DESIGN-ROLLENS LEVERANSER INN** — kontraktssak runde 1 (designnotat + mockup 4 `.dc.html` + `support.js` + ORDRE ikke gitt ennå), `domain`-svaret, DESIGNSYSTEM-AUDIT, FABEL-KATALOG, § Feltstatus i `ui-standarder.md` (Kenneth-gatet). SJA-ordrefila fikk hovedtreets NYERE versjon (flate 3 valgfri), ikke dublett.
- 🔴 **VEDTAK, design-rollen 17.09:** kontraktssak bruker `subdomain` i runde 1, `domain` i runde 2. **Coworks anbefaling om `domain` nå var FEIL:** `mal.ts:460-472` blokkerer endring av `domain` når malen har dokumenter — VAR-001 finnes, så konvertering var ugjennomførbar.
- 🟢 **redesign var fra eldre base** (`70c1e556`) **og force-pushet** (ordrens `adfe0596` utdatert, faktisk tipp `4e123b9a`). **Merge gikk KONFLIKTFRITT — ingen rebase nødvendig;** redesigns utdaterte docs-endringer (SJA-ordrefil-opprett + gammel tavla) ble auto-superseded av develops nyere versjoner.

## 🟢 2026-09-17 — Pushvarsel runde A merget (`1d66e148`): datalag + sendetjeneste. API-DEPLOY + MIGRERING (IKKE KJØRT), ingen OTA.

**Én branch, `feat/push-datalag`.** Kontrollplan hadde alt rebaset den oppå dagens develop (`feddad76`) og force-pushet før handoff — **hash `b1275423`, ikke `2e7f5434` som ordren sa; ren fast-forward, ingen rebase nødvendig.** Gate: `pnpm test` 7/7 — **`api` unit 490→495** (+5: pushVarsel + push-token) · **`integrasjon` 51→57** (+6, bevist i CI: `57 passed`). **`mobil` STÅR STILLE på 13** (fra bundet-flyt-mobil — ikke mistet). Resten stille (`db` 2 · `pdf` 120 · `shared` 824 · `web` 261). Begge CI-jobber grønne, fersk pgvector anvendte alle migreringer inkl. den nye.

- 🟢 **PUSHVARSEL RUNDE A LEVERT** — `PushToken`-tabell (`push_tokens`) + migrering, sendetjeneste via `expo-server-sdk ^7.2.0`, nåbarhets-telling, logg i `activity_log` (`action="push.sendt"`). **Ingen UI, ingen i18n.**
- 🟢 **`User` er HELT urørt** — `user_id` er svak String-FK uten `@relation`, samme mønster som `activity_log`. `schema.prisma`-diff mot develop = **0 slettinger** (30 tillegg). Migrering = **én `CREATE TABLE` + to indekser** (UNIQUE på `token`, indeks på `user_id`), ingen eksisterende tabell endret.
- 🟢 **Nåbarhets-tellingen er poenget:** en formann skal ikke tro at 50 mann fikk beskjed når 12 gjorde det. `naabarhet()` returnerer `{valgt, naabare, utenToken[]}`.
- 🟢 **Døde tokens ryddes KUN på `DeviceNotRegistered`** — forbigående feil (`MessageRateExceeded`, `InvalidCredentials`) fjerner ingen enhet. Token = enhetens identitet, `userId` = hvem som sitter der nå (upsert på token, «siste innlogging vinner»).
- 🔴 **PUSH KAN IKKE TESTES I EXPO GO ELLER SIMULATOR.** Ende-til-ende-validering av runde B koster minst ett iOS- + ett Android-bygg; iOS forutsetter APNs-nøkkel i EAS FØRST, Android krever Firebase-prosjekt (FCM V1).
- ⚠️ **FUNN — lokal sandkasse blokkert:** `20260906000000_sja_signaturrunder` feilet 09-09 og stopper `prisma migrate deploy` lokalt. **Femten migreringer ligger etter den.** CI upåvirket (fersk pgvector). Ikke rørt — DB-tilstand er Kenneths. **Neste agent som kjører integrasjonstester lokalt treffer dette.**
- ⚠️ **`varsling.md` mangler statusmarkør og er skrevet i presens om fem modeller som ikke finnes.** Sett av kontrollplan (la inn peker «modellene i denne fila er IKKE bygget», rettet ikke resten). **Cowork ordrer oppfølgeren.**
- 🟢 **BASE-FELLA UNNGÅTT:** ordren advarte at kontrollplans tall var målt mot `50fd9893` (to merger gammel). Målt selv: branchen var alt rebaset på `feddad76`, så fasit holdt — `integrasjon 57` (ikke 54 = mistet bundet-flyt-mobil, ikke 51 = mistet kontrollplan).
- 🔴 **UTLØSER api-deploy + MIGRERING — Kenneth eier begge. Klart, ikke kjørt.**

---

## 🟢 2026-09-17 — Tre brancher merget (`f6ed59f1`): bundet flyt mobil · fasetabell remålt · ordreformat presisert. WEB+API-DEPLOY + OTA, ingen migrering.

**Tre fast-forward-brancher fra `50fd9893`, null felles filer:** 1. `docs/ordreformat-kopierbar` (SAMARBEIDSREGLER) · 2. `docs/remaaling-fasetabell` (arkitektur-syntese) · 3. `feat/bundet-flyt-mobil` (ett api-felt × 2 routere + mobil + tester). Merget i den rekkefølgen så #3 står alene i diffen. Gate: `pnpm test` 7/7 — **`mobil` 9→13** (+4: flytbytte-visning, inkl. testen som feiler hvis «Bytt flyt» vises for en bundet flyt). **`integrasjon` 48→51** (+3: `gjeldende.bundet` returneres i begge routere). Resten HELT stille (`db` 2 · `api` unit 490 · `pdf` 120 · `shared` 824 · `web` 261). De to docs-branchene flyttet ingen tall. Begge CI-jobber grønne.

- 🟢 **BUNDET FLYT ER KOMPLETT PÅ BEGGE FLATER** — web kom i `ba7f6c0f`, mobil nå. Ett felt (`bundet`) lagt til på `gjeldende` i begge routere; **`kanByttFlyt`/`andre`/`kanFlytte` urørt — verifisert mot develop etter merge (api-diff rent additiv, 0 slettede linjer på rettighets-felt)**. Mobil skjuler «Bytt flyt» og viser fotnoten med anker i stedet.
- 🔴 **HULLET SOM BLE LUKKET:** serversperren fantes og var testet, men mobil kunne ikke vite at en flyt var bundet — «Bytt flyt» var levende og feilet mot serveren uten forklaring. Fotnotens poeng («det gjelder alle i prosjektet, ikke bare deg») fantes bare på web.
- 🟢 **Test som feiler hvis «Bytt flyt» vises for en bundet flyt** — sett rød først (`!egenFlytBundet`-vakten fjernet → testen falt). Integrasjon (5)+(6) sett rød på samme vis. Gjenbrukte `videresend.bundetFotnote` — ingen nye i18n-nøkler. `Anchor` verifisert i `lucide-react-native`.
- 🟢 **FASETABELLEN REMÅLT mot `50fd9893`** — syv «Mangler»-påstander målt mot kode. Fase 2 arkivert som ferdig, Fase 7 markert delvis.
- 🔴 **FUNN: «HMS-statistikk på firma-nivå» sto som «Mangler — Fase 7». Den er bygget** (`hms.hentFirmaOversikt`, `firma/hms/page.tsx`, fem i18n-nøkler). Ettermålt av cowork.
- 🟡 **Godkjenning-modellen er DØD:** finnes i skjemaet, `prisma.godkjenning` = 0 treff i api. Ingen router, ingen flate. Ført som DELVIS, ikke «ferdig».
- ⚠️ **MELDT, IKKE GJORT — tre rader til i `arkitektur-syntese.md` har drevet:** `:318` lister `OrganizationTemplate` som manglende (den finnes) · `:573` gjentar HMS-statistikk-feilen · `:615` sier Fase 0-koding ikke kan starte. **Cowork ordrer oppfølgeren.**
- 🟢 **ORDREFORMATET PRESISERT** — limbare blokker i egen fenced kodeblokk, én pr. mottaker; spørsmål som venter på Kenneth får egen «KREVER SVAR»-overskrift, og står det ingenting, skal det STÅ. Utløst av Kenneth 17.09.
- 🔴 **UTLØSER api-deploy + OTA — Kenneth eier begge. Klart, ikke deployet.**

---

## 🟢 2026-09-17 — To strengvedtak (`b4602e2c`). WEB-DEPLOY, ingen migrering, ingen OTA.

**Én branch, `chore/strengvedtak-kilde-sokeord`, fast-forward oppå `ccad572a`. To i18n-VERDIER × 15 filer — ingen kode, ingen nye nøkler.** Gate: `pnpm test` 7/7 — alle seks tall helt stille (`db` 2 · `api` 490 · `pdf` 120 · `shared` 824 · `web` 261 · `mobil` 9). Integrasjon 48 (branchen rører null api/integrasjonsfiler). Alle 15 i18n-filer 4569 nøkler, identisk sett før/etter. Begge CI-jobber grønne (`test` + `e2e 01-05+07`).

- 🟢 **TO STRENGVEDTAK LEVERT** — `maler.arkiv.kildeSitedoc` «SiteDoc-standard» → **«SiteDoc-mal»** (paritet med `kildeFirma` = «Firmamal»); `innstillinger.sokeord.maler` utvidet med **«firmaarkiv sitedoc-arkiv»** uten at «malarkiv» ble fjernet. **2 verdier × 15 språk. Ingen nøkkel-rename, ingen kodeendring.**
- 🟢 **De to åpne punktene fra forrige bolk er dermed LUKKET** — begge gatet av Kenneth 17.09.
- 🟢 **Ingen `kildeProsjekt`-søsternøkkel finnes** — målt, ikke antatt. **Eneste andre `sokeord`-nøkkel er `byggeplasser`, uten arkiv-termer.**
- ⚠️ **HULL I TESTVERNET, meldt av mal-Opus:** *«testen vokter at nøkkelen bærer «arkiv», ikke «malarkiv» spesifikt — fjerner du kun «malarkiv» (men beholder andre arkiv-tokens) forblir den grønn. Broen «malarkiv» er altså ikke test-vernet i seg selv.»* **Ingen handling nå — men neste som rører søkeord skal vite det.**
- 🟢 **Verifisert etter merge, før push (verdi-merge har ingen test som fanger fravær):** `kildeSitedoc` = «SiteDoc-mal» · `sokeord.maler` bærer BÅDE «malarkiv» OG «sitedoc-arkiv» · `adminBibliotek.tittel` = «SiteDoc-arkiv» (forrige rundes harmonisering ikke rullet tilbake).
- 🟢 **mal-Opus ventet korrekt:** `git merge-base --is-ancestor` FØR han branchet, etter forrige rundes falske alarm. **Lærdommen satt.**
- 🟡 **Cowork-funn, ikke blokkerende:** `pl.json` bøyer produktnavnet — «Szablon SiteDoca» (polsk genitiv). Grammatisk korrekt polsk, ikke oversettelsesfeil.

---

## 🟢 2026-09-17 — Bundet flyt-UI + strengharmonisering (`ba7f6c0f`). WEB-DEPLOY, ingen migrering, ingen OTA.

**To brancher, bindende rekkefølge:** **1. `chore/strengharmonisering`** (`--no-ff`, 15 i18n-filer, 165/165 ren tekst) · **2. `feat/bundet-flyt-ui`** (`--no-ff`, web + 15 i18n). Begge rører alle femten i18n-filer — landet i denne rekkefølgen for at bundet-flyt-UI blir en vanlig tillegg-merge oppå verdiendringene. Ingen konflikt. Kontrollert etter merge (3-veis JSON-merge feiler stille): **alle 15 filer 4569 nøkler, identisk sett**; **de 11 harmoniserte verdiene overlevde** (`adminBibliotek.tittel` = «SiteDoc-arkiv» i develop, verifisert med streng-diff mot forrige develop, ikke bare nøkkeltelling).
Gate: `pnpm test` 7/7 tasks — **`web` 259→261** (+2: testen som feiler hvis «Andre flyter» vises for en bundet flyt). Resten stille (`db` 2 · `api` 490 · `pdf` 120 · `shared` 824 · `mobil` 9). Integrasjon uendret på 48 (branchene rører null api/integrasjonsfiler). Begge CI-jobber grønne.

- 🟢 **BUNDET FLYT ER KOMPLETT** — kolonne og serversperre kom i `be2217d1`, UI-et nå. To radiovalg ved opprettelse («Fri flyt · standard» / «Bundet flyt ⚓»), bryter i etterkant med konsekvenstekst begge veier, fotnote som avviser rettighets-lesningen, `Anchor` på tre flater. **Fri flyt har INGEN symbol.**
- 🟢 **Test som feiler hvis «Andre flyter» vises for en bundet flyt** — sett rød først (`!egenFlytBundet`-vakten fjernet → testen falt). `data-testid` på begrunnelse-dialogen tatt med (`bekreft-begrunnelse-input` + `-send`).
- 🔴 **AVVIK FRA FASITEN, gatet av cowork:** fabels fotnote navnga «Endringsmeldinger». redesign generaliserte til «Dokumentene» fordi fotnoten vises i enhver bundet flyt (også «Varsel», «Teknisk avklaring»). Mikrotekst-standarden krever relasjonelle benevnelser. Siste setning står ordrett: «Det gjelder alle i prosjektet, ikke bare deg.»
- 🟢 **STRENGHARMONISERING LEVERT** — «Sentralarkiv» og «sentralmalen» ut som synlige begreper. 11 verdier i femten språk. Ingen nøkkel-rename, ingen kodeendring.
- 🟢 **Krav 5 var et ikke-problem:** ingen live UI sier «Standard» om `NS3420-K` — treet bruker dataens eget navn. «Standard for nye» står urørt.
- ⚠️ **MELDT, IKKE GJORT: seks relikvi-nøkler med 0 kodereferanser** (`firma.malarkiv.tittel`, `.tilbake`, `.kunFirmaAdmin`, `bibliotek.tittel`, `.hentFraBibliotek`, `.beskrivelse`). Nøkkel-sletting er egen sak.
- 🔴 **FALSK ALARM STRØKET:** mal-Opus meldte at `feat/bundet-flyt-skjema` ville felle nøkkelsett-testen ved å slette to nøkler fra `nb`/`en`. Målt: den ble merget for lenge siden (`be2217d1`), og begge nøklene finnes i alle femten filer. 2-punkts-diff mot en gammel branch-tipp.
- 🟡 **TO ÅPNE, Kenneth gater:** `maler.arkiv.kildeSitedoc` = «SiteDoc-standard» — mal-Opus anbefaler «SiteDoc-mal» for paritet med «Firmamal» · `innstillinger.sokeord.maler` — legg til «firmaarkiv sitedoc-arkiv» uten å fjerne «malarkiv».

---

## 🟢 2026-09-17 — Personvalg i videresend (`65e16a93`). WEB-DEPLOY, ingen migrering, ingen OTA.

**Én branch merget** (`fix/videresend-personvalg`, `--no-ff`). Kun `apps/web` + 15 i18n-filer (17 filer, +113/−15). Ingen fil i `apps/api`, `apps/mobile`, `packages/db` eller `tests/e2e`.
Gate: `pnpm test` 7/7 tasks — **`web` 257→259** (+2: regresjonstesten for personvalg). Resten stille (`db` 2 · `api` 490 · `pdf` 120 · `shared` 824 · `mobil` 9). **Integrasjon uendret på 48** (branchen rører null api/integrasjonsfiler — strukturelt uendret, ikke re-kjørt). Alle 15 i18n-filer på 4552 nøkler, identisk nøkkelsett (generatoren kjørt). Begge CI-jobber grønne.

- 🟢 **PERSONVALG I VIDERESEND VIRKER.** Radene under «Andre flyter» var `<div>` — kun flytnavnet var klikkbart. Flyt-bytte gikk alltid til hovedansvarlig utfører.
- 🟢 **Bekreftelsesboksen navngir valgt person med rolle; tittelen sier dokumentnavnet.** Valgt person → «Ballen går til Siri Vik (registrator)» · flytnavn → «Ballen går til Per Eng (hovedansvarlig utfører)». Tittel: «Flytt «Befaringsnotat»?».
- 🔴 **COWORK-FEIL: ordren påstod at ordlyden for begge tilfeller alt fantes. Den gjorde ikke det.** Kun auto-utleder-varianten («hovedansvarlig utfører») eksisterte. redesign la til én ny nøkkel (`videresend.konsekvensBallPerson`) framfor å gjenbruke feil tekst — og meldte det.

---

## 🟢 2026-09-17 — Tre brancher merget (`be2217d1`): diff/merge på ↻ (erstatter blankosperre) · bundet flyt (MIGRERING) · e2e 05/07. DEPLOY m/ MIGRERING.

**Tre disjunkte brancher, rekkefølge 1→2→3, `--no-ff` per branch.** Strategi: **e2e `10d656b8`** · **diff/merge `9cf21d37`** · **bundet flyt `be2217d1`**. `comm -12` tom mellom alle tre (målt selv). Base `7851f243`. `fix/e2e-status-assertions` var basert på `d2f8bf65` (bak develop), men develop rørte ikke dens tre filer → ren merge.
🔴 **BÆRER MIGRERING `20260917130000_bundet_flyt` — IKKE KJØRT.** Kenneth kjører den ved deploy (BUILD→MIGRATE→UP). `ALTER TABLE dokumentflyter ADD COLUMN bundet BOOLEAN NOT NULL DEFAULT false` (default = backfillen; ingen rad fødes tom). DRY-RUN.sql bevist read-only (kun SELECT).
Gate: `pnpm test` 7/7 tasks — alle stille (`db` 2 · **`api` 490** · `pdf` 120 · `shared` 824 · `web` 257 · `mobil` 9). **Integrasjon 44→48** (+5 diff/merge, +4 bundet flyt, −2 slettet blankosperre-test → netto på de to basene summerer til 48) — kjørt lokalt mot efemær `pgvector/pgvector:pg16`-sandkasse (CI-speil, port 5433). Begge CI-jobber grønne (`test` + `e2e 01–05/07`, run 35191786088).

**A — diff/merge på ↻ (erstatter sperren):**
- 🔴 **COWORK-FEIL RETTET.** Blankosperren fra forrige runde nektet oppdatering når noe dokument hadde data. Kenneths regel er at oppdatering nektes når data BERØRES. I drift ville sperren gjort at ingen prosjekt i bruk kunne motta maloppdateringer.
- 🟢 **↻ matcher nå gammelt mot nytt på `(type, label)` og BEHOLDER objekt-id ved match.** Dokumentdata følger automatisk. Nekt utløses KUN når et felt som HAR DATA forsvinner — og feilmeldingen NAVNGIR feltene.
- 🟢 **Entydighetsvakt ved kjøretid:** entydig nøkkel → match på tvers av overskrift (flyttet felt beholder data). Tvetydig → forelder-match, gjetter aldri.
- 🔴 **Kenneth-vedtak 17.09, definisjonen som gjelder:** «firmamaler skal alltid kunne oppdateres — de er aldri bundet av en handling i prosjekt. prosjektmal — kan kun oppdateres dersom tidligere lagrede data ikke berøres.»
- 🟡 **MELDT, IKKE BYGGET: tørrkjøring.** `firmamal.forhandsvisOppdatering` ~30–40 linjer, gjenbruker `diffObjektTre` uten transaksjon → «3 felt legges til, 1 fjernes, 12 beholdes» i ↻-bekreftelsen. Ingen skjemaendring. 🔴 Kenneth gater.
- 🟢 **Erstattet testfil:** `firmamal-oppdater-vern.integration.test.ts` SLETTET (per mandat, test 1 feilet mot ny kode først); ingen annen test dekker blankosperren. Ny `firmamal-diffmerge.integration.test.ts` — 7 tester sett røde i fire negativkontroller (NK-4: brøt entydighetsvakten, beviste at testen fanger GJETTINGEN).

**B — bundet flyt (BÆRER MIGRERING `20260917130000_bundet_flyt`):**
- 🟢 **Kolonne på `Dokumentflyt`, default FRI. Serversperre i `oppgave.ts` og `sjekkliste.ts`** mot flyt-bytte UT av en bundet flyt. Videresend INNEN egen flyt virker fortsatt.
- 🟢 **Dry-run: 18 flyter, 6 prosjekter, alle blir frie via defaulten. Ingen backfill.**
- 🔴 **`kanByttFlyt` er URØRT** — bundet flyt er en egenskap ved flyten, ikke en rettighet.
- ⚠️ **UI gjenstår:** radiovalg ved opprettelse, bryter i etterkant, fotnote, `Anchor`-symbol. Bestilles til redesign.

**C — e2e `05` og `07`:**
- 🔴 **FUNN: en test som passerte fordi handlingen aldri skjedde.** Samme feilklasse som de elleve testene som aldri kjørte. ⚠️ Avvis og Besvar krever begrunnelse; gjenåpne gjør ikke.
- 🔴 **MELDT: begrunnelse-dialogen mangler `data-testid`** (`DokumentHandlingsmeny.tsx:646`) — spec-en henger i placeholder-tekst. Fikses IKKE her; redesign eier fila.

---

## 🟢 2026-09-17 — Vern på firmaarkiv-↻ + fabels bundet-flyt-tegning (`045e376d`). WEB-DEPLOY, ingen migrering.

**Én branch merget + én tegning som egen commit. `fix/e2e-status-assertions` HOLDT (under avklaring, meldt).** Strategi: **vern `--no-ff`** (`22a4dc2f`), **fabel-tegning egen commit** (`045e376d`).
`firmamal.ts` ga **INGEN konflikt** selv om både indeks-mergen (forrige runde) og vern-branchen rører den: endringene er i ulike funksjoner og begge overlevde — **VERN-guard `oppdaterKopiFraHovedmal` `firmamal.ts:825-843`** (tellDokumenterMedInnhold `:830`) · **`deletedAt`-filter i dobbeltlån-vakten `firmamal.ts:894-900`** (`:898`). `merge-tree` dry-run var ren før merge.
Gate: `pnpm test` 7/7 tasks — alle stille (`db` 2 · **`api` 490** · `pdf` 120 · `shared` 824 · `web` 257 · `mobil` 9). **Integrasjon 37→39** (+2: vern-testen begge retninger) — kjørt lokalt mot efemær `pgvector/pgvector:pg16`-sandkasse (CI-speil). **`api` STILLE på 490 som forventet** (kontrollplan la ingen enhetstest; sperren dekkes av integrasjonstest). Ingen schema-endring, ingen OTA.

**A — sperre på firmaarkiv-↻ (funn #22, steg 1 av 2):**
- 🔴 **`oppdaterKopiFraHovedmal` nekter nå når prosjektmalens objekter har faktisk innhold i et aktivt dokument.** Speiler `slettObjekt` — det var en inkonsistens, ikke en manglende funksjon. `oppdaterKopiFraHovedmal` gjorde `deleteMany` + gjenskaping med NYE id-er, kun `verifiserAdmin`-gatet → all dokumentdata ble foreldreløs.
- 🟢 **Tellefunksjonen GJENBRUKT, ikke kopiert** — `tellDokumenterMedInnhold` i `mal.ts:85` fikk `export`, ingen andre kopi. Soft-slettede dokumenter teller ikke (`mal.ts:89-90`). `oppdaterFraSentralarkiv` verifisert trygg og URØRT (firmanivået bærer ingen dokumenter).
- 🟢 **Utveien står i feilmeldingen:** «Hent fra arkiv» lager en ny prosjektmal.
- 🔴 **STEG 2 SYNLIG PÅ BACKLOG:** Kenneths regel «forsvant et felt som har data?» krever at ↻ matcher gammelt mot nytt og BEHOLDER objekt-id-en (diff/merge, som koden selv kaller backlog `firmamal.ts:786`). **Sperren er MIDLERTIDIG.** Målt omfang 17.09: 40 prosjektmaler, 22 med dokumenter, 1 der malen alt er endret.
- ⚠️ **COWORK-FEIL godkjent:** krav 3 ba om i18n-nøkler, men `apps/api` har INGEN i18n — kontrollplan målte premisset og avvek bevisst.

**B — e2e `05` og `07` (HOLDT):**
- 🟡 **`fix/e2e-status-assertions` (`3578f3e4`) IKKE merget denne runden — under avklaring** (Kenneth-instruks). Spec-en følger statusmodellen (`avledStatus` gir `responded` KUN ved `retning=tilbake`; besvarelse framover = `received`). Slås på egen runde.
- 🔴 **`06-videresend` fortsatt ute** — ventet på en HANDLING fjernet fra menyen, slås på når `fix/videresend-personvalg` er inne.

**C — VEDTAK: bundet flyt (fabels tegning, Kenneth-gatet 16.09):**
- 🟢 **Navn: «Bundet flyt».** Motsatsen heter «fri flyt» i all mikrotekst. ⚠️ «Lukket» (dokumentstatus) og «låst» (maler) utelukket.
- 🔴 **Default: FRI.** Feilen skal gå mot «for åpen»: glemt binding gir en flytting som uansett krever bekreftelse, navngitt målflyt, påkrevd kommentar og logg.
- 🔴 **Nivå: per FLYT** — én boolsk kolonne på `Dokumentflyt`. **Ingen backfill** (alle eksisterende flyter forblir frie). Bryteren kan endres begge veier etter opprettelse — styrer kun hva som er lov framover, rører aldri dokumentdata.
- 🟢 **Symbol: lucide `Anchor`** (0 treff, ledig). Kun på BUNDNE flyter. ⚠️ `Lock` utelukket (17 treff mallåsing, leses som «du mangler tilgang»). «Andre flyter» fjernes ikke stille — fotnote med anker forklarer: «Det gjelder alle i prosjektet, ikke bare deg.»
- 🔴 **NESTE:** skjemaordre til kontrollplan, så UI til redesign.

---

## 🟢 2026-09-17 — Tre brancher merget (`d074d919`): videresend synlig konsekvens · partiell unik-indeks (MIGRERING) · funn #22-måling. DEPLOY m/ MIGRERING.

**Tre disjunkte brancher (parvis `comm -12` tom, verifisert mot ekte filer, alle base = `d8e051b2`).** Strategi: **unik-indeks `--no-ff`** (`3892f0f1`), **videresend `--no-ff`** (`a663a01f`), **funn21 `--no-ff`** (`d074d919`) — kun første kunne FF, resten disjunkte merge-commits, null konflikt.
Gate: `pnpm test` 7/7 tasks — **`api` 489→490** (dobbeltlån-vakt case 5) · **`web` 253→257** (`videresend-mottakervelger.test.tsx`), øvrige stille (`db` 2 · `pdf` 120 · `shared` 824 · `mobil` 9). **Integrasjon 36→37 grønn** (gjenlån-retningen) — kjørt lokalt mot efemær `pgvector/pgvector:pg16`-sandkasse (CI-speil), migrate deploy m/ `20260917120000` uten feil. `tsc --noEmit` rød KUN på `bibliotek-mal.test.ts:25-26` (TS2532) — **verifisert pre-eksisterende** (filen urørt av mergen, kald `next build` grønn). **BÆRER MIGRERING `20260917120000_unik_indeks_partiell_soft_delete` — cowork fører BUILD→MIGRATE→UP.**

**A — videresend synlig konsekvens (PILOTKRITISK):**
- 🔴 **VIDERESEND ER TILBAKE FOR FLYT-BUNDNE DOKUMENTER.** Pilot-fiks A (02.08) hadde fjernet affordansen på både web og mobil. Serveren kunne det; menyen tilbød det ikke.
- 🔴 **Gate-grunnen fra 02.08 var GAL:** `forwarded` returnerer på `oppgave.ts:1515`, FØR `beregnRuting` på `:1549`. Valget ble aldri kastet av posisjonsruting. Kodekommentaren på `DokumentHandlingsmeny.tsx:428-433` tok feil.
- 🟢 **Kenneths tre scenarier er nå mulige fra flaten:** re-gate til person · rette feil dokumentflyt · tømrer→ledelsen→elektriker. Mottakervelger i to seksjoner («I denne flyten» / «Andre flyter» kun ved `kanFlytte`, ⇄-linje navngir målflyt). Bekreftelsessteg ved flytbytte: konsekvensboks + PÅKREVD kommentar + knapp som navngir målflyten.
- 🟢 **Mottakeren ser «⏳ Venter på deg» + avsender med faggruppe og dato + kommentar i raden** — ikke bare et nytt dokument. **`DocumentTransfer` bar all dataen — ingen schema-endring.** `select`-kostnaden målt: `transfers: { take: 1 }` gir K→K+1 batchede spørringer, ikke N+1.
- 🟡 **MOBIL: mindre enn antatt.** Mobil ALT har flyt-bytte-flyten (`visFlytBytte`-sheet, `kanFlytte`-gating). Det som mangler er en person-velger innen egen flyt — dataen er plumbet. 🔴 **Egen liten runde, trenger neppe tegnerunde.**

**B — partiell unik-indeks (BÆRER MIGRERING):**
- 🔴 **`20260917120000_unik_indeks_partiell_soft_delete`.** Soft-slettet mal blokkerer ikke lenger gjenlån. ⚠️ Fella var at en angrehandling tvang en destruktiv: du måtte tømme HELE papirkurven for å låne malen igjen.
- 🔴 **Dobbeltlån-vakten (`firmamal.ts:861`) filtrerte IKKE på `deletedAt`** — nå fikset. Begge retninger sett røde (gjenlån etter soft-slett → `P2002` mot full indeks · to aktive lån → rød da indeksen ble droppet).
- 🟢 **Dry-run gatet av Kenneth (`sitedoc_test` 17.09, read-only):** 0 soft-slettede firmamaler, 0 duplikat-lån. `CREATE UNIQUE INDEX` vil ikke feile. **`DRY-RUN.sql` verifisert read-only (kun SELECT).**

**C — funn #22-måling (docs):**
- 🔴 **Premisset nedjustert — to vern fantes allerede.** Cowork kalte strukturkopi «største umålte pilotrisiko»; måling viste at `mal.ts`-endringsvernet (07.09) + `grenseSnapshot` dekker mesteparten. Ett hull står i firmaarkiv-↻ (`oppdaterKopiFraHovedmal`); fiksen kommer som egen branch (`fix/vern-oppdater-kopi`, kontrollplan).
- ⚠️ **Ført som funn #22** («#21» var alt tatt). ⚠️ **LÆRDOM: Subagent-rapport er input, ikke fasit** — en Explore-subagent ga feil svar («intet endringsvern») ved å hoppe over guard-linjene.
- ⚠️ **AVVIK meldt:** funn21 rørte `docs/claude/BACKLOG.md` (additivt, funn #22 + nummer-note) — ordrens Steg 1 forventet den urørt. Harmløst (kun funn21 rørte den, kolliderer ikke med tavla).

---

## 🟢 2026-09-16 — Tre brancher merget (`09d6df7f`): versjonssporing+soft-delete (MIGRERING) · kapittelkollaps · e2e-dedrift. DEPLOY m/ MIGRERING.

**Tre disjunkte brancher (parvis `comm -12` tom, verifisert mot ekte filer).** Strategi: **kapittelkollaps ff** (`d15a7fc0`), **e2e-dedrift rebase+ff** (basert på develop-tippen),
**versjonssporing rebase+ff** (branchet fra `0c7efe21`, før PR2-tavla — rebase replayet kun `de182bd2`, rørte ALDRI STATUS-AKTUELT; diffen var ren base-artefakt).
Gate: `pnpm test` 7/7 tasks — **`api` 488→489 · `web` 249→253**, øvrige stille. **Integrasjon 33→36 grønn i CI** (kan ikke kjøre lokalt: `DATABASE_URL` ikke satt i merge-treet — antall 36 bekreftet ved collection). Kald web-bygg grønn. Begge CI-jobber grønne. **BÆRER MIGRERING `20260916120000_versjonssporing_softdelete` — cowork fører BUILD→MIGRATE→UP.**

**A — versjonssporing + soft-delete (MIGRERING):**
- 🟢 **Versjonsmønsteret komplett på tre nivåer** — kapittelmal egen `version`, firmamal `versjonAvHovedmal` mot kapittelarkivet, prosjektmal sin mot firmamalen.
- 🔴 **Backfillen beviselig riktig** — `BibliotekMal.versjon` har aldri hatt skrivevei (`git log -S`), alle lån skjedde på versjon 1. Dry-run mot `sitedoc_test`: backfyller **6 rader hos SITEDOC MYRHAUG, 0 andre firmaer** (Kenneth-gatet, read-only verifisert).
- 🟢 **`versjonAvHovedmal` NULLABLE med vilje** (default'et 1 ville skjult manglende snapshot). DB-garanti: rå-SQL `CHECK` (Prisma kan ikke uttrykke den). Integrasjonstest SETT RØD: droppet CHECK → rad slapp inn uten snapshot → rød.
- 🔴 **FUNN: soft-delete blokkerer gjenlån** — unik-indeksen fra runde 95 teller soft-slettede rader. Fiks = partial unique index `WHERE deleted_at IS NULL`, egen runde. **Ført BACKLOG #21.**
- 🔴 **FUNN: `OrganizationTemplate.version` bumpes ikke av eget objekt-CRUD** — firmanivå svakere versjonert enn kapittelnivå. **Ført BACKLOG #21.**
- 🟡 **N dager auto-tømming IKKE satt** — `tomPapirkurvPermanent` tar `eldreEnnDager` som påkrevd input, ingen default/cron.

**B — kapittelkollaps, fire flater:**
- 🟢 **Kollaps kun på KAPITTEL** (`NS3420-K`/`NS3420-F`); underkapittel-etikettene borte. Kollapsbar underkapittel-overskrift KUN ved 3+ maler (i dag utløser bare `KB`). Én delt primitiv `byggUnderkapittelBlokker` i fire flater: «Hent fra arkiv» (begge faner) · trestrukturen i Malforvaltning · `LaanFraSentralarkivDialog` · `kontrollplan/OpprettPunktDialog`.
- 🔴 **TERMINOLOGI-VEDTAK (Kenneth 16.09):** kapittel = én bokstav (`K`,`F`) · underkapittel = to (`KA`) · post = `KC3.1`. ⚠️ Kodens `BibliotekStandard` = Kenneths «kapittel»; `BibliotekKapittel` = hans «underkapittel» (forskjøvet ett hakk). **Modellnavn døpes IKKE om — vedtaket gjelder det brukeren ser.**
- ⚠️ `kontrollplan.opprettPunkt.visKapitler` er nå relikvi («vis kapitler»-avkrysningen fjernet). La stå — mal-Opus rydder i18n.

**C — e2e de-drift:**
- 🟢 **01–04 de-driftet og grønne i CI, 5/5 kjøringer, ingen flaky.** 🔴 **INGEN `data-testid` lagt til** — dokgens del-2-diagnose var feil; testid-ene fantes, problemet var tvetydighet (3 treff) + sticky header-overlay. Ingen web-komponent rørt → ingen web-deploy fra denne.
- 🔴 **SEED-FIKS:** `seed-testbrukere.ts` fikk `ProjectOrganization`-join-raden (prosjektet var prøveprosjekt fordi `erStandaloneProsjekt` teller den raden). ⚠️ `seed-e2e-pilot.ts` + `seed-agent-mobil-test.ts` fortsatt berørt (meldt, ikke rørt). **Ført BACKLOG (ProjectOrganization-post).**
- 🔴 **FUNN: `Project.primaryOrganizationId` og `ProjectOrganization` er to UAVHENGIGE kilder UTEN constraint** — de kan divergere; seeden gjorde det. **Ført BACKLOG (ProjectOrganization-post).**
- 🔴 **05/06/07 HOLDT UTE.** `06-videresend` er IKKE spec-drift: pilot-fiks A (02.08) gater Videresend bort for flyt-bundne dok (`DokumentHandlingsmeny.tsx:434` `!harFlyt`, mobil `DokumentHandlingslinje.tsx:208`). Fabels tegning 16.09 gjenåpner den — egen runde. **Fabels videresend/bytt-flyt-tegning committet denne runden (`f1ac764d`).**

---

## 🟢 2026-09-16 — Malforvaltning PR 2 merget (`0c7efe21`): `firma/malarkiv` REVET. UTLØSER WEB-DEPLOY.

**Merget `feat/malforvaltning-pr2` (ren fast-forward `267f42b0..0c7efe21`).** 28 filer, +1456/−1017 (13 kode/test + 15 i18n).
Alle femten språkfiler i takt på 4522 (verifisert likt nøkkelsett). Gate: `pnpm test` 7/7 tasks, **`web` 244→249** (+5 gating), `api` stille 488,
øvrige stille. Kald web-bygg grønn. Begge CI-jobber grønne. **Første web-deploy på flere runder — cowork fører den.**

- 🟢 **MALFORVALTNING PR 2 LEVERT — `firma/malarkiv` er REVET.** Firmaarkiv-fanen er én liste med filtrerbar maltype-kolonne. Nav-lenken PR 1 holdt tilbake er lagt inn. `/dashbord/firma/malarkiv` + `/[malId]` består som REDIRECTS (bevarer `malId`), ikke flater.
- 🟢 **ELLEVE funksjoner flyttet med bevis per funksjon.** Fem av dem sto IKKE i coworks ordre — redesign målte flaten i stedet for å stole på lista (rediger-metadata-dialog · inspiser-før-lån · HMS-subdomain/synlighet · «allerede lånt»-vakt · søk-i-lån-dialog).
- 🔴 **TO PREMISSFEIL I COWORKS ORDRE, målt og meldt av redesign:** (1) «versjonsavstand» i OPPHAV finnes ikke som data — cowork tok tallet fra fabels MOCKUP og behandlet en tegning som funksjonalitet. (2) slett-sperren `mal.ts:500` er PROSJEKTmal-sperren; `firmamal.slett` hard-sletter — ordren motsa seg selv. 🟢 Bygget ærlig: OPPHAV viser avstamning + ↻, sletting får permanent-advarsel + `copiedTo`.
- 🔴 **FUNN: den generelle «Tilbake til …»-whitelisten finnes ikke.** `TilbakeLenke.ETIKETT_FRA_KILDE` er papirkurv-only; `Nivaabanner.tilbake` validerer ingenting. redesign repekte `Nivaabanner.tilbake` til malforvaltning-roten med ny nøkkel — ingen etikett forsvant.
- 🟢 **Kollaps i «Hent fra arkiv» flyttet til STANDARD-nivå** (`NS3420-K`/`NS3420-F`, kapitler som statiske underetiketter), maler sortert på referanse med numerisk `localeCompare` (`KC3.1 < KC10`). **Serverens `orderBy` urørt.**
- 🟡 **MELDT, KENNETH GATER:** `LaanFraSentralarkivDialog` har fortsatt per-kapittel-kollaps — utenfor Del C's scope; redesign utvidet ikke. Konsistensspørsmålet tas til Kenneth.
- 🟢 **`sok-dekning`-testen:** firma- og SiteDoc-arkiv deler nå URL (begge → Malforvaltning) — endret til å skille på `id`, redirect-roten lagt i unntakslista.
- 🔴 **Versjonssporing firmamal→SiteDoc-arkiv bygges NÅ av kontrollplan** (`feat/versjonssporing-softdelete`, ikke pushet ennå) — sammen med soft-delete som låser opp Papirkurv-fanen.

---

## 🟢 2026-09-16 — E2e del 2 merget (`8ddad2e0`): riggen målt stabil, seks spec-er avslørt DRIFTET. INGEN deploy.

**Merget `ci/e2e-del2` — IKKE fast-forward** (dokgen branchet fra `0612f938`, før nøkkelsett-mergen). **Strategi: rebase** (null overlapp
mot det develop fikk i mellomtiden — `comm -12` tom; develop fikk kun i18n+test+STATUS, del2 rører kun `ci.yml`+`kvalitetssikring-plan.md`).
Rebaset rent på develop, alle tre commits bevart (inkl. negativ-kontroll-sporet), så `--ff-only` `d08496e4..8ddad2e0`. 2 filer, +43/−4.
Gate: `pnpm test` 7/7 tasks, seks tall (`db 2 · api 488 · pdf 120 · shared 824 · web 244 · mobil 9`). Begge CI-jobber grønne.

- 🟢 **Riggen er MÅLT STABIL — 5/5 grønne kjøringer, ingen retries, miljø klart 4–5 s** (4m03s · 3m23s · 3m48s · 3m05s · 2m54s).
- 🟢 **`db-maskin`-migreringene inn i e2e-miljøet** — `maskin.vegvesen_ko does not exist`-støyen er borte (verifisert i CI-logg, ~2 s).
- 🔴 **HOVEDFUNN: SEKS AV SJU E2E-SPEC-ER ER DRIFTET.** Skrevet mot et UI som siden er endret; ingen merket det fordi suiten aldri kjørte i CI. `02-opprett` venter `role="button"` der `OpprettMalVelger.tsx` nå rendrer `role="option"` (UI-refaktor `f567d339` 04.08, spec sist rørt 26.07). Tre spec-er venter på testid-er som ikke finnes. Ingen flaky — alle feiler deterministisk. **Ført som egen BACKLOG-post.**
- 🔴 **SEED-GAP (treffer mer enn e2e):** `seed-testbrukere.ts:95` setter `primaryOrganizationId` men oppretter ALDRI `projectOrganization`-join-raden. `erStandaloneProsjekt` (`prosjektGrense.ts`) teller den — er den 0, regnes prosjektet som PRØVEPROSJEKT (maks 10). Seedet produserer prosjekter som ikke ligner produksjon. **Ført som delfunn under eksisterende `ProjectOrganization`-legacy-post i BACKLOG.**
- 🟢 **Negativ kontroll i CI:** `02-opprett` kjørt midlertidig → RØD på den diagnostiserte driften. Riggen fanger drift i CI, ikke bare lokalt.
- 🔴 **E2e forblir KUN `01-login` i CI** inntil en egen runde med SPEC-REDIGERINGS-MANDAT har de-driftet 02–07 og lukket seed-gapet. Å slå dem på nå ville gjort develop rød.
- 🟡 **Blokkering (dokgens anbefaling, cowork-gatet):** e2e blokkerer IKKE merge nå (for tynt signal med én spec); kun på PR, ikke hver push. Veien forbi finnes: `git push origin HEAD:develop` fra merge-treet omgår PR-gaten. Vurderes på nytt når 02–07 er grønne.

---

## 🟢 2026-09-16 — Nøkkelsett-testen merget (`e599d40a`): i18n-hullet kan ikke lenger gjenoppstå stille. Utløser web-deploy (samles).

**Merget `test/i18n-nokkelsett` (ren fast-forward `0612f938..e599d40a`).** 16 filer, +160/−15: de femten språkfilene +
`packages/shared/src/i18n/nokkelsett.test.ts`. Ingen kodefil utenom testen. Gate: `pnpm test` 7/7 tasks, **`shared` 823→824**
(testen bor der), de fem andre stille (`db 2 · api 488 · pdf 120 · web 244 · mobil 9`). Begge CI-jobber grønne på develop.

- 🟢 **NØKKELSETT-TESTEN LEVERT** — `packages/shared/src/i18n/nokkelsett.test.ts` leser alle femten filer og krever samme nøkkelsett som `nb`. **Feilklassen kan ikke lenger gjenoppstå stille.**
- 🔴 **GJELDEN HADDE VOKST FRA 0 TIL 7 PÅ ETT DØGN** — fire nøkler fra Malforvaltning PR 1 (`malforvaltning.fane.sitedoc`/`.ingenTilgang`/`.tittel`/`.undertittel`), tre fra arkiv-søk (`sok.firmaarkiv`/`sok.sitedocArkiv`/`innstillinger.sokeord.maler`). Begge runder passerte coworks merge-gate uten at generatoren ble kjørt. Alle femten på 4506 etter runden.
- 🟢 **Testen er SETT RØD før grønn** (`sok.firmaarkiv` fjernet fra `de.json` → rød). Feilmeldingen navngir nøkkel + fil og gir løsningskommandoen (`generate.ts --only <nøkkel>`).
- 🟢 **`firmaNav.malarkiv` slettet i alle femten** — relikvi etter at menypunktet ble fjernet. Verifisert 0 kallere (grep i `apps/`+`packages/`). ⚠️ Testen fanger IKKE relikvier som finnes i ALLE filer — de må tas manuelt (nøyaktig scenariet kravet beskrev).
- 🔴 **NY REGEL, i kraft fra denne mergen:** enhver runde som legger `nb`/`en`-nøkler MÅ kjøre `generate.ts --only <nøkler>`, ellers blir CI RØD (tilsiktet). Sperren mot at andre agenter enn mal-Opus kjører generatoren gjelder ikke lenger for deres EGNE nye nøkler — kun for eksisterende nøkler i de tretten.
- ⚠️ **Lærdom (mal-Opus):** `git checkout <fil>` under en negativ kontroll reverterte også ugatet arbeid i samme fil. Ta backup av arbeidstre-versjonen FØR `git checkout`, ikke etter.

---

## 🟢 2026-09-16 — E2e i CI del 1 merget (`d136340f`): efemært miljø + `01-login` grønn. INGEN deploy.

**Merget `ci/e2e-efemert-miljo` (ren fast-forward `f6c13eca..d136340f`, fire commits bevart — ikke squashet).** 2 filer, +123/−19:
`.github/workflows/ci.yml` + `kvalitetssikring-plan.md`. Ingen spec-fil, ingen kodefil. Gate: `pnpm test` 7/7 tasks, seks tall stille
(`db 2 · api 488 · pdf 120 · shared 823 · web 244 · mobil 9`). **Begge CI-jobbene grønne på develop: `test` ✓ og `e2e-del1 (KUN 01-login)` ✓.**

- 🟢 **E2E I CI DEL 1 LEVERT** — efemært miljø (pg+pgvector, migreringer, seed, api+web), `01-login` grønn i egen parallell jobb (3m25s, parallelt med `test`). Miljøet klart etter 4–5 s via helsesjekk, ikke `sleep`.
- 🟢 **Begge negativkontroller kjørt i CI:** feil api-port → rød på HELSESJEKK før Playwright startet · feil testid → rød på assertionen. Riggen feiler tidlig og av riktig grunn. `git diff 1cee88fa d136340f` tom.
- 🟢 **Seed kjørbar og idempotent** — `seed-testbrukere.ts` + `seed-e2e-flyt.ts`. E2e-suiten er IKKE avhengig av manuelt oppsatt tilstand i `sitedoc_test`.
- 🟢 **Ingen GitHub-secret nødvendig for del 1** — jobb-generert `DEV_LOGIN_SECRET` (+ `AUTH_SECRET`, `FIL_SIGNING_SECRET`). Ingenting lagres.
- 🔴 **ARKITEKTUR-FUNN:** web `/api/trpc` kjører tRPC-routeren IN-PROCESS, ikke som proxy til Fastify. Web er selvstendig for nettleser-flyten; api (Fastify) trengs for `global-setup` sin dev-login og `slåOppFlyt`. Verdt å vite ved ethvert miljøoppsett.
- 🔴 **`next start` tvinger `NODE_ENV=production`** → trigger `assertFilSigneringEnv("web")` i `instrumentation.ts`; derfor kreves `FIL_SIGNING_SECRET` + `AUTH_SECRET` for å boote web overhodet.
- 🟢 **Cookie-navn-grenen treffer riktig:** http-miljø → `authjs.session-token`, ikke `__Secure-`-varianten. Admin-sweepen er env-guardet til `sitedoc_test` og hopper trygt over.
- ⚠️ **MELDT, ikke løst:** api-bakgrunnsworkeren logger `maskin.vegvesen_ko does not exist` fordi `db-maskin`-migreringene ikke kjøres i e2e-miljøet. Ufarlig for login. Vurderes i del 2.
- 🟡 **Blokkeringsspørsmålet (dokgens anbefaling, cowork-gatet inntil videre):** e2e-jobben RAPPORTERER, blokkerer IKKE merge — «én grønn kjøring sier ingenting om flakiness». Kenneth avgjør i del 2 etter stabil grønn over flere kjøringer.
- 🔴 **NESTE: e2e del 2** — de seks andre spec-ene, `db-maskin`-støyen, blokkeringsspørsmålet.

---

## 🟢 2026-09-16 — Mobil testharness merget (`b8ee57cc`): fase 2 offline AVBLOKKERT. INGEN deploy.

**Merget `test/mobil-harness` (ren fast-forward `403be913..b8ee57cc`).** 7 filer, +338/−10: vitest-config + 2 testfiler i
`apps/mobile`, `package.json` (test-script + devDeps), `pnpm-lock.yaml`, BACKLOG + kvalitetssikring-plan. `metro.config.js`/`app.json`/`eas.json` NULL diff.
Gate: `pnpm test` **7/7 tasks**, seks tall: `db 2 · api 488 · pdf 120 · shared 823 · web 244 · mobil 9`. CI på develop grønn, `@sitedoc/mobile:test` kjørte der.

- 🟢 **MOBIL TESTHARNESS LEVERT — fase 2 offline er AVBLOKKERT.** vitest i `apps/mobile`, 9 tester (unit-ren 6 · integrasjon 3), med i `pnpm test` fra ROT og i CI. **Gate-tall er SEKS fra nå:** `db · api · pdf · shared · web · mobil`.
- 🟢 **Krav (c) EKTE oppfylt mot reell SQLite** (`sql.js` WASM, ikke `better-sqlite3` — node v25 lokalt / v20 CI ville gjort nativ modul ABI-følsom; avvik fra BACKLOG-anbefaling begrunnet ved måling). Tom `sjekkliste_id` → `NOT NULL constraint failed` fra SQLite selv, ikke mock. **Mobil-unntaket i CLAUDE.md er fjernet — «stille tomhet» gjelder nå uten unntak i hele repoet.**
- 🟢 **To BACKLOG-poster lukket av dokgen (i branchen):** «apps/mobile har INGEN test-runner» (blokkerte fase 2) og `splittVedMidnatt` (lønns-sensitiv, tidligere kun manuelt `tsx`-verifisert).
- 🔴 **MÅLT SQLite-quirk:** `PRIMARY KEY` alene håndhever IKKE `NOT NULL` på TEXT-kolonner. `sjekkliste_feltdata` har eksplisitt `NOT NULL` på både `id` og `sjekkliste_id` — ellers ville krav (c)-testen ikke bitt. Verdt å huske ved nye offline-tabeller.
- ⚠️ **UVERIFISERT (meldt av dokgen):** faktisk `expo export`-bundle-diff er ikke kjørt. Reachability bevist statisk (testfiler + devDeps uåtakbare fra `expo-router/entry`); observert tom bundle-diff gjenstår — verifiseres ved neste EAS-bygg, ingen egen kvote brukes.
- ⚠️ **CLAUDE.md-størrelse:** `wc -m` (tegn — regelens metrikk) = **40183 < 40960 ✓**. `wc -c` (bytes) = 41133. Ordrens anslag «~40 900» var mot bytes og traff ikke; unntakslinja var ~458 bytes, ikke ~690.

---

## 🟢 2026-09-16 — «Stille tomhet»-rekvittering merget (`082d1a60`): tre ekte integrasjonstester. INGEN web-deploy.

**Merget `test/stille-tomhet-rekvittering` (ren fast-forward `69c9ef2e..082d1a60`).** 4 filer, +457/−1: tre nye
`*.integration.test.ts` + `kvalitetssikring-plan.md`. Ingen kodefil, ingen skjemaendring. Gate: `pnpm test` **6/6 tasks**,
fem tall stille (`db 2 · api 488 · pdf 120 · shared 823 · web 244`). Fordeling: **unit-mock 158 · unit-ren 330 · integrasjon 17→33 · e2e 8** (integrasjon utenfor rot-kjeden). `find *.integration.test.ts` = **7** filer. CI på develop grønn.

- 🟢 **«STILLE TOMHET»-REKVITTERINGEN LUKKET** — alle fire migreringer har nå en test som faktisk feiler når dataen mangler (`integrasjon` 17→33: dokumentnummer 6 · gruppe-systemnøkkel 5 · bibliotekmal-objekttabell 5; `firmaarkiv_unik_indeks` innfridd av CI-runden). Alle tre sett RØDE før grønne (dokgen brøt hver lokalt mot engangs-Postgres).
- 🟢 **DB-garantien mot to `system_nokkel = 'hms'` per prosjekt FINNES** — `project_groups_prosjekt_systemnokkel_unik`, partiell unik-indeks `(project_id, system_nokkel) WHERE system_nokkel IS NOT NULL`. 🔴 Coworks bekymring om at den hvilte på backfillen alene var UBEGRUNNET — strøket.
- 🔴 **MÅLT: `Checklist.number` og `Task.number` er `Int?`** — maler uten prefiks får aldri nummer. Postgres NULLS DISTINCT betyr at den unike indeksen tillater vilkårlig mange NULL-nummer per mal. Testet eksplisitt for begge tabeller — ikke en feil, men en felle som nå er dokumentert i test.
- ⚠️ **De mockede testene BLIR STÅENDE** — de tester andre ting; integrasjonstestene kom i tillegg.
- 🟡 **BACKLOG:** ingen dedikert post fantes for server-side migrering-rekvitteringen (målt — søk på migreringsnavn/«rekvittering» ga null). Posten «apps/mobile har INGEN test-runner» gjelder **mobil** offline og forblir ÅPEN (denne runden lukker den ikke). Ingen post opprettet (per ordre).

---

## 🟢 2026-09-16 — CI: integrasjonstestene slått på mot engangs-Postgres. INGEN web-deploy (CI rører ikke kjørende kode).

**Merget `ci/integrasjon-og-e2e` (ren fast-forward `81b2a785..a27f5131`, tre commits bevart — ikke squashet).** 3 filer, +93/−11:
`.github/workflows/ci.yml` · `package.json` (kun nytt `test:integration`-script) · `docs/claude/kvalitetssikring-plan.md`. Ingen kodefil.

- 🟢 **Slått på:** 17 integrasjonstester (4 filer) kjører nå i CI mot en engangs-pgvector-Postgres — migreringene påføres, så testene. Utenfor CI: 8 e2e-spec-er.
- 🟢 **Syklusen bevist i PR #4:** grønn på `0a01534e` (17 tester passed, «All migrations successfully applied») → RØD på `c5c5207d` (bevisst P2002→P9999-brudd; kun integrasjonssteget feilet, `pnpm test` 488 unit forble grønt — rent signal) → grønn igjen på `a27f5131` (revert). `git diff 0a01534e a27f5131` er tom (verifisert).
- 🟢 **Kjøretid:** 1m48–54s → 2m19s (+29s: pgvector-init 22s, migrer 3s, integrasjon 6s).
- 🔴 **e2e står bevisst UTENFOR CI** — suiten muterer `sitedoc_test`; efemært miljø kreves (dokgens kø, egen runde).
- 🔴 **Gate-tall NY FORM (rot-`pnpm test`, helt stille): `db 2 · api 488 · pdf 120 · shared 823 · web 244`.** `api`-fordeling (dokgens måling): unit-mock 158 · unit-ren 330 · integrasjon 17 (i CI, eget script) · e2e 8 (utenfor CI). 158+330 = 488 ✓.

---

## 🟢 2026-09-15 — Malforvaltning PR 1 merget (`c192104c`): skall + gating + SiteDoc-fane, `admin/bibliotek` REVET. Utløser web-deploy.

**Merget `feat/malforvaltning` (ren fast-forward `4447fb0a..c192104c`).** 13 filer, +200/−214 (netto MINDRE kode). i18n kun `nb`/`en`.
Gate fra ROT grønn (`pnpm install` + `prisma generate` ×4): **`db 2 · api 488 · pdf 120 · shared 823 · web 244`** — `api` FALT −4
(`bibliotek-oppdater-mal.test.ts` slettet med `oppdaterMal`), `web` STEG +4 (`malforvaltning-tilgang.test.ts` gating-negativ-kontroll). Kald web-bygg grønn.

- 🟢 **MALFORVALTNING PR 1 LEVERT** — `/dashbord/firma/innstillinger/malforvaltning`. Skall + gating + SiteDoc-arkiv-fanen.
- 🔴 **`admin/bibliotek` ER REVET.** Flaten flyttet (git: rename R082) til `malforvaltning/_components/SitedocArkivFane.tsx`.
  `bibliotek.hentMalRedigering` og `oppdaterMal` slettet — **verifisert arveløse repo-vidt (grep i web+mobil = null kallere).**
  `/dashbord/admin`-unntaket i `sok-dekning.test.ts` gjenopprettet i full bredde.
- 🟢 **Gating bevist:** ren `gateMalforvaltningFaner()` — SiteDoc-admin ser SiteDoc-fanen · prosjektadmin/-bruker ser INGEN fane → flaten skjult · direkte URL «ingen tilgang» · ingen søketreff.
- 🔴 **KENNETH-VEDTAK 15.09, tre stykker:**
  1. Firmaarkiv-fanen blir ÉN liste med filtrerbar maltype-kolonne — ikke underfaner. «L9-adskillingen tapes ikke — flyttes fra faner til kolonne + filter».
  2. Papirkurv-fanen BLOKKERT: `firmamal.slett` hard-sletter (`firmamal.ts:499`), `OrganizationTemplate` mangler `deletedAt` — mockupens «Papirkurv (5)» har ingen data. Egen skjemarunde med backfill, DB-garanti og feilende test på tom kolonne. Samme runde definerer auto-tømming (N dager).
  3. `firma/malarkiv` RIVES i PR 2 — men først når Malforvaltning beviselig dekker alt, med bevis per funksjon, redirect og oppdatert «Tilbake til …»-whitelist.
- 🔴 **RETTELSE hos fabel:** hans vedtaksnotat leste «#3» som `firma/malarkiv`. Kenneths bilde #3 var `/dashbord/oppsett/produksjon/sjekklistemaler` — prosjektarkivet. Kenneth har aldri sagt at `firma/malarkiv` skal bestå.
- 🟢 **LÅST OPP: lese/redigere-aksen.** Alle prosjektmedlemmer LESER fra alle tre arkivene via «Hent fra arkiv»; kun firma-/SiteDoc-admin FORVALTER. **Rettighetskonflikten fra 12.09 er løst — matrisen var ikke feil, den manglet en akse.** 🔴 `hentStandarder`-sikkerhetsrunden er nå ulåst; `terminologi.md § 0` skal oppdateres — begge bestilles av cowork.
- 🟡 **MELDT (ingen handling nå):** ingen nav-lenke i PR 1 med vilje — en firmaadmin har ingen fane ennå, lenke til tom flate = samme løgn som `admin/bibliotek` var. Lenken legges i PR 2. Flaten nås via søk + fotnoten.
- 🟡 **MELDT:** SiteDoc-arkivet lever nå under firma-kontekst og krever valgt firma, selv om arkivet er firma-uavhengig. Harmløst (SiteDoc-admin har alltid firma valgt via FirmaVelger). Nyanse, ikke feil.
- ⚠️ **Ny i18n-gjeld: nøkler i `nb`/`en` som de tretten mangler.** 🔴 mal-Opus' nøkkelsett-test er bestilt, fanger klassen permanent.
- 🔴 **NESTE: Kenneths visuelle gate på ny rute → PR 2.**
- ⚠️ **Uendret åpent:** papirkurv i sidefeltet · funn #21 · `BibliotekMal` mangler `updatedAt` · fastefelt-kolonnene · N dager auto-tømming · fargeføringen.

---

## 🟢 2026-09-15 — Malarkiv ut av sidefeltet + alle tre arkivnivåer søkbare merget (`aab32f9e`). Utløser web-deploy.

**Merget `fix/malarkiv-ut-av-sidefelt` (ren fast-forward `84df84ab..aab32f9e`).** To commits: `ecf3df9d` (menypunkt ut) + `aab32f9e`
(alle tre arkivnivåer søkbare). 6 filer, +143/−14. i18n traff KUN `nb`/`en` (3 nye nøkler). Gate fra ROT grønn
(`pnpm install` + `prisma generate` ×4): **`db 2 · api 492 · pdf 120 · shared 823 · web 240`** — `web` steg +5 (gating-testen kjørte).

- 🔴 **Malarkiv er UTE av firma-sidefeltet** (`firma-nav.tsx`). Ruta `/dashbord/firma/malarkiv` består; kun navigasjonsinngangen er borte. Kenneth-vedtak 13.09, endelig utført 15.09.
- 🟢 **Inngang til firmaarkiv-redigering:** `oppsett/produksjon/*maler` → «Hent fra arkiv» → firma-fane-fotnoten. Alle tre maltypene (sjekkliste/oppgave/HMS) bruker `MalListe` → har modalen — ingen fane ble unåbar.
- 🟢 **ALLE TRE ARKIVNIVÅER ER NÅ SØKBARE, alle tre EKTE registreringer** — ingen låner lenger fra sidefeltet.
- 🔴 **MÅLT ROTÅRSAK (Kenneth 15.09):** firmaarkivet var søkbart kun fordi det sto i venstremenyen; SiteDoc-arkivet har aldri vært registrert. Tre-nivå-modellen bygget ett nivå om gangen uten at strukturen ble laget for tre — samme rot som at prosjektnivået manglet navn i `nb.json` før 13.09.
- 🟡 **MELDT, KENNETH GATER:** de tre arkivene sitter i TO kilder, ikke én. Prosjekt i `innstillinger-kort` (nav-hjem under Oppsett), firma + SiteDoc i `dype-sider` (ingen nav-hjem). Én felles «arkiv-gruppe»-kilde krever større omstrukturering.
- 🟢 **Gating bevist:** `gateDypeSider()` trukket ut som ren funksjon — SiteDoc-admin ser begge · prosjektbruker ser ingen · firmaadmin ser kun firma · antallskontroll fanger død gating.
- 🟢 **`/dashbord/admin`-unntaket står** — kun `admin/bibliotek` tatt ut av det.
- 🟡 **MELDT:** `innstillinger-kort.tsx` fikk et `arkiv`-søkeord (utenfor redesigns filliste, men prosjektarkivet BOR der). Cowork gater det som riktig.
- ⚠️ **`firmaNav.malarkiv` er nå relikvi (0 kodereferanser).** IKKE slettet — ryddes i en i18n-runde, unngår drift mot de tretten.
- 🔴 **NY i18n-gjeld samme dag den ble lukket: 3 nøkler i `nb`/`en` som de tretten mangler.** Nøyaktig mønsteret mal-Opus målte — hullet gjentar seg hver runde. 🔴 **Nøkkelsett-testen bestilles nå.**
- ⚠️ **Uendret åpent:** Kenneths visuelle gate av vei C del 2 · riving av `admin/bibliotek` · papirkurv i sidefeltet · rettighetsmatrisen vs. ulåst SiteDoc-fane · funn #21 · `BibliotekMal` mangler `updatedAt` · fastefelt-kolonnene.

---

## 🟢 2026-09-15 — i18n-gjeld lukket + vei C del 2 (MalBygger på SiteDoc-nivå) merget (`345476c8`). Utløser web-deploy.

**Merget to brancher** (i18n `chore/i18n-gjeld` `d06daf02` fast-forward FØRST, så vei C del 2 `feat/malbygger-sitedoc-niva` `0f353a1c` som ekte `--no-ff`-merge — ingen filoverlapp, `comm -12` tom). Gate fra ROT grønn
(`pnpm install` + `prisma generate` ×4): **`db 2 · api 492 · pdf 120 · shared 823 · web 235`** — `api` steg +6 (paritetstesten kjørte). Kald web-bygg grønn.

**i18n-gjeld:**
- 🟢 **LUKKET** — 134 nøkler (ikke 132; mal-Opus talte selv, coworks tall var foreldet). Alle femten filer har nå identisk nøkkelsett (4500). Null relikvier begge veier.
- 🔴 **OPPHAVET MÅLT:** 131 av 134 stammer fra ÉN runde — `bbc6cb36` «i18n-runde 1 — delte komponenter», der generatoren aldri ble kjørt. 2 fra `ac7afb33` (vei C del 1 TILLEGG 1), 3 fra `ed21b640`. ⚠️ Hullet gjentar seg hver runde som legger `nb`/`en`-nøkler uten å kjøre 13-språk-generatoren.
- 🟡 **FORESLÅTT, IKKE BYGGET:** `packages/shared/src/i18n/nokkelsett.test.ts` — les alle femten, krev samme nøkkelsett som `nb`. Fanger både glemt generator og relikvier. Vanlig vitest-test. **Bestilles som egen liten runde ETTER denne mergen** (ville feilet på gjelden).

**Vei C del 2:**
- 🟢 **LEVERT — MalBygger redigerer nå SiteDoc-maler.** `MalNivaa = prosjekt | firma | sitedoc`. Seks nye prosedyrer på `bibliotek.ts` (`hent`, `oppdater`, `leggTilObjekt`, `oppdaterObjekt`, `oppdaterRekkefolge`, `slettObjekt`), alle gatet av `verifiserSiteDocAdmin`.
- 🟢 **TS2589-fella omgått:** `velgMutasjon(nivaa, {prosjekt, firma, sitedoc})` med `Record<MalNivaa, unknown>` — hver gren møter `unknown` på funksjonsgrensen. Kald bygg grønn (verifisert her).
- 🟢 **Paritet BEVIST:** `bibliotek-objekt-crud-paritet.test.ts` kjører samme input gjennom begge routere og sammenligner (fem operasjoner + gate-test).
- 🟢 **`admin/bibliotek` er ikke lenger låst** — låsebanner og `LAAST_REDIGERING` fjernet, nivåbanneret tilbake. Venstre trestruktur beholdt som navigasjon, MalBygger til høyre.
- 🔴 **AVVIK MELDT, KENNETH GATER:** `BibliotekMal` mangler fastefelt-kolonnene (`subjects`, `showSubject`, `showLocation`, `showPriority`) som firma/prosjekt har. Fastefelt-seksjonen skjules på sitedoc-nivå; feltredigering er full paritet, kun malnavn er redigerbar metadata. ⚠️ Reelt avvik fra «alle tre nivåer like» — krever skjemaendring.
- ⚠️ **`hentMalRedigering` og `oppdaterMal` er nå arveløse.** MELDT ubrukte, IKKE slettet — slettes ved rivingen.
- 🔴 **NESTE:** Kenneths visuelle gate på `/dashbord/admin/bibliotek` → riving av flaten → Innstillinger › Malforvaltning. Parallelt: strengharmonisering (nå ulåst).
- ⚠️ **Parkert av Kenneth 15.09:** forhåndsvisning av felt ved klikk i «Hent fra arkiv»-modalen — «la dette vente. bygg ferdig så ser vi etterpå hva som mangler».
- ⚠️ **Uendret åpent:** rettighetsmatrisen vs. ulåst SiteDoc-fane · N dager auto-tømming · fargeføringen · funn #21 · `BibliotekMal` mangler `updatedAt`.

---

## 🟢 2026-09-15 — `admin/bibliotek` ekte lese-only (TILLEGG 2) merget (`8c84cc77`). Utløser web-deploy.

**Merget `fix/admin-bibliotek-laast-visning` (ren fast-forward `e204f00f..8c84cc77`).** Én fil, +29/−10:
`apps/web/src/app/dashbord/admin/bibliotek/page.tsx`. Ingen i18n-, skjema- eller API-endring. Gate fra ROT grønn:
`db 2 · api 486 · pdf 120 · shared 823 · web 235` — alle stille.

- 🟢 **VEI C DEL 1 VERIFISERT PÅ TEST 15.09** — begge lånevegene virker mot rad-veien: prosjekt
  (`oppsett/produksjon/sjekklistemaler` → «Hent fra arkiv» → SiteDoc-arkiv) og firma (`firma/malarkiv` → «Lån fra SiteDoc-arkivet»). Kenneth bekreftet.
- 🟢 **`admin/bibliotek` er nå EKTE lese-only** — høyre panel (`FeltKonfigurasjon` + type/fase-nedtrekk) skjules når flaten er låst.
  Venstre + midten står: tre, malnavn, referanse, beskrivelse, feltliste gruppert per fase med felttype-merke.
- 🟢 **Kun låsebanneret vises.** Nivåbanneret skjules på låst flate (vei a) — `nivaabanner.sitedoc.scope` er URØRT, MalBygger trenger den i del 2.
- 🔴 **Kenneth-vedtak 15.09: ingen `laast`-prop i `FeltKonfigurasjon`** — delt komponent + flate som rives i del 2 = feil sted å bygge gjeld. Derfor skjules panelet.
- ⚠️ **MELDT av redesign, Kenneth-gatet:** feltlisten viser etikett og type, men ikke per-felt hjelpetekst, påkrevd-flagg eller valgalternativer
  (de lå kun i høyre panel). Akseptert fram til del 2.
- 🔴 **NESTE i køen:** i18n-gjelden (mal-Opus — tallet telles på nytt, 132 ble 134 etter TILLEGG 1) → strengharmonisering → vei C del 2.
- ⚠️ **Uendret åpent:** rettighetsmatrisen vs. ulåst SiteDoc-fane · N dager auto-tømming · fargeføringen · funn #21 · `BibliotekMal` mangler `updatedAt`.

---

## 🔴 2026-09-15 — Vei C del 1 MERGET til develop (`ac7afb33`). BÆRER MIGRERING — deploy BUILD→MIGRATE→UP.

**Merget `feat/bibliotekmal-objekttabell` (ren fast-forward `fe13e5d8..ac7afb33`).** To commits: `a6bee514` (tabell + migrering, Design B)
+ `ac7afb33` (forhåndsvisning til rader + lås `admin/bibliotek`, TILLEGG 1). 21 filer, +1172/−364. Gate fra ROT grønn
(`pnpm install` + `prisma generate` ×4): **`db 2 · api 486 · pdf 120 · shared 823 · web 235`** — alle forventede tall.
i18n traff KUN `nb`/`en` (2 nøkler hver); de tretten urørt. **Jeg kjørte IKKE migreringen — Kenneth kjører den i deploy.**

- 🔴 **Migreringsmappe (slik den står i develop):** `packages/db/prisma/migrations/20260914120000_bibliotekmal_objekttabell/`
  (`migration.sql` + `DRY-RUN.sql`, sistnevnte read-only).
- 🟢 **Dry-run mot `sitedoc_test` grønn (Kenneths kjøring, coworks referat):** 12 maler · 96 felt · 132 rader · null avvik
  på alle fire negativkontroller (felt_uten_fase 0 · ukjente_nøkler tom · heading_i_json 0 · ikke-array 0).
  ⚠️ Redesign målte lokalt 95 felt / 131 rader — differansen er ETT felt på KC3.1 alene (9 i test, 8 lokalt), forventet/forklart.
- 🟢 **`BibliotekMalObjekt` speiler `OrganizationTemplateObject` felt for felt.** Design B: heading-rader materialisert, én per distinkt fase.
- 🔴 **`malInnhold` er FROSSET** — leses ikke lenger av lån, import, forhåndsvisning eller seed. **Kolonnen SLETTES IKKE — egen senere runde.**
- 🔴 **`admin/bibliotek` er LÅST TIL LESING** — flaten auto-persisterte hver endring; choke-punktet nøytralisert, kontrollene deaktivert,
  banner forklarer hvor redigeringen flyttet. `bibliotek.oppdaterMal` + `verifiserSiteDocAdmin` er URØRT på serveren. Del 2 bygger den ekte veien.
- 🟢 **`hentMalInnhold` (forhåndsvisning før lån) leser nå radene** — fase rekonstrueres fra heading-radene. Cowork fant den som krav 4-brudd før merge; redesign lukket den.
- ⚠️ **MELDT, ikke løst:** felt uten fase arver nærmeste foregående headings fase i forhåndsvisningen. Null slike felt i test/lokal/seed, og lånet gjør det samme → konsistente.
- ⚠️ **i18n-gjeld:** de tretten stiger fra 132 til **134** manglende nøkler. Mal-Opus' rydderunde skal telle selv, ikke bruke 132.
- 🔴 **NESTE: vei C del 2** — ruting av MalBygger til sitedoc-nivå, `MalNivaa = "sitedoc"`, oppdateringsvei for eksisterende SiteDoc-maler. **Så riving av `admin/bibliotek`.**
- ⚠️ **Uendret åpent:** rettighetsmatrisen vs. ulåst SiteDoc-fane · N dager auto-tømming · fargeføringen · funn #21 · `BibliotekMal` mangler `updatedAt`.

---

## 🟡 2026-09-14 — Fabels avviksgodkjenning B (heading-rader) + KC3.1 lagt bort. Ingen kode, ingen deploy.

**Committet** (`docs/redesign/avviksgodkjenning-b-heading-rader-fabel-2026-09-14.md`), uendret, fra fabel-pakke
`til-repo-2026-09-14-0940`. Verifisert: kun den ene fila, ingen `.DS_Store`, fantes ikke fra før.

- 🟢 **VEDTAK: Design B** — heading-rader materialiseres, **rad per felt + én heading-rad per distinkt fase.** A avvist
  (`config.fase` viderefører spesialtilfellet C skulle fjerne, bryter Kenneths krav om like egenskaper på alle tre nivåer).
- 🟢 **Krav 2a revidert (erstatter vei C § krav 1):** dry-run per mal viser TRE tall — felt i JSON · distinkte faser ·
  rader etter migrering — og **radantall == felt + faser** (KC3.1: 8+3=11). Negativ kontroll: heading-rader har ingen config/hjelpetekst.
  Idempotens (×2 = samme) uendret. **Fabel: «Krav 2a var formulert mot en antakelse redesigns måling motbeviste — da er det
  kravet som skal justeres, ikke speilingen.»** Overskriftene genereres ved lån (`firmamal.ts:161-176`), ikke fra JSON-felt.
- 🔴 **Konsekvens for lånevegen (krav 2 skjerpet):** round-trip-testen skal nå OGSÅ bevise at rad-veiens genererte
  overskrifter == malInnhold-veiens. Heading-radene **erstatter** genereringen i `firmamal.ts:161-176`, ikke dobles — genereringen fjernes i C del 2.
- 🟢 **KC3.1 LAGT BORT (Kenneth 14.09):** «KC3.1 er ikke helt ferdig → den er IKKE viktig → bruk versjonen som er der i dag.»
  `feat/mal-kc31-revisjon` **merges ikke, står åpen og urørt.** Migreringen tar databasens nåværende innhold. **Ingen blokkering av C del 1.**
- 🔴 **MÅLT 14.09 — seeden er IKKE fasit for databasen:** KC3.1 har `antall_felt = 9` i `sitedoc_test`, mens develop-seeden gir 4
  og `feat/mal-kc31-revisjon` gir 8. Seeden legger ikke til heading-objekter (`seed-bibliotek.ts:129-146`). Noe har skrevet til
  `mal_innhold` utenom seeden — sannsynligvis `oppdaterMal`. **Migrerings-dry-run må måle mot faktisk DB, ikke seed.**
- ⚠️ **Nytt målt, ikke bestilt:** `BibliotekMal` har `opprettet`, men **INGEN `updatedAt`** (`schema.prisma`). SiteDoc-nivået har
  ingen endringshistorikk. Henger sammen med funn #8.

---

## 🟡 2026-09-14 — Fabels KS av vei C committet (objekt-tabell på BibliotekMal). Ingen kode, ingen deploy.

**Mottatt og committet** (`docs/redesign/ks-sitedoc-niva-vei-c-fabel-2026-09-14.md`), uendret, fra fabel-pakke
`til-repo-2026-09-14-0230`. Verifisert: kun den ene fila, ingen `.DS_Store`, fantes ikke fra før.

- 🟢 **VEDTAK: vei C valgt** — `BibliotekMal` får objekt-tabell som speiler `OrganizationTemplateObject`.
  **A og B forkastet:** A etterlater et evig spesialtilfelle; B gjør «én editor» til en løgn i koden.
- 🟢 **redesigns stopp godkjent av fabel** — «stoppet på premiss FØR koding, null commits, avvik meldt … Dette er standarden».
- 🔴 **RETTELSE (coworks feil, MÅLT AV MEG):** ordren pekte på `autoriserMalTilgang`; gaten heter faktisk
  **`verifiserSiteDocAdmin`** — definert `apps/api/src/routes/bibliotek.ts:13`, kalt `:280` og `:323`. Ingen
  `autoriserMalTilgang` i fila. Samme jobb, feil navn i ordren. **Ordre-malen skal peke på FAKTISK funksjonsnavn, målt — ikke antatt.**
- 🟢 **REKKEFØLGE-konflikten jeg flagget her er BORTFALT (Kenneth 14.09):** KC3.1 er lagt bort — se runde-toppen. Migreringen tar databasens nåværende innhold; ingen KC3.1-avhengighet igjen. *(Historikk: jeg flagget at relay-ordren la KC3.1 før C del 1 mens fabels krav 4 la C del 1 først — spørsmålet er nå moot.)*
- 🔴 **`malInnhold`-kolonnen FRYSES etter migrering** (leses ikke), slettes i egen senere runde etter verifisert testperiode — **aldri samtidig med migreringen.**
- 🟢 **redesign bygger C del 1** på `feat/bibliotekmal-objekttabell`.
- ⚠️ **Uendret åpent:** rettighetsmatrisen vs. ulåst SiteDoc-fane · N dager auto-tømming · fargeføringen · funn #21 (↻ og MalBygger muterer under eksisterende dokumenter).

---

## 🟡 2026-09-14 — Fabels Malstruktur IA v2 committet (kontekststyrt malside). Ingen kode, ingen deploy.

**Mottatt og committet** (`docs/redesign/malstruktur-ia-v2-notat-fabel-2026-09-14.md` + `-mockup-…dc.html`),
uendret, fra fabel-pakke `til-repo-2026-09-14-0210` (erstattet `0145`). Verifisert: kun de to filene, ingen `.DS_Store`, ingen fantes fra før.

🔴 **v2 ERSTATTER fane-modellen fra 13.09** (Malforvaltning med tre faner) **der de kolliderer.** Bygg videre på v2, ikke fane-modellen.

**Består UENDRET fra 13.09 (fabels egne ord):**
- hente ≠ forvalte
- «Hent fra arkiv»-modalen (gruppering per standard, søk, ulåst SiteDoc-fane)
- nivåbanner og nivåfarger
- papirkurv-vedtakene (tellefelle-vakt, globalt søk-merke, 90 d)
- «rediger»-regelen · «Tilbake til …»-regelen · `terminologi.md § 0`

**Grunnmodellen (ordrett fra notatet):**
- **Inngang:** Innstillinger › Produksjon › Oppgavemaler / Sjekklistemaler / HMS-maler (dagens venstremeny-navn). Tre maltyper, identiske egenskaper.
- **Nivå:** kontekstvelgeren øverst til venstre (PROSJEKT / FIRMA / SITEDOC ADMIN). **Samme side, ulikt innhold. Ingen egne sider per nivå.**
- **Utledninger:** malnavn/Rediger → MalBygger i samme kontekst; «Hent fra arkiv» → modal (prosjekt: firma+SiteDoc · firma: kun SiteDoc · SiteDoc-nivå: ingen — kilden henter ikke).
- 🔴 **SiteDoc-nivået på samme side ERSTATTER `admin/bibliotek` HELT.**
- **Kontekstvakt i MalBygger (Kenneth 14.09):** malen tilhører nivået den ble åpnet/startet i (`openLvl`). Kontekstbytte inne i MalBygger er lov, men Publiser etter bytte krever eksplisitt bekreftelse med navngitt rekkevidde. Uten bytte publiserer knappen uten dialog.

### 🔴 ÅPEN RIVNINGSLISTE (fabel — ordre følger etter Kenneths gate, IKKE bygget)
1. «Malarkiv» i FIRMA-menyen
2. «Bibliotek» i admin-menyen + `admin/bibliotek`-editoren
3. Alle «rediger arkivet»-lenker som peker på lister
4. Eneste innganger blir: de tre maltype-sidene + kontekstvelgeren

### 🔴 Rettelse ført skriftlig (Kenneth 14.09)
Cowork delte fabels 13.09-tegning i biter og merket punkt D («ÉN editor — SiteDoc-maler i samme MalBygger, `admin/bibliotek` utgår») som «retning, ikke bestilt» — derfor peker modalens bunntekst på en LISTE, ikke en malbygger. **Kenneth:** *«du klarer ikke å formidle fabels ordre til agentene … du endrer ordren til noe annet fordi du mener fabels ordre ikke fungerer.»* **Regelen som følger: cowork relayer fabels ordre HEL. Måling mot kode er coworks jobb; omskriving av omfanget er det ikke.**

### ⚠️ Fabels «Ikke tegnet» (v2)
Papirkurvens plassering i v2 (forslag «Vis papirkurv» på malsiden, samme komponent som 13.09 — Kenneth gater) · `MalRevisjon`/Historikk (eget skjemavedtak) · oppgave-/HMS-malsidenes konkrete kolonner (identisk mønster, tegnes ikke separat) · mobilvisning.

🟢 **Neste steg er FABELS:** etter Kenneths gate skriver fabel rivnings- og byggeordre i rekkefølge (1: slett innganger · 2: kontekststyrt malside · 3: MalBygger-ruting). **Cowork skal IKKE skrive byggordrer på dette.**

---

## 🟢 2026-09-13 — Runde 98 merget: arkivmodal-søk/kollaps + nivåbanner. Utløser web-deploy (samles).

**Merget til develop** (`--no-ff`, i rekkefølge dokgen→redesign, ingen kodeoverlapp — kun 15 i18n-JSON delt, `comm -12` bekreftet):
- `feat/nivaabanner` (`0d9b0fc8`, dokgen) — nivåbanner + `TilbakeLenke`-primitiv utpakket (BACKLOG #20).
- `feat/arkivmodal-sok-kollaps` (`6b75accd`, redesign) — søk over fanene + kollaps + samme gruppemodell begge faner (BACKLOG #19).

**Gate grønn på develop-tippen:** `db 2 · api 478 · pdf 120 · shared 814` stille · `web 228→235` (+7, alle i `arkiv-sok-kollaps.test.ts`).
Utfoldings-testen (søk i sammenslått gruppe → foldes ut) og typefilter-testen (oppgavemal filtrert bort FØR søk → 0 treff) begge til stede. Kald web-bygg grønn (`prisma generate` ×4, `.next` slettet). Én tilbake-lenke per flate; papirkurv bruker delt `TilbakeLenke`.

- **redesign → LEDIG · dokgen → LEDIG.**
- 🔴 **VEDTAK, IKKE bygget ennå — fargeføring (egen runde etter Kenneth ser dem på test):** firma-blå **snapper** til `sitedoc-primary #1e40af` (to nesten-like blå = drift) · SiteDoc-fiolett → nytt token **`arkiv-sitedoc`** · prosjekt-grønn → nytt token **`arkiv-prosjekt`**, **snapper IKKE** til `sitedoc-success #10b981` (for lys under hvit tekst; suksess-semantikk feil for et nivåmerke). Fabels mørke hex (`#5843a8`/`#2451b3`/`#3f6f1f`) beholdt som utgangspunkt i mergen — ingen farge endret her.
- 🔴 **VEDTAK: «Prosjektarkiv» gis via banneret**, ikke som tvungen overskrift. Eventuell eksplisitt overskrift vurderes i harmoniseringsrunden — hvis i det hele tatt.
- 🔴 **NY ÅPEN GJELD (MÅLT): i18n-drift.** `nb`/`en` = 4498 nøkler, de 13 andre = 4366 — **nøyaktig 132 mangler, identisk i alle.** **Kenneth-vedtak: ryddes som EGEN RUNDE FØR strengharmoniseringen** («ellers harmoniserer vi oppå drift»).
- 🟡 **SISTE GATE-VALG til fabel: N dager auto-tømming av papirkurv.** Målt N=**90** i dag (`services/papirkurv-sweep.ts` + UI). Spørsmålet er om Kenneth vil endre den.

---

## 🟡 2026-09-13 — Fabels samlede IA-tegning for Malforvaltning committet. Ingen kode, ingen deploy.

**Mottatt og committet, deretter ERSTATTET med pakke `til-repo-2026-09-13-2245`** (samme to filnavn i
`docs/redesign/`, uendret innhold ellers). Diff `2210`→`2245` = kun to blokker: låsespørsmålet (notat linje 34–39
+ mockup-banneret) og «Neste steg» — begge fordi Kenneth gatet låsen direkte med fabel 13.09 kveld. Verifisert:
ingen nye filnavn, ingen `.DS_Store`.

### 🟢 LUKKET (var ÅPEN KONFLIKT): SiteDoc-fanen er ULÅST på prosjektnivå — Kenneth-gatet 13.09 kveld

- **Avgjort:** et prosjekt kan hente **direkte** fra SiteDoc-arkivet. v3-låsen utgår. Begrunnelse: en engangsmal for
  ett prosjekt skal ikke måtte innom firmaarkivet først.
- 🔴 **Rettelse (ikke bare lukking):** attribusjonen i `2210` var feil — «ulåst» var **fabels lesning av punkt E**,
  ikke coworks forslag. Coworks forslag gjaldt **kollaps og søk**, aldri tilgang. Ført her så feillesningen ikke
  reproduseres.
- **Ankeret rettet:** `terminologi.md § 0` bar «Lån kun fra nivået rett over — aldri to opp». Snudd der med ⚠️-blokk;
  det gamle vedtaket beholdt synlig under det nye (SAMARBEIDSREGLER: snudd vedtak rettes DER DET STO).

### 🔴 NY ÅPEN TRÅD — direktehentet prosjektmal har ingen ↻-vei

- **Konsekvens av ulåsingen (MÅLT av cowork, `packages/db` `schema.prisma` → `ReportTemplate`):** en direktehentet
  mal blir en **prosjektmal** og følger IKKE firmaets ↻-forvaltning. `ReportTemplate` har kun `organizationTemplateId`
  — peker den ikke på en firmamal, finnes ingen ↻ og ingen «versjoner bak».
- 🔴 **Krever et nytt avstamningsfelt mot `BibliotekMal` — skjemaendring Kenneth gater.** Fabel førte den som «senere
  vurdering»; her løftet til åpen tråd så ingen oppdager frosset-for-alltid-malen i prod.

### Øvrige punkter
- 🟢 **Fabel trakk rekkefølgekravet på #8** — coworks innvending tatt (hullet fantes fra før; #1/#2 innførte ikke oppdateringsveien).
- 🟢 **Kenneth overstyrte coworks E-forslag:** begge faner i «Hent fra arkiv» bruker nå SAMME modell — gruppert på
  standard/kapittel, «Egenlagde» egen gruppe, sammenslått ved start, søket folder ut treff. Coworks åpne-Firmaarkiv-fane forkastet.
- 🟡 **SISTE GATE-VALG: N dager før papirkurv auto-tømmes.** Dagens verdi målt N=**90** (`services/papirkurv-sweep.ts`,
  UI-tekst «90 dager»). Spørsmålet er om Kenneth vil **endre** den — ikke sette den (den finnes allerede).
- ⚠️ **Ubesvart (Kenneth):** skal papirkurv-søket treffe INNHOLD, ikke bare navn/metadata?
- ⚠️ **Fabel melder 90 % kvotebruk og stopper her.** Neste steg på hans side er ordrer til redesign — kommer etter gate.
- 🟢 **A og B er ute til bygging** (`feat/arkivmodal-sok-kollaps`, `feat/nivaabanner`). Upåvirket av `2245` (punkt B og E uendret).
- 🔴 **Fabels «Ikke tegnet» (grensene, så ingen gjetter):** `MalRevisjon`-fanens innhold · diff/merge for ↻ ·
  SiteDoc-admins editor-kapasitet · `hentStandarder`-innstramming · HMS-lenken i slett-sperren · mobilvisning av
  Malforvaltning · strengharmoniseringen.
- ⚠️ **Strengharmoniseringen er coworks jobb og utløses nå** — flatene navngitt av fabel: Malforvaltning med tre faner ·
  MalBygger-banner · Hent fra arkiv · globalt søk-merke.

---

## 🟡 2026-09-13 — Docs: ett navn per arkivnivå (Kenneth-vedtak). Ingen kode, ingen deploy.

**Vedtak ført i `terminologi.md § 0`** (rett under rettighetsmatrisen fra `a3e73a09`): hvert arkivnivå
skal hete **én** ting på flatene brukeren ser — **SiteDoc-arkiv** (`BibliotekMal`) · **Firmaarkiv**
(`OrganizationTemplate`) · **Prosjektarkiv** (`ReportTemplate`). «Bibliotek»/«Sentralarkiv»/«Malarkiv» utgår
som synlige begreper. 🔴 **Presisert at vedtaket IKKE er en datamodell-/rute-refaktorering** — tabellnavn,
ruter og kodeidentifikatorer (`BibliotekMal`, `/admin/bibliotek`, `bibliotek.ts`, `firma-nav.tsx`) røres ikke.
**Målt selv 13.09 (`nb.json`):** SiteDoc **6** navn · Firma **2** · Prosjekt **0** (nivået hadde aldri fått
et navn — sannsynlig grunn til gjentatt feilrekonstruksjon av tre-nivå-modellen). Selve streng-harmoniseringen
er egen oppgave under fabels IA-sak.

🟢 **Navnevedtaket er nå komplett (kveld 13.09):** arkiv + entall (SiteDoc-mal · Firmamal · Prosjektmal), begge i `terminologi.md § 0`. Strengharmonisering i `nb.json` gjenstår og eies av fabels IA-sak.

**Tre nye funn ført i BACKLOG (#18–#20, alle eier fabel):** #18 `admin/bibliotek` lover malbygger men kan
kun `oppdaterMal` · #19 «Hent fra arkiv»-modalen mangler kollaps + søk (gamle lånedialog hadde søk) · #20 ingen
flate viser hvilket arkivnivå du står i.

**Tavle:**
- 🟢 **Runde 97 verifisert av Kenneth på test:** avslutt-flaten, «Oppdatert»-merket og retur-lenken virker.
  ⚠️ **Ferskhetsgaten IKKE bekreftet utløst ennå** — Kenneth må prøve å avslutte med arkiv eldre enn siste endring.
- ⚠️ **«Tilbake til …» er et GENERELT behov** (Kenneth), ikke bare i papirkurven. Primitiven finnes i
  `papirkurv/page.tsx` fra runde 97 (sti-validert, whitelistet etikett). Går til fabel som del av IA-saken —
  ikke bestill flate for flate.

---

## 🟡 2026-09-13 — Runde 97: arkivgaten måler ferskhet + tre veier ut. Web-deploy samles.

**To merger, dokgen først (flere nøkler) så redesign på toppen:**
- `62381fc4` (dokgen `04341d18`) — avslutt-gaten måler arkivets **ferskhet + utløp** (løsning B, Kenneth-vedtak).
- `b5b4a490` (redesign `515f0fc0`) — tre veier ut: à jour-tilstand, papirkurv-retur, sperre-lenker.

**Gaten verifisert i koden (ordrens punkt 3):** bruker nyeste `updatedAt` på tvers av **`Checklist` OG `Task`**
(via `template.projectId`, `deletedAt: null`), **IKKE `Activity`** — dokument-mutasjonene skriver ingen `Activity`-rad,
så en `Activity`-gate ville gått grønt på utfylte felter etter eksport. Tre distinkte feilveier
(`arkivMangler`/`arkivUtlopt`/`arkivForGammelt`), `utloperVed = null` = utløper aldri (består), `sitedoc_admin`-nødutgang uendret.
**i18n-mergen gikk rent** — begge nøkkelsett (dokgen +4, redesign +5 pr. språk) verifisert intakt i nb.json, all JSON parser.
`api` 473→478 (+5, alle i `prosjekt-livssyklus-gate.test.ts`); `db` 2 · `pdf` 120 · `shared` 814 · `web` 228 stille;
kald web-bygg grønn. develop `b5b4a490`. 🔴 **Ingen migrering/OTA denne runden — men runde 95-migreringen venter fortsatt.**

**Funn/beslutninger ført:**
- 🔴 **RETTELSE:** `Activity` skrives IKKE av `sjekkliste.ts`/`oppgave.ts`/`hms.ts` — ingen framtidig gate skal bruke den som «noe skjedde»-signal for dokumenter.
- 🟡 **VURDERT OG AVVIST:** mal-filter i papirkurven — kolliderer med «Tøm papirkurv»-tellingen (tømmer alt, ikke det filtrerte). Ikke en åpen oppgave.
- 🔴 **NYTT FUNN:** HMS-lenken i slett-sperren lander på `/hms` **ufiltrert** — HMS-lista har lokalt søk, ikke URL-drevet.

---

## 🟡 2026-09-13 — Runde 96: synliggjøring + i18n-relikvie merget. Web-deploy samles.

**To merger, dokgen først (eldre base) så redesign på toppen:**
- `d363ef25` (dokgen `b08035ad`) — slettet foreldreløs `arkiv.lokalFallback` × 15 språk (0 kode-kallere).
- `da23361f` (redesign `c03c2d1a`) — synliggjøring (#1/#2/#3/#17): `versjonerBak`/↻ i mallista,
  sperrelenker, avslutt-bekreftelse, `OppdaterFraHovedmalModal` på BEGGE prosjekt-↻.

**i18n-mergen gikk rent** — verifisert at dokgens fjerning forble borte OG redesigns nøkler kom med, ingen tapt.
`api` 468→473 (+5, alle i `prosjekt-livssyklus-gate.test.ts`); `db` 2 · `pdf` 120 · `shared` 814 · `web` 228 stille;
kald web-bygg grønn. develop `<hash under>`. 🔴 **Ingen migrering/OTA denne runden — men runde 95-migreringen venter fortsatt.**
Fire nye funn ført under (iKontrollplan-sperre, papirkurv mal-filter, ↻ diff-vs-erstatning, «Avslutt prosjekt»-stale-kommentar-rettelse).

---

## 🔴 2026-09-13 — Runde 95: unik indeks mot dobbelt-lån merget. UTLØSER DEPLOY MED MIGRERING.

**Merget til develop:** `ebda4946` (`Merge: unik indeks mot dobbelt-lån … fe3e2ed6`). `--no-ff`,
verifisert mot mal-Opus' hash. `@@unique([organizationId, laantFraBibliotekMalId])` + bevart
`@@index([laantFraBibliotekMalId])` (revers-oppslag/`SetNull`). Migrering `20260913140000_firmaarkiv_unik_indeks`
= ren `CREATE UNIQUE INDEX`. **Alle fem testtall stille** (db 2 · api 468 · pdf 120 · shared 814 · web 228),
kald web-bygg grønn. 🔴 **Kenneth kjører deploy BUILD → MIGRATE → UP.** 🔴 **Prod har egen DB — kjør
dry-run + rydding mot `-d sitedoc` FØR migreringen (se tavla).** Duplikater ryddet på test 13.09.

---

## 🟡 2026-09-13 — Malforvaltnings-funnene samlet i BACKLOG

Kenneth brukte malforvaltnings-flaten i to døgn og meldte funn løpende. De 17 funnene er nå
ført som én seksjon i [BACKLOG § Malforvaltning — 17 målte funn](BACKLOG.md) med funn ·
kode-ref · grad · eier — i stedet for spredt prosa-svar (SAMARBEIDSREGLER `:56-76`). #1/#2/#3/#17
bestilt hos redesign (`fix/synliggjor-malforvaltning`), #16 hos dokgen (`fix/fjern-doed-utkastknapp`);
#5/#6/#7/#9 samlet IA-sak hos fabel; #8/#10 venter på Kenneths skjema-/data-gate; #4 AVKREFTET.

---

## 🟢 PROD DEPLOYET 2026-09-11 — `af0093b8`. 44 merger ute. Frysen er over.

**Prod sto på `1a74904b` fra 8. september. Nå: `af0093b8`.**
**Verifisert innlogget: prosjektlista laster, Kontakter-flaten med to faner og nye filtre er ute.**

🔴 **~30 minutters nedetid underveis. Rotårsak og berging: [DEPLOY-RUNBOK § 5b](DEPLOY-RUNBOK.md).**
**Kort: `deploy-prod.sh` skriver ut fire kommandoer men kjører dem ikke — `build sitedoc-web` ble
hoppet over. Prod kjørte ny api + ny database mot to døgn gammel web, hvis Prisma-klient fortsatt
kjente den droppede kolonnen. Symptomet var `error=Configuration` på begge OAuth-providere.**

🟢 **RYDDET samme natt.** `users.ny_navigasjon` ble lagt tilbake for å berge oppetid, og er nå
borte igjen: web bygget med `--no-cache` (linje 7 kjørte i 10,9 s, ikke `CACHED`) → startet →
kolonnen droppet → **innlogging verifisert i nettleser.** **Prod har ingen lapp igjen.**
**Rekkefølgen som må følges neste gang står i [DEPLOY-RUNBOK § 5b](DEPLOY-RUNBOK.md).**

🟡 **ARKIVERINGSPLIKT IKKE UTFØRT.** CLAUDE.md krever at deployet arbeid flyttes til
`historikk-2026-09.md` i samme commit. **44 rundenes historikk er ikke flyttet** — utsatt bevisst
kl. 01:30, ikke glemt. **Neste cowork tar den.**

---

### ✅ LUKKET — frysevedtaket 2026-09-08

> *«vi skal ikke gate til produksjon før den nye ui er ferdig og verifisert på develop»*

**Betingelsen ble oppfylt 09.09** (Kontakter fase 2 merget · Kenneth verifiserte: *«Veldig bra
design»* · fabels godkjenning gitt), **men sto uskrevet til 10.09 kveld.** ⚠️ **Lærdom: en
oppfylt betingelse som ikke føres, holder arbeidet frosset like effektivt som en uoppfylt.**
**Løst ved deployen over.**

### Gate-status på det som lå på test før prod-deployen

| Sak | Status |
|---|---|
| Kollisjons-deteksjon med tilføyelse | 🟢 Gatet 08.09 · ⚠️ **repeater-variant rettet 09.09** (`d4df351e`) |
| Faggruppe-medlemskap redigerbart | 🟢 Gatet |
| `medlem.registrer` (én registreringsvei) | 🟢 **Fase 2 merget 09.09** — Kontakter i tre nivåer |
| Dialog/kommentar offline | 🟢 **RETTET 09.09** (`62446dce`) — vakt + beskjed, teksten står |
| Tekstfelt nullstilles under skriving | 🟢 **RETTET 09.09** (`f1dea4db`) — delt `kollisjonReset.ts`, re-dirty felt bevares |

## 📅 2026-09-10 KVELD — rundene 65–72. Rettighetsmodellen gjennomgått, syv stille tomheter funnet

**Develop `74d641f5` · test verifisert løpende · prod urørt.**
**Utløst av Kenneths egen testing på test.sitedoc.no gjennom dagen.**

| Runde | Innhold | Hash |
|---|---|---|
| 67 | `DROP COLUMN ny_navigasjon` — flagget overlevde sin egen utrulling | `a98a19cb` |
| 68 | `ProjectGroup.systemNokkel` — HMS-gruppa var ikke entydig | `0e17ce1a` |
| 69 | «Velg andre» ut av HMS-flyten · personkortets HMS-filter · prosjektadmin-kort | `29a49606` |
| 70 | `prosjekt_oppretter`-rollen · to persondata-gjerder | `783abca1` |
| 71 | Gruppeansvarlig (`isAdmin` fra mars) · «egen avdeling» deaktivert | `13fcc4cf` |
| 72 | «Leser» én kilde · HMS-arv fjernet · firmatilknytning + to sikkerhetsfikser | `74d641f5` |

### 🔴 To reelle sikkerhetshull lukket

**1. Rettighetseskalering i `medlem.registrer`** (`d11958ef`): admin-grenen validerte ikke
`organizationId` i det hele tatt. **En prosjektadmin kunne gi en ansatt i firma B et medlemskap i
firma C — også et ekte kundefirma.** Målt og bekreftet av redesign. `!erAdmin`-grenens sjekk
hadde ingen motpart i admin-grenen.

**2. `organisasjon.opprett` uten tilgangssjekk**: enhver innlogget bruker kunne opprette et firma
med fritt navn. 🟢 **Null kallere i web/mobil, og prod hadde null skall-firmaer i bruk** — så
gaten brøt ingenting. ⚠️ **Konsekvens: ingen UI-vei til å opprette skall-firma. Kenneth oppretter
dem selv ved behov; en gatet prosjektrute er egen sak etter pilot.**

### 🔴 MØNSTERET som ble funnet — syv «stille tomheter» på én dag

**Utløste husregelen «Stille tomhet er forbudt» (CLAUDE.md § Viktige regler, 2026-09-10).**

| # | Hva | Tilstand da den ble funnet |
|---|---|---|
| 1 | `users.ny_navigasjon` | Flagg overlevde utrullingen. 10 identiske verdier, null lesere |
| 2 | `group_faggrupper` | Skrivevei fjernet `e14f2aa0` 23.03. **Tom i 22/22 prosjekter i et halvt år** |
| 3 | HMS-gruppe-deteksjon | To grupper bar `domains:["hms"]`, `find()` plukket vilkårlig |
| 4 | `ProjectGroupMember.isAdmin` | Bygget 23. mars, **aldri lest av én linje**. Løst i runde 71 |
| 5 | `DokumentflytMedlem.kanRedigere` | Settes i UI, leses kun av klienten. **Serverhåndheving ført som 🔴 MÅ GJØRES etter pilot** |
| 6 | `hr_ansvarlig` | Settbar i firma-UI, **null håndheving**. Kravlista finnes, ikke gatet |
| 7 | «Prosjekter i egen avdeling» | Valgbar og lagret, gjorde ingenting (`Project` mangler `avdelingId`). Deaktivert i runde 71 |

🔴 **Fellesnevneren var ikke at feltene var tomme — det var at tomheten var STILLE.** Alle sju ble
funnet ved at Kenneth så noe rart på skjermen, ikke av systemet. **Derfor krever regelen nå (c):
en test som FEILER når feltet er tomt.**

### Vedtak tatt 2026-09-10

| Vedtak | Kenneths ord |
|---|---|
| Firmaadmin arver **ikke** HMS-admin | *«nei -> firmaadmin setter seg selv som HMS»* |
| Mathias Jensen mister firma-HMS | *«han er ikke medlem i flyt i dag i noen av prosjektene»* |
| `kanRedigere` gjelder **gruppen**, ikke person | *«jeg er enig at den skal gjelde gruppen»* |
| «Gruppeansvarlig» er rett nivå — bruk `isAdmin` | *«da bruker vi det vi har -> det var allerede laget»* |
| Feilregistrering ≠ firmabytte | To hendelser, ulik historikk-behandling |
| Rettigheter vises der de finnes, redigeres der de hører hjemme | Utledet av «Velg andre»-vedtaket, anvendt fire steder |
| `opprettTestprosjekt` parkert | *«aktiviseres og utbedres senere når jeg har bedre oversikt»* |

### ⚠️ Fire flater som løy — «knappen skal ikke lyve»

**Knapper synlige for folk serveren avviser.** Funnet fire ganger samme dag:
`BrukergruppeFane.tsx:159` (løst) · `oppsett/brukere/page.tsx:279-294` (løst) ·
gruppekortets navn-rediger/slett (løst) · **domener/moduler-editoren i gruppepanelet — meldt av
redesign, ikke fikset, egen sak.**

### Åpne saker etter dagen

🔴 **`hr_ansvarlig`** — kravlista er Kenneths (attestering · legge til · deaktivere ansatte).
**Ikke gatet. Coworks anbefaling: etter pilot.**
🔴 **`kanRedigere` serverhåndheving** — BACKLOG som MÅ GJØRES, med full måling.
🟡 **ⓘ-forklaring på kortene** — Kenneth savnet den på HMS-kortet tre ganger. Omfang ikke gatet.
🟡 **Duplikat-forebygging på firmanavn** — prod hadde to tomme «Sitedoc»-skall-firmaer (slettet
av Kenneth 10.09). **To tilfeller på et halvt år; egen sak etter pilot.**
🟡 **`byttEier`** (`oppgave.ts:2088`, `sjekkliste.ts:1924`) har ingen dokumenttilgangssjekk.

## 📅 2026-09-09/10 — TI MERGER. Kritisk vei til prod er gjennomført

🟢 **Kontakter fase 2 er merget OG verifisert av Kenneth på test.** *«Veldig bra design.»*
🔴 **Prod er fortsatt frosset** — fabels designgodkjenning gjenstår, og Kenneth fant fire nye
funn på test etter verifiseringen.

**Merget denne runden** (develop `a169afbc` → `15ef9602` under merge):

| Sak | Hash | Utløst av |
|---|---|---|
| Tilføyelser vises i arkiv-PDF | `38e8afaa` | 🔴 Kenneth på test — notatet manglet i dokumentet byggherren får |
| Kollisjons-reset visket ut tekst under skriving | `f1dea4db` | 🔴 Kenneth: *«feltet ble låst etter første setning»* |
| Dialogen svarer offline | `62446dce` | 🔴 Kenneth: *«når jeg trykker send skjer ingen ting»* |
| PSI-scrollrester fjernet | `51b6de21` | Lukket sak, restene utløste tre etterforskninger |
| Web-PSI signerer ikke falskt | `2ee6e343` | «Fullført» vistes før serveren bekreftet |
| Stille mutasjoner svarer | `3630e0d4` | 🔴 **Send/Besvar/Videresend ga FALSK SUKSESS offline** |
| Mobil-PSI: fullført venter på server | `890d17e2` | Samme klasse, andre flate |
| `--only`-flagg på i18n-generatoren | `cd9996ba` | Generatoren dro med seg 132 driftede nøkler |
| CLAUDE.md renset | `1875908b` | i18n-tallet var «~2500», faktisk **4 317** |
| Kontakter fase 2 | `3ffa6fee` | Fabels designlås |
| Forent søkemodal | `c1da46f4` | 🔴 Kenneth: tomt nedtrekk i «Legg til medlem» |
| Kolonner + filterblokk | `ef84d1dd` | 🔴 Kenneth: brukergruppe-filter sto under **Firma** |
| Repeater-kollisjon på celle-nivå | `d4df351e` | 🔴 Kenneth: falsk melding + **rå JSON i notatet** |
| Brukerminne på server (fase 1) | `15ef9602` | 🔴 Kenneth mistet «sist brukt» ved reinstallering |

🔴 **Ti av fjorten sakene kom fra Kenneths egen testing.** Ikke fra agentene.

**Fortsettelse 10.09 — fire merger til, develop `705cef2e` → `fe226986` under merge:**

| Sak | Hash | Utløst av |
|---|---|---|
| Repeater-kollisjon på celle-nivå | `d4df351e` | 🔴 Kenneth: falsk melding + rå JSON i notatet |
| Brukerminne på server, fase 1 | `15ef9602` | 🔴 Kenneth mistet «sist brukt» ved reinstallering |
| «+N»-teller åpenbar via tooltip | `b0cf5164` | Fabels formkrav til designgodkjenningen |
| Gammel navigasjon, trinn 1 | `03ba723d` | 🟢 PROD-måling: **10/10 brukere på ny nav** — netto **−844 linjer** |
| Brukerminne: én rad per prosjekt | `fe226986` | Strukturavvik fanget ved DB-verifisering |

🟢 **Deployet til test `705cef2e` + OTA publisert.** Migreringen `bruker_innstilling` verifisert
i DB: begge partielle indekser, FK mot `users(id)`.

🟢 **Kenneth verifiserte repeater-fiksen på telefon:** *«kollisjonstest på telefon er mye bedre.
Endringsloggen beskriver hva som skjedde.»*

⚠️ **Ny fast regel i ordre-malen:** `git rebase origin/develop` **rett før push**. Fem ganger
09.09 måtte cowork be om rebase i etterkant fordi develop hadde flyttet seg — base-illusjonen
viste da fremmedfiler som «slettet» i diffen.

⚠️ **Og en testmetode som ikke skal brukes igjen:** cowork ba Kenneth avinstallere appen for å
verifisere brukerminnet. **Appen er lokalt signert — å få den tilbake krever et nytt bygg.**
🟢 **DB-spørring beviste skrivingen uten risiko.**

### 🔴 FUNN 10.09 — nye prosjekter har vært TOMME siden 6. april

**Redesign målte tre opprettelsesveier. To seeder ingenting:**

| Vei | Grupper | Faggrupper | Dokumentflyter | Moduler/maler |
|---|---|---|---|---|
| `prosjekt.opprett` — **hovedveien** | ❌ | ❌ | ❌ | ❌ |
| `admin.opprettProsjekt` | ❌ | ❌ | ❌ | ❌ |
| `opprettTestprosjekt` | ✅ | ✅ | ✅ | ✅ |

🔴 **Rotårsak (`git log -S`):** kalleren lå på KLIENTEN — en lazy-seed på Brukere-siden
(`c6dc930e`) som selvhelbredet prosjekter ved første besøk. **Fjernet som kollateral i
`9a489876`** («Fjern gammel gruppevisning», 6. april, −1599 linjer). **Aldri et vedtak.**

**PROD-måling:** malen har 6 grupper; **ingen prosjekt har mer enn 5 fra mal.** Differansen er
håndlaget — 2 grupper på ytterstifjorn, 4 på Instinniforbotn.
🟢 **Hullet er betalt i manuelt arbeid, ikke i tomme prosjekter.**

**Rettet i `29b1eab3`:** delt `seedStandardProsjektoppsett` kalt fra alle tre veier i samme
transaksjon. 🔴 **Treffer piloten — A.Markussen oppretter prosjekter gjennom hovedveien.**

### ⚙️ ARBEIDSFORM ENDRET 10.09 — deploy koster Kenneths tid, merge gjør ikke

**Kenneth:** *«vi gater mange små fikser med deploys som tar mye tid»*

🔴 **Hver ordre merkes 🔴 (deploy nå) eller 🟡 (samles).** Full regel:
[SAMARBEIDSREGLER § DEPLOY KOSTER KENNETHS TID](SAMARBEIDSREGLER.md).
🟢 **Deploy blokkerer kun merge-agenten** — kode-agenter bygger videre, cowork venter ikke.

### Åpne saker etter runden — alle ført i [BACKLOG](BACKLOG.md) med måling

| Sak | Type |
|---|---|
| Faggruppe: egenskap eller resultat? | 🟢 **Avklart** — datakvalitet, ikke modellfeil |
| `group_faggrupper` | 🟢 **Avklart** — halvferdig, venter spor1 Ordre 1.3. **IKKE RYDD** |
| Gammel navigasjon avvikles | 🟡 **Kartlegging pågår** — prod: **10/10 brukere på ny**, gammel er død |
| Offline-klargjøring serveren kjenner | 🟡 **Fase 2 — designsak til fabel** |
| «Lagre mine filtre» | 🟡 **Designsak til fabel** |
| Maskinoversettelsene er kontekstløse | ⏸️ **UTSATT med vilje** — 1 089 inkonsistenser målt |
| HMS-gruppen gir HMS-admin | 🟠 Trenger forklaring i UI |
| Firmaadmin mangler domene-flate | 🟠 Må inn i hvert prosjekt |

⚠️ **Lærdom ført i BACKLOG: «null kallere» ≠ død kode.** Tre saker samme døgn, tre ulike utfall.
**Cowork gjettet feil på to av tre.** Mål *hvorfor* koden forsvant, ikke bare om den kalles.

## 📅 2026-09-07 SENKVELD — merge-runde 32 + 33 på develop, venter Kenneths gater

**Ikke i prod ennå.** Tre brancher merget etter `69ca9f62`:

| Merge | Innhold | Leveringsvei | Gate (Kenneths øyne) |
|---|---|---|---|
| `160d8f77` → develop (r32) | 🔴 **Kontoovertakelse via e-post-claimet lukket** — `oid`-oppslag før e-post (`:236` før `:253`), og identitets-e-post kun fra `preferred_username`. `mail`/`email` er visnings-fallback for navn, aldri identitet | api → test-deploy | MS-innlogging på mobil mot test, egen konto |
| `24505fbd` → develop (r33) | Død implisitt Google-vei slettet — `loggInnMedGoogleWeb` + web-callback + AuthProvider-no-op, −47/+2 | mobil-JS → `eas update` kanal `test` | Google-innlogging på mobil mot test, egen konto |
| `2b235e8a` → develop (r33) | **Arkiv-PDF strakk kart og tegninger** — `malBildeDimensjoner` leser JPEG-headeren i api når `Drawing.imageWidth/Height` er `null` | api → prod-deploy | Arkiv-PDF: lokasjonskart ikke strukket, markør står riktig |

🟢 **Testtall målt etter r33: api 330 · pdf 113 · shared 737 · web 210.**
(api 328 → 330 og pdf 110 → 113; de to api-testene kom fra `tegningsmarkorer.test.ts` og var ikke
forutsett i ordren, men matcher diffen.) 🟢 **Ingen migrering i noen av de tre.**

🔴 **Rotårsaken til tegningsstrekket lå ikke der cowork trodde.** Ordren pekte på
`preserveAspectRatio="none"`. Agenten målte at `none` er en **no-op i normaltilfellet**:
`beregnUtsnittVindu` gir et normalisert rom (`vbH=100`, `vbW=aspect×100`), så viewBoxen har bildets
eget sideforhold. **Strekket oppstår kun i fallback-grenen** der dims er `null` — da blir
`vbW=vbH=100`, en kvadratisk viewBox mot et rektangulært ortofoto. Dims er null for ukonverterte
PDF-er, eldre rader og ortofoto.
🟢 **`packages/pdf/src/tegning.ts` er urørt → koordinatrommet står → den frosne baselinetesten er
grønn.** Kostnad målt: ~0,1 ms per kall, kun for tegninger uten lagrede dims; 0 i normaltilfellet.

⚠️ ~~**Varig fiks ført, ikke bestilt:** backfill `Drawing.imageWidth/Height` i DB.~~
🔴 **RETTET SAMME KVELD — den finnes allerede.** `tegning.backfillDimensjoner`
(`apps/api/src/routes/tegning.ts:663`) er en `protectedProcedure` som fyller manglende dims per
prosjekt fra fila på disk. **Cowork førte den som ubygget uten å måle** — sjuende gang samme
klasse denne uka.

⚠️ **Men den dekker ikke alt:** `where` filtrerer på `fileType: { in: ["png","jpg","jpeg","svg"] }`.
**Ukonverterte PDF-er faller utenfor** — og de er nettopp en av de tre kildene til `null`-dims som
utløste tegningsstrekket. **Ingen kjent UI-vei kaller prosedyren.** Ført som åpent spørsmål, ikke
som ordre: *dekker backfillen de radene som faktisk mangler dims, og hvem kaller den?*

## 📅 2026-09-07 KVELD — prod `69ca9f62`, auth-tråden lukket

**develop = main = `69ca9f62` · test `7aa85094` · OTA production `7aa85094` (group `b2c066e6`)**

🟢 **MICROSOFT-INNLOGGING VERIFISERT I PROD PÅ TELEFON 2026-09-07.** Første gang den virker på en
OTA-levert app siden 04.09.

⚠️ **Cowork bommet på siste steg:** sa «ingen ny prod-OTA trengs, bundelen har alt den ekte
klient-id-en». **`84a89500` var fra FØR env-fiksen** (den kom i runde 29). Fanget da Kenneth så
plassholder-feilen på produksjonsappen. **Sjette gang samme mønster: hukommelse i stedet for
måling** — én `git show 84a89500:apps/mobile/.env.production` ville avgjort det.

| Levert i denne releasen | Hash |
|---|---|
| 🔴 **Mobil-MS dropper `User.Read`** — ID-token validert med `jose` mot Entras JWKS, Graph `/me` borte | `19a2884e` |
| 🔴 **OTA-env-landminen lukket** — `EXPO_PUBLIC_MICROSOFT_CLIENT_ID` var plassholder i `.env.*`; **alle OTA-er siden 04.09 bar den** | samme |
| 🔴 **Flertenant ID-token-validering** — `iss` mot tokenets eget `tid`, ikke pinnet tenant | `7aa85094` |
| Seed-uttrekk — `finnEllerOpprettDemoFirma`, sjuende kopiklasse lukket | `cb2f815b` |
| Feilede dokumenter synlig i eksport-UI | `4308352c` |
| **DEPLOY-RUNBOK** — 12 filer bar deploy-kommandoer, nå én kilde | `abdef2c2` |

### 🔴 Auth-tråden — hva den faktisk avdekket

Utløst av **ett spørsmål fra Kenneth om et Google-varsel.** Kjeden som fulgte:

1. **Google ber om minimum** — omfanget var aldri problemet.
2. **Mobil-MS ba om `User.Read`** — Graph-tilgang til hele Entra-profilen for data som lå i ID-tokenet.
3. **Google Cloud Console flagget «not using the state parameter»** — en ekstern målekilde vi hadde
   hatt gratis i måneder og **aldri åpnet**.
4. **`EXPO_PUBLIC_MICROSOFT_CLIENT_ID` var en plassholder** committet 25.03, ufarlig til OTA ble
   leveringsvei 04.09. **Microsoft-innlogging på mobil hadde vært død i en uke.** Ingen hadde prøvd.
5. **`iss` pinnet mot `/common`** ga 401 — og coworks foreslåtte fiks («pinn mot vår tenant»)
   ville **sperret hver eneste kunde.** Fanget før merge.

🔴 **Ført i [`sikkerhet.md`](sikkerhet.md) § DEKNING:** gjennomgangen så på hva som skjer ETTER
innlogging, aldri på HVORDAN innlogging skjer. Fila har nå en dekningstabell.

⚠️ **Åpent, meldt av redesign, ikke bygget:** admission-gaten matcher på `email`-claimet, som en
tenant-admin kontrollerer, framfor domene-bundet `preferred_username`. **Pre-eksisterende og
uendret av releasen** — men egen runde. **Og `iss`/`tid`-testen mangler** (api-tall uendret 319).

🟡 **Google implisitt flyt** (`relay/inbox-google-implisitt-flyt.md`) — ferdig skrevet, ikke gitt.

## 📅 DØGNET 2026-09-06/07 — ti merge-runder (17–26), prod-release `d4c4c65d`

**develop `8ee4e681` · main `d4c4c65d` · test `8ee4e681` · api-testtall `315` (merge-agentens
måling, runde 26 — coworks 298 var feil)**

🟢 **Prod-release 2026-09-07: 58 commits, NULL migreringer.** Bygg og restart.

| Levert i denne releasen | Hash |
|---|---|
| 🔴 **Tenant-lekkasje lukket** — fem skriveveier uten firmasjekk + uautentisert `/prosesser`-endepunkt fjernet | `d58e080f` |
| Byggeplassfilteret — 9 kopier → 1 kilde, **tre skjulte bugger lukket** | `a076236f` |
| Grenseresolver trinn 0–3 — kravtype, Vei B-varianter, PDF-krav, server-frys, avviksfelt | `dc93d01d`+ |
| Prosjekt-livssyklus (FL) — avslutt/arkiver fryser tilgang via delt guard i 11 porter | `36dc3029` |
| Prosjektarkiv-UI + eksport-rettighet til firma-admin | `3c6df4bf` · `1d4bf629` |
| Mal-endringsvern — krav i bruk kan ikke endres · herkomst-linje i utfylling | `c1f202dd` |
| Trafikklys-etiketter — synlige navn, **femte kopiklasse lukket** | `8d063d1d` |
| Arkivfunn — leselige tegninger, timer/utlegg ut, manifest forklart | `325a0b7e` |

🟢 **PROD BEKREFTET `d4c4c65d`** (2026-09-07 06:04Z, `curl api.sitedoc.no/version`).

🟢 **MOBIL-OTA FYRT 2026-09-07 — `84a89500`, group `6ce8ebd6`.** Commit-linja uten asterisk og
**identisk hash med prod-API-et** — bundel og server i takt. Steg 2-målingen ga én treff:
`https://api.sitedoc.no`. Ute hos testerne: dokumentsøk mobil, byggeplass-velger, innboks-pila,
utlogging, SJA-signaturrunder, grensekrav med herkomst-linje, trafikklys-etiketter.
⚠️ **Etterslepet var ~17 timer** — OTA-en ble den eldste åpne saken mens web og api gikk ut i to
prod-runder. **Lærdom: mobil-JS hører i samme runde som prod-deployen, ikke etter den.**

### Runde 27 (2026-09-07) — venter test-verifisering

| Levert | Hash |
|---|---|
| 🔴 **Arkiv fase 3** — dokumentene ER endelig i pakken. Én PDF per dokument, mappe etter domene (SJA→`hms/`), per-dokument `try/catch`, papirkurv ute, **ekte progresjon** (baren var falsk før), template-løse HMS-avvik via bestiller-faggruppe | `8e9a2652` |
| Malbyggerens stille feil — `oppdaterObjekt`/`oppdaterRekkefølge` manglet feil-callbacks; `slettFeil` → `feilVisning` for alle tre avslag | `a6fc03b5` |

**Kostnad målt og ført i `dokumentgenerering-plan.md`:** ~1 s/dokument + ~0,09 s/bilde.
200 dokumenter = 3–25 min, **drevet av bildetetthet, ikke antall.**

🟢 **«Lagring av ugyldig verdi fungerte» — målt, vernet lekker IKKE.** De tidlige lagringene gikk
gjennom fordi utkastet ennå ikke hadde verdi i akkurat det feltet. Det var stillheten hele veien.

⚠️ **Fem funn kom fra Kenneths egen test-verifisering**, ikke fra gaten: uleselige tegninger ·
lønnsdata i arkivet · uforklart manifest · krav som endret seg under føttene · **dokumentene som
ikke var der i det hele tatt.** Ingen av dem kunne build eller typecheck ha fanget.

## 📅 DØGNET 2026-09-04 — ti merger, to prod-deployer, OTA i drift

**develop `3c905298` · prod `96eebc13` · test `ea729ced` · TestFlight bygg 54 + OTA**

| Runde | Hash | Ute hos |
|---|---|---|
| EXIF opptakstid og -sted på bilder | `c6de4385` | **prod + testerne (OTA)** |
| Lesbar endringslogg (kolonnenavn, fra→til, UUID skjult) | — | **prod + testerne (OTA)** |
| Opptakstidspunkt i web | `d610acb8` | develop |
| Sidebrekk «BILDER» + navnløst felt i PDF | `f13b2421` | develop |
| Navnløst felt lagres som tom streng | `09102794` | develop |
| Web ut av `platforms` (åpnet OTA-veien) | `2b73ae68` | develop |
| AM4 malarkiv **bolk 1** — migrering + `firmamal.*` | `91e3e5a6` | **test** |
| lokasjonOmfang + L9 + paritetsfiks | `9a94a249` | **test** |
| AM4 malarkiv **bolk 2** — firma-arkiv UI | `2cfdbaea` | **test** |
| Arkiv-PDF for oppgave + HMS avvik/RUH | `a2c7edc9` | develop |

**Tre migreringer, alle additive:** `20260904120000_malarkiv_hms_kolonner` (5 kolonner) ·
`20260904140000_lokasjon_omfang` (2 kolonner). Begge anvendt på test, ingen på prod ennå.

🔴 **Venter prod-deploy:** web-opptakstidspunkt · PDF-sidebrekk · navnløst felt · malarkiv (bolk
1+2) · lokasjonOmfang · arkiv-PDF for oppgave/HMS. **Verifiser på test som innlogget først** —
malbyggeren fikk 91 nye linjer og brukes av alt.

## 📋 STATUSTAVLE — hvem gjør hva nå (vedlikeholdes av cowork, **målt 2026-09-12**)

🔴 **Forrige tavle sto på 11.09 natt gjennom rundene 74–84** — fem agenter, ~15 ordrer, ingenting
ført. **Tredje gang samme drift** (28.08→07.09 · 07.09→11.09 · 11.09→12.09). **Rotårsak målt:
cowork påsto i ~15 t at dokgen arbeidet uten å kjøre `git branch -r` én gang.** Tavla er coworks
ansvar, måles ved sesjonsstart — den er det eneste som overlever en compact
(SAMARBEIDSREGLER `:610`).

**Målt tilstand nå (verifisert mot git 2026-09-12):**

| Hva | Hash | Merknad |
|---|---|---|
| `develop` | **`758a193a`** | Verifisert `= origin/develop` |
| `main` / prod | **`af0093b8`** | 🔴 **Uendret siden 11.09 — 62 commits bak develop** (git-målt, ikke ~45 som meldt). Ingen release planlagt |
| **test** | `758a193a` | Cowork verifiserte med `/version`. ⚠️ Kan ikke git-verifiseres herfra (`/version` gir HTML, ikke SHA); test≠prod bekreftet via ulik CSS-hash |

🟢 **Ingen åpne fjernbranches** — `git branch -r` viser kun `develop`, `main`,
`redesign/navigasjon`, `wip/diag-exif`, `wip/diag-ko-trigger` (de to `wip/`-ene er umerget MED
VILJE, se under).

🟢 **Gate ved siste måling (cowork-tall):** db 2 · api **457** · pdf 120 · shared **796** · web **223**.

### 🔴 Agentregister — målt med `git branch -r` + `git worktree list` 2026-09-12

⚠️ **Cowork kan IKKE måle worktree-HEAD selv.** Et worktree har en `.git`-**fil** med absolutt sti
til `.git/worktrees/<navn>` i hovedtreet — den stien finnes ikke i coworks sandkasse, så `git`
feiler der. **Cowork kan lese FILER i trærne og kjøre `git branch -r` (delte refs), men ikke
HEAD/branch/status per tre. Det må Kenneth (eller merge-agenten i hovedtreet) kjøre:**

```sh
cd ~/Documents/Programmering/SiteDoc && git fetch -q origin && for w in dokgen kontrollplan redesign mal merge simulator; do p=~/Documents/Programmering/SiteDoc-$w; if [ -d "$p" ]; then echo "$w: $(git -C $p rev-parse --short HEAD) [$(git -C $p rev-parse --abbrev-ref HEAD)] · $(git rev-list --count $(git -C $p rev-parse HEAD)..origin/develop) bak · $(git -C $p status --porcelain | wc -l | tr -d ' ') urene"; else echo "$w: MANGLER"; fi; done
```

⚠️ **`prunable` i coworks `git worktree list` er STØY** — det speiler bare at sandkassen ikke når
stien. **Det betyr ikke at treet kan ryddes.**

| Agent | Worktree | Tilstand | Spor |
|---|---|---|---|
| **kontrollplan** | `SiteDoc-kontrollplan` | 🔴 **STOPPET** — `fix/kontrollpunkt-laasning` | ⚠️ **Duplikat — skal IKKE gjenopptas.** Låsningen ble løst av dokgen (`44487811`, merget runde 85) mens dokgens arbeid lå upushet og usynlig i `git branch -r`. Cowork bestilte samme fiks her; det var coworks feil, ikke kontrollplans |
| **redesign** | `SiteDoc-redesign` | 🟢 **LEDIG** — `515f0fc0` detached (merget commit) | 🟢 **Tre veier ut MERGET runde 97 (`b5b4a490`):** à jour-tilstand (`malbygger.firmaarkiv.oppdatert`), papirkurv-retur (retur-sti fra `usePathname()`, whitelistet mot open redirect), sperre-lenker (til dokumenter/kontrollplan). `mal.ts` urørt (bygget fra data i lista → api stille). Bevisste valg: mal-filter i papirkurv **avvist** (kolliderer med «Tøm papirkurv»-telling), HMS-lenke **ufiltrert** (lokalt søk, ikke URL-drevet). Tidligere: typefilter på SiteDoc-fanen + rollestyrte bunntekst-lenker **merget runde 94 (`ecd390c6`)**: klient-typefilter (`arkiv-fane-filter.ts`), `kanRedigereFirma`/`kanRedigereSitedoc` fra `autoriserMalTilgang`, forklarende tom-tilstand. `bibliotek.ts` kun `select` (`kategori`/`domene`), ingen serverfilter. api 465→468 (+3 rediger-signal), web 223→228 (+5 typefilter, m/eksklusjons-asserts). 🟢 **Synliggjøring + bekreftelse (#1/#2/#3/#17) MERGET runde 96 (`da23361f`, `c03c2d1a`):** `versjonerBak`/↻ i mallista, sperrelenker, avslutt-bekreftelse, og `OppdaterFraHovedmalModal` på BEGGE prosjekt-↻ (`MalListe.tsx` + `MalBygger.tsx`) — ikke på firma←SiteDoc (`malarkiv/page.tsx` urørt, tilsiktet: bytte der er trygt). api 468→473 (+5, alle i `prosjekt-livssyklus-gate.test.ts`). Scope-avvik godkjent av cowork (mal.ts +5 `copiedFromOrgTemplate`, teller kun i mallista, ingen web-test). 🔴 **Nytt funn IKKE fikset: `faneWhere` (`firmamal.ts:64-77`) mangler negativkontroll — egen runde.** Forrige: fjern Rapportmaler-flata runde 90 (`71202903`) |
| **dokgen** | `SiteDoc-dokgen` | 🟢 **LEDIG** — `04341d18` detached (merget commit) | 🟢 **Avslutt-gaten måler arkivets ferskhet MERGET runde 97 (`62381fc4`, løsning B):** nyeste `updatedAt` på `Checklist`+`Task` (via `template.projectId`, `deletedAt: null`), tre feilveier (`arkivMangler`/`arkivUtlopt`/`arkivForGammelt`), `utloperVed=null`=aldri. 🔴 **Målte coworks `Activity`-premiss FEIL og stoppet:** `sjekkliste.ts`/`oppgave.ts`/`hms.ts` skriver ingen `Activity`-rad → valgte `updatedAt`. api 473→478 (+5). Tidligere: iOS-forhåndsvisning av arkiv-PDF **merget runde 93 (`75d9e70d`)**: `allowingReadAccessToURL` på WKWebView-source (Android-propene var no-op på iOS), `onError`/`onHttpError` → feil-overlay som stopper spinneren, `kilde` fortsatt ren `useMemo([filUri])`. 2 i18n-nøkler. 🟢 **GATE OPPFYLT 13.09: Kenneth bekreftet PDF-forhåndsvisningen virker på fysisk iPhone.** 🟢 **`arkiv.lokalFallback` (foreldreløs, 0 kode-kallere) SLETTET × 15 språk, MERGET runde 96 (`d363ef25`, `b08035ad`).** `shared` stod på 814 gjennom slettingen — ingen test leste nøkkelen. Tidligere: auto-kollaps runde 91 (`758ea071`). 🟢 **Runde 96 var ren i18n → ingen OTA.** |
| **mal-Opus** | `SiteDoc-mal` | 🟢 **LEDIG** — `a66c18f4` detached (merget commit) | KB6 v2 Planting (10 felter/3 faser) **merget runde 93 (`c3a92b7a`)**. 🟢 **Gatet av KENNETH 13.09** («gjennomgått og godkjent … bilder kontrollert mot telefon»), **ikke av fabel** — Kenneth er produkteier, ikke let etter et fabel-svar. 🟢 **NS 4400-tråden lukket som PRINSIPP** (MAL-METODE §7a: NS-standarder refereres med utgave/år, ordlyd gjengis aldri) — KB6 trengte ingen innholdsendring, ikke gjenåpne per mal. create-only bekreftet på merge-resultat. Også: MAL-METODE §7/§7a docs-branch merget samme runde. 🟢 **LEDIG også etter unik-indeks-runden (95, `fe3e2ed6` merget).** 🔴 **`feat/mal-kc31-revisjon` venter fortsatt på Kenneths innholdsgate.** Tidligere: KA7 + KB2 + KB4 v2 (runde 86) |
| **merge-agent** | `SiteDoc-merge` | 🟢 **LEDIG** — `merge-restart` @ develop `b5b4a490` | Runde 97 sist: merget dokgen (`62381fc4`, arkivgate-ferskhet) FØRST, så redesign (`b5b4a490`, tre veier ut) på toppen — i18n-mergen ren, begge nøkkelsett verifisert intakt (dokgen +4, redesign +5 pr. språk), all JSON parser. Gaten verifisert i kode: `updatedAt` på `Checklist`+`Task` (ikke `Activity`), `deletedAt: null`, tre distinkte feilveier, `sitedoc_admin`-nødutgang uendret. `mal.ts` bekreftet IKKE i redesigns diff. api 473→478 (+5 livssyklus-gate), øvrige stille (db 2 · pdf 120 · shared 814 · web 228), kald web-bygg grønn. 🔴 **Web-deploy samles.** 🔴 **Migreringen fra runde 95 (`20260913140000_firmaarkiv_unik_indeks`) venter FORTSATT på Kenneths deploy — prod-dry-run-kravet står under.** 🔴 **OTA-gjeld runde 91 (kollaps) + 93 (iOS-PDF) — én OTA dekker begge.** |
| **simulator** | `SiteDoc-simulator` | ⚠️ **UTE AV DRIFT** — `bc3efdca` detached | Se «To trær som trenger et vedtak» under. Ikke i coworks 12.09-tabell, men treet finnes |
| **deploy** | `SiteDoc-deploy` | 🟢 **LEDIG** — `4d00e94f` detached | Ingen ordre |

🔴 **`SiteDoc-mobil-device` er BORTE** — sto foreldreløs 11.09, er ikke lenger i `git worktree
list`. Fjernet fra registeret.

🟡 **Lærdom (runde 92, KB6 trukket tilbake):** en teknisk ren mal-branch er IKKE klar for merge —
maler har en **innholdsgate hos fabel** i tillegg til kodegaten. Cowork skal ikke bestille merge av
`seed-bibliotek.ts`-runder før fabel har gatet innholdet. KB6 gatet teknisk (create-only, én fil),
men innholdet (NS 4400-detalj i Plantekvalitet) var ikke avklart. *(KB6 senere gatet av Kenneth selv 13.09 og merget runde 93.)*

🔴 **Lærdom (runde 93/94, inbox-overskriving):** cowork overskrev `relay/inbox-merge.md` med en ny ordre
FØR den forrige var meldt ferdig — ordren (rettighetsmatrisen) forsvant uten å ha vært kjørt.
**Regelen som følger: en inbox-fil overskrives ALDRI før forrige ordre er meldt ferdig.** Er den ikke
meldt, er den enten fortsatt aktiv eller tapt — begge krever at cowork spør, ikke skriver over.

🔵 **Rettelser fra runde 93 (ført så de ikke gjentas):** coworks ordre sa «KB6 v2 Grasdekker» —
**KB6 er Planting; Grasdekker er KB4** — og oppga base `652cdbda`, mens faktisk merge-base var `4564d4ed`.
Merge-agenten målte begge og rettet commit-meldingen til «Planting».

### 🔴 Åpne tråder uten eier (målt 12.09)

- 🔴 **`firmamal.ts:64-77` `faneWhere` mangler negativkontroll (åpen etter runde 94):** firmaarkiv-fanens SERVERfilter er aldri bevist med en feil-type-rad. Egen runde — eksisterende flate
- 🔴 **`firmaadmin → SiteDoc-arkiv *les*` uttrykt men ikke wiret (åpen, nå mer aktuell):** cellen finnes i `autoriserMalTilgang`, men kallstedet `bibliotek.hentStandarder` er ikke strammet. Modalen leser arkivet oftere nå (runde 94), så strammingen haster mer. Egen runde
- ~~**Forhåndsvisning + flervalg i papirkurven**~~ — ✅ levert av dokgen + merget runde 85 (`652cdbda`), inkl. slett-vakt på levende kobling som løste låsningen
- **Arkivredigering med versjonering (= redesign steg 3)** — fabels designnotat `arkivredigering-designnotat-fabel-2026-09-12.md` + `MAL-PLAN.md` + KB4-ordre committet `docs/redesign/`/`docs/claude/` (runde 86). 🔴 **Versjonspublisering er egen runde:** ingen versjonsrader for maler finnes i dag (kun tellere — `BibliotekMal.versjon` er `String "1.0"`, `OrganizationTemplate.version` er `Int`). Krever ny tabell etter `DrawingRevision`-mønsteret (`schema.prisma:961-973`) + skjemaendring **Kenneth gater**
- 🟢 **Pilotsjekk «Hent fra arkiv» — DEKKET I UI, DB-måling ikke ført (runde 89):** Kenneth har lånt inn alle seks NS 3420-malene inkl. KD1 i Sitedoc Myrhaugs firmaarkiv, **verifisert i UI.** ⚠️ Sluttmålingen i DB er ikke kjørt skriftlig. Prosjektadmins tapte direkteimport fra NS 3420-biblioteket (tilsiktet vedtak) er dermed dekket i praksis
- 🟢 **`@@unique` på `OrganizationTemplate(organizationId, laantFraBibliotekMalId)` LEVERT + merget runde 95 (`ebda4946`, mal-Opus `fe3e2ed6`):** DB-garantien mot dobbelt-lån er på plass. Duplikatene ryddet av Kenneth på test 13.09 (`DELETE 3`, negativ kontroll `(0 rows)` ×2), så blokkeringen fra runde 88 er opphevet. `@@index([laantFraBibliotekMalId])` beholdt ved siden av (revers-oppslag + `SetNull`-cascade — det sammensatte kan ikke betjene det). Krav (b) i «stille tomhet» oppfylt. 🔴 **KREVER DEPLOY MED MIGRERING** (`20260913140000_firmaarkiv_unik_indeks`, ren `CREATE UNIQUE INDEX` — ingen DELETE/ON CONFLICT, FEILER HØYT på duplikater). Se prod-krav under
- 🔴 **NYTT FUNN (runde 95): integrasjonstester kjøres ikke av CI og har ingen kjørerutine.** Gjelder hele `*.integration.test.ts`-suiten, ikke bare den nye indeks-testen. Målt: `apps/api/package.json:12` har `test:integration` som script · `apps/api/vitest.config.ts:13` ekskluderer `*.integration.test.ts` fra `pnpm test` · `.github/workflows/ci.yml:56` kjører **kun** `pnpm test`. `firmaarkiv-unik-indeks.integration.test.ts` er merket «cowork-gatet», men ingen rutine gater den. mal-Opus kjørte den selv med negativ kontroll (droppet indeksen → rød), så vi VET at den biter i dag — men fra og med merge er den stille. **Samme klasse som «stille tomhet»: en test som aldri kjøres er ikke en vakt.** Eier: ikke tildelt
- 🔴 **PROD-KRAV NESTE RELEASE (runde 95): prod har egen database og kan ha egne duplikater.** `20260913140000_firmaarkiv_unik_indeks` er `CREATE UNIQUE INDEX` og **stopper prod-deployen midt i** (BUILD → MIGRATE feiler høyt) hvis `-d sitedoc` har dobbelt-lånte firmamaler. **Samme dry-run + rydding som ble kjørt mot test 13.09 må kjøres mot `-d sitedoc` FØR migreringen når prod.** Dry-run: `SELECT "organization_id","laant_fra_bibliotek_mal_id",count(*) FROM organization_templates WHERE laant_fra_bibliotek_mal_id IS NOT NULL GROUP BY 1,2 HAVING count(*)>1;` — må gi `(0 rows)` før deploy
- 🔴 **Kundeansvar for NS-verifisering har ingen flate (åpen etter runde 93):** MAL-METODE §7a punkt 5 sier ansvaret skal plasseres «ÉN gang sentralt (bruksvilkår/onboarding/last ned avvik), aldri per sjekkliste». **Den sentrale plasseringen finnes ikke ennå — prinsippet er skrevet, ingen flate håndhever det.** Samme form som «stille tomhet». **Eier: ikke tildelt.**
- ✅ **RETTELSE (runde 93): `arkiv.rendr` STØTTER oppgave** (`arkiv.ts:46` håndterer oppgave eksplisitt, kaster kun når prosjekt-kontekst mangler). Coworks tidligere påstand om at den kaster for oppgave (`arkiv.ts:51`) var utdatert. Sjekkliste + oppgave deler samme `ArkivPdfForhandsvisning`; HMS går gjennom de to skjermene. **Ikke bestill «oppgave-støtte i arkiv.rendr» — den finnes**
- 🔴 **Mobil-rendering av auto-kollaps utestet (åpen etter runde 91):** `apps/mobile/.../UtfyllingSeksjoner.tsx` rørt, men `apps/mobile` har ingen testharness (BACKLOG §153). Sømmen er dekket i `shared` (`seksjoner.test.ts`, 12 tester). Kollaps-oppførselen på mobil er ikke verifisert i app
- 🔴 **Kenneth gater undertittel-nivået visuelt (åpen etter runde 91):** undertittel er nå egen foldbar seksjonsgrense (flat form). Krever test-deploy for visuell godkjenning
- 🔴 **Gammel URL → redirect ikke verifisert ende-til-ende (åpen etter runde 90):** `/dashbord/[prosjektId]/maler` er nå en `redirect()`. `/dashbord/*` er auth-gatet, så uautentisert `curl` fanges av middleware før redirecten — agenten kunne ikke teste e2e. `redirect()` er samme mønster som eksisterende legacy-redirecter i prod, og kald bygg kompilerte sidene, men det er ikke sett virke. **Verifiseres ved neste test-deploy (Kenneth/fabel).**
- 🔴 **Fabels designgate mot «Hent fra arkiv»** — mockupens fire nøkkeltilstander må verifiseres mot flaten. Krever at test er deployet
- 🔵 **Notert: `KD1 – Utendørsbelegg` har `verifisert = f`** — to prosjekter bygger sjekklister på et ikke-verifisert utkast. Ikke rutet
- ⚠️ **Klient-hintet «Allerede lånt» er fane-skopet** (akseptert, runde 88): gjenbruker tabellens liste per fane. **Server-vakten er den fulle gaten på tvers av faner** — hintet er kun UX
- **Bug: `ProsjektBibliotekValg` orphanes** ved firmamal-sletting — verifisert, ikke rutet til agent
- **Prod ligger 62 commits bak develop** — ingen release planlagt
- 🔴 **NYTT FUNN runde 96 (ikke fikset): slett-sperren har en TREDJE grunn — `iKontrollplan`** — som peker til kontrollplanen, ikke papirkurven. De to andre sperregrunnene fikk sperrelenke i denne runden (#3); denne mangler lenke til stedet som opphever den. Egen runde
- 🔴 **NYTT FUNN runde 96 (ikke fikset): papirkurv-lenken mangler mal-filter** — lenken fra slett-sperren peker til papirkurven, men uten filter på malen. Krever `useSearchParams` i `papirkurv/page.tsx` slik at brukeren lander på riktig mals dokumenter. Egen runde
- 🔴 **NYTT FUNN runde 96: den ekte løsningen på ↻-risikoen er diff/merge, ikke full erstatning** (`firmamal.ts:765`, merket «backlog» i koden). Bekreftelsesmodalen (#1-runden) **kjøper tid, den fjerner ikke årsaken** — full objekt-tre-erstatning foreldreløser dokumentdata. Egen større runde
- 🔵 **RETTELSE runde 96: «Avslutt prosjekt»-flaten fantes fra `36dc3029` (06.09).** De tre «neste runde»-kommentarene i `prosjektoppsett/page.tsx`/`EksportSeksjon.tsx` var STALE og er rettet av redesign. **Cowork (og BACKLOG-funn #17) leste kodekommentarer som gjeldende tilstand** — koden er fasit, ikke kommentaren

### 🟢 Trærne har IKKE driftet — målt, ikke antatt

**Spørsmål (Kenneth 11.09): «plutselig er de driftet? bør vi migrere dem?»**

| Måling | Svar |
|---|---|
| `pnpm-lock.yaml` i hovedtreet | **7. september**, uendret i git siden |
| Lockfil i dokgen · kontrollplan · redesign · merge | **7. september — identisk** |
| Urene filer i alle fem trær | **0** |

🟢 **Ingen migrering nødvendig.** Avhengighetene er i takt, trærne er rene, og hver ordre starter
med `git fetch` + ny branch fra `origin/develop`. **`pnpm install` i gate-kommandoen blir en no-op.**
**At et tre står 15 commits bak spiller ingen rolle — det er urene filer som ville vært problemet.**

### ⚠️ To trær som trenger et vedtak

**`SiteDoc-simulator`** — 382 commits bak, lockfil fra **4. september** (eldre enn hovedtreets 7.).
🔴 **Skal den brukes til røykliste, må den oppdateres og `pnpm install` kjøres først** — ellers
måler den en app fra en annen tid. **Som den står, er den ute av drift.**

**`SiteDoc-mobil-device`** — mappa finnes med `node_modules`, `.git`-fila peker på
`.git/worktrees/SiteDoc-mobil-device`, **men treet står IKKE i `git worktree list`.**
🔴 **Registreringen er borte; mappa står igjen som foreldreløs.** Den har **ingen `pnpm-lock.yaml`**.
**Den tar plass og kan forvirre neste cowork. Rydding krever Kenneths ord — cowork sletter ikke.**

### 🔴 PROD-AVBRUDD samme kveld — Entra client secret utløp 3. sept

Microsoft-innlogging på web lå nede i **prod i fire døgn** før noen oppdaget det. **Funnet av en
gate satt av en helt annen grunn.** Ingenting varslet. Full hendelse, de fire lookalike-GUID-ene i
Azure og kontinuitetsrisikoen (begge appregistreringer i en privat tenant, én admin):
[sikkerhet.md](sikkerhet.md).

⚠️ **Gaterekkefølgen «Microsoft først, feiler den stopper alt» var riktig av gale grunner** —
cowork fryktet sin egen PKCE-linje. Den var uskyldig; gaten fanget en utløpt secret i stedet.

### ⚠️ `pnpm lint` kan ikke bli grønn på web — cowork har gatet på et umulig steg

To agenter rapporterte uavhengig at web-lint feiler på **forhåndseksisterende** gjeld på
develop-baselinen, i filer ingen av dem rørte. **Cowork har likevel lagt `pnpm lint` som siste
steg i hver gate-kommando hele dagen.** 🔴 **Et gate-steg som aldri kan passere, lærer agentene å
ignorere gaten.** Tallene spriker (65 mot 107 rapportert) — **selve gjelden er ikke målt.**
Ført i [BACKLOG](BACKLOG.md); lint står ikke som blokkerende steg før baselinen er ren.

🔴 **Sporfordeling (Kenneth-vedtak 2026-08-31, [SAMARBEIDSREGLER § Arbeidsform](SAMARBEIDSREGLER.md)):**
**kontrollplan = PLAN-sporet** (masterplanens neste punkt, røres ikke av feltfunn) ·
**dokgen = FUNN-sporet** (feltfunn, ellers BACKLOG) · **simulator = måling og røykliste**.
Kun 🔴-blokkerere avbryter plan-sporet.

> 🔴 **REGISTERET MÅLES, DET HUSKES IKKE** (Kenneth-krav 2026-09-06). Kjør før hver
> statusrapport og hver ny ordre:
>
> ```sh
> git fetch origin -q --prune && git worktree list && git branch -r
> ```
>
> | Signal | Betyr |
> |---|---|
> | Branch i treet, ingen commits | 🟡 Ordren er TATT, agenten koder |
> | Treet på `develop`/detached | 🟢 Ledig — ordren er ikke tatt |
> | Branch på origin, ikke ancestor av develop | 🟢 Levert, venter merge |
>
> **«Branch finnes i treet» er det eneste målbare signalet på at en agent jobber** — cowork kan
> ikke se agentøkter, bare Kenneth kan. ⚠️ **En ordre er ikke RELAYET før Kenneth har limt den.**
> «Skrevet» og «gitt» er to tilstander, og tavla skiller dem. Cowork påstod agentstatus tre
> ganger 06.09 uten å måle: to ganger sto agentene ledige fordi ordren aldri var relayet, én gang
> var øktene borte.

| Agent | Spor | Worktree (målt) | Tilstand | Neste ordre |
|---|---|---|---|---|
| **merge-agent** | 🟢 **LEDIG** | `SiteDoc-merge` @ `2b235e8a` [merge-restart] | **33 runder.** I synk med develop. Runde 33: to brancher, null filoverlapp, testtall målt api 328→330 · pdf 110→113 (de to api-testene kom fra `tegningsmarkorer.test.ts`, ikke forutsett i coworks ordre men matcher diffen) | **Runde 34:** rebase + merge `feat/innboks-skjerm`, og docs-commit i hovedtreet |
| **dokgen** | 🟡 **I ARBEID** | `SiteDoc-dokgen` @ `8ff106ec` [fix/web-google-state] | `fix/google-doed-implisitt-vei` merget (`24505fbd`). 🔴 **Målte coworks premiss FEIL og meldte imot:** native Google brukte allerede code+PKCE med verifisert `state`. Cowork sluttet fra responsformen; agenten leste `expo-auth-session`s kildekode. Tidligere: byggeplassfilteret (9 kopier → 1, 3 bugger) | 🔴 **`fix/web-google-state`** — Google-tilbyderen i web mangler `state` (`checks ?? ["pkce"]`); Microsoft har linja, Google har den ikke. **Konsollens «SiteDoc» er web-klienten, ikke mobil** |
| **kontrollplan** | 🟡 **ORDRE GITT** | `SiteDoc-kontrollplan` @ `a0048f3b` detached — **6 bak, må oppdateres** | `fix/tegning-forvrengning` merget (`2b235e8a`). 🔴 **Fant at rotårsaken ikke var der cowork pekte:** `preserveAspectRatio="none"` er en no-op i normaltilfellet; strekket oppstår kun når `Drawing.imageWidth/Height` er `null`. Holdt `packages/pdf/src/tegning.ts` urørt → frossen baselinetest grønn | 🔴 **Nå-rapport reisetid** (`na-rapport-reisetid-2026-09-07.md`) — A.Markussen-krav med frist denne måneden. **Måling, ingen kode, ingen branch.** ⚠️ **Derfor gir treet ingen «ordren er tatt»-signal** — den eneste kvitteringen er hans melding |
| **redesign** | 🟡 **ORDRE GITT** | `SiteDoc-redesign` @ `b1bba893` detached | Dedikert innboks-skjerm: hele den aktive lista med søk/filter/sortering. 🔴 **Korrigerte coworks SQLite-antakelse** — sjekkliste/oppgave har ingen SQLite-speiling, kallene er nett-baserte. Gjenbrukte dokgens delte predikat uten utvidelse (ingen femte kopi). ⚠️ **Bygget på develop FØR runde 33** (hans testtall api 328/pdf 110) — må rebases | 🟠 **`fix/oppgave-vedlegg-paritet`** — oppgave sender `file://` rått til server (funn C kun i sjekkliste). **Tre koblede deler**, kan ikke gjøres halvt. *Innboks-skjermen levert og merget (`341cb26f`)* |
| **simulator** | 🟢 **LEDIG** | `SiteDoc-simulator` @ `bc3efdca` detached | — | Ingen |
| **deploy** | 🟢 **LEDIG** | `SiteDoc-deploy` @ `4d00e94f` detached | — | Ingen |
| **fabel** | ⏸ **STOPPET RENT 06.09 ~96 % bruksgrense** | — | **Alle bestillinger besvart, ingen halvferdige leveranser.** Døgnet: SJA-signaturrunder · FL-designlås + tilgangs-revisjon etter Kenneth-overstyring (stoppside, aldri 404) · grensekrav-ordvalg · trafikklys-etiketter · sekvens-frigivelse tatt imot. 🔴 **Åpne poster han peker på til neste økt:** trinn 3-gaten (PDF-atferdstest) · Kenneths gate på AG-systemteksten · FL/timeprosjekt-kost-sjekkene · **Proadm-eksportfila fra A.Markussen** | Neste økt — Kenneth avgjør om han skal fortsette utover grensen |
| ~~fabel (gammel rad)~~ | — | — | **SJA-signaturrunder lukket 06.09** — designlås over fire dokumenter + mockup, ordre skrevet. Alle tre nå-rapport-funn tiltrådt. Tidligere: modulhierarki-notatet komplett 31.08 | **Designgate på skjermbilder** når redesign leverer. Usendt fra cowork: `fabel-nav-gating-modellen.md` · `fabel-eksport-arkivering.md` |

⚠️ **`origin/wip/diag-exif` og `origin/wip/diag-ko-trigger` er umerget MED VILJE** —
`__DEV__`-logging, skal aldri merges. De dukker opp i hver `branch -r`-måling; **ikke tolk dem som
ventende arbeid.**

### 📋 Feltfunn-liste (B — funn samles, blir ikke ordrer på minuttet)

Kenneth melder som før; cowork fører her med alvorlighet. **Kun 🔴 avbryter plan-sporet.**
Kontrollspørsmål: *kommer noen ikke videre uten dette?*

🟠 **FUNN 2026-09-07 (Kenneth, test på enhet) — «Forbered til offline» forbereder bare tegninger.**
Menyvalget i `Mer` dekker **tegninger**. **Oppgaver, sjekklister og HMS er ikke med.**
🟢 **Samsvarer med koden:** redesign målte 07.09 at `sjekkliste/oppgave.hentForProsjekt` er
nett-baserte tRPC-kall, og at SQLite-katalogene dekker timer/maskin/vær/byggeplass — ikke dokumenter.

🔴 **To ting skiller lag her, og de må ikke slås sammen:**
- 🟢 **Opplastingskøen er robust offline** — målt samme kveld: bilde tatt i flymodus nådde serveren
  da telefonen kom på nett. **Den delen holder det den lover.**
- 🔴 **Dokument-TILGANG offline gjør det ikke.** Kenneths test virket fordi dokumentet var **åpnet
  før** han gikk offline. Et dokument han ikke hadde åpnet, ville ikke vært nåbart.

⚠️ **Løftebrist-klassen:** et menyvalg som heter «Forbered til offline» lover mer enn det gjør.
Samme form som `nb.json:2218` («arkivert og skrivebeskyttet»), `hms.ts:207-209` og innboks-pila.
🔴 **CLAUDE.md sier «Mobil-appen MÅ fungere offline» — ufravikelig.** Avviket mellom regel og kode
er reelt og udokumentert til nå.

**Ikke ordre.** Alternativene spenner fra å presisere etiketten (billig, ærlig) til å speile
dokumenter i SQLite (stort, berører sync-modellen). **Kenneth-beslutning, egen sak.**

🟡 **FUNN 2026-09-07 (cowork-måling) — åttende kopiklasse, halvlukket.** Redesign trakk
`formaterNummer` + `MedUtheving` ut til `apps/mobile/src/components/dokumentliste/DokumentRadHjelpere.tsx`
og migrerte `sjekkliste/index.tsx`. **Fire kopier står igjen:** `(tabs)/hjem.tsx:100` ·
`hms/index.tsx:43` · `oppgave/index.tsx:65` · `oppgave/[id].tsx:88`.
🔴 **Dette er nøyaktig formen byggeplassfilteret hadde** — en delt modul opprettet, migreringen
stanset ved første kallsted, og resten driftet fra hverandre til tre av ni var ødelagte.
**Ordren var riktig avgrenset; oppfølgingen er coworks, ikke agentens.** Egen ordre, funn-sporet.

🟢 **LUKKET SAMME DØGN — `a076236f`, ni kopier → én kilde, tre bugger borte.**
`apps/api/src/services/byggeplassFilter.ts` bærer regelen alene. Testen fanget dessuten en stille
atferdsendring uttrekket ville innført (tom streng måtte forbli falsy). **Historikken under står
fordi den forklarer hvorfor gaten trenger å måle mønstre, ikke bare filer.**

🔴 **BYGGEPLASSFILTERET VAR NI KOPIER — TRE AV DEM ØDELAGTE (målt 2026-09-06, dokgen).**
Regelen «et objekt uten byggeplass gjelder der du står» er håndspeilet ni steder i `apps/api`
over **to former**: via tegning (`drawing: { byggeplassId }`, 4 kopier) og direkte
(`byggeplassId`, 5 kopier). 🔴 **Tre av via-tegning-kopiene mangler tredje ledd** —
`oppgave.ts:168`, `hms.ts:213`, `hms.ts:373`. **En oppgave eller RUH på en PROSJEKT-tegning
forsvinner fra lista når en byggeplass velges.**
⚠️ **`hms.ts:207-209` bærer en kommentar som lover oppførselen koden ikke gir** — samme
løftebrist-klasse som Innboks-pila og «arkivert og skrivebeskyttet».
🟢 Ordre skrevet: `relay/inbox-byggeplassfilter-uttrekk.md` (uttrekk 9 → 1, buggene lukkes som
bivirkning, én test på setningen som ikke holdt).
🔴 **Coworks gate sa «bare to steder, ingen klasse» — det var feil.** Cowork lot dokgens måling
av andre BILDE-veier svare på et spørsmål om `drawing:{byggeplassId}`-mønsteret. **Agenten målte,
sa imot, og hadde rett.** Fjerde runde på byggeplass-tilhørighet.

🟢 **LUKKET SAMME DØGN — `d58e080f`.** Fem prosedyrer gates nå på `verifiserProsjektmedlem` via
resolvert `projectId`; `prosesser.ts` slettet og den offentlige flaten finnes ikke lenger.
Detaljer + metode i [`sikkerhet.md`](sikkerhet.md). **Historikken under står fordi den viser hvor
funnet kom fra: bifangst fra en kostnadsmåling ingen hadde bedt om.**

🔴 **FIRMAGRENSEN VAR ÅPEN PÅ FIRE SKRIVEVEIER (målt 2026-09-06, redesign).**
`kontrakt.oppdater`/`kontrakt.slett` og `mengde.lagreNotat`/`mengde.slettPeriode` er
`protectedProcedure` — innlogget, men **uten firma- eller prosjektsjekk**. De gjør
`update({ where: { id } })` rått. **Enhver innlogget SiteDoc-bruker kan endre eller slette et
annet firmas kontrakt hvis han kjenner id-en**, og `slett` nuller `kontraktId` på faggrupper og
dokumenter på veien.
🔴 **Bryter den ufravikelige regelen i CLAUDE.md:** *«Firma-admin ser KUN sitt eget firmas data»*
og *«firma-grense-sjekk ligger ALLTID i server-laget»*.
⚠️ **`POST /prosesser/:documentId` (`server.ts:160`) har ingen autentisering** og er eksponert på
`api.sitedoc.no`. Krever en gyldig UUID for å gjøre noe, så terskelen er høyere — men den er åpen.
🟢 Egen branch `fix/ftd-tenantgrense`, **prioritert foran FL-funksjonen**. Funn skrives til
`sikkerhet.md` i samme commit.
**Funnet som bifangst da redesign målte FL-ordrens guard-kostnad** — ingen lette etter det.

🟡 **ET GLEMT UTKAST SPERRER MALENDRING PERMANENT (Kenneth-funn 2026-09-07).**
Endringsvernet teller dokumenter med faktisk verdi i feltet — **et utkast med verdi er et utfylt
dokument**, som er teknisk riktig etter Kenneths eget vedtak. Men konsekvensen er at en
malforfatter kan låses av **andres uferdige arbeid**, uten vei rundt annet enn å kopiere malen.
⚠️ **Hos A.Markussen med 50 ansatte er dette en sannsynlig tilstand, ikke en teoretisk.**
**Egen beslutning — Kenneth avgjør. Ingen har rørt predikatet.**

🟡 **`antallDokumenterFeilet` vises ikke i eksport-UI (målt 2026-09-07, kontrollplan).**
Feltet finnes ikke i modellen; ny kolonne = migrering. **Men dataen bæres migreringsfritt:** på
status `klar` er feilede = `antallTotalt − antallFerdig`, og begge felt ligger allerede i
`hentForProsjekt`-selecten. **En web-oppfølger på klar-kortet er reelt tre linjer, ingen
api/schema-endring.** Uten den må kunden åpne `manifest.json` for å oppdage at dokumenter manglet.

🟡 **Task har ingen egen `byggeplassId`** — tilhørighet finnes kun via tegningen, og det er
roten til hele asymmetrien over. Å legge feltet på `Task` ville fjernet den, men er **en
migrering på produktets nest mest sentrale tabell rett før pilot**. **Egen beslutning når noen
vil ta den** — ikke smuglet inn i en bugfiks.

🟡 **Innboksen har et HARDT TAK på 10 rader (målt 2026-09-06, redesign-Opus).**
`hjem.tsx:472` — `.slice(0, visAlleInnboks ? 10 : INNBOKS_MAKS)`. Ved 40 aktive dokumenter viser
badgen **40**, «Se alle» folder ut til **10**, og **de resterende 30 er ikke nåbare fra
innboks-seksjonen** — kun via Oppgaver- og Sjekklister-fanene.
🔴 **Seksjonen viser altså et tall den ikke kan liste.** Fra ~11 aktive dokumenter er den
ufullstendig. **Egen innboks-skjerm (variant B) er berettiget** — med søk/filter/sortering fra
dokgens dokumentliste-komponenter (`31002232`), ikke en ny flate uten dem.
⚠️ **Ikke akutt, men ikke hypotetisk.** A.Markussen med 50 ansatte passerer 10 aktive fort.

🔴 **PROSESSFUNN 2026-09-06 — ANDRE GANG: standardgaten mangler `pnpm test`.**
Gate-kjeden i coworks ordrer er `install → prisma generate ×4 → web build → mobil typecheck
→ mobil lint`. **Ingen tester.** Dokgens `e49e8ea3` passerte hele gaten og brakk likevel
`tilbehorVisning.test.ts` — testen forventet `vis: true` for `signature` etter at typen ble
lagt i deny-lista. Merge-agenten fanget det og stoppet før push, men da hadde allerede tre
ledd vært involvert.
**Samme hull som 03.09** (SafeAreaView-importen som lint forbød, men gaten ikke kjørte).
🟢 **Rettet: `pnpm test` fra ROT er nå del av standardgaten i alle nye ordrer.** Samme
kommando CI kjører — kostnaden er ventetid hos agenten, som er billigere enn en runde
gjennom Kenneth.

🟡 **Status-brudd i endringslogg-koalesceringen — bevisst utsatt (2026-09-05).**
Koalesceringen bryter vinduet på tid (10 min) og bruker, **men ikke på statusskifte** — fordi
`endreStatus` ikke skriver noen loggrad, så det finnes intet lagret signal. Det riktige fikset er
`statusEndretAt` på `Checklist` + `Task`, altså **en migrering på produktets to mest sentrale
tabeller, rett før pilot**. Cowork utsatte den bevisst framfor å smugle den inn i en bugfiks.
Eksponering lav: krever samme bruker, samme felt, før OG etter statusskifte, innen ti minutter —
konsekvens er én sammenslått rad, aldri tapt data. **Egen beslutning når noen vil ta den.**
Dokumentert i `apps/api/src/services/endringslogg.ts:27-34`.

🔴 **`seed.ts` PRODUSERER ORPHAN-PROSJEKTER (funn 2026-09-05, redesign-Opus).**
CLAUDE.md-regelen fra 2026-05-20 sier at prosjekt-opprettelse **må** kreve firma. Regelen er
håndhevet i API-mutasjonene, men **hoved-seeden bryter den selv** — den setter ikke
`primaryOrganizationId`. Funnet da `seed:sja` gjorde samme feil og Kenneth ikke fant
demo-prosjektet fra sin firmakontekst på test.
⚠️ **Merk feltnavnet:** `Project.primaryOrganizationId`, **ikke** `organizationId` — firmakontekst
lister på det feltet (`prosjekt.ts:30/56/90`). `ProjectOrganization`-join er kun visning.
**Egen sak, ingen agent tildelt.** `seed:sja` er rettet (`8b3110b8`).

🟡 **Tvilling-paritetstest mangler (dokgen-funn 2026-09-06).** `packages/pdf/src/hjelpere.ts`
speiler `packages/shared/src/utils/signaturVerdi.ts` fordi `@sitedoc/pdf` har dokumenterte
null-avhengigheter. Speilet har peker-kommentar, men **ingen test som fanger drift** — endres
den kanoniske leseren, sier ingenting fra. Gjelder også den eldre `repeaterRad`-tvillingen.
**Fiks: én test som kjører begge implementasjonene på samme inndata og krever likt svar.**
Liten sak — kandidat for kontrollplan eller dokgen.

🟡 **Drift målt 2026-09-05 under SJA-målingen: `TILBEHOR_REN_FJERNING` har FIRE typer i web
og FEM i mobil** (`weather` ekstra på mobil). `RapportObjektRenderer.tsx:59` vs `:47`.
To sett som skal være ett — samme klasse som `IKKE_UTFYLLBARE_FELTTYPER`-driften dokgen fant.
**Fiks = ÉN delt kilde i `@sitedoc/shared`**, og `weather`-avviket avklares mot Kenneth
(er vær-tilbehør bevisst av på mobil, eller glemt?). Egen liten sak — ingen agent tildelt.
⚠️ **Dokgen legger `signature` inn i begge sett nå** — driften vokser til to sett à 5/6 hvis
den ikke lukkes snart.

🔴 **Kenneth 2026-09-03: «fiks alle de feil jeg meldte inn før nytt EAS-bygg → #1-6.»**
Seks funn fra bygg 50. **Byggkvoten gater rekkefølgen** — vi bruker ikke ett av ~15
månedlige iOS-bygg på et halvt sett. To agenter i parallell, ett bygg når begge er merget.

| Funn (bygg 50, 2026-09-03) | Alvorlighet | Status |
|---|---|---|
✅ **ALLE FEM ER PÅ DEVELOP** (`dc454d22`). A/B/D `f9ea2255` (kontrollplan) · C/E `da4d3035` (dokgen) ·
safearea-fiks `dc454d22`. Venter på simulator-røyklisten før EAS-bygg 51.

🔴 **Prosessfunn samme dag — lint er ikke i regel 10.** Bygg 50-E introduserte en `SafeAreaView`-import
som lint-regelen fra 31.08 forbyr eksplisitt («0 padding inne i `<Modal>`»). Gaten kjører `web build` +
`mobile typecheck`, **ikke `pnpm lint`** — så regelen fantes, var riktig, og fanget ingenting.
Lukk/del-knappene i PDF-forhåndsvisningen lå under Dynamic Island. Fanget av dokgen som «preeksisterende
støy», omklassifisert av cowork etter å ha lest regelmeldingen. **Samme mønster som `pnpm test`-fella i
august: en gate ingen har målt er en påstand.** Eget punkt: lint inn i regel 10.

| **#1** Bilder tatt tidligere vises ikke i rapportobjekt-raden — ser ut som datatap | 🔴 blokkerer | ✅ Ordre C → dokgen, merget `da4d3035`. Additiv `settVedleggUrl` + sletting gatet på server ELLER SQLite. ⚠️ Krever **prod-deploy** for full effekt hos testerne |
| **#2** Ingen PDF-kontroll før sending (finnes, men kun som iOS share sheet fra ett ikon) | 🔴 for dette bygget | ✅ «Forhåndsvis PDF» rett over Send-knappen, WebView i appen. Merget `da4d3035` + insett-fiks `dc454d22` |
| **#3** Endringsloggen står åpen i UI (mobil **og** web) og viser rå UUID-er | 🟡 skjemmer | Ordre D → **kontrollplan**. 🔴 **Loggen BEVARES** — skjules bak knapp, lukket som standard, på begge flater (Kenneth 03.09). UUID-visningen er eget funn: mobil bruker allerede delt `ekspanderEndring`, så det er kolonne-oppslaget som bommer |
| **#4** Tegningslista ignorerer valgt byggeplass — kaos ved 30-40 tegninger | 🔴 blokkerer | Ordre B → **kontrollplan** |
| **#5** Byggeplass-velgeren usynlig: chippen leser **timer-modulens** cache (`ByggeplassChip.tsx:26`, `:44`) | 🔴 blokkerer | Ordre A → **kontrollplan** |
| **#6** Bekreftet at enheten kjører bygg 50 (`da0f018`) | — | Ingen feil |

✅ **ALLE SEKS LUKKET OG SIMULATOR-VERIFISERT 2026-09-03** — develop `79540337`, test-API `dc454d22`.
Røyklisten dekket A/B/D/E på `da4d3035`, C og miniatyr-fiksen på `451cbb3a`.

🟢 **Funn #3 «eget funn» (endringsloggen sa ikke HVA som ble endret) løst — branch `fix/endringslogg-innhold`:**
Rot målt: `diffRepeater` (`packages/pdf/src/arkivmal/endringsdiff.ts`) leste `Object.keys` på den innpakkede
rad-formen `{_radId, felter}` i stedet for `.felter` → «Kolonne N» (posisjon, ikke navn) OG tom celle-diff
(«til «Ikke utfylt»» uten «fra»). Ett symptom, én fiks: uttrekk via **kanonisk tvilling** `feltKartFraRad`
(`packages/pdf/src/arkivmal/repeaterRad.ts`, null-dep-tvilling av `@sitedoc/shared/utils/repeaterRad.ts`,
toveis-peker) → riktig kolonnenavn + fra/til på web + mobil + arkiv-PDF samtidig. Bar UUID-verdi (historisk
tegningsreferanse) skjules som «(tegningsreferanse)» i `lesbarVerdi` — aldri rå UUID i et kvalitetsdokument.
Lærdom: repeater-testene traff aldri produksjonsformen (flat legacy) — nå testes `{_radId, felter}` FØRST.
Gate: web build + mobil typecheck grønt, api-arkiv 41 + pdf 90 + shared 7 + web 189. OTA-kandidat (ren JS).
Tidslinje-fletting (mangel 4) skilt ut til fabel — informasjonsarkitektur, egen designbeslutning. Ikke deployet.

🔴 **Simulatoren gjorde noe vi skal gjenta: den lette etter BILDET, ikke etter fravær av feilmelding.**
Miniatyr-fiksen bygger den lokale stien av vedleggets filnavn; hadde navnet ikke matchet fila på disk,
ville den falt stille tilbake til gammel oppførsel — grønt uten å være en fiks. Ordren ba eksplisitt om
å se etter det positive beviset. **Formen bør inn i alle verifiseringsordrer:** si hva som skal SEES,
ikke hva som skal være borte.

✅ **LUKKET 2026-09-04 — filteret var riktig, teksten er feil.** Chippen sier «Viser kun denne
byggeplassen», mens `sjekkliste.ts:185` filtrerer **mykt** (`OR: byggeplassId = null`). Det ble ført
som mistenkelig. **Kenneths domeneforklaring 04.09 avgjør det:** et dokument uten byggeplass gjelder
*hele prosjektet* — altså også denne byggeplassen — og skal være med. Filteret er korrekt.
🟡 **Gjenstår: chip-teksten**, som lover en avgrensning systemet med rett og vilje ikke gjør.
⚠️ **Og et nytt spørsmål:** tegninger filtrerer **hardt**. Sannsynligvis riktig (en tegning hører til
ett sted), men forskjellen er ikke vedtatt noe sted.
Full begrunnelse: [domene-arbeidsflyt.md § byggeplass er et valgfritt oppdelingsnivå](domene-arbeidsflyt.md).

🔴 **NYTT FUNN 2026-09-04 — byggeplasser har TID og ANTALL. Modellen bærer ingen av delene.**

Kenneth, to utsagn samme kveld:
> *«Et prosjekt kan ha flere byggetrinn → prosjektet kan vare i 5 år, med tre forskjellige bygg,
> som starter når det første er ferdig.»*
>
> *«Et prosjekt kan leve i 30 år eller mer — men bestå av mange kortvarige prosjekter som varer en
> uke eller en måned. Kanskje vi må skjule og lukke disse etter behov.»*

**To skalaer.** Byggetrinn = tre enheter over fem år. Rammeavtale/driftskontrakt = **hundrevis av
ukelange enheter i én beholder over tiår.** `Byggeplass` har i dag verken tilstand, start/slutt
eller arkivering.

**Forutsigbart brudd ved stor skala:** byggeplass-velgeren (`ByggeplassChip` + dokumentskjemaer) er
ubrukelig i felt med 500 valg · dokumentlister vokser uten grense · «vis kun aktive» går fra
bekvemmelighet til forutsetning.

✅ **Modellspørsmålet er AVKLART — intet nytt nivå trengs.** Cowork spurte om en ukelang jobb egentlig
var et `Project` med avtalen over. Kenneth: *«En SiteDoc-kunde har prosjektnummer 100 → dette
prosjektet heter «Småprosjekter» → i SiteDoc heter disse byggeplasser.»* `Project` ER beholderen.

🔴 **Da er saken ren: `Byggeplass` mangler LIVSSYKLUS, ikke struktur.** Prosjekt 100 samler
hundrevis av byggeplasser over tiår, og ingen kan avsluttes eller skjules. Det gjør funnet konkret
nok til å bli en ordre — men modellen og UI-et (hva skjer med PSI, mannskapsliste, velgere) hører
til fabel først.

**Fabels domene. Ingen ordre skrevet.** Full utredning:
[domene-arbeidsflyt.md § byggeplass er et valgfritt oppdelingsnivå](domene-arbeidsflyt.md).

> 🔴 **Kenneths kritikk av arbeidsformen, 2026-09-03 — skal stå:**
> *«Istedenfor å forsvare tidligere valg og si at jeg leter på feil plass, så må man erkjenne at
> vi endret ikke på riktig plass når enkel logikk ikke fører til målet.»*
>
> Cowork svarte først at chippen fantes på fem skjermer og at Kenneth hadde åpnet feil kontroll.
> **Målingen ga ham rett:** chippen returnerer `null` uten feilmelding når timer-cachen er tom.
> **Akseptkriteriet som følger:** en runde er ikke levert før noen som *ikke vet hva som er
> endret* kan finne endringen. En komponent som finnes i koden er ikke en endring brukeren har fått.
>
> **Og modellen han beskrev — velg prosjekt + byggeplass på hjem, alt nedstrøms følger — er
> allerede appens modell.** Ti skjermer sender `byggeplassId` fra `ByggeplassKontekst`.
> Tegninger er den ene som meldte seg ut. Vi innfører ingenting; vi tetter.

### 🔴 FUNN 2026-09-05 — PROD har tomt sentralarkiv OG tom dokumentsøk-indeks

Målt i tre miljøer 05.09 mens malverkstedet ble kartlagt:

| Database | Bibliotekmaler | Chunks | Med embedding | Dokumenter |
|---|---|---|---|---|
| **`sitedoc_test`** (server-ny) | 6 | 6 389 | **5 745** | 277 |
| **`sitedoc`** (PROD) | **0** | **0** | **0** | **0** |
| `sitedoc` (Kenspill, legacy) | 0 | — | 0 | — |

🔴 **Logger A.Markussen inn i prod i dag, er «Lån fra SiteDoc-arkivet» TOM, og AI-søket har
ingenting å søke i.** Malarkivet som ble bygget 04.–05.09 (`91e3e5a6`, `2cfdbaea`, `51bad500`) er
en tom hylle i produksjon.

**Ikke en kodefeil:** `seed-bibliotek.ts` er aldri kjørt mot prod, og dokumentene er aldri lastet
opp dit. Men det må lukkes før pilot.

⚠️ **Kan ikke lukkes ved å kjøre seeden som den står** — se § seed-bibliotek under: den sletter
`ProsjektBibliotekValg` og nuller B4-avstamningen. Ordre skrevet
(`relay/inbox-seed-bibliotek-idempotent.md`).

### ✅ FUNN 2026-09-05 — malverkstedet finnes allerede: `sitedoc_test`

Kenneth foreslo å gjenåpne Kenspill (legacy) som verksted for malbygging, fordi Opus der hadde fri
DB-tilgang. **Målingen gjorde det unødvendig.**

`sitedoc_test` på server-ny har alt: pgvector, kjørende AI-søk, ingen kundedata — og
**NS 3420 komplett vektorisert**, ti dokumenter fra del A til Z:

```
f: 332 · k: 178 · l: 166 · z: 100 · j: 89 · a: 76 · gu: 57 · 1: 56 · d: 62 · cd: 55
```

⚠️ **Dublett funnet:** `NS 3420 Del K Anleggsgartnerarbeider.pdf` har **0 chunks** — samme
dokument som den vektoriserte `…ns-3420-k_2024_no_001.pdf` (178). Ufarlig, men bør ryddes så
ingen søker i feil kopi.

🔴 **Kenspill er MÅLT UEGNET, ikke bare unødvendig:** kode fra juni (`aed86d0f`, branch `main`),
`bibliotek_maler` = 0, embeddings = 0. Å bruke den ville krevd kodeoppdatering **og**
dataflytting. **Ikke ta den opp igjen.**

### 🟡 FUNN 2026-09-05 — malarkivet mangler INNHOLD, og feltet for å kvalitetssikre det er dødt

Kenneth lastet opp **NS 3420-kildedokumentene** til prosjektets mappestruktur 05.09 (ti kapitler
som PDF: a, cd, d, f, gu, j, k, l, z, 1 — alle `_2024_`). Det svarer på hvor ekte maler skal komme
fra, men avdekker tre ting som henger sammen:

| | Målt |
|---|---|
| **Sentralarkivet** | 13 maler, alle fra `seed-bibliotek.ts` (håndskrevet) |
| **`BibliotekMal.verifisert`** | 🔴 **Død kolonne.** Finnes i schema med kommentaren *«True når malen er verifisert mot kilde-norm»* — settes ikke i seed, leses ikke i `apps/api` eller `apps/web`. Samme klasse som `ansvarsmerke` |
| **Kilde-normen** | Ligger nå i systemet, men **ingen kobling** til `BibliotekMal` finnes |

🔴 **Malarkivet mangler innhold, ikke funksjonalitet.** AM 4b (`51bad500`) gjorde flaten brukbar
ved hundrevis av maler — vi har tretten, og ingen av dem er merket kontrollert mot normen.

**Spørsmål som hører til fabel, ikke til en kodeordre:**
- Skal maler lages **fra** NS 3420-postene, og i så fall av hvem? Det er domenearbeid — noen må
  avgjøre hvilke felter en sjekkliste for «KB4 Grasdekke» skal ha.
- Kan SiteDocs egen AI-søk/embedding brukes til å foreslå malstruktur fra en NS 3420-post?
  **Ikke utredet — ikke anta at det er lett.**
- Skal `verifisert` tas i bruk, eller strykes som `ansvarsmerke`? En død kolonne som beskriver en
  kvalitetsprosess vi ikke har, lover mer enn systemet holder.
- ✅ **LISENS AVKLART 2026-09-05 (Kenneth) — ikke en blokkerer.**
  > *«Jeg har tilgang hver dag til disse dokumentene og kan lese selv. Vi skal bygge våre egne
  > sjekklister basert på NS 3420. Om jeg gjør det manuelt eller en agent gjør det for meg er det
  > samme. Vi lager ikke en kopi av NS 3420.»*
  >
  > *(Kenneth sa først «tester» og korrigerte til «sjekklister» — **«test» er ikke et
  > SiteDoc-begrep.** Se [terminologi.md](terminologi.md). Malene vi bygger er sjekklistemaler.)*

  🔴 **Den operative regelen for den som bygger maler:** en sjekkliste som **kontrollerer mot** et
  krav er vårt eget verk. En som **gjengir kravteksten** er en kopi.

  | Lov | Ikke lov |
  |---|---|
  | «Kontroller at jordblanding tilfredsstiller NS 3420-K **KB2.1**» + felt for måling og avvik | Å lime inn kravtekst, tabeller eller toleranseverdier ordrett fra standarden |
  | Referere til punktkode som kilde | Gjengi standarden slik at malen erstatter den |

  **Cowork overvurderte dette 04.09** — samme feil som med eksponeringsregisteret (se
  [domene-arbeidsflyt.md § ansvarsgrense](domene-arbeidsflyt.md)). To juridiske hensyn blåst opp
  på to dager. **Mål før du kaller noe en blokkerer.**

⚠️ **Blokkerer ikke piloten i seg selv**, men et malarkiv med tretten maler er ikke et arkiv.
Hører sammen med EX og BL på fabels bord.

### 🔴 FUNN 2026-09-05 — SJA kan ikke dokumentere HVEM som har signert

Kenneth: *«Jeg trodde vi hadde kontroll → Opus sa tidligere at alle 7 arbeiderne kunne signere →
jeg tok det for gitt at vi også dokumenterte at alle 7 hadde signert.»*

**Målt: tre mekanismer, ingen løser det.**

| Mekanisme | Hva den gir |
|---|---|
| `signature`-rapportobjekt (`felt.ts:131`) | **Kun bildet.** Ingen navn, tidspunkt eller identitet — anonym strek |
| Signaturseksjon i arkiv-PDF (`arkivmal/signatur.ts`) | **Maks to navngitte**, og de er dokumentflyt-roller («Utført av»/«Godkjent av») |
| `persons`-felttype (`felt.ts:112`) | Syv navn i en liste — **deltakerliste, ikke signaturer**. ⚠️ Skriver i tillegg ut rå UUID-er (åpent backlog-funn) |

🔴 **Kun ÉN signatur-modell i hele schemaet: `PsiSignatur`.** Ingen deltaker-modell.

**Sannsynlig kilde til misforståelsen:** `persons` lar syv personer legges til. «Syv kan legges
til» og «syv kan signere» ligner hverandre, og grensesnittet skiller dem ikke.

**Konsekvens i felt:** en SHA-koordinator som tar med utskrevet SJA ut på plassen for å
kontrollere at alle har signert, **finner ikke svaret der.**

🟢 **Mønsteret finnes:** `PsiSignatur` (`schema.prisma:1942`) har userId ELLER gjest
(navn/firma/telefon), HMS-kortnr, `completedAt`, unik per person — og
`gjeldende: psiVersion === psi.version`, som **viser om signaturen gjelder dokumentet slik det er
nå.** Kritisk for SJA: endres risikovurderingen, er tidligere signaturer på feil dokument.

**Fabels domene — bestilling sendt 05.09**
([BESTILLING-sja-signaturer](../redesign/til-fabel/BESTILLING-sja-signaturer-2026-09-05.md)).
Ingen ordre skrevet. ⚠️ **Cowork vurderer dette som høyere pilotprioritet enn resten av
malarbeidet** — SJA er lovpålagt, og A.Markussen bruker innleid mannskap.

### 🔴 AVKLART 2026-09-04 — RUH og avvik kan IKKE leveres som PDF (lovpålagt dokumentasjon)

**Målt i `hms.ts:221-269` — hvilken Prisma-modell hver HMS-type faktisk bruker:**

| Dokumenttype | Modell | Arkiv-PDF i dag | Web | Mobil |
|---|---|---|---|---|
| Sjekkliste | `Checklist` | ✅ | ✅ | ✅ |
| HMS **SJA** | `Checklist` | ✅ | ✅ | ✅ |
| **Oppgave** | `Task` | ❌ | ❌ | ❌ |
| **HMS avvik** | `Task` | ❌ | ❌ | ❌ |
| **HMS RUH** | `Task` | ❌ | ❌ | ❌ |

🔴 **RUH og avvik er lovpålagt HMS-dokumentasjon.** At de ikke kan leveres som PDF er en
pilotblokkerer, ikke en skjønnhetsfeil.

**Rotårsaken er ÉN:** `services/arkiv/render.ts:94` kaster for alt annet enn sjekkliste
(«task-innholdsleser mangler»). `arkiv.rendr` godtar allerede `type: "oppgave"` i kontrakten
(`arkiv.ts:51`) — kun leseren mangler.

✅ **Flate-pariteten er derimot allerede på plass.** Web og mobil kaller samme `arkiv.rendr`; begge
har PDF for sjekkliste, begge mangler for task. **Kenneths premiss «web tilbyr et sett utskrifter,
det samme bør gjelde app» er målt — hullet er dokumenttype, ikke flate.** Bygges task-leseren, får
tre dokumenttyper PDF på to flater i samme runde.

*(Web har i tillegg timer-rapportens printmotor. Den er en firmaflate og hører i web —
[feltarbeid-skillet](SAMARBEIDSREGLER.md), Kenneth 04.09.)*

Funnet kom fram fordi dokgen rapporterte et sidefunn i stedet for å la det passere
(lokasjonOmfang-runden, 04.09), og fordi Kenneth samme kveld påpekte at han sier «sjekklister» om
funksjoner som er generelle. Se [SAMARBEIDSREGLER § «sjekkliste» betyr ofte «dokument»](SAMARBEIDSREGLER.md).

### Feltfunn 2026-09-04 (prod-verifisering av `96eebc13`)

Kenneth sammenlignet samme befaringsnotat i mobil, web og arkiv-PDF etter prod-deployen.

| Funn | Alvorlighet | Status |
|---|---|---|
| Web viste ikke bildets opptakstidspunkt — mobil og PDF gjorde. Målt: **null treff på `opptakTidspunkt` i `apps/web`** | 🟡 skjemmer | ✅ Merget `d610acb8`. Gjenbruker `formaterDatoTidPunkt` fra `@sitedoc/pdf` (ingen tredje kopi); `undefined` ⇒ tomt (historiske bilder urørt), `null` ⇒ `felt.opptakTidMangler` (15/15 språk), aldri innleggingstid. **Web — når ikke brukeren via OTA, venter på neste prod-deploy** |
| `RapportObjektVisning.tsx:143` (oppgave-detalj + web-utskrift) viser fortsatt `opprettet` = innleggingstid | 🟡 skjemmer | Samme paritetsbrudd, annen flate med egen vedleggstype uten `opptakTidspunkt`. Ikke ordre — hører sammen med den flatens egen opprydding |
| Arkiv-PDF: overskriften «BILDER» står alene med ~halv side tomrom, bildene rendres på neste side | 🔵 notert | Sidebrekk-regelen holder ikke overskrift og innhold sammen. Rotårsak ikke funnet (dokgen var ikke i arkivmal-layouten og gjettet ikke) |
| Arkiv-PDF: felt vises som `_` med «Ikke utfylt» — etikett mangler eller er tom | 🔵 notert | Rotårsak ikke funnet |
| Bildeteksten i web er satt til **9 px** — PDF og mobil bruker vesentlig større | 🔵 notert | Vurderes visuelt når endringen er på test; justeres hvis den er for smått til å leses før godkjenning |

### Eldre feltfunn

| Funn | Alvorlighet | Status |
|---|---|---|
| Tegningsminne mangler i repeater-raden (fem trykk mot ett) | 🟡 skjemmer | ✅ Merget 01.09 (`5b5f5442`). **Ikke i noe bygg** — verifiseres av røykliste flyt 3 (kostet 7 trykk sist) |
| Endringslogg-støy i oppgave (rå `JSON.stringify` mot sjekklistens `likForDiff`) | 🟡 skjemmer | Ordre klar 01.09, funn-sporet |
| «Lagre» dekkes av tastaturet i dagsseddel (røykliste flyt 9) | 🟡 skjemmer | Ikke ordre |
| «Bekreft»/«Opprett» disabled uten forklaring (røykliste flyt 3, 6) | 🟡 skjemmer | Ikke ordre |
| Ingen lenke mellom firmamoduler og prosjektmoduler | 🟡 skjemmer | ✅ Levert i steg 3 (`97d074b8`) — toveis lenke + grå-under-tak. Gates på test |
| `as unknown as ProjectModuleRad[]` (`oppsett/produksjon/moduler/page.tsx:90`) | 🔵 notert | Fra før steg 3. Mønsteret SAMARBEIDSREGLER flagger — cast som skjuler manglende felt |
| Fototilgang førstegang → app falt til hjemskjerm (én gang, ikke reprodusert) | 🔵 notert | Overvåkes i røyklisten |

🔵 **DEPLOY-RYTME ENDRET (Kenneth 2026-08-29 kveld):** *«Det er ingen vits å deploye nå — vi
kan utvikle mer fra masterplan først. Dette er små endringer som bare koster tid og er
ineffektiv utvikling.»* Åtte test-deployer og to prod-releaser på én dag, flere for
tofils-endringer. **Ny form: brancher merges til develop løpende** (så de ikke råtner — vi så
i dag hva som skjer når 20 innslag blir stående), **men test-deploy skjer når det finnes et
sett verdt å gate.** Cowork eier vurderingen av når settet er stort nok.

✅ **PROD À JOUR 2026-09-04** — **`96eebc13`** (14 commits, 38 filer, +803/−209): EXIF-opptakstid
og -sted på bilder · lesbar endringslogg (kolonnenavn + fra→til, rå UUID skjult) · kanonisk
`repeaterRad`-tvilling. **Ingen migreringer** («No pending migrations to apply»). Api og web
bygget sekvensielt, begge oppe.
⚠️ **Ustemplet deploy** — `/version` svarer `{"gitSha":"dev"}` fordi den lim-klare prod-blokken
manglet `GIT_SHA`/`BUILD_TID`. Rettet i [deploy-detaljer.md § PROD-deploy](deploy-detaljer.md)
samme dag; prod er stemplet fra og med neste deploy.

✅ **OTA I DRIFT fra 2026-09-04** — første `eas update` publisert til kanal `production`,
runtime `1`, commit `cdb53296`, verifisert på Kenneths iPhone mot bygg 54. **JS-fikser koster
ikke lenger byggkvote.** Web måtte tas ut av `platforms` (`app.json`, `2b73ae68`) — `eas update`
kaller eksporten med `--platform=all`, og web-bundelen har to uavhengige feil. Full mekanikk:
[eas-build-veileder.md § OTA](eas-build-veileder.md).

📌 **Historikk:** prod sto på `af49823f` fra 2026-09-02 21:11 (132 commits, 175 filer, +10124/−1272).
Én migrering: `20260830120000_registrering_fase2_prosjekttilgang` (rent additiv, to `ADD COLUMN`).
De tre andre db-pakkene: «No pending». Migreringsgaten verifiserte `sitedoc`, ikke `sitedoc_test`.

**Verifisert som innlogget bruker på A.Markussen-data:** eksisterende sjekklister rendrer uten
«Felttype ikke støttet» (legacy-vernet for `location` holder) · nytt prosjekt fikk **ingen**
automatiske medlemmer under default `manuell` · endringslogg og PDF-tidsstempler stemmer med
veggklokka — **både formatereren og de lagrede øyeblikkene er riktige**, den fryktede
dobbeltforskyvningen finnes ikke.

📱 ✅ **TestFlight-bygg #54 ER UTE** (`d9ce38c0`, 04.09 12:36, 6m 9s, runtime `1` → TestFlight «Processing»).
Bærer alle seks funnene fra bygg 50, PDF-forhåndsvisning som virker, `expo-updates`, galleri-flervalg
med nummerering, kø-robusthet, vedlegg som overlever gjeninngang, og repeater-traverseringen.
**Forutsetning som måtte i prod først:** `settVedleggUrl` (prod-deploy `4eb05f73`) — uten den svarte
serveren 404 og vedlegg nådde aldri dokumentet.

⚠️ **BYGG 51 — to målinger som ikke lar seg forene, og cowork har tatt feil om den TO ganger.**

| Kilde | Hva den viser |
|---|---|
| `eas build:list` (04.09) | #51 = «iOS internal distribution build», profil `preview`, Runtime `None`, Channel `None` |
| App Store Connect → TestFlight (04.09) | #51 står som **«Testing»**, 5 invites, **2 installs, 53 økter** |

**Testerne HAR altså brukt bygg 51.** Cowork påsto først at den var et produksjonsbygg (feil grunnlag),
så at den aldri nådde testerne (også feil — TestFlight viser bruk). **Hvordan et internal
distribution-bygg havnet i TestFlight er ikke forstått, og skal ikke gjettes på.**

🔴 **Lærdommen, som gjelder uansett hvilken av de to som er «riktig»:** cowork førte begge påstandene
fra hukommelsen om hva som ble *startet*, ikke fra en kilde. Samme feilklasse som 31.08 («bygg 47 er hos
testerne» etter at 48 var fyrt). **Byggnummer, profil OG distribusjon leses fra `eas build:list` +
App Store Connect — og når de to er uenige, står begge i loggen til noen har målt hvorfor.**

⚠️ **Foreldet linje under — gjaldt bygg 50:**

📱 ✅ **TestFlight-bygg #50 ER UTE** (`28f117a8`, commit `da0f0181`, 02.09 23:43 → TestFlight 03.09).
Syv mobil-runder, **alle verifisert på simulator FØR bygget** — første gang
[kvalitetssikringsplanens](kvalitetssikring-plan.md) lag 2 fungerte som tenkt.
Se [eas-build-veileder.md § Bygg-logg](eas-build-veileder.md).

**Hva testerne er bedt om å se på:** tegningsminne + repeater-arv (målt 7→4 og 5→0 trykk) ·
«Hele prosjektet»-utveien i byggeplass-chip · språk pl/lt/sq med HMS-kategoriene.

⚠️ **Foreldet linje under — tavla sa `ba234fd1` mens prod faktisk var `3a2f7dc3` (29.08).
En prod-deploy ble aldri ført.**

✅ **PROD À JOUR 2026-09-06 17:15** — `82cd4459`. Verifisert: `/version` → `82cd4459`.
Migreringer: «No pending» (ingen nye siden `ad18df93`). **Innhold:** byggeplass-tilhørighet på
raden · ærlig chip-tekst · mykt tegningsfilter · «bekreftet av» på gjestesignatur · splittet
teller «X signert + Y bekreftet» · fritekst-lokasjon.
🟢 **OTA `c0d556ce`** publisert etter (api-filteret måtte ut først), pluss `42ef3059` tidligere
samme dag (utlogging + byggeplass-velger).

**Forrige prod: `ad18df93`** (2026-09-06 13:40, over tjue merger fra to døgn).
Stempel verifisert: `curl https://api.sitedoc.no/version` → `ad18df93`.
**Tre migreringer anvendt mot prod-DB:** `20260906000000_sja_signaturrunder` ·
`20260906120000_sja_innholdsversjon` · `20260906130000_signatur_bekreftet_av` ·
`20260906140000_lokasjon_fritekst` — alle additive, ingen kolonner slettet.

**Innhold:** SJA-signaturrunder (tre tabeller, felttypen `signature_list`, manko-liste,
serverlås, innholdsversjon per signatur, «bekreftet av» for gjest) · signaturfeltet bærer navn
og tidspunkt · kollapset signaturflate · endringsloggen koalescert + lukket som standard ·
malrevisjon D med utkast-badge · fritekst-lokasjon · delt `TILBEHOR_REN_FJERNING_BASE` ·
paritetsvakt på PDF-tvillingen.

🟢 **OTA publisert samme runde** (`333359a6`, runtime `1`, kanal `production`, update group
`523c0f61`) — rekkefølgen var **prod-deploy FØRST, så OTA**, fordi mobilkoden leser tabeller
som måtte finnes i prod-DB-en først.

⚠️ **Mobilflaten er IKKE verifisert av et menneske ennå.** Expo Go på Kenneths telefon er
SDK 57, prosjektet er SDK 54 — iOS tillater ikke eldre Expo Go, så test mot `sitedoc_test` var
en blindvei. Valgt vei: prod → OTA → verifiser på den ekte appen, med `eas update:rollback` som
nett (minutter, ingen byggkvote). **Risikoen ble vurdert lav fordi `signature_list` er inert i
prod til en mal bruker objektet.**

**Forrige prod: `ba234fd1`** (2026-08-28 16:00, 26 commits). **TestFlight-bygg #46** (`5605775d`)
sendt inn i runden før (`5dcdeb58`).

**Test: `1e259d55`** (deployet 2026-09-05 21:38, verifisert: `/version` → `1e259d55`).
🔴 **Hele SJA-signaturrunde-settet er nå på test** — rundene 2–5 merget 05/06.09: signatur bærer
navn+tidspunkt · kollapset signaturflate · tre nye tabeller + felttypen `signature_list` + PDF +
manko-chip · serverlås mot skriving på avsluttet runde · malrevisjon D · drift-konsolidering.

🟢 **Migreringen `20260906000000_sja_signaturrunder` ANVENDT** mot `sitedoc_test` — første og
eneste gang den har møtt en database. Den var generert offline (`migrate diff`) fordi lokal DB
har historikk-drift og mangler pgvector i shadow-basen; **den gikk gjennom på første forsøk.**
Øvrige tre db-pakker: «No pending».

🟢 **Testdata seedet 21:42** (`SEED_SJA_BRUKER=kemyrhau@gmail.com`): firma **SITEDOC MYRHAUG**,
prosjekt `SD-DEMO-SJA-0001`, SJA «Løft mobilkran — Akse 4». Deltakere: Kenneth (ansvarlig/admin),
Ola Tømrer, Nina Elektriker, gjest Truls Kranfører. Runde 1 avsluttet m/alle fire signert
(`antallDeltakere` frosset), **runde 2 åpen på 1 av 4** — Kenneths egen rad står usignert.
🔴 **Kenneth logger inn som seg selv via OAuth** — ingen demo-bruker kan logge inn.

⚠️ **Første seed-forsøk (21:15) lagde et ORPHAN-prosjekt** uten firma, og brukere uten
OAuth-kobling som aldri kunne logge inn. Rettet i `8b3110b8`; den idempotente `update`-grenen
reparerte raden på stedet. **Cowork gatet branchen, leste seed-fila og sjekket prod-guarden i
stedet for firmaregelen** — gaten sviktet, ikke bare koden.

🔴 **VENTER: fabels skjermbilde-gate.** Underlaget lister åtte flater
(`docs/redesign/til-fabel/skjermbilde-underlag-sja-signaturrunder-2026-09-06.md`).
**Ingenting av dette går til prod før gaten er kjørt.**

**Forrige test: `345de5e3`** (deployet 2026-09-02 11:00). Nytt siden
`d2b9d189`: **REG fase 3 — prosjekttilgang-evaluatoren** (`23a52504`) og **lokasjon-begrepsryddingen**
(`81225a93` — paritetsregel, `location` avviklet fra palett+seeds, repeater arver tegning fra rad
n−1). Migreringer: «No pending» på alle fire.

🔴 **FEM ugatete runder på test nå.** Anbefalt rekkefølge (én handling gater to ting): opprett et
prosjekt → tester **både** prosjekt-veiviserens tekst **og** at evaluatoren ikke slapp inn noen
under default `manuell`. Sett så én ansatt til `alle` → nytt prosjekt → kun han med, som vanlig
medlem. Deretter firma-veiviser, lokasjonsparitet og timer-rapporten.

⚠️ **Foreldet linje under — gjaldt forrige deploy:**

**Test: `d2b9d189`** (deployet 2026-09-02 00:09, verifisert med `/version`). Nytt siden `7b413263`:
**firma-veiviser** + **prosjekt-oppsettveiviser** (masterplanens punkt 1, begge ugatet) og **fem
timer-rapport-funn** fra Kenneths gate (velger i filterraden · innholdsbevisste bredder ·
maskinlinje foldet når `utleieEnhet="time"` · disabled-knapper forklart · «Last ned PDF»).
Migreringer: «No pending» på alle fire.

⚠️ **Foreldet linje under — gjaldt forrige deploy, beholdt til gaten er kjørt:**

**Test: `7b413263`** (deployet 2026-09-01 21:19, verifisert med `/version`). Migreringer:
«No pending» på alle fire pakker — settet har ingen schema-endringer (`db-timer/schema.prisma`
ble kun kommentert om til v3).

**Foran prod, web-synlig:** ANSVARLIG-kolonnen · modulhierarki steg 3 (✅ **gatet av Kenneth
18:30** — familieskillet holder) · endringslogg-speiling i oppgave (⚠️ **ugatet** — loggen vises
ikke i oppgavens UI, kun i arkiv-PDF, se BACKLOG) · **kolonnevelger + tabellbredder** (⚠️ venter
gate).

**Foran prod, kun mobil — når EAS-bygg fyres:** tegningsminne i repeater-raden · «Hele
prosjektet»-utvei i byggeplass-chip · modulgating av Timer-flatene. Fire mobil-endringer
uverifisert på enhet; røyklisten kjøres før bygget.

**Ellers står test og prod på samme innhold.** Alt som lå her som «på test» er live:
registreringsmodell fase 1 (ansatt-status-guard i 11 porter), ansattvelger, fundament ut
av gruppemodul-gatingen, tre slettevakter, deaktivert-på-dyplenke, `@xenova` fjernet.
Detaljer per spor: [historikk-2026-08.md § Prod-deploy 2026-08-28](historikk-2026-08.md).

🔴 **Første release som kan FRATA tilgang.** `OrganizationMember.status` styrer 11
prosjekt-porter. Deaktivering er manuell — ingen ansatt endret status ved deploy
(migreringen er additiv med default `aktiv`). Følg med på A.Markussen: sjekklister,
oppgaver og tegninger dukket samtidig opp for ansatte som ikke så dem før.

🔴 **`deploy-prod.sh` printet migrate-linja for kun `@sitedoc/db`, og etter `up`.** Begge
rettet i skriptet 28.08. Det var den linja som lot `20260811130000_utlegg_ordning_justering`
(`db-timer`) ligge ukjørt i prod i to uker — releasenoten på `a8750601` sa «ingen
migreringer», sant for `packages/db`, usant for `db-timer`. Utleggskategori-siden var
ødelagt i prod hele perioden; ingen meldte fra fordi timer-modulen ikke er i bruk der.
**Regel: spør databasen, ikke diffen** — alle fire pakker, hver gang, FØR `up`. Se
[deploy-detaljer.md](deploy-detaljer.md).

✅ **EAS-bygget er IKKE lenger blokkert (2026-08-27 kl. 22).** Opprett-frysen er lukket
og gatet 3/3 i Release/Fabric (`fix/malvelger-intree`, merget `52495604`).

**Fire runder på samme feilklasse, og den fjerde traff fordi premisset ble motbevist:**
`MalVelger.tsx:50` påsto at Fabric rendrer `<Modal>` inline uten native VC. Simulator
observerte svart pageSheet **med grabber** — en glyf bare UIKit tegner for en presentert
VC. `a29f89b2`, `df86b817` og `d4a76020` fjernet hver sitt nabo-ledd og lot det native
arket stå, fordi kommentaren sa det ikke kunne være kilden. Fiksen var å fjerne arket.
🔴 **D1 («krasj ved sending») fantes aldri som egen sak** — det var denne frysen,
feilaktig tilskrevet send-knappen. Send-flyten er verifisert frisk i både dev og Release.

**Veien til TestFlight er åpen:** merge develop→main → prod-deploy → migrering →
prod-verifisering som innlogget → env-diff (`eas-build-veileder.md`) → EAS
production-bygg → submit. Kvote ~8 igjen, reset 1. sept.

**Gjenstår på mobil, ingen av dem blokkerende:** timer-splitt som omgår server-validering
(lønn-integritet, høyest), papirkurv-guard, tab-bar-oppfølger fra
`relay/inbox-malvelger-intree.md`, og `BackHandler` uverifisert på Android.

**Printmotoren fase 1–4 er levert og på test.** Modellen ble snudd 2026-08-27: malen
styrer **skjermen**, og eksporten skriver ut det som vises. Se
[printmotor-faser-2026-08-25.md](delplaner/printmotor-faser-2026-08-25.md)
§ Retningsrettelse. Neste retning er **arkivering framfor nedlasting** — fabel eier
designet; det harde premisset er at `Folder.projectId` er påkrevd mens timer-rapporten
er en firma-flate.

**✅ TIMER-SPORET LUKKET 2026-08-24.** Fabels designgate på D3 bestått skriftlig:
[gatekvittering-d3-pivot-fabel-2026-08-24.md](../redesign/gatekvittering-d3-pivot-fabel-2026-08-24.md).
Rettecommiten for småfeilene er `5b104725` (verifisert i develop med `merge-base`).
Levert i samme runde: D3-pivotene, norm-kolonne med union-avvik, dagskort-hover med
tillegg/utlegg og tre innganger, URL-båret retur-navigasjon, kollaps/utvid alle,
«Krever vurdering» med auto-utvidede avvikssedler, og fem firma-guarder.

**Lukket 2026-08-23:** `mobil-device`-raden. `feat/mobil-arkiv-pdf` er merget (verifisert med
`merge-base --is-ancestor`); raden sto åpen på arbeid som lå i develop. Samme feilklasse som
utlegg-raden 2026-08-15 — en `❓ ingen status`-rad er ikke bevis for at noe gjenstår.

🔵 **Prod-releasen 2026-08-25 (`a8750601`, 198 commits) tømte etterslepet.** Develop er
nå 60 commits foran igjen — se tavla øverst for gjeldende tall og migrerings-status.
Den gamle 132-advarselen er avløst av den releasen og fjernet 2026-08-27.

**🔓 Frysen på `packages/pdf/src/felt.ts` er opphevet (2026-08-23).** Kontrollplan målte at
fila ligger i mobil-bundlen (Metro tree-shaker ikke barrel-re-eksporter), og konkluderte at
frysen sto. Cowork målte kallveien: null kallsteder i `apps/mobile`, og mobilens eneste
`@sitedoc/pdf`-import (`ekspanderEndring` m.fl. i `arkivmal/endringsdiff.ts`) har ingen kant
inn i `felt.ts`. **Bundlet ≠ kjørt** — død kode som endres, endrer ingenting for noen.
Vedtak ført i [dokumentgenerering-plan.md](dokumentgenerering-plan.md), branch
`docs/felt-frys-opphevet`. Bundle-størrelse er eneste gjenværende kostnad (egen sak).

**🗑️ PROD-DATAFIKS 2026-08-20 — timerader tømt for A.Markussen (før demo).** Ustrukturerte
testdata slettet på Kenneths ordre: 18 `daily_sheets`, 16 `sheet_timer`, 2 `sheet_tillegg`,
4 `sheet_machines`, 2 `sheet_tillegg_vedlegg` (0 utlegg, 0 historikk). Én transaksjon med
`ON_ERROR_STOP=1`; alle tall verifisert mot forhåndstelling. **Backup:**
`server-ny:~/backup/timer-for-sletting-20260820-0753.sql` (54K, hele `timer`-skjemaet).
De to vedleggsfilene flyttet til `~/backup/karantene-timer-20260820/` — **ikke slettet**,
fordi prod og test deler uploads-volum (test-DB verifisert til 0 referanser før flytting).
**Ikke rørt:** lønnsarter, aktiviteter, tilleggskatalog, maskinregister — oppsettet står.

**✅ KP MOBIL TOM-TILSTAND — LIVE-VERIFISERT 2026-08-21 (alle tre grønne).**
iOS-simulator fra `SiteDoc-simulator` mot api-test/`sitedoc_test`. Bevis:
`SiteDoc-simulator/kontrollplan-bevis/` (tre PNG).

| Tilstand | Kontekst | Skjermen viste |
|---|---|---|
| **A** | B12 → sommerfeldtsgt 65 (0 punkter) | «Ingen kontrollpunkter på denne byggeplassen» + trykkbart «Bygg B12 [7] ›» |
| **B** | Agent-testprosjekt → Testområde 1 (0 i hele prosjektet) | «Ingen kontrollpunkter» — ingen liste, ingen bytt-til |
| **C** *(edge)* | B12 → Narvik — **plan finnes, 0 punkter** | Identisk med A |

**Edgen var den som kunne gått galt:** `harPunkter` nøkler på `plan.punkter.length > 0`,
ikke på om planen finnes. En tom plan faller derfor til «ligger på»-grenen, ikke til
B-teksten. Verifisert i kode og live.

**404-degraderingen er verifisert borte** — ved capture svarte
`kontrollplan.andreByggeplasserMedPunkter` 200. Uten deployen ville queryen gitt 404 →
tomt kandidatsett → **A og C ville falskt vist seg som B**. At de viser «ligger på Bygg B12»
beviser at skjermbildene viser koden i drift, ikke feilmodusen. Verdt å huske som mønster:
en feilende query kan degradere til noe som ser ut som riktig oppførsel.

🟡 **Sidefunn å vurdere:** byggeplass-katalogen på mobil er per-firma og refreshes **ved
login** — firma-bytte alene synker den ikke. Verifiseringen krevde frisk innlogging for å få
Testfirma AS' byggeplasser. Om det er bevisst eller en mangel er ikke avklart.

**✅ AM ORDRE 2 STEG 1 LEVERT 2026-08-20** — `feat/am-ordre2-attestering`, 2 commits.
Design: [designnotat-attestering-fabel-2026-08-20.md](../redesign/designnotat-attestering-fabel-2026-08-20.md).
Grunnlag: [na-rapport-attestering-2026-08-20.md](na-rapport-attestering-2026-08-20.md).

- **`e4755aaa` — API-fikser + shared.** `erstattet`-filter i `hentTilAttestering` (+ alias)
  — dobbelttelling var en bug uavhengig av dette designet. Multi-status i
  `hentTilAttesteringFirma` (union, bakoverkompatibel). **`beregnUkenorm`** i shared med
  **injisert** dagsnorm-oppslag (server: `hentEffektivArbeidstid`, mobil: lokal variant) —
  37,5/40 forekommer aldri som literal, overgangsuker regnes blandet. Fallback-konstanten
  samlet til én `STANDARD_ARBEIDSTID_FALLBACK`; Prisma-`@default` forblir literal.
- **`9afc8951` — backstop (B) + snapshot.** `beregnOvertidsgrunnlag` +
  `lesOvertidsgrunnlagFraSnapshot` i shared. Backstoppen er **lese-avledning**, ikke
  persistert kolonne: overtidsgrunnlaget beregnes on-the-fly per sedel fra radenes timer ×
  effektiv dagsnorm (sommertid-bevisst). `attestertSnapshot` utvides **ved attestering**
  med uke-nivå grunnlag → etterprøvbart i ettertid.

🔴 **Vedtaket bak (B):** persistering ved skriving ble avvist fordi den fryser normen på
**feil tidspunkt** — attestanten skal se normen som gjaldt da *han* vurderte, ikke da
arbeideren førte. Systemet har allerede riktig mønster i `attestertSnapshot` (prissnapshot,
Fase 0 A.7), som fylles ved attestering. Fabel endret sitt eget designord («lagrer») da
argumentet ble lagt fram. Se [domene-arbeidsflyt.md](domene-arbeidsflyt.md) —
`lonnsartId` røres aldri av backstoppen; avvik mellom beregnet og valgt er noe attestanten
**ser**, ikke noe systemet retter.

**Tester:** 19/19 i shared, inkl. de to gate-testene — at beregningen aldri muterer input
(`lonnsartId`-invarianten), og at gamle snapshot-former gir `null`, aldri `0` (et `0` ville
sett ut som et faktum). Typecheck 5/5. Ingen migrering.

**Ytelse (målt av dokgen):** lese-avledningen gjør ett `hentEffektivArbeidstid`-kall per
unike dato, uke-scopet → ≤ 7 kall uansett antall rader eller ansatte.

**⏸ STEG 2 (D3-visningene) venter fabels designgate.** Ikke bygget.

**✅ AM ORDRE 1 (timer-bugs) LEVERT 2026-08-20** — `fix/am-ordre1-timer`, 3 commits, merget develop.
Fabels ordreliste: [referat-markussen-ordreliste-fabel-2026-08-20.md](../redesign/referat-markussen-ordreliste-fabel-2026-08-20.md).

- **1a `5eb47e6b` — delete-propagering server→mobil.** Rotårsak: `hentEndringerSiden`
  hadde **ingen delete-kanal**; juli-tombstonen (`slettede_rader_local`) er en lokal
  mobiltabell som kun går mobil→server. Server hard-sletter uten spor, klienten fjernet
  aldri lokale rader som manglet i svaret → splitt doblet timetall, og de 18 slettede
  sedlene levde videre. Fiks: pull-svaret bærer nå et autoritativt id-sett for et
  **eksplisitt intervall**. To vakter i delt, testet `finnSedlerÅSlette`
  (`packages/shared/src/utils/timerSyncSletting.ts`, 9/9): klienten sletter kun innenfor
  serverens uttalte intervall, og rører aldri `pending`/`avvist`.
  **Tombstone-tabell ble avvist** — hver delete-vei måtte da huske å skrive den, samme
  feilklasse som ga oss `steg`-problemet. Ingen migrering.
- **1b `e789ddc4` — play viker for manuell føring** (fabel-gatet regel (a), 2026-08-20).
  Play-genereringen kaller nå samme delte `finnOverlappendeTidsrom` som manuell-veien —
  ikke en kopi. Ved overlapp settes play-raden ikke inn; varselet sier hvilke tidsrom som
  vek og at den manuelle raden er beholdt.
- **1c `668b834f` — eksportfeilen er ikke lenger taus.** `håndterEksport` hadde
  `try/finally` uten `catch`; kast ble stille konsoll-rejection = «virker ikke» uten spor.
  Nå vises `e.message` i rød banner. **`xlsx`-sikkerhetsbyttet er irrelevant her** —
  timer-eksporten bruker allerede `exceljs`; FTD/økonomi er eget spor.

🟡 **ÅPENT på 1c:** det faktiske exceljs-kastet er **ikke pinnet**. Chrome-verktøyet nådde
aldri `document_idle` (presence-WebSocket holder siden «busy»). Vei videre: deploy catch-en
til test, kjør eksporten, les `e.message` i banneret. Server-side-flytt holdes tilbake til
kastet er identifisert.

**DoD klikktelling (fabels krav):** ingen av de tre fiksene endrer klikktall — 1a leser rent
fra lokal SQLite, 1b beholder play på 3 tapp (fjerner kun avvist-risiko), 1c er 2 klikk.
Det er et **funn**, ikke et tomrom: «mange klikk»-inntrykket adresseres i ORDRE 2s
designrunde (dagskort-åpning).

**Reload:** mobil 1a+1b er JS-endringer → Metro-reload i dev. TestFlight krever nytt
EAS-bygg (native uendret, men `@sitedoc/shared`-endringen må inn i bundelen).

**Branch-rydding 2026-08-20:** `fix/pakke-a-sikkerhet` merget + slettet på origin.
`fix/endringslogg-web` merget (`b4159178`) — den var **ikke** overflødig; `ce994756`
(ord-nivå diff, 133/133) hadde ligget ferdig og umerget siden 16.08.

**Venter på Kenneth:**

- **A4 Norkart** — utsatt, dialog tar tid. Kode urørt til ny nøkkel finnes.
- **Browser-verifisering av A1** etter test-deploy: dokument med tabeller rendrer, tegning
  kan inspiseres med hover-highlight. Bommer SVG-profilen, ser man det der.
- **TestFlight bygg 45** — testliste i [testliste-bygg-45.md](testliste-bygg-45.md).
- **Brannmur** — venter på LAN + fysisk konsoll. Ingenting eksponert utenfra (målt).

**Åpne fabel-saker:** repeater-prinsippet · papirkurv-sletterettigheter · mappe-modellens
flyt-spørsmål (punkt 4 i revidert synlighetsvedtak).

⚠️ **Statusfilene i `relay/status/` er utdaterte** (2026-08-20) — `mobil-device` sier
«FERDIG» fra S1-runden, `utlegg` sier «BLOKKERT» på noe som ble merget for en uke siden.
Denne tavla er sannheten; statusfilene oppdateres av agentene selv og drifter.


---

## EAS-byggteller (kvote ~15/mnd, fri plan — nullstilles den 1.)

> Ordre 1 ([SAMARBEIDSREGLER § Cowork leveranse-ansvar](SAMARBEIDSREGLER.md#cowork-leveranse-ansvar-ordre-2026-07-14)): cowork sporer EAS-bygg her. Ved **12 bygg/mnd** → stopp + sjekk klar-tilstand + flagg i status før nytt bygg fyres. Dato/# bekreftes mot `eas build:list`.

🔴 **DENNE TABELLEN ER FJERNET 2026-08-31 — den var et duplikat som drev.**

**Kanonisk byggteller: [eas-build-veileder.md § Bygg-logg](eas-build-veileder.md).**
Ikke før tall her; les dem der, og les dem der fra `eas build:list`.

**Hva som skjedde:** tavla førte kun `production`-byggene og sa «2 brukt, ~13 igjen» for
august. Veilederen var **allerede rettet 28.08** til «12 bygg, 11 tellende, ~4 igjen» — men
cowork leste bare tavla, korrigerte den mot `eas build:list`, og kom til ~3 igjen fordi det
errorede bygget 17.08 ble regnet som brukt. Veilederen visste at det var en CocoaPods 429 fra
EAS-infra som eksplisitt *«does not count towards usage»*.

**To registre for samme tall, og begge tok feil på hver sin måte.** Kenneth 2026-08-30:
*«vi kan aldri duplisere hverken UI eller kode»* — det gjelder tellere også. Tavla peker nå,
og teller ikke.

**Status 2026-08-31: 12 bygg, 11 tellende, ~4 igjen. Reset 1. september.**

**Lærdom 43→44:** to mislykkede fyringsforsøk på 43 brente **null kvote** — begge feilet under credential-validering før byggestart. Første: `~/.zshrc:17` manglet linjeskift mellom to `export`-linjer → `Invalid Apple Team Type: INDIVIDUALexport`. Andre: Apple 403 «This provider does not exist» da de nå korrekt parsede `EXPO_APPLE_*`-variablene ble sendt i stedet for EAS' lagrede credentials. Kvote telles først når bygget faktisk starter.

**Juli 2026 — 4 bygg brukt (av ~15), ~11 igjen.** Kilde: `eas build:list --platform ios` (ikke gjetning — forrige teller hadde feil datoer og utelot #37).

| # | Dato | Commit | Profil | Formål |
|---|------|--------|--------|--------|
| 37 | 2026-07-01 | `bc744f82` | production | mobil-MS + F-G |
| 38 | 2026-07-11→13 | `d1b96cd5` | production | F4-serien (identitetsforsoning + attestering-deadlock + synk-robusthet) |
| 39 | 2026-07-13→14 | `cd3efcb5` | production | S-A tombstone + del 6 (F-b/e/f/g) + footer |
| 40 | 2026-07-15 | `43299d03` | production | timer F2/F3/F5 + edge #1 (byggeplass per rad + matpause-bærer). Build `15a47804` → TestFlight |

Terskel 12/mnd ikke nær. **#40-lærdom:** EAS autoIncrement teller mot EAS' egne byggrecords, ikke ASC — første submit feilet på “build number 40 already used” (ASC hadde en 40 EAS ikke kjente). Bygget var intakt; ingen kvote brent på retry.

## 🔵 PROD-LIVE MERKNAD — sidebar-label byttet for ALLE (2026-07-14)

`nav.sok` «Søk»→«Dokumentsøk» + `nav.kontrollplan` «Kontrollplaner»→«Kontrollplan» rendres i gammel `HovedSidebar` (`sidebar-elementer.tsx:131,145`) — **ikke** bak `nyNavigasjon`-flagg. Kilde: `73f88112` (finnbarhet i18n), live i prod via develop→main-deploy **`43299d03`** (2026-07-15). **Pilot-support:** etiketten byttet for ALLE brukere, ikke bare ny-nav — bevisst (unngår label-mismatch på tvers av flagg-tilstand, jf. Lokasjoner/Byggeplasser). `firmaNav.innstillinger`→«Firmaprofil» er derimot INERT i prod (gammel firma-nav hardkoder «Innstillinger»).

## 🔴 SIKKERHET — flyttet til [sikkerhet.md](sikkerhet.md) (2026-08-28)

Punktet om uautentisert tilgang til sjekkliste-/oppgavebilder sto her med en
overskrift som hadde mistet kroppen sin — innholdet under hadde drevet over til
arkivmal-PDF. Vurderingen, de fire funnene om `/uploads/` og hva som er målt trygt
står nå samlet i [sikkerhet.md](sikkerhet.md). **Ikke dupliser hit.**

> 🟢 **ARKIVMAL I PROD 2026-08-16 (`c0b9f826` + runde 2).** Server-side PDF via Playwright erstatter ikke klient-utskriften ennå, men er komplett i vedtatt form: repeater-bilder i full bredde under egen rad (ikke samlet bakerst), løpenummer «Bilde 07 · 13.08.2026 10:41» lest fra `Vedlegg.bildeNr` med fallback til dokumentrekkefølge, IMG-filnavn og dokument-id ute, side 1-marger rettet (dobbel padding fjernet). **Rendertid 7,46 s på BEF-001** (73 bilder) — Kenneth målte i prod, tallet avblokkerer ytelsesspørsmålet.
>
> **Fabel-vedtak bak dette:** `arkivmal-repeaterbilder-vedtak-fabel-2026-08-15.md` + `arkivpdf-seks-funn-vedtak-fabel-2026-08-16.md`, begge in-repo i `docs/redesign/`. Mockup: `docs/redesign/arkivmal-pdf-mockup/`.
>
> **Gjenstår før klient-utskriften kan fjernes:** endringsloggen er den siste flaten som ikke gir mening for en leser — vær-rader gjentas (nøkkelrekkefølge varierer, ikke reell endring), «5 rader (14 bilder) → 5 rader (14 bilder)» sier ikke hva som endret seg. Samlet runde ligger i `relay/inbox-endringslogg.md` per Kenneths ønske om færre deploys. Sju øvrige saker fra mockup-gjennomgangen er ført i BACKLOG (statusblokk-etiketter, befaring som dokumenttype, to nye utskriftsformer, RUH/HMS, vedlegg-radformat, `bildeNr` i app, værsnapshot).

> 🟢 **LUKKET I PROD 2026-08-15 — målt sum 0.** `audit-sensitive-apen-sti.ts` (read-only, mot prod-DB) viser **null** sensitive fil-referanser på åpen `/uploads/`-sti: timer (tillegg+utlegg), kompetanse, maskin, `Image.file_url` og feltvedlegg i `Checklist`/`Task.data` — alle 0.
>
> **Veien dit, samme dag:** åpen `uploads/` ryddet (104 jpg → 102 slettet: 73 migrerte originaler + 2 foreldreløse + 27 uten referanse, **88 MB**). To rader i `timer.sheet_tillegg_vedlegg` sto igjen på åpen sti og ble migrert med `migrer-sensitive-filer-til-privat.ts --utfor`. Prod-dump før inngrepet: `~/backup/sitedoc-pre-slett-20260815-1251.dump`.
>
> **To hull funnet ved oppryddingen** (branch `fix/s1-feltvedlegg-privat`, merget `160c269a`):
> 1. `apps/mobile/src/components/rapportobjekter/FeltDokumentasjon.tsx:146` kalte `lastOppFil` med tre argumenter → `privat` falt til default `false`. Dette kallet går utenom `OpplastingsKoProvider` (som utleder `privat` korrekt fra id-ene). Steg 4 ville **avvist** disse opplastingene, ikke sikret dem.
> 2. `sheet_utlegg_vedlegg` (U1, 2026-08-08) manglet i alle migreringsscripts — lagt til som Type 4.
>
> **Prosessfunnet er viktigst:** S1 hadde **to** scripts, og bare `migrer-bilder-til-privat.ts` ble kjørt mot prod. `migrer-sensitive-filer-til-privat.ts` dekket timer hele tiden — den ble aldri kjørt. Ingenting fanget det; hullet ble funnet ved en filopprydding, ikke av en gate. Alle 15 kallsteder til `lastOppFil`/`/api/upload` er nå kartlagt (mobil-device punkt 4): de 9 øvrige uten `privat` er prosjektmedia, modeller, punktskyer, mapper og NS3420-import — ikke persondata.
>
> **Gjenstår:** `--rydd-originaler` (venter til test-DB også er migrert) · steg 4 hard validering (etter EAS-adopsjon) · test-miljøet ikke auditert.

## Branch-detaljer — aktive brancher (én rad per branch, ikke per agent)

> Hvem som sitter hvor står i **STATUSTAVLE** øverst. Denne tabellen er detaljnivået: hvilke filer branchen eier, hva som er committet, hva som gjenstår. Rad fjernes når branchen er merget + slettet.

> Kontrollflate for Kenneth ([SAMARBEIDSREGLER § Opus-livssyklus](SAMARBEIDSREGLER.md#opus-livssyklus--fire-faser-vedtatt-2026-07-16)). Rad skrives **før** økta åpnes; fjernes når branchen er merget + slettet. **Tom tavle = ingen aktive økter.** Ingen to rader deler arbeidstre eller fil.

| Økt | Arbeidstre | Branch | Eier filer | Åpnet | Status |
|---|---|---|---|---|---|
| **Malarkiv AM4b (lån-dialog ved skala)** | `SiteDoc-kontrollplan` | `feat/malarkiv-skala` | `apps/api/src/routes/bibliotek.ts` (ny `hentMalInnhold`) · `apps/web/.../firma/malarkiv/page.tsx` (lån-dialog: `LaanFraSentralarkivDialog` + `MalRad` + `FeltForhandsvisning`) · `apps/web/.../malbygger/PalettElement.tsx` (eksporter `felttypeNokler`) · i18n (9 nøkler × 15) | 2026-09-05 | 🟢 **Kodet, pushet (fra develop `a7f112da`).** «Velger ved skala»-mønsteret (L4) i lån-dialogen: **L1** inspiser-før-lån (rad → read-only feltliste, feltnavn+type i rekkefølge gruppert på FØR/UNDER/ETTER slik lån-mutasjonen bygger malen; lån-knapp i preview + på rad) · **L2** kollapsbare kapitler med antall-header, start kollapset >20 maler, kun økt-tilstand (`useState<Set>`, ikke localStorage/DB) · **L3** søk over navn+kode, treff auto-utbrettes, tomt søk → kollaps-tilstand. **🔴 Gate-funn løst (målt):** `hentStandarder` selecter IKKE `malInnhold`; eager-lasting = O(alle felt i hele arkivet) per dialog-åpning → ny **lazy** `bibliotek.hentMalInnhold` henter felt for ÉN mal, kalt først når previewen åpnes. **Ingen delt komponent** (fabel-vedtak 05.09) — BL gjenbruker spesifikasjonen. web build + mobil typecheck + lint (0 errors) + shared 636 grønt, i18n 13-generert. Ingen migrering. **Ingen prod/test-deploy ennå. DoD ÅPEN:** skjermbilder til fabel-gate med seedet arkiv >20 maler (kollapset start, søk, inspiser, lån) + klikk-tall — venter Kenneths test-deploy + >20-seed. |
| **Malarkiv AM4 (bolk 2 UI)** | `SiteDoc-kontrollplan` | `feat/firma-malarkiv-ui` | `apps/api/src/routes/firmamal.ts` (+3 ruter) + `mal.ts` (include) + `modul.ts` (steg 5-seeding) · `apps/web/.../firma/malarkiv/page.tsx` (ny) + `MalBygger.tsx` + `MalListe.tsx` + `firma-nav.tsx` + `firma/layout.tsx` · i18n (57 nøkler × 15) · `docs/claude/migrering-reporttemplate.md` | 2026-09-04 | 🟢 **Bolk 2 committet (fra develop `ca83c9a2`).** Steg 2 (arkivsiden, amber `/dashbord/firma/malarkiv` — rute-avvik fra `/oppsett/firma/*` gatet av Kenneth: den ga prosjekt-sone) + steg 3 (promoter + badges + L6 «Oppdater» i MalBygger) + steg 4 (ny-mal «Fra firmaarkivet» + L2-badges i MalListe) + steg 5 (firmamal-seeding i `modul.aktiver`, additivt, syv inventar-linjer bevart, ingen åttende funksjon). Nye ruter: `kanPromotere`/`listeForProsjekt`/`oppdaterKopiFraHovedmal`. API-typecheck + web build + 189 web-tester + i18n 13-generert grønt. **🔴 L2-nyanse til fabel-gate:** «Erstatter standardmal»-badge er BEREGNET ved visning (ikke lagret). **L8 (full firma-modus i MalBygger) = egen branch `feat/malbygger-firmamodus` etter dette** (Kenneth-vedtak, egen gate). Ingen migrering i denne branchen. Ingen prod/test-deploy ennå. **Venter test-deploy for E2E + skjermbilder til fabel-gate.** |
| **Malarkiv AM4 (bolk 1)** | `SiteDoc-kontrollplan` | `feat/firma-malarkiv` | `packages/db/prisma/schema.prisma` + migrering `20260904120000_malarkiv_hms_kolonner` · `apps/api/src/routes/firmamal.ts` (ny) + `trpc/router.ts` · `docs/claude/migrering-reporttemplate.md` | 2026-09-04 | 🟢 **Bolk 1 committet (fra develop `171995ef`).** Additiv migrering (5 kolonner: `organization_templates.subdomain`/`hms_synlighet`/`standard_for_nye_prosjekter`/`laant_fra_bibliotek_mal_id` (B4, FK SetNull→BibliotekMal) + `report_templates.versjon_av_hovedmal`; kun ADD COLUMN, to-stegs-policy) + `firmamal.*` tRPC-ruter (`list`/`hent`/`opprett`/`oppdater`/`slett`/`promoter`/`kopierTilProsjekt`/`laanFraSentralarkiv`). L5 avstamning via `organizationTemplateId`+`versjonAvHovedmal`; slett→SetNull via schema-FK; firma-admin-gate (L7) på skriv/promoter/lån, prosjektadmin-gate på henting; L9 fane-filter; `config.zone` verbatim i begge kopiretninger. **B4 (Kenneth 04.09): `laanFraSentralarkiv` setter strukturert peker `laantFraBibliotekMalId`, ikke fritekst i description** — avviket fra første rapport lukket i bolk 1 (skjemaet ferdig ⇒ bolk 2 = ren UI). API-typecheck + `@sitedoc/web` build + rot-testsuite (189 web) grønt. Ingen prod, ingen test-deploy ennå. **Bolk 2 (UI, steg 2-5) = egen branch etter test-gate.** |
| **Mobil arkiv-PDF (Fase 1)** | `SiteDoc-mobil-device` | `feat/mobil-arkiv-pdf` | `apps/mobile/app/sjekkliste/[id].tsx` · `packages/shared/src/i18n/*.json` (2 nøkler × 15) · `docs/claude/dokumentgenerering-plan.md` (felt.ts-presisering) | 2026-08-18 | 🟢 **Fase 1 committet — additivt.** Mobil kaller nå `trpc.arkiv.rendr` (server-generert arkiv-PDF, samme motor som web) som **primær** vei: base64 → `cacheDirectory` via `expo-file-system/legacy` → deles med eksisterende `expo-sharing`. Mangel-kontrakt speiler web (`renderTimeout`→«prøv igjen», `manglendeVedlegg`→«N mangler», `komplett`→stille; inline, ingen toast). Offline (`useNettverk`) → «PDF krever tilkobling», mutasjon fyres ikke. Header: primær `Share2`=arkiv + fallback-pill «Lokal» (`Printer`-ikon) = urørt `expo-print`-vei. **`expo-print`-koden røres ikke** (Fase 3, egen gate). **Måling meldt:** `felt.ts` kan IKKE avfryses selv etter Fase 3 (`renderFelt` lever i `arkivmal/innhold.ts` = server-arkiv); det er `byggSjekklisteHtml`-grenen i `sjekkliste.ts` som dør. Én PDF-vei i mobil (kun sjekkliste). Auth = Bearer på tRPC-klienten (bekreftet mot `context.ts`). typecheck mobil grønt, i18n +2×15. **⏳ Venter enhets-verifisering i Fase 2 (EAS-bygg, batches — ikke fyrt).** Ingen migrering. Ingen prod. |
| **App-felt (vær + bildeNr)** | `SiteDoc-mobil-device` | `feat/app-vaer-bildenr` | Sak B: `FeltDokumentasjon.tsx` (web+mobil) · 4 skjema-hooks · `shared/utils/bildeNr.ts`. Sak A: `useAutoVaer.ts` (web+mobil) · mobil-prefyll (2 hooks) · `VaerObjekt.tsx` (mobil) · `providers/VaerKoProvider.tsx` (ny) · `lib/trpc.ts` (vanilla) · `shared/utils/vaer.ts` | 2026-08-16 | 🟢 **Sak B committet** (`ead0179b`, pushet). 🟢 **Sak A committet:** målrettet prefyll-fjerning (kun vær-anker; prod: 1 væranker i Befaringsrapport-malen, 22 datofelter urørt), umiddelbar henting ved satt/endret tidspunkt (time nærmest klokkeslett, delt `byggVaerSnapshot`), offline vær-kø (`VaerKoProvider` — «venter»-markør på feltet ER køen; reconnect-sweep henter for LAGRET tidspunkt via archive-API + vanilla-tRPC), tre UI-tilstander. No-op verifisert (`likForDiff`, `sjekkliste.ts:676`). typecheck web+mobil+shared + 475 shared-tester grønt. 🟢 **(d) PDF-resolve ved finalisering committet (isolert):** ved terminal-transisjon (`endreStatus`, sjekkliste+oppgave) løses «venter»-vær-felt server-side for det LAGREDE tidspunktet (archive-vær) og persisteres i `data` — merkes `hentetIEttertid`; feilet henting → `status:"ikke_registrert"` permanent (`services/vaer-finalisering.ts`, 7 tester). Guard i `oppdaterData` (begge): finalisert dokument dropper vær-felt-skriving stille → vær-køen kan aldri overskrive frosset snapshot. `felt.ts` fallback «Ingen værdata»→«Ikke registrert». Server-side vær-henting ekstrahert til `services/vaer.ts`. typecheck+lint+vitest grønt. 🟢 **Simulator-verifisering BESTÅTT (2026-08-16, iOS-sim mot api-test, orakel via dev-login):** (1) online snapshot for satt tidspunkt — befaringstidspunkt 14.08 kl 20:44 → Vær = 12 °C/overskyet/0.76 m/s/7.9 mm = eksakt archive-fasit for 14.08 kl 20, IKKE i dag (16.08: 14.2 °C/0 mm); (2) `VaerKoProvider`-sweepen — plantet «venter»-markør (lagret tidspunkt 15.08 kl 14) resolvet på ~8 s til 15.4 °C/Lett yr/1.41 m/s/8.1 mm = eksakt fasit for 15.08 kl 14, synket til SQLite + server. Begge resolve-veier hentet for LAGRET tidspunkt, ikke tilkoblingstidspunkt. **⚠️ Forbehold:** simulatoren kan ikke gjøres NetInfo-offline (deler Mac-nettet), så `useAutoVaer` sin offline-**skrivegren** ble ikke trigget av ekte offline — «venter»-markøren ble **plantet** for å kjøre sweepen. Begge resolve-veier er dermed enhet-verifisert; residualet er selve markør-skrivingen (dekket av logikk + at sweepen konsumerte nøyaktig markør-formen). Faithful ekte-offline-test krever ekte enhet i flymodus. **Fil-overlapp med «S1 Fase 1b» på web `FeltDokumentasjon.tsx`.** Ingen migrering. **Ingen prod.** |
| **Modul-onboarding (seed-policy)** | `SiteDoc-mobil-device` | `feat/seed-dispatch-settfirmamodul` (steg 3+4) | `apps/api/src/services/seed/index.ts` · `apps/api/src/routes/organisasjon.ts` · `apps/api/src/routes/timer/onboarding.ts` | 2026-08-11 | 🟢 **Steg 1 (`921a221e`) + steg 2 (`2fde8565`) MERGET develop + test-verifisert**; backfill kjørt prod (1 rad: A.Markussen-lonnsart). **Steg 3+4 (generisk seed-dispatch) diff-klar** (ORDRE blokk 24/25): ny `seedFirmamodulKatalog(slug, org)` kalles fra `settFirmamodul` ETTER kjerne-tx commit (kryss-DB → kan ikke være i tx-en). Per-datatype `try/catch` → `feil[]` (én feilende datatype blokkerer ikke resten); logges tydelig med org+datatype, aldri svelget. `aktiverNivaa1` = tynn inngang (base via dispatch + Nivå 2 kun ved `inkluderNivaa2`); `seedTimerForOrganization` retiret. `aktiverTomKatalog` uendret (kun interne prosjekter, ingen katalog). **maskin + varelager: ingen hook** — begge dokumentert i dispatch-koden (maskin=enums; varelager=firma-definert uten universell default, steg-4b Beslutning 8). 4 nye unit-tester (feil-isolasjon + no-op-moduler). Api-only, ingen migrering, ingen prod. **Steg 5** (onboarding.status 3-verdi + `mangler`-rapportering) egen gate. **Navngitt oppfølger:** `aktiverTomKatalog` bør selv skrive `egen_katalog`-policy-rader; datatype `varekategori` reservert for evt. framtidig varelager-hook. |
| **Firmarolle-konsolidering** | `SiteDoc-mobil-device` | `fase2-firmarolle-enkilde` | `apps/web/src/kontekst/firma-kontekst.tsx` + 7 lesebaner | 2026-08-10 | 🟢 **Fase 1 MERGET develop (`97f55fd5`).** **Fase 2 (én lesekilde) fabel-designgodkjent** (`FABEL-GODKJENNING-fase2-firmarolle.md`) — 8 kode-lesninger → `kanAdministrereFirma`, `erCompanyAdmin` fjernet, `BrukereFane` leser `firmaRoller` direkte. DoD browser-verifisert: Mathias (user + firma_admin) firma-lenke synlig i BEGGE nav. Kode-divergens lukket; data-divergens består (vakten = tripwire). **Venter Kenneths merge.** **Fase 3** (skrivebaner + `admin.ts:455` + avvikling `company_admin` fra `users.role`): **venter stabilitet i prod + migreringsgate hos Kenneth — ikke åpnet.** **Navngitt oppfølger (egen sak):** multi-firma firma-admin — `valgtFirma` settes ikke ved >1 medlemskap (`firma-kontekst.tsx:83-87`) ⇒ all firma-gating dør; krever firma-velger m/lagret valg + `hentBrukersOrg`-primærorg. |
| **Lagringsstatistikk** | `SiteDoc-utlegg` | `feat/lagringsstatistikk` | `packages/shared/.../lagring.ts` (+test) · `apps/api/src/routes/lagring.ts` + `trpc/router.ts` · web `admin/lagring/page.tsx` (+layout-nav) + `firma/fakturering/page.tsx` · i18n · `docs/{api.md}` | 2026-08-11 | 🟢 **Kodet, diff-klar (fra develop).** `lagring.oversikt` (sitedoc-admin: per firma×prosjekt×modell + standalone + foreldreløse) + `lagring.firmaOversikt` (firma-admin, per prosjekt). Aggregering on-demand, cache 1t, ren `aggregerLagring` i shared. **Akse = `primaryOrganizationId` (eierskap)**, divergerer bevisst fra admin.ts/grense. **Foreldreløse bilder (24 % prod) = egen post, aldri fakturerbar; fakturerbart ≠ faktisk diskbruk.** **Dekningsgrad-restpost:** filer uten målt størrelse (`file_size NULL`) per modell, vist når >0 (fakturering krever 100 % dekning). 🔴 **`drawings.file_size` IKKE strammet** — skrivestien lager DWG-layouts uten fileSize (`tegning.ts:187,539`); NOT NULL ville gitt 500. Ingen migrering. shared 455 + api/web tsc + api-lint grønt, i18n-paritet 3457/3457. **Ingen prod.** |
| **Deaktiver-mønster** | `SiteDoc-utlegg` | `feat/deaktiver-monster` | `apps/web/src/components/deaktiver/*` (3 nye) · `expenseCategory.ts` (deaktiver/aktiver) · 4 timer-flater · i18n · `retningslinjer/deaktiver-monster.md` | 2026-08-12 | 🟢 **Kodet, diff-klar (fra develop).** Delte `DeaktiverKnapp`/`VisInaktiveToggle`/`InaktivBadge`; `Power`-ikon overalt, `title=`→`Tooltip` (konsekvenstekst «skjules for nye reg., eksisterende beholder den»), «Vis inaktive (N)», hjelpetekst. Ny `expenseCategory.deaktiver`/`aktiver` (integritet verifisert: `ordningVedFoering` NOT NULL, ingen mellomtilstand). 4 timer-flater hevet. api/web tsc + lint grønt, i18n-paritet 3454/3454. Ingen migrering. **Ingen prod.** |
| **E2E-opprydding** | `SiteDoc-utlegg` | `feat/e2e-opprydding` | `apps/api/src/routes/admin.ts` (`sweepE2EFirmaer`) · `tests/e2e/global-setup.ts` · `apps/api/scripts/roykt-grense.ts` · `tests/e2e/README.md` · `api.md` | 2026-08-12 | 🟢 **Kodet, diff-klar (fra develop).** `admin.sweepE2EFirmaer` (sitedoc_admin + **env-guard `sitedoc_test`**, sletter `E2E%` eldre enn 24t uten prosjekter) kalt av `global-setup` ved oppstart. `roykt-grense` fikset (E2E-prefiks + slett org). **Funn:** playwright-suiten oppretter ingen org; org-søppelet var fra seed-live-bevis (ad-hoc). **🟡 Meldt til cowork:** «Testfirma AS (agent-test)» er et permanent fikstur uten E2E-prefiks — omdøpe (berører seed) eller la stå? Venter cowork-svar. api tsc + lint grønt. Ingen migrering. **Ingen prod.** |
| **Utlegg-ordningsmodell** | `SiteDoc-utlegg` | `feat/utlegg-ordningsmodell` | `packages/shared/src/utils/utleggOrdning.ts` · `apps/api/src/routes/timer/expenseCategory.ts` · `apps/web/.../timer/[id]/page.tsx` · `docs/claude/timer.md` | 2026-08-08 | 🟢 **U1 prod (`e37621e1`). U3 web MERGET develop + E2E GATET** (DB CHECK + API-guarder + 6 browser-bevis mot mockup). U2 utsatt. Neste: U4 mobil (bygg 45) |
| **Utlegg U5 — overstyring-UI** | `SiteDoc-utlegg` | `feat/utlegg-u5-overstyring` | `apps/api/.../timer/expenseCategory.ts` · `apps/web/.../firma/timer/utleggskategorier/page.tsx` · `oppsett/prosjektoppsett/page.tsx` · `timer/[id]/page.tsx` (sats-hint) · i18n | 2026-08-11 | 🟢 **Kodet, diff-klar (fra develop).** Firma-admin `settOrdning` + overstyring-CRUD; ny `firma/timer/utleggskategorier`-fane (ordning per kategori + prosjekt-overstyring + navnekollisjon-varsel + immutabilitets-mikrotekst); prosjektadmin read-only i prosjektoppsett; sats-hint-fiks. Ingen migrering. Build 2/2. **Browser-verifisering venter deploy til test.** Gjør U3 ferdig. **Ingen prod** |
| **Dataeksport (server-side dokumentgenerering)** | `SiteDoc-mobil-device` | `feat/eksport-fase2-filer-csv` (fase 2) | `apps/api/src/services/eksport/{arkiv,filer,csv,felles,eksport-worker}.ts` · `routes/eksport.ts` | 2026-08-11 | 🟢 **Fase 1 (infrastruktur) diff-klar** (blokk 28) — `EksportJobb`-tabell + migrering `20260811160000` + poll-worker + stream-zip + `verifiserKanEksportere`. **Fase 2 (filer + manifest-innhold + CSV) diff-klar** (blokk 28/29): `samleProsjektFiler` henter alle filer for prosjektet (bilder via Checklist/Task→ReportTemplate, tegninger + originaler + revisjoner, FtdDocument, utleggs-/tilleggsvedlegg fra timer-db) → strømmes fra disk til zip m/ dedup; manglende disk-fil markeres i manifest (feller ikke). `byggTimerCsv`/`byggUtleggCsv` = rådata-CSV (`;`, UTF-8 BOM, norsk komma). Manifest binder hver fil til domeneobjektet + `avgrensninger[]`. PointCloud + PDF-dokumenter bevisst utelatt (fase 3). Nedlastings-URL bumpet 10→60 min (Range-requests re-valideres per chunk). **Activity-logging** på `bestill` + `hentNedlastingsUrl` (sistnevnte nå mutation — revisjonspliktig utstedelse) m/ ip/userAgent (plumbet gjennom delt context-stamme, TS-tvunget på api+web+test-harness). 10 unit-tester. Live-smoke: kjerne-DB-veien OK (lokal sandbox mangler timer-tabeller → full end-to-end = Kenneths test-verifisering). **Migrering (fase 1) gates av Kenneth.** **Fase 3** (PDF-renderer, egen container) venter fabels mal-mockup + at fase 1+2 er levert/verifisert. **Ingen prod.** |
| **Utlegg modelljustering** | `SiteDoc-utlegg` | `feat/utlegg-ordning-justering` | `packages/shared/.../utleggOrdning.ts` (+test) · db-timer schema + migrering `20260811130000` · `apps/api/.../expenseCategory.ts` (+`.test.ts`) + `dagsseddel.ts` · web `utleggskategorier/page.tsx` + `timer/[id]/page.tsx` · mobil `UtleggSeksjon.tsx` + `timerSync.ts` + `schema.ts` · i18n · `docs/claude/timer.md` | 2026-08-11 | 🟢 **Kodet, diff-klar (fra develop).** Gate 1: **`sats`→`lonnstillegg`** (homonym-fiks, enum+3 CHECK+delt utledning+UI+i18n) · **`fakturert` ut av valgbare** (enum beholdt for historikk, `SETTBAR_ORDNING_ENUM={utlegg,lonnstillegg}`) · nye `satsbasert`+`muligSkattepliktig` på ExpenseCategory (firma-admin-toggle) · **U5 upsert-test** (samme id, aldri delete+create; fakturert avvist). Migrering: data-rename + 3 CHECK-recreate + 2 kolonner. shared 441 + api/web/mobil tsc + api-lint + 3 upsert-tester grønt, i18n-paritet 3446/3446. **🔴 Migrering gates av Kenneth. U4→prod blokkert til dette er inne.** Gate 2 (`refusjonsKontonummer` på kjerne-`OrganizationSetting`) etter. **Ingen prod** |
| **Utlegg U4 — mobil** | `SiteDoc-utlegg` | `feat/utlegg-u4-mobil` | `apps/api/.../timer/expenseCategory.ts` (`katalogForMobil`) + `dagsseddel.ts` (`syncBatch`/`hentEndringerSiden` utlegg) · `apps/mobile/src/components/timer-detalj/UtleggSeksjon.tsx` (ny) · mobil db/schema+migreringer · `timerKatalog.ts` · `timerSync.ts` · `OpplastingsKoProvider.tsx` · `bildeRegistrering.ts` · `app/timer/[id].tsx` · i18n · `docs/claude/timer.md` | 2026-08-11 | 🟢 **Kodet, diff-klar (fra develop).** Utlegg på mobil (mockup 8c), offline-først, speiler tillegg 1:1. **Ordning utledet aldri valgt; klient stempler `ordningVedFoering`+`foertVed` ved FØRING, server re-utleder ALDRI ved sync** (motsatt av web-stien — bevisst). `createdAt`=klient-`foertVed` (reviderbart; tillegg-hullet ikke kopiert → oppfølger). Kamera-primær, beløp før bilde, Lagre gated på kvittering, ≥44 px. Offline-cache via `katalogForMobil` (5. pull, kaster før sletting). api+mobil tsc + lint grønt, i18n-paritet OK. **Reload: ny build (mobil-JS).** **Simulator-verifisering + koordinering med mobil-device-sporet før merge. Ingen prod** |
| **S1 Fase 1b — bilde-signering** | `SiteDoc-mobil-device` | `feat/s1-fase1b-bilde-signering` (steg 1) | `apps/api/src/utils/vedleggSignering.ts` (+test) · `routes/{bilde,hms,sjekkliste,oppgave}.ts` | 2026-08-12 | 🟢 **Steg 1 (signeringsinfra) diff-klar** — prod-tall inne (union 39 filer, 1 foreldreløs, 10 kun-images, 28 i begge). Ny delt rekursiv `signerVedleggIData`/`signerBilder`/`signerDataRad(er)` signerer bilde-URL ved EMISJON (aldri persistert → `slettMedUrl`s eksakt-match består). Påført display-emisjonene: `bilde.hentForProsjekt` (galleri) + `sjekkliste/oppgave.hentForProsjekt`+`hentMedId` (data+images) + `hms.hentForProsjekt`/`hentFirmaOversikt` + `oppdaterData`. `slettMedUrl` normaliserer query bort (`normaliserFilSti`). 6 unit-tester (rekursjon repeater+attachments, ingen mutasjon). **Nyanse rapportert:** post-migrering finnes ingen åpne URL-er → usignert emisjon = brutt visning (401), ikke lekkasje; status-transisjons-returer (ikke gjengivelses-veier, klient refetcher) venter cowork-avklaring. Incidental: pre-eksisterende ubrukt `erAdmin`→`_erAdmin`. **Steg 2 (opplasting→privat) diff-klar** (branch `feat/s1-fase1b-opplasting-privat`, på steg 1): web felt-vedlegg (`FeltDokumentasjon`+`TegningsModal`) → `?privat=1` (umiddelbar); mobil-kø utvidet til bilder (sjekkliste/oppgave, nytt EAS-bygg); `bilde.opprett*` myk validering (advarsel ved åpen sti, aksepterer begge — server kan ikke skille klientversjon). To-stegs: hard validering (steg 4) etter EAS-adopsjon, TODO i kode. **Steg 3** (migrering, gated — disk-script beskrives+gates før bygging) → **4** (hard validering). **Ingen prod.** |
| **Mal-integritet** | `SiteDoc-utlegg` | `feat/mal-integritet` | `packages/db/prisma/schema.prisma` + migrering `20260810120000` · `apps/api/.../mal.ts` + `bibliotek.ts` · `apps/web/.../MalListe.tsx` · i18n | 2026-08-11 | 🟢 **Kodet, diff-klar (fra develop).** SLETT-VERN: `slettMal`/`slettObjekt` teller dokumenter (aktive+papirkurv) → nekt m/ lesbar melding; `Task.template` SetNull→**Restrict** (DB-backstop). UNIKHET: funksjonelle unik-indekser `(projectId, lower(btrim(navn/prefiks)))`, prefiks partiell eks-PSI; app-validering `opprett`/`oppdaterMal` + auto-ledig i `kopier`/`importerMal`. Build 2/2. **🔴 Migrering FEILER ved dubletter — rydd DB først** (skann: `~/mal-dubletter-skann.sql`; prod REN, test ryddes av Kenneth). Oppfølgere under. **Ingen prod — Kenneth kjører** |
| **Seed manglende firmakatalog** | `SiteDoc-utlegg` | `feat/seed-manglende-katalog` (`966ed8db`) | `apps/api/src/services/seed/index.ts` · `apps/api/src/routes/admin.ts` · `seedManglende.test.ts` · `docs/claude/timer.md` | 2026-08-10 | 🟢 **MERGET develop. Live-bevis grønt på test (begge varianter).** `admin.seedManglendeFirmakatalog` (sitedoc_admin) — idempotent, **kun `expenseCategories`**. Import-org: `egendefinert=3` uendret før/etter seed (importerte lønnsarter urørt). Enhets-testet + live 0→5/re-kjør=hoppet. Ingen migrering. **⏳ Venter prod:** etter develop→prod-deploy, seed A.Markussen (`4488fe17-…`) → `{opprettet:5, hoppet:false}`, lønnsart står på 44. Oppfølgere: **tre-tilstands-guarder** (aldri onboardet→seed / onboardet→hopp / bevisst egen katalog→hopp+ikke ufullstendig — føring Kenneth 2026-08-10, A.Markussen `seed_nivaa=1`=0 er ØNSKET; `onboarding.status` overrapporterer ufullstendig; se timer.md § Onboarding) + settFirmamodul-wiring; prosjektmodul-variant (998/RUH) |
| **Firmarolle Fase 2** | `SiteDoc-mobil-device` | `fase1-firmarolle-vakt` → Fase 2 | `firma-kontekst.tsx` · `Toppbar.tsx` · `BrukereFane.tsx` · `kompetanse` | 2026-08-10 | 🔵 **Fase 1 (vakt) i prod.** Fase 2 = én lesekilde (`kanAdministrereFirma`), 8 kode-lesninger. Fabel-godkjent ordre v2. Fase 3 (migrering) IKKE hastet |
| **Mal-integritet** | `SiteDoc-utlegg` | *(ny branch)* | `mal.ts` · `schema.prisma` | 2026-08-10 | 🔴 **Slett-vern først:** `slettMal` teller ikke dokumenter; `Task.templateId` nullable ⇒ `SetNull` ⇒ foreldreløse oppgaver (0 i prod nå). Så: unikt prefiks+navn per prosjekt (Kenneth-vedtak) |
> **Kjent test-residue (`sitedoc_test`, 2026-08-10) — BEVISST, ikke søppel:** seks navngitte «E2E …»-orger fra seed-live-beviset står igjen (ingen org-slett-prosedyre finnes). Tre er «E2E Tom» (variant 1): `30d46d3d`, `16af5ab1`, `d96d4934`. Tre er «E2E Import» (variant 2, **har importerte lønnsarter uten `seedNivaa`** — nyttig fikstur for framtidig seed-testing): `8c66cd2e`, `2bef5939`, `9301e0e6`. cowork: la dem stå.

**Tavla er tom for aktive kode-økter** (2026-07-24) — hele flyt-sporet + A-3b er merget til develop. `SiteDoc-a3b`-treet kan ryddes (branch merget). Fabel-design + backlog-saker (Tooltip v2, `ListeKontroll`, mobil-wiring, flyt-handlingstekster) er ikke aktive økter.

| **Registrator-fiks** | *(økt kan exit)* | `fix/registrator-rettigheter` | `flytRolle.ts` · `statusHandlinger.ts` · `tilgangskontroll.ts` · `DokumentHandlingsmeny` | 2026-07-21 | **✅ MERGET develop (`cb3ce3d1`).** Fase A+B — registrator ikke lenger superbruker. ⚠️ Åpen rest: `rejected→sent` → handlingsmeny-arbeidet ([registrator-rolleforveksling.md](delplaner/registrator-rolleforveksling.md)) |
| **K1+K2 kontekst** | *(lukket)* | `fix/k1k2-kontekst` (`f28aecfd`) | — | 2026-07-21 | **✅ MERGET (`31c831a8`) + på test.** Lukket |
| **K3 + P1 kontekstvelger** | *(deployet prod)* | `feat/k3-kontekstvelger` (`c34b3859`) | — | 2026-07-23 | **✅ DEPLOYET TIL PROD (develop→main 2026-07-23).** Hele K3-sporet live: trakt + to-linjers topplinje + sidehode + ⇄ + timer-hjem + maskin-kontekst + polish. Arkivert → [historikk-2026-07.md](historikk-2026-07.md). P1 subsumert |

> ✅ **Avgjort (fabel 2026-07-21, alternativ c): A-3b HOLDES til registrator-fiksen har landet.**
>
> **Premisset:** perspektivmatrisens REGISTRATOR-kolonne (`utledPerspektiv` — registrator dominerer ballinnehav) bygger på **dagens** semantikk, der registrator er superbruker. Etter [registrator-fiksen](delplaner/registrator-fiks-ordre.md) er registrator en *deltaker med leserett*.
>
> **Hvorfor (c) og ikke (a)/(b):** (a) ville revidert matrisen mot en semantikk som ikke finnes i kode ennå — brudd på fakta-først. (b) ville deployet en etikett-modell vi **vet** skal endres, til alle pilotbrukere — to deploys og forvirring for null gevinst.
>
> **To føringer:**
> 1. Når registrator-fiksen er landet og verifisert, leverer utførende Opus **oppdatert perspektivmatrise som nå-rapport** (REGISTRATOR-kolonnen mot ny semantikk). **Fabel gater den FØR 1c-wiring starter.** Perspektivet består — «oppretter-som-venter» er et reelt syn — det er **etikettene** som måles på nytt.
> 2. **Del 1a+1b merges ikke til develop** i mellomtiden. Ingen perspektiv-etiketter ut til brukere før matrisen er gatet.
>
> ⚠️ **Presisering:** Del 1a+1b **er pushet** til `feat/a3b-perspektiv` (`535f8d8a`) — det er riktig og trygt, en feature-branch når ingen brukere. Det som holdes tilbake er **mergen til develop**. Arbeidet skal ikke un-pushes.

### 🟢 Flytmatrise-fundament — B-sporet (rettighetsmatrise som config)

Fundamentet under A-3b: statusmaskin (A-laget) + config-substrat (B) før perspektiv-visningen bygges oppå. Kilde: [rettighetsmatrise-config-design.md](delplaner/rettighetsmatrise-config-design.md) + [flytmodell-overgangsmatrise.md § FUNDAMENT-GAP](delplaner/flytmodell-overgangsmatrise.md).

| Kloss | Status | Merge |
|---|---|---|
| **A-laget** — statusmaskin (`rejected→sent` + `closed→draft` inert + i18n) | ✅ MERGET develop | `7571e968` |
| **B Kloss 1** — config-plumbing (`FlytRettighetOverride`/`Logg` + `ROLLE_HANDLINGER_DEFAULTS` + `celleTillatt` override-only-snitt + loader). **Bit-identisk.** | ✅ MERGET develop | `33c32f1f` |
| **B Kloss 2** — adminNiva (**kun sitedoc+prosjekt**, firma-admin droppet — Kenneth-vedtak) + PROSJ.ADMIN-kolonne + matrise-UI (`dashbord/firma/flyt-rettigheter`, sitedoc-gatet) + logg-skriving | ✅ MERGET develop (PR #3) | `a3e2cc66` |
| **B Kloss 2b** — firma-innstilling `autoProsjektAdmin` (medlemskap, ikke flyt-nivå — Kenneth-vedtak) + migrering `20260724120000`. Løser firma-admin ⊇ prosjektadmin via auto-medlemskap ved nye prosjekter | ✅ MERGET develop | `cca3f471` |
| **B Kloss 2c** — matrisen til Admin-flaten (§ 1c) + cellespec-kontrast (§ 2) + i18n × 14 | ✅ MERGET develop | `4d563c89` |
| **B Kloss 2d** — global konfig: dropp `orgId` fra `FlytRettighetOverride`/`Logg` + loader/tRPC/2c-UI (Kenneth-vedtak: én global konfig, ikke per-firma) + migrering `20260724130000` (TRUNCATE + drop orgId) | ✅ MERGET develop | `42b77e0c` |
| **B Kloss 3** — endringslogg-fane + les/rediger-fane (levert som ren visning i Kloss 2 — i praksis dekket) | 🟢 dekket av Kloss 2 | — |
| **A-3b perspektiv-visning** (oppå ferdig fundament) | 🟡 PAUSET — fundament nå komplett, kan gjenopptas | — |

**Ett-klikks-prosjektoppsett-visjonen** (firma-mal per kontorsted/avdeling) er ført i [BACKLOG](BACKLOG.md) — Kloss 2b er første konkrete skive (samme `prosjekt.opprett`-hook + `OrganizationSetting`).

🔴 **Migrerings-avhengighet (Kloss 1+2+2b+2d):** neste test-deploy av develop MÅ kjøre `migrate deploy` mot `sitedoc_test` for alle ventende: (1) `20260723120000_flyt_rettighetsmatrise_config` (opprettet tabellene — alt applied på test). (2) `20260724120000_organization_setting_auto_prosjekt_admin` (`ADD COLUMN auto_prosjekt_admin` — alt applied). (3) `20260724130000_flytmatrise_global_dropp_orgid` — **TRUNCATE begge config-tabellene + dropp `org_id` + ny global unik `(rolle, fra_status, til_status)`.** Idempotent (`IF EXISTS`-guards). ⚠️ TRUNCATE avviker fra to-stegs-policyen — begrunnet (kastbar config, aldri prod); **Kenneth bekrefter tilnærmingen ved `migrate deploy`.** Uten (3) er tRPC/loader/UI orgId-frie mens DB fortsatt har `org_id` NOT NULL → `settRettighet` feiler.

🔵 **Pilot-synlig endring ved neste deploy (Kloss 2):** firma-admin ser ikke lenger admin-handlinger i flyt-menyen (web+mobil). **Ikke kapabilitetstap** — serveren (`verifiserFlytRolle`) avviste dem uansett med «Ikke medlem av prosjektet»; menyen viste et fantom. Føres i pilot-endringsloggen når Kloss 2 deployes.

**Lukket 2026-07-24 (flyt-binding + dedikert HMS-løp, seks merger):** **F1 flyt-binding ved opprettelse** (B1–B4, `a98269ed`) + registrator-innstramming B2b + admin-bypass fjernet (`a7924c59`) — et dokument tilhører alltid nøyaktig én flyt (`dokumentflytId` påkrevd på server i standard-grenen), og **kun registrator-medlem** kan opprette (ingen admin-unntak; admin legger seg selv i flyten). HMS-grenen er flyt-løs by design (vedtak A, Guard 1 avviser innsendt flyt). **Sjekkliste-visning:** dokumentflyt-navn-kolonne + person/faggruppe-ikon i Ansvarlig (`39c6897c`). **CI:** K13 onboarding-redirect unntatt + `docs/**`-paths-filter så rene docs-pushes ikke trigger `test` (`687c71e2`). **Dedikert HMS-svar-løp** (Kenneths «eget dyr»-modell, adskilt fra dokumentflyt/rolle-matrisen): server-Ordre A — egen maskin `sent→responded→closed` + `verifiserHmsHandling` + `erHmsAdmin` (delt kilde m/ `byggHmsSynlighetsFilter`) + fire mutasjoner (`hmsBesvar`/`hmsLukk`/`hmsGjenapne`/`hmsTilfoyInformasjon`) + e-postvarsling (`ad9d2e0c`); web-Ordre B — `HmsHandlingsflate` + `hms.erHmsAdmin`-query + tidslinje-append (`85bc4349`); malbygger-Ordre C — HMS egen malbygger-type (`category="hms"` = malbygger-organisering, `domain="hms"` = runtime; dedikert `hmsmaler`-side + «Meld HMS»-inngang + migrering `20260724140000_hms_category`, `07113b89`); **task-Ordre D** — utvidet HMS-løpet til tasks (RUH/avvik var `category="oppgave"` og kjørte generell statusmaskin; nå opprett=send + de fire HMS-mutasjonene på task-tabellen + `HmsHandlingsflate` på oppgave-detaljsiden, speiler A/B, `50f0a232`). Design: [flyt-binding-design](delplaner/flyt-binding-design-2026-07-24.md) · [hms-dedikert-lop-design](delplaner/hms-dedikert-lop-design-2026-07-24.md) · [flyt-rolle-verifisering](delplaner/flyt-rolle-verifisering-2026-07-24.md). **HMS-løpet er komplett (A+B+C+D) — dekker både checklist (SJA) og task (RUH/avvik).** Klikktest 2026-07-24 avdekket task-gapet (kun checklist var dekket) → Ordre D lukket det. **Gjenstår:** klikktest RUH + HMS-avvik (task) ende-til-ende i Chrome-Opus · HMS-vedlegg til «Tilføy informasjon» (backlog, krever server-endring) · `migrate deploy` ved neste test/prod-deploy (kø: flytmatrise-migreringer + `20260724140000_hms_category`). **Data-hygiene:** prod-maltagging ren (audit 2026-07-24: SJA/RUH/HMS-avvik alle `domain="hms"`); test har én feiltagget «Sikkerhetsinstruks» (PSI, `subdomain="avvik"`) — test-only, ikke prod. F1 (a)–(d) verifisert på test 2026-07-24 (alle positive).

**Ordre E — HMS-oppgave polish (branch `feat/hms-oppgave-polish`, ikke merget):** to bugs fra klikktest 2026-07-24, gatet mot kode. (1) **RUH-ruting** — RUH-radklikk gikk til `/sjekklister/${id}`, men RUH er en task (`category="oppgave"`) → rettet til `/oppgaver/${id}` (`hms/page.tsx`). (2) **`[object Object]` i RUH-kolonnene «Type observasjon» + «Innmelder»** — rot: felt-verdier lagres nestet som `{ verdi, kommentar, vedlegg }` (jf. skjema-hooks + endringslogg `oppgave.oppdaterData`), men `hentDataVerdi` (`components/hms/visning.tsx`) rendret wrapper-objektet direkte. Fikset ved å pakke ut `.verdi` + speile `hentFeltVerdi`-mønsteret (type-aware person/firma/liste + `navneLookup` bruker-ID→navn, bygget fra `medlem.hentForProsjekt` og sendt inn i `RuhTabell`). Bonus: samme rot-fiks fjerner latent `[object Object]` i SJA-/avvik-datakolonner (samme delte funksjon). Web typecheck + test grønt (43/43). **Verifisert i Chrome-Opus 2026-07-25** — begge PASS (RUH-lista lesbar tekst, radklikk → `/oppgaver/`). **Hele HMS-sporet (flyt A–D + polish E) er ferdig og ende-til-ende-verifisert på test** — checklist (SJA) + task (RUH/avvik). **✅ DEPLOYET TIL PROD 2026-07-25** (main `661ba3c2`): F1 + HMS A–E + flytmatrise-fundament (Kloss 1–2d) + A-3b — sekvensielt bygg (ingen OOM, ingen kaskade), alle 4 migreringer anvendt mot `sitedoc` (`20260723120000`/`20260724120000`/`20260724130000` TRUNCATE+dropp-orgid/`20260724140000` HMS-kategori), alle containere Up, verifisert innlogget (sitedoc.no kjører). Backup: `~/backup/sitedoc-predeploy.dump`. **Arkiveringsplikt:** hele denne bunten flyttes til [historikk-2026-07.md](historikk-2026-07.md) ved neste doc-rens.

**Lukket 2026-07-20/21 (seks økter):** N3-fiks synlighet (`fix/n3-flytmedlem-synlighet`) · kode-Opus sak 1 (`fd573b61`) · kode-Opus spor 2 + sak 2 (`cf76d81d`, `ecedb7eb`) · mobil-Opus TegningsCapture (`b15dfe56`) · CI-Opus spor 1 (PR #1+#2) · web-Opus testrunder (sak 1 + sak 2, testplaner merket KJØRT). Alle merget til develop; tilgangslaget deployet prod.

> ⚠️ **Tavla var tom for alle seks mens de kjørte.** Rader ble aldri skrevet, og Kenneth måtte avslutte to økter uten oppfølging. Rettet ved [SAMARBEIDSREGLER § Tavle-binding](SAMARBEIDSREGLER.md#tavle-binding--commit-gaten-vedtatt-2026-07-21): ordre ⇒ rad og merge ⇒ rad-fjerning skjer nå i samme commit.

**Del6b fase 1 lukket 2026-07-16** — fabel-designgodkjent, alle punkter. Merget `f9416424` (pkt 2/3/6) + `297f5670` (pkt 1/4/5). Levert: print-fella borte (`q0–q9` droppet stille 7 av 17) · døde søkebokser koblet · prioritet-rader klikkbare · 4 filter-paradigmer → 2 delte kilder, null regresjon · prosjekt-HMS-defaulten synlig som chips · 35 i18n-nøkler × 14 språk. Statuskilde: `verifisering/del6b-verifiseringslogg.md` (designprosjekt «Sitedoc redesign tips»). Exit-funn i [BACKLOG](BACKLOG.md).

**Doc-oppryddingen 2026-07-15/16 er lukket.** Syv økter, alle merget: statuskilde/lesbarhet-reglene (`8ae0a3ac`) · regel 11 + 11b (`d1c6b4c9`) · tre aktive doc-løgner (`be5307be`) · Type 1-rydding, 13 funn (`fc96fcee`) · negative påstander, F1/F3/F21/F22 (`eab9bb85`) · STATUS-changelog + STATUS-AKTUELT-oppbrudd. Auditens 23 funn: 20 lukket, F15 + F24 + F25 ført i [BACKLOG](BACKLOG.md).

⚠️ **Presedens verdt å beholde (2026-07-16):** to økter fikk samme branch-navn (`docs/status-aktuelt-oppbrudd`) — den ene slettet den mens den andre skulle bruke den; ren flaks at rekkefølgen reddet arbeidet. Og to økter fikk samme arbeidstre (`SiteDoc-oppfolgere`), så auditens tre flyttet seg under den mens den kjørte. Begge var coworks feil ved ordreskriving, og begge er nøyaktig det denne tavla finnes for.

---

**Ikke en ny sårbarhet — dette er S1 Fase 1b, planlagt men ikke bygget.** `server.ts` sier det selv: *«Non-privat `/uploads/*` er uendret i Fase 1 (global gate kommer i Fase 1b).»* Målingen viser at hullet fortsatt står åpent.

**Målt på prod 2026-08-12:**

| plassering | bilder | volum |
|---|---|---|
| `uploads/` (åpen, ingen gate) | **50** | **46 MB** |
| `uploads/privat/` (signatur-gatet) | 0 | 0 |

`curl` mot `https://api.sitedoc.no/uploads/<uuid>.jpg` uten innlogging → **200**.

**Årsak:** `privat=1` sendes kun fra timer-siden (utleggsbilag, `dashbord/timer/[id]/page.tsx:2314,2967`) og mobil `opplasting.ts`. `bilde.ts` — som lagrer alle sjekkliste- og oppgavebilder — laster opp uten flagget. Kvitteringer er altså beskyttet; byggeplassbilder er ikke.

**Alvorlighet, ærlig vurdert:** UUID-er er 128 bit og ikke gjettbare, så ingen kan bla gjennom bildene. Men enhver URL som lekker — e-post, skjermdump, serverlogg, nettleserhistorikk på delt PC — gir permanent uautentisert tilgang til et byggeplassbilde som kan inneholde personer, kjøretøy eller skader. Personvernrelevant.

**Ikke løst av kveldens signaturfiks.** Den lukket omgåelse av gaten på `uploads/privat/*`; dette handler om at bildene aldri legges bak den gaten.

**Retning (ikke besluttet):** enten sende `privat=1` fra `bilde.ts` og signere bildelenker som timer-flaten gjør, eller bygge Fase 1bs globale gate på hele `/uploads/*`. Første er mindre, men flytter ikke eksisterende 50 filer; andre er riktig sluttilstand. Krever beslutning + migrering av eksisterende filstier.

## ✅ ARKIVERT — sikkerhetsfiks signaturgate `/uploads/privat/*` → [historikk-2026-08.md](historikk-2026-08.md)

Funnet, fikset, deployet prod (`0d5d54ee`) og verifisert i drift 2026-08-11. Fire utnyttbare omgåelsesformer (`//`, `/./`, `/../`, `%2e`) ga 200 mot ekte fil; alle gir 401 etter fiks på både test og prod. ⚠️ Gjenstår: innlogget nettleser-verifisering at bilder laster.

## Pågående arbeid (PR-historikk)

### ✅ Mobil-Microsoft dropper `User.Read` — ID-token framfor Graph /me (`19a2884e` + flertenant `7aa85094` — **I PROD `69ca9f62`, verifisert på telefon 2026-09-07**)

**Saken:** mobil-MS ba om `User.Read` (Graph → hele Entra-profilen) for å hente e-post/navn/id som
allerede ligger i ID-tokenet. Web ba om minimum (`openid profile email`); mobil var utliggeren.

**Løsning:** mobilen returnerer nå **ID-tokenet** (ikke access-tokenet); api validerer det med `jose`
mot Entras `/common`-JWKS, leser `oid`/`email`/`name` fra claims og **dropper Graph /me helt**.
🔴 **Flertenant:** `iss` valideres mot tokenets eget `tid` (ikke pinnet til vår tenant — det ville
sperret hver kunde som logger inn fra sin egen Entra), `aud` pinnet mot mobil-client-id. jose-feilkode
+ sviktet claim logges (aldri token/verdier). Admission-gaten i `byttToken` verifisert å gjelde
mobil-veien = den reelle grensen for hvem som slipper inn. `providerAccountId = oid` = uendret fra Graph-`id`-veien → **ingen
brutte koblinger** (målt: 3 mobil-MS-kontoer i prod, et rått bytte til OIDC-`sub` hadde gitt dem ny
konto). Scope: `["openid","email","profile"]`. Google urørt (0 mobil-kontoer, ba aldri om ekstra).

**Ny api-avhengighet:** `jose@^6.1.3` (biblioteket Auth.js selv bruker web-side). **Ny api-env
(test først):** `MICROSOFT_MOBILE_CLIENT_ID` (= `234ca0e0-…`) — se
[infrastruktur.md § Env-filer](infrastruktur.md). Ingen issuer-env (flertenant). Ingen migrering.

🔴 **OTA-landmine funnet + rettet i samme runde:** `EXPO_PUBLIC_MICROSOFT_CLIENT_ID` var en
plassholder i `.env.test`/`.env.production` (ekte kun i eas.json). Målt: alle OTA-er siden 04.09
bar plassholderen → MS-innlogging på mobil har vært **død for testerne i en uke**. Uten env-fiksen
ville denne auth-OTA-en brutt innlogging FØR ID-tokenet lages. Ekte (offentlig) client-id lagt inn
i begge `.env`-filer (sporet i git → propagerer til publiseringstreet); re-eksport bekreftet ekte
id i bundelen. Advarsel skrevet i [eas-build-veileder § OTA-logg](eas-build-veileder.md).

🔴 **Azure:** koden trenger ikke lenger `User.Read` — Kenneth fjerner tillatelsen i portalen, men
**FØRST etter at test-innlogging på telefon er verifisert** mot egen eksisterende konto.
🔴 **Leveringsvei:** api-deploy + mobil `eas update` kanal `test`. Gate strengere: ingen prod før
Kenneth har logget inn med MS på mobil mot test og landet på **egen** konto (samme prosjektliste).
Gaten grønt lokalt (api tc · web build · mobil tc · 210 tester · mobil lint 0 err).

### ✅ Arkiv-PDF for oppgave + HMS avvik/RUH — task-innholdsleser (`a2c7edc9` → develop `3c905298`, MERGET 04.09)

> ⚠️ **Merk om lokasjonOmfang-raden som sto her:** den ble erstattet av denne i dokgens commit.
> `feat/lokasjonomfang` (`9a94a249`) er **merget** til develop 04.09 — «Gjelder hele byggeplassen»
> som eksplisitt valg, L9 sticky tegning, `showLocation`-paritetsfiks på oppgavesiden, migrering
> `20260904140000_lokasjon_omfang` anvendt på test. Raden sto som «IKKE merget» i to timer etter
> mergen fordi **cowork ikke oppdaterte tavla** — agenten ryddet den bort med rette.
> 🔴 **Regelen «tavla har én skribent» virker bare hvis den ene skriver.**

**Ordre:** `relay/inbox-arkiv-pdf-oppgave-hms.md`, gatet av cowork 04.09, Kenneth-bestilt. **RUH og avvik er lovpålagt HMS-dokumentasjon som ikke kunne leveres som PDF** — de er `Task`, og `render.ts` kastet for alt annet enn sjekkliste. SJA slapp unna fordi den er `Checklist`. Pilotblokkerer for A.Markussen.

**Én rot, tre dokumenttyper, to flater:** `arkiv.rendr` godtok allerede `type:"oppgave"`; kun task-leseren manglet. Web + mobil kaller samme prosedyre.

**Levert:**
- **Task-innholdsleser (delt kjerne, krav 1):** `sammenstilling.ts` refaktorert til `byggArkivHtmlKjerne(norm)` + tynne `byggSjekkliste…`/`byggOppgave…`-adaptere over en `NormalisertArkivDok`. ~85 % delt (forskjellen liten → delt leser med type-diskriminant, ikke duplikat). Sjekkliste-utskrift **uendret** (151 arkiv-tester + 3 sjekkliste-orkestrator-tester grønne). Gjenbruker kanonisk repeater-traversering (`byggObjektTre`/`samleRepeaterMarkorer`/`byggInnhold`) — ingen tredje traversering.
- **HMS virker, ikke bare oppgave (krav 2):** avvik/RUH (`Task`, `template.domain="hms"`, subdomain avvik/ruh) trenger **ingenting** utover task-leseren — kun standard felttyper, ingen HMS-egne kolonner. Målt funn: status/signatur var sjekkliste-semantisk (`/godkjent/`); task/HMS-terminalen er «Lukket» (`tilStatus==="closed"`). Egen `signaturStrategi`: sjekkliste = Utført/Godkjent · oppgave/HMS = Opprettet/Behandlet.
- **`arkiv.rendr` (krav 3):** enum forblir `"sjekkliste" | "oppgave"` — **ingen egen `"hms"`-type.** Avvik/RUH ER tasks → «oppgave»-grenen dekker dem; domenet ligger på malen og styrer semantikk i leseren. En «hms»-type ville vært en redundant kontraktsendring mobilklienter i drift måtte lære. Tilgangskontroll + activity forgrenet på type (`task`/`checklist` + hmsSynlighet).
- **Begge flater (krav 4):** PDF-nedlasting på web oppgave-side; del-ikon + «Forhåndsvis» + `ArkivPdfForhandsvisning` (WebView) på mobil oppgave-side. Komponenten var allerede type-agnostisk.
- **Krav 5:** `ArkivPdfForhandsvisning` bruker allerede `ModalFlate` (ikke `SafeAreaView` i Modal).

**Paritetsmatrise (etter denne runden):**

| | Web | Mobil-app | Arkiv-PDF |
|---|---|---|---|
| Sjekkliste | ✅ | ✅ | ✅ |
| Oppgave | ✅ (+ PDF-knapp) | ✅ (+ PDF/forhåndsvis) | ✅ (ny task-leser) |
| HMS (avvik/SJA/RUH) | ✅ | ✅ | ✅ (SJA=Checklist fra før · avvik/RUH=task-leser) |

**Målt avvik meldt:** mobil oppgave-detalj viste ingen dokumentlokasjon fra før (kun tegning-chip); ikke rørt utover PDF-knappen (egen sak). **Leveringsvei:** server-PDF + web → prod-deploy; mobil-UI via `eas update`.

**Gate grønn (lokalt):** web build · api+mobil typecheck · mobil lint 0 · api 277/277 · pdf 97/97 · shared 636/636.

### 🟢 lokasjonOmfang — «Gjelder hele byggeplassen» som eksplisitt svar + L9 sticky tegning (`feat/lokasjonomfang`, MERGET develop `ea66590b`)

**Ordre:** `docs/redesign/ORDRE-lokasjonomfang-2026-09-04.md` (+ L9-tillegg), fabel-vedtatt av Kenneth 04.09. Forankring: «alle gatelysene mangler merking» er én observasjon om hundre lyspunkt — en pin ville påstått at funnet gjelder ett sted. I dag skriver PDF-en «Ikke utfylt» der «gjelder alt» var ment; et tomt felt der noe var ment er en usann påstand.

**Levert (8 krav):**
- **Modell:** nytt nullable `lokasjonOmfang` ("punkt" | "byggeplass" | null) på `Checklist` + `Task` (migrering `20260904140000_lokasjon_omfang` — kun ADD COLUMN, ingen backfill, forhåndsgodkjent). Eksponert i `sjekkliste.opprett/oppdater` + `oppgave.opprett/oppdater` (omfang er låst etter godkjenning via `rørerLaastFelt`).
- **Visning (paritet web + PDF + mobil):** «Gjelder hele byggeplassen» i `LokasjonVelger` (web), `byggLokasjonsblokk` (PDF — skrives ALLTID ved byggeplass, aldri stille utelatt), mobil sjekkliste- + oppgave-detalj.
- **Krav 2:** «Gjelder hele byggeplassen» som ett-trykk-affordance i `LokasjonVelger` (passiv tilstand + modal), ingen obligatorisk bekreftelse.
- **Krav 3:** auto-åpning av tegning kun `status=draft` **OG** `lokasjonOmfang==null` **OG** ingen tegning fra før; synlig utvei (Avbryt), lukking lagrer ingenting. Nye lagringer setter `lokasjonOmfang="punkt"` → konsistent framover.
- **Krav 4 (paritetsfiks):** oppgavesiden fikk `showLocation`-gate (rendret før velgeren ubetinget — et hull). Ingen API-endring: `template` følger `oppgave.hentMedId`.
- **Krav 5 (L9):** sticky tegning i repeater-feltpin — tom rad forhåndsvelger sist brukte tegning i SAMME dokument (forrige rad → dokumentets tegning → ingen). **Kun tegning, aldri pin.** Kilden er dokument-avgrenset (ny prop `dokumentTegning`/`stickyTegning`), IKKE `byggeplass-kontekst.aktivTegning` (sesjonstilstand på tvers av dokumenter — svakheten Kenneth 04.09 ba om å rette). Atferden «rad 2 lander på rad 1s tegning» bevart.

**Målt avvik (rapportert):** oppgave har ingen arkiv-PDF ennå (`arkiv/render.ts` kaster) → PDF-visningen gjelder i praksis kun sjekkliste; oppgave-PDF arver regelen når den bygges. Web + mobil dekker oppgave.

**Begrepsrydding (lukker masterplan-restansen «tre ting heter lokasjon»):** dokumentlokasjon / lokasjonstekst / feltpin / lokasjonsbryter — se [terminologi.md](terminologi.md).

**Gate grønn (lokalt):** web build (typecheck+lint+next), api typecheck, mobil typecheck + lint 0 errors, pdf 97/97, shared 636/636, web 193/193 (inkl. tre navngitte repeater-regresjonstester + ny L9-test). **Leveringsvei:** web + server-PDF → prod-deploy; mobil-delen via OTA.

### ✅ Kø-robusthet — opplastingskøen frøs i stillhet i 18 min (`fix/mobil-batch-opplasting`, MERGET — branch ryddet)

**Avdekket av galleri-flervalg, men er en kø-robusthetssak, ikke en flervalg-sak.** Kenneth batchet 6 bilder i felt; de kom opp i sjekklista og til slutt på server — men det tok 18 min, og INGENTING sa at de var underveis. Målt årsak: `uploadAsync` hadde **ingen timeout**, så en hengende opplasting på tregt byggeplass-nett holdt `prosessererRef` true; 15s-sikkerhetsnettet er guardet på `!prosessererRef.current` og var dermed dødt. Bare reload (som nullstiller `laster_opp`→`venter` via `migreringer.ts:109` + fersk mount) løsnet den. Køen drenerte ikke av seg selv.

**Levert:**
- **Selv-drenering:** timeout (60s) på opplasting (`opplasting.ts`) + klassifisert feil (`OpplastingFeil` nett/hard). Nett/timeout/5xx retrier med backoff UTEN å telle mot `MAKS_FORSOK` (aldri permanent oppgitt på tregt nett); kun hard 4xx teller mot taket. Head-of-line-fri: per-oppføring backoff-kart, en feilende hopper bakover mens andre slipper fram.
- **B — ingen stille sletting:** «fil mangler» → `console.warn`, ikke `log`.
- **D — synlighet:** felt-badge «N vedlegg lastes opp» / «prøver fortsatt» (peker på hvilken rad), + persistent banner ved PDF/Send «kommer med når køen er ferdig». Køen eksponerer `feilendeVedleggIder` + `ventendePerDokument`.
- **A (hygiene, IKKE årsaken):** unikt lagringsnavn `IMG_<ts>_<id8>.jpg` mot filnavn-kollisjon i rask løkke.
- **C:** sekvensiell komprimering (dreper ~42-samtidige-native-kall-spiken) + per-bilde-isolasjon + catch + fremdrift.
- **E:** append-race herdet — `leggTilVedleggIRad` skilt ut til `@sitedoc/shared` (testbar der batch-veien ikke kunne testes før), RepeaterObjekt appender funksjonelt mot forrige state.

**Eget funn ført til BACKLOG:** `bilde.opprettFor*` er ikke idempotent (blind `image.create`, ingen `vedleggId`) → tapt-svar-retry gir duplikat `Image`-rad. Pre-eksisterende; krever DB-migrering + Kenneths godkjenning (med telling FØR unik constraint).

**Gate grønn:** shared 621/621 (inkl. batch-integrasjonstest på ekte `{_radId,felter}`-form), pdf, mobil typecheck + lint 0, web build.

### ✅ expo-updates — JS-fikser til telefonen uten nytt bygg (`e498bb14`, MERGET — **OTA I DRIFT fra 04.09**)

**Bakgrunn (målt):** 3. september kostet fem rene JavaScript-funn tre av ~15 månedlige iOS-bygg.
Ingen trengte en ny binær — bare en vei til telefonen (bygg 51 manglet en upushet fiks, preview-bygget
testet en fiks som aldri var merget). Ordre `relay/inbox-expo-updates.md`, gatet av cowork mot kode.

**Levert (`e498bb14`):** `expo-updates ~29.0.20` (SDK 54-matchet, via `expo install`) ·
`runtimeVersion: fingerprint`-policy (ikke `appVersion` — JS kan aldri lande på binær med annet native
lag) · `updates.fallbackToCacheTimeout: 0` + `checkAutomatically: ON_LOAD` (offline-first: starter alltid
fra cachet bundle, henter i bakgrunnen) · én kanal pr. `eas.json`-profil · `VersjonsFooter` viser kjørende
`Updates.updateId`. Datalaget urørt (bundler i egen katalog, ikke `documentDirectory`).

**Gate grønn:** web build · mobil typecheck · mobil lint (0 errors). Kenneth verifiserte fingerprint,
kanaler, offline-oppstart og updateId-visning mot kode 2026-09-03.

**Grensen som avgjør (fra `eas-build-veileder.md § OTA`):** alt som rører native laget (native modul,
`plugins`/`permissions`/`bundleIdentifier`/Info.plist, SDK-bump) krever nytt bygg. Kan OTA-es: ren
JS/TS, komponenter, logikk, styling, i18n. **Trer i kraft først ved ett nytt bygg pr. kanal** — bygg 51
kan ikke motta oppdateringer. Første `eas update` = Kenneths beslutning.

> ⚠️ **VEDTAKET OVER ER SNUDD 2026-09-04 — `fingerprint` er forkastet (`e59bd7e8`, merget `d9ce38c0`).**
> Teksten over står uendret med vilje: den som leser den først skal ikke bygge det forkastede.
>
> **`runtimeVersion` er nå den eksplisitte strengen `"1"`, ikke en policy.**
>
> **Hvorfor:** fingerprint-policyen kostet to feilede bygg (52 og 53) i «Configure expo-updates».
> Bygg 52: `@expo/fingerprint` kunne ikke resolves lokalt → plassholderen `file:fingerprint` (rettet i
> `3aca2d5a`). Bygg 53: begge sider regnet ekte avtrykk, men ulike, og EAS' diff-seksjon var **tom**.
>
> **Målt rotårsak** (`eas fingerprint:generate --json`, cowork 2026-09-04): **42 av 50 kilder i
> avtrykket er pnpm-stier med peer-avhengighetshash i katalognavnet**, f.eks.
> `node_modules/.pnpm/react-native-maps@1.20.1_…_lyl6n7iahbvyhr2rfdmu4zmbky/`. EAS kjører `pnpm install`
> i sitt eget miljø og får ikke identiske stier. **Ikke fiksbart i vår kode.** Kontrollmåling:
> avtrykket var identisk med og uten `apps/mobile/ios/` — det native prosjektet var ikke årsaken.
>
> 🔴 **Prisen, og den er reell:** setningen «fingerprinten endres og OTA-en leveres ikke» gjaldt et
> sikkerhetsnett vi ikke lenger har. Med fingerprint **nektet** EAS å levere til en binær med annet
> native-lag. Med fast streng **leverer** EAS oppdateringen — glemmer vi å bumpe, lander JS-en på en app
> den ikke passer til.
>
> **Derfor: `runtimeVersion` bumpes manuelt («1» → «2» …) ved enhver native-endring før bygg.**
> Sjekklisten med de åtte triggerne står i [eas-build-veileder.md § OTA](eas-build-veileder.md).
> `@expo/fingerprint` er beholdt som avhengighet — nyttig til diagnostikk, ikke lenger til policy.

### 🔴 PROD-FELLE lukket 31.08 (`73b30e71`) — tegningsposisjon-modalen kunne ikke lukkes

**Kenneth i felt på TestFlight-bygg 46 (`5605775d`):** *«eneste måten å komme ut av tegning →
avslutte og restarte appen»*. Rammet alle som åpnet et `drawing_position`-felt i en repeater
på iPhone med Dynamic Island — A.Markussen i produksjon.

**Mekanismen, målt på simulator (iPhone 16 Plus / iOS 18.4):** `useSafeAreaInsets()` gir
korrekt `top=59` inne i `<Modal presentationStyle="fullScreen">`, men `<SafeAreaView>`
anvender **0** padding der. Headeren rendret på y≈32–54, inne i det 59 px høye island-båndet.
`idb ui tap` på X-en ×3 lukket ikke; tap rett under båndet traff umiddelbart. Både «Lukk» og
«Bekreft» var utenfor rekkevidde.

🔴 **Cowork gjettet på tre mekanismer — alle tre var feil** (manglende provider · kontekst
krysser ikke modalen · insets er null). Målingen fant den fjerde. En fiks skrevet på
hypotesene ville bommet; runden var verdt kostnaden.

**Levert (`73b30e71`):** «Lukk» i bunnlinjen (utgang uavhengig av insets) · indre X lukker nå
hele modalen · `SafeAreaView` byttet mot `View` + `useSafeAreaInsets()`-padding ·
prod-debug-linjen `Bilde: WxH | Zoom: Nx` fjernet fra WebView-en · sju filer rettet fra
React Natives innebygde `SafeAreaView` til context-varianten.

**Datatap målt, ikke antatt:** en påbegynt repeater-rad **overlever** app-drap (autolagring
til SQLite, 2 s debounce i `useSjekklisteSkjema.ts:405-410`). Tapt går kun de siste ≤2
sekundene og et ubekreftet modalvalg. Ingen save-on-background finnes.

⚠️ **Cowork-gaten sendte første leveranse tilbake.** `dace662f` fjernet fella, men lot
«Bekreft» ligge i det døde båndet — brukeren kom seg ut, men kunne fortsatt ikke sette en
posisjon, som var Kenneths opprinnelige klage. Inset-fiksen kom i `20df827f`.

### 🔴 REGRESJON i samme bygg (47) — vi ødela fire skjermer mens vi fikset én

Kenneth testet bygg 47 og bekreftet at tegningsposisjonen virker: *«de nye plassene knappene
har fått i fiksen fungerer svært bra»*. **Men tekstfelt-modalen var nå ødelagt** — «Ferdig»
under Dynamic Island, vinduet låst.

**Årsak, målt:** importbyttet erstattet React Natives innebygde `SafeAreaView` med
context-varianten i sju filer. **Fire av dem er fullScreen-modaler**, der context-varianten
anvender 0 padding: `TekstfeltObjekt` · `InfoBildeObjekt` · `FeltDokumentasjon` ·
`OpprettDokumentModal`. De virket i bygg 46.

🔴 **Rotårsaken er coworks rekkefølge, ikke koden.** Importbyttet ble bestilt i **samme runde**
som fella — før simulator-målingen forelå. Ordren sa «mål hver fil»; det som ikke var målt
ennå var at komponenten svikter i en hel modal-klasse. **Mål først, bestill så** gjelder også
når endringen ser triviell ut.

**Kartlagt 2026-08-31:** 9 fullScreen-modaler rammet (4 av oss, 5 fra før) · 15 pageSheet
umålt · 1 fikset. 🔴 **`<Modal>` uten `presentationStyle` ER fullScreen på iOS** — derfor er
`TekstfeltObjekt.tsx:46` rammet uten å se sånn ut.

**Systemfiks bestilt** (Kenneth: *«ikke lapp sammen — lag en løsning som fungerer over alle
flater»*): delt `ModalFlate`-komponent + `no-restricted-imports`-lint som forbyr
`SafeAreaView` i `apps/mobile`. `relay/inbox-modalflate-systemfiks.md`.
pageSheet måles parallelt før de røres — `relay/inbox-simulator-pagesheet.md`.

### 🟢 TEST-DEPLOY 30.08 (`24bccbba`) — fire runder + REG fase 2-migreringen

Stempel verifisert: `curl https://api-test.sitedoc.no/version` → `24bccbba`. Migrering
`20260830120000_registrering_fase2_prosjekttilgang` applied på `sitedoc_test`; de tre andre
db-pakkene svarte «No pending».

🔴 **Migreringen ble nesten glemt — tredje gang samme feilklasse på tre dager.**
`deploy-test.sh` skrev ut `up -d --build` **uten migrate-steget**. Blokken er raskere å lime
enn den fulle sekvensen og fungerer ni av ti ganger, fordi det som regel ikke er noen
migrering. Denne gangen kjørte test ny kode mot gammelt skjema i noen minutter —
`organisasjon.hentMedlemmer` velger `prosjektTilgang`, som ikke fantes i `sitedoc_test`.

Tre kilder, samme feil, tre dager: `deploy-prod.sh` hadde migrate utkommentert (rettet
29.08) · `deploy-detaljer.md` sa «droppes når diffen ikke har migrering» (rettet 30.08) ·
`deploy-test.sh` skrev ut en blokk uten den (rettet 30.08). **Skriptet er kilden Kenneth
faktisk limer fra** — det skriver nå ut STEG 1 bygg → STEG 2 migrer (alle fire, med
`sitedoc_test`-gate) → STEG 3 start. Utskriften er verifisert byte-identisk med kommandoen
som virket.

### 🟢 Fire brancher merget til develop 30.08 — deployet til test (se over)

Merget i rekkefølge, alle disjunkte (verifisert med `merge-base`-diff, ingen delte filer):

| Branch | Hash | Merge | Innhold |
|---|---|---|---|
| `fix/emne-alltid-redigerbart` | `f074f903` | `7b1a87c8` | Emne redigerbart etter sending på oppgave |
| `fix/emne-sjekkliste` | `c18c01a5` | `14d8fcc7` | Samme regel på sjekkliste — Kenneth: *«øyeblikksbilde vs. levende dokument, det er jo det samme»* |
| `feat/reg-fase2` | `578e2b67` | `355c200c` | REG fase 2: `prosjektTilgang` per ansatt + `prosjektTilgangDefault` firmadefault |
| `fix/o12-eier-firma-lesevisning` | `0101bd25` | `964fdbfd` | **O12 — UI-duplikatet lukket.** `oppsett/firma` er ren lesevisning; Kenneth gatet i nettleser |
| `fix/faggruppe-slettevakt` | `fc817801` | `661682c5` | Faggruppe-sletting teller nå medlemmer + flyter. **Merget ETTER test-deployen `24bccbba`** — ikke på test |

**O12 i klartekst:** vedtaket ble tatt 2026-05-03 (`navigasjon-arkitektur-analyse`, linje 92)
og **halvveis utført samme dag** — renamet gjort, redigeringen stående. I fire måneder skrev
`oppsett/firma` og `firma/innstillinger` **samme rad med samme mutasjon**
(`organisasjon.oppdater`), der prosjektsiden manglet validering, i18n og en fungerende
gating på Rediger-knappen. Kenneth 30.08: *«vi kan aldri duplisere hverken UI eller kode.»*
Fila gikk 180 → 113 linjer; `organisasjon.oppdater` har 0 treff der nå.

🔴 **Cowork-gaten sendte den tilbake én gang, og det var riktig:** første leveranse hadde
`const harFirmaTilgang = !!organisasjon || erSitedocAdmin` **etter** den tidlige returen på
`!organisasjon` — altså konstant `true`. Oppførselen var riktig, konstruksjonen løy. Å levere
en falsk gate i nettopp den runden som ryddet et halvutført vedtak ville vært samme feil i ny
form. Nå er gaten den tidlige returen, og kommentaren sier det.

✅ **Faggruppe-duplikatet fra samme mai-analyse (linje 60–61) er allerede ryddet** — målt
30.08, `/dashbord/prosjekter/[id]/faggrupper` finnes ikke. Radene er merket i analysen.
`oppsett/firma` var dermed det eneste bekreftede UI-duplikatet vi hadde.

🔴 **REG fase 2 inneholder en migrering** (`20260830120000_registrering_fase2_prosjekttilgang`)
— ren additiv, `ADD COLUMN` på `organization_members` + `organization_settings`, ingen DROP,
ingen backfill. **Kjørt KUN lokalt.** Test og prod har den ikke. Neste deploy må kjøre
`migrate deploy` for alle fire db-pakker.

`modulNokler` ble tatt ut av fase 2 før commit — se [BACKLOG § 2 Modulmodellen](BACKLOG.md)
og [modulmodell-utredning-2026-08-30.md](modulmodell-utredning-2026-08-30.md).

**Cowork-gate på reg-fase2 (målt, ikke lest av rapport):** `modulNokler` har null levende
referanser i kode/schema/migrering/15 språkfiler · begge mutasjoner er `verifiserFirmaAdmin`-
gatet · `prosjektTilgang` evalueres ingen steder (fase 2-kravet holder) · alle 15 i18n-filer
har 14 forekomster, ingen henger etter.

**Falsk alarm som ble målt bort:** `git diff develop..branch` viste at alle tre «fjernet»
tavle-radene og DEPLOY-RYTME-blokken. Mot egen merge-base rørte alle tre **null** linjer i
`STATUS-AKTUELT.md` — de var bare bak på fila. 🔴 **`git diff develop..branch` svarer ikke på
«hva endret branchen».** Det gjør `git diff $(git merge-base develop branch)..branch`.

### 🟢 Oppgave-datalås + repeater ut av oppgavemaler (MERGET develop `f61eb64b`) — PÅ TEST, GATET 3/3

**Kenneth-funn på test 29.08:** han sendte en oppgave, fikk den i retur, og **endret et
utfylt tallfelt** (antall gravemaskiner 1 → 2). Skulle ikke være mulig.

**Rotårsak (kontrollplan):** `oppgave.oppdater` (`:635`) ER draft-only — men feltverdiene går
gjennom `oppgave.oppdaterData` (`:689`), som hadde **ingen statussjekk**. To dører, én vakt.
Kommentaren i `oppdater` lovet «kun tilføyelser er tillatt» — en regel ingen kode håndhevet.
🔴 **Fjerde forekomst av samme form på to dager** (prosjektisolering · lokasjonsgating ·
`forbedreOversettelse` · denne).

**Klient-rotårsaken var en annen og verre:** låsen `beregnLaasteFelter` VAR wiret og predikatet
var riktig — men lås-settet ble beregnet **én gang ved mount** (`useOppgaveSkjema.ts:95`) og
aldri på nytt etter refetch. Kenneths flyt (opprett → fyll → send → få i retur, alt med
dokumentet åpent) ga et lås-sett utledet fra tom utkast-data. Nå `useMemo`, reberegnes ved
status/data-endring. Bonus: utkast er igjen fullt redigerbart — den gamle låsen over-låste
utfylte utkast-felt ved reload.

**Vedtak B (Kenneths regi):** felt med verdi låses ved sending · tomme felt kan fylles av den
som har ballen · kommentarer og vedlegg går alltid. Domenet han formulerte:
*«en oppgave er en arbeidsordre — arbeideren fyller ut de tomme feltene når oppgaven er utført
og sender til godkjenning.»* Ført i
[domene-arbeidsflyt.md § Hva en oppgave ER](domene-arbeidsflyt.md). Alternativ A («redigerbar
som utkast kun») forkastet — det ville gjort oppgaven til en melding.

**Repeater ut av oppgavemaler** (`d2958b98`): `FeltPalett` skjuler `repeater` når
`category = "oppgave"`. Kenneth: *«en repeater tilhører ikke i oppgave.»* Begrunnelsen —
en repeater er N ting, en arbeidsordre er én; riktig modell finnes allerede motsatt vei
(`feat/oppgave-per-rad`: hver repeater-rad i en SJEKKLISTE får sin egen oppgave). **Formen er
«slutt å tilby», ikke «riv ut»** — eksisterende objekter rendres som før, ingen migrering.
Målt: 0 oppgavemaler med repeater på test, 4 i prod (alle Kenneths egne testdokumenter,
bekreftet av ham).

**Kenneths gate på test 29.08 — 3/3 grønt:** utfylt felt låst etter retur, tomt felt fyllbart,
kommentar og vedlegg går på begge · repeater borte fra oppgavemaler, til stede i sjekklistemaler ·
utkast fullt redigerbart.

**Meldt, ikke bygget:** mobil `useOppgaveSkjema` har trolig samme mount-staleness
(server-vakten dekker den) · quiz/video/info_image/signature kan være meningsløse i oppgave —
hver fjerning er et produktvedtak.


### 🟢 Emne på oppgave + onboarding-delstatus (`fix/oppgave-emne` + `feat/prosjektoppsett-veileder`, MERGET develop) — PÅ TEST

**Funn 1 fra Kenneths gate 29.08 løst** (`ff485478`): `EmneVelger` rendres nå på
oppgave-detaljsiden, gjenbrukt uendret fra sjekklisten. `leseModus = status !== "draft"` —
speiler `oppgave.oppdater` (`oppgave.ts:670`), som er **strengere enn sjekklistens vakt** og
avviser ALL redigering utenfor `draft`. **Cowork-vedtak samme runde:** LokasjonVelger-gatingen
på samme side rettet fra `["closed","approved"]` til `status !== "draft"` — den ga stille
server-avvisning i `sent`. To felt side om side oppfører seg nå likt. Ingen nye i18n.
Sjekklistens gating urørt.

**ON onboarding** (`214bae7f`): `harTegning` i `hentOnboardingStatus` + delstatus på
lokasjonssteget («Lokasjon ✓ · Tegning mangler»). Flagget `harLokasjon` var `byggeplass.count`
og ble grønt uten en eneste tegning.

🔴 **Målt av dokgen før bygging — ordren var delvis foreldet:** selve onboarding-panelet var
**allerede bygget** (`[prosjektId]/page.tsx:119-198`, fire steg + modul-steg, DB-avledet,
skjules når alt er oppfylt), og UX-problem 1 (faggrupper read-only) var løst — siden er full
CRUD og lenket fra dashbord-kortet. ⚠️ **Coworks gate 28.08 verifiserte hullet i
`prosjekt.opprett` men sjekket aldri om konsumenten fantes.** `hentOnboardingStatus` er
navngitt etter sin bruker; ett grep ville avslørt det. Ført i masterplanen.

**UX3** (blyant ved redigerbare navn i flytoppsettet) **utsatt** — den flaten er parkert til
faggruppe/kontakter-avklaringen er gjort (`domene-arbeidsflyt.md`).

⚠️ **GJENSTÅR — selve leveransen er ikke gjennomført:** Kenneth skal opprette et tomt prosjekt
og komme fram til sendt sjekkliste **kun via panelets lenker**. Panelet fantes fra før; det
ingen vet er om veien går. Kjøres på test.


### 🟢 FASTE FELT — emne-skrivevei, lokasjonsmodell, faggruppe-fjerning (`feat/faste-felt`, MERGET develop `30260f88`) — PÅ TEST, gatet med funn

Fabels ordre, cowork-gatet (Del D var alt bygget; `ReportTemplate.subjects` og `Task.subject`
fantes alt — sparte tre runder). **Emne:** `EmneVelger` på sjekkliste-detalj (chip + Endre,
`<datalist>` fra malens `subjects`), emnefelt i oppgave-modalen, fritekstsøk inkluderer
`subject`. 🔴 **Avvik A2, fabel-ratifisert FØR koding:** mockupen forutsatte en opprett-modal
for sjekkliste — den finnes ikke (`OpprettMalVelger.tsx:212` oppretter ved klikk). Emne settes
derfor kun på detaljsiden for sjekkliste. **Lokasjon:** to tilstander («+ Legg til lokasjon» /
aktivert m/Endre-Fjern), `showLocation` gater rendringen (var ubetinget), PDF skriver
byggeplass-linja alltid + emne som første datafelt. **Malbygger:** faggruppe-raden fjernet,
radtekster rettet. **Statusvakt:** `subject` inn i den eksisterende `approved`/`closed`-vakten.

**Kenneths gate på test 29.08 — fire funn, alle rutet:** oppgave-detaljsiden mangler
emne-chippen (→ `relay/inbox-oppgave-emne.md`) · duplisert lokasjonsvelger, modal vs. navigering
til Tegninger (→ fabel) · barn-labels usynlige i utfylling (kjent D8/D9, venter malrydding) ·
flytboksene kollapset (se under).

### 🟢 Stegvisning i flytoppsettet (`feat/flytboks-stegvisning`, MERGET develop `16c20a9e`) — PÅ TEST, LOKALT GATET FØRST

**Kenneth-vedtak: verifisert lokalt før test** — første gang i dag. Oppsettet sorterte boksene på
**rollerangering** (`dokumentflyt/page.tsx:475`), dokumentet på `steg`. Å nummerere den gamle
sorteringen ville satt tall på feil rekkefølge. Nå sorteres og nummereres begge flater på `steg`.
Sammendragslinja følger samme rekkefølge. Kun `page.tsx`, +41/−3, ingen datamodell.

⚠️ **Kjent grense, skrevet i commit-meldingen:** oppsettet har én boks per **rolle**, dokumentet
én per **posisjon**. En rolle på flere steg (rundtur — «Endringsmelding» har Godkjenner på steg 1
OG 4) vises på sitt tidligste steg (`min`). Kenneth-vedtak: behold `min`, den ærlige fiksen hører
til `steg={1}`-runden.

🔴 **Lokal verifisering kostet en halv økt fordi miljøet var råttent, ikke metoden.** Lokal DB var
fire måneder bak: `organization_members.status` manglet → 500 på alt som slår opp org-medlemskap,
mens resten svarte 200. `prisma migrate deploy` tok ikke igjen etterslepet — den stoppet på
`mal_integritet` (unik navne-indeks mot fem identiske PSI-maler fra april-seeden) og lot DB stå i
failed-migration-tilstand. Løst med frisk test-dump (`lokal-dev.md § 3`). **Lærdommene ført i
[lokal-dev.md](lokal-dev.md)**: dumpen er veien, ikke migrate deploy · dev-serveren må stoppes før
`dropdb` · regenerering av Prisma-klienten avdekker slik drift i stedet for å skjule den.

**Målt underveis, til fabels F1:** «Tømrer -> HE» var IKKE divergenstilfellet cowork antok —
dens steg er monotone med rangeringen. Beviset kom fra «Endringsmelding», der Godkjenner står på
plass 2 og rangering ville satt den sist.


### 🟢 KP-lokasjon — isolering, arv av tegning, statuslås (`fix/kp-lokasjon`, MERGET develop `b987d793`) — PÅ TEST, GATET 4/4

Fire runder, kontrollplan. **Utløser:** måling av AM-3-fiksen (`180e9c61`) avdekket fire hull.
**(1) Prosjektisolering:** `sjekkliste.oppdater` skrev `input.drawingId` til både `Checklist` og
koblet `KontrollplanPunkt` uten tegnings-oppslag — målt åpen og nåbar. Søsterprosedyren
`settPunktPlassering` hadde vakten. Ny delt `verifiserTegningIProsjekt` i
`services/kontrollplanKobling.ts`, kalt fra begge dører (ingen kopiert if-blokk).
**(2) Arv ved Start:** `koblePunktTilSjekkliste` kopierer nå punktets `drawingId` + byggeplass ved
`kilde:"startet"` — **aldri pin**. Kenneth-vedtak: *«hver sjekkliste må få sin egen plassering»* ·
punktet er planleggerens omtrentlige plassering, sjekklisten dokumenterer faktisk utførelse.
Utfører kan bytte tegning som bevisst valg. **(3) Statuslås:** `approved`/`closed` var låst KUN
klient-side; byggeplass-chippen var ugatet og skrev `drawingId: null` på godkjente dokumenter.
Kenneth-vedtak (alternativ 1): byggeplass er del av det dokumentet påstår → serverside-vakt på
`drawingId`/`positionX`/`positionY`/`byggeplassId` + deaktivert chip. Retting går via gjenåpning,
som gir spor. **(4) `?? null`** i speil-blokken erstattet med «utelatt = behold», likt
`Checklist.update`. **(5) Mobil-tapp** på punkt uten sjekkliste gir nå `Alert` i stedet for stille
`return`. 🔴 **Repeater urørt** (Kenneths «ikke rør») — ingen av de sju bærende filene rørt,
regresjonstester 5/5, Kenneth bekreftet uendret på test.

**i18n-lærdom ført til [shared-pakker.md § i18n](shared-pakker.md):** generatoren hopper over
nøkler som finnes og oppdager IKKE at kildestrengen er endret. «Site» ga tysk «Website»; retting
til husets «Building site» slo først gjennom da nøkkelen ble slettet fra de 13 og regenerert
(`fab6deb0` → de «Baustelle», fr «chantier», sv «Byggplatsen»).

**Kenneths gate på test 29.08, 4/4:** godkjent sjekkliste → chip død m/forklaring · utkast → chip
virker · Start fra plassert punkt → LOKASJON «900512 Røstbakken · Z-20-01» uten pin · repeater
uendret. **Ingen migrering. Ingen prod.** Reload (mobil): JS-bundle.

⚠️ **Funn under gaten, egen sak:** klikk på et IKKE-startet kontrollpunkt på tegningen sender
brukeren til kontrollplan-oversikten uten å si hvilket punkt han kom fra
(`tegninger/page.tsx:980-986`, fallback fra `180e9c61`). Kenneth mistet oversikten over hvilken
sjekkliste han skulle fylle ut.


### 🟢 ANSVARLIG-kolonnen navnga feil faggruppe på utkast (`fix/ansvarlig-kolonne`, MERGET develop `12e34ceb`) — PÅ TEST, venter Kenneths gate

Kenneth-funn (prod): sjekklistelista viste faggruppenavn i ANSVARLIG på utkast. `formaterAnsvarlig` (sjekklister/page.tsx + IDENTISK i oppgaver/page.tsx) falt tilbake på `utforerFaggruppe.name` når dokumentet ikke var sendt — en faggruppe som ennå ikke hadde fått ansvar (utkast har verken `recipientUser` eller `recipientGroup`). Kenneth-vedtak: ansvarlig = den/de i flyten som skal svare ut dokumentet; **utkast → oppretteren** (`rad.bestiller?.name`), **ellers ingen mottaker → tom** («—» i cella). Ledd 1–2 (mottaker-person/-gruppe) beholdt. Fikset begge sider: funksjonen returnerer **tom streng** (ikke «—») så filterbyggingen (`bygg()` → Boolean-filter) ikke får en «—»-oppføring — cella rendrer «—», samme mønster som `opprettetAv`. Filter- OG sorteringsveien treffer `formaterAnsvarlig` begge steder → dekket. **Måling (mål-før-utvid):** den buggede fallbacken finnes KUN i disse to filene; HMS-flatene (`HmsFlytStripe`/`HmsFlytKort`/`flyt-ledd`) bruker «ansvarlig» i en annen, korrekt betydning (HMS-behandler/`erHovedansvarlig`) — ikke rørt. Ingen nye i18n-nøkler. Grønt: typecheck web, `pnpm test` 189/189. **Ingen prod.** Reload: n/a (web).

### ✅ ARKIVERT — prod-deploy 2026-08-28 (`ba234fd1`, 26 commits) → [historikk-2026-08.md](historikk-2026-08.md)

Registreringsmodell fase 1 (ansatt-status-guard i 11 porter), ansattvelger + delt `services/ansatt.ts`, fundament ut av gruppemodul, tre slettevakter, deaktivert bruker på dyplenke, død kode (`@xenova`). Verifisert innlogget 28.08. Migrering `20260828120000_organization_member_status` kjørt; `db-timer`/`db-maskin`/`db-varelager` sjekket — ingen ventende.

### ✅ ARKIVERT — fjorten spor som lå som «venter gate», men var i prod → [historikk-2026-08.md](historikk-2026-08.md)

Målt mot git 2026-08-28: `git branch -r --no-merged origin/develop` ga **kun `origin/main`**
— ingen branch ventet på merge. Alle fjorten er forfedre av `origin/main`. Prosjektfilter ·
fase 4-oppfølger · DG-sporet (seks merger) · F1 endringslogg · startbar kontrollplan · fem
spor `d4e0d8f1` · arkivmal stage 4 · repeater-markør · oppgave-per-rad · oppgave-arver-flyt ·
slettevern · slett-adminvakt · config-adminvakt · oppgave/flyt-bunt A–G · DG D2 ·
kontekstvelger 1a. Fulltekst per spor i historikken.

### 🔴 Åpne gater og restanser høstet ut av de arkiverte innslagene

Disse fulgte med innslagene over og ville forsvunnet i arkiveringen. Ingen av dem er kode
som venter på merge — alt er i prod. Det som står igjen er **gater ingen tok**, og
**arbeid som aldri ble startet**.

**Gikk i prod uten gaten som var skrevet:**
- **Dataeksport fase 1+2** — fire verifiseringspunkter sto som «gjenstår før prod»
  (bestill→zip→manifest, `activity_log` m/ip+user-agent, lagringsflatene, innlogget
  bilde-lasting). Deployen skjedde uten dem. **Fase 1 rører filserving** — punkt 4 er den
  som betyr noe.
- **Kontekstvelger 1a** — ventet fabels skjermbilde-designgate + Kenneths D7-bekreftelse
  («premiss enkeltmålt»). Begge står ubesvart, koden er live.
- **Arkivmal stage 4** — fabel-skjermbilde-gate etter test-redeploy, aldri kjørt.

**Venter Kenneth:**
- **Bildeblokken i DG-radkortet** får egen «BILDER»-etikett i feltetikett-stil og leses som
  et femte felt. Anbefalt: innrykk + eierreferanse («Bilder — Posisjon i tegning»).
- **`onDelete: Restrict` som DB-backstop** på dokumentflyt (slettevakten er kun i appen).
  Migrering; må tåle den ene flyt-løse raden.
- **«Oppretter-entreprise»-feltet** — mål om det er et malfelt av type `company`. Er det
  det, fjernes feltet i stedet for at det bygges logikk rundt det.
- **Forkorting av lange tekster i endringsloggen** — anbefaling avventer, ikke bygget.

**Venter fabel:**
- **Mockupsiden «Repeater F7» finnes ikke** — null treff i `arkivmal-pdf-mockup/`. Blokken
  er bygget mot ordrens skriftlige spec. Fabel skylder mockupen eller en bekreftelse på at
  spec-en er fasit.

- **Runtime-verifisering på test** av append-only-fiksen og fase M-3a del 2 (skjermbilder,
  funksjonell) — begge sto som utestående og gikk til prod uten den.
- **Pre-eksisterende TS2589** i `sjekklister/[sjekklisteId]/page.tsx:117` — finnes på ren
  develop, feiler ikke `next build`, men står urørt siden juli.

**Ikke startet:**
- **DG funn 6** — tilbehør-fjerning på `drawing_position`, `location`, repeater-radnivå og
  `date`/`date_time`. Migreringsmålt i prod: kun repeater har data (4 kommentarer + 4
  vedlegg av 13 felt), de tre andre er tomme → ren fjerning.
- **Kontrollplan leveranse 2 + 3** — tegningspunkter + passiv fargevarsling, så aktiv
  scheduler-varsling.
- **Ord-nivå diff i web-endringsloggen** (`fix/endringslogg-web`) — holdes bevisst til
  app-runden.
- **`feat/kontrollplan-revisjon` del 1** — lokal hos en avsluttet Opus, aldri pushet.
  🔴 Verifiser at den finnes før noen planlegger på den.

⚠️ **Verifiseringsgrunnlaget for F7 er borte** — BEF-001, BEF-002 og BHO-002 er slettet.
DoD-en peker nå på et nytt kontrolldokument på dagens mal; bygges malen først, dekker samme
runde både funn 6 og F7s skjermbevis.

**Vedtak som må overleve arkiveringen:** H6 er **revidert, ikke reversert** — «Godkjent er
stoppsted i FLYTEN; Lukk er administrativ exit». Slettevakten er `draft || closed`,
`cancelled` er død status (0 rader i prod), Lukk er kun admin i begge lag.

### ✅ ARKIVERT — printmotor fase 3 + 4 → [historikk-2026-08.md](historikk-2026-08.md)

Sto som «PÅ TEST / Ingen prod». **Målt 2026-08-28: `eddc118b` og `17fd66f6` er begge
forfedre av `5dcdeb58`** — de har vært i prod siden 06:23 den 28.08. `db-timer`-migreringen
`20260827120000_eksport_oppsett` er også kjørt (målt: ingen ventende i noen av de tre
modulpakkene). ⚠️ **Én rest er reell og flyttet til [BACKLOG](BACKLOG.md):** `landscape`-
parameteren er i koden, men pdf-render-containeren er ikke bygget — liggende
Fakturagrunnlag virker ikke ennå. Buntes med `page.route`-fiksen i ett gatet steg.

### ✅✅ ARKIVERT — august-deployene (03.08–06.08) → [historikk-2026-08.md](historikk-2026-08.md)

Fem prod-deployer arkivert med commit-refs, migreringer og verifisering: flytmodellen komplett + effektivitets-runden + mobil M1–M3 (`8b068c73` 03.08) · Funn A + Funn C (`0ac25705` 04.08) · Funn D + opprettvelger v2 + Spor 1 + kontaktside (`5bf25f83` 05.08) · Ordre 1.4 auto-hopp (`8a2f6d9c` 05.08) · Spor 2 HMS komplett (`70d2b752` 06.08).

> ✅ **Mobil-forbehold LØST 2026-08-09:** EAS-bygg **44** er fyrt og levert TestFlight. Mobil detalj-redesign M1–M3 + hele bunt 44 er nå hos testerne. Kenneths fysiske re-test gjenstår. (Bygg 43 ble bygget 08.08 men **aldri sluppet til testere** — 44 erstatter det.)

**Restanser etter deployene (åpne oppfølgere, ikke deprioritert backlog):**

- **Flytmodell:** Playwright pilot-e2e-spec (`feat/flytmodell-5b-uie2e`, remote-rigg) · trekk-tilbake-status-semantikk (fabel, parkert) · bøtte 4 = byggeplass-kontekst arves ikke ved opprett (pilot-funn #2/#3 → fabels kontekst-fra-innlogging-spor).
- **Statusmaskin:** F6-oppfølger (`received→approved` som default) · posisjonsutredning (H1/N-boks, `steg`-feltet finnes) · registrator-steg-1-validering · H2 (utførers venstre-send/tilbake-kant) · besvar=venstre-modellspenningen · § 0 delt-kilde-konsolidering (egen fase).
- **Effektivitet:** **P4c timer** (7→1-2 klikk, arver chip-komponenten) — ikke startet. Øvrige restanser i [BACKLOG](BACKLOG.md).
- **Mobil M1–M3:** #2 inline-kommentar-inngang · #7b liste-filter · #4 bekreft-på-send-vurdering · #5 testdata-flyt m/distinkte personer per ledd.
### ✅✅ ARKIVERT — prod-deploy 2026-08-10 (`7f838d80`, 33 commits) → [historikk-2026-08.md](historikk-2026-08.md)

Bunt 44 (mobil, via EAS 44) + web/api-siden + utlegg U3 + firma-admin prosjektopprett + mal-admin-gate + seed-verktøy + firmarolle-vakt Fase 1. Migrering `sheet_machine_timer_id` kjørt på prod. **A.Markussen fikk sine 5 utleggskategorier** — lønnsart 25/19 verifisert uendret.

<details><summary>Detaljer bunt 44 (mobil) — beholdt for sporing mot TestFlight-tilbakemelding</summary>



**Første mobilleveranse til felt siden EAS #40 (15.07).** Alt under er merget til `develop`, i bygg 44 og på TestFlight. **Ikke prod-deployet** (web/api-siden av HMS + utlegg U1 gikk prod `e37621e1` 08.08 — se historikk). Enhetsverifisert av simulator-Opus i tre runder; bevis i `relay/mobilverify-bevis/`.

**Kilder:** Kenneths enhetstest 08.08 (prosjekt 998 Instinniforbotn) → fabels ordre `docs/claude/delplaner/ORDRE-mobil-devicefunn-2026-08-08.md` (Del A–D) + `FABEL-SVAR-cowork-blokk2-mobil-device.md` (A1/B1/B2-godkjenning) + simulator-Opus' egne funn.

| Sak | Innhold | Verifisert |
|---|---|---|
| **fabel Del A** — tegnings-navigasjon | Trykk på tegningsrad åpner tegningen direkte (var: `router.push("/lokasjoner")` uten id → 2+ ekstra trykk). Delt `aapneTegning`-helper + nonce (`ts`) fordi `lokasjoner` er en montert tab-skjerm. «Fortsett der du slapp»-snarvei gjenbruker **eksisterende F1** (`ByggeplassKontekst.settSistTegning`, bygget men aldri wiret) framfor ny SQLite-tabell. Guard via `hentMedId` → slettet/feil prosjekt gir velger-fallback, aldri krasj | ✅ 1-trykk · snarvei etter kald-restart · offline · ugyldig-id-guard · nonce begge veier |
| **fabel Del B pkt 1** — maskin ved redigering | Maskin kunne kun føres ved NY timer-rad ⇒ **auto-utfylt dag ga ingen vei til å føre maskin**. Nå: maskin-seksjon også ved redigering (drop `!eksisterendeRad`-gaten), prefill fra koblet rad. **Additiv nullable `sheetTimerId`** på `SheetMachine` + `sheet_machine_local` (migrering `20260808130000`, svak String-FK, ingen backfill) — bøtte-match på fire felt avvist: integritet i skjemaet, ikke i logikk som kan glemmes. Null-rader har kodekommentar som forklarer hvorfor null er lovlig (stopper framtidig heuristisk backfill) | ✅ ≤2 trykk fra rad · re-rediger gir ÉN maskinrad · sync round-trip · oppgradering over eksisterende lokal data |
| **fabel Del B pkt 2+3** — cache + banner | `refreshMaskinKatalog` fanget pull-feil (`.catch(() => [])`) → destruktiv `delete` med tom liste ⇒ cachen tømte seg selv ved nettglipp, og bare re-login fylte den. Fjernet catchen (symmetri med `refreshKatalog`). Banner «Herav maskin 0.00t» skjules ved maskin = 0 | ✅ cache bevart etter framprovosert pull-feil, uten re-login |
| **Katalog-cache systemisk (funn #3)** | Simulator-Opus sporet rå UUID-er i dagsseddel-raden til **samme bug i fem tjenester til** — `prosjekt`/`byggeplass`/`kalender`/`oppmotested`/`reisetidMatrise` + `timerKatalog`-ECO. Én offline kaldstart tømte samtlige. Alle seks nå symmetriske; `organizationSetting` bevarte allerede (tidlig-retur). ECO-catchen fjernet etter at begrunnelsen ble **verifisert moot** (`krevBrukersOrg` kaster FORBIDDEN på lonnsart før ECO spørres) | ✅ offline kaldstart → navn står, 0 UUID-er · byggeplass-velger ikke tom |
| **fabel Del C + D** | Hjem-innboks maks 3 inline + «Se alle (N)»/«Vis færre» **inline-ekspansjon** (fabels `/boks`-destinasjon avvist — innboksen er sjekklister+oppgaver, `boks.tsx` er mappevisning; ingen samlet skjerm finnes). Byggeplass-velger markerer «· arves fra dagskortet» | ✅ ≤3-grenen live · D live |
| **HMS-listefunn A/B/C** | `slett`/`hmsSendInn`-onSuccess invaliderer nå `hms.hentDokumenter` (lista hang til refresh) · Forkast-dialog bruker `hms.forkast.*` («legges i papirkurven, 90 dager») i stedet for generisk Slett · låst felt viser «—» | ✅ alle tre stier live |
| **Funn #1 + #2** | `TekstfeltObjekt` (delt `text_field`, ALLE sjekkliste-/oppgaveskjemaer) viser «—» i leseModus · «Ingen byggeplass»-valg i sedel-velger, gatet bak `tillatIngen` så global `ByggeplassChip` er upåvirket | ✅ render-verifisert · ✅ live |

**Til bygg 45 (notert, ikke skjult):** Require cycle `TimerSeksjon ↔ MaskinSeksjon ↔ SplittRadModal` (ikke-fatal dev-warning, men undefined-risiko ved endret import-rekkefølge) · A3 tom equipment-cache kun kode-verifisert (tilstanden er vanskeligere å nå etter cache-fiksen) · B3 legitim-tom kun strukturelt bevart (suksess-stien urørt av fiksen) · tegningsbildets render bekreftes først på TestFlight (bilde-host unåbar over SSH-tunnel; bilde-stien er urørt i diffen).

</details>

### ✅ ARKIVERT — HMS 5a+5b + utlegg U1 → [historikk-2026-08.md](historikk-2026-08.md)

Begge prod-deployet `e37621e1` (08.08 kveld) og arkivert med mekanikk, asymmetri-tabell og verifisering. **Utlegg U3 web-registrering — MERGET develop (`aa111b45`), på test.** Mockup 8a+8b. API: `timer.expenseCategory.list` (utledet ordning + kilde per prosjekt) · `dagsseddel.tilfoy/oppdater/fjernUtleggRad` (`ordningVedFoering` stemplet ved insert, `sats` avvist — bæres av `SheetTillegg`) · `*UtleggVedlegg`; `hentMedId` returnerer `utlegg[]`. Web: `LeggTilVelger` (én inngang, to grupper, ordnings-pille som undertekst — aldri et valg), `UtleggRadDialog` (tre radformer + kilde-linje), `RaderUtlegg`. **Tillegg-flyten (sats) er urørt** — samme mutasjon/validering/lagring. **CHECK-constrainten er runtime-bevist på `sitedoc_test` 09.08:** fakturert+beløp avvist · fakturert+NULL godtatt · utlegg+NULL avvist · utlegg+beløp godtatt (alt rullet tilbake). ⚠️ **Før U5** står alle kategorier på `ordning='utlegg'` → flaten viser kun utlegg-formen på ekte data; `fakturert`/`sats` verifiseres via manuelt satt ordning. Navngitte oppfølgere: bro `ExpenseCategory`→lønnsart · utlegg i attesterings-redigering (arbeider-sti-only asymmetri).

**Utlegg gjenstår:** U2 eksport-guard (utsatt — ingen Proadm-eksportmotor i kode) · E2E-verifisering av U3 · U4 mobil · U5 firma-admin overstyring-UI (**firma-admin setter ordning per kategori; default `utlegg`; må advare ved navnekollisjon mellom `Tillegg` og `ExpenseCategory`**) · U6 migrering av feilførte rader (egen gate). **HMS gjenstår:** SJA-Returner + flyt-stripe på web · dedikert mobil-HMS-behandling.
### ✅ ARKIVERT — append-only-fiks + fase M-3a del 2 → [historikk-2026-08.md](historikk-2026-08.md)

Begge sto som «venter merge». Målt 2026-08-28: `87dc15db` og `2f014f6e` er begge forfedre av
`origin/main` — de har vært i prod siden juli. Restansene deres lå allerede i BACKLOG.

### 🎨 Redesign navigasjon (branch `redesign/navigasjon`, bak `nyNavigasjon`-flagg — av-default, inert i prod)

**Aktiv front — steg viii (kunderunde mot prod-kopi) + pilot.** Infra reist + runbook komplett (2026-07-08); venter kunde-booking + Kenneth-drift: opprett demo-prosjekt m/ `oversettelse`-modul, kjør pre-flight-SQL, last opp SDS. Deretter pilot (flagg → `company_admin`).

Egen Docker-stack `docker-compose.redesign.yml` (web 3500 / api 3501), DB `sitedoc_redesign` (prod-kopi). Runbook + env/secrets/demo-strategi: [steg-viii-kunderunde.md](../redesign/steg-viii-kunderunde.md). Dev-login IKKE aktiv på redesign (verifisert 2026-07-09; se [dev-login-agent.md](dev-login-agent.md)). Full paritet + T/G: [redesign-paritetssjekkliste.md](redesign-paritetssjekkliste.md).

**🔴 Blokker før steg viii:** OAuth-redesign gjenbruker prods apper m/ to ekstra redirect-URIer — skal reverseres (egne app-registreringer + fjern URIene fra prod-appene). Kilde: [BACKLOG § OAuth: redesign holder prods nøkler](BACKLOG.md).

**Fullført kode — alt på prod + arkivert (ingen status-/designgodkjenning-kopi her, statuskilde-regelen):**
- Steg ii–vii + K9 URL-kanonisering + K6/P31 Kontakter — prod flagg-inert `0be103fa` (2026-07-07) → [historikk-2026-07.md](historikk-2026-07.md) § Redesign steg ii–vi.
- K13 full søkedekning + restanse-runde (P-a/kildeflagg/FM5/T9) + Plan 2 bruker-lagret flagg — prod flagg-inert (`ffc703df`/`0d3f21ac`, migrering `20260707120000_user_ny_navigasjon`). Presedens `?nyNav`-URL > konto > lokal > env > av i delt `resolverNyNavigasjon` (@sitedoc/shared). Statuskilde K13: designprosjekt «Sitedoc redesign tips» → `verifisering/K13-verifiseringslogg.md`. Detaljer: [k13-sokdekning-rapport.md](k13-sokdekning-rapport.md).
- Finnbarhets-revisjon (søkemotor `sok-match.ts` + begrepsfikser + byggeplasser-kort) — prod `43299d03` (2026-07-15), flagg-inert unntatt `nav.sok`/`nav.kontrollplan`-labels (se PROD-LIVE-merknad øverst) → [historikk-2026-07.md](historikk-2026-07.md).
- Delt `OppsettSidemeny` + sidebar aktiv-seksjon-fix + 🔴 per-rad geofence-indikator (LIVE, ikke bak flagg) — prod `e5859440` (2026-07-15, runde 2) → [historikk-2026-07.md](historikk-2026-07.md).
- Georeferanse-panel v2 + Kartverket-adressesøk (G2), i18n 13 språk `a2a8d5c7` — prod `387d10a2` (2026-07-15, runde 3). Statuskilde: designprosjekt «Sitedoc redesign tips» → `verifisering/georef-panel-verifiseringslogg.md`. Prod-runde: [historikk-2026-07.md](historikk-2026-07.md).

**Åpne oppfølgere (sporet annet sted):** redesign-mobil-restanser + steg vii/2c-leser-funn → [BACKLOG § Redesign-mobil](BACKLOG.md) + [§ Redesign steg vii/2c](BACKLOG.md); GPS-felttest av geofence → [BACKLOG § GPS-felttest](BACKLOG.md); MS-login mobil lokal dev-placeholder → BACKLOG.

### ✅ ARKIVERT — juli-deployene (del 6 timeføring, F2/F3/F5, F-b/F-e/F-f/F-g, `hentEndringerSiden` fiks B) → [historikk-2026-07.md](historikk-2026-07.md)

Alle fire deployet prod 13.–15.07 (`f888fecc`, `43299d03`) + EAS #38/#40. Full detalj flyttet dit 2026-08-20.

### PSI Fase A + Maskin + ③ + timer-paritet — mobil-restanser (web/DB i prod, mobil venter EAS)

Web + DB-migreringer i prod (`80974276`/`0be103fa`); timer-paritet + pause-regler + overlapp/gjenåpne-vakt + nyNav sticky-flag i prod (`224c13f6`, 2026-07-09 → arkivert til [historikk-2026-07.md](historikk-2026-07.md)). **Gjenstår kun mobil-delene**, alle via neste **EAS-batch** (gjeld sporet i BACKLOG, ikke tapt):
- PSI `MannskapInnsjekkKort` inn/ut + dagsseddel-registrering + maskin/③-mobil.
- Timer-paritet mobil: bolk (e) B1–B4, bolk (f) gjenåpne-bekreftelse + `PRECONDITION_FAILED`-mapping, bolk (g) prefill-scope/`fra<til`/0==0 — [BACKLOG § Timer web-vs-mobil paritet](BACKLOG.md).
- maskin-vs-maskin-overlapp, `sedel.pauseMin`-avklaring, dagsnorm-varsel-vs-B2, midnatt-wrap-bug, Piece 2 (1b auto-utkast fra/til), maskin-`fra<til` på synk (SYNC-2-funn) — alle i BACKLOG. (`pauseBeregning.ts`-mobil-dedup ✅ M2.)

**Bolk (h) — mobil offline-synk-blokkere (rekkefølge SYNC-1 → SYNC-2 → M2–M7, én commit per steg, alle utsatt til EAS #38):**

> **Verifiseringsnivå (oppdatert 2026-07-10 — Fase 4):** SYNC-1, SYNC-2, M2, M3, M4, M5, M6, M7 statisk verifisert (typecheck/vitest/web-build/objekt-lesing) **+ bolk-(h)-kjernen nå enhets-verifisert** på simulator mot api-test (SSH-tunnel). **Fase 4-resultat:** punkt **1–6 ✅ runtime** (B3/auto-synk 11:00+3→14:30, hele-sedel-prefill, overlapp-speiling, B2-sperre, maskin B1–B3, SYNC-1 offline-avvisning rødt banner). Punkt **7–8 (M4 gjenåpne-koder + M7 Alert) BLOKKERT** av to attestering-bugger funnet under testen: rader forsvinner på mobil etter attestering (🔴 mulig SYNC-2-regresjon) + attestert-sedel-deadlock (🔴 retur-knapp forsvinner ved `accepted`). **Begge er #38-blokkere** til avklart. Se [BACKLOG § Timer web-vs-mobil paritet → Fase 4 simulator-funn](BACKLOG.md).
- **✅ SYNC-1 (develop 2026-07-10):** `syncBatch.ResultatRad` utvidet med `"avvist"` (permanent avvisning: P2002, katalog-mismatch, maskin>arbeid, FORBIDDEN) skilt fra transient `"feilet"`. Mobil gjør `avvist` terminal (forlater pending → retry stopper) med rødt banner i `timer/[id].tsx` + `TimerSyncStatusBar`. Ny lokal `syncStatus="avvist"` (TS-enum, ingen SQLite-migrering). Bakoverkompat: #37 faller til else på `avvist` → beholder pending (dagens oppførsel). Se [BACKLOG § Timer web-vs-mobil paritet → SYNC-1](BACKLOG.md).
- **✅ SYNC-2 (develop 2026-07-10):** overlapp + `fra<til`-regel løftet til `@sitedoc/shared/utils/tidsromValidering.ts` (ren + vitest 44/44); web (`sjekkTimerOverlapp`/`refineFraForTil`) + mobil-synk (`syncBatch` via `finnTidsromKonflikt`, batch-intern) kaller samme regel. Avvisning via `"avvist"`. **+ datatap-fiks:** `syncBatch` persisterer nå `fraTid`/`tilTid` (input + `createMany`, timer + maskin) — før droppet synken dem samtidig som `deleteMany`+`createMany` slettet tider ført på web. Ingen migrering. Se [BACKLOG § Timer web-vs-mobil paritet](BACKLOG.md).
- **✅ M2 (develop 2026-07-10):** dedup `pauseBeregning.ts` — mobil-kopien (uten `10622ee3`-grensefiksen, målt) slettet, `TimerSeksjon.tsx` importerer nå fra `@sitedoc/shared`. Ingen mobil-funksjonsendring, kun kilde-samling.
- **✅ M3 (develop 2026-07-10):** klient-side speiling i mobil. `TimerSeksjon` blokkerer lagring ved overlapp (`finnOverlappendeTidsrom` mot **alle timer-rader på sedelen, kryss-bøtte** via ny `alleTimerRader`-prop tråret fra `[id].tsx`; ekskl. redigert rad) + `fra<til` (`tilErEtterFra`); `MaskinSeksjon` får `fra<til`-redirect. Prefill forblir bøtte-scopet (ulikt scope). Duplikat `fraErForTil` slettet — begge kaller delt `@sitedoc/shared`. Ny nøkkel `timer.feil.overlapp` (serverens ordlyd). Ren klient, ingen api/migrering.
- **✅ M4 (develop 2026-07-10):** `gjenaapneDagsseddel`-feil mappes nå på tRPC-**kode**, ikke delstreng. Server (`apps/api/src/routes/timer/dagsseddel.ts`) gir distinkte koder — `CONFLICT` (accepted), `PRECONDITION_FAILED` (attestert rad), `BAD_REQUEST` (annen ikke-sent-status); i tillegg arver mutasjonen `FORBIDDEN`/`NOT_FOUND` fra eierskaps-helperen `hentEgenDagsseddel` (`NOT_FOUND` fikk melding «Dagsseddelen finnes ikke», var tom). **Meldingene på de tre gjenåpne-avvisningene uendret** (web-onError `e.message.includes("godkjent")` uberørt). Mobil (`apps/mobile/app/timer/[id].tsx`): `CONFLICT`→`feilGodkjent`, `PRECONDITION_FAILED`→`laastAttestert`, **enhver annen kode→server-melding** (BAD_REQUEST/FORBIDDEN/NOT_FOUND + fremtidig), **kun fravær av `code`→`feilNett`**. Fikser attestert-vakt + eierskaps-feil vist feilaktig som «Krever nett». Ingen nye i18n-nøkler (`laastAttestert` fantes, brukt av web), ingen SQLite-migrering. **To 🟡-oppfølgere lagt i BACKLOG:** mobil mangler webs proaktive `disabled`-guard (krever SQLite-`attestertStatus` + sync-pull) + `providers/index.tsx` `"UNAUTHORIZED"`-substring (samme feilklasse). Se [BACKLOG § Timer web-vs-mobil paritet](BACKLOG.md) + [timer.md § Gjenåpning](timer.md).
- **✅ M5 (develop 2026-07-10):** mobil maskin-modal (`MaskinSeksjon.tsx`) speiler nå webs `MaskinRadDialog` — **B1** (maskin trekker lunsjpause via `effektiveTimerFraSpenn` med `standardPauseMin`, «maskin følger føreren»), **B2** (hard sperre `antall == effektiveTimerFraSpenn` i `lagre()`, `timer.feil.timerAvvik`), **B3** (`timer` init fra prefill-spenn), auto-synk `handterFra/Til/Timer`, **B4-prefill** fra bucketens arbeidsspenn (`defaultTider` leser timer-rader i `(defaultProjectId, defaultEcoId)`). `standardPauseMin`/`pauseEtterTimer` fra `hentOrganizationSettingLokalt`, skiftstart fra `hentEffektivArbeidstidLokal`. **Server:** `syncBatch` validerer nå maskin-`fra<til` (`tilErEtterFra` på `lokal.maskiner`) → `"avvist"` (SYNC-1) — lukker SYNC-2-funnet. Ingen ny i18n, ingen SQLite-migrering. **Docs:** timer.md B2-drift rettet (var «Server-superRefine» — usant) + B1–B4 mobil; ny 🔴 BACKLOG «B2 ikke håndhevet på serveren» (klient-only begge flater); maskin-fra<til-🟡 lukket. Se [timer.md § B1–B4](timer.md) + [mobil.md § Maskin-modal](mobil.md).
- **✅ M6 (develop 2026-07-10):** mobil timer-modal (`TimerSeksjon.tsx`) fikk **B3** (`timer`-init lazy-kaller `effektiveTimerFraSpenn` når `prefillGyldig`; `tilTid` prefylles kun ved gyldig prefill — speiler webs `TimerRadDialog`) + **prefill-scope**: `defaultTider.fra` løftet fra bøtte-scopet siste-rad til **seneste `tilTid` over hele sedelen** (`alleTimerRader`, **maks** via `hhmmTilMin` — ikke array-rekkefølge; fjerner `.reverse().find()`), fallback `effektiv.startTid`. Lukker bolk-(g)-prefill-scope-bulleten (bolk (g) mobil nå KOMPLETT: fra<til M3, overlapp M3, 0==0 allerede vernet, prefill-scope M6). `eksisterendeRader` beholdt for lønnsart/aktivitet-prefill. Ren klient — ingen api, ingen i18n, ingen migrering. **Docs:** timer.md B3 mobil timer ✅; BACKLOG bolk-(g)-rad → 🟢 + usortert-prefill-🟡 avgrenset til maskin-B4 (mobil timer fjernet fra mengden). Se [timer.md § B3](timer.md) + [mobil.md § Timer-modal](mobil.md).
- **✅ M7 (develop 2026-07-10):** bekreftelse før gjenåpning i mobil. `gjenaapne()` (`apps/mobile/app/timer/[id].tsx`) viser nå `Alert.alert(bekreftTittel, bekreftTekst, [avbryt(cancel), bekreftKnapp → utforGjenaapne])`; mutasjons-kroppen (inkl. M4-`onError`, uendret) flyttet til `utforGjenaapne()`. **Ikke** `destructive` — gjenåpning er reversibel. Paritet med webs `<Modal>`-bekreftelse. Gjenbruker webs `bekreft*`-nøkler + `handling.avbryt` (alle nb+en; var web-only). `Alert.alert` er husets bekreftelses-idiom (33/12 — talt 32 i Steg 0 før denne raden selv la til den 33.) og regel-konformt (CLAUDE.md § Slett-bekreftelse treffer webs `confirm()`, ikke RN). Ren klient — ingen api, ingen ny i18n, ingen migrering. **Ny 🟡 BACKLOG:** samle de 33 `Alert.alert` i delt RN-komponent hvis e2e (Detox/Maestro) innføres. **Docs:** timer.md § Gjenåpning, mobil.md. Se [mobil.md § Gjenåpning-bekreftelse](mobil.md).
- **🏁 Bolk (h) FERDIG PÅ DEVELOP + server-delen PROD-DEPLOYET** (SYNC-1 → SYNC-2 → M2–M7, 2026-07-10). **Server-endringene (M4/M5/SYNC i `apps/api`) er live i prod via merge `373a109f`** (arkivert til [historikk-2026-07.md § Prod-deploy 2026-07-10](historikk-2026-07.md)). **Raden holdes AKTIV** fordi mobil-siden (EAS #38) er blokkert av de 2 🔴 Fase-4-funnene (rader-forsvinner-etter-attestering + accepted-deadlock) — se 🧪-raden under. Ingenting nytt startet.
- **🧪 Fase 4 simulator-verifisering (2026-07-10):** kjørt på ekte enhet mot api-test (SSH-tunnel `localhost:3301` → server-ny, dev-login). Punkt 1–6 ✅ runtime; 7–8 blokkert av to attestering-bugger (🔴 rader-forsvinner-etter-attestering + 🔴 accepted-deadlock) → begge #38-blokkere, dokumentert i [BACKLOG § Fase 4 simulator-funn](BACKLOG.md). Prod er deployet (`373a109f`, bolk (h) + M4/M5 + katalog-importer). **#38 IKKE klar** før de to 🔴 er avklart.
- **✅ F4-serien (F4-1/1b/1c/1d/2/2b/3/4) — DEPLOYET TIL PROD 2026-07-11 (`d1b96cd5`):** identitetsforsoning + attestering-deadlock (gjenåpne) + synk-robusthet (touch-parent, projectId-poison, NOT_FOUND-oppslag) + mobil display-fikser. Server/web-delene live i prod; mobil-only (F4-1c dedupe, F4-3 attestert-tittel) ligger i main men når enheter via **EAS #38**. Full detalj + per-rad fil:linje arkivert til [historikk-2026-07.md § Prod-deploy 2026-07-11](historikk-2026-07.md).
- **⚠️ Deploy-rekkefølge — server FØR EAS #38:** `1061dd5a` (M4) og `0b0eb38e` (M5) rører `apps/api/src/routes/timer/dagsseddel.ts` (distinkte tRPC-koder `code: "CONFLICT"`/`"BAD_REQUEST"` + `code: "NOT_FOUND", message: "Dagsseddelen finnes ikke"` + maskin-`fra<til`-vakt `lokal.maskiner.find((m) => !tilErEtterFra(...))`). `8ffb29b0` (M6) og `1d6d616c` (M7) er **mobil-only**. **Server (M4+M5) MÅ prod-deployes FØR #38 når testerne.** Mot gammel server: gjenåpne-avvisningene deler fortsatt `PRECONDITION_FAILED`, så en #38-klient (`timer/[id].tsx` `onError`: `code === "PRECONDITION_FAILED" → laastAttestert`) viser «be leder returnere» for en sedel som faktisk er **godkjent** (`accepted`). Gammel servers meldingsløse `NOT_FOUND` vises som den rå strengen «NOT_FOUND», fordi klienten nå viser `e.message` for ukjente koder (`code != null ? melding`). **Ikke datatap — feil tekst.** Motsatt retning er trygg: gammel klient (#37) mot ny server leser `e.message`, som er uendret.

**Dagsseddel-prod krever `aktiverNivaa1` på prod-firmaet** (lønnsart-katalog seedet) ellers mangler lønnsarter — jf. onboarding-wizard + lønnsart/katalog-import-trådene under. (Redesign steg viii-kontinuitet: se redesign-blokka øverst.)

**Leveransekanal — EAS-bunt #37 / TestFlight (venter Florians funksjonelle device-test):**

Gjeldende TestFlight-bunt (bygg-ID `496b6a63`, commit `bc744f82`, sky-bygget 2026-07-01 da juli-kvoten resatt, status `finished` m/ .ipa). **Kumulativt fra develop** → .ipa inneholder ALL tidligere merget mobil-kode (timer-UX UF-0…UF-4/U1–U3 fra #30-æraen, byggeplass-UX fra #31) + det nye under. Erstatter #30/#31 (juni-kvoten oppbrukt; lokalt bygg = blindvei, se [eas-build-veileder.md](eas-build-veileder.md)). **Ingen schema/server.** A.Markussen-validering av **full timer-UX** skjer via #37 når det er i TestFlight. **Neste bygg = #38, etter bolk (h) (mobil-paritet); #37 er gjeldende TestFlight-bunt til da.**

**Kenneths beslutning (2026-07-10): Florian tester ikke #37 — han venter på #38 (etter bolk (h)).** Grunn (verifisert i kode): en rad serveren avviste ble stående `syncStatus="pending"` og `TimerSyncStatusBar.tsx` viste den som gul spinner → falsk trygghet for tester. **SYNC-1 (develop 2026-07-10) lukker synligheten** — permanent avvisning settes nå til terminal `syncStatus="avvist"` med rødt banner. Rettelsen når først testeren via #38 (SYNC-1 er på develop, ikke i #37s .ipa). Se bolk (h)-punktet over + [BACKLOG § Timer web-vs-mobil paritet](BACKLOG.md).

Nytt i #37 (vs #31): **Mobil Microsoft-auth** (code+PKCE, `f8594d1c`) → [BACKLOG § Mobil Microsoft-auth](BACKLOG.md) (Azure-sjekkliste + Florians test der; ikke duplisert her); **F-G glemt-dag 0-fiks** (`c6babc44`, bug — kort start-segment klampes aldri til 0) → [BACKLOG § Org uten standard-lønnsart](BACKLOG.md).

Fra #31 (venter fortsatt device-verifisering via #37):
- **Byggeplass-UX F1–F6** — `ByggeplassKontekst` eneste kilde, header-chip, GPS auto-set + override, timer-default, favoritter (`a46d58e9`/`b2ee5fb4`/`0eb2c9ef`/`d7419e6b`/`7c3ae7e3`) → [BACKLOG § Mobil global byggeplass-UX](BACKLOG.md).
- **F-A glemt-dag-transparens** — `sluttTidKilde="system"`-utkast viser «Estimert slutt … (gjettet)»-banner. Ikke-blokkerende.
- **F-B auto-rundings-fiks** (bug) — auto-genererte timer-rader rundes til firma-tidsrunding-grid (15 min = 0.25 t) på arbeidstimer før normaltid/overtid-splitt (`rundTimerTilNarmeste`); reise urørt.
- **B2+B6 sedel-nivå byggeplass** — `arbeidsdag.byggeplassId` inn i auto-utkast (`dagsseddelOpprett.ts`), ny `ByggeplassVelgerModal` + blå sedel-topp, myk mismatch-advisory (G1: arbeider-valg autoritativt). Server/schema uendret; i18n 3 nøkler × 15 språk. **Parkert (Besl. 6-oppf.):** per-rad byggeplass / «splitt dagen mellom byggeplasser».

**Device-test (via TestFlight #37, alt før submit):** (a) org uten lønnsart → banner (ikke stille 0) · (b) org m/ lønnsart + start 21:33 → ~2.45t-rad dag-1, pause på lengste segment · + chip/GPS/favoritt + glemt-dag-transparens + 15-min-runding. **Før GPS-test:** prod-prosjekt mangler byggeplasser — opprett + geofence på sitedoc.no → Byggeplasser. **Reload:** Expo JS/TS (Fast Refresh). _(Web-sporet geofence-editor A+B + rename C ble deployet til prod 2026-06-24 `a558db2e` → arkivert til [historikk-2026-06.md](historikk-2026-06.md).)_

### Modul-onboarding-wizard (timer) — IMPLEMENTERT PÅ DEVELOP 2026-07-08 (web-only, venter prod)

Gjør firmamodul-onboarding synlig + veiledet ved aktivering. Bakgrunn: `organisasjon.settFirmamodul` (aktiver=true) flipper kun modul-flagget — **seeder ikke katalog** → timer-brukere traff tomme kataloger (jf. [BACKLOG § Modul-onboarding-veiledning](BACKLOG.md)). Generisk datadrevet modell (ferdig-state utledes fra status-tellinger, aldri lagret steg-posisjon) → maskin/varelager plugges inn senere.

- **TASK 1 (`ea4887a3`)** — modell `apps/web/src/lib/onboarding-wizard.ts` (`OnboardingWizardConfig`, `førsteUfullførteSteg`/`antallGjenstår`/`erOnboardingFullført`) + timer-config (4 steg, `ferdig = count > 0`, status-type fra tRPC `RouterOutputs`).
- **TASK 2 (`97a2912f` + Suspense-build-fix `1730263b`)** — dedikert wizard-side `/dashbord/firma/timer/oppsett` (URL-adresserbare steg `?steg=`, datadrevet gjenopptak). Orkestrerer: steg 1 = `aktiverNivaa1`, steg 2–3 lenker til aktivitet/tillegg-sider, steg 4 = utlegg-state. Oppsett-fane i timer-layout + hjelpetekst (?-ikon).
- **TASK 3 (`34ae939f`)** — modal-inngang i `firma/moduler` (`settFirmamodul.onSuccess` → «{Modul} aktivert. Sett opp nå?») + «Fullfør oppsett ({n} av N)»-indikator på modulkortet (skjules ved fullført). Generisk `MODUL_WIZARD_URL`-oppslag.
- **TASK 4 (docs)** — i18n-sveip (30 nøkler nb+en, 0 relikvier/manglende), hjelpetekst-verifisering, denne STATUS-oppdateringen, sluttverifisering (build 59/59 grønt).

**v1 = web-only** (mobil «oppsett ufullstendig»-visning = egen follow-up). i18n nb+en (generate.ts frossen under redesign → 13 språk faller tilbake til nb). **Konsolidering utsatt** (redirect gammel `onboarding`-fane → wizard + migrering/`aktiverTomKatalog` inn i steg 1) → [BACKLOG § Onboarding-wizard konsolidering](BACKLOG.md). **Gjenstår: prod-deploy** (adresserer også Åpne tråder pkt 1 — tom lønnsart-katalog på prod-firma synliggjøres nå av wizarden).

### ✅ ARKIVERT — lønnsart/katalog-import A.Markussen (kjørt prod 2026-07-10) → [historikk-2026-07.md](historikk-2026-07.md)

### Gjenstående (åpent, ikke sporet annet sted)

- **EAS Android-bygg + Play Store** — Android-distribusjon står igjen (iOS går via TestFlight/EAS). Ikke sporet i BACKLOG/oppryddings-plan → beholdes her.

_Øvrige tidligere «Gjenstående PRs»-punkter er sporet i sannhetskildene og kollapset hit (2026-07-06):_ T7-5h ([BACKLOG](BACKLOG.md), deployet 2026-05-28) · P-KRITISK-1/-2/-3 ([oppryddings-plan-2026-04-28.md § P-KRITISK](oppryddings-plan-2026-04-28.md); -2/-3 deployet, -1 🔴 åpen) · HMS-prosjektvisning teknisk gjeld ([BACKLOG § HMS-prosjektvisning teknisk gjeld](BACKLOG.md)).

## Kundeønsker — A.Markussen (mottatt 2026-05-06)

12 forbedringsønsker fra kunde. Status per 2026-05-11 etter sjekk mot kode og commits. Legenda: 🟢 fikset · 🟡 delvis · 🔴 ikke startet · ❓ trenger verifikasjon · ⏸️ parkert.

### #1 — Sjekkliste for service koblet til timetall og status 🟡

**Side:** Maskin-detaljer (f.eks. 7634 Heatwork MY35). **Prioritet:** Høy.

Kunden ønsker sjekkliste der timetall kobles til servicestatus, og «neste service» oppdateres automatisk.

**Status:** DB-feltet `nesteServiceTimer` finnes allerede i `packages/db-maskin/prisma/schema.prisma:188`. Mangler: UI-felt på maskin-detaljside, serviceintervall-konfigurasjon, visuell terskel-indikator, sjekkliste med avkrysningsbokser, automatisk oppdatering av neste service basert på driftstimer.

### Firmakalender — T9a/b/c deployet til prod ✅, T9d gjenstår 🟡

T9a/b/c deployet til prod 2026-05-15 (prod merge `ca71cf48`).
Migrasjon `20260515114710_t9_arbeidstidskalender` kjørt 15:03:30.
`/dashbord/firma/kalender` returnerer HTTP 200 i prod.

Gjenstår: **T9d** mobil-cache `arbeidstidskalender_local` (avhenger av
T.4/T.5-implementasjon). SummeringsBanner.tsx (T7-3a) trenger oppdatering
etter T9d for å lese dagsnorm fra kalender-cache i stedet for
`OrganizationSetting.dagsnorm`.

### Topbar firma-kontekst + favoritter — deployet til prod ✅

Deployet til prod 2026-05-15 (prod merge `0bd27466`). Topbar tilpasser seg
pathname: i firma-kontekst (`/dashbord/firma/*`) vises ny «Firma ▾»-velger
istedenfor `ProsjektVelger` + `ByggeplassVelger`. Favoritt-prosjekter og
favoritt-byggeplasser persistert i localStorage med stjernemerking i alle
tre velgere (`ProsjektVelger`, `FirmaKontekstVelger`, `ByggeplassVelger`).
Søkefelt vises ved >7 elementer. 11 nye i18n-nøkler totalt
(`topbar.*` + `byggeplassVelger.*`) auto-oversatt til 13 språk.

**Tidligere § #2 «Validering av overtid basert på arbeidstid»** er konsolidert inn i T.9 — sommer/vinter-modell er nå Variant B (dynamiske perioder i `ArbeidstidsKalender`, ikke scalar-felter). 8t (sommer) / 7t (vinter) ordinær arbeidstid-validering bygges som del av T.9-implementasjon.

### #3 — Tidspunkt (fra/til) per linje i timeføringen 🟢 LUKKET 2026-05-16

**Side:** Timeføring.

Levert via T.4-bunken (prod-commit `5d36c8b9`) + T.5 tidsrunding (prod-commit `ba6ba243`).
Server-Zod + DB-schema + web-UI + mobil-cache + mobil-UI deployet til prod 2026-05-16.
Mobil-UI aktiveres på enhet ved neste EAS-bygg (server-respons + lokal SQLite-migrasjon
er klare). T.5 leverer i tillegg konfigurerbar tidsrunding (15/30/60/null) — utover
originalt kundeønske. fra<til-validering på mobil via delt `tilErEtterFra`
(`@sitedoc/shared`; `fraErForTil`-helperen erstattet i M3 2026-07-10) + onBlur-runding på web.

**T.4-implementasjons-bunke (planlagt 5 sub-PR-er):**

| Sub-PR | Status | Innhold |
|---|---|---|
| **T4-a** | ✅ Merget til develop 2026-05-16 (merge `5acd2a5d`, impl `cfe51fc5`) | Schema + migrasjon. `OrganizationSetting.standardStartTid/SluttTid/PauseMin` (defaults 07:00/15:00/30) + `ArbeidstidsKalender.standardStartTid?/SluttTid?/pauseMin?` (overstyring for sommertid_start/slutt/halvdag). Additiv migrasjon, ingen breaking. |
| **T4-b** | ✅ Merget til develop 2026-05-16 (merge `9bcfb5b1`, impl `088a1e37`) | `hentEffektivArbeidstid(orgId, dato)`-helper i `apps/api/src/services/timer/arbeidstid.ts` (sommertid-overstyring → firma-default). Hard sommertid-par-validering i kalender opprett/oppdater (`sommertid_start` krever `sommertid_slutt` samme år). |
| **T4-c** | ✅ Deployet til test 2026-05-16 (merge `c02df657`, impl `39c43aa8`) | Server-Zod-utvidelse for de tre T4-a-feltene i `oppdaterSetting` + kalender `opprett`/`oppdater` (+ `validerTidsfelter`-helper). Innstillinger-side: ny `StandardArbeidstidSeksjon`. Kalender-modal: betinget visning av tidsfelter for sommertid_start/slutt/halvdag + klokke-badge i månedsliste. 15 nye i18n-nøkler → 13 språk (2277 totalt). Venter på visuell verifisering før prod-merge. |
| **T4-d** | ✅ Merget til develop + deployet til test 2026-05-16 (merge `7bee1633`, impl `2f7bf42d`) | Mobil Drizzle: `fraTid`/`tilTid` på `sheet_timer_local` + `sheet_machine_local`. Nye lokale tabeller `arbeidstidskalender_local` + `organization_setting_local`. Nye services `kalenderKatalog.ts` (med `hentEffektivArbeidstidLokal`-helper, speil av server) + `organizationSettingKatalog.ts`. TimerSyncProvider utvidet til 2-stegs Promise.all (base-pulls → firma-spesifikke pulls per org-id fra prosjekt-cachen). `timerSync` push/pull utvidet med fraTid/tilTid per timer/maskin-rad. Server: ny medlems-tilgjengelig `organisasjon.hentArbeidstidDefaults` + fraTid/tilTid lagt til i `hentEndringerSiden`-respons-mapping. Typecheck 12 = 12 baseline. Venter på enhet-verifikasjon + prod-merge. |
| **T4-e** | ✅ Merget til develop + deployet til test 2026-05-16 (merge `e992aca3`, impl `cea8f99e`) | Mobil UI. Ny `FraTilTidFelt`-fellekomponent (DateTimePicker mode=time, 2 felter side ved side). Montert i TimerRadModal + MaskinRadModal. Forhåndsutfylling: ny rad uten forrige rader → `hentEffektivArbeidstidLokal(orgId, dato)` (kalender + firma-default). Ny rad med forrige rader → forrige rads tilTid som fraTid. Rediger eksisterende → radens egne verdier. Validering: fraTid < tilTid hvis begge satt (`fraErForTil`-helper — erstattet av delt `tilErEtterFra` i M3 2026-07-10). Lagring til Drizzle med syncStatus=pending. SummeringsBanner: arbeidstidTimer faller tilbake til kalender-dagsnorm hvis sedel.startAt/endAt mangler — UI viser alltid relevant sammenligning. Rad-visning utvidet med `HH:MM–HH:MM`-tekst. 0 nye i18n-nøkler — gjenbruker `timer.felt.startTid/sluttTid` + `timer.feil.sluttForStart`. Typecheck 12 = 12 baseline. Venter på enhet-verifikasjon + prod-merge. |
| **T.5 tidsrunding** | ✅ Deployet til prod 2026-05-16 (merge `c2b2ede1` develop / `ba6ba243` prod, impl `2560f0d5`) | Server: `oppdaterSetting` Zod-input + `hentArbeidstidDefaults` select utvidet med `tidsrundingMinutter`. Validering: `z.union([15, 30, 60, null])`. Web: ny dropdown i `StandardArbeidstidSeksjon` (Ingen/15/30/60). RedigerTimerRad + RedigerMaskinRad: `step={tidsrundingMinutter * 60}` + onBlur-fallback-runding via `apps/web/src/lib/tidsrunding.ts`. AttesteringDetalj_Edit henter `tidsrundingMinutter` fra `hentSetting` og passerer som prop. Mobil-cache: `organization_setting_local.tidsrunding_minutter` (idempotent ALTER) + service skriver feltet. Mobil-UI: ny `apps/mobile/src/utils/tidsrunding.ts` (speil av web). FraTilTidFelt fikk ny `tidsrundingMinutter`-prop + runder onChange-verdi før callback. `minuteInterval` på DateTimePicker for 15/30 hint til pickeren. TimerSeksjon + MaskinSeksjon henter via `hentOrganizationSettingLokalt`. 6 nye i18n-nøkler → 13 språk (2277 → 2283 totalt). Test-QA godkjent. Prod-deploy 2026-05-16: HTTP/2 200 på sitedoc.no + api.sitedoc.no. Mobil-app-bygg via EAS gjenstår — feltet aktiveres på enhet når TestFlight/Play Store-versjonen oppdateres. |

**T.4-bunken komplett på develop + test 2026-05-16:** Alle fem sub-PR-er (a/b/c/d/e) er merget og kjører på `test.sitedoc.no` + `api-test.sitedoc.no` (HTTP/2 200, migrasjoner kjørt i `sitedoc_test`). Neste: (1) Kenneth verifiserer T4-c web-UI + T4-d/e mobil-UI på testbygg (forhåndsutfylling, validering, fra/til-visning på rad). (2) Etter verifikasjon → prod-deploy av hele bunken samtidig (server-migrasjon, web-deploy, mobil-bygg via EAS → TestFlight/Play Store).

**Auto-fordeling normaltid/overtid — besluttet å ikke implementere (2026-05-16).** Var tidligere notert som planlagt avhengighet av T.9-kalender. Kunden registrerer lønnsart manuelt per rad slik som i dag — `Lonnsart`-katalogen (firma-eid) dekker behovet med separate rader for «Ordinær 100», «Overtid 50%», «Overtid 100%» osv. Krever ingen ytterligere arkitektur eller regelmotor.

### #4 — Redigering og splitting av timer ved attestering 🟡 DELVIS LEVERT

**Side:** Attestering.

**Levert 2026-05-14** via T7-2b-bunken:
- ECO-flytt på attestering (Steg 4a, prod-commit `f98fa7a5` 2026-05-03) — leder kan endre kostnadsbærer per rad.
- Per-rad-attestering med felleskomponent AttesteringDetalj (T7-2b1, prod-commit `3234c057`).
- **Edit-modus: firma-admin kan redigere timeantall + ECO + fra/til på alle pending-rader** via `redigerSedelRader`-mutation (T7-2b2, prod-commit `755c542a`). Gated på `OrganizationSetting.tillattRedigerVedAttestering`-toggle (T7-2b3, prod-commit `af4a7deb`) — default false, firma-admin skrur på via `/dashbord/firma/innstillinger`.
- T.5 tidsrunding (prod-commit `ba6ba243` 2026-05-16) avrunder fra/til-input i edit-modus til konfigurert intervall (15/30/60 min).

**Gjenstår:** Rad-splitting (én rad → flere med ulike prosjekt/ECO/lønnsart/fra-til) krever `splittRad`-mutation. Audit-log med før/etter-snapshots per rad (T7-2b2 logger antall + actor; per-rad-snapshots utsatt til egen oppfølger).

### #5 — Registrering av HMS-gruppe på brukere ⏸️ PARKERT

**Side:** Oppsett – Brukere.

**Opprinnelig ønske:** Felt for HMS-gruppe på bruker/kontakt-kortet, knyttet til eksisterende gruppe-struktur, filtrerbart i brukerlisten.

**Status (oppdatert 2026-05-11 etter Sonnet-sesjon):** Parkert til prosjektoppsettet er mer modent og avhengighetene er synlige. Tidligere klassifisert som «lav kompleksitet» — feilvurdert.

**Begrunnelse:**
- To separate konsepter eksisterer i dag: `ProjectGroup` (RBAC/tilgang) og `Faggruppe` (dokumentflyt-deltaker). HMS-gruppe må plasseres i en av disse eller bli et tredje konsept — ikke avgjort.
- Standard HMS-gruppen (`hms-ledere`, `category="field"`) har ingen UI for administrasjon i dag — kan ikke redigeres via noen side.
- Brukergruppe-arkitekturen er uavklart: Kenneth vurderer firma-basert gruppering (ansatte/ledere per firma) som fremtidig modell, men ikke låst.

**Beslutning:** Ikke estimer eller planlegg denne nå. Tas opp igjen når prosjektoppsett-design og brukergruppe-arkitektur er låst.

---

### #6 — Maskinmodul ikke synlig i prosjekt 998 Instinniforbotn ✅ Lukket 2026-05-12

**Side:** Maskin (prosjekt 998 Instinniforbotn).

✅ **Lukket 2026-05-12 — ikke en bug.** `ProjectModule maskin/aktiv` finnes på prod for prosjekt 998 (`5e8dd794-ab81-47b7-a146-d7384fac3a8a`), og `OrganizationModule maskin/aktiv` finnes for A.Markussen (`4488fe17-...`). Auto-sync fra Steg 1c (`87fb7292`) har gjort jobben sin.

A.Markussen-ansatte (Malin, Silje, Florian — alle `company_admin` med `organization_id = 4488fe17-...` og `can_login=true`) ser Maskin-lenken korrekt i bunnen av HovedSidebar. Kenneth ser den ikke fordi hans bruker har `organization_id = NULL` (superadmin uten firma-tilknytning) — `organisasjon.hentMin` returnerer da `null` og `aktiveFirmamoduler = []`, slik at maskin-bunnelementet filtreres bort i `HovedSidebar.tsx:331`.

**Løsning:** Bytt til brukervisning (impersonering eller logg inn som A.Markussen-ansatt) for å se det kunden ser. Diagnose-verifikasjon utført 2026-05-12 mot prod-DB.

### #7 — Rettighetsmatrise med rolle-styring (Prosjektleder + Bas) 🔴

**Side:** Oppsett – Brukere/Roller.

Ingen treff på `Prosjektleder`/`Bas` som DB-roller. Eksisterende roller: `User.role = sitedoc_admin | company_admin | user` og `ProjectMember.role = admin | member`. Krever ny rolle-modell + matrise-UI som viser tilganger per rolle.

### #8 — Fagområde og oppgaver i sjekklistemaler-listevisning 🟢 LUKKET 2026-05-12

**Side:** Innstillinger – Produksjon – Sjekklistemaler.

Levert via commit `3eb7398f` (impl) + merge `542461e2` (prod) 2026-05-12. Fagområde-kolonne (Bygg/HMS/Kvalitet via `mal.domain`) + Antall punkter-kolonne (`mal._count.objects`) lagt til i `apps/web/src/app/dashbord/oppsett/produksjon/_components/MalListe.tsx`. 4 nye i18n-nøkler i 15 språk. Tabellen har nå 5 kolonner: Navn, Fagområde, Antall punkter, Prefiks, Versjon.

### #9 — Justeringer på SJA (signatur/lesetilgang/deltaker) 🔴

**Side:** Innstillinger – Produksjon – Sjekklistemaler – SJA.

Ingen treff på `SJA`/`sja` i kode — SJA er sannsynligvis en konkret sjekklistemal-instans, ikke egen funksjonalitet. Krever utvidet sjekkliste-mekanikk: re-signaturforespørsel, auto-lesetilgang for alle prosjektmedlemmer, selv-påmelding som deltaker.

### #10 — «Flere personer»-feltet på SJA — definere hvem som er valgbare 🔴

**Side:** Innstillinger – Produksjon – Sjekklistemaler – SJA.

Avklare om feltet henter alle firma-ansatte. Krever felt-konfigurasjon for å begrense/definere valgbare personer per SJA-mal.

### #11 — Pushvarsel/SMS til ansattliste 🔴

**Side:** Generelt.

Ingen treff på `pushvarsel`/`sms` i kode. Krever ny varslingstjeneste (SMS-leverandør integrasjon), målgruppe-velger (alle ansatte eller utvalgte grupper), kostnadsavklaring med SiteDoc/leverandør.

### #12 — Oppretting av ny sjekkliste fungerer ikke 🟢 SANNSYNLIGVIS FIKSET

**Side:** Sjekklister (prosjekt 998 Instinniforbotn).

**Status:** Commit `4e29c88a` («fix: sjekkliste opprett-modal stille død») deployet til prod 2026-05-09. Lukket bug der klikk på mal i opprett-modal gjorde ingenting når innlogget bruker ikke var medlem av noen faggruppe (typisk sitedoc_admin/company_admin uten faggruppe-tilknytning) — `handleOpprettFraMal` returnerte stille. Nå: fallback-kjede henter `bestillerFaggruppeId` fra dokumentflytens `oppretter`-medlem, synlig feilmelding i Modal hvis ingen kandidat finnes. Re-test ønskelig fra kunde for å bekrefte at både «Opprett ny sjekkliste» og «+ Ny sjekkliste» nå fungerer i prosjekt 998.

## Kjente bugs

**~~Lokasjon-modal forhåndsvelger ikke når kun ett alternativ finnes (observert 2026-05-02)~~ — LØST.** Verifisert 2026-05-05 at auto-select er implementert i `apps/web/src/components/LokasjonVelger.tsx:66-81` (to useEffect-hooks: én for bygning, én for tegning, begge sjekker `length === 1` og setter valgt verdi). Sannsynligvis lagt til etter den opprinnelige observasjonen. TegningsModal (skjermbilder, ikke samme flyt) auto-velger kun ved `standardTegningId` — bevisst design.


## Pauset, planlagt og fremtidige faser

→ Se [docs/claude/BACKLOG.md](BACKLOG.md) for konsolidert backlog
(teknisk gjeld, halvferdige features, Fase 0.5-7, kundeønsker ikke startet).
