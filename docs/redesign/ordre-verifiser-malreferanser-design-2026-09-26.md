---
status: 🟢 ORDRE — MÅLING, ingen kodeendring. Design bestemmer etterpå
til: kode-agent (worktree og branch bestemmes av cowork)
fra: design
dato: 2026-09-26
utløst_av: design fant at malen `UM1.1` kolliderer med NS 3420-post UM1.1 «Utendørs vannledninger»
---

# Ordre: verifiser malreferansene mot NS 3420 — måling, ikke retting

🔴 **Denne ordren endrer INGEN kode og INGEN mal.** Den svarer på ett spørsmål: **betyr referansene våre det
samme i normen som hos oss?** **Design bestemmer hva som skjer etterpå.**

## [1] HVA SOM UTLØSTE DEN

**Design slo opp `kilder/ns3420/NS 3420 Del U Rørinstallasjoner.pdf` med `pdftotext` 2026-09-26:**

| Kode | I NORMEN | Hos OSS |
|---|---|---|
| `UM1` | gruppe: UM1.1 vannledninger, UM1.2 avløpsledninger, UM1.6 rennesystem | «Legging av VA-ledninger» 🟢 **treffer** |
| 🔴 `UM1.1` | **«Utendørs vannledninger»** | «Skjøt på PE-ledning for vann, **avløp og drens**» 🔴 **kolliderer** |

🔴 **Feilen er designs.** Referansen ble valgt som «UM1 pluss én» uten å slå opp hva normen alt bruker koden
til. ⚠️ **Og malreglene sier at koden BEHOLDES nettopp for å knytte malen til normen** — en kode som peker på
feil post gjør «Faglig grunnlag»-linja til en falsk sitering.

**Mistanke, IKKE bekreftet:** `UO2.1` kom opp sammen med «Utendørs drensledninger – rør av termoplast». **Vår
UO2.1 er nedgravd stengeventil.** ⚠️ **Grepet var tvetydig — det er en av kodene denne ordren skal avgjøre.**

## [2] OPPGAVE — slå opp, siter, rapporter

### 🔴 A. Kodene som skal sjekkes

**Alle maler i `seed-bibliotek.ts` med en `Faglig grunnlag`-linje.** Minst:

`UP1` · `UP2` · `UP3` · `UO2.1` · `UM1` · `UM1.1` · `UU1` · og **alle K-, J-, F-kodene** som har en
NS-referanse i beskrivelsen.

### 🔴 B. Metoden — og den er viktigere enn resultatet

```
pdftotext "<PDF>" - | grep -A4 -m1 "^<KODE>$"
```

🔴 **Bruk ANKRET søk (`^KODE$`), ikke løst.** ⚠️ **Et løst grep treffer innholdsfortegnelsen og
sidehenvisninger — design ble selv lurt av det på `UP1`/`UP2`/`UP3` og fikk bare
fragmenter.** **Treffer du innholdsfortegnelsen, si det framfor å rapportere fragmentet som en tittel.**

🔴 **Riktig PDF pr. kode:** `UP`/`UM`/`UO`/`UU` → Del U · `K` → Del K · `J` → Del J · `F`/`G` → Del F/G.
**Sjekk at du åpnet riktig del — en kode kan finnes i flere deler med ulikt innhold.**

### 🔴 C. Rapportér i ÉN tabell, med tre mulige utfall

| Utfall | Betyr |
|---|---|
| 🟢 **TREFF** | Normens posttittel dekker malens innhold. **Siter tittelen ordrett** |
| 🔴 **KOLLISJON** | Posten finnes, men betyr noe annet. **Siter begge** |
| ⚠️ **FINNES IKKE** | Ingen slik post. **Si hvilken del du lette i** |

🔴 **Siter alltid normens EGEN tittel, ordrett.** ⚠️ **En oppsummering med dine ord gjør at neste leser må
slå opp på nytt.**

⚠️ **Og rapportér også TREFFENE.** **«Vi sjekket 12 og 10 var riktige» er en måling. «Vi fant 2 feil» er et
rykte.**

### 🟡 D. Bekreft eller avkreft ÉN mistanke til — suffikseringen

**`mal.ts` `finnLedigeMalVerdier`:**
```js
for (let i = 2; prefiksBrukt.has(normMal(prefiks)); i++) prefiks = `${basisPrefiks}${i}`;
```

🔴 **Design leser den slik: ved kollisjon blir `UM1.1` → `UM1.12`, og `UM1.12` er en EKTE post i Del U.**

**Bekreft eller avkreft med en enhetstest** — ikke mot databasen. **Er det riktig, er punktum-koder en felle:
suffikseringen produserer gyldig-utseende normkoder med et annet innhold.**

⚠️ **Dette er IKKE årsaken til prefiks-problemene vi alt har funnet** — de hadde `NULL`, og årsaken er målt
til `firmamal.ts:970`. **Ikke bland dem.**

## [3] UFRAVIKELIG

- 🔴 **INGEN kodeendring. INGEN malendring. INGEN migrering.** **Bare måling.**
- 🔴 **Ikke «rett» en kollisjon du finner.** ⚠️ **Referansen er dokumentnummerets prefiks — et bytte påvirker
  hvert dokument som lages fra malen, og det er Kenneths beslutning.**
- **Kildene ligger i `SiteDoc/kilder/ns3420`** — les dem, ikke søk på nett.
  🔴 **Normteksten SITERES i rapporten og skrives ALDRI inn i en mal** (opphavsrett).
- 🔴 **Din ordre er input, ikke fasit.** ⚠️ **Finner du at designs `UM1.1`-funn er feil, SI DET.**
- **Ingen gate å kjøre** — ordren rører ingen kode. **Rapporten ER leveransen.**

## [4] FORVENTET OUTPUT

**Én tabell, én rad pr. kode, tre kolonner: vår kode · normens ordrette tittel · TREFF/KOLLISJON/FINNES IKKE.**

**Pluss:**
1. **Hvilken PDF og hvilken del** hver oppslag ble gjort i
2. **D: bekreftet eller avkreftet**, med testen
3. 🔴 **Kodene du IKKE klarte å slå opp** — ⚠️ **et uteglemt oppslag som ser ut som et treff er verre enn et
   ærlig «fant ikke»**

## [5] OPPRYDDING

**Ingen branch å slette hvis rapporten leveres i innboksen.** Trenger du en branch for et testskript, sier
cowork fra.

---

## Akseptkriterier (designgate)

| # | Krav | Bevis |
|---|---|---|
| 1 | Alle koder med NS-referanse er slått opp | Tabellen |
| 2 | Normens titler er sitert **ordrett** | Tabellen |
| 3 | Treffene er rapportert, ikke bare avvikene | Tabellen |
| 4 | Ankret søk brukt; TOC-treff meldt som TOC | Metodenotat |
| 5 | D bekreftet eller avkreftet med test | Rapport |
| 6 | **Ingen kode eller mal endret** | `git status` rent |
