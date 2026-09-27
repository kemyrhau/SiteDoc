---
status: 🟢 ORDRE — klar for tildeling
forfatter: design
gjelder: apps/web/.eslintrc.js
---

# Lint-regelen skal dekke lenke-klassen — begrunnelsen for å utelate den er utløpt

## § 1 Bakgrunn — regelen dokumenterer selv sitt eget hull

**`apps/web/.eslintrc.js` har alt en regel som feiler på rå `/uploads/` i `<img src>`. Den er god, og
den sier eksplisitt hva den ikke dekker:**

> **DEKKER IKKE — og det er RIKTIG, ikke en mangel:** `<iframe>` (PDF), `<video>`, `<a href download>`,
> `fetch()`, `window.open()` mot `/uploads/`. **De er IKKE bilder og har INGEN komponent å bli til.**

🔴 **Den betingelsen holdt da kommentaren ble skrevet 2026-09-25. Den holder ikke lenger.**
🟢 **`SignertLenke` ble levert i lenke-runden 2026-09-27, og 8 filer bruker den i dag.**
⚠️ **Lenke-klassen HAR nå en komponent å bli til. Grunnen til å utelate den er borte.**

**Og kommentaren bærer en påstand som nå er feil:**

> 🔴 **MEN de SELVFORNYER ikke: med 15 min levetid gir en utløpt signatur 401 ved klikk (målt 2026-09-25).**

🟢 **For `<a>` er det ikke sant lenger — `SignertLenke` fornyer.** 🔴 **Kommentaren skal rettes i samme
runde, ellers er den en usann påstand i en styrende fil.**

## § 2 Hvorfor dette er en HÅNDHEVELSE, ikke en ny funksjon

**Cowork målte 2026-09-27: 0 gjenstående rå `/uploads/`-lenker i web, alle ni kallsteder rutet.**
**Design verifiserte 2026-09-28: ingen rå `/uploads/` i `window.open` eller `href` i web** — de fem
`window.open`-treffene er placeholder-vinduer (`window.open("", "_blank")`) og `mailto:`, ikke
fil-tilgang.

🟢 **Tilstanden er ren i dag.** 🔴 **Men den er målt én gang, ikke håndhevet.** ⚠️ **Lint-filas egen
begrunnelse sier hvorfor det ikke holder: mønsteret som forårsaket S1-hullet «ble husket i bare TRE
DAGER sist».**

## § 3 Kravet

🔴 **Utvid regelen til å feile på en rå `/uploads/`- eller `/api${…}`-verdi i `href` på `<a>`, og i
`window.open(...)`.** **Riktig vei er `SignertLenke` / `useSignertLenkeAapner`.**

🔴 **Rett den foreldede kommentaren:** **`<a>` selvfornyer nå. `iframe`/`video`/`fetch` gjør det ikke.**

## § 4 Bevis — den nye SAMARBEIDSREGLER-regelen gjelder her

**Regelen er en negativ vakt, så alle tre kravene i § EN NEGATIV ASSERTION ER IKKE BEVIST FØR TRE TING
ER VIST gjelder:**

1. 🔴 **RØD først, i en ENGANGSFIL.** **Legg en midlertidig fil med `<a href="/uploads/x.pdf">`, vis at
   lint feiler, slett fila.** **Kvittering: `comm` mot origin viser 0 nye filer på branchen — et rent
   arbeidstre er ikke nok.**
2. 🔴 **Bevis-formen skal være den varianten risikoen kommer i.** **Både `href="/uploads/…"` og
   `href={`/api${sti}`}` — den siste er inline-byggingen som forårsaket S1.**
3. 🔴 **FALSK-POSITIV-sjekk:** **vis at regelen IKKE fyrer på `<SignertLenke url={fileUrl}>`, og ikke på
   de fem eksisterende `window.open("", "_blank")`-placeholderne.** ⚠️ **En for bred regel gjør hver
   utskriftsflate rød, og da blir den slått av.**

## § 5 Utenfor ordren

🔴 **`iframe` (PDF), `video`, `fetch()` dekkes IKKE.** **De har fortsatt ingen komponent å bli til, og
en per-linje `eslint-disable` ville blitt nettopp unntakslista regelen skal unngå.** 🟡 **Meld dem
videre som egen sak — ikke bygg dem her.**

🔴 **Ingen migrering av kallsteder. Tilstanden er alt ren; dette er en vakt, ikke en opprydding.**
