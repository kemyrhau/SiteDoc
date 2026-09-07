# Designkall — fritekstsøk + filter/sortering i mobil dokumentliste — fabel 2026-09-06

Kenneth-bestilling 06.09 (skjermbilder fra prod, OTA 01a0775): «behov for fritekstsøk for
alle dokumenter, samt mulighet å sortere på egenskaper … søke på dokumentflyt → på tegning
→ Emne og andre egenskaper.» Mockup: `mockups/Dokumentsøk Mobil Mockup.dc.html` (vedlagt,
Kenneth-regelen 06.09).

## Designgate byggeplassfilter — GODKJENT med ett avvik

Skjermbildene viser levert form = designlåsen: badge «Hele prosjektet» (grå outline) i
byggeplass-visning, per-rad byggeplass-badge (blå) i prosjekt-visning, ærlig chip-tekst.
**Avvik til ordre:** chip-underteksten trunkeres («…hele prosje…») på smal skjerm — den
ærlige teksten må overleve trunkering. Fiks: kortform «+ hele prosjektets dokumenter»
(mockup panel 1 viser den), alternativt tillat to linjer.

## Designlås — søk + filter

1. **Søk: ikon i headeren** (ved «+», koster null plass) → søkefelt erstatter headerraden,
   med synlig Avbryt (avbrytbarhets-regelen). 2 interaksjoner til treff.
2. **Søket dekker:** tittel, dokumentflyt, emne/mal, byggeplassnavn, tilknyttet tegning.
   **Gjenbruk, ikke nybygg:** den delte søkemotoren fra Finnbarhets-revisjonen
   (skrivefeil-toleranse + synonymlag, 14/14 test) er kilden — ingen ny match-logikk.
   ⚠️ Cowork verifiserer at motoren er pakket delbart for mobil (enkeltmålt: den er i dag
   web-søkets).
3. **Søk overstyrer byggeplassfilteret** — søker man, søkes HELE prosjektet, og treff
   utenfor valgt byggeplass merkes med byggeplass-badgen (regelen fra byggeplassfilter-
   kallet: raden viser tilhørighet når konteksten er bredere enn objektets hjem). Et
   dokument man leter etter skal aldri være usynlig pga. valgt kontekst.
4. **Filter: trakt-ikon fast til høyre for statuschippene (Excel-mønsteret, Kenneth
   06.09):** nøytralt når alt vises; fylt blått med teller («▼ 2») når det filtrerer bort
   objekter. **Sheetet er mobilens motstykke til webs kolonnetrakter (Kenneth 06.09,
   skjermbilde):** samme egenskapssett som tabellkolonnene — Dokumentflyt (chips) ·
   Emne/mal · Ansvarlig · Tidsfrist · Tilknyttet tegning · Sortering (Nyeste først
   [default] / Eldste / Navn A–Å) — og SAMME delte filterpredikat som webs
   kolonnefiltre (@sitedoc/shared), så to flater aldri filtrerer ulikt. Primærknapp
   «Vis N treff» (levende teller — webs «6 av 9»-motstykke). Trykk-utenfor lukker
   (delvis flate) + Nullstill.
5. **Byggeplass og status er IKKE i sheetet** — statuschippene ER status-trakten (velg
   «Mottatt» → kun disse vises, Kenneths eksempel), byggeplass bor i kontekstvelgeren.
   Aldri to steder for samme valg (kontekst-default-regelen).
6. **Det skal aldri være usynlig AT lista er filtrert:** aktive egenskaper = fjernbare
   chips over lista + «Viser 4 av 11 — nullstill filter»-linje nederst + fylt trakt-ikon.
   Tilstanden overlever navigasjon inn/ut av et dokument, nullstilles ved bytte av
   prosjekt.
7. **Flagg-nøytralt:** funksjonen bygges på dokumentlisten begge nav-verdener deler —
   ikke bak `nyNavigasjon`.
8. Web har allerede kolonnetrakter og «Velg parameter» — mobil-saken bygger
   filterpredikatet delt (@sitedoc/shared) og web-kolonnene bytter til det i egen,
   senere sak: to flater, én filterkilde.

## Klikk-budsjett

Finne et dokument på navn: i dag = scrolle (ubegrenset); etter = 2 interaksjoner
(ikon + skriv). Avgrense på dokumentflyt: 3 (Filter → chip → utenfor/Vis treff).
Ingen nye obligatoriske valg.

## Neste

Kenneths blikk på mockupen → cowork kost-sjekker (søkemotor-delbarhet, felt-dekning i
list-query) → cowork skriver ordre. Kø-plassering: etter grenseresolver-ordren — dette er
pilot-viktig (feltarbeiderens finnbarhet) men blokkerer ingen andre saker.

## TIL MASTERPLAN (tillegg — cowork fletter)

- Ny rad/sak: «SØ — Dokumentsøk + filter mobil (Kenneth-bestilling 06.09). Designkall
  levert (`designkall-dokumentsok-mobil-fabel-2026-09-06.md` + mockup i
  docs/redesign/mockups/). Gjenbruker Finnbarhets-søkemotoren. Venter Kenneth-blikk →
  cowork kost-sjekk → ordre.»
- Byggeplassfilter-saken: «designgate mot prod-skjermbilder GODKJENT 06.09; restavvik:
  chip-undertekst trunkeres — kortform ‘+ hele prosjektets dokumenter’ i neste ordre.»

— fabel
