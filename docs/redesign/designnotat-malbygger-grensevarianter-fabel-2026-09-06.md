# Designnotat — MalBygger-UI for betingede grenser (Vei B) + avviksfelt-utløser — fabel 2026-09-06

Siste designbrikke før DG + avviksfelt + Vei B kan bli ÉN ordre med ÉN resolver.
Mockup: `MalBygger Grensevarianter Mockup.dc.html` (designprosjektet) — tegnet i faktisk
panelbredde (w-72 = 288px) som designprøve. Kodegrunnlag verifisert 06.09:
`FeltKonfigurasjon.tsx` (grense-blokken), `grenseSjekk.ts`, `malbygger/CLAUDE.md`
(kontainer-/betingelsesmekanikk).

## Designlås

1. **Plassering:** alt bor i den eksisterende grense-blokken i FeltKonfigurasjon
   (integer/decimal) — ingen ny side, ingen modal. Panelbredden w-72 beholdes (mockupen
   beviser at det holder).
2. **kravType eksplisitt + klarspråk-nedtrekk** (allerede vedtatt, her låst i form):
   «Ingen krav / Minst … (minimum) / Høyst … (maksimum) / Mellom … og … / Innenfor ± …
   (toleranse)» erstatter dagens fire frie tallfelt. Kun tallene kravtypen trenger vises
   (ett felt; to for «Mellom»). Kvitteringslinje under: «Vises som ‘≤ 10 mm’ — avvik når
   målt verdi er over 10.» Config-nøkkel `kravType`; eldre data uten nøkkel infereres i
   `normaliserGrense` fra hvilke tall som finnes — ingen migrering, ingen seed-endring.
3. **kravType er felles for feltet — varianter overstyrer TALLENE, ikke kravets form.**
   Holder varianttabellen på én tallkolonne og resolveren triviell. Trengs ulik kravform
   per valg, er det to felt.
4. **Styrende felt:** nedtrekk med kandidater = `list_single`-felt i samme kontekst
   (samme forelder: rot mot rot, samme repeater mot samme repeater) med lavere sortOrder
   (verdien må finnes før tallfeltet i utfyllingen). Ingen kandidater → checkboxen
   disabled med hint-tekst.
5. **Varianttabell:** én rad per opsjon i styrende felt + fast siste rad «Ellers
   (standard)» som viser feltets eget tall (grå, ikke redigerbar der). Tom variantcelle =
   arver standard.
6. **Foreldreløse varianter** (opsjon omdøpt/slettet i styrende felt): raden blir stående
   som amber-merket linje «‘X’ finnes ikke lenger i <felt> · <tall>» med Fjern-knapp —
   aldri stille sletting. Resolver uten treff → standard.
7. **Resolver-kontrakt (delt, `@sitedoc/shared`):** `løsGrense(objekt, forelderVerdi) →
   Grense` — matcher styrende felts verdi mot varianter (normaliserOpsjon på BEGGE sider,
   jf. opsjon-normaliseringsregelen), ellers feltets standardgrense. Eneste inngang for
   web-utfylling, mobil-utfylling og PDF-oppslagsbyggeren (jf. designnotat-pdf-grensekrav
   0130 — `felt.ts` røres ikke).
8. **Config-nøkler (norsk kanonisk, som grense-nøklene):** `kravType`, `styrendeFeltId`,
   `grenseVarianter: [{ valg, min, maks, toleranse }]`. `enhet`/`desimaler` alltid felles.
9. **Avviksfelt-utløser:** checkbox «Vis felt ved verdi utenfor krav» på tallfelt med
   krav → feltet blir kontainer med ny utløsertype (ved siden av dagens
   `conditionValues`); barn dras inn som i dag (parentId — mekanikken finnes,
   cowork-målt). Betingelses-sonen bruker amber-kant (skiller fra valgliste-blå). Kun i
   MalBygger — utfylling/print/mobil viser ingen ramme (dagens regel).
10. **Semantikk uendret:** grenser er veiledende (amber), blokkerer aldri innsending —
    `valider()` røres ikke. «Ingen krav» skjuler begge bryterne.

## Klikk-budsjett

Vanligste handling (sette et maks-krav): i dag 2 interaksjoner (maks + enhet), etter
3 (nedtrekk + tall + enhet). Den ene ekstra kjøpes bevisst: eksplisitt kravType fjerner
min/maks-forvirringen og gir kvitteringslinjen. Betinget grense: +1 checkbox, +1 nedtrekk,
+N tall (ett per valg som avviker). Avviksfelt: +1 checkbox + drag per barn. Utfylleren
får null nye interaksjoner — avviksfeltene kommer av seg selv ved brudd.

## Enkeltmålt — cowork verifiserer i kost-sjekken

- Kandidatregelen (samme forelder + lavere sortOrder) mot repeater-rader: resolveren må få
  RADENS verdisett, ikke dokumentets — verifiser at utfyllingslaget kan gi forelder-verdi
  per rad på begge flater.
- Variant-matching når options er `{label, value}`-objekter (normaliserOpsjon begge sider).

## Svar til cowork (kø-bestillingen 06.09)

- **Ja — cowork skriver ordren.** DG + avviksfelt + Vei B som én ordre med én resolver.
  Designlås-blokk = dette notatet + `designnotat-pdf-grensekrav-fabel-2026-09-06.md`
  (0130, inkl. snapshot sidestilt med `verdi` — coworks måling tiltres) + avviksfelt-
  vedtakene (kravType eksplisitt, klarspråk m/kvitteringslinje).
- **Rekkefølgen tiltres:** (1) DG+avviksfelt+VeiB én ordre, (2) AG ansvarsgrensen,
  (3) FL prosjekt-livssyklus. Enig i FL-diagnosen: løftebrist, ikke manglende funksjon.

## TIL MASTERPLAN (tillegg — cowork fletter, aldri helfil)

- MK-raden, punkt C: «MalBygger-UI (fabel-designsak før ordre)» → «MalBygger-UI designet
  06.09 (`docs/redesign/designnotat-malbygger-grensevarianter-fabel-2026-09-06.md` +
  mockup i designprosjektet); cowork skriver samlet ordre DG+avviksfelt+VeiB».
- Rekkefølge 0b: «C (Vei B) etter MalBygger-UI-design» → «C (Vei B): design levert 06.09 —
  cowork skriver samlet ordre».
- Rekkefølge 0c (DG): tilføy «design + snapshot-kall levert 06.09; inngår i samlet ordre».

— fabel
