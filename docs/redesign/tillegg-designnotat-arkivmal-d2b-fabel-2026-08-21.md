---
name: tillegg-designnotat-arkivmal-d2b-fabel-2026-08-21
description: TILLEGG-blokk til designnotat-arkivmal-pdf-fabel-2026-08-21.md — cowork fletter inn under D2b. Aldri erstatt hel fil (rammeverksregel 2026-08-21).
sist_endret: 2026-08-21
---

# TILLEGG til D2b (flettes inn av cowork)

## D2b-utvidelse: detaljutsnitt i tabellraden (ratifisert av fabel 2026-08-21)

Vedtak tatt av cowork under klarsignal for 2b + D2b + funn 3, ratifisert av fabel som
konvergens med D2-prinsippet (oversikt + detalj per markering) — detaljen flytter fra egen
blokk inn i tabellraden på helsiden:

- Helside per tegning med markører: hele tegningen fullformat, roteres til liggende når
  bredere enn høy; alle markører nummerert (SVG-sirkel med radnr); tabell under med
  markør# · punkttekst · detaljutsnitt (· resultat kun når malen har status-kolonne).
- Per-rad oversikt+detalj-blokk er AVVIST (oversikten ville vært identisk per rad).
- Frittstående `drawing_position`-felt beholder blokk-formen fra D2 steg 2 uendret.
  REGEL: blokk-form for enkeltfelt, helside + radutsnitt for repeater-markører — to
  presentasjonsformer for samme felttype er vedtatt, ikke inkonsistens.

Fabel-krav til implementasjonen (gates ved designgodkjenning):
1. Bilde-bevisst tabell-paginering: rad med utsnitt splittes aldri over sidegrense.
2. Fast utsnitts-spesifikasjon: 4×-zoom fra D2 steg 2, fast fysisk størrelse i raden,
   crop klemt innenfor tegningskanten ved markør nær kant.
3. Moderat DPI per utsnitt (arkivstørrelse, ikke print-DPI).
4. «Gjenbruk av utsnitts-maskineriet» verifiseres: funksjonen må ta målstørrelse som
   parameter — ellers meldes det som ny kodeflate, ikke gjenbruk.

Tilhørende krav (cowork-formulert, fabel-tiltrådt): drawingId-innsamling REKURSIV (ikke ett
nivå), flat nummerering per tegning i denne runden, negativ-test markør på tegning A +
doc-lokasjon på tegning B → begge tegninger i PDF. `felt.ts` frosset; alt i
`arkivmal/tegningsside.ts`.
