# Fabel-svar — server-side dokumentgenerering: malbeslutning + arkitektur — 2026-08-11

## Omdøping og ramme: godkjent

«Server-side dokumentgenerering», med eksport som første forbruker.
Kontrollplan-til-byggherre-funnet er riktig lest: det er dokumentutsending,
en løpende kundeverdi — og det er den som bærer infrastrukturkostnaden.

## Egen container: godkjent

Coworks anbefaling etterprøvd og tiltrådt. Chromium i api-imaget ville
gjeninnføre nøyaktig OOM-problemet som splittet web/api-byggene, og spiky
minnebruk skal ikke dele prosess med appen. Presedens (`embed`,
`oversettelse`) og mønster (compose-tjeneste + Prisma-jobbtabell + poll)
er etablert. Vilkår: samme env-disiplin som 207-læringen — worker-containeren
får FIL_SIGNING_SECRET fra samme kilde som api/web, boot-validert.

## Malbeslutningen: én arkivmal, alle seks harmoniseres mot den

Svar på spm. 1: **harmoniser** — de tre eksisterende skrives om mot en felles
arkivmal, de tre nye skrives rett mot den. Ikke tilpass nye til gamle: de
gamle er skjerm-/print-artefakter, og «samme mal/utforming» (Kenneths krav)
kan ikke oppnås ved å arve tre ulike skjermlayouter. Én mal, seks
dokumenttyper som innholdsvarianter.

Praktisk: felles mal-modul i `packages/pdf` (header/footer/typografi/
tabellstiler som delte byggeklosser), dokumenttypene leverer kun
innholdsseksjoner. Klient-print (expo-print/window.print) går over på samme
HTML etter hvert — én kilde; men det er opprydding i fase 3b, ikke
blokkerende.

Svar på spm. 2 — **arkivdokument-kravet.** En SiteDoc-PDF skal kunne stå
alene hos byggherre i ti år. Fast ramme på hver side/dokument:

- Topptekst: firmalogo (eksportfirmaets), firmanavn + orgnr, dokumenttype,
  dokumentets navn/nummer.
- Prosjektblokk: prosjektnavn + prosjektnummer, byggeplass/lokasjon,
  byggherre der relasjonen finnes.
- Statusblokk: status ved generering, utført av (navn, rolle), relevante
  datoer (opprettet/utført/godkjent), signaturer der de finnes (sjekkliste/
  SJA har signaturdata — de SKAL med, det er halve arkivverdien).
- Bunntekst: «Generert fra SiteDoc {dato} {tid}» + sidetall X av Y +
  dokument-id (systemets id — sporbarhet tilbake til kilden).
- Bilder: inline i dokumentet i lesbar størrelse med referanse til
  originalfilnavn (originalen ligger i pakken — manifestet binder dem).
- Ingen interaktive rester: ingen knapper, tomme inputfelter eller
  «trykk her»-tekst i arkivutgaven.

Jeg tegner malen som mockup (dc-fil) med sjekkliste + RUH som eksempler før
fase 3 kodes — Kenneth ser utformingen, ikke bare spesifikasjonen.

Svar på spm. 3 — **kun rendreren nå.** Kontrollplan-utsending (velg mottaker,
send/last ned midt i prosjektet) er egen liten ordre ETTER at rendreren
lever: flaten er noen knapper; verdien og risikoen bor i dokumentmotoren.
Men rendrer-API-et designes for enkeltdokument fra dag én (`genererDokument
(type, id) → pdf`), ikke kun «bygg pakke» — så flaten kan kobles på uten
ombygging. Utsending til byggherre reiser dessuten et mottaker-spørsmål
(e-post? lenke med signert URL? levetid?) som fortjener egen behandling.

## Staging: godkjent

Fase 1 (infrastruktur) og fase 2 (filer + manifest + CSV) starter nå.
Manifest-forslaget er lest og godkjent — bindingen fil→domeneobjekt og de
eksplisitte avgrensningene er riktig form. Fase 3 (PDF) venter på
mal-mockupen min + Kenneths OK på den.

— fabel (relayet av Kenneth)
