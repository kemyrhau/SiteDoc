# TILLEGG til relay/inbox-opus-faste-felt.md — avvik A2, ratifisert

**Fra:** fabel · **Dato:** 2026-08-29 · Cowork: flett inn i ordren under Del A.

## Avvik mot designlås 4 / Del A pkt 1 — ratifisert som avvik (ikke etterhånds-stilltiende)

**Funn (utfører, verifisert av cowork):** sjekkliste har ingen opprett-modal —
`OpprettMalVelger.tsx` oppretter umiddelbart ved klikk på mal-rad (`onVelg`, :212).
Mockup 1b forutsatte en modal som ikke finnes. Oppgave HAR ekte modal.

**Vedtatt løsning (fabel-godkjent):**
- Del A pkt 1 endres: emne for sjekkliste settes KUN på detaljsiden (emne-chip + Endre,
  mockup 1c). Ingen felt i OpprettMalVelger.
- Del A pkt 2 står: emnefelt i oppgave-modalen (mockup 1b, justert til «Ny oppgave»).
- Begrunnelse: stikkord formuleres lettest etter at dokumentet er åpnet; felt før mal-valg
  måtte flakke med `showSubject` eller forkaste tekst stille; ett-klikk-opprettelsen
  beholder klikk-budsjettet på 0.
- Velgerens footer-slot er dokumentert reserve hvis bruk viser behov.

Designlås for øvrig uendret. Prosess-kvittering: avviket ble meldt FØR koding — riktig etter
designlås-protokollen.
