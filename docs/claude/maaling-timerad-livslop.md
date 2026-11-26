# Måling M1 — timeradens livsløp (web + server + telefonsynk)

> Ordre: «2026-11-26 ORDRE M1 TIMERAD-LIVSLØP — MÅLING, INGEN RETTING» (web-timer-w1).
> Målt på `origin/develop` @ `f7a277d3`. Ingen produktkode er endret.
> Sandkasse: lokal Postgres `sitedoc_o25` med alle develop-migreringer pluss O27-tabellen `timer.slettet_fra_pc`. Den er additiv og leses ikke av koden på `f7a277d3`.

**FASIT — Kenneth 2026-11-26, ordrett:**
- «jeg fortsetter å registre timer -> men nå er det ingen sjekk mot dagskortet for hva som er lagret fra før. Jeg går i sirkel. jeg kommer ikke videre fordi ting blir "borte" og vi starter på nytt å lappe feil»
- «overtid regnes ikke ut -> jeg tror også et det "gamle " kortet er et slettet kort»

## Testene

| Fil | Kjøres med | I dag |
|-----|-----------|-------|
| `apps/api/src/routes/timer/m1-timerad-livslop.integration.test.ts` | `cd apps/api && DATABASE_URL=…/sitedoc_o25 npx vitest run --config vitest.integration.config.ts src/routes/timer/m1-timerad-livslop.integration.test.ts` | **4 røde, 10 grønne** |
| `apps/web/src/app/dashbord/timer/[id]/m1-timerad-livslop.test.tsx` | `cd apps/web && npx vitest run "src/app/dashbord/timer/[id]/m1-timerad-livslop.test.tsx"` | **2 røde, 1 grønn** |

- Røde tester starter med «RØD i dag:». De beskriver det Kenneth forventer og skal ikke rettes i M1.
- Web-fila ligger under `vitest.config.ts`. Den blir derfor rød i `pnpm test` fra rot til rotårsak R1 og R2 er rettet. **Orkestrator avgjør** om den skal merges før rettingen, eller bæres av rette-branchen.
- Integrasjonsfila kjøres ikke av `pnpm test`.

## Tabell

Forkortelser:
- **D** = `apps/api/src/routes/timer/dagsseddel.ts`
- **JS** = `apps/web/src/app/dashbord/timer/[id]/JobbSkjema.tsx`
- **P** = `apps/web/src/app/dashbord/timer/[id]/page.tsx`
- **API-test** = M1-integrasjonsfila, **web-test** = M1-web-fila
- **«kode»** = målt ved å lese koden, ikke kjørt

Felles for hele web:
- Ingen vei har optimistisk UI. Søk etter `onMutate`, `setData(` og `cancel(` gir 0 treff.
- Dagskortets hode («—» ved 0), dagssum og «Send dagen (X t)» regnes på hver render fra `hentMedId` (P:2470, P:2913–2917).
- Alt på skjermen er altså riktig **når og bare når `hentMedId` hentes på nytt**.

| Vei | Handling | fil:linje | Lagres | Vises uten F5 | Kan bli borte | Kan komme tilbake | Stille utfall | Test (i dag) |
|-----|----------|-----------|--------|---------------|---------------|-------------------|---------------|--------------|
| Ny jobb i kortet (JobbSkjema) | Fyll Til → blur → `tilfoyTimerRad`, så `lagreJobbTid` | JS:331–369 | Ja, i to kall. Ikke atomisk. | **Nei, når kall 2 feiler.** `ferdig` invaliderer bare ved suksess (JS:316–327). Kortet viser «—» og gammel sum, akkurat Kenneths bilde. | **Ja, visuelt.** Bytter man kort, fjernes utkastet (P:1343). Skjemaet avmonteres og «ulagret» slippes (JS:314). Raden står på serveren, men vises ikke før neste henting. | — | Ja. Raden står på serveren selv om skjemaet sier «Ikke lagret». | web-test «kall 1 lagrer raden, kall 2 feiler» **RØD**. Kontroll med begge kall OK: grønn. |
| Endre tid i lagret jobb | Fra/Til/pause → blur → `lagreJobbTid` | JS:330, 373–385 | Ja | Ja, ved suksess | **Ja.** Ny verdi skrevet mens forrige lagring pågår, sendes aldri (JS:330). Etterpå viser skjemaet «✓ Lagret». | — | **Ja.** Endringen droppes. «Send dagen» er ikke sperret. | web-test «ny Til skrevet mens forrige lagring pågår» **RØD** |
| «Hva gjorde du?» | blur → `oppdaterTimerRad` pr. linje | JS:395–409 | Ja | Ja | **Ja.** Samme sperre ved pågående lagring (JS:395). Endret tekst teller heller ikke som ulagret (JS:304–308). | — | Ja | kode |
| Ulagret ved navigering | lukke fane, F5, bytte kort | JS:307–314, P:452–461 | Bare det som er blurret | — | **Ja.** Gyldig tid som er skrevet men ikke blurret, teller ikke som ulagret, og nettleservakten slår ikke inn. | — | Ja | kode |
| Legg til timer-rad (vindu) | `tilfoyTimerRad`. Overtidsdeling i klienten (`foreslaOvertidSplitt`) | P:4986, P:5070–5127 | Ja | Ja. Invaliderer også i `catch`. | Nei | — | **Ja: overtid.** Se R3. | API-test «"Legg til" 15–18 lagres som Timelønn» **RØD** |
| Lagre jobb (overtid) | `lagreJobbTid` → `regnJobbTidPaaSedel` → `regnJobbTid` | D:6131, `packages/shared/src/utils/jobbTid.ts:125` | Ja | Ja | Nei | — | **Ja.** `overtidsnivaa: null`, ingen grunn i svaret. | API-test «"Lagre jobb" … uten grunn» **RØD**. Kontroll med `overtidsnivaa = 50`: grønn. |
| Overlappsjekk | `tilfoyTimerRad` / `lagreJobbTid` | D:2922, D:6124 | — | — | — | — | Nei. Serveren avviser med melding. | grønn (målt indirekte: overlappsmeldingen kom i testen) |
| Server etter lagring | `hentMedId`, `hentDagstotal` | D:4670, D:12955 | — | **Serveren har 10,5 t straks** | — | — | — | API-test «hentMedId og hentDagstotal …» grønn |
| «Slett dagsseddel» | `slett` (utkast) | D:7673, D:4320–4328. Klient P:548–551, Mine timer | Avvist på sendt/returnert | Feil vises i vinduet (`onError` + SDM) | Nei | — | Nei | API-test returnert + sendt: grønn |
| «Slett jobben» | `slettKort` | D:7698, D:4437, D:4475 | Utkast og returnert. Avvist på sendt. | Ja. Invaliderer `hentMedId` og varer. | Nei | — | Nei. Feil vises i `SlettDagModal`. Sedelen står igjen tom (0 rader). | API-test utkast + sendt: grønn |
| ✕ på timer-/reiselinje | `fjernTimerRad` | D:5920. Klient P:3770–3799 | Avvist på sendt | Ja | Nei | Se synk-raden under | Nei. `alert(e.message)`. | API-test sendt: grønn |
| ✕ på tillegg/maskin/utlegg | `fjernTilleggRad`, `maskin.fjern`, `fjernUtleggRad` | D:7105. Klient P:3990, 4119, 6337 | Ja | Ja | Nei | **Ja, via telefonsynk** (R4) | Nei på web | se synk |
| Telefonsynk: tillegg slettet på PC | `syncBatch` med sedel pending | D:12193–12250 | — | — | — | **Ja.** Kommer tilbake, svaret er «ok». | Ja | API-test «tillegg slettet på PC kommer tilbake» **RØD** |
| Telefonsynk: tillegg rettet på PC | `syncBatch` | D:12193–12250 | — | — | **Ja.** PC-verdien overskrives (3 → 1). | — | **Ja.** Svaret er «ok». | API-test «tillegg rettet på PC … overskrives» **RØD** |
| Telefonsynk: timerrad rettet på PC | `syncBatch`, V19.9-versjon | D:11975–12016 | — | — | Nei. PC-versjonen står. | — | Nei | API-test «timerrad endret på PC …» grønn |
| Telefonsynk: sedel/timerrad slettet på PC | `syncBatch` + `finnSedlerÅSlette` | — | — | — | — | Ja (sedel pending) | — | O26 (`o26-gjenoppstandelse.integration.test.ts`, grønn = måler JA). O27 (`fix/slettet-er-slettet`) er til gate og ikke målt her. |
| `synced_at` på web-sedel | `opprett` + `tilfoyTimerRad` | `syncedAt` settes bare i `syncBatch` (D:12143, D:12167) | — | — | — | — | — | API-test «opprett + tilfoyTimerRad på web setter aldri synced_at» grønn |
| Timerlista / Mine timer | `list` | PT:81, MT:182 | — | Ja. Henter på nytt ved montering og fokus (`new QueryClient()` uten valg, `providers.tsx:40`). | — | — | — | kode |
| Send dagen | `send` | P:2492, P:2831 | — | — | — | — | **Ja.** Sperren bygger på `ulagredeKort`, som ikke ser R1/R2. | kode |
| Attestering (attester/returner/del opp/angre/flytt/rett/splitt) | se `AttesteringTabell`, `RegistreringPanel` | — | — | Invaliderer `hentForAttestering`/`hentTilAttesteringFirma`, ikke arbeiderens `hentMedId`/`list` (de hentes ved fokus) | ikke målt | ikke målt | Feil vises inline | **ikke målt i M1** |
| Forsoning | `forsonDagskort` | D:6355, P:590–593 | — | Ja | ikke målt | ikke målt | Feil i `setFeil` | **ikke målt i M1** |
| Prosjektbytte / flytt jobb | `flyttJobb`, `flyttJobbEco` | D:6205, D:6269, JS:425, 448 | — | Ja, ved suksess | ikke målt | ikke målt | — | O20-testene (4 av 7 i `flytt-jobb-prosjekt.integration.test.ts` er røde på develop: utdatert test, mangler O20s reisevalg) |

## Rotårsaker

### R1 — skjermen leses ikke på nytt fra serveren når en lagring delvis lyktes
- **Rammer:**
  - ny jobb når kall 2 feiler (kortet viser «—», summen er gammel)
  - utkastet som forsvinner ved kortbytte mens raden står på serveren
  - «Send dagen» som låses opp ved avmontering
  - «ting blir borte»
  - «ingen sjekk mot dagskortet for hva som er lagret fra før»: brukeren ser ikke raden og fører den på nytt. Serveren avviser med overlapp (D:2922), og brukeren går i sirkel.
- **Kode:** `ferdig` invaliderer bare i `try` (JS:316–327). `TimerRadDialog` gjør det riktig og invaliderer også i `catch` (P:5103, 5322).
- **Forslag — én retting:** én lagre-hjelper for alle skrivekall i dagskortet. Den invaliderer `hentMedId` i `finally`. Kortets «ulagret» avgjøres ut fra serverens rader for `kortId`, ikke av at skjemaet er montert.
- **Tillegg:** ny jobb bør bli ett serverkall, så halv lagring ikke kan oppstå.

### R2 — en endring under pågående lagring droppes stille
- **Rammer:**
  - tid (JS:330)
  - beskrivelse (JS:395)
  - lønnsart/underprosjekt (JS:416)
- **Følge:** skjemaet viser «✓ Lagret» mens det som står i feltet, ikke er lagret.
- **Forslag — én retting:** et «skitten»-flagg i skjemaet. Når lagringen er ferdig og feltene avviker fra det som ble sendt, sendes på nytt. Til da teller kortet som ulagret.

### R3 — overtid: to utfall gir samme tomme svar
- `foreslaOvertidSplitt` returnerer `[]` både når dagen er under normen og når den er over normen uten noen art med `overtidsnivaa` (`packages/shared/src/utils/overtidForslag.ts:115` og `:117`). `regnJobbTid` blir dermed én normallinje (`jobbTid.ts:125`).
- **Rammer:** «Legg til»-vinduet (klient), «Lagre jobb» (server) og mobilens `velgOvertidLonnsart`-kallere (`apps/mobile/src/utils/linjeLonnsart.ts:155`, `dagsforslag.ts:855/1903`, ikke kjørt her).
- **Prod 26.11:** SITEDOC MYRHAUG har «Overtid 50%» og «Overtid 100%» uten `overtidsnivaa`. Premisset er gjenskapt i sandkassen. Med `overtidsnivaa = 50` deles 15–18 riktig (grønn kontroll).
- **Forslag — én retting:** den delte regelen sier «overtid, men ingen art» som eget utfall. Svaret bærer utfallet, og skjermen viser det. I tillegg gjør lønnsart-oppsettet det synlig når firmaet har overtidsarter uten nivå.
- **Kenneths beslutning:** retting av dataene i SITEDOC MYRHAUG (sette nivået) er en konfigurasjonsendring i prod.

### R4 — tillegg, maskin og utlegg er ikke versjonert i telefonsynken
- `syncBatch` erstatter tillegg, maskin og utlegg med telefonens kopi (D:12193–12250, «full payload-replace»).
- **Følger:**
  - Det som er slettet på PC, kommer tilbake.
  - En PC-retting overskrives.
  - Begge med svar «ok».
- Timerrader er versjonert (V19.9) og tåler dette (grønn test).
- **Rammer:**
  - tillegg (målt)
  - maskin og utlegg (samme kodeblokk, bare lest)
- **Forslag — én retting:** samme versjonering som timerrader (`serverVersjon`/`endretLokalt` og slettespor) for alle fire radtyper. O27 sitt slettespor bør dekke alle radtyper, ikke bare timer. Hva O27 dekker i dag, er ikke målt: branchen er ikke på develop.

## Premissene i ordren, målt

- **«`synced_at` tom» på sedel `576d5533` sier ikke at den ikke ble slettet.** Web setter aldri `synced_at` (grønn test), så alle sedler laget på web har den tom.
- **At Kenneth «slettet» kortet, kan ikke bekreftes fra koden.**
  - Alle slette-veier på web viser serverens avvisning: modal, `setFeil` eller `alert`.
  - Det som kan *se ut* som sletting uten å være det:
    - utkastet til en ny jobb forsvinner ved kortbytte (P:1343) mens raden fra kall 1 står (R1)
    - en endring under lagring droppes (R2)
  - Hvilken av disse Kenneth traff 25.11 21:50–21:52, krever serverlogg eller `sheet_rad_historikk` i prod. Det har jeg ikke tilgang til.
- **«Ingen sjekk mot dagskortet»:** serveren sjekker overlapp mot dagens rader (D:2922, D:6124). Det som mangler, er at skjermen viser det serveren har (R1).

## Det jeg ikke kunne måle

- **Prod-dataene** (sedel `576d5533`, rad `57e6facd`, Kenneths 15–18): ingen prod-DB i ordren.
- **Om blur rekker å starte lagringen før skjemaet avmonteres** ved klikk på et annet korthode: jsdom har ikke nettleserens fokusrekkefølge.
- **Telefonens egen side** (`apps/mobile/src/services/timerSync.ts`): målt bare gjennom serverens `syncBatch` og O26s `finnSedlerÅSlette`. Ikke kjørt på telefon.
- **Attestering, forsoning, del opp/angre, splitt, prosjektbytte:** kartlagt (tabellen), ikke testet i M1.
- **O27** (`fix/slettet-er-slettet` @ `6c66f945`): ikke på develop, ikke målt.
- **Registrering:** fila er ikke ført i `STATUS.md`/`DOC-MAP.md`. Ordren begrenser filene til testene og denne rapporten. Det tas i orkestrators docs-commit.
