> Del av [Timeføring på web — plan med bilder](../web-timeforing-plan.md): § 4.17 del I–L. Seksjonsnumrene er de samme som før delingen.

#### Del I — «Del opp»: ett kort til to

> ⚠️ **Lest mot versjon 23 (2026-11-24).** Vinduet «Del opp» er utgått (Kenneth 2026-11-23, B70 ja). Etter
> delingen står begge kortene åpne og redigerbare side om side, uten kobling i data (B69 ja). Det som gjelder,
> står i § 4.16 del G med leveransene D2a–D2f. Der teksten under sier «vinduet» og «D1», er den historikk.
> **B63 er dekket** av B68 (linjer flyttes mellom kortene) og B71 og B72 (attestanten legger til linjer, også
> varer og utlegg, hver gang et kort redigeres). **B64 er dekket** av B69 (ingen kobling i data) og B70 (vinduet
> der koblingen bodde, er utgått). **B65–B67 er besvart med A** (Kenneth 2026-11-24, § 8.29): konflikten
> mellom kort og sperren i attesteringen er leveranse KF1 (nederst i del I).

| | Status | Kilde |
|---|---|---|
| Knappen «✂ Del opp» i registreringen | ✅ Bygget | `RegistreringPanel.tsx:327–337` (DO1) |
| Blokk med ett klokkeslett, underprosjekt for B og forhåndsvisning av timene | ✅ Bygget | `RegistreringPanel.tsx:774–847` (DO2, DO5) |
| Serverens `delJobb`: del A beholder kortet, del B får ny kort-id | ✅ Bygget | DO3, DO6, DO17 |
| Maskin og varer blir i A | ✅ Merget `e4b1208f` | § 8.22 |
| Maskin uten fra–til i «Del opp» | ✅ Merget `2ed0259a` | § 8.22 |
| **Vinduet med kort A og kort B side om side**, begge justerbare før lagring | ⚠️ Utgått 2026-11-23 (B70 ja) | § 4.16 del G |
| **Fra, til og pause pr. del, og prosjekt og byggeplass for B** på serveren | 🟡 Ikke bygget | § 4.16 del C (DO3, DO4, DO13) |

- **Plass i strukturen:** «Del opp» hører til jobben. Den nås i dag med to trykk: åpne registreringen, så ✂.
  B62 A (Kenneth 2026-11-23): ✂ står også på jobbraden, og på dagsraden når dagen har én jobb, og åpner «Del
  opp» i kortet.
- **Kravene er de samme** (DO9): attesteringsrett, ikke egen dagsseddel, «rediger ved attestering» på, dagen
  sendt, og alle linjene i jobben venter. ✂ vises bare når kravene er oppfylt.
- ⚠️ **D1 er utgått.** Neste ordre for «Del opp» er D2a (§ 4.16 del G). Sperren og merket for konflikt (under)
  er leveranse KF1. Den rører attesteringstabellen, så rekkefølgen mot A5 avklares i ordren (A1–A4b er merget
  2026-11-24).

**Kenneth 2026-11-22 om «Del opp» ved attestering (ordrett):** «dersom dette gjelder ved attestering -> da åpner
vi en kopi av det andre kortet, det endring av arbeidstid i kort 1, endrer i det kortet 2 automatisk. endinger i
kort 2 påvirker ikke endringer i kort 1. Kort 2 må bygges på ny med underprosjekt, varer, utlegg/tillegg, maskin
og reisetid.»

Lest mot § 4.16 (vedtatt 2026-11-21). Kort 1 er kort A, kort 2 er kort B.

| Kenneths ord | Lest som | Mot § 4.16 |
|---|---|---|
| «åpner vi en kopi» | Kort 2 åpnes i vinduet som en kopi av kort 1 sin ramme: prosjekt, byggeplass og arbeidstiden som er igjen etter delingen. | **Likt.** Prosjekt og byggeplass på B er fylt ut fra A. |
| «endring av arbeidstid i kort 1, endrer i kort 2 automatisk» | Når «Til kl.» på kort 1 endres, settes «Fra kl.» på kort 2 til samme klokkeslett, og kort 2 får resten av jobbens tid. Kort 1 styrer alltid, også etter at kort 2 er rettet for hånd. | **Likt** den veien. |
| «endringer i kort 2 påvirker ikke kort 1» | «Fra kl.», «Til kl.» og pause på kort 2 er kortets egne felt. Rettes de, står kort 1 urørt. | ⚠️ **Endrer § 4.16 del B:** der er «Til kl.» på A og «Fra kl.» på B én verdi, og «endres den ene, endres den andre». Nå går den bare fra kort 1 til kort 2. |
| «Kort 2 må bygges på ny med underprosjekt …» | Underprosjektet kopieres ikke. Kort 2 åpnes med «Uten underprosjekt», og attestanten velger. | ⚠️ **Endrer § 4.16 del B:** der er underprosjektet på B fylt ut fra A. |
| «… varer, utlegg/tillegg, maskin og reisetid» | Ingen av dem følger med til kort 2. De blir i kort 1 og føres på nytt på kort 2. | **Likt:** «vinduet deler bare arbeidet», maskin og varer blir i A (merget `e4b1208f`). Hvem som fører dem på kort 2, og hvor, er B63. |

**Følger av at kort 2 har egne klokkeslett:**

- Starter kort 2 senere enn kort 1 slutter, føres ikke tiden imellom. Vinduet sier det: «0,5 t mellom kortene
  føres ikke».
- Starter kort 2 før kort 1 slutter, overlapper de to kortene hverandre. Det kan ikke lagres (B65 A): kortet
  sier hvorfor, og «Lagre» er av til tidene er rettet (§ 4.16 del G punkt 10).
- ⚠️ Overlapper kort 1 eller kort 2 et annet kort på dagen, avvises ikke lagringen (Kenneth 2026-11-22, under;
  B66 A gjør det til regelen for alle attestantens rettinger). Her sto det at lagringen avvises med
  overlapp-regelen som finnes (DO13).
- Serveren trenger ett felt til i § 4.16 del C: start på kort 2 (`fraTidB`). Utelatt er den lik det felles
  klokkeslettet, som i dag.

**Hva attestanten kan føre på et kort i dag (lest i koden):** «✎ Rediger jobben» lagrer med `redigerSedelRader`,
som tar nye timelinjer, tillegg og maskiner (`apps/api/src/routes/timer/dagsseddel.ts:2951–2990`). Varer og
utlegg tar den ikke. Om vinduet har knapper for å legge til alle tre, er ikke målt.

**To spørsmål om kort 2:** B63 (hvem bygger kort 2, og hvor) og B64 (gjelder koblingen bare i vinduet) er
dekket av B68–B72 (øverst i del I, § 8.27).

**Kenneth 2026-11-22 om tidsrom og konflikt (ordrett):** «kort har 10 timer arbeid-> del opp-> kort 1: 5 timer,
kort 2: 5 timer / kort 1 endres / Kort 1: 8 timer, kort 2: 2 timer / Kort 1: 8 timer Kort 2 endres: 3 timer -> hva
gjør vi nå dersom det fantes et kort innenfor dette nye tidsrommet? -> hva skjer med potensielt doble timer i annet
prosjekt -> varsler vi at det er konflikt og aksepterer? ->konflikt må bli stående i kortet til annet prosjekt også
er rettet før attestant kan godkjenne dagen»

**Eksemplet, steg for steg** (jobben er 07:00–17:30 med 30 min pause):

1. Jobben er 10 t. «Del opp» gir kort 1 med 5 t og kort 2 med 5 t.
2. Kort 1 rettes til 8 t (07:00–15:30). Kort 2 følger med og blir 2 t (15:30–17:30).
3. Kort 2 rettes til 3 t (15:30–18:30). Kort 1 står på 8 t. Kort 2 slutter nå én time etter at jobben sluttet.
4. Arbeideren har et kort til på et annet prosjekt, 17:30–19:00. Mellom 17:30 og 18:30 står han på to kort.

| Kenneths ord | Lest som | Mot det som står |
|---|---|---|
| «Kort 1: 8 timer, kort 2: 2 timer» | Kort 1 styrer kort 2. | **Likt** tabellen over. |
| «varsler vi at det er konflikt og aksepterer?» | Ja. Overlapper kort 1 eller kort 2 et annet kort på dagen, også et kort på et annet prosjekt, sier vinduet det, og «Lagre» virker. | ⚠️ **Snur** § 4.16 del C («En flyttet ytterkant overlapper … avvises») og linja som sto her i del I. ⚠️ Snur også, for attestantens «Del opp», den harde sperren fra 2026-07-09 (OV1). |
| «konflikt må bli stående i kortet til annet prosjekt også er rettet» | Konflikten står i begge kortene til ett av dem er rettet. Den regnes av klokkeslettene hver gang dagen vises, og lagres ikke som eget felt. | Nytt. Bygger på varselet fra 2026-11-15 (OV4). |
| «før attestant kan godkjenne dagen» | Ingen kan attestere noe på datoen mens en konflikt står. | Nytt. Samme mønster som de to sperrene som finnes (OV5). |

**Målt mot develop @ `91711bda`** (lest av Fabel, ikke kjørt). `D` er `apps/api/src/routes/timer/dagsseddel.ts`
med linjene fra denne hashen; i § 4.16 del A er linjene fra `310ecf43` (`delJobb` står nå på `D:7204`). `TV` =
`packages/shared/src/utils/tidsromValidering.ts`, `ATL` = `apps/web/src/components/attestering/attestering-tabell.ts`,
`DS` = `apps/web/src/app/dashbord/timer/[id]/page.tsx`.

| | Målt | Kilde |
|---|---|---|
| OV1 | ⚠️ **Vedtatt endret for attestanten (B66 A, 2026-11-24):** attestantens veier (`redigerSedelRader`, `rettRadFelt`, `delJobb`) skal varsle og godta overlapp mot et kort attestanten ikke kan rette (KF1); mot et kort han kan rette, er det en sperre (B88 ja). Arbeiderens veier og appens synk beholder sperren. Målingen under er koden i dag. **Overlapp er en sperre ved lagring på alle skriveveier,** på tvers av prosjekt innen samme dagsseddel («hard sperre — Kenneth 2026-07-09»). Berøring i endepunktet er lov. Gjelder arbeiderens rader (`tilfoyTimerRad`, `oppdaterTimerRad`), jobbens tid (`lagreJobbTid`), forsoningen (`forsonDagskort`), attestantens retting (`redigerSedelRader`, `rettRadFelt`) og appens synk (`syncBatch`). | `D:2473–2510`, `:4282–4284`, `:4557–4559`, `:4867–4880`, `:5327–5340`, `:3160–3168`, `:9891–9905` |
| OV2 | **Regelen er delt** mellom server, web og app: `finnOverlappendeTidsrom` og `finnTidsromKonflikt`. Reise er en timerad og telles med. | `TV:57–103` |
| OV3 | **`delJobb` kaller ikke sjekken** (som DO13). | Søk i `D:7204–7433` (ingen kall) |
| OV4 | **Varselet fra 2026-11-15 finnes på arbeiderens dagsside:** en gul linje over kortene i prosjektkort-modus, også når dagen er sendt. Den viser den første konflikten med de to tidsrommene, uten kortnavn, og står ikke i kortene. Attesteringen har ikke varselet. | `TV:113–133`; `DS:597–599`, `:1484–1488`; søk i `ATL` (ingen treff på radoverlapp) |
| OV5 | **Attesteringen har to sperrer på datoen:** uavklart overlapp mellom PC og mobil, og fravær over normen. Begge stopper ✓ for alle linjer på datoen, står i Avvik-kolonnen, og sjekkes på serveren i begge attesteringsveiene. | `D:1551–1566`, `:7501`, `:7511`, `:8673`, `:8732`; `ATL:316–318`, `:691` |
| OV6 | **Ingen av sperrene ser på to rader som overlapper.** En dag med overlapp fra før sperren kom, kan attesteres i dag («eksisterende overlapp retro-avvises ikke»). | `D:2478` |
| OV7 | **Attestantens ✎ og «✎ Rediger jobben» sender alle dagens ventende timerader** og avvises hvis to av dem overlapper. Står det en konflikt på dagen, avvises derfor enhver retting som ikke fjerner den, også på et annet kort. | `D:7836–7843`, `:3143–3168` |
| OV8 | **Begge attestantene ser samme dag.** Attesteringslista gir dagssedler med minst én rad på attestantens prosjekter, med alle dagens rader. Rader utenfor prosjektene hans kan han ikke handle på, og prosjektnavnet vises bare der han har innsyn. Attestanten er alltid i dagsseddelens firma. | `D:6479`, `:6492`, `:6593–6595`, `:250–254`; `ATL:673–675` |
| OV9 | **Retur setter hele dagsseddelen til «returnert».** Bare radene som returneres, får status returnert; de andre står som ventende. Hva arbeideren kan rette på de ventende radene etter en retur, er ikke målt. | `D:7690–7723` |
| OV10 | **Appen:** `syncBatch` avviser et sett der to rader overlapper. Hva appen viser og sender når arbeideren åpner en returnert dag med konflikt, er ikke målt. Mobil er utenfor ordren. | `D:9891–9905` |

**I vinduet:**

- Overlapper kort 1 eller kort 2 en rad utenfor jobben, på et kort attestanten ikke kan rette, står en gul linje i kortet det gjelder: «Overlapper
  17:30–19:00 på 2207 — Brygga. Dagen kan ikke attesteres før ett av kortene er rettet.» «Lagre» er på.
- Forhåndsvisningen fra serveren bærer konfliktene, så vinduet og serveren bruker samme regel (OV2).
- Overlapp mellom kort 1 og kort 2, eller mot et annet kort han kan rette, kan ikke lagres (B65 A, B88 ja).

**Etter «Lagre», i attesteringen:**

```
fr. 22.11 · Kari Nordmann                           Avvik: Sperre — to kort overlapper
  2301 — Skolen    07:00–15:30   8,0 t
  1050 — Hallen    15:30–18:30   3,0 t              Konflikt: 17:30–19:00 på 2207 — Brygga
  2207 — Brygga    17:30–19:00   1,5 t              Konflikt: 15:30–18:30 på 1050 — Hallen
```

- **Dagsraden bærer sperren** i Avvik (kolonne 11 i Bilde 6), som de to sperrene som finnes (OV5). ✓ er av for
  alle linjer på datoen, for alle attestanter. ↩ og ✎ virker.
- **Begge jobbradene får merket «Konflikt»** med det andre kortets klokkeslett og navn. Har attestanten ikke
  innsyn i det andre prosjektet (OV8), står «et annet prosjekt» i stedet for navnet.
- **Serveren får en tredje vakt** i `attesterRader` og `attester`, ved siden av de to som finnes (OV5). Den
  teller alle dagens timerader med klokkeslett som ikke er erstattet, samme utvalg som sperren ved lagring
  (`D:2493–2499`).
- **Konflikten forsvinner av seg selv** når ett av kortene er rettet, fordi den regnes av klokkeslettene. Ingen
  ny kolonne i databasen.
- **Er det andre kortet alt attestert, og på et prosjekt attestanten ikke kan rette,** godtas lagringen likevel.
  Har han rett på det, er det en sperre (lesningen av B88 i § 8). Kort 2 kan ikke attesteres før det er rettet,
  eller det andre kortet er gjenåpnet (↺, `gjenaapneRader`, `D:8035`) og rettet. Dobbelttimen kan dermed ikke bli
  attestert på begge prosjektene.

**Hvem ser konflikten, og hvor:**

| Hvem | Hvor | Hva | Finnes i dag |
|---|---|---|---|
| Attestanten som deler | «Del opp»-vinduet, før «Lagre» | Den gule linja i kortet, med følgen. | Nei |
| Samme attestant, etterpå | Attesteringen: dagsraden og begge jobbradene | Sperren og merket «Konflikt». | Nei. Sperre-mønsteret finnes (OV5). |
| Attestanten på det andre prosjektet | Attesteringen hans. Dagen står der fordi den har en rad på hans prosjekt (OV8). | Det samme. Han får ikke beskjed utenom lista (B67 A). | Nei |
| Firmaadministrator | Attesteringen | Det samme, med alle prosjektnavn. | Nei |
| Arbeideren | Dagssiden: den gule linja over kortene (OV4), også mens dagen er sendt. «Korrigert av» på kort 1 og kort 2 (DO16). | De to tidsrommene, uten kortnavn. | Ja. Dagssiden røres ikke (ordrens grense). |

**Kenneth 2026-11-24, ordrett: «B65 A, B66 A, B67 A»** (§ 8.29):

- **B65 A:** kort A og kort B i samme deling kan ikke lagres med overlapp mot hverandre (§ 4.16 del G punkt 10).
- **B66 A:** «varsles og godtas» gjelder alle attestantens rettinger av klokkeslett: ✎ på linja og «Rett
  reisen» (`rettRadFelt`, `LinjeRettVindu.tsx:70`, `ReiseRettVindu.tsx:114`), «✎ Rediger jobben»
  (`redigerSedelRader`, `RedigerRadModal.tsx:430`) og «Del opp» (`delJobb`). Arbeiderens egen føring på
  dagssiden og i appen beholder sperren. Erstatter sperren for attestanten i OV1.
- **B67 A:** ingen varsling til attestanten på det andre prosjektet. Han ser sperren og merket i attesteringen
  sin; attestanten som laget konflikten, følger opp. Følgen er at en konflikt kan bli stående hvis ingen følger
  opp, og da står dagen uattestert.
- **B88 ja** (Kenneth 2026-11-24, ordrett «B88 ja», § 8.30): overlapp mellom to kort attestanten kan rette, er en
  sperre, også utenfor paret og etter at paret er lukket. Bare overlapp mot et kort han ikke kan rette, varsles og
  godtas. Serveren avgjør det av attesteringsretten.

**Leveranse KF1 — konflikt varsles og godtas ved attestantens retting** (B65 A, B66 A, B67 A, B88 ja). Server og web.
Ingen migrering: konflikten regnes av klokkeslettene og lagres ikke. Etter D2a, fordi paret (B65) finnes først
der. Rører attesteringstabellen, så rekkefølgen mot A5 og H1a–H1c avgjøres i ordren (A1–A4b er merget
2026-11-24). Køen fra orkestrator 2026-11-24 står i § 4.17 del E.

- **Attestantens veier varsler og godtar:** `rettRadFelt`, `redigerSedelRader` (`utforRedigerSedelRader`) og
  `delJobb` lagrer selv om kortet overlapper et kort på dagen som attestanten ikke kan rette. Svaret og forhåndsvisningen bærer
  konfliktene, så vinduet viser den gule linja før «Lagre» med samme regel som serveren (OV2).
- **Sperre mot kort attestanten kan rette (B65 A, B88 ja):** overlapper kortet et annet kort på dagen som han
  også kan rette, avvises lagringen, og svaret navngir kortet. Det gjelder i paret etter «Del opp», i et kort som
  er åpnet alene og etter at paret er lukket. Serveren avgjør det av attesteringsretten, ikke av paret (B69). Målt
  mot develop `ec303c15`: én gang pr. dagsseddel slår veien opp `attesteringsOmfang(userId, sheet.organizationId)`
  (`dagsseddel.ts:318`) og deler dagens andre kort i dem han kan rette (omfanget er «alle», eller prosjektet står
  i lista) og dem han ikke kan rette. Kort uten prosjekt avgjøres av `kanAttestereFravaer` (`:391`), som i
  `krevAttesteringsrett` (`:561`). Det er den samme retten som rettingsvakten bruker (`krevRettingVedAttestering`,
  `:634`, via `attesteringsFirmaer`, `:280`), så sperren og vakten kan ikke være uenige. Vinduet viser sperren før
  «Lagre» av forhåndsvisningen (OV2); i paret er «Lagre» av (§ 4.16 del G punkt 10). For firmaadministrator og
  sitedoc_admin er all overlapp på dagen en sperre.
- **Rettingene tåler en konflikt som står** (OV7): en retting avvises ikke fordi to andre rader på dagen alt
  overlapper.
- **Arbeiderens veier beholder sperren:** `tilfoyTimerRad`, `oppdaterTimerRad`, `lagreJobbTid`, `forsonDagskort`
  og `syncBatch` (OV1). Vakt-test for hver av dem.
- **Sperren og merket i attesteringen**, som beskrevet over: dagsraden bærer sperren i Avvik, begge jobbradene får
  «Konflikt», og serveren får en tredje vakt i `attesterRader` og `attester` (OV5).
- **Ingen varsling** (B67 A): ingen e-post, ingen push og ingen melding utenom attesteringslista.
- ⚠️ **Gamle dager med overlapp blir sperret** den dagen vakten kommer (OV6). Hvor mange slike dager som venter
  på attestering i test og prod, er ikke målt. Tallet hentes før KF1 bestilles; Fabel har ikke tilgang til
  basene.
- ⚠️ **Ikke målt, koderen måler før kode:** hva arbeiderens veier gjør når han retter en annen rad på en
  returnert dag der attestanten har lagret en konflikt (OV9), og om `syncBatch` avviser hele dagen fra appen da
  (OV10). Avviser den, kan arbeideren ikke rette dagen i appen, og det legges fram før kode.
- **Arbeiderens dagsside står som den er.** Den gule linja viser bare den første konflikten og navngir ikke
  kortene. Skal konflikten stå i hvert kort også der, er det en egen ordre på dagssiden.
- Rører `D` (de tre veiene, forhåndsvisningen, attesteringslista og de to attesteringsveiene), `TV`, `ATL`, `AT`,
  `MT`, `LinjeRettVindu.tsx`, `ReiseRettVindu.tsx`, `RedigerRadModal.tsx`, i18n og hjelpeteksten. Ikke
  `apps/mobile`. **Regel 10 kjøres uavhengig i gaten:** en sperre på lønnsveien flyttes.
- ⚠️ `v21-del-opp.png` tegnes ikke om; vinduet er utgått. Koderen leverer skjermbilde av konfliktlinja i
  kortene før kode.

**Tester som skal feile først (KF1):**

| Test |
|---|
| Attestanten retter fra–til med ✎ slik at linja overlapper et kort på et prosjekt der han ikke har attesteringsrett: lagringen godtas, og svaret bærer konflikten. |
| Det samme med «✎ Rediger jobben», «Rett reisen» og «Del opp». |
| Arbeideren lagrer den samme overlappen på dagssiden og i `syncBatch`: avvist som i dag (vakt-test). |
| Paret etter «Del opp»: kort B med «Fra kl.» før «Til kl.» på kort A har «Lagre» av, og linja sier hvorfor. |
| B88: kort B åpnet alene, eller etter at paret er lukket, rettes slik at det overlapper kort A: serveren avviser lagringen, og svaret navngir kort A. |
| B88: to kort på to prosjekter der attestanten har attesteringsrett på begge, ikke et par: overlappen avvises av serveren. Mister han retten på det ene prosjektet, godtas den samme overlappen med konflikt. |
| B88: firmaadministrator retter et kort slik at det overlapper et kort på et hvilket som helst prosjekt i firmaet: avvist. |
| B88: det andre kortet er attestert og på et prosjekt han har rett på: avvist (lesningen i § 8). |
| En dag med konflikt kan ikke attesteres, verken med ✓ eller «Attester utvalget», for noen attestant. Etter at ett av kortene er rettet, kan den. |
| En retting av et tredje kort på en dag der to andre kort alt overlapper, godtas (OV7). |
| Ingen e-post og ingen varsling sendes når konflikten lagres (B67 A). |

**Åpne spørsmål:** ingen. B63–B67 og B88 er besvart eller dekket (§ 8.27, § 8.29, § 8.30). Én lesning av B88 står
i § 8.

#### Del J — enkel attestering som et menneske leser

**Tre alternativer** (bilde `v22-enkel.png`), rangert:

| | A — tabellen fra Bilde 6 med hurtigvalg | B — én setning pr. dag | C — ett varsel om gangen |
|---|---|---|---|
| Rang | **1 (anbefalt)** | 3 | 2 |
| Trykk for vanlige dager | 2 pr. ansatt: krysset på ukelinja og «Attester utvalget» (B57) | 46, eller som A | Som A, før gjennomgangen |
| Trykk for å rette et varsel | 2 + «Lagre» | 3–4 | 2 + «Lagre» |
| Leses raskt | Ja, når merkene er få. Tallene står under hverandre. | Lettest første gang. Tallene kan ikke sammenlignes. | Ja, men uten uka rundt dagen. |
| Bilde 6 | Står | Brytes: kolonnevalg, sortering og filter faller bort på oversiktsnivået (B9) | Står, men får en ny flate ved siden av |
| Rører | `AT`, `MT` | `AT`, `TR` bygges om | Ny komponent, `AT` |

**Kenneth 2026-11-23: A (B59).** Den bygger på det som er vedtatt og bygget, og gir samme antall trykk som C. Det
beste fra C tas med i A: varselet forklares i klartekst, og handlingen står i varselet.

**Fem grep i A** (grep 2 er utgått):

1. 🟡 Ikke bygget (A5). **Statuslinja sier hva som gjenstår:** «Uke 47 · 54 dager venter · 46 uten varsel · 8 med varsel». Trykk på
   «8 med varsel» viser bare dem. Filteret finnes i dag i hodet på Avvik-kolonnen (`AT:750–752`).
2. ⚠️ **Utgått (B57).** ~~«Attester N uten varsel»~~. Kenneth valgte ingen ny knapp.
3. ✅ **Bygget i A4** (`b69918a9`). **Krysset på ukelinja** (B57): krysset velger alle dagene til den ansatte,
   og «Attester utvalget (N)» attesterer dem. To trykk (`AttesteringTabell.tsx:560`, `:678` @ `0305eeb4`; i18n
   `timer.attestering.tabell.uke.velgUka` og `timer.attestering.tabell.attesterUtvalget`).
4. 🟡 Ikke bygget (A5; for «Reise under terskel»: A3b). **Handling i varselet** (B60 A): trykk på «1,0 t kan trekkes» viser forklaringen og knappen «✎ Gjør om 1,0 t
   til ordinær tid …». Overtidslinja er 2,5 t (15:00–17:30). Handlingen deler den ved klokkeslettet som gir
   1,0 t (15:00–16:00) og setter ordinær lønnsart på den delen. Vinduet åpnes ferdig utfylt; attestanten kan
   rette klokkeslettet og trykker «Lagre». Ingenting lagres uten attestantens trykk. Etter lagringen er merket
   «kan trekkes» borte (B85 ja, del B). Delingen og lønnsarten kan lagres i én lagring med ruta som finnes
   (målt, del G). Handlingen for «Reise under terskel» er «✎ Før som arbeidstid …» (B83 ja, del D, A3b).
5. 🟡 Ikke bygget (A5). **Ferdige returgrunner** (B61 A): returvinduet har i dag bare et påkrevd tekstfelt (`AT:912–941`). Forslag:
   knapper for «Feil timer», «Feil prosjekt eller underprosjekt», «Mangler beskrivelse», «Overtid ikke avtalt»
   og «Annet», med valgfri kommentar. «Annet» krever kommentar. Grunnen skrives inn i kommentaren arbeideren
   får; serveren er uendret.
6. 🟡 Ikke bygget (A5, etter D2a). **✂ på jobbraden** (B62 A, del I).

**Leseregler for raden** (gjelder A1–A5):

- **Raden leses som en setning:** hvem · når · hvor · hva · hvor mye · varsel · handling. Det er rekkefølgen i
  Bilde 6.
- **Det som står i ro, står på samme sted hver dag** og har ingen farge. **Det som roper, er gult,** og står
  bare i lønnsartmerket og i varselkolonnen.
- **Tall står under hverandre,** høyrejustert, med samme antall desimaler.
- **Et varsel sier hva som er galt og hvor mye,** ikke bare at noe er galt: «+2,5 t», «1,0 t kan trekkes».
- **Linjene står i klokkerekkefølge** under oversiktsraden, som i dag.

#### Del K — timer etter underprosjekt (B56)

**Kenneth 2026-11-23:** «b56a -> vi må kunne filtrere og ta ut timer etter underprosjekt.» A er merket «↳» ved
prosjektnavnet (A2). Kravet om å filtrere og ta ut er nytt. **Kenneth 2026-11-24: «b84ja»** — rapporten åpnes
også for prosjektlederen, avgrenset til prosjektene hans. 🟡 Vedtatt, ikke bestilt, ikke bygget.

Målt mot develop @ `9533908f` (lest, ikke kjørt); linjene under er fra denne hashen. Underprosjekt er
`ExternalCostObject` i koden (`SK:2809`), og feltet på linja er `externalCostObjectId`.
`RP` = `apps/web/src/app/dashbord/firma/timer/rapport/page.tsx`, `RA` = `apps/api/src/routes/timer/rapport.ts`,
`DR` = `packages/shared/src/utils/timerDetaljRader.ts`, `EX` = `apps/web/src/lib/timer-rapport-eksport.ts`.

| Trengs | Attesteringen | Rapporten (Firma → Timer → Rapport) |
|---|---|---|
| Se underprosjektet | Kolonne, standard i dag (`DR:758–759`). Etter A2: «↳» og hover; kolonnen finnes fortsatt i «Velg parameter». | Kolonne når minst én rad har underprosjekt (`TimerRapportDetaljer.tsx:980`). |
| Filtrere | **Finnes**, i nettleseren og bare for uka som vises (`MT:674–675`, `:725`; siden henter én uke, `AS:217–236`). | **Mangler.** Filtrene er periode, prosjekt og ansatt (`RP:319–322`, `RA:44–53`). |
| Gruppere og summere | **Mangler.** Grupperingen er dag, prosjekt eller ansatt (`MT:812`). | **Mangler.** Grupperingen er ingen, ansatt eller prosjekt (`DR:1020`), og sammendraget har bare sum pr. prosjekt (`RA:271`). |
| Ta ut (eksport) | **Mangler.** Attesteringen har ingen eksport. | **Delvis.** Excel og PDF har underprosjektet som kolonne (`EX:469`, `RA:832`). CSV og malen «Fakturagrunnlag» har det ikke (`EX:278–281`, `RP:208–211`). Ingen eksport kan avgrenses til ett underprosjekt. |

**Gapet:** timene til ett underprosjekt kan i dag bare tas ut ved å eksportere hele prosjektet til Excel og
filtrere der. Koden har plassen klar: `RA:401–403` sier at en ny dimensjon er «én kolonne … + ett filter (utvid
periodeSchema + where under). Ikke bygget nå.»

**Tilgangen, målt mot develop @ `7a4e8930`** (lest, ikke kjørt):

| | Målt | Kilde |
|---|---|---|
| UT1 | **Rapporten er bare for SiteDoc-admin og firmaadministrator.** Alle fem rutene har samme vakt: rapporten, Excel og CSV, PDF, lista over prosjekter og lista over ansatte. | `RA:36–42`, `:164`, `:409`, `:852`, `:985`, `:1020`; `apps/api/src/trpc/tilgangskontroll.ts:909–931` |
| UT2 | **Siden ligger under Firma, og hele Firma krever firmaadministrator.** En prosjektleder kommer ikke inn på adressen. Attesteringen ble flyttet ut av Firma av samme grunn (w10 del B). | `apps/web/src/app/dashbord/firma/layout.tsx:23`; `apps/web/src/components/layout/firma-nav.tsx:62–64` |
| UT3 | **Attesteringen har regelen som trengs.** «Alle» for SiteDoc-admin og firmaadministrator. Ellers prosjektene der brukeren er aktivt medlem med admin eller «kan attestere», når han er aktiv ansatt i firmaet. Tom liste gir ingen tilgang. | `D:318–348`, `:352–361` |
| UT4 | **Rapporten har rader uten prosjekt:** fravær ført uten prosjekt. | `RA:93` |

**Leveranse U1:**

- Filteret «Underprosjekt» i rapporten, ved siden av prosjekt og ansatt. Valget «Uten underprosjekt» er med.
- Grupperingen «Etter underprosjekt», med sum pr. underprosjekt.
- Excel, PDF og CSV følger filteret. CSV og «Fakturagrunnlag» får underprosjektet som kolonne.
- **Tilgang (B84 ja):** rapportens fem ruter bytter vakt til omfanget fra attesteringen (UT3), så rapporten og
  attesteringen alltid er enige om hvem som ser hva. Firmaadministrator og SiteDoc-admin får det samme som i
  dag. En prosjektleder får bare rader fra prosjektene sine.
- **Grensen settes på serveren, i utvalget:** hver rute legger prosjektene hans i spørringen. Et prosjekt
  utenfor omfanget gir ingen rader, også når id-en sendes inn. Lista over prosjekter og lista over ansatte
  avgrenses likt. Rader uten prosjekt (UT4) vises ikke for prosjektlederen. Ingen sum eller telling tar med
  andre prosjekter.
- **Siden må kunne åpnes av prosjektlederen** (UT2). Fabels anbefaling: flytt den ut av Firma, slik
  attesteringen ble flyttet, og la den gamle adressen sende videre. Menypunktet vises for dem som har omfang.
  Koderen leverer løsning før kode.
- ⚠️ Ikke målt: om rapporten viser satser eller beløp som prosjektlederen ikke ser i attesteringen. Koderen
  måler, og avvik legges fram for Kenneth før kode.
- Rører `RA` (`periodeSchema`, vakten og utvalget), `DR` (`Gruppering`, `grupperDetaljRader`), `RP` og plassen
  i menyen, `EX`, i18n og hjelpeteksten. Ingen migrering.
- **Regel 10 kjøres uavhengig i gaten:** eksporten er grunnlag for lønn og faktura, og tilgangen går på tvers
  av prosjekter.
- Attesteringen får ikke eksport. Filteret der står som i dag.

#### Del L — helg, helligdag og overtid: modell og leveranser (B58, B79, B80, B86, B87)

**Kenneth 2026-11-23:** «b58 Helg utbetales normalt som overtid. jeg tror vi trenger at firmaet definerer
tidspunkter for overtid, lørdag og søndag og bevegelige helligdager. Bør vi prøve å utlede noen regler som
tilpasses ulike tariffer?»

**Kenneth 2026-11-24:** «b79 ja», «b80 ja» og «b81ja · b82ja, anleggsgartner» (§ 8.28), og «B86 ja, B87 ja»
(§ 8.29).

- **B79 ja:** normen er 0 lørdag, søndag og helligdag som standard. Firmaet kan sette lørdag eller søndag som
  arbeidsdag med egen norm. En helligdag er en dag firmakalenderen har som helligdag.
- **B80 ja:** firmaet setter tidsrom pr. dagtype med lønnsarten som foreslås. Dagssiden foreslår delingen etter
  klokkeslett. Attesteringen viser gult når føringen avviker fra forslaget.
- **B81 ja:** overtid på en hverdag er timer over dagsnormen. Tidsrommene bestemmer bare lønnsarten på timene
  som er over normen.
- **B82 ja, første avtale anleggsgartner:** ferdige forslag kopieres inn og rettes av firmaet. Ingen kobling
  etterpå.
- **B86 ja** (mot Fabels anbefaling «nei nå»): en halvdag i firmakalenderen får normen som står i kalenderen, og
  firma-fri får norm 0. Timer over det foreslås som overtid, og ukenormen følger. Plassert i H1a (målt under).
- **B87 ja:** dagskort-modus får forslaget etter firmaets regler, som egen leveranse H1d etter H1b på web og
  etter H1m i appen, med vakt-test for resten av dagskortet.

🟡 Vedtatt 2026-11-24, ikke bestilt, ikke bygget. **Reglene foreslår; arbeideren og attestanten bestemmer.**
Ingen regel endrer en ført linje, og ingen regel hindrer lagring eller attestering.

**Målt mot develop @ `9533908f`** (lest, ikke kjørt):

| | Målt | Kilde |
|---|---|---|
| HO1 | **Helligdagene finnes pr. firma, men timeføringen leser dem ikke.** Firmakalenderen har typene `helligdag`, `fellesferie`, `klemdager`, `sommertid_start`, `sommertid_slutt`, `halvdag` og `firma_fri`. «Importer norsk standard» legger inn 5 faste og 7 bevegelige helligdager for året; de bevegelige regnes ut. | `apps/api/src/routes/firma/kalender.ts:12–20`, `:223`; `packages/db/src/seed/helligdager.ts:76`; `SK:3151–3179` |
| HO2 | **Normen er lik alle dager.** Dagsnormen leses uten ukedag og uten helligdag; bare sommertid leses fra kalenderen. Lørdag, søndag og helligdag får samme norm som mandag. | `AR:45`, `:76–126` |
| HO3 | **Ukenormen teller en helligdag som arbeidsdag.** Kommentaren i regelen sier at en helligdag skal gi 0; serveren gir dagsnormen. En uke med helligdag mandag–fredag har ukenorm 37,5 t. | `packages/shared/src/utils/ukenorm.ts:13–14`, `:67–68`; `apps/api/src/routes/timer/dagsseddel.ts:2300–2311` |
| HO4 | **Overtidsforslaget har én regel:** timer over dagsnormen foreslås som 50 %. 100 % og egne regler for lørdag, søndag og helligdag er med vilje ikke bygget. Regelen er et forslag på dagssiden; arbeideren velger. | `packages/shared/src/utils/lonnsregel.ts:10–12`, `:49–69`; `packages/shared/src/utils/overtidForslag.ts:74` |
| HO5 | **Firmaet har ingen innstilling for klokkeslett eller sats.** Firmainnstillingene har dagsnorm, start, slutt og pause, men ikke når 50 % blir 100 %, og ikke noe for lørdag, søndag eller helligdag. | `SK:376–514` |
| HO6 | **Lønnsarten bærer satsen:** `overtidsnivaa` 50 eller 100. Standardoppsettet lager «Overtid 50%» og «Overtid 100%». | `ST:43`; `apps/api/src/services/seed/index.ts` |
| HO7 | **Tillegg har ingen tidsregel.** Tillegg for skift, natt og helligdag finnes som navngitte lønnsarter, uten klokkeslett. | `ST:88–110` |
| HO8 | **Tariff finnes ikke som begrep i koden.** Ideen står i BACKLOG som «Lønnsregel-konfig (Nivå 1-2)», ikke bygget. | `docs/claude/BACKLOG.md:5695` |

**Målt mot develop @ `7a4e8930`** for leveransene (lest, ikke kjørt). `WS` = `apps/web/src/app/dashbord/timer/[id]/page.tsx`, `M` = `apps/mobile/src`.

| | Målt | Kilde |
|---|---|---|
| HO9 | **Norm 0 eller lavere leses som «ukjent norm».** Da foreslås ingen overtid, alle timene regnes som ordinære, og dagen får ikke normmerke. B79 krever at reglene skiller en kjent norm på 0 fra en ukjent norm. | `packages/shared/src/utils/lonnsregel.ts:56–61`; `packages/shared/src/utils/overtidForslag.ts:82`; `D:5709`; `OG` (`avvikRetning`) |
| HO10 | **Serveren gir ett tall, `dagsnorm`, og `D` leser det 12 steder:** pausevinduet `:1481`, fraværstaket `:1755` og `:11682` (`syncBatch`), normtaket `:1828`, ukekontrollen `:2304`, første rad `:2958`, `opprett` `:4477`, delt reise `:5007`, `lagreJobbTid` `:5693`, attesteringslista `:7565` og attesteringen av én dag `:7970` og `:8008`. Fraværstaket og normtaket hopper over kontrollen når normen er 0 eller lavere (`:1756`, `:1829`). | `AR:45–136` (normen `:123–126`); `D` |
| HO11 | **Ukekontrollen leser mandag–fredag.** Ukeslutt er fredag, og ukenormen summerer fem dager. Skjermens ukesum tar med lørdag og søndag (AM12). | `D:2290–2311` (`:2298`); `packages/shared/src/utils/ukenorm.ts:71–84` |
| HO12 | **Forslaget har høyst to deler:** én ordinær og én overtid. Dagssiden og serveren regner med samme regel, og serveren regner linjene selv når en jobb lagres. | `overtidForslag.ts:74–82` (`OvertidForslag`); `packages/shared/src/utils/jobbTid.ts:117`; `apps/web/src/app/dashbord/timer/[id]/JobbSkjema.tsx:270`; `D:5693–5712` |
| HO13 | **Kalenderen har én rad pr. firma og dato.** Timer på raden (`timerOverstyr`) brukes bare for halvdag. Helligdagene finnes bare for år firmaet har importert eller lagt inn. **Målt på nytt mot develop @ `3feb05ba` (B86):** halvdagstimene leses ikke noe sted i timeføringen. De valideres og lagres i firmakalenderen (`apps/api/src/routes/firma/kalender.ts:36–55`, `:305–338`, `:377–436`), vises på kalendersiden (`apps/web/src/app/dashbord/firma/kalender/page.tsx:261–263`) og kopieres til appens lokale kalender (`M/services/kalenderKatalog.ts:87–99`, kolonnen `M/db/schema.ts:731`). `hentEffektivArbeidstid` leser bare `sommertid_start` og `sommertid_slutt` (`AR:76–120`). Firma-fri leses heller ikke. ⚠️ Fire kommentarer sier noe annet: `AR:17–19` («påvirker dagsnorm direkte ved registrering»), `apps/api/src/routes/organisasjon.ts:1344–1345` og `apps/web/src/app/dashbord/timer/ny/page.tsx:73–74` («respekterer … halvdag»), og `M/services/kalenderKatalog.ts:142–143` («registreres direkte i UI»). Ingen kaller gjør det. | `SK:3151–3179`; `apps/api/src/routes/firma/kalender.ts:223`; søk på `timerOverstyr` i `apps` og `packages` |
| HO14 | **Appen regner ikke normen.** Den lagrer serverens svar pr. firma og dato og leser `dagsnorm` derfra, ti steder. Et svar merket «cachet» er siste kjente svar, inntil 30 dager gammelt, og kan gjelde en annen dato. Helligdagene ligger også lokalt. | `M/services/arbeidstidSvarKatalog.ts:21–34`, `:42`, `:100`; `M/db/schema.ts:795–808`, `:724–737`; `apps/api/src/routes/organisasjon.ts:1347–1359` |
| HO15 | **Overtidsreglene har ingen tabell.** Firmaets arbeidstid står i `OrganizationSetting` i `packages/db`. Lønnsartene står i `packages/db-timer`, i et eget skjema i databasen. Siste migrering der er `20261122120000_o12_arbeid_reise_retning`. | `SK:376–514`; `ST:22` |
| HO16 | **Vinduet for en timelinje er felles for dagskort-modus og prosjektkort-modus.** Forslaget om overtid ligger i vinduet. Normen på dagssiden er `dagsnorm` fra serveren. Arbeidstiden settes i en egen del på innstillingssiden. | `WS:4136`, `:1882–1903`, `:4902–4940`, `:864–865`; `apps/web/src/app/dashbord/firma/innstillinger/page.tsx:949` |
| HO17 | **Appens dagskort leser normen to steder,** og Bekreft dag og prosjektkortet leser den åtte steder. | Dagskort: `M/components/timer-detalj/TimerSeksjon.tsx:1704`, `apps/mobile/app/timer/[id].tsx:550`. Prosjektkort: `BD:573`, `apps/mobile/app/timer/[id]/kort/[projectId].tsx:289`, `:297`, `M/components/timer-detalj/SplittRadModal.tsx:285`, `…/prosjektkort/useProsjektkortSedel.ts:393`, `M/services/dagsforslagInput.ts:249`, `:269`, `M/services/matpause.ts:86`, `M/utils/dagsforslag.ts:1864` |

**Modellen: overtidsregler pr. firma** (vedtatt, B79 og B80). Firmaet setter dem under Firma → Innstillinger.

| Del | Innhold | Finnes i dag |
|---|---|---|
| **Dagtyper** | Hverdag · lørdag · søndag · helligdag. En helligdag er en dato firmakalenderen har med typen `helligdag`, og den går foran ukedagen. ⚠️ «Dag før helligdag» er tatt ut: den er ikke i Kenneths svar. Dagtypen lagres som tekst, så flere kan legges til senere. Halvdag og firma-fri er ikke egne dagtyper: de endrer normen (B86 ja, raden under), og tidsrommene er ukedagens. | Kalenderen finnes (HO1). |
| **Norm pr. dagtype** | Hverdag: firmaets dagsnorm, som i dag. Lørdag, søndag og helligdag: 0 som standard. Firmaet kan sette lørdag og søndag som arbeidsdag med egen norm. Helligdagene styrer firmaet i firmakalenderen. | Nei (HO2, HO3) |
| **Norm fra kalenderdagen** (B86 ja) | En dato firmakalenderen har som `halvdag`, får timene på raden (`timerOverstyr`) som norm. En dato med `firma_fri` får norm 0. Kalenderdagen går foran ukedagen, som helligdagen. Gjelder begge normkildene, «fast» og «kalender» (`AR:62–63`, `:123–126`). Fellesferie og klemdager endrer ikke normen. | Feltene finnes; ingen leser dem (HO13). |
| **Tidsrom pr. dagtype** | En liste med fra, til og lønnsarten som foreslås. Firmaet fyller den ut selv. En dagtype uten tidsrom gir forslaget som i dag. | Nei (HO5) |
| **Hva som utløser overtid** | Timer over dagens norm, som i dag. Tidsrommene bestemmer lønnsarten på timene som er over normen. På en dag med norm 0 er alle arbeidstimene over normen. | Regelen finnes (HO4). Vedtatt (B81 ja): overtid utløst av klokkeslett bygges ikke. |

**Hva reglene gjør:**

- **På dagssiden i prosjektkort-modus:** forslaget deler jobben ved dagens norm og ved klokkeslettene i
  tidsrommene. Det kan gi flere enn to linjer (HO12). Arbeideren velger og retter, som i dag. En linje uten fra
  og til kan ikke deles ved klokkeslett og får forslaget som i dag.
- **I attesteringen:** normmerket måles mot dagens norm. Lørdag, søndag og helligdag får merket «Helg» eller
  «Helligdag» (B58 A). Gult merke når den førte lønnsarten avviker fra forslaget, med forslaget i klartekst.
- **I uka:** ukenormen er summen av normen for de sju dagene. En uke med én helligdag mandag–fredag får ukenorm
  30 t (retter HO3). En uke med én halvdag på 4 t får 34 t, og en uke med én firma-fri dag 30 t (B86 ja). Arbeid
  på lørdag og søndag teller i ukesummen.
- **Fravær:** taket for fravær leser hverdagsnormen, som i dag, så «Bevegelig helligdag» kan føres som før.
  Fravær på en dag med norm 0 teller 0 i ukesummen, fordi fravær bare fyller opp til dagens norm (`OG`,
  `fravaerINorm`).
- **Ingen ny sperre:** fraværstaket og normtaket (HO10) leser fortsatt hverdagsnormen. ⚠️ Koderen måler hva
  normtaket gjør på en dag med norm 0, og legger det fram før kode.
- **Følge for alle firmaer:** fra H1a er deployet, er normen 0 lørdag, søndag og helligdag i alle firmaer, til
  firmaet setter noe annet. Dager som alt er ført på en lørdag, får «+N t» og «Helg» i attesteringen. Førte
  linjer endres ikke. ⚠️ Ikke målt: om normmerket på en attestert dag leses fra det lagrede regnestykket eller
  regnes på nytt.
- **Helligdagene må ligge i kalenderen:** et firma som ikke har importert helligdagene for året, får
  hverdagsnorm de dagene (HO13). ⚠️ Fabels forslag: innstillingssiden viser én linje når inneværende eller neste
  år mangler helligdager, med lenke til firmakalenderen.

**Tariffer: forslag firmaet tar inn og retter (B82 ja; første avtale: anleggsgartner).**

- En tariffprofil er et ferdig utfylt sett med normer og tidsrom. Firmaet velger «Hent forslag fra …», verdiene
  kopieres inn i firmaets regler, og firmaet retter dem. Etterpå er det ingen kobling til profilen. Samme mønster
  som «Importer norsk standard» i firmakalenderen (HO1).
- ⚠️ **Fabel har ikke avtaleteksten og påstår ikke tariffinnhold.** Ingen tall, klokkeslett eller satser i
  denne delen er hentet fra en tariffavtale. Fabel påstår heller ikke hva avtalen for anleggsgartnerfaget heter,
  eller hvem som er parter. **Kenneth, eller en som kjenner avtalen, leverer avtaleteksten før noe bygges.**
- **Verdiene som må hentes fra avtaleteksten for anleggsgartnerfaget:**

| | Verdi | Brukes til |
|---|---|---|
| 1 | Avtalens fulle navn, partene og perioden teksten gjelder for | Navnet i «Hent forslag fra …», med dato for teksten |
| 2 | Ordinær arbeidstid pr. dag og pr. uke, og om den er lik hele året | Dagsnormen, og om profilen trenger mer enn én norm |
| 3 | Om lørdag er vanlig arbeidsdag i noen del av året | Norm for lørdag (B79) |
| 4 | Når overtid inntrer: over dagsnorm, over ukenorm eller utenfor faste klokkeslett | Holdes mot B81 ja. Avviker avtalen, legges det fram for Kenneth før noe bygges. |
| 5 | Satsene for overtid på hverdager, og klokkeslettene der satsen skifter | Tidsrommene for hverdag |
| 6 | Satsene på lørdag, og klokkeslettene der satsen skifter | Tidsrommene for lørdag |
| 7 | Satsene på søndag og helligdag | Tidsrommene for søndag og helligdag |
| 8 | Hvilke dager avtalen regner som helligdag eller høytidsdag, og om dagen før har egne klokkeslett | Holdes mot firmakalenderen (HO1). Dagen før en helligdag er ikke en dagtype i H1. |
| 9 | Om helgen eller helligdagen starter et klokkeslett dagen før | Modellen bærer det ikke i H1; legges fram hvis avtalen har det |
| 10 | Regler modellen ikke bærer: skift, forskjøvet arbeidstid, innarbeiding og avspasering, tillegg i kroner | Står som «ikke med i forslaget» i teksten firmaet ser |

- **Lønnsartene:** et tidsrom peker på firmaets egen lønnsart. Forslaget velger lønnsarten med samme sats
  (`overtidsnivaa`, HO6). Mangler firmaet en lønnsart for en sats, stopper «Hent forslag», og firmaet får vite
  hvilken som mangler. Ingenting hoppes over stille.
- **Modellen må kunne bære** (form, ikke innhold): klokkeslett der satsen skifter, pr. dagtype · andre satser enn
  50 og 100 (`overtidsnivaa` er et heltall) · flere dagtyper senere, som dagen før en helligdag.
- **Utenfor H1a–H1c og T1:** tillegg i kroner for kveld, natt og skift (HO7) · skift, turnus og innarbeiding med
  annen norm · avspasering og timebank · betaling for helligdager uten arbeid (fraværsarten «Bevegelig
  helligdag» finnes) · tidsrom som krysser midnatt (føres som to tidsrom).
- **Senere profiler** velges av Kenneth. Navn og innhold bekreftes mot kilde før noe føres inn.
- H1a–H1c trenger ikke tariffinnhold: firmaet fyller ut reglene selv.

**Leveranse T1 — ferdig forslag for anleggsgartner (B82).** ⏸ Venter på avtaleteksten og på H1b. Ingen
migrering.

- **Profilen** er data i `packages/shared`: normer og tidsrom, med avtalens navn, kilde og dato for teksten.
  Hver verdi har en henvisning til stedet i avtaleteksten.
- **Innstillingssiden:** «Hent forslag fra …» ved overtidsreglene. Et vindu viser verdiene som kopieres inn, og
  at de erstatter tidsrommene firmaet har. Firmaet bekrefter. Etterpå retter firmaet fritt.
- **Serveren** lagrer med ruta fra H1b, i tabellene fra H1a. Firmaet hentes fra økta.
- **Test:** profilen gir nøyaktig radene i tabellen fra avtaleteksten. Firmaet kan rette og slette etterpå. Et
  annet firma er urørt. Mangler en lønnsart, lagres ingenting, og meldingen sier hvilken. Uten bekreftelse
  lagres ingenting.
- **Før bestilling:** Kenneth leverer avtaleteksten. Fabel fyller ut tabellen over (verdi 1–10) med henvisning
  til teksten, og Kenneth godkjenner tabellen. Da kan T1 bestilles.

**Migreringen** (én, i H1a; Kenneth kjører den på test og så i prod):

- **Pakke:** `packages/db-timer`. Lønnsartene står der (HO15), og tidsrommene peker på en lønnsart. Tabeller for
  en firmamodul skal ikke inn i `packages/db`.
- **To nye tabeller i samme migrering.** Navnene er arbeidsnavn; koderen legger fram skjemaet før kode.

| Tabell | Felt | Unik | Tom tabell betyr |
|---|---|---|---|
| Norm pr. dagtype (`dagtype_normer`) | `organization_id`, `dagtype` (`lordag` eller `sondag`), `norm` (timer), tidsstempler | firma + dagtype | Norm 0 lørdag og søndag |
| Tidsrom (`overtid_tidsrom`) | `organization_id`, `dagtype` (`hverdag`, `lordag`, `sondag`, `helligdag`), `fra_tid` og `til_tid` (TT:MM), `lonnsart_id` → `lonnsarter`, tidsstempler | firma + dagtype + `fra_tid` | Forslaget som i dag |

- **Ingen backfill.** Migreringen lager bare nye tabeller. Ingen tabell med data får ny kolonne, og ingen rad
  endres. En tom tabell er standarden: test krever at et firma uten rader får norm 0 og forslaget som i dag.
- **Dagtypen er tekst,** validert med Zod, ikke en enum i databasen.
- **Halvdag og firma-fri (B86) trenger ingen tabell:** feltene står i firmakalenderen (HO13).
- **Begge tabellene kommer i H1a,** også tidsrommene som først brukes i H1b, så det blir én migrering.
- ⚠️ Ikke målt: hva som skjer med et tidsrom når lønnsarten det peker på, slås av. Koderen måler og legger det
  fram.
- Vurdert og forkastet: to kolonner i `OrganizationSetting` for normen. Det gir en migrering i `packages/db` i
  tillegg til den i `packages/db-timer`.

**Leveranse H1a — norm pr. dagtype (B79).** Server, delt regel og web. Har migreringen.

- **Ny delt regel** i `packages/shared` (ny fil): dato og firmaets helligdager gir dagtypen; dagtypen, firmaets
  dagsnorm, firmaets normer for lørdag og søndag og kalenderdagen (halvdag med timer, firma-fri) gir dagens
  norm. Rene funksjoner med tester.
- **`AR`** (`hentEffektivArbeidstid`, `:45–136`): leser kalenderraden for datoen (helligdag, halvdag eller
  firma-fri; én rad pr. firma og dato, HO13) og firmaets normer. Kommentaren `AR:17–19` og de tre andre i HO13
  rettes, så de sier det koden gjør. Svaret får to
  nye felt: dagtypen og dagens norm. **Feltet `dagsnorm` står uendret** og er fortsatt hverdagsnormen, så appen og
  dagskortet får det samme som i dag (HO14).
- **`ukenorm.ts`** (`:71–84`): summerer sju dager med dagens norm. Kommentaren om helligdag (`:13–14`, `:67–68`)
  blir sann. Halvdag og firma-fri følger med, fordi dagens norm tar dem (B86 ja).
- **B86 i H1a, ikke egen leveranse** (målt mot develop @ `3feb05ba`): halvdag og firma-fri er to grener til i
  samme oppslag og samme regel som helligdagen. Ukenormen, normmerket og forslaget får dem uten egen kode. Egen
  leveranse etter H1a ville gått gjennom `AR`, `ukenorm.ts`, `D` og testene en gang til, og gitt en deploy til.
  Ingen migrering.
- **`lonnsregel.ts`** (`:49–69`), **`overtidForslag.ts`** (`:82`) og **`OG`:** skiller kjent norm 0 fra ukjent
  norm (HO9). Ukjent norm gir det samme som i dag.
- **`D`:** ukekontrollen leser mandag–søndag med dagens norm (`:2290–2311`). Attesteringslista og attesteringen
  av én dag bruker dagens norm i normmerket og i ukeregnestykket (`:7554–7596`, `:7970–8008`). `lagreJobbTid`
  bruker dagens norm (`:5693–5712`). Fraværstaket og normtaket røres ikke.
- **Dagssiden i prosjektkort-modus** (`WS:864–865`, `:4902–4940` bak `kortModus`; `JobbSkjema.tsx:270`): forslaget
  og bunnlinja bruker dagens norm. En lørdag med 10,0 t foreslås som overtid i sin helhet, med firmaets
  overtidsart. Koderen leverer skjermbilde av en dag med norm 0 før kode.
- **Innstillingssiden** (ny del etter arbeidstiden, `:949`): «Lørdag er arbeidsdag» og «Søndag er arbeidsdag»,
  hver med avkrysning og norm i timer. Ny rute for å lese og lagre, bare for firmaadministrator, med firmaet fra
  økta.
- **Attesteringen** (`MT`, `AT`): normmerket mot dagens norm, og merket «Helg» eller «Helligdag» (flyttet fra
  A5).
- i18n, hjelpetekstene for innstillingssiden og attesteringen, `timer.md`, `api.md`, `web.md`, `arkitektur.md`,
  `shared-pakker.md`. Ikke `apps/mobile`.
- **Regel 10 kjøres uavhengig i gaten:** leveransen har migrering og endrer ukeregnestykket i attesteringen.

**Leveranse H1b — tidsrom og forslag (B80).** Server og web, prosjektkort-modus. Etter H1a. Ingen migrering.

- **Ny rute for tidsrommene:** alle i firmaet kan lese, firmaadministrator kan lagre. Zod: klokkeslett som
  TT:MM, fra før til, ingen overlapp innen samme dagtype. Lønnsarten må tilhøre firmaet og kan ikke være fravær
  eller reise. Firmaet hentes fra økta.
- **Innstillingssiden:** én liste pr. dagtype med Fra, Til og Lønnsart (nedtrekk), «+ Legg til tidsrom», og
  sletting med bekreftelse.
- **Regelen** (`overtidForslag.ts:74–82`, `jobbTid.ts:117`): timene opp til dagens norm foreslås som ordinære,
  som i dag. Timene over normen deles ved klokkeslettene, og hver del får lønnsarten til tidsrommet den ligger i.
  Timer over normen utenfor alle tidsrom får forslaget som i dag. Tidsrommene er en valgfri verdi inn til
  regelen; uten dem regner den som i dag.
- **Eksempel på oppsett, ikke tariff:** firmaet har satt hverdag 15:00–21:00 → «Overtid 50%» og 21:00–24:00 →
  «Overtid 100%». En jobb 07:00–22:00 med 30 min pause og norm 7,5 t foreslås som 7,5 t ordinært, 6,0 t
  «Overtid 50%» (15:00–21:00) og 1,0 t «Overtid 100%» (21:00–22:00).
- **Kallerne:** `JobbSkjema.tsx:270`, vinduet for en timelinje i kortmodus (`WS:4902–4940`) og `lagreJobbTid`
  (`D:5693–5712`). Serveren regner linjene selv med samme regel.
- i18n, hjelpetekstene, `timer.md`, `api.md`, `web.md`, `shared-pakker.md`. Ikke `apps/mobile`.
- Koderen leverer løsning med skjermbilde før kode. **Regel 10 kjøres uavhengig i gaten:** `lagreJobbTid` fører
  lønn.

**Leveranse H1c — gult ved avvik fra forslaget (B80).** Server og web. Etter H1b og A1. Ingen migrering.

- **Ny delt regel** i `packages/shared`: førte linjer og dagens forslag gir avviket pr. linje. En linje avviker
  når lønnsarten er en annen enn forslaget for tidsrommet linja ligger i.
- **`D`** sender dagtypen og avviket pr. linje i attesteringslista. **`MT`** og **`AT`** viser gul linje og
  merke, med forslaget i klartekst på hover, som «Foreslått: Overtid 100% 21:00–22:00».
- Bare firmaer som har satt tidsrom, får merket. Linjer uten fra og til vurderes ikke. Attesterte dager
  vurderes ikke. Merket sperrer ikke attesteringen.
- i18n, hjelpeteksten for attesteringen, `timer.md`, `web.md`.

**Leveranse H1m — appen regner likt.** ⏸ Venter på web (§ 8.13). Krever OTA.

- **Appen skal regne likt, ikke sperre.** Den bruker den samme delte regelen som web og serveren.
- **Fram til H1m:** appen foreslår som i dag, fordi `dagsnorm` i svaret er uendret. Linjer ført i appen lagres
  som ført; synken regner ikke forslaget. Attesteringen viser normmerket, «Helg» og gult der føringen avviker
  (H1a og H1c). Verken appen eller serveren avviser en lagring.
- **H1m:** svarkatalogen tar imot de to nye feltene (`M/services/arbeidstidSvarKatalog.ts:21–34`), den lokale
  tabellen får kolonner for dem (`M/db/schema.ts:795–808`, lokal migrering), og tidsrommene får en egen lokal
  katalog som fylles ved synk. Bekreft dag og prosjektkortet bytter til dagens norm og den delte regelen (HO17).
  Halvdagstimene ligger alt i den lokale kalenderen (`M/db/schema.ts:731`), så appen kan regne B86 uten nett.
- **Fallgruve:** et svar merket «cachet» kan gjelde en annen dato og gir ikke dagtypen (HO14). Uten svar for
  datoen regner appen dagtypen selv, av ukedagen og de lokale helligdagene, med den delte regelen.
- Koderen leverer løsning før kode.

**Dagskortet (regelen fra 2026-11-07, unntak vedtatt i B87 ja).**

- **Til H1d er levert, endres ikke dagssiden i dagskort-modus,** verken på web eller i appen
  (`TimerSeksjon.tsx:1704`, `apps/mobile/app/timer/[id].tsx:550`). Den leser `dagsnorm`, som er uendret. H1a og
  H1b har vakt-test for det.
- ⚠️ Vinduet for en timelinje på web er felles for de to modusene (HO16). Endringen i H1a og H1b legges bak
  `kortModus`; H1d tar den ut fra bak `kortModus`.
- **Attesteringen og ukenormen er felles.** Et firma i dagskort-modus får norm 0 lørdag, søndag og helligdag i
  attesteringen fra H1a: normmerket, «Helg» og ukenormen. Fram til H1d kan dagssiden foreslå 7,5 t ordinært en
  lørdag mens attesteringen viser «+10,0 t». H1d fjerner forskjellen.

**Leveranse H1d — dagskort-modus får forslaget (B87 ja).** Web etter H1b, appen etter H1m. Ingen migrering.

- **Web** (etter H1b): forslaget i vinduet for en timelinje (`WS:4902–4940`, `foreslaOvertidSplitt` med
  `normTimer`) bruker dagens norm og firmaets tidsrom også når `kortModus` er av. Summen øverst i dagskortet
  regner mot samme norm (`WS:864–865`, `:1741–1760`; lesningen i § 8).
- **Appen** (etter H1m): dagskortets to steder (`TimerSeksjon.tsx:1704`, `apps/mobile/app/timer/[id].tsx:550`)
  bruker dagens norm og den delte regelen, som Bekreft dag og prosjektkortet fikk i H1m. Krever OTA.
- **Vakt-test for resten av dagskortet:** `apps/web/src/app/dashbord/timer/[id]/dagskort-vakt.test.tsx` står
  grønn uten endring utenom forslaget og normen i summen. Tilsvarende vakt i appen for dagskortets oppsett,
  rader og knapper. Testen feiler hvis noe annet i dagskortet endres.
- **Forsvinner** (B87 ja): forslaget om ordinær tid for de første 7,5 t på lørdag, søndag og helligdag i
  dagskort-modus, og på halvdag og firma-fri (B86).
- Rører `WS`, `TimerSeksjon.tsx`, `apps/mobile/app/timer/[id].tsx`, vakt-testene, hjelpeteksten for dagssiden,
  `timer.md`, `web.md`, `mobil.md`. Koderen leverer løsning med skjermbilde av en lørdag i dagskort-modus før kode.

**Rekkefølge:** A4 (✅ merget `b69918a9`) → H1a → H1b → H1c hos samme koder, fordi de rører `D`, `OG`, `MT` og `AT`. H1a og H1b
deployes til test sammen. H1m bestilles når Kenneth har godkjent H1a–H1c på PC. T1 bestilles når H1b er
merget og tabellen fra avtaleteksten er godkjent. H1d på web bestilles etter H1b, hos samme koder fordi den rører
`WS`; H1d i appen bestilles etter H1m.

**Testkrav.** Hver test feiler mot develop før endringen (negativkontroll).

| Leveranse | Test |
|---|---|
| H1a | Et firma uten rader i de nye tabellene: lørdag, søndag og helligdag har norm 0, og en hverdag har firmaets dagsnorm. |
| H1a | Lørdag med 10,0 t: forslaget er 10,0 t overtid, og attesteringen viser «+10,0 t» og «Helg». |
| H1a | Lørdag satt som arbeidsdag med norm 5,0 t: 5,0 t ordinært og resten overtid. |
| H1a | En uke med helligdag på en torsdag har ukenorm 30,0 t. En uke uten helligdag har 37,5 t. |
| H1a | Ukjent norm gir fortsatt ingen forslag og ikke noe normmerke. Kjent norm 0 gir forslag. |
| H1a | Feltet `dagsnorm` i svaret er likt før og etter, også på en lørdag. Dagskort-modus får samme forslag som før (vakt-test). |
| H1a | Fravær kan føres på en helligdag som før. Fravær på en dag med norm 0 teller 0 i ukesummen. |
| H1a | En halvdag med 4,0 t i kalenderen har norm 4,0 t; 6,0 t arbeid gir 2,0 t foreslått som overtid. En firma-fri dag har norm 0. En uke med én halvdag på 4,0 t har ukenorm 34,0 t. Gjelder normkilde «fast» og «kalender» (B86 ja). |
| H1a | Et annet firmas halvdag eller firma-fri endrer ikke normen (firmagrensen på kalenderoppslaget). |
| H1a | Et firma ser og lagrer bare sine egne normer (firmagrensen på tabellen og ruta). |
| H1b | Eksempelet over gir tre linjer med de timene som står der. Serveren lagrer de samme linjene som dagssiden foreslår. |
| H1b | Et firma uten tidsrom får forslaget som før, time for time. |
| H1b | Ruta avviser overlapp innen en dagtype, fra etter til, lønnsart fra et annet firma og lønnsart for fravær eller reise. |
| H1b | En linje uten fra og til får forslaget som før. Dagskort-modus er uendret (vakt-test). |
| H1c | En linje ført som «Overtid 50%» i et tidsrom firmaet har satt til «Overtid 100%», er gul med forslaget på hover. Samme linje ført som «Overtid 100%» er ikke gul. |
| H1c | Et firma uten tidsrom får ingen slike merker. En attestert dag får ingen. Dagen kan attesteres med merket stående. |
| H1m | Appen og serveren gir samme forslag for samme dag, firma og tidsrom. Uten nett og uten svar for datoen gir appen norm 0 på en lørdag og kalenderens timer på en halvdag. Dagskortet er uendret. |
| H1d | Web, dagskort-modus: en lørdag med 10,0 t gir forslaget 10,0 t overtid, og summen øverst viser normen 0. En hverdag gir det samme som før. `dagskort-vakt.test.tsx` er ellers uendret og grønn. |
| H1d | Web, dagskort-modus: en hverdag med firmaets tidsrom gir de samme linjene som prosjektkort-modus for samme jobb. |
| H1d | Appen, dagskort-modus: samme forslag som web for samme dag, også uten nett. Resten av dagskortet er uendret (vakt-test). |
