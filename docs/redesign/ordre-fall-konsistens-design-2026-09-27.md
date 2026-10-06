---
status: 🟢 ORDRE — konsistens, ikke retting. Mal avgjør retningen
til: mal-Opus (maløypa — direkte fra design)
fra: design
dato: 2026-09-27
grunnlag: kontrollplans MK C-måling 2026-09-26 — de to ble skilt ut som «§1-migrerings-inkonsistenser, ikke skjønns-L»
---

# Ordre: KB2 «Fall minst 2 %» og KD1 «Fall mot avrenning» — samme svarform som søsknene

## [1] 🔴 FØRST: dette er IKKE et §1-brudd

**§1 sier ordrett:** «Krav mot en flate som varierer (fall, planhet) besvares med samsvar — **trafikklys ELLER
enkeltvalg per kravnivå** — og målt verdi/sted hører i kommentaren.»

🔴 **Trafikklys er altså en GYLDIG §1-form for disse to.** ⚠️ **Ordren bestiller ikke en retting av noe galt.**

**Saken er at søsknene ble konvertert og disse ikke.** Målt:

| Felt | Form i dag |
|---|---|
| `KB2` planhet (rett over `:1227`) | 🟢 **Konvertert** — tabell med rad pr. dekketype, «velg raden for dekketypen» |
| 🔴 `KB2:1227` «Fall minst 2 % mot avrenning» | `trafikklys` |
| 🔴 `KD1:352` «Fall mot avrenning» | `trafikklys` |

⚠️ **Samme malformede krav besvares to ulike veier i samme mal.** **En utfyller ser ikke hvorfor, og en leser
i et sluttoppgjør ser to ulike svarformer på samme slags kontroll.**

🟢 **Og begge følger ALT §1s kommentardisiplin:** «Ved avvik: noter målt fall og sted i kommentaren» står i
begge hjelpetekster. **Det leddet er på plass.**

## [2] 🔴 AVVEININGEN — og den er din

**KD1:352 har TRE kravnivåer i hjelpeteksten:** gangareal ≥ 2 % · kjøreareal ≥ 2,5 % · gatestein ≥ 3 %
(+ permeabelt belegg: står i beskrivelsen).
**KB2:1227 har ETT nivå** (≥ 2 %) med unntaket «med mindre beskrivelsen sier noe annet».

**For:** `valg` pr. kravnivå gjør kravet synlig i dokumentet. 🔴 **Hjelpeteksten følger IKKE med i
arkiv-PDF-en** — målt 2026-09-27: `packages/pdf` rendrer `felt.verdi`, `felt.kommentar`, `felt.vedlegg`,
`felt.grenseSnapshot` og `objekt.label`, **men ingen hjelpetekst.** ⚠️ **Et «grønt» sier ingenting om hvilket
kravnivå som gjaldt. «Innenfor — kjøreareal ≥ 2,5 %» sier det.**

**Mot:** trafikklyset har en midttilstand. **Med huskonvensjonen som kommer** (Godkjent · Anmerkning · Avvik ·
Ikke relevant) **mister en to-valgs `valg` muligheten for «Anmerkning»** — f.eks. fall målt til 1,9 % innenfor
måleusikkerhet.

🔴 **Design anbefaler `valg` pr. kravnivå for KD1:352**, fordi tre nivåer i en hjelpetekst som forsvinner er
det tydeligste tapet. **For KB2:1227 er design i tvil** — ett nivå gir lite å velge mellom.

⚠️ **Du avgjør begge, og du begrunner hver for seg.** 🟢 **Du har gått foran ordren min før og hatt rett.**

## [3] OPPGAVE

### 🔴 A. Avgjør form pr. felt, og skriv begrunnelsen

**Velger du `valg`:** én opsjon pr. kravnivå + «Avvik». ⚠️ **Behold «noter målt fall og sted i kommentaren» —
det er §1-leddet som gjør tallet etterprøvbart.**

**Velger du å beholde `trafikklys`:** 🔴 **da skal søskenfeltet vurderes den andre veien i stedet** — ellers
består inkonsistensen. **Meld det som funn framfor å la det ligge.**

### 🔴 B. Opsjonsnavn må bære sin egen mening

🔴 **Hjelpeteksten overlever ikke inn i dokumentet** (målt, se § 2). **Opsjonen er alt en leser ser om to år.**

⚠️ **«Innenfor» alene er utilstrekkelig når tre nivåer finnes.** **«Innenfor — kjøreareal (≥ 2,5 %)» bærer
kravet med seg.**

🟢 **Samme prinsipp som `maleverdi-opprinnelse.md`:** verdien må bære sin mening **der den leses**.

### 🟡 C. Hvis du konverterer: kjør KB4-testen på de nye tekstene

**Ber noen av de nye hjelpetekstene om en tilstand opsjonene ikke har?** 🟢 **Design kjørte testen over hele
seeden 2026-09-26** — men **dine nye tekster er ikke testet.**

## [4] UFRAVIKELIG

- **Maløypa: direkte design ↔ mal.** Cowork får kopi.
- **Filer:** `seed-bibliotek.ts` · testfiler for KB2 og KD1 · `mal-fasit.snap.md`. **Ingen andre.**
- 🔴 **To revisjoner, versjon +1 hver** (§6a). **SQL genereres, skrives aldri for hånd.** **Kenneth kjører ÉN
  gang mot test.**
- 🔴 **Rør IKKE søskenfeltene** med mindre du velger «behold trafikklys» — da er det hele poenget, og du melder
  det først.
- 🔴 **Ikke rør FB4/FD3** — de har egen ordre (`9b487c98`) og er gammel-stil.
- 🔴 **Din ordre er input, ikke fasit.** ⚠️ **Særlig her: design anbefaler ulikt for de to feltene, og er i tvil
  om det ene.**

## [5] FORVENTET OUTPUT

1. **Form valgt pr. felt, med begrunnelse** — og hvis «behold», hva som skjer med søskenkonsistensen
2. **Opsjonsnavnene**, og at de bærer kravnivået
3. **C: KB4-testen på nye tekster — traff den?**
4. **0 dangling `parent_id` + idempotens-guard**
5. **Gate-tall**

---

## Akseptkriterier (designgate)

| # | Krav | Bevis |
|---|---|---|
| 1 | Samme slags krav besvares samme vei i samme mal | Fasit-diff |
| 2 | Opsjonsnavnet bærer kravnivået — ikke bare «Innenfor» | Seed |
| 3 | «Noter målt fall og sted i kommentaren» beholdt | Seed |
| 4 | Valget begrunnet **pr. felt** | Rapport |
| 5 | Søskenfeltene urørt, eller endringen meldt først | `git diff` |
