# Vedtak + kartleggingsordre: flytmodell — rekkefølge styrer, kun registrator beholdes (fabel → dokgen)

**Dato:** 2026-08-21 · **Status:** bindende vedtak + kartlegging FØR fjerningsordre. Ingen kodeendringer i denne ordren.

## Vedtak (Kenneth 2026-08-21, føres i domene-arbeidsflyt.md)

Dokumentflyt styres av **rekkefølgen på flytboksene** alene. Eneste rolleegenskap som beholdes er **registrator** (hvem kan opprette/starte dokumentet). Semantiske ledd-typer — utfører, godkjenner, kontrollør osv. — fjernes som egenskaper: hva et ledd er følger av posisjonen i flyten, ikke av en type-merkelapp.

Modellkonsekvens: ledd = posisjon + bemanning (person/gruppe/faggruppe, «høyst én»-vernet fra superRefine-ordren) + registrator-flagg. Lukker samtidig flytmodell-spørsmålet A–D (innboks) og absorberer deler av KP-start a/b/c: «hvem kan starte» = registrator-leddet.

## Kartleggingspunkter (fil:linje-rapport før fjerningsordre formuleres)

1. **Hvor leses ledd-typen i dag?** Uttømmende liste over all logikk som gater på utfører/godkjenner/øvrige typer — særlig: signering (hvem kan signere når), attestering/godkjenning av dokument, varsling/notifikasjoner, statusoverganger, PDF/visning (vises typenavnet noe sted?).
2. **Skjema:** hvor bor type-enumen (DokumentflytMedlem/ledd-modellen), hvilke verdier finnes, og finnes rader i prod som ville miste betydning ved fjerning?
3. **Registrator i dag:** hvordan er «kan starte» implementert — egen type, første ledd, eller annet? Hva må til for at registrator blir flagg i stedet for type?
4. **Rekkefølge:** er ledd-rekkefølgen allerede autoritativ for stegning (neste-mottaker-logikk), eller finnes steder der typen — ikke posisjonen — avgjør hva som skjer? Hvert slikt sted er et migreringspunkt.
5. **UI:** flytbyggerens typevelger + alle flater som viser typenavn (web, mobil, maler, arkiv-PDF). Klikk-/begrepsgevinst estimeres.
6. **Migreringsrisiko:** eksisterende flyter/maler i prod — hva skjer med dem ved fjerning; trengs en mapping (type → posisjon) eller er rekkefølgen alt komplett?

## Rapportformat
Som nå-rapporten for attestering: kun fakta med fil:linje, ingen design. Fabel skriver fjernings-/migreringsdesign etter rapport, Kenneth-gate før bygging.

**Umålt i denne ordren:** alle antakelser om hvor typen leses — det er nettopp det som skal måles.
