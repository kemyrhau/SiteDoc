# Spor 2 (HMS) — spec-nedbryting: tre ordrer mot godkjent mockup

> Fasit: `Spor 2 HMS Mockup.dc.html` (til-repo-2026-08-05-1600), Kenneth-godkjent 06.08.
> Bygger på: seedHmsModulOmradet-funnene dine (modul.ts:15/:254 — HMS-gruppe «HMS-ansvarlige», 2-ledds HMS-flyt, HMS-maler). Ingen ny backend-modell — spor 2 gjør eksisterende tilstand synlig + regel-basert.
> Rekkefølge: 2.1 → 2.2 → 2.3 (2.2/2.3 kan gå parallelt etter 2.1 hvis touch-områdene ikke kolliderer — cowork sekvenserer).
> Hver ordre: nå-sjekk som første steg (mål mot kode, cowork gater premissene) + touch-område målt (grep/git) før koding. Kvalitet foran tempo: rotårsak, delte kilder, guards.

---

## Ordre 2.1 — Medlemskap som regel + synlighet (Funn H + mockup 3a/4a)

**Mål:** HMS-medlemskap følger en regel, ikke en statisk liste — og HMS-flyt/gruppe vises i spor 1-flatene.

1. **Melder-leddet (boks 1) = «Følger kontaktlisten · N»** når HMS-modulen er aktiv. Null-medlem = alle: hver kontakt i prosjektet er melder automatisk, nye kontakter arver uten handling. Redigerbare unntak (ekskluder enkeltkontakt) — men default er alle.
2. **Behandler-leddet (boks 2) = firmaets HMS-ansvarlige** (firmanivå), med mulig supplering per prosjekt. UI-et viser kilden («fra firma» vs «lagt til i prosjektet»).
3. **Funn H-hullet:** tilgangsmatrisen viser HMS-gruppen med domene-chip `hms` + **«0 medlemmer ⚠️»-varsel** når behandler-leddet er tomt, og et ett-klikks **«Meld meg inn»-banner** for admin (lander i behandler-leddet).
4. **Synlighet i spor 1-flater:** dokumentflyt-oppsettet viser HMS-flyten som ordinær 2-ledds flyt (Melder → Behandler, leddene synlige og klikkbare); kontaktsiden viser HMS-chip på kontakter som er behandlere. Ikke skjult spesialtilfelle.
5. **Nå-sjekk:** mål hvordan `seedHmsModulOmradet`-gruppen/flyten rendres i dag (skjules den? filtreres den bort?), og om null-medlem-semantikk («alle») finnes i medlemsmodellen eller må innføres som regel-felt. Flagg hvis regel-basert medlemskap krever schema-endring — da gates den delen separat.

**Fasit-punkter (walkthrough):** ny kontakt opprettes → er melder uten handling · tomt behandler-ledd → ⚠️ + banner synlig for admin, banner-klikk → medlem · HMS-flyt synlig i flyt-oppsettet med begge ledd.

## Ordre 2.2 — Unifisert HMS-velger (Funn E + mockup 3b)

**Mål:** «+ Meld HMS» bruker samme velger som sjekkliste/oppgave — ingen egen HMS-vei.

1. HMS-listens opprett-knapp åpner **`OpprettMalVelger`** (Funn C + v2-komponenten) med HMS-malene (HMS-avvik/SJA/RUH).
2. **HMS som egen nivå-1-seksjon** (ditt gatede ALT 1 står: versal-header, ingen nivå-2-underoverskrift, flyt-løse HMS-maler her).
3. **Åpne-regelen fra 1.4 gjelder:** alltid velger ved ≥1 mal, sist-brukt = kun markør, aldri auto-hopp.
4. Interaksjon uendret fra Funn C-spec (markør, ↑/↓/Enter, «Opprett»-knapp, nøkkel per prosjekt+doctype).
5. **Nå-sjekk:** mål dagens HMS-opprett-vei (egen komponent? hardkodet mal-liste?) + touch-område.

**Fasit:** «+ Meld HMS» → velger med HMS-seksjon, sist-brukt forvalgt · samme oppførsel som sjekkliste/oppgave-flatene.

## Ordre 2.3 — HMS-liste: status-filter + navigasjon (Funn F + G + mockup 3b)

**Mål:** HMS-lista snakker flytmodellens språk og mister ikke lukkede saker.

1. **Segmentert status-filter** med **«Lukket» alltid synlig** som eget segment (Funn F: i dag forsvinner lukkede). Segmentene følger avledet status (Hos N / terminal), ikke rå enum.
2. **«Hos»-kolonne** med flytmodellens perspektiv-vokabular: «Hos {faggruppe}» / «Venter på deg» — samme kilde som sjekkliste/oppgave (delt utledning, ikke duplisert logikk).
3. **Retur-kontekst (Funn G):** åpne HMS-sak → tilbake lander i **HMS-lista**, ikke Oppgaver — selv om HMS-avvik er oppgave under panseret. Detaljvisningen beholder HMS-konteksten (tittel/brødsmule sier HMS).
4. **Nå-sjekk:** mål dagens filter + retur-navigasjon (hvor ryker konteksten — route-param? delt liste-side?).

**Fasit:** lukket HMS-sak gjenfinnbar via Lukket-segmentet · rad viser «Hos {faggruppe}» · åpne + tilbake → HMS-lista.

## Utenfor disse ordrene
- **Firma-HMS-aggregat** (alle firmaets prosjekter i én tabell) — vedtatt egen senere ordre m/ egen mockup-godkjenning.
- Mobil-paritet for velger/filter — egen runde (som 1.4-mobil).
- HMS-arbeid fjerde fane (vedtak 28.07) — ligger i fase 3-sporet, ikke her.
