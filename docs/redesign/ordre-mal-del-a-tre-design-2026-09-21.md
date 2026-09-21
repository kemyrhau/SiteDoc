# Ordre: del A — forelder og barn i malverktøyene

**Til:** mal-Opus · **Fra:** design · **Dato:** 2026-09-21
**Metode:** MAL-METODE §1b, §6a, §6b, §8 og §8b.
**Branch:** `feat/mal-tre-kapasitet` fra `origin/develop`.
**Gatet av Kenneth 2026-09-21.** Dette er del A fra pilotordren, skilt ut som egen jobb.

Del B (selve JH2 v2) **står stanset** til app-endringen er inne — se
`ordre-betinget-per-barn-design-2026-09-21.md`. Del A er uavhengig av den og bygges nå, så kapasiteten er klar når
mønsteret er det.

---

## 1. Hva som skal bygges

1. **Hjelpefunksjon i seed** for et felt som hører under et enkeltvalg og bare vises for bestemte svar. Formen velger
   du; den skal være like lesbar som `valg` og `trafikklys`, og den skal sette både barnets `parentId` og
   utløsersettet. **Legg utløserne på barnet** — det er formen app-endringen innfører, og den arver forelderens sett
   når barnet ikke har eget.
2. **`byggBibliotekRader`:** riktig `parentId`, og `sortOrder` som plasserer barnet rett etter forelderen.
3. **Generatoren:** skriver `parent_id` i SQL-en, foreldre før barn i samme transaksjon.
4. **Fasiten (§8):** viser treet — hvert barn med forelder og utløsende svar. Uten det kan en kobling endres stille.
5. **`skriv-mal`:** viser det samme, så design gater på en utskrift som viser strukturen.

## 2. Verifisering uten ekte mal

Ingen mal bruker dette ennå. Bygg derfor mot en **testmal i testfilene** — ikke i seed-arrayet — med én forelder og to
barn med hvert sitt utløsersett. Den viser at rørene virker, uten å legge en halvferdig mal i biblioteket.

**Rød først** på hvert punkt der det lar seg gjøre.

## 3. Rammer og DoD

- **Ingen endring i appen** (`apps/`) — den delen bygges parallelt av et annet spor.
- **Ingen ny eller endret mal i seed-arrayet.** Fasiten skal derfor være uendret for alle 23 malene; den eneste
  diffen er ny struktur-støtte, ikke nytt innhold.
- **Ingen SQL-kjøring** (§8b: hverken malinnhold eller arkivstruktur endres). Er du uenig, meld før du lager en fil.
- Gate-tall via `pnpm exec turbo run test --force`.
- Diff: `seed-bibliotek.ts` (kun hjelpefunksjonen), `generer-mal-sql.ts`, `skriv-mal.ts`, `mal-fasit.test.ts` og deres
  tester. Rører du noe annet, meld hvorfor.
- Leveranse i hovedtreets `relay/inbox-design.md` + «design har post».

## 4. Merknad

Målingen din 2026-09-21 var riktig håndtering: du stoppet før bygging, målte i koden på begge plattformer, og lot være
å bygge om ordren på egen hånd. Den målingen er grunnlaget for app-ordren, og den er kreditert der.
