> Del av [Timeføring på web — plan med bilder](../web-timeforing-plan.md): § 10. Seksjonsnumrene er de samme som før delingen.

## 10. Ikke målt

**Versjon 23 (§ 4.16 del G):**

- DG1–DG33 er lest, ikke kjørt. Ingenting er klikket. DG19 og serverdelen av DG22 er ikke stikkprøvd av Fabel.
- Om skjermen har en lenke som fører en firmaadmin til en annens dagsside, der arbeiderens egne skriveveier
  slipper ham inn (DG26). Serveren er lest, ikke skjermen.
- Om en ny rad i «Rediger sedel» faktisk kan lagres på et prosjekt dagen ikke har kort på (DG31).
  Prosjektvelgeren er lest, ikke kjørt.
- Om andre steder enn `opprett` og synken kan lage en dagsseddel for en annen (DG28), for eksempel forslag fra
  innsjekk.
- Hvordan en historikkpost for vare skrives når varene ligger i en annen database enn historikken (DG14, D2f).
- Om «Rediger sedel» på dagsseddelens side slipper gjennom en ny timelinje med reiselønnsart, og hva raden da
  mangler av reisespor (DG19).
- Om arbeideren kan rette og slette en linje attestanten har lagt til, når dagen returneres. Linja er en
  vanlig rad på dagsseddelen; veien er ikke kjørt.
- Om aktivitetsloggen ryddes (`retainedUntil`). «Korrigert av» leser bytte av underprosjekt fra loggen (DG21).
  Samme punkt som under versjon 19.
- Sjekkregler i SQL-migreringene for kort-id er ikke lest (DG8).
- Hvordan en ny linje i kort B oppfører seg mot overlappsperren når kort A og kort B står inntil hverandre i
  tid (DO13).
- Om attesteringens liste alltid bærer alle kortene på dagen når ett kort åpnes alene (B74). Et filter på
  prosjekt, status eller periode kan skjule et kort som flytteknappen skal vise. Ikke lest.
- Hva flytteknappen viser som navn når to kort på dagen har samme underprosjekt, eller begge har «Uten»
  (DG10). Navnet «→ TILL-001» skiller dem ikke. Koderen viser det i løsningen før kode.

**Versjon 19 (§ 4.15 del F–H, w15g og w15gm):**

- F79–F83 er lest, ikke kjørt (develop `d4c0eecd`). Ingenting er klikket.
- Hva merket viser når en linje er korrigert, dagsseddelen så er returnert, og arbeideren selv retter linja
  og sender på nytt. Historikken skrives bare av attestantens veier (F78), og dagsseddelen har ikke noe
  tidspunkt for «sendt» (F83). Merket kan da vise arbeiderens egen endring som korrigert. Koderen måler og
  melder før kode i w15g.
- Om en linje laget av «Del opp» eller ✂ får merket hos arbeideren. `hentRettedeFelter` leser forelderens
  historikkpost for rader laget av den gamle rettemåten (`KL:260–264`); de nye veiene er ikke lest for dette.
- Hva det koster å regne korrigerte felt for alle dagene i Mine timer. `list` gir mange dager, og
  `hentRettedeFelter` gjør ett oppslag for alle radene den får. Koderen måler.
- Om aktivitetsloggen ryddes etter en frist (`retainedUntil` står i skjemaet). Bytte av underprosjekt
  leses fra loggen (F78); ryddes den, mister linja merket for underprosjektet.
- Hvor mange linjer på test og i prod som er korrigert i dag. De får merket når w15g er ute (del F,
  raden «Starten»).
- Dagskort-modus i appen (`M/components/timer-detalj/TimerSeksjon.tsx`, 3 170 linjer) er ikke lest: hvor
  timelinja tegnes der. Bekreft dag (`BD`) er heller ikke lest for dette.
- Om attestanten kan rette på telefonen, og hvilken vei det går. Merket regnes av historikken, så en
  retting derfra får merket hvis veien skriver historikk.
- `v17-kortet-to-tilstander.png` er ikke tegnet om. Teksten «Ola varsles om det du endrer» i bildet er
  byttet i del F.

**Versjon 17 (§ 4.15 del E–H):**

- Ingenting er kjørt eller klikket. F46–F56 er lest i koden av Fabel mot develop @ `afdaa7ac`.
- F51 er lest, ikke kjørt: om en reise blir stående med underprosjekt fra et annet prosjekt etter
  `rettRadFelt` med bare nytt prosjekt. Koderen kjører testen i w15f (del H punkt 23).
- Om en vare kan være koblet til en reiserad. `apps/api/src/routes/vareforbruk.ts:75–84` holder varen mot
  timeradens dagsseddel og prosjekt; om raden kan være reise, er ikke lest. Kan den det, må w15f flytte
  varen med raden eller avvise byttet.
- Om tillegg og utlegg ført i et reisekort følger reisen når prosjektet byttes. De bærer egen kort-id og
  eget prosjekt (F35) og blir trolig stående. Koderen måler og melder før kode.
- Hvordan en reise under terskelen er lagret. Kontrollørens merknad i gate (112) sier at raden blir
  arbeid; Fabel har ikke lest det.
- Om telefonen kan bytte prosjekt på en reise som finnes, og hvordan den viser en reise som har fått nytt
  prosjekt på PC.
- Hva rutemerket i attesteringen (`ReiseRadMerke`) viser etter prosjektbytte. Byggeplassen er radens, og
  kjøretiden er den som ble lagret da reisen ble ført (F56).
- Hvor attesteringssiden leser omfanget og prosjektnavnene til prosjektlista (F50). Koderen måler i w15f.
- `tilfoyTimerRad` sjekker ikke at arbeideren er medlem av prosjektet (F53). Ikke rettet i planen; meldt
  til orkestrator.
- Tellingen (spørring 1–4 i § 4.15 del F) er fortsatt ikke kjørt. Den kjøres før Kenneth kjører migreringen
  for w15c (w15c er merget).
- Om pennens vindu på dagssiden (`TimerRadDialog`, som lagrer med `oppdaterTimerRad` på egen dagsseddel)
  kan brukes i attesteringen med `rettRadFelt` som lagring, eller om attesteringen får eget vindu med
  samme felt. Koderen måler og viser det i løsningen for w15f.
- Hvilke felt pennene for maskin og tillegg har på dagssiden. F63 lister feltene som er åpne i
  attesteringskortet; dagssidens vinduer for de to er ikke lest på nytt.
- F69–F78 er lest, ikke kjørt (develop `6163086f`).
- Om underprosjekt-knappene for hele jobben krever at dagsseddelen venter (F69 leste de fire andre veiene).
- Om lønnseksporten tar med en rad som er rettet, men ikke attestert.
- F68 er lest, ikke kjørt: om «Lagre endringer» i «Rediger arbeid» tømmer byggeplassen, og om kort-id
  endres. Om `hentForAttestering` sender radens byggeplass til vinduet. Koderen skriver testen først.
- F67 er lest, ikke kjørt: om «Rediger arbeid» viser rader fra to jobber med samme prosjekt og
  underprosjekt.
- Om reiseraden står i «Rediger arbeid», og med hvilken aktivitet. Skissen viser den fordi utvalget er
  prosjekt og underprosjekt (F67).
- Hvordan telefonen viser en rad som er rettet ved attestering: lest i F82 (versjon 19) — de nye verdiene, uten merke. Skjermen er ikke åpnet.
- Linjenumre i `WS` i F1–F37 er ikke lest på nytt etter w15a og w15b.

**Versjon 16 (§ 4.15 del E–H):** ⚠️ Punktene om kolonnen, valget og «Flytt til …» (punkt 4, 5, 7 og 8
under) er utgått med § 8.20.

- Ingenting er kjørt eller klikket. F36–F44 er lest i koden av Fabel. Søket i F45 er gjort av en
  leseagent og stikkprøvd.
- Om reisene GPS-forslaget lager på telefonen, bærer underprosjekt (B48). `dagsforslag.ts` er ikke lest
  for det.
- Tellingen (spørring 1–4 i § 4.15 del F) er ikke kjørt. Hvor mange reiser som bytter kort, er ukjent.
- Hvilke av veiene som skriver en timerad på nytt, som mister en ny kolonne (forsoning av forslag,
  «Rediger», ✂, «Del opp»). Bare synken er lest linje for linje (F39). Koderen måler hver vei i w15c.
- Om «Legg til timer-rad» sender kort-id på en reise fra «+ Timer» i et kort, slik planen forutsetter.
  F13 er lest for «+ Registrer timer»; `WS` er ikke lest på nytt i versjon 16.
- Om en ny jobb ført fra telefonen på samme sted som et reisekort med utlegg, havner i reisekortet
  (regel 3, eldste kort med samme nøkkel). Koderen måler i w15c.
- Om radversjonene (V19.9) ser en reise som endret når valget settes eller fjernes. Koderen måler og
  melder.
- Hvem som kan kalle prosedyren for «Flytt til …» på en dagsseddel som er sendt. Planen sier arbeideren
  på egen dagsseddel som kan rettes; attestanten har «Føres på». Koderen leser vaktene i `D` og melder.

**Versjon 15 (§ 4.15 del E–H):**

- Ingenting er kjørt eller klikket. F22–F35 er lest i koden av Fabel.
- Om migreringen 20261120120000 er kjørt på test og i prod (F28). Tellingen i § 4.15 del F er ikke kjørt;
  hvor mange reiser som står i en jobb på en annen byggeplass, er ukjent.
- Om serveren tar imot en vare uten timerad i et kort uten arbeid (F34). Bare klienten er lest.
- Om en utledet kort-id for en reise kan treffe en jobb som siden er flyttet til et annet sted og har
  beholdt id-en (F25). Koderen måler det i w15c og melder.
- Hva som skjer med tillegg og utlegg ført i et reisekort når reisen flytter inn i en jobb som lages med
  «+ Registrer timer» (ny kort-id). De blir trolig stående igjen i det gamle kortet. Det samme kan skje i
  dag for reise på et prosjekt uten jobb. Ikke løst i planen; koderen måler og foreslår i w15c.
- Om byttet fra reisens egen byggeplass til den effektive i regelen gir et annet svar for reise ført som
  timerad uten byggeplass (§ 4.15 del E).
- Hvor ofte en retur er ført fra en annen byggeplass enn dagens siste jobb (B44), er ikke talt.
  *Versjon 16: B44 er besvart; tallet trengs ikke for regelen.*
- Telefonen er ikke lest på nytt utover søket i F32.
- Hvilke felt «Rediger timer-rad» har for en reiserad (`WS:1461`), og om prosjektet kan byttes der.
  Reisevinduet åpnes bare for ny reise (`WS:1438`).
- Om serveren tar imot en reise fra tabellen der timene avviker fra firmaets kjøretid, og hvilken
  reisekilde raden da får (`apps/api/src/routes/timer/reise-sporbarhet.ts`). Koderen måler det i
  løsningen for w15b. Om attestanten får et merke når timene avviker, er ikke lest.

**Versjon 14 (§ 4.15):**

- Ingenting er klikket gjennom av Fabel. F1–F21 er lest i koden og holdt mot Kenneths åtte bilder.
- Hvilken knapp Kenneth brukte for linja til Narvik. «+ Registrer timer» er lest av resultatet (F13).
- Om serveren kontrollerer klokkeslettet på en reise mot dagens rader, eller bare kjøretiden mot tabellen
  (`apps/api/src/routes/timer/reise-sporbarhet.ts`). Koderen måler det i løsningen for w15b.
- Om midlertidig oppmøtested blir riktig for en overføring som starter nøyaktig kl. 12:00 (grensen i
  `OP:237` er «før 12»).
- Reisevinduet på telefonen har ikke tidsfelt som kan rettes, slik PC har ([vedtak-timer-web.md § Reisevinduet](../vedtak-timer-web.md), punkt 4). Ikke tegnet, ikke foreslått (§ 8.13).
- Dagskort-modus er ikke lest for de tre funnene; ingen av forslagene rører den.

**Versjon 13 (§ 4.14):**

- Ingen av tilbake-knappene er klikket gjennom i nettleser. Hvor hver knapp går, og hva sidemenyen lyser, er
  lest i koden.
- Om lenken på Mine timer til firmasiden (TK11) vises for andre enn SiteDoc-admin.
- Hvilken fane Malforvaltning åpner for en SiteDoc-admin som går tilbake fra en firmamal (TK16).
- Om en PSI-mal kan åpnes fra lista over sjekklistemaler, slik at TK19 gjetter feil.
- Om maskinlista og varelageret husker filter når du kommer tilbake (TK14, TK15).
- Andre veier til undersidene enn lenkene som er funnet med søk i koden: varsler, e-post og Ctrl+K-treff
  utenom dokumentsøket. De har ingen `?retur` og får reserven.
- Mobil: om noen tilbake-knapp går til en fast side i stedet for ett steg tilbake. De fire filene med
  tilbake-ikon uten `router.back()` er ikke lest.

**Versjon 12 (§ 4.13):**

- 🔴 **Telles før w3a bestilles** (lesespørring mot test og prod): maskinrader i `timer.sheet_machines` med
  `sheet_timer_id` satt, der underprosjektet eller byggeplassen avviker fra timeradens; og det samme for
  `varelager.vareforbruk`. Tallet sier om A7 bare er en mulighet eller alt har skjedd. Retting av rader som
  finnes, er en datamigrering og blir et eget spørsmål til Kenneth med tallet.
- Hvor mange maskinrader som har mengde i dag, og hvor mange prosjekter med timeføring som ikke har
  varelager, i test og prod (B37).
- Om en vare i varelageret trekker ned en beholdning når den føres på dagen. Det avgjør om transportert masse
  («5 m3 pukk» kjørt med lastebil) kan føres som vare uten bivirkning. Varelager-koden er ikke lest.
- Bristen i A7 er lest i koden og ikke kjørt: bytte av underprosjekt på en timerad med koblet maskin.
- Om `vareforbruk.hentMineForDato` sender `kortId` og `sheetTimerId`. Typen `KortVare` på dagssiden har dem
  ikke (`WS:1589–1595`). w3a trenger dem for å legge varen i jobben.
- Om `hentMedId` sender `kortId` på tillegg og utlegg. Typene på dagssiden har feltet bare på timer og maskin
  (`WS:143`, `:202`).
- Hvordan attesteringen viser en maskin med flere timer enn linja den er koblet til, når jobben har ordinær
  tid og overtid og maskinen føres med jobbens sum (w3b uten fordelingen, som kommer i w3c).
- Ingen av skjermene er klikket gjennom av Fabel. Bildene #1–#7 er Kenneths.

- Databasen: Kenneths rader fra 07.11, firmaets innstillinger i test, og om testfirmaet har PSI-modulen på.
- Nettleseren: høyden på maskinlinjene (WM21) er regnet fra koden. Ingen av dagens skjermer er klikket gjennom; trykkene
  i WM13 er talt i koden.
- Personvern-vurderingen for å bruke innsjekk-tid som forslag (B2). Vedtaket fra 15.11 åpner for forslag;
  grunnlaget er ikke lest i detalj her.
- Om en «Sist brukt»-liste for varer finnes på telefonen.
- ~~Om retting i attesteringen kan gi en maskin flere timer enn raden (§ 5).~~ Målt i versjon 6: ja (WM105).
- De to mulige feilene i WM40 og WM55 er lest i koden og ikke kjørt.
- Kjernens bredde er regnet fra minstebreddene (WM70), ikke målt i nettleser. Bredden på avkrysning og knapper er
  ikke lest. Bredden i WM50 er også regnet.
- Hvordan `tilfoyTimerRad` behandler en `kortId` serveren ikke kjenner (WM59). Telefonen lager nye kort via
  `syncBatch`; web-prosedyren er ikke lest til bunns.
- Om kolonneoppsettet lagres på serveren før brukeren endrer noe (WM69). Det avgjør hvor mange som ser kjernen uten
  «Tilbakestill til standard».
- Om firmaet kan endre selve dagsnorm-tallet. Valget på innstillingssiden heter «Fast (7,5 t)».
- Halvdag og helligdag på telefonen (WM65).
- Om web har en søkbar enkeltvelger som kan brukes for underprosjekt, eller om den må bygges.
- Hvordan telefonen skal vise mange underprosjekter. Den har bare knapper i dag (WM45); B11 er svart for web.
- Om en prosjektleder uten firmaadministrator-rolle i dag ser pennen og ✂ og får avslag fra serveren (WM54).
- WM1–WM56 er målt av leseagenter, og linjehenvisningene er stikkprøvd mot koden. WM57–WM73 er lest direkte i
  koden av Fabel.
- **Versjon 5, B14:** attesteringen etter w5 er ikke sett i nettleser av Fabel. «I dag» i bildet er tegnet etter
  koden. At tekstene kuttes (WM78), og høyden på en dag i alternativ A, er regnet.
- Hvordan luft mellom dagene løses i en tabell som tegner én rad om gangen (WM83). Koderen måler.
- **Versjon 5, B15:** databasen. Hvor mange firma som har mer enn én firmaadministrator, og om noen rad har
  `tillatt_selv_attestering` satt til «nei». Ingen kode skriver kolonnen (WM90).
- WM74–WM83 og WM90 er lest direkte i koden av Fabel. WM85–WM89, WM91 og WM92 er målt av en leseagent; stikkprøvd
  er skjemaet (`SK:248–256`, `:412–428`, `:2857–2875`), lønnsart-modellen, seedet og `attesteringsFirmaer`
  (`D:275–302`). Linjene for de elleve prosedyrene i WM89 og telefonen i WM92 er ikke stikkprøvd.
- Hvordan `syncBatch` fra telefonen forholder seg til attestering (B15).
- **Versjon 6, w9:** test-basen og prod er ikke lest. Ikke målt: hvordan END-002 kom på eksempeldagen etter 11.07.
  (WM94), og hvor mange jobber som i dag har flere maskintimer enn arbeidstimer. Tellingen gjøres før w9 bygges:
  pr. kort-id, maskiner uten enheten døgn, arbeid uten reise og erstattede rader; rader uten kort-id pr. bøtte.
- Hvor mange maskiner i prod som har enheten satt, og om alle Heatwork, aggregat og meisler står med døgn (WM102).
  Den lokale kopien har fem Heatwork med døgn og én gravemaskin uten enhet.
- Om enheten blir stående når krysset «Utleieobjekt» fjernes på maskinkortet (WM103). Lest som mulig i koden, ikke
  kjørt.
- At en seddel i brudd får all føring avvist (WM96), er lest i koden og ikke kjørt.
- WM93–WM95, WM101 og WM102 er målt eller lest av Fabel. WM96–WM100 og WM103–WM108 er målt av leseagenter;
  stikkprøvd er `validerMaskinUnderArbeid` og de åtte kallene, ✂-sjekken (`D:2988–3004`), bytte av underprosjekt
  (`D:6926–6942`, `D:715–726`), «Del opp» (`D:7052–7074`, `jobb-deling.ts:94–98`), sletting av timerad
  (`D:4736–4746`), synken (`D:9668–9702`), `kobledeMaskiner.ts:56–58`, `BD:1645`, `timerSync.ts:714–727`,
  `RedigerRadModal.tsx:640–661`, `kortGruppering.ts:124–128` og utleiefeltene på maskinen. Ikke stikkprøvd:
  `D:9970` og `:10137` (WM99), `WS:5071–5102`, `RegistreringPanel.tsx`, `AT:644–724` og `bekreftDag.ts:233–262`.
- **Versjon 8:** ingenting er kjørt i nettleser eller mot en database. FA1–FA4, FA7–FA10, FA12–FA14, FA17, FA18
  og FA21 er lest av Fabel. FA5, FA6 (linjene), FA11, FA15, FA16, FA19, FA20 og FA22–FA27 er målt av leseagenter;
  stikkprøvd er `krevAttesteringsrett`, `kanAttestereFirma`, `organisasjon.hentSetting`, de to detaljsidenes
  sperre, `firma/layout.tsx`, `firma/timer/layout.tsx`, `FN:33–95`, `SE:166–190`, `kortGruppering.ts:123–126`
  og G8 i kort-id-specen.
- Om noen bruker attesterer for flere firma uten å være firmaadministrator (FA14, § 4.6 punkt 9).
- Hvordan serveren regner `ukenorm` og `overtidsgrunnlag`, og om tallene avhenger av sedler prosjektlederen ikke
  får (§ 4.6 punkt 5).
- Hva serveren gjør med raden når en reiserad får en arbeidsart i kortet, eller omvendt (FA21).
- Om telefonens attestering lar én rad attesteres alene (§ 4.5 punkt 5).
- Hover-tekstene utenom Timer, Attestering og HMS er ikke holdt mot sidene av Fabel (§ 4.8).
- Hvordan en prosjektleder slipper inn på attesteringen uten at firmaadministrator-rammen åpnes (§ 4.6 punkt 7).
  Koderen foreslår det i løsningen før kode.
- **Versjon 9:** ingenting er kjørt i nettleser eller mot en database. Testdagen 13.05. er ikke lest av Fabel;
  at teksten står i dagens «Kommentar», er målt av orkestrator (FA44).
- FA16 (skjemaet og `D:4029`), FA18, FA30, FA34, FA38, FA40, FA42 og deler av FA20, FA35, FA36, FA39, FA41 og FA43
  er lest av Fabel. Resten av FA20 og FA28–FA33, FA35–FA37 og FA39 er målt av leseagenter; stikkprøvd er
  `DagSeksjon.tsx:80–96`, `dagsforslag.ts:1168–1171`, V9 og K8 i `timer-gps-helhetsplan.md`,
  `fase-0-beslutninger.md:1054`, `rapport.ts:298–323`, `D:700–706` og `D:1055–1059`.
- Ikke stikkprøvd: `ReiseRadMerke.tsx`, `rapport.ts:631–668`, `kortBeskrivelse.ts`, `bekreftDag.ts:115–119`,
  `TimerSeksjon.tsx:1751–1761`, `NY:345–356`, `WS:5562–5570` og `ArbeidstidSeksjon.tsx:204`.
- Om «Rediger jobben» (`redigerSedelRader`) mister beskrivelsen når en rad slettes og legges til på nytt (FA41).
  Koderen måler og melder.
- Om en reiserad kan få nytt prosjekt i attesteringen i dag (pennen på en reiselinje), og hva som da skjer med
  retning og rute.
- Hvor mange dager i test og prod som har reise på mer enn ett prosjekt (FA18), og hvor mange sedler som har
  tekst i dagens «Kommentar» uten tekst på radene.
- § 4.10: se «Ikke målt» nederst i delen.
- **Versjon 11:** ingenting er kjørt. FA60–FA70 er lest av Fabel i kildefilene. Ikke lest: resten av
  `flyttTimerRadEco` etter `D:6606` (om grenen for én rad tar en reiserad, FA65). Koderen måler det før «Føres
  på» bygges. Ikke talt: hvor mange jobber som har både byggeplass og underprosjekt, og hvor mange som har
  ingen av dem. Ikke lest: om «+ Registrer timer» (w2) og Bekreft dag på telefonen tilbyr de samme valgene som
  timerad-vinduet og «+ Nytt kort» (FA66, FA67).
- **Versjon 10:** ingenting er kjørt i nettleser, på telefon eller mot en database. Tellingen i § 4.11 del E er
  ikke kjørt; hvor mange reiserader som blir stående alene i eget kort, er ukjent.
- FA45–FA59 er målt av tre leseagenter. Lest eller søkt av Fabel: `KI:176–300`, `KG:60–324`, `D:698–708`,
  `:3284–3288`, `:4138–4147`, `:6697–6701`, `:9668–9676`, `:9783–9789`, at sletting av timerad ikke kaller
  `sikreKortId`, `AM:473–505`, `:539–547`, `RP:52–70`, `:105–141`, `AT:482–490`,
  `packages/shared/src/utils/kortId.ts:225–262`, `maskinKapasitet.ts:90–112`, `reise-sporbarhet.ts:285–345`,
  `kortIdNormalisering.ts:78–126`, `radLagring.ts:166–182`, `timerSync.ts:946–954`, `kortRadFlytt.ts:345–355`,
  `dagsforslagAnvend.ts:264–271`, `BD:2219–2225`, underprosjektvalget i de to reisevinduene, og at ingen
  migrering har `CHECK` på kort-id.
- Ikke stikkprøvd: linjene i FA46 utenom tre, `D:6888`, `:7083`, `:7466`, `dagsforslag.ts:1166–1171` og
  `:1964–1987`, `AttesteringDetaljMobil.tsx`, testlinjene i FA59 og `rapport.ts`.
- Om en rad ser endret ut for synken når en eldre app sender tom kort-id på en reise serveren har koblet
  (§ 4.11 del F). Koderen måler mot radversjonene.
- Om en reiserad kan få nytt prosjekt i attesteringen i dag (står fra versjon 9).
- Hvor byggeplassen på en reiserad settes i synken, og om den alltid hører til reisens prosjekt.
- Telefonens kort med reisen er ikke tegnet. Koderen leverer skjermbilde i løsningen før kode (§ 4.11 del D).
