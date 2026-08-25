# @sitedoc/pdf — delt PDF-/HTML-generering

Rene HTML-streng-byggere, **null runtime-avhengigheter**. Brukes av:
- **Web:** arkiv-PDF (`apps/api/src/services/arkiv/render.ts` → pdf-render-container) + timer-rapport-PDF (`timer-rapport.ts` → samme container).
- **Mobil:** `expo-print` (Print.printToFileAsync({ html })).

Motoren (Playwright `page.pdf`) bor i den interne **pdf-render-containeren**; denne pakken bygger kun HTML-en. Ny dokumenttype = ny mal her, ikke ny motor.

## Moduler
- `arkivmal/` — sjekkliste-/oppgave-arkivdokument (ramme, felt, tegninger, signatur, repeater, logg).
- `timer-rapport.ts` — timer-rapport-dokument (firmatopp + sammendrag + detaljtabeller). Overskrifter injiseres oversatt (`TimerRapportTekster`) — ingen i18n i pakken.
- `hjelpere.ts` — `esc`, `formaterDato` m.fl.

## 🔴 Fallgruve: «grønt fordi ingenting kjørte» (2026-08-26)

`vitest` er en devDependency her, men var **ikke installert** i en ufullstendig lokal `node_modules`. Turbo-cachen **maskerte** det en hel sesjon: `pnpm typecheck`/`pnpm test` viste grønt fordi pdf-pakken alltid ble replayet fra cache — den ble aldri faktisk kjørt. Først en NY fil i `src/` invaliderte cachen → `tsc`/`vitest` kjørte → `sh: vitest: command not found` + «Cannot find module 'vitest'» i test-filene.

**Ikke en kodefeil.** Fiks: `pnpm install --frozen-lockfile` (fullfører installen, ingen lockfile-endring). Samme klasse som en gate-kjede som ikke gater: grønt uten at noe faktisk ble verifisert. Rør du `packages/pdf` og ser plutselig rødt her — sjekk installen før koden.
