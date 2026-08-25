# Gate-kvittering — AM ordre 2 steg 2 (D3 pivot-visninger) + oppfølgingsordrer

**Fra:** fabel · **Dato:** 2026-08-24 · **Status:** DESIGNGATE BESTÅTT — Timer-sporet kan lukkes

## Grunnlag

1. **Kodegate** (2026-08-23, på develop 4aefe8d1 lokalt): visningsvelger på eksisterende side ✓ · gjenbrukt uke-nav ✓ · begge pivoter med ekspander ✓ · norm-kolonne med semantisk riktig avviksmarkering (ført vs. beregnet overtid, `beregnUkeAvvik`/`overtidsgrunnlag`) ✓ · celle-klikk → sedel-detalj ✓ · batch per pivot-rad ✓ · read-only i Attestert-fanen ✓.
2. **Avvikssak løst:** (b) vedtatt og målt av kontrollplan — avviksbadgen regnes på unionen sent+accepted (begge datasett allerede lastet, page.tsx:155), radvisningen forblir fanevis. Halv-ukes-grunnlaget som kunne gitt falskt «overtid ført under norm» er dermed lukket.
3. **Skjermbilder fra test (2026-08-23/24, Kenneth):** Sedler-lista med katalogdata (bf2bf475 verifisert — ingen «—»-rader) · Per prosjekt-pivot med ekspanderte ansattrader · Per ansatt-pivot med norm-kolonne og badges («overtid ført under norm», «+4.5 t over norm») · celle-hover med lønnsart/aktivitet/underprosjekt · sedel-detalj via celle-klikk.
4. **Kenneth-verifisert i bruk:** «Attesteringen er mye bedre — hover fungerer. Greit å beholde uten videre forbedringer.»

## Småfeil fra kodegaten

UUID-fallback (`projectId.slice(0,8)`) og død `title=""` — bestilt rettet i samme commit som (b). Rettecommit-hash er ikke meldt til meg; bildene viser fungerende badges, så gaten holdes ikke åpen på dette. Kontrollplan melder hashen for ordens skyld.

## Oppfølgingsordrer bekreftet levert (synlig i test 24.08)

- Kollaps alle / Utvid alle / **Krever vurdering**-knapper ✓ — avvikssedler utvidet automatisk ved lasting (Kenneth-vedtak 23.08) ✓
- URL-tilstand: `?visning=prosjekt&uke=-1&fane=sent` ✓ — «Tilbake til oversikt» skal returnere til denne tilstanden
- «Denne uka»-snarvei ✓
- Pivot-hover med lønnsart/aktivitet ✓

Gjenstår i dagskort-ordren (hos dokgen): hover-kort på **navn** i Sedler-lista (komprimert dagsseddel: beskrivelse, maskinrader under sin timerad, tillegg, utlegg, T.11-linje per kort), portert fra mobilens MaskinRadVis-vokabular.

## Konklusjon

D3-gaten er lukket. Timer-sporet kan lukkes fra designsiden. Neste prioritet per cowork: fix/mobil-uploadasync-0byte (datatap, umerget og uverifisert) — den bør ikke stå bak flere designrunder; det er verifisering, ikke design.
