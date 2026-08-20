# Referat + prioritert ordreliste etter kundemøte A. Markussen (fabel, 2026-08-20)

**Kilde:** Kenneths møtenotater 2026-08-20. **Prioritet vedtatt av Kenneth: timerhullene først.**
**Helhetsinntrykk fra kunden:** «mange klikk» — føres som gjennomgående redesign-krav, ikke egen sak.

---

## ORDRE 1 — 🔴 Timer: sync-feil og konflikt (haster, bugs i prod-løypa)

Til kode-Opus. Kartlegg rotårsak FØR fiks — dette er datakorrekthet i kundens viktigste funksjon.

### 1a. Splitt timer dobler timetall i mobilappen
Server/web viser rett antall; mobilens SQLite synker ikke slettede timerader/dagskort. Splitten skaper nye rader, de gamle slettes på server, men sletting propageres ikke til lokal SQLite → begge sett vises. Kartlegg: hvordan propageres delete i sync-protokollen (tombstones? full refresh?), og hvorfor når de ikke klienten. Rotårsaksfiks i sync-laget — ikke en klient-dedup som maskerer.

### 1b. Dobbeltføring play + dagskort gir konflikt
Samme tid ført via timer-play OG dagskort kolliderer. Kartlegg: hva skjer i dag (duplikat? feilmelding? taus overskriving?), og foreslå konfliktregel til fabel-gate. Innstilling fra fabel: de to inngangene skal skrive til samme dagskort-rad — play er en annen måte å fylle samme felt, ikke en egen kilde. Verifiser mot koden om det er gjennomførbart.

### 1c. Excel-eksport må fungere
Verifiser dagens eksport ende-til-ende og meld hva som feiler. (Kundekrav, uspesifisert hva som er galt — mål først.)

## ORDRE 2 — Attestering: sammenligningsvisninger + overtidsvarsel (funksjonelt krav fra kunden)

Design + implementering, fabel-designgate før prod:

- Visning 1: timer **per prosjekt, alle ansatte**, per dag / per uke.
- Visning 2: timer **per ansatt**, per dag / per uke.
- **Overtidsregel:** standard arbeidstid 40 t/uke. Overtid kan ikke føres når ukesum < 40 ordinære timer. Er det ført 40 timer hvorav noe er 50 %-tillegg, varsles attestant. Regelverket (grensen, varselterskel) skal ligge ETT sted i shared — ikke dupliseres web/mobil.
- Attestering henger sammen med eksisterende backlog-sak «for mange klikk ved åpning av dagskort» — løses i samme designrunde.

## ORDRE 3 — Kontrollplan: to bugs fra møtet (etter timer)

### 3a. Kart-klikk åpner feil sjekkliste
Klikk på kontrollplan-markør i tegning åpner ikke den trykkede sjekklisten, og ingen hover/tooltip viser hvilken sjekkliste/kontrollpunkt markøren er. To deler: treff-logikken (feil punkt åpnes) + identitet på markøren (tooltip med malnavn + punkt).

### 3b. Flytting av punkt i tegning mister kontrollplanpunktet
Åpne sjekkliste fra kontrollplan → lokasjoner → flytt punkt → markøren forsvinner fra tegningen og gjenopprettes ikke på ny posisjon. Trolig samme flate som KP L2-plasseringsflyten — kartlegg om flytt-veien skriver posisjon til et annet objekt enn render leser.

## ORDRE 4 — Malarkiv (nytt funksjonskrav, design før kode)

To nivåer, vedtatt i møtet:
1. **Firma-malarkiv:** nytt prosjekt henter HMS-, sjekkliste- og oppgavemaler fra firmaets arkiv.
2. **SiteDoc-malarkiv:** sentralt arkiv firmaer kan låne maler fra.

Dette er en modell-/designsak (eierskap, kopiering vs. referanse, versjonering ved malendring) — fabel lager designnotat før noen ordre går til kode. Berører `faggruppe.kopier`/`prosjekt.opprett`-seedingen som allerede er kartlagt.

## Rekkefølge og status

1 (timer-bugs) → 2 (attestering) → 3 (KP-bugs) → 4 (malarkiv-design).
Innboks-sakene (flytmodell A–D, KP-start a/b/c, granularitet, paritetsmatrise) står bak disse, unntatt der de overlapper: KP-start-beslutningen tas sammen med ordre 3 hvis Opus er inne i samme flate.

«Mange klikk»-inntrykket: hver ordre over skal telle klikk før/etter som del av DoD.
