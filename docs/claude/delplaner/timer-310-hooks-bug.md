---
name: timer-310-hooks-bug
status: 🟡 EGEN SAK (skilt ut fra K3 2026-07-23) — latent, trigges av test-data, IKKE K3-regresjon, IKKE på prod
eier: cowork (måling) · Kenneth (prioritet)
sist_verifisert_mot_kode: 2026-07-23
---

# Timer-hovedvisning krasjer med React #310 (betinget hook)

## Symptom
Navigasjon til timer-**hovedvisningen** krasjer med «Application error: a client-side exception» + konsoll `Minified React error #310` («Rendered more hooks than during the previous render», `useMemo`-relatert, delt chunk 2749). Onboarding-fanen fungerer.

**Claude in Chrome-repro (test, 2026-07-23):**
- `/dashbord/{uuid}/timer` (prosjekt-nivå) → ❌ #310
- `/dashbord/firma/timer` → ❌ #310 (residual error-state / redirect-transisjon)
- `/dashbord/firma/timer/onboarding` → ✅ fungerer

## Avgrensning (cowork-målt)
- **IKKE en K3-regresjon:** K3s diff på timer-siden rørte ingen hooks (kun JSX-wrap `SonetonetSidehode`). Timer-sidens hook-struktur er **identisk på prod (main) og develop**.
- **IKKE på prod:** sitedoc.no timer (firma + prosjekt) fungerer feilfritt (A.Markussen / 998 Instinniforbotn, 2026-07-23). → krasjen trigges av **test-databasens datashape**, ikke koden alene.
- **IKKE ⇄-mekanismen:** ⇄-Link-fiksen endret ikke krasjen; sidebar-navigasjon til timer krasjer likt. ⇄ ruter bare inn i en allerede-ødelagt visning.

## Rene komponenter (utelukket, hook-rekkefølge OK)
`[prosjektId]/timer/page.tsx` (alle hooks før return; l.85-return er i IIFE `ukenummer`), `StatusBadge`, `SonetonetSidehode` (ingen hooks), `firma/timer/onboarding`, `timer/layout.tsx`, `useToppbarFiltre` (kun useEffect), `KontekstChip`/`useSidebarElementer` (unconditional, rendrer overalt).

## Stack (minifisert, prod-build på test — kan ikke dekodes uten dev/sourcemaps)
```
at t.useMemo (2749-...js:2:31871)
at D (2749-...js:1:11481)          ← synder-komponenten, chunk 2749 (delt), bruker useMemo
at rE/l$/iZ/ia (react-dom-reconciler, chunk 5b8f0dd8)
```
Skjer under en scheduled/concurrent render (`unstable_scheduleCallback` i bunn).

**K3 endelig frikjent (cowork 2026-07-23):** ingen K3-komponent har `useMemo` — KontekstChip, SonetonetSidehode, Verktoylinje, Toppbar = 0. «D» er altså IKKE en K3-komponent. Next prod serverer ikke `.map`, så «D» krever dev-bygg for å navngis.

## Hypotese
En **delt komponent med et betinget `useMemo`** (hook kalt bak en data-avhengig gren) i timer-hovedvisningens tre. En datashape i test (ugyldig/manglende felt på en dagsseddel-rad?) flipper grenen → hook-antallet endres → #310. Cache-avhengig intermittens (varm cache = ingen loading-render = ingen mismatch).

## Neste steg
Nagle eksakt `fil:linje` via **ikke-minifisert dev-feil** (`pnpm dev --filter @sitedoc/web --filter @sitedoc/api`, naviger til timer-hovedvisning med test-lik data). Deretter: flytt den betingede hooken til unconditional topp-nivå, eller guard datashapen. Legg til regresjonstest på datashapen som trigger.

## Prioritet
Latent (ikke på prod). Bør fikses før K3 → prod med test-lik data, men blokkerer ikke K3 på test.
