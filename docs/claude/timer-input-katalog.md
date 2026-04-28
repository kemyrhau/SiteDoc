# Timer-input-katalog

**Status:** Plassholder etablert 2026-04-25.

## Formål

Katalog over inputs til timer-modulen — dagsseddel-felter, lønnsarter, tillegg, godtgjørelser, utlegg, vareforbruk, underprosjekt-kobling. Tjener som spec-grunnlag for `db-timer`-skjemaet og dagsseddel-UI.

## Status

Detaljinnhold lim inn av Kenneth i senere fase. Dokumentet er etablert nå for å fungere som anker for CLAUDE.md-lenker og for byggeplass-strategi-merknad nedenfor.

## Byggeplass-merknad

Timer-modulen skal støtte valgfri `byggeplassId` på dagsseddel når byggeplass-strategi-fase er implementert. Mannskap kan jobbe på flere byggeplasser samme dag — modellen må håndtere én byggeplass per dagsseddel-rad eller per delregistrering. Endelig modellering avgjøres mot prinsippene i [byggeplass-strategi.md](byggeplass-strategi.md) (særlig Prinsipp A om NULL-betydning og Prinsipp B om prosjekt uten definerte byggeplasser).

## Referanser

- [timer.md](timer.md) — modul-oversikt og overordnet design
- [byggeplass-strategi.md](byggeplass-strategi.md) — byggeplass-relasjon (avhengighet)
- [arkitektur.md § Datamodell-prinsipper](arkitektur.md#datamodell-prinsipper) — overordnet ramme (firma-eid vs prosjekt-eid)
