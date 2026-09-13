# Malstruktur IA v2 — alt utledes fra Innstillinger › Produksjon (Kenneth 14.09)

Dato: 2026-09-14 · fra fabel · mockup: docs/redesign/malstruktur-ia-v2-mockup-fabel-2026-09-14.dc.html
ERSTATTER fane-modellen (Malforvaltning med tre faner) fra 13.09-tegningen der de
kolliderer. Vedtakene som består uendret: hente≠forvalte, «Hent fra arkiv»-modalen
(gruppering per standard, søk, ulåst SiteDoc-fane), nivåbanner/nivåfarger,
papirkurv-vedtakene (tellefelle-vakt, globalt søk-merke, 90 d), «rediger»-regelen,
«Tilbake til …»-regelen, terminologi § 0.

## Grunnmodellen
- INNGANG: Innstillinger › Produksjon › Oppgavemaler / Sjekklistemaler / HMS-maler
  (navnene fra dagens venstremeny). Tre maltyper, identiske egenskaper.
- NIVÅ: kontekstvelgeren øverst til venstre (PROSJEKT / FIRMA / SITEDOC ADMIN)
  — som resten av systemet de siste månedene. Samme side viser prosjektarkivet,
  firmaarkivet eller SiteDoc-arkivet avhengig av kontekst. Ingen egne sider per nivå.
- UTLEDNINGER fra malsiden: malnavn/Rediger → MalBygger i samme kontekst;
  «Hent fra arkiv» → modal (prosjekt: firma+SiteDoc; firma: kun SiteDoc;
  SiteDoc-nivå: ingen — kilden henter ikke).
- SiteDoc-nivået på samme side ERSTATTER admin/bibliotek helt.

## Sammenhengen mellom malene (skjerm 1)
SiteDoc-mal (kilde, verifisert) → firmakopi («X versjoner bak» + ↻) → prosjektkopi
(«Fra firmaarkivet», ↻). Kopier er selvstendige til de ↻-oppdateres; endring på
ett nivå rører aldri andre nivåer. Samme kjede for alle tre maltyper.

## Kontekstvakt i MalBygger (Kenneth 14.09)
Malen TILHØRER nivået den ble åpnet/startet i (openLvl). Kontekstbytte inne i
MalBygger er lov (Kenneth vil ha flyten prosjekt→firma), men Publiser etter bytte
krever eksplisitt bekreftelse: «Malen ble startet i X. Publiserer du nå, lagres
den i Y — [konsekvens per nivå]» med «Nei — tilbake til X» som trygt valg.
Uten kontekstbytte publiserer knappen uten dialog. Konsekvensteksten skal alltid
navngi rekkevidden (kun dette prosjektet / alle prosjekter i firmaet / alle kunder).

## Innganger som slettes (ordre følger etter gate)
1. «Malarkiv» i FIRMA-menyen. 2. «Bibliotek» i admin-menyen + admin/bibliotek-
editoren. 3. Alle «rediger arkivet»-lenker som peker på lister. Eneste innganger:
de tre maltype-sidene + kontekstvelgeren.

## Ikke tegnet
Papirkurvens plassering i denne strukturen (forslag: «Vis papirkurv» på malsiden,
samme komponent som 13.09-tegningen — Kenneth gater), MalRevisjon/Historikk
(eget skjemavedtak), Oppgave-/HMS-malsidenes konkrete kolonner (identisk mønster,
tegnes ikke separat), mobilvisning.

## Neste steg
Kenneth gater denne → fabel skriver rivnings- og byggeordre i riktig rekkefølge
(1: slett innganger, 2: kontekststyrt malside, 3: MalBygger-ruting).
