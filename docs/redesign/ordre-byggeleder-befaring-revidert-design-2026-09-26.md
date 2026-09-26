---
status: 🟢 ORDRE — BEF-A klar nå. BEF-B venter på steg 3 (bundet repeater)
til: mal-Opus (maløypa — direkte fra design)
fra: design
dato: 2026-09-26
erstatter: ordre-byggeleder-befaringsrapport-design-2026-09-22.md (🔴 DØD — bygg ikke fra den)
---

# Ordre: byggeleders befaringsrapport — revidert

🔴 **`ordre-byggeleder-befaringsrapport-design-2026-09-22.md` er DØD.** Den bestilte fire maler
(`BEF1`/`BEF2`/`AVV1`/`AVV2`) på en struktur som ikke finnes. **Bygg ikke fra den.**

## [1] HVA SOM ER MÅLT 2026-09-26

**Av den bestilte kapasiteten er tre av fire ledd inne:**

| Ledd | Status |
|---|---|
| Steg 1 — område-admin | 🟢 `OmradeAdmin.tsx` |
| Steg 2 — `type: "trase"` | 🟢 `omrade.ts:13` — `z.enum(["sone","rom","etasje","trase"])` |
| Steg 2b — område som lokasjonsnivå | 🟢 `20260923120000_omrade_lokasjonsniva`, `omradeId` på Checklist/Task |
| 🔴 **Steg 3 — bundet repeater** | 🔴 **IKKE bygget.** 0 treff |

## [2] 🔴 HVORFOR REPEATEREN IKKE KAN ERSTATTES

**Design vurderte å droppe repeateren og bruke ett dokument pr. trasé** — det er mulig i dag, og gir
filtrerbare dokumenter.

🔴 **Kenneths egne ord avviser det:**

> *«ingen arbeid pågår i Austadvegen → alle barn under austadvegen er kolapset, ingen oppgave for austadvegen
> opprettes»*

⚠️ **Det er ÉN rapport med kollapsede rader — ikke fire rapporter man hopper over.** **Og settet av traséer er
pr. PROSJEKT, mens en mal er delt.** 🔴 **Nettopp derfor er en repeater bundet til prosjektets områder riktig
primitiv, og ikke en teknisk bekvemmelighet.**

**Design snudde her.** Førsteversjonen av dette avsnittet foreslo N dokumenter. **Det ville byttet bort
Kenneths arbeidsflyt mot noe som var lettere å bygge.**

## [3] DELINGEN — hva som bygges nå

| Mal | Innhold | Avhengighet |
|---|---|---|
| 🟢 **BEF1** | Befaring av **ett** område/trasé — veg og VA | **Ingen. Bygges nå** |
| 🟢 **BEF2** | Samme for **bygg** — etasje/sone i stedet for trasé | **Ingen. Bygges nå** |
| 🔴 **BEF3** | Befaring over **flere** traséer, bundet liste | 🔴 **Steg 3. IKKE bestilt** |
| ~~AVV1/AVV2~~ | — | 🔴 **UTGÅR** |

### 🔴 Hvorfor AVV1/AVV2 utgår

> **Kenneth 2026-09-22:** *«vi har flere former for avvik. KS-avvik / HMS-Avvik … men du har tatt mine
> kommentarer litt for ordrett. vi benytter ikke til daglig produksjonssavvik som en term»*

🔴 **Avviksflytene finnes alt.** Å lage to nye maler for noe systemet dekker, ville gitt byggelederen tre veier
til samme handling. ⚠️ **Et avvik oppdaget på befaring registreres i den avviksflyten som alt gjelder — ikke i
en befaringsspesifikk kopi.**

## [4] OPPGAVE — BEF1 og BEF2

### Felles form

- **Referanse:** `BEF1` og `BEF2`. 🔴 **Korte med vilje** — referansen blir dokumentnummerets prefiks
  (`prefiksFraReferanse`), så `BEFARING-A` ville gitt `BEFARING-A-001`.
- **Kategori:** sjekkliste · **Domene:** kvalitet
- **Lokasjon:** dokumentet knyttes til et **område** (`lokasjonOmfang="omrade"` + `omradeId`).
  🔴 **BEF1 forventer `type="trase"`, BEF2 `type="etasje"` eller `"sone"`.**

### 🔴 A. Identitet og dekning

**Hva befaringen faktisk dekket — ikke hvor byggelederen sto.**

- **Dato og tidspunkt**
- **Dekning:** fritekst med hjelpetekst. **BEF1:** «Pel 50–150» eller «SP-04 til SP-05».
  **BEF2:** «5. etasje, akse 1–4». ⚠️ **Hjelpeteksten skal vise EKSEMPLER, ikke forklare begrepet.**
- **Vær/føre** — valgfritt, men relevant for VA om vinteren

### 🔴 B. Fremdrift — trafikklys, og gul/rød KREVER forklaring

> **Kenneth:** *«grønn → normal fremdrift. Gul → manglende fremdrift, forklar hva som ikke fungerer optimalt.
> rød → ingen fremdrift eller svært svak fremdrift.»*

- **Trafikklys-felt** med tre verdier
- 🔴 **Gul og rød utløser et PÅKREVD forklaringsfelt.** ⚠️ **Grønn skal ikke kreve noe** — ellers blir
  rapporten et skjema man klikker seg gjennom.
- **Mekanisme:** samme fase → `forgrening`. **Ulik fase → `forelderFelt` + `barnAv`** (MAL-METODE §1f).
  🔴 **Vurder fasen selv og MELD hvilken du valgte.**

🔴 **Formålet er sluttoppgjøret, ikke et dashbord.** ⚠️ **En gul uten forklaring er verdiløs om to år.** Det
er hele grunnen til at forklaringen er påkrevd.

### 🔴 C. Bemanning — tellinger, ikke anslag

> **Kenneth:** *«Antall mannskaper, antall gravemaskiner, antall hjullastere»* · *«man kan telle pr fag /
> tømrer / elektro / ventilasjon»* · *«tallene blir aldri helt rett»*

- **BEF1 (anlegg):** antall personer · gravemaskiner · hjullastere · andre maskiner
- **BEF2 (bygg):** antall pr. **fag** — tømrer, elektro, ventilasjon, rørlegger, annet
- **Heltallsfelt.** 🟡 **Valgfritt kommentarfelt** for «tallene er omtrentlige»

⚠️ **Ikke bygg en «er du sikker»-validering.** **Kenneth har selv sagt at tallene aldri blir helt rett — en
mal som later som noe annet, blir ikke brukt.**

### 🟡 D. Bilder

- Bildefelt med fritekst. **Bildene bærer alt GPS og tidspunkt** — ikke be om det på nytt.
- 🟡 **360-video nevnes som mulighet i hjelpeteksten, men bygges ikke.**

## [5] UFRAVIKELIG

- **Maløypa:** direkte design ↔ mal. **Cowork får kopi for kollisjonskartet.**
- **Filer:** `seed-bibliotek.ts` + testfiler + fasit-snapshot. **Ingen andre.**
- 🔴 **Malreglene (Kenneth 2026-09-18):** navn = **kode + egne ord** · hjelpetekster **uten** tabell-/punktkoder
  · **aldri** (nesten-)ordrett normtekst. **BEF-malene har ingen NS-post** — **utelat «Faglig grunnlag»-linja
  helt framfor å finne på en.**
- 🔴 **Terminologi:** **pel** ikke «pæl» · **SP/OV/AF/V/SF** · **Baio** aldri «Bajo»/«bajonett».
- 🔴 **Din ordre er input, ikke fasit.** ⚠️ **§1f gikk foran ordren min i UM1-runden, og det var riktig.
  Gjør det igjen om det trengs — men MELD det.**
- **SQL mot test: Kenneth, ÉN gang.**

## [6] FORVENTET OUTPUT

1. **Hvilken §1f-hjelper du valgte for trafikklys→forklaring, og hvorfor.**
2. **Feltantall pr. mal**, og at fasit-diffen kun viser de to nye.
3. **0 dangling `parent_id`** + idempotens-guard, som i UM1-runden.
4. **Gate-tall.**

---

## Akseptkriterier (designgate)

| # | Krav | Bevis |
|---|---|---|
| 1 | `BEF1`/`BEF2` som referanse — korte | Seed |
| 2 | Gul/rød krever forklaring, grønn ikke | Test |
| 3 | Bemanning som heltall, ingen «er du sikker» | Seed |
| 4 | Ingen oppdiktet «Faglig grunnlag»-linje | Fasit |
| 5 | §1f-valget meldt | Rapport |

🔴 **BEF3 er IKKE bestilt.** ⚠️ **Den bygges når steg 3 lander — og da er den liten, fordi BEF1 er malen den
gjentar.**
