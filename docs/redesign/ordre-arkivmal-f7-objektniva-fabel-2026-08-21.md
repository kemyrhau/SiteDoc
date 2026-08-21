# ORDRE — Arkiv-PDF: F7, innhold på repeater-objektnivå (D1)
**Fra:** fabel · **Dato:** 2026-08-21 · **Til:** kode-agent (via Kenneth) · **Spor:** DG (masterplan, plass 0b — etter D2/D2b)
**Grunnlag:** `docs/redesign/designnotat-arkivmal-pdf-fabel-2026-08-21.md` (D1, Kenneth-godkjent) · `docs/redesign/beslutning-repeater-label-modell-fabel-2026-08-21.md` (D8) · mockupside «Repeater F7»
**Status avklart:** BEF-001-test kjørt 21.08 — bildene kom med. F7 er **eksisterende mangel**, ikke regresjon fra deployen 20.08.

## Funnet (prod, BHO-002)
Kommentar og vedlegg kan festes direkte på repeater-OBJEKTET uten at «Legg til rad» trykkes — malbyggeren og utfyllingen tillater tilstanden. Web viser innholdet; arkiv-PDF-en taper det stille: `arkivmal/repeater.ts` (`byggRepeaterTabell(objekt, verdi, label)`) leser kun rad-arrayet, og `innhold.ts` sender aldri feltets `kommentar`/`vedlegg` videre for repeater-typen. Tom repeater viser korrekt «Ingen rader registrert» — men objektnivå-innholdet vises ingen steder. Stille datatap i leveransen som skal være etterprøvbar.

## Design (D1 — bindende)
Innhold på objektnivå rendres som **egen merket blokk «Registrert utenfor rader»** rett OVER repeater-tabellen:
- Merkelinje: «Registrert utenfor rader — kommentar og vedlegg festet direkte på skjemaet, uten 'Legg til rad'».
- Innhold: kommentar (tekst) + vedlegg i standard bilderutenett (2 pr. rekke, løpenr + tid — samme primitiver som radbildene); filer som teller.
- **Aldri som «rad 0»** — det ville forfalsket radtellingen. **Aldri utelatt.**
- Gjelder ALLE kombinasjoner: (a) objektnivå-innhold + 0 rader (BHO-002-tilfellet: blokk + «Ingen rader registrert»), (b) objektnivå-innhold + rader (blokk over tabellen), (c) kun rader (ingen blokk — uendret utseende).
- Modellbegrunnelse (D8): en repeater ER rader × kolonner; innhold utenfor rader er per definisjon utenfor tabellen og merkes som det.

## Implementering
- Kun `packages/pdf/src/arkivmal/` (repeater.ts + innhold.ts): `innhold.ts` sender hele `FeltVerdi` (ikke bare `verdi`) til repeater-rendringen; blokken bygges der. `felt.ts` røres IKKE (delt med mobil-stien; frosset repeater-case består).
- Gjenbruk delte primitiver (esc, bilderutenett/byggBilderader-mønsteret, formaterDatoTidPunkt). Bilde-løpenummer: objektnivå-bildene nummereres FØR radbildene (de står først på siden); `bildeNr` fra appen har forrang som ellers.
- Ingen datamodell-endring, ingen migrering.

## Definition of Done
1. **Web + mobil verifisert:** web-nedlastet arkiv-PDF av BHO-002 viser kommentaren «Testbilde» + bildet i blokken; mobil-generert PDF UENDRET (regresjonssjekk). Jf. paritetskartleggingen (24 avvik): bevis fra begge flater, ikke antakelse.
2. Testtilfeller (a)/(b)/(c) over + tom repeater uten objektnivå-innhold (kun «Ingen rader registrert», som i dag).
3. BEF-001 re-lastes etter fiksen: fortsatt 73 bilder, uendret radrendering (ingen sideeffekt på rad-stien).
4. Vedlegg som ikke er bilder → filteller, aldri base64/JSON-dump i blokken.
5. Skjermbevis mot mockupsiden «Repeater F7». Rotårsaksfiks fremfor plaster; kvalitet foran fart.
