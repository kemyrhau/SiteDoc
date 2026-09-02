# Designnotat: Produkttekst vs. firmainnhold — seedede standardlabels (v2)

**Fra:** fabel · **Dato:** 2026-09-02 · **Status:** v2 — V1/V2/V4 Kenneth-godkjent; V3 rebegrunnet uten «PDF er fasit»-premisset (avlivet, jf. retningslinjer/ui-standarder.md § «PDF-en er en godt målt REFERANSE, ikke en sannhetskilde»)
**Vedtak som ligger til grunn (Kenneth 2026-09-02):** «Vi oversetter det vi har skrevet. Kunden eier det kunden har skrevet.»

## Endringer fra v1

- § 4 omskrevet: V3 sto i v1 delvis på «PDF-en er fasit» — en generalisering cowork gjorde av to kontekstbundne Kenneth-utsagn, nå avlivet. Premisset er fjernet; V3 står på egne bein (se § 4). Gjennomgang av notatet: premisset var brukt ÉN gang, i § 4 — § 1–3 og 5 bygger på kodefakta og Globe-modellen og er uendret i substans.
- § 3 skjerpet per Kenneths presisering av V4: tidssone er en egen akse og følger PROSJEKTETS lokasjon, ikke leserens.

## 1. Faktagrunnlag (verifisert i kode)

- `REPORT_OBJECT_TYPE_META` i `packages/shared/src/types/index.ts` bærer de norske standardlabelene (`date_time.label: "Dato og tid"` osv.).
- Malbygger seeder nye felt med `label: meta.label` (`MalBygger.tsx` ~linje 485) — labelen KOPIERES inn som data i malen ved opprettelse. Ingen kobling tilbake til META beholdes.
- `FeltWrapper.tsx` rendrer `objekt.label` rått; oversettelse skjer kun on-demand via Globe-knappen (`oversettelser?.[objekt.label]` — et oppslag original streng → oversatt streng).
- **i18n-nøklene finnes allerede.** `malbygger.datoOgTid: "Dato og tid"` m.fl. ligger i `packages/shared/src/i18n/nb.json` og er oversatt i alle 17 språkfiler (palettens egne labels). Gjenkjenningsveien krever altså INGEN nye oversettelser — bare en mapping type → eksisterende nøkkel.
- **Mønsteret er bredere enn feltlabels:** `traffic_light.defaultConfig.options` seeder «Godkjent / Anmerkning / Avvik / Ikke relevant» som data i `config.options`. Samme gjelder andre standard-opsjonssett. Enhver løsning som bare tar feltlabelen løser halve problemet.

## 2. De to veiene, vurdert

### Vei A — gjenkjenning ved rendering (VEDTATT, V1)

Renderregel: `label === standardstreng for felttypen ? t(nøkkel) : label`. Delt oppslagstabell i `@sitedoc/shared` (FLATEPARITET: web, mobil og PDF leser samme tabell).

**«Falsk positiv»-innvendingen er svakere enn den ser ut.** Treffer et firma-omdøpt felt eksakt «Dato og tid», får det den kuraterte, menneskelige oversettelsen av nøyaktig den norske frasen — aldri maskinoversettelse, aldri feil tekst. Skaden er null; forskjellen er bare at oversettelsen kommer automatisk i stedet for via Globe.

**Den reelle kostnaden** er at standardstrengene blir frosne identifikatorer: omdøpes en standardlabel i META senere, må den gamle strengen bli stående i tabellen som historisk alias (append-only), ellers faller gamle felt stille tilbake til norsk. Det er en disiplin, ikke en arkitekturpris.

**Gratis-gevinst:** redigerer firmaet labelen, matcher den ikke lenger → behandles som firmainnhold. Vei B's vanskeligste spørsmål (hva skjer ved redigering) besvares av likhetstesten selv, uten logikk i noen skrivesti.

Ingen migrering, ingen skjemaendring, virker retroaktivt for alle eksisterende maler.

### Vei B — nøkkel på feltet ved seeding (forkastet)

Presist på papiret, men: migrering av alle eksisterende maler (og prod-data vi ikke ser lokalt), skjema-/config-endring som må forstås av web + mobil + API + PDF, og invalideringslogikk («fjern nøkkelen når label redigeres») duplisert i hver skrivesti — malbygger har flere. Presisjonsgevinsten over A gjelder kun tilfellet der firmaets tilfeldig identiske tekst IKKE skal oversettes — et tilfelle der oversettelsen uansett er tekstlig korrekt.

Rotårsaken er at seeding kopierer produkttekst inn som data uten opphav; A gjenoppretter opphavet ved eksakt match mot det vi beviselig selv skrev, uten å røre data.

## 3. Grenseprinsippet (svarer også datospørsmålet — VEDTATT, V4, med skjerping)

Operativ regel: **en streng er produkttekst hvis og bare hvis den byte-for-byte er en streng vi selv har skipet** (META, standard-opsjonssett, seed-defaults). Alt annet er firmainnhold — Globe-knappen, aldri automatisk.

Datospørsmålet faller på samme akse, men på den enkle siden av grensen: dato-VERDIER forfattes aldri av kunden — formateringen er alltid produktatferd. **Kenneths skjerping skiller to akser notatet i v1 ikke skilte:**

- **Språk og format** (månedsnavn, ukedag, 12/24-timers, tallformat) følger LESERENS språk/locale — det er presentasjon.
- **Tidssone** følger PROSJEKTETS lokasjon, ikke leserens. Et prosjekt i Tromsø viser Tromsø-tid for alle lesere, uansett hvor de sitter. Tidspunktet er et faktum om hendelsen på byggeplassen, ikke presentasjon — to lesere av samme dokument skal aldri se to ulike klokkeslett for samme hendelse.

## 4. PDF og oversettelse (V3 — rebegrunnet)

v1 begrunnet V3 delvis med «PDF-en er fasit». Det premisset er avlivet: PDF-ens utelatelser kan skyldes papirets begrensninger (kan ikke ekspandere, ingen mellomtilstander), ikke at innholdet ikke hører hjemme. V3 må derfor stå på egne bein — og gjør det, på tre:

1. **Et arkivdokument skal ikke ha språkavhengig innhold.** PDF-en arkiveres, deles og hentes frem ved tvist. Genereres den på leserens språk, finnes samme dokument i N varianter, og hvilken variant som arkiveres avhenger av hvem som trykket på knappen. Én artefakt, ett språk (kildespråket), uavhengig av generatoren.
2. **Globe-modellen sier det allerede:** oversettelse VISES, LAGRES aldri. En PDF er lagring. Å bake oversettelse inn i PDF-en ville bryte modellen produktet ellers følger konsekvent.
3. **Oversettelseskvalitet:** firmainnhold maskinoversettes on-demand som lesehjelp med den forståelsen. Å persistere maskinoversettelse i et arkivdokument gir den en autoritet den ikke har.

Merk grensen i argumentet: dette gjelder ARKIVERING, ikke visning. Skjermflatene kan og skal mer enn papiret (det er nettopp poenget i avlivingen av «PDF er fasit») — gjenkjenningsregelen i § 2 gjelder derfor fullt ut i web og mobil. PDF-en anvender samme delte tabell, men med kildespråket som mållanguage, dvs. i praksis uendret utgang.

Konsekvens for tidssone (§ 3): PDF-en viser prosjektets tid — som er samme regel som skjerm, så her er det full paritet uten unntak.

## 5. Avgrensning — bibliotekmaler

`seed-bibliotek.ts` og HMS-malene er også «skrevet av oss», men er domeneinnhold firmaet adopterer og redigerer — nærmere kundens eierskap enn produkttekst. Holdes UTENFOR i første omgang; egen sak hvis behovet melder seg. Grensen i § 3 gjelder da META + standard-opsjonssett, ikke alt vi noensinne har seedet.

## 6. Vedtaksstatus

- **V1** (vei A, gjenkjenning ved rendering): ✅ vedtatt.
- **V2** (standard-opsjonssett inkludert): ✅ vedtatt.
- **V3** (PDF på kildespråk; oversettelse er skjermlesehjelp): rebegrunnet i § 4 uten «PDF er fasit» — til Kenneths bekreftelse.
- **V4** (dato-verdier følger leserens locale): ✅ vedtatt, skjerpet — tidssone følger prosjektets lokasjon (§ 3).

Ved bekreftet V3 formulerer fabel ordre til redesign-Opus: oppslagstabell i shared (type → i18n-nøkkel + historiske aliaser), renderregel i FeltWrapper og mobil-ekvivalenten, tidssoneregel per § 3, verifisering mot «Dato og tid»-caset fra kontrollplanmålingen. Ingen migrering, ingen API-endring.
