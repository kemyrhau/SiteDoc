# Flyt-posisjon i dokument-headeren — designforslag (fabel, 2026-07-26)

> Svar på design-oppgave relayet via cowork. Mockup: `Flytposisjon Header.dc.html` (designprosjektet, 4 varianter A–D). Cowork gater mot kode og skriver kode-ordre.

## Design (kort)
Kompakt ledd-rad i headeren, mellom dokumenttittel og handlingsknappene. Boks-språket deles med flyt-konfiguratoren (bokser på en linje, retningspiler):

- **Passert ledd:** hvit boks, ✓, dempet tekst.
- **Aktivt ledd (ballen):** fylt blå boks, ●-prikk + ball-holderens navn (`aktivNavn` — person foran gruppe, som i dag).
- **Kommende ledd:** stiplet ramme, dempet.
- **Rolle-etikett** (REGISTRATOR/UTFØRER/…) i 9,5px caps over navnet i hver boks.
- **Siste-ledd-tilstand (variant C):** aktiv boks ytterst + deaktivert «Send →» med hover «Ingen neste mottaker — flytens siste ledd» + én dempet fotnotelinje med de reelle utveiene (Godkjenn/Send tilbake/Lukk). Svarer direkte på Kenneths test-observasjon.
- **5+ ledd (variant D):** fjerne ledd kollapses til «+N»-pille (aktivt ± 1 vises) — gjenbruker `filtrerNaboer` fra FlytIndikator; tooltip lister skjulte ledd.
- **Mange medlemmer i et ledd (Kenneth 2026-07-26):** boksen viser alltid ETT navn — gruppen hvis leddet har en gruppe, ellers én bruker (hovedansvarlig prioritert). Hover på boksen ramser opp alle medlemmene (navn + rolle), fra `brukerIder`/`gruppeIder` som alt ligger i `Ledd` — ingen API-endring. Demonstrert på Bestiller-boksen i variant A.
- **DYNAMISK (kjernekrav):** raden rendres fra dokumentets faktiske flyt — 2 bokser i 2-ledds flyt (variant B), aldri hardkodet 4-rolle-rekke.

## Kodeverifisering (fabel målt 2026-07-26)
- Dataene finnes: `ledd`, `aktivtIndex`, `erSisteBoks` i DokumentHandlingsmeny.tsx (:263–269); `Ledd` har `navn`/`aktivNavn`/`brukerIder`/`gruppeIder`.
- `FlytIndikator.tsx` rendrer allerede en ledd-rad (●, kompakt, +N, ekspander) — **dette designet er en evolusjon av FlytIndikator, ikke et nytt komponent.** Kode-ordren bør oppgradere/flytte den, ikke duplisere.
- **FLAGG 1 — duplisert logikk (rotårsak):** `byggLedd` + `finnAktivtIndex` ligger kopiert i BÅDE FlytIndikator.tsx og DokumentHandlingsmeny.tsx. Ordren bør trekke dem ut til delt kilde (shared eller felles lib) — «delte kilder fremfor duplisert logikk».
- **FLAGG 2 — rolle-etikett per ledd:** designet viser rolle i caps per boks; `Ledd`-typen ser ut til å mangle rolle-felt (bygges fra medlemmer). Må enten tas med i byggLedd eller utledes — cowork verifiserer.

## Ikke i scope
Klikk på raden → flytpanel (senere). Endring av ballen-logikken. Boks-dynamikk/gruppevisning (Kenneth: egen samtale).
