# Fabel-avgjørelse: modal-avviket (vei B) + personkort-flyt-spørsmålet

**Fra:** fabel · **Dato:** 2026-09-09 · **Svar på:** cowork-melding 09.09 (avvik i «Legg til medlem»-modalen, fase 2 merget 8f88e324)

## 1. Avgjørelse: **B — rett gruppe-modalen mot mockupen. Og Kontakter-modalen følger etter.**

Begrunnelse for at det forente feltet gjelder BEGGE kontekster:

- Ordren låste «delt invitasjonsmodal» — én modal, kontekst styrer kun forhåndsvalg
  (designlås pkt 10). To modaler med hver sin listelogikk er avviket, ikke to instanser
  av samme.
- Toggle mellom to lister med motsatt filter er strukturen som produserte bugen (coworks
  måling). Beholdes den i én kontekst, består feilklassen der.
- Det forente feltet trenger ingen filterbeslutning i det hele tatt: **søket går mot ALLE
  kontakter i prosjektet + firmaets folk**, og hver treff-rad sier selv hva som skjer:
  - allerede i gruppen → rad vises nedtonet, «Er alt medlem»
  - kontakt, ikke i gruppen → «Legg til» (én binding, `medlem.registrer`/oppdater-vei)
  - ingen treff → raden «Inviter {tekst} med e-post …» åpner feltene firma/faggruppe
- Tomt nedtrekk blir umulig: lista er aldri filtrert til tomhet, tilstanden står på raden.

Døp gjerne modal-tittelen etter kontekst («Legg til medlem i {gruppe}» / «Ny kontakt»), men
felt, søkelogikk og radtilstander er identiske. `TilgangsgruppeForModal`-typen forsvinner
antakelig i samme grep — meld hvis ikke.

## 2. Fase 2-valgene redesign gjorde

- **Firma visning-only i personkortet: godkjent.** Riktig kompromiss så lenge
  `medlem.oppdater` ikke tillater firma-endring — men da skal raden ha en forklaring
  («endres av administrator» e.l.), ikke bare mangle blyant. Småfiks, ikke blokkerende.
- **Slett gruppe i detaljpanelet, ikke på kortet: godkjent.** Destruktiv handling hører
  bak et bevisst klikk; kortet skal være les/naviger.

Designgodkjenning av de 6 skjermbildene kommer separat når de ligger i
`docs/redesign/skjermbilder/`.

## 3. Kenneths spørsmål: «legg til dokumentflyt» fra personkortet

Dette KOLLIDERER med designlås pkt 9 / Kenneth-vedtak § 4: flyt-deltakelse redigeres aldri
fra personkortet. Kenneth eier vedtaket og kan endre det — men det skal skje bevisst, ikke
som gliding.

**Fabels anbefaling: refiner vedtaket i stedet for å reversere det.**

- **TILLEGG fra personkortet: ja.** Forslagsstripene har allerede «+ Dokumentflyt»-knapper —
  designet lover altså alt en legg-til-vei utenfor flyt-oppsettet. En «+ Legg til i
  dokumentflyt» i personkortets flyt-seksjon som åpner samme velger (flyt → rolle →
  `medlem.registrer` m/`flytBindinger`) er konsistent med det, og serverveien finnes.
- **ENDRING og FJERNING: fortsatt kun i Dokumentflyt-oppsettet.** Det var § 4-vedtakets
  poeng (arvede koblinger kan ikke fjernes per person; én redigeringsplass per relasjon).
  Provenans-linjene forklarer fortsatt hvorfor.

Ny ordlyd hvis Kenneth tiltrer: «Flyt-deltakelse kan LEGGES TIL fra personkortet via den
delte velgeren; endring og fjerning bor i Dokumentflyt-oppsettet.»

## Åpent

- **Kenneth:** gate refineringen i § 3 (ja/nei) · gate B-omfanget hvis uenig i at Kontakter-modalen følger etter
- **redesign-Opus:** bygge B (begge kontekster) etter relay · småfiks firma-forklaring
- **fabel:** designgodkjenning av 6 skjermbilder når de er levert
