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

### 2026-10-08

| Hash | Flate | Før → Etter | Hjemmel |
|---|---|---|---|
| ← `21edd9ed` + `f0ad4d47` | **Mobil + web — måling i tegning** | **Etter:** fast størrelse på punkter, tekst og strek uansett zoom; iOS-bildemeny av ved langt trykk; måling går foran plassering; alle punkter kan dras (lupe på mobil); flere målinger blir liggende, trykk for å velge, «Slett»/«Slett alle»; maks zoom mobil 10→20. Målinger lagres ikke | 🟢 Kenneth 2026-10-08 (dra punkter, flere målinger + slett; «skal ikke lagres nå») |
| ← `9cf1fbea` | 🔴 **Mobil — tegningsvisning** | **Før:** kort trykk i «Navigering» gjorde ingenting; opprettelse krevde bytte til «Plassering»; ingen måling. **Etter:** kort trykk viser hint («Hold inne for å opprette …») og bryteren blinker; langt trykk setter markør og åpner malvalget; «Mål» med linjal/polylinje/areal (samme regnestykke og lås som web, kilde vises, kalibrering kun på web, krever nett). Reload: OTA | 🟢 Kenneth 2026-10-07 «ja til 1 og 2, ta med måling på mobil» |
| ← `84f97c19` | **Web — tegningssiden, måleverktøy og zoom** | **Før:** ett måleverktøy (kontinuerlig punkt til punkt); musehjulet panorerte (regresjon fra `09fd30a4`); knip rykket litt. **Etter:** tre verktøy — linjal (to punkter), polylinje (summert, avsluttes på eksisterende punkt/Enter/dobbeltklikk), areal (skravert, m² + omkrets); musehjulet zoomer igjen; knip forankret fra gest-start. Konsekvens: loddrett tofinger-scroll på styreflate zoomer (sidelengs panorerer) | 🟢 Kenneth 2026-10-07 («Adobe benytter 3 stk icon …»; musehjul = reparasjon) |

### 2026-10-07

| Hash | Flate | Før → Etter | Hjemmel |
|---|---|---|---|
| ← `09fd30a4` | 🔴 **Web — tegningssiden, måling og zoom** | **Før:** måling var sperret når målestokken var lest fra tittelfeltet (alle PDF-tegninger); knip på styreflate hoppet; kalibrering hadde ingen veiledning. **Etter:** målestokk fra tittelfeltet kan måles direkte, kilden vises ved målet («1:50 (fra tittelfeltet)») med «Stemmer ikke? Kalibrer»; knip gir jevn zoom ved pekeren, tofinger-scroll panorerer, musehjulet beholder trinn; kalibrering viser stegene og tegner punktene. Gjelder `kanMale` i shared (også mobil) | 🟢 Kenneth 2026-10-07 «vis 1:50 → da skal de fungere → kalibrering … dersom 1:50 oppdages som feil» |
| ← `2946fe5b` | **Web — tegningssiden** | **Før:** zoom med hjulet havnet midt på toppen av tegningen; verktøylinja (måling, innstillinger) scrollet ut av syne. **Etter:** zoom treffer musepekeren (målt ±0,9 px), bare tegningen scroller og verktøylinja blir stående | 🟢 Reparasjon av feltfunn 24.09 + Kenneth 2026-10-07 |
| ← `db98eb09` (T1c) | **Web — tegninger, detaljtabell** | **Før:** fag og rådgiver kunne bare settes før opplasting; tegningsnummer og type ble ikke foreslått for ARK-filnavn som «B3-06-A-20-31-02 Himlingsplan». **Etter:** kolonnene «Fag» og «Rådgiver» kan redigeres pr. rad; hele «B3-06-A-20-31-02» foreslås som nummer og «…plan» som type `plan` (merket «foreslått») | 🟢 Kenneth 2026-10-07 «kan ikke redigere fag dersom det er feil» + ekte filnavn |
| ← `e1a71e69` (T1b) | **Web — tegninger (byggeplass-oppsett)** | **Før:** etter opplasting kunne tegninger bare slettes; grupper kunne ikke lukkes. **Etter:** «Rediger flere» og blyant pr. rad åpner detaljtabellen igjen; «Vis» viser tegningen og «Tilbake til tabellen» uten å miste ulagrede endringer; fag- og etasjegrupper kan kollapses (huskes pr. byggeplass) | 🟢 R4-reparasjon + Kenneth 2026-10-07 (vis og tilbake, kollaps) |
| `0e50adad` ← `b5ca44cc` | 🔴 **Web — tegninger (byggeplass-oppsett)** | **Før:** én fil om gangen, én «Tegningsdetaljer»-modal pr. fil; ny revisjon måtte lastes som ny tegning. **Etter:** velg mange filer, fyll fag/rådgiver én gang, detaljer i tabell nå eller senere («Rediger flere»); nummer/type foreslås kun ved entydig treff; lista grupperes pr. fag (veksel til etasje); «Last opp ny revisjon» på web med konvertering. Målestokk valgfri som før | 🟢 Kenneth 2026-10-06 (20 ark-tegninger, «detaljer etterpå», «sortere pr fag»); spec `tegning-serieopplasting-spec.md` |
| `6ec95359` ← `18ad5bc3` | 🔴 **Mobil + web — sjekkliste, «+ Oppgave»** | **Før:** vanlige felt kunne bare ha én oppgave (knappen forsvant etter første); etter «+ Oppgave» → tilbake frøs sjekklisten (usynlig modal fanget trykk). **Etter:** alle felt viser alle oppgavene som chips og «+ Oppgave» blir stående; frysen rettet i rotårsaken (`OpprettDokumentModal` uten speil-state). Reload: OTA + web-deploy | 🟢 Kenneth 2026-10-07 «alle objekter … må støtte opprettelse av flere (+oppgave)»; frys = reparasjon |
| `d5758806` ← `e868f782` | 🔴 **Web — dagsseddel og attestering** | **Før:** web-raden hadde ingen matpause-avkrysning; timetallet trakk pausen skjult; «Arbeidstid i dag» hadde eget pausefelt. **Etter:** avkrysning «Matpause trukket (30 min)» på raden, ny rad får pausen automatisk etter regelen; «Arbeidstid i dag» utledes av radene og mister pausefeltet (start/slutt beholdt); attestanten ser «Matpause trukket» på bæreren, også når sedelen er låst | 🟢 Kenneth 2026-10-06 V20 = B |
| `669c579b` ← `625a7de6` | 🔴 **Timer (server) — engangsretting S2** | Dager der timetallet beviser trukket pause men raden ikke bar den, får krysset også når hodet sto på 0 (Kenneths 05.10). Hodet = Σ rad. Timetall endres aldri. Migrering `20261007120000_v20_s2_pause_backfill` | 🟢 V20 = B; Kenneth-test 2026-10-07 |
| `3b06dcb1` ← `dfa2a4aa` | 🔴 **Timer (server) — pausen eies av radene** | **Før:** hodet bar pausen, radene trakk den skjult. **Etter:** radens `pauseMin` er sannheten, hodet = Σ rad utledet på serveren; synk fra eldre app normaliseres (avvises aldri); splitt flytter pausen til delraden i pausevinduet; engangsretting `20261006220000_v20_pause_backfill` setter krysset der timetallet beviser fradraget | 🟢 Kenneth 2026-10-06 V20 = B |
| (denne commit) | **Web — malarkiv (SiteDoc-arkivet, firmaarkivet, import-tilordning i kontrollplan)** | **Før:** gruppetitlene viste standardens kode foran navnet («NS3420-K — Anleggsgartnerarbeider»). **Etter:** bare navnet. Kapittelkoder («KB …») vises som før | 🟢 §7b pkt 2 (fabel 2026-10-07), etter at Kenneth stoppet prod-seed over NS-henvisninger |

### 2026-10-06

| Hash | Flate | Før → Etter | Hjemmel |
|---|---|---|---|
| `a933898f` ← `dcaadd21` | 🔴 **Mobil — manuell timerad og matpause** | **Før:** en manuelt ført rad som krysset pausevinduet fikk firmaets 30 min trukket skjult. Avkrysningen sto tom, og fradraget skjedde også på dager under 5,5 t. **Etter:** raden bærer pausen synlig (kryss + `pauseMin` lagret) når dagen er over 5,5 t, raden krysser pausevinduet og ingen annen rad bærer den. Ellers trekkes ingenting. 07:00–15:00 → kryss, 7,50 t; fjernes krysset → 8,00 t. ⚠️ Eldre rader med skjult fradrag rettes først i V20-S (backfill). Reload: OTA | 🟢 Kenneth 2026-10-06 «avhukingen skal vise tilstanden også for manuell føring» + V20=B |

### 2026-10-03

| Hash | Flate | Før → Etter | Hjemmel |
|---|---|---|---|
| `586c2c95` ← `15aab779` | 🔴 **Mobil + web — versjonssjekk aktiv** | Telefonen husker serverversjonen pr. rad og sender den. **Effekt:** endring kun på PC → PC står og telefonen henter den; begge endret / slettet på én side → forslag med årsak («Endret både på PC og telefon», «Telefonen: slettet», «PC: slettet»), valg her eller på PC. Banner: «Dagen er også endret på PC. Se begge og velg — her eller på PC.» Reload: OTA etter server + migrering | 🟢 Kenneth 2026-10-05 |
| `2e37dec3` ← `50e356ab` | 🔴 **Timer-synk (server) — samme sedel redigert på PC og telefon** | **Før:** den som synket sist overskrev den andre, stille. **Etter:** serveren sjekker radversjon: kun PC endret → PC står; kun telefon endret → telefonen lagres; begge (eller slettet på én side) → telefonens versjon blir forslag, arbeideren velger, attestering blokkert. **Ikke virksomt før V19.9-B** (telefonen sender versjon). Eldre app uten versjon får konflikt ved ulikt innhold i stedet for overskriving | 🟢 Kenneth 2026-10-05 «systemet skal finne ut av dette» |
| `9d400c02` ← `6abc2c47` | 🔴 **Web — dagsseddel og attestering ved overlapp** | **Arbeideren:** dagsseddelen på web får «Forslag fra mobilen — velg» med PC/mobil side om side og «hele dagen»-knapper. **Attestanten:** forslaget vises lesbart, attester-knappen er grå med forklaring; retur virker. Forslag går aldri i eksport | 🟢 Kenneth 2026-10-04: V19, «b», V19.5 blokkert |
| `8100fcc0` ← `e9039b37` | 🔴 **Mobil — dagsseddel med overlapp mot PC** | **Før:** overlappende rader ble slått stille sammen («slått sammen»). **Etter:** dagen havner i konflikt med banner «Dagen er også registrert på PC, og tidene overlapper. Se begge og velg — her eller på PC»; sammenligningen viser serverens forslag, «hele dagen»-knapper, valget skrives samlet. Valg tatt på PC slipper konflikten på telefonen ved neste synk. Ikke-overlappende rader slås sammen som før. Ingen låseskjerm-varsel (krever `expo-notifications`). Reload: OTA etter server | 🟢 Kenneth 2026-10-04: V19, «b», V19.4 ja |
| `3dd2f590` ← `8492b66c` | 🔴 **Attestering (web) + eksport** | **Før:** reise-rad så ut som vanlig rad («—» i tid), «(inkl. reise)»-badge, `rad.beskrivelse` skjult. **Etter:** reise-merke («Reise ut/retur», «Reise (manuell)», «Reise» når retning mangler, «reise (kilde ukjent)» for gamle rader) med rute/km/min/kilde, arbeid/reise delt, banner når normen ikke er serverens, varsel ved `reiseAvvik`, beskrivelse vises. Eksporten får 11 nye kolonner; Excel uten valg har alle faste (som før, `78394d44`); byggherre-eksport får ikke kilde/tidskilde/norm | 🟢 K5 + V8 (Kenneth 2026-10-03); Excel fast + AML-varsel uendret (Kenneth 2026-10-04) |
| `73fe99c0` ← `775246c2` | 🔴 **Timer-synk og attestering (server)** | **Før:** dag ført på PC + overlappende rader fra mobil ble slått stille sammen (PC 07–15 + mobil 07–15 = 16 t). **Etter:** ved overlapp lagres mobilens rader som FORSLAG (egen tabell, telles ikke), sedelen får `konfliktVentendeSiden`, og **attestering blokkeres** (begge veier) til arbeideren har valgt. Rader uten overlapp slås sammen som før. Eldre app får vanlig konflikt i stedet for stille sammenslåing. Ikke synlig i UI før V19-B/C. Purring (A-6) utsatt | 🟢 Kenneth 2026-10-04: V19, «b», V19.4 ja, V19.5 blokkert |
| ← `cef84b94` (2026-10-06) | 🔴 **Mobil — timer-synk** | **Før:** et nettkall som aldri fikk svar låste synken for resten av økta; dagsseddelen sto «Venter» uten forklaring. **Etter:** hvert nettkall har 20 s tidsgrense og prøves igjen; synken kjører straks appen åpnes; banneret viser «Ikke sendt: … — prøver igjen automatisk» og har «Prøv igjen nå». Reload: OTA | 🟢 Reparasjon av `timer.md` (30 s synk) |
| `54f7ccb2` ← `737a357e` | 🔴 **Mobil — Hjem, prosjektvelger og «Ny dagsseddel» uten nett** | **Før:** «Kunne ikke hente prosjekter» erstattet hele Hjem; prosjektvelgeren og «Ny dagsseddel» var tomme. **Etter:** prosjektene leses fra telefonen, Hjem viser alltid Oppgaver/Sjekklister/HMS med «Frakoblet»-banner, innboksen vises fra lokale data (ellers «Innboksen krever nett»). Reload: OTA | 🟢 Reparasjon av Kenneth-vedtak «A» + CLAUDE.md «Mobil-appen MÅ fungere offline» |
| `b51623b0` ← `5b24a802` | **Mobil — Mer → prosjekt** | **Før:** «Skriv ut» og «Eksporter» viste bare «kommer snart». **Etter:** knappene er fjernet. PSI, kart og IFC-etiketter følger brukerens språk | 🟢 Kenneth 2026-10-04 «fjern knappene» |
| `b51623b0` ← `255c739c` | 🔴 **Mobil — offline-lesing + «Forbered til offline»** | **Før:** i flymodus ble et lagret dokument stående og laste (spørringen pauset, ble aldri regnet som frakoblet). «Forbered offline» viste ingenting varig. **Etter:** lagret dokument åpnes skrivebeskyttet; Mer viser alltid «N dokumenter og M tegninger lagret for offline · sist klargjort …» eller «Ingenting lagret ennå»; feil blir stående. Reload: OTA | 🟢 Reparasjon av Kenneth-vedtak «A» + Kenneth 2026-10-04 «minimum burde det stå om noe er lagret» |
| `fce371ad` ← `3025be8d` | 🔴 **Mobil — åpne dokument uten nett** (sjekkliste, oppgave, HMS) | **Før:** spinner/«ikke funnet» uten nett. **Etter:** dokumenter brukeren har åpnet med nett, eller lastet ned via «Forbered offline» (maks 200, ikke avsluttede), åpnes **skrivebeskyttet** med «Frakoblet – viser lagret versjon fra …». Bilder viser «Bilde krever nett». På nett: uendret (spinner mens den venter). Ikke-nedlastet dokument: «ikke lastet ned» i stedet for evig spinner. **Forhånds-nedlasting stempler ALDRI «lest av mottaker»** (ny bieffekt-fri `hentForOffline`). Sjekklistelista offline viser ikke lenger forrige brukers liste ved brukerbytte. Reload: OTA; forhånds-nedlasting krever server-deploy | 🟢 Kenneth-vedtak «A» 2026-10-03 (LESE offline) |
| `28c7d168` ← `99e5bdbc` | 🔴 **Mobil — reise-rader på dagsseddelen** | **Før:** reise-rader hadde ingen klokkeslett («—»), og raden husket ikke etappe, avstand eller kilde. **Etter:** reise ut/retur får et utledet klokkevindu (`tidKilde = "utledet"`), og raden bærer hele sporet til serveren og tilbake ved pull. Manuelt lagte reise-rader merkes `reiseKilde = "manuell"` uten retning. Reload: OTA | 🟢 K5 + V8 + B4 valg A (fabel 2026-10-03) |
| `28c7d168` | **Mobil — «Reisetid teller mot overtid»** | Mobilen leser ikke lenger innstillingen (kolonnen står, to-stegs) | 🟢 V2 |
| `6b05a694` ← `fe5ed27f` | 🔴 **Overtidsgrunnlaget på serveren (attestering)** | **Før:** serveren summerte reise-rader inn i timene som sammenlignes med normen — 7,5 t arbeid + 1 t reise ga 1 t «overtid». **Etter:** reise-rader holdes utenfor; grunnlaget viser arbeid og reise hver for seg. 🔴 **Overtidsavviket attestanten ser blir mindre på reisedager** | 🟢 V1 «reisetid er aldri overtid» (Kenneth 2026-10-01) |
| `6b05a694` | **Firma → innstillinger** | **Før:** avkrysningen «Reisetid teller mot overtid» (som ingen lenger leste). **Etter:** den er borte. Kolonnen står til neste release (to-stegs) | 🟢 V2 «flagget utgår» (Kenneth 2026-10-01) |
| `6b05a694` | **Timerader (server)** | **Før:** en reise-rad ble gjenkjent på lønnsartnavn ved hver lesing. **Etter:** raden bærer `erReise` + etappe, avstand, kjøretid, kilde og regel-snapshot; serveren flagger `reiseAvvik` mot matrisen (dobbel terskel: >10 % OG >2 km / >10 min), men regner aldri om. Ikke synlig før L2-C (attestering) og L2-B (mobil sender sporet). 🔴 **Migrering `20261003120000_timer_lag2_sporbarhet` IKKE kjørt** — Kenneth leser navne-match-tallet før prod | 🟢 K5 «mottak med sporbarhet» (Kenneth 2026-10-03) |
| `2e993250` | 🔴 **Attesteringsvarselet (server) + web-sedelen** | **Før:** begge leste et **flatt** tall fra firmainnstillingen. Web-koden sa det rett ut: *«sesongjustering krever server-endepunkt → utenfor scope»*. **Etter:** begge delegerer til én utledning, og firmaer med `normKilde = "kalender"` ser en **sesongjustert** norm | 🟢 V16, Kenneth 2026-10-02. **H22-fiksen** |
| `2e993250` | **Overtid på reisedager (alle flater)** | **Før:** flagget «Reisetid teller mot overtid» senket dagsnormen med reisetiden, så overtiden begynte tidligere. **Etter:** normen står urørt — **reisetid er aldri overtid**. 🔴 **Mindre overtidsbetaling på reisedager for firmaer som hadde flagget på** | 🟢 V1/V2, Kenneth. Fasit **Dag E** feiler hvis normen senkes |
| `2e993250` | **Arbeidsdagen på mobil** | **Før:** dagen begynte når GPS-en startet, altså ved reisestart. **Etter:** arbeidsvinduet er `[start + ut, slutt − retur]` — **dagen begynner når reisen slutter**, og normen og pausen henger på det vinduet | 🟢 V3/V5/V6 |
| `2e993250` | **Når prosjektet ikke kan utledes** | **Før:** `prosjekter[0]` — en vilkårlig sedel, stille. **Etter:** dagen holdes åpen med `prosjektUkjent`, og **meldingen navngir veien ut**: velg prosjekt, trykk «Slutt dag» på nytt | 🟢 H1. Samme mønster som `kildeManglet` |
| `2e993250` | **Når normen er ukjent** (offline >30 d) | **Ingen normaltid/overtid-splitt**, alle timer på standard lønnsart, med varsel etter «Slutt dag» og banner på sedelen. 🔴 **ALDRI 7,5 som gjetning** — en gjettet norm ser ut som et regnet faktum | 🟢 B6.3. Feilretningen er underbetaling, derfor er markøren synlig |

🟢 **Og en KORREKSJON av H22 som kom fra karakteriseringstestene:** mobilens og serverens
utledninger var **strukturelt identiske**. H22 var at varselet og web-sedelen leste den **flate
kolonnen** — ikke at utledningene var uenige. ⚠️ **Uten testene først ville vi trodd vi lukket noe
annet enn vi gjorde.**

### 2026-10-02

| Hash | Flate | Før → Etter | Hjemmel |
|---|---|---|---|
| `6ff26a80` | **Opprett byggeplass** (web) | **Før:** dialogen hadde kun navn. **Etter:** adressefelt — fylles det ut, geokodes byggeplassen mot Kartverket og får et punkt, så reise kan beregnes. 🔴 **Ikke påkrevd** (byggeplasser i terreng har ikke alltid adresse), og geokoding som feiler blokkerer aldri opprettelsen | 🟢 V14, helhetsplanen. Kenneth 2026-10-01: koordinat inn i opprettelsen |
| `6ff26a80` | **Byggeplasslista + reisetid-matrisen** | **Før:** en byggeplass uten punkt var usynlig — ingen flate sa fra. **Etter:** «Mangler plassering — reise beregnes ikke» i lista (når Timer er aktiv), og to tellere på matrise-flaten: hvor mange byggeplasser som mangler punkt, og hvor mange par som er uoppnåelige | 🟢 V14. ⚠️ **Dette er grunnen til at H21 kunne stå i fire måneder** |
| `6ff26a80` | **«Beregn fra tegning»** | **Før:** overskrev alltid et manuelt satt punkt. **Etter:** et punkt satt i kartvelgeren er fredet | 🟢 Kenneth-dialog 2026-10-01: «kartvelgeren overstyrer alltid» |
| `1ca8f6e4` | **«+ Ny» dagsseddel på mobil** | **Før:** GPS foreslo prosjekt innenfor 500 m av prosjektets punkt. **Etter:** forslaget krever treff i en byggeplass-**geofence**. 🔴 **Noen prosjekter vil slutte å få forslag** til byggeplassene deres har punkt — det er tilsiktet, og C5-varslene viser hvilke | 🟢 H2 i helhetsplanen: to innganger med ulike regler |

🔴 **Reparasjon med stor virkning, samme runde (`6ff26a80`): H21.** Reisematrisen målte til
**prosjektets** koordinat når byggeplassen manglet punkt — siden `7d98b80a`, 11. juni. Et prosjekt kan
strekke seg over kilometer, og avstanden avgjør om kjøringen betales som arbeidstid eller reisetid.
**Arv-baserte rader slettes ved neste recompute.** ⚠️ **En byggeplass som i dag «har reise» via arven,
mister den til punktet er satt** — C5-varslene gjør det synlig.

### 2026-10-01

| Hash | Flate | Før → Etter | Hjemmel |
|---|---|---|---|
| `e4866f8d` + `9c7c1ad1` | **Dagsseddel i mobilappen** — når telefonen og web har rørt samme dato | **Før:** rødt banner «Server-versjonen vant», ingen opplysning om hva serveren har, og eneste knapp slettet arbeiderens timer. **Etter:** banneret peker til en **sammenligning av begge dagskort pr. tidsrom**. Arbeideren velger **pr. rad** hva som er rett, retter i skjermen, og bekrefter — resultatet er **ETT dagskort**. Er web-kortet sendt/attestert: lesevisning, og han ber lederen returnere det | 🟢 **Kenneth 2026-09-30:** *«vi må vise begge registreringer og bruker må velge hvilken som er rett -> evt mest rett»* + *«vi skal ende opp med et utfylt dagskort -> verifiserbart på begge flater»*. Tre presiseringer bekreftet av ham: valg pr. rad · sammenligning pr. tidsrom · visningen brukes også uten konflikt |
| `9c7c1ad1` | Samme — attestert dagskort | **Arbeideren kan se begge sett, men ikke endre.** Vernet i **to lag**: lesevisning i appen, og serveren avviser kallet | 🟢 **Kenneth 2026-09-30, alternativ A.** Serveren har håndhevet grensen siden 2026-07-09 (`dagsseddel.ts:2159-2164`) — dette gjør den synlig i forkant i stedet for som en blokkering |

⚠️ **Skrivingen er atomisk, og det var et valg:** én mutasjon i stedet for en sekvens av
eksisterende kall. **Et halvveis anvendt valg er samme feilklasse som det stille datatapet** —
et dagskort i en tilstand ingen har valgt, på lønnsdata.

🔴 **Kontrolløren fant et TOCTOU-vindu før merge:** redigerbarhets-sjekken lå utenfor
transaksjonen, så en bulk-skriving kunne landet på et kort som ble attestert i vinduet. **Da
ville alternativ A vært håndhevet i skjermen, men ikke i koden.** Lukket med status-betinget
`updateMany` som åpner den interaktive transaksjonen.

### 2026-09-30

| Hash | Flate | Før → Etter | Hjemmel |
|---|---|---|---|
| `b02630ef` | **Dagsseddel i mobilappen** — når web-dagskortet er sendt/attestert | **Før:** «Gjenåpne for redigering» var trykkbar, og den slettet arbeiderens egne timer fra telefonen. **Etter:** knappen er grå i den tilstanden, med teksten «Timene dine er bevart. Dagskortet kan ikke gjenåpnes herfra nå — kontakt lederen, som kan sende det tilbake til deg.» 🔴 **En handling er fjernet i ett feiltilfelle** — den handlingen ødela brukerens data | 🟢 Orkestrator 2026-09-30, meldt til Kenneth i samme runde. **Feiltilfeller teller som funksjon** |
| `b02630ef` | Samme — konfliktbanneret | **Før:** «Server-versjonen vant. Lokale endringer er erstattet» — **falskt etter vakten**, og vist rett over «Timene dine er bevart». **Etter:** to tekster som brancher på status: låst → «kontakt lederen»; returnert → «rediger og send inn på nytt». Alle 15 språk | 🟢 Reparasjon av en tekst som ble usann. Funnet av kontrolløren |

🟢 **Reparasjon med synlig virkning, samme merge (til orientering):** det stille datatapet er
lukket. En arbeiders timer for en dag kunne forsvinne fra telefonen uten spor — rødt banner ble
grønt, timene borte. **Kenneth fant symptomet; målingen fant tapet.**

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

### 2026-10-03

| Hash | Flate | Før → Etter | Hvilken intensjon som gjenopprettes |
|---|---|---|---|
| `1a9c8e10` ← `733903eb` | Mobil — oppgavelista og HMS-lista | **Uten nett var listene tomme/feilet.** Nå vises sist hentede liste med «Frakoblet – viser lagrede dokumenter» og «Sist hentet», som sjekklistelista har gjort siden `970045d7`. Å ÅPNE et dokument offline virker fortsatt ikke (fase 2, LES — Kenneth-vedtak 2026-10-03) | CLAUDE.md «Mobil-appen MÅ fungere offline» + Kenneth 2026-09-07 «offline må utbedres». Reload: OTA |

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
