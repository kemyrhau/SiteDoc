---
name: spec-lonnsgrupper
description: 🟡 SPEC, ikke bygget — lønnsgrupper i Timer. Firmaet lager egne grupper, den ansatte står i én, og lønnsart/tillegg/utleggskategori kan merkes «Gjelder lønnsgrupper». Styrer valg og forslag, også overtid.
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

## 2 · Foreslått datamodell

Alt nytt ligger i `packages/db-timer` (postgres-skjema `timer`). Regelen er at firmamodulers tabeller aldri skal
inn i `packages/db` (`arkitektur.md:426-428`). Den ansatte pekes på med svak nøkkel `userId`, som `DailySheet.userId`
gjør i dag (`packages/db-timer/prisma/schema.prisma:157`).

| Ny tabell | Innhold | Garanti |
|---|---|---|
| `Lonnsgruppe` | `organizationId`, `navn`, `aktiv`, `rekkefolge`, `standardLonnsartId?` | unik (`organizationId`, `navn`) |
| `AnsattLonnsgruppe` | `organizationId`, `userId`, `lonnsgruppeId`, `sattAvUserId`, `sattVed` | unik (`organizationId`, `userId`) — én gruppe pr. ansatt pr. firma |
| `LonnsartLonnsgruppe` | `lonnsartId`, `lonnsgruppeId` | sammensatt nøkkel, ekte fremmednøkler |
| `TilleggLonnsgruppe` | `tilleggId`, `lonnsgruppeId` | som over |
| `ExpenseCategoryLonnsgruppe` | `expenseCategoryId`, `lonnsgruppeId` | som over |

- **Tomt betyr alle.** En lønnsart uten rader i `LonnsartLonnsgruppe` gjelder alle. Det er Kenneths regel, ikke en
  tilstand som må fylles. Migreringen er derfor bare nye tabeller, uten etterfylling, og ingenting endrer seg før
  firmaadmin merker noe.
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
2. **Ansatt uten gruppe** får bare det som gjelder alle.
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

Lærlingen ser fortsatt 170 i velgeren, fordi den gjelder alle. Vil firmaet skjule den, merkes 170 med de andre gruppene.

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

I tillegg, uten ny side:

- Rediger-vinduet for ansatt får nedtrekket «Lønnsgruppe» under avdeling (bare når firmaet har Timer).
- Rediger-vinduene for lønnsart, tillegg og utleggskategori får «Gjelder lønnsgrupper». Tomt vises som «Alle».
- Listene får en kolonne som viser gruppene.

**Standard for katalogfirma (A.Markussen):** katalogfila får gruppa «Lærling», og 172/177/142 merkes med den.
172 får nivå 50 og 177 nivå 100. 170/175 får nivå 50/100 i fila, så et annet miljø får det samme som prod.
Importen (`apps/api/src/services/katalog/importerKatalog.ts`) må lære feltene. Hvem som er lærling, vet ikke
katalogen — det krysser firmaadmin av.

**Andre firma** lager gruppene selv («Hvert firma lager egne grupper»). Standardpakken oppretter ingen gruppe.

## 6 · Beslutningspunkter

| Nr. | Spørsmål | Skjerm i dag | Ved ja | Ved nei |
|---|---|---|---|---|
| **B1** | Én lønnsgruppe pr. ansatt? | Ansatt har ingen gruppe | Ett nedtrekk på den ansatte. En art som gjelder flere, merkes med flere grupper | Flervalg på den ansatte. Overtid må da ha en regel for hvilken gruppe som vinner |
| **B2** | Ansatt uten gruppe ser bare det som gjelder alle? | Alle ser alt | Lærlingartene forsvinner for alle som ikke er merket lærling, straks arten er merket | Umerkede ansatte ser alt, også lærlingartene — da må alle merkes før noe er skjult |
| **B3** | Egen gruppe foran «alle» ved overtid? | Første art etter rekkefølge | Lærling får 172, andre får 170, uten at 170 må merkes | Firmaadmin må merke 170 med alle andre grupper, og alle må stå i en gruppe |
| **B4** | Lederen får den ansattes utvalg i attesteringen? | Lederen ser alle arter | Lederen kan ikke føre en fagarbeider på lærlingart ved et uhell. Er gruppa feil, rettes den på den ansatte | Lederen ser alt og kan velge fritt |
| **B5** | Serveren avviser en rad med art utenfor gruppa? | Serveren sjekker bare firma | Feilføring er umulig. En telefon som ikke er oppdatert, eller har ført uten nett før gruppa ble satt, får raden avvist ved synk | Raden lagres og får merket «utenfor lønnsgruppe» i attesteringen. Attestanten retter |
| **B6** | Gruppebytte gjelder fra nå, uten fra-dato? | — | Ett felt. Retter man en gammel dag etter at lærlingen er blitt fagarbeider, tilbys fagarbeiderens arter. Lagrede rader står | Perioder med fra-dato, som oppmøtested (`OppmotePeriode`). Flere felt, og velgeren må slå opp gruppa pr. dato |
| **B7** | Standard lønnsart pr. gruppe? | Én pr. firma | Prosjektleder kan få 109 «Timer prosjektleder» forhåndsvalgt, lærling sin egen | Alle får firmaets standard. Gjelder den ikke gruppa, er feltet tomt |
| **B8** | A.Markussen: bare «Lærling» i katalogen nå? | Ingen grupper | Én gruppe, tre arter merket. Fastlønn/timelønn, prosjektleder og innleid lager firmaet selv | Katalogen får også disse gruppene, og ti fraværsarter merkes |

**Anbefalt:** ja på alle, unntatt **B5: nei** (merk, ikke avvis — telefonen må virke uten nett, og attestanten ser raden uansett).

## 7 · Leveranserekkefølge

| Ordre | Innhold | Migrering | Avhenger av |
|---|---|---|---|
| **L1 — server** | Tabellene i § 2. Ruter `timer.lonnsgruppe` (list, opprett, oppdater, slå av, sett ansatt, sett «Gjelder»). Katalogsvarene får gruppene. Seddelsvarene får eierens gruppe. `utils/lonnsgruppe.ts` med tester. Ingen endret oppførsel så lenge ingen gruppe finnes | **ja** (`db-timer`, bare nye tabeller) | — |
| **L2 — delt regel og server-overtid** | `velgOvertidLonnsart` med gruppe, `foreslaOvertidSplitt` med årsak, `regnJobbTid` på server, standard lønnsart pr. gruppe. `timer.md:372` rettes | nei | L1 |
| **L3 — web firmaadmin** | Siden `firma/timer/lonnsgrupper`, feltene i ansatt-, lønnsart-, tillegg- og utleggsvinduene, varsellinjene, hjelpetekst | nei | L1, L2 |
| **L4 — web timeføring og attestering** | Filtrering i de 18 kallene (8 filer), meldingen til arbeider, merket fra B5 | nei | L2 |
| **L5 — mobil** | Lokal katalog får gruppene, filtrering, forslagene (`dagsforslag.ts:855`, `:1903`, `linjeLonnsart.ts:155`, `nyTimerRad.ts:78`), varselet for både automatisk og manuell føring | nei på server. Lokal SQLite får nye kolonner | L2 |
| **L6 — katalog** | A.Markussen-fila og importen. Kjøres i prod av Kenneth | nei (data, ikke skjema) | L1, L3 |

L3 kan gå parallelt med L4 og L5. L6 sist, slik at siden finnes når lærlingene skal krysses av.

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

Se tabellen i § 6 for skjerm i dag, ved ja og ved nei. De tre som avgjør mest:

1. **B2 — ansatt uten gruppe ser bare det som gjelder alle?** *I dag:* alle ser alt. *Ved ja:* når 172 merkes «Lærling», forsvinner den for alle som ikke er merket lærling. *Forsvinner:* muligheten til å la umerkede se alt. *Ved nei:* alle ansatte må stå i en gruppe før noe kan skjules. *Anbefaling:* ja.
2. **B5 — skal serveren avvise en rad utenfor gruppa?** *I dag:* serveren sjekker bare firma. *Ved ja:* feilføring er umulig, men en telefon uten oppdatering får rader avvist ved synk. *Forsvinner:* føring uten nett på gammel katalog. *Ved nei:* raden lagres og merkes «utenfor lønnsgruppe» for attestanten. *Anbefaling:* nei.
3. **B8 — hvilke grupper skal A.Markussen få i katalogen?** *I dag:* ingen. *Ved ja (bare Lærling):* én gruppe, tre arter merket. *Forsvinner:* ingenting. *Ved nei:* også Fastlønn, Timelønn, Prosjektleder og Innleid, med ti fraværsarter merket — det må du i så fall bekrefte art for art. *Anbefaling:* bare Lærling nå.
