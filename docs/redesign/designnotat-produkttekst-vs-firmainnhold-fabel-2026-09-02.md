# Designnotat: Produkttekst vs. firmainnhold — seedede standardlabels

**Fra:** fabel · **Dato:** 2026-09-02 · **Status:** vurdering til Kenneth (vedtakspunkter nederst)
**Vedtak som ligger til grunn (Kenneth 2026-09-02):** «Vi oversetter det vi har skrevet. Kunden eier det kunden har skrevet.»

## 1. Faktagrunnlag (verifisert i kode)

- `REPORT_OBJECT_TYPE_META` i `packages/shared/src/types/index.ts` bærer de norske standardlabelene (`date_time.label: "Dato og tid"` osv.).
- Malbygger seeder nye felt med `label: meta.label` (`MalBygger.tsx` ~linje 485) — labelen KOPIERES inn som data i malen ved opprettelse. Ingen kobling tilbake til META beholdes.
- `FeltWrapper.tsx` rendrer `objekt.label` rått; oversettelse skjer kun on-demand via Globe-knappen (`oversettelser?.[objekt.label]` — et oppslag original streng → oversatt streng).
- **i18n-nøklene finnes allerede.** `malbygger.datoOgTid: "Dato og tid"` m.fl. ligger i `packages/shared/src/i18n/nb.json` og er oversatt i alle 17 språkfiler (palettens egne labels). Gjenkjenningsveien krever altså INGEN nye oversettelser — bare en mapping type → eksisterende nøkkel.
- **Mønsteret er bredere enn feltlabels:** `traffic_light.defaultConfig.options` seeder «Godkjent / Anmerkning / Avvik / Ikke relevant» som data i `config.options`. Samme gjelder andre standard-opsjonssett. Enhver løsning som bare tar feltlabelen løser halve problemet.

## 2. De to veiene, vurdert

### Vei A — gjenkjenning ved rendering (anbefales)

Renderregel: `label === standardstreng for felttypen ? t(nøkkel) : label`. Delt oppslagstabell i `@sitedoc/shared` (FLATEPARITET: web, mobil og PDF leser samme tabell).

**«Falsk positiv»-innvendingen er svakere enn den ser ut.** Treffer et firma-omdøpt felt eksakt «Dato og tid», får det den kuraterte, menneskelige oversettelsen av nøyaktig den norske frasen — aldri maskinoversettelse, aldri feil tekst. Skaden er null; forskjellen er bare at oversettelsen kommer automatisk i stedet for via Globe.

**Den reelle kostnaden** er at standardstrengene blir frosne identifikatorer: omdøpes en standardlabel i META senere, må den gamle strengen bli stående i tabellen som historisk alias (append-only), ellers faller gamle felt stille tilbake til norsk. Det er en disiplin, ikke en arkitekturpris.

**Gratis-gevinst:** redigerer firmaet labelen, matcher den ikke lenger → behandles som firmainnhold. Vei B's vanskeligste spørsmål (hva skjer ved redigering) besvares av likhetstesten selv, uten logikk i noen skrivesti.

Ingen migrering, ingen skjemaendring, virker retroaktivt for alle eksisterende maler.

### Vei B — nøkkel på feltet ved seeding

Presist på papiret, men: migrering av alle eksisterende maler (og prod-data vi ikke ser lokalt), skjema-/config-endring som må forstås av web + mobil + API + PDF, og invalideringslogikk («fjern nøkkelen når label redigeres») duplisert i hver skrivesti — malbygger har flere. Presisjonsgevinsten over A gjelder kun tilfellet der firmaets tilfeldig identiske tekst IKKE skal oversettes — et tilfelle der oversettelsen uansett er tekstlig korrekt.

**Anbefaling: A.** Rotårsaken er at seeding kopierer produkttekst inn som data uten opphav; A gjenoppretter opphavet ved eksakt match mot det vi beviselig selv skrev, uten å røre data.

## 3. Grenseprinsippet (svarer også datospørsmålet)

Operativ regel: **en streng er produkttekst hvis og bare hvis den byte-for-byte er en streng vi selv har skipet** (META, standard-opsjonssett, seed-defaults). Alt annet er firmainnhold — Globe-knappen, aldri automatisk.

Datospørsmålet faller på samme akse, men på den enkle siden av grensen: dato-VERDIER forfattes aldri av kunden — formateringen er alltid produktatferd og skal følge leserens språk/locale, som all annen produkttekst. Ingen gjenkjenning trengs; det er ingen kundestreng å forveksle med.

## 4. FLATEPARITET og PDF

Gjenkjenningstabellen legges i `@sitedoc/shared` så web, mobil og PDF anvender samme regel. Men PDF-en er fasit og arkivdokument: anbefalingen er at **oversettelse forblir en lesehjelp på skjerm** — PDF genereres på kildespråket som før. Det er konsistent med Globe-modellen (oversettelse vises, lagres aldri) og unngår at samme dokument arkiveres med språkavhengig innhold.

## 5. Avgrensning — bibliotekmaler

`seed-bibliotek.ts` og HMS-malene er også «skrevet av oss», men er domeneinnhold firmaet adopterer og redigerer — nærmere kundens eierskap enn produkttekst. Holdes UTENFOR i første omgang; egen sak hvis behovet melder seg. Grensen i § 3 gjelder da META + standard-opsjonssett, ikke alt vi noensinne har seedet.

## 6. Vedtakspunkter til Kenneth

- **V1:** Vei A (gjenkjenning ved rendering, delt tabell i shared) — ja/nei?
- **V2:** Standard-opsjonssett (trafikklys m.fl.) inkluderes i samme regel — ja/nei?
- **V3:** PDF forblir på kildespråk; oversettelse er skjermlesehjelp — ja/nei?
- **V4:** Datospørsmålet lukkes med samme prinsipp (verdi-formatering følger leserens locale) — ja/nei?

Ved ja på V1–V2 formulerer fabel ordre til redesign-Opus: oppslagstabell i shared (type → i18n-nøkkel + historiske aliaser), renderregel i FeltWrapper og mobil-ekvivalenten, verifisering mot «Dato og tid»-caset fra kontrollplanmålingen. Ingen migrering, ingen API-endring.
