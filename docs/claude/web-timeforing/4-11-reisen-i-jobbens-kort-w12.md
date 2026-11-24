> Del av [Timeføring på web — plan med bilder](../web-timeforing-plan.md): § 4.11. Seksjonsnumrene er de samme som før delingen.

### 4.11 Reisen i jobbens kort (B32 B, B34 B) og første og siste prosjekt (B33 A) — w12 og w12m (versjon 11)

**Kenneth 2026-11-20 (§ 8.10):** B32 → B: reisen legges inn i jobbens kort og attesteres sammen med jobben.
B33 → A: utreisen føres på dagens første prosjekt, returen på dagens siste.

**Kenneth 2026-11-20 (§ 8.11), B34:** *«Arbeideren bestemmer hvor reisen føres: prosjekt – underprosjekt eller
prosjekt – byggeplass. Arbeideren bestemmer hvilket valg.»*

Delen heter **w12** (server, delt kode, migrering og web) og **w12m** (telefonen, med B33). ✅ w12 er merget
(`c19cad6c`). ⏸ w12m venter på web (§ 9).

⚠️ **Det som gjelder nå — nyeste først.** Delen er skrevet for w12 og står for sporbarhet. Regelen for hvilket
kort reisen står i, står i § 4.15 del E.

- **§ 8.22 punkt 3 (2026-11-21):** tre særregler er strøket. Reisen flyttes ikke automatisk når en annen
  registrering føres eller slettes (del A punkt 4). Reise uten byggeplass følger ikke klokka. Kortet for reise
  til annet kontor er ikke en egen variant. Kortet avgjøres av reisens egne felt og flyttes bare når noen retter
  dem via ✎. 🟡 Levert, venter gate (`feat/web-timer-forenkle`, § 9).
- **§ 8.22 punkt 2 (2026-11-21):** overføring til annet kontor eller avdeling har ingen egen regel. Kjøring i
  arbeidstiden er arbeid (V9) og føres på kortet for det nye stedet. Kjøring før første sted eller etter siste
  sted er reise. 🟡 Levert, venter gate (`feat/web-timer-forenkle`, § 9).
  Reisevinduet: se [vedtak-timer-web.md § Reisevinduet](../vedtak-timer-web.md).
- **Versjon 17 (§ 8.20):** «Flytt til …» og kolonnen `valgt_kort_id` er utgått. Arbeideren velger ikke kort;
  kortet følger av prosjekt, byggeplass og underprosjekt på reisen. Reisen rettes med ✎ (fem felt, w15f), og
  «Føres på» og de åpne feltene i del 8 er tatt ut. Migreringen i w15c er bare en utfylling.
- **Versjon 16 (§ 8.19, B44):** et underprosjekt arbeideren har valgt på reisen, er et krav. B46 B («Flytt
  til …») fra samme versjon er snudd; se punktet over.
- **Versjon 15 (§ 8.18, B43 B):** reise til en byggeplass ingen jobb på dagen har, får eget kort, og
  byggeplassen kommer før underprosjektet. Utfyllingen i del E her fikk en oppfølger (§ 4.15 del F, w15c).
- **Versjon 11 (§ 8.11, B34 B):** delen er skrevet om etter B34. Reisen beholder underprosjektet og
  byggeplassen arbeideren valgte. Alt som i versjon 10 sto «med B34 A», er tatt ut. Hvordan svaret er lest mot
  koden, står under tabellen. B35 er besvart med A (§ 8.12).

**Dette snus:**
- § 4.7 punkt 2–5 i denne planen: «reisen hører ikke til en jobb», blå rad «Reise» pr. prosjekt og eget reisekort.
- Kort-id-specen: § 2.2 («Reise-rader: alltid `NULL`»), `CHECK`-teksten i § 3.4, G8 og E2 (B1 = A, Kenneth 2026-11-16).
- w10 A10 utgår.

**Dette står:** kostnaden og attesteringsretten følger prosjektet på reiseraden (§ 4.7 punkt 1). Reise er aldri
arbeid i maskinregelen, normen eller overtiden (FA19). Lønnsartvalget holder reise og arbeid fra hverandre
(§ 4.7 punkt 6). Mellometappen er arbeidstid (V9).

Målt mot develop @ `bdf2320f`. `RK` = `apps/web/src/app/dashbord/timer/[id]/ReiseKort.tsx`, `KI` =
`apps/api/src/services/timer/kortId.ts`, `KG` = `packages/shared/src/utils/kortGruppering.ts`.

| # | Målt | Hvor |
|---|---|---|
| **FA45** | **Databasen har ingen sperre mot kort-id på reise.** Kolonnen `kort_id` finnes på timeradene og forslagsradene, kan være tom og har indeks. Den eneste `CHECK`-en gjelder rader uten prosjekt. B32 B trenger derfor ingen ny kolonne, bare utfylling. | `ST:318–321`, `:395–398`; `packages/db-timer/prisma/migrations/20261116120000_kortid_fravaer_normtak/migration.sql:11`, `:14–18`, `:24–30`, `:76–77`, `:95–104`. Søkt av Fabel. |
| **FA46** | **Regelen «reise har aldri kort» bor i koden.** `sikreKortId` tømmer kort-id på reise, holder reise utenfor tildeling og validering, og svarer med tom verdi. Hver skrivevei setter tom verdi selv. | `KI:232`, `:234`, `:298` (lest av Fabel); `D:4142`, `:9787`, `:3287` (lest av Fabel); `D:4375–4379`, `:7662`, `:7931`, `:6609`, `:4881`, `:4905`, `:1049`, `:1058` (leseagent) |
| **FA47** | **Valideringen krever lik nøkkel for alle rader i et kort:** prosjekt, byggeplass og underprosjekt. Reiseraden bærer sin egen byggeplass (stedet det ble reist til) og et valgfritt underprosjekt. Med kort-id ville den blitt avvist i dag. | `packages/shared/src/utils/kortId.ts:233–253` (lest av Fabel) |
| **FA48** | **Attesteringen går på rad-id-er.** `attesterRader`, `returnerRader` og `gjenaapneRader` tar lister med id-er. Serveren har ingen regel om at en jobb attesteres hel. Web bygger lista fra jobbens linjer. Dagsradens ✓ uten prosjektomfang attesterer hele dagsseddelen. | `D:6888`, `:7083`, `:7466`, `:8075` (leseagent); `AT:417–442`, `:482–506` (dagsraden lest av Fabel) |
| **FA49** | **Serverkode som leser jobben på kort-id:** «flytt hele jobben» og «Del opp» holder reise utenfor med eget filter. Maskinregelen gir reise 0 timer, også med samme kort-id. En maskin kan ikke kobles til en reiserad. Oppslaget av timerad for en vare har ikke reisefilter. Sletting av en timerad kjører ikke `sikreKortId`. | `D:704`, `:6699` (lest av Fabel); `packages/shared/src/utils/maskinKapasitet.ts:97–111` (lest av Fabel); `maskinKobling.ts:58–60`; `KI:321`, `:399`; `D:4401–4472` (søkt av Fabel: ingen kall) |
| **FA50** | **Den delte grupperingen** legger reise i egen bøtte før kort-id leses. Kortets hode leses fra første timelinje, og kortenes rekkefølge fra første linjes fra-tid. Bare attesteringen på web kaller den. Telefonen har sin egen gruppering. | `KG:124`, `:170`, `:175–186` (lest av Fabel); `AM:313`; `M/utils/dagsoversiktRader.ts:132` (leseagent) |
| **FA51** | **Attesteringen på web:** reiseblokken er et vanlig kort med egen nøkkel. Summene tar med reise i jobbsum og dagsum. Typekolonnen viser «Arbeid» på reiselinja. Kortet har ingen reisesjekk: fra–til, sum, underprosjekt og beskrivelse regnes fra alle timelinjene i blokken. | `AM:490–494`, `:539–547`; `RP:52–70`, `:105–141` (lest av Fabel); `AT:320–331` (leseagent) |
| **FA52** | **PC-føringen:** «+ Reise» står én gang i hvert prosjektkort, ikke pr. jobb, og sender ingen kort-id. Reisevinduet: se [vedtak-timer-web.md § Reisevinduet](../vedtak-timer-web.md). | `WS:1815–1823`; `RK:87`, `:171–201`, `:354`; `packages/shared/src/utils/reiseManuell.ts:8–15` (leseagent; `RK:87`, `:177`, `:354` søkt av Fabel) |
| **FA53** | **Telefonen tømmer kort-id på reise** etter hver lokal skriving, før hver sending og etter hver henting. En eldre app sender derfor alltid reise uten kort-id, også etter at serveren har satt den. | `M/utils/kortIdNormalisering.ts:86`, `:108`; `M/services/timerSync.ts:951–952` (lest av Fabel); `timerSync.ts:863`, `:1778` (leseagent) |
| **FA54** | **Telefonens føring:** manuell reise får prosjektet med flest arbeidstimer. Brukeren velger tur eller retur, byggeplass når prosjektet har flere, og underprosjekt. GPS-forslaget har én destinasjon pr. økt, og begge reisene får forslagets ene prosjekt. Forslaget kjenner ikke flere opphold; det er lag 4 (L4-B), som er spesifisert og ikke bygget. | `M/components/timer-detalj/prosjektkort/DagSeksjon.tsx:80–96`; `M/components/timer-detalj/ReiseKort.tsx:104`, `:304–309` (søkt av Fabel); `M/utils/dagsforslag.ts:1166–1171`, `:1964–1987` (leseagent); `timer-gps-helhetsplan.md:419` |
| **FA55** | **Retningen kan mangle.** Serveren krever retning bare for reise fra matrisen og for overføring. En manuell reise er gyldig uten. Telefonen fjerner retningen når en reise som ikke kom fra matrisen, redigeres. | `apps/api/src/routes/timer/reise-sporbarhet.ts:314–330`; `M/components/timer-detalj/prosjektkort/radLagring.ts:171–179` (lest av Fabel) |
| **FA56** | **Telefonen: sletting og flytting av en jobb tar ikke reisen med.** Reisen blir stående på prosjektet den er ført på. | `M/components/timer-detalj/prosjektkort/kortRadFlytt.ts:351` (lest av Fabel); `:539–560`, `:600–700` (leseagent) |
| **FA57** | **Rapport og eksport leser ikke kort-id.** Summene følger prosjektet og underprosjektet på raden. | `apps/api/src/routes/timer/rapport.ts` (leseagent: ingen treff); `apps/web/src/lib/timer-rapport-eksport.ts:116` |
| **FA58** | **Telefonens attestering** viser alle timerader i én liste, uten reisemerke, og attesterer pr. rad. | `M/components/timer-attestering/AttesteringDetaljMobil.tsx:141–146`, `:296–320` (leseagent) |
| **FA59** | **Tester som låser «reise har ikke kort»** og må snus. | `apps/api/src/routes/kortid-skriveveier.integration.test.ts:333`, `:492`; `kortid-migrering.integration.test.ts:171`; `packages/shared/src/utils/kortId.test.ts:120`; `kortGruppering.test.ts:193` (leseagent) |
| **FA60** | Reisevinduet: se [vedtak-timer-web.md § Reisevinduet](../vedtak-timer-web.md). | — |
| **FA61** | **Reisevinduet på telefonen har de samme to feltene.** Prosjektet gis av «Dagen» (FA54), uten prosjektvelger. Byggeplassen er forvalgt, og lista vises bare når prosjektet har flere. Underprosjekt er et valgfritt felt, tomt som forvalg. | `M/components/timer-detalj/ReiseKort.tsx:66`, `:101–104`, `:127`, `:255–271`, `:304–313`. Lest av Fabel. |
| **FA62** | **Hva reiseraden bærer.** Tur og retur bærer prosjekt, byggeplass og underprosjektet arbeideren valgte, ellers tomt. Uten byggeplass kan reisen ikke lagres: kjøretiden regnes fra oppmøtested × byggeplass. Reise til et annet kontor bærer ingen byggeplass. | `RK:171–188`; `M/components/timer-detalj/ReiseKort.tsx:150–160`; `packages/shared/src/utils/reiseManuell.ts:196`, `:327–329`. Lest av Fabel. |
| **FA63** | **Underprosjektet har ingen byggeplass.** Det hører til prosjektet. Byggeplass (hvor) og underprosjekt (hvilken kostnad) er to uavhengige akser. | `PS:2808–2843`. Søkt av Fabel. |
| **FA64** | **Jobben har de samme tre:** prosjekt, byggeplass og underprosjekt. Telefonens kort viser «byggeplass · underprosjekt» under prosjektnavnet. | `M/components/timer-detalj/prosjektkort/ProsjektkortDagsoversikt.tsx:105–106`, `:721–733`. Lest av Fabel. |
| **FA65** | **Underprosjektet kan byttes på én timerad i attesteringen.** `flyttTimerRadEco` uten `helJobb` tar én rad, og har ikke reisefilter fram til `helJobb`-grenen. «Flytt hele jobben» holder reise utenfor (FA49). | `D:6548–6606`, `:704`. Lest av Fabel til `:6606`; resten av grenen er ikke lest, og ingenting er kjørt. |

#### Svaret på B34 lest mot koden

1. **«Prosjekt – byggeplass» er i koden det samme som reise uten underprosjekt.** Det er ikke et eget valg.
   Reisevinduet på telefonen har to uavhengige felt (FA61): byggeplassen det reises til, og et
   valgfritt underprosjekt. PC: Reisevinduet: se [vedtak-timer-web.md § Reisevinduet](../vedtak-timer-web.md).
2. **Hva raden bærer** (FA62):

   | Arbeideren velger | Prosjekt | Byggeplass | Underprosjekt |
   |---|---|---|---|
   | Bare byggeplass — «prosjekt – byggeplass» | ja | ja | tomt |
   | Også underprosjekt — «prosjekt – underprosjekt» | ja | ja, kjøretiden regnes fra den | det valgte |
   | Reise til annet kontor | ja | tomt | det valgte, eller tomt |

3. **Slik leser planen svaret:** reisen føres der arbeideren valgte. Ingenting flytter underprosjektet eller
   byggeplassen på en reiserad av seg selv. Det er alternativ B slik B34 sto. Reisevinduet på telefonen har alt begge
   valgene, og ingenting bygges der. PC: Reisevinduet: se [vedtak-timer-web.md § Reisevinduet](../vedtak-timer-web.md).
4. **Svaret kan leses på en annen måte:** at arbeideren skal velge blant dagens jobber i én liste, eller velge
   prosjektet selv på telefonen. Det er **B35** (§ 8). Reglene under gjelder uansett svar på B35, fordi serveren
   bare leser prosjektet, byggeplassen og underprosjektet på raden.

#### A. Regelen — hvilken jobb reisen står i

1. **Reiseraden bærer alltid en kort-id.** Etter w12 har ingen timerad tom kort-id.
2. **Brukeren velger aldri jobb for reisen.** Én delt funksjon i `packages/shared` regner den ut, og serveren og
   telefonen bruker den samme. Kort-id som klienten sender på en reiserad, leses ikke.
3. ⚠️ **Endret av B43 B (versjon 15, § 4.15 del E):** byggeplassen er et krav og kommer først; uten jobb på
   reisens byggeplass står reisen i eget kort. **Versjon 16 (B44):** et valgt underprosjekt er også
   et krav. ⚠️ «Et kort arbeideren har valgt, går foran regelen» (B46 B) er utgått (§ 8.20). Teksten under er
   regelen slik w12 bygde den.
   **Kandidatene** er jobbene på samme dagsseddel som har arbeid på reisens prosjekt. Reisen står i jobben som
   er ført samme sted som reisen (B34 B). Utvalget snevres inn i tre steg:
   - **Først underprosjektet.** Har prosjektet jobber med samme underprosjekt som reisen, er bare de kandidater.
     «Uten underprosjekt» regnes som en egen verdi. Har ingen jobb samme underprosjekt, er alle prosjektets
     jobber kandidater.
   - **Så byggeplassen.** Har noen av kandidatene samme byggeplass som reisen, er bare de kandidater. Ellers
     står kandidatene fra forrige steg. En reise uten byggeplass (til annet kontor, FA62) hopper over steget.
   - **Så retningen.** Kandidatene ordnes slik kortene vises: første arbeidsrads fra-tid, jobber uten
     klokkeslett sist, deretter eldste rad (FA50).
     - **Utreisen** står i den **første**.
     - **Returen** står i den **siste**.
     - **Uten retning** (FA55): starter reisen før første arbeid blant kandidatene, står den i første jobb.
       Ellers i siste. Har den verken retning eller klokkeslett, står den i første.
   - **Prosjektet har ingen jobb den dagen:** reisen står alene i sitt eget kort på prosjektet. Kort-id-en
     utledes av reisens egen nøkkel, slik `utledKortId` gjør for andre rader.
   - Jobbens underprosjekt og byggeplass leses fra arbeidsradene (punkt 7). Byggeplassen er den effektive,
     slik nøkkelen leser den (FA69).

   **Eksempel.** B12 har to jobber: «Storgata · uten underprosjekt» 07–12 og «Storgata · END-002» 12–16.

   | Reisen er ført på | Står i |
   |---|---|
   | Utreise, uten underprosjekt | Jobben 07–12 |
   | Retur, uten underprosjekt | Jobben 07–12. Den er eneste jobb uten underprosjekt. |
   | Retur, END-002 | Jobben 12–16 |
   | Utreise, TILL-001 (ingen jobb der den dagen) | Jobben 07–12. Linja viser «TILL-001». |
   | Utreise på prosjekt 1050 (ingen jobb der den dagen) | Alene i eget kort på 1050 |

4. ⚠️ **Strøket av Kenneth (§ 8.22 punkt 3):** reisen skal ikke flyttes automatisk når en annen registrering
   føres eller slettes. Kortet avgjøres av reisens egne felt og flyttes bare når noen retter dem via ✎.
   🟡 Vedtatt, ikke bygget: koden gjør fortsatt det punktet beskriver, til leveransen i § 9 er bygget. Sto slik:
   **Regelen kjøres på nytt hver gang dagsseddelen skrives** (i `sikreKortId` på serveren og i
   `sikreLokalKortId` på telefonen). Følgene:
   - Føres en tidligere jobb blant kandidatene, flytter utreisen dit.
   - Slettes jobben, går reisen til en annen jobb på prosjektet. Finnes ingen, står reisen alene. Reisen slettes
     ikke med jobben (som i dag, FA56).
   - Etter «Del opp» står utreisen i første del og returen i siste.
   - Bytter jobben eller reisen underprosjekt, regnes plassen på nytt.
   - **Attesterte og erstattede reiserader flyttes aldri.**
5. **Reisen bytter ikke prosjekt, underprosjekt eller byggeplass av seg selv** (B34 B).
   - Flyttes jobben til et annet prosjekt, blir reisen stående på prosjektet den er ført på (som i dag), og
     punkt 3 kobler den på nytt. Byggeplassen og kjøretiden gjelder det gamle stedet og kan ikke flyttes med.
   - «Flytt hele jobben» til et annet underprosjekt endrer jobbens rader og lar reisen stå (som i dag, FA49).
     Etterpå regnes plassen på nytt: har prosjektet en annen jobb på reisens underprosjekt, står reisen der.
     Ellers blir den i jobben, og linja viser underprosjektet sitt (del C punkt 1).
   - Underprosjektet på reisen endres bare når arbeideren eller attestanten endrer det på reisen (del C punkt 5).
6. **Invariantene i kort-id-specen § 2.3 for en reiserad i et kort:**
   - K1 (samme dagsseddel) og K2 (samme prosjekt) gjelder.
   - K3 (underprosjekt) gjelder ikke reise som krav (B34 B). Regelen foretrekker lik underprosjekt (punkt 3),
     men en reise kan stå i en jobb med et annet underprosjekt når dagen ikke har noen jobb på reisens.
   - K4 (byggeplass) gjelder ikke reise. Reisens byggeplass er stedet det ble reist til eller fra, og brukes
     mot reisematrisen.
   - K5 (beskrivelsen) gjelder ikke reise. K6 står: maskin og vare kan ikke kobles til en reiserad.
   - Reiseraden teller ikke når kortets nøkkel avgjøres. Valideringen sammenlikner bare dagsseddel og prosjekt
     for en reiserad (FA47).
7. **Alt kortet regner, regnes av arbeidsradene:** hodet, klokkeslettene, rekkefølgen, sum arbeidstimer,
   «høyst X t», normen og beskrivelsen. Reise teller aldri som arbeid (FA19, FA49).

#### B. Hvor koblingen settes

| Sted | I dag | Etter w12 | Del |
|---|---|---|---|
| `sikreKortId` (`KI:176–300`) | Tømmer kort-id på reise (FA46). | Kjører regelen i A, og validerer K1 og K2 for reise. Rører ikke attesterte rader. | w12 |
| Skriveveiene i FA46 | Setter tom verdi selv. | Hver vei ender med reisen koblet. Én test pr. vei. | w12 |
| Sletting av timerad (`D:4401–4472`) | Kjører ikke `sikreKortId` (FA49). | Kjører den, så reisen ikke blir hengende på en jobb uten arbeid når prosjektet har en annen jobb. | w12 |
| Vareoppslaget (`KI:399`) | Uten reisefilter. | Finner bare arbeidsrader. | w12 |
| «Del opp» (`D:6699`) | Holder reise utenfor. | Uendret kode. Regelen flytter returen til siste del (A punkt 4). | w12 |
| «Flytt hele jobben» (`D:704`) | Holder reise utenfor. | Uendret kode: reisen beholder underprosjektet sitt (B34 B). `sikreKortId` kjøres etterpå og regner plassen på nytt (A punkt 5). | w12 |
| Bytte av underprosjekt på én rad (`flyttTimerRadEco` uten `helJobb`, FA65) | Tar én timerad. | Brukes for reiseraden fra del 8 i kortet (del C punkt 5). Plassen regnes på nytt etterpå. Koderen måler først at grenen tar en reiserad. | w12 |
| Synken (`D:9671–9675`, `:9787`) | Kort-id fra klienten på reise sjekkes mot andre dagssedler og tømmes så. | Verdien leses ikke og sjekkes ikke. Serveren regner selv. | w12 |
| Forslagsradene (V19, `D:1049–1058`) | Reise uten kort-id. | Uendret i tabellen. Reisen kobles når forslaget forsones (`D:4881–4905`). | w12 |
| PC-føringen (`RK`, `WS:1815–1823`) | «+ Reise» pr. prosjektkort, uten kort-id. Reisevinduet: se [vedtak-timer-web.md § Reisevinduet](../vedtak-timer-web.md). | Uendret. Valgene står (B34 B), og serveren kobler. | w12 |
| Den delte grupperingen (`KG:124`) | Reise i egen bøtte. | Reise med kort-id ligger i kortet, sist. Reise uten kort-id ligger i bøtta som før. Hode og rekkefølge leses fra arbeidsradene. 🟡 Bygget i `feat/web-timer-w12`. | w12 |
| Attesteringen på web | Egen reiseblokk pr. dag (FA51). | Del C. 🟡 Bygget i `feat/web-timer-w12` (timer.md § Reisen i jobbens kort). | w12 |
| Telefonen lokalt (`kortIdNormalisering.ts:86–123`, `dagsforslagAnvend.ts:267–269`, `nyTimerRad.ts:310`) | Tømmer kort-id på reise. | Samme regel som serveren, og lokal utfylling av radene som finnes. | w12m |
| Telefonens kort (`kortRadFlytt.ts:351`, `ProsjektkortDagsoversikt.tsx:315–340`, `DagSeksjon.tsx:119–137`) | Reisen står i «Dagen». | Del D. | w12m |
| Dagsforslaget | Reise uten kort (`dagsforslagAnvend.ts:267`). | Reisen kobles når forslaget lagres. Hvilket prosjekt den får, er del G. | w12m og L4-B |

#### C. Attesteringen på web

1. **Reiselinja står i jobben, sist** — etter utlegg, utreise før retur. Den viser lønnsart, fra–til, timer og
   rutemerket som i dag. Typekolonnen sier «Reise» (teksten finnes, FA51). Linja har ingen knapper og ingen
   avkrysning, som de andre linjene (B24 B, B30 A).
   - **Er reisen ført på et annet underprosjekt enn jobben, står reisens eget på linja** i kolonnen for
     underprosjekt — «Uten» når reisen ikke har noe (B34 B). Det er ikke et avvik og får ikke avviksfarge.
     Ellers står cellen som på de andre linjene.
2. **Reiseblokken forsvinner.** En dag med én jobb og reise har ett kort, og dagsraden åpner det. «N jobber»
   teller jobber, ikke reise.
3. **✓, ↩ og ↺ på jobbraden tar reisen med.** Klienten sender reiseradenes id-er sammen med jobbens (FA48).
   Ingen ny prosedyre på serveren. «Attester utvalget» gjør det samme.
4. **Jobbraden viser arbeidstimene** i «Timer». Reisetimene står på reiselinja, og jobbraden sier
   «reise 1,00 t» i grått. Dagsraden summerer alt, som i dag. Slik stemmer jobbradens tall med «høyst X t».
5. **Kortet får del 8, «Reise»,** som bare vises når jobben har reise. ⚠️ **Endret av w15f (§ 8.20):**
   reiselinja i del 8 er tekst med ✎, og vinduet har fem felt (start, slutt, prosjekt, byggeplass,
   underprosjekt). De åpne feltene og «Føres på» er tatt ut. Punktene under er slik w12 bygde del 8. For hver reiserad:
   - «Utreise», «Retur» eller «Reise», og ruta: fra-sted → til-sted, km, minutter og kilde (FA31).
   - Fra og til som felt. Timene regnes ut, som i del 2 (w10 A1).
   - Lønnsartvalget tilbyr bare reisearter.
   - **«Føres på»:** underprosjektet reisen er ført på, som valg — samme knapper eller nedtrekk som i kortets
     hode (B11), med «Uten» som eget valg. Attestanten kan rette det. Hjemmel: B24, «kortet rettes samlet …
     og eventuelt reise», og B10. Kallet gjelder bare reiseraden (FA65). Byggeplassen står i ruta og kan ikke
     byttes her, fordi kjøretiden hører til stedet.
   - ✂ ved linja, som på en arbeidslinje. Delene av en delt reise følger regelen i A.
   - Ingen beskrivelse, ingen maskiner og ingen varer.
6. **Del 1–7 regnes av arbeidsradene** (A punkt 7). I dag ville en reise i kortet endret fra–til, summen og
   underprosjektet (FA51). Underprosjektvalget i kortets hode gjelder jobben og flytter ikke reisen (A punkt 5).
   Hjelpeteksten for siden sier det.
7. **Reise alene i et kort** vises som en jobbrad med prosjektnummer, reisens underprosjekt og teksten «Reise».
   Kortet har hodet og del 8. Underprosjektvalget i hodet og «Del opp» vises ikke der; underprosjektet rettes
   under «Føres på».
8. **Prosjektlederen** attesterer reisen sammen med jobben. Reisen står på jobbens prosjekt, så omfanget i
   § 4.6 trenger ingen egen regel.
9. **En reiserad uten kort-id** skal ikke finnes etter migreringen. Finnes den likevel, vises den som egen
   blokk som i dag. Den skjules aldri.
10. Den sorterte tabellen, «Etter prosjekt» og ukeoversikten står som i dag.

#### D. Telefonen (w12m)

1. **Samme regel lokalt.** `kortIdNormalisering.ts` bruker den delte funksjonen. Radene som alt ligger på
   telefonen, fylles ut ved første oppstart etter oppdateringen.
2. **Reisen vises i jobbens kort,** nederst, med retning, klokkeslett og timer. «Dagen» beholder «+ Reise» og
   overlappvarselet, men lister ikke reisene en gang til. En reise som står alene, vises som eget kort «Reise»
   med prosjektet. Har reisen et annet underprosjekt enn kortet, står underprosjektet på reiselinja.
   - **Reisevinduet står urørt:** byggeplass og underprosjekt velges som i dag (FA61, B34 B). Om vinduet skal
     få noe mer, er B35.
3. **Sletting av en jobb sletter ikke reisen** (som i dag). Regelen kobler den på nytt.
4. **Bekreft dag står urørt:** én utreise og én retur vises rundt arbeidet (`BD:2221–2247`).
5. **Dagskort-modus står urørt** (regelen fra 07.11.). Radene får kort-id av normaliseringen, og ingenting
   vises annerledes.
6. **Kortets sum, «høyst X t» og beskrivelsen** regnes uten reise, som i dag
   (`ProsjektkortDagsoversikt.tsx:318`, `kortBeskrivelse.ts:25`).
7. Koderen leverer løsning med skjermbilde av kortet før kode. Telefonskjermen er ikke tegnet her.

#### E. Migrering (w12) — Kenneth kjører

Ingen ny kolonne (FA45). Migreringen er en utfylling i `packages/db-timer`. Den følger to-stegs-regelen.

**Steg 1, i w12:**
- **Diskriminerende WHERE:** bare `er_reise = true AND kort_id IS NULL`. Rader som har kort-id, røres ikke.
- **Setning 1 — reise med jobb:** reisen får kort-id-en til en jobb på samme dagsseddel og samme prosjekt, valgt
  etter A punkt 3: lik underprosjekt først, så lik byggeplass, så retningen. I SQL er det én sortering:
  underprosjekt-treff, byggeplass-treff, og så tid — stigende for utreise, synkende for retur. Utfyllingen endrer
  aldri underprosjektet eller byggeplassen på en rad (B34 B).
- **Setning 2 — reise uten jobb:** resten får utledet kort-id av sin egen nøkkel (bruker, dato, prosjekt,
  byggeplass, underprosjekt), med samme formel som kort-id-specen § 3.2. De står alene i sitt kort.
- Attesterte og erstattede rader får også kort-id. Ingen andre felt endres.
- Migreringen skriver ikke `updated_at`. Ingen dagsseddel skal se endret ut for synken.
- Kjørt to ganger gir den samme resultat.
- Forslagstabellen røres ikke (del B).

**Steg 2, neste utgivelse:** samme utfylling én gang til, og så `CHECK (kort_id IS NOT NULL)` på timeradene.
Den erstatter `CHECK`-teksten i kort-id-specen § 3.4, som krevde tom kort-id på reise. Den er ikke lagt på
(FA45), så ingenting må fjernes først.

**Telling før w12 bygges** (bare lesing; Kenneth kjører mot `sitedoc_test` og `sitedoc`):

```sql
with reise as (
  select id, sheet_id, project_id, external_cost_object_id as eco, reise_retning, fra_tid
    from timer.sheet_timer where er_reise = true and kort_id is null
), jobb as (
  select distinct sheet_id, project_id, external_cost_object_id as eco
    from timer.sheet_timer
   where er_reise = false and kort_id is not null and attestert_status is distinct from 'erstattet'
)
select count(*) as reiserader,
  count(*) filter (where r.eco is not null) as med_underprosjekt,
  count(*) filter (where exists (select 1 from jobb j where j.sheet_id = r.sheet_id
     and j.project_id = r.project_id and j.eco is not distinct from r.eco)) as jobb_samme_underprosjekt,
  count(*) filter (where exists (select 1 from jobb j where j.sheet_id = r.sheet_id
     and j.project_id = r.project_id) and not exists (select 1 from jobb j where j.sheet_id = r.sheet_id
     and j.project_id = r.project_id and j.eco is not distinct from r.eco)) as jobb_annet_underprosjekt,
  count(*) filter (where not exists (select 1 from jobb j where j.sheet_id = r.sheet_id
     and j.project_id = r.project_id)) as ingen_jobb,
  count(*) filter (where r.reise_retning is null) as uten_retning,
  count(*) filter (where r.reise_retning is null and r.fra_tid is null) as uten_retning_og_tid
from reise r;
```

- `ingen_jobb` er radene som blir stående alene i eget kort.
- `jobb_annet_underprosjekt` er radene som blir liggende i en jobb med et annet underprosjekt enn sitt eget.
  Attestanten ser underprosjektet på reiselinja (del C punkt 1).
- `med_underprosjekt` sier hvor ofte arbeiderne har brukt valget.

Kolonnenavnene er lest i `ST:232–318`; koderen kjører spørringen mot lokal base før den går til Kenneth.

**Gate-SQL etter migreringen** (1–3 skal gi 0 rett etter kjøringen; 4 er til orientering):

```sql
-- 1) timerad uten kort
select count(*) from timer.sheet_timer where kort_id is null;
-- 2) reise i et kort med arbeid på et annet prosjekt
select count(*) from timer.sheet_timer r join timer.sheet_timer t
    on t.sheet_id = r.sheet_id and t.kort_id = r.kort_id and t.er_reise = false
 where r.er_reise = true and t.project_id is distinct from r.project_id;
-- 3) reise i en jobb med et annet underprosjekt, enda prosjektet har en jobb på reisens underprosjekt
select count(*) from timer.sheet_timer r
 where r.er_reise = true
   and exists (select 1 from timer.sheet_timer t
                where t.sheet_id = r.sheet_id and t.kort_id = r.kort_id and t.er_reise = false
                  and t.attestert_status is distinct from 'erstattet'
                  and t.external_cost_object_id is distinct from r.external_cost_object_id)
   and exists (select 1 from timer.sheet_timer j
                where j.sheet_id = r.sheet_id and j.project_id = r.project_id and j.er_reise = false
                  and j.attestert_status is distinct from 'erstattet'
                  and j.external_cost_object_id is not distinct from r.external_cost_object_id);
-- 4) reise som står alene i kortet sitt
select count(*) from timer.sheet_timer r where r.er_reise = true and not exists (
  select 1 from timer.sheet_timer t where t.sheet_id = r.sheet_id and t.kort_id = r.kort_id and t.er_reise = false);
```

Spørring 1 kjøres en gang til etter at ny server er oppe. Den gamle serveren tømmer kort-id på reise (FA46) og
kan ha skrevet rader i vinduet mellom migrering og oppstart. Er tallet over 0, kjøres utfyllingen på nytt.

**«Stille tomhet er forbudt»:** (a) utfyllingen over, (b) `CHECK` i steg 2, og (c) tester som er røde når
kolonnen er tom — del H punkt 1–3.

#### F. Eldre apper og eldre server

| Situasjon | Hva skjer |
|---|---|
| Eldre app sender reise uten kort-id | Serveren regner kort-id selv (A punkt 2). Reisen står i jobbens kort i attesteringen. Ingenting avvises. |
| Eldre app henter rader med kort-id på reise | Den tømmer verdien lokalt og sender tom verdi neste gang (FA53). Serveren regner samme svar på nytt. Raden skal ikke se endret ut av det; koderen måler det mot radversjonene (V19.9) og melder. |
| Eldre app viser reisen | I «Dagen», som i dag. |
| Eldre app og B33 | Den legger fortsatt ut og retur på prosjektet med flest timer. Serveren flytter ikke reise mellom prosjekter (A punkt 5). |
| Eldre app og B34 B | Underprosjektet og byggeplassen arbeideren valgte i den gamle appen, står. Serveren endrer dem ikke; den velger bare jobben. |
| Ny app mot eldre server | Den gamle serveren tømmer kort-id på reise (FA46). Ingenting feiler. Serveren deployes først. |

Telefonen sender ingen versjon (WM100). Regelen trenger ingen, fordi serveren regner likt for alle.

#### G. B33 A — utreisen på dagens første prosjekt, returen på dagens siste

- **Manuell reise på telefonen** (`DagSeksjon.tsx:80–96`): «flest arbeidstimer» erstattes. Tur får prosjektet
  til dagens første jobb, retur får prosjektet til dagens siste. Rekkefølgen er den samme som i A punkt 3.
  Byggeplassen og kjøretiden regnes mot det prosjektet. Bytter brukeren mellom tur og retur i reisevinduet,
  byttes prosjektet med. Har dagen ett prosjekt, er alt som i dag. Hører til **w12m**: samme fil og samme
  rekkefølgefunksjon som regelen i A.
  - Byggeplass og underprosjekt velger arbeideren i reisevinduet som i dag (B34 B). Prosjektet kan han ikke
    velge på telefonen (FA61). Om han skal kunne det, er B35.
- **Reise ført i Bekreft dag** (`BD:1768–1772`) gjelder ett prosjekt og står uendret.
- **GPS-forslaget** kjenner bare én destinasjon pr. økt (FA54). Regelen kan først bygges når forslaget kjenner
  flere opphold. Det er **L4-B** i timer-GPS-sporet, der den alt er vedtatt: første etappe går til første
  besøk, og returen regnes fra siste besøk (V7, `timer-gps-helhetsplan.md:371–372`). B33 A bekrefter det.
- **PC:** «+ Reise» står i prosjektkortet, og arbeideren velger dermed prosjektet selv. Uendret.
- **Serveren håndhever ikke B33.** Regelen er et forvalg i føringen.
- **Eldre apper:** som i dag, til de er oppdatert (del F). Attestanten ser hvilket prosjekt reisen står på,
  fordi den ligger i jobbens kort.

#### H. Tester som skal feile først

1. **Pr. skrivevei på serveren** (ekte Postgres): etter kallet har ingen reiserad på dagsseddelen tom kort-id.
   Veiene er de i FA46, og sletting av timerad. Rød i dag.
2. **Utfyllingen:** en fast dagsseddel med utreise og retur på et prosjekt med to jobber, reise på et prosjekt
   uten jobb, reise uten retning med og uten klokkeslett, en attestert reise, og en reise med underprosjekt på
   en dag med én jobb på samme underprosjekt og én på et annet. Riktig kort pr. rad, kjørt to ganger gir samme
   svar, `updated_at`, underprosjekt og byggeplass er urørt på alle rader, og gate-SQL 1–3 gir 0.
   - **Samme dagsseddel gjennom den delte regelen og gjennom SQL-utfyllingen gir samme kort pr. reiserad.**
     Regelen finnes to steder, og testen er det som holder dem like.
3. **Telefonen, pr. lokal skrivevei:** ny reise, redigert reise, lagret forslag, og rader hentet fra serveren.
   Reisen har kort-id etterpå. Rød i dag (FA53).
4. **Den delte regelen:** første og siste jobb etter klokkeslett; uten retning; ingen jobb; attestert rad
   flyttes ikke; ny tidligere jobb flytter utreisen; slettet jobb. Etter B34 B også:
   - lik underprosjekt går foran, så lik byggeplass — de fem radene i eksempelet i del A punkt 3;
   - reise uten byggeplass hopper over byggeplass-steget;
   - «flytt hele jobben» endrer ikke reisens underprosjekt, og plassen regnes på nytt;
   - regelen endrer aldri prosjekt, underprosjekt eller byggeplass på reiseraden.
5. **Eldre app:** to synker på rad med reise uten kort-id, og med tom kort-id etter henting. Raden står med
   jobbens kort-id etter hver synk, og ingenting avvises.
6. **Isolasjon:** reisen kobles aldri til en jobb på en annen dagsseddel, et annet prosjekt eller et annet
   firma. En prosjektleder får ikke attestert en reise utenfor omfanget sitt ved å sende id-en.
7. **Maskinregelen:** «høyst X t» og «Maskin over arbeid» er like før og etter at reisen har jobbens kort-id
   (testen finnes, `apps/web/src/__tests__/attestering-tabell-modell.test.ts:379`).
8. **Attesteringen:** reiselinja står sist i jobben uten knapper; ✓ på jobben sender reisens id; jobbradens
   timer er uten reise; kortets del 1–7 er uendret av reisen; del 8 vises; reise alene vises som eget kort.
   Reiselinja viser eget underprosjekt bare når det avviker fra jobbens. «Føres på» i del 8 bytter
   underprosjektet på reiseraden og ingen annen rad.
9. **Lønnsartvalget:** reiselinja tilbyr bare reisearter, arbeidslinja ingen.
10. Testene i FA59 snus.

#### I. Funksjonsinventar

- **BEVARES:** «+ Reise» der den står på PC og telefon, reisevinduet på telefonen med byggeplass- og underprosjektvalget
  (B34 B), tur og retur, overføring og reise under terskel som arbeidsrad (PC: se [vedtak-timer-web.md § Reisevinduet](../vedtak-timer-web.md)), rutemerket med km, minutter og kilde, avviksvarselet mot matrisen, klokkevinduet på reise (V8),
  reise utenfor norm, overtid og maskinregel, sletting og deling av en reiserad, ✂ på reiselinja, retting av
  reise i «Rediger jobben», reisekolonnen i rapport og eksport, Bekreft dag, dagskort-modus, telefonens
  attestering, og at reise ikke slettes med jobben.
- **FLYTTES:** reisen fra egen blokk til jobbens kort i attesteringen; fra «Dagen» til jobbens kort på
  telefonen.
- **NYTT:** «Føres på» i kortets del 8 — attestanten kan rette underprosjektet på reisen (B24, B10).
- **FJERNES:** reiseblokkens egne ✓ ↩ ↺ og avkrysning (reisen attesteres med jobben, B32 B). Ingenting annet.
- **Fjerner koderen noe annet: STOPP og meld.**

#### J. Rapport og eksport

Koblingen endrer ingen sum (FA57). Timerapporten og detaljeksporten følger prosjektet og underprosjektet på
raden, som før. Kolonnen «Kort» i eksporten (E2 i kort-id-specen, ikke bygget) skulle stå tom for reise; den
får jobbens nummer. Reisetimene står på underprosjektet arbeideren valgte, som i dag (B34 B). Når reisen ligger
i en jobb med et annet underprosjekt, viser eksporten derfor jobbens nummer og reisens eget underprosjekt på
samme linje. Attesterte rader røres ikke.
