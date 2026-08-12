# Fabel — DESIGNGODKJENNING Fase 2 (én lesekilde) — 2026-08-11

Branch `fase2-firmarolle-enkilde` (`99b960df`). Vurdert mot ordre v2 og de fem
sjekkpunktene. **GODKJENT — klar for commit/merge.** Kenneth relayer til cowork,
som eier merge-timing og deploy.

## Vurdering per sjekkpunkt

1. **Toppbar via delt helper** — godkjent. `!erSitedocAdmin`-avgrensningen er
   riktig og prinsipielt ren: den endrer ikke KILDEN (fortsatt helper/firmaRoller),
   bare presentasjonsvalget for superadmin (velger, ikke fast lenke).
2. **Badge fra medlemsrader** — godkjent, inkludert resonnementet. «Kan jeg
   administrere» og «er den andre firma-admin» er to spørsmål med én kilde;
   å tvinge dem gjennom samme funksjon hadde vært falsk gjenbruk. Kravet mitt
   var én KILDE, ikke én funksjon — oppfylt.
3. **`erCompanyAdmin` fjernet** + alle fire konsumenter konvertert — godkjent.
4. **Grep-klassifiseringen** — godkjent. N=1-verifiseringen av punktfiksen og
   den eksplisitte restlisten (divergensvakten + `admin.ts:455` → Fase 3) er
   nøyaktig den formen jeg ba om.
5. **Mathias-DoD** — godkjent. At firma-lenken var skjult for ham i gammel nav
   FØR Fase 2 og synlig etter, er selve beviset på at konverteringen traff.

## Presiseringen om divergensvakten: riktig, og skal vernes

At vakten fortsatt warner for Mathias er korrekt oppførsel — kode-divergensen
er lukket, data-divergensen er Fase 3. To krav følger:
- Rapport-formuleringen («ikke 'løs' warningen ved å endre Mathias' rolle»)
  skal også inn som kodekommentar ved selve warn-punktet i vakten — folk leser
  koden, ikke rapporten.
- Mathias-profilen røres ikke før Fase 3 — den er eneste levende testcase.

## Vilkår (ikke merge-blokkerende, men skal med)

- Dokumentasjonssync ved exit per rammeverket: masterplan/statuskilde oppdateres
  med Fase 2 = merget når cowork har merget, og Fase 3 markert «venter stabilitet
  i prod, migreringsgate hos Kenneth».
- Fase 3 forblir uåpnet til Kenneth eksplisitt bestiller den.

— fabel (relayet av Kenneth)
