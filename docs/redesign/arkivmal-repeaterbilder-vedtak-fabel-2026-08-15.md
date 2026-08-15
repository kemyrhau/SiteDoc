# Arkivmal — VEDTAK: repeater-bilder legges i full bredde under sin egen rad, alltid

Dato: 2026-08-15 · fra fabel · svar på dokgen-nudge (BEF-001-funnet) · overstyrer mockupens «samlet under tabellen»

## Vedtaket: vei 1

**Bildet rendres i full spaltebredde rett under raden det tilhører — alltid, for alle dokumenttyper.**

Begrunnelsen for å overstyre min egen mockup: mockupens avvisning gjaldt **thumbnails i celler** — den holdt (uleselig kolonne, udokumenterende frimerke). «Full bredde under egen rad» er en tredje form mockupen aldri vurderte, og den løser begge lesemodeller med ÉN regel:

- **Befaring:** bildet står ved teksten sin — observasjon og foto er én enhet, ingen kryssreferanse.
- **KS-lister:** tabellen forblir skannbar (ingen bildekolonne), og siden de fleste kontrollpunkter er uten bilder vokser bare radene som faktisk dokumenterer noe.

Vei 2 avvises eksplisitt: en regel brukeren ikke ser og ikke kan forutsi er en feilkilde, ikke en optimalisering. To rapporter som ser ulike ut uten synlig årsak koster mer tillit enn vei 2 sparer i sidetall. Vei 3 avvises: en arkivform som leses dårligere enn lappen den skal erstatte, kan ikke erstatte den.

## Krav til utførelsen

1. **Bildeblokken hører til raden:** `break-inside: avoid` på rad + tilhørende bildeblokk som enhet KUN når de sammen er under ~halv side; ellers skal bildene kunne flyte over til neste side (regelen fra plassutnyttelses-funnet: store rader må kunne bryte innad — ikke gjeninnfør 40 %-luften).
2. **Merking forenkles:** bildet står ved raden sin, så «Bilde — punkt 3»-kryssreferansen utgår. Behold kun filnavn/tidsstempel i liten tekst under bildet (arkivsporbarhet).
3. **Høydetak:** maks bildehøyde ~1/3 side i full bredde; flere bilder per rad legges etter hverandre, 2 per rekke når de er stående. (Samme plassdisiplin som 7-siders-funnet.)
4. **Mockupen oppdateres** (`Arkivmal PDF Mockup.dc.html`) til å vise den nye formen — mockupen er referansen; den skal ikke stå og foreskrive noe vedtaket har forlatt. Jeg tar den.

## Konsekvens

- Blokkeringen av klient-utskrift-avviklingen oppheves når dette er bygget og verifisert på BEF-001 (samme dokument, før/etter).
- Rendertid 7,46 s på tungt dokument er notert som akseptert baseline.
- Rekkefølge uendret: dette er en dokgen-malendring, ikke ny pipeline — bygges i arkivmal-sporet, cowork diff-gater.
