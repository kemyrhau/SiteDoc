> Del av [Timeføring på web — plan med bilder](../web-timeforing-plan.md): § 5–7. Seksjonsnumrene er de samme som før delingen.

## 5. Maskintimer er en del av arbeidstiden — hva som må endres (føring 4)

| Del | I dag | Endring | Fjerner noe? |
|---|---|---|---|
| **Maskinens fra–til** | Felt i PC-ens maskinvindu (WM7). PC-ens timerad-vindu gir maskinen radens fra–til (`WS:3350–3368`). Telefonens dagskort-modus har feltene (WM16). Telefonen ellers lagrer uten, eller med radens tid. | ⚠️ **Utgått** (B38 A, § 8.14; § 8.22 punkt 1): maskin føres bare med antall timer, uten firmainnstilling. Fra–til er tatt ut av maskinføringen på PC i prosjektkort-modus (w3b). Sto slik: **Firmaet velger** (B5, bilde 9). «Nei»: maskin lagres uten fra–til, og feltene vises ingen steder. «Ja»: feltene står på maskinlinja i jobben, i maskinvinduet og på telefonen i begge moduser, og timene regnes av dem. Ny kolonne i firmainnstillingene (WM67). | ⚠️ **Ja, for firma med «Nei»:** feltene «Fra kl.» og «Til kl.» forsvinner der de finnes i dag. Lagrede verdier røres ikke. Hvem som får «Nei» ved innføringen, er B12. |
| **Maskin-taket** (`maskinKapasitet.ts`) | Serveren: pr. bøtte, med pausen lagt til (WM32, WM35). | ⚠️ **Utgått:** serveren har regelen pr. jobb, uten pausen, og døgn-maskiner er unntatt (w9, § 4.4; merget `044fac2f`). Sto slik: **Serveren endres ikke** — vedtatt 2026-11-16 (B4), og en eldre app skal ikke avvises strengere enn før. I skjermen: hver maskin høyst jobbens arbeidstimer, uten pausen. | Nei. Skjermen blir strengere enn serveren for timeleide maskiner; døgn-maskiner følger serverens tak som i dag. ✅ **Erstattet 2026-11-19, bygget i w9:** serveren får samme regel som skjermen, og døgn-maskiner tas ut av taket (§ 4.4, w9). |
| **«Arbeid i gruppen … ledig: 8 t»** | Infolinje i PC-ens maskinvindu og timerad-vindu (WM9; `WS:3725–3730`). | Erstattes av «høyst 8,0» ved timer-feltet. | ⚠️ **Ja:** infolinja, i føringen på jobben. |
| **Koblingen til timerad (R24)** | Brukeren velger «Timerad» i PC-ens maskinvindu (WM8) og i telefonens dagskort-modus. | Regelen står. Brukeren velger ikke rad: maskinen føres på jobben, og systemet kobler den til jobbens timerader. | ⚠️ **Ja:** feltet «Timerad» i føringen på jobben. Det består i maskinvinduet for en maskin uten jobb (døgn-maskin). |
| **Fordelingen på timerader** | Finnes på telefonen, i Bekreft dag (WM33). Web har den ikke; web gir maskinen radens timer (WM34). | Web bruker **samme fordeling**. Regelen flyttes fra `M/utils/tilleggPaaKort.ts` til `packages/shared`, og begge bruker den. Ingen ny kopi. | Nei. |
| **Maskin med egne timer** | På PC får en maskin ført i timerad-vinduet alltid radens timer (WM34). | Brukeren skriver timene pr. maskin (bilde 3). | Nei. |

- ⚠️ **Versjon 12 (§ 4.13):** maskinens mengde og enhet er ikke nevnt i tabellen over. Kenneth 20.11.: maskinen
  føres bare i timer, og mengde hører til varer i jobben (A4; B37 gjelder prosjekter uten varelager). Firmavalget for fra–til er utgått (B38 A, § 8.14). «Timerad» trengs ikke fra en jobb: serveren kobler selv (A11).
- **Det som ikke endres:** R24, G5, taket på serveren, `syncBatch`, og alt som er lagret. ⚠️ Taket på serveren og
  `syncBatch` er endret i w9 (§ 4.4, B22 A; merget).
- **Jobb med både ordinær tid og overtid:** systemet fordeler maskintimene på linjene selv, som telefonen gjør. I
  attesteringen står maskinen da på begge linjene, med timene delt. Brukeren har ikke sagt når maskinen gikk.
- **Målt i versjon 6 (WM105):** PC-ens retting i attesteringen (`rettRadFelt`) kan gi en maskin flere timer enn raden
  og jobben den står på. Bare bøtteregelen på serveren stopper den. ⚠️ Rettet i w9: serveren regner pr. jobb (§ 4.4).

## 6. Funnene fra skjermbildene

| | Funn | Målt | Forslag |
|---|---|---|---|
| **(a)** | Maskinens fra–til trengs ikke (Kenneth). | WM7, WM10, WM16. K19 (2026-11-06) sa det samme for Bekreft dag: «antall, ikke fra/til». | § 5. ⚠️ Fra–til er ute, og firmavalget (B5) er utgått (§ 8.22 punkt 1). |
| **(b)** | Ny dagsseddel foreslår 07:00–15:00 og pause 30. | Firmaets arbeidstid, med 07:00–15:00–30 som standard i databasen (WM2). Lønnsarten bærer ingen tid (WM3). | Alt 1 gir tiden fra innsjekken. Ellers firmaets arbeidstid (B4, vedtatt). Fører arbeideren til 15:30, er 0,5 t overtid mot normen for datoen (WM62). |
| **(c)** | «Arbeid i gruppen: 7,5 t · ledig: 8 t». | Ledig = arbeid + pause − ført maskin (WM9). | § 5: grensen er jobbens timer, og infolinja går ut. |
| **(d)** | «Timerad (Valgfritt)» mot R24. | «Valgfritt» står bare til utstyr er valgt; da håndheves R24 (WM8). | På jobben finnes ikke feltet. I maskinvinduet som består, vises ingen merkelapp før utstyr er valgt. |
| **(e)** | Maskinlinjer står alene og er svært høye. | De står alene fordi de ble ført på PC før koblingen fantes (WM19, WM20). De er høye fordi Avvik-teksten brytes over fem–seks linjer (WM21, ikke målt i nettleser). | Gamle rader kobles ikke automatisk (H13). Korte merker på én linje i Avvik, med forklaringen på hover (B7, vedtatt). Teksten rettes til «Maskin uten timerad» (WM22). |
| **(f)** | To skjermer før første rad. | WM1, WM4. | «+ Registrer timer» med ett trykk (B1, vedtatt). |
| **(g)** | *Ikke i ordren:* varen kobles ikke til raden på web. | WM11. | Bilde 4. Reparasjon mot R3. |
| **(h)** | *Ikke i ordren:* første rad får «Ingen byggeplass» selv om toppen viser NRK. | WM4. Synlig på Kenneths bilde 86. | Byggeplassen følger med når dagen opprettes. |
| **(i)** | *Ikke i ordren:* web sender ikke `kortId` for tillegg og utlegg. | WM29. Serveren finner kortet selv; med to jobber på samme prosjekt kan den velge feil. | Tillegg og utlegg ført på jobben sender jobbens `kortId`. |
| **(j)** | *Ikke i ordren:* «Flytt underprosjekt» har ingen knapp. | WM52. Prosedyren finnes, ingen skjerm kaller den. | Bilde 7. |
| **(k)** | *Ikke i ordren, mulig feil:* ved overtidsdeling på web får en ny maskin hele radens timer på normal-delen. | WM40. Lest i koden, ikke kjørt. | Faller bort når maskinen føres på jobben og fordeles av den delte regelen (§ 5). Bør likevel måles av en koder. |
| **(l)** | *Ikke i ordren, mulig feil:* vinduet bak pennen i attesteringen sender tom byggeplass for alle rader. | WM55. Lest i koden, ikke kjørt. | Måles av en koder. Er det riktig lest, mister rettede rader byggeplassen. |
| **(m)** | *Ikke i ordren:* web kan ikke lage to kort på samme prosjekt. | WM47. Vedtatt i kort-id-specen § 5.4, ikke bygget. | Bilde 5: «+ Registrer timer» sender ny `kortId` (WM59). |
| **(n)** | *Ikke i ordren:* halvdag og helligdag endrer ikke dagsnormen. | WM65. Normleseren slår bare opp sommertid-radene. | Ikke med i planen. En halvdag med full dag ført gir ingen overtid før normen for en hel dag er nådd. Meldt, ikke foreslått endret. |
| **(o)** | *Ikke i ordren:* et lagret kolonneoppsett kan ikke tilbakestilles. | WM69. | «Tilbakestill til standard» i «Velg parameter» (bilde 6). Uten det ser en attestant med lagret oppsett aldri kjernen. |
| **(p)** | *Ikke i ordren:* året i attesteringen kan bare byttes ved å bla uke for uke. | WM72. | Årsvelger ved ukevalget (bilde 6). |

## 7. Funksjonsinventar

Ingen funksjon fjernes uten svar fra Kenneth. Det som går ut, er merket ⚠️. **Planen gjelder firma i
prosjektkort-modus.** Firmavalget dagskort-modus røres ikke (Kenneth 2026-11-07: endringer i prosjektkortet skal
aldri påvirke dagskortet — her firmamodusen, ikke dagskortet i § 0). ⚠️ Unntaket som sto her, firmavalget «maskin
føres med fra–til» (B5), er utgått (§ 8.22 punkt 1).

| Funksjon | Kode | Forslag |
|---|---|---|
| Skjemaet «Ny dagsseddel» (annen dato, annet prosjekt, kommentar, arbeidstid) | `NY` | ⚠️ **UT av prosjektkort-modus** (B1). Dato, prosjekt og aktivitet står i jobbens hode, arbeidstiden er jobbens fra–til, og kommentaren rettes på dagssiden (WM61). **BEVARES** i dagskort-modus. |
| Knappen «Ny dagsseddel» på Mine timer | `apps/web/src/app/dashbord/timer/mine/page.tsx:311–319` | **ENDRES** i prosjektkort-modus: «+ Registrer timer» (bilde 1). Uendret i dagskort-modus. |
| Serveren lager første timerad | `D:3859–3869` | **BEVARES.** Får byggeplassen med (h). |
| Vinduet «Legg til timer-rad»: lønnsart, aktivitet, underprosjekt, byggeplass, overtidsforslag, «Maskin (valgfritt)» | `WS:2692–3769` | **ENDRES:** feltene står på jobben (bilde 2). Aktivitet, underprosjekt og byggeplass står i jobbens hode, bak «Endre». Vinduet består i dagskort-modus. |
| Maskinvinduet «Legg til maskinbruk» | `WS:4798–5308` | **BEVARES** for en maskin uten jobb (døgn-maskin) og i dagskort-modus. ⚠️ I føringen på jobben går Timerad og infolinja ut (§ 5). ⚠️ Fra kl. og Til kl. er tatt ut i prosjektkort-modus (w3b), og firmavalget (B5) er utgått (§ 8.22 punkt 1). |
| Maskin-taket pr. bøtte på serveren | `packages/shared/src/utils/maskinKapasitet.ts` | ⚠️ **ERSTATTET** av regelen pr. jobb i w9 (§ 4.4). Sto slik: BEVARES uendret. |
| Sperren R24 | `WS:5036–5043`; `D:2195–2201` | **BEVARES.** |
| Vinduet for vareforbruk, vare uten rad | `apps/web/src/components/timer/KortVareforbrukModal.tsx` | **BEVARES** for vare uten jobb. Vare ført på jobben kobles (bilde 4). |
| Velgeren og vinduene for tillegg og utlegg, kvittering | `WS:4300`, `:3842`, `:4503` | **ENDRES:** tillegg og utlegg føres på jobben (bilde 5), med jobbens `kortId`. Alle feltene består. Vinduene består i dagskort-modus. |
| «Hva gjorde du?» valgfritt på web | `WS:3638` | **ENDRES** (B6): påkrevd pr. jobb før «Send dagen», som på telefonen. |
| Maskiner etter timeradene og varer i egen liste i kortet | `WS:2173–2194`, `:1699–1715` | **ENDRES:** jobben vises samlet (bilde 5). |
| «+ Reise», del opp, slett, dagens ramme, «Send dagen» | `WS` | **BEVARES** uendret. ⚠️ Versjon 12 (A8, § 4.13): «+ Reise» flyttes til jobben, og reisen vises i jobbens kort. Vinduet og feltene består. |
| Mengde og enhet på maskin i føringen | `WS:3810–3843`, `:5343–5370` | ⚠️ **UT av føringen på PC i prosjektkort-modus** (Kenneth 2026-11-20, presisering 2 i § 8.13; A4). Mengden føres som vare på jobben. Lagrede verdier og kolonnene i attestering, rapport og eksport består. **BEVARES** i dagskort-modus. |
| Bøtteboksen i kortet: hodet «Arbeidstimer (N t)», «+ Legg til timer-rad» pr. boks og «Maskin X t» | `WS:2233–2253`, `:2315–2321` | ⚠️ **UT i prosjektkort-modus** (A11, § 4.13): jobben har én rekke lenker, og tallene står i kortets hode. **BEVARES** i dagskort-modus. |
| Varen i kortet uten retting og sletting | `WS:1788–1804` | **ENDRES** (A10): varen står i jobben med penn og søppelbøtte. |
| «+ Nytt prosjektkort» | `WS:680–682`, `:992`; `packages/shared/src/i18n/nb.json:406` | **ENDRES** (B1): heter «+ Registrer timer», og tilbyr også prosjekter som alt har kort (§ 5.4, WM47). |
| Overtidsforslaget med knappen «Del raden» i timerad-vinduet (V21) | `WS:3538–3540`, `:3178–3250` | **ENDRES** (B8): overtid står som egen linje i jobben. Regnestykket er det samme (`overtidForslag.ts`), mot normen for datoen. Vinduet består i dagskort-modus. |
| Underprosjekt i nedtrekksliste i hvert vindu | `WS:3570–3590`, `:5238–5252` | **ENDRES:** ett valg i jobbens hode, som gjelder alt i jobben (bilde 2). Knapper til og med 6, søkbar nedtrekk over det (B11). |
| Attesteringens 26 standardkolonner, «Velg parameter», sortering, filter, bredde, flytting | `packages/shared/src/utils/timerDetaljRader.ts:736–742` | **ENDRES** (B9): standardutvalget blir de 11 kjernekolonnene. Alle kolonnene finnes fortsatt og kan slås på. Lagrede oppsett pr. bruker røres ikke (WM69). Nytt: «Tilbakestill til standard». ⚠️ **Snudd 2026-11-19 (B26 A):** lagrede oppsett for attesteringslista settes til kjernen én gang. |
| Datoen `åååå-mm-dd` i attesteringen | `apps/web/src/components/attestering/attestering-tabell.ts:169–172` | **ENDRES** (tillegget): vises som dd.mm. Sortering og filter bruker fortsatt hele datoen. |
| Ukevalget i firmaets attestering | `apps/web/src/app/dashbord/firma/timer/attestering/page.tsx:345–369` | **BEVARES.** Nytt: årsvelger ved siden av. |
| Avvik-setningene i tabellen | `packages/shared/src/i18n/nb.json:5064`, `:4607` | **ENDRES** (B7): korte merker i cellen. Setningene består som forklaring på hover. |
| Retting i cellen, «var …», ✓, ↩, ✂, penn, gjenåpne | `apps/web/src/components/attestering/AttesteringTabell.tsx` | **BEVARES.** Nytt: klikk på linja åpner registreringen (bilde 7). Kravet om firmaadministrator blir attesteringsrett (B10). ⚠️ **Snudd 2026-11-19 (§ 8.8):** retting i cellen går ut (B25 A). ✓, ↩ og gjenåpne står bare på jobbraden og dagsraden (B24 B). ✂ og penn flyttes inn i kortet (B27 A). |
| Detaljsiden for én dag, «Rediger hele sedelen» | `apps/web/src/components/timer/AttesteringDetalj.tsx` | **BEVARES** under Firma. ⚠️ Prosjektets adresse til den sender videre dit (B29 B, § 4.10). |
| «Attestering» under Prosjekt: siden for ett prosjekt, menypunktet og søketreffet | `apps/web/src/app/dashbord/[prosjektId]/timer/attestering/`; `SE:180–187` | ⚠️ **UT** (B29 B, Kenneth 2026-11-20). Prosjektlederen attesterer på Firma › Attestering (§ 4.6). Gamle adresser sender videre. Dødkode-lista står i § 4.10. |
| Avkrysning pr. linje og «Attester utvalget» | `AT:212–217`, `:866–875` | ⚠️ **ENDRES** (B30 A): avkrysningen står på jobbraden, reiseraden og dagsraden, og knappen tar hele jobber. En enkelt linje kan ikke lenger attesteres den veien. |
| Kvitteringsikonet på utleggslinja | `AT:516`, `:1018–1045` | **BEVARES** (B31 B). Nytt: kvitteringen vises også i kortet. |
| «Hva gjorde du?» i kortet, med aktiviteten som erstatning når teksten mangler | `RP:109`, `:250–252` | ⚠️ **ENDRES** (Kenneth 2026-11-20, § 4.9): aktiviteten står ikke lenger i beskrivelsens plass. Den flyttes til kortets hode. Mangler teksten, står «Ikke utfylt». Dagens «Kommentar» vises under. |
| Reiseblokken i attesteringen: én pr. dag | `AM:489–494` | ⚠️ **UTGÅTT** (B32 B): reisen står i kortet sitt (w12, § 4.11; w15c, § 4.15 del E). Sto slik: ENDRES (§ 4.7, venter på B32): én blå rad «Reise» for hvert prosjekt, med prosjektnummeret. |
| «Flytt underprosjekt» på serveren | `D:6627` | **BEVARES.** ⚠️ Må utvides: i dag flytter den bare timer- og tilleggsrader (WM52). Underprosjekt for hele jobben flytter også maskin, vare og utlegg. |
| «Del opp» pr. rad i attesteringen | `apps/web/src/components/timer/SplittRadModal.tsx` | **BEVARES.** Nytt ved siden av: «Del opp» ved klokkeslett for hele jobben (bilde 8). ⚠️ 2026-11-19: ✂ som åpner vinduet, står i kortet (§ 4.5 punkt 4). |
| Dagskort-modus på web og telefon | `WS`; `M/components/timer-detalj/MaskinSeksjon.tsx` | **BEVARES.** ⚠️ Firmavalget for fra–til (B5) er utgått (§ 8.22 punkt 1). Planen rører ikke skjermene i firmavalget dagskort-modus. |
| Telefonens Bekreft dag og prosjektkort | `BD` | **BEVARES** uendret. Fordelingen flyttes til delt kode uten endret oppførsel (§ 5). |
| Oversiktsraden pr. jobb med ✓ ↩ ↺ | `AT:538–563`, `:396–415` | **ENDRES** (B14, alternativ A): blir jobbrad og vises når dagen har flere jobber. ⚠️ Med én jobb vises den ikke; dagsraden bærer pr.nr., underprosjekt og ↺, og dagens «Attester» og ↩ dekker de samme linjene. |
| Dagsummen nederst på dagen | `AT:571–588` | **ENDRES** (B14 A): flyttes øverst som dagsrad. Samme sum og samme knapper. |
| «Dagen: X t av dagsnorm Y t» i hver oversiktsrad | `AT:537`, `:556` | **ENDRES** ⚠️ (B14 A): én gang pr. dag, som merke når dagen avviker fra normen. Setningen vises på hover. |
| Dato, ansatt, pr.nr. og underprosjekt på hver linje | `AM:272–284` | **ENDRES** (B14 A): skrives ikke når de er like raden over. Uendret ved sortering, i filter og i eksport. |
| Vekslende grå linjer | `TR:362–363` | **ENDRES** i attesteringen (B14 A): ingen veksling inne i en dag. **BEVARES** i timerapporten. |
| «Bare oversiktsrader» | `AT:152`, `:564`, `:644` | **BEVARES.** Viser dagsraden og jobbradene. |
| «Etter prosjekt» uten dagsum, «Etter ansatt» | `AT:517–531`, `:569–570` | **BEVARES.** |
| Attestant attesterer og retter egne timer | `D` (WM89) | **ENDRES** når firmaet velger det (B15): sperres for attestant med timelønn. Standard er som i dag. |
| Innstillingen `tillattSelvAttestering` (ubrukt) | `SK:417` | **TAS I BRUK** for B15. ⚠️ Planen fra 01.05. om at en vanlig ansatt attesterer egen seddel (`timer.md:453`) er ikke bygget, og bygges ikke med dette. |
