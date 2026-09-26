---
status: 🟢 ORDRE — RETTET 2026-09-26 (se § 1). Del D er en Kenneth-beslutning. Erstatter `2201bc6c`
til: kode-agent (worktree og branch bestemmes av cowork)
fra: design
dato: 2026-09-26
grunnlag: designgate på MK C-konverteringslista 2026-09-26 + designs måling av fargeetikettene
---

# Ordre: én kilde for trafikklys-konvensjonen, og kommentar ved Anmerkning/Avvik

## [1] HVA SOM ER MÅLT — og designs premiss var delvis feil

**Design antok at trafikklysets midterste tilstand var UDEFINERT. Målingen viser at den er definert — bare
ikke ett sted, og ikke for mennesker.**

**`types/index.ts:173-180` (META-default):**

| Verdi | Etikett |
|---|---|
| `green` | **Godkjent** |
| `yellow` | **Anmerkning** |
| `red` | **Avvik** |
| `gray` | **Ikke relevant** |

🟢 **Konvensjonen er altså alt bestemt, og den er god.** ⚠️ **Men den bor bare i kode, og i FEM eksemplarer.**

### 🔴 Fem kilder til én konvensjon

| Fil | Hva den bærer |
|---|---|
| `packages/shared/src/types/index.ts` | META-default med de fire verdiene |
| `packages/shared/src/standardtekster.ts` | **Sier selv: «labelen bor i hardkodede maps i renderne»** (`:21`) |
| `apps/web/src/components/RapportObjektVisning.tsx` | Egen map `:14-16` |
| `packages/pdf/src/konstanter.ts` | Egen for PDF |
| `packages/shared/src/i18n/nb.json` | i18n-nøkler |

🔴 **SAMARBEIDSREGLER § «DELT LOGIKK SKAL NAVNGIS I ORDREN — ellers fødes den femte kopien».**
⚠️ **Den femte er alt født. Denne ordren skal ikke lage den sjette.**

### 🔴 RETTET 2026-09-26 — `gray` RENDRES. Designs første måling var i feil fil

⚠️ **Førsteversjonen av denne ordren påsto at `gray` aldri rendres. Det er FEIL.**

**Målt på nytt: `TrafikklysObjekt.tsx` finnes i BÅDE `apps/web` og `apps/mobile`, og begge rendrer grå.**
🔴 **Design målte i `RapportObjektVisning.tsx` og `RapportObjektRenderer.tsx` — men aldri i selve
kontrollelementet.**

⚠️ **En måling i feil fil er ikke en svakere måling. Den er en gjetning med kildehenvisning.**

🟢 **Konsekvens: trafikklyset har FIRE reelle tilstander, og «Ikke relevant» KAN velges.**

### 🔴 Og mekanismen for «krever kommentar» finnes IKKE — målt av cowork

- **Ingen config-nøkkel på `traffic_light`**
- **`TrafikklysObjekt.tsx` rendrer kun fire fargeknapper** på begge flater
- **Kommentarfeltet er alltid valgfritt**
- **`statusKreverBegrunnelse` gjelder DOKUMENT-status, ikke felt-farge** — den kan ikke gjenbrukes

🔴 **Del C nedenfor er derfor ikke «mål om den finnes» — den er «bygg den».** ⚠️ **Og det gjør ordren til en
tverr-flate-feature: config + web + mobil + server + test.** **Ikke en dokumentasjonsordre.**

## [2] OPPGAVE

### 🔴 A. Én kilde — før noe annet

**Fargeetikettene skal komme fra ÉTT sted.** 🔴 **Mål først hvilke av de fem som faktisk kan lese en delt
kilde** — `packages/pdf` har null avhengigheter (CLAUDE.md), så den kan ha en reell begrensning.

⚠️ **Finner du at PDF-pakken ikke kan importere fra shared uten å bryte null-avhengighet-regelen: MELD DET
framfor å bryte regelen.** **Da er svaret to kilder med en test som binder dem, ikke én kilde med et unntak.**

### 🔴 B. Skriv konvensjonen ned der mennesker leser

**Ny fil: `docs/claude/retningslinjer/trafikklys-konvensjon.md`.**

**Innholdet finnes alt — dette er å flytte, ikke å finne opp:**

| Farge | Betyr | Krever kommentar |
|---|---|---|
| 🟢 Grønn | **Godkjent** — utført som beskrevet | Nei |
| 🟡 Gul | **Anmerkning** — avvik som ikke stopper videre arbeid | 🔴 **Ja** |
| 🔴 Rød | **Avvik** — ikke utført, eller avvik som stopper arbeidet | 🔴 **Ja** |

⚠️ **Og skriv HVORFOR:** et gult felt ingen vet betydningen av, er ikke etterprøvbart i et sluttoppgjør.
**Det er hele begrunnelsen, og uten den blir regelen tolket bort.**

### 🔴 C. Kommentar ved Anmerkning og Avvik

🔴 **MÅL FØRST om en kommentar-mekanisme pr. felt finnes.** Design fant ingen i `types/index.ts`, **men
MK C-lista nevner at «avviksfeltet utløses automatisk ved brudd» for grensefelt** — **den mekanismen kan være
gjenbrukbar.**

- **Finnes den:** gjenbruk. **Ikke bygg en andre.**
- **Finnes den ikke:** 🔴 **foreslå form og STOPP.** ⚠️ **Ikke bygg en ny felttype på eget initiativ.**

⚠️ **Og kravet gjelder NYE utfyllinger.** 🔴 **Eksisterende dokumenter skal IKKE bli ugyldige** — de er
signert dokumentasjon. **En retroaktiv validering ville gjort ferdige sjekklister røde.**

### 🔴 D. `gray` — Kenneth-beslutning, bygg ikke før svar

**META-defaulten erklærer «Ikke relevant». Ingen flate viser den.**

| Valg | Følge |
|---|---|
| **Fjern fra META-defaulten** | Ærlig: produktet har tre tilstander |
| **Vis den i rendererne** | Gir en reell fjerde tilstand — **og svekker noen av MK C-lista sine `list_single`-begrunnelser** |

🔴 **Design anbefaler IKKE et valg her — det er et produktvalg.** ⚠️ **Men å la en erklært tilstand stå
usynlig er det eneste alternativet som er galt uansett hva Kenneth mener.**

## [3] UFRAVIKELIG

- 🔴 **Ingen ny felttype.** **Ingen migrering.**
- 🔴 **`packages/pdf` har NULL avhengigheter** (CLAUDE.md § Prosjektstruktur). **Bryt det ikke — meld i stedet.**
- **i18n:** ⚠️ **`nb.json`/`en.json` er høytrafikk. Meld til cowork før du rører dem.**
- 🔴 **Din ordre er input, ikke fasit — mål premisset selv.** ⚠️ **Designs eget premiss om at midttilstanden
  var udefinert, VAR feil. Mål på nytt.**
- 🔴 **Sjekk treets alder før du melder et fravær.** ⚠️ **«0 treff på gray» ble først målt til 40 — det var
  Tailwind-klasser. Bruk presise mønstre.**
- **Gate:** `pnpm test` fra ROT · kald web-build · mobil-typecheck · `tsc --noEmit`.

## [4] FORVENTET OUTPUT

1. **A: hvilke av de fem kildene som ble slått sammen, og hvilke som ikke kunne — med begrunnelse**
2. **C: finnes kommentar-mekanismen? Ja → gjenbrukt. Nei → forslag, ikke bygget**
3. **At eksisterende dokumenter IKKE blir ugyldige** — vis hvordan
4. **D: urørt, venter på Kenneth**
5. **Gate-tall**

---

## Akseptkriterier (designgate)

| # | Krav | Bevis |
|---|---|---|
| 1 | Fargeetikettene har **én** kilde, eller to med en test som binder dem | Diff |
| 2 | Konvensjonen finnes i `retningslinjer/`, med begrunnelsen | Fil |
| 3 | Anmerkning/Avvik krever kommentar **for nye utfyllinger** | Test |
| 4 | **Eksisterende dokumenter uendret** | Test |
| 5 | Ingen ny felttype, ingen migrering | `git diff` |
| 6 | `gray` urørt | `git diff` |
