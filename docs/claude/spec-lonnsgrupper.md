---
name: spec-lonnsgrupper
description: 🟡 SPEC, ikke bygget — lønnsgrupper i Timer. Firmaet lager egne grupper, hvert firma har standardgruppa «Ordinær», den ansatte står alltid i én, og lønnsart/tillegg/utleggskategori kan merkes «Gjelder lønnsgrupper». Styrer valg og forslag, også overtid.
sist_verifisert_mot_kode: 2026-11-26
---

# Spec: lønnsgrupper (Timer)

🟡 **Spec — ingenting er bygget.** Skrevet av Fabel 2026-11-26. Målt mot `origin/develop` @ `2fc26af9`.
Alt under «I dag» har `fil:linje`. Alt under «Foreslått» er forslag til Kenneth svarer nederst.

> **FASIT (Kenneth 2026-11-26):**
> - «har du sett at noe er merket lærling? vi må faktisk skille ut lønnsarter som lærlinger er tilknyttet»
> - «Hvert firma lager egne grupper.»
> - «lønnsgruppe- må styre hvilke timerader den enkelte har tilgang på. Hvis lønnsgruppe ikke er valgt, gjelder den for alle. F.eks nattilegg, smusstillegg med mere»
> - «fungerer noe på test -> så deployes til produksjon -> da forventer jeg at dette fungerer på produksjon, selv om det er annet firma»
>
> **TILLEGG 1 (Kenneth 2026-11-26):** «Ved registrering av ansatt må den enkelte som standard få ordinær gruppe. Vi må tilføye lønnsgruppe ved oppretting av ansatte hvis vi ikke har det»

## 1 · I dag (målt)

### Katalogene

| Katalog | Modell | Gruppe- eller lærlingfelt |
|---|---|---|
| Lønnsart | `Lonnsart`, `packages/db-timer/prisma/schema.prisma:22-58` | nei |
| Tillegg | `Tillegg`, samme fil `:88-110` | nei |
| Utleggskategori | `ExpenseCategory`, samme fil `:116-147` | nei |
| Aktivitet | `Aktivitet`, samme fil `:63-82` | nei |

- **Alle i firmaet får samme liste.** `timer.lonnsart.list` filtrerer bare på firma og `aktiv`
  (`apps/api/src/routes/timer/lonnsart.ts:20-40`). Samme mønster i `tillegg.ts:17` og `expenseCategory.ts:37`.
- **Den ansatte har ingen Timer-egenskap.** `OrganizationMember` (`packages/db/prisma/schema.prisma:248-289`)
  har `ansattRolle`, `avdelingId` og `prosjektTilgang` — ingenting om lønn. `db-timer` har ingen tabell pr. ansatt.
- **Serveren sjekker bare at lønnsarten er firmaets** når en rad lagres
  (`apps/api/src/routes/timer/dagsseddel.ts:5387`). Den sjekker ikke hvem raden gjelder.

### Lærling finnes bare som navn

- **A.Markussen-katalogen:** 172 «OT lærling 50%», 177 «OT lærling 100%», 142 «Skifttillegg lærling 30%»
  (`apps/api/src/services/katalog/fixtures/a-markussen.json:18-20`). 170/175 «Overtid 50%/100%» står på `:16-17`.
  Fila har ikke feltet `overtidsnivaa` på noen art.
- **Standardpakken (nivå 2) har også lærlingarter:** «Lærlingelønn (30–75% av fagarbeider)», «Overtid lærling 50%»,
  «Overtid lærling 100%» (`apps/api/src/services/seed/index.ts:134-136`). Lærling gjelder altså ikke bare A.Markussen.
- **Samme katalog viser flere skiller enn lærling:** ti fraværsarter er delt på «Fastlønn» og «Timelønn»
  (`a-markussen.json:22-35`), og det finnes «Timer prosjektleder» (109), «Timer innleid arbeidskraft» (129) og
  «Praksistimer» (128).

### Overtid

- `velgOvertidLonnsart` tar første aktive ordinære art med riktig nivå etter `rekkefolge`, uansett ansatt
  (`packages/shared/src/utils/lonnsregel.ts:114-125`).
- **Lærlingartene holdes i dag utenfor ved å stå uten nivå.** Det står i koden (`lonnsregel.ts:110-111`) og i
  `timer.md:372`. Følgen er at en lærling aldri får overtidsforslag på sin egen art — og at en lærlingart som får
  nivå, kan bli valgt for alle.
- `foreslaOvertidSplitt` gir tom liste uten å si hvorfor: norm mangler (`overtidForslag.ts:82`), ingen overtid
  (`:115`) eller ingen overtidsart (`:117`). Kalleren kan ikke skille de tre.
- **Serveren regner overtid selv** med samme regel (`regnJobbTid`, `dagsseddel.ts:2935-2949`, kalt `:3169` og
  `:6131`). Uten overtidsart blir det én linje på normalarten, uten melding (`packages/shared/src/utils/jobbTid.ts:125`).
- **Varsel i dag:** mobilen viser «Overtid ikke ført automatisk» (`apps/mobile/app/timer/[id].tsx:573-577`, `:1244`),
  men bare på automatisk laget seddel, og sjekken gjelder hele firmaet (`timerKatalog.ts:268`). Weben har ingen
  melding. Firmaadmin får ingen.

### Andre automatiske valg

| Forslag | I dag | Kilde |
|---|---|---|
| Standard lønnsart på ny rad | én pr. firma (`erStandardvalg`) | `schema.prisma:36-39`, `nyTimerRad.ts:78`, `dagsseddel.ts:3316` |
| Reise | én art pr. firma, eller pr. avstandsbånd | `packages/db/prisma/schema.prisma:481`, `:527-538` |
| Natt, smuss, skift | **finnes ikke som automatisk forslag.** Bare navn i standardpakken | `seed/index.ts:127`, `:132`, `:218` |

### Hvor valgene gjøres

- **Web:** katalogene hentes med 18 kall i 8 filer utenom firmaadmin, bl.a. `apps/web/src/app/dashbord/timer/[id]/page.tsx`
  (lønnsart `:351`, `:3548`, `:3727`, `:4240`; tillegg `:3948`, `:5963`, `:6414`; utlegg `:6295`, `:6415`, `:6624`),
  `components/timer/RedigerTimerRad.tsx:36`, `RedigerTilleggRad.tsx:30` og attesteringen
  (`AttesteringTabell.tsx:268`, `DagsKort.tsx:41-43`, `RedigerRadModal.tsx:234`).
- **Mobil:** ett sted. Katalogene hentes samlet og legges i lokal database (`apps/mobile/src/services/timerKatalog.ts:75-81`,
  tabellene `lonnsart_local`, `tillegg_local`, `expense_category_local` i `apps/mobile/src/db/schema.ts:416`, `:506`, `:389`).
  Det er dette som gjør valget mulig uten nett.
- **Firmaadmin:** `firma/timer/lonnsarter`, `tillegg`, `utleggskategorier` og `firma/ansatte` (rediger-vinduet har
  stilling og avdeling, `apps/web/src/app/dashbord/firma/ansatte/page.tsx:700`, `:722`).

### Hvordan en ansatt blir til (TILLEGG 1)

En ansatt er en rad i `OrganizationMember`. Firmatilhørighet leses bare derfra
(`hentBrukersOrg`, `apps/api/src/trpc/tilgangskontroll.ts:293-307`). Raden skrives fire steder i API-et:

| Nr. | Vei | Server | Skjerm | Lønnsgruppe-felt i dag |
|---|---|---|---|---|
| V1 | Firmaadmin legger til ansatt | `organisasjon.inviterBruker`, `apps/api/src/routes/organisasjon.ts:848` — ny bruker `:931`, bruker uten firma tas inn `:899` | `firma/ansatte`, `InviterModal` (`apps/web/src/app/dashbord/firma/ansatte/page.tsx:301`, kall `:319`) | nei |
| V2 | Kontakt legges til i et prosjekt | `medlem.registrer`, `apps/api/src/routes/medlem.ts:379`. Er den som legger til ikke prosjektadmin, settes firmaet til hens eget (`:250-262`), og personen blir ansatt der | tre steder i prosjektoppsettet: `OpprettKontaktModal.tsx:157`, `dokumentflyt-komponenter.tsx:335`, `PersonKort.tsx:490` | nei |
| V3 | Firmabytte («feilregistrering») | `medlem.endreFirma`, `medlem.ts:844` — ny rad i til-firmaet | `oppsett/brukere`, `PersonKort.tsx:152` | nei |
| V4 | Reaktivering | `organisasjon.settAnsattStatus`, `organisasjon.ts:651` — raden finnes fra før | `firma/ansatte` | nei |

- **Import av ansatte finnes ikke.** Null treff på import av ansatte i `apps` og `packages`.
- **Katalogimporten lager ikke ansatte.** `apps/api/src/services/katalog/` skriver verken bruker eller firmamedlem.
- **Invitasjon på e-post lager bare en bruker**, ikke en ansettelse (`apps/api/src/routes/mobilAuth.ts:293-313`).
- **Mobilen oppretter ikke ansatte.** Null kall til de tre rutene i `apps/mobile`.
- **Utenom API-et:** testdata og skript skriver raden direkte (`packages/db/prisma/seed-helpers.ts:49`,
  `packages/db/scripts/seed-timer-demo.ts:309`, `:323`, `packages/db/scripts/backfill-organization-members.ts:31`).
- **Raden ligger i `packages/db`, gruppa i `packages/db-timer`.** De har hver sin Prisma-klient
  (`packages/db-timer/prisma/schema.prisma:2-3`), så de to skrivingene kan ikke stå i samme transaksjon.

## 2 · Foreslått datamodell

Alt nytt ligger i `packages/db-timer` (postgres-skjema `timer`). Regelen er at firmamodulers tabeller aldri skal
inn i `packages/db` (`arkitektur.md:426-428`). Den ansatte pekes på med svak nøkkel `userId`, som `DailySheet.userId`
gjør i dag (`packages/db-timer/prisma/schema.prisma:157`).

| Ny tabell | Innhold | Garanti |
|---|---|---|
| `Lonnsgruppe` | `organizationId`, `navn`, `aktiv`, `rekkefolge`, `erStandard`, `standardLonnsartId?` | unik (`organizationId`, `navn`). Nøyaktig én `erStandard` pr. firma (delvis unik indeks i migreringen) |
| `AnsattLonnsgruppe` | `organizationId`, `userId`, `lonnsgruppeId`, `sattAvUserId`, `sattVed` | unik (`organizationId`, `userId`) — én gruppe pr. ansatt pr. firma. Raden finnes alltid |
| `LonnsartLonnsgruppe` | `lonnsartId`, `lonnsgruppeId` | sammensatt nøkkel, ekte fremmednøkler |
| `TilleggLonnsgruppe` | `tilleggId`, `lonnsgruppeId` | som over |
| `ExpenseCategoryLonnsgruppe` | `expenseCategoryId`, `lonnsgruppeId` | som over |

- **Tomt betyr alle — på lønnsarten, ikke på den ansatte.** En lønnsart uten rader i `LonnsartLonnsgruppe` gjelder
  alle. Det er Kenneths regel, ikke en tilstand som må fylles. Ingenting endrer seg i velgerne før firmaadmin merker noe.
- **Standardgruppa «Ordinær» (TILLEGG 1).** Hvert firma har alltid én gruppe med `erStandard`. Den lages med navnet
  «Ordinær». Firmaet kan gi den nytt navn. Den kan ikke slettes og ikke slås av. Navnet er firmaets data, som
  lønnsartnavn, og oversettes ikke.
- **En ansatt er aldri uten gruppe.** Alle veiene V1–V3 kaller én ny serverfunksjon, `sikreAnsattLonnsgruppe`, rett
  etter at firmamedlemmet er lagret. Uten oppgitt gruppe setter den firmaets standardgruppe. Funksjonen lager
  standardgruppa hvis firmaet mangler den, så den virker også for firma som er opprettet etter migreringen
  (`admin.ts:423`, `organisasjon.ts:257`) og for testdata.
- **Vern mot hullet mellom de to databaseklientene:** mangler raden likevel når den ansattes gruppe slås opp, setter
  serveren standardgruppa der og da. Ingen kode skal behandle «ingen gruppe» som en gyldig tilstand.
- **Reaktivering (V4) rører ikke gruppa.** Raden står fra før.
- **En gruppe med ansatte kan ikke slås av.** Firmaadmin flytter de ansatte først; vinduet tilbyr «Flytt alle til Ordinær».
- **Grupper slettes ikke, de slås av** — som lønnsarter (`lonnsart.ts:235`). Fremmednøklene er `Restrict`. Ellers
  ville en slettet gruppe gjort lærlingartene synlige for alle.
- **Aktivitet og maskin får ikke «Gjelder».** Aktivitet er kostnadsdimensjon og maskin er utstyr; ingen av dem er lønn.
- **Regelen «stille tomhet er forbudt»** (`arkitektur.md` § Schema- og migreringsregler) krever test som feiler når en
  kobling er tom. Her er tom en lovlig verdi. Testen blir derfor todelt: uten koblinger er utvalget likt dagens, og
  med kobling er arten borte for alle utenfor gruppa.

## 3 · Hva gruppa styrer

### Regelen — ett sted

Én ny fil i `@sitedoc/shared`: `utils/lonnsgruppe.ts`. Server, web og mobil bruker samme funksjoner.

1. **Gjelder raden den ansatte?** Ja når raden ikke har noen gruppe, eller når den ansattes gruppe er blant dem.
2. **Alle ansatte har en gruppe** (§ 2). En art merket bare «Lærling» er skjult for alle i «Ordinær», og en art
   merket bare «Ordinær» er skjult for lærlingen.
3. **Det er eieren av dagsseddelen som teller**, ikke den som er logget inn. En leder som retter i attesteringen,
   får den ansattes utvalg.
4. **En lagret rad vises alltid med sin art**, også når arten ikke lenger gjelder den ansatte. Samme grep finnes for
   reise (`apps/web/src/components/attestering/RegistreringPanel.tsx:97`).

Serveren sender hele katalogen med gruppene på hver rad, og den ansattes gruppe ved siden av. Klienten filtrerer.
Da virker det uten nett på mobil, og gamle rader får navnet sitt selv om arten er skjult i velgeren.

### Valg på web og mobil

| Sted | Endring |
|---|---|
| Lønnsart-, tillegg- og utleggsvelgere (web 18 kall i 8 filer, mobil fra lokal katalog) | viser bare det som gjelder seddelens eier |
| Mobil uten nett | lokal katalog får gruppene og egen gruppe i samme henting (`timerKatalog.ts:75-81`) |
| Lagring på server | se beslutning B5 |

### Automatiske forslag

| Forslag | Regel |
|---|---|
| Overtid | § 4 |
| Standard lønnsart på ny rad | gruppas egen standard (`standardLonnsartId`) → firmaets standard hvis den gjelder den ansatte → ellers ingen forhåndsvalg, og feltet er tomt og påkrevd |
| Reise | firmaets reiseoppsett står som i dag. Gjelder reisearten ikke den ansatte, vises melding i stedet for at reisen føres på en art hen ikke har |
| Natt, smuss, skift | ingen automatikk finnes. Gruppa styrer bare om tillegget kan velges |

### Eksisterende rader

**Ingenting i historikken endres.** En rad peker på lønnsarten med id (`SheetTimer.lonnsartId`), og verken bytte av
gruppe eller endring av «Gjelder» rører lagrede rader, attestering eller eksport. Endringen virker på neste valg og
neste forslag.

## 4 · Overtid

**Ny regel i `velgOvertidLonnsart`** (tar den ansattes gruppe som tredje argument):

1. Kandidater: aktive ordinære arter med riktig nivå som gjelder den ansatte.
2. Arter som navngir gruppa, går foran arter som gjelder alle. Deretter `rekkefolge`.
3. Ingen kandidat → `null`, og kalleren får vite hvorfor.

**Eksempel, A.Markussen etter oppsett:**

| Art | Nivå | Gjelder | Lærling får | Andre får |
|---|---|---|---|---|
| 170 Overtid 50% | 50 | alle | — | ✅ |
| 172 OT lærling 50% | 50 | Lærling | ✅ | skjult |
| 175 Overtid 100% | 100 | alle | — | ✅ |
| 177 OT lærling 100% | 100 | Lærling | ✅ | skjult |

Lærlingen ser fortsatt 170 i velgeren, fordi den gjelder alle. Vil firmaet skjule den, merkes 170 med «Ordinær»
(og senere grupper som skal ha den).

**Dette erstatter «lærlingartene holdes uten nivå».** `timer.md:372` og kommentaren i `lonnsregel.ts:110-111`
rettes i samme ordre som regelen.

**Ingen stille tomhet.** `foreslaOvertidSplitt` skal skille «ingen overtid» fra «overtid, men ingen art»:

| Hvem | Hvor | Tekst (forslag) |
|---|---|---|
| Arbeider | web timeføring og mobil, både automatisk og manuell føring | «Overtid er ikke foreslått. Firmaet har ingen lønnsart for overtid 50 % som gjelder deg. Før overtiden selv, og si fra til firmaadmin.» |
| Firmaadmin | varsellinje på `firma/timer` og `firma/timer/lonnsarter`, med lenke til lønnsartene | «Lønnsgruppe Lærling mangler lønnsart for overtid 50 %.» / «Firmaet mangler lønnsart for overtid 50 %.» |

Mønsteret med varsellinje og lenke finnes for standard lønnsart
(`apps/web/src/app/dashbord/firma/innstillinger/page.tsx:1604-1609`). Varselet til firmaadmin regnes fra katalogen,
så det vises før noen har ført en time.

## 5 · Oppsett for firmaadmin

**Én ny side: `firma/timer/lonnsgrupper`.** Alt gjøres der.

1. «Ny gruppe» → navn → lagre.
2. Gruppa åpnes med tre avkryssingslister: **ansatte**, **lønnsarter**, **tillegg og utleggskategorier**. Ett kryss = én kobling.
3. Øverst på siden: varsellinjene fra § 4.

Lista har alltid «Ordinær» øverst, merket «Standard». Den har «Gi nytt navn», men ikke «Slå av».

**Oppretting av ansatt (TILLEGG 1):**

| Vei | Skjerm | Felt |
|---|---|---|
| V1 | «Legg til ansatt» på `firma/ansatte` | Nedtrekket «Lønnsgruppe» med firmaets aktive grupper, forhåndsvalgt «Ordinær». Ingen ekstra klikk når standarden passer |
| V2 | Kontakt i prosjektoppsettet | Se beslutning B10. Forslag: ikke noe felt; serveren setter «Ordinær» |
| V3 | Firmabytte | Ikke noe felt. Gruppene er firmaets egne, så den gamle gruppa kan ikke følge med. Serveren setter til-firmaets «Ordinær» |

I tillegg, uten ny side:

- Rediger-vinduet for ansatt får det samme nedtrekket «Lønnsgruppe» under avdeling. Det kan ikke stå tomt.
- Nedtrekket vises bare når firmaet har Timer, i begge vinduene. Raden settes uansett, så alle har «Ordinær» den dagen
  Timer slås på.
- Rediger-vinduene for lønnsart, tillegg og utleggskategori får «Gjelder lønnsgrupper». Tomt vises som «Alle».
- Listene får en kolonne som viser gruppene.

**Standard for katalogfirma (A.Markussen):** «Ordinær» finnes fra migreringen. Katalogfila får i tillegg gruppa
«Lærling», og 172/177/142 merkes med den.
172 får nivå 50 og 177 nivå 100. 170/175 får nivå 50/100 i fila, så et annet miljø får det samme som prod.
Importen (`apps/api/src/services/katalog/importerKatalog.ts`) må lære feltene. Hvem som er lærling, vet ikke
katalogen — det krysser firmaadmin av. **Rekkefølgen betyr noe:** fra importen har merket artene til lærlingene er
flyttet til «Lærling», kan ingen velge 172/177/142. Siden viser derfor varsellinja «Lønnsgruppe Lærling har ingen
ansatte» med lenke, og L6 kjøres samme dag som firmaadmin flytter lærlingene.

**Andre firma** har «Ordinær» og lager resten selv («Hvert firma lager egne grupper»). Standardpakken oppretter
ingen flere grupper.

## 6 · Beslutningspunkter

| Nr. | Spørsmål | Skjerm i dag | Ved ja | Ved nei |
|---|---|---|---|---|
| **B1** | Én lønnsgruppe pr. ansatt? | Ansatt har ingen gruppe | Ett nedtrekk på den ansatte. En art som gjelder flere, merkes med flere grupper | Flervalg på den ansatte. Overtid må da ha en regel for hvilken gruppe som vinner |
| **B2** | *Utgår — avgjort av TILLEGG 1.* Ingen ansatt er uten gruppe; alle står i «Ordinær» til de flyttes | — | — | — |
| **B3** | Egen gruppe foran «alle» ved overtid? | Første art etter rekkefølge | Lærling får 172, andre får 170, uten at 170 må merkes | Firmaadmin må merke 170 med «Ordinær» og hver ny gruppe som skal ha den |
| **B4** | Lederen får den ansattes utvalg i attesteringen? | Lederen ser alle arter | Lederen kan ikke føre en fagarbeider på lærlingart ved et uhell. Er gruppa feil, rettes den på den ansatte | Lederen ser alt og kan velge fritt |
| **B5** | Serveren avviser en rad med art utenfor gruppa? | Serveren sjekker bare firma | Feilføring er umulig. En telefon som ikke er oppdatert, eller har ført uten nett før gruppa ble satt, får raden avvist ved synk | Raden lagres og får merket «utenfor lønnsgruppe» i attesteringen. Attestanten retter |
| **B6** | Gruppebytte gjelder fra nå, uten fra-dato? | — | Ett felt. Retter man en gammel dag etter at lærlingen er blitt fagarbeider, tilbys fagarbeiderens arter. Lagrede rader står | Perioder med fra-dato, som oppmøtested (`OppmotePeriode`). Flere felt, og velgeren må slå opp gruppa pr. dato |
| **B7** | Standard lønnsart pr. gruppe? | Én pr. firma | Prosjektleder kan få 109 «Timer prosjektleder» forhåndsvalgt, lærling sin egen | Alle får firmaets standard. Gjelder den ikke gruppa, er feltet tomt |
| **B8** | A.Markussen: bare «Lærling» i katalogen nå, i tillegg til «Ordinær»? | Ingen grupper | To grupper, tre arter merket «Lærling». Fastlønn/timelønn, prosjektleder og innleid lager firmaet selv | Katalogen får også disse gruppene, og ti fraværsarter merkes |
| **B9** | Standardgruppa «Ordinær» finnes alltid, kan gis nytt navn, kan ikke slettes eller slås av? (TILLEGG 1 punkt 1) | `firma/timer` har ingen side for grupper | Siden `firma/timer/lonnsgrupper` viser «Ordinær — Standard» fra første dag, i alle firma. Raden har «Gi nytt navn», ikke «Slå av» | Firmaet lager første gruppe selv. Fram til da har ingen ansatt gruppe — i strid med TILLEGG 1 |
| **B10** | Lønnsgruppe-feltet bare i «Legg til ansatt» (V1); V2 og V3 setter «Ordinær» uten å spørre? (punkt 2) | Ingen av vinduene har feltet | «Legg til ansatt» får ett nedtrekk, forhåndsvalgt «Ordinær». Kontaktvinduene i prosjektoppsettet og firmabyttet er som i dag. En lærling lagt til fra prosjektet står som «Ordinær» til firmaadmin flytter hen | Kontaktvinduene i prosjektoppsettet får også nedtrekket. Det vises da for en firmaansvarlig som ikke er firmaadmin, i et vindu som handler om prosjektet |
| **B11** | Alle eksisterende ansatte settes til «Ordinær» i migreringen? (punkt 3) | Ingen har gruppe | Alle ansatte, også deaktiverte, står som «Ordinær» etter migreringen. Ingen velger endrer seg. Lærlingene flyttes for hånd etterpå | Ingen etterfylling: ansatte er uten gruppe til firmaadmin har gått gjennom lista — i strid med TILLEGG 1 |

**Anbefalt:** ja på alle (B2 utgår), unntatt **B5: nei** (merk, ikke avvis — telefonen må virke uten nett, og attestanten ser raden uansett).

## 7 · Leveranserekkefølge

| Ordre | Innhold | Migrering | Avhenger av |
|---|---|---|---|
| **L1 — server** | Tabellene i § 2. Ruter `timer.lonnsgruppe` (list, opprett, gi nytt navn, slå av, sett ansatt, sett «Gjelder»). `sikreAnsattLonnsgruppe` kalt fra V1–V3 og fra testdata-skriptene; `inviterBruker` tar valgfri `lonnsgruppeId`. Katalogsvarene får gruppene. Seddelsvarene får eierens gruppe. `utils/lonnsgruppe.ts` med tester. Ingen velger endrer seg så lenge ingen art er merket | **ja** — se «Migreringen» under | — |
| **L2 — delt regel og server-overtid** | `velgOvertidLonnsart` med gruppe, `foreslaOvertidSplitt` med årsak, `regnJobbTid` på server, standard lønnsart pr. gruppe. `timer.md:372` rettes | nei | L1 |
| **L3 — web firmaadmin** | Siden `firma/timer/lonnsgrupper`, nedtrekket i «Legg til ansatt» og i rediger-vinduet, feltene i lønnsart-, tillegg- og utleggsvinduene, varsellinjene, hjelpetekst | nei | L1, L2 |
| **L4 — web timeføring og attestering** | Filtrering i de 18 kallene (8 filer), meldingen til arbeider, merket fra B5 | nei | L2 |
| **L5 — mobil** | Lokal katalog får gruppene, filtrering, forslagene (`dagsforslag.ts:855`, `:1903`, `linjeLonnsart.ts:155`, `nyTimerRad.ts:78`), varselet for både automatisk og manuell føring | nei på server. Lokal SQLite får nye kolonner | L2 |
| **L6 — katalog** | A.Markussen-fila og importen. Kjøres i prod av Kenneth | nei (data, ikke skjema) | L1, L3 |

L3 kan gå parallelt med L4 og L5. L6 sist, slik at siden finnes når lærlingene skal krysses av.

### Migreringen (L1) — Kenneth kjører den

Én migrering i `packages/db-timer`. Den leser `public`, som seks tidligere `db-timer`-migreringer gjør
(bl.a. `20261003120000_timer_lag2_sporbarhet/migration.sql`).

1. Oppretter de fem tabellene og den delvise unike indeksen (én `er_standard` pr. firma).
2. **Etterfylling 1:** én «Ordinær» med `er_standard = true` for hver rad i `public.organizations` som ikke har en.
3. **Etterfylling 2:** én `AnsattLonnsgruppe` pr. rad i `public.organization_members` som ikke har en — aktive og
   deaktiverte — med firmaets standardgruppe. `sattAvUserId` står tom og betyr «satt av migreringen».
4. Begge etterfyllingene har `WHERE NOT EXISTS`, så migreringen kan kjøres to ganger uten dobbeltrader.
5. **`backfill-telling-test.sql`** ved siden av migreringen, etter samme mønster som
   `20261003120000_timer_lag2_sporbarhet/backfill-telling-test.sql`. Den feiler når antall firma uten standardgruppe
   eller antall firmamedlemmer uten gruppe er over null.
6. **Test i API-et** som feiler når en av veiene V1–V3 lager et firmamedlem uten at det får gruppe.

Ingen eksisterende tabell endres, og ingen data slettes. Rekkefølgen er den vanlige: bygg, migrer, start
(`DEPLOY-RUNBOK.md`). En ansatt som gammel kode oppretter i minuttene mellom migrering og start, får gruppa av
vernet i § 2.

## 8 · Ikke med

- Lønnssats pr. gruppe (lærlingprosent). Gruppa styrer hvilke arter, ikke hva de er verdt.
- Automatisk forslag om natt-, smuss- og skifttillegg. Finnes ikke i dag og er ikke bestilt.
- Reiseoppsett pr. gruppe.
- Import av hvem som er lærling fra annet system.

## 9 · Avvik fra ordrens målinger

| Ordren sier | Målt |
|---|---|
| Det finnes ikke noe lærlingbegrep | Riktig for skjemaene. Men standardpakken har tre lærlingarter (`seed/index.ts:134-136`) — ikke bare A.Markussen |
| Overtidsforslaget er stille | Riktig for web og server. Mobilen varsler, men bare på automatisk laget seddel og bare firma-bredt (`[id].tsx:573-577`) |
| Gruppa styrer forslag for natt/smuss | Slike forslag finnes ikke i koden |
| Prod: 170/175 har nivå, 172/177 ikke | Ikke målt av Fabel (ingen tilgang til prod) |

## SPØRSMÅL

Se tabellen i § 6 for skjerm i dag, ved ja og ved nei. B2 er avgjort av TILLEGG 1. De tre som avgjør mest:

1. **B10 — skal lønnsgruppe-feltet bare stå i «Legg til ansatt», mens kontakt fra prosjektoppsettet og firmabytte får «Ordinær» uten å spørre?** *I dag:* ingen av vinduene har feltet. *Ved ja:* ett nedtrekk i «Legg til ansatt», forhåndsvalgt «Ordinær»; de andre vinduene er som i dag, og en lærling lagt til fra prosjektet står som «Ordinær» til firmaadmin flytter hen. *Forsvinner:* ingenting. *Ved nei:* nedtrekket vises også i kontaktvinduene i prosjektoppsettet, for firmaansvarlige som ikke er firmaadmin. *Anbefaling:* ja.
2. **B5 — skal serveren avvise en rad utenfor gruppa?** *I dag:* serveren sjekker bare firma. *Ved ja:* feilføring er umulig, men en telefon uten oppdatering får rader avvist ved synk. *Forsvinner:* føring uten nett på gammel katalog. *Ved nei:* raden lagres og merkes «utenfor lønnsgruppe» for attestanten. *Anbefaling:* nei.
3. **B8 — hvilke grupper skal A.Markussen få i katalogen, i tillegg til «Ordinær»?** *I dag:* ingen. *Ved ja (bare Lærling):* to grupper, tre arter merket. *Forsvinner:* ingenting. *Ved nei:* også Fastlønn, Timelønn, Prosjektleder og Innleid, med ti fraværsarter merket — det må du i så fall bekrefte art for art. *Anbefaling:* bare Lærling nå.
