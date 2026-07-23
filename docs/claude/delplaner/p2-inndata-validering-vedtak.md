---
name: p2-inndata-validering-vedtak
status: 🟡 VEDTATT — ordre ikke skrevet. Sekvensert etter A-3b Fase B (overlappende flater)
eier: Kenneth (vedtak) · fabel (ordre) · cowork (sekvensering + gate)
sist_verifisert_mot_kode: 2026-07-21
---

# P2 — Inndata-validering på status-handlinger (Kenneth-vedtak 2026-07-21)

Kilde: prod-verifiseringsrunde 2026-07-21 ([prod-funn-2026-07-21.md § P2](prod-funn-2026-07-21.md)).

## Problemet

På K-avv-001 i prod kunne Kenneth klikke **«Besvar»** uten å ha endret noe felt, og **«Send tilbake»** uten kommentar — dokumentet gikk til `rejected`. En avvisning uten begrunnelse er ubrukelig for mottakeren, som ikke får vite hva som skal rettes.

**Avgrensning — dette er IKKE tilgangskontroll.** Cowork målte rollemodellen samtidig: `flytRolle.ts:191` (`if (!harBallen) return "leser"`) håndhever allerede grunnregelen «bare den som har ballen kan flytte dokumentet ut av tilstanden». Kenneth hadde ballen og skulle hatt lov til å handle. **Det som mangler er inndata-validering — en egen bug-klasse.**

## Vedtak

1. **«Send tilbake» krever kommentar** — JA.
2. **Unntak/typer:**
   - **Videresend** — trenger IKKE kommentar.
   - **Besvar** og **Avvist/Send tilbake** — MÅ ha kommentar.
   - **Utfylling/besvarelse** — kan aldri sendes tom; minst ett utfylt felt.
3. **Gjelder alle dokumenttyper.**

## Føringer for ordren (fabel)

- Håndheves **server-side i delt valideringskilde**; UI speiler. Aldri per-flate `if`-er. Prinsipp: **«UI viser aldri en handling serveren avviser.»**
- **Enkeltmålt premiss som må navngis i ordren:** cowork-målingen av `flytRolle.ts:191` («kun inndata-validering mangler») — utførende Opus måler selv.
- Ordren skrives etter at P1-beslutning foreligger, dersom cowork vil sekvensere.

## Sekvensering (cowork-avgjort 2026-07-21)

**Plassert etter A-3b Fase B.** P2 rører handlingsmeny og status-mutasjoner, som overlapper A-3b Del 2s flater (`packages/ui/src/status-badge.tsx` + handlingsmeny-visning). To økter i samme flate samtidig er den kollisjonen tavla finnes for.

Full rekkefølge: [p1-nivasignal-ordre.md § 4](p1-nivasignal-ordre.md).

## Status

Vedtatt, **ordre ikke skrevet**. Statuskilde ved utførelse: egen verifiseringslogg opprettes.
