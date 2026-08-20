---
tittel: Dokumentgenerering — samlet plan
status: 🟢 STYRENDE for arkivmal/utskrift-sporet
opprettet: 2026-08-16
sist_verifisert_mot_kode: 2026-08-16
---

# Dokumentgenerering — samlet plan

Denne fila finnes fordi arbeidet med utskrift har vokst fra «fiks print» til et
helt spor med fjorten BACKLOG-oppføringer på tvers av fem datoer. Oppføringene er
detaljerte og riktige; det som manglet var **rekkefølgen** og hvilke som faller
bort underveis.

Enkeltsakene beholdes i [BACKLOG.md](BACKLOG.md) — denne fila peker på dem og
sier når de bygges. Detaljer dupliseres ikke.

## Målbildet

Én PDF-motor (server-side Playwright) som dekker **alle dokumenttyper**
(sjekkliste, befaring, RUH/HMS) i **tre utskriftsformer** (fullt dokument,
dokumentliste, tabellrapport). Klient-utskriften finnes ikke.

Kenneths vedtak 2026-08-15: *«vi slutter å lappe → arkivmalen er fremtiden → ta
også ut den gamle døde koden når playwright pdf fungerer.»*

## Hvor vi står (2026-08-16)

**I prod og verifisert på BEF-001** (73 bilder, 7,46 s): ramme, felt, logg,
signatur, komprimering, persons-resolver, repeater-vedlegg, N1/N2-kontrakt,
klient-knapp, bilder under egen rad, løpenummer, seks-funn-runden.

**Det eneste Kenneth fant som ikke gir mening etter siste deploy:**
endringsloggen.

## Faser

### F1 — Endringsloggen blir lesbar 🔴 NESTE

Ordre klar: `relay/inbox-endringslogg.md`. BACKLOG: seks-funn § funn 5, punkt 7
(vedlegg-radformat), punkt 8 (værsnapshot).

Fire deler, i denne rekkefølgen:

1. **Nøkkelsortering før sammenligning.** Vær-radene i BEF-001 har identiske
   verdier med ulik nøkkelrekkefølge — `sjekkliste.ts:666` sammenligner
   JSON-strenger, så lik verdi ser ulik ut. Sorter nøklene, så fanger den
   eksisterende no-op-filtreringen (`:669`) dem. **Seks av ti rader i BEF-001
   forsvinner av denne alene.** Liten, isolert, størst effekt.
2. **Lesbar verdi-transform.** «5 rader (14 bilder) → 5 rader (14 bilder)» har
   ulik rå-JSON — noe endret seg, men leseren ser ikke hva.
3. **Vedlegg-radformat** (punkt 7) — samme logg-leser som (2).
**Hvorfor samlet:** delene deler kodesti (changelog-leser + render). Bygges de
hver for seg, gir det halvformattering. Kenneth 2026-08-16: *«samle det → færre
deploys → større sesjoner.»*

**Rad-format vedtatt 2026-08-16:** en repeater-endring som ekspanderer til flere
celle-differ gir **egne rader** («Rad 3 — Kommentar: X → Y»), ikke én
flerlinje-oppsummering. Kenneths innvending var at dagens form ikke sier *hva*
som endret seg; en oppsummering svarer halvveis.

### F1b — Værsnapshot 🟡 EGEN RUNDE (måling 2026-08-16)

BACKLOG punkt 8. **Skilt ut fra F1** etter måling: ulik flate (felt-verdi +
malbygger-UI + `useAutoVaer` på tvers av mobil/web/api, mot F1s changelog-leser).
Å bunte dem ville latt malbygger-UI forsinke changelog-fiksen BEF-001 trenger.

Målingen snudde antakelsen om omfang — **det meste finnes allerede:**

- Værverdien **lagres allerede** som snapshot i `Checklist.data` av `useAutoVaer`;
  den er ikke live ved visning. PDF leser lagret verdi (`sjekkliste.ts:58-77`).
- Koblingen vær ↔ dato-felt ↔ prosjektkoordinat finnes **implisitt**, med
  re-henting ved datoendring.
- Det som mangler: time-presisjon (hooken bruker fast kl. 12:00), tidspunkt lagret
  på verdien, og PDF-format «Vær ved befaring …» med «Ikke registrert»-fallback.

#### 🟢 KENNETH-VEDTAK 2026-08-16 — når vær hentes (styrende)

> *«Jeg planlegger en kontrollplan uker og måneder før kontroll av objekt.
> Værdata skal aldri inneholde værdata fra planlegging. Når jeg drar ut i felt og
> fyller ut sjekklisten og trykker nå for tidspunkt — her er tidsstempel for
> værdata. Været endrer seg ikke vesentlig på 3 timer i løpet av en befaring.»*

**Regelen:**

1. **Vær hentes én gang** — i det øyeblikket befaringstidspunktet settes.
2. **Et rettet tidspunkt oppdaterer værfeltet** til ny verdi (feil dato, tastefeil
   → nytt vær for det nye tidspunktet). Ellers ville rapporten dokumentere vær fra
   et tidspunkt befaringen ikke fant sted.
3. **Endring i bilde eller tekst henter aldri nytt vær.**
4. **Værfeltet står tomt til tidspunktet settes.** En sjekkliste opprettet fra
   kontrollplanen uker i forveien har ikke vær.

**To konsekvenser for koden:**

- ⚠️ **Punkt 4 er ikke dagens oppførsel.** `useAutoVaer` henter knyttet til
  dato-feltet, så en sjekkliste opprettet ved planlegging får planleggingsdagens
  vær. Dette er en reell feil, ikke bare en manglende presisjon.
- Punkt 3 er årsaken til de seks identiske vær-radene i BEF-001s endringslogg.
  F1s nøkkelsortering skjuler symptomet; denne regelen fjerner årsaken. **Begge
  skal bygges** — sorteringen beskytter mot enhver fremtidig verdi-ekvivalens, ikke
  bare vær.

**Beslutning som avgjør størrelsen:** godtar vi dagens implisitte «første
`date_time`-felt»-konvensjon, kollapser malbygger-jobben til nesten null og vær
blir ren snapshot-plumbing. Krever vi eksplisitt utpeking, må det bygges ny
mekanikk — `weatherTimeFieldId` i config, felt-velger i `FeltKonfigurasjon`, og
valideringsregel. Ingen «felt refererer et annet felts verdi»-mekanikk finnes i
dag (`conditions`/`parentId` er synlighet, `calculation` er død config).

### F2 — Klient-utskriften fjernes 🔴 BLOKKERT AV F1

Når endringsloggen er lesbar, er arkiv-PDF-en bedre enn klient-utskriften på alle
punkter Kenneth har målt. Da fjernes `apps/web/src/app/utskrift/**` og
knappe-duplikatet på sjekklistedetalj.

**F2 lukker fire BACKLOG-saker uten å bygge noe:**

- Attachments-bilder rendres dobbelt, én gang brutt (2026-08-15)
- Mobil-utskrift skjuler tomme tabeller og vedleggsfelt (2026-08-13)
- Web-utskrift skjuler uutfylte felter (2026-08-12)
- Store bilder mangler — `window.print()` venter ikke på lasting (2026-08-12)

Alle fire gjelder kun klient-veien. Det er den største enkeltgevinsten i planen,
og den koster ingen ny kode.

> **🟢 GJENNOMFØRT 2026-08-20 (`feat/f2-fjern-klient-utskrift`, dokgen) — med to korreksjoner.** Slettet `apps/web/src/app/utskrift/**` (både sjekkliste- og oppgave-ruten) + foreldreløs `apps/web/src/lib/utskrift-print.ts`, fjernet «Skriv ut»-duplikatknappen på sjekkliste- og oppgavedetalj. **Av de fire sakene lukket F2 reelt bare ÉN** (attachments dobbelt — venue slettet). De øvrige tre stemte ikke med koden:
> - **To oppdagede oppfølgere (planen overså `sjekklister/skriv-ut/page.tsx`):** «web-skjuler-uutfylte» (sak 3) og «window.print venter ikke» (sak 4) bor i **delt** `RapportObjektVisning`/`window.print()`, som bulk-utskrifts-ruten `sjekklister/skriv-ut` fortsatt bruker. F2 (kun `utskrift/**`) lukker dem derfor ikke. **Egen ordre trengs:** fjern/flytt `skriv-ut` til arkiv-PDF (`arkiv.rendr` tar array — bulk er mulig, men er ny kode).
> - **Mobil-saken (sak 2)** er Fase 3 (`felt.ts`/expo-print) — ikke rørt, meldt fra per gate.
> - **⚠️ Regresjon innført bevisst:** oppgavedetalj hadde **kun** klient-utskrift (ingen arkiv-PDF; `arkiv/sammenstilling.ts` rendrer bare sjekkliste). Å slette hele `utskrift/**` fjernet oppgave-utskrift **uten erstatning** til oppgave får arkiv-PDF (etter F3). Flagget to ganger før utførelse; ordren ble bekreftet bokstavelig.

⚠️ Før sletting: `packages/pdf/src/felt.ts` er **frossen** (mobil-signatur) og
skal ikke røres. Verifiser hva mobil faktisk bruker før noe fjernes.

#### 🔴 F2 gjelder KUN web — mobil beholder sin egen PDF-vei (målt 2026-08-17)

Mobil har **ikke** arkiv-PDF: ingen `arkiv.rendr`-kall finnes i `apps/mobile/src`.
I stedet genererer `apps/mobile/app/sjekkliste/[id].tsx` PDF-en **på enheten** med
`expo-print` + `expo-sharing`, fra HTML bygget via `@sitedoc/pdf` (commit
`05d11c22`). Linje 513 inliner vedleggsbilder som base64 fordi `expo-print` ikke
har auth-cookies.

#### 🟢 KENNETH 2026-08-17: offline-argumentet holder ikke — mobil skal bruke `arkiv.rendr`

> *«Dette gir ikke mening — jeg kan ikke dele en PDF uten internett fra telefonen.»*

Cowork argumenterte først for at mobil måtte beholde lokal generering fordi appen
skal virke offline. **Det argumentet er feil:** uten nett kan PDF-en ikke sendes
noe sted, så lokal generering løser genereringen, ikke oppgaven. Det eneste
gjenværende offline-scenariet — generér nå, lagre til Filer, del senere — er
dårligere enn å vente og generere med riktig form når dekningen er tilbake.

**Retning: mobil kaller `arkiv.rendr` som web.** Én PDF-motor, ett
vedlikeholdspunkt, ingen divergens mellom flatene. Det fjerner risikoen for at
arkivmal-endringer må speiles manuelt i mobil-PDF — samme klasse som Kenneths funn
om at én mal gir fire representasjoner (malbygger / web-skjema / mobil / PDF).

**Da kan `apps/mobile/app/sjekkliste/[id].tsx` sin `expo-print`-vei fjernes.**

⚠️ **Men `felt.ts` forblir frossen — målt 2026-08-17/18.** Frysingen kan *ikke* løftes
når mobil slutter å bruke den, fordi `renderFelt` fortsatt er live-avhengighet for
`arkivmal/innhold.ts` (server-arkiv, web + snart mobil). Det som dør i fase 3 er
**`byggSjekklisteHtml`/`renderAlleFelter`-grenen i `sjekkliste.ts`** — ikke `felt.ts`
selv. Cowork skrev dette upresist i første utkast.

Ingen app importerer `renderFelt`/`renderAlleFelter` direkte — begge har kun interne
`packages/pdf`-konsumenter, via to kjeder: `sjekkliste.ts → byggSjekklisteHtml`
(kun mobil) og `arkivmal/innhold.ts` (server-arkiv).

Øvrige målinger: mobil har **nøyaktig én** PDF-vei (`app/sjekkliste/[id].tsx`, ingen
andre-vei i oppgave/HMS/timer) · `arkiv.rendr` autentiserer likt for Bearer og cookie
(`context.ts:76-79`), så mobil-tRPC trenger ingen ny auth-jobb · payload er identisk
(`{ dokumenter: [{ id, type: "sjekkliste" }] }`).

**UI-krav:** uten nett skal knappen si at PDF krever tilkobling, ikke feile stille.
Samme prinsipp som «Vær hentes når du er tilkoblet».

**Fjerningsplan i tre faser — ikke bytt motor i ett steg.** Mobil har PDF som
virker; en byttet motor som feiler på enhet etterlater feltarbeideren uten
utskrift, og hver verifiseringsrunde koster et EAS-bygg.

1. **Legg til.** `arkiv.rendr`-veien bygges ved siden av `expo-print`, som primær.
   Den gamle koden røres ikke.
2. **Verifiser på enhet.** Ekte dokument med bilder, mangel-kontrakten, deling,
   og oppførsel uten nett. **Sammenlign mot web-generert PDF av samme dokument** —
   de skal være identiske; det er hele poenget med byttet.
3. **Fjern.** Først da: `expo-print`-import, HTML-byggingen, base64-inliningen av
   vedlegg (`[id].tsx` ~513), og pakken fra `package.json`. Egen gate — ikke slett
   i samme commit som du legger til.

Ordre: `relay/inbox-mobil-arkivpdf.md`.

### F3 — Flere dokumenttyper 🟡

BACKLOG punkt 3 (befaring) + punkt 6 (RUH/HMS). `render.ts:94` kaster for alt
annet enn «sjekkliste».

Befaring krever også en **slank variant** uten prosjekt-/statusblokk. RUH krever
**tegningsutsnitt-med-markør**, som er en egen feature (crop rundt en plassering)
og trolig den tyngste enkeltbiten i hele planen.

Uavhengig av F1/F2 — kan kjøre parallelt hvis en agent er ledig.

### F4 — Utskriftsformer 🟡

BACKLOG punkt 4 (dokumentliste, med «HOS …»-pille) + punkt 5 (tabellrapport med
thumbnail-kolonne). Henger sammen med den eldre kravspecen «Utskriftsformer —
samlet kravspec» (2026-08-13) — **den skal reconciles mot fabels mockup p4/p5 før
bygging**, ikke bygges parallelt med den.

Merk at thumbnail-i-celle er bevisst her (oversiktsliste), i motsetning til
repeater-formen der det ble avvist.

### F5 — Statusblokk: «Utført dato» 🔴❓ KREVER BESLUTNING

BACKLOG punkt 2 + funn 6-rest. **Kan ikke bygges uten en beslutning fra Kenneth:**
mockupen sier «Utført dato», koden viser `createdAt` under etiketten «Opprettet».
Å bytte etiketten uten å bytte datakilde gjør at dokumentet lyver.

To veier: eget utført-dato-felt i datamodellen, eller avledning fra
hendelsesloggen (første signering/ferdigstilling). Klokkeslett på cellene
(funn 6-rest, ~2 linjer) avklares sammen med dette — ikke før.

### F6 — `bildeNr` i appen 🟡 UAVHENGIG

Seks-funn § funn 1, app-siden. PDF-fallbacken er levert; appen tildeler ikke
nummer ved opptak. Krever mobil + web + modell.

Verdien er at brukeren kan skrive «se bilde 07» i teksten mens han er på
befaring — et nummer som oppstår ved rendering finnes ikke når teksten skrives.
Rører ikke PDF-laget og kan tas av en mobil-agent når som helst.

## Avhengighetskart

```
F1 (endringslogg) ──► F2 (fjern klient-utskrift) ──► lukker 4 BACKLOG-saker
F1b (værsnapshot) ──── uavhengig, egen runde
F3 (dokumenttyper) ─── uavhengig
F4 (utskriftsformer) ── reconciles mot kravspec 2026-08-13 først
F5 (statusblokk) ────── venter på Kenneth-beslutning om datakilde
F6 (bildeNr i app) ──── uavhengig, mobil-spor
```

## Åpne spørsmål til Kenneth

1. **F1b-koblingen:** implisitt «første `date_time`-felt» (nesten gratis) eller
   eksplisitt utpeking i malbyggeren (ny mekanikk)? Avgjør om vær blir en liten
   eller middels runde.
2. **F5-datakilden:** eget utført-dato-felt, eller avledning fra hendelsesloggen?
3. **F3/F4-prioritet:** er befaring som egen dokumenttype (slank variant) viktigere
   enn de to nye utskriftsformene? Begge er «nice to have» inntil en kunde ber om
   dem.

Ingen av dem blokkerer F1 eller F2.
