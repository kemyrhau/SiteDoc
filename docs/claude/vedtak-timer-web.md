---
status: aktiv
sist_verifisert_mot_kode: 2026-11-22
avhenger_av:
  - SAMARBEIDSREGLER.md
---

# Vedtak — timer på web

Hva timeføringen på web **skal** gjøre, vindu for vindu, med Kenneths ord. Reisevinduet er ført og står bare her.
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
Filer: `RK` = `apps/web/src/app/dashbord/timer/[id]/ReiseKort.tsx` · `MR` = `apps/web/src/hooks/useManuellReiseWeb.ts` · `RM` = `packages/shared/src/utils/reiseManuell.ts` · `RT` = `apps/web/src/app/dashbord/timer/[id]/reise-terskel-dialog.test.tsx`.

1. Arbeideren velger «Til byggeplass» eller «Fra byggeplass»; kjøring til et annet kontor har ingen egen reisetype.
   Kenneth: «Ja, samme regel» (kontorkjøring som all annen kjøring).
   ✅ `RK` `valgKnapp`, `timer.reiseKort.tur` / `retur`.
2. Har firmaet flere kontorer, kan arbeideren selv sette et midlertidig oppmøtested med «Fra et annet kontor fra i dag» og avslutte det med «Avslutt».
   Kenneth: «1A».
   ✅ `RK` `reise-annet-kontor`, `avsluttOverforing`.
3. «Hvor kjørte du til?» (ved retur «Hvor kjørte du fra?») er fylt ut fra jobben, og arbeideren kan bytte prosjekt og byggeplass.
   Kenneth: «Arbeideren bestemmer hvor reisen føres», «jeg trenger å endre prosjektet reisen går til/fra», og om returen: «i utgangspunktet fra prosjektet man drar fra … derfor må man kunne velge andre løsninger».
   ✅ `RK` `hvorTil` / `hvorFra`, `reise-prosjekt`, `byttProsjekt`, `RadByggeplassFelt`.
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
   Kenneth: «nå kan ikke reisekortet endre tid» (om bygget som skjulte feltene), og svaret på inventaret: «S1 ja, S2 nei (behold avrundingen, rett teksten), S3 ja, S4 ja, S5 ja, S6 ja» (S1 = «Arbeidstid» i reisevinduet som før O8; S2 = avrundingen av reiseforslaget beholdes, forslagsteksten rettes; S3 = «Bytte til reisetid?» beholder rettede tider; S4–S6 gjelder andre vinduer).
   ✅ `RK` `arbeidKortId`, `timer.reiseKort.underTerskelPaaJobb` / `overTerskelPaaJobb`.
9. Er turen over firmaets terskel og «Arbeidstid» er valgt, spør vinduet «Bytte til reisetid?»; trykket bytter bare valget, og tider arbeideren har rettet, står.
   Kenneth: «vi bør foreslå når reisen er lengre enn 30 minutter -> "bytte til reisetid?"», grensen er firmaets terskel.
   ✅ `RK` `overTerskelSporsmaal`, `byttTilReisetid` (bytter bare `kategoriValg`, så `rettetStart` og `rettetSlutt` står).
10. Forslaget til reisetid rundes til firmaets tidsrunding og aldri ned til 0, «Forslag: X min kjøring» viser de samme minuttene, og det arbeideren selv skriver, rundes ikke.
    Kenneth: «0,07 timer ved lønnsutbetaling avrundes til nærmeste 0,5 timer», «S2 nei (behold avrundingen, rett teksten)».
    ✅ `MR` `rundKjoretidForslag`, `løsReiseKortAvrundet`. Teksten: `MR` `forslagMin`, `RK` `timer.reiseKort.forslag`.
11. Arbeideren kan velge underprosjekt for reisen; feltet er valgfritt og fylt ut fra jobben.
    Kenneth: «vi mangler også underprosjekt», «prosjekt / byggeplass / valgfritt valg -> underprosjekt».
    ✅ `RK` `ecoId`, `timer.felt.underprosjekt`. Med «Arbeidstid»: `RT` «O10 — Arbeidstid i reisevinduet som før O8».
12. Før lagring sier vinduet hvor reisen havner: «Står i jobben på …», «Står i kortet på …» eller «Får eget kort på …».
    Kenneth: «Reise til annet prosjekt må på eget kort», og «2A» (reise ført alene blir i sitt eget kort).
    ✅ `RK` `havnerTekst`, `MR` `reiseHavnerI`.
13. Er «Lagre» sperret, sier en rød tekst hvorfor: lønnsart mangler, kjøretid mangler, reisen går over midnatt, tidsrommet overlapper, slutt er før start, eller oppmøtested er ikke valgt.
    Kenneth: svaret på inventaret (punkt 8) gjelder at tekstene vises også med «Arbeidstid». Selve sperrene har ikke Kenneths ord i planen eller `timer.md`.
    ✅ `RK` `SPERRE_NOKKEL`, `tidSperre`. Med «Arbeidstid»: `RT` «O10 — Arbeidstid i reisevinduet som før O8».
14. Mangler firmaets kjøretid for strekningen, eller har reisen ingen byggeplass, viser vinduet ingen tidsfelt, og reisen kan ikke føres.
    Kenneth har ikke sagt hva som skal skje når det ikke finnes noe forslag. Sperren er eldre enn tidsfeltene.
    ❓ `RM` `manglerKjoretid`; `RK` skjuler tidsfeltene ved `sperre`.
15. Bytter arbeideren retning, kontor, prosjekt eller byggeplass, forkastes tidene han har rettet, antallet og valget i «Føres som».
    Kenneth har bare sagt det om «Bytte til reisetid?» (punkt 9).
    ❓ `RK` `nullstillTider`.
