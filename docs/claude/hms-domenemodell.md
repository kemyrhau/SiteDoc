---
name: hms-domenemodell
status: 🟡 DOMENEMODELL fra Kenneth 2026-07-21 — to målte avvik mot kode, ett åpent spørsmål
eier: Kenneth (domenesannhet) · fabel (design) · cowork (kode-måling)
sist_verifisert_mot_kode: 2026-07-21
---

# HMS — domenemodell (Kenneth 2026-07-21)

> Nedtegnet fra Kenneths muntlige forklaring. **Dette er domenesannheten arkitekturen skal forklares fra** ([domene-arbeidsflyt.md](domene-arbeidsflyt.md)-prinsippet). Kenneth: *«så er det mange regler som har vært kommunisert tidligere som vi skal bygge etter. Ved avvik — diskuterer vi dette og løser avviket.»*

## Modellen

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
> «Hovedentreprenøren skal vite hva som skjer» og «RUH er privat» er **ikke** i konflikt — men de avgrenser hverandre, og grensen er ikke trukket:
>
> - «Privat» betyr i dagens kode at flyt-medlemskaps-grenen **ikke** gir tilgang (F1-A: `domain === "hms" && hmsSynlighet !== "apen"`). Prosjekt-HMS og firma-HMS er derimot **egne gatede flater** (`harHmsTilgang` / `harFirmaHmsTilgang`).
> - **Åpent:** hvem hos hovedentreprenøren ser en underentreprenørs RUH? Alle med HMS-tilgang på prosjektet, eller kun HMS-ansvarlig? Og ser de innholdet, eller kun at saken finnes?
>
> **Må avklares før noen bygger akse-endringen** — ellers avgjøres et personvernspørsmål av en implementasjonsdetalj.

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
