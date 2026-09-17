# Fabel-katalog — SiteDoc (per 2026-09-17)

Alle stier er relative til `~/Documents/Programmering/SiteDoc/`.

- **Datoer:** datoen i filnavnet eller dokumenthodet brukes der den finnes. Ellers brukes `git log`. Filene i `relay/` er gitignorert, så for dem er endringsdatoen brukt.
- **Omfang:** `docs/redesign/` (inkl. undermapper), `docs/claude/`-filer om Fabel og `relay/fabel-*`, `til-fabel-*` og `inbox-fabel*`.
- **Kopier:** filer i `docs/redesign/til-fabel/` som også ligger i `relay/` er merket «(kopi)».
- **Leveransepakker:** alle pakkene i `Fra fabel/til-repo-*` er lagt inn i repoet. Den siste er fra 16.09 kl. 15:45.

---

## 1. Prosess, rammeverk og samarbeid

| Dato | Fil | Type | Sammendrag | Status |
|---|---|---|---|---|
| 07-10 | docs/redesign/steg-viii-kunderunde.md | runbook | Kunderunde mot prod-kopi på egen redesign-stack | plan godkjent, infra ikke satt opp |
| 07-12 | docs/redesign/FABEL-RAMMEVERK.md | vedtak | Fabels to hovedoppgaver, exit-protokoll a–d og DoD med skjermbilde-gate | besluttet |
| 07-21 | docs/claude/FABEL-OVERLEVERING-2026-07-21.md | overlevering | Status ved øktskifte, lukkede saker og kø | historisk |
| 08-19 | docs/redesign/ordre-demo-smoketest-fabel-2026-08-19.md | ordre | Smoketest av demo-løypa før Markussen-møtet | utført |
| 08-20 | docs/redesign/til-fabel-amarkussen-2026-08-20.md | kall | Rapport fra kundemøtet med A. Markussen og tekniske funn | besvart |
| 08-20 | docs/redesign/referat-markussen-ordreliste-fabel-2026-08-20.md | referat | Prioritert ordreliste; «mange klikk» som gjennomgående krav | besluttet |
| 09-04 | docs/redesign/til-fabel/LES-MEG.md | info | Fem cowork-notater flyttet fra `relay/` til repoet | info |
| 09-04 | docs/redesign/til-fabel/BESTILLING-masterplan-2026-09-04.md | kall | Fire nye saker (EX, BL, LP, AG) og bestilling av masterplan-tillegg | besvart |
| 09-05 | docs/redesign/TILLEGG-masterplan-fabel-2026-09-05.md | tillegg | Nye rader og ny rekkefølge; web og mobil designes samtidig | innflettet |
| 09-06 | docs/redesign/mockups/README.md | regel | Mockup-HTML speiles til repoet som gate-referanse | besluttet |
| 09-11 | docs/redesign/REDESIGN-MASTERPLAN.md | styringsdok | Eneste masterplan (vedlikeholdt av cowork) | levende |
| 09-11 | relay/til-fabel-2026-09-11-to-gater.md | kall | To gater venter: SJA-skjermbilder (P0) og MK C-lista; AG nevnt | **ventende svar** |
| 09-12 | relay/inbox-docs-fabel-1700-1750(+TILLEGG-1).md, inbox-docs-fabel-1835.md | ordre (docs) | Fabel-leveranser lagt inn i repoet | utført |
| 09-15 | docs/redesign/korrigerende-ordre-cowork-rolledrift-fabel-2026-09-15.md | ordre | Testsignalet var hult (mocks); cowork eier ordreadministrasjonen; fem punkter | **utførelse ikke dokumentert** |

## 2. Navigasjon, kontekstvelger, gating og modulhierarki

| Dato | Fil | Type | Sammendrag | Status |
|---|---|---|---|---|
| 07-05 | docs/redesign/K-BESLUTNINGER.md | vedtak | K1–K11 for paritetssjekklisten | K3/7/8/11 utsatt, K9 venter |
| 07-06 | docs/redesign/redesign-handoff.md | spec | Handoff-spec for navigasjon og innstillinger, web og mobil | aktiv |
| 07-08 | docs/redesign/screenshots/F1-F5-web-2026-07-08/README.md | gate-underlag | Skjermbilder F1–F5 til designgodkjenning | historisk |
| 07-12 | docs/redesign/screenshots/runde3-sidebar-2026-07-12/render.html | mockup | Sidebar med høykontrast-markør, amber firma-sone og kollapsbare soner | historisk |
| 07-15 | docs/redesign/Innstillinger Redesign.dc.html | mockup | Prototyper 1a–2c for navigasjon og innstillinger | historisk |
| 08-21 | docs/redesign/ordre-kontekstvelger-1a-fabel-2026-08-21.md | ordre | Kontekstvelger v2, retning 1a «trakt i ett løp» | besluttet |
| 08-28 | relay/fabel-nav-gating-modellen.md (+kopi) | kall | Skal navigasjonen ha en tilgangsmodell? | besvart via modulhierarki |
| 08-30 | relay/fabel-o12-gating-avvik.md (+kopi) | kall | O12-ordren motsa seg selv; cowork valgte `harFirmaTilgang` | avgjort |
| 08-31 | relay/fabel-modulhierarkiet-revisjon.md | kall | Revisjon av modulhierarkiet | besvart |
| 08-31 | docs/redesign/modulhierarki-designnotat-fabel-2026-08-31.md | designnotat | Hva «aktivert» betyr per nivå, og hvem som eier flatene | V1–V3 besluttet |
| 08-31 | relay/fabel-modulhierarki-v2-ja-og-to-korreksjoner.md | svar | V2 godkjent med to korreksjoner | besluttet |

## 3. Arkivmaler og arkiv-PDF

| Dato | Fil | Type | Sammendrag | Status |
|---|---|---|---|---|
| 08-11 | docs/redesign/dokumentgenerering/FABEL-SPEC-TILLEGG2-og-loggseksjon.md | designnotat | Innstillinger styrer kun presentasjonen; loggseksjonen | besluttet |
| 08-12 | docs/redesign/dokumentgenerering/fase3-baseline-utskrift-2026-08-12.md | baseline | Låst før-baseline for utskrift | låst |
| 08-13 | docs/redesign/dokumentgenerering/Arkivmal PDF Mockup.dc.html | mockup | Første arkivmal-mockup | erstattet |
| 08-15 | docs/redesign/utskriftsformer-nakrav-og-backlogg-fabel-2026-08-15.md | vedtak | N1/N2: payload er en liste av dokumenter, og malbegrepet er flertall | besluttet |
| 08-15 | docs/redesign/arkivmal-repeaterbilder-vedtak-fabel-2026-08-15.md | vedtak | Repeater-bilder i full bredde under raden | besluttet (nummer overstyrt 08-16) |
| 08-16 | docs/redesign/arkivpdf-seks-funn-vedtak-fabel-2026-08-16.md | vedtak | Seks prod-funn på BEF-001 | besluttet |
| 08-16 | docs/redesign/vaerdata-snapshot-vedtak-fabel-2026-08-16.md | vedtak | Værdata lagres som snapshot ved befaring | besluttet |
| 08-16 | docs/redesign/arkivmal-pdf-mockup/Arkivmal PDF Mockup.dc.html | mockup | Oppdatert med repeaterbilde-vedtaket | historisk |
| 08-21 | docs/redesign/designnotat-arkivmal-pdf-fabel-2026-08-21.md | designnotat | D1 F7, D2 tegninger og D2b helsideprint | besluttet |
| 08-21 | docs/redesign/tillegg-designnotat-arkivmal-d2b-fabel-2026-08-21.md | tillegg | Detaljutsnitt i tabellraden | besluttet |
| 08-21 | docs/redesign/beslutning-repeater-label-modell-fabel-2026-08-21.md | vedtak | D8 én repeatermodell; D9 informasjonsfelt | besluttet |
| 08-21 | docs/redesign/ordre-arkivmal-repeater-radkort-fabel-2026-08-21.md | ordre | Radkort (2a) og skalartabell (2b) | implementert |
| 08-21 | docs/redesign/ordre-arkivmal-tegning-d2-d2b-fabel-2026-08-21.md | ordre | Tegning og lokasjon i arkiv-PDF | implementert |
| 08-21 | docs/redesign/ordre-arkivmal-funn-3-4-6-tilbehor-fabel-2026-08-21.md | ordre | Markøravvik, kommentarer og felt-tilbehør | implementert |
| 08-21 | docs/redesign/ordre-arkivmal-f7-objektniva-fabel-2026-08-21.md | ordre | F7 «Registrert utenfor rader» | **DoD-restanse: skjermbevis 1 og 3** |
| 08-22 | docs/redesign/tillegg-arkivmal-f7-fasit-fabel-2026-08-22.md | tillegg | Fasit-PNG for F7 | besluttet |
| 09-03 | docs/redesign/ordre-galleri-flervalg-fabel-2026-09-03.md | ordre | Flervalg fra galleri på mobil | besluttet |
| 09-06 | docs/redesign/mockups/Arkivmal PDF Mockup.dc.html | mockup | Speilet gjeldende mockup | referanse |

## 4. Maler, malbygger, kvalitet og grensekrav (MK, Vei B, DG)

| Dato | Fil | Type | Sammendrag | Status |
|---|---|---|---|---|
| 09-02 | docs/redesign/designnotat-produkttekst-vs-firmainnhold-fabel-2026-09-02.md | designnotat | «Vi oversetter det vi har skrevet» | besluttet |
| 09-02 | docs/redesign/ordre-produkttekst-gjenkjenning-fabel-2026-09-02.md | ordre | Gjenkjenning av produkttekst og tidssoneregel | besluttet |
| 09-05 | docs/redesign/til-fabel/BESTILLING-malkvalitet-2026-09-05.md | kall | Fire funn fra NS 3420-malene | besvart |
| 09-05 | docs/redesign/kp-malkvalitet-svar-fabel-2026-09-05.md | svar | Kun eksisterende MalBygger-objekter, ingen snarveier | besluttet |
| 09-05 | docs/redesign/til-fabel/MAALING-vei-b-kostnad-2026-09-05.md | måling | Kostnaden for Vei B er mindre enn ventet | besvart |
| 09-05 | relay/fabel-malrevisjon-trafikklys-konvertering.md | gate-underlag | 34 trafikklys; behold og slank | underlag |
| 09-05 | docs/redesign/kp-malkvalitet-kall-premiss3-fabel-2026-09-05.md | vedtak | «PDF viser kravet» blir egen DG-sak | besluttet |
| 09-06 | docs/redesign/designnotat-pdf-grensekrav-fabel-2026-09-06.md | designnotat | Grensekrav og «UTENFOR KRAV» i arkiv-PDF | besluttet |
| 09-06 | docs/redesign/mockups/PDF Grensekrav Mockup.dc.html | mockup | Tre tilstander for krav | referanse |
| 09-06 | docs/redesign/underlag-grensekrav-2026-09-06.html / .pdf | underlag | Renderet PDF-underlag | referanse |
| 09-06 | docs/redesign/til-fabel/BESTILLING-avviksfelt-ved-grensebrudd-2026-09-06.md | kall | Avviksfelt ved grensebrudd | besvart |
| 09-06 | docs/redesign/designnotat-grenseresolver-tillegg-klarspraak-fabel-2026-09-06.md | tillegg | Minst/Høyst/Mellom i klarspråk | besluttet |
| 09-06 | docs/redesign/mockups/Avviksfelt Mockup.dc.html | mockup | Grenseresolver-familien | referanse |
| 09-06 | docs/redesign/designnotat-grenseresolver-tillegg2-kravtype-maalingforst-fabel-2026-09-06.md | tillegg | `kravType` lagres eksplisitt; måling først | besluttet |
| 09-06 | docs/redesign/designnotat-malbygger-grensevarianter-fabel-2026-09-06.md | designnotat | UI for betingede grenser (w-72) | besluttet |
| 09-06 | docs/redesign/mockups/MalBygger Grensevarianter Mockup.dc.html | mockup | Grense-konfig i panelbredde | fasit |
| 09-06 | docs/redesign/til-fabel/BESTILLING-grenseresolver-ordre-2026-09-06.md | kall | Spørsmål om cowork kan skrive resolver-ordren | besvart |
| 09-06 | docs/redesign/til-fabel/MAALING-grenseresolver-kostsjekk-2026-09-06.md | måling | Premiss 1 holder; `normaliserOpsjon` blokkerer | besvart |
| 09-06 | docs/redesign/fabel-svar-kostsjekk-grenseresolver-2026-09-06.md | svar | Trinn 0 og firetrinns ordre | besluttet |
| 09-06 | docs/redesign/avviksvedtak-grensevariant-tabell-fabel-2026-09-06.md | vedtak | Satt vs. arvet; «Ellers»-raden fjernes | besluttet |
| 09-06 | docs/redesign/mockups/Seksjonsstatus Mockup.dc.html | mockup | Seksjonsstatus i header (✓ / tall / ⚠) | referanse |
| 09-07 | docs/redesign/fabel-feltstatus-farge.md | kall | Farge for «her må noen ta en avgjørelse» | **åpen** |
| 09-11 | docs/redesign/kp-mk-c-konverteringsliste-2026-09-11.md | gate-underlag | MK C fase 1: de 34 trafikklysene | **ikke gatet** |
| 09-11 | docs/redesign/ordre-ka7-revisjon-fabel-2026-09-11.md | ordre | KA7-malrevisjon (NS 3420-K) | besluttet |
| 09-12 | docs/redesign/ordre-kb4-revisjon-fabel-2026-09-12.md | ordre | KB4 Grasdekker-revisjon | besluttet |

## 5. Malforvaltning, malarkiv og «Hent fra arkiv»

| Dato | Fil | Type | Sammendrag | Status |
|---|---|---|---|---|
| 09-04 | docs/redesign/designnotat-malarkiv-fabel-2026-09-04.md | designnotat | AM4 malarkiv: kopi med avstamning og versjonering | besluttet |
| 09-04 | docs/redesign/ORDRE-am4-malarkiv-fabel-2026-09-04.md | ordre | AM4 med designlås L1–L10 | implementert |
| 09-05 | docs/redesign/designgate-am4-og-ordre-am4b-fabel-2026-09-05.md | gate | AM4 godkjent; AM4b «velger ved skala» | godkjent |
| 09-12 | docs/redesign/README-mockup.md | designnotat | «Hent fra arkiv»; lån kun fra nivået over | besluttet |
| 09-12 | docs/redesign/mockup-hent-fra-arkiv-fabel-2026-09-12.dc.html | mockup | Interaktiv mockup med rollebryter | besluttet |
| 09-12 | docs/redesign/arkivredigering-designnotat-fabel-2026-09-12.md | designnotat | Checkbokser, «Hent kopi», versjonspublisering | besluttet |
| 09-12 | docs/redesign/avvik-arkivinngang-ordre-fabel-2026-09-12.md | ordre | Korrigerende ordre med steg 0 | utført |
| 09-12 | docs/redesign/svar-hent-fra-arkiv-beslutninger-fabel-2026-09-12.md | svar | Beslutning 1–3 (klient-gate, myk landing) | besluttet; server-gate gjenstår |
| 09-12 | docs/redesign/endringsordre-fjern-prosjektmaler-fabel-2026-09-12.md | ordre | `[prosjektId]/maler` fjernes med redirect | besluttet |
| 09-13 | docs/redesign/malforvaltning-ia-notat-fabel-2026-09-13.md | designnotat | Innstillinger › Malforvaltning med faner | gjeninnført 09-15 |
| 09-13 | docs/redesign/malforvaltning-ia-mockup-fabel-2026-09-13.dc.html | mockup | Fire skjermer for Malforvaltning | gjeninnført 09-15 |
| 09-14 | docs/redesign/malstruktur-ia-v2-notat-fabel-2026-09-14.md | designnotat | V2: nivået styres av kontekstvelgeren | **utgått 09-15 (ikke merket)** |
| 09-14 | docs/redesign/malstruktur-ia-v2-mockup-fabel-2026-09-14.dc.html | mockup | Mockup av v2 | **utgått 09-15** |
| 09-14 | docs/redesign/ks-sitedoc-niva-vei-c-fabel-2026-09-14.md | KS-vedtak | Vei C (objekt-tabell på BibliotekMal), krav 1–7 | besluttet; repeater-spørsmål hos Kenneth |
| 09-14 | docs/redesign/avviksgodkjenning-b-heading-rader-fabel-2026-09-14.md | vedtak | Avvik B godkjent | besluttet |
| 09-15 | docs/redesign/vedtak-malforvaltning-modell-fabel-2026-09-15.md | vedtak | Malforvaltning-modellen gjelder, v2 utgår, PR 2 på vent | **ett åpent spørsmål** |

## 6. Lokasjon, byggeplass og filter

| Dato | Fil | Type | Sammendrag | Status |
|---|---|---|---|---|
| 08-27 | docs/claude/omrader-akse-naastatus-fabel-2026-08-27.md | nå-status | Områder-aksen: tre av fire ledd bygget | fakta |
| 08-29 | relay/fabel-lokasjonsmodellen.md (+kopi) | kall | «Ingen lokasjon» finnes ikke som valg | besvart |
| 08-29 | relay/fabel-faste-felt.md | kall | FASTE FELT lover styring som ikke finnes | besvart |
| 08-29 | relay/fabel-duplisert-lokasjonsvelger.md | kall | To flater for å sette punkt på tegning | **ingen svar funnet** |
| 08-29 | docs/redesign/lokasjonsmodellen-designnotat-fabel-2026-08-29.md | designnotat | Lokasjonskrav på malen | erstattet |
| 08-29 | docs/redesign/faste-felt-designnotat-fabel-2026-08-29.md (+TILLEGG) | designnotat | Aktiveringsmodell; PDF «Lokasjon: Byggeplass» | besluttet |
| 08-29 | docs/redesign/inbox-opus-faste-felt-TILLEGG-avvik-A2.md | avvik | Emne settes på detaljsiden | besluttet |
| 09-02 | docs/redesign/fabel-lokasjon-begrepsavklaring.md | kall | Tre ting heter «lokasjon» | besvart |
| 09-02 | docs/redesign/designnotat-lokasjon-begrepsmodell-fabel-2026-09-02.md | designnotat | Skillet bæres av `drawingId` | avløst 09-04 |
| 09-04 | docs/redesign/designnotat-lokasjonsmodellen-fabel-2026-09-04.md | designnotat | «Hele byggeplassen» som gyldig svar | besluttet |
| 09-04 | docs/redesign/ORDRE-lokasjonomfang-2026-09-04.md (+TILLEGG-L9) | ordre | `lokasjonOmfang`; sticky tegning (L9) | besluttet |
| 09-06 | docs/redesign/til-fabel/BESTILLING-mykt-byggeplassfilter-2026-09-06.md | kall | Dokumenter uten byggeplass vises overalt | besvart |
| 09-06 | docs/redesign/designkall-byggeplassfilter-fabel-2026-09-06.md | vedtak | Mykt filter, badge «Hele prosjektet» | besluttet |
| 09-06 | docs/redesign/mockups/Byggeplassfilter Mockup.dc.html | mockup | Filter på mobil | referanse |
| 09-06 | docs/redesign/tillegg-byggeplassfilter-tegninger-nb-fabel-2026-09-06.md | tillegg | Tegninger tas i samme ordre | besluttet |
| 09-06 | docs/redesign/designkall-dokumentsok-mobil-fabel-2026-09-06.md | vedtak | Fritekstsøk og filter i mobil dokumentliste | **designlås, ingen ordre** |
| 09-06 | docs/redesign/mockups/Dokumentsøk Mobil Mockup.dc.html | mockup | Søk, trakt og bottom sheet | referanse |

## 7. Kontakter, brukergrupper, firmaroller og synlighet

| Dato | Fil | Type | Sammendrag | Status |
|---|---|---|---|---|
| 08-05 | docs/redesign/spor1-mockup-v2/Spor 1 Kort Mockup v2.dc.html | mockup | Kontaktside med tilgangsmatrise | historisk |
| 08-07 | docs/redesign/firmarolle/firmarolle-konsolidering-svar-fabel-2026-08-07.md | svar | `firmaRoller` som én kilde | besluttet |
| 08-07 | docs/redesign/firmarolle/firmarolle-mockup-2026-08-07.html | mockup | Ansatte-siden og HMS-kilder | historisk |
| 08-20 | docs/redesign/ordre-synlighet-vedtak-b-fabel-2026-08-20.md | ordre | Synlighetsvedtak B | overstyrt |
| 08-20 | docs/redesign/vedtak-synlighet-revidert-fabel-2026-08-20.md | vedtak | B allerede implementert; deletedAt-fiks | besluttet |
| 09-08 | docs/redesign/fabel-kontakter-ia.md | kall | Kontakter-flaten: splitt og forslag | besvart |
| 09-08 | docs/redesign/kp-kontakter-ia-svar-fabel-2026-09-08.md | svar | Tre nivåer: kontakter, brukergrupper og personkort | gatet |
| 09-08 | docs/redesign/mockup/Kontakter IA Mockup.dc.html | mockup | Interaktiv mockup av kontakter | besluttet |
| 09-08 | docs/redesign/ORDRE-kontakter-tre-nivaaer-2026-09-08.md | ordre | «Brukergruppe» erstatter «Tilgangsgruppe» | implementert |
| 09-09 | docs/redesign/kp-modal-avvik-svar-fabel-2026-09-09.md | vedtak | Ett forent søkefelt | besluttet |
| 09-09 | docs/redesign/kp-til-fabel-kontakter-status-2026-09-09.md | kall | Designgodkjenning ønskes | besvart |
| 09-10 | docs/redesign/fabel-svar-kontakter-status-2026-09-10.md | gate | Designgodkjenning gitt | godkjent |

## 8. Dokumentflyt

| Dato | Fil | Type | Sammendrag | Status |
|---|---|---|---|---|
| 08-21 | docs/redesign/vedtak-flytmodell-rekkefolge-fabel-2026-08-21.md | vedtak | Rekkefølgen styrer; kun registrator beholdes | besluttet |
| 08-21 | docs/redesign/designnotat-flytmodell-fjerning-fabel-2026-08-21.md | designnotat | Fjerning av ledd-typer og override-modell | fasit |
| 08-21 | docs/redesign/svar-flytmodell-lukk-slett-fabel-2026-08-21.md | svar | «Lukk» som port før sletting | besluttet |
| 09-16 | docs/redesign/videresend-byttflyt-tegning-fabel-2026-09-16.md (+.dc.html) | designnotat + mockup | Én «Videresend» med synlig konsekvens | gatet; **mobil og varsling ikke tegnet** |
| 09-16 | relay/inbox-fabel.md | ordre til Fabel | Bundet flyt, krav A–E | besvart |
| 09-16 | docs/redesign/bundet-flyt-tegning-fabel-2026-09-16.md (+.dc.html) | designnotat + mockup | «Bundet flyt»: default fri, symbolet `Anchor` | gatet; **ordre/skjemabestilling mangler** |

## 9. Kontrollplan

| Dato | Fil | Type | Sammendrag | Status |
|---|---|---|---|---|
| 08-12 | docs/redesign/kontrollplan-revisjon/Kontrollplan Revisjonsdiff Mockup.dc.html | mockup | Revisjonsdiff mot fremdriftsplan | historisk |
| 08-13 | docs/redesign/kontrollplan-helhetsplan.md | plan | P0: koble og starte sjekklister fra planen | besluttet |
| 08-14 | docs/redesign/kp-l1-svar-vei1-2026-08-14.md | vedtak | Merge, deretter skjermbilde-gate | besluttet |
| 08-14 | docs/redesign/kp-l1-gatekrav-2026-08-14.md | gatekrav | Bevisliste for L1 | oppfylt |
| 08-14 | docs/redesign/kp-l1-godkjent-2026-08-14.md | gate | L1 godkjent | godkjent |
| 08-14 | docs/redesign/kp-l2-designgate-fabel-2026-08-14.md | gate | L2 betinget godkjent | betinget |
| 08-14 | docs/redesign/kp-flytmodell-vedtak-og-l2-gate-2026-08-14.md | vedtak | Kontrollpunktet eier `dokumentflytId` | besluttet |
| 08-15 | docs/redesign/kp-l2-m1-gate-godkjent-fabel-2026-08-15.md | gate | M1 og B1 godkjent | godkjent |
| 08-15 | docs/redesign/kp-l16-b1-gate-godkjent-fabel-2026-08-15.md | gate | L1.6 og B1 godkjent med merknader | godkjent |
| 08-15 | docs/redesign/kp-m1-tegningsmarkor-svar-fabel-2026-08-15.md | svar | Kraftigere markørkant | lukket |

## 10. SJA, HMS og ansvarsgrense

| Dato | Fil | Type | Sammendrag | Status |
|---|---|---|---|---|
| 08-05 | docs/redesign/spor2-hms-mockup/Spor 2 HMS Mockup.dc.html | mockup | HMS i felles oppsett-UI | historisk |
| 08-06 | docs/redesign/spor2-hms-mockup/spor2-hms-mockup-godkjent-2026-08-06.html | mockup | Godkjent Spor 2 | godkjent |
| 08-07 | docs/redesign/spor2-hms-mockup/spor2-hms-behandlingsmonster-godkjent-2026-08-07.html | mockup | Melder eier innholdet, behandler eier handlingen | godkjent |
| 09-02 | docs/redesign/ks-hms-terminologi-pl-lt-sq-fabel-2026-09-02.md | KS | HMS-termer på pl/lt/sq; lt og sq har feil | **rettelser blokkerer pilot** |
| 09-05 | docs/redesign/til-fabel/BESTILLING-sja-signaturer-2026-09-05.md | kall | SJA kan ikke dokumentere signaturer (P0) | besvart |
| 09-05 | docs/redesign/sja-signaturer-tillegg-levende-liste-fabel-2026-09-05.md | tillegg | Levende deltakerliste og ny gjennomgang | besluttet |
| 09-05 | docs/redesign/sja-signaturer-runder-modell-fabel-2026-09-05.md | designnotat | Signaturrunder erstatter versjoner | besluttet |
| 09-05 | docs/redesign/sja-signaturer-laasutloser-fabel-2026-09-05.md | vedtak | «Avslutt runde» utløser låsen | besluttet |
| 09-05 | docs/redesign/til-fabel/MAALING-sja-signaturmodell-2026-09-05.md | måling | SJA er Checklist, RUH er Task | besvart |
| 09-06 | docs/redesign/ORDRE-sja-signaturrunder-2026-09-06.md | ordre | SignaturRunde-modell og låsing | implementert |
| 09-06 | docs/redesign/mockups/SJA Signaturer Mockup.dc.html | mockup | Manko først, runder | fasit |
| 09-06 | docs/redesign/til-fabel/skjermbilde-underlag-sja-signaturrunder-2026-09-06.md | gate-underlag | Åtte flater før prod | **gate ikke kjørt** |
| 09-06 | docs/redesign/til-fabel/BESTILLING-sja-varig-arbeid-2026-09-06.md | kall | SJA over flere dager | besvart |
| 09-06 | docs/redesign/sja-varig-arbeid-svar-fabel-2026-09-06.md | svar | Flyt-låsen unntar signaturlista | besluttet |
| 09-06 | docs/redesign/sja-daglig-gjennomgang-stroket-fabel-2026-09-06.md | gate | Daglig gjennomgang strøket | **skjermbilde-gate åpen** |
| 09-06 | docs/redesign/ag-ansvarsgrense-produkttekst-fabel-2026-09-06.md | designnotat | «Ansvar og leveranse»: produkttekst | godkjent for HMS-nivå |
| 09-06 | docs/redesign/til-fabel/BESTILLING-ag-systemniva-2026-09-06.md | kall | AG trenger systemnivå | besvart |
| 09-06 | docs/redesign/ag-systemniva-tekst-fabel-2026-09-06.md | designnotat | Struktur, spor og varsling vs. bedriftens ansvar | **til Kenneth-gate** |
| 09-06 | docs/redesign/mockups/Ansvarsgrense Mockup.dc.html | mockup | Side under Firmaoppsett | referanse |

## 11. Timer, utlegg, attestering og vedlegg

| Dato | Fil | Type | Sammendrag | Status |
|---|---|---|---|---|
| 07-12 | docs/redesign/screenshots/runde4-timeforing-2026-07-12/render.html | mockup | Timeføring: maskin i rad, splitt per arbeider | historisk |
| 07-13 | docs/redesign/screenshots/runde5-tilkl-2026-07-13/render.html | mockup | «Arbeidstid i dag» | historisk |
| 08-07 | docs/redesign/vedleggsmonster/vedleggsmonster-svar-fabel-2026-08-07.md (+mockup) | svar | Tilstanden bor på brikken, aldri i toast | besluttet |
| 08-07 | docs/redesign/utlegg/utlegg-vs-tillegg-svar-fabel-2026-08-07.md | svar | Tillegg er avtalt sats, utlegg er dokumentert kostnad | besluttet |
| 08-08 | docs/redesign/utlegg/utlegg-ordningsmodell-spec-fabel-2026-08-08.md | spec | Tre ordninger | besluttet |
| 08-08 | docs/redesign/utlegg/utlegg-avklaringer-fabel-2026-08-08.md | svar | CHECK-constraint og avklaringer | besluttet |
| 08-08 | docs/redesign/utlegg/utlegg-registreringsflyt-mockup-2026-08-08.html | mockup | Utlegg på dagsseddelen | historisk |
| 08-20 | docs/redesign/designnotat-attestering-fabel-2026-08-20.md | designnotat | Ukenorm og overtidsregel | besluttet |
| 08-24 | docs/redesign/gatekvittering-d3-pivot-fabel-2026-08-24.md | gate | D3 pivot bestått; Timer-sporet lukkes | godkjent |

## 12. Eksport og printmotor

| Dato | Fil | Type | Sammendrag | Status |
|---|---|---|---|---|
| 08-25 | docs/redesign/designnotat-eksportvalg-fakturagrunnlag-fabel-2026-08-25.md | designnotat | Navngitte eksportformål | besluttet |
| 08-25 | docs/redesign/eksportvalg-mockup/Eksportvalg Mockup.dc.html | mockup | Malvelger ved eksport | historisk |
| 08-27 | relay/fabel-eksport-fase4-byggherredokument.md | kall | Byggherredokumentet | besvart |
| 08-27 | docs/redesign/designnotat-eksport-fase4-byggherre-fabel-2026-08-27.md | designnotat | Formålet «Fakturagrunnlag» | implementert (prod 08-28) |
| 08-27 | relay/fabel-eksport-arkivering.md (+kopi) | kall | Eksport skal arkiveres, ikke lastes ned | **ingen svar funnet** |

## 13. Prosjektoppsett, registrering og livssyklus

| Dato | Fil | Type | Sammendrag | Status |
|---|---|---|---|---|
| 08-28 | relay/fabel-nytt-prosjekt-innhold.md | kall | Nytt prosjekt er et tomt skall | besvart |
| 08-28 | docs/redesign/designnotat-nytt-prosjekt-innhold-fabel-2026-08-28.md | designnotat | Blankt med «kopier oppsett» | delvis revidert |
| 08-28 | relay/fabel-tillegg-veileder-tegning-2026-08-28.md | tillegg | Steg 4 blir grønt når første tegning finnes | besluttet |
| 08-28 | relay/fabel-registreringsmodellen.md | kall | Én registreringsmodell | besvart |
| 08-28 | docs/redesign/designnotat-registreringsmodellen-fabel-2026-08-28.md | designnotat | `OrganizationMember` får status | **til Kenneths valg, ingen vedtaksfil** |
| 08-30 | relay/fabel-firmanivaaet-mangler-styring.md (+kopi) | kall | Firma kan ikke starte eller avslutte prosjekter | besvart via FL |
| 09-06 | docs/redesign/fl-prosjektlivssyklus-fabel-2026-09-06.md | designnotat | Fire tilstander | overstyrt |
| 09-06 | docs/redesign/mockups/Prosjektlivssyklus Mockup.dc.html | mockup | Firmaet styrer egne prosjekter | referanse |
| 09-06 | docs/redesign/fl-revisjon-tilgang-fabel-2026-09-06.md | vedtak | «Avsluttet» betyr stengt; eksportarkiv kreves først | besluttet |

---

## Vedlegg: bildefiler og hjelpefiler

- **Fasit-PNG:** `mockup-2a/2b/2c`, `mockup-f7-objektniva-vedtatt.png` og `fasit/` med K3 og P1.
- **`mockup-bilder/`:** fire tilstander for «Hent fra arkiv».
- **`screenshots/`:** 51 filer fra juli.
- **Hjelpefiler for `.dc.html`:** `support.js`, `doc-page.js`, `kick.js` og `assets/sitedoc-logo.png`.

---

## Det Fabel etterlot uferdig

**Gater som venter:**

1. **SJA-skjermbilde-gaten (P0, lovpålagt).**
   - Underlaget er klart.
   - Purret 09-11.
   - Masterplanen sier «venter kun fabels gate».
2. **MK C-konverteringslista (34 trafikklys).** Ikke gatet.
3. **AG-systemnivåtekst.** Venter på Kenneth-gate, og det finnes ingen vedtaksfil.

**Designspørsmål uten svar:**

4. **Feltstatus-farge.** Kallet er fra 09-07. Svaret skulle inn i `ui-standarder.md`, men mangler der.
5. **Duplisert lokasjonsvelger** (08-29).
6. **Arkivering av eksport** (08-27).
7. **BL, byggeplass-livssyklus** (masterplan-sak).

**Ordrer som burde vært skrevet:**

8. **Malforvaltning-flaten, nivåbanneret og modal-søk.**
   - Notatene er fra 09-13 og 09-15.
   - Vedtaket 09-15 viser til `svar-stopgate-ab-v2-fabel-2026-09-15.md`, som **ikke finnes i repoet**.
9. **Bundet flyt.**
   - Gatet 16.09, men bestilling av skjemaendring og ordre mangler.
   - Mobilrunden gjenstår.
10. **Videresend/bytt flyt.** Mobil-layout og mottakervarsling er ikke tegnet.
11. **Dokumentsøk på mobil.** Designlåst, men ingen ordre.

**Åpent hos Kenneth:**

12. Skal `firma/malarkiv` bestå eller rives? Fabel anbefalte å rive. PR 2 står på vent til dette er avgjort.
13. **Vei C:** nesting i sentralmaler og gate på migrerings-SQL.
14. **Registreringsmodellen:** valget er ikke tatt.

**Ryddepunkter:**

15. Malstruktur v2 (notat og mockup fra 09-14) er utgått, men ikke merket som det.
16. Det er ikke dokumentert at den korrigerende ordren til cowork (09-15) er utført.
17. DoD-restanse på F7: skjermbevis 1 og 3.
18. HMS-terminologi på lt/sq blokkerer piloten.
