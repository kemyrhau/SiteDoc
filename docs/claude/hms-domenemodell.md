---
name: hms-domenemodell
status: 🟡 § HMS-flyt er Kenneths regler 2026-11-23 (HF1 nei og HF2 ja samme dag), målt mot develop @ `1bb2d5e6` — regel 3 (bare behandlerne i HMS-flyt-kortet behandler) er bygget på `fix/hms-h3-behandler`, ikke merget (H3), og fem målte avvik står åpne (A1–A5). § Firma-HMS er domenemodellen fra 2026-07-21 — to målte avvik mot kode, ett åpent spørsmål
eier: Kenneth (domenesannhet) · fabel (design) · orkestrator (bestiller kode)
sist_verifisert_mot_kode: 2026-11-23 (§ HMS-flyt, develop @ `1bb2d5e6`) · 2026-07-21 (§ Firma-HMS)
---

# HMS — domenemodell

> **Dette er domenesannheten arkitekturen skal forklares fra** ([domene-arbeidsflyt.md](domene-arbeidsflyt.md)-prinsippet). Kenneth 2026-07-21: *«så er det mange regler som har vært kommunisert tidligere som vi skal bygge etter. Ved avvik — diskuterer vi dette og løser avviket.»*
>
> Fila har to deler. **§ HMS-flyt** sier hvem som melder, hvem som behandler og hvem som får svaret i et prosjekt. **§ Firma-HMS** sier hva firmaets HMS ser og behandler på tvers av prosjekter.

## HMS-flyt — gjeldende regler (Kenneth 2026-11-23)

> 🔴 **Dette avsnittet er den ene kilden for reglene i HMS-flyten.** Sier en annen fil noe annet, gjelder dette. Tekstene som sa noe annet, er rettet eller har fått banner som peker hit (se «Eldre tekst» nederst i avsnittet).

Kenneth 2026-11-23, ordrett: *«HMS-avvik -> denne tillhører kun HMS-flyt. Alle prosjektmedlemmer skal kunne sende inn denne, samt RUH. Kun HMS behandler skal kunne behandle disse. Svar skal sendes til innsender, Ikke tilbake til hele prosjektets medlemmer. HMS-Flyt er en egen frittstående faggruppe med helt egne regler.»*

Kenneth 2026-11-23, på de to spørsmålene reglene ikke avgjorde, ordrett: *«HF1: nei · HF2: ja»*.

- **HF1** spurte om HMS også skal stå som en rad i lista over faggrupper. Svaret er nei.
- **HF2** spurte om bare de som står som behandlere i HMS-flyt-kortet, skal behandle. Svaret er ja.

### Reglene

| # | Regelen | Status mot koden (develop @ `1bb2d5e6`) |
|---|---|---|
| 1 | HMS-avvik hører bare til HMS-flyten. | ✅ Nye prosjekter og prosjekter der modulen slås på, får flyten «HMS» med alle HMS-malene koblet til (`apps/api/src/services/hmsFlyt.ts:60-86`, `:129-145`; kalt fra `apps/api/src/services/prosjektSeed.ts:125` og `apps/api/src/routes/modul.ts:310`). 🔴 Avvik A1 og A2 under |
| 2 | Alle prosjektmedlemmer kan sende inn HMS-avvik og RUH. | ✅ `oppgave.opprett` krever bare prosjektmedlemskap for maler med `domain: "hms"` (`apps/api/src/routes/oppgave.ts:548-549`). Bare melderen kan sende inn sitt eget utkast (`apps/api/src/trpc/tilgangskontroll.ts:645-650`) |
| 3 | Bare de som står som behandlere i HMS-flyt-kortet, behandler HMS-avvik og RUH. En prosjektadmin som ikke står der, ser ikke private HMS-saker andre har meldt, og har ingen behandlerknapper. «Meld meg inn» i kortet gjør adminen til behandler. (HF2 ja) | 🟡 **2026-11-23, bygget på `fix/hms-h3-behandler` (H3, web-timer-o13), ikke merget.** På develop er alle prosjektadminer og alle i gruppen «Prosjektadministratorer» fortsatt behandlere. På branchen er behandleren medlem av HMS-gruppa eller firmaets HMS-ansvarlige (`apps/api/src/trpc/tilgangskontroll.ts:540`). Se «Regel 3 — det H3 endrer» under. 🔴 Avvik A3 |
| 4 | Svaret går til innsenderen, ikke til alle prosjektets medlemmer. | ✅ I flyten «HMS»: e-posten går til innsenderen når innsenderen er aktivt medlem, aldri til alle (`apps/api/src/services/prosjektmedlemskap.ts:226-238`), og ballen går til innsenderen (`packages/shared/src/utils/flytPosisjon.ts:101-121`). Målt av web-timer-o13 2026-11-23 (SVAR F13c-2 punkt b). 🔴 Avvik A1: i den gamle seed-flyten «HMS-avvik» blir ballen liggende hos gruppen saken ble sendt til |
| 5 | HMS-flyten er frittstående og har helt egne regler. Den er en egen enhet ved siden av faggruppene og står ikke i lista over faggrupper. (HF1 nei) | ✅ Flyten har ingen faggruppe og ingen faggruppe-ledd (`hmsFlyt.ts:69-85`). Den vises bare i HMS-flyt-kortet, ikke blant faggruppenes flyter og ikke under «Uten faggruppe» (`apps/web/src/app/dashbord/oppsett/produksjon/_components/flyt-gruppering.ts:22-24`). Egne handlinger og egen vakt (under). 🔴 Flyten lagres som en vanlig dokumentflyt uten eget merke og kjennes igjen på malene (A2) |

### Slik er HMS-flyten bygget i dag

- **Dokumentene:** HMS-avvik og RUH er oppgaver (`Task`), SJA er en sjekkliste (`Checklist`). De kjennes igjen på malen: `domain: "hms"` og `subdomain` `avvik`, `ruh` eller `sja` (`packages/shared/src/types/index.ts:548-550`, `:481-482`).
- **Flyten:** `seedHmsModulOmradet` lager flyten «HMS» med to ledd: steg 1 er åpen melder uten gruppe og uten faggruppe, steg 2 er HMS-gruppen (`hmsFlyt.ts:69-85`). Finnes det alt en flyt med en HMS-mal, brukes den som den er (`hmsFlyt.ts:61-67`).
- **Melderen:** den som oppretter dokumentet (`bestillerUserId`). Dokumentet opprettes som utkast, og melderen sender det inn (`oppgave.ts:756-764`, `tilgangskontroll.ts:645-650`).
- **Behandlingen:** handlingene besvar, returner, lukk og gjenåpne går gjennom `verifiserHmsHandling` (`tilgangskontroll.ts:597-684`) og krever `erHmsAdmin`. Melderen kan tilføye informasjon. Det finnes ingen godkjenning i HMS-flyten.
- **HMS-behandler i koden** (`erHmsAdmin`) er på develop hver av disse tre: prosjektadmin, medlem av en gruppe med `hms` i `domains` (også standardgruppen «Prosjektadministratorer», `types/index.ts:422`) og firmaets HMS-ansvarlige. 🟡 På `fix/hms-h3-behandler` (ikke merget) er det bare to (`tilgangskontroll.ts:540-567`):
  1. aktivt medlem av prosjektets HMS-gruppe, `systemNokkel: "hms"`,
  2. firmaets HMS-ansvarlige, for prosjekter firmaet eier.
- **HMS-gruppen** er en tilgangsgruppe (`ProjectGroup`) med `systemNokkel: "hms"` (`hmsFlyt.ts:25-28`, `types/index.ts:447-452`). Den er ikke en faggruppe.
- **HMS-flyt-kortet** i Innstillinger → Produksjon → Dokumentflyt leser HMS-gruppen, prosjektets kontakter og firmaets HMS-ansvarlige, ikke flytraden (`apps/web/src/components/hms/HmsFlytKort.tsx:31-46`). Kortet viser melder «Følger kontaktlisten» og behandlerne: de som er lagt til i prosjektet, og firmaets HMS-ansvarlige («Fra firma»).
- **«Meld meg inn»** legger den innloggede prosjektadminen inn i HMS-gruppen (`apps/api/src/routes/gruppe.ts:544-547`, `apps/web/src/components/hms/HmsBehandlerHandlinger.tsx:32-44`).
- **Hvem som ser en sak:** HMS-behandleren ser alle HMS-saker. Andre ser saker med åpen mal, saker de selv har meldt og saker de er mottaker av (`apps/api/src/routes/hms.ts:46-57`). RUH og HMS-avvik er private og SJA er åpen (Kenneth 2026-07-21, [delplaner/hms-synlighet-regel.md](delplaner/hms-synlighet-regel.md)).
- **Sletting:** en HMS-sak kan bare slettes som utkast ([domene-arbeidsflyt.md § VEDTAK 2026-09-04](domene-arbeidsflyt.md)).

### Regel 3 — det H3 endrer (🟡 2026-11-23, bygget på `fix/hms-h3-behandler`, ikke merget)

Målt mot develop @ `1bb2d5e6`, bygget mot develop @ `0bdee142`. Linjenumrene i «Etter H3» gjelder branchen.

| Sted | I dag | Etter H3 |
|---|---|---|
| `erHmsAdmin` | Prosjektadmin er HMS-behandler. | Prosjektadmin er behandler bare som medlem av HMS-gruppen (`tilgangskontroll.ts:540-567`). |
| `erHmsAdmin` | Medlem av en gruppe med `hms` i `domains` er behandler. «Prosjektadministratorer» har `hms` i `domains`. | Bare medlemmer av gruppen med `systemNokkel: "hms"` er behandlere (`tilgangskontroll.ts:547-551`). Gjelder også en gruppe brukeren selv har gitt domenet `hms` (`gruppe.oppdaterDomener`): den gir ikke lenger behandling eller lesing av private saker. |
| `erHmsAdmin` | Firmaets HMS-ansvarlige er behandlere. | Uendret. De står i kortet som «Fra firma». |
| `hms.ts:48`, `hms.ts:202`, `apps/api/src/routes/signatur.ts:100`, `tilgangskontroll.ts:663` | De fire kallerne av `erHmsAdmin`: lesefilteret for private saker, «er jeg HMS-behandler» til klienten, SJA-signaturen og vakten for HMS-handlingene. | Følger den nye definisjonen uten egne endringer. Web og mobil viser behandlerknappene bare når `hms.erHmsAdmin` svarer ja. |
| `verifiserDokumentTilgang` → `avgjorDokumentTilgang` (detaljsidene, handlinger, arkiv) | Prosjektadmin leser alle saker. En gruppe med `hms` i `domains` leser alle HMS-saker. | For en privat HMS-sak (mal med `domain: "hms"` og `hmsSynlighet` ≠ «apen»; null er privat) gjelder ikke de to grenene. HMS-behandleren leser alle (`grunn: "hms-behandler"`), ellers melder og mottaker (`packages/shared/src/utils/avgjorDokumentTilgang.ts:99-102`, `:148`; synligheten slås opp fra malen når kalleren ikke sendte den, `tilgangskontroll.ts:1087-1103`). Åpne saker (SJA) leses som før. |
| `byggTilgangsFilter` (listene: Bilder-siden `bilde.hentForProsjekt`, `oppgave.hentForProsjekt`, `sjekkliste.hentForProsjekt`, også med `domain: "hms"`) | Prosjektadmin får ingen filter (ser alt). En gruppe med `hms` i `domains` får alle HMS-saker. Flyt-medlemskap gir saker i flyten, også private HMS-saker detaljgaten avviser. | H3-1: for den som ikke er HMS-behandler, tar ingen av de tre grenene med en privat HMS-sak (`IKKE_PRIVAT_HMS`, `tilgangskontroll.ts:1414`; null regnes som privat). Prosjektadmin får alt som ikke er privat HMS, pluss private saker der hen er melder eller mottaker (`:1465-1478`); domene-grenen `:1531`; flyt-grenen `:1570`, som F1-A i detaljgaten. Prosjektadmin som er behandler, ser alt som før. Bygg-saker og åpne SJA uendret. |
| `oppgave.hentForSjekkliste` | Sendte ikke malens domene, så en privat HMS-sjekkliste ble ikke regnet som privat — prosjektadmin slapp gjennom. | H3-2: sender `template.domain` og `hmsSynlighet` som de andre kallstedene (`oppgave.ts:470-482`). |
| `services/hmsAnsvarlig.ts` (fjerning av firmarollen) | Prosjektadmin og medlem av en gruppe med `hms` i `domains` beholder ballen når firmarollen fjernes. | Bare medlem av HMS-gruppa beholder ballen (`hmsAnsvarlig.ts:76`) — samme definisjon som `erHmsAdmin`. |
| `gruppe.ts:544-547` | «Meld meg inn» krever prosjektadmin. | Uendret. Det er veien fra prosjektadmin til behandler. |
| `gruppe.oppdaterDomener` | Kan fjerne `hms` fra en gruppes domener, også fra HMS-gruppa. | Uendret, men uten betydning for hvem som behandler: `erHmsAdmin` leser `systemNokkel`, ikke `domains`. |

Tester: `apps/api/src/routes/hms-h3-behandler.integration.test.ts` (rollene, listen, handlingene, «Meld meg inn», prosjektisolasjon; H3-1: Bilder-siden, `oppgave.hentForProsjekt` og `sjekkliste.hentForProsjekt` med `domain: "hms"` for admin, «Prosjektadministratorer», medlem, behandler og melder, med negativkontroll for bygg-saker og åpen SJA; H3-2: `oppgave.hentForSjekkliste`), radene «H3» i `packages/shared/src/utils/tilgangsmatrise.test.ts`. Lesespørring for prosjekter som får 0 behandlere: `relay/h3-null-behandlere.sql` (ikke målt i prod).

- **Prosjektadmin setter fortsatt opp kortet.** Å legge til og fjerne behandlere er oppsett, ikke behandling.
- **Prosjektadmin ser fortsatt** åpne saker (SJA), saker adminen selv har meldt, og saker adminen er mottaker av (`hms.ts:50-56`).
- **Ikke avgjort av HF2:** sitedoc-admin ser alle HMS-saker (`hms.ts:34`) og behandles som HMS-behandler i `hms.erHmsAdmin` (`hms.ts:202`) og i SJA-signaturen. Kenneth er ikke spurt om det. H3 endrer det ikke.
- **Ikke endret av H3:** den generelle statusendringen (`oppgave.endreStatus`, A3) slipper fortsatt prosjektadmin gjennom på saker adminen kan lese, altså egne meldinger.
- **Ikke målt i prod:** hvor mange prosjekter som står med 0 behandlere i kortet når prosjektadmin ikke lenger teller. Der blir innsendte saker liggende uten behandler til noen melder seg inn. HMS-siden viser et varsel med «Meld meg inn» når kortet er tomt (`apps/web/src/components/hms/HmsTomBanner.tsx`, brukt i `apps/web/src/app/dashbord/[prosjektId]/hms/page.tsx`).

### Koden avviker fra reglene (målt 2026-11-23 mot develop @ `1bb2d5e6`)

| # | Avvik | Kode | Regel |
|---|---|---|---|
| A1 | **Prosjekter opprettet før `41a39801` (2026-11-23) kan ha en HMS-flyt med faggrupper som ledd.** Prosjektopprettelsen laget da flyten «HMS-avvik» der alle faggruppene var melder og Byggherre mottaker. `seedHmsModulOmradet` finner den flyten og lar den stå. Nye prosjekter får flyten «HMS» (✅ F13c-2, merget `41a39801`). Hvor mange prosjekter i prod som har den gamle flyten, er ikke målt. | `hmsFlyt.ts:61-67` | 1, 4, 5 |
| A2 | **En HMS-mal kan kobles til en annen dokumentflyt.** Flytoppsettet på serveren har ingen HMS-sperre (eneste treff på «hms» i `apps/api/src/routes/dokumentflyt.ts` er en kommentar om visningen), og et nytt HMS-avvik bindes til den første flyten som bruker malen. | `oppgave.ts:572-576` | 1 |
| A3 | **Den generelle statusendringen er åpen for HMS-saker.** `oppgave.endreStatus` har ingen HMS-sperre, så den som har ballen i flyten, kan endre status uten å være HMS-behandler. Appen har de egne HMS-handlingene bare for SJA, ikke for HMS-avvik og RUH. | `oppgave.ts:1521-1525`, `apps/mobile/app/sjekkliste/[id].tsx:519-536` | 3 |
| A4 | **Saken kan bli sendt til feil gruppe.** `oppgave.opprett` og `sjekkliste.opprett` finner mottakergruppen på `hms` i `domains` uten sortering. «Prosjektadministratorer» har også `hms` i `domains` og opprettes først, så den blir valgt i stedet for HMS-gruppen. ✅ Rettet av H1, merget `aefa1b0e` (2026-11-23), ikke deployet: oppslaget går på `systemNokkel` (`finnHmsGruppe`, `services/hmsGruppe.ts`). | `oppgave.ts:552-558`, `apps/api/src/routes/sjekkliste.ts:434-440` | 3 |
| A5 | **Prosjektopprettelsen lager HMS-malene uten `subdomain` og `hmsSynlighet`.** Da er SJA ikke åpen for andre enn melder, mottaker og behandler (`hms.ts:53`), og HMS-lista, som henter HMS-avvik, SJA og RUH hver for seg på `subdomain`, finner ikke sakene (`hms.ts:241`, `:266`, `:285`). 🟡 Seeden rettes av H2 hos web-timer-o13 (`fix/hms-h1-h2` @ `de855d96`, ikke merget). Malene som alt er laget slik, rettes ikke av H2 (se prod-målingen under). | `prosjektSeed.ts:65-75` | 1 |

A2 og A3 er ikke bestilt. Retting av de gamle flytene i A1 og av de eksisterende malene i A5 er ikke bestilt.

### Målt i prod (Kenneth 2026-11-23)

- **0 prosjekter** har HMS-maler uten en merket HMS-gruppe. Oppslaget på `systemNokkel: "hms"` (H1, H3) finner altså en gruppe i alle prosjekter som har HMS-maler.
- **2 prosjekter** har HMS-maler (SJA, HMS-avvik, RUH) med `subdomain` og `hmsSynlighet` = null. Det er avvik A5 i drift i de to prosjektene.

Spørsmålene heter HF1 og HF2 her for ikke å blandes med funn H1 og H2 hos web-timer-o13.

### Eldre tekst

- **Rettet 2026-11-23:** [dokumentflyt.md § 2 HMS](dokumentflyt.md) (tabellen er erstattet med en peker hit), [domene-arbeidsflyt.md](domene-arbeidsflyt.md) (to avsnitt om HMS-flyten og flyt-id), [web.md](web.md) (HMS-siden), [forretningslogikk.md § HMS-avvik](forretningslogikk.md).
- **Daterte designnotater har fått banner som peker hit og sier hva som er snudd:** [delplaner/hms-flyt-design-2026-07-24.md](delplaner/hms-flyt-design-2026-07-24.md), [delplaner/hms-dedikert-lop-design-2026-07-24.md](delplaner/hms-dedikert-lop-design-2026-07-24.md), [delplaner/flyt-binding-design-2026-07-24.md](delplaner/flyt-binding-design-2026-07-24.md), [delplaner/flytmodell-gate-svar-fabel.md](delplaner/flytmodell-gate-svar-fabel.md), [delplaner/spor2-hms-spec-nedbryting.md](delplaner/spor2-hms-spec-nedbryting.md) og [delplaner/a3b-perspektiv-tabell.md](delplaner/a3b-perspektiv-tabell.md). Innholdet under bannerne er historikk og er ikke endret.
- **Synlighet:** [delplaner/hms-synlighet-regel.md](delplaner/hms-synlighet-regel.md) har fått banner. Tabellen for SJA, RUH og HMS-avvik gjelder. «Administrasjonen» i fila er behandlerne i HMS-flyt-kortet (regel 3). Raden «andre HMS-typer: normal dokumentflyt» er ikke avgjort av Kenneths ord 2026-11-23.
- **Firmaets HMS-ansvarlige:** [fase-0-beslutninger.md A.27](fase-0-beslutninger.md) (2026-04-29) ga dem bare lesetilgang. Kenneth 2026-07-21 (§ Firma-HMS under, punkt 3) sier at firmaets HMS behandler sakene, og koden gjør dem til HMS-behandlere (`tilgangskontroll.ts:560-566`). A.27 har fått banner om dette.

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
