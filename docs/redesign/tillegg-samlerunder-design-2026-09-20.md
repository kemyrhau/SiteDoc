# Tillegg: to maler per runde (FH1+FS3, deretter UM1+UU1)

**Til:** mal-Opus · **Fra:** design · **Dato:** 2026-09-20
**Gjelder:** `ordre-fh1-omkoding-design-2026-09-19.md`, `ordre-fs3-omkoding-design-2026-09-19.md`,
`ordre-um1-ny-mal-design-2026-09-19.md`, `ordre-uu1-ny-mal-design-2026-09-19.md`.
**Gatet av Kenneth 2026-09-20.** Ordrenes innhold er uendret — dette endrer bare hvordan de kjøres.

Begrunnelse: generatoren har nå alt den trenger (standard og kapittel per mal, `--fra`, sletting av tomt
kildekapittel). Da er det ingen grunn til å dele opp. Færre runder betyr færre SQL-kjøringer og passordrunder for
Kenneth, og færre merger.

---

## 1. To runder

| Runde | Branch | Maler | Hvorfor sammen |
|---|---|---|---|
| A | `feat/mal-fh1-fs3` fra `origin/develop` | FH1 (omkoding fra FC1), FS3 (omkoding fra FE1) | FS3 bruker samme generatorlogikk som FH1 (slett tomt kildekapittel) — bygges én gang, brukes to ganger |
| B | `feat/mal-um1-uu1` fra `origin/develop` etter at A er merget | UM1 (ny), UU1 (ny) | UU1 trenger standarden `NS3420-U` som UM1 oppretter |

Rekkefølgen i fila og i seed-arrayet følger ordrene: FH1 før FS3, UM1 før UU1.

## 2. Generatoren: `--fra` med ett par per mal

I dag tar `--fra` én referanse og krever én REF. Utvid til flere refs i samme kjøring:

```
generer-mal-sql.ts FH1 FS3 revisjon --fra FH1=FC1,FS3=FE1
```

- Par-form `NY=GAMMEL`, komma mellom parene. En ref uten par revideres uten omkoding (som i dag).
- Ukjent nøkkel, ref uten par der par kreves, eller par for en ref som ikke er med: stopp med klartekst.
- Én fil, én transaksjon, samme rekkefølge som refs står i. Hver mal får sin egen guard (gammel finnes, ny finnes ikke),
  sitt kapittel og sin sletting av tomt kildekapittel.
- **Test:** to refs med hvert sitt par gir to `UPDATE … referanse` i riktig rekkefølge, og `FD1 revisjon --fra FB2`
  (gammel form, én ref) virker fortsatt. Rød først.

Runde B er modus `ny` for begge og trenger ingen ny generatorlogikk: `generer-mal-sql.ts UM1 UU1 ny`.

## 3. Utskrift og gate

`\x on`-utskriften før `COMMIT` skal være **per mal**, i rekkefølge, med kapittelkode og -navn — slik at design kan
gate hver mal for seg på samme utskrift. Ta også med en linje per slettet kildekapittel (FC, FE).

Design gater malene hver for seg. Er det avvik i én, holdes hele runden — branchen er fryst til alle er grønne.

## 4. DoD for runden

Ordrenes DoD gjelder per mal, med disse justeringene:
1. Én branch, én SQL-fil (`fh1-fs3-test.sql` / `um1-uu1-test.sql`), tre enlinjere totalt.
2. Én testfil per mal (`fh1-mal.test.ts`, `fs3-mal.test.ts`, …), ikke slått sammen.
3. Ett gate-bygg for runden, med gate-tall.
4. Diff: `seed-bibliotek.ts`, testfilene, og for runde A også `generer-mal-sql.ts` + `generer-mal-sql.test.ts`.
5. Steg 0 meldes per mal.

## 5. Uendret

Én runde om gangen — runde B starter først når A er merget. Kenneth kjører SQL, ÉN gang per runde. Ingen skjermbilder;
gaten går på utskriften.
