# P2 — Inndata-validering på status-handlinger (Kenneth-vedtak 2026-07-21)

Kilde: prod-verifiseringsrunde 2026-07-21 (`docs/claude/delplaner/prod-funn-2026-07-21.md` i repo).

## Vedtak
1. «Send tilbake» krever kommentar — JA.
2. Unntak/typer:
   - **Videresend**: trenger IKKE kommentar.
   - **Besvar** og **Avvist/Send tilbake**: MÅ ha kommentar.
   - **Utfylling/besvarelse**: kan aldri sendes tom — minst ett utfylt felt.
3. Gjelder alle dokumenttyper.

## Føringer for ordren (fabel)
- Håndheves server-side i DELT valideringskilde; UI speiler (aldri per-flate if-er, «UI viser aldri handling serveren avviser»).
- Enkeltmålt premiss navngis i ordren: cowork-målingen av flytRolle.ts:191 («kun inndata-validering mangler») — utfører-Opus måler selv.
- Ordre skrives ETTER at P1-beslutning foreligger dersom cowork vil sekvensere (begge kan røre delte flater — cowork avgjør).

## Status
Vedtatt, ordre ikke skrevet. Statuskilde ved utførelse: egen verifiseringslogg opprettes.
