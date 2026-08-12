# Fabel — ARKIVMAL GODKJENT av Kenneth — malspesifikasjon til fase 3 — 2026-08-11

Kenneth har sett og godkjent mal-mockupen (to eksempler: sjekkliste SJ-2026-0142
og RUH RUH-2026-0037, A4). Fase 3 (PDF-rendrer) er dermed avblokket når fase 1–2
er levert. Mockup-filen: `Arkivmal PDF Mockup.dc.html` (dette prosjektet).

## Malspesifikasjon (normativ for alle seks dokumenttyper)

**Ramme, lik på hver side:**
1. **Topptekst** (ramme 1px #c7cbd4): firmalogo (38px, eksportfirmaets),
   firmanavn + org.nr venstre; høyre: dokumenttype (uppercase, #26327e),
   dokumentnavn (fet), dokumentnr.
2. **Prosjektblokk** (samme ramme, videreført): Prosjekt / Byggeplass /
   Byggherre — tre kolonner, etikett grå + verdi fet.
3. **Statusblokk** (grå bakgrunn #f5f6f9): Status (semantisk farge:
   godkjent/lukket grønn #15803d, avvik/åpen rød #b91c1c) / Utført- eller
   Meldt av med rolle / relevante datoer — fire kolonner.
4. **Innhold** per dokumenttype: tabeller med #26327e-understreket
   seksjonsheading; radlinjer #e2e4ea.
5. **Bilder**: inline i lesbar størrelse, ramme med etikett som refererer
   originalfilnavn («original følger pakken»); tegningsutsnitt med markør
   likebehandles.
6. **Signaturblokk** (nederst, over bunntekst): signatur over strek, under
   streken rolle-etikett + navn + «signert/registrert i SiteDoc {dato}
   {klokkeslett}». Reelle signaturdata (sjekkliste/SJA) gjengis; der
   signatur mangler, felt med åpen strek.
7. **Bunntekst**: «Generert fra SiteDoc {dato} {tid} · dokument-id {id}»
   venstre, «Side X av Y» høyre. Dokument-id = systemets id (sporbarhet).

**Typografi/farger:** IBM Plex Sans; brødtekst 10.5px/1.45 (tilsv. ~8pt ved
A4-skala i mockupen — rendreren kalibrerer til min. 9pt trykk); marger
15/16/10 mm; aksent #26327e (SiteDoc-navy), grått register #6b7280/#9ca3af,
linjer #c7cbd4/#e2e4ea. Ingen interaktive rester i arkivutgaven.

**Implementasjonsnotat:** felles mal-modul i `packages/pdf` (ramme som delte
byggeklosser); dokumenttypene leverer kun innholdsseksjoner (§ 4). De tre
eksisterende generatorene harmoniseres mot denne; de tre nye (HMS, timer,
utlegg) skrives rett mot den.

— fabel (relayet av Kenneth)
