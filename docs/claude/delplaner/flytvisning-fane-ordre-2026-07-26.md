# Ordre: Flytvisning-fane i rettighetsmatrisen (konfigurerbar boks-UI) — fabel, 2026-07-26

> Til cowork via Kenneth. Fasit: `Flytboks Konfigurator.dc.html` (designprosjektet) + skjermbilde. Forutsetninger oppfylt: fabel-kryssjekk konvergert, H3-vedtak fattet, celleTillatt-vedtak fattet (admin-only videresend, låst celle). Sekvens: bygges ETTER byggLedd-fiksen er verifisert på test. Kvalitet foran fart.

## Hva
Ny fane **«Flytvisning»** i rettighetsmatrise-admin, som DEFAULT-fane. Matrise/Endringslogg/Les-rediger består uendret. Flytvisningen er en REN PROJEKSJON over eksisterende data — ingen ny lagring, ikke noe nytt skjema.

## Kjerneregler (ikke forhandlingsbare)
1. **Én kilde:** hver bryter ER en matrisecelle (rolle · fraStatus · tilStatus). Klikk skriver samme `FlytRettighetOverride`-rad + logglinje + server-validering som matrise-fanen. Endring i én fane er umiddelbart synlig i den andre (samme data, to visninger).
2. **Én mapping-definisjon:** celle→(boks, retningsgruppe, etikett) defineres i SAMME def-fil som matrisen bygger på (utvid `flytmatrise-def.ts` — ikke en parallell liste). Begge faner genereres fra def-en, så de kan ikke drifte.
3. **Celle-tilstander gjenbrukes** fra cellespec: fylt=på · ramme=av · amber-prikk=overstyrt (med «Tilbakestill» i tooltip) · A=auto · hengelås=låst.

## Layout (som mockup)
- Fire flytbokser på linje (Registrator · Bestiller · Utfører · Godkjenner) med →-piler mellom; auto-overganger (send-kollaps, lesekvittering→Pågår) som A-merke PÅ pilene, ingen brytere.
- Retningsgrupper per boks, i denne rekkefølgen der de finnes: **SEND HØYRE →** · **← SEND VENSTRE** · **↩ HENT TILBAKE — dokumentet står lenger frem** · **■ ENDEPUNKT** · **LOKALT**. Besvar ligger under SEND VENSTRE (svar går til den som ba).
- **Prosjektadmin er IKKE en boks:** egen full-bredde-sone under linjen (Opprett · Videresend på tvers · Gjenåpne · Lukk trukket [Farlig sone] · Slett).
- Viser-bryter Dagens/Foreslått trengs IKKE i prod — vis gjeldende konfig (defaults + overrides).

## Spesialtilstander
- **Videresend-celler for flyt-roller: LÅST** (hengelås, tooltip «Kun prosjektadmin — flytter dokumentet ut av flyten»). Jf. celleTillatt-vedtaket: override PÅ er no-op (forwarded er pseudo-status utenfor VALID_TRANSITIONS) — cellen skal derfor ikke se påslåbar ut. Gjelder begge faner (også matrise-fanen må vise hengelås her, hvis den ikke alt gjør det).
- **Bestiller-boksen: stiplet ramme + H1-merke** («ikke egen stasjon i dagens statusmaskin») til posisjonsmodellen er avgjort.
- **Manglende overganger (H2-familien):** «Besvar/send tilbake» (bestiller) og «Send tilbake (be om noe)» (utfører) rendres som stiplet ?-bryter, disabled, tooltip «Finnes ikke i statusmaskinen — krever vedtak». IKKE klikkbare, IKKE celler.
- Opprett (registrator): låst i kode-tilstand.

## Ikke i scope
- Stasjonsrelativ omnøkling / N-boks (posisjonsutredningen — egen ordre). Fanen bygges på dagens celle-koordinater; mappingen re-nøkles senere.
- Endring av defaults (H3-fiksen er egen gren; denne fanen skal bare VISE riktig uansett hvilken som lander først).
- Gruppe-/persondynamikk i boksene (Kenneth: egen samtale).

## DoD
- Typecheck + test grønt (shared/web/api). Test: bryter-klikk skriver override-rad og reflekteres i matrise-fanen (og omvendt); låst videresend-celle kan ikke skrives fra UI.
- **Gate = rendret utfall på test:** skjermbilde av fanen med (a) en override satt (amber-prikk begge faner), (b) låst videresend, (c) H2-?-brytere — sammenlignet mot mockupen. Kode-artefakt-sjekk alene er IKKE gate (lærdom fra byggLedd).
- Vis diff, push egen gren, ikke merge, ikke rør STATUS/BACKLOG.
