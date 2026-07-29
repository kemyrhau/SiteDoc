# Revisjonsordre — effektivitets-audit av stående flater (fabel, 2026-07-29)

> Ren lese-/telle-økt, INGEN koding. Grunnlag: FABEL-RAMMEVERK § Effektivitets-gate (pkt 1–4, inkl. nytt Kontekst-default-prinsipp). Kenneth-godkjent + cowork-anbefalt, køet etter A+C-merge. Utfører: lese-Opus i eget arbeidstre (develop etter merge).

## Bakgrunn — status på klikk-funnene (fabel-svar til Kenneth 2026-07-29)
Delvis rettet: fase 2-runden leverte tittel-default, auto-hopp malvelger ved én mal, forhåndsvalgt faggruppe ved én kandidat. IKKE dekket noe sted: **kontekst-default** — skjermbilde 2026-07-29 viser web-header med «Sitedoc Boligfelt B12 · Bygg B12» (prosjekt OG byggeplass kjent), likevel spør opprett-flyten om byggeplass. Mobil har verken GPS→byggeplass eller PSI→prosjekt som default-kilde. Det er dette audit-en skal måle i full bredde.

## Oppdraget — mål, ikke mén
For hver brukervendt opprett-/handlingsflyt (web + mobil): oppgave-opprett, sjekkliste-opprett, HMS-meld, bilde-opplasting, timeregistrering, dagseddel, statusendringer, sletting (jf. slette-flyt-ordren — ikke dupliser, referer):
1. **Klikk-telling:** antall interaksjoner (trykk/klikk/tastefelt) fra inngang til fullført, happy path. Tabell: flyt | i dag | teoretisk minimum | differanse.
2. **Kontekst-lekkasje:** hvilke felt spør om noe appen allerede vet (prosjekt, byggeplass, bruker, faggruppe, dato)? Kilde finnes = feil. Merk per felt: kontekst-kilde som finnes men ikke brukes.
3. **Dobbel sikring:** bekreftelser oppå sikkerhetsnett (papirkurv/utkast/angre).
4. **Mobil-signaler:** hvor ville GPS→byggeplass / PSI→prosjekt kuttet steg (kartlegg, ikke design).

## Målbilde (Kenneth 2026-07-29 — audit-ens referansepunkt)
**Ett klikk: «Opprett sjekkliste» → rett inn i utfylling.** Alt annet (prosjekt, byggeplass, tittel, faggruppe, mal ved én kandidat) autogenereres fra kontekst; overstyring skjer INNE i utfyllingen (redigerbare felt øverst), aldri som forhåndssteg. Kun ved reell flertydighet (flere maler uten favoritt) er ett mellomvalg lov. Klikk-tellingen i pkt 1 måles mot dette, ikke mot dagens flyt.

**Fallback-stige (manglende kontekst-signal, per felt):** GPS/PSI-treff → sist brukte (merket «sist brukt») → tom chip m/varselfarge («Velg byggeplass ▾», må velges før innsending — ikke før opprettelse). Manglende signal koster maks ett ekstra trykk INNE i utfyllingen; aldri forhåndssteg, aldri blokkert opprettelse.

**Overstyring:** hver kontekst-chip er en velger — trykk → bunn-ark (GPS-nærmeste øverst, sist brukte, søk) → velg. 2 trykk, når som helst, uten å forlate skjemaet. Bytte av prosjekt/byggeplass regenererer avhengige autofelt (tittel-løpenummer, mal-forslag); utfylte sjekkpunkter beholdes m/varsel ved malbytte.

**Mal-overstyring (Kenneth 2026-07-29):** ved malbytte der brukeren er registrator i flere dokumentflyter, lister mal-velgeren mulighetene **gruppert per dokumentflyt** (flyt som overskrift, dens maler under) — velg ny mal derfra. Tittel regenereres fra ny mal (autovalgt tittel fra gammel mal er da feil og skal ikke beholdes).

## Leveranse
`verifisering/effektivitets-audit-2026-07.md`: tabellen + topp 5 verstinger med rotårsak (hvilken komponent/skjema eier feltet) + forslag til fiks-rekkefølge gruppert i småsaker (ordre-klare) vs strukturelle (fabel-design først). Oppgi søkerom per flyt. Ingen kodeendring, ingen refaktoreringsforslag utover felteierskap.

## Gate
Rapport → fabel vurderer → prioritert fiks-plan til Kenneth → ordrer skrives derfra. Statuskilde: rapportfilen.
