# Ordre til redesign-Opus: Produkttekst-gjenkjenning + tidssoneregel (v2)

**Fra:** fabel · **Dato:** 2026-09-02 · **Status:** ordre v2 — 1a omskrevet etter coworks kodegating; resten uendret fra v1
**Grunnlag:** designnotat-produkttekst-vs-firmainnhold-fabel-2026-09-02.md (v2), V1–V4 Kenneth-vedtatt 2026-09-02.
**Kvalitetskrav (prosjektstandard):** rotårsaksfiks fremfor plaster, delte kilder fremfor duplisert logikk, verifisering mot faktisk kode før beslutninger, eksplisitte guards.

## Endring fra v1 (coworks funn)

v1 antok opsjonssett i `defaultConfig.options` per type. Målt: `options` er tom for `list_single`/`list_multi` på typenivå — de norske verdiene ligger i STANDARDMALENES felt-definisjoner, per instans, og samme type har ulike sett i ulike maler (types/index.ts :516, :520, :547, :554, :594). `type → nøkkel` virker derfor ikke for opsjoner.

**Avgjørelse: tabellen blir STRENG-basert for opsjoner.** Gjenkjenning på strengen selv, én oppføring per streng. Det er trygt av samme grunn som labelenes falsk positiv-argument: eksakt match på en norsk streng VI har skipet gir den kuraterte oversettelsen av nøyaktig den strengen — type-scopingen var aldri bærende for korrekthet, bare for organisering. Feltlabels beholder type-tilknytning i tabellen (dokumentasjon + test-presisjon), men oppslaget kan gjerne være samme mekanisme.

## Vedtakene som implementeres

- **V1:** Seedede standardlabels gjenkjennes ved rendering og oversettes via i18n; firmaets egne labels forblir firmainnhold (Globe on-demand).
- **V2:** Seedede opsjonsstrenger omfattes av samme regel.
- **V3:** PDF genereres på kildespråket. Oversettelse er skjermlesehjelp — vises, lagres aldri. Grensen går mellom ARKIVERING og VISNING: gjenkjenningsregelen gjelder fullt ut i web og mobil.
- **V4:** Dato-verdier: språk/format følger LESERENS locale; TIDSSONE følger PROSJEKTETS lokasjon. To lesere skal aldri se ulikt klokkeslett for samme hendelse.

## Del 1 — Gjenkjenningstabell i shared (V1+V2)

### 1a. Tabellen (OMSKREVET)

Ny modul i `packages/shared/src/` (forslag: `standardtekster.ts`, eksporteres fra index). To domener, samme oppslagsmekanisme:

**Feltlabels** — per `ReportObjectType`: `{ type, nokkel, gjeldende, aliaser }`. Nøklene finnes allerede (`malbygger.datoOgTid` osv. i alle 17 språkfiler); verifiser hver mapping mot `nb.json` (merk avvik som `malbygger.dato_felt` for `date`).

**Opsjonsstrenger** — STRENG-basert, én oppføring per seedet streng: `{ nokkel, gjeldende, aliaser }` uten type-binding. Kilde-inventar ved implementasjon, med fil/linje:
1. `REPORT_OBJECT_TYPE_META` defaultConfig-opsjoner (i dag kun `traffic_light`: Godkjent/Anmerkning/Avvik/Ikke relevant).
2. Standardmalenes felt-definisjoner i types/index.ts — målt minimum: Type observasjon (:594 Nestenulykke · Farlig forhold · Risikoobservasjon · Forbedringsforslag), Alvorlighetsgrad (:547 Lav · Middels · Høy · Kritisk), Status (:554 Åpent · Under behandling · Lukket), Beslutning (:520 Godkjent · Delvis godkjent · Avvist · Ikke behandlet), Type (:516 Tillegg · Fradrag · Regulering · Annet). Kartlegg UTTØMMENDE — gå gjennom alle seedede felt-definisjoner, ikke bare de fem målte.
3. Kolliderer to seedede strenger (samme streng i to sett), er det ETT tabelloppslag og ÉN oversettelse — det er korrekt per streng-prinsippet; ingen duplikater i tabellen.

Nye i18n-nøkler for opsjonsstrengene (f.eks. `standardopsjon.nestenulykke`) legges til i ALLE 17 språkfiler i samme PR — ingen delleveranse som faller tilbake til norsk for noen språk. **RUH-kategoriene prioriteres i verifiseringen:** en polsk arbeider som melder nestenulykke skal se kategoriene på polsk — det er flaten som finnes for at farlige forhold skal bli meldt.

**Lagrede VERDIER:** for `list_single`/`list_multi` kan lagret verdi være selve label-strengen (jf. `normaliserOpsjon` i web typer.ts: string → {value: label}). Gjenkjenningen gjelder derfor også ved rendering av lagret verdi i lesevisning, ikke bare valglisten. Verifiser lagringsformatet ved implementasjon og dekk begge flater.

### 1b. Alias-regimet (🔴 påbud, ikke «husk å»)

- Aliasene bor I SAMME FIL som tabellen (`standardtekster.ts`), append-only per nøkkel.
- **Vitest-test i shared som håndhever plikten**, nå over BEGGE kilder: for hver type asserter testen at `REPORT_OBJECT_TYPE_META[type].label` finnes i tabellen, OG testen vandrer alle seedede opsjonssett (META-defaults + standardmalenes felt-definisjoner) og asserter at hver opsjonsstreng finnes blant `gjeldende ∪ aliaser`. Omdøping/nytt seedet sett uten tabellføring → rød CI. Plikten håndheves av testen, ikke av hukommelse.
- Filhode-kommentar i META/seed-definisjonene og standardtekster.ts som peker på hverandre og på testen.

### 1c. Renderregel

Delt hjelpefunksjon i shared (f.eks. `oversettStandardtekst(streng, t): string | null` — null = ikke standardtekst; label-varianten kan ta type for presisjon):

- **Web:** `FeltWrapper.tsx` (label) + opsjonsrendrende komponenter (`TrafikklysObjekt`, `EnkeltvalgObjekt`, `FlervalgObjekt` m.fl.) — treff → `t(nøkkel)`; ellers rå streng + eksisterende Globe-flyt uendret.
- **Mobil:** samme hjelpefunksjon i mobil-ekvivalenten (kartlegg renderstedet i apps/mobile først).
- **PDF (V3):** `packages/pdf` fortsetter på kildespråk — INGEN endring i utgang. Ikke koble pdf-pakken på tabellen; pdf importerer bevisst ikke @sitedoc/shared (bekreftet av cowork-gating: alle treff er kommentarer som sier nettopp det). Fencen står.
- Ingen endring i API, skjema eller lagrede data. Ingen migrering.

### 1d. Verifisering del 1

- «Dato og tid»-caset: polsk bruker ser «Data i godzina» på seedet felt; firma-omdøpt felt («Kum/sluk kontrollert») vises rått med Globe.
- RUH-caset: polsk bruker ser Type observasjon-kategoriene på polsk i valglisten OG i lesevisning av lagret verdi.
- Redigert standardstreng (avviker én karakter) → firmainnhold.
- Alias-testen rødner ved simulert META-omdøping uten alias, og ved seedet opsjonsstreng som mangler i tabellen.
- PDF-utgang byte-identisk før/etter for et referansedokument.

## Del 2 — Tidssone (V4): MÅLING FØRST (🔴 gate)

**Tidssone er IKKE målt i koden. Ingen implementasjon før måling foreligger og fabel har vurdert den.** Konsekvensen av feil er lønnsutbetaling til ~50 ansatte i pilot.

### 2a. Målingen skal besvare, med fil/linje-referanser

1. `fraTid`/`tilTid` i SheetTimer lagres som String «HH:MM» — i HVILKEN sone tolkes de ved (a) registrering på mobil, (b) visning på web, (c) lønnseksport? Følg hele kjeden registrering → lagring → eksport.
2. Bruker timeregistreringen enhetens sone, serverens, eller prosjektets i dag? Finnes prosjekt-tidssone i datamodellen (Prisma-skjema), eller må den avledes/innføres fra prosjektlokasjon?
3. Hvilke andre flater viser klokkeslett (dokumenthendelser, endringslogg, datotid-felt) og hvilken sone bruker de?
4. Hva skjer i dag når registrerende enhet står i annen sone enn prosjektet (utenlandsk arbeider med hjemlandets enhetsinnstilling)?

### 2b. Etter måling

Målerapport → fabel vurderer → egen implementasjonsordre. Del 2 har INGEN kodeendring i denne ordren. Om målingen viser at «HH:MM»-strengene i praksis er sonefri lokal byggeplasstid, kan riktig fiks være liten eller null — det avgjøres av fakta, ikke antas.

## Rekkefølge og leveranse

Del 1 og målingen i del 2a kan gå parallelt; del 2b venter på fabel. Exit-protokoll som vanlig: verifisert mot kjørende kode, dokumentasjonssync ved exit.
