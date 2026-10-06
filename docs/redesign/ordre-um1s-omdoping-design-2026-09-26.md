---
status: 🟢 ORDRE — Kenneth-vedtak 2026-09-26: «ja til UM1S»
til: mal-Opus (maløypa)
fra: design
dato: 2026-09-26
grunnlag: verifiseringsrunden mot NS 3420 (mal, 2026-09-26) — 26 koder, 25 treff, 1 kollisjon
---

# Ordre: `UM1.1` → `UM1S`, og grunnlagslinjene rettes

## [1] HVA SOM ER MÅLT

**Din verifiseringsrunde: 26 koder, 25 treff, 1 kollisjon.** 🟢 **De 24 rene treffene står — ingen skal røres.**

| Kode | Funn |
|---|---|
| 🔴 `UM1.1` | **KOLLISJON.** Normen: «Utendørs vannledninger» (kun vann). Vår: skjøt på PE for vann, avløp **og drens** |
| 🟢 `UO2.1` | **Mistanken AVKREFTET.** Brødtekst: «Utendørs stengeventiler» = vår «Nedgravd stengeventil». Design verifiserte det selv |
| 🟡 `FJ1` | Treff med merknad — posten er «vannlensing», malen dekker hele kap. FJ «Vannhåndtering» |
| 🟡 `FD1` | Treff med merknad — posten er «generelle gravenivåer», ikke «byggegrop» |

🔴 **Kollisjonen er designs feil.** `UM1.1` ble valgt som «UM1 pluss én» uten oppslag.

## [2] OPPGAVE

### 🔴 A. `UM1.1` → `UM1S`

**Ny referanse: `UM1S`.** Verifisert av design: **0 treff i Del U.**

🟢 **Hvorfor bokstav og ikke nytt punktum-ledd:** din del D viste at `finnLedigeMalVerdier` gjør `UM1.1` →
`UM1.12` ved kollisjon, **og `UM1.12` er en ekte post.** ⚠️ **En bokstav etter tallet kan ikke forveksles med
en postkode på samme måte.**

- **Referanse:** `UM1S`
- **Navn:** `UM1S – Skjøt på PE-ledning` *(uendret tekst, ny kode)*
- 🔴 **Alt annet i malen er UENDRET.** **Ingen felt, ingen hjelpetekster, ingen struktur.** ⚠️ **Dette er en
  omdøping, ikke en revisjon.**

### 🔴 B. Grunnlagslinja i `UM1S`

**Fra:** `Faglig grunnlag: NS 3420-U:2019, post UM1.1.`
**Til:** `Faglig grunnlag: NS 3420-U:2019, postgruppe UM1.`

🔴 **Fordi skjøter ikke har egen post** — de ligger inne i hver ledningstype-post (UM1.1 vann, UM1.2 avløp).
**Malen dekker gruppen, og skal sitere gruppen.**

### 🟡 C. Samme rettelse i `FJ1` og `FD1` — grunnlagslinja, ikke koden

🔴 **Kodene er riktige og skal IKKE byttes.** Kun grunnlagslinja:
- **`FJ1`** → `postgruppe FJ` (malen dekker kapittelet, posten er kun vannlensing)
- **`FD1`** → **sjekk om «post FD1» faktisk dekker malens innhold.** Gjør den det, la linja stå.
  ⚠️ **Gjør den ikke, bruk gruppen. Meld hvilken du valgte og hvorfor.**

### 🔴 D. Regelen er skrevet inn — les den

**MAL-METODE §1g og §1g-b** (samme branch som denne ordren): gruppe siteres når malen dekker en gruppe, og
**enhver ny referanse slås opp i normen FØR den velges.**

⚠️ **§1g-b bærer din metodelærdom:** `-m1` er ikke nok — første treff er innholdsfortegnelsen. **Og at Del K
og F mangler tekstlag står der nå, så neste leser ikke tror alle 26 er verifisert likt.**

## [3] UFRAVIKELIG

- **Maløypa: direkte design ↔ mal.** Cowork får kopi.
- **Filer:** `seed-bibliotek.ts` · `um1-1-mal.test.ts` (**døpes om**) · `mal-fasit.snap.md`. **Ingen andre.**
- 🔴 **Dette er en omdøping. Rører du feltinnhold, er det et avvik** — meld det framfor å gjøre det.
- 🔴 **SQL: Kenneth kjører ÉN gang mot test.** ⚠️ **Malen finnes alt i test som `UM1.1`** — **SQL-en må
  håndtere omdøpingen, ikke bare sette inn på nytt.** **Meld hvilken form du valgte.**
- 🟢 **Ingen dokumenter er laget fra `UM1.1`** — derfor er dette trygt nå.
- 🔴 **Din ordre er input, ikke fasit.**

## [4] FORVENTET OUTPUT

1. **Fasit-diffen viser KUN referanse + grunnlagslinje endret** — ingen feltendringer
2. **`FD1`: hvilken linje du valgte, og hvorfor**
3. **SQL-formen for omdøpingen**
4. **Gate-tall**

---

## Akseptkriterier (designgate)

| # | Krav | Bevis |
|---|---|---|
| 1 | `UM1S` erstatter `UM1.1` — kode og navn | Seed |
| 2 | Grunnlagslinja sier **postgruppe UM1** | Seed |
| 3 | **Ingen feltendring** i malen | Fasit-diff |
| 4 | `FJ1` rettet, `FD1` vurdert og meldt | Rapport |
| 5 | `UO2.1` og de 24 andre **urørt** | Fasit-diff |

🔴 **Ikke i denne ordren:** suffikseringsfiksen i `mal.ts` — **det er kode, ikke mal.** Design melder den
separat til cowork.
