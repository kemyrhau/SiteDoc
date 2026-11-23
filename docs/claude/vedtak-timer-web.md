---
status: aktiv
sist_verifisert_mot_kode: 2026-11-22
avhenger_av:
  - SAMARBEIDSREGLER.md
---

# Vedtak — timer på web

Hva timeføringen på web **skal** gjøre, vindu for vindu, med Kenneths ord. Reisevinduet og dagsvisningen i attesteringen er ført og står bare her.
De andre vinduene står i [web-timeforing-plan.md](web-timeforing-plan.md) til de føres hit på samme måte.

## Grunnregler

1. **To sannheter.** Koden er sannheten for hva programmet gjør i dag. Kenneths vedtak er sannheten for hva det
   skal gjøre. Planen, loggen, ordrer og agentenes tolkninger er ikke hjemmel.
2. **Bruker bestemmer, programmet foreslår.** Kenneth: «Bruker bestemmer registrering -> programmet bestemmer
   ingen ting -> vi kun foreslår» og «åpne redigerbare felter -> ikke fastlåst. Men vi skal foreslå løsning».
3. **Godkjent i test er vernet.** Det Kenneth har godkjent i test, kan bare endres med hans egne ord.
4. **Et «ja» er smalt.** Et «ja» gjelder bare det som står under «Svarer du ja» og «Forsvinner» i ett spørsmål
   i den faste formen. Et «ja» til en samlet liste er ikke et vedtak.

## Slik føres fila

- Bare orkestrator skriver eller endrer et vedtak, og bare med Kenneths ord. Koderen endrer bare status.
- Hvert punkt er én setning om hva brukeren ser eller kan gjøre, deretter Kenneths ord i kortform og status.
- Et punkt som snus, byttes ut. Det gamle slettes; historikken ligger i git.
- Status viser til fil og kodeord, ikke linjenummer.

| Status | Betyr |
|---|---|
| ✅ | Bygget. Fil og kodeord står ved punktet. |
| 🟡 | Vedtatt, ikke bygget. |
| 🔴 | Koden avviker fra vedtaket. |
| ❓ | Uavklart. Kenneth har ikke sagt det. |

## Reisevinduet

Vinduet «Reise», som åpnes med «+ Reise» når arbeideren fører en ny reise på PC.
Filer: `RK` = `apps/web/src/app/dashbord/timer/[id]/ReiseKort.tsx` · `MR` = `apps/web/src/hooks/useManuellReiseWeb.ts` · `RM` = `packages/shared/src/utils/reiseManuell.ts` · `RT` = `apps/web/src/app/dashbord/timer/[id]/reise-terskel-dialog.test.tsx` · `RKS` = `packages/shared/src/utils/reiseKort.ts` · `DS` = `apps/api/src/routes/timer/dagsseddel.ts`.

1. Arbeideren velger «Til byggeplass», «Fra byggeplass» eller «Til annet oppmøtested». Øverst står linja «Fra → Til». Oppmøtestedet er ett nedtrekk, under «Fra» ved «Til byggeplass» og under «Til» ved «Fra byggeplass», fylt ut med dagens oppmøtested («Kontor Tromsø · fast» / «· midlertidig», også når firmaadmin satte det). Ved «Til annet oppmøtested» er «Fra» dagens oppmøtested (tekst) og «Til» et nedtrekk med firmaets andre kontorer; tiden foreslås fra firmaets kjøretid mellom kontorene, før dagens første arbeid, og kan rettes; reisen lagres i kortet vinduet er åpnet fra. Velges det faste kontoret under «Til», er det hjemreisen.
   Kenneth 2026-11-22: behov «fra oppmøtested til byggeplass», «fra byggeplass tilbake til oppmøtested», «Fra fast oppmøtested til nytt oppmøtested (tidsavgrenset/midlertidig)», «fra byggeplass til nytt oppmøtested (tidsavgrenset/midlertidig)»; 2026-11-23: «S1.ja», «S4.ja» (snur «Ja, samme regel» fra 21.11). Skisser `relay/skisser/reise-oppmote-1/2/3-*.png`.
   ✅ Merget `0e650523`, ikke deployet: `RK` `reise-fra-til`, `oppmoteFelt` (`reise-oppmotested`, `kontorMedMerke`), `periodeLinje`, tredje retning `timer.reiseKort.tilAnnetOppmotested` med `fraKontorTekst`/`tilKontorFelt`; `MR` `løsOverforingKort` med kjøretid fra `oppmotested.hentKontorAvstanderForFirma`; `OM` `gjeldendeMidlertidig`. Firmaadmins periode har ikke «Avslutt» (R8). Tester: `reisevindu.test.tsx` «O16 pkt 1», «pkt 4», «R8»; `o14-penn-reise.test.tsx` «O16 pkt 5 (R5)».
2. Velger arbeideren et annet kontor enn dagens oppmøtested, sier en blå boks at kontoret blir midlertidig oppmøtested, med «Gjelder fra» og det valgfrie «Til og med», begge fylt ut og rettbare. «Gjelder fra» foreslår sedelens dato ved «Til byggeplass», dagen etter ved «Fra byggeplass», og ved «Til annet oppmøtested» sedelens dato når reisen starter før kl. 12, ellers dagen etter. Dagen etter «Til og med» gjelder det faste igjen av seg selv. Velger han det faste kontoret mens et midlertidig gjelder, sier boksen at det midlertidige avsluttes, med «Siste dag»: sedelens dato ved «Fra byggeplass», dagen før ved «Til byggeplass», og ved «Til annet oppmøtested» samme kl. 12-regel som retur-turen: dagen før når reisen starter før kl. 12, ellers sedelens dato (Kenneth «R7a ja»). «Avslutt» står under feltet med perioden og spør om «Siste dag», med dagen før som forslag (Kenneth «R7b ja»). Redigering av en lagret reise skriver ingen periode.
   Kenneth: «1A»; 2026-11-23: «S2.ja», «S3.ja».
   ✅ Merget `0e650523`, ikke deployet: `OM` `planleggOppmoteBytte`, `gjelderFraForslag`, `sisteDagForslag` (R7a), `avsluttSisteDagForslag` (R7b), `planleggOverforing` med `tilDato` og egne perioder med sluttdato (`finnEgenOverforing`), `overforingKonflikt`; `RK` `oppmoteBoks` (`reise-gjelder-fra`, `reise-til-og-med`, `reise-siste-dag`, «… slutter»/«… fjernes»), `avsluttSporsmal`; `apps/api/src/routes/oppmotePeriode.ts` `overforingInput.tilDato` (bare `start`, ≥ `dato`) og CONFLICT som lesbar tekst (`timer.reiseKort.sperre.overlappServer`). Tester: `packages/shared/src/utils/oppmote-o16.test.ts`, `oppmotePeriode.test.ts` «O16», `reisevindu.test.tsx` «O16 pkt 2/3», «H3», «R3», «R4», «R7a», «R7b».
3. Åpnes vinduet fra et prosjektkort, har reisen kortets prosjekt og byggeplass. De vises som tekst og kan ikke byttes, og reisen lagres i det kortet, også om underprosjektet er et annet. En grå linje sier at en reise til et annet sted føres i det stedets prosjektkort. I dagskort-visningen er «Hvor kjørte du til?» (ved retur «Hvor kjørte du fra?») fylt ut fra dagen, og arbeideren kan bytte prosjekt og byggeplass.
   Kenneth: «jeg står i et prosjektkort og åpner en +reise -> jeg skal da arve prosjektets prosjektnummer og byggeplass -> det er feil å føre reisen til en annen plass», «gi bruker informasjon -> hvis reisen er til feil prosjekt/byggeplass -> åpne og registrer reisen i korrekt prosjektkort», «3.ja». Dagskort: «jeg trenger å endre prosjektet reisen går til/fra».
   ✅ `RK` `iKort`, `reise-kort-sted`, `timer.reiseKort.foresIKortet`; `DS` `tilfoyTimerRad` `reiseIKort`; `RT` «O12 pkt 3». Dagskort-visningen uendret (`RK` `reise-prosjekt`). Reisen avgjør ikke kortets nøkkel: `JOBBRAD` (`services/timer/kortId.ts`), test `jobbrad-reise-i-kort.test.ts`.
4. «Start kl.» og «Slutt kl.» er fylt ut med forslaget, og arbeideren kan rette begge.
   Kenneth: «hva om jeg begynte å kjøre kl 12:00?», «kjøretider må kunne redigeres», «jeg savner mulighet til å endre tidspunkter».
   ✅ `RK` `reise-start`, `reise-slutt`. Under terskel: `RT` «O10 — feltene står i reisevinduet».
5. Arbeideren kan skrive «Antall timer», og klokka regnes ut; retter han klokka, regnes antallet.
   Kenneth: «slik at jeg kan sette 1 t og klokken justeres automatisk».
   ✅ `RK` `reise-antall`. Under terskel: `RT` «O10 — feltene står i reisevinduet».
6. På «Til byggeplass» står Slutt fast og Start flytter seg, både når antallet skrives og når Start rettes; på «Fra byggeplass» står Start fast.
   Kenneth: «da bør start arbeid være fast og det første tidspunktet justeres, ikke det siste», og «ja» til at Slutt står når Start rettes.
   ✅ `RK` `reiseTiderFraAntall`.
7. (For nye reiser erstattet av punkt 20: «Arbeidstid» er ikke lenger et valg; en lagret arbeidstid-reise redigeres som før.) «Føres som» viser Reisetid og Arbeidstid; firmaets terskel velger på forhånd, og arbeideren kan bytte begge veier.
   Kenneth: «hvem vet best hva som er reise? er det programmet eller bruker?», «Her skal valget reisetid eller arbeidstid være tilstede».
   ✅ Bare pennen på en lagret arbeidstid-reise (punkt 20, S5 A): `RK` `foresSom`, `kategoriValg`; `o14-penn-reise.test.tsx` «O14 pkt 2». Ny reise og lagret Reisetid har ingen «Føres som»-knapper (`RT` «O18», `o14-penn-reise.test.tsx` «reisetid: feltene står fra raden»).
8. (For nye reiser erstattet av punkt 20.) Med «Arbeidstid» valgt står de samme feltene som med «Reisetid», og «Lagre» fører turen som arbeidstid på jobben.
   Kenneth: «nå kan ikke reisekortet endre tid» (om bygget som skjulte feltene), og «S1 ja» (S1 = «Arbeidstid» i reisevinduet som før O8). S2 (avrundingen) er erstattet av punkt 10, S3 («Bytte til reisetid?») av punkt 9.
   ✅ Feltene står også under terskel (punkt 20, S2): `RT` «O10 — feltene står i reisevinduet». Lagringen som arbeidstid, `arbeidKortId` og `timer.reiseKort.underTerskelPaaJobb` / `overTerskelPaaJobb` er fjernet for ny reise (punkt 20).
9. (For nye reiser erstattet av punkt 20: dialogen og «Behold arbeidstid» er borte; det gule hintet står i tilstanden under terskel.) Er turen over firmaets terskel og «Arbeidstid» er valgt, står et gult varsel i vinduet. Har firmaet terskel i minutter, måles den på tiden i vinduet, og «Lagre» åpner dialogen «Føre turen som reisetid?» med «Før som reisetid» og «Behold arbeidstid»; begge lagrer. Har firmaet terskel i km, har vinduet avhukingen «Reisen er mer enn {terskel} km», huket av på forhånd når firmaets tabell er over terskelen; avhuket gir «Reisetid» på forhånd, og arbeideren kan endre begge. I km-firma vises det gule varselet når avhukingen er huket av og «Arbeidstid» er valgt. Lenken «Bytte til reisetid?» forsvinner.
   Kenneth: «vi bør foreslå når reisen er lengre enn 30 minutter -> "bytte til reisetid?"», «sjekk firmainstilling. dersom firma har x minutter, bruk denne som terskel. Dersom firma har km->benytt avhuking og kommentar reise mer enn x km», «teksten ved avhukingen -> men dersom arbeidstid velges og reisetid/avstand er over terskle -> ønskelr jeg gult varsel», og om km-varselet: «A ja» (avhukingen avgjør).
   ✅ Km-avhukingen står: `RK` `reise-mer-enn-km`, `kmAvhuket`; av gir tilstanden under terskel. Varselet `reise-over-terskel-varsel`, `kreverTerskelDialog` og dialogen `reise-terskel-dialog` er fjernet (punkt 20); hintet er `reise-under-terskel-over-vindu`. `RT` «O18 S4 — gult hint, og km-avhukingen».
10. Forslaget til reisetid er firmaets kjøretid uten avrunding, likt på PC og telefon; «Forslag: X min kjøring» viser den, og det arbeideren selv skriver, rundes ikke.
    Kenneth: «0,25 timer kjøretid er nå feil mellom kontor tromsø og sommerfeldtsgt 65. skal være ca 6 minutter», «2.ja».
    ✅ `MR` `useManuellReiseWeb` (ingen avrunding), `RK` `timer.reiseKort.forslag` med `resultat.kjoretidMin`; `RT` «O12 pkt 10».
11. Arbeideren kan velge underprosjekt for reisen; feltet er valgfritt og fylt ut fra jobben.
    Kenneth: «vi mangler også underprosjekt», «prosjekt / byggeplass / valgfritt valg -> underprosjekt».
    ✅ `RK` `ecoId`, `timer.felt.underprosjekt`. Under terskel: `RT` «O10 — feltene står i reisevinduet».
12. Fører arbeideren «Til byggeplass» i et annet kort enn dagens første, eller «Fra byggeplass» i et annet enn dagens siste, spør «Lagre» om kortet er riktig: dagens første (siste) kort vises, med «Ja, lagre» og «Avbryt».
    Kenneth: «Jeg syns vi skal varsle bruker, spør om kortet registreres på rett prosjekt, dersom kortet ikke registreres på kortets første prosjekt», «3b ja for begge». (Det tidligere punktet om «Står i jobben/kortet på …» og «Får eget kort» er slettet: «den er gammel og bør slettes».)
    ✅ `RK` `kortSjekk`, `reise-kort-sjekk`, `timer.reiseKort.kortSjekk`; `RT` «O12 pkt 12».
13. Er «Lagre» sperret, sier en rød tekst hvorfor.
    Kenneth: svaret på inventaret (punkt 8) gjelder at tekstene vises også med «Arbeidstid». Selve sperrene har ikke Kenneths ord i planen eller `timer.md`.
    ✅ `RK` `SPERRE_NOKKEL`, `tidSperre`.
14. Mangler firmaets kjøretid for strekningen, vises tidsfeltene likevel: tidspunktet som henger på arbeidet er fylt ut, det andre og antallet skriver arbeideren selv, og en grå tekst sier at firmaet ikke har kjøretid og at firmaadmin kan legge den inn under Avstander. «Lagre» åpner når tiden er skrevet. Har kortet ingen byggeplass, gjelder det samme, og teksten sier at kortet ikke har byggeplass og at reisen bør føres i et prosjektkort med byggeplass.
    Kenneth: «vi har ikke grunnlag å beregne kjøring -> da blokerer koden helt registrering -> slik kan det ikke være», «1.ja», og om kort uten byggeplass: «B ja. men varsle brukeren at +reise bør registreres på et prosjektkort».
    ✅ `RM` `tillatUtenKjoretid`, `løsReiseKortUtenKjoretid`; `RK` `reise-uten-kjoretid`, `timer.reiseKort.utenKjoretid` / `utenByggeplass`; `RT` «O12 pkt 14». Mobil kaller uten flagget og er uendret (`reiseManuell.test.ts` «mobilkallet uten flagget»).
15. Bytter arbeideren retning, kontor, prosjekt eller byggeplass, forkastes tidene han har rettet, antallet og valget i «Føres som».
    Kenneth har bare sagt det om «Bytte til reisetid?» (punkt 9).
    ❓ `RK` `nullstillTider`.
16. (For nye reiser erstattet av punkt 20: «Arbeidstid» er ikke lenger et valg; lagrede rader vises som før.) En reise ført som «Arbeidstid» er fortsatt en reise. Den vises med merket «Reise», «Reise til/fra …» og lønnsarten sin (for eksempel «Timelønn»), og timene teller som arbeidstid i dagsraden, ikke som reise. Bytter arbeideren mellom «Reisetid» og «Arbeidstid» i reisevinduet, beholder reisen kortet og merket. Raden lagrer at den er en reise (migrering); turer lagret før dette får ikke merket.
    Kenneth: «Nå er reisetid registrert som arbeid uten å vise at det var en reisetidlagring», «4. ja»; 2026-11-22: «er det ikke bedre å registrere linjen som "ført som reise". Lønnsarten bør stå. og telle tiden som arbeidstid i toppraden.»
    ✅ Merket og summene: `SheetTimer.arbeidReiseRetning` (migrering `20261122120000_o12_arbeid_reise_retning`; ingen backfill); `DS` `tilfoyTimerRad` `arbeidReiseRetning`; `apps/web/src/app/dashbord/timer/[id]/page.tsx` `ReiseLinje` `somReise`; `apps/api/src/services/timer/kortId.ts` `erKortReiseArbeid`; `prosjektkort.test.ts`, `reiseSkille.test.ts` «O12 pkt 16». ✅ Byttet (O14): `DS` `oppdaterTimerRad` tar `arbeidReiseRetning` og `reiseRetning`, beholder kort-id-en når raden er reise før og etter, og `arbeidReiseRetningEtter` setter/nuller merket; `o14-reise-forblir-reise.test.ts` «O14 pkt 1». 🟡 `feat/web-timer-o14-reise`, ikke merget.
17. (For nye reiser erstattet av punkt 20: «Arbeidstid» er ikke lenger et valg; lagrede rader vises som før.) Pennen på en lagret reise åpner vinduet «Reise», det samme som «+ Reise», med reisens verdier fylt ut: retning, Start, Slutt, Antall timer, «Føres som» og underprosjekt. Prosjekt og byggeplass er kortets og vises som tekst (punkt 3). «Rediger timer-rad» åpnes ikke for en reise.
    Kenneth 2026-11-22: «s1.ja» (snur «5.nei, som i dag»).
    ✅ `apps/web/src/app/dashbord/timer/[id]/page.tsx` `redigerReise`, modal `reiseRediger`; `ReiseKort.tsx` prop `rad` (`ReiseKortRedigerRad`), `lagreRedigering` → `oppdaterTimerRad`; bare prosjektkort-modus, dagskort-modus åpner «Rediger timer-rad» som før. `reiseStedLaast` og `timer.rediger.reiseFeilSted` er fjernet. `o14-penn-reise.test.tsx` «O14 pkt 2», `w15f-penn.test.tsx`. 🟡 `feat/web-timer-o14-reise`, ikke merget.
18. Bytter et prosjektkort prosjekt eller byggeplass og kortet har en reise, kommer et vindu før flyttingen med reisens tider og ny kjøretid, og valgene «Flytt reisen med ny tid», «Slett reisen» og «Avbryt»; ingenting endres før arbeideren velger. Mangler ny kjøretid, flyttes reisen med de gamle tidene, og vinduet sier det.
    Kenneth: «å bytte prosjekt vil endre reisetid -> det kan vi ikke gjøre stille -> da må bruker se og akseptere en endring», «7 … -> ok».
    ✅ `apps/web/src/app/dashbord/timer/[id]/JobbSkjema.tsx` `reiseFlytt`, `nyReiseTid`, `flytt-reise-vindu`; `DS` `flyttJobbTilSted` `reiseValgMangler`, `flyttJobbReiseSchema`; `flytt-jobb-sted.test.tsx` / `dagsseddel-flytt-jobb.test.ts` «O12 pkt 18». Arbeidstid-reiser lagret før merket (punkt 16) er arbeid og følger stille med.
19. (Erstattet av punkt 1: oppmøtestedet står som ett felt i «Fra → Til», Kenneth 2026-11-23 «S1.ja».) Til punkt 1 er bygget, står linja «Til {kontor}» ved «Fra byggeplass».
    Kenneth 2026-11-22: «f7.ja til forslag».
    ✅ `timer.reiseKort.tilOppmotested` (`ReiseKort.tsx`), `reisevindu.test.tsx` «O14 pkt 7» (merget `50f480c8`, ikke deployet). ✅ Erstattet i O16 (merget `0e650523`): linja og nøkkelen er fjernet; oppmøtestedet står under «Til» ved «Fra byggeplass» (`reisevindu.test.tsx` «O14 pkt 7»).

20. En reise under terskel føres ikke som reise. Vinduet «Reise» lagrer ingen reise ført som «Arbeidstid» for nye reiser, verken «Til byggeplass» eller «Fra byggeplass»: under terskel står «Under terskel: før tiden som arbeidstid i jobbens Fra–til», med en knapp som fører reisen likevel som «Reisetid» (samme regler som over terskel i dag). «Arbeidstid» er ikke lenger et valg i «Føres som». Reiser som alt er lagret som arbeidstid, vises som før (punkt 16); ingen data endres. Mobil i egen runde.
    Kenneth 2026-11-23: «Reise under terskel registreres ikke som reise. kun reise over terskel. da benytter vi regler som i dag og heller fjerner mulighet å føre reiser under terskel. hvis arbeidstaker absolutt vil føre reise under terskel -> kan han få lov -> men vi anbefaler å føre reisen som arbeidstid»; «ja, også hjemreise. web nå, mobil egen runde». Erstatter «C» (avhuking «startet reise utenfor arbeidsnorm», Fabels skisse `relay/skisser/f10c-*`), som Kenneth avviste («nei … vi overkompliserer dette»).
    Kenneth 2026-11-23 til LØSNING O18: «s1 ja / s3 ja / s4 ja»; S2 ja etter O8/O10-presedens, S5 = A.
    ✅ Merget `4bc05499` (O18, web; mobil egen runde). Ikke deployet. `RK` `underTerskel` (firmaets regel sier arbeidstid, S3), `reise-under-terskel` med `timer.reiseKort.underTerskelInfo` (eller `arbeidstidInfo` når firmaet fører også over terskel som arbeidstid), knappen `timer.reiseKort.forSomReisetidLikevel` (`trykkForeLikevel` → kortsjekken, så `forSomReisetid`), `lagre()` lagrer bare `erReise`; feltene står (S2). Med den blå boksen lagrer `timer.reiseKort.lagreOppmotested` bare perioden (`lagreOppmotested`, S1). Minuttfirma: `reise-under-terskel-over-vindu` (`timer.reiseKort.underTerskelOverVindu`, S4). Lagret arbeidstid-reise: pennen som før (S5 A). Serveren og mobilen er urørt (`DS` tar fortsatt imot `arbeidReiseRetning` fra mobil); `finnDagsramme`, maskinregelen og overtiden er uendret — gamle arbeidstid-reiser teller som før. Tester: `RT` «O18 — …», «O18 S4 — …», «O10 — feltene står …»; `reisevindu.test.tsx` «O18 S1 …»; `o14-penn-reise.test.tsx`.
21. En reise mellom to kontorer vises som «Kontor Tromsø → Kontor Narvik» i kortlisten, og eksporten fyller «Til» med kontoret.
    Kenneth 2026-11-23: «funn1 ja med eksport».
    ✅ Merget `6ee3b632` (O17): `kontorReiseRute` (`packages/shared/src/utils/reiseManuell.ts:561`), `useKontorReiseTekst.ts` i kortliste og attestering; eksporten fyller «Fra»/«Til» via `reise-steder.ts` (`apps/api/src/routes/timer/rapport.ts`); `o17-kontorreise-eksport.integration.test.ts`. Ikke deployet.
22. «Avslutt» med en «Siste dag» før periodens start sier at perioden fjernes, med samme tekst som boksen («Perioden din Kontor Tromsø fra 23.11 fjernes.»), før arbeideren trykker.
    Kenneth 2026-11-23: «funn2 ja».
    ✅ Merget `6ee3b632` (O17): `planleggAvslutt` (`packages/shared/src/utils/oppmote.ts:491`) gir teksten; `ReiseKort.tsx:711-716` sender samme `slutt`/`periodeId`-kall; `reisevindu.test.tsx` «O17 pkt 22». Ikke deployet.

## Dagsvisningen i attesteringen

1. Dagen står øverst som en dagsrad, hvert kort er en blokk med egen kantfarge, og jobbrad vises når dagen har flere kort (alternativ A).
    Kenneth: «B14 A. men ved flere prosjekter samme dag, da må vi visuelt skille hvert registrerte kort fra hverandre innenfor samme dag» (2026-11-17), «Alternativ A viser tydelig skille på dagskortene. Det kortet er de beste av alternativene» (2026-11-22).
    ✅ `AttesteringTabell.tsx` (`variant: "dag"`, `variant: "jobb"`, `KORT_KANT`).
2. Dagsraden og jobbraden viser prosjektets navn, og under det byggeplass · underprosjekt, i stedet for prosjektnummeret (skisse B14c variant B, `docs/claude/skisser-web-timeforing/b14c-b.png`).
    Kenneth: «ingen av forslagene viser tydelig hvilket prosjekt/byggeplass kortene er registrert på … det er selvsagt prosjektnavn vi må vise» (2026-11-22), «Variant B» (2026-11-22).
    ✅ (merget `72d375ae`, ikke deployet) `AttesteringTabell.tsx` (`navnInnhold`, `navnefelt`, `data-prosjektnavn`); plassen følger kolonneoppsettet (`navnefeltPlass` i `attestering-tabell.ts`).
3. Reise og overtid står som egne kolonner, «Reise» og «Overtid», ved siden av Timer: dagens timer i dagsraden og jobbens i jobbraden. Reise- og overtidslinjene har lønnsartens navn i farget merke og timetallet i samme farge, og dagens sum står hel (skisse B14c variant B). Attesteringssiden har full bredde, så alle kolonner synes uten rulling der skjermen har plass; andre sider beholder bredden.
    Kenneth: «det kommer dårlig frem på kortet overtid og reisetid. dette er områder som må komme mer tydelig frem», «Variant B -> der ser jeg med en gang på topplinjen hva jeg godkjenner», «Ja, full bredde» (2026-11-22).
    ✅ (merget `72d375ae`, ikke deployet) `TIMER_TABELL_STANDARD` (`reisetimer`, `overtid` etter `timer`; satt inn i lagrede oppsett via `TIMER_TABELL_TILLAGT` / `medTillagteKolonner`), `sumOvertidTimer` i `timerDetaljRader.ts`, `AttesteringTabell.tsx` (`reiseOvertidCelle`, `data-lonnsart-merke`, `linjeSpenn`, `ATTESTERING_BREDDE.timer` 60); full bredde `dashbord/attestering/page.tsx` (`min-w-0`, uten `max-w-7xl`).
4. (Gjelder rader lagret før punkt 20 i Reisevinduet.) En reise ført som arbeidstid har merket «Reise» foran lønnsarten, for eksempel «Reise · Timelønn»; timene står i Timer som vanlig arbeidstid, ikke i Reise.
    Kenneth 2026-11-22: «f3.ja -> med dette mener jeg ar "reise" lønnsart "timelønn" -> arbeidstiden blir da vanlig timelønn slik standard arbeidstid er.»
    ✅ Merget `6cf48d6e` (O15): `AttesteringTabell.tsx` (`data-reise-arbeid`, kjennetegn `erArbeidstidReise` i `packages/shared/src/utils/arbeidstidReise.ts`).
5. Dagsraden teller kort med bare reise for seg: «2 jobber · 1 reise».
    Kenneth 2026-11-22: «f4.forslag ok».
    ✅ Merget `6cf48d6e` (O15): `erBareReiseKort` i `attestering-tabell.ts` (begge slag reise), `antallJobber` i `AttesteringTabell.tsx`; «1 jobb · 1 reise» når dagen har ett kort med arbeid og ett med bare reise (beslutning c).
6. Fra–til står hele, for eksempel «06:56–07:00», uten å kuttes.
    Kenneth 2026-11-22: «f6.ja».
    ✅ Merget `6cf48d6e` (O15): `ATTESTERING_BREDDE.fraTil` og `data-fra-til` med `tabular-nums` i `AttesteringTabell.tsx`.
