---
name: domene-arbeidsflyt
description: Beskriver den virkelige arbeidsflyten i SiteDoc sett fra brukerens perspektiv.
  Dette er det styrende dokumentet for arkitektur-beslutninger — kode skal alltid kunne
  forklares tilbake til en arbeidsflyt beskrevet her.
status: under-utvikling
sist_oppdatert: 2026-05-05
sist_verifisert_mot_kode: 2026-05-05
---

# Domene-arbeidsflyt — SiteDoc

## Formål
Dette dokumentet beskriver hva SiteDoc faktisk gjør fra brukerens perspektiv.
Det er ikke et teknisk dokument — det er en beskrivelse av virkeligheten systemet skal støtte.
Alle arkitektur-beslutninger skal kunne forklares tilbake til en arbeidsflyt her.

---

## Aktører

| Aktør | Rolle | Primære behov |
|---|---|---|
| Ansatt (feltarbeider) | Utfører arbeid, registrerer | Enkel registrering, tilgang til prosjektinfo |
| Leder/Prosjektleder | Kontrollerer, attesterer, fordeler | Oversikt, godkjenning, rapportering |
| Byggherre | Mottar dokumentasjon, godkjenner | Godkjenning av endringer og leveranser |
| UE (underentreprenør) | Ansatt fra annet firma som arbeider på prosjektet | Tilgang til oppgaver/sjekklister, egne timer i eget firma |
| Firma-admin | Administrerer firma, moduler, brukere | Konfigurasjon, rapportering |
| sitedoc_admin | Systemadministrasjon på tvers av firmaer | Full oversikt alle firmaer |

---

## Arbeidsdag — Ansatt (feltarbeider)

### Morgen — planlegg dagen
1. **Kontrollplan** → sjekk hvilke sjekklister som skal utføres i dag
2. **Fremdriftsplan** → hva og hvor mye må gjøres i dag?
3. **Innboks** → har leder sendt oppgaver som skal utføres?

### Under arbeid — utfør og dokumenter
4. **Tegninger** → verifiser at arbeidet utføres på korrekt lokasjon
5. **Mapper** → les prosjektbeskrivelse og relevante dokumenter ved behov
6. **Sjekkliste** → dokumenter løpende etter hvert som punkter fullføres
7. **RUH/HMS-avvik** → registrer umiddelbart hvis avvik oppstår
8. **Oppgave fra leder** → utfør, ta bilde, skriv kort oppsummering, send tilbake

### Slutt av dag — registrer forbruk
9. **Dagsseddel** (eies av Timer-modulen):
   - Lønnsart per rad → hvilken type arbeid ble utført. Hver rad har **alltid prosjekt**, og kan i tillegg ha **ECO/Underprosjekt** som kostnadsbærer
   - Tillegg → mat og/eller reise
   - Maskin (hvis Maskin-modul aktiv) → hvilken maskin, antall timer/km
   - Vareforbruk (hvis Varelager-modul aktiv) → materialer brukt

### Oppfølging — se hva leder har gjort
10. **Timer-status** → se om leder har attestert, returnert eller flyttet timer

---

## 🔴 BINDENDE: byggeplass er et VALGFRITT oppdelingsnivå — «uten byggeplass» er normaltilstanden (Kenneth 2026-09-04)

> **Kenneth 2026-09-04, ordrett:**
>
> *«PSI og HMS gjelder som regel hele prosjektet. Noen ganger vil HMS og PSI deles opp i
> byggeplasser, dersom prosjektet er felles, men byggeplassene har avstand internt. Andre ganger er
> det kort avstand og PSI/HMS er felles.*
>
> *Et prosjekt kan ha flere byggetrinn → og er derfor oppdelt i flere byggeplasser → som medfører
> at prosjektet kan vare i 5 år, med tre forskjellige bygg, som starter når det første er ferdig.*
>
> *Mange prosjekter har kun én byggeplass → da er byggeplass og prosjekt samme lokasjon.»*

**Utløst av spørsmålet:** *«et dokument uten byggeplass bør ikke eksistere — kan det forsvares?»*
Cowork målte modellen gjennom timer, maskin, varelager, prosjekt, tegninger og 3D. **Svaret er
nei**, og Kenneths forklaring sier hvorfor.

### Hva målingen viste

`byggeplassId` er **nullable i alt** — `Checklist`, `Task`, `Drawing`, `PointCloud`, `Psi`,
`FtdKontrakt`, timer (3 steder), maskin, varelager. Kun **`Omrade`** og **`Kontrollplan`** krever
den, og de er strukturelle barn av byggeplassen, ikke dokumenter.

To steder står betydningen allerede i schemaet: `Psi` (*«null = gjelder hele prosjektet»*) og
varelager (*«NULL = hele prosjektet»*). **De to hadde rett hele tiden.**

### Fire konsekvenser som binder

1. 🔴 **Gjør ALDRI `byggeplassId` påkrevd på et dokument.** Det ville brutt PSI, HMS, timer,
   maskin, varelager, tegninger og 3D samtidig — for å løse et problem som ikke finnes. «Uten
   byggeplass» er ikke en mangel; det er det vanligste tilfellet.

2. ✅ **Myk filtrering på byggeplass er RIKTIG — funnet fra 03.09 er dermed lukket.**
   `sjekkliste.ts:185` gjør `OR: [{byggeplassId: valgt}, {byggeplassId: null}]`. Det ble ført som
   mistenkelig («chippen sier *Viser kun denne byggeplassen*, men filteret slipper gjennom
   null»). **Domenet bekrefter filteret:** et dokument som gjelder hele prosjektet gjelder også
   denne byggeplassen, og skal være med. 🔴 **Det er CHIP-TEKSTEN som er feil**, ikke filteret —
   den lover en avgrensning systemet med rett og vilje ikke gjør.
   ⚠️ Tegninger filtrerer **hardt**. Det er sannsynligvis riktig (en tegning hører til ett sted),
   men forskjellen er ikke vedtatt noe sted — eget spørsmål.

3. 🔴 **Har prosjektet ÉN byggeplass, skal brukeren ikke spørres.** Da er byggeplass og prosjekt
   samme lokasjon, og et valg mellom ett alternativ er et klikk uten informasjon. Direkte
   anvendelse av effektivitets-gaten og A.Markussens hovedkritikk («mange klikk»).

4. 🔴 **Byggeplasser har TID og ANTALL — dette er nytt og ikke modellert.**

   > **Kenneth 2026-09-04:** *«Et prosjekt kan ha flere byggetrinn → prosjektet kan vare i 5 år,
   > med tre forskjellige bygg, som starter når det første er ferdig.»*
   >
   > *«Et prosjekt kan leve i 30 år eller mer — men bestå av mange kortvarige prosjekter som varer
   > en uke eller en måned. Kanskje vi må skjule og lukke disse etter behov.»*

   **To skalaer, ikke én.** Byggetrinn-tilfellet er tre enheter over fem år. Det andre er en
   beholder som lever i tiår og fylles med ukelange jobber — en rammeavtale, en driftskontrakt, et
   vedlikeholdsoppdrag. Der snakker vi **hundrevis av enheter i ett prosjekt.**

   🔴 **Ingenting i dagens modell bærer noen av dem.** `Byggeplass` har ingen tilstand, ingen
   start/slutt, ingen arkivering.

   **Hva som brekker ved den store skalaen — ikke gjettet, men forutsigbart:**
   - Byggeplass-velgeren (`ByggeplassChip` + dokumentskjemaer) med 500 valg er ubrukelig i felt
   - Dokumentlister og filtre vokser uten grense
   - «Vis kun aktive» går fra å være en bekvemmelighet til å være en forutsetning

   **Spørsmål som må UTREDES, ikke besvares av oss:**
   - Skal en avsluttet byggeplass skjules i velgere, eller kun i lister? Kan den gjenåpnes?
   - Kan dokumenter opprettes på en byggeplass som ikke har startet?
   - Hva skjer med PSI og mannskapsliste når et trinn avsluttes og folkene flyttes videre?
   - 🔴 **Er en ukelang jobb i en 30-årig avtale egentlig en `Byggeplass`, eller er den et
     `Project` med avtalen som et nivå over?** Kenneth sier «kortvarige prosjekter» — ikke
     «byggeplasser». Det kan være presist språk, og da mangler modellen et nivå.

   **Fabels domene. Ingen ordre skrevet — dette er en modellsak, ikke en kodeoppgave.**

### Nivåene et dokument kan gjelde

```
punkt på tegning     lokasjonOmfang = "punkt"        eksplisitt  ✅
hele byggeplassen    lokasjonOmfang = "byggeplass"   eksplisitt  ✅ (bygget 04.09)
hele prosjektet      byggeplassId = null             TVETYDIG    ⚠️
```

Det tredje nivået lider av samme feil som det andre gjorde før 04.09: `null` betyr både «ikke
valgt ennå» og «gjelder hele prosjektet». Kenneths gatelys-eksempel gjelder ett trinn opp også —
*«alle gatelysene i prosjektet mangler merking»* er et like gyldig funn som på én byggeplass.
**Åpent til fabel; ikke bygget.**

## 🔴 BINDENDE VEDTAK: dokumentflyten er nøkkelen — faggruppe er avledet (Kenneth 2026-08-22)

**Vedtaket:** et dokument tilhører alltid nøyaktig **én dokumentflyt**. Faggruppen er en
**egenskap ved flyten**, ikke en inngang til den. Overalt hvor en flate skal identifisere
hvor et dokument hører hjemme — opprettelse, videresending, mal-utvalg, mottakervalg —
er det **flyt-id-en som velges og sendes**. Faggruppen leses ut av flyten etterpå.

**Hvorfor dette er bindende:** én faggruppe kan ha flere flyter. Å velge faggruppe først
gjør valget flertydig, og koden må da gjette — typisk med `.find()`, der første treff
vinner. Det er ikke en teoretisk risiko; det var rotårsaken til fire målte funn
2026-08-22, alle med samme signatur:

| Sted | Feilen |
|---|---|
| «Opprett fra tegning» | Valgte faggruppe først og sendte aldri `dokumentflytId` → serveren avviste alt annet enn HMS. Stille i fire uker (regresjon fra `5573ccd2`, 24.07) |
| `OpprettOppgaveModal` | Utleder flyt fra valgt mal via `.find()` i stedet for å arve sjekklistens flyt |
| `mottakerForStandard()` | Finner standard-mottaker på `faggruppeId` — første treff vinner ved to flyter |
| `dokumentflyt.malDuplikatAdvarsel` | Advarer mot to flyter med samme mal i én faggruppe, i stedet for at flyten er nøkkelen. Vakt mot en modellsvakhet, ikke mot en brukerfeil |

**Praktisk regel for nye flater:** finner du deg selv i å skrive
`X.find(v => v.faggruppeId === …)` for å bestemme hvor et dokument skal, har du valgt feil
nøkkel. Flyt-id-en er kjent — bruk den.

**Unntak: HMS.** HMS-dokumenter rutes av serveren til prosjektets HMS-flyt, og klienten
skal **aldri** sende `dokumentflytId` for dem (`sjekkliste.ts:345` feiler høylytt).
HMS *har* en flyt — den er bare ikke klientens sak.

## 🔴 BINDENDE VEDTAK: rekkefølgen styrer flyten — kun registrator består (Kenneth 2026-08-21)

**Vedtaket:** dokumentflyt styres av **rekkefølgen på flytboksene alene**. Den eneste
rolleegenskapen som beholdes er **registrator** — hvem som kan opprette og starte
dokumentet. Semantiske ledd-typer som utfører, godkjenner og kontrollør **fjernes som
egenskaper**: hva et ledd *er*, følger av hvor det står i flyten, ikke av en merkelapp.

**Modellkonsekvens:** et ledd = posisjon + bemanning (person, gruppe eller faggruppe, med
«høyst én»-vernet fra `37480046`) + registrator-flagg. Ikke noe mer.

**Hva vedtaket lukker:**

- Flytmodell-spørsmålet A–D, som har stått åpent i innboksen.
- Deler av KP-start-beslutningen a/b/c: «hvem kan starte» **er** registrator-leddet;
  resten er rekkefølge.

**Begrunnelsen er begrepsøkonomi.** Hver ledd-type er et begrep brukeren må lære, et valg
i flytbyggeren, og en gren i koden. Posisjonen bærer allerede betydningen — å merke den i
tillegg er duplisering som kan drifte fra hverandre. Kenneth 2026-08-21: *«jeg mener vi
besluttet å kode oss bort fra det.»*

🟡 **Ikke bygget. Kartlegging pågår før fjerningsdesign** — typen kan være vevd inn i
signerings- og attesteringslogikk, og det skal måles, ikke antas. Seks kartleggingspunkter
i [vedtak-flytmodell-rekkefolge-fabel-2026-08-21.md](../redesign/vedtak-flytmodell-rekkefolge-fabel-2026-08-21.md).
Fjerningsordre formuleres av fabel etter rapport, med Kenneth-gate før bygging.

### Hva en oppgave ER — Kenneth 2026-08-29

> *«Jeg er ute og registrerer noe som er feil utført. Jeg oppretter en arbeidsordre — en
> oppgave til en arbeider. Arbeideren fyller ut de tomme feltene når oppgaven er utført, og
> sender oppgaven til ledelsen for godkjenning av arbeidet.»*

**En oppgave er en arbeidsordre.** Den beveger seg gjennom minst tre hender med hver sin
oppgave: den som *oppdager* fyller ut avviket, den som *utfører* fyller ut resultatet, den som
*godkjenner* leser begge deler.

**Modellkonsekvensen — vedtatt 2026-08-29 (alternativ B):**

- Et felt som **har** en verdi kan ikke endres etter sending. Verdien tilhører den som skrev
  den, og skal kunne leses i ettertid som hans svar.
- Et **tomt** felt kan fylles av den som har ballen. Det er hele poenget: arbeideren
  dokumenterer utførelsen i felt oppretteren lot stå åpne.
- Kommentarer og vedlegg kan alltid legges til, i alle statuser.

**Hvert felt skrives én gang, av den som eide dokumentet da.** Det er sporbarheten en
arbeidsordre trenger — man skal se hvem som svarte hva, og ingen skal kunne endre det i
ettertid.

🔴 **Dette forkastet alternativ A** («oppgave redigerbar som utkast kun»), som ville gjort
oppgaven til en melding arbeideren bare kunne kommentere på. Kenneths egne to formuleringer
pekte hver sin vei; beskrivelsen over avgjorde det.

### 🔴 Innhold låses, merkelapper gjør ikke (Kenneth 2026-08-29)

Låsen over gjelder **feltverdier** — arbeiderens svar, som er bevis. Den gjelder **ikke**
merkelapper som finnes for at noen skal finne dokumentet igjen.

> **Kenneth:** *«En ansatt la ikke til emne på en oppgave. Lederen ønsker å legge til
> emnefeltet fordi han trenger en søkestreng ekstra.»*

**Vedtak: emne skal kunne ENDRES etter sending**, ikke bare fylles når det er tomt. En
merkelapp som er satt feil er verdiløs hvis den ikke kan rettes, og endringsloggen viser
hvem som gjorde det.

| | Låses ved sending | Begrunnelse |
|---|---|---|
| **Feltverdi** | ✅ ja | arbeiderens svar — bevis, skrives én gang |
| **Lokasjon** | ✅ ja | HVOR arbeidet ble utført er dokumentasjon |
| **Emne** | ❌ nei | merkelapp for gjenfinning, ikke et svar |
| **Kommentar / vedlegg** | ❌ nei | tilføyelser, tar ikke bort noe |

⚠️ **Hullet ble laget av oss selv** i `fix/oppgave-datalaas` (i prod `3a2f7dc3`): `subject`
lå inne i utkast-låsen på `oppgave.oppdater`, og klienten speilet den. Rettes i
`relay/inbox-emne-alltid-redigerbart.md`.

**Testen for nye felt:** dokumenterer feltet *hva som ble gjort*, eller hjelper det noen med
å *finne dokumentet*? Det første låses, det andre ikke.

### 🔴 Repeater hører ikke hjemme i en oppgave (Kenneth 2026-08-29)

> *«Kanskje vi må akseptere at repeater ikke tilhører i oppgave. Kanskje det objektet bør
> fjernes/deaktiveres i malbyggeren for oppgave.»*

**Begrunnelsen:** en repeater er en liste av N ting. En arbeidsordre er **én** ting som skal
utføres og godkjennes. Legger man fem observasjoner i én oppgave, får de én felles status —
man kan ikke melde punkt 3 ferdig og la punkt 5 stå.

**Og modellen finnes allerede i riktig retning:** `feat/oppgave-per-rad` lot hver repeater-rad
i en **sjekkliste** få sin egen oppgave (rad-unik nøkkel `${objekt.id}:${_radId}`). Sjekklisten
samler observasjonene; oppgaven bærer én av dem. Repeater i en oppgavemal duplicerer altså en
struktur som hører hjemme ett nivå over.

**Målt på test 2026-08-29 — fjerningen er gratis:**

```
category   | maler | repeatere
sjekkliste |     6 |         8
(1 row)
```

**Null oppgavemaler bruker repeater.** Ingen eksisterende mal avhenger av den.

**Form:** objektet fjernes fra felttype-velgeren når malens `category = "oppgave"`. Eksisterende
objekter slettes ikke — skulle en finnes, skal den fortsatt rendres. Vi slutter å tilby den,
vi river den ikke ut.

⚠️ **Ikke bygget da vedtaket ble tatt.** `oppgave.oppdaterData` (`oppgave.ts:689`) hadde ingen
statusvakt — en sendt oppgave kunne få endret en utfylt verdi (Kenneth-funn på test 29.08:
antall gravemaskiner endret fra 1 til 2 etter sending). Ordre: `relay/inbox-oppgave-datalaas.md`.
**Sjekklister har bevisst motsatt regel** og er redigerbare til godkjent/lukket.

### Tillegg 2026-08-29 (Kenneth): bakover skal være stegadressert, som framover

> *«Fra mitt ståsted: (2 til n) i hver eneste flytboks — sende frem eller tilbake i flyten.»*

Hver boks fra posisjon 2 og utover skal kunne sende **begge veier**. Registrator er unntaket
i den andre enden: den er alltid første boks og har ingen posisjon å gå tilbake til.

🔴 **Dette er ikke bygget, og koden gjør noe annet.** Målt 2026-08-29:

- Framover **er** stegadressert: `send → sent` ruter via `nesteLedd` (`flytPosisjon.ts:172`).
- Bakover er **ikke** stegadressert. Det finnes én bakover-handling, `Besvar`
  (`received → responded`), som returnerer ballen til avsenderen — ikke til et valgt steg.
  Fra `responded` er eneste standardovergang `approved` (`statusHandlinger.ts:378-387`).
- «Send tilbake» (`responded → in_progress`) ble **fjernet 2026-08-02** i «Runde-2»
  (`statusHandlinger.ts:55-56, 110`). ⚠️ **Begrunnelsen ble aldri skrevet ned.** Den
  beslutningen står nå i motstrid til kravet over, og ingen kan lese seg til hvorfor den
  ble tatt — noter det før noen bygger den tilbake eller argumenterer mot den.

**Kjernen, formulert av Kenneth og bekreftet mot kode:** statusmaskinen koder i dag *retning*
som *status* i stedet for som *posisjon*. Det er derfor bakover ikke kan adresseres. Fiksen er
ikke en manglende knapp.

**Relatert innsikt samme dag — boksen bør bære sin egen posisjon.** I dag bor `steg` kun på
`DokumentflytMedlem`, ikke på boksen. Derfor må boksens nummer utledes (`min(medlemmenes
steg)`), og derfor hardkoder `leggTilMedlem` `steg=1` (`dokumentflyt/page.tsx:869, 886` ·
`validation/index.ts:307`). Legger boksen sin posisjon i `Dokumentflyt.roller` og lar medlemmet
arve den, forsvinner hardkodingen uten ny inngang: rekkefølgen brukeren allerede ser **er**
posisjonen.

### ⏸️ PARKERT 2026-08-29 (Kenneth): frie boksnavn venter på faggruppe/kontakter-avklaringen

Boksen får i dag et navn i flytoppsettet som skal fortelle brukeren hva som forventes i akkurat
det leddet — og navnet virker der. Men det **følger ikke med til utfyllingen**: dokumentets
merke avledes fortsatt av rollenavnet (`flytPosisjon.ts:32-47` → `FlytIndikator.tsx:159`), og
kolonnen `DokumentflytMedlem.ansvarsmerke` (`schema.prisma:1385`), som ble laget for å bære
navnet per posisjon, leses aldri.

**Kenneth 2026-08-29:** *«Jeg er usikker om vi bare avventer denne inntil videre. Jeg må avklare
faggruppe/kontakter-problematikken som jeg foreløpig ikke har noe svar på.»*

Problemet han sikter til: en flytboks bemannes av **én av tre ting** — faggruppe, kontaktgruppe
eller enkeltperson (`DokumentflytMedlem`, «høyst én»). Flytlinja viser navnet på det som er
bundet, uten å si hvilken av de tre. Heter kontaktgruppa og faggruppa begge «Byggherre», kan
ingen lese seg til hvilken som står der. **Det er ikke et navneproblem — typen vises ikke.**

**Ikke bygg frie boksnavn før dette er avklart.** Å la boksen bære et fritt navn samtidig som
bemanningens type er usynlig, legger et tredje navn oppå to som allerede forveksles.

## 🔴 BINDENDE VEDTAK: uoppfordret automatikk overskriver aldri en menneskelig handling (fabel 2026-08-20)

**Vedtaket:** en avledet eller automatisk registrering skal aldri slette, overskrive eller
fortrenge noe et menneske aktivt har lagt inn — **uten at det er mennesket selv som ba om
det**. Ved konflikt viker automatikken, og konflikten **synliggjøres**.

**Opphav:** fabels gate på AM ordre 1b (play-knapp vs. manuell timeføring). Ordlyden:
*«manuelt førte timer er en aktiv brukerhandling og skal aldri slettes av en automatisk
kilde — samme prinsipp som «utførte kontroller flyttes aldri». Play er avledet
registrering; manuell input er fasit.»*

### Tre presiseringer — vedtaket bites her (fabel 2026-08-20)

**1 · Vike betyr aldri tie.** Forkastes en play-generert rad stille, kan reelle arbeidstimer
forsvinne fordi en manuell rad var ført feil. Regelen er **vike + varsle**, aldri vike +
glemme. Varselet skal si *hva* som vek — hvilket tidsrom, og at den manuelle raden er
beholdt. Dette er den delen som ryker først når vedtaket gjenbrukes i en ny sak.

**2 · En rettelse er også en menneskelig handling.** Vedtaket hindrer ikke at et menneske
ber systemet hente på nytt. Værsnapshot som oppdateres fordi brukeren retter
befaringstidspunktet **er** auto-overskriving — utløst av en menneskelig handling, og det er
lov. Derfor **«uoppfordret automatikk»**, ikke «automatikk». Uten det ordet kolliderer
vedtaket med værregelen (samme dag: vær hentes én gang, i det øyeblikket tidspunktet settes;
et rettet tidspunkt oppdaterer feltet).

**3 · Migreringer og backfill er unntatt, eksplisitt.** En datareparasjon — som
steg-backfillen — er et bevisst inngrep med Kenneth-vedtak bak seg, ikke en «automatisk
kilde». Uten dette unntaket kan vedtaket brukes som argument mot nødvendige reparasjoner.

### Presedens

| Automatisk kilde | Menneskelig handling | Utfall |
|---|---|---|
| Play-generert timerad | Manuelt ført rad | Play genererer ikke overlappende rad; manuell beholdes, arbeideren varsles om tidsrommet (`e789ddc4`) |
| Kontrollplan-omplassering | Utført kontroll | Utførte kontroller flyttes aldri |
| Auto-utkast dagsseddel | Arbeiderens egne rader | Forslag i draft, aldri auto-rad |
| Vær-henting | Brukeren retter tidspunkt | **Overskriver — lovlig.** Rettelsen er den menneskelige handlingen (jf. presisering 2) |

### Konsekvens for nye funksjoner

Når en automatisk kilde og en brukerhandling kan treffe samme felt, skal designet svare på
fire ting før koding:

1. Hvem viker?
2. Ba mennesket om dette? (Er ja — er det ikke uoppfordret, og vedtaket gjelder ikke.)
3. Hva sier varselet konkret — hvilket felt, hvilken verdi, hva ble beholdt?
4. Hvor ligger regelen? Delt kilde, aldri kopi per flate.

## 🔴 BINDENDE VEDTAK: mangler prosjektet modulen, skal telefonen ikke tilby den (Kenneth 2026-08-31)

> **Kenneth 2026-08-31:** *«Dersom et prosjekt ikke har en modul → da bør ikke telefonen
> tilby modulen»* — og presisert samme dag: *«eller firma»*.

**Dette snur dagens praksis.** Mobilen bruker i dag «soft-skjul»: seksjoner forsvinner når
**datalisten er tom**, ikke når **modulen er av**. Konsekvensen er at «ikke kjøpt» og «ingen
data ennå» ser helt like ut — dokumentert i
[modulmodell-utredning-2026-08-30.md](modulmodell-utredning-2026-08-30.md), der målingen viste
at `vareforbruk.ts` er det **eneste** stedet i kodebasen som skiller de to.

**Regelen fra nå: BEGGE nivåer må være aktive.** Gatingen leser modultilstand, ikke om det
tilfeldigvis finnes rader:

| Nivå | Tabell | Betydning |
|---|---|---|
| Firma | `OrganizationModule` (`schema.prisma:282`) | **Kjøpet** — har firmaet modulen i det hele tatt |
| Prosjekt | `ProjectModule` (`schema.prisma:1491`) | **Bryteren** — er den slått på for dette prosjektet |

⚠️ **RETTET 2026-08-31 — coworks måling var feil, og påstanden sto her i noen timer.**

Den opprinnelige teksten sa: *«Målt luke: firmanivået er ikke med i gaten. `krevMaskinAktivert`
slår kun opp i `ProjectModule` — `OrganizationModule` leses aldri.»*

**Det stemmer ikke.** Kontrollplan målte 2026-08-31: alle tre firmagatene
(`services/{timer,maskin,varelager}/moduleGate.ts`) kaller
`erFirmamodulAktivert(orgId, slug)` — som leser `OrganizationModule` — **før** de sjekker
`ProjectModule`. **Firmataket HAR vært i gaten siden «Steg 1e Fase B, 2026-05-05»**, og
filens egen toppkommentar sier det: *«Sjekk er additiv: begge nivåer må være aktive.»*

🔴 **Hvordan feilen oppsto:** cowork leste `moduleGate.ts` fra **linje 40** med `sed -n '40,75p'`,
så `projectModule.findFirst` øverst i utsnittet, og konkluderte. Firmatak-sjekken ligger på
**linje 36** — fire linjer over lesevinduet. *En konklusjon fra et utsnitt er ikke en måling.*

**Vedtaket under står uendret** — «begge nivåer må være aktive» er riktig, og er nå
implementert som delt resolver (`services/modul/resolver.ts`, merget `1266ac2a`). Det som var
feil var påstanden om at koden ikke gjorde det allerede.

**Det ekte hullet, funnet i samme runde:** rad-skrivende timer-mutasjoner var ugatet.
`krevTimerAktivert` sto kun tre steder i `dagsseddel.ts` av ~tolv skrivende prosedyrer, så en
sedel opprettet mens Timer var på kunne få nye rader etter at Timer ble slått av. Lukket i
`8f7ada26` — nye rader stoppes, arbeid i gang låses aldri.

**Kenneths symptom er dermed IKKE forklart av serversiden.** Mest sannsynlig hypotese
(kontrollplan, ikke bekreftet): `OrganizationModule`-raden var faktisk aktiv mens
`/dashbord/firma/moduler` viste «Aktiver» — altså et **flate-problem** som hører til steg 3.

**En modul som ikke er kjøpt skal ikke kunne slås på per prosjekt heller.** Firmanivået er
taket; prosjektnivået er bryteren under taket.

**Belegg fra felt (Kenneth 2026-08-31):** Timer sto som «Aktiver» (altså av) i firmamoduler,
mens han samtidig registrerte timer på telefonen og innstillingssiden viste tilgangsvalg for
tre moduler som ikke var på. Tre flater, tre ulike svar på om modulen finnes.

### 🔴 Fella som må måles FØR dette bygges

`TimerSyncProvider.tsx:104-108` henter **maskinkatalogen i samme `Promise.all` som
timer-katalogen**. Det virker i dag kun fordi `equipment.list` **ikke** er modul-gatet.

**Legger noen `krevMaskinAktivert` på den prosedyren, feiler hele timer-synken på mobil for
et firma som har Timer uten Maskin.** Det er den eneste målte veien der «maskin mangler»
faktisk kan velte timer, og den er én linje unna.

Gating skal derfor skje **i UI-laget mot modultilstand**, ikke ved å gate katalog-prosedyrene
serverside. Katalogen kan gjerne svare tomt — det er visningen som skal la være å spørre.

## 🔴 BINDENDE VEDTAK: å avslutte et prosjekt er å FRYSE det, ikke å slette noe (Kenneth 2026-08-30)

> **Kenneth 2026-08-30:** *«Hvordan kan vi avslutte et prosjekt når oppgaver ikke kan slettes?
> Vi må ha en løsning for å avslutte et prosjekt!»*

**Spørsmålet var feil stilt, og det er en god nyhet:** avslutning skal ikke kreve at noe
slettes. Sjekklistene fra et ferdig byggeprosjekt er nettopp det kunden skal beholde — de
**er** produktet. Det som mangler er ikke sletting, det er **frysing**.

### 🔴 Målt 2026-08-30: `Project.status` håndhever ingenting

| Lag | Tilstand |
|---|---|
| DB | `Project.status String @default("active")` (`schema.prisma:584`) |
| API godtar | `active` · `archived` · `completed` · `deactivated` (`prosjekt.ts:606`) |
| API **håndhever** | **ingenting** — ingen skrivevei leser `Project.status` |
| UI lover | *«Prosjektet er arkivert og skrivebeskyttet»* (`nb.json:2218`) |

**Negativ kontroll kjørt:** `tilgangskontroll.ts` leser `OrganizationMember.status` (ansatt),
aldri `Project.status`. Ordet «skrivebeskytt»/`readOnly` finnes ikke i `apps/api`. Ingen
`select` av prosjektstatus i skriveveiene.

🔴 **Dette er en løftebrist mot kunden, ikke bare en manglende funksjon.** Velger man
«Arkivert» i dag skjer ingenting: dokumenter kan fortsatt endres, sendes og opprettes.
Det er samme form som «en kommentar som lover mer enn koden holder», men på en flate kunden
leser.

### Konsekvensen: frysing løser tre saker med ett grep

Gjøres `archived` til en ekte skrivevakt i serverlaget, faller to beslektede spørsmål bort:

1. **Ledd-vernet** (`dokumentflyt.fjernMedlem:370`) blokkerer fjerning av et flytmedlem så
   lenge flyten har aktive dokumenter. I et **arkivert** prosjekt skal ingenting bevege seg,
   så ingen trenger å fjernes. Problemet forsvinner der det gjorde mest vondt.
2. **Sletting av flyt med lukkede dokumenter** — Kenneth var eksplisitt usikker. Med frysing
   trenger spørsmålet ikke avgjøres: lukkede dokumenter i et arkivert prosjekt er urørlige
   uansett, og flyten kan stå som historikk uten å være i veien.

### Om ledd-vernet i et AKTIVT prosjekt (Kenneth 2026-08-30)

> *«Fjerning av medlemmet skader ikke dokumentet som er laget — jeg mener det er feil
> beslutning.»*

**Han har rett, med én presisering.** Innholdet i et opprettet dokument er skrevet og
uberørt. Det fjerning *kan* skade er et **åpent** dokuments evne til å finne neste mottaker,
siden `nesteLedd` (`flytPosisjon.ts:172`) regnes ut fra levende `DokumentflytMedlem`-rader.

Vernet sikter altså på noe ekte, men **treffer for bredt**: det blokkerer også når medlemmet
ikke er alene i leddet, og når dokumentene er lukket. Riktig avgrensning er «dette leddet
ville blitt tomt, og det finnes åpne dokumenter i det» — ikke «flyten har dokumenter».
⚠️ Dette **reviderer**, men reverserer ikke, ledd-vernet Kenneth bestilte 2026-08-22; formålet
består, treffbildet snevres.

### Faggruppe-medlemskap er mange-til-mange (målt 2026-08-30)

`FaggruppeKobling` har `@@unique([projectMemberId, faggruppeId])` (`schema.prisma:665`) — en
sammensatt unik, som er nettopp det som gjør koblingen mange-til-mange.

🔴 **Derfor kan «kontaktgruppe» aldri være det samme som faggruppe.** Spørsmålet «hvilken
faggruppe tilhører denne kontakten» har ikke ett svar, og skal ikke stilles.
Kenneth 2026-08-30: *«samme kontakt kan være medlem av flere faggrupper, det gjør at en
kontaktgruppe og en faggruppe ikke kan være det samme.»*

**Konsekvens for opprettelse fra en flytboks (Kenneth-vedtak 2026-08-30):**
`Dokumentflyt.faggruppeId` (`schema.prisma:1366`) bærer konteksten, og en kontakt opprettet
derfra skal **arve faggruppen stille — ikke vise hele hierarkiet**.

Kenneth valgte den lette modalen framfor den fulle: står du i en flytboks, er faggruppe, flyt
og rolle allerede bestemt av konteksten, og å be brukeren bekrefte dem er å spørre om noe
systemet vet. Skjemaet forblir navn/e-post/telefon; koblingen skjer i bakgrunnen.

🔴 **Arv er ikke låsing.** Medlemskapet er mange-til-mange, så kontakten kan senere legges i
flere faggrupper fra kontaktsiden. Den stille arven setter den **første** tilknytningen, den
definerer den ikke.

⚠️ **Cowork foreslo først full modal med synlig forhåndsvalg; det ble avvist.** Rett ikke
tilbake uten å lese dette avsnittet.

🔴 **`Dokumentflyt.faggruppeId` er nullbar med vilje, ikke ved slurv.** `modul.ts:55-56`
oppretter HMS-flyten som `{ projectId, name: "HMS" }` uten faggruppe når HMS-modulen slås på —
HMS er tverrgående, ikke en part. Målt på test 2026-08-30: begge faggruppe-løse flyter heter
«HMS». **Sett aldri feltet `NOT NULL`** — det ville stoppet HMS-modulen. En flytboks uten
faggruppe må derfor spørre, ikke anta.

## 🟢 STYRENDE: oppgave og sjekkliste er grunnleggende like — to forskjeller (Kenneth 2026-08-19)

> *«Oppgave og sjekkliste skal være grunnleggende lik. Forskjell: sjekkliste kan slettes →
> større behov for logg dersom man trenger å gå tilbake. Oppgave kan ikke slettes etter
> første sending → større behov for å tilføye kommentarer.»*

**Utgangspunktet er likhet.** Ny funksjonalitet på den ene flaten skal som hovedregel finnes
på den andre. Avvik krever begrunnelse i de to forskjellene under — ikke i at «det ble
sånn».

| | Sjekkliste | Oppgave |
|---|---|---|
| **Sletting** | **`draft` \|\| `closed`** (`sjekkliste.ts` slett-mutasjon) | **`draft` \|\| `closed`** (`oppgave.ts` slett-mutasjon) |
| **Følger av det** | **endringsloggen er sikkerhetsnettet** — den må kunne rekonstruere hva som sto | **kommentarer er sikkerhetsnettet** — det som ikke kan slettes, må kunne korrigeres i dialog |

> **Måling + H6-revisjon (2026-08-21):** Begge typer hadde ALLEREDE identisk slettevakt (`draft` || `cancelled`) — sjekkliste var IKKE friere slettbar enn oppgave i koden (doc-drift mot «tillatt»-påstanden over, nå rettet). Lukk-som-slette-port-vedtaket endret begge til `draft` || `closed`: `cancelled` (uoppnåelig, 0 prod-rader) ut, `closed` inn som den slettbare terminalen. Alt annet må Lukkes først (to-stegs sletting: Lukk → papirkurv → 90-dagers angrefrist). Lukk er KUN admin. Se [`flytrettigheter-evaluering-2026-07-26.md § H6-REVISJON`](delplaner/flytrettigheter-evaluering-2026-07-26.md).

**Hvorfor det henger sammen:** et dokument som kan forsvinne, trenger en logg som overlever
det. Et dokument som ikke kan forsvinne, trenger en måte å legge til det som mangler uten å
skrive om historikken.

**Konsekvens for prioritering:**

- **Endringslogg-kvalitet er kritisk for sjekkliste** (lesbarhet, ord-diff, no-op-filtrering
  — levert 2026-08-16/17). For oppgave er den nyttig, men mindre kritisk.
- **Kommentar-/dialogflaten er kritisk for oppgave.** Der er terskelen for «godt nok»
  høyere, fordi feil ikke kan ryddes ved sletting.
- Bygges en av delene på én flate, skal den andre vurderes — men ikke automatisk kopieres.

✅ **Verifisert (2026-08-21):** `sjekkliste.slett` og `oppgave.slett` har IDENTISK statusgate
(begge `draft` || `closed` etter H6-revisjonen; var begge `draft` || `cancelled` før). Sjekkliste
kan altså IKKE slettes i alle statuser — den påstanden var doc-drift. Prinsippet over (endringslogg
kontra kommentar som sikkerhetsnett) står som design-rasjonale, men slette-mekanikken er lik i dag.

### 🔴 TREDJE FORSKJELL, tilkommet 2026-08-29: oppgaven er append-only etter sending

Seksjonen over sier «to forskjeller». Det er ikke lenger sant — **Vedtak B (2026-08-29) innførte
den tredje, og den er den største.** Ført her 2026-09-01 etter måling.

| | Sjekkliste | Oppgave |
|---|---|---|
| **Redigering etter sending** | **Fritt** — ingen append-only-vakt | 🔴 **Låst.** Et felt som har en verdi kan ikke endres. Tomme felt kan fylles av den som har ballen |

**Fire vakter håndhever det i `apps/api/src/routes/oppgave.ts`** (målt 2026-09-01):
metadata `:680` · feltverdier `:741` · oversettelse/manuell overstyring `:951` · og
`beregnLaasteFelter` som klient-speiling (best-effort UI, ikke håndhevelsen).

**Kommentar og vedlegg slipper alltid gjennom** — de ligger i samme feltobjekt, og uendret
`verdi` treffer ikke vakten. Det er hele poenget: *det som ikke kan rettes, må kunne utfylles.*

🔴 **Ett unntak, Kenneth-vedtak samme dag:** `subject` (emne) kan rettes etter sending
(`:674-679`) — det er en merkelapp for gjenfinning, ikke dokumentasjon av utført arbeid.
Endringsloggen viser hvem som gjorde det.

### 🔴 To utbredte misforståelser — begge målt som feil

Begge har vært uttalt av Kenneth etter at koden sa noe annet. De står her fordi de kommer tilbake.

| Påstand | Målt tilstand |
|---|---|
| «Sjekklister slettes av **administrator**, oppgaver kan ikke slettes» | **Slettereglene er identiske.** Begge: `draft` \|\| `closed`. Alt annet må **Lukkes** først, og **Lukk er KUN admin** — så «kun admin kan slette» gjelder *begge*, ikke bare sjekklister |
| «Sendte oppgaver kan **ikke** slettes» | En sendt oppgave må **lukkes** først; en `closed` oppgave **kan** slettes (`oppgave.ts:1941`, Lukk-som-slette-port 2026-08-21). Deretter papirkurv med 90-dagers angrefrist |

🔴 **Konsekvens for brukervendt tekst:** all onboarding, hjelpetekst og mikrotekst som forklarer
forskjellen på sjekkliste og oppgave skal hente fra denne seksjonen — ikke fra hukommelse.
Den ekte forskjellen å lære bort er **append-only**, ikke sletting.

**Kenneth 2026-09-01 om hensikten, som er riktig og skal formidles:** *«Oppgaver er ment til
mindre og konkrete registreringer/oppgaver/arbeidsordre.»* Sjekklisten dokumenterer en kontroll
som er utført; oppgaven bestiller et stykke arbeid og bærer svaret tilbake.

## Arbeidsflyt — Leder/Prosjektleder

### Timer-attestering
1. Mottar dagssedler fra ansatte
2. Kontrollerer timer
3. Kan **flytte timer** mellom prosjekt og ECO/tilleggsarbeid (timer-admin — **ikke bygget ennå**, planlagt som del av attestering-flyten)
4. Attesterer → dagsseddel låses (snapshot tas av pris/lønnsart per A.7)
5. Sender til:
   - **Økonomi** → lønnsutbetaling til ansatt
   - **ProAdm** → kostnad registreres per prosjekt

### Dokumentflyt
1. Sender oppgaver til ansatte
2. Mottar tilbake utfylte oppgaver med bilde og beskrivelse
3. Godkjenner eller returnerer

### Fordeling og oppfølging
4. Tildeler oppgaver/sjekklister via dokumentflyt
5. Følger med på «Hvem har ballen» — hvilke dokumenter venter på handling fra hvilken faggruppe (badge planlagt)
6. Genererer prosjekt-rapporter og månedsrapport (Fase 7)

---

## Arbeidsflyt — Byggherre

Byggherre er en faggruppe i prosjektets dokumentflyt — ikke en SiteDoc-bruker som standard.

### Tilgang
1. Inviteres til prosjektet som ekstern faggruppe-deltaker (`DokumentflytMedlem`)
2. Får tilgang via e-post-invitasjon (`ProjectInvitation`, 7 dagers token)
3. Logger inn via samme NextAuth-flyt som interne brukere — ser kun prosjekter de er invitert til

### Hovedhandlinger
4. **Mottar endringsmeldinger** (Godkjenning-dokumenttype) — tilleggsarbeid, regningsarbeid, varsel om avvik. Modell: `Godkjenning` (Fase 0 A.2 — **modell finnes, UI mangler**)
5. **Godkjenner eller avviser** → status-overgang `sent → approved | rejected`. Snapshot lagres på `DocumentTransfer.kostnadSnapshot` så historikk er låst
6. **Mottar månedsrapport / sluttrapport** (Fase 7) som ferdig PDF

### Begrensninger
- Byggherre ser ikke entreprenørens lønnsarter, internkostnader eller timesnapshot
- Byggherre kan ikke initiere oppgaver — kun godkjenne/avvise det entreprenør sender

---

## Arbeidsflyt — UE (underentreprenør)

UE er ansatt fra et annet firma enn prosjekteier. Eksempel: A.Markussen er prosjekteier (via `ProjectOrganization`), Bravida sender en elektriker som UE.

### Datamodell
1. UE-bruker har `User.organizationId = "Bravida"`, ikke A.Markussen
2. Bruker legges til som `ProjectMember` på prosjektet med `role = "underentreprenor"` (vedtatt, ikke bygget — Fase 0 A.9)
3. Faggruppe-tilknytning via `FaggruppeKobling` (Bravida-faggruppe på prosjektet)

### Hva UE ser
4. Tilgang til oppgaver og sjekklister tildelt deres faggruppe
5. Tegninger og mapper på prosjektet (per gruppe-tilgang)
6. **Egne timer registreres mot UE-firmaets katalog** — Bravida-bruker bruker Bravida-lønnsart, ikke A.Markussens
7. Kan referere ECO på prosjektet (kostnadsbærer er prosjekt-eid, ikke firma-eid)

### Eksport
8. Bravidas attesterte timer eksporteres til Bravidas regnskap (Tripletex/PowerOffice)
9. A.Markussen ser ingen timer eller priser fra Bravida (firma-isolering)

---

## Arbeidsflyt — Firma-admin

### Onboarding av nytt firma
1. Sitedoc_admin oppretter `Organization` + tildeler `User.role = "company_admin"` til kundens kontaktperson
2. Firma-admin logger inn → `/dashbord/firma/innstillinger` for å fylle inn firma-master (org.nr, faktura)
3. Firma-admin aktiverer firmamoduler (Timer, Maskin, Kompetanse) — i dag via `harTimerModul`/`harMaskinModul`-flag, fremtidig via `OrganizationModule`

### Konfigurasjon av firmamoduler
4. **Timer:** Velger Nivå 1 (lovpålagt grunnpakke) eller Nivå 1+2 (med bransje-relevant tilleggspakke), eller starter tom katalog (migrering fra annet system). Konfigurerer lønnsarter, aktiviteter, tillegg
5. **Maskin:** Importerer maskinregister (SmartDok-Excel) eller registrerer manuelt. Vegvesen-API beriker kjøretøy-data
6. **Kompetanse:** Definerer kompetansetyper (sertifikater, kurs, HMS-kort) + importerer ansatt-kompetanse (CSV/Excel)

### Bruker- og avdelings-administrasjon
7. Oppretter avdelinger (firma-intern organisatorisk inndeling)
8. Inviterer ansatte (e-post via Resend), tildeler rolle og avdeling
9. Kobler ansatte til prosjekter (`ProjectMember`)

### Onboarding av nytt prosjekt
10. Oppretter `Project` (manuelt eller via mal-bibliotek)
11. Kobler firma som prosjekteier (`ProjectOrganization` + `Project.primaryOrganizationId`)
12. Aktiverer prosjektmoduler per behov (sjekkliste/oppgave/PSI/3D/økonomi)
13. Konfigurerer faggrupper + dokumentflyt + brukergrupper + lokasjoner + tegninger

---

## Arbeidsflyt — Kontrollplan

### Oppsett
1. Firma-admin (eller prosjekt-admin) henter NS 3420-K-bibliotek-maler eller bygger egen kontrollplan
2. Kobler kontrollpunkter til faggrupper og lovkrav
3. Definerer kontrollmatrise (hvilke punkter gjelder hvilke områder/byggeplasser)

### Daglig bruk
4. Ansatt ser dagens kontrollpunkter i kontrollplan-vyen (filtrert på prosjekt/byggeplass)
5. Fullfører sjekklister koblet til kontrollpunkter
6. Status oppdateres på kontrollplan-matrisen i sanntid

### Avslutning
7. Sluttrapport genereres automatisk (PDF) når alle kontrollpunkter er kvittert ut
8. Byggherre mottar sluttrapport som dokumentasjon

---

## Arbeidsflyt — PSI-gjennomføring

PSI (Prosjektspesifikk Sikkerhetsinstruks) er distinkt fra sjekkliste — det er per-person sikkerhetsopplæring.

1. Bruker (eller besøkende) skanner QR-kode på byggeplassen
2. Leser PSI-innhold (lesetekst, bilder, video)
3. Tar quiz med riktige svar
4. Registrerer HMS-kortnummer (eller velger «har ikke HMS-kort» som gjest)
5. Signerer digitalt → `PsiSignatur` opprettes
6. Tilgang til byggeplassen registreres
7. **Fase 4 (planlagt):** PSI utvides med innsjekk/utsjekk-mekanikk + mannskaps-vy som aggregerer §15-liste-data

---

## Arbeidsflyt — Onboarding av ny ansatt

1. Firma-admin inviterer via e-post (eller bruker importeres via fremtidig HR-import-modul)
2. Ny bruker logger inn via Google/Microsoft OAuth — `User`-rad opprettes
3. `User.canLogin` styrer om brukeren kan logge inn (false = data-mottaker uten innlogging, for eldre arbeidere uten smarttelefon — Fase 0 A.10)
4. Firma-admin tildeler:
   - Avdeling
   - Rolle (`company_admin` eller `user`)
   - Kompetansematrise-rader (sertifikater, HMS-kort med utløpsdato — varsling 90/30/7 dager før utløp)
5. Prosjekt-admin kobler til prosjekt(er) via `ProjectMember` med rolle og kapabilitets-felter (`kanAttestere`, `erFirmaansvarlig`)
6. Pedagogisk onboarding-veileder (planlagt, se [onboarding-veileder.md](onboarding-veileder.md)) — sekvensiell første-gangs-flyt

---

## Dataflyten ut av SiteDoc

```
Attestert dagsseddel (snapshot låst per A.7)
├── → Økonomi (lønnsutbetaling til ansatt — Tripletex/Visma/PowerOffice)
└── → ProAdm (kostnad per prosjekt + ECO-referanse)
        ↓
    ProAdm sender tilbake (1×/døgn pull):
    ECO / Endringsmelding / Underprosjekt-katalog
        ↓
    Entreprenør oppretter Godkjenning-dokument med ECO-referanse
        ↓
    Byggherre godkjenner/avviser i SiteDoc
        ↓
    DocumentTransfer.kostnadSnapshot låser kostnaden
        ↓
    Godkjente endringer eksporteres til ProAdm som vedtatt tilleggsarbeid
```

**Skille mellom timer-eksport og kostnads-eksport:**
- **Timer (lønn):** Alle attesterte timer → ansatts firma sin lønnsutbetaling. Uavhengig av byggherre-godkjenning.
- **Kostnad (faktura):** Timer på prosjekt-grunnkontrakt = del av fastpris (ingen separat fakturering). Timer på ECO = krever byggherre-godkjenning før det blir fakturerbart.

---

## Modul-avhengigheter i dagsseddelen

Dagsseddelen er Timer-modulens kjernedokument, men utvides av andre moduler:

| Modul | Bidrag til dagsseddel | Forutsetning | Status |
|---|---|---|---|
| Timer (basis) | Lønnsart, tillegg, prosjekt/ECO-tilknytning per rad | Alltid tilgjengelig | ✅ Implementert (Fase 3 Runde 1A-2.7) |
| Maskin | `SheetMachine`-tabell, maskin brukt + timer/km | Maskin-modul aktivert (`harMaskinModul=true`) | ✅ Implementert (Runde 2.5/C9) |
| Varelager | Vareforbruk per dagsseddel (planlagt: `SheetMaterial`) | Varelager-modul aktivert | ❌ Ikke bygget (Fase 5) |
| Kompetanse | Validering av maskin-velger mot brukerens sertifikater (DO-kobling) | Maskin-modul + Kompetanse-data + Fase 6 | ❌ Ikke bygget (Fase 6) |

---

## Status på tidligere åpne spørsmål

### ✅ Q1: Kompetansematrise — kobling til dagsseddel?
**Svar:** Ikke implementert. Planlagt som **DO-kobling** (Fase 6 per arkitektur-syntese § 1.2): maskin-velger på dagsseddel valideres mot brukerens `AnsattKompetanse`-rader. Eksempel: bruker uten gyldig CAT 325-sertifikat kan ikke velge maskin merket med dette kravet. Bygges når Maskin + Timer er stabilisert og Kompetansetyper har felt for «kreves for maskinbruk».

### ✅ Q2: Timer-admin — BESLUTTET
Timer-admin (flytte timer prosjekt ↔ ECO) er en **egen attesteringsside for ledelse**
— ikke del av den ansattes dagsseddel-flyt. Leder har dedikert side der de kan:
- Se alle innsendte dagssedler per prosjekt
- Flytte timer-rader mellom prosjekt og ECO
- Attestere (låser via snapshot per A.7)

Side: `/dashbord/[prosjektId]/timer/attestering` (eksisterer delvis — utvides)

### ✅ Q3: Vareforbruk — BESLUTTET
Per dagsseddel. Bygges som `SheetMaterial`-tabell i `db-timer`
(samme cross-package-FK-mønster som `SheetMachine`).

### ✅ Q4: HMS hybrid — BESLUTTET
Hybrid: behold `domain="hms"` på Task/Checklist (datalag) + legg til
`ProjectModule`-rad `slug="hms"` for sidebar-synlighet.

Oppfølger: reconcile [arkitektur-syntese.md](arkitektur-syntese.md) vs [terminologi.md](terminologi.md) i neste screening-runde.

---

## Fremdeles åpne spørsmål

- [ ] Skal byggherre kunne logge inn med eksternt e-post-token (uten Google/Microsoft OAuth)?
- [ ] UE-rolle (`role="underentreprenor"`) — hvilke kapabiliteter skal være satt by-default?
- [ ] Onboarding-veileder pedagogisk lag — på toppen av navigasjon eller separat?

### Steg 1c-beslutninger (lukket 2026-05-03)

- [x] **1c Q1 — Per-prosjekt-toggle:** Auto-sync over alle firmaets prosjekter. Per-prosjekt av/på droppet — ingen kjent bruksmønster, ekstra kompleksitet uten gevinst.
- [x] **1c Q2 — Auto-opprett ved nytt prosjekt:** Application-side hook i `prosjekt.opprett` + `prosjekt.opprettTestprosjekt`. Henter brukerens `organizationId` + `har_*_modul`-flagg, oppretter ProjectModule-rader i samme `$transaction` som ProjectOrganization. Implementert.
- [x] **1c Q3 — `active Boolean`-felt på ProjectModule:** Utsatt til Steg 1d. Krever CI-grep for `projectId_moduleSlug`-callsites + ny composite unique-indeks `(projectId, organizationId, moduleSlug)` — uavhengig av OrganizationModule-overgangen.

---

## Prioritert byggerekkefølge

Vedtatt 2026-05-03. Basert på domene-analyse og arkitektur-avhengigheter.
Ingen steg kan hoppes over — hvert steg er forutsetning for neste.

### Steg 1 — Fundament (må på plass FØR sider bygges)

- [x] **1a. Organization.erKunde-felt** (~2-3t) — DEPLOYET TIL PROD 2026-05-03 (`c91d953c`)
  - Ny Boolean-kolonne `Organization.erKunde` (default false) + migrasjon `20260503000001_add_organization_er_kunde` med backfill
  - Heuristikk for backfill: `erKunde=true` hvis `har_maskin_modul` OR `har_timer_modul` OR finnes `Project.primary_organization_id` OR finnes `Avdeling`. `organization_settings` og `users` droppet som signaler (auto-upsert + testdata-misbruk)
  - Forhåndsverifisert mot test-DB (1 kunde: Byggeleder; 4 skall) og prod-DB (3 kunder: A.Markussen/HRP AS/Kenneths testmiljø; 0 skall)
  - Server: `organisasjon.hentTilgjengelige` filtrerer på `erKunde:true` for sitedoc_admin
  - Klient: `Firma`-type i `firma-kontekst.tsx` utvidet med `erKunde:boolean`

- [x] **1b. Firma-kontekst Lag 1+2+3** (~10-12t) — DEPLOYET TIL PROD 2026-05-03 (`045a49b7`)
  - Lag 1: 9 router-filer (~46 endepunkter) tar organizationId — påkrevd for write, valgfri med fallback for read-only katalog
  - Lag 2: 10 klient-sider sender valgtFirma.id
  - Lag 3: «Firmainnstillinger» → «Eier-firma» (avvik fra plan: «Prosjekteier» kolliderte med eksisterende parent-kategori)

- [x] **1c. OrganizationModule-overgang Fase A+B** (~5t) — DEPLOYET TIL PROD 2026-05-03 (`87fb7292` merge, `d581e399` Fase A+B + `6921ffea` mini-Fase C)
  - Fase A: bakfyll-migrasjon `20260503010000_steg_1c_module_backfill` + moduleGate-helpers utvidet med valgfri `projectId`-param
  - Fase B: auto-sync hooks i `prosjekt.opprett` + `prosjekt.opprettTestprosjekt` + ny `services/firmamodul.ts` + `organisasjon.settFirmamodul`-mutation + timer-onboarding-refaktor + `HovedSidebar` migrert til ProjectModule-sjekk
  - Mini-Fase C (kommentar-rens, 2026-05-03): `har_*_modul`-kolonnene beholdes som firma-master-bryter; full drop til `OrganizationModule`-tabell utsatt til Steg 1e (kreves for at firma uten prosjekter fortsatt kan onboarde lønnsarter — A.Markussen-flow ville brutt med rent ProjectModule-avledet aktivering)

- [x] **1d. ProjectModule final cleanup (forkortet)** (~30min) — DEPLOYET TIL PROD 2026-05-03 (`73dcbd1a` merge, `ec0ce969` impl)
  - Migrasjon `20260503020000_drop_project_module_active`: DROP COLUMN `active`. Verifisert via grep at 0 kode-callsites bruker `ProjectModule.active` (eneste treff er `Project.status`-enum, ulik modell).
  - Schema-rens i `schema.prisma`: `active Boolean`-feltet fjernet, kommentar oppdatert til endelig modell.
  - Cross-org-unique `(projectId, organizationId, moduleSlug)` flyttet til Steg 1e — krever konkret cross-org-design (oversettelse/PSI/kontrollplan har ikke meningsfull cross-org-aktivering, kun timer/maskin har).

- [x] **1e. OrganizationModule-tabell** (~7-9t, tre-faset) — IMPLEMENTERT på develop 2026-05-05
  - **Fase A** (commit `9fda0f81`, deployet til test): tabell opprettet + bakfylt fra `har_*_modul=true`, dual-write fra `settFirmamodul` + `timer/onboarding.aktiverNivaa1`/`aktiverTomKatalog`, callsites uendret. Audit-felter: `aktivert_ved/aktivert_av_user_id/deaktivert_ved/deaktivert_av_user_id` (String? uten `@relation` per A.3-mønster).
  - **Fase B** (commit `978c1bf4`, deployet til test): 47 callsites migrert — 23 server (organisasjon, prosjekt, timer/onboarding, admin, services/timer/moduleGate, services/maskin/moduleGate) + 20 klient (`Firma`-typen fikk `aktiveFirmamoduler: string[]`, alle `harTimerModul`/`harMaskinModul` byttet). Mobil hadde 0 callsites.
  - **Fase C** (test-deploy 2026-05-05): drop `har_timer_modul` + `har_maskin_modul`-kolonner. OrganizationModule eneste sannhetskilde. Dual-write fjernet fra `settFirmamodul` + `timer/onboarding.aktiverNivaa1`/`aktiverTomKatalog`.
  - **Cross-org ProjectModule-unique** utsatt til separat steg (per Kenneths beslutning 2026-05-05) — krever firmamodul-vs-prosjektmodul-distinksjon i schema/runtime.
  - **A.4-overstyring** dokumentert (peker fra `fase-0-beslutninger.md` § A.4 til Steg 1e): A.4 forkastet originalt OrganizationModule-tabell, men firma uten prosjekter må kunne onboarde lønnsarter (A.Markussen-flow) — kan ikke avledes fra ProjectModule alene.
  - **Lukker forutsetningen for Steg 4b (Vareforbruk).**

### Steg 2 — Firma-admin-sider — DEPLOYET TIL PROD 2026-05-03 (`a1463561` merge)

- [x] **2a. Firmainformasjon** — `/dashbord/firma/innstillinger` (navn/org.nr/faktura/EHF). Eksisterende fra før Steg 2 — krysset av uten ny implementasjon.
- [x] **2b. Firmamodul-styring** — `/dashbord/firma/moduler` (`25cd7675`). Skalerbar konfig-tabell med 5 moduler (timer + maskin tilgjengelig; kompetanse/fremdrift/varelager «kommer snart»). Bruker `organisasjon.settFirmamodul` fra Steg 1c. Aktivering = direkte mutation, deaktivering = bekreftelses-modal.
- [x] **2c. OrganizationSetting-UI** (`71b369dc`). Utvider `/dashbord/firma/innstillinger` med Tidssone-seksjon + 3 generiske `TilgangPolicySeksjon`-instanser (timer/vareforbruk/maskinbruk).
- [x] **2d. Prosjekt → nytt prosjekt fra firma-kontekst** (`75c14a29`). Server tar valgfri `organizationId` + autoriserer. Setter `Project.primaryOrganizationId` (også fikset i `opprettTestprosjekt`). Klient sender `valgtFirma?.id` + info-banner for sitedoc_admin. Slettet orphan-duplikat `prosjekter/nytt`.

### Steg 3 — Maskin-import — DEPLOYET TIL PROD 2026-05-03 (`33a2b9b4` merge)

- [x] **3a. Koble import til FirmaVelger + erKunde-filter** (`e7ddc397`). Server: ny `krevErKundeFirma`-helper i `tilgangskontroll.ts` (FORBIDDEN hvis `Organization.erKunde=false`). Brukt i `maskin/import.ts` slik at både `importerForhandsvisning` og `importerBekreft` blokkerer skall-firma. Klient: tom-state for sitedoc_admin uten valgt firma.
- [x] **3b. Fil-upload UI klikkbar drag-and-drop** (`e7ddc397`). Drag-and-drop med `onDragOver`/`onDragLeave`/`onDrop`. Visuell feedback: border + bg-farge + ikon-farge endres ved drag-over. Klikk-funksjonalitet beholdt via label/input-mønster.
- [x] **3c. A.Markussen-maskinimport gjennomført på prod** (2026-05-03). Kenneth utførte importen via UI som sitedoc_admin med A.Markussen valgt i FirmaVelger. Resultat: 124 Equipment-rader (36 kjøretøy + 50 anleggsmaskin + 38 småutstyr), 36 med registreringsnummer, 11 leide (9XXX-internnummer). Vegvesen-kø: 36 ventende-rader med prioritet=200 (lav, plukkes opp via 60s-polling). Worker-progress umiddelbart etter import: 2 fullført + 34 ventende.

### Steg 4 — Dagsseddel-utvidelser

- [x] **4a. Timer-admin** — ECO-flytt på attestering (egen leder-detaljside) — DEPLOYET TIL PROD 2026-05-03 (`da6b34a5` merge, `f98fa7a5` impl). Scope avklart 2026-05-03: kun ECO-flytt på samme prosjekt (cross-prosjekt-flytt forkastet — for komplekst, ikke dokumentert bruksbehov). Ny `flyttTimerRadEco`-mutation gates med `krevProsjektLeder`, kun status="sent" tillates, ECO-validering (samme firma+prosjekt, status=aktiv, timerregistreringApen=true). Ny `hentForAttestering`-query autoriserer på leder-rolle (skiller seg fra `hentMedId` som krever eierskap). Activity-log (best-effort) for hver flytt. Ny side `/dashbord/[prosjektId]/timer/attestering/[id]` med inline ECO-velger på timer-rader, øvrige felter read-only, action-bar med Returner/Attester. Lærdom: manuell deploy var nødvendig — ingen auto-deploy/hook finnes (CLAUDE.md § Deploy-triggere).
- [ ] **4b. Vareforbruk** — Vare-katalog + Vareforbruk-tabell. **UTSATT til etter Steg 1e (OrganizationModule)** — varelager-modul-aktivering blir mer meningsfull når `Organization.har_*_modul`-kolonner er erstattet med dedikert tabell. Beslutning 2026-05-03.
- [ ] **4c. Godkjenning UI** — byggherre-flyt (modell finnes fra Fase 0 § E.12, UI mangler). Avklart 2026-05-03: byggherre logger inn via Google/Microsoft OAuth som i dag (e-post-token utsatt), sidebar-gating på faggruppe-rolle (`DokumentflytMedlem.rolle`), ikke ny kapabilitet.

### Admin-navigasjon-tiltak (parallell stripe)

Tiltak fra [admin-navigasjon-analyse-2026-05-03.md](admin-navigasjon-analyse-2026-05-03.md) — håndteres parallelt med Steg 1-4 etter behov. Tiltak-rekkefølgen i analysen var: Bakfyll → P1 Fase 1 → P2 → P3 → P1 Fase 2 → P4+P5.

- [x] **Blokk B — Klikkbare prosjektrader på `/dashbord/firma/prosjekter`** (quick-win) — DEPLOYET TIL PROD 2026-05-04 (`dbf78bca` merge, `59338895` impl). Hele tabellraden navigerer til `/dashbord/[id]`; `<Link>` på navnet beholdt for cmd/ctrl+click. 1 fil endret (7 linjer).
- [x] **Blokk A — P1 Fase 1: prosjektliste filtreres på valgt firma** — DEPLOYET TIL PROD 2026-05-04 (`12717426` merge, `51d5e3ee` impl). Server: `prosjekt.hentMine`+`hentAlle` tar valgfri `organizationId`. Klient: 4 callsites migrert. Tom-state for sitedoc_admin med valgt firma og 0 prosjekter får firmaspesifikk tekst. Bakfyll test-DB: 2 prosjekter satt til Byggeleder. 1 ny i18n-nøkkel.
- [x] **Blokk C — P2: admin/firmaer erKunde-filter + Timer-kolonne** — DEPLOYET TIL PROD 2026-05-04 (`e2729849` merge, `261a0c8e` impl). Server-side `where: { erKunde: true }` på `admin.hentAlleOrganisasjoner`. Skall-firmaer (Byggherre, Tømrer Hansen, Elektrikker Hansen, Hovedentreprenør) skjult fra admin-vyen. Ny Timer-kolonne mellom Integrasjoner og Maskin (Clock-ikon, Ja/Nei-badge). Slide-over: Timer-modul-status før Maskin-modul-status.
- [ ] **P3 — Rename «Byggeleder» i test-DB** (5 min). Avventer beslutning på nytt navn.
- [x] **P1 Fase 2 — Auto-reset av aktivt prosjekt ved firma-bytte** — IMPLEMENTERT på develop 2026-05-05. `useEffect` i `prosjekt-kontekst.tsx` lytter på `valgtFirma`/`valgtProsjekt` og resetter localStorage + redirect til `/dashbord` når `valgtProsjekt.primaryOrganizationId !== valgtFirma.id`. Standalone-prosjekt (primaryOrganizationId=null) regnes som mismatch — konsistent med Blokk A. `Prosjekt`-interface utvidet med `primaryOrganizationId: string | null`. Test-deploy er manuell (ingen cron/auto-deploy finnes — CLAUDE.md § Deploy-triggere).
- [ ] **P4+P5 — Admin-navigasjon redesign + abonnement-modell** (~1-2 dager). Egen design-runde. Krever beslutning på abonnement-statuser, fakturaoversikt, drill-down firma → prosjekter → moduler.

**Status etter Blokk A+B+C + P1 Fase 2 (2026-05-04/05):** P1+P2 fullt lukket. Sitedoc_admin med valgt firma ser kun det firmaets prosjekter overalt; admin/firmaer-listen viser kun reelle kunde-firmaer; Timer-modul synlig på linje med Maskin; konflikt mellom valgt firma og aktivt prosjekt løses automatisk via reset+redirect. Gjenstår: kosmetisk rename (P3) og større designrunder (P4+P5) som ikke blokkerer kundevisning.

---

## Koblinger til tekniske dokumenter

| Arbeidsflyt-element | Teknisk dokument |
|---|---|
| Dagsseddel | [dagsseddel-design.md](dagsseddel-design.md) |
| Maskin-kobling | [maskin.md](maskin.md) |
| Mannskap-vy + PSI-utvidelser (Fase 4) | [mannskap.md](mannskap.md) |
| Kompetansematrise (kjerne, Fase 0.5 KOMPLETT) | Implementert i `packages/db` (`Kompetansetype` + `AnsattKompetanse`) — egen detalj-fil mangler |
| Timer-katalog (lønnsart/tillegg/aktivitet) | [timer.md](timer.md) |
| Dokumentflyt (oppgave/sjekkliste) | [dokumentflyt.md](dokumentflyt.md) |
| Godkjenning (byggherre-flyt) | [fase-0-beslutninger.md § A.2](fase-0-beslutninger.md) — modell finnes, UI mangler |
| ECO / Endringsmelding (Underprosjekt) | [fase-0-beslutninger.md § E.11](fase-0-beslutninger.md) |
| ProAdm-integrasjon | [okonomi.md](okonomi.md) |
| Kontrollplan + sluttrapport | [kontrollplan.md](kontrollplan.md) |
| PSI-gjennomføring | [terminologi.md § 8](terminologi.md) |
| HMS-kort + utløpsvarsel | [varsling.md](varsling.md) |
| Onboarding-pedagogikk | [onboarding-veileder.md](onboarding-veileder.md) |
| Prosjekt-oppsett-flyt | [prosjektoppsett-veileder.md](prosjektoppsett-veileder.md) |
| Navigasjons-struktur (innstillingssider) | [navigasjon-arkitektur-analyse-2026-05-03.md](navigasjon-arkitektur-analyse-2026-05-03.md) |
| Helhetlig produktarkitektur | [arkitektur-syntese.md](arkitektur-syntese.md) |
| Tre-nivå-anker (Firma → Firmaadmin → Prosjekter) | [terminologi.md § 0](terminologi.md) |
