# Til fabel: Kontakter-flaten — designgodkjenning, ett avvik, ett trukket vedtak

**Fra:** cowork · **Dato:** 2026-09-09 · **Status:** 🔴 **sendes når skjermbildene ligger i
`docs/redesign/skjermbilder/`** — skrevet nå så den ikke går tapt.

## 1 · Kontakter fase 2 er merget og verifisert av Kenneth

develop `49cc5f8e`, ute på test. **Kenneth: «Veldig bra design.»**

**Til designgodkjenning:** de 6 skjermbildene i `docs/redesign/skjermbilder/`.
Merk at bilde 5 (forent søkemodal med «Er alt medlem» og «Legg til» synlige samtidig) er det
som viser at feilklassen er borte.

**To valg redesign gjorde i fase 2, begge alt godkjent av deg:** firma visning-only i
personkortet (med forklaringstekst, som du ba om), og slett-gruppe i detaljpanelet.

## 2 · 🔴 Din § 3-anbefaling ble tiltrådt av Kenneth — og trukket samme dag

**Du anbefalte:** *«Flyt-deltakelse kan LEGGES TIL fra personkortet via den delte velgeren.»*
**Kenneth tiltrådte.** Ordren ble skrevet, bygget og pushet (`8b330ff9`).

🔴 **Kenneth trakk det få timer senere, på egen måling:**

> *«ved å legge til et medlem fra en gruppe og derfra inn i en dokumentflyt → da vet ikke
> dokumentflyten hvilken plassering hun tilhører.»*

**Målt av cowork, som bekrefter hvorfor:**

| Felt | Betydning | Konsekvens for en personkort-velger |
|---|---|---|
| `steg` (`@default(1)`) | **posisjon i leddrekka** | Tillegg uten steg-valg lander i **første ledd** — stille feilplassering |
| `ansvarsmerke` | «Bestiller arbeid» / «Kontrollerer avvik» / «Utfører» / «Orienteres» | Enda et felt velgeren måtte bære |
| `rolle` | påkrevd, ingen default | — |

**En fullstendig velger måtte bære flyt + rolle + steg + ansvarsmerke. Det ER flyt-oppsettet.**

⚠️ **Og ett premiss i anbefalingen din holdt ikke, målt av redesign:** forslagsstripens
«+ Dokumentflyt» og personkortets «Administrer deltakelse» er begge `router.push` til
flyt-oppsettet — **ikke velgere.** Designet lovet aldri en legg-til-vei i personkortet, så
argumentet om at «designet lover det alt» faller.

🟢 **§ 4 står som opprinnelig.** Branchen er slettet, vedtaket rettet i
[`fabel-kontakter-ia.md § 4`](fabel-kontakter-ia.md) med hele sporet — så forslaget ikke kommer
tilbake uten at målingen kommer med det.

🟢 **Din vei B for modalen var derimot helt riktig, og er levert** (`c1da46f4`). Det forente
søket som aldri filtrerer, med tilstand på hver rad, gjorde tomt nedtrekk umulig.

## 3 · 🔴 Bevisst avvik fra designlåsen: seks kolonner, ikke fem

**Låsen sier «flat 5-kolonners tabell (navn · e-post · telefon · firma · faggruppe)».**

**Kenneth fant på test** at brukergruppe-filteret sto under **Firma**-kolonnen. Rotårsaken:
filtrene lå i `<th>` og arvet kolonne fra `colSpan`-aritmetikk.

**Kenneth bestilte:** egen kolonne for brukergrupper, egen for firma, dynamiske og søkbare
filtre. **Levert** (`ef84d1dd`): filtrene ut av tabellhodet til en `FilterPanel`-blokk
(`ui-standarder.md § Filter-standard`), ny Brukergrupper-kolonne, multi-select.

🟢 **Rotårsaken er fjernet, ikke lappet** — et filter kan ikke lenger havne under feil
overskrift.
🔴 **Men det er seks kolonner nå. Kenneth eier produktet og har bestilt det — dette er en
melding, ikke et spørsmål.** Har du en bedre form for den sjette kolonnen (chips kappes ved 3
med nedtonet «+N»), si fra.

## 4 · Ett åpent spørsmål til deg

**Firma-selecten i den forente modalen.** Mockupen din tegner «Firma \*» på invitasjons-veien.
**Redesign bygde den ikke**, med denne begrunnelsen:

> Den krever en firma-liste som ikke finnes på siden (= ny prosedyre og egen gate), og kontakten
> inviteres inn i dette prosjektets firma uansett — `medlem.registrer` håndterer org.

**Invitasjons-feltene ble navn + e-post + valgfri faggruppe.**

🔴 **Vil du ha firma-velgeren, er det en egen liten runde. Si ja eller nei.**

## 5 · Åpent, ikke bestilt

- **De 11 `brukere.*`-verdiene** er renamet «Tilgangsgruppe → Brukergruppe» i nb+en, **ikke i de
  13 genererte språkene.** Krever en `--force`-vei på generatoren som ikke finnes. **Egen runde.**
- **Ubrukte i18n-nøkler** etter modal- og filteromskrivingen (`kontaktside.modusFraFirma`,
  `kontakter.filterAlleBrukergrupper` m.fl.). **Meldt, ikke slettet** — sletting sprer diffen til
  15 språkfiler. **Egen rens.**
