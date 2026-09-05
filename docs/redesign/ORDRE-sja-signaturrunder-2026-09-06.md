# ORDRE — SJA-signaturrunder (fabel → redesign-Opus, 2026-09-06)

**Relayes via Kenneth. Cowork eier merge-timing.** Nå-rapport-grunnlag:
`docs/redesign/til-fabel/MAALING-sja-signaturmodell-2026-09-05.md` — alle tre funn tiltres
(vei 2-FK-er · frys av deltakerantall · rundenummer ER versjonen, ingen versjonskolonne).

## Gevinsten ordren bærer

GJENBRUK: én SJA per arbeidsoperasjon, signert på nytt hver gang jobben gjøres — ikke ny SJA
per gang. Runder + låsing er mekanismene som gjør gjenbruket forsvarlig. Lovpålagt
dokumentasjon skal kunne svare «hvem har signert, hvem mangler» — i felt og i arkiv-PDF.

## Designlås (kvitter «designavvik: ingen» eller list forslag FØR koding)

Kildedokumenter (repo `docs/redesign/`): `sja-signaturer-svar-fabel-2026-09-05.md` (2015) ·
`-tillegg-levende-liste-` (2130) · `-runder-modell-` (2300) · `-laasutloser-` (2345).
Mockup: `SJA Signaturer Mockup.dc.html` (designprosjektet — Kenneth-sett). Låste vedtak:

**Datamodell (ingen ny kolonne på dokumenttabellene):**
- `SignaturRunde`: `checklistId?` + `taskId?` (nullbare FK-er, `onDelete: Cascade`,
  XOR-guard: nøyaktig én satt) · rundeNr · startetAt/startetAv · avsluttetAt?/avsluttetAv? ·
  årsak? · **antallDeltakere fryses ved «Avslutt runde»** (PSI-snapshot-prinsippet).
- `DokumentDeltaker`: samme FK-par · `userId` XOR gjest (guestName/guestCompany/guestPhone) ·
  lagtTilAt · fjernetAt? (aldri hard delete — historikk består).
- `DokumentSignatur`: `rundeId` (FK cascade) · `deltakerId` (FK) · hmsKortNr/harIkkeHmsKort ·
  signaturbilde · completedAt · `@@unique([rundeId, deltakerId])`. Identitet bor på
  deltakeren; signaturen bærer kort, bilde, tidspunkt.
- Manko gjeldende runde = aktive deltakere minus rundens signaturer. Historiske runder
  rekonstrueres via datoer: aktiv = lagtTilAt ≤ rundens avsluttetAt < fjernetAt (eller aldri
  fjernet). Chip-spørringen bygges som coworks målte énspørring (nøstet take:1 + _count).

**Runde-livssyklus:**
- Runde 1 opprettes automatisk når Signaturliste-objektet tas i bruk i et dokument.
- «Avslutt runde» (handling, kun ansvarlig/redigeringsrettighet): låser ALT innhold + fryser
  antallDeltakere. Ingen klokke-lås; valgfri myk påminnelse ved døgnskifte («runden fra i går
  står åpen») — nudge, aldri auto.
- «Start ny runde»: gjenåpner innhold, nytt signatursett; forrige runde består urørt.
- Åpen runde m/signaturer: felt-endring TILLATT med amber varsel («N har signert denne
  runden — vurder ny runde») + endringslogg. Ingen auto-invalidering.
- Etter avsluttet runde: helt lukket — også tilbehør. Nye observasjoner → avvik/RUH eller
  ny runde.

**UI (mockupen er fasit for form):**
- Nytt MalBygger-objekt **«Signaturliste»** (`signature_list`) — full felttype: palett,
  config, renderer web+mobil, PDF (~12 filer per coworks måling; mønster: weather/quiz).
- Objektet leder med status «X av Y signert», manko FØRST (amber boks): navn+firma, «Signer»
  på egen rad (gated: innlogget bruker = deltakerens userId), gjest-rad merket «signer på
  ansvarliges enhet» (PSI-mønsteret). Signerte under m/tidspunkt+HMS-kort; forrige-runde-
  signaturer flagget amber, teller ikke i X.
- «+ Legg til deltaker»: prosjektmedlemmer + gjest-skjema; kontekst-forslag fra mannskap på
  byggeplassen (foreslå, aldri auto-legg).
- Chip på dokumentkortet i HMS-lista: `4/6` amber til komplett, grønn ved alle-signert-
  gjeldende. Én spørring (målt).
- Låst dokument VISER låsen: lesemodus + «Låst — runde N avsluttet <dato>. Endring krever ny
  runde» der redigering forsøkes. Aldri stille avvisning. Alle nye dialoger har Avbryt.

**PDF (delt `packages/pdf`, web + mobil):**
- Hovedtabell = gjeldende runde: navn · firma · HMS-kort · signert (dato/kl) · runde.
  **«IKKE SIGNERT» og forrige-runde-rader står ALLTID i tabellen — aldri utelatt** (F7-
  prinsippet). Topplinje «Runde N (startet <dato>) · X av Y signert · generert <tidspunkt>».
- «Med logg»-varianten: alle runder m/dato/årsak og hver rundes signatursett.

**Delleveranse 2 — `signature`-feltet (alle dokumenttyper):** ved signering lagres innlogget
bruker + tidspunkt; web/mobil/PDF viser «Navn · dato kl.» under bildet. Anonym strek utgår.

## Utenfor ordren (rutes separat)
- TILBEHOR_REN_FJERNING-divergens web(4)/mobil(5): eget funn — fiks er ÉN delt kilde i
  `@sitedoc/shared`, avklar weather-avviket mot Kenneth. Liten egen sak.
- PSI-migrering til fellesmodellen: senere sak. `PsiSignatur` røres ikke.
- Premiss 3-utskillelsen (PDF viser grensekrav): egen DG-sak, uendret.

## Klikk-budsjett (rapporter faktisk antall ved levering)
- Signere egen rad fra åpnet dokument: **≤ 2** (finn objektet · Signer).
- SHA-KU finne manko: **0 nye** — chip i lista + manko øverst i objektet.
- Gjenta kjent jobb: åpne SJA → Start ny runde → bekreft: **≤ 3**.
- Legge til deltaker fra prosjektet: **≤ 3** fra objektet.

## Funksjonsinventar
Ny felttype — ingen eksisterende komponent omskrives. Flater som RØRES (kun tillegg):
utfyllings-renderere web+mobil (ny type i registeret) · MalBygger palett/FeltKonfigurasjon ·
HMS-listekort (chip) · `packages/pdf` (ny felt-renderer + logg-seksjon). Kvitter at ingen
eksisterende atferd endres på disse flatene; `persons`-feltet består uendret.

## DoD (rammeverket)
1. Kodet (delte kilder: manko-/statuslogikk i `@sitedoc/shared`, PDF i `packages/pdf`)
2. Build grønn (web build + mobil-typecheck)
3. Skjermbilde-designgate hos fabel — leveransen sjekkes linje for linje mot designlåsen +
   mockupen; task-walkthrough mot klikk-budsjettet
4. Dok-sync (exit-protokollens a–d; MALBYGGER.md får Signaturliste-objektet)
5. Merge via cowork

— fabel
