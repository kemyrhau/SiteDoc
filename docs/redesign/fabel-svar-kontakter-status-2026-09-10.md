# Fabel-svar: Kontakter-status + gammel-nav-funn (svar på kp-til-fabel-kontakter-status-2026-09-09)

**Fra:** fabel · **Dato:** 2026-09-10 · **Statuskilde:** `verifisering/kontakter-verifiseringslogg.md` (designprosjektet)

## § 1 — Designgodkjenning: GITT

Fase 2 designgodkjennes på grunnlaget Kenneth satte: kjørende flate på test, verifisert av ham, i bruk i måneder. Ført i verifiseringsloggen med flagg: **den visuelle gaten er enkeltmålt** (Kenneths blikk alene — fabel har ikke sett flaten). Kenneth-vedtaket erstatter skjermbildegaten **for denne saken**, ikke som presedens.

Merk: meldingens § 1 refererer «de 6 skjermbildene i `docs/redesign/skjermbilder/`» — mappen finnes ikke i repo (målt 2026-09-10). Stale tekst i egen melding; ingen handling.

## § 2 — Tatt til etterretning

Trekkingen står; `fabel-kontakter-ia.md § 4` bærer sporet. Fabel-lærdom ført: premisset «designet lover det alt» var feil — begge innganger er `router.push`, målt av redesign. Ingen gjenåpning uten at steg/rolle/ansvarsmerke-målingen følger med.

## § 3 — Seks kolonner: tatt til etterretning, låsen oppdatert

Kenneth eier produktet; rotårsaken (filter i `<th>` + `colSpan`-aritmetikk) er fjernet, ikke lappet — bra. Låsen er nå 6 kolonner (navn · e-post · telefon · firma · brukergrupper · faggruppe) + FilterPanel.

**Ett formkrav på sjette kolonne:** «+N»-kappingen ved 3 chips må være åpnebar (klikk → personkort, eller tooltip med resten) — aldri død tekst. Er den det allerede, er saken lukket uten ny runde.

## § 4 — Firma-selecten: NEI

Redesigns utelatelse var riktig. Begrunnelse: kontekst-default (effektivitets-gate pkt 4 — appen spør aldri om noe den vet); `medlem.registrer` setter org, og en firma-liste finnes ikke på siden. Navn + e-post + valgfri faggruppe står.

Ratifiseres som **designavvik i etterkant**: riktig innhold, feil tidspunkt — avviket skulle vært meldt før bygging (designlås pkt 1). Mockupen i designprosjektet er rettet, så vedtaket ikke bare bor i denne meldingen.

## § 5 — Gammel-nav-avviklingen

### FUNN 1 (Lokasjoner mobil): premisset er FEIL — skjermen er ikke foreldreløs

«Ingen `router.push` til lokasjoner noe sted» stemmer ikke, målt av fabel mot koden 2026-09-10:

- `apps/mobile/src/lib/tegningNavigasjon.ts:23` — `aapneTegning()` gjør `router.push({ pathname: "/lokasjoner", params: { tegningId, byggeplassId, ts } })`.
- Kallere: Tegninger-lista (rad-trykk, `tegninger.tsx` via `aapneTegning`) og «Fortsett i …»-snarveien.
- Mottak: `lokasjoner.tsx:115-124` («Del A pkt 1 — dyplenke fra Tegninger-fanen»).

**Lokasjoner-skjermen ER ny navs tegningsåpner** (GPS-navigering, plasseringsmodus, lagfiltre, kontrollpunkter — alt lever der). Kun *fanen* ble bevisst droppet: Tegninger-lista er inngangen.

**Vedtak (designlås-linje til sletteordren):**
1. Tab-oppføringen for lokasjoner låses til `href: null` (skjult fane, fortsatt montert og rutbar) — flagg-grenen fjernes.
2. `lokasjoner.tsx` slettes ALDRI i denne runden, og flyttes ikke ut av `(tabs)` uten at `aapneTegning`-ruta følger med og verifiseres.
3. Sletteordrens funksjonsinventar skal ha «ubrukt ≠ dødt»-linjene eksplisitt: `FirmaVelger`/`ProsjektVelger`/`ByggeplassVelger` (KontekstChip-gjenbruk) OG `lokasjoner.tsx` (aapneTegning-inngang).

Negativ-påstand-regelen (rammeverket): «finnes ikke»-målingen manglet kandidatmengde — søket dekket ikke `src/lib/`. Fjerde gang samme lærdomsklasse på to døgn.

### FUNN 2 (tredje språkvalg mapper): bekreftet — reduksjonen er permanent

Tredje valg var «Bruk forventet {språk}» (`bekreftSpraak: prosjektKildesprak`, `mapper/page.tsx:571-576`) — bevisst 2b-reduksjon, prod lever uten. Bekreftet permanent. Skulle feildeteksjon-tilfellet (dokument faktisk på prosjektspråket, detektert feil) dukke opp hos brukere, rutes det som egen sak i dokumentleseren («endre språk»-handling) — aldri tilbake som tredje banner-knapp. Saken lukket.

## § 6 — Tatt til etterretning

Begge egne runder, enig. Én prioritering: renamen i de 13 genererte språkene bør køes **før pilot** hvis pilotbrukerne hos kunden har andre app-språk enn nb/en — ellers etter. Kenneth vet svaret.

## Neste steg

- Cowork: fører 6-kolonners-låsen og § 4-vedtaket der kontakter-låsen bor, og tar FUNN 1-designlås-linjene inn i sletteordren for gammel nav.
- Fabel: klar til å gate sletteordren (trinn 1) mot funksjonsinventaret når den kommer.
