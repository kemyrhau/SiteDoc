# KP — TO BESLUTNINGER: flytmodell for kontrollpunkt (L1-revisjon) + L2-gate

Dato: 2026-08-14 · Fra: fabel · Til: cowork + Opus kontrollplan (via Kenneth)

## 1. Modellbeslutning: kontrollpunktet eier dokumentflyten ✅ (Kenneths modell vedtas)

Registrator-kravet var feil premiss — mitt scenario e) gatet riktig feilmelding mot feil modell. Kontrollplanen er et styringsdokument: hvilken flyt en kontroll går i, bestemmes ved planoppsett av den som har mandat, ikke av hvem som trykker Start.

**Vedtatt design:**
- Nytt felt `KontrollplanPunkt.dokumentflytId` (nullable). Settes ved planoppsett/redigering; valgbare flyter = flyter i prosjektet som inneholder punktets mal. Nøyaktig én kandidat → auto-sett (MalVelger-mønsteret gjenbrukt der det hører hjemme: hos planeieren, ikke hos utføreren).
- **Start bruker punktets flyt uansett hvem som trykker.** Flytvelgeren ved Start (scenario d) UTGÅR — den var symptomet på feil modell.
- **Autorisasjonsgrense: (b) punktets faggruppe** — medlem av `punkt.faggruppeId` kan starte. Begrunnelse: punktet sier allerede hvem som utfører; (a) er for vid (hele prosjektet), (c) er ny konfigurasjonsflate uten behov nå. Prosjektadmin kan alltid starte (eksisterende bypass-mønster).
- `dokumentflytId` null → Start deaktivert med forklarende melding: «Punktet mangler dokumentflyt — settes i planoppsettet av [rolle med mandat]». Aldri stille utilgjengelighet.
- **Backfill-migrering:** punkter der malen ligger i nøyaktig én flyt får den satt; øvrige forblir null (planeier fullfører i UI). To-stegs, ingen DROP.
- Feilmeldingen fra e) omformuleres til den nye modellen (den gamle instruerer feil handling: «be om registrator»).

**Rekkefølge:** dette er L1-revisjon og går FØR L2-prod hvis mulig — L2s fargemodell bygger på en Start-vei Kenneth ikke kan bruke i eget prosjekt. Kan de gå i samme prod-deploy, er det coworks kall.

**Gate-krav (kort runde):** skjermbilder — (i) planoppsett: flyt settes på punkt, (ii) Start som faggruppemedlem som IKKE er registrator → sjekkliste opprettet i punktets flyt, 1 klikk, (iii) punkt uten flyt → ny forklarende melding, (iv) bruker utenfor faggruppen → avvist med forklaring. Ekte/konstruert deklareres som før.

## 2. L2-designgate: GRØNT på a/b/d — c) krever ett nytt bevis

- **a) GRØNT.** Tilstandene lesbare: fylt grønn (godkjent), fylt blå (påbegynt), hvit m/rødt omriss (forfalt, ikke påbegynt) — form/farge-aksene separert, fungerer i s/h.
- **b) GRØNT.** Lagfilter virker: kontrollpunkter av → kun oppgave-markøren står.
- **d) GRØNT.** KB4 plassert, teller 3→4.
- **c) IKKE GODKJENT ennå:** L2-c er visuelt identisk med L2-a — uthevingen er ikke synlig i bildet. DOM-verifisering er notert, men en utheving er et VISUELT krav; ta nytt skjermbilde i det uthevingen står på (eller forsterk den hvis den er for svak til å synes — da er det designfunnet). Kun dette gjenstår for full L2-godkjenning.
- **Merknad, ikke blokker:** forfalt kontrollpunkt (rød pin-omriss) og oppgave-markør (rød pin) er like i formspråk — vurder i c-runden om de skilles godt nok når begge lag er på.
- «Frie sjekklister på tegning» som egen sak: akseptert — Opus' kartlegging (felter uten funksjon) var riktig håndtering. Bonus-funnet (52-ukers `erForfalt` erstattet med delt `ukerTilFrist` + U53-test) er nøyaktig hva én-delt-hjelper-kravet skulle forhindre — sitér det i presedensen.
- `punkt.status` pensjonert fra UI med 0 prod-treff: min L1-observasjon lukket riktig.

## Oppsummert
- L1-revisjon (flytmodell): ordre over, prioriteres før/med L2-prod.
- L2: gate åpnes helt når c)-beviset lander. Ett bilde, én runde.
