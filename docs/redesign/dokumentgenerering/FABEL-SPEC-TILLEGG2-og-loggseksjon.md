# Fabel — SPEC-TILLEGG 2 + loggseksjon tegnet — 2026-08-11

## Kenneths prinsipputvidelse: tas inn ordrett i malspecen

**«Innstillinger styrer verken sporbarhet eller innhold — kun presentasjon.»**
Alt innhold som er produsert i dokumentet (utfylte felter, vedlegg, punkter,
rapportobjekter) skal med i utskriften, for alle dokumenttyper. Håndheves i
mal-modulen som eneste tolker av `utskriftsinnstillinger`; en innstilling som
skjuler innholdsfelter er per spec et brudd. (JSONB-friformen på `projects`
er nettopp derfor ikke et API — modulen definerer hvilke nøkler som finnes.)

## Form per KATEGORI, ikke per mal — presisert

Coworks måling tiltres: innholdsvariant velges av `category`
(sjekkliste/oppgave/hms/kontrollplan/timer/utlegg), innholdet kommer fra
malens rapportobjekter. Kundedefinerte maler («Befaringsnotat», «KS avvik»)
gir aldri nye varianter. HMS er ikke en syvende form — den er
oppgave/sjekkliste-formen pluss HMS-elementer (flytstripe, melder,
behandlingslogg), og arver dermed ChangeLog-seksjonen. PSI holdes utenfor
v1 (null bruk i prod).

## Loggseksjonen er tegnet — mockup oppdatert (nå 4 sider)

`Arkivmal PDF Mockup.dc.html`, vedlagt:
- **Side 1** (sjekkliste): statusblokken har fått «Sist endret»-feltet;
  bunntekst «Side 1 av 2». Signaturblokken er FLYTTET til side 2 — den står
  etter loggen, per beslutningen om at signaturen bekrefter alt foran seg.
- **Side 2** (ny): full endringslogg med 16 rader over fire dager — opprettelse,
  feltutfyllinger, vedlegg, retur fra godkjenning med korrigert måleverdi,
  re-innsending, godkjenning. Kronologisk eldste først; fra-verdi → til-verdi;
  statusoverganger og avvik i semantiske farger. Fortsettelses-topptekst i
  slank variant (logo 28px, én linje: firma · dokument · prosjekt) — det er
  denne rendreren gjentar per side ved paginering. Signaturblokk + bunntekst
  avslutter.
- **Side 3** (avskrudd variant): har fått den ærlige linjen «Endringslogg
  ikke aktivert for denne dokumenttypen» under statusblokken — kursiv, grå,
  i rammen.
- **Side 4** (RUH): uendret; behandlingsloggen der følger samme seksjon når
  malene bygges.

Lang-logg-testen cowork ba om: 16 rader fyller drøyt halve sida i tabellform
9.5px — et dokument med 15 revisjoner gir i praksis 1–2 ekstra sider, og
formen bærer det (thead gjentas, ingen radbryting midt i rad).

**Fase 3 kan låses når Kenneth har sett side 2 og 3.**

— fabel (relayet av Kenneth)
