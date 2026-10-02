---
name: timer-gps-helhetsplan
description: Helhetsplan som syr sammen GPS, reise, flerprosjekt-dag og bekreftelsessteget i timer-modulen. Skrevet 2026-10-01 på Kenneths ordre etter at orkestratoren hadde bestilt kode i hver runde uten kontroll på kompleksiteten. Les FØR noe i dette komplekset bestilles. Revidert 2026-10-01 kveld med Kenneths vedtak V1–V14 (§ 4b).
sist_verifisert_mot_kode: 2026-10-01
eier: fabel (kontroll-Claude) — orkestrator gater, fra 2026-10-01 kveld
---

# Helhetsplan — GPS, reise og flere prosjekter i timer

> **Kenneth 2026-10-01:** *«du er veldig på å starte koding → alle disse spørsmålene dine over →
> beviser for meg at du ikke har kontroll over kompleksiteten. det er ikke bare å bygge i vei.»*

🔴 **Denne planen finnes fordi orkestratoren bestilte kode i hver runde mens modellen ennå ble
formet.** To ordrer motsa hverandre før agentene rakk å bygge dem (Gjenåpne-blokkeringen, og en
gate som krevde en skriving mens resten av ordren sa «les og vis»). **Det er ikke agentenes feil
— det er mangel på en plan.**

**Alt under er målt mot kode 2026-10-01** av fire agenter, verifisert av orkestrator. Grunnlaget:
[timer-gps-prosjekt-utredning.md](timer-gps-prosjekt-utredning.md) · [timer.md](timer.md) ·
[mobil-dagsseddel-ui-spec.md § 6.2](mobil-dagsseddel-ui-spec.md).

---

## 1. Den ene innsikten som ordner resten

🔴 **Tre forskjellige kapabiliteter er i dag blandet sammen i én mekanisme.** De har ulike
datakrav, ulik presisjonstoleranse og ulike konsekvenser — og **det er sammenblandingen som
skaper hullene**, ikke manglende kode.

| # | Kapabilitet | Spørsmålet | Trenger | Konsekvens hvis feil |
|---|---|---|---|---|
| **A** | **Stedsgjenkjenning** | «Er jeg fremme?» | Punkt **+ radius** | Feil forslag. Irriterende |
| **B** | **Reiseberegning** | «Hvor langt er det dit?» | **Kun punkt** | 🔴 **Feil lønn** — over/under terskel avgjør arbeidstid vs. reisetid |
| **C** | **Prosjekt-tilordning** | «Hvilket prosjekt skal timene føres på?» | Punkt + **tid** + bekreftelse | 🔴 **Feil prosjekt belastes.** Feil i regnskapet, ikke bare i lønn |

**I dag brukes samme haversine til alle tre, fire steder, med fire ulike regler:**

```
byggeplassKatalog.ts:72-96        byggeplass · egen radius        → A
useArbeidsdag.ts:71-87            oppmøtested · egen radius       → A
timer/ny.tsx:131-142              prosjekt · hardkodet 500 m      → C
StartSluttDagKort.tsx:441-451     prosjekt · INGEN grense         → C
```

🔴 **Ingen av dem er delt. Ingen er testet. `haversineKm` finnes kun i `apps/mobile/src/utils/geo.ts`
— server og web kan ikke regne avstand i det hele tatt.**

## 2. Den andre innsikten: ingenting som avgjør lønn kan etterprøves

| Hva | Hvor det blir av | Konsekvens |
|---|---|---|
| Posisjonen ved start og slutt | `arbeidsdag_local` — **synkes ALDRI** (`db/schema.ts:351-356`) | Dør med telefonen |
| Avstanden som valgte lønnsart | Brukes, så **kastes** | Reise-raden er en naken timeverdi uten fra/til/km |
| Oppmøtestedet dagen startet på | Lagres kun lokalt | Dagsseddelen bærer ingen `oppmotestedId` |
| Hvilken regel som klassifiserte | Firmainnstilling, lest **offline på telefonen** | Serveren verifiserer aldri klassifiseringen |

🔴 **`grep -ic reise` i `apps/api/src/routes/timer/dagsseddel.ts` = 0.** Hele reisemodellen lever
i mobil-klienten. **Blir lønn feil, finnes det ingen målekjede å gå tilbake i.**

## 3. Den tredje innsikten: bekreftelsessteget er det som gjør GPS lovlig

**Tre steder i koden står det ordrett:** *«KUN dokumentasjon — aldri lønn/reise/prosjektvalg»*
(`byggeplassKatalog.ts:70`, `useArbeidsdag.ts:141-142`, `db/schema.ts:374`). Og utredningens
anker **G1**: *«GPS = friksjonsfjerner + bevis, ikke hard port. Arbeider-valg forblir
autoritativt.»*

🟢 **Kenneths modell bryter IKKE G1 — forutsatt at bekreftelsessteget finnes.** GPS **foreslår**,
arbeideren **bekrefter eller retter**. **Uten bekreftelsessteget blir GPS en hard port, og da
faller G1.**

🔴 **Konsekvens for rekkefølgen: bekreftelsessteget er ikke en finesse som kan komme sist. Det er
forutsetningen for at GPS i det hele tatt får lov til å velge prosjekt.**

---

## 4. Tilstanden, målt

### 🟢 Dette er bygget og virker

| Hva | Bevis |
|---|---|
| **Oppmøtested-gjenkjenning** | `useArbeidsdag.ts:71-87`, i drift ved «Start dag». Koordinat + radius er **PÅKREVD** (`db/schema.prisma:2759-2761`), radius valideres 10–5000 m |
| **Reisematrise med tid OG avstand** | `ReisetidMatrise` (`db/schema.prisma:2788-2807`) — ekte OSRM-ruting, `kjoretidMin` + `avstandM` i meter, hendelsesdrevet vedlikeholdt, **tilgjengelig offline** |
| **Inkrementell utvidelse av matrisen** | `reisetidMatrise.ts:36-37` — kolonne pr. kontor, rad pr. byggeplass. **Fungerer allerede slik Kenneth beskrev** |
| **Reise-regelsett pr. firma** | Terskel i minutter **eller** meter + avstandsbånd → lønnsart (`db/schema.prisma:442-471`, `shared/utils/reise.ts:85-157`) |
| **Serveren tåler flere prosjekter pr. dag** | T.1 (2026-05-11): `DailySheet` har ingen `projectId`, unik er `(userId, dato)`, prosjekt pr. rad |
| **Flerprosjekt-sedel i manuell UI** | Prosjektgrupper, «+ Legg til prosjekt» — levende konsept på web og mobil |

### 🔴 Dette er hullene

| # | Hull | Bevis | Klasse |
|---|---|---|---|
| **H1** | **Prosjekt velges uten avstandsgrense**, og faller blindt til `prosjekter[0]` uten koordinater | `StartSluttDagKort.tsx:440-451` | Stille feil |
| **H2** | **To innganger uenige:** manuell har 500 m-tak, auto har ingen | `timer/ny.tsx:139` vs. over | Inkonsistens |
| **H3** | **Byggeplass-geofence er valgfri og finnes ikke i opprettelsen** — den settes i en EGEN modal etterpå (Kartverket-adressesøk, Leaflet-kart, breddegrad/lengdegrad, radius-glider **25–500 m** `oppsett/byggeplasser/page.tsx:1407-1409`, «Beregn fra tegning»), eller utledes fra georeferert tegning. *(Rettet etter KS: planen sa først «oppstår bare fra tegning».)* Tre ulike radius-spenn: modal 25–500 m · byggeplass-API 1–100 000 m · oppmøtested 10–5000 m | `validation/index.ts:95-101`, `page.tsx:959-966` (`handleOpprett` sender kun `name`+`projectId`) | Tomt datagrunnlag — **lukkes av V14** |
| **H4** | **Avstanden som avgjorde lønnsart kastes** | `StartSluttDagKort.tsx:866-888` | Usporbar lønn |
| **H5** | 🟢 **LEVERT (lag 0a, `ee6093fd` → `89acee95`).** Km skrives i `timer`; taket er nå lønnsart-bevisst i `rad-tak.ts` (`KM_MAKS_PER_DAG = 2000`, `TIMER_MAKS_PER_DAG = 24`), lest av alle fem skrivestier. *(Premisstabellen i planen var feil: `:3528` var `redigerSedelRader` (web firma-admin) som MANGLET taket, `:4670` var `syncBatch` som HADDE det — en 150 km-rad ble altså avvist fra BÅDE web og mobil, og 25 timer slapp gjennom fra firma-admin.)* K4 urørt | `rad-tak.ts:19,29,33`, `timer-km-tak.test.ts` | Funksjonsfeil — lukket |
| **H6** | **Null server-side reiselogikk** | 0 treff på «reise» i timer-rutene | Ingen verifisering |
| **H7** | 🟢 **LEVERT (lag 0b, `00166759` → `a13f4343`).** `beregnDagsforslag` (ren, `utils/dagsforslag.ts:334`) skilt fra `anvendDagsforslag` (`utils/dagsforslagAnvend.ts:29`); `avsluttet` settes kun når skrivingen lyktes. **Fire utfall, tre regler:** suksess og for kort økt lukker · `blokkertSendt` og det nye `kildeManglet` (`dagsforslag.ts:670-679`) holder dagen åpen — `kildeManglet` var et stumt fjerde utfall (ingen db/prosjekter/aktiviteter → alle flagg false → ingen melding, dagen borte). Sier nå fra (`timer.kildeManglet.*`, 15 språk — avvik fra ordrens «ingen i18n», godtatt av orkestrator) | `dagsforslag.test.ts:293` (rød først) | Tapt arbeidsdag — lukket |
| **H8** | **Segment = kalenderdøgn, ikke sted.** Ingen struktur å feste «prosjekt 2 fra 11:30» på | `utils/dagsegment.ts:93-94` | Modellmangel |
| **H9** | **Posisjon fanges kun to ganger** — start og slutt. Ingen besøkslogg | `db/schema.ts:362-366` | Modellmangel |
| **H10** | **Ingen byggeplass→byggeplass-akse** i matrisen. ⚠️ Etter V9 avgjør aksen IKKE lønn (mellometappe = arbeidstid uansett avstand) — den trengs kun for km (K4) og sjåfør, og ligger i lag 5 | `@@unique([oppmotestedId, byggeplassId])` | Modellmangel |
| **H11** | **«Utenfor alle oppmøtesteder» skiller ikke** «startet hjemmefra» fra «GPS var avslått» | `useArbeidsdag.ts:55` | Stille feil |
| **H12** | **Oppmøtested × byggeplass gjenkjennes uavhengig og forenes aldri** | `useArbeidsdag.ts:143-144` | Udefinert |
| **H13** | **Fire konkurrerende «jeg er her», ingen delt, ingen testet** | § 1 | Drift |
| **H14** | **Mobil sedel har `project_id` NOT NULL** — kjent gjeld som venter på nettopp dette kravet | `timer.md:124` | Blokkerer flerprosjekt |

### 🔴 Hull funnet i KS 2026-10-01 (fabel) — verifisert av orkestrator

| # | Hull | Bevis | Klasse | Lag |
|---|---|---|---|---|
| **H15** | 🔴 **Matrisen måler til prosjektets PRIMÆRbyggeplass, ikke til den GPS fant.** `resolverPrimaerByggeplass(projectId, oppmotestedId)` — `dag.byggeplassId` brukes **aldri** i oppslaget. På et prosjekt med fem byggeplasser er avstanden målt til feil sted | `StartSluttDagKort.tsx:478-481`, `reisetidMatriseKatalog.ts:94` | 🔴 **Feil lønn** | **1** |
| **H16** | **Reservemålingen er luftlinje start-GPS → slutt-GPS delt på 50 km/t** — ikke kontor → byggeplass, ingen omveisfaktor. Og **mangler avstand helt, klassifiseres reisen STILLE som under terskel** | `StartSluttDagKort.tsx:494-507`, `reise.ts:165-172`, `:91` | 🔴 **Feil lønn, stille** | **1** |
| **H17** | **Overtid har motstridende definisjoner, og ingen tåler en delt dag.** `reisetidTellerOvertid` leses kun på mobil; mobil regner pr. ØKT, ikke pr. dag. Doktrinen spriker: `timer.md:161` «reisetid teller IKKE som arbeidstid» mot firmainnstillingen «Reisetid teller mot overtid». 🔴 **Og server og mobil er uenige I DAG, uten at noe flagg er endret:** `overtidsgrunnlag.ts:50` summerer ALLE rader inkludert reise, og flagget finnes ikke i den koden — mens mobil med flagget AV holder reisen utenfor normfradraget. Skjema-kommentaren på `:468` beskriver mobilens atferd, ikke serverens *(gate-funn 2)* | `StartSluttDagKort.tsx:785`, `overtidsgrunnlag.ts:50`, `timer.md:161` | 🔴 **Feil lønn** | **2 + 4** |
| **H18** | **Reise regnes ÉN vei, maks én rad pr. dag. Retur finnes ikke.** Og `timer.md:1086` sier **byggeplass → byggeplass er kompensert for ALLE**, ikke bare sjåfører | `StartSluttDagKort.tsx:866-888`, `timer.md:1086` | Manglende funksjon | **4** |
| **H19** | **Eksporten bærer ingenting av sporbarheten.** Reise-rader går ut som vanlige timerader med lønnsartnavn — uten km, avstand, fra- eller til-sted. **Følger av H4: avstanden lagres aldri, så ingenting nedstrøms kan ha den** | `rapport.ts:465-470` | Usporbar lønn | **2** |
| **H20** | **Ingen origo når dagen ikke starter på et kontor.** Ingen reise, ingen reserve, ingen kobling bruker → fast oppmøtested. `Oppmotested.avdelingId` finnes men har ingen leser, og mobil-cachen mangler feltet | `useArbeidsdag.ts:473`-gaten, `oppmotested.ts:98-104` | Manglende funksjon | **1** |
| **H21** | 🔴 **Matrisen ARVER prosjektets koordinat når byggeplassen mangler punkt** — `b.latitude ?? b.project?.latitude`. Samme arving Kenneth fjernet fra origo-ordren 2026-10-01, men den har produsert reise-avstander for punktløse byggeplasser siden R3 (2026-06-11). Funnet under lag 1-målingen | `apps/api/src/services/reisetidMatrise.ts:67-74` | 🔴 **Feil lønn, stille** | **1** (C1 i lag 1-spec) |

🔴 **H15 er samme feilklasse som arvingen orkestratoren fjernet fra origo-ordren — men den står
i koden i dag.** Det var KS-ens skarpeste funn.

### 🟢 4b. Dagsmodellen — vedtatt av Kenneth 2026-10-01 (kveld)

Vedtakene er gitt i prosa til fabel (lukker K1, K6, K7, K8, K9 og H3-oppfølgeren). **Alt under er
vedtak, ikke måling** — hver regel er ❌ IKKE IMPLEMENTERT inntil laget som bærer den er levert og
gatet. Kode-referansene peker på det som skal endres, ikke på noe som virker.

| # | Regel | Lukker | Lag |
|---|---|---|---|
| **V1** | 🔴 **Reisetid er aldri overtid.** Kategorien reisetid inngår ikke i overtidsgrunnlaget, uansett klokkeslett. Retur etter overtid er fortsatt reisetid | H17 | 2 |
| **V2** | **Flagget «Reisetid teller mot overtid» utgår.** `OrganizationSetting.reisetidTellerOvertid` (`schema.prisma:468`) deprecates etter to-stegs-policyen; mobilens fradrag fra normen (nå `dagsforslag.ts:573-575` etter lag 0b) fjernes — **trukket inn i lag 1 / L1-B** (spec § 3 B2), så V7 ikke gir en midlertidig lønnsendring mellom lagene; serverens overtidsgrunnlag (`overtidsgrunnlag.ts:46-61`, brukt av `hentTilAttesteringFirma`) summerer i dag reise-rader inn og **skal ekskludere dem** | H17 | 2 |
| **V3** | **Reise under terskel som firmaet har satt til «som arbeidstid» ER arbeidstid** — føres på prosjektraden fra GPS-start og teller mot normen. Det er kategorien, ikke kjøringen, som avgjør | — | 1 |
| **V4** | **Overtid er kronologisk.** Alt over dagsnormen (sesongjustert via `ArbeidstidsKalender` `sommertid_start/slutt`) foreslås som overtid, og **prosjektet som eier klokkeslettet bærer det.** På en delt dag bærer siste prosjekt overtiden. Mobil regner i dag pr. økt, ikke pr. dag — må bli pr. dag | H17 | 4 |
| **V5** | **Normen følger ankomsten, ikke firmaets standard starttid.** Arbeidsdagen begynner når reisen slutter; ordinær slutt = ankomst + norm + pause. `standardStartTid` er forhåndsutfylling, ikke ramme. ⚠️ Glemt-dag-vakten `kappGlemtDagSlutt` (`StartSluttDagKort.tsx:544-548`) kapper i dag til start + dagsnorm når spennet overstiger `MAKS_ENKELTSKIFT_TIMER` — med V5 må kapp-lengden bli reise + norm + pause, ellers kappes en lang reisedag feil *(rettet etter gate: `:535` pekte på kommentaren, ikke koden)* | — | 1 |
| **V6** | 🟢 **VEDTATT 2026-10-02 (Kenneth): pausevinduet er en firmainnstilling med to moduser.** **(a) Fast:** pause `X` timer etter fast arbeidstid-start (f.eks. 4 t etter 07:00 → 11:00–11:30, uansett ankomst). **(b) Fra ankomst:** pause `X` timer etter at reisen slutter (reise 07:00, ankomst 09:00 → 13:00–13:30). `X`, starttid og pauselengde er justerbare variabler. ⚠️ **Variablene FINNES alt** — `standardStartTid` 07:00, `standardPauseEtterTimer` 4.0, `standardPauseMin` 30 (`schema.prisma:430-437`); det nye er et modusvalg (arbeidsnavn `pauseReferanse: "fastStart" \| "ankomst"`, én ny kolonne, additiv). Pausen trekkes alltid; på delt dag fra prosjektet som eier vinduet | — | 1 |
| **V7** | **Tur OG retur.** Slutt-GPS innenfor et oppmøtested → returetappe foreslås fra cellen **kontor × SISTE byggeplass** (på delt dag er det ikke samme celle som utreisen; matrisen har kontor × alle byggeplasser, så cellen finnes). Ellers foreslås slutt på prosjektet, og brukeren legger til retur selv | H18 | 1 |
| **V8** | **Reise-rader får klokkevindu**, utledet fra GPS-tidspunkt ± matrisetid (start 05:00 + 120 min → ankomst 07:00; slutt 19:30 − 120 min → avreise 17:30) og **raden bærer en kilde-markør** (`tidKilde: utledet | stempel | manuell`) som vises på bekreftelsesskjermen og følger med i eksporten. 🔴 **Vinduet SER målt ut, men er det ikke** — REISE-UNNTAKETS begrunnelse («et fabrikkert vindu er falske lønnsdata») holder fortsatt, og markøren er det som gjør V8 forenlig med § 2. Uten markør er V8 nøyaktig den usporbarheten planen skal fjerne *(gate-funn 1b)*. 🔴 **Reverserer REISE-UNNTAKET** (fabel-vedtak 2026-07-13, `StartSluttDagKort.tsx:875-882`, `fraTid/tilTid: null`) — vinduet er nødvendig for V4 og V5. Lag 4 erstatter utledning med ekte ankomststempel. ⚠️ **Følge som MÅ testes:** med tider trer reise-rader inn i overlapp-vakten (`tidsromValidering.ts:64` hopper i dag over tid-løse rader), som er server-håndhevet (`dagsseddel.ts:635`, `:1750`) og **avviser hele synken ved treff**. Trolig trygt (arbeidsvinduet legges fra start + reise, `tidsromOverlapper` er streng), men det skal være en test, ikke en slutning *(gate-funn 1a)* | H4, H18 | 2 |
| **V9** | **Mellometappe i ordinær tid er arbeidstid, uansett avstand.** Bæres av prosjektet man kommer til. Tiden er klokketid mellom avreise og ankomst (krever ankomst-registrering, lag 4). **Følge:** byggeplass→byggeplass-aksen (H10) avgjør ikke lønn — den trengs kun for km (K4) og sjåfør, og **flyttes tilbake til lag 5**. Returen (den andre halvdelen av H18) dekkes av V7 via kontor × siste byggeplass, så heller ikke den trenger aksen *(presisert etter gate-funn 3)* | H18, H10 | 4 |
| **V10** | **Terskelen gjelder pr. etappe**, ikke pr. dag. To etapper på 20 km er to etapper under 30 km | — | 1 |
| **V11** | **Origo: starter dagen ikke på et kontor, er prosjektet oppmøtestedet.** Ingen reise. `Oppmotested.avdelingId` får ingen leser | H20 | 1 |
| **V12** | **GPS avslått ved start → ingen reise foreslås, med synlig årsak** på bekreftelsesskjermen («reise ikke foreslått: posisjon var utilgjengelig»). Arbeideren legger til selv. Skiller dermed H11s to tilfeller | H11 | 1 + 3 |
| **V13** | **Ingen regnefallback for manglende plassering.** Reservemålingen luftlinje/50 km/t (`StartSluttDagKort.tsx:494-507`, `reise.ts:165-172`) **fjernes**, og «mangler avstand → under terskel» (`reise.ts:91`) erstattes av «ingen reise». Mangler byggeplassen punkt, eller matrisen cellen, foreslås ingen reise — med årsak hos arbeideren | H16 | 1 |
| **V14** | **Manglende plassering skal være synlig, ikke påkrevd.** Tre varsler: merke «mangler plassering — reise beregnes ikke» i byggeplasslista (`oppsett/byggeplasser`), teller på Reisetid-matrise-flaten i firmainnstillingene («N byggeplasser mangler punkt»), og årsak hos arbeideren (V12/V13). **Adressefeltet som alt finnes i `createByggeplassSchema` geokodes ved opprettelse** (geokodings-prosedyren finnes), så de fleste får punkt uten ekstra klikk. Kartmodalen overstyrer alltid. **Ingen arv fra prosjektets punkt** (fjernet fra origo-ordren 2026-10-01 — et prosjekt kan strekke seg over kilometer) | H3, K6 | 1 |
| **V15** | 🟢 **Oppmøtested vinner over byggeplass ved start** (K2, 2026-10-02). Treffer start-GPS begge, er origo oppmøtestedet (`useArbeidsdag.ts:143-144` lagrer i dag begge uten å forene). Er første prosjekt det byggeplassen tilhører → avstand 0, ingen reise. Annet prosjekt → vanlig første etappe mot terskelen | H12 | 1 |

**Fasit-eksempler (Kenneths ord, 2026-10-01):**

| Dag A — sommernorm 8 t | Dag B — sen ankomst |
|---|---|
| 05:00–07:00 reisetid 2 t | 07:00–09:00 reisetid 2 t |
| 07:00–15:30 ordinær 8 t (30 min lunsj) | 09:00–17:30 ordinær 8 t (30 min lunsj) |
| 15:30–17:30 overtid 50 % 2 t | — |
| 17:30–19:30 reisetid 2 t | 17:30–19:30 reisetid 2 t |
| **4 t reise · 8 t ordinær · 2 t OT50** | **4 t reise · 8 t ordinær · 0 overtid** |

🔴 **Begge dagene skal inn som tester i laget som leverer V4/V5/V7/V8 — og én test skal FEILE
når en reise-rad havner i overtidsgrunnlaget** (jf. «stille tomhet»-regelen i CLAUDE.md, krav c).

**Faktum som begrenser:** overtidsmotoren har kun nivå 50 % (`lonnsregel.ts:42-56`, «Nivå 0-regel»:
`timelønn = min(arbeid, norm)`, resten 50 %). Tariffer med 100 % etter klokkeslett dekkes ikke av
eksemplene og er ikke vedtatt.

**Avstandsbånd × terskel, målt:** terskelen avgjør kategori (arbeidstid/reisetid); båndene velger
kun lønnsart når kategorien er reisetid (`reise.ts:139-157`, `timerKatalog.ts:280-300`).
Rekkefølge: bånd → firmaets `reiseLonnsartId` → navnematch `/reise|transport/`. Hjelpeteksten på
flaten sier «uten bånd velges på navn» — den hopper over midterste ledd.

---

## 5. Lagene — og hvorfor rekkefølgen er bindende

🔴 **Hvert lag forutsetter laget under. Bygges et lag før fundamentet, bygges det på en antakelse.**

### LAG 0 — Reparasjoner som ikke venter på noe

**Disse er uavhengige av hele GPS-modellen og retter feil som rammer i dag.**

🟢 **LEVERT 2026-10-02** (bestilt av Kenneth samme dag, orkestrator sendte ordrene). Regel 10 grønn på begge:
api 647 → 657 tester, mobil 120 → 133. **Reload: OTA** (0b er mobil-JS, 0a er server).

| Lag | Hull | Branch | Gatet | Merget |
|---|---|---|---|---|
| **0a** | H5 | `fix/timer-km-tak` | `ee6093fd` | `89acee95` |
| **0b** | H7 | `fix/mobil-splitt-dagsforslag` | `00166759` | `a13f4343` |

**To funn fra leveransen som endret planens tekst (ført i H5 og H7 over):** premisstabellen for H5 hadde
riktige linjetall men feil prosedyrenavn — veien uten tak var `redigerSedelRader`, ikke `syncBatch` ·
og H7 hadde et fjerde, stumt utfall (`kildeManglet`) som ingen hadde sett før agenten målte.

🔴 **Lærdom for lag 1–5:** begge funnene kom fra agenten som bygde, ikke fra planen eller ordren.
Linjetall uten prosedyrenavn er ikke en måling.

### LAG 1 — Fundament: én stedsmodell

**Uten dette finnes det ikke ett svar på «hvor er jeg».**

📄 **Spesifikasjon: [timer-gps-lag1-spec.md](timer-gps-lag1-spec.md)** (fabel 2026-10-02, ⚠️ UTKAST TIL GATE).
Leveranse A stedsmodell i shared · B reiseberegning i `beregnDagsforslag` · C datagrunnlag (fjerner H21-arven,
`geofenceKilde`, tre varsler) · D rydding. Tre ordrer, to additive migreringer. Fem åpne punkter for gaten (§ 7).

🔴 **FORUTSETNING funnet 2026-10-02 (orkestrator, `SAMARBEIDSREGLER.md:1214`):** `packages/shared`
typesjekkes aldri av regel 10 — 33 feil på ren develop, **3 i kilden (`signertBildePolicy.ts`)**.
Lag 1 legger den delte stedsmodellen nettopp i `packages/shared`. **Anbefaling (fabel): bestill
«lag 0c» FØR lag 1 — rydd de 3 kildefeilene og ta `shared tsc` inn i regel 10.** Uavhengig av alle
åpne beslutninger, liten, og uten den bygges lag 1 i en pakke ingen gate ser. *Kenneth-signal.*
🟢 **LEVERT 2026-10-02** (`d25618b1` → merge `c78bc14f`, branch `fix/shared-typecheck`). Regel 10 er nå
**fire ledd**: `turbo run typecheck --force` (11/11, 27 s) · web build · `turbo run test --force` 7/7 · lint.
Løsningen ble bredere enn bestilt: de to `tsc`-leddene ble byttet mot ett turbo-kall, så **api, db,
db-maskin, db-timer, db-varelager, pdf og ui er gatet for første gang** (var grønne; ingen så etter).
`signertBildePolicy.ts` verifisert urørt (null linjer i diffen). Ingen `any`/`ts-ignore`.

⚠️ **To kjente kanter, ført som begrensninger — ikke avvik:**
- **`"types": ["node"]` i `packages/shared/tsconfig.json:6`** sier at Node-globaler finnes i hele pakken,
  også i kode som kjører i React Native og nettleser. En fremtidig `fs`-import i shared ville typesjekke
  og krasje i appen. DOM-lib hadde hatt speilvendt problem. **Lag 1 legger stedsmodellen i shared —
  bruk kun globaler som finnes i alle tre runtimes, og ingen Node-moduler.**
- **Mergen krever `pnpm install` i ALLE arbeidstrær** (`@types/node` er ny devDependency). Uten install:
  `turbo typecheck` exit 2, «0 vellykket av 9», `TS2688`. **Ser ut som regresjon for den som ikke vet** —
  står her fordi neste agent puller develop før han leser SAMARBEIDSREGLER.

🟡 **Nytt latent hull, samme klasse, IKKE i denne planen:** `tests/e2e` har ingen typesjekk (intet
`typecheck`-script, ingen tsconfig). Plassert i [BACKLOG § 1](BACKLOG.md) — det er gate-gjeld, ikke
timer-GPS. Lag 1 er ikke avhengig av det.

- **Én delt avstandsfunksjon** i `packages/shared` — i dag kun i `apps/mobile`. **Server og web må kunne regne.**
- **Én funksjon pr. kapabilitet** (A/B/C fra § 1), ikke fire konkurrerende. **Hver med navngitt regel og test.**
- **Én navngitt terskel pr. kapabilitet** — ikke 500 m hardkodet ett sted og ingenting et annet (H1, H2).
- **Definert tilstand for «ingen treff»** som skiller fravær fra feil (H11).
- 🟢 **Oppmøtested vinner når det overlapper med byggeplass** (H12 → **V15**, K2 vedtatt).

- 🔴 **Målekjeden skal måle til riktig sted** (H15) — i dag måles det til prosjektets
  primærbyggeplass, ikke dit arbeideren faktisk er.
- 🔴 **Ingen reservemåling** (H16 → **V13**) — luftlinje/50 km/t fjernes, «mangler avstand» blir
  «ingen reise + årsak», ikke stille «under terskel».
- **Origo** (H20 → **V11**): starter dagen ikke på et kontor, er prosjektet oppmøtestedet. GPS av
  → ingen reise med synlig årsak (**V12**).
- **Reisemodellen får tur OG retur** (**V7**), terskel pr. etappe (**V10**), og reise under terskel
  satt til «som arbeidstid» føres som arbeidstid på prosjektraden (**V3**).
- **Normen følger ankomsten** (**V5**) og pausen trekkes alltid fra ankomst (**V6**, ⚠️ utledet).
- **Manglende plassering synlig i tre flater + geokoding ved opprettelse** (**V14**). Ingen arv,
  ingen fallback, ikke påkrevd.

🟢 **K1 er avgjort i streng form** (V13 + V14, § 6): reise beregnes kun fra OSRM-matrisen til den
byggeplassen GPS fant (H15). Alt annet gir «ingen reise» med årsak. **Lag 1 kan spesifiseres nå
— men bestilles først etter at orkestrator har gatet denne revisjonen (§ 7b).**

### LAG 2 — Sporbarhet: det som avgjør lønn skal kunne etterprøves

**Uten dette er alt over et lag som produserer lønn ingen kan kontrollere.**

- **Avstanden som valgte lønnsart lagres på raden** (H4).
- **Oppmøtestedet og posisjonen følger med til serveren** (H6) — i dag dør de på telefonen.
- **Serveren kan verifisere en reiseklassifisering**, ikke bare ta imot den.
- 🔴 **Og sporbarheten skal nå helt ut i EKSPORTEN** (H19). Stopper den i databasen, ser regnskap
  fortsatt en naken timeverdi — og da er laget ikke levert.
- 🔴 **Reisetid ut av overtidsgrunnlaget, overalt** (**V1**, **V2**): flagget deprecates, mobilens
  norm-fradrag fjernes, serverens attesteringsvarsel ekskluderer reise-rader. **Test som feiler når
  reise havner i grunnlaget** (§ 4b).
- **Reise-rader får utledet klokkevindu med kilde-markering** (**V8**) — reverserer REISE-UNNTAKET
  fra 2026-07-13 bevisst og ført. Vinduet er det som gjør V4/V5 regnbart.

⚠️ **Dette er det laget som er lettest å hoppe over og dyrest å mangle.** Det gir ingen ny
funksjon brukeren ser — og uten det kan ingen svare på «hvorfor fikk jeg denne lønnen».

### LAG 3 — Bekreftelse: den menneskelige porten

**Dette er det som gjør at lag 4 og 5 i det hele tatt er tillatt (§ 3).**

- **Bekreftelsessteget etter «Slutt dag»** — egen skjerm, forslaget vises, arbeideren retter og
  bekrefter. **Dagen forblir åpen hvis han avbryter** (Kenneth-vedtak 2026-10-01).
- **Sammenligningsvisningen ved konflikt** — 🟢 **LEVERT** (`e4866f8d` + `9c7c1ad1`).
- **Forespørsel til leder når dagskortet er attestert** (U-BEKREFT-R) — krever én migrering.
- **Bekreftelsesskjermen bærer årsakene** når reise ikke er foreslått (**V12**, **V13**): «posisjon
  utilgjengelig» · «byggeplass X mangler plassering» · «ingen matrisecelle». Uten dette er V13 en
  stille tomhet.

🔴 **Og de tre kodekommentarene som forbyr GPS å velge prosjekt må reverseres HER — eksplisitt,
med henvisning til Kenneths vedtak og til at bekreftelsessteget er på plass.** Rives de før
bekreftelsessteget finnes, brytes G1.

### LAG 4 — Flere prosjekter pr. dag

**Forutsetter lag 1 (ett stedssvar), lag 2 (sporbarhet) og lag 3 (bekreftelse).**

- **Segment må få en stedsdimensjon** (H8) — i dag er grensen midnatt og ingenting annet.
  ⚠️ **Rettet etter KS: strukturen er HALVBYGD, ikke fraværende.** `sheet_timer_local.byggeplassId`
  finnes — forslaget setter den bare aldri på radene, kun på sedelen.
- 🟢 **Overtid på delt dag er avgjort** (H17 → **V4**): kronologisk, prosjektet som eier
  klokkeslettet bærer den, siste prosjekt bærer overtiden. Mobilens pr.-økt-regning må bli pr. dag.
- 🟢 **Mellometapper er avgjort** (H18 → **V9**): arbeidstid uansett avstand, bæres av prosjektet
  man kommer til, måles som klokketid avreise→ankomst. **Derfor trenger lag 4 IKKE
  byggeplass→byggeplass-aksen** — H10 er flyttet tilbake til lag 5. *(KS-en flyttet den hit;
  V9 flytter den tilbake, fordi avstanden mellom prosjekter ikke avgjør lønn.)*
- **Ankomststempel erstatter utledet vindu** (**V8**) — ankomst-registreringen under gir ekte
  klokketid for både reise og mellometappe.
- **`dagsseddel_local.project_id` må bli nullable** (H14) — gjelden `timer.md:124` navngir.
- **Ankomst-registrering** — noe må merke at man kom til prosjekt nr. 2.
- ⚠️ **Og overlapp-regelen består:** to prosjekter må ha adskilte klokkevinduer. **«To steder
  samtidig» er ikke uttrykkbart, og det er trolig riktig.**

### LAG 5 — Sjåføren

**Forutsetter alt over, og minst én beslutning som ikke er teknisk.**

- **Posisjonssporing gjennom dagen** (H9) — eller bekreftede stopp i stedet for sporing.
- **Byggeplass→byggeplass-akse i matrisen** (H10) — kun for km-sporbarhet (K4) og sjåfør, jf. V9.
- **En leveranse-/tur-entitet** — finnes ikke, og `vehicleId` på timeraden er en
  **mekaniker**-funksjon, ikke en sjåfør-funksjon.

---

## 6. Beslutninger som venter på Kenneth

🔴 **Ingen av disse kan avgjøres av orkestratoren. Hver av dem endrer hva som bygges.**

**Status 2026-10-02:** 🟢 K1, K2, K6, K7, K8, K9 vedtatt (regler i § 4b, V1–V15). 🔴 K3, K4, K5 åpne — ingen av dem blokkerer lag 1–3.

| # | Beslutning | Hvorfor den er din | Konsekvens av valget |
|---|---|---|---|
| **K1** | 🟢 **VEDTATT (streng), via V13 + V14.** Målekjeden er: GPS-identifisert byggeplass (H15) → OSRM-matrise → terskel pr. etappe (V10). Mangler et ledd, er svaret «ingen reise + årsak» — aldri et estimat, aldri arv fra prosjektet | Lønn | Færre byggeplasser får reise før punktet er satt; de som får, får riktig tall. V14 gjør mangelen synlig i tre flater |
| **K2** | 🟢 **VEDTATT 2026-10-02 (Kenneth): «på kontoret».** Treffer start-GPS både et oppmøtested og en byggeplass-geofence, er origo oppmøtestedet. Er dagens første prosjekt det byggeplassen tilhører, er avstanden null og ingen reise foreslås. Kjøres det til en annen byggeplass, er det en vanlig første etappe fra kontoret mot terskelen (V10). Ført som **V15** i § 4b | Produktvalg | Lukker H12 |
| **K3** | **Sporing eller bekreftede stopp?** Sjåfør-modellen trenger å vite hvor man var underveis | 🔴 **Personvern.** Krever samtykke, og `mannskap.md:19` sier juridisk sign-off for bakgrunns-geofencing | Sporing: automatisk, men inngripende. Bekreftede stopp: arbeideren trykker ved ankomst |
| **K4** | **Skal km bli en målt størrelse?** I dag skrives km i feltet «timer» med tak 24 | Lønn + regnskap. `timer.md:228` sier «regnskap eier satsene og km-utmålingen» — **vedtaket ditt kolliderer med det** | Eget felt: SiteDoc måler km. Som i dag: regnskap måler, vi bare fører |
| **K5** | **Hvor mye skal serveren verifisere?** I dag: ingenting. Alt skjer offline på telefonen | Risiko vs. kompleksitet | Full verifisering krever at posisjon synkes — altså lagring av hvor ansatte har vært |
| **K6** | 🟢 **VEDTATT via V14:** ingen bulk-etterfylling. Eksisterende byggeplasser uten punkt merkes i lista og telles på matrise-flaten; admin setter punkt i modalen (ett klikk) | Omfang | Antall som mangler er fortsatt ikke målt (§ 8) |
| **K7** | 🟢 **VEDTATT:** *«reisetid er aldri overtid»* (V1). Flagget utgår (V2). Overtid er kronologisk og bæres av prosjektet som eier klokkeslettet; siste prosjekt bærer overtiden på delt dag (V4). Doktrinen samles: `timer.md:161` vinner, `:228`/`:1086` skrives om | Lønn | Lukker H17 |
| **K8** | 🟢 **VEDTATT:** tur og retur (V7), utledet klokkevindu fra GPS ± matrise (V8), mellometappe = arbeidstid til prosjektet man kommer til (V9), terskel pr. etappe (V10). Normen følger ankomsten (V5) | Lønn | Lag 4 trenger IKKE ny matriseakse (V9) |
| **K9** | 🟢 **VEDTATT:** *«oppmøtested er på prosjekt»* — ingen reise når dagen ikke starter på et kontor (V11). GPS av → ingen reise med synlig årsak (V12). `Oppmotested.avdelingId` forblir uten leser | Lønn | Lukker H20 og H11 |

---

## 7. Hva som IKKE skal bestilles ennå — og hvorfor

| Ordre | Status | Grunn |
|---|---|---|
| `inbox-dokgen-byggeplass-origo.md` | ⏸️ **HOLDES — kan omskrives** | K1 er nå avgjort (V13/V14). Ordren må **skrives om til V14** (geokoding ved opprettelse + tre varsler, ingen arv, ingen fallback, ikke påkrevd) og gates av orkestrator FØR den sendes |
| `inbox-kontrollplan-bekreft-dagsforslag.md` | ⏸️ **PAUSET** | Arkitektur-splitten (beregn/anvend) står og hører i LAG 0. **Skjermen venter på at modellen er avklart** |
| U-BEKREFT-R (forespørsel til leder) | ⏸️ | Krever migrering. Hører i lag 3, etter at lag 3s første del er inne |
| Alt i lag 4 og 5 | ⏸️ | Forutsetter lag 1–3 |
| **Lag 0** | 🟢 **LEVERT 2026-10-02** | `89acee95` + `a13f4343` — se § 5 |
| **Lag 0c** (shared tsc) | 🟢 **LEVERT 2026-10-02** | `c78bc14f` — regel 10 er fire ledd, 10 pakker typesjekkes |

🟢 **Lag 0 er komplett (0a · 0b · 0c).** 🔴 **Neste er lag 1-spesifikasjonen, skrevet av fabel fra
V-reglene.** **Lag 1-spesifikasjonen er skrevet** ([timer-gps-lag1-spec.md](timer-gps-lag1-spec.md)) og ligger til gate hos
orkestrator. Ingen kode-ordre før gaten er gitt. Ingen kode-ordre før spesifikasjonen er gatet.

---

## 7b. KS av planen (fabel, 2026-10-01)

🟢 **Planen besto på struktur og på alle linjereferansene som ble kontrollert** (H1, H2, H4, H5,
H7 og de to holdte ordrene). 🔴 **Men den manglet seks hull — fire av dem i klasse «feil lønn» —
plasserte H10 i feil lag, og formulerte K1 for smalt.** Alt er ført inn over, og orkestrator har
verifisert de tyngste mot kode.

🔴 **Det skarpeste funnet, H15, hadde orkestratoren målt selv og likevel ikke ført inn.** Lærdommen
er ikke «mål mer» — den er at **en måling som ikke føres inn i planen, er en måling som ikke
finnes.**

🟢 **Fabel kontrollerte; orkestrator førte inn.** Kontrolløren redigerer ikke det den gater — da
kollapser de to hodene.

**Rollebytte for dette dokumentet (Kenneth-vedtak 2026-10-01 kveld):** fabel **eier og skriver**
planen fra og med revisjonen med V1–V14; **orkestrator gater** den før den brukes som grunnlag for
ordrer. Prinsippet over står — det er fortsatt to hoder, de har bare byttet side for denne fila.
Rollene for kode-ordrer er uendret. Rollen er ført i `SAMARBEIDSREGLER.md` (`a3bbfff6`).

🟢 **GATET av orkestrator 2026-10-02** (svar i `relay/inbox-fabel.md`): alle åtte kode-referansene i § 4b
traff, V8 knekker ikke `syncBatch`, V9-flyttingen holder. **Tre funn ført inn samme dag:** V8s vindu
er fabrikkert og må bære kilde-markør (V8) · server og mobil er uenige om overtidsgrunnlaget i dag
(H17) · returen på delt dag går fra kontor × siste byggeplass (V7/V9). **To rettelser av egen tekst:**
`:535` pekte på en kommentar (V5 rettet til `:544-548`, og kappingen er en glemt-dag-vakt, ikke en
generell kapping) · gaten leste K8 som åpen, men den står som vedtatt — V7 var upresis på delt dag.
*(Orkestrators lag 0-rapport 2026-10-02 lister de tre gate-funnene som «fortsatt uført» — de ble ført
i `a86a5934`, før lag 0-ordrene gikk ut. Rapporten er skrevet mot en eldre lesning.)*

## 8. Hva denne planen IKKE svarer på

**Ført eksplisitt, så den ikke leses som mer komplett enn den er:**

- **Personvernvurderingen for posisjonssporing** er ikke gjort. `mannskap.md:19` flagger juridisk
  sign-off; det finnes ikke noe personverndokument for GPS-sporing av arbeidstid i repoet.
- **Hvor mange byggeplasser som faktisk mangler punkt** er ikke målt — krever SQL mot databasen,
  som kun Kenneth kjører.
- **Eksportsidens behandling av `sats`/`satsEnhet`** mot regnskapssystemene er ikke lest.
- **Overtid 100 %-nivå** finnes ikke i motoren og er ikke vedtatt. Eksemplene trenger det ikke.
- **K3 (sporing), K4 (km som målt størrelse), K5 (server-verifisering)** er fortsatt åpne. V9 gjør at
  K4 er det eneste som trenger byggeplass→byggeplass-aksen. K5 avgjør hvor mye lag 2 verifiserer server-side.
- **Sjåfør-modellen er ikke spesifisert** av noen, noe sted. Den er nevnt av Kenneth 2026-10-01
  og finnes ikke i dokumentasjonen ellers.
