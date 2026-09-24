---
status: 🟢 ORDRE — klar. Kenneth: «zoom foran de andre»
til: kode-agent (worktree og branch bestemmes av cowork)
fra: design
dato: 2026-09-24
kenneth_melding: 2026-09-24 — «det zoomes mot overkant av tegning istedenfor mot musens peker»
---

# Ordre: zoom skal treffe musepekeren i tegningsvisningen

## [1] HVA SOM ER GJORT — intensjonen er riktig, timingen er feil

**Alt målt 2026-09-24 på `origin/develop`.**

🟢 **Koden PRØVER allerede å zoome mot musepekeren.** `tegninger/page.tsx:402-422`, kommentaren på `:392` sier
«Musehjul-zoom sentrert på musepekeren», og regnestykket er **riktig**:

```js
const contentX = e.clientX - rect.left + el.scrollLeft;   // punkt i innholdet
const viewX    = e.clientX - rect.left;                   // punkt i viewporten
...
requestAnimationFrame(() => {
  el.scrollLeft = contentX * skala - viewX;
  el.scrollTop  = contentY * skala - viewY;
});
```

🔴 **Feilen er HVOR og NÅR scrollen settes, ikke hvordan den regnes.**

- Zoom påføres som **bredde**: `:965` → `style={{ width: \`${zoom * 100}%\`, minWidth: "100%" }}`
- Scrollen settes i en **`requestAnimationFrame`** (`:414-419`)

⚠️ **Da settes `scrollTop`/`scrollLeft` FØR elementet har fått sin nye størrelse.** Verdien overstiger
gjeldende `scrollHeight - clientHeight`, **nettleseren KLIPPER den til gammelt maksimum, og visningen lander
for høyt oppe.**

🔴 **Det er presis Kenneths ord: «mot overkant».** Symptomet er klipping, ikke feil matematikk.

### 🟢 Og motbeviset ligger i repoet

`tegning-3d/page.tsx:334-350` har **samme intensjon** og virker — fordi den bruker **pan-offset**, ikke scroll:

```js
setPan((p) => ({ x: musX - (musX - p.x) * skala, y: musY - (musY - p.y) * skala }));
```

**Ingen scroll-maksverdi å bli klippet mot. Derfor ingen feil.**

**BACKLOG-grep (steg 0):** `zoom`, `musepeker`, `scroll` — **ingen eksisterende post.** Ordren lukker ingen.

## [2] HVA SOM GJENSTÅR

Sett scrollen **etter** at layouten har fått den nye størrelsen.

## [3] OPPGAVE

### 🔴 A. Flytt scroll-settingen fra `requestAnimationFrame` til etter layout

**Anbefalt form:** lagre målposisjonen i en `ref` i hjul-handleren, og sett scrollen i en **`useLayoutEffect`
som kjører på `zoom`**.

```
handleWheel  → beregn ønsket scroll → lagre i ref → setZoom(neste)
useLayoutEffect([zoom]) → les ref → sett scrollLeft/scrollTop → tøm ref
```

🟢 **`useLayoutEffect` kjører etter DOM-mutasjon og layout, men før maling** — elementet har da sin nye
bredde, og verdien klippes ikke.

🔴 **Matematikken skal IKKE røres.** `contentX * skala - viewX` er riktig. ⚠️ **Endrer du formelen i tillegg,
vet ingen hvilken av de to endringene som virket.**

### 🟡 B. Vurder `minWidth: "100%"` — men bare hvis du finner at den bidrar

`:965` har `minWidth: "100%"` ved siden av `width: zoom*100%`. **Ved zoom under 1 klemmer den bredden til
100 %**, mens matematikken tror bredden er `zoom*100%`.

⚠️ **Mål om det faktisk gir feil ved utzooming før du rører den.** Gjør det ikke, la den stå — den finnes
sannsynligvis for å hindre at tegningen kollapser i en smal container. **Ikke fjern noe du ikke har målt
skaden av.**

### 🔴 C. Test som fanger klippingen

**`apps/web` har vitest og ti filer i `src/lib/__tests__/`.** Trekk zoom-regnestykket ut i en ren funksjon
hvis det er den reneste veien — **men ikke bygg om komponenten for å teste den.**

**Minst to tilfeller:**
1. **Zoom INN midt i tegningen** → ønsket scroll er større enn gammelt maksimum. **Testen skal vise at
   verdien som settes er den ønskede, ikke den klippede.**
2. **Zoom UT** → ønsket scroll er mindre. Ingen klipping, men punktet under musen skal fortsatt ligge fast.

🔴 **Rød-først er påkrevd:** legg tilbake `requestAnimationFrame`-formen midlertidig og vis at test 1 faller.
⚠️ **Faller den ikke, tester du noe annet enn feilen.**

### 🟡 D. IKKE bygg om til pan-modellen

`tegning-3d` sin pan-modell er immun mot dette. 🔴 **Men å legge hovedflaten for tegninger om fra scroll til
transform er en ombygging for å løse en timingfeil.** **Ikke i denne ordren.**

⚠️ **Om agenten mener pan-modellen er eneste farbare vei: STOPP og meld, med måling som viser hvorfor
layout-effekten ikke holder.**

## [4] UFRAVIKELIG

- **Arbeidstre + branch:** cowork bestemmer.
- **Filer ordren eier:** `apps/web/src/app/dashbord/[prosjektId]/tegninger/page.tsx` (kun hjul-/zoom-veien)
  · evt. én ny fil i `apps/web/src/lib/` + test. **Ingen andre.**
- 🔴 **`tegning-3d/page.tsx` skal IKKE røres.** Den virker.
- 🔴 **Ingen i18n-nøkler.** `nb.json`/`en.json` er høytrafikk med flere saker i kø.
- 🔴 **Din ordre er input, ikke fasit — mål premisset selv.** Linjenumre målt på `origin/develop` 2026-09-24.
- 🔴 **Sjekk treets alder før du melder et fravær.** ⚠️ **Tom grep-output betyr «kommandoen døde» like ofte
  som «finnes ikke».**
- **Kald web-bygg** (`apps/web` røres):
  `rm -f apps/web/tsconfig.tsbuildinfo apps/web/.next/cache/.tsbuildinfo && rm -rf apps/web/.next`
- **Gate:** `pnpm test` fra ROT (`--force`) + kald `pnpm --filter @sitedoc/web build`.
  **`apps/web` sin testtelling skal STIGE.**

## [5] FORVENTET OUTPUT

1. **Diffen på hjul-veien** — og at matematikken er uendret.
2. 🔴 **Rød-først:** at test 1 faller med `requestAnimationFrame`-formen tilbake.
3. **B:** målt eller ikke rørt — **si hvilket.**
4. **Gate-tall som sier hva som kjørte:** web før → etter.

⚠️ **Skjermbilde bestilles IKKE av deg.** Den visuelle bekreftelsen — at zoom faktisk treffer pekeren på en
ekte A3-tegning — går via en verifiserings-agent cowork utpeker. **Meld at den gjenstår.**

## [6] OPPRYDDING

Cowork sletter branchen etter merge.

---

## Akseptkriterier (designgate)

| # | Krav | Bevis |
|---|---|---|
| 1 | Punktet under musepekeren ligger fast ved zoom inn **og** ut | Test |
| 2 | Scrollen settes etter layout, ikke i rAF | Diff |
| 3 | Matematikken urørt | `git diff` |
| 4 | Rød-først: test 1 faller med gammel form | Rapport |
| 5 | `tegning-3d` urørt | `git diff` |

🔴 **Ikke i denne ordren:** ombygging til pan-modell · zoom på mobil · touch-pinch.
