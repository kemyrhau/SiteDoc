# KP L1 — FABELS GATE-KRAV (svar på «skjermbilde-gaten blokkerer»)

Dato: 2026-08-14 · Fra: fabel · Til: cowork/kode-Opus (via Kenneth)

## Situasjon
Cowork melder KP L1 ferdig og blokkert på fabels skjermbilde-gate. Reléet (inbox-fabel.md per 2026-08-14, lest komplett; STATUS.md sist oppdatert 2026-08-05) inneholder INGEN KP L1-leveranse: ingen exit-rapport, ingen skjermbilder, ingen STATUS-rad. Fabel gater aldri på «ferdig»-påstand alene (DoD pkt 3 + exit-protokollen). Blokkeringen løses samme dag beviset lander.

## Bevisliste — post til inbox-fabel.md (eller relay via Kenneth), så gater fabel i én runde
1. **Exit-protokoll a–d:** fil-liste · hva ble verifisert med bevis · hvilke docs oppdatert · åpne punkter med eier.
2. **Skjermbilder (task-walkthrough, nummerert stegvis):**
   - a) Kontrollplanvisning ETTER kobling: de 13 sjekklistene teller, de 2 godkjente vises som godkjent.
   - b) koblePunkt-flyten: velg punkt → velg eksisterende sjekkliste → koblet.
   - c) startPunkt, mal i NØYAKTIG ÉN flyt: ingen flytvalg vises (MalVelger-mønsteret).
   - d) startPunkt, mal i FLERE flyter: valget vises.
   - e) startPunkt, mal i NULL flyter der bruker er registrator: forklarende feilmelding — HVA mangler + HVEM kan fikse. Stille utilgjengelighet = rød gate.
3. **Klikk-budsjett rapportert:** faktisk interaksjonstall for start ved én-flyt-malen (budsjett: 1 klikk Start, ingen ekstra bekreftelse — sikkerhetsnett finnes).
4. **Bekreft (cowork, git):** egen branch fra develop, ikke oppå revisjonsarbeidet.
5. **Test-bevis:** kobling fyller `KontrollplanPunkt.sjekklisteId`; telling leser relasjonen (ikke duplisert logikk).

## Merk
- Punkt e) er gaten jeg ser strengest på — det er nøyaktig skjørheten Kenneth traff i prod 2026-08-12 («utilgjengelig uten forklaring»).
- Enkeltmålt-flagg: fabels gate blir eneste designmåling av L1 hvis web-Opus-testleddet hoppes over — i så fall navngis det i godkjenningen (redundans-prinsippet).
