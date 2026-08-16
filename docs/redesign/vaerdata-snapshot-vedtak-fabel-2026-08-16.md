# Værdata-vedtak (snapshot for befaringstidspunkt) + 360-video til backlogg

Dato: 2026-08-16 · fra fabel · Kenneth-vedtak 2026-08-16

## 🟢 KENNETH-VEDTAK: værdata er snapshot ved opprettelse

**«Værdata skal være snapshot av værdata tilgjengelig på lokasjon for befaringstidspunktet brukeren setter inn i sjekklisten»** (presisert av Kenneth 2026-08-16: tidspunktet er det brukeren FYLLER INN som befaringstidspunkt — ikke systemets opprettelsestidsstempel).

Målt nå-tilstand: `apps/api/src/routes/vaer.ts` (`hentVaerdata`) er et rent live-oppslag mot Open-Meteo (forecast for i dag/fremtid, archive for historiske datoer) — ingen lagring i ruta. Vedtaket krever at verdien **fryses i dokumentet**:

1. **Snapshot-tidspunkt = brukerens befaringstidspunkt** (dato/tid-feltet i sjekklisten). Verdien (temperatur, værkode, vind, nedbør for lokasjonens koordinat) hentes når feltet settes og lagres i `Checklist.data` på værfeltet. Visning og utskrift leser ALLTID lagret verdi — aldri nytt oppslag. **Endrer brukeren befaringstidspunktet, hentes nytt snapshot for det nye tidspunktet** (og gammel verdi overskrives — feltendringen fanges av endringsloggen som andre felt).

### 🟢 KENNETH-PRESISERING 2026-08-16 (hente-regel + feilretting)

**Regel:** vær hentes ÉN gang — når befaringstidspunktet settes. Rettet tidspunkt gir nytt vær. Endring i bilde eller tekst utløser ALDRI ny henting. **Værfeltet står tomt til befaringstidspunktet er satt** — en kontrollplan planlegges uker i forveien, og planleggingsdagens vær hører ikke hjemme i rapporten.

**Målt avvik i dagens kode** (`apps/web/src/hooks/useAutoVaer.ts`, verifisert 2026-08-16):
- Dato-feltet prefylles ved opprettelse → `kanHente` blir sann umiddelbart → dagens oppførsel henter i praksis **planleggingsdagens** vær. Feilretting: ingen prefill-utløst henting; feltet forblir tomt til brukeren aktivt setter befaringstidspunktet.
- Hooken leser alltid **kl. 12:00-verdien** for datoen (`klokke12Indeks`), uansett klokkeslett brukeren fyller inn. Skal bruke timen nærmest det innfylte klokkeslettet.
- Refetch trigges kun av dato-endring (`datoStreng` = `verdi.slice(0, 10)`) — endret klokkeslett samme dag gir ikke nytt snapshot. Skal trigge på hele tidspunktet.
- Bilde-/tekstendringer utløser ikke henting i dag (`harAutoFylt`-guard + manuell-kilde-vern) — den delen av regelen holder allerede.
2. **Offline-kanten er nesten borte med denne presiseringen:** befaringstidspunktet ligger typisk i fortiden eller nåtid, og archive-API-et i `vaer.ts` dekker historiske tidspunkt — snapshotet kan alltid hentes ved neste sync, for riktig tidspunkt og lokasjon. Merkes «hentet i ettertid» kun hvis det ble backfillet.
3. **Arkivmalen** rendrer lagret snapshot med tidsstempel («Vær ved befaring 14.08.2026 07:12 · 4 °C, lett regn, 6 m/s»). Mangler snapshot: eksplisitt «Ikke registrert» — aldri stille utelatelse, aldri dagens vær. Mangler befaringstidspunkt-felt i malen, har værfeltet ingen forankring — malbyggeren bør kreve/koble de to.
4. Dette avgrenser snapshot-klassen fra felttypekartleggingen: **weather er nå avgjort** (snapshot for brukerens befaringstidspunkt). persons/company/bim/zone/room + byggeplassnavn står igjen som felles beslutning (frysing ved terminal status er fortsatt kandidaten der — merk at klassene har ULIKT frysetidspunkt: vær forankres i befaringstidspunktet fordi det dokumenterer forholdene arbeidet ble utført under).

## Backlogg: 360-video (Street View-aktig)

Ingen video i malbygging nå. Senere: 360-visning på lokasjon, à la Google Street View. Føres som backlogg-sak i arkiv-/malbygger-sporet — egen felttype, eget lagrings- og visningsløp, ikke del av arkivmal-arbeidet. Instruksjonsvideo-typen (URL + «watched» i PSI) er uendret og hoppes fortsatt over i utskrift.
