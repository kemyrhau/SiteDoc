---
name: ordre-arkivmal-funn-3-4-6-tilbehor-fabel-2026-08-21
description: To bugs (markør-koordinat-avvik, kommentarer som mangler i print) + Kenneth-vedtak om felt-tilbehør (kommentar/vedlegg/tegning per felttype).
til: redesign-Opus / kontrollplan (via Kenneth)
bakgrunn: Kenneth-skjermbilder test.sitedoc.no 2026-08-21 kl. 21:57–22:14 (BEF-runde 2)
sist_endret: 2026-08-21
---

# Ordre: funn #3, #4 og #6 fra Kenneths print-runde 2

## Funn #3 — BUG: oversikt og detaljutsnitt treffer ulike koordinater

Lokasjons-blokken i print viser prikken på ETT punkt i oversikten og et ANNET i
4×-detaljen (Kenneth-skjermbilde 22:04: oversikt-prikk ved O4/GR-V4-krysset, detalj-prikk
tydelig forskjøvet). Samme koordinat skal rendres to ganger — avviket betyr at én av
transformene er feil.

Måling FØR fiks:
1. Sammenlign koordinat-transformen i oversiktsrendringen mot crop-beregningen i
   detaljutsnittet (byggTegningPosisjon / byggDetaljUtsnitt). Kandidater: prosent regnet
   mot ulik referanse (original bildestørrelse vs skalert/rotert side), crop-vinduet
   klemt mot kant uten at markørposisjonen re-beregnes i det klemte vinduet, avrunding.
2. Negativ-test: markør nær tegningskant (der klemming slår inn) + markør midt på —
   begge skal treffe identisk punkt i oversikt og detalj.
Fiksen skal være delt: ÉN transform-funksjon begge rendringer bruker.

## Funn #4 — BUG: 4 kommentarer finnes, 2 printes

Kenneths dokument har 4 utfylte kommentarer (rad 1-kommentar, rad 2-kommentar,
repeater-nivå-kommentar, toppnivå-kommentar) — kun 2 kommer i PDF.

Måling FØR fiks: list hvor hver av de 4 er lagret (felt-sti/nivå) og hvilken rendringsvei
som mister dem. Hypotese å avkrefte/bekrefte: kommentar-tilbehøret samles bare inn på
noen nivåer (samme klasse som drawingId-funnet — innsamling som ikke går rekursivt ned).
Print-regelen etter fiks: ALLE utfylte kommentarer rendres hos SITT felt/nivå (radkort-
ordren pkt 3/5; objekt-nivå-innhold følger F7-ordren «Registrert utenfor rader»).

## Funn #6 — VEDTAK (Kenneth 2026-08-21): tilbehørs-matrise per felttype

I dag får hvert malobjekt automatisk tilbehør (kommentar + vedlegg + tegning + bilde) i
utfyllingsflaten. Det gir dobbelt sett tilbehørslinjer per felt (Kenneths skjermbilde
21:57/22:14), forvirring om hvilken tekst som hører til hva — og tekst brukere skriver i
tilbehør-kommentarer som så ikke printes (funn #4/tidligere info-tekst-sak er samme
symptomklasse).

DESIGNLÅS — tilbehør FJERNES fra disse felttypene (utfylling, begge flater):
- **Posisjon i tegning:** ingen kommentar, bilde, vedlegg, tegningsvedlegg
- **Lokasjon:** samme
- **Repeater (selve objektet, radnivå-tilbehøret):** samme — radens INNHOLD styres av
  barnefeltene i malen, ikke av automatisk tilbehør
- **Dato / Dato og tid:** samme
Øvrige felttyper beholder tilbehør som i dag. Kvitteres «designavvik: ingen» eller meldes.

Migrering (måles): finnes lagrede tilbehørsdata (kommentar/vedlegg) på felttyper som nå
mister tilbehøret? Tell i test + prod. Data skal aldri forsvinne stille — eksisterende
verdier vises lesbart (read-only) til Kenneth vedtar noe annet; kun NYREGISTRERING fjernes.

## Rekkefølge
#3 og #4 er print-korrekthet → samme løp som radkort-ordren (kontrollplan).
#6 er utfyllingsflate (web + mobil) → egen leveranse, kan gå parallelt.
`felt.ts` frosset som før. DoD som radkort-ordren (rotårsak, grønn build, designgate
linje for linje mot lås, dok-sync, merge via cowork).
