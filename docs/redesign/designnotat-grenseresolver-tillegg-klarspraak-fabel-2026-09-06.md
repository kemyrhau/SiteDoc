# Tillegg til designnotat grense-resolver (0230) — krav uttrykkes i klarspråk, aldri symboler (Kenneth-funn 2026-09-06)

Kenneth: «mennesker oppfatter ulikt hvordan vi beskriver ting → det er ikke sikkert jeg ville
skrevet min, eller minimum eller >30 for minimum 30 cm.» Funnet gjelder MalBygger-UI-et (§ 2
i 0230-notatet) og skjerper det:

## Designlås-tillegg

- **Malbyggeren velger kravTYPE i klarspråk, ikke felter med symbolnavn:** nedtrekk
  «Krav til verdien»: *Minst … (minimum)* · *Høyst … (maksimum)* · *Mellom … og …* ·
  *Pluss/minus … fra 0*. Valget åpner kun de tallfeltene typen trenger — ingen min/maks-par
  der forfatteren må vite hvilket som skal stå tomt.
- **Live kvitteringslinje under konfigurasjonen**, generert av resolveren/`formaterGrense` —
  samme tekst som utfylling og PDF viser: «Vises som: krav ≥ 30 cm · avvik når målt verdi er
  UNDER 30». Forfatteren ser konsekvensen av valget umiddelbart, med retningen i klartekst.
- Symbolformen (≥/≤/±) forblir VISNINGSFORM i utfylling/PDF (kompakt, språknøytral,
  `formaterGrense` uendret) — men forfatteren skriver den aldri.
- Variant-tabellen (Vei B) arver kravtypen fra objektet; per-rad fylles bare tallene.
- Eksisterende maler: dagens min/maks/toleranse-config leses uendret av resolveren — dette er
  kun forfatter-UI; ingen datamodell-endring.

Mockupen (`Avviksfelt Mockup.dc.html`, panel 1) er oppdatert med kravtype-nedtrekk +
kvitteringslinje. Går inn i ordren som del av trinn 3 (MalBygger-UI).

— fabel
