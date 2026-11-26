# Måling M1 — timeradens livsløp (web + server + telefonsynk)

> Ordre: «2026-11-26 ORDRE M1 TIMERAD-LIVSLØP — MÅLING, INGEN RETTING» (web-timer-w1).
> Målt på `origin/develop` @ `f7a277d3`. Ingen produktkode er endret.
> Sandkasse: lokal Postgres `sitedoc_o25` med alle develop-migreringer pluss O27-tabellen `timer.slettet_fra_pc`. Den er additiv og leses ikke av koden på `f7a277d3`.

**FASIT — Kenneth 2026-11-26, ordrett:**
- «jeg fortsetter å registre timer -> men nå er det ingen sjekk mot dagskortet for hva som er lagret fra før. Jeg går i sirkel. jeg kommer ikke videre fordi ting blir "borte" og vi starter på nytt å lappe feil»
- «overtid regnes ikke ut -> jeg tror også et det "gamle " kortet er et slettet kort»

**TILLEGG 1 (samme dag), FASIT ordrett:**
- «jo mer vi koder jo flere ting som fungerete tidligere dukker opp. sletting av timerader fungerer ikke rett. autoppretting av automatiske forslag fungerer ikke. jeg kan ikke avbryte noe jeg ser starter feil»
- «jag kan slette rader. jeg kan slette dagen. hva skjer om jeg oppretter et kort. og ønsker å gå ut av kortet fordi jeg prøver å registrere reise -> reisefunksjonen som var ganske bra tidligere. fungerer ikke lenger som forventet. nå oppstår nye feil.»
- Radene merket **T1–T3** i tabellen svarer på tillegget. Kolonnen «Endret siden `36c64c82`» er regresjonsmålingen (prod før O21).

## Testene

| Fil | Kjøres med | I dag |
|-----|-----------|-------|
| `apps/api/src/routes/timer/m1-timerad-livslop.integration.test.ts` | `cd apps/api && DATABASE_URL=…/sitedoc_o25 npx vitest run --config vitest.integration.config.ts src/routes/timer/m1-timerad-livslop.integration.test.ts` | **5 røde, 13 grønne** |
| `apps/web/src/app/dashbord/timer/[id]/m1-timerad-livslop.test.tsx` | `cd apps/web && npx vitest run "src/app/dashbord/timer/[id]/m1-timerad-livslop.test.tsx"` | **2 røde, 1 grønn** |

- Røde tester starter med «RØD i dag:». De beskriver det Kenneth forventer og skal ikke rettes i M1.
- Web-fila ligger under `vitest.config.ts`. Den blir derfor rød i `pnpm test` fra rot til rotårsak R1 og R2 er rettet. **Orkestrator avgjør** om den skal merges før rettingen, eller bæres av rette-branchen.
- Integrasjonsfila kjøres ikke av `pnpm test`.

## Tabell

Forkortelser:
- **D** = `apps/api/src/routes/timer/dagsseddel.ts`
- **JS** = `apps/web/src/app/dashbord/timer/[id]/JobbSkjema.tsx`
- **P** = `apps/web/src/app/dashbord/timer/[id]/page.tsx`
- **API-test** = M1-integrasjonsfila, **web-test** = M1-web-fila
- **«kode»** = målt ved å lese koden, ikke kjørt

Felles for hele web:
- Ingen vei har optimistisk UI. Søk etter `onMutate`, `setData(` og `cancel(` gir 0 treff.
- Dagskortets hode («—» ved 0), dagssum og «Send dagen (X t)» regnes på hver render fra `hentMedId` (P:2470, P:2913–2917).
- Alt på skjermen er altså riktig **når og bare når `hentMedId` hentes på nytt**.

| Vei | Handling | fil:linje | Lagres | Vises uten F5 | Kan bli borte | Kan komme tilbake | Stille utfall | Test (i dag) | Endret siden `36c64c82` |
|-----|----------|-----------|--------|---------------|---------------|-------------------|---------------|--------------|------|
| Ny jobb i kortet (JobbSkjema) | Fyll Til → blur → `tilfoyTimerRad`, så `lagreJobbTid` | JS:331–369 | Ja, i to kall. Ikke atomisk. | **Nei, når kall 2 feiler.** `ferdig` invaliderer bare ved suksess (JS:316–327). Kortet viser «—» og gammel sum, akkurat Kenneths bilde. | **Ja, visuelt.** Bytter man kort, fjernes utkastet (P:1343). Skjemaet avmonteres og «ulagret» slippes (JS:314). Raden står på serveren, men vises ikke før neste henting. | — | Ja. Raden står på serveren selv om skjemaet sier «Ikke lagret». | web-test «kall 1 lagrer raden, kall 2 feiler» **RØD**. Kontroll med begge kall OK: grønn. | Nei |
| Endre tid i lagret jobb | Fra/Til/pause → blur → `lagreJobbTid` | JS:330, 373–385 | Ja | Ja, ved suksess | **Ja.** Ny verdi skrevet mens forrige lagring pågår, sendes aldri (JS:330). Etterpå viser skjemaet «✓ Lagret». | — | **Ja.** Endringen droppes. «Send dagen» er ikke sperret. | web-test «ny Til skrevet mens forrige lagring pågår» **RØD** | Nei |
| «Hva gjorde du?» | blur → `oppdaterTimerRad` pr. linje | JS:395–409 | Ja | Ja | **Ja.** Samme sperre ved pågående lagring (JS:395). Endret tekst teller heller ikke som ulagret (JS:304–308). | — | Ja | kode | Nei |
| Ulagret ved navigering | lukke fane, F5, bytte kort | JS:307–314, P:452–461 | Bare det som er blurret | — | **Ja.** Gyldig tid som er skrevet men ikke blurret, teller ikke som ulagret, og nettleservakten slår ikke inn. | — | Ja | kode | Nei |
| Legg til timer-rad (vindu) | `tilfoyTimerRad`. Overtidsdeling i klienten (`foreslaOvertidSplitt`) | P:4986, P:5070–5127 | Ja | Ja. Invaliderer også i `catch`. | Nei | — | **Ja: overtid.** Se R3. | API-test «"Legg til" 15–18 lagres som Timelønn» **RØD** | Nei |
| Lagre jobb (overtid) | `lagreJobbTid` → `regnJobbTidPaaSedel` → `regnJobbTid` | D:6131, `packages/shared/src/utils/jobbTid.ts:125` | Ja | Ja | Nei | — | **Ja.** `overtidsnivaa: null`, ingen grunn i svaret. | API-test «"Lagre jobb" … uten grunn» **RØD**. Kontroll med `overtidsnivaa = 50`: grønn. | Nei |
| Overlappsjekk | `tilfoyTimerRad` / `lagreJobbTid` | D:2922, D:6124 | — | — | — | — | Nei. Serveren avviser med melding. | grønn (målt indirekte: overlappsmeldingen kom i testen) | Nei |
| Server etter lagring | `hentMedId`, `hentDagstotal` | D:4670, D:12955 | — | **Serveren har 10,5 t straks** | — | — | — | API-test «hentMedId og hentDagstotal …» grønn | Nei |
| «Slett dagsseddel» | `slett` (utkast) | D:7673, D:4320–4328. Klient P:548–551, Mine timer | Avvist på sendt/returnert | Feil vises i vinduet (`onError` + SDM) | Nei | — | Nei | API-test returnert + sendt: grønn | Nei |
| «Slett jobben» | `slettKort` | D:7698, D:4437, D:4475 | Utkast og returnert. Avvist på sendt. | Ja. Invaliderer `hentMedId` og varer. | Nei | — | Nei. Feil vises i `SlettDagModal`. Sedelen står igjen tom (0 rader). | API-test utkast + sendt: grønn | Nei |
| ✕ på timer-/reiselinje | `fjernTimerRad` | D:5920. Klient P:3770–3799 | Avvist på sendt | Ja | Nei | Se synk-raden under | Nei. `alert(e.message)`. | API-test sendt: grønn | Nei |
| ✕ på tillegg/maskin/utlegg | `fjernTilleggRad`, `maskin.fjern`, `fjernUtleggRad` | D:7105. Klient P:3990, 4119, 6337 | Ja | Ja | Nei | **Ja, via telefonsynk** (R4) | Nei på web | se synk | Nei |
| Telefonsynk: tillegg slettet på PC | `syncBatch` med sedel pending | D:12193–12250 | — | — | — | **Ja.** Kommer tilbake, svaret er «ok». | Ja | API-test «tillegg slettet på PC kommer tilbake» **RØD** | Nei |
| Telefonsynk: tillegg rettet på PC | `syncBatch` | D:12193–12250 | — | — | **Ja.** PC-verdien overskrives (3 → 1). | — | **Ja.** Svaret er «ok». | API-test «tillegg rettet på PC … overskrives» **RØD** | Nei |
| Telefonsynk: timerrad rettet på PC | `syncBatch`, V19.9-versjon | D:11975–12016 | — | — | Nei. PC-versjonen står. | — | Nei | API-test «timerrad endret på PC …» grønn | Nei |
| Telefonsynk: sedel/timerrad slettet på PC | `syncBatch` + `finnSedlerÅSlette` | — | — | — | — | Ja (sedel pending) | — | O26 (`o26-gjenoppstandelse.integration.test.ts`, grønn = måler JA). O27 (`fix/slettet-er-slettet`) er til gate og ikke målt her. | Nei |
| `synced_at` på web-sedel | `opprett` + `tilfoyTimerRad` | `syncedAt` settes bare i `syncBatch` (D:12143, D:12167) | — | — | — | — | — | API-test «opprett + tilfoyTimerRad på web setter aldri synced_at» grønn | Nei |
| Timerlista / Mine timer | `list` | PT:81, MT:182 | — | Ja. Henter på nytt ved montering og fokus (`new QueryClient()` uten valg, `providers.tsx:40`). | — | — | — | kode | Nei |
| Send dagen | `send` | P:2492, P:2831 | — | — | — | — | **Ja.** Sperren bygger på `ulagredeKort`, som ikke ser R1/R2. | kode | Nei |
| Attestering (attester/returner/del opp/angre/flytt/rett/splitt) | se `AttesteringTabell`, `RegistreringPanel` | — | — | Invaliderer `hentForAttestering`/`hentTilAttesteringFirma`, ikke arbeiderens `hentMedId`/`list` (de hentes ved fokus) | ikke målt | ikke målt | Feil vises inline | **ikke målt i M1** | Nei |
| Forsoning | `forsonDagskort` | D:6355, P:590–593 | — | Ja | ikke målt | ikke målt | Feil i `setFeil` | **ikke målt i M1** | Nei |
| Prosjektbytte / flytt jobb | `flyttJobb`, `flyttJobbEco` | D:6205, D:6269, JS:425, 448 | — | Ja, ved suksess | ikke målt | ikke målt | — | O20-testene (4 av 7 i `flytt-jobb-prosjekt.integration.test.ts` er røde på develop: utdatert test, mangler O20s reisevalg) | Nei |
| **T1** «+ Registrer timer» (prosjektkort) | ett trykk → `opprett` med prosjekt, før noe er skrevet | `RegistrerTimerKnapp.tsx:147–171`, D:4887–4898 → D:3291–3364 | **Ja, straks:** sedel + rad etter normen (07:00–15:00, 30 min pause, standard-art, 7,5 t) | Ja (gule felt «Fra firmaets arbeidstid», P:1049–1053) | — | **Ja.** «Slett» dagen og så Registrer igjen samme dag gir ny 07–15 (API-test grønn = måler JA). | **Ja.** Ingen auto-rad uten melding når firmaet mangler standard-art, mangler vindu, eller vinduet gir 0 t (D:3306/3320/3338). | API-test «ett trykk lager sedel + lagret timerad 07:00–15:00» grønn (målt) | Nei. Uendret (fila og `opprettForsteTimerRadForslag` lå i `36c64c82`). O25 gjorde bare raden til arbeid, aldri reise (D:3342). |
| **T1** Avbryte et startet kort | lukke kort, klikk annet korthode, nettleser tilbake, Esc | P:1340–1344, P:452–461, JS:305–308 | Auto-raden fra Registrer **står**. Utkast (lokalt) forkastes. | — | Utkast: ja, stille (P:1343). | — | **Ja.** Det finnes **ingen avbryt-vei** for auto-raden utenom «Slett jobben» eller «Slett» dagen. Esc gjør ingenting på kort. Et tomt prosjektkort har ingen slett-knapp (P:2681–2705). | API-test «å gå ut uten å skrive noe etterlater en lagret 7,5 t-rad» **RØD** | Nei. Lå i `36c64c82`. |
| **T1** «Slett jobben» → Registrer igjen | `slettKort`, så `opprett` | D:7698, D:4911–4920 | Sedelen står tom. Ny Registrer gir `eksisterte: true`, ingen auto-rad. | O26: utkastet nullstilles (P:560), prosjektet tas ut av de tomme kortene (P:612–640). | — | — | Nei | API-test «"Slett jobben" og så "+ Registrer timer"» grønn | **Endret O26 `a52782c0`:** før sto prosjektet igjen som tomt kort med «+ Timer»; nå er kortet borte og veien er «Registrer timer». Etter omlasting med `nyttProsjekt` i adressen kommer det tomme kortet tilbake (ref starter null). |
| **T2** Halvferdig kort → reise | «+ Reise» finnes bare på **lagret** jobb (P:2548, P:2639). Utkastkortet har rad 6 `innhold: null` (P:2727), tomt prosjektkort bare «+ Timer» (P:2699). | P:1740–1748, P:1873–1914 | Utkastet: nei — forkastes når et lagret kort åpnes (P:1343). | — | **Ja, stille.** Det som er skrevet i utkastet, er borte. | — | Ja | kode | Nei. Utkast uten «+ Reise» og forkasting ved kortbytte lå likt i `36c64c82` (P:1310, P:2700 der). |
| **T2** Reise fra kort med auto-raden 07–15 | ReiseKort: tur/retur, O20 flytt, O21/O23 kantregler | `ReiseKort.tsx:321`, `:504–514`, `:1307–1373`; `reiseManuell.ts:513–583`, `:592–642` | Ja | Ja | — | — | **Ja.** Reglene regner mot jobben i kortet — også en auto-rad brukeren ikke har skrevet. Tur med Start inne i 07–15 flytter Slutt (O21); retur med Slutt inne i 07–15 flytter Start (O23); O20 tilbyr «Flytt jobbens start/slutt». | kode | **Endret O21 `ff0e1261` og O23 `05c454cc`** (nye regler, vedtak pkt 27/29). O22 `0a7fc689`: uten oppmøtested nå manuell føring i stedet for sperre (forbedring). |
| **T2** Reise via lønnsart (TimerRadDialog, «Legg til timer-rad») | `tilfoyTimerRad` uten `erReise` | D:5126–5127 (før: D:5128 `utledErReise(lønnsart)`) | Ja, som **arbeid** | Ja | — | — | **Ja.** Valg av reise-art gir ikke lenger reise, og ingen melding sier det. Hintet «reisen havner i …» vises ikke på ny rad (P:4437, P:4454). | O25-testene (2), (3c) i `o25-reise-kun-fra-reisevindu.integration.test.ts` | **REGRESJON (vedtatt) — O25 `296151a3`.** Kenneth bestilte det (O25). Men i **dagskort-modus** var dette eneste vei til ny reise: reisevinduet monteres bare fra prosjektkortets «+ Reise» (P:1873, `onNyReise` bare P:1740). Dagskort-brukere kan nå ikke føre ny reise på web. |
| **T2** Manuell reise «Fra byggeplass», Slutt inne i jobben, uten kjøretid | `krysserMidnatt` / `startEtterSluttIJobb` | `reiseManuell.ts:334–348`, `:561–583`; `ReiseKort.tsx:466, 475` | Nei (sperret) | — | — | — | Nei. Synlig «Slutt-tid må være etter start-tid». | kode | **Endret O23 `05c454cc`:** før midnattsdeling, nå sperre. Tilsiktet (pkt 29). |
| **T3** «Fra slutten på forrige jobb» | `aapneNyJobb` → `nyJobbForslag` | P:992–1008, `lib/jobbSkjema.ts:40–64` | Nei (utkast) | Ja | Ja, ved kortbytte (P:1343) | — | **Ja.** Uteblir når `kanBrukeSkjema` er usann (P:919–920: ikke redigerbar dag, ingen standard ordinær art, ingen `aktivitetId`) — da åpnes dialogen uten gult. Fra kan bli slutten på en **reise** (`senesteTilTid` tar alle rader). | kode | Nei. `lib/jobbSkjema.ts` og `JobbSkjema.tsx` uendret (`git diff --quiet`). |
| **T3** Overtidsdeling (`regnJobbTid`, `foreslaOvertidSplitt`, V21) | se R3 | `overtidForslag.ts:74–195`, `lonnsregel.ts:121` | — | — | — | — | **Ja.** Krever en aktiv ordinær art med `overtidsnivaa === 50` (`lonnsregel.ts:121`); et firma med bare 100 %-art eller arter uten nivå får aldri forslag. I prosjektkort-modus deles dialograden bare ved tidsendring, ikke ved bytte av art (P:5028–5042). Til `effektivNorm` er lastet, viser skjemaet én linje (P:900–901). | API-testene under R3 | Nei. `overtidForslag.ts`, `jobbTid.ts`, `lonnsregel.ts` uendret. |
| **T3** Reise-forslag (tid fra kjøretid) | `løsReiseKort` | `reiseManuell.ts:655–776` | — | — | — | — | Delvis. Ankeret er **hele dagens ramme** (P:1887), ikke kortets jobb. Overføringsvalget skjules stille med < 2 kontorer, byggeplassperiode eller uten oppmøtested (`oppmote.ts:390–405`). | kode | O22: flere forslag (manuell modus uten oppmøtested). Ellers nei. |
| **T3** Dagsforslag fra telefon | `lagreOverlappForslag` → `ForslagValgSeksjon` → `forsonDagskort` | D:1441–1501, P:1595–1604, `forsonValg.ts` | Forslag lagres | Ja (banner) | — | — | **Ja.** Ingen forslag når sedelen er sendt/godkjent («laast», D:1454–1457) eller uten tidsoverlapp. | kode | **Endret O25:** `forsonDagskort` leser `erReise` fra forslaget, ikke fra lønnsarten. Forslag fra gammel app uten flagg lagres `false` (D:1484) og blir arbeid ved forsoning, mens vanlig synk fortsatt gjetter reise (D:2074–2083). Smal regresjonskandidat, ikke målt. |

Regresjonskolonnen for radene uten T: filene for veiene er uendret siden `36c64c82` (`git diff --quiet` på `JobbSkjema.tsx`, `lib/jobbSkjema.ts`, `RegistrerTimerKnapp.tsx`, `overtidForslag.ts`, `jobbTid.ts`). O25s endringer i D gjelder bare `erReise` (hunkene i `git diff 36c64c82 -- dagsseddel.ts`), ikke slett, synk av tillegg eller overtid.

## Rotårsaker

### R1 — skjermen leses ikke på nytt fra serveren når en lagring delvis lyktes
- **Rammer:**
  - ny jobb når kall 2 feiler (kortet viser «—», summen er gammel)
  - utkastet som forsvinner ved kortbytte mens raden står på serveren
  - «Send dagen» som låses opp ved avmontering
  - «ting blir borte»
  - «ingen sjekk mot dagskortet for hva som er lagret fra før»: brukeren ser ikke raden og fører den på nytt. Serveren avviser med overlapp (D:2922), og brukeren går i sirkel.
- **Kode:** `ferdig` invaliderer bare i `try` (JS:316–327). `TimerRadDialog` gjør det riktig og invaliderer også i `catch` (P:5103, 5322).
- **Forslag — én retting:** én lagre-hjelper for alle skrivekall i dagskortet. Den invaliderer `hentMedId` i `finally`. Kortets «ulagret» avgjøres ut fra serverens rader for `kortId`, ikke av at skjemaet er montert.
- **Tillegg:** ny jobb bør bli ett serverkall, så halv lagring ikke kan oppstå.

### R2 — en endring under pågående lagring droppes stille
- **Rammer:**
  - tid (JS:330)
  - beskrivelse (JS:395)
  - lønnsart/underprosjekt (JS:416)
- **Følge:** skjemaet viser «✓ Lagret» mens det som står i feltet, ikke er lagret.
- **Forslag — én retting:** et «skitten»-flagg i skjemaet. Når lagringen er ferdig og feltene avviker fra det som ble sendt, sendes på nytt. Til da teller kortet som ulagret.

### R3 — overtid: to utfall gir samme tomme svar
- `foreslaOvertidSplitt` returnerer `[]` både når dagen er under normen og når den er over normen uten noen art med `overtidsnivaa` (`packages/shared/src/utils/overtidForslag.ts:115` og `:117`). `regnJobbTid` blir dermed én normallinje (`jobbTid.ts:125`).
- **Rammer:** «Legg til»-vinduet (klient), «Lagre jobb» (server) og mobilens `velgOvertidLonnsart`-kallere (`apps/mobile/src/utils/linjeLonnsart.ts:155`, `dagsforslag.ts:855/1903`, ikke kjørt her).
- **Prod 26.11:** SITEDOC MYRHAUG har «Overtid 50%» og «Overtid 100%» uten `overtidsnivaa`. Premisset er gjenskapt i sandkassen. Med `overtidsnivaa = 50` deles 15–18 riktig (grønn kontroll).
- **Forslag — én retting:** den delte regelen sier «overtid, men ingen art» som eget utfall. Svaret bærer utfallet, og skjermen viser det. I tillegg gjør lønnsart-oppsettet det synlig når firmaet har overtidsarter uten nivå.
- **Kenneths beslutning:** retting av dataene i SITEDOC MYRHAUG (sette nivået) er en konfigurasjonsendring i prod.

### R4 — tillegg, maskin og utlegg er ikke versjonert i telefonsynken
- `syncBatch` erstatter tillegg, maskin og utlegg med telefonens kopi (D:12193–12250, «full payload-replace»).
- **Følger:**
  - Det som er slettet på PC, kommer tilbake.
  - En PC-retting overskrives.
  - Begge med svar «ok».
- Timerrader er versjonert (V19.9) og tåler dette (grønn test).
- **Rammer:**
  - tillegg (målt)
  - maskin og utlegg (samme kodeblokk, bare lest)
- **Forslag — én retting:** samme versjonering som timerrader (`serverVersjon`/`endretLokalt` og slettespor) for alle fire radtyper. O27 sitt slettespor bør dekke alle radtyper, ikke bare timer. Hva O27 dekker i dag, er ikke målt: branchen er ikke på develop.

### R5 (TILLEGG 1) — «+ Registrer timer» lager en lagret jobb før brukeren har bestemt noe, og den kan ikke avbrytes
- **Kode:** `opprett` med prosjekt kaller `opprettForsteTimerRadForslag` (D:4887–4898 → D:3291–3364). Raden 07:00–15:00 står på serveren før første tastetrykk.
- **Rammer Kenneths scenario:** han trykker Registrer, ser at det «starter feil» (eller vil føre reise), og går ut. Raden står. Eneste vei ut er «Slett jobben»/«Slett» dagen. Det er dette som oppleves som «gamle kort» og «autoppretting». Kenneths rad `57e6facd` «UNN 07–15» (laget på web 25.11 21:50) har nøyaktig denne formen — normvinduet — men det kan ikke bekreftes uten prod-data.
- **Når han så går til reise:** reisevinduet regner O20/O21/O23-reglene mot auto-raden som om den var en jobb han har ført, og tilbyr å flytte start/slutt på den. Det er her «nye feil» oppstår: reglene er nye (O21, O23), premisset (auto-raden) er gammelt.
- **Ikke regresjon** i seg selv: auto-raden lå i `36c64c82`. Det som er nytt, er at O21/O23 nå *handler* på den.
- **Forslag — én retting (Kenneth avgjør):** auto-raden blir et *forslag* i skjemaet (gule felt, ikke lagret) til brukeren bekrefter — da er «gå ut» en avbryt. Samme mønster som «Fra slutten på forrige jobb» allerede har.

### R6 (TILLEGG 1) — reise krever en lagret jobb; et utkast forkastes stille på veien
- «+ Reise» finnes bare på lagret jobb. Utkastet forsvinner når et annet kort åpnes (P:1343). Lå likt i `36c64c82`.
- **Forslag:** «+ Reise» også i utkastkortet (rad 6), uten å kaste utkastet.

### R7 (TILLEGG 1) — O25 tok bort reise via lønnsart, og dagskort-modus har ingen annen vei
- **REGRESJON (vedtatt).** O25 `296151a3` (Kenneths ordre). Konsekvensen for dagskort-modus — der reisevinduet ikke monteres — er ikke nevnt i O25-ordren slik jeg har lest commit-meldingen. **Kenneth avgjør** om dagskort-modus skal få reisevinduet.


- **«`synced_at` tom» på sedel `576d5533` sier ikke at den ikke ble slettet.** Web setter aldri `synced_at` (grønn test), så alle sedler laget på web har den tom.
- **At Kenneth «slettet» kortet, kan ikke bekreftes fra koden.**
  - Alle slette-veier på web viser serverens avvisning: modal, `setFeil` eller `alert`.
  - Det som kan *se ut* som sletting uten å være det:
    - utkastet til en ny jobb forsvinner ved kortbytte (P:1343) mens raden fra kall 1 står (R1)
    - en endring under lagring droppes (R2)
  - Hvilken av disse Kenneth traff 25.11 21:50–21:52, krever serverlogg eller `sheet_rad_historikk` i prod. Det har jeg ikke tilgang til.
- **«Ingen sjekk mot dagskortet»:** serveren sjekker overlapp mot dagens rader (D:2922, D:6124). Det som mangler, er at skjermen viser det serveren har (R1).

## Det jeg ikke kunne måle

- **Prod-dataene** (sedel `576d5533`, rad `57e6facd`, Kenneths 15–18): ingen prod-DB i ordren.
- **Om blur rekker å starte lagringen før skjemaet avmonteres** ved klikk på et annet korthode: jsdom har ikke nettleserens fokusrekkefølge.
- **Telefonens egen side** (`apps/mobile/src/services/timerSync.ts`): målt bare gjennom serverens `syncBatch` og O26s `finnSedlerÅSlette`. Ikke kjørt på telefon.
- **Attestering, forsoning, del opp/angre, splitt, prosjektbytte:** kartlagt (tabellen), ikke testet i M1.
- **TILLEGG 1, ikke målt:** om blur-lagring rekker å starte før `velgKort` når et annet korthode klikkes med gyldig Til (jsdom); samspillet mellom et lokalt endret skjemafelt og O20 `flyttRad`; hvor mange forslag fra gammel app som mangler `erReise`.
- **O27** (`fix/slettet-er-slettet` @ `6c66f945`): ikke på develop, ikke målt.
- **Registrering:** fila er ikke ført i `STATUS.md`/`DOC-MAP.md`. Ordren begrenser filene til testene og denne rapporten. Det tas i orkestrators docs-commit.
