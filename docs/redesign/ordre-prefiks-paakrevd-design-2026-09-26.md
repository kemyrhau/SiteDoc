---
status: 🟢 ORDRE — klar. Steg 3 (NOT NULL) er IKKE bestilt
til: kode-agent (worktree og branch bestemmes av cowork)
fra: design
dato: 2026-09-26
grunnlag: coworks veikartlegging 2026-09-25 + to SQL-målinger mot test (Kenneth 2026-09-25/26)
---

# Ordre: prefiks påkrevd på maler — lukk kilden, ikke symptomet

## [1] HVA SOM ER MÅLT

### Produktvalget er tatt

🔴 **Prefiks skal være PÅKREVD.** Prefikset blir dokumentnummerets prefiks (`bibliotek.ts:174`), så **en mal
uten prefiks produserer dokumenter som ikke kan siteres.** Dokumentene ender i sluttoppgjør; **et dokument du
ikke kan vise til med nummer, kan ikke brukes som bevis.**

⚠️ **`schema.prisma:1345-1351` sier «NULL er distinkt i Postgres → nummerløse maler påvirkes ikke».** Det
dokumenterer en **mekanisme**, ikke et valg. **Ingen har valgt nummerløse maler** — constrainten kom til kort,
og forklaringen ble stående som om den var en beslutning.

### To SQL-målinger mot test — kjeden er komplett

**Måling 1 — `report_templates WHERE prefix IS NULL`: 3 rader.** Alle tre bærer `organization_template_id`.
**Måling 2 — `organization_templates WHERE prefix IS NULL`: 10 rader.** **Alle `sjekkliste`/`kvalitet`.**
De tre kildene fra måling 1 er blant dem.

🔴 **Rotårsaken er IKKE i `report_templates`. Firmamalen er født uten prefiks, og kopien arver tomheten.**

**Navnene avslører opphavet:** KA7, KB2, KB4, KB6, KC3.1 (×3), KD1 (×2), JH2 — **alle er biblioteksmaler.**

### 🔴 Og den eksakte linja er funnet

| Sted | Hva |
|---|---|
| `bibliotek.ts:174` | bibliotek → **prosjektmal**: `bibMal.referanse.split(/[\s\/]/)[0]` 🟢 **setter prefiks** |
| 🔴 **`firmamal.ts:970`** | bibliotek → **firmamal**: setter `name: bibMal.navn` — **og prefiks IKKE i det hele tatt** |

🔴 **Samme kilde, to destinasjoner, én mister prefikset.** **Det forklarer alle ti radene.**

**De to andre lekkasjene, målt:**
- `firmamal.ts:301` — `prefix: z.string().nullable().optional()`, `:314` — `input.prefix?.trim() || null`
- `firmamal.ts:598` — `prefix: kilde.prefix` (arver, også når kilden er null)

🟢 **Og backfillen har en bedre nøkkel enn navnet:** `OrganizationTemplate.laantFraBibliotekMalId`
(`schema.prisma`, `@map("laant_fra_bibliotek_mal_id")`) **peker tilbake til bibliotekmalen.**

**BACKLOG-grep (steg 0):** `prefiks`, `prefix`, `nummerløs`, `løpenummer` — **ingen eksisterende post.**

## [2] HVA SOM GJENSTÅR

Lukk kilden, utled der det kan utledes, og gjør tomhet umulig framover. **NOT NULL er IKKE i denne ordren.**

## [3] OPPGAVE

### 🔴 A. Del logikken FØRST — ellers fødes den femte kopien

`bibliotek.ts:174` har `referanse.split(/[\s\/]/)[0]` **inline**. **Den skal ut i `packages/shared`:**

```ts
export function prefiksFraReferanse(referanse: string): string | null
```

🔴 **SAMARBEIDSREGLER § «DELT LOGIKK SKAL NAVNGIS I ORDREN»** — den er navngitt her, og **begge kallsteder
skal bruke den.** ⚠️ **Splitter du på nytt i `firmamal.ts`, har du laget kopi nummer to av en regel som alt
har drevet ett sted.**

**Merk formen:** splitter **kun** på mellomrom og skråstrek. **Punktum er trygt** — `UO2.1` og `KC3.1` skal
beholde punktumet. **Test begge.**

### 🔴 B. Lukk `firmamal.ts:970` — rotårsaken

Bibliotek → firmamal skal sette `prefix: prefiksFraReferanse(bibMal.referanse)`, **samme vei som
prosjektmalen.**

🔴 **Er `referanse` tom eller gir null: AVVIS opprettelsen med lesbar feil.** ⚠️ **Ikke lagre en mal som ikke
kan nummereres — det er nettopp den tilstanden ordren fjerner.**

### 🔴 C. Lukk de to andre veiene

**`:301`/`:314` manuell opprett:** prefiks **påkrevd** i Zod. ⚠️ **Fjern `.optional()`.**

**`:598` kopi/dupliser:** 🔴 **arv aldri `null`.** Er kildens prefiks tomt, **utled fra kildens
`laantFraBibliotekMalId` → bibliotekmalens `referanse`**. Går ikke det, avvis.

🟢 **`finnLedigeMalVerdier` suffikserer ved kollisjon (JH2 → JH22) og nuller aldri** — målt av cowork.
**Utledningen kan derfor ikke lage duplikater.**

### 🔴 D. Backfill — og de tre ulike utfallene skal RAPPORTERES hver for seg

**Egen migrering. Additiv, ingen NOT NULL.**

| Tilfelle | Handling |
|---|---|
| `laantFraBibliotekMalId` satt | **Utled fra bibliotekmalens `referanse`** |
| Ikke satt, men navnet er «KODE – …» | 🟡 **Foreslå, ikke sett.** Rapportér til Kenneth |
| Verken eller | 🔴 **Rapportér. Ikke gjett** |

🔴 **Rapportér tallene for ALLE TRE gruppene, også de tomme.** ⚠️ **«0 i gruppe 3» er en måling. Et utelatt
tall er ikke.**

**Samme backfill kjøres for `report_templates`** — de tre radene arver fra sine firmamaler, som nå har fått
prefiks.

### 🔴 E. Test som FEILER ved tomhet — «stille tomhet» krav (c)

**Minst tre, og alle skal være røde først:**
1. Firmamal opprettet fra bibliotekmal **uten** at prefiks utledes → **rød**
2. Manuell firmamal uten prefiks → **rød**
3. Kopi fra en kilde med `null` prefiks → **rød** (skal utlede eller avvise, aldri arve null)

⚠️ **Uten disse lukkes veiene i dag og åpnes igjen om tre måneder av noen som ikke kjente regelen.**

### 🟡 F. Synlig konsekvens fram til NOT NULL

**En mal uten prefiks skal være MERKET i UI-et.** 🔴 **I dag viser mangelen seg først når noen skal referere
dokumentet i en tvist — det dyreste tidspunktet å oppdage den på.**

### ⚠️ G. Mål om `subdomain` mistes i samme vei — meld, ikke fiks

**Alle tre radene i måling 1 hadde OGSÅ tom `subdomain`.** 🔴 **Er det to felt som mistes, er dette ikke en
prefiks-bug — det er en mangelfull kopi-funksjon, og da trenger den en egen ordre.** **Mål det og meld. Ikke
utvid denne.**

## [4] UFRAVIKELIG

- **Arbeidstre + branch:** cowork bestemmer.
- **Filer:** `packages/shared/src/utils/` (ny delt funksjon) · `apps/api/src/routes/firmamal.ts` ·
  `apps/api/src/routes/bibliotek.ts` (kun kallstedet) · én migrering · tester.
- 🔴 **Ingen NOT NULL.** To-stegs-policyen: eksisterende rader har `null`. **Steg 3 er en senere release.**
- 🔴 **SQL mot test kjøres ÉN gang, av Kenneth.** Aldri av agenten. **Aldri mot lokal DB.**
- 🔴 **Din ordre er input, ikke fasit — mål premisset selv.** Linjenumre målt på `origin/develop` 2026-09-26.
- 🔴 **Sjekk treets alder før du melder et fravær.** ⚠️ **Tom grep-output betyr «kommandoen døde» like ofte
  som «finnes ikke».**
- **Forsteg:** `pnpm install` + `prisma generate` ×4. ⚠️ **Tre agenter har gått i den samme på fire dager.**
- **Gate:** `pnpm test` fra ROT · kald web-build · mobil-typecheck · `tsc --noEmit`.

## [5] FORVENTET OUTPUT

1. **Den delte funksjonen**, og at **begge** kallsteder bruker den. **Vis at `KC3.1` og `UO2.1` beholder punktumet.**
2. **`firmamal.ts:970`:** diff, og hva som skjer når `referanse` ikke gir prefiks.
3. **Backfill: tall for alle tre gruppene**, også nuller.
4. **Rød-først på alle tre testene i E.**
5. **G:** mistes `subdomain` i samme vei? **Ja/nei med måling.**
6. **Gate-tall som sier hva som kjørte.**

## [6] OPPRYDDING

Cowork sletter branchen etter merge.

---

## Akseptkriterier (designgate)

| # | Krav | Bevis |
|---|---|---|
| 1 | Én delt `prefiksFraReferanse`, brukt begge steder | Diff |
| 2 | Punktum bevart (`KC3.1`, `UO2.1`) | Test |
| 3 | `firmamal.ts:970` setter prefiks eller avviser | Diff |
| 4 | Ingen vei arver `null` videre | Test 3 i E |
| 5 | Backfill rapporterer tre grupper, også tomme | Rapport |
| 6 | Tre tester, alle røde først | Rapport |
| 7 | **Ingen NOT NULL** | `git diff` på migreringen |

🔴 **Ikke i denne ordren:** NOT NULL (steg 3) · `subdomain`-tapet (mål og meld) · UI-merkingen kan splittes
til egen runde hvis den vokser.
