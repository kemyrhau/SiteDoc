# Avviks-vedtak — varianttabellen etter Kenneths testkjøring (trinn 2 designgate) — fabel 2026-09-06

Svar på coworks gate-rapport (test f78a94a9, Kenneths skjermbilde 3). Coworks lesning
tiltres på alle tre punkter — dette er avvik i MOCKUP-FORMEN som byggingen fulgte lojalt;
vedtakene under er designlås-revisjoner, ikke kritikk av leveransen. Revidert mockup
vedlagt: `mockups/MalBygger Grensevarianter Mockup.dc.html` (panel B).

## Tre vedtak (reviderer designlås pkt 5 i grensevariant-notatet)

1. **Satt ≠ arvet skal bæres av FORM, ikke tekstfarge:**
   - Satt verdi: fylt celle, blå kant, fet tekst, ✕ som fjerner verdien (→ tilbake til arv).
   - Arvet: tom celle med stiplet kant og standardtallet som grå kursiv placeholder
     («≤ 30») — ingen forhåndsutfylling. Man ser umiddelbart om man har satt fire
     verdier eller én.
2. **«Ellers (standard)»-raden fjernes fra tabellen** — den var et tillegg som så ut som
   en gjentakelse. Erstattes av tekstlinje under tabellen: «Andre eller ingen valg:
   standardkravet ≤ 30 mm gjelder.»
3. **Modellen læres bort FØR utfylling:** intro-linje (lett blå infoboks) mellom styrende
   felt og tabellen: «Hvert valg kan få sitt eget tall. La feltet stå tomt for å bruke
   standardkravet ≤ 30 mm.» Kvitteringslinja etterpå beholdes uendret — den bekrefter,
   introen forklarer.

## Ratifisering

- **Enhet vises ved «Ingen krav»:** coworks godkjenning tiltres og føres herved som
  ratifisert avvik (designlås-prinsippet: etterhåndsratifisering skal føres som avvik —
  dette er føringen). Begrunnelsen er riktig: et måltall uten krav skal ikke miste enheten.

## Konsekvens for data

Ingen. `grenseVarianter` lagrer fortsatt kun satte verdier; arv = fraværende nøkkel
(designlåsens opprinnelige intensjon — forhåndsutfyllingen var rendering, ikke data).
Hvis test-byggingen SKRIVER standardverdien inn i alle varianter ved lagring, er det en
kodefeil mot lås pkt 5 — cowork verifiserer (enkeltmålt: kun sett på skjerm).

## Neste

Cowork ruter de tre vedtakene som revisjonsordre til samme utfører (liten — én komponent,
ingen datamodell-endring) → ny designgate mot revidert mockup panel B, denne gangen med
Kenneth-walkthrough som del av gaten: han skal kunne sette én variant uten å prøve seg fram.

## TIL MASTERPLAN (tillegg — cowork fletter)

- MK C / grenseresolver trinn 2: «designgate 06.09: funksjonelt verifisert på test, tre
  UX-avvik vedtatt etter Kenneth-testkjøring (satt/arvet-form, Ellers-rad → tekstlinje,
  intro-linje) — revisjonsordre før trinn 2 lukkes.
  Vedtak: `avviksvedtak-grensevariant-tabell-fabel-2026-09-06.md`. Enhet ved ‘Ingen krav’
  ratifisert.»

— fabel
