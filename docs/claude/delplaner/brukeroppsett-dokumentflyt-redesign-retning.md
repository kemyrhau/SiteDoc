# Redesign-retning: brukeroppsett ↔ dokumentflyt ↔ HMS — én modell, én flate

> Fra fabel, 2026-08-04. Grunnlag: `docs/claude/delplaner/brukeroppsett-dokumentflyt-rotarsak-2026-08-04.md`
> + kodegjennomgang av `oppsett/brukere/page.tsx` og `oppsett/produksjon/dokumentflyt/page.tsx`.
> Dette er en RETNINGS-SKISSE for nedbryting i Opus-ordrer — ikke implementasjonsspec.
> Prinsipp: datamodellen er komplett; redesignet EKSPONERER den. Ingen schema-endringer forventet.

## 0. Kvittering på HMS-v2-gaten

Cowork-vedtaket (alt 1: egen nivå-1 «HMS»-seksjon, ingen nivå-2, nederst før footer) er
**godkjent som gatet** — konsistent med spec §5. Ingen endring. Benevnelsen «HMS» beholdes.

## 1. Diagnosen i én setning

Tre flater forvalter hver sin bit av samme kjede (Gruppe → domener → GroupFaggruppe → Faggruppe →
DokumentflytMedlem), men ingen flate VISER kjeden — så brukeren møter tre begreper uten synlig
sammenheng, og HMS-domenet er umulig å konfigurere fordi leddet Gruppe↔domene aldri fikk UI.

## 2. Terminologi (må-løse 2) — skille tydelig, ikke slå sammen

Begrepene er reelt forskjellige ting og skal IKKE slås sammen i data. UI-grepet:

- **Gruppe → «Tilgangsgruppe»** i all UI-tekst (brukere-siden, pickere, feilmeldinger). Undertittel
  der begrepet introduseres: «hvem som er med + hvilke moduler og domener de har tilgang til».
- **Faggruppe** beholder navnet (etablert i flyt-vokabularet fra pilot-runde 2), undertittel:
  «deltaker i dokumentflyt». Faggruppe-etiketten i flytlinja er alt innarbeidet.
- **Koblingen gjøres til substantiv i UI:** «Tilknyttede faggrupper» på tilgangsgruppe-kortet og
  «Tilknyttede tilgangsgrupper» på faggruppe-raden — samme relasjon (GroupFaggruppe) synlig fra
  begge sider, redigerbar fra begge sider (én mutasjon, to innganger).
- Alle tre begrepene får én forklaringsboks («Hvordan henger dette sammen?») med et lite
  kjede-diagram: Tilgangsgruppe → (domener) → Faggruppe → rolle i Dokumentflyt. Én kilde,
  gjenbrukt på begge sider.

## 3. Én koherent oppsettsflate (må-løse 1)

Ikke ny side — **de to eksisterende sidene kompletteres til speilbilder av kjeden:**

**3a. Oppsett → Brukere (tilgangsgruppe-perspektivet).** Gruppe-kortet utvides fra
medlemmer+permissions til fire felter: Medlemmer · Moduler · **Domener** (ny, §4) ·
**Tilknyttede faggrupper** (ny — i dag finnes koblingen kun som read-only `faggruppeKoblinger`
på personnivå; den løftes til gruppenivå og blir redigerbar).

**3b. Oppsett → Produksjon → Dokumentflyt (faggruppe-perspektivet).** Siden er alt
faggruppe-gruppert. Tillegg: faggruppe-raden viser «Tilknyttede tilgangsgrupper» (chips) med
rediger-inngang til samme kobling som 3a. Medlems-pickeren i rollene prioriterer medlemmer fra
tilknyttede grupper (i dag: flat liste).

**3c. Gruppe-picker ved dokumentflyt-opprett** (symptomet «kun navnefelt»): opprett-inline-inputen
(`opprettMutation` med kun name+faggruppeId) utvides til navn + forhåndsvisning av hvilke
tilgangsgrupper/medlemmer som er tilgjengelige via faggruppens koblinger, med snarvei «koble til
tilgangsgruppe» hvis ingen finnes. Ikke obligatorisk steg — flyt uten kobling er fortsatt lovlig.

## 4. Wire `oppdaterDomener` (må-løse 4, Funn H) — første ordre

Minst risiko, størst opplåsing: **domene-velger (bygg/hms/kvalitet) på gruppe-kortet i
Oppsett → Brukere**, koblet til eksisterende `gruppe.oppdaterDomener` (admin-only, `gruppe.ts:469`).
Chips/checkbokser, synlig for alle, redigerbar for admin. Dette gjør feilmeldingen «Opprett en
gruppe med HMS-domene under Oppsett → Brukere» SANN — og løser at admin ikke kan gi seg selv
HMS-rettigheter. Kan skipes alene, før resten.

## 5. HMS på linje med flytmodellen (må-løse 3, Funn E–G)

- **E — velger:** HMS-oppgavemaler inn i den unifiserte velgeren (alt gatet som nivå-1-seksjon).
  «+ Meld HMS»-inngangen beholdes som snarvei, men åpner SAMME velger med HMS-seksjonen
  forvalgt/scrollet — én opprettelsesmodell, to innganger.
- **E — åpne-regel-revisjon (endrer Funn C §0):** Kenneth vil at også nøyaktig 1 opprettbar mal
  viser velgeren med malen forvalgt (Enter = like raskt), i stedet for auto-hopp. Vedtatt retning:
  **auto-hopp fjernes**; regelen blir 0 maler → deaktivert forklaring, ≥1 → velger. Én regel,
  ingen spesialtilfeller. Funn C-fasit pkt 3 oppdateres tilsvarende.
- **F — status-filter:** multiselect erstattes med segmentert filter av samme mønster som
  oppgavelistas (gjenbruk komponent), med «Lukket» som synlig segment — lukkede avvik skal aldri
  være uoppdagelig-filtrert. Default: alle unntatt Lukket, men segmentet viser antall.
- **G — navigasjonsidentitet:** HMS-avvik ER oppgave i data (beholdes), men presenteres i
  HMS-kontekst: lukking/fullføring returnerer til HMS-lista (ikke Oppgaver), og HMS-detaljen
  bærer HMS-brødsmule. Teknisk: retur-kontekst i navigasjonen, ikke ny rute.
- **Handlingsknapp/lesevisning:** «ikke din ball»-tilstanden er korrekt, men får samme
  perspektiv-vokabular som flytmodellen («Hos {faggruppe}») i stedet for stum lesevisning.

## 6. Foreslått ordre-rekkefølge (for cowork-nedbryting)

1. **Domene-wire** (§4) — liten, selvstendig, låser opp HMS-konfig. Først.
2. **Terminologi-pass** (§2) — tekst/i18n + forklaringsboks. Liten, bred, ufarlig.
3. **Kobling synlig begge veier** (§3a+3b) — kjernen i redesignet.
4. **HMS-velger + åpne-regel** (§5 E) — bygger på v2-velgeren som alt er live.
5. **HMS filter/navigasjon/vokabular** (§5 F+G) — kan gå parallelt med 3.
6. **Gruppe-picker ved flyt-opprett** (§3c) — sist; avhenger av 3.

Hver ordre med egen regresjons-fasit; §5 E må eksplisitt oppdatere Funn C-fasiten (pkt 3 snur).

## 7. Åpne spørsmål til Kenneth (ikke-blokkerende for ordre 1–2)

- «Tilgangsgruppe» som nytt UI-navn — ok, eller foretrekkes annet ord?
- §5 E åpne-regel: bekreft at auto-hopp skal bort OGSÅ for sjekkliste (én regel overalt), ikke bare HMS/oppgave.
- Skal koblingen Gruppe↔Faggruppe være redigerbar fra begge sider (anbefalt) eller kun fra brukere-siden?
