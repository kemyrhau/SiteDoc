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

### F1 — Endringsloggen blir lesbar ✅ LEVERT (merget develop 2026-08-20)

> `fix/endringslogg-lesbar` er i develop (0 foran, verifisert med `merge-base --is-ancestor`).
> **Restpost:** `fix/endringslogg-web` (`ce994756`, 16.08) er ferdig, testet 133/133 og
> **fortsatt umerget** — ord-nivå diff som uthever det faktisk endrede ordet, pluss
> skjerpet «_»-label-fallback. F1 er ikke helt i mål før den er inne.

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

> ⚠️ **Datamåling 2026-08-28 — «dropp tomme felter» kan ALDRI stole på nøkkel-eksistens.**
> Å bare ÅPNE et dokument auto-lagrer en tom felt-oppføring `{ verdi:null, kommentar:"",
> vedlegg:[] }` for HVERT ikke-display-felt (klienten sender hele feltverdi-mappen ved
> auto-lagring: `useSjekklisteSkjema`/`useOppgaveSkjema`). `Checklist.data`/`Task.data` har
> derfor nøkler for felt ingen har fylt ut. Enhver «skjul/dropp uutfylt»-logikk må teste
> **verdien** (`data[objId]?.verdi` tom = `null`/`""`/`[]`/`{}`, evt. tom kommentar+vedlegg),
> aldri `data ? key` / `?|` (nøkkel finnes). `packages/pdf/src/felt.ts:32` gjør allerede
> dette riktig (`tom = verdi === null || undefined || ""`). Samme fella traff malobjekt-
> slettevakten (`mal.ts`, rettet 2026-08-28 med `harFaktiskInnholdForObjekt`).

**Beslutning som avgjør størrelsen:** godtar vi dagens implisitte «første
`date_time`-felt»-konvensjon, kollapser malbygger-jobben til nesten null og vær
blir ren snapshot-plumbing. Krever vi eksplisitt utpeking, må det bygges ny
mekanikk — `weatherTimeFieldId` i config, felt-velger i `FeltKonfigurasjon`, og
valideringsregel. Ingen «felt refererer et annet felts verdi»-mekanikk finnes i
dag (`conditions`/`parentId` er synlighet, `calculation` er død config).

### F2 — Klient-utskriften fjernes 🟢 ÅPEN (F1 merget 2026-08-20)

Når endringsloggen er lesbar, er arkiv-PDF-en bedre enn klient-utskriften på alle
punkter Kenneth har målt. Da fjernes `apps/web/src/app/utskrift/**` og
knappe-duplikatet på sjekklistedetalj.

> 🔴 **KORRIGERT 2026-08-20 ved levering (`d92ece42`): F2 lukket ÉN sak, ikke fire.**
> Anslaget under var en overvurdering, avdekket da dokgen målte hver sak mot koden i
> stedet for å stole på planen.
>
> - ✅ **Lukket:** «attachments-bilder rendres dobbelt» — krevde `utskrift/**`, nå borte.
> - ⚠️ **Ikke lukket (mobil):** bor i `packages/pdf/felt.ts` via `expo-print` → hører til
>   Fase 3, ikke F2.
> - ⚠️ **To delvis lukket:** «skjuler uutfylte» + «print uten bilde-venting» bor i en
>   **andre web-utskriftsflate planen overså** —
>   `apps/web/src/app/dashbord/[prosjektId]/sjekklister/skriv-ut/page.tsx:111`
>   (bulk-utskrift, `window.print()` uten bilde-venting, deler `RapportObjektVisning`).
>   Den lukker begge når den flyttes til arkiv-PDF, men det krever **ny kode** og faller
>   derfor utenfor F2s «ingen ny kode»-premiss. **Egen oppfølger — se F2b under.**
>
> **Lærdom:** «lukker N saker uten ny kode» skal måles mot koden før det skrives i en
> plan, ikke anslås. Anslaget sto i både planen og `CLAUDE.md`-indeksen i fire dager.

### 🔴 F7 — arkiv-PDF taper innhold festet på repeater-OBJEKTET (funnet i prod 2026-08-21)

**Symptom:** BHO-002 (prod) viser kommentar «Testbilde» og ett bilde på web. Arkiv-PDF-en
skriver «Ingen rader registrert» og utelater både kommentar og bilde.

**Målt i prod-data** (`checklists.data`, dokument `642094ba-a009-45f4-83c9-2bb28173291e`):

```
ae7b9ce3… : { verdi: null, vedlegg: [],  kommentar: "…" }
b40966ed… : { verdi: null, vedlegg: [1], kommentar: "…" }
```

**Ingen rad-array finnes.** «Legg til rad» ble aldri trykket — innholdet er festet direkte
på repeater-objektet. `byggRepeaterTabell` (`packages/pdf/src/arkivmal/repeater.ts:136`)
gjør `Array.isArray(verdi) ? … : []`, og skriver derfor korrekt «Ingen rader registrert».

**Bugen er ikke den manglende raden — det er at objektnivå-innhold aldri rendres.**
Kommentar og vedlegg som ligger på selve repeater-objektet faller ut av arkivet uten varsel.
Brukeren ser bildet på skjermen, laster ned PDF-en, og bildet er borte.

**Alvorlighet:** høy for et arkivdokument. Stille datatap i den ene leveransen som skal være
etterprøvbar.

🟡 **Krever fabel-beslutning før fiks:** malbyggeren tillater at et repeater-objekt har egen
kommentar og egne vedlegg uten at det finnes rader. Arkivet må da ha et sted å vise dem —
egen blokk over tabellen, eller som «rad 0». Det er en visningsbeslutning, ikke bare en
kodefiks.

🟡 **Regresjon eller dokumentforskjell — UAVKLART.** `repeater.ts` er uendret siden
2026-08-16, og de tre commitene som traff `packages/pdf` gjelder rolleetikett og
endringslogg. **Test:** last ned BEF-001 fra prod (verifisert mandag 2026-08-17 med 73
bilder). Kommer bildene fortsatt → BHO-002 er et annet datatilfelle og F7 er en eksisterende
mangel. Mangler de → regresjon, og hastegraden øker.

**Prioritet:** F7 kommer **etter** D2/D2b (tegningsutskrift) i DG-sporet. Grunn: `felt.ts:36`
utelater `location` og `drawing_position` eksplisitt fra arkivstien, og klient-utskriften —
eneste vei til tegningsprint — ble fjernet 2026-08-20 (F2, `d92ece42`). Se
[designnotat-arkivmal-pdf-fabel-2026-08-21.md](../redesign/designnotat-arkivmal-pdf-fabel-2026-08-21.md).

### D2/D2b — tegningsutskrift ✅ LEVERT (`feat/arkivmal-d2b`, kontrollplan, 2026-08-21)

Tre commits. Design: [designnotat-arkivmal-pdf-fabel-2026-08-21.md](../redesign/designnotat-arkivmal-pdf-fabel-2026-08-21.md)
§ D2b + D2b-utvidelse (fabel-ratifisert), tillegg i `tillegg-designnotat-arkivmal-d2b-fabel-2026-08-21.md`.

| Commit | Innhold |
|---|---|
| `7be8daaf` | Ren ekstraksjon `byggDetaljUtsnitt({url,x,y,hoydePx,zoom})` fra `byggTegningPosisjon` (`tegning.ts:27`). Golden-test krever **byte-identisk** output for den gamle PDF-veien (`sjekkliste.ts:156`). Ingen adferdsendring. |
| `2732a164` | D2b-helside (`arkivmal/tegningsside.ts`) + funn 2b: rekursiv markør-innsamling (`apps/api/.../arkiv/tegningsmarkorer.ts`), sharp-crop 4× i 4:3, kant-klemt, 320px. |
| `6803aa98` | Funn 3 — `drawing_position` rendres lesbart i endringsloggen. |

**Vedtatt presentasjonsregel (ikke inkonsistens):** frittstående `drawing_position` = blokk-form
(D2 steg 2, uendret). Repeater-markører = helside + **detaljutsnitt i tabellraden**. Per-rad
oversikt+detalj er avvist — oversikten ville vært identisk på hver rad.

**Fire fabel-gates, alle løst:** bilde-bevisst paginering (`break-inside:avoid`, `thead` per side),
fast utsnitts-spek, moderat DPI (320px pre-croppet server-side), og Gate 4 — som **falt ved måling**:
`byggTegningPosisjon` tok ikke målstørrelse (`DETALJ_ZOOM` modul-konstant, hardkodet `height:260px`,
tvunget tokolonners grid). Derfor ekstraksjonen i `7be8daaf`.

🔴 **Arkitekturgrensen som ble gatet:** `sharp` ligger **kun i `apps/api`**. `packages/pdf` beholder
null avhengigheter fordi **mobil importerer den** og ikke kan bundle native Node-moduler. Cropping
hører server-side, HTML-bygging i `packages/pdf`. `felt.ts` frosset gjennom hele runden.

**Funn 3s rotårsak var en annen enn antatt.** Målt på BEF-002: markøren traff
«ukjent objekt → null»-fallbacken i `lesbarVerdi` (`arkivmal/endringsdiff.ts`), så *ekte*
posisjonsendringer viste «Ikke utfylt → Ikke utfylt». Det var en **render**-feil, ikke et sviktende
no-op-filter — `normaliserForDiff` er urørt (verifisert: null treff i diffen). Identiske markører
filtreres allerede av rå-sammenligningen. Hadde fiksen blitt låst på antagelsen, ville en ikke-
eksisterende bug blitt «fikset» og render-feilen stått igjen.

⚠️ **Gjenstår:** visuell gate hos fabel etter test-deploy — liggende-rotasjon og drawing-sizing er
implementert, men ikke sett. Render-verifisering tas av kontrollplan mot test-API-et.

### F2b — bulk-utskriftsflaten 🟡 OPPFØLGER (åpnet 2026-08-20)

`sjekklister/skriv-ut/page.tsx` er den gjenstående web-klient-utskriften. Flyttes til
arkiv-PDF på samme måte som F2 flyttet detaljsidene. Lukker «skjuler uutfylte» og
«print uten bilde-venting» helt. Krever ny kode; ikke prioritert foran AM-ordrene.

**Opprinnelig anslag (beholdt for sporbarhet) — F2 skulle lukke fire BACKLOG-saker uten å bygge noe:**

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

⚠️ ~~**Men `felt.ts` forblir frossen — målt 2026-08-17/18.**~~ **VEDTAK 2026-08-23: FRYSEN
OPPHEVES (Kenneth).** Fase 3 er levert (mobil-arkivmal-PDF, branch `feat/mobil-arkivmal-pdf`):
`byggSjekklisteHtml`/`renderAllefelter`-grenen i `sjekkliste.ts` er død (0 importører), og
**mobil KJØRER aldri `felt.ts` lenger** (`grep renderFelt|renderAllefelter apps/mobile` → 0).
Det tidligere argumentet — «`renderFelt` er fortsatt live for `arkivmal/innhold.ts`» — konflaterte
**server-bruk** med **mobil-versjonsavvik**: frysen beskyttet mot at gamle TestFlight-installasjoner
*rendrer* annerledes enn serveren, og det forutsetter at mobil *kjører* koden. Serveren har intet
versjonsavvik (deployer alltid siste `felt.ts`). **Målt fallgruve (2026-08-23):** `felt.ts` LIGGER
fortsatt i mobil-bundlen (Hermes-export: `renderAllefelter`+`bilde-rutenett` i string-tabellen) —
Metro tree-shaker ikke barrel-re-eksporten `index.ts → ./felt`. Men **bundlet ≠ kjørt**: død kode
som endres, endrer ingenting for noen. Bundle-størrelsen er den eneste gjenværende kostnaden (egen
sak: mobil kan dyp-importere `arkivmal/endringsdiff` i stedet for barrel-en).

**Konsekvens: LEVERT 2026-08-24** (branch `feat/pdf-fold-d2d3`, etter grønn simulator på tre runder).
D2/D3-overridene (`byggArkivTegningsposisjon`, `byggInstruksjonsfelt`) er FOLDET inn i `renderFelt`
(`felt.ts`) som hovedvei; intercept-i-`innhold.ts` droppet. **Dødt subtre ryddet** (målt: 0
importører, kompilatoren som fasit): `sjekkliste.ts`/`byggSjekklisteHtml`, `renderAllefelter`,
`tegning-screenshot.ts`, header-generatorene (`byggSjekklisteHeader`/`byggOppgaveHeader`/
`byggMetadataRutenett` — `prosjektReferanseForUtskrift` beholdt), mobil `PdfForhandsvisning`/
`TegningsCapture`. Gater: typecheck 11/11, pdf 80, api arkiv 139, web 189, shared 539.

Ingen app importerer `renderFelt`/`renderAllefelter` direkte — begge har kun interne
`packages/pdf`-konsumenter, via to kjeder: `sjekkliste.ts → byggSjekklisteHtml`
(nå død) og `arkivmal/innhold.ts` (server-arkiv, eneste levende).

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
F1 ✅ merget ──► F2 (fjern klient-utskrift) ÅPEN ──► lukker 4 BACKLOG-saker
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
