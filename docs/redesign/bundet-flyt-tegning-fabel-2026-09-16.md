# Bundet flyt — tegningsnotat (fabel, 2026-09-16)

Svar på ordre `relay/inbox-fabel.md` (develop d2f8bf65). Tegning: `bundet-flyt-tegning-fabel-2026-09-16.dc.html` (samme mappe).

## DoD 2 — Navn: «Bundet flyt»

«Bundet» beskriver forholdet: dokumentet er bundet TIL flyten — det hører hjemme der. «Fast» leses like gjerne som «standard/forhåndsvalgt» og sier ikke at noe IKKE kan skje. Motsatsen heter **«fri flyt»** i all mikrotekst. Ingen kollisjoner: «lukket» er dokumentstatus, «låst» er brukt om maler.

## Krav A — Bryteren ved opprettelse (ramme 1)

To radiovalg med navn og forklaring — ikke en av/på-bryter, slik at default er synlig som ord («Fri flyt · standard»). Settes av prosjektadmin (verifiserAdmin, som i dag).

**Default: FRI.** Feilen bør gå mot «for åpen»: glemt binding gir et dokument som KAN flyttes — men flytting krever allerede eksplisitt bekreftelse, navngitt målflyt og påkrevd kommentar, og logges i tidslinjen: synlig og reverserbar. Glemt åpning gir brukere som sperres fra lovlige flyttinger uten å skjønne hvorfor: usynlig, presser fram omveier. Default fri stemmer også med alle eksisterende flyter (krav D).

**Endring etter opprettelse: JA, begge veier** (ramme 2), kun prosjektadmin, med konsekvenstekst og logg på flyten. Trygt fordi bryteren kun styrer hva som er LOV framover — den rører aldri dokumentdata. Bind: dokumentene i flyten slutter å kunne flyttes (ingen migrering); alt som ble flyttet UT før bindingen, blir hvor det er (framover, ikke bakover). Åpne: motsatt.

## Krav B — Hva ser den som ikke kan flytte (ramme 4)

«Andre flyter»-seksjonen fjernes ikke stille: en rolig fotnote med anker forklarer fraværet — *«Bundet flyt. Endringsmeldinger hører hjemme i denne flyten og kan ikke flyttes til andre flyter. Det gjelder alle i prosjektet, ikke bare deg.»* Siste setning avviser rettighets-lesningen eksplisitt (§ 3a: svaret på «hvor flytter det» er «ingen steder — med vilje»). Ingen deaktiverte/grå flytvalg. Samme fotnote for admin — bundet er en egenskap ved flyten, ikke en rettighet (ordre § 6).

## Krav C — Nivå: per FLYT (anbefalt)

Kenneths mekanisme («bryter idet vi oppretter flyten») peker på flyten, og skjemaet er minst mulig: én boolsk kolonne på Dokumentflyt. Per maltype ville krevd et typeregister som ikke finnes (Dokumentflyt har ingen typekolonne — coworks måling), og fjernet muligheten for samme mal bundet i én flyt og fri i en annen. Men Kenneths tre navn («Teknisk avklaring», «Endringsmelding», «Varsel») HØRES ut som maltyper — derfor gate-spørsmål 2.

## Krav D — Eksisterende flyter

Alle forblir frie ved innføring (ingen backfill-migrering av tilstand — kolonnen defaulter til fri). Om noen skal bindes, er en Kenneth-avgjørelse — gate-spørsmål 3.

## Krav E — Symbol: lucide `Anchor`, kun på bundne flyter

Valgt: **`Anchor`** (0 treff, ledig). Metaforen er «hører hjemme her» — ikke «du mangler tilgang» (Lock utelukket: 17 treff mallåsing + rettighetslesning), ikke «deaktivert» (overstreket ⇄ leses som feil og spiller for tett på ArrowLeftRight = «flytter dokumentet dit»). Route/Milestone ledige men abstrakte.

Skal ikke forveksles med: hengelås (rettighet), overstreket handling (feiltilstand), Waypoints (flytvisning).

Flater: flytlista (rett etter navnet, ingen egen kolonne) · dokumentvisningen (i flyt-merket) · videresend-velgeren (i fotnoten). **Dokumentlista: NEI** — lista er tett og dokumentvisningen er ett klikk unna; en ikon-kolonne til koster mer enn den gir. **Fri flyt får ingen symbol** — fravær er signalet; to symboler der ett holder er støy.

## Gate-spørsmål — AVGJORT (Kenneth 16.09: «enig i alle 3»)

1. **Default:** FRI ✓
2. **Nivå:** FLYT ✓ — bryteren står på Dokumentflyt (én boolsk kolonne)
3. **Backfill:** INGEN ✓ — alle eksisterende flyter forblir frie; kolonnen defaulter til fri, ingen migreringsbeslutninger

Tegningen er dermed gatet. Skjemaendringen (én boolsk kolonne på Dokumentflyt + migrering med default fri) kan bestilles til kontrollplan, per ordre § 7.

## Ikke tegnet (DoD 3)

- Skjemaendringen (én boolsk kolonne + migrering) — bestilles til kontrollplan ETTER gating, per ordren
- Mobil — egen runde (kun person-velgeren mangler der)
- Dokumentlista — ingen symbolkolonne (vedtak over)
- kanByttFlyt, F3.1, videresend innen egen flyt, statusmodellen — utenfor scope per ordre § 6
- De to gatefeilene fra Kenneths gate 16.09 — bestilt separat
