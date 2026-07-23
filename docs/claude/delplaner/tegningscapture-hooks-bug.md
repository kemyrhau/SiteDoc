---
name: tegningscapture-hooks-bug
status: 🟢 LØST + MERGET (2026-07-20, `b15dfe56`) — bugen var LATENT, ikke aktiv. Prioritet nedjustert fra pilot-kritisk
eier: fabel (prioritet) · cowork (måling + ordre) · mobil-Opus (fiks + simulator-verifisering)
sist_verifisert_mot_kode: 2026-07-20
---

# TegningsCapture — betinget hook etter tidlig return (React-invariant brutt)

> Funnet da `eslint-plugin-react-hooks` ble installert (spor 1, trinn 1). Regelen hadde aldri vært evaluert, så feilen har vært usynlig. **Ikke lint-gjeld — en korrekthetsbug som kan krasje appen.**

## 0. For deg som koder (les først)

**Hvem du er:** mobil-Opus, **ledd 3 (koding)** med simulator-tilgang. **Du koder og verifiserer i simulator.** Du gater ikke, merger ikke, deployer ikke, fyrer ikke EAS-bygg.

**Branch:** `fix/tegningscapture-hooks` fra develop.

**Leveranse i to faser — STOPP mellom:**
1. **Fase A — reproduser krasjen** i simulator (§ 3). Rapporter: reproduserte du den, og med hvilken sekvens? **Ikke fiks ennå.**
2. **Fase B — fiks + verifiser** at samme sekvens ikke lenger krasjer.

**Ditt neste svar:** reproduksjonsforsøket, ikke fiksen.

## 1. Bugen (kode-målt)

`apps/mobile/src/components/TegningsCapture.tsx`:

```
34:  const harLevert = useRef(false);                    ← hook 1
36:  if (positionX <= 0 && positionY <= 0) return null;  ← tidlig return
38:  const håndterMelding = useCallback(..., [onCapture]) ← hook 2, ETTER returen
```

**Invarianten som brytes:** React krever at hooks kalles i samme antall og rekkefølge ved hver render. Her kalles **én** hook når `positionX <= 0 && positionY <= 0`, og **to** ellers.

**Feilmodus:** rendres komponenten først med posisjon `0,0` (1 hook) og deretter med ekte posisjon (2 hooks), kaster React **«Rendered more hooks than during the previous render»** — en hard krasj, ikke en advarsel. Motsatt vei gir «Rendered fewer hooks than expected». Mellom disse kan hook-state også bli feilkoblet (verdi fra én hook havner i en annen).

**Hvorfor det er pilot-kritisk:** komponenten brukes i tegnings-/bildeflyten feltarbeidere bruker. Settes posisjonen etter mount — som er den naturlige sekvensen når bruker plasserer en prikk på tegningen — treffer man nøyaktig overgangen fra 1 til 2 hooks.

## 2. Fiksen

Flytt den tidlige returen **etter** alle hooks:

```
const harLevert = useRef(false);
const håndterMelding = useCallback(..., [onCapture]);
if (positionX <= 0 && positionY <= 0) return null;
```

**Null atferdsendring:** `null` returneres fortsatt for nøyaktig samme betingelse. Det eneste som endres er at hook-rekkefølgen blir stabil. `useCallback` som kjører også når komponenten returnerer null er gratis — den lager kun en memoisert funksjon.

**Rør ikke** WebView-HTML-en, canvas-logikken eller `onCapture`-kontrakten. Endringen er to linjer flyttet.

## 3. Fase A — reproduksjon (før fiks)

Mål: fremkall krasjen i simulator, så vi vet at fiksen løser noe reelt og ikke bare stilles.

**Sekvens å prøve:** render `TegningsCapture` med `positionX=0, positionY=0`, og oppdater deretter til en ekte posisjon uten unmount. I appen: åpne flyten der tegningsposisjon settes, og se om overgangen «ingen posisjon → posisjon» skjer uten at komponenten remountes.

- **Krasjer det** → noter feilteksten ordrett. Det er beviset.
- **Krasjer det ikke** → betyr sannsynligvis at komponenten alltid remountes ved posisjonsendring (`key`-prop eller betinget montering i forelder), slik at 1→2-overgangen aldri skjer i praksis. **Fiksen skal gjøres uansett** — invarianten er brutt og en fremtidig refaktor i forelderen ville utløst den — men rapporter at den i dag er latent, ikke aktiv. **Ikke overdriv funnet hvis du ikke reproduserte det.**

## 4. Fase B — verifisering etter fiks
1. Samme sekvens som Fase A → ingen krasj.
2. Tegnings-capture fungerer fortsatt ende-til-ende: oversiktsbilde + detaljbilde genereres og `onCapture` fyrer én gang (`harLevert`-vakten holder).
3. Posisjon `0,0` → komponenten rendrer fortsatt `null` (ingen WebView montert).
4. `pnpm --filter @sitedoc/mobile lint` → `rules-of-hooks`-error borte (var 1). De 18 `exhaustive-deps`-warningene **skal fortsatt stå** — de er egen sak, ikke din.

## 5. Ufravikelig
- **Ingen EAS-sky-bygg.** Simulator holder; kvoten er knapp og krever Kenneths eksplisitte ja.
- Ingen andre react-hooks-funn rettes i denne runden — 18 warnings står igjen med vilje.
- Rør kun `TegningsCapture.tsx`.

## 6. DoD
Fase A rapportert → cowork-gate → Fase B → simulator-verifisering (§ 4) → `next build`/mobil-typecheck grønn → push → cowork-review → dok-sync ([lint-typecheck-gjeld.md](lint-typecheck-gjeld.md): `rules-of-hooks` strykes fra tallene) → «klar for commit».
