---
name: qa-rapport-2026-05-17
description: QA-rapport av timer-flyt etter T7-4f + T7-5b-bunken på test.sitedoc.no
sist_verifisert_mot_kode: 2026-05-17
---

# QA-rapport — SiteDoc Timer 2026-05-17

Etter merge av T7-4f-bunken (mockup v7-redesign) + T7-5b-bunken
(modal-arkitektur for redigering) + `maskin-fra-til` til develop og
deploy til test. Funn dokumenteres for prioritering.

## FLOW 1 — Ansatt registrerer dagsseddel (`/dashbord/timer/[id]`)

### A1 — KRITISK: Timer-rad mangler Fra/Til

`TimerRadDialog` (`apps/web/src/app/dashbord/timer/[id]/page.tsx` ~linje 990):
modal har Lønnsart + Aktivitet + Antall timer + Underprosjekt. Fra/Til
mangler. Ansatt registrerer kun antall, ikke tidspunkt.

### A2 — Maskin-forslag bruker standardtid, ikke sedel-tid

`MaskinRadDialog` foreslår `orgSetting.standardSluttTid` (15:00) i stedet
for `sedel.tilTid` (15:30) fordi timer-raden mangler `fraTid`/`tilTid`.
Kobling: timer-rad uten fraTid → Alt D faller tilbake til standard.

### A3 — KRITISK: Vareforbruk ikke integrert i dagsseddel

Ingen vareforbruk-seksjon i `timer/[id]/page.tsx`. Eksisterer som separat
modul. Ansatt kan ikke registrere varer der timer registreres.

### A4 — Maskin visuelt løsrevet fra timer

Maskin er i egen MASKINTIMER-seksjon, ikke knyttet til spesifikk
timer-rad. Brukeren ser ikke sammenhengen.

### A5 — Pause ikke registrert gir uklart varselsignal

Dagsseddel viser «7.50t av 8.50t registrert» i gult. Uklart at det skyldes
manglende pause-registrering.

### A6 — Fritekst/kommentar mangler per timer-rad

Kun `daily_sheets.beskrivelse` per sedel. Ingen kommentar per timer-rad.

### A7 — Ingen uke-oversikt for ansatt

`/timer/mine` viser flat liste av sedler. Ingen uke-kalender (T7-5a
ikke bygget).

## FLOW 2 — Leder attesterer (`/dashbord/firma/timer/attestering`)

### B1 — KRITISK: Rediger-modal for smal

`RedigerSeddelModal` bruker `max-w-3xl` (512px på 1512px-skjerm). Spec
sier `max-w-[80vw]`. Feil i `Modal.tsx` som ikke tar `className`-prop.
Fix er sendt men ikke bekreftet deployet.

### B2 — KRITISK: «null null (Heatwork 7626)»

Maskinnavn vises som «null null» + ID. Rotårsak: maskin-rad i testdata
mangler `vehicleName` eller vehicle-join returnerer null for fornavn/
etternavn-felt. Gjelder alle maskin-rader i attestering-lista.

### B3 — Varer ikke vist i attestering-liste

Vareforbruk ikke integrert (avhenger av A3).

### B4 — Maskin (9.00t) > Arbeid (8.50t) — ingen advarsel

Per Prosjektadmin-sedel: maskin overstiger betalt arbeidstid. Pause-avvik.
Ingen rød indikator i SeddelKort (sum-indikatoren mangler for
tilleggskrav-sedler, se B5).

### B5 — Sum-indikator mangler for tilleggskrav-sedler

Ola Tømrer har grønn «Maskintimer X av arbeidstimer Y». Per Prosjektadmin
har det ikke. Mulig betinget rendering-bug i `SeddelKort.tsx`.

### B6–B10 — fungerer ✅

- B6 — 1-klikk penn fungerer (T7-5b-4 OK)
- B7 — Fra/til vises på timer og maskin
- B8 — Underprosjekt/ECO synlig
- B9 — Tilleggskrav oransje
- B10 — Fritekst vises

## Prioritert rekkefølge (én fix per commit, typecheck mellom hver)

1. **B1** — Modal-bredde (liten, isolert)
2. **B2** — `null null` maskinnavn (liten, isolert)
3. **B5** — Sum-indikator mangler (liten, isolert)
4. **A1** — Timer-rad fra/til (medium, planlegges separat)
5. **A3** — Vareforbruk i dagsseddel (stort, separat planleggingssesjon)

## Kode-funn per avvik

### A1 — TimerRadDialog mangler fra/til
Lokasjon: `apps/web/src/app/dashbord/timer/[id]/page.tsx:990–1183`. State har
ikke `fraTid`/`tilTid` (kun lonnsartId, aktivitetId, timer, ecoId).
Server `timer.tilfoy`/`oppdater` aksepterer dem allerede (T.4 PR 1B).

### A2 — Konsekvens av A1, ingen egen fix
`MaskinRadDialog`-fallback fungerer som designet (Alt D). Når A1 er
implementert, vil fra/til-forslag bli korrekt automatisk.

### A3 — Vareforbruk separat modul
`packages/db-timer/prisma/schema.prisma` har ikke `SheetVareforbruk`.
Vareforbruk er per-prosjekt (`apps/api/src/routes/vareforbruk.ts`,
`apps/web/src/app/dashbord/[prosjektId]/vareforbruk/page.tsx`). Krever
schema-utvidelse + integrasjons-plan.

### A4 — Visuell kobling timer↔maskin
SeddelKort viser maskin indentert under timer i attestering-listen
(T7-4f-3b). Men i `timer/[id]/page.tsx` for ansatt vises maskin
fortsatt i egen seksjon under timer-rader. EcoGruppe bygger to
underseksjoner per ECO-bucket, ikke flettet rader.

### A5 — Pause-uklarhet
Sedel-header har pause som eget felt (`pauseMin`). UI gir ikke tydelig
forklaring når sum(timer) < (slutt − start − pause). Krever bedre
varseltekst i SummeringsBanner-tilsvarende på web.

### A6 — Kommentar per rad
Schema `SheetTimer` har ingen `kommentar`-kolonne (kun `SheetTillegg`).
Krever schema-utvidelse.

### A7 — Uke-grid
`/timer/mine` (`apps/web/src/app/dashbord/timer/mine/page.tsx:358`)
viser flat tabell. T7-5a (uke-grid) planlagt men ikke bygget.

### B1 — Modal-bredde
Fikset 2026-05-17 i commit `92774103` —
`packages/ui/src/Modal.tsx:49` har smart regex-fallback. Bekreftet
deployet til test (HTTP 200 etter restart 224670 → 225744).

### B2 — null null maskinnavn
`apps/web/src/components/attestering/SeddelKort.tsx:138–142`:
`maskinNavn` konkatener `${e.merke} ${e.modell}` uten null-sjekk.
Når equipment-rad i DB har merke/modell = null/tom streng, gir
det «null null» eller «  (Heatwork 7626)».

### B3 — Konsekvens av A3, ingen egen fix

### B4 — Ingen rød advarsel ved maskin > arbeid
Server `validerMaskinUnderArbeid` (T7-4b) blokkerer registrering hvor
maskin > arbeid i samme bucket. Men eksisterende rader (registrert før
validering, eller med pause-overlapp) blokkeres ikke ved visning.
SeddelKort har ingen visuell rød markering på sum-rad.

### B5 — Sum-indikator betinget rendering
`apps/web/src/components/attestering/SeddelKort.tsx` — ny tabell-layout
(T7-4f-3b) erstattet ProsjektSectionAttest. Sum-raden viser kun
`totaltimer` (linje ~318), ikke `maskin-av-arbeid`-validering. Den
grønne/røde validerings-raden fra `EcoBucketAttest` (i
`attestering-buckets.tsx:1102–1115`) brukes ikke i listen, kun i
detaljside (via ProsjektSectionAttest).

## Status

Fix B1 (Modal-bredde) er deployet til test. B2 og B5 venter på
implementasjon. A1–A7 krever større arbeid og planlegges separat.
