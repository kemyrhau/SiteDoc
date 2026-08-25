# ORDRE — Arkiv-PDF: tegning og lokasjon (D2 + D2b)
**Fra:** fabel · **Dato:** 2026-08-21 · **Til:** kode-agent (via Kenneth) · **Spor:** DG (masterplan, plass 0b)
**Grunnlag:** `docs/redesign/designnotat-arkivmal-pdf-fabel-2026-08-21.md` (Kenneth-godkjent, committet develop) · mockup «Arkivmal PDF Mockup» sidene «Tegninger i arkivet», «Helside tegningsprint», side 1-hodene

## Mål
Arkiv-PDF-en skal skrive ut tegningsposisjoner og dokumentlokasjon. I dag utelates begge (`felt.ts:36` → `return ""`), og klient-utskriften som var eneste vei til tegningsutskrift ble fjernet 20.08 (F2, d92ece42). Dette er datatap i kundeleveransen og går foran alt annet i DG-sporet.

## Arkitekturvalg — BINDENDE (avklart med cowork 21.08)
`felt.ts` er DELT kode: `arkivmal/innhold.ts:13` importerer `renderFelt` fra `../felt`, som også er mobil-PDF-ens renderer. Legges tegningsrendering inn i `felt.ts`, treffer den mobil-PDF-en samtidig — uten at noen har designet hvordan tegning skal se ut der.

**Vedtak: felt.ts røres IKKE.** Overstyringen skjer i `arkivmal/` etter samme mønster som repeater-overriden (`innhold.ts` intercepter `repeater` før delegering til `renderFelt`):
- `innhold.ts` intercepter typene `drawing_position` og `location` og kaller arkiv-egen rendering.
- Tegningsutsnittene GJENBRUKER `byggTegningPosisjon` (`tegning.ts:27`) — aldri kopi av logikken.
- Mobil-PDF skal være **bit-for-bit uendret** av denne ordren; mobil-tegningsvisning er egen designsak senere.

## D2 — per markering + dokumentlokasjon
1. **`drawing_position` (feltnivå):** per markering én blokk: oversikt (hele tegningen m/markør + utsnittsramme) + detalj (4× zoom rundt markøren), via `byggTegningPosisjon`. Flere markeringer → én blokk per markering, gruppert per tegning. Tegningsnavn som blokk-tittel.
2. **`location` (dokumentnivå):** dokument-lokasjon ER en tegningsmarkør (drawingId + positionX/Y — ingen lat/lng, ingen kartgenerator; cowork-verifisert 21.08). Rendres ØVERST på side 1, rett under dokumenthodet, i alle dokumentklasser (sjekkliste/oppgave/HMS), **identisk med drawing_position-formen:** hele tegningen m/markør venstre + 4× detaljutsnitt høyre, via `byggTegningPosisjon`. **Format 14:9 — endret plassering endrer aldri format.** Tekstlinje under: bygning · byggeplass · tegningsnavn. «Punkt satt av hvem/når» utelates — feltet finnes ikke (ev. changelog-utledning er egen sak).
3. **Ingen GPS-/koordinatspråk i utskriften** — det finnes ingen koordinat å skrive ut.
4. **Uten markering utelates seksjonen helt** — aldri tom boks eller tom tegningsblokk.

## D2b — helside per tegning

> **🔴 REVISJON (Kenneth-vedtak 2026-08-22):** helside skrives KUN for en tegning med **2 ELLER FLERE markører**. Helsiden finnes for å vise SAMMENHENGEN mellom punkter; med ett punkt er radens detaljutsnitt (i repeater-cella) fullstendig, og helsiden tilfører kun et ekstra ark. Teller PER tegning (ikke totalt): to tegninger med én markør hver → ingen helsider; én tegning med to → én helside. Dokument-lokasjonen teller ikke (samles ikke som repeater-markør). Impl: `velgHelsider` (`packages/pdf/src/arkivmal/tegningsside.ts`) + `sammenstilling.ts`. Testet (`tegningsside.test.ts`). Erstatter «har markeringer» (≥1) under.

Per tegning med ≥2 markører (revisjon over): ÉN helside med hele tegningen i størst mulig format (roter til liggende når tegningen er bredere enn høy), ALLE markører nummerert — **markørnummer = punktnummer i rapporten** — og markør→punkt-tabell under (markør · punkttekst · resultat). D2-blokkene supplerer helsiden, erstatter den ikke. Færre enn 2 markører på en tegning → ingen tegningsside.

## Avgrensning
- Kun arkiv-PDF-stien (`packages/pdf/src/arkivmal/`). Ingen endring i `felt.ts`, `sjekkliste.ts` (gammel vei) eller mobil-appen.
- Nedlastingsvarianter (D4), instruksjonstyper (D3), samlerapporter (D6) og F7 er egne ordrer.

## Definition of Done
1. **Web + mobil verifisert — eksplisitt krav.** PDF-motoren er delt (`packages/pdf`); exit krever bevis fra BEGGE flater: (a) web-nedlastet arkiv-PDF viser lokasjon side 1 + tegningsblokker + helside(r); (b) mobil-generert PDF er UENDRET (regresjonssjekk mot før-PDF av samme dokument). Kjent feilmønster fra paritetskartleggingen 20.08 (24 avvik): «fiks landet på én flate, aldri portert» — derfor bevis, ikke antakelse.
2. Testdokumenter: BHO-002 (dokumentlokasjon + tegningsmarkering på objektnivå-vedlegg), BEF-001 (flere markører på samme tegning → helside m/nummererte markører), ett dokument UTEN markeringer (ingen tomme seksjoner, ingen tegningsside).
3. `byggTegningPosisjon` gjenbrukt — null duplisert logikk; ingen nye avhengigheter i packages/pdf.
4. Tomme-/kant-tilstander: markering uten bilde-dimensjoner (imageWidth/Height null), tegning slettet etter markering, flere tegninger i samme dokument.
5. Skjermbevis per ny side/blokk mot mockupens form. Rotårsaksfiks fremfor plaster; kvalitet foran fart.
