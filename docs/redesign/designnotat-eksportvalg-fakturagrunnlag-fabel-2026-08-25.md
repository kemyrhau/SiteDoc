# Designnotat — eksportvalg og fakturagrunnlag (Timer-rapport)

**Fra:** fabel · **Dato:** 2026-08-25 · **Status:** til Kenneths valg → deretter ordre
**Mockup:** «Eksportvalg Mockup.dc.html» (1a anbefalt, 1b alternativ, 1c KPI-svar)

## Rammen: bekreftet, med kodebevis

Lønnsgrunnlag og fakturagrunnlag er to dokumenter av samme data — rammen er riktig.
Og domenet har allerede eksport-inkludering som OPPSETTSBESLUTNING, ikke
per-eksport-valg: både lønnsarter og tillegg bærer `skalEksporteres` per type
(lonnsarter/page.tsx:28, tillegg/page.tsx:23). Tolv avhukinger per eksport ville
duplisert en mekanisme som finnes. Riktig modell: navngitte formål med
forhåndsvalg, der oppsettsflaggene respekteres i alle formål.

## Alternativer, rangert

### 1 — ANBEFALT: formålsvalg i eksportknappen (mockup 1a)

(a) **Hvor valgene bor:** «Eksporter» blir splittknapp — samme mønster som
arkiv-PDF-en (D4), så brukeren lærer ett mønster. Klikk = sist brukte formål
(husket per bruker). Pilen åpner meny med tre formål + «Tilpasset …»:

- **Lønnsgrunnlag** (standard) — timer per ansatt og lønnsart, tillegg, utlegg
  til refusjon. Gruppert per ansatt.
- **Fakturagrunnlag** — timer og maskintimer per prosjekt, viderefakturerbare
  utlegg. Gruppert per prosjekt. Går UT av huset: profesjonell topptekst med
  firmanavn, periode, prosjekt.
- **Full eksport** — alle ark (dagens seks + detaljarkene).
- **Tilpasset …** — modal med avhukinger gruppert som formålene (detaljark /
  aggregater). Eneste flate med checkbokser.

(b) **Standardvalg:** Lønnsgrunnlag — den hyppigste, interne bruken. Hvert
menypunkt viser innholdet sitt som undertekst, så valget er informert uten å
åpne noe.

(c) **Når det ikke brukes:** siden er identisk med i dag — én knapp, ett klikk.
Null ny flate.

**Hvorfor rangert først:** kompleksiteten er tilgjengelig uten å være
påtrengende (Kenneths eget kriterium), standardvalget er riktig for de fleste,
og mønsteret er allerede vedtatt for arkiv-PDF-en.

### 2 — Inline eksportpanel (mockup 1b)

(a) Segmentvalg (Lønnsgrunnlag / Fakturagrunnlag / Full) + «Tilpass»-lenke i en
egen rad over tabellen. (b) Samme standard. (c) Alltid synlig — det er ulempen:
permanent flate på en side som mest brukes til å SE rapporten, og raden
konkurrerer med filterlinjen. Velges bare hvis eksport viser seg å være
hovedbruken av siden.

### 3 — Modal med avhukinger ved hvert eksport-klikk (ikke mockupet)

Hver eksport blir to klikk, og de fleste eksporter er standardvalget — modellen
skattlegger normaltilfellet for å betjene unntaket. Rangert sist; nevnt fordi
det er den vanligste løsningen i hyllevare.

## KPI-spørsmålet: ikke ni kort (mockup 1c)

De fem kortene svarer på sidens jobb — attesteringsstatus, det lederen skal
handle på. Maskin, tillegg og utlegg er økonomi-dimensjoner og hører hjemme som
kolonner i ansatt-tabellen (Maskin t · Tillegg · Utlegg kr), der cowork har målt
at dataene allerede hentes men kastes i returtypen. Utlegg-kolonnen krever den
ene serverendringen (include-blokka — samme hull som detaljeksporten).

## Avhengigheter og avgrensninger

- Formål-presetsene bygger på detaljeksport-ordren (timerader/maskin/tillegg/
  utlegg-ark med sheetTimer.id-nøkler) — samme raduttrekk, formålet styrer bare
  hvilke ark og hvilken gruppering.
- `skalEksporteres = nei` holdes utenfor i ALLE formål og listes ikke i
  Tilpasset-modalen — oppsett eier den beslutningen.
- Kostnad/enhetspris per rad: utenfor scope (Kenneth-vedtak), men
  Fakturagrunnlag-arket får kolonnene sist slik at pris kan legges til uten
  omstrukturering når maskin-/varelagermodellen lander.
- Underprosjekt (proadm-dokumentflyt): som i detaljeksport-ordren — datadrevet
  gruppering, kolonne kan kobles på sheetTimer.id senere.
