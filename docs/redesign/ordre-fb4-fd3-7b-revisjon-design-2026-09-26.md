---
status: 🟢 ORDRE — to malrevisjoner. Del B krever mal-Opus' egen vurdering
til: mal-Opus (maløypa — direkte fra design)
fra: design
dato: 2026-09-26
grunnlag: kontrollplans ferske MK C-måling 2026-09-26 — FB4 og FD3 holdt ute fordi de er gammel-stil
---

# Ordre: §7b- og §1-revisjon av FB4 og FD3

## [1] HVA SOM ER MÅLT

**Kontrollplan holdt disse to ute av MK C fordi de er gammel-stil mens de 10 andre er §7b-renset.**
🔴 **En MK C-konvertering der ville kollidert med denne revisjonen.** 🟢 **Riktig sekvensering — og derfor
kommer denne ordren først.**

### §7b brytes på TO av fire punkter

**Regelen (MAL-METODE § 1b pkt 3):** «kode + egne ord i navnet, **ingen tabell-/punktkoder i hjelpetekster**,
**én linje «Faglig grunnlag» i beskrivelsen**, aldri (nesten-)ordrett normtekst».

**Målt i `seed-bibliotek.ts`:**

| Brudd | Belegg |
|---|---|
| 🔴 **Tabellkoder i HVER hjelpetekst** | `:1097` «FB4 b1: …» · `:1103` «FB4 c1: …» · `:1113` «FB4 c3: …» · `:1141` «FD3 b1: …» · `:1147` «FD3 c1: …» — **10 målte** |
| 🔴 **Ingen «Faglig grunnlag»-linje** | Bekreftet i referanse-verifiseringen 2026-09-26 |

### Og tre desimalfelt må vurderes mot §1

| Felt | Hjelpeteksten sier | Designs lesning |
|---|---|---|
| `desimal("Vertikalitet – avvik (mm/m)")` | «Mål avvik fra lodd **etter hvert element**» | 🔴 **Varierende flate** |
| `desimal("Dybde (m)")` | «Mål pelehull/injeksjonsdybde **mot prosjektert**» | 🔴 **Varierende — pr. pel** |
| `desimal("Stagkraft (kN)")` | «Mål stagkraft ved forspenning. Sammenlign med prosjektert» | 🟡 **Usikker** |

🔴 **§1: «Tallfelt kun når ETT veldefinert tall dokumenterer leveransen. Krav mot en flate som VARIERER
besvares med samsvar — og målt verdi/sted hører i kommentaren.»**

## [2] OPPGAVE

### 🔴 A. §7b — hjelpetekstene skrives om

**Fjern tabellkoden fra hver hjelpetekst.** ⚠️ **Ikke bare prefikset — hele teksten skal være VÅRE ord.**

🟢 **Det faglige innholdet er godt og skal bevares:** «Mål avvik fra lodd etter hvert element», «Vannlekkasje
indikerer manglende sammenlåsing», «Avvik >10 % → varsle geotekniker». **Det er praktisk kunnskap, ikke
normtekst.** **Behold substansen, fjern kodene.**

🔴 **Og legg til «Faglig grunnlag»-linja i beskrivelsen — ÉN linje.**

⚠️ **MEN: §1g-b krever oppslag FØR koden brukes.** 🔴 **Del F mangler tekstlag** (du målte det selv), så
oppslaget må gjøres i innholdsfortegnelse-bildet. **Siter postens ordrette tittel, og SI at
verifiseringsnivået er TOC og ikke brødtekst.**

🔴 **Treffer ikke posten malens innhold: bruk `postgruppe` (§1g). Finnes ingen passende post: UTELAT linja
helt framfor å finne på en.**

### 🔴 B. §1 — de tre desimalfeltene. Din vurdering, ikke min

🔴 **Design leser to av tre som varierende flate — men DU avgjør, og du begrunner.**

**Testen fra §1:** dokumenterer **ett veldefinert tall** leveransen, eller varierer størrelsen over flaten?

- **Varierer** → `valg("Innenfor toleranse" / "Avvik")`, **og målt verdi + sted i kommentaren**
- **Ett tall** → behold `desimal`, **men sjekk desimalpresisjonen mot §1**: mm → 0 · cm → 1 · m og større → 2.
  ⚠️ **Og «presisjonen følger hva som FAKTISK måles» — måles det i grove steg, brukes færre desimaler.**

🔴 **Meld valget for HVERT av de tre, med begrunnelsen.** ⚠️ **Et felt konvertert uten begrunnelse kan ingen
etterprøve senere — og §1-migreringen har alt etterlatt inkonsistenser (KB2:1227, KD1:352) som nå er egen
sak.**

### 🟡 C. Og MK C-kandidatene i disse to malene kan vurderes NÅ

**Kontrollplan holdt dem ute fordi revisjonen ventet. Nå kommer revisjonen.**

🔴 **Bruk KB4-testen:** ber hjelpeteksten om en tilstand fargene ikke kan uttrykke («ikke relevant», «ikke
aktuelt», «der det er aktuelt»)? 🟢 **Design kjørte den over hele seeden — `:1259` var eneste treff utenfor
alt konverterte felt.** **Men dine to maler får nye hjelpetekster i del A, så testen må kjøres på NYE tekster.**

⚠️ **Konverter kun der testen slår ut. Ikke konverter «for ordens skyld».**

## [3] UFRAVIKELIG

- **Maløypa: direkte design ↔ mal.** Cowork får kopi for kollisjonskartet.
- **Filer:** `seed-bibliotek.ts` · testfiler for FB4 og FD3 · `mal-fasit.snap.md`. **Ingen andre.**
- 🔴 **To revisjoner, versjon +1 hver** (§6a). **SQL genereres med `generer-mal-sql.ts <REF>` — skrives aldri
  for hånd.** **Kenneth kjører ÉN gang mot test.**
- 🔴 **Terminologi:** **pel** ikke «pæl» — ⚠️ **særlig i FD3, som handler om KC-peler og pelehull.**
  **Den fella er reell i denne malen.**
- 🔴 **Din ordre er input, ikke fasit.** ⚠️ **Du gikk foran ordren min i UM1-runden og hadde rett. Del B er
  nettopp et sted hvor det kan skje igjen.**
- 🔴 **Sjekk treets alder før du melder et fravær.**

## [4] FORVENTET OUTPUT

1. **A: at ingen tabellkode står igjen** — vis søket
2. **A: «Faglig grunnlag»-linja, med postens ordrette tittel og at oppslaget var TOC, ikke brødtekst**
3. **B: valget for HVERT av de tre desimalfeltene, med begrunnelse**
4. **C: traff KB4-testen på de nye tekstene? Ja → hvilke. Nei → si det**
5. **0 dangling `parent_id` + idempotens-guard**, som i UM1-runden
6. **Gate-tall**

---

## Akseptkriterier (designgate)

| # | Krav | Bevis |
|---|---|---|
| 1 | Ingen tabell-/punktkode i noen hjelpetekst | Søk |
| 2 | Substansen bevart — ikke bare kodene strøket | Fasit-diff |
| 3 | «Faglig grunnlag» til stede, **eller utelatt med begrunnelse** | Rapport |
| 4 | Verifiseringsnivået for Del F oppgitt (TOC) | Rapport |
| 5 | Hvert desimalfelt vurdert mot §1, med begrunnelse | Rapport |
| 6 | «pel», aldri «pæl» | Test |
