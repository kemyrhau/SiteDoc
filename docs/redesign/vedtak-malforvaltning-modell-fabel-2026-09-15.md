# Kenneth-vedtak 15.09: Malforvaltning-modellen gjelder — v2-kontekstmodellen utgår

Dato: 2026-09-15 · fra fabel · Kenneth-beslutning etter test av PR 1/PR 2-arbeidet

## Vedtatt modell (erstatter Malstruktur IA v2-notatet der de kolliderer)
1. **Inngang for forvaltning: Innstillinger › Malforvaltning** (mockup 13.09,
   skjerm 1) — rollestyrt:
   - Firma-admin: ser Malforvaltning med **Firmaarkiv**-fanen (redigering).
   - SiteDoc-admin: ser i tillegg **SiteDoc-arkiv** med redigering.
   - **Prosjektbruker/prosjekt-admin: ser IKKE Malforvaltning.** De LESER firma-
     og SiteDoc-maler via «Hent fra arkiv» inne fra sjekkliste/oppgave/HMS-
     malflatene i prosjektet.
2. **MalBygger med nivåbanner** («Du redigerer i FIRMAARKIV/SITEDOC-ARKIV — …»,
   skjermbilde #2/#4) er gatet og består: samme editor, banner + «Tilbake til …»
   skiller nivåene. Kontekstvakten ved publisering på annet nivå enn malen ble
   åpnet i, består.
3. **Kontekstvelger-modellen fra v2 (maltype-sider + PROSJEKT/FIRMA/SITEDOC
   ADMIN-bytte som nivåstyring) UTGÅR som forvaltningsinngang.** Kontekstvelgeren
   beholder rollen den har i resten av systemet (hvem jeg er logget inn som);
   den er ikke lenger veien til arkivnivåene.
4. **Eksisterende firma/malarkiv (#3) fungerer godt (Kenneth 15.09)** og
   utviklingen av den fortsetter som planlagt med vedtatte tilganger — inkl.
   «Lån fra SiteDoc-arkivet», Ny firmamal, ↻/rediger/slett per rad, og
   malnavn → MalBygger.

## Konsekvens for løpende ordrer
- Svaret på STOP-gate A/B (svar-stopgate-ab-v2-fabel-2026-09-15.md) revideres:
  PR 1 (SiteDoc-arkiv-flate + riv admin/bibliotek) består, men målflaten er
  **Malforvaltning › SiteDoc-arkiv** (rollestyrt), ikke maltype-sider med
  kontekstbytte. Ruta /dashbord/firma/innstillinger/malforvaltning bygges likevel.
- PR 2 (flytte firma/malarkiv inn i Malforvaltning): **PÅ VENT** — se åpent
  spørsmål under. Ingen riving av firma/malarkiv før Kenneth har avgjort.
- Papirkurv-blokkeringen (soft-delete mangler) står uendret.

## Åpent spørsmål til Kenneth (eneste)
Skal firma/malarkiv-siden BESTÅ permanent ved siden av Malforvaltning › Firmaarkiv
(to innganger til samme data — krever delt komponent, ikke duplisert), eller
bestå inntil Malforvaltning-fanen beviselig dekker alt, og så rives? Fabel
anbefaler det siste (én forvaltningsinngang til slutt), men #3-vedtaket kan
leses begge veier.
