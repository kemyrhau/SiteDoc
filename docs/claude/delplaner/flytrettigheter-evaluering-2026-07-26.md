# Flytrettigheter — uavhengig evaluering av matrisen (2026-07-26)

> **Rolle:** uavhengig annenmåling bestilt av Kenneth — skal kryssjekkes mot fabels evaluering av samme skisse (redundans-prinsippet: to lag måler samme premiss uavhengig, uenighet løftes til Kenneth). Denne er skrevet UTEN å lese fabels konklusjon.
>
> **Grunnlag (kodeverifisert):** `packages/shared/src/utils/statusHandlinger.ts` (ROLLE_HANDLINGER_DEFAULTS + hentStatusHandlinger) · `packages/shared/src/utils/index.ts` (validTransitions) · flytmodell-vedtak + restvedtak 2026-07-22 · rettighetsmatrise-config-design rev. 7 · Kenneths skisse (4 flytbokser) + skjermbilde av test-matrisen.

## 1. Dagens defaults — målt i kode (develop)

| Rolle | Overganger i ROLLE_HANDLINGER_DEFAULTS |
|---|---|
| registrator | draft→sent (Send) · draft→deleted (Slett) · received→draft (Trekk tilbake) · closed/dismissed/cancelled→draft (Gjenåpne) · slettet→gjenopprett |
| bestiller | draft→sent · draft→deleted · received→draft (Trekk tilbake) · in_progress→closed (Lukk) · approved→closed (Lukk) |
| utfører | received→responded/sent/forwarded/dismissed (Besvar/Send/Videresend/Avvis) · in_progress→responded/sent/forwarded |
| godkjenner | responded→approved/in_progress/sent/forwarded (Godkjenn/Send tilbake/Send/Videresend) · in_progress→closed · approved→sent |
| prosjektadmin | arver ALT innenfor statusmaskinen + deleted/forwarded (tom override = full) |

Auto (ingen celler): sent→received (kollaps ved send) · received→in_progress (lesekvittering, restvedtak 2).

## 2. Hull — skissen vs. koden

**H1 — Bestiller er ikke en stasjon i dagens maskin (kjernefunnet).** Skissens Flytboks 2 er et sted dokumentet STÅR («her bestiller man et arbeid utført», med send/send tilbake/avvis). I koden har bestiller ingen stasjons-statuser: received/in_progress er i praksis utfører-stasjonen (besvar/send/avvis bor der), responded er godkjenner-stasjonen. Bestillers defaults er avsender-handlinger (send kladd, trekk tilbake) + lukking. Når registrator sender, finnes det ingen status som betyr «hos bestiller». Dette er trolig grunnen til at de siste hullene ikke lar seg lukke: **statusene koder ikke posisjon på linjen.** **MÅLT + KORRIGERT (cowork 2026-07-26):** `DokumentflytMedlem` **HAR et `steg`-felt** (`steg Int @default(1)`) med unique-constraints på `(dokumentflytId, faggruppe/medlem/gruppe, rolle, steg)` — så **ordnet posisjon finnes allerede i medlemslaget** (en tidligere måling som sa «intet rekkefølge-felt» var feil — feil søk-nøkkelord, `steg` ble misset). Holderen spores i tillegg via `DocumentTransfer.recipientUserId`/`recipientGroupId` + `senderRolle`. MEN statusmaskinen (`VALID_TRANSITIONS`) + matrisen (`FlytRettighetOverride @@unique[rolle, fraStatus, tilStatus]`) bruker **verken `steg` eller posisjon** — de nøkler kun rolle × status. Konklusjon: posisjon-**stillaset finnes** (`steg`), men rettighets-/status-koordinatsystemet ignorerer det. 4-boks-flyten kjøres reelt som 4 roller på ~3 status-stasjoner; per-boks-konfig er umulig fordi matrisen er rolle × status, ikke steg × retning. **N-boks er derfor NÆRMERE enn en full ombygging:** `steg` er der; det som mangler er (a) status frikoblet fra posisjon og (b) matrise/rettigheter nøklet på `steg`/stasjonstype × retning.

**Validerings-regel (Kenneth-vedtak 2026-07-26): registrator kun på steg 1.** Ny flyt starter alt med registrator som eneste rolle (`dokumentflyt.ts:60`) — registrator alltid først til venstre. Men dagens unique-constraints hindrer kun *eksakt* duplikat; to registratorer med ulik faggruppe/steg er i dag tillatt, og begge får full registrator-rett (matrise er rolle-nøklet, kan ikke skille dem). Regel som skal håndheves ved flyt-config: **registrator kan kun stå på `steg = 1`** (flere personer som medlemmer av steg 1 er ok = flere opprettere; men ingen registrator på steg > 1, og ingen andre roller på steg 1). Mangler validering i dag.

**Konkret H1-manifestasjon — 2-boks Reg→Godkjenner virker IKKE i dag (Kenneth-vedtak 2026-07-26: det MÅ fungere).** En «opprett → godkjenn»-flyt (registrator + godkjenner, ingen utfører) er en helt vanlig enkel arbeidsflyt. I dag: registrator sender → dokumentet står som «Mottatt» hos godkjenneren, men `received→approved` finnes ikke — godkjenning krever «responded» (Besvart), som er utførers handling. Uten utfører står dokumentet fast. **Vedtatt fiks: legg til `received→approved` (Godkjenn direkte fra Mottatt), eid av godkjenner-rollen** — liten statusmaskin-endring, egen kode-ordre. Patcher 2-boks-tilfellet; den generelle variabel-flytlengde-saken (H1) består til posisjons-modellen.

**H2 — Ingen tilbake-kant fra utfører-leddet.** Linjemodell-vedtaket sier «ikke-endepunkt kan alltid sendes tilbake», og skissens boks 3 har «send tilbake ← til forrige flytboks (be om noe)». I maskinen finnes ingen slik kant: in_progress→sent er «Send på nytt» (FREM etter retting), responded→in_progress er godkjenners tilbake-kant, received→draft er avsenders trekk-tilbake. Utfører kan ikke be forrige ledd om noe via status. Enten (a) ny overgang i statusmaskinen (kode-endring, Kenneth-vedtak — maskinen er fast kode per vedtak 1), eller (b) avklare at «be om noe» dekkes av kommentar/besvar uten statusflytt. Foreslått: mål H1 først — svaret avhenger av om bestiller-stasjonen finnes.

**H3 — Videresend-defaults motsier vedtak 3 (dok↔kode-avvik).** Vedtak 3 (2026-07-22): videresend flyttes fra utfører/godkjenner til administrator «via matrise-defaults». Koden i dag: `forwarded` ligger fortsatt i utførers (received, in_progress) og godkjenners (responded) default-sets. Skissen har i tillegg videresend under Godkjenner — men prosaen din sier «kun videresend-funksjonen hos f.eks prosjektadmin flytter et dokument ut av flyten», som støtter vedtak 3, ikke skissen. **Anbefaling: iverksett vedtak 3 — default AV for alle flyt-roller, PÅ kun prosjektadmin.** Parallelle flyter i samme faggruppe som ikke skal sammenblandes er nettopp argumentet: kryssflytt er et admin-verktøy. Matrisen kan slå det på for godkjenner der et firma trenger det. (Skisse-avviket flagges til Kenneth-avgjørelse.)

**H4 — Avvis-eierskap.** Skissen: avvis hos bestiller (boks 2) og godkjenner (boks 4). Koden: kun utfører (received→dismissed); godkjenners «avvis» er i praksis Send tilbake (responded→in_progress) eller Lukk. **Kenneth-presisert 2026-07-26: godkjenner SKAL kunne avvise (med begrunnelse).** Det krever ny overgang i statusmaskinen — responded→dismissed finnes ikke (dismissed nås kun fra received); altså samme kategori som H2: kode-endring + Kenneth-vedtak, ikke bare en matrisecelle. Begrunnelseskravet arves automatisk (statusKreverBegrunnelse gjelder tilStatus=dismissed, ikke fraStatus). Bestiller-avvis avhenger fortsatt av H1: finnes bestiller-stasjonen, bør avvis følge stasjonen («den som mottar kan avvise det som kom»), ikke rollen.

**H5 — Slett mid-flow (skissen: «for sjekklister — slett for de som har rettighet» i boks 2–4).** Anbefaler NEI som default: slett midt i flyten knekker sporbarheten (samme begrunnelse som closed→draft-vedtaket: reparasjon skal skje via gjenåpning, ikke duplisering/sletting). Kladd-slett (registrator/bestiller) + admin-slett dekker behovet; avvis/lukk er de riktige mid-flow-utgangene. Er behovet reelt hos pilotkunden, kan matrisen slå på per celle — men ikke som standard.

**H6 — Godkjenner kan ikke lukke fra godkjent.** approved→closed eies i dag av bestiller (+admin); godkjenner har kun approved→sent. Asymmetrisk mot skissen (boks 4: «lukk») og mot at godkjenner HAR lukk fra in_progress. Foreslått default: PÅ for godkjenner.

**H7 — Dok-drift i koden.** Docstring-tabellen i `statusHandlinger.ts` (over hentRolleFiltrertHandlinger) sier «approved: registrator Lukk, Videresend» — defaults har ingen approved-oppføring for registrator. Liten sak, men eksakt den driften statuskilde-regelen skal hindre; bør rettes i samme ordre som H3.

**H8 — Test-skjermbildet avviker fra develop-defaults.** Skjermbildet viser bl.a. Avvis (mottatt) kun hos prosjektadmin og «Send tilbake» under Under arbeid hos utfører — develop-koden gir utfører avvis-default og har ingen utfører-tilbake-kant (H2). Enten har test overrides lagret, eller test ligger bak develop (F1–F5-omleggingen). Må måles av cowork før noen konklusjon trekkes av skjermbildet.

## 3. Optimalisert default-matrise (forslag — alt «foreslått», ikke eksisterende atferd)

Endringer mot dagens kode-defaults:

| # | Celle | I dag | Foreslått | Hvorfor |
|---|---|---|---|---|
| 1 | utfører: received/in_progress→forwarded | PÅ | **AV** | Vedtak 3; parallelle flyter skal ikke kunne blandes av medlemmer |
| 2 | godkjenner: responded→forwarded | PÅ | **AV** | Vedtak 3 (skisse-avvik → Kenneth avgjør) |
| 3 | godkjenner: approved→closed | mangler | **PÅ** | H6 — endepunktet eier sin egen lukking |
| 4 | bestiller: rejected→sent-arven / «Send på nytt» | (F3-merget) | uendret | dekket av in_progress-merge |
| 5 | Slett mid-flow | av | **forblir av** | H5 — sporbarhet |
| 6 | closed→draft «Gjenåpne» | registrator | uendret + Farlig sone | allerede vedtatt 2026-07-23 |

Resten av dagens defaults står — de er godt kalibrert etter F1–F5-runden. H1/H2 er ikke matrise-justeringer men modellspørsmål; de må avgjøres FØR flere default-flyttinger, ellers optimaliserer vi celler i feil koordinatsystem.

**Utsatt (Kenneth 2026-07-26): skalering ut over 4 flytbokser (N-boks/posisjonsmodell).** Dagens maskin støtter maks 4 (reelt ~3, jf. H1): status koder både posisjon og tilstand, rolle-enumen er lukket, matrisen kan ikke skille gjentatte roller per boks. Bygges IKKE nå (YAGNI, pilotfrist) — men boks-UI-en (§ 4) velges bevisst fordi den generaliserer til N bokser den dagen behovet kommer; status-matrisen gjør det ikke. H1-målingen viser hvor langt unna posisjonsmodellen faktisk er.

## 4. Konfigurerbar boks-UI — JA, uten ny datamodell

Skissens visualisering kan bli selve konfigurasjonsflaten som en **ren projeksjon** over eksisterende substrat:

- Hver toggle under en flytboks ER en matrisecelle (rolle, fraStatus, tilStatus) — klikk skriver samme `FlytRettighetOverride`-rad, samme endringslogg, samme statusmaskin-snitt. Ingen schema-endring, ingen ny lagring.
- Boksvisningen grupperer cellene per stasjon med retningsspråk: **→ Fram · ← Tilbake · ■ Endepunkt (godkjenn/avvis/lukk) · lokale (besvar/slett)** — i stedet for status-radene.
- **Prosjektadmin er ikke en boks:** legges som egen full-bredde-sone under linjen («virker på hele linjen»), med de kryssgående handlingene — Opprett, Videresend (på tvers av flyter/faggrupper), Gjenåpne, Lukk·trukket, Slett. Det svarer på plasseringsspørsmålet: admin-handlingene hører ikke hjemme i noen enkeltboks fordi de nettopp ikke er linjebevegelser.
- Auto-overganger rendres som merker PÅ pilene (sent→received · lesekvittering→Pågår), ikke som celler — samme regel som cellespec.
- Celle-tilstandene gjenbrukes uendret fra `Flyt-rettigheter Cellespec.dc.html` (fylt=på, ramme=av, amber-prikk=overstyrt, A=auto, hengelås=låst).
- Matrise-fanen består som «avansert visning» av samme data — trengs for revisjon/feilsøking, men boksvisningen blir default-fanen.

Mockup: `Flytboks Konfigurator.dc.html` (designprosjektet).

## 5. Svar på Kenneths tre spørsmål

1. **Klarer vi konfigurerbar UI etter skissen?** Ja — som projeksjon (§ 4). Ingen ny modell; kun ny visning + celle→boks-mapping. Forbehold: mappingen blir først HELT ren når H1 (bestiller-stasjonen) er avklart.
2. **Ta skissen til fabel og kryssjekke?** Ja — det er redundans-prinsippet i praksis. Viktig: gi fabel skissen UTEN denne evalueringen, ellers er ikke målingene uavhengige. Sammenlign etterpå; uenighet er signalet, ikke feilen. Sjekk særlig om fabel også finner H1/H2.
3. **Forbedre flytboksene (dynamikk, grupper/personer)?** Enig i utsettelse — H1 er fundamentet og påvirker hvordan grupper/personer per boks skal vises; det designes best etter modellavklaringen.

## Neste steg (foreslått rekkefølge)
1. Kenneth: kryssjekk mot fabels evaluering → felles hull-liste.
2. Cowork: mål H1 (posisjonsfelt?) + H8 (test vs develop) — nå-rapport, to konkrete spørsmål.
3. Kenneth-vedtak: H2 (utfører-tilbake) + H3-skisseavviket (godkjenner-videresend av/på). H4-delen godkjenner-avvis er Kenneth-avklart 2026-07-26 (JA) — går i samme statusmaskin-ordre som H2 (ny overgang responded→dismissed, default godkjenner+admin).
4. Ordre: default-justeringene (§ 3) + H7-dokfiks — liten, kan slås sammen med rev. 7-revisjonsordren.
5. Deretter: boks-UI-ordre (§ 4) med mockupen som fasit.
