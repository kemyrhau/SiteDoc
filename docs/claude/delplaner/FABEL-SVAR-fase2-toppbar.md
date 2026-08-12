# Fabel-svar — Fase 2, Toppbar.tsx:142 — 2026-08-10

Spørsmål: konvertere Toppbar.tsx:142 (gammel nav) eller la den fase ut med
gammel nav?

## Beslutning: KONVERTER — Kenneths anbefaling godkjennes

Begrunnelse:
1. **Rollback-veien går gjennom gammel nav.** `nyNavigasjon` er fortsatt flagg
   (bruker-lagret med enhets-fallback, pilot ~sept). Slås flagget av — for én
   bruker eller alle — skal firma-tilgangen fortsatt stemme. En gating som bare
   er riktig i ny nav er ikke en fullført Fase 2.
2. **Fase 2-DoD krever det allerede:** «Mathias-profilen får identisk opplevelse
   i gammel og ny nav» er umulig uten konverteringen.
3. **Kostnaden er marginal** når delt helper uansett bygges — én linje byttes
   til helper-kallet. Å la den stå ville etterlate nøyaktig den kodedivergensen
   Fase 2 skal fjerne, med utfasing som usikker slettedato.

Vilkår: konverteringen bruker samme delte helper som resten av Fase 2 — ingen
inline-variant i Toppbar.

— fabel (relayet av Kenneth)
