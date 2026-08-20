---
name: til-fabel-amarkussen-2026-08-20
description: Rapport til fabel — kundemøte A.Markussen 20.08.2026 + tekniske funn samme dag. Merket NY / ALLEREDE SPORET så ingenting dupliseres.
sist_endret: 2026-08-20
---

# Til fabel · A.Markussen-møtet + funn 20.08.2026

**Fra:** cowork · **Møtedeltakere:** Kenneth + A.Markussen · **Varighet:** ~60 min

**Pilot-kontekst:** ~50 ansatte, mobil er viktigste flate, oppstart september.

Denne rapporten har to deler: **hva kunden sa** og **hva vi målte i koden samme dag**. Alt
er merket **NY** eller **ALLEREDE SPORET** med kilde, så ingenting føres to steder.

Kundens hovedinntrykk, ordrett fra Kenneths notater: *«A.Markussen sitter med et inntrykk
at det er mange klikk.»* Det er den ene setningen jeg vil be deg veie tyngst — den er ikke
en bug, den er en dom over interaksjonsdesignet, avgitt av en pilotkunde fire uker før
oppstart.

---

## Del 1 · Kundens funn — krever produktbeslutning

### 1.1 Firma-malarkiv og SiteDoc-malbibliotek — NY, største enkeltsak

> *«Det må bygges et firma-malarkiv. Fra dette henter nytt prosjekt HMS-, sjekkliste- og
> oppgavemaler. SiteDoc må bygge et sjekklistemal-arkiv som firma kan låne fra.»*

To nivåer kunden ber om:

1. **Firmaets eget malarkiv** — maler defineres én gang for firmaet, nye prosjekter arver.
2. **SiteDocs bibliotek** — et felles utvalg firmaet kan kopiere fra.

Dette er ikke helt ubeskrevet: `migrering-reporttemplate.md` beskriver
`ReportTemplate → OrganizationTemplate` (Fase 2, **ikke implementert**), og
`kontrollplan.md` har sjekklistebibliotek med NS 3420-maler. **Men ingen av dem er
formulert som den flaten kunden beskriver.** Kunden ber om noe konkret: når han oppretter
prosjekt nummer to, vil han ikke bygge malene på nytt.

**Til deg:** dette bør designes som én sammenhengende flate før noe kodes. Spørsmålene jeg
ser: er firma-arkivet en kopi-kilde eller en levende referanse (endres malen i arkivet,
endres den i prosjektene)? Kan et prosjekt avvike fra firmamalen? Hvordan skiller UI-et
mellom «SiteDocs bibliotek», «firmaets arkiv» og «dette prosjektets maler»?

### 1.2 Attestering trenger sammenligningsvyer — NY

> *«Ved attestering må vi vise/sammenligne timer per prosjekt, alle ansatte, per dag og per
> uke. Og timer per ansatt, per dag og per uke.»*

To akser kunden vil krysse: **prosjekt × tid** og **ansatt × tid**. Dagens
attesteringsflate viser én dagsseddel om gangen.

Det er en ny vy, ikke en justering. En leder som skal attestere femti ansatte kan ikke
åpne femti sedler.

**Til deg:** dette henger sammen med «for mange klikk». Om attestering blir en tabell man
skanner i stedet for en kø man klikker seg gjennom, løses to problemer samtidig.

### 1.3 Overtidsvarsel ved underdekning — NY, forretningsregel

> *«Standard arbeidstid er 40 timer. Det kan ikke føres overtid dersom det er færre timer.
> Er det ført 40 timer en uke, herav 1 time 50 %, må den som attesterer varsles.»*

Regelen: overtid forutsetter at normaltiden er dekket. Er uken på 40 timer *inkludert* en
overtidstime, er normaltiden 39 — og da er overtidstimen mistenkelig.

**Til deg:** dette er en varslingsregel, ikke en blokkering — kunden sier «varsles». Det
er i tråd med hvordan vi ellers har løst attestering. Men terskelen (40 t) er
firmaspesifikk og må være en innstilling, ikke en konstant.

### 1.4 Konflikt mellom play-knapp og dagskort — NY

> *«Ved dobbeltføring av timer, play + dagskort, ble det konflikt. Hvordan løser vi
> konflikten?»*

To inngangsveier til samme dag: den løpende «play»-registreringen og manuell føring i
dagskortet. Fører brukeren begge, kolliderer de.

**Til deg:** dette er et interaksjonsspørsmål før det er et teknisk. Skal play-knappen
låses når dagskortet har rader? Skal de slås sammen? Skal brukeren velge? Kunden spør
åpent — han har ikke bestemt seg.

### 1.5 «For mange klikk» — ALLEREDE SPORET, men fortjener ny vurdering

Kunden nevnte det både om dagskort-åpning og som helhetsinntrykk.

Sporet som `BACKLOG.md:805` **«P4a+ mobil ekte ett-klikk opprett uten modal»** — der har du
selv notert kandidat #2 (full-screen expo-router-rute som fjerner kollisjonsklassen
permanent) og #3.

**Til deg:** kunden bekrefter nå premisset fra utsiden. Verdt å vurdere om kandidat #2 bør
løftes i prioritet før pilot, siden mobil er hans viktigste flate.

### 1.6 Kontrollplan — to funn, NY

> *«Ved klikk i kart på sjekkliste i kontrollplan åpnes ikke sjekklisten som ble trykket.
> Ingen hover som forteller hvilken sjekkliste det er og hvilket kontrollpunkt.»*

> *«Ved åpning av sjekkliste fra kontrollplan → åpne lokasjoner → flytter punkt i tegning
> → da forsvant kontrollplanpunktet fra tegningen. Det ble ikke gjenopprettet på ny
> lokasjon.»*

Det andre er datatap i praksis: punktet forsvinner fra planen uten at brukeren gjør noe
galt.

**Til deg:** det første er et identifikasjonsproblem (hva peker jeg på?), det andre er en
koblingsfeil mellom kontrollplanpunkt og tegningsposisjon. Begge treffer kontrollplan-
flaten du eier.

### 1.7 Excel-eksport må fungere — NY som krav, teknisk kjent

Kunden var tydelig: eksport til Excel må virke.

`BACKLOG.md:50` har **`xlsx` → `exceljs`**-byttet av sikkerhetsgrunner (pollution-CVE uten
fiks i npm-versjonen). Det er en forutsetning, ikke selve leveransen.

**Ingen designbeslutning her** — men verdt å vite at biblioteksbyttet må gjøres uansett.

---

## Del 2 · Tekniske funn samme dag

Full kartlegging: [`docs/claude/paritet-web-server-mobil-2026-08-20.md`](../claude/paritet-web-server-mobil-2026-08-20.md)

**24 paritetsavvik** mellom web, server og mobil (7 høy / 12 middels / 5 lav), pluss
**8 åpne driftsfeil** observert i prod.

**Den gode nyheten:** flytmodellens kjerne er reelt delt. Begge klienter bruker
`byggPosisjonsLedd`, `hentPosisjonFiltrertHandlinger` og statusmaskinen fra
`packages/shared`. Ingen har egen ballberegning igjen. **Avvikene ligger i lagene rundt
kjernen** — det er vedlikeholdsetterslep, ikke arkitekturfeil.

### 2.1 Det som treffer ditt bord

**H1 · HMS-behandling er umulig fra mobil.** Web har Besvar/Lukk/Returner/Gjenåpne; mobil
har kun melder-siden. Serveren har alle fem. En HMS-behandler kan ikke behandle et avvik
fra telefonen — på en pilot der mobil er viktigst.

**H7 · «Returner» på web-sjekkliste er en knapp uten endepunkt.** HMS-admin trykker,
skriver, sender — ingenting skjer, ingen feilmelding. `sjekkliste.hmsReturner` finnes ikke
på serveren (oppgave-varianten gjør).

**M2 · Påkrevde felt blokkerer kun på mobil, uten server-backstop.** En tom sjekkliste kan
sendes fra web. Regelen ser ut til å gjelde, men kan omgås ved å bytte flate.

**D8 · Kunden har mistet oversikten over hvor premisser settes.** Kenneths ord:
*«jeg har mistet oversikt på hvor jeg setter premiss for funksjon.»* Én funksjon — hvem får
dette dokumentet — settes fire steder som ikke ser hverandre: faggruppen på prosjektets
dokumentflytside, flyten på faggruppen, leddene på flyten, tilgangsgruppene under
prosjektmedlemmer. Resultatet i prod er to faggrupper med nesten samme navn
(`A.Markussen` og `A-Markussen`), hver med sin flyt og sine maler.
**Dette er en designsak, ikke en opprydding.** Oppsettsflaten bør vise helheten ett sted.

### 2.2 Rotårsak som forklarer mye av dagen

**`steg` settes aldri av UI, så flyter blir flate.**
Full analyse: [`dokumentflyt.md § ROTÅRSAK`](../claude/dokumentflyt.md)

`addDokumentflytMedlemSchema` har `steg: …default(1)`, og serveren utleder aldri neste
ledige posisjon. Sender UI-et ingenting, får hvert nye ledd steg 1. Da finner `nesteLedd()`
ingen posisjon foran, og handlingen blir «Godkjenn og fullfør» i stedet for «Send» —
dokumentet kan aldri forlate første ledd.

Målt i prod: én flyt med registrator og godkjenner begge på steg 1, én med tre ledd på
steg 1. Rettet midlertidig i data for demoens skyld; **neste ledd noen legger til blir flatt
igjen.**

**Kenneths regel til dette (NY):** legges en person til et ledd der han allerede er dekket
av en gruppe, skal det **varsles, ikke blokkeres** — direkte binding kan være tilsiktet,
men skal være et bevisst valg.

### 2.3 Rent teknisk — nevnt for helhet, krever ikke design

Splitt av timerad dobler timetallet i mobilappen mens server og web viser riktig · mobilens
SQLite synker ikke slettinger fra server, så slettede sedler lever videre som spøkelser på
telefonen · «Mine timer» fordeler timer på sedelens aktivitet i stedet for radens ·
annotering lager duplikatvisning og en ukomprimert PNG på 1,98 MB mot originalens 290 KB ·
en sjekkliste i «Mottatt» kan ikke slettes av noen, fordi statusen «Avbrutt» som
feilmeldingen viser til ikke finnes i UI · mobil krasjer når en vanlig ansatt sender et
dokument videre · mobil låser seg ved opprettelse i prosjekt med flere flyter.

**Dagsnorm/sommertid web-vs-mobil** er ALLEREDE SPORET (`BACKLOG.md:2504`).

---

## Del 3 · Det jeg ber om fra deg

**Prioritert designavklaring, i denne rekkefølgen:**

1. **Malarkiv-flaten** (1.1) — største nye sak, og kunden trenger den før prosjekt to.
2. **Attesterings-sammenligningsvyer** (1.2) — løser også deler av «for mange klikk».
3. **Dokumentflyt-oppsettet som én flate** (D8) — kunden har mistet oversikten på et
   oppsett han selv har bygget.
4. **Play-vs-dagskort-konflikten** (1.4) — kunden spør åpent, ingen retning valgt.

**Vurdering jeg ber deg ta stilling til:** bør `P4a+` kandidat #2 løftes før pilot? Kunden
bekrefter premisset fra utsiden, og mobil er hans viktigste flate.

**Til slutt, en observasjon om prosessen:** flere av dagens funn er fikser som landet på én
flate og aldri ble portert til den andre — med forklarende kommentar i koden om hva som ble
rettet. Ingenting fanget at søsterflaten sto igjen. Det er verdt å tenke på når vi lager
ordrer: en fiks i delt atferd bør navngi begge flatene, eller eksplisitt si hvorfor bare
den ene røres.
