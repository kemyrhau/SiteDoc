---
status: 🟢 ORDRE — liten, men på kritisk vei mot steg 3
til: kode-agent (worktree og branch bestemmes av cowork)
fra: design
dato: 2026-09-26
grunnlag: gate på feat/prefiks-paakrevd @ d88e0c48 — residual meldt av agenten selv
---

# Ordre: lukk `oppdater`-veien for prefiks

## [1] HVA SOM ER GJORT

**`feat/prefiks-paakrevd` @ `d88e0c48` lukket tre skriveveier** og er designgatet:

| Vei | Status |
|---|---|
| `firmamal.ts:997` bibliotek → firmamal | 🟢 **Rotårsaken lukket** — `prefiksFraReferanse(bibMal.referanse)` |
| `firmamal.ts:301/:314` manuell opprett | 🟢 Påkrevd |
| `firmamal.ts:613` kopi | 🟢 Utleder framfor å arve `null` |
| 🔴 **`firmamal.ts:360` oppdater** | 🔴 **ÅPEN** — `prefix: z.string().max(40).nullable().optional()` |

🟢 **Agenten fant og MELDTE residualen framfor å utvide seg selv utenfor ordren.** ⚠️ **Gapet var i designs
ordre: den navnga opprett og kopier, ikke oppdater.**

## [2] HVORFOR DEN IKKE KAN VENTE

🔴 **En firmamal kan i dag opprettes med påkrevd prefiks og deretter NULLES av en oppdatering.**

**To følger, og den andre er den alvorlige:**
1. **Backfillen kan undgjøres stille** — radene `20260926140000_prefiks_backfill` fylte, kan tømmes igjen
2. 🔴 **Steg 3 (NOT NULL) kan ikke trygt forsøkes** så lenge denne veien står åpen. **Migreringen ville feilet
   på rader som ble nullet etter backfillen** — og en feilet migrering midt i `migrate deploy` er den dyreste
   feilklassen vi har

⚠️ **Residualen ligger på kritisk vei mot den endelige tilstanden, ikke ved siden av den.**

## [3] OPPGAVE

### 🔴 A. `firmamal.ts:360` — prefiks kan ikke nulles

**Fjern `.nullable()`.** Feltet forblir `.optional()` — **å la være å sende prefiks er lov** (da endres den
ikke). **Å sende `null` er det ikke.**

```
prefix: z.string().max(40).optional()      ← ikke .nullable()
```

⚠️ **Sjekk mappingen på samme sted:** står det `input.prefix?.trim() || null`, gir tom streng fortsatt `null`.
🔴 **Tom streng skal avvises av Zod, ikke oversettes til null i mappingen.** Bruk samme form som
`d88e0c48` valgte for opprett — **TS2589-fella gjorde at `.trim()` ble byttet til `.regex(/\S/)` der.**
**Gjenbruk den formen; ikke finn opp en tredje.**

### 🔴 B. Samme gjennomgang for `report_templates`

**Ordren for firmamal lukket firmamal-siden.** 🔴 **Mål om `mal.ts` har samme hull i sin `oppdater`.**

⚠️ **Ikke anta symmetri. Mål.** Finner du det, lukk det i samme runde — **det er samme feilklasse, og å dele
den i to runder gir en halv garanti.** **Finner du det ikke, skriv det i rapporten.**

### 🔴 C. Test som FEILER hvis veien åpnes igjen

**Minst to, begge røde først:**
1. `oppdater` med `prefix: null` → **avvist**
2. `oppdater` med `prefix: ""` → **avvist**

🟢 **Og én som skal PASSERE:** `oppdater` **uten** `prefix` i input → prefikset står uendret.
⚠️ **Uten den tredje kan noen «fikse» testen ved å gjøre feltet påkrevd, og da knekker enhver oppdatering som
bare endrer navnet.**

## [4] UFRAVIKELIG

- **Arbeidstre + branch:** cowork bestemmer.
- **Filer:** `apps/api/src/routes/firmamal.ts` · evt. `apps/api/src/routes/mal.ts` (kun hvis B finner noe) ·
  tester. 🔴 **Ingen migrering. Ingen NOT NULL.**
- 🔴 **Web-siden røres KUN hvis typene tvinger det.** ⚠️ **`d88e0c48` måtte røre `FirmaarkivFane.tsx` som
  følge av påkrevd input — samme kan skje her. Meld det, ikke skjul det.**
- 🔴 **Din ordre er input, ikke fasit — mål premisset selv.** Linjenummer målt på `d88e0c48`.
- 🔴 **Sjekk treets alder før du melder et fravær.**
- **Forsteg:** `pnpm install` + `prisma generate` ×4. ⚠️ **Fire agenter har gått i den samme på fem dager.**
- **Gate:** `pnpm test` fra ROT · kald web-build · mobil-typecheck · `tsc --noEmit`.

## [5] FORVENTET OUTPUT

1. **Diffen på `:360`**, og hvilken form mappingen fikk.
2. **B: ja eller nei med måling** — har `mal.ts` samme hull?
3. **Rød-først på begge avvisnings-testene**, og at den tredje passerer.
4. **Rørte du web: hvilken fil og hvorfor.**
5. **Gate-tall som sier hva som kjørte.**

## [6] OPPRYDDING

Cowork sletter branchen etter merge.

---

## Akseptkriterier (designgate)

| # | Krav | Bevis |
|---|---|---|
| 1 | `oppdater` kan ikke sette prefiks til `null` | Test 1 |
| 2 | Tom streng avvises av **Zod**, ikke oversettes i mappingen | Test 2 + diff |
| 3 | Oppdatering **uten** prefiks lar den stå | Test 3 |
| 4 | `mal.ts` målt — hull lukket eller fravær dokumentert | Rapport |
| 5 | Ingen migrering, ingen NOT NULL | `git diff` |

🔴 **Når denne er inne, er steg 3 (NOT NULL) først da mulig å vurdere — og den skal bestilles separat av
Kenneth.** ⚠️ **Ellers blir «midlertidig nullable» permanent, slik 24-timers-signaturen nesten ble.**
