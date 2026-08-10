---
name: historikk-2026-08
description: Arkiv av deployete PR-er/saker fra august 2026. Flyttet hit fra STATUS-AKTUELT ved DEPLOYET TIL PROD.
sist_verifisert_mot_kode: 2026-08-07
---

# Historikk august 2026

Arkiv av arbeid deployet til prod i august 2026. Flyttet hit fra [STATUS-AKTUELT.md](STATUS-AKTUELT.md) per arkiveringsplikten (deployet arbeid ligger aldri igjen i STATUS-AKTUELT).

> **Mobil-forbehold for hele måneden:** ingen EAS-bygg er fyrt i august (siste er #40, 2026-07-15). Mobil-kode som er merget til `main` i august er derfor **i prod-repoet, men ikke hos brukerne** — den når felt først ved neste EAS-bygg + TestFlight. Gjelder særlig mobil detalj-redesign M1–M3. Se [STATUS-AKTUELT § EAS-byggteller](STATUS-AKTUELT.md#eas-byggteller-kvote-15mnd-fri-plan--nullstilles-den-1).

## Prod-deploy 2026-08-08 kveld (`e37621e1`, develop→main) — HMS 5a+5b melder-flyt + utlegg U1 (LIVE)

Lukker read-only-regresjonen fra `881e66e6` **ved rotårsaken**. Første migrering på flere dager (additiv, `db-timer`).

- **HMS 5a — opprett = utkast.** `oppgave.opprett` + `sjekkliste.opprett` HMS-gren gir nå `sendt:false` / `aktivPosisjon:1` / `draft`, uten varsel ved opprett. Ny `hmsSendInn` (`draft|responded → received`). Gjenkjennes på **`mal.domain === "hms"`**, ikke subdomene ⇒ gjelder **alle tre typer: avvik, ruh, sja**. Draft-guard skjuler utkast for ALLE inkl. HMS-admin («ingen ser utkastet før du sender»). leseModus = `erMelder && aktivPosisjon===1 && !terminal` — dekker draft OG returnert, så «Returner til melder» faktisk gir melder redigeringsrett tilbake. Forkast gjenbruker eksisterende `slett`.
- **HMS 5b — tillegg-synlig + feltlås.** Ny `HmsMelderTillegg`: synlig forklaring på hvorfor feltene er låst (kun mens ballen er hos behandler, med sendt-dato fra transfer-loggen) + «Tillegg fra melder» som tidsstemplet logg. Melder-tillegg flyttet UT av `HmsHandlingsflate` ⇒ den er nå ren behandler-flate. **Sporbarhet ved revisjon:** `hmsSendInn` skriver distinkte transfers — `draft→received` = «Sendt inn», `responded→received` = «Revidert og sendt tilbake» — så behandler ser at melderen endret noe.
- **Utlegg U1** (`cf1e6c53`) — datamodell + delt utledning, ingen UI ennå. `ExpenseCategory.ordning` (sats|utlegg|fakturert), `sheet_utlegg` + `sheet_utlegg_vedlegg` + `prosjekt_ordning_overstyring`. **CHECK på radens eget `ordning_ved_foering`** (kan ikke referere kategori-tabellen) gjør stempelet til integritetsbærer, ikke bare revisjonsspor. Delt `utledOrdning` (`overstyring ?? firma-default`) i `@sitedoc/shared` med 10 tester. `timer.md` drift-reconciliert: planlagt-men-aldri-bygget `sheet_expenses` erstattet med faktisk modell.

**Verifisert innlogget på prod:** HMS-005 opprettet → «Utkast» + banner + Send inn/Forkast + redigerbare felt → etter innsending «Mottatt» + låste felt + Besvar/Lukk/Returner.

**Spor 2-dekning (asymmetri, kjent):** web-oppgave har full flyt; web-SJA har melder-flyt + Besvar/Lukk men mangler Returner + flyt-stripe; mobil har melder-flyt, behandling er pre-Spor-2. Oppfølgere navngitt, ikke skjult.

**Prosess-lærdom:** forrige deploy (`881e66e6`) tok med Diff 1 mens 5a fortsatt manglet — vi byttet «behandler kan ikke behandle» mot «melder kan ikke melde». Regelen framover: **ikke deploy en bunt med kjent åpen regresjon**, selv om resten er verdifullt.

## Prod-deploy 2026-08-08 (`881e66e6`, develop→main) — HMS received-fiks + fillagring S1 + firma-tilknytning + P4a mobil (LIVE)

25 commits. **Ingen migreringer** (verifisert: kun `schema.prisma`-kommentarrydding). Backup tatt før deploy (`sitedoc-pre-25commits-20260808-0701.dump`, 485K). Bygget api og web hver for seg (samtidig = OOM), `up -d --no-deps` uten `-p`.

**Ny deploy-forutsetning innført samtidig:** `docker/env/felles.env` med `FIL_SIGNING_SECRET`, lest av BÅDE api og web. Verifisert etter start: `${#FIL_SIGNING_SECRET}` = 64 i begge containere, `/api/fil-selvtest` → `{"ok":true}`, og kryss-prosess-sjekk (web signerer → api verifiserer) → **404** = enige (401 ville betydd ulike secrets).

- **HMS `received`-rotfiks + 5c behandler-mønster** (`6e54a3b3`). Rotårsak: HMS opprettes sendt → `avledStatus` → `received` (Q1-kollapsen), men `verifiserHmsHandling` + `HmsHandlingsflate` gjenkjente kun `sent`/`responded` → besvar/lukk filtrert bort → «Lesevisning» for behandler OG admin, uavhengig av `erHmsAdmin`. **Live prod-bug siden 03.08.** Fiks: `åpen behandling = sent|received|responded` + ny `hmsReturner`-mutasjon + `HmsFlytStripe` + Melding read-only-tvang. Verifisert prod: HMS-002 viser flyt-stripe + Besvar/Lukk/Returner.
- **Fillagring S1 Fase 1** (`d1f93dc4`) — autorisert filserving for sensitive filer. HMAC-signerte, kortlevde (5 min) URL-er; `/uploads/privat/*` er signatur-kun (401 ellers); `?privat=1`-opplasting + magic-bytes-sniffing; M1 record-nøklet sign-query for mobil. **Målrettet signering** i de prosedyrene som emitterer privat-URL-er (erstattet all-svar-middleware). **Boot-guard i BEGGE prosesser** — prod nekter å starte uten secreten. Signerings-røyktest (`/api/fil-selvtest`).
- **Firma-tilknytning** (`4b306a14`) — FIRMA-kolonnen i kontakter-matrisen leste fantom-feltet `user.organization` (legacy `User.organizationId`, droppet i O5c). Leser nå `OrganizationMember` med multi-org-regel. Rettet «—» for hele porteføljen siden 13.05.
- **P4a mobil — auto-opprett svart skjerm** (`0fef35fa`). To iOS-modal-race: overlappende present/dismiss (MalVelger↔Opprett) + intern dismiss mid-present ⇒ `onDismiss` fyrte aldri ⇒ usynlig fullscreen modal-VC. Fikset med iOS' egne livssyklus-events (`onShow`/`onDismiss`), ingen timeout. **Fanget av simulator-verifisering før EAS-kvote ble brent.** (I main, men når ikke brukere før EAS-bygg.)
- **Doc-rens + arkitekturvedtak** (`28ffd0b8`, `436d59bd`, `37141be0`) — august-historikk opprettet, `CLAUDE.md` under 40k, vedtak om én kilde til firmarolle, mockups forankret.

### 🔴 Kjent regresjon fra denne deployen (fikses i HMS-bolk 5a+5b)
**HMS-skjemaet er read-only for alle, også melderen.** 5c innførte `leseModus`-tvang med grenen `erMelder && status === 'draft'` — men HMS opprettes fortsatt sendt (`received`), så grenen treffer aldri. Følge: nye HMS-meldinger kan opprettes, men ikke fylles ut. Kenneth på prod 08.08: «status er meldt før skjema er påbegynt utfylt, og skjema er nå låst.» **Rotårsaken løses av 5a** (opprett = utkast) — ingen interim-lapp, jf. «ikke bygg noe å rive». Deployes samlet med 5b.

### Lærdom — topologien som kostet en dag
`FIL_SIGNING_SECRET` ble satt i `api-test.env`, men **tRPC kjører i web-containeren** (`apps/web/src/app/api/trpc/[...trpc]/route.ts` importerer `appRouter`; kun `/api/upload` + `/api/uploads/*` rewrites til api). Signeringen kastet derfor i web-prosessen, og api-loggen viste ingenting. Symptomene (207 på urelaterte batcher, «Dagsseddelen finnes ikke eller du har ikke tilgang», «Ugyldig verdi.») pekte alle mot tilgangskontroll og data — som var feilfrie. **Topologien er nå dokumentert i DOCKER-NOTES + infrastruktur.md**, og boot-guarden gjør at samme feil stopper deployen i stedet for å produsere tause 207-er.

## Prod-deploy 2026-08-06 (`70d2b752`, develop→main) — Spor 2 HMS komplett (LIVE)

Hele Spor 2 (HMS-redesign) deployet og innlogget-verifisert på A.Markussen AS. Backup tatt før deploy. **Ingen migreringer.**

- **Ordre 2.1 — HMS-medlemskap som regel + synlighet (Funn H)** (`d0eccd58`, merge `2599a604`, i18n `4e55450a` 18 nøkler). HMS gjort synlig i det unifiserte oppsett-UI-et; medlemskap uttrykt som regel framfor implisitt tilstand. Verifisert: to-lags-modellen står (prosjekt-HMS-gruppe vs. firma-`hms_ansvarlig` er ulike ting med samme navn).
- **Ordre 2.2 + 2.3 — unifisert velger + segmentert filter/Hos-kolonne/retur (Funn E/F/G)** (Wave 1 `33d7cff9`, Wave 2 `79c5253a`, merge `2ed1d31e`, i18n `b133cd25` 3 nøkler). Wave 1: unifisert velger (E) + retur-kontekst (G) + flyt-select (G4). Wave 2: segmentert «Hos»-filter (F) + «Hos»-kolonne (G). Endringsmelding holdt UTE av HMS-velgeren (Kenneth-vedtak: et HMS-avvik som utløser endringsmelding legges heller som vedlegg til et økonomisk krav).
- **Krasj-fiks — rules-of-hooks** (`8b826ab6`). Klikk på «Hos HMS-ansvarlige»-segmentet ga hvit skjerm: tom-retur (`if (rader.length === 0) return <EmptyState>`) lå FØR `useMemo` i tre tabeller → hook-rekkefølgen brøt. Fikset ved å flytte tom-sjekken etter alle hooks; samme fiks løste tomt-søk-krasjen. «Hos ?» erstattet med «Utkast»-chip.
- **Banner-polish (2.1 fix-forward)** (`54a379b9`, merge `a024827d`, i18n `4c5f1cc0`). Inline «Meld meg inn» på matrise-raden + «behandler på dette prosjektet»-mikrotekst + `HmsTomBanner` verifisert på prosjekt-HMS.
- **v18/v19 build-blocker** (`5a8f63e5`, merge `244ce1cb`). Ferskt `pnpm install` løste `@types/react` til v18 (web pinner ^18.3.0, mobil drar v19) og avdekket en latent typefeil som Docker-cachen hadde maskert: `DokumentHandlingsmeny.tsx:891` sendte `RefObject<HTMLDivElement | null>` der v18 ikke godtar det. Fikset versjons-agnostisk (`Ref<HTMLDivElement>`) + `as unknown as` for TS2589 i brukere-siden. **Lærdom:** en grønn build på cachet image beviser ikke at et ferskt bygg går grønt.

**Kjent restanse:** #7 (bruker ser ikke HMS i firmadelen) var **feil flate**, ikke kodebug — kmy ser HMS på prosjektnivå. Mobil-paritet for HMS-velger/filter er egen runde. Redigerbare medlem-unntak (schema) er backlogget.

## Prod-deploy 2026-08-05 (`8a2f6d9c`, develop→main) — Ordre 1.4 auto-hopp bort overalt (LIVE)

Web-only. `åpneMalVelger` viser nå velgeren alltid ved ≥1 mal på begge web-flater (sjekkliste + oppgave); sist-brukt degradert til ren markør. **Snur Funn C-fasit pkt. 3** — auto-hopp fjernet framfor å beholdes med korrigert nøkkel. Test-verifisert (`fc763960`) før prod. Mobil-paritet (RN `MalVelger`) er egen runde.

## Prod-deploy 2026-08-05 (`5bf25f83`, develop→main) — Funn D + opprettvelger v2 + Spor 1 fundament/1.1 + kontaktside (LIVE)

- **Funn D — P2 tom-besvarelse-guard.** `harMinstEttUtfyltFelt` (`feltLaasing.ts` + `oppgave.ts:1310`) telte kun skjema-objekt-svar, ikke kommentar/vedlegg → «besvar med kun kommentar» ble feilaktig avvist. Fikset og deployet.
- **Opprettvelger v2** (`28808b5f`). To-nivå gruppering faggruppe→flyt, HMS-seksjon ALT 1, sortering flyttet inn i komponenten. Fabel-spec. 11/11 + 107/107 grønt.
- **Spor 1 fundament + 1.1** (`feat/spor1-fundament-terminologi`). Domene-wire (Funn H) + terminologi: Gruppe→Tilgangsgruppe, Brukere→Kontakter, HMS-feilmelding, Endringsmelding-stavefiks, forklaringsboks. Web-only.
- **Kontaktside null-guard** (`26461288`, i18n `4833edf0`). Build-fiks i `OpprettKontaktModal`.

## Prod-deploy 2026-08-04 (`0ac25705`, develop→main) — Funn A + Funn C (LIVE)

- **Funn A — oppgaver bandt ikke dokumentflyt ved opprett.** `matchDf` brukte døde rolle-strenger (`oppretter`/`svarer`), foreldreløse siden navnegjennomgangen 2026-04-05 → **~4 måneder latent bug, IKKE en flytmodell-regresjon.** Fiks: P4b-ens `opprettbareFlytIder`-flytbinding portet til oppgave-opprett + 3 server-vakter, `matchDf` fjernet. Innlogget prod-verifisert: KS-avvik binder «A.Markussen Ansattte -> ledelse», full flyt kjører.
- **Funn C — opprett-velger auto-hoppet** til per-prosjekt sist-brukt-nøkkel → maler ble uåpnelige. Fiks: unifisert `OpprettMalVelger` på begge flater, velger åpnes alltid ved >1, sist-brukt auto-valgt + flyttbar markør, nøkkel per prosjekt+dokumenttype. Fabel-spec. (Fasit pkt. 3 ble senere snudd av Ordre 1.4, se over.)

## Prod-deploy 2026-08-03 (`8b068c73`, develop→main) — flytmodellen komplett + effektivitets-runden + mobil M1–M3 (LIVE)

Den store deployen. Backup prod-DB tatt (`sitedoc-preflyt-2026-08-03-1533.dump`, 99 tabeller). **To additive migreringer** kjørt rent mot `sitedoc`: `20260731120000_flytmodell_fase1_posisjon` + `20260731140000_flytmodell_1b_hms_binding`. Backfill rent: Fase 2 ga 5 sjekklister + 4 oppgaver non-terminal posisjon (1 ubestembar), gjenåpne-cache 0 å rette. `sitedoc-api` + `sitedoc-web` restartet OK. Innlogget verifisert: **sjekklister binder dokumentflyt + flytlinje live** (BEF-002 «BL -> BH», «Du har ballen — Registrerer», «Send til N·X»). Test-verifisert først 2026-08-03 (`0daa89e1`).

### Flytmodell (dynamisk posisjonsmodell)

Rotårsaken som ble fjernet: rutingen konsulterte ALDRI dokumentflytens leddrekkefølge (den var hardkodet på rollenavn/historikk) → Send hoppet ledd, Besvar gikk bakover, Godkjenn kunne skje uten at godkjenner hadde hatt ballen. Pilot-blokkerende med distinkte personer. Vedtatt modell: **ruting teller posisjon, status avledes** (settes aldri direkte), én delt utledning i `@sitedoc/shared`. Grunnlag: `delplaner/flytmodell-veileder-cowork.md` (fabel, Kenneth-godkjent) + `flytmodell-implementeringsplan.md` + `flytmodell-gate-svar-fabel.md`.

- **Fase 1a** (`7e385ade`, branch @ `5c274e55`): datamodell + migrering `20260731120000`. 8 nye felt (`DokumentflytMedlem`: ansvarsmerke/klassifisering/kanTerminereUtenBall; `Checklist`+`Task`: aktivPosisjon/retning/terminal/sendt). To-stegs migrering (nullable/default, ALDRI drop; status-enum degradert til avledet cache). Deterministisk backfill: `steg` = DENSE_RANK rolle-prioritet, klassifisering `{kontroll,utfor,orienteres}`, terminal inkl. `cancelled→avbrutt`, `sendt`, terminal-aktivPosisjon (valg 4).
- **Fase 1b** (`5391f4f7`, branch @ `9c127e7e`): HMS flyt-binding. HMS-opprett binder dokumentet til prosjektets HMS-flyt (`dokumentflytId` + `aktivPosisjon:2` + `sendt:true`, graceful fallback). Interim sikkerhetsgate: `verifiserFlytRolle` hoppet for `domain="hms"` i `endreStatus` (fjernet igjen i Fase 3). Backfill `20260731140000`. FlytIndikator skjult for HMS på web; mobil-skjul utsatt til Fase 4 (manglet `domain`-plumbing).
- **Vedtak (Kenneth 31.07):** klassifisering + retningsrettigheter (← = kontroll+utfør, ↔ = H3), HMS = ordinær 2-ledds flyt, `cancelled`→terminal `avbrutt`, sletting § 2.5 (utkast `!sendt` = hard, underveis = myk 90d, terminaler aldri slettbar; rett = firmaadmin + prosjektadmin + sitedoc), FLAGG 1–3.
- **Fase 2** (`94b99149`, branch @ `e87a7120`+`7b378fda`): delt utledning `packages/shared/src/utils/flytPosisjon.ts` — 7 funksjoner + `FlytPosisjonLedd`-type. 37 enhetstester + **divergens-test** (gammel recipient-basert vs. ny posisjons-basert `harBallen`: Kenneths pilot-case divergerer på 2 seere = beviser at den nye er riktig). Reconciliation Q1–Q4 (fabel): `received`/`in_progress` kollapser til «Hos N», `harBallen` posisjons-basert, `avvist`→`dismissed` i cache.
- **Fase 3** (3.1 `8758bb1b` · 3.2 `deaa578e` · 3.3+3.4+3.5 `7a1b172e`): **server-omskriving komplett — rutingen er posisjons-basert.** De 11 statusskrivestedene skriver fakta; `avledStatus` setter status-enum-cachen. Send→`nesteLedd`, Besvar→`forrigeBallLedd`, forwarded→`finnPosisjon`. `verifiserFlytRolle`→`verifiserRetningsrett`; 1b-gaten fjernet. **Besvar-semantikk (fabel-bindende, Tolkning A):** utfører-submit = Send→ framover; Besvar← = KUN retur bakover. 424 shared + 16 api-tester grønne.
- **Fase 3.6** (`773c1a58`, fabel-løsning 1): `received→sent` gjeninnført i `isValidStatusTransition` (én linje). §8A hadde fjernet den som recipient-løs no-op i den gamle modellen; i posisjonsmodellen ruter `sent→nesteLedd`, så «Send → = neste ledd» virker fra ethvert ledd. **Fullfører P1, reverserer den ikke.**
- **Fase 4** (`merge-flyt4` + `feat/flytmodell-fase4-steg34`): **hele klientsiden på posisjonsmodellen.** Web `flyt-ledd.ts` + mobil `dokumentflyt-ledd.ts` konsolidert mot delt `byggPosisjonsLedd`; `forventetRolleKandidater` + `ROLLE_RANG`×3 slettet. **Klient-handlingsfilteret ER serverens `verifiserRetningsrett`** (`hentPosisjonFiltrertHandlinger`) — én kilde, klient = server. Send-fra-received wiret; primær «Send til N · X →» / «Godkjenn og fullfør ✓». shared 429 + web 91 + api-e2e 8 grønt.
- **Fase 5a** (`12d2e401`): server-integrasjons-e2e via `createCaller` — kjører 31.07-sekvensen gjennom ekte `endreStatus` med distinkte personer. Pilot-fiksen bevist: Besvar går IKKE bakover til vilkårlig avsender. Opt-in `test:integration`.
- **Pilot-fiks A+B+D/#11** (`29b26d47`): obsolet utkast-mottakervelger fjernet fra flyt-bundne dok; primær `nesteLedd`-styrt; gjenåpne skriver ikke draft til cache.
- **Runde 2** (`0a833261`, fabel-vedtak): **én bakover-handling** — «Send tilbake» fjernet, «Besvar til N·X ←» er eneste bakover; **`in_progress` kollapset helt** (ingen «Under arbeid» i loggen); trekk-tilbake→«Hos N» + guard; «UTFØRER»→«Faggruppe»; seer-relativ «Venter på deg»-chip; tooltip-portal.
- **Polering P1+S2** (`0daa89e1`): «Send» skjult i split-▾ på siste ledd; admin-flytmatrisens døde `in_progress`-stasjon ryddet.
- **P1-restfiks** (`8b068c73`, selve deploy-commiten): «Send» borte fra deaktivert-visning på siste ledd + DropdownMeny-korrigering.
- **Bygg-stempel:** `GIT_SHA` + byggtid bakt inn i image → `/version` + diskret linje i Innstillinger. Se `deploy-detaljer.md § Bygg-stempel`.

### Effektivitets-runden (audit → P1–P4b)

Fabels **Effektivitets-gate** (klikk-budsjett obligatorisk i brukervendte ordrer) + effektivitets-audit (`verifisering/effektivitets-audit-2026-07.md`) → fiks-plan `delplaner/effektivitets-fiksplan-2026-07-29.md`.

- **P1 Send-bugfiks** (`402b9ce4`): «Send fram» fjernet fra `received`/`responded`/`approved` (recipient-løs no-op — serveren auto-konverterte tilbake, markøren flyttet seg aldri) + first-match rolle-konsistens + flytmatrise-konsistens.
- **P2 småsaker** (`402b9ce4`, 6 wire-ins): byggeplass/tegning i opprett-mutasjoner, lønnsart-prefill web, fjernet suksess-Alert (sjekkliste-mobil), galleri-kobling `FeltDokumentasjon`, V3 web auto-hopp malvelger, onSlett-wiring (fikset utkast-slett-no-op).
- **P3 handlingslinje-redesign** (`50ce6d90`): primær + split-▾ — **5 → 2 flate elementer**; ett-trykks-utkast-slett med papirkurv som sikring. Fabel-godkjent.
- **P4b web ett-klikk opprett** (`4858d342`): delt `DokumentKontekstChipLinje`, utfyllingsmodus + redigerbar tittel, flyt-gruppert mal-velger, `useSistBrukteMal`. Tilgjengelighets-filter (`mal.hentForProsjekt` additivt `opprettbar`) — maler som ville blitt avvist vises ikke lenger. E2e fanget + fikset en stale-closure-bug: **auto-hopp fra toppknappen hadde aldri virket.** Klikk ≤2.
- **P4a mobil iOS-modal** (`0cb74bbe`): serialisert `<Modal onDismiss>` + Platform-gren + `internSynlig`-speil → auto-opprett-skip trygt ved entydig kontekst. GPS best-effort.

### Mobil detalj-redesign M1–M3 (i main, **ikke hos brukerne** — ingen EAS-bygg)

Merget `784c90b7` (branch @ `a8603a4a`). Fabel-ordre `delplaner/mobil-detalj-redesign-ordre-M1-M3.md`, Kenneth-godkjent mockup.

- **M1** én flytlinje i header (rolle-gruppert kjede + «Du har ballen»/«Venter på …»), erstatter `FlytIndikator` + boks-raden.
- **M2** P3-mønsteret på mobil: primær med retningsnavn + split-▾ med alle lovlige handlinger. «Lagre utfylling» demotert; påkrevd-validering = deaktivert Send + «X påkrevde felt gjenstår».
- **M3** ren flyt-sheet (vertikal 1→N, «DIN TUR»-badge, medlemsliste), erstatter flat medlemspopup.
- **Bug fanget i walkthrough:** mobilens `byggLedd` portet til ROLLE-gruppering (speiler web) — steg-gruppering kollapset en 4-rolle-flyt til én chip. Dead code slettet (`DokumentHandlingsmeny` + `FlytIndikator`).

**Gjenstår for mobil:** Kenneths fysiske re-test på develop-bygg + EAS-bygg før noe av dette når felt.
