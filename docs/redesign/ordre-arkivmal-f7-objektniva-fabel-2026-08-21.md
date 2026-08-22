# ORDRE — Arkiv-PDF: F7, innhold på repeater-objektnivå (D1)

> **🟢 KODE LEVERT 2026-08-22** (branch `fix/arkivmal-funn-3-4`, foldet inn i funn-4-leveransen — hull 2 = F7-D1, samme `innhold.ts:30-32`-datatap sett fra to ordrenumre). `byggUtenforRaderBlokk` (repeater.ts) rendrer «Registrert utenfor rader»-blokk (kommentar + vedlegg, merkelinje ordrett, 2/rekke løpenr+tid, filteller for ikke-bilder), objektbilder nummereres FØR radbildene, blokk over tabell/radkort. Case a/b/c + nummerering enhetstestet (`f7-utenfor-rader.test.ts`, 14 tester). `felt.ts` urørt.
> **🟢 FASIT-KVITTERING 2026-08-22** (branch `fix/f7-retting`): mockupsiden fantes likevel (side p9), eksportert som `mockup-f7-objektniva-vedtatt.png` (+ `tillegg-arkivmal-f7-fasit-fabel-2026-08-22.md`). Bygget blokk kvittert mot PNG-en. Fire avvik: **A1** (kommentar i guillemeter «…») + **A3** (merkelinje «Legg til rad», intet punktum) — RETTET. **A4** (fast 4:3) — IKKE avvik: `.ark-bilde-img` er delt radbilde-primitiv, bildeforhold bevart per radkort-designlås; «4:3 (mobilformat)» er plassholder-etikett. **A2** (bildetekst-suffiks «· med tegningsmarkering — se tegningsseksjon») — IKKE bygget: målt at `Vedlegg` (type "bilde"|"fil") ikke bærer markør, «Tegning»-knappen lagrer vanlig type:"bilde"-screenshot, markør er alltid egen drawing_position-feltverdi, og F7-blokken sitter på repeater-objektnivå (ingen markør). Suffikset mangler datagrunnlag → **fabels sak, ikke byggeoppgave.**
> **🔴 DoD-RESTANSE (Kenneth kjører):** de skjermbevis-avhengige punktene (1, 3) står åpne — BEF-001/BEF-002/BHO-002 er slettet, så de verifiseres mot et NYTT kontrolldokument Kenneth bygger på dagens mal. Enhetstestene (case a/b/c + nummerering + filteller + A1/A3) er grønne; det som gjenstår er web/mobil-PDF-bevis på det nye dokumentet, kvittert mot fasit-PNG-en.

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

> **⚠️ DoD OMSKREVET 2026-08-22 — verifiseringsgrunnlaget er borte.** BEF-001, BEF-002 og BHO-002 er slettet av Kenneth; de opprinnelige sjekkene («BHO-002 viser Testbilde», «BEF-001 fortsatt 73 bilder») kan ikke kjøres som skrevet, og skal IKKE gjenopprettes fra papirkurven. DoD-en baseres i stedet på **et nytt kontrolldokument Kenneth bygger på dagens mal** — bedre grunnlag: da verifiseres F7 mot et dokument laget etter gjeldende regler, ikke et pre-regel-dokument. Mockupsiden «Repeater F7» finnes ikke (bekreftet: null treff på «utenfor rader»/«repeater» i `arkivmal-pdf-mockup/`-mappa — Kenneth tar den med fabel); designgaten sammenlignes derfor mot ordrens skriftlige spec + fabels vurdering, ikke en mockup.

1. **Web + mobil verifisert på nytt dokument:** legg kommentar + bilde direkte på en repeater (uten «Legg til rad») i Kenneths nye mal; web-nedlastet arkiv-PDF viser dem i «Registrert utenfor rader»-blokken; mobil-generert PDF UENDRET (regresjonssjekk mot rad-stien). Bevis fra begge flater, ikke antakelse.
2. Testtilfeller (a)/(b)/(c) over + tom repeater uten objektnivå-innhold (kun «Ingen rader registrert», som i dag). **Enhetstestet 2026-08-22** (`f7-utenfor-rader.test.ts`, 14 tester).
3. Ny mal med bilder på både objektnivå og rad: objektbildene får lavere løpenr enn radbildene (nummereres først), og radrendringen er uendret. **Nummereringen enhetstestet** (objektbilde 01/02 → radbilde 03).
4. Vedlegg som ikke er bilder → filteller, aldri base64/JSON-dump i blokken. **Enhetstestet.**
5. Visuell gjennomgang mot ordrens skriftlige spec + fabels designgate (ikke mockup — den finnes ikke). Rotårsaksfiks fremfor plaster; kvalitet foran fart.
