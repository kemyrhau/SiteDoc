> Del av [Timeføring på web — plan med bilder](../web-timeforing-plan.md): § 3. Seksjonsnumrene er de samme som før delingen.

## 3. Målt mot koden (develop @ 3b0f1abb; WM57–WM73 @ b8b16571)

> ⚠️ **Historisk måling, ikke dagens kode** (versjon 20). WM1–WM108 er målt mot hashene i overskriften og i
> `sist_verifisert_mot_kode`, før w1–w15g ble bygget. Linjenumre og «i dag» gjelder koden den gangen.
> «Bøtte» er serverens gamle maskintak (erstattet i w9, § 4.4). Firmavalget for fra–til på maskin (B5,
> WM66–WM67) er utgått (§ 8.22 punkt 1). Det som gjelder, står i § 8.20–8.22 og § 9.

Timer-koden er lik på de to hashene: `git diff 3b0f1abb b8b16571 -- apps packages` viser bare 3D-filer.

Forkortelser: `NY` = `apps/web/src/app/dashbord/timer/ny/page.tsx`, `WS` = `apps/web/src/app/dashbord/timer/[id]/page.tsx`,
`D` = `apps/api/src/routes/timer/dagsseddel.ts`, `M` = `apps/mobile/src`, `PS` = `packages/db/prisma/schema.prisma`,
`ST` = `packages/db-timer/prisma/schema.prisma`, `BD` = `apps/mobile/app/timer/bekreft-dag.tsx`.

**Web i dag**

| # | Funn | Referanse |
|---|---|---|
| WM1 | **To skjermer før første rad.** «Ny dagsseddel» på Mine timer åpner et skjema (dato, prosjekt, aktivitet, arbeidstid, kommentar). «Opprett dagsseddel» lager sedelen og åpner dagssiden. Det finnes ingen vei med ett trykk. | `apps/web/src/app/dashbord/timer/mine/page.tsx:313`; `NY:190–203`; `apps/web/src/app/dashbord/[prosjektId]/timer/ny/page.tsx:10` |
| WM2 | **Fra, til og pause i skjemaet kommer fra firmaets arbeidstid:** `OrganizationSetting.standardStartTid`, `standardSluttTid` og `standardPauseMin`. Standard i databasen er 07:00, 15:00 og 30. Firmaet endrer dem i Firma → Innstillinger. Bruker firmaet kalender som normkilde, kan kalenderen overstyre. | `NY:116`, `:124–126`; `apps/api/src/services/timer/arbeidstid.ts:49–70`; `PS:434–436`; `apps/web/src/app/dashbord/firma/innstillinger/page.tsx:953`, `:985` |
| WM3 | **Lønnsarten bærer ingen arbeidstid.** `Lonnsart` har ingen felt for fra, til eller timer pr. dag. Dagsnormen (7,5) er en egen firmainnstilling, `OrganizationSetting.dagsnorm`. | `ST:22–57`; `PS:408` |
| WM4 | **Serveren lager første timerad selv** når prosjektet er sendt med: firmaets standard-lønnsart (`erStandardvalg`), tidene fra skjemaet, og pausen trukket når dagen er over 5,5 timer. Byggeplass sendes ikke, så raden får «Ingen byggeplass» selv om toppen viser en. | `D:3859–3869`, `:2534–2538`; `packages/shared/src/utils/pauseBeregning.ts:30`; `NY:190–203` |
| WM5 | **Prosjekt, aktivitet og dato i skjemaet:** prosjektet fra toppen av siden, aktiviteten «Anleggsarbeid» hvis den finnes og ellers den første, datoen i dag. | `NY:108–113`, `:152–162`, `:46` |
| WM6 | **Vinduet «Legg til timer-rad»:** Fra er siste til-tid på dagen, ellers firmaets start. Derfor sto det 15:00 med tom Til hos Kenneth. Lønnsart er alltid standardvalget. Vinduet har en sammenleggbar del «Maskin (valgfritt)». **Vare finnes ikke i vinduet.** | `WS:693–706`, `:2840–2850`, `:3658–3724`, `:3350–3368` |
| WM7 | **Vinduet «Legg til maskinbruk»** har Utstyr, Timerad, Byggeplass, Antall timer, Fra kl., Til kl., Mengde, Enhet, Underprosjekt og en infolinje. Fra og til er merket valgfritt og er ikke påkrevd noe sted, verken i skjermen eller på serveren. De fylles ut med dagens ramme, og antallet regnes av dem. | `WS:4798–5308`, `:1030–1037`, `:4874–4886`, `:5166–5194`, `:5075`; `D:10033` |
| WM8 | **«Timerad (Valgfritt)»:** merkelappen «Valgfritt» står så lenge utstyr ikke er valgt. Velger du en maskin som krever timerad, forsvinner den, og lagring stoppes uten rad. Timeraden er forvalgt når kortet har én arbeidsrad. Serveren håndhever det samme (R24). | `WS:4925`, `:5113–5121`, `:5036–5043`, `:4917–4922`; `D:2195–2201`; `packages/shared/src/utils/maskinKobling.ts:19–21` |
| WM9 | **«Arbeid i gruppen: 7,5 t · ledig: 8 t»:** ledig er arbeid **pluss pausen**, minus maskintimer som alt er ført. 7,5 + 0,5 = 8. Teksten sier ikke det. | `packages/shared/src/utils/maskinKapasitet.ts:72–73`; `WS:4988–4992`; `packages/shared/src/i18n/nb.json:604` |
| WM10 | **Maskinens fra–til brukes ikke videre.** Rapport og eksport tar dem ikke med. Attesteringens redigering bærer dem bare videre. | `packages/shared/src/utils/timerDetaljRader.ts:223`; `apps/api/src/routes/timer/rapport.ts:697–714`; `apps/web/src/components/timer/AttesteringDetalj_Edit.tsx:174` |
| WM11 | 🔴 **Varen kobles ikke til timeraden på web.** Vinduet for vareforbruk sender bare dagen. Kolonnen for kobling finnes, og serveren tar imot den. Varen blir derfor en egen linje i attesteringen. | `apps/web/src/components/timer/KortVareforbrukModal.tsx` (0 treff på `sheetTimerId`); `apps/api/src/routes/vareforbruk.ts:75–84`; `packages/db-varelager/prisma/schema.prisma:85–88` |
| WM12 | **I kortet på dagssiden står maskinene etter timeradene, og varene i en egen liste under.** Ikke på raden. | `WS:2173–2194`, `:1699–1715` |
| WM13 | **Dagens web, talt for scenarioet: 10 trykk og 3 felt.** Ny dagsseddel · Til 15:30 · Opprett · + Maskin · åpne velger · Volvo · antall 4 · Lagre · + Vareforbruk · betong · antall 4 · Lagre · Send dagen. Talt i koden, ikke klikket i nettleser. | WM1–WM11 |

**Telefonen i dag**

| # | Funn | Referanse |
|---|---|---|
| WM14 | **To moduser, styrt av firmaet:** dagskort (standard) og prosjektkort. I prosjektkort-modus åpner «+» Bekreft dag. | `PS:495`; `packages/shared/src/utils/prosjektkort.ts:13–14`; `M/components/DagsseddelListe.tsx:136–138` |
| WM15 | **Bekreft dag er én skjerm:** prosjekt, tid, lønnsartlinjer og pause, «+ Maskin» og «+ Varer», tillegg og utlegg, beskrivelse, «Bekreft og lagre». Så «Send dagen». | `BD:1454–1506`, `:2279–2292`, `:1805`; `M/components/timer-detalj/BekreftDagRadTillegg.tsx:119`, `:127` |
| WM16 | **Maskin på telefonen har ikke fra–til når den føres fra en rad** — bare timer, mengde og enhet. Timene er forhåndsutfylt med radens timer. Fra Bekreft dag lagres maskinen uten fra–til. Dagskort-modusens maskinvindu har fortsatt fra–til. | `M/components/timer-detalj/BekreftDagRadTillegg.tsx:271`; `M/utils/dagsforslagAnvend.ts:503–504`; `M/components/timer-detalj/MaskinSeksjon.tsx:928` |
| WM17 | **Forhåndsutfylling på telefonen:** start er siste til-tid på dagen, ellers firmaets start; slutt er firmaets slutt; pausen er firmaets. Sist brukte maskiner står øverst i velgeren (fem). | `M/utils/manuellDag.ts:44–51`; `M/utils/nyRadTider.ts:23–24`; `M/services/nyTimerRad.ts:130` |
| WM18 | **I kortet står maskin og vare under raden sin:** «Volvo EC220E · 4 t» og «Betong 4 m3». | `M/components/timer-detalj/prosjektkort/ProsjektkortDagsoversikt.tsx:741`, `:755` |

**Attesteringen (bilde 84)**

| # | Funn | Referanse |
|---|---|---|
| WM19 | **En maskin står på timeradens linje bare når den er koblet** til en timerad i samme kort. Ellers er den egen linje med Type «Maskin». Kolonnene Maskin og Maskintimer er på som standard. Sortering endrer ikke dette. | `packages/shared/src/utils/kortGruppering.ts:156–157`; `packages/shared/src/utils/timerDetaljRader.ts:736–742`; `apps/web/src/components/timer/TimerRadTabell.tsx:166–169` |
| WM20 | **PC sendte ikke koblingen før d2c-1,** som ble merget 2026-11-16 kl. 23:14. Telefonen fikk sperren 2026-11-17 kl. 10:16. Rader ført 07.11 på PC har derfor ingen kobling. **Ikke målt:** databasen — jeg har ikke lest radene til Kenneth. | `git show 274e7fb2^1` (0 treff på `sheetTimerId` i `WS`); `git log -1 274e7fb2`, `338de16a` |
| WM21 | **Hvorfor maskinlinjene er høye — mest sannsynlig Avvik-cellen.** Alle celler kuttes med «…», unntatt Beskrivelse og Avvik, som brytes over flere linjer. En egen maskinlinje får to setninger i Avvik: «Maskin uten arbeidstimer» og «Maskinarbeid uten registrert maskinførerbevis — flagget for synlighet.» Kolonnen er minst 180 px bred. Rundt 95 tegn i 180 px gir fem–seks tekstlinjer. **Lest i koden, ikke målt i nettleser.** | `apps/web/src/components/attestering/AttesteringTabell.tsx:259–262`; `apps/web/src/components/attestering/attestering-tabell.ts:300–306`; `packages/shared/src/utils/timerDetaljRader.ts:755`; `packages/shared/src/i18n/nb.json:5064`, `:4607` |
| WM22 | **Merket heter «Maskin uten arbeidstimer» i tabellen.** Specen (G5, R24) sier «Maskin uten timerad». | `packages/shared/src/i18n/nb.json:5064` |

**Prosjekt og byggeplass: hva web kan utlede (føring 1)**

| # | Funn | Referanse |
|---|---|---|
| WM23 | 🔴 **Telefonens GPS-logg sendes aldri til serveren.** Arbeidsdagen og besøkene pr. byggeplass ligger bare i telefonens lokale database. Serveren har ingen modell for dem og får bare den ferdige dagsseddelen. Det er et vedtak, ikke en mangel: «synkes ALDRI». | `M/db/schema.ts:447`; `docs/claude/timer-gps-helhetsplan.md:52`; `docs/claude/timer-gps-lag3-4-spec.md:131` |
| WM24 | **Det serveren har, er innsjekk-loggen:** `PsiTilstedevarelse` med prosjekt, byggeplass, bruker, innsjekk-tid, utsjekk-tid og kilde (manuell, QR, geofence, HMS-kort, app). Den finnes bare når PSI-modulen er på. Klokkeslettene er firma-isolert. | `PS:2436–2454`; `apps/api/src/routes/mannskap.ts:166` |
| WM25 | **Ingen prosedyre gir «mine innsjekker for en dato».** `minStatus` gir bare den åpne innsjekken nå, for ett prosjekt. `hentForProsjekt` gir alle personer på prosjektet. | `apps/api/src/routes/mannskap.ts:269`, `:319` |
| WM26 | **Prosjektet og byggeplassen i toppen av siden («innlogget»):** prosjektet huskes i nettleseren. Byggeplassen huskes i nettleseren og på serveren. En innsjekk som er nyere enn det manuelle valget, går foran. Timer-sidene leser begge. | `apps/web/src/kontekst/prosjekt-kontekst.tsx:15`; `apps/web/src/kontekst/byggeplass-kontekst.tsx:22`, `:152`; `packages/shared/src/utils/standardByggeplass.ts:87`; `NY:108–113`; `apps/web/src/components/timer/RadByggeplassFelt.tsx:19–41` |
| WM27 | **Vedtak 2026-11-15:** målte tidspunkter fra geofence og innsjekk **kan** foreslås som tider; arbeideren bestemmer og retter. Innsjekk som tidskilde er en egen ordre som ikke er bygget. | `docs/claude/timer-gps-lag3-4-spec.md:133` |
| WM28 | **Telefonens dagsforslag er ren regning, men bor i mobilappen** og leser telefonens lokale database. Web har ikke noe tilsvarende. GPS i nettleseren på PC er et eget BACKLOG-punkt som ikke er gjort. | `M/utils/dagsforslag.ts:10`; `M/services/dagsforslagInput.ts:86`; `docs/claude/BACKLOG.md:4412` |

**Tillegg, utlegg og beskrivelse (føring 2 og 3)**

| # | Funn | Referanse |
|---|---|---|
| WM29 | **Tillegg og utlegg på web går gjennom en velger og så et eget vindu hver.** Antallet er forhåndsutfylt med 1. Kvittering kan bare legges ved etter at raden er lagret. De hører til kortet (`kortId`), ikke til en timerad. Web sender ikke `kortId`; serveren finner kortet selv. | `WS:4300`, `:3842`, `:4503`, `:3870`, `:4106`; `ST:435`, `:513`; `D:5178`, `:5227` |
| WM30 | **På telefonen står tillegg og utlegg i Bekreft dag,** på samme skjerm som resten, pr. kort. | `BD:1805`; `M/components/timer-detalj/BekreftDagLonnUtlegg.tsx:18` |
| WM31 | **«Hva gjorde du?» er valgfritt på web og påkrevd på telefonen.** På telefonen er regelen én tekst pr. kort. Teksten lagres på kortets arbeidsrader. | `WS:3638`; `BD:998`; `M/utils/bekreftDag.ts:116`; `ST:251`; `docs/claude/prosjektkort-kortid-spec.md:529` |

**Maskintimene (føring 4)**

| # | Funn | Referanse |
|---|---|---|
| WM32 | **Maskintaket finnes i tre lag.** Serveren: maskintimer ≤ arbeidstimer + pause pr. bøtte (prosjekt + underprosjekt), kontrollert åtte steder. Telefonen pr. rad: hver maskin ≤ radens timer. Bekreft dag: pr. kort i skjermen. | `packages/shared/src/utils/maskinKapasitet.ts:42`, `:54`; `D:2806`, `:3287`, `:4135`, `:4389`, `:4818`, `:9252`, `:10079`, `:10212`; `M/services/kobledeMaskiner.ts:56–58`; `BD:1645` |
| WM33 | **Bekreft dag fordeler kortets maskiner og varer på kortets timerader selv.** Varene går til første rad. Maskinene fyller første rad og renner over til neste. En maskin på 9 timer på en jobb med 7,5 t ordinært og 1,5 t overtid blir to maskinrader. De lagres uten fra–til. | `M/utils/tilleggPaaKort.ts:80–81`, `:109`; `M/utils/dagsforslagAnvend.ts:503–504` |
| WM34 | **På web kan maskintimene ikke settes i timerad-vinduet** — maskinen får radens timer. I maskinvinduet er taket pr. bøtte en hard sperre. | `WS:3361`; `WS:5299` |
| WM35 | **Pausen i taket er begrunnet med døgn-maskiner.** Dokumentasjonen sier at den ikke er ment for timeleide maskiner. Koden legger den likevel til alle. Vedtak 2026-11-16 (B4): «maskin-tak som i dag på server, pr. kort i skjermen». | `docs/claude/fase-0-beslutninger.md:2112–2116`; `docs/claude/prosjektkort-kortid-spec.md:606` |
| WM36 | **I attesteringen står ansatt, maskin og maskintimer på samme linje.** I timerapportens Detaljer står maskinnavnet som et tillegg i Betegnelse, uten egen maskinkolonne. Egen kolonne hører til ordre d3 i kort-id-specen, som ikke er bygget. | `packages/shared/src/utils/timerDetaljRader.ts:736–742`; `apps/web/src/lib/timer-rapport-eksport.ts:420` |

**Overtid (Kenneths svar på versjon 2)**

| # | Funn | Referanse |
|---|---|---|
| WM37 | **Én regel avgjør overtid:** resten av dagsnormen er dagsnormen minus arbeid som alt er ført på datoen. Jobben får normaltid opp til resten, deretter overtid. Reise og fravær teller ikke. Det er dagsnormen som gjelder, ikke ukenormen. Bare 50 % er bygget. | `docs/claude/prosjektkort-kortid-spec.md:333–340`; `packages/shared/src/utils/lonnsregel.ts:10`, `:65`, `:114` |
| WM38 | **Telefonen viser overtid som egen linje** i Bekreft dag: «07:00–15:00 · 7,5 t · Timelønn ▾» og «15:00–15:30 · 0,5 t · Overtid 50 % ▾». Lønnsarten kan byttes pr. linje. Det lagres som to timerader i samme kort. | `docs/claude/prosjektkort-kortid-spec.md:355–362`; `M/utils/dagsforslag.ts:1888–1950`; `BD:2294–2310`; `packages/shared/src/i18n/nb.json:5776` |
| WM39 | **Web viser overtid som et forslag med knappen «Del raden»** i timerad-vinduet. Trykket lager to rader. Serveren lager aldri en overtidsrad selv. | `packages/shared/src/utils/overtidForslag.ts:74`; `WS:3101–3160`, `:3178–3250`, `:3538–3540`; `packages/shared/src/i18n/nb.json:631–633`; `D:2534–2538` |
| WM40 | **Mulig feil, lest og ikke kjørt:** når en rad deles i normal og overtid på web, får en ny maskin **hele** radens timer på normal-delen. | `WS:3236–3240` |
| WM41 | **«Sum i dag X t av Y t»:** prikken blir gul når X er over Y. Ingen tekst sier hvorfor. | `packages/shared/src/utils/prosjektkort.ts:173–180`; `WS:1822–1832` |
| WM42 | **Fordelingen med overtid:** en maskin på 4 t på en jobb med 7,5 t ordinært og 0,5 t overtid havner i sin helhet på den ordinære linja. En maskin på 8 t blir 7,5 + 0,5. Den ordinære er først fordi den lages først, ikke fordi radene sorteres på tid. | `M/utils/tilleggPaaKort.ts:76–88`; `packages/shared/src/utils/lonnsregel.ts:65` |
| WM43 | **I attesteringen blir ordinær tid og overtid to linjer i samme kort,** sortert på fra-tid. Varen står på linja den er koblet til. | `packages/shared/src/utils/kortGruppering.ts:147`, `:155–164` |

**Underprosjekt**

| # | Funn | Referanse |
|---|---|---|
| WM44 | **Et kort har ett prosjekt, ett underprosjekt og én byggeplass** (K2–K4). To kort kan ha like verdier (K7). | `docs/claude/prosjektkort-kortid-spec.md:107–109`, `:113` |
| WM45 | **Telefonen velger underprosjekt med knapper pr. kort,** «Uten» først. De vises bare når prosjektet har åpne underprosjekter, og ingenting er forhåndsvalgt utover «Uten». Valget skrives på kortets arbeidsrader, maskin, varer, tillegg og utlegg. «Sist brukt underprosjekt» finnes ikke. | `BD:1573`, `:667–679`; `M/utils/dagsforslagAnvend.ts:349–355`, `:497`, `:525`; `docs/claude/prosjektkort-kortid-spec.md:265–266` |
| WM46 | **Web velger underprosjekt i en nedtrekksliste i hvert vindu** (timerad, maskin, tillegg, utlegg). Lista er prosjektets aktive underprosjekter som er åpne for timer. Kortet på dagssiden er pr. prosjekt, med en undergruppe pr. underprosjekt. | `WS:3570–3590`, `:5238–5252`, `:593–657`, `:2129–2140`; `apps/api/src/routes/eksternKostObjekt.ts:69–89` |
| WM47 | **Web kan ikke lage et nytt kort på et prosjekt som alt har kort.** «+ Nytt prosjektkort» tilbyr bare prosjekter uten kort. Kort-id-specen § 5.4 sier at det skal gå. | `WS:680–682`, `:992` |
| WM48 | **Dele en jobb:** telefonen har «Del til eget kort» ved et klokkeslett. Web har «Del opp» pr. rad, der delene kan få ulikt underprosjekt. Valget «eget kort» finnes ikke i web-vinduet, selv om serveren støtter det. | `M/utils/kortIdForslag.ts:125`; `BD:1614`; `apps/web/src/components/timer/SplittRadModal.tsx` (0 treff på `egetKort`); `D:2612` |

**Attesteringen: linja, retting og oppdeling**

| # | Funn | Referanse |
|---|---|---|
| WM49 | **Et trykk på en linje gjør ingenting.** Lenken til detaljsiden står bare på dagens sumrad. | `apps/web/src/components/timer/TimerRadTabell.tsx:310–316`; `apps/web/src/components/attestering/AttesteringTabell.tsx:411` |
| WM50 | **Linja har 26 kolonner som standard og er minst 2 814 punkter bred.** Maskin begynner om lag 1 340 punkter inn, Vare om lag 1 700. På en skjerm på 1 440 må attestanten rulle sidelengs for å se dem. Regnet fra koden, ikke målt i nettleser. | `packages/shared/src/utils/timerDetaljRader.ts:736–742`, `:745–755`; `apps/web/src/components/timer/TimerRadTabell.tsx:192–194`; `apps/web/src/components/attestering/AttesteringTabell.tsx:75` |
| WM51 | **Retting i cellen er bygget:** fra, til, timer, pause, lønnsart og aktivitet på timeraden; maskin, maskintimer, mengde og enhet; antall på tillegg. Ikke prosjekt, underprosjekt, byggeplass, beskrivelse eller vare. Cellen viser «var …» etter retting. | `apps/web/src/components/attestering/AttesteringTabell.tsx:196–218`, `:239`, `:271–287` |
| WM52 | 🔴 **Underprosjekt kan ikke rettes fra tabellen.** «Flytt underprosjekt» finnes på serveren (`flyttTimerRadEco`), men **ingen skjerm kaller den** — 0 treff i `apps/web` og `apps/mobile`. Den flytter bare timer- og tilleggsrader; maskinens underprosjekt oppdateres ikke. Eneste vei i dag er detaljsiden → «Rediger hele sedelen» → nedtrekk → Lagre, om lag fire trykk. R14 og R21 i kort-id-specen forutsetter handlingen. | `D:6627`; `apps/web/src/components/timer/AttesteringDetalj.tsx:494–497`; `apps/web/src/components/timer/AttesteringDetalj_Edit.tsx:218` |
| WM53 | **«Del opp» (✂):** pr. del kan prosjekt, lønnsart, aktivitet, underprosjekt, fra, til og timer settes. Timene regnes ikke ut av klokkeslettene. Å dele 8 t i to med ulikt underprosjekt er om lag sju handlinger. Koblede maskiner og varer blir på første del. | `apps/web/src/components/timer/SplittRadModal.tsx:210–224`, `:280`; `apps/web/src/components/timer/RedigerTimerRad.tsx:63–147`; `D:7591` |
| WM54 | **Hvem får rette:** retting i cellen, pennen og ✂ krever firmaadministrator og firmavalget «rediger ved attestering». «Flytt underprosjekt» krever bare attesteringsrett. Skjermen viser ✂ og pennen uten å sjekke firmavalget; serveren avviser. | `D:7251`, `:2998`, `:7497`, `:6658`; `apps/web/src/components/attestering/AttesteringTabell.tsx:418`, `:431` |
| WM55 | **Mulig feil, lest og ikke kjørt:** vinduet bak pennen sender `byggeplassId: null` for alle radene det lagrer. | `apps/web/src/components/attestering/RedigerRadModal.tsx:403`, `:414`, `:435`, `:450` |
| WM56 | **Telefonens attestering kan ikke rette eller dele.** | `apps/mobile/src/components/timer-attestering/AttesteringDetaljMobil.tsx:52` |

**Målt i versjon 4 — «+ Registrer timer» og dagsseddelen (B1)**

| # | Funn | Referanse |
|---|---|---|
| WM57 | **Én dagsseddel pr. arbeider pr. dato, uten prosjekt.** Prosjektet ligger på raden. | `ST:214`; `D:3761–3764` |
| WM58 | **`opprett` er alt «finn eller lag».** Den tar imot dato, aktivitet (påkrevd) og prosjekt (valgfritt). Finnes dagen, returneres den urørt med `eksisterte: true`. Første timerad lages bare når sedelen er tom. | `D:3753–3774`, `:3824–3856`, `:3857–3869`, `:3871–3888`, `:2509–2530` |
| WM59 | **En jobb til på en dag som har rader, er `tilfoyTimerRad` med ny `kortId`.** Serveren tar imot feltet. Web sender det aldri, så raden havner i dagens eldste kort med samme prosjekt, underprosjekt og byggeplass. **Ikke lest:** hvordan `tilfoyTimerRad` behandler en `kortId` serveren ikke kjenner. | `D:3990–3991`; `WS` (0 treff på `kortId`); `docs/claude/prosjektkort-kortid-spec.md:232`, `:244` |
| WM60 | **Låsene.** Rader kan bare føres når dagen er utkast eller returnert. En sendt dag kan arbeideren gjenåpne selv, så lenge ingen rad er attestert. Dager eldre enn firmaets grense avvises. Fra og til er påkrevd på timeraden. | `D:230–233`, `:4009–4014`, `:5745–5790`, `:1531–1552`, `:4000–4006` |
| WM61 | **Knappen på Mine timer heter «Ny dagsseddel» og lenker til skjemaet.** Sedelens kommentar kan rettes på dagssiden etterpå. | `apps/web/src/app/dashbord/timer/mine/page.tsx:311–319`; `packages/shared/src/i18n/nb.json:269`; `WS:5346–5368` |

**Målt i versjon 4 — dagsnormen (B4)**

| # | Funn | Referanse |
|---|---|---|
| WM62 | **Normleseren tar firma og dato.** «Fast»: `dagsnorm`-kolonnen, og sesong ignoreres. «Kalender»: slutt − start − pause, og en dato mellom aktiv `sommertid_start` og `sommertid_slutt` samme år bruker tidene på `sommertid_start`-raden. Standard er «fast». Firmaet velger i Firma → Innstillinger. Leseren bruker altså kalenderens sommertid-markører, men bare når firmaet står på «kalender». | `apps/api/src/services/timer/arbeidstid.ts:45–136`, `:74–76`, `:78–119`, `:123–126`; `PS:485`, `:408`, `:3134–3135`; `apps/web/src/app/dashbord/firma/innstillinger/page.tsx:1135–1153`; `packages/shared/src/i18n/nb.json:2217–2220` |
| WM63 | **I «kalender» finnes ikke et eget normtall.** Normen er arbeidstiden. 7 t vinter og 8 t sommer settes som arbeidstid 07:00–14:30 og en sommertid-rad 07:00–15:30, begge med 30 minutter pause. I «fast» er normen den samme hele året. | `arbeidstid.ts:123–126` |
| WM64 | **Web og server leser normen pr. dato fra samme leser.** | `apps/api/src/routes/organisasjon.ts:1347–1358`; `WS:672–677`; `D:1161`, `:2548`, `:3818`, `:6540` |
| WM65 | **Halvdag og helligdag endrer ikke normen.** Leseren slår bare opp sommertid-radene. Ikke lest: telefonen. | `arbeidstid.ts:17–19`, `:78–106` |

**Målt i versjon 4 — maskin med fra–til som firmavalg (B5; ⚠️ firmavalget er utgått, § 8.22 punkt 1)**

| # | Funn | Referanse |
|---|---|---|
| WM66 | **Maskinradens fra og til er valgfrie kolonner; timer er påkrevd.** Radene trenger ingen skjemaendring. | `ST:593–594`, `:599` |
| WM67 | **Firmainnstillingene er faste kolonner.** Modellen har ikke noe fritt felt. En ny innstilling er en ny kolonne i `packages/db`, altså en migrering. Telefonen speiler firmainnstillingene i en lokal tabell med én kolonne pr. innstilling. | `PS:376`, `:495` (0 treff på `Json` i modellen); `M/services/organizationSettingKatalog.ts:86`; `M/db/schema.ts:783` |

**Målt i versjon 4 — attesteringen (B7, B9, datoen) og underprosjekt (B11)**

| # | Funn | Referanse |
|---|---|---|
| WM68 | **`Tooltip` støtter berøring:** trykk viser, trykk utenfor lukker. Veilederen fraråder nativ `title=`, som ikke vises på berøringsskjerm. | `packages/ui/src/tooltip.tsx:81`, `:175`, `:228`; `docs/claude/retningslinjer/tooltip-hjelpetekst-veileder.md:10`, `:23` |
| WM69 | **Standardutvalget er én liste.** Kolonnevalg, rekkefølge og bredde lagres pr. bruker på serveren. En bruker med lagret oppsett beholder det; ny standard treffer bare den som ikke har lagret noe. Ingen «tilbakestill til standard» er funnet. **Ikke lest:** om oppsettet lagres før brukeren endrer noe. | `packages/shared/src/utils/timerDetaljRader.ts:736–742`; `apps/web/src/hooks/useTabelloppsett.ts:40`, `:89`; `apps/web/src/components/attestering/AttesteringTabell.tsx:72–73`, `:101` |
| WM70 | **De 11 kjernekolonnene er 14 kolonner i koden.** Fra og til er to. Vare, enhet og mengde er tre. Lønnsart er kolonnen `betegnelse`. Minstebreddene summerer til 1 462 punkter, før avkrysning og knapper. Sidemenyen er minst 220 punkter, så om lag 1 220 er ledig på en skjerm på 1 440. Regnet, ikke målt i nettleser. | `timerDetaljRader.ts:700`, `:704–705`, `:712–714`, `:607–636`, `:745–755`; `apps/web/src/components/layout/NavSidebar.tsx:231` |
| WM71 | **Antall og Beløp er egne kolonner,** for tillegg og utlegg. Uten dem viser en tilleggslinje ikke antallet og en utleggslinje ikke beløpet. | `timerDetaljRader.ts:715–716` |
| WM72 | **Datoen skrives `2026-11-17`.** Firmaets attestering viser én uke om gangen, med forrige uke, neste uke og «Denne uka». Året kan bare byttes ved å bla uke for uke. Prosjektets attestering har ikke ukevalg. | `apps/web/src/components/attestering/attestering-tabell.ts:169–172`; `AttesteringTabell.tsx:466`; `apps/web/src/app/dashbord/firma/timer/attestering/page.tsx:159–176`, `:194–199`, `:345–369`; `apps/web/src/app/dashbord/[prosjektId]/timer/attestering/page.tsx` (0 treff på `fraOgMed`) |
| WM73 | **`ui-standarder.md` har ingen grense for knapper mot nedtrekk.** Regelen «adaptiv nedtrekk» gjelder fritekstfelt som lærer av bruk: forslag etter tre bruk, og søkefelt når lista passerer 7. Telefonen har bare knapper (WM45). | `docs/claude/retningslinjer/ui-standarder.md:102–115` |

**Målt i versjon 5 — dagsvisningen i attesteringen (B14), develop @ `ee7146e5`**

`AT` = `apps/web/src/components/attestering/AttesteringTabell.tsx`, `AM` = `apps/web/src/components/attestering/attestering-tabell.ts`,
`TR` = `apps/web/src/components/timer/TimerRadTabell.tsx`.

| # | Funn | Referanse |
|---|---|---|
| WM74 | **En dag har tre radtyper.** For hver jobb (kort): én oversiktsrad, så linjene. Etter dagens siste jobb: én dagsum. «Etter prosjekt» har ingen dagsum. | `AT:532–589`, `:569–570` |
| WM75 | **Samme opplysning står tre steder.** Oversiktsraden viser dato, ansatt, pr.nr., underprosjekt og jobbens sum. Linjene bærer de samme fire feltene. Dagsummen viser «Sum {dato} · {ansatt}» og dagens sum. En dag med én jobb og én linje viser derfor samme timetall tre ganger. | `AT:538–563`, `:578–588`; `AM:272–284`; `packages/shared/src/i18n/nb.json:5057` |
| WM76 | **«Dagen: X t av dagsnorm Y t» bygges pr. jobb, ikke pr. dag.** En dag med to jobber viser setningen to ganger. | `AT:537`, `:556` |
| WM77 | **Dagen har ingen markering der den begynner.** Oversiktsraden har 1 punkt grå strek og lysegrå bunn. Dagsummen har 2 punkter grå strek over seg og står sist i dagen. Linjene veksler mellom hvit og lysegrå etter løpende linjenummer i hele tabellen, uavhengig av dag og jobb. Linjene har ikke innrykk. | `TR:331–342`, `:362–363`, `:208–214`; `AT:695–723` (sender ikke `innrykk`) |
| WM78 | **Cellene kutter tekst.** Etiketten «Sum 17.11. · Ola N.» står i kolonnen Betegnelse (78 punkter som standard), og «Dagen: …» i Avvik (70). Begge tekstene er lengre enn kolonnen. Regnet fra breddene; ikke sett i nettleser. | `TR:349`; `AT:89–105`, `:377–379` |
| WM79 | **«Bare oversiktsrader» skjuler linjene.** Oversiktsradene og dagsummen står. Valget gjelder besøket og lagres ikke. En dag med én jobb er da to rader med samme tall. | `AT:152`, `:564–567`, `:644` |
| WM80 | **Maskin og vare som er koblet til timeraden, står på timeradens linje.** Tillegg og utlegg er egne linjer i jobben. Vare- og utleggslinjer har ingen egen ✓. Reise er en egen blokk først på dagen, og rader uten kort-id samles sist. | `AM:300–413`, `:432–444`; `AT:565` |
| WM81 | **Knappene står på tre nivåer.** Linja: ✓ ↩ ↺ ✂ og penn. Oversiktsraden: ✓ ↩ ↺ for prosjektseddelen. Dagsummen: «Attester» for hele dagsseddelen, ↩ og lenke til sedelen. I prosjektets attestering gjelder dagsummens knapp bare prosjektets del. | `AT:396–415`, `:426–471`, `:473–493` |
| WM82 | **Sorterer brukeren på en kolonne, vises bare linjene,** som flat liste uten oversiktsrader og dagsum. Derfor bærer hver linje dato og ansatt. | `TR:195–206` |
| WM83 | **Tabellen tegner én rad om gangen.** Kolonnene kan flyttes, skjules og endre bredde. Tabellen har en fri rad (`overskrift`) og en sumrad med celler pr. kolonne. En celle kan ikke gå over flere rader. Timerapporten bruker samme tabell. | `TR:36–65`, `:309–357`; `apps/web/src/components/timer/TimerRapportDetaljer.tsx` |
| WM84 | **Radhøydene, målt i nettleser av w5:** oversiktsrad 38, linje 37, dagsum 43. En dag med én jobb og én linje er 118 punkter høy. | w5-leveransen, `relay/inbox-orkestrator.md:33267` |

**Målt i versjon 5 — attestantens egne timer (B15), develop @ `ee7146e5`**

`SK` = `packages/db/prisma/schema.prisma`. `D` er `apps/api/src/routes/timer/dagsseddel.ts`, som ellers i planen.

| # | Funn | Referanse |
|---|---|---|
| WM85 | **Ingen egenskap ved den ansatte sier timelønn eller fastlønn.** Verken brukeren eller ansettelsen har feltet. | `SK:10–80`, `:248–292`. Søkt uten treff: timelonn, fastlonn, lonnstype, lonnsform, maanedslonn, salaryType, payType, ansettelsesform. |
| WM86 | **«Timelønn» og «Fastlønn (månedslønn)» er to lønnsarter av samme type.** Bare navnet skiller dem, og firmaet kan endre navnet. Lønnsarten har ingen kolonne for lønnsform. | `packages/db-timer/prisma/schema.prisma:22–51`; `apps/api/src/services/seed/index.ts:61–62` |
| WM87 | **Modellen peker ikke ut noens leder.** Avdelingen har ikke leder. Stillingen (ansatt, bas, prosjektleder, daglig leder) er en opplysning og gir ingen rett. | `SK:2857–2875`, `:252`. Søkt uten treff: lederId, managerId, naermesteLeder, overordnet, avdelingsleder. |
| WM88 | **Attesteringsrett har firmaadministrator i sedelens firma, og aktiv ansatt som er prosjektadministrator eller har «kan attestere» på radens prosjekt.** Fravær uten prosjekt attesteres av firmaadministrator, og av prosjektleder når firmaet har valgt det. «Firmaansvarlig» gir ingen attesteringsrett. | `D:275–302`, `:332–358`, `:502–540`; `SK:741`, `:744` |
| WM89 | **Ingen prosedyre sammenligner den som attesterer, med den som eier sedelen.** Det gjelder attestering, retur, gjenåpning, retting, deling og flytting av underprosjekt — elleve prosedyrer. Listene tar med attestantens egne sedler. | `D:6018–6188`, `:6203–6500`, `:6791`, `:6917`, `:7121`, `:7315`, `:7422`, `:7515`, `:7529`, `:7695`, `:7802`, `:8287`, `:8465` |
| WM90 | **Kolonnen `tillattSelvAttestering` finnes i firmainnstillingene, med standard «ja». Ingen kode leser eller skriver den.** Den ble lagt inn 01.05. for en plan som ikke er bygget: at en vanlig ansatt kunne attestere egen seddel i stedet for å sende den til leder. | `SK:416–417`; migreringen `20260501200000_add_timer_modul_og_settings`; `timer.md:74`, `:453` |
| WM91 | **Sedelen bærer alt et flagg for retting og en sperretekst til skjermen.** En sperret linje får ✓ slått av med forklaring og sendes ikke med «Attester utvalget». ↩ stoppes ikke av sperren. | `D:6181`, `:6371`, `:6485`; `AM:256–258`, `:586–597`; `AT:405`, `:455`, `:483` |
| WM92 | **Telefonen har attestering for firmaadministrator:** liste, attestering av rader og retur. Den har ikke retting, deling eller gjenåpning. Av firmainnstillingene lagrer den bare «rediger ved attestering» lokalt. | `apps/mobile/app/timer/attestering/index.tsx:72–79`; `apps/mobile/src/components/timer-attestering/AttesteringDetaljMobil.tsx:72–77`; `apps/mobile/src/db/schema.ts:754` |

**Målt i versjon 6 — maskintimer over arbeidstimer (§ 8.6 punkt 2), develop @ `1afb318a`**

Linjene i `D` gjelder `1afb318a` og er forskjøvet fra WM32, som ble målt på en eldre hash. `MK` =
`packages/shared/src/utils/maskinKapasitet.ts`, `KS` = `docs/claude/prosjektkort-kortid-spec.md`.

| # | Funn | Referanse |
|---|---|---|
| WM93 | **Eksempeldagen er lagt rett inn i databasen med SQL. Den er aldri ført gjennom serveren.** Lokal kopi av test-basen (nyeste seddel der er fra 11.07.2026): Ola Tømrer 14.05.2026, pause 30 min, status sendt. Timerad 07–12 med 4,50 t uten underprosjekt, timerad 12–15 med 3,00 t på TILL-001, maskinrad 07–15 med 7,50 t uten underprosjekt. Sedelen og de tre radene har håndlagde ID-er (`22222222-4f4f-2222-2222-…`) og er opprettet 17.05.2026 kl. 10:02:06, i samme sekund. Bøtta var i brudd fra første stund: 4,5 + 0,5 t pause er mindre enn 7,5. Skriptet ligger ikke i repoet. | Lesespørring mot lokal `sitedoc` 19.11. (`timer.daily_sheets`, `sheet_timer`, `sheet_machines`); søk etter ID-en i treet og med `git log --all -S` ga ingen treff |
| WM94 | **Underprosjektet END-002 er satt senere.** I kopien fra 11.07. har 07–12-raden og maskinen ikke underprosjekt; på test 19.11. står begge på END-002. Begge veiene som bytter underprosjekt, skriver uten å sjekke taket (WM97). Hvilken som ble brukt, er ikke målt: test-basen er ikke lest. | WM93; `D:6926–6942`, `D:684–726` |
| WM95 | **Regelen kom dagen før dataene ble lagt inn.** `validerMaskinUnderArbeid` ble innført 16.05.2026, pausen i taket 18.05., og den delte funksjonen 05.07. Seed-koden som lager timer og maskin (`seed-timer-demo.ts`), skriver også rett i databasen, men holder seg under taket. | `git log -S validerMaskinUnderArbeid` → `ff5c90e1`; `731770da`; `docs/claude/fase-0-beslutninger.md:2110–2115`; `packages/db/scripts/seed-timer-demo.ts:162–176` |
| WM96 | **Taket sjekkes åtte steder, alltid mot alle bøttene på sedelen.** Kommentaren sier at bare nye og endrede rader sjekkes, men koden filtrerer ikke. En seddel som alt er i brudd, får derfor avvist enhver skriving som går gjennom sjekken, også i en annen bøtte. Lest i koden, ikke kjørt. | `D:2174–2199`, kommentaren `D:2133–2138`; `MK:80–108`; kallene `D:3000`, `:3501`, `:4354`, `:4608`, `:5037`, `:9680`, `:10507`, `:10640` |
| WM97 | **Sju skriveveier endrer arbeidstimer eller underprosjekt uten å sjekke taket:** (1) ✂ på en timerad — hver del kan få eget underprosjekt, og maskinen blir stående på første del; sjekken gjelder bare ✂ på en maskinrad. (2) Den ansattes egen deling av en timerad. (3) Bytte av underprosjekt på én timerad. (4) Bytte av underprosjekt for hele jobben. (5) «Del opp» (WM98). (6) Sletting av en timerad. (7) Endring av dagens pause i sedelhodet. | (1) `D:2988–3004`, `:7874`; (2) `D:8155`; (3) `D:6926–6942`; (4) `D:684–726`; (5) `D:7052–7074`; (6) `D:4700–4746`; (7) `D:4111–4165` |
| WM98 | **«Del opp» har to egne vakter, og begge har hull.** Vakten mot en maskin som går over klokkeslettet, slipper alle maskiner uten fra–til. Vakten mot for mange maskintimer ser bare på maskiner som er koblet til en rad som deles. En maskin uten klokkeslett som er koblet til en rad før klokkeslettet, eller ikke koblet til noen rad, blir stående på del A med alle timene. Med radene 07–12 og 12–15 og en maskin på 7,5 t uten klokkeslett gir «Del opp» ved 12 nøyaktig eksempelet. | `apps/api/src/routes/timer/jobb-deling.ts:94–98`; `D:7054–7072` |
| WM99 | **Synken sjekker det telefonen sender, ikke det som blir lagret.** Timerader serveren velger å ikke skrive, blir stående som de var. Maskinradene erstattes alltid med telefonens. En telefon med en eldre versjon av dagen kan derfor skrive maskintimene tilbake etter at arbeidstimene er flyttet på serveren. | `D:9671–9690`; `D:9970` og `:10137` (leseagent, ikke stikkprøvd) |
| WM100 | **Synken kan ikke skille en gammel app fra en ny, og den avviser hele sedelen.** Telefonen sender ingen versjon. Koden sier selv at en eldre app aldri skal avvises strengere enn før. En avvist seddel lagres ikke; telefonen viser et rødt felt «Avvist» med serverens tekst, som ikke er oversatt, til brukeren retter og lagrer på nytt. | `D:9683–9694`; `apps/mobile/src/lib/trpc.ts:18–21`; `apps/mobile/src/services/timerSync.ts:714–727`; `packages/shared/src/i18n/nb.json:687–689` |
| WM101 | **Taket ser ikke på hva slags maskin det er.** Døgn-maskiner telles med som alle andre. En Heatwork kan i dag ikke ha flere timer enn arbeidstimene pluss pausen i bøtta. Det er vedtatt slik: taket «gjelder fortsatt alle maskiner, også døgn-maskiner». | `MK:80–108`; `D:2174–2199`; `KS:1580`, `:1706` |
| WM102 | **Maskinen som går uten fører, kjennes igjen på ett felt: enheten maskinen selges i** (`Equipment.utleieEnhet`: «døgn», «time» eller ikke satt). Det er vedtatt som det styrende skillet (18.05. og 01.09.): døgn går uten fører; time og ikke satt krever fører og timerad (H15, 16.11.). Et eget merke for «krever fører» er uttrykkelig avvist. Heatwork-maskinene i seeden er småutstyr merket «Utleieobjekt» med enheten døgn. I den lokale kopien står alle fem Heatwork slik, og gravemaskinen uten enhet. | `packages/db-maskin/prisma/schema.prisma:96–100`; `packages/shared/src/utils/maskinKobling.ts:19–21`; `docs/claude/maskin.md:263–276`; `docs/claude/fase-0-beslutninger.md:2124–2133`; `KS:2085`; `packages/db-maskin/prisma/seed-amarkussen-heatwork.ts:34–72` |
| WM103 | **Enheten kan bare settes når maskinen er merket «Utleieobjekt».** Ny maskin opprettes uten enhet. Utleie pr. time kan ikke skilles fra en egen gravemaskin som selges pr. time: begge har enheten time og krever fører. «Materiell» finnes ikke som eget begrep; utleid materiell må ligge i maskinregisteret for å kjennes igjen. | `apps/web/src/app/dashbord/maskin/[id]/page.tsx:1715–1755`; `apps/api/src/routes/maskin/equipment.ts:250–284`, `:330–333`; `KS:1278` |
| WM104 | **En maskinrad føres alltid i timer.** Enhet og mengde på raden gjelder produsert mengde (m3, stk), ikke leietid. En døgn-maskin føres som timer. | `packages/db-timer/prisma/schema.prisma:577–630` |
| WM105 | **Ingen flate regner pr. jobb.** PC-en har ingen regel pr. rad eller pr. jobb, verken på dagssiden eller i attesteringen: maskinvinduet sperrer pr. bøtte med pausen, og feltet for maskintimer i den åpne registreringen er et fritt tall som bare serverens bøtteregel stopper. Attestanten kan derfor sette maskintimene over jobbens timer, eller kutte arbeidstimene under maskinens, så lenge bøtta har plass. Telefonen sperrer pr. rad (hver maskin høyst radens timer) og i Bekreft dag pr. kort (hver maskin høyst kortets arbeidstimer), begge uten pausen, og i tillegg pr. bøtte med pausen. To ulike maskiner kan hver ha hele kortets timer; bare bøttesummen stopper det. | `WS:5071–5102` (leseagent); `apps/web/src/components/attestering/RegistreringPanel.tsx:102–121`, `:239`; `apps/web/src/components/attestering/RedigerRadModal.tsx:640–661`; `M/services/kobledeMaskiner.ts:56–58`; `BD:1645`; `M/utils/tilleggPaaKort.ts:56–58` |
| WM106 | **Attesteringen har ikke noe avviksmerke for maskin over arbeid, og attestering stoppes ikke av et brudd.** Avvikene som finnes: sperre (normtak og overlapp), ukeavvik, maskin uten timerad, manglende maskinførerbevis, tilleggskrav og normmerket. Jobbraden og dagsraden viser de to summene uten å sammenlikne dem. | `apps/web/src/components/attestering/attestering-tabell.ts:289–363`; `AT:644–724` (leseagent) |
| WM107 | **En jobb ligger alltid i én bøtte; en bøtte kan ha flere jobber.** Kort-id-en utledes av prosjekt, byggeplass og underprosjekt. Eldre rader uten kort-id er ingen jobb: i attesteringen samles de i ett samlekort pr. seddel, og flytting og «Del opp» avvises for dem. | `apps/api/src/services/timer/kortId.ts:1–15`, `:233–254`; `packages/shared/src/utils/kortGruppering.ts:124–142`; `attestering-tabell.ts:438–444` |
| WM108 | **Bekreft dag varsler ikke når arbeidstiden kuttes etter at maskinen er lagt inn.** Bruddet stopper først ved Bekreft, med «For mange maskintimer». | `M/utils/bekreftDag.ts:233–262`; `BD:1064–1068` (leseagent, ikke stikkprøvd) |
