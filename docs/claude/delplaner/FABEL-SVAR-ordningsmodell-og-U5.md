# Fabel-svar — ordningsmodellen (Kenneths presisering) + U5-godkjenning — 2026-08-11

To saker: designgodkjenning U5, og svar på de fire ordningsspørsmålene.
U4 er i develop, ikke prod, og null `fakturert`-rader er ført — vi endrer nå,
billig, i stedet for å stemple flere rader mot feil modell.

---

## U5 — GODKJENT, klar for prod

- **Inline-upsert i stedet for fjern+legg-til: riktig beslutning, riktig
  begrunnelse.** Vinduet der prosjektet faller tilbake til firma-default ville
  produsert immutable feilstempler som bare kan rettes med korreksjonsrad.
  Integritetsbæreren forplikter flatene rundt seg — dette er presedens for alt
  som senere rører `ordningVedFoering`.
- Immutabilitets-teksten godkjennes ordrett, inkludert attesterings-setningen.
- Prosjektadmin-lesevisningen med kilde oppfyller kravet fra specen.
- Ett vilkår: upsert-garantien (samme overstyring-id gjennom endring) skal ha
  en test, ikke bare API-verifisering — den er det som hindrer at noen senere
  «forenkler» tilbake til delete+create.

---

## Ordningsmodellen — beslutninger

### 1. `sats` splittes IKKE — den omdøpes, og «statens satser» blir utlegg

Kenneths punkt 3 er en `SheetUtlegg`-rad: regning med beløp, kvittering,
eksport til refusjon («samme som 2»). Det er ikke en ny ordning og ikke en ny
bærer — det er en **utleggskategori der beløpet er beregnet fra en sats**, med
én ekstra egenskap: mulig skatteplikt (se pkt 4).

Homonymet er det som skal bort, ikke bæreren:
- Ordningen som bæres av `SheetTillegg` (skifttillegg 30 %, antall × lønnsart)
  omdøpes **`sats` → `lonnstillegg`**. Navnet sier nå hva det er; serverens
  avvisning («føres som lønnstillegg, ikke utlegg») blir selvforklarende.
- Utleggskategorier får valgfri markering **`satsbasert`** (kjøregodtgjørelse,
  diett). Den endrer ikke bæreren eller eksporten — den styrer UI (satsfelt/
  beregningshjelp i stedet for fritt beløp) og følger eksporten som metadata.

To bærere med samme navn var feilen; to navn for to bærere er fiksen.

### 2. `fakturert` FJERNES fra tilbudte ordninger nå — gjeninnføres som varsel

Kenneth har aldri bestilt den, ingen rader er ført, og i dagens form er den en
registrering uten mottaker — data som forsvinner ut av økonomiflyten er verre
enn ingen registrering, fordi den gir falsk trygghet om at «det er meldt».

- U4/U5: `fakturert` tas ut av valgbare ordninger. Enum-verdien kan stå i
  skjemaet (additiv historikk-sikkerhet), men ingen kategori kan settes til den.
- Gjeninnføring skjer først når varselet finnes, som **opt-in per firma**
  (firma-innstilling, default av — Kenneths eksplisitte krav), under nytt navn:
  **`fakturavarsel`** («leverandørfaktura kommer — til orientering for leder»).
  Registrering uten bygget varsel skal ikke kunne aktiveres.

### 3. Navn

Besvart over: `fakturavarsel` når den kommer tilbake. `fakturert` gjenbrukes
ikke — Kenneth misleste det, og da misleser firma-admins det også.

### 4. Skattepliktighet: SiteDoc registrerer grunnlag, aldri avgjørelse

Kenneth: «Bestemmes av regnskap.» Da skal SiteDoc ikke ha et felt noen i
SiteDoc *avgjør* — men eksporten må bære nok til at regnskap KAN avgjøre:
- På **kategorien**: markering `mulig_skattepliktig` (settes av firma-admin,
  typisk på satsbaserte kategorier). Ren flagging, ingen beregning.
- På **raden**: ingenting nytt. Beløp, kvittering og satsgrunnlag er der.
- I **eksporten**: markeringen følger med per linje, slik at PowerOffice/
  Visma-siden ser hvilke linjer som krever vurdering.
Skatteberegning i SiteDoc er eksplisitt UT av scope.

### Kontonummer per firma

Bestilles: felt i firma-innstillinger (`refusjonsKontonummer` e.l., fri
tekst/kontostreng, valideres løst), følger refusjonseksporten. Ingen kobling
til lønnssystem — dette er regnskapssporet.

### Eksportmål (coworks D)

Kenneths presisering flytter refusjonseksporten til **regnskap** (PowerOffice/
Visma), adskilt fra Proadm/lønn. Det bekrefter at U2-utsettelsen var riktig —
og at eksport-designet er en EGEN ordre når modellen over er landet: format per
mottaker, kontonummer og skatteplikt-markering som linjefelter. Ikke start den
implisitt som del av denne oppryddingen.

## Rekkefølge

1. U4-justering i develop (fjern `fakturert` fra valgbare, omdøp `sats` →
   `lonnstillegg` i enum/UI, `satsbasert`-markering på kategori).
2. Firma-innstilling kontonummer + `mulig_skattepliktig` på kategori.
3. Eksport-ordre skrives separat mot dette (cowork utkast, fabel godkjenner).
4. `fakturavarsel` backlogges til varselmekanisme er designet.

— fabel (relayet av Kenneth)
