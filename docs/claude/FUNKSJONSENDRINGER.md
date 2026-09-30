---
name: FUNKSJONSENDRINGER
description: Register over merger som endret INTENSJONEN — det brukeren skal kunne, ikke bare det koden gjorde. Kenneths kontrollflate. Føres av cowork ved merge, aldri i ettertid.
sist_verifisert_mot_kode: 2026-09-28
sources: cowork
---

# Funksjonsendringer — Kenneths kontrollflate

🔴 **HVA DENNE FILA ER FOR** (Kenneth 2026-09-27):

> «jeg trenger å fange opp det som endrer funksjoner → jeg trenger ikke bruke tid på hull og
> forbedringer uten funksjonsendring»

**Definisjonen, løypa og smutthullet står i
[SAMARBEIDSREGLER § LUKKER HULL vs ENDRER FUNKSJON](SAMARBEIDSREGLER.md).** Kort:

- 🔴 **FUNKSJONSENDRING** = intensjonen byttes. **Krever hjemmel fra Kenneth før ordren sendes.**
- 🟢 **REPARASJON** = koden kommer tilbake til noe som var ment. **Ingen godkjenning** — men føres
  her hvis virkningen er synlig, så Kenneth ikke blir overrasket.
- 🔴 **Intensjon teller bare hvis den er SKREVET NED før endringen.** Finnes ingen: funksjonsendring
  som standard. **«Produktvalget er tatt» i en designordre er ikke en hjemmel.**

---

## 🔴 FUNKSJONSENDRINGER — krevde hjemmel

### 2026-09-30

| Hash | Flate | Før → Etter | Hjemmel |
|---|---|---|---|
| `1cecdb71` | **Firma-attestering** — Sedler-visningen (`SeddelKort`), Per ansatt-pivoten, sedel-detalj (web) og sedel-lista (mobil) | **Før:** attestanten måtte regne selv. Overtid som ikke stemte med ukenormen var usynlig med mindre han åpnet Per ansatt-fanen, der badgen har ligget siden 20.08. **Etter:** varsel på hovedflaten og i detaljen, begge veier — **ført overtid regelen ikke finner dekning for**, OG **ukesum over norm uten at noe er ført som overtid**. Viser norm, sum ordinært og sum overtid. 🔴 **Blokkerer ingenting** — attestanten er kontrollpunktet, ikke systemet | 🟢 `designnotat-attestering-fabel-2026-08-20.md` § D2, **Kenneth-vedtak 2026-08-20.** Badgen på `SeddelKort` er D2s egen ordlyd |

⚠️ **Hvorfor varselet er verdt å ha, i én setning:** web og mobil fører overtid **ulikt** —
mobilen setter overtidslønnsart automatisk, web gjør det ikke (nå-rapport `:141` M4).
**Varselet gjør forskjellen synlig i stedet for å skjule den**, og designnotatet er eksplisitt
om at systemet **aldri** retter `lonnsartId` stille: *«Lønnsartvalget er en menneskelig
handling.»*

🟢 **Til orientering, samme merge (reparasjon med synlig virkning):** `beregnUkeAvvik` lå som
en **privat funksjon i en web-komponent uten én test** — levert 20.08, utestet i seks uker.
Den er nå i `@sitedoc/shared` med **én definisjon og tre konsumenter**, og de seks
D2-tilfellene dekker den **retroaktivt**. Den bygde badgen tok ikke feil; testene er grønne.

| `21064640` | Bildevedlegg i **mobilappen** — kvittering på tillegg/utlegg, vedlegg i dokument, info-bilder | **Før:** feilet et bilde permanent (slettet fil, utløpt tak), viste `<Image>` bare en tom grå firkant der bakgrunnen sto på bildet selv — og på flater uten bakgrunn: ingenting. **Etter:** en synlig sluttilstand med `ImageOff`-ikon og teksten «vedlegget kunne ikke lastes», skalert pr. flate. 🔴 **Et zoom-vindu som før åpnet seg tomt, sier nå hvorfor** | 🟢 Kenneth 2026-09-30: **«send tilbake»** — etter at kontrolløren fant at `return null` kollapset den grå firkanten, og avviket ble lagt fram i klartekst før merge |

⚠️ **Hvorfor dette står som funksjonsendring og ikke reparasjon:** selvfornyelsen (krav 3b) er
reparasjon — den var alltid ment å virke. **Men den terminale tilstanden var et nytt valg:** å
rendre `null` ville gjort et slettet vedlegg usynlig, og det er *stille tomhet*. **Feiltilfeller
teller som funksjon** — hvordan systemet oppfører seg når noe går galt, er noe brukeren opplever.

🟢 **Kontrolløren fant den, ikke gaten.** Rollen ble innført samme dag, og dette var dens første
oppdrag. **De fire andre punktene i gaten var rene** — taket, backoffen, 404-vakten og
debouncen ble bekreftet mot koden.


### 2026-09-29

| Hash | Flate | Før → Etter | Hjemmel |
|---|---|---|---|
| `1b7fc87b` | Bildevedlegg i sjekklister og oppgaver — **web** | **Ingen annotering i web.** Bildet kunne vises og slettes, ikke merkes. Nå: pil, sirkel, firkant, frihånd og tekst — og **Velg/Flytt**, så en pil kan dras i stedet for å tegnes på nytt | 🟢 Kenneth 2026-09-29, valgte «paritetsmåling + annotering i web i samme runde» |
| `1b7fc87b` | Samme | Annoteringen lagres som et **redigerbart lag**, ikke brent inn i bildet. Tre artefakter: **originalen røres aldri** · Fabric-laget som data · utflatet JPEG for visning, PDF og mottaker | 🟢 Kenneth 2026-09-29: *«hvorfor kan vi ikke legge et eget lag på bildet → slik at anotering er redigerbart?»* |

#### 🟡 HJEMMEL GITT PÅ FORHÅND — ikke levert ennå: innlogging kreves for alle lagrede objekter

Føres her **før** ordren sendes, som regelen krever. Ingen hash ennå — måleordren
(`relay/inbox-uploads-innlogging-maaling.md`) endrer ingen kode. Raden flyttes opp i
tabellen over med hash når gaten faktisk merges.

| Flate | Før → Etter | Hjemmel |
|---|---|---|
| Uthenting av **alle lagrede objekter** — bilder, tegninger, punktskyer, vedlegg, eksporter | I dag: **signatur-kun**. `hmac.ts:231` krever gyldig HMAC i URL-en og sjekker **ikke** innlogging — en signert lenke virker for hvem som helst i 15 min. Etter: **gyldig innlogging kreves i tillegg**, og prosjekttilgang pr. objekt der eierraden finnes | 🟢 Kenneth 2026-09-29: *«URL skal ikke være nok for å hente ut et bilde → vi skal ha en gyldig innlogging → dette gjelder alle objekter som lagres og tilhører systemet»* |

🟢 **Kenneth-vedtak 2026-09-30 — IMPERSONERINGEN STYRER SYNLIGHETEN.** `Session` bærer både
`userId` og `impersonatedUserId`. **Den EFFEKTIVE brukeren avgjør hva som vises** — den som
ser skjermen, ikke den som eier innloggingen. Signaturen bindes til effektiv `userId`, og
gaten sammenligner mot effektiv `userId`.

**Følgen, og den er selvhelbredende:** signaturer laget under impersonering slutter å matche
i det øyeblikket impersoneringen opphører — manuelt eller ved at `impersonationExpiresAt`
løper ut. Tilgangen strammes automatisk, uten opprydding.
⚠️ **Forutsetter at `SignertBilde` sin selvfornyelse utløses av DENNE feiltypen og ikke bare
av utløpt signatur. IKKE MÅLT.** Slår den ikke inn, blir resultatet tomme bilder til brukeren
laster siden på nytt.

**Kenneth har eksplisitt akseptert restrisikoen** i 15-minutters-vinduet: *«15 minutter er
ikke et problem → risiko for tyveri er betydelig redusert til pågående arbeid»*.
Signaturen beholdes derfor som den er — innlogging legges **oppå**, ikke i stedet for.

⚠️ Dette er andre gang samme krav stilles. `hmac.ts:224-227` siterer Kenneths krav fra
**2026-09-24** — «sjekk om den som henter ut bilder er innlogget, ikke bare ved pålogging»
— og konkluderer likevel med «Ingen sesjons-fallback». Kravet ble den gang lest som
«strammere signatur» i stedet for «innlogging». Det er rotårsaken til at det kommer opp igjen.

#### 🟡 HJEMMEL GITT PÅ FORHÅND — ikke levert ennå: tekstverktøyet skal treffe overalt

| Flate | Før → Etter | Hjemmel |
|---|---|---|
| Annotering, tekstverktøyet (web + mobil) | **I dag:** `annoterings-html.ts:109` — `if (opt.target) return`. Treffer klikket en eksisterende markering, opprettes **ingen** tekst, og brukeren får ingen tilbakemelding. **Etter:** klikket oppretter alltid tekst, **unntatt** når det treffer en eksisterende *tekst* — den åpnes da for redigering. Velging hører til Flytt | 🟢 Kenneth 2026-09-30: *«enig»* på coworks anbefaling |

**Bakgrunn:** Kenneth: *«fritekst annoteringer fungerer ikke → jeg finner ikke logikken for når
de vises og ikke vises»*. Logikken fantes, men var usynlig — treffområdet er hele objektets
rammeboks, ikke bare streken, så på et bilde med markeringer traff klikket ofte noe uten at
brukeren kunne vite det.

**To reparasjoner følger samme runde — ingen hjemmel nødvendig, de retter noe som var ment å
virke:** tom tekst slettes stille ved `text:editing:exited` (`:158`), og iframe-fokus gjør at
første klikk kan miste tastetrykkene (**hypotese, ikke målt**).

#### 🔴 TEKSTANNOTERING ER VERIFISERT I WEB — MOBIL ER UTESTET

⚠️ **Ikke les «tekstannotering levert» som levert på begge flater.** Tekstverktøyet ble bygget om
2026-09-29: modalen er fjernet, og teksten skrives nå direkte på bildet med `fabric.IText` som går rett
i `enterEditing()`.

| Flate | Status |
|---|---|
| **Web** | 🟢 Verifisert. IText fokuserer i nettleser |
| **Mobil** | 🔴 **UTESTET.** I `react-native-webview` avhenger tastaturet av at `enterEditing()` faktisk åpner WebView-tastaturet. **Gjør den ikke det, virker ikke tekstannotering på telefon i det hele tatt** |

🔴 **Og det er mobilarbeid etter paritetsregelen** — «ta bilde, sette pin» står eksplisitt på
mobil-siden. **Annotering i felt gjøres på telefon, ikke på PC.** ⚠️ **Oppdages dette først med hansker
i regn, er det på verste sted.**

🟡 **Kandidat-fiks, ikke satt:** `keyboardDisplayRequiresUserAction={false}` på WebView-en (iOS).
🟢 **Redesign nektet å sette en prop han ikke kunne teste** — en prop satt på antakelse er en umålt
påstand i kode. **Krever enhet.** 🔴 **Og det blokkeres av at simulatoren peker mot produksjon i stedet
for `api-test`** ([BACKLOG](BACKLOG.md)) — den saken er nå på kritisk vei.

#### 🔴 KONSEKVENS DU SKAL KJENNE: flatene har nå ULIK ANGRERETT på samme handling

**Web:** annoter → originalen består → åpne igjen → flytt pilen → angre helt.
**Mobil:** annoter → **originalen erstattes permanent** (`FeltDokumentasjon.tsx:532`, siden 2026-08).

⚠️ **Ingen ny skade — mobil har oppført seg slik siden annoteringen ble bygget, og web bryter ikke på
mobil-annoterte bilder** (KRAV(c) test 4: de blir ikke-redigerbare, ikke ødelagte). 🔴 **Men fra og med
denne mergen avhenger det av hvilken skjerm brukeren holder i hånda om han kan angre.** **Og piloten er
mobil-først — altså den flaten som IKKE kan.**

🟢 **Mobil-runden er avgrenset bevisst, ikke utsatt:** den endrer lagringsmodellen og rører
**offline-køen**, som er den skjøreste flaten vi har («Mobil-appen MÅ fungere offline»). Den får egen
gate. 🔴 **Og den er blokkert til simulatoren peker mot `api-test` i stedet for produksjon**
([BACKLOG](BACKLOG.md)) — den runden trenger den innloggede in-app-flyten.

#### 🟢 Sidefunn fra samme runde: annoteringen var aldri borte

**Kenneth trodde funksjonen var forsvunnet fra sjekklister.** Målt: `FeltDokumentasjon.tsx` i web har
**null treff på annotering i hele git-historikken.** Den har alltid vært mobil-only. 🟢 **Paritetsmålingen
som fulgte:** 33 rapportobjekt-komponenter finnes i BEGGE trær — **24 i full paritet, 9 divergerer, 1 ren
mangel.** ⚠️ **De ni er divergens fra parallell utvikling, ikke tap** — men listen bør vedlikeholdes, ikke
lages én gang.

### 2026-09-27

| Hash | Flate | Før → Etter | Hjemmel |
|---|---|---|---|
| `a2a4083c` | `/uploads/` fil-URL-er (alle flater) | Signaturlevetid **24 t → 15 min** | 🟢 Kenneth valgte 15 min, **betinget** av at selvfornyelsen gjør utløp usynlig ([BACKLOG](BACKLOG.md)). Betingelsen ble oppfylt 27.09 da lenke-klassen fikk selvfornyelse ⚠️ **Kenneth fikk betingelsen, ikke brukeropplevelsen — se merknad under** |
| `e1b0f61b` | Sjekklister (web + mobil) | **KA7** «Dokumentasjon på opprinnelse», **KB2** «Varedeklarasjon kontrollert», **KB4** «Klippet jevnlig frem til overtakelse» var trafikklys. Nå nedtrekk med navngitte valg | 🟢 Kenneth bestilte MK C-revisjonen |
| `e6e20804` | Malbygger, prefiks-felt | Tom prefiks ble godtatt. **Nå avvises den.** Auto-suffiks `SJA2` → `SJA-2` | 🔴 **INGEN.** Designordren skriver «Produktvalget er tatt», men `grunnlag` er coworks kartlegging + SQL-målinger |
| `83ee6bb6` | Firmamal, prefiks-felt | Lagret man med tomt prefiks-felt, ble prefikset **fjernet**. Nå betyr tomt felt «ikke endre» | 🔴 **INGEN.** Residual av samme ordre |
| `1c537726` | Sjekklistebibliotek, malkode | Malen het **`UM1.1`**. Heter nå **`UM1S`** | 🔴 **INGEN.** Designs ordre |
| `1ebfb693` | Eksport-flaten, 15 språk | 12 tekstnøkler het `arkiv.*` og brukte ordet «arkiv» mot brukeren. Nå `eksport.*` og «eksport» | 🟡 Commit heter «navnevedtak» og peker på et vedtak — **sporet er ikke funnet. Bekreft eller korriger** |

#### 🔴 De fire radene som mangler hjemmel — til avklaring

**Alle fire er små, og alle fire er sannsynligvis riktige.** ⚠️ **Men de står i develop uten at
Kenneth har sett dem, og det er tilstanden registeret finnes for å hindre.** 🔴 **Ikke rull noe
tilbake før Kenneth har svart.**

#### ⚠️ Merknad til signaturlevetiden — hjemmelen holder, informasjonen holdt ikke

**Det som ble skrevet ned var betingelsen** («selvfornyelsen gjør utløp usynlig») — en teknisk
påstand. **Ingen skrev hva en bruker faktisk merker.** 🔴 **Og målt 2026-09-28: gaten har ALDRI kjørt
i prod** (siste prod-deploy `eb9071f2` 24.09; `/uploads/`-gaten kom 26.09, 15 min 27.09). **Så det
finnes ingen erfaring med tallet ennå.**

**Kenneth vurderte 8 timer og valgte å beholde 15 min** til test har gitt data — *å bytte bort
sikkerhet på grunnlag av en observasjon som ikke kunne ha skjedd, er å gjette med tall.*
🟢 **Den reelle brukerkostnaden er en annen og rettes separat:** `SIGNERT_BILDE_MAKS_FORSOK = 1`
betyr at ett dropp i dekningen ødelegger bildet, og med 15 min fornyes en åpen fane ~96 ganger i
døgnet. **Piloten er 50 anleggsgartnere på dårlig 4G — det er deres normaltilstand.**

---

## 🟢 REPARASJONER MED SYNLIG VIRKNING — til orientering, ingen godkjenning

### 2026-09-30

| Hash | Flate | Før → Etter | Hvilken intensjon som gjenopprettes |
|---|---|---|---|
| `49d3fffb` ← `49a137e2` | Tegninger, web — ny rediger-modal (8 felt) | **Tegningsdetaljer kunne ikke rettes etter opprettelse.** Nå kan navn, tegningsnummer, fagdisiplin, tegningstype, **etasje**, **status**, opphav og beskrivelse endres | 🔴 **`tegning.oppdater` (`tegning.ts:375`) har hatt skrivetilgang på ALLE feltene hele tiden**, med `verifiserProsjektmedlem`. Knappen ble aldri koblet — i web brukes mutasjonen kun til målestokk (`tegninger/page.tsx:333`) |
| `a82b88d0` ← `3b2a2004` | Annotering, web + mobil | **Frihåndsstrøk ble aldri lagret.** De kunne heller ikke angres eller flyttes. Nå dekkes de av lagring, Angre og Flytt | 🔴 **`canvas.isDrawingMode` lot Fabric legge strøket på lerretet uten at noen fanget det.** 0 `path:created`-håndterere → strøket kom aldri inn i `objekter`, som er kilden til alle tre |
| `a82b88d0` ← `3b2a2004` | Samme — pilen | Den hvite kontrastkanten lå forskjøvet under den røde streken | 🔴 Begge `fabric.Line` manglet eksplisitt senter-anker. Sirkel og firkant ble rettet tidligere; pil-linja ble antatt konsentrisk uten at det var målt |

#### 🔴 To feller av samme slag, lukket samme dag — verdt å kjenne mønsteret

**Begge tegnings-fellene er felt som settes ÉN gang, i en flyt brukeren kanskje aldri kjører,
uten vei tilbake:**

- En tegning opprettet uten `floor` havnet i **«UTEN ETASJE»** og kom aldri derfra
- `status` settes til `"utkast"` ved opprettelse (`tegning.ts:186`) og kunne **kun** endres ved
  å laste opp en ny revisjon (`nyRevisjon`, `:412`). 🔴 **Hver tegning i systemet sto som
  «utkast» for alltid** med mindre noen kjørte revisjonsflyten

⚠️ **Frihånds-tapet var samme klasse, ett hakk verre:** strøket ble brent inn i den flate
JPEG-en, men forsvant ved neste annotering — og var **permanent tapt uten varsel** ved neste
lagring. **Kenneth meldte tegnings-saken 19.08 og igjen 30.09** før den ble tatt.

🟢 **Verifisert ved merge:** i18n 23 lagt til / 0 slettet i alle 15 språkfiler · georeferanse,
GPS, kalibrering, 3D, punktsky og IFC = 0 treff · tom etasje faller tilbake til «Uten etasje»
på alle tre grupperingsstedene (`TegningerPanel.tsx:56`, `TegningsModal.tsx:50`,
`byggeplasser/page.tsx:73`) — målt av cowork, ikke antatt.

### 2026-09-28

| Hash | Flate | Før → Etter | Hvilken intensjon som gjenopprettes |
|---|---|---|---|
| `38567b33` | Trafikklys i sjekklister/oppgaver — web, mobil og arkiv-PDF | **Rendreren leste aldri `objekt.config.options`.** En mal som erklærte sitt eget lyssett ble ignorert, og feltet viste standardsettet Godkjent/Anmerkning/Avvik/Ikke relevant. **Nå vises malens eget sett, i malens rekkefølge, med malens etiketter** | 🔴 **Malene har erklært lyssettene hele tiden.** `TrafikklysObjekt.tsx:14` destrukturerte `{ verdi, onEndreVerdi, leseModus }` og leste aldri `objekt` — `config.options` var uleselig for skjermen |
| `38567b33` | Malbyggeren | Én trafikklys-oppføring i paletten | **To:** ett tre-lys og ett fire-lys. Begge oppretter `traffic_light`; tresettet er en delmengde (firesettet minus `gray`), ikke en andre liste |
| `38567b33` | Malbyggeren, lagring | Et lyssett kunne lagres med duplikater, ukjente verdier eller ett lys | **Avvises nå** med `BAD_REQUEST`. 🟢 **Antallet er IKKE låst til 3/4** — en hardkodet grense ville gjentatt feilen i [`bruk-er-ikke-behov.md`](retningslinjer/bruk-er-ikke-behov.md). Mangler `options` → kanonisk firelys-fallback, som verner de 27 dagens felt |

🔴 **KUNDESYNLIG NÅR DET DEPLOYES:** målt at **6 av 6 `traffic_light`-felt i PROD har egne `options`** —
altså viser samtlige feil etiketter i dag. **Fire av de seks tilhører A.Markussen.** 🟢 **Ingen er besvart
ennå**, så ingen lagret verdi skifter betydning. ⚠️ **Ligger på develop; prod er ikke rørt.**

🟡 **Én konsekvens å kjenne til, ikke en mangel:** seedede etiketter oversettes (`oversettStandardtekst`),
**firmaets egne etiketter vises rått på alle 15 språk.** 🔴 **Det er et bevisst valg, og grunnen er ikke at
vi ikke KAN oversette — det er at vi ikke SKAL:** en maskinoversatt etikett på et kontrollpunkt er en
påstand om hva som ble kontrollert mot, og tar oversettelsen feil, **lyver et signert dokument.** Samme
grunn som malreglene forbyr ordrett normtekst. 🟢 **Rammer bare den som aktivt overstyrer teksten — da er
det hans tekst, på hans språk.**

### 2026-09-27

| Hash | Flate | Før → Etter | Hvilken intensjon som gjenopprettes |
|---|---|---|---|
| `c98791a4` | PSI-opprettelse (web) | PSI nr. to ga **stille feil** — spinneren stoppet, ingenting skjedde. Nå inline melding om hvilken PSI som finnes og hva brukeren kan gjøre | Det var meningen at opprettelsen skulle gi tilbakemelding |
| `0f8eccdf` | Trafikklys (web + mobil + arkiv-PDF) | En lagret verdi utenfor verdisettet fikk feltet til å se **ubesvart** ut. Nå vises den rå verdien med teksten «ikke et gyldig valg» | Et lagret svar skal aldri forsvinne stille |
| `e1b0f61b` | Sjekkliste KB4, hjelpetekst | «… sett «Ikke relevant».» → «… sett «Ikke relevant (grasbakke/eng)».» | Hjelpeteksten skal sitere opsjonen som finnes |
| `24b598bf` | PSI-opprettelse (DB-garanti) | Prod håndhevet **én PSI per prosjekt**. Nå: én per byggeplass, og høyst én på prosjektnivå | 🟢 Kenneths egen beskjed: «et prosjekt kan ha ti forskjellige psi» — indeksen avvek fra den |

### 🔴 Venter på prod, og skal verifiseres FØR deploy

| Hash | Hva som skjer | Hvorfor det må ses i felt |
|---|---|---|
| `8db99f8e` + `a2a4083c` | `/uploads/` er **default-deny for hele treet**. Hver bilde- og vedlegg-URL må være signert | **Har aldri kjørt i prod.** Er én konsument glemt, viser den et tomt bilde hos en kunde. Coworks negative kontroll fant 0 gjenstående rå lenker i `apps/web/src`, og mobil dekkes av resolveren — **men det er målt i kode, ikke i felt.** 🔴 **Verifiser som innlogget på test: sjekkliste med bilder · oppgave med vedlegg · en tegning · last ned ett vedlegg.** `curl` med 200 beviser ingenting her |

---

## Ikke ført — ingen synlig virkning i noe tilfelle

**29 docs-merger 26.–27.09** · `fix/psi-prosjektniva-unik` DROP-vakt (testfil) · snubletråder,
paritetstester, `psiWhere`-opprydding, `ukjentTrafikklysVerdi` flyttet til `shared`.
