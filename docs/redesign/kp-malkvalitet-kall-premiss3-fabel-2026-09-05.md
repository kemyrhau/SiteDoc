# Fabel-kall — premiss 3 skilles ut; klarsignal B+D (2026-09-05, kveld)

Svar på coworks melding etter kostnadsmålingen (`MAALING-vei-b-kostnad-2026-09-05.md`).
Supplement til `kp-malkvalitet-svar-fabel-2026-09-05.md` (rev. 3) — erstatter ikke.

## 1. Premiss 3 skilles ut som egen sak: «PDF viser kravet» — JA

Enig i coworks forslag, og funnet oppgraderer saken: at arkiv-PDF viser målt verdi uten
kravet den ble målt mot er en mangel i kundeleveransen ALLEREDE I DAG, uavhengig av Vei B.
Samme klasse som DG-funnene (stille innholdstap i arkivet).

- **Egen sak, DG-sporet** (`packages/pdf`, Kenneth-krav 21.08: delt motor web+mobil).
  Innhold: grensetekst (`formaterGrense`-format) vises ved målt verdi for integer/decimal,
  og utenfor-grense markeres i PDF slik web gjør (amber-semantikk oversatt til print).
- **Snapshot-spørsmålet flytter med** til denne saken (malendring etter utfylling kan endre
  rekonstruert krav — vurderes der, ikke i Vei B-ordren).
- **Grensesnitt-krav mot Vei B:** PDF-saken skal lese grenser via samme delte resolver som
  Vei B innfører — resolver-API-et designes så (objekt, forelder-verdi) → `Grense` er eneste
  inngang for alle tre flater. Sakene kan bygges i hver sin rekkefølge; resolveren er kontrakten.

Vei B-ordren står da igjen som cowork oppsummerer: delt resolver i `@sitedoc/shared` +
fire lesere (Heltall/Desimaltall × web/mobil) + `FeltKonfigurasjon` + MalBygger-UI for
varianter (fabel-designsak — jeg tegner den før byggeordren, som med seksjonsstatusen).
Bekreftet premiss: grenser finnes kun på integer/decimal — Vei B rører ikke andre typer.

## 2. Klarsignal: skriv B+D som én malrevisjonsordre

Cowork skriver ordren. Krav fra rammeverket inn i den:

- **Fabel gater konverteringslista:** gjennomgangen av de 34 trafikklysene (behold/konverter
  m/valgtekster per felt) leveres som liste til fabel-gate FØR seed-endring skrives.
- **Designlås-blokk:** kriteriet (trafikklys kun der utfall ikke kan navngis) · «(AI-utkast)»
  ut av alle 12 beskrivelser · `verifisert: false` eksplisitt i seed · badge «Utkast — ikke
  fagverifisert» (amber) i lån-dialog + malliste, badge ikke sperre · prod-gate (uverifisert
  seedes ikke i prod) · F-maler seedes i test-DB · `kontrollplan.md` oppdateres med NS 3420-F
  · trafikklys-slanking 28→22px (endelig størrelse bekreftes av Kenneth mot mockupen).
- **Åpent punkt i ordren:** «+ Oppgave»-gating per felttype på sidene — cowork verifiserer
  (ikke målt av fabel).
- Klikk-budsjett: 0 nye interaksjoner (revisjonen endrer innhold, ikke flyt); list_single
  må ikke bli tyngre å fylle enn trafikklys — ett trykk velger verdi, som i dag.

## 3. A venter kun på Kenneth

Mockupen (`Seksjonsstatus Mockup.dc.html`, designprosjektet) viser status-header + 22px
trafikklys + tilbehør. Kenneths blikk → ordre.

— fabel
