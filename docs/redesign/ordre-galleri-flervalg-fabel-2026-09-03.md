# Ordre: Flervalg fra galleri med brukerens rekkefølge (mobil)

**Fra:** fabel · 2026-09-03
**Til:** redesign-Opus (mobil)
**Bakgrunn:** Kenneth vil velge flere bilder fra galleriet i ett grep, og nummereringen (`bildeNr`) skal følge rekkefølgen HAN trykker dem i — ikke telefonens bibliotek-rekkefølge. I dag finnes kun enkeltvalg (`velgBilde`, `apps/mobile/src/services/bilde.ts:167`), så rekkefølgen er trivielt riktig. Med flervalg blir den feil hvis vi ikke gjør dette eksplisitt.

## Kravet som ikke kan fravikes

`expo-image-picker` returnerer flervalg i **bibliotekets rekkefølge** som standard. Flagget `orderedSelection: true` gir trykk-rekkefølgen (iOS). Uten det får Kenneth nøyaktig buggen han spør om: velg bilde 3, 7, 1, 9 → nummerert etter opptakstidspunkt, ser ut som tilfeldig feil. Flagget SKAL settes, og verifiseringen SKAL bevise trykk-rekkefølge (se under).

## Omfang

1. **Ny funksjon `velgBilder(maksAntall?, gpsAktivert = true): Promise<BildeResultat[]>`** i `services/bilde.ts`:
   - `launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1, allowsEditing: false, allowsMultipleSelection: true, orderedSelection: true, selectionLimit: maksAntall ?? 0 })` (0 = ubegrenset).
   - Komprimer hvert asset via eksisterende `komprimer` (HEIC→jpg-pipeline gjenbrukes — ingen duplisert logikk).
   - GPS: hent posisjon ÉN gang og sett samme på alle (dagens semantikk: posisjon ved valg, ikke ved opptak). Ikke N GPS-kall i løkke.
   - Returner array i **assets-rekkefølgen** — den ER trykk-rekkefølgen når `orderedSelection` er satt. Ingen sortering, ingen `Promise.all` som kan stokke om resultatlisten (map + await i rekkefølge, eller `Promise.all` med indeksbevarende map — begge OK så lenge output-indeks = input-indeks).
   - Behold `velgBilde` som tynn wrapper (`(await velgBilder(1))[0] ?? null`) så TilleggSeksjon/UtleggSeksjon (ett bilde per utlegg) er urørt.

2. **Kobling i `FeltDokumentasjon.tsx` (mobil, ~linje 185–200):** galleri-knappen kaller `velgBilder()` og legger til vedleggene i returnert rekkefølge, i ETT statekall (én `leggTilVedlegg`-batch eller sekvensielle kall som bevarer rekkefølgen — ikke parallelle callbacks som racer om `nesteBildeNr`).

3. **Nummerering — ingen endring i hooks:** `useSjekklisteSkjema.ts:509` / `useOppgaveSkjema.ts:499` tildeler allerede løpende `bildeNr` per dokument til bilder uten nummer. Kravet er kun at batchen ankommer i valgt rekkefølge. Repeater 1 med 4 valgte → 01–04, repeater 2 med 4 → 05–08. Skriv en enhetstest som beviser at en batch på 4 vedlegg får sammenhengende stigende nummer i input-rekkefølge.

4. **Android-forbehold:** `orderedSelection` er dokumentert iOS-only. Verifiser på Android-enhet/emulator hvilken rekkefølge Photo Picker gir; hvis den ikke er trykk-rekkefølge, rapporter funn til fabel FØR evt. workaround — ikke bygg egen velger på spekulasjon.

## Definition of Done

- typecheck + lint + eksisterende tester grønt.
- Simulator-bevis (iOS): velg 4 bilder i BEVISST omvendt bibliotek-rekkefølge (nyeste først) i repeater 1 → miniatyrer viser 01–04 i trykk-rekkefølge; deretter 4 fra repeater 2 → 05–08. Skjermbilder som bevis.
- PDF-kontroll: nummer i arkiv-PDF matcher appen (bildeNr har forrang — allerede dekket av test «bildeNr fra appen har forrang over telleren», skal fortsatt være grønn).
- Android-funn rapportert (punkt 4) selv om det bare er «samme som iOS».

## Ikke i denne ordren

- Endringer i web-`FeltDokumentasjon`.
- Flervalg i Tillegg/Utlegg (ett bilde per utlegg er bevisst).
- Bygg 51-scope: dette er en egen sak, ikke del av røyklisten.
