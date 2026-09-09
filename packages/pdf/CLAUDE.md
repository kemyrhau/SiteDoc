# @sitedoc/pdf — delt PDF-/HTML-generering

Rene HTML-streng-byggere, **null runtime-avhengigheter**. Brukes av:
- **Web:** arkiv-PDF (`apps/api/src/services/arkiv/render.ts` → pdf-render-container) + timer-rapport-PDF (`timer-rapport.ts` → samme container).
- **Mobil:** `expo-print` (Print.printToFileAsync({ html })).

Motoren (Playwright `page.pdf`) bor i den interne **pdf-render-containeren**; denne pakken bygger kun HTML-en. Ny dokumenttype = ny mal her, ikke ny motor.

## Moduler
- `arkivmal/` — sjekkliste-/oppgave-arkivdokument (ramme, felt, tegninger, signatur, repeater, logg).
- **Grensekrav i PDF (grenseresolver trinn 3 del A):** tallfelt (`integer`/`decimal`/`calculation`)
  viser kravet i tre tilstander via `byggGrenseVerdi` (`hjelpere.ts`): innenfor `148 mm · krav
  140–160 mm`, utenfor `14 mm — OVER KRAV (krav ≤ 10 mm)` (fet amber), tom `Ikke utfylt (krav ≤ 15
  mm)`. 🔴 «UTENFOR KRAV» bæres av ORDET (s/h-print) — retningen skilles (UNDER/OVER/UTENFOR
  TOLERANSE). Pakken REGNER ingenting: kravet ligger ferdig i `FeltVerdi.grenseSnapshot = {kravTekst,
  status}` (søsken til `verdi`, aldri inni). api-laget bygger snapshotet (`services/arkiv/
  grensesnapshot.ts` → `injiserGrenseSnapshot`, rekonstruerer via `@sitedoc/shared/løsGrense`;
  del B lagrer et frosset snapshot ved lagring som vinner). `felt.ts` (rot) + `repeater.ts`
  `skalarCelle` (kompakt, brudd-ord i kolonnen) rendrer strengene. **Del C:** ved brudd bærer
  snapshotet også `avvikTekst` («Avvik: 4 mm over krav»), rendret som egen amber linje under verdien
  i `felt.ts` (rot). Avviksfeltene (Årsak/Tiltak) er vanlige barn-malobjekter — rendres som vanlige felt.
- **Tilføyelser i PDF (offline-kollisjon):** verdier som tapte en feltvis offline-kollisjon
  (kollisjonsmerge, api) bevares på feltet i `FeltVerdi.tilfoyelser` (søsken til `verdi`, aldri inni —
  samme mønster som `grenseSnapshot`). `byggTilfoyelser` (`hjelpere.ts`) rendrer dem MELLOM `verdi` og
  `kommentar` med overskrift «Også registrert — feltet hadde allerede verdien over» + verdi/hvem/når pr.
  rad (manglende navn → «Ukjent bruker»; tom liste → ingen boks). Kalt fra `felt.ts` (topp-nivå + frossen
  mobil-repeater via `renderFelt`) og `repeater.ts` (arkiv-tabellcelle). Egen `.tilfoyelse`-klasse i BEGGE
  css-filer (aldri `.kommentar`). 🔴 Hardkodet nb — arkiv-PDF har intet locale-lag (i18n er egen BACKLOG-sak).
  `TilfoyelsePdf` er strukturell kopiklasse av `apps/api/src/services/kollisjonsmerge.ts#Tilfoyelse` (kilden
  som skriver den); pdf importerer bevisst verken api eller shared.
- `timer-rapport.ts` — timer-rapport-dokument (firmatopp + sammendrag + detaljtabeller). Overskrifter injiseres oversatt (`TimerRapportTekster`) — ingen i18n i pakken.
- `hjelpere.ts` — `esc`, `formaterDato` m.fl.

## 🔴 Fallgruve: «grønt fordi ingenting kjørte» (2026-08-26)

`vitest` er en devDependency her, men var **ikke installert** i en ufullstendig lokal `node_modules`. Turbo-cachen **maskerte** det en hel sesjon: `pnpm typecheck`/`pnpm test` viste grønt fordi pdf-pakken alltid ble replayet fra cache — den ble aldri faktisk kjørt. Først en NY fil i `src/` invaliderte cachen → `tsc`/`vitest` kjørte → `sh: vitest: command not found` + «Cannot find module 'vitest'» i test-filene.

**Ikke en kodefeil.** Fiks: `pnpm install --frozen-lockfile` (fullfører installen, ingen lockfile-endring). Samme klasse som en gate-kjede som ikke gater: grønt uten at noe faktisk ble verifisert. Rør du `packages/pdf` og ser plutselig rødt her — sjekk installen før koden.
