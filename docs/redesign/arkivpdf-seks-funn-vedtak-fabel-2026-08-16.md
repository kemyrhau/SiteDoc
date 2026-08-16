# Arkiv-PDF — seks prod-funn på BEF-001 med vedtak (bildenummer i app, støyrydding, endringslogg)

Dato: 2026-08-16 · fra fabel · Kenneth-funn på ekte prod-utskrift, natt til 16.08

## 1. 🔴 VEDTAK: bildenummerering flyttes til APPEN — print-nummerering forlates

Funnet: side 4-bildene (avvik-seksjonen) mangler «Bilde NN»-merking og nummerrekken bryter fra side 3 — repeater og andre malobjekter har hver sin nummerering.

Kenneths vedtak, som overstyrer nummereringsdelen av repeater-vedtaket 2026-08-15:
- **Bildenummer tildeles når bildet tas i appen**, løpende stigende per sjekkliste, uavhengig av hvilket malobjekt bildet hører til.
- **Nummeret er synlig i appen** og kan dermed refereres i tekst under befaringen («se bilde 07») — det er derfor nummerering i print er feil tilnærming: et nummer som oppstår ved rendering finnes ikke når teksten skrives.
- Utskriften rendrer det LAGREDE nummeret. Dokgen teller aldri selv.
- Konsekvens: dette er en app-/modellendring (feltet `bildeNr` på bildeobjektet, tildeles ved opptak/opplasting) + en dokgen-endring (les feltet). Eksisterende dokumenter uten bildeNr: dokgen faller tilbake til dokumentrekkefølge, merket likt — ingen re-nummerering av arkiverte dokumenter.

## 2. Filnavn IMG_xxxxxxx fjernes fra utskrift

Bildeteksten blir «Bilde 07 · 13.08.2026 10:41» — nummer + dato/klokkeslett. Filnavnet er internt og sier ingenting; originalen er sporbar via pakken uansett.

## 3. dokument-id fjernes fra bunnteksten

`dokument-id 9e52a1a-…` er SiteDocs interne nøkkel — kun nyttig ved databasespørring, som ingen bruker gjør fra papir. Bunntekst beholder «Generert fra SiteDoc {dato, klokkeslett}» + sidetall. (Dokumentnr. BEF-001 i toppen er brukerens referanse og står.)

## 4. Side 1: margene strammes

Stor luft over og rundt dokumentkortet på side 1. Toppmargen reduseres så kortet starter nær sidehodet; sidemargene ned mot samme marg som innholdssidene. Gevinsten er at Befaringsdato/Vær/Deltakere + observasjonsstart kommer med på side 1.

## 5. Endringslogg: værsnapshot og no-op-rader er støy

Funnet viser tre ting loggen gjør feil i dag:
- **Rå JSON-diff** for vær ({"temp":"15.9°C",…} → {…}) — uleselig for mennesker.
- **Vær re-hentes og logges ved hver visning** (09:18, 20:42, 23:25 — identisk verdi). Dette er live-oppslaget snapshot-vedtaket (2026-08-16) fjerner: med snapshot forankret i befaringstidspunktet forsvinner disse radene helt. Kun en reell endring (brukeren endrer befaringstidspunkt → nytt snapshot) logges, og da som lesbar tekst: «Vær oppdatert: 15,9 °C delvis skyet → 14,9 °C lett yr (befaringstidspunkt endret)».
- **No-op-rader**: «5 rader (14 bilder) → 5 rader (14 bilder)» er ingen endring. Regel: er gammel og ny verdi like, logges ikke raden. Endringsloggen skal svare på «hva ble endret» — identitet er ikke et svar.

Værdata som side 1-informasjon (VÆR-blokken) er riktig og beholdes — det er loggen som ryddes.

## 6. Tidsstempel uten klokkeslett

«Vær ved befaring»-stempelet og Opprettet/Sist endret viser kun dato. Klokkeslett skal med (dd.mm.åååå hh:mm) — bekreftet: ligger allerede i snapshot-vedtaket, gjentas her som krav til samme leveranse.

## Rekkefølge

Punkt 2–6 er dokgen/arkivmal-endringer og går i samme ordre som repeater-vedtaket. Punkt 1 krever app-siden først (bildeNr ved opptak) — dokgen-fallbacken (dokumentrekkefølge) gjør at utskriften kan rettes nå og bli riktigere når appen leverer nummeret.
