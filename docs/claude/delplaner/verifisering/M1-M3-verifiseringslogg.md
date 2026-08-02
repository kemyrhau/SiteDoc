# M1–M3 mobil detalj-redesign — verifiseringslogg (statuskilde)

## Fabel-designgate 2026-07-30 — GODKJENT for merge
Branch `feat/mobil-detalj-redesign` @ `c231531b`, testet på 4-rolle-flyt (KB210). Bevis: repo `docs/claude/delplaner/verifisering/m1-m3-walkthrough-bevis-2026-07-30/` (rapport.md + bevis-01..07). Fabel har sett bevis-01/03/04/05/06 mot mockup `Mobil Detalj Redesign.dc.html` (1a/1b/1c).

**Godkjent mot klikk-budsjett:** Send = primær(1) → bekreft(2) ✓ (var 3, usynlig inngang) · «hvem har ballen» = 0 taps (header) ✓.

**Forrige rundes 4 avvik — alle lukket:**
1. Retningsnavn på primær ✓ («Send til Sitedoc Ledelse», «Besvar til …»)
2. Bekreftelses-tekst speiler primær ✓ («Send til Sitedoc Ledelse?»)
3. Flytlinje viser kjeden ✓ (aktiv chip + naboer + «+N»; én-chip-casen var reelt ett-ledds flyt)
4. Flyt-sheet (M3) + de manglende statene bevist ✓

## Vedtak på coworks 4 design-kall (fabel 2026-07-30)
- **Mikrotekst «Lagre og lukk» → JA, fikses FØR merge.** Ny tekst: **«Lagre og gå tilbake»** (i18n-nøkkel oppdateres, alle språk). «Lukk» kolliderer med dokumentstatusen Lukket — bevist av at Kenneth selv leste det feil.
- **#2 kommentar-inngang (fullskjerm FeltDokumentasjon-modal):** egen sak post-merge. Retning: inline-ekspanderende felt fremfor fullskjerm — designes av fabel, køes etter M-oppfølgerne.
- **#4 bekreft-på-send:** beholdes som i dag — sheeten ER kommentar-inngangen (vedtatt i ordren), teller som tap 2 og er innenfor budsjett. Hopp-over-varianten (Send = 1 tap, kommentar via split) føres som vurderingssak, ikke endring nå.
- **#7b liste-filter:** egen liten sak (list-flate, utenfor M1–M3).
- **#5 testdata:** anbefaling til Kenneth/cowork — opprett en test-flyt med distinkte personer per ledd; alle-roller-kontoen gjør flytverifisering misvisende.

**Merge-klar:** når «Lagre og gå tilbake»-strengen er inne og typecheck grønn → cowork merger. (Fabel hevder ingen git-tilstand — «klar» = designgodkjent.)

## Gjenstår etter merge
- Kenneths re-test på develop-bygg (menneskelaget)
- Oppfølgersaker: #2 inline-kommentar · #7b filter · #4 vurderingssak · testdata-flyt
- Dok-sync: mobil.md-entry er med i branchen ✓ (strukturgate-bekreftet av cowork)
