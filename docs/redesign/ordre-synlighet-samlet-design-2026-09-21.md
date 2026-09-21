# Ordre: én funksjon som avgjør synlighet — laget over betingelsen

**Til:** cowork velger agent (app-sporet; redesign kjenner koden) · **Fra:** design · **Dato:** 2026-09-21
**Branch-forslag:** `feat/synlighet-samlet` fra `origin/develop`.
**Gatet av Kenneth 2026-09-21.**
**Henger sammen med:** `ordre-betinget-per-barn-design-2026-09-21.md` (levert) og
`ordre-pdf-ikke-aktuelt-design-2026-09-21.md` (**venter på denne** — dokgen skal ikke bygge sin egen ytre logikk).

---

## 1. Hvorfor

`erBetingelseOppfylt` i `packages/shared/src/utils/betingelse.ts` svarer på **én** del av spørsmålet: matcher
forelderens svar barnets utløsersett? Resten av vurderingen ligger fortsatt i hver enkelt hook:

1. `conditionActive` — er betingelsen slått av, skal barnet alltid vises.
2. `conditionType === "utenfor_krav"` — avviksfelt under et tallfelt har en annen regel (`utenforKravOppfylt`).
3. **Rekursjon oppover** — et barn av et skjult felt skal også være skjult.

Fire hooks har hver sin kopi av dette (web og mobil × sjekkliste og oppgave). Skal rapporten svare likt som appen, må
den enten kopiere det samme en femte gang, eller kalle noe som allerede kan alt. **Vi velger det siste.**

**Kenneths kontrollspørsmål 2026-09-21 gjør dette viktigere:** malbyggeren lar firmaene bygge betingede maler selv.
Rapporten vil derfor møte former vi aldri har sett — tre nivåer, søsken der ett arver og ett har eget sett. Da skal det
finnes **én** funksjon å teste, ikke to som ligner.

## 2. Hva som skal bygges

**En ny funksjon i `@sitedoc/shared` som svarer på hele spørsmålet:**

```
erObjektSynlig(objekt, alleObjekter, hentVerdi) → boolean
```

- **Legges over**, ikke ved siden av: den bruker `erBetingelseOppfylt` internt for verdimatchen.
- **`erBetingelseOppfylt` endres ikke.** Den er ny, testet og i bruk.
- Den dekker `conditionActive`, `utenfor_krav` og rekursjonen oppover — altså det hookene gjør i dag rundt kallet.
- **De fire hookene bytter til å kalle den** og mister sin egen kopi av logikken. Det er poenget; uten det har vi
  fortsatt fire kilder.

## 3. Rammer

- **Ingen endring i oppførsel.** Dette er en flytting, ikke en ny regel. Alt som vises i dag, skal vises etterpå — det
  er kravet som skal testes hardest.
- Repeater-barn og andre særtilfeller hookene håndterer, skal virke som før. Finner du noe som ikke lar seg flytte rent:
  **stopp og meld**, ikke bygg om regelen.
- Rører ikke `packages/db/` eller maler. Ingen migrering, ingen SQL.

## 4. Definition of Done

1. `erObjektSynlig` i `@sitedoc/shared`, brukt av alle fire hookene.
2. **Rød først** der det lar seg gjøre, og en **sannhetstabell** som test: for et tre med forelder, to søsken (ett med
   eget sett, ett som arver) og et barnebarn, hvilke felt er synlige for hvert svar. Den tabellen er fasit for både app
   og rapport.
3. Regresjon: eksisterende maler uten betingelser er uendret. Vis det.
4. Dekk de tre tilfellene eksplisitt: `conditionActive = false`, `utenfor_krav`, og barn av skjult forelder.
5. Gate-tall via `pnpm exec turbo run test --force`, web build og mobil typecheck.
6. Diff: `packages/shared/src/utils/`, de fire hookene og tester. Rører du noe annet, meld hvorfor.
7. Leveranse nederst i hovedtreets `relay/inbox-design.md` + «design har post».

## 5. Rekkefølge

Denne før rapporten. Dokgen kaller `erObjektSynlig` og bygger ingen egen vurdering — da kan rapporten og skjermen per
definisjon ikke være uenige om hva som var synlig.
