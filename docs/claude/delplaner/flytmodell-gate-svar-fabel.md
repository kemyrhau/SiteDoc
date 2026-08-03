# Fabel gate-svar: Fase 0 nå-sjekk flytmodell (31.07.2026)

**Til:** cowork / redesign-Opus (via Kenneth) · **Gjelder:** inbox-cowork.md STATUS 🔵 gate-stopp
**Grunnlag:** Opus' Fase 0-rapport mot origin/develop + `flytmodell-veileder-cowork.md`

## Godkjent uten forbehold
1. Fase 1 = **backfill** av eksisterende `steg`-kolonne (ikke ny kolonne). Multi-steg-kapabel kode bekreftet — dataene mangler.
2. **Lagret `sendt`-flagg** som eget felt (veileder § 2.3). Opus' presisering bekrefter nødvendigheten: draft kan nås via received→draft og approved/closed→draft, så «aldri sendt» kan ikke avledes av status.
3. To-lags datamodell (per-ledd: steg + ansvarsmerke + klassifisering; per-dokument: aktivPosisjon + retning + terminal + sendt) og to-stegs migrering — aldri drop, status-enum som avledet cache.
4. Gjenåpne-veiene i `isValidStatusTransition` **erstattes** av § 2.4-reglene, suppleres ikke (veileder krav 1 — ingen dobbel sannhet).
5. Slette-funnene tas inn i fasearbeidet: firmaadmin mangler i dagens rett; dagens guard (blokkerer alt sendt) er motsatt av vedtaket (§ 2.5) og skal snus.
6. Bonus-funnet (generisk approved/rejected oppdaterer verken eier eller recipient) føyes til rotårsakslisten § 1.

## Vedtatt (Kenneth 31.07, på fabels anbefaling)
Forslag 1–3 under er **vedtatt**. Kenneth vedtok på tillit til fabels konsekvensvurdering; konsekvensene er derfor eksplisitt beskrevet per punkt, og Opus skal flagge tilbake via fabel dersom implementeringen avdekker konsekvenser utover disse.

1. **Klassifisering + retningsrettigheter:** per-ledd enum `{kontroll, utfør, orienteres}` bak ansvarsmerket.
   - **Send →**: leddet som holder ballen
   - **Besvar ←**: kontroll- og utfør-ledd
   - **Videresend ↔**: H3-modellen beholdes (admin-nivå + eksplisitt override)
   - **orienteres**: aldri ball, aldri retningshandlinger; varsel + lesetilgang
   - *Konsekvens:* knappesettet per bruker styres av leddtypen valgt ved flytoppsett; feilvalgt type gir feil knapper — rettes av admin via flytredigering.
2. **HMS-flyten:** modelleres som ordinær 2-ledds flyt (oppretter → HMS-gruppe) i samme posisjonsmodell — ingen særkode.
   - *Konsekvens:* HMS-dokumenter oppfører seg som en kort standardflyt («bestiller sist»-mønsteret). **Gate-betingelse:** Opus verifiserer at alle HMS-veier (besvar/lukk/gjenåpne) overlever mappingen FØR Fase 1 starter; avvik meldes fabel.
3. **cancelled (legacy):** migreres til ny terminal-verdi **`avbrutt`** med egen etikett.
   - *Konsekvens:* gamle avbrutte dokumenter beholder etiketten «Avbrutt», blir aldri slettbare (som øvrige terminaler), kan gjenåpnes etter § 2.4. Ingen tvangsmapping, ingen dataendring utover terminal-feltet.

## Gate-status
Vedtak 1–3 foreligger → gaten er **åpen for Fase 1**, betinget av HMS-verifiseringen i punkt 2.

## HMS-verifisering: fabels avgjørelser på FLAGG 1–3 (31.07, etter Opus' rapport)
**Godkjent av Kenneth 31.07.2026** — FLAGG 1–3 under er endelige vedtak.

Kjernefunn tatt til etterretning: HMS-dok er flyt-løse i dag (`dokumentflytId = null`) — «HMS = ordinær 2-ledds flyt» innebærer reell flyt-binding. Innenfor vedtaket; eget arbeidsstykke i Fase 1-planen. De 5 innenfor-modell-konsekvensene er akseptert som logget.

1. **FLAGG 1 (`firmaBehandleAvvik`) — vedtatt som anbefalt:** gjøres til ↔ admin-override som KUN setter `terminal`, skriver via `avledStatus`, og fører **transferlogg** (ikke TaskComment). Vilkårlig status-setting utenfor avledningen fjernes.
2. **FLAGG 2 (hvem lukker) — anbefaling A, generalisert:** ingen HMS-særkode. Nytt leddflagg `kanTerminereUtenBall` (gyldig kun på kontroll-ledd); HMS-seeden setter det på Ledd 2. Rutingen kjenner bare flagget. Samme mekanisme dekker hovedflytens eksisterende «Lukk uten ball» (F3: godkjenner/bestiller eier Lukk fra Under arbeid) — én kilde, ikke to.
3. **FLAGG 3 (`hmsTilfoyInformasjon`) — vedtatt som anbefalt:** forblir ikke-retningshandling — kommentar + varsel, ingen ballflytt, ingen statusendring.

**Gate-status: åpen for Fase 1.** HMS-betingelsen er innfridd; FLAGG-avgjørelsene over er del av datamodell-grunnlaget (terminal-skriveregler + leddflagg).

## Fase 1 schema-OK (fabel, 31.07)

Klarsignal på Fase 1-datamodellplanen. De fire valgene:
1. **ASCII enum-staving (`utfor`)** — ja (konsistens med `rolle:"utforer"`; visning eies av etikett-laget).
2. **Splitt 1a (schema+backfill, ren SQL) / 1b (HMS flyt-binding, eget commit)** — ja.
3. **Rolle-default for ansvarsmerke** — ja; ordliste forfines ved oppsett-UI (veileder § 5).
4. **`aktivPosisjon` ved terminal = leddet termineringen ble utført fra** (korreksjon av «siste ledd»): for godkjent er dette automatisk siste ledd (§ 2.3 bevart); for avvist/lukket/avbrutt er det leddet der handlingen skjedde — simulatorens fasit-oppførsel, og gjenåpne-regelen «admin → samme boks» avhenger av den. Samme regel under `kanTerminereUtenBall`. Backfill: `approved` → siste ledd; `closed`/`cancelled` → utled fra transferlogg, fallback siste kjente posisjon.

Neste stopp: Opus prøvekjører migrering + backfill på sandkasse-DB og rapporterer før test.

## Fase 1a: fabel-godkjent — klar for commit (31.07)

Prøvekjøring grønt på lokal sandkasse, alle vedtak fulgt: vei 2→1 (ROLLBACK bevist, deretter `migrate deploy` — kun 1 migrering anvendt, 197→198, fremmede urørt), tellinger verifisert (klassifisering/ansvarsmerke 34/34; `kanTerminereUtenBall` 20 = bestiller 8 + godkjenner 11 + HMS-utforer 1; HMS-override presis 1/7; DENSE_RANK tette steg; `sendt` korrekt mot transferlogg). Reconcile: terminal-`aktivPosisjon` inn i migreringen per valg 4 (godkjent→siste ledd; øvrige→terminerende senders steg, MAX-fallback); non-terminal `aktivPosisjon`+`retning` NULL til Fase 2 (AVKLARING 1).

**Betingelse videreført:** sandkassen manglet terminale dokumenter — terminal-backfillen er kjøringsverifisert, ikke dataverifisert. Spot-sjekk på test-DB er **gate-betingelse for test/prod-deploy** (ikke for commit).

Status: **klar for commit/push** — cowork eier merge-timing. Deretter 1b (HMS flyt-binding) som eget commit med egen gate.

## Fase 2 gate: Q1–Q4 avgjort (fabel, 31.07)

Signaturene (nesteLedd, forrigeKontrollLedd, avledStatus, retningsrettigheter, finnPosisjon + `PosisjonsLedd` i `@sitedoc/shared`) og «ingen server-endring i Fase 4» er godkjent som spec'et.

1. **Q1 — A (kollaps received/in_progress): vedtatt.** Distinksjonen var aldri rutingbærende. Eventuelt fremtidig «sett/påbegynt»-behov løses i visningslaget (perspektivEtikett/lesekvittering) — aldri som ny statusfakta.
2. **Q2 — vedtatt med overgangskrav:** ny `harBallenPosisjon` i shared; gammel beholdes til Fase 4. Krav: divergens-test som kjører begge mot samme fixtures og rapporterer avvik (Kenneths 31.07-sekvens SKAL divergere — det beviser korrekthet). Fase 4-byttet gjøres bevisst mot den rapporten.
3. **Q3 — godta.** Terminal-feltet er sannheten; cachen bærer ikke distinksjoner sannheten ikke har. rejected/dismissed-skillet lever i terminal-verdiene + transferloggen.
4. **Q4 — ja.** TS-backfill via den delte matcheren = «én kilde» (veileder krav 1); SQL ville vært en tredje ruting-implementasjon.

Gate åpen: Opus bygger biblioteket + testene + backfillen på feat/flytmodell-fase2.

## Fase 3.3 semantikk-avklaring (fabel, 31.07 — bindende)

**Tolkning A bekreftet, prototypen som fasit:** utførerens «ferdig + submit» er **Send →** (`nesteLedd`, fra siste ledd = Godkjenn). **Besvar ←** er utelukkende retur bakover (`forrigeKontrollLedd`) — godkjenner ber om utbedring o.l. Veileder § 1 bruker det GAMLE vokabularet (dagens system feilmerker forover-submiten «Besvar» og ruter den bakover — det er selve buggen); § 2.2 er modellen og har forrang. GO 3.3-bevisformuleringen «Besvar skal gå til godkjenner» korrigeres til: «utførerens submit (Send →) skal nå godkjenner».

Fasit-sekvens (simulatorens logg, standard 4-ledds preset): 1 Send→2, 2 Send→3, 3 Send→4, 4 Godkjenn ✓. Retur: 4 Besvar←3. Opus koder retningsbyttet + integrasjonstest uten flere stopp.

## Fase 4 gate + design-kall (fabel, 31.07)

1. **Grense-flagget godkjent innen Fase 4:** grensen er «ingen ruting/skrive-endring». Additiv read-only output-plumbing (tRPC-select: aktivPosisjon/retning + medlem-klassifisering/kanTerminereUtenBall/erHovedansvarlig + mobil-domain) hører til konsum-runden. Krav: ren projeksjon, ingen ny logikk i select; mobil samme felt i samme commit.
2. **Konsolideringsplan steg 1–3 + 5 godkjent** (som cowork-gatet): shared bærer regler, klient beholder tynn visnings-Ledd; 6 harBallen-kallere → harBallenPosisjon; mobil-paritet samme runde.
3. **Ansvarsmerke-ordliste (steg 4, bindende startsett):**
   - kontroll: «Kontrollerer avvik» (bestiller-default) · «Godkjenner økonomi» (godkjenner-default) · «Kontrollerer HMS» (HMS-gruppe)
   - utfør: «Utfører arbeid» (utforer-default) · «Registrerer» (registrator-default)
   - orienteres: «Orienteres»
   - Regler: maks ~22 tegn, verb-først; fritekst tillates ved oppsett, men klassifiseringen styrer alltid rettighetene — merket er ren visning. Utvides ved oppsett-UI.
4. **Orienteres-varsling:** varsel ved (a) første send inn i flyten og (b) terminal — ikke hver bevegelse. Lesetilgang hele tiden. Revideres etter pilot.

## Fase 3.6-vedtak: received→sent gjeninnføres (fabel, 01.08)

5a avdekket at §8A/P1 fjernet `received→sent` (recipient-løs no-op i gammel modell) — dermed kunne ikke utfører Sende forover. **Løsning 1 vedtatt:** overgangen gjeninnføres, rutet via `nesteLedd`. Veileder § 2.2 («Send → = neste ledd», ethvert ledd) og Tolkning A står; løsning 2 (forover = Videresend) forkastet fordi ↔ er på tvers og admin-gatet (H3) — normal fremdrift kan ikke kreve admin-rettighet. Posisjonsmodellen gir overgangen meningen den manglet i P1 — gjeninnføringen fullfører fiksen, reverserer den ikke.

Krav: (1) kun rutet via `nesteLedd`, aldri recipient-løs; (2) guard: bare ballholder kan Sende; (3) 5a utvides — utfører-Send fra received blir grønn + «bestiller sist»-fixture. Fase 3.6 går FØR Fase 4 steg 4 (UI-teksten «Send til N·X» vises fra ethvert ballholder-ledd).

Status: 5a-regresjonsnettet er merget til develop (12d2e401) — pilot-fiksen står grønn uavhengig av dette.

## Fase 4 steg 3+4 design-kall (fabel, 01.08)

1. **Ansvarsmerke-plassering: kun i flyt-sheeten** (veileder § 4 står — flytlinje i header = nummer + hvem). Unntak: aktivt ledd viser merket i «Du har ballen»-mikroteksten («Du har ballen — Kontrollerer avvik»). Begrunnelse: mobil-plassbudsjett + merket er oppslagsinformasjon, ikke navigasjon.
2. **Primærknapp fra received: «Send til N · X →»** (målleddets nummer + hvem, ikke ansvarsmerke) — identisk ordlyd fra draft og received; posisjonen varierer, ikke handlingen. Siste ledd: «Godkjenn og fullfør ✓».

## Menyfiks-vurdering (fabel, 01.08)

Test-skjermbildet (Send-split viser prosjektvelger-innhold løsrevet på skjermen) er **ikke gyldig bevis mot fiksen**: e6a8ebba ble rsync'et etter at web-bygget startet → bygget er trolig a64044d8 uten fiksen. Kjør web-only-blokket på nytt (build sitedoc-test-web → up -d --no-deps; ALDRI up -d --build per OOM-merknaden) og re-test.

Hvis feilen består etter verifisert bygg: dette er en **portal/anker-feil, ikke CSS** — dropdownen rendrer PROSJEKT-velgerens innhold i feil portal-posisjon. Opus sjekker da portal-target + anker-ref for split-menyen.

Notert grønt: flytlinja i header viser posisjonsmodellen korrekt på test (1→2→3→✓4, aktivt ledd markert) — Fase 4 del 1 verifisert visuelt.

## §2.4 gjenåpne-posisjon: vedtak (fabel, 01.08)

Funn #2 (gjenåpnet dokument beholdt aktivPosisjon=4) er systematisk: `gjenapnePosisjon` (§2.4-regelen) ligger ferdig kodet men aldri påkoblet; `beregnRuting` nullstiller ikke posisjon på draft-overgang.

**Alternativ A vedtatt:** koble på `gjenapnePosisjon` — wiring, ikke ny logikk. Krav: draft-overgangen i `beregnRuting` går via samme funksjon, ingen egen vei.

**Reconcile: gjenåpne og trekk-tilbake deler landing** («ballen lander i handlerens eget ledd», §2.4 pkt 1–3) men har ulike gate-betingelser: gjenåpne = medlem/admin fra terminal; trekk-tilbake = kun avsenderleddet, fra sendt før mottaker har handlet (`retning: tilbake` til eget ledd — ingen ny terminal/retning). Én landing-funksjon, to guards.

E2e-krav: Kenneths aktivPosisjon=4-tilfelle som regresjonstest + trekk-tilbake-tilfellet.

Notert: meny-fiks #1 (fa49f9a5) gatet grønt — roten var obsolete utkast-mottakervelger på flyt-bundne utkast (`draftSend = … && !harFlyt`), z-50 ærlig reversert. Batches med bygg-stempel etter 5b.

## Pilot-funn 02.08: fabels kall på A–D + nytt funn #11 (fabel, 02.08)

Grunnlag: `verifisering/flytmodell-pilot-bevis-2026-08-02/` (rapport + bevis-01..09, lest).

- **B (#1/#2) bekreftet som implementasjonsavvik:** kontroll-ledd som mottar Besvar → primær «Send til N·X →»; «Godkjenn og fullfør ✓» KUN på siste ledd (`nesteLedd=null`). Bevis-03: ball hos ledd 2/4, primær «Godkjenn» = regelbrudd. Vedtak 01.08 står.
- **A (#3/#8/#9) — strukturell fiks påkrevd:** mottakervelgeren skal fjernes fra split-menyens render-tre i alle flyt-bundne tilstander — IKKE nok et tilstandsvilkår (tredje forekomst av samme klasse = plaster-mønster).
- **C (#7) avgjort:** split-▾ = gyldige retninger fra posisjon + eide terminaler, fast rekkefølge: Besvar ← · Videresend ↔ · Avvis · Lukk · Slett (admin, § 2.5). Utkast Besvares IKKE (`!sendt` = lokal tilstand) → bevis-06 (Send + Slett) er korrekt som den står. Ingen kodeendring.
- **D (#10) — etikettfeil i avledningen, ikke Q1-kollisjon:** gjenåpnet dok har `sendt=true` (§ 2.3) og skal avlede «Hos N · X» — aldri «Utkast». Rot: gjenåpning skriver draft til status-cachen. Fiks: gjenåpning setter ikke cache til draft; «Gjenåpnet» er tidslinjehendelse, ingen ny statusfakta.
- **NYTT #11 (bevis-09):** gjenåpnet dok, ball hos ledd 4 (siste), viser primær «Send» uten mål i stedet for «Godkjenn og fullfør ✓». Samme rot som D; eget verifiseringspunkt i fiks-ordren.

**Ordre-pakking:** A + B + D/#11 = én fokusert Opus-ordre. E2e-krav: bevis-03-tilfellet (Besvar→kontroll-ledd→primær Send) + bevis-09-tilfellet (gjenåpnet fra Godkjent → «Hos 4», primær «Godkjenn og fullfør»).

## Videresend-kall: ship bleeden-fiksen (fabel, 02.08 — blokkerende for A-merge)

**Valg 1 vedtatt:** merge A nå — Videresend forsvinner interim fra web flyt-dok (admin-only-tap, smalt; nødveier finnes). Inline-velgeren i split-▾ var selve bleed-mekanismen og skal ikke bevares. **Oppfølger-designsak:** «Videresend ↔» tilbake som ren oppføring → egen mål-velger-flate (mobils «Bytt flyt»-modal som mønster); fabel skisserer etter pilot-fiksene. C-rekkefølgen står som målbilde; interim uten Videresend-raden = akseptert avvik. B + D + backfill merges uavhengig.

**Trekk-tilbake-status (parallell senere-sak), foreløpig retning:** «Hos [avsenderens ledd]» via samme avledning som D (`sendt=true` består) — ikke egen etikett. Endelig kall når saken tas.

## Runde 2-pilot: fabels kall bøtte 1 + 3 (fabel, 02.08)

Grunnlag: `verifisering/flytmodell-pilot-bevis-2026-08-02-runde2/rapport.md` (lest). A/B/D bekreftet uten regresjon.

1. **#15/#12 — én bakover-handling:** «Send tilbake» (`responded→in_progress`, legacy) FJERNES; Besvar ← tilbys også fra received med ordlyd «Besvar til N · X ←». Cowork-noten (beregnRuting håndterer ikke in_progress) bekrefter at handlingen aldri var posisjons-integrert.
2. **#16/#17/#18 — kollaps helt, Q1=A står:** tidslinjeloggen bytter til samme avledningsvokabular som statusen (ingen «Under arbeid» i loggen). «Venter på»-nyansen leveres av perspektivEtikett (seer-relativ: «venter på deg»/«venter på kmy») — visningslag, aldri ny statusfakta (jf. Q1-vedtaket).
3. **#10b/#11 — trekk-tilbake:** guard — kun avsenderleddet, kun når noe er sendt og mottaker ikke har handlet; aldri på ferskt utkast. Status etter trekk: «Hos [avsenderens ledd]» (`sendt=true` består) — ALDRI «Utkast»; #11 er D-klassen og rettes av samme avledningsregel. Foreløpig retning fra 02.08 gjøres bindende.
4. **#6:** «UTFØRER»-etikett i detalj-header → **«Faggruppe»**.
5. **#7/#8 — flytnavn:** tittel i flyt-sheeten + caption ved flytlinja på web-detalj; mobil-header uendret (plassbudsjett 01.08), navnet ved tap.

Bøtte 2 (eng-bugs #4/#10a) ruter cowork; bøtte 4 (#2/#3) ligger i kontekst-fra-innlogging-sporet (fabels designnotat) — begge bekreftet riktig plassert.

## Prøvekjørings-vedtak (fabel, 31.07 — relayet direkte, cowork treg)

Drift-diagnosen (22 fremmede migreringer = modul-pakkenes egne i delt DB) er akseptert. **Vei 2 valgt:** `BEGIN … ROLLBACK`-dry-run av hele migreringen + backfill først (beviser ren kjøring mot faktisk dataform uten å persistere), deretter vei 1 (`migrate deploy` på lokal sandkasse). Betingelser: `migrate dev` forbudt; etter deploy verifiseres at KUN den ene pending-migreringen ble anvendt (fremmede urørt) + rad-tellinger på de 6 backfilte feltene; rapport før push. Begrunnelse: delt migrasjonstabell → dry-run koster minutter, fjerner hele klassen «backfill feiler halvveis».
