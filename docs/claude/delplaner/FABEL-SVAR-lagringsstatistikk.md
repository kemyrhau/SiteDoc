# Fabel-svar — lagringsstatistikk som eget spor: JA. Form besvart. — 2026-08-11

Coworks forslag godkjennes: lagringsstatistikk er eget lite spor, foran
abonnementsordren. Kenneths lagringsbaserte arkivpris er riktig kobling —
prisen speiler den faktiske kostnaden i tilstanden der ingenting annet
brukes. De tre formspørsmålene:

## 1. Beregnet ved forespørsel FØRST — akkumulert kun hvis målt behov

Fase 1: **aggregering ved forespørsel** (`SUM(fileSize)` per prosjekt/firma,
gruppert per modell), med kort cache (f.eks. 1 time). Begrunnelse:
- Faktureringsbruken er månedlig avlesning — ingen trenger sanntid.
- En akkumulert teller er en invariant som må vedlikeholdes i HVER opplast-,
  slette- og korreksjonsvei, inkludert de tre vedleggsmønstrene som ennå
  ikke er konvergert. Å innføre telleren FØR vedleggskonvergensen er å bygge
  drift-divergens med vilje — tellere som glir fra sannheten er samme
  feilklasse som firmarolle-saken.
- Går aggregeringen tregt på ekte datamengder, er det et målt problem med
  kjent løsning (materialisert visning eller teller) — da tas den beslutningen
  på tall, ikke føre-var.

## 2. Filer teller; DB-innhold rapporteres, men prises ikke i v1

- **Fakturagrunnlag: kun filer** (`SUM(fileSize)` + objektlager når S2
  kommer). Det er det som koster serverleie, og det er tallet som kan
  forsvares overfor kunde.
- **Visning: DB-volum som sekundærtall** (radtelling per modell × grov
  snittstørrelse, merket «estimat»). Kenneths 50 000-sjekklistesvar-scenario
  skal være SYNLIG i registeret, men ikke prissatt i v1 — å prise estimater
  er å invitere til krangel. Blir DB-volum reelt kostnadsdrivende, revideres
  prisformelen — da med målt størrelse, ikke estimat.

## 3. Begge — men ulik hensikt og ulik detalj

- **sitedoc-admin:** full visning per firma × prosjekt × modell, med
  dekningsgrad (se under). Dette er fakturagrunnlaget og driftsinnsikten.
- **firma-admin:** eget firma, per prosjekt, kun totaltall filer. To grunner:
  (a) en kunde som skal betale lagringsbasert arkivpris har krav på å se
  tallet løpende FØR de havner i `stengt` — prisen skal aldri være en
  overraskelse; (b) det gir dem mulighet til å rydde selv (slette gamle
  prosjekter) — som er ønsket adferd i hele denne modellen.

## 🔴 Dekningsgraden er del av sporet, ikke en fotnote

Coworks advarsel opphøyes til krav i ordren:
1. **Diagnostikk først:** per modell — antall rader med `fileSize IS NULL` og
   andel. Kjøres på prod som første leveranse; tallet avgjør resten.
2. **Backfill:** null-rader får størrelse fra faktisk fil på disk
   (idempotent script, samme bevis-regime som firmarolle-Fase 0-SELECTen).
   Filer som ikke finnes på disk flagges — det er forøvrig gratis
   integritetssjekk av fillagringen (S1-sporet vil takke oss).
3. **Skriveveien tettes:** `fileSize` settes obligatorisk ved all ny
   opplasting (de fem modellene + eventuelle veier som i dag hopper over
   det). Vurder å stramme `Int?` → `Int` der backfillen når 100 %.
4. **Statistikken viser dekningsgrad** («98,2 % av filene har målt
   størrelse») til den er 100 % — et tall som ser presist ut uten å være det
   er verre enn ingen, nettopp som cowork sier. Fakturering mot tallet
   krever 100 % dekning i det firmaet.

## Rekkefølge

1. Cowork skriver eksport-ordren (upåvirket, klar nå).
2. Lagringsstatistikk-ordre (dette sporet): diagnostikk → backfill →
   tett skrivevei → aggregert visning i begge flater.
3. Abonnementsordren skrives når 2 er levert nok til at arkivprisen har
   grunnlag (diagnostikk + backfill holder; visningen kan gå parallelt).

— fabel (relayet av Kenneth)
