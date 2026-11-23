---
name: hms-domenemodell
status: 🟡 § HMS-flyt er Kenneths regler 2026-11-23, målt mot develop @ `cef5df0c` — fire målte avvik i koden, to spørsmål til Kenneth (H1, H2). § Firma-HMS er domenemodellen fra 2026-07-21 — to målte avvik mot kode, ett åpent spørsmål
eier: Kenneth (domenesannhet) · fabel (design) · orkestrator (bestiller kode)
sist_verifisert_mot_kode: 2026-11-23 (§ HMS-flyt, develop @ `cef5df0c`) · 2026-07-21 (§ Firma-HMS)
---

# HMS — domenemodell

> **Dette er domenesannheten arkitekturen skal forklares fra** ([domene-arbeidsflyt.md](domene-arbeidsflyt.md)-prinsippet). Kenneth 2026-07-21: *«så er det mange regler som har vært kommunisert tidligere som vi skal bygge etter. Ved avvik — diskuterer vi dette og løser avviket.»*
>
> Fila har to deler. **§ HMS-flyt** sier hvem som melder, hvem som behandler og hvem som får svaret i et prosjekt. **§ Firma-HMS** sier hva firmaets HMS ser og behandler på tvers av prosjekter.

## HMS-flyt — gjeldende regler (Kenneth 2026-11-23)

> 🔴 **Dette avsnittet er den ene kilden for reglene i HMS-flyten.** Sier en annen fil noe annet, gjelder dette. Tekstene som sa noe annet, er rettet i samme commit eller listet under «Eldre tekst» nederst i avsnittet.

Kenneth 2026-11-23, ordrett: *«HMS-avvik -> denne tillhører kun HMS-flyt. Alle prosjektmedlemmer skal kunne sende inn denne, samt RUH. Kun HMS behandler skal kunne behandle disse. Svar skal sendes til innsender, Ikke tilbake til hele prosjektets medlemmer. HMS-Flyt er en egen frittstående faggruppe med helt egne regler.»*

### Reglene

| # | Regelen | Status mot koden (develop @ `cef5df0c`) |
|---|---|---|
| 1 | HMS-avvik hører bare til HMS-flyten. | 🔴 Avvik A1 og A2 under |
| 2 | Alle prosjektmedlemmer kan sende inn HMS-avvik og RUH. | ✅ `oppgave.opprett` krever bare prosjektmedlemskap for maler med `domain: "hms"` (`apps/api/src/routes/oppgave.ts:548-549`). Bare melderen kan sende inn sitt eget utkast (`apps/api/src/trpc/tilgangskontroll.ts:645-650`) |
| 3 | Bare HMS-behandleren kan behandle dem. | 🟡 De egne HMS-handlingene krever HMS-behandler (`tilgangskontroll.ts:663-664`). 🔴 Avvik A3 og A4 under. Hvem som er HMS-behandler, er spørsmål H2 |
| 4 | Svaret går til innsenderen, ikke til alle prosjektets medlemmer. | ⚪ Ikke målt her. web-timer-o13 måler hvem som får svaret i dag (TILLEGG F13c-2 punkt 1 b) |
| 5 | HMS-flyten er frittstående og har helt egne regler. | 🟡 Egne handlinger og egen vakt finnes (under). 🔴 Flyten lagres som en vanlig dokumentflyt uten merke, og seeden lager den med faggrupper som ledd (A1). Ordet «faggruppe» er spørsmål H1 |

### Slik er HMS-flyten bygget i dag

- **Dokumentene:** HMS-avvik og RUH er oppgaver (`Task`), SJA er en sjekkliste (`Checklist`). De kjennes igjen på malen: `domain: "hms"` og `subdomain` `avvik`, `ruh` eller `sja` (`packages/db/prisma/schema.prisma:1228-1231`).
- **Melderen:** den som oppretter dokumentet (`bestillerUserId`). Dokumentet opprettes som utkast, og melderen sender det inn (`oppgave.ts:756-764`, `tilgangskontroll.ts:645-650`).
- **Behandlingen:** handlingene besvar, returner, lukk og gjenåpne går gjennom `verifiserHmsHandling` (`tilgangskontroll.ts:597-684`) og krever `erHmsAdmin`. Melderen kan tilføye informasjon. Det finnes ingen godkjenning i HMS-flyten.
- **HMS-behandler i koden** (`erHmsAdmin`, `tilgangskontroll.ts:549-566`) er hver av disse tre:
  1. prosjektadmin (`:549`),
  2. medlem av en gruppe med `hms` i `domains` (`:550-554`). Det gjelder prosjektets HMS-gruppe og også standardgruppen «Prosjektadministratorer» (`packages/shared/src/types/index.ts:422`),
  3. firmaets HMS-ansvarlige, for prosjekter firmaet eier (`:560-566`).
- **HMS-gruppen** er en tilgangsgruppe (`ProjectGroup`) med `systemNokkel: "hms"` (`schema.prisma:790`, `types/index.ts:447-452`). Den er ikke en faggruppe.
- **HMS-flyt-kortet** i Innstillinger → Produksjon → Dokumentflyt leser HMS-gruppen, prosjektets kontakter og firmaets HMS-ansvarlige, ikke flytraden (`apps/web/src/components/hms/HmsFlytKort.tsx:31-46`). Kortet viser melder «Følger kontaktlisten» og behandlerne.
- **Hvem som ser en sak:** HMS-behandleren ser alle HMS-saker. Andre ser saker med åpen mal, saker de selv har meldt og saker de er mottaker av (`apps/api/src/routes/hms.ts:47-57`). RUH og HMS-avvik er private og SJA er åpen (Kenneth 2026-07-21, [delplaner/hms-synlighet-regel.md](delplaner/hms-synlighet-regel.md)).
- **Sletting:** en HMS-sak kan bare slettes som utkast ([domene-arbeidsflyt.md § VEDTAK 2026-09-04](domene-arbeidsflyt.md)).

### Koden avviker fra reglene (målt 2026-11-23, ikke rettet)

| # | Avvik | Kode | Regel |
|---|---|---|---|
| A1 | **Nye prosjekter får en HMS-flyt med faggrupper som ledd.** Prosjektopprettelsen lager flyten «HMS-avvik» der alle faggruppene er melder og Byggherre er mottaker, og kobler HMS-malen til den. Når HMS-modulen senere slås på, finner koden denne flyten og lager ikke flyten «HMS» med åpen melder og HMS-gruppen som behandler. | `types/index.ts:789-794`, `apps/api/src/services/prosjektSeed.ts:127-158`, `apps/api/src/routes/modul.ts:67-91` | 1, 5 |
| A2 | **En HMS-mal kan kobles til en annen dokumentflyt.** Flytoppsettet på serveren har ingen HMS-sperre (0 treff på «hms» i `apps/api/src/routes/dokumentflyt.ts`), og et nytt HMS-avvik bindes til den første flyten som bruker malen. | `oppgave.ts:572-576` | 1 |
| A3 | **Den generelle statusendringen er åpen for HMS-saker.** `oppgave.endreStatus` har ingen HMS-sperre, så den som har ballen i flyten, kan endre status uten å være HMS-behandler. Appen har de egne HMS-handlingene bare for SJA, ikke for HMS-avvik og RUH. | `oppgave.ts:1521-1525`, `apps/mobile/app/sjekkliste/[id].tsx:519-536` | 3 |
| A4 | **Saken kan bli sendt til feil gruppe.** `oppgave.opprett` og `sjekkliste.opprett` finner mottakergruppen på `hms` i `domains` uten sortering. «Prosjektadministratorer» har også `hms` i `domains`, så den kan bli valgt i stedet for HMS-gruppen. `modul.ts:21-25` beskriver samme feil og bruker `systemNokkel`. | `oppgave.ts:552-558`, `apps/api/src/routes/sjekkliste.ts:434-440` | 3 |

A1 rettes i seeden av web-timer-o13 (TILLEGG F13c-2 punkt 1, ikke merget). Eksisterende prosjekter og A2–A4 er ikke bestilt.

### Åpent — spørsmål stilt til Kenneth 2026-11-23

- **H1:** betyr «frittstående faggruppe» at HMS skal stå som en rad i lista over faggrupper, eller at HMS-flyten er en egen enhet ved siden av faggruppene, slik HMS-flyt-kortet viser den i dag?
- **H2:** skal en prosjektadmin som ikke står som behandler i HMS-flyt-kortet, kunne behandle og lese private HMS-saker? I dag kan alle prosjektadminer det.

### Eldre tekst

- **Rettet i samme commit som dette avsnittet:** [dokumentflyt.md § 2 HMS](dokumentflyt.md) (tabellen er erstattet med en peker hit), [domene-arbeidsflyt.md](domene-arbeidsflyt.md) (to avsnitt om HMS-flyten og flyt-id), [web.md](web.md) (HMS-siden), [forretningslogikk.md § HMS-avvik](forretningslogikk.md).
- **Daterte designnotater står urørt og er historikk:** [delplaner/hms-flyt-design-2026-07-24.md](delplaner/hms-flyt-design-2026-07-24.md), [delplaner/hms-dedikert-lop-design-2026-07-24.md](delplaner/hms-dedikert-lop-design-2026-07-24.md), [delplaner/flyt-binding-design-2026-07-24.md](delplaner/flyt-binding-design-2026-07-24.md), [delplaner/flytmodell-gate-svar-fabel.md](delplaner/flytmodell-gate-svar-fabel.md), [delplaner/spor2-hms-spec-nedbryting.md](delplaner/spor2-hms-spec-nedbryting.md) og [delplaner/a3b-perspektiv-tabell.md](delplaner/a3b-perspektiv-tabell.md). De sier ulike ting om HMS er «egen flyt» eller «ordinær 2-ledds flyt», om hvem som behandler og om godkjenning. Reglene over gjelder foran dem.
- **Firmaets HMS-ansvarlige:** [fase-0-beslutninger.md A.27](fase-0-beslutninger.md) (2026-04-29) ga dem bare lesetilgang. Kenneth 2026-07-21 (§ Firma-HMS under, punkt 3) sier at firmaets HMS behandler sakene, og koden gjør dem til HMS-behandlere (`tilgangskontroll.ts:560-566`). A.27 er ikke rettet i fase-0-fila.

## Firma-HMS — modellen (Kenneth 2026-07-21)

> Nedtegnet fra Kenneths muntlige forklaring.

1. **HMS i prosjekt:** alle prosjektets medlemmer skal kunne lage RUH og delta på SJA etter behov.
2. **Overføring oppover:** RUH og SJA skal overføres til firmaets HMS.
3. **Firma-HMS ser sine ansatte:** firmaets HMS skal se **alle sine medlemmers (ansattes — ikke brukeres)** SJA og RUH, og behandle disse på firmanivå.
4. **Ferdigbehandlet i prosjekt stopper ikke overføringen:** er saken ferdigbehandlet i prosjektet, skal **resultatet likevel** til firma-HMS.

## Målte avvik mot koden (cowork 2026-07-21)

### Avvik 1 — firma-HMS scoper på prosjekt, ikke på ansatt

**Kode:** `apps/api/src/routes/hms.ts:266` (`hentFirmaOversikt`) filtrerer på `primaryOrganizationId: input.organizationId` (`:288`) — altså **dokumenter som hører til firmaets prosjekter**.

**Modellen sier:** firmaets HMS skal se **sine ansattes** SJA og RUH.

**Dette er to ulike akser, og de spriker begge veier:**

| Situasjon | Kodens utfall | Modellens utfall |
|---|---|---|
| Underentreprenørs arbeider melder RUH på A.Markussens prosjekt | Havner i **A.Markussens** firma-HMS | Skulle gått til **underentreprenørens** firma-HMS |
| A.Markussen-ansatt jobber på prosjekt eid av annet firma | Havner **ikke** i A.Markussens firma-HMS | **Skulle** havnet der |

**Hvorfor det er konsekvensrikt:** det første tilfellet er ikke bare feil aggregering — det er at ett firma ser HMS-saker meldt av et annet firmas ansatte. Det berører personvern og ansvarsforhold, ikke bare visning.

### ✅ Regelen — Kenneth-vedtak 2026-07-21

**HMS-saken følger melderens arbeidsgiver, ikke prosjekteieren.**

| Sak | Vedtak |
|---|---|
| Underentreprenørs arbeider melder RUH på A.Markussens prosjekt | → **underentreprenørens** firma-HMS |
| A.Markussen-ansatt melder RUH på annet firmas prosjekt | → **A.Markussens** firma-HMS |

**Kenneths begrunnelse (bærende):** *«ellers forblir den kun i prosjektet og dør der»* — uten arbeidsgiver-ruting har saken ingen organisatorisk eier som følger den opp.

**To akser samtidig — ikke enten/eller:**

- **Prosjekt-HMS:** uendret. Alt HMS på prosjektet, uavhengig av hvem som meldte. Prosjektet trenger sitt eget HMS-bilde.
- **Firma-HMS:** bytter akse fra `primaryOrganizationId` (prosjektets firma) til **melderens arbeidsgiver**.

En underentreprenørs RUH er dermed synlig **begge steder**: i A.Markussens prosjekt-HMS *og* i underentreprenørens firma-HMS. Det er ingen duplisering — det er to legitime perspektiver på samme sak, i tråd med perspektiv-prinsippet fra A-3b.

**Prinsippet bak hver akse (Kenneth 2026-07-21):**

| Akse | Hvorfor den finnes |
|---|---|
| **Prosjekt-HMS** | *«Hovedentreprenøren skal vite hva som skjer i sitt prosjekt.»* Ansvaret for arbeidsplassen følger prosjektet, uavhengig av hvem som er arbeidsgiver |
| **Firma-HMS** | *«Ellers forblir den kun i prosjektet og dør der.»* Oppfølgingsansvaret for en ansatt følger arbeidsgiveren |

De to aksene er dermed ikke to visninger av bekvemmelighet — de speiler to reelle, samtidige ansvarsforhold i norsk byggebransje.

> ⚠️ **Krysningspunkt som må presiseres før bygging — RUH er «privat».** Kenneth vedtok 2026-07-21 (samme dag) at **RUH og HMS-avvik er de eneste dokumenttypene som skal være private**; SJA er åpen, øvrige HMS-typer følger normal dokumentflyt ([delplaner/hms-synlighet-regel.md](delplaner/hms-synlighet-regel.md)).
>
> **✅ Presisert av Kenneth 2026-07-21: «privat» betyr ikke privat for administrasjonen.**
>
> *«Hvis helt privat, da dør jo bare RUH og ingen beslutter en løsning.»*
>
> **Hva «privat» beskytter mot:** at melderen eksponeres for kolleger og øvrige prosjektdeltakere gjennom vanlig dokumentflyt-synlighet. Terskelen for å melde en uønsket hendelse skal være lav, og den blir ikke lav hvis hele prosjektet leser den.
>
> **Hva «privat» IKKE beskytter mot:** administrasjonen. HMS-ansvarlige og administrativt ansvarlige må se innholdet — de er de eneste som kan beslutte og gjennomføre et tiltak. En RUH ingen med myndighet leser, er en RUH som ikke virker.
>
> **Konsekvens i koden:** F1-A-konjunktet (`domain === "hms" && hmsSynlighet !== "apen"` blokkerer flyt-medlemskaps-grenen) er **riktig som det står** — det er nettopp den generelle prosjektdeltaker-tilgangen som skal stenges. De administrative flatene er egne gater (`harHmsTilgang` / `harFirmaHmsTilgang`) og skal fortsatt gi full tilgang.
>
> **Fra begge akser:** både hovedentreprenørens administrasjon (prosjekt-aksen — de har ansvar for arbeidsplassen) og arbeidsgiverens administrasjon (firma-aksen — de har oppfølgingsansvar for den ansatte) ser innholdet. Det følger direkte av at begge ansvarsforhold er reelle.
>
> **Gjenstår å presisere ved bygging:** den nøyaktige avgrensningen av «administrasjon» — er det prosjektadmin, HMS-tilgang, `erFirmaansvarlig`, eller en kombinasjon? Kapabilitets-feltene på `ProjectMember` finnes allerede og er sannsynlig mekanisme. **Dette er en implementasjonsavgrensning, ikke lenger et åpent personvernspørsmål** — prinsippet er avgjort.

**Blokkert av avvik 2.** Regelen kan ikke implementeres før det finnes en måte å avgjøre hvilket firma en person er **ansatt** i, uavhengig av prosjektmedlemskap. Se under.

### Avvik 2 — «ansatt» finnes ikke som entitet

**Kode:** ingen `Ansatt`/`Employee`-modell i `packages/db/prisma/schema.prisma` — kun `AnsattKompetanse` (`:2119`). Ansatt-begrepet bæres av `User` i kjernen (jf. terminologi.md § 0, Mini-Nivå 1D).

**Konsekvens:** skillet «ansatte, ikke brukere» har ingen kodemessig håndheving i dag. Avvik 1 kan ikke løses langs ansatt-aksen før det finnes en måte å avgjøre *hvilket firma en person er ansatt i*, uavhengig av hvilke prosjekter hun er medlem av.

**Relatert:** HR-import via planlagt Import-modul er ført i terminologi.md. Det er sannsynligvis samme entitet.

**Dette er nå den kritiske stien.** Kenneth-vedtaket over kan ikke bygges før arbeidsgiver-tilhørighet er en spørrbar egenskap ved en person. Rekkefølgen er dermed gitt:

1. **Ansatt-tilhørighet som datamodell** — hvilket firma er en person ansatt i? (Ikke det samme som `ProjectMember`, ikke det samme som `company_admin.organizationId`.)
2. **Deretter** kan `hentFirmaOversikt` bytte akse fra `primaryOrganizationId` til melderens arbeidsgiver.

Steg 1 er ikke en HMS-sak — den er en kjernemodell-sak som også berører Timer, Kompetanse og Mannskap. **Bør ikke bygges som del av en HMS-runde.**

## Åpent spørsmål — er «overføres/sendes» en visning eller en overlevering?

Modellens punkt 2 og 4 bruker ordene «overføres» og «sendes». **I koden er firma-HMS en live spørring** (`hentFirmaOversikt`), ikke en overføring — ingenting sendes, alt aggregeres ved oppslag.

- **Er en visning nok?** Da er punkt 2 og 4 allerede oppfylt, og formuleringen bør endres til «synlig i» for å unngå at noen bygger en overføringsmekanisme som ikke trengs.
- **Vil Kenneth ha reell overlevering** — med egen tilstand (behandlet i prosjekt → overført → behandlet i firma, og eget behandlingsspor på firmanivå)? Da er det en vesentlig større sak, og den berører dokumentflyt-modellen.

**Cowork-observasjon:** punkt 4 («ferdigbehandlet i prosjektet skal likevel til firma») gir mest mening hvis firmanivået har et **eget** behandlingsløp — ellers ville en ferdigbehandlet sak bare vært en rad til i en liste. Det peker mot overlevering, ikke visning. **Bør avklares før noen bygger.**

## Videre

- Utestående HMS-sak fra tilgangs-sløyfen: [delplaner/hms-synlighet-regel.md](delplaner/hms-synlighet-regel.md) (RUH/HMS-avvik privat, SJA åpen, KS-avvik i normal dokumentflyt).
- Kenneth har flere tidligere kommuniserte HMS-regler som ikke er nedtegnet her. **De bør inn i denne fila etter hvert som de kommer** — ellers lever de kun i samtalen, og avvik oppdages først i prod.
