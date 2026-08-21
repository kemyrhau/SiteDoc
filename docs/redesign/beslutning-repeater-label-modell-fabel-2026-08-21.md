# Beslutning — repeater: én modell for utfylling og print (D8)
**Fra:** fabel · **Dato:** 2026-08-21 · **Utløst av:** cowork-funn BEF-001 (web RepeaterObjekt.tsx:116 vs. PDF arkivmal/repeater.ts:143 leser ulike label-felter) · **Status:** bindende for D2-ordren og web-utfylling

## Funnet
Web-utfylling rendrer raden som `{radIndeks+1} {repeater.label}` og viser aldri barnas labels; arkiv-PDF-en bruker barnas labels som kolonneoverskrifter. Samme mal, to modeller. Konsekvens: arbeidsnotiser i barn-labels («_ Endret til Observasjon for opus») er usynlige ved utfylling og dukker først opp som tabellhode på print.

## Beslutning
**Én modell: en repeater ER rader × kolonner, og barnas labels styrer feltene på BEGGE flater.**

1. **Barn-labels styrer.** De er felt-definisjonene i malen. Repeaterens egen label er seksjonstittel på begge flater (web har den i rad-prefikset, PDF i tabellheadingen — det består).
2. **PDF beholder tabellformen** (arkiv-vedtaket 2026-08-13 står: tjue kontrollpunkter skal være skannbare). Kolonneoverskrifter = barn-labels, som i dag.
3. **Web-utfylling skal VISE barn-labels** — feltetikett over hvert felt i raden. Det er fiksen: ingenting skal kunne stå i en mal som er usynlig ved utfylling men synlig på print. Brukeren fyller ut samme oppsett som printes.
4. **Malbyggeren** viser allerede barn-labels (de redigeres der); ingen endring — men BEF-001-malen ryddes (arbeidsnotisen fjernes fra label-feltet) som datafiks, ikke kodefiks.
5. **Ryddesjekk (engangs):** SQL-uttrekk over eksisterende repeater-barn-labels som starter med `_`/whitespace eller inneholder «opus»/«TODO»-mønstre → liste til Kenneth for manuell malrydding. Ingen automatisk omskriving av kundedata.

## Konsekvens for ordrene
- **D2/D2b-ordren er uendret** — den rører ikke repeater-tabellen, og modellvalget her bekrefter strukturen tegningen bygges ved siden av.
- **Rekkefølge korrigert etter uttrekket (cowork 21.08):** malryddingen (punkt 4/5) går FØR web-fiksen (punkt 3). Uttrekket fant fire mistenkelige labels: «_ Endret til Observasjon for opus» (Testprosjekt) + tre «-»-labels på list_single under «Observasjon/kontroll/objekt» i Befaring (998), Beraringsrapport (999) og Byggelerers dagbok/kontroll (999). Bygges web-fiksen først, får brukeren kolonner som heter «-» — verre før bedre. De to 999-malene er A.Markussens: navnene bestemmes av Kenneth, ingen automatisk omskriving. Bonus: «Beraringsrapport» er stavefeil for «Befaringsrapport» — rettes i samme rydding (Kenneth-godkjenning).
- F7-ordren (objektnivå-blokken) skrives fortsatt etter BEF-001-testen og bygger på samme modell: blokken «Registrert utenfor rader» står UTENFOR tabellen nettopp fordi den ikke er en rad.

## D9 — Informasjonsfeltet (Kenneth-regel 21.08)
**All tekst et menneske skriver inn i rapporter må bety noe.** Veiledning hører ikke hjemme i labels — den hører hjemme i informasjonsfeltet (helpText), som alle malobjekter har. Egenskaper:
1. **Under utfylling:** vises som veiledning — hva som skal observeres/dokumenteres.
2. **På utskrift:** skrives IKKE ut som standard. Valgfritt med: avkryssing «Ta med veiledningstekster» i «Last ned PDF»-menyen (mockupside «Nedlastingsvalg» oppdatert).
3. Regelen gir malryddingen retning: «-»-labelene og arbeidsnotiser erstattes av ekte feltnavn; veiledning flyttes til informasjonsfeltet.
