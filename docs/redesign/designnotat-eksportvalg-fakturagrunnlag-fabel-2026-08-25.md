# Designnotat — eksportvalg og fakturagrunnlag (Timer-rapport)

**Fra:** fabel · **Dato:** 2026-08-25, rev. 2× samme dag (skalEksporteres-korreksjon; printmotor-utvidelse; rev 3: to nivåer firma/personlig) · **Status:** til Kenneths valg → deretter ordre
**Mockup:** «Eksportvalg Mockup.dc.html» (1a anbefalt, 1b alternativ, 1c KPI-svar)

## Rammen: bekreftet — med korrigert kodefunn

Lønnsgrunnlag og fakturagrunnlag er to dokumenter av samme data — rammen er riktig.
Domenet har eksport-inkludering som OPPSETTSBESLUTNING: `skalEksporteres` per
lønnsart (schema:32) og tillegg (schema:93), satt i UI («Skal eksporteres til
lønn/regnskap», 14 språk). KORREKSJON (cowork-måling 25.08): feltet LESES ALDRI
— ingen where i detaljEksport, ingen filtrering i eksport-libben. Innstillingen
er inert; formålene kan ikke respektere et filter som ikke finnes, de må
IMPLEMENTERE det. Modellen står likevel: navngitte formål med forhåndsvalg,
ikke tolv avhukinger per eksport.

**Vedtatt semantikk (fabel):** `skalEksporteres = nei` ⇒ utelatt fra ALLE
formål — én regel, ingen formål-matrise. Kunden har satt den og stoler på den i
en fil som avgjør utbetaling; et formål som stille overstyrer ville skapt to
sannheter. Overstyring finnes, men bare i Tilpasset-modalen: utelatte typer
listes grå med merket «utelatt i oppsett» og kan hukes på eksplisitt — synlig
unntak, aldri stille. (Mockup 1a oppdatert.)

**Egen sak, uavhengig av designet:** at innstillingen er inert i dag er en
tillitsfeil — filteret implementeres server-side i detaljEksport og eksisterende
eksport-lib nå, uten å vente på formålsvalget. Kvittert at cowork fører den
separat.

## Alternativer, rangert

### 1 — ANBEFALT: formålsvalg i eksportknappen (mockup 1a)

(a) **Hvor valgene bor:** «Eksporter» blir splittknapp — samme mønster som
arkiv-PDF-en (D4), så brukeren lærer ett mønster. Klikk = sist brukte formål
(husket per bruker). Pilen åpner meny med tre formål + «Tilpasset …»:

- **Lønnsgrunnlag** (standard) — timer per ansatt og lønnsart, tillegg, utlegg
  til refusjon. Gruppert per ansatt.
- **Fakturagrunnlag** — timer og maskintimer per prosjekt, viderefakturerbare
  utlegg. Gruppert per prosjekt. Går UT av huset: profesjonell topptekst med
  firmanavn, periode, prosjekt.
- **Full eksport** — alle ark (dagens seks + detaljarkene).
- **Tilpasset …** — modal med avhukinger gruppert som formålene (detaljark /
  aggregater). Eneste flate med checkbokser.

(b) **Standardvalg:** Lønnsgrunnlag — den hyppigste, interne bruken. Hvert
menypunkt viser innholdet sitt som undertekst, så valget er informert uten å
åpne noe.

(c) **Når det ikke brukes:** siden er identisk med i dag — én knapp, ett klikk.
Null ny flate.

**Hvorfor rangert først:** kompleksiteten er tilgjengelig uten å være
påtrengende (Kenneths eget kriterium), standardvalget er riktig for de fleste,
og mønsteret er allerede vedtatt for arkiv-PDF-en.

### 2 — Inline eksportpanel (mockup 1b)

(a) Segmentvalg (Lønnsgrunnlag / Fakturagrunnlag / Full) + «Tilpass»-lenke i en
egen rad over tabellen. (b) Samme standard. (c) Alltid synlig — det er ulempen:
permanent flate på en side som mest brukes til å SE rapporten, og raden
konkurrerer med filterlinjen. Velges bare hvis eksport viser seg å være
hovedbruken av siden.

### 3 — Modal med avhukinger ved hvert eksport-klikk (ikke mockupet)

Hver eksport blir to klikk, og de fleste eksporter er standardvalget — modellen
skattlegger normaltilfellet for å betjene unntaket. Rangert sist; nevnt fordi
det er den vanligste løsningen i hyllevare.

## KPI-spørsmålet: ikke ni kort (mockup 1c)

De fem kortene svarer på sidens jobb — attesteringsstatus, det lederen skal
handle på. Maskin, tillegg og utlegg er økonomi-dimensjoner og hører hjemme som
kolonner i ansatt-tabellen (Maskin t · Tillegg · Utlegg kr), der cowork har målt
at dataene allerede hentes men kastes i returtypen. Utlegg-kolonnen krever den
ene serverendringen (include-blokka — samme hull som detaljeksporten).

## Avhengigheter og avgrensninger

- Formål-presetsene bygger på detaljeksport-ordren (timerader/maskin/tillegg/
  utlegg-ark med sheetTimer.id-nøkler) — samme raduttrekk, formålet styrer bare
  hvilke ark og hvilken gruppering.
- `skalEksporteres = nei` holdes utenfor i ALLE formål og listes ikke i
  Tilpasset-modalen — oppsett eier den beslutningen.
- Kostnad/enhetspris per rad: utenfor scope (Kenneth-vedtak), men
  Fakturagrunnlag-arket får kolonnene sist slik at pris kan legges til uten
  omstrukturering når maskin-/varelagermodellen lander.
- Underprosjekt (proadm-dokumentflyt): som i detaljeksport-ordren — datadrevet
  gruppering, kolonne kan kobles på sheetTimer.id senere.

## REV 2 (25.08 kveld) — printmotor: lagrede utskriftsmaler erstatter faste formål

Kenneth-presisering: brukerdefinerte, lagrede, redigerbare utskriftsmaler,
flere per firma. De fire formålene i rev 1 degraderes til innebygde startpunkt.
Excel beholdes som arbeidsflate («lese hele resonnementet»); PDF er dokumentet
som sendes. Mockup: seksjon 2a (velger) og 2b (redigering).

### Datamodell — IKKE et tredje mal-begrep (vedtak mot arkitektur-advarselen)

Migreringsplanen (migrering-reporttemplate.md) er lest. ReportTemplate/
OrganizationTemplate modellerer dokument-STRUKTUR: objekttrær, promotering
prosjekt↔firma, versjonering, malbygger-UI. En utskriftsmal er en lagret
VISNING: radfilter + kolonner + gruppering + format — én JSON-konfig, ingen
objekter, ingen promotering, ingen prosjektnivå. Å modellere den som
OrganizationTemplate category="timeeksport" ville dratt med
OrganizationTemplateObject og hele promoterings-maskineriet den ikke trenger,
og gjort den uferdige migreringen tyngre. Samme grunn som Kenneths avvisning av
«én samlet mal-builder»: grunnleggende ulik funksjon.

Derfor egen, liten modell — og navnet unngår «mal» i skjemaet så vi ikke får et
tredje Template-begrep:

```prisma
model EksportOppsett {
  id             String  @id @default(uuid())
  organizationId String  @map("organization_id")
  name           String
  config         Json    // {radTyper, gruppering, kolonner[], format, filtre}
  configVersion  Int     @default(1) @map("config_version")
  opprettetAvId  String  @map("opprettet_av_id")
  createdAt / updatedAt
  @@index([organizationId])
  @@map("eksport_oppsett")
}
```

- **Innebygde maler (Lønnsgrunnlag/Fakturagrunnlag/Full) er KODE, ikke DB-rader**
  — ingen seed-drift, alltid tilgjengelige, kan ikke slettes. «Lagre som …» fra
  en innebygd lager firmats egen DB-rad.
- **Firma-eid, ikke bruker-eid.** Rapportsiden er admin-gatet; lønnsansvarlig og
  fakturaansvarlig skal se hverandres maler. `opprettetAvId` for attribusjon.
  Sist brukte mal huskes per bruker (klientside).
- **configVersion** lar konfig-formen vokse (underprosjekt-dimensjonen, pris-
  kolonner) uten migrering av radene.
- Berører ikke ReportTemplate-migreringen; MALBYGGER.md-sporet uberørt.

### UI — tre svar på tre spørsmål

- **Hvor velger man:** samme splittknapp. Meny: «Firmaets maler» øverst,
  «Innebygd» under, «＋ Ny utskriftsmal». Klikk = sist brukte. (2a)
- **Hvor redigerer man:** Tilpasset-modalen ER redigereren — «Rediger» ved hver
  mal og «Ny utskriftsmal» åpner den forhåndsutfylt, med navnefelt, «Lagre som
  ny», «Lagre og eksporter», «Eksporter uten å lagre», «Slett mal». Ingen ny
  side, ingen ny malbygger. (2b)
- **Bruker som aldri lager en:** ser de tre innebygde + Tilpasset — identisk
  opplevelse med rev 1. Null ny byrde.

### Innarbeidede målinger

- **Type-kolonne vedtatt:** én detaljtabell med Type (Timer/Maskin/Tillegg/
  Utlegg); radvalget i malen er ett filter, ikke seks ark. Ark-splitting blir
  et grupperingsvalg i malen, ikke fast struktur. Dette reviderer rev 1-kravet
  «egne ark per type» — kolonnesettet er delt kjerne (dato/ansatt/prosjekt/
  type/antall/beskrivelse) + type-spesifikke kolonner som fylles der de gjelder.
- **PDF:** ny mal på eksisterende HTML→PDF-motor (arkiv.rendr-rørledningen) —
  rapportrenderer som ny mal i packages/pdf, ikke ny kapabilitet.
  Fakturagrunnlag-PDF får firmatopp (navn, periode, prosjekt) — den går ut av
  huset.
- **ID-kolonner:** med i Excel (koblingsnøkler, sist, tynne), skjult i PDF.
- skalEksporteres-semantikken fra rev 1 står uendret: nei ⇒ utelatt i alle
  maler, overstyring kun eksplisitt i redigereren.

## REV 3 (25.08 sen kveld) — to nivåer: firma + personlig

Kenneth-vedtak (via cowork): firmanivå + PERSONLIG nivå — ikke prosjektadmin-
nivå. Begrunnelse som står: et andre delte nivå gir samme koordineringsproblem
som firmanivået (én endrer det andre avhenger av) uten ny kapabilitet — bare
annen rekkevidde. Personlig nivå løser «prosjektøkonomi har andre behov enn
lønn» uten tillatelser og uten å kunne ødelegge for andre.

### Datamodell — ett nullable felt, ingen ny modell

```prisma
model EksportOppsett {
  // som rev 2, pluss:
  eierId String? @map("eier_id")  // null = firmamal; satt = personlig
  basertPaId String? @map("basert_pa_id")  // firmamalen den ble laget fra (SetNull)
}
```

- `eierId = null` ⇒ firmamal: skrives kun via autoriserAdminForFirma /
  erFirmaAdmin (tilgangskontroll.ts:177 — IKKE User.role="company_admin",
  gammel kilde). Leses av alle i firmaet.
- `eierId = userId` ⇒ personlig: kun synlig og redigerbar for eieren. Ingen
  tilgangsmodell å designe.
- `basertPaId` er bindeleddet: «Lagre som min» fra en firmamal kopierer
  konfigen og peker tilbake — start fra standarden, juster for deg selv.
  SetNull ved sletting av firmamalen; kopien lever videre. Ingen sync — kopien
  er en kopi, bevisst (endret firmamal skal ikke stille endre noens personlige).

### Svar på designspørsmålene

- **Ser prosjektadmin firmamalene?** Ja — alle med eksport-tilgang ser dem.
  Arv nedover, lesing er gratis.
- **Løfte personlig → firma?** Kopiering, ikke flytting: firma-admin åpner
  malen og «Lagre som ny → firma». Ingen promoteringsmaskineri (bevisst kontrast
  til ReportTemplate-migreringen).
- **Firmamal endres mens andre bruker den?** Delte maler eies av firma-admin —
  endring gjelder alle fra neste eksport, som forventet for en standard.
  Personlige kopier (basertPaId) berøres ikke. Ingen versjonsvarsling nå;
  fremtidsstige hvis pilot viser behov.
- **Bruker som aldri lager mal:** ser firmaets maler + innebygd. Har firmaet
  heller ingen: bare innebygd — rev 1-opplevelsen. Normaltilfellet krever null
  konfigurasjon.

### UI-endringer (mockup 2a/2b oppdatert)

- Meny: «Mine maler» øverst, «Firmaets maler», «Innebygd», «＋ Ny utskriftsmal».
- Redigereren: «Lagre som ny» blir tovalg (min / firma) — firma-valget vises kun
  for firma-admin. Firmamaler åpnet av ikke-admin: feltene redigerbare, men
  eneste lagringsvei er «Lagre som min» + «Eksporter uten å lagre».
- Fremtidsstige (ikke bygg): personlig → prosjekt → firma hvis prosjektdeling
  viser seg nødvendig i pilot.
