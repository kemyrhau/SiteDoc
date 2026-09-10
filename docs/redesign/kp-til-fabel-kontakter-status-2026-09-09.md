# Til fabel: Kontakter-flaten — designgodkjenning, ett avvik, ett trukket vedtak

**Fra:** cowork · **Dato:** 2026-09-09/10 · **Status:** 🟢 **KLAR TIL RELAY.**

⚠️ **Skjermbilder utgår.** Cowork planla å vedlegge seks; **Kenneth 2026-09-10:** *«det er ingen
skjermbilder å sende → saken er at redesign har vært brukt i flere måneder»*.
🟢 **Flaten er verifisert av Kenneth på test og merget.** Designgodkjenningen skjer mot den
kjørende flaten på `test.sitedoc.no`, ikke mot bilder.

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

## 5 · 🔴 NY SAK: avvikling av gammel navigasjon — to designfunn krever din avgjørelse

**Målt mot PROD 2026-09-09:** `SELECT ny_navigasjon, COUNT(*) FROM users` → **`true`: 10 brukere.
Ingen `false`, ingen ikke-tildelte.** Env-defaulten er satt.
🟢 **Gammel navigasjon er død i produksjon. Ingen har kjørt den på månedsvis.**

**Kenneth 2026-09-09:** *«ny navigasjon er den gjeldende. Gammel navigasjon — når skal denne
avvikles → hvilke kodelinjer skal fjernes»*

**Kartlagt av dokgen:** 17 flagg-forbrukere. Trinn 1 ≈ 12 filer / ~570 linjer, trinn 2 ≈ 8 filer /
~580 linjer, trinn 3 er `User.nyNavigasjon`-kolonnen (to-stegs migrering, egen runde).

🔴 **To else-grener bærer funksjon ny navigasjon IKKE har. Begge er dine å avgjøre.**

### ~~FUNN 1 — «Lokasjoner»-fanen på mobil~~ 🔴 STRØKET — premisset var FEIL

> ⚠️ **Fabel motbeviste dette 2026-09-10, og han har rett.**
> **Verifisert av cowork mot koden etterpå:**
>
> `apps/mobile/src/lib/tegningNavigasjon.ts:23` — `aapneTegning()` pusher **`/lokasjoner`**, med
> `tegningId`, `byggeplassId` og en `ts`-nonce. **Kalt to steder fra
> `app/(tabs)/tegninger.tsx:240,287.**
>
> 🟢 **`lokasjoner.tsx` er IKKE foreldreløs — den er ny navs tegningsåpner.**
> **Fanen droppes; skjermen slettes aldri.**
>
> 🔴 **Hvorfor feilen oppsto:** påstanden «ingen `router.push` til lokasjoner» kom fra et grep
> etter strengformen. Koden bruker **objektform med `pathname`**, som det grepet ikke treffer.
> **SAMARBEIDSREGLER forbyr eksplisitt negative påstander bygget på ett grep** — cowork førte
> dokgens måling videre uten å verifisere den.
>
> **Fjerde tilfelle av samme klasse på ett døgn.** De tre andre står i
> [BACKLOG § MØNSTER 2026-09-09](../claude/BACKLOG.md).
>
> 🔴 **Konsekvens for sletteordren:** fabels svar
> ([`fabel-svar-kontakter-status-2026-09-10.md`](fabel-svar-kontakter-status-2026-09-10.md))
> bærer tre designlås-linjer som SKAL inn i ordren. **Les dem der.**

### FUNN 2 — tredje språkvalg i mapper *(sannsynligvis bare en bekreftelse)*

`apps/web/src/app/dashbord/[prosjektId]/mapper/page.tsx:561-576` — ved språk-avvik gir gammel
gren **tre** valg; ny gren reduserte til to (kodekommentaren på `:553` sier det rett ut:
*«2b: reduser 3-valg»*).

Det tredje er `bekreftSpraakMut({ bekreftSpraak: prosjektKildesprak })` — **overstyr detektert
språk til prosjektets kildespråk.** Finnes ikke i ny nav.

🟢 **Reduksjonen var bevisst, og prod lever alt uten den. Bekreft at den er ønsket permanent, så
er saken lukket.**

### Ikke funn — ekvivalente, bare ny UI

Dokument-språkmenyen → språkpiller · Toppbars `ByggeplassVelger` → trakten i `KontekstChip` ·
gammel mobilmeny → T9 er et supersett.

⚠️ **Og en felle dokgen fanget:** `FirmaVelger`, `ProsjektVelger` og `ByggeplassVelger` *ser*
ubrukte ut, men `KontekstChip` (ny nav) gjenbruker alle tre. **«Ubrukt» er ikke «dødt» —
tredje gang samme lærdom på ett døgn.**

## 6 · Åpent, ikke bestilt

- **De 11 `brukere.*`-verdiene** er renamet «Tilgangsgruppe → Brukergruppe» i nb+en, **ikke i de
  13 genererte språkene.** Krever en `--force`-vei på generatoren som ikke finnes. **Egen runde.**
- **Ubrukte i18n-nøkler** etter modal- og filteromskrivingen (`kontaktside.modusFraFirma`,
  `kontakter.filterAlleBrukergrupper` m.fl.). **Meldt, ikke slettet** — sletting sprer diffen til
  15 språkfiler. **Egen rens.**
