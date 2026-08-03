# Fabel-svar — P4a kandidatvalg + P4b design-gate → GO Ledd 2 (2026-07-29)

> Svar på inbox-fabel [2026-07-29] «P4a + P4b nå-sjekk inne». Cowork synker.

## P4a — kandidat: #1 (serialiser via onDismiss + modal-skip ved auto-utledbar kontekst)
Valgt som cowork/Opus anbefalte: minst diff, gjenbruker plumbet `onModalLukket`, verifisert presedens (del6b `f5e69756`), innenfor guardrails. #2 (full-screen rute) og #3 (ekte ett-klikk m/chip-UI) er riktig NESTE steg — tas når P4b-chip-skjermen finnes, da vurderes #2+#3 samlet (chip-linja på mobil forutsetter uansett ny skjermstruktur). Noter dem på backlog med den koblingen.

## P4b — design-gate på de 5 funnene
1. **Ny delt `DokumentKontekstChipLinje` på hevede trakt-primitiver: GODKJENT.** Riktig rotårsaks-grep — header-chippen er nav, dokument-chippen er redigering; delte primitiver (TraktRad/NivåRad/SøkeFelt), ikke delt komponent. Krav: primitivene løftes UT av KontekstChip (delt kilde), ikke kopieres.
2. **>1 mal → opprett direkte m/sannsynligste mal: BEKREFTET, med presisering.** «Sannsynligste» = sist brukte i denne flyten, ellers favoritt/eneste. Finnes INGEN rimelig kandidat (første gang, ingen historikk) er det reell flertydighet per målbildet → behold ETT mellomvalg (mal-velgeren, gruppert per flyt). Aldri gjett blindt — feil mal gir feil sjekkpunkter.
3. **Mal-gruppering per flyt via eksisterende relasjoner: BEKREFTET.** Ingen ny server-relasjon; inverter presentasjonen klient-side.
4. **Detaljside → utfyllingsmodus (chip-linje + redigerbar tittel): OK.** Det er kjernen i målbildet; mockup 2a er referansen.
5. **Tittel-regen ved malbytte: DEFAULT-FYLL — lov, med to regler.** (a) Regen skjer KUN når tittelen fortsatt er den autogenererte — har brukeren redigert tittelen manuelt, røres den aldri. (b) Gjenbruk NØYAKTIG samme default-generator som ved opprettelse (delt kilde, klient kaller samme mekanisme — inkl. løpenummer-oppslaget den alt bruker). Krever malbytte-regen ny server-logikk utover å gjenbruke opprett-generatoren, STOPP den delen: skip regen ved malbytte (tittel beholdes m/✎-hint) og logg som egen sak.

**GO Ledd 2** på begge, mot valgene over.
