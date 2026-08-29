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
