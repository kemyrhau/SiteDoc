# Tillegg til designkall byggeplassfilter — tegninger + Kenneths NB — fabel 2026-09-06

Tillegg til `docs/redesign/designkall-byggeplassfilter-fabel-2026-09-06.md` (1430).
Mockup utvidet med fjerde panel: «Hele prosjektet»-visningen.

## Tegninger — måling mottatt, vedtak

Coworks måling (0 av 9 byggeplass-løse i prod, men `Drawing.byggeplassId` nullbar +
hardt filter tegning.ts:57) lukker det enkeltmålte premisset: tilstanden finnes ikke i
dag, men er mulig, og en byggeplass-løs tegning ville forsvinne uten spor.

**Tiltres: tegninger tas i SAMME ordre.** Hardt filter mykes opp til dokument-formen
(`OR byggeplassId null`) + samme «Hele prosjektet»-badge. Regelen «et objekt vises der
det gjelder» gjelder dermed alle flatene den forklarer — enig i at den ellers er verdiløs.

## Kenneths NB — «listen viser ikke entydig hvor dokumentet hører hjemme»

**Han overser ingenting — det er funnet, presist formulert.** Radene bærer ingen
tilhørighet i dag, i noen visning. Og det gjelder ikke bare byggeplass-visningen:

**Regelen generaliseres (designlås):** *raden viser tilhørighet når konteksten er bredere
enn objektets hjem.*
- Byggeplass-visning: kun prosjekt-dokumenter merkes «Hele prosjektet» (grå) — flertallet
  av radene er hjemme og bærer ikke støy.
- «Hele prosjektet»-visning: HVER rad merkes — sin byggeplass (blå pille) eller
  «Hele prosjektet» (grå). Fjerde mockup-panel viser formen.

**Opprettelses-siden av NB-et** (hvor tilhørigheten SETTES): kontekst-default-regelen
gjelder — opprettes dokumentet mens en byggeplass er valgt, arver det den; opprettes det
i «Hele prosjektet», blir det prosjekt-dokument. Overstyrbart, aldri bekreftelsespørsmål.
⚠️ Cowork verifiserer i ordren at opprett-flytene faktisk setter byggeplassId fra kontekst
i dag — hvis prosjekt-dokumentene i prod (BEF2–4) er UTILSIKTEDE (opprettet før velgeren
fantes), er det en datarydding-sak i tillegg, ikke bare visning.

## TIL MASTERPLAN (tillegg — cowork fletter)

- Byggeplassfilter-vedtaket utvides: «… regelen generalisert 06.09: raden viser
  tilhørighet når konteksten er bredere enn objektets hjem (prosjekt-visning merker alle
  rader). Tegninger i samme ordre (måling 0/9, men tilstand mulig — hardt filter mykes).»

— fabel
