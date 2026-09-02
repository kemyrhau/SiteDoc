# Designnotat: lokasjon — begrepsmodellen som lar ordrer skrives

**Fra:** fabel · **Dato:** 2026-09-02 · **Svar på:** `docs/redesign/fabel-lokasjon-begrepsavklaring.md` (cowork 2026-09-02)
**Status:** forslag — venter Kenneth-vedtak på V1–V3 nederst. Ingen kode i denne runden.
**Bygger på:** `faste-felt-designnotat-fabel-2026-08-29.md` (aktiveringsmodellen, nå MERGET `30260f88`) — dette notatet endrer ikke den modellen, det fullfører begrepsapparatet rundt den.

> **Premiss-korreksjon til coworks notat:** spørsmålene ble stilt før FASTE FELT-merget.
> Aktiveringsmodellen er nå kodet og på test (STATUS-AKTUELT § FASTE FELT): `showLocation`
> gater rendringen, feltet er passivt («+ Legg til lokasjon») til brukeren aktiverer, og PDF
> skriver byggeplass-linja alltid (designlås 2, `ramme.ts:73-76`). Flere av svarene under er
> derfor «modellen finnes — den mangler navn og én paritetsregel», ikke nybygg.

---

## Svar 1 — «ingen lokasjon» er allerede et eksplisitt valg. Skillet bæres av `drawingId`.

**Ingen ny kolonne, ingen tristate, ingen bekreftelsesdialog.** Aktiveringsmodellen gjør
fraværet eksplisitt by construction: lokasjon oppstår kun ved en aktiv brukerhandling, så
et dokument uten lokasjon ER et dokument der brukeren har valgt bort lokasjon. En egen
«gjelder hele byggeplassen»-avkrysning ville vært dobbel sikring oppå et default
(effektivitets-gaten pkt. 3: forbudt som standard).

Og datamodellen skiller de tre tilstandene i dag, med eksisterende kolonner:

| Tilstand | Data (`Checklist`-raden) | Betydning |
|---|---|---|
| **Ingen lokasjon** | `drawingId = null` | Ferdig, gyldig svar — dokumentet gjelder byggeplassen |
| **Ikke satt ennå** | `drawingId` satt · `positionX/Y = null` | Underveis: tegning valgt (aktivert eller arvet fra kontrollpunkt, `b987d793`) men punkt mangler |
| **Punkt satt** | `drawingId` + `positionX/Y` satt | Stedfestet på tegning |

Coworks setning «data kan ikke skille dem» var sann for `positionX/Y` isolert — men
`drawingId` bærer skillet. «Ikke satt ennå» uten tegning finnes ikke lenger som tilstand:
uten tegning er det ingenting som venter.

**På skjermen** finnes de tre tilstandene allerede i `LokasjonVelger`
(`ingenLokasjon`/`leggTil` · `utenPunkt` · `punktSatt` — `LokasjonVelger.tsx:186-215`).
Ingen ny UI.

**Konsekvens for den sperrede ordren:** `relay/inbox-lokasjon-autoapne.md` forblir død i
sin auto-form (Kenneth trakk premisset 29.08). Skulle en fremtidig hjelpefunksjon ønskes,
er utløseren nå entydig definerbar: kun tilstand «ikke satt ennå» (`drawingId` satt, punkt
mangler) — aldri `drawingId = null`. Det er nok til å skrive en ordre den dagen Kenneth
vil, men ingenting i dette notatet bestiller den.

## Svar 2 — begrepene kollapser til ÉN modell: tegningsmarkøren. To bærere består, én relikvi avvikles.

**Kanonisk begrep: tegningsmarkør** = `drawingId + positionX + positionY` (prosent),
rendret av `byggTegningPosisjon` med harMarkor-regelen (tegning uten punkt dokumenterer
ingenting — Kenneth 2026-08-21, `tegningsfelt.ts:33-38`). PDF-en er fasit, og dette er
nøyaktig det PDF-en rendrer på BEF_-004. Markøren finnes på to nivåer, og begge består
fordi de svarer på ulike spørsmål:

- **Dokumentnivå** (`Checklist.drawingId/positionX/Y`): *hvor gjelder dokumentet.*
- **Feltnivå** (`drawing_position`-rapportobjekt, typisk i repeater-rad): *hvor er dette
  funnet/denne kontrollen.* Flere per dokument, nummerert mot oversikten (D2b).

Samme renderer, samme utelatelsesregel, samme koordinatformat — det er ikke to begreper,
det er ett begrep med to festepunkter.

- **`ReportTemplate.showLocation` består, men er ikke en lokasjon** — det er malens
  tillatelsesbryter for dokumentnivå-markøren. Omdøpes i malbygger-UI til noe som sier det
  («Tillat lokasjon (tegning + punkt)»); kolonnenavnet i DB røres ikke.

- **`location`-rapportobjektet er relikvien og avvikles.** Fakta (målt 2026-09-02, web):
  ren tekst med fallback til prosjektadressen (`RapportObjektVisning.tsx:384-390`), skjult
  i utfylling (`RapportObjektRenderer.tsx:45`), PDF-en skriver den aldri (`felt.ts` frossen
  → `""`), `harAktivLocation` har fortsatt ingen konsument, og objektet lever kun i fem
  default-topptekst-seeds (`shared/types/index.ts:500-613`). **Dagens tilstand er et
  flateparitets-brudd:** web-lesevisning viser en adresselinje PDF-en bevisst utelater.
  PDF-en er fasit → objektet fjernes fra palett og seeds; informasjonen den bar
  (byggeplass/adresse) bæres allerede av prosjektblokken i PDF (Byggeplass-cellen skrives
  alltid) og av kontekstheaderen på web/mobil.
  - *Migrering:* eksisterende maler med objektet — fjernes ved malrydding (samme runde som
    D8/D9-ryddingen), historiske dokumenter re-rendres ikke.
  - 🔴 *Negativ påstand, kandidatmengde:* «ingen konsument» er målt i `apps/web/src` +
    `packages/pdf/src`. **Mobil (`apps/mobile`) og api er IKKE målt av meg — cowork
    verifiserer før avviklingsordre skrives.** Enkeltmålt til det er gjort.

Etter dette har systemet to lokasjonsbegreper i stedet for tre, og begge heter det de er:
**tillatelsen** (malen) og **markøren** (dokument- eller feltnivå).

## Svar 3 — `showLocation` når rapporten gjelder hele byggeplassen

`showLocation` betyr **«denne dokumenttypen KAN stedfestes på tegning»** — aldri «har» og
aldri «må». «Hele byggeplassen» er ikke en tilstand av bryteren; det er fraværet av markør
(svar 1), og byggeplassen bæres alltid av dokumentets kontekst, på alle fire flater:

| Flate | showLocation = på, ingen markør | showLocation = av |
|---|---|---|
| **Malbygger** | Bryter på: «Tillat lokasjon (tegning + punkt)» | Bryter av |
| **Web** | Passivt felt «+ Legg til lokasjon»; byggeplass i header | Feltet rendres ikke |
| **Mobil** | Samme to tilstander som web (paritetskrav — måles) | Feltet rendres ikke |
| **PDF** | Ingen lokasjonsseksjon; Byggeplass-cellen i prosjektblokken skrives alltid | Samme |

Ingen «Lokasjon: hele byggeplassen»-linje i PDF — det ville sagt med syv ord det
Byggeplass-cellen alt sier med to (avgjort i faste-felt-runden, spørsmål 1; står).

## Flateparitets-regelen som mangler (den ene nye regelen dette notatet innfører)

Tilstanden «ikke satt ennå» (tegning uten punkt) er en **arbeidstilstand, ikke
dokumentinnhold**. PDF-en utelater den (harMarkor/BEF-001-regelen). For paritet skal
**lesevisning** på web og mobil følge samme regel: komplett markør → vis utsnitt/chip;
ellers → vis som «ingen lokasjon». Bare **redigeringsflaten** viser mellomtilstanden
(«Tegning valgt — punkt mangler»), for det er der den er handlingsbar. Én delt
harMarkor-hjelper (finnes i `tegningsfelt.ts` — flyttes til shared ved behov), aldri tre
lokale varianter.

Dette er samme snitt Kenneth la for endringsloggen (PDF komprimerer, web/mobil rendrer alt
→ loggen er oppslagsverktøy): PDF-ens valg er fasit for hva som er *dokumentets innhold*;
det redigeringsflaten viser i tillegg er *arbeidsstøtte*, og det er et bevisst tillegg per
ui-standarder § Flateparitet.

## Kenneths gate-funn 29.08: «duplisert lokasjonsvelger» — rutes inn her

Funnet (modal-velgeren på detaljsiden vs. navigering til Tegninger-siden) er samme sak:
**dokumentnivå-markøren skal ha ÉN settevei** — modal-velgeren på detaljsiden.
Tegnings-navigeringsflyten (`?posisjonsvelger=`) forblir repeater-feltenes vei (Kenneths
begrunnelse for repeater-unntaket står: brukeren skal aldri lure på om det er dokumentet
eller raden som markeres). Inventar av de to veiene tas i ordren
(funksjonsinventar-gaten), ikke her.

## 🟢 KENNETH-VEDTAK 2026-09-02 — svar på V1–V3, pluss én ny regel

> *«Hvis vi har locationfelt og bruker ikke setter location → ingen tegning på rapporten. Dersom
> location settes, da setter vi en prikk. Dersom vi benytter en tegning sammen med repeater, og
> sjekklisten/oppgaven ikke har lokasjon satt, da husker repeater n hvilken tegning som var brukt
> i repeater(n-1).»*

**V1 — VEDTATT.** Fraværet av markør er svaret. Ingen egen bryter, ingen bekreftelse.

**V2 — VEDTATT, og location-tvangen skrotes med den.** Kenneth valgte ingen tvang: har malen
lokasjonsmulighet og brukeren lar den stå tom, har rapporten ingen tegning. Punktum.
🔴 **Konsekvens som må med i ordren:** vedtaket om «location-tvang» (2026-08-19) er dermed
opphevet. Beregningen i `apps/api/src/routes/mal.ts:216-235` og `harAktivLocation` (`:99`, `:248`)
ryddes sammen med relikvien, og de to mobil-propene (`OpprettDokumentModal.tsx:59`,
`MalVelger.tsx:30`) med. **Ingen av dem håndhevet noe** — målt av cowork 2026-09-02 — så
oppryddingen fjerner en halvbygd mekanisme, ikke en virkende regel.

**V3 — VEDTATT.** Lesevisning følger PDF-ens harMarkor-regel; mellomtilstanden vises kun i
redigering.

**Location er atomisk:** *«dersom location settes, da setter vi en prikk»*. Tegning uten punkt er
en arbeidstilstand, aldri et ferdig dokument. Det er samme regel som V3, sett fra settesiden.

### 🔴 NY REGEL — repeater arver tegning fra forrige rad i SAMME dokument

> *«Dersom vi benytter en tegning sammen med repeater, og sjekklisten/oppgaven ikke har lokasjon
> satt, da husker repeater n hvilken tegning som var brukt i repeater(n-1).»*

**Dette er ikke det vi bygget 2026-09-01.** `fix/tegningsminne-repeater` (`5b5f5442`) husker
**siste tegning per byggeplass** — `hentSistTegning(kontekstBygningId)` i
`TegningPosisjonObjekt.tsx:102`. Kenneths regel er en annen nøkkel: **forrige rad i samme
dokument**.

**Rangeringen han beskriver:**

1. Har dokumentet lokasjon satt → den tegningen gjelder.
2. Ellers, har repeater-rad *n−1* en tegning → arv den.
3. Ellers → dagens per-byggeplass-minne.

**Hvorfor det er bedre:** en befaring med ti observasjoner på samme tegning krever i dag ti valg
av samme tegning. Med regelen krever den ett. Og arven er *innenfor dokumentet*, så den kan ikke
dra inn en tegning fra et annet byggeplassbesøk — som er den kjente kanten ved dagens minne
(BACKLOG § GPS-prioritert forvalg).

⚠️ **Ikke bygget.** Skal inn i den samlede ordren fabel skisserer under, ikke som egen runde —
den rører samme flate.

## Vedtakspunkter til Kenneth

- **V1:** «Ingen lokasjon» = ingen egen bryter/bekreftelse; fraværet av markør er svaret,
  `drawingId` skiller «underveis» fra «bevisst uten». *(Svar 1)*
- **V2:** `location`-rapportobjektet avvikles (etter coworks mobil/api-måling);
  begrepene kollapser til tillatelse (mal) + markør (dokument/felt). *(Svar 2)*
- **V3:** Paritetsregelen: lesevisning web/mobil følger PDF-ens harMarkor-regel;
  mellomtilstanden vises kun i redigering. *(Flateparitet)*

Vedtas V1–V3, skrives én samlet ordre (begrepsrydding + paritetsregel + én settevei), med
funksjonsinventar av dagens `LokasjonVelger` og de to setteveiene, klikk-budsjett, og
designlås-blokk. `relay/inbox-lokasjon-autoapne.md` arkiveres som erstattet.

## Grunnlag (målt mot koden 2026-09-02)

- `LokasjonVelger.tsx:169-219` — tre tilstander finnes (leggTil/utenPunkt/punktSatt);
  brukes på sjekkliste- (`page.tsx:876`) og oppgave-detalj (`page.tsx:806`).
- `tegningsfelt.ts` — harMarkor krever `drawingId` OG `positionX/Y`; dokumentnivå og
  feltnivå gjenbruker `byggTegningPosisjon`; test :121 bekrefter BEF-001-utelatelsen.
- `ramme.ts:73-76` — Byggeplass-cellen skrives alltid (designlås 2, FASTE FELT).
- `RapportObjektVisning.tsx:384-390` — location-objektets adressefallback (paritetsbruddet).
- `RapportObjektRenderer.tsx:45` — `location` + `drawing_position` skjult i utfylling.
- `shared/types/index.ts:253-258, 500-613` — location i palett + fem topptekst-seeds.
- Enkeltmålt/ikke målt av meg: mobilflatens lokasjonsvisning; api-konsumenter av
  location-objektet — cowork verifiserer (jf. svar 2).
