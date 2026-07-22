# Flytspråket — ordbok (Kenneth-vedtak 2026-07-22, komplett)

TIL REPO: føres inn i docs/claude/terminologi.md som eget flytspråk-avsnitt (cowork plasserer; fabel etterleser). Fasit-visning: `P1 Nivåsignal Beslutningskart.dc.html` § 7a.

Regel: hvert ord har ÉN betydning på tvers av alle flater; konteksten avgjør hvilket ord som er riktig — aldri omvendt. Knapper = verb (hva DU gjør); badges = tilstand (hvor dokumentet ER).

| Ord | Betyr | Kontekst | Aldri om |
|---|---|---|---|
| Avbryt | Forkast pågående registrering/utfylling — ingenting lagres | Skjema (UI, ikke flyt) | Statusovergang |
| Send | ENESTE linjeverb mot høyre — første sending OG videre til neste boks | Handlingsmeny, ballens eier | Kryssflyt. Ordet «Videresend» brukes ikke i UI |
| Send tilbake | Ett steg mot venstre for retting — kommentar obligatorisk (P2) | Handlingsmeny | Terminering/avvisning |
| Send på nytt | Venstre ende retter returnert dokument og sender igjen (rejected → sent) | Handlingsmeny, venstre ende | Første sending |
| Besvar | Utfører leverer svar — aldri tom (P2) | Handlingsmeny, utfører | Godkjenners avgjørelse |
| Lukk | Ta dokumentet ut av linja — ett verb, badge bærer årsak: «Lukket · fullført» (fra Godkjent) / «Lukket · trukket» (mid-flow, kommentar + bekreftelse) | Handlingsmeny (mid-flow = «Farlig sone») + badge | Forkasting av utfylling. Ordet «Terminer» brukes ikke |
| Trekk tilbake | Avsender angrer FØR motpart har tatt i dokumentet (sent → cancelled) | Handlingsmeny, avsender | Dokument motparten jobber i |
| Gjenoppta | Utfører tar returnert dokument tilbake i arbeid (rejected → in_progress) | Handlingsmeny, utfører | Gjenåpning fra lukket |
| Gjenåpne | Hent LUKKET dokument (begge årsaker) tilbake til utkast — cancelled → draft + NY overgang closed → draft | Handlingsmeny, bestiller/admin | Gjenopptak av arbeid |
| Flytt til annen flyt | Kryssflyt til annen dokumentflyt/person — admin-verktøy, uten kommentarkrav (kode: forwarded) | Admin-meny | Linjebevegelse. Ordet «Videresend» brukes ikke |
| Avvist | Formell underkjenning av ALT innhold — bransjetungt; motpart kan bestride. RESERVERT — finnes ikke som mekanisme (bestridelse = ev. egen sak) | — | Vanlig retur (rejected) · terminering |
| Til revisjon / Sendt tilbake ✓ | Status-etikett for rejected — perspektivavhengig (A-3b Fase A) | Badge | «Avvist» som etikett |

## Nye statusmaskin-overganger vedtatt i denne runden
1. rejected → sent («Send på nytt» — vedtak 2, tidligere runde)
2. **closed → draft («Gjenåpne» fra fullført-lukket — NY i dag)**

## Konsekvens for kort 2-divergensen
Menytekstene «avvis»/«trekk tilbake» på received/in_progress var dobbelt feil: serveren avviser dem, og ordene er nå reservert til annet. Løses av matrise-kilden + ordboken samlet.

## Åpent (eneste rest fra 6a kort 1)
Hvem eier «Lukk · trukket» mid-flow: bestiller (fabel-innstilling) eller kun admin? + kort 3 (død overgang: rydd bort — fabel-innstilling).
