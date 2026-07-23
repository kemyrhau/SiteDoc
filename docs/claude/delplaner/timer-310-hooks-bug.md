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

## 🔴 ROTÅRSAK NAGLET — retnings-bevis (Kenneth 2026-07-23)
Timer og HMS er de eneste ⇄-parene. **HMS ⇄ fungerer uavbrutt begge veier. Timer ⇄ krasjer KUN prosjekt→firma; firma→prosjekt fungerer hver gang.** Eneste forskjell mellom parene: **firma/HMS er en ekte side; firma/timer er en `redirect()`-stub** (→ onboarding). Kryss-kontekst-navigasjon (prosjekt→firma) til en redirect-rute avbryter overgangs-renderen → hook-mismatch (#310) i en data-avhengig `useMemo`-komponent i onboarding/layout-treet. HMS krysser også kontekst men lander på ekte side → ingen avbrudd → funker.

**Utløst av K3:** før K3 fantes ingen kryss-kontekst-vei til firma/timer (⇄ er ny). Sidebar-navigasjon skjer innen firma-kontekst (ingen kryssing) → funker. Prod har ingen ⇄ → rammes ikke. Så det er på K3-stien, men rotårsaken er timer-modulens redirect-stub.

## Fiks (fabel Option 1, nå bekreftet av bevis)
**Gjør `/dashbord/firma/timer` til en ekte landingsside i stedet for `redirect()`** — render onboarding-innholdet direkte (samme mønster som firma/HMS). Da lander kryss-kontekst-⇄ på en ekte side i ÉN render-pass, ingen redirect-avbrudd → ingen #310. Beholder ⇄-paringa (relpath forblir `timer`).

Alternativ hvis restrukturering blir stor: dev-nagle den betingede `useMemo`-komponenten («D», chunk 2749) og flytt hooken unconditional — men source-fiksen (ekte side) er den målrettede, evidensbaserte fiksen.

## Prioritet
**På K3-stien** (⇄→timer krasjer). Bør fikses for å lukke K3 rent. Rammer ikke prod (ingen ⇄ der).

## ORDRE — struktur (a), fabel-valgt 2026-07-23. Ny branch `fix/timer-hjem-rute` fra develop
Gjør `/firma/timer` til ekte hjem-rute (én kanonisk), fjern redirecten fra nav-flaten.

1. **Flytt onboarding-innholdet inn i `/dashbord/firma/timer/page.tsx`** (i dag `redirect()`-stub). `TimerOnboardingSide`-komponenten (227 l, client, `firma/timer/onboarding/page.tsx`) blir hjem-siden. Rename gjerne til `TimerHjemSide`.
2. **`/firma/timer/onboarding/page.tsx` → `redirect("/dashbord/firma/timer")`** (for gamle lenker/bokmerker). Denne redirecten er UT av nav-flaten — ingen nav-element eller ⇄ peker på den → #310-mekanismen kan ikke gjenoppstå.
3. **Vilkår 1 — pek om alle interne referanser** til `/firma/timer/onboarding` → `/dashbord/firma/timer` i SAMME pass (cowork-målt, 3 stk utenom stubben selv):
   - `apps/web/src/app/dashbord/[prosjektId]/page.tsx:146` (hub-kort `href`)
   - `apps/web/src/app/dashbord/firma/timer/layout.tsx:25` (fane-`href`; vurder også fane-label «Onboarding» → «Hjem»/«Oversikt»)
   - `apps/web/src/lib/hub-ruter.ts:23` (`timerOnboarding`)
4. Firma-nav-href `/dashbord/firma/timer` (uendret) peker nå på ekte side → ⇄-paringa intakt (relpath `timer`).

**DoD (vilkår 2):** typecheck + build grønn + **prosjekt→firma timer-⇄ ×5 klikk uten krasj** (intermittensen var poenget); firma→prosjekt + HMS uendret; `/firma/timer/onboarding` direkte i adressefeltet lander på `/firma/timer`. Ikke merge — cowork diff-gate.
