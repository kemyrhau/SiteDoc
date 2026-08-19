# Ordre: smoketest av demo-løype før kundemøte (fabel → kode-Opus)

**Dato:** 2026-08-19 · **Frist:** i kveld — møtet er 2026-08-20
**Formål:** verifisere at demo-løypa Kenneth skal vise A. Markussen fungerer mot prod, og at demodata ligger klart. Ingen kodeendringer — kun verifisering og datapreparering. Avvik meldes, ikke fikses (rotårsak noteres; plasterfiks live-kvelden før møte er verre enn et kjent avvik Kenneth kan styre unna).

## Løype A — Timeføring
1. Ny timeføring på demo-prosjektet (`/dashbord/[prosjektId]/timer/ny`): opprett, verifiser at den vises i lista og i «Mine timer» (`/dashbord/timer/mine`).
2. Rediger en ført time (`timer/[id]`) — verifiser lagring.
3. Godkjenningsflaten (`timer/godkjenning`): verifiser at ført time dukker opp og kan godkjennes.
4. **Dataprep:** etterlat 3–4 førte timer på demo-prosjektet, minst én ugodkjent.

## Løype B — Dokumentflyt
1. Opprett befaringsrapport fra demo-malen på demo-prosjektet.
2. Fyll tekstfelt og last opp 2–3 bilder — verifiser at bildene vises i dokumentet.
3. Sett befaringstidspunkt — verifiser at værfeltet fylles (kjent avvik: dagens `useAutoVaer` henter ved opprettelse og låser til kl. 12:00; noter hva som faktisk skjer, ikke fiks).
4. Signering/godkjenning på web — verifiser hele flyten til godkjent.
5. Åpne dagens PDF av et godkjent dokument — verifiser at den genereres uten feil.
6. **Dataprep:** etterlat ett halvferdig dokument (til å fylle videre live) og ett godkjent med PDF.

## Løype C — Kontrollplan (lavere prioritet)
1. Åpne `/dashbord/[prosjektId]/kontrollplan` — verifiser at demo-planen laster.
2. Vis ett kontrollpunkt fra planlagt til utført med bilde — verifiser flyten.

## Kjente feller — styr unna eller verifiser
- **Papirkurv:** ikke slett demodata via papirkurven; endelig sletting er én-og-én og kurven er full av friksjon (kjent issue).
- **Repeater «Sak / Objekt / Observasjon»:** hvis demo-malen bruker den, sjekk hvordan `_`-labelen ser ut i web-skjemaet OG i PDF — Kenneth må vite hva Markussen vil se.
- Mobil: løype A1–A2 og B2–B3 skal også kjøres/verifiseres i mobil-viewport — det er telefonen Kenneth demonstrerer fra.

## Rapportformat
Kort liste per løype: ✅ fungerer / ⚠️ avvik (med skjermbilde eller feilmelding og fil/rute), pluss bekreftelse på at demodata ligger klart. Ingen fiksing uten egen ordre.
