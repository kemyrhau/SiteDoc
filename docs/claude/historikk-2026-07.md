---
name: historikk-2026-07
description: Arkiv av deployete PR-er/saker fra juli 2026. Flyttet hit fra STATUS-AKTUELT ved DEPLOYET TIL PROD.
sist_verifisert_mot_kode: 2026-07-04
---

# Historikk juli 2026

Arkiv av arbeid deployet til prod i juli 2026. Flyttet hit fra [STATUS-AKTUELT.md](STATUS-AKTUELT.md) per arkiveringsplikten (deployet arbeid ligger aldri igjen i STATUS-AKTUELT).

## Prod-deploy 2026-07-27 (develop→main) — statusmaskin-redesign + flyt-arbeid + e2e + admin-oversikt (LIVE)

Develop→main-merge (2026-07-27, 81 commits foran prod). To migreringer kjørt mot prod-DB `sitedoc`: `20260725120000_softdelete_checklist_task` (F0, additiv soft-delete-kolonner) + `20260725130000_merge_underarbeid_rejected` (F3, data `rejected→in_progress`). Statuskilder eies av delplanene under `delplaner/` + designprosjektene; ikke duplisert her.

- **Statusmaskin-redesign (F0–F6).** Full livssyklus-omskriving etter Kenneth-gjennomgang av mikrotekst-hoveren (11 flyt-design-problemer). F0 soft-delete/papirkurv (`9e99d2c6`, migrering `20260725120000`), F1 egen «Avvist»-status med påkrevd begrunnelse (`88beef7f`), F2 trekk tilbake `received→draft` (`50c7b544`), F3 «Under arbeid»-merge `rejected`+`in_progress` → én tilstand (`cac9473e`, data-migrering `20260725130000`), F4 samlet gjenåpne `closed/dismissed/cancelled → draft` (`4227d0a2`), F5 Send/Videresend-paring (`8b23fc5b`), F6 `received→approved` (nøytral godkjenn-tekst uten utfører). Spec + koherens-garanti (matrise↔hover↔overgang fra delt kilde): [statusmaskin-redesign-spec](delplaner/statusmaskin-redesign-spec-2026-07-25.md).
- **Flytrettigheter + flyt-posisjon.** Godkjent-stoppsted H6 (`8204c171` — `approved` lukkes aldri, Gjenåpne lagt til) + H3 videresend-rettighetslekkasje lukket (`a4697feb` — default av for flyt-roller, admin-only, cellene rendret låst) + flyt-posisjon i dokument-headeren (`d3c73f6f` — dynamisk ledd-rad på kanonisk rolle-rekkefølge, byggLedd-fiks verifisert på ekte render på test) + flytvisning-fane (konfigurator, projeksjon over matrise-cellene, delt kilde med matrise-fanen).
- **E2e-rigg.** Playwright røyksuite (`tests/e2e/`, 8 tester) 3× grønn på rad mot test.sitedoc.no; testid-lag + `seed-e2e-flyt.ts` (idempotent, AGENT-TEST-0001-scoped), commit `5e664cef` (selv-helende pre-clean). GitHub Actions-kobling er eget beslutningspunkt etter stabil drift.
- **Tooltip v2 + mikrotekst-wiring.** Tooltip v2 (`4887d601` — bakoverkompatibelt superset: flerlinje, fet tittel, tastatur/touch, auto-flip) + mikrotekst-wiring på flyt-flatene (`9b434029` — hover som sier hvem handlingen går til, delt `flythjelp.*`-i18n × 15 språk, display-only). Mobil-flate utsatt.
- **Tilgangslaget ferdigstilt + N3-fiks.** Dokumentflyt-synlighet leser nå `DokumentflytMedlem` konsistent på tvers av liste/detalj/opprett/HMS (N3 del 1+2 `96d5d2c0`, `d2863dd5`), flyt-medlemskap likestilt med faggruppe (`fd573b61`), beslutningen ekstrahert som ren funksjon + tabelldrevet test (`cf76d81d`, 90/90), `byggTilgangsFilter` fikk bestiller/mottaker-grenen (`ecedb7eb`). Alle tre gatene enige; beslutningslaget navngitt i [dokumentflyt.md § 3](dokumentflyt.md).
- **A-3a handlingsmeny på kilden.** `DokumentHandlingsmeny` skrevet om kilde-drevet (handlingssett fra `statusHandlinger.ts`), utilgjengelige handlinger vist deaktivert med begrunnelse, primærhandling som knapp, `StatusHandlinger.tsx` slettet (`byggVideresendValg` → `lib/videresend-valg.ts`). Del E lukket 2026-07-19.
- **Admin firmaorientert oversikt fase 1** (merge `89d0a638`, deployet 2026-07-27).

**Prod-lærdom (migrate-gate, 2026-07-27):** migrate-steget ble først hoppet over → feilende `deleted_at`-spørringer + treg app + tomme lister (F0-koden forventet kolonnene som ikke fantes). Fikset ved å kjøre `prisma migrate deploy` (idempotent — begge migreringene anvendt, ingen datatap). Lærdom: F0-lignende additive-kolonne-deploys må ha migrate-steget bekreftet FØR appen tas i bruk.

## Prod-deploy 2026-07-23 (develop→main) — K3 kontekstvelger-redesign + polish (LIVE)

Hele K3-sporet deployet til prod, `--no-deps sitedoc-api sitedoc-web` (embed/oversettelse + salsaklubb urørt). **Ingen migreringer.** Innlogget prod-verifisert (A.Markussen AS): trakt + to-linjers topplinje + sidehode + ⇄ + timer-hjem + maskin-kontekst + chip-pixel-lås + felles venstrekant — alle korrekte. Nav-redesignet ligger bak `nyNavigasjon`-flagget (normal bruker beholder gammel nav); flagg-nøytralt live: sidehode + timer-hjem-rute. Statuskilde: [verifisering/k3-verifiseringslogg.md](delplaner/verifisering/k3-verifiseringslogg.md).

- **K3 kontekstvelger som trakt** — `KontekstChip.tsx` bygget om til firma → prosjekt → byggeplass-trakt (ett nivå åpent, «Endre»-rader, Alle/Mine-pille, «Sist brukt» via `Activity`, «Hele prosjektet» default). Prøvestein: kundetelefon-oppslag uten å gjette navn. Ordre: [k3-ordre.md](delplaner/k3-ordre.md), vedtak: [k3-kontekstvelger-vedtak.md](delplaner/k3-kontekstvelger-vedtak.md).
- **To-linjers topplinje** (kloss 2c) — prosjektkontekst: Firma (dempet grå eyebrow) / Prosjekt · Byggeplass (blå chip + ⇄); firmakontekst: kun Firma (amber). SD-nummer ut av topplinja (bor i trakt-radene). Reverserte P1-vedtak 3 (ført i [p1-nivasignal-vedtak.md](delplaner/p1-nivasignal-vedtak.md)). Grammatikk: sonetone følger AKTIV kontekst, toppbar-blå = brand (ikke sonetone).
- **Sidehode ×24 + verktøylinje-sonemarkør** — `SonetonetSidehode` rullet ut på nav-sider; sjekklister/oppgaver/maler fikk 4px sonemarkør på verktøylinja (delt kilde `sone-farger.ts`).
- **⇄ nav-utledet + streng timer-paring** — `PARBARE_SEKSJONER` pensjonert; ⇄ vises kun når eiende nav-element (lengste href-prefiks) har motpart med samme relpath i den andre kontekstens tilgangs-filtrerte nav. attestering/rapport → chip uten ⇄. `<Link>` (ikke `router.push`).
- **Maskin-kontekst-fiks** — `erFirmaKontekst` gjenkjenner `/dashbord/maskin` (firmamodul på topp-nivå-rute).
- **Timer-hjem-rute** (`/firma/timer` ekte side, ikke redirect-stub) — løste **React #310 kryss-kontekst-krasj**: ⇄ prosjekt→firma til en `redirect()`-rute avbrøt renderen. Onboarding-innholdet flyttet inn i hjem-siden, `/onboarding` → redirect tilbake (ut av nav-flaten). Sak: [timer-310-hooks-bug.md](delplaner/timer-310-hooks-bug.md).
- **Polish** — ⇄ pixel-lås (nivåord-knapp fast 127px + navn-område 240px = klikkmål står stille) + felles venstrekant (fjernet `mx-auto` på 24 innholds-containere → sidene starter på samme x, maxbredde varierer kun mot høyre; brede tabeller beholder plassen).
- **i18n** — nye K3-nøkler + `firma.timer.fane.oversikt` generert til 13 språk.

**Prod-lærdom (test-connection-tak, 2026-07-23):** test-deploy-runden traff `sitedoc_test`s per-database connection-tak (~25) pga. deploy-churn → NextAuth `AdapterError` maskert som `error=Configuration`. Recovery: drep idle-koblinger (`pg_terminate_backend … state='idle'`, kun `sitedoc_test`) + restart test-containere. Prod (`sitedoc`) urørt. Herding (`?connection_limit=5` i test-`DATABASE_URL`) står som egen test-infra-sak.

## Prod-deploy 2026-07-15, runde 3 (prod-merge `387d10a2`) — georeferanse-panel v2 + Kartverket-adressesøk

Develop→main-merge `387d10a2` (7 commits). **Ingen migreringer.** Api + web rebuilt (sekvensielt), alle containere Up etter deploy. **Innlogget prod-verifisert:** panelet (ett kart · chips · kollapsede rader m/ ✓+koordinat · sticky footer), `storgata`-søk → treffliste + «Adressedata © Kartverket» i **begge** flater (georef-editor + geofence-modal), timer-attestering laster (api sunn etter rebuild).

- **Georef-panel v2** (`e91f10c4`) — omskrevet `GeoReferanseEditor.tsx`: ett felles kart (delt markørfabrikk + smart startsenter), punktvelger-chips (aktivt punkt nullstilles etter hvert kartklikk — bevisst avvik fra mockup, hindrer utilsiktet flytting; Kenneth-godkjent), kollapsede rader m/ ✓+koordinat-bekreftelse, koordinatsystem-velger flyttet inn i «Lim inn», lås-steg fjernet, `kanLagre` strammet (pixel+gps+ikke-identiske), sticky footer. Ny prop `byggeplassId`+`startSenter` fra `byggeplasser/page.tsx`.
- **G2-funn 1: adressesøk Nominatim → Kartverket/Geonorge** — ny `sokAdresser()` (`rute-service.ts`, `fuzzy=true`, keyless, inntil 5 treff). `bygning.geokod` returnerer nå `AdresseTreff[]`. **Brytende retur-type, men verifisert web-only** (0 treff på `geokod` i `apps/mobile`) → EAS #40-klientene i TestFlight er urørt. `geokodAdresse` (single, Nominatim) beholdt urørt for oppmøtested/matrise → **to geokodere sameksisterer bevisst**; scope ikke utvidet.
- **i18n** (`a2a8d5c7`) — 39 `georef.*`-nøkler + Kartverket-attribusjon → 13 språk (40 av 2909).
- **Docs i samme runde:** K13-rapporten peker nå til verifiseringsloggen (statuskilde-regel, `992a45eb`); BACKLOG § egen byggekontekst for test; `lokal-dev.md` § dumpen tar ikke med filer.

**Fabel-designgodkjent** (hovedordre + tillegg A) — status eies av `verifisering/georef-panel-verifiseringslogg.md` (designprosjektet), ikke duplisert her.

## Prod-deploy 2026-07-15, runde 2 (prod-merge `e5859440`) — sidebar aktiv-seksjon + delt OppsettSidemeny + geofence-indikator (LIVE)

Develop→main-merge `e5859440` (13 commits). **Ingen migreringer, ingen api-endring** → kun `sitedoc-web` rebuilt; api urørt. Alle containere Up. **Innlogget prod-verifisert:** dashboard + prosjekter laster, PSI/Kontrollplan lyser riktig, geofence-pinner i byggeplasser-kolonnen (blå/grå stemmer), timer-attestering laster.

- **`b5aaa27d` sidebar aktiv-seksjon (LIVE)** — PSI/Kontrollplan lyste falskt «Dashbord» (manglet i `seksjonMap`, pre-eksisterende fra `b8d960547`) + «Dashbord kun på rot» gjort eksplisitt. Ikke flagg-gated — forbedrer bevisst begge flagg-tilstander. Rotårsaks-oppfølger (utled `Seksjon` fra sidebar-element-id-er i stedet for parallelt map) i BACKLOG.
- **`54bef0b5` delt `OppsettSidemeny`** — native sidemeny trukket ut av `oppsett/layout.tsx` → gjenbrukt av BÅDE oppsett-undersidene og innstillinger-huben. Cowork-gatet **byte-identisk** mot gammel layout (kun skall-flytt, null logikk-drift); `InnstillingerNav` slettet. Flagg-gated på huben, byte-identisk flagg-av.
- **`f1a5318d` per-rad geofence-indikator (LIVE)** — MapPin-kolonne i begge byggeplasser-tabeller, blå fylt = geofence satt / grå omriss = ikke. Klikk → eksisterende modal med radens data (`apneGeofence(byggeplass)`-refaktor); verktøylinje-knappen fjernet. **Ikke flagg-gated** — `byggeplasser/page.tsx` rendres uten `nyNavigasjon`-gate. Cowork-gate: `harGeofence` krever alle tre feltene (`latitude && longitude && radiusM`) → halvsatt geofence viser grå.
- **PSI-geofence-HÅNDHEVING parkert** (Kenneth-vedtak) → grunnlagsdok `psi-geofence-handhevning-utredning.md` for kommende innstillings-sesjon.

## Prod-deploy 2026-07-15, runde 1 (prod-merge `43299d03` + EAS #40) — timer F2/F3/F5 (byggeplass per rad + matpause-bærer) + finnbarhets-revisjon

Develop→main-merge `43299d03` (25 commits foran prod). **Server (api+web) LIVE; `db-timer`-migrering `20260714120000_sheet_timer_pause_min` applied på prod-DB `sitedoc` (prod-gate `/sitedoc` bekreftet, ingen ABORT); alle 9 containere Up etter deploy.** Mobil-delene når enheter via **EAS #40** (build `15a47804`, commit `43299d03` = main-innhold, TestFlight 15.07). Backup før deploy: `sitedoc-preF5-20260715-0016.dump`. Sekvensielt bygg (api → web separat) — unngikk OOM-kaskaden fra 11.07.

**Timer-mobil F2/F3/F5 (feltfunn del-6)** — fabel design-OK, fasit [timer-mobil-f2f3f5-spec.md](timer-mobil-f2f3f5-spec.md):
- **F2** — `ByggeplassVelger` tri-tilstand (henter/offline/bekreftet-tomt) + auto-refresh ved tom cache+online + `projectId`-reset-catch. Rotårsak til «Markussen har ingen byggeplasser» var sync-timing (`byggeplass_local` ikke populert), ikke manglende data.
- **F3** — per-rad `byggeplassId`: `sheetTimerLocal`-kolonne + idempotent ALTER + sync begge veier + syncBatch input/createMany (`t.byggeplassId ?? lokal.byggeplassId ?? null`, sedel-fallback) + `hentEndringerSiden`. UI: kombinert prosjekt+byggeplass-`pageSheet` + rad-sekundærlinje «Prosjekt · Byggeplass» + hybrid-hurtigsti. Server-verifisert p6 (rad_bp ≠ sedel_bp).
- **F5** — matpause-bærer per timer-rad. `pauseMin` INT NOT NULL DEFAULT 0 lokal + server `sheet_timer.pause_min`. Bærer = lunsj-kryssende carve-rad (Valg A); flytt-ikke-radio (`services/matpause.ts`) med toast + ekte bekreftelsesmodal ved fjern. **Kryss-modul-invariant:** `dagsseddel.pauseMin = Σ(rad.pauseMin)` ved hver endring → maskin-kapasitetsregelen (sedel-nivå pauseMin) urørt, `sheet_machines` INGEN pauseMin. **Edge #1:** dynamisk minutt-etikett (`pauseOverlappMin`) i stedet for hardkodet 30; uhaket rad = «Matpause trukket» uten parentes. Server-verifisert (pause_min=30, Σ=30).
- i18n `timer.matpause.*` generert til 13 språk (`8cada21c`).

**Finnbarhets-revisjon + byggeplasser-discoverability (redesign — flagg-gated unntatt labels).** Søkemotor `sok-match.ts` (skrivefeil-tolerant bounded Damerau-Levenshtein + `KJERNE_SYNONYMER`-lag), begrepsfikser, byggeplasser hub-kort. **Én bevisst ikke-flagget endring:** `nav.sok` «Søk»→«Dokumentsøk» + `nav.kontrollplan`→«Kontrollplan» rendres i gammel `HovedSidebar` (`sidebar-elementer.tsx:131,145`) → live for ALLE prod-brukere. Bevisst (unngår label-mismatch på tvers av flagg-tilstand, jf. Lokasjoner/Byggeplasser). `firmaNav.innstillinger`→«Firmaprofil» er INERT i prod (gammel firma-nav hardkoder labelen).

**#40-lærdom:** første `eas submit` feilet på «build number 40 already used» — EAS autoIncrement teller mot EAS' egne byggrecords, ikke App Store Connect. Bygget var intakt; ingen byggkvote brent på oppfølgingen.

## Prod-deploy 2026-07-13 (prod-merge `f888fecc` + EAS #38) — timer-stabilisering: fiks B + S-A tombstone + del-6-fiksrunde + footer

Develop→main-merge `f888fecc` (43 commits foran prod, main-tre == develop-tre). **Server (api+web) LIVE + innlogget-verifisert (test+prod på nett); 2 `db-timer`-migreringer kjørt på prod-DB `sitedoc` (prod-gate bekreftet); alle 9 containere Up.** Mobil-delene når enheter via **EAS #38** (`47c22b1a`, commit `cd3efcb5` = main-innhold, submitted TestFlight 13.07). #37-bakoverkompat bevart (server-endringer forbedrer/er inerte for #37). Backup før deploy: `sitedoc-preprod-20260713-1951.dump`. Full design + verifisering: BACKLOG (§ fiks B, § S-A, § F-e-carve) + `docs/claude/skjermbilder-del6-live/`.

- **Fiks B — `hentEndringerSiden` «erstattet»-lekkasje** (`5c9d2070` + self-heal `87af7e5b`): manglet `attestertStatus ≠ "erstattet"`-filteret alle andre lesere har → mobil trakk ×N write-only audit-rader (DB-bevist 9/6 vs sann 3/2). Fiks: ny `sheet_rad_historikk`-tabell + rediger-mutasjonene FLYTTER erstattet-rad dit (MOVE, aldri slett) + `hentEndringerSiden`-filter + self-heal-migrering (bump `updated_at` så eksisterende stale enheter re-puller). **2 migreringer** (MOVE + bump, begge kjørt på prod). **M-1+M-2 PASS** (fresh pull 3/2 + stale-enhet delta-sync self-heal uten reinstall).
- **S-A — mobil rad-sletting propagerer ikke (S3)** (`6bed19c3`): den opprinnelige del-6-eskaleringen. Diagnostisert via DB-grunnsannhet + M-3 (rad kom tilbake fordi S3 payload-id-begrenset `deleteMany` ikke propagerte). Fiks: lokal `slettede_rader_local`-tombstone + `slettedeIder` i syncBatch → server `deleteMany` (bak eierskaps+status-vakt) + pull-race-guard + rydding ved server-bekreftet sync (3 fabel-gatede krav). **M-3-reprise PASS** (rad borte lokalt OG server-propagert, server-SQL-bekreftet). #37-bakoverkompat (`slettedeIder` optional).
- **Del-6-fiksrunde F-b/F-e/F-f/F-g** (`108b86ae` + F-e-carve re-fiks `cbf7e465`): F-b faktiske økt-tider + `sluttTidKilde="bruker"`-skjerming; F-e pause KUN over 5,5t-terskel (AML §10-9, dagstotal, gate i `fordelArbeidstidFradrag` — **første impl hadde AVVIK: rad-verdi ugatet, gate-glipp fanget av simulator + re-fikset**); F-f `redigerSedelRader` fra/til-vakt (delt `finnTidsromKonflikt`, ikke `validerSplittFelles` som er sum-invariant); F-g differensiert «for kort»-melding. **Live-fangst alle PASS** (simulator + web). **Åpen oppfølger:** F-e-interaktiv (dag-recompute i edit-flatene — design-gate hos fabel FØR koding). **Kjent pilot-begrensning:** manuell rad-redigering på <5,5t-dag trekker fortsatt pause (interaktiv-sti, pre-eksisterende).
- **Footer** (`2bbf9169`): `v{semver} (build N) · {git-hash} · {byggdato}` via `expo-application` + `EAS_BUILD_GIT_COMMIT_HASH` — entydig bygg-identifikasjon (var «dev» uten hash før).
- **Redesign** (steg vii + K13 + restanse m.m.): på prod men **flagg-inert** (`nyNavigasjon` av-default) — når ingen brukere før flagg-påslag.

**Gate-lærdommer denne runden (memory):** [[gate-utfallssti-ikke-mekanisme]] (F-e-carve — gate utfallet, ikke bare mekanisme-plassering), [[observator-tolkning-ikke-mekanisme]] (M-3 — observatørs tolkning kan lene feil), [[db-grunnsannhet-for-mekanisme]] (S-A — DB-breakdown før mekanisme-påstand).

## Prod-deploy 2026-07-11 (prod-merge `d1b96cd5`) — F4-serien (identitetsforsoning + attestering-deadlock + synk-robusthet)

Develop→main-merge `d1b96cd5`. F4-serien lukker Fase C-funnene rundt web↔mobil timer-synk + leder-attestering. **Server/web-delene er LIVE i prod.** De **mobil-only** radene (F4-1c, F4-3) ligger i main via `d1b96cd5`, men når enheter først via **EAS #38**. Bakoverkompat mot #37 bevart i alle (server-wins-fallback / gjenbrukte i18n / ingen migrering). Sannhetskilde: [timer.md § Synk-identitet](timer.md).

- **F4-1 (identitetsforsoning) — server+mobil:** rotårsak til «mobil-registreringer vises ikke på web» = identitetskollisjon `@@unique([userId, dato])` vs `clientUuid` (server-`id` ≠ `clientUuid` → dato-kollisjon ga `avvist` terminal + pull-duplikat + «pull-så-redigert»-P2002). Fiks (`apps/api/src/routes/timer/dagsseddel.ts` + `apps/mobile/src/services/timerSync.ts`): **invariant `id = clientUuid` ved create**; **S2** P2002→`conflict` m/ server-`clientUuid` (ikke `avvist`); **S3** `deleteMany` kun payload-rad-id-er → bevarer web-førte rader (akseptert: mobil rad-sletting propagerer ikke); **M1** kollisjon-conflict = merge/re-nøkle + additiv push (ingen datatap); **M2** pull-guard mot duplikat via `(userId, dato)`-forsoning. Bakoverkompat #37: `serverData.clientUuid` valgfritt → gammel klient faller til server-wins. Mobil-delen når via EAS #38.
- **F4-1b (arbeider-mutasjoner NOT_FOUND på pre-invariant sedler) — server:** mobil sender lokal id (= `clientUuid`), men `hentEgenDagsseddel` (`dagsseddel.ts:120`) slo opp `findUnique({ id })` på server-PK → «Dagsseddelen finnes ikke» på pre-invariant-sedler (`id ≠ clientUuid`). Fiks: slår opp `id` FØRST, faller tilbake til `clientUuid` (begge `@unique`, ingen migrering). Latent oppfølger i BACKLOG: `oppdater`/`tilfoy*` skriver på rå input-id (web-only i dag).
- **F4-1c (visnings-dedupe av duplikat sedel-hode) — mobil-only, når via #38:** cruft-enhet viste to sedel-hoder for samme dato (tom «Arbeidstimer (0.00t)»-plassholder + populert). Pre-F4-1-relikvi (gammel pull matchet kun på server-`id`). F4-1 (M2) stopper nye; visnings-dedupe i `DagsseddelListe.tsx` (`dedupPerDato` + `lesDagssedlerLokalt`) kollapser hoder med samme dato, skjuler kun **tom** plassholder, ekte divergens (≥2 med innhold) vises med `AlertTriangle`-markering (aldri stille datatap). Rent display — ingen DB-skriving, ingen pull-endring.
- **F4-1d (web-førte rader usynlige for mobil — touch-parent) — server:** rad-mutasjoner skrev barn-rad uten å røre forelderen → Prisma bumper `DailySheet.updatedAt` KUN når sedel-raden selv skrives, så `hentEndringerSiden` (delta-vindu `updatedAt > sistSynk`) ekskluderte sedelen etter at hodet var synket → web-førte rader nådde aldri mobil (hode vist, 0 rader). Fiks: delt `touchSedel(prismaTimer, sheetId)`-hjelper som bumper `updatedAt` i **samme `$transaction`** som rad-writet. Full kandidatmengde enumerert — touch på 14 stier (`tilfoy/oppdater/fjern` × `timer/tillegg/maskin`, `tilfoy/fjernTilleggVedlegg`, `flyttTimerRadEco`, `splittRad`); `redigerSedelRader` gjort ubetinget sedel-touch. Allerede dekket: `opprett/oppdater/send/gjenaapne*/returnerRader/attester/returner` + `syncBatch` (upsert — ikke dobbelt-touched). Ekskludert: `attesterRader` (per-rad `attestertStatus` synk-es ikke til mobil). Ingen migrering (eksisterende `@updatedAt`).
- **F4-2 (accepted-deadlock) — server+web:** leder hadde ingen web-vei til å angre en fullført attestering (`attesterRader` flipper sedel→`accepted` når alle rader attestert → attesterings-/retur-knapper gated på `status==="sent"` forsvinner). Fiks (retning B, gjenåpne til `sent`): ny leder-mutasjon **`gjenaapneAttestering`** (input `{sheetId}`, precondition `accepted`→`PRECONDITION_FAILED`, leder-auth + `krevProsjektLeder`, tx: rader→`pending` + sedel→`sent`, nullstiller attestert-felter) + web «Gjenåpne attestering»-knapp i `accepted`-grenen (`AttesteringDetalj.tsx`) m/ ekte `<Modal>`. i18n `timer.attestering.gjenaapne.*` (nb+en+13 auto). Ny mutasjon (bakoverkompat), ingen migrering.
- **F4-2b (gjenåpne-knapp i lederens SeddelKort) — web-only:** lederens firma-attesterings-Attestert-fane rendrer `SeddelKort` read-only → F4-2-knappen i `AttesteringDetalj` nås aldri der. Fiks: gjenåpne-handling **på selve kortet** (`SeddelKort.tsx`), vist kun ved `readOnly`, ekte `<Modal>`, kaller `gjenaapneAttestering` + invaliderer `hentTilAttesteringFirma`+`hentTilAttestering`. Gjenbruker F4-2s i18n. Ingen api/DB.
- **F4-3 (rå `{{dato}}` i mobil attestert-tittel) — mobil-only, når via #38:** `timer/[id].tsx` kalte `timer.detalj.attestertTittel` («Attestert {{dato}}») uten `{dato}`-arg → rå placeholder (datoen vises alt separat rett under). Fiks: mobil bruker nå den rene nøkkelen `timer.status.attestert` («Attestert»). Delt nøkkel uendret for web. Ingen i18n-tillegg (gjenbruk).
- **F4-4 (projectId-poison i mobil-synk) — server+mobil:** `syncBatch`-input krevde sedel-nivå `projectId: z.string().uuid()`, men mobil sendte `""` for tom/plassholder-sedel → Zod 400 på HELE batchen → gift-isolering avviste sedelen. Fiks: sedel-nivå projectId er fallback-shim (T.1: rad-nivå kanon) → `z.union([uuid, ""]).nullable().optional().transform(v => v || null)` (datatap-fri bakoverkompat #37 + #38); `verifiserProsjektmedlem` betinget på non-null; ny `radProsjekt`-resolver + synlig `avvist`-guard for rad uten prosjekt; mobil push sender `sedel.projectId || null`. Gift-isolering (SYNC-1) redder gode sedler ved 400. Ingen migrering. Mobil-delen når via EAS #38.

## Prod-deploy 2026-07-10 (prod-merge `373a109f`) — bolk (h) offline-synk + M4/M5 + katalog-importer

Develop→main-merge `373a109f`. Innhold: **bolk (h)** SYNC-1/SYNC-2 + M2–M7 (mobil offline-synk-blokkere + web/server-paritet) + **M4/M5 server-endringer i `apps/api/.../dagsseddel.ts`** (distinkte gjenåpne-koder `CONFLICT`/`BAD_REQUEST` + `NOT_FOUND`-melding; `syncBatch` maskin-`fra<til`-vakt) + **generisk katalog-importer** (`admin.importerTimerKatalog`).

- Ekte Docker-bygg (442 s), migrerings-gate OK (0 ventende migreringer mot prod-DB `/sitedoc`), cutover uten nedetid, browser-verifisert som innlogget bruker.
- **Server-siden (M4/M5/SYNC i `apps/api`) er dermed LIVE i prod.** Gammel klient (#37) mot ny server er trygg (leser uendret `e.message`).
- **Mobil-siden når brukere først via EAS #38** — **blokkert** av de to 🔴 Fase-4-funnene (rader-forsvinner-etter-attestering + accepted-deadlock). Se [BACKLOG § Timer web-vs-mobil paritet → Fase 4 simulator-funn](BACKLOG.md).
- Etter deploy: `admin.importerTimerKatalog` kjørt mot prod-org (A.Markussen) — 26 opprettet / 12 oppdatert / 0 deaktivert, km-stjerne→`120`. Lukker BACKLOG-blokkeren «nivå-1 lønnsart-seed».

## Prod-deploy 2026-07-09 (prod-merge `224c13f6`) — timer-paritet + pause-regler + overlapp/gjenåpne-vakt + nyNav sticky-flag

Merge develop→main (`224c13f6`, 2026-07-09): «timer-paritet + pause-regler + overlapp-vakt + gjenåpne-vakt + salsaklubb-isolasjon + tilkoblingsbudsjett». Alle hashene under er verifisert med `git merge-base --is-ancestor <hash> origin/main`. Åpne **mobil**-oppfølgere er IKKE arkivert bort — de står i [STATUS-AKTUELT § PSI Fase A + Maskin + ③](STATUS-AKTUELT.md) + [BACKLOG § Timer web-vs-mobil paritet](BACKLOG.md).

### Timer pause-modell (skiftrelativt pausevindu) — `f385ba99`
Pausevindu regnes relativt til skiftstart (`standardPauseEtterTimer`, default 4.0 t) i stedet for fast klokkeslett; additiv migrering `ADD COLUMN standard_pause_etter_timer` (to-stegs). Verifisert: DB (6 rader = 4.0) + simulator + web 8/8 (D1–D8). Berører api `organisasjon.ts`, mobil `TimerSeksjon`/`pauseBeregning.ts`, web `innstillinger`/`RedigerRadModal`, i18n. Sannhetskilde: [timer.md § Pause-bevisst tid-synk](timer.md). **Mobil-UI via neste EAS-batch** (BACKLOG).

### Web dagsseddel auto-fyll Fra/Til (paritet mobil) — `cd58853a`
Option A, kalender-effektiv via ny `organisasjon.hentEffektivArbeidstid`-query, sommertid-aware. Se [BACKLOG § Web dagsseddel auto-fyll](BACKLOG.md).

### Generalprøve web-runde F1/F3/F4/F5 — `6f1b5670` (F1 `5ace3e3f`, F3/F4/F5 `17ba8bb0`)
Bak `nyNavigasjon`-flagg (inert i prod). Skjermbilder `docs/redesign/screenshots/F1-F5-web-2026-07-08/`. Fabel-godkjent.

### Timer web-vs-mobil paritet + gyldighet (bolk a–g) — `224c13f6`
Web arbeider-flate speiler nå mobil (app = fasit) + hard server-gyldighet. Bolkene: a `b3230944` (D7/D1/D2/D3), b `0985d46e` (D4/D5/D6), c `7797a9b5` (D8), d `bf78889c` (R1–R4 fra/til-regler), e `f101890e` (pause-bevisst maskin-rad B1–B4 + spenn↔antall-synk) + `10622ee3` (`tilFraAntall`-grensefiks + vitest), f `f59a498c` («Gjenåpne dagsseddel» web + attestert-vakt på server) + `1deaff6b` (`confirm()`→Modal), g `79e786a3` (`fra<til`-superRefine + overlapp-vakt (web-mutasjoner; `syncBatch` udekket — se [BACKLOG SYNC-2](BACKLOG.md))) + `c81c4eae` (hele-sedel-prefill + 0==0-lukking). Test-verifisert web 8/8. **Mobil bolk (e)/(f)/(g) via neste EAS-batch** ([BACKLOG § Timer web-vs-mobil paritet](BACKLOG.md)).

### nyNav sticky-flag stale-lokal-fiks — `c77f2cb1`
`lokalTillatt`-guard i `resolverNyNavigasjon` + rolle-avledet opprydning i web/mobil-hookene (ikke-admin låses ikke inne av gammel `lokal="1"`). Merk: STATUS-AKTUELT-tråden anga `3b975773` på branch `feature/nynav-sticky-flag-fix`; det som faktisk landet på main er `c77f2cb1` (verifisert `merge-base --is-ancestor`). Mobil-del via neste EAS-batch. Detalj: [BACKLOG § nyNav sticky-flag](BACKLOG.md).

## Prod-deploy 2026-07-07 (prod-merge `0be103fa`) — a2 (live) + PSI/maskin/③ web-live + redesign (K9/K6-P31, flagg-inert) + sok-fiks

Merge develop→main (`0be103fa`, 2026-07-07 09:56). **Migrasjonsfri** — 0 migration-filer i selve diffen; PSI-/③-migreringene ble anvendt i den **tidligere** prod-mergen `80974276` (2026-07-05, 3 `migration.sql`). Web-image-rebuilden i denne deployen gjorde den `80974276`-merget web-koden (PSI/maskin/③) faktisk **live nå** — jf. kjent «auto-deploy rebuilder ikke web»-sak: web-flatene ble ikke live før denne manuelle rebuilden. **Verifisert innlogget prod:** data laster, redesign **av-default** (flagg-mekanismen live-bekreftet), `/dev-login` ikke montert (404 i prod), K9-redirects aktive.

### a2 — Dagsseddel dobbel-timeføring LØST (`f53de3e9`) — DEPLOYET TIL PROD (live)
Arbeidstid-vindu forhåndsutfylt fra firma-kalender (`hentEffektivArbeidstid`, Oslo-anker) + degradert til valgfritt/sekundært på begge detalj-sider; radene + topp-sum er primær-flaten. Fjerner den brukervendte dobbel-føringen (vinduet er ikke lenger et påkrevd steg). Bevart: `pauseMin` som maskin-buffer, auto-gen-stien, arbeidstids-varsel; rører ikke overtid/lønn. **Mobil (`ArbeidstidSeksjon`) via neste EAS-bygg.** **Åpen koord:** 13-språks `timer.arbeidstidPrefyltHint` faller tilbake til `en` til redesignets neste `generate.ts` dekker nøkkelen. a1 (utled total fra rader) + web-norm-paritet = fremtidig. Se [timer.md § Dagsseddel a2](timer.md).

### PSI Mannskap Fase A (§15-innsjekk/utsjekk) — web i prod, mobil venter EAS
Merget i prod-merge `80974276` (2026-07-05, migrasjon `20260705120000_add_psi_tilstedevarelse` anvendt på prod); web-flaten live via `0be103fa`-rebuilden. Første inkrement av Fase 4 Mannskap (vy i PSI-modulen). **Manuell presence, ingen GPS** — oppfyller byggherreforskriften §15 (listen, ikke automatikk) med null GDPR-bakgrunnslokasjon-risiko.

- **Datamodell:** ny `PsiTilstedevarelse` (`packages/db`, rent additiv CREATE TABLE — verifisert mot Prismas kanoniske output). Ingen User-endring (§15-felt finnes fra Fase 0). Event-tidsserie, ingen FK til timer (to-lags-grense: presence ≠ lønnstid).
- **API:** `apps/api/src/routes/mannskap.ts` — `sjekkInn` (idempotent), `sjekkUt`, `minStatus`, `hentPaaPlassen`, `hentForProsjekt`. Modul-gated på `psi`. ⭐ **Feltnivå-isolasjon (lovkrav):** `innsjekkTid`/`utsjekkTid` strippes for kaller som ikke deler arbeidsgiver-org med arbeideren (byggherre ser §15-aggregat, aldri klokkeslett). 12t auto-utsjekk som lazy-close.
- **Web (live):** `/dashbord/[prosjektId]/mannskap` §15-vy (firma-filter, søk, HMS-mangel-varsel, §15-eksport-klar) + nav-oppføring gated på psi.
- **Mobil (venter EAS):** `MannskapInnsjekkKort` på hjem (online-only, ingen offline-kø i Fase A). Distribueres via neste EAS-batch.
- i18n: 24 nøkler × 15 språk. Sannhetskilde: [mannskap.md § Fase A](mannskap.md). Senere faser (B QR / C geofence+juridisk sign-off / D §15-PDF+GDPR / E timer-hook) parkert.

### Maskin-dagsseddel Del 1+2 — web i prod, mobil venter EAS
Merget i `80974276` (ren UI + delt util, ingen migrering); web live via `0be103fa`. Lukker de to BACKLOG-UX-postene fra `0801af38`.

- **Del 1 — maskin-velger søk/filter/sortering.** Ny delt web-komponent `MaskinVelger.tsx` (`SearchInput` + kategori-chips + sortering brukt-på-seddelen → internNummer (numerisk) → navn), brukt i alle fire web-callsites. Mobil `EquipmentVelgerModal`: samme kategori-chips + sortering + «brukt»-markør.
- **Del 2 — maskin ≤ arbeidstimer proaktiv (b+disable).** Inline kapasitet-linje, rød + Lagre disabled ved overskridelse. Web `MaskinRadDialog` + mobil `MaskinRadModal`.
- **Delt sannhetskilde:** ny `packages/shared/src/utils/maskinKapasitet.ts` — serverens `validerMaskinUnderArbeid` delegerer hit; klient-disable (web+mobil) kaller samme funksjon. i18n: 3 nye nøkler nb+en + 13 auto. **Mobil-delen rir neste EAS-bygg.** Detaljer: [timer.md](timer.md) + [maskin.md](maskin.md).

### Timer auto-lønnsart ③ (overtid strukturert + garantert standard) — web/server i prod, mobil venter EAS
Merget i `80974276` (migrering `20260705120000_lonnsart_overtidsnivaa` anvendt på prod, to-stegs); web/server live via `0be103fa`. Lukker ③a (feil-match) + ③b (manglende standard).

- **③a — strukturert overtid.** Nytt `Lonnsart.overtidsnivaa Int?` erstatter fritekst-navne-regex; overtid velges via `velgOvertidLonnsart` (type + `overtidsnivaa`-match, aldri navn). Lærling-varianter `overtidsnivaa=null` → aldri auto-valgt for normal arbeider. Web admin-UI: «Overtidsnivå»-select + Zod 50/100/null.
- **③b — garantert standard.** Backfill setter `erStandardvalg` for orgs med ≥1 ordinær men ingen standard. Auto-gen gjetter aldri; F-G rød banner beholdt for null-ordinære.
- **⭐ Forward-compat:** overtid-klassifisering isolert i delt `packages/shared/src/utils/lonnsregel.ts`. i18n: 6 nye nøkler nb+en + 13 auto. **A.Markussens overtid-lønnsarter (170/172/175/177) settes manuelt i admin-UI før auto-gen stoles på. Mobil-del rir neste EAS-batch.** Detaljer: [timer.md § Overtid-klassifisering](timer.md).

### Redesign steg ii–vi + K9 + K6/P31 Kontakter — kode i prod bak `nyNavigasjon`-flagg (av-default, inert)
Redesign-koden (steg ii hub + funn-1b-fix, iii sidebar + kontekst-chip, s1/v4/v5 polish, vi 2a mobil-tabs) er nå i prod-koden men **inert bak `nyNavigasjon`-flagg (av-default)** — **IKKE live pilot**. Det som ER live flagg-av: **K9 URL-kanonisering + redirects** (legacy `/dashbord/prosjekter/[id]/*` → kanoniske ruter). **K6/P31 Kontakter** er flagg-**PÅ**-nav — ny Kontakter-side finnes i prod-koden, men ikke synlig i nav med flagg av. Steg vii (2c-leser med språkpiller) er fortsatt **aktiv på develop** (ikke i denne prod-runden) — se [STATUS-AKTUELT.md](STATUS-AKTUELT.md). Full paritet + T/G-status: [redesign-paritetssjekkliste.md](redesign-paritetssjekkliste.md).

## Prod-deploy 2026-07-04 (kveld, prod-merge `0801af38`) — PR 1-4: org-isolasjon + Leaflet + sak #5 + maskin-gating

Bunt-deploy av fire develop-fikser (api+web) fra `main` (`0801af38`, merge av develop). `-p docker up -d --build --no-deps sitedoc-api sitedoc-web`. **Ingen migrering** (ren kode). Backup før deploy (`~/sitedoc-prod-2026-07-04.dump`, ~95 tabeller). Lockout-query ikke nødvendig (ingen av de fire rører `signIn`-gaten). Markør-sjekk i bygg-konteksten bekreftet alle fire (9/2/5/3). Innlogget prod-verifisering: Leaflet-kart laster fullt, firma-ansatt ser eget firma uten admin-meny/maskin-innganger, admin uendret, maskin-føring happy-path OK.

### PR 1 — org-isolasjon `SheetMachine.vehicleId` (§2.D) (`90469dc7`)
Pre-eksisterende cross-firma-lekkasje-klasse (åpen siden 2026-06-09): `SheetMachine.vehicleId` (maskindrift) ble skrevet uten å verifisere at maskinen tilhører firmaet. `Equipment` er svak FK (`db-maskin`, ingen `@relation`) → org-isolasjon MÅ håndheves i app-lag. Fiks: `verifiserKjoretoyTilhørerFirma` lagt på alle fem input-baserte SheetMachine-skrive-stier (`maskin.tilfoy`, `maskin.oppdater`, `redigerSedelRader`, `splittRad`, `syncBatch`). Completeness-søk bekreftet nøyaktig fem input-stier (øvrige 8 `update`/`updateMany` skriver kun status/attestert-felter). Rent additivt, ingen migrering.

### PR 2 — Leaflet geofence-kart (`6178034f`)
Geofence-modalens kart lastet kun hjørne-fliser. Rotårsak i delt `KartVelger` (`apps/web/src/components/KartVelger.tsx`): `Modal` (`packages/ui/modal.tsx`, native `<dialog>`) monterer barna alltid men `display:none` når lukket → `L.map()` init med 0×0-container, `setTimeout(invalidateSize,100)` fyrer mens dialogen er skjult. Ikke ren regresjon fra `b1c81629` (den eksponerte pre-eksisterende KartVelger-bug). Fiks: `ResizeObserver` på kart-container → `invalidateSize()` når container går 0→høyde ved modal-open; `disconnect()` i cleanup; fallback-`setTimeout` beholdt. Fikser alle modal-hostede kart-bruk.

### PR 3 — sak #5 firma-ansatt-innsyn (`6dbc884a`)
Firma-ansatte (role="user") fikk ikke `valgtFirma` populert (så verken eget firma, prosjekter eller timer/maskin-flater). Dobbel-kilde-design (naivt kilde-bytte ville krasjet modul-gating + lekket firma-admin-skallet): `hentMineMedlemskap` (`organisasjon.ts`) beriket med `aktiveFirmamoduler` via delt `berikMedFirmamoduler`; `firma-kontekst` beholder `hentTilgjengelige` som admin-sett + `hentMineMedlemskap` populerer `valgtFirma` (auto-select `tilgjengelige.length===1` → ellers `mineMedlemskap.length===1`); nytt `kanAdministrereFirma = erSitedocAdmin || (valgtFirma ∈ tilgjengelige)`; re-gate firma-admin-flater (`firma/layout.tsx` choke-point for alle 22 `/dashbord/firma/*` + opprett-UI i `nytt-prosjekt`/`kom-i-gang`) på kapabilitet, ikke `valgtFirma`-eksistens. Prosjekt-lister (`prosjekt.hentAlle`) allerede medlemskaps-scoped server-side. Bevarer admin-regel bit-for-bit.

### PR 4 — maskin opprett/import-gating (`179b86f9`)
Kosmetisk oppfølger til sak #5: maskin «Nytt»/«Import»-innganger (`maskin/page.tsx`) + `maskin/nytt`/`maskin/import` page-guards gated på `kanAdministrereFirma` (server beskyttet allerede via `verifiserFirmaAdmin`/`autoriserAdminForFirma` — hindrer bare at ansatte når skjemaer som feiler). Maskin-lista/-visning åpen for ansatte (de logger maskinbruk). Ny i18n-nøkkel `firma.maskin.ingenTilgangOpprett` (nb+en, auto-oversatt 13 språk).

## Prod-deploy 2026-07-04 (prod-merge `bb5aec05`) — split-identitet + erKunde + geofence-oppdagbarhet

Bunt-deploy av tre lav-risiko-endringer (api+web) fra `main` (`bb5aec05`, merge av develop `42d41aa8`). Build 97,8 s (ekte rebuild), `-p docker up -d --build --no-deps sitedoc-api sitedoc-web`. **Ingen migrering** (ren kode). Backup tatt før deploy (`~/backups/sitedoc-prod-2026-07-04-1929.dump`, 95 tabeller). Lockout-query = 0 rader (ingen bruker låst ute av gate-innstrammingen).

### Split-identitet MS-login (web↔mobil) — Fix A + gate-innstramming (`42d41aa8`)

**Funn (DB-bevis mot prod 2026-07-04):** KMY (`@onmicrosoft`) fikk **to `users`-rader** for én Microsoft-konto → web tom prosjektliste mens mobil viste 999. Rad A `f2d473b9…` (blandet case, har ProjectMember 999 + OrganizationMember A.Markussen; mobil-sesjon 30d) vs. rad B `3a3c6272…` (lowercase, tom; web-sesjon 24t). **Rot:** to samvirkende feil — (1) mobil (Graph `/me.id`) og web (Auth.js id-token `sub`) bruker ulik `provider_account_id` → web `getUserByAccount` matcher aldri mobilens konto; (2) `getUserByEmail`-overstyringen (`auth.ts:13`) var **case-sensitiv** mens lagret e-post avvek i case → e-post-kobling feilet → Auth.js opprettet duplikat B.

**Implementert:**
- **Fix A** (`auth.ts:15`): `getUserByEmail` → `{ equals: email, mode: "insensitive" }`. Fullfører herdingen som `signIn`-gaten + mobil alt hadde.
- **Gate-innstramming** (`auth.ts` signIn (a) + speilet i `mobilAuth.ts byttToken`): eksisterende canLogin-bruker slippes kun inn med `sitedoc_admin` / `OrganizationMember` / `ProjectMember` / ventende invitasjon / allerede koblet konto. Bruker fjernet fra alle firma/prosjekt avvises ved neste innlogging (ønsket). `company_admin` dekkes av OrganizationMember.

**Sak #3 (prod-datafiks KMY-duplikat) — UTFØRT** (konsolidering kjørt manuelt 2026-07-04): begge MS-kontoene (`068af417` mobil + `o05acphT` web) flyttet til A (`f2d473b9`, e-post endret til `kenneth@sitedoc.no`), B (`3a3c6272`) arkivert `can_login=false`. A eier 999; web-sesjon på A (18:16) bekreftet virker. Diagnostikk-SQL: `scripts/diag-kmy-web-bug.sql`.

**Fortsatt åpent (BACKLOG):** sak #4 (e-post-normalisering ved skriving + backfill), sak #5 (firma-velger `hentTilgjengelige` → `hentMineMedlemskap`).

### «Opprett firma» (admin) erKunde-fiks (API+web) (`6de25024`)

`admin.opprettOrganisasjon` satte ikke `erKunde`, falt til default `false`, og `hentAlleOrganisasjoner` filtrerer `erKunde: true` → opprettet firma ble usynlig (firmaet *ble* laget). **Fiks:** create setter `erKunde: true` (`admin.ts:156`). I tillegg `onError`+feilvisning på opprett-mutasjonen + `title`-tooltip på Brønnøysund-knapp (`brreg.hint`, 15 språk). Åpen oppfølger: prod-orphan-opprydding (read-SQL klar, Kenneths prod-DB-hånd) — se [BACKLOG § «Opprett firma»](BACKLOG.md).

### Geofence-discoverability (web) (`b1c81629`)

Geofence-editoren gjort oppdagbar på `byggeplasser/page.tsx`: egen synlig **«Geofence»**-verktøylinje-knapp (MapPin) → egen modal (skilt ut fra «Endre navn», som nå er ren navne-endring). Ikon/label-fiks: «Endre navn» Copy→Pencil, «Rediger»→**«Tegninger»** (LayoutGrid). Opprett markerer ny byggeplass i lista. Geofence-seksjon flyttet verbatim (settGeofence/beregnGeofence/geokod uendret). i18n: ingen nye nøkler (gjenbruk `lokasjoner.geofence.tittel` + `nav.tegninger`), hjelp-tips oppdatert (15 språk).

---

## Detaljer flyttet fra STATUS-AKTUELT (2026-08-20)

> Disse blokkene sto igjen i STATUS-AKTUELT etter at sakene var deployet til prod og
> arkivert hit. Teksten er flyttet ordrett — ingenting er strøket.

### ✅ Timer-mobil F2/F3/F5 (feltfunn del-6) — DEPLOYET PROD `43299d03` + EAS #40 (2026-07-15) → arkivert [historikk-2026-07](historikk-2026-07.md#prod-deploy-2026-07-15-prod-merge-43299d03--eas-40--timer-f2f3f5-byggeplass-per-rad--matpause-b%C3%A6rer--finnbarhets-revisjon)

Byggeplass-velger tri-tilstand (F2) + byggeplass per timer-rad (F3) + matpause-bærer per rad (F5) + edge #1 dynamisk minutt-etikett. Prod-migrering `20260714120000_sheet_timer_pause_min` applied på `sitedoc`; mobil i TestFlight via EAS #40. Fasit: [timer-mobil-f2f3f5-spec.md](timer-mobil-f2f3f5-spec.md) · detaljer: [timer.md § F5](timer.md).

### ✅ Del-6-fiksrunde F-b/F-e/F-f/F-g — DEPLOYET PROD `f888fecc` 13.07 + EAS #38 → arkivert [historikk-2026-07](historikk-2026-07.md#prod-deploy-2026-07-13)
> _Deployet — detaljene under er historikk (flyttes/trimmes ved neste rens). Oppsummering + gate-lærdommer i historikk-2026-07._

Fire rotårsaksfikser på branch fra develop `2bbf9169` (ren base, S-A + footer merget). Rutet gjennom cowork-gate (ikke selv-committet).
- **F-b:** `utvidArbeidstidsvindu` (`StartSluttDagKort.tsx`) tar `sluttTidKilde`-param → utvider `endAt` KUN ved bekreftet `"bruker"`-slutt; `system`/`midnatt`-gjett skyver ikke vinduet ut med fabrikkerte tider.
- **F-e:** ny `PAUSE_TERSKEL_TIMER = 5.5` (fast, AML §10-9) + `pauseMinForDag(dagsTotal, standardPauseMin)`; **auto-gen-stien** gater pausefradrag på dagstotal i **`fordelArbeidstidFradrag`** (dag-nivå pause-kilden — re-fiks 2026-07-13 flyttet gaten hit fra `carveArbeidstider`-vinduet) — der 38-min-avviket oppstår. **De interaktive edit-flatene (TimerSeksjon/MaskinSeksjon/web) er ÅPNE** (dag-nivå-modelleringsproblem — se BACKLOG § F-e; flagget ved gate). **⚠️ KJENT BEGRENSNING (pilot):** manuell rad-redigering på en <5,5t-dag trekker fortsatt pause (interaktiv-sti, pre-eksisterende — IKKE regresjon). Fikses i F-e-interaktiv-oppfølgeren (design-gate hos fabel først). Fabels F-e-live-fangst denne runden tester KUN carve-stien.
- **F-f:** `redigerSedelRader` + `RedigerRadModal` fra/til-vakt via delt `finnTidsromKonflikt` (samme som `syncBatch`) + mangler-tid-vakt. `validerSplittFelles` avvist (sum-invariant). Nye i18n-nøkler.
- **F-g:** differensiert «for kort»-melding (`haddeEksisterendeRader` → pre-fylt-variant). Nye i18n-nøkler.
- Typecheck 0 nye feil (shared 9=9, api grønt, web 4=4 vitest-baseline, mobil 11=11). i18n generate → 13 språk.
- **✅ AKSEPT BESTÅTT (live-fangst 2026-07-13, bundle `7ab96531`):** F-b-a (faktiske økt-tider) + F-b-b (skjerming: manuell `bruker`-slutt ikke overskrevet) + F-f-web (fra/til-vakt blokkerer tom Fra, gyldig lagrer) + F-g-a/b (differensiert/gammel melding) + **F-e-carve re-test** (kort dag 42 min → rad 0,75t full varighet uten pause; lang dag 6t → rad 5,5t pause trukket) — alle PASS (simulator + web). **Merket:** F-e-carve hadde AVVIK i første impl (rad-verdi ugatet, gate-glipp fanget av simulator) → re-fiks (`7ab96531`) flyttet gaten til `fordelArbeidstidFradrag`. Skjermbilder for fabel: `docs/claude/skjermbilder-del6-live/`. **Venter fabel design-sign-off (F-g-copy-finpuss + F-b-UX) → del 6 DoD → prod spor b.**

### ✅ hentEndringerSiden «erstattet»-lekkasje (fiks B) — DEPLOYET PROD `f888fecc` 13.07 (2 migreringer kjørt på `sitedoc`) → arkivert [historikk-2026-07](historikk-2026-07.md#prod-deploy-2026-07-13)

**Rot:** mobil-pull `hentEndringerSiden` (`apps/api/src/routes/timer/dagsseddel.ts`) manglet `attestertStatus ≠ "erstattet"`-filteret som alle andre lesere har (aktiv-helper 394/403, web-attestering 1835-1837, `hentForAttestering` 1974) → mobil viste ×N rader (write-only audit-rader fra rediger-mutasjonene). **DB-bevist** (seddel `49a7c839` test = 3 live + 6 «erstattet» timer / 2 live + 4 «erstattet» maskin; web filtrerte og viste 3+2, mobil-pull viste 9+6).

**Fiks B («lagre rett» uten å slette data):**
- **Ny felles tabell `SheetRadHistorikk`** (`packages/db-timer`, migrering `20260713120000_sheet_rad_historikk`, **kun ADD**) — JSON-snapshot + `radType` + `originalRadId` + `parentRadId` + `erstattetVed`. Felles tabell fordi de tre kildetabellene har ulik kolonneform + historikk leses aldri for beregning.
- **Rediger-mutasjonene** (`rediger`-bulk 2804 + `splittRad` 3009): **FLYTTER** originalen til historikk (INSERT snapshot + DELETE hovedtabell i SAMME tx) i stedet for å sette `attestertStatus="erstattet"`. Parent-lenke bevart (ny rad.`parentRadId` → historikk.`originalRadId`).
- **Data-migrering** (i samme migrerings-tx): FLYTTER eksisterende «erstattet»-rader (alle 3 typer) fra hovedtabellene → historikk (INSERT via `to_jsonb(t.*)` + DELETE). **MOVE, aldri hard-delete.**
- **`hentEndringerSiden`** (3487): `not: "erstattet"`-vern på timer/tillegg/maskiner-include (rulleringsvern, no-op etter migrering).
- **`attestertStatus`-kolonnen beholdt** (pending/attestert/returnert brukes fortsatt).

Fiks B: `5c9d2070` (kode + migrering + docs). **DEPLOYET api-test + DB-verifisert** (hovedtabell 3 timer/2 maskin live, 6+4 audit-rader flyttet til `sheet_rad_historikk`). **M-1 PASS** (fresh full pull → 3/2) + **M-2 PASS** (stale enhet → normal delta-sync self-heal → 3/2 uten reinstall). Begge cowork-gatet — hele fiks B (hoved + self-heal) bevist ende-til-ende.

**Oppfølger — self-heal av stale lokal tilstand (M-1-funn, TEST-MIGRERT + M-2 PASS):** M-1 avdekket at eksisterende stale lokal visning (9/6) **ikke** self-healer via delta-pull: hoved-migreringen FLYTTET barn-rader uten å bumpe `daily_sheets.updated_at` (barn-endringer bumper ikke parent — bevisst i koden), så `hentEndringerSiden`-delta (`updatedAt > sistSynk`) tar ikke med de berørte sedlene → arbeideren beholder oppblåst visning til full pull/reinstall. Payroll trygt (server korrekt), kun kosmetisk. **Fiks:** ny migrering `20260713130000_bump_updatedat_erstattede_sedler` — ren `UPDATE daily_sheets SET updated_at = now() WHERE id IN (SELECT DISTINCT sheet_id FROM sheet_rad_historikk)`. Bumper de berørte sedlene → neste delta-pull re-henter → pull-apply (delete-all-local + insert-server) reconciler til 3/2. Self-heal uten reinstall. KUN `updated_at`-bump, ingen skjema-endring, idempotent. **Test-migrert 2026-07-13** (`87af7e5b`; `daily_sheets.updated_at` for `49a7c839` bumpet til migreringstid; **M-2 PASS** bekreftet delta-sync-heal uten reinstall). **Prod (begge migreringene) venter Kenneths go — spor b (full `develop→main` når del 6 m.m. er godkjent).**

### ✅ Del 6 timeføring — DEPLOYET PROD `f888fecc` 13.07 + EAS #38 → arkivert [historikk-2026-07](historikk-2026-07.md#prod-deploy-2026-07-13)

Redesign-Opus del-6-arbeid, isolerte branches fra develop, bak coworks dual-review-gate:
- **del 6 P1–P5** (`feat/del6-timeforing`, merget develop `fa2c47a3` + i18n `5f7e1aa8`): P1 maskin-i-rad (web+mobil, UI-only), P2 arbeider-splitt (`splittRadEier` + delt `validerSplittFelles`, web+mobil lokal Drizzle), P3 hybrid (HjemTimerChip 3 tilstander + kort på timer-flaten), P5/P4c allerede på develop. Web fabel-designgodkjent (`docs/claude/skjermbilder-del6-live/`). **P2-mobil duplikat-bug (S3) fikset** via update-original-id (`443c7b38`).
- **fra/til obligatorisk + GPS-carve** (`fix/timer-fra-til-obligatorisk`, `a0d510a5`+`62cee2dc`, merget develop `032491a0`): se [timer.md](timer.md)-rad. **Vedtak: a2-reversering + reise-unntak.**
- **oppfølgere** (`fix/del6-oppfolgere`, `8515555c`+`9d6a8d82`, venter gate): **F-a** tom dagskort-dag gir også variant B; **F-c** «Økten var for kort»-melding ved 0 carve-rader.
- **F-b «Til kl.»-fiks (design, IKKE kode):** designfila RUNDE 5 + `screenshots/runde5-tilkl-2026-07-13/` — forslag: «Slutt dag» skriver faktiske økt-tider. **Foreslått** sluttTidKilde="bruker"-skjerming (må implementeres — `utvidArbeidstidsvindu` sjekker ikke sluttTidKilde i dag). Venter Kenneth-valg.
- **S-A mobil rad-sletting propagerer ikke (S3) — TOMBSTONE LØST + TEST-VERIFISERT (M-3-reprise PASS), venter prod spor b:** Ny lokal `slettede_rader_local`-tombstone-tabell; fjern-handlerne skriver tombstone atomisk (`db.transaction`); syncBatch-push sender `slettedeIder: {timer,tillegg,maskiner}` (optional, #37-bakoverkompat) → server `deleteMany({ sheetId, id:{in} })` bak samme vakt som payload-replace (KRAV 2); pull-race-guard hopper over re-innsetting av rad med levende tombstone (KRAV 1); tombstones ryddes kun ved server-bekreftet sync (KRAV 3). Gatet `6bed19c3`. **✅ M-3-REPRISE PASS (simulator + server-SQL, IKKE EAS):** slett rad → sync → borte lokalt OG på server (`deleteMany` propagerte, `065dc8f4` borte) + pull re-innsetter ikke. Venter kun prod (spor b). Full design + 3 krav: [BACKLOG § Mobil timer-rad-sletting](BACKLOG.md).

### Lønnsart/katalog-import (A.Markussen) — KJØRT PÅ PROD 2026-07-10 (etter deploy 373a109f)

Landet på `develop`:
- `c875ee6f` — 6 BACKLOG-rader (lønnsart/kode-funn) + drift-rettinger i `timer.md` og `docker/DOCKER-NOTES.md`.
- `92f15893` — generisk `importerKatalog` (`apps/api/src/services/katalog/`, søk `export async function importerKatalog`) + A.Markussen-fixture (`fixtures/a-markussen.json`) + tRPC `admin.importerTimerKatalog` bak `verifiserSiteDocAdmin`.

**Resultat (prod, 2026-07-10 etter deploy `373a109f`):** `admin.importerTimerKatalog` kjørt mot prod-org (A.Markussen) med `dryRun: false` + `deaktiverUmatchedeLonnsarter: false` (bevisst — Kenneth ville **ikke** auto-deaktivere). Oppsummering: **26 opprettet, 12 oppdatert** (alias-treff festet `kode` til eksisterende rad → ingen dubletter), **0 deaktivert**, stjerne flyttet km→120 (`nullstiltStandardvalg: 1`, `standardKodeSatt: 120`). `dryRun: true` ble kjørt FØRST og bekreftet match-veien før skriving. **14 legacy-rader BEHOLDT aktive** (diett/km/nattillegg/losji/lærlingelønn/velferdsperm./skift-som-lønnsart) — Kenneth sletter manuelt i UI eller i kundesesjon. **Åpent til Florian:** km/diett som utlegg? Skal nattillegg/matpenger/smusstillegg/lærlingelønn fortsatt registreres? → km-stjerna og 0-kode-radene er borte; nivå-1-seed-blokkeren i BACKLOG er lukket.

**Prod-tilstand** (målt 2026-07-09 av Kenneth, ikke egen-verifisert): A.Markussen har 25 lønnsarter, 0 med `kode`, `erStandardvalg` står på `Kilometergodtgjørelse (egen bil)`.
