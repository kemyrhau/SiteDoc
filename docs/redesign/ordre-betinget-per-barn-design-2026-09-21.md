# Ordre: betingede felt per barn — utløsere på barnet, ikke bare på forelderen

**Til:** cowork velger agent (app-sporet) · **Fra:** design · **Dato:** 2026-09-21
**Branch-forslag:** `feat/betinget-per-barn` fra `origin/develop`.
**Gatet av Kenneth 2026-09-21:** «App-endringen er den egentlige løsningen.»
**Bakgrunn:** `docs/redesign/designnotat-betingede-felt-design-2026-09-21.md` og mal-Opus' måling 2026-09-21.

---

## 1. Funnet

Mal-Opus stoppet før bygging og målte. Design har verifisert i koden.

`conditionValues` er en egenskap ved **forelderen**, aldri ved det enkelte barnet:

| Fil | Hva |
|---|---|
| `apps/web/src/hooks/useSjekklisteSkjema.ts:324` | `triggerVerdier = forelder.config.conditionValues` |
| `apps/web/src/hooks/useOppgaveSkjema.ts:356` | samme |
| `apps/mobile/src/hooks/useSjekklisteSkjema.ts:650` | samme |
| `apps/mobile/src/hooks/useOppgaveSkjema.ts:649` | samme |
| `apps/web/src/components/malbygger/MalBygger.tsx:357-386` | `handleOppdaterBetingelseVerdier(parentId, …)` setter settet på forelderen |
| `apps/web/src/components/malbygger/FeltKonfigurasjon.tsx:422` | viser forelderens sett |

**Følgen:** ett enkeltvalg som forelder gir **ett** utløsersett som deles av alle barna. «Vis A når svaret er *ubundet*,
og B når svaret er *bundet*» er ikke uttrykkbart.

**Hvorfor det betyr noe:** hele mønsteret designnotatet bygger på — vis bare kravene for den typen som er valgt —
treffer denne veggen. Det gjelder asfalt (JH2), belegningstype (KD1), grøftetype (FD2), kumtype (UP1), hva som prøves
(UU1) og lagtype (FS2).

## 2. Hva som skal bygges

**Barnets eget utløsersett skal gjelde når det finnes, ellers arves forelderens.**

1. **Én delt funksjon** som avgjør synlighet, i `@sitedoc/shared` — for eksempel
   `erBetingelseOppfylt(forelder, barn, forelderVerdi)`. De fire hookene skal kalle den, ikke ha hver sin kopi. I dag er
   logikken duplisert fire steder, og det er slik den drifter.
2. **Semantikk:**
   - Har barnet `config.conditionValues` med minst én verdi: bruk barnets sett.
   - Ellers: bruk forelderens sett, nøyaktig som i dag.
   - `conditionType === "utenfor_krav"` (tallfelt-forelder som viser avviksfelt) skal virke som før. **Rør den ikke.**
   - Forelderens `conditionActive` styrer fortsatt om betingelsen gjelder i det hele tatt.
3. **Bakoverkompatibelt:** ingen eksisterende mal har utløsere på barn, så oppførselen skal være uendret for alt som
   finnes i dag. Det er kravet som skal testes hardest.
4. **Malbyggeren** må kunne sette utløsere per barn, og **må ikke** skrive over et barns sett når forelderen redigeres.
   Firmaer redigerer lånte maler; mister de barnas utløsere ved et uskyldig klikk, er mønsteret utrygt.

## 3. Dette skal måles, ikke antas (meld i leveransen)

1. **PDF:** hva skjer med et barn som aldri ble vist? Skrives det ut som ubesvart, eller utelates det? Design trenger
   svaret for å vurdere om arkivdokumentet blir misvisende.
2. **Mobil:** bekreft at et påkrevd, skjult felt ikke blokkerer innsending (design har målt at web hopper over skjulte
   felt i valideringen).
3. **Lånte firmamaler:** en kopi lånt før treet fantes, står flat. Bekreft at den ikke påvirkes.

## 4. Rammer

- Ingen endring i `packages/db/prisma` — malverktøyene bygges parallelt av mal-Opus og skal ikke røres her.
- Ingen nye felttyper. Ingen endring i hvordan `list_multi` virker.
- Prod-gaten røres ikke. Ingen migrering.

## 5. Definition of Done

1. Delt funksjon i `@sitedoc/shared`, brukt av alle fire hookene.
2. **Rød først:** en test som viser to søsken med hvert sitt utløsersett under samme forelder — den skal feile før
   endringen og være grønn etter.
3. Regresjonstest: eksisterende oppførsel (utløsere bare på forelderen) er uendret, og `utenfor_krav` virker som før.
4. Malbygger: utløsere per barn, og en test som viser at redigering av forelderen ikke sletter barnas sett.
5. De tre målingene i § 3 besvart.
6. **Tekstbevis:** en sannhetstabell generert fra koden — forelderverdi mot synlige barn — limt i leveransen. Ingen
   skjermbilder.
7. Gate-tall via `pnpm exec turbo run test --force`, web build og mobil typecheck.
8. Leveranse nederst i hovedtreets `relay/inbox-design.md` + «design har post».

Design gater mønsteret; cowork gater teknisk og merger. Når dette er inne, starter JH2-piloten på nytt — den er stanset
til da.
