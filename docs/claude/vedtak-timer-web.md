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

1. Arbeideren velger «Til byggeplass» eller «Fra byggeplass»; kjøring til et annet kontor har ingen egen reisetype.
   Kenneth: «Ja, samme regel» (kontorkjøring som all annen kjøring).
   ✅ `RK` `valgKnapp`, `timer.reiseKort.tur` / `retur`.
2. Har firmaet flere kontorer, kan arbeideren selv sette et midlertidig oppmøtested med «Fra et annet kontor fra i dag» og avslutte det med «Avslutt».
   Kenneth: «1A».
   ✅ `RK` `reise-annet-kontor`, `avsluttOverforing`.
3. Åpnes vinduet fra et prosjektkort, har reisen kortets prosjekt og byggeplass. De vises som tekst og kan ikke byttes, og reisen lagres i det kortet, også om underprosjektet er et annet. En grå linje sier at en reise til et annet sted føres i det stedets prosjektkort. I dagskort-visningen er «Hvor kjørte du til?» (ved retur «Hvor kjørte du fra?») fylt ut fra dagen, og arbeideren kan bytte prosjekt og byggeplass.
   Kenneth: «jeg står i et prosjektkort og åpner en +reise -> jeg skal da arve prosjektets prosjektnummer og byggeplass -> det er feil å føre reisen til en annen plass», «gi bruker informasjon -> hvis reisen er til feil prosjekt/byggeplass -> åpne og registrer reisen i korrekt prosjektkort», «3.ja». Dagskort: «jeg trenger å endre prosjektet reisen går til/fra».
   ✅ `RK` `iKort`, `reise-kort-sted`, `timer.reiseKort.foresIKortet`; `DS` `tilfoyTimerRad` `reiseIKort`; `RT` «O12 pkt 3». Dagskort-visningen uendret (`RK` `reise-prosjekt`).
4. «Start kl.» og «Slutt kl.» er fylt ut med forslaget, og arbeideren kan rette begge.
   Kenneth: «hva om jeg begynte å kjøre kl 12:00?», «kjøretider må kunne redigeres», «jeg savner mulighet til å endre tidspunkter».
   ✅ `RK` `reise-start`, `reise-slutt`. Med «Arbeidstid»: `RT` «O10 — Arbeidstid i reisevinduet som før O8».
5. Arbeideren kan skrive «Antall timer», og klokka regnes ut; retter han klokka, regnes antallet.
   Kenneth: «slik at jeg kan sette 1 t og klokken justeres automatisk».
   ✅ `RK` `reise-antall`. Med «Arbeidstid»: `RT` «O10 — Arbeidstid i reisevinduet som før O8».
6. På «Til byggeplass» står Slutt fast og Start flytter seg, både når antallet skrives og når Start rettes; på «Fra byggeplass» står Start fast.
   Kenneth: «da bør start arbeid være fast og det første tidspunktet justeres, ikke det siste», og «ja» til at Slutt står når Start rettes.
   ✅ `RK` `reiseTiderFraAntall`.
7. «Føres som» viser Reisetid og Arbeidstid; firmaets terskel velger på forhånd, og arbeideren kan bytte begge veier.
   Kenneth: «hvem vet best hva som er reise? er det programmet eller bruker?», «Her skal valget reisetid eller arbeidstid være tilstede».
   ✅ `RK` `foresSom`, `kategoriValg`.
8. Med «Arbeidstid» valgt står de samme feltene som med «Reisetid», og «Lagre» fører turen som arbeidstid på jobben.
   Kenneth: «nå kan ikke reisekortet endre tid» (om bygget som skjulte feltene), og «S1 ja» (S1 = «Arbeidstid» i reisevinduet som før O8). S2 (avrundingen) er erstattet av punkt 10, S3 («Bytte til reisetid?») av punkt 9.
   ✅ `RK` `arbeidKortId`, `timer.reiseKort.underTerskelPaaJobb` / `overTerskelPaaJobb`.
9. Er turen over firmaets terskel og «Arbeidstid» er valgt, står et gult varsel i vinduet. Har firmaet terskel i minutter, måles den på tiden i vinduet, og «Lagre» åpner dialogen «Føre turen som reisetid?» med «Før som reisetid» og «Behold arbeidstid»; begge lagrer. Har firmaet terskel i km, har vinduet avhukingen «Reisen er mer enn {terskel} km», huket av på forhånd når firmaets tabell er over terskelen; avhuket gir «Reisetid» på forhånd, og arbeideren kan endre begge. I km-firma vises det gule varselet når avhukingen er huket av og «Arbeidstid» er valgt. Lenken «Bytte til reisetid?» forsvinner.
   Kenneth: «vi bør foreslå når reisen er lengre enn 30 minutter -> "bytte til reisetid?"», «sjekk firmainstilling. dersom firma har x minutter, bruk denne som terskel. Dersom firma har km->benytt avhuking og kommentar reise mer enn x km», «teksten ved avhukingen -> men dersom arbeidstid velges og reisetid/avstand er over terskle -> ønskelr jeg gult varsel», og om km-varselet: «A ja» (avhukingen avgjør).
   ✅ `RK` `reise-over-terskel-varsel`, `kreverTerskelDialog`, `reise-terskel-dialog`, `reise-mer-enn-km`, `kmAvhuket`; `RT` «O12 pkt 9».
10. Forslaget til reisetid er firmaets kjøretid uten avrunding, likt på PC og telefon; «Forslag: X min kjøring» viser den, og det arbeideren selv skriver, rundes ikke.
    Kenneth: «0,25 timer kjøretid er nå feil mellom kontor tromsø og sommerfeldtsgt 65. skal være ca 6 minutter», «2.ja».
    ✅ `MR` `useManuellReiseWeb` (ingen avrunding), `RK` `timer.reiseKort.forslag` med `resultat.kjoretidMin`; `RT` «O12 pkt 10».
11. Arbeideren kan velge underprosjekt for reisen; feltet er valgfritt og fylt ut fra jobben.
    Kenneth: «vi mangler også underprosjekt», «prosjekt / byggeplass / valgfritt valg -> underprosjekt».
    ✅ `RK` `ecoId`, `timer.felt.underprosjekt`. Med «Arbeidstid»: `RT` «O10 — Arbeidstid i reisevinduet som før O8».
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
16. En reise ført som «Arbeidstid» vises med merket «Reise» og «Reise til/fra …» i kortet; timene teller som arbeid med samme lønnsart. Raden lagrer at den er en reise (migrering); turer lagret før dette får ikke merket.
    Kenneth: «Nå er reisetid registrert som arbeid uten å vise at det var en reisetidlagring», «4. ja».
    ✅ `SheetTimer.arbeidReiseRetning` (migrering `20261122120000_o12_arbeid_reise_retning`, ikke kjørt; ingen backfill); `DS` `tilfoyTimerRad` `arbeidReiseRetning`; `apps/web/src/app/dashbord/timer/[id]/page.tsx` `ReiseLinje` `somReise`; `apps/api/src/services/timer/kortId.ts` `erKortReiseArbeid`. Summene uendret (`prosjektkort.test.ts`, `reiseSkille.test.ts` «O12 pkt 16»).
17. Pennen på en lagret reise åpner «Rediger timer-rad» som i dag, men prosjekt og byggeplass vises bare som tekst, med linja «Feil sted? Slett reisen og før den med «+ Reise» i riktig prosjektkort.»
    Kenneth: «5.nei, som i dag. men redigering av prosjekt og byggeplass -> dersom dette er feil, be bruker åpne +reise i rett prosjekt», «5b ja».
    ✅ `apps/web/src/app/dashbord/timer/[id]/page.tsx` `TimerRadDialog` `reiseStedLaast`, `reise-sted-tekst`, `timer.rediger.reiseFeilSted`; `w15f-penn.test.tsx` «O12 pkt 17». Serveren `oppdaterTimerRad` uendret.
18. Bytter et prosjektkort prosjekt eller byggeplass og kortet har en reise, kommer et vindu før flyttingen med reisens tider og ny kjøretid, og valgene «Flytt reisen med ny tid», «Slett reisen» og «Avbryt»; ingenting endres før arbeideren velger. Mangler ny kjøretid, flyttes reisen med de gamle tidene, og vinduet sier det.
    Kenneth: «å bytte prosjekt vil endre reisetid -> det kan vi ikke gjøre stille -> da må bruker se og akseptere en endring», «7 … -> ok».
    ✅ `apps/web/src/app/dashbord/timer/[id]/JobbSkjema.tsx` `reiseFlytt`, `nyReiseTid`, `flytt-reise-vindu`; `DS` `flyttJobbTilSted` `reiseValgMangler`, `flyttJobbReiseSchema`; `flytt-jobb-sted.test.tsx` / `dagsseddel-flytt-jobb.test.ts` «O12 pkt 18». Arbeidstid-reiser lagret før merket (punkt 16) er arbeid og følger stille med.

## Dagsvisningen i attesteringen

1. Dagen står øverst som en dagsrad, hvert kort er en blokk med egen kantfarge, og jobbrad vises når dagen har flere kort (alternativ A).
    Kenneth: «B14 A. men ved flere prosjekter samme dag, da må vi visuelt skille hvert registrerte kort fra hverandre innenfor samme dag» (2026-11-17), «Alternativ A viser tydelig skille på dagskortene. Det kortet er de beste av alternativene» (2026-11-22).
    ✅ `AttesteringTabell.tsx` (`variant: "dag"`, `variant: "jobb"`, `KORT_KANT`).
2. Dagsraden og jobbraden viser prosjektets navn, og under det byggeplass · underprosjekt, i stedet for prosjektnummeret (skisse B14c variant B, `docs/claude/skisser-web-timeforing/b14c-b.png`).
    Kenneth: «ingen av forslagene viser tydelig hvilket prosjekt/byggeplass kortene er registrert på … det er selvsagt prosjektnavn vi må vise» (2026-11-22), «Variant B» (2026-11-22).
    🟡 I dag viser dagsraden og jobbraden pr.nr. og underprosjekt (`TIMER_TABELL_STANDARD`: `prosjektnummer`, ingen `prosjekt` eller `byggeplass`).
3. Reise og overtid står som egne kolonner, «Reise» og «Overtid», ved siden av Timer: dagens timer i dagsraden og jobbens i jobbraden. Reise- og overtidslinjene har lønnsartens navn i farget merke og timetallet i samme farge, og dagens sum står hel (skisse B14c variant B).
    Kenneth: «det kommer dårlig frem på kortet overtid og reisetid. dette er områder som må komme mer tydelig frem», «Variant B -> der ser jeg med en gang på topplinjen hva jeg godkjenner» (2026-11-22).
    🟡 I dag (test, uke 47): overtiden er en vanlig linje med lønnsartens navn («Overtid 50%»); reisen står som grå «reise 3,00 t» i jobbraden, og reiselinjas tekst kuttes («Reise/transport til prc»); dagens sum kuttes fra 10 timer («11,…», `ATTESTERING_BREDDE.timer`).
