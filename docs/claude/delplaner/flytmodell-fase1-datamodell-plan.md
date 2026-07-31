# Flytmodell Fase 1 — datamodell + migrering (plan, venter Kenneth-OK på schema)

**Status:** 🟡 PLAN — ingen migrering kjørt. Kenneth-OK på schema kreves før SQL skrives/kjøres (gate-svar `flytmodell-gate-svar-fabel.md`).
**Grunnlag:** Fase 0 nå-sjekk (verifisert) + gate-svar FLAGG 1–3 (vedtatt Kenneth 31.07) + `flytmodell-veileder-cowork.md`.
**Branch:** `feat/flytmodell-fase0`. **Miljø:** lokal sandkasse for DDL-prøve, deretter test-DB. **ALDRI drop; to-stegs migrasjonspolicy.**

---

## 1. Schema-endringer (Prisma, `packages/db/prisma/schema.prisma`)

Alle nye kolonner **nullable / med default** i steg 1 (NOT NULL utsettes til steg 2 = neste release, per policy). Status-enum beholdes permanent som avledet cache.

### Lag 1 — per ledd: `DokumentflytMedlem` (l.1230-1259)
| Felt | Type | Merknad |
|---|---|---|
| `steg` | `Int @default(1)` | **FINNES ALT** (l.1238) — kun backfill, ingen DDL. Inngår i 3 `@@unique`-nøkler → backfill må holde (rolle,steg) distinkt per flyt |
| `ansvarsmerke` | `String?` | **NY.** Brukervendt merke (§ 2.6): «Bestiller arbeid», «Kontrollerer avvik», «Utfører», «Orienteres» |
| `klassifisering` | `String?` | **NY.** `"kontroll" \| "utfor" \| "orienteres"` (ASCII, matcher `rolle:"utforer"`-konvensjon). Styrer retningsrett (vedtak: ← = kontroll+utfor; orienteres = aldri ball) |
| `kanTerminereUtenBall` | `Boolean @default(false)` | **NY (FLAGG 2, generelt leddflagg — ikke HMS-særkode).** Kontroll-ledd som eier Lukk uten å holde ballen. Erstatter dagens F3-lukking i hovedflyten |

### Lag 2 — per dokument: `Checklist` + `Task` (avledStatus-fakta, § 2.3)
| Felt | Type | Merknad |
|---|---|---|
| `aktivPosisjon` | `Int?` | **NY.** Aktivt ledd (rutingens sannhet; i dag utledet på klient fra recipient) |
| `retning` | `String?` | **NY.** `"frem" \| "tilbake" \| "paatvers"` (siste bevegelse → «Besvart — hos N») |
| `terminal` | `String?` | **NY, åpent felt (ikke tilstandsmaskin).** `"godkjent" \| "avvist" \| "lukket" \| "avbrutt" \| null`. `deleted` skal ALDRI hit |
| `sendt` | `Boolean @default(false)` | **NY.** Har forlatt ledd 1. Løser avledStatus + `!sendt`-sletteguard (draft ≠ aldri sendt) |

Begge tabeller får identiske 4 felt (speiler hverandre, som i dag). Ingen nye `@@index` foreslått i steg 1 (kan legges til når rutingen faktisk spør på `aktivPosisjon`/`terminal` i Fase 3).

---

## 2. Backfill-logikk (engangs, i migreringens `-- backfill`-seksjon)

### 2a. `DokumentflytMedlem.steg` ← kanonisk rollerekkefølge per flyt
Per `dokumentflytId`: sorter medlemmer på `ROLLE_PRIORITET` (registrator1/bestiller2/utforer3/godkjenner4), tildel `steg` = rang. **Bevar eksisterende `steg > 1`** (HMS-gruppe har alt `steg:2`, `modul.ts:64-70` — ikke overskriv). Hold (rolle,steg) distinkt innen flyt (unik-nøkkel).

### 2b. `DokumentflytMedlem.klassifisering` ← rolle-default (redigerbart etterpå)
| rolle | klassifisering | Begrunnelse |
|---|---|---|
| registrator | `utfor` | kildeledd/registrerer |
| bestiller | `kontroll` | mellomgodkjenner (§ 2.6) |
| utforer | `utfor` | utfører |
| godkjenner | `kontroll` | godkjenner |
| **HMS-gruppe-ledd** (rolle=utforer, i HMS-flyt) | `kontroll` | **FLAGG 2:** HMS Ledd 2 er kontroll (løser+lukker), ikke utfor |

Konsekvens: alle 4 dagens roller får ← (kontroll ∪ utfor) — ingen regresjon (orienteres finnes ikke som rolle i dag; velges ved oppsett fremover).

### 2c. `DokumentflytMedlem.ansvarsmerke` ← rolle-default
`registrator→"Registrerer"`, `bestiller→"Bestiller arbeid"`, `utforer→"Utfører"`, `godkjenner→"Godkjenner"`. Redigerbart ved flytoppsett. (Endelig ordliste er åpent punkt i veileder § 5 — dette er kun engangs-default.)

### 2d. `DokumentflytMedlem.kanTerminereUtenBall` ← F3 + HMS
`true` der leddet eier Lukk uten ball i dag: kontroll-ledd `bestiller` + `godkjenner` (F3: eier Lukk fra Under arbeid) og **HMS-gruppe-ledd**. Ellers `false`.

### 2e. `Checklist/Task.terminal` ← map fra dagens terminale status
`approved→godkjent`, `rejected→avvist`, `dismissed→avvist`, `closed→lukket`, `cancelled→avbrutt`. Ikke-terminale statuser → `null`.

### 2f. `Checklist/Task.sendt` ← utledet
`true` hvis `status <> 'draft'` **ELLER** finnes minst én `DocumentTransfer`-rad (bevis for tidligere send). Ellers `false`. HMS-dok = alltid `true` (starter `sent`).

### 2g. `Checklist/Task.aktivPosisjon` ← utledet fra recipient/eier → medlem-steg
Match dagens eier/recipient mot flytens medlem → dets `steg`. **Terminaler (korrigert, fabel 31.07): posisjon = leddet termineringen ble utført FRA, ikke blankt siste ledd** — gjenåpne-regelen «admin→samme boks» (§ 2.4) avhenger av det, og det er simulatorens fasit. `godkjent` → automatisk siste ledd (fremover-handling fra siste ledd). `closed`/`cancelled` (avvist/lukket/avbrutt) → utled fra transferlogg (leddet handlingen skjedde fra), fallback siste kjente posisjon. Samme regel gjelder terminering via `kanTerminereUtenBall`. HMS (flyt-løse i dag, se § 3): `sent→2`, `responded→1`, `closed→2 (terminal lukket, utført fra Ledd 2)`.

### 2h. `retning` ← utledet
`responded` (via besvar) → `tilbake`; ellers `frem`. `paatvers` settes ikke i backfill (kun ny videresend fremover).

### ⚠️ 2g + 2h UTSATT til Fase 2/3 (beslutning under skriving — ber om bekreftelse)
`aktivPosisjon` og `retning` legges til som **kolonner nå** (nullable), men **backfillen deres utsettes**. Utledningen (eier/recipient → flytmedlem-steg; terminal-posisjon = leddet handlingen ble utført fra via transferlogg) **speiler runtime-rutingens matcher**, som først bygges som DELT utledning i Fase 2. En hand-rullet SQL-approksimasjon i Fase 1 ville risikere divergens fra runtime-matcheren — nettopp feilklassen posisjonsmodellen fjerner. Fase 2/3 backfiller dem med samme kode runtime bruker. **Anbefaler denne utsettelsen.** Alt annet (2a–2f: steg, klassifisering, ansvarsmerke, kanTerminereUtenBall, terminal, sendt) er rent deterministisk og backfilles nå i migreringen.

---

## 3. HMS flyt-binding (Fase 1-arbeidsstykke — har kode-komponent)
HMS-dok er **flyt-løse i dag** (`dokumentflytId=null`; opprett avviser flyt `sjekkliste.ts:263-268`). «HMS = ordinær 2-ledds flyt» krever at HMS-dok bindes til en reell 2-ledd-flyt. **Dette rører opprett-koden** (fjerne HMS-avvisning, sette `dokumentflytId` + posisjon ved opprett) — altså mer enn ren datamodell.

**Forslag (til gate):** splitt Fase 1 i **1a schema+backfill** (ren DDL/SQL, Kenneth-OK → kjør) og **1b HMS flyt-binding** (opprett-kode + seed-kobling). 1b kan alternativt skyves til Fase 3 (server-omskriving), siden den uansett rører rutingkoden. **Anbefaling:** hold 1b i Fase 1 som vedtatt, men som eget commit etter at 1a-schemaet er landet — da er backfill av eksisterende HMS-dok mulig (de får `dokumentflytId` + posisjon retroaktivt via samme migrering).

---

## 4. Migreringssekvens (to-stegs)
1. **Steg 1 (denne fasen):** én Prisma-migrering: `ALTER TABLE ADD COLUMN` (alle nullable/default) + backfill-`UPDATE` (§ 2). Prøves på lokal sandkasse-DB først (risiko-DDL), så test-DB. **ALDRI DROP.**
2. **Steg 2 (senere release):** sett NOT NULL der modellen krever (`aktivPosisjon`, `klassifisering` når alle rader er populert). `sendt`/`kanTerminereUtenBall` har alt default. Status-enum beholdes permanent.
3. Migrering **aldri redigert etter merge** (reproduserbarhet). Kanonisk-rekkefølge-antagelsen = ren engangsmigrering.

---

## 5. Avklarte valg (fabel/Kenneth 31.07 — alle vedtatt)
1. **Enum-staving ASCII `utfor`** ✅ (konsistens med `rolle:"utforer"`; visning eies av etikett-laget).
2. **Fase 1-splitt 1a (schema+backfill, ren SQL/script) / 1b (HMS flyt-binding, eget commit)** ✅ — 1b rører opprett-kode, skal kunne rulles tilbake alene.
3. **Rolle-default for `ansvarsmerke` nå** ✅ — ordliste forfines ved oppsett-UI (veileder § 5).
4. **`aktivPosisjon` ved terminal = leddet handlingen ble utført fra** ✅ (korrigert fra «siste ledd»): godkjent→siste ledd automatisk; avvist/lukket/avbrutt→der handlingen skjedde (transferlogg, fallback siste kjente posisjon). Se § 2g.
