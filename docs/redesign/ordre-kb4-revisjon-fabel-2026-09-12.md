# ORDRE: KB4-revisjon — mal-Opus — fabel 2026-09-12

**Metode:** følg `docs/claude/MAL-METODE.md` (MAL-METODE). Denne ordren er selvbærende — normfakta står her; mal-Opus trenger ikke (og har ikke) tilgang til normen.

**Til:** mal-Opus (Kenneth relayer). **Fil som endres:** `packages/db/prisma/seed-bibliotek.ts` (KB4-blokken, i dag :262–:282). Ingen andre maler røres. `referanse: "KB4"` RØRES IKKE (idempotent upsert).

## Formål (styrer alle valg)
En KS-sjekkliste skal (1) være effektiv å fylle ut på mobil, (2) gi arbeideren teknisk informasjon om hvilke krav som gjelder, (3) etterlate dokumentasjon (bilder, tall, ja/nei) som viser hva som er levert og bekrefter at kravene er fulgt.

## Faktagrunnlag (fabel har lest normen, NS 3420-K:2024 s. 42–44)
- KB4 heter **«Grasdekker»** (flertall). Post KB4.-- GRASDEKKE, areal m².
- **Matrise KB4:1 Formål:** 0 Uspesifisert · 4 Grasbane · 5 Grasplen · 6 Grasbakke og eng · 9 Annet formål.
- **Matrise KB4:2 Metode:** 0 Valgfri · 1 Sådd (ikke sprøytesådd) · 2 Ferdigplen · 3 Sprøytesådd · 9 Annen metode. «Rullegress» finnes ikke som normterm — normens term er ferdigplen.
- **b1:** Opphavsmaterialet for frøslag skal dokumenteres, og emballasjen skal være merket slik at dette kan kontrolleres.
- **b2:** Ferdigplen skal ha høy skuddtetthet og et godt utviklet rot- og utløpersystem.
- **c1:** God kontakt mellom frø og jord, for eksempel ved nedmolding eller tromling.
- **c2:** Ferdigplen skal legges tett sammen, i forband og i god kontakt med underlaget.
- **c3:** Grasplen og grasbane skal klippes jevnlig fram til overtakelse. (Gjelder IKKE grasbakke/eng.)
- **c4 (grasplen og grasbane, ved overtakelse):** homogent og i god vekst · markdekningsgrad 95 % eller mer · ikke åpne flekker større enn 1,0 dm².
- **c5 (grasbakke, ved overtakelse):** som c4 + være minst 100 mm høyt.
- **y5.3 Frøblanding** (arter, sort/opphav, fordeling i masseprosent) og **frømengde per m²** angis i postgrunnlaget — dvs. prosjektbeskrivelsen, ikke malen.
- **y5.4 Dokumentasjon** kan kreve: sertifikat iht. gjeldende forskrifter, nummererte/merkede frøsekker, frøprøver til analyse, liste over hvilke frøsekker benyttet hvor.
- **y5.5:** annen markdekningsgrad enn normalkravet kan være angitt i beskrivelsen.
- KB4 stiller **ikke** fallkrav. Fall 2 % er KB2.2 c1 (jordlag) og dekkes av KB2-malen/-sjekklisten. Underlagsforberedelse: se KB2.5 (løsgjøring/finplanering av tidligere utlagt jordlag).

## Feil som rettes i dagens seed
1. Navn «KB4 – Grasdekke» → normens tittel er «Grasdekker».
2. «Type etablering» har «Rullegress» og «Ferdigplen» som to alternativer — samme ting; normens metodesett (Matrise KB4:2) skal brukes.
3. «Fall (%)»-feltet påstår et KB4-krav som ikke finnes — fallet er KB2.2 c1 og hører til KB2. Fjernes.
4. «Markdekningsgrad (%)» har `min: 95` i config — blokkerer føring av faktisk målt verdi under kravet, og kravet kan dessuten fravikes i beskrivelsen (y5.5). Kravet skal stå i hjelpeteksten; feltet skal ta imot målt verdi.
5. Formål mangler — avgjør hvilket overtakelseskrav som gjelder (c4 vs. c5 med 100 mm-kravet).
6. b1/b2-materialkontroll med fotokrav mangler.
7. Overtakelseskravene homogent/god vekst og åpne flekker ≤ 1,0 dm² mangler.
8. Hjemmelen «KB a1/c3» på klipping er feil — riktig er KB4 c3, og kravet gjelder kun grasplen og grasbane.

## Endringer

### 1. Navn og beskrivelse
- navn: `KB4 – Grasdekker`
- beskrivelse: `Etablering av grasdekke ved såing eller ferdigplen — materialkontroll, utførelse og overtakelseskrav (post KB4)`

### 2. Feltliste (erstatter dagens 7 felter — rekkefølge som her)

**FØR:**
1. `Formål` — list_single: ["Grasplen", "Grasbane", "Grasbakke og eng", "Annet – angi i kommentar"]. Hjelpetekst: «Matrise KB4:1. Formålet avgjør overtakelseskravet: grasplen/grasbane følger KB4 c4, grasbakke KB4 c5 (samme krav + minst 100 mm høyt).»
2. `Metode` — list_single: ["Sådd (ikke sprøytesådd)", "Sprøytesådd", "Ferdigplen", "Annen metode – angi i kommentar"]. Hjelpetekst: «Matrise KB4:2. Metoden skal samsvare med posten i beskrivelsen.»
3. `Frø/ferdigplen kontrollert og dokumentert` — traffic_light. Hjelpetekst: «KB4 b1: Opphavsmaterialet for frøslag skal dokumenteres og emballasjen være merket. KB4 b2: Ferdigplen skal ha høy skuddtetthet og godt utviklet rot- og utløpersystem. Frøblanding og frømengde per m² står i beskrivelsen. Ta bilde av emballasje/etikett eller følgeseddel.»
4. `Jordlag løsgjort og finplanert` — traffic_light (beholdes). NY hjelpetekst: «Underlaget skal være klart for etablering — løsgjøring og finplanering, se KB2.5. Jordlagets kvalitet og fall dokumenteres i KB2-sjekklisten.»

**UNDER:**
5. `God kontakt frø/plen mot jord` — traffic_light (beholdes). NY hjelpetekst: «KB4 c1: Ved såing god kontakt mellom frø og jord, f.eks. ved nedmolding eller tromling. KB4 c2: Ferdigplen legges tett sammen, i forband og i god kontakt med underlaget. Ta bilde.»
6. `Vannet etter legging/såing` — traffic_light (beholdes). NY hjelpetekst: «Vanning etter såing/legging sikrer etableringen. Prosjektspesifikke skjøtselskrav står i beskrivelsen.» (Ikke et normkrav — derfor ingen hjemmel.)
7. `Klippet jevnlig frem til overtakelse` — traffic_light (beholdes, flyttes fra ETTER til UNDER — utføres løpende). NY hjelpetekst: «KB4 c3: Grasplen og grasbane skal klippes jevnlig fram til overtakelse. Gjelder ikke grasbakke/eng — sett «Ikke relevant».»

**ETTER:**
8. `Markdekningsgrad (%)` — decimal, enhet `%`, **ingen min/max i config**. Hjelpetekst: «KB4 c4/c5: Minst 95 % markdekningsgrad ved overtakelse, med mindre annet står i beskrivelsen (KB4 y5.5). Bedøm visuelt eller ved prøverute — før målt/bedømt verdi.»
9. `Ferdig gressflate godkjent for overtakelse` — traffic_light (NY). Hjelpetekst: «KB4 c4/c5: Graset skal være homogent og i god vekst, uten åpne flekker større enn 1,0 dm². Grasbakke skal i tillegg være minst 100 mm høyt. Ta bilde av ferdig flate.»

9 felter / 3 faser — KA7-mønsteret. Sjekklisten åpner kollapset per fase med teller.

### 3. Fase-overskrifter
Genereres av lån-mutasjonen som før («Kontroll FØR/UNDER/ETTER utførelse») — ikke noe å gjøre i seeden.

## Absorbering av MK C-konverteringslista (KB4-radene :237, :240, :241, :244)
Denne ordren ERSTATTER konverteringslistas fire KB4-rader — de strykes fra lista når malen er gatet, og skal ikke konverteres separat:
- :237 «Jordlag løsgjort og finplanert → behold T»: dekket av felt 4 (ny hjelpetekst).
- :240 «God kontakt frø/plen mot jord → behold T»: dekket av felt 5.
- :241 «Vannet etter legging/såing → behold T»: dekket av felt 6.
- :244 «Klippet jevnlig frem til overtakelse → behold T»: dekket av felt 7 (rettet hjemmel, flyttet til UNDER).

## Rammer (MK-vedtak, arves)
- Bygges med eksisterende hjelpefunksjoner (`valg`/`trafikklys`/`desimal`/`felt`) — aldri hardkodet JSON.
- `verifisert: false` beholdes eksplisitt. Prod-gaten skal ikke røres.
- Ingen intern sjargong i kundetekst (navn, beskrivelse, hjelpetekster). i18n på nye synlige strenger.
- Rotårsak fremfor plaster; ingen endringer utenfor KB4-blokken uten å melde tilbake først.
- Husk §6 pkt. 4-fella: finnes KB4 allerede i lokal DB, slett raden (`delete from bibliotek_maler where referanse='KB4'`) før seed — ellers ser du gammelt innhold.

## Definition of Done
1. `seed-bibliotek.ts` endret; seed kjørt mot lokal DB uten feil (idempotent re-kjøring verifisert).
2. Skjermbilde-bevis: revidert KB4 i MalBygger (alle 9 felter + faser synlige) + mobil utfyllingsvisning.
3. Målrettet UPDATE-SQL for test (`WHERE referanse='KB4'`, `verifisert=false`) levert sammen med malen (MAL-METODE §6a — korte JSON-biter, BEGIN/COMMIT, testet lokalt).
4. Kort avviksmelding hvis noe i ordren ikke lot seg gjøre som spesifisert.

Gate: fabel kontrollerer bevis mot denne ordren før «klar for commit» meldes. Cowork eier merge-timing som vanlig.
