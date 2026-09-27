---
status: 🟢 ORDRE — steg 0 BESVART 2026-09-27. Utvidet med del E (fallback). Erstatter `9ed6c177`
til: kode-agent (worktree og branch bestemmes av cowork)
fra: design
dato: 2026-09-27
kenneth_vedtak: 2026-09-27 — «fjern grå fra META-defaulten»
---

# Ordre: fjern `gray` fra trafikklyset — én kontroll, tre tilstander

## [1] HVA SOM ER MÅLT — og hvorfor det ikke ble to trafikklys

**Kenneth spurte om vi burde ha TO typer:** én med grønn/gul/rød, og én med alle fire.
🔴 **Design anbefaler NEI, og begrunnelsen er empirisk, ikke prinsipiell.**

| Måling | Tall |
|---|---|
| Maler som bruker `gray` i dag | 🔴 **0** |
| «Ikke aktuelt/relevant» løst som OPSJONSTEKST i `valg` | 🟢 **20** |
| — av dem **med begrunnelse** | 4: «(grasbakke/eng)» · «– ingen fundament» · «– ensidig mur» · «– avrettes uten tilføring» |

🔴 **Den fjerde tilstanden er erklært, rendret — og aldri tatt i bruk.** ⚠️ **Produktet har løst «ikke
relevant» tjue ganger, hver gang som en opsjon, aldri som en grå knapp.**

🟢 **Og fire av dem bærer HVORFOR.** **En grå knapp kan ikke det.** **Hjelpeteksten overlever ikke inn i
arkivdokumentet** (målt 2026-09-27: `packages/pdf` rendrer `verdi`, `kommentar`, `vedlegg`,
`grenseSnapshot`, `label` — ingen hjelpetekst), **så «Ikke relevant» uten begrunnelse er tomt i et
sluttoppgjør.**

### 🔴 Og kostnaden ved en andre type

**Fargeetikettene lever alt i FEM filer** (`types/index.ts` · `standardtekster.ts` · web-rendereren ·
`packages/pdf/konstanter.ts` · `nb.json`). ⚠️ **En andre trafikklys-type ville doblet den flaten før vi har
konsolidert den første.**

### 🟡 Hva som ville snudd anbefalingen

**Om MANGE trafikklys trengte en bar «ikke relevant», ville en fjerde farge vært billigere enn å konvertere
dem alle.** 🔴 **Målingen sier det motsatte:** MK C gikk gjennom **47** felt og fant **3** som trengte det.

## [2] 🔴 STEG 0 — SQL FØR NOE BYGGES. Kenneth kjører

**`gray` er rendret i `TrafikklysObjekt.tsx` på begge flater. Noen KAN ha valgt den.**
🔴 **Fjerner vi rendringen med lagrede grå-verdier i basen, blir de foreldreløse — et felt som viser
ingenting.**

```
ssh -t server-ny "sudo docker exec postgres psql -U sitedoc -d sitedoc_test -c \"SELECT (SELECT count(*) FROM checklists WHERE data::text LIKE '%\\\"gray\\\"%') AS sjekklister, (SELECT count(*) FROM tasks WHERE data::text LIKE '%\\\"gray\\\"%') AS oppgaver;\""
```

⚠️ **Grovt tekstsøk — det kan gi FALSKE POSITIVE** (strengen «gray» kan stå i en kommentar eller et filnavn).
🟢 **Men en NULL er konklusiv: da finnes ingen lagret grå verdi noe sted.**

| Svar | Følge |
|---|---|
| **0 og 0** | 🟢 **Bygg A og B. Ingen migrering.** |
| **Over 0** | 🔴 **STOPP og meld.** **Da trengs en plan for de radene FØR rendringen fjernes** |

**Kjør samme spørring mot prod (`-d sitedoc`) i samme runde.**

## [2b] 🟢 STEG 0 ER BESVART — og funnet endret ordren

**Kenneth kjørte 2026-09-27, test og prod:**

| Base | Treff |
|---|---|
| `sitedoc_test` | **1 sjekkliste** — `KB6 – Planting`, felt `b720d925…`: `"verdi": "gray"` |
| `sitedoc` (prod) | 🟢 **0 og 0** |

🟢 **Prod er ren. Fjerningen er trygg for produksjonsdata.**

### 🔴 Men den ene raden avdekket noe større enn grå

**`TrafikklysObjekt.tsx:16`:**
```js
const valgtVerdi = typeof verdi === "string" ? verdi : null;
```

**Verdien sammenlignes mot opsjonene som rendres.** 🔴 **Fjernes «gray» fra opsjonene, matcher den lagrede
verdien INGENTING — og feltet ser UBESVART ut.**

⚠️ **Ikke en krasj. Noe verre i et dokumentasjonsprodukt: et svar som forsvinner stille.**

🔴 **Og det gjelder ikke bare grå.** **`Checklist.templateId` er en LEVENDE FK til `ReportTemplate`** — ingen
frossen kopi, ingen versjonssnapshot (`schema.prisma`, modell `Checklist`).

🟢 **Bibliotekrevisjoner er trygge** — prosjektmalen er en kopi laget ved opprettelse.
🔴 **Men redigeres en PROSJEKTMALS opsjoner mens utfylte sjekklister peker på den, forsvinner svarene stille.**
⚠️ **Samme mekanisme. Grå er bare det tilfellet vi oppdaget.**

## [3] OPPGAVE — etter grønt lys på steg 0

### 🔴 A. Fjern `gray` fra META-defaulten

`packages/shared/src/types/index.ts` — fjern `{ value: "gray", label: "Ikke relevant" }` fra
`traffic_light.defaultConfig.options`.

### 🔴 B. Fjern grå-knappen fra begge renderere

`apps/web/src/components/rapportobjekter/TrafikklysObjekt.tsx` og mobil-ekvivalenten.
⚠️ **Begge har 3 treff på `gray` — mål at alle tre er tilstands-relatert og ikke Tailwind-klasser før du
fjerner.**

🔴 **Design gikk selv i den fella:** et grep ga «40 treff på gray» i en fil der alle var `bg-gray-*`.
**Bruk presise mønstre.**

### 🔴 C. Test som hindrer at den kommer tilbake

**En test som FEILER hvis `traffic_light.defaultConfig.options` inneholder `gray`.**

⚠️ **Uten den er fjerningen en engangshandling.** 🟢 **Med den er den en tilstand.**

### 🟡 D. Og skriv regelen der den hører

**Legg én linje i `MAL-METODE`:** 🔴 **trenger en kontroll en «ikke relevant»-tilstand, er den et `valg`
med opsjonstekst som sier HVORFOR — ikke et trafikklys.**

**Belegg: 20 forekomster løst slik, 0 via grå.** ⚠️ **Uten linja tar noen valget på nytt om et halvår, og da
er det tilfeldig hvem som måler.**

### 🔴 E. Fallback for ukjent verdi — dette er den EGENTLIGE fiksen

🔴 **Før `gray` fjernes: rendereren må VISE en lagret verdi den ikke kjenner igjen.**

**Krav:** er `valgtVerdi` en streng som ikke finnes blant opsjonene, skal feltet vise det — **ikke se
ubesvart ut.**

**Form (agenten velger, men den skal være synlig og lesbar):**
- en ekstra, deaktivert brikke med den rå verdien, eller
- en linje under kontrollen: «Lagret verdi: `gray` — ikke lenger et gyldig valg»

⚠️ **Og den skal med i arkiv-PDF-en.** 🔴 **`packages/pdf` rendrer `felt.verdi` — sjekk at en ukjent verdi
ikke faller ut der heller.** **Et dokument som mister et svar ved en malendring er det dyreste utfallet vi
har.**

🟢 **Med E på plass trenger den ene test-raden ingen opprydding** — verdien blir synlig i stedet for borte.
**Ingen UPDATE mot databasen. Ingen migrering.**

🔴 **E skal bygges FØR A og B.** ⚠️ **Fjerner du grå først, har du skapt nøyaktig den tilstanden E beskytter
mot — og du har gjort det med åpne øyne.**

### 🟡 F. Meld videre, ikke fiks

**`oppdaterMal` lar en prosjektmals opsjoner endres mens utfylte sjekklister peker på den.** 🔴 **Mål om det
finnes en vakt** (`mal-endringsvern`, `kontrollpunkt-laasning` finnes som saker). **Finnes den ikke, MELD
det — ikke bygg den.** **Egen sak med egen beslutning.**

## [4] UFRAVIKELIG

- 🔴 **Bygg ingenting før steg 0 er besvart.**
- **Filer:** `types/index.ts` · `TrafikklysObjekt.tsx` (web + mobil) · test · `MAL-METODE.md`. **Ingen andre.**
- 🔴 **Rør IKKE de tre MK C-konverteringene** (`acbe1bdf`). ⚠️ **De er ikke overflødige selv om grå finnes —
  opsjonsteksten bærer begrunnelsen, og grå kan ikke det.**
- 🔴 **Ingen migrering** med mindre steg 0 finner lagrede verdier.
- 🔴 **Din ordre er input, ikke fasit — mål premisset selv.**
- **Gate:** `pnpm test` fra ROT · kald web-build · mobil-typecheck · `tsc --noEmit`.

## [5] FORVENTET OUTPUT

1. **Steg 0-tallene, test OG prod**
2. **At alle `gray`-treff du fjernet var tilstands-relaterte** — vis søket
3. **Testen i C, rød først**
4. **Gate-tall**

---

## Akseptkriterier (designgate)

| # | Krav | Bevis |
|---|---|---|
| 1 | 🔴 **E bygget FØR A og B** | Rekkefølge i commits |
| 1b | Ukjent verdi vises i UI **og** i PDF | Test |
| 2 | `gray` borte fra META-default og begge renderere | Diff |
| 3 | Ingen Tailwind-klasse fjernet ved uhell | Søk |
| 4 | Test som feiler hvis `gray` kommer tilbake | Rød først |
| 5 | Regelen i MAL-METODE | Diff |
| 6 | MK C-konverteringene urørt | `git diff` |
