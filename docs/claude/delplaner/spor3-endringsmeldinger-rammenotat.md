# Spor-notat: Endringsmeldinger som eget spor (spor 3) — flagget av Kenneth 2026-08-04

> Fra fabel. Løfter endringsmeldinger ut som eget designspor på lik linje med HMS-sporet.
> Dette er et FLAGG + rammenotat — designrunden starter ikke nå. Ingen Opus-ordre ennå.

## Bakgrunn

Endringsmeldinger er i dag innbakt i oppgaver (samme mønster som HMS-avvik: oppgave under
panseret). Kenneth: begrepene **endringsmelding / varsel / tillegg / regningsarbeid** hører til
økonomi — forhold som ikke dekkes av underskrevet konkurransegrunnlag. **Teknisk avklaring** og
**endringsordre** er del av samme løp. Dette trenger en egen designrunde.

## Sporinndelingen blir da

- **Fundament-ordre:** domene-wire (`oppdaterDomener`) — først, felles.
- **Spor 1:** Gruppe/dokumentflyt-oppsett (terminologi, kobling begge veier, gruppe-picker).
- **Spor 2:** HMS ↔ dokumentflyt (Funn E–G).
- **Spor 3 (NY, dette notatet):** Endringsmeldinger/økonomi ↔ dokumentflyt. Egen designrunde,
  planlegges etter samme lest som spor 2 (eget domene over oppgave-fundamentet), men med
  kontraktsjuridiske føringer som spor 2 ikke har.

## Kenneths flaggede spørsmål (skal avgjøres NÅR spor 3 starter — ikke nå)

1. **På hvilket nivå skal begrepet Endringsordre behandles?** (eget objekt, status på varsel,
   eller egen serie?)
2. **Hvordan kobles varsel og endringsordre?** Skal et innsendt varsel etablere en egen
   endringsordre-serie?
3. **Hva sier NS 8405, 8406 og 8407 om dette?** Standardene har ulike varslings-/svarregimer
   (bl.a. irregulær endring: entreprenør varsler → byggherre plikter å svare med endringsordre
   eller avslag). Må leses mot faktisk standardtekst før datamodell-beslutning.
4. **Kan krav om endringsordre ivaretas direkte i et innsendt varsel** — dvs. uten separat
   endringsordre-objekt?

## Føringer for designrunden (fabel)

- Spørsmål 1–4 avgjør DATAMODELLEN, ikke bare UI — derfor må NS-gjennomgangen (3) gjøres FØR
  nivå-beslutningen (1), og begge før skjermdesign. Rekkefølge: NS-notat → begrepsmodell
  (varsel/TA/EO/regningsarbeid og relasjonene) → Kenneth-vedtak → UI-skisse.
- Serie-/nummereringsspørsmålet (2) bør ses sammen med prefiks-sorteringen fra velger-v2 —
  samme naturlig-numeriske sammenlikning gjenbrukes.
- Lærdom fra HMS-sporet gjenbrukes: eget domene-perspektiv over delt fundament (retur-kontekst,
  egen seksjon i unifisert velger, perspektiv-vokabular) — ikke egen parallell app.

## Status

Backlog, eget spor. Uavhengig av spor 1–2; ingen blokkering noen vei utover fundament-ordren.
