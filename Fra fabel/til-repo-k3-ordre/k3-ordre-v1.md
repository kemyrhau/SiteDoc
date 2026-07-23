# K3-ordre ledd 2 — Kontekst-redesignen fullføres (fabel → redesign-Opus, via Kenneth)

TIL REPO: docs/claude/delplaner/k3-ordre.md. Vedtak: k3-kontekstvelger-vedtak.md. Fasit: `P1 Nivåsignal Beslutningskart.dc.html` § 3a (trakt, interaktiv — Kenneth-låst) + § 2a (sidehode-toner). Branch: feat/k3-kontekstvelger fra develop.

## Prøvestein (akseptkriterium, Kenneths scenario)
Kundetelefon: «jeg er i det prosjektet» → slå opp firma → prosjekt → byggeplass, i den rekkefølgen, uten å måtte vite hvor du står. Alle tre nivåer skal være synlige i trakten samtidig (valgte som sammenfoldede rader, aktivt som åpen liste) — ingen nivåer skjult.

## Leveranse (ÉN samlet runde — Kenneth-dømt: halvtilstand er feilen, ikke løsningen)
A. **Trakten** (erstatter dagens popover-innhold i KontekstChip): firma → prosjekt → byggeplass per § 3a. Låste prinsipper: ett nivå åpent om gangen; valgt nivå = sammenfoldet rad m/ «Endre»; Alle/Mine = filter-pille; firma-steg kun ved flere firmaer; firmabytte nullstiller nedover; «Hele prosjektet» default, bygg-steg kun når byggeplasser finnes; lister >6 = søk + rulleliste m/ «Sist brukt» øverst; gruppeetikett navngir prosjektet («Alle på 998 …»). Lukk ved prosjektvalg; byggeplass = valgfritt ettervalg.
B. **Tonet sidehode på ALLE sider**: SonetonetSidehode (eksisterende delt komponent, generisk sone-prop) monteres på cowork-målt inventar — 13 firma-sider + ~23 prosjekt-sider. Amber=firma / blå=prosjekt overalt. INGEN duplisering: kun montering av den delte komponenten; trengs varianter, endres komponenten, ikke kopier.
C. **ByggeplassVelger ut av toppbaren**: fjernes helt i ny nav (K1 skjulte den i firmakontekst; nå bor byggeplass i trakten). Gammel nav røres ikke.

## Krav
- Flagg-status: trakt + velgerfjerning bak `nyNavigasjon` (bor i nav-skallet); sidehode-utrullingen flagg-nøytral (vedtak 7-prinsippet: funksjon på felles sider).
- i18n: nye nøkler er ventet (nivåetiketter, søkeplaceholder, «Sist brukt», «Alle på …») — flagg nøklene FØR generator-kjøring; cowork koordinerer (A-3b pauset, men sperre-disiplinen står).
- Enkeltmålte premisser: side-inventaret (13+23) er cowork-målt — verifiser ved montering; «sist besøkte prosjekt» sticky (prosjekt-kontekst.tsx:14) gjenbrukes for «Sist brukt».
- Popover-headeren skal vise prosjektets firma (R2-vilkåret, admin-konsekvensen).
- DoD: build grønn → skjermbilder: trakt alle steg + minst 3 firma- og 3 prosjekt-sider m/ tonet sidehode + kundetelefon-gjennomklikk → fabel-designgate → dok-sync → cowork-merge. Statuskilde: verifisering/k3-verifiseringslogg.md (opprettes).

## Kloss-deling (stopp-punkter)
Kloss 1: A (trakten). Kloss 2: C + B på HMS-parets 2 sider (referansemontering). Kloss 3: B resten (mekanisk utrulling). Rapportér etter hver kloss; fabel gater kloss 1+2 før kloss 3 ruller.
